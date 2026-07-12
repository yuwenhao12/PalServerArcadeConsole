#!/usr/bin/env python3

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "vendor"))

from palworld_save_tools.gvas import GvasFile
from palworld_save_tools.palsav import decompress_sav_to_gvas
from palworld_save_tools.paltypes import DISABLED_PROPERTIES, PALWORLD_CUSTOM_PROPERTIES, PALWORLD_TYPE_HINTS


def value_of(container, key, default=None):
    value = container.get(key, {}) if isinstance(container, dict) else {}
    return value.get("value", default) if isinstance(value, dict) else default


def raw_value(container):
    raw_data = container.get("RawData", {}) if isinstance(container, dict) else {}
    raw_value = raw_data.get("value", {}) if isinstance(raw_data, dict) else {}
    return raw_value if isinstance(raw_value, dict) else {}


def character_parameters(entry):
    raw_data = entry.get("value", {}).get("RawData", {}).get("value", {})
    return raw_data.get("object", {}).get("SaveParameter", {}).get("value", {})


def character_instance_id(entry):
    return value_of(entry.get("key", {}), "InstanceId", "")


def character_player_id(entry):
    return value_of(entry.get("key", {}), "PlayerUId", "")


def number_or_none(value):
    return value if isinstance(value, (int, float)) else None


def json_default(value):
    return str(value)


GUID_PATTERN = re.compile(r"^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$", re.IGNORECASE)


def identifier_values(value):
    if isinstance(value, str) or value is not None and not isinstance(value, (dict, list)):
        text = str(value)
        normalized = text.replace("-", "").lower()
        return [normalized] if GUID_PATTERN.match(text) else []
    if isinstance(value, dict):
        identifiers = []
        for child in value.values():
            identifiers.extend(identifier_values(child))
        return identifiers
    if isinstance(value, list):
        identifiers = []
        for child in value:
            identifiers.extend(identifier_values(child))
        return identifiers
    return []


def first_identifier(value, fallback=""):
    identifiers = identifier_values(value)
    return identifiers[0] if identifiers else fallback


def string_values(value):
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        strings = []
        for child in value.values():
            strings.extend(string_values(child))
        return strings
    if isinstance(value, list):
        strings = []
        for child in value:
            strings.extend(string_values(child))
        return strings
    return []


def number_value(value):
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return value
    if isinstance(value, dict):
        if "value" in value:
            return number_value(value["value"])
        for child in value.values():
            number = number_value(child)
            if number is not None:
                return number
    return None


def collect_container_ids(value):
    container_ids = set()
    if not isinstance(value, dict):
        return container_ids

    for key, child in value.items():
        if "container" in key.lower():
            container_ids.update(identifier_values(child))
        container_ids.update(collect_container_ids(child))

    return container_ids


def collect_item_slots(value, items):
    if isinstance(value, dict):
        item = value.get("item")
        count = value.get("count")
        static_id = item.get("static_id") if isinstance(item, dict) else None
        if isinstance(static_id, str) and static_id and isinstance(count, int) and count > 0:
            items[static_id] = items.get(static_id, 0) + count

        for child in value.values():
            collect_item_slots(child, items)
    elif isinstance(value, list):
        for child in value:
            collect_item_slots(child, items)


def read_save_file(input_path):
    save_bytes = input_path.read_bytes()
    raw_gvas, _ = decompress_sav_to_gvas(save_bytes)
    custom_properties = {
        key: value for key, value in PALWORLD_CUSTOM_PROPERTIES.items() if key not in DISABLED_PROPERTIES
    }
    return GvasFile.read(raw_gvas, PALWORLD_TYPE_HINTS, custom_properties).dump()


def player_inventories(players_dir, container_items):
    """仅读取玩家存档的背包容器索引，物品数量仍来自 Level.sav。"""
    if not players_dir or not players_dir.is_dir():
        return {}, False

    inventories = {}
    for player_save in players_dir.glob("*.sav"):
        try:
            parsed = read_save_file(player_save)
            save_data = value_of(parsed.get("properties", {}), "SaveData", {})
            if not isinstance(save_data, dict):
                continue

            player_id = first_identifier(value_of(save_data, "PlayerUId", ""))
            if not player_id:
                player_id = first_identifier(player_save.stem)
            if not player_id:
                continue

            # 1.0 存档使用 InventoryInfo，旧版工具导出的字段可能为 inventoryInfo。
            inventory_info = value_of(save_data, "InventoryInfo", value_of(save_data, "inventoryInfo", {}))
            inventory = {}
            for container_id in collect_container_ids(inventory_info):
                for item_id, count in container_items.get(container_id, {}).items():
                    inventory[item_id] = inventory.get(item_id, 0) + count

            inventories[player_id] = inventory
        except Exception:
            # 单个玩家存档正在写入或损坏时，不影响其他玩家及世界数据读取。
            continue

    return inventories, True


def build_cache(input_path, players_dir=None):
    parsed = read_save_file(input_path)
    world = parsed["properties"]["worldSaveData"]["value"]

    item_containers = world.get("ItemContainerSaveData", {}).get("value", [])
    container_items = {}
    for entry in item_containers:
        identifiers = identifier_values(entry.get("key", {}))
        if not identifiers:
            continue
        items = {}
        collect_item_slots(entry.get("value", {}), items)
        for identifier in identifiers:
            container_items[identifier] = items

    player_inventories_by_id, _ = player_inventories(players_dir, container_items)

    characters = world.get("CharacterSaveParameterMap", {}).get("value", [])
    players = []
    pals = []
    for entry in characters:
        parameters = character_parameters(entry)
        is_player = value_of(parameters, "IsPlayer", False) is True
        instance_id = character_instance_id(entry)
        player_id = character_player_id(entry)
        name = value_of(parameters, "NickName", "")
        level = number_value(value_of(parameters, "Level"))
        guild_id = first_identifier(raw_value(entry.get("value", {})).get("group_id", ""))

        if is_player:
            normalized_player_id = first_identifier(player_id)
            inventory = player_inventories_by_id.get(normalized_player_id, {})

            players.append({
                "id": player_id or instance_id,
                "playerId": player_id,
                "instanceId": instance_id,
                "name": name or "未命名玩家",
                "level": level,
                "guildId": guild_id,
                "inventoryAvailable": normalized_player_id in player_inventories_by_id,
                "resourceCount": sum(inventory.values()),
                "resources": [
                    {"id": item_id, "count": count}
                    for item_id, count in sorted(inventory.items(), key=lambda item: (-item[1], item[0]))[:40]
                ],
            })
            continue

        species = value_of(parameters, "CharacterID", "")
        if not species:
            continue
        passive_skills = []
        for passive in string_values(value_of(parameters, "PassiveSkillList", [])):
            if passive and passive not in {"None", "EPalPassiveSkill::None"} and passive not in passive_skills:
                passive_skills.append(passive)

        pals.append({
            "id": instance_id,
            "name": name or species,
            "species": species,
            "level": level,
            "ownerId": first_identifier(value_of(parameters, "OwnerPlayerUId", "")),
            "guildId": guild_id,
            "passives": passive_skills,
        })

    bases = []
    for entry in world.get("BaseCampSaveData", {}).get("value", []):
        raw = raw_value(entry.get("value", {}))
        translation = raw.get("transform", {}).get("translation", {})
        location = None
        if all(isinstance(translation.get(axis), (int, float)) for axis in ("x", "y", "z")):
            location = {axis: round(translation[axis], 1) for axis in ("x", "y", "z")}
        work_ids = raw_value(entry.get("value", {}).get("WorkCollection", {})).get("work_ids", [])
        bases.append({
            "id": first_identifier(entry.get("key", ""), str(entry.get("key", ""))),
            "name": raw.get("name") or "未命名据点",
            "guildId": first_identifier(raw.get("group_id_belong_to", "")),
            "areaRange": number_or_none(raw.get("area_range")),
            "location": location,
            "workCount": len(work_ids) if isinstance(work_ids, list) else 0,
        })

    guilds = []
    for entry in world.get("GroupSaveDataMap", {}).get("value", []):
        raw = raw_value(entry.get("value", {}))
        group_type = raw.get("group_type", "")
        if not group_type:
            continue
        members = raw.get("individual_character_handle_ids", [])
        guilds.append({
            "id": first_identifier(entry.get("key", ""), str(entry.get("key", ""))),
            "name": raw.get("guild_name") or raw.get("group_name") or "未命名组织",
            "type": group_type.replace("EPalGroupType::", ""),
            "memberCount": len(members) if isinstance(members, list) else 0,
        })

    map_objects = world.get("MapObjectSaveData", {}).get("value", {}).get("values", [])
    source_stat = input_path.stat()

    return {
        "version": 1,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "modifiedAt": datetime.fromtimestamp(source_stat.st_mtime, timezone.utc).isoformat(),
            "size": source_stat.st_size,
        },
        "summary": {
            "players": len(players),
            "pals": len(pals),
            "bases": len(bases),
            "guilds": len(guilds),
            "mapObjects": len(map_objects) if isinstance(map_objects, list) else 0,
            "itemContainers": len(item_containers) if isinstance(item_containers, list) else 0,
        },
        "players": sorted(players, key=lambda player: player["name"].casefold()),
        "pals": sorted(pals, key=lambda pal: (pal["species"], pal["name"])),
        "bases": bases,
        "guilds": guilds,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--players-dir")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    if not input_path.is_file():
        raise FileNotFoundError("World save file does not exist")

    players_dir = Path(args.players_dir) if args.players_dir else None
    cache = build_cache(input_path, players_dir)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_suffix(f"{output_path.suffix}.tmp")
    temporary_path.write_text(
        json.dumps(cache, ensure_ascii=False, separators=(",", ":"), default=json_default),
        encoding="utf-8",
    )
    os.replace(temporary_path, output_path)


if __name__ == "__main__":
    main()
