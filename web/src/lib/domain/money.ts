// Money is always integer cents. Never use floats for amounts.
import { PLATFORM_FEE_BPS } from "../config/site";

export function assertCents(n: number): number {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`invalid cents amount: ${n}`);
  return n;
}

/** Parse a user-typed dollar string ("120", "88.5", "$1,200.00") into cents without float drift. */
export function parseDollars(input: unknown): number | null {
  if (typeof input === "number") input = String(input);
  if (typeof input !== "string") return null;
  const s = input.replace(/[$,\s]/g, "");
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export function toPayPalValue(cents: number): string {
  assertCents(cents);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const usd = (cents: number) => fmt.format(cents / 100);

/** Round half up: (a * bps) / 10000 in integer math. */
export function bps(cents: number, rate: number): number {
  return Math.floor((cents * rate + 5000) / 10000);
}

export type FeeBreakdown = { priceCents: number; feeCents: number; payoutCents: number; feeBps: number };

/** What the seller receives for a winning price. Shown before anyone commits (no drip pricing). */
export function feeBreakdown(priceCents: number, feeBps = PLATFORM_FEE_BPS): FeeBreakdown {
  assertCents(priceCents);
  const feeCents = bps(priceCents, feeBps);
  return { priceCents, feeCents, payoutCents: priceCents - feeCents, feeBps };
}
