import { NextResponse } from "next/server";
import { disputedCaptureIds, getDispute, verifyWebhook } from "@/lib/paypal";
import { mutate, log, read } from "@/lib/store";
import { applyCaptureReversal, applyPayoutStatus, applyPayPalDispute } from "@/lib/engine";
import { refreshPro } from "@/lib/pro";
import type { WantRequest } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- PayPal webhook resources are loosely typed
type Resource = Record<string, any>;

/** PayPal webhook receiver. Needs PAYPAL_WEBHOOK_ID (from the dashboard). Every event is signature-checked by PayPal first. */
export async function POST(req: Request) {
  const raw = await req.text();
  let event: { id?: string; event_type?: string; resource?: Resource };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  const v = await verifyWebhook(req.headers, raw, webhookId).catch((e) => ({ verification_status: `ERROR ${(e as Error).message}`, detail: undefined }));
  if (v.verification_status !== "SUCCESS") {
    console.warn("[webhook] rejected", event.event_type, event.id, v.verification_status, JSON.stringify(v.detail ?? "").slice(0, 300));
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  const type = String(event.event_type ?? "");
  console.info("[webhook] verified", type, event.id);
  const res: Resource = event.resource ?? {};

  try {
    // Seller payouts: item succeeded / unclaimed / failed / returned...
    if (type.startsWith("PAYMENT.PAYOUTS-ITEM.")) {
      const r = await findRequest([res.payout_batch_id]);
      if (r) await applyPayoutStatus(r.id, String(res.transaction_status ?? type.split(".").at(-1)), res.payout_item_id, res.errors?.message);
    }
    // Disputes the buyer opened in PayPal.
    if (type.startsWith("CUSTOMER.DISPUTE.") && res.dispute_id) {
      const r = await findRequest(disputedCaptureIds(res));
      if (r) await applyPayPalDispute(r.id, await getDispute(res.dispute_id));
    }
    // PayPal took a captured payment back (chargeback, bank reversal). The resource is usually the reversal (refund)
    // record; its "up" link points at the original capture.
    if (type === "PAYMENT.CAPTURE.REVERSED") {
      const up = (Array.isArray(res.links) ? res.links : []).map((l: { href?: string }) => /\/captures\/([^/?]+)/.exec(String(l?.href ?? ""))?.[1]);
      const r = await findRequest([res.id, ...up, res.invoice_id, res.custom_id]);
      if (r) await applyCaptureReversal(r.id, "webhook", `PayPal event ${event.id ?? type}${res.reason_code ? `, reason ${res.reason_code}` : ""}`);
    }
    // Clinch Pro subscriptions (activated, cancelled, suspended, renewed...).
    const subId = type.startsWith("BILLING.SUBSCRIPTION.") ? res.id : type === "PAYMENT.SALE.COMPLETED" ? res.billing_agreement_id : undefined;
    if (typeof subId === "string") {
      const p = (await read()).parties.find((x) => x.pro?.subscriptionId === subId);
      if (p) await refreshPro(p.id, subId);
    }
  } catch (e) {
    // Answer 500 so PayPal retries later.
    console.warn("[webhook] handler failed", type, (e as Error).message);
    return NextResponse.json({ error: "temporary failure" }, { status: 500 });
  }

  // Audit trail on the deal for every money event we can match.
  const ids: string[] = [
    res.id,
    res.custom_id,
    res.invoice_id,
    res.supplementary_data?.related_ids?.authorization_id,
    res.batch_header?.payout_batch_id,
    res.payout_batch_id,
    ...disputedCaptureIds(res),
  ].filter((x): x is string => typeof x === "string");
  await mutate((db) => {
    const r = db.requests.find((x) => matches(x, ids));
    const tag = `(event ${String(event.id ?? "").slice(0, 40)})`;
    if (r && !r.events.some((e) => e.text.includes(tag))) log(r, `PayPal webhook confirmed: ${type} ${tag}`, "money");
  });
  return NextResponse.json({ ok: true });
}

function matches(r: WantRequest, ids: string[]) {
  return ids.includes(r.id) || Object.values(r.paypal).some((p) => typeof p === "string" && ids.includes(p)) || r.paypal.refunds.some((f) => ids.includes(f.id));
}

async function findRequest(ids: unknown[]) {
  const list = ids.filter((x): x is string => typeof x === "string" && !!x);
  if (!list.length) return undefined;
  return (await read()).requests.find((r) => matches(r, list));
}
