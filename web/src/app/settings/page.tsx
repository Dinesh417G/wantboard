import type { Metadata } from "next";
import { read } from "@/lib/store";
import { requireViewer } from "@/lib/viewer";
import { Card } from "@/components/ui";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

export default async function Settings() {
  const me = await requireViewer(await read(), "/settings");
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="text-xs uppercase tracking-wider text-brand-2">Settings</div>
      <h1 className="mt-1 text-4xl font-semibold tracking-tight">Your account</h1>
      {me.demo ? (
        <Card className="mt-8 p-6 text-sm text-muted">This is a shared demo account, so it can&apos;t be edited. Sign out and create your own account with your email.</Card>
      ) : (
        <SettingsForm
          me={{ name: me.name, city: me.city, bio: me.bio, role: me.role, paypalEmail: me.paypalEmail, categories: me.categories, email: me.email ?? "" }}
        />
      )}
    </div>
  );
}
