import { body, handle } from "@/lib/http";
import { viewerId, viewerIn } from "@/lib/viewer";
import { getRequest, NotFound, read } from "@/lib/store";
import { viewRequest } from "@/lib/dto";
import { matchSellers, riskCheck, suggestCounter, summarize } from "@/lib/ai";

type Ctx = { params: Promise<{ action: string }> };

/** Copilot actions. Context is the viewer-filtered view only: the other side's private limit never reaches the model. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { action } = await params;
  const b = await body(req);
  const db = await read();
  const viewer = viewerIn(db, await viewerId());
  const v = viewRequest(db, getRequest(db, String(b.requestId)), viewer);
  const threadId = typeof b.threadId === "string" ? b.threadId : undefined;
  switch (action) {
    case "summarize":
      return summarize(v, threadId);
    case "suggest":
      return suggestCounter(v, threadId);
    case "risk":
      return riskCheck(v, threadId);
    case "match": {
      // Preview who the matchmaker would invite (read-only).
      const r = getRequest(db, String(b.requestId));
      const m = await matchSellers(r, db.parties.filter((p) => p.role === "seller"));
      return { source: m[0]?.source ?? "heuristic", data: m.map((x) => ({ ...x, seller: db.parties.find((p) => p.id === x.sellerId)?.name })) };
    }
    default:
      throw new NotFound("unknown copilot action");
  }
});
