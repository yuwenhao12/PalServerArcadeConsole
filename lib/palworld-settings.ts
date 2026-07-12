export type ParsedSetting = {
  key: string;
  value: string;
  rawValue: string;
};

const stringKeys = new Set([
  "ServerName",
  "ServerDescription",
  "AdminPassword",
  "ServerPassword",
  "RandomizerSeed",
  "PublicIP",
  "Region",
  "BanListURL",
]);

function findOptionSettingsRange(content: string) {
  const marker = "OptionSettings=(";
  const start = content.indexOf(marker);

  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inQuote = false;
  let escaped = false;
  const bodyStart = start + marker.length;

  for (let index = bodyStart - 1; index < content.length; index += 1) {
    const char = content[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inQuote = !inQuote;
      continue;
    }

    if (inQuote) {
      continue;
    }

    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return {
          start,
          bodyStart,
          bodyEnd: index,
          end: index + 1,
        };
      }
    }
  }

  return null;
}

function splitEntries(body: string) {
  const entries: string[] = [];
  let current = "";
  let inQuote = false;
  let escaped = false;
  let depth = 0;

  for (const char of body) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }

    if (char === "\"") {
      current += char;
      inQuote = !inQuote;
      continue;
    }

    // CrossplayPlatforms=(Steam,Xbox,PS5,Mac) 这类值内部也有逗号，必须按括号深度跳过。
    if (char === "(" && !inQuote) {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ")" && !inQuote) {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }

    if (char === "," && !inQuote && depth === 0) {
      if (current.trim()) {
        entries.push(current.trim());
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    entries.push(current.trim());
  }

  return entries;
}

function unquoteValue(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1).replace(/\\"/g, "\"");
  }
  return trimmed;
}

function quoteValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function serializeValue(key: string, value: string, oldRawValue?: string) {
  const trimmed = value.trim();

  if (stringKeys.has(key) || oldRawValue?.trim().startsWith("\"")) {
    return quoteValue(value);
  }

  if (/^(true|false)$/i.test(trimmed)) {
    return trimmed.toLowerCase() === "true" ? "True" : "False";
  }

  return trimmed;
}

export function parsePalworldSettings(content: string): ParsedSetting[] {
  const range = findOptionSettingsRange(content);

  if (!range) {
    return [];
  }

  return splitEntries(content.slice(range.bodyStart, range.bodyEnd)).map((entry) => {
    const separator = entry.indexOf("=");
    const key = separator === -1 ? entry : entry.slice(0, separator).trim();
    const rawValue = separator === -1 ? "" : entry.slice(separator + 1).trim();

    return {
      key,
      rawValue,
      value: unquoteValue(rawValue),
    };
  }).filter((entry) => entry.key);
}

export function settingsToRecord(settings: ParsedSetting[]) {
  return Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
}

export function updatePalworldSettings(content: string, updates: Record<string, string>) {
  const range = findOptionSettingsRange(content);
  const existing = range ? parsePalworldSettings(content) : [];
  const existingByKey = new Map(existing.map((setting) => [setting.key, setting]));
  const usedKeys = new Set<string>();

  const updatedEntries = existing.map((setting) => {
    if (!Object.prototype.hasOwnProperty.call(updates, setting.key)) {
      return `${setting.key}=${setting.rawValue}`;
    }

    usedKeys.add(setting.key);
    return `${setting.key}=${serializeValue(setting.key, updates[setting.key], setting.rawValue)}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!usedKeys.has(key) && value !== "") {
      updatedEntries.push(`${key}=${serializeValue(key, value, existingByKey.get(key)?.rawValue)}`);
    }
  }

  const newBody = updatedEntries.join(",");

  if (!range) {
    return `${content.trimEnd()}\n[/Script/Pal.PalGameWorldSettings]\nOptionSettings=(${newBody})\n`;
  }

  return `${content.slice(0, range.bodyStart)}${newBody}${content.slice(range.bodyEnd)}`;
}
