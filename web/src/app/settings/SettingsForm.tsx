"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { CATEGORIES } from "@/lib/types";
import { Button, Card, Field, Input, Textarea, cn } from "@/components/ui";

type Me = { name: string; city: string; bio: string; role: "buyer" | "seller"; paypalEmail: string; categories: string[]; email: string };

export function SettingsForm({ me }: { me: Me }) {
  const router = useRouter();
  const [role, setRole] = useState(me.role);
  const [cats, setCats] = useState<string[]>(me.categories);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fd.get("name"), city: fd.get("city"), bio: fd.get("bio"), paypalEmail: fd.get("paypalEmail"), role, categories: cats }),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: out.error ?? "Couldn't save" });
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={save} className="mt-8 space-y-6">
      <Card className="space-y-5 p-6">
        <Field label="Sign-in email" hint="Used for sign-in codes and deal notifications. Never shown publicly.">
          <Input value={me.email} disabled />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input name="name" defaultValue={me.name} required maxLength={60} />
          </Field>
          <Field label="City, state">
            <Input name="city" defaultValue={me.city} required maxLength={60} />
          </Field>
        </div>
        <Field label="About you">
          <Textarea name="bio" rows={3} defaultValue={me.bio} maxLength={300} />
        </Field>
      </Card>
      <Card className="space-y-5 p-6">
        <div className="flex gap-2">
          {(["buyer", "seller"] as const).map((r) => (
            <button key={r} type="button" onClick={() => setRole(r)} className={cn("rounded-full border px-4 py-1.5 text-sm capitalize transition", role === r ? "border-brand/50 bg-brand/15 text-violet-100" : "border-line text-muted")}>
              {r}
            </button>
          ))}
        </div>
        <Field label="PayPal email for payouts" hint="PayPal sandbox account while Clinch runs in demo mode.">
          <Input name="paypalEmail" type="email" defaultValue={me.paypalEmail} required={role === "seller"} />
        </Field>
        {role === "seller" && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted">What you sell</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))}
                  className={cn("rounded-full border px-3 py-1.5 text-xs transition", cats.includes(c) ? "border-brand/50 bg-brand/15 text-violet-100" : "border-line text-muted hover:text-fg")}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save changes
        </Button>
        {msg && <span className={msg.ok ? "text-sm text-emerald-300" : "text-sm text-rose-200"}>{msg.text}</span>}
      </div>
    </form>
  );
}
