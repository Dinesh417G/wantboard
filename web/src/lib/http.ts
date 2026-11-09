import { NextResponse } from "next/server";
import { PayPalError } from "./paypal";
import { Conflict, NotFound } from "./store";

export class BadRequest extends Error {}

/** Wraps a route handler so thrown errors become clean JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      return NextResponse.json(await fn(...args));
    } catch (e) {
      const status =
        e instanceof BadRequest ? 400 : e instanceof NotFound ? 404 : e instanceof Conflict ? 409 : e instanceof PayPalError ? 502 : 500;
      console.error("[wantboard]", e);
      return NextResponse.json({ error: (e as Error).message }, { status });
    }
  };
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new BadRequest("invalid JSON body");
  }
}

export function str(v: unknown, name: string, max = 500): string {
  if (typeof v !== "string" || !v.trim()) throw new BadRequest(`${name} is required`);
  return v.trim().slice(0, max);
}

export function num(v: unknown, name: string, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new BadRequest(`${name} must be between ${min} and ${max}`);
  return Math.round(n * 100) / 100;
}

export function date(v: unknown, name: string): string {
  const s = str(v, name, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new BadRequest(`${name} must be YYYY-MM-DD`);
  return s;
}
