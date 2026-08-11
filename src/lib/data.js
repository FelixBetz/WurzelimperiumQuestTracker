// Zugriff auf die statischen Questdaten (aus scripts/extract.mjs erzeugt).
import raw from '../data/quests.json';
import progressData from '../data/progress.json';

// Fortschritt = pro Reihe die Anzahl erledigter Quests. Read-only: wird
// ausschließlich durch Bearbeiten von src/data/progress.json geändert.
// Format: { "seriesId": 12, ... }  ->  Quests 1..12 erledigt, 13 aktuell.
export const progress = progressData.series ?? {};

// Reihen, die im Spiel noch nicht freigeschaltet sind (unabhängig vom Level).
// Kommt aus progress.json ("locked": [seriesId, ...]).
export const lockedIds = new Set(progressData.locked ?? []);
export function isLocked(s) {
  return lockedIds.has(s.id);
}

const buildDate = import.meta.env.VITE_BUILD_DATE || raw.generatedAt;

export const meta = {
  generatedAt: buildDate,
  source: raw.source,
  seriesCount: raw.seriesCount,
  questCount: raw.questCount,
};

export const series = raw.series;
export const seriesById = new Map(series.map((s) => [s.id, s]));

// Reihen für die Seitenleiste: Top-Level-Reihen stehen einzeln,
// Unterreihen werden unter ihrem Gruppen-Header gebündelt.
export const sidebar = (() => {
  const out = [];
  for (const s of series) {
    if (!s.group) {
      out.push({ type: 'solo', series: s });
    } else {
      let g = out[out.length - 1];
      if (!(g && g.type === 'group' && g.name === s.group)) {
        g = { type: 'group', name: s.group, list: [] };
        out.push(g);
      }
      g.list.push(s);
    }
  }
  return out;
})();

// Alle vorkommenden Gegenstands-Namen (für Kanonisierung).
const itemNames = new Set();
for (const s of series) for (const q of s.quests) for (const r of q.requirements) itemNames.add(r.item);

// Manche Quests verlangen Wurzeltaler als Bedarf (nicht als Belohnung, z.B.
// "1.500.000 wT für 1 Medaille"). Das ist kein anbaubarer Gegenstand und wird
// aus "was anpflanzen"-Aggregationen (Empfehlungen, Charts) ausgeschlossen –
// in der normalen Quest-Anzeige bleibt es korrekterweise stehen.
export function isCurrencyItem(name) {
  return /^(wT|Wurzeltaler)$/i.test(name);
}

// Manche Reihen schreiben denselben Gegenstand mal Singular, mal Plural
// (z. B. "Tomate" vs. "Tomaten"). Für die Empfehlungen führen wir sie
// zusammen – aber nur, wenn beide Formen wirklich vorkommen (sicher).
export function canonicalItem(name) {
  if (name.length > 3 && name.endsWith('n') && itemNames.has(name.slice(0, -1))) {
    return name.slice(0, -1);
  }
  return name;
}

// Fortschritt = pro Reihe die Anzahl erledigter Quests (der Reihe nach).
// Quests 0..count-1 (Index) gelten als erledigt, quests[count] ist aktuell.

// Wie viele Quests einer Reihe sind erledigt? (0..Anzahl)
export function doneCount(s, progress) {
  return Math.min(s.quests.length, Math.max(0, progress[s.id] ?? 0));
}

// Erste noch nicht erledigte Quest einer Reihe (= aktuell spielbar).
export function currentQuest(s, progress) {
  const c = doneCount(s, progress);
  return c < s.quests.length ? s.quests[c] : null;
}

// Noch offene Quests einer Reihe (ab der aktuellen).
export function openQuests(s, progress) {
  return s.quests.slice(doneCount(s, progress));
}

// Gesamtfortschritt über alle Reihen (inkl. noch gesperrter – die stehen
// ohnehin bei 0 Quests erledigt, zählen aber zum Gesamtumfang des Spiels).
export const overallProgress = (() => {
  let done = 0;
  for (const s of series) done += doneCount(s, progress);
  const total = meta.questCount;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
})();

// Bereits verdiente Belohnungen aus allen erledigten Quests (alle Reihen).
export const earnedRewards = (() => {
  let taler = 0;
  let punkte = 0;
  for (const s of series) {
    const count = doneCount(s, progress);
    for (let i = 0; i < count; i++) {
      for (const r of s.quests[i].rewards) {
        if (r.type === 'taler') taler += r.amount;
        else if (r.type === 'punkte') punkte += r.amount;
      }
    }
  }
  return { taler, punkte };
})();

// Bereits verbrauchte Gegenstände aus allen erledigten Quests (alle Reihen),
// Singular/Plural zusammengeführt und ohne Währungs-Pseudo-Items. Absteigend
// sortiert, die Komponente greift sich davon die Top N.
export const spentItems = (() => {
  const map = new Map();
  for (const s of series) {
    const count = doneCount(s, progress);
    for (let i = 0; i < count; i++) {
      for (const r of s.quests[i].requirements) {
        if (isCurrencyItem(r.item)) continue;
        const key = canonicalItem(r.item);
        map.set(key, (map.get(key) ?? 0) + r.amount);
      }
    }
  }
  return [...map.entries()].map(([item, amount]) => ({ item, amount })).sort((a, b) => b.amount - a.amount);
})();
