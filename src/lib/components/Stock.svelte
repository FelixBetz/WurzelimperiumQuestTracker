<script>
  import {
    stock,
    stockGroup,
    stockDemand,
    stockUnitPrice,
    series,
    progress,
    currentQuest,
    openQuests,
    isLocked,
    harvestAt,
    growing,
    account,
  } from '../data.js';
  import { settings } from '../store.js';
  import { fmt, fmtCompact, fmtUntil, fmtClock } from '../format.js';

  // Uhr für die Ernte-Countdowns
  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });
  const harvestList = Object.entries(harvestAt).sort((a, b) => a[1].localeCompare(b[1]));

  // Karten je Gruppe; 'tank' ist der Honig, der noch im Bienengarten liegt und
  // erst abgefüllt werden muss (für Quests zählt nur das Regal).
  const GROUPS = [
    { key: 'garden', label: 'Garten', icon: '🌱' },
    { key: 'water', label: 'Wassergarten', icon: '💧' },
    { key: 'herb', label: 'Kräutergarten', icon: '🌿' },
    { key: 'honey', label: 'Honig im Regal', icon: '🍯' },
    { key: 'tank', label: 'Bienengarten, nicht abgefüllt', icon: '🐝' },
    { key: 'other', label: 'Sonstiges', icon: '📦' },
  ];

  let sortBy = $state('amount'); // 'name' | 'amount' | 'missing'
  let scope = $state('current'); // Bedarf aus 'current' = aktueller Quest je Reihe, 'open' = allen offenen
  let hideEmpty = $state(true);
  let onlyNeeded = $state(false);
  let query = $state('');
  let collapsed = $state({});

  const toRow = (group) => ([name, amount]) => ({ name, amount: Number(amount) || 0, group: group ?? stockGroup(name) });
  const shelf = Object.entries(stock.items).map(toRow());
  const tank = Object.entries(stock.honeyTank).map(toRow('tank'));
  const collator = new Intl.Collator('de', { sensitivity: 'base' });

  // Quests wie bei den Empfehlungen: nur Reihen, die freigeschaltet und mit dem Level erreichbar sind.
  let demand = $derived.by(() => {
    const lvl = $settings.level;
    const quests = [];
    for (const s of series) {
      if (isLocked(s) || (lvl != null && s.minLevel != null && s.minLevel > lvl)) continue;
      if (scope === 'current') {
        const q = currentQuest(s, progress);
        if (q) quests.push(q);
      } else {
        quests.push(...openQuests(s, progress));
      }
    }
    return stockDemand(quests);
  });

  // status: 'ok' reicht, 'partial' reicht teilweise, 'none' nichts da, null kein Bedarf
  function withDemand(r) {
    const d = r.group === 'tank' ? null : demand.get(r.name);
    const needed = d?.needed ?? 0;
    const missing = Math.max(0, needed - r.amount);
    const status = needed === 0 ? null : missing === 0 ? 'ok' : r.amount > 0 ? 'partial' : 'none';
    return { ...r, needed, quests: d?.quests ?? 0, missing, status };
  }

  function compare(a, b) {
    if (sortBy === 'name') return collator.compare(a.name, b.name);
    if (sortBy === 'missing') return b.missing - a.missing || b.needed - a.needed || collator.compare(a.name, b.name);
    return b.amount - a.amount || collator.compare(a.name, b.name);
  }

  let rows = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return [...shelf, ...tank]
      .map(withDemand)
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .filter((r) => !onlyNeeded || r.needed > 0)
      .filter((r) => !hideEmpty || r.amount > 0 || r.needed > 0)
      .sort(compare);
  });

  let cards = $derived(
    GROUPS.map((g) => {
      const list = rows.filter((r) => r.group === g.key);
      const max = Math.max(1, ...list.map((r) => r.amount));
      return { ...g, rows: list, max };
    }).filter((c) => c.rows.length),
  );

  // Zusammenfassung über das ganze Regal (ohne Suche), damit sie sich beim Filtern nicht ändert.
  let summary = $derived.by(() => {
    const out = { ok: 0, partial: 0, none: 0 };
    for (const r of shelf.map(withDemand)) if (r.status) out[r.status] += 1;
    return out;
  });

  // Was das Fehlende im Shop kosten würde; Gegenstände ohne Shop-Preis (z. B. Honig) zählen extra.
  let cost = $derived.by(() => {
    let total = 0;
    let unpriced = 0;
    for (const r of shelf.map(withDemand)) {
      if (!r.missing) continue;
      const price = stockUnitPrice(r.name);
      if (price == null) unpriced += 1;
      else total += price * r.missing;
    }
    return { total, unpriced };
  });
  let affordable = $derived(account?.money != null && account.money >= cost.total);

  // Logarithmisch, damit 17 Äpfel neben 428.100 Salat noch sichtbar sind.
  function barWidth(amount, max) {
    return amount > 0 ? Math.max(3, (Math.log10(amount + 1) / Math.log10(max + 1)) * 100) : 0;
  }

  function statusTitle(r) {
    const q = r.quests === 1 ? '1 Quest' : `${r.quests} Quests`;
    if (r.status === 'ok') return `Reicht für ${q} (${fmt(r.needed)} gebraucht)`;
    return `Für ${q} fehlen ${fmt(r.missing)} von ${fmt(r.needed)}`;
  }

  function toggle(key) {
    collapsed = { ...collapsed, [key]: !collapsed[key] };
  }

  const stand = stock.updatedAt ? new Date(stock.updatedAt).toLocaleString('de-DE') : null;
</script>

<div class="stock">
  <div class="controls">
    <input class="search" type="search" placeholder="Suchen …" bind:value={query} />
    <div class="seg" title="Sortierung in jeder Karte">
      <button class:on={sortBy === 'amount'} onclick={() => (sortBy = 'amount')}>Menge</button>
      <button class:on={sortBy === 'name'} onclick={() => (sortBy = 'name')}>Name</button>
      <button class:on={sortBy === 'missing'} onclick={() => (sortBy = 'missing')}>Fehlt</button>
    </div>
    <div class="seg" title="Welche Quests als Bedarf zählen">
      <button class:on={scope === 'current'} onclick={() => (scope = 'current')}>Aktuelle Quests</button>
      <button class:on={scope === 'open'} onclick={() => (scope = 'open')}>Alle offenen</button>
    </div>
  </div>
  <div class="controls">
    <label class="chk"><input type="checkbox" bind:checked={onlyNeeded} /> nur mit Quest-Bedarf</label>
    <label class="chk"><input type="checkbox" bind:checked={hideEmpty} /> leere ohne Bedarf ausblenden</label>
  </div>

  <p class="stats">
    <span class="pill ok">✓ {summary.ok} reichen</span>
    <span class="pill partial">◐ {summary.partial} teilweise</span>
    <span class="pill none">✗ {summary.none} fehlen</span>
    {#if cost.total > 0}
      <span
        class="pill cost"
        class:ok={affordable}
        title="Shop-Preis der fehlenden Mengen{cost.unpriced ? `; ${cost.unpriced} Gegenstände ohne Shop-Preis nicht mitgerechnet` : ''}{account?.money != null ? `\nKontostand: ${fmt(Math.round(account.money))} wT` : ''}"
      >
        🛒 Fehlendes ≈ {fmtCompact(cost.total)} wT{account?.money != null ? ` · Konto ${fmtCompact(account.money)} wT` : ''}
      </span>
    {/if}
    <span class="stand">
      {#if stock.live}Live-Stand {stand}{:else if stand}eingebauter Stand {stand}{:else}eingebauter Stand (ohne Bestand){/if}
    </span>
  </p>

  {#if cards.length === 0}
    <p class="empty">Nichts gefunden.</p>
  {:else}
    <div class="grid">
      {#if harvestList.length && !query && !onlyNeeded}
        <section class="card">
          <button class="head" onclick={() => toggle('growing')} aria-expanded={!collapsed.growing}>
            <span class="icon">🌾</span>
            <span class="label">Wächst gerade</span>
            <span class="count">{harvestList.length}</span>
            <span class="chev">{collapsed.growing ? '▸' : '▾'}</span>
          </button>
          {#if !collapsed.growing}
            <ul>
              {#each harvestList as [name, at] (name)}
                <li class="grow">
                  <span class="name">{name}</span>
                  <span class="amount">{fmt(growing?.[name] ?? 0)}</span>
                  <span class="need" class:ok={fmtUntil(at, now) === 'fertig'} title="Erntereif um {fmtClock(at)}">
                    {fmtUntil(at, now)}
                  </span>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/if}
      {#each cards as c (c.key)}
        <section class="card">
          <button class="head" onclick={() => toggle(c.key)} aria-expanded={!collapsed[c.key]}>
            <span class="icon">{c.icon}</span>
            <span class="label">{c.label}</span>
            <span class="count">{c.rows.length}</span>
            <span class="chev">{collapsed[c.key] ? '▸' : '▾'}</span>
          </button>
          {#if !collapsed[c.key]}
            <ul>
              {#each c.rows as r (r.name)}
                <li class:empty-row={r.amount === 0}>
                  <span class="name">{r.name}</span>
                  <span class="bar"><span class="fill" style:width="{barWidth(r.amount, c.max)}%"></span></span>
                  <span class="amount">{fmt(r.amount)}</span>
                  {#if r.status}
                    <span class="need {r.status}" title={statusTitle(r)}>
                      {#if r.status === 'ok'}✓ {fmt(r.needed)}{:else}−{fmt(r.missing)}{/if}
                    </span>
                  {:else}
                    <span class="need"></span>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/each}
    </div>
  {/if}
</div>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1rem;
    margin-bottom: 0.6rem;
  }
  .search {
    flex: 1 1 200px;
    max-width: 320px;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--panel);
    color: var(--text);
    font: inherit;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 9px;
    overflow: hidden;
  }
  .seg button {
    border: none;
    border-radius: 0;
    background: var(--panel);
    padding: 0.35rem 0.75rem;
    font-size: 0.85rem;
  }
  .seg button.on {
    background: var(--accent);
    color: #fff;
  }
  .chk {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--muted);
    font-size: 0.88rem;
  }
  .chk input {
    accent-color: var(--accent);
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin: 0.4rem 0 1rem;
    font-size: 0.85rem;
  }
  .pill {
    border-radius: 999px;
    padding: 0.1rem 0.6rem;
    font-weight: 600;
    border: 1px solid currentColor;
  }
  .stand {
    color: var(--muted);
    margin-left: 0.4rem;
  }
  .empty {
    color: var(--muted);
    padding: 2rem;
    text-align: center;
  }

  /* Spalten statt Grid: kurze Karten rutschen unter andere kurze, statt neben der langen Garten-Karte Platz zu lassen. */
  .grid {
    columns: 320px;
    column-gap: 1rem;
  }
  .card {
    break-inside: avoid;
    margin-bottom: 1rem;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.7rem 0.9rem;
    border: none;
    border-radius: 0;
    background: var(--panel-2);
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }
  .icon {
    font-size: 1.15rem;
  }
  .label {
    font-weight: 700;
  }
  .count {
    font-size: 0.75rem;
    color: var(--muted);
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0 0.45rem;
  }
  .chev {
    margin-left: auto;
    color: var(--muted);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0.3rem 0;
  }
  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 70px 78px 84px;
    align-items: center;
    gap: 0.5rem;
    padding: 0.32rem 0.9rem;
    font-size: 0.9rem;
  }
  li.grow {
    grid-template-columns: minmax(0, 1fr) 78px 110px;
  }
  .pill.cost {
    color: var(--warn);
  }
  .pill.cost.ok {
    color: var(--accent-strong);
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bar {
    height: 6px;
    background: var(--panel-2);
    border-radius: 999px;
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-strong));
  }
  .amount {
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--accent-strong);
  }
  li.empty-row .name,
  li.empty-row .amount {
    color: var(--muted);
    font-weight: 400;
  }
  .need {
    text-align: right;
    font-size: 0.78rem;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .need.ok,
  .pill.ok {
    color: var(--accent-strong);
  }
  .need.partial,
  .pill.partial {
    color: var(--warn);
  }
  .need.none,
  .pill.none {
    color: var(--danger);
  }

  @media (max-width: 520px) {
    li {
      grid-template-columns: minmax(0, 1fr) 50px 70px 74px;
      padding: 0.32rem 0.6rem;
    }
  }
</style>
