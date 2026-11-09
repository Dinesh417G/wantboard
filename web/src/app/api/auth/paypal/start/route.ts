import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookieOpts, makeToken, PP_STATE_COOKIE, sessionPartyId } from "@/lib/auth";
import { paypalLoginUrl } from "@/lib/paypal";
import { paypalRedirectUri, siteUrl } from "@/lib/email";

/** Start "Log in with PayPal". mode=login (sign in / sign up) or mode=link (attach PayPal to the signed-in account). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "link" ? "link" : "login";
  const rawNext = url.searchParams.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : mode === "link" ? "/settings" : "/dashboard";
  const pid = mode === "link" ? await sessionPartyId() : null;
  if (mode === "link" && !pid) return NextResponse.redirect(new URL(`/login?next=/settings`, siteUrl()));

  const nonce = crypto.randomBytes(16).toString("base64url");
  let target: string;
  try {
    target = paypalLoginUrl(nonce, paypalRedirectUri());
  } catch {
    return NextResponse.redirect(new URL(`/login?error=paypal_unavailable`, siteUrl()));
  }
  const res = NextResponse.redirect(target);
  res.cookies.set({ name: PP_STATE_COOKIE, value: makeToken({ nonce, mode, next, pid }, 600), ...cookieOpts(600) });
  return res;
}
