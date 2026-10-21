/*
  LESSON 7 — catalog.mjs: the server's own copy of your prices.

  WHY THIS EXISTS: a clever customer could edit the website in their
  browser and change "Rs 2,400" to "Rs 1". So the server NEVER trusts
  prices sent from the browser. It downloads your product list itself
  (from the Google Sheet, or data/products.json) and works out the total.
*/

// The settings and product list are packed into the server program when the
// site is published, so the server never has to download them from the
// website. (That would fail while the site is private, and it's slower.)
import bundledSettings from "../../data/store.json" with { type: "json" };
import bundledProducts from "../../data/products.json" with { type: "json" };

export async function loadSettings() {
  return bundledSettings;
}

export async function loadProducts(_origin, settings) {
  if (settings.sheetCsvUrl) {
    try {
      const res = await fetch(settings.sheetCsvUrl);
      if (res.ok) return parseCsv(await res.text()).map(normalize).filter(Boolean);
    } catch (e) {
      console.warn("Sheet fetch failed, falling back to products.json", e);
    }
  }
  return bundledProducts.map(normalize).filter(Boolean);
}

// Same CSV reader as the website uses (see assets/app.js for comments)
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows.filter(r => r.some(c => c.trim() !== ""));
  if (!header) return [];
  const keys = header.map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return body.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

function normalize(p) {
  const num = v => Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  const price = num(p.price);
  if (!p.id || !p.name || !price) return null;
  const sale = num(p.sale_price);
  const stockText = String(p.stock ?? "").trim();
  return {
    id: String(p.id).trim(),
    name: String(p.name).trim(),
    image: String(p.image || "").trim(),
    hook: String(p.hook || "").trim(),
    description: String(p.description || "").trim(),
    unitPrice: sale > 0 && sale < price ? sale : price,
    stock: stockText === "" ? Infinity : Math.max(0, parseInt(stockText, 10) || 0),
    hidden: /^(true|yes|y|1)$/i.test(String(p.hidden ?? "").trim()),
  };
}

/*
  Takes what the browser sent ([{id, qty}, ...]) and returns the real order
  lines and totals — or a clear error message if something is wrong.
*/
export function priceOrder(items, products, settings, method) {
  if (!Array.isArray(items) || items.length === 0) return { error: "Your bag is empty." };
  if (items.length > 30) return { error: "Too many different items in one order." };

  const merged = new Map();
  for (const it of items) {
    const qty = Math.floor(Number(it?.qty));
    if (!it?.id || !Number.isFinite(qty) || qty < 1 || qty > 20) return { error: "One of the quantities isn't valid." };
    merged.set(String(it.id), (merged.get(String(it.id)) || 0) + qty);
  }

  const lines = [];
  for (const [id, qty] of merged) {
    const p = products.find(x => x.id === id && !x.hidden);
    if (!p) return { error: "One of the items in your bag is no longer available. Please refresh the page." };
    if (p.stock < qty) return { error: p.stock === 0 ? `${p.name} has just sold out.` : `Only ${p.stock} of ${p.name} left.` };
    lines.push({ id, name: p.name, qty, unitPrice: p.unitPrice, lineTotal: p.unitPrice * qty });
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const freeByAmount = settings.freeDeliveryOver && subtotal >= settings.freeDeliveryOver;
  const freeByPrepay = settings.prepaidFreeDelivery && method === "online";   // optional reward for paying online
  const delivery = freeByAmount || freeByPrepay ? 0 : Number(settings.deliveryFee || 0);
  return { lines, subtotal, delivery, total: subtotal + delivery, currency: settings.currency || "PKR" };
}
