/*
  LESSON 8 — orders.mjs: the order book.

  Every order is saved in "Netlify Blobs", a free storage box that comes
  with your Netlify site. Think of it as a drawer of index cards: each card
  is filed under the order number, e.g. "AUR-261020-7KQ2".
*/
import { getStore } from "@netlify/blobs";

const store = () => getStore({ name: "orders", consistency: "strong" });

// Makes an order number like AUR-261020-7KQ2 (date + 4 random characters)
export function newOrderId(now = new Date()) {
  const d = now.toISOString().slice(2, 10).replace(/-/g, "");      // 261020
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";                // no 0/O or 1/I mix-ups
  let tail = "";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  for (const b of bytes) tail += chars[b % chars.length];
  return `AUR-${d}-${tail}`;
}

export async function saveOrder(order) {
  await store().setJSON(order.id, order);
  if (order.payment?.tracker) await store().set(`tracker:${order.payment.tracker}`, order.id);
}

export async function getOrder(id) {
  return store().get(id, { type: "json" });
}

export async function findOrderByTracker(tracker) {
  const id = await store().get(`tracker:${tracker}`, { type: "text" });
  return id ? getOrder(id) : null;
}
