import { notFound } from "next/navigation";
import { read } from "@/lib/store";
import { RequestView } from "./RequestView";

export const dynamic = "force-dynamic";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = read();
  const request = db.requests.find((r) => r.id === id);
  if (!request) notFound();
  const sellers = db.sellers.map(({ id, name, categories }) => ({ id, name, categories }));
  return <RequestView request={request} sellers={sellers} clientId={process.env.PAYPAL_CLIENT_ID ?? ""} />;
}
