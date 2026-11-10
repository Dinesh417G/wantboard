// Sign-in gate + small in-memory rate limiter for routes that spend shared quota (AI calls, Blob upload tokens).
// State is per server instance (serverless: each warm instance counts on its own) and is deliberately NOT kept in
// the app database. It is a brake on abuse of the shared free-tier AI quota, not an exact quota.
import "server-only";
import { NextResponse } from "next/server";
import { read } from "./store";
import { viewerId, viewerIn, GUEST_ID } from "./viewer";
import type { Db, Party } from "./types";

const hits = new Map<string, number[]>();
const MAX_KEYS = 5_000;

/** Sliding window: at most `limit` hits per `windowMs` for `key`. Records the hit when it is allowed. */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const mine = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (mine.length >= limit) {
    hits.set(key, mine);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - mine[0])) / 1000)) };
  }
  hits.delete(key); // re-insert so the Map stays ordered by recency
  hits.set(key, [...mine, now]);
  for (const k of hits.keys()) {
    if (hits.size <= MAX_KEYS) break;
    hits.delete(k); // bound memory: drop the least recently used keys
  }
  return { ok: true };
}

/**
 * Require a signed-in account, then apply a per-account limit for `scope`.
 * Returns the viewer (and the db snapshot it was read from), or the JSON response to send instead:
 * 401 for guests, 429 (with Retry-After) over the limit. Fails closed.
 */
export async function gate(scope: string, limit = 20, windowMs = 600_000): Promise<{ me: Party; db: Db } | { deny: NextResponse }> {
  let db: Db;
  let me: Party;
  try {
    db = await read();
    me = viewerIn(db, await viewerId());
  } catch (e) {
    console.error("[clinch]", e);
    return { deny: NextResponse.json({ error: "Something went wrong" }, { status: 500 }) };
  }
  if (me.id === GUEST_ID) return { deny: NextResponse.json({ error: "Sign in first" }, { status: 401 }) };
  // Demo personas are shared by every judge/visitor who clicks the one-click login, so they get 3x the allowance.
  const rl = rateLimit(`${scope}:${me.id}`, me.demo ? limit * 3 : limit, windowMs);
  if (!rl.ok) {
    return { deny: NextResponse.json({ error: `Too many requests. Try again in ${Math.ceil(rl.retryAfterSec / 60)} min.` }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }) };
  }
  return { me, db };
}
