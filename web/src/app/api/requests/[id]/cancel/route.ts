import { handle } from "@/lib/http";
import { voidAuthorization, refundCapture } from "@/lib/paypal";
import { mutate, read, getRequest, log, Conflict } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

/** Draft: just close. Open: void the hold (buyer never charged). Awarded, not shipped: full refund. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const r = getRequest(read(), id);

  if (r.status === "draft") {
    return mutate((db) => {
      const x = getRequest(db, id);
      x.status = "cancelled";
      log(x, "Cancelled before the budget was secured.");
      return { status: x.status };
    });
  }

  if (r.status === "open" && r.paypal.authorizationId) {
    await voidAuthorization(r.paypal.authorizationId);
    return mutate((db) => {
      const x = getRequest(db, id);
      x.status = "cancelled";
      log(x, "Cancelled. PayPal hold voided; the buyer was never charged.");
      return { status: x.status };
    });
  }

  if (r.status === "awarded" && r.paypal.captureId) {
    const ref = await refundCapture(r.paypal.captureId, `WantBoard refund: ${r.title}`);
    return mutate((db) => {
      const x = getRequest(db, id);
      x.status = "cancelled";
      x.paypal.refundId = ref.refundId;
      log(x, `Cancelled before shipping. PayPal refunded the buyer in full (refund ${ref.refundId}, ${ref.status}).`);
      return { status: x.status };
    });
  }

  throw new Conflict(`cannot cancel a ${r.status} request`);
});
