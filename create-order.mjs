/*
  LESSON 11 — create-order.mjs: the cashier.

  The website's checkout form sends a message here (to /api/create-order).
  This program:
    1. checks the customer's details
    2. looks up the REAL prices and stock (catalog.mjs)
    3. saves the order (orders.mjs)
    4. for "Pay online": opens a Safepay payment and sends back the link
       for "Cash on delivery" / "WhatsApp": sends the email + WhatsApp now
*/
import { loadSettings, loadProducts, priceOrder } from "../lib/catalog.mjs";
import { newOrderId, saveOrder } from "../lib/orders.mjs";
import { notifyOrder } from "../lib/notify.mjs";
import { safepayConfigured, createTracker, checkoutUrl } from "../lib/safepay.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const clean = (v, max = 300) => String(v ?? "").trim().slice(0, max);

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "That request wasn't readable." }, 400); }

  // 1. Customer details
  const c = body.customer || {};
  const customer = {
    name: clean(c.name, 80),
    email: clean(c.email, 120).toLowerCase(),
    phone: clean(c.phone, 20).replace(/[\s-]/g, ""),
    address: clean(c.address, 300),
    city: clean(c.city, 60),
    note: clean(c.note, 300),
    gift: Boolean(c.gift),
    giftNote: c.gift ? clean(c.giftNote, 200) : "",
  };
  const method = ["online", "cod", "whatsapp"].includes(body.method) ? body.method : null;
  if (!method) return json({ error: "Choose how you'd like to pay." }, 400);
  if (customer.name.length < 2) return json({ error: "Please add your full name." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customer.email)) return json({ error: "Please check your email address." }, 400);
  if (!/^(\+?92|0)?3\d{9}$/.test(customer.phone)) return json({ error: "Please use a Pakistani mobile number like 0300 1234567." }, 400);
  if (customer.address.length < 6 || customer.city.length < 2) return json({ error: "Please add your full delivery address and city." }, 400);

  // 2. Real prices
  const origin = new URL(req.url).origin;
  let settings, products;
  try {
    settings = await loadSettings(origin);
    products = await loadProducts(origin, settings);
  } catch (e) {
    console.error(e);
    return json({ error: "The shop couldn't load its prices just now. Please try again in a minute." }, 503);
  }
  const priced = priceOrder(body.items, products, settings, method);
  if (priced.error) return json({ error: priced.error }, 400);

  // 3. Build and save the order
  const order = {
    id: newOrderId(),
    createdAt: new Date().toISOString(),
    status: method === "online" ? "awaiting_payment" : "placed",
    method,
    customer,
    ...priced,
  };

  // 4a. Pay online → Safepay
  if (method === "online") {
    if (!safepayConfigured()) return json({ error: "Online payment isn't switched on yet. Please choose cash on delivery or WhatsApp." }, 503);
    try {
      const token = await createTracker(order.total, order.currency);
      order.payment = { provider: "safepay", tracker: token };
      await saveOrder(order);
      const redirect = checkoutUrl({
        token,
        orderId: order.id,
        redirectUrl: `${origin}/api/payment-return`,
        cancelUrl: `${origin}/?payment=cancelled`,
      });
      return json({ orderId: order.id, redirect });
    } catch (e) {
      console.error(e);
      return json({ error: "The payment page didn't open. Please try again, or choose cash on delivery." }, 502);
    }
  }

  // 4b. COD or WhatsApp → confirm straight away
  await saveOrder(order);
  order.notifications = await notifyOrder(order);
  order.notified = true;
  await saveOrder(order);
  return json({ orderId: order.id });
};

export const config = { path: "/api/create-order" };
