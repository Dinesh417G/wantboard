import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/paypal";
import { mutate, log } from "@/lib/store";

/** PayPal webhook receiver. Needs PAYPAL_WEBHOOK_ID (from the dashboard, once a public URL exists). */
export async function POST(req: Request) {
  const raw = await req.text();
  let event: { id?: string; event_type?: string; resource?: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
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
  console.info("[webhook] verified", event.event_type, event.id);

  const res = event.resource ?? {};
  const ids: string[] = [
    res.id,
    res.custom_id,
    res.invoice_id,
    res.supplementary_data?.related_ids?.authorization_id,
    res.batch_header?.payout_batch_id,
    res.payout_batch_id,
  ].filter((x): x is string => typeof x === "string");

  await mutate((db) => {
    const r = db.requests.find(
      (x) =>
        ids.includes(x.id) ||
        Object.values(x.paypal).some((p) => typeof p === "string" && ids.includes(p)) ||
        x.paypal.refunds.some((f) => ids.includes(f.id)),
    );
    const tag = `(event ${String(event.id ?? "").slice(0, 40)})`;
    if (r && !r.events.some((e) => e.text.includes(tag))) log(r, `PayPal webhook confirmed: ${event.event_type} ${tag}`, "money");
  });
  return NextResponse.json({ ok: true });
}
