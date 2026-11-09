import "server-only";
import { NextResponse } from "next/server";
import { PayPalError } from "./paypal";
import { Conflict, Forbidden, NotFound } from "./store";
import { BadInput } from "./engine";

/** Wraps a route handler so thrown errors become clean JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      return NextResponse.json(await fn(...args));
    } catch (e) {
      const status =
        e instanceof BadInput ? 400 : e instanceof Forbidden ? 403 : e instanceof NotFound ? 404 : e instanceof Conflict ? 409 : e instanceof PayPalError ? 502 : 500;
      if (status >= 500) console.error("[clinch]", e);
      const message = e instanceof PayPalError ? `PayPal said no: ${e.message}` : status === 500 ? "Something went wrong" : (e as Error).message;
      return NextResponse.json({ error: message }, { status });
    }
  };
}

export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    return {};
  }
}
