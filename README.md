# WantBoard

**Post what you need. PayPal holds your budget. Sellers compete. Everyone gets paid fairly.**

WantBoard is a reverse marketplace for hard-to-find items: rare materials, discontinued spare
parts, collectibles, one-off components. Instead of searching, the buyer posts a request with a
category, a needed-by date, a maximum price and their preferences. Sellers in that category bid.
The buyer picks the best deal.

Built for the [PayPal AI Hackathon 2026](https://paypalaihackathon.devpost.com/).

## Why PayPal is the core of it

Reverse marketplaces usually fail on trust: sellers waste time quoting buyers who never pay, and
buyers are afraid to pay strangers up front. WantBoard puts PayPal in the middle of every step:

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
cp ../.env.example .env.local   # fill in PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET (sandbox)
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

Next.js 15 (App Router, TypeScript, Tailwind), PayPal REST APIs (sandbox), PayPal JS SDK via
`@paypal/react-paypal-js`.

## Licence

[MIT](LICENSE)
