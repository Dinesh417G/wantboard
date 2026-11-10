import { isPro } from "@/lib/pro";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Banknote, Hourglass, PackageCheck, Sparkles, Trophy } from "lucide-react";
import { read } from "@/lib/store";
import { requireViewer } from "@/lib/viewer";
import { usd } from "@/lib/domain/money";
import type { Db, Party, WantRequest } from "@/lib/types";
import { StatusPill } from "@/components/StatusPill";
import { Badge, ButtonLink, Card } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

function Row({ r, right, note }: { r: WantRequest; right?: React.ReactNode; note?: React.ReactNode }) {
  return (
    <Link href={`/r/${r.id}`} className="group flex items-center gap-4 rounded-xl border border-line bg-white/[0.02] p-4 transition hover:border-brand/40 hover:bg-white/[0.05]">
      {r.images?.[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.images[0]} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-white/5 font-mono text-[10px] text-dim">{r.code}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium group-hover:text-white">{r.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          <StatusPill status={r.status} /> {note}
        </span>
      </span>
      {right}
      <ArrowRight className="size-4 text-dim transition group-hover:translate-x-0.5 group-hover:text-fg" />
    </Link>
  );
}

function Section({ icon: Icon, title, count, children }: { icon: typeof Sparkles; title: string; count: number; children: React.ReactNode }) {
  return (
    <Card className="min-w-0 p-6">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-brand-2" />
        <h2 className="font-medium">{title}</h2>
        <Badge className="ml-auto">{count}</Badge>
      </div>
      <div className="mt-4 space-y-2">{count ? children : <p className="text-sm text-dim">Nothing here right now.</p>}</div>
    </Card>
  );
}

function SellerDash({ db, me }: { db: Db; me: Party }) {
  const open = db.requests.filter((r) => r.status === "open");
  const matched = open
    .map((r) => ({ r, m: r.matches?.find((x) => x.sellerId === me.id) }))
    .filter(({ r, m }) => m || me.categories.includes(r.category))
    .filter(({ r }) => !r.threads.some((t) => t.sellerId === me.id && t.offers.length))
    .sort((a, b) => (b.m?.score ?? 0) - (a.m?.score ?? 0));
  const mine = db.requests.map((r) => ({ r, t: r.threads.find((t) => t.sellerId === me.id) })).filter((x) => x.t && x.t.offers.length);
  const yourTurn = mine.filter(({ r, t }) => r.status === "open" && t!.offers.at(-1)!.status === "open" && t!.offers.at(-1)!.by === "buyer");
  const waiting = mine.filter(({ r, t }) => r.status === "open" && t!.offers.at(-1)!.status === "open" && t!.offers.at(-1)!.by === "seller");
  const won = mine.filter(({ r, t }) => r.agreement?.threadId === t!.id);
  const toShip = won.filter(({ r }) => r.status === "agreed");
  const earned = won.filter(({ r }) => r.status === "completed").reduce((s, { r }) => s + (r.paypal.payoutCents ?? 0), 0);
  const pending = won.filter(({ r }) => ["agreed", "shipped", "disputed"].includes(r.status)).reduce((s, { r }) => s + (r.paypal.payoutCents ?? 0), 0);

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {[
          ["New matches", String(matched.length)],
          ["Your turn", String(yourTurn.length)],
          ["Paid out via PayPal", usd(earned)],
          ["Held for you", usd(pending)],
        ].map(([k, v]) => (
          <Card key={k} className="p-5">
            <div className="text-[11px] uppercase tracking-wider text-dim">{k}</div>
            <div className="num mt-1 text-2xl font-semibold">{v}</div>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section icon={Sparkles} title="Matched for you" count={matched.length}>
          {matched.map(({ r, m }) => (
            <Row
              key={r.id}
              r={r}
              note={m ? <span className="text-violet-200">Copilot {m.score}: {m.reason}</span> : <span>In your category</span>}
              right={<span className="num text-sm font-semibold">{usd(r.budgetCents)}</span>}
            />
          ))}
        </Section>
        <Section icon={Hourglass} title="Your turn to respond" count={yourTurn.length}>
          {yourTurn.map(({ r, t }) => (
            <Row key={r.id} r={r} note={<span>Buyer countered v{t!.offers.at(-1)!.version}</span>} right={<span className="num text-sm">{usd(t!.offers.at(-1)!.terms.priceCents)}</span>} />
          ))}
        </Section>
        <Section icon={PackageCheck} title="Won · ship these" count={toShip.length}>
          {toShip.map(({ r }) => (
            <Row key={r.id} r={r} note={<span>Deliver by {r.agreement!.terms.deliveryDate}</span>} right={<span className="num text-sm">{usd(r.paypal.payoutCents ?? 0)}</span>} />
          ))}
        </Section>
        <Section icon={Trophy} title="Waiting on buyer · all deals" count={waiting.length + won.length - toShip.length}>
          {[...waiting, ...won.filter(({ r }) => r.status !== "agreed")].map(({ r, t }) => (
            <Row key={r.id} r={r} note={<span>{r.agreement?.threadId === t!.id ? "Won" : `Your v${t!.offers.at(-1)!.version} is with the buyer`}</span>} />
          ))}
        </Section>
      </div>
    </>
  );
}

function BuyerDash({ db, me }: { db: Db; me: Party }) {
  const mine = db.requests.filter((r) => r.buyerId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const needs = mine.filter(
    (r) =>
      r.status === "draft" ||
      r.status === "shipped" ||
      (r.status === "open" && r.threads.some((t) => t.offers.at(-1)?.status === "open" && t.offers.at(-1)?.by === "seller")),
  );
  const held = mine.filter((r) => r.status === "open").reduce((s, r) => s + r.budgetCents, 0);
  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Needs your action", String(needs.length)],
          ["Live requests", String(mine.filter((r) => r.status === "open").length)],
          ["Held by PayPal", usd(held)],
        ].map(([k, v]) => (
          <Card key={k} className="p-5">
            <div className="text-[11px] uppercase tracking-wider text-dim">{k}</div>
            <div className="num mt-1 text-2xl font-semibold">{v}</div>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section icon={Hourglass} title="Needs your action" count={needs.length}>
          {needs.map((r) => (
            <Row
              key={r.id}
              r={r}
              note={
                <span>
                  {r.status === "draft" ? "Secure the budget with PayPal" : r.status === "shipped" ? "Inspect and release payment" : "New offer waiting"}
                </span>
              }
            />
          ))}
        </Section>
        <Section icon={Banknote} title="All my requests" count={mine.length}>
          {mine.map((r) => (
            <Row key={r.id} r={r} note={<span>{r.threads.filter((t) => t.offers.length).length} sellers</span>} right={<span className="num text-sm">{usd(r.paypal.capturedCents ?? r.budgetCents)}</span>} />
          ))}
        </Section>
      </div>
    </>
  );
}

export default async function Dashboard() {
  const db = await read();
  const me = await requireViewer(db, "/dashboard");
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-brand-2">{me.role === "seller" ? "Seller dashboard" : "Buyer dashboard"}</div>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">Hi, {me.name.split(" ")[0]}</h1>
          <p className="mt-2 text-muted">{me.role === "seller" ? `You sell: ${me.categories.join(", ")}.` : "Everything you're buying, in one place."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {me.role === "seller" && (
            <a href="/pro" className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-4 text-sm text-violet-100 hover:bg-brand/20">
              {isPro(me) ? "Clinch Pro · 3% fee" : "Get Clinch Pro: 3% fee"}
            </a>
          )}
          <ButtonLink href={me.role === "seller" ? `/u/${me.handle}` : "/post"} variant="secondary">
            {me.role === "seller" ? "View my trust profile" : "Post a need"}
          </ButtonLink>
        </div>
      </div>
      {me.role === "seller" ? <SellerDash db={db} me={me} /> : <BuyerDash db={db} me={me} />}
    </div>
  );
}
