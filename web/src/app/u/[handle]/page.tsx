import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, MapPin, Star } from "lucide-react";
import { read } from "@/lib/store";
import { trustStats } from "@/lib/domain/trust";
import { Aurora } from "@/components/chrome";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const p = read().parties.find((x) => x.handle === handle);
  return { title: p ? `${p.name} · trust profile` : "Profile" };
}

export default async function Profile({ params }: Props) {
  const { handle } = await params;
  const db = read();
  const p = db.parties.find((x) => x.handle === handle);
  if (!p) notFound();
  const s = trustStats(db, p);
  const ring = 2 * Math.PI * 52;

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-72 overflow-hidden">
        <Aurora />
      </div>
      <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 md:grid-cols-[1fr_280px]">
          <div>
            <Badge tone={p.role === "seller" ? "cyan" : "brand"}>{p.role}</Badge>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">{p.name}</h1>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" /> {p.city}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" /> member since {p.joinedAt.slice(0, 7)}
              </span>
              {p.paypalEmail && (
                <span className="inline-flex items-center gap-1.5 text-sky-200">
                  <BadgeCheck className="size-4" /> PayPal payouts linked
                </span>
              )}
            </div>
            <p className="mt-5 max-w-xl text-muted">{p.bio}</p>
            {p.categories.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {p.categories.map((c) => (
                  <Badge key={c}>{c}</Badge>
                ))}
              </div>
            )}
          </div>
          <Card className="edge flex flex-col items-center p-6">
            <svg viewBox="0 0 120 120" className="size-36 -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="url(#g)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={ring}
                strokeDashoffset={ring * (1 - s.score / 100)}
              />
              <defs>
                <linearGradient id="g" x1="0" x2="1">
                  <stop offset="0" stopColor="#7c5cff" />
                  <stop offset="1" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
            </svg>
            <div className="-mt-[96px] mb-[52px] text-center">
              <div className="num text-4xl font-semibold">{s.score}</div>
              <div className="text-[10px] uppercase tracking-wider text-dim">trust score</div>
            </div>
          </Card>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          {[
            ["Deals closed", String(s.completed)],
            ["On-time", s.onTimeRate === null ? "—" : `${Math.round(s.onTimeRate * 100)}%`],
            ["Avg rating", s.avgRating === null ? "—" : s.avgRating.toFixed(1)],
            ["Disputes", String(s.disputes)],
          ].map(([k, v]) => (
            <Card key={k} className="p-5">
              <div className="text-[11px] uppercase tracking-wider text-dim">{k}</div>
              <div className="num mt-1 text-2xl font-semibold">{v}</div>
            </Card>
          ))}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="font-medium">How the score is built</h2>
            <p className="mt-1 text-xs text-dim">Only paid, completed deals count. Every part is shown.</p>
            <div className="mt-5 space-y-4">
              {s.parts.map((x) => (
                <div key={x.label}>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">{x.label}</span>
                    <span className="num">
                      {x.points}/{x.max}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#7c5cff,#22d3ee)]" style={{ width: `${(x.points / x.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="font-medium">Verified reviews</h2>
            <p className="mt-1 text-xs text-dim">From the other side of completed deals. Published only after both sides review.</p>
            <div className="mt-5 space-y-4">
              {s.reviews.length === 0 && <p className="text-sm text-muted">No reviews yet.</p>}
              {s.reviews.map((r, i) => (
                <div key={i} className="border-b border-line pb-4 last:border-0">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, n) => (
                      <Star key={n} className={`size-3.5 ${n < r.rating ? "fill-amber text-amber" : "text-dim"}`} />
                    ))}
                    <span className="ml-2 text-xs text-dim">
                      {r.from} · {r.at.slice(0, 10)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted">{r.text}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
