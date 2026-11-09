"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, Link2, Loader2, Unlink } from "lucide-react";
import { CATEGORIES } from "@/lib/types";
import { Button, Card, Field, Input, Textarea, cn } from "@/components/ui";
import { AddressFields, readAddress, type AddressValue } from "@/components/AddressFields";

type Me = { name: string; city: string; bio: string; role: "buyer" | "seller"; paypalEmail: string; categories: string[]; email: string; paypal: { email: string; verified: boolean } | null; address: AddressValue | null; addressFromPayPal: boolean };

export function SettingsForm({ me, note }: { me: Me; note?: { ok: boolean; text: string } }) {
  const router = useRouter();
  const [role, setRole] = useState(me.role);
  const [cats, setCats] = useState<string[]>(me.categories);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  async function unlink() {
    setUnlinking(true);
    await fetch("/api/auth/paypal/unlink", { method: "POST" });
    setUnlinking(false);
    router.replace("/settings");
    router.refresh();
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fd.get("name"), address: readAddress(fd), bio: fd.get("bio"), paypalEmail: fd.get("paypalEmail"), role, categories: cats }),
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
        <Field label="Name">
          <Input name="name" defaultValue={me.name} required maxLength={60} />
        </Field>
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wider text-muted">{role === "seller" ? "Ships from" : "Default delivery address"}</div>
          <p className="text-xs text-dim">
            {me.addressFromPayPal ? "From your PayPal account. " : ""}Private. Your profile shows only city and state.
          </p>
          <AddressFields value={me.address ?? undefined} street={role === "buyer"} required={true} />
        </div>
        <Field label="About you">
          <Textarea name="bio" rows={3} defaultValue={me.bio} maxLength={300} />
        </Field>
      </Card>
      <Card className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-medium">PayPal account</div>
            {me.paypal ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-sky-200">
                <BadgeCheck className="size-4" /> Connected: {me.paypal.email || "PayPal account"}
                {me.paypal.verified ? " · verified" : ""}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">Connect PayPal to sign in with it, get a verified badge on your trust profile, and receive payouts straight to your account.</p>
            )}
          </div>
          {me.paypal ? (
            <Button type="button" variant="ghost" onClick={unlink} disabled={unlinking}>
              {unlinking ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />} Disconnect
            </Button>
          ) : (
            <a href="/api/auth/paypal/start?mode=link" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#ffc439] px-4 text-sm font-semibold text-[#111] hover:brightness-95">
              <Link2 className="size-4" /> Connect PayPal
            </a>
          )}
        </div>
        {note && <p className={note.ok ? "text-sm text-emerald-300" : "text-sm text-rose-200"}>{note.text}</p>}
      </Card>
      <Card className="space-y-5 p-6">
        <div className="flex gap-2">
          {(["buyer", "seller"] as const).map((r) => (
            <button key={r} type="button" onClick={() => setRole(r)} className={cn("rounded-full border px-4 py-1.5 text-sm capitalize transition", role === r ? "border-brand/50 bg-brand/15 text-violet-100" : "border-line text-muted")}>
              {r}
            </button>
          ))}
        </div>
        <Field label="PayPal email for payouts" hint={me.paypal ? "Not used while PayPal is connected: payouts go to the connected account." : "PayPal sandbox account while Clinch runs in demo mode."}>
          <Input name="paypalEmail" type="email" defaultValue={me.paypalEmail} required={role === "seller" && !me.paypal} />
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
