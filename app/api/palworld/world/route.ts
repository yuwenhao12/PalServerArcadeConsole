import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runAction } from "@/lib/palworld-api";
import { readWorldCache, refreshWorldCache } from "@/lib/world-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuth();
    const data = await readWorldCache();
    return NextResponse.json({ exists: Boolean(data), data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "世界数据读取失败。";
    return NextResponse.json({ message }, { status: message.includes("未登录") ? 401 : 500 });
  }
}

export async function POST() {
  try {
    await requireAuth();
    await runAction("save", {});
    await new Promise((resolve) => setTimeout(resolve, 800));
    const data = await refreshWorldCache();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "世界数据刷新失败。";
    return NextResponse.json({ message }, { status: message.includes("未登录") ? 401 : 500 });
  }
}
