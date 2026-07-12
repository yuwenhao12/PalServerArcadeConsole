import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAppConfig } from "@/lib/server-config";

const execFileAsync = promisify(execFile);

export async function POST() {
  try {
    await requireAuth();
    const container = getAppConfig().palworld.dockerContainer;

    if (!container) {
      return NextResponse.json({ message: "未配置 palworld.dockerContainer，无法重启 Docker 容器。" }, { status: 400 });
    }

    // 容器名/ID 只来自服务端配置文件，避免前端指定任意 Docker 目标。
    const { stdout, stderr } = await execFileAsync("docker", ["restart", container], {
      timeout: 60_000,
      windowsHide: true,
    });

    return NextResponse.json({
      ok: true,
      container,
      output: `${stdout}${stderr}`.trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "重启 Docker 容器失败。";
    return NextResponse.json({ message }, { status: message.includes("未登录") ? 401 : 500 });
  }
}
