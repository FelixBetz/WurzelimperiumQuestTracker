<script>
  import { loadSibling, series as allSeries, progress } from '../data.js';
  import { fmt, fmtCompact } from '../format.js';
  import LineChart from './LineChart.svelte';

  // history.json vom Bot: ein Eintrag pro Tag (der letzte Lauf des Tages zählt).
  let days = $state(null);
  let error = $state(null);

  loadSibling('history.json')
    .then((h) => (days = h?.days ?? []))
    .catch((err) => (error = String(err)));

  // Erledigte Quests wie in der Kopfzeile: Reihen, die der Bot liest, aus dem jeweiligen Tag,
  // die übrigen (z. B. Erholungsgarten) aus progress.json.
  function questsDone(day) {
    return allSeries.reduce(
      (sum, s) => sum + Math.min(s.quests.length, Math.max(0, day.series?.[s.id] ?? progress[s.id] ?? 0)),
      0,
    );
  }

  // Drei Kennzahlen mit eigener Achse statt einer Grafik mit zwei Skalen.
  const METRICS = [
    { title: 'Quests erledigt', value: questsDone, format: (v) => fmt(Math.round(v)) },
    { title: 'Wurzeltaler', value: (d) => d.money, format: (v) => fmtCompact(v) },
    { title: 'Punkte', value: (d) => d.points, format: (v) => fmtCompact(v) },
  ];

  const points = (metric) =>
    (days ?? []).filter((d) => metric.value(d) != null).map((d) => ({ date: d.date, value: metric.value(d) }));
</script>

<section class="panel">
  <h3>Verlauf</h3>
  {#if error}
    <p class="note">Verlauf nicht erreichbar ({error}).</p>
  {:else if days === null}
    <p class="note">Lade …</p>
  {:else if days.length < 2}
    <p class="note">
      Der Verlauf beginnt {days.length ? `am ${new Date(days[0].date).toLocaleDateString('de-DE')}` : 'mit dem nächsten Lauf'};
      ab dem zweiten Tag erscheinen hier Linien.
    </p>
  {:else}
    <div class="grid">
      {#each METRICS as m (m.title)}
        {#if points(m).length >= 2}
          <LineChart points={points(m)} title={m.title} format={m.format} />
        {/if}
      {/each}
    </div>
    <details>
      <summary>Als Tabelle</summary>
      <table>
        <thead>
          <tr><th>Tag</th><th class="num">Quests</th><th class="num">Wurzeltaler</th><th class="num">Punkte</th><th class="num">Level</th></tr>
        </thead>
        <tbody>
          {#each [...days].reverse() as d (d.date)}
            <tr>
              <td>{new Date(d.date).toLocaleDateString('de-DE')}</td>
              <td class="num">{fmt(questsDone(d))}</td>
              <td class="num">{fmt(Math.round(d.money ?? 0))}</td>
              <td class="num">{fmt(d.points ?? 0)}</td>
              <td class="num">{d.level ?? ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </details>
  {/if}
</section>

<style>
  .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 1rem 1.1rem;
  }
  h3 {
    font-size: 1rem;
    margin-bottom: 0.8rem;
  }
  .note {
    color: var(--muted);
    font-size: 0.9rem;
  }
  /* untereinander: in Spalten würde die SVG-Schrift zu klein */
  .grid {
    display: grid;
    gap: 1.2rem;
  }
  details {
    margin-top: 1rem;
    font-size: 0.85rem;
  }
  summary {
    cursor: pointer;
    color: var(--muted);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0.5rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.3rem 0.5rem;
    border-bottom: 1px solid var(--border);
  }
  th {
    color: var(--muted);
    font-weight: 650;
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
