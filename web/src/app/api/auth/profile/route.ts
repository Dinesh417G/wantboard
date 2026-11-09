import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readToken, sessionCookie, SIGNUP_COOKIE, validEmail, normalizeEmail } from "@/lib/auth";
import { id, mutate, nowIso, read } from "@/lib/store";
import { viewerId, viewerIn, GUEST_ID } from "@/lib/viewer";
import { CATEGORIES, type Category, type Party } from "@/lib/types";

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function fields(b: Record<string, unknown>) {
  const name = s(b.name, 60);
  const city = s(b.city, 60);
  const bio = s(b.bio, 300);
  const role = b.role === "seller" ? "seller" : "buyer";
  const paypalEmail = normalizeEmail(b.paypalEmail);
  const categories = (Array.isArray(b.categories) ? b.categories : []).filter((c): c is Category => CATEGORIES.includes(c as Category));
  if (name.length < 2) return { error: "Enter your name or shop name" };
  if (city.length < 2) return { error: "Enter your city" };
  if (paypalEmail && !validEmail(paypalEmail)) return { error: "PayPal email doesn't look right" };
  if (role === "seller" && !paypalEmail) return { error: "Sellers need a PayPal email to get paid" };
  if (role === "seller" && !categories.length) return { error: "Pick at least one category you sell in" };
  return { name, city, bio, role, paypalEmail, categories } as const;
}

async function uniqueHandle(base: string): Promise<string> {
  const db = await read();
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "user";
  let h = slug;
  for (let i = 2; db.parties.some((p) => p.handle === h); i++) h = `${slug}-${i}`;
  return h;
}

/** Create the account after email verification (onboarding). */
export async function POST(req: Request) {
  const jar = await cookies();
  const signup = readToken<{ email: string }>(jar.get(SIGNUP_COOKIE)?.value);
  if (!signup) return NextResponse.json({ error: "Your sign-up session expired. Start again." }, { status: 401 });
  const f = fields(await req.json().catch(() => ({})));
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  const handle = await uniqueHandle(f.name);

  const partyId = await mutate((db) => {
    const existing = db.parties.find((p) => p.email === signup.email);
    if (existing) return existing.id;
    const p: Party = { id: id("p"), handle, joinedAt: nowIso(), email: signup.email, ...f, categories: [...f.categories] };
    db.parties.push(p);
    return p.id;
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie(partyId));
  res.cookies.set({ name: SIGNUP_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}

/** Update your own profile (settings). Demo accounts are read-only. */
export async function PATCH(req: Request) {
  const db = await read();
  const me = viewerIn(db, await viewerId());
  if (me.id === GUEST_ID) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (me.demo) return NextResponse.json({ error: "Demo accounts can't be edited" }, { status: 403 });
  const f = fields(await req.json().catch(() => ({})));
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  await mutate((d) => {
    const p = d.parties.find((x) => x.id === me.id);
    if (p) Object.assign(p, { ...f, categories: [...f.categories] });
  });
  return NextResponse.json({ ok: true });
}
