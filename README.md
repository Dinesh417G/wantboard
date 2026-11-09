# Clinch

**Post what you need. PayPal holds your budget. Sellers compete. Everyone gets paid fairly.**

Clinch is a reverse marketplace for hard-to-find items: rare materials, discontinued spare
parts, collectibles, one-off components. Instead of searching, the buyer posts a request with a
category, a needed-by date, a maximum price and their preferences. Sellers in that category bid.
The buyer picks the best deal.

Built for the [PayPal AI Hackathon 2026](https://paypalaihackathon.devpost.com/).

## What's inside

- **Live board**: buyers post a need (item, category, needed-by date, max price, preferences); AI suggests the category.
- **Deal room**: sellers send versioned offers (price, delivery, warranty, condition, shipping, inspection days). Every counter
  shows a diff ("Price −4.5%, delivery +3 days"), offers expire for real, and "Accept" names the exact version, so stale offers are refused.
- **Private limits**: buyer target / seller floor, visible only to their owner and their own copilot.
- **AI copilot** (Vercel AI Gateway, Claude): summarize, suggest a counter inside your private limit, risk-check the latest offer.
  Drafts only; it never sends, accepts or pays. Falls back to labelled heuristics if the gateway is unavailable.
- **Agreement fingerprint**: the accepted terms are hashed (SHA-256 of canonical JSON) and shown to both sides.
- **Inspection window, disputes, settlements**: payment freezes on dispute; seller proposes a partial refund; buyer accepts.
- **Scam shield**: flags Zelle/Venmo/gift cards, phone numbers and "pay me directly" in chat.
- **Trust profile**: transparent score from paid, completed deals; double-blind reviews.
- **Demo identities**: switch between the buyer and sellers from the header. Seeded "sample" deals simulate PayPal steps and say so;
  requests you create use the real PayPal sandbox.

## For judges: try it in 3 minutes

Live demo: **https://clinchdeal.in** (PayPal sandbox; no real money moves).

1. You start as **Maya Chen** (buyer). Use the switcher in the top-right corner to become any buyer or seller.
2. **Post a need** with photos, then click the PayPal button and log in with the sandbox buyer below.
   PayPal *authorizes* (holds) the max price.
3. The **copilot matches sellers** and invites them. Switch to a matched seller, open **Dashboard**, and send an offer.
4. Switch back to Maya: compare versions, try **Copilot → Suggest counter**, counter, then **Accept & sign**.
   PayPal captures only the winning price; the rest of the hold is released.
5. Switch to the seller: **Mark shipped**. Switch to Maya: **Accept & pay seller** → PayPal Payouts.
6. Every PayPal ID (authorization, capture, refund, payout batch) is listed in the **Money trail**.

Sandbox buyer login (PayPal sandbox personal account, USD):

| Email | Password |
|---|---|
| `sb-z2cop53757889@personal.example.com` | _provided in the Devpost submission_ |

The board also has **sample deals** (marked "sample · simulated") to explore negotiation, disputes and reviews
without PayPal; their PayPal steps are simulated and labelled as such.

## Why PayPal is the core of it

Reverse marketplaces usually fail on trust: sellers waste time quoting buyers who never pay, and
buyers are afraid to pay strangers up front. Clinch puts PayPal in the middle of every step:

| Step | PayPal API | What happens |
|---|---|---|
| Buyer posts a request | Orders v2, `intent: AUTHORIZE` | The max price is **held**, not charged (PayPal balance, card or **Pay Later**). Sellers see "funds held by PayPal". |
| Buyer accepts a bid | Authorizations `capture` with `final_capture` | Only the **winning price** is taken; the rest of the hold is released. |
| Buyer confirms delivery | Payouts v1 | The seller is paid by email, minus the 6% platform fee. |
| Buyer cancels an open request | Authorizations `void` | The hold is released; the buyer is never charged. |
| Buyer cancels before shipping | Captures `refund` | Full refund. |
| Any change | Webhooks | Payment events are verified and added to the request's money trail. |

## Run it locally

Requirements: Node.js 20+, a PayPal Developer account (free sandbox).

```bash
cd web
cp ../.env.example .env.local   # PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET (sandbox); everything else is optional
npm install
npm run dev                     # http://localhost:3000
```

1. **Sellers** page: register a seller with a sandbox PayPal email and a category.
2. **Post a request** in that category, then secure the budget with the PayPal button and log in
   with a sandbox **personal** account.
3. On the request page, switch to **View as seller** and place bids; switch back to **View as
   buyer** and accept one.
4. Mark it shipped (seller), confirm delivery (buyer), and watch the money trail.

Sandbox test accounts for judges are listed in the Devpost submission.

## Stack

Next.js 15 (App Router, TypeScript, Tailwind v4, Motion), PayPal REST APIs (Orders v2, Authorizations, Captures,
Refunds, Payouts, Webhooks) and the PayPal JS SDK (`@paypal/react-paypal-js`, Pay Later enabled), Supabase Postgres
(state behind secret-gated RPCs), Vercel Blob (photos), Google Gemini or Vercel AI Gateway (copilot and matchmaker).

## Licence

[MIT](LICENSE)
