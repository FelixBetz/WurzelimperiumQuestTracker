<script>
  import { sidebar, doneCount, progress, isLocked } from '../data.js';
  import { settings } from '../store.js';

  let { selectedId, onselect } = $props();

  function levelLocked(s) {
    const lvl = $settings.level;
    return lvl != null && s.minLevel != null && s.minLevel > lvl;
  }

  function locked(s) {
    return isLocked(s) || levelLocked(s);
  }

  function lockTitle(s) {
    if (isLocked(s)) return 'Noch nicht freigeschaltet';
    if (levelLocked(s)) return `Level ${s.minLevel} nötig`;
    return '';
  }

  // Bei "Erledigte ausblenden" verschwinden auch komplett fertige Reihen
  // aus der Seitenleiste (nicht nur die einzelnen Quests in der Detailansicht).
  function isDone(s) {
    return doneCount(s, progress) >= s.quests.length;
  }
  function hide(s) {
    return $settings.hideCompleted && isDone(s);
  }
</script>

<nav class="side">
  {#each sidebar as node}
    {#if node.type === 'solo'}
      {#if !hide(node.series)}
        {@render row(node.series)}
      {/if}
    {:else}
      {@const visibleList = node.list.filter((s) => !hide(s))}
      {#if visibleList.length > 0}
        <div class="grouphead">{node.name}</div>
        {#each visibleList as s}
          {@render row(s, true)}
        {/each}
      {/if}
    {/if}
  {/each}
</nav>

{#snippet row(s, indent = false)}
  {@const done = doneCount(s, progress)}
  {@const total = s.quests.length}
  {@const pct = total ? Math.round((done / total) * 100) : 0}
  <button
    class="item"
    class:active={s.id === selectedId}
    class:indent
    class:locked={locked(s)}
    onclick={() => onselect(s.id)}
  >
    <span class="name">
      {#if locked(s)}<span class="lock" title={lockTitle(s)}>🔒</span>{/if}
      {s.name}
    </span>
    <span class="stat">{done}/{total}</span>
    <span class="mini"><span class="mini-fill" style="width:{pct}%"></span></span>
  </button>
{/snippet}

<style>
  .side {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 0.4rem;
  }
  .grouphead {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    font-weight: 700;
    padding: 0.7rem 0.6rem 0.25rem;
  }
  .item {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: 0.15rem 0.5rem;
    text-align: left;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 9px;
    padding: 0.45rem 0.6rem;
    width: 100%;
  }
  .item:hover {
    background: var(--panel-2);
    border-color: transparent;
  }
  .item.active {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
  .item.indent {
    margin-left: 0.6rem;
  }
  .item.locked .name {
    color: var(--muted);
  }
  .name {
    font-weight: 550;
    font-size: 0.92rem;
  }
  .lock {
    font-size: 0.8rem;
  }
  .stat {
    color: var(--muted);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    align-self: center;
  }
  .mini {
    grid-column: 1 / -1;
    height: 4px;
    background: var(--panel-2);
    border-radius: 999px;
    overflow: hidden;
  }
  .item.active .mini {
    background: #fff6;
  }
  .mini-fill {
    display: block;
    height: 100%;
    background: var(--accent);
  }
</style>
