import http from "node:http";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAppConfig } from "@/lib/server-config";

function restartContainer(container: string) {
  return new Promise<string>((resolve, reject) => {
    const request = http.request({
      method: "POST",
      socketPath: "/var/run/docker.sock",
      path: `/containers/${encodeURIComponent(container)}/restart?t=10`,
      timeout: 60_000,
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
          resolve(body.trim());
          return;
        }

        reject(new Error(`Docker Engine 返回 ${response.statusCode || "未知状态"}${body ? `：${body}` : ""}`));
      });
    });

    request.on("timeout", () => {
      request.destroy(new Error("Docker Engine 重启请求超时。"));
    });
    request.on("error", reject);
    request.end();
  });
}

export async function POST() {
  try {
    await requireAuth();
    const container = getAppConfig().palworld.dockerContainer.trim().replace(/^\/+/, "");

    if (!container) {
      return NextResponse.json({ message: "未配置 palworld.dockerContainer，无法重启 Docker 容器。" }, { status: 400 });
    }

    // 容器名/ID 只来自服务端配置，直接调用挂载的 Docker Socket，避免镜像内安装完整 Docker CLI。
    const output = await restartContainer(container);

    return NextResponse.json({
      ok: true,
      container,
      output,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "重启 Docker 容器失败。";
    return NextResponse.json({ message }, { status: message.includes("未登录") ? 401 : 500 });
  }
}
