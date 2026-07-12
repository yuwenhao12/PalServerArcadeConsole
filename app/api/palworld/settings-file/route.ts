import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { parsePalworldSettings, settingsToRecord, updatePalworldSettings } from "@/lib/palworld-settings";
import { getAppConfig } from "@/lib/server-config";

export async function GET() {
  try {
    await requireAuth();
    const path = getAppConfig().palworld.settingsPath;

    const content = existsSync(path) ? readFileSync(path, "utf8") : "";
    const parsedSettings = parsePalworldSettings(content);

    return NextResponse.json({
      path,
      exists: existsSync(path),
      content,
      settings: settingsToRecord(parsedSettings),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取 PalWorldSettings.ini 失败。";
    return NextResponse.json({ message }, { status: message.includes("未登录") ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const rawContent = typeof body.content === "string" ? body.content : "";
    const updates = typeof body.settings === "object" && body.settings ? body.settings as Record<string, string> : null;
    const path = getAppConfig().palworld.settingsPath;
    const currentContent = existsSync(path) ? readFileSync(path, "utf8") : "";
    const content = updates ? updatePalworldSettings(rawContent || currentContent, updates) : rawContent;

    if (!content.trim()) {
      return NextResponse.json({ message: "配置内容为空，已拒绝保存。" }, { status: 400 });
    }

    // 只写入服务端配置文件中指定的路径，避免前端传任意路径造成越权文件写入。
    writeFileSync(path, content, "utf8");
    return NextResponse.json({ ok: true, path });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存 PalWorldSettings.ini 失败。";
    return NextResponse.json({ message }, { status: message.includes("未登录") ? 401 : 500 });
  }
}
