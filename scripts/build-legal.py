"""
LESSON 17 — build-legal.py writes the three legal pages from one template,
so they always share the same header, footer and look.

You don't need to run this to edit the policies: just open privacy.html,
terms.html or cookies.html on GitHub and change the words directly.
(Re-running this script would overwrite those edits.)
"""
import json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
store = json.loads((root / "data/store.json").read_text())
EFFECTIVE = "20 October 2026"
EMAIL = store.get("email", "")
WA = "+" + store.get("whatsappNumber", "")
IG = "@" + store.get("instagram", "")

SHELL = """<!doctype html>
<!-- Policy page. Edit the words between the tags. Have a lawyer review before launch. -->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title} · Aurantia</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Italiana&family=Jost:wght@300;400;500;600&display=swap">
  <link rel="icon" href="images/brand/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="images/brand/favicon.png" sizes="256x256">
  <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
  <header class="topbar">
    <div class="topbar__inner wrap">
      <a class="wordmark" href="./" aria-label="Aurantia home"><img class="wordmark__mark" src="images/brand/logo-mark.svg" alt=""><img src="images/brand/logo-wordmark.svg" alt="Aurantia"></a>
      <a class="btn btn--light" href="./" style="margin-left:auto;min-height:42px">Back to shop</a>
    </div>
  </header>
  <main class="legal wrap">
    <article class="legal__doc">
      <nav class="legal__nav" aria-label="Policies">
        <a href="privacy.html"{p}>Privacy</a><a href="terms.html"{t}>Terms &amp; Conditions</a><a href="cookies.html"{c}>Cookies</a>
      </nav>
      <p class="legal__meta">Effective {date}</p>
      <h1>{title}</h1>
{body}
      <h2>Contact us</h2>
      <p>Email <strong>{email}</strong> · WhatsApp <strong>{wa}</strong> · Instagram <strong>{ig}</strong></p>
    </article>
  </main>
  <footer class="footer"><div class="wrap footer__inner"><p class="footer__small" style="border:0">© Aurantia. Prices in PKR.</p></div></footer>
</body>
</html>
"""

PRIVACY = """
      <p>This policy explains what personal information Aurantia collects when you visit our website or place an order, why we collect it, who we share it with, and the choices you have.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Order details you give us:</strong> your name, email address, WhatsApp number, delivery address, city and any order note.</li>
        <li><strong>What you order:</strong> the products, quantities, prices and payment method.</li>
        <li><strong>Payment status:</strong> whether a payment succeeded and its reference number. We never see or store your card or wallet details; these are entered on Safepay's secure page.</li>
        <li><strong>Messages:</strong> anything you send us by email, WhatsApp or Instagram.</li>
        <li><strong>Basic technical data:</strong> like any website, our hosting provider receives your IP address and browser type when pages load.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To process, pack and deliver your order.</li>
        <li>To send your order confirmation by email and WhatsApp, and to contact you about delivery or payment.</li>
        <li>To answer your questions and handle exchanges or complaints.</li>
        <li>To keep records required for accounting, tax and fraud prevention.</li>
      </ul>
      <p>We do not sell your personal information. We do not send you marketing messages unless you ask us to.</p>

      <h2>Who we share it with</h2>
      <p>Only the companies that help us run the shop, and only what they need:</p>
      <div class="table-scroll"><table>
        <thead><tr><th>Service</th><th>What it does for us</th><th>What it receives</th></tr></thead>
        <tbody>
          <tr><td>Netlify</td><td>Hosts the website and stores order records</td><td>Order details, technical data</td></tr>
          <tr><td>Safepay</td><td>Processes online card and wallet payments</td><td>Order amount and your payment details (entered on their page)</td></tr>
          <tr><td>Resend</td><td>Sends confirmation emails</td><td>Your name, email and order summary</td></tr>
          <tr><td>Meta (WhatsApp)</td><td>Sends WhatsApp confirmations</td><td>Your first name, WhatsApp number and order summary</td></tr>
          <tr><td>Google</td><td>Serves the fonts and holds our product list</td><td>Technical data when fonts load</td></tr>
          <tr><td>Courier partner</td><td>Delivers your parcel</td><td>Name, phone, address, cash-on-delivery amount</td></tr>
        </tbody>
      </table></div>
      <p>Some of these services store data on servers outside Pakistan. We may also share information if the law requires it.</p>

      <h2>How long we keep it</h2>
      <p>We keep order records for as long as needed for delivery, exchanges and our accounting and legal obligations, and then delete them. You can ask us to delete your data sooner where we are not required to keep it.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Ask us for a copy of the information we hold about you.</li>
        <li>Ask us to correct or delete it.</li>
        <li>Tell us to stop contacting you on WhatsApp (reply STOP or message us).</li>
      </ul>
      <p>Message us using the details below and we will reply within 7 days.</p>

      <h2>Children</h2>
      <p>Our shop is not directed at children under 13, and we do not knowingly collect their information. Customers under 18 should order with a parent or guardian's permission.</p>

      <h2>Keeping it safe</h2>
      <p>The site uses an encrypted (HTTPS) connection, payments are handled by Safepay, and order records are only accessible to the Aurantia team. No system is perfectly secure, but we take reasonable steps to protect your information.</p>

      <h2>Changes</h2>
      <p>If we change this policy we will update the date at the top of this page.</p>
"""

TERMS = """
      <p>These terms apply when you browse or buy from the Aurantia website. By placing an order, you agree to them. Please read them before you buy.</p>

      <h2>About our products</h2>
      <p>Aurantia sells fashion (imitation) jewelry and accessories. Unless a product description says otherwise, pieces are not made of solid gold, silver or genuine gemstones. Photos are taken to show products as accurately as possible, but colours can look slightly different on different screens, and handmade or stone details can vary a little from piece to piece.</p>

      <h2>Prices and payment</h2>
      <ul>
        <li>All prices are in Pakistani Rupees (PKR). The delivery charge is shown in your bag before you order.</li>
        <li>We can change prices at any time, but the price you see when you place your order is the price you pay.</li>
        <li>If a price is clearly wrong because of a mistake, we will contact you before sending the order, and you can cancel for a full refund.</li>
        <li>You can pay online through Safepay, by cash on delivery, or by arrangement on WhatsApp.</li>
      </ul>

      <h2>Your order</h2>
      <ul>
        <li>Your order is accepted once you receive a confirmation with an order number.</li>
        <li>We may cancel an order if an item is out of stock, the address can't be reached, or the order looks fraudulent. If you have already paid, we refund you in full.</li>
        <li>For cash on delivery, please be available to receive and pay for the parcel. Repeatedly refused parcels may mean we only accept prepaid orders from you in future.</li>
      </ul>

      <h2>Delivery</h2>
      <p>We deliver within Pakistan, usually in {delivery}. Delivery times are estimates and can be affected by the courier, public holidays or weather. Please check your address carefully; we are not responsible for delays caused by an incorrect address.</p>

      <h2>Exchanges and refunds</h2>
      <!-- EDIT THIS SECTION so it matches what you actually offer. -->
      <ul>
        <li>If your item arrives damaged, faulty or is not what you ordered, message us within <strong>3 days</strong> of delivery with photos or an unboxing video. We will replace it or refund you.</li>
        <li>For hygiene reasons, earrings can only be exchanged if they are unused and in their original packaging.</li>
        <li>Refunds for online payments are sent back through Safepay to the original payment method. Refunds for cash-on-delivery orders are sent by bank transfer or mobile wallet.</li>
        <li>Delivery charges are refunded only when the problem was our mistake.</li>
      </ul>

      <h2>Caring for your jewelry</h2>
      <p>Fashion jewelry lasts longer when kept dry and away from perfume, lotion and water. Normal wear such as fading of plating over time is not a manufacturing fault.</p>

      <h2>Using this website</h2>
      <p>The website, its design, text and product photos belong to Aurantia. Please don't copy or reuse them without our permission. Don't misuse the site, for example by placing fake orders or trying to break its security.</p>

      <h2>Our responsibility</h2>
      <p>We are responsible for delivering the products you order as described. We are not responsible for losses that were not foreseeable, or for delays outside our control. Nothing in these terms limits any rights you have under Pakistani consumer protection law.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of Pakistan. Before going to court, please contact us so we can try to resolve any problem directly.</p>

      <h2>Changes</h2>
      <p>We may update these terms. The version on this page when you place your order is the one that applies.</p>
"""

COOKIES = """
      <p>This page explains the small amount of information our website saves in your browser, and why.</p>

      <h2>The short version</h2>
      <p>We do <strong>not</strong> use advertising cookies, tracking pixels or analytics. The only thing our own site saves is your shopping bag, so it's still there if you close the tab.</p>

      <h2>What is saved</h2>
      <div class="table-scroll"><table>
        <thead><tr><th>Name</th><th>Set by</th><th>Purpose</th><th>How long</th></tr></thead>
        <tbody>
          <tr><td>aurantia-bag</td><td>Aurantia</td><td>Remembers the items in your bag</td><td>Until you place an order or clear your browser data</td></tr>
          <tr><td>aurantia-notice</td><td>Aurantia</td><td>Remembers that you've seen the storage notice</td><td>Until you clear your browser data</td></tr>
        </tbody>
      </table></div>
      <p>These are stored using your browser's "local storage" rather than cookies, and they never leave your device. They are needed for the bag to work.</p>

      <h2>Other services</h2>
      <ul>
        <li><strong>Safepay:</strong> when you choose to pay online, you go to Safepay's own page, which may set cookies needed for secure payment and fraud prevention. Those are covered by Safepay's own policy.</li>
        <li><strong>Google Fonts:</strong> our fonts load from Google, which receives your IP address and browser type to deliver them.</li>
        <li><strong>WhatsApp and Instagram:</strong> if you tap a WhatsApp or Instagram link, those apps apply their own policies.</li>
      </ul>

      <h2>Your choices</h2>
      <p>You can clear or block site storage in your browser settings at any time. The site will still work, but your bag won't be remembered between visits.</p>
"""

pages = [
    ("privacy.html", "Privacy Policy", PRIVACY, "p"),
    ("terms.html", "Terms & Conditions", TERMS.replace("{delivery}", store.get("deliveryTime", "a few working days")), "t"),
    ("cookies.html", "Cookie Policy", COOKIES, "c"),
]
for fname, title, body, key in pages:
    cur = {k: (' aria-current="page"' if k == key else "") for k in "ptc"}
    html = SHELL.format(title=title.replace("&", "&amp;"), body=body.rstrip(), date=EFFECTIVE, email=EMAIL, wa=WA, ig=IG, **cur)
    (root / fname).write_text(html)
    print("wrote", fname)
