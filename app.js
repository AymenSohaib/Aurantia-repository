/*
  LESSON 3 — app.js is the shop assistant that lives in the visitor's browser.

  It runs on every page. Look for the big ==== headings:
    1. Settings and helpers
    2. Loading your products
    3. Shared parts of every page (header, footer, bag, checkout)
    4. Home page: filters, product grid, quizzes, Instagram, the prologue, gold dust
    5. Product page: gallery, details, sticky buy button
    6. The bag (cart)
    7. Checkout
    8. Start-up

  You normally never edit this file. Products live in your Google Sheet
  (or data/products.json); settings live in data/store.json.

  Small JavaScript glossary:
    const x = 5        → a named value that won't change
    let y = 5          → a named value that can change
    function f(a) {}   → a reusable recipe; f(3) runs it with a = 3
    async / await      → "wait for this to finish" (e.g. downloading a file)
    `Hi ${name}`       → text with a value dropped in
*/
(() => {
  "use strict";

  // ==== 1. SETTINGS AND HELPERS ==============================================

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const PAGE = document.body.dataset.page || window.AURANTIA_PAGE;   // "home" or "product"

  // Pretty product links (/p/amber-honey-studs) only work on Netlify.
  // In the Claude preview we use product.html#id; on your own computer, product.html?id=…
  const PREVIEW = Boolean(window.AURANTIA_PREVIEW);
  const LOCAL = ["localhost", "127.0.0.1", ""].includes(location.hostname);
  const productUrl = id => PREVIEW ? `product.html#${id}` : LOCAL ? `product.html?id=${id}` : `/p/${id}`;
  const homeUrl = PREVIEW || LOCAL ? "index.html" : "/";

  const state = {
    settings: {},
    products: [],
    cart: [],              // e.g. [{ id: "amber-honey-studs", qty: 2 }]
    filter: "All",
    query: "",
    quizzes: [],
    prologue: null,
  };

  // Makes text safe to put inside HTML (so a product name can't break the page)
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // 1450 → "Rs 1,450"
  const money = n => `${state.settings.currencySymbol || "Rs"} ${Math.round(n).toLocaleString("en-PK")}`;
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // ==== 2. LOADING YOUR PRODUCTS =============================================

  async function loadJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Couldn't load ${path}`);
    return res.json();
  }

  async function loadProducts(settings) {
    if (settings.sheetCsvUrl) {
      try {
        const res = await fetch(settings.sheetCsvUrl, { cache: "no-store" });
        if (res.ok) return parseCsv(await res.text()).map(normalize).filter(Boolean);
      } catch (e) { console.warn("Google Sheet didn't load; using products.json instead.", e); }
    }
    return (await loadJson("data/products.json")).map(normalize).filter(Boolean);
  }

  // Turns CSV text (what Google Sheets publishes) into a list of rows.
  // It understands quotes, so "Light, open hoops" stays one cell.
  function parseCsv(text) {
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

  // Cleans up one product row: numbers become numbers, "TRUE" becomes true, lists are split on |
  function normalize(p) {
    const num = v => Number(String(v ?? "").replace(/[^0-9.]/g, ""));
    const yes = v => v === true || /^(true|yes|y|1)$/i.test(String(v ?? "").trim());
    const list = v => String(v ?? "").split("|").map(s => s.trim()).filter(Boolean);
    const price = num(p.price);
    if (!p.id || !p.name || !price) return null;            // skip incomplete rows
    const sale = num(p.sale_price);
    const stockText = String(p.stock ?? "").trim();
    return {
      id: String(p.id).trim(),
      name: String(p.name).trim(),
      category: String(p.category || "Other").trim(),
      price,
      sale: sale > 0 && sale < price ? sale : null,
      get now() { return this.sale ?? this.price; },          // the price customers pay
      image: String(p.image || "").trim(),
      image2: String(p.image2 || "").trim(),
      hook: String(p.hook || "").trim(),                      // e.g. "big pearl energy"
      description: String(p.description || "").trim(),
      pairs: list(p.pairs),                                   // "wear it to" list
      details: list(p.details),                               // e.g. "Size: 2 cm | Closure: push-back"
      occasion: list(String(p.occasion || "").replace(/,/g, "|")),
      badge: String(p.badge || "").trim(),                    // e.g. "New" or "Bestseller"
      stock: stockText === "" ? Infinity : Math.max(0, parseInt(stockText, 10) || 0),
      featured: yes(p.featured),
      hidden: yes(p.hidden),
      tags: String(p.tags || "").toLowerCase(),
    };
  }

  const live = () => state.products.filter(p => !p.hidden);
  const byId = id => state.products.find(p => p.id === id);
  const maxQty = p => (Number.isFinite(p.stock) ? p.stock : 20);

  // ==== 3. SHARED PARTS OF EVERY PAGE ========================================

  function renderChrome() {
    const s = state.settings;
    const free = s.freeDeliveryOver ? `Free delivery over <b>${money(s.freeDeliveryOver)}</b>` : "";
    $("#site-header").innerHTML = `
      ${free || s.sampleMode ? `<div class="announce"><div class="wrap">
        ${free ? `<span>${free}</span>` : ""}
        ${s.sampleMode ? `<span>Prices are placeholders while the shop is set up</span>` : ""}
      </div></div>` : ""}
      <header class="topbar">
        <div class="wrap topbar__inner">
          <a class="wordmark" href="${homeUrl}" aria-label="Aurantia home"><img class="wordmark__mark" src="images/brand/logo-mark.svg" alt=""><img src="images/brand/logo-wordmark.svg" alt="Aurantia"></a>
          <nav class="nav" aria-label="Main">
            <a href="${homeUrl}#shop">Shop</a>
            <a href="${homeUrl}#aura">Find your piece</a>
            <a href="${homeUrl}#instagram">Instagram</a>
          </nav>
          <button class="bag-btn" id="bagOpen" type="button" aria-label="Open bag">Bag <span class="bag-btn__count" id="bagCount">0</span></button>
        </div>
      </header>`;

    $("#site-footer").innerHTML = `
      <footer class="footer"><div class="wrap footer__inner">
        <div>
          <img class="footer__lockup" src="images/brand/logo-lockup.svg" alt="Aurantia — Jewelry &amp; Accessories">
          <p class="footer__tag">Wear your Aura</p>
        </div>
        <div>
          <h4>Talk to us</h4>
          <ul>
            <li>WhatsApp <span class="selectable">+${esc(s.whatsappNumber)}</span></li>
            <li>Email <span class="selectable">${esc(s.email)}</span></li>
            <li><a href="https://instagram.com/${esc(s.instagram)}" target="_blank" rel="noopener">@${esc(s.instagram)}</a></li>
          </ul>
        </div>
        <div>
          <h4>Policies</h4>
          <ul>
            <li><a href="terms.html">Terms &amp; Conditions</a></li>
            <li><a href="privacy.html">Privacy Policy</a></li>
            <li><a href="cookies.html">Cookie Policy</a></li>
          </ul>
        </div>
        <p class="footer__small">© ${new Date().getFullYear()} Aurantia. Prices in PKR.</p>
      </div></footer>

      <div class="scrim" id="scrim" hidden></div>
      <aside class="drawer" id="drawer" aria-label="Your bag" aria-hidden="true">
        <div class="drawer__head"><h2>Your bag</h2><button class="icon-btn" id="bagClose" type="button" aria-label="Close bag">✕</button></div>
        <div class="drawer__body" id="bagItems"></div>
        <div class="drawer__foot" id="bagFoot">
          <div class="totals" id="bagTotals"></div>
          <button class="btn btn--emerald btn--block" id="toCheckout" type="button">Checkout</button>
          <button class="btn btn--line btn--block" id="bagWhatsapp" type="button">Order on WhatsApp instead</button>
        </div>
      </aside>

      <dialog class="modal" id="checkout" aria-label="Checkout">
        <form class="checkout" id="checkoutForm" novalidate>
          <div class="checkout__head"><h2>Checkout</h2><button class="icon-btn" type="button" data-close aria-label="Close checkout">✕</button></div>
          <div class="checkout__cols">
            <fieldset class="checkout__fields">
              <legend>Your details</legend>
              <label>Full name<input id="cName" name="name" required autocomplete="name"></label>
              <label>Email (for your receipt)<input id="cEmail" name="email" type="email" required autocomplete="email"></label>
              <label>WhatsApp number<input id="cPhone" name="phone" type="tel" required placeholder="03xx xxxxxxx" autocomplete="tel"></label>
              <label>Address<textarea id="cAddress" name="address" rows="2" required autocomplete="street-address"></textarea></label>
              <div class="row2">
                <label>City<input id="cCity" name="city" required autocomplete="address-level2"></label>
                <label>Note<input id="cNote" name="note" placeholder="Optional: landmark, timing…"></label>
              </div>
              <label class="gift"><input type="checkbox" id="cGift"> This is a gift</label>
              <label id="giftNoteWrap" hidden>Gift message (we'll write it on a card, and leave prices off the parcel)<textarea id="cGiftNote" rows="2" maxlength="200" placeholder="Happy birthday, wear your aura!"></textarea></label>

              <legend class="legend2">How would you like to pay?</legend>
              <div class="paygroup" role="radiogroup">
                <label class="pay"><input type="radio" name="method" value="online" checked><span><b>Pay online</b><small>Card or mobile wallet via Safepay${s.prepaidFreeDelivery ? " · <em>free delivery</em>" : ""}</small></span></label>
                <label class="pay"><input type="radio" name="method" value="cod"><span><b>Cash on delivery</b><small>Pay the rider when it arrives</small></span></label>
                <label class="pay"><input type="radio" name="method" value="whatsapp"><span><b>Confirm on WhatsApp</b><small>We message you to arrange payment</small></span></label>
              </div>
            </fieldset>
            <div class="checkout__summary">
              <h3>Order summary</h3>
              <div id="summaryItems"></div>
              <div class="totals" id="summaryTotals"></div>
              <p class="form-error" id="formError" role="alert" hidden></p>
              <button class="btn btn--emerald btn--block" id="placeOrder" type="submit">Place order</button>
              <p class="agree">By placing your order you agree to our <a href="terms.html" target="_blank">Terms</a> and <a href="privacy.html" target="_blank">Privacy Policy</a>.</p>
              <p class="fineprint">You'll get a confirmation by email and WhatsApp.</p>
            </div>
          </div>
        </form>
      </dialog>

      <div class="cookie-note" id="cookieNote" hidden>
        <span>We only save your bag in this browser. No ads, no tracking. <a href="cookies.html">More</a></span>
        <button class="btn btn--emerald" id="cookieOk" type="button">OK</button>
      </div>
      <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>`;
  }

  let toastTimer;
  function toast(text) {
    const t = $("#toast");
    t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2400);
  }

  function cookieNotice() {
    if (store.get("aurantia-notice", false)) return;
    $("#cookieNote").hidden = false;
    $("#cookieOk").onclick = () => { $("#cookieNote").hidden = true; store.set("aurantia-notice", true); };
  }

  // Honest labels only: low stock and sold out are worked out from the stock number
  function flag(p) {
    if (p.stock === 0) return `<span class="flag flag--out">Sold out</span>`;
    if (p.stock <= 3) return `<span class="flag flag--low">Only ${p.stock} left</span>`;
    if (p.sale) return `<span class="flag flag--sale">Sale</span>`;
    if (p.badge) return `<span class="flag">${esc(p.badge)}</span>`;
    return "";
  }
  const priceHtml = p => p.sale ? `<s>${money(p.price)}</s><span>${money(p.sale)}</span>` : `<span>${money(p.price)}</span>`;

  function cardHtml(p) {
    const out = p.stock === 0;
    return `<article class="card">
      ${flag(p)}
      <div class="card__media">
        ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : ""}
        ${p.image2 ? `<img class="alt" src="${esc(p.image2)}" alt="" loading="lazy">` : ""}
      </div>
      <div class="card__body">
        <span class="card__cat">${esc(p.category)}</span>
        <a class="card__name" href="${productUrl(p.id)}">${esc(p.name)}</a>
        <div class="card__row">
          <span class="price">${priceHtml(p)}</span>
          <button class="add" type="button" data-add="${esc(p.id)}" ${out ? "disabled" : ""}>${out ? "Sold out" : "Add to bag"}</button>
        </div>
      </div>
    </article>`;
  }

  // ==== 4. HOME PAGE =========================================================

  // Filter pills: categories, then occasions, then a budget filter
  const BUDGET = 1500;
  function renderFilters() {
    const cats = [...new Set(live().map(p => p.category))];
    const occ = [...new Set(live().flatMap(p => p.occasion))];
    const hasBudget = live().some(p => p.now <= BUDGET);
    const pill = v => `<button class="pill" type="button" data-filter="${esc(v)}" aria-pressed="${state.filter === v}">${esc(v === "budget" ? `Under ${money(BUDGET)}` : v)}</button>`;
    $("#filters").innerHTML = [
      pill("All"), ...cats.map(pill),
      occ.length ? `<span class="filters__sep"></span>` : "", ...occ.map(pill),
      hasBudget ? pill("budget") : "",
      `<label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="2"/></svg><span class="visually-hidden">Search</span><input id="search" type="search" placeholder="Search pearl, amber, set…" value="${esc(state.query)}"></label>`,
    ].join("");
  }

  function filtered() {
    const f = state.filter, q = state.query.trim().toLowerCase();
    return live()
      .filter(p => f === "All" || p.category === f || p.occasion.includes(f) || (f === "budget" && p.now <= BUDGET))
      .filter(p => !q || `${p.name} ${p.category} ${p.tags} ${p.hook} ${p.description}`.toLowerCase().includes(q))
      .sort((a, b) => ((b.stock > 0) - (a.stock > 0)) || (b.featured - a.featured));
  }

  function renderGrid() {
    const list = filtered();
    $("#resultCount").textContent = `${list.length} piece${list.length === 1 ? "" : "s"}`;
    $("#productGrid").innerHTML = list.length ? list.map(cardHtml).join("")
      : `<p class="grid__empty">Nothing matches that yet. Try another word or filter.</p>`;
  }

  // ---- QUIZZES ---------------------------------------------------------------
  // The quizzes are written in data/quizzes.json. Each answer gives points to
  // words; a product earns those points when the word is in its tags, occasion
  // or category. So new products are matched automatically if they're tagged.

  let quiz = null;   // { def, step, score: {word: points}, only: {...}, picks: [] }

  // every word that describes a product, lowercased: tags + occasion + category
  function productWords(p) {
    const words = new Set(p.tags.split(",").map(w => w.trim()).filter(Boolean));
    p.occasion.forEach(o => words.add(o.toLowerCase()));
    words.add(p.category.toLowerCase());
    return words;
  }

  function scoreProduct(p, score) {
    let total = 0;
    const why = [];
    for (const w of productWords(p)) if (score[w]) { total += score[w]; why.push([w, score[w]]); }
    why.sort((a, b) => b[1] - a[1]);
    return { total, why: why.slice(0, 3).map(([w]) => w.replace(/-/g, " ")) };
  }

  function quizMatches() {
    const only = quiz.only;
    const pool = live().filter(p => p.stock !== 0)
      .filter(p => !only.category || p.category.toLowerCase() === String(only.category).toLowerCase())
      .filter(p => !only.maxPrice || p.now <= only.maxPrice);
    return pool
      .map(p => ({ p, ...scoreProduct(p, quiz.score) }))
      .sort((a, b) => (b.total - a.total) || (b.p.featured - a.p.featured) || (a.p.now - b.p.now))
      .slice(0, 3);
  }

  function renderQuizPicker() {
    const list = state.quizzes;
    $("#quizPicker").innerHTML = list.map(q => `
      <button class="quiz-card" type="button" role="tab" data-quiz="${esc(q.id)}" aria-selected="${quiz && quiz.def.id === q.id}">
        <b>${esc(q.title)}</b>
        <span>${esc(q.teaser || "")}</span>
        <small>${q.questions.length} questions</small>
      </button>`).join("");
  }

  function startQuiz(id) {
    const def = state.quizzes.find(q => q.id === id) || state.quizzes[0];
    if (!def) { $("#aura").hidden = true; return; }
    quiz = { def, step: 0, score: {}, only: { ...(def.only || {}) } };
    renderQuizPicker();
    $("#chat").innerHTML = `<div class="bubble bubble--them">${esc(def.intro || "ready?")}</div>`;
    renderQuizStep();
  }

  function renderQuizStep() {
    const { def, step } = quiz;
    const total = def.questions.length;
    $("#quizProgress").innerHTML = def.questions.map((_, i) => `<i class="${i < step ? "done" : i === step ? "now" : ""}"></i>`).join("");
    if (step < total) {
      const q = def.questions[step];
      $("#chat").insertAdjacentHTML("beforeend", `<div class="bubble bubble--them">${esc(q.q)}</div>`);
      $("#quizStep").textContent = `Question ${step + 1} of ${total}`;
      $("#answers").innerHTML = q.answers.map((a, i) =>
        `<button class="answer" type="button" data-answer="${i}"><b>${"ABCDE"[i]}</b>${esc(a.label)}</button>`).join("");
      $("#quizResult").innerHTML = "";
      return;
    }
    renderQuizResult();
  }

  function answerQuiz(i) {
    const a = quiz.def.questions[quiz.step].answers[i];
    $("#chat").insertAdjacentHTML("beforeend", `<div class="bubble bubble--me">${"ABCDE"[i]}) ${esc(a.label)}</div>`);
    for (const [w, n] of Object.entries(a.points || {})) quiz.score[w.toLowerCase()] = (quiz.score[w.toLowerCase()] || 0) + n;
    Object.assign(quiz.only, a.only || {});
    quiz.step++;
    $("#answers").innerHTML = "";
    setTimeout(renderQuizStep, 380);
  }

  function renderQuizResult() {
    const matches = quizMatches();
    const { def } = quiz;
    const s = state.settings;
    $("#answers").innerHTML = "";
    $("#quizStep").textContent = "Your matches";
    const others = state.quizzes.filter(q => q.id !== def.id);
    const again = `
      <div class="quiz-next">
        <button class="btn btn--line" type="button" data-quiz="${esc(def.id)}">Take it again</button>
        ${others.map(q => `<button class="pill" type="button" data-quiz="${esc(q.id)}">${esc(q.title)}</button>`).join("")}
      </div>`;

    if (!matches.length) {
      const wa = `https://wa.me/${s.whatsappNumber}?text=${encodeURIComponent("Hi Aurantia! I took the " + def.title + " quiz but nothing matched. Can you suggest something?")}`;
      $("#chat").insertAdjacentHTML("beforeend", `<div class="bubble bubble--them">Nothing in stock matches that yet. Tell us what you're looking for and we'll help.</div>`);
      $("#quizResult").innerHTML = `<a class="btn btn--wa" href="${wa}" target="_blank" rel="noopener">Ask us on WhatsApp</a>${again}`;
      return;
    }

    const [best, ...rest] = matches;
    $("#chat").insertAdjacentHTML("beforeend", `<div class="bubble bubble--them">${esc(def.result || "Our pick for you:")} <b>${esc(best.p.name)}</b></div>`);
    const why = m => m.why.length ? `<span class="why">${m.why.map(w => `<span>${esc(w)}</span>`).join("")}</span>` : "";
    $("#quizResult").innerHTML = `
      <div class="result">
        ${best.p.image ? `<img src="${esc(best.p.image2 || best.p.image)}" alt="">` : "<span></span>"}
        <div>
          <span class="caps" style="color:var(--gold)">Best match</span>
          <h3>${esc(best.p.name)}</h3>
          ${why(best)}
          <p class="price" style="margin-top:6px">${priceHtml(best.p)}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn--gold" type="button" data-add="${esc(best.p.id)}">Add to bag</button>
            <a class="btn btn--line" href="${productUrl(best.p.id)}" style="color:#fff3d6">See it</a>
          </div>
        </div>
      </div>
      ${rest.length ? `<p class="quiz__also">Also a great match</p><div class="also">${rest.map(m => `
        <a class="also__item" href="${productUrl(m.p.id)}">
          ${m.p.image ? `<img src="${esc(m.p.image)}" alt="">` : ""}
          <span><b>${esc(m.p.name)}</b>${why(m)}<span class="price">${priceHtml(m.p)}</span></span>
        </a>`).join("")}</div>` : ""}
      ${def.tip ? `<p class="quiz__tip"><span class="tick">✓</span>${esc(def.tip)}</p>` : ""}
      ${again}`;
  }

  function renderInstagram() {
    const s = state.settings;
    $("#igFollow").href = `https://instagram.com/${s.instagram}`;
    $("#igFollow").textContent = `Follow @${s.instagram}`;
  }

  // ---- THE PROLOGUE ----------------------------------------------------------
  // A short brand story told like Instagram stories: progress bars, tap the
  // right side (or swipe) for the next chapter, the left side to go back.
  // It moves on by itself and pauses while you hold or hover. The last chapter
  // asks where the visitor's story goes next and links to a quiz or the shop.
  function startPrologue(data) {
    const box = $("#prologue");
    const chapters = (data && data.chapters) || [];
    if (!box || !chapters.length) { if (box) box.hidden = true; return; }
    const seconds = Number(data.seconds) || 6;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let i = 0, timer = null, paused = false;

    box.style.setProperty("--dur", `${seconds}s`);
    box.innerHTML = `
      <div class="prologue__silk" aria-hidden="true"></div>
      <div class="prologue__bars" aria-hidden="true">${chapters.map(() => "<i><b></b></i>").join("")}</div>
      <div class="prologue__top"><img src="images/brand/logo-mark.svg" alt=""><span id="proLabel"></span></div>
      <div class="prologue__body" id="proBody" aria-live="polite"></div>
      <div class="prologue__nav">
        <button type="button" id="proPrev" aria-label="Previous chapter">‹</button>
        <span class="prologue__hint" id="proHint"></span>
        <button type="button" id="proNext" aria-label="Next chapter">›</button>
      </div>
      <button class="prologue__tap prologue__tap--prev" type="button" aria-label="Previous chapter" tabindex="-1"></button>
      <button class="prologue__tap prologue__tap--next" type="button" aria-label="Next chapter" tabindex="-1"></button>`;

    function show(n) {
      i = Math.max(0, Math.min(chapters.length - 1, n));
      const c = chapters[i], last = i === chapters.length - 1;
      $$(".prologue__bars i", box).forEach((bar, k) => {
        bar.className = k < i ? "done" : k === i && !last ? "now" : k === i ? "done" : "";
        const b = bar.querySelector("b"); b.style.animation = "none"; void b.offsetWidth; b.style.animation = "";
      });
      $("#proLabel").textContent = c.label || "";
      $("#proBody").innerHTML = `
        <p class="prologue__line">${esc(c.line)}</p>
        ${c.small ? `<p class="prologue__small">${esc(c.small)}</p>` : ""}
        ${c.choices ? `<div class="prologue__choices">${c.choices.map(ch => `<a class="prologue__choice" href="${esc(ch.href)}" data-go="${esc(ch.href)}">${esc(ch.label)}</a>`).join("")}</div>` : ""}`;
      $("#proPrev").disabled = i === 0;
      $("#proNext").disabled = last;
      $("#proHint").textContent = last ? "Your story, your choice" : `${i + 1} of ${chapters.length}`;
      box.classList.toggle("final", last);
      clearTimeout(timer);
      if (!last && !still && !paused) timer = setTimeout(() => show(i + 1), seconds * 1000);
    }
    function pause(on) {
      paused = on; box.classList.toggle("paused", on);
      clearTimeout(timer);
      if (!on && i < chapters.length - 1 && !still) timer = setTimeout(() => show(i + 1), seconds * 1000 * 0.6);
    }

    box.addEventListener("click", e => {
      if (e.target.closest("#proNext, .prologue__tap--next")) show(i + 1);
      if (e.target.closest("#proPrev, .prologue__tap--prev")) show(i - 1);
      const go = e.target.closest("[data-go]");
      if (go && go.dataset.go.startsWith("#quiz-")) {
        e.preventDefault();
        startQuiz(go.dataset.go.slice(6));
        $("#aura").scrollIntoView({ behavior: still ? "auto" : "smooth" });
      }
    });
    box.addEventListener("mouseenter", () => pause(true));
    box.addEventListener("mouseleave", () => pause(false));
    // swipe on phones
    let x0 = null;
    box.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; pause(true); }, { passive: true });
    box.addEventListener("touchend", e => {
      const dx = e.changedTouches[0].clientX - (x0 ?? 0);
      if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
      x0 = null; pause(false);
    });
    box.tabIndex = 0;
    box.addEventListener("keydown", e => { if (e.key === "ArrowRight") show(i + 1); if (e.key === "ArrowLeft") show(i - 1); });

    // only start the clock when the prologue scrolls into view
    new IntersectionObserver(([en], obs) => { if (en.isIntersecting) { show(0); obs.disconnect(); } }, { threshold: 0.35 }).observe(box);
    show(0); clearTimeout(timer);
  }

  // ---- TWINKLES over the opening (like the sparkle in the logo artwork) ----
  // Soft gold specks drift upward and twinkle; every so often one flares into a
  // four-point star. People who switch off motion on their phone still see them,
  // just standing still.
  function heroDust() {
    const canvas = $("#heroDust");
    if (!canvas) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, dpr = 1, specks = [], running = true;

    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.max(38, Math.min(110, (w * h) / 8500)));
      specks = Array.from({ length: n }, (_, k) => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.6 + 0.6,
        star: k % 8 === 0,                          // one in eight can flare into a star
        vx: (Math.random() - 0.5) * 0.14, vy: -(Math.random() * 0.22 + 0.05),
        phase: Math.random() * Math.PI * 2, speed: Math.random() * 0.025 + 0.012,
      }));
      if (still) draw();
    }

    function star(x, y, size, alpha) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, size * 1.4);
      g.addColorStop(0, `rgba(255, 244, 210, ${alpha})`);
      g.addColorStop(1, "rgba(255, 220, 140, 0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, size * 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255, 248, 225, ${alpha})`;
      ctx.beginPath();                                // four-point star
      ctx.moveTo(x, y - size); ctx.quadraticCurveTo(x, y, x + size * 0.22, y);
      ctx.quadraticCurveTo(x, y, x, y + size); ctx.quadraticCurveTo(x, y, x - size * 0.22, y);
      ctx.quadraticCurveTo(x, y, x, y - size); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - size * 0.75, y); ctx.quadraticCurveTo(x, y, x, y - size * 0.18);
      ctx.quadraticCurveTo(x, y, x + size * 0.75, y); ctx.quadraticCurveTo(x, y, x, y + size * 0.18);
      ctx.quadraticCurveTo(x, y, x - size * 0.75, y); ctx.fill();
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const p of specks) {
        const glow = 0.2 + 0.8 * Math.max(0, Math.sin(p.phase));          // twinkle
        ctx.fillStyle = `rgba(244, 214, 140, ${0.22 + glow * 0.55})`;
        ctx.shadowColor = "rgba(244, 204, 108, 0.9)"; ctx.shadowBlur = 6 * glow;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.7 + glow * 0.7), 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        if (p.star && glow > 0.7) star(p.x, p.y, 5 + p.r * 4 * glow, (glow - 0.55) * 1.6);
      }
    }

    function frame() {
      if (!running) return;
      for (const p of specks) {
        p.x += p.vx; p.y += p.vy; p.phase += p.speed;
        if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
        if (p.x < -8) p.x = w + 8; if (p.x > w + 8) p.x = -8;
      }
      draw();
      requestAnimationFrame(frame);
    }

    window.addEventListener("resize", resize);
    resize();
    if (still) return;
    // pause when the opening is scrolled out of view, to save battery
    new IntersectionObserver(([en]) => { const was = running; running = en.isIntersecting; if (running && !was) frame(); }).observe(canvas);
    frame();
  }

  function startHome() {
    renderFilters(); renderGrid(); renderInstagram(); heroDust();
    startPrologue(state.prologue);
    // a link ending in #quiz-gift (etc.) opens that quiz directly
    const wanted = location.hash.startsWith("#quiz-") ? location.hash.slice(6) : "";
    startQuiz(wanted);
    if (wanted) setTimeout(() => $("#aura").scrollIntoView(), 50);

    $("#filters").addEventListener("click", e => {
      const b = e.target.closest("[data-filter]");
      if (!b) return;
      state.filter = b.dataset.filter;
      $$("#filters .pill").forEach(x => x.setAttribute("aria-pressed", x === b));
      renderGrid();
    });
    $("#filters").addEventListener("input", e => { if (e.target.id === "search") { state.query = e.target.value; renderGrid(); } });
    $("#answers").addEventListener("click", e => { const a = e.target.closest("[data-answer]"); if (a) answerQuiz(Number(a.dataset.answer)); });
    $("#aura").addEventListener("click", e => { const q = e.target.closest("[data-quiz]"); if (q) startQuiz(q.dataset.quiz); });

    const pay = new URLSearchParams(location.search).get("payment");
    if (pay === "cancelled") toast("Payment cancelled. Your bag is still here.");
  }

  // ==== 5. PRODUCT PAGE ======================================================

  function productIdFromUrl() {
    const m = location.pathname.match(/\/p\/([^/?#]+)/);
    return decodeURIComponent((m && m[1]) || new URLSearchParams(location.search).get("id") || location.hash.slice(1) || "");
  }

  function startProduct() {
    const p = byId(productIdFromUrl());
    if (!p || p.hidden) {
      $("#pdp").innerHTML = `<div class="grid__empty" style="grid-column:1/-1">We couldn't find that piece. <a href="${homeUrl}#shop">See the whole collection</a>.</div>`;
      return;
    }
    const s = state.settings;
    document.title = `${p.name} · Aurantia`;
    $("#crumbs").innerHTML = `<a href="${homeUrl}#shop">Shop</a><span>/</span><a href="${homeUrl}#shop">${esc(p.category)}</a><span>/</span><span>${esc(p.name)}</span>`;

    const out = p.stock === 0;
    const stock = out ? `<p class="stock out">Sold out</p>` : p.stock <= 3 ? `<p class="stock low">Only ${p.stock} left</p>` : `<p class="stock">In stock, ready to ship</p>`;
    const wa = text => `https://wa.me/${s.whatsappNumber}?text=${encodeURIComponent(text)}`;
    const shots = [p.image, p.image2].filter(Boolean);
    let qty = 1;

    $("#pdp").innerHTML = `
      <div class="gallery">
        <div class="gallery__main">${shots[0] ? `<img id="mainShot" src="${esc(shots[0])}" alt="${esc(p.name)}">` : ""}</div>
        ${shots.length > 1 ? `<div class="gallery__thumbs">${shots.map((src, i) => `<button type="button" data-shot="${esc(src)}" aria-pressed="${i === 0}" aria-label="Photo ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join("")}</div>` : ""}
      </div>
      <div class="info">
        <span class="caps" style="color:var(--gold-deep)">${esc(p.category)}</span>
        <h1>${esc(p.name)}</h1>
        <p class="price">${priceHtml(p)}</p>
        <p class="info__desc">${esc(p.description)}</p>
        ${stock}
        <div class="buy" id="buyRow">
          ${out ? `<a class="btn btn--wa" href="${wa(`Hi Aurantia! Please tell me when ${p.name} is back in stock.`)}" target="_blank" rel="noopener">Tell me when it's back</a>` : `
          <div class="qty"><button type="button" data-q="-1" aria-label="Fewer">−</button><span id="qty">1</span><button type="button" data-q="1" aria-label="More">+</button></div>
          <button class="btn btn--emerald" type="button" id="addMain">Add to bag</button>
          <a class="btn btn--wa" href="${wa(`Hi Aurantia! I'd like to order ${p.name} (${money(p.now)}).`)}" target="_blank" rel="noopener">Order on WhatsApp</a>`}
        </div>
        ${state.quizzes.length ? `<p class="quiz-nudge">Not sure it's the one? <a href="${homeUrl}#quiz-${esc((state.quizzes.find(q => q.id === "gift") || state.quizzes[0]).id)}">Try the ${esc((state.quizzes.find(q => q.id === "gift") || state.quizzes[0]).title)}</a> or <a href="${homeUrl}#aura">another quiz</a>.</p>` : ""}
        <ul class="trust">
          <li><span class="tick">✓</span><span>Delivered in ${esc(s.deliveryTime || "a few working days")}${s.freeDeliveryOver ? `, free over ${money(s.freeDeliveryOver)}` : ""}</span></li>
          <li><span class="tick">✓</span><span>${s.exchangeDays || 3}-day exchange if it arrives damaged or wrong</span></li>
        </ul>
        <div class="acc">
          ${p.details.length ? `<details open><summary>Details</summary><div class="acc__body">${p.details.map(d => `<span>${esc(d)}</span>`).join("")}</div></details>` : ""}
          <details><summary>Delivery &amp; payment</summary><div class="acc__body">
            <span>Delivery is ${money(s.deliveryFee || 0)}${s.freeDeliveryOver ? `, free on orders over ${money(s.freeDeliveryOver)}` : ""}. Usually ${esc(s.deliveryTime || "a few working days")}.</span>
            <span>Pay online through Safepay, pay cash to the rider, or confirm your order with us on WhatsApp.</span>
          </div></details>
          <details><summary>Exchanges</summary><div class="acc__body">
            <span>If your piece arrives damaged or isn't what you ordered, message us within ${s.exchangeDays || 3} days with photos or an unboxing video. <a href="terms.html">Full terms</a>.</span>
          </div></details>
          <details><summary>Keeping the shine</summary><div class="acc__body">
            <span>Put perfume and lotion on before your jewelry, keep it away from water, and store each piece in its own pouch.</span>
          </div></details>
        </div>
      </div>`;

    // gallery thumbnails
    $("#pdp").addEventListener("click", e => {
      const t = e.target.closest("[data-shot]");
      if (t) { $("#mainShot").src = t.dataset.shot; $$("[data-shot]").forEach(b => b.setAttribute("aria-pressed", b === t)); }
      const q = e.target.closest("[data-q]");
      if (q) { qty = Math.min(maxQty(p), Math.max(1, qty + Number(q.dataset.q))); $("#qty").textContent = qty; }
      if (e.target.id === "addMain") addToBag(p.id, qty);
    });

    // mobile: keep a buy button on screen once the main one scrolls away
    const sticky = $("#stickyBuy");
    if (!out) {
      sticky.innerHTML = `<div class="sticky-buy__name">${esc(p.name)}<br><span class="price">${priceHtml(p)}</span></div><button class="btn btn--emerald" type="button">Add to bag</button>`;
      sticky.querySelector("button").onclick = () => addToBag(p.id, qty);
      const watch = new IntersectionObserver(([en]) => {
        sticky.classList.toggle("show", !en.isIntersecting);
        document.body.classList.toggle("has-sticky", !en.isIntersecting);
      });
      watch.observe($("#buyRow"));
    }

    // complete the look: other pieces, same category last
    const more = live().filter(x => x.id !== p.id && x.stock !== 0).sort((a, b) => (a.category === p.category) - (b.category === p.category)).slice(0, 4);
    if (more.length) { $("#moreSection").hidden = false; $("#moreGrid").innerHTML = more.map(cardHtml).join(""); }
  }

  // ==== 6. THE BAG ===========================================================
  // The bag is saved in this browser, so it's still there if the tab closes.

  const BAG = "aurantia-bag";
  const saveBag = () => store.set(BAG, state.cart);
  const bagLines = () => state.cart.map(l => ({ ...l, p: byId(l.id) })).filter(l => l.p && !l.p.hidden && l.p.stock !== 0);

  function totals(method) {
    const s = state.settings;
    const subtotal = bagLines().reduce((n, l) => n + l.p.now * l.qty, 0);
    const freeByAmount = s.freeDeliveryOver && subtotal >= s.freeDeliveryOver;
    const freeByPrepay = s.prepaidFreeDelivery && method === "online";
    const delivery = subtotal === 0 || freeByAmount || freeByPrepay ? 0 : Number(s.deliveryFee || 0);
    return { subtotal, delivery, total: subtotal + delivery, toFree: s.freeDeliveryOver ? Math.max(0, s.freeDeliveryOver - subtotal) : 0 };
  }

  function totalsHtml(method) {
    const t = totals(method), s = state.settings;
    const pct = s.freeDeliveryOver ? Math.min(100, (t.subtotal / s.freeDeliveryOver) * 100) : 100;
    return `
      <div><span>Subtotal</span><span class="v">${money(t.subtotal)}</span></div>
      <div><span>Delivery</span><span class="v">${t.delivery ? money(t.delivery) : "Free"}</span></div>
      ${t.toFree > 0 && t.subtotal > 0 ? `<div class="hint"><span>Add ${money(t.toFree)} more for free delivery</span></div><div class="freebar"><i style="width:${pct}%"></i></div>` : ""}
      <div class="grand"><span>Total</span><span class="v">${money(t.total)}</span></div>`;
  }

  function addToBag(id, qty = 1) {
    const p = byId(id);
    if (!p || p.stock === 0) return;
    const line = state.cart.find(l => l.id === id);
    if (line) line.qty = Math.min(maxQty(p), line.qty + qty);
    else state.cart.push({ id, qty: Math.min(maxQty(p), qty) });
    saveBag(); renderBag();
    toast(`${p.name} is in your bag`);
    const b = $("#bagOpen"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
  }

  function changeQty(id, delta) {
    const line = state.cart.find(l => l.id === id), p = byId(id);
    if (!line || !p) return;
    line.qty = Math.min(maxQty(p), line.qty + delta);
    if (line.qty <= 0) state.cart = state.cart.filter(l => l.id !== id);
    saveBag(); renderBag();
  }

  function renderBag() {
    const lines = bagLines();
    $("#bagCount").textContent = lines.reduce((n, l) => n + l.qty, 0);
    $("#bagFoot").hidden = !lines.length;
    $("#bagItems").innerHTML = lines.length ? lines.map(l => `
      <div class="line">
        ${l.p.image ? `<img src="${esc(l.p.image)}" alt="">` : "<span></span>"}
        <div>
          <div class="line__name">${esc(l.p.name)}</div>
          <div class="line__meta">${money(l.p.now)} each</div>
          <div class="qty"><button type="button" data-dec="${esc(l.id)}" aria-label="One fewer">−</button><span>${l.qty}</span><button type="button" data-inc="${esc(l.id)}" aria-label="One more">+</button></div>
        </div>
        <div class="line__right"><span class="num">${money(l.p.now * l.qty)}</span><button class="remove" type="button" data-rm="${esc(l.id)}">Remove</button></div>
      </div>`).join("")
      : `<div class="empty"><p>Your bag is empty.</p><a class="btn btn--emerald" href="${homeUrl}#shop" data-closebag>Find something</a></div>`;
    $("#bagTotals").innerHTML = totalsHtml();
  }

  function openBag() { $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); $("#scrim").hidden = false; $("#bagClose").focus(); }
  function closeBag() { $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); $("#scrim").hidden = true; }

  function whatsappText(c) {
    const t = totals("whatsapp");
    return [
      "Hi Aurantia! I'd like to order:",
      ...bagLines().map(l => `• ${l.p.name} × ${l.qty} — ${money(l.p.now * l.qty)}`),
      `Delivery: ${t.delivery ? money(t.delivery) : "Free"}`,
      `Total: ${money(t.total)}`,
      c ? `\nName: ${c.name}\nPhone: ${c.phone}\nAddress: ${c.address}, ${c.city}` : "",
      c?.orderId ? `Order no: ${c.orderId}` : "",
    ].filter(Boolean).join("\n");
  }
  const waLink = text => `https://wa.me/${state.settings.whatsappNumber}?text=${encodeURIComponent(text)}`;

  // ==== 7. CHECKOUT ==========================================================
  // The browser sends ONLY product ids, quantities and contact details.
  // The server (netlify/functions/create-order.mjs) looks up the real prices.

  const method = () => $("#checkoutForm").method.value;

  function refreshSummary() {
    $("#summaryItems").innerHTML = bagLines().map(l => `<div class="sum-line"><span>${esc(l.p.name)} × ${l.qty}</span><span class="num">${money(l.p.now * l.qty)}</span></div>`).join("");
    $("#summaryTotals").innerHTML = totalsHtml(method());
    const m = method();
    $("#placeOrder").textContent = m === "online" ? "Continue to secure payment" : m === "cod" ? "Place order" : "Send order on WhatsApp";
  }

  function openCheckout() {
    if (!bagLines().length) return;
    closeBag();
    $("#formError").hidden = true;
    refreshSummary();
    $("#checkout").showModal();
  }

  function validate() {
    const v = id => $(id).value.trim();
    const bad = (id, isBad) => { $(id).setAttribute("aria-invalid", isBad ? "true" : "false"); return isBad; };
    const data = { name: v("#cName"), email: v("#cEmail"), phone: v("#cPhone").replace(/[\s-]/g, ""), address: v("#cAddress"), city: v("#cCity"), note: v("#cNote"), gift: $("#cGift").checked, giftNote: $("#cGift").checked ? v("#cGiftNote") : "" };
    const problems = [];
    if (bad("#cName", data.name.length < 2)) problems.push("your full name");
    if (bad("#cEmail", !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email))) problems.push("a valid email");
    if (bad("#cPhone", !/^(\+?92|0)?3\d{9}$/.test(data.phone))) problems.push("a mobile number like 0300 1234567");
    if (bad("#cAddress", data.address.length < 6)) problems.push("your delivery address");
    if (bad("#cCity", data.city.length < 2)) problems.push("your city");
    return { problems, data };
  }

  async function submitOrder(e) {
    e.preventDefault();
    const { problems, data } = validate();
    const err = $("#formError");
    if (problems.length) { err.textContent = `Please add ${problems.join(", ")}.`; err.hidden = false; return; }
    err.hidden = true;
    const m = method(), btn = $("#placeOrder");
    btn.disabled = true; btn.textContent = "Placing your order…";
    try {
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer: data, method: m, items: state.cart.map(({ id, qty }) => ({ id, qty })) }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "not-deployed");
      // online: keep the bag until payment finishes (thank-you.html empties it)
      if (m === "online" && out.redirect) { location.href = out.redirect; return; }
      const msg = whatsappText({ ...data, orderId: out.orderId });
      state.cart = []; saveBag(); renderBag();
      if (m === "whatsapp") window.open(waLink(msg), "_blank", "noopener");
      location.href = `thank-you.html?order=${encodeURIComponent(out.orderId)}&m=${m}`;
    } catch (error) {
      if (error.message === "not-deployed" || error instanceof TypeError) {
        err.innerHTML = m === "whatsapp"
          ? `The order server isn't running here yet, so send your bag on WhatsApp directly: <a href="${waLink(whatsappText(data))}" target="_blank" rel="noopener">Open WhatsApp</a>`
          : "Checkout goes live once the site is on Netlify. This is a preview, so no order was placed.";
      } else err.textContent = error.message;
      err.hidden = false;
      btn.disabled = false; refreshSummary();
    }
  }

  // ==== 8. START-UP ==========================================================

  function wireShared() {
    document.addEventListener("click", e => {
      const add = e.target.closest("[data-add]");
      if (add && !add.disabled) { e.preventDefault(); addToBag(add.dataset.add); }
    });
    $("#bagOpen").onclick = openBag;
    $("#bagClose").onclick = closeBag;
    $("#scrim").onclick = closeBag;
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeBag(); });
    $("#bagItems").onclick = e => {
      const t = e.target.closest("button, a"); if (!t) return;
      if (t.dataset.inc) changeQty(t.dataset.inc, 1);
      if (t.dataset.dec) changeQty(t.dataset.dec, -1);
      if (t.dataset.rm) changeQty(t.dataset.rm, -999);
      if (t.hasAttribute("data-closebag")) closeBag();
    };
    $("#toCheckout").onclick = openCheckout;
    $("#bagWhatsapp").onclick = () => window.open(waLink(whatsappText()), "_blank", "noopener");
    const dlg = $("#checkout");
    dlg.onclick = e => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); };
    $("#checkoutForm").addEventListener("change", e => {
      if (e.target.name === "method") refreshSummary();
      if (e.target.id === "cGift") $("#giftNoteWrap").hidden = !e.target.checked;
    });
    $("#checkoutForm").addEventListener("submit", submitOrder);
  }

  async function start() {
    try {
      state.settings = await loadJson("data/store.json");
      state.products = await loadProducts(state.settings);
      state.quizzes = (await loadJson("data/quizzes.json").catch(() => ({ quizzes: [] }))).quizzes || [];
      state.prologue = await loadJson("data/prologue.json").catch(() => null);
    } catch (e) {
      console.error(e);
      const target = $("#productGrid") || $("#pdp");
      if (target) target.innerHTML = `<p class="grid__empty">The collection couldn't load. Refresh the page, or check data/store.json for a typo.</p>`;
      return;
    }
    state.cart = store.get(BAG, []);
    renderChrome();
    wireShared();
    renderBag();
    cookieNotice();
    if (PAGE === "home") startHome();
    if (PAGE === "product") { startProduct(); window.addEventListener("hashchange", () => location.reload()); }
  }

  start();
})();
