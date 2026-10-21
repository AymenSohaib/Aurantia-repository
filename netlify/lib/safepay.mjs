/*
  LESSON 9 — safepay.mjs: talking to the payment company.

  Safepay is a Pakistani payment gateway (cards + wallets). The flow is:
    1. We ask Safepay to open a payment "tracker" for Rs X  → it gives a token
    2. We send the customer to Safepay's secure page with that token
    3. The customer pays ON SAFEPAY'S PAGE (we never see card numbers)
    4. Safepay sends the customer back to us with a signature ("sig")
    5. We check the sig using our secret key. If it matches, it really
       came from Safepay, so we mark the order paid.

  Keys live in Netlify's "Environment variables" (never in this file):
    SAFEPAY_ENV            "sandbox" for testing, "production" for real money
    SAFEPAY_API_KEY        your public key (starts with sec_…)
    SAFEPAY_SECRET_KEY     your secret key (used to check the sig)
    SAFEPAY_WEBHOOK_SECRET the webhook secret from the Safepay dashboard

  NOTE: these endpoints follow Safepay's published integrations. Safepay
  updates its API from time to time, so confirm them in your Safepay
  dashboard's developer docs before switching to production.
*/
import { createHmac, timingSafeEqual } from "node:crypto";

const env = () => (process.env.SAFEPAY_ENV === "production" ? "production" : "sandbox");
const apiBase = () => (env() === "production" ? "https://api.getsafepay.com" : "https://sandbox.api.getsafepay.com");
const checkoutBase = () => (env() === "production" ? "https://www.getsafepay.com/components" : "https://sandbox.api.getsafepay.com/components");

export const safepayConfigured = () => Boolean(process.env.SAFEPAY_API_KEY && process.env.SAFEPAY_SECRET_KEY);

// Step 1: open a tracker for the amount
export async function createTracker(amount, currency = "PKR") {
  const res = await fetch(`${apiBase()}/order/v1/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client: process.env.SAFEPAY_API_KEY, amount, currency, environment: env() }),
  });
  const json = await res.json().catch(() => ({}));
  const token = json?.data?.token;
  if (!res.ok || !token) throw new Error(`Safepay didn't open a payment (${res.status})`);
  return token;
}

// Step 2: the link to Safepay's payment page
export function checkoutUrl({ token, orderId, redirectUrl, cancelUrl }) {
  const q = new URLSearchParams({
    env: env(),
    beacon: token,
    source: "custom",
    order_id: orderId,
    redirect_url: redirectUrl,
    cancel_url: cancelUrl,
  });
  return `${checkoutBase()}?${q}`;
}

// Compares two strings safely (so timing can't leak the secret)
function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// Step 5: is the "sig" Safepay sent back genuine?
export function verifyReturnSignature(tracker, sig) {
  if (!tracker || !sig || !process.env.SAFEPAY_SECRET_KEY) return false;
  const expected = createHmac("sha256", process.env.SAFEPAY_SECRET_KEY).update(tracker).digest("hex");
  return same(expected, sig);
}

// Webhooks (Safepay's server telling our server "payment done") are signed too
export function verifyWebhook(rawBody, signature) {
  if (!signature || !process.env.SAFEPAY_WEBHOOK_SECRET) return false;
  const expected = createHmac("sha512", process.env.SAFEPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  return same(expected, signature);
}
