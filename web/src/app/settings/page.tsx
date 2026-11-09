import type { Metadata } from "next";
import { read } from "@/lib/store";
import { requireViewer } from "@/lib/viewer";
import { Card } from "@/components/ui";
import { SettingsForm } from "./SettingsForm";
import { parseCityState } from "@/lib/domain/location";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

const NOTES: Record<string, { ok: boolean; text: string }> = {
  linked: { ok: true, text: "PayPal connected. Payouts now go straight to that PayPal account." },
  paypal_taken: { ok: false, text: "That PayPal account is already connected to another Clinch account." },
  paypal_cancelled: { ok: false, text: "PayPal connection was cancelled." },
  paypal_failed: { ok: false, text: "PayPal couldn't connect right now. Try again in a minute." },
  paypal_state: { ok: false, text: "That PayPal link expired. Try again." },
  paypal_no_account: { ok: false, text: "Sign in again, then connect PayPal." },
};

export default async function Settings({ searchParams }: { searchParams: Promise<{ paypal?: string; error?: string }> }) {
  const sp = await searchParams;
  const note = NOTES[sp.paypal ?? sp.error ?? ""];
  const me = await requireViewer(await read(), "/settings");
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="text-xs uppercase tracking-wider text-brand-2">Settings</div>
      <h1 className="mt-1 text-4xl font-semibold tracking-tight">Your account</h1>
      {me.demo ? (
        <Card className="mt-8 p-6 text-sm text-muted">This is a shared demo account, so it can&apos;t be edited. Sign out and create your own account with your email.</Card>
      ) : (
        <SettingsForm
          me={{ name: me.name, city: me.city, bio: me.bio, role: me.role, paypalEmail: me.paypalEmail, categories: me.categories, email: me.email ?? "", paypal: me.paypal ? { email: me.paypal.email, verified: me.paypal.verified } : null, address: me.address ?? parseCityState(me.city), addressFromPayPal: me.address?.source === "paypal", payoutMethod: me.payout?.method ?? "paypal", venmo: me.payout?.venmo ?? "" }}
          note={note}
        />
      )}
    </div>
  );
}
