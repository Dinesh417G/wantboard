import { handle } from "@/lib/http";
import { payoutSeller } from "@/lib/paypal";
import { mutate, read, getRequest, log, Conflict } from "@/lib/store";
import { PLATFORM_FEE } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** Buyer confirms delivery: PayPal Payouts sends the seller their share minus the platform fee. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const db = read();
  const r = getRequest(db, id);
  if (r.status !== "shipped" && r.status !== "awarded") throw new Conflict("nothing to confirm");
  const bid = r.bids.find((b) => b.id === r.winningBidId);
  const seller = bid && db.sellers.find((s) => s.id === bid.sellerId);
  if (!bid || !seller || r.sellerPayout === undefined || r.fee === undefined) throw new Conflict("winning bid data missing");
  const out = await payoutSeller({
    batchKey: `payout-${r.id}`,
    email: seller.paypalEmail,
    amount: r.sellerPayout,
    note: `WantBoard: "${r.title}". Price $${bid.price.toFixed(2)} minus ${PLATFORM_FEE * 100}% platform fee $${r.fee.toFixed(2)}.`,
  });
  return mutate((d) => {
    const x = getRequest(d, id);
    x.paypal.payoutBatchId = out.payoutBatchId;
    x.status = "completed";
    log(
      x,
      `Buyer confirmed delivery. PayPal Payouts sent $${x.sellerPayout!.toFixed(2)} to ${seller.name} (batch ${out.payoutBatchId}, ${out.status}); platform kept $${x.fee!.toFixed(2)}.`,
    );
    return { status: x.status };
  });
});
