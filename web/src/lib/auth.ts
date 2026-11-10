// Email-code authentication with signed, http-only session cookies. Server-only.
import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "clinch_session";
export const SIGNUP_COOKIE = "clinch_signup";
/** CSRF state for Log in with PayPal (10 minutes). */
export const PP_STATE_COOKIE = "clinch_pp_state";
const SESSION_DAYS = 30;

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.APP_STATE_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString();
const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** token = base64url(json).signature */
export function makeToken(data: Record<string, unknown>, ttlSeconds: number): string {
  const payload = b64(JSON.stringify({ ...data, exp: Date.now() + ttlSeconds * 1000 }));
  return `${payload}.${sign(payload)}`;
}

export function readToken<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(unb64(payload)) as T & { exp: number };
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export async function sessionPartyId(): Promise<string | null> {
  return readToken<{ pid: string }>((await cookies()).get(SESSION_COOKIE)?.value)?.pid ?? null;
}

export const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export const sessionCookie = (partyId: string) => ({
  name: SESSION_COOKIE,
  value: makeToken({ pid: partyId }, SESSION_DAYS * 86400),
  ...cookieOpts(SESSION_DAYS * 86400),
});

// ---------- post-sign-in redirect target ----------

/** True if `s` is a same-site path: one leading "/", then not "/" or "\", no backslash, no control characters. */
function plainPath(s: string): boolean {
  if (s.length > 2000 || s[0] !== "/" || s[1] === "/" || s[1] === "\\") return false;
  // Browsers treat "\" as "/" in http(s) URLs and strip tab/CR/LF, so each one can turn "/x" into "//host".
  if (/[\\\x00-\x1f\x7f]/.test(s)) return false;
  return true;
}

/**
 * Validate the ?next= value that sends a user somewhere after sign-in. Returns `raw` when it is a same-site path,
 * otherwise `fallback`. Rejects "//host", "/\host", control characters (CR/LF/tab) and anything that only becomes
 * one of those after percent-decoding. Accepts non-strings (a repeated ?next=a&next=b arrives as an array).
 */
export function safeNext(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string") return fallback;
  let s = raw;
  let stable = false;
  for (let i = 0; i < 4 && !stable; i++) {
    if (!plainPath(s)) return fallback;
    let dec: string;
    try {
      dec = decodeURIComponent(s);
    } catch {
      return fallback; // malformed %-escape
    }
    stable = dec === s;
    s = dec;
  }
  if (!stable) return fallback; // still changing after 4 decodes: nested encoding, not a normal path
  try {
    if (new URL(raw, "http://clinch.invalid").origin !== "http://clinch.invalid") return fallback;
  } catch {
    return fallback;
  }
  return raw;
}

// ---------- one-time codes ----------

export const normalizeEmail = (e: unknown) => (typeof e === "string" ? e.trim().toLowerCase() : "");
export const validEmail = (e: string) => /^[^@\s]{1,64}@[^@\s]{1,190}\.[a-z]{2,}$/i.test(e) && e.length <= 254;

export function newCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(email: string, code: string): string {
  return crypto.createHmac("sha256", secret()).update(`otp:${email}:${code}`).digest("hex");
}

export function codeMatches(email: string, code: string, hash: string): boolean {
  return safeEqual(hashCode(email, code), hash);
}
