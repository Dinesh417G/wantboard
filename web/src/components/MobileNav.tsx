"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "./nav-links";

/**
 * Menu for screens below the `md` breakpoint, where the desktop nav is hidden.
 * Renders the toggle button plus a panel that drops from the bottom edge of the (sticky) header.
 * Closes on link click, route change, Escape and a click outside.
 */
export function MobileNav() {
  const pathname = usePathname();
  // Remember the path the menu was opened on: a route change closes it without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenAt(null);
        btn.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpenAt(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => setOpenAt(open ? null : pathname)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="glass grid size-10 place-items-center rounded-xl text-muted transition hover:bg-white/10 hover:text-fg md:hidden"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      <div
        ref={panel}
        id="mobile-nav"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-line-strong bg-ink-900 px-4 pt-2 pb-4 shadow-2xl md:hidden"
      >
        <nav aria-label="Main" className="mx-auto flex max-w-7xl flex-col">
          {NAV_LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpenAt(null)}
              className="rounded-lg px-3 py-3 text-base text-muted transition hover:bg-white/5 hover:text-fg"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
