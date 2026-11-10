"use client";

import { useEffect, useState } from "react";
import { PayPalMessages, PayPalScriptProvider } from "@paypal/react-paypal-js";

/**
 * PayPal Pay Later message (e.g. "Pay in 4 interest-free payments of $X") for the max price being typed on /post.
 * Messages only: no buttons, so it never interferes with posting. Updates 600 ms after typing stops; hidden while
 * the price is empty. PayPal decides eligibility and wording for the amount.
 */
export function PayLaterLine({ clientId, cents }: { clientId: string; cents: number | null }) {
  const [amount, setAmount] = useState<number | null>(cents);
  useEffect(() => {
    const t = setTimeout(() => setAmount(cents), 600);
    return () => clearTimeout(t);
  }, [cents]);
  if (!clientId || !amount || amount <= 0) return null;
  return (
    <div className="mt-1.5 min-h-5">
      <PayPalScriptProvider options={{ clientId, currency: "USD", components: "messages", buyerCountry: "US", enableFunding: "paylater" }}>
        <PayPalMessages amount={amount / 100} placement="payment" style={{ layout: "text", logo: { type: "inline" }, text: { color: "white", size: 12 } }} />
      </PayPalScriptProvider>
    </div>
  );
}
