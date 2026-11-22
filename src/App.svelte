<script>
  import {
    series,
    seriesById,
    meta,
    overallProgress,
    live,
    growing,
    botHealth,
    account,
    harvestAt,
    boosters,
    boosterState,
  } from './lib/data.js';
  import { fmtDuration, fmtDurationShort, fmtShort, fmtUntil, fmt, fmtClock } from './lib/format.js';
  import { settings } from './lib/store.js';
  import Sidebar from './lib/components/Sidebar.svelte';
  import SeriesView from './lib/components/SeriesView.svelte';
  import Recommendations from './lib/components/Recommendations.svelte';
  import NextQuests from './lib/components/NextQuests.svelte';
  import Charts from './lib/components/Charts.svelte';
  import Stock from './lib/components/Stock.svelte';
  import Log from './lib/components/Log.svelte';

  // Ansicht und Reihe stehen im Hash der URL (#/bestand, #/reihen/bonsai), damit
  // jeder Tab einen Link hat und Zurück/Vor im Browser funktioniert. Hash statt
  // Pfad, weil GitHub Pages unbekannte Pfade nicht auf index.html umleitet.
  const VIEWS = {
    reihen: 'series',
    naechste: 'next',
    empfehlungen: 'reco',
    bestand: 'stock',
    protokoll: 'log',
    charts: 'charts',
  };
  const SLUGS = Object.fromEntries(Object.entries(VIEWS).map(([slug, v]) => [v, slug]));

  function parseHash(hash) {
    const [slug, id] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    return { view: VIEWS[slug] ?? 'series', id: seriesById.has(id) ? id : null };
  }

  let route = $state(parseHash(location.hash));
  // Zuletzt gewählte Reihe bleibt erhalten, wenn man zwischen den Tabs wechselt.
  let lastSeriesId = $state(route.id ?? series[0].id);
  let view = $derived(route.view); // 'series' | 'next' | 'reco' | 'stock' | 'log' | 'charts'
  let selectedId = $derived(route.id ?? lastSeriesId);

  function onHashChange() {
    route = parseHash(location.hash);
    if (route.id) lastSeriesId = route.id;
  }
  let sidebarOpen = $state(false);

  let selectedSeries = $derived(seriesById.get(selectedId) ?? series[0]);

  // Neuer Hash = neuer Eintrag im Verlauf; hashchange setzt dann route.
  function show(v) {
    if (v === 'series') pickSeries(lastSeriesId);
    else location.hash = `#/${SLUGS[v]}`;
  }

  function pickSeries(id) {
    location.hash = `#/reihen/${encodeURIComponent(id)}`;
    sidebarOpen = false;
  }

  const stand = new Date(meta.generatedAt).toLocaleDateString('de-DE');
  const liveStand = live ? new Date(live.updatedAt).toLocaleString('de-DE') : null;
  // Heute reicht die Uhrzeit, sonst mit Datum
  const sameDay = live ? new Date(live.updatedAt).toDateString() === new Date().toDateString() : false;
  // Uhr für „vor x min“ und Ernte-Countdowns; einmal pro Minute reicht.
  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });

  // Der Bot läuft alle 15 bis 20 Minuten; nach 40 Minuten ohne neuen Stand stimmt etwas nicht.
  const STALE_MINUTES = 40;
  let ageMinutes = $derived(botHealth ? (now - new Date(botHealth.updatedAt).getTime()) / 60000 : 0);
  let stale = $derived(ageMinutes > STALE_MINUTES);
  let healthTitle = $derived(
    botHealth
      ? [
          `Letzter Lauf: ${liveStand} (vor ${fmtDuration(ageMinutes)})`,
          botHealth.codeVersion ? `Code: ${botHealth.codeVersion}` : null,
          botHealth.errors.length ? `Lesefehler:\n${botHealth.errors.join('\n')}` : 'Keine Lesefehler',
        ]
          .filter(Boolean)
          .join('\n')
      : '',
  );

  // Nächste Ernte: früheste Pflanze; im Tooltip alle mit Anzahl.
  const harvestList = Object.entries(harvestAt).sort((a, b) => a[1].localeCompare(b[1]));
  let harvestTitle = $derived(
    [
      'Wächst gerade:',
      ...harvestList.map(([name, at]) => `${name} (${fmt(growing?.[name] ?? 0)}): ${fmtUntil(at, now)}`),
    ].join('\n'),
  );

  // Wachstums-Dekos: wie viele sind bereit, sonst wann ist die nächste so weit.
  let boosterStates = $derived(boosters.map((b) => ({ ...b, ...boosterState(b, now) })));
  let boostersReady = $derived(boosterStates.filter((b) => b.ready));
  let nextBooster = $derived([...boosterStates].sort((a, b) => a.readyIn - b.readyIn)[0]);
  let boosterTitle = $derived(
    [
      'Wachstums-Dekos:',
      ...boosterStates.map(
        (b) =>
          `Garten ${b.garden}, ${b.name} (spart ${b.reduction / 3600} h): ` +
          (b.ready ? (b.worthIt ? 'bereit, lohnt' : 'bereit, lohnt noch nicht') : `in ${fmtDuration(b.readyIn / 60)}`),
      ),
    ].join('\n'),
  );
</script>

<svelte:window onhashchange={onHashChange} />

<header class="topbar">
  <div class="brand">
    <span class="logo">🌱</span>
    <div class="brand-text">
      <h1>Wurzelimperium Quest-Tracker</h1>
      <div class="sub">{meta.seriesCount} Reihen · {meta.questCount} Quests · Stand {stand}</div>
      <div class="overall">
        <div class="overall-bar"><div class="overall-fill" style="width:{overallProgress.pct}%"></div></div>
        <span class="overall-text">{overallProgress.done} / {overallProgress.total} erledigt ({overallProgress.pct}%)</span>
      </div>
    </div>
  </div>

  <div class="tabs">
    <button class:on={view === 'series'} onclick={() => show('series')}>Reihen</button>
    <button class:on={view === 'next'} onclick={() => show('next')}>Nächste Quests</button>
    <button class:on={view === 'reco'} onclick={() => show('reco')}>Empfehlungen</button>
    <button class:on={view === 'stock'} onclick={() => show('stock')}>Bestand</button>
    <button class:on={view === 'log'} onclick={() => show('log')}>Protokoll</button>
    <button class:on={view === 'charts'} onclick={() => show('charts')}>Charts</button>
  </div>

  <!-- Eine schmale Leiste statt einzelner Pillen; Details stehen in den Tooltips. -->
  <div class="status">
    {#if live}
      <span class="item live" class:warn={stale} class:partial={!stale && botHealth.errors.length} title={healthTitle}>
        {#if stale}⚠ {fmtDurationShort(ageMinutes)} alt{:else}● {sameDay ? fmtClock(live.updatedAt) : liveStand}{/if}
        {#if botHealth.errors.length}· ⚠{botHealth.errors.length}{/if}
      </span>
      {#if account?.money != null}
        <span class="item" title="Wurzeltaler: {fmt(Math.round(account.money))} wT · Coins: {fmt(account.coins ?? 0)}">
          💰 {fmtShort(account.money)}
        </span>
      {/if}
      {#if account?.points != null}
        <span class="item" title="Punkte: {fmt(account.points)}">⭐ {fmtShort(account.points)}</span>
      {/if}
      {#if harvestList.length}
        <span class="item" title={harvestTitle}>
          🌾 {fmtUntil(harvestList[0][1], now) === 'fertig'
            ? 'fertig'
            : fmtDurationShort((new Date(harvestList[0][1]).getTime() - now) / 60000)}
        </span>
      {/if}
      {#if nextBooster}
        <span class="item" class:boost-ready={boostersReady.some((b) => b.worthIt)} title={boosterTitle}>
          ✨ {boostersReady.length ? `${boostersReady.length} bereit` : fmtDurationShort(nextBooster.readyIn / 60)}
        </span>
      {/if}
    {:else}
      <span class="item" title="Live-Stand nicht erreichbar, eingebauter Stand aus progress.json">Offline</span>
    {/if}
    <span class="item" title="Level, aus dem Live-Stand bzw. progress.json">Lvl {$settings.level ?? '–'}</span>
  </div>
</header>

{#if view === 'series'}
  <div class="layout">
    <button class="side-toggle" onclick={() => (sidebarOpen = !sidebarOpen)}>
      ☰ {selectedSeries.name}
    </button>

    <aside class="sidebar" class:open={sidebarOpen}>
      <div class="side-opts">
        <label class="chk">
          <input
            type="checkbox"
            checked={$settings.hideCompleted}
            onchange={(e) => settings.update((s) => ({ ...s, hideCompleted: e.currentTarget.checked }))}
          />
          Erledigte ausblenden
        </label>
      </div>
      <Sidebar selectedId={selectedId} onselect={pickSeries} />
    </aside>

    <main class="content">
      <SeriesView series={selectedSeries} />
    </main>
  </div>
{:else if view === 'next'}
  <main class="content wide">
    <h2 class="reco-title">Nächste Quests</h2>
    <NextQuests onselect={pickSeries} />
  </main>
{:else if view === 'reco'}
  <main class="content wide">
    <h2 class="reco-title">Was soll ich anpflanzen / sammeln?</h2>
    <Recommendations />
  </main>
{:else if view === 'stock'}
  <main class="content wide">
    <h2 class="reco-title">Regalbestand</h2>
    <Stock />
  </main>
{:else if view === 'log'}
  <main class="content wide">
    <h2 class="reco-title">Protokoll</h2>
    <Log />
  </main>
{:else}
  <main class="content wide">
    <h2 class="reco-title">Charts</h2>
    <Charts />
  </main>
{/if}

<footer class="foot">
  Daten aus dem <a href={meta.source} target="_blank" rel="noopener">Wurzelimperium-Forum</a>.
</footer>

<style>
  .topbar {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.8rem 1.1rem;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .logo {
    font-size: 1.7rem;
  }
  h1 {
    font-size: 1.15rem;
  }
  .sub {
    font-size: 0.78rem;
    color: var(--muted);
    margin-top: 0.1rem;
  }
  .overall {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.35rem;
  }
  .overall-bar {
    width: 160px;
    height: 6px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 999px;
    overflow: hidden;
  }
  .overall-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-strong));
  }
  .overall-text {
    font-size: 0.75rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .tabs {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 9px;
    overflow: hidden;
  }
  .tabs button {
    border: none;
    border-radius: 0;
    background: var(--panel);
    padding: 0.45rem 1rem;
    font-weight: 550;
  }
  .tabs button.on {
    background: var(--accent);
    color: #fff;
  }
  .status {
    margin-left: auto;
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 9px;
    overflow: hidden;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }
  .item {
    padding: 0.25rem 0.6rem;
    color: var(--muted);
    white-space: nowrap;
  }
  .item + .item {
    border-left: 1px solid var(--border);
  }
  .item.live,
  .item.boost-ready {
    color: var(--accent-strong);
    font-weight: 600;
  }
  .item.live.partial {
    color: var(--warn);
  }
  .item.live.warn {
    color: var(--danger);
  }

  .layout {
    display: grid;
    grid-template-columns: clamp(230px, 18vw, 280px) minmax(0, 1fr);
    align-items: start;
    gap: 1.2rem;
    padding: 1.1rem;
    max-width: 1560px;
    margin: 0 auto;
  }
  .sidebar {
    position: sticky;
    top: 74px;
    max-height: calc(100vh - 90px);
    overflow-y: auto;
    overflow-x: hidden;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    min-width: 0;
  }
  .side-opts {
    padding: 0.7rem 0.7rem 0.2rem;
    border-bottom: 1px solid var(--border);
  }
  .chk {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .chk input {
    accent-color: var(--accent);
  }
  .content {
    min-width: 0;
  }
  .content.wide {
    padding: 1.1rem;
    max-width: 1000px;
    margin: 0 auto;
  }
  .reco-title {
    font-size: 1.3rem;
    margin-bottom: 0.9rem;
  }
  .side-toggle {
    display: none;
  }

  .foot {
    max-width: 1560px;
    margin: 1rem auto 2rem;
    padding: 0 1.2rem;
    font-size: 0.8rem;
    color: var(--muted);
  }

  @media (max-width: 860px) {
    /* Fünf Tabs passen nicht auf ein Handy: Leiste seitlich wischen statt abschneiden. */
    .tabs {
      max-width: 100%;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .tabs button {
      flex: 0 0 auto;
      white-space: nowrap;
    }
    .layout {
      grid-template-columns: 1fr;
      gap: 0.7rem;
    }
    .side-toggle {
      display: block;
      text-align: left;
      font-weight: 600;
    }
    .sidebar {
      display: none;
      position: static;
      max-height: 60vh;
    }
    .sidebar.open {
      display: block;
    }
    h1 {
      font-size: 1rem;
    }
  }
</style>
