import { body, handle } from "@/lib/http";
import { categorize } from "@/lib/ai";
import { gate } from "@/lib/ratelimit";

const run = handle(async (req: Request) => {
  const b = await body(req);
  return categorize(String(b.title ?? "").slice(0, 120), String(b.description ?? "").slice(0, 2000));
});

/** "Suggest with AI" on the post form (a signed-in page). Spends the shared AI quota: signed-in accounts only, limited per account (20 / 10 min). */
export async function POST(req: Request) {
  const g = await gate("categorize");
  if ("deny" in g) return g.deny;
  return run(req);
}
