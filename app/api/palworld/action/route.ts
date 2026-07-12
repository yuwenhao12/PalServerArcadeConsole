import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runAction, type PalworldAction } from "@/lib/palworld-api";

const actions = new Set<PalworldAction>(["announce", "save"]);

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const action = body.action as PalworldAction;
    const payload = typeof body.payload === "object" && body.payload ? body.payload : {};

    if (!actions.has(action)) {
      return NextResponse.json({ message: "未知操作，已拒绝执行。" }, { status: 400 });
    }

    const result = await runAction(action, payload);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "执行操作失败。";
    return NextResponse.json({ message }, { status: message.includes("未登录") ? 401 : 500 });
  }
}
