/*
  LESSON 14b — product-page.mjs: pretty product links with share previews.

  When someone opens  yoursite.com/p/champagne-pearl-drops  this program:
    1. reads product.html
    2. fills in the page title and the og:… tags with that product's
       name, hook line and photo
    3. sends the page back

  WhatsApp, Instagram and Facebook read those og:… tags to show a photo
  card when the link is shared. The page itself is then drawn by app.js
  exactly like any other page.
*/
import { loadSettings, loadProducts } from "../lib/catalog.mjs";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export default async (req, context) => {
  const url = new URL(req.url);
  const origin = url.origin;
  const id = decodeURIComponent(context.params?.id || url.pathname.split("/p/")[1] || "").replace(/\/$/, "");

  const shell = await fetch(`${origin}/product.html`);
  if (!shell.ok) return new Response("Not found", { status: 404 });
  let html = await shell.text();

  // <base href="/"> makes relative links (assets/styles.css) work from /p/…
  html = html.replace("<head>", '<head>\n  <base href="/">');

  try {
    const settings = await loadSettings(origin);
    const p = (await loadProducts(origin, settings)).find(x => x.id === id && !x.hidden);
    if (p) {
      const title = `${p.name} · Aurantia`;
      const desc = p.hook ? `${p.hook}. ${p.description}` : p.description || "Aurantia jewelry. Delivered across Pakistan.";
      const image = p.image ? new URL(p.image, origin + "/").href : `${origin}/images/brand/hero-satin.jpg`;
      html = html
        .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
        .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
        .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
        .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
        .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(image)}$2`)
        .replace("</head>", `  <meta property="og:url" content="${esc(`${origin}/p/${p.id}`)}">\n  <link rel="canonical" href="${esc(`${origin}/p/${p.id}`)}">\n</head>`);
    }
  } catch (e) {
    console.warn("product-page: couldn't load product data", e);
  }

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } });
};

export const config = { path: "/p/:id" };
