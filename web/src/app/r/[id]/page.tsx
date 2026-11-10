import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { read } from "@/lib/store";
import { GUEST_ID, viewerId, viewerIn } from "@/lib/viewer";
import { viewRequest } from "@/lib/dto";
import { DealRoom } from "./DealRoom";
import { orderStatus } from "@/lib/paypal";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = (await read()).requests.find((x) => x.id === id);
  return { title: r ? r.title : "Deal room" };
}

export default async function RequestPage({ params }: Props) {
  const { id } = await params;
  const db = await read();
  const r = db.requests.find((x) => x.id === id);
  if (!r) notFound();
  const viewer = viewerIn(db, await viewerId());
  const v = viewRequest(db, r, viewer);
  // A buyer who approved in PayPal but whose hold step failed gets a one-click "Place the hold".
  const holdApproved =
    r.status === "draft" && r.buyerId === viewer.id && !!r.paypal.orderId && !r.sample
      ? (await orderStatus(r.paypal.orderId).catch(() => "")) === "APPROVED"
      : false;
  return <DealRoom v={v} signedIn={viewer.id !== GUEST_ID} holdApproved={holdApproved} clientId={process.env.PAYPAL_CLIENT_ID ?? ""} canSell={viewer.role === "seller" && (viewer.categories.includes(r.category) || !!r.matches?.some((m) => m.sellerId === viewer.id))} />;
}
