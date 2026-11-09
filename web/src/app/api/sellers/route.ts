import { handle, body, str, BadRequest } from "@/lib/http";
import { mutate, read, id } from "@/lib/store";
import { CATEGORIES, type Category, type Seller } from "@/lib/types";

export const GET = handle(async () => read().sellers);

export const POST = handle(async (req: Request) => {
  const b = await body(req);
  const email = str(b.paypalEmail, "paypalEmail", 120).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BadRequest("paypalEmail is not an email");
  const categories = (Array.isArray(b.categories) ? b.categories : []).filter((c): c is Category =>
    CATEGORIES.includes(c as Category),
  );
  if (!categories.length) throw new BadRequest("pick at least one category");
  const s: Seller = {
    id: id("sel"),
    name: str(b.name, "name", 60),
    paypalEmail: email,
    categories,
    createdAt: new Date().toISOString(),
  };
  mutate((db) => db.sellers.push(s));
  return s;
});
