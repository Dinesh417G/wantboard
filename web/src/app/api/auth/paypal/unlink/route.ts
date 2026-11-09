import { NextResponse } from "next/server";
import { sessionPartyId } from "@/lib/auth";
import { mutate } from "@/lib/store";

/** Disconnect PayPal from your account. Payouts fall back to the PayPal email in Settings. */
export async function POST() {
  const pid = await sessionPartyId();
  if (!pid) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const ok = await mutate((db) => {
    const me = db.parties.find((p) => p.id === pid);
    if (!me || me.demo) return false;
    delete me.paypal;
    return true;
  });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Demo accounts can't be edited" }, { status: 403 });
}
