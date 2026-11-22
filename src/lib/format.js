// Kleine Formatierungshelfer.

const nf = new Intl.NumberFormat('de-DE');

export function fmt(n) {
  return nf.format(n ?? 0);
}

// Belohnung als lesbarer Text.
export function rewardLabel(r) {
  if (r.type === 'taler') return `${nf.format(r.amount)} wT`;
  if (r.type === 'punkte') return `${nf.format(r.amount)} Punkte`;
  return r.value;
}

// Icon je Belohnungstyp (Wurzeltaler, Punkte, Deko/Item/Gebäude).
export function rewardIcon(r) {
  if (r.type === 'taler') return '💰';
  if (r.type === 'punkte') return '⭐';
  return '🎁';
}

// Nummer der Quest hübsch (Quest 01, Quest 148 ...).
export function questLabel(nr) {
  return `Quest ${String(nr).padStart(2, '0')}`;
}

// Große Beträge kurz: 1,2 Mio., darunter ganze Zahlen: 980.909
const compact = new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 });
export function fmtCompact(n) {
  return Math.abs(n ?? 0) >= 1_000_000 ? compact.format(n) : nf.format(Math.round(n ?? 0));
}

// Mit Vorzeichen: +343, −120
export function fmtDelta(n) {
  return `${n > 0 ? '+' : '−'}${nf.format(Math.abs(Math.round(n * 100) / 100))}`;
}

// Dauer in Minuten lesbar: "5 min", "2 h 10 min", "3 Tage"
export function fmtDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
  return `${Math.round(m / 1440)} Tage`;
}

// Bis zu einem Zeitpunkt: "in 2 h 10 min" oder "fertig"
export function fmtUntil(iso, now) {
  const minutes = (new Date(iso).getTime() - now) / 60000;
  return minutes <= 0 ? 'fertig' : `in ${fmtDuration(minutes)}`;
}

// Uhrzeit: 21:05
export function fmtClock(iso) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
