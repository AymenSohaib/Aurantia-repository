/*
  LESSON 12 — payment-return.mjs: the customer comes back from Safepay.

  Safepay sends the customer's browser here after payment, carrying:
    order_id, tracker, sig (signature) and reference.
  We check the signature, mark the order paid, send the confirmations,
  then forward the customer to thank-you.html.
*/
import { getOrder, saveOrder } from "../lib/orders.mjs";
import { verifyReturnSignature } from "../lib/safepay.mjs";
import { notifyOrder } from "../lib/notify.mjs";

const go = (origin, path) => Response.redirect(`${origin}${path}`, 303);

export default async (req) => {
  const url = new URL(req.url);
  const origin = url.origin;

  // Safepay may send the details in the link (GET) or as a form (POST) — accept both
  const params = new URLSearchParams(url.search);
  if (req.method === "POST") {
    const text = await req.text();
    for (const [k, v] of new URLSearchParams(text)) params.set(k, v);
  }
  const orderId = params.get("order_id");
  const tracker = params.get("tracker");
  const sig = params.get("sig");
  const reference = params.get("reference") || "";

  if (!orderId) return go(origin, "/?payment=missing");
  const order = await getOrder(orderId);
  if (!order) return go(origin, "/?payment=unknown");

  const genuine = verifyReturnSignature(tracker, sig) && order.payment?.tracker === tracker;
  if (!genuine) {
    order.status = "payment_review";      // look at this one in your Safepay dashboard
    order.payment = { ...order.payment, returnedSig: sig, reference };
    await saveOrder(order);
    return go(origin, `/thank-you.html?order=${encodeURIComponent(order.id)}&m=review`);
  }

  if (order.status !== "paid") {
    order.status = "paid";
    order.paidAt = new Date().toISOString();
    order.payment = { ...order.payment, reference };
  }
  if (!order.notified) {
    order.notifications = await notifyOrder(order);
    order.notified = true;
  }
  await saveOrder(order);
  return go(origin, `/thank-you.html?order=${encodeURIComponent(order.id)}&m=online`);
};

export const config = { path: "/api/payment-return" };
