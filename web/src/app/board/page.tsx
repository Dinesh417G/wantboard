import type { Metadata } from "next";
import { read } from "@/lib/store";
import { viewerId, viewerIn } from "@/lib/viewer";
import { BoardGrid, type BoardItem } from "./BoardGrid";
import { ButtonLink } from "@/components/ui";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live board" };

export default async function Board() {
  const db = await read();
  const me = viewerIn(db, await viewerId());
  const items: BoardItem[] = db.requests
    .filter((r) => r.status !== "draft" || r.buyerId === me.id)
    .sort((a, b) => (a.status === "open" ? -1 : 0) - (b.status === "open" ? -1 : 0) || b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      category: r.category,
      neededBy: r.neededBy,
      budgetCents: r.budgetCents,
      status: r.status,
      offers: r.threads.filter((t) => t.offers.length).length,
      buyer: db.parties.find((p) => p.id === r.buyerId)!.name,
      city: db.parties.find((p) => p.id === r.buyerId)!.city,
      createdAt: r.createdAt,
      sample: Boolean(r.sample),
      image: r.images?.[0],
      matched: r.matches?.some((m) => m.sellerId === me.id) ?? false,
      mine: r.buyerId === me.id,
      forMe: me.role === "seller" && me.categories.includes(r.category),
    }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-brand-2">Live board</div>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">What people need right now</h1>
          <p className="mt-2 text-muted">
            {me.role === "seller"
              ? `Showing requests in your categories first: ${me.categories.join(", ")}.`
              : "Every open request has its budget held by PayPal."}
          </p>
        </div>
        {me.role === "buyer" && (
          <ButtonLink href="/post">
            <Plus className="size-4" /> Post a need
          </ButtonLink>
        )}
      </div>
      <BoardGrid items={items} sellerView={me.role === "seller"} />
    </div>
  );
}
