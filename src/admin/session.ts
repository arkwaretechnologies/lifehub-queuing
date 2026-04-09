import crypto from "crypto";
import { cookies } from "next/headers";
import { requireEnv } from "@/env";

const COOKIE_NAME = "lhq_admin";

type SessionPayload = {
  userId: number;
  username: string;
  role: string;
  issuedAt: number;
};

function sign(payloadJson: string) {
  const secret = requireEnv("ADMIN_SESSION_SECRET");
  return crypto.createHmac("sha256", secret).update(payloadJson).digest("base64url");
}

export async function setAdminSession(payload: Omit<SessionPayload, "issuedAt">) {
  const full: SessionPayload = { ...payload, issuedAt: Date.now() };
  const json = JSON.stringify(full);
  const token = `${Buffer.from(json).toString("base64url")}.${sign(json)}`;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export function readAdminSessionFromRequestCookie(cookieValue?: string): SessionPayload | null {
  if (!cookieValue) return null;
  const [payloadB64, sig] = cookieValue.split(".");
  if (!payloadB64 || !sig) return null;

  let json: string;
  try {
    json = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(json);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const parsed = JSON.parse(json) as SessionPayload;
    if (!parsed?.userId || !parsed?.username || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const adminSessionCookieName = COOKIE_NAME;
