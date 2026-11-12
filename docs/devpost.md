# Devpost submission: Clinch

Paste each block into the matching Devpost field. `[PASSWORD]` and `[VIDEO]` are for the owner to fill in.

---

## Project name

Clinch

## Elevator pitch (200 characters max)

Post what you need. PayPal holds your max price, AI invites the right sellers, they compete, and you pay only the winning price. The seller is paid after you inspect it.

---

## About the project

Clinch is a reverse marketplace for things you can't just search for: a discontinued spare part, a rare material, a one-off component. The buyer posts what they need and the most they'll pay. PayPal holds that amount, an AI matchmaker invites sellers who can supply it, and the sellers compete in a deal room. The buyer pays only the winning price, and the seller is paid only after the buyer has inspected the item.

Reverse marketplaces usually fail on trust. Sellers won't quote buyers who might never pay, and buyers won't pay strangers up front. So PayPal sits under every step, not just checkout. Posting a request creates an Orders v2 order with intent AUTHORIZE. The max price is held, not charged, from a PayPal balance, a card, Venmo or Pay Later, and sellers see "funds held by PayPal" before they quote. Accepting an offer captures only the winning price with `final_capture`, and PayPal releases the rest of the hold. Shipping adds the carrier and tracking number to the PayPal order. When the buyer confirms delivery, or the inspection window runs out, Payouts pays the seller minus a 6% fee. Sellers on Clinch Pro, a $9.99/month PayPal Subscriptions plan, pay 3%. Cancelling voids the hold or refunds the capture, and holds older than PayPal's 3-day honor period are reauthorized. A PayPal dispute or a reversed capture pauses the payout. From the deal room the seller can send evidence, accept the claim or offer a partial refund through the Disputes API. After capture the deal room reads the capture back and shows its Seller Protection status and the exact split: what the buyer paid, the PayPal fee, the Clinch fee and the seller's payout. Sign-in is Log in with PayPal, or a 6-digit email code, and a verified PayPal identity counts toward a seller's trust score. Every PayPal ID goes into the deal's money trail. Clinch subscribes to 27 webhook event types and verifies every signature against the raw request body.

The AI works inside the negotiation. Offers are versioned, and every counter shows a diff ("Price −4.5%, delivery +3 days"). Offers really expire, and Accept names the exact version, so a stale or replaced offer is refused. Each side can set a private limit, the buyer's target or the seller's floor, that only they and their own copilot can see. The copilot runs on gpt-oss-120b on Groq. It summarizes the thread and suggests a counter inside your private limit. It only drafts: it never sends, accepts or pays. gpt-oss-20b risk-checks the latest offer, suggests a category for each request and scores sellers from 0 to 100 for the matchmaker. The Clinch Agent is built on PayPal's Agent Toolkit. Ask it whether the seller has shipped, or tell it to counter at $185 and say why. It reads the live PayPal order, tracking and disputes for that deal, then counters or sends the message for you. Its PayPal tools are read-only and pinned to that deal's order, capture and dispute IDs, whatever the model asks for. Text from the other party is fenced off as untrusted data, so a seller can't prompt-inject the buyer's agent. Accepting is a PayPal capture: the agent can prepare it, but a person has to confirm it. The numbers the AI reasons from, such as price against the hold or against your limit, are computed in code. I added that after the copilot called $210 "over" a $220 hold. If the model is unavailable, every AI feature falls back to a heuristic and labels its answer as one.

Outside the AI, a scam shield flags Zelle, gift cards, phone numbers and "pay me directly" in chat. The accepted terms get a SHA-256 fingerprint that both sides see. Reviews are double-blind, and the trust profile counts only paid, completed deals. Money is stored as integer cents everywhere.

Here is one full run on the live site, on the PayPal sandbox:

1. A request with 3 photos went up and PayPal held $220.
2. The matchmaker scored the seller 90.
3. The seller offered $210 with a photo, and the scam shield flagged a Zelle mention in chat.
4. The buyer countered at $185.
5. A $300 offer was refused for being above the hold.
6. The seller sent $195 as best-and-final. A counter on that final offer was refused, and so was an accept of a stale version.
7. The buyer accepted and PayPal captured $195, with a $5.54 PayPal fee.
8. The seller shipped and the buyer released payment.
9. The seller was paid $183.30 and the Clinch fee was $11.70.
10. Both sides left reviews.

That run found three bugs, all fixed the same day: holds paid by card didn't confirm, webhook verification always failed, and the copilot misread $210 against $220.

The sandbox can't show some of it. It rejects Venmo payouts ("Recipient wallet not supported in sandbox"), so Clinch falls back to a PayPal payout and logs that. The dispute, partial-refund and reversal paths are built on the Disputes API and the PAYMENT.CAPTURE.REVERSED webhook, but none has run end to end. Testing them needs a payment from a sandbox PayPal account that is then disputed in the Resolution Center, or a chargeback, which the sandbox can't produce. Reauthorizing after 3 days can't be fast-forwarded in the sandbox either.

Clinch runs on Next.js 15 (App Router, TypeScript, Tailwind v4) and these PayPal REST APIs:

- Orders v2: authorize, capture, void, reauthorize and tracking
- Captures and Refunds
- Payouts
- Disputes
- Subscriptions
- Webhooks
- Log in with PayPal

It also uses the PayPal JS SDK (Buttons, Venmo, Pay Later messages), `@paypal/agent-toolkit`, gpt-oss-120b and gpt-oss-20b on Groq, Supabase Postgres, Vercel Blob for photos, Resend for email and Vercel for hosting. I built it alone, from scratch, for this hackathon, starting 23 Oct 2026. The repo is public under the MIT licence.

Next:

- A payout reserve that covers PayPal's 180-day dispute window. Today a dispute filed after payout alerts support.
- A production database with real tables and row-level security instead of a single state document.
- PayPal Commerce Platform, so sellers onboard as merchants and are paid directly.
- A free trial for Clinch Pro.

To try it, go to https://clinchdeal.in/login, choose "Try a demo account", then Maya Chen (buyer), one click. Post a need and pay the hold with the sandbox buyer `sb-z2cop53757889@personal.example.com` (the password is in the judges' testing notes). Switch to a matched seller from the account menu and run the deal. The README has the step-by-step guide.

---

## Built with

next.js, react, typescript, tailwindcss, node.js, paypal, paypal-orders-api, paypal-payouts, paypal-disputes, paypal-subscriptions, paypal-webhooks, log-in-with-paypal, paypal-agent-toolkit, venmo, pay-later, groq, gpt-oss, supabase, postgresql, vercel, vercel-blob, resend

## Try it out links

- https://clinchdeal.in
- https://github.com/Dinesh417G/wantboard

## Video demo link

[VIDEO] (YouTube, public, under 3 minutes)
