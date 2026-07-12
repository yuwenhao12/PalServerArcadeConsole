export type AppConfig = {
  web: {
    username: string;
    password: string;
    sessionSecret: string;
  };
  palworld: {
    apiUrl: string;
    apiUser: string;
    adminPassword: string;
    settingsPath: string;
    dockerContainer: string;
    worldSavePath: string;
    playerSavesPath: string;
    worldCachePath: string;
  };
};

const defaultSettingsPath = "/app/palworld/PalWorldSettings.ini";
const defaultWorldSavePath = "/app/world/Level.sav";
const defaultPlayerSavesPath = "/app/world/Players";
const defaultWorldCachePath = "data/world-cache.json";

export function getAppConfig(): AppConfig {
  return {
    web: {
      username: process.env.WEBUI_USER || "admin",
      password: process.env.WEBUI_PASSWORD || "",
      sessionSecret: process.env.WEBUI_SESSION_SECRET || "palserver-arcade-console-dev-secret",
    },
    palworld: {
      apiUrl: process.env.PALWORLD_API_URL || "http://127.0.0.1:8212/v1/api",
      apiUser: process.env.PALWORLD_API_USER || "admin",
      adminPassword: process.env.PALWORLD_API_PASSWORD || "",
      settingsPath: defaultSettingsPath,
      dockerContainer: process.env.PALWORLD_DOCKER_CONTAINER || "",
      worldSavePath: defaultWorldSavePath,
      playerSavesPath: defaultPlayerSavesPath,
      worldCachePath: defaultWorldCachePath,
    },
  };
}

export function getPublicConfigInfo() {
  const config = getAppConfig();

  return {
    configPath: ".env",
    palworldApiUrl: config.palworld.apiUrl,
    settingsPath: config.palworld.settingsPath,
    dockerContainer: config.palworld.dockerContainer,
    worldSavePath: config.palworld.worldSavePath,
  };
}
