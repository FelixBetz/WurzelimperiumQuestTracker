// Einmalige, reproduzierbare Extraktion der Wurzelimperium-Questdaten.
//
// Lädt den Forum-Thread (die Quest-Listen stehen komplett im HTML, nur per
// CSS versteckt), parst alle Questreihen und schreibt sie als statische
// Datei nach src/data/quests.json. Die App selbst lädt danach nur noch
// diese JSON – kein Live-Zugriff aufs Forum zur Laufzeit.
//
// Neu ausführen mit:  npm run extract

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SOURCE = 'https://wurzelforum.wurzelimperium.de/viewtopic.php?t=80445';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/data/quests.json');

// --- Text-Helfer --------------------------------------------------------

const decode = (s) =>
  s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß');

const stripTags = (s) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

const parseGermanInt = (s) => parseInt(s.replace(/\./g, ''), 10);
const parseGermanFloat = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.'));

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// --- Parsing ------------------------------------------------------------

function parseIntro(introHtml) {
  const t = stripTags(introHtml);
  const lvl = t.match(/ab Level\s+(\d+)/i);
  const title = t.match(/ab Level\s+\d+\s*\(([^)]+)\)/i);
  const cd = t.match(/Cooldown\s+beträgt\s+(\d+)\s+Stunden/i);
  const loc = t.match(/\bim\s+([A-ZÄÖÜ][\wäöüÄÖÜß\- ]+?)[\.,]/);
  return {
    minLevel: lvl ? parseInt(lvl[1], 10) : null,
    levelTitle: title ? title[1].trim() : null,
    cooldownHours: cd ? parseInt(cd[1], 10) : /kein[e]? Cooldown/i.test(t) ? 0 : null,
    location: loc ? loc[1].trim() : null,
    premiumOnly: /Premium/i.test(t),
    note: t.slice(0, 240),
  };
}

function parseRequirements(reqText) {
  return reqText
    .split(/\s*,\s*|\s+und\s+/i)
    .map((tok) => tok.trim())
    .filter(Boolean)
    .map((tok) => {
      const m = tok.match(/^([\d.]+)\s+(.+)$/);
      if (m) return { item: m[2].trim(), amount: parseGermanInt(m[1]) };
      return { item: tok, amount: 1 };
    });
}

function parseRewards(rewardText) {
  if (!rewardText) return [];
  return rewardText
    .split(/\s+und\s+/i)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((part) => {
      const t = part.match(/([\d.]+,\d+|\d[\d.]*)\s*wT/i);
      if (t) return { type: 'taler', amount: parseGermanFloat(t[1]) };
      const p = part.match(/([\d.]+)\s*Punkte?/i);
      if (p) return { type: 'punkte', amount: parseGermanInt(p[1]) };
      return { type: 'item', value: part };
    });
}

// Alle Überschriften mit Position und Größe (150% = Top-Level/Gruppe).
function collectHeadings(html) {
  const re = /<strong class="text-strong">([^<]+)<\/strong>/g;
  const headings = [];
  let m;
  while ((m = re.exec(html))) {
    const name = decode(m[1]).trim();
    if (/^Quest\b/.test(name) || /Spoiler/i.test(name) || /^Wenn ihr euch/.test(name)) continue;
    const before = html.slice(Math.max(0, m.index - 90), m.index);
    headings.push({ name, index: m.index, big: /font-size:\s*150%/.test(before) });
  }
  return headings;
}

function parse(html) {
  const headings = collectHeadings(html);
  const marker = 'class="quotecontent"';
  const positions = [];
  for (let i = html.indexOf(marker); i !== -1; i = html.indexOf(marker, i + 1)) positions.push(i);

  const usedIds = new Set();
  const series = [];

  positions.forEach((pos, idx) => {
    const end = idx + 1 < positions.length ? positions[idx + 1] : html.length;
    const seg = html.slice(pos, end);

    const priorHeadings = headings.filter((h) => h.index < pos);
    const name = priorHeadings.length ? priorHeadings[priorHeadings.length - 1].name : `Reihe ${idx + 1}`;
    const lastBig = [...priorHeadings].reverse().find((h) => h.big);
    const group = lastBig && lastBig.name !== name ? lastBig.name : null;

    const introMatch = seg.match(/>\s*([\s\S]*?)<strong class="text-strong">Quest/);
    const intro = introMatch ? parseIntro(introMatch[1]) : {};

    let id = slug(group ? `${group}-${name}` : name);
    while (usedIds.has(id)) id = id + '-x';
    usedIds.add(id);

    const quests = [];
    const qre = /<strong class="text-strong">Quest\s*([0-9]+)\s*:?\s*<\/strong>([\s\S]*?)(?=<strong class="text-strong">Quest|<\/div>|$)/g;
    let m;
    while ((m = qre.exec(seg))) {
      const nr = parseInt(m[1], 10);
      const rem = m[2];
      const rewardSpans = [...rem.matchAll(/<span[^>]*color:[^>]*>([\s\S]*?)<\/span>/gi)].map((x) => x[1]);
      const reqHtml = rem.replace(/<span[^>]*color:[^>]*>[\s\S]*?<\/span>/gi, '');
      let reqText = stripTags(reqHtml).replace(/\s*für\s*$/i, '').trim();
      let rewardText = stripTags(rewardSpans.join(' ')).replace(/^für\s+/i, '').trim();
      if (!rewardText && / für /i.test(reqText)) {
        const i = reqText.toLowerCase().lastIndexOf(' für ');
        rewardText = reqText.slice(i + 5).trim();
        reqText = reqText.slice(0, i).trim();
      }
      quests.push({
        id: `${id}#${nr}`,
        nr,
        requirements: parseRequirements(reqText),
        rewards: parseRewards(rewardText),
        rewardText,
      });
    }

    series.push({
      id,
      name,
      group,
      minLevel: intro.minLevel ?? null,
      levelTitle: intro.levelTitle ?? null,
      location: intro.location ?? null,
      cooldownHours: intro.cooldownHours ?? null,
      premiumOnly: intro.premiumOnly ?? false,
      note: intro.note ?? null,
      quests,
    });
  });

  // Reihen, deren Name selbst als Gruppen-Überschrift dient (z. B.
  // "Kakteenquestreihe": eigene Quest 00 UND Unterreihen), unter diese Gruppe
  // einsortieren. Die id bleibt unverändert (progress.json bleibt kompatibel).
  const groupNames = new Set(series.filter((s) => s.group).map((s) => s.group));
  for (const s of series) {
    if (!s.group && groupNames.has(s.name)) s.group = s.name;
  }

  return series;
}

// --- Ausführung ---------------------------------------------------------

const res = await fetch(SOURCE, { headers: { 'User-Agent': 'Mozilla/5.0 (QuestTracker extractor)' } });
if (!res.ok) throw new Error(`Forum-Abruf fehlgeschlagen: HTTP ${res.status}`);
const html = await res.text();

const series = parse(html);
const totalQuests = series.reduce((n, s) => n + s.quests.length, 0);

const out = {
  generatedAt: new Date().toISOString(),
  source: SOURCE,
  seriesCount: series.length,
  questCount: totalQuests,
  series,
};

await writeFile(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log(`OK: ${series.length} Reihen, ${totalQuests} Quests -> ${OUT}`);
