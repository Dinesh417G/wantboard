"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";

export function ProCheckout({ clientId, planId, partyId }: { clientId: string; planId: string; partyId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <div>
      <div className="max-w-sm rounded-2xl bg-white p-3">
        <PayPalScriptProvider options={{ clientId, vault: true, intent: "subscription", components: "buttons" }}>
          <PayPalButtons
            style={{ layout: "vertical", shape: "pill", color: "gold", label: "subscribe" }}
            createSubscription={(_data, actions) => actions.subscription.create({ plan_id: planId, custom_id: partyId })}
            onApprove={async (data) => {
              const res = await fetch("/api/pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscriptionId: data.subscriptionID }) });
              const out = await res.json().catch(() => ({}));
              if (!res.ok) return setError(out.error ?? "Couldn't activate Pro");
              router.refresh();
            }}
            onError={(e) => setError(String(e?.message ?? "PayPal error"))}
          />
        </PayPalScriptProvider>
      </div>
      {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
    </div>
  );
}

export function CancelPro() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <Button
        variant="danger"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch("/api/pro", { method: "DELETE" });
          const out = await res.json().catch(() => ({}));
          setBusy(false);
          if (!res.ok) return setError(out.error ?? "Couldn't cancel");
          router.refresh();
        }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null} Cancel Clinch Pro
      </Button>
      {error && <p className="mt-2 text-sm text-rose-200">{error}</p>}
    </div>
  );
}
