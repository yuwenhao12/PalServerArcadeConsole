import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getPublicConfigInfo } from "@/lib/server-config";

export async function GET() {
  return NextResponse.json({
    authenticated: await isAuthenticated(),
    config: getPublicConfigInfo(),
  });
}
