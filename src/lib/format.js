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
