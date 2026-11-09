import type { RequestStatus } from "@/lib/types";

const STYLE: Record<RequestStatus, [string, string]> = {
  draft: ["Budget not secured", "bg-slate-100 text-slate-600"],
  open: ["Funds held by PayPal · open for bids", "bg-green-100 text-green-800"],
  awarded: ["Paid · awaiting shipment", "bg-blue-100 text-blue-800"],
  shipped: ["Shipped", "bg-indigo-100 text-indigo-800"],
  completed: ["Delivered · seller paid", "bg-emerald-100 text-emerald-800"],
  cancelled: ["Cancelled", "bg-rose-100 text-rose-700"],
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const [label, cls] = STYLE[status];
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
