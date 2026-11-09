import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { reset } from "@/lib/store";

/** Restore the demo data. Production requires the ADMIN_TOKEN header; real PayPal transactions are not touched. */
export async function POST(req: Request) {
  const want = process.env.ADMIN_TOKEN;
  const got = req.headers.get("x-admin-token") ?? "";
  if (process.env.NODE_ENV === "production") {
    const ok = !!want && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
    if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await reset();
  return NextResponse.json({ ok: true });
}
