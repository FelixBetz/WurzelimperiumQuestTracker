// Zugriff auf die statischen Questdaten (aus scripts/extract.mjs erzeugt).
import raw from '../data/quests.json';
import progressData from '../data/progress.json';
import shopPriceData from '../data/shopPrices.json';

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

const buildDate = import.meta.env?.VITE_BUILD_DATE || raw.generatedAt;

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
  const raw = String(name ?? '').trim();
  if (/^(wT|Wurzeltaler)$/i.test(raw)) return true;

  // Robust gegen Parser-/Textvarianten wie "600.000 Wurzeltaler".
  const withoutAmount = raw.replace(/^[\d.,]+\s+/, '').trim();
  return /^(wT|Wurzeltaler)$/i.test(withoutAmount);
}

// Einige Quest-Items sind nicht im Shop kaufbar (z. B. Honig),
// sondern nur über andere Spielsysteme herstellbar.
export function isCraftOnlyItem(name) {
  return /honig$/i.test(String(name ?? '').trim());
}

function requirementAmountMultiplier(itemName) {
  const raw = String(itemName ?? '').trim();
  if (/^([\d.,]+\s+)?million(?:en)?\b/i.test(raw)) return 1_000_000;
  if (/^([\d.,]+\s+)?milliard(?:e|en)?\b/i.test(raw)) return 1_000_000_000;
  return 1;
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

function normalizeItemName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function deUmlaut(name) {
  return name
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/Ä/g, 'A')
    .replace(/Ö/g, 'O')
    .replace(/Ü/g, 'U');
}

function addNameVariant(set, name) {
  const raw = String(name ?? '').trim();
  if (!raw) return;
  set.add(raw);
  set.add(deUmlaut(raw));
}

function itemNameCandidates(itemName) {
  const out = new Set();
  const raw = String(itemName ?? '').trim();
  addNameVariant(out, raw);

  const withoutPrefix = raw.replace(/^[\d.,]+\s*x\s+/i, '').replace(/^[\d.,]+\s+/, '').trim();
  addNameVariant(out, withoutPrefix);

  // Sonderfall aus Quests wie "7 Millionen Karotten" -> "Karotten".
  const withoutScale = withoutPrefix.replace(/^million(?:en)?\s+/i, '').trim();
  addNameVariant(out, withoutScale);

  const base = withoutScale.replace(/\s+für\s+.+$/i, '').trim();
  addNameVariant(out, base);
  addNameVariant(out, canonicalItem(base));

  for (const seed of [...out]) {
    if (seed.length > 3 && seed.endsWith('en')) {
      addNameVariant(out, seed.slice(0, -1));
      addNameVariant(out, seed.slice(0, -2));
    }
    if (seed.length > 3 && seed.endsWith('n')) addNameVariant(out, seed.slice(0, -1));
    if (seed.length > 3 && seed.endsWith('s')) addNameVariant(out, seed.slice(0, -1));
    if (seed.length > 3 && seed.endsWith('e')) addNameVariant(out, seed.slice(0, -1));
  }

  return [...new Set([...out].map((x) => normalizeItemName(x)).filter(Boolean))];
}

// Shop-Preis pro Pflanze/Saatgut (wT pro Stück) inklusive Alias-Mapping
// für typische Quest-Schreibweisen (Plural, Umlaute, Zusätze wie "für ...").
const shopPriceLookup = (() => {
  const out = new Map();
  const prices = shopPriceData.prices ?? {};

  const setLookup = (name, price, sourceName) => {
    const key = normalizeItemName(name);
    if (!key) return;
    if (!out.has(key)) out.set(key, { price, sourceName });
  };

  for (const [item, price] of Object.entries(prices)) {
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) continue;

    for (const candidate of itemNameCandidates(item)) {
      setLookup(candidate, price, item);
    }

    if (item.length > 3) {
      if (item.endsWith('e')) {
        setLookup(`${item}n`, price, item);
      } else {
        setLookup(`${item}e`, price, item);
        setLookup(`${item}en`, price, item);
      }
      setLookup(`${item}s`, price, item);
    }
  }

  const aliases = shopPriceData.aliases ?? {};
  for (const [alias, target] of Object.entries(aliases)) {
    if (typeof alias !== 'string') continue;

    if (typeof target === 'number' && Number.isFinite(target) && target >= 0) {
      for (const candidate of itemNameCandidates(alias)) {
        setLookup(candidate, target, alias);
      }
      continue;
    }

    if (typeof target !== 'string') continue;
    const targetHit = out.get(normalizeItemName(target));
    if (!targetHit) continue;
    for (const candidate of itemNameCandidates(alias)) {
      setLookup(candidate, targetHit.price, targetHit.sourceName);
    }
  }

  return out;
})();

function resolveShopPrice(itemName) {
  for (const candidate of itemNameCandidates(itemName)) {
    const hit = shopPriceLookup.get(candidate);
    if (hit) return hit;
  }
  return null;
}

// Berechnet den Shop-Wert einer Quest anhand der benötigten Pflanzen.
// Gibt bei fehlenden Preisen einen Teilwert + Liste fehlender Shop-Items zurück.
export function questShopCost(quest) {
  let total = 0;
  let currencyTotal = 0;
  let shopItemCount = 0;
  let pricedRequirements = 0;
  const missing = new Set();
  const nonShopItems = new Set();
  const requirements = [];

  for (const r of quest.requirements) {
    if (isCurrencyItem(r.item)) {
      currencyTotal += Number(r.amount ?? 0);
      requirements.push({
        item: r.item,
        amount: r.amount,
        isCurrency: true,
        isCraftOnly: false,
        hasPrice: false,
        unitPrice: null,
        total: null,
        mappedTo: null,
      });
      continue;
    }

    if (isCraftOnlyItem(r.item)) {
      nonShopItems.add(r.item);
      requirements.push({
        item: r.item,
        amount: r.amount,
        isCurrency: false,
        isCraftOnly: true,
        hasPrice: false,
        unitPrice: null,
        total: null,
        mappedTo: null,
      });
      continue;
    }

    shopItemCount += 1;

    const hit = resolveShopPrice(r.item);
    if (hit && typeof hit.price === 'number' && Number.isFinite(hit.price)) {
      const amount = Number(r.amount ?? 0);
      const pricingAmount = amount * requirementAmountMultiplier(r.item);
      const lineTotal = hit.price * pricingAmount;
      total += lineTotal;
      pricedRequirements += 1;

      requirements.push({
        item: r.item,
        amount: r.amount,
        pricingAmount,
        isCurrency: false,
        isCraftOnly: false,
        hasPrice: true,
        unitPrice: hit.price,
        total: lineTotal,
        mappedTo: hit.sourceName,
      });
    } else {
      missing.add(r.item);
      requirements.push({
        item: r.item,
        amount: r.amount,
        pricingAmount: Number(r.amount ?? 0) * requirementAmountMultiplier(r.item),
        isCurrency: false,
        isCraftOnly: false,
        hasPrice: false,
        unitPrice: null,
        total: null,
        mappedTo: null,
      });
    }
  }

  return {
    total,
    currencyTotal,
    shopItemCount,
    hasAnyPrice: pricedRequirements > 0,
    complete: missing.size === 0,
    missingItems: [...missing],
    nonShopItems: [...nonShopItems],
    requirements,
  };
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
