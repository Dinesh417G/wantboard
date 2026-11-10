import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { gate } from "@/lib/ratelimit";

function sameOrigin(request: Request) {
  try {
    const origin = request.headers.get("origin");
    return !!origin && new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** Issues short-lived client tokens so the browser uploads photos straight to Vercel Blob. Images only, 5 MB max, signed-in accounts only. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "bad request" }, { status: 400 });
  // Blob's completion callback has no session or Origin; handleUpload verifies Vercel's signature on it.
  // Every other request is a token request: it must come from our own pages (Origin, defence in depth)
  // AND from a signed-in account (the real access control), limited per account (30 tokens / 10 min).
  if (body.type !== "blob.upload-completed") {
    if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const g = await gate("upload", 30);
    if ("deny" in g) return g.deny;
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("photos/")) throw new Error("bad path");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: 5 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
