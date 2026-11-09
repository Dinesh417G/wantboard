import type { Terms } from "./domain/offers";
import type { ScamFlag } from "./domain/scam-shield";

export const CATEGORIES = [
  "Electronics & components",
  "Industrial & raw materials",
  "Auto & spare parts",
  "Rare & collectibles",
  "Vintage & antiques",
  "Tools & machinery",
  "Fashion & handmade",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Role = "buyer" | "seller";

export type Party = {
  id: string;
  name: string;
  handle: string;
  city: string;
  role: Role;
  paypalEmail: string;
  categories: Category[];
  bio: string;
  joinedAt: string;
  /** Sign-in email (real accounts). Never shown publicly. */
  email?: string;
  /** Seeded demo account: anyone can sign in as it from the demo menu. */
  demo?: boolean;
  /** Linked via Log in with PayPal: payouts go to this PayPal account by payer ID. */
  paypal?: PayPalLink;
};

export type PayPalLink = { payerId: string; email: string; verified: boolean; linkedAt: string };

export type OfferStatus = "open" | "countered" | "accepted" | "rejected" | "superseded" | "withdrawn" | "expired";

export type Offer = {
  id: string;
  version: number;
  by: Role;
  terms: Terms;
  status: OfferStatus;
  isFinal: boolean;
  message: string;
  images?: string[];
  createdAt: string;
  expiresAt: string;
};

export type Message = {
  id: string;
  by: Role | "system";
  text: string;
  flags: ScamFlag[];
  createdAt: string;
};

/** One negotiation between the buyer and one seller. */
export type Thread = {
  id: string;
  sellerId: string;
  offers: Offer[];
  messages: Message[];
  /** Seller's private walk-away floor. Never shown to the buyer, never in the buyer's AI context. */
  sellerFloorCents?: number;
};

export type Agreement = {
  threadId: string;
  offerId: string;
  version: number;
  terms: Terms;
  termsHash: string;
  buyerSignedAt: string;
  sellerSignedAt: string;
  createdAt: string;
};

export type DisputeReason = "not_delivered" | "not_as_described" | "damaged" | "partial" | "other";

export type Dispute = {
  reason: DisputeReason;
  description: string;
  desired: "full_refund" | "partial_refund";
  openedAt: string;
  respondBy: string;
  proposal?: { refundCents: number; note: string; at: string };
  resolution?: { refundCents: number; payoutCents: number; at: string; how: "agreed" | "buyer_withdrew" };
};

export type Review = { by: Role; rating: number; text: string; at: string };

export type RequestStatus =
  | "draft" // posted, budget not yet held
  | "open" // PayPal holds the budget; sellers negotiate
  | "agreed" // offer accepted, agreement signed, winning price captured
  | "shipped" // seller submitted delivery proof, inspection window running
  | "disputed"
  | "completed" // seller paid out
  | "cancelled"; // hold voided or payment refunded

export type WantRequest = {
  id: string;
  code: string;
  title: string;
  description: string;
  category: Category;
  neededBy: string;
  budgetCents: number;
  preferences: string[];
  images?: string[];
  /** Sellers the AI matchmaker invited, best first. */
  matches?: Match[];
  buyerId: string;
  status: RequestStatus;
  createdAt: string;
  /** Seeded example: PayPal calls are simulated and labelled as such. */
  sample?: boolean;
  /** Buyer's private target price. Never shown to sellers. */
  buyerTargetCents?: number;
  threads: Thread[];
  agreement?: Agreement;
  delivery?: { note: string; tracking: string; at: string; inspectionEndsAt: string };
  dispute?: Dispute;
  reviews: Review[];
  events: { at: string; text: string; kind: "info" | "money" | "warn" }[];
  paypal: {
    orderId?: string;
    authorizationId?: string;
    authorizationExpires?: string;
    captureId?: string;
    capturedCents?: number;
    refunds: { id: string; cents: number; status: string }[];
    payoutBatchId?: string;
    payoutCents?: number;
    feeCents?: number;
  };
};

export type Match = { sellerId: string; score: number; reason: string; source: "ai" | "heuristic" };

export type OtpChallenge = { email: string; hash: string; expiresAt: string; attempts: number; createdAt: string };

export type Db = { parties: Party[]; requests: WantRequest[]; otps?: OtpChallenge[] };
