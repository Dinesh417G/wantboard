"use client";

import { XCircle } from "lucide-react";
import { cn } from "@/components/ui";
import { useActError } from "./hooks";

/** Shows the last deal-action error next to the control that triggered it (only when it came from one of `actions`). */
export function ActionError({ actions, className }: { actions: string[]; className?: string }) {
  const text = useActError(...actions);
  if (!text) return null;
  return (
    <p className={cn("flex items-start gap-2 rounded-xl border border-rose/30 bg-rose/10 p-2.5 text-xs text-rose-100", className)}>
      <XCircle className="mt-0.5 size-3.5 shrink-0" /> <span className="min-w-0">{text}</span>
    </p>
  );
}
