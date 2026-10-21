/*
  LESSON 10 — notify.mjs: sending the confirmations.

  EMAIL goes through Resend (resend.com, free for 3,000 emails a month).
  WHATSAPP goes through Meta's WhatsApp Cloud API.

  Settings (Netlify → Site configuration → Environment variables):
    RESEND_API_KEY        from resend.com → API Keys
    EMAIL_FROM            e.g.  Aurantia <orders@aurantia.pk>  (a domain you verified in Resend)
    OWNER_EMAIL           where YOU get a copy of every order
    WHATSAPP_TOKEN        permanent access token from Meta for Developers
    WHATSAPP_PHONE_ID     the "Phone number ID" of your WhatsApp business number
    WHATSAPP_TEMPLATE     name of your approved template, e.g. order_confirmation
    WHATSAPP_TEMPLATE_LANG   language code of that template, default "en"
    WHATSAPP_API_VERSION  default "v23.0"

  If a setting is missing, that message is skipped (and logged) instead of
  breaking the order. So you can launch with email first and add WhatsApp later.
*/

const rs = n => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const methodLabel = m => ({ online: "Paid online", cod: "Cash on delivery", whatsapp: "To confirm on WhatsApp" }[m] || m);

// 03001234567 / +92 300 1234567 / 3001234567  →  923001234567
export function toIntlPhone(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("92")) return d;
  if (d.startsWith("0")) return "92" + d.slice(1);
  if (d.length === 10 && d.startsWith("3")) return "92" + d;
  return d;
}

// ---------- EMAIL ----------
function emailHtml(order, forOwner) {
  const rows = order.lines.map(l => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #0a4a52;color:#f2e3bf">${esc(l.name)} × ${l.qty}</td>
      <td style="padding:10px 0;border-bottom:1px solid #0a4a52;color:#d7e8e3;text-align:right;font-family:monospace">${rs(l.lineTotal)}</td>
    </tr>`).join("");
  const c = order.customer;
  return `<!doctype html><html><body style="margin:0;background:#011e20;font-family:Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#011e20;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#01323d;border:1px solid #0a4a52;border-radius:16px;padding:32px">
        <tr><td style="text-align:center;letter-spacing:8px;font-size:22px;color:#f2e3bf;font-family:Georgia,serif">AURANTIA</td></tr>
        <tr><td style="text-align:center;color:#e3c367;font-size:12px;letter-spacing:3px;padding-top:6px">WEAR YOUR AURA</td></tr>
        <tr><td style="padding-top:28px;color:#f2e3bf;font-size:22px;font-family:Georgia,serif">
          ${forOwner ? `New order from ${esc(c.name)}` : `Thank you, ${esc(c.name.split(" ")[0])}!`}
        </td></tr>
        <tr><td style="padding-top:8px;color:#8fb3ac;font-size:14px;line-height:1.6">
          ${forOwner ? "Here are the details." : "We've received your order and will pack it with care. Keep this email for your records."}
        </td></tr>
        <tr><td style="padding-top:20px;color:#e3c367;font-size:12px;letter-spacing:2px">ORDER ${esc(order.id)} · ${esc(methodLabel(order.method)).toUpperCase()}</td></tr>
        <tr><td><table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">${rows}
          <tr><td style="padding:10px 0;color:#8fb3ac">Delivery</td><td style="padding:10px 0;text-align:right;color:#d7e8e3;font-family:monospace">${order.delivery ? rs(order.delivery) : "Free"}</td></tr>
          <tr><td style="padding:10px 0;color:#f2e3bf;font-size:18px">Total</td><td style="padding:10px 0;text-align:right;color:#f2e3bf;font-size:18px;font-family:monospace">${rs(order.total)}</td></tr>
        </table></td></tr>
        <tr><td style="padding-top:20px;color:#8fb3ac;font-size:14px;line-height:1.6">
          <b style="color:#e3c367">Deliver to</b><br>${esc(c.name)}<br>${esc(c.address)}, ${esc(c.city)}<br>${esc(c.phone)}${forOwner ? `<br>${esc(c.email)}` : ""}
          ${c.note ? `<br><br><b style="color:#e3c367">Note</b><br>${esc(c.note)}` : ""}
          ${c.gift ? `<br><br><b style="color:#e3c367">🎁 Gift order</b>${forOwner ? " — leave prices off the parcel" : ""}${c.giftNote ? `<br>Card message: “${esc(c.giftNote)}”` : ""}` : ""}
        </td></tr>
        <tr><td style="padding-top:28px;color:#8fb3ac;font-size:12px;text-align:center">Questions? Reply to this email or message us on WhatsApp.</td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

async function sendEmail({ to, subject, html, replyTo }) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { skipped: "email not set up" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, reply_to: replyTo }),
  });
  if (!res.ok) return { error: `email ${res.status}: ${await res.text()}` };
  return { ok: true };
}

// ---------- WHATSAPP ----------
async function sendWhatsapp(order) {
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_TEMPLATE } = process.env;
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID || !WHATSAPP_TEMPLATE) return { skipped: "whatsapp not set up" };
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  // Your approved template must have exactly these 4 blanks: {{1}} name, {{2}} order no, {{3}} total, {{4}} payment
  const params = [order.customer.name.split(" ")[0], order.id, rs(order.total), methodLabel(order.method)]
    .map(text => ({ type: "text", text: String(text) }));
  const res = await fetch(`https://graph.facebook.com/${version}/${WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toIntlPhone(order.customer.phone),
      type: "template",
      template: {
        name: WHATSAPP_TEMPLATE,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
        components: [{ type: "body", parameters: params }],
      },
    }),
  });
  if (!res.ok) return { error: `whatsapp ${res.status}: ${await res.text()}` };
  return { ok: true };
}

// Sends everything for one order. Never throws — failures are recorded instead.
export async function notifyOrder(order) {
  const subject = `Your Aurantia order ${order.id}`;
  const results = await Promise.allSettled([
    sendEmail({ to: order.customer.email, subject, html: emailHtml(order, false), replyTo: process.env.OWNER_EMAIL }),
    process.env.OWNER_EMAIL
      ? sendEmail({ to: process.env.OWNER_EMAIL, subject: `New order ${order.id} — ${rs(order.total)} (${methodLabel(order.method)})`, html: emailHtml(order, true), replyTo: order.customer.email })
      : Promise.resolve({ skipped: "no OWNER_EMAIL" }),
    sendWhatsapp(order),
  ]);
  const [customerEmail, ownerEmail, whatsapp] = results.map(r => (r.status === "fulfilled" ? r.value : { error: String(r.reason) }));
  const summary = { customerEmail, ownerEmail, whatsapp, at: new Date().toISOString() };
  console.log("notify", order.id, JSON.stringify(summary));
  return summary;
}
