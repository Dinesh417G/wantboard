// Deal state machine. Every transition checks the caller's role and the current state,
// calls PayPal (or simulates it for sample deals, and says so), and appends to the money trail.
import "server-only";
import { authorizeOrder, captureAuthorization, createAuthorizeOrder, payoutSeller, refundCapture, voidAuthorization } from "./paypal";
import { Conflict, Forbidden, NotFound, getRequest, id, log, mutate, nowIso, read, sha256 } from "./store";
import { canonical, diffTerms, summarizeDiff, validateTerms, type Terms } from "./domain/offers";
import { feeBreakdown, usd, parseDollars } from "./domain/money";
import { scanMessage } from "./domain/scam-shield";
import { cleanImages } from "./domain/images";
import { matchSellers } from "./ai";
import { adminAlert, notify, siteUrl } from "./email";
import { DISPUTE_RESPONSE_HOURS, MAX_ROUNDS, OFFER_TTL_HOURS } from "./config/site";
import type { Db, Dispute, Offer, Party, Thread, WantRequest } from "./types";

export class BadInput extends Error {}

const HOUR = 3_600_000;
const today = () => new Date().toISOString().slice(0, 10);

type Ctx = { db: Db; r: WantRequest; me: Party };

async function load(requestId: string, meId: string): Promise<Ctx> {
  const db = await read();
  const r = getRequest(db, requestId);
  const me = db.parties.find((p) => p.id === meId);
  if (!me) throw new Forbidden("Sign in to do this");
  return { db, r, me };
}

const isBuyer = (c: Ctx) => c.r.buyerId === c.me.id;
function mustBuyer(c: Ctx) {
  if (!isBuyer(c)) throw new Forbidden("only the buyer can do this");
}
function threadOf(r: WantRequest, threadId: unknown): Thread {
  const t = r.threads.find((x) => x.id === threadId);
  if (!t) throw new NotFound("negotiation not found");
  return t;
}
function winningThread(r: WantRequest): Thread {
  if (!r.agreement) throw new Conflict("no agreement yet");
  return threadOf(r, r.agreement.threadId);
}
function expireOffers(r: WantRequest) {
  const now = nowIso();
  for (const t of r.threads) for (const o of t.offers) if (o.status === "open" && o.expiresAt < now) o.status = "expired";
}

/** Apply a mutation to the fresh copy of the request inside one synchronous write. */
function commit<T>(requestId: string, fn: (r: WantRequest, db: Db) => T): Promise<T> {
  return mutate((db) => {
    const r = getRequest(db, requestId);
    expireOffers(r);
    return fn(r, db);
  });
}

function parseTerms(b: Record<string, unknown>): Terms {
  const priceCents = parseDollars(b.price);
  if (priceCents === null) throw new BadInput("Enter a valid price, like 120 or 120.50");
  return {
    priceCents,
    deliveryDate: String(b.deliveryDate ?? ""),
    warrantyMonths: Number(b.warrantyMonths ?? 0),
    inspectionDays: Number(b.inspectionDays ?? 3),
    condition: (b.condition as Terms["condition"]) ?? "new",
    shipping: (b.shipping as Terms["shipping"]) ?? "included",
    note: String(b.note ?? "").trim().slice(0, 500),
  };
}

/** Email a party about a deal event (real accounts only; best effort). */
async function mail(requestId: string, partyId: string | undefined, subject: string, text: string) {
  if (!partyId) return;
  const db = await read();
  notify(db.parties.find((p) => p.id === partyId)?.email, subject, text, requestId);
}

// ---------- PayPal hold ----------

export async function createHold(requestId: string, meId: string) {
  const c = await load(requestId, meId);
  mustBuyer(c);
  if (c.r.status !== "draft") throw new Conflict("budget already secured");
  const order = await createAuthorizeOrder(c.r.id, c.r.budgetCents, c.r.title);
  commit(requestId, (r) => void (r.paypal.orderId = order.id));
  return { orderId: order.id };
}

export async function confirmHold(requestId: string, meId: string) {
  const c = await load(requestId, meId);
  mustBuyer(c);
  if (c.r.status !== "draft" || !c.r.paypal.orderId) throw new Conflict("nothing to authorize");
  const auth = await authorizeOrder(c.r.paypal.orderId);
  const matched = await matchSellers(c.r, c.db.parties.filter((p) => p.role === "seller"));
  return commit(requestId, (r, db) => {
    r.paypal.authorizationId = auth.authorizationId;
    r.paypal.authorizationExpires = auth.expires;
    r.status = "open";
    r.matches = matched;
    log(r, `PayPal is holding ${usd(r.budgetCents)} (authorization ${auth.authorizationId}). Sellers can now make offers.`, "money");
    if (matched.length) {
      const names = matched.map((m) => `${db.parties.find((p) => p.id === m.sellerId)?.name} (${m.score})`).join(", ");
      log(r, `Copilot matched ${matched.length} seller${matched.length === 1 ? "" : "s"} and invited them: ${names}${matched[0].source === "heuristic" ? " [offline heuristic]" : ""}.`);
    }
    return { status: r.status };
  }).then(async (out) => {
    adminAlert(`New request live: ${c.r.title}`, { Buyer: c.me.name, Category: c.r.category, "PayPal hold": usd(c.r.budgetCents), Authorization: auth.authorizationId, "Matched sellers": String(matched.length) }, `${siteUrl()}/r/${requestId}`);
    for (const m of matched) await mail(requestId, m.sellerId, `New match: ${c.r.title}`, `A buyer needs "${c.r.title}" and PayPal is holding ${usd(c.r.budgetCents)} for it. Copilot matched you (${m.score}/100): ${m.reason} Send an offer in the deal room.`);
    return out;
  });
}

// ---------- Negotiation ----------

export async function makeOffer(requestId: string, meId: string, b: Record<string, unknown>) {
  const c = await load(requestId, meId);
  if (c.r.status !== "open") throw new Conflict("this request is not taking offers");
  const t = parseTerms(b);
  const err = validateTerms(t, { maxCents: c.r.budgetCents, today: today() });
  if (err) throw new BadInput(err);
  const message = String(b.message ?? "").trim().slice(0, 1000);
  const isFinal = b.isFinal === true || b.isFinal === "true" || b.isFinal === "on";
  const ttlHours = Math.min(336, Math.max(1, Number(b.ttlHours ?? OFFER_TTL_HOURS)));

  return commit(requestId, (r, db) => {
    let thread: Thread;
    let by: "buyer" | "seller";
    if (r.buyerId === meId) {
      by = "buyer";
      thread = threadOf(r, b.threadId);
    } else {
      by = "seller";
      const me = db.parties.find((p) => p.id === meId)!;
      if (me.role !== "seller") throw new Forbidden("only sellers can make offers on a request");
      if (!me.categories.includes(r.category) && !r.matches?.some((m) => m.sellerId === me.id)) throw new Forbidden("you don't sell in this category");
      thread = r.threads.find((x) => x.sellerId === meId) ?? (() => {
        const nt: Thread = { id: id("t"), sellerId: meId, offers: [], messages: [] };
        r.threads.push(nt);
        return nt;
      })();
    }
    if (thread.offers.length >= MAX_ROUNDS) throw new Conflict("too many rounds; talk it through in chat first");
    const theirs = thread.offers.find((o) => o.status === "open" && o.by !== by);
    if (theirs?.isFinal) throw new Conflict("their offer is marked best-and-final: accept or decline it");
    if (by === "buyer" && !theirs) throw new Conflict("wait for the seller to answer before countering again");
    if (theirs) theirs.status = "countered";
    for (const o of thread.offers) if (o.status === "open" && o.by === by) o.status = "superseded";
    const prev = thread.offers.at(-1);
    const offer: Offer = {
      id: id("o"),
      version: (prev?.version ?? 0) + 1,
      by,
      terms: t,
      status: "open",
      isFinal,
      message,
      images: cleanImages(b.images, 4),
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + ttlHours * HOUR).toISOString(),
    };
    thread.offers.push(offer);
    const seller = db.parties.find((p) => p.id === thread.sellerId)!;
    const summary = prev ? summarizeDiff(diffTerms(prev.terms, t)) : `${usd(t.priceCents)}, delivery ${t.deliveryDate}`;
    log(r, `${by === "buyer" ? "Buyer" : seller.name} ${prev ? "countered" : "offered"} v${offer.version}: ${summary}${isFinal ? " (best and final)" : ""}`);
    return { offer, to: by === "buyer" ? thread.sellerId : r.buyerId, who: by === "buyer" ? "The buyer" : seller.name, summary, title: r.title };
  }).then(async (x) => {
    await mail(requestId, x.to, `New offer on "${x.title}"`, `${x.who} sent offer v${x.offer.version}: ${x.summary}. Accept, counter or decline in the deal room.`);
    return x.offer;
  });
}

export function respondOffer(requestId: string, meId: string, b: Record<string, unknown>, action: "reject" | "withdraw") {
  return commit(requestId, (r, db) => {
    const t = r.threads.find((x) => x.offers.some((o) => o.id === b.offerId));
    const o = t?.offers.find((x) => x.id === b.offerId);
    if (!t || !o) throw new NotFound("offer not found");
    if (o.status !== "open") throw new Conflict("offer is no longer open");
    const myRole = r.buyerId === meId ? "buyer" : t.sellerId === meId ? "seller" : null;
    if (!myRole) throw new Forbidden("not your negotiation");
    if (action === "withdraw" && o.by !== myRole) throw new Forbidden("you can only withdraw your own offer");
    if (action === "reject" && o.by === myRole) throw new Forbidden("you can't decline your own offer");
    o.status = action === "reject" ? "rejected" : "withdrawn";
    const seller = db.parties.find((p) => p.id === t.sellerId)!;
    log(r, `${myRole === "buyer" ? "Buyer" : seller.name} ${action === "reject" ? "declined" : "withdrew"} offer v${o.version}`);
    return { ok: true };
  });
}

/** Accept the exact version on screen: refuse stale or expired offers. Captures the price. */
export async function acceptOffer(requestId: string, meId: string, b: Record<string, unknown>) {
  const c = await load(requestId, meId);
  expireOffers(c.r);
  if (c.r.status !== "open") throw new Conflict("this request is not open");
  const t = c.r.threads.find((x) => x.offers.some((o) => o.id === b.offerId));
  const o = t?.offers.find((x) => x.id === b.offerId);
  if (!t || !o) throw new NotFound("offer not found");
  const myRole = c.r.buyerId === meId ? "buyer" : t.sellerId === meId ? "seller" : null;
  if (!myRole) throw new Forbidden("not your negotiation");
  if (o.by === myRole) throw new Forbidden("the other side has to accept your offer");
  if (o.status !== "open" || o.id !== t.offers.at(-1)?.id || o.version !== Number(b.version))
    throw new Conflict("That offer changed or expired. Review the latest version before accepting.");

  const fees = feeBreakdown(o.terms.priceCents);
  let captureId = "SIMULATED";
  let captureStatus = "COMPLETED";
  if (!c.r.sample) {
    if (!c.r.paypal.authorizationId) throw new Conflict("no PayPal hold on this request");
    const cap = await captureAuthorization(c.r.paypal.authorizationId, o.terms.priceCents, c.r.id);
    captureId = cap.captureId;
    captureStatus = cap.status;
  }

  return commit(requestId, (r, db) => {
    const thread = threadOf(r, t.id);
    const offer = thread.offers.find((x) => x.id === o.id)!;
    offer.status = "accepted";
    for (const other of r.threads) for (const x of other.offers) if (x.status === "open") x.status = "rejected";
    const now = nowIso();
    const termsHash = sha256(canonical({ request: r.id, seller: thread.sellerId, buyer: r.buyerId, version: offer.version, terms: offer.terms }));
    r.agreement = { threadId: thread.id, offerId: offer.id, version: offer.version, terms: offer.terms, termsHash, buyerSignedAt: now, sellerSignedAt: now, createdAt: now };
    r.paypal.captureId = captureId;
    r.paypal.capturedCents = offer.terms.priceCents;
    r.paypal.feeCents = fees.feeCents;
    r.paypal.payoutCents = fees.payoutCents;
    r.status = "agreed";
    const seller = db.parties.find((p) => p.id === thread.sellerId)!;
    const released = r.budgetCents - offer.terms.priceCents;
    log(r, `Agreement v${offer.version} signed by both sides. Fingerprint ${termsHash.slice(0, 12)}…`);
    log(
      r,
      `PayPal captured ${usd(offer.terms.priceCents)} for ${seller.name} (capture ${captureId}, ${captureStatus})${r.sample ? " (simulated)" : ""}` +
        (released > 0 ? `; ${usd(released)} of the hold released to the buyer.` : "."),
      "money",
    );
    return { status: r.status, seller: thread.sellerId, buyer: r.buyerId, title: r.title, price: offer.terms.priceCents };
  }).then(async (x) => {
    await mail(requestId, x.seller, `Deal agreed: ${x.title}`, `Your offer of ${usd(x.price)} was accepted and PayPal has captured the payment. Ship the item and mark it shipped in the deal room.`);
    await mail(requestId, x.buyer, `Agreement signed: ${x.title}`, `PayPal captured ${usd(x.price)}. The seller is paid only after you receive and inspect the item.`);
    return { status: x.status };
  });
}

export function postMessage(requestId: string, meId: string, b: Record<string, unknown>) {
  const text = String(b.text ?? "").trim().slice(0, 2000);
  if (!text) throw new BadInput("message is empty");
  return commit(requestId, (r) => {
    const t = threadOf(r, b.threadId);
    const by = r.buyerId === meId ? "buyer" : t.sellerId === meId ? "seller" : null;
    if (!by) throw new Forbidden("not your negotiation");
    const flags = scanMessage(text);
    t.messages.push({ id: id("m"), by, text, flags, createdAt: nowIso() });
    if (flags.length) log(r, `Scam shield flagged a ${by} message (${flags.map((f) => f.kind).join(", ")}). Payments outside Clinch are not protected.`, "warn");
    return { flags };
  });
}

/** Save the caller's own private limit. The other side never sees it. */
export function savePrivateLimit(requestId: string, meId: string, b: Record<string, unknown>) {
  const cents = b.amount === "" || b.amount == null ? undefined : parseDollars(b.amount);
  if (cents === null) throw new BadInput("Enter a valid amount");
  return commit(requestId, (r) => {
    if (r.buyerId === meId) r.buyerTargetCents = cents;
    else {
      const t = threadOf(r, b.threadId);
      if (t.sellerId !== meId) throw new Forbidden("not your negotiation");
      t.sellerFloorCents = cents;
    }
    return { ok: true };
  });
}

// ---------- Delivery, release, disputes ----------

export function ship(requestId: string, meId: string, b: Record<string, unknown>) {
  return commit(requestId, (r) => {
    if (r.status !== "agreed") throw new Conflict("nothing to ship");
    const t = winningThread(r);
    if (t.sellerId !== meId) throw new Forbidden("only the seller can mark this shipped");
    const days = r.agreement!.terms.inspectionDays;
    const ends = new Date(Date.now() + days * 24 * HOUR).toISOString();
    r.delivery = { note: String(b.note ?? "").slice(0, 500), tracking: String(b.tracking ?? "").slice(0, 80), at: nowIso(), inspectionEndsAt: ends };
    r.status = "shipped";
    log(r, `Seller submitted delivery${r.delivery.tracking ? ` (tracking ${r.delivery.tracking})` : ""}. Buyer has ${days} day${days === 1 ? "" : "s"} to inspect; payment releases automatically after that.`);
    return { status: r.status, buyer: r.buyerId, title: r.title, days, tracking: r.delivery.tracking };
  }).then(async (x) => {
    await mail(requestId, x.buyer, `Shipped: ${x.title}`, `The seller marked your item shipped${x.tracking ? ` (tracking ${x.tracking})` : ""}. You have ${x.days} days after it arrives to accept it or open a dispute.`);
    return { status: x.status };
  });
}

async function payOut(requestId: string, payoutCents: number, why: string) {
  const db = await read();
  const r = getRequest(db, requestId);
  const t = winningThread(r);
  const seller = db.parties.find((p) => p.id === t.sellerId)!;
  let batch = "SIMULATED";
  let status = "SUCCESS";
  if (!r.sample && payoutCents > 0) {
    const out = await payoutSeller({
      batchKey: `payout-${r.id}`,
      email: seller.paypalEmail,
      cents: payoutCents,
      note: `Clinch: "${r.title}". ${why}`,
    });
    batch = out.payoutBatchId;
    status = out.status;
  }
  return { batch, status, seller };
}

export async function release(requestId: string, meId: string | null) {
  const c = meId ? await load(requestId, meId) : null;
  const r = c?.r ?? getRequest(await read(), requestId);
  if (c) mustBuyer(c);
  if (r.status !== "shipped") throw new Conflict("nothing to release");
  if (!meId && r.delivery!.inspectionEndsAt > nowIso()) throw new Conflict("inspection window still running");
  const payout = r.paypal.payoutCents!;
  const { batch, status, seller } = await payOut(requestId, payout, `Price ${usd(r.paypal.capturedCents!)} minus platform fee ${usd(r.paypal.feeCents!)}.`);
  return commit(requestId, (x) => {
    x.paypal.payoutBatchId = batch;
    x.status = "completed";
    log(x, meId ? "Buyer accepted the delivery." : "Inspection window ended with no dispute: auto-accepted.");
    log(x, `PayPal Payouts sent ${usd(payout)} to ${seller.name} (batch ${batch}, ${status})${x.sample ? " (simulated)" : ""}; platform fee ${usd(x.paypal.feeCents!)}.`, "money");
    return { status: x.status };
  }).then(async (out) => {
    await mail(requestId, seller.id, `You've been paid: ${r.title}`, `PayPal Payouts sent ${usd(payout)} to your PayPal account. Leave a review for the buyer in the deal room.`);
    return out;
  });
}

/** Auto-release when the inspection window has passed. Safe to call repeatedly. */
export async function tick(requestId: string) {
  const r = getRequest(await read(), requestId);
  if (r.status === "shipped" && r.delivery && r.delivery.inspectionEndsAt <= nowIso()) return release(requestId, null);
  return { status: r.status };
}

export function openDispute(requestId: string, meId: string, b: Record<string, unknown>) {
  return commit(requestId, (r) => {
    if (r.buyerId !== meId) throw new Forbidden("only the buyer can open a dispute");
    if (r.status !== "shipped") throw new Conflict("disputes open during the inspection window");
    if (r.delivery!.inspectionEndsAt < nowIso()) throw new Conflict("the inspection window has ended");
    const reason = String(b.reason ?? "other") as Dispute["reason"];
    const description = String(b.description ?? "").trim().slice(0, 2000);
    if (description.length < 10) throw new BadInput("Describe the problem (at least 10 characters)");
    r.dispute = {
      reason,
      description,
      desired: b.desired === "partial_refund" ? "partial_refund" : "full_refund",
      openedAt: nowIso(),
      respondBy: new Date(Date.now() + DISPUTE_RESPONSE_HOURS * HOUR).toISOString(),
    };
    r.status = "disputed";
    log(r, `Buyer opened a dispute (${reason.replaceAll("_", " ")}). Payment is frozen; seller has ${DISPUTE_RESPONSE_HOURS} hours to respond.`, "warn");
    return { status: r.status, seller: winningThread(r).sellerId, title: r.title };
  }).then(async (x) => {
    await mail(requestId, x.seller, `Dispute opened: ${x.title}`, `The buyer opened a dispute. Payment is frozen until it's settled. Respond within ${DISPUTE_RESPONSE_HOURS} hours with a settlement proposal.`);
    return { status: x.status };
  });
}

export function proposeSettlement(requestId: string, meId: string, b: Record<string, unknown>) {
  const refundCents = parseDollars(b.refund);
  if (refundCents === null) throw new BadInput("Enter a refund amount");
  return commit(requestId, (r) => {
    if (r.status !== "disputed" || !r.dispute) throw new Conflict("no open dispute");
    if (winningThread(r).sellerId !== meId) throw new Forbidden("only the seller can propose a settlement");
    if (refundCents > r.paypal.capturedCents!) throw new BadInput("refund can't exceed what the buyer paid");
    r.dispute.proposal = { refundCents, note: String(b.note ?? "").slice(0, 500), at: nowIso() };
    log(r, `Seller proposed a settlement: refund ${usd(refundCents)} to the buyer.`);
    return { ok: true };
  });
}

/** Buyer accepts the seller's proposal: PayPal partial refund, then payout of the rest. */
export async function acceptSettlement(requestId: string, meId: string) {
  const c = await load(requestId, meId);
  mustBuyer(c);
  const r = c.r;
  if (r.status !== "disputed" || !r.dispute?.proposal) throw new Conflict("no settlement to accept");
  const refundCents = r.dispute.proposal.refundCents;
  const paid = r.paypal.capturedCents!;
  const fees = feeBreakdown(paid - refundCents);
  let refundId = "SIMULATED";
  let refundStatus = "COMPLETED";
  if (refundCents > 0 && !r.sample) {
    const ref = await refundCapture(r.paypal.captureId!, `Clinch dispute settlement: ${r.title}`, refundCents === paid ? undefined : refundCents);
    refundId = ref.refundId;
    refundStatus = ref.status;
  }
  const { batch, status, seller } = await payOut(requestId, fees.payoutCents, `Settled dispute: price ${usd(paid)}, refunded ${usd(refundCents)}, fee ${usd(fees.feeCents)}.`);
  return commit(requestId, (x) => {
    if (refundCents > 0) x.paypal.refunds.push({ id: refundId, cents: refundCents, status: refundStatus });
    x.paypal.payoutCents = fees.payoutCents;
    x.paypal.feeCents = fees.feeCents;
    x.paypal.payoutBatchId = fees.payoutCents > 0 ? batch : undefined;
    x.dispute!.resolution = { refundCents, payoutCents: fees.payoutCents, at: nowIso(), how: "agreed" };
    x.status = fees.payoutCents > 0 ? "completed" : "cancelled";
    log(x, `Dispute settled by agreement.`);
    if (refundCents > 0) log(x, `PayPal refunded ${usd(refundCents)} to the buyer (refund ${refundId}, ${refundStatus})${x.sample ? " (simulated)" : ""}.`, "money");
    if (fees.payoutCents > 0) log(x, `PayPal Payouts sent ${usd(fees.payoutCents)} to ${seller.name} (batch ${batch}, ${status})${x.sample ? " (simulated)" : ""}.`, "money");
    return { status: x.status };
  });
}

export async function cancel(requestId: string, meId: string) {
  const c = await load(requestId, meId);
  mustBuyer(c);
  const r = c.r;
  if (r.status === "draft") {
    return commit(requestId, (x) => {
      x.status = "cancelled";
      log(x, "Cancelled before the budget was held.");
      return { status: x.status };
    });
  }
  if (r.status === "open") {
    if (!r.sample && r.paypal.authorizationId) await voidAuthorization(r.paypal.authorizationId);
    return commit(requestId, (x) => {
      x.status = "cancelled";
      for (const t of x.threads) for (const o of t.offers) if (o.status === "open") o.status = "rejected";
      log(x, `Request cancelled. PayPal hold voided${x.sample ? " (simulated)" : ""}; the buyer was never charged.`, "money");
      return { status: x.status };
    });
  }
  if (r.status === "agreed") {
    const ref = r.sample ? { refundId: "SIMULATED", status: "COMPLETED" } : await refundCapture(r.paypal.captureId!, `Clinch refund: ${r.title}`);
    return commit(requestId, (x) => {
      x.paypal.refunds.push({ id: ref.refundId, cents: x.paypal.capturedCents!, status: ref.status });
      x.status = "cancelled";
      log(x, `Cancelled before shipping. PayPal refunded ${usd(x.paypal.capturedCents!)} in full (refund ${ref.refundId}, ${ref.status})${x.sample ? " (simulated)" : ""}.`, "money");
      return { status: x.status };
    });
  }
  throw new Conflict(`can't cancel once the item has shipped; open a dispute instead`);
}

export function review(requestId: string, meId: string, b: Record<string, unknown>) {
  return commit(requestId, (r) => {
    if (r.status !== "completed") throw new Conflict("reviews open after the deal completes");
    const role = r.buyerId === meId ? "buyer" : winningThread(r).sellerId === meId ? "seller" : null;
    if (!role) throw new Forbidden("not your deal");
    if (r.reviews.some((x) => x.by === role)) throw new Conflict("you already reviewed this deal");
    const rating = Math.round(Number(b.rating));
    if (!(rating >= 1 && rating <= 5)) throw new BadInput("rating must be 1–5");
    r.reviews.push({ by: role, rating, text: String(b.text ?? "").slice(0, 500), at: nowIso() });
    log(r, `${role === "buyer" ? "Buyer" : "Seller"} left a review${r.reviews.length === 2 ? "; both reviews are now public" : " (hidden until the other side reviews too)"}.`);
    return { ok: true };
  });
}
