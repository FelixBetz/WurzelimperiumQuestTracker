<script>
  import { series, meta, overallProgress } from './lib/data.js';
  import { settings } from './lib/store.js';
  import Sidebar from './lib/components/Sidebar.svelte';
  import SeriesView from './lib/components/SeriesView.svelte';
  import Recommendations from './lib/components/Recommendations.svelte';
  import NextQuests from './lib/components/NextQuests.svelte';
  import Charts from './lib/components/Charts.svelte';

  let view = $state('series'); // 'series' | 'next' | 'reco' | 'charts'
  let selectedId = $state(series[0].id);
  let sidebarOpen = $state(false);

  let selectedSeries = $derived(series.find((s) => s.id === selectedId) ?? series[0]);

  function pickSeries(id) {
    selectedId = id;
    sidebarOpen = false;
  }

  function jumpToSeries(id) {
    pickSeries(id);
    view = 'series';
  }

  const stand = new Date(meta.generatedAt).toLocaleDateString('de-DE');
</script>

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
    <button class:on={view === 'series'} onclick={() => (view = 'series')}>Reihen</button>
    <button class:on={view === 'next'} onclick={() => (view = 'next')}>Nächste Quests</button>
    <button class:on={view === 'reco'} onclick={() => (view = 'reco')}>Empfehlungen</button>
    <button class:on={view === 'charts'} onclick={() => (view = 'charts')}>Charts</button>
  </div>

  <div class="tools">
    <span class="level" title="Wird in progress.json gesetzt">
      Level {$settings.level ?? '– (kein Filter)'}
    </span>
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
    <NextQuests onselect={jumpToSeries} />
  </main>
{:else if view === 'reco'}
  <main class="content wide">
    <h2 class="reco-title">Was soll ich anpflanzen / sammeln?</h2>
    <Recommendations />
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
  .tools {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.9rem;
    flex-wrap: wrap;
  }
  .level {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--muted);
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.2rem 0.7rem;
  }

  .layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    align-items: start;
    gap: 1.2rem;
    padding: 1.1rem;
    max-width: 1200px;
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
    max-width: 1200px;
    margin: 1rem auto 2rem;
    padding: 0 1.2rem;
    font-size: 0.8rem;
    color: var(--muted);
  }

  @media (max-width: 860px) {
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
