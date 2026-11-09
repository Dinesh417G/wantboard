"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Lock, MapPin, ShieldCheck, Users, XCircle } from "lucide-react";
import type { RequestView } from "@/lib/dto";
import type { Offer } from "@/lib/types";
import { usd } from "@/lib/domain/money";
import { StatusPill } from "@/components/StatusPill";
import { Badge, Button, Card, cn } from "@/components/ui";
import { useAct } from "./hooks";
import { Chat, OfferForm, OfferTimeline, draftFrom, type Draft } from "./Negotiation";
import { Copilot, MoneyTrail, PrivateLimit } from "./Side";
import { AfterAgreement, AgreementCard, HoldPanel, Stepper } from "./Stages";
import { Gallery } from "@/components/PhotoPicker";
import { Sparkles } from "lucide-react";

const HONOR_MS = 3 * 86_400_000;

export function DealRoom({ v, clientId, canSell }: { v: RequestView; clientId: string; canSell: boolean }) {
  const { act, busy, error, setError } = useAct(v.id);
  const me = v.viewerRole === "visitor" ? null : v.viewerRole;
  const winnerId = v.agreement?.threadId;
  const [threadId, setThreadId] = useState<string | undefined>(winnerId ?? v.threads[0]?.id);
  const thread = v.threads.find((t) => t.id === threadId) ?? v.threads[0];
  const [countering, setCountering] = useState<Offer | null>(null);
  const [draft, setDraft] = useState<Draft>(draftFrom(undefined, v.neededBy));

  const renewTried = useRef(false);
  // Auto-release check when the inspection window has passed.
  useEffect(() => {
    if (v.status === "shipped" && v.delivery && Date.parse(v.delivery.inspectionEndsAt) <= Date.now()) act("tick");
    // PayPal's 3-day honor period ran out: the server renews the hold.
    else if (!renewTried.current && v.status === "open" && !v.sample && v.paypal.authorizedAt && Date.now() - Date.parse(v.paypal.authorizedAt) > HONOR_MS) {
      renewTried.current = true; // once per visit, even if PayPal refuses
      act("tick");
    }
  }, [v.status, v.delivery, v.sample, v.paypal.authorizedAt, act]);

  const latest = thread?.offers.at(-1);
  const sellerCanOffer = me === "seller" && canSell && v.canOffer && v.status === "open" && (!latest || latest.status !== "open" || latest.by === "buyer");
  const showForm = (countering || (sellerCanOffer && !thread)) && v.status === "open";

  function startCounter(o: Offer) {
    setCountering(o);
    setDraft(draftFrom(o));
  }

  const sortedThreads = useMemo(
    () => [...v.threads].sort((a, b) => (a.offers.at(-1)?.terms.priceCents ?? 1e12) - (b.offers.at(-1)?.terms.priceCents ?? 1e12)),
    [v.threads],
  );

  async function sendOffer(isFinal: boolean) {
    const ok = await act("offer", { ...draft, threadId: thread?.id, isFinal });
    if (ok) setCountering(null);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-dim">
            <Link href="/board" className="hover:text-fg">
              Board
            </Link>
            <span>/</span>
            <span className="font-mono">{v.code}</span>
            <StatusPill status={v.status} />
            {v.sample && <Badge tone="amber">sample deal · PayPal steps simulated</Badge>}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{v.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            <span>{v.category}</span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" /> needed by {v.neededBy}
            </span>
            <Link href={`/u/${v.buyer.handle}`} className="hover:text-fg">
              {v.buyer.name}
            </Link>
            {v.shipTo ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" /> deliver to {v.shipTo.city}, {v.shipTo.state} {v.shipTo.zip}
                <Badge tone={v.reach && v.reach !== "us" ? "amber" : "neutral"}>{v.reachText}</Badge>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" /> {v.buyer.city}
              </span>
            )}
          </div>
        </div>
        <Card className="edge flex items-center gap-4 p-4">
          <div className="grid size-11 place-items-center rounded-xl bg-paypal/20 text-sky-200">
            <Lock className="size-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-dim">{v.status === "draft" ? "Max price" : "PayPal holding"}</div>
            <div className="num text-2xl font-semibold">{usd(v.paypal.capturedCents ?? v.budgetCents)}</div>
            {v.status === "open" && v.paypal.authorizedAt && (
              <div className="text-[11px] text-dim">
                guaranteed to {new Date(Date.parse(v.paypal.authorizedAt) + HONOR_MS).toISOString().slice(0, 10)}
                {v.paypal.reauthorizations ? ` · renewed ${v.paypal.reauthorizations}×` : " · auto-renews"}
              </div>
            )}
          </div>
        </Card>
      </div>
      <div className="mt-6">
        <Stepper v={v} />
      </div>

      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-rose/30 bg-rose/10 p-3 text-sm text-rose-100">
          <XCircle className="size-4 shrink-0" /> {error}
          <button className="ml-auto text-xs text-rose-200/70 hover:text-rose-100" onClick={() => setError("")}>
            dismiss
          </button>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {/* Request details */}
          <Card className="p-6">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-fg/90">{v.description}</p>
            {v.images && v.images.length > 0 && <Gallery urls={v.images} className="mt-5" />}
            {v.preferences.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {v.preferences.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-3 py-1 text-xs text-muted">
                    <ShieldCheck className="size-3 text-brand-2" /> {p}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {v.matches && v.matches.length > 0 && (me === "buyer" || v.matches.some((m) => m.sellerId === v.mySellerId)) && (
            <Card className="edge p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-violet-300" />
                <span className="font-medium">{me === "buyer" ? "Copilot matched these sellers and invited them" : "Copilot matched you to this request"}</span>
                <Badge tone={v.matches[0].source === "ai" ? "brand" : "neutral"} className="ml-auto">
                  {v.matches[0].source === "ai" ? "AI-generated" : "Offline heuristic"}
                </Badge>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {v.matches
                  .filter((m) => me === "buyer" || m.sellerId === v.mySellerId)
                  .map((m) => (
                    <div key={m.sellerId} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] p-3">
                      <span className="num grid size-10 shrink-0 place-items-center rounded-lg bg-brand/15 text-sm text-violet-100">{m.score}</span>
                      <span className="min-w-0 text-sm">
                        <span className="block font-medium">{m.sellerName}</span>
                        <span className="block truncate text-xs text-muted">{m.reason}</span>
                      </span>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {v.status === "draft" && me === "buyer" && <HoldPanel v={v} clientId={clientId} act={act} setError={setError} />}
          {v.status === "draft" && me !== "buyer" && <Card className="p-6 text-sm text-muted">The buyer hasn&apos;t secured the budget with PayPal yet.</Card>}

          {v.agreement && <AgreementCard v={v} />}
          {v.agreement && <AfterAgreement v={v} act={act} busy={busy} />}

          {/* Negotiation */}
          {v.status !== "draft" && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-medium">{v.agreement ? "Negotiation history" : "Offers"}</h2>
                {me === "seller" && v.otherOfferCount > 0 && (
                  <Badge>
                    <Users className="size-3" /> {v.otherOfferCount} other seller{v.otherOfferCount === 1 ? "" : "s"} competing
                  </Badge>
                )}
                {me === "seller" && !canSell && <Badge tone="amber">not in your categories</Badge>}
                {me === "seller" && canSell && !v.canOffer && <Badge tone="amber">outside the buyer&apos;s area: {v.reachText}</Badge>}
              </div>

              {me === "buyer" && v.threads.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {sortedThreads.map((t) => {
                    const o = t.offers.at(-1);
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setThreadId(t.id);
                          setCountering(null);
                        }}
                        className={cn(
                          "glass flex items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm transition",
                          t.id === thread?.id ? "border-brand/50 bg-brand/[0.1]" : "hover:bg-white/[0.06]",
                        )}
                      >
                        <span>
                          <span className="block font-medium">{t.seller.name}</span>
                          <span className="block text-[11px] text-dim">
                            {t.offers.length} version{t.offers.length === 1 ? "" : "s"}
                            {t.messages.some((m) => m.flags.length) && <span className="text-amber-200"> · flagged</span>}
                          </span>
                        </span>
                        {o && <span className="num font-semibold">{usd(o.terms.priceCents)}</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {thread && me && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  with{" "}
                  <Link className="text-fg hover:underline" href={`/u/${me === "buyer" ? thread.seller.handle : v.buyer.handle}`}>
                    {me === "buyer" ? thread.seller.name : v.buyer.name}
                  </Link>
                  {me === "buyer" && <span className="text-dim">· {thread.seller.city}</span>}
                </div>
              )}

              {thread && me && <OfferTimeline thread={thread} me={me} v={v} act={act} busy={busy} onCounter={startCounter} />}
              {!thread && v.status === "open" && me === "buyer" && (
                <Card className="p-8 text-center text-sm text-muted">
                  <div className="mx-auto mb-3 size-2 rounded-full bg-mint animate-pulse-ring" />
                  Live. Sellers in “{v.category}” can see your request and send offers here.
                </Card>
              )}
              {me === null && (
                <Card className="flex flex-wrap items-center gap-3 p-6 text-sm text-muted">
                  Sellers can make offers here. Buyers see every offer on their own requests.
                  <Link href={`/login?next=/r/${v.id}`} className="ml-auto rounded-xl bg-brand/20 px-4 py-2 text-violet-100 hover:bg-brand/30">
                    Sign in to make an offer
                  </Link>
                </Card>
              )}

              {showForm && me && (
                <OfferForm
                  title={countering ? `Counter v${countering.version}` : "Make your offer"}
                  draft={draft}
                  setDraft={setDraft}
                  max={v.budgetCents}
                  limitCents={v.myLimitCents}
                  role={me}
                  busy={busy === "offer"}
                  onSubmit={sendOffer}
                  onCancel={countering ? () => setCountering(null) : undefined}
                />
              )}
              {sellerCanOffer && thread && !countering && (
                <Button variant="secondary" onClick={() => startCounter(thread.offers.at(-1)!)}>
                  {latest?.by === "buyer" ? "Counter their offer" : "Send a new version"}
                </Button>
              )}

              {thread && me && <Chat thread={thread} me={me} act={act} busy={busy} otherName={me === "buyer" ? thread.seller.name : v.buyer.name} />}
            </section>
          )}

          {me === "buyer" && (v.status === "open" || v.status === "draft") && (
            <div className="flex justify-end">
              <Button variant="danger" size="sm" disabled={!!busy} onClick={() => act("cancel")}>
                {v.status === "open" ? "Cancel request & release PayPal hold" : "Cancel request"}
              </Button>
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {me && v.status === "open" && (
            <Copilot
              v={v}
              threadId={thread?.id}
              onUseDraft={(d) => {
                const base = thread?.offers.at(-1);
                setCountering(base ?? null);
                setDraft({ ...draftFrom(base, v.neededBy), ...d });
              }}
            />
          )}
          {me && v.status === "open" && (me === "buyer" || thread) && <PrivateLimit v={v} threadId={thread?.id} act={act} busy={busy} />}
          <MoneyTrail v={v} />
        </aside>
      </div>
    </div>
  );
}
