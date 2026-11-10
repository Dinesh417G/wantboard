"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "./ui";

type ButtonProps = Omit<ComponentProps<typeof Button>, "onClick" | "children">;

/**
 * Two-step button for irreversible or money-moving actions. The first click swaps the button for an inline
 * "Are you sure?" with Confirm and Cancel (not window.confirm); only Confirm calls `onConfirm`.
 * Focus lands on Cancel, so a double click or a stray Enter cannot confirm. Escape cancels.
 */
export function ConfirmButton({
  onConfirm,
  prompt = "Are you sure?",
  confirmLabel = "Confirm",
  children,
  ...p
}: ButtonProps & { onConfirm: () => void; prompt?: ReactNode; confirmLabel?: ReactNode; children: ReactNode }) {
  const [armed, setArmed] = useState(false);
  if (!armed || p.disabled) {
    return (
      <Button {...p} onClick={() => setArmed(true)}>
        {children}
      </Button>
    );
  }
  return (
    <span
      role="group"
      aria-label="Confirm this action"
      className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-amber/30 bg-amber/10 p-1.5 pl-3"
      onKeyDown={(e) => {
        if (e.key === "Escape") setArmed(false);
      }}
    >
      <span className="text-xs text-amber-100">{prompt}</span>
      <Button
        {...p}
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      <Button variant="ghost" size={p.size} autoFocus onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </span>
  );
}
