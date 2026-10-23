// Checks the PayPal sandbox credentials in .env without printing any secret.
// Run: node --env-file-if-exists=.env scripts/check-setup.mjs

const { PAYPAL_ENV = "sandbox", PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;

if (PAYPAL_ENV !== "sandbox") {
  console.error(`PAYPAL_ENV is "${PAYPAL_ENV}"; this project only uses the sandbox.`);
  process.exit(1);
}
if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing in .env");
  process.exit(1);
}

const res = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
  method: "POST",
  headers: {
    Authorization: "Basic " + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64"),
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: "grant_type=client_credentials",
});
const body = await res.json();
if (!res.ok) {
  console.error(`PayPal sandbox auth FAILED: HTTP ${res.status} ${body.error ?? ""} ${body.error_description ?? ""}`);
  process.exit(1);
}

console.log(`PayPal sandbox auth OK (app ${body.app_id}, token valid ${body.expires_in}s)`);
const scopes = body.scope ?? "";
const features = {
  "Orders / Checkout": "payments/payment",
  Invoicing: "services/invoicing",
  Subscriptions: "services/subscriptions",
  Payouts: "payments/payouts",
  Webhooks: "applications/webhooks",
};
for (const [name, needle] of Object.entries(features)) {
  console.log(`  ${scopes.includes(needle) ? "yes" : "NO "}  ${name}`);
}
