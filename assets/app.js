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
      /* same rule as the rail: a long hop is instant, a short one glides —
         a 45 000px smooth scroll is a three-second blur, not a courtesy */
      if (reduced() || (window.scrollY || 0) > window.innerHeight * 2.5) scrollNow(0);
      else window.scrollTo({ top: 0, behavior: "smooth" });
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
  document.querySelectorAll("#hero, .chapter, .scene, #closing").forEach(function (el) {
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
  var stops = ["hero", "ch1", "ch2", "ch3", "ch4", "ch5", "closing"];
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a || a.classList.contains("skip")) return;
    /* the dossier trigger is a door, not an anchor: the people module owns it */
    if (a.hasAttribute("data-ppl-open") || a.hasAttribute("data-summary-open")) return;
    var id = a.getAttribute("href").slice(1);
    if (!id || !document.getElementById(id)) return;
    e.preventDefault();
    goTo(id);
  });

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || root.classList.contains("summary-lock") || root.classList.contains("ppl-lock")) return;
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

    function settlePeople() {
      clearTimeout(settleTimer);
      clearTimeout(enterTimer);
      sec.classList.remove("is-entering");
      if (!isOpen) return;
      sec.classList.add("is-settled");
      root.classList.add("modal-settled");
    }

    function open(opts) {
      if (isOpen) return;
      isOpen = true;
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
      settleTimer = setTimeout(settlePeople, reduced() ? 0 : 700);

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

    /* If the user immediately flings/scrolls before the .68s circle reveal finishes,
       settle instantly on the very first gesture/scroll event so clip-path drops
       and the underlying deck is hidden before a single scrolled frame paints. */
    function onEarlyScroll() {
      if (isOpen && !sec.classList.contains("is-settled")) settlePeople();
    }
    if (sheet) {
      sheet.addEventListener("touchmove", onEarlyScroll, { passive: true });
      sheet.addEventListener("wheel", onEarlyScroll, { passive: true });
      sheet.addEventListener("scroll", onEarlyScroll, { passive: true });
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
      if (restorePopY !== null) {
        var y = restorePopY;
        restorePopY = null;
        scrollNow(y);
        return;
      }
      if (!isOpen) return;
      if (Date.now() - openedAt < 450) return;   /* the close's own history.back() */
      close(true);
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

    var heightTimers = new WeakMap();
    function tweenHeight(el, applyChange, ms) {
      if (!el || reduced()) { applyChange(); if (el) el.style.height = ""; return; }
      clearTimeout(heightTimers.get(el));
      var fromH = el.offsetHeight;
      el.style.height = "";
      applyChange();
      var toH = el.offsetHeight;
      if (!fromH || Math.abs(toH - fromH) < 2) { el.style.height = ""; return; }
      sec.classList.add(NOFX);
      el.style.height = fromH + "px";
      void el.offsetHeight;
      sec.classList.remove(NOFX);
      el.style.height = toH + "px";
      heightTimers.set(el, setTimeout(function () {
        el.style.height = "";
      }, ms || 520));
    }

    function syncInkImmediate() {
      sec.classList.add(NOFX);
      stage.style.height = "";
      panes.forEach(function (pane) {
        var b = bodyOf(pane);
        if (b) b.style.height = "";
      });
      moveInk();
      panes.forEach(moveTabInk);
      void stage.offsetHeight;
      requestAnimationFrame(function () { sec.classList.remove(NOFX); });
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
      sec.classList.remove("is-entering");
      tweenHeight(stage, function () {
        persons.forEach(function (b, k) {
          b.setAttribute("aria-selected", k === i ? "true" : "false");
          b.tabIndex = k === i ? 0 : -1;
        });
        panes.forEach(function (p, k) {
          var b = bodyOf(p);
          if (b) b.style.height = "";
          p.classList.toggle("is-on", k === i);
          setHidden(p, k !== i);
        });
      }, 520);
      moveInk();
      panes.forEach(moveTabInk);
    }

    function selectTab(pane, k) {
      var tabs = Array.prototype.slice.call(pane.querySelectorAll(".ppl-tab"));
      var panels = panelsOf(pane);
      if (!tabs.length || k < 0 || k >= tabs.length) return;
      touch();
      sec.classList.remove("is-entering");
      var body = bodyOf(pane);
      var applyTabs = function () {
        lastTab[panes.indexOf(pane)] = k;
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
        stage.style.height = "";
        tweenHeight(body, applyTabs, 480);
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
