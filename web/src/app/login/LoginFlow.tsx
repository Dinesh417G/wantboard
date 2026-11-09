"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, BadgeCheck, Loader2, Mail, ShoppingBag, Store } from "lucide-react";
import { CATEGORIES } from "@/lib/types";
import { Button, Card, Field, Input, Textarea, cn } from "@/components/ui";

type Step = "email" | "code" | "profile";

type Initial = { email: string; name: string; viaPayPal: boolean; verified: boolean };

/** PayPal's mark, simplified, for the "Continue with PayPal" button. */
function PayPalMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#003087" d="M8.3 21.5H4.6a.5.5 0 0 1-.5-.6L7 2.9a.7.7 0 0 1 .7-.6h6.6c3.4 0 5.6 1.8 5 5.2-.7 4-3.4 5.6-7 5.6h-1.8a.7.7 0 0 0-.7.6z" />
      <path fill="#009cde" d="M19.8 7.9c-.7 4-3.4 6.1-7 6.1h-1.4a.7.7 0 0 0-.7.6l-1 6.4a.5.5 0 0 0 .5.6h3a.6.6 0 0 0 .6-.5l.6-3.7a.6.6 0 0 1 .6-.5h.8c3 0 5.3-1.2 6-4.8.3-1.7 0-3.1-1-4.2z" />
    </svg>
  );
}

export function LoginFlow({ next, initial, initialError = "" }: { next: string; initial?: Initial; initialError?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initial ? "profile" : "email");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [note, setNote] = useState("");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [cats, setCats] = useState<string[]>([]);

  async function call(path: string, body: unknown) {
    setBusy(true);
    setError("");
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(out.error ?? "Something went wrong");
      return null;
    }
    return out;
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const out = await call("/api/auth/start", { email });
    if (out) {
      setStep("code");
      setNote(out.devNote ?? `We sent a 6-digit code to ${email}.`);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const out = await call("/api/auth/verify", { email, code });
    if (!out) return;
    if (out.next === "onboarding") setStep("profile");
    else {
      router.push(next);
      router.refresh();
    }
  }

  async function createProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const out = await call("/api/auth/profile", {
      name: fd.get("name"),
      city: fd.get("city"),
      bio: fd.get("bio"),
      paypalEmail: fd.get("paypalEmail"),
      role,
      categories: cats,
    });
    if (out) {
      router.push(role === "seller" ? "/dashboard" : next);
      router.refresh();
    }
  }

  return (
    <Card className="edge self-start p-8">
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
          {step === "email" && (
            <form onSubmit={sendCode} className="space-y-5">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Sign in or create an account</h1>
                <p className="mt-2 text-muted">No password. Use your PayPal account, or get a one-time code by email.</p>
              </div>
              <a
                href={`/api/auth/paypal/start?next=${encodeURIComponent(next)}`}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ffc439] font-semibold text-[#111] transition hover:brightness-95"
              >
                <PayPalMark /> Continue with PayPal
              </a>
              <p className="-mt-2 text-center text-xs text-dim">Recommended for sellers: payouts go straight to your verified PayPal account.</p>
              <div className="flex items-center gap-3 text-xs text-dim">
                <span className="h-px flex-1 bg-line" /> no PayPal? use your email <span className="h-px flex-1 bg-line" />
              </div>
              <Field label="Email">
                <Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Email me a code
              </Button>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={verify} className="space-y-5">
              <button type="button" onClick={() => setStep("email")} className="inline-flex items-center gap-1 text-xs text-dim hover:text-fg">
                <ArrowLeft className="size-3.5" /> change email
              </button>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Check your inbox</h1>
                <p className="mt-2 text-muted">{note}</p>
              </div>
              <Field label="6-digit code" hint="Expires in 10 minutes. Check spam if it's not there.">
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="num text-center text-2xl tracking-[0.5em]"
                  placeholder="••••••"
                />
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={busy || code.length !== 6}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} Continue
              </Button>
              <button type="button" onClick={() => sendCode()} disabled={busy} className="w-full text-center text-xs text-dim hover:text-fg">
                Send a new code
              </button>
            </form>
          )}

          {step === "profile" && (
            <form onSubmit={createProfile} className="space-y-5">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Set up your account</h1>
                <p className="mt-2 text-muted">{email}</p>
                {initial?.viaPayPal && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs text-sky-200">
                    <BadgeCheck className="size-3.5" /> PayPal connected{initial.verified ? " · verified account" : ""}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["buyer", ShoppingBag, "I want to buy", "Post needs, compare offers"],
                    ["seller", Store, "I want to sell", "Get matched, send offers"],
                  ] as const
                ).map(([r, Icon, t, d]) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn("rounded-2xl border p-4 text-left transition", role === r ? "border-brand/60 bg-brand/[0.1]" : "border-line hover:bg-white/[0.04]")}
                  >
                    <Icon className="size-5 text-violet-200" />
                    <div className="mt-2 font-medium">{t}</div>
                    <div className="text-xs text-muted">{d}</div>
                  </button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={role === "seller" ? "Shop name" : "Your name"}>
                  <Input name="name" required maxLength={60} defaultValue={initial?.name} />
                </Field>
                <Field label="City, state">
                  <Input name="city" required maxLength={60} placeholder="Austin, TX" />
                </Field>
              </div>
              {initial?.viaPayPal ? (
                <p className="text-sm text-muted">Payouts go to the PayPal account you just connected. You can change this later in Settings.</p>
              ) : (
                <Field label="PayPal email" hint={role === "seller" ? "Where you get paid (PayPal sandbox account during the demo)." : "Optional for buyers."}>
                  <Input name="paypalEmail" type="email" required={role === "seller"} defaultValue={email} />
                </Field>
              )}
              {role === "seller" && (
                <fieldset>
                  <legend className="text-xs font-medium uppercase tracking-wider text-muted">What you sell</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))}
                        className={cn("rounded-full border px-3 py-1.5 text-xs transition", cats.includes(c) ? "border-brand/50 bg-brand/15 text-violet-100" : "border-line text-muted hover:text-fg")}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              <Field label="About you" hint="Shown on your public trust profile.">
                <Textarea name="bio" rows={2} maxLength={300} placeholder={role === "seller" ? "What you specialize in, how you ship…" : "What you usually look for…"} />
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} Create account
              </Button>
            </form>
          )}
        </motion.div>
      </AnimatePresence>
      {error && <p className="mt-4 rounded-xl border border-rose/30 bg-rose/10 p-3 text-sm text-rose-200">{error}</p>}
    </Card>
  );
}
