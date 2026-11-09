"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingBag, Sparkles, Store } from "lucide-react";
import { Card } from "@/components/ui";

type Demo = { id: string; name: string; role: "buyer" | "seller"; city: string };

export function DemoPanel({ demos, next }: { demos: Demo[]; next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function go(id: string) {
    setBusy(id);
    await fetch("/api/persona", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    router.push(next);
    router.refresh();
  }
  return (
    <Card className="self-start p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-brand-2" />
        <h2 className="font-medium">Just looking? Try a demo account</h2>
      </div>
      <p className="mt-1 text-xs text-muted">One click, no email. Switch between buyer and sellers any time from the menu.</p>
      <div className="mt-4 space-y-1.5">
        {demos.map((d) => {
          const Icon = d.role === "buyer" ? ShoppingBag : Store;
          return (
            <button key={d.id} onClick={() => go(d.id)} disabled={!!busy} className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left text-sm transition hover:border-brand/40 hover:bg-white/[0.04]">
              <span className={`grid size-8 place-items-center rounded-lg ${d.role === "buyer" ? "bg-brand/20 text-violet-200" : "bg-brand-2/15 text-cyan-200"}`}>
                <Icon className="size-4" />
              </span>
              <span className="flex-1">
                <span className="block">{d.name}</span>
                <span className="block text-xs text-dim">
                  {d.role} · {d.city}
                </span>
              </span>
              {busy === d.id && <Loader2 className="size-4 animate-spin" />}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
