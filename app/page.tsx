"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { PalworldAction, Player, StatusPayload } from "@/lib/palworld-api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { type Locale, supportedLocales, translate } from "@/lib/i18n";
import {
  Activity,
  Bell,
  Braces,
  ChevronUp,
  CircleUserRound,
  Crosshair,
  Cpu,
  Filter,
  Gamepad2,
  Gauge,
  House,
  Joystick,
  Languages,
  Layers,
  Map,
  MapPin,
  PartyPopper,
  Package,
  PawPrint,
  RefreshCw,
  Save,
  Search,
  Server,
  RotateCw,
  Star,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";

type Notice = {
  tone: "ok" | "warn" | "bad";
  text: string;
};

type ApplyStage = "idle" | "saving" | "restarting" | "waiting" | "complete" | "failed";

const applyStagePresentation: Record<ApplyStage, { label: string; tone: string }> = {
  idle: { label: "等待应用", tone: "bg-white" },
  saving: { label: "正在保存规则", tone: "bg-[#7ee7ff]" },
  restarting: { label: "正在重启服务器", tone: "bg-[#ffe66d]" },
  waiting: { label: "正在等待服务器", tone: "bg-[#ffd2e6]" },
  complete: { label: "应用完成", tone: "bg-[#76f7b1]" },
  failed: { label: "应用未完成", tone: "bg-[#ff8f70]" },
};

const emptyStatus: StatusPayload = {
  info: null,
  players: [],
  metrics: null,
  settings: null,
  errors: [],
};

const tabItems = [
  { value: "console", label: "总览", icon: Gamepad2 },
  { value: "settings", label: "规则面板", icon: Braces },
  { value: "world", label: "世界图鉴", icon: Map },
];

const gameAssetVersion = "20260712-r12";

type SessionInfo = {
  authenticated: boolean;
  config: {
    configPath: string;
    palworldApiUrl: string;
    settingsPath: string;
    dockerContainer: string;
  };
};

type SettingsFilePayload = {
  path: string;
  exists: boolean;
  content: string;
  settings: Record<string, string>;
};

type WorldCache = {
  updatedAt: string;
  summary: {
    players: number;
    pals: number;
    bases: number;
    guilds: number;
    mapObjects: number;
    itemContainers: number;
  };
  players: {
    id: string;
    playerId: string;
    instanceId: string;
    name: string;
    level: number | null;
    guildId: string;
    inventoryAvailable: boolean;
    resourceCount: number;
    resources: { id: string; count: number }[];
  }[];
  pals: { id: string; name: string; species: string; level: number | null; ownerId: string; guildId: string; passives: string[] }[];
  bases: { id: string; name: string; guildId: string; areaRange: number | null; location: { x: number; y: number; z: number } | null; workCount: number }[];
  guilds: { id: string; name: string; type: string; memberCount: number }[];
};

type WorldCachePayload = {
  exists: boolean;
  data: WorldCache | null;
};

type PalworldTranslations = {
  pals: Record<string, string>;
  palIcons: Record<string, string>;
  passives: Record<string, string>;
  passiveStyles: Record<string, { color: string; rank: number }>;
  items: Record<string, string>;
  itemDescriptions: Record<string, string>;
  itemIcons: Record<string, string>;
};

type PalworldMapData = {
  generatedAt: string;
  source: { name: string; homepage: string; note: string };
  maps: {
    id: "palpagos" | "worldTree";
    name: string;
    page: string;
    markerCount: number;
    config: {
      minMapTextureBlockSize: { X: number; Y: number };
      landScapeRealPositionMin: { X: number; Y: number; Z: number };
      landScapeRealPositionMax: { X: number; Y: number; Z: number };
    };
  }[];
  categories: { id: string; count: number; types: { id: string; count: number }[] }[];
  markers: {
    id: string;
    map: "palpagos" | "worldTree";
    group: string;
    type: string;
    category: string;
    label: string;
    comment: string;
    href: string;
    level: number | null;
    icon: string;
    ipos: { x: number; y: number };
  }[];
};

type MapPoint = {
  id: string;
  kind: "resource" | "player" | "base";
  label: string;
  detail: string;
  x: number;
  y: number;
  category: string;
  type: string;
  level?: number | null;
  icon?: string;
};

type FriendlySetting = {
  key: string;
  label: string;
  control: "slider" | "number" | "select" | "boolean";
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  options?: { label: string; value: string }[];
};

const friendlySettingGroups: { title: string; tone: string; fields: FriendlySetting[] }[] = [
  {
    title: "人数与世界",
    tone: "bg-[#d8f7ff]",
    fields: [
      { key: "ServerPlayerMaxNum", label: "最大人数", control: "number", step: 1 },
      { key: "CoopPlayerMaxNum", label: "合作人数", control: "number", step: 1 },
      { key: "GuildPlayerMaxNum", label: "公会人数上限", control: "number", step: 1 },
      { key: "BaseCampMaxNum", label: "总据点上限", control: "number", step: 1 },
      { key: "BaseCampWorkerMaxNum", label: "据点工作帕鲁", control: "number", step: 1 },
      { key: "BaseCampMaxNumInGuild", label: "公会据点上限", control: "number", step: 1 },
      { key: "MaxBuildingLimitNum", label: "建筑数量上限", control: "number", step: 1 },
      { key: "DropItemMaxNum", label: "掉落物上限", control: "number", step: 1 },
      { key: "DropItemAliveMaxHours", label: "掉落保留时间", control: "number", step: 0.5, suffix: "小时" },
    ],
  },
  {
    title: "世界倍率",
    tone: "bg-[#c9f7d9]",
    fields: [
      {
        key: "Difficulty",
        label: "难度",
        control: "select",
        options: [
          { label: "自定义", value: "None" },
          { label: "休闲", value: "Casual" },
          { label: "普通", value: "Normal" },
          { label: "困难", value: "Hard" },
        ],
      },
      { key: "DayTimeSpeedRate", label: "白天速度", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "NightTimeSpeedRate", label: "夜晚速度", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "ExpRate", label: "经验倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "PalCaptureRate", label: "捕获倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "PalSpawnNumRate", label: "帕鲁刷新倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "EnemyDropItemRate", label: "敌人掉落倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "CollectionDropRate", label: "采集掉落倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "CollectionObjectRespawnSpeedRate", label: "资源刷新速度", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "WorkSpeedRate", label: "工作速度", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "PalEggDefaultHatchingTime", label: "孵蛋时间", control: "number", step: 1, suffix: "小时" },
    ],
  },
  {
    title: "玩家与公会",
    tone: "bg-[#ffd2e6]",
    fields: [
      { key: "PlayerDamageRateAttack", label: "玩家攻击倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "PlayerDamageRateDefense", label: "玩家受伤倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "PlayerStomachDecreaceRate", label: "玩家饥饿消耗", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "PlayerStaminaDecreaceRate", label: "玩家耐力消耗", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "PlayerAutoHPRegeneRate", label: "玩家回血倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "PlayerAutoHpRegeneRateInSleep", label: "睡眠回血倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "ItemWeightRate", label: "物品重量倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      {
        key: "DeathPenalty",
        label: "死亡惩罚",
        control: "select",
        options: [
          { label: "无惩罚", value: "None" },
          { label: "掉落物品", value: "Item" },
          { label: "掉落物品和装备", value: "ItemAndEquipment" },
          { label: "全部掉落", value: "All" },
        ],
      },
    ],
  },
  {
    title: "帕鲁与物件",
    tone: "bg-[#efe1ff]",
    fields: [
      { key: "PalDamageRateAttack", label: "帕鲁攻击倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "PalDamageRateDefense", label: "帕鲁受伤倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "PalStomachDecreaceRate", label: "帕鲁饥饿消耗", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "PalStaminaDecreaceRate", label: "帕鲁耐力消耗", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "PalAutoHPRegeneRate", label: "帕鲁回血倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "PalAutoHpRegeneRateInSleep", label: "帕鲁睡眠回血", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "BuildObjectHpRate", label: "建筑血量倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "BuildObjectDamageRate", label: "建筑受伤倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "BuildObjectDeteriorationDamageRate", label: "建筑劣化倍率", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
      { key: "MonsterFarmActionSpeedRate", label: "牧场产出速度", control: "slider", min: 0.1, max: 5, step: 0.1, suffix: "倍" },
    ],
  },
  {
    title: "语音与标识",
    tone: "bg-[#d8f7ff]",
    fields: [
      { key: "bEnableVoiceChat", label: "游戏内语音", control: "boolean" },
      { key: "VoiceChatMaxVolumeDistance", label: "语音全音量距离", control: "slider", min: 1000, max: 10000, step: 500 },
      { key: "VoiceChatZeroVolumeDistance", label: "语音静音距离", control: "slider", min: 3000, max: 30000, step: 1000 },
      { key: "bEnableBuildingPlayerUIdDisplay", label: "显示建筑创建者", control: "boolean" },
    ],
  },
  {
    title: "规则开关",
    tone: "bg-[#fff7d6]",
    fields: [
      { key: "bIsPvP", label: "PVP", control: "boolean" },
      { key: "bHardcore", label: "硬核模式", control: "boolean" },
      { key: "bPalLost", label: "死亡丢失帕鲁", control: "boolean" },
      { key: "bEnablePlayerToPlayerDamage", label: "玩家互伤", control: "boolean" },
      { key: "bEnableFriendlyFire", label: "友军伤害", control: "boolean" },
      { key: "bEnableFastTravel", label: "快速传送", control: "boolean" },
      { key: "bEnableFastTravelOnlyBaseCamp", label: "仅据点传送", control: "boolean" },
      { key: "bIsStartLocationSelectByMap", label: "地图选出生点", control: "boolean" },
      { key: "bExistPlayerAfterLogout", label: "离线保留角色", control: "boolean" },
      { key: "bEnableInvaderEnemy", label: "入侵事件", control: "boolean" },
      { key: "bIsUseBackupSaveData", label: "启用备份存档", control: "boolean" },
      { key: "EnablePredatorBossPal", label: "捕食 Boss", control: "boolean" },
      { key: "bAllowGlobalPalboxExport", label: "全局终端导出", control: "boolean" },
      { key: "bAllowGlobalPalboxImport", label: "全局终端导入", control: "boolean" },
    ],
  },
];

function getSliderValue(value: string | undefined, min: number, max: number) {
  // 配置文件以字符串读取，滑块需要稳定的数值范围。
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.min(Math.max(numericValue, min), max) : 1;
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function formatNumber(value: unknown, suffix = "") {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return `${Math.round(value * 10) / 10}${suffix}`;
}

function formatDuration(seconds: unknown) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return "--";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

const itemNames: Record<string, string> = {
  Wood: "木材",
  Stone: "石头",
  Fiber: "纤维",
  PaldiumFragment: "帕鲁矿碎块",
  Ore: "金属矿石",
  Coal: "煤炭",
  Sulfur: "硫磺",
  Ingot: "金属锭",
  PalMetalIngot: "帕鲁金属锭",
  CarbonFiber: "碳纤维",
  Leather: "皮革",
  Cloth: "布",
  PalCrystal: "帕鲁水晶",
  HighQualityPalOil: "优质帕鲁油",
  Bone: "骨头",
  Horn: "角",
};

function normalizePlayerId(value?: string) {
  return value?.replace(/-/g, "").trim().toLowerCase() || "";
}

function findOnlinePlayer(player: WorldCache["players"][number], livePlayers: Player[]) {
  const playerIds = new Set([player.id, player.playerId, player.instanceId].map(normalizePlayerId).filter(Boolean));

  return livePlayers.find((livePlayer) => {
    const liveIds = [livePlayer.playerId, livePlayer.userId, livePlayer.userid].map(normalizePlayerId);
    return liveIds.some((id) => playerIds.has(id));
  }) || livePlayers.find((livePlayer) => (livePlayer.name || livePlayer.accountName) === player.name) || null;
}

function displayItemName(id: string, translations: PalworldTranslations | null) {
  const translated = translationValue(translations?.items, id);
  if (translated) return translated;
  if (itemNames[id]) return itemNames[id];
  return id.replace(/^Item_/, "").replace(/_/g, " ");
}

function displayPalName(species: string, translations: PalworldTranslations | null) {
  return translationValue(translations?.pals, species) || species;
}

function displayPalIcon(species: string, translations: PalworldTranslations | null) {
  const icon = translationValue(translations?.palIcons, species);
  return icon ? `${icon}.webp` : `${species.toLowerCase()}.png`;
}

function displayPassiveName(passive: string, translations: PalworldTranslations | null) {
  return translationValue(translations?.passives, passive) || passive;
}

function passiveTier(passive: string, translations: PalworldTranslations | null) {
  const rank = translationValue(translations?.passiveStyles, passive)?.rank;
  if (rank) return rank;

  const match = passive.match(/([123])(?:_PAL)?$/);
  return match ? Number(match[1]) : 1;
}

function PassiveBadge({ passive, translations }: { passive: string; translations: PalworldTranslations | null }) {
  const tier = passiveTier(passive, translations);
  const label = displayPassiveName(passive, translations);

  return (
    <span className={`world-passive ${tier > 1 ? `is-tier-${tier}` : ""}`} aria-label={tier > 1 ? `${label}，${tier}级词条` : label}>
      <span className="truncate">{label}</span>
      {tier > 1 ? <span className="world-passive-tier" aria-hidden="true">{Array.from({ length: tier }, (_, index) => <ChevronUp key={index} className="size-3.5" />)}</span> : null}
    </span>
  );
}

function displayItemDescription(id: string, translations: PalworldTranslations | null) {
  return translationValue(translations?.itemDescriptions, id) || "";
}

function displayItemIcon(id: string, translations: PalworldTranslations | null) {
  const icon = translationValue(translations?.itemIcons, id);
  if (icon) return icon;

  // 未单独制图的设计图共用官方蓝图图标。
  if (id.toLowerCase().startsWith("blueprint_")) return "blueprint";

  return id.toLowerCase();
}

function translationValue<T>(values: Record<string, T> | undefined, id: string) {
  return values?.[id] || values?.[id.toLowerCase()];
}

function gameAssetUrl(path: string) {
  return `/game-data/${path}?v=${gameAssetVersion}`;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function projectIngamePosition(ipos: { x: number; y: number }, map: PalworldMapData["maps"][number]) {
  const perPixel = 459;
  const min = map.config.landScapeRealPositionMin;
  const max = map.config.landScapeRealPositionMax;
  const transformX = (max.X - min.X) / perPixel;
  const transformY = (max.Y - min.Y) / perPixel;
  const ingameXStart = 1000 + (-582888 - min.X) / transformX;
  const ingameYStart = 1000 + (-301000 - min.Y) / transformY;
  const scaleX = (ipos.y + ingameXStart) / transformX;
  const scaleY = (ipos.x + ingameYStart) / transformY;

  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) return null;

  return {
    x: clampPercent((1 - scaleX) * 100),
    y: clampPercent(scaleY * 100),
  };
}

function projectRealPosition(position: { x: number; y: number }, map: PalworldMapData["maps"][number]) {
  const min = map.config.landScapeRealPositionMin;
  const max = map.config.landScapeRealPositionMax;
  const scaleX = (position.x - min.X) / (max.X - min.X);
  const scaleY = (position.y - min.Y) / (max.Y - min.Y);

  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX < -0.05 || scaleX > 1.05 || scaleY < -0.05 || scaleY > 1.05) {
    return null;
  }

  return {
    x: clampPercent((1 - scaleX) * 100),
    y: clampPercent(scaleY * 100),
  };
}

function livePlayerLocation(player: Player) {
  const x = Number(player.location_x);
  const y = Number(player.location_y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function WorldAsset({ src, alt, icon: Icon }: { src: string; alt: string; icon: typeof Package }) {
  const [missing, setMissing] = useState(false);

  return (
    <div className="world-asset">
      {missing ? <Icon className="size-5" aria-label={alt} /> : <img src={src} alt={alt} className="world-asset-image" loading="lazy" decoding="async" onError={() => setMissing(true)} />}
    </div>
  );
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `请求失败：${response.status}`);
  }

  return response.json() as Promise<T>;
}

function ArcadeMetric({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Activity;
  tone: "pink" | "yellow" | "cyan" | "mint";
}) {
  return (
    <Card className={`arcade-card arcade-${tone}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-ink">
          <Icon className="size-5" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-heading text-4xl font-black leading-none text-ink">{value}</div>
        <p className="mt-2 text-sm font-bold text-ink/70">{helper}</p>
      </CardContent>
    </Card>
  );
}

function DataLine({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b-3 border-ink/15 py-3 text-sm last:border-b-0">
      <span className="font-heading text-xs font-black uppercase tracking-wide text-ink/55">{label}</span>
      <span className="min-w-0 break-words font-bold text-ink">{String(value ?? "--")}</span>
    </div>
  );
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [status, setStatus] = useState<StatusPayload>(emptyStatus);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [announceMessage, setAnnounceMessage] = useState("");
  const [settingsContent, setSettingsContent] = useState("");
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  const [settingsSnapshot, setSettingsSnapshot] = useState<Record<string, string>>({});
  const [applyStage, setApplyStage] = useState<ApplyStage>("idle");
  const [worldData, setWorldData] = useState<WorldCache | null>(null);
  const [palworldTranslations, setPalworldTranslations] = useState<PalworldTranslations | null>(null);
  const [mapData, setMapData] = useState<PalworldMapData | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<"palpagos" | "worldTree">("palpagos");
  const [worldPanelTab, setWorldPanelTab] = useState<"players" | "map">("players");
  const [mapQuery, setMapQuery] = useState("");
  const [enabledMapCategories, setEnabledMapCategories] = useState<string[]>(["Mine", "Resource", "Locations"]);
  const [showMapPlayers, setShowMapPlayers] = useState(true);
  const [showMapBases, setShowMapBases] = useState(true);
  const [worldLoading, setWorldLoading] = useState(false);
  const [selectedWorldPlayerId, setSelectedWorldPlayerId] = useState<string | null>(null);
  const [playerDetailTab, setPlayerDetailTab] = useState<"pals" | "inventory">("pals");
  const [manualSaveOpen, setManualSaveOpen] = useState(false);
  const t = useCallback((source: string) => translate(locale, source), [locale]);

  useEffect(() => {
    const stored = window.localStorage.getItem("palserver-locale");
    if (stored && supportedLocales.includes(stored as Locale)) setLocale(stored as Locale);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("palserver-locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    readJson<PalworldMapData>("/map-data/paldb-map.json")
      .then((payload) => setMapData(payload))
      .catch(() => setMapData(null));
  }, []);

  const worldPlayers = useMemo(() => {
    if (!worldData) return [];

    return worldData.players
      .map((player) => ({ player, live: findOnlinePlayer(player, status.players) }))
      .sort((left, right) => Number(Boolean(right.live)) - Number(Boolean(left.live)) || left.player.name.localeCompare(right.player.name, locale));
  }, [locale, status.players, worldData]);

  const selectedWorldPlayer = worldPlayers.find(({ player }) => player.id === selectedWorldPlayerId) || null;
  const selectedPlayerPals = useMemo(() => {
    if (!worldData || !selectedWorldPlayer) return [];
    const ids = new Set([selectedWorldPlayer.player.id, selectedWorldPlayer.player.playerId, selectedWorldPlayer.player.instanceId].map(normalizePlayerId).filter(Boolean));
    return worldData.pals.filter((pal) => ids.has(normalizePlayerId(pal.ownerId)));
  }, [selectedWorldPlayer, worldData]);
  const selectedPlayerGuild = useMemo(() => {
    if (!worldData || !selectedWorldPlayer) return null;
    return worldData.guilds.find((guild) => guild.id === selectedWorldPlayer.player.guildId) || null;
  }, [selectedWorldPlayer, worldData]);
  const selectedMap = useMemo(() => mapData?.maps.find((map) => map.id === selectedMapId) || null, [mapData, selectedMapId]);
  const enabledCategorySet = useMemo(() => new Set(enabledMapCategories), [enabledMapCategories]);
  const resourceMapPoints = useMemo<MapPoint[]>(() => {
    if (!mapData || !selectedMap) return [];

    const query = mapQuery.trim().toLowerCase();
    const points: MapPoint[] = [];
    for (const marker of mapData.markers
      .filter((marker) => marker.map === selectedMap.id && enabledCategorySet.has(marker.category))
      .filter((marker) => {
        if (!query) return true;
        return [marker.label, marker.comment, marker.type, marker.category].some((value) => value.toLowerCase().includes(query));
      })) {
      const position = projectIngamePosition(marker.ipos, selectedMap);
      if (!position) continue;

      points.push({
        id: `resource-${marker.id}`,
        kind: "resource",
        label: marker.label,
        detail: [marker.type, marker.comment].filter(Boolean).join(" / "),
        x: position.x,
        y: position.y,
        category: marker.category,
        type: marker.type,
        level: marker.level,
        icon: marker.icon,
      });
      if (points.length >= 850) break;
    }

    return points;
  }, [enabledCategorySet, mapData, mapQuery, selectedMap]);
  const playerMapPoints = useMemo<MapPoint[]>(() => {
    if (!selectedMap || selectedMap.id !== "palpagos" || !showMapPlayers) return [];

    const points: MapPoint[] = [];
    for (const { player, live } of worldPlayers) {
      if (!live) continue;
      const location = livePlayerLocation(live);
      const position = location ? projectRealPosition(location, selectedMap) : null;
      if (!position) continue;

      points.push({
        id: `player-${player.id}`,
        kind: "player",
        label: player.name,
        detail: `${t("在线")} / ${t("等级")} ${live.level ?? player.level ?? "--"}`,
        x: position.x,
        y: position.y,
        category: "Player",
        type: "Player",
        level: live.level ?? player.level,
      });
    }

    return points;
  }, [selectedMap, showMapPlayers, t, worldPlayers]);
  const baseMapPoints = useMemo<MapPoint[]>(() => {
    if (!worldData || !selectedMap || selectedMap.id !== "palpagos" || !showMapBases) return [];

    const points: MapPoint[] = [];
    for (const base of worldData.bases) {
      const position = base.location ? projectRealPosition({ x: base.location.x, y: base.location.y }, selectedMap) : null;
      if (!position) continue;
      const guild = worldData.guilds.find((item) => item.id === base.guildId);

      points.push({
        id: `base-${base.id}`,
        kind: "base",
        label: base.name,
        detail: [guild?.name, `${t("据点工作帕鲁")} ${base.workCount}`].filter(Boolean).join(" / "),
        x: position.x,
        y: position.y,
        category: "Base",
        type: "Base",
      });
    }

    return points;
  }, [selectedMap, showMapBases, t, worldData]);
  const visibleMapPoints = useMemo(() => [...resourceMapPoints, ...baseMapPoints, ...playerMapPoints], [baseMapPoints, playerMapPoints, resourceMapPoints]);
  const toggleMapCategory = useCallback((category: string) => {
    setEnabledMapCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  }, []);
  const selectAllMapCategories = useCallback(() => {
    setEnabledMapCategories(mapData?.categories.map((category) => category.id) || []);
  }, [mapData]);

  useEffect(() => {
    if (!worldPlayers.length) {
      setSelectedWorldPlayerId(null);
      return;
    }

    if (!selectedWorldPlayerId || !worldPlayers.some(({ player }) => player.id === selectedWorldPlayerId)) {
      setSelectedWorldPlayerId(worldPlayers[0].player.id);
    }
  }, [selectedWorldPlayerId, worldPlayers]);

  const refresh = useCallback(async () => {
    if (!session?.authenticated) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const payload = await readJson<StatusPayload>("/api/palworld/status");
      setStatus(payload);
      setNotice(payload.errors.length ? { tone: "warn", text: payload.errors[0] } : null);
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "状态读取失败。" });
    } finally {
      setLoading(false);
    }
  }, [session?.authenticated]);

  useEffect(() => {
    readJson<SessionInfo>("/api/auth/session")
      .then((payload) => {
        setSession(payload);
        if (!payload.authenticated) {
          setLoading(false);
        }
      })
      .catch((error) => {
        setNotice({ tone: "bad", text: error instanceof Error ? error.message : "读取登录状态失败。" });
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!session?.authenticated) return;
    refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const loadWorldCache = useCallback(async () => {
    try {
      const payload = await readJson<WorldCachePayload>("/api/palworld/world");
      setWorldData(payload.data);
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "世界数据读取失败。" });
    }
  }, []);

  useEffect(() => {
    if (!session?.authenticated) return;
    loadWorldCache();
  }, [loadWorldCache, session?.authenticated]);

  useEffect(() => {
    if (!session?.authenticated) return;

    fetch(gameAssetUrl(`palworld-${locale}.json`))
      .then((response) => response.ok ? response.json() : null)
      .then((data: PalworldTranslations | null) => setPalworldTranslations(data))
      .catch(() => setPalworldTranslations(null));
  }, [locale, session?.authenticated]);

  const login = useCallback(async () => {
    try {
      setLoginPending(true);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `登录失败：${response.status}`);
      }

      const payload = await readJson<SessionInfo>("/api/auth/session");
      setSession(payload);
      setNotice(null);
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "登录失败。" });
    } finally {
      setLoginPending(false);
    }
  }, [loginPassword, loginUsername]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession((current) => current ? { ...current, authenticated: false } : null);
    setStatus(emptyStatus);
  }, []);

  const runAction = useCallback(async (action: PalworldAction, payload: Record<string, unknown>, success: string) => {
    try {
      setPending(action);
      await fetch("/api/palworld/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      }).then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || `操作失败：${response.status}`);
        }
      });
      setNotice({ tone: "ok", text: success });
      await refresh();
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "操作失败。" });
    } finally {
      setPending(null);
    }
  }, [refresh]);

  const confirmManualSave = useCallback(async () => {
    setManualSaveOpen(false);
    await runAction("save", {}, "手动存档已完成。");
  }, [runAction]);

  const refreshWorldData = useCallback(async () => {
    try {
      setWorldLoading(true);
      const response = await fetch("/api/palworld/world", { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `世界数据刷新失败：${response.status}`);
      }
      const payload = await response.json() as { data: WorldCache };
      setWorldData(payload.data);
      setNotice({ tone: "ok", text: "世界图鉴已更新。" });
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "世界数据刷新失败。" });
    } finally {
      setWorldLoading(false);
    }
  }, []);

  const loadSettingsFile = useCallback(async (silent = false) => {
    try {
      setPending("settings-file");
      const payload = await readJson<SettingsFilePayload>("/api/palworld/settings-file");
      setSettingsContent(payload.content);
      setSettingsForm(payload.settings || {});
      setSettingsSnapshot(payload.settings || {});
      if (!silent) {
        setNotice(payload.exists ? { tone: "ok", text: "当前规则已载入。" } : { tone: "warn", text: "还没有读取到当前规则。" });
      }
    } catch (error) {
      if (!silent) {
        setNotice({ tone: "bad", text: error instanceof Error ? error.message : "当前规则读取失败。" });
      }
    } finally {
      setPending(null);
    }
  }, []);

  useEffect(() => {
    if (!session?.authenticated) return;
    loadSettingsFile(true);
  }, [loadSettingsFile, session?.authenticated]);

  const waitForServerReady = useCallback(async () => {
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await wait(2000);

      try {
        const payload = await readJson<StatusPayload>("/api/palworld/status");
        const isReady = payload.errors.length === 0 && Boolean(payload.info || payload.metrics || payload.settings);

        if (isReady) {
          setStatus(payload);
          return;
        }
      } catch {
        // 重启期间接口暂不可访问，继续等待下一次状态检查。
      }
    }

    throw new Error("服务器暂未恢复，请稍后查看总览状态。");
  }, []);

  const saveSettingsFile = useCallback(async (restartAfterSave = false) => {
    try {
      if (restartAfterSave) {
        setApplyStage("saving");
      }
      setPending("settings-file-save");
      const response = await fetch("/api/palworld/settings-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: settingsContent, settings: settingsForm }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `规则保存失败：${response.status}`);
      }

      if (restartAfterSave) {
        setApplyStage("restarting");
        setPending("docker-restart");
        const restartResponse = await fetch("/api/palworld/docker/restart", { method: "POST" });

        if (!restartResponse.ok) {
          const data = await restartResponse.json().catch(() => ({}));
          throw new Error(data.message || `规则已保存，但应用失败：${restartResponse.status}`);
        }

        setApplyStage("waiting");
        setPending("server-ready");
        await waitForServerReady();
        setApplyStage("complete");
        setNotice({ tone: "ok", text: "规则已保存，服务器已恢复。" });
      } else {
        setNotice({ tone: "ok", text: "规则已保存。点击应用后会让新规则生效。" });
      }
      await loadSettingsFile();
    } catch (error) {
      if (restartAfterSave) {
        setApplyStage("failed");
      }
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "规则保存失败。" });
    } finally {
      setPending(null);
    }
  }, [loadSettingsFile, settingsContent, settingsForm, waitForServerReady]);

  const resetSettingsForm = useCallback(() => {
    setSettingsForm(settingsSnapshot);
    setNotice({ tone: "ok", text: "已重置为最近一次读取到的配置参数。" });
  }, [settingsSnapshot]);

  const applySettingsFile = useCallback(() => {
    const onlinePlayers = Number(status.metrics?.currentplayernum ?? status.players.length ?? 0);
    if (onlinePlayers > 0 && !window.confirm(`当前有 ${onlinePlayers} 名玩家在线。应用规则会让服务器重启并断开连接，确认继续？`)) {
      return;
    }

    saveSettingsFile(true);
  }, [saveSettingsFile, status.metrics?.currentplayernum, status.players.length]);

  const apiOnline = status.errors.length === 0 && Boolean(status.info || status.metrics || status.settings);
  const applyStatus = { ...applyStagePresentation[applyStage], label: t(applyStagePresentation[applyStage].label) };
  const metrics = status.metrics || {};

  const metricTiles = useMemo(() => [
    {
      label: t("服务器 FPS"),
      value: formatNumber(metrics.serverfps),
      helper: t("运行帧率"),
      icon: Gauge,
      tone: "mint" as const,
    },
    {
      label: t("在线玩家"),
      value: `${metrics.currentplayernum ?? status.players.length}/${metrics.maxplayernum ?? "?"}`,
      helper: t("当前大厅人数"),
      icon: Users,
      tone: "cyan" as const,
    },
    {
      label: t("帧时间"),
      value: formatNumber(metrics.serverframetime, "ms"),
      helper: t("模拟开销"),
      icon: Cpu,
      tone: "yellow" as const,
    },
    {
      label: t("运行时长"),
      value: formatDuration(metrics.uptime),
      helper: t("本轮开服时间"),
      icon: Activity,
      tone: "pink" as const,
    },
  ], [metrics, status.players.length, t]);

  if (!session?.authenticated) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
        <div className="arcade-shell flex min-h-screen items-center justify-center">
          <Card className="arcade-card w-full max-w-xl bg-[#fff7d6]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-3xl font-black text-ink">
                <Joystick className="size-7" />
                PalServer Arcade Console
              </CardTitle>
              <CardDescription className="font-bold text-ink/65">
                {t("使用部署配置文件中的 WebUI 账号和密码登录。")}
              </CardDescription>
              <Select value={locale} onValueChange={(value) => value && setLocale(value as Locale)}>
                <SelectTrigger aria-label="Language" className="arcade-button mt-2 w-full bg-white px-3 sm:w-44">
                  <Languages className="size-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[14px] border-3 border-ink bg-[#fffdf5] p-1 font-heading font-black text-ink shadow-hard">
                  <SelectItem value="zh-CN">简体中文</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {notice ? (
                <Alert className="mb-4 border-3 border-ink bg-[#ff8f70] text-ink shadow-chip">
                  <Star className="size-5" />
                  <AlertTitle className="font-heading font-black">{t("登录提示")}</AlertTitle>
                  <AlertDescription className="font-bold">{notice.text}</AlertDescription>
                </Alert>
              ) : null}
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  login();
                }}
              >
                <div className="grid gap-2">
                  <Label htmlFor="login-username" className="font-heading text-base font-black text-ink">{t("账号")}</Label>
                  <Input
                    id="login-username"
                    value={loginUsername}
                    onChange={(event) => setLoginUsername(event.target.value)}
                    autoComplete="username"
                    className="rounded-[18px] border-3 border-ink bg-white font-black text-ink shadow-chip"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="login-password" className="font-heading text-base font-black text-ink">{t("密码")}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    autoComplete="current-password"
                    className="rounded-[18px] border-3 border-ink bg-white font-black text-ink shadow-chip"
                  />
                </div>
                <Button className="arcade-button w-full bg-[#76f7b1]" type="submit" disabled={loginPending || !loginUsername || !loginPassword}>
                  <Gamepad2 />
                  {t("登录控制台")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <AlertDialog.Root open={manualSaveOpen} onOpenChange={setManualSaveOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-[2px] transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 border-3 border-ink bg-[#fff7d6] p-5 shadow-hard transition-[scale,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="flex items-start gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center border-3 border-ink bg-[#76f7b1] shadow-chip">
                <Save className="size-6" />
              </div>
              <div>
                <AlertDialog.Title className="font-heading text-2xl font-black text-ink">{t("手动存档")}</AlertDialog.Title>
                <AlertDialog.Description className="mt-1 font-bold leading-6 text-ink/70">{t("立即保存当前世界进度。")}</AlertDialog.Description>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialog.Close className="arcade-button min-h-10 border-2 border-ink bg-white px-4 font-heading font-black text-ink">{t("取消")}</AlertDialog.Close>
              <button type="button" className="arcade-button min-h-10 border-2 border-ink bg-[#76f7b1] px-4 font-heading font-black text-ink" onClick={confirmManualSave}>
                <Save className="size-4" />
                {t("确认存档")}
              </button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
      <div className="arcade-shell flex min-w-0 flex-col gap-5">
        <header className="arcade-hero relative overflow-hidden rounded-[26px] border-3 border-ink bg-[#ffe66d] p-4 shadow-hard sm:p-6">
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="font-heading text-3xl font-black leading-none tracking-tight text-ink sm:text-5xl">
                PalServer Arcade Console
              </h1>
            </div>
            <div className="arcade-hero-actions">
              <Select value={locale} onValueChange={(value) => value && setLocale(value as Locale)}>
                <SelectTrigger aria-label="Language" className="arcade-button min-w-0 bg-white px-3">
                  <Languages className="size-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[14px] border-3 border-ink bg-[#fffdf5] p-1 font-heading font-black text-ink shadow-hard">
                  <SelectItem value="zh-CN">简体中文</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                </SelectContent>
              </Select>
              <Button className="arcade-button bg-[#7ee7ff]" onClick={refresh} disabled={loading} title={t("刷新")}>
                <RefreshCw className={loading ? "animate-spin" : ""} />
                {t("刷新")}
              </Button>
              <Button className="arcade-button bg-[#76f7b1]" onClick={() => setManualSaveOpen(true)} disabled={pending === "save"} title={t("手动存档")}>
                <Save />
                {t("手动存档")}
              </Button>
              <Button className="arcade-button bg-[#ffd2e6]" onClick={logout} title={t("退出")}>
                {t("退出")}
              </Button>
            </div>
          </div>
        </header>

        {notice ? (
          <Alert className={
            notice.tone === "bad"
              ? "border-4 border-ink bg-[#ff8f70] text-ink shadow-hard"
              : notice.tone === "warn"
                ? "border-4 border-ink bg-[#ffe66d] text-ink shadow-hard"
                : "border-4 border-ink bg-[#76f7b1] text-ink shadow-hard"
          }>
            <Star className="size-5" />
            <AlertTitle className="font-heading text-lg font-black">{notice.tone === "bad" ? t("连接失败") : notice.tone === "warn" ? t("有个小提示") : t("操作成功")}</AlertTitle>
            <AlertDescription className="break-words font-bold">{notice.text}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs defaultValue="console" className="arcade-tabs-root">
          <TabsList className="arcade-tabs-list">
            {tabItems.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="arcade-tab"
                >
                  <Icon className="size-5" />
                  {t(item.label)}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="console" className="space-y-5">
            <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metricTiles.map((tile) => (
                <ArcadeMetric key={tile.label} {...tile} />
              ))}
            </section>

            <section className="grid min-w-0 gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <Card className="arcade-card bg-[#fff7d6]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-heading text-2xl font-black text-ink">
                    <Server className="size-6" />
                    {t("服务器摘要")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-[22px] border-4 border-ink bg-white px-4 shadow-chip">
                    <DataLine label={t("状态")} value={apiOnline ? t("已连接") : t("未就绪")} />
                    <DataLine label={t("服务器")} value={status.info?.servername} />
                    <DataLine label={t("版本")} value={status.info?.version} />
                    <DataLine label={t("世界天数")} value={metrics.days} />
                    <DataLine label={t("据点数量")} value={metrics.basecampnum} />
                  </div>
                </CardContent>
              </Card>

              <Card className="arcade-card bg-[#ffd2e6]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-heading text-2xl font-black text-ink">
                    <PartyPopper className="size-6" />
                    {t("全服广播")}
                  </CardTitle>
              </CardHeader>
                <CardContent className="space-y-3">
                  <Label htmlFor="announce-message" className="font-heading text-base font-black text-ink">{t("公告内容")}</Label>
                  <Textarea
                    id="announce-message"
                    value={announceMessage}
                    onChange={(event) => setAnnounceMessage(event.target.value)}
                    placeholder={t("服务器将在 10 分钟后维护。")}
                    className="min-h-28 rounded-[18px] border-4 border-ink bg-white font-bold text-ink shadow-chip"
                  />
                  <Button
                    className="arcade-button w-full bg-[#ff5fa2]"
                    disabled={!announceMessage.trim() || pending === "announce"}
                    onClick={() => runAction("announce", { message: announceMessage.trim() }, "公告已发送。")}
                  >
                    <Bell />
                    {t("发送公告")}
                  </Button>
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="settings">
            <section className="grid min-w-0 gap-5">
              <Card className="arcade-card bg-[#fff0b8]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-heading text-2xl font-black text-ink">
                    <Braces className="size-6" />
                    {t("规则面板")}
                  </CardTitle>
                  <CardAction className="flex max-w-full flex-col items-end gap-2">
                    <div className={`flex min-h-9 items-center gap-2 rounded-[12px] border-2 border-ink px-3 shadow-chip ${applyStatus.tone}`} aria-live="polite">
                      <span className={`size-2.5 rounded-full bg-ink ${applyStage === "saving" || applyStage === "restarting" || applyStage === "waiting" ? "animate-pulse" : ""}`} />
                      <span className="font-heading text-xs font-black text-ink">{applyStatus.label}</span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        className="arcade-button bg-[#7ee7ff]"
                        onClick={resetSettingsForm}
                        disabled={!Object.keys(settingsSnapshot).length || pending === "settings-file"}
                        title="恢复为当前规则"
                      >
                        <RefreshCw />
                        {t("重置")}
                      </Button>
                      <Button
                        className="arcade-button bg-[#76f7b1]"
                        onClick={() => saveSettingsFile(false)}
                        disabled={!settingsContent.trim() || pending === "settings-file-save"}
                        title="保存规则"
                      >
                        <Save />
                        {t("保存")}
                      </Button>
                      <Button
                        className="arcade-button bg-[#ffe66d]"
                        onClick={applySettingsFile}
                        disabled={!settingsContent.trim() || pending === "settings-file-save" || pending === "docker-restart" || pending === "server-ready" || !session.config.dockerContainer}
                        title="保存并应用规则"
                      >
                        <RotateCw className={pending === "docker-restart" || pending === "server-ready" ? "animate-spin" : ""} />
                        {t("应用")}
                      </Button>
                    </div>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4">
                    {friendlySettingGroups.map((group) => (
                      <section key={group.title} className={`rounded-[22px] border-3 border-ink p-3 shadow-chip ${group.tone}`}>
                        <div className="mb-3 flex items-center gap-2 font-heading text-lg font-black text-ink">
                          <Joystick className="size-5" />
                          {t(group.title)}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {group.fields.map((field) => {
                            const value = settingsForm[field.key] ?? "";
                            const updateValue = (nextValue: string) => setSettingsForm((current) => {
                              const nextDistance = Number(nextValue);

                              if (field.key === "VoiceChatMaxVolumeDistance") {
                                const zeroDistance = Number(current.VoiceChatZeroVolumeDistance);
                                const nextZeroDistance = Number.isFinite(nextDistance) && (!Number.isFinite(zeroDistance) || zeroDistance <= nextDistance)
                                  ? Math.min(30000, Math.max(3000, nextDistance + 1000))
                                  : zeroDistance;

                                return {
                                  ...current,
                                  [field.key]: nextValue,
                                  ...(Number.isFinite(nextZeroDistance) ? { VoiceChatZeroVolumeDistance: String(nextZeroDistance) } : {}),
                                };
                              }

                              if (field.key === "VoiceChatZeroVolumeDistance") {
                                const maxDistance = Number(current.VoiceChatMaxVolumeDistance);
                                const nextMaxDistance = Number.isFinite(nextDistance) && Number.isFinite(maxDistance) && nextDistance <= maxDistance
                                  ? Math.max(1000, Math.min(10000, nextDistance - 1000))
                                  : maxDistance;

                                return {
                                  ...current,
                                  [field.key]: nextValue,
                                  ...(Number.isFinite(nextMaxDistance) ? { VoiceChatMaxVolumeDistance: String(nextMaxDistance) } : {}),
                                };
                              }

                              return { ...current, [field.key]: nextValue };
                            });

                            return (
                              <div key={field.key} className="rounded-[18px] border-3 border-ink bg-white p-3 shadow-chip">
                                <div className="flex min-h-7 items-center justify-between gap-3">
                                  <Label htmlFor={`setting-${field.key}`} className="font-heading text-sm font-black text-ink">
                                    {t(field.label)}
                                  </Label>
                                  {field.control === "boolean" && (
                                    <span className="font-heading text-xs font-black text-ink/60">{value === "True" ? t("开启") : t("关闭")}</span>
                                  )}
                                </div>

                                {field.control === "slider" ? (
                                  <div className="mt-3">
                                    <div className="flex items-center gap-3">
                                      <Slider
                                        id={`setting-${field.key}`}
                                        min={field.min}
                                        max={field.max}
                                        step={field.step}
                                        value={[getSliderValue(value, field.min ?? 0.1, field.max ?? 5)]}
                                        onValueChange={(nextValue) => updateValue(String(Array.isArray(nextValue) ? nextValue[0] : nextValue))}
                                        className="arcade-rule-slider flex-1"
                                      />
                                      <div className="relative w-24 shrink-0">
                                        <Input
                                          aria-label={`${t(field.label)} value`}
                                          type="number"
                                          min={field.min}
                                          max={field.max}
                                          step={field.step}
                                          value={value}
                                          onChange={(event) => updateValue(event.target.value)}
                                          className="h-10 rounded-[12px] border-2 border-ink bg-[#fff7d6] pr-7 text-center font-heading font-black text-ink"
                                        />
                                        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs font-black text-ink/60">{field.suffix ? t(field.suffix) : ""}</span>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex justify-between font-heading text-[11px] font-black text-ink/50">
                                      <span>{field.min}{field.suffix ? t(field.suffix) : ""}</span>
                                      <span>{field.max}{field.suffix ? t(field.suffix) : ""}</span>
                                    </div>
                                  </div>
                                ) : field.control === "select" ? (
                                  <Select value={value || field.options?.[0]?.value} onValueChange={(nextValue) => nextValue && updateValue(nextValue)}>
                                    <SelectTrigger id={`setting-${field.key}`} className="mt-3 h-11 w-full rounded-[14px] border-3 border-ink bg-[#fff7d6] px-3 font-heading font-black text-ink shadow-chip">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-[14px] border-3 border-ink bg-[#fffdf5] p-1 font-heading font-black text-ink shadow-hard">
                                      {field.options?.map((option) => (
                                        <SelectItem key={option.value} value={option.value} className="rounded-[9px] px-3 py-2 focus:bg-[#ffe66d] focus:text-ink">
                                          {t(option.label)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : field.control === "boolean" ? (
                                  <div className="mt-3 flex h-11 items-center justify-between rounded-[14px] border-3 border-ink bg-[#fff7d6] px-3">
                                    <span className="font-heading text-sm font-black text-ink/75">{value === "True" ? t("正在使用") : t("未启用")}</span>
                                    <Switch
                                      id={`setting-${field.key}`}
                                      checked={value === "True"}
                                      onCheckedChange={(checked) => updateValue(checked ? "True" : "False")}
                                      className="!h-7 !w-12 border-2 border-ink bg-[#d6c5a1] data-checked:bg-[#76f7b1] [&_[data-slot=switch-thumb]]:size-5 [&_[data-slot=switch-thumb]]:border-2 [&_[data-slot=switch-thumb]]:border-ink [&_[data-slot=switch-thumb]]:bg-white"
                                    />
                                  </div>
                                ) : (
                                  <div className="relative mt-3">
                                    <Input
                                      id={`setting-${field.key}`}
                                      type="number"
                                      inputMode="decimal"
                                      step={field.step ?? 1}
                                      value={value}
                                      onChange={(event) => updateValue(event.target.value)}
                                      className="h-11 rounded-[14px] border-3 border-ink bg-[#fff7d6] pr-14 font-heading font-black text-ink"
                                    />
                                    {field.suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm font-black text-ink/60">{t(field.suffix)}</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="world">
            <Card className="arcade-card bg-[#d8f7ff]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-heading text-2xl font-black text-ink">
                  <Map className="size-6" />
                  {t("世界图鉴")}
                </CardTitle>
                <CardAction>
                  <Button className="arcade-button bg-[#76f7b1]" onClick={refreshWorldData} disabled={worldLoading} title="刷新世界图鉴">
                    <RefreshCw className={worldLoading ? "animate-spin" : ""} />
                    {t("刷新世界")}
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-5">
                {!worldData ? (
                  <div className="flex min-h-72 flex-col items-center justify-center gap-3 border-3 border-dashed border-ink/45 bg-white/65 px-5 text-center">
                    <Map className="size-10 text-ink/55" />
                    <div className="font-heading text-xl font-black text-ink">{t("还没有世界记录")}</div>
                    <p className="font-bold text-ink/65">{t("刷新后即可查看世界状态。")}</p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        [t("玩家"), worldData.summary.players, "bg-[#ffe66d]"],
                        [t("在线"), worldPlayers.filter(({ live }) => live).length, "bg-[#76f7b1]"],
                        [t("帕鲁"), worldData.summary.pals, "bg-[#76f7b1]"],
                        [t("背包物品"), worldData.players.reduce((total, player) => total + (player.resourceCount || 0), 0), "bg-[#7ee7ff]"],
                      ].map(([label, value, tone]) => (
                        <div key={label as string} className={`min-w-0 border-3 border-ink px-3 py-4 shadow-chip ${tone}`}>
                          <div className="font-heading text-xs font-black text-ink/60">{label}</div>
                          <div className="mt-1 font-heading text-3xl font-black text-ink">{value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-y-3 border-ink/15 py-3 font-bold text-ink/65">
                      <span>{t("最近更新")}</span>
                      <span>{new Date(worldData.updatedAt).toLocaleString(locale)}</span>
                    </div>

                    <Tabs value={worldPanelTab} onValueChange={(value) => setWorldPanelTab(value as "players" | "map")} className="world-panel-tabs">
                      <TabsList className="world-panel-tabs-list">
                        <TabsTrigger value="players" className="world-detail-tab"><Users className="size-5" />{t("玩家图鉴")}</TabsTrigger>
                        <TabsTrigger value="map" className="world-detail-tab"><Layers className="size-5" />{t("资源地图")}</TabsTrigger>
                      </TabsList>

                      <TabsContent value="players" className="world-panel-content">
                        <div className="world-atlas-workspace">
                          <aside className="world-player-rail">
                        <div className="world-player-rail-header">
                          <div className="flex items-center gap-2 font-heading text-lg font-black text-ink">
                            <Users className="size-5" />
                            {t("玩家列表")}
                          </div>
                          <span className="font-heading text-sm font-black text-ink/60">{worldPlayers.length}</span>
                        </div>
                        {worldPlayers.length === 0 ? (
                          <div className="flex min-h-52 items-center justify-center px-5 text-center font-bold text-ink/60">{t("暂无玩家记录。")}</div>
                        ) : (
                          <ScrollArea className="world-player-scroll">
                            <div className="grid gap-2 p-3">
                              {worldPlayers.map(({ player, live }) => {
                                const selected = selectedWorldPlayerId === player.id;
                                const palCount = worldData.pals.filter((pal) => [player.id, player.playerId, player.instanceId].map(normalizePlayerId).includes(normalizePlayerId(pal.ownerId))).length;
                                return (
                                  <button
                                    key={player.id}
                                    type="button"
                                    onClick={() => setSelectedWorldPlayerId(player.id)}
                                    className={`world-player-item ${selected ? "is-selected" : ""}`}
                                    aria-pressed={selected}
                                  >
                                    <span className="flex min-w-0 items-center gap-2">
                                      <span className={`world-player-state ${live ? "is-online" : ""}`} aria-label={live ? t("在线") : t("离线")} />
                                      <span className="min-w-0">
                                        <span className="block truncate font-heading text-base font-black text-ink">{player.name}</span>
                                        <span className="mt-0.5 block text-xs font-bold text-ink/60">{t("等级")} {live?.level ?? player.level ?? "--"}</span>
                                      </span>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-1 font-heading text-xs font-black text-ink/65"><PawPrint className="size-3.5" />{palCount}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        )}
                      </aside>

                      <section className="world-player-detail">
                        {!selectedWorldPlayer ? (
                          <div className="flex min-h-96 flex-col items-center justify-center gap-3 border-3 border-dashed border-ink/40 bg-white/60 px-5 text-center">
                            <CircleUserRound className="size-10 text-ink/55" />
                            <div className="font-heading text-xl font-black text-ink">{t("选择一位玩家")}</div>
                          </div>
                        ) : (
                          <>
                            <header className="world-player-detail-header">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex size-12 shrink-0 items-center justify-center border-3 border-ink bg-[#7ee7ff] shadow-chip">
                                  <CircleUserRound className="size-7" />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="truncate font-heading text-2xl font-black text-ink">{selectedWorldPlayer.player.name}</h3>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-bold text-ink/65">
                                    <span className={`world-detail-state ${selectedWorldPlayer.live ? "is-online" : ""}`}>{selectedWorldPlayer.live ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}{selectedWorldPlayer.live ? t("在线") : t("离线")}</span>
                                    <span>{t("等级")} {selectedWorldPlayer.live?.level ?? selectedWorldPlayer.player.level ?? "--"}</span>
                                    <span>{selectedPlayerGuild?.name || t("暂无组织")}</span>
                                  </div>
                                </div>
                              </div>
                              {selectedWorldPlayer.live?.ping !== undefined ? <span className="shrink-0 border-2 border-ink bg-white px-3 py-1 font-heading text-sm font-black text-ink">{selectedWorldPlayer.live.ping} ms</span> : null}
                            </header>

                            <Tabs value={playerDetailTab} onValueChange={(value) => setPlayerDetailTab(value as "pals" | "inventory")} className="world-detail-tabs">
                              <TabsList className="world-detail-tabs-list">
                                <TabsTrigger value="pals" className="world-detail-tab"><PawPrint className="size-5" />{t("帕鲁")} <span>{selectedPlayerPals.length}</span></TabsTrigger>
                                <TabsTrigger value="inventory" className="world-detail-tab"><Package className="size-5" />{t("背包")} <span>{selectedWorldPlayer.player.resourceCount || 0}</span></TabsTrigger>
                              </TabsList>

                              <TabsContent value="pals" className="world-detail-content">
                                {selectedPlayerPals.length === 0 ? (
                                  <div className="world-detail-empty"><PawPrint className="size-8" />{t("暂未找到已归属的帕鲁。")}</div>
                                ) : (
                                  <ScrollArea className="world-detail-scroll">
                                    <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
                                      {selectedPlayerPals.map((pal) => (
                                        <article key={pal.id} className="world-pal-item">
                                          <div className="flex items-start gap-3">
                                            <WorldAsset src={gameAssetUrl(`pals/${displayPalIcon(pal.species, palworldTranslations)}`)} alt={displayPalName(pal.species, palworldTranslations)} icon={PawPrint} />
                                            <div className="min-w-0">
                                              <div className="truncate font-heading font-black text-ink">{pal.name === pal.species ? displayPalName(pal.species, palworldTranslations) : pal.name}</div>
                                              <div className="truncate text-sm font-bold text-ink/65">{pal.name === pal.species ? pal.species : displayPalName(pal.species, palworldTranslations)}</div>
                                            </div>
                                            <span className="ml-auto shrink-0 font-heading text-sm font-black text-ink">Lv.{pal.level ?? "--"}</span>
                                          </div>
                                          {pal.passives?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{pal.passives.map((passive) => <PassiveBadge key={passive} passive={passive} translations={palworldTranslations} />)}</div> : null}
                                        </article>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                )}
                              </TabsContent>

                              <TabsContent value="inventory" className="world-detail-content">
                                {!selectedWorldPlayer.player.inventoryAvailable ? (
                                  <div className="world-detail-empty"><Package className="size-8" />{t("未找到该玩家的个人存档。")}</div>
                                ) : !selectedWorldPlayer.player.resources?.length ? (
                                  <div className="world-detail-empty"><Package className="size-8" />{t("背包中暂时没有可统计的物品。")}</div>
                                ) : (
                                  <ScrollArea className="world-detail-scroll">
                                    <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
                                      {selectedWorldPlayer.player.resources.map((resource) => (
                                        <div key={resource.id} className="world-inventory-item">
                                          <WorldAsset src={gameAssetUrl(`items/${displayItemIcon(resource.id, palworldTranslations)}.webp`)} alt={displayItemName(resource.id, palworldTranslations)} icon={Package} />
                                          <span className="min-w-0 flex-1">
                                            <span className="block truncate font-heading font-black text-ink">{displayItemName(resource.id, palworldTranslations)}</span>
                                            {displayItemDescription(resource.id, palworldTranslations) ? <span className="block truncate text-xs font-bold text-ink/55">{displayItemDescription(resource.id, palworldTranslations)}</span> : null}
                                          </span>
                                          <span className="shrink-0 font-heading text-xl font-black text-ink">{resource.count}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                )}
                              </TabsContent>
                          </Tabs>
                        </>
                      )}
                          </section>
                        </div>
                      </TabsContent>

                      <TabsContent value="map" className="world-panel-content">
                        <div className="world-map-workspace">
                          <aside className="world-map-filter">
                            <div className="world-player-rail-header">
                              <div className="flex items-center gap-2 font-heading text-lg font-black text-ink">
                                <Filter className="size-5" />
                                {t("地图过滤")}
                              </div>
                              <span className="font-heading text-sm font-black text-ink/60">{visibleMapPoints.length}</span>
                            </div>
                            <div className="grid gap-3 p-3">
                              <div className="grid grid-cols-2 gap-2">
                                {(mapData?.maps || []).map((map) => (
                                  <button
                                    key={map.id}
                                    type="button"
                                    className={`world-map-chip ${selectedMapId === map.id ? "is-selected" : ""}`}
                                    onClick={() => setSelectedMapId(map.id)}
                                  >
                                    {map.id === "palpagos" ? t("帕鲁帕戈斯群岛") : t("世界树")}
                                  </button>
                                ))}
                              </div>
                              <label className="world-map-search">
                                <Search className="size-4" />
                                <Input value={mapQuery} onChange={(event) => setMapQuery(event.target.value)} placeholder={t("搜索点位")} className="border-0 bg-transparent p-0 font-bold shadow-none focus-visible:ring-0" />
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                <button type="button" className="world-map-chip" onClick={selectAllMapCategories}>{t("全选")}</button>
                                <button type="button" className="world-map-chip" onClick={() => setEnabledMapCategories([])}>{t("清空")}</button>
                              </div>
                              <div className="grid gap-2">
                                {(mapData?.categories || []).map((category) => (
                                  <label key={category.id} className="world-map-toggle">
                                    <input type="checkbox" checked={enabledCategorySet.has(category.id)} onChange={() => toggleMapCategory(category.id)} />
                                    <span>{t(category.id)}</span>
                                    <em>{category.count}</em>
                                  </label>
                                ))}
                              </div>
                              <div className="grid gap-2 border-t-3 border-ink/15 pt-3">
                                <label className="world-map-toggle">
                                  <input type="checkbox" checked={showMapPlayers} onChange={(event) => setShowMapPlayers(event.target.checked)} />
                                  <span>{t("在线玩家定位")}</span>
                                  <em>{playerMapPoints.length}</em>
                                </label>
                                <label className="world-map-toggle">
                                  <input type="checkbox" checked={showMapBases} onChange={(event) => setShowMapBases(event.target.checked)} />
                                  <span>{t("据点定位")}</span>
                                  <em>{baseMapPoints.length}</em>
                                </label>
                              </div>
                            </div>
                          </aside>

                          <section className="world-map-stage-panel">
                            <header className="world-map-stage-header">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 font-heading text-xl font-black text-ink">
                                  <MapPin className="size-5" />
                                  {selectedMapId === "palpagos" ? t("帕鲁帕戈斯群岛") : t("世界树")}
                                </div>
                                <p className="mt-1 truncate text-sm font-bold text-ink/60">
                                  {t("来源")} PalDB · {t("显示点位")} {visibleMapPoints.length} / {selectedMap?.markerCount ?? 0}
                                </p>
                              </div>
                              <span className="shrink-0 border-2 border-ink bg-[#ffe66d] px-3 py-1 font-heading text-xs font-black text-ink">v1.0</span>
                            </header>
                            <div className="world-map-stage" aria-label={t("资源地图")}>
                              <div className="world-map-grid" />
                              {visibleMapPoints.length === 0 ? (
                                <div className="world-map-empty">{t("当前过滤条件没有点位。")}</div>
                              ) : (
                                visibleMapPoints.map((point) => (
                                  <button
                                    key={point.id}
                                    type="button"
                                    className={`world-map-marker is-${point.kind}`}
                                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                                    title={`${point.label}${point.detail ? ` / ${point.detail}` : ""}`}
                                  >
                                    {point.kind === "player" ? <Crosshair className="size-3.5" /> : point.kind === "base" ? <House className="size-3.5" /> : point.icon ? <img src={point.icon} alt="" loading="lazy" decoding="async" /> : null}
                                    <span>{point.label}</span>
                                  </button>
                                ))
                              )}
                            </div>
                            <div className="world-map-legend">
                              <span><i className="is-resource" />{t("资源点")}</span>
                              <span><i className="is-player" />{t("在线玩家")}</span>
                              <span><i className="is-base" />{t("据点")}</span>
                            </div>
                          </section>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </main>
  );
}
