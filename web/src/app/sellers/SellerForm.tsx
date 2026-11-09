"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/types";

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none";

export function SellerForm() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch("/api/sellers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fd.get("name"), paypalEmail: fd.get("paypalEmail"), categories: fd.getAll("categories") }),
    });
    const out = await res.json();
    if (!res.ok) return setError(out.error ?? "Something went wrong");
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold">Sell on WantBoard</h1>
      <p className="text-sm text-slate-600">
        You only see requests in your categories. Every request is backed by money PayPal is already holding. You’re paid
        to this PayPal email when the buyer confirms delivery (6% platform fee).
      </p>
      <label className="block">
        <span className="text-sm font-medium">Shop name</span>
        <input name="name" required maxLength={60} className={input} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">PayPal email (where you get paid)</span>
        <input name="paypalEmail" type="email" required className={input} />
      </label>
      <fieldset>
        <legend className="text-sm font-medium">Categories you serve</legend>
        <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
          {CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-2">
              <input type="checkbox" name="categories" value={c} /> {c}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">Register</button>
    </form>
  );
}
