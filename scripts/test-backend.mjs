/*
  LESSON 16 — a test you can run yourself:  npm test
  It pretends to be the internet (fake Safepay, fake email, fake WhatsApp)
  and walks a few orders through the server code to check nothing is broken.
*/
import { mock } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";

// Fake order storage (instead of Netlify Blobs)
const drawer = new Map();
mock.module("@netlify/blobs", { namedExports: { getStore: () => ({
  setJSON: async (k, v) => drawer.set(k, JSON.stringify(v)),
  set: async (k, v) => drawer.set(k, v),
  get: async (k, o) => (drawer.has(k) ? (o?.type === "json" ? JSON.parse(drawer.get(k)) : drawer.get(k)) : null),
}) } });

// Fake internet
const sent = [];
let storeOverride = {};
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.endsWith("/data/store.json")) return new Response(JSON.stringify({ ...JSON.parse(await readFile("data/store.json", "utf8")), ...storeOverride }));
  if (url.endsWith("/product.html")) return new Response(await readFile("product.html"));
  if (url.endsWith("/data/products.json")) return new Response(await readFile("data/products.json"));
  if (url.includes("/order/v1/init")) return Response.json({ data: { token: "track_test123" } });
  sent.push({ url, body: JSON.parse(opts.body) });
  return Response.json({ ok: true });
};
Object.assign(process.env, {
  SAFEPAY_API_KEY: "sec_test", SAFEPAY_SECRET_KEY: "shh", SAFEPAY_WEBHOOK_SECRET: "hook",
  RESEND_API_KEY: "re_test", EMAIL_FROM: "Aurantia <orders@example.com>", OWNER_EMAIL: "owner@example.com",
  WHATSAPP_TOKEN: "wa", WHATSAPP_PHONE_ID: "123", WHATSAPP_TEMPLATE: "order_confirmation",
});

const createOrder = (await import("../netlify/functions/create-order.mjs")).default;
const paymentReturn = (await import("../netlify/functions/payment-return.mjs")).default;
const webhook = (await import("../netlify/functions/safepay-webhook.mjs")).default;
const status = (await import("../netlify/functions/order-status.mjs")).default;

const post = (body) => createOrder(new Request("https://shop.test/api/create-order", { method: "POST", body: JSON.stringify(body) }));
const customer = { name: "Ayesha Khan", email: "ayesha@example.com", phone: "0300 1234567", address: "House 12, Street 4", city: "Lahore" };

// 1. Cash on delivery: price comes from the server, not the browser
let res = await post({ method: "cod", customer, items: [{ id: "onyx-statement-set", qty: 2, price: 1 }] });
let out = await res.json();
assert.equal(res.status, 200, JSON.stringify(out));
let order = JSON.parse(drawer.get(out.orderId));
assert.equal(order.subtotal, 4800); assert.equal(order.delivery, 250); assert.equal(order.total, 5050);
assert.equal(sent.length, 3, "customer email + owner email + WhatsApp");
assert.equal(sent[2].body.to, "923001234567");
console.log("✓ COD order", out.orderId, "total", order.total, "— 2 emails + 1 WhatsApp sent");

// 2. Free delivery over Rs 5,000
res = await post({ method: "cod", customer, items: [{ id: "onyx-statement-set", qty: 2 }, { id: "red-bloom-studs", qty: 1 }] });
order = JSON.parse(drawer.get((await res.json()).orderId));
assert.equal(order.delivery, 0); console.log("✓ free delivery at", order.subtotal);

// 3. Bad input is refused politely
res = await post({ method: "cod", customer: { ...customer, phone: "12345" }, items: [{ id: "amber-honey-studs", qty: 1 }] });
assert.equal(res.status, 400); console.log("✓ bad phone refused:", (await res.json()).error);
res = await post({ method: "cod", customer, items: [{ id: "not-a-product", qty: 1 }] });
assert.equal(res.status, 400); console.log("✓ unknown product refused");
res = await post({ method: "cod", customer, items: [{ id: "onyx-statement-set", qty: 6 }] });
assert.equal(res.status, 400); console.log("✓ over-stock refused:", (await res.json()).error);

// 4. Online payment: redirect → signed return → paid + notified once
sent.length = 0;
res = await post({ method: "online", customer, items: [{ id: "champagne-pearl-drops", qty: 1 }] });
out = await res.json();
assert.match(out.redirect, /beacon=track_test123/);
assert.equal(sent.length, 0, "nothing sent before payment");
console.log("✓ online order sends customer to Safepay");

const forged = await paymentReturn(new Request("https://shop.test/api/payment-return", { method: "POST", body: new URLSearchParams({ order_id: out.orderId, tracker: "track_test123", sig: "fake" }) }));
assert.match(forged.headers.get("location"), /m=review/);
console.log("✓ fake signature is NOT marked paid");

const sig = createHmac("sha256", "shh").update("track_test123").digest("hex");
const ok = await paymentReturn(new Request("https://shop.test/api/payment-return", { method: "POST", body: new URLSearchParams({ order_id: out.orderId, tracker: "track_test123", sig, reference: "R1" }) }));
assert.match(ok.headers.get("location"), /m=online/);
assert.equal(JSON.parse(drawer.get(out.orderId)).status, "paid");
assert.equal(sent.length, 3);
console.log("✓ genuine signature → paid, confirmations sent");

// webhook arriving later must not send duplicates
const raw = JSON.stringify({ notification: { tracker: "track_test123", state: "PAID", amount: "1450.00" } });
const wh = await webhook(new Request("https://shop.test/api/safepay-webhook", { method: "POST", body: raw, headers: { "x-sfpy-signature": createHmac("sha512", "hook").update(raw).digest("hex") } }));
assert.equal(wh.status, 200); assert.equal(sent.length, 3);
console.log("✓ webhook accepted, no duplicate messages");

// 5. Thank-you page summary hides private details
const st = await (await status(new Request(`https://shop.test/api/order-status?id=${out.orderId}`))).json();
assert.equal(st.firstName, "Ayesha"); assert.equal(st.phone, undefined); assert.equal(st.status, "paid");
console.log("✓ order-status shows first name only");
// 6. Optional reward: free delivery when paying online
const bundled = await (await import("../netlify/lib/catalog.mjs")).loadSettings();
bundled.prepaidFreeDelivery = true;
res = await post({ method: "online", customer: { ...customer, gift: true, giftNote: "Happy birthday!" }, items: [{ id: "red-bloom-studs", qty: 1 }] });
out = await res.json();
order = JSON.parse(drawer.get(out.orderId));
assert.equal(order.delivery, 0); assert.equal(order.customer.giftNote, "Happy birthday!");
console.log("✓ prepaid free delivery + gift note");
bundled.prepaidFreeDelivery = false;

// 7. Short share links: preview tags + forward to the product page
const productPage = (await import("../netlify/functions/product-page.mjs")).default;
const html = await (await productPage(new Request("https://shop.test/p/champagne-pearl-drops"), { params: { id: "champagne-pearl-drops" } })).text();
assert.match(html, /<title>Champagne Pearl Drops · Aurantia<\/title>/);
assert.match(html, /og:image" content="https:\/\/shop.test\/images\/products\/champagne-pearl-drops-1.jpg"/);
assert.match(html, /product\.html\?id=champagne-pearl-drops/);
console.log("✓ /p/champagne-pearl-drops shows a photo preview and opens the product page");

// 8. The server never downloads its own website (works while the site is private)
const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => { calls.push(String(u)); return realFetch(u, o); };
await post({ method: "cod", customer, items: [{ id: "red-bloom-studs", qty: 1 }] });
globalThis.fetch = realFetch;
assert.ok(!calls.some(u => u.includes("shop.test/data/")), "server should not fetch its own data files");
console.log("✓ checkout works without the server downloading the website");

console.log("\nAll backend checks passed.");
