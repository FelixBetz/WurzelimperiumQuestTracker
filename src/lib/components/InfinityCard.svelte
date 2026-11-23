<script>
  import { infinity, account } from "../data.js";
  import { fmt, fmtUntil, fmtClock } from "../format.js";
  import QuestCard from "./QuestCard.svelte";

  // Infinity-Quest aus dem Live-Stand: Fortschritt bis Quest 500, Stand der aktuellen Quest.
  // Der Bot kauft, was fehlt, und gibt alles ab, sobald sie offen ist und der Kontostand über der Grenze liegt.
  let now = $state(Date.now());
  $effect(() => {
    const t = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(t);
  });

  let pct = $derived(infinity ? Math.round((infinity.done / infinity.max) * 100) : 0);
  let cooling = $derived(infinity?.readyAt != null && new Date(infinity.readyAt).getTime() > now);
  let poor = $derived(infinity?.limit != null && account?.money != null && account.money < infinity.limit);
  let finished = $derived(infinity != null && infinity.done >= infinity.max);
</script>

{#if infinity}
  <section class="inf">
    <div class="head">
      <span class="name">♾ Infinity-Quest</span>
      <span class="state" class:wait={cooling} class:warn={!cooling && poor}>
        {#if finished}
          alle {infinity.max} erledigt
        {:else if cooling}
          ⏳ wieder offen {fmtUntil(infinity.readyAt, now)} ({fmtClock(infinity.readyAt)})
        {:else if poor}
          offen · wartet: Kontostand unter {fmt(infinity.limit)} wT
        {:else}
          offen · der Bot gibt sie beim nächsten Lauf ab
        {/if}
      </span>
      <span class="count">{infinity.done}/{infinity.max}</span>
    </div>
    <div class="bar" title="{infinity.done} von {infinity.max} Quests erledigt ({pct}%)">
      <div class="fill" style="width:{pct}%"></div>
    </div>
    {#if !finished}
      <QuestCard quest={infinity.quest} current={!cooling} />
    {/if}
  </section>
{/if}

<style>
  .inf {
    display: grid;
    gap: 0.4rem;
    margin-bottom: 1rem;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .name {
    font-weight: 650;
    font-size: 0.95rem;
  }
  .state {
    color: var(--accent-strong);
    font-size: 0.85rem;
  }
  .state.wait {
    color: var(--muted);
  }
  .state.warn {
    color: var(--warn);
  }
  .count {
    margin-left: auto;
    color: var(--muted);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }
  .bar {
    height: 6px;
    border-radius: 999px;
    background: var(--panel-2);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    border-radius: 999px;
  }
</style>
