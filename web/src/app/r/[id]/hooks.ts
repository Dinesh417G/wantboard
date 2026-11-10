"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ActError = { text: string; action: string };

/** Which deal action failed, so the message can be shown next to the control that was used. */
const ActErrorContext = createContext<ActError>({ text: "", action: "" });
export const ActErrorProvider = ActErrorContext.Provider;

/** The last action error, but only when it came from one of `actions` (empty string otherwise). */
export function useActError(...actions: string[]) {
  const e = useContext(ActErrorContext);
  return e.text && actions.includes(e.action) ? e.text : "";
}

/** Call a deal action and refresh server data. */
export function useAct(requestId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<ActError>({ text: "", action: "" });
  const setError = useCallback((text: string, action = "") => setErr({ text, action }), []);
  const act = useCallback(
    async (action: string, payload: unknown = {}) => {
      setBusy(action);
      setErr({ text: "", action: "" });
      try {
        const res = await fetch(`/api/requests/${requestId}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErr({ text: out.error ?? `Failed (${res.status})`, action });
          return null;
        }
        router.refresh();
        return out;
      } catch {
        setErr({ text: "Network problem. Check your connection and try again.", action });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [requestId, router],
  );
  return { act, busy, error: err.text, errorAction: err.action, setError };
}

/** Current time, ticking. Starts null so server and client render the same markup. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function left(ms: number) {
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}
