<script>
  import { stock } from '../data.js';
  import { fmt } from '../format.js';

  // Sortierung per Klick auf die Spaltenköpfe; zweiter Klick dreht die Richtung.
  let sortBy = $state('amount'); // 'name' | 'amount'
  let desc = $state(true);
  let hideZero = $state(true);
  let query = $state('');

  const all = Object.entries(stock.items).map(([name, amount]) => ({ name, amount: Number(amount) || 0 }));
  const collator = new Intl.Collator('de', { sensitivity: 'base' });

  let rows = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const list = all.filter((r) => (!hideZero || r.amount > 0) && (!q || r.name.toLowerCase().includes(q)));
    const dir = desc ? -1 : 1;
    return list.sort((a, b) =>
      sortBy === 'name'
        ? dir * collator.compare(a.name, b.name)
        : dir * (a.amount - b.amount) || collator.compare(a.name, b.name),
    );
  });

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
  </div>

  <p class="stats">
    {rows.length} von {all.length} Gegenständen ·
    {#if stock.live}Live-Stand {stand}{:else if stand}eingebauter Stand {stand}{:else}eingebauter Stand (ohne Bestand){/if}
  </p>

  {#if rows.length === 0}
    <p class="empty">Kein Bestand gefunden.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th><button class="sort" class:on={sortBy === 'name'} onclick={() => sort('name')}>Gegenstand{arrow('name')}</button></th>
          <th class="num"><button class="sort" class:on={sortBy === 'amount'} onclick={() => sort('amount')}>Menge{arrow('amount')}</button></th>
        </tr>
      </thead>
      <tbody>
        {#each rows as r (r.name)}
          <tr class:zero={r.amount === 0}>
            <td class="item">{r.name}</td>
            <td class="num big">{fmt(r.amount)}</td>
          </tr>
        {/each}
      </tbody>
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
  tr.zero td {
    color: var(--muted);
    font-weight: 400;
  }
</style>
