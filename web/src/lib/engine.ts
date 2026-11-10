// Deal state machine. Every transition checks the caller's role and the current state,
// calls PayPal (or simulates it for sample deals, and says so), and appends to the money trail.
import "server-only";
import { canServe, reachShort } from "./domain/location";
import { acceptDisputeClaim, addTracking, cancelUnclaimedPayout, captureDetails, CARRIERS, disputesForCapture, getDispute, getPayout, provideDisputeEvidence, reauthorize, type Carrier, type PayPalDispute } from "./paypal";
import { PayPalError, authorizeOrder, captureAuthorization, createAuthorizeOrder, orderStatus, payoutSeller, refundCapture, voidAuthorization } from "./paypal";
import { Conflict, Forbidden, NotFound, demoOnRealDeal, getRequest, id, log, mutate, nowIso, read, sha256 } from "./store";
import { canonical, diffTerms, summarizeDiff, validateTerms, type Terms } from "./domain/offers";
import { feeBreakdown, usd, parseDollars } from "./domain/money";
import { scanMessage } from "./domain/scam-shield";
import { cleanImages } from "./domain/images";
import { matchSellers } from "./ai";
import { feeBpsFor, isPro } from "./pro";
import { PRO } from "./config/site";
import { adminAlert, notify, siteUrl } from "./email";
import { DISPUTE_RESPONSE_HOURS, MAX_ROUNDS, OFFER_TTL_HOURS } from "./config/site";
import type { Db, Dispute, Offer, Party, Thread, WantRequest } from "./types";

export class BadInput extends Error {}

const HOUR = 3_600_000;
const today = () => new Date().toISOString().slice(0, 10);

type Ctx = { db: Db; r: WantRequest; me: Party };

/** Every deal action passes through here (load() or a commit callback): shared demo accounts may only act on demo deals. */
function demoGate(db: Db, r: WantRequest, meId: string | null) {
  if (meId && demoOnRealDeal(db, r, db.parties.find((p) => p.id === meId))) throw new Forbidden("Demo accounts can only act on demo deals");
}

async function load(requestId: string, meId: string): Promise<Ctx> {
  const db = await read();
  const r = getRequest(db, requestId);
  const me = db.parties.find((p) => p.id === meId);
  if (!me) throw new Forbidden("Sign in to do this");
  demoGate(db, r, meId);
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

// ---------- In-flight money steps ----------
// A PayPal call sits between "check the state" and "write the result". To keep two requests from both passing the
// check, every money step (1) re-checks its precondition and claims a marker inside one serialized commit(),
// (2) calls PayPal, (3) re-checks again and clears the marker in the commit that records the result.
// Other writers that would change what the step relies on call notBusy() and back off.

const INFLIGHT_MS = 2 * 60_000;
type Inflight = NonNullable<WantRequest["paypal"]["inflight"]>;

const inflightOf = (r: WantRequest): Inflight | undefined => {
  const m = r.paypal.inflight;
  return m && Date.now() - Date.parse(m.at) < INFLIGHT_MS ? m : undefined;
};

/** Run inside commit(): refuse while a money step is running on this deal. */
function notBusy(r: WantRequest) {
  if (inflightOf(r)) throw new Conflict("A payment step on this deal is still running. Try again in a moment.");
}

/** Run inside commit(): take the marker (a stale one is taken over) and return this step's token. */
function claim(r: WantRequest, op: Inflight["op"], ref: string): string {
  notBusy(r);
  const token = id("k");
  r.paypal.inflight = { op, ref, token, at: nowIso() };
  return token;
}

/** The PayPal call failed: give the marker back (only our own). */
async function unclaim(requestId: string, token: string) {
  await commit(requestId, (r) => {
    if (r.paypal.inflight?.token === token) delete r.paypal.inflight;
  }).catch((e) => console.warn("[unclaim]", (e as Error).message));
}

/** PayPal moved money but the deal could not record it: leave a loud trail for support instead of guessing. */
async function flagForSupport(requestId: string, text: string) {
  await commit(requestId, (r) => log(r, `${text} Support review needed.`, "warn")).catch((e) => console.error("[flag]", (e as Error).message));
  adminAlert(`Support review needed: ${requestId}`, { Request: requestId, What: text }, `${siteUrl()}/r/${requestId}`);
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
  if (c.r.paypal.orderId) {
    const st = await orderStatus(c.r.paypal.orderId).catch(() => "GONE");
    // Approved earlier but the hold step didn't finish: finish it instead of asking PayPal again.
    if (st === "APPROVED") throw new Conflict("You already approved this in PayPal. Press “Place the hold” to finish.");
    if (st === "CREATED" || st === "PAYER_ACTION_REQUIRED") return { orderId: c.r.paypal.orderId };
    // Expired, voided or otherwise unusable: create a fresh order below.
  }
  const attempt = (c.r.paypal.orderAttempts ?? (c.r.paypal.orderId ? 1 : 0)) + 1;
  const order = await createAuthorizeOrder(c.r.id, c.r.budgetCents, c.r.title, c.r.shipTo, attempt);
  // Must be awaited: on serverless the function can stop right after the response.
  await commit(requestId, (r) => {
    r.paypal.orderId = order.id;
    r.paypal.orderAttempts = attempt;
  });
  return { orderId: order.id };
}

export async function confirmHold(requestId: string, meId: string, b: Record<string, unknown> = {}) {
  const c = await load(requestId, meId);
  mustBuyer(c);
  if (c.r.status === "open" && c.r.paypal.authorizationId) return { status: c.r.status }; // double click / retry
  if (c.r.status !== "draft") throw new Conflict("this request is past the hold step");
  // The order id from PayPal's onApprove is a fallback; authorizeOrder checks it belongs to this request.
  const orderId = c.r.paypal.orderId ?? (typeof b.orderId === "string" ? b.orderId : "");
  if (!orderId) throw new Conflict("PayPal order not found. Click the PayPal button again.");
  let auth;
  try {
    auth = await authorizeOrder(orderId, requestId);
  } catch (e) {
    // The approval can't be used any more (expired, unknown, not approved): start over with a fresh PayPal order.
    if (e instanceof PayPalError && (e.status === 404 || e.status === 422)) {
      await commit(requestId, (r) => {
        r.paypal.orderAttempts = r.paypal.orderAttempts ?? 1;
        delete r.paypal.orderId;
        log(r, `PayPal couldn't use the earlier approval (${e.message.slice(0, 100)}). Approve again to place the hold.`, "warn");
      });
      throw new Conflict("That PayPal approval can't be used any more. Click the PayPal button to approve again.");
    }
    throw e;
  }
  const eligible = c.db.parties.filter((p) => p.role === "seller" && canServe(p, c.r));
  // Clinch Pro sellers get priority: a small score boost, then re-rank.
  const matched = (await matchSellers(c.r, eligible))
    .map((m) => (isPro(eligible.find((p) => p.id === m.sellerId)) ? { ...m, score: Math.min(100, m.score + PRO.matchBoost), reason: `${m.reason} (Pro seller)` } : m))
    .sort((a, b) => b.score - a.score);
  return commit(requestId, (r, db) => {
    r.paypal.orderId = orderId;
    r.paypal.authorizationId = auth.authorizationId;
    r.paypal.authorizedAt = r.paypal.heldSince = nowIso();
    r.paypal.authorizationExpires = auth.expires;
    r.status = "open";
    r.matches = matched;
    log(r, `PayPal is holding ${usd(r.budgetCents)} (authorization ${auth.authorizationId})${r.shipTo ? `, ship-to ${r.shipTo.city}, ${r.shipTo.state} on the PayPal order` : ""}. Offers open (${reachShort(r)}).`, "money");
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

const HONOR_MS = 3 * 24 * HOUR;
const VALID_MS = 29 * 24 * HOUR;

/**
 * PayPal guarantees held funds for a 3-day honor period; the authorization itself is valid 29 days.
 * Past the honor period, renew it so the capture is guaranteed again. Returns the authorization id to use.
 */
async function freshHold(requestId: string): Promise<string | undefined> {
  const r = getRequest(await read(), requestId);
  const p = r.paypal;
  if (r.sample || !p.authorizationId || !p.authorizedAt || p.captureId) return p.authorizationId;
  if (Date.now() - Date.parse(p.authorizedAt) <= HONOR_MS) return p.authorizationId;
  if (Date.now() - Date.parse(p.heldSince ?? p.authorizedAt) >= VALID_MS) return p.authorizationId;
  const oldId = p.authorizationId;
  try {
    const re = await reauthorize(oldId, r.budgetCents);
    await commit(requestId, (x) => {
      if (x.paypal.authorizationId !== oldId) return; // someone else renewed it first
      x.paypal.authorizationId = re.authorizationId;
      x.paypal.authorizationExpires = re.expires ?? x.paypal.authorizationExpires;
      x.paypal.authorizedAt = nowIso();
      x.paypal.reauthorizations = (x.paypal.reauthorizations ?? 0) + 1;
      log(x, `PayPal hold renewed after the 3-day honor period (new authorization ${re.authorizationId}). Funds are guaranteed again.`, "money");
    });
    return re.authorizationId;
  } catch (e) {
    console.warn("[reauthorize]", (e as Error).message);
    await commit(requestId, (x) => {
      if (!x.events.some((ev) => ev.text.startsWith("Couldn't renew the PayPal hold") && ev.at > x.paypal.authorizedAt!)) log(x, `Couldn't renew the PayPal hold (${(e as Error).message.slice(0, 120)}). Capture will still be attempted.`, "warn");
    });
    return oldId;
  }
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
    // Re-check on the fresh copy: the request may have been cancelled or agreed since the pre-read above.
    if (r.status !== "open") throw new Conflict("this request is not taking offers");
    notBusy(r); // an acceptance or cancellation is mid-PayPal-call: don't change the offers under it
    demoGate(db, r, meId);
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
      if (!canServe(me, r)) throw new Forbidden(`this buyer only takes offers from ${reachShort(r).replace(" only", "")}`);
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
    demoGate(db, r, meId);
    notBusy(r); // the offer may be the one being captured right now
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
  if (!c.r.sample && !c.r.paypal.authorizationId) throw new Conflict("no PayPal hold on this request");

  const version = o.version;
  const priceCents = o.terms.priceCents;
  const offerKey = `${o.id}-v${version}`;
  const feeBps = feeBpsFor(c.db.parties.find((p) => p.id === t.sellerId));
  const fees = feeBreakdown(priceCents, feeBps);

  // Everything above ran on a snapshot. This runs on the fresh copy, both when claiming and when recording.
  // `recording`: an offer that merely ran out its clock while PayPal was capturing still counts, the buyer accepted it in time.
  const stillOpen = (r: WantRequest, recording = false) => {
    if (r.status !== "open" || r.paypal.captureId) throw new Conflict("this request is not open");
    const thread = r.threads.find((x) => x.id === t.id);
    const offer = thread?.offers.find((x) => x.id === o.id);
    if (!thread || !offer) throw new NotFound("offer not found");
    if (!(offer.status === "open" || (recording && offer.status === "expired")) || offer.id !== thread.offers.at(-1)?.id || offer.version !== version)
      throw new Conflict("That offer changed or expired. Review the latest version before accepting.");
    return { thread, offer };
  };

  // 1. Claim: only one acceptance (and no cancellation) can be in flight; a second one is refused before it reaches PayPal.
  const claimed = await commit(requestId, (r) => {
    stillOpen(r);
    return { token: claim(r, "capture", offerKey), authorizationId: r.paypal.authorizationId };
  });

  // 2. Capture. The key names this offer id + version: a retry dedups at PayPal, another offer can't reuse this capture.
  let captureId = "SIMULATED";
  let captureStatus = "COMPLETED";
  if (!c.r.sample) {
    try {
      const authId = (await freshHold(requestId)) ?? claimed.authorizationId!;
      const cap = await captureAuthorization(authId, priceCents, c.r.id, offerKey);
      captureId = cap.captureId;
      captureStatus = cap.status;
    } catch (e) {
      await unclaim(requestId, claimed.token);
      throw e;
    }
  }

  // 3. Record, re-checking everything once more.
  let x;
  try {
    x = await commit(requestId, (r, db) => {
      const { thread, offer } = stillOpen(r, true);
      if (r.paypal.inflight?.token !== claimed.token) throw new Conflict("this acceptance timed out and was taken over; reload the deal");
      delete r.paypal.inflight;
      offer.status = "accepted";
      for (const other of r.threads) for (const y of other.offers) if (y.status === "open") y.status = "rejected";
      const now = nowIso();
      const termsHash = sha256(canonical({ request: r.id, seller: thread.sellerId, buyer: r.buyerId, version: offer.version, terms: offer.terms }));
      r.agreement = { threadId: thread.id, offerId: offer.id, version: offer.version, terms: offer.terms, termsHash, buyerSignedAt: now, sellerSignedAt: now, createdAt: now };
      r.paypal.captureId = captureId;
      r.paypal.capturedCents = offer.terms.priceCents;
      r.paypal.feeCents = fees.feeCents;
      r.paypal.feeBps = feeBps;
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
    });
  } catch (e) {
    // The marker is left to expire if PayPal already captured: nobody else can start a step meanwhile.
    if (captureId === "SIMULATED") await unclaim(requestId, claimed.token);
    else await flagForSupport(requestId, `PayPal captured ${usd(priceCents)} (capture ${captureId}) but the deal could not record it (${(e as Error).message.slice(0, 120)}).`);
    throw e;
  }
  await syncCaptureDetails(requestId);
  await mail(requestId, x.seller, `Deal agreed: ${x.title}`, `Your offer of ${usd(x.price)} was accepted and PayPal has captured the payment. Ship the item and mark it shipped in the deal room.`);
  await mail(requestId, x.buyer, `Agreement signed: ${x.title}`, `PayPal captured ${usd(x.price)}. The seller is paid only after you receive and inspect the item.`);
  return { status: x.status };
}

export function postMessage(requestId: string, meId: string, b: Record<string, unknown>) {
  const text = String(b.text ?? "").trim().slice(0, 2000);
  if (!text) throw new BadInput("message is empty");
  return commit(requestId, (r, db) => {
    demoGate(db, r, meId);
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
  return commit(requestId, (r, db) => {
    demoGate(db, r, meId);
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
  return commit(requestId, (r, db) => {
    demoGate(db, r, meId);
    if (r.status !== "agreed") throw new Conflict("nothing to ship");
    notBusy(r); // a cancellation refund may be in flight
    const t = winningThread(r);
    if (t.sellerId !== meId) throw new Forbidden("only the seller can mark this shipped");
    const days = r.agreement!.terms.inspectionDays;
    const ends = new Date(Date.now() + days * 24 * HOUR).toISOString();
    const carrier = (CARRIERS as readonly string[]).includes(String(b.carrier)) ? String(b.carrier) : guessCarrier(String(b.tracking ?? ""));
    r.delivery = { note: String(b.note ?? "").slice(0, 500), tracking: String(b.tracking ?? "").replace(/\s+/g, "").slice(0, 40), carrier, at: nowIso(), inspectionEndsAt: ends };
    r.status = "shipped";
    log(r, `Seller submitted delivery${r.delivery.tracking ? ` (tracking ${r.delivery.tracking})` : ""}. Buyer has ${days} day${days === 1 ? "" : "s"} to inspect; payment releases automatically after that.`);
    return { status: r.status, buyer: r.buyerId, title: r.title, days, tracking: r.delivery.tracking, carrier, orderId: r.paypal.orderId, captureId: r.paypal.captureId, sample: r.sample };
  }).then(async (x) => {
    // Push tracking to PayPal: shows in the buyer's PayPal activity and backs seller protection.
    if (!x.sample && x.tracking && x.orderId && x.captureId) {
      try {
        const t = await addTracking(x.orderId, x.captureId, x.tracking, x.carrier as Carrier, x.carrier === "OTHER" ? "Other" : undefined);
        await commit(requestId, (r) => {
          if (r.delivery) r.delivery.paypalTracker = t.trackerId;
          log(r, `Tracking ${x.carrier} ${x.tracking} added to the PayPal order (${t.status}). PayPal shows it to the buyer.`, "money");
        });
      } catch (e) {
        console.warn("[tracking]", (e as Error).message);
        await commit(requestId, (r) => log(r, `Couldn't add tracking to PayPal (${(e as Error).message.slice(0, 120)}). It is still saved here.`, "warn"));
      }
    }
    await mail(requestId, x.buyer, `Shipped: ${x.title}`, `The seller marked your item shipped${x.tracking ? ` (tracking ${x.tracking})` : ""}. You have ${x.days} days after it arrives to accept it or open a dispute.`);
    return { status: x.status };
  });
}

/** attempt 0 is the first payout (key payout-<req>); retry n sends key payout-<req>-<n>, persisted by retryPayout before it calls this. */
async function payOut(requestId: string, payoutCents: number, why: string, attempt = 0) {
  const db = await read();
  const r = getRequest(db, requestId);
  const t = winningThread(r);
  const seller = db.parties.find((p) => p.id === t.sellerId)!;
  let batch = "SIMULATED";
  let status = "SUCCESS";
  const venmo = seller.payout?.method === "venmo" ? seller.payout.venmo : undefined;
  let to = venmo ? `Venmo ${venmo}` : seller.paypal ? `PayPal (connected account)` : `PayPal ${seller.paypalEmail}`;
  if (!r.sample && payoutCents > 0) {
    const key = attempt ? `payout-${r.id}-${attempt}` : `payout-${r.id}`;
    const base = { email: seller.paypalEmail, payerId: seller.paypal?.payerId, cents: payoutCents, note: `Clinch: "${r.title}". ${why}` };
    let out;
    try {
      out = await payoutSeller({ ...base, batchKey: key, venmo });
    } catch (e) {
      // PayPal's sandbox rejects every Venmo payout ("Recipient wallet not supported in sandbox"); live Venmo works.
      if (!venmo || !/not supported in sandbox/i.test((e as Error).message + JSON.stringify((e as { details?: unknown }).details ?? ""))) throw e;
      if (!seller.paypal && !seller.paypalEmail) throw e;
      out = await payoutSeller({ ...base, batchKey: `${key}-pp` });
      to = `${seller.paypal ? "PayPal (connected account)" : `PayPal ${seller.paypalEmail}`} (sandbox can't pay Venmo; live payouts go to Venmo ${venmo})`;
    }
    batch = out.payoutBatchId;
    status = out.status;
  }
  return { batch, status, seller, to };
}

const PAYOUT_PROBLEM = new Set(["FAILED", "UNCLAIMED", "RETURNED", "BLOCKED", "REFUNDED", "REVERSED", "DENIED"]);
const PAYOUT_FINAL = new Set(["SUCCESS", ...PAYOUT_PROBLEM]);
const PAYOUT_HELP: Record<string, string> = {
  UNCLAIMED: "the receiving PayPal/Venmo account doesn't exist yet or isn't confirmed. Fix it in Settings and retry, or claim it within 30 days.",
  FAILED: "PayPal couldn't deliver it. Check the payout account in Settings and retry.",
  RETURNED: "the money came back unclaimed. Check the payout account in Settings and retry.",
  BLOCKED: "PayPal blocked it for review. Contact Clinch support.",
  DENIED: "PayPal denied it. Contact Clinch support.",
  REFUNDED: "it was refunded to Clinch. Retry from the deal room.",
  REVERSED: "it was reversed. Contact Clinch support.",
};

/** Record a payout item status (from a webhook or a status check) and alert people when it needs action. */
export async function applyPayoutStatus(requestId: string, status: string, itemId?: string, error?: string) {
  const out = await commit(requestId, (r) => {
    r.paypal.payoutCheckedAt = nowIso();
    if (itemId) r.paypal.payoutItemId = itemId;
    if (r.paypal.payoutStatus === status) return null;
    r.paypal.payoutStatus = status;
    const seller = winningThread(r).sellerId;
    if (status === "SUCCESS") log(r, `PayPal confirmed the payout reached the seller (item ${itemId ?? r.paypal.payoutItemId ?? "?"}).`, "money");
    else if (PAYOUT_PROBLEM.has(status)) log(r, `Payout ${status.toLowerCase()}: ${PAYOUT_HELP[status] ?? ""}${error ? ` (${error})` : ""}`, "warn");
    else log(r, `Payout status: ${status}.`, "money");
    return { seller, title: r.title, problem: PAYOUT_PROBLEM.has(status) };
  });
  if (out?.problem) {
    await mail(requestId, out.seller, `Action needed: payout ${status.toLowerCase()} for "${out.title}"`, `Your Clinch payout is ${status.toLowerCase()}: ${PAYOUT_HELP[status] ?? ""} Open the deal room to retry.`);
    adminAlert(`Payout ${status}: ${out.title}`, { Request: requestId, Status: status, Error: error }, `${siteUrl()}/r/${requestId}`);
  }
}

/** Ask PayPal for the payout status (works even without webhooks). Throttled to once every 2 minutes. */
async function syncPayout(requestId: string) {
  const r = getRequest(await read(), requestId);
  const p = r.paypal;
  if (r.sample || !p.payoutBatchId || p.payoutBatchId === "SIMULATED" || (p.payoutStatus && PAYOUT_FINAL.has(p.payoutStatus))) return;
  if (p.payoutCheckedAt && Date.now() - Date.parse(p.payoutCheckedAt) < 2 * 60_000) return;
  try {
    const st = await getPayout(p.payoutBatchId);
    await applyPayoutStatus(requestId, st.status, st.itemId, st.error);
  } catch (e) {
    console.warn("[payout-sync]", (e as Error).message);
  }
}

/** Seller fixed their payout account: send the payout again (taking back an unclaimed one first). */
export async function retryPayout(requestId: string, meId: string) {
  const retryable = (x: WantRequest) => {
    if (x.status !== "completed" || !x.paypal.payoutCents) throw new Conflict("nothing to pay out");
    if (winningThread(x).sellerId !== meId && x.buyerId !== meId) throw new Forbidden("not your deal");
    const st = x.paypal.payoutStatus ?? "";
    if (!PAYOUT_PROBLEM.has(st) || ["BLOCKED", "DENIED", "REVERSED"].includes(st)) throw new Conflict(st === "SUCCESS" ? "the payout already arrived" : "this payout can't be retried here; contact support");
    return st;
  };
  const db0 = await read();
  const r0 = getRequest(db0, requestId);
  demoGate(db0, r0, meId);
  retryable(r0);
  // The attempt number is persisted BEFORE PayPal is called, so every retry key is distinct (payout-<req>-1, -2, ...)
  // and never equals the original payout-<req>, even if the process dies right after PayPal answered.
  const claimed = await commit(requestId, (x) => {
    const st = retryable(x);
    const token = claim(x, "payout", "retry");
    x.paypal.payoutAttempts = (x.paypal.payoutAttempts ?? 0) + 1;
    return { token, st, attempt: x.paypal.payoutAttempts, itemId: x.paypal.payoutItemId, cents: x.paypal.payoutCents!, price: x.paypal.capturedCents ?? 0, fee: x.paypal.feeCents ?? 0 };
  });
  let paid;
  try {
    if (claimed.st === "UNCLAIMED" && claimed.itemId) await cancelUnclaimedPayout(claimed.itemId);
    paid = await payOut(requestId, claimed.cents, `Payout retry. Price ${usd(claimed.price)} minus platform fee ${usd(claimed.fee)}.`, claimed.attempt);
  } catch (e) {
    await unclaim(requestId, claimed.token);
    throw e;
  }
  const { batch, status, to } = paid;
  return commit(requestId, (x) => {
    if (x.paypal.inflight?.token === claimed.token) delete x.paypal.inflight;
    x.paypal.payoutBatchId = batch;
    x.paypal.payoutStatus = undefined;
    x.paypal.payoutItemId = undefined;
    x.paypal.payoutCheckedAt = undefined;
    x.paypal.payoutTo = to;
    log(x, `Payout sent again to ${to} (attempt ${claimed.attempt}, batch ${batch}, ${status}).`, "money");
    return { status: x.status };
  });
}

export async function release(requestId: string, meId: string | null) {
  const c = meId ? await load(requestId, meId) : null;
  const r = c?.r ?? getRequest(await read(), requestId);
  if (c) mustBuyer(c);
  // Checked on the snapshot for a fast answer, and again on the fresh copy when the payout is claimed.
  const releasable = (x: WantRequest) => {
    if (x.status !== "shipped") throw new Conflict("nothing to release");
    if (hasOpenPayPalDispute(x)) throw new Conflict("a PayPal dispute is open; the payout waits until PayPal resolves it");
    if (x.paypal.payoutBatchId) throw new Conflict("the payout was already sent");
    if (!meId && x.delivery!.inspectionEndsAt > nowIso()) throw new Conflict("inspection window still running");
  };
  releasable(r);
  const token = await commit(requestId, (x) => {
    releasable(x);
    return claim(x, "payout", "release");
  });
  const payout = r.paypal.payoutCents!;
  let paid;
  try {
    paid = await payOut(requestId, payout, `Price ${usd(r.paypal.capturedCents!)} minus platform fee ${usd(r.paypal.feeCents!)}.`);
  } catch (e) {
    await unclaim(requestId, token);
    throw e;
  }
  const { batch, status, seller, to } = paid;
  const out = await commit(requestId, (x) => {
    if (x.paypal.inflight?.token === token) delete x.paypal.inflight;
    x.paypal.payoutTo = to;
    x.paypal.payoutBatchId = batch;
    // PayPal has paid. If a dispute opened while it was in flight, do not rewrite the deal's state: record the payout and flag it.
    if (x.status !== "shipped" || hasOpenPayPalDispute(x)) {
      log(x, `Payout sent while the deal was ${x.status}${hasOpenPayPalDispute(x) ? " with a PayPal dispute open" : ""}: PayPal Payouts sent ${usd(payout)} to ${seller.name} via ${to} (batch ${batch}, ${status}). The deal was NOT marked completed. Support review needed.`, "warn");
      return { status: x.status, completed: false };
    }
    x.status = "completed";
    log(x, meId ? "Buyer accepted the delivery." : "Inspection window ended with no dispute: auto-accepted.");
    log(x, `PayPal Payouts sent ${usd(payout)} to ${seller.name} via ${to} (batch ${batch}, ${status})${x.sample ? " (simulated)" : ""}; platform fee ${usd(x.paypal.feeCents!)}.`, "money");
    return { status: x.status, completed: true };
  });
  if (!out.completed) {
    adminAlert(`Payout sent while dispute opened - support review: ${r.title}`, { Request: requestId, Batch: batch, Status: out.status }, `${siteUrl()}/r/${requestId}`);
    return { status: out.status };
  }
  await mail(requestId, seller.id, `You've been paid: ${r.title}`, `PayPal Payouts sent ${usd(payout)} to your ${to}. Leave a review for the buyer in the deal room.`);
  return { status: out.status };
}

/** tick moves money (auto-release, hold renewal): only someone in this deal may ask for it. Guests and strangers get 403. */
export async function assertParticipant(requestId: string, meId: string) {
  const db = await read();
  if (!db.parties.some((p) => p.id === meId)) throw new Forbidden("Sign in to do this");
  const r = getRequest(db, requestId);
  demoGate(db, r, meId);
  if (r.buyerId !== meId && !r.threads.some((t) => t.sellerId === meId)) throw new Forbidden("not your deal");
}

/** Auto-release when the inspection window has passed. Safe to call repeatedly. */
const PROTECTION_TEXT: Record<string, string> = {
  ELIGIBLE: "eligible",
  PARTIALLY_ELIGIBLE: "partially eligible",
  NOT_ELIGIBLE: "not eligible",
};

/** Read Seller Protection + PayPal's fee/net for the capture once and keep it on the deal. Best effort: never throws. */
async function syncCaptureDetails(requestId: string) {
  try {
    const r = getRequest(await read(), requestId);
    const cap = r.paypal.captureId;
    if (r.sample || !cap || cap === "SIMULATED" || r.paypal.protection) return;
    const d = await captureDetails(cap);
    await commit(requestId, (x) => {
      if (x.paypal.protection || x.paypal.captureId !== cap) return;
      x.paypal.protection = { ...d, checkedAt: nowIso() };
      const fee = d.paypalFeeCents !== undefined ? `; PayPal fee ${usd(d.paypalFeeCents)}, net ${usd(d.netCents ?? 0)}` : "";
      log(x, `PayPal Seller Protection: ${PROTECTION_TEXT[d.status] ?? d.status.toLowerCase()}${d.categories.length ? ` (${d.categories.join(", ").toLowerCase().replace(/_/g, " ")})` : ""}${fee}.`, "money");
    });
  } catch (e) {
    console.warn("[capture-details]", (e as Error).message);
  }
}

export async function tick(requestId: string) {
  let r = getRequest(await read(), requestId);
  // Check PayPal first: a dispute opened there must stop the automatic payout.
  if (["agreed", "shipped", "disputed", "completed"].includes(r.status)) {
    await syncCaptureDetails(requestId);
    await syncDisputes(requestId);
    r = getRequest(await read(), requestId);
  }
  if (r.status === "shipped" && r.delivery && r.delivery.inspectionEndsAt <= nowIso() && !hasOpenPayPalDispute(r)) {
    // Another tab or a webhook may be paying out right now; that is not an error for this caller.
    return release(requestId, null).catch(async (e) => {
      if (e instanceof Conflict) return { status: getRequest(await read(), requestId).status };
      throw e;
    });
  }
  if (r.status === "open") await freshHold(requestId);
  if (r.status === "completed") await syncPayout(requestId);
  return { status: r.status };
}

export function openDispute(requestId: string, meId: string, b: Record<string, unknown>) {
  return commit(requestId, (r, db) => {
    demoGate(db, r, meId);
    if (r.buyerId !== meId) throw new Forbidden("only the buyer can open a dispute");
    if (r.status !== "shipped") throw new Conflict("disputes open during the inspection window");
    notBusy(r); // a payout may already be on its way
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
  return commit(requestId, (r, db) => {
    demoGate(db, r, meId);
    if (r.status !== "disputed" || !r.dispute) throw new Conflict("no open dispute");
    if (winningThread(r).sellerId !== meId) throw new Forbidden("only the seller can propose a settlement");
    notBusy(r); // the buyer may be accepting the current proposal right now
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
  // Checked on the snapshot for a fast answer, and again on the fresh copy when the settlement is claimed.
  const settleable = (x: WantRequest) => {
    if (x.status !== "disputed" || !x.dispute?.proposal) throw new Conflict("no settlement to accept");
    if (hasOpenPayPalDispute(x)) throw new Conflict("A PayPal dispute is open on this payment. It has to be resolved in PayPal first.");
    if (x.paypal.payoutBatchId) throw new Conflict("A payout was already sent for this deal. Contact Clinch support.");
    if (x.dispute.proposal.refundCents > x.paypal.capturedCents!) throw new Conflict("The refund can't exceed what the buyer paid.");
    return { refundCents: x.dispute.proposal.refundCents, paid: x.paypal.capturedCents!, feeBps: x.paypal.feeBps, captureId: x.paypal.captureId, title: x.title };
  };
  settleable(c.r);
  const claimed = await commit(requestId, (x) => ({ ...settleable(x), token: claim(x, "settle", "settlement") }));
  const { refundCents, paid } = claimed;
  const fees = feeBreakdown(paid - refundCents, claimed.feeBps);
  let refundId = "SIMULATED";
  let refundStatus = "COMPLETED";
  let pay;
  try {
    if (refundCents > 0 && !c.r.sample) {
      const ref = await refundCapture(claimed.captureId!, `Clinch dispute settlement: ${claimed.title}`, refundCents === paid ? undefined : refundCents);
      refundId = ref.refundId;
      refundStatus = ref.status;
    }
    pay = await payOut(requestId, fees.payoutCents, `Settled dispute: price ${usd(paid)}, refunded ${usd(refundCents)}, fee ${usd(fees.feeCents)}.`);
  } catch (e) {
    // Same refund/payout keys on the next try: PayPal dedups whichever half already went through.
    await unclaim(requestId, claimed.token);
    throw e;
  }
  const { batch, status, seller, to } = pay;
  try {
    return await commit(requestId, (x) => {
      if (x.status !== "disputed" || x.paypal.inflight?.token !== claimed.token) throw new Conflict("this settlement timed out and was taken over; reload the deal");
      delete x.paypal.inflight;
      if (refundCents > 0 && !x.paypal.refunds.some((f) => f.id === refundId)) x.paypal.refunds.push({ id: refundId, cents: refundCents, status: refundStatus });
      x.paypal.payoutCents = fees.payoutCents;
      x.paypal.feeCents = fees.feeCents;
      x.paypal.payoutBatchId = fees.payoutCents > 0 ? batch : undefined;
      x.dispute!.resolution = { refundCents, payoutCents: fees.payoutCents, at: nowIso(), how: "agreed" };
      x.status = fees.payoutCents > 0 ? "completed" : "cancelled";
      log(x, `Dispute settled by agreement.`);
      if (refundCents > 0) log(x, `PayPal refunded ${usd(refundCents)} to the buyer (refund ${refundId}, ${refundStatus})${x.sample ? " (simulated)" : ""}.`, "money");
      if (fees.payoutCents > 0) x.paypal.payoutTo = to;
      if (fees.payoutCents > 0) log(x, `PayPal Payouts sent ${usd(fees.payoutCents)} to ${seller.name} via ${to} (batch ${batch}, ${status})${x.sample ? " (simulated)" : ""}.`, "money");
      return { status: x.status };
    });
  } catch (e) {
    if (c.r.sample) await unclaim(requestId, claimed.token);
    else await flagForSupport(requestId, `PayPal refunded ${usd(refundCents)} and sent ${usd(fees.payoutCents)} (batch ${batch}) for the settlement but the deal could not record it (${(e as Error).message.slice(0, 120)}).`);
    throw e;
  }
}

export async function cancel(requestId: string, meId: string) {
  const c = await load(requestId, meId);
  mustBuyer(c);
  const r = c.r;
  if (r.status === "draft") {
    return commit(requestId, (x) => {
      if (x.status !== "draft") throw new Conflict("this request is no longer a draft");
      x.status = "cancelled";
      log(x, "Cancelled before the budget was held.");
      return { status: x.status };
    });
  }
  if (r.status === "open") {
    // Claim first: an acceptance mid-capture blocks this (and vice versa), so a deal can't be both cancelled and agreed.
    const claimed = await commit(requestId, (x) => {
      if (x.status !== "open") throw new Conflict("this request is no longer open");
      return { token: claim(x, "void", "hold"), authorizationId: x.paypal.authorizationId };
    });
    try {
      if (!r.sample && claimed.authorizationId) await voidAuthorization(claimed.authorizationId);
    } catch (e) {
      await unclaim(requestId, claimed.token);
      throw e;
    }
    try {
      return await commit(requestId, (x) => {
        if (x.status !== "open" || x.paypal.inflight?.token !== claimed.token) throw new Conflict("this cancellation timed out and was taken over; reload the deal");
        delete x.paypal.inflight;
        x.status = "cancelled";
        for (const t of x.threads) for (const o of t.offers) if (o.status === "open") o.status = "rejected";
        log(x, `Request cancelled. PayPal hold voided${x.sample ? " (simulated)" : ""}; the buyer was never charged.`, "money");
        return { status: x.status };
      });
    } catch (e) {
      if (r.sample) await unclaim(requestId, claimed.token);
      else await flagForSupport(requestId, `The PayPal hold was voided but the request could not be marked cancelled (${(e as Error).message.slice(0, 120)}).`);
      throw e;
    }
  }
  if (r.status === "agreed") {
    const claimed = await commit(requestId, (x) => {
      if (x.status !== "agreed") throw new Conflict("this deal is no longer waiting to ship");
      return { token: claim(x, "refund", "cancel"), captureId: x.paypal.captureId };
    });
    let ref;
    try {
      ref = r.sample ? { refundId: "SIMULATED", status: "COMPLETED" } : await refundCapture(claimed.captureId!, `Clinch refund: ${r.title}`);
    } catch (e) {
      await unclaim(requestId, claimed.token);
      throw e;
    }
    try {
      return await commit(requestId, (x) => {
        if (x.status !== "agreed" || x.paypal.inflight?.token !== claimed.token) throw new Conflict("this cancellation timed out and was taken over; reload the deal");
        delete x.paypal.inflight;
        if (!x.paypal.refunds.some((f) => f.id === ref.refundId)) x.paypal.refunds.push({ id: ref.refundId, cents: x.paypal.capturedCents!, status: ref.status });
        x.status = "cancelled";
        log(x, `Cancelled before shipping. PayPal refunded ${usd(x.paypal.capturedCents!)} in full (refund ${ref.refundId}, ${ref.status})${x.sample ? " (simulated)" : ""}.`, "money");
        return { status: x.status };
      });
    } catch (e) {
      if (r.sample) await unclaim(requestId, claimed.token);
      else await flagForSupport(requestId, `PayPal refunded the capture in full (refund ${ref.refundId}) but the request could not be marked cancelled (${(e as Error).message.slice(0, 120)}).`);
      throw e;
    }
  }
  throw new Conflict(`can't cancel once the item has shipped; open a dispute instead`);
}

export function review(requestId: string, meId: string, b: Record<string, unknown>) {
  return commit(requestId, (r, db) => {
    demoGate(db, r, meId);
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

/** Best guess from the number's shape; the seller can also pick the carrier. */
export function guessCarrier(tracking: string): string {
  const t = tracking.replace(/\s+/g, "").toUpperCase();
  if (/^1Z[0-9A-Z]{16}$/.test(t)) return "UPS";
  if (/^(94|93|92|95)\d{18,20}$/.test(t) || /^[A-Z]{2}\d{9}US$/.test(t)) return "USPS";
  if (/^\d{12}$|^\d{15}$/.test(t)) return "FEDEX";
  if (/^\d{10}$/.test(t)) return "DHL";
  return "OTHER";
}

// ---------- Disputes opened inside PayPal ----------

const REASON: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "item not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "item not as described",
  UNAUTHORISED: "unauthorized payment",
  CREDIT_NOT_PROCESSED: "refund not processed",
  DUPLICATE_TRANSACTION: "duplicate payment",
  INCORRECT_AMOUNT: "incorrect amount",
};
export const disputeReason = (r: string) => REASON[r] ?? r.toLowerCase().replace(/_/g, " ");

/** Store the latest PayPal dispute state; tell both sides and support when it opens or resolves. */
export async function applyPayPalDispute(requestId: string, d: PayPalDispute) {
  const out = await commit(requestId, (r) => {
    const prev = r.paypal.dispute;
    r.paypal.disputeCheckedAt = nowIso();
    if (prev && prev.status === d.status && prev.updatedAt === d.updatedAt) return null;
    r.paypal.dispute = { ...prev, ...d };
    const what = `PayPal dispute ${d.id} (${disputeReason(d.reason)}, ${usd(d.amountCents)}, ${d.stage.toLowerCase()})`;
    // No payout reserve (owner decision): a dispute that arrives after the seller was paid is only flagged for support.
    const afterPayout = !prev && (r.status === "completed" || !!r.paypal.payoutBatchId);
    if (!prev) log(r, `Buyer opened ${what} in PayPal. Seller payout is paused until it's resolved.`, "warn");
    else if (d.status === "RESOLVED") log(r, `${what} resolved${d.outcome ? `: ${d.outcome.toLowerCase().replace(/_/g, " ")}` : ""}.`, "money");
    else log(r, `${what} is now ${d.status.toLowerCase().replace(/_/g, " ")}.`, "warn");
    if (afterPayout) log(r, "PayPal dispute opened after payout - support review", "money");
    return { opened: !prev, afterPayout, resolved: d.status === "RESOLVED" && prev?.status !== "RESOLVED", buyer: r.buyerId, seller: r.agreement ? winningThread(r).sellerId : undefined, title: r.title };
  });
  if (!out || (!out.opened && !out.resolved)) return;
  const subject = out.opened ? `PayPal dispute opened: ${out.title}` : `PayPal dispute resolved: ${out.title}`;
  const text = out.opened
    ? `A PayPal dispute was opened (${disputeReason(d.reason)}, ${usd(d.amountCents)}). The seller payout is paused. Respond from the deal room${d.respondBy ? ` by ${d.respondBy.slice(0, 10)}` : ""}.`
    : `PayPal resolved the dispute${d.outcome ? ` (${d.outcome.toLowerCase().replace(/_/g, " ")})` : ""}.`;
  if (out.seller) await mail(requestId, out.seller, subject, text);
  await mail(requestId, out.buyer, subject, text);
  adminAlert(out.afterPayout ? `PayPal dispute opened after payout - support review: ${out.title}` : subject, { Request: requestId, Dispute: d.id, Reason: disputeReason(d.reason), Amount: usd(d.amountCents), Status: d.status, ...(out.afterPayout ? { Note: "The seller was already paid out; no reserve is held." } : {}) }, `${siteUrl()}/r/${requestId}`);
}

/** Look up PayPal disputes for this deal's capture (no webhook needed). Throttled to once every 5 minutes. */
async function syncDisputes(requestId: string) {
  const r = getRequest(await read(), requestId);
  const p = r.paypal;
  if (r.sample || !p.captureId || p.captureId === "SIMULATED") return;
  if (p.dispute?.status === "RESOLVED") return;
  if (p.disputeCheckedAt && Date.now() - Date.parse(p.disputeCheckedAt) < 5 * 60_000) return;
  try {
    const ids = p.dispute ? [p.dispute.id] : await disputesForCapture(p.captureId);
    if (!ids.length) return void (await commit(requestId, (x) => void (x.paypal.disputeCheckedAt = nowIso())));
    await applyPayPalDispute(requestId, await getDispute(ids[0]));
  } catch (e) {
    console.warn("[dispute-sync]", (e as Error).message);
  }
}

export const hasOpenPayPalDispute = (r: WantRequest) => !!r.paypal.dispute && r.paypal.dispute.status !== "RESOLVED";

/** Seller answers a PayPal dispute: send tracking/proof, or accept the claim (PayPal refunds the buyer). */
export async function respondPayPalDispute(requestId: string, meId: string, b: Record<string, unknown>) {
  const db0 = await read();
  const r = getRequest(db0, requestId);
  demoGate(db0, r, meId);
  const d = r.paypal.dispute;
  if (!d || d.status === "RESOLVED") throw new Conflict("no open PayPal dispute");
  if (!r.agreement || winningThread(r).sellerId !== meId) throw new Forbidden("only the seller can answer the PayPal dispute");
  const note = String(b.note ?? "").trim().slice(0, 2000);
  if (b.choice === "accept") {
    await acceptDisputeClaim(d.id, note || "Seller accepts the claim and agrees to refund the buyer.");
    await commit(requestId, (x) => {
      x.paypal.dispute!.acceptedAt = nowIso();
      log(x, `Seller accepted the PayPal claim. PayPal refunds the buyer ${usd(d.amountCents)}.`, "money");
    });
  } else {
    if (note.length < 10) throw new BadInput("Explain what happened (at least a sentence)");
    const tracking = r.delivery?.tracking ? { carrier: r.delivery.carrier && r.delivery.carrier !== "OTHER" ? r.delivery.carrier : "OTHER", number: r.delivery.tracking } : undefined;
    await provideDisputeEvidence(d.id, note, tracking);
    await commit(requestId, (x) => {
      x.paypal.dispute!.evidenceSentAt = nowIso();
      log(x, `Seller sent PayPal ${tracking ? `proof of shipment (${tracking.carrier} ${tracking.number}) and ` : ""}a statement for dispute ${d.id}.`, "money");
    });
  }
  await commit(requestId, (x) => void (x.paypal.disputeCheckedAt = undefined)); // re-check soon
  return { status: r.status };
}
