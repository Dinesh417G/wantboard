import { NextResponse } from "next/server";
import { codeMatches, cookieOpts, makeToken, normalizeEmail, sessionCookie, SIGNUP_COOKIE } from "@/lib/auth";
import { mutate, nowIso } from "@/lib/store";
import { adminAlert } from "@/lib/email";

/** Step 2: check the code. Existing account → signed in. New email → go to onboarding. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const email = normalizeEmail(b.email);
  const code = String(b.code ?? "").replace(/\D/g, "");
  if (!email || code.length !== 6) return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 });

  const result = await mutate((db) => {
    const now = nowIso();
    const live = (db.otps ?? []).filter((o) => o.email === email && o.expiresAt > now && o.attempts < 5);
    const latest = live.at(-1);
    if (!latest) return { error: "That code expired. Request a new one.", status: 400 } as const;
    if (!codeMatches(email, code, latest.hash)) {
      latest.attempts += 1;
      return { error: latest.attempts >= 5 ? "Too many wrong tries. Request a new code." : "Wrong code. Check the email and try again.", status: 400 } as const;
    }
    db.otps = (db.otps ?? []).filter((o) => o.email !== email); // codes are single-use
    const party = db.parties.find((p) => p.email === email);
    return { partyId: party?.id, name: party?.name, role: party?.role } as const;
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.partyId) {
    adminAlert(`Sign-in: ${result.name}`, { Name: result.name, Role: result.role, Email: email, Time: `${nowIso().slice(0, 16).replace("T", " ")} UTC`, IP: req.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined });
    const res = NextResponse.json({ ok: true, next: "signed-in" });
    res.cookies.set(sessionCookie(result.partyId));
    return res;
  }
  const res = NextResponse.json({ ok: true, next: "onboarding" });
  res.cookies.set({ name: SIGNUP_COOKIE, value: makeToken({ email }, 1800), ...cookieOpts(1800) });
  return res;
}
