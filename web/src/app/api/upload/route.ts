import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

/** Issues short-lived client tokens so the browser uploads photos straight to Vercel Blob. Images only, 5 MB max. */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  // Token requests must come from our own pages (Blob's completion callback has no Origin and is signed by Vercel).
  const origin = request.headers.get("origin");
  if (body.type === "blob.generate-client-token" && (!origin || new URL(origin).host !== new URL(request.url).host)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
