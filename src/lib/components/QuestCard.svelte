<script>
  import { fmt, questLabel, rewardLabel, rewardIcon } from '../format.js';

  // Reine Anzeige: done = erledigt, current = erste offene Quest der Reihe.
  let { quest, done = false, current = false } = $props();
</script>

<article class="card" class:done class:current={current && !done}>
  <div class="row">
    <span class="mark" class:on={done}>{done ? '✓' : ''}</span>
    <span class="nr">{questLabel(quest.nr)}</span>

    {#if current && !done}<span class="badge">aktuell</span>{/if}

    <span class="reqs">
      {#each quest.requirements as r, i (r.item + i)}<span class="req"
          ><b>{fmt(r.amount)}</b> {r.item}</span
        >{#if i < quest.requirements.length - 1}<span class="dot">·</span>{/if}{/each}
    </span>

    <span class="rewards">
      {#if quest.rewards.length === 0}
        <span class="reward">–</span>
      {:else}
        {#each quest.rewards as r, i (i)}
          <span class="reward">{rewardIcon(r)} {rewardLabel(r)}</span>
        {/each}
      {/if}
    </span>
  </div>
</article>

<style>
  .card {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--panel);
    box-shadow: var(--shadow);
  }
  .card.current {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft), var(--shadow);
  }
  .card.done {
    opacity: 0.6;
    background: var(--panel-2);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.75rem;
    flex-wrap: wrap;
  }
  .mark {
    width: 1.2rem;
    height: 1.2rem;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: 5px;
    font-size: 0.85rem;
    color: #fff;
  }
  .mark.on {
    background: var(--accent);
    border-color: var(--accent);
  }
  .nr {
    font-weight: 650;
    flex: none;
    min-width: 4.7rem;
  }
  .card.done .nr {
    text-decoration: line-through;
    text-decoration-color: var(--muted);
  }
  .badge {
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
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
  .rewards {
    margin-left: auto;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.3rem 0.6rem;
    flex: none;
  }
  .reward {
    color: var(--muted);
    font-size: 0.85rem;
    white-space: nowrap;
  }
</style>
