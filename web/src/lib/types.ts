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
  /** Default delivery address (buyers) / ships-from address (sellers). Private: never shown publicly. */
  address?: Address & { source: "paypal" | "manual" };
  /** How a seller gets paid. Default: PayPal (linked account, else paypalEmail). */
  payout?: { method: "paypal" | "venmo"; venmo?: string };
  /** Clinch Pro subscription (PayPal Subscriptions API). */
  pro?: ProSub;
};

export type ProSub = { subscriptionId: string; status: string; since: string; nextBillingAt?: string; updatedAt: string };

export type Address = { line1: string; line2?: string; city: string; state: string; zip: string; country: "US" };
/** Which sellers may make offers, relative to the delivery address. */
export type Reach = "us" | "state" | "city";

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
  /** Delivery address. Full street only for the buyer, and the winning seller after agreement. */
  shipTo?: Address & { name: string };
  reach?: Reach;
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
  delivery?: { note: string; tracking: string; carrier?: string; paypalTracker?: string; at: string; inspectionEndsAt: string };
  dispute?: Dispute;
  reviews: Review[];
  events: { at: string; text: string; kind: "info" | "money" | "warn" }[];
  paypal: {
    orderId?: string;
    /** How many PayPal orders were created for the hold (a fresh one replaces an expired one). */
    orderAttempts?: number;
    authorizationId?: string;
    authorizationExpires?: string;
    /** When the current authorization was placed: PayPal guarantees the funds for 3 days from here. */
    authorizedAt?: string;
    reauthorizations?: number;
    /** First authorization time: PayPal allows renewing the hold until 29 days after this. */
    heldSince?: string;
    captureId?: string;
    capturedCents?: number;
    /** From GET /v2/payments/captures/{id}: PayPal Seller Protection and the fee/net PayPal applied to the capture. */
    protection?: { status: string; categories: string[]; paypalFeeCents?: number; netCents?: number; checkedAt: string };
    /** PayPal reversed the captured payment (chargeback, bank reversal, failed funding). Pauses payout and settlement. */
    reversal?: { at: string; source: "webhook" | "status-check"; detail: string };
    refunds: { id: string; cents: number; status: string }[];
    payoutBatchId?: string;
    payoutItemId?: string;
    /** Latest PayPal payout item status (SUCCESS, PENDING, UNCLAIMED, FAILED, RETURNED...). */
    payoutStatus?: string;
    /** Payout retries so far. Persisted BEFORE each retry is sent: retry n uses key payout-<request>-<n>, the first payout key payout-<request>. */
    payoutAttempts?: number;
    payoutCheckedAt?: string;
    /**
     * A money step that has a PayPal call in flight (capture, void, refund, payout). Written inside the serialized
     * commit BEFORE the call, so a second request cannot start a conflicting step; cleared when the step ends.
     * A marker older than two minutes is treated as dead (the process that set it died) and can be taken over.
     */
    inflight?: { op: "capture" | "void" | "refund" | "payout" | "settle"; ref: string; token: string; at: string };
    payoutTo?: string;
    /** A dispute the buyer opened inside PayPal (separate from Clinch's own dispute flow). */
    dispute?: {
      id: string;
      status: string;
      reason: string;
      stage: string;
      amountCents: number;
      createdAt: string;
      updatedAt: string;
      respondBy?: string;
      outcome?: string;
      buyerMessage?: string;
      evidenceSentAt?: string;
      acceptedAt?: string;
    };
    disputeCheckedAt?: string;
    payoutCents?: number;
    feeCents?: number;
    /** Fee rate locked at agreement (Pro sellers pay less). */
    feeBps?: number;
  };
};

export type Match = { sellerId: string; score: number; reason: string; source: "ai" | "heuristic" };

export type OtpChallenge = { email: string; hash: string; expiresAt: string; attempts: number; createdAt: string };

export type Db = {
  parties: Party[];
  requests: WantRequest[];
  otps?: OtpChallenge[];
  /** PayPal catalog product + billing plan for Clinch Pro, created once. */
  meta?: { proProductId?: string; proPlanId?: string };
};
