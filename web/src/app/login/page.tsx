import type { Metadata } from "next";
import { read } from "@/lib/store";
import { viewerId, viewerIn, GUEST_ID } from "@/lib/viewer";
import { Aurora } from "@/components/chrome";
import { LoginFlow } from "./LoginFlow";
import { DemoPanel } from "./DemoPanel";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; step?: string }> }) {
  const { next, step } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const db = await read();
  const me = viewerIn(db, await viewerId());
  if (me.id !== GUEST_ID && step !== "profile") redirect(safeNext);
  const demos = db.parties.filter((p) => p.demo).map((p) => ({ id: p.id, name: p.name, role: p.role, city: p.city }));
  return (
    <div className="relative overflow-hidden">
      <Aurora />
      <div className="relative mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_340px]">
        <LoginFlow next={safeNext} />
        <DemoPanel demos={demos} next={safeNext} />
      </div>
    </div>
  );
}

