"use client";

import { useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { CheckCircle2, Fingerprint, Gavel, Loader2, Lock, PackageCheck, Star, Timer, Truck } from "lucide-react";
import type { RequestView } from "@/lib/dto";
import { usd } from "@/lib/domain/money";
import { Badge, Button, Card, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { left, useNow } from "./hooks";

type Act = (action: string, payload?: unknown) => Promise<unknown>;

const STEPS = ["Posted", "Funds held", "Negotiating", "Agreed", "Shipped", "Inspected", "Paid out"];
const STEP_OF: Record<RequestView["status"], number> = { draft: 0, open: 2, agreed: 3, shipped: 4, disputed: 5, completed: 7, cancelled: -1 };

export function Stepper({ v }: { v: RequestView }) {
  const at = STEP_OF[v.status];
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const done = at > i || (at === 7 && i === 6);
        const now = at === i;
        const warn = v.status === "disputed" && i === 5;
        return (
          <div key={s} className="flex min-w-fit items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] transition",
                done && "border-mint/30 bg-mint/10 text-emerald-200",
                now && !warn && "border-brand/50 bg-brand/15 text-violet-100",
                warn && "border-amber/40 bg-amber/10 text-amber-100",
                !done && !now && !warn && "border-line text-dim",
              )}
            >
              {done ? <CheckCircle2 className="size-3" /> : <span className="num text-[10px]">{i + 1}</span>}
              {warn ? "Dispute" : s}
            </div>
            {i < STEPS.length - 1 && <div className={cn("h-px w-4", done ? "bg-mint/40" : "bg-line")} />}
          </div>
        );
      })}
    </div>
  );
}

export function HoldPanel({ v, clientId, act, setError }: { v: RequestView; clientId: string; act: Act; setError: (s: string) => void }) {
  return (
    <Card className="edge p-6">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-paypal/20 text-sky-200">
          <Lock className="size-5" />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-medium">Let PayPal hold {usd(v.budgetCents)}</h2>
          <p className="mt-1 text-sm text-muted">
            This is an authorization, not a charge. Sellers see “funds held by PayPal” and start bidding. When you accept an offer PayPal takes only that price and releases the rest.
            Cancel any time before then and nothing is charged. Pay with PayPal balance, card or Pay Later.
          </p>
          <div className="mt-5 max-w-sm rounded-2xl bg-white p-3">
            {clientId ? (
              <PayPalScriptProvider options={{ clientId, currency: "USD", intent: "authorize", enableFunding: "paylater", buyerCountry: "US", components: "buttons" }}>
                <PayPalButtons
                  style={{ layout: "vertical", shape: "pill", color: "gold", label: "paypal" }}
                  createOrder={async () => {
                    const res = await fetch(`/api/requests/${v.id}/hold`, { method: "POST" });
                    const out = await res.json();
                    if (!res.ok) throw new Error(out.error);
                    return out.orderId;
                  }}
                  onApprove={async (data) => {
                    await act("authorize", { orderId: data.orderID });
                  }}
                  onError={(e) => setError(String(e?.message ?? "PayPal error"))}
                />
              </PayPalScriptProvider>
            ) : (
              <p className="text-sm text-rose-600">PAYPAL_CLIENT_ID is not configured.</p>
            )}
          </div>
          <p className="mt-3 text-xs text-dim">Sandbox: log in with a PayPal sandbox personal account.</p>
        </div>
      </div>
    </Card>
  );
}

export function AgreementCard({ v }: { v: RequestView }) {
  const a = v.agreement!;
  const t = v.threads.find((x) => x.id === a.threadId);
  const [full, setFull] = useState(false);
  return (
    <Card className="edge p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-mint/15 text-mint">
          <Fingerprint className="size-5" />
        </span>
        <div>
          <h2 className="font-medium">Agreement v{a.version}</h2>
          <p className="text-xs text-muted">
            {v.buyer.name} and {t?.seller.name ?? "the seller"} · signed {a.createdAt.slice(0, 10)}
          </p>
        </div>
        <button onClick={() => setFull((x) => !x)} className="ml-auto rounded-lg border border-line px-2.5 py-1 font-mono text-[11px] text-muted hover:text-fg" title="SHA-256 of the canonical terms">
          sha256 {full ? a.termsHash : `${a.termsHash.slice(0, 12)}…`}
        </button>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {[
          ["Price", usd(a.terms.priceCents)],
          ["Delivery by", a.terms.deliveryDate],
          ["Warranty", a.terms.warrantyMonths ? `${a.terms.warrantyMonths} months` : "none"],
          ["Condition", a.terms.condition],
          ["Shipping", a.terms.shipping],
          ["Inspection", `${a.terms.inspectionDays} days`],
        ].map(([k, val]) => (
          <div key={k} className="rounded-xl border border-line bg-white/[0.02] p-3">
            <dt className="text-[11px] text-dim">{k}</dt>
            <dd className="num mt-0.5">{val}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-dim">Accepting this exact version signed it for both sides. The fingerprint changes if any term changes, so either party can prove what was agreed.</p>
    </Card>
  );
}

export function AfterAgreement({ v, act, busy }: { v: RequestView; act: Act; busy: string | null }) {
  const now = useNow(30_000);
  const role = v.viewerRole;
  const winner = v.threads.find((t) => t.id === v.agreement?.threadId);
  const isSeller = role === "seller" && !!winner;
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [dReason, setDReason] = useState("not_as_described");
  const [dText, setDText] = useState("");
  const [refund, setRefund] = useState("");
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const ends = v.delivery ? Date.parse(v.delivery.inspectionEndsAt) : 0;
  const remaining = now === null ? null : ends - now;

  return (
    <div className="space-y-4">
      {v.status === "agreed" && (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Truck className="size-5 text-brand-2" />
            <h3 className="font-medium">{isSeller ? "Ship it" : `Waiting for ${winner?.seller.name ?? "the seller"} to ship`}</h3>
            <Badge tone="paypal" className="ml-auto">
              PayPal captured {usd(v.paypal.capturedCents ?? 0)}
            </Badge>
          </div>
          {(isSeller || role === "buyer") && v.shipTo?.full && (
            <div className="mt-4 rounded-xl border border-line bg-white/[0.03] p-3 text-sm">
              <div className="text-[11px] uppercase tracking-wider text-dim">Ship to (also on the PayPal order)</div>
              <div className="mt-1">{v.shipTo.name}</div>
              <div className="text-muted">
                {[v.shipTo.line1, v.shipTo.line2].filter(Boolean).join(", ")}, {v.shipTo.city}, {v.shipTo.state} {v.shipTo.zip}
              </div>
            </div>
          )}
          {isSeller ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Tracking">
                <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="UPS 1Z…" />
              </Field>
              <Field label="Delivery note">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Packed with mill cert" />
              </Field>
              <Button disabled={!!busy} onClick={() => act("ship", { tracking, note })}>
                {busy === "ship" ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />} Mark shipped
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              The seller is paid only after delivery and your inspection. Changed your mind before it ships? Cancel and PayPal refunds you in full.
            </p>
          )}
          {role === "buyer" && (
            <Button variant="danger" size="sm" className="mt-4" disabled={!!busy} onClick={() => act("cancel")}>
              Cancel & refund {usd(v.paypal.capturedCents ?? 0)}
            </Button>
          )}
        </Card>
      )}

      {(v.status === "shipped" || v.status === "disputed") && v.delivery && (
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Timer className="size-5 text-brand-2" />
            <h3 className="font-medium">Inspection window</h3>
            {v.status === "shipped" && remaining !== null && (
              <Badge tone="cyan" className="ml-auto">
                <span className="num">{left(remaining)}</span> left · then auto-release
              </Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-muted">
            Shipped {v.delivery.at.slice(0, 10)}
            {v.delivery.tracking && (
              <>
                {" "}
                · tracking <span className="font-mono text-fg">{v.delivery.tracking}</span>
              </>
            )}
            {v.delivery.note && <> · “{v.delivery.note}”</>}
          </p>
          {v.status === "shipped" && role === "buyer" && (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-mint/25 bg-mint/[0.05] p-4">
                <div className="font-medium">Looks right?</div>
                <p className="mt-1 text-xs text-muted">PayPal Payouts sends {usd(v.paypal.payoutCents ?? 0)} to the seller.</p>
                <Button variant="success" className="mt-3" disabled={!!busy} onClick={() => act("release")}>
                  {busy === "release" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Accept & pay seller
                </Button>
              </div>
              <div className="rounded-2xl border border-amber/25 bg-amber/[0.04] p-4">
                <div className="font-medium">Something wrong?</div>
                <div className="mt-2 space-y-2">
                  <Select value={dReason} onChange={(e) => setDReason(e.target.value)}>
                    <option value="not_as_described">Not as described</option>
                    <option value="damaged">Arrived damaged</option>
                    <option value="partial">Partly missing</option>
                    <option value="not_delivered">Not delivered</option>
                    <option value="other">Other</option>
                  </Select>
                  <Textarea rows={2} value={dText} onChange={(e) => setDText(e.target.value)} placeholder="What's wrong? Photos help." />
                  <Button variant="danger" size="sm" disabled={!!busy} onClick={() => act("dispute", { reason: dReason, description: dText })}>
                    <Gavel className="size-3.5" /> Open dispute & freeze payment
                  </Button>
                </div>
              </div>
            </div>
          )}
          {v.status === "shipped" && role !== "buyer" && <p className="mt-4 text-sm text-muted">The buyer is inspecting. If they do nothing, payment releases to you automatically when the window ends.</p>}
        </Card>
      )}

      {v.status === "disputed" && v.dispute && (
        <Card className="border-amber/30 p-6">
          <div className="flex items-center gap-3">
            <Gavel className="size-5 text-amber" />
            <h3 className="font-medium">Dispute: {v.dispute.reason.replaceAll("_", " ")}</h3>
            <Badge tone="amber" className="ml-auto">
              payment frozen
            </Badge>
          </div>
          <p className="mt-3 text-sm text-muted">“{v.dispute.description}”</p>
          <p className="mt-2 text-xs text-dim">Seller response due {v.dispute.respondBy.slice(0, 16).replace("T", " ")} UTC. Evidence: agreement, every offer version, chat and delivery proof are attached automatically.</p>
          {v.dispute.proposal ? (
            <div className="mt-4 rounded-2xl border border-line bg-white/[0.03] p-4">
              <div className="text-sm">
                Seller proposes refunding <b className="num">{usd(v.dispute.proposal.refundCents)}</b> of <span className="num">{usd(v.paypal.capturedCents ?? 0)}</span>.
              </div>
              {v.dispute.proposal.note && <p className="mt-1 text-xs text-muted">“{v.dispute.proposal.note}”</p>}
              {role === "buyer" && (
                <Button variant="success" size="sm" className="mt-3" disabled={!!busy} onClick={() => act("settle")}>
                  {busy === "settle" ? <Loader2 className="size-3.5 animate-spin" /> : null} Accept settlement
                </Button>
              )}
            </div>
          ) : (
            isSeller && (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <Field label="Refund to buyer (USD)">
                  <Input value={refund} onChange={(e) => setRefund(e.target.value)} inputMode="decimal" className="num w-40" />
                </Field>
                <Field label="Note" className="min-w-48 flex-1">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Partial refund for the scratch" />
                </Field>
                <Button disabled={!!busy} onClick={() => act("propose", { refund, note })}>
                  Propose settlement
                </Button>
              </div>
            )
          )}
          {!v.dispute.proposal && role === "buyer" && <p className="mt-4 text-sm text-muted">Waiting for the seller to answer. If they don&apos;t, the dispute goes to Clinch mediation.</p>}
        </Card>
      )}

      {v.status === "completed" && (
        <Card className="edge p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-6 text-mint" />
            <div>
              <h3 className="font-medium">Deal closed</h3>
              <p className="text-xs text-muted">
                Seller received {usd(v.paypal.payoutCents ?? 0)} via PayPal Payouts{v.paypal.payoutBatchId ? ` (batch ${v.paypal.payoutBatchId})` : ""}.
              </p>
            </div>
          </div>
          {(role === "buyer" || isSeller) && !v.reviews.some((r) => r.by === role) && (
            <div className="mt-5 space-y-3 border-t border-line pt-5">
              <div className="text-sm font-medium">Leave a review</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                    <Star className={cn("size-6", n <= rating ? "fill-amber text-amber" : "text-dim")} />
                  </button>
                ))}
              </div>
              <Textarea rows={2} value={review} onChange={(e) => setReview(e.target.value)} placeholder="How did it go?" />
              <Button size="sm" disabled={!!busy} onClick={() => act("review", { rating, text: review })}>
                Submit review
              </Button>
              <p className="text-xs text-dim">Double-blind: reviews stay hidden until both sides have submitted.</p>
            </div>
          )}
          {v.reviews.length === 2 && (
            <div className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
              {v.reviews.map((r) => (
                <div key={r.by} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex items-center gap-1 text-amber">
                    {Array.from({ length: r.rating }, (_, i) => (
                      <Star key={i} className="size-3.5 fill-amber" />
                    ))}
                    <span className="ml-1 text-xs text-dim">from {r.by}</span>
                  </div>
                  <p className="mt-1 text-muted">{r.text || "—"}</p>
                </div>
              ))}
            </div>
          )}
          {v.reviews.length === 1 && <p className="mt-4 text-xs text-dim">One review submitted; it publishes when the other side reviews.</p>}
        </Card>
      )}
    </div>
  );
}
