import Link from "next/link";
import { Handshake } from "lucide-react";
import { read } from "@/lib/store";
import { viewerId, viewerIn, GUEST_ID } from "@/lib/viewer";
import { SITE } from "@/lib/config/site";
import { PersonaSwitcher } from "./PersonaSwitcher";
import { MobileNav } from "./MobileNav";
import { NAV_LINKS } from "./nav-links";
export { StatusPill } from "./StatusPill";
import { Badge } from "./ui";

export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2">
      <span className="relative grid size-8 place-items-center rounded-xl bg-[linear-gradient(135deg,#7c5cff,#22d3ee)] shadow-[0_0_24px_-4px_rgb(124_92_255/0.8)]">
        <Handshake className="size-4.5 text-white" strokeWidth={2.2} />
      </span>
      <span className="text-[17px] font-semibold tracking-tight">{SITE.name}</span>
    </Link>
  );
}

export async function Header() {
  const db = await read();
  const me = viewerIn(db, await viewerId());
  const people = db.parties.filter((p) => p.demo).map((p) => ({ id: p.id, name: p.name, role: p.role, city: p.city, handle: p.handle, demo: true }));
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 text-sm md:flex">
          {NAV_LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-lg px-3 py-1.5 text-muted transition hover:bg-white/5 hover:text-fg">
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Badge tone="paypal" className="hidden sm:inline-flex">
            <span className="size-1.5 rounded-full bg-sky-300" /> PayPal sandbox
          </Badge>
          {me.id === GUEST_ID ? (
            <Link href="/login" className="rounded-xl bg-[linear-gradient(135deg,#7c5cff,#5b8cff_55%,#22d3ee)] px-4 py-2 text-sm font-medium text-white shadow-[0_8px_30px_-8px_rgb(124_92_255/0.7)] transition hover:brightness-110">
              Sign in
            </Link>
          ) : (
            <PersonaSwitcher me={{ id: me.id, name: me.name, role: me.role, city: me.city, handle: me.handle, demo: me.demo }} people={people} />
          )}
          <MobileNav />
        </div>
      </div>
    </header>
  );
}

export function Aurora({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="grid-bg absolute inset-0" />
      <div className="animate-aurora absolute -top-1/3 left-1/2 h-[70vh] w-[90vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(124_92_255/0.35),transparent)] blur-3xl" />
      <div className="animate-aurora absolute -top-1/4 right-[-10%] h-[50vh] w-[50vw] rounded-full bg-[radial-gradient(closest-side,rgb(34_211_238/0.22),transparent)] blur-3xl [animation-delay:-6s]" />
      <div className="animate-aurora absolute top-1/3 left-[-15%] h-[45vh] w-[45vw] rounded-full bg-[radial-gradient(closest-side,rgb(52_211_153/0.12),transparent)] blur-3xl [animation-delay:-11s]" />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 text-sm text-dim sm:flex-row sm:items-center sm:px-6">
        <Logo />
        <p className="sm:ml-6">Built for the PayPal AI Hackathon 2026. Runs on the PayPal sandbox: no real money moves.</p>
        <a href="https://github.com/Dinesh417G/wantboard" className="hover:text-fg sm:ml-auto">
          Source on GitHub
        </a>
      </div>
    </footer>
  );
}
