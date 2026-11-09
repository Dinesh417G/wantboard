import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPin, Star } from "lucide-react";
import { read } from "@/lib/store";
import { trustStats } from "@/lib/domain/trust";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sellers" };

export default async function Sellers() {
  const db = await read();
  const sellers = db.parties
    .filter((p) => p.role === "seller")
    .map((p) => ({ p, s: trustStats(db, p) }))
    .sort((a, b) => b.s.score - a.s.score);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="text-xs uppercase tracking-wider text-brand-2">Sellers</div>
      <h1 className="mt-1 text-4xl font-semibold tracking-tight">Who&apos;s competing for your deals</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Every score is built only from paid, completed deals on {`Clinch`}. Open a profile to see exactly how it&apos;s calculated.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sellers.map(({ p, s }) => (
          <Link key={p.id} href={`/u/${p.handle}`} className="group">
            <Card className="flex h-full flex-col p-6 transition group-hover:-translate-y-0.5 group-hover:border-brand/40 group-hover:bg-white/[0.06]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium group-hover:text-white">{p.name}</h2>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <MapPin className="size-3.5" /> {p.city}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-3xl font-semibold text-gradient">{s.score}</div>
                  <div className="text-[10px] uppercase tracking-wider text-dim">trust</div>
                </div>
              </div>
              <p className="mt-4 line-clamp-2 text-sm text-muted">{p.bio}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.categories.map((c) => (
                  <Badge key={c}>{c}</Badge>
                ))}
              </div>
              <div className="mt-auto flex items-center gap-4 border-t border-line pt-4 text-xs text-muted">
                <span>
                  <span className="num text-fg">{s.completed}</span> deals
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3.5 fill-amber text-amber" /> <span className="num text-fg">{s.avgRating?.toFixed(1) ?? "—"}</span>
                </span>
                {(p.paypalEmail || p.paypal) && (
                  <span className="inline-flex items-center gap-1 text-sky-200">
                    <BadgeCheck className="size-3.5" /> {p.paypal?.verified ? "PayPal verified" : "PayPal"}
                  </span>
                )}
                <ArrowRight className="ml-auto size-4 text-dim transition group-hover:translate-x-0.5 group-hover:text-fg" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
