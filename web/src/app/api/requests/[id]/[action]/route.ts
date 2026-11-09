import { body, handle } from "@/lib/http";
import { viewerId } from "@/lib/viewer";
import * as E from "@/lib/engine";
import { NotFound } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; action: string }> };

/** One endpoint per deal action. The engine checks role and state for each. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id, action } = await params;
  const me = await viewerId();
  const b = await body(req);
  switch (action) {
    case "hold":
      return E.createHold(id, me);
    case "authorize":
      return E.confirmHold(id, me);
    case "offer":
      return E.makeOffer(id, me, b);
    case "accept":
      return E.acceptOffer(id, me, b);
    case "reject":
      return E.respondOffer(id, me, b, "reject");
    case "withdraw":
      return E.respondOffer(id, me, b, "withdraw");
    case "message":
      return E.postMessage(id, me, b);
    case "limit":
      return E.savePrivateLimit(id, me, b);
    case "ship":
      return E.ship(id, me, b);
    case "release":
      return E.release(id, me);
    case "tick":
      return E.tick(id);
    case "dispute":
      return E.openDispute(id, me, b);
    case "propose":
      return E.proposeSettlement(id, me, b);
    case "settle":
      return E.acceptSettlement(id, me);
    case "cancel":
      return E.cancel(id, me);
    case "review":
      return E.review(id, me, b);
    default:
      throw new NotFound(`unknown action ${action}`);
  }
});
