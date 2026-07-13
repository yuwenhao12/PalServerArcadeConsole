# PalServer Arcade Console

> 一块给朋友联机服务器用的 Palworld 街机控制台。

[English](README.en.md) | [日本語](README.ja.md) | [返回首页](../README.md)

`PalServer Arcade Console` 是一个面向 Palworld 专用服务器的轻量 WebUI。它以 Docker 运行，适合 WebUI 与 Palworld 分属不同容器、但部署在同一台 Linux 服务器的场景。

本项目已支持 Palworld 1.0 版本。它的定位不是公开服运营后台，而是朋友一起游玩时使用的自用控制面板，所以没有集成玩家管控、踢出、封禁、解除封禁等功能；如果你需要完整的玩家治理能力，可以基于本项目二次开发。

## Start Screen

| 项目 | 说明 |
| --- | --- |
| 游戏版本 | 支持 Palworld 1.0 |
| 部署方式 | Docker Compose |
| 使用场景 | 熟人联机、自用管理、轻量维护 |
| 核心能力 | 状态总览、手动存档、规则面板、世界图鉴、资源地图 |
| 安全边界 | 世界图鉴只读解析 `Level.sav`，不会写回或修改存档 |

## Preview

以下截图来自一次实际部署环境，用于快速确认 WebUI 控制台总览、规则配置与世界图鉴效果。

### 总览

![PalServer Arcade Console 控制台总览](assets/console-overview-20260712.png)

### 规则面板

![PalServer Arcade Console 规则面板](assets/console-rules-20260712.png)

### 世界图鉴：帕鲁

![PalServer Arcade Console 世界图鉴帕鲁页](assets/world-atlas-pals-20260712.png)

### 世界图鉴：背包与装备

![PalServer Arcade Console 世界图鉴背包与装备页](assets/world-atlas-inventory-20260712.png)

## Feature Menu

- 登录保护：使用 WebUI 账号密码进入控制台。
- 服务器总览：查看连接状态、在线人数、版本、FPS、帧时间与运行时长。
- 手动存档：请求 Palworld 立即保存当前世界。
- 全服广播：向在线玩家发送服务器公告。
- 规则面板：读取、保存并应用 `PalWorldSettings.ini` 中的常用规则。
- 世界图鉴：手动保存后读取 `Level.sav`，展示玩家、帕鲁、据点、组织和世界统计。
- 资源地图：基于 PalDB 点位数据展示主岛与世界树资源点，支持类别过滤、搜索、在线玩家定位和据点定位。
- 背包读取：只读加载玩家个人存档，用于统计背包物品。
- 本地缓存：世界数据写入 WebUI 本地缓存，页面查看时不会持续解析存档。

未集成：玩家控制、踢出、封禁、解除封禁。这个项目更像朋友服的街机面板，而不是公开服的管理系统。

## Insert Coin：部署前准备

先确认 Palworld 已开启 REST API，并重启 Palworld 容器使设置生效：

```ini
RESTAPIEnabled=True
RESTAPIPort=8212
AdminPassword="你的帕鲁管理员密码"
```

然后记录服务器现场信息：

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
find /opt/1panel/apps/palworld/palworld/data/SaveGames/0 -name Level.sav -printf '%h\n'
```

你需要拿到这些值：

- Palworld 容器名
- REST API 映射端口
- `PalWorldSettings.ini` 的宿主机路径
- 包含 `Level.sav` 的世界目录
- 玩家个人存档 `Players` 目录

## DIP Switch：环境配置

在部署目录中创建运行配置：

```bash
cp .env.example .env
```

只需要编辑根目录的 `.env`。它是本项目唯一的部署配置入口，包含 WebUI 登录信息、Palworld REST API、容器名和宿主机文件路径：

```env
WEBUI_PORT=18080

WEBUI_USER=admin
WEBUI_PASSWORD=修改为 WebUI 登录密码
WEBUI_SESSION_SECRET=修改为随机长字符串

PALWORLD_API_URL=http://host.docker.internal:8212/v1/api
PALWORLD_API_USER=admin
PALWORLD_API_PASSWORD=填写 PalWorldSettings.ini 中的 AdminPassword
PALWORLD_DOCKER_CONTAINER=1Panel-palworld-okSH

PALWORLD_SETTINGS_HOST_PATH=/opt/1panel/apps/palworld/palworld/data/Config/LinuxServer/PalWorldSettings.ini
PALWORLD_WORLD_SAVE_HOST_PATH=/opt/1panel/apps/palworld/palworld/data/SaveGames/0/<世界ID>/Level.sav
PALWORLD_PLAYER_SAVES_HOST_PATH=/opt/1panel/apps/palworld/palworld/data/SaveGames/0/<世界ID>/Players
```

`WEBUI_SESSION_SECRET` 可以用下面的命令生成：

```bash
openssl rand -hex 32
```

如果服务器连接 Debian 官方软件源较慢，可以在 `.env` 设置：

```env
APT_MIRROR=https://mirrors.aliyun.com/debian
```

留空时继续使用官方软件源。

## Cabinet Wiring：Docker Compose

项目已包含 `compose.yaml`。在 `.env` 填入正确的宿主机路径和世界 ID 后，可按下列配置核对挂载关系：

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

挂载说明：

| 挂载 | 用途 |
| --- | --- |
| `./data:/app/data` | 持久化世界图鉴缓存 |
| `/var/run/docker.sock` | 仅供“应用规则”重启 Palworld 容器 |
| `PalWorldSettings.ini` | 规则面板读取和写入配置 |
| `Level.sav:ro` | 只读解析世界图鉴，不修改存档 |
| `Players:ro` | 只读读取玩家背包；未配置时仍可读取玩家与帕鲁 |

如果不需要“应用规则后重启容器”，可以移除 Docker Socket 挂载；保存规则和世界图鉴不依赖 Docker Socket。

## Press Start：启动与访问

```bash
docker compose up -d --build
docker compose logs -f palserver-gui
```

访问地址：

```text
http://服务器IP:WEBUI_PORT
```

例如 `.env` 中设置 `WEBUI_PORT=18080`，访问 `http://服务器IP:18080`。

## Control Guide：操作说明

### 总览

- `刷新`：读取服务器当前状态。
- `手动存档`：请求 Palworld 立即保存当前世界。
- `发送公告`：向在线玩家发送服务器公告。

### 规则面板

- `重置`：恢复到本次读取的规则。
- `保存`：写入 `PalWorldSettings.ini`，不重启服务器。
- `应用`：保存规则并重启 `.env` 中 `PALWORLD_DOCKER_CONTAINER` 指定的容器。若有玩家在线，会先提示确认。

### 世界图鉴

点击 `刷新世界` 后，WebUI 会先请求游戏保存，再读取只读挂载的 `Level.sav` 并生成缓存。页面其他时间只读取缓存，不会持续解析存档。

世界图鉴包含：

- 玩家列表
- 在线状态
- 玩家归属帕鲁
- 玩家背包物品
- 据点、组织与世界统计

## Troubleshooting

### 无法连接 REST API

不要在 WebUI 容器配置中使用 `127.0.0.1` 指向 Palworld。若 REST API 暴露到宿主机，请保持：

```env
PALWORLD_API_URL=http://host.docker.internal:8212/v1/api
```

并保留 Compose 的：

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

若 Palworld 未向宿主机发布 `8212/tcp`，先在 Palworld 的 1Panel Compose 配置中增加端口映射，再重建其容器。

### 世界图鉴提示未找到世界存档

检查 `find` 命令找到的实际目录，确认 `.env` 中 `PALWORLD_WORLD_SAVE_HOST_PATH` 指向同一个 `Level.sav`。容器内读取路径由 Compose 固定为只读，不需要额外配置。

### 世界图鉴没有背包物品

检查 `.env` 中的 `PALWORLD_PLAYER_SAVES_HOST_PATH` 是否指向同一世界目录下的 `Players` 文件夹。未配置该目录时，世界图鉴仍能读取玩家和帕鲁，但不会显示背包物品。

### 应用规则无法重启服务器

确认 WebUI 容器内能看到 Palworld 容器：

```bash
docker exec palserver-gui docker ps --format '{{.Names}}'
```

输出中应包含 `.env` 中 `PALWORLD_DOCKER_CONTAINER` 配置的容器名。

## Continue：更新

```bash
docker compose down
docker compose build --no-cache palserver-gui
docker compose up -d --force-recreate palserver-gui
```

镜像中的存档解析依赖使用 Debian 官方的 `python3-loguru` 与 `python3-orjson`，仅 `pyooz` 从 PyPI 下载。若网络超时，可保留 `.env` 中的 `APT_MIRROR`，然后重新执行上述构建命令。

升级前保留 `.env` 和 `data/`。不要将 `.env`、`data/` 或 `Level.sav` 提交到代码仓库。
