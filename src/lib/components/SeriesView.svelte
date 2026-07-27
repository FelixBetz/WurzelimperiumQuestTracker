<script>
  import { settings } from '../store.js';
  import { progress, doneCount } from '../data.js';
  import QuestCard from './QuestCard.svelte';

  let { series } = $props();

  let total = $derived(series.quests.length);
  let count = $derived(doneCount(series, progress)); // erledigte Anzahl (read-only)
  let pct = $derived(total ? Math.round((count / total) * 100) : 0);

  let visible = $derived.by(() =>
    series.quests
      .map((q, i) => ({ q, i, done: i < count, current: i === count }))
      .filter((row) => !($settings.hideCompleted && row.done))
  );
</script>

<div class="wrap">
  <header class="head">
    <div class="titles">
      {#if series.group}<div class="group">{series.group}</div>{/if}
      <h2>{series.name}</h2>
    </div>

    <div class="meta">
      {#if series.minLevel}<span class="chip">ab Level {series.minLevel}{series.levelTitle ? ` · ${series.levelTitle}` : ''}</span>{/if}
      {#if series.location}<span class="chip">📍 {series.location}</span>{/if}
      {#if series.cooldownHours != null}<span class="chip">⏳ {series.cooldownHours === 0 ? 'kein Cooldown' : `${series.cooldownHours} h Cooldown`}</span>{/if}
      {#if series.premiumOnly}<span class="chip prem">★ Premium</span>{/if}
    </div>

    <div class="progress">
      <div class="bar"><div class="fill" style="width:{pct}%"></div></div>
      <span class="count">{count} / {total} erledigt ({pct}%)</span>
    </div>
  </header>

  <div class="list">
    {#each visible as row (row.q.id)}
      <QuestCard quest={row.q} done={row.done} current={row.current} />
    {/each}
    {#if visible.length === 0}
      <p class="empty">🎉 Alle Quests dieser Reihe erledigt!</p>
    {/if}
  </div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .head {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--bg);
    padding-bottom: 0.7rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0.9rem;
  }
  .group {
    font-size: 0.8rem;
    color: var(--muted);
    font-weight: 600;
  }
  h2 {
    font-size: 1.4rem;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }
  .chip {
    font-size: 0.78rem;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.12rem 0.55rem;
    color: var(--muted);
  }
  .chip.prem {
    color: var(--warn);
    border-color: var(--warn);
  }
  .progress {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    margin-top: 0.7rem;
  }
  .bar {
    flex: 1;
    height: 9px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 999px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-strong));
    transition: width 0.2s ease;
  }
  .count {
    font-size: 0.85rem;
    color: var(--muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .list {
    display: grid;
    gap: 0.4rem;
  }
  .empty {
    color: var(--muted);
    text-align: center;
    padding: 2rem;
  }
</style>
