<script>
  // Eine Linie über die Zeit, eine Achse. points: [{ date: 'JJJJ-MM-TT', value }]; format: Zahl -> Text.
  // Hover: Fadenkreuz mit Punkt und Tooltip am nächsten Tag.
  let { points, title, format } = $props();

  // Etwa die gezeichnete Breite, damit die Schrift im SVG ungefähr in Originalgröße erscheint.
  const W = 800;
  const H = 160;
  const PAD = { top: 12, right: 14, bottom: 24, left: 64 };

  let hover = $state(null);

  let geom = $derived.by(() => {
    const xs = points.map((p) => new Date(p.date).getTime());
    const ys = points.map((p) => p.value);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    let y0 = Math.min(...ys);
    let y1 = Math.max(...ys);
    if (y0 === y1) {
      y0 -= 1;
      y1 += 1;
    }
    const pad = (y1 - y0) * 0.08;
    y0 -= pad;
    y1 += pad;
    const sx = (x) => PAD.left + ((x - x0) / (x1 - x0 || 1)) * (W - PAD.left - PAD.right);
    const sy = (y) => PAD.top + (1 - (y - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom);
    const pts = points.map((p, i) => ({ ...p, px: sx(xs[i]), py: sy(p.value) }));
    const ticks = [0, 0.5, 1].map((t) => y0 + pad + t * (y1 - y0 - 2 * pad));
    return { pts, ticks: ticks.map((v) => ({ v, py: sy(v) })), line: pts.map((p) => `${p.px},${p.py}`).join(' ') };
  });

  function onMove(event) {
    const svg = event.currentTarget;
    const x = ((event.clientX - svg.getBoundingClientRect().left) / svg.clientWidth) * W;
    let best = geom.pts[0];
    for (const p of geom.pts) if (Math.abs(p.px - x) < Math.abs(best.px - x)) best = p;
    hover = best;
  }

  const day = (d) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
</script>

<figure class="chart">
  <figcaption>{title}</figcaption>
  <div class="wrap">
    <svg
      viewBox="0 0 {W} {H}"
      role="img"
      aria-label="{title}: {points.length} Tage"
      onmousemove={onMove}
      onmouseleave={() => (hover = null)}
    >
      {#each geom.ticks as t (t.v)}
        <line class="grid" x1={PAD.left} x2={W - PAD.right} y1={t.py} y2={t.py} />
        <text class="ylabel" x={PAD.left - 8} y={t.py} dy="0.32em">{format(t.v)}</text>
      {/each}
      <text class="xlabel" x={PAD.left} y={H - 6}>{day(points[0].date)}</text>
      <text class="xlabel end" x={W - PAD.right} y={H - 6}>{day(points.at(-1).date)}</text>
      <polyline class="line" points={geom.line} />
      {#if hover}
        <line class="cross" x1={hover.px} x2={hover.px} y1={PAD.top} y2={H - PAD.bottom} />
        <circle class="dot" cx={hover.px} cy={hover.py} r="4.5" />
      {:else}
        {@const last = geom.pts.at(-1)}
        <circle class="dot" cx={last.px} cy={last.py} r="4" />
      {/if}
      <!-- großes, unsichtbares Ziel für die Maus -->
      <rect x={PAD.left} y="0" width={W - PAD.left - PAD.right} height={H} fill="transparent" />
    </svg>
    {#if hover}
      <div class="tip" style:left="{(hover.px / W) * 100}%">
        <span class="tdate">{new Date(hover.date).toLocaleDateString('de-DE')}</span>
        <span class="tval">{format(hover.value)}</span>
      </div>
    {/if}
  </div>
</figure>

<style>
  .chart {
    margin: 0;
  }
  figcaption {
    font-size: 0.85rem;
    font-weight: 650;
    margin-bottom: 0.3rem;
  }
  .wrap {
    position: relative;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }
  .grid {
    stroke: var(--border);
    stroke-width: 1;
  }
  .ylabel,
  .xlabel {
    fill: var(--muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .ylabel {
    text-anchor: end;
  }
  .xlabel.end {
    text-anchor: end;
  }
  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .cross {
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .dot {
    fill: var(--accent);
    stroke: var(--panel);
    stroke-width: 2;
  }
  .tip {
    position: absolute;
    top: 0;
    transform: translate(-50%, -110%);
    pointer-events: none;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow);
    padding: 0.25rem 0.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    white-space: nowrap;
    font-size: 0.78rem;
  }
  .tdate {
    color: var(--muted);
  }
  .tval {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
</style>
