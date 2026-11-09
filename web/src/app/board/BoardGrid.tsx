"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { CalendarClock, Lock, MapPin, MessagesSquare } from "lucide-react";
import { CATEGORIES, type Category, type RequestStatus } from "@/lib/types";
import { usd } from "@/lib/domain/money";
import { Badge, cn } from "@/components/ui";

export type BoardItem = {
  id: string;
  code: string;
  title: string;
  category: Category;
  neededBy: string;
  budgetCents: number;
  status: RequestStatus;
  offers: number;
  buyer: string;
  city: string;
  createdAt: string;
  sample: boolean;
  mine: boolean;
  forMe: boolean;
};

const STATUS_TONE: Record<RequestStatus, ["neutral" | "mint" | "brand" | "cyan" | "amber" | "rose", string]> = {
  draft: ["neutral", "Draft"],
  open: ["mint", "Taking offers"],
  agreed: ["brand", "Agreed"],
  shipped: ["cyan", "Shipped"],
  disputed: ["amber", "Dispute"],
  completed: ["mint", "Closed"],
  cancelled: ["rose", "Cancelled"],
};

export function BoardGrid({ items, sellerView }: { items: BoardItem[]; sellerView: boolean }) {
  const [cat, setCat] = useState<Category | "All" | "Mine">(sellerView ? "Mine" : "All");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const shown = useMemo(
    () =>
      items.filter(
        (i) =>
          (cat === "All" || (cat === "Mine" ? i.forMe || i.mine : i.category === cat)) &&
          (!onlyOpen || i.status === "open" || i.status === "draft" || i.mine),
      ),
    [items, cat, onlyOpen],
  );
  const chips: (Category | "All" | "Mine")[] = [...(sellerView ? (["Mine"] as const) : []), "All", ...CATEGORIES];

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition",
              cat === c ? "border-brand/50 bg-brand/15 text-violet-100" : "border-line text-muted hover:border-line-strong hover:text-fg",
            )}
          >
            {c === "Mine" ? "My categories" : c}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-violet-500" />
          Open only
        </label>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((i, n) => {
          const [tone, label] = STATUS_TONE[i.status];
          return (
            <motion.div key={i.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(n * 0.04, 0.4) }}>
              <Link
                href={`/r/${i.id}`}
                className="glass group flex h-full flex-col rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={tone}>
                    {i.status === "open" && <span className="animate-pulse-ring size-1.5 rounded-full bg-mint" />}
                    {label}
                  </Badge>
                  <span className="font-mono text-[10px] text-dim">{i.code}</span>
                </div>
                <h3 className="mt-4 line-clamp-2 font-medium leading-snug group-hover:text-white">{i.title}</h3>
                <div className="mt-1 text-xs text-dim">{i.category}</div>
                <div className="mt-auto pt-6">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-dim">Max price</div>
                      <div className="num text-xl font-semibold">{usd(i.budgetCents)}</div>
                    </div>
                    {i.status !== "draft" && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-sky-200">
                        <Lock className="size-3" /> PayPal hold{i.sample ? " (sample)" : ""}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3.5" /> by {i.neededBy}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessagesSquare className="size-3.5" /> {i.offers} seller{i.offers === 1 ? "" : "s"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" /> {i.city}
                    </span>
                    {i.mine && <Badge tone="brand">yours</Badge>}
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
        {!shown.length && <p className="text-sm text-muted">Nothing here yet.</p>}
      </div>
    </>
  );
}
