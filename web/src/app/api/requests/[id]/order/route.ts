import { handle } from "@/lib/http";
import { createAuthorizeOrder } from "@/lib/paypal";
import { mutate, read, getRequest, Conflict } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

/** Called by the PayPal button: creates the AUTHORIZE order for the buyer's budget. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const r = getRequest(read(), id);
  if (r.status !== "draft") throw new Conflict("budget already secured");
  const order = await createAuthorizeOrder(r.id, r.budget, r.title);
  mutate((db) => {
    getRequest(db, id).paypal.orderId = order.id;
  });
  return { orderId: order.id };
});
