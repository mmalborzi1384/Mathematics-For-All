/* Chapter prelude ("از ابتدای فصل تا اینجا"):
   Two-layer modal architecture matching #people for 120fps jank-free scrolling
   on mobile & desktop:
     1) Outer <dialog class="summary-dialog"> stays overflow:hidden and owns ONLY
        the circular open/close wipe; once settled (.is-settled), clip-path is
        removed completely and ::backdrop turns solid paper so scrolling never
        composites through a GPU mask or flashes the deck behind it.
     2) Inner <div class="sum-sheet" data-sum-scroll> owns native touch/wheel
        scrolling with overscroll-behavior:contain.
   All original Persian summary copy in index.html stays untouched word-for-word. */
(function () {
  "use strict";

  var content = document.getElementById("summary");
  var trigger = document.querySelector("[data-summary-open]");
  if (!content || !trigger || typeof HTMLDialogElement === "undefined") return;

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var FA = "۰۱۲۳۴۵۶۷۸۹";
  function toFa(n) {
    return String(n).replace(/[0-9]/g, function (d) { return FA[+d]; });
  }

  /* ---- 1. Build outer non-scrolling dialog + inner scroll sheet ---------- */
  var dialog = document.createElement("dialog");
  dialog.className = "summary-dialog";
  dialog.setAttribute("aria-labelledby", "summaryTitle");

  var sheet = document.createElement("div");
  sheet.className = "sum-sheet";
  sheet.setAttribute("data-sum-scroll", "");
  sheet.setAttribute("tabindex", "-1");

  var bar = document.createElement("div");
  bar.className = "summary-bar";

  var barInner = document.createElement("div");
  barInner.className = "sum-bar-inner";

  var back = document.createElement("button");
  back.type = "button";
  back.className = "ppl-back sum-back";
  back.innerHTML =
    '<span class="ppl-back-ic" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg></span>' +
    '<span>بازگشت به متن ترجمه</span>';
  barInner.appendChild(back);

  var stepsWrap = document.createElement("div");
  stepsWrap.className = "sum-steps";
  stepsWrap.setAttribute("role", "navigation");
  stepsWrap.setAttribute("aria-label", "پرش سریع به بخش‌های پیش‌درآمد");
  var stepInk = document.createElement("span");
  stepInk.className = "sum-step-ink";
  stepInk.setAttribute("aria-hidden", "true");
  stepsWrap.appendChild(stepInk);
  barInner.appendChild(stepsWrap);

  var status = document.createElement("button");
  status.type = "button";
  status.className = "summary-status";
  status.setAttribute("title", "بازگشت به فهرست بخش‌ها");
  status.textContent = "پیش‌درآمد · فصل ۱";
  barInner.appendChild(status);

  var progress = document.createElement("span");
  progress.className = "summary-progress";
  progress.setAttribute("aria-hidden", "true");

  bar.appendChild(barInner);
  bar.appendChild(progress);

  content.parentNode.insertBefore(dialog, content);
  sheet.appendChild(bar);
  sheet.appendChild(content);
  dialog.appendChild(sheet);

  /* Proxy scroll properties on dialog to sheet so any external caller or QA
     script reading/writing dialog.scrollTop / dialog.scrollTo works seamlessly */
  try {
    Object.defineProperty(dialog, "scrollTop", {
      configurable: true,
      get: function () { return sheet.scrollTop; },
      set: function (v) { sheet.scrollTop = v; }
    });
    Object.defineProperty(dialog, "scrollHeight", {
      configurable: true,
      get: function () { return sheet.scrollHeight; }
    });
    Object.defineProperty(dialog, "clientHeight", {
      configurable: true,
      get: function () { return sheet.clientHeight; }
    });
    dialog.scrollTo = function () { return sheet.scrollTo.apply(sheet, arguments); };
  } catch (e) {}

  /* ---- 2. Editorial structure & visual figures inside .summary-wrap ------ */
  var head = content.querySelector(".summary-head");
  var wrap = content.querySelector(".summary-wrap");
  var cards = Array.prototype.slice.call(content.querySelectorAll(".summary-card"));

  /* Group chapter citation h3 + authors p into an archival bookplate slip
     without altering a single character of their textContent */
  var citeH3 = head && head.querySelector("h3");
  var citeAuthor = citeH3 && citeH3.nextElementSibling;
  if (citeH3 && citeAuthor) {
    var citeBox = document.createElement("div");
    citeBox.className = "sum-citation";
    head.insertBefore(citeBox, citeH3);
    citeBox.appendChild(citeH3);
    citeBox.appendChild(citeAuthor);
  }

  /* 7-section route grid inside .summary-head + matching quick pills in top bar */
  var nav = document.createElement("nav");
  nav.className = "summary-index";
  nav.setAttribute("aria-label", "بخش‌های خلاصهٔ فصل");
  var navTitle = document.createElement("p");
  navTitle.className = "summary-index-title";
  navTitle.textContent = "مسیر این پیش‌درآمد";
  nav.appendChild(navTitle);

  var navGrid = document.createElement("div");
  navGrid.className = "sum-index-grid";
  nav.appendChild(navGrid);

  var flashTimer = 0;
  function jumpToCard(i) {
    var card = cards[i];
    if (!card) return;
    var heading = card.querySelector("h3");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
    var top = card.getBoundingClientRect().top - sheet.getBoundingClientRect().top + sheet.scrollTop;
    var targetTop = Math.max(0, top - bar.offsetHeight - 18);
    sheet.scrollTo({ top: targetTop, behavior: reduce.matches ? "instant" : "smooth" });
    cards.forEach(function (c, idx) { c.classList.toggle("is-spotlight", idx === i); });
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () {
      cards.forEach(function (c) { c.classList.remove("is-spotlight"); });
    }, 1100);
  }

  var stepBtns = [];
  var links = cards.map(function (card, i) {
    var numEl = card.querySelector(".summary-number");
    var h3 = card.querySelector("h3");
    var numTx = numEl ? numEl.textContent.trim() : toFa(i + 1);
    var titleTx = h3 ? h3.textContent.trim() : "";

    /* Wrap number + h3 cleanly in a card header bar */
    card.setAttribute("data-num", numTx);
    if (numEl && h3 && numEl.parentNode === card) {
      var ch = document.createElement("div");
      ch.className = "sum-card-head";
      card.insertBefore(ch, numEl);
      ch.appendChild(numEl);
      ch.appendChild(h3);
    }

    var button = document.createElement("button");
    button.type = "button";
    button.className = "summary-jump";
    if (h3 && h3.id) button.setAttribute("aria-controls", h3.id);
    var num = document.createElement("span");
    num.className = "sum-jump-num";
    num.setAttribute("aria-hidden", "true");
    num.textContent = numTx;
    var lbl = document.createElement("span");
    lbl.className = "sum-jump-tx";
    lbl.textContent = titleTx;
    button.appendChild(num);
    button.appendChild(lbl);
    button.addEventListener("click", function () { jumpToCard(i); });
    navGrid.appendChild(button);

    var sb = document.createElement("button");
    sb.type = "button";
    sb.className = "sum-step";
    sb.textContent = numTx;
    sb.setAttribute("aria-label", numTx + " · " + titleTx);
    sb.setAttribute("title", numTx + " · " + titleTx);
    sb.addEventListener("click", function () { jumpToCard(i); });
    stepsWrap.appendChild(sb);
    stepBtns.push(sb);

    return button;
  });

  if (head) head.appendChild(nav);

  status.addEventListener("click", function () {
    sheet.scrollTo({ top: 0, behavior: reduce.matches ? "instant" : "smooth" });
  });

  /* Subtle, accessible aria-hidden visual figures grounded directly in the
     chapter prelude's own facts & numbers — built with crisp responsive HTML
     so labels remain razor-sharp at 320px–1920px and scale with A-/A+. */
  function insertVisual(cardIndex, html, beforeSelector) {
    var card = cards[cardIndex];
    if (!card) return;
    var fig = document.createElement("div");
    fig.className = "sum-vis";
    fig.setAttribute("aria-hidden", "true");
    fig.innerHTML = html;
    var ref = beforeSelector ? card.querySelector(beforeSelector) : null;
    if (ref) card.insertBefore(fig, ref);
    else card.appendChild(fig);
  }

  /* Card 0: 175-year historical trajectory */
  insertVisual(
    0,
    '<div class="sum-arc-grid">' +
      '<div class="sum-arc-node"><span class="sum-arc-era">دههٔ ۱۸۵۰</span><strong>سفر گالتون و اصلاح نژاد</strong><span>فرض فروتری ذهنی آفریقاییان</span></div>' +
      '<div class="sum-arc-arrow">←</div>' +
      '<div class="sum-arc-node"><span class="sum-arc-era">قرن بیستم</span><strong>انحصار آموزش استعداد</strong><span>نادیده‌ماندن سیاه‌پوستان بااستعداد</span></div>' +
      '<div class="sum-arc-arrow">←</div>' +
      '<div class="sum-arc-node is-accent"><span class="sum-arc-era">اقتصاد دانش‌بنیان</span><strong>تربیت معلم پیش از خدمت</strong><span>شرط پرورش ذهن‌های درخشان</span></div>' +
    '</div>',
    ".summary-keywords"
  );

  /* Card 1: Terman's sample skew (95–99% White) */
  insertVisual(
    1,
    '<div class="sum-meters">' +
      '<div class="sum-meter-row">' +
        '<div class="sum-meter-top"><span>شرکت‌کنندگان سفیدپوست در پژوهش طولی ترمن</span><b>۹۵ تا ۹۹٪</b></div>' +
        '<div class="sum-meter-track"><i style="--w:0.97"></i></div>' +
      '</div>' +
      '<div class="sum-meter-row is-muted">' +
        '<div class="sum-meter-top"><span>سهم سایر جمعیت‌ها در نمونهٔ پژوهش</span><b>۱ تا ۵٪</b></div>' +
        '<div class="sum-meter-track"><i style="--w:0.04"></i></div>' +
      '</div>' +
    '</div>'
  );

  /* Card 3: Drama Triangle continuum (Cause -> Effect -> Solution, echoing Slide 29) */
  insertVisual(
    3,
    '<div class="sum-triad">' +
      '<div class="sum-triad-item is-cause"><span class="sum-triad-tag">علت · شرور</span><strong>نژادپرستی علمی</strong><span>از گالتون تا هندریک ورورد</span></div>' +
      '<div class="sum-triad-item is-effect"><span class="sum-triad-tag">معلول · قربانیان</span><strong>بااستعدادان طردشده</strong><span>موهبت‌های دوسویهٔ موفقیت</span></div>' +
      '<div class="sum-triad-item is-sol"><span class="sum-triad-tag">راه‌حل · صلح‌آفرین</span><strong>لو ویگوتسکی</strong><span>نظریهٔ تحول‌یافتهٔ نقص‌شناسی</span></div>' +
    '</div>',
    "ul"
  );

  /* Card 5: Bantu Education teacher certification disparity (96% vs 15%) */
  insertVisual(
    5,
    '<div class="sum-meters">' +
      '<div class="sum-meter-row">' +
        '<div class="sum-meter-top"><span>معلمان سفیدپوست دارای گواهی رسمی تدریس</span><b>۹۶٪</b></div>' +
        '<div class="sum-meter-track"><i style="--w:0.96"></i></div>' +
      '</div>' +
      '<div class="sum-meter-row is-rust">' +
        '<div class="sum-meter-top"><span>معلمان سیاه‌پوست دارای گواهی رسمی تدریس</span><b>۱۵٪</b></div>' +
        '<div class="sum-meter-track"><i style="--w:0.15"></i></div>' +
      '</div>' +
    '</div>',
    "ol"
  );

  /* Closing bridge footer with .summary-finish */
  var foot = document.createElement("div");
  foot.className = "sum-foot";
  var finish = document.createElement("button");
  finish.type = "button";
  finish.className = "ppl-back summary-finish";
  finish.innerHTML =
    '<span>آماده‌ام؛ بازگشت به متن ترجمه</span>' +
    '<span class="ppl-back-ic sum-finish-ic" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M19 12H5"/><path d="m11 19-7-7 7-7"/></svg></span>';
  foot.appendChild(finish);
  wrap.appendChild(foot);

  /* ---- 3. Live scroll tracking (pure GPU / zero layout thrash) ----------- */
  var frame = 0, lastActive = -2;

  function moveStepInk(activeIdx) {
    if (activeIdx < 0 || activeIdx >= stepBtns.length || !stepsWrap.offsetWidth) {
      stepInk.style.opacity = "0";
      return;
    }
    var btn = stepBtns[activeIdx];
    stepInk.style.opacity = "1";
    stepInk.style.width = btn.offsetWidth + "px";
    stepInk.style.height = btn.offsetHeight + "px";
    stepInk.style.transform = "translate(" + btn.offsetLeft + "px," + btn.offsetTop + "px)";
  }

  function updateReading(force) {
    frame = 0;
    if (!dialog.open) return;
    var max = sheet.scrollHeight - sheet.clientHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, sheet.scrollTop / max)) : 1;
    progress.style.setProperty("--summary-progress", p);

    var active = -1;
    var edge = bar.getBoundingClientRect().bottom + 76;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getBoundingClientRect().top <= edge) active = i;
    }
    if (p > 0.985) active = cards.length - 1;

    if (force || active !== lastActive) {
      lastActive = active;
      links.forEach(function (button, idx) {
        if (idx === active) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
      });
      stepBtns.forEach(function (b, idx) {
        b.classList.toggle("is-on", idx === active);
      });
      cards.forEach(function (c, idx) {
        c.classList.toggle("is-current", idx === active);
      });
      status.textContent =
        active < 0
          ? "پیش‌درآمد · فصل ۱"
          : toFa(active + 1) + " از ۷ · " + cards[active].querySelector("h3").textContent;
      moveStepInk(active);
    }
  }

  function scheduleReading() {
    if (!frame) frame = requestAnimationFrame(function () { updateReading(false); });
  }
  sheet.addEventListener("scroll", scheduleReading, { passive: true });

  /* ---- 4. Open / Close / History / Print lifecycle ----------------------- */
  var savedY = 0,
    closeTimer = 0,
    settleTimer = 0,
    enterTimer = 0,
    closing = false,
    pushed = false,
    restorePopY = null;

  function computeWipeGeometry(recenterFromCard) {
    var W = window.innerWidth, H = window.innerHeight;
    var cx = parseFloat(dialog.style.getPropertyValue("--summary-ox"));
    var cy = parseFloat(dialog.style.getPropertyValue("--summary-oy"));
    if (recenterFromCard || !Number.isFinite(cx) || !Number.isFinite(cy)) {
      cx = W / 2;
      cy = H * 0.42;
      var hub = trigger.querySelector(".portal-hub") || trigger.querySelector(".portal-side");
      if (hub) {
        var r = hub.getBoundingClientRect();
        if (r.width && r.height && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W) {
          cx = r.left + r.width / 2;
          cy = r.top + r.height / 2;
        }
      }
      dialog.style.setProperty("--summary-ox", cx + "px");
      dialog.style.setProperty("--summary-oy", cy + "px");
    }
    var reach = Math.ceil(Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy))) + 44;
    dialog.style.setProperty("--summary-radius", reach + "px");
  }

  function handleViewportResize() {
    if (!dialog.open) return;
    /* While .is-settled is active, clip-path is `none` and transition is
       `none`, so updating --summary-radius causes zero repaint or animation
       and keeps the radius ready for a crisp close wipe at any new size. */
    computeWipeGeometry(false);
    updateReading(true);
  }
  window.addEventListener("resize", handleViewportResize, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleViewportResize, { passive: true });
  }

  function open(push) {
    if (dialog.open && !closing) return;
    clearTimeout(closeTimer);
    clearTimeout(settleTimer);
    clearTimeout(enterTimer);

    var wasClosing = closing;
    closing = false;
    if (!wasClosing) savedY = window.scrollY || root.scrollTop || 0;

    dialog.classList.remove("is-settled", "is-open");
    computeWipeGeometry(true);
    root.classList.add("summary-lock");

    if (!dialog.open) dialog.showModal();
    sheet.scrollTop = 0;
    lastActive = -2;
    dialog.classList.add("is-entering");

    /* Commit closed circle(0px) synchronously before opening frame */
    void dialog.offsetWidth;
    requestAnimationFrame(function () {
      if (!dialog.open || closing) return;
      dialog.classList.add("is-open");
      updateReading(true);
    });

    /* Once the circular reveal and entrance stagger complete, drop clip-path
       and entrance classes together (.is-settled) so scrolling runs on pure
       unmasked layers with every card at opacity: 1 and transform: none. */
    settleTimer = setTimeout(function () {
      dialog.classList.remove("is-entering");
      if (dialog.open && !closing) {
        dialog.classList.add("is-settled");
        updateReading(true);
      }
    }, reduce.matches ? 0 : 900);

    var titleEl = document.getElementById("summaryTitle");
    if (titleEl) titleEl.focus({ preventScroll: true });

    pushed = !!(history.state && history.state.mfaSummary);
    if (push) {
      try {
        history.pushState({ mfaSummary: true }, "", "#summary");
        pushed = true;
      } catch (e) {
        pushed = false;
      }
    }
  }

  function finishClose() {
    clearTimeout(settleTimer);
    clearTimeout(enterTimer);
    dialog.classList.remove("is-open", "is-settled", "is-entering");
    if (dialog.open) dialog.close();
    root.classList.remove("summary-lock");
    window.scrollTo({ top: savedY, behavior: "instant" });
    if (window.__rail && window.__rail.layout) window.__rail.layout();
    trigger.focus({ preventScroll: true });
    closing = false;
  }

  function close(fromHistory) {
    if (!dialog.open || closing) return;
    closing = true;
    clearTimeout(settleTimer);
    clearTimeout(enterTimer);

    /* Re-arm full-screen circle from live viewport before shrinking back to 0px */
    computeWipeGeometry(true);
    dialog.classList.remove("is-settled", "is-entering");
    void dialog.offsetWidth;

    if (reduce.matches) {
      finishClose();
    } else {
      requestAnimationFrame(function () {
        dialog.classList.remove("is-open");
      });
      closeTimer = setTimeout(finishClose, 740);
    }

    if (!fromHistory) {
      if (pushed) {
        restorePopY = savedY;
        try {
          history.back();
        } catch (e) {
          restorePopY = null;
        }
      } else if (location.hash === "#summary") {
        try {
          history.replaceState(history.state, "", location.pathname + location.search);
        } catch (e) {}
      }
    }
    pushed = false;
  }

  trigger.addEventListener("click", function (e) {
    e.preventDefault();
    open(true);
  });
  back.addEventListener("click", function () { close(false); });
  finish.addEventListener("click", function () { close(false); });
  dialog.addEventListener("cancel", function (e) {
    e.preventDefault();
    close(false);
  });

  window.addEventListener("popstate", function () {
    if (restorePopY !== null && location.hash !== "#summary") {
      var y = restorePopY;
      restorePopY = null;
      if (!closing && !dialog.open) window.scrollTo({ top: y, behavior: "instant" });
      return;
    }
    if (location.hash === "#summary") open(false);
    else close(true);
  });

  /* Print support: exit top layer cleanly while keeping scroll offset */
  var printOpen = false, printScroll = 0;
  window.addEventListener("beforeprint", function () {
    printOpen = dialog.open;
    if (printOpen) {
      printScroll = sheet.scrollTop;
      dialog.close();
    }
  });
  window.addEventListener("afterprint", function () {
    if (printOpen) {
      dialog.showModal();
      dialog.classList.add("is-open", "is-settled");
      sheet.scrollTop = printScroll;
      printOpen = false;
      updateReading(true);
    }
  });

  if (location.hash === "#summary") open(false);

  /* Debug / QA handle symmetrical with window.__people & window.__rail */
  window.__summary = {
    open: function () { open(true); },
    close: function () { close(false); },
    isOpen: function () { return dialog.open && !closing; },
    go: jumpToCard,
    docScroll: function () { return savedY; },
    state: function () {
      return {
        open: dialog.open,
        settled: dialog.classList.contains("is-settled"),
        scrollTop: Math.round(sheet.scrollTop),
        scrollHeight: Math.round(sheet.scrollHeight),
        clientHeight: Math.round(sheet.clientHeight),
        active: lastActive
      };
    }
  };
})();
