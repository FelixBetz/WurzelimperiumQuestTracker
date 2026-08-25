import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputArg = process.argv[2];
if (!inputArg) {
  console.error('Usage: node scripts/extractShopPricesFromHelp.mjs <path-to-hilfe.html>');
  process.exit(1);
}

const inputPath = resolve(inputArg);
const outputPath = resolve(__dirname, '../src/data/shopPrices.json');

const html = await readFile(inputPath, 'utf8');

let existingAliases = {};
try {
  const prev = JSON.parse(await readFile(outputPath, 'utf8'));
  if (prev && typeof prev.aliases === 'object' && !Array.isArray(prev.aliases)) {
    existingAliases = prev.aliases;
  }
} catch {
  // Erste Generierung oder beschädigtes JSON: dann ohne bestehende Aliases.
}

function decode(text) {
  return text
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß');
}

function stripTags(text) {
  return decode(text.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function parseGermanNumber(text) {
  const m = text.match(/[0-9][0-9.,]*/);
  if (!m) return null;
  const normalized = m[0].replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
const allPlants = [];
const prices = {};

for (const row of rows) {
  const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
  if (cells.length < 2) continue;

  const product = stripTags(cells[0]);
  const purchase = stripTags(cells[1]);

  if (!product || /^Produkt$/i.test(product)) continue;

  allPlants.push(product);

  if (purchase === '-' || purchase === '–') continue;

  const value = parseGermanNumber(purchase);
  if (value != null) prices[product] = value;
}

const sortedPrices = Object.fromEntries(Object.entries(prices).sort((a, b) => a[0].localeCompare(b[0], 'de')));
const plants = [...new Set(allPlants)].sort((a, b) => a.localeCompare(b, 'de'));
const aliases = Object.fromEntries(
  Object.entries(existingAliases)
    .filter(([k, v]) => typeof k === 'string' && (typeof v === 'string' || typeof v === 'number'))
    .sort((a, b) => a[0].localeCompare(b[0], 'de'))
);

const out = {
  source: inputPath,
  parsedAt: new Date().toISOString(),
  totalPlants: plants.length,
  pricedPlants: Object.keys(sortedPrices).length,
  aliases,
  plants,
  prices: sortedPrices,
};

await writeFile(outputPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`OK totalPlants=${out.totalPlants} pricedPlants=${out.pricedPlants} -> ${outputPath}`);
