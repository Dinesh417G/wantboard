import { NextResponse } from "next/server";
import { read } from "@/lib/store";
import { viewerId, viewerIn, GUEST_ID } from "@/lib/viewer";
import { runAgent, type AgentMsg } from "@/lib/agent";

export const maxDuration = 60;

// Light per-account rate limit (per server instance): 20 agent turns per 10 minutes.
const hits = new Map<string, number[]>();

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const db = await read();
  const me = viewerIn(db, await viewerId());
  if (me.id === GUEST_ID) return NextResponse.json({ error: "Sign in to use Clinch Agent" }, { status: 401 });
  const r = db.requests.find((x) => x.id === b.requestId);
  if (!r) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  const inDeal = r.buyerId === me.id || (me.role === "seller" && (r.threads.some((t) => t.sellerId === me.id) || me.categories.includes(r.category) || !!r.matches?.some((m) => m.sellerId === me.id)));
  if (!inDeal) return NextResponse.json({ error: "Clinch Agent works for the buyer and the sellers in this deal" }, { status: 403 });

  const now = Date.now();
  const mine = (hits.get(me.id) ?? []).filter((t) => now - t < 600_000);
  if (mine.length >= 20) return NextResponse.json({ error: "Clinch Agent is cooling down. Try again in a few minutes." }, { status: 429 });
  hits.set(me.id, [...mine, now]);

  const history: AgentMsg[] = (Array.isArray(b.history) ? b.history : [])
    .filter((m: AgentMsg) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .slice(-10);
  if (!history.length || history.at(-1)!.role !== "user") return NextResponse.json({ error: "Ask Clinch Agent something" }, { status: 400 });
  const out = await runAgent(db, r, me, history);
  return NextResponse.json(out);
}
