import {
  ArrowRight,
  BadgeCheck,
  Check,
  FileSignature,
  GitCompareArrows,
  Lock,
  MessageSquareWarning,
  Minus,
  PackageCheck,
  Scale,
  Sparkles,
  Telescope,
  X,
} from "lucide-react";
import { Aurora } from "@/components/chrome";
import { HeroDeal } from "@/components/HeroDeal";
import { Reveal } from "@/components/Reveal";
import { ButtonLink, Card, Eyebrow } from "@/components/ui";
import { SITE, PLATFORM_FEE_BPS, DEFAULT_INSPECTION_DAYS, OFFER_TTL_HOURS } from "@/lib/config/site";

const STEPS = [
  { icon: Telescope, title: "Post the need", text: "Item, category, needed-by date, max price and the points you care about." },
  { icon: Lock, title: "PayPal holds the budget", text: "Your max price is authorized, not charged. Sellers see the money is real." },
  { icon: GitCompareArrows, title: "Sellers compete", text: "Versioned offers with a line-by-line diff. Every offer has a real expiry." },
  { icon: FileSignature, title: "Accept one exact version", text: "The terms become a signed agreement with a SHA-256 fingerprint. PayPal takes only that price." },
  { icon: PackageCheck, title: "Inspect on arrival", text: `A ${DEFAULT_INSPECTION_DAYS}-day window to check it. Accept, or open a dispute with evidence.` },
  { icon: BadgeCheck, title: "Seller gets paid", text: "PayPal Payouts releases the money. Both sides review; reviews stay hidden until both submit." },
];

const PILLARS = [
  { icon: Lock, title: "Money held by PayPal, not by us", text: "Authorize → capture → payout. Refunds and voids are one tap, with every PayPal ID in the money trail." },
  { icon: GitCompareArrows, title: "Negotiation with a memory", text: "Every counter is a new version. You see “Price −4.5%, delivery +3 days” instead of scrolling a chat." },
  { icon: Sparkles, title: "A copilot that works for you only", text: "Summaries, counter suggestions and risk flags. It sees your private limit, never the other side's." },
  { icon: MessageSquareWarning, title: "Scam shield", text: "Flags Zelle, Venmo, gift cards, phone numbers and “pay me directly” before anyone loses money." },
  { icon: Scale, title: "Disputes with evidence", text: "The agreement, offers, chat and delivery proof are already in one place. Settle with a partial refund." },
  { icon: BadgeCheck, title: "Portable trust profile", text: "Score from PayPal verification, completed deals, on-time rate, ratings and dispute record. Each part shown, not a black box." },
];

type Cell = "yes" | "part" | "no";
const COMPARE: { name: string; note?: string; cells: Cell[] }[] = [
  { name: "Craigslist", cells: ["part", "no", "no", "no", "no", "no"] },
  { name: "Facebook Marketplace", cells: ["no", "no", "part", "no", "part", "no"] },
  { name: "eBay Best Offer", cells: ["no", "part", "part", "no", "part", "no"] },
  { name: "Upwork", note: "services only", cells: ["part", "part", "yes", "part", "yes", "part"] },
  { name: "Escrow.com", cells: ["no", "no", "yes", "part", "yes", "no"] },
  { name: "Trustap", cells: ["no", "no", "yes", "no", "yes", "part"] },
  { name: SITE.name, cells: ["yes", "yes", "yes", "yes", "yes", "yes"] },
];
const COLS = ["Buyer posts the need", "Structured counter-offers", "Money held until delivery", "Signed terms tied to payment", "Inspection & disputes", "AI negotiation help"];

function Mark({ v }: { v: Cell }) {
  if (v === "yes") return <Check className="mx-auto size-4 text-mint" />;
  if (v === "part") return <Minus className="mx-auto size-4 text-amber" />;
  return <X className="mx-auto size-4 text-dim" />;
}

export default function Home() {
  const fee = PLATFORM_FEE_BPS / 100;
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <Aurora />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pt-20 pb-24 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-28">
          <Reveal>
            <Eyebrow>
              <span className="size-1.5 rounded-full bg-mint" /> Powered by PayPal Orders, Payouts & Webhooks
            </Eyebrow>
            <h1 className="mt-6 text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              <span className="text-gradient">Name your need.</span>
              <br />
              Let sellers compete.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">
              {SITE.name} is the deal room for hard-to-find things. Post what you want, PayPal holds your budget, sellers send
              versioned offers, and nobody gets paid until you&apos;ve inspected what arrived.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/post" size="lg">
                Post a need <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="/board" variant="secondary" size="lg">
                See the live board
              </ButtonLink>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-line pt-6">
              {[
                ["$0", "to post & negotiate"],
                [`${fee}%`, "only when a deal closes"],
                [`${OFFER_TTL_HOURS}h`, "real offer expiry"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="num text-2xl font-semibold">{v}</dt>
                  <dd className="mt-1 text-xs text-muted">{l}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={0.15} className="flex justify-center lg:justify-end">
            <HeroDeal />
          </Reveal>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <Card className="grid gap-8 p-8 md:grid-cols-3 md:p-10">
            <div className="md:col-span-1">
              <div className="text-xs uppercase tracking-wider text-brand-2">The problem</div>
              <h2 className="mt-2 text-2xl font-semibold">Finding rare things is easy to ask for. Closing safely isn&apos;t.</h2>
            </div>
            <div className="grid gap-6 text-sm text-muted sm:grid-cols-2 md:col-span-2">
              <p>
                <span className="font-medium text-fg">Marketplaces list what sellers have</span>, not what you need. A discontinued part,
                a specific alloy, a vintage receiver in good shape: you end up posting in forums and DMs.
              </p>
              <p>
                <span className="font-medium text-fg">Then the deal happens in chat.</span> Price, condition and dates are scattered across
                messages, and the seller asks for Zelle or a deposit first. Nobody holds the money, nobody can prove what was agreed.
              </p>
            </div>
          </Card>
        </Reveal>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-28 sm:px-6">
        <Reveal className="max-w-2xl">
          <div className="text-xs uppercase tracking-wider text-brand-2">How it works</div>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight">From “wanted” to “paid” in one link.</h2>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.06}>
              <Card className="group h-full p-6 transition hover:bg-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-white/5 text-violet-200 ring-1 ring-line transition group-hover:ring-brand/40">
                    <s.icon className="size-5" />
                  </span>
                  <span className="num text-sm text-dim">0{i + 1}</span>
                </div>
                <h3 className="mt-5 font-medium">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.text}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6">
        <Reveal className="max-w-2xl">
          <div className="text-xs uppercase tracking-wider text-brand-2">Built for trust</div>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight">Every hand-off where deals break, covered.</h2>
        </Reveal>
        <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.05} className="bg-ink-950">
              <div className="h-full p-7">
                <p.icon className="size-5 text-brand-2" />
                <h3 className="mt-4 font-medium">{p.title}</h3>
                <p className="mt-2 text-sm text-muted">{p.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Compare */}
      <section id="compare" className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-28 sm:px-6">
        <Reveal className="max-w-2xl">
          <div className="text-xs uppercase tracking-wider text-brand-2">Compare</div>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight">Others cover one stage. {SITE.name} runs the whole deal.</h2>
          <p className="mt-4 text-muted">Listings find the other side, escrow holds money, chat apps carry the haggling. The hand-offs between them are where people get burned.</p>
        </Reveal>
        <Reveal delay={0.1}>
          <Card className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="p-4 font-medium" />
                  {COLS.map((c) => (
                    <th key={c} className="p-4 text-center font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => {
                  const us = row.name === SITE.name;
                  return (
                    <tr key={row.name} className={us ? "bg-brand/[0.09]" : "border-b border-line/60"}>
                      <td className="p-4 font-medium">
                        {row.name}
                        {row.note && <span className="ml-1.5 text-xs font-normal text-dim">({row.note})</span>}
                      </td>
                      {row.cells.map((c, i) => (
                        <td key={i} className="p-4">
                          <Mark v={c} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="border-t border-line p-4 text-xs text-dim">
              Our reading of each product&apos;s public pages, November 2026. <Minus className="inline size-3 text-amber" /> = limited, or only in some cases.
            </p>
          </Card>
        </Reveal>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <div className="text-xs uppercase tracking-wider text-brand-2">Pricing</div>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight">Free until money moves.</h2>
            <p className="mt-4 text-muted">
              Buyers pay the agreed price and nothing else. Sellers pay {fee}% when they&apos;re paid out, which covers PayPal processing.
              If a deal is cancelled before shipping, the buyer is refunded in full.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <Card className="edge p-7">
              <div className="text-sm text-muted">Example: agreed price</div>
              <div className="num mt-1 text-4xl font-semibold">$1,210.00</div>
              <div className="mt-6 space-y-3 text-sm">
                {[
                  ["Buyer pays", "$1,210.00"],
                  [`Platform fee (${fee}%, seller side)`, "−$72.60"],
                  ["Seller receives via PayPal Payouts", "$1,137.40"],
                  ["Unused hold released to buyer", "$190.00"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between border-b border-line/60 pb-3 last:border-0">
                    <span className="text-muted">{k}</span>
                    <span className="num">{v}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-line p-10 text-center sm:p-16">
            <Aurora />
            <div className="relative">
              <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">What are you looking for?</h2>
              <p className="mx-auto mt-4 max-w-lg text-muted">Post it in a minute. PayPal holds the budget, sellers come to you.</p>
              <div className="mt-8 flex justify-center gap-3">
                <ButtonLink href="/post" size="lg">
                  Post a need <ArrowRight className="size-4" />
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
