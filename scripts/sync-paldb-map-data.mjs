import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import vm from "node:vm";

const sources = [
  {
    id: "palpagos",
    name: "Palpagos Islands",
    url: "https://paldb.cc/js/map_data_cn.js?_=1783877222",
    page: "https://paldb.cc/cn/Palpagos_Islands",
  },
  {
    id: "worldTree",
    name: "The World Tree",
    url: "https://paldb.cc/js/treemap_data_cn.js?_=1783877222",
    page: "https://paldb.cc/cn/The_World_Tree",
  },
];

function asPoint(value) {
  if (!value || typeof value !== "object") return null;
  const x = Number(value.X ?? value.x);
  const y = Number(value.Y ?? value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function readSandboxedMapData(code) {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${code};this.__paldb={iconLookup,extrasIngame,extras,config,fixedDungeon,regionData};`, sandbox, {
    timeout: 5_000,
  });
  return sandbox.__paldb;
}

function markerLabel(marker, icon) {
  return String(marker.item || marker.comment || icon.label || marker.type || "Unknown");
}

function buildMarkers(mapId, data) {
  const iconLookup = data.iconLookup || {};
  const groups = [
    ["fixed", Array.isArray(data.fixedDungeon) ? data.fixedDungeon : []],
    ["extra", Array.isArray(data.extras) ? data.extras : []],
    ["ingame", Array.isArray(data.extrasIngame) ? data.extrasIngame : []],
    ["region", Array.isArray(data.regionData) ? data.regionData : []],
  ];

  return groups.flatMap(([group, markers]) => markers.map((marker, index) => {
    const type = String(marker.type || "Unknown");
    const icon = iconLookup[type] || {};
    const ipos = asPoint(marker.ipos);

    return {
      id: String(marker.id || `${mapId}-${group}-${index}`),
      map: mapId,
      group,
      type,
      category: String(icon.category || "Other"),
      label: markerLabel(marker, icon),
      comment: marker.comment ? String(marker.comment) : "",
      href: marker.href ? String(marker.href) : "",
      level: Number.isFinite(Number(marker.lv)) ? Number(marker.lv) : null,
      icon: String(marker.fixed_icon || icon.fixed_icon || ""),
      ipos,
    };
  }).filter((marker) => marker.ipos));
}

function buildCategories(markers) {
  const categories = new Map();
  for (const marker of markers) {
    const current = categories.get(marker.category) || { id: marker.category, count: 0, types: new Map() };
    current.count += 1;
    current.types.set(marker.type, (current.types.get(marker.type) || 0) + 1);
    categories.set(marker.category, current);
  }

  return Array.from(categories.values())
    .map((category) => ({
      ...category,
      types: Array.from(category.types.entries())
        .map(([id, count]) => ({ id, count }))
        .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id)),
    }))
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
}

async function main() {
  const maps = [];
  const markers = [];

  for (const source of sources) {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`PalDB map data request failed: ${source.url} ${response.status}`);
    }

    const data = readSandboxedMapData(await response.text());
    const mapMarkers = buildMarkers(source.id, data);
    maps.push({
      id: source.id,
      name: source.name,
      page: source.page,
      markerCount: mapMarkers.length,
      config: data.config,
    });
    markers.push(...mapMarkers);
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      name: "PalDB",
      homepage: "https://paldb.cc/",
      note: "Coordinates and marker labels are extracted from PalDB public map data for in-app filtering and read-only display.",
    },
    maps,
    categories: buildCategories(markers),
    markers,
  };

  const output = join(process.cwd(), "public", "map-data", "paldb-map.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${markers.length} markers to ${output}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
