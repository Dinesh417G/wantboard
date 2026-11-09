import { ImageResponse } from "next/og";
import { SITE } from "@/lib/config/site";

export const alt = `${SITE.name}: ${SITE.shortPitch}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "radial-gradient(circle at 30% 0%, #2a1f66 0%, #05060b 60%)",
          color: "#eef0f7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg,#7c5cff,#22d3ee)" }} />
          <div style={{ fontSize: 56, fontWeight: 700 }}>{SITE.name}</div>
        </div>
        <div style={{ marginTop: 48, fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 1000 }}>Name your need. Let sellers compete.</div>
        <div style={{ marginTop: 28, fontSize: 30, color: "#9aa1b5", maxWidth: 1000 }}>
          PayPal holds the budget. Versioned offers. Paid only after you inspect.
        </div>
      </div>
    ),
    size,
  );
}
