import { handle, body, str, num, date, BadRequest } from "@/lib/http";
import { mutate, read, id, log } from "@/lib/store";
import { CATEGORIES, type Category, type WantRequest } from "@/lib/types";

export const GET = handle(async () => read().requests.filter((r) => r.status !== "draft"));

export const POST = handle(async (req: Request) => {
  const b = await body(req);
  const category = str(b.category, "category", 60) as Category;
  if (!CATEGORIES.includes(category)) throw new BadRequest("unknown category");
  const neededBy = date(b.neededBy, "neededBy");
  if (neededBy < new Date().toISOString().slice(0, 10)) throw new BadRequest("neededBy is in the past");
  const preferences = (typeof b.preferences === "string" ? b.preferences : "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((s) => s.slice(0, 120));

  const r: WantRequest = {
    id: id("req"),
    title: str(b.title, "title", 120),
    description: str(b.description, "description", 2000),
    category,
    neededBy,
    budget: num(b.budget, "budget", 1, 10000),
    preferences,
    buyerName: str(b.buyerName, "buyerName", 60),
    status: "draft",
    createdAt: new Date().toISOString(),
    bids: [],
    events: [],
    paypal: {},
  };
  log(r, `Request posted by ${r.buyerName}; waiting for the budget to be secured with PayPal`);
  mutate((db) => db.requests.push(r));
  return { id: r.id };
});
