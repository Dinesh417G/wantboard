// Tiny JSON-file store for local development. Swap for a hosted DB before deploying.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Db, WantRequest } from "./types";
import { seedDb } from "./seed";

const FILE = path.join(process.cwd(), "data", "clinch.json");

function load(): Db {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Db;
  } catch {
    const db = seedDb();
    save(db);
    return db;
  }
}

function save(db: Db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

export const id = (prefix: string) => `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
export const code = () =>
  Array.from(crypto.randomBytes(6), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const nowIso = () => new Date().toISOString();

export function read(): Db {
  return load();
}

export function reset(): Db {
  const db = seedDb();
  save(db);
  return db;
}

/** Read-modify-write in one synchronous step (no await inside), so requests cannot interleave. */
export function mutate<T>(fn: (db: Db) => T): T {
  const db = load();
  const out = fn(db);
  save(db);
  return out;
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
