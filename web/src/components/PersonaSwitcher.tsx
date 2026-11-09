"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, ShoppingBag, Store } from "lucide-react";

type P = { id: string; name: string; role: "buyer" | "seller"; city: string; handle: string };

export function PersonaSwitcher({ me, people }: { me: P; people: P[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  async function pick(id: string) {
    setOpen(false);
    await fetch("/api/persona", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    start(() => router.refresh());
  }

  const Icon = me.role === "buyer" ? ShoppingBag : Store;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="glass flex items-center gap-2 rounded-xl py-1.5 pr-2.5 pl-1.5 text-sm transition hover:bg-white/10"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`grid size-7 place-items-center rounded-lg ${me.role === "buyer" ? "bg-brand/25 text-violet-200" : "bg-brand-2/20 text-cyan-200"}`}>
          <Icon className="size-3.5" />
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[13px] font-medium">{me.name}</span>
          <span className="block text-[10px] uppercase tracking-wider text-dim">{pending ? "switching…" : `viewing as ${me.role}`}</span>
        </span>
        <ChevronDown className="size-3.5 text-dim" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-line-strong bg-ink-900/95 p-1.5 shadow-2xl backdrop-blur-xl"
            role="listbox"
          >
            <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-dim">Demo: switch who you are</div>
            <a href={`/u/${people.find((p) => p.id === me.id)?.handle ?? ""}`} className="mx-1.5 mb-1 block rounded-xl border border-line px-3 py-2 text-xs text-muted transition hover:bg-white/5 hover:text-fg">
              View my profile →
            </a>
            {(["buyer", "seller"] as const).map((role) => (
              <div key={role}>
                <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-muted">{role === "buyer" ? "Buyers" : "Sellers"}</div>
                {people
                  .filter((p) => p.role === role)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pick(p.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/5"
                    >
                      <span className="flex-1">
                        <span className="block">{p.name}</span>
                        <span className="block text-xs text-dim">{p.city}</span>
                      </span>
                      {p.id === me.id && <Check className="size-4 text-mint" />}
                    </button>
                  ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
