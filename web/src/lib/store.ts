// State store. Hosted: one JSON document in Supabase, read and written through secret-gated RPCs with
// optimistic versioning (safe across serverless instances). Local fallback: a JSON file.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Db, WantRequest } from "./types";
import { seedDb } from "./seed";

const DOC_ID = "clinch";
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.APP_STATE_SECRET;
const hosted = Boolean(SB_URL && SB_KEY && SECRET);

type Loaded = { db: Db; version: number };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SB_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`state store ${fn} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

// ---------- local file fallback ----------
const FILE = path.join(process.cwd(), "data", "clinch.json");
function fileLoad(): Loaded | null {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Loaded;
  } catch {
    return null;
  }
}
function fileSave(l: Loaded) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE + ".tmp", JSON.stringify(l));
  fs.renameSync(FILE + ".tmp", FILE);
}

async function loadRaw(): Promise<Loaded | null> {
  if (!hosted) return fileLoad();
  const r = await rpc<{ doc: Db; version: number } | null>("get_state", { p_secret: SECRET, p_id: DOC_ID });
  return r ? { db: r.doc, version: Number(r.version) } : null;
}

/** Returns the new version, or null if someone else wrote first. */
async function saveRaw(db: Db, expected: number): Promise<number | null> {
  if (!hosted) {
    const cur = fileLoad();
    if ((cur?.version ?? 0) !== expected) return null;
    fileSave({ db, version: expected + 1 });
    return expected + 1;
  }
  const v = await rpc<number | null>("put_state", { p_secret: SECRET, p_id: DOC_ID, p_doc: db, p_expected: expected });
  return v === null ? null : Number(v);
}

const DEMO_IDS = new Set(["p_maya", "p_jordan", "p_atlas", "p_relic", "p_volt", "p_circuit"]);

/** Bring older stored documents up to the current shape (idempotent, in memory). */
function upgrade(db: Db): Db {
  for (const p of db.parties) if (DEMO_IDS.has(p.id) && !p.email) p.demo = true;
  return db;
}

async function load(): Promise<Loaded> {
  const l = await loadRaw();
  if (l) return { ...l, db: upgrade(l.db) };
  const db = seedDb();
  await saveRaw(db, 0);
  return (await loadRaw()) ?? { db, version: 1 };
}

export const id = (prefix: string) => `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
export const code = () => Array.from(crypto.randomBytes(6), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const nowIso = () => new Date().toISOString();

export async function read(): Promise<Db> {
  return (await load()).db;
}

/** Replace everything with fresh demo data. */
export async function reset(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const cur = await load();
    if ((await saveRaw(seedDb(), cur.version)) !== null) return;
  }
  throw new Conflict("busy, try again");
}

/** Read-modify-write with optimistic concurrency. fn must be synchronous and may run more than once. */
export async function mutate<T>(fn: (db: Db) => T): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { db, version } = await load();
    const out = fn(db);
    if ((await saveRaw(db, version)) !== null) return out;
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 120));
  }
  throw new Conflict("Too many people editing at once. Try again.");
}

export function getRequest(db: Db, requestId: string): WantRequest {
  const r = db.requests.find((x) => x.id === requestId);
  if (!r) throw new NotFound("request not found");
  return r;
}

export function log(r: WantRequest, text: string, kind: "info" | "money" | "warn" = "info") {
  r.events.push({ at: nowIso(), text, kind });
}

export class NotFound extends Error {}
export class Conflict extends Error {}
export class Forbidden extends Error {}
