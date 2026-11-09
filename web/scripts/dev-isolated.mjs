#!/usr/bin/env node
// Throwaway test copy of Clinch for audits and attack tests. It NEVER touches live data.
//
//   node scripts/dev-isolated.mjs          start on http://localhost:3008 with fresh demo data
//   node scripts/dev-isolated.mjs --keep   start, keeping the existing test data
//   node scripts/dev-isolated.mjs --stop   stop it
//
// Differences from `npm run dev` (which reads and writes the LIVE Supabase database):
// - local JSON database: data/isolated.json (git-ignored), re-seeded with demo data on every start
// - no emails and no support-inbox alerts, no photo uploads, no PayPal webhook id
// - its own random session secret, so its cookies are useless on the live site
// - admin token for /api/reset is "isolated-admin"
// - build output in .next-isolated, so it can run next to the normal dev server
// PayPal calls still go to the PayPal SANDBOX and AI calls to the configured provider.
import { spawn, execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataFile = path.join(web, "data", "isolated.json");
const pidFile = path.join(web, "data", "isolated.pid");
const arg = process.argv[2];

if (arg === "--stop") {
  if (!fs.existsSync(pidFile)) {
    console.log("isolated Clinch is not running");
    process.exit(0);
  }
  const pid = fs.readFileSync(pidFile, "utf8").trim();
  try {
    if (process.platform === "win32") execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    else process.kill(-Number(pid), "SIGTERM");
  } catch {
    /* already gone */
  }
  fs.rmSync(pidFile, { force: true });
  console.log(`stopped isolated Clinch (pid ${pid})`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(dataFile), { recursive: true });
if (arg !== "--keep") fs.rmSync(dataFile, { force: true });

const env = {
  ...process.env,
  // Empty strings beat web/.env.local: Next never overwrites a variable that is already set.
  SUPABASE_URL: "",
  SUPABASE_PUBLISHABLE_KEY: "",
  APP_STATE_SECRET: "",
  RESEND_API_KEY: "",
  ADMIN_NOTIFY_EMAIL: "",
  BLOB_READ_WRITE_TOKEN: "",
  PAYPAL_WEBHOOK_ID: "",
  SESSION_SECRET: `isolated-${crypto.randomBytes(16).toString("hex")}`,
  ADMIN_TOKEN: "isolated-admin",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3008",
  CLINCH_DATA_FILE: dataFile,
  NEXT_DIST_DIR: ".next-isolated",
};

const child = spawn("npx", ["next", "dev", "-p", "3008"], {
  cwd: web,
  env,
  stdio: "inherit",
  shell: true,
  detached: process.platform !== "win32",
});
fs.writeFileSync(pidFile, String(child.pid));
console.log(`isolated Clinch starting on http://localhost:3008 (pid ${child.pid}, data ${path.relative(web, dataFile)})`);
child.on("exit", (code) => {
  fs.rmSync(pidFile, { force: true });
  process.exit(code ?? 0);
});
