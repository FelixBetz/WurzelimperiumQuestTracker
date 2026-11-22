<script>
  import { loadSibling, seriesById } from '../data.js';
  import { fmt, fmtDelta, fmtClock } from '../format.js';

  // log.json vom Bot: pro Lauf ein Eintrag „bot“ (was der Bot geändert hat) und, wenn sich seit dem
  // letzten Lauf etwas getan hat, einer „outside“ (von Hand im Browser oder durchs Spiel selbst).
  let entries = $state(null);
  let error = $state(null);
  let source = $state('all'); // 'all' | 'bot' | 'outside'
  let onlyQuests = $state(false);
  let expanded = $state({});

  loadSibling('log.json')
    .then((log) => (entries = log?.entries ?? []))
    .catch((err) => (error = String(err)));

  const STOCK_PREVIEW = 8;

  let days = $derived.by(() => {
    if (!entries) return [];
    const out = [];
    for (const e of [...entries].reverse()) {
      if (source !== 'all' && e.source !== source) continue;
      if (onlyQuests && !e.changes.series && !e.changes.level) continue;
      const day = new Date(e.time).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });
      if (out.at(-1)?.day !== day) out.push({ day, entries: [] });
      out.at(-1).entries.push(e);
    }
    return out;
  });

  function seriesName(id) {
    return seriesById.get(id)?.name ?? id;
  }

  // Bestand: erst die größten Änderungen
  function stockList(e) {
    return Object.entries(e.changes.stock ?? {}).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  }

  function key(e) {
    return `${e.source}:${e.time}`;
  }

  // Was der Bot laut seinen Meldungen getan hat (actions aus log.json), als Chips.
  function actionChips(a) {
    if (!a) return [];
    const chips = [];
    const n = (v) => fmt(v);
    if (a.planted) chips.push({ text: `🌱 ${n(a.planted)} gepflanzt` });
    if (a.watered) chips.push({ text: `💧 ${n(a.watered)} gegossen` });
    if (a.weeded) chips.push({ text: `🧹 ${n(a.weeded)} Unkraut` });
    if (a.parkMoney || a.parkPoints || a.parkParkpoints) {
      chips.push({
        text: `🏞 Park +${n(a.parkMoney ?? 0)} wT`,
        title: `Parkkasse: ${n(a.parkMoney ?? 0)} wT, ${n(a.parkPoints ?? 0)} Punkte, ${n(a.parkParkpoints ?? 0)} Parkpunkte`,
      });
    }
    if (a.parkRenewed) chips.push({ text: `🏞 ${n(a.parkRenewed)} erneuert` });
    if (a.bonsaiFinished) chips.push({ text: `🌳 ${n(a.bonsaiFinished)} Bonsai fertig` });
    if (a.branchesCut) chips.push({ text: `✂ ${n(a.branchesCut)} Äste` });
    if (a.scissorsBought) chips.push({ text: `✂ ${n(a.scissorsBought)} Scheren gekauft` });
    if (a.problems?.length) {
      chips.push({
        text: `⚠ ${a.problems.length} ${a.problems.length === 1 ? 'Hinweis' : 'Hinweise'}`,
        title: a.problems.join('\n'),
        cls: 'warn',
      });
    }
    return chips;
  }
</script>

<div class="log">
  <div class="controls">
    <div class="seg">
      <button class:on={source === 'all'} onclick={() => (source = 'all')}>Alle</button>
      <button class:on={source === 'bot'} onclick={() => (source = 'bot')}>🤖 Bot</button>
      <button class:on={source === 'outside'} onclick={() => (source = 'outside')}>✋ Außerhalb</button>
    </div>
    <label class="chk"><input type="checkbox" bind:checked={onlyQuests} /> nur Quests und Level</label>
  </div>
  <p class="hint">
    🤖 <b>Bot</b>: was ein Lauf geändert hat (Ernte, Anbau, Käufe, Quests) und was er laut seinen Meldungen getan hat
    (gepflanzt, gegossen, Park, Hinweise). ✋ <b>Außerhalb</b>: was sich zwischen zwei Läufen geändert hat, also von
    Hand im Browser (oder durchs Spiel selbst). Die letzten 14 Tage.
  </p>

  {#if error}
    <p class="empty">Protokoll nicht erreichbar ({error}).</p>
  {:else if entries === null}
    <p class="empty">Lade …</p>
  {:else if days.length === 0}
    <p class="empty">Noch keine Einträge.</p>
  {:else}
    {#each days as d (d.day)}
      <h3 class="day">{d.day}</h3>
      <ul>
        {#each d.entries as e (key(e))}
          {@const stock = stockList(e)}
          {@const open = expanded[key(e)]}
          <li class={e.source}>
            <div class="when">
              <span class="time">{fmtClock(e.time)}</span>
              <span class="src" title={e.since ? `seit ${fmtClock(e.since)}` : ''}>
                {e.source === 'bot' ? '🤖 Bot' : '✋ Außerhalb'}
              </span>
            </div>
            <div class="what">
              {#if e.changes.level}
                <span class="chip quest">🎉 Level {e.changes.level[0]} → {e.changes.level[1]}</span>
              {/if}
              {#each Object.entries(e.changes.series ?? {}) as [id, [from, to]] (id)}
                <span class="chip quest">✔ {seriesName(id)} {from} → {to}</span>
              {/each}
              {#if e.changes.money}
                <span class="chip" class:plus={e.changes.money > 0} class:minus={e.changes.money < 0}>
                  💰 {fmtDelta(e.changes.money)} wT
                </span>
              {/if}
              {#if e.changes.points}
                <span class="chip plus">⭐ {fmtDelta(e.changes.points)}</span>
              {/if}
              {#if e.changes.coins}
                <span class="chip">🪙 {fmtDelta(e.changes.coins)} Coins</span>
              {/if}
              {#each actionChips(e.actions) as c (c.text)}
                <span class="chip act {c.cls ?? ''}" title={c.title ?? ''}>{c.text}</span>
              {/each}
              {#each open ? stock : stock.slice(0, STOCK_PREVIEW) as [name, delta] (name)}
                <span class="chip" class:plus={delta > 0} class:minus={delta < 0}>{fmtDelta(delta)} {name}</span>
              {/each}
              {#if stock.length > STOCK_PREVIEW}
                <button class="more" onclick={() => (expanded = { ...expanded, [key(e)]: !open })}>
                  {open ? 'weniger' : `+${fmt(stock.length - STOCK_PREVIEW)} weitere`}
                </button>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/each}
  {/if}
</div>

<style>
  .log {
    max-width: 900px;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1rem;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 9px;
    overflow: hidden;
  }
  .seg button {
    border: none;
    border-radius: 0;
    background: var(--panel);
    padding: 0.35rem 0.75rem;
    font-size: 0.85rem;
  }
  .seg button.on {
    background: var(--accent);
    color: #fff;
  }
  .chk {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--muted);
    font-size: 0.88rem;
  }
  .chk input {
    accent-color: var(--accent);
  }
  .hint {
    color: var(--muted);
    font-size: 0.82rem;
    margin: 0.6rem 0 1rem;
  }
  .empty {
    color: var(--muted);
    padding: 2rem;
    text-align: center;
  }
  .day {
    font-size: 0.95rem;
    margin: 1.2rem 0 0.5rem;
    color: var(--muted);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  li {
    display: grid;
    grid-template-columns: 7.5rem minmax(0, 1fr);
    gap: 0.8rem;
    padding: 0.6rem 0.8rem;
    background: var(--panel);
    border: 1px solid var(--border);
    border-left: 3px solid var(--border);
    border-radius: var(--radius);
  }
  li.outside {
    border-left-color: var(--warn);
  }
  li.bot {
    border-left-color: var(--accent);
  }
  .when {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .time {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .src {
    font-size: 0.78rem;
    color: var(--muted);
  }
  .what {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
  }
  .chip {
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.1rem 0.55rem;
  }
  .chip.quest {
    font-weight: 700;
    color: var(--accent-strong);
    border-color: var(--accent);
  }
  .chip.act {
    background: none;
    border-style: dashed;
  }
  .chip.warn {
    color: var(--warn);
    border-color: var(--warn);
  }
  .chip.plus {
    color: var(--accent-strong);
  }
  .chip.minus {
    color: var(--danger);
  }
  .more {
    font-size: 0.78rem;
    border: none;
    background: none;
    color: var(--muted);
    cursor: pointer;
    text-decoration: underline;
  }
  @media (max-width: 520px) {
    li {
      grid-template-columns: 1fr;
      gap: 0.3rem;
    }
    .when {
      flex-direction: row;
      gap: 0.6rem;
    }
  }
</style>
