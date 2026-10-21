# Aurantia — online store

The Aurantia jewelry website: a shop with a bag, checkout, online payment through Safepay, cash on delivery, WhatsApp ordering, and automatic confirmations by email and WhatsApp.

This guide is written for a complete beginner. Read it top to bottom once; after that, use the **"I want to…"** section as a quick reference.

---

## Contents

1. [How the site works (the big picture)](#1-how-the-site-works)
2. [What's in this folder](#2-whats-in-this-folder)
3. [Put the site online (GitHub + Netlify)](#3-put-the-site-online)
4. [Add, remove and price products](#4-add-remove-and-price-products)
5. [Turn on online payment (Safepay)](#5-turn-on-online-payment-safepay)
6. [Turn on confirmation emails (Resend)](#6-turn-on-confirmation-emails-resend)
7. [Turn on WhatsApp confirmations (Meta)](#7-turn-on-whatsapp-confirmations)
8. [Use your own domain (aurantia.pk)](#8-use-your-own-domain)
9. [See your orders](#9-see-your-orders)
10. ["I want to…" quick reference](#10-i-want-to)
11. [Before you launch: checklist](#11-before-you-launch)
12. [If something goes wrong](#12-if-something-goes-wrong)

---

## 1. How the site works

A website is a folder of files. This one has two halves:

| Half | Runs on | Files | Job |
|---|---|---|---|
| **Front of the shop** | The customer's phone or computer | `index.html`, `assets/styles.css`, `assets/app.js` | Shows products, runs the bag and the checkout form |
| **Back room** | Netlify's servers | `netlify/functions/*.mjs` | Checks real prices, takes payment, saves orders, sends email and WhatsApp |

**Why two halves?** Anything in the customer's browser can be changed by the customer. So the browser only says *"2 × Onyx Statement Set"*. The back room looks up the real price itself before charging. A customer can't change Rs 2,400 to Rs 1.

**What happens when someone orders:**

```
Customer fills checkout ──► /api/create-order (back room)
                              │ checks name, email, phone, address
                              │ looks up REAL prices + stock
                              │ saves the order (order number AUR-261020-7KQ2)
                              │
       ┌──────────────────────┼──────────────────────┐
  Pay online             Cash on delivery        Confirm on WhatsApp
       │                      │                       │
  Safepay page           email + WhatsApp        email + WhatsApp sent,
  (card / wallet)        sent right away         WhatsApp chat opens
       │                                          with the order typed out
  /api/payment-return
  checks Safepay's signature
  → marks PAID → email + WhatsApp sent
       │
       └──────────────► thank-you.html
```

**Where it runs:**

- **GitHub** stores the files (like Google Drive, but for code).
- **Netlify** reads the files from GitHub and puts them on the internet. It's free for a shop this size, and commercial use is allowed on the free plan.
- **Every time you change a file on GitHub, Netlify updates the live site within about a minute.** You never "upload" the site again.

---

## 2. What's in this folder

```
index.html            The home page (structure)
product.html          One page used for every product (/p/<id>)
thank-you.html        Page after ordering
privacy.html          Privacy Policy
terms.html            Terms & Conditions
cookies.html          Cookie Policy
404.html              "Page not found"

assets/
  styles.css          How everything looks — brand colours at the top
  app.js              The bag, filters, checkout form, hero animation

data/
  store.json          ★ YOUR SETTINGS: WhatsApp number, email, delivery fee
  products.json       ★ YOUR PRODUCTS (if you're not using a Google Sheet)
  products-template.csv   Starter file to import into Google Sheets

images/products/      ★ PRODUCT PHOTOS go here
images/brand/         Logo, favicon, hero background
art/                  The Satin Current generative art + stills

netlify/
  functions/          The back-room programs (one file per job)
    create-order.mjs     receives orders
    payment-return.mjs   customer returns from Safepay
    safepay-webhook.mjs  Safepay's server confirms payment
    order-status.mjs     feeds the thank-you page
    product-page.mjs     pretty product links with photo previews
  lib/                Shared helpers used by the functions
    catalog.mjs          real prices and stock
    orders.mjs           the order book (Netlify Blobs)
    safepay.mjs          talking to Safepay
    notify.mjs           sending email + WhatsApp

netlify.toml          Tells Netlify how to run everything
package.json          Lists the one add-on the back room needs
scripts/
  test-backend.mjs    A test you can run:  npm test
  build-legal.py      Generated the policy pages (you can ignore it)

posts/                Your original Instagram slides (not used by the shop)
```

★ = the only files you'll normally edit.

Every code file has **LESSON** comments at the top explaining what it does in plain English. Open them on GitHub and read along.

---

## 3. Put the site online

You only do this once. About 15 minutes.

### Step 3.1 — Make sure the files are on GitHub

The files belong in your repository **AymenSohaib/Aurantia-repository**.

- **If Claude pushed them for you:** open the repository on github.com. You should see `index.html`, `assets`, `data` and so on. Skip to 3.2.
- **If you got a zip file:**
  1. Unzip it on your computer.
  2. Open https://github.com/AymenSohaib/Aurantia-repository
  3. Click **Add file → Upload files**.
  4. Drag **everything inside** the unzipped folder into the page (the files and folders, not the folder itself).
  5. At the bottom, write a message like *"Add the shop"* and click **Commit changes**.

> 💡 **Commit** = "save a version". GitHub keeps every version, so you can always go back.

### Step 3.2 — Connect Netlify

1. Go to https://app.netlify.com and click **Sign up → Sign up with GitHub**.
2. Click **Add new project → Import an existing project → GitHub**.
3. Allow Netlify to see **Aurantia-repository** (you can pick only that one).
4. On the settings screen, leave everything as it is. Netlify reads `netlify.toml` automatically.
5. Click **Deploy**.

After about a minute you get an address like `https://glittering-cupcake-12ab.netlify.app`. **Your shop is live.**

6. Rename it: **Project configuration → Change project name** → `aurantia`. Your address becomes `https://aurantia.netlify.app` (if the name is free).

At this point the shop works with **WhatsApp orders**. Cash on delivery and online payment also work, but no confirmation messages go out until you finish sections 5–7.

---

## 4. Add, remove and price products

You have two choices. **Use the Google Sheet.** It's the easiest, and you can do it from your phone.

### Option A (recommended): Google Sheet

**Set it up once:**

1. Open https://sheets.google.com and create a blank sheet named *Aurantia Products*.
2. **File → Import → Upload** and choose `data/products-template.csv` (download it from GitHub first: open the file, then the download button). Choose **Replace current sheet**.
3. **File → Share → Publish to web**.
   - Under *Link*, choose **Sheet1** and **Comma-separated values (.csv)**.
   - Click **Publish** and copy the link.
4. On GitHub, open `data/store.json`, click the ✏️ pencil, and paste the link between the quotes:
   ```json
   "sheetCsvUrl": "https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?gid=0&single=true&output=csv",
   ```
5. Click **Commit changes**. Done. From now on the shop reads the sheet.

> ⏱ Google takes up to 5 minutes to refresh a published sheet. After editing, wait a few minutes before checking the shop.

**What each column means:**

| Column | What to type | Example |
|---|---|---|
| `id` | A short unique name, lowercase, dashes, no spaces. **Never change it once people have ordered.** | `blue-bloom-studs` |
| `name` | The name customers see | `Blue Bloom Studs` |
| `category` | Groups products into filters and tiles | `Earrings`, `Sets`, `Necklaces` |
| `price` | Normal price, numbers only | `1450` |
| `sale_price` | Leave empty, or a lower number to show a sale | `1200` |
| `image` | Main photo (plain background) | `images/products/blue-bloom-studs-1.jpg` |
| `image2` | Second photo, shown on hover (worn) | `images/products/blue-bloom-studs-2.jpg` |
| `hook` | A short line from your post (saved for later; not shown right now) | `big pearl energy` |
| `description` | One or two sentences | `A tiny flower with a blue centre…` |
| `pairs` | Styling ideas, separated by `|` (saved for later; not shown right now) | `nikkah guest | chai date` |
| `details` | Size, weight, finish, closure, separated by `|` | `Size: 2 cm | Closure: push-back | Finish: antique gold-tone` |
| `occasion` | Adds a filter pill. Use a few, consistently | `Everyday`, `Weddings`, `Statement` |
| `badge` | Optional label. Only use when it's true | `New`, `Bestseller` |
| `stock` | How many you have. `0` = shows "Sold out". Empty = unlimited. | `8` |
| `featured` | `TRUE` puts it first and adds a "Featured" badge | `TRUE` |
| `hidden` | `TRUE` hides it from the shop without deleting it | `FALSE` |
| `tags` | Search words **and quiz words**, separated by commas. See "Quizzes" below | `blue,flower,studs,sparkle,silver-tone` |

**Everyday tasks in the sheet:**

- **Add a product:** add a new row. Upload its photos first (see below).
- **Remove a product:** set `hidden` to `TRUE`. You can bring it back later. Deleting the row also works.
- **Change a price:** edit `price`.
- **Put something on sale:** type the sale price in `sale_price`. Clear it to end the sale.
- **Mark sold out:** set `stock` to `0`.
- **New category:** just type it in `category` (for example `Rings`). A new filter and tile appear automatically.

### Option B: edit `data/products.json` on GitHub

Same columns, written as text. Open the file → ✏️ → edit → **Commit changes**. Copy an existing product block `{ … }`, paste it after a comma, and change the values. Watch the commas: every product except the last ends with `},`.

### Adding product photos

1. Make each photo roughly square or portrait, about **900 px wide**, saved as **.jpg**. Phone photos are fine. Shrink them with https://squoosh.app so the site stays fast (aim for under 200 KB each).
2. Name them after the product id: `blue-bloom-studs-1.jpg` (main) and `blue-bloom-studs-2.jpg` (worn).
3. On GitHub, open the `images/products` folder → **Add file → Upload files** → drop them in → **Commit changes**.
4. In your sheet, type `images/products/blue-bloom-studs-1.jpg` in `image`.

### Delivery fee and other settings

Edit `data/store.json` on GitHub:

| Setting | Meaning |
|---|---|
| `deliveryFee` | Charged on every order, e.g. `250` |
| `freeDeliveryOver` | Free delivery when the bag is at least this much. `0` = never free |
| `deliveryTime` | Shown on the site, e.g. `"3 to 5 working days"` |
| `whatsappNumber` | Where WhatsApp orders go. `0347 5919571` → `"923475919571"` |
| `email` | Shown in the footer and policies |
| `instagram` | Without the @ |
| `sampleMode` | `true` shows "prices are placeholders". **Set to `false` when your real prices are in.** |

---

### Quizzes

The home page has four quizzes (Find your aura, Wedding season, Gift finder, Everyday earrings). They live in `data/quizzes.json`.

**How matching works:** every answer gives points to words, like `pearl: 2` or `weddings: 3`. A product earns those points when the word appears in its **tags**, **occasion** or **category**. The three products with the most points are shown. So:

- **New product?** Give it honest tags (`pearl`, `studs`, `drops`, `sparkle`, `silver-tone`, `gold-tone`, `warm`, `minimal`, `statement`, `black`, `flower`…) and the quizzes will recommend it automatically.
- **Change a question:** edit the `q` text or an answer's `label`.
- **New quiz:** copy one whole quiz block `{ … }`, give it a new `id` and `title`, and change the questions. `"only": { "category": "Earrings" }` limits a quiz to one category; an answer with `"only": { "maxPrice": 1500 }` sets a budget.
- **Link straight to a quiz** (great for Instagram stories): `https://aurantia.netlify.app/#quiz-gift`, `#quiz-wedding`, `#quiz-everyday`, `#quiz-aura`.

### The prologue

Under the Instagram button is "the prologue": a short brand story told like Instagram stories. It turns pages by itself, pauses on hover, and visitors can tap or swipe. The words are in `data/prologue.json`: change `line` (big text) and `small` (the line under it). The last chapter's buttons link to a quiz (`#quiz-wedding`, `#quiz-gift`, `#quiz-everyday`) or the shop (`#shop`). `seconds` sets how long each chapter stays.

### Fonts

Headings use **Italiana** and all other text uses **Jost**, both from Google Fonts (free). To change them, edit the font link near the top of each HTML page and `--display` / `--ui` at the top of `assets/styles.css`.

### Product links

Every product has its own page and link, for example `https://aurantia.netlify.app/p/champagne-pearl-drops`. Paste it in WhatsApp, an Instagram story or your bio and it shows the product photo and name. The part after `/p/` is the product's `id`.

### Paying online: optional free delivery

Cash-on-delivery parcels are often refused at the door. To nudge customers to pay online, set `"prepaidFreeDelivery": true` in `data/store.json`. Online payers then get free delivery automatically, and the checkout says so.

### Brand files

Your logo is rebuilt as sharp vector files (SVG), so it stays crisp at any size:

- `images/brand/logo-lockup.svg`: mark + AURANTIA + "Jewelry & Accessories", gold (for dark backgrounds)
- `images/brand/logo-mark.svg`: the marquise "A" on its own
- `images/brand/logo-wordmark.svg`: AURANTIA on its own
- the same three ending in `-teal.svg`, for light backgrounds
- `images/brand/favicon.svg` / `favicon.png` / `apple-touch-icon.png`: browser and phone icons
- `images/brand/original-logo-source.jpg`: the original image everything was measured from

The lettering is drawn from the fonts that match your logo letter by letter: **Cormorant Garamond SemiBold** for AURANTIA and **Montserrat** for "Jewelry & Accessories" (both in `assets/fonts/`). `scripts/build-logo.py` rebuilds the SVGs. If your designer has the original logo as an AI, EPS, PDF or SVG file, upload that instead; it's always the most accurate.

Site colours come from the logo artwork: deep teal (`#01323d`), bright teal (`#025c67`), sea-green (`#3d6353`) and sage silk, with the logo gold (`#e3c367`) kept for the logo and fine lines. They're all at the top of `assets/styles.css`.

### The "Satin Current" art piece

`art/satin-current.html` is generative art made for Aurantia: gold satin threads that echo the two wave lines in your logo. Open it in any browser, choose a format (post, story, square or website hero), and press **Next →** to see a new design for each seed number. **Download PNG** saves it for Instagram. Some ready-made stills are in `art/stills/`. `art/satin-current.md` explains the idea behind it.

---

## 5. Turn on online payment (Safepay)

Safepay is a Pakistani payment company. Customers pay by card or wallet on Safepay's own secure page, so you never handle card numbers.

1. Sign up as a merchant at https://getsafepay.com. They will ask for business documents (CNIC, bank account; a registered business helps).
2. In the Safepay dashboard, start in **Sandbox** (test mode). Find **Developers → API keys**. Copy:
   - the **API key** (public key), and
   - the **Secret key**.
3. Under **Developers → Webhooks**, add this address, then copy the **webhook secret**:
   `https://aurantia.netlify.app/api/safepay-webhook`
4. In Netlify: **Project configuration → Environment variables → Add a variable**. Add each one:

   | Key | Value |
   |---|---|
   | `SAFEPAY_ENV` | `sandbox` (change to `production` when going live) |
   | `SAFEPAY_API_KEY` | your API key |
   | `SAFEPAY_SECRET_KEY` | your secret key |
   | `SAFEPAY_WEBHOOK_SECRET` | your webhook secret |

5. **Deploys → Trigger deploy → Deploy site** so the new keys take effect.
6. Place a test order with **Pay online** and use Safepay's test card from their docs.
7. When it works, switch to your **production** keys and set `SAFEPAY_ENV` to `production`.

> 🔐 **Environment variables** are secret settings. They live in Netlify, not in your files, so nobody looking at your GitHub can see them. **Never paste a secret key into a file.**

> ⚠️ Safepay updates its systems from time to time. The connection code is in `netlify/lib/safepay.mjs`. If your dashboard docs show different addresses, that's the one file to update.

---

## 6. Turn on confirmation emails (Resend)

Resend sends the receipt email. Its free plan is plenty for a small shop (check resend.com/pricing for current limits).

1. Sign up at https://resend.com.
2. **Domains → Add domain**. Emails must come from a domain you own (see section 8). Resend shows a few DNS records; add them where you bought the domain. Until then, you can test with Resend's own sending address, but that only delivers to your own email.
3. **API Keys → Create API key**. Copy it.
4. In Netlify environment variables, add:

   | Key | Value |
   |---|---|
   | `RESEND_API_KEY` | the key |
   | `EMAIL_FROM` | `Aurantia <orders@aurantia.pk>` |
   | `OWNER_EMAIL` | your own email. You get a copy of every order here |

5. Trigger a new deploy.

---

## 7. Turn on WhatsApp confirmations

This sends the customer an automatic WhatsApp message from your business number. It uses Meta's **WhatsApp Cloud API**. Meta charges per confirmation message delivered; Pakistan's rate for utility messages is listed on Meta's WhatsApp pricing page.

> ⚠️ The number you use for the API **can't stay on the normal WhatsApp Business app** at the same time. Many shops use a second number for automatic messages and keep 0347-5919571 for chatting.

1. Go to https://developers.facebook.com → **My Apps → Create App → Business** → add **WhatsApp**.
2. Connect your **Meta Business account** and add a phone number. Note its **Phone number ID**.
3. Create a **permanent access token**: Business Settings → System users → add a user → Generate token with `whatsapp_business_messaging` permission.
4. **Create a message template** (WhatsApp Manager → Message templates):
   - Category: **Utility**
   - Name: `order_confirmation`
   - Language: **English**
   - Body (exactly four blanks, in this order):
     ```
     Hi {{1}}, thank you for shopping with Aurantia! We've received order {{2}} for {{3}} ({{4}}). Please reply YES to confirm so we can pack it. We'll message you when it's on its way.
     ```
     The "reply YES" step matters for cash on delivery: only ship orders that confirm. It cuts the parcels that get refused at the door.
   - Submit and wait for approval (usually minutes to a day).
5. In Netlify environment variables, add:

   | Key | Value |
   |---|---|
   | `WHATSAPP_TOKEN` | the permanent token |
   | `WHATSAPP_PHONE_ID` | the Phone number ID |
   | `WHATSAPP_TEMPLATE` | `order_confirmation` |
   | `WHATSAPP_TEMPLATE_LANG` | `en` |

6. Trigger a new deploy.

**Launching before WhatsApp is approved is fine.** If any setting is missing, that message is simply skipped and the order still goes through.

---

## 8. Use your own domain

A domain like **aurantia.pk** costs about PKR 3,000–5,000 a year (from PKNIC resellers) or use **aurantia.store / aurantiajewelry.com** from Namecheap or Cloudflare.

1. Buy the domain.
2. In Netlify: **Domain management → Add a domain** → type it → follow the DNS instructions shown.
3. Netlify adds the padlock (HTTPS) for free.
4. Update the Safepay webhook address to the new domain.

---

## 9. See your orders

- **Every order emails you** at `OWNER_EMAIL` with the full details and address.
- Orders are also stored in Netlify: **Project → Blobs → orders**. Each entry is one order, filed by order number.
- **Online payments:** check them in your Safepay dashboard. An order marked `payment_review` means the return signature didn't match. Check Safepay before sending it.

---

## 10. I want to…

| I want to… | Do this |
|---|---|
| Change a price | Edit `price` in the Google Sheet |
| Run a sale | Type a number in `sale_price` |
| Add a product | Upload photos to `images/products`, add a row to the sheet |
| Hide a product | `hidden` → `TRUE` |
| Mark sold out | `stock` → `0` |
| Change delivery fee | `deliveryFee` in `data/store.json` |
| Change the WhatsApp number | `whatsappNumber` in `data/store.json` |
| Change the brand colours | The `:root { … }` block at the top of `assets/styles.css` |
| Change the hero or story text | Search for the words in `index.html` and edit them |
| Edit the policies | Edit `privacy.html`, `terms.html`, `cookies.html` directly |
| Undo a mistake | GitHub → the file → **History** → pick the old version → copy it back. Or in Netlify: **Deploys** → an older deploy → **Publish deploy** |
| Test changes before they go live | Make a new **branch** on GitHub; Netlify gives it its own preview link |

---

## 11. Before you launch

- [ ] Real prices in the sheet, and `sampleMode` set to `false`
- [ ] Your real email in `data/store.json`
- [ ] Delivery fee and free-delivery amount are what you want
- [ ] Read **Terms & Conditions**, especially *Exchanges and refunds*, and change it to match what you really offer
- [ ] Have a lawyer glance over the three policy pages. They're a solid starting point written for a small Pakistani online shop, but they aren't legal advice
- [ ] One test order of each kind: Pay online (sandbox), Cash on delivery, WhatsApp
- [ ] You received the owner email; the customer email and WhatsApp arrived
- [ ] Safepay switched to **production**

---

## 12. If something goes wrong

| Problem | Likely cause and fix |
|---|---|
| Products don't show | A typo in `data/store.json` or `products.json` (a missing comma or quote). Paste the file into https://jsonlint.com to find it. |
| Sheet changes don't appear | Wait 5 minutes. Check you published **Sheet1** as **CSV**, and the link is in `sheetCsvUrl`. |
| "Online payment isn't switched on yet" | The Safepay variables are missing. See section 5, then redeploy. |
| No email arrives | Check `RESEND_API_KEY` and `EMAIL_FROM`, and that your domain is verified in Resend. |
| No WhatsApp arrives | The template isn't approved yet, or the token expired. Netlify → **Logs → Functions** shows the exact error after each order (look for lines starting `notify`). |
| A photo is missing | The file name in the sheet must match exactly, including `.jpg` and capital letters. |

**Seeing errors:** Netlify → your project → **Logs → Functions** shows what each back-room program did. Every order writes a line like:

```
notify AUR-261020-7KQ2 {"customerEmail":{"ok":true},"ownerEmail":{"ok":true},"whatsapp":{"skipped":"whatsapp not set up"}}
```

### For the curious: running it on your own computer

1. Install Node.js 20+ from https://nodejs.org
2. In a terminal inside this folder: `npm install`
3. `npm test` runs the back-room checks (fake payments, fake messages).
4. `npx netlify-cli dev` runs the whole site at http://localhost:8888, functions included.
