// Brand and business constants. Rename the product here.
export const SITE = {
  name: "Clinch",
  tagline: "Post what you need. Negotiate in the open. Close with PayPal holding the money.",
  shortPitch: "The deal room for hard-to-find things.",
  currency: "USD",
} as const;

/** Platform fee in basis points, deducted from the seller payout (600 = 6%). Covers PayPal processing. */
export const PLATFORM_FEE_BPS = 600;
/** Clinch Pro (PayPal Subscriptions): sellers pay monthly for a lower fee and priority matching. */
export const PRO = { priceUsd: "9.99", feeBps: 300, matchBoost: 8, name: "Clinch Pro" } as const;
/** Default inspection window after delivery, in days. */
export const DEFAULT_INSPECTION_DAYS = 3;
/** Default offer validity, in hours. Shown as a real countdown, never invented urgency. */
export const OFFER_TTL_HOURS = 48;
/** Max offers per negotiation thread before the UI suggests a call. */
export const MAX_ROUNDS = 30;
/** Hours a seller has to answer a dispute. */
export const DISPUTE_RESPONSE_HOURS = 72;
