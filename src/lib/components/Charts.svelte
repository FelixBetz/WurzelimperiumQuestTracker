<script>
  import {
    series,
    progress,
    doneCount,
    isLocked,
    overallProgress,
    earnedRewards,
    spentItems,
  } from '../data.js';
  import { settings } from '../store.js';
  import { fmt } from '../format.js';

  function notReady(s) {
    const lvl = $settings.level;
    return isLocked(s) || (lvl != null && s.minLevel != null && s.minLevel > lvl);
  }

  // Fortschritt jeder Reihe, absteigend sortiert. Nicht erreichbare Reihen
  // (gesperrt oder Level zu niedrig) werden grau abgesetzt (Emphasis-Form).
  let seriesRows = $derived.by(() =>
    series
      .map((s) => {
        const total = s.quests.length;
        const done = doneCount(s, progress);
        return { s, done, total, pct: total ? Math.round((done / total) * 100) : 0, dim: notReady(s) };
      })
      .sort((a, b) => b.pct - a.pct)
  );

  // Bereits verbrauchte Gegenstände (aus erledigten Quests) – standardmäßig
  // Top 10, per Button auf die volle Liste erweiterbar.
  let showAllItems = $state(false);
  let itemRows = $derived(showAllItems ? spentItems : spentItems.slice(0, 10));
  let itemMax = $derived(spentItems.length ? spentItems[0].amount : 1);
  let hiddenItemCount = $derived(Math.max(0, spentItems.length - 10));

  // Ring-Meter für den Gesamtfortschritt.
  const R = 52;
  const CIRC = 2 * Math.PI * R;
  let ringOffset = $derived(CIRC * (1 - overallProgress.pct / 100));
</script>

<div class="charts">
  <div class="kpis">
    <div class="tile">
      <span class="tlabel">Quests erledigt</span>
      <span class="tvalue">{fmt(overallProgress.done)}</span>
      <span class="tsub">von {fmt(overallProgress.total)}</span>
    </div>
    <div class="tile">
      <span class="tlabel">Verdiente Wurzeltaler</span>
      <span class="tvalue">💰 {fmt(earnedRewards.taler)}</span>
      <span class="tsub">wT aus erledigten Quests</span>
    </div>
    <div class="tile">
      <span class="tlabel">Verdiente Punkte</span>
      <span class="tvalue">⭐ {fmt(earnedRewards.punkte)}</span>
      <span class="tsub">Punkte aus erledigten Quests</span>
    </div>
  </div>

  <section class="panel">
    <h3>Gesamtfortschritt</h3>
    <div class="ring-wrap">
      <svg class="ring" viewBox="0 0 120 120" role="img" aria-label="Gesamtfortschritt {overallProgress.pct}%">
        <circle class="track" cx="60" cy="60" r={R} />
        <circle
          class="fill"
          cx="60"
          cy="60"
          r={R}
          stroke-dasharray={CIRC}
          stroke-dashoffset={ringOffset}
        />
      </svg>
      <div class="ring-center">
        <span class="ring-pct">{overallProgress.pct}%</span>
        <span class="ring-sub">{fmt(overallProgress.done)} / {fmt(overallProgress.total)}</span>
      </div>
    </div>
  </section>

  <section class="panel">
    <h3>Fortschritt pro Reihe</h3>
    <div class="bars">
      {#each seriesRows as row (row.s.id)}
        <div
          class="barrow"
          title="{row.s.name}: {row.done}/{row.total} ({row.pct}%){row.dim ? ' – nicht erreichbar' : ''}"
        >
          <span class="barlabel">{row.dim ? '🔒 ' : ''}{row.s.name}</span>
          <div class="bartrack">
            <div class="barfill" class:dim={row.dim} style="width:{row.pct}%"></div>
          </div>
          <span class="barvalue">{row.pct}%</span>
        </div>
      {/each}
    </div>
  </section>

  <section class="panel">
    <h3>Verbrauchte Gegenstände</h3>
    <p class="stats">aus allen erledigten Quests</p>
    <div class="bars">
      {#each itemRows as row (row.item)}
        <div class="barrow" title="{row.item}: {fmt(row.amount)}">
          <span class="barlabel">{row.item}</span>
          <div class="bartrack">
            <div class="barfill item" style="width:{Math.round((row.amount / itemMax) * 100)}%"></div>
          </div>
          <span class="barvalue">{fmt(row.amount)}</span>
        </div>
      {/each}
      {#if itemRows.length === 0}
        <p class="empty">Noch nichts verbraucht. 🌱</p>
      {/if}
    </div>
    {#if hiddenItemCount > 0}
      <button class="more" onclick={() => (showAllItems = !showAllItems)}>
        {showAllItems ? 'Weniger anzeigen' : `+ ${hiddenItemCount} weitere anzeigen`}
      </button>
    {/if}
  </section>
</div>

<style>
  .charts {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: 1.4rem;
  }

  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.8rem;
  }
  .tile {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--panel);
    box-shadow: var(--shadow);
    padding: 0.9rem 1rem;
  }
  .tlabel {
    font-size: 0.78rem;
    color: var(--muted);
  }
  .tvalue {
    font-size: 1.5rem;
    font-weight: 650;
  }
  .tsub {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .panel {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--panel);
    box-shadow: var(--shadow);
    padding: 1rem 1.1rem;
  }
  .panel h3 {
    font-size: 1rem;
    margin-bottom: 0.6rem;
  }
  .stats {
    color: var(--muted);
    font-size: 0.85rem;
    margin: -0.3rem 0 0.7rem;
  }

  .ring-wrap {
    position: relative;
    width: 160px;
    height: 160px;
    margin: 0 auto;
  }
  .ring {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }
  .ring circle {
    fill: none;
    stroke-width: 12;
    stroke-linecap: round;
  }
  .ring .track {
    stroke: var(--panel-2);
  }
  .ring .fill {
    stroke: var(--accent);
    transition: stroke-dashoffset 0.3s ease;
  }
  .ring-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .ring-pct {
    font-size: 1.7rem;
    font-weight: 650;
  }
  .ring-sub {
    font-size: 0.78rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .bars {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .barrow {
    display: grid;
    grid-template-columns: 11rem 1fr 4.5rem;
    align-items: center;
    gap: 0.6rem;
  }
  .barlabel {
    font-size: 0.82rem;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bartrack {
    height: 14px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 999px;
    overflow: hidden;
  }
  .barfill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--accent), var(--accent-strong));
  }
  .barfill.dim {
    background: var(--muted);
    opacity: 0.55;
  }
  .barfill.item {
    background: linear-gradient(90deg, var(--accent), var(--accent-strong));
  }
  .barvalue {
    font-size: 0.82rem;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .empty {
    color: var(--muted);
    text-align: center;
    padding: 1.5rem;
  }
  .more {
    display: block;
    margin: 0.7rem auto 0;
    font-size: 0.82rem;
    color: var(--accent-strong);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.35rem 0.9rem;
  }
  .more:hover {
    border-color: var(--accent);
  }

  @media (max-width: 640px) {
    .barrow {
      grid-template-columns: 6.5rem 1fr 4rem;
    }
  }
</style>
