"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import type { Category, WantRequest } from "@/lib/types";
import { PLATFORM_FEE } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { formatIST } from "@/lib/format";

type SellerLite = { id: string; name: string; categories: Category[] };

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none";
const btn = "rounded-lg px-4 py-2 font-medium disabled:opacity-50";

export function RequestView({ request: r, sellers, clientId }: { request: WantRequest; sellers: SellerLite[]; clientId: string }) {
  const router = useRouter();
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sellerName = (id: string) => sellers.find((s) => s.id === id)?.name ?? "Unknown seller";
  const eligible = sellers.filter((s) => s.categories.includes(r.category));
  const winner = r.bids.find((b) => b.id === r.winningBidId);

  async function post(path: string, payload: unknown = {}) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/requests/${r.id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(out.error ?? `Request failed (${res.status})`);
      return null;
    }
    router.refresh();
    return out;
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold">{r.title}</h1>
            <div className="text-right">
              <div className="text-xl font-semibold">${r.budget.toFixed(2)}</div>
              <div className="text-xs text-slate-500">max price</div>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <StatusBadge status={r.status} /> {r.category} · needed by {r.neededBy} · posted by {r.buyerName}
          </div>
          <p className="mt-4 whitespace-pre-wrap">{r.description}</p>
          {r.preferences.length > 0 && (
            <ul className="mt-4 list-inside list-disc text-sm text-slate-700">
              {r.preferences.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex gap-2 text-sm">
          {(["buyer", "seller"] as const).map((x) => (
            <button
              key={x}
              onClick={() => setRole(x)}
              className={`rounded-full px-3 py-1 ${role === x ? "bg-slate-900 text-white" : "bg-white text-slate-700 shadow-sm"}`}
            >
              View as {x}
            </button>
          ))}
          <span className="self-center text-xs text-slate-400">(demo role switch)</span>
        </div>

        {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

        {r.status === "draft" && role === "buyer" && (
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Secure your budget</h2>
            <p className="mt-1 text-sm text-slate-600">
              PayPal holds ${r.budget.toFixed(2)}, it is not charged. Sellers see “funds secured” and bid. You pay only the
              winning price; the rest is released. Pay with your PayPal balance, card, or Pay Later.
            </p>
            <div className="mt-4 max-w-sm">
              {clientId ? (
                <PayPalScriptProvider
                  options={{
                    clientId,
                    currency: "USD",
                    intent: "authorize",
                    enableFunding: "paylater",
                    buyerCountry: "US",
                    components: "buttons,messages",
                  }}
                >
                  <PayPalButtons
                    style={{ layout: "vertical", shape: "rect" }}
                    createOrder={async () => {
                      const res = await fetch(`/api/requests/${r.id}/order`, { method: "POST" });
                      const out = await res.json();
                      if (!res.ok) throw new Error(out.error);
                      return out.orderId;
                    }}
                    onApprove={async () => {
                      await post("authorize");
                    }}
                    onError={(e) => setError(String(e?.message ?? "PayPal error"))}
                  />
                </PayPalScriptProvider>
              ) : (
                <p className="text-sm text-rose-600">PAYPAL_CLIENT_ID is not configured.</p>
              )}
            </div>
          </section>
        )}

        {r.status === "open" && role === "seller" && (
          <BidForm r={r} sellers={eligible} busy={busy} onSubmit={(payload) => post("bids", payload)} />
        )}

        <section className="space-y-3">
          <h2 className="font-semibold">
            Bids ({r.bids.length}){r.status === "open" && role === "buyer" && r.bids.length > 0 && " · pick the best deal"}
          </h2>
          {r.bids.length === 0 && <p className="text-sm text-slate-500">No bids yet.</p>}
          {[...r.bids]
            .sort((a, b) => a.price - b.price)
            .map((b) => {
              const late = b.deliveryDate > r.neededBy;
              return (
                <div key={b.id} className={`rounded-xl bg-white p-4 shadow-sm ${b.id === r.winningBidId ? "ring-2 ring-emerald-400" : ""}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">{sellerName(b.sellerId)}</div>
                      <div className={`text-sm ${late ? "text-amber-700" : "text-slate-500"}`}>
                        Delivery by {b.deliveryDate}
                        {late && " (after your date)"}
                      </div>
                      {b.note && <p className="mt-2 text-sm">{b.note}</p>}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">${b.price.toFixed(2)}</div>
                      {r.status === "open" && role === "buyer" && (
                        <button
                          disabled={busy}
                          onClick={() => post("accept", { bidId: b.id })}
                          className={`${btn} mt-2 bg-emerald-600 text-sm text-white hover:bg-emerald-700`}
                        >
                          Accept & pay
                        </button>
                      )}
                      {b.id === r.winningBidId && <div className="mt-1 text-xs font-medium text-emerald-700">Winning bid</div>}
                    </div>
                  </div>
                </div>
              );
            })}
        </section>

        {r.status === "awarded" && role === "seller" && winner && (
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold">{sellerName(winner.sellerId)}: you won. Ship it.</h2>
            <p className="mt-1 text-sm text-slate-600">
              The buyer has paid ${winner.price.toFixed(2)}. You get ${r.sellerPayout?.toFixed(2)} (after the{" "}
              {PLATFORM_FEE * 100}% fee) when they confirm delivery.
            </p>
            <ShipForm busy={busy} onSubmit={(note) => post("ship", { note })} />
          </section>
        )}

        {(r.status === "awarded" || r.status === "shipped") && role === "buyer" && (
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Got it?</h2>
            <p className="mt-1 text-sm text-slate-600">
              Confirming releases ${r.sellerPayout?.toFixed(2)} to the seller through PayPal Payouts.
            </p>
            <div className="mt-3 flex gap-2">
              <button disabled={busy} onClick={() => post("confirm")} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>
                Confirm delivery & pay seller
              </button>
            </div>
          </section>
        )}

        {role === "buyer" && ["draft", "open", "awarded"].includes(r.status) && (
          <button
            disabled={busy}
            onClick={() => post("cancel")}
            className={`${btn} border border-rose-300 bg-white text-sm text-rose-700 hover:bg-rose-50`}
          >
            {r.status === "open" ? "Cancel & release hold" : r.status === "awarded" ? "Cancel & refund" : "Cancel"}
          </button>
        )}
      </div>

      <aside className="space-y-3">
        <h2 className="font-semibold">Money trail</h2>
        <ol className="space-y-3 border-l-2 border-slate-200 pl-4 text-sm">
          {r.events.map((e, i) => (
            <li key={i}>
              <div className="text-xs text-slate-400">{formatIST(e.at)}</div>
              <div>{e.text}</div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

function BidForm({
  r,
  sellers,
  busy,
  onSubmit,
}: {
  r: WantRequest;
  sellers: SellerLite[];
  busy: boolean;
  onSubmit: (payload: Record<string, FormDataEntryValue>) => Promise<unknown>;
}) {
  if (sellers.length === 0) {
    return (
      <p className="rounded-xl bg-white p-6 text-sm shadow-sm">
        No sellers registered for “{r.category}”. <a href="/sellers" className="text-blue-600 underline">Register one</a>.
      </p>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (await onSubmit(Object.fromEntries(new FormData(form)))) form.reset();
      }}
      className="space-y-3 rounded-xl bg-white p-6 shadow-sm"
    >
      <h2 className="font-semibold">Place a bid</h2>
      <p className="text-sm text-green-700">PayPal is holding ${r.budget.toFixed(2)} for this request.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <select name="sellerId" className={input}>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input name="price" type="number" step="0.01" min={1} max={r.budget} required placeholder="Your price (USD)" className={input} />
        <input name="deliveryDate" type="date" required min={new Date().toISOString().slice(0, 10)} className={input} />
      </div>
      <textarea name="note" rows={2} maxLength={500} placeholder="Condition, brand, shipping method..." className={input} />
      <button disabled={busy} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>
        Submit bid
      </button>
    </form>
  );
}

function ShipForm({ busy, onSubmit }: { busy: boolean; onSubmit: (note: string) => Promise<unknown> }) {
  const [note, setNote] = useState("");
  return (
    <div className="mt-3 flex gap-2">
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tracking number / courier" className={input} />
      <button disabled={busy} onClick={() => onSubmit(note)} className={`${btn} shrink-0 bg-blue-600 text-white hover:bg-blue-700`}>
        Mark shipped
      </button>
    </div>
  );
}
