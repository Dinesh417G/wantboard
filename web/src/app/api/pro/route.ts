import { NextResponse } from "next/server";
import { viewerId, viewerIn, GUEST_ID } from "@/lib/viewer";
import { mutate, nowIso, read } from "@/lib/store";
import { refreshPro } from "@/lib/pro";
import { cancelSubscription } from "@/lib/paypal";
import { adminAlert, siteUrl } from "@/lib/email";

async function seller() {
  const me = viewerIn(await read(), await viewerId());
  if (me.id === GUEST_ID) return { error: NextResponse.json({ error: "Sign in first" }, { status: 401 }) };
  if (me.demo) return { error: NextResponse.json({ error: "Demo accounts can't subscribe. Create your own seller account." }, { status: 403 }) };
  if (me.role !== "seller") return { error: NextResponse.json({ error: "Clinch Pro is for seller accounts" }, { status: 403 }) };
  return { me };
}

/** After PayPal approval: verify the subscription with PayPal, then turn Pro on. */
export async function POST(req: Request) {
  const s = await seller();
  if (s.error) return s.error;
  const { subscriptionId } = await req.json().catch(() => ({}));
  if (typeof subscriptionId !== "string" || !/^I-[A-Z0-9]{6,}$/.test(subscriptionId)) return NextResponse.json({ error: "Missing PayPal subscription" }, { status: 400 });
  try {
    let status = await refreshPro(s.me.id, subscriptionId);
    // PayPal can report APPROVED (not yet Pro) for a few seconds before ACTIVE: re-check briefly so a fresh subscriber isn't left pending.
    for (let i = 0; i < 2 && status === "APPROVED"; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      status = await refreshPro(s.me.id, subscriptionId);
    }
    if (status === "ACTIVE") adminAlert(`Clinch Pro started: ${s.me.name}`, { Seller: s.me.name, Subscription: subscriptionId }, `${siteUrl()}/u/${s.me.handle}`);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** Cancel Pro: cancels the PayPal subscription (no more charges). */
export async function DELETE() {
  const s = await seller();
  if (s.error) return s.error;
  const sub = s.me.pro?.subscriptionId;
  if (!sub) return NextResponse.json({ error: "You're not on Clinch Pro" }, { status: 400 });
  try {
    await cancelSubscription(sub, "Cancelled by the seller in Clinch");
  } catch (e) {
    if (!/SUBSCRIPTION_STATUS_INVALID|already/i.test((e as Error).message)) return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
  await mutate((db) => {
    const p = db.parties.find((x) => x.id === s.me.id);
    if (p?.pro) p.pro = { ...p.pro, status: "CANCELLED", updatedAt: nowIso() };
  });
  adminAlert(`Clinch Pro cancelled: ${s.me.name}`, { Seller: s.me.name, Subscription: sub });
  return NextResponse.json({ ok: true });
}
