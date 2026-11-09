// Server-side PayPal REST client (sandbox only). Never import this from a client component.
import "server-only";
import { toPayPalValue } from "./domain/money";
import { parseAddress } from "./domain/location";
import type { Address } from "./types";

const BASE = "https://api-m.sandbox.paypal.com";

function creds() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not set");
  if ((process.env.PAYPAL_ENV ?? "sandbox") !== "sandbox") throw new Error("This app only runs against the PayPal sandbox");
  return { id, secret };
}

let cached: { token: string; expires: number } | null = null;

async function token(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const { id, secret } = creds();
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status} ${body.error_description ?? ""}`);
  cached = { token: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return cached.token;
}

export class PayPalError extends Error {
  constructor(public status: number, public details: unknown, message: string) {
    super(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- PayPal JSON is loosely typed
async function call<T = any>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await token()}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (idempotencyKey) headers["PayPal-Request-Id"] = idempotencyKey;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const issue = json?.details?.[0]?.issue ?? json?.name ?? "";
    throw new PayPalError(res.status, json, `PayPal ${method} ${path} failed: ${res.status} ${issue} ${json?.message ?? ""}`.trim());
  }
  return json as T;
}

const money = (cents: number) => ({ currency_code: "USD", value: toPayPalValue(cents) });

/** Order with intent AUTHORIZE: the buyer's budget is held, not taken. */
export function createAuthorizeOrder(requestId: string, cents: number, title: string, shipTo?: Address & { name: string }) {
  return call<{ id: string; status: string }>(
    "POST",
    "/v2/checkout/orders",
    {
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: requestId,
          custom_id: requestId,
          description: `Clinch budget hold: ${title}`.slice(0, 127),
          amount: money(cents),
          // Ship-to on the PayPal order: the buyer sees it in PayPal, and it backs seller protection.
          ...(shipTo
            ? {
                shipping: {
                  type: "SHIPPING",
                  name: { full_name: shipTo.name.slice(0, 300) },
                  address: {
                    address_line_1: shipTo.line1,
                    ...(shipTo.line2 ? { address_line_2: shipTo.line2 } : {}),
                    admin_area_2: shipTo.city,
                    admin_area_1: shipTo.state,
                    postal_code: shipTo.zip,
                    country_code: "US",
                  },
                },
              }
            : {}),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Clinch",
            shipping_preference: shipTo ? "SET_PROVIDED_ADDRESS" : "NO_SHIPPING",
            user_action: "CONTINUE",
          },
        },
      },
    },
    `order-${requestId}`,
  );
}

/** After buyer approval: place the hold. Returns the authorization id. */
export async function authorizeOrder(orderId: string, requestId: string) {
  // Card payments (and some wallet flows) come back already authorized; reuse that authorization.
  const existing = await call("GET", `/v2/checkout/orders/${orderId}`);
  if (existing.purchase_units?.[0]?.custom_id !== requestId) throw new Error("That PayPal order belongs to a different request");
  const res = existing.purchase_units?.[0]?.payments?.authorizations?.[0]
    ? existing
    : await call("POST", `/v2/checkout/orders/${orderId}/authorize`, {}, `auth-${orderId}`);
  const auth = res.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth?.id) throw new Error("PayPal returned no authorization");
  return { authorizationId: auth.id as string, status: auth.status as string, expires: auth.expiration_time as string | undefined };
}

/** Take the winning bid amount from the hold; final_capture releases the rest of the hold. */
export async function captureAuthorization(authorizationId: string, cents: number, invoiceId: string) {
  const res = await call(
    "POST",
    `/v2/payments/authorizations/${authorizationId}/capture`,
    { amount: money(cents), final_capture: true, invoice_id: invoiceId },
    `cap-${authorizationId}`,
  );
  return { captureId: res.id as string, status: res.status as string };
}

/** Release the hold entirely; the buyer is never charged. */
export function voidAuthorization(authorizationId: string) {
  return call("POST", `/v2/payments/authorizations/${authorizationId}/void`, undefined, `void-${authorizationId}`);
}

/** Full refund when cents is omitted, otherwise a partial refund. */
export async function refundCapture(captureId: string, note: string, cents?: number) {
  const body: Record<string, unknown> = { note_to_payer: note.slice(0, 255) };
  if (cents !== undefined) body.amount = money(cents);
  const res = await call("POST", `/v2/payments/captures/${captureId}/refund`, body, `ref-${captureId}-${cents ?? "full"}`);
  return { refundId: res.id as string, status: res.status as string };
}

/** Pay the seller (winning price minus platform fee): to their linked PayPal account (payer ID) if they have one, else by email. */
export async function payoutSeller(opts: { batchKey: string; email: string; payerId?: string; venmo?: string; cents: number; note: string }) {
  // Venmo (US): phone, email or @handle. Otherwise PayPal: linked payer ID, else email.
  const v = opts.venmo?.trim();
  const venmoDigits = v?.replace(/\D/g, "") ?? "";
  const recipient = v
    ? v.includes("@") && !v.startsWith("@")
      ? { recipient_type: "EMAIL", receiver: v, recipient_wallet: "VENMO" }
      : /^\+?[\d\s().-]{10,}$/.test(v)
        ? { recipient_type: "PHONE", receiver: venmoDigits.slice(-10), recipient_wallet: "VENMO" }
        : { recipient_type: "USER_HANDLE", receiver: v.replace(/^@/, ""), recipient_wallet: "VENMO" }
    : { recipient_type: opts.payerId ? "PAYPAL_ID" : "EMAIL", receiver: opts.payerId || opts.email };
  const res = await call(
    "POST",
    "/v1/payments/payouts",
    {
      sender_batch_header: {
        sender_batch_id: opts.batchKey,
        email_subject: "You've been paid for a Clinch deal",
        email_message: opts.note.slice(0, 1000),
      },
      items: [
        {
          ...recipient,
          amount: { currency: "USD", value: toPayPalValue(opts.cents) },
          note: opts.note.slice(0, 4000),
          sender_item_id: opts.batchKey,
        },
      ],
    },
    opts.batchKey,
  );
  return { payoutBatchId: res.batch_header.payout_batch_id as string, status: res.batch_header.batch_status as string };
}

/** Ask PayPal to verify a webhook. The event is embedded as the exact raw body PayPal sent (re-serializing can break it). */
export async function verifyWebhook(headers: Headers, rawEvent: string, webhookId: string) {
  const meta = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
  };
  const body = JSON.stringify(meta).slice(0, -1) + `,"webhook_event":${rawEvent}}`;
  const res = await fetch(`${BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });
  const out = await res.json().catch(() => ({}));
  return { verification_status: String(out.verification_status ?? `HTTP ${res.status}`), detail: res.ok ? undefined : out };
}

// ---------- Log in with PayPal (OpenID Connect) ----------

const LOGIN_SCOPES = "openid profile email address https://uri.paypal.com/services/paypalattributes";

/** Where the browser goes to sign in with PayPal (sandbox). */
export function paypalLoginUrl(state: string, redirectUri: string) {
  const q = new URLSearchParams({
    flowEntry: "static",
    client_id: creds().id,
    response_type: "code",
    scope: LOGIN_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `https://www.sandbox.paypal.com/signin/authorize?${q}`;
}

export type PayPalIdentity = { payerId: string; email: string; emailConfirmed: boolean; name: string; verified: boolean; address?: Address };

/** Exchange the authorization code for a user token, then read the PayPal account's identity. */
export async function paypalIdentity(code: string): Promise<PayPalIdentity> {
  const { id, secret } = creds();
  const tok = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code }),
    cache: "no-store",
  });
  const t = await tok.json().catch(() => ({}));
  if (!tok.ok || !t.access_token) throw new Error(`PayPal login failed: ${tok.status} ${t.error_description ?? t.error ?? ""}`.trim());
  const res = await fetch(`${BASE}/v1/identity/oauth2/userinfo?schema=paypalv1.1`, { headers: { Authorization: `Bearer ${t.access_token}` }, cache: "no-store" });
  const u = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PayPal userinfo failed: ${res.status}`);
  const emails: { value: string; primary?: boolean; confirmed?: boolean }[] = Array.isArray(u.emails) ? u.emails : u.email ? [{ value: u.email, primary: true, confirmed: u.email_verified }] : [];
  const main = emails.find((e) => e.primary) ?? emails[0];
  const payerId = String(u.payer_id ?? "");
  if (!payerId) throw new Error("PayPal did not return an account ID");
  return {
    payerId,
    email: String(main?.value ?? "").toLowerCase(),
    emailConfirmed: main?.confirmed !== false,
    name: String(u.name ?? [u.given_name, u.family_name].filter(Boolean).join(" ")).trim(),
    verified: u.verified_account === true || u.verified_account === "true",
    address: fromPayPalAddress(u.address),
  };
}

/** userinfo address -> our Address (US only; undefined if missing or not valid). */
function fromPayPalAddress(a: unknown): Address | undefined {
  const x = (a ?? {}) as Record<string, string>;
  if (!x.street_address || (x.country && x.country !== "US")) return undefined;
  const [line1, ...rest] = String(x.street_address).split(/\n|, /);
  const out = parseAddress({ line1, line2: rest.join(", "), city: x.locality, state: x.region, zip: x.postal_code }, { needStreet: true });
  return typeof out === "string" ? undefined : out;
}

// ---------- Keep the hold guaranteed ----------

/** After the 3-day honor period, renew the hold (allowed until day 29). Returns the NEW authorization id. */
export async function reauthorize(authorizationId: string, cents: number) {
  const res = await call("POST", `/v2/payments/authorizations/${authorizationId}/reauthorize`, { amount: money(cents) }, `reauth-${authorizationId}`);
  return { authorizationId: res.id as string, status: res.status as string, expires: res.expiration_time as string | undefined };
}

// ---------- Package tracking on the PayPal order ----------

export const CARRIERS = ["UPS", "USPS", "FEDEX", "DHL", "OTHER"] as const;
export type Carrier = (typeof CARRIERS)[number];

/** Attach the seller's tracking number to the captured PayPal order; PayPal can notify the buyer. */
export async function addTracking(orderId: string, captureId: string, trackingNumber: string, carrier: Carrier, carrierOther?: string) {
  const res = await call(
    "POST",
    `/v2/checkout/orders/${orderId}/track`,
    {
      capture_id: captureId,
      tracking_number: trackingNumber,
      carrier,
      ...(carrier === "OTHER" ? { carrier_name_other: (carrierOther || "Other").slice(0, 64) } : {}),
      notify_payer: true,
    },
    `track-${captureId}-${trackingNumber}`,
  );
  const tracker = res.purchase_units?.[0]?.shipping?.trackers?.at?.(-1);
  return { trackerId: (tracker?.id ?? `${captureId}-${trackingNumber}`) as string, status: (tracker?.status ?? "SHIPPED") as string };
}

// ---------- Payout status ----------

/** Status of the (single) item in a payout batch: SUCCESS, PENDING, UNCLAIMED, FAILED, RETURNED, ONHOLD, BLOCKED... */
export async function getPayout(batchId: string) {
  const res = await call("GET", `/v1/payments/payouts/${batchId}`);
  const item = res.items?.[0];
  return {
    batchStatus: String(res.batch_header?.batch_status ?? ""),
    itemId: item?.payout_item_id as string | undefined,
    status: String(item?.transaction_status ?? res.batch_header?.batch_status ?? "PENDING"),
    error: (item?.errors?.message ?? item?.errors?.name) as string | undefined,
  };
}

/** Take back an unclaimed payout (e.g. wrong email) so it can be sent again. */
export function cancelUnclaimedPayout(itemId: string) {
  return call("POST", `/v1/payments/payouts-item/${itemId}/cancel`);
}
