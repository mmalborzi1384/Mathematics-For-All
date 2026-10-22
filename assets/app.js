(function () {
  "use strict";
  var root = document.documentElement;
  var reducedMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  function reduced() { return reducedMQ.matches; }
  function seg(p, a, b) { var t = (p - a) / (b - a); return t < 0 ? 0 : t > 1 ? 1 : t; }

  /* ---------- theme toggle ---------- */
  var toggle = document.getElementById("themeToggle");
  function syncToggle() { toggle.setAttribute("aria-pressed", root.getAttribute("data-theme") === "dark" ? "true" : "false"); }
  syncToggle();
  toggle.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("tarjome-theme", next); } catch (e) {}
    syncToggle();
    scheduleLayout();
  });

  /* ---------- reading-size control (persisted) ---------- */
  var FS = ["sm", "md", "lg"];
  var fsDown = document.getElementById("fsDown");
  var fsUp = document.getElementById("fsUp");
  function fsIndex() { var i = FS.indexOf(root.getAttribute("data-fs")); return i < 0 ? 1 : i; }
  function applyFs(i) {
    i = Math.max(0, Math.min(2, i));
    root.setAttribute("data-fs", FS[i]);
    try { localStorage.setItem("tarjome-fs", FS[i]); } catch (e) {}
    if (fsDown) fsDown.disabled = i === 0;
    if (fsUp) fsUp.disabled = i === 2;
    scheduleLayout();
  }
  if (fsDown) fsDown.addEventListener("click", function () { applyFs(fsIndex() - 1); });
  if (fsUp) fsUp.addEventListener("click", function () { applyFs(fsIndex() + 1); });
  applyFs(fsIndex());

  /* ---------- fullscreen / presentation mode ---------- */
  var fsBtn = document.getElementById("fsToggle");
  if (fsBtn) fsBtn.addEventListener("click", function () {
    try {
      if (document.fullscreenElement) { document.exitFullscreen(); }
      else if (root.requestFullscreen) { root.requestFullscreen(); }
    } catch (e) {}
  });

  /* ---------- back to top ---------- */
  var toTop = document.getElementById("toTop");
  if (toTop) toTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
  });

  /* ---------- rail: add one dot per scene/slide ---------- */
  var rail = document.getElementById("rail");
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
      a.setAttribute("aria-label", "اسلاید " + num + " از ۳۱");
      a.innerHTML = '<span class="dot" aria-hidden="true"></span><span class="rlabel">اسلاید ' + num + "</span>";
      var ref = anchor;
      while (ref.nextElementSibling && ref.nextElementSibling.classList.contains("s-dot")) ref = ref.nextElementSibling;
      anchor.parentNode.insertBefore(a, ref.nextSibling);
    });
  }

  /* ==================================================================
     Rail state — LIVE GEOMETRY ONLY (root-cause fix).
     The old build derived state from two racing IntersectionObservers
     and positioned dots by flex order, so the highlighted dot and the
     fill routinely disagreed with the reader's actual position after
     the B Nazanin webfont swapped in, after A-/A+ or theme changes,
     and around the tall pinned ZPD scene.
     Now: every scroll frame recomputes the active zone from live
     getBoundingClientRect() — the zone whose rect contains the
     viewport centre line — and every dot's position on the track is
     its target's live document offset as a fraction of the live
     scrollable height. Nothing is cached across layout changes:
     layoutRail() re-runs on load, fonts.ready, resize, theme toggle,
     font-size change and any body size change (ResizeObserver).
     ================================================================== */
  var navState = { chapter: "hero", scene: null };
  var railLinks = rail ? Array.prototype.slice.call(rail.querySelectorAll("a")) : [];
  var zones = [];
  document.querySelectorAll("#hero, .chapter, .scene, #closing").forEach(function (el) {
    if (el.classList.contains("scene")) {
      zones.push({ el: el, chapter: el.getAttribute("data-chapter"), scene: el.id });
    } else {
      zones.push({ el: el, chapter: el.id, scene: null });
    }
  });
  function maxScroll() { return Math.max(1, root.scrollHeight - window.innerHeight); }
  function docTop(el) { return el.getBoundingClientRect().top + (window.scrollY || root.scrollTop || 0); }
  function layoutRail() {
    if (!rail) return;
    var max = maxScroll();
    var trackH = rail.clientHeight || 1;
    var mobile = window.innerWidth <= 900;
    /* Tiled spacing: raw proportions would stack dots in dense
       clusters (a chapter divider and its first scenes sit a few px
       apart on the track) and make them unclickable, while a fixed
       generous gap overflows the track and piles every late dot at
       the bottom. So the gap is derived from the track itself —
       track height / dot count, capped — and each hit box is set
       exactly one gap tall, so boxes tile without overlapping.
       Positions stay monotonic and as close to the true proportion
       as the tiling allows. On mobile only the 7 chapter dots are
       visible, so the gap is computed from those alone (44px+). */
    var chained = mobile ? railLinks.filter(function (a) { return a.hasAttribute("data-nav"); }) : railLinks;
    var head = mobile ? 22 : 14; /* keep the first dot clear of the fixed top bar */
    var limit = trackH - 8;
    var gap = Math.max(mobile ? 44 : 14, Math.min(mobile ? 56 : 30, (limit - head) / Math.max(1, chained.length)));
    /* style.top positions a dot's CENTRE (links are translateY(-50%)),
       so inset the centre range by half a hit box at both ends: the
       boxes then tile exactly inside the track instead of spilling a
       few px past its top and bottom edges. */
    head = Math.max(head, gap / 2);
    limit = Math.min(limit, trackH - gap / 2);
    if (limit < head) limit = head;
    function rawPos(a) {
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) !== "#") return null;
      var t = document.getElementById(href.slice(1));
      if (!t) return null;
      var f = Math.min(1, Math.max(0, docTop(t) / max));
      return head + f * (limit - head);
    }
    /* forward pass: spread clusters downward */
    var items = [], i, p;
    chained.forEach(function (a) { var rp = rawPos(a); if (rp !== null) items.push({ a: a, pos: rp }); });
    for (i = 0; i < items.length; i++) {
      var min = (i === 0 ? head : items[i - 1].pos + gap);
      if (items[i].pos < min) items[i].pos = min;
    }
    /* backward pass: if the spread overran the track, pull the tail
       back up so the last dot sits at the limit and nothing stacks */
    for (i = items.length - 1; i >= 0; i--) {
      var maxP = (i === items.length - 1 ? limit : items[i + 1].pos - gap);
      if (items[i].pos > maxP) items[i].pos = maxP;
    }
    items.forEach(function (it) {
      it.a.style.top = it.pos.toFixed(1) + "px";
      it.a.style.height = gap.toFixed(1) + "px";
    });
    /* hidden scene dots on mobile still get honest raw positions */
    if (mobile) railLinks.forEach(function (a) {
      if (a.hasAttribute("data-nav")) return;
      var rp = rawPos(a);
      if (rp !== null) a.style.top = rp.toFixed(1) + "px";
    });
  }
  var layoutPending = false, layoutAgain = false;
  function scheduleLayout() {
    /* After ANY relayout (font swap, theme, font-size, resize) the
       whole scroll frame is recomputed — dot positions, progress
       fill and the active zone — never just the dots. The pass is
       deferred to animation frames, not a fixed timer: a timer can
       fire mid-layout (the theme cross-fade and the A-/A+ reflow
       settle over several frames), leaving the fill and the lit dot
       describing the pre-change document. Two consecutive rAF
       passes run after the triggering change, and a trigger that
       arrives while a pass is pending schedules one more pass, so
       the last pass always reads settled geometry. */
    if (layoutPending) { layoutAgain = true; return; }
    layoutPending = true;
    var runPass = function () {
      if (!layoutPending) return;
      layoutPending = false;
      layoutRail(); onScroll();
      if (layoutAgain) { layoutAgain = false; scheduleLayout(); }
    };
    requestAnimationFrame(function () { requestAnimationFrame(runPass); });
    /* frame-starved safety: if no frame is produced (throttled
       webview, background tab), settle from a timer instead of
       leaving the rail describing the pre-change document */
    setTimeout(runPass, 200);
  }
  var sceneChip = document.getElementById("sceneChip");
  function refreshRail() {
    if (!rail) return;
    var cur = null;
    if (navState.scene) cur = rail.querySelector('a[data-scene="' + navState.scene + '"]');
    if (!cur) cur = rail.querySelector('a[data-nav="' + navState.chapter + '"]');
    var passed = true;
    railLinks.forEach(function (a) {
      /* The chapter dot of the chapter being read is lit together with
         the current scene's dot: on mobile the scene dots are hidden,
         so the lit chapter dot + scene chip are what show position. */
      var isOn = a.hasAttribute("data-nav")
        ? a.getAttribute("data-nav") === navState.chapter
        : a.getAttribute("data-scene") === navState.scene;
      a.classList.toggle("on", isOn);
      if (a === cur) passed = false;
      a.classList.toggle("done", a !== cur && passed);
    });
    /* mobile scene chip: "اسلاید N" pinned beside the lit chapter dot */
    if (sceneChip) {
      var chLink = rail.querySelector('a[data-nav="' + navState.chapter + '"]');
      if (navState.scene && chLink) {
        var numEl = document.querySelector("#" + navState.scene + " .scene-num");
        sceneChip.textContent = "اسلاید " + (numEl ? numEl.textContent.trim() : "");
        sceneChip.style.top = chLink.style.top;
        sceneChip.classList.add("show");
      } else {
        sceneChip.classList.remove("show");
      }
    }
  }
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
    var key = cur.scene || cur.chapter;
    if (key === lastZoneKey) return;
    lastZoneKey = key;
    navState.chapter = cur.chapter;
    navState.scene = cur.scene;
    zones.forEach(function (z) {
      if (z.scene) z.el.classList.toggle("on", z.scene === cur.scene);
    });
    refreshRail();
  }

  /* ---------- ZPD diagram build (vanilla: works with or without Motion) ---------- */
  var zpdWrap = document.querySelector(".zpd-wrap");
  var zpdParts = null;
  if (zpdWrap) {
    var stage = zpdWrap.querySelector(".zpd-stage");
    zpdParts = {
      frame: stage.querySelectorAll(".z-frame"),
      card: stage.querySelectorAll(".z-card"),
      title: stage.querySelectorAll(".z-title"),
      desc: stage.querySelectorAll(".z-desc"),
      known: stage.querySelectorAll(".z-known"),
      unknown: stage.querySelectorAll(".z-unknown"),
      base: stage.querySelectorAll(".z-base"),
      arrow: stage.querySelectorAll(".z-arrowg"),
      dots: stage.querySelectorAll(".zpd-dots span")
    };
  }
  function zpdApply(p) {
    if (!zpdParts) return;
    zpdParts.frame.forEach(function (el) { el.style.opacity = seg(p, 0, 0.08); });
    zpdParts.card.forEach(function (el) { var t = seg(p, 0.08, 0.3); el.style.opacity = t; el.style.transform = "scale(" + (0.55 + 0.45 * t) + ")"; });
    zpdParts.title.forEach(function (el) { var t = seg(p, 0.28, 0.42); el.style.opacity = t; el.style.transform = "translateY(" + (10 * (1 - t)) + "px)"; });
    zpdParts.desc.forEach(function (el) { el.style.opacity = seg(p, 0.4, 0.55); });
    zpdParts.known.forEach(function (el) { el.style.opacity = seg(p, 0.52, 0.64); });
    zpdParts.unknown.forEach(function (el) { el.style.opacity = seg(p, 0.56, 0.68); });
    zpdParts.base.forEach(function (el) { el.style.transform = "scaleX(" + seg(p, 0.62, 0.76) + ")"; });
    zpdParts.arrow.forEach(function (el) { el.style.opacity = seg(p, 0.74, 0.92); });
    var lit = p < 0.3 ? 1 : p < 0.55 ? 2 : p < 0.76 ? 3 : 4;
    zpdParts.dots.forEach(function (d, i) { d.classList.toggle("on", i < lit); });
  }

  /* ---------- scroll-linked essentials (vanilla, always on) ---------- */
  var bar = document.getElementById("progress");
  var railFill = document.getElementById("railFill");
  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY || root.scrollTop || 0;
    /* one denominator everywhere: the fill, the dot positions and
       the top progress bar must all describe the same fraction */
    var max = maxScroll();
    var p = Math.min(1, Math.max(0, y / max));
    if (bar) bar.style.transform = "scaleX(" + p + ")";
    if (railFill) railFill.style.height = (p * 100).toFixed(3) + "%";
    updateActive();
    if (toTop) toTop.classList.toggle("show", y > 700);
    if (zpdParts) {
      if (reduced()) { zpdApply(1); }
      else {
        var r = zpdWrap.getBoundingClientRect();
        var total = r.height - window.innerHeight;
        zpdApply(total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1);
      }
    }
  }
  var scrollFallback = 0;
  function requestScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScroll);
    /* same frame-starved safety for plain scrolling: a scroll that
       produces no frame must still move the fill and the lit dot */
    clearTimeout(scrollFallback);
    scrollFallback = setTimeout(function () { if (ticking) onScroll(); }, 140);
  }
  window.addEventListener("scroll", requestScroll, { passive: true });
  window.addEventListener("resize", function () { requestScroll(); scheduleLayout(); });
  onScroll();

  /* ---------- keyboard: arrow keys move between chapters ---------- */
  var stops = ["hero", "ch1", "ch2", "ch3", "ch4", "ch5", "closing"];
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    var idx = stops.indexOf(navState.chapter);
    if (idx < 0) idx = 0;
    var next = e.key === "ArrowLeft" ? idx + 1 : idx - 1;
    if (next < 0 || next >= stops.length) return;
    var el = document.getElementById(stops[next]);
    if (el) { e.preventDefault(); el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" }); }
  });

  /* ---------- rail layout triggers: never trust a stale offset ---------- */
  layoutRail();
  updateActive();
  refreshRail();
  window.addEventListener("load", function () { layoutRail(); onScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layoutRail(); onScroll(); });
  if (window.ResizeObserver && document.body) {
    var bodyRO = new ResizeObserver(scheduleLayout);
    bodyRO.observe(document.body);
  }
  /* debug/testing handle for the scripted rail test protocol */
  window.__rail = {
    state: function () { return { chapter: navState.chapter, scene: navState.scene }; },
    layout: function () { layoutRail(); onScroll(); },
    update: updateActive
  };

  /* ---------- pause ambient CSS motion while the tab is hidden ---------- */
  document.addEventListener("visibilitychange", function () {
    document.body.classList.toggle("tab-hidden", document.hidden);
  });

  /* ---------- hero title: staggered word reveal (rise + unblur + settle) ---------- */
  if (!reduced()) {
    var heroWords = [];
    document.querySelectorAll(".hero-card .hc-1, .hero-card .hc-2, .hero-card .hc-3").forEach(function (el) {
      /* clear the raw text first; splitWords re-adds it word by word */
      var raw = el.textContent;
      el.textContent = "";
      raw.trim().split(/\s+/).forEach(function (wd, i) {
        if (i) el.appendChild(document.createTextNode(" "));
        var s = document.createElement("span");
        s.className = "w";
        s.textContent = wd;
        el.appendChild(s);
        heroWords.push(s);
      });
    });
    heroWords.forEach(function (w, i) {
      if (!w.animate) return;
      w.animate([
        { opacity: 0, transform: "translateY(0.5em) scale(0.94)", filter: "blur(7px)" },
        { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0px)" }
      ], { duration: 780, delay: 150 + i * 55, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" });
    });
  }

  /* ---------- chapter dividers: slide-range count-up ---------- */
  var FA_D = "۰۱۲۳۴۵۶۷۸۹";
  function faToEn(s) { return s.replace(/[۰-۹]/g, function (d) { return String(FA_D.indexOf(d)); }); }
  function enToFa(n) { return String(n).replace(/[0-9]/g, function (d) { return FA_D[+d]; }); }
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
          el.textContent = txt.replace(m[1], enToFa(Math.round(from + (to - from) * e)));
          if (t < 1) requestAnimationFrame(step);
        })(performance.now());
      });
    }, { threshold: 0.6 });
    cio.observe(el);
  });

  /* ---------- distance-driven emphasis + scroll-velocity skew/settle ----------
     Continuous and proportional (no snap thresholds): the illustration
     nearest the viewport centre gently enlarges, and illustrations lean
     with scroll velocity, springing back when scrolling stops.
     Transform/opacity only; work is limited to near-viewport figures. */
  var fxFigs = [];
  document.querySelectorAll(".illus").forEach(function (fig) {
    var rec = { fig: fig, near: false, last: "" };
    fig._fx = rec;
    fxFigs.push(rec);
  });
  if (window.IntersectionObserver) {
    var fxIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.target._fx) en.target._fx.near = en.isIntersecting; });
    }, { rootMargin: "35% 0px 35% 0px" });
    fxFigs.forEach(function (rec) { fxIO.observe(rec.fig); });
  }
  var fxLastY = window.scrollY || 0, fxVel = 0, fxSVel = 0, fxLastH = 0;
  (function fxLoop() {
    requestAnimationFrame(fxLoop);
    if (document.hidden) return;
    var y = window.scrollY || 0;
    /* Layout-shift watchdog: if the document height changes for ANY
       reason (webfont swap, A-/A+, theme cross-fade, late media),
       the content under the viewport centre line can move without a
       scroll event ever firing — the stale-rail failure mode. Catch
       it here and recompute the whole rail frame from live geometry. */
    var dh = root.scrollHeight;
    if (fxLastH !== 0 && dh !== fxLastH) scheduleLayout();
    fxLastH = dh;
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
    root.style.setProperty("--vel", fxVel.toFixed(3));
    var vh = window.innerHeight, cy = vh * 0.5;
    var skew = Math.max(-0.55, Math.min(0.55, fxSVel * 0.011));
    fxFigs.forEach(function (rec) {
      if (!rec.near) { if (rec.last) { rec.fig.style.transform = ""; rec.last = ""; } return; }
      var r = rec.fig.getBoundingClientRect();
      var d = Math.abs(r.top + r.height / 2 - cy);
      var prox = Math.max(0, 1 - d / (vh * 0.9));
      var t = "scale(" + (1 + 0.02 * prox * prox).toFixed(4) + ") skewY(" + (skew * prox).toFixed(3) + "deg)";
      if (t !== rec.last) { rec.fig.style.transform = t; rec.last = t; }
    });
  })();

  /* ---------- Motion layer: progressive enhancement only ---------- */
  if (reduced() || typeof window.Motion === "undefined") return;
  try { motionInit(); } catch (err) { revealAll(); }
  startWatchdog();

  function revealAll() {
    document.querySelectorAll(".rv, .il-part").forEach(function (el) { el.style.opacity = ""; el.style.transform = ""; });
    document.querySelectorAll(".il-draw").forEach(function (el) { el.style.strokeDasharray = ""; el.style.strokeDashoffset = ""; });
    document.querySelectorAll("#closing .thanks-card, #closing .presenters, #closing .btn-pdf, #closing .colophon").forEach(function (el) { el.style.opacity = ""; el.style.transform = ""; });
  }

  /* Safety net: nothing the reader can see may stay hidden. */
  function startWatchdog() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var pending = 0;
      document.querySelectorAll("[data-rv] .rv, #closing .thanks-card, #closing .presenters, #closing .btn-pdf, #closing .colophon").forEach(function (el) {
        if (el.style.opacity === "0") {
          var r = el.getBoundingClientRect();
          if (r.bottom > -40 && r.top < window.innerHeight + 40) { el.style.opacity = ""; el.style.transform = ""; }
          else pending++;
        }
      });
      document.querySelectorAll(".il-part").forEach(function (el) {
        if (el.style.opacity === "0") {
          var r = el.getBoundingClientRect();
          if (r.bottom > 0 && r.top < window.innerHeight) {
            var n = +(el.getAttribute("data-wd") || 0) + 1;
            el.setAttribute("data-wd", n);
            if (n >= 3) { el.style.opacity = ""; el.style.transform = ""; }
            else pending++;
          }
        }
      });
      if (!pending || tries > 50) clearInterval(iv);
    }, 1200);
  }

  function motionInit() {
    var M = window.Motion;
    var animate = M.animate, scroll = M.scroll, inView = M.inView, stagger = M.stagger;
    var EASE = [0.22, 1, 0.36, 1];
    function infoProgress(info) {
      if (info && info.y && typeof info.y.progress === "number") return info.y.progress;
      return null;
    }

    /* ---------- hero: layered entrance + parallax ---------- */
    var hero = document.getElementById("hero");
    var cardFa = document.getElementById("heroCardFa");
    var cardEn = document.getElementById("heroCardEn");
    animate(".basmala", { opacity: [0, 1], y: [14, 0] }, { duration: 0.9, ease: EASE });
    animate("#heroRule", { scaleX: [0, 1] }, { duration: 1.1, ease: EASE, delay: 0.15 });
    animate(["#heroCardFa", "#heroCardEn"], { opacity: [0, 1], y: [34, 0] }, { duration: 0.9, ease: EASE, delay: stagger(0.12, { startDelay: 0.25 }) });
    animate("#hero .presenters", { opacity: [0, 1], y: [18, 0] }, { duration: 0.8, ease: EASE, delay: 0.55 });
    animate("#hero .hero-actions", { opacity: [0, 1], y: [16, 0] }, { duration: 0.8, ease: EASE, delay: 0.7 });
    scroll(function (info) {
      var p = infoProgress(info);
      if (p === null) return;
      if (cardFa) cardFa.style.transform = "translateY(" + (-26 * p) + "px)";
      if (cardEn) cardEn.style.transform = "translateY(" + (-48 * p) + "px)";
    }, { target: hero, offset: ["start start", "end start"] });
    animate("#scrollCue svg", { y: [0, 7, 0] }, { duration: 1.9, repeat: Infinity, ease: "easeInOut" });

    /* ---------- generic reveal groups ---------- */
    document.querySelectorAll("[data-rv]").forEach(function (group) {
      var items = group.querySelectorAll(".rv");
      if (!items.length) return;
      items.forEach(function (el) { el.style.opacity = "0"; });
      var stop = inView(group, function () {
        animate(items, { opacity: [0, 1], y: [30, 0] }, { duration: 0.85, ease: EASE, delay: stagger(0.13) });
        if (stop) stop();
      }, { amount: 0.12 });
    });

    /* ---------- illustrations: build step-by-step WITH the scroll + drift ---------- */
    var illus = [];
    document.querySelectorAll(".illus").forEach(function (fig) {
      var parts = fig.querySelectorAll(".il-part");
      illus.push({
        fig: fig,
        parts: parts,
        draws: fig.querySelectorAll(".il-draw"),
        svg: fig.querySelector("svg"),
        step: parts.length > 1 ? 0.4 / (parts.length - 1) : 0,
        last: -1
      });
    });
    function illusApply(en, p) {
      if (Math.abs(p - en.last) < 0.002) return;
      en.last = p;
      en.draws.forEach(function (el) { el.style.strokeDasharray = "1"; el.style.strokeDashoffset = String(1 - p); });
      en.parts.forEach(function (el, i) {
        var t = seg(p, i * en.step, i * en.step + 0.6);
        el.style.opacity = String(t);
        el.style.transform = "translateY(" + (14 * (1 - t)).toFixed(1) + "px) scale(" + (0.86 + 0.14 * t).toFixed(3) + ")";
      });
    }
    function illusDrift(en) {
      if (!en.svg) return;
      var r = en.fig.getBoundingClientRect();
      var vh = window.innerHeight;
      var pp = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      en.svg.style.transform = "translateY(" + (16 - 32 * pp).toFixed(1) + "px)";
    }
    illus.forEach(function (en) { illusApply(en, 0); });
    scroll(function () {
      var vh = window.innerHeight;
      illus.forEach(function (en) {
        var r = en.fig.getBoundingClientRect();
        if (r.bottom < -80) { illusApply(en, 1); return; }
        if (r.top > vh + 80) { illusApply(en, 0); return; }
        illusApply(en, seg(vh * 0.96 - r.top, 0, vh * 0.62));
        illusDrift(en);
      });
    });

    /* ---------- chapter dividers: motif + rule draw, headings rise, ornaments drift ---------- */
    document.querySelectorAll(".ch-draw path, .ch-motif .il-draw").forEach(function (path) {
      path.style.strokeDasharray = "1"; path.style.strokeDashoffset = "1";
      var stop = inView(path, function () {
        animate(path, { strokeDashoffset: [1, 0] }, { duration: 1.4, ease: EASE });
        if (stop) stop();
      }, { amount: 0.8 });
    });
    document.querySelectorAll(".chapter").forEach(function (ch) {
      var head = ch.querySelector(".ch-inner");
      var stop = inView(ch, function () {
        animate(head, { opacity: [0, 1], y: [26, 0] }, { duration: 0.9, ease: EASE });
        if (stop) stop();
      }, { amount: 0.35 });
    });
    var chOrn = [];
    document.querySelectorAll(".chapter").forEach(function (ch) {
      chOrn.push({ ch: ch, motif: ch.querySelector(".ch-motif"), draw: ch.querySelector(".ch-draw") });
    });
    scroll(function () {
      var vh = window.innerHeight;
      chOrn.forEach(function (en) {
        var r = en.ch.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
        if (en.motif) en.motif.style.transform = "translateY(" + (14 - 28 * p).toFixed(1) + "px)";
        if (en.draw) en.draw.style.transform = "translateY(" + (8 - 16 * p).toFixed(1) + "px)";
      });
    });

    /* ---------- closing: gentle staged entrance ---------- */
    var closingBits = document.querySelectorAll("#closing .thanks-card, #closing .presenters, #closing .btn-pdf, #closing .colophon");
    if (closingBits.length) {
      closingBits.forEach(function (el) { el.style.opacity = "0"; });
      var stopC = inView("#closing", function () {
        animate(closingBits, { opacity: [0, 1], y: [24, 0] }, { duration: 0.85, ease: EASE, delay: stagger(0.12) });
        if (stopC) stopC();
      }, { amount: 0.25 });
    }
  }
})();
