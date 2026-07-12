import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getAppConfig } from "@/lib/server-config";

export const sessionCookieName = "palserver_gui_session";

function sign(value: string) {
  return createHmac("sha256", getAppConfig().web.sessionSecret).update(value).digest("base64url");
}

function verifySignature(value: string, signature: string) {
  const expected = sign(value);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function createSessionToken(username: string) {
  const payload = Buffer.from(JSON.stringify({
    username,
    issuedAt: Date.now(),
  })).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function isValidSessionToken(token?: string) {
  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !verifySignature(payload, signature)) {
    return false;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { username?: string; issuedAt?: number };
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    return data.username === getAppConfig().web.username && typeof data.issuedAt === "number" && Date.now() - data.issuedAt < maxAgeMs;
  } catch {
    return false;
  }
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  return isValidSessionToken(cookieStore.get(sessionCookieName)?.value);
}

export async function requireAuth() {
  if (!(await isAuthenticated())) {
    throw new Error("未登录或登录已过期。");
  }
}
