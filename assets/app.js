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

  /* ---------------------------------------------------------------- back to top */
  var toTop = document.getElementById("toTop");
  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
    });
  }

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
  document.querySelectorAll("#hero, .chapter, .scene, #people, #closing").forEach(function (el) {
    if (el.classList.contains("scene")) zones.push({ el: el, chapter: el.getAttribute("data-chapter"), scene: el.id });
    else zones.push({ el: el, chapter: el.id, scene: null });
  });

  function maxScroll() { return Math.max(1, root.scrollHeight - window.innerHeight); }
  function docTop(el) {
    return el.getBoundingClientRect().top + (window.scrollY || root.scrollTop || 0);
  }
  /* A 768px-tall laptop cannot hold 36 clickable dots on one track
     (they would be 3px apart), so it gets the same chapter-only rail as
     a phone instead of an unreadable pile. */
  function compactRail() { return window.innerWidth <= 900 || window.innerHeight < 800; }

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
    var top = Math.max(0, docTop(el) - (targetId === "hero" ? 0 : TOP_OFFSET));
    /* A chapter jump can be 20 000px: a smooth scroll over that distance
       crawls for seconds (and swallows the next click). Long hops are
       instant, short ones glide. */
    var far = Math.abs(top - (window.scrollY || 0)) > window.innerHeight * 2.5;
    if (reduced() || far) scrollNow(top);
    else {
      try { window.scrollTo({ top: top, behavior: "smooth" }); }
      catch (e) { scrollNow(top); }
    }
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
  var zpdWrap = document.querySelector(".zpd-wrap");
  if (zpdWrap && window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
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
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
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

  function onScroll(force) {
    ticking = false;
    var y = window.scrollY || root.scrollTop || 0;
    var max = maxScroll();
    var p = clamp01(y / max);
    lastProgress = p;
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
  window.addEventListener("resize", function () { requestScroll(); scheduleLayout(); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () { requestScroll(); scheduleLayout(); });
  }

  var illustrationsReady = false;

  /* ---------------------------------------------------------------- reveals
     One IntersectionObserver per element, CSS transition. A tall group
     can never swallow its own reveal, and a throttled observer (which
     used to leave cards at opacity:0 for good) is rescued by the
     one-shot sweep below. */
  var rvEls = Array.prototype.slice.call(document.querySelectorAll(".rv"));
  var closingBits = document.querySelectorAll("#closing .thanks-card, #closing .presenters, #closing .btn-pdf, #closing .colophon");
  var closingRv = Array.prototype.slice.call(closingBits);
  var allRv = rvEls.concat(closingRv);

  document.querySelectorAll("[data-rv]").forEach(function (group) {
    var kids = group.querySelectorAll(".rv");
    for (var i = 0; i < kids.length; i++) kids[i].style.setProperty("--rv-i", i);
  });

  function revealEl(el) { el.classList.add("in"); }
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
  var stops = ["hero", "ch1", "ch2", "ch3", "ch4", "ch5", "people", "closing"];
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a || a.classList.contains("skip")) return;
    var id = a.getAttribute("href").slice(1);
    if (!id || !document.getElementById(id)) return;
    e.preventDefault();
    goTo(id);
  });

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
    if (el) { e.preventDefault(); goTo(stops[next]); }
  });

  /* ---------------------------------------------------------------- hero word reveal */
  if (!reduced()) {
    var heroWords = [];
    document.querySelectorAll(".hero-card .hc-1, .hero-card .hc-2, .hero-card .hc-3").forEach(function (el) {
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

  /* ---------------------------------------------------------------- Motion: hero flourish only */
  function motionInit() {
    var M = window.Motion;
    if (!M || !M.animate) return;
    var animate = M.animate, scroll = M.scroll, EASE = [0.22, 1, 0.36, 1];
    var hero = document.getElementById("hero");
    var cardFa = document.getElementById("heroCardFa");
    var cardEn = document.getElementById("heroCardEn");
    animate(".basmala", { opacity: [0, 1], y: [14, 0] }, { duration: 0.9, ease: EASE });
    animate("#heroRule", { scaleX: [0, 1] }, { duration: 1.1, ease: EASE, delay: 0.15 });
    animate([cardFa, cardEn], { opacity: [0, 1], y: [34, 0] }, { duration: 0.9, ease: EASE, delay: 0.25 });
    animate("#hero .presenters", { opacity: [0, 1], y: [18, 0] }, { duration: 0.8, ease: EASE, delay: 0.5 });
    animate("#hero .hero-actions", { opacity: [0, 1], y: [16, 0] }, { duration: 0.8, ease: EASE, delay: 0.65 });
    animate("#scrollCue svg", { y: [0, 7, 0] }, { duration: 1.9, repeat: Infinity, ease: "easeInOut" });
    if (hero && scroll && cardFa && cardEn) {
      scroll(function (info) {
        var p = info && info.y && typeof info.y.progress === "number" ? info.y.progress : null;
        if (p === null) return;
        cardFa.style.transform = "translateY(" + (-26 * p) + "px)";
        cardEn.style.transform = "translateY(" + (-48 * p) + "px)";
      }, { target: hero, offset: ["start start", "end start"] });
    }
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

    /* give a pane's body the height of its active panel; return the height the
       pane itself must therefore take on the stage */
    function sizePane(pane) {
      var body = bodyOf(pane), panel = activePanel(pane);
      var h = panel ? panel.offsetHeight : 0;
      var chrome = chromeOf(pane);
      if (body) body.style.height = h + "px";
      return chrome + h;
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
      cur = i;
      touch();
      persons.forEach(function (b, k) {
        b.setAttribute("aria-selected", k === i ? "true" : "false");
        b.tabIndex = k === i ? 0 : -1;
      });
      panes.forEach(function (p, k) {
        p.classList.toggle("is-on", k === i);
        setHidden(p, k !== i);
      });
      moveInk();
      var h = sizePane(panes[i]);
      panes.forEach(moveTabInk);
      stage.style.height = h + "px";
    }

    function selectTab(pane, k) {
      var tabs = Array.prototype.slice.call(pane.querySelectorAll(".ppl-tab"));
      var panels = panelsOf(pane);
      if (!tabs.length || k < 0 || k >= tabs.length) return;
      touch();
      lastTab[panes.indexOf(pane)] = k;
      tabs.forEach(function (b, j) {
        b.setAttribute("aria-selected", j === k ? "true" : "false");
        b.tabIndex = j === k ? 0 : -1;
      });
      Array.prototype.forEach.call(panels, function (p, j) {
        p.classList.toggle("is-on", j === k);
        setHidden(p, j !== k);
      });
      moveTabInk(pane);
      var h = sizePane(pane);
      if (pane === panes[cur]) stage.style.height = h + "px";
    }

    /* fonts, A+/A−, theme, resize — measured with all transitions disabled */
    function refit() {
      if (Date.now() - lastTouch < 640) { setTimeout(refit, 660); return; }
      sec.classList.add(NOFX);
      var h = 0;
      panes.forEach(function (pane) {
        var body = bodyOf(pane), panel = activePanel(pane);
        if (body) body.style.height = (panel ? panel.offsetHeight : 0) + "px";
      });
      panes.forEach(function (pane) {      /* one layout pass, then measure */
        if (pane === panes[cur]) h = chromeOf(pane) + (activePanel(pane) ? activePanel(pane).offsetHeight : 0);
        else sizePane(pane);
      });
      if (!h) h = sizePane(panes[cur]);
      stage.style.height = h + "px";
      moveInk();
      panes.forEach(moveTabInk);
      void stage.offsetHeight;
      requestAnimationFrame(function () { sec.classList.remove(NOFX); });
      /* the dossier sits after the pinned ZPD scene, so its height only
         matters for total scroll length — refresh so the pin stays exact */
      if (window.ScrollTrigger) {
        try { ScrollTrigger.refresh(); } catch (e) {}
      }
    }

    var refitTimer = 0;
    function scheduleRefit() {
      clearTimeout(refitTimer);
      refitTimer = setTimeout(refit, 120);
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

    refit();
    requestAnimationFrame(function () { sec.classList.add("ppl-live"); });

    window.addEventListener("resize", scheduleRefit);
    window.addEventListener("load", scheduleRefit);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { setTimeout(refit, 80); });
    }
    if (window.MutationObserver) {
      new MutationObserver(scheduleRefit)
        .observe(document.documentElement, { attributes: true, attributeFilter: ["data-fs", "data-theme"] });
    }

    /* debug/testing handle */
    window.__people = {
      go: function (i) { showPane(i); },
      tab: function (i) { selectTab(panes[cur], i); },
      state: function () {
        var pane = panes[cur], body = bodyOf(pane), panel = activePanel(pane);
        return {
          person: cur, pane: pane.id, tab: lastTab[cur],
          stage: Math.round(stage.offsetHeight),
          paneH: Math.round(pane.offsetHeight),
          bodyH: Math.round(body.offsetHeight),
          panelH: panel ? Math.round(panel.offsetHeight) : null,
          clipped: pane.offsetHeight > stage.offsetHeight + 1
        };
      }
    };
  })();

  /* debug/testing handle */
  window.__rail = {
    state: function () { return { chapter: navState.chapter, scene: navState.scene, progress: lastProgress }; },
    layout: function () { layoutRail(); onScroll(true); },
    go: goTo,
    now: scrollNow,
    update: updateActive,
    zpd: function () {
      var st = window.ScrollTrigger ? ScrollTrigger.getById("zpdPin") : null;
      return {
        pinned: !!st,
        static: zpdWrap ? zpdWrap.classList.contains("zpd-static") : null,
        p: st ? +st.progress.toFixed(3) : null
      };
    }
  };
})();
