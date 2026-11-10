// US delivery locations and "who can make offers" rules. Pure.
import type { Address, Party, Reach, WantRequest } from "../types";

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico",
};

export const REACH_LABEL: Record<Reach, string> = {
  us: "Sellers anywhere in the US",
  state: "Sellers in my state only",
  city: "Local sellers in my city only",
};

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const norm = (x: string) => x.trim().toLowerCase();

/** Validate an address from a form or from PayPal. Returns an error message or the clean address. */
export function parseAddress(b: unknown, opts: { needStreet: boolean }): Address | string {
  const o = (b ?? {}) as Record<string, unknown>;
  const a: Address = {
    line1: s(o.line1, 100),
    line2: s(o.line2, 100) || undefined,
    city: s(o.city, 60),
    state: s(o.state, 2).toUpperCase(),
    zip: s(o.zip, 10),
    country: "US",
  };
  if (opts.needStreet && a.line1.length < 3) return "Enter the street address";
  if (a.city.length < 2) return "Enter the city";
  if (!US_STATES[a.state]) return "Pick a US state";
  if (!/^\d{5}(-\d{4})?$/.test(a.zip)) return "Enter a 5-digit ZIP code";
  return a;
}

/** "Houston, TX" -> { city: "Houston", state: "TX" } */
export function parseCityState(cityLine: string): { city: string; state: string } | null {
  const m = cityLine.match(/^\s*(.+?)\s*,\s*([A-Za-z]{2})\b/);
  if (!m || !US_STATES[m[2].toUpperCase()]) return null;
  return { city: m[1], state: m[2].toUpperCase() };
}

/** Where a party is: saved address first, else the public "City, ST" line. */
export function locationOf(p: Party): { city: string; state: string } | null {
  if (p.address) return { city: p.address.city, state: p.address.state };
  return parseCityState(p.city);
}

/**
 * Where a seller is for state/city reach. Only an address that came from PayPal counts: a typed city or address is
 * self-reported and costs nothing to fake. Demo accounts are fixed seed data nobody can edit, so their listed city counts.
 */
export function verifiedLocationOf(p: Party): { city: string; state: string } | null {
  if (p.address?.source === "paypal" || p.demo) return locationOf(p);
  return null;
}

/** Can this seller make offers on this request? Reach "us" takes anyone; state/city need a verified location. */
export function canServe(seller: Party, r: Pick<WantRequest, "reach" | "shipTo">): boolean {
  const reach = r.reach ?? "us";
  if (reach === "us" || !r.shipTo) return true;
  const at = verifiedLocationOf(seller);
  if (!at || at.state !== r.shipTo.state) return false;
  return reach === "state" || norm(at.city) === norm(r.shipTo.city);
}

export function reachShort(r: Pick<WantRequest, "reach" | "shipTo">): string {
  const reach = r.reach ?? "us";
  if (reach === "us" || !r.shipTo) return "Any US seller";
  return reach === "state" ? `${r.shipTo.state} sellers only` : `${r.shipTo.city} sellers only`;
}

/** What everyone except the buyer (and, after agreement, the winning seller) may see. */
export function publicArea(a: Address) {
  return { city: a.city, state: a.state, zip: `${a.zip.slice(0, 3)}xx` };
}

export const oneLine = (a: Address) => [a.line1, a.line2, `${a.city}, ${a.state} ${a.zip}`].filter(Boolean).join(", ");
