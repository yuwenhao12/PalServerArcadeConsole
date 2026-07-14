# PalServer Arcade Console

> A Palworld arcade console for small private servers.

[简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [Back to home](../README.md)

`PalServer Arcade Console` is a lightweight WebUI for Palworld dedicated servers. It runs with Docker and works well when the WebUI and the Palworld server are separate containers on the same Linux host.

This project supports Palworld 1.0. It is built for friend-group private servers, not public-server operations, so it does not include player moderation features such as kick, ban, unban, or player control. If you need those features, you can extend the project yourself.

## Start Screen

| Item | Description |
| --- | --- |
| Game version | Supports Palworld 1.0 |
| Deployment | Docker Compose |
| Use case | Private friend servers and lightweight maintenance |
| Core features | Status overview, manual save, rules panel, world atlas |
| Safety boundary | The world atlas reads `Level.sav` in read-only mode and never writes back to the save file |

## Preview

These screenshots come from an actual deployment and show the dashboard, rules panel, and world atlas.

### Overview

![PalServer Arcade Console overview](assets/console-overview-20260712.png)

### Rules Panel

![PalServer Arcade Console rules panel](assets/console-rules-20260712.png)

### World Atlas: Pals

![PalServer Arcade Console world atlas pals](assets/world-atlas-pals-20260712.png)

### World Atlas: Inventory and Equipment

![PalServer Arcade Console world atlas inventory](assets/world-atlas-inventory-20260712.png)

## Feature Menu

- Login protection with a WebUI username and password.
- Server overview for connection status, online players, version, FPS, frame time, and uptime.
- Manual save to request an immediate Palworld world save.
- Server broadcast for online players.
- Rules panel for reading, saving, and applying common `PalWorldSettings.ini` options.
- World atlas for players, pals, bases, guilds, and world statistics after a manual save.
- Inventory reading from player save files in read-only mode.
- Local cache so the UI can read generated world data without continuously parsing save files.

Not included: player control, kick, ban, and unban. This project is closer to a private-server arcade panel than a public-server admin suite.

## Insert Coin: Before Deployment

Enable the Palworld REST API, then restart the Palworld container:

```ini
RESTAPIEnabled=True
RESTAPIPort=8212
AdminPassword="your Palworld admin password"
```

Record the server information:

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
find /opt/1panel/apps/palworld/palworld/data/SaveGames/0 -name Level.sav -printf '%h\n'
```

You need:

- Palworld container name
- REST API mapped port
- Host path of `PalWorldSettings.ini`
- World directory that contains `Level.sav`
- Player save directory named `Players`

## DIP Switch: Environment

Create the runtime configuration:

```bash
cp .env.example .env
```

Edit only the root `.env`. It is the single deployment entry point for WebUI login, Palworld REST API, container name, and host file paths:

```env
WEBUI_PORT=18080

WEBUI_USER=admin
WEBUI_PASSWORD=change-this-webui-password
WEBUI_SESSION_SECRET=change-this-long-random-session-secret

PALWORLD_API_URL=http://host.docker.internal:8212/v1/api
PALWORLD_API_USER=admin
PALWORLD_API_PASSWORD=use the AdminPassword value from PalWorldSettings.ini
PALWORLD_DOCKER_CONTAINER=1Panel-palworld-okSH

PALWORLD_SETTINGS_HOST_PATH=/opt/1panel/apps/palworld/palworld/data/Config/LinuxServer/PalWorldSettings.ini
PALWORLD_WORLD_SAVE_HOST_PATH=/opt/1panel/apps/palworld/palworld/data/SaveGames/0/<world-id>/Level.sav
PALWORLD_PLAYER_SAVES_HOST_PATH=/opt/1panel/apps/palworld/palworld/data/SaveGames/0/<world-id>/Players
```

Generate `WEBUI_SESSION_SECRET` with:

```bash
openssl rand -hex 32
```

If the server has trouble reaching the official Debian mirror, set:

```env
APT_MIRROR=https://mirrors.aliyun.com/debian
```

Leave it empty to use the official mirror.

## Cabinet Wiring: Docker Compose

The project includes `compose.yaml`. After filling `.env`, verify the mounts:

```yaml
services:
  palserver-gui:
    build: .
    container_name: palserver-gui
    restart: unless-stopped
    ports:
      - "${WEBUI_PORT:-3000}:3000"
    env_file:
      - .env
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - ./data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock
      - ${PALWORLD_SETTINGS_HOST_PATH}:/app/palworld/PalWorldSettings.ini
      - ${PALWORLD_WORLD_SAVE_HOST_PATH}:/app/world/Level.sav:ro
      - ${PALWORLD_PLAYER_SAVES_HOST_PATH:-./empty-players}:/app/world/Players:ro
```

| Mount | Purpose |
| --- | --- |
| `./data:/app/data` | Stores world atlas cache |
| `/var/run/docker.sock` | Lets the rules panel restart the Palworld container |
| `PalWorldSettings.ini` | Read/write access for the rules panel |
| `Level.sav:ro` | Read-only world atlas parsing |
| `Players:ro` | Read-only player inventory parsing |

If you do not need container restart after applying rules, remove the Docker socket mount. Saving rules and reading the world atlas do not require the Docker socket.

## Press Start: Run

```bash
docker compose up -d --build
docker compose logs -f palserver-gui
```

Open:

```text
http://SERVER_IP:WEBUI_PORT
```

For example, if `WEBUI_PORT=18080`, open `http://SERVER_IP:18080`.

## Control Guide

### Overview

- `Refresh`: read current server status.
- `Save World`: ask Palworld to save immediately.
- `Broadcast`: send an announcement to online players.

### Rules Panel

- `Reset`: restore the values from the latest read.
- `Save`: write `PalWorldSettings.ini` without restarting the server.
- `Apply`: save rules and restart the container named by `PALWORLD_DOCKER_CONTAINER`. If players are online, the UI asks for confirmation first.

### World Atlas

After clicking `Refresh World`, the WebUI asks Palworld to save, reads the read-only `Level.sav`, and generates a cache. Later page views read the cache instead of continuously parsing the save file.

The world atlas includes:

- Player list
- Online status
- Player-owned pals
- Player inventory
- Base, guild, and world statistics

## Troubleshooting

### Cannot Connect to REST API

Do not use `127.0.0.1` in the WebUI container to point to Palworld. If the REST API is published on the host, keep:

```env
PALWORLD_API_URL=http://host.docker.internal:8212/v1/api
```

And keep this Compose setting:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

If Palworld has not published `8212/tcp` to the host, add the port mapping in the Palworld Compose configuration, then recreate the Palworld container.

### World Atlas Cannot Find the Save File

Check the directory returned by the `find` command and make sure `PALWORLD_WORLD_SAVE_HOST_PATH` points to the same `Level.sav`.

### World Atlas Has No Inventory Items

Check that `PALWORLD_PLAYER_SAVES_HOST_PATH` points to the `Players` folder under the same world directory. Without it, the atlas can still show players and pals, but not inventory items.

### Applying Rules Cannot Restart the Server

Confirm the WebUI container can see the Palworld container:

```bash
docker exec palserver-gui docker ps --format '{{.Names}}'
```

The output should include the container name configured in `PALWORLD_DOCKER_CONTAINER`.

## Continue: Update

```bash
docker compose down
docker compose build --no-cache palserver-gui
docker compose up -d --force-recreate palserver-gui
```

Before upgrading, keep `.env` and `data/`. Do not commit `.env`, `data/`, or `Level.sav` to the repository.
