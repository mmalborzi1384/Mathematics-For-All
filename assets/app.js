/* =====================================================================
   Mathematics For All — site logic
   Everything the reader needs (content, rail, progress, ZPD steps,
   illustration build-in) is vanilla and runs without Motion. Motion is
   loaded only as an enhancement for the hero entrance and parallax.
   ===================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var reducedMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  function reduced() { return reducedMQ.matches; }
  function seg(p, a, b) { var t = (p - a) / (b - a); return t < 0 ? 0 : t > 1 ? 1 : t; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) {}
    return null;
  }
  var FA_D = "۰۱۲۳۴۵۶۷۸۹";
  function toFa(n) { return String(n).replace(/[0-9]/g, function (d) { return FA_D[+d]; }); }
  function faToEn(s) { return s.replace(/[۰-۹]/g, function (d) { return String(FA_D.indexOf(d)); }); }

  /* mark "JS is alive" before anything can fail, so the reveal styles
     (.js .rv) never leave content invisible on a broken script */
  root.classList.add("js");

  /* ==================================================================
     DIRECTIONAL SOFT-FADE TYPING ENGINE (window.__textStream)
     Streams prose & titles smoothly from the inline start edge (Right -> Left
     in Persian RTL; Left -> Right in English LTR) with zero layout shift:
       * `prepare(el)` splits text nodes once on ASCII whitespace ONLY, keeping
         `display: inline` spans, native inter-word space TextNodes (preserving
         100% exact `text-align: justify` & B Nazanin cursive ZWNJ shaping),
         PDF highlight `<b class="hl-...">` tags, and `<sup class="sup">`.
       * `stream(el, opts)` triggers a staggered GPU opacity wave across words
         along each line, then removes `.tw-play` on completion (0 resting CSS
         animations, 0 GPU layers).
       * `wipe(el, opts)` sweeps a feathered directional gradient mask across
         short/single-word display headings (e.g. «نونگکسا», chapter titles,
         modal titles), removing `.tw-wipe-*` immediately on finish so scrolling
         never composites through a lingering mask.
     ================================================================== */
  var tsBlockCount = 0, tsWordCount = 0, tsCompleted = 0;
  var tsActive = new Map();

  function tsIsLtr(el) {
    if (!el) return false;
    if (el.closest && el.closest('[dir="ltr"], [lang="en"]:not(#heroCardFa), .en, .boxin-en, .ch-en, .scene-slide, .ppl-latin, .thanks-en')) {
      return true;
    }
    return window.getComputedStyle(el).direction === "ltr";
  }

  function tsPrepare(el) {
    if (!el || el._twSpans) return el ? el._twSpans : [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var textNodes = [], node, approxWords = 0;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && /\S/.test(node.nodeValue)) {
        textNodes.push(node);
        var wMatch = node.nodeValue.match(/\S+/g);
        if (wMatch) approxWords += wMatch.length;
      }
    }
    /* Adaptive phrase granularity:
       - Short titles, tags, quotes, & facts (<= 20 words): 1 word per token
       - Longer prose paragraphs (> 20 words): 3 words per inline phrase token
         (keeps `display: inline` justification 100% sub-pixel identical while
         cutting total DOM spans across the 31-slide deck by ~3.5x for <40ms reflow!) */
    var wordsPerSpan = approxWords > 20 ? 3 : 1;
    var spans = [];
    for (var i = 0; i < textNodes.length; i++) {
      var tn = textNodes[i];
      var parts = tn.nodeValue.split(/([ \t\r\n]+)/);
      var frag = document.createDocumentFragment();
      var buf = "", countInBuf = 0;
      for (var j = 0; j < parts.length; j++) {
        var part = parts[j];
        if (!part) continue;
        var isSpace = /^[ \t\r\n]+$/.test(part);
        if (isSpace) {
          if (countInBuf > 0 && countInBuf < wordsPerSpan) {
            buf += part;
          } else {
            if (buf) {
              var s1 = document.createElement("span");
              s1.className = "tw-tok";
              s1.textContent = buf;
              frag.appendChild(s1);
              spans.push(s1);
              buf = "";
              countInBuf = 0;
            }
            frag.appendChild(document.createTextNode(part));
          }
        } else {
          buf += part;
          countInBuf++;
          if (countInBuf >= wordsPerSpan) {
            var s2 = document.createElement("span");
            s2.className = "tw-tok";
            s2.textContent = buf;
            frag.appendChild(s2);
            spans.push(s2);
            buf = "";
            countInBuf = 0;
          }
        }
      }
      if (buf) {
        var sLast = document.createElement("span");
        sLast.className = "tw-tok";
        sLast.textContent = buf;
        frag.appendChild(sLast);
        spans.push(sLast);
      }
      if (tn.parentNode) tn.parentNode.replaceChild(frag, tn);
    }
    el._twSpans = spans;
    if (spans.length) {
      tsBlockCount++;
      tsWordCount += spans.length;
    }
    return spans;
  }

  function tsCleanEl(el) {
    if (!el) return;
    var rec = tsActive.get(el);
    if (rec) {
      clearTimeout(rec.timer);
      tsActive.delete(el);
      if (rec.kind === "hero" && rec.anims) {
        for (var k = 0; k < rec.anims.length; k++) {
          try { rec.anims[k].finish(); } catch (e) {}
        }
        rec.anims.length = 0;
        if (!tsCountIn(document.getElementById("hero"))) {
          root.classList.remove("hero-anim");
        }
      }
    }
    el.classList.remove("tw-play", "tw-soft", "tw-wipe-rtl", "tw-wipe-ltr");
    el.style.removeProperty("--tw-dur");
    el.style.removeProperty("--tw-wdur");
    el.style.removeProperty("--tw-wdelay");
  }

  function tsCancelIn(container) {
    if (!container) return;
    tsActive.forEach(function (rec, el) {
      if (el === container || container.contains(el)) tsCleanEl(el);
    });
  }

  function tsFlushAll() {
    tsActive.forEach(function (rec, el) { tsCleanEl(el); });
  }

  function tsCountIn(container) {
    if (!container) return tsActive.size;
    var n = 0;
    tsActive.forEach(function (rec, el) {
      if (el === container || container.contains(el)) n++;
    });
    return n;
  }

  function tsStream(el, opts) {
    if (!el || reduced()) return null;
    var o = opts || {};
    var spans = tsPrepare(el);
    if (!spans.length) return null;
    var wasPlaying = tsActive.has(el);
    tsCleanEl(el);
    if (wasPlaying) void el.offsetWidth;

    var baseDelay = o.delay || 0;
    var dur = o.duration || (spans.length <= 10 ? 330 : 280);
    var maxWindow = o.window || (spans.length <= 10 ? 280 : 480);
    var step = spans.length <= 1 ? 0 : Math.min(o.maxStep || 34, maxWindow / spans.length);
    for (var i = 0; i < spans.length; i++) {
      spans[i].style.setProperty("--tw-d", (baseDelay + i * step).toFixed(1) + "ms");
    }
    el.style.setProperty("--tw-dur", dur + "ms");
    if (o.soft) el.classList.add("tw-soft");
    el.classList.add("tw-play");

    var totalMs = Math.ceil(baseDelay + Math.max(0, spans.length - 1) * step + dur + 36);
    var timer = setTimeout(function () {
      tsCleanEl(el);
      tsCompleted++;
    }, totalMs);
    tsActive.set(el, { timer: timer, kind: "stream", dir: tsIsLtr(el) ? "ltr" : "rtl" });
    return timer;
  }

  function tsWipe(el, opts) {
    if (!el || reduced()) return null;
    var o = opts || {};
    var wasPlaying = tsActive.has(el);
    tsCleanEl(el);
    if (wasPlaying) void el.offsetWidth;

    var delay = o.delay || 0;
    var dur = o.duration || 450;
    var ltr = tsIsLtr(el);
    el.style.setProperty("--tw-wdur", dur + "ms");
    el.style.setProperty("--tw-wdelay", delay + "ms");
    el.classList.add(ltr ? "tw-wipe-ltr" : "tw-wipe-rtl");

    var totalMs = Math.ceil(delay + dur + 36);
    var timer = setTimeout(function () {
      tsCleanEl(el);
      tsCompleted++;
    }, totalMs);
    tsActive.set(el, { timer: timer, kind: "wipe", dir: ltr ? "ltr" : "rtl" });
    return timer;
  }

  window.addEventListener("beforeprint", tsFlushAll);
  if (reducedMQ.addEventListener) {
    reducedMQ.addEventListener("change", function (e) { if (e.matches) tsFlushAll(); });
  }

  window.__textStream = {
    prepare: tsPrepare,
    stream: tsStream,
    wipe: tsWipe,
    cancel: tsCleanEl,
    cancelIn: tsCancelIn,
    flushAll: tsFlushAll,
    countIn: tsCountIn,
    isLtr: tsIsLtr,
    stats: function () {
      return {
        blocks: tsBlockCount,
        words: tsWordCount,
        active: tsActive.size,
        completed: tsCompleted
      };
    }
  };

  var TOTAL_SLIDES = 31;

  /* ---------------------------------------------------------------- theme */
  var toggle = document.getElementById("themeToggle");
  var hasSavedTheme = store("mfa-theme") !== null || store("tarjome-theme") !== null;
  function syncToggle() {
    if (toggle) toggle.setAttribute("aria-pressed", root.getAttribute("data-theme") === "dark" ? "true" : "false");
  }
  syncToggle();
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      store("mfa-theme", next);
      hasSavedTheme = true;
      syncToggle();
      scheduleLayout();
    });
  }
  var darkMQ = window.matchMedia("(prefers-color-scheme: dark)");
  function onSystemTheme(e) {
    if (hasSavedTheme) return;
    root.setAttribute("data-theme", e.matches ? "dark" : "light");
    syncToggle();
    scheduleLayout();
  }
  if (darkMQ.addEventListener) darkMQ.addEventListener("change", onSystemTheme);
  else if (darkMQ.addListener) darkMQ.addListener(onSystemTheme);

  /* ---------------------------------------------------------------- reading size */
  var FS = ["sm", "md", "lg"];
  var fsDown = document.getElementById("fsDown");
  var fsUp = document.getElementById("fsUp");
  function fsIndex() { var i = FS.indexOf(root.getAttribute("data-fs")); return i < 0 ? 1 : i; }
  function applyFs(i) {
    i = Math.max(0, Math.min(2, i));
    root.setAttribute("data-fs", FS[i]);
    store("mfa-fs", FS[i]);
    if (fsDown) fsDown.disabled = i === 0;
    if (fsUp) fsUp.disabled = i === 2;
    scheduleLayout();
  }
  if (fsDown) fsDown.addEventListener("click", function () { applyFs(fsIndex() - 1); });
  if (fsUp) fsUp.addEventListener("click", function () { applyFs(fsIndex() + 1); });
  applyFs(fsIndex());

  /* ---------------------------------------------------------------- fullscreen */
  var fsBtn = document.getElementById("fsToggle");
  if (fsBtn) {
    var canFs = !!(root.requestFullscreen || root.webkitRequestFullscreen);
    /* iPhone Safari has no element fullscreen: hide the dead button */
    if (!canFs) fsBtn.hidden = true;
    fsBtn.addEventListener("click", function () {
      try {
        if (document.fullscreenElement) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
          (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
        }
      } catch (e) {}
    });
    var syncFs = function () {
      fsBtn.setAttribute("aria-pressed", document.fullscreenElement ? "true" : "false");
    };
    document.addEventListener("fullscreenchange", syncFs);
    document.addEventListener("webkitfullscreenchange", syncFs);
    syncFs();
  }

  /* ---------------------------------------------------------------- smooth window glide
     Replaces jarring instant jumps on distant rail clicks and #toTop with a
     cancellable, retargetable quintic rAF glide (500ms–1040ms scaled smoothly
     with log-distance). Re-reads live target element offset during approach so
     GSAP ScrollTrigger pin spacers (#s23) land at 0.00px error, yields in 0ms
     to wheel/touch gestures, and drops to instant scroll under reduced motion. */
  var glideRAF = 0, glideTargetEl = null, glideTargetOffset = 0, glideDestY = 0, glideLastY = 0;

  function cancelWindowGlide() {
    if (glideRAF) {
      cancelAnimationFrame(glideRAF);
      glideRAF = 0;
    }
    glideTargetEl = null;
  }

  function easeVelvet(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function glideWindowTo(targetTop, targetEl, topOffset) {
    cancelWindowGlide();
    if (reduced()) {
      scrollNow(targetTop);
      return;
    }
    var startY = window.scrollY || root.scrollTop || 0;
    var dist = Math.abs(targetTop - startY);
    if (dist < 2) {
      scrollNow(targetTop);
      return;
    }
    glideTargetEl = targetEl || null;
    glideTargetOffset = typeof topOffset === "number" ? topOffset : 0;
    glideDestY = targetTop;

    var duration = Math.min(920, Math.max(480, Math.round(440 + 115 * Math.log(1 + dist / 900))));
    var t0 = performance.now();
    glideLastY = startY;

    function step() {
      var liveY = window.scrollY || root.scrollTop || 0;
      if (Math.abs(liveY - glideLastY) > 4) {
        cancelWindowGlide();
        return;
      }
      var t = Math.min(1, Math.max(0, (performance.now() - t0) / duration));
      if (glideTargetEl) {
        glideDestY = Math.max(0, Math.min(maxScroll(), docTop(glideTargetEl) - glideTargetOffset));
      }
      var nextY = startY + (glideDestY - startY) * easeVelvet(t);
      scrollNow(nextY);
      glideLastY = window.scrollY || root.scrollTop || 0;
      if (t < 1) {
        glideRAF = requestAnimationFrame(step);
      } else {
        glideRAF = 0;
        var finalY = glideTargetEl
          ? Math.max(0, Math.min(maxScroll(), docTop(glideTargetEl) - glideTargetOffset))
          : glideDestY;
        glideTargetEl = null;
        scrollNow(finalY);
        glideLastY = window.scrollY || root.scrollTop || 0;
        onScroll(true);
      }
    }
    glideRAF = requestAnimationFrame(step);
  }

  window.addEventListener("wheel", cancelWindowGlide, { passive: true, capture: true });
  window.addEventListener("touchstart", cancelWindowGlide, { passive: true, capture: true });
  window.addEventListener("keydown", function (e) {
    if (/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(e.key)) cancelWindowGlide();
  }, { passive: true, capture: true });

  /* ---------------------------------------------------------------- back to top */
  var toTop = document.getElementById("toTop");
  if (toTop) {
    toTop.addEventListener("click", function () {
      glideWindowTo(0, null, 0);
      if (history.replaceState) history.replaceState(null, "", "#hero");
    });
  }

  /* ---------------------------------------------------------------- share: link + QR
     The canonical address is the single source of truth (the QR in
     assets/ encodes the same page). Three entries — hero pill, top bar,
     the closing card's code — open one <dialog> lightbox with a
     projector-sized code; copy uses the async clipboard with the
     execCommand fallback, and the native share sheet is offered only
     where navigator.share exists (phones, Windows/macOS browsers). The
     dialog animates in through a class so the exit can play too; with
     reduced motion both are instant. */
  var shareView = document.getElementById("shareView");
  var shareOpener = null, shareCloseT = 0;
  var SHARE_URL = (function () {
    var c = document.querySelector('link[rel="canonical"]');
    return (c && c.href) || location.href.split("#")[0];
  })();
  var SHARE_TITLE = "Mathematics For All — ریاضیات برای همه";
  var SHARE_TEXT = "ریاضیات برای همه: پر کردن شکاف برای یادگیرندگان محروم و بااستعداد · ارائه‌ی درس آموزش ریاضی ۱";
  function shareCanNative() {
    try { return !!(navigator.share && (!navigator.canShare || navigator.canShare({ url: SHARE_URL }))); }
    catch (e) { return false; }
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-share-native]"), function (b) {
    b.hidden = !shareCanNative();
  });
  function shareStatus(from, msg) {
    var scope = from && from.closest ? from.closest(".share-card, .share-view-card") : null;
    var out = scope ? scope.querySelector(".share-status") : null;
    if (!out) return;
    out.textContent = msg || "";
    clearTimeout(out._t);
    if (msg) out._t = setTimeout(function () { out.textContent = ""; }, 3200);
  }
  function shareFlash(btn, ok) {
    var tx = btn.querySelector(".share-btn-tx");
    if (!tx) return;
    if (!btn._label) btn._label = tx.textContent;
    clearTimeout(btn._t);
    btn.classList.toggle("is-done", !!ok);
    tx.textContent = ok ? "کپی شد" : btn._label;
    btn._t = setTimeout(function () {
      btn.classList.remove("is-done");
      tx.textContent = btn._label;
    }, 2200);
  }
  function shareLegacyCopy() {
    var ta = document.createElement("textarea");
    ta.value = SHARE_URL;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  function shareCopy(btn) {
    function done(ok) {
      shareFlash(btn, ok);
      shareStatus(btn, ok ? "پیوند ارائه کپی شد." : "کپی خودکار ممکن نبود؛ نشانی را از کادر بالا انتخاب و کپی کنید.");
      if (!ok) {
        var scope = btn.closest(".share-card, .share-view-card");
        var code = scope && scope.querySelector(".share-url");
        if (code && window.getSelection && document.createRange) {
          var r = document.createRange(); r.selectNodeContents(code);
          var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        }
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      navigator.clipboard.writeText(SHARE_URL).then(function () { done(true); }, function () { done(shareLegacyCopy()); });
    } else {
      done(shareLegacyCopy());
    }
  }
  function shareNative(btn) {
    if (!shareCanNative()) { shareCopy(btn); return; }
    var p;
    try { p = navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL }); }
    catch (e) { shareCopy(btn); return; }
    if (p && p.then) {
      p.then(function () { shareStatus(btn, "سپاس! ارائه به اشتراک گذاشته شد."); }, function (err) {
        if (err && err.name === "AbortError") return;   /* the reader closed the sheet */
        shareCopy(btn);
      });
    }
  }
  function shareOpen(from) {
    if (!shareView || typeof shareView.showModal !== "function") {
      goTo("share");   /* no <dialog>: the closing card has the same content */
      return;
    }
    if (shareView.open) return;
    shareOpener = from && from.focus ? from : null;
    clearTimeout(shareCloseT);
    root.classList.add("share-lock");
    try { shareView.showModal(); } catch (e) { root.classList.remove("share-lock"); goTo("share"); return; }
    var card = shareView.querySelector(".share-view-card");
    if (card) { try { card.focus({ preventScroll: true }); } catch (e2) { card.focus(); } }
    if (reduced()) { shareView.classList.add("is-in"); return; }
    /* flush the closed styles first so the entrance transitions from them
       (a forced style read, not a frame wait: deterministic even when
       requestAnimationFrame is throttled) */
    void shareView.offsetWidth;
    shareView.classList.add("is-in");
  }
  /* idempotent: runs right after our own close() and again on the
     engine's close event (which is a queued task and can land late on a
     busy frame), so the scroll lock never outlives the dialog */
  function shareSettle() {
    clearTimeout(shareCloseT);
    shareView.classList.remove("is-in");
    root.classList.remove("share-lock");
    shareStatus(shareView.querySelector(".share-view-card"), "");
    var back = shareOpener;
    shareOpener = null;
    if (back && document.contains(back)) {
      try { back.focus({ preventScroll: true }); } catch (e) { back.focus(); }
    }
  }
  function shareClose() {
    if (!shareView || !shareView.open) return;
    shareView.classList.remove("is-in");
    var fin = function () { if (shareView.open) shareView.close(); shareSettle(); };
    clearTimeout(shareCloseT);
    if (reduced()) fin(); else shareCloseT = setTimeout(fin, 330);
  }
  if (shareView) {
    /* Esc: play the exit first; a second Esc mid-exit finishes at once.
       If the engine refuses the cancel (no activation), the close handler
       below still cleans up */
    shareView.addEventListener("cancel", function (e) {
      e.preventDefault();
      if (shareView.classList.contains("is-in")) { shareClose(); return; }
      clearTimeout(shareCloseT);
      if (shareView.open) shareView.close();
      shareSettle();
    });
    shareView.addEventListener("close", shareSettle);
    /* Tab cycles inside the card (the deck behind is inert already; this
       skips the browser-chrome stop and mirrors the people view) */
    shareView.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var list = Array.prototype.filter.call(shareView.querySelectorAll("a[href], button:not([disabled])"), function (el) {
        return !el.hidden && el.getClientRects().length > 0;
      });
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1], a = document.activeElement;
      if (e.shiftKey) {
        if (a === first || !a || !shareView.contains(a) || a.classList.contains("share-view-card")) { e.preventDefault(); last.focus(); }
      } else if (a === last) { e.preventDefault(); first.focus(); }
    });
    /* a click on the backdrop reaches the dialog element itself */
    shareView.addEventListener("click", function (e) { if (e.target === shareView) shareClose(); });
    shareView.addEventListener("touchmove", function (e) { if (e.target === shareView) e.preventDefault(); }, { passive: false });
  }
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-share-open],[data-share-close],[data-share-copy],[data-share-native]") : null;
    if (!t) return;
    if (t.hasAttribute("data-share-open")) { e.preventDefault(); shareOpen(t); }
    else if (t.hasAttribute("data-share-close")) shareClose();
    else if (t.hasAttribute("data-share-copy")) shareCopy(t);
    else if (t.hasAttribute("data-share-native")) shareNative(t);
  });
  window.__share = {
    isOpen: function () { return !!(shareView && shareView.open); },
    open: shareOpen,
    close: shareClose,
    url: SHARE_URL,
    canNative: shareCanNative
  };

  /* ==================================================================
     RAIL
     Dots are appended at runtime (one per scene) and every position is
     derived from LIVE geometry on each layout pass:
       pos  = pad + (docTop(target) + vh/2) / maxScroll * usable
       fill = pad + scrollY / maxScroll * usable
     The +vh/2 matches the point where a zone becomes active (the
     viewport centre line), so the fill tip and the lit dot agree in
     every state — after a webfont swap, A-/A+, a theme change, a phone
     rotation, or the tall pinned ZPD scene.
     ================================================================== */
  var rail = document.getElementById("rail");
  var railFill = document.getElementById("railFill");
  var railGhost = document.getElementById("railGhost");
  var railLinks = rail ? Array.prototype.slice.call(rail.querySelectorAll("a")) : [];
  var navLinks = railLinks.filter(function (a) { return a.hasAttribute("data-nav"); });

  if (rail) {
    document.querySelectorAll(".scene[data-chapter]").forEach(function (scene) {
      var anchor = rail.querySelector('a[data-nav="' + scene.getAttribute("data-chapter") + '"]');
      if (!anchor) return;
      var numEl = scene.querySelector(".scene-num");
      var num = numEl ? numEl.textContent.trim() : "";
      var a = document.createElement("a");
      a.href = "#" + scene.id;
      a.className = "s-dot";
      a.setAttribute("data-scene", scene.id);
      a.setAttribute("aria-label", "اسلاید " + num + " از " + toFa(TOTAL_SLIDES));
      a.innerHTML = '<span class="dot" aria-hidden="true"></span><span class="rlabel">اسلاید ' + num + "</span>";
      var ref = anchor;
      while (ref.nextElementSibling && ref.nextElementSibling.classList.contains("s-dot")) ref = ref.nextElementSibling;
      anchor.parentNode.insertBefore(a, ref.nextSibling);
    });
    railLinks = Array.prototype.slice.call(rail.querySelectorAll("a"));
    navLinks = railLinks.filter(function (a) { return a.hasAttribute("data-nav"); });
  }

  var navState = { chapter: "hero", scene: null };
  var zones = [];
  document.querySelectorAll("#hero, .chapter, .scene, #closing").forEach(function (el) {
    if (el.classList.contains("scene")) zones.push({ el: el, chapter: el.getAttribute("data-chapter"), scene: el.id });
    else zones.push({ el: el, chapter: el.id, scene: null });
  });

  function maxScroll() { return Math.max(1, root.scrollHeight - window.innerHeight); }
  function docTop(el) {
    return el.getBoundingClientRect().top + (window.scrollY || root.scrollTop || 0);
  }
  /* A phone, or a desktop window under 600px tall, cannot hold 36
     clickable dots on one track, so it gets the chapter-only rail. The
     usual laptop viewport (1366×768, or 1080p at 150 % scaling — about
     600–800px once the browser chrome is taken off) keeps every slide
     station on a taller track at a 14–19px pitch instead of silently
     dropping them; the CSS breakpoints in style.css use the same 600px. */
  var RAIL_MIN_FULL_H = 600;
  function compactRail() { return window.innerWidth <= 900 || window.innerHeight < RAIL_MIN_FULL_H; }

  var railPad = 14, railUsable = 1, railMode = "doc", railAnchors = [];

  /* The mobile rail is a chapter *index*: seven slots of equal height.
     Placing the dots by document offset instead (which is right on
     desktop, where every scene has its own dot) made the dots bunch up
     and left the progress tip hundreds of pixels away from the lit
     chapter dot — chapters are 4k to 25k pixels long. */
  function layoutRail() {
    if (!rail) return;
    var trackH = rail.clientHeight || 1;
    var mobile = compactRail();
    var pad = mobile ? 16 : 14;
    var usable = Math.max(1, trackH - pad * 2);
    var minGap = mobile ? 30 : Math.min(20, usable / Math.max(1, railLinks.length - 1));
    var hitMax = 26;
    var max = maxScroll();
    var halfVh = window.innerHeight / 2;

    rail.style.setProperty("--rail-pad", pad + "px");
    railPad = pad;
    railUsable = usable;
    railMode = mobile ? "chapter" : "doc";

    var items = [];
    if (mobile) {
      navLinks.forEach(function (a, idx) {
        items.push({ a: a, pos: pad + usable * (navLinks.length > 1 ? idx / (navLinks.length - 1) : 0) });
      });
    } else {
      railLinks.forEach(function (a) {
        var href = a.getAttribute("href");
        if (!href || href.charAt(0) !== "#") return;
        var t = document.getElementById(href.slice(1));
        if (!t) return;
        items.push({ a: a, f: clamp01((docTop(t) + halfVh) / max) });
      });
      if (!items.length) return;
      items.forEach(function (it) { it.pos = pad + it.f * usable; });
      var i;
      for (i = 0; i < items.length; i++) {
        var min = (i === 0 ? pad : items[i - 1].pos + minGap);
        if (items[i].pos < min) items[i].pos = min;
      }
      for (i = items.length - 1; i >= 0; i--) {
        var maxP = (i === items.length - 1 ? pad + usable : items[i + 1].pos - minGap);
        if (items[i].pos > maxP) items[i].pos = maxP;
      }
      if (items[0].pos > pad) items[0].pos = pad;
      var last = items[items.length - 1];
      if (last.pos < pad + usable) last.pos = pad + usable;
    }

    /* Hit boxes tile the track instead of overlapping: a chapter dot and
       its first scene dot can sit ~20px apart, and two 26px boxes stacked
       on each other would make one of them unclickable. The dot itself
       stays exactly on `pos` (it is centred in the link). */
    items.forEach(function (it, idx) {
      var prev = idx > 0 ? (items[idx - 1].pos + it.pos) / 2 : it.pos - 13;
      var next = idx < items.length - 1 ? (items[idx + 1].pos + it.pos) / 2 : it.pos + 13;
      var h = Math.max(14, Math.min(hitMax, next - prev));
      it.a.style.top = it.pos.toFixed(1) + "px";
      it.a.style.height = h.toFixed(1) + "px";
    });

    railAnchors = items.map(function (it) {
      var id = (it.a.getAttribute("href") || "").slice(1);
      var el = id && document.getElementById(id);
      /* the scroll position at which this zone becomes the active one
         (its top crosses the viewport centre line) */
      return { id: id, top: el ? Math.max(0, docTop(el) - window.innerHeight / 2) : 0, pos: it.pos };
    }).filter(function (x) { return x.top !== null; });
    railAnchors.sort(function (a, b) { return a.top - b.top; });
    /* keep the pixel positions monotone after the sort */
    for (var q = 1; q < railAnchors.length; q++) {
      if (railAnchors[q].pos < railAnchors[q - 1].pos) railAnchors[q].pos = railAnchors[q - 1].pos;
    }

    /* hidden scene dots (mobile) still need a spot for when the layout
       widens again */
    if (mobile) {
      railLinks.forEach(function (a) {
        if (a.hasAttribute("data-nav")) return;
        var href = a.getAttribute("href");
        var t = href && document.getElementById(href.slice(1));
        if (!t) return;
        a.style.top = (pad + clamp01((docTop(t) + halfVh) / max) * usable).toFixed(1) + "px";
        a.style.height = "";
      });
    }
  }

  /* The fill tip is interpolated between the *dots themselves*, not
     between raw scroll fractions: the dot positions are already a
     slightly compressed version of the document (dots cannot sit 3px
     apart and stay clickable), so mapping the scroll onto that same
     scale is what makes the tip land exactly on the lit dot at every
     chapter/slide boundary. */
  function railPos(probe) {
    var n = railAnchors.length;
    if (n < 2) return railPad + clamp01(probe / maxScroll()) * railUsable;
    if (probe <= railAnchors[0].top) return railAnchors[0].pos;
    for (var i = n - 1; i >= 0; i--) {
      if (railAnchors[i].top <= probe) {
        if (i === n - 1) return railAnchors[i].pos;
        var a = railAnchors[i], b = railAnchors[i + 1];
        var span = b.top - a.top;
        var t = span > 0 ? clamp01((probe - a.top) / span) : 0;
        return a.pos + (b.pos - a.pos) * t;
      }
    }
    return railAnchors[0].pos;
  }

  function paintFill(y) {
    if (!railFill) return;
    var pos = railPos(y);
    var solid = pos, ghostTo = pos;
    if (railMode === "chapter") {
      /* the compact rail is a chapter index: the solid line ends on the
         lit chapter dot and the faint tail carries in-chapter progress */
      var activeId = navState.chapter;
      var activePos = null;
      for (var i = 0; i < railAnchors.length; i++) if (railAnchors[i].id === activeId) activePos = railAnchors[i].pos;
      if (activePos !== null) solid = activePos;
      rail.classList.toggle("show-ghost", ghostTo - solid > 1);
    } else {
      rail.classList.remove("show-ghost");
    }

    railFill.style.top = railPad + "px";
    railFill.style.height = Math.max(0, solid - railPad).toFixed(2) + "px";
    if (railGhost) {
      railGhost.style.top = Math.max(railPad, solid).toFixed(2) + "px";
      railGhost.style.height = Math.max(0, ghostTo - solid).toFixed(2) + "px";
    }
  }

  var layoutPending = false, layoutAgain = false;
  function scheduleLayout() {
    if (layoutPending) { layoutAgain = true; return; }
    layoutPending = true;
    var runPass = function () {
      if (!layoutPending) return;
      layoutPending = false;
      layoutRail();
      onScroll(true);
      /* the body changed height (fonts, images, a late reflow): the
         pinned scene's offsets may be stale now — see zpdGuard */
      if (zpdGuard) zpdGuard.height();
      if (layoutAgain) { layoutAgain = false; scheduleLayout(); }
    };
    requestAnimationFrame(function () { requestAnimationFrame(runPass); });
    /* frame-starved safety (throttled webview, background tab, iframe) */
    setTimeout(runPass, 260);
  }

  var tbNowCh = document.getElementById("tbNowCh");
  var tbNowSl = document.getElementById("tbNowSl");

  function refreshRail() {
    if (!rail) return;
    var cur = null;
    if (navState.scene) cur = rail.querySelector('a[data-scene="' + navState.scene + '"]');
    if (!cur) cur = rail.querySelector('a[data-nav="' + navState.chapter + '"]');
    var passed = true;
    railLinks.forEach(function (a) {
      var isOn = a.hasAttribute("data-nav")
        ? a.getAttribute("data-nav") === navState.chapter
        : a.getAttribute("data-scene") === navState.scene;
      a.classList.toggle("on", isOn);
      if (isOn) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
      if (a === cur) passed = false;
      a.classList.toggle("done", a !== cur && passed);
    });

    /* top-bar counter: works where the rail has room for chapter dots only */
    var slide = 1;
    if (navState.scene) {
      var numEl = document.getElementById(navState.scene).querySelector(".scene-num");
      slide = numEl ? parseInt(faToEn(numEl.textContent.trim()), 10) || 1 : 1;
    } else if (navState.chapter === "closing") {
      slide = TOTAL_SLIDES;
    } else if (navState.chapter !== "hero") {
      /* a chapter divider is its chapter's first slide */
      var firstScene = document.querySelector('.scene[data-chapter="' + navState.chapter + '"]');
      if (firstScene) {
        var fn = firstScene.querySelector(".scene-num");
        slide = fn ? parseInt(faToEn(fn.textContent.trim()), 10) || 1 : 1;
      }
    }
    var chN = /^ch(\d)$/.exec(navState.chapter);
    var inPeople = navState.chapter === "people";
    if (tbNowCh) {
      tbNowCh.textContent = inPeople ? "پیوست" : chN ? "ف" + toFa(chN[1])
        : navState.chapter === "closing" ? "پایان" : "آغاز";
    }
    if (tbNowSl) {
      tbNowSl.textContent = inPeople ? "سه زندگی"
        : (slide < 10 ? "۰" : "") + toFa(slide) + "/" + toFa(TOTAL_SLIDES);
    }
  }

  /* Any smooth scroll already running (arrow keys, anchor links) would
     swallow a new rail click, so the rail owns its own scroll and keeps
     the URL hash in sync without a jump. */
  var TOP_OFFSET = 74;
  /* `behavior: "auto"` would inherit the CSS scroll-behavior: smooth, so
     a long hop has to disable it for the one call to stay instant. */
  function scrollNow(top) {
    /* behaviour:"instant" is the only form that ignores the stylesheet's
       scroll-behavior:smooth in every engine (Chrome animates a plain
       scrollTo(0, 0) even with an inline `auto`). Older engines fall back
       to a temporary stylesheet override. */
    try { window.scrollTo({ top: top, left: 0, behavior: "instant" }); return; }
    catch (e) {}
    var prev = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, top);
    root.style.scrollBehavior = prev || "";
  }
  function goTo(targetId) {
    var el = document.getElementById(targetId);
    if (!el) return;
    var offset = targetId === "hero" ? 0 : TOP_OFFSET;
    var top = Math.max(0, Math.min(maxScroll(), docTop(el) - offset));
    glideWindowTo(top, el, offset);
    if (history.replaceState) history.replaceState(null, "", "#" + targetId);
  }
  if (rail) {
    rail.addEventListener("click", function (ev) {
      var a = ev.target.closest ? ev.target.closest("a") : null;
      if (!a || !rail.contains(a)) return;
      var href = a.getAttribute("href") || "";
      if (href.charAt(0) !== "#") return;
      ev.preventDefault();
      goTo(href.slice(1));
    });
  }
  /* Delegate other in-page #anchor links (e.g. hero CTA) to smooth glide too,
     excluding modal triggers (#summary / #people) which handle their own doors */
  document.addEventListener("click", function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href^="#"]') : null;
    if (!a || (rail && rail.contains(a))) return;
    if (a.hasAttribute("data-summary-open") || a.hasAttribute("data-ppl-open") || a.hasAttribute("data-note-open")) return;
    var href = a.getAttribute("href") || "";
    if (href.length < 2) return;
    var id = href.slice(1);
    if (!document.getElementById(id)) return;
    ev.preventDefault();
    goTo(id);
  });

  /* A shared /#s26 link on a first visit: the browser scrolls to the
     fragment while the Persian text is still set in the fallback face,
     and the B Nazanin swap then shortens everything above the target by
     thousands of pixels. Chrome's scroll anchoring usually compensates,
     but when only the trailing padding of the previous section peeks out
     under the top bar it anchors to *that* section and the reader is
     left two slides further on (seen on phones). Browsers keep their own
     fragment anchor only until `load`; the swap can land after it, so the
     target is re-seated once the fonts settle — only on a fresh
     navigation (a reload or back/forward restores the old position
     instead) and only while the reader has not scrolled on their own. */
  (function keepDeepLink() {
    var id = (location.hash || "").slice(1);
    var el = id && document.getElementById(id);
    /* in-flow sections only — never the summary / people dialogs */
    if (!el || !el.matches("section[id]") || !el.closest("main, #closing")) return;
    if (!(document.fonts && document.fonts.ready)) return;
    var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    if (nav && nav.type !== "navigate") return;
    var armed = true;
    function disarm() { armed = false; }
    ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (t) {
      window.addEventListener(t, disarm, { passive: true, capture: true, once: true });
    });
    function reseat() {
      if (!armed) return;
      var want = Math.max(0, Math.min(maxScroll(), docTop(el) - (id === "hero" ? 0 : TOP_OFFSET)));
      if (Math.abs((window.scrollY || root.scrollTop || 0) - want) > 8) scrollNow(want);
      /* once the faces are in, the layout is final: stand down (an engine
         that resolves fonts.ready early still reports "loading" here and
         gets its second chance from loadingdone) */
      if (document.fonts.status === "loaded") disarm();
    }
    document.fonts.ready.then(reseat);
    if (document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", reseat);
  })();

  var lastZoneKey = "";
  function updateActive() {
    if (!zones.length) return;
    var cy = window.innerHeight * 0.5;
    var cur = null, lastAbove = null, i, r;
    for (i = 0; i < zones.length; i++) {
      r = zones[i].el.getBoundingClientRect();
      if (r.bottom <= cy) { lastAbove = zones[i]; continue; }
      if (r.top <= cy) cur = zones[i];
      break;
    }
    if (!cur) cur = lastAbove || zones[0];
    /* on the tall pinned scene the section itself owns the centre line
       for its whole pin, which is exactly what we want */
    var key = cur.scene || cur.chapter;
    if (key === lastZoneKey) return;
    lastZoneKey = key;
    navState.chapter = cur.chapter;
    navState.scene = cur.scene;
    zones.forEach(function (z) { if (z.scene) z.el.classList.toggle("on", z.scene === cur.scene); });
    refreshRail();
  }

  /* ---------------------------------------------------------------- 10 · ZPD (slide 23)
     The only pinned scene. ScrollTrigger owns the pin: the hand-rolled
     sticky + "elapsed pixels" maths drifted on resize, could not clean
     itself up, and jumped whenever the mobile browser chrome appeared.
     Rules taken from the gsap-scrolltrigger skill:
       · pin an element, animate its children — never the pinned node;
       · one trigger, one scrubbed timeline (no scrollTrigger on child
         tweens, and never scrub + toggleActions together);
       · invalidateOnRefresh, plus one refresh once webfonts land, because
         the stage height depends on B Nazanin;
       · gsap.matchMedia() decides pin / no-pin (short screens, reduced
         motion) instead of hand-measured pixel guesses.
     Without GSAP — or when the pin is skipped — no start state is ever
     applied, so the finished diagram simply shows. */
  var zpdGuard = null;
  var zpdWrap = document.querySelector(".zpd-wrap");
  if (zpdWrap && window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    /* The mobile URL bar hides on every scroll-down and shows again on
       every scroll-up. ScrollTrigger treats that as a resize, re-measures
       the pin and rewrites the pin spacer — the document gets taller, and
       the browser clamps or snaps scrollY under the reader's finger. That
       was the jump at the end of the page. Small height-only changes on a
       touch device are now ignored; a real resize (orientation, keyboard,
       desktop window) still refreshes. */
    try {
      ScrollTrigger.config({ ignoreMobileResize: true });
    } catch (e) {}
    var zpdStage = zpdWrap.querySelector(".zpd-stage");
    var zpdSteps = zpdWrap.querySelectorAll(".zpd-steps span");
    function zpdStepPaint(p) {
      var n = p < 0.2 ? 1 : p < 0.45 ? 2 : p < 0.68 ? 3 : 4;
      for (var i = 0; i < zpdSteps.length; i++) zpdSteps[i].classList.toggle("on", i < n);
    }
    var zpdMM = gsap.matchMedia();
    zpdMM.add({
      pin: "(prefers-reduced-motion: no-preference) and ((min-width: 821px) and (min-height: 640px)), " +
           "(prefers-reduced-motion: no-preference) and ((max-width: 820px) and (min-height: 700px))",
      flat: "(prefers-reduced-motion: reduce), (min-width: 821px) and (max-height: 639px), " +
            "(max-width: 820px) and (max-height: 699px)"
    }, function (ctx) {
      var q = gsap.utils.selector(zpdWrap);
      if (!ctx.conditions.pin) {
        gsap.set(q(".zpd-fig, .zpd-card, .zpd-title, .zpd-desc, .zpd-known, .zpd-unknown, .zpd-rule, .zpd-arrow, .zpd-cap"), { clearProps: "all" });
        zpdWrap.classList.add("zpd-static");
        zpdStepPaint(1);
        return;
      }
      zpdWrap.classList.remove("zpd-static");
      var tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "zpdPin",
          trigger: zpdStage,
          start: "top top",
          end: function () { return "+=" + Math.round(window.innerHeight * 1.3); },
          pin: true,
          anticipatePin: 1,
          scrub: 0.4,
          invalidateOnRefresh: true,
          onUpdate: function (self) { zpdStepPaint(self.progress); }
        }
      });
      /* the build finishes at ~0.72 of the pin; the tail is a hold so the
         finished diagram is actually readable before the pin releases */
      tl.from(q(".zpd-fig"), { opacity: 0, duration: 0.04 }, 0)
        .from(q(".zpd-card"), { opacity: 0, scale: 0.92, duration: 0.12 }, 0.02)
        .from(q(".zpd-title"), { opacity: 0, y: 10, duration: 0.10 }, 0.10)
        .from(q(".zpd-desc"), { opacity: 0, y: 8, duration: 0.10 }, 0.18)
        .from(q(".zpd-known, .zpd-unknown"), { opacity: 0, duration: 0.09 }, 0.28)
        .from(q(".zpd-rule"), { scaleX: 0, duration: 0.10 }, 0.38)
        .from(q(".zpd-arrow"), { opacity: 0, y: 12, duration: 0.12 }, 0.50)
        .from(q(".zpd-cap"), { opacity: 0, duration: 0.10 }, 0.62)
        .to({}, { duration: 0.28 }, 0.72);
      zpdStepPaint(0);
    });
    /* ScrollTrigger measures by scrolling the window to 0, reading the
       trigger's offset and scrolling back — and it switches the inline
       scroll-behavior to `auto` just before that scrollTo(0, 0) because
       the stylesheet asks for `smooth`. Chrome, however, skips the style
       flush for scrollTo(0, 0) (nothing to clamp) and resolves the
       behaviour against the *stale* computed style: the measuring scroll
       animates instead of jumping, the stage is read at the old offset
       while the scroll cache says 0, and start comes out as
       (real start − scrollY at refresh). Every refresh that runs while the
       reader stands mid-page — the fonts.ready refresh after a reload, a
       resize — lands the pin thousands of pixels off: slide 23 snaps on
       screen on top of a later slide, rides along, lets go. Applying
       `auto` ourselves at refreshInit and flushing style first makes the
       measuring scroll instant (Firefox flushes anyway; this is a no-op
       there). */
    ScrollTrigger.addEventListener("refreshInit", function () {
      root.style.scrollBehavior = "auto";
      void getComputedStyle(root).scrollBehavior; /* the read is the flush */
    });
    /* Belt and braces: positions also go stale when the document above
       the stage changes height after the last refresh — a late B Nazanin
       swap reflows the twenty-two Persian slides by a few thousand pixels
       on a machine without the font (Linux's DejaVu fallback is far
       wider), and some engines resolve fonts.ready before a deferred
       script has triggered a single load. So the pin verifies itself:
       every refresh is checked against the spacer's real position and
       repeated (with back-off) if it was wrong, every font batch
       (`loadingdone`) and every body-height change re-measure, and every
       scroll frame re-checks the recorded start (zpdGuard.check) — the
       net under everything else, including engines we cannot test. */
    var zpdRefreshT = 0, zpdRefreshDocH = 0, zpdRefreshes = 0, zpdRepairs = 0;
    function zpdRefresh(delay) {
      if (ScrollTrigger.isRefreshing || zpdRefreshT) return;
      zpdRefreshT = setTimeout(function () {
        zpdRefreshT = 0;
        zpdRefreshes++;
        ScrollTrigger.refresh();
      }, delay || 80);
    }
    function zpdDrift() {
      var st = ScrollTrigger.getById("zpdPin");
      if (!st || !st.pin) return 0;
      var spacer = zpdStage.parentNode;
      if (!spacer || !/\bpin-spacer\b/.test(spacer.className || "")) return 0;
      return (spacer.getBoundingClientRect().top + (window.scrollY || root.scrollTop || 0)) - st.start;
    }
    /* one more refresh, 150ms → 2.4s apart while the drift persists */
    function zpdRepair() {
      zpdRepairs++;
      zpdRefresh(Math.min(2400, 150 * Math.pow(2, Math.min(5, zpdRepairs - 1))));
    }
    ScrollTrigger.addEventListener("refresh", function () {
      zpdRefreshDocH = root.scrollHeight;
      if (Math.abs(zpdDrift()) > 2) zpdRepair();
      else zpdRepairs = 0;
      /* ScrollTrigger hands the inline scroll-behavior back as "smooth"
         one frame later; drop it again so the stylesheet — and its
         reduced-motion rule — stays the single source of truth */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { root.style.scrollBehavior = ""; });
      });
    });
    zpdGuard = {
      check: function () {
        if (ScrollTrigger.isRefreshing || zpdRefreshT) return;
        if (Math.abs(zpdDrift()) > 2) zpdRepair();
      },
      height: function () {
        if (zpdRefreshDocH && Math.abs(root.scrollHeight - zpdRefreshDocH) > 4) zpdRefresh();
      },
      drift: zpdDrift,
      refreshes: function () { return zpdRefreshes; },
      repairs: function () { return zpdRepairs; }
    };
    if (document.fonts) {
      if (document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
      if (document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", function () { zpdRefresh(); });
    }
    /* bfcache restore / a reload that lands mid-page: measure once more
       after the engine has settled its scroll restoration */
    window.addEventListener("pageshow", function (e) { if (e.persisted) zpdRefresh(); });
  }
  /* ---------------------------------------------------------------- illustrations */
  var illus = [];
  document.querySelectorAll(".illus").forEach(function (fig) {
    var parts = fig.querySelectorAll(".il-part");
    illus.push({
      fig: fig,
      parts: parts,
      draws: fig.querySelectorAll(".il-draw"),
      step: parts.length > 1 ? 0.4 / (parts.length - 1) : 0,
      last: -1,
      near: false
    });
  });
  function applyOne(rec) {
    var vh = window.innerHeight;
    var r = rec.fig.getBoundingClientRect();
    if (r.bottom < -80 || r.top > vh + 80) return;
    illusApply(rec, seg(vh * 0.96 - r.top, 0, vh * 0.62));
  }
  if (window.IntersectionObserver) {
    var illusIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var rec = en.target._rec;
        if (!rec) return;
        rec.near = en.isIntersecting;
        if (en.isIntersecting) applyOne(rec);
      });
    }, { rootMargin: "60% 0px 60% 0px" });
    illus.forEach(function (rec) { rec.fig._rec = rec; illusIO.observe(rec.fig); });
  } else {
    illus.forEach(function (rec) { rec.near = true; applyOne(rec); });
  }
  function illusApply(rec, p) {
    if (Math.abs(p - rec.last) < 0.003) return;
    rec.last = p;
    rec.draws.forEach(function (el) { el.style.strokeDasharray = "1"; el.style.strokeDashoffset = String(1 - p); });
    rec.parts.forEach(function (el, i) {
      var t = seg(p, i * rec.step, i * rec.step + 0.6);
      el.style.opacity = String(t);
      el.style.transform = "translateY(" + (14 * (1 - t)).toFixed(1) + "px) scale(" + (0.86 + 0.14 * t).toFixed(3) + ")";
    });
  }
  function buildIllustrations(applyOnly) {
    if (!illus.length) return;
    illus.forEach(function (rec) {
      if (reduced()) { illusApply(rec, 1); return; }
      if (!applyOnly && !rec.near) return;
      applyOne(rec);
    });
  }

  /* ---------------------------------------------------------------- scroll-linked essentials */
  var bar = document.getElementById("progress");
  var ticking = false, lastProgress = 0;

  /* the last measured geometry, so a resize can tell whether the reader
     was standing at the very bottom before the layout changed */
  var lastY = 0, lastVH = window.innerHeight, lastDocH = root.scrollHeight;
  function onScroll(force) {
    ticking = false;
    var y = window.scrollY || root.scrollTop || 0;
    var max = maxScroll();
    lastY = y; lastVH = window.innerHeight; lastDocH = root.scrollHeight;
    var p = clamp01(y / max);
    lastProgress = p;
    /* read before any write below: the layout is still clean here, so
       the pinned scene's self-check costs nothing */
    if (zpdGuard) zpdGuard.check();
    if (bar) bar.style.transform = "scaleX(" + p.toFixed(5) + ")";
    /* active zone first: the compact rail paints its solid line up to the
       lit chapter dot, so it has to know which chapter that is */
    updateActive();
    paintFill(y);
    if (toTop) toTop.classList.toggle("show", y > 700);

    if (illustrationsReady) buildIllustrations(false);
    fxDirty = true;
  }

  var scrollFallback = 0;
  function requestScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { onScroll(false); });
    clearTimeout(scrollFallback);
    scrollFallback = setTimeout(function () { if (ticking) onScroll(false); }, 140);
  }
  window.addEventListener("scroll", requestScroll, { passive: true });
  /* A viewport that changes height (mobile URL bar, on-screen keyboard,
     a rotated phone) changes the height of everything measured in svh and
     the length of the document with it. If the reader was standing on the
     last pixel, that used to leave them short of the bottom — the page had
     quietly moved under them, and the next scroll down "jumped". The bottom
     is now an anchor: same place before and after the change. */
  function onViewportChange() {
    /* While a modal reading view (#summary or #people) owns the screen,
       never force layout/scroll passes on the hidden deck underneath when
       mobile browser chrome hides or shows on scroll stop. */
    if (root.classList.contains("ppl-lock") || root.classList.contains("summary-lock")) return;
    var atBottom = lastY + lastVH >= lastDocH - 4;
    var yNow = window.scrollY || 0;
    requestScroll();
    scheduleLayout();
    if (!atBottom) return;
    /* the layout lands a frame or two later (and once more when webfonts or
       a lazy image settle), so the anchor is checked twice — but only while
       the reader has not scrolled away from where they were */
    function reanchor() {
      if (root.classList.contains("ppl-lock") || root.classList.contains("summary-lock")) return;
      if (Math.abs((window.scrollY || 0) - yNow) > 2) return;   /* the reader moved */
      var max = maxScroll();
      if (Math.abs((window.scrollY || 0) - max) > 2) scrollNow(max);
    }
    requestAnimationFrame(reanchor);
    setTimeout(reanchor, 240);
  }
  window.addEventListener("resize", onViewportChange);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onViewportChange);
  }

  var illustrationsReady = false;

  /* ---------------------------------------------------------------- reveals
     One IntersectionObserver per element, CSS transition. A tall group
     can never swallow its own reveal, and a throttled observer (which
     used to leave cards at opacity:0 for good) is rescued by the
     one-shot sweep below. */
  var rvEls = Array.prototype.slice.call(document.querySelectorAll(".rv"));
  var closingBits = document.querySelectorAll("#closing .thanks-card, #closing .presenters, #closing .btn-pdf, #closing .share-card, #closing .colophon");
  var closingRv = Array.prototype.slice.call(closingBits);
  var allRv = rvEls.concat(closingRv);

  document.querySelectorAll("[data-rv]").forEach(function (group) {
    var kids = group.querySelectorAll(".rv");
    for (var i = 0; i < kids.length; i++) kids[i].style.setProperty("--rv-i", i);
  });

  function revealEl(el) {
    if (el.classList.contains("in")) return;
    el.classList.add("in");
    if (reduced()) return;
    if (el.classList.contains("scene-head")) {
      var sk = el.querySelector(".scene-kicker");
      var ss = el.querySelector(".scene-slide");
      if (sk) tsStream(sk, { delay: 30, window: 300, duration: 280 });
      if (ss) tsWipe(ss, { delay: 65, duration: 400 });
    } else if (el.classList.contains("fnbar")) {
      tsStream(el, { delay: 55, window: 420, duration: 270, soft: true });
    } else if (el.classList.contains("thanks-card")) {
      var tfa = el.querySelector(".thanks-fa");
      var ten = el.querySelector(".thanks-en");
      if (tfa) tsWipe(tfa, { delay: 55, duration: 500 });
      if (ten) tsWipe(ten, { delay: 135, duration: 500 });
    } else if (el.classList.contains("presenters")) {
      tsStream(el, { delay: 60, window: 400, duration: 280, soft: true });
    } else if (el.classList.contains("share-card")) {
      var shT = el.querySelector(".share-title");
      var shS = el.querySelector(".share-sub");
      var shE = el.querySelector(".share-en");
      if (shT) tsWipe(shT, { delay: 55, duration: 460 });
      if (shS) tsStream(shS, { delay: 120, window: 420, duration: 280, soft: true });
      if (shE) tsStream(shE, { delay: 200, window: 420, duration: 280, soft: true });
    } else {
      var bFa = el.querySelector && el.querySelector(".boxin-fa");
      var bEn = el.querySelector && el.querySelector(".boxin-en");
      if (bFa) tsStream(bFa, { delay: 35, window: 540, duration: 280, soft: true });
      if (bEn) tsStream(bEn, { delay: 35, window: 540, duration: 280, soft: true });
    }
  }
  if (window.IntersectionObserver) {
    var rvIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        revealEl(en.target);
        rvIO.unobserve(en.target);
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -6% 0px" });
    allRv.forEach(function (el) { rvIO.observe(el); });
  } else {
    allRv.forEach(revealEl);
  }
  /* one-shot sweep: anything on screen that has not revealed yet, is */
  function sweepReveals() {
    var vh = window.innerHeight;
    allRv.forEach(function (el) {
      if (el.classList.contains("in")) return;
      var r = el.getBoundingClientRect();
      if (r.bottom > -40 && r.top < vh + 40) revealEl(el);
    });
  }

  /* Progressive WAAPI scroll arrival + directional soft-fade typing for the two
     gateway cards (#summaryPortal, #portal) and ZPD headers (#s23): keeps base
     CSS opacity:1 untouched in static/print/instant states. */
  if (window.IntersectionObserver) {
    var portalCards = Array.prototype.slice.call(document.querySelectorAll(".portal-card"));
    var portalIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        portalIO.unobserve(en.target);
        if (reduced()) return;
        if (en.target.animate) {
          en.target.animate([
            { opacity: 0.2, transform: "translateY(22px) scale(0.99)" },
            { opacity: 1, transform: "translateY(0) scale(1)" }
          ], { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
        }
        var ph2 = en.target.querySelector(".portal-h2");
        var psub = en.target.querySelector(".portal-sub");
        if (ph2) tsWipe(ph2, { delay: 55, duration: 470 });
        if (psub) tsStream(psub, { delay: 120, window: 450, duration: 280, soft: true });
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -4% 0px" });
    portalCards.forEach(function (card) { portalIO.observe(card); });

    /* Mirror RTL/LTR feathered title reveal on chapter dividers & #s23 ZPD header */
    var headTargets = Array.prototype.slice.call(document.querySelectorAll(".chapter, .zpd-head"));
    var headIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        headIO.unobserve(en.target);
        if (reduced()) return;
        if (en.target.classList.contains("chapter")) {
          var chFa = en.target.querySelector("h2");
          var chEn = en.target.querySelector(".ch-en");
          if (chFa) tsWipe(chFa, { delay: 45, duration: 520 });
          if (chEn) tsWipe(chEn, { delay: 110, duration: 520 });
        } else {
          var zk = en.target.querySelector(".scene-kicker");
          var zs = en.target.querySelector(".scene-slide");
          if (zk) tsStream(zk, { delay: 30, window: 300, duration: 280 });
          if (zs) tsWipe(zs, { delay: 65, duration: 400 });
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -4% 0px" });
    headTargets.forEach(function (t) { headIO.observe(t); });
  }

  /* ---------------------------------------------------------------- distance emphasis + scroll velocity */
  var fxFigs = illus.slice();
  var fxDirty = true, fxLastY = window.scrollY || 0, fxVel = 0, fxSVel = 0, fxIdle = 0, fxLast = "";

  function fxFrame() {
    requestAnimationFrame(fxFrame);
    if (document.hidden) return;
    var y = window.scrollY || 0;
    var dy = y - fxLastY;
    fxLastY = y;
    if (reduced()) {
      if (fxVel !== 0) { fxVel = 0; fxSVel = 0; root.style.setProperty("--vel", "0"); }
      return;
    }
    var target = Math.min(1, Math.abs(dy) / 55);
    fxVel += (target - fxVel) * 0.07;
    fxSVel += (Math.max(-46, Math.min(46, dy)) - fxSVel) * 0.07;
    if (Math.abs(fxVel) < 0.001 && Math.abs(dy) < 0.01) fxVel = 0;
    if (Math.abs(fxSVel) < 0.05) fxSVel = 0;

    /* idle: nothing moved and nothing is settling → do no layout work */
    if (!fxDirty && fxVel === 0 && fxSVel === 0) {
      if (fxIdle++ < 3) return;
      if (fxLast !== "") {
        root.style.setProperty("--vel", "0");
        fxFigs.forEach(function (rec) { if (rec.lastT) { rec.fig.style.transform = ""; rec.lastT = ""; } });
        fxLast = "";
      }
      return;
    }
    fxIdle = 0;
    fxDirty = false;
    root.style.setProperty("--vel", fxVel.toFixed(3));
    var vh = window.innerHeight, cy = vh * 0.5;
    var skew = Math.max(-0.55, Math.min(0.55, fxSVel * 0.011));
    fxFigs.forEach(function (rec) {
      if (!rec.near) { if (rec.lastT) { rec.fig.style.transform = ""; rec.lastT = ""; } return; }
      var r = rec.fig.getBoundingClientRect();
      var d = Math.abs(r.top + r.height / 2 - cy);
      var prox = Math.max(0, 1 - d / (vh * 0.9));
      var t = "scale(" + (1 + 0.02 * prox * prox).toFixed(4) + ") skewY(" + (skew * prox).toFixed(3) + "deg)";
      if (t !== rec.lastT) { rec.fig.style.transform = t; rec.lastT = t; }
    });
  }

  /* ---------------------------------------------------------------- keyboard: chapters */
  var stops = ["hero", "ch1", "ch2", "ch3", "ch4", "ch5", "closing"];
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a || a.classList.contains("skip")) return;
    /* the dossier trigger is a door, not an anchor: the people module owns it */
    if (a.hasAttribute("data-ppl-open") || a.hasAttribute("data-summary-open") || a.hasAttribute("data-note-open")) return;
    var id = a.getAttribute("href").slice(1);
    if (!id || !document.getElementById(id)) return;
    e.preventDefault();
    goTo(id);
  });

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || root.classList.contains("summary-lock") || root.classList.contains("ppl-lock") || root.classList.contains("share-lock") || root.classList.contains("note-lock")) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    var idx = stops.indexOf(navState.chapter);
    if (idx < 0) idx = 0;
    var next = e.key === "ArrowLeft" ? idx + 1 : idx - 1;
    if (next < 0 || next >= stops.length) return;
    var el = document.getElementById(stops[next]);
    if (el) { e.preventDefault(); goTo(stops[next]); }
  });

  /* ---------------------------------------------------------------- synchronous pre-tokenization & hero opening velvet reveal
     1. Pre-tokenize deck & portal prose synchronously BEFORE `layoutRail()` so
        document height, ScrollTrigger pins, and rail anchors stay 0.00px invariant
        for the entire lifetime of the session.
     2. Restore & elevate the signature smooth velvet hero entrance across ALL
        opening `#hero` elements (`.basmala`, `.hero-course`, `#heroCardFa`,
        `#heroCardEn`, and `#hero .presenters`):
          - Staggered card rise (`#heroCardFa` at 0.24s, `#heroCardEn` at 0.37s,
            0.90s silk cubic-bezier) + centered rule draw + presenters & actions glide
          - Bidi-safe word-by-word velvet blur-dissolve + gentle rise + inline-start
            directional drift (`RTL` right->left in Persian, `LTR` left->right in
            English), releasing `will-change` cleanly to `auto` on completion. */
  document.querySelectorAll(
    ".portal-sub, .scene .scene-kicker, .scene .boxin-fa, .scene .boxin-en, .scene .fnbar, #closing .presenters"
  ).forEach(tsPrepare);

  var heroWaAnims = [];
  var heroMeta = { groups: 0, words: 0 };

  function finishHeroAnims() {
    var heroEl = document.getElementById("hero");
    if (heroEl) tsCancelIn(heroEl);
    root.classList.remove("hero-anim");
    for (var i = 0; i < heroWaAnims.length; i++) {
      try { heroWaAnims[i].finish(); } catch (e) {}
    }
    heroWaAnims.length = 0;
  }

  function heroSplitWords(el) {
    if (!el) return [];
    var raw = el.textContent || "";
    var tokens = raw.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    var containerLtr = tsIsLtr(el);
    el.textContent = "";
    var out = [];
    var ltrRun = null;
    for (var i = 0; i < tokens.length; i++) {
      var wd = tokens[i];
      var isLatinWord = !containerLtr && /[A-Za-z0-9]/.test(wd) && !/[\u0600-\u06FF]/.test(wd);
      var s = document.createElement("span");
      s.className = "w";
      s.textContent = wd;
      if (isLatinWord) {
        if (!ltrRun) {
          if (i) el.appendChild(document.createTextNode(" "));
          ltrRun = document.createElement("span");
          ltrRun.className = "hero-ltr-run";
          ltrRun.setAttribute("dir", "ltr");
          el.appendChild(ltrRun);
        } else {
          ltrRun.appendChild(document.createTextNode(" "));
        }
        ltrRun.appendChild(s);
      } else {
        ltrRun = null;
        if (i) el.appendChild(document.createTextNode(" "));
        el.appendChild(s);
      }
      out.push(s);
    }
    return out;
  }

  function heroPlayGroup(anchorEl, selectors, startDelay, step, dur) {
    var words = [];
    document.querySelectorAll(selectors).forEach(function (el) {
      var ws = heroSplitWords(el);
      for (var i = 0; i < ws.length; i++) words.push(ws[i]);
    });
    if (!words.length || !anchorEl) return;
    heroMeta.groups++;
    heroMeta.words += words.length;
    tsBlockCount++;
    tsWordCount += words.length;
    var groupAnims = [];
    words.forEach(function (w, i) {
      if (!w.animate) return;
      var isWordLtr = tsIsLtr(w);
      var dx = isWordLtr ? "-0.2em" : "0.2em";
      var dxMid = isWordLtr ? "-0.06em" : "0.06em";
      var wa = w.animate([
        { opacity: 0, transform: "translate3d(" + dx + ", 0.5em, 0) scale(0.94)", filter: "blur(7.5px)" },
        { opacity: 0.64, transform: "translate3d(" + dxMid + ", 0.14em, 0) scale(0.985)", filter: "blur(2.2px)", offset: 0.42 },
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", filter: "blur(0px)" }
      ], {
        duration: dur,
        delay: startDelay + i * step,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "backwards"
      });
      if (document.timeline && typeof document.timeline.currentTime === "number") {
        try { wa.startTime = document.timeline.currentTime; } catch (e) {}
      }
      groupAnims.push(wa);
      heroWaAnims.push(wa);
    });
    var totalMs = Math.ceil(startDelay + Math.max(0, words.length - 1) * step + dur + 36);
    var timer = setTimeout(function () {
      tsActive.delete(anchorEl);
      tsCompleted++;
      if (!tsCountIn(document.getElementById("hero"))) {
        root.classList.remove("hero-anim");
        heroWaAnims.length = 0;
      }
    }, totalMs);
    tsActive.set(anchorEl, { timer: timer, kind: "hero", dir: tsIsLtr(anchorEl) ? "ltr" : "rtl", anims: groupAnims });
  }

  if (!reduced()) {
    root.classList.add("hero-anim");
    heroPlayGroup(document.querySelector("#hero .basmala"), "#hero .basmala", 35, 58, 820);
    heroPlayGroup(document.querySelector("#hero .hero-course"), "#hero .hero-course", 160, 48, 800);
    heroPlayGroup(document.getElementById("heroCardFa"), "#heroCardFa .hc-1, #heroCardFa .hc-2, #heroCardFa .hc-3", 210, 56, 840);
    heroPlayGroup(document.getElementById("heroCardEn"), "#heroCardEn .hc-1, #heroCardEn .hc-2, #heroCardEn .hc-3", 410, 52, 840);
    heroPlayGroup(document.querySelector("#hero .presenters"), "#hero .presenters", 580, 52, 800);
  }

  window.addEventListener("beforeprint", finishHeroAnims);
  if (reducedMQ.addEventListener) {
    reducedMQ.addEventListener("change", function (e) { if (e.matches) finishHeroAnims(); });
  }

  window.__heroMotion = {
    stats: function () {
      return {
        groups: heroMeta.groups,
        words: heroMeta.words,
        animating: root.classList.contains("hero-anim"),
        active: heroWaAnims.filter(function (a) { return a.playState === "running"; }).length
      };
    },
    finish: finishHeroAnims
  };

  /* ---------------------------------------------------------------- chapter range count-up */
  document.querySelectorAll(".ch-range").forEach(function (el) {
    var txt = el.textContent;
    var m = txt.match(/[۰-۹]+/g);
    if (!m || m.length < 2) return;
    var from = parseInt(faToEn(m[0]), 10), to = parseInt(faToEn(m[1]), 10);
    if (!(to > from)) return;
    var counted = false;
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting || counted) return;
        counted = true;
        cio.disconnect();
        if (reduced()) return;
        var t0 = null;
        (function step(ts) {
          if (!t0) t0 = ts;
          var t = Math.min(1, (ts - t0) / 900);
          var e = 1 - Math.pow(1 - t, 3);
          el.textContent = txt.replace(m[1], toFa(Math.round(from + (to - from) * e)));
          if (t < 1) requestAnimationFrame(step);
        })(performance.now());
      });
    }, { threshold: 0.6 });
    cio.observe(el);
  });

  /* ---------------------------------------------------------------- chapter ornaments parallax */
  var chOrn = [];
  document.querySelectorAll(".chapter").forEach(function (ch) {
    chOrn.push({ ch: ch, motif: ch.querySelector(".ch-motif"), draw: ch.querySelector(".ch-draw") });
  });
  function chOrnaments() {
    if (reduced()) return;
    var vh = window.innerHeight;
    chOrn.forEach(function (en) {
      var r = en.ch.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      if (en.motif) en.motif.style.transform = "translateY(" + (14 - 28 * p).toFixed(1) + "px)";
      if (en.draw) en.draw.style.transform = "translateY(" + (8 - 16 * p).toFixed(1) + "px)";
    });
  }

  /* ---------------------------------------------------------------- Motion: hero flourish & parallax */
  function motionInit() {
    var hero = document.getElementById("hero");
    var cardFa = document.getElementById("heroCardFa");
    var cardEn = document.getElementById("heroCardEn");
    var basmala = document.querySelector("#hero .basmala");
    var rule = document.getElementById("heroRule");
    var pres = document.querySelector("#hero .presenters");
    var actions = document.querySelector("#hero .hero-actions");
    var cueSvg = document.querySelector("#scrollCue svg");
    var EASE = [0.22, 1, 0.36, 1];
    var M = window.Motion;
    if (M && M.animate) {
      var animate = M.animate, scroll = M.scroll;
      if (basmala) animate(basmala, { opacity: [0, 1], y: [14, 0] }, { duration: 0.9, ease: EASE });
      if (rule) animate(rule, { scaleX: [0, 1] }, { duration: 1.05, ease: EASE, delay: 0.1 });
      if (cardFa) animate(cardFa, { opacity: [0, 1], y: [32, 0], scale: [0.985, 1] }, { duration: 0.95, ease: EASE, delay: 0.11 });
      if (cardEn) animate(cardEn, { opacity: [0, 1], y: [32, 0], scale: [0.985, 1] }, { duration: 0.95, ease: EASE, delay: 0.27 });
      if (pres) animate(pres, { opacity: [0, 1], y: [18, 0] }, { duration: 0.85, ease: EASE, delay: 0.52 });
      if (actions) animate(actions, { opacity: [0, 1], y: [16, 0] }, { duration: 0.82, ease: EASE, delay: 0.68 });
      if (cueSvg) animate(cueSvg, { y: [0, 7, 0] }, { duration: 1.9, repeat: Infinity, ease: "easeInOut" });
      if (hero && scroll && cardFa && cardEn) {
        scroll(function (info) {
          var p = info && info.y && typeof info.y.progress === "number" ? info.y.progress : null;
          if (p === null) return;
          cardFa.style.transform = "translateY(" + (-26 * p) + "px)";
          cardEn.style.transform = "translateY(" + (-48 * p) + "px)";
        }, { target: hero, offset: ["start start", "end start"] });
      }
      return;
    }
    /* Native Web Animations API fallback when Motion One is absent */
    var bez = "cubic-bezier(0.22, 1, 0.36, 1)";
    function wAnim(el, kf, dur, delay) {
      if (el && el.animate) el.animate(kf, { duration: dur, delay: delay, easing: bez, fill: "backwards" });
    }
    wAnim(basmala, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "translateY(0)" }], 900, 0);
    wAnim(rule, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 1050, 100);
    wAnim(cardFa, [{ opacity: 0, transform: "translateY(32px) scale(0.985)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], 950, 110);
    wAnim(cardEn, [{ opacity: 0, transform: "translateY(32px) scale(0.985)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], 950, 270);
    wAnim(pres, [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "translateY(0)" }], 850, 520);
    wAnim(actions, [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "translateY(0)" }], 820, 680);
  }

  /* ---------------------------------------------------------------- boot */
  illustrationsReady = true;
  layoutRail();
  onScroll(true);
  updateActive();
  refreshRail();
  buildIllustrations(true);
  chOrnaments();
  fxFrame();

  window.addEventListener("load", function () {
    layoutRail(); onScroll(true); buildIllustrations(true); sweepReveals(); chOrnaments();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { layoutRail(); onScroll(true); buildIllustrations(true); if (window.ScrollTrigger) ScrollTrigger.refresh(); });
  }
  if (window.ResizeObserver && document.body) {
    var ro = new ResizeObserver(function () { scheduleLayout(); });
    ro.observe(document.body);
    var mainEl = document.querySelector("main");
    if (mainEl) ro.observe(mainEl);
  }
  setTimeout(sweepReveals, 1200);
  setTimeout(sweepReveals, 3000);

  if (!reduced()) {
    try { motionInit(); } catch (err) { /* hero keeps its CSS state */ }
  }

  document.addEventListener("visibilitychange", function () {
    document.body.classList.toggle("tab-hidden", document.hidden);
  });

  /* ==================================================================
     PEOPLE — the Persian-only dossier (three lives, three tabs each)
     .ppl-pane and .ppl-panel are absolutely-positioned stacks, so the two
     wrappers carry measured heights: switching a person (or a tab) animates
     the wrapper to the new content instead of jumping the page.

     Two rules keep that honest:
       * a height is always computed as chrome + panel, never read back from
         a wrapper that may be mid transition;
       * re-measuring (fonts, A+/A−, theme, resize) happens with every
         transition switched off by a class, so no animation is restarted and
         no half-animated number is ever measured.
     ================================================================== */
  (function () {
    var sec = document.getElementById("people");
    if (!sec) return;

    var stage = sec.querySelector("[data-ppl-stage]");
    var ink = sec.querySelector(".ppl-ink");
    var persons = Array.prototype.slice.call(sec.querySelectorAll(".ppl-person"));
    var panes = Array.prototype.slice.call(sec.querySelectorAll(".ppl-pane"));
    if (!stage || !ink || !persons.length || persons.length !== panes.length) return;

    var cur = 0;
    var lastTab = panes.map(function () { return 0; });
    var lastTouch = 0;
    var NOFX = "ppl-nofx";

    /* ---- the door ------------------------------------------------------
       #people is a full-screen view, not a section: it is mounted on
       demand, measured while it is laid out, and taken back out of the
       document when it closes. The page underneath is locked, keeps its
       scroll offset to the pixel, and is made inert so focus and a screen
       reader can only see the view. */
    var sheet = sec.querySelector("[data-ppl-scroll]");
    var portal = document.querySelector("[data-ppl-open]");
    var closers = Array.prototype.slice.call(sec.querySelectorAll("[data-ppl-close]"));
    var behind = Array.prototype.slice.call(document.querySelectorAll("main, .topbar, #rail, #closing, #toTop"));
    var isOpen = false, savedY = 0, lastFocus = null, pushed = false;
    var closeTimer = 0, settleTimer = 0, enterTimer = 0, restorePopY = null, openedAt = 0;
    var hasModal = typeof sec.showModal === "function";

    function behindInert(on) {
      if (hasModal) return;
      behind.forEach(function (el) {
        if (!el) return;
        if ("inert" in el) el.inert = on;
        else if (on) el.setAttribute("inert", "");
        else el.removeAttribute("inert");
      });
    }

    function computeOrigin(recenterFromCard) {
      var W = window.innerWidth, H = window.innerHeight;
      var cx = parseFloat(sec.style.getPropertyValue("--ppl-ox"));
      var cy = parseFloat(sec.style.getPropertyValue("--ppl-oy"));
      if (recenterFromCard || !isFinite(cx) || !isFinite(cy)) {
        cx = W / 2; cy = H * 0.42;
        var hub = portal && portal.querySelector(".portal-hub");
        if (hub) {
          var r = hub.getBoundingClientRect();
          if (r.width && r.height && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W) {
            cx = r.left + r.width / 2;
            cy = r.top + r.height / 2;
          }
        }
        sec.style.setProperty("--ppl-ox", cx.toFixed(1) + "px");
        sec.style.setProperty("--ppl-oy", cy.toFixed(1) + "px");
      }
      var reach = Math.ceil(Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy))) + 44;
      sec.style.setProperty("--ppl-r", reach + "px");
    }

    var activeContentAnims = [];
    var boxHeightAnims = new WeakMap();

    /* Pre-tokenize all #people prose, quotes, tags, & fact values once so stage
       and panel heights are 0.00px invariant across every open & tab switch. */
    sec.querySelectorAll(".ppl-sub, .ppl-tag, .ppl-text p, .ppl-quote, .ppl-v").forEach(tsPrepare);

    function cancelContentAnims() {
      tsCancelIn(sec);
      while (activeContentAnims.length) {
        var a = activeContentAnims.pop();
        try { a.cancel(); } catch (e) {}
      }
    }

    function cancelBoxHeight(box) {
      if (!box) return;
      var prev = boxHeightAnims.get(box);
      if (prev) {
        boxHeightAnims.delete(box);
        try { prev.cancel(); } catch (e) {}
      }
      box.style.height = "";
    }

    function runAnim(el, keyframes, opts) {
      if (!el || !el.animate || reduced()) return null;
      var a = el.animate(keyframes, opts);
      if (document.timeline && typeof document.timeline.currentTime === "number") {
        try { a.startTime = document.timeline.currentTime; } catch (e) {}
      }
      activeContentAnims.push(a);
      var cleanup = function () {
        var idx = activeContentAnims.indexOf(a);
        if (idx >= 0) activeContentAnims.splice(idx, 1);
      };
      a.onfinish = cleanup;
      a.oncancel = cleanup;
      return a;
    }

    var EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

    function choreographPanel(panel, dir, baseDelay) {
      if (!panel || reduced()) return;
      var dx = (dir || 1) * -12;
      var delay0 = baseDelay || 0;
      var proseItems = Array.prototype.slice.call(panel.querySelectorAll(".ppl-text > *"));
      proseItems.forEach(function (node, idx) {
        tsStream(node, {
          delay: delay0 + Math.min(idx, 3) * 44,
          window: 400,
          duration: 260
        });
        runAnim(node, [
          { opacity: 0.14, transform: "translate3d(" + dx + "px, 7px, 0)" },
          { opacity: 1, transform: "translate3d(0, 0, 0)" }
        ], { duration: 380, delay: delay0 + Math.min(idx, 3) * 26, easing: EASE_OUT, fill: "backwards" });
      });
      var facts = panel.querySelector(".ppl-facts");
      if (facts) {
        Array.prototype.forEach.call(facts.querySelectorAll("li"), function (li, idx) {
          var vEl = li.querySelector(".ppl-v");
          if (vEl) {
            tsStream(vEl, {
              delay: delay0 + 45 + Math.min(idx, 4) * 28,
              window: 260,
              duration: 240
            });
          }
          runAnim(li, [
            { opacity: 0.16, transform: "translateY(5px)" },
            { opacity: 1, transform: "translateY(0)" }
          ], { duration: 330, delay: delay0 + 40 + Math.min(idx, 4) * 22, easing: EASE_OUT, fill: "backwards" });
        });
        runAnim(facts, [
          { opacity: 0.16, transform: "translate3d(" + (dx * 0.6).toFixed(1) + "px, 8px, 0)" },
          { opacity: 1, transform: "translate3d(0, 0, 0)" }
        ], { duration: 370, delay: delay0 + 25, easing: EASE_OUT, fill: "backwards" });
      }
    }

    function choreographPane(pane, dir, baseDelay) {
      if (!pane || reduced()) return;
      var dx = (dir || 1) * -15;
      var delay0 = baseDelay || 0;
      var idRow = pane.querySelector(".ppl-id");
      var nameEl = pane.querySelector(".ppl-name");
      var latinEl = pane.querySelector(".ppl-latin");
      var tagEl = pane.querySelector(".ppl-tag");
      var tabsRow = pane.querySelector(".ppl-tabs");
      var srcRow = pane.querySelector(".ppl-src");
      var mono = persons[cur] && persons[cur].querySelector(".ppl-mono");
      if (mono) {
        runAnim(mono, [
          { transform: "scale(0.84)" },
          { transform: "scale(1.08)", offset: 0.55 },
          { transform: "scale(1)" }
        ], { duration: 380, delay: delay0, easing: EASE_OUT });
      }
      if (idRow) {
        runAnim(idRow, [
          { opacity: 0.18, transform: "translate3d(" + dx + "px, 6px, 0)" },
          { opacity: 1, transform: "translate3d(0, 0, 0)" }
        ], { duration: 340, delay: delay0, easing: EASE_OUT, fill: "backwards" });
      }
      if (nameEl) tsWipe(nameEl, { delay: delay0 + 10, duration: 420 });
      if (latinEl) tsWipe(latinEl, { delay: delay0 + 35, duration: 420 });
      if (tagEl) tsStream(tagEl, { delay: delay0 + 45, window: 300, duration: 255 });
      if (tabsRow) {
        runAnim(tabsRow, [
          { opacity: 0.4, transform: "translateY(5px)" },
          { opacity: 1, transform: "translateY(0)" }
        ], { duration: 310, delay: delay0 + 20, easing: EASE_OUT, fill: "backwards" });
      }
      choreographPanel(activePanel(pane), dir, delay0 + 25);
      if (srcRow) {
        runAnim(srcRow, [
          { opacity: 0.2, transform: "translateY(5px)" },
          { opacity: 1, transform: "translateY(0)" }
        ], { duration: 310, delay: delay0 + 50, easing: EASE_OUT, fill: "backwards" });
      }
    }

    function choreographOpen() {
      if (reduced()) return;
      cancelContentAnims();
      var barEl = sec.querySelector(".ppl-bar");
      var headKids = sec.querySelectorAll(".ppl-head > *");
      var pplH2 = sec.querySelector(".ppl-h2");
      var pplSub = sec.querySelector(".ppl-sub");
      var switchEl = sec.querySelector(".ppl-switch");
      var footEl = sec.querySelector(".ppl-foot");
      if (barEl) {
        runAnim(barEl, [
          { opacity: 0, transform: "translateY(-10px)" },
          { opacity: 1, transform: "translateY(0)" }
        ], { duration: 400, delay: 40, easing: EASE_OUT, fill: "backwards" });
      }
      Array.prototype.forEach.call(headKids, function (el, idx) {
        runAnim(el, [
          { opacity: 0, transform: "translateY(14px)" },
          { opacity: 1, transform: "translateY(0)" }
        ], { duration: 460, delay: 85 + idx * 45, easing: EASE_OUT, fill: "backwards" });
      });
      if (pplH2) tsWipe(pplH2, { delay: 95, duration: 460 });
      if (pplSub) tsStream(pplSub, { delay: 140, window: 400, duration: 265, soft: true });
      if (switchEl) {
        runAnim(switchEl, [
          { opacity: 0, transform: "translateY(14px)" },
          { opacity: 1, transform: "translateY(0)" }
        ], { duration: 460, delay: 170, easing: EASE_OUT, fill: "backwards" });
      }
      runAnim(stage, [
        { opacity: 0, transform: "translateY(16px)" },
        { opacity: 1, transform: "translateY(0)" }
      ], { duration: 480, delay: 215, easing: EASE_OUT, fill: "backwards" });
      choreographPane(panes[cur], 1, 225);
      if (footEl) {
        runAnim(footEl, [
          { opacity: 0, transform: "translateY(12px)" },
          { opacity: 1, transform: "translateY(0)" }
        ], { duration: 420, delay: 290, easing: EASE_OUT, fill: "backwards" });
      }
    }

    function settlePeople() {
      clearTimeout(settleTimer);
      if (!isOpen) return;
      sec.classList.add("is-settled");
      root.classList.add("modal-settled");
    }

    function open(opts) {
      if (isOpen) return;
      isOpen = true;
      restorePopY = null;
      openedAt = Date.now();
      lastFocus = document.activeElement;
      savedY = window.scrollY || root.scrollTop || 0;
      clearTimeout(closeTimer);
      clearTimeout(settleTimer);
      clearTimeout(enterTimer);

      sec.classList.remove("is-settled", "is-open");
      computeOrigin(true);

      root.classList.add("ppl-lock");
      sec.classList.add("is-mounted");
      sec.removeAttribute("aria-hidden");
      if ("inert" in sec) sec.inert = false;
      sec.removeAttribute("inert");
      if (hasModal && !sec.open) sec.showModal();
      behindInert(true);
      if (sheet) sheet.scrollTop = 0;

      syncInkImmediate();
      sec.classList.add("is-entering");
      void sec.offsetHeight;
      sec.classList.add("is-open");
      choreographOpen();
      settleTimer = setTimeout(settlePeople, reduced() ? 0 : 700);
      enterTimer = setTimeout(function () {
        sec.classList.remove("is-entering");
      }, reduced() ? 0 : 820);

      setTimeout(function () {
        if (!isOpen) return;
        var target = sheet || sec.querySelector(".ppl-back");
        if (target) target.focus({ preventScroll: true });
      }, 70);

      pushed = false;
      if (!opts || !opts.silent) {
        try {
          if (history.pushState) { history.pushState({ mfaPeople: 1 }, "", "#people"); pushed = true; }
        } catch (e) { pushed = false; }
      }
    }

    function close(fromHistory) {
      if (!isOpen) return;
      isOpen = false;
      clearTimeout(settleTimer);
      clearTimeout(enterTimer);
      cancelContentAnims();
      cancelBoxHeight(stage);
      panes.forEach(function (p) { cancelBoxHeight(bodyOf(p)); });
      root.classList.remove("modal-settled");
      computeOrigin(false);
      sec.classList.remove("is-settled", "is-entering");
      void sec.offsetHeight;
      requestAnimationFrame(function () { sec.classList.remove("is-open"); });
      sec.setAttribute("aria-hidden", "true");
      if ("inert" in sec) sec.inert = true;
      else sec.setAttribute("inert", "");
      behindInert(false);
      root.classList.remove("ppl-lock");
      scrollNow(savedY);                 /* exact, and never animated */
      scheduleLayout();
      clearTimeout(closeTimer);
      closeTimer = setTimeout(function () {
        if (!isOpen) {
          sec.classList.remove("is-mounted", "is-open");
          if (hasModal && sec.open) sec.close();
        }
      }, reduced() ? 0 : 680);

      if (pushed && !fromHistory) {
        pushed = false;
        restorePopY = savedY;
        try { history.back(); } catch (e) { restorePopY = null; }
      } else if (!pushed && location.hash === "#people") {
        try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      }
      pushed = false;

      if (lastFocus && lastFocus.focus) {
        try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
      }
      lastFocus = null;
    }

    /* If the user immediately flings/scrolls downward before the .68s circle
       reveal finishes, settle instantly on the very first wheel/touch gesture
       or downward scroll (scrollTop > 2, ignoring open()'s own reset to 0). */
    function onEarlyScroll() {
      if (isOpen && !sec.classList.contains("is-settled")) settlePeople();
    }
    if (sheet) {
      sheet.addEventListener("touchmove", onEarlyScroll, { passive: true });
      sheet.addEventListener("wheel", onEarlyScroll, { passive: true });
      sheet.addEventListener("scroll", function () {
        if (sheet.scrollTop > 2) onEarlyScroll();
      }, { passive: true });
    }
    sec.addEventListener("cancel", function (e) {
      e.preventDefault();
      close(false);
    });
    window.addEventListener("beforeprint", function () {
      if (isOpen && hasModal && sec.open) sec.close();
    });
    window.addEventListener("afterprint", function () {
      if (isOpen && hasModal && !sec.open) sec.showModal();
    });

    if (portal) {
      portal.addEventListener("click", function (e) {
        e.preventDefault();
        open();
      });
    }
    closers.forEach(function (b) {
      b.addEventListener("click", function () { close(false); });
    });
    window.addEventListener("popstate", function () {
      if (restorePopY !== null && !isOpen) {
        var y = restorePopY;
        restorePopY = null;
        scrollNow(y);
        return;
      }
      restorePopY = null;
      if (location.hash === "#people") {
        if (!isOpen) open({ silent: true });
        return;
      }
      if (!isOpen) return;
      close(true);
    });
    window.addEventListener("hashchange", function () {
      if (location.hash === "#people" && !isOpen) open({ silent: true });
    });
    document.addEventListener("keydown", function (e) {
      if (!isOpen) return;
      if (e.key === "Escape" || e.key === "Esc") { e.preventDefault(); close(false); return; }
      if (e.key !== "Tab") return;
      /* a modal keeps Tab inside itself: the deck behind is inert, but the
         hidden panes and panels are filtered out as well */
      var all = sec.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      var list = Array.prototype.filter.call(all, function (el) {
        return el.offsetParent !== null && !el.closest('[aria-hidden="true"]');
      });
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      var at = list.indexOf(document.activeElement);   /* -1: the sheet itself */
      if (e.shiftKey && at <= 0) {
        e.preventDefault(); last.focus({ preventScroll: true });
      } else if (!e.shiftKey && (at === list.length - 1 || at === -1)) {
        e.preventDefault(); first.focus({ preventScroll: true });
      }
    });
    /* a shared link that ends in #people opens the view */
    if (location.hash === "#people") open({ silent: true });

    function bodyOf(pane) { return pane.querySelector("[data-ppl-body]"); }
    function panelsOf(pane) { return pane.querySelectorAll(".ppl-panel"); }
    function activePanel(pane) {
      return panelsOf(pane)[lastTab[panes.indexOf(pane)]] || panelsOf(pane)[0];
    }
    /* the pane minus its body: title row, tabs, source line */
    function chromeOf(pane) {
      var body = bodyOf(pane);
      return pane.offsetHeight - (body ? body.offsetHeight : 0);
    }

    function moveInk() {
      var b = persons[cur];
      if (!b) return;
      ink.style.width = b.offsetWidth + "px";
      ink.style.height = b.offsetHeight + "px";
      ink.style.transform = "translate(" + b.offsetLeft + "px," + b.offsetTop + "px)";
    }

    function moveTabInk(pane) {
      var bar = pane.querySelector(".ppl-tabink");
      var tabs = pane.querySelectorAll(".ppl-tab");
      var t = tabs[lastTab[panes.indexOf(pane)]];
      if (!bar || !t) return;
      bar.style.width = Math.max(20, t.offsetWidth - 24) + "px";
      bar.style.transform = "translate(" + (t.offsetLeft + 12) + "px," +
                            (t.offsetTop + t.offsetHeight - 3) + "px)";
    }

    function animateBoxHeight(el, applyChange, ms) {
      if (!el || reduced() || !el.animate) {
        cancelBoxHeight(el);
        applyChange();
        if (el) el.style.height = "";
        return;
      }
      var fromH = el.getBoundingClientRect().height;
      cancelBoxHeight(el);
      applyChange();
      var toH = el.getBoundingClientRect().height;
      if (!fromH || !toH || Math.abs(toH - fromH) < 2) {
        el.style.height = "";
        return;
      }
      var anim = el.animate([
        { height: fromH.toFixed(1) + "px" },
        { height: toH.toFixed(1) + "px" }
      ], { duration: ms || 390, easing: EASE_OUT });
      if (document.timeline && typeof document.timeline.currentTime === "number") {
        try { anim.startTime = document.timeline.currentTime; } catch (e) {}
      }
      boxHeightAnims.set(el, anim);
      var release = function () {
        if (boxHeightAnims.get(el) === anim) boxHeightAnims.delete(el);
        el.style.height = "";
      };
      anim.onfinish = release;
      anim.oncancel = release;
    }

    function syncInkImmediate() {
      cancelBoxHeight(stage);
      panes.forEach(function (pane) {
        cancelBoxHeight(bodyOf(pane));
      });
      var tabInks = Array.prototype.slice.call(sec.querySelectorAll(".ppl-tabink"));
      ink.style.transition = "none";
      tabInks.forEach(function (ti) { ti.style.transition = "none"; });
      moveInk();
      panes.forEach(moveTabInk);
      void ink.offsetHeight;
      ink.style.transition = "";
      tabInks.forEach(function (ti) { ti.style.transition = ""; });
    }

    function touch() { lastTouch = Date.now(); }

    /* anything not on screen must not be reachable by Tab or by a screen
       reader: aria-hidden alone leaves focusable buttons inside it, so the
       node is also made inert (and its buttons are parked at tabindex -1 on
       engines without inert) */
    function setHidden(el, hidden) {
      if (hidden) el.setAttribute("aria-hidden", "true");
      else el.removeAttribute("aria-hidden");
      if ("inert" in el) el.inert = !!hidden;
      Array.prototype.forEach.call(el.querySelectorAll("button"), function (b) {
        if (hidden) b.setAttribute("tabindex", "-1");
        else if (b.hasAttribute("data-ti")) b.removeAttribute("tabindex");
      });
    }
    Array.prototype.forEach.call(sec.querySelectorAll(".ppl-tab"), function (b) {
      b.setAttribute("data-ti", "");         /* remember which buttons it "owns" */
    });

    function showPane(i) {
      var prev = cur;
      var dir = i >= prev ? 1 : -1;
      cur = i;
      touch();
      sec.classList.remove("is-entering");
      cancelContentAnims();
      panes.forEach(function (p) { cancelBoxHeight(bodyOf(p)); });
      animateBoxHeight(stage, function () {
        persons.forEach(function (b, k) {
          b.setAttribute("aria-selected", k === i ? "true" : "false");
          b.tabIndex = k === i ? 0 : -1;
        });
        panes.forEach(function (p, k) {
          p.classList.toggle("is-on", k === i);
          setHidden(p, k !== i);
        });
      }, 390);
      moveInk();
      panes.forEach(moveTabInk);
      choreographPane(panes[i], dir, 0);
    }

    function selectTab(pane, k) {
      var tabs = Array.prototype.slice.call(pane.querySelectorAll(".ppl-tab"));
      var panels = panelsOf(pane);
      if (!tabs.length || k < 0 || k >= tabs.length) return;
      var paneIdx = panes.indexOf(pane);
      var prevTab = lastTab[paneIdx] || 0;
      var dir = k >= prevTab ? 1 : -1;
      touch();
      sec.classList.remove("is-entering");
      var body = bodyOf(pane);
      var applyTabs = function () {
        lastTab[paneIdx] = k;
        tabs.forEach(function (b, j) {
          b.setAttribute("aria-selected", j === k ? "true" : "false");
          b.tabIndex = j === k ? 0 : -1;
        });
        Array.prototype.forEach.call(panels, function (p, j) {
          p.classList.toggle("is-on", j === k);
          setHidden(p, j !== k);
        });
      };
      if (pane === panes[cur] && body) {
        cancelContentAnims();
        cancelBoxHeight(stage);
        animateBoxHeight(body, applyTabs, 380);
        choreographPanel(panels[k], dir, 0);
        /* If reader scrolled deep inside a tall tab and clicked a shorter tab
           whose tab bar is now above the sticky header, gently frame the tab bar */
        if (sheet && !reduced()) {
          var barEl = sec.querySelector(".ppl-bar");
          var tabsRow = pane.querySelector(".ppl-tabs");
          if (barEl && tabsRow) {
            var topDiff = tabsRow.getBoundingClientRect().top - barEl.getBoundingClientRect().bottom;
            if (topDiff < -12) {
              sheet.scrollTo({ top: Math.max(0, sheet.scrollTop + topDiff - 12), behavior: "smooth" });
            }
          }
        }
      } else {
        applyTabs();
      }
      moveTabInk(pane);
    }

    var lastRefitW = window.innerWidth;
    function refit(force) {
      if (!isOpen && !force) return;
      syncInkImmediate();
    }

    var refitTimer = 0;
    function scheduleRefit() {
      if (!isOpen) return;
      computeOrigin(false);
      /* Mobile URL bar hiding/showing only changes innerHeight: skip layout sync
         completely during vertical scroll and only re-position indicators if width changed! */
      if (window.innerWidth === lastRefitW) return;
      lastRefitW = window.innerWidth;
      clearTimeout(refitTimer);
      refitTimer = setTimeout(syncInkImmediate, 90);
    }

    /* click + keyboard for both tablists (RTL: left arrow moves forward) */
    function wire(items, count, pick) {
      items.forEach(function (btn, i) {
        btn.addEventListener("click", function () { pick(i, false); });
        btn.addEventListener("keydown", function (e) {
          var n = -1;
          if (e.key === "ArrowLeft") n = (i + 1) % count;
          else if (e.key === "ArrowRight") n = (i - 1 + count) % count;
          else if (e.key === "Home") n = 0;
          else if (e.key === "End") n = count - 1;
          else return;
          e.preventDefault();
          pick(n, true);
          items[n].focus();
        });
      });
    }

    wire(persons, persons.length, function (i, focus) {
      showPane(i);
      if (focus) persons[i].focus();
    });
    panes.forEach(function (pane) {
      var tabs = Array.prototype.slice.call(pane.querySelectorAll(".ppl-tab"));
      wire(tabs, tabs.length, function (j, focus) {
        selectTab(pane, j);
        if (focus) tabs[j].focus();
      });
    });

    panes.forEach(function (p, i) {
      setHidden(p, i !== 0);
      Array.prototype.forEach.call(panelsOf(p), function (pan, j) {
        setHidden(pan, j !== lastTab[i]);
      });
    });
    /* a horizontal flick on the dossier turns the page (RTL: a flick to the
       right is "next"), which is how tabs are expected to behave on a phone */
    var tX = 0, tY = 0, tT = 0;
    stage.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      tX = e.touches[0].clientX; tY = e.touches[0].clientY; tT = Date.now();
    }, { passive: true });
    stage.addEventListener("touchend", function (e) {
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      var dx = t.clientX - tX, dy = t.clientY - tY;
      if (Date.now() - tT > 700 || Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      showPane((cur + (dx > 0 ? 1 : -1) + panes.length) % panes.length);
    }, { passive: true });

    requestAnimationFrame(function () { sec.classList.add("ppl-live"); });

    window.addEventListener("resize", scheduleRefit);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", scheduleRefit);
    window.addEventListener("load", function () { if (isOpen) syncInkImmediate(); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (isOpen) syncInkImmediate(); });
    }
    if (window.MutationObserver) {
      new MutationObserver(function () { if (isOpen) setTimeout(syncInkImmediate, 40); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["data-fs", "data-theme"] });
    }

    /* debug/testing handle */
    window.__people = {
      go: function (i) { showPane(i); },
      tab: function (i) { selectTab(panes[cur], i); },
      open: function () { open(); },
      close: function () { close(false); },
      isOpen: function () { return isOpen; },
      docScroll: function () { return savedY; },
      state: function () {
        var pane = panes[cur], body = bodyOf(pane), panel = activePanel(pane);
        return {
          person: cur, pane: pane.id, tab: lastTab[cur],
          stage: Math.round(stage.offsetHeight),
          paneH: Math.round(pane.offsetHeight),
          bodyH: Math.round(body.offsetHeight),
          panelH: panel ? Math.round(panel.offsetHeight) : null,
          activeAnims: activeContentAnims.length + tsCountIn(sec),
          clipped: pane.offsetHeight > stage.offsetHeight + 1
        };
      }
    };
  })();

  /* ---------------------------------------------------------------- margin note: «جبر نامی» (#nominative)
     Slide 9 mentions nominative determinism in passing; the door under the
     slide opens a compact aside — a third, smaller appendix next to
     «سه زندگی» and «از ابتدای فصل تا اینجا». The <dialog> lives inside
     #s9 so a reader without JavaScript gets it inline, under the slide.
     Open: showModal(), scroll lock, an opacity + lift entrance committed
     from the closed styles with a forced style read, title wipe + prose
     stream, and one history entry (#nominative) so Back on a phone
     closes it. Tabs: roving tabindex, arrow keys (RTL: left = forward),
     a sliding ink, a height morph of the body, and the typing engine on
     the incoming panel. Esc plays the exit first; focus returns to the
     door. The translation above is never touched. */
  (function () {
    var view = document.getElementById("nominative");
    if (!view) return;
    var card = view.querySelector(".note-card");
    var tabs = Array.prototype.slice.call(view.querySelectorAll(".note-tab"));
    var panels = Array.prototype.slice.call(view.querySelectorAll(".note-panel"));
    var ink = view.querySelector(".note-ink");
    var body = view.querySelector("[data-note-body]");
    var doors = Array.prototype.slice.call(document.querySelectorAll("[data-note-open]"));
    var scene = view.closest(".scene");
    var hasModal = typeof view.showModal === "function";
    if (!card || !tabs.length || tabs.length !== panels.length || !body) return;

    var HASH = "#nominative";
    var EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
    var isOpen = false, cur = 0, opener = null, savedY = 0, restorePopY = null;
    var pushed = false, closeT = 0, heightAnim = null, anims = [];
    if (!hasModal) root.classList.add("note-static");   /* no <dialog>: the note stays inline under the slide */

    /* tokenised once, before the first open, so the body height never
       changes between a measured and an animated state */
    view.querySelectorAll(".note-sub, .note-panel p, .note-line li > span, .note-chip > span").forEach(tsPrepare);

    function cancelAnims() {
      tsCancelIn(view);
      while (anims.length) { try { anims.pop().cancel(); } catch (e) {} }
      if (heightAnim) { try { heightAnim.cancel(); } catch (e2) {} heightAnim = null; }
      body.style.height = "";
    }
    function run(el, kf, opts) {
      if (!el || !el.animate || reduced()) return;
      var a = el.animate(kf, opts);
      anims.push(a);
      var drop = function () { var i = anims.indexOf(a); if (i >= 0) anims.splice(i, 1); };
      a.onfinish = drop; a.oncancel = drop;
    }
    function moveInk(immediate) {
      var b = tabs[cur];
      if (!ink || !b) return;
      if (immediate) ink.style.transition = "none";
      ink.style.width = b.offsetWidth + "px";
      ink.style.height = b.offsetHeight + "px";
      ink.style.transform = "translate(" + b.offsetLeft + "px," + b.offsetTop + "px)";
      if (immediate) { void ink.offsetWidth; ink.style.transition = ""; }
    }
    function choreographPanel(panel, delay0) {
      if (!panel || reduced()) return;
      var items = Array.prototype.slice.call(panel.querySelectorAll(":scope > p, :scope > ol > li, :scope > .note-cap, :scope > .note-chips > li"));
      items.forEach(function (node, i) {
        var text = node.matches("li") ? node.querySelector(":scope > span") : node;
        if (text) tsStream(text, { delay: delay0 + Math.min(i, 4) * 40, window: 380, duration: 260 });
        run(node, [
          { opacity: 0.12, transform: "translate3d(10px, 6px, 0)" },
          { opacity: 1, transform: "translate3d(0, 0, 0)" }
        ], { duration: 380, delay: delay0 + Math.min(i, 4) * 26, easing: EASE, fill: "backwards" });
      });
    }
    function applyTab(i) {
      cur = i;
      tabs.forEach(function (b, k) {
        b.setAttribute("aria-selected", k === i ? "true" : "false");
        b.tabIndex = k === i ? 0 : -1;
      });
      panels.forEach(function (p, k) {
        p.classList.toggle("is-on", k === i);
        if (k === i) p.removeAttribute("aria-hidden"); else p.setAttribute("aria-hidden", "true");
      });
    }
    function select(i, focus) {
      if (i < 0 || i >= tabs.length) return;
      var changed = i !== cur;
      if (changed) {
        cancelAnims();
        var from = body.getBoundingClientRect().height;
        applyTab(i);
        var to = body.getBoundingClientRect().height;
        if (!reduced() && body.animate && from && to && Math.abs(to - from) >= 2) {
          heightAnim = body.animate([{ height: from.toFixed(1) + "px" }, { height: to.toFixed(1) + "px" }],
            { duration: 380, easing: EASE });
          var release = function () { heightAnim = null; body.style.height = ""; };
          heightAnim.onfinish = release; heightAnim.oncancel = release;
        }
        choreographPanel(panels[i], 0);
      }
      moveInk(false);
      if (focus) tabs[i].focus({ preventScroll: true });
    }
    function choreographOpen() {
      if (reduced()) return;
      var kicker = view.querySelector(".note-kicker");
      var title = view.querySelector(".note-title");
      var sub = view.querySelector(".note-sub");
      if (kicker) run(kicker, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 360, delay: 40, easing: EASE, fill: "backwards" });
      if (title) tsWipe(title, { delay: 70, duration: 520 });
      if (sub) tsStream(sub, { delay: 160, window: 420, duration: 280, soft: true });
      var row = view.querySelector(".note-tabs");
      if (row) run(row, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: 120, easing: EASE, fill: "backwards" });
      choreographPanel(panels[cur], 190);
      var foot = view.querySelector(".note-foot");
      if (foot) run(foot, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 300, easing: "ease", fill: "backwards" });
    }
    function seatScene() {
      /* a /#nominative deep link lands on a closed dialog (no box, so no
         fragment scroll): seat slide 9 behind the note so closing it
         leaves the reader at the paragraph the note belongs to */
      if (!scene) return;
      scrollNow(Math.max(0, Math.min(maxScroll(), docTop(scene) - TOP_OFFSET)));
    }
    function open(opts) {
      if (isOpen || !hasModal || view.open) return;
      var o = opts || {};
      isOpen = true;
      opener = o.from && o.from.focus ? o.from : null;
      restorePopY = null;
      if (o.seat) seatScene();
      savedY = window.scrollY || root.scrollTop || 0;
      clearTimeout(closeT);
      cancelAnims();
      root.classList.add("note-lock");
      try { view.showModal(); } catch (e) { root.classList.remove("note-lock"); isOpen = false; return; }
      card.scrollTop = 0;
      applyTab(cur);
      moveInk(true);
      try { card.focus({ preventScroll: true }); } catch (e2) { card.focus(); }
      if (reduced()) view.classList.add("is-in");
      else { void view.offsetWidth; view.classList.add("is-in"); }
      choreographOpen();
      pushed = false;
      if (!o.silent) {
        try { history.pushState({ mfaNote: 1 }, "", HASH); pushed = true; } catch (e3) { pushed = false; }
      }
    }
    /* idempotent: after our own close() and again on the engine's close
       event, so the lock never outlives the dialog */
    function settle() {
      clearTimeout(closeT);
      view.classList.remove("is-in");
      root.classList.remove("note-lock");
      cancelAnims();
      var back = opener;
      opener = null;
      if (back && document.contains(back)) {
        try { back.focus({ preventScroll: true }); } catch (e) { back.focus(); }
      }
    }
    /* history bookkeeping shared by every close path: our own entry is
       popped, a foreign #nominative is replaced, a Back-driven close
       leaves the address alone */
    function unwind(fromHistory) {
      if (pushed && !fromHistory) {
        pushed = false;
        restorePopY = savedY;
        try { history.back(); } catch (e) { restorePopY = null; }
      } else if (!pushed && !fromHistory && location.hash === HASH) {
        try { history.replaceState(null, "", location.pathname + location.search); } catch (e2) {}
      }
      pushed = false;
    }
    function close(fromHistory) {
      if (!isOpen) return;
      isOpen = false;
      view.classList.remove("is-in");
      var fin = function () { if (view.open) view.close(); settle(); };
      clearTimeout(closeT);
      if (reduced()) fin(); else closeT = setTimeout(fin, 330);
      unwind(fromHistory);
    }

    doors.forEach(function (d) {
      d.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
        e.preventDefault();
        if (!hasModal) { seatScene(); return; }   /* no <dialog>: the note is already inline below */
        open({ from: d });
      });
    });
    view.addEventListener("click", function (e) {
      if (e.target === view) { close(false); return; }
      var c = e.target.closest ? e.target.closest("[data-note-close]") : null;
      if (c) close(false);
    });
    view.addEventListener("touchmove", function (e) { if (e.target === view) e.preventDefault(); }, { passive: false });
    view.addEventListener("cancel", function (e) {
      e.preventDefault();
      if (isOpen && view.classList.contains("is-in")) { close(false); return; }
      clearTimeout(closeT);
      if (view.open) view.close();
      settle();
      isOpen = false;
    });
    view.addEventListener("close", function () {
      if (printing) return;
      if (isOpen) { isOpen = false; unwind(false); }   /* closed by the engine itself */
      settle();
    });
    view.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var list = Array.prototype.filter.call(view.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'), function (el) {
        return !el.hidden && el.tabIndex >= 0 && el.getClientRects().length > 0 && !el.closest('[aria-hidden="true"]');
      });
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1], a = document.activeElement;
      if (e.shiftKey) {
        if (a === first || !a || !view.contains(a) || a === card) { e.preventDefault(); last.focus(); }
      } else if (a === last) { e.preventDefault(); first.focus(); }
    });
    tabs.forEach(function (b, i) {
      b.addEventListener("click", function () { select(i, false); });
      b.addEventListener("keydown", function (e) {
        var n = -1, count = tabs.length;
        if (e.key === "ArrowLeft") n = (i + 1) % count;          /* RTL: left is forward */
        else if (e.key === "ArrowRight") n = (i - 1 + count) % count;
        else if (e.key === "Home") n = 0;
        else if (e.key === "End") n = count - 1;
        else return;
        e.preventDefault();
        select(n, true);
      });
    });
    /* a flick across the body turns the tab (RTL: a flick to the right is "next") */
    var tX = 0, tY = 0, tT = 0;
    body.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      tX = e.touches[0].clientX; tY = e.touches[0].clientY; tT = Date.now();
    }, { passive: true });
    body.addEventListener("touchend", function (e) {
      var t = e.changedTouches && e.changedTouches[0];
      if (!t || !tT) return;
      var dx = t.clientX - tX, dy = t.clientY - tY, dt = Date.now() - tT;
      tT = 0;
      if (dt > 700 || Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      select(dx > 0 ? Math.min(cur + 1, tabs.length - 1) : Math.max(cur - 1, 0), false);
    }, { passive: true });
    window.addEventListener("resize", function () { if (isOpen) moveInk(true); }, { passive: true });
    window.addEventListener("popstate", function () {
      if (restorePopY !== null && !isOpen && location.hash !== HASH) {
        var y = restorePopY;
        restorePopY = null;
        scrollNow(y);
        return;
      }
      restorePopY = null;
      if (location.hash === HASH) {
        /* Back / Forward onto our own entry: the browser restores the scroll
           the note was opened at; a typed or foreign #nominative gets seated */
        var own = !!(history.state && history.state.mfaNote);
        if (!isOpen) open({ silent: true, seat: !own });
        return;
      }
      if (isOpen) close(true);
    });
    window.addEventListener("hashchange", function () {
      if (location.hash === HASH && !isOpen) open({ silent: true, seat: true });
    });
    /* paper: the note leaves the top layer for the print and comes back
       afterwards (its own print rule hides it, but the scroll lock and
       the modal state must not be what the printer sees) */
    var printing = false;
    window.addEventListener("beforeprint", function () {
      if (!isOpen || !view.open) return;
      printing = true;
      root.classList.remove("note-lock");
      view.close();
    });
    window.addEventListener("afterprint", function () {
      if (!printing) return;
      printing = false;
      if (!isOpen) return;
      try { view.showModal(); root.classList.add("note-lock"); view.classList.add("is-in"); }
      catch (e) { isOpen = false; unwind(false); settle(); }
    });
    /* a shared link that ends in #nominative opens the note over slide 9 */
    if (location.hash === HASH) {
      open({ silent: true, seat: true });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (isOpen) seatScene(); });
    }

    window.__note = {
      open: function () { open({ from: doors[0] || null }); },
      close: function () { close(false); },
      go: function (i) { select(i, false); },
      isOpen: function () { return isOpen; },
      tab: function () { return cur; },
      docScroll: function () { return savedY; }
    };
  })();

  /* debug/testing handle */
  window.__rail = {
    state: function () { return { chapter: navState.chapter, scene: navState.scene, progress: lastProgress }; },
    layout: function () { layoutRail(); onScroll(true); },
    go: goTo,
    now: scrollNow,
    gliding: function () { return !!glideRAF; },
    update: updateActive,
    zpd: function () {
      var st = window.ScrollTrigger ? ScrollTrigger.getById("zpdPin") : null;
      return {
        pinned: !!st,
        static: zpdWrap ? zpdWrap.classList.contains("zpd-static") : null,
        p: st ? +st.progress.toFixed(3) : null,
        start: st ? Math.round(st.start) : null,
        end: st ? Math.round(st.end) : null,
        drift: zpdGuard ? Math.round(zpdGuard.drift()) : null,
        refreshes: zpdGuard ? zpdGuard.refreshes() : 0,
        repairs: zpdGuard ? zpdGuard.repairs() : 0
      };
    }
  };
})();
