/*
  LESSON 13 — safepay-webhook.mjs: the backup confirmation.

  Sometimes a customer pays and then closes the tab before coming back.
  A "webhook" is Safepay's SERVER calling OUR server directly to say
  "tracker X was paid". This makes sure those orders still get confirmed.

  In the Safepay dashboard, set the webhook URL to:
      https://YOUR-SITE.netlify.app/api/safepay-webhook
*/
import { findOrderByTracker, saveOrder } from "../lib/orders.mjs";
import { verifyWebhook } from "../lib/safepay.mjs";
import { notifyOrder } from "../lib/notify.mjs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Use POST", { status: 405 });
  const raw = await req.text();                                   // must be the exact text Safepay sent
  if (!verifyWebhook(raw, req.headers.get("x-sfpy-signature"))) return new Response("Bad signature", { status: 400 });

  let event;
  try { event = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }
  const n = event?.notification || {};
  if (!n.tracker) return new Response("ok");                       // not a payment event we track

  const order = await findOrderByTracker(n.tracker);
  if (!order) return new Response("ok");

  const paid = String(n.state).toUpperCase() === "PAID" && Number(n.amount) >= order.total;
  if (paid && order.status !== "paid") {
    order.status = "paid";
    order.paidAt = new Date().toISOString();
    order.payment = { ...order.payment, reference: n.reference, viaWebhook: true };
  }
  if (paid && !order.notified) {
    order.notifications = await notifyOrder(order);
    order.notified = true;
  }
  await saveOrder(order);
  return new Response("ok");                                       // 200 tells Safepay "got it, don't resend"
};

export const config = { path: "/api/safepay-webhook" };
