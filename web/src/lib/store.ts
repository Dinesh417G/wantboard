// Tiny JSON-file store for local development. Swap for a hosted DB before deploying.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Db, WantRequest } from "./types";

const FILE = path.join(process.cwd(), "data", "db.json");

function load(): Db {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Db;
  } catch {
    return { sellers: [], requests: [] };
  }
}

function save(db: Db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

export const id = (prefix: string) => `${prefix}_${crypto.randomBytes(5).toString("hex")}`;

export function read(): Db {
  return load();
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

export function log(r: WantRequest, text: string) {
  r.events.push({ at: new Date().toISOString(), text });
}

export class NotFound extends Error {}
export class Conflict extends Error {}
