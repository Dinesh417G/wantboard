"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, LayoutDashboard, LogOut, Settings, ShoppingBag, Store, UserRound } from "lucide-react";

type P = { id: string; name: string; role: "buyer" | "seller"; city: string; handle: string; demo?: boolean };

/** Account menu. Demo accounts can switch to other demo accounts; real accounts get settings and sign-out. */
export function PersonaSwitcher({ me, people }: { me: P; people: P[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  async function pick(id: string) {
    setOpen(false);
    await fetch("/api/persona", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    start(() => router.refresh());
  }
  async function signOut() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    start(() => {
      router.push("/");
      router.refresh();
    });
  }

  const Icon = me.role === "buyer" ? ShoppingBag : Store;
  const item = "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-muted transition hover:bg-white/5 hover:text-fg";
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="glass flex items-center gap-2 rounded-xl py-1.5 pr-2.5 pl-1.5 text-sm transition hover:bg-white/10"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className={`grid size-7 place-items-center rounded-lg ${me.role === "buyer" ? "bg-brand/25 text-violet-200" : "bg-brand-2/20 text-cyan-200"}`}>
          <Icon className="size-3.5" />
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[13px] font-medium">{me.name}</span>
          <span className="block text-[10px] uppercase tracking-wider text-dim">{pending ? "loading…" : me.demo ? `demo ${me.role}` : me.role}</span>
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
            role="menu"
          >
            <Link href="/dashboard" onClick={() => setOpen(false)} className={item}>
              <LayoutDashboard className="size-4" /> Dashboard
            </Link>
            <Link href={`/u/${me.handle}`} onClick={() => setOpen(false)} className={item}>
              <UserRound className="size-4" /> My trust profile
            </Link>
            {!me.demo && (
              <Link href="/settings" onClick={() => setOpen(false)} className={item}>
                <Settings className="size-4" /> Settings
              </Link>
            )}
            {me.demo && (
              <div className="mt-1 border-t border-line pt-1">
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-dim">Demo: switch account</div>
                {(["buyer", "seller"] as const).map((role) =>
                  people
                    .filter((p) => p.demo && p.role === role)
                    .map((p) => (
                      <button key={p.id} onClick={() => pick(p.id)} className={item}>
                        {p.role === "buyer" ? <ShoppingBag className="size-4" /> : <Store className="size-4" />}
                        <span className="flex-1">
                          <span className="block text-fg">{p.name}</span>
                          <span className="block text-xs text-dim">{p.city}</span>
                        </span>
                        {p.id === me.id && <Check className="size-4 text-mint" />}
                      </button>
                    )),
                )}
              </div>
            )}
            <div className="mt-1 border-t border-line pt-1">
              <button onClick={signOut} className={item}>
                <LogOut className="size-4" /> Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
