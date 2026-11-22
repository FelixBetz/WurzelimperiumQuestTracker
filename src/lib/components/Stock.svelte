<script>
  import { stock, stockGroup } from '../data.js';
  import { fmt } from '../format.js';

  // Sortierung per Klick auf die Spaltenköpfe; zweiter Klick dreht die Richtung.
  let sortBy = $state('amount'); // 'name' | 'amount'
  let desc = $state(true);
  let hideZero = $state(true);
  let grouped = $state(true);
  let query = $state('');

  // Reihenfolge und Überschriften der Gruppen; 'tank' ist der Honig, der noch
  // im Bienengarten liegt und erst abgefüllt werden muss.
  const GROUPS = [
    ['garden', 'Garten'],
    ['water', 'Wassergarten'],
    ['herb', 'Kräutergarten'],
    ['honey', 'Honig im Regal'],
    ['tank', 'Honig im Bienengarten (nicht abgefüllt)'],
    ['other', 'Sonstiges'],
  ];

  const toRow = (group) => ([name, amount]) => ({ name, amount: Number(amount) || 0, group: group ?? stockGroup(name) });
  const all = Object.entries(stock.items).map(toRow());
  const tank = Object.entries(stock.honeyTank).map(toRow('tank'));
  const collator = new Intl.Collator('de', { sensitivity: 'base' });

  // Filtert und sortiert eine Liste; liest query, hideZero, sortBy und desc,
  // deshalb rechnen die $derived darunter bei jeder Änderung neu.
  function filterSort(list) {
    const q = query.trim().toLowerCase();
    const dir = desc ? -1 : 1;
    return list
      .filter((r) => (!hideZero || r.amount > 0) && (!q || r.name.toLowerCase().includes(q)))
      .sort((a, b) =>
        sortBy === 'name'
          ? dir * collator.compare(a.name, b.name)
          : dir * (a.amount - b.amount) || collator.compare(a.name, b.name),
      );
  }

  let rows = $derived(filterSort(all));
  let sections = $derived(
    grouped
      ? GROUPS.map(([key, label]) => ({
          key,
          label,
          rows: filterSort(key === 'tank' ? tank : all.filter((r) => r.group === key)),
        })).filter((s) => s.rows.length)
      : [{ key: 'all', label: null, rows }],
  );

  function sort(column) {
    if (sortBy === column) {
      desc = !desc;
    } else {
      sortBy = column;
      desc = column === 'amount'; // Menge zuerst absteigend, Name zuerst A bis Z
    }
  }

  function arrow(column) {
    if (sortBy !== column) return '';
    return desc ? ' ▼' : ' ▲';
  }

  const stand = stock.updatedAt ? new Date(stock.updatedAt).toLocaleString('de-DE') : null;
</script>

<div class="stock">
  <div class="controls">
    <input class="search" type="search" placeholder="Suchen …" bind:value={query} />
    <label class="chk">
      <input type="checkbox" bind:checked={hideZero} />
      Menge 0 ausblenden
    </label>
    <label class="chk">
      <input type="checkbox" bind:checked={grouped} />
      nach Gruppen
    </label>
  </div>

  <p class="stats">
    {rows.length} von {all.length} Gegenständen ·
    {#if stock.live}Live-Stand {stand}{:else if stand}eingebauter Stand {stand}{:else}eingebauter Stand (ohne Bestand){/if}
  </p>

  {#if sections.length === 0}
    <p class="empty">Kein Bestand gefunden.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th><button class="sort" class:on={sortBy === 'name'} onclick={() => sort('name')}>Gegenstand{arrow('name')}</button></th>
          <th class="num"><button class="sort" class:on={sortBy === 'amount'} onclick={() => sort('amount')}>Menge{arrow('amount')}</button></th>
        </tr>
      </thead>
      {#each sections as s (s.key)}
        <tbody>
          {#if s.label}
            <tr class="group">
              <th colspan="2">{s.label} <span class="count">{s.rows.length}</span></th>
            </tr>
          {/if}
          {#each s.rows as r (r.name)}
            <tr class:zero={r.amount === 0}>
              <td class="item">{r.name}</td>
              <td class="num big">{fmt(r.amount)}</td>
            </tr>
          {/each}
        </tbody>
      {/each}
    </table>
  {/if}
</div>

<style>
  .stock {
    max-width: 640px;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.6rem;
  }
  .search {
    flex: 1 1 200px;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--panel);
    color: var(--text);
    font: inherit;
  }
  .chk {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .chk input {
    accent-color: var(--accent);
  }
  .stats {
    color: var(--muted);
    font-size: 0.9rem;
    margin: 0.2rem 0 1rem;
  }
  .empty {
    color: var(--muted);
    padding: 2rem;
    text-align: center;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.92rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid var(--border);
  }
  th {
    position: sticky;
    top: 0;
    background: var(--bg);
  }
  th.num,
  td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .sort {
    border: none;
    background: none;
    padding: 0;
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 650;
    cursor: pointer;
  }
  .sort.on {
    color: var(--text);
  }
  td.item {
    font-weight: 600;
  }
  td.big {
    font-weight: 700;
    color: var(--accent-strong);
  }
  tr.group th {
    position: static;
    padding-top: 1.1rem;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text);
    background: none;
  }
  tr.group .count {
    margin-left: 0.3rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted);
  }
  tr.zero td {
    color: var(--muted);
    font-weight: 400;
  }
</style>
