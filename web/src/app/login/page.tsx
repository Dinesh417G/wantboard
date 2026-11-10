import type { Metadata } from "next";
import { read } from "@/lib/store";
import { viewerId, viewerIn, GUEST_ID } from "@/lib/viewer";
import { Aurora } from "@/components/chrome";
import { LoginFlow } from "./LoginFlow";
import { DemoPanel } from "./DemoPanel";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { readToken, safeNext, SIGNUP_COOKIE } from "@/lib/auth";
import type { Address, PayPalLink } from "@/lib/types";

const ERRORS: Record<string, string> = {
  paypal_cancelled: "PayPal sign-in was cancelled. Try again, or use your email instead.",
  paypal_state: "That PayPal sign-in link expired. Start again.",
  paypal_failed: "PayPal couldn't sign you in right now. Try again, or use your email instead.",
  paypal_unavailable: "PayPal sign-in isn't available right now. Use your email instead.",
  paypal_no_email: "Your PayPal account didn't share an email. Use your email instead.",
  paypal_email_unconfirmed: "PayPal hasn't confirmed the email on that account. Confirm it in PayPal, or use your email instead.",
  paypal_email_exists: "That email already has a Clinch account. Sign in with your email code, then link PayPal in Settings.",
};

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; step?: string; error?: string }> }) {
  const { next, step, error } = await searchParams;
  const dest = safeNext(next, "/dashboard");
  const db = await read();
  const me = viewerIn(db, await viewerId());
  if (me.id !== GUEST_ID && step !== "profile") redirect(dest);
  const signup = step === "profile" ? readToken<{ email: string; name?: string; paypal?: PayPalLink; address?: Address }>((await cookies()).get(SIGNUP_COOKIE)?.value) : null;
  const initial = signup ? { email: signup.email, name: signup.name ?? "", viaPayPal: !!signup.paypal, verified: !!signup.paypal?.verified, address: signup.address } : undefined;
  const demos = db.parties.filter((p) => p.demo).map((p) => ({ id: p.id, name: p.name, role: p.role, city: p.city }));
  return (
    <div className="relative overflow-hidden">
      <Aurora />
      <div className="relative mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_340px]">
        <LoginFlow next={dest} initial={initial} initialError={error ? ERRORS[error] ?? "" : ""} />
        <DemoPanel demos={demos} next={dest} />
      </div>
    </div>
  );
}

