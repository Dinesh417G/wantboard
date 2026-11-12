// Validates public/edit.json (from Gemini), probes clips and the voice-over, writes:
//   public/edit.resolved.json  (what the video renders)
//   out/narration.txt          (paste into Gemini TTS)
//   out/clinch-demo.srt        (upload to YouTube as subtitles)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildTimeline, toSrt, FPS } from "../src/timeline.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const outDir = path.join(root, "out");
fs.mkdirSync(outDir, { recursive: true });
const ffprobe = path.join(root, "node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe");
const dur = (file) => {
  const s = execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim();
  return Number(s);
};

const editPath = path.join(pub, "edit.json");
if (!fs.existsSync(editPath)) {
  console.error("public/edit.json is missing. Run GEMINI.md prompt 1 and save its JSON there.");
  process.exit(2);
}
let raw = fs.readFileSync(editPath, "utf8").trim();
raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, ""); // tolerate a pasted code fence
let edit;
try {
  edit = JSON.parse(raw);
} catch (e) {
  console.error("edit.json is not valid JSON:", e.message);
  process.exit(2);
}
const errors = [];
const warn = [];
if (!Array.isArray(edit.segments) || !edit.segments.length) errors.push("segments[] missing");
for (const [i, s] of (edit.segments || []).entries()) {
  const tag = `segment ${i + 1}`;
  if (s.type !== "clip" && s.type !== "card") errors.push(`${tag}: type must be "clip" or "card"`);
  if (!s.narration) warn.push(`${tag}: no narration`);
  if (s.type === "clip") {
    const file = path.join(pub, "clips", s.clip || "");
    if (!s.clip || !fs.existsSync(file)) {
      errors.push(`${tag}: clip "${s.clip}" not found in public/clips`);
      continue;
    }
    const d = dur(file);
    s.in = Math.max(0, Number(s.in) || 0);
    s.out = Math.min(d - 0.05, Number(s.out) || d);
    if (s.out - s.in < 0.5) {
      warn.push(`${tag}: in/out leave <0.5 s, using the whole clip`);
      s.in = 0;
      s.out = d - 0.05;
    }
    s.zooms = (s.zooms || []).filter((z) => z && z.until > z.at).map((z) => ({ ...z, at: +z.at, until: +z.until, x: +z.x, y: +z.y, scale: +z.scale }));
    s.callouts = (s.callouts || []).filter((c) => c && c.text).map((c) => ({ ...c, at: +c.at || 0 }));
  }
}
if (errors.length) {
  console.error("edit.json problems:\n - " + errors.join("\n - "));
  process.exit(2);
}

const voice = ["voiceover.wav", "voiceover.mp3", "voiceover.m4a"].find((f) => fs.existsSync(path.join(pub, f)));
if (voice) {
  edit.voice = voice;
  edit.voiceSeconds = dur(path.join(pub, voice));
} else {
  delete edit.voice;
  edit.voiceSeconds = 0;
}

fs.writeFileSync(path.join(pub, "edit.resolved.json"), JSON.stringify(edit, null, 2));
const narration = edit.segments.map((s) => (s.narration || "").trim()).filter(Boolean).join("\n\n");
fs.writeFileSync(path.join(outDir, "narration.txt"), narration + "\n");
const tl = buildTimeline(edit);
fs.writeFileSync(path.join(outDir, "clinch-demo.srt"), toSrt(tl.captions));

const secs = tl.durationInFrames / FPS;
console.log(`voice-over: ${voice ? `${voice} (${edit.voiceSeconds.toFixed(1)} s)` : "none yet (timing estimated from text)"}`);
console.log(`narration: ${narration.split(/\s+/).length} words`);
console.log("segments:");
for (const [i, s] of tl.segments.entries()) {
  const extra = s.type === "clip" ? ` ${s.clip} ${s.in.toFixed(1)}-${s.out.toFixed(1)}s @${s.rate.toFixed(2)}x${s.videoFrames < s.frames - 2 ? " (holds last frame)" : ""}` : "";
  console.log(`  ${String(i + 1).padStart(2)}. ${(s.frames / FPS).toFixed(1).padStart(5)} s  ${s.type}${extra}  ${s.label || s.heading || ""}`);
  if (s.type === "clip" && s.rate >= 7.9) warn.push(`segment ${i + 1}: footage is sped up 8x and still cut short; tighten in/out`);
}
console.log(`TOTAL ${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, "0")}`);
if (secs > 178) warn.push(`total ${secs.toFixed(0)} s is over 2:58; Devpost judges stop at 3:00. Shorten the narration.`);
if (warn.length) console.log("warnings:\n - " + warn.join("\n - "));
