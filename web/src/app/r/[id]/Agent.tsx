"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import type { RequestView } from "@/lib/dto";
import { usd } from "@/lib/domain/money";
import { Badge, Button, Card, Input, cn } from "@/components/ui";

type Act = (action: string, payload?: unknown) => Promise<unknown>;
type Step = { tool: string; source: "paypal-agent-toolkit" | "clinch"; summary: string; ok: boolean };
type Turn = { role: "user" | "assistant"; content: string; steps?: Step[]; confirm?: { offerId: string; version: number; priceCents: number; seller: string } };

function suggestions(v: RequestView): string[] {
  const s: string[] = [];
  if (v.viewerRole === "buyer") {
    if (v.status === "open") s.push("What does PayPal show for my hold?", "Counter the latest offer 5% lower, politely", "Should I accept the latest offer?");
    if (["agreed", "shipped"].includes(v.status)) s.push("Is the tracking on my PayPal order?", "Any PayPal dispute on this deal?");
    if (v.status === "completed") s.push("Summarize what PayPal did in this deal");
  } else {
    if (v.status === "open") s.push("Draft and send an opening offer near the max price", "Answer the buyer's last message");
    if (v.status !== "open" && v.status !== "draft") s.push("Is the tracking on the PayPal order?", "Any PayPal dispute I need to answer?");
  }
  return s.slice(0, 3);
}

/** Chat with Clinch Agent: reads PayPal via the Agent Toolkit, acts on the deal, never moves money without you. */
export function Agent({ v, act, busy }: { v: RequestView; act: Act; busy: string | null }) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");

  async function ask(q: string) {
    const question = q.trim();
    if (!question || thinking) return;
    const next: Turn[] = [...turns, { role: "user", content: question }];
    setTurns(next);
    setText("");
    setThinking(true);
    setError("");
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: v.id, history: next.map(({ role, content }) => ({ role, content })) }),
    });
    const out = await res.json().catch(() => ({}));
    setThinking(false);
    if (!res.ok) return setError(out.error ?? "Clinch Agent is unavailable");
    setTurns([...next, { role: "assistant", content: out.reply, steps: out.steps, confirm: out.confirm }]);
    if (out.changed) router.refresh();
  }

  return (
    <Card className="edge p-5">
      <div className="flex items-center gap-2">
        <Bot className="size-4 text-brand-2" />
        <div className="font-medium">Clinch Agent</div>
        <Badge tone="paypal" className="ml-auto">
          PayPal Agent Toolkit
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted">Reads live PayPal data for this deal and acts for you. It never moves money: you confirm.</p>

      <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
        {turns.map((t, i) => (
          <div key={i} className={cn("rounded-xl p-3 text-sm", t.role === "user" ? "ml-6 bg-brand/15" : "mr-2 border border-line bg-white/[0.03]")}>
            {t.steps && t.steps.length > 0 && (
              <ul className="mb-2 space-y-1">
                {t.steps.map((s, j) => (
                  <li key={j} className="flex items-start gap-1.5 text-[11px] text-dim">
                    {s.ok ? <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-mint" /> : <XCircle className="mt-0.5 size-3 shrink-0 text-rose" />}
                    <span>
                      <span className={s.source === "paypal-agent-toolkit" ? "text-sky-200" : "text-violet-200"}>{s.source === "paypal-agent-toolkit" ? "PayPal" : "Clinch"}</span> · {s.summary}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="whitespace-pre-wrap">{t.content}</div>
            {t.confirm && v.status === "open" && (
              <Button variant="success" size="sm" className="mt-3" disabled={!!busy} onClick={() => act("accept", { offerId: t.confirm!.offerId, version: t.confirm!.version })}>
                {busy === "accept" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Confirm: accept v{t.confirm.version} · PayPal captures {usd(t.confirm.priceCents)}
              </Button>
            )}
          </div>
        ))}
        {thinking && (
          <div className="flex items-center gap-2 text-xs text-dim">
            <Loader2 className="size-3.5 animate-spin" /> working: reading PayPal and the deal…
          </div>
        )}
      </div>

      {turns.length === 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions(v).map((s) => (
            <button key={s} onClick={() => ask(s)} className="rounded-full border border-line px-2.5 py-1 text-left text-[11px] text-muted hover:text-fg">
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask or instruct the agent…" maxLength={800} />
        <Button type="submit" size="sm" disabled={thinking || !text.trim()} aria-label="Send">
          <Send className="size-4" />
        </Button>
      </form>
      {error && <p className="mt-2 text-xs text-rose-200">{error}</p>}
    </Card>
  );
}
