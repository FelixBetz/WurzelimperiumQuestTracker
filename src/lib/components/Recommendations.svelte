<script>
  import { series, currentQuest, openQuests, canonicalItem, isCurrencyItem, progress, isLocked } from '../data.js';
  import { settings } from '../store.js';
  import { fmt } from '../format.js';

  let mode = $derived($settings.recoMode);
  let respect = $derived($settings.recoRespectLevel);

  let scopeQuests = $derived.by(() => {
    const lvl = $settings.level;
    // Das Häkchen steuert beide Sperr-Gründe zusammen: Level zu niedrig
    // ODER manuell (noch nicht im Spiel freigeschaltet).
    const levelLocked = (s) => lvl != null && s.minLevel != null && s.minLevel > lvl;
    const allowed = (s) => !(respect && (isLocked(s) || levelLocked(s)));
    const out = [];
    for (const s of series) {
      if (!allowed(s)) continue;
      if (mode === 'current') {
        const q = currentQuest(s, progress);
        if (q) out.push({ s, q });
      } else {
        for (const q of openQuests(s, progress)) out.push({ s, q });
      }
    }
    return out;
  });

  let items = $derived.by(() => {
    const map = new Map();
    for (const { s, q } of scopeQuests) {
      for (const r of q.requirements) {
        if (isCurrencyItem(r.item)) continue;
        const key = canonicalItem(r.item);
        let e = map.get(key);
        if (!e) {
          e = { item: key, remaining: 0, quests: 0, series: new Set() };
          map.set(key, e);
        }
        e.remaining += r.amount;
        e.quests += 1;
        e.series.add(s.name);
      }
    }
    return [...map.values()].sort((a, b) => b.remaining - a.remaining);
  });

  function setMode(m) {
    settings.update((s) => ({ ...s, recoMode: m }));
  }
</script>

<div class="reco">
  <div class="controls">
    <div class="seg">
      <button class:on={mode === 'current'} onclick={() => setMode('current')}>Aktuelle Quest je Reihe</button>
      <button class:on={mode === 'open'} onclick={() => setMode('open')}>Alle offenen Quests</button>
    </div>
    <label class="chk">
      <input
        type="checkbox"
        checked={respect}
        onchange={(e) => settings.update((s) => ({ ...s, recoRespectLevel: e.currentTarget.checked }))}
      />
      nur erreichbare Reihen (Level &amp; Freischaltung)
    </label>
  </div>

  <p class="stats">{items.length} Gegenstände aus {scopeQuests.length} Quests</p>

  {#if items.length === 0}
    <p class="empty">Nichts zu tun – kein offener Bedarf. 🌻</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Gegenstand</th>
          <th class="num">benötigt gesamt</th>
          <th class="num">Quests</th>
          <th>Reihen</th>
        </tr>
      </thead>
      <tbody>
        {#each items as it (it.item)}
          <tr>
            <td class="item">{it.item}</td>
            <td class="num big">{fmt(it.remaining)}</td>
            <td class="num">{it.quests}</td>
            <td class="series">
              {#each [...it.series].slice(0, 4) as name}<span class="tag">{name}</span>{/each}
              {#if it.series.size > 4}<span class="more">+{it.series.size - 4}</span>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .reco {
    max-width: 900px;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.6rem;
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
    padding: 0.4rem 0.8rem;
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
    font-size: 0.9rem;
  }
  .chk input {
    accent-color: var(--accent);
  }
  .stats {
    color: var(--muted);
    font-size: 0.9rem;
    margin: 0.2rem 0 1rem;
  }
  .empty {
    color: var(--muted);
    padding: 2rem;
    text-align: center;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.92rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  th {
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 650;
    position: sticky;
    top: 0;
    background: var(--bg);
  }
  th.num,
  td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  td.item {
    font-weight: 600;
  }
  td.big {
    font-weight: 700;
    color: var(--accent-strong);
  }
  .series {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .tag {
    font-size: 0.72rem;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.05rem 0.45rem;
    color: var(--muted);
  }
  .more {
    font-size: 0.72rem;
    color: var(--muted);
    align-self: center;
  }
</style>
