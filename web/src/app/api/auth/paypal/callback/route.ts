import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cookieOpts, makeToken, PP_STATE_COOKIE, readToken, sessionCookie, SIGNUP_COOKIE } from "@/lib/auth";
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
      return "ok";
    });
    if (out === "ok") adminAlert(`PayPal linked`, { "PayPal email": who.email, Verified: who.verified ? "yes" : "no", Time: `${nowIso().slice(0, 16).replace("T", " ")} UTC` });
    return go(out === "ok" ? "/settings?paypal=linked" : `/settings?error=paypal_${out}`);
  }

  // Sign in: match by linked PayPal account first, then by a confirmed email that already has a Clinch account.
  const found = await mutate((db) => {
    let p = db.parties.find((x) => !x.demo && x.paypal?.payerId === who.payerId);
    if (!p && who.email && who.emailConfirmed) p = db.parties.find((x) => !x.demo && x.email === who.email);
    if (!p) return null;
    p.paypal = { ...link, linkedAt: p.paypal?.linkedAt ?? link.linkedAt };
    if (!p.paypalEmail && who.email) p.paypalEmail = who.email;
    return { id: p.id, name: p.name, role: p.role };
  });
  if (found) {
    adminAlert(`Sign-in with PayPal: ${found.name}`, { Name: found.name, Role: found.role, "PayPal email": who.email, Time: `${nowIso().slice(0, 16).replace("T", " ")} UTC` });
    const res = go(state.next);
    res.cookies.set(sessionCookie(found.id));
    return res;
  }

  // New person: carry the PayPal identity into onboarding (signed, 30 minutes).
  if (!who.email) return go("/login?error=paypal_no_email");
  const res = go(`/login?step=profile&next=${encodeURIComponent(state.next)}`);
  res.cookies.set({ name: SIGNUP_COOKIE, value: makeToken({ email: who.email, name: who.name, paypal: link }, 1800), ...cookieOpts(1800) });
  return res;
}
