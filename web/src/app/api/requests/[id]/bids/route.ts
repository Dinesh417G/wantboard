import { handle, body, num, date, BadRequest } from "@/lib/http";
import { mutate, getRequest, id as newId, log, Conflict, NotFound } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await body(req);
  return mutate((db) => {
    const r = getRequest(db, id);
    if (r.status !== "open") throw new Conflict("request is not open for bids");
    const seller = db.sellers.find((s) => s.id === b.sellerId);
    if (!seller) throw new NotFound("seller not found");
    if (!seller.categories.includes(r.category)) throw new BadRequest("seller does not serve this category");
    const price = num(b.price, "price", 1, r.budget);
    const bid = {
      id: newId("bid"),
      sellerId: seller.id,
      price,
      deliveryDate: date(b.deliveryDate, "deliveryDate"),
      note: typeof b.note === "string" ? b.note.trim().slice(0, 500) : "",
      createdAt: new Date().toISOString(),
    };
    r.bids = r.bids.filter((x) => x.sellerId !== seller.id); // one live bid per seller
    r.bids.push(bid);
    log(r, `${seller.name} bid $${price.toFixed(2)}, delivery by ${bid.deliveryDate}`);
    return bid;
  });
});
