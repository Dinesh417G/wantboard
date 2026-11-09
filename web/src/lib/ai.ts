// AI copilot via Vercel AI Gateway (OpenAI-compatible endpoint). Server-only.
// The copilot only drafts and explains; it never makes, accepts or pays anything.
// If the gateway is unavailable it falls back to deterministic heuristics and says so.
import "server-only";
import { CATEGORIES, type Category, type Match, type Party, type WantRequest } from "./types";
import type { RequestView } from "./dto";
import { usd } from "./domain/money";
import { diffTerms, summarizeDiff } from "./domain/offers";

// Provider order: Gemini, Groq, OpenRouter, then Vercel AI Gateway. The first one with a key that answers wins.
// Both speak the OpenAI chat-completions format.
type Provider = { url: string; key: string; smart: string; fast: string; name: string; extra?: Record<string, unknown> };

function providers(): Provider[] {
  const list: Provider[] = [];
  if (process.env.GEMINI_API_KEY)
    list.push({
      name: "gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: process.env.GEMINI_API_KEY,
      smart: process.env.GEMINI_MODEL_SMART ?? "gemini-2.5-flash",
      fast: process.env.GEMINI_MODEL_FAST ?? "gemini-2.5-flash",
    });
  if (process.env.GROQ_API_KEY)
    list.push({
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      smart: process.env.GROQ_MODEL_SMART ?? "openai/gpt-oss-120b",
      fast: process.env.GROQ_MODEL_FAST ?? "openai/gpt-oss-20b",
      // gpt-oss reasons before answering; keep that short and force a JSON object.
      extra: { reasoning_effort: "low", response_format: { type: "json_object" } },
    });
  if (process.env.OPENROUTER_API_KEY)
    list.push({
      name: "openrouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: process.env.OPENROUTER_API_KEY,
      smart: process.env.OPENROUTER_MODEL_SMART ?? "meta-llama/llama-3.3-70b-instruct:free",
      fast: process.env.OPENROUTER_MODEL_FAST ?? "meta-llama/llama-3.3-70b-instruct:free",
    });
  const gw = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (gw)
    list.push({
      name: "gateway",
      url: "https://ai-gateway.vercel.sh/v1/chat/completions",
      key: gw,
      smart: process.env.AI_MODEL_SMART ?? "anthropic/claude-sonnet-5.5",
      fast: process.env.AI_MODEL_FAST ?? "anthropic/claude-haiku-5.5",
    });
  return list;
}

const MODEL_SMART = "smart";
const MODEL_FAST = "fast";

export type AiResult<T> = { data: T; source: "ai" | "heuristic"; model?: string; note?: string };

const SYSTEM = `You are Clinch Copilot, a negotiation assistant inside a buyer-seller deal room.
Rules: be neutral, honest and concise. Never deceive or pressure the other party. Never reveal the user's private limit in any message draft.
Never suggest paying outside the platform. Keep suggested prices within the user's private limit when one is given.
You only draft and explain; the user decides and sends. Reply with JSON only, matching the requested shape.`;

/** Providers that refused us (no credit, bad key, rate limit) are skipped for a while instead of slowing every call. */
const benched = new Map<string, number>();

async function ask<T>(tier: string, prompt: string, validate: (x: unknown) => T): Promise<AiResult<T> | null> {
  for (const p of providers()) {
    if ((benched.get(p.name) ?? 0) > Date.now()) continue;
    const model = tier === MODEL_SMART ? p.smart : p.fast;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(p.url, {
          method: "POST",
          headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            max_tokens: 2000,
            temperature: 0.3,
            ...p.extra,
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: prompt },
            ],
          }),
          signal: AbortSignal.timeout(25_000),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.warn(`[ai] ${p.name} ${res.status}`, body?.error?.type ?? body?.error?.message ?? body?.[0]?.error?.message);
          if ([401, 402, 403, 429].includes(res.status)) benched.set(p.name, Date.now() + 10 * 60_000);
          break; // try the next provider
        }
        const text: string = body.choices?.[0]?.message?.content ?? "";
        const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        return { data: validate(json), source: "ai", model };
      } catch (e) {
        console.warn(`[ai] ${p.name} attempt failed`, (e as Error).message);
      }
    }
  }
  return null;
}

const str = (x: unknown, max = 600) => (typeof x === "string" ? x.replace(/[‐-–]/g, "-").slice(0, max) : "");
const arr = (x: unknown) => (Array.isArray(x) ? x.map((v) => str(v, 200)).filter(Boolean).slice(0, 6) : []);

/** Compact, viewer-filtered context. Built from RequestView only (no private data of the other side). */
function context(v: RequestView, threadId?: string) {
  const t = v.threads.find((x) => x.id === threadId) ?? v.threads[0];
  return {
    you_are: v.viewerRole,
    request: { title: v.title, description: v.description, category: v.category, needed_by: v.neededBy, max_price: usd(v.budgetCents), preferences: v.preferences },
    your_private_limit: v.myLimitCents !== undefined ? usd(v.myLimitCents) : null,
    negotiation: t && {
      seller: t.seller.name,
      offers: t.offers.map((o) => ({ v: o.version, by: o.by, status: o.status, price: usd(o.terms.priceCents), delivery: o.terms.deliveryDate, warranty_months: o.terms.warrantyMonths, condition: o.terms.condition, shipping: o.terms.shipping, inspection_days: o.terms.inspectionDays, best_and_final: o.isFinal, message: o.message })),
      chat: t.messages.slice(-30).map((m) => `${m.by}: ${m.text}`),
    },
  };
}

// ---------- categorize ----------

export async function categorize(title: string, description: string): Promise<AiResult<{ category: Category; reason: string }>> {
  const r = await ask(
    MODEL_FAST,
    `Pick the single best category for this wanted item.\nCategories: ${CATEGORIES.join(" | ")}\nItem: ${title}\nDetails: ${description}\nJSON: {"category": one of the categories, "reason": short}`,
    (x) => {
      const o = x as Record<string, unknown>;
      const category = CATEGORIES.find((c) => c === o.category) ?? "Other";
      return { category, reason: str(o.reason, 160) };
    },
  );
  if (r) return r;
  const text = `${title} ${description}`.toLowerCase();
  const rules: [Category, RegExp][] = [
    ["Auto & spare parts", /\b(carb|carburetor|engine|mustang|chevy|ford|brake|piston|bumper|trim|tire)\w*/],
    ["Industrial & raw materials", /\b(alloy|aluminum|steel|bismuth|ingot|titanium|copper|plate|bar|resin|inconel|brass)\b/],
    ["Electronics & components", /\b(ic|chip|pcb|board|capacitor|transistor|fpga|plc|sensor|module|tube)s?\b/],
    ["Vintage & antiques", /\b(vintage|antique|receiver|marantz|mcintosh|retro|1950s|1960s|1970s)\b/],
    ["Rare & collectibles", /\b(rare|collectible|card|coin|stamp|first edition|limited)\b/],
    ["Tools & machinery", /\b(lathe|mill|drill|cnc|tool|machine|press|saw)s?\b/],
    ["Fashion & handmade", /\b(dress|jacket|handmade|leather|watch|bag|shoes)\b/],
  ];
  const hit = rules.find(([, re]) => re.test(text));
  return { data: { category: hit?.[0] ?? "Other", reason: "Matched keywords (offline heuristic)." }, source: "heuristic" };
}

// ---------- summarize ----------

export type Summary = { summary: string; agreed: string[]; open: string[]; next_step: string };

export async function summarize(v: RequestView, threadId?: string): Promise<AiResult<Summary>> {
  const ctx = context(v, threadId);
  const r = await ask(MODEL_SMART, `Summarize this negotiation for the ${v.viewerRole}.\n${JSON.stringify(ctx)}\nJSON: {"summary": string, "agreed": string[], "open": string[], "next_step": string}`, (x) => {
    const o = x as Record<string, unknown>;
    return { summary: str(o.summary), agreed: arr(o.agreed), open: arr(o.open), next_step: str(o.next_step, 240) };
  });
  if (r) return r;
  const t = v.threads.find((x) => x.id === threadId) ?? v.threads[0];
  const offers = t?.offers ?? [];
  const last = offers.at(-1);
  const first = offers[0];
  const moved = first && last && first !== last ? summarizeDiff(diffTerms(first.terms, last.terms)) : "no counters yet";
  return {
    source: "heuristic",
    data: {
      summary: last ? `${offers.length} offer${offers.length === 1 ? "" : "s"} so far. Latest is v${last.version} from the ${last.by}: ${usd(last.terms.priceCents)}, delivery ${last.terms.deliveryDate}. Since v1: ${moved}.` : "No offers yet.",
      agreed: last ? [`Condition: ${last.terms.condition}`, `Shipping: ${last.terms.shipping}`] : [],
      open: last ? ["Final price", "Delivery date"] : [],
      next_step: last && last.status === "open" ? (last.by === v.viewerRole ? "Wait for the other side to respond." : "Accept, counter, or decline the latest offer.") : "Make the first offer.",
    },
  };
}

// ---------- suggest counter ----------

export type Suggestion = { price: string; delivery_date: string; rationale: string; message_draft: string; warnings: string[] };

export async function suggestCounter(v: RequestView, threadId?: string): Promise<AiResult<Suggestion>> {
  const ctx = context(v, threadId);
  const r = await ask(
    MODEL_SMART,
    `Suggest the ${v.viewerRole}'s next counter-offer. Stay inside your_private_limit if present (buyer: at or below it; seller: at or above it) and inside the max price. Do not mention the private limit in message_draft.\n${JSON.stringify(ctx)}\nJSON: {"price": "123.45", "delivery_date": "YYYY-MM-DD", "rationale": string, "message_draft": string, "warnings": string[]}`,
    (x) => {
      const o = x as Record<string, unknown>;
      return { price: str(o.price, 12).replace(/[^0-9.]/g, ""), delivery_date: str(o.delivery_date, 10), rationale: str(o.rationale), message_draft: str(o.message_draft), warnings: arr(o.warnings) };
    },
  );
  const t = v.threads.find((x) => x.id === threadId) ?? v.threads[0];
  const last = t?.offers.at(-1);
  // Enforce the private limit even if the model ignores it.
  const clamp = (cents: number) => {
    const lim = v.myLimitCents;
    if (lim === undefined) return Math.min(cents, v.budgetCents);
    return v.viewerRole === "buyer" ? Math.min(cents, lim, v.budgetCents) : Math.min(Math.max(cents, lim), v.budgetCents);
  };
  if (r) {
    const cents = Math.round(Number(r.data.price) * 100);
    if (Number.isFinite(cents) && cents > 0) r.data.price = (clamp(cents) / 100).toFixed(2);
    return r;
  }
  if (!last) return { source: "heuristic", data: { price: "", delivery_date: "", rationale: "No offer to counter yet.", message_draft: "", warnings: [] } };
  const mine = t!.offers.filter((o) => o.by === v.viewerRole).at(-1);
  const anchor = mine?.terms.priceCents ?? (v.viewerRole === "buyer" ? Math.round(last.terms.priceCents * 0.85) : v.budgetCents);
  const mid = clamp(Math.round((anchor + last.terms.priceCents) / 2 / 100) * 100);
  return {
    source: "heuristic",
    data: {
      price: (mid / 100).toFixed(2),
      delivery_date: last.terms.deliveryDate,
      rationale: `Splits the gap between ${usd(anchor)} and their ${usd(last.terms.priceCents)}${v.myLimitCents !== undefined ? ", kept inside your private limit" : ""}.`,
      message_draft: v.viewerRole === "buyer" ? `Thanks for the quick reply. I can do ${usd(mid)} with the same delivery date. Does that work for you?` : `I can come down to ${usd(mid)} and keep the delivery date. Happy to ship as soon as it's confirmed.`,
      warnings: last.isFinal ? ["Their offer is best-and-final: they can't be countered, only accepted or declined."] : [],
    },
  };
}

// ---------- risk check ----------

export type Risk = { flags: { field: string; severity: "low" | "medium" | "high"; explanation: string }[] };

export async function riskCheck(v: RequestView, threadId?: string): Promise<AiResult<Risk>> {
  const ctx = context(v, threadId);
  const r = await ask(MODEL_FAST, `Review the latest offer for risks to the ${v.viewerRole} (vague terms, missing warranty, late delivery vs needed_by, shipping extra, used condition when preferences say new, off-platform payment requests in chat).\n${JSON.stringify(ctx)}\nJSON: {"flags": [{"field": string, "severity": "low"|"medium"|"high", "explanation": string}]}`, (x) => {
    const o = x as Record<string, unknown>;
    const flags = Array.isArray(o.flags) ? o.flags : [];
    return {
      flags: flags.slice(0, 6).map((f) => {
        const g = f as Record<string, unknown>;
        const sev = ["low", "medium", "high"].includes(g.severity as string) ? (g.severity as "low") : "low";
        return { field: str(g.field, 40), severity: sev, explanation: str(g.explanation, 300) };
      }),
    };
  });
  if (r) return r;
  const t = v.threads.find((x) => x.id === threadId) ?? v.threads[0];
  const o = t?.offers.at(-1);
  const flags: Risk["flags"] = [];
  if (o) {
    if (o.terms.deliveryDate > v.neededBy) flags.push({ field: "Delivery", severity: "high", explanation: `Delivery ${o.terms.deliveryDate} is after the needed-by date ${v.neededBy}.` });
    if (!o.terms.warrantyMonths) flags.push({ field: "Warranty", severity: "medium", explanation: "No warranty. Rely on the inspection window to check the item." });
    if (o.terms.shipping === "extra") flags.push({ field: "Shipping", severity: "medium", explanation: "Shipping is billed separately; ask for the total before accepting." });
    if (o.terms.condition !== "new" && v.preferences.some((p) => /\bnew\b/i.test(p))) flags.push({ field: "Condition", severity: "high", explanation: `Offer is ${o.terms.condition}, but the request asks for new.` });
  }
  if (t?.messages.some((m) => m.flags.length)) flags.push({ field: "Chat", severity: "high", explanation: "Someone asked to move payment or contact off Clinch. Payments outside Clinch are not protected." });
  return { source: "heuristic", data: { flags } };
}

// ---------- matchmaker: connect a new request to the right sellers ----------

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);

export async function matchSellers(r: WantRequest, sellers: Party[]): Promise<Match[]> {
  const pool = sellers.filter((s) => s.paypalEmail);
  if (!pool.length) return [];
  const ai = await ask(
    MODEL_FAST,
    `Rank which sellers fit this wanted item. Score 0-100 (category fit, specialty in bio). Exclude clear non-fits (score < 40).
Item: ${r.title}
Details: ${r.description}
Category: ${r.category}
Sellers: ${JSON.stringify(pool.map((s) => ({ id: s.id, name: s.name, categories: s.categories, bio: s.bio })))}
JSON: {"matches": [{"id": string, "score": number, "reason": "max 15 words"}]}`,
    (x) => {
      const list = Array.isArray((x as { matches?: unknown }).matches) ? (x as { matches: unknown[] }).matches : [];
      return list
        .map((m) => m as Record<string, unknown>)
        .filter((m) => pool.some((s) => s.id === m.id))
        .map((m) => ({ sellerId: String(m.id), score: Math.max(0, Math.min(100, Math.round(Number(m.score) || 0))), reason: str(m.reason, 140), source: "ai" as const }))
        .filter((m) => m.score >= 40)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    },
  );
  if (ai && ai.data.length) return ai.data;
  const want = words(`${r.title} ${r.description} ${r.preferences.join(" ")}`);
  return pool
    .map((s) => {
      const inCat = s.categories.includes(r.category);
      const overlap = [...words(`${s.bio} ${s.categories.join(" ")}`)].filter((w) => want.has(w));
      const score = Math.min(99, (inCat ? 60 : 0) + overlap.length * 8);
      const reason = inCat
        ? `Sells ${r.category.toLowerCase()}${overlap.length ? `; bio mentions ${overlap.slice(0, 3).join(", ")}` : ""}.`
        : `Bio mentions ${overlap.slice(0, 3).join(", ")}.`;
      return { sellerId: s.id, score, reason, source: "heuristic" as const };
    })
    .filter((m) => m.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
