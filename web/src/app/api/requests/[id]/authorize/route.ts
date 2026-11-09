import { handle } from "@/lib/http";
import { authorizeOrder } from "@/lib/paypal";
import { mutate, read, getRequest, log, Conflict } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

/** Called after the buyer approves in PayPal: places the hold and opens the request to sellers. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const r = getRequest(read(), id);
  if (r.status !== "draft" || !r.paypal.orderId) throw new Conflict("nothing to authorize");
  const auth = await authorizeOrder(r.paypal.orderId);
  return mutate((db) => {
    const x = getRequest(db, id);
    x.paypal.authorizationId = auth.authorizationId;
    x.paypal.authorizationExpires = auth.expires;
    x.status = "open";
    log(x, `PayPal is holding $${x.budget.toFixed(2)} (authorization ${auth.authorizationId}). Open for seller bids.`);
    return { status: x.status };
  });
});
