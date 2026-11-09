import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/paypal";
import { mutate, log } from "@/lib/store";

/** PayPal webhook receiver. Needs PAYPAL_WEBHOOK_ID (from the dashboard, once a public URL exists). */
export async function POST(req: Request) {
  const event = await req.json().catch(() => null);
  if (!event) return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  const v = await verifyWebhook(req.headers, event, webhookId).catch(() => null);
  if (v?.verification_status !== "SUCCESS") return NextResponse.json({ error: "bad signature" }, { status: 400 });

  const res = event.resource ?? {};
  const ids: string[] = [
    res.id,
    res.custom_id,
    res.invoice_id,
    res.supplementary_data?.related_ids?.authorization_id,
    res.batch_header?.payout_batch_id,
    res.payout_batch_id,
  ].filter((x): x is string => typeof x === "string");

  mutate((db) => {
    const r = db.requests.find((x) => ids.includes(x.id) || Object.values(x.paypal).some((p) => p && ids.includes(p)));
    if (r) log(r, `PayPal webhook: ${event.event_type}`);
  });
  return NextResponse.json({ ok: true });
}
