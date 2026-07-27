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

// Nummer der Quest hübsch (Quest 01, Quest 148 ...).
export function questLabel(nr) {
  return `Quest ${String(nr).padStart(2, '0')}`;
}
