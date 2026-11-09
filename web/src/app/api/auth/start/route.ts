import { NextResponse } from "next/server";
import { codeEmail } from "@/lib/email";
import { hashCode, newCode, normalizeEmail, validEmail } from "@/lib/auth";
import { mutate, nowIso } from "@/lib/store";

const PER_HOUR = 5;

/** Step 1: email a 6-digit code. Same response whether or not the account exists. */
export async function POST(req: Request) {
  const { email: raw } = await req.json().catch(() => ({}));
  const email = normalizeEmail(raw);
  if (!validEmail(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });

  const code = newCode();
  const limited = await mutate((db) => {
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const now = nowIso();
    db.otps = (db.otps ?? []).filter((o) => o.createdAt > hourAgo || o.expiresAt > now);
    if (db.otps.filter((o) => o.email === email && o.createdAt > hourAgo).length >= PER_HOUR) return true;
    db.otps.push({ email, hash: hashCode(email, code), expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), attempts: 0, createdAt: now });
    return false;
  });
  if (limited) return NextResponse.json({ error: "Too many codes requested. Try again in an hour." }, { status: 429 });

  const sent = await codeEmail(email, code);
  if (!sent.ok && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "We couldn't send the email right now. Try again in a minute." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, ...(process.env.NODE_ENV !== "production" && !sent.ok ? { devNote: "Email not configured: code printed in the server log." } : {}) });
}
