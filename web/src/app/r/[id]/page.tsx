import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { read } from "@/lib/store";
import { viewerId, viewerIn } from "@/lib/viewer";
import { viewRequest } from "@/lib/dto";
import { DealRoom } from "./DealRoom";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = read().requests.find((x) => x.id === id);
  return { title: r ? r.title : "Deal room" };
}

export default async function RequestPage({ params }: Props) {
  const { id } = await params;
  const db = read();
  const r = db.requests.find((x) => x.id === id);
  if (!r) notFound();
  const viewer = viewerIn(db, await viewerId());
  const v = viewRequest(db, r, viewer);
  return <DealRoom v={v} clientId={process.env.PAYPAL_CLIENT_ID ?? ""} canSell={viewer.role === "seller" && viewer.categories.includes(r.category)} />;
}
