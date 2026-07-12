import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getServerStatus } from "@/lib/palworld-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json(await getServerStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取服务器状态失败。";
    return NextResponse.json({ message }, { status: message.includes("未登录") ? 401 : 500 });
  }
}
