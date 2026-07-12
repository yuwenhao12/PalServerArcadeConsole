import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, resolve } from "node:path";

const pagesDir = resolve(process.argv[2] || ".");
const outputDir = resolve("public/game-data");
const itemsDir = resolve(outputDir, "items");
const palsDir = resolve(outputDir, "pals");
const basePath = resolve(outputDir, "palworld-zh.json");

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function withNormalizedAliases(values) {
  const result = { ...values };
  for (const [id, value] of Object.entries(values)) {
    const normalized = id.toLowerCase();
    if (!(normalized in result)) result[normalized] = value;
  }
  return result;
}

function extractCatalogEntries(page, category) {
  const pattern = new RegExp(`<a\\b[^>]*data-hover="\\?s=${category}%2F([^"&]+)[^"]*"[^>]*>\\s*<img[^>]*\\ssrc="([^"]+)"`, "g");
  const entries = new Map();

  for (const match of page.matchAll(pattern)) {
    const [, id, imageUrl] = match;
    if (!/^[A-Za-z0-9_]+$/.test(id)) continue;
    const fragment = page.slice(match.index, match.index + 1_500);
    const name = fragment.match(/<a\s+class="itemname"[^>]*>([^<]+)<\/a>/)?.[1];
    if (name) entries.set(id, { name: decodeHtml(name).trim(), imageUrl: decodeHtml(imageUrl) });
  }

  return entries;
}

function extractPassiveEntries(page) {
  const pattern = /<div class="flex-grow-1 mx-2">([^<]+)<div>([^<]+)<\/div><\/div>/g;
  const entries = new Map();

  for (const match of page.matchAll(pattern)) {
    const [, name, id] = match;
    const normalizedId = id.trim();
    if (/^[A-Za-z0-9_]+$/.test(normalizedId)) entries.set(normalizedId, decodeHtml(name).trim());
  }

  return entries;
}

function extractPalEntries(page, knownIdsByHref = new Map()) {
  const pattern = /<a\b([^>]*)\bhref="([^"]+)"[^>]*>\s*<img[^>]*\ssrc="([^"]+)"/g;
  const entries = new Map();
  const idsByHref = new Map();

  for (const match of page.matchAll(pattern)) {
    const [, attributes, href, imageUrl] = match;
    const directId = attributes.match(/\?s=Pals%2F([^"&]+)/)?.[1];
    const id = directId || knownIdsByHref.get(href);
    if (!id || !/^[A-Za-z0-9_]+$/.test(id)) continue;

    const fragment = page.slice(match.index, match.index + 1_500);
    const name = fragment.match(/<a\s+class="itemname"[^>]*>([^<]+)<\/a>/)?.[1];
    if (!name) continue;

    entries.set(id, { name: decodeHtml(name).trim(), imageUrl: decodeHtml(imageUrl) });
    idsByHref.set(href, id);
  }

  return { entries, idsByHref };
}

async function readPage(name) {
  return readFile(resolve(pagesDir, name), "utf8");
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function downloadMissingAssets(entries, icons, targetDir) {
  const downloads = [...entries.entries()]
    .filter(([id, entry]) => entry.imageUrl && !entry.imageUrl.includes("T_icon_unknown"))
    .map(([id, entry]) => ({ id, imageUrl: entry.imageUrl, icon: icons[id] || id.toLowerCase() }))
    .filter(({ icon }) => !/[\\/]/.test(icon));

  const missing = [];
  for (const entry of downloads) {
    if (!(await exists(resolve(targetDir, `${entry.icon}.webp`)))) missing.push(entry);
  }

  let cursor = 0;
  let completed = 0;
  const failures = [];
  const workers = Array.from({ length: 8 }, async () => {
    while (cursor < missing.length) {
      const entry = missing[cursor++];
      try {
        const response = await fetch(entry.imageUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Referer: "https://paldb.cc/cn/Items",
          },
        });
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!response.ok || bytes.length < 128 || bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) {
          throw new Error(`HTTP ${response.status}`);
        }
        await writeFile(resolve(targetDir, `${entry.icon}.webp`), bytes);
        completed += 1;
      } catch (error) {
        failures.push(`${entry.id}: ${error instanceof Error ? error.message : "下载失败"}`);
      }
    }
  });

  await Promise.all(workers);
  return { requested: missing.length, completed, failures };
}

const [base, itemsCn, itemsEn, itemsJa, palsCnPage, palsEnPage, palsJaPage, passivesCn, passivesEn, passivesJa] = await Promise.all([
  readFile(basePath, "utf8").then(JSON.parse),
  readPage("items-cn.html").then((page) => extractCatalogEntries(page, "Items")),
  readPage("items-en.html").then((page) => extractCatalogEntries(page, "Items")),
  readPage("items-ja.html").then((page) => extractCatalogEntries(page, "Items")),
  readPage("pals-cn.html"),
  readPage("pals-en.html"),
  readPage("pals-ja.html"),
  readPage("passives-cn.html").then(extractPassiveEntries),
  readPage("passives-en.html").then(extractPassiveEntries),
  readPage("passives-ja.html").then(extractPassiveEntries),
]);

const palsEnResult = extractPalEntries(palsEnPage);
const palsEn = palsEnResult.entries;
const palsCn = extractPalEntries(palsCnPage, palsEnResult.idsByHref).entries;
const palsJa = extractPalEntries(palsJaPage, palsEnResult.idsByHref).entries;

const itemIcons = { ...base.itemIcons };
for (const [id, entry] of itemsCn) {
  if (!entry.imageUrl.includes("T_icon_unknown") && !itemIcons[id]) itemIcons[id] = id.toLowerCase();
}

const palIcons = { ...base.palIcons };
for (const [id, entry] of palsCn) {
  if (!entry.imageUrl.includes("T_icon_unknown") && !palIcons[id]) palIcons[id] = id.toLowerCase();
}

await Promise.all([mkdir(itemsDir, { recursive: true }), mkdir(palsDir, { recursive: true })]);
const [itemAssets, palAssets] = await Promise.all([
  downloadMissingAssets(itemsCn, itemIcons, itemsDir),
  downloadMissingAssets(palsCn, palIcons, palsDir),
]);

const commonItemNames = {
  "zh-CN": {
    Wood: "木材", Stone: "石头", Fiber: "纤维", PaldiumFragment: "帕鲁矿碎块", Ore: "金属矿石",
    Coal: "煤炭", Sulfur: "硫磺", Ingot: "金属锭", PalMetalIngot: "帕鲁金属锭", CarbonFiber: "碳纤维",
    Leather: "皮革", Cloth: "布", PalCrystal: "帕鲁水晶", HighQualityPalOil: "优质帕鲁油", Bone: "骨头", Horn: "角",
  },
  en: {
    Wood: "Wood", Stone: "Stone", Fiber: "Fiber", PaldiumFragment: "Paldium Fragment", Ore: "Ore",
    Coal: "Coal", Sulfur: "Sulfur", Ingot: "Ingot", PalMetalIngot: "Pal Metal Ingot", CarbonFiber: "Carbon Fiber",
    Leather: "Leather", Cloth: "Cloth", PalCrystal: "Pal Crystal", HighQualityPalOil: "High Quality Pal Oil", Bone: "Bone", Horn: "Horn",
  },
  ja: {
    Wood: "木材", Stone: "石", Fiber: "繊維", PaldiumFragment: "パルジウムの欠片", Ore: "鉱石",
    Coal: "石炭", Sulfur: "硫黄", Ingot: "金属インゴット", PalMetalIngot: "パルメタルインゴット", CarbonFiber: "カーボン繊維",
    Leather: "革", Cloth: "布", PalCrystal: "パルジウム結晶", HighQualityPalOil: "上質なパルオイル", Bone: "骨", Horn: "角",
  },
};

function createLocale(locale, items, pals, passives, includeDescriptions, fallback = null) {
  const chineseFallback = includeDescriptions;
  return {
    pals: withNormalizedAliases({
      ...(chineseFallback ? base.pals : fallback?.pals || {}),
      ...Object.fromEntries([...pals].map(([id, entry]) => [id, entry.name])),
    }),
    palIcons: withNormalizedAliases(palIcons),
    passives: withNormalizedAliases({
      ...(chineseFallback ? base.passives : fallback?.passives || {}),
      ...Object.fromEntries(passives),
    }),
    passiveStyles: base.passiveStyles,
    items: withNormalizedAliases({
      ...(chineseFallback ? base.items : fallback?.items || {}),
      ...commonItemNames[locale],
      ...Object.fromEntries([...items].map(([id, entry]) => [id, entry.name])),
    }),
    itemDescriptions: includeDescriptions ? base.itemDescriptions : {},
    itemIcons: withNormalizedAliases(itemIcons),
  };
}

const english = createLocale("en", itemsEn, palsEn, passivesEn, false);
const locales = {
  "zh-CN": createLocale("zh-CN", itemsCn, palsCn, passivesCn, true),
  en: english,
  ja: createLocale("ja", itemsJa, palsJa, passivesJa, false, english),
};

for (const [locale, data] of Object.entries(locales)) {
  await writeFile(resolve(outputDir, `palworld-${locale}.json`), `${JSON.stringify(data)}\n`, "utf8");
}

console.log(JSON.stringify({
  items: [...itemsCn].length,
  pals: [...palsCn].length,
  passives: [...passivesCn].length,
  assets: { items: itemAssets, pals: palAssets },
  output: Object.fromEntries(Object.keys(locales).map((locale) => [locale, basename(resolve(outputDir, `palworld-${locale}.json`))])),
}, null, 2));
