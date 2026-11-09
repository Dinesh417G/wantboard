import type { Metadata } from "next";
import { read } from "@/lib/store";
import { viewerId, viewerIn } from "@/lib/viewer";
import { PostForm } from "./PostForm";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Post a need" };

export default async function PostPage() {
  const me = viewerIn(read(), await viewerId());
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="text-xs uppercase tracking-wider text-brand-2">New request</div>
      <h1 className="mt-1 text-4xl font-semibold tracking-tight">What do you need?</h1>
      <p className="mt-2 text-muted">Sellers in the category see it once PayPal is holding your max price. You only pay the price you accept.</p>
      {me.role === "buyer" ? (
        <PostForm buyerName={me.name} />
      ) : (
        <Card className="mt-8 p-6 text-sm text-muted">
          You&apos;re browsing as <span className="text-fg">{me.name}</span>, a seller. Switch to a buyer (top right) to post a request.
        </Card>
      )}
    </div>
  );
}
