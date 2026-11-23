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
  // Tage auf- und zuklappen; ohne eigene Wahl ist nur der neueste Tag offen
  let dayOpen = $state({});

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
  // Symbol je Kennzeichen, das der Bot an seine Meldungen hängt (tag); dasselbe Symbol steht am Chip
  // und in den Details an jeder Zeile, die zu diesem Chip beiträgt.
  const TAG_ICON = {
    planted: '🌱',
    watered: '💧',
    weeded: '🧹',
    park: '🏞',
    parkRenewed: '🔄',
    bonsaiFinished: '🌳',
    branchesCut: '✂',
    boosted: '✨',
    scissorsBought: '🛒',
    problem: '⚠',
  };

  const FROM_MESSAGES = 'Aus den Meldungen des Bots in diesem Lauf';

  // Schritte eines Laufs (steps aus log.json), in der Reihenfolge von daily.py
  const STEPS = {
    weeds: ['🧹', 'Unkraut'],
    harvest: ['🌾', 'Ernte'],
    plant: ['🌱', 'Anbau'],
    water: ['💧', 'Gießen'],
    museum: ['🏛', 'Museum'],
    bees: ['🐝', 'Bienen'],
    park: ['🏞', 'Park'],
    decogardens: ['🎭', 'Deko-Gärten'],
    bonuses: ['🎁', 'Boni'],
    bonsai: ['🌳', 'Bonsai'],
    infinity: ['♾', 'Infinity-Quest'],
    minigames: ['🎲', 'Minispiele'],
    boosters: ['✨', 'Wachstums-Dekos'],
  };

  function stepInfo(s) {
    const [icon, label] = STEPS[s.key] ?? ['•', s.key];
    return { icon, label };
  }

  function fmtMs(ms) {
    return ms >= 1000 ? `${(ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} s` : `${ms} ms`;
  }

  // Erklärung, die sich aus Schritt und Einstellungen ergibt
  function stepNote(e, s) {
    // nur wenn eine Quest offen war und das Geld unter der Grenze lag (der Bot prüft beides)
    if (s.key === 'infinity' && s.infinity) {
      return `Quest ${s.infinity.quest} offen, aber übersprungen: Kontostand ${fmt(Math.round(s.infinity.money))} wT liegt unter der Grenze von ${fmt(s.infinity.limit)} wT (infinityQuestLimit in der Notiz)`;
    }
    if (s.key === 'park' && e.actions?.parkRenewed && s.changes?.money != null) {
      const cost = s.changes.money - (e.actions.parkMoney ?? 0);
      if (cost < 0) return `Erneuern von ${fmt(e.actions.parkRenewed)} Park-Dekos: ${fmtDelta(cost)} wT (Kasse ${fmtDelta(e.actions.parkMoney ?? 0)} wT)`;
    }
    return '';
  }

  // Was der Lauf aus der Notiz gelesen hat
  function settingsText(st) {
    const bees = { 1: '2 h', 2: '8 h', 3: '24 h' }[st.bees] ?? 'aus';
    return [
      st.stopped ? 'isStop an' : null,
      `Pflanzen: ${(st.plants ?? []).join(', ') || '-'}`,
      `Park ${st.park ? 'an' : 'aus'}`,
      `Bienen ${bees}`,
      `Minispiele ${st.minigames ? 'an' : 'aus'}`,
      st.boosters != null ? `Wachstums-Dekos ${st.boosters ? 'an' : 'aus'}` : null,
      st.infinityLimit != null ? `Infinity ab ${fmt(st.infinityLimit)} wT` : null,
      st.bonsaiCutLevel != null ? `Bonsai-Stufe ${st.bonsaiCutLevel} (${(st.bonsaiPrices ?? []).join(', ')})` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  function toggle(e, open) {
    if (window.getSelection()?.toString()) return; // markierter Text soll die Karte nicht zuklappen
    expanded = { ...expanded, [key(e)]: !open };
  }

  // Was der Bot laut seinen Meldungen getan hat (actions aus log.json), als Chips mit Herkunft im Tooltip.
  function actionChips(a) {
    if (!a) return [];
    const chips = [];
    const n = (v) => fmt(v);
    const add = (tag, text, source, cls) => chips.push({ text: `${TAG_ICON[tag]} ${text}`, title: `${FROM_MESSAGES}: ${source}`, cls });
    if (a.planted) add('planted', `${n(a.planted)} gepflanzt`, '„Im Garten … wurden … Pflanzen gepflanzt“, über alle Gärten summiert');
    if (a.watered) add('watered', `${n(a.watered)} gegossen`, '„Im Garten … wurden … Pflanzen gegossen“, über alle Gärten summiert');
    if (a.weeded) add('weeded', `${n(a.weeded)} Unkraut`, '„… Felder von Unkraut befreit“, über alle Gärten summiert');
    if (a.parkMoney || a.parkPoints || a.parkParkpoints) {
      add(
        'park',
        `Park +${n(a.parkMoney ?? 0)} wT`,
        `Parkkasse eingesammelt („Collected: …“): ${n(a.parkMoney ?? 0)} wT, ${n(a.parkPoints ?? 0)} Punkte, ${n(a.parkParkpoints ?? 0)} Parkpunkte`,
      );
    }
    if (a.parkRenewed) add('parkRenewed', `${n(a.parkRenewed)} erneuert`, 'abgelaufene Park-Dekos neu gekauft („Renewed … Items“); kostet Wurzeltaler');
    if (a.bonsaiFinished) add('bonsaiFinished', `${n(a.bonsaiFinished)} Bonsai fertig`, '„Finish Bonsai in slot …“');
    if (a.boosted) add('boosted', `${n(a.boosted)} Deko${a.boosted > 1 ? 's' : ''}`, 'Wachstums-Dekos ausgelöst („Booster … ausgelöst“)');
    if (a.branchesCut) add('branchesCut', `${n(a.branchesCut)} Äste`, 'Bonsai-Äste geschnitten („Cut branch …“)');
    if (a.scissorsBought) add('scissorsBought', `${n(a.scissorsBought)} Scheren gekauft`, '„Rebuying … normal scissors“');
    if (a.problems?.length) {
      add(
        'problem',
        `${a.problems.length} ${a.problems.length === 1 ? 'Hinweis' : 'Hinweise'}`,
        `Warnungen und Fehler:\n${a.problems.join('\n')}`,
        'warn',
      );
    }
    return chips;
  }

  // Herkunft der übrigen Chips: kein Text vom Bot, sondern der Vergleich zweier Spielstände
  function compareTitle(e, what) {
    return e.source === 'bot'
      ? `${what}: Spielstand am Ende des Laufs verglichen mit dem Stand direkt nach dem Login`
      : `${what}: Spielstand beim Login verglichen mit dem Ende des letzten Laufs (seit ${fmtClock(e.since)}), also von Hand oder durchs Spiel`;
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
    {#each days as d, i (d.day)}
      {@const dayIsOpen = dayOpen[d.day] ?? i === 0}
      <button class="day" onclick={() => (dayOpen = { ...dayOpen, [d.day]: !dayIsOpen })} aria-expanded={dayIsOpen}>
        <span class="chev">{dayIsOpen ? '▾' : '▸'}</span>
        {d.day}
        <span class="count">{d.entries.length} {d.entries.length === 1 ? 'Eintrag' : 'Einträge'}</span>
      </button>
      {#if dayIsOpen}
      <ul>
        {#each d.entries as e, j (key(e))}
          {@const stock = stockList(e)}
          <!-- ohne eigene Wahl ist der neueste Eintrag der Ansicht aufgeklappt -->
          {@const open = expanded[key(e)] ?? (i === 0 && j === 0)}
          {@const details =
            (e.messages?.length ?? 0) > 0 || (e.steps?.length ?? 0) > 0 || !!e.settings || stock.length > STOCK_PREVIEW}
          <!-- ein Klick irgendwo auf die Karte klappt sie auf oder zu; role="button" wird nur gesetzt, wenn es etwas zum
               Aufklappen gibt, das erkennt die Prüfung nicht -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <li
            class={e.source}
            class:clickable={details}
            class:failed={e.failed}
            onclick={() => details && toggle(e, open)}
            onkeydown={(ev) => details && (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), toggle(e, open))}
            tabindex={details ? 0 : undefined}
            role={details ? 'button' : undefined}
            aria-expanded={details ? !!open : undefined}
          >
            <div class="when">
              <span class="time">{fmtClock(e.time)}</span>
              <span class="src" title={e.since ? `seit ${fmtClock(e.since)}` : ''}>
                {e.source === 'bot' ? '🤖 Bot' : '✋ Außerhalb'}{#if e.seconds}<span class="dur"> · {e.seconds} s</span>{/if}
              </span>
              {#if details}
                <span class="toggle">{open ? '▾ weniger' : '▸ Details'}</span>
              {/if}
            </div>
            <div class="what">
              {#if e.changes.level}
                <span class="chip quest" title={compareTitle(e, 'Level')}>
                  🎉 Level {e.changes.level[0]} → {e.changes.level[1]}
                </span>
              {/if}
              {#each Object.entries(e.changes.series ?? {}) as [id, [from, to]] (id)}
                <span class="chip quest" title={compareTitle(e, `Erledigte Quests der Reihe ${seriesName(id)}`)}>
                  ✔ {seriesName(id)} {from} → {to}
                </span>
              {/each}
              {#if e.changes.money}
                <span
                  class="chip"
                  class:plus={e.changes.money > 0}
                  class:minus={e.changes.money < 0}
                  title={compareTitle(e, 'Kontostand (Wurzeltaler)')}
                >
                  💰 {fmtDelta(e.changes.money)} wT
                </span>
              {/if}
              {#if e.changes.points}
                <span class="chip plus" title={compareTitle(e, 'Punkte')}>⭐ {fmtDelta(e.changes.points)}</span>
              {/if}
              {#if e.changes.coins}
                <span class="chip" title={compareTitle(e, 'Coins')}>🪙 {fmtDelta(e.changes.coins)} Coins</span>
              {/if}
              {#each actionChips(e.actions) as c (c.text)}
                <span class="chip act {c.cls ?? ''}" title={c.title}>{c.text}</span>
              {/each}
              {#each open ? stock : stock.slice(0, STOCK_PREVIEW) as [name, delta] (name)}
                <span
                  class="chip"
                  class:plus={delta > 0}
                  class:minus={delta < 0}
                  title={compareTitle(e, `Regalbestand ${name}`)}>{fmtDelta(delta)} {name}</span
                >
              {/each}
              {#if stock.length > STOCK_PREVIEW && !open}
                <span class="more">+{fmt(stock.length - STOCK_PREVIEW)} weitere</span>
              {/if}
            </div>
            {#if open && e.steps?.length}
              <!-- je Schritt: was sich geändert hat und was der Bot dabei gemeldet hat -->
              {@const shown = e.steps.filter((s) => s.changes || s.messages || s.error || s.infinity)}
              {@const quiet = e.steps.filter((s) => !(s.changes || s.messages || s.error || s.infinity))}
              <!-- Klicks im Detailbereich klappen die Karte nicht zu (lesen, markieren, Tooltips) -->
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div class="steps" onclick={(ev) => ev.stopPropagation()}>
                {#each shown as s (s.key)}
                  <div class="step" class:failed={!!s.error}>
                    <div class="step-head">
                      <span class="step-name">{stepInfo(s).icon} {stepInfo(s).label}</span>
                      <span class="ms">{fmtMs(s.ms)}</span>
                      {#if s.changes?.money}
                        <span class="chip" class:plus={s.changes.money > 0} class:minus={s.changes.money < 0}>
                          💰 {fmtDelta(s.changes.money)} wT
                        </span>
                      {/if}
                      {#if s.changes?.points}<span class="chip plus">⭐ {fmtDelta(s.changes.points)}</span>{/if}
                      {#if s.changes?.coins}<span class="chip">🪙 {fmtDelta(s.changes.coins)}</span>{/if}
                      {#each Object.entries(s.changes?.stock ?? {}) as [name, delta] (name)}
                        <span class="chip" class:plus={delta > 0} class:minus={delta < 0}>{fmtDelta(delta)} {name}</span>
                      {/each}
                      {#if s.error}<span class="chip warn" title={s.error}>⚠ fehlgeschlagen</span>{/if}
                    </div>
                    {#if stepNote(e, s)}<p class="step-note">{stepNote(e, s)}</p>{/if}
                    {#if s.messages?.length}
                      <ol class="messages">
                        {#each s.messages as m, k (k)}
                          <li class={m.level}>
                            <span class="tag" title={m.tag ? 'Diese Zeile zählt für den Chip mit diesem Symbol' : ''}
                              >{TAG_ICON[m.tag] ?? ''}</span
                            ><span>{m.text}{#if m.count > 1}<span class="times"> ×{m.count}</span>{/if}</span>
                          </li>
                        {/each}
                      </ol>
                    {/if}
                  </div>
                {/each}
                {#if quiet.length}
                  <p class="legend" title={quiet.map((s) => `${stepInfo(s).label}: ${fmtMs(s.ms)}`).join('\n')}>
                    Ohne Änderung: {quiet.map((s) => stepInfo(s).label).join(', ')}
                  </p>
                {/if}
                {#if e.settings}<p class="legend">⚙ {settingsText(e.settings)}</p>{/if}
                <p class="legend">Zeilen mit Symbol ergeben die Chips mit demselben Symbol oben.</p>
              </div>
            {:else if open && e.messages?.length}
              <!-- der genaue Text, den der Bot in diesem Lauf gemeldet hat; Klicks darin klappen nicht zu -->
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
              <ol class="messages" onclick={(ev) => ev.stopPropagation()}>
                {#each e.messages as m, j (j)}
                  <li class={m.level}>
                    <span class="tag" title={m.tag ? 'Diese Zeile zählt für den Chip mit diesem Symbol' : ''}
                      >{TAG_ICON[m.tag] ?? ''}</span
                    ><span>{m.text}{#if m.count > 1}<span class="times"> ×{m.count}</span>{/if}</span>
                  </li>
                {/each}
              </ol>
              <p class="legend">Zeilen mit Symbol ergeben die Chips mit demselben Symbol oben.</p>
            {/if}
          </li>
        {/each}
      </ul>
      {/if}
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    margin: 1.2rem 0 0.5rem;
    padding: 0;
    border: none;
    background: none;
    color: var(--muted);
    font-size: 0.95rem;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }
  .day .count {
    font-size: 0.75rem;
    font-weight: 500;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  ul > li {
    display: grid;
    grid-template-columns: 7.5rem minmax(0, 1fr);
    gap: 0.8rem;
    padding: 0.6rem 0.8rem;
    background: var(--panel);
    border: 1px solid var(--border);
    border-left: 3px solid var(--border);
    border-radius: var(--radius);
  }
  ul > li.outside {
    border-left-color: var(--warn);
  }
  ul > li.bot {
    border-left-color: var(--accent);
  }
  .toggle {
    margin-top: 0.2rem;
    color: var(--muted);
    font-size: 0.75rem;
  }
  ul > li.clickable {
    cursor: pointer;
  }
  ul > li.clickable:hover {
    border-color: var(--accent);
  }
  ul > li.failed {
    border-left-color: var(--danger);
  }
  .dur {
    color: var(--muted);
  }
  .steps {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    cursor: auto;
  }
  .step {
    border-left: 2px solid var(--border);
    padding-left: 0.6rem;
  }
  .step.failed {
    border-left-color: var(--danger);
  }
  .step-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem;
    margin-bottom: 0.3rem;
  }
  .step-name {
    font-weight: 700;
    font-size: 0.85rem;
  }
  .ms {
    font-size: 0.72rem;
    color: var(--muted);
    margin-right: 0.3rem;
  }
  .step-note {
    margin: 0 0 0.3rem;
    font-size: 0.8rem;
    color: var(--warn);
  }
  .messages {
    grid-column: 1 / -1;
    margin: 0;
    padding: 0.5rem 0.7rem;
    list-style: none;
    background: var(--panel-2);
    border-radius: 8px;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 0.78rem;
    line-height: 1.5;
    overflow-x: auto;
  }
  .messages li {
    display: grid;
    grid-template-columns: 1.6rem minmax(0, 1fr);
    white-space: pre-wrap;
  }
  .messages .tag {
    font-family: system-ui, sans-serif;
  }
  .legend {
    grid-column: 1 / -1;
    margin: -0.3rem 0 0;
    font-size: 0.72rem;
    color: var(--muted);
  }
  .messages li.warning {
    color: var(--warn);
  }
  .messages li.error {
    color: var(--danger);
  }
  .messages .times {
    color: var(--muted);
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
    ul > li {
      grid-template-columns: 1fr;
      gap: 0.3rem;
    }
    .when {
      flex-direction: row;
      gap: 0.6rem;
    }
  }
</style>
