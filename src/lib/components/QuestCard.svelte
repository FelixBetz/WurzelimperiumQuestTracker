<script>
  import { fmt, questLabel, rewardLabel, rewardIcon } from "../format.js";
  import { questShopCost } from "../data.js";
  import Requirement from "./Requirement.svelte";

  // Reine Anzeige: done = erledigt, current = erste offene Quest der Reihe.
  let { quest, done = false, current = false } = $props();
  let shop = $derived(questShopCost(quest));
</script>

<article class="card" class:done class:current={current && !done}>
  <div class="row">
    <span class="mark" class:on={done}>{done ? "✓" : ""}</span>
    <span class="nr">{questLabel(quest.nr)}</span>

    {#if current && !done}<span class="badge">aktuell</span>{/if}

    <span class="reqs">
      {#each shop.requirements as r, i (r.item + i)}
        <Requirement {r} showStock={!done} />
      {/each}
    </span>

    <span class="rewards">
      {#if shop.shopItemCount > 0 || shop.currencyTotal > 0}
        <span
          class="reward shop"
          class:partial={shop.shopItemCount > 0 && shop.hasAnyPrice && !shop.complete}
          class:missing={shop.shopItemCount > 0 && !shop.hasAnyPrice}
          title={shop.shopItemCount === 0
            ? "Währungsanforderung der Quest"
            : shop.complete
              ? "Shop-Kosten für alle benötigten Pflanzen"
              : shop.missingItems.length
                ? `Fehlende Preise: ${shop.missingItems.join(", ")}`
                : "Keine Shop-Preise hinterlegt"}
        >
          {#if shop.shopItemCount === 0}
            🛒 {fmt(shop.currencyTotal)} wT
          {:else if shop.hasAnyPrice}
            🛒 {fmt(shop.total)} wT{#if !shop.complete}
              (teilweise){/if}
          {:else}
            🛒 ?
          {/if}
        </span>
      {/if}

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
    box-shadow:
      0 0 0 2px var(--accent-soft),
      var(--shadow);
  }
  .card.done {
    opacity: 0.6;
    background: var(--panel-2);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.25rem 0.6rem;
    padding: 0.3rem 0.6rem;
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
    flex: 1 1 16rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(13.5rem, 100%), 1fr));
    gap: 0.25rem;
    min-width: 0;
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
  .reward.shop {
    color: var(--text);
    font-weight: 600;
  }
  .reward.shop.partial,
  .reward.shop.missing {
    color: var(--muted);
    font-weight: 500;
  }
</style>
