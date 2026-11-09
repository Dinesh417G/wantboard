import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WantBoard",
  description: "Post what you need, lock your budget with PayPal, let sellers compete.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} antialiased bg-slate-50 text-slate-900 min-h-screen`}>
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Want<span className="text-blue-600">Board</span>
            </Link>
            <Link href="/" className="hover:text-blue-600">Board</Link>
            <Link href="/post" className="hover:text-blue-600">Post a request</Link>
            <Link href="/sellers" className="hover:text-blue-600">Sellers</Link>
            <span className="ml-auto rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">PayPal sandbox</span>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
