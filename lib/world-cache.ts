import { execFile } from "node:child_process";
import { mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { getAppConfig } from "@/lib/server-config";

const execFileAsync = promisify(execFile);

export type WorldPlayer = {
  id: string;
  playerId: string;
  instanceId: string;
  name: string;
  level: number | null;
  guildId: string;
  inventoryAvailable: boolean;
  resourceCount: number;
  resources: { id: string; count: number }[];
};

export type WorldPal = {
  id: string;
  name: string;
  species: string;
  level: number | null;
  ownerId: string;
  guildId: string;
  passives: string[];
};

export type WorldBase = {
  id: string;
  name: string;
  guildId: string;
  areaRange: number | null;
  location: { x: number; y: number; z: number } | null;
  workCount: number;
};

export type WorldGuild = {
  id: string;
  name: string;
  type: string;
  memberCount: number;
};

export type WorldCache = {
  version: 1;
  updatedAt: string;
  source: {
    modifiedAt: string;
    size: number;
  };
  summary: {
    players: number;
    pals: number;
    bases: number;
    guilds: number;
    mapObjects: number;
    itemContainers: number;
  };
  players: WorldPlayer[];
  pals: WorldPal[];
  bases: WorldBase[];
  guilds: WorldGuild[];
};

function normalizeWorldCache(value: WorldCache): WorldCache {
  return {
    ...value,
    players: (value.players || []).map((player) => ({
      ...player,
      playerId: player.playerId || player.id,
      instanceId: player.instanceId || "",
      inventoryAvailable: Boolean(player.inventoryAvailable),
      resourceCount: Number.isFinite(player.resourceCount) ? player.resourceCount : 0,
      resources: Array.isArray(player.resources) ? player.resources : [],
    })),
    pals: (value.pals || []).map((pal) => ({
      ...pal,
      passives: Array.isArray(pal.passives) ? pal.passives : [],
    })),
  };
}

export async function readWorldCache(cachePath = getAppConfig().palworld.worldCachePath) {
  try {
    return normalizeWorldCache(JSON.parse(await readFile(cachePath, "utf8")) as WorldCache);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw new Error("世界数据缓存读取失败。");
  }
}

export async function refreshWorldCache() {
  const config = getAppConfig();
  const source = await stat(config.palworld.worldSavePath).catch(() => null);

  if (!source?.isFile()) {
    throw new Error("未找到世界存档，请检查世界存档路径配置。");
  }

  await mkdir(dirname(config.palworld.worldCachePath), { recursive: true });

  try {
    await execFileAsync(process.env.PALWORLD_PYTHON || "python3", [
      join(process.cwd(), "scripts", "build-world-cache.py"),
      "--input",
      config.palworld.worldSavePath,
      "--output",
      config.palworld.worldCachePath,
      "--players-dir",
      config.palworld.playerSavesPath,
    ], {
      cwd: process.cwd(),
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
      env: {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: "1",
        PYTHONIOENCODING: "utf-8",
      },
    });
  } catch {
    throw new Error("世界数据刷新失败，请稍后重试。");
  }

  const cache = await readWorldCache(config.palworld.worldCachePath);
  if (!cache) {
    throw new Error("世界数据刷新未生成可用结果。");
  }

  return cache;
}
