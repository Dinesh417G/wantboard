import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readToken, sessionCookie, SIGNUP_COOKIE, validEmail, normalizeEmail } from "@/lib/auth";
import { id, mutate, nowIso, read } from "@/lib/store";
import { viewerId, viewerIn, GUEST_ID } from "@/lib/viewer";
import { CATEGORIES, type Category, type Party, type PayPalLink, type Address } from "@/lib/types";
import { parseAddress } from "@/lib/domain/location";
import { adminAlert, siteUrl } from "@/lib/email";

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function fields(b: Record<string, unknown>) {
  const name = s(b.name, 60);
  const addr = (b.address ?? {}) as Record<string, unknown>;
  // Public location line comes from the address ("Austin, TX"); the street is never public.
  const city = typeof addr.city === "string" && addr.city.trim() && typeof addr.state === "string" && addr.state ? `${s(addr.city, 50)}, ${s(addr.state, 2).toUpperCase()}` : s(b.city, 60);
  const bio = s(b.bio, 300);
  const role = b.role === "seller" ? "seller" : "buyer";
  const paypalEmail = normalizeEmail(b.paypalEmail);
  const categories = (Array.isArray(b.categories) ? b.categories : []).filter((c): c is Category => CATEGORIES.includes(c as Category));
  if (name.length < 2) return { error: "Enter your name or shop name" };
  if (city.length < 2) return { error: "Enter your city and state" };
  if (paypalEmail && !validEmail(paypalEmail)) return { error: "PayPal email doesn't look right" };
  if (role === "seller" && !paypalEmail && !b.paypalLinked) return { error: "Sellers need a PayPal email to get paid" };
  if (role === "seller" && !categories.length) return { error: "Pick at least one category you sell in" };
  // Address is optional here (buyers are asked again when they post); if any part is filled in, it must be valid.
  const raw = (b.address ?? {}) as Record<string, unknown>;
  let address: Address | undefined;
  if (["line1", "city", "zip"].some((k) => typeof raw[k] === "string" && (raw[k] as string).trim())) {
    const a = parseAddress(raw, { needStreet: role === "buyer" });
    if (typeof a === "string") return { error: a };
    address = a;
  }
  return { name, city, bio, role, paypalEmail, categories, address } as const;
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
  const signup = readToken<{ email: string; paypal?: PayPalLink; address?: Address }>(jar.get(SIGNUP_COOKIE)?.value);
  if (!signup) return NextResponse.json({ error: "Your sign-up session expired. Start again." }, { status: 401 });
  const f = fields({ ...(await req.json().catch(() => ({}))), ...(signup.paypal ? { paypalLinked: true } : {}) });
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  const handle = await uniqueHandle(f.name);

  const partyId = await mutate((db) => {
    const existing = db.parties.find((p) => p.email === signup.email);
    if (existing) return existing.id;
    const { address, ...rest } = f;
    const p: Party = { id: id("p"), handle, joinedAt: nowIso(), email: signup.email, ...rest, categories: [...f.categories] };
    if (address) p.address = { ...address, source: signup.address && address.line1 === signup.address.line1 ? "paypal" : "manual" };
    if (signup.paypal && !db.parties.some((x) => x.paypal?.payerId === signup.paypal!.payerId)) {
      p.paypal = signup.paypal;
      if (!p.paypalEmail) p.paypalEmail = signup.paypal.email;
    }
    db.parties.push(p);
    return p.id;
  });
  adminAlert(`New ${f.role} account: ${f.name}`, { Name: f.name, Role: f.role, Email: signup.email, City: f.city, "PayPal email": f.paypalEmail || signup.paypal?.email || "—", "Signed up with": signup.paypal ? "PayPal" : "email code", Categories: f.categories.join(", ") || "—" }, `${siteUrl()}/u/${handle}`);
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
  const f = fields({ ...(await req.json().catch(() => ({}))), ...(me.paypal ? { paypalLinked: true } : {}) });
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: 400 });
  await mutate((d) => {
    const p = d.parties.find((x) => x.id === me.id);
    if (!p) return;
    const { address, ...rest } = f;
    Object.assign(p, { ...rest, categories: [...f.categories] });
    if (address) p.address = { ...address, source: p.address?.line1 === address.line1 && p.address.zip === address.zip ? p.address.source : "manual" };
  });
  return NextResponse.json({ ok: true });
}
