import { body, handle } from "@/lib/http";
import { viewerId } from "@/lib/viewer";
import { code, Forbidden, id, log, mutate, nowIso } from "@/lib/store";
import { BadInput } from "@/lib/engine";
import { parseDollars } from "@/lib/domain/money";
import { cleanImages } from "@/lib/domain/images";
import { CATEGORIES, type Category, type Reach, type WantRequest } from "@/lib/types";
import { parseAddress } from "@/lib/domain/location";

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const POST = handle(async (req: Request) => {
  const b = await body(req);
  const me = await viewerId();
  const title = s(b.title, 120);
  const description = s(b.description, 2000);
  if (title.length < 4) throw new BadInput("Give the item a short title");
  if (description.length < 10) throw new BadInput("Add a few details (size, model, grade, condition)");
  const category = s(b.category, 60) as Category;
  if (!CATEGORIES.includes(category)) throw new BadInput("Pick a category");
  const neededBy = s(b.neededBy, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(neededBy) || neededBy < new Date().toISOString().slice(0, 10)) throw new BadInput("Needed-by date must be today or later");
  const budgetCents = parseDollars(b.budget);
  if (budgetCents === null || budgetCents < 100 || budgetCents > 1_000_000) throw new BadInput("Max price must be between $1 and $10,000");
  const target = b.target ? parseDollars(b.target) : undefined;
  if (target === null || (target !== undefined && target > budgetCents)) throw new BadInput("Private target must be at or below the max price");
  const ship = parseAddress(b.shipTo, { needStreet: true });
  if (typeof ship === "string") throw new BadInput(`Delivery address: ${ship}`);
  const shipName = s((b.shipTo as Record<string, unknown> | undefined)?.name, 80);
  if (shipName.length < 2) throw new BadInput("Enter the recipient name");
  const reach: Reach = b.reach === "state" || b.reach === "city" ? b.reach : "us";
  const preferences = s(b.preferences, 1000).split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 6);

  return mutate((db) => {
    const buyer = db.parties.find((p) => p.id === me);
    if (!buyer || buyer.role !== "buyer") throw new Forbidden(buyer ? "Only buyer accounts can post a request" : "Sign in to post a request");
    const r: WantRequest = {
      id: id("req"),
      code: code(),
      title,
      description,
      category,
      neededBy,
      budgetCents,
      preferences,
      images: cleanImages(b.images, 6),
      shipTo: { ...ship, name: shipName },
      reach,
      buyerId: buyer.id,
      status: "draft",
      createdAt: nowIso(),
      buyerTargetCents: target,
      threads: [],
      reviews: [],
      events: [],
      paypal: { refunds: [] },
    };
    if (b.saveAddress === true || !buyer.address) {
      buyer.address = { ...ship, source: buyer.address?.line1 === ship.line1 && buyer.address.zip === ship.zip ? buyer.address.source : "manual" };
      buyer.city = `${ship.city}, ${ship.state}`;
    }
    log(r, `${buyer.name} posted this request. Next: PayPal holds the max price so sellers know it's real.`);
    db.requests.push(r);
    return { id: r.id };
  });
});
