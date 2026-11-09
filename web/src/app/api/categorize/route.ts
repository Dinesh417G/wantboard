import { body, handle } from "@/lib/http";
import { categorize } from "@/lib/ai";

export const POST = handle(async (req: Request) => {
  const b = await body(req);
  return categorize(String(b.title ?? "").slice(0, 120), String(b.description ?? "").slice(0, 2000));
});
