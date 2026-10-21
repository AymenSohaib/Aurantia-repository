/*
  LESSON 14 — order-status.mjs: lets the thank-you page show the order.

  It only returns safe, non-private details (first name, items, total,
  status) — never the address, phone or email.
*/
import { getOrder } from "../lib/orders.mjs";

export default async (req) => {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^AUR-\d{6}-[A-Z0-9]{4}$/.test(id)) return Response.json({ error: "Unknown order" }, { status: 404 });
  const o = await getOrder(id);
  if (!o) return Response.json({ error: "Unknown order" }, { status: 404 });
  return Response.json({
    id: o.id,
    status: o.status,
    method: o.method,
    firstName: o.customer.name.split(" ")[0],
    lines: o.lines.map(l => ({ name: l.name, qty: l.qty, lineTotal: l.lineTotal })),
    delivery: o.delivery,
    total: o.total,
  });
};

export const config = { path: "/api/order-status" };
