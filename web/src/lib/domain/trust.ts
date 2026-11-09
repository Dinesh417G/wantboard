// Transparent trust score: every component is shown, not a black box. Pure.
import type { Db, Party } from "../types";

export type TrustStats = {
  completed: number;
  onTimeRate: number | null;
  disputes: number;
  avgRating: number | null;
  reviews: { rating: number; text: string; at: string; from: string }[];
  score: number;
  parts: { label: string; points: number; max: number }[];
};

export function trustStats(db: Db, party: Party): TrustStats {
  const mine = db.requests.filter((r) =>
    party.role === "buyer" ? r.buyerId === party.id : r.agreement && r.threads.find((t) => t.id === r.agreement!.threadId)?.sellerId === party.id,
  );
  const done = mine.filter((r) => r.status === "completed");
  const onTime = done.filter((r) => r.delivery && r.agreement && r.delivery.at.slice(0, 10) <= r.agreement.terms.deliveryDate);
  const disputes = mine.filter((r) => r.dispute).length;
  const other = party.role === "buyer" ? "seller" : "buyer";
  // Double-blind: a review is published only when both sides have submitted.
  const reviews = done
    .filter((r) => r.reviews.length === 2)
    .map((r) => r.reviews.find((x) => x.by === other)!)
    .map((x) => ({ rating: x.rating, text: x.text, at: x.at, from: other }));
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const onTimeRate = party.role === "seller" && done.length ? onTime.length / done.length : null;

  const parts = [
    // Log in with PayPal (verified PayPal account) beats a typed-in payout email.
    { label: "PayPal identity", points: party.paypal?.verified ? 20 : party.paypal ? 18 : party.paypalEmail ? 15 : 0, max: 20 },
    { label: "Completed deals", points: Math.min(30, Math.round(Math.log2(1 + done.length) * 12)), max: 30 },
    { label: "On-time delivery", points: onTimeRate === null ? 10 : Math.round(onTimeRate * 20), max: 20 },
    { label: "Ratings", points: avg === null ? 10 : Math.round((avg / 5) * 20), max: 20 },
    { label: "Dispute record", points: Math.max(0, 10 - disputes * 5), max: 10 },
  ];
  return {
    completed: done.length,
    onTimeRate,
    disputes,
    avgRating: avg,
    reviews,
    score: parts.reduce((s, p) => s + p.points, 0),
    parts,
  };
}
