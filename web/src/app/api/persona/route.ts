import { NextResponse } from "next/server";
import { read } from "@/lib/store";
import { sessionCookie } from "@/lib/auth";

/** One-click sign-in as a seeded demo account (for judges). Real accounts can't be entered this way. */
export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  const p = (await read()).parties.find((x) => x.id === id);
  if (!p?.demo) return NextResponse.json({ error: "not a demo account" }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(p.id));
  return res;
}
