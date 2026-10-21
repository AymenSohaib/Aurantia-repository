/*
  LESSON 14b — product-page.mjs: short product links for sharing.

  When someone opens  yoursite.com/p/champagne-pearl-drops  this sends back a
  tiny page that carries the product's name, line and photo in "og" tags
  (WhatsApp, Instagram and Facebook read these to show a photo card when the
  link is shared), and then forwards the visitor to the real product page,
  product.html?id=champagne-pearl-drops.
*/
import { loadSettings, loadProducts } from "../lib/catalog.mjs";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export default async (req, context) => {
  const url = new URL(req.url);
  const origin = url.origin;
  const id = decodeURIComponent(context?.params?.id || url.pathname.split("/p/")[1] || "").replace(/\/$/, "");
  const target = `/product.html?id=${encodeURIComponent(id)}`;

  let title = "Aurantia — Wear your Aura";
  let desc = "Aurantia jewelry. Delivered across Pakistan.";
  let image = `${origin}/images/brand/hero-satin.jpg`;
  try {
    const settings = await loadSettings();
    const p = (await loadProducts(origin, settings)).find(x => x.id === id && !x.hidden);
    if (p) {
      title = `${p.name} · Aurantia`;
      desc = p.hook ? `${p.hook}. ${p.description}` : p.description || desc;
      if (p.image) image = new URL(p.image, origin + "/").href;
    }
  } catch (e) {
    console.warn("product-page: couldn't load product data", e);
  }

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:type" content="product">
<meta property="og:url" content="${esc(`${origin}/p/${id}`)}">
<link rel="canonical" href="${esc(`${origin}${target}`)}">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
</head><body>
<p><a href="${esc(target)}">Open ${esc(title)}</a></p>
<script>location.replace(${JSON.stringify(target)});</script>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } });
};

export const config = { path: "/p/:id" };
