"use client";

import type { ReactNode } from "react";
import { usePayPalScriptReducer } from "@paypal/react-paypal-js";

/**
 * Render inside <PayPalScriptProvider>. Shows "Loading PayPal…" while the SDK script loads and a message with a
 * reload button when it fails (blocked by an ad blocker, offline, PayPal down), instead of an empty white box.
 */
export function PayPalState({ children }: { children: ReactNode }) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();
  if (isRejected) {
    return (
      <div role="alert" className="space-y-2 text-sm text-rose-700">
        <p>PayPal could not load. Turn off any ad blocker or privacy shield for this page, check your connection, then reload.</p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50">
          Reload page
        </button>
      </div>
    );
  }
  return (
    <>
      {isPending && (
        <p role="status" className="py-2 text-center text-sm text-neutral-600">
          Loading PayPal…
        </p>
      )}
      {children}
    </>
  );
}
