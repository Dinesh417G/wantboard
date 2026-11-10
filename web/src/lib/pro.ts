// Clinch Pro: who is subscribed, what fee they pay, and keeping that in sync with PayPal. Server-only.
import "server-only";
import { PLATFORM_FEE_BPS, PRO } from "./config/site";
import { createProPlan, getSubscription } from "./paypal";
import { mutate, nowIso, read } from "./store";
import type { Party } from "./types";

export const isPro = (p: Pick<Party, "pro"> | undefined) => p?.pro?.status === "ACTIVE";
export const feeBpsFor = (seller: Pick<Party, "pro"> | undefined) => (isPro(seller) ? PRO.feeBps : PLATFORM_FEE_BPS);

/** The PayPal billing plan id, created on first use and remembered. */
export async function proPlanId(): Promise<string> {
  if (process.env.PAYPAL_PRO_PLAN_ID) return process.env.PAYPAL_PRO_PLAN_ID;
  const known = (await read()).meta?.proPlanId;
  if (known) return known;
  const made = await createProPlan(PRO.priceUsd);
  await mutate((db) => {
    db.meta = { ...db.meta, proProductId: made.productId, proPlanId: made.planId };
  });
  return made.planId;
}

/** Read the subscription from PayPal and store its status on the party. Returns the new status. */
export async function refreshPro(partyId: string, subscriptionId: string): Promise<string> {
  const sub = await getSubscription(subscriptionId);
  const plan = await proPlanId();
  if (sub.planId !== plan) throw new Error("That subscription is not for Clinch Pro");
  // The checkout always sets custom_id = the seller's party id, so a subscription without it (or with someone else's) is not theirs.
  if (sub.customId !== partyId) throw new Error("That subscription is not linked to your account");
  // Only PayPal's ACTIVE counts as Pro. APPROVED (buyer approved, first payment not confirmed yet) is kept as pending
  // and flips to ACTIVE through the BILLING.SUBSCRIPTION.ACTIVATED webhook or the next refresh.
  const status = sub.status;
  await mutate((db) => {
    const p = db.parties.find((x) => x.id === partyId);
    if (!p) return;
    p.pro = { subscriptionId, status, since: p.pro?.subscriptionId === subscriptionId ? p.pro.since : sub.startedAt ?? nowIso(), nextBillingAt: sub.nextBillingAt, updatedAt: nowIso() };
  });
  return status;
}
