// Offer validation, diffing and canonical hashing. Pure: no Next.js imports.
import { usd } from "./money";

export type Terms = {
  priceCents: number;
  deliveryDate: string; // YYYY-MM-DD
  warrantyMonths: number;
  inspectionDays: number;
  condition: "new" | "used" | "refurbished";
  shipping: "included" | "extra" | "pickup";
  note: string;
};

export type FieldChange = { field: keyof Terms; label: string; from: string; to: string; delta?: string; better?: "buyer" | "seller" };

const LABEL: Record<keyof Terms, string> = {
  priceCents: "Price",
  deliveryDate: "Delivery",
  warrantyMonths: "Warranty",
  inspectionDays: "Inspection",
  condition: "Condition",
  shipping: "Shipping",
  note: "Note",
};

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function show(field: keyof Terms, t: Terms): string {
  switch (field) {
    case "priceCents":
      return usd(t.priceCents);
    case "warrantyMonths":
      return t.warrantyMonths ? `${t.warrantyMonths} mo` : "none";
    case "inspectionDays":
      return `${t.inspectionDays} days`;
    default:
      return String(t[field] || "—");
  }
}

/** Per-field changes between two versions, with direction of benefit. */
export function diffTerms(prev: Terms, next: Terms): FieldChange[] {
  const out: FieldChange[] = [];
  for (const field of Object.keys(LABEL) as (keyof Terms)[]) {
    if (prev[field] === next[field]) continue;
    const c: FieldChange = { field, label: LABEL[field], from: show(field, prev), to: show(field, next) };
    if (field === "priceCents") {
      const pct = ((next.priceCents - prev.priceCents) / prev.priceCents) * 100;
      c.delta = `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
      c.better = next.priceCents < prev.priceCents ? "buyer" : "seller";
    } else if (field === "deliveryDate") {
      const d = days(prev.deliveryDate, next.deliveryDate);
      c.delta = `${d > 0 ? "+" : ""}${d} day${Math.abs(d) === 1 ? "" : "s"}`;
      c.better = d < 0 ? "buyer" : "seller";
    } else if (field === "warrantyMonths" || field === "inspectionDays") {
      c.better = (next[field] as number) > (prev[field] as number) ? "buyer" : "seller";
    }
    out.push(c);
  }
  return out;
}

/** One-line summary, e.g. "Price −4.5%, delivery +3 days". */
export function summarizeDiff(changes: FieldChange[]): string {
  if (!changes.length) return "Same terms";
  return changes
    .filter((c) => c.field !== "note")
    .map((c) => `${c.label} ${c.delta ?? `→ ${c.to}`}`)
    .join(", ") || "Note changed";
}

export function validateTerms(t: Terms, opts: { maxCents: number; today: string }): string | null {
  if (!Number.isSafeInteger(t.priceCents) || t.priceCents < 100) return "Price must be at least $1.00";
  if (t.priceCents > opts.maxCents) return "Price is above the amount PayPal is holding for this request";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.deliveryDate) || t.deliveryDate < opts.today) return "Delivery date must be today or later";
  if (!Number.isInteger(t.warrantyMonths) || t.warrantyMonths < 0 || t.warrantyMonths > 60) return "Warranty must be 0–60 months";
  if (!Number.isInteger(t.inspectionDays) || t.inspectionDays < 1 || t.inspectionDays > 14) return "Inspection must be 1–14 days";
  if (!["new", "used", "refurbished"].includes(t.condition)) return "Unknown condition";
  if (!["included", "extra", "pickup"].includes(t.shipping)) return "Unknown shipping option";
  return null;
}

/** Canonical JSON (sorted keys) so the same terms always hash the same. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
