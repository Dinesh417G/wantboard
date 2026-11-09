"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Loader2, Lock, Sparkles, Wand2 } from "lucide-react";
import { CATEGORIES } from "@/lib/types";
import { parseDollars, usd } from "@/lib/domain/money";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { PhotoPicker } from "@/components/PhotoPicker";

export function PostForm({ buyerName }: { buyerName: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [budget, setBudget] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [ai, setAi] = useState<{ reason: string; source: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const minDate = new Date().toISOString().slice(0, 10);
  const budgetCents = parseDollars(budget);

  async function suggest() {
    if (title.length < 4) return setError("Type a title first");
    setAiBusy(true);
    setError("");
    const res = await fetch("/api/categorize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description }) });
    const out = await res.json();
    setAiBusy(false);
    if (!res.ok) return setError(out.error);
    setCategory(out.data.category);
    setAi({ reason: out.data.reason, source: out.source });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, images }) });
    const out = await res.json();
    if (!res.ok) {
      setBusy(false);
      return setError(out.error ?? "Something went wrong");
    }
    router.push(`/r/${out.id}`);
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      <Card className="space-y-5 p-6">
        <Field label="Item or material">
          <Input name="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Autolite 4100 carburetor, 1.08 venturi, rebuilt" />
        </Field>
        <Field label="Details">
          <Textarea name="description" required rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Model or part number, size, grade, condition, what it's for…" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Category">
            <Select name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Button type="button" variant="secondary" onClick={suggest} disabled={aiBusy}>
            {aiBusy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Suggest with AI
          </Button>
        </div>
        {ai && (
          <p className="flex items-start gap-2 rounded-xl border border-brand/25 bg-brand/[0.07] p-3 text-xs text-violet-100">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {ai.reason} <span className="text-dim">({ai.source === "ai" ? "AI suggestion" : "keyword match"}; you can change it.)</span>
            </span>
          </p>
        )}
        <PhotoPicker value={images} onChange={setImages} max={6} label="Photos or reference images (up to 6)" />
        <Field label="Your preferences" hint="One per line. Sellers see these, and the copilot checks offers against them.">
          <Textarea name="preferences" rows={3} placeholder={"New only, no refurbished\nShips to Austin, TX\nOriginal box"} />
        </Field>
      </Card>

      <Card className="grid gap-5 p-6 sm:grid-cols-3">
        <Field label="Needed by">
          <Input name="neededBy" type="date" required min={minDate} />
        </Field>
        <Field label="Max price (USD)" hint="PayPal holds this amount.">
          <Input name="budget" inputMode="decimal" required placeholder="1,400" value={budget} onChange={(e) => setBudget(e.target.value)} className="num" />
        </Field>
        <Field
          label="Private target"
          hint={
            <span className="inline-flex items-center gap-1">
              <EyeOff className="size-3" /> Only you and your copilot see this.
            </span>
          }
        >
          <Input name="target" inputMode="decimal" placeholder="optional" className="num" />
        </Field>
      </Card>

      <Card className="edge flex flex-wrap items-center gap-4 p-5">
        <Lock className="size-5 text-sky-300" />
        <div className="flex-1 text-sm">
          <div className="font-medium">Next: PayPal holds {budgetCents ? usd(budgetCents) : "your max price"}</div>
          <div className="text-muted">Authorized, not charged. You pay only the offer you accept; the rest is released. Posting as {buyerName}.</div>
        </div>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} Continue to PayPal
        </Button>
      </Card>
      {error && <p className="rounded-xl border border-rose/30 bg-rose/10 p-3 text-sm text-rose-200">{error}</p>}
    </form>
  );
}
