import { read } from "@/lib/store";
import { SellerForm } from "./SellerForm";

export const dynamic = "force-dynamic";

export default function Sellers() {
  const sellers = read().sellers;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <SellerForm />
      <section className="space-y-3">
        <h2 className="font-semibold">Registered sellers</h2>
        {sellers.length === 0 && <p className="text-slate-500">None yet.</p>}
        {sellers.map((s) => (
          <div key={s.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="font-medium">{s.name}</div>
            <div className="text-sm text-slate-500">{s.paypalEmail}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {s.categories.map((c) => (
                <span key={c} className="rounded bg-slate-100 px-2 py-0.5 text-xs">{c}</span>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
