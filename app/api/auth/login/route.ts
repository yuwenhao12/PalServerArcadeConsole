import { NextResponse } from "next/server";
import { createSessionToken, sessionCookieName } from "@/lib/auth";
import { getAppConfig } from "@/lib/server-config";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const config = getAppConfig();

  if (!config.web.password) {
    return NextResponse.json({ message: "缺少 WebUI 登录密码，请在 .env 中配置 WEBUI_PASSWORD。" }, { status: 500 });
  }

  if (username !== config.web.username || password !== config.web.password) {
    return NextResponse.json({ message: "账号或密码错误。" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, createSessionToken(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.WEBUI_SECURE_COOKIE === "true",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return response;
}
