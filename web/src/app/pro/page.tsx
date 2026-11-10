import type { Metadata } from "next";
import { BadgeCheck, Percent, Sparkles, Zap } from "lucide-react";
import { read } from "@/lib/store";
import { viewerId, viewerIn, GUEST_ID } from "@/lib/viewer";
import { PLATFORM_FEE_BPS, PRO } from "@/lib/config/site";
import { isPro, proPlanId, refreshPro } from "@/lib/pro";
import { ButtonLink, Card } from "@/components/ui";
import { CancelPro, ProCheckout } from "./ProCheckout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clinch Pro" };

const pct = (bps: number) => `${bps / 100}%`;

const PERKS = [
  { Icon: Percent, title: `${pct(PRO.feeBps)} platform fee`, text: `instead of ${pct(PLATFORM_FEE_BPS)} on every deal` },
  { Icon: Zap, title: "Priority matching", text: "the AI matchmaker ranks you higher for new requests" },
  { Icon: BadgeCheck, title: "Pro badge", text: "on your trust profile and the seller list" },
];

export default async function ProPage() {
  let me = viewerIn(await read(), await viewerId());
  // Keep the status honest: re-check PayPal if it's been more than an hour (2 minutes while the first payment is still pending).
  if (me.pro && Date.now() - Date.parse(me.pro.updatedAt) > (me.pro.status === "ACTIVE" ? 3_600_000 : 120_000)) {
    await refreshPro(me.id, me.pro.subscriptionId).catch(() => {});
    me = viewerIn(await read(), me.id);
  }
  // Only a signed-in, non-demo seller who can actually subscribe needs the PayPal billing plan. Looking it up creates a PayPal
  // product and plan on first use, so guests, buyers, demo accounts and subscribers must never trigger it.
  const approved = me.pro?.status === "APPROVED";
  const canSubscribe = me.id !== GUEST_ID && me.role === "seller" && !me.demo && !isPro(me) && !approved;
  let planId = "";
  let planError = "";
  if (canSubscribe) {
    try {
      planId = await proPlanId();
    } catch (e) {
      planError = (e as Error).message;
    }
  }
  const breakEven = Math.ceil((Number(PRO.priceUsd) * 10000) / (PLATFORM_FEE_BPS - PRO.feeBps));
  const keepOn1000 = (1000 * (PLATFORM_FEE_BPS - PRO.feeBps)) / 10000;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="text-xs uppercase tracking-wider text-brand-2">For sellers</div>
      <h1 className="mt-1 text-4xl font-semibold tracking-tight">{PRO.name}</h1>
      <p className="mt-2 text-muted">${PRO.priceUsd}/month, billed by PayPal Subscriptions. Cancel any time.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {PERKS.map(({ Icon, title, text }) => (
          <Card key={title} className="p-5">
            <Icon className="size-5 text-violet-200" />
            <div className="mt-2 font-medium">{title}</div>
            <div className="text-sm text-muted">{text}</div>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        <Sparkles className="mr-1 inline size-4 text-amber" />
        Pays for itself from about ${breakEven}/month in sales. On a $1,000 month you keep ${keepOn1000} more.
      </p>

      <Card className="edge mt-8 p-6">
        {me.id === GUEST_ID ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted">Sign in with a seller account to subscribe.</p>
            <ButtonLink href="/login?next=/pro">Sign in</ButtonLink>
          </div>
        ) : me.role !== "seller" ? (
          <p className="text-sm text-muted">Clinch Pro is for sellers. Switch your account to seller in Settings to subscribe.</p>
        ) : me.demo ? (
          <p className="text-sm text-muted">Demo accounts can&apos;t subscribe. Create your own seller account (it takes a minute) to try Pro with a PayPal sandbox account.</p>
        ) : isPro(me) ? (
          <div className="space-y-3">
            <div className="font-medium text-mint">You&apos;re on Clinch Pro.</div>
            <p className="text-sm text-muted">
              PayPal subscription <span className="font-mono">{me.pro!.subscriptionId}</span>
              {me.pro!.nextBillingAt ? ` · next charge ${me.pro!.nextBillingAt.slice(0, 10)}` : ""}. New deals use the {pct(PRO.feeBps)} fee.
            </p>
            <CancelPro />
          </div>
        ) : approved ? (
          <div className="space-y-2">
            <div className="font-medium text-amber-200">Subscription approved, activation pending.</div>
            <p className="text-sm text-muted">PayPal approved your subscription; activation is pending. This page updates once PayPal confirms the first payment.</p>
          </div>
        ) : planError ? (
          <p className="text-sm text-rose-200">PayPal Subscriptions isn&apos;t available right now ({planError}).</p>
        ) : (
          <div className="space-y-3">
            {me.pro && <p className="text-sm text-muted">Your last subscription is {me.pro.status.toLowerCase()}. Subscribe again below.</p>}
            <p className="text-sm text-muted">Sandbox: log in with a PayPal sandbox personal account.</p>
            <ProCheckout clientId={process.env.PAYPAL_CLIENT_ID ?? ""} planId={planId} partyId={me.id} />
          </div>
        )}
      </Card>
    </div>
  );
}
