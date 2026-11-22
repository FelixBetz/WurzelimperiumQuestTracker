<script>
  import { fmt } from "../format.js";
  import StockBar from "./StockBar.svelte";

  // Ein Quest-Gegenstand als Kachel. Bestand nur bei offenen Quests anzeigen.
  let { r, showStock = true } = $props();

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

<span class="req" class:ready={showStock && r.stock != null && r.stock >= r.needed}>
  <span
    class="name"
    title={r.hasPrice ? `${fmt(r.total)} wT · ${itemCostTitle(r)}` : ""}
    ><b>{fmt(r.amount)}</b> {r.item}</span
  >
  {#if !r.hasPrice && !r.isCurrency && !r.isCraftOnly}
    <span class="cost" title="Kein Shop-Preis gefunden">?</span>
  {/if}
  {#if showStock && r.stock != null}<StockBar {r} />{/if}
</span>

<style>
  .req {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    min-width: 0;
    padding: 0.14rem 0.45rem 0.2rem;
    border-radius: 6px;
    background: var(--panel-2);
    font-size: 0.84rem;
    overflow: hidden;
  }
  .req.ready {
    background: var(--accent-soft);
  }
  .name {
    flex: 1;
    min-width: 0;
  }
  .name b {
    font-variant-numeric: tabular-nums;
  }
  .cost {
    flex: none;
    font-size: 0.68rem;
    color: var(--muted);
    white-space: nowrap;
  }
</style>
