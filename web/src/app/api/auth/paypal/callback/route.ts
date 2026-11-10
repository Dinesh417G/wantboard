import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cookieOpts, makeToken, PP_STATE_COOKIE, readToken, safeNext, sessionCookie, SIGNUP_COOKIE } from "@/lib/auth";
import { paypalIdentity } from "@/lib/paypal";
import { adminAlert, siteUrl } from "@/lib/email";
import { mutate, nowIso } from "@/lib/store";
import type { PayPalLink } from "@/lib/types";

type State = { nonce: string; mode: "login" | "link"; next: string; pid: string | null };

const go = (path: string) => {
  const res = NextResponse.redirect(new URL(path, siteUrl()));
  res.cookies.set({ name: PP_STATE_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
};

/** PayPal sends the browser back here with ?code&state (or ?error when the user cancels). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = readToken<State>((await cookies()).get(PP_STATE_COOKIE)?.value);
  const back = state?.mode === "link" ? "/settings" : "/login";
  if (!state || url.searchParams.get("state") !== state.nonce) return go(`${back}?error=paypal_state`);
  const code = url.searchParams.get("code");
  if (!code) return go(`${back}?error=paypal_cancelled`);

  let who;
  try {
    who = await paypalIdentity(code);
  } catch (e) {
    console.warn("[paypal-login]", (e as Error).message);
    return go(`${back}?error=paypal_failed`);
  }
  const link: PayPalLink = { payerId: who.payerId, email: who.email, verified: who.verified, linkedAt: nowIso() };

  // Attach PayPal to the account that is already signed in (from Settings).
  if (state.mode === "link") {
    const out = await mutate((db) => {
      const me = db.parties.find((p) => p.id === state.pid);
      if (!me || me.demo) return "no-account";
      if (db.parties.some((p) => p.id !== me.id && p.paypal?.payerId === who.payerId)) return "taken";
      me.paypal = link;
      if (!me.paypalEmail && who.email) me.paypalEmail = who.email;
      if (!me.address && who.address) me.address = { ...who.address, source: "paypal" };
      return "ok";
    });
    if (out === "ok") adminAlert(`PayPal linked`, { "PayPal email": who.email, Verified: who.verified ? "yes" : "no", Time: `${nowIso().slice(0, 16).replace("T", " ")} UTC` });
    return go(out === "ok" ? "/settings?paypal=linked" : `/settings?error=paypal_${out}`);
  }

  // Sign in: match by the linked PayPal account first. Joining an EXISTING email-code account by email takes proof
  // that the email is the PayPal account's own: PayPal must report it confirmed AND the account verified. Never
  // overwrite a different PayPal link (that would silently change where payouts go). The refusals are errors, not a
  // fall-through to onboarding, because the sign-up step would otherwise merge into the same account by email.
  const next = safeNext(state.next, "/dashboard");
  const found = await mutate((db) => {
    let p = db.parties.find((x) => !x.demo && x.paypal?.payerId === who.payerId);
    if (!p && who.email) {
      const byEmail = db.parties.find((x) => !x.demo && x.email === who.email);
      if (byEmail) {
        if (!who.emailConfirmed || !who.verified) return who.emailConfirmed ? "email_exists" : "email_unconfirmed";
        if (byEmail.paypal && byEmail.paypal.payerId !== who.payerId) return "email_exists";
        p = byEmail;
      }
    }
    if (!p) return null;
    p.paypal = { ...link, linkedAt: p.paypal?.linkedAt ?? link.linkedAt };
    if (!p.paypalEmail && who.email) p.paypalEmail = who.email;
    if (!p.address && who.address) p.address = { ...who.address, source: "paypal" };
    return { id: p.id, name: p.name, role: p.role };
  });
  if (typeof found === "string") return go(`/login?error=paypal_${found}`);
  if (found) {
    adminAlert(`Sign-in with PayPal: ${found.name}`, { Name: found.name, Role: found.role, "PayPal email": who.email, Time: `${nowIso().slice(0, 16).replace("T", " ")} UTC` });
    const res = go(next);
    res.cookies.set(sessionCookie(found.id));
    return res;
  }

  // New person: carry the PayPal identity into onboarding (signed, 30 minutes). An email PayPal has not confirmed
  // must not become the account email, or its real owner could later be signed into this account by email code.
  if (!who.email) return go("/login?error=paypal_no_email");
  if (!who.emailConfirmed) return go("/login?error=paypal_email_unconfirmed");
  const res = go(`/login?step=profile&next=${encodeURIComponent(next)}`);
  res.cookies.set({ name: SIGNUP_COOKIE, value: makeToken({ email: who.email, name: who.name, paypal: link, address: who.address }, 1800), ...cookieOpts(1800) });
  return res;
}
