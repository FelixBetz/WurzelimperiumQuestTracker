<script>
  import {
    series,
    currentQuest,
    doneCount,
    progress,
    isLocked,
    questShopCost,
  } from "../data.js";
  import { settings } from "../store.js";
  import { fmt, questLabel, rewardLabel, rewardIcon } from "../format.js";

  let { onselect } = $props();

  // Eine Zeile pro Reihe, die gerade erreichbar ist (nicht gesperrt, Level
  // passt) und noch offene Quests hat – jeweils die nächste anstehende Quest.
  let rows = $derived.by(() => {
    const lvl = $settings.level;
    const levelLocked = (s) =>
      lvl != null && s.minLevel != null && s.minLevel > lvl;
    const out = [];
    for (const s of series) {
      if (isLocked(s) || levelLocked(s)) continue;
      const q = currentQuest(s, progress);
      if (!q) continue;
      out.push({
        s,
        q,
        done: doneCount(s, progress),
        total: s.quests.length,
        shop: questShopCost(q),
      });
    }
    return out;
  });

  function itemCostTitle(r) {
    if (!r.hasPrice) return "";
    const base =
      r.mappedTo && r.mappedTo !== r.item
        ? `gemappt auf ${r.mappedTo}: ${fmt(r.unitPrice)} wT pro Stück`
        : `${fmt(r.unitPrice)} wT pro Stück`;
    if (r.pricingAmount != null && r.pricingAmount !== r.amount) {
      return `${base} · gerechnet mit ${fmt(r.pricingAmount)} Stück`;
    }
    return base;
  }
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
            <span class="sname"
              >{row.s.group ? `${row.s.group} · ` : ""}{row.s.name}</span
            >
            <span class="scount">{row.done}/{row.total}</span>
          </div>
          <div class="qline">
            <span class="nr">{questLabel(row.q.nr)}</span>
            <span class="reqs">
              {#each row.shop.requirements as r, i (r.item + i)}<span
                  class="req"
                  ><b>{fmt(r.amount)}</b>
                  {r.item}
                  {#if r.hasPrice}
                    <span
                      class="req-cost"
                      title={itemCostTitle(r)}
                      >({fmt(r.total)} wT)</span
                    >
                  {:else if !r.isCurrency && !r.isCraftOnly}
                    <span
                      class="req-cost missing"
                      title="Kein Shop-Preis gefunden">(?)</span
                    >
                  {/if}</span
                >{#if i < row.shop.requirements.length - 1}<span class="dot"
                    >·</span
                  >{/if}{/each}
            </span>
            <span class="rewards">
              {#if row.shop.shopItemCount > 0 || row.shop.currencyTotal > 0}
                <span
                  class="reward shop"
                  class:partial={row.shop.shopItemCount > 0 && row.shop.hasAnyPrice && !row.shop.complete}
                  class:missing={row.shop.shopItemCount > 0 && !row.shop.hasAnyPrice}
                  title={row.shop.shopItemCount === 0
                    ? "Währungsanforderung der Quest"
                    : row.shop.complete
                      ? "Shop-Kosten für alle benötigten Pflanzen"
                      : row.shop.missingItems.length
                        ? `Fehlende Preise: ${row.shop.missingItems.join(", ")}`
                        : "Keine Shop-Preise hinterlegt"}
                >
                  {#if row.shop.shopItemCount === 0}
                    🛒 {fmt(row.shop.currencyTotal)} wT
                  {:else if row.shop.hasAnyPrice}
                    🛒 {fmt(row.shop.total)} wT{#if !row.shop.complete}
                      (teilweise){/if}
                  {:else}
                    🛒 ?
                  {/if}
                </span>
              {/if}

              {#if row.q.rewards.length === 0}
                <span class="reward">–</span>
              {:else}
                {#each row.q.rewards as r, i (i)}
                  <span class="reward">{rewardIcon(r)} {rewardLabel(r)}</span>
                {/each}
              {/if}
            </span>
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
    gap: 0.2rem 0.45rem;
    min-width: 0;
  }
  .req b {
    font-variant-numeric: tabular-nums;
  }
  .req {
    display: inline-flex;
    align-items: baseline;
    gap: 0.2rem;
  }
  .req-cost {
    font-size: 0.66rem;
    color: var(--muted);
    white-space: nowrap;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 999px;
    line-height: 1.15;
    padding: 0.03rem 0.32rem;
    margin-left: 0.12rem;
  }
  .req-cost.missing {
    opacity: 0.85;
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
