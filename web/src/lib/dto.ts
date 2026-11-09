// What a given viewer is allowed to see. Private limits and other sellers' negotiations are removed here,
// and the AI copilot is built only from this filtered view, so it can never leak the other side's data.
import type { Db, Match, Party, Thread, WantRequest } from "./types";

export type PartyLite = Pick<Party, "id" | "name" | "handle" | "city" | "role" | "bio" | "categories" | "joinedAt"> & { payoutVerified: boolean };

export type RequestView = Omit<WantRequest, "threads" | "buyerTargetCents" | "matches"> & {
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
  payoutVerified: Boolean(p.paypalEmail),
});

export function viewRequest(db: Db, r: WantRequest, viewer: Party): RequestView {
  const buyer = db.parties.find((p) => p.id === r.buyerId)!;
  const role = r.buyerId === viewer.id ? "buyer" : viewer.role === "seller" ? "seller" : "visitor";
  const visible = role === "buyer" ? r.threads : r.threads.filter((t) => t.sellerId === viewer.id);
  const mine = role === "seller" ? r.threads.find((t) => t.sellerId === viewer.id) : undefined;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { buyerTargetCents, threads, matches, ...rest } = r;
  // Double-blind reviews: until both sides submit, a viewer sees only their own.
  const isWinningSeller = role === "seller" && !!r.agreement && r.threads.find((t) => t.id === r.agreement!.threadId)?.sellerId === viewer.id;
  const myReviewRole = role === "buyer" ? "buyer" : isWinningSeller ? "seller" : null;
  const reviews = r.reviews.length === 2 ? r.reviews : r.reviews.filter((x) => x.by === myReviewRole);
  return {
    ...rest,
    reviews,
    matches: matches
      ?.filter((m) => role === "buyer" || m.sellerId === viewer.id)
      .map((m) => ({ ...m, sellerName: db.parties.find((p) => p.id === m.sellerId)?.name ?? "Seller" })),
    mySellerId: viewer.role === "seller" ? viewer.id : undefined,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    threads: visible.map(({ sellerFloorCents: _f, ...t }) => ({ ...t, seller: lite(db.parties.find((p) => p.id === t.sellerId)!) })),
    buyer: lite(buyer),
    viewerRole: role,
    myLimitCents: role === "buyer" ? r.buyerTargetCents : mine?.sellerFloorCents,
    otherOfferCount: r.threads.filter((t) => t.sellerId !== viewer.id && t.offers.length).length,
  };
}
