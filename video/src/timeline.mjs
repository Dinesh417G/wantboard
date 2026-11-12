// Shared by the Remotion composition and tools/prep.mjs, so the burned-in captions and the .srt match.
// Input: edit.resolved.json (edit.json from Gemini, validated by prep.mjs).
// Each segment gets a share of the voice-over proportional to the length of its narration.

export const FPS = 30;
const CHARS_PER_SEC = 14.5; // speaking rate used when there is no voice-over yet
const MIN_SEG_SEC = 2.2;

const weight = (s) => Math.max(18, (s.narration || "").trim().length);

export function buildTimeline(edit) {
  const segs = edit.segments;
  const total = segs.reduce((a, s) => a + weight(s), 0);
  const voice = edit.voiceSeconds || 0;
  const tail = edit.tailSeconds ?? 1.2;
  let cursor = 0;
  const out = [];
  for (const s of segs) {
    let sec = voice > 0 ? (voice * weight(s)) / total : Math.max(MIN_SEG_SEC, weight(s) / CHARS_PER_SEC);
    if (s.minSeconds) sec = Math.max(sec, s.minSeconds);
    const frames = Math.max(Math.round(MIN_SEG_SEC * FPS), Math.round(sec * FPS));
    const seg = { ...s, from: cursor, frames, voiceFrames: frames };
    if (s.type === "clip") {
      const span = Math.max(0.2, s.out - s.in);
      // Speed the footage up or down to fit the narration; outside 0.6x-8x hold the last frame or cut.
      let rate = span / (frames / FPS);
      rate = Math.min(8, Math.max(0.6, rate));
      seg.rate = rate;
      seg.videoFrames = Math.min(frames, Math.floor((span / rate) * FPS));
    }
    out.push(seg);
    cursor += frames;
  }
  const last = out[out.length - 1];
  if (last) last.frames += Math.round(tail * FPS);
  const durationInFrames = out.reduce((a, s) => a + s.frames, 0);
  return { segments: out, durationInFrames, captions: buildCaptions(out) };
}

// Captions: sentence-aware chunks of at most 7 words, timed by character share inside each segment.
export function buildCaptions(segments) {
  const caps = [];
  for (const s of segments) {
    const text = (s.narration || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const chunks = [];
    for (const sentence of text.match(/[^.!?]+[.!?]*/g) || [text]) {
      const words = sentence.trim().split(" ").filter(Boolean);
      const n = Math.ceil(words.length / 7);
      const size = Math.ceil(words.length / n);
      for (let i = 0; i < words.length; i += size) chunks.push(words.slice(i, i + size));
    }
    const speakFrames = s.voiceFrames ?? s.frames;
    const chars = chunks.reduce((a, c) => a + c.join(" ").length + 1, 0);
    let t = s.from;
    for (const c of chunks) {
      const len = Math.max(1, Math.round((speakFrames * (c.join(" ").length + 1)) / chars));
      caps.push({ from: t, frames: len, words: c });
      t += len;
    }
  }
  return caps;
}

export function toSrt(captions, fps = FPS) {
  const ts = (f) => {
    const ms = Math.round((f / fps) * 1000);
    const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
    return `${h}:${m}:${s},${String(ms % 1000).padStart(3, "0")}`;
  };
  return captions.map((c, i) => `${i + 1}\n${ts(c.from)} --> ${ts(c.from + c.frames)}\n${c.words.join(" ")}\n`).join("\n");
}
