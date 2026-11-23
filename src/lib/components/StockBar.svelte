<script>
  import { fmt } from "../format.js";
  import { stockTitle } from "../data.js";

  // r = Quest-Anforderung aus questShopCost (mit stock und needed).
  // Schon abgegebene Mengen (Bonsai, Park, Bienen) zählen wie im Spiel mit: abgegeben + Regal von Bedarf.
  let { r } = $props();
  let have = $derived(r.stock + (r.sent ?? 0));
  let pct = $derived(
    r.needed > 0 ? Math.min(100, (have / r.needed) * 100) : 100,
  );
  let enough = $derived(have >= r.needed);
  let pctLabel = $derived(
    enough ? "✓" : have > 0 && pct < 1 ? "<1 %" : `${Math.floor(pct)} %`,
  );
</script>

<span class="stock" class:enough class:partial={!enough && have > 0} title={stockTitle(r)}>
  <span class="bar"><span class="fill" style:width="{pct}%"></span></span>
  {#if r.sent}<span class="amount">📤 {fmt(r.sent)}</span>{/if}
  <span class="amount">📦 {fmt(r.stock)}</span>
  <span class="pct">{pctLabel}</span>
</span>

<style>
  .stock {
    flex: none;
    display: flex;
    align-items: baseline;
    gap: 0.3rem;
    font-size: 0.7rem;
    color: var(--muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  /* Dünne Linie am unteren Rand der Kachel (.req in Requirement.svelte). */
  .bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: var(--border);
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--muted);
  }
  .partial .fill {
    min-width: 0.3rem;
    background: var(--warn);
  }
  .enough .fill {
    background: var(--accent);
  }
  .pct {
    font-weight: 600;
  }
  .partial .pct {
    color: var(--warn);
  }
  .enough {
    color: var(--accent-strong);
    font-weight: 600;
  }
</style>
