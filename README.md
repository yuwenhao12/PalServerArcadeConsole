# PalServer Arcade Console

> A Palworld arcade console for small private servers.

Language / 语言 / 言語:

- [简体中文](docs/README.zh-CN.md)
- [English](docs/README.en.md)
- [日本語](docs/README.ja.md)

`PalServer Arcade Console` is a lightweight WebUI for Palworld dedicated servers. It supports Palworld 1.0, runs with Docker Compose, and is designed for private friend-group servers rather than public-server moderation.

![PalServer Arcade Console overview](docs/assets/console-overview-20260712.png)

## Quick Start

```bash
cp .env.example .env
docker compose up -d --build
```

Read the localized documentation above before deploying. Do not commit `.env`, `data/`, `Level.sav`, or other runtime files.
