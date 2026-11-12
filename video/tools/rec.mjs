// Automated, high-quality screen recordings of clinchdeal.in for the demo video.
// Headless Chrome at 1920x1080, CDP screencast (JPEG q90) -> constant 30 fps H.264, with a drawn cursor and
// click ripples so viewers can follow the action.  Usage: node tools/rec.mjs <scene> [<scene> ...]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "public", "clips");
const TMP = path.join(root, "out", "frames");
const FFMPEG = path.join(root, "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe");
const B = "https://clinchdeal.in";
const COBOT = "req_a1b16f0e08";
const DESK = "C:/Users/work/OneDrive/Desktop";
const PHOTO_COBOT = `${DESK}/CR605-Cobot-Robot.jpg`;
const PHOTO_CAR = `${DESK}/the-front-part-of-the-damaged-car-as-a-result-of-the-accident-at-the-pole-car-accident-insurance-free-photo.jpg`;
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25, colorScheme: "dark" });
await ctx.addInitScript(() => {
  if (window.top !== window) return;
  const install = () => {
    if (document.getElementById("__cur")) return;
    const st = document.createElement("style");
    st.textContent = "::-webkit-scrollbar{display:none} html{scrollbar-width:none} div.min-h-5 iframe{visibility:hidden!important}";
    document.head.appendChild(st);
    const c = document.createElement("div");
    c.id = "__cur";
    c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2l15 8.5-6.5 1.8L9.6 19z" fill="white" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none", filter: "drop-shadow(0 3px 5px rgba(0,0,0,.7))" });
    const p = JSON.parse(sessionStorage.getItem("__cur") || "[1200,560]");
    c.style.transform = `translate(${p[0] - 4}px,${p[1] - 2}px)`;
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => {
      c.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 2}px)`;
      sessionStorage.setItem("__cur", JSON.stringify([e.clientX, e.clientY]));
    }, true);
    addEventListener("mousedown", (e) => {
      const r = document.createElement("div");
      Object.assign(r.style, { position: "fixed", left: e.clientX - 20 + "px", top: e.clientY - 20 + "px", width: "40px", height: "40px", borderRadius: "50%", border: "3px solid #22d3ee", background: "rgba(34,211,238,.18)", zIndex: "2147483646", pointerEvents: "none", transition: "transform .5s ease-out, opacity .5s ease-out" });
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = "scale(1.9)"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 600);
    }, true);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
});
const page = await ctx.newPage();
const W = (ms) => page.waitForTimeout(ms);
let cur = { x: 1200, y: 560 };

async function as(persona) {
  const r = await ctx.request.post(B + "/api/persona", { data: { id: persona } });
  if (!r.ok()) throw new Error("persona " + persona + " " + r.status());
}
async function go(p) {
  await page.goto(B + p, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await W(800);
}
async function moveTo(x, y, steps = 28) {
  await page.mouse.move(x, y, { steps });
  cur = { x, y };
}
async function hover(loc) {
  await loc.scrollIntoViewIfNeeded();
  await W(250);
  const b = await loc.boundingBox();
  if (!b) throw new Error("no box for " + loc);
  await moveTo(b.x + b.width / 2, b.y + b.height / 2);
  await W(250);
  return b;
}
async function click(loc) {
  const b = await hover(loc);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await W(350);
}
async function type(loc, text, delay = 24) {
  await click(loc);
  await page.keyboard.press("Control+A");
  await page.keyboard.type(text, { delay });
  await W(250);
}
const field = (label) => page.locator("label", { hasText: label }).locator("input, textarea, select").first();
async function smoothTo(loc, block = "center") {
  await loc.evaluate((el, b) => el.scrollIntoView({ behavior: "smooth", block: b }), block);
  await W(1100);
}
async function scrollBy(dy) {
  await page.evaluate((d) => window.scrollBy({ top: d, behavior: "smooth" }), dy);
  await W(1100);
}
async function waitText(re, timeout = 60000) {
  await page.waitForFunction((src) => new RegExp(src, "i").test(document.body.innerText), re.source, { timeout });
}

// --- screencast recorder ---
async function record(name, fn) {
  const s = await ctx.newCDPSession(page);
  const dir = path.join(TMP, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  s.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const f = path.join(dir, String(frames.length).padStart(5, "0") + ".jpg");
    fs.writeFileSync(f, Buffer.from(data, "base64"));
    frames.push({ f, t: metadata.timestamp });
    s.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await s.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  // nudge a repaint so the first frame arrives immediately
  await page.mouse.move(cur.x + 1, cur.y);
  await page.mouse.move(cur.x, cur.y);
  let err = null;
  try {
    await fn();
  } catch (e) {
    err = e;
  }
  await W(600);
  const end = Date.now() / 1000;
  await s.send("Page.stopScreencast").catch(() => {});
  await s.detach().catch(() => {});
  if (frames.length) {
    const list = frames.map((fr, i) => {
      const next = i + 1 < frames.length ? frames[i + 1].t : Math.max(end, fr.t + 0.04);
      return `file '${fr.f.replace(/'/g, "'\\''")}'\nduration ${Math.max(0.001, next - fr.t).toFixed(4)}`;
    });
    list.push(`file '${frames[frames.length - 1].f}'`);
    const lf = path.join(dir, "list.txt");
    fs.writeFileSync(lf, list.join("\n"));
    const out = path.join(OUT, name + ".mp4");
    execFileSync(FFMPEG, ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lf, "-fps_mode", "cfr", "-r", "30", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "17", "-preset", "veryfast", out]);
    const dur = frames.length ? (end - frames[0].t).toFixed(1) : 0;
    console.log(`clip ${name}.mp4  ${frames.length} frames  ~${dur}s${err ? "  (ended with error)" : ""}`);
  }
  await page.screenshot({ path: path.join(TMP, name + "-end.jpg") });
  if (err) throw err;
}

// --- scenes ---
const scenes = {
  async home() {
    await as("p_jordan");
    await go("/");
    await record("s01-home", async () => {
      await W(3500);
      await moveTo(700, 760);
      await W(600);
      await scrollBy(820);
      await W(1500);
      await scrollBy(800);
      await W(1500);
    });
  },
  async postCobot() {
    await as("p_jordan");
    await go("/post");
    await record("s02-post-cobot", async () => {
      await W(800);
      await type(page.getByPlaceholder(/Autolite/), "Small 6-axis cobot arm for pick-and-place");
      await type(page.getByPlaceholder(/Model or part number/), "Need a small collaborative robot arm to pick and place components at our CNC cell. 6-axis, light payload, quick to set up. Refurbished is fine.", 12);
      await page.locator('input[type="file"]').setInputFiles(PHOTO_COBOT);
      await W(2500);
      await click(page.getByRole("button", { name: /Suggest with AI/ }));
      await waitText(/AI suggestion/, 45000).catch(() => {});
      await W(2500);
      await type(page.getByPlaceholder(/New only/), "Easy setup and teach mode\nInstallation guide or demo video", 18);
      const d = page.locator('input[name="neededBy"]');
      await smoothTo(d);
      await d.fill("2026-11-27");
      await type(page.locator('input[name="budget"]'), "450", 90);
      await type(page.locator('input[name="target"]'), "400", 90);
      await W(1500);
      await hover(page.getByRole("button", { name: /Continue to PayPal/ }));
      await W(2500);
    });
  },
  async postCar() {
    await as("p_jordan");
    await go("/post");
    await record("s06-post-car", async () => {
      await W(600);
      await type(page.getByPlaceholder(/Autolite/), "Front-end crash repair for white Audi A3 sedan");
      await type(page.getByPlaceholder(/Model or part number/), "Hit a pole. Right headlight, bumper cover, grille, hood and right fender need replacing. OEM or OEM-quality parts, painted to match.", 12);
      await page.locator('input[type="file"]').setInputFiles(PHOTO_CAR);
      await W(2500);
      await click(page.getByRole("button", { name: /Suggest with AI/ }));
      await waitText(/AI suggestion/, 45000).catch(() => {});
      await W(2500);
      await type(page.getByPlaceholder(/New only/), "OEM or OEM-quality parts\nPaint matched", 18);
      const d = page.locator('input[name="neededBy"]');
      await smoothTo(d);
      await d.fill("2026-11-24");
      await type(page.locator('input[name="budget"]'), "1500", 90);
      await type(page.locator('input[name="target"]'), "1200", 90);
      await W(800);
      await click(page.getByRole("button", { name: /Continue to PayPal/ }));
      await page.waitForURL(/\/r\/req_/, { timeout: 60000 });
      await W(5000);
      await scrollBy(250);
      await W(3000);
    });
    console.log("car request:", page.url());
  },
  async dealBuyer() {
    // Jordan: hold + AI matches + Relic's offer, then copilot risk check, suggest counter, counter, agent.
    await as("p_jordan");
    await go("/r/" + COBOT);
    await record("s04-deal-buyer", async () => {
      await W(2500);
      await smoothTo(page.getByText("Copilot matched these sellers", { exact: false }).first());
      await W(2000);
      await smoothTo(page.getByText("Offers", { exact: true }).first(), "start");
      await W(2500);
    });
    await record("s07-copilot", async () => {
      await click(page.getByRole("button", { name: /Risk check/ }));
      await page.waitForFunction(() => /AI-generated|heuristic/i.test(document.querySelector("body").innerText), null, { timeout: 60000 });
      await W(4500);
      await click(page.getByRole("button", { name: /Suggest counter/ }));
      await W(9000);
    });
  },
  async agent() {
    await as("p_jordan");
    await go("/r/" + COBOT);
    await record("s09-agent", async () => {
      const box = page.getByPlaceholder("Ask or instruct the agent…");
      await smoothTo(box);
      await type(box, "What does PayPal show for my hold?", 35);
      await click(page.getByRole("button", { name: "Send" }).first());
      await waitText(/PAYPAL|authoriz/, 90000).catch(() => {});
      await W(9000);
    });
  },
  async sellerChat() {
    await as("p_relic");
    await go("/dashboard");
    await record("s10-seller-chat", async () => {
      await W(2500);
      await click(page.getByText("Small 6-axis cobot", { exact: false }).first());
      await page.waitForURL(/\/r\/req_/);
      await W(2000);
      const chat = page.getByPlaceholder("Ask about condition, photos, shipping…");
      await smoothTo(chat);
      await type(chat, "I can do 380 if you pay me on Zelle instead", 30);
      await page.keyboard.press("Enter");
      await W(4500);
    });
  },
  async accept() {
    await as("p_jordan");
    await go("/r/" + COBOT);
    await record("s11-accept", async () => {
      await W(1500);
      await smoothTo(page.getByText("Scam shield", { exact: false }).first());
      await W(2500);
      const acc = page.getByRole("button", { name: /Accept v\d+ & sign/ }).first();
      await smoothTo(acc);
      await W(1500);
      await click(acc);
      await click(page.getByRole("button", { name: /Yes, accept v/ }));
      await waitText(/Agreement v\d/, 90000);
      await W(2500);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      await W(2500);
      await smoothTo(page.getByText("Money trail", { exact: true }).first(), "start");
      await W(3000);
    });
  },
  async ship() {
    await as("p_relic");
    await go("/r/" + COBOT);
    await record("s12-ship", async () => {
      await W(1200);
      const sel = field("Carrier");
      await smoothTo(sel);
      await click(sel);
      await sel.selectOption("UPS");
      await type(field("Tracking number"), "1Z999AA10123456784", 40);
      await type(field("Delivery note"), "Packed in the original foam, guide in the box", 20);
      await click(page.getByRole("button", { name: /Mark shipped/ }));
      await W(4000);
    });
  },
  async release() {
    await as("p_jordan");
    await go("/r/" + COBOT);
    await record("s13-release", async () => {
      await W(1200);
      const btn = page.getByRole("button", { name: /Accept & pay seller/ });
      await smoothTo(btn);
      await W(1500);
      await click(btn);
      await click(page.getByRole("button", { name: /Yes, pay seller/ }));
      await waitText(/Payouts sent|payout/i, 90000).catch(() => {});
      await W(3000);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      await W(2000);
      await smoothTo(page.getByText("Money trail", { exact: true }).first(), "start");
      await W(3500);
      await scrollBy(450);
      await W(3000);
    });
  },
  async trust() {
    await as("p_jordan");
    await go("/u/relic-rarity");
    await record("s14-trust", async () => {
      await W(3500);
      await scrollBy(350);
      await W(2500);
    });
  },
};

for (const name of process.argv.slice(2)) {
  if (!scenes[name]) throw new Error("unknown scene " + name);
  console.log("== " + name);
  await scenes[name]();
}
await browser.close();
