import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { reset } from "@/lib/store";

/** Constant-time string compare: hash both sides first so the length of the real token is not leaked either. */
const sameToken = (a: string, b: string) => {
  const h = (s: string) => crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(h(a), h(b));
};

/**
 * Restore the demo data. Wipes the whole database, so it ALWAYS requires the ADMIN_TOKEN header, in dev too (a
 * `next dev` server listens on every interface and may be pointed at live data). No ADMIN_TOKEN configured = refuse.
 * Real PayPal transactions are not touched.
 */
export async function POST(req: Request) {
  const want = process.env.ADMIN_TOKEN;
  const got = req.headers.get("x-admin-token") ?? "";
  if (!want || !sameToken(got, want)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await reset();
  return NextResponse.json({ ok: true });
}
