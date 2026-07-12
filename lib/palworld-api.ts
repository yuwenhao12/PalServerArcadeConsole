import { getAppConfig } from "@/lib/server-config";

export type PalworldAction = "announce" | "save";

export type Player = {
  name?: string;
  accountName?: string;
  playerId?: string;
  userId?: string;
  userid?: string;
  ip?: string;
  ping?: number;
  level?: number;
  location_x?: number;
  location_y?: number;
  location_z?: number;
  building_count?: number;
};

export type Metrics = {
  serverfps?: number;
  currentplayernum?: number;
  serverframetime?: number;
  maxplayernum?: number;
  uptime?: number;
  days?: number;
  palnum?: number;
  palboxnum?: number;
  basecampnum?: number;
};

export type ServerInfo = {
  version?: string;
  servername?: string;
  description?: string;
  worldguid?: string;
};

export type StatusPayload = {
  info: ServerInfo | null;
  players: Player[];
  metrics: Metrics | null;
  settings: Record<string, unknown> | null;
  errors: string[];
};

const ACTION_PATHS: Record<PalworldAction, string> = {
  announce: "/announce",
  save: "/save",
};

function getApiBase() {
  return getAppConfig().palworld.apiUrl.replace(/\/$/, "");
}

function getAuthHeader() {
  const config = getAppConfig();
  const user = config.palworld.apiUser;
  const password = config.palworld.adminPassword;

  if (!password) {
    throw new Error("缺少 Palworld 管理员密码，请在 .env 中配置 PALWORLD_API_PASSWORD。");
  }

  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

export async function palFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: getAuthHeader(),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Palworld API ${path} 返回 ${response.status}${detail ? `：${detail}` : ""}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export async function getServerStatus(): Promise<StatusPayload> {
  const entries = await Promise.allSettled([
    palFetch<ServerInfo>("/info"),
    palFetch<{ players?: Player[] } | Player[]>("/players"),
    palFetch<Metrics>("/metrics"),
    palFetch<Record<string, unknown>>("/settings"),
  ]);

  const errors = entries
    .filter((entry): entry is PromiseRejectedResult => entry.status === "rejected")
    .map((entry) => entry.reason instanceof Error ? entry.reason.message : String(entry.reason));

  const playersResult = entries[1].status === "fulfilled" ? entries[1].value : [];
  const players = Array.isArray(playersResult) ? playersResult : playersResult.players || [];

  return {
    info: entries[0].status === "fulfilled" ? entries[0].value : null,
    players,
    metrics: entries[2].status === "fulfilled" ? entries[2].value : null,
    settings: entries[3].status === "fulfilled" ? entries[3].value : null,
    errors,
  };
}

export async function runAction(action: PalworldAction, payload: Record<string, unknown>) {
  const path = ACTION_PATHS[action];

  if (!path) {
    throw new Error("不支持的 Palworld 操作。");
  }

  // 官方 REST API 的写操作都使用 POST，这里集中校验动作名，避免前端传入任意路径。
  return palFetch<Record<string, unknown>>(path, {
    method: "POST",
    body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : "{}",
  });
}
