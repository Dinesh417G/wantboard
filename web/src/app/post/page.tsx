"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/types";

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none";

export default function PostRequest() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const minDate = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) return setError(out.error ?? "Something went wrong");
    router.push(`/r/${out.id}`);
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold">What do you need?</h1>
      <label className="block">
        <span className="text-sm font-medium">Your name</span>
        <input name="buyerName" required maxLength={60} className={input} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Item or material</span>
        <input name="title" required maxLength={120} placeholder="e.g. 2 kg of 99.9% pure bismuth ingot" className={input} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Details</span>
        <textarea name="description" required rows={4} maxLength={2000} className={input} placeholder="Size, grade, model number, condition..." />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium">Category</span>
          <select name="category" required className={input}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Needed by</span>
          <input name="neededBy" type="date" required min={minDate} className={input} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Max price (USD)</span>
          <input name="budget" type="number" required min={1} max={10000} step="0.01" className={input} />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium">Your preferences (one per line)</span>
        <textarea name="preferences" rows={3} className={input} placeholder={"New only, no refurbished\nShips to Chennai\nGST invoice needed"} />
      </label>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {busy ? "Posting..." : "Next: secure budget with PayPal"}
      </button>
    </form>
  );
}
