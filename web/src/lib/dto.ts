// What a given viewer is allowed to see. Private limits and other sellers' negotiations are removed here,
// and the AI copilot is built only from this filtered view, so it can never leak the other side's data.
import type { Address, Db, Match, Party, Thread, WantRequest } from "./types";
import { canServe, publicArea, reachShort } from "./domain/location";
import { feeBpsFor, isPro } from "./pro";

export type PartyLite = Pick<Party, "id" | "name" | "handle" | "city" | "role" | "bio" | "categories" | "joinedAt"> & { payoutVerified: boolean; paypalConnected: boolean; paypalVerified: boolean; pro: boolean };

/**
 * The PayPal block as one viewer may see it (built by viewRequest, never spread from the request):
 * amounts and statuses for anyone who can open the deal; hold timing for the buyer and sellers who negotiate on it;
 * PayPal ids, payout destination and the PayPal dispute for the buyer and the winning seller; the authorization id for the buyer.
 */
export type PayPalView = {
  capturedCents?: number;
  payoutCents?: number;
  payoutStatus?: string;
  refunds: { id?: string; cents: number; status: string }[];
  authorizedAt?: string;
  reauthorizations?: number;
  captureId?: string;
  payoutBatchId?: string;
  payoutTo?: string;
  dispute?: NonNullable<WantRequest["paypal"]["dispute"]>;
  authorizationId?: string;
};

export type RequestView = Omit<WantRequest, "threads" | "buyerTargetCents" | "matches" | "shipTo" | "paypal"> & {
  paypal: PayPalView;
  /** Full address for the buyer and (after agreement) the winning seller; city, state and ZIP prefix for everyone else. */
  shipTo?: { city: string; state: string; zip: string } & Partial<Omit<Address, "city" | "state" | "zip">> & { name?: string; full: boolean };
  reachText: string;
  /** Viewer is a seller whose location the buyer accepts. */
  canOffer: boolean;
  /** Platform fee rate the viewing seller would pay (Clinch Pro pays less). */
  myFeeBps: number;
  matches?: (Match & { sellerName: string })[];
  /** Set when the viewer is a seller. */
  mySellerId?: string;
  threads: (Omit<Thread, "sellerFloorCents"> & { seller: PartyLite })[];
  buyer: PartyLite;
  viewerRole: "buyer" | "seller" | "visitor";
  /** Only the viewer's own private limit. */
  myLimitCents?: number;
  otherOfferCount: number;
};

export const lite = (p: Party): PartyLite => ({
  id: p.id,
  name: p.name,
  handle: p.handle,
  city: p.city,
  role: p.role,
  bio: p.bio,
  categories: p.categories,
  joinedAt: p.joinedAt,
  payoutVerified: Boolean(p.paypalEmail || p.paypal),
  paypalConnected: Boolean(p.paypal),
  paypalVerified: Boolean(p.paypal?.verified),
  pro: isPro(p),
});

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Payout lines in the money trail name the seller's PayPal email or Venmo handle. Nobody reads those back out of a deal. */
function scrub(text: string, secrets: string[]) {
  let out = text.replace(EMAIL, "[email hidden]");
  for (const x of secrets) if (x.length > 2) out = out.split(x).join("[hidden]");
  return out;
}

const hidePayTo = (to?: string) => to?.replace(/^PayPal .+@.+$/, "PayPal").replace(/^Venmo .+$/, "Venmo");

/**
 * Roles: the buyer; a seller with a negotiation on this deal (the winning seller is the one the agreement names);
 * everyone else (guests, other sellers, other buyers) is a visitor. Deal data is whitelisted per role below, so a field
 * added to WantRequest later stays private until someone decides who may see it.
 */
export function viewRequest(db: Db, r: WantRequest, viewer: Party): RequestView {
  const buyer = db.parties.find((p) => p.id === r.buyerId)!;
  const role = r.buyerId === viewer.id ? "buyer" : viewer.role === "seller" ? "seller" : "visitor";
  const visible = role === "buyer" ? r.threads : r.threads.filter((t) => t.sellerId === viewer.id);
  const mine = role === "seller" ? r.threads.find((t) => t.sellerId === viewer.id) : undefined;
  const { buyerTargetCents, matches, shipTo } = r;
  // Double-blind reviews: until both sides submit, a viewer sees only their own.
  const winningSellerId = r.agreement ? r.threads.find((t) => t.id === r.agreement!.threadId)?.sellerId : undefined;
  const isWinningSeller = role === "seller" && winningSellerId === viewer.id;
  const myReviewRole = role === "buyer" ? "buyer" : isWinningSeller ? "seller" : null;
  const reviews = r.reviews.length === 2 ? r.reviews : r.reviews.filter((x) => x.by === myReviewRole);
  const seesAddress = role === "buyer" || isWinningSeller;
  const inDeal = role === "buyer" || !!mine; // may ask the server to renew the hold / sync PayPal (the tick action)
  const insider = role === "buyer" || isWinningSeller; // the two sides of the agreement
  const p = r.paypal;
  const winner = winningSellerId ? db.parties.find((x) => x.id === winningSellerId) : undefined;
  const secrets = [winner?.paypalEmail, winner?.paypal?.email, winner?.payout?.venmo].filter((x): x is string => !!x);
  // Money trail: the buyer sees all of it. The winning seller sees the money lines only (the rest names the other sellers'
  // offers). Sellers who did not win, and every visitor, see none: it names the winner's payout and the buyer's PayPal ids.
  const events = role === "buyer" ? r.events : isWinningSeller ? r.events.filter((e) => e.kind === "money") : [];
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description,
    category: r.category,
    neededBy: r.neededBy,
    budgetCents: r.budgetCents,
    preferences: r.preferences,
    images: r.images,
    reach: r.reach,
    buyerId: r.buyerId,
    status: r.status,
    createdAt: r.createdAt,
    sample: r.sample,
    agreement: r.agreement,
    ...(insider ? { delivery: r.delivery, dispute: r.dispute } : {}),
    events: events.map((e) => ({ ...e, text: scrub(e.text, secrets) })),
    paypal: {
      capturedCents: p.capturedCents,
      payoutCents: p.payoutCents,
      payoutStatus: p.payoutStatus,
      refunds: p.refunds.map((f) => (insider ? { id: f.id, cents: f.cents, status: f.status } : { cents: f.cents, status: f.status })),
      ...(inDeal ? { authorizedAt: p.authorizedAt, reauthorizations: p.reauthorizations } : {}),
      ...(insider ? { captureId: p.captureId, payoutBatchId: p.payoutBatchId, payoutTo: hidePayTo(p.payoutTo), dispute: p.dispute } : {}),
      ...(role === "buyer" ? { authorizationId: p.authorizationId } : {}),
    },
    shipTo: shipTo ? (seesAddress ? { ...shipTo, full: true } : { ...publicArea(shipTo), full: false }) : undefined,
    reachText: reachShort(r),
    canOffer: viewer.role === "seller" && canServe(viewer, r),
    myFeeBps: p.feeBps ?? feeBpsFor(viewer),
    reviews,
    matches: matches
      ?.filter((m) => role === "buyer" || m.sellerId === viewer.id)
      .map((m) => ({ ...m, sellerName: db.parties.find((x) => x.id === m.sellerId)?.name ?? "Seller" })),
    mySellerId: viewer.role === "seller" ? viewer.id : undefined,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    threads: visible.map(({ sellerFloorCents: _f, ...t }) => ({ ...t, seller: lite(db.parties.find((x) => x.id === t.sellerId)!) })),
    buyer: lite(buyer),
    viewerRole: role,
    myLimitCents: role === "buyer" ? buyerTargetCents : mine?.sellerFloorCents,
    otherOfferCount: r.threads.filter((t) => t.sellerId !== viewer.id && t.offers.length).length,
  };
}
