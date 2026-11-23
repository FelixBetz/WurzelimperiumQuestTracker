// Zugriff auf die statischen Questdaten (aus scripts/extract.mjs erzeugt).
import raw from '../data/quests.json';
import progressData from '../data/progress.json';
import shopPriceData from '../data/shopPrices.json';
import builtStockData from '../data/stock.json';

// Live-Stand vom VPS: daily.py schreibt bei jedem Lauf status.json, die Seite
// holt sie beim Öffnen (URL aus VITE_STATUS_URL). Ohne URL, bei Fehler oder
// Zeitüberschreitung bleibt es beim eingebauten Stand aus progress.json und
// stock.json.
async function loadLive(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.version !== 1) throw new Error(`unbekannte Version ${data?.version}`);
    return data;
  } catch (err) {
    console.warn('Live-Stand nicht geladen, nutze eingebauten Stand:', err);
    return null;
  }
}

const STATUS_URL = import.meta.env?.VITE_STATUS_URL;
export const live = await loadLive(STATUS_URL);

// Weitere Dateien neben status.json (Protokoll, Verlauf); werden erst im jeweiligen Tab geladen.
export async function loadSibling(file) {
  if (!STATUS_URL) return null;
  const res = await fetch(new URL(file, STATUS_URL), { cache: 'no-cache', signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Zustand des Bots für die Kopfzeile: Wann lief er zuletzt, mit welchem Code, gab es Lesefehler?
export const botHealth = live
  ? { updatedAt: live.updatedAt, codeVersion: live.codeVersion ?? null, errors: live.errors ?? [] }
  : null;

// Konto aus dem Live-Stand: Wurzeltaler (money), Coins, Punkte.
export const account = live ? { money: live.money ?? null, coins: live.coins ?? null, points: live.points ?? null } : null;

// Früheste Ernte je Pflanze ({ Name: ISO-Zeit }), nur im Live-Stand.
export const harvestAt = live?.harvestAt ?? {};

// Nächster Lauf aus dem Live-Stand: { at, key, text, timers: [{ at, key, text, bot, due }] } oder { stopped }.
// at ist der früheste Zeitgeber, um den sich der Bot kümmert; due = schon beim Lauf fällig, aber nicht erledigt
// (z. B. kein Saatgut), zählt deshalb nicht. bot = false: macht der Bot (noch) nicht selbst.
export const nextRun = live?.nextRun ?? null;
export const TIMER_ICON = {
  harvest: '🌾',
  water: '💧',
  plant: '🌱',
  booster: '✨',
  bonsai: '🌳',
  parkCash: '🎡',
  parkRenew: '🔁',
  deco1: '🎁',
  deco2: '🎁',
  museum: '🏛',
  bees: '🐝',
  infinity: '♾',
  daily: '📅',
};

// Wachstums-Dekos (Booster) aus dem Live-Stand: [{ garden, name, reduction, cooldown, readyAt, plants,
// minGrowLeft, ... }], Zeiten in Sekunden. boosterState rechnet „bereit“ und „lohnt“ für die aktuelle Uhrzeit
// nach, weil die Seite auch eine Weile nach dem letzten Lauf offen sein kann.
export const boosters = live?.boosters ?? [];
export function boosterState(b, now) {
  const elapsed = (now - new Date(live.updatedAt).getTime()) / 1000;
  const readyIn = Math.max(0, (new Date(b.readyAt).getTime() - now) / 1000);
  const growLeft = b.minGrowLeft == null ? null : b.minGrowLeft - elapsed;
  const ready = readyIn === 0;
  return { ready, readyIn, growLeft, worthIt: ready && b.plants > 0 && growLeft != null && growLeft >= b.reduction };
}

// Fortschritt = pro Reihe die Anzahl erledigter Quests. Read-only: kommt aus
// src/data/progress.json; Reihen, die der Bot auslesen kann, überschreibt der
// Live-Stand.
// Format: { "seriesId": 12, ... }  ->  Quests 1..12 erledigt, 13 aktuell.
export const progress = { ...(progressData.series ?? {}), ...(live?.series ?? {}) };

export const level = live?.level ?? progressData.level ?? null;

// Was gerade in den Gärten wächst ({ Name: Anzahl }), nur im Live-Stand.
export const growing = live?.growing ?? null;

// Leerer Live-Bestand = Lesefehler im Bot; dann lieber der eingebaute Stand.
const stockData =
  live?.stock && Object.keys(live.stock).length ? { updatedAt: live.updatedAt, items: live.stock } : builtStockData;

// Regalbestand für den Tab „Bestand“: { items: { Name: Menge }, groups, honeyTank, updatedAt, live }.
// groups: { Name: 'garden' | 'water' | 'herb' | 'honey' } aus dem Live-Stand; ohne ihn
// wird nur Honig am Namen erkannt, der Rest landet unter 'other'.
const isLiveStock = stockData !== builtStockData;
export const stock = {
  items: stockData.items ?? {},
  groups: (isLiveStock && live?.stockGroups) || null,
  honeyTank: (isLiveStock && live?.honeyTank) || {},
  updatedAt: stockData.updatedAt ?? null,
  live: isLiveStock,
};

export function stockGroup(name) {
  return stock.groups?.[name] ?? (/-honig$/i.test(name) ? 'honey' : 'other');
}

// Reihen, die im Spiel noch nicht freigeschaltet sind (unabhängig vom Level).
// Kommt aus progress.json ("locked": [seriesId, ...]); für die Reihen, die der Bot
// kennt (live.unlocked: { seriesId: true/false }), entscheidet der Live-Stand.
export const lockedIds = new Set(progressData.locked ?? []);
for (const [id, unlocked] of Object.entries(live?.unlocked ?? {})) {
  if (unlocked) lockedIds.delete(id);
  else lockedIds.add(id);
}
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

// Shop-Preis je Stück für einen Regal-Gegenstand, null wenn er nicht im Shop zu kaufen ist.
export function stockUnitPrice(name) {
  if (isCraftOnlyItem(name)) return null;
  return resolveShopPrice(name)?.price ?? null;
}

function resolveShopPrice(itemName) {
  for (const candidate of itemNameCandidates(itemName)) {
    const hit = shopPriceLookup.get(candidate);
    if (hit) return hit;
  }
  return null;
}

// Regalbestand aus src/data/stock.json (geschrieben von get_quests.py).
// Honig heißt im Spiel "Mirabellenblüten-Honig", in den Quests teils
// "Mirabellen-Honig" – beide landen deshalb auf demselben Schlüssel.
function stockKey(name) {
  const key = deUmlaut(normalizeItemName(name));
  const honey = key.match(/^(.+)-honig$/);
  if (!honey) return key;
  return `${honey[1].replace('bluten', '').replace(/(en|n|e)$/, '')}-honig`;
}

const stockLookup = new Map(
  Object.entries(stockData.items ?? {}).map(([item, amount]) => [stockKey(item), amount]),
);

function resolveStockKey(itemName) {
  const alias = shopPriceData.aliases?.[itemName];
  for (const candidate of itemNameCandidates(typeof alias === 'string' ? alias : itemName)) {
    const key = stockKey(candidate);
    if (stockLookup.has(key)) return key;
  }
  return null;
}

function neededAmount(r) {
  return Number(r.amount ?? 0) * requirementAmountMultiplier(r.item);
}

// Bedarf der übergebenen Quests je Regal-Gegenstand, für den Tab „Bestand“:
// Map { Name wie im Regal: { needed, quests } }. Gegenstände, die nicht im Regal
// geführt werden (z. B. Riegel, Wurzeltaler), fehlen.
const stockNameByKey = new Map(Object.keys(stockData.items ?? {}).map((name) => [stockKey(name), name]));

// Bonsai, Park und Bienen nehmen Teillieferungen: Was für die aktuelle Quest schon abgegeben ist, kommt aus dem
// Live-Stand (live.sent: { seriesId: { quest, items: { Name: Menge } } }) und fehlt nicht mehr.
// Map { quest.id: Map { stockKey: Menge } }, nur wenn die Questnummer zum Fortschritt passt.
const sentByQuest = (() => {
  const out = new Map();
  for (const s of series) {
    const info = live?.sent?.[s.id];
    const q = info && currentQuest(s, progress);
    if (!q || q.nr !== info.quest) continue;
    out.set(q.id, new Map(Object.entries(info.items ?? {}).map(([name, n]) => [stockKey(name), Number(n) || 0])));
  }
  return out;
})();

function sentAmount(quest, r) {
  const items = sentByQuest.get(quest.id);
  if (!items) return 0;
  for (const candidate of itemNameCandidates(r.item)) {
    const n = items.get(stockKey(candidate));
    if (n != null) return n;
  }
  return 0;
}

// Was für die Quest noch fehlt: Bedarf minus schon abgegeben.
function openAmount(quest, r) {
  return Math.max(0, neededAmount(r) - sentAmount(quest, r));
}

export function stockDemand(quests) {
  const out = new Map();
  for (const q of quests) {
    for (const r of q.requirements) {
      if (isCurrencyItem(r.item)) continue;
      const key = resolveStockKey(r.item);
      if (key === null) continue;
      const name = stockNameByKey.get(key);
      const e = out.get(name) ?? { needed: 0, quests: 0 };
      e.needed += openAmount(q, r);
      e.quests += 1;
      out.set(name, e);
    }
  }
  return out;
}

// Pro Reihe wird der Bestand der Reihe nach verbraucht: Jede offene Quest sieht
// nur, was die offenen Quests davor von demselben Gegenstand übrig lassen.
// Die Reihen selbst rechnen unabhängig voneinander mit dem vollen Bestand.
const availableStock = (() => {
  const out = new Map();
  for (const s of series) {
    const used = new Map();
    for (const q of openQuests(s, progress)) {
      q.requirements.forEach((r, i) => {
        const key = resolveStockKey(r.item);
        if (key === null) return;
        const spent = used.get(key) ?? 0;
        const total = stockLookup.get(key);
        out.set(`${q.id}:${i}`, { stock: Math.max(0, total - spent), stockTotal: total });
        used.set(key, spent + openAmount(q, r));
      });
    }
  }
  return out;
})();

// stock = für diese Quest verfügbare Menge, null wenn sie erledigt ist oder der
// Gegenstand nicht im Bestand geführt wird. sent = schon abgegeben, missing = was
// danach noch fehlt (Bedarf minus abgegeben minus Regal).
function requirementStock(quest, i, r) {
  const hit = availableStock.get(`${quest.id}:${i}`);
  const needed = neededAmount(r);
  const sent = sentAmount(quest, r);
  const stock = hit?.stock ?? null;
  return {
    stock,
    stockTotal: hit?.stockTotal ?? null,
    needed,
    sent,
    missing: stock == null ? null : Math.max(0, needed - sent - stock),
  };
}

export function stockTitle(r) {
  const updated = stockData.updatedAt
    ? ` · Stand ${new Date(stockData.updatedAt).toLocaleString('de-DE')}`
    : '';
  const nf = (n) => n.toLocaleString('de-DE');
  const shared =
    r.stock !== r.stockTotal ? ` · Regal gesamt ${nf(r.stockTotal)}, Rest nach früheren Quests der Reihe` : '';
  const sent = r.sent ? `Abgegeben: ${nf(r.sent)} · ` : '';
  const missing = r.missing ? ` · fehlt: ${nf(r.missing)}` : '';
  return `${sent}Verfügbar: ${nf(r.stock)} von ${nf(r.needed)}${missing}${shared}${updated}`;
}

// Berechnet den Shop-Wert einer Quest anhand der benötigten Pflanzen.
// Gibt bei fehlenden Preisen einen Teilwert + Liste fehlender Shop-Items zurück.
export function questShopCost(quest) {
  let total = 0;
  let restTotal = 0;
  let restCount = 0;
  let currencyTotal = 0;
  let shopItemCount = 0;
  let pricedRequirements = 0;
  const missing = new Set();
  const nonShopItems = new Set();
  const requirements = [];

  for (const [i, r] of quest.requirements.entries()) {
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
        stock: null,
      });
      continue;
    }

    if (isCraftOnlyItem(r.item)) {
      nonShopItems.add(r.item);
      requirements.push({
        item: r.item,
        amount: r.amount,
        ...requirementStock(quest, i, r),
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
      const st = requirementStock(quest, i, r);
      // Rest: was nach Abgabe und Regal noch zu kaufen wäre
      if (st.missing != null) {
        restTotal += st.missing * hit.price;
        restCount += 1;
      }

      requirements.push({
        item: r.item,
        amount: r.amount,
        ...st,
        restTotal: st.missing == null ? null : st.missing * hit.price,
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
        ...requirementStock(quest, i, r),
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
    // Restkosten: nur wenn der Bestand für die Quest bekannt ist (offene Quests); restComplete = für alle Posten mit Preis
    restTotal: restCount > 0 ? restTotal : null,
    restComplete: restCount === pricedRequirements && missing.size === 0,
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
