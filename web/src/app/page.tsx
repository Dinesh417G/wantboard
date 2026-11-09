import Link from "next/link";
import { read } from "@/lib/store";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default function Board() {
  const requests = read()
    .requests.filter((r) => r.status !== "draft")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Need something hard to find? Post it. Sellers compete.</h1>
        <p className="mt-2 text-slate-600">
          Your budget is held by PayPal, not taken, so sellers know you’re serious. You pay only the winning price, and
          the seller is paid only after you confirm delivery.
        </p>
        <Link href="/post" className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
          Post a request
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Requests</h2>
        {requests.length === 0 && <p className="text-slate-500">No requests yet.</p>}
        {requests.map((r) => (
          <Link key={r.id} href={`/r/${r.id}`} className="block rounded-xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-blue-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="text-sm text-slate-500">
                  {r.category} · needed by {r.neededBy} · {r.bids.length} bid{r.bids.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">${r.budget.toFixed(2)}</div>
                <StatusBadge status={r.status} />
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
