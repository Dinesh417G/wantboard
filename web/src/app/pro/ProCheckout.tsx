"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { Loader2 } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PayPalState } from "@/components/PayPalState";

export function ProCheckout({ clientId, planId, partyId }: { clientId: string; planId: string; partyId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <div>
      <div className="max-w-sm rounded-2xl bg-white p-3">
        {clientId ? (
          <PayPalScriptProvider options={{ clientId, vault: true, intent: "subscription", components: "buttons" }}>
            <PayPalState>
              <PayPalButtons
                style={{ layout: "vertical", shape: "pill", color: "gold", label: "subscribe" }}
                createSubscription={(_data, actions) => actions.subscription.create({ plan_id: planId, custom_id: partyId })}
                onApprove={async (data) => {
                  try {
                    const res = await fetch("/api/pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscriptionId: data.subscriptionID }) });
                    const out = await res.json().catch(() => ({}));
                    if (!res.ok) return setError(out.error ?? "Couldn't activate Pro");
                    router.refresh();
                  } catch {
                    setError("Network problem while activating Pro. Reload this page to check your status.");
                  }
                }}
                onError={(e) => setError(String(e?.message ?? "PayPal error"))}
              />
            </PayPalState>
          </PayPalScriptProvider>
        ) : (
          <p className="text-sm text-rose-700">Payments are temporarily unavailable.</p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}

export function CancelPro() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <ConfirmButton
        variant="danger"
        size="sm"
        disabled={busy}
        prompt="Cancel Clinch Pro? New deals go back to the standard fee."
        confirmLabel="Yes, cancel Pro"
        onConfirm={async () => {
          setBusy(true);
          setError("");
          try {
            const res = await fetch("/api/pro", { method: "DELETE" });
            const out = await res.json().catch(() => ({}));
            if (!res.ok) return setError(out.error ?? "Couldn't cancel");
            router.refresh();
          } catch {
            setError("Network problem. Check your connection and try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null} Cancel Clinch Pro
      </ConfirmButton>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}
