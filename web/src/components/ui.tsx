import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const cn = (...v: ClassValue[]) => twMerge(clsx(v));

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "paypal";
const VARIANT: Record<Variant, string> = {
  primary:
    "bg-[linear-gradient(135deg,#7c5cff,#5b8cff_55%,#22d3ee)] text-white shadow-[0_8px_30px_-8px_rgb(124_92_255/0.7)] hover:brightness-110",
  secondary: "glass text-fg hover:bg-white/10",
  ghost: "text-muted hover:text-fg hover:bg-white/5",
  danger: "border border-rose/40 text-rose hover:bg-rose/10",
  success: "bg-mint text-ink-950 shadow-[0_8px_30px_-10px_rgb(52_211_153/0.8)] hover:brightness-110",
  paypal: "bg-paypal text-white hover:brightness-110",
};
const SIZE = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-base gap-2" };

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...p
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof SIZE }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...p}
    />
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: { href: string; variant?: Variant; size?: keyof typeof SIZE; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200", VARIANT[variant], SIZE[size], className)}
    >
      {children}
    </Link>
  );
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("glass rounded-2xl", className)} {...p} />;
}

export function Badge({ tone = "neutral", className, ...p }: ComponentProps<"span"> & { tone?: "neutral" | "brand" | "mint" | "amber" | "rose" | "cyan" | "paypal" }) {
  const t = {
    neutral: "bg-white/5 text-muted border-line",
    brand: "bg-brand/15 text-violet-200 border-brand/30",
    mint: "bg-mint/12 text-emerald-200 border-mint/30",
    amber: "bg-amber/12 text-amber-200 border-amber/30",
    rose: "bg-rose/12 text-rose-200 border-rose/30",
    cyan: "bg-brand-2/12 text-cyan-200 border-brand-2/30",
    paypal: "bg-paypal/15 text-sky-200 border-paypal/40",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", t, className)} {...p} />;
}

const field =
  "w-full rounded-xl border border-line bg-white/[0.03] px-3.5 py-2.5 text-sm text-fg placeholder:text-dim outline-none transition focus:border-brand/60 focus:bg-white/[0.05] focus:ring-4 focus:ring-brand/15";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cn(field, className)} {...p} />;
}
export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cn(field, "resize-none", className)} {...p} />;
}
export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={cn(field, "appearance-none bg-ink-800", className)} {...p} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-dim">{hint}</span>}
    </label>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1 text-xs text-muted", className)}>
      {children}
    </div>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-dim">{label}</div>
      <div className="num mt-0.5 text-lg font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
