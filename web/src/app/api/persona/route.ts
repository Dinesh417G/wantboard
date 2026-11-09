import { NextResponse } from "next/server";
import { read } from "@/lib/store";
import { VIEWER_COOKIE } from "@/lib/viewer";

/** Demo identity switch: browse as a buyer or one of the sellers. */
export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (!(await read()).parties.some((p) => p.id === id)) return NextResponse.json({ error: "unknown person" }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(VIEWER_COOKIE, id, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
  return res;
}
