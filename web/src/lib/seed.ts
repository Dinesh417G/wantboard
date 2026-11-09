// Demo data: people, a few closed deals (for trust profiles) and sample negotiations.
// Sample requests are flagged `sample: true`; their PayPal steps are simulated and labelled.
import crypto from "node:crypto";
import type { Db, Offer, Party, WantRequest } from "./types";
import type { Terms } from "./domain/offers";
import { canonical } from "./domain/offers";
import { feeBreakdown } from "./domain/money";

const fee = (cents: number) => feeBreakdown(cents).feeCents;

const BUYER_EMAIL = process.env.DEMO_BUYER_EMAIL || "sb-z2cop53757889@personal.example.com";
const SELLER_EMAIL = process.env.DEMO_SELLER_EMAIL || "sb-z2cop53757889@personal.example.com";

const day = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();
const date = (offsetDays: number) => iso(offsetDays).slice(0, 10);
const hash = (t: unknown) => crypto.createHash("sha256").update(canonical(t)).digest("hex");

export const DEMO_BUYER_ID = "p_maya";

/** Fictional default delivery addresses for the demo buyers (so the demo posts in one click). */
export const DEMO_ADDRESSES: Record<string, NonNullable<Party["address"]>> = {
  p_maya: { line1: "100 Demo Lane", line2: "Unit 4", city: "Austin", state: "TX", zip: "78701", country: "US", source: "manual" },
  p_jordan: { line1: "250 Sample Ave", city: "Denver", state: "CO", zip: "80202", country: "US", source: "manual" },
};

const parties: Party[] = [
  { id: "p_maya", name: "Maya Chen", handle: "maya", city: "Austin, TX", role: "buyer", paypalEmail: BUYER_EMAIL, categories: [], bio: "Restores mid-century hi-fi and builds custom guitar amps.", joinedAt: iso(-200), demo: true },
  { id: "p_jordan", name: "Jordan Ellis", handle: "jordan", city: "Denver, CO", role: "buyer", paypalEmail: "", categories: [], bio: "Fleet manager for a small machine shop.", joinedAt: iso(-160), demo: true },
  { id: "p_atlas", name: "Atlas Alloy Supply", handle: "atlas-alloy", city: "Houston, TX", role: "seller", paypalEmail: SELLER_EMAIL, categories: ["Industrial & raw materials", "Tools & machinery"], bio: "Certified metals and specialty alloys, cut to size. Mill certs on every order.", joinedAt: iso(-400), demo: true },
  { id: "p_relic", name: "Relic & Rarity", handle: "relic-rarity", city: "Brooklyn, NY", role: "seller", paypalEmail: SELLER_EMAIL, categories: ["Rare & collectibles", "Vintage & antiques", "Electronics & components"], bio: "Vintage audio, NOS tubes and hard-to-find components, tested before shipping.", joinedAt: iso(-320), demo: true },
  { id: "p_volt", name: "Vintage Volt Parts", handle: "vintage-volt", city: "Detroit, MI", role: "seller", paypalEmail: SELLER_EMAIL, categories: ["Auto & spare parts", "Vintage & antiques"], bio: "Rebuilt carburetors, NOS trim and classic-car electrics since 1998.", joinedAt: iso(-500), demo: true },
  { id: "p_circuit", name: "CircuitVault", handle: "circuitvault", city: "San Jose, CA", role: "seller", paypalEmail: SELLER_EMAIL, categories: ["Electronics & components", "Tools & machinery"], bio: "Obsolete ICs, EOL industrial boards and test equipment.", joinedAt: iso(-90), demo: true },
];

const terms = (o: Partial<Terms> & { priceCents: number }): Terms => ({
  deliveryDate: date(7),
  warrantyMonths: 0,
  inspectionDays: 3,
  condition: "new",
  shipping: "included",
  note: "",
  ...o,
});

let n = 0;
const offer = (by: "buyer" | "seller", t: Terms, status: Offer["status"], ageDays: number, message = "", isFinal = false): Offer => ({
  id: `o_seed${++n}`,
  version: 0,
  by,
  terms: t,
  status,
  isFinal,
  message,
  createdAt: iso(-ageDays),
  expiresAt: iso(-ageDays + 2),
});

function closed(id: string, title: string, category: WantRequest["category"], sellerId: string, buyerId: string, price: number, agoDays: number, ratingB: number, ratingS: number, reviewText: string): WantRequest {
  const t = terms({ priceCents: price, deliveryDate: date(-agoDays - 1) });
  const o = { ...offer("seller", t, "accepted", agoDays + 6), version: 1 };
  return {
    id,
    code: id.slice(-6).toUpperCase(),
    title,
    description: "Closed example deal.",
    category,
    neededBy: date(-agoDays),
    budgetCents: Math.round(price * 1.15),
    preferences: [],
    buyerId,
    status: "completed",
    createdAt: iso(-agoDays - 8),
    sample: true,
    threads: [{ id: `${id}_t`, sellerId, offers: [o], messages: [] }],
    agreement: { threadId: `${id}_t`, offerId: o.id, version: 1, terms: t, termsHash: hash(t), buyerSignedAt: iso(-agoDays - 5), sellerSignedAt: iso(-agoDays - 5), createdAt: iso(-agoDays - 5) },
    delivery: { note: "Delivered", tracking: "", at: iso(-agoDays - 2), inspectionEndsAt: iso(-agoDays + 1) },
    reviews: [
      { by: "buyer", rating: ratingB, text: reviewText, at: iso(-agoDays) },
      { by: "seller", rating: ratingS, text: "Clear request, paid on time.", at: iso(-agoDays) },
    ],
    events: [{ at: iso(-agoDays), text: "Sample deal (demo data).", kind: "info" }],
    paypal: { refunds: [], capturedCents: price, feeCents: fee(price), payoutCents: price - fee(price), captureId: "SIMULATED", payoutBatchId: "SIMULATED" },
  };
}

function versioned(offers: Offer[]): Offer[] {
  return offers.map((o, i) => ({ ...o, version: i + 1 }));
}

export function seedDb(): Db {
  n = 0;
  const requests: WantRequest[] = [
    closed("req_demo01", "6061-T6 aluminum plate, 0.5 in, 24×36", "Industrial & raw materials", "p_atlas", "p_jordan", 41800, 40, 5, 5, "Mill cert in the box, cut was dead square."),
    closed("req_demo02", "Inconel 625 round bar, 1 in × 12 in", "Industrial & raw materials", "p_atlas", "p_jordan", 26500, 22, 5, 5, "Shipped a day early."),
    closed("req_demo03", "Matched pair of Mullard EL34 tubes (NOS)", "Rare & collectibles", "p_relic", "p_maya", 32000, 30, 5, 4, "Tested and matched as promised."),
    closed("req_demo04", "Autolite 4100 carb, 1.08 venturi, rebuilt", "Auto & spare parts", "p_volt", "p_jordan", 38900, 15, 4, 5, "Runs great; took one extra day."),
    {
      id: "req_demo10",
      code: "K7Q3MZ",
      title: "Marantz 2270 receiver — working, original faceplate",
      description: "Looking for a fully working Marantz 2270. Original faceplate and knobs, no cracked dial glass. Recapped preferred. Will pay more for documented service.",
      category: "Vintage & antiques",
      neededBy: date(18),
      budgetCents: 140000,
      preferences: ["Recapped with receipts", "Original faceplate, no cracks", "Double-boxed shipping"],
      buyerId: "p_maya",
      status: "open",
      createdAt: iso(-3),
      sample: true,
      buyerTargetCents: 115000,
      matches: [
        { sellerId: "p_relic", score: 94, reason: "Vintage audio specialist; tests units before shipping.", source: "heuristic" },
        { sellerId: "p_circuit", score: 62, reason: "Sells electronics; occasional vintage gear.", source: "heuristic" },
      ],
      threads: [
        {
          id: "t_demo10a",
          sellerId: "p_relic",
          sellerFloorCents: 112000,
          offers: versioned([
            offer("seller", terms({ priceCents: 129500, deliveryDate: date(9), warrantyMonths: 3, condition: "used" }), "countered", 2.5, "Fully recapped last year, receipts included."),
            offer("buyer", terms({ priceCents: 112000, deliveryDate: date(9), warrantyMonths: 6, condition: "used" }), "countered", 1.8, "Can you do 6 months warranty at this price?"),
            offer("seller", terms({ priceCents: 121000, deliveryDate: date(7), warrantyMonths: 6, condition: "used" }), "open", 0.3, "Meet in the middle, and I can ship 2 days sooner."),
          ]),
          messages: [
            { id: "m1", by: "seller", text: "Unit was recapped in March, I have the invoice. Dial glass is perfect.", flags: [], createdAt: iso(-2.4) },
            { id: "m2", by: "buyer", text: "Great. Any scratches on the faceplate?", flags: [], createdAt: iso(-2.1) },
            { id: "m3", by: "seller", text: "One faint hairline near the tuning knob, photos attached in the listing.", flags: [], createdAt: iso(-2) },
          ],
        },
        {
          id: "t_demo10b",
          sellerId: "p_circuit",
          offers: versioned([offer("seller", terms({ priceCents: 98000, deliveryDate: date(14), condition: "used", shipping: "extra" }), "open", 1, "Working, not recapped. Shipping billed separately.")]),
          messages: [
            { id: "m4", by: "seller", text: "Cheaper if you pay me directly on Zelle, text me at 512-555-0142", flags: [{ kind: "outside payment app", match: "Zelle" }, { kind: "phone number", match: "512-555-0142" }], createdAt: iso(-0.9) },
          ],
        },
      ],
      reviews: [],
      events: [
        { at: iso(-3), text: "Sample request (demo data). PayPal steps on this request are simulated.", kind: "info" },
        { at: iso(-3), text: "PayPal is holding $1,400.00 for this request (simulated).", kind: "money" },
      ],
      paypal: { refunds: [], authorizationId: "SAMPLE-AUTH" },
    },
    {
      id: "req_demo11",
      code: "R2W8LN",
      title: "2 kg bismuth ingot, 99.99% purity, with assay",
      description: "Need high-purity bismuth for low-melt casting. Must include a certificate of analysis. Ship to Austin, TX.",
      category: "Industrial & raw materials",
      neededBy: date(12),
      budgetCents: 22000,
      preferences: ["Certificate of analysis", "Ships within 5 days"],
      buyerId: "p_jordan",
      status: "open",
      createdAt: iso(-1),
      sample: true,
      matches: [{ sellerId: "p_atlas", score: 91, reason: "Certified metals with mill certs; ships from Houston.", source: "heuristic" }],
      threads: [
        {
          id: "t_demo11a",
          sellerId: "p_atlas",
          offers: versioned([offer("seller", terms({ priceCents: 18900, deliveryDate: date(5), warrantyMonths: 0 }), "open", 0.6, "99.99% Bi, CoA from the refinery.")]),
          messages: [],
        },
      ],
      reviews: [],
      events: [{ at: iso(-1), text: "Sample request (demo data). PayPal steps on this request are simulated.", kind: "info" }],
      paypal: { refunds: [], authorizationId: "SAMPLE-AUTH" },
    },
  ];
  return { parties, requests };
}
