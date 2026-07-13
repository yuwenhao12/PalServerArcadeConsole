# Third-Party Notices

`public/game-data/palworld-zh.json` is derived from `zaigie/palworld-server-tool`:

- Repository: https://github.com/zaigie/palworld-server-tool
- Source files: `web/src/assets/pal.json`, `skill.json`, and `items.json`
- License: Apache License 2.0

The source license is included at `THIRD_PARTY_LICENSES/zaigie-palworld-server-tool-LICENSE`.

`public/game-data/palworld-zh.json` also contains passive-skill rank metadata derived from the publicly rendered page at `https://paldb.cn/passive-skills`. It is used only for the local visual rank treatment; the PalDB robots policy permits page crawling and disallows its API routes.

Additional internal-ID-to-Chinese-name mappings are derived from the publicly rendered `https://paldb.cc/en/` and `https://paldb.cc/cn/` table pages. They are used for this private local management UI only; no PalDB.cc API route is accessed.

## PalDB map data

The optional world map marker dataset in `public/map-data/paldb-map.json` is generated from public PalDB map data:

- https://paldb.cc/cn/Palpagos_Islands
- https://paldb.cc/cn/The_World_Tree

The application uses the extracted coordinates and marker labels for read-only filtering and positioning inside this private-server WebUI. Re-run `pnpm sync:map-data` when PalDB updates its map data.
