import { timingSafeEqual } from "node:crypto";
import { body, handle } from "@/lib/http";
import { viewerId } from "@/lib/viewer";
import * as E from "@/lib/engine";
import { NotFound, sha256 } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; action: string }> };

/** A scheduler may call tick with the shared secret instead of a session. Only honoured when CRON_SECRET is set. */
function cronOk(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("x-cron-secret");
  if (!secret || !given) return false;
  return timingSafeEqual(Buffer.from(sha256(secret)), Buffer.from(sha256(given)));
}

/** One endpoint per deal action. The engine checks role and state for each. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id, action } = await params;
  const me = await viewerId();
  const b = await body(req);
  switch (action) {
    case "hold":
      return E.createHold(id, me);
    case "authorize":
      return E.confirmHold(id, me, b);
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
      // tick can release a payout and renew a hold: a participant in this deal (or the cron secret) only.
      if (!cronOk(req)) await E.assertParticipant(id, me);
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
    case "paypal-dispute":
      return E.respondPayPalDispute(id, me, b);
    case "retry-payout":
      return E.retryPayout(id, me);
    default:
      throw new NotFound(`unknown action ${action}`);
  }
});
