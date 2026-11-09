"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Fingerprint, Lock, ShieldCheck, Sparkles } from "lucide-react";

// Illustrative preview of a negotiation (static example data, animated).
const STEPS = [
  { by: "Relic & Rarity", v: 1, price: "$1,295.00", delivery: "Nov 18", warranty: "3 mo", chips: [] as [string, "up" | "down"][] },
  { by: "You", v: 2, price: "$1,120.00", delivery: "Nov 18", warranty: "6 mo", chips: [["Price −13.5%", "down"], ["Warranty 3 → 6 mo", "up"]] as [string, "up" | "down"][] },
  { by: "Relic & Rarity", v: 3, price: "$1,210.00", delivery: "Nov 16", warranty: "6 mo", chips: [["Price +8.0%", "up"], ["Delivery −2 days", "down"]] as [string, "up" | "down"][] },
];

export function HeroDeal() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % (STEPS.length + 1)), 2600);
    return () => clearInterval(t);
  }, []);
  const s = STEPS[Math.min(i, STEPS.length - 1)];
  const agreed = i === STEPS.length;

  return (
    <div className="edge glass relative w-full max-w-md rounded-3xl p-5 shadow-[0_40px_120px_-30px_rgb(124_92_255/0.55)]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-dim">Deal room · K7Q3MZ</div>
          <div className="mt-0.5 font-medium">Marantz 2270 receiver</div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-paypal/40 bg-paypal/15 px-2.5 py-1 text-[11px] text-sky-200">
          <Lock className="size-3" /> PayPal holding <span className="num">$1,400.00</span>
        </span>
      </div>

      <div className="relative mt-5 h-[184px]">
        <AnimatePresence mode="wait">
          {!agreed ? (
            <motion.div
              key={s.v}
              initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -18, filter: "blur(6px)" }}
              transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
              className="absolute inset-0 rounded-2xl border border-line bg-ink-900/70 p-4"
            >
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-fg">v{s.v}</span> from {s.by}
                </span>
                <span className="text-dim">valid 48h</span>
              </div>
              <div className="num mt-3 text-3xl font-semibold">{s.price}</div>
              <div className="mt-1 text-xs text-muted">
                Delivery {s.delivery} · Warranty {s.warranty} · Inspection 3 days
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.chips.map(([c, dir]) => (
                  <span
                    key={c}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${dir === "down" ? "bg-mint/12 text-emerald-200" : "bg-amber/12 text-amber-200"}`}
                  >
                    {dir === "down" ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />}
                    {c}
                  </span>
                ))}
                {!s.chips.length && <span className="text-[11px] text-dim">First offer</span>}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="agreed"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 grid place-items-center rounded-2xl border border-mint/30 bg-mint/[0.07] p-4 text-center"
            >
              <div>
                <ShieldCheck className="mx-auto size-8 text-mint" />
                <div className="mt-2 font-medium">Agreement v3 signed by both sides</div>
                <div className="mt-1 inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
                  <Fingerprint className="size-3.5" /> 9f3a1c07e2b4…
                </div>
                <div className="mt-2 text-xs text-emerald-200">
                  PayPal captured <span className="num">$1,210.00</span> · <span className="num">$190.00</span> released
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-brand/25 bg-brand/[0.08] p-3 text-xs text-violet-100">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-violet-300" />
        <span>
          Copilot: v3 is inside your private target. Delivery now beats your needed-by date by 2 days. Accepting is reasonable.
        </span>
      </div>
      <div className="mt-3 text-center text-[10px] text-dim">Illustration with example data</div>
    </div>
  );
}
