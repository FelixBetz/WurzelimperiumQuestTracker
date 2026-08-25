import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const questsPath = resolve(root, 'src/data/quests.json');
const shopPath = resolve(root, 'src/data/shopPrices.json');
const outDir = resolve(root, 'reports');
const outMd = resolve(outDir, 'shop-price-coverage.md');
const outJson = resolve(outDir, 'shop-price-coverage.json');

const questsData = JSON.parse(await readFile(questsPath, 'utf8'));
const shopData = JSON.parse(await readFile(shopPath, 'utf8'));

const series = questsData.series ?? [];
const prices = shopData.prices ?? {};
const aliases = shopData.aliases ?? {};

const itemNames = new Set();
for (const s of series) {
  for (const q of s.quests ?? []) {
    for (const r of q.requirements ?? []) itemNames.add(r.item);
  }
}

function isCurrencyItem(name) {
  const raw = String(name ?? '').trim();
  if (/^(wT|Wurzeltaler)$/i.test(raw)) return true;

  const withoutAmount = raw.replace(/^[\d.,]+\s+/, '').trim();
  return /^(wT|Wurzeltaler)$/i.test(withoutAmount);
}

function isCraftOnlyItem(name) {
  return /honig$/i.test(String(name ?? '').trim());
}

function requirementAmountMultiplier(itemName) {
  const raw = String(itemName ?? '').trim();
  if (/^([\d.,]+\s+)?million(?:en)?\b/i.test(raw)) return 1_000_000;
  if (/^([\d.,]+\s+)?milliard(?:e|en)?\b/i.test(raw)) return 1_000_000_000;
  return 1;
}

function canonicalItem(name) {
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
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .replace(/Ae/g, 'A')
    .replace(/Oe/g, 'O')
    .replace(/Ue/g, 'U')
    .replace(/\u00e4/g, 'a')
    .replace(/\u00f6/g, 'o')
    .replace(/\u00fc/g, 'u')
    .replace(/\u00c4/g, 'A')
    .replace(/\u00d6/g, 'O')
    .replace(/\u00dc/g, 'U');
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

  const withoutScale = withoutPrefix.replace(/^million(?:en)?\s+/i, '').trim();
  addNameVariant(out, withoutScale);

  const base = withoutScale.replace(/\s+f\u00fcr\s+.+$/i, '').trim();
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

const shopPriceLookup = (() => {
  const out = new Map();

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

let totalQuests = 0;
let nonCurrencyRequirementRows = 0;
let shopEligibleRequirementRows = 0;
let nonShopExcludedRows = 0;
let matchedRows = 0;

const uniqueItems = new Set();
const uniqueShopEligibleItems = new Set();
const uniqueMatched = new Set();

const missingByItem = new Map();
const mappedByItem = new Map();
const excludedByItem = new Map();

for (const s of series) {
  for (const q of s.quests ?? []) {
    totalQuests += 1;
    for (const r of q.requirements ?? []) {
      if (isCurrencyItem(r.item)) continue;

      nonCurrencyRequirementRows += 1;
      uniqueItems.add(r.item);

      const amount = Number(r.amount ?? 0);
      const scaledAmount = amount * requirementAmountMultiplier(r.item);

      if (isCraftOnlyItem(r.item)) {
        nonShopExcludedRows += 1;
        const cur = excludedByItem.get(r.item) ?? { item: r.item, rows: 0, totalAmount: 0 };
        cur.rows += 1;
        cur.totalAmount += scaledAmount;
        excludedByItem.set(r.item, cur);
        continue;
      }

      shopEligibleRequirementRows += 1;
      uniqueShopEligibleItems.add(r.item);
      const hit = resolveShopPrice(r.item);

      if (hit && typeof hit.price === 'number' && Number.isFinite(hit.price)) {
        matchedRows += 1;
        uniqueMatched.add(r.item);

        const cur = mappedByItem.get(r.item) ?? {
          item: r.item,
          rows: 0,
          totalAmount: 0,
          mappedTo: hit.sourceName,
          unitPrice: hit.price,
        };
        cur.rows += 1;
        cur.totalAmount += scaledAmount;
        mappedByItem.set(r.item, cur);
      } else {
        const cur = missingByItem.get(r.item) ?? { item: r.item, rows: 0, totalAmount: 0 };
        cur.rows += 1;
        cur.totalAmount += scaledAmount;
        missingByItem.set(r.item, cur);
      }
    }
  }
}

const topMissingByRows = [...missingByItem.values()]
  .sort((a, b) => b.rows - a.rows || b.totalAmount - a.totalAmount || a.item.localeCompare(b.item, 'de'))
  .slice(0, 30);

const topMissingByAmount = [...missingByItem.values()]
  .sort((a, b) => b.totalAmount - a.totalAmount || b.rows - a.rows || a.item.localeCompare(b.item, 'de'))
  .slice(0, 30);

const topMappedItemsByRows = [...mappedByItem.values()]
  .sort((a, b) => b.rows - a.rows || b.totalAmount - a.totalAmount || a.item.localeCompare(b.item, 'de'))
  .slice(0, 20);

const topExcludedByRows = [...excludedByItem.values()]
  .sort((a, b) => b.rows - a.rows || b.totalAmount - a.totalAmount || a.item.localeCompare(b.item, 'de'))
  .slice(0, 20);

const rowCoveragePct = shopEligibleRequirementRows
  ? Math.round((matchedRows / shopEligibleRequirementRows) * 10000) / 100
  : 0;
const uniqueCoveragePct = uniqueShopEligibleItems.size
  ? Math.round((uniqueMatched.size / uniqueShopEligibleItems.size) * 10000) / 100
  : 0;

const report = {
  generatedAt: new Date().toISOString(),
  totalQuests,
  nonCurrencyRequirementRows,
  shopEligibleRequirementRows,
  nonShopExcludedRows,
  matchedRows,
  rowCoveragePct,
  uniqueRequirementItems: uniqueItems.size,
  uniqueShopEligibleItems: uniqueShopEligibleItems.size,
  uniqueMatchedItems: uniqueMatched.size,
  uniqueCoveragePct,
  missingUniqueCount: missingByItem.size,
  excludedUniqueCount: excludedByItem.size,
  topExcludedByRows,
  topMissingByRows,
  topMissingByAmount,
  topMappedItemsByRows,
};

await mkdir(outDir, { recursive: true });
await writeFile(outJson, JSON.stringify(report, null, 2) + '\n', 'utf8');

const md = [
  '# Shop Price Coverage Report',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  '## Summary',
  '',
  `- Total quests: ${report.totalQuests}`,
  `- Requirement rows (non-currency): ${report.nonCurrencyRequirementRows}`,
  `- Non-shop rows (excluded, e.g. Honig): ${report.nonShopExcludedRows}`,
  `- Requirement rows (shop-eligible): ${report.shopEligibleRequirementRows}`,
  `- Matched rows: ${report.matchedRows}`,
  `- Row coverage: ${report.rowCoveragePct}%`,
  `- Unique requirement items: ${report.uniqueRequirementItems}`,
  `- Unique shop-eligible items: ${report.uniqueShopEligibleItems}`,
  `- Unique mapped items: ${report.uniqueMatchedItems}`,
  `- Unique coverage: ${report.uniqueCoveragePct}%`,
  `- Unique missing items: ${report.missingUniqueCount}`,
  `- Unique non-shop items (excluded): ${report.excludedUniqueCount}`,
  '',
  '## Excluded Non-Shop Items (e.g. Honig)',
  '',
  '| Item | Rows | Total Amount |',
  '|---|---:|---:|',
  ...report.topExcludedByRows.map((x) => `| ${x.item} | ${x.rows} | ${x.totalAmount} |`),
  '',
  '## Top Missing By Rows',
  '',
  '| Item | Rows | Total Amount |',
  '|---|---:|---:|',
  ...report.topMissingByRows.map((x) => `| ${x.item} | ${x.rows} | ${x.totalAmount} |`),
  '',
  '## Top Missing By Amount',
  '',
  '| Item | Rows | Total Amount |',
  '|---|---:|---:|',
  ...report.topMissingByAmount.map((x) => `| ${x.item} | ${x.rows} | ${x.totalAmount} |`),
  '',
  '## Top Mapped Items By Rows',
  '',
  '| Item | Mapped To | Unit Price | Rows | Total Amount |',
  '|---|---|---:|---:|---:|',
  ...report.topMappedItemsByRows.map(
    (x) => `| ${x.item} | ${x.mappedTo} | ${x.unitPrice} | ${x.rows} | ${x.totalAmount} |`
  ),
  '',
].join('\n');

await writeFile(outMd, md, 'utf8');

console.log(JSON.stringify(report));
console.log(`WROTE ${outJson}`);
console.log(`WROTE ${outMd}`);
