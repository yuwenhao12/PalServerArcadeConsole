import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourceBase = "https://raw.githubusercontent.com/zaigie/palworld-server-tool/main/web/src/assets";
const outputPath = resolve("public/game-data/palworld-zh.json");
const localSourceDir = process.argv[2] ? resolve(process.argv[2]) : null;
const paldbPassivePage = process.env.PALDB_PASSIVE_PAGE ? resolve(process.env.PALDB_PASSIVE_PAGE) : null;
const paldbccDirectory = process.env.PALDBCC_DIR ? resolve(process.env.PALDBCC_DIR) : null;

async function readJson(name) {
  if (localSourceDir) {
    return JSON.parse(await readFile(resolve(localSourceDir, name), "utf8"));
  }

  const response = await fetch(`${sourceBase}/${name}`);
  if (!response.ok) {
    throw new Error(`无法下载 ${name}：${response.status}`);
  }
  return response.json();
}

async function readPassiveStyles() {
  if (!paldbPassivePage) {
    return {};
  }

  const page = await readFile(paldbPassivePage, "utf8");
  const pattern = /<h4[^>]*style="color:([^"]+)"[^>]*>([^<]+)<\/h4>[\s\S]{0,1000}?T_icon_skillstatus_rank_arrow_(\d+)\.webp/g;
  const styles = {};

  for (const match of page.matchAll(pattern)) {
    const [, color, name, arrow] = match;
    styles[name] = {
      color,
      rank: Math.max(1, Number(arrow) - 1),
    };
  }

  return styles;
}

function extractNameMap(page) {
  const pattern = /<div class="flex-grow-1 mx-2">(?:<a\b[^>]*>)?([^<]+)(?:<\/a>)?<div>([^<]+)<\/div>/g;
  return Object.fromEntries(
    [...page.matchAll(pattern)]
      .map(([, name, id]) => [id.trim(), name.trim()])
      .filter(([id, name]) => id && name && /^[A-Za-z0-9_]+$/.test(id)),
  );
}

function extractPalMap(englishPage, chinesePage) {
  const pattern = /<a class="itemname" data-hover="([^"]*)" href="([^"]+)">([^<]+)<\/a>/g;
  const englishRows = [...englishPage.matchAll(pattern)].map(([, hover, href]) => ({ hover, href }));
  const chineseByHref = Object.fromEntries(
    [...chinesePage.matchAll(pattern)].map(([, , href, name]) => [href, name.trim()]),
  );

  return Object.fromEntries(englishRows.flatMap(({ hover, href }) => {
    const match = hover.match(/[?&]s=Pals%2F([^&"]+)/);
    return match && chineseByHref[href] ? [[decodeURIComponent(match[1]), chineseByHref[href]]] : [];
  }));
}

async function readPaldbccSupplement() {
  if (!paldbccDirectory) {
    return { pals: {}, passives: {}, items: {} };
  }

  const [englishPals, chinesePals, chinesePassives, chineseItems] = await Promise.all([
    readFile(resolve(paldbccDirectory, "paldbcc-en-Pals.html"), "utf8"),
    readFile(resolve(paldbccDirectory, "paldbcc-cn-Pals.html"), "utf8"),
    readFile(resolve(paldbccDirectory, "paldbcc-cn-PassiveSkills_Table.html"), "utf8"),
    readFile(resolve(paldbccDirectory, "paldbcc-cn-Items_Table.html"), "utf8"),
  ]);

  return {
    pals: extractPalMap(englishPals, chinesePals),
    passives: extractNameMap(chinesePassives),
    items: extractNameMap(chineseItems),
  };
}

function withNormalizedAliases(values) {
  const result = { ...values };
  for (const [id, value] of Object.entries(values)) {
    const normalized = id.toLowerCase();
    if (!(normalized in result)) {
      result[normalized] = value;
    }
  }
  return result;
}

const [pals, skills, items, passiveStylesByName, paldbccSupplement] = await Promise.all([
  readJson("pal.json"),
  readJson("skill.json"),
  readJson("items.json"),
  readPassiveStyles(),
  readPaldbccSupplement(),
]);

const passiveNames = Object.fromEntries(
  [
    ...Object.entries(skills.zh).map(([id, skill]) => [id, typeof skill === "string" ? skill : skill.name]),
    ...Object.entries(paldbccSupplement.passives),
  ],
);
const itemNames = {
  ...Object.fromEntries(items.zh.filter((item) => item.key && item.name).map((item) => [item.key, item.name])),
  ...paldbccSupplement.items,
};
const itemDescriptions = Object.fromEntries(
  items.zh.filter((item) => item.key && item.description).map((item) => [item.key, item.description]),
);
const itemIcons = Object.fromEntries(
  items.zh.filter((item) => item.key && item.id).map((item) => [item.key, item.id]),
);
const itemIconOverrides = Object.fromEntries([
  ...Array.from({ length: 8 }, (_, index) => [
    `KeySphere_${String(index + 1).padStart(2, "0")}`,
    `keysphere_${String(index + 1).padStart(2, "0")}`,
  ]),
  ["Blueprint_Accessory_CoolResist_1_2", "blueprint"],
  ["Blueprint_Accessory_HeatColdResist_1_2", "blueprint"],
]);

const translations = {
  pals: withNormalizedAliases({
    ...pals.zh,
    ...paldbccSupplement.pals,
  }),
  passives: withNormalizedAliases(passiveNames),
  passiveStyles: withNormalizedAliases(Object.fromEntries(
    Object.entries(passiveNames).flatMap(([id, name]) => passiveStylesByName[name] ? [[id, passiveStylesByName[name]]] : []),
  )),
  items: withNormalizedAliases(itemNames),
  itemDescriptions: withNormalizedAliases(itemDescriptions),
  itemIcons: withNormalizedAliases({
    ...itemIcons,
    ...itemIconOverrides,
  }),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(translations)}\n`, "utf8");
