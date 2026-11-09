"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Check, Clock, Flag, Loader2, Send, ShieldAlert, Undo2, X } from "lucide-react";
import type { RequestView } from "@/lib/dto";
import type { Offer } from "@/lib/types";
import { diffTerms } from "@/lib/domain/offers";
import { feeBreakdown, usd } from "@/lib/domain/money";
import { Badge, Button, Card, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { left, useNow } from "./hooks";
import { Gallery, PhotoPicker } from "@/components/PhotoPicker";

type Thread = RequestView["threads"][number];
type Act = (action: string, payload?: unknown) => Promise<unknown>;

const STATUS_TONE: Record<Offer["status"], "mint" | "neutral" | "rose" | "amber" | "brand"> = {
  open: "mint",
  countered: "neutral",
  superseded: "neutral",
  accepted: "brand",
  rejected: "rose",
  withdrawn: "neutral",
  expired: "amber",
};

export function OfferTimeline({ thread, me, v, act, busy, onCounter }: { thread: Thread; me: "buyer" | "seller"; v: RequestView; act: Act; busy: string | null; onCounter: (o: Offer) => void }) {
  const now = useNow();
  const offers = thread.offers;
  return (
    <ol className="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-line">
      {offers.map((o, idx) => {
        const prev = offers[idx - 1];
        const changes = prev ? diffTerms(prev.terms, o.terms) : [];
        const latest = idx === offers.length - 1;
        const mine = o.by === me;
        const actionable = latest && o.status === "open" && v.status === "open";
        const exp = now === null ? null : Date.parse(o.expiresAt) - now;
        return (
          <motion.li key={o.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="relative pl-10">
            <span
              className={cn(
                "absolute top-4 left-0 grid size-8 place-items-center rounded-full border font-mono text-[10px]",
                latest ? "border-brand/60 bg-brand/20 text-violet-100" : "border-line bg-ink-900 text-dim",
              )}
            >
              v{o.version}
            </span>
            <div className={cn("rounded-2xl border p-4 transition", latest ? "edge glass border-transparent" : "border-line bg-white/[0.015] opacity-80")}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-fg">{o.by === "buyer" ? v.buyer.name : thread.seller.name}</span>
                {mine && <span className="text-dim">(you)</span>}
                <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
                {o.isFinal && <Badge tone="amber">best & final</Badge>}
                {o.status === "open" && exp !== null && (
                  <span className="ml-auto inline-flex items-center gap-1 text-dim">
                    <Clock className="size-3" /> <span className="num">{left(exp)}</span>
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
                <div className="num text-2xl font-semibold">{usd(o.terms.priceCents)}</div>
                <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <div>
                    Delivery <span className="text-fg">{o.terms.deliveryDate}</span>
                  </div>
                  <div>
                    Warranty <span className="text-fg">{o.terms.warrantyMonths ? `${o.terms.warrantyMonths} mo` : "none"}</span>
                  </div>
                  <div>
                    Condition <span className="text-fg">{o.terms.condition}</span>
                  </div>
                  <div>
                    Shipping <span className="text-fg">{o.terms.shipping}</span>
                  </div>
                  <div>
                    Inspection <span className="text-fg">{o.terms.inspectionDays}d</span>
                  </div>
                </dl>
              </div>
              {o.terms.deliveryDate > v.neededBy && <p className="mt-2 text-xs text-amber-200">Delivers after your needed-by date ({v.neededBy}).</p>}
              {changes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {changes
                    .filter((c) => c.field !== "note")
                    .map((c) => {
                      const good = c.better === (me === "buyer" ? "buyer" : "seller");
                      return (
                        <span
                          key={c.field}
                          title={`${c.from} → ${c.to}`}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
                            c.better ? (good ? "bg-mint/12 text-emerald-200" : "bg-amber/12 text-amber-200") : "bg-white/5 text-muted",
                          )}
                        >
                          {c.better && (good ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />)}
                          {c.label} {c.delta ?? `${c.from} → ${c.to}`}
                        </span>
                      );
                    })}
                </div>
              )}
              {(o.message || o.terms.note) && <p className="mt-3 text-sm text-muted">“{o.message || o.terms.note}”</p>}
              {o.images && o.images.length > 0 && <Gallery urls={o.images} className="mt-3 sm:grid-cols-4" />}
              {actionable && !mine && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  <Button variant="success" size="sm" disabled={!!busy} onClick={() => act("accept", { offerId: o.id, version: o.version })}>
                    {busy === "accept" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Accept v{o.version} & sign
                  </Button>
                  {!o.isFinal && (
                    <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => onCounter(o)}>
                      Counter
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => act("reject", { offerId: o.id })}>
                    <X className="size-3.5" /> Decline
                  </Button>
                  {me === "buyer" && (
                    <span className="ml-auto self-center text-[11px] text-dim">
                      PayPal will capture <span className="num">{usd(o.terms.priceCents)}</span> and release{" "}
                      <span className="num">{usd(v.budgetCents - o.terms.priceCents)}</span>
                    </span>
                  )}
                  {me === "seller" && (
                    <span className="ml-auto self-center text-[11px] text-dim">
                      You receive <span className="num">{usd(feeBreakdown(o.terms.priceCents, v.myFeeBps).payoutCents)}</span> after delivery
                    </span>
                  )}
                </div>
              )}
              {actionable && mine && (
                <div className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-xs text-muted">
                  Waiting for {me === "buyer" ? thread.seller.name : v.buyer.name}.
                  <Button variant="ghost" size="sm" className="ml-auto" disabled={!!busy} onClick={() => act("withdraw", { offerId: o.id })}>
                    <Undo2 className="size-3.5" /> Withdraw
                  </Button>
                </div>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

export type Draft = { price: string; deliveryDate: string; warrantyMonths: number; inspectionDays: number; condition: string; shipping: string; message: string; images: string[] };

export function draftFrom(o?: Offer, fallbackDate?: string): Draft {
  return {
    price: o ? (o.terms.priceCents / 100).toFixed(2) : "",
    deliveryDate: o?.terms.deliveryDate ?? fallbackDate ?? "",
    warrantyMonths: o?.terms.warrantyMonths ?? 0,
    inspectionDays: o?.terms.inspectionDays ?? 3,
    condition: o?.terms.condition ?? "new",
    shipping: o?.terms.shipping ?? "included",
    message: "",
    images: [],
  };
}

export function OfferForm({
  title,
  draft,
  setDraft,
  max,
  limitCents,
  role,
  onSubmit,
  busy,
  onCancel,
  feeBps,
}: {
  feeBps: number;
  title: string;
  draft: Draft;
  setDraft: (d: Draft) => void;
  max: number;
  limitCents?: number;
  role: "buyer" | "seller";
  onSubmit: (isFinal: boolean) => void;
  busy: boolean;
  onCancel?: () => void;
}) {
  const [isFinal, setIsFinal] = useState(false);
  const cents = Math.round(Number(draft.price) * 100);
  const beyond = limitCents !== undefined && Number.isFinite(cents) && cents > 0 && (role === "buyer" ? cents > limitCents : cents < limitCents);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setDraft({ ...draft, [k]: k === "warrantyMonths" || k === "inspectionDays" ? Number(e.target.value) : e.target.value });
  return (
    <Card className="edge p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{title}</h3>
        {onCancel && (
          <button onClick={onCancel} className="text-xs text-dim hover:text-fg">
            cancel
          </button>
        )}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Price (USD)" hint={`Up to ${usd(max)} (PayPal hold)`}>
          <Input value={draft.price} onChange={set("price")} inputMode="decimal" className="num" required />
        </Field>
        <Field label="Delivery by">
          <Input type="date" value={draft.deliveryDate} onChange={set("deliveryDate")} min={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label="Warranty (months)">
          <Input type="number" min={0} max={60} value={draft.warrantyMonths} onChange={set("warrantyMonths")} />
        </Field>
        <Field label="Condition">
          <Select value={draft.condition} onChange={set("condition")}>
            <option value="new">new</option>
            <option value="used">used</option>
            <option value="refurbished">refurbished</option>
          </Select>
        </Field>
        <Field label="Shipping">
          <Select value={draft.shipping} onChange={set("shipping")}>
            <option value="included">included</option>
            <option value="extra">billed extra</option>
            <option value="pickup">local pickup</option>
          </Select>
        </Field>
        <Field label="Inspection (days)">
          <Input type="number" min={1} max={14} value={draft.inspectionDays} onChange={set("inspectionDays")} />
        </Field>
      </div>
      <Field label="Message" className="mt-4">
        <Textarea rows={2} value={draft.message} onChange={set("message")} placeholder="Why this offer works…" />
      </Field>
      {role === "seller" && (
        <div className="mt-4">
          <PhotoPicker value={draft.images} onChange={(images) => setDraft({ ...draft, images })} max={4} label="Photos of your item (up to 4)" />
        </div>
      )}
      {beyond && (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-amber/30 bg-amber/10 p-2.5 text-xs text-amber-100">
          <ShieldAlert className="size-4" /> This is beyond your private {role === "buyer" ? "target" : "floor"} of {usd(limitCents!)}. Only you see this warning.
        </p>
      )}
      {role === "seller" && Number.isFinite(cents) && cents > 0 && (
        <p className="mt-3 text-xs text-muted">
          If accepted you receive <span className="num text-fg">{usd(feeBreakdown(cents, feeBps).payoutCents)}</span> after the buyer confirms delivery
          (platform fee <span className="num">{usd(feeBreakdown(cents, feeBps).feeCents)}</span>).
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={isFinal} onChange={(e) => setIsFinal(e.target.checked)} className="accent-amber-400" />
          <Flag className="size-3.5" /> Best & final (no more counters)
        </label>
        <Button className="ml-auto" disabled={busy} onClick={() => onSubmit(isFinal)}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send offer
        </Button>
      </div>
    </Card>
  );
}

export function Chat({ thread, me, act, busy, otherName }: { thread: Thread; me: "buyer" | "seller"; act: Act; busy: string | null; otherName: string }) {
  const [text, setText] = useState("");
  const flagged = thread.messages.some((m) => m.flags.length);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Messages</h3>
        <span className="text-xs text-dim">with {otherName}</span>
      </div>
      <AnimatePresence>
        {flagged && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 flex gap-2 rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs text-amber-100">
            <ShieldAlert className="size-4 shrink-0" />
            <span>
              <b>Scam shield:</b> someone mentioned paying or talking outside {`Clinch`}. Payments made outside the deal room are not protected by the PayPal hold.
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
        {thread.messages.length === 0 && <p className="text-sm text-dim">No messages yet.</p>}
        {thread.messages.map((m) => {
          const mine = m.by === me;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                  mine ? "rounded-br-md bg-brand/25 text-violet-50" : "rounded-bl-md bg-white/[0.06]",
                  m.flags.length > 0 && "ring-1 ring-amber/50",
                )}
              >
                {m.text}
                {m.flags.length > 0 && <div className="mt-1 text-[10px] text-amber-200">flagged: {m.flags.map((f) => f.kind).join(", ")}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act("message", { threadId: thread.id, text })) setText("");
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about condition, photos, shipping…" />
        <Button disabled={!!busy || !text.trim()} type="submit" variant="secondary">
          <Send className="size-4" />
        </Button>
      </form>
    </Card>
  );
}
