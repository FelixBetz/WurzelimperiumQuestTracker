<script>
  import { series, currentQuest, doneCount, progress, isLocked } from '../data.js';
  import { settings } from '../store.js';
  import { fmt, questLabel } from '../format.js';

  let { onselect } = $props();

  // Eine Zeile pro Reihe, die gerade erreichbar ist (nicht gesperrt, Level
  // passt) und noch offene Quests hat – jeweils die nächste anstehende Quest.
  let rows = $derived.by(() => {
    const lvl = $settings.level;
    const levelLocked = (s) => lvl != null && s.minLevel != null && s.minLevel > lvl;
    const out = [];
    for (const s of series) {
      if (isLocked(s) || levelLocked(s)) continue;
      const q = currentQuest(s, progress);
      if (!q) continue;
      out.push({ s, q, done: doneCount(s, progress), total: s.quests.length });
    }
    return out;
  });
</script>

<div class="next">
  <p class="stats">{rows.length} Reihen</p>

  {#if rows.length === 0}
    <p class="empty">Keine erreichbaren offenen Reihen. 🎉</p>
  {:else}
    <div class="list">
      {#each rows as row (row.s.id)}
        <button class="row" onclick={() => onselect?.(row.s.id)}>
          <div class="rowhead">
            <span class="sname">{row.s.group ? `${row.s.group} · ` : ''}{row.s.name}</span>
            <span class="scount">{row.done}/{row.total}</span>
          </div>
          <div class="qline">
            <span class="nr">{questLabel(row.q.nr)}</span>
            <span class="reqs">
              {#each row.q.requirements as r, i (r.item + i)}<span class="req"
                  ><b>{fmt(r.amount)}</b> {r.item}</span
                >{#if i < row.q.requirements.length - 1}<span class="dot">·</span>{/if}{/each}
            </span>
            <span class="reward">🎁 {row.q.rewardText || '–'}</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .next {
    max-width: 900px;
  }
  .stats {
    color: var(--muted);
    font-size: 0.9rem;
    margin: 0 0 1rem;
  }
  .empty {
    color: var(--muted);
    padding: 2rem;
    text-align: center;
  }
  .list {
    display: grid;
    gap: 0.5rem;
  }
  .row {
    display: block;
    width: 100%;
    text-align: left;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--panel);
    box-shadow: var(--shadow);
    padding: 0.6rem 0.8rem;
  }
  .row:hover {
    border-color: var(--accent);
  }
  .rowhead {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
  }
  .sname {
    font-weight: 650;
    font-size: 0.95rem;
  }
  .scount {
    color: var(--muted);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .qline {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin-top: 0.35rem;
  }
  .nr {
    font-weight: 600;
    color: var(--accent-strong);
    flex: none;
  }
  .reqs {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.3rem 0.5rem;
    min-width: 0;
  }
  .req b {
    font-variant-numeric: tabular-nums;
  }
  .dot {
    color: var(--muted);
  }
  .reward {
    margin-left: auto;
    color: var(--muted);
    font-size: 0.85rem;
    white-space: nowrap;
  }
</style>
