import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Freeze,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type Zoom = { at: number; until: number; x: number; y: number; scale: number };
type Callout = { at: number; text: string; seconds?: number };
type Seg = {
  type: "clip" | "card";
  kind?: "intro" | "outro" | "chapter";
  clip?: string;
  cropTop?: number;
  in?: number;
  out?: number;
  label?: string;
  heading?: string;
  sub?: string;
  chips?: string[];
  zooms?: Zoom[];
  callouts?: Callout[];
  narration?: string;
  from: number;
  frames: number;
  rate?: number;
  videoFrames?: number;
};
type Caption = { from: number; frames: number; words: string[] };
export type ClinchProps = {
  edit: { voice?: string; title?: string };
  timeline: { segments: Seg[]; durationInFrames: number; captions: Caption[] };
};

const FONT = '"Segoe UI Variable Display","Segoe UI",Inter,system-ui,sans-serif';
const C = { bg: "#05060b", ink: "#f4f5fb", mute: "#9aa0b8", violet: "#7c6cff", cyan: "#22d3ee", line: "rgba(255,255,255,0.10)" };
const GRAD = `linear-gradient(90deg, ${C.violet}, ${C.cyan})`;
const FRAME = { left: 80, top: 78, width: 1760, height: 962 };

export const Clinch: React.FC<ClinchProps> = ({ edit, timeline }) => {
  if (!timeline) return null;
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, color: C.ink }}>
      <Backdrop />
      {timeline.segments.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.frames} name={`${i + 1} ${s.label || s.heading || s.clip || s.type}`}>
          {s.type === "clip" ? <ClipSeg s={s} /> : <CardSeg s={s} />}
        </Sequence>
      ))}
      <TopBar segments={timeline.segments} />
      <Captions captions={timeline.captions} />
      <Progress total={timeline.durationInFrames} />
      {edit.voice ? <Audio src={staticFile(edit.voice)} /> : null}
    </AbsoluteFill>
  );
};

const Backdrop: React.FC = () => {
  const f = useCurrentFrame();
  const drift = (f / 30) * 6;
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 600px at ${20 + Math.sin(f / 90) * 4}% 10%, rgba(124,108,255,0.28), transparent 60%),
            radial-gradient(800px 600px at ${85 + Math.cos(f / 110) * 4}% 90%, rgba(34,211,238,0.18), transparent 60%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.25,
          backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          backgroundPosition: `${drift}px ${drift}px`,
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
    </AbsoluteFill>
  );
};

function zoomAt(zooms: Zoom[] | undefined, p: number, frames: number) {
  const ramp = Math.min(0.12, 14 / Math.max(1, frames)); // ~0.45 s ease in and out
  for (const z of zooms || []) {
    if (p < z.at || p > z.until) continue;
    const k = Math.min(
      interpolate(p, [z.at, z.at + ramp], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.33, 0, 0.2, 1) }),
      interpolate(p, [z.until - ramp, z.until], [1, 0], { extrapolateLeft: "clamp", easing: Easing.bezier(0.33, 0, 0.2, 1) }),
    );
    return { s: 1 + (Math.min(2.4, Math.max(1, z.scale)) - 1) * k, x: clamp01(z.x), y: clamp01(z.y) };
  }
  return { s: 1, x: 0.5, y: 0.5 };
}
const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5));

const ClipSeg: React.FC<{ s: Seg }> = ({ s }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 200 }, durationInFrames: 14 });
  const z = zoomAt(s.zooms, f / s.frames, s.frames);
  const vf = s.videoFrames ?? s.frames;
  const video = (
    <OffthreadVideo
      src={staticFile(`clips/${s.clip}`)}
      trimBefore={Math.round((s.in || 0) * fps)}
      playbackRate={s.rate || 1}
      muted
      style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
    />
  );
  return (
    <AbsoluteFill style={{ opacity: enter }}>
      <div
        style={{
          position: "absolute",
          ...FRAME,
          borderRadius: 22,
          overflow: "hidden",
          border: `1px solid ${C.line}`,
          boxShadow: "0 40px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(124,108,255,0.15)",
          transform: `scale(${0.965 + 0.035 * enter})`,
          background: "#000",
        }}
      >
        <div style={{ width: "100%", height: "100%", transform: `scale(${z.s})`, transformOrigin: `${z.x * 100}% ${z.y * 100}%` }}>
          <div style={{ width: "100%", height: "100%", transform: s.cropTop ? `scale(${1 / (1 - s.cropTop)})` : undefined, transformOrigin: "50% 100%" }}>
            {f < vf ? video : <Freeze frame={Math.max(0, vf - 1)}>{video}</Freeze>}
          </div>
        </div>
      </div>
      {(s.callouts || []).map((c, i) => (
        <CalloutPill key={i} c={c} segFrames={s.frames} index={i} />
      ))}
    </AbsoluteFill>
  );
};

const CalloutPill: React.FC<{ c: Callout; segFrames: number; index: number }> = ({ c, segFrames, index }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(clamp01(c.at) * segFrames);
  const len = Math.round((c.seconds ?? 2.8) * fps);
  if (f < start || f > start + len) return null;
  const t = f - start;
  const pop = spring({ frame: t, fps, config: { damping: 14, stiffness: 180 } });
  const out = interpolate(t, [len - 8, len], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        right: 120,
        top: 130 + index * 84,
        transform: `translateY(${(1 - pop) * -24}px) scale(${0.9 + 0.1 * pop})`,
        opacity: Math.min(pop, out),
        padding: "16px 26px",
        borderRadius: 999,
        background: "rgba(10,12,22,0.82)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(124,108,255,0.55)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.5), 0 0 40px rgba(124,108,255,0.25)",
        fontSize: 34,
        fontWeight: 650,
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span style={{ width: 14, height: 14, borderRadius: 99, background: GRAD, boxShadow: `0 0 18px ${C.cyan}` }} />
      {c.text}
    </div>
  );
};

const CardSeg: React.FC<{ s: Seg }> = ({ s }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = (s.heading || "").split(" ");
  const fadeOut = interpolate(f, [s.frames - 10, s.frames], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: fadeOut, textAlign: "center", padding: 120 }}>
      {s.kind !== "chapter" && (
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 32,
            background: GRAD,
            marginBottom: 40,
            transform: `scale(${spring({ frame: f, fps, config: { damping: 12 } })})`,
            boxShadow: "0 0 80px rgba(124,108,255,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
            fontWeight: 800,
          }}
        >
          C
        </div>
      )}
      <div style={{ fontSize: s.kind === "chapter" ? 96 : 120, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 28px" }}>
        {words.map((w, i) => {
          const p = spring({ frame: f - 4 - i * 4, fps, config: { damping: 16 } });
          return (
            <span key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px)`, display: "inline-block" }}>
              {i === words.length - 1 ? <span style={{ background: GRAD, WebkitBackgroundClip: "text", color: "transparent" }}>{w}</span> : w}
            </span>
          );
        })}
      </div>
      {s.sub && (
        <div style={{ marginTop: 34, fontSize: 44, color: C.mute, opacity: interpolate(f, [14, 30], [0, 1], { extrapolateRight: "clamp" }) }}>{s.sub}</div>
      )}
      {s.chips && (
        <div style={{ marginTop: 48, display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center" }}>
          {s.chips.map((c, i) => {
            const p = spring({ frame: f - 20 - i * 5, fps, config: { damping: 18 } });
            return (
              <span key={i} style={{ opacity: p, transform: `scale(${0.8 + 0.2 * p})`, padding: "12px 24px", borderRadius: 999, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.05)", fontSize: 30 }}>
                {c}
              </span>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};

const TopBar: React.FC<{ segments: Seg[] }> = ({ segments }) => {
  const f = useCurrentFrame();
  const seg = segments.find((s) => f >= s.from && f < s.from + s.frames);
  if (!seg || seg.type !== "clip") return null;
  const t = f - seg.from;
  const p = spring({ frame: t, fps: 30, config: { damping: 200 }, durationInFrames: 12 });
  return (
    <>
      {seg.label && (
        <div style={{ position: "absolute", left: 80, top: 20, opacity: p, transform: `translateX(${(1 - p) * -20}px)`, fontSize: 30, fontWeight: 650, display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ width: 10, height: 34, borderRadius: 6, background: GRAD }} />
          {seg.label}
        </div>
      )}
      <div style={{ position: "absolute", right: 80, top: 22, fontSize: 24, color: C.mute, display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ width: 10, height: 10, borderRadius: 99, background: C.cyan, boxShadow: `0 0 12px ${C.cyan}` }} />
        Live on clinchdeal.in · PayPal sandbox
      </div>
    </>
  );
};

const Captions: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cap = captions.find((c) => f >= c.from && f < c.from + c.frames);
  if (!cap) return null;
  const t = f - cap.from;
  const pop = spring({ frame: t, fps, config: { damping: 18, stiffness: 220 } });
  const active = Math.min(cap.words.length - 1, Math.floor((t / cap.frames) * cap.words.length));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 74, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          maxWidth: 1500,
          padding: "18px 34px",
          borderRadius: 22,
          background: "rgba(5,6,11,0.78)",
          backdropFilter: "blur(8px)",
          border: `1px solid ${C.line}`,
          fontSize: 50,
          fontWeight: 750,
          lineHeight: 1.2,
          textAlign: "center",
          transform: `translateY(${(1 - pop) * 16}px) scale(${0.96 + 0.04 * pop})`,
          opacity: pop,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {cap.words.map((w, i) => (
          <span key={i} style={{ marginRight: 14, color: i === active ? C.cyan : i < active ? C.ink : "rgba(244,245,251,0.55)" }}>
            {w}
          </span>
        ))}
      </div>
    </div>
  );
};

const Progress: React.FC<{ total: number }> = ({ total }) => {
  const f = useCurrentFrame();
  return <div style={{ position: "absolute", left: 0, bottom: 0, height: 6, width: `${(f / total) * 100}%`, background: GRAD }} />;
};
