// Server-side PayPal REST client (sandbox only). Never import this from a client component.
import "server-only";
import { toPayPalValue } from "./domain/money";

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
export function createAuthorizeOrder(requestId: string, cents: number, title: string) {
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
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Clinch",
            shipping_preference: "NO_SHIPPING",
            user_action: "CONTINUE",
          },
        },
      },
    },
    `order-${requestId}`,
  );
}

/** After buyer approval: place the hold. Returns the authorization id. */
export async function authorizeOrder(orderId: string) {
  const res = await call("POST", `/v2/checkout/orders/${orderId}/authorize`, {}, `auth-${orderId}`);
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

/** Pay the seller (winning price minus platform fee) by email. */
export async function payoutSeller(opts: { batchKey: string; email: string; cents: number; note: string }) {
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
          recipient_type: "EMAIL",
          receiver: opts.email,
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

export function verifyWebhook(headers: Headers, event: unknown, webhookId: string) {
  return call<{ verification_status: string }>("POST", "/v1/notifications/verify-webhook-signature", {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: event,
  });
}
