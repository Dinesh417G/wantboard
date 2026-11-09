import type { RequestStatus } from "@/lib/types";
import { Badge } from "./ui";

const STATUS: Record<RequestStatus, { label: string; tone: "neutral" | "brand" | "mint" | "amber" | "rose" | "cyan" | "paypal" }> = {
  draft: { label: "Awaiting PayPal hold", tone: "neutral" },
  open: { label: "Funds held · taking offers", tone: "mint" },
  agreed: { label: "Agreed · paid", tone: "brand" },
  shipped: { label: "Shipped · inspecting", tone: "cyan" },
  disputed: { label: "In dispute", tone: "amber" },
  completed: { label: "Closed · seller paid", tone: "mint" },
  cancelled: { label: "Cancelled", tone: "rose" },
};

export function StatusPill({ status }: { status: RequestStatus }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone}>
      {status === "open" && <span className="animate-pulse-ring size-1.5 rounded-full bg-mint" />}
      {s.label}
    </Badge>
  );
}
