"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Banknote, EyeOff, Info, Loader2, ScanSearch, Sparkles, Wand2, ListChecks } from "lucide-react";
import type { RequestView } from "@/lib/dto";
import { usd } from "@/lib/domain/money";
import { Badge, Button, Card, Input, cn } from "@/components/ui";
import type { Draft } from "./Negotiation";

type Act = (action: string, payload?: unknown) => Promise<unknown>;

type Summary = { summary: string; agreed: string[]; open: string[]; next_step: string };
type Suggestion = { price: string; delivery_date: string; rationale: string; message_draft: string; warnings: string[] };
type Risk = { flags: { field: string; severity: "low" | "medium" | "high"; explanation: string }[] };
type Out =
  | { kind: "summarize"; data: Summary; source: string; model?: string }
  | { kind: "suggest"; data: Suggestion; source: string; model?: string }
  | { kind: "risk"; data: Risk; source: string; model?: string };

export function Copilot({ v, threadId, onUseDraft }: { v: RequestView; threadId?: string; onUseDraft: (d: Partial<Draft>) => void }) {
  const [out, setOut] = useState<Out | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function run(kind: Out["kind"]) {
    setBusy(kind);
    setErr("");
    const res = await fetch(`/api/ai/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: v.id, threadId }) });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) return setErr(json.error ?? "Copilot failed");
    setOut({ kind, ...json });
  }

  const disabled = !threadId;
  return (
    <Card className="edge overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line bg-brand/[0.07] px-5 py-3.5">
        <Sparkles className="size-4 text-violet-300" />
        <span className="font-medium">Copilot</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-dim">drafts only · you decide</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 p-3">
        {(
          [
            ["summarize", ListChecks, "Summarize"],
            ["suggest", Wand2, "Suggest counter"],
            ["risk", ScanSearch, "Risk check"],
          ] as const
        ).map(([k, Icon, label]) => (
          <button
            key={k}
            disabled={disabled || !!busy}
            onClick={() => run(k)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border border-line px-2 py-3 text-[11px] text-muted transition hover:border-brand/40 hover:bg-brand/[0.06] hover:text-fg disabled:opacity-40",
              out?.kind === k && "border-brand/50 bg-brand/[0.08] text-fg",
            )}
          >
            {busy === k ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
            {label}
          </button>
        ))}
      </div>
      {disabled && <p className="px-5 pb-4 text-xs text-dim">Opens once there is a negotiation to look at.</p>}
      {err && <p className="px-5 pb-4 text-xs text-rose-200">{err}</p>}
      <AnimatePresence mode="wait">
        {out && (
          <motion.div key={out.kind + JSON.stringify(out.data).length} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3 border-t border-line p-5 text-sm">
            <div className="flex items-center gap-2">
              <Badge tone={out.source === "ai" ? "brand" : "neutral"}>{out.source === "ai" ? "AI-generated" : "Offline heuristic"}</Badge>
              {out.model && <span className="font-mono text-[10px] text-dim">{out.model}</span>}
            </div>
            {out.kind === "summarize" && (
              <>
                <p>{out.data.summary}</p>
                {out.data.agreed.length > 0 && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-dim">Agreed</div>
                    <ul className="mt-1 list-inside list-disc text-muted">{out.data.agreed.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                )}
                {out.data.open.length > 0 && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-dim">Still open</div>
                    <ul className="mt-1 list-inside list-disc text-muted">{out.data.open.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                )}
                <p className="rounded-xl bg-white/[0.04] p-3 text-xs">
                  <b>Next:</b> {out.data.next_step}
                </p>
              </>
            )}
            {out.kind === "suggest" && (
              <>
                {out.data.price && <div className="num text-2xl font-semibold">${Number(out.data.price).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>}
                <p className="text-muted">{out.data.rationale}</p>
                {out.data.message_draft && <p className="rounded-xl bg-white/[0.04] p-3 text-xs italic">“{out.data.message_draft}”</p>}
                {out.data.warnings.map((w) => (
                  <p key={w} className="flex gap-2 text-xs text-amber-200">
                    <AlertTriangle className="size-3.5 shrink-0" /> {w}
                  </p>
                ))}
                {out.data.price && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onUseDraft({ price: out.data.price, ...(out.data.delivery_date ? { deliveryDate: out.data.delivery_date } : {}), message: out.data.message_draft })}
                  >
                    Put into my counter (I&apos;ll review)
                  </Button>
                )}
              </>
            )}
            {out.kind === "risk" && (
              <>
                {out.data.flags.length === 0 && <p className="text-muted">No obvious risks in the latest offer.</p>}
                {out.data.flags.map((f, i) => (
                  <div key={i} className="flex gap-2.5">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", f.severity === "high" ? "bg-rose" : f.severity === "medium" ? "bg-amber" : "bg-dim")} />
                    <p>
                      <b className="font-medium">{f.field}:</b> <span className="text-muted">{f.explanation}</span>
                    </p>
                  </div>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function PrivateLimit({ v, threadId, act, busy }: { v: RequestView; threadId?: string; act: Act; busy: string | null }) {
  const [val, setVal] = useState(v.myLimitCents !== undefined ? (v.myLimitCents / 100).toFixed(2) : "");
  const buyer = v.viewerRole === "buyer";
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <EyeOff className="size-4 text-dim" />
        <span className="font-medium">{buyer ? "Private target" : "Private floor"}</span>
        <Badge className="ml-auto">only you</Badge>
      </div>
      <p className="mt-2 text-xs text-muted">
        {buyer ? "The most you'd really like to pay." : "The lowest you'll accept."} Never shown to the other side or used in their copilot.
      </p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          act("limit", { amount: val, threadId });
        }}
      >
        <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. 1150" inputMode="decimal" className="num" />
        <Button size="md" variant="secondary" disabled={busy === "limit"} type="submit">
          Save
        </Button>
      </form>
    </Card>
  );
}

export function MoneyTrail({ v }: { v: RequestView }) {
  const p = v.paypal;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Banknote className="size-4 text-sky-300" />
        <span className="font-medium">Money trail</span>
        {v.sample && <Badge tone="amber">sample · simulated</Badge>}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        {[
          ["Held", v.status === "draft" ? "—" : usd(v.budgetCents)],
          ["Captured", p.capturedCents !== undefined ? usd(p.capturedCents) : "—"],
          ["Refunded", p.refunds.length ? usd(p.refunds.reduce((s, r) => s + r.cents, 0)) : "—"],
          ["Paid to seller", v.status === "completed" && p.payoutCents ? usd(p.payoutCents) : "—"],
        ].map(([k, val]) => (
          <div key={k} className="rounded-xl border border-line bg-white/[0.02] p-2.5">
            <dt className="text-dim">{k}</dt>
            <dd className="num mt-0.5 text-sm text-fg">{val}</dd>
          </div>
        ))}
      </dl>
      <ol className="mt-5 space-y-3 border-l border-line pl-4 text-xs">
        {[...v.events].reverse().map((e, i) => (
          <li key={i} className="relative">
            <span
              className={cn(
                "absolute top-1 -left-[21px] size-2.5 rounded-full border-2 border-ink-950",
                e.kind === "money" ? "bg-sky-400" : e.kind === "warn" ? "bg-amber" : "bg-dim",
              )}
            />
            <div className="num text-[10px] text-dim">{e.at.slice(0, 16).replace("T", " ")} UTC</div>
            <div className={cn("mt-0.5", e.kind === "money" ? "text-sky-100" : e.kind === "warn" ? "text-amber-100" : "text-muted")}>{e.text}</div>
          </li>
        ))}
      </ol>
      {p.authorizationId && !v.sample && (
        <p className="mt-4 flex gap-1.5 border-t border-line pt-3 text-[10px] text-dim">
          <Info className="size-3 shrink-0" /> IDs match the PayPal sandbox dashboard (Activity) for the business account.
        </p>
      )}
    </Card>
  );
}
