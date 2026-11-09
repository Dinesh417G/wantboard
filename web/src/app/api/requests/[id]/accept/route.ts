import { handle, body } from "@/lib/http";
import { captureAuthorization } from "@/lib/paypal";
import { mutate, read, getRequest, log, Conflict, NotFound } from "@/lib/store";
import { PLATFORM_FEE } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** Buyer picks a bid: capture exactly the winning price; the rest of the hold is released. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { bidId } = await body<{ bidId?: string }>(req);
  const r = getRequest(read(), id);
  if (r.status !== "open" || !r.paypal.authorizationId) throw new Conflict("request is not open");
  const bid = r.bids.find((b) => b.id === bidId);
  if (!bid) throw new NotFound("bid not found");
  const cap = await captureAuthorization(r.paypal.authorizationId, bid.price, r.id);
  return mutate((db) => {
    const x = getRequest(db, id);
    const seller = db.sellers.find((s) => s.id === bid.sellerId);
    x.paypal.captureId = cap.captureId;
    x.winningBidId = bid.id;
    x.fee = Math.round(bid.price * PLATFORM_FEE * 100) / 100;
    x.sellerPayout = Math.round((bid.price - x.fee) * 100) / 100;
    x.status = "awarded";
    const released = x.budget - bid.price;
    log(
      x,
      `Buyer chose ${seller?.name ?? "seller"} at $${bid.price.toFixed(2)}. PayPal captured it (capture ${cap.captureId}, ${cap.status})` +
        (released > 0 ? `; $${released.toFixed(2)} of the hold released back to the buyer.` : "."),
    );
    return { status: x.status };
  });
});
