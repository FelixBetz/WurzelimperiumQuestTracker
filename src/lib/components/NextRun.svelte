<script>
  import { nextRun, TIMER_ICON } from '../data.js';
  import { fmtClock, fmtUntil } from '../format.js';

  // Alle Zeitgeber, die der Bot nach seinem letzten Lauf gelesen hat; der früheste davon ist der nächste Lauf.
  let { now } = $props();

  let timers = $derived(nextRun?.timers ?? []);
  let open = $state(false);
  const SHORT = 6;
  let shown = $derived(open ? timers : timers.filter((t) => !t.due).slice(0, SHORT));

  function when(t) {
    if (t.due) return 'offen';
    const at = new Date(t.at);
    const day =
      at.toDateString() === new Date(now).toDateString()
        ? ''
        : `${at.toLocaleDateString('de-DE', { weekday: 'short' })} `;
    return `${day}${fmtClock(t.at)} · ${fmtUntil(t.at, now)}`;
  }
</script>

{#if nextRun?.stopped}
  <section class="next"><h3>⏭ Nächster Lauf</h3><p class="muted">Der Bot ist in der Notiz angehalten.</p></section>
{:else if nextRun}
  <section class="next">
    <h3>
      ⏭ Nächster Lauf mit Arbeit:
      {#if nextRun.at}
        <b>{fmtClock(nextRun.at)}</b> <span class="muted">({fmtUntil(nextRun.at, now)}, {nextRun.text})</span>
      {:else}
        <span class="muted">nichts geplant</span>
      {/if}
    </h3>
    <p class="muted small">
      Aus den Zeitgebern im Spiel beim letzten Lauf. Der Bot läuft trotzdem alle 15 Minuten; das hier sagt, wann er
      wieder etwas zu tun hat.
    </p>
    <ul>
      {#each shown as t (t.key + t.text)}
        <li class:due={t.due} class:info={!t.bot}>
          <span class="ico">{TIMER_ICON[t.key] ?? '•'}</span>
          <span class="txt">{t.text}</span>
          <span class="at">{when(t)}</span>
          {#if !t.bot}<span class="tag" title="Macht der Bot nicht selbst, nur zur Info">Info</span>{/if}
          {#if t.due}<span class="tag" title="Beim Lauf schon fällig, aber nicht erledigt (z. B. kein Saatgut). Zählt nicht für den nächsten Lauf.">offen</span>{/if}
        </li>
      {/each}
    </ul>
    {#if timers.length > shown.length || open}
      <button class="more" onclick={() => (open = !open)}>
        {open ? '▾ weniger' : `▸ alle ${timers.length} Zeitgeber`}
      </button>
    {/if}
  </section>
{/if}

<style>
  .next {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.7rem 0.9rem;
    margin-bottom: 1rem;
  }
  h3 {
    margin: 0;
    font-size: 0.95rem;
  }
  .muted {
    color: var(--muted);
    font-weight: 400;
  }
  .small {
    font-size: 0.8rem;
    margin: 0.3rem 0 0.5rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.15rem;
  }
  li {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.88rem;
  }
  li.due,
  li.info {
    color: var(--muted);
  }
  .ico {
    width: 1.4rem;
    text-align: center;
  }
  .txt {
    flex: 1;
    min-width: 0;
  }
  .at {
    color: var(--muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .tag {
    font-size: 0.7rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0 0.35rem;
    color: var(--muted);
  }
  .more {
    margin-top: 0.4rem;
    border: none;
    background: none;
    color: var(--accent-strong);
    padding: 0;
    font-size: 0.82rem;
    cursor: pointer;
  }
</style>
