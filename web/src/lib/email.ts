// Transactional email through Resend's REST API. Server-only.
// Without RESEND_API_KEY: in development the message is printed to the server log; in production it is skipped.
import "server-only";
import { after } from "next/server";
import { SITE } from "./config/site";

/** Run after the response is sent, but keep the serverless function alive until it finishes. */
function background(task: () => Promise<unknown>) {
  try {
    after(task);
  } catch {
    void task(); // outside a request (scripts, tests)
  }
}

const FROM = process.env.EMAIL_FROM ?? `${SITE.name} <onboarding@resend.dev>`;
/** Clinch support inbox: gets admin alerts, a BCC of deal emails, and user replies. */
const ADMIN = process.env.ADMIN_NOTIFY_EMAIL || "";
export const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3007");

export const paypalRedirectUri = () => `${siteUrl()}/api/auth/paypal/callback`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#05060b;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#eef0f7">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0e1019;border:1px solid #23263a;border-radius:16px;padding:32px">
<tr><td style="font-size:18px;font-weight:700;padding-bottom:20px"><span style="display:inline-block;width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,#7c5cff,#22d3ee);vertical-align:-5px;margin-right:8px"></span>${SITE.name}</td></tr>
<tr><td style="font-size:20px;font-weight:600;padding-bottom:12px">${esc(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#c4c8d6">${bodyHtml}</td></tr>
${cta ? `<tr><td style="padding-top:24px"><a href="${cta.url}" style="display:inline-block;background:#7c5cff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${esc(cta.label)}</a></td></tr>` : ""}
<tr><td style="padding-top:28px;font-size:12px;color:#6b7286">${SITE.name} · PayPal sandbox demo. You get this email because you have an account on ${esc(siteUrl().replace(/^https?:\/\//, ""))}.</td></tr>
</table></td></tr></table></body></html>`;
}

type Opts = { bccAdmin?: boolean };

export async function sendEmail(
  to: string,
  subject: string,
  title: string,
  bodyHtml: string,
  cta?: { label: string; url: string },
  opts: Opts = {},
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") console.info(`[email:dev] to=${to} subject="${subject}"\n${bodyHtml.replace(/<[^>]+>/g, " ")}`);
    return { ok: false, error: "email not configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html: layout(title, bodyHtml, cta),
        ...(ADMIN ? { reply_to: ADMIN } : {}),
        ...(ADMIN && opts.bccAdmin && to.toLowerCase() !== ADMIN.toLowerCase() ? { bcc: [ADMIN] } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("[email] resend", res.status, out?.message);
      return { ok: false, error: out?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, id: out.id };
  } catch (e) {
    console.warn("[email] failed", (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}

export function codeEmail(to: string, code: string) {
  return sendEmail(
    to,
    `${code} is your ${SITE.name} sign-in code`,
    "Your sign-in code",
    `<div style="font-size:34px;font-weight:700;letter-spacing:8px;font-family:Menlo,Consolas,monospace;color:#fff;padding:8px 0 16px">${code}</div>
     It expires in 10 minutes. If you didn't ask for it, ignore this email: nobody can sign in without the code.`,
  );
}

/** Deal notifications. Best effort: never blocks or fails a deal action. */
export function notify(to: string | undefined, subject: string, text: string, requestId: string) {
  if (!to) return;
  background(() => sendEmail(to, subject, subject, esc(text), { label: "Open the deal room", url: `${siteUrl()}/r/${requestId}` }, { bccAdmin: true }));
}

/** Alert the Clinch support inbox (sign-ups, sign-ins, new requests). Never used for sign-in codes. */
export function adminAlert(subject: string, lines: Record<string, string | undefined>, link?: string) {
  if (!ADMIN) return;
  const rows = Object.entries(lines)
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="color:#6b7286;padding:2px 12px 2px 0">${esc(k)}</td><td>${esc(v!)}</td></tr>`)
    .join("");
  background(() => sendEmail(ADMIN, `[Clinch admin] ${subject}`, subject, `<table>${rows}</table>`, link ? { label: "Open", url: link } : undefined));
}
