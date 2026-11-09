# HaathMila — Claude Code Build Prompt

Trusted negotiation and deal-closing platform for India. Next.js 16 + Supabase.
"HaathMila" is a working name. It lives in one constant (`lib/config/site.ts`) and in `messages/*.json`, so renaming takes minutes.

---

## 0. How to use this file (for the human)

1. Create an empty folder, for example `C:\dev\haathmila`, and copy this file into it as `BUILD_PROMPT.md`.
2. Open PowerShell in that folder and start Claude Code (`claude`).
3. First message: `Read BUILD_PROMPT.md completely. Then do Phase 0 only and stop with a report.`
4. After you review each phase: `Continue with Phase N as defined in docs/SPEC.md.`
5. Keys you will be asked for, and when:
   - Phase 0: a Supabase **dev** project and a Supabase **test** project (both in region Mumbai, `ap-south-1`). You need each project's URL, publishable key and secret key.
   - Phase 4: Razorpay **test-mode** keys and webhook secret, with Route enabled on the account. Everything before that runs on the mock provider.
   - Phase 6: MSG91 (SMS, DLT templates) and Resend (email) keys. Mocks work until then.
   - Phase 7: an Anthropic API key.

---

## 1. Your role and working rules (for Claude Code)

You are the lead full-stack engineer on this product. Build it phase by phase, exactly as specified, to production quality.

**Before writing code in Phase 0, create these files and keep them current:**

- `CLAUDE.md` — the permanent rules from sections 1, 3, 17 and 23 of this file, condensed. You will read it at the start of every session.
- `docs/SPEC.md` — this whole specification, cleaned up. It is the source of truth; update it when a decision changes.
- `docs/DECISIONS.md` — one short entry per decision or deviation (date, decision, reason).
- `docs/PROGRESS.md` — phase checklist with status, open issues and next steps.
- `docs/RUNBOOKS.md` — operational procedures (added from Phase 4 onward).

**Rules for every phase:**

1. Do only the current phase. Do not start features from later phases.
2. Before integrating any external library or API (Next.js 16, `@supabase/ssr`, Supabase Auth hooks, Supabase Realtime, Razorpay Route, Anthropic SDK, next-intl, @react-pdf/renderer), check its current official documentation. If this spec conflicts with the docs, follow the docs and record the deviation in `docs/DECISIONS.md`.
3. Finish every phase by running `npm run typecheck`, `npm run lint`, `npm run test`, plus `npm run test:e2e` where the phase says so. Fix failures before reporting.
4. End every phase with a report: what was built, test results, anything skipped and why, manual steps for the human, and the exact next step. Then **stop and wait**.
5. The developer works on **Windows with PowerShell, not WSL**. Every command and script must work there. Write scripts in Node (`scripts/*.mjs`), use `npx supabase` for the CLI, and never rely on bash-only syntax.
6. Never commit secrets. `.env.local` is git-ignored; keep `.env.example` complete and commented.
7. Ask the human before: adding any paid service, changing how money is stored or computed, weakening any security or privacy rule, or changing the deal state machine.
8. Do not ask the human about choices already made in this file (UI library, state handling, folder layout and so on). Decide within the spec and log it.
9. Small, reviewable commits with conventional messages (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).

---

## 2. Product summary

HaathMila lets two parties who found each other anywhere (WhatsApp, Instagram, OLX, IndiaMART, LinkedIn, referrals) **negotiate, sign, pay safely and close a deal inside one shareable link**.

The trusted deal loop:

1. A party creates a **deal room** from a template and sends the counterparty a **deal link**.
2. The parties exchange **versioned offers** (structured term sheets). Each counter shows a diff. Offers expire.
3. When one side accepts the exact current version, the platform generates an **agreement PDF** from those terms. Both sides **sign with an OTP**.
4. The buyer **funds** each milestone. Money is held by the payment aggregator (Razorpay Route transfer **on hold**), never by HaathMila.
5. The seller submits **delivery proof**. An **inspection window** starts.
6. The buyer **accepts** (or the window passes): the hold is released and the seller is paid. Or the buyer raises a **dispute** with evidence.
7. Both sides leave **verified, double-blind reviews**, which build a portable **trust profile**.

An **AI copilot** (Claude) summarises threads, suggests counter-offers inside the user's private walk-away limit, flags risky terms and translates messages between English, Tamil and Hindi. It never sends, accepts or signs anything.

**First market:** India, INR. **First customers:** MSME orders, job work, fabrication and automation projects, freelance and agency work (₹25,000 to ₹25 lakh).

**Not in v1:** public listings or search, autonomous AI negotiation, holding funds ourselves, cash on delivery, cross-border deals, native mobile apps (ship a PWA), real-estate sale agreements.

---

## 3. Tech stack (decided)

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (latest stable 16.x), App Router, React 19, TypeScript `strict`. Server Components by default; Server Actions for mutations; Route Handlers for webhooks, cron, PDF and AI streaming. Session refresh in `proxy.ts` (Next.js 16 renamed `middleware.ts` to `proxy.ts`). Request APIs (`cookies()`, `headers()`, `params`) are async. |
| UI | Tailwind CSS v4, shadcn/ui, lucide-react icons. Fonts: Inter, Noto Sans Tamil, Noto Sans Devanagari. Mobile-first. |
| Forms and validation | React Hook Form + Zod. Every server action validates input with Zod. |
| i18n | next-intl with locales `en` (default), `ta`, `hi`. Phase 1 to 7 ship `en` and `ta`; `hi` keys are scaffolded and filled in Phase 8. |
| Database and backend | Supabase: Postgres, Auth, Row Level Security, Realtime, Storage, `pg_cron`, `pg_net`, Vault. Packages `@supabase/supabase-js` and `@supabase/ssr`. Use the **publishable** key in the browser and the **secret** key only in server-only modules. Protect pages and data with `supabase.auth.getClaims()`; never trust `getSession()` on the server. |
| Payments | Razorpay: Orders, Checkout, Route (linked accounts, transfers with `on_hold`, settlement-hold modification, reversals), refunds, webhooks. Behind a `PaymentProvider` interface with a full `MockPaymentProvider`. |
| PDF | `@react-pdf/renderer` in a Node.js route handler, fonts embedded (Noto Sans, Noto Sans Tamil, Noto Sans Devanagari). |
| AI | `@anthropic-ai/sdk`, server-side only. Models from env: `CLAUDE_MODEL_COPILOT` (default `claude-sonnet-5-5`), `CLAUDE_MODEL_FAST` (default `claude-haiku-5-5`). |
| Messaging | Adapters: SMS (MSG91, DLT templates), WhatsApp (provider-agnostic; mock first), email (Resend). All have mock implementations. |
| Testing | Vitest (unit and integration, including RLS tests against the Supabase test project), Playwright (end-to-end on mocks). |
| Hosting | Vercel with functions pinned to region `bom1` (Mumbai); Supabase in `ap-south-1` (Mumbai). |
| Observability | Structured logger helper; Sentry optional and env-gated; Vercel Analytics. |

**Dates and money:** store timestamps in UTC (`timestamptz`), display in `Asia/Kolkata`. Store money as **integer paise** (`bigint` in SQL, `number` checked with `Number.isSafeInteger` in TypeScript, or `bigint` where sums may exceed safe range). Never use floating point for money. Display with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` and optional lakh/crore wording.

**Portability:** keep deal rules in Postgres functions and pure TypeScript in `lib/domain`, with no Next.js imports there, so the core can later move behind a Rust/Axum API.

---

## 4. Repository layout

```
app/
  (marketing)/            page.tsx, how-it-works, pricing, safety, templates/[slug], help
  (legal)/legal/          terms, privacy, refunds, grievance
  (auth)/                 login, onboarding, auth/callback
  (app)/                  dashboard, deals/new, deals/[dealId]/..., settings/..., notifications
  d/[code]/               public deal-link landing (no login needed to view the summary)
  u/[handle]/             public trust profile
  admin/                  overview, kyc, disputes, payouts, deals, audit, grievances, settings
  api/
    webhooks/razorpay/route.ts
    auth/hooks/send-sms/route.ts
    cron/tick/route.ts
    agreements/[agreementId]/pdf/route.ts
    ai/[action]/route.ts
components/               ui/ (shadcn), deal-room/, forms/, layout/
lib/
  config/site.ts          APP_NAME, URLs, feature flags read from env
  supabase/               client.ts, server.ts, proxy.ts (updateSession), admin.ts ('server-only')
  domain/                 money.ts, fees.ts, offers.ts (validate + diff), states.ts, templates/, trust.ts
  providers/
    payments/             types.ts, mock.ts, razorpay.ts
    kyc/                  types.ts, mock.ts
    messaging/            sms/, whatsapp/, email/ (types + mock + real)
    esign/                types.ts, mock.ts (phase 2 real)
    ai/                   client.ts, prompts/, schemas.ts
  security/               crypto.ts (field encryption), ratelimit.ts, scam-shield.ts, otp.ts
  i18n/
messages/                 en.json, ta.json, hi.json
supabase/
  migrations/             timestamped SQL files
  seed.sql
scripts/                  seed.mjs, gen-types.mjs, verify-audit-chain.mjs
tests/                    unit/, integration/ (RLS), e2e/
docs/                     SPEC.md, DECISIONS.md, PROGRESS.md, RUNBOOKS.md
proxy.ts
CLAUDE.md
.env.example
```

Generate database types with `npx supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts` (wrap it in `scripts/gen-types.mjs`).

---

## 5. Data model (Postgres)

All tables live in `public` with RLS **enabled and deny-by-default**. Use `uuid` primary keys (`gen_random_uuid()`), `created_at timestamptz default now()`, and `updated_at` maintained by a trigger. Money columns end in `_paise` and are `bigint not null check (x >= 0)`. Use Postgres enums for statuses.

### Identity and accounts

- `profiles` — `id` (= `auth.users.id`), `full_name`, `display_name`, `handle` (unique, for `/u/[handle]`), `phone`, `email`, `avatar_path`, `preferred_locale` (`en|ta|hi`), `verification_level` smallint (0 to 3), `is_business` bool, `created_at`.
- `organizations` — `id`, `owner_id`, `legal_name`, `trade_name`, `gstin` (unique, nullable), `udyam_number`, `address` jsonb, `business_verified_at`.
- `organization_members` — `org_id`, `user_id`, `role` (`owner|admin|member`). In v1 a deal party is always a user; an organization is attached for display, invoicing and GST.
- `verifications` — `id`, `subject_type` (`user|org`), `subject_id`, `kind` (`phone|pan|bank|gstin|udyam|digilocker`), `status` (`pending|verified|failed|expired`), `provider`, `provider_ref`, `name_match_score` numeric, `verified_at`, `meta` jsonb (non-sensitive only).
- `sensitive_identifiers` — `subject_type`, `subject_id`, `kind` (`pan|bank_account`), `ciphertext`, `iv`, `auth_tag`, `last4`, `lookup_hmac` (HMAC for uniqueness checks). **Never** store Aadhaar numbers anywhere. No client access; read only through server-only code.
- `payout_accounts` — `id`, `user_id`, `provider` (`mock|razorpay`), `provider_account_id` (Razorpay linked account id), `status` (`pending|active|suspended`), `bank_last4`, `ifsc`, `activated_at`.
- `app_admins` — `user_id`. Helper `is_admin()`.

### Deals and negotiation

- `deal_templates` — `key` (`goods_order|project_milestones|freelance_service`), `version`, `name` jsonb (per locale), `terms_schema` jsonb (JSON Schema mirrored by Zod in `lib/domain/templates`), `default_inspection_days`, `active`.
- `deals` — `id`, `public_code` (8-char unique base32, e.g. `HM7K3Q9D`), `template_key`, `title`, `description`, `currency` (`INR`), `status` (enum below), `buyer_id`, `seller_id` (one side may be null until the invite is accepted), `buyer_org_id`, `seller_org_id`, `created_by`, `current_offer_id`, `agreed_offer_id`, `agreement_id`, `inspection_days`, `fee_payer` (`buyer|seller|split`), `show_preview_publicly` bool (default false), `cancelled_reason`, `closed_at`.
- `deal_invites` — `id`, `deal_id`, `token_hash` (SHA-256 of a 32-byte random token; never store the token), `invited_phone`, `invited_email`, `role` (`buyer|seller`), `expires_at`, `accepted_by`, `accepted_at`.
- `offers` — `id`, `deal_id`, `version` int (unique per deal), `proposed_by`, `terms` jsonb (validated against the template), `total_paise`, `milestones` jsonb (array of `{ seq, title, amount_paise, due_date, acceptance_criteria }`; sum must equal `total_paise`), `fee_payer`, `inspection_days`, `message`, `is_final` bool ("best and final"), `status` (`open|countered|accepted|rejected|withdrawn|expired|superseded`), `expires_at`, `parent_offer_id`, `terms_hash` (SHA-256 of canonical JSON).
- `private_notes` — `id`, `deal_id`, `user_id`, `walk_away_paise`, `target_paise`, `notes`. **RLS: owner only, always.** Never joined into anything the counterparty can read.
- `messages` — `id`, `deal_id`, `sender_id` (null for system), `kind` (`user|system`), `body`, `body_locale`, `translations` jsonb (`{ ta: "...", hi: "..." }`), `flags` jsonb (scam-shield results), `attachment_ids` uuid[].
- `attachments` — `id`, `deal_id`, `uploaded_by`, `bucket`, `storage_path`, `mime`, `size_bytes`, `sha256`, `purpose` (`chat|delivery_proof|evidence|agreement`).

### Agreements, milestones and money

- `agreements` — `id`, `deal_id`, `offer_id`, `version`, `pdf_path`, `pdf_sha256`, `signed_pdf_path`, `signed_pdf_sha256`, `status` (`pending_signatures|signed|void`), `terms_version` (platform T&C version), `signed_at`.
- `signatures` — `id`, `agreement_id`, `signer_id`, `method` (`otp|aadhaar_esign`), `signed_at`, `ip` inet, `user_agent`, `otp_challenge_id`, `consent_text_hash`.
- `otp_challenges` — `id`, `user_id`, `purpose` (`sign_agreement|release|payout_change`), `code_hmac`, `expires_at` (5 minutes), `attempts` (max 5), `consumed_at`, `channel` (`sms|whatsapp|email`).
- `milestones` — `id`, `deal_id`, `agreement_id`, `seq`, `title`, `amount_paise`, `due_date`, `acceptance_criteria`, `status` (enum below), `inspection_ends_at`, `funded_at`, `delivered_at`, `accepted_at`, `released_at`, `refunded_paise`.
- `payments` — `id`, `milestone_id`, `provider`, `provider_order_id`, `provider_payment_id`, `captured_paise`, `method`, `status` (`created|authorized|captured|failed|refunded|partially_refunded`), `pg_fee_paise`, `pg_tax_paise` (actuals from the provider), `raw` jsonb.
- `transfers` — `id`, `milestone_id`, `payment_id`, `provider_transfer_id`, `payout_account_id`, `amount_paise`, `on_hold` bool, `status` (`created|processed|released|reversed|partially_reversed|failed`), `reversed_paise`, `released_at`.
- `fee_breakdowns` — one row per funded milestone: `base_paise`, `platform_fee_paise`, `platform_fee_gst_paise`, `pg_estimate_paise`, `buyer_pays_paise`, `seller_payout_paise`, `tcs_paise`, `tds_paise`, `fee_payer`, `rates` jsonb (snapshot of the rates used), `pg_variance_paise` (filled after reconciliation).
- `refunds` — `id`, `payment_id`, `amount_paise`, `reason`, `provider_refund_id`, `status`.
- `tax_withholdings` — `id`, `milestone_id`, `kind` (`gst_tcs|it_tds`), `base_paise`, `rate_bps`, `amount_paise`, `period` (YYYY-MM), `seller_id`. Exports in admin.
- `deliveries` — `id`, `milestone_id`, `submitted_by`, `note`, `tracking_ref`, `attachment_ids`, `submitted_at`.

### Disputes, reviews, trust

- `disputes` — `id`, `deal_id`, `milestone_id`, `raised_by`, `reason` (`not_delivered|not_as_agreed|partial|quality|other`), `description`, `desired_outcome` (`full_refund|partial_refund|redo`), `status` (enum below), `response_due_at`, `resolution` (`release|refund|split`), `seller_amount_paise`, `buyer_amount_paise`, `resolved_by`, `resolved_at`, `odr_reference`.
- `dispute_events` — `id`, `dispute_id`, `actor_id`, `kind` (`statement|evidence|proposal|admin_note|decision`), `body`, `attachment_ids`, `visible_to_parties` bool.
- `reviews` — `id`, `deal_id`, `reviewer_id`, `reviewee_id`, `rating` (1 to 5), `text`, `submitted_at`, `published_at` (set when both sides have submitted, or 14 days after completion).
- `trust_stats` — `user_id`, `deals_completed`, `value_band` (text, for example "₹10–50 lakh"; never exact totals publicly), `on_time_rate`, `disputes_raised_against`, `disputes_lost`, `avg_rating`, `updated_at`. Maintained by functions, not by clients.

### Platform and compliance

- `audit_log` — `id` bigserial, `deal_id` (nullable), `actor_id` (nullable for system), `action`, `entity`, `entity_id`, `before` jsonb, `after` jsonb, `prev_hash`, `hash`, `created_at`. **Append-only**: a trigger raises on UPDATE and DELETE; no table privileges for `anon` or `authenticated`. Each row's `hash = sha256(prev_hash || canonical_json(row))`, chained per deal (global chain for deal-less events). Take a transaction-level advisory lock per chain when appending.
- `webhook_events` — `id`, `provider`, `event_id` (unique), `type`, `payload` jsonb, `received_at`, `processed_at`, `error`.
- `notifications` — `id`, `user_id`, `type`, `payload` jsonb, `read_at`; `notification_preferences` per user and channel.
- `consents` — `id`, `user_id`, `purpose` (`account|kyc|ai_processing|marketing`), `notice_version`, `granted_at`, `withdrawn_at`.
- `data_requests` — `id`, `user_id`, `kind` (`export|delete`), `status`, `created_at`, `completed_at`.
- `grievances` — `id`, `user_id`, `deal_id`, `subject`, `body`, `status`, `acknowledged_at` (due within 48 hours), `resolved_at` (due within 30 days).
- `rate_limits` — `key`, `window_start`, `count`. Function `rate_limit_hit(key, window_seconds, max)` returns boolean.
- `ai_usage` — `user_id`, `action`, `model`, `input_tokens`, `output_tokens`, `latency_ms`, `created_at`. Never store prompt or response bodies.
- `platform_settings` — single row of admin-editable configuration (fees, windows, limits), with env defaults.

### RLS principles

- Helper functions (SQL, `stable`, `security definer`, `set search_path = ''`): `is_deal_party(deal_id)`, `is_admin()`.
- Parties read their deals, offers, messages, attachments, agreements, milestones, disputes (only events marked `visible_to_parties`), and a **restricted view** of payments and transfers (`deal_money_view` with no raw provider payloads).
- `private_notes`: owner only. `sensitive_identifiers`, `webhook_events`, `rate_limits`, `ai_usage`, `platform_settings`, `tax_withholdings`: no client access (service role and admin views only).
- **Clients never insert or update deal tables directly.** All writes go through the RPC functions in section 6. Grant `execute` on user-facing RPCs to `authenticated` only; service-only RPCs to `service_role` only.
- Storage buckets: `deal-files` (private; path `{deal_id}/{uuid}-{filename}`; policies check `is_deal_party` on the first path segment), `agreements` (private; read by parties via signed URLs only; written by the server), `avatars` (public read; owner write).
- Realtime: add `messages`, `offers`, `deals`, `milestones`, `disputes` to the `supabase_realtime` publication. RLS applies to Postgres Changes. Subscribe per deal. Document in DECISIONS.md if you switch to private Broadcast channels later.

---

## 6. State machines (enforced in Postgres)

Every transition is a `security definer` function that: checks `auth.uid()` and the caller's role in the deal, checks the current status, applies the change, writes `audit_log` in the same transaction, and returns the updated row. Invalid transitions raise a typed error (`P0001` with a stable message key such as `ERR_NOT_YOUR_TURN`) that the UI maps to friendly text.

### Deal status

`draft → invited → negotiating → agreed → signed → in_progress → completed`
Side exits: `cancelled` (allowed before any milestone is funded, or by admin), `expired` (no activity for 30 days before agreement).

| Function | Who | From | To / effect |
| --- | --- | --- | --- |
| `create_deal(template_key, title, my_role, initial_offer jsonb null)` | any verified user (level ≥ 0) | — | `draft`; optional first offer v1 |
| `create_invite(deal_id, phone, email)` | creator | `draft` / `invited` | `invited`; returns the raw token **once** |
| `accept_invite(token)` | invited person after login | `invited` | fills the empty party slot → `negotiating` (or stays `invited` until a first offer exists) |
| `make_offer(deal_id, terms, milestones, fee_payer, inspection_days, message, expires_in_hours, is_final)` | either party | `negotiating` (or `invited` for v1) | new offer `open`; the other party's open offer becomes `countered`; own older open offer becomes `superseded` |
| `accept_offer(offer_id, expected_version)` | the party who did **not** propose it | `negotiating` | offer `accepted`, deal `agreed`, `agreed_offer_id` set, milestones and agreement placeholder created |
| `reject_offer(offer_id, reason)` / `withdraw_offer(offer_id)` | receiver / proposer | `negotiating` | offer `rejected` / `withdrawn` |
| `record_signature(agreement_id, otp_challenge_id, ip, user_agent)` | a party, via server action after OTP check | `agreed` | signature row; when both signed → agreement `signed`, deal `signed`, first milestone `awaiting_funding` |
| `cancel_deal(deal_id, reason)` | either party | before any funding | `cancelled` |

### Offer rules (also in section 7)

`accept_offer` fails with `ERR_STALE_OFFER` unless the offer is `open`, not expired, is the deal's `current_offer_id`, and `version = expected_version`. An offer with `is_final = true` cannot be countered, only accepted or rejected.

### Milestone status

`pending → awaiting_funding → funding → funded → delivered → accepted → released`
Side paths: `delivered → disputed → (released | refunded | partially_refunded)`, `funded → refunded` (mutual cancellation before delivery), `awaiting_funding → cancelled`.

| Function | Who | Effect |
| --- | --- | --- |
| `start_funding(milestone_id)` | buyer (server action, after the seller's payout account is `active`) | `funding`; payment row created by the server |
| `mark_funded(milestone_id, payment_ref, transfer_ref)` | **service role only** (webhook) | `funded`; deal `in_progress` |
| `submit_delivery(milestone_id, note, tracking_ref, attachment_ids)` | seller | `delivered`; `inspection_ends_at = now() + inspection_days` |
| `accept_delivery(milestone_id)` | buyer | `accepted`; queues release |
| `mark_released(milestone_id)` | service role (after the provider confirms) | `released`; next milestone `awaiting_funding`; deal `completed` when all are settled |
| `raise_dispute(milestone_id, reason, description, desired_outcome, attachment_ids)` | buyer, only while `delivered` and before `inspection_ends_at`; seller may raise `not_paid`-type disputes only if release is blocked | `disputed`; release blocked |
| `request_cancellation(milestone_id)` / `agree_cancellation(milestone_id)` | either party / the other party | mutual cancellation before delivery → refund flow |

### Dispute status

`open → awaiting_response (72 hours) → in_mediation → resolved`; `escalated_odr` is a terminal state that records an external reference. If the other side does not respond in 72 hours, the dispute moves to `in_mediation` automatically. Only admins call `resolve_dispute(dispute_id, resolution, seller_amount_paise, buyer_amount_paise, note)`; amounts must sum to the funded base amount.

### Time

All SQL uses `public.app_now()` instead of `now()`. In production it returns `now()`. In dev and test projects it returns an override from `dev_mock.clock` when one is set, so end-to-end tests can move time forward (offer expiry, inspection windows, dispute timers) without waiting.

### Scheduled jobs

- `pg_cron` every 5 minutes, pure SQL: expire offers past `expires_at`; move disputes past `response_due_at` to `in_mediation`; expire stale deals; recompute `trust_stats` for touched users.
- `pg_cron` every 5 minutes via `pg_net`: `POST {SITE_URL}/api/cron/tick` with `Authorization: Bearer <CRON_SECRET>` read from Supabase Vault. The handler: releases holds for milestones with `accepted` status, auto-accepts `delivered` milestones whose `inspection_ends_at` has passed and that have no open dispute, sends reminder notifications (offer expiring in 6 hours, inspection ending in 24 hours, dispute response due), and retries failed provider calls with exponential backoff. The handler must be idempotent and safe to run concurrently (use `select ... for update skip locked`).

---

## 7. Negotiation rules

- **Templates** define the terms schema. Build these three:
  - `goods_order`: `items[] { name, spec, qty, unit, unit_price_paise, gst_rate_bps }`, `price_includes_gst` bool, `delivery { mode: pickup|ship, address, by_date }`, `warranty_months`, `notes`.
  - `project_milestones` (job work, fabrication, automation): `scope`, `deliverables[]`, `materials_by` (`buyer|seller`), `change_request_rate_paise`, `warranty_months`, `site_location`.
  - `freelance_service`: `scope`, `deliverables[]`, `revisions_included`, `ip_transfer_on_full_payment` bool, `source_files_included` bool.
  - Common to all: `milestones[]`, `fee_payer`, `inspection_days` (1 to 14), `gst_invoice_required` bool, `buyer_gstin`, `seller_gstin`.
- **Turns:** either party may propose when they have no open offer. Proposing while the other side has an open offer counters it. Only the receiving party can accept or reject.
- **Expiry:** default 48 hours (`OFFER_TTL_HOURS`), allowed 1 hour to 14 days. The proposer may extend once. Expiry timers shown in the UI must be the real expiry, never invented urgency.
- **Rounds:** at most 30 offers per deal; then the UI suggests a call or mediation.
- **Diff:** `lib/domain/offers.ts` exposes `diffTerms(prev, next)` returning per-field changes with absolute and percentage change for money and dates. The offer card highlights changes and summarises them in one line ("Price −4.5%, delivery +3 days").
- **Validation:** milestones sum exactly to `total_paise`; amounts ≥ ₹100; due dates not in the past; GST numbers valid (format + checksum) when present.
- **Private limits:** each user may save a walk-away price and target in `private_notes`. The UI warns the user (privately) when they are about to offer beyond their walk-away. Nothing in `private_notes` is ever shown to, sent to, or used for the other party.
- **Canonical hashing:** `terms_hash` is SHA-256 of the canonical JSON (sorted keys) of terms + milestones + fee_payer + inspection_days. The agreement embeds this hash.

---

## 8. Agreement and signing

- On `accept_offer`, a server action generates the agreement PDF with `@react-pdf/renderer`: parties (names, verification badges, optional GSTINs), deal code, the accepted terms in full, the milestone schedule, inspection window, fee payer, refund and cancellation rules, dispute process (platform mediation, then arbitration through an online dispute resolution provider named in `platform_settings`), governing law (India) and jurisdiction (configurable city), platform terms version, the offer's `terms_hash`, and a generation timestamp.
- Language: English is the binding text. Users may download a Tamil or Hindi reading copy, clearly marked as a translation.
- Upload to the `agreements` bucket, compute SHA-256 of the bytes, save `pdf_sha256`, show the first 12 characters in the UI with the full value on tap.
- **Signing:** each party taps "Sign", sees the consent text ("I agree to be bound by this agreement, fingerprint …"), receives a 6-digit OTP (`lib/security/otp.ts`: HMAC-stored, 5-minute expiry, 5 attempts, 60-second resend cooldown, rate-limited), and confirms. Record the signature with time, IP, user agent and consent-text hash.
- When both have signed, generate a signature page (names, timestamps, IPs, base PDF hash), produce `signed_pdf`, hash it, and mark the agreement `signed`.
- Phase 2 (not now): Aadhaar eSign through a licensed eSign provider behind `lib/providers/esign`.

---

## 9. Payments, fees and payouts

### Principle

HaathMila never holds money. The buyer pays Razorpay; Razorpay holds the seller's share as an **on-hold Route transfer** to the seller's linked account; HaathMila releases or reverses it. Platform fees remain in the platform's own Razorpay balance.

### Provider interface (`lib/providers/payments/types.ts`)

```ts
interface PaymentProvider {
  createLinkedAccount(input: LinkedAccountInput): Promise<{ accountId: string; status: 'pending' | 'active' }>;
  getLinkedAccountStatus(accountId: string): Promise<'pending' | 'active' | 'suspended'>;
  createOrder(input: { amountPaise: number; receipt: string; transfers: HeldTransfer[]; notes: Record<string, string> }): Promise<{ orderId: string }>;
  verifyCheckoutSignature(input: { orderId: string; paymentId: string; signature: string }): boolean;
  verifyWebhook(rawBody: string, signature: string): boolean;
  getPayment(paymentId: string): Promise<{ status: string; method: string; feePaise: number; taxPaise: number }>;
  releaseTransfer(transferId: string): Promise<void>;           // on_hold: false
  reverseTransfer(transferId: string, amountPaise: number): Promise<{ reversalId: string }>;
  refundPayment(paymentId: string, amountPaise: number): Promise<{ refundId: string }>;
}
```

- `MockPaymentProvider`: fully functional and deterministic. It simulates checkout (a dev-only page with "Pay" / "Fail" buttons), emits signed fake webhooks to the real webhook route, supports holds, releases, reversals and refunds, and keeps its state in a separate `dev_mock` schema with no client access. It refuses to start when `NODE_ENV=production`. End-to-end tests run on it.
- `RazorpayPaymentProvider`:
  - Linked accounts: Route linked-account APIs (account, stakeholder, product configuration with settlement bank details). Funding is blocked until the seller's payout account is `active`.
  - Funding: create an Order with `transfers: [{ account, amount: seller_payout_paise, currency: 'INR', on_hold: true, notes }]`, open Razorpay Checkout with the `order_id`, then verify `razorpay_signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)` on the server.
  - Release: `PATCH /v1/transfers/:id` with `on_hold: false`. Reverse: `POST /v1/transfers/:id/reversals`. Refund: `POST /v1/payments/:id/refund`.
  - Read actual `fee` and `tax` from the payment entity for reconciliation.
  - Use Razorpay's customer-fee-bearer setting if it is enabled on the account; otherwise use the gross-up below.
  - Confirm every endpoint, parameter and webhook event name in the current Razorpay docs and record them in DECISIONS.md.

### Webhooks (`/api/webhooks/razorpay`, Node runtime)

- Read the raw body, verify `X-Razorpay-Signature` (HMAC-SHA256 with the webhook secret) using a constant-time comparison, insert into `webhook_events` with the provider's event id as a unique key (duplicate → return 200 and stop), process inside a transaction, mark processed. Always return 200 quickly after recording; heavy work is retried by the cron tick.
- Handle at least: payment captured or order paid → `mark_funded`; payment failed → back to `awaiting_funding` with a notification; transfer processed or failed; refund processed or failed.

### Fees (`lib/domain/fees.ts`, pure, exhaustively unit-tested)

Configuration (from `platform_settings`, defaults from env):

- `PLATFORM_FEE_BPS` = 150 (Business Pro: 100), `PLATFORM_FEE_MIN_PAISE` = 4,900, `PLATFORM_FEE_MAX_PAISE` = 4,99,900 per milestone.
- `GST_ON_FEE_BPS` = 1,800.
- `PG_EFFECTIVE_RATE_BPS` = 236 for online methods (2% plus 18% GST), configurable per method.
- `TCS_ENABLED`, `TCS_RATE_BPS` = 50; `TDS_ENABLED`, `TDS_RATE_BPS` = 10, with the individual or HUF annual threshold `TDS_THRESHOLD_PAISE` = 5,00,00,000 (₹5 lakh). Both **disabled by default** until a CA confirms the treatment.

For a milestone with base amount `B` and fee payer share `s_b` for the buyer (1, 0.5 or 0) and `s_s = 1 − s_b` for the seller:

```
F    = clamp(round(B × PLATFORM_FEE_BPS / 10000), MIN, MAX)      // platform fee
G    = round(F × GST_ON_FEE_BPS / 10000)                         // GST on platform fee
Fb   = round((F + G) × s_b)                                      // buyer share of platform fee
Fs   = (F + G) − Fb                                              // seller share
r    = PG_EFFECTIVE_RATE_BPS / 10000
C    = ceil((B + Fb) / (1 − s_b × r))                            // amount the buyer pays (gross-up)
PG   = round(C × r)                                              // expected payment cost
PGs  = round(PG × s_s)                                           // seller share of payment cost
TCS  = TCS_ENABLED ? round(taxable_value × TCS_RATE_BPS / 10000) : 0
TDS  = TDS_ENABLED && applicable ? round(gross × TDS_RATE_BPS / 10000) : 0
Payout = B − Fs − PGs − TCS − TDS                                // on-hold transfer to the seller
Platform keeps: C − actual_PG − Payout  (should equal F + G + TCS + TDS, ± pg_variance)
```

- Round half up to the paisa. Store the full breakdown and the rate snapshot in `fee_breakdowns`. After capture, store actual provider fee and tax and compute `pg_variance_paise`.
- Show every line (base, platform fee, GST on fee, payment charge, TCS, TDS, payout) **before** the buyer commits and inside the offer card, so there is no drip pricing.
- Refunds: on cancellation before release, the platform fee is refunded. Payment charges are refunded only if the provider refunds them; say so at checkout.

### Large tickets

UPI is limited to ₹1 lakh per transaction for regular merchants, so for milestones above ₹1 lakh the checkout should steer to net banking or a bank transfer. Suggest splitting very large orders into milestones. Document the provider's per-method limits in DECISIONS.md.

---

## 10. Delivery, inspection and release

- The seller submits delivery for a funded milestone with a note, optional tracking reference and files (photos, PDFs, test reports). The milestone becomes `delivered` and the inspection window starts (template default: goods 3 days, project 5 days, freelance 3 days; negotiated per deal).
- The buyer can **Accept**, **Raise a dispute**, or do nothing. When the window ends with no dispute, the cron tick auto-accepts. Accepted milestones are released by the tick or immediately by a server action.
- Release requires an OTP from the buyer only when the buyer releases early by hand **and** the amount is above `RELEASE_OTP_THRESHOLD_PAISE` (default ₹50,000). Auto-release needs no OTP.
- After release: notify both, update trust stats, and when all milestones are settled, mark the deal `completed` and open reviews.

---

## 11. Disputes

- The buyer raises a dispute before the window ends: reason, description, desired outcome and evidence. The whole thread, offers, agreement and delivery proof are attached automatically (evidence locker).
- The seller has 72 hours to respond with a statement, evidence, or a settlement proposal (for example a partial refund). If both accept a proposal, the system resolves the dispute without an admin.
- Otherwise an admin mediator reviews everything in `/admin/disputes/[id]` and decides `release`, `refund`, or `split` with exact amounts. Execution: release → `releaseTransfer`; refund → `reverseTransfer(full)` then `refundPayment`; split → `reverseTransfer(buyer_amount)`, `refundPayment(buyer_amount)`, then `releaseTransfer` for the remainder. Verify the reversal-then-release sequence in Razorpay test mode and document it in RUNBOOKS.md.
- The admin can mark `escalated_odr` with an external reference for arbitration through the provider named in the agreement.
- All dispute actions write `audit_log`. Parties see only events marked visible to them.

---

## 12. Reputation and trust profile

- Reviews only for completed deals, one per party, within 14 days. Double-blind: hidden until both submit or 14 days pass. No editing after publishing; the reviewee can post one public reply.
- `trust_stats` per user: deals completed, value band (never exact totals), on-time delivery rate, disputes raised against them, disputes lost, average rating.
- `lib/domain/trust.ts`: a transparent trust score (0 to 100) built from verification level, completed deals (log-scaled), on-time rate, dispute outcomes and ratings. The profile shows each component, not a black box.
- `/u/[handle]`: verification badges, stats, recent reviews, member since. A "Share on WhatsApp" button.

---

## 13. Trust and safety

- **Verification tiers:** L0 phone OTP (signup); L1 PAN verified with name match ≥ 0.8; L2 bank account verified (penny drop) with name match; L3 DigiLocker-based identity through a licensed provider (phase 2). Business badge: GSTIN active and name-matched. Seller payouts require L1 and L2. Funding or receiving above `KYC_L1_REQUIRED_ABOVE_PAISE` (default ₹2 lakh) requires L1 for both sides. All thresholds live in settings.
- `lib/providers/kyc`: `verifyPan(pan, name)`, `verifyBankAccount(account, ifsc, name)`, `verifyGstin(gstin)`, `startDigiLocker()` (stub). Mock returns configurable outcomes. Store only status, provider reference, masked values and encrypted identifiers.
- **Field encryption** (`lib/security/crypto.ts`): AES-256-GCM with `FIELD_ENCRYPTION_KEY` (32 bytes, base64) from env, plus HMAC lookup keys. Unit-test round trips and tamper detection.
- **Scam shield** (`lib/security/scam-shield.ts`): scan every chat message for UPI IDs, Indian phone numbers, payment links, and phrases about paying outside the platform or paying "advance", "token", "courier charge" or "transfer charge", in English, Tamil and Hindi (including common transliterations). On a hit: save flags, show both parties a calm banner ("Payments made outside HaathMila are not protected"), and count repeated hits against the sender's trust score. Rules live in a config file with unit tests for each pattern.
- **New-seller holds:** the first 3 payouts of a new seller wait at least 24 hours after acceptance (configurable).
- **Velocity limits** on deal creation, invites, offers, messages, OTPs and AI calls via `rate_limit_hit`.
- **Reports and blocks:** users can report a deal or user; admins see a moderation queue.
- **Prohibited deal types** (config list): weapons, drugs, financial instruments, real-estate sales, crypto, anything illegal. Show the list in the terms.

---

## 14. AI copilot

Routes under `/api/ai/[action]` (Node runtime), behind `AI_ENABLED`, per-user daily limit (`AI_DAILY_LIMIT`, default 50), and the user's `ai_processing` consent. If consent is missing, the UI shows an opt-in card instead.

| Action | Model | Input context | Output (Zod-validated JSON) |
| --- | --- | --- | --- |
| `summarize` | copilot | deal, offers, last 100 messages | `{ summary, agreed_points[], open_points[], next_step }` |
| `suggest-counter` | copilot | the above + **the requesting user's own** private note | `{ suggested_terms, rationale, confidence, message_draft, warnings[] }` |
| `risk-check` | copilot | the offer being reviewed + template | `{ flags: [{ field, severity, explanation, suggestion }] }` |
| `translate` | fast | one message + target locale | `{ text }`, cached in `messages.translations` |

Rules:

- Build the context with the **user's own Supabase server client** (RLS applies). Never use the secret-key client for AI context. A test must prove that user B's private note can never appear in user A's AI context or output.
- System prompt: be neutral and honest; never deceive or pressure the other party; keep any suggested price inside the user's walk-away limit; never reveal private notes inside a message draft; answer in the user's locale.
- The copilot only drafts. The user edits and sends. It never calls `make_offer`, `accept_offer` or any other write function.
- Label AI-generated text clearly in the UI. On invalid JSON, retry once, then show a friendly error.
- Log usage metadata in `ai_usage` only (no prompt or response bodies).

---

## 15. Notifications

Events: invite received, offer received, offer expiring (6 hours before), offer accepted, agreement ready to sign, agreement signed, milestone funded, delivery submitted, inspection ending (24 hours before), payment released, dispute opened, dispute response due, dispute resolved, review requested, grievance acknowledged.

- Every event creates an in-app notification (Realtime bell) and, per user preference, email, SMS or WhatsApp through the messaging adapters. Templates exist per locale. SMS uses DLT-registered template IDs from env.
- Phone OTP for login uses Supabase Auth with the **Send SMS hook** pointing to `/api/auth/hooks/send-sms`, which verifies the hook signature and sends through MSG91 (mock in dev: log the OTP and show it in a dev-only toast). In development you may also use Supabase's test phone numbers.
- Deal-link previews (Open Graph) are generic ("You have a deal invitation on HaathMila") unless the creator turns on `show_preview_publicly`.

---

## 16. Pages and UX

Design: calm, trustworthy, high contrast, mobile-first, large tap targets, works on low-end Android over 4G. Primary colour deep teal, accent warm saffron, red only for errors. Tamil and Hindi text gets slightly larger line height. Every money figure shows ₹ with Indian grouping.

- **Marketing:** `/` (headline: "Negotiate. Shake hands. Get paid safely."), `/how-it-works` (the 7-step loop), `/pricing` (fee table and calculator), `/safety` (scam education in en/ta), `/templates/[slug]` (job-work agreement, milestone contract, goods order), `/help`.
- **Legal:** terms, privacy notice (DPDP-style, purpose-wise), refunds and cancellation, grievance officer (name, email, phone, address from settings, with the 48-hour acknowledgement and one-month resolution promise).
- **Auth:** `/login` (phone OTP first, email magic link, Google), `/onboarding` (name, handle, language, individual or business, purpose-wise consent checkboxes, none pre-ticked).
- **Dashboard:** action items first ("2 offers waiting for you", "Fund milestone 1", "Inspection ends tomorrow"), deals by status, trust summary, verification nudges.
- **New deal wizard:** template → my role (buyer or seller) → terms form with live fee preview → milestones → counterparty phone or email → create → share sheet (WhatsApp, copy link, QR).
- **Deal-link landing `/d/[code]`:** deal summary (if allowed), proposer's verification badges and trust stats, "Continue with phone" → join.
- **Deal room `/deals/[dealId]`:** status stepper at the top; current offer card with diff and actions (accept, counter, reject, withdraw); chat with attachments, translation toggle and scam-shield banners; tabs for offers history, agreement, milestones and payments, files, activity log (audit trail in plain language); copilot drawer; private-notes panel visible only to its owner.
- **Funding page:** fee breakdown, method guidance (UPI up to ₹1 lakh; net banking or bank transfer above), provider checkout.
- **Dispute page:** structured form, evidence upload, timeline.
- **Settings:** profile, verification, payouts (linked account status), business (GSTIN), notifications, privacy (consents, data export, deletion request), language.
- **Admin:** overview metrics, KYC review queue, disputes queue and decision screen, payouts monitor (held, released, reversed, failed, variance), deals search, audit log viewer with chain verification, grievances with SLA timers, moderation queue, settings (fees, windows, thresholds, ODR provider, grievance officer). Admin access requires `is_admin()` checked on the server for every page and action.

---

## 17. Security and privacy checklist (must all pass)

- RLS enabled on every table; deny by default; policies tested with two users plus anon.
- No secret key, provider secret or AI key in any client bundle (`import 'server-only'` in those modules; a test greps the build output).
- Every server action and route handler: authenticate with `getClaims()`, authorise against the deal, validate with Zod, rate-limit where relevant.
- `security definer` functions use `set search_path = ''` and fully qualified names.
- Webhooks: signature verification with constant-time compare, idempotency, raw-body handling.
- Money: integer paise only; a property-based test proves that `Payout + (F + G + TCS + TDS) + PG` equals `C` within ±2 paise for random inputs, and that any difference is booked to `pg_variance_paise`.
- Audit log is append-only and its hash chain verifies (`scripts/verify-audit-chain.mjs` and an admin button).
- Security headers: CSP allowing only the app, Supabase and Razorpay Checkout origins; HSTS; `X-Content-Type-Options`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy`; frame-ancestors none.
- Sensitive identifiers encrypted at rest; masked everywhere in the UI; never logged.
- No Aadhaar numbers stored, ever.
- File uploads: type and size allow-list (images, PDF; 15 MB), SHA-256 recorded, served only through short-lived signed URLs.
- Dependencies: `npm audit` in CI; no unmaintained auth libraries.

---

## 18. Compliance features

- **Data protection (DPDP):** purpose-wise consent records with notice versions; withdraw consent in settings; data export (JSON + files zip) and deletion requests with an admin workflow; retention schedule in `platform_settings` (agreements, payment and tax records kept for the period a CA confirms; chat attachments deleted 3 years after completion by default); a breach-response runbook; all data in the Mumbai region.
- **Consumer protection:** grievance officer details on the site and in every deal room footer; tickets acknowledged within 48 hours and resolved within one month, with admin alerts at 36 hours and 25 days; seller identity (name, verification, GSTIN where present) shown to the buyer; explicit consent with no pre-ticked boxes; cancellation rules symmetric for both sides.
- **Dark-pattern guardrails:** only real offer expiries; no fake scarcity or "people viewing" counters; all fees visible before commitment; no confirm-shaming copy; easy cancellation and account deletion. Keep a self-audit checklist in `docs/RUNBOOKS.md`.
- **Tax:** TCS and TDS ledgers with monthly and quarterly CSV exports for the CA; GST invoices for platform fees (sequential numbering per financial year); seller GSTIN captured where applicable. Feature flags off until the CA confirms.
- **Payments:** payouts only to the seller's own verified account; no cash on delivery; the provider's KYC for sellers completes before the first payout.

---

## 19. Environment variables (`.env.example`)

```
# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=HaathMila

# Supabase (dev project; test project values go in .env.test)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_PROJECT_ID=
SUPABASE_AUTH_HOOK_SECRET=

# Payments
PAYMENT_PROVIDER=mock            # mock | razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=

# Fees and limits (defaults; admin can override in platform_settings)
PLATFORM_FEE_BPS=150
PRO_PLATFORM_FEE_BPS=100
PLATFORM_FEE_MIN_PAISE=4900
PLATFORM_FEE_MAX_PAISE=499900
GST_ON_FEE_BPS=1800
PG_EFFECTIVE_RATE_BPS=236
TCS_ENABLED=false
TCS_RATE_BPS=50
TDS_ENABLED=false
TDS_RATE_BPS=10
TDS_THRESHOLD_PAISE=50000000
OFFER_TTL_HOURS=48
RELEASE_OTP_THRESHOLD_PAISE=5000000
KYC_L1_REQUIRED_ABOVE_PAISE=20000000

# KYC
KYC_PROVIDER=mock
KYC_API_KEY=

# Messaging
SMS_PROVIDER=mock                # mock | msg91
MSG91_AUTH_KEY=
MSG91_SENDER_ID=
MSG91_TEMPLATE_LOGIN_OTP=
MSG91_TEMPLATE_SIGN_OTP=
WHATSAPP_PROVIDER=mock
WHATSAPP_API_KEY=
EMAIL_PROVIDER=mock              # mock | resend
RESEND_API_KEY=
EMAIL_FROM=

# AI
AI_ENABLED=true
ANTHROPIC_API_KEY=
CLAUDE_MODEL_COPILOT=claude-sonnet-5-5
CLAUDE_MODEL_FAST=claude-haiku-5-5
AI_DAILY_LIMIT=50

# Security
FIELD_ENCRYPTION_KEY=            # 32 random bytes, base64
OTP_HMAC_SECRET=
CRON_SECRET=

# Observability (optional)
SENTRY_DSN=
```

Remember: `500000 paise = ₹5,000`. Double-check every paise constant against its rupee comment in code.

---

## 20. Testing and seed data

- **Unit (Vitest):** `money.ts`, `fees.ts` (table-driven cases for buyer, seller and split payers; minimum and maximum caps; rounding; property-based reconciliation), `offers.ts` (validation and diff), `states.ts`, `trust.ts`, `scam-shield.ts`, `crypto.ts`, `otp.ts`.
- **Integration (Vitest against the Supabase test project):** RLS for every table with two users and anon; every RPC's happy path and its main error codes (`ERR_NOT_YOUR_TURN`, `ERR_STALE_OFFER`, `ERR_NOT_A_PARTY`, `ERR_INVALID_STATE`); audit chain verification; webhook idempotency.
- **End-to-end (Playwright, mock providers):**
  1. Happy path: create deal → invite → counter → accept → both sign → fund → deliver → accept → release → reviews → completed.
  2. Auto-release: deliver → time travel past the window (test-only clock override) → released.
  3. Dispute: deliver → dispute → seller proposes a partial refund → buyer accepts → split executed.
  4. Admin decision: dispute → no response → mediation → admin split.
  5. Stale accept is refused; private note never visible to the counterparty; scam-shield banner appears.
- **Seed (`scripts/seed.mjs` + `supabase/seed.sql`):** three demo users (a Coimbatore job shop, a buyer at an automation company, a freelance PLC programmer), one admin, and deals in every status, with Tamil and English messages.

---

## 21. Phases and acceptance criteria

Stop after each phase with the report described in section 1.

### Phase 0 — Foundation
- Create the Next.js 16 app (TypeScript, App Router, ESLint, Tailwind v4), shadcn/ui, next-intl (en, ta, hi scaffold), folder layout from section 4, `CLAUDE.md`, `docs/*`, `.env.example`, Vitest, Playwright, npm scripts (`dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`, `db:push`, `db:types`, `seed`), and a GitHub Actions workflow (install, typecheck, lint, unit tests).
- Link the Supabase dev project with `npx supabase link`; create the first migration with extensions (`pgcrypto`, `pg_cron`, `pg_net`), enums, helper functions and `updated_at` triggers.
- `vercel.json` (or route config) pinning functions to `bom1`.
- **Accept when:** `npm run dev` shows a placeholder home page in English and Tamil; typecheck, lint and tests pass; CI file present; docs created.

### Phase 1 — Auth, profiles, verification
- Supabase clients (`client.ts`, `server.ts`, `proxy.ts` with `updateSession` using `getClaims()`), login (phone OTP, email magic link, Google), Send SMS hook route (mock), onboarding with consents, profiles, organizations, `app_admins`, verifications with the KYC mock, encrypted identifiers, settings pages for profile, verification, business and privacy.
- **Accept when:** two users can sign up and verify (mock); RLS tests prove they cannot read each other's private data; consents are recorded; the admin route rejects non-admins.

### Phase 2 — Deals and negotiation
- Templates and Zod schemas, new-deal wizard with fee preview (fees.ts), invites and the `/d/[code]` landing, join flow, all negotiation RPCs with turn rules, expiry, versioning and `terms_hash`, offer card with diff, private notes, chat with Realtime, attachments with storage policies, scam shield, audit log with hash chain, activity tab.
- **Accept when:** end-to-end test 5 passes and the negotiation part of test 1 passes; the audit chain verifies; offers expire through `pg_cron`.

### Phase 3 — Agreement and signing
- PDF generation with embedded fonts, hashing, storage, signing OTP, signature page, signed PDF, agreement viewer and download, milestones created from the accepted offer.
- **Accept when:** both parties can sign; the stored hash matches the downloaded file; signatures record time, IP and user agent; a Tamil reading copy renders correctly.

### Phase 4 — Payments, delivery and release
- Payment provider interface, mock provider (with dev checkout page and signed fake webhooks), Razorpay provider, linked-account onboarding, funding flow, webhook route, delivery submission, inspection window, accept and release, cron tick with auto-release, mutual cancellation and refunds, fee breakdowns, TCS/TDS ledgers behind flags, GST invoice for platform fees, payouts monitor (read-only) in admin.
- **Accept when:** end-to-end tests 1 and 2 pass on the mock provider; webhook replay is a no-op; every rupee reconciles to the paisa in `fee_breakdowns`; `docs/RUNBOOKS.md` contains a Razorpay test-mode checklist (linked account, funding, hold, release, reversal, refund) that the human runs once by hand.

### Phase 5 — Disputes, admin and grievances
- Dispute flow with the 72-hour response timer, settlement proposals, evidence locker view, admin disputes queue and decision execution (release, refund, split), ODR escalation record, grievances with SLA timers, moderation queue, admin audit viewer with chain check, admin settings.
- **Accept when:** end-to-end tests 3 and 4 pass; only admins can resolve; every action is in the audit log.

### Phase 6 — Reputation and notifications
- Double-blind reviews, `trust_stats`, trust score, public profile with WhatsApp share, notification center, email, SMS and WhatsApp adapters with templates per locale, preferences, reminders through the cron tick, real MSG91 and Resend implementations behind env flags.
- **Accept when:** reviews stay hidden until both submit or 14 days pass; profile stats match seeded data; notifications fire for every event in section 15 (mock channels in tests).

### Phase 7 — AI copilot
- Anthropic client, the four actions with Zod schemas, consent gate, rate limits, usage logging, copilot drawer UI with clearly labelled drafts, translation toggle in chat.
- **Accept when:** the privacy test (counterparty's private note never in context or output) passes; suggestions never exceed the user's walk-away limit in tests with stubbed responses; nothing is sent without a user action; `AI_ENABLED=false` hides every AI surface.

### Phase 8 — Hardening and launch readiness
- Complete Hindi strings; marketing, pricing calculator, safety and template pages; SEO metadata; PWA (manifest, icons, offline page); accessibility pass (WCAG 2.2 AA basics); security headers and CSP; data export and deletion workflow; backups and restore notes; Sentry wiring (optional); performance pass; production deployment guide for Vercel and a Supabase production project (Mumbai) in `docs/RUNBOOKS.md`.
- **Accept when:** Lighthouse mobile ≥ 90 for performance, accessibility and best practices on the home page and a seeded deal room; the section 17 checklist passes; all test suites are green; the deployment guide works from a clean clone on Windows.

---

## 22. Things you must never do

- Store or log Aadhaar numbers, full PANs, full bank account numbers, OTPs or API keys.
- Use floating-point numbers for money.
- Let any client write directly to deal, offer, milestone, payment or audit tables.
- Use the secret-key Supabase client in code reachable from the browser, or to build AI context.
- Let the AI send, accept, sign or release anything.
- Show invented urgency, hidden fees or pre-ticked consents.
- Move money without a verified webhook or a confirmed provider response.
- Skip a phase's tests or stop-and-report step.

---

## 23. Definition of done (every phase)

- Code builds; typecheck, lint and all relevant tests pass on Windows and in CI.
- New tables have RLS policies and tests; new RPCs have audit logging and error-code tests.
- Strings are translated in `en` and `ta` (`hi` from Phase 8).
- `docs/SPEC.md`, `docs/DECISIONS.md` and `docs/PROGRESS.md` are updated.
- The phase report lists any manual steps for the human, in order, with exact commands for PowerShell.
