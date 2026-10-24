/* Full-site end-to-end engineering, motion, layout, mobile/desktop UI, and
   stress QA suite covering:
     1) Main-page #rail, #toTop, in-page anchors, & keyboard smooth gliding
        (frame-by-frame monotonic interpolation across GSAP ScrollTrigger #s23,
        mid-flight retargeting, wheel interruption, exact 0px landing)
     2) «سه زندگی» (#people) opening choreography, person-switch & tab-switch
        live WAAPI text/height transitions, chaotic rapid-click stress test,
        RTL touch swipe, mobile/desktop layout geometry, & zero-bleed scroll
     3) «از ابتدای فصل تا اینجا» (#summaryPortal + #summary) opening choreography,
        progressive 7-card WAAPI scroll reveals, smooth .sum-sheet gliding on
        .summary-jump / .sum-step / .summary-status, & .sum-step-ink alignment
     4) Complete 29-slide bilingual deck integrity, topbar controls, ZPD pin,
        font loading, zero HTTP/console errors, and source/PDF byte invariance.
     5) Short-laptop rail (every slide station from 600px tall, chapter-only
        below) and the #s23 ZPD pin staying exact through mid-page refreshes,
        mid-page reloads with a late font swap, and injected layout shifts
        (the Linux "slide 23 appears on later slides" regression); deep
        links (/#s26) stay seated through a late webfont swap on phones.
     6) Share section (#share card + #shareView lightbox): the canonical
        address and the QR code in both places, the hero / top-bar / tile
        openers, Esc / backdrop / close-button exits with the exit
        transition, scroll lock and focus return, Tab containment, arrow-key
        guard, async-clipboard copy and its execCommand fallback, the native
        share sheet (present / absent / dismissed / refused), reduced
        motion, phones (tap, 390 and 320 fit, hidden top-bar pill, /#share
        deep link), print and no-JS fallbacks. */
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: process.env.CHROME_PATH || await chromium.executablePath(),
    headless: true
  });
  let checks = 0;
  const ok = (cond, msg) => {
    assert.ok(cond, msg);
    checks++;
  };
  const base = process.env.BASE_URL || 'http://127.0.0.1:8000';

  async function sampleScrollGlide(page, readFn, maxMs = 1500) {
    const samples = [];
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      samples.push(await page.evaluate(readFn));
      await delay(45);
    }
    return samples;
  }

  try {
    /* ======================================================================
       PART 1: Desktop (1440x900) & Mobile (390x844, 320x568) Rail Smooth Glide
       ====================================================================== */
    for (const vp of [
      { width: 1440, height: 900, mobile: false },
      { width: 390, height: 844, mobile: true },
      { width: 320, height: 568, mobile: true }
    ]) {
      const page = await browser.newPage();
      const errors = [];
      const badResponses = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => {
        if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
      });

      await page.setViewport({
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        isMobile: vp.mobile,
        hasTouch: vp.mobile
      });
      await page.goto(base, { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready);

      ok(badResponses.length === 0, `zero failed HTTP assets at ${vp.width}x${vp.height}`);

      /* Verify rail & topbar geometry: coaxial track/fill/ghost, zero clipping at 320px+ */
      const railGeom = await page.evaluate(() => {
        const rail = document.getElementById('rail');
        const r = rail.getBoundingClientRect();
        const lineX = rail.querySelector('.rail-line').getBoundingClientRect().left;
        const fillX = rail.querySelector('.rail-fill').getBoundingClientRect().left;
        const ghostX = rail.querySelector('.rail-ghost').getBoundingClientRect().left;
        const links = [...rail.querySelectorAll('a')].filter(a => getComputedStyle(a).display !== 'none');
        const tops = links.map(a => a.getBoundingClientRect().top);
        let minGap = Infinity;
        for (let i = 1; i < tops.length; i++) minGap = Math.min(minGap, tops[i] - tops[i - 1]);
        const tbControls = [...document.querySelectorAll('.topbar .tb-actions > *')]
          .filter(el => getComputedStyle(el).display !== 'none');
        const topbarFits = tbControls.every(el => {
          const b = el.getBoundingClientRect();
          return b.left >= -0.5 && b.right <= innerWidth + 0.5;
        });
        return {
          inViewport: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
          coaxial: Math.abs(lineX - fillX) < 0.5 && Math.abs(lineX - ghostX) < 0.5,
          topbarFits,
          count: links.length,
          minGap
        };
      });
      ok(railGeom.inViewport, `rail stays strictly inside viewport at ${vp.width}x${vp.height}`);
      ok(railGeom.coaxial, `rail line, fill, and ghost strictly coaxial at ${vp.width}x${vp.height}`);
      ok(railGeom.topbarFits, `every topbar control fits 100% unclipped inside ${vp.width}x${vp.height}`);
      ok(railGeom.count >= 7, `rail renders stations (${railGeom.count}) at ${vp.width}x${vp.height}`);
      ok(railGeom.minGap > 8, `rail dots maintain clean spacing (${railGeom.minGap.toFixed(1)}px) at ${vp.width}x${vp.height}`);

      /* Test 1A: Distant rail jump across GSAP ScrollTrigger (#hero -> #ch5, >40,000px!) */
      await page.click('#rail a[href="#ch5"]');
      const ch5Samples = await sampleScrollGlide(page, () => window.scrollY, 1350);
      const ch5End = ch5Samples[ch5Samples.length - 1];
      const ch5Mid = ch5Samples.filter(v => v > 50 && v < ch5End - 50);
      let monotonicDown = true;
      for (let i = 1; i < ch5Samples.length; i++) {
        if (ch5Samples[i] < ch5Samples[i - 1] - 1) monotonicDown = false;
      }
      ok(ch5End > 15000, `rail jump to #ch5 reaches deep scroll (${Math.round(ch5End)}px) at ${vp.width}`);
      ok(ch5Mid.length >= 4, `rail jump to #ch5 glides smoothly (${ch5Mid.length} intermediate frames, zero snap) at ${vp.width}`);
      ok(monotonicDown, `rail glide down across #s23 ScrollTrigger is strictly monotonic at ${vp.width}`);

      const ch5ExactErr = await page.evaluate(() => {
        const el = document.getElementById('ch5');
        const max = document.documentElement.scrollHeight - innerHeight;
        const expected = Math.max(0, Math.min(max, el.getBoundingClientRect().top + window.scrollY - 74));
        return Math.abs(window.scrollY - expected);
      });
      ok(ch5ExactErr <= 2, `rail glide lands within 2px of #ch5 (${ch5ExactErr.toFixed(2)}px) at ${vp.width}`);

      /* Test 1B: #toTop button glides smoothly all the way back to y=0 (never teleports) */
      ok(await page.$eval('#toTop', b => b.classList.contains('show')), `#toTop visible at bottom at ${vp.width}`);
      await page.click('#toTop');
      const topSamples = await sampleScrollGlide(page, () => window.scrollY, 1350);
      const topMid = topSamples.filter(v => v > 50 && v < ch5End - 50);
      let monotonicUp = true;
      for (let i = 1; i < topSamples.length; i++) {
        if (topSamples[i] > topSamples[i - 1] + 1) monotonicUp = false;
      }
      ok(topMid.length >= 4, `#toTop glides smoothly back to top (${topMid.length} intermediate frames) at ${vp.width}`);
      ok(monotonicUp, `#toTop upward glide across #s23 is strictly monotonic at ${vp.width}`);
      ok(topSamples[topSamples.length - 1] <= 1, `#toTop lands cleanly at y=0 at ${vp.width}`);

      /* Test 1C: Mid-flight retargeting + wheel & scrollbar interruption */
      if (!vp.mobile) {
        await page.click('#rail a[href="#ch5"]');
        await page.waitForFunction(() => window.scrollY > 100 && window.scrollY < 35000, { timeout: 1500 });
        await page.click('#rail a[href="#ch2"]');
        await page.waitForFunction(() => !window.__rail.gliding(), { timeout: 2000 });
        const ch2Err = await page.evaluate(() => {
          const el = document.getElementById('ch2');
          const max = document.documentElement.scrollHeight - innerHeight;
          return Math.abs(window.scrollY - Math.max(0, Math.min(max, el.getBoundingClientRect().top + window.scrollY - 74)));
        });
        ok(ch2Err <= 2, `mid-flight retargeting lands cleanly on #ch2 (${ch2Err.toFixed(2)}px)`);

        await page.click('#rail a[href="#ch5"]');
        await delay(60);
        ok(await page.evaluate(() => window.__rail.gliding()), 'window.__rail.gliding() true mid-glide');
        await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true })));
        ok(await page.evaluate(() => !window.__rail.gliding()), 'wheel input immediately cancels programmatic glide');

        await page.click('#rail a[href="#ch5"]');
        await delay(60);
        ok(await page.evaluate(() => window.__rail.gliding()), 'window.__rail.gliding() true before scrollbar drag');
        await page.evaluate(() => window.scrollBy({ top: 120, behavior: 'instant' }));
        await page.waitForFunction(() => !window.__rail.gliding(), { timeout: 1000 });
        ok((await page.evaluate(() => window.scrollY)) < 25000, 'scrollbar drag immediately stops glide in place (never reaches #ch5)');
      }

      ok(errors.length === 0, `zero JS errors on ${vp.width}x${vp.height}: ${errors.join('; ')}`);
      await page.close();
    }

    /* ======================================================================
       PART 2: «سه زندگی» (#people) Live Motion, Switching & Monkey Stress QA
       ====================================================================== */
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({
        width,
        height: width < 500 ? 844 : 900,
        deviceScaleFactor: 2,
        isMobile: width < 500,
        hasTouch: width < 500
      });
      await page.goto(base, { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready);

      await page.$eval('#portal .portal-card', e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await delay(80);
      await page.click('#portal .portal-card');
      await delay(90);

      /* Verify real WAAPI opening choreography runs live */
      const openLive = await page.evaluate(() => window.__people.state());
      ok(openLive.activeAnims >= 4, `#people plays live WAAPI opening choreography (${openLive.activeAnims} anims) at ${width}`);
      await delay(820);

      /* Verify person switch (0 -> 2) plays live text + height animation and settles cleanly */
      await page.evaluate(() => document.querySelectorAll('.ppl-person')[2].click());
      await delay(75);
      const personMid = await page.evaluate(() => {
        const st = window.__people.state();
        const firstP = document.querySelector('.ppl-pane.is-on .ppl-panel.is-on .ppl-text p');
        const cs = getComputedStyle(firstP);
        const wordStreaming = [...firstP.querySelectorAll('.tw-tok')].some(
          t => parseFloat(getComputedStyle(t).opacity) < 0.99
        );
        return {
          anims: st.activeAnims,
          transform: cs.transform,
          opacity: parseFloat(cs.opacity),
          wordStreaming
        };
      });
      ok(personMid.anims >= 4, `person switch runs live WAAPI choreography (${personMid.anims} anims) at ${width}`);
      ok(personMid.transform !== 'none' || personMid.opacity < 0.99 || personMid.wordStreaming,
        `person switch interpolates prose live at ${width}`);

      await page.waitForFunction(() => window.__people.state().activeAnims === 0, { timeout: 2500 });
      const personSettled = await page.evaluate(() => {
        const st = window.__people.state();
        const firstP = document.querySelector('.ppl-pane.is-on .ppl-panel.is-on .ppl-text p');
        const cs = getComputedStyle(firstP);
        return { anims: st.activeAnims, clipped: st.clipped, opacity: cs.opacity, transform: cs.transform };
      });
      ok(
        personSettled.anims === 0 && !personSettled.clipped &&
        personSettled.opacity === '1' && personSettled.transform === 'none',
        `person switch settles to crisp opacity:1, transform:none, 0px clip at ${width}`
      );

      /* Verify tab switch (tab 0 -> tab 1) plays live WAAPI prose + facts animation */
      await page.evaluate(() => document.querySelector('.ppl-pane.is-on .ppl-tab:nth-of-type(2)').click());
      await delay(75);
      const tabMid = await page.evaluate(() => {
        const st = window.__people.state();
        const firstP = document.querySelector('.ppl-pane.is-on .ppl-panel.is-on .ppl-text p');
        const cs = getComputedStyle(firstP);
        const wordStreaming = [...firstP.querySelectorAll('.tw-tok')].some(
          t => parseFloat(getComputedStyle(t).opacity) < 0.99
        );
        return { anims: st.activeAnims, transform: cs.transform, opacity: parseFloat(cs.opacity), wordStreaming };
      });
      ok(tabMid.anims >= 3, `tab switch runs live WAAPI choreography (${tabMid.anims} anims) at ${width}`);
      ok(tabMid.transform !== 'none' || tabMid.opacity < 0.99 || tabMid.wordStreaming,
        `tab switch interpolates incoming text live at ${width}`);

      await delay(500);

      /* Chaotic rapid-click stress test: 16 rapid switches every 30ms */
      for (let step = 0; step < 16; step++) {
        await page.evaluate(s => {
          if (s % 2 === 0) document.querySelectorAll('.ppl-person')[s % 3].click();
          else document.querySelector('.ppl-pane.is-on').querySelectorAll('.ppl-tab')[s % 3].click();
        }, step);
        await delay(30);
      }
      await page.waitForFunction(() => (
        window.__people.state().activeAnims === 0 &&
        document.querySelector('.ppl-ink').getAnimations().every(a => a.playState === 'finished')
      ), { timeout: 2500 });
      const afterChaos = await page.evaluate(() => {
        const st = window.__people.state();
        const activePanes = document.querySelectorAll('.ppl-pane.is-on').length;
        const activePanels = document.querySelector('.ppl-pane.is-on').querySelectorAll('.ppl-panel.is-on').length;
        const btn = document.querySelector('.ppl-person[aria-selected="true"]');
        const ink = document.querySelector('.ppl-ink');
        const inkAligned = Math.abs(ink.getBoundingClientRect().left - btn.getBoundingClientRect().left) <= 2;
        return { anims: st.activeAnims, clipped: st.clipped, activePanes, activePanels, inkAligned };
      });
      ok(
        afterChaos.anims === 0 && !afterChaos.clipped &&
        afterChaos.activePanes === 1 && afterChaos.activePanels === 1 && afterChaos.inkAligned,
        `#people survives 16 rapid mid-transition monkey clicks cleanly at ${width}`
      );

      /* Mobile RTL horizontal swipe gesture on .ppl-stage */
      if (width < 500) {
        const beforePerson = await page.evaluate(() => window.__people.state().person);
        await page.evaluate(() => {
          const st = document.querySelector('.ppl-stage');
          st.dispatchEvent(new TouchEvent('touchstart', {
            bubbles: true,
            touches: [new Touch({ identifier: 1, target: st, clientX: 80, clientY: 300 })]
          }));
          st.dispatchEvent(new TouchEvent('touchend', {
            bubbles: true,
            changedTouches: [new Touch({ identifier: 1, target: st, clientX: 220, clientY: 305 })]
          }));
        });
        await delay(500);
        const afterPerson = await page.evaluate(() => window.__people.state().person);
        ok(afterPerson === (beforePerson + 1) % 3, 'mobile horizontal swipe smoothly advances active biography');
      }

      ok(errors.length === 0, `zero errors in #people stress QA at ${width}`);
      await page.close();
    }

    /* ======================================================================
       PART 3: «از ابتدای فصل تا اینجا» (#summary) Live Motion & Glide QA
       ====================================================================== */
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width, height: width < 500 ? 844 : 900, deviceScaleFactor: 2 });
      await page.goto(base, { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready);

      await page.$eval('[data-summary-open]', e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await delay(80);
      await page.click('[data-summary-open]');
      await delay(90);

      const sumOpen = await page.evaluate(() => window.__summary.state());
      ok(sumOpen.activeAnims >= 6, `#summary plays live WAAPI opening choreography (${sumOpen.activeAnims} anims) at ${width}`);
      await delay(920);

      /* Click jump chip 6 -> verify smooth sheet glide (multiple intermediate scrollTop frames) */
      await page.click('.summary-jump:nth-child(6)');
      const jumpSamples = await sampleScrollGlide(page, () => document.querySelector('[data-sum-scroll]').scrollTop, 900);
      await page.waitForFunction(() => !window.__summary.state().gliding, { timeout: 2000 });
      const jumpEnd = jumpSamples[jumpSamples.length - 1];
      const jumpMid = jumpSamples.filter(v => v > 20 && v < jumpEnd - 20);
      ok(jumpMid.length >= 2, `#summary jump glides smoothly (${jumpMid.length} intermediate frames) at ${width}`);

      /* Scroll smoothly through all 7 cards and verify every card runs its arrival choreography */
      for (let ci = 0; ci < 7; ci++) {
        await page.evaluate(idx => new Promise(resolve => {
          const s = document.querySelector('[data-sum-scroll]');
          const c = document.querySelectorAll('.summary-card')[idx];
          s.scrollTop = Math.max(0, c.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop - 90);
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }), ci);
      }
      await page.$eval('[data-sum-scroll]', s => { s.scrollTop = s.scrollHeight; });
      await delay(90);
      await page.waitForFunction(() => window.__summary.state().activeAnims === 0, { timeout: 2500 });
      /* the step ink glides on a CSS transition that is not a WAAPI anim:
         let it land before measuring its alignment */
      await page.waitForFunction(() => { const ink = document.querySelector('.sum-step-ink'); return !ink || ink.getAnimations().length === 0; }, { timeout: 2500 }).catch(() => {});
      const fullSweep = await page.evaluate(() => ({
        state: window.__summary.state(),
        stepInkAligned: (() => {
          const btn = document.querySelector('.sum-step.is-on');
          const ink = document.querySelector('.sum-step-ink');
          if (!btn || getComputedStyle(btn.parentElement).display === 'none') return true;
          return Math.abs(ink.getBoundingClientRect().left - btn.getBoundingClientRect().left) <= 2;
        })()
      }));
      ok(fullSweep.state.revealedCards === 7, `all 7 #summary cards ran scroll-reveal choreography at ${width}`);
      ok(fullSweep.state.activeAnims === 0, `all #summary animations settle cleanly to 0 at rest at ${width}`);
      ok(fullSweep.stepInkAligned, `.sum-step-ink pill aligns cleanly to active step button at ${width}`);

      ok(errors.length === 0, `zero errors in #summary motion QA at ${width}`);
      await page.close();
    }

    /* ======================================================================
       PART 4: Complete 29-Scene Deck, ZPD Pin (#s23), Topbar Controls & PDF
       ====================================================================== */
    const deckPage = await browser.newPage();
    await deckPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await deckPage.goto(base, { waitUntil: 'networkidle0' });
    await deckPage.evaluate(() => document.fonts.ready);

    const deckAudit = await deckPage.evaluate(async () => {
      const scenes = [...document.querySelectorAll('.scene')];
      const sceneIds = scenes.map(s => s.id);
      const expectedIds = Array.from({ length: 29 }, (_, i) => 's' + (i + 2));
      const allJustified = [...document.querySelectorAll('.scene .card p:not(.head)')].every(
        p => getComputedStyle(p).textAlign === 'justify'
      );
      const pdfRes = await fetch('assets/Mathematics-For-All.pdf');
      const pdfBuf = await pdfRes.arrayBuffer();
      const cacheTags = [
        document.querySelector('link[href*="style.css"]')?.getAttribute('href'),
        document.querySelector('script[src*="app.js"]')?.getAttribute('src'),
        document.querySelector('script[src*="summary.js"]')?.getAttribute('src')
      ];
      return {
        exactOrder: JSON.stringify(sceneIds) === JSON.stringify(expectedIds),
        allJustified,
        pdfOk: pdfRes.status === 200 && pdfBuf.byteLength === 921399,
        zpdReady: window.__rail.zpd().pinned === true,
        cacheSynced: cacheTags.every(t => t && t.includes('?v=20261024c'))
      };
    });
    ok(deckAudit.exactOrder, 'all 29 scenes (#s2..#s30) present in exact PDF order');
    ok(deckAudit.allJustified, 'every slide translation & original paragraph remains text-align: justify');
    ok(deckAudit.pdfOk, 'assets/Mathematics-For-All.pdf serves 200 OK with exact 921,399 bytes');
    ok(deckAudit.zpdReady, 'Slide 23 (#s23) ZPD ScrollTrigger pin active and healthy');
    ok(deckAudit.cacheSynced, 'style.css, app.js, and summary.js share unified cache-buster ?v=20261024c');

    /* Verify #hero velvet opening choreography, Bidi Latin run order, & zero resting GPU layers */
    await deckPage.waitForFunction(() => window.__heroMotion && !window.__heroMotion.stats().animating, { timeout: 4000 });
    const heroAudit = await deckPage.evaluate(() => {
      const stats = window.__heroMotion.stats();
      const cardFaLang = document.getElementById('heroCardFa')?.getAttribute('lang');
      const courseLatin = [...document.querySelectorAll('#hero .hero-course .hero-ltr-run .w')]
        .map(w => ({ text: w.textContent, left: w.getBoundingClientRect().left }));
      const courseOrderOk =
        courseLatin.length === 3 &&
        courseLatin[0].text === 'Mathematics' &&
        courseLatin[1].text === 'For' &&
        courseLatin[2].text === 'All' &&
        courseLatin[0].left < courseLatin[1].left &&
        courseLatin[1].left < courseLatin[2].left;
      const faLefts = [...document.querySelectorAll('#heroCardFa .hc-1 .w')].map(w => w.getBoundingClientRect().left);
      const enLefts = [...document.querySelectorAll('#heroCardEn .hc-1 .w')].map(w => w.getBoundingClientRect().left);
      const faRtlOk = faLefts.length === 3 && faLefts[0] > faLefts[1] && faLefts[1] > faLefts[2];
      const enLtrOk = enLefts.length === 3 && enLefts[0] < enLefts[1] && enLefts[1] < enLefts[2];
      const restingClean = [...document.querySelectorAll('#hero .w')].every(w => {
        const cs = getComputedStyle(w);
        return cs.opacity === '1' && cs.filter === 'none' && cs.willChange === 'auto';
      });
      return { stats, cardFaLang, courseOrderOk, faRtlOk, enLtrOk, restingClean };
    });
    ok(heroAudit.cardFaLang === 'fa', '#heroCardFa declares semantic lang="fa"');
    ok(heroAudit.stats.groups === 5 && heroAudit.stats.words >= 50 && heroAudit.stats.active === 0,
      `#hero velvet word engine tokenized all 5 opening groups (${heroAudit.stats.words} words) and settled to 0 active animations`);
    ok(heroAudit.courseOrderOk, 'Mathematics For All inside RTL .hero-course preserves strict LTR visual word order');
    ok(heroAudit.faRtlOk && heroAudit.enLtrOk, '#heroCardFa words flow RTL while #heroCardEn words flow LTR');
    ok(heroAudit.restingClean, 'all #hero .w spans release filter & will-change cleanly to auto at rest');

    /* Verify A+ / A- / Theme buttons in main topbar */
    await deckPage.click('#fsUp');
    ok(await deckPage.evaluate(() => document.documentElement.getAttribute('data-fs') === 'lg'), '#fsUp activates lg');
    await deckPage.click('#fsDown');
    ok(await deckPage.evaluate(() => (document.documentElement.getAttribute('data-fs') || 'md') === 'md'), '#fsDown returns to normal');
    await deckPage.click('#fsDown');
    ok(await deckPage.evaluate(() => document.documentElement.getAttribute('data-fs') === 'sm'), '#fsDown activates sm');
    await deckPage.click('#fsUp');
    await deckPage.click('#themeToggle');
    await delay(100);
    ok(await deckPage.evaluate(() => ['dark', 'light'].includes(document.documentElement.getAttribute('data-theme'))), '#themeToggle toggles cleanly');

    /* Verify directional soft-fade typing classes on #people person/tab switches + rapid Escape->Reopen->Back */
    await deckPage.$eval('#portal .portal-card', e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await delay(60);
    await deckPage.click('#portal .portal-card');
    await delay(850);
    const pplWipeDirs = await deckPage.evaluate(() => {
      document.querySelectorAll('.ppl-person')[1].click();
      const pane = document.querySelectorAll('.ppl-pane')[1];
      const nameEl = pane.querySelector('.ppl-name');
      const latinEl = pane.querySelector('.ppl-latin');
      const panelP = pane.querySelector('.ppl-panel.is-on .ppl-text p');
      return {
        nameRtl: nameEl.classList.contains('tw-wipe-rtl'),
        latinLtr: latinEl.classList.contains('tw-wipe-ltr'),
        proseStreaming: panelP.classList.contains('tw-play')
      };
    });
    ok(pplWipeDirs.nameRtl && pplWipeDirs.latinLtr && pplWipeDirs.proseStreaming,
      '#people person switch runs simultaneous RTL name wipe, LTR Latin wipe, and prose stream');

    await deckPage.waitForFunction(() => window.__people.state().activeAnims === 0, { timeout: 2500 });
    await deckPage.keyboard.press('Escape');
    await delay(720);
    /* Immediate re-open followed by browser Back (regression guard for restorePopY race) */
    await deckPage.click('#portal .portal-card');
    await delay(200);
    await deckPage.goBack();
    await delay(750);
    ok(await deckPage.evaluate(() => !window.__people.isOpen()),
      'rapid Escape -> Re-open -> Browser Back cleanly closes #people on first back');

    await deckPage.close();

    /* ======================================================================
       PART 5: Short laptop rail (600–849px) & #s23 pin exactness on reload
       ====================================================================== */
    /* 5A — the rail keeps all 36 stations on the common laptop viewports
       (1366×768, 1366×660, 1280×620) and only drops to chapter-only below
       600px; the first dot clears the 65px top bar and the last dot stays
       above the bottom edge */
    for (const vp of [
      { width: 1366, height: 768, full: true },
      { width: 1366, height: 660, full: true },
      { width: 1280, height: 620, full: true },
      { width: 1366, height: 560, full: false }
    ]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
      await page.goto(base, { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready);
      await delay(400);
      const rail = await page.evaluate(() => {
        const bar = document.querySelector('.topbar').getBoundingClientRect();
        const links = [...document.querySelectorAll('#rail a')];
        const shown = links.filter(a => getComputedStyle(a).display !== 'none');
        const dots = shown.map(a => a.querySelector('.dot').getBoundingClientRect());
        const centres = shown.map(a => { const b = a.getBoundingClientRect(); return b.top + b.height / 2; }).sort((x, y) => x - y);
        let minGap = Infinity;
        for (let i = 1; i < centres.length; i++) minGap = Math.min(minGap, centres[i] - centres[i - 1]);
        return {
          total: links.length,
          shown: shown.length,
          sceneDotsHidden: links.filter(a => a.classList.contains('s-dot')).every(a => getComputedStyle(a).display === 'none'),
          firstDotTop: Math.min(...dots.map(d => d.top)),
          lastDotBottom: Math.max(...dots.map(d => d.bottom)),
          barBottom: bar.bottom,
          minGap
        };
      });
      const tag = `${vp.width}x${vp.height}`;
      ok(rail.total === 36, `rail holds 36 stations in the DOM at ${tag}`);
      if (vp.full) {
        ok(rail.shown === 36, `short laptop keeps every slide station visible (${rail.shown}/36) at ${tag}`);
        ok(rail.minGap >= 13, `short-laptop rail pitch stays clickable (${rail.minGap.toFixed(1)}px) at ${tag}`);
      } else {
        ok(rail.shown === 7 && rail.sceneDotsHidden, `sub-600px window falls back to the chapter-only rail (${rail.shown}) at ${tag}`);
      }
      ok(rail.firstDotTop >= rail.barBottom, `first rail dot clears the top bar (${rail.firstDotTop.toFixed(1)} >= ${rail.barBottom}) at ${tag}`);
      ok(rail.lastDotBottom <= vp.height - 8, `last rail dot stays above the bottom edge at ${tag}`);
      ok(errors.length === 0, `zero JS errors on the short-laptop rail at ${tag}`);
      await page.close();
    }

    /* 5B — ScrollTrigger refresh mid-page: Chrome resolves scrollTo(0, 0)
       against the stale computed scroll-behavior, so without the
       refreshInit style flush every mid-page refresh measured the pin
       (real start − scrollY) too early; the pin must stay exact after a
       refresh issued at slide 26, after a reload that lands at slide 26
       with the webfont arriving late, and after an injected layout shift */
    {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: 1366, height: 660, deviceScaleFactor: 1 });
      await page.evaluateOnNewDocument(() => {
        window.__zpdLog = [];
        document.addEventListener('DOMContentLoaded', () => {
          if (!window.ScrollTrigger) return;
          ScrollTrigger.addEventListener('refresh', () => {
            const st = ScrollTrigger.getById('zpdPin');
            const spacer = document.querySelector('.pin-spacer');
            if (!st || !spacer) return;
            const real = spacer.getBoundingClientRect().top + scrollY;
            window.__zpdLog.push({ start: Math.round(st.start), real: Math.round(real), bad: Math.abs(st.start - real) > 2 });
          });
        });
      });
      let delayFont = false;
      await page.setRequestInterception(true);
      page.on('request', req => {
        if (delayFont && /BNazanin/.test(req.url())) setTimeout(() => req.continue().catch(() => {}), 900);
        else req.continue().catch(() => {});
      });
      await page.setCacheEnabled(false);
      await page.goto(base, { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready);
      await delay(500);
      await page.evaluate(() => {
        const el = document.getElementById('s26');
        window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 40, behavior: 'instant' });
      });
      await delay(600);
      const midRefresh = await page.evaluate(() => {
        ScrollTrigger.refresh();
        const z = window.__rail.zpd();
        return { drift: z.drift, start: z.start, scrollY: Math.round(scrollY), pinned: z.pinned };
      });
      ok(midRefresh.pinned && Math.abs(midRefresh.drift) <= 2,
        `ScrollTrigger.refresh() issued at slide 26 (scrollY ${midRefresh.scrollY}) keeps the #s23 pin exact (drift ${midRefresh.drift}px)`);

      /* reload mid-page with the webfont 900ms late: Chrome restores the
         scroll first, the Persian slides reflow when B Nazanin lands */
      delayFont = true;
      await page.evaluate(() => { window.__zpdLog = []; });
      await page.reload({ waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await delay(1400);
      const afterReload = await page.evaluate(() => {
        const z = window.__rail.zpd();
        let centre = null;
        for (const el of document.querySelectorAll('#hero, .chapter, .scene, #closing')) {
          const b = el.getBoundingClientRect();
          if (b.top <= innerHeight / 2 && b.bottom > innerHeight / 2) { centre = el.id; break; }
        }
        return { drift: z.drift, start: z.start, repairs: z.repairs, pinned: z.pinned, centre, fontLoaded: document.fonts.check('16px "B Nazanin"'),
          refreshes: window.__zpdLog.length, corrupted: window.__zpdLog.filter(l => l.bad).length };
      });
      delayFont = false;
      ok(afterReload.fontLoaded, 'late B Nazanin arrived after the mid-page reload');
      ok(afterReload.pinned && Math.abs(afterReload.drift) <= 2,
        `#s23 pin exact after a mid-page reload with a late font swap (drift ${afterReload.drift}px, ${afterReload.refreshes} refreshes, ${afterReload.repairs} repairs)`);
      ok(afterReload.corrupted === 0, `no ScrollTrigger refresh measured the pin at a stale offset after the reload (${afterReload.corrupted}/${afterReload.refreshes})`);
      ok(afterReload.centre === 's26' || afterReload.centre === 's25' || afterReload.centre === 's27',
        `reload lands back on the slide the reader left (${afterReload.centre})`);

      /* ghost sweep: walk the page from slide 27 back up to slide 21 and
         down again — the stage may only be on screen around slide 23 */
      const ghosts = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const stage = document.querySelector('.zpd-stage');
        const near = new Set(['s22', 'ch3', 's23', 's24']);
        const centre = () => {
          for (const el of document.querySelectorAll('#hero, .chapter, .scene, #closing')) {
            const b = el.getBoundingClientRect();
            if (b.top <= innerHeight / 2 && b.bottom > innerHeight / 2) return el.id;
          }
          return null;
        };
        const spacer = document.querySelector('.pin-spacer');
        const from = Math.max(0, spacer.getBoundingClientRect().top + scrollY - 2400);
        const to = spacer.getBoundingClientRect().top + scrollY + 4200;
        let bad = 0, samples = 0;
        const detail = [];
        const step = async y => {
          window.scrollTo({ top: y, behavior: 'instant' });
          await sleep(20);
          /* sample after the next frame: ScrollTrigger seats the stage in
             its ticker, and a starved harness frame can run late */
          await new Promise(r => requestAnimationFrame(r));
          const r = stage.getBoundingClientRect();
          samples++;
          if (r.bottom > 0 && r.top < innerHeight && !near.has(centre())) {
            bad++;
            if (detail.length < 4) {
              const st = ScrollTrigger.getById('zpdPin');
              detail.push(`y=${Math.round(y)} centre=${centre()} stageTop=${Math.round(r.top)} ${getComputedStyle(stage).position} pin=${Math.round(st.start)}–${Math.round(st.end)} spacerTop=${Math.round(spacer.getBoundingClientRect().top + scrollY)}`);
            }
          }
        };
        for (let y = to; y >= from; y -= 120) await step(y);
        for (let y = from; y <= to; y += 120) await step(y);
        return { bad, samples, detail };
      });
      ok(ghosts.bad === 0, `no ghost slide 23 anywhere between slides 21 and 27 (${ghosts.samples} samples)${ghosts.bad ? ' — ' + ghosts.detail.join(' | ') : ''}`);

      /* injected layout shift above the stage (1,600px) must self-heal */
      const healed = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const before = window.__rail.zpd().start;
        document.getElementById('s12').style.marginBottom = '1600px';
        const t0 = performance.now();
        let z = window.__rail.zpd();
        while (performance.now() - t0 < 2500 && !(z.start === before + 1600 && Math.abs(z.drift) <= 2)) { await sleep(50); z = window.__rail.zpd(); }
        const result = { before, after: z.start, drift: z.drift, ms: Math.round(performance.now() - t0) };
        document.getElementById('s12').style.marginBottom = '';
        await sleep(600);
        result.restored = window.__rail.zpd().start === before && Math.abs(window.__rail.zpd().drift) <= 2;
        return result;
      });
      ok(healed.after === healed.before + 1600 && Math.abs(healed.drift) <= 2 && healed.restored,
        `#s23 pin re-measures itself after a 1,600px layout shift above it (${healed.before} -> ${healed.after} in ${healed.ms}ms, restored ${healed.restored})`);
      ok(errors.length === 0, `zero JS errors in the #s23 pin exactness QA: ${errors.join('; ')}`);
      await page.close();
    }

    /* 5C — a shared /#s26 link on a phone, first visit: the browser seats
       the fragment in the fallback face, B Nazanin lands later and
       shortens everything above by thousands of pixels; Chrome's scroll
       anchoring does not always compensate (it left the reader on slide
       28), so app.js re-seats the target once the fonts settle — but only
       on a fresh navigation and only if the reader has not scrolled. */
    {
      const errors = [];
      let delayFont = 0;
      const open = async (w, h, mobile) => {
        const page = await browser.newPage();
        page.on('pageerror', e => errors.push(e.message));
        await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
        await page.setCacheEnabled(false);
        await page.setRequestInterception(true);
        page.on('request', req => {
          if (delayFont && /BNazanin/.test(req.url())) setTimeout(() => req.continue().catch(() => {}), delayFont);
          else req.continue().catch(() => {});
        });
        return page;
      };
      const seat = (page, id) => page.evaluate((id) => {
        const el = document.getElementById(id);
        let centre = null;
        for (const s of document.querySelectorAll('#hero, .chapter, .scene, #closing')) {
          const b = s.getBoundingClientRect();
          if (b.top <= innerHeight / 2 && b.bottom > innerHeight / 2) { centre = s.id; break; }
        }
        return { top: Math.round(el.getBoundingClientRect().top), scrollY: Math.round(scrollY), centre,
          nav: performance.getEntriesByType('navigation')[0].type, fontLoaded: document.fonts.check('16px "B Nazanin"') };
      }, id);

      for (const [w, h, mobile, id] of [[390, 844, true, 's26'], [390, 844, true, 's29'], [1366, 660, false, 's10']]) {
        delayFont = 1200;
        const page = await open(w, h, mobile);
        await page.goto(`${base}#${id}`, { waitUntil: 'domcontentloaded' });
        const first = await seat(page, id);
        await page.evaluate(() => document.fonts.ready);
        await delay(900);
        const after = await seat(page, id);
        ok(first.top >= 60 && first.top <= 90 && after.fontLoaded,
          `${w}×${h} /#${id}: the browser seats the fragment first (top ${first.top}px) and the late B Nazanin arrives afterwards`);
        ok(after.top >= 60 && after.top <= 90 && after.centre === id,
          `${w}×${h} /#${id} stays seated through the font swap (top ${after.top}px, scrollY ${first.scrollY} -> ${after.scrollY}, centre ${after.centre})`);
        await page.close();
      }

      /* a reload carries the last rail hash but the browser restores the
         real position — the restored position must win */
      {
        delayFont = 0;
        const page = await open(390, 844, true);
        await page.goto(base, { waitUntil: 'networkidle0' });
        await page.evaluate(() => {
          history.replaceState(null, '', '#s26');
          const el = document.getElementById('s29');
          window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 74, behavior: 'instant' });
        });
        await delay(500);
        delayFont = 1200;
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.evaluate(() => document.fonts.ready);
        await delay(900);
        const r = await seat(page, 's29');
        ok(r.nav === 'reload' && r.centre === 's29' && r.top >= 60 && r.top <= 90,
          `a reload with a stale #s26 hash keeps the restored slide 29 (top ${r.top}px, navigation ${r.nav})`);
        await page.close();
      }

      /* the reader swipes before the font lands: never pulled back */
      {
        delayFont = 1500;
        const page = await open(390, 844, true);
        await page.goto(`${base}#s26`, { waitUntil: 'domcontentloaded' });
        await delay(250);
        await page.touchscreen.touchStart(200, 640);
        await page.touchscreen.touchMove(200, 340);
        await page.touchscreen.touchEnd();
        await delay(300);
        const moved = await page.evaluate(() => Math.round(scrollY));
        await page.evaluate(() => document.fonts.ready);
        await delay(900);
        const r = await seat(page, 's26');
        ok(r.fontLoaded && !(r.top >= 60 && r.top <= 90),
          `a reader who already swiped is not pulled back to the fragment when the font lands (scrollY ${moved} -> ${r.scrollY})`);
        await page.close();
      }
      ok(errors.length === 0, `zero JS errors in the deep-link seating QA: ${errors.join('; ')}`);
    }

    /* ======================================================================
       PART 6: Share section — closing card + lightbox, link + QR
       ====================================================================== */
    {
      const CANON = 'https://mmalborzi1384.github.io/Mathematics-For-All/';
      const ctx = browser.defaultBrowserContext();
      await ctx.overridePermissions(base, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
      const errors = [];
      const fresh = async (w, h, mobile, opts = {}) => {
        const page = await browser.newPage();
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
        await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: !!mobile, hasTouch: !!mobile });
        if (opts.init) await page.evaluateOnNewDocument(opts.init);
        if (opts.media) await page.emulateMediaFeatures(opts.media);
        await page.goto(base + (opts.hash || ''), { waitUntil: 'networkidle0' });
        await page.evaluate(() => document.fonts.ready);
        await delay(400);
        return page;
      };
      const state = page => page.evaluate(() => {
        const d = document.getElementById('shareView');
        const a = document.activeElement;
        return {
          open: d.open, isIn: d.classList.contains('is-in'),
          lock: document.documentElement.classList.contains('share-lock'),
          active: a ? (a.id || a.className || a.tagName) : '',
          y: Math.round(scrollY),
          nativeHidden: [...document.querySelectorAll('[data-share-native]')].map(b => b.hidden)
        };
      });
      const toCard = async page => {
        await page.evaluate(() => document.getElementById('share').scrollIntoView({ block: 'center', behavior: 'instant' }));
        await delay(1400);
      };
      /* the entrance / exit classes land on real frames: wait for the state
         rather than a fixed time, then assert it (the slow software
         compositor behind this harness can stretch a frame past 200ms) */
      const settled = async (page, want) => {
        try {
          await page.waitForFunction((want) => {
            const d = document.getElementById('shareView');
            const lock = document.documentElement.classList.contains('share-lock');
            if (want !== 'in') return !d.open && !lock && !d.classList.contains('is-in');
            /* "in" also means the card has finished its entrance transform, so
               a click / tap aimed at a control lands where the control is */
            const card = d.querySelector('.share-view-card');
            return d.open && d.classList.contains('is-in') && lock && getComputedStyle(card).transform === 'none';
          }, { timeout: 2500, polling: 40 }, want);
        } catch (e) { /* the assertion that follows reports the real state */ }
      };

      /* 6A — structure: one address everywhere, the QR in the card and the
         lightbox, the download link, the labelled dialog */
      {
        const page = await fresh(1366, 768, false);
        const st = await page.evaluate(() => {
          const txt = el => el.textContent.replace(/\s+/g, '');
          const d = document.getElementById('shareView');
          const card = document.getElementById('share');
          const dl = card.querySelector('a[download]');
          return {
            url: window.__share && window.__share.url,
            urls: [...document.querySelectorAll('.share-url')].map(txt),
            imgs: [...document.querySelectorAll('.share-qr img, .share-view-qr')].map(i => ({ ok: i.complete && i.naturalWidth === 500 && i.naturalHeight === 500, alt: i.alt, src: i.getAttribute('src') })),
            openers: [...document.querySelectorAll('[data-share-open]')].map(b => b.id || b.className),
            dialogLabel: d.getAttribute('aria-labelledby') && !!document.getElementById(d.getAttribute('aria-labelledby')),
            cardLabel: card.getAttribute('aria-labelledby') === 'shareTitle' && !!document.getElementById('shareTitle'),
            status: [...document.querySelectorAll('.share-status')].every(p => p.getAttribute('role') === 'status'),
            dl: dl && { href: dl.getAttribute('href'), name: dl.getAttribute('download') },
            tile: card.querySelector('.share-qr').getAttribute('aria-controls') === 'shareView',
            order: (() => { const kids = [...card.parentElement.children].map(k => k.className.split(' ')[0]); return kids.join('>'); })()
          };
        });
        ok(st.url === CANON, `share url comes from the canonical link (${st.url})`);
        ok(st.urls.length === 2 && st.urls.every(u => u === 'mmalborzi1384.github.io/Mathematics-For-All'), 'the address is printed identically in the card and the lightbox');
        ok(st.imgs.length === 2 && st.imgs.every(i => i.ok && i.alt && i.src === 'assets/qr-mathematics-for-all.png'), 'both QR images decode at 500×500 from the committed PNG with alt text');
        ok(st.openers.length === 3 && st.openers.includes('tbShare'), `three openers: top bar, hero pill, card tile (${st.openers.join(', ')})`);
        ok(st.dialogLabel && st.cardLabel && st.status && st.tile, 'dialog and card are labelled, status lines are live regions, the tile controls the dialog');
        ok(st.dl && st.dl.href === 'assets/qr-mathematics-for-all.png' && st.dl.name === 'Mathematics-For-All-QR.png', 'the QR download link points at the PNG with a friendly file name');
        ok(/thanks-card>presenters>btn-pdf>share-card>colophon$/.test(st.order), `the share card sits between the PDF pill and the colophon (${st.order})`);
        const head = await page.evaluate(async (h) => { const r = await fetch(h, { method: 'HEAD' }); return { status: r.status, type: r.headers.get('content-type') || '' }; }, 'assets/qr-mathematics-for-all.png');
        ok(head.status === 200 && /image\/png/.test(head.type), 'the QR PNG is served (200 image/png)');
        await page.close();
      }

      /* 6B — desktop interaction: openers, exits, lock, focus, Tab, arrows */
      {
        const page = await fresh(1366, 768, false);
        let s = await state(page);
        ok(!s.open && !s.lock && !s.isIn, 'lightbox starts closed and unlocked');
        await page.click('#hero .btn-share'); await settled(page, 'in');
        s = await state(page);
        ok(s.open && s.isIn && s.lock && s.y === 0, 'hero pill opens the lightbox (open + is-in + share-lock) without a scroll jump');
        ok(s.active === 'share-view-card', `focus moves into the card (${s.active})`);
        await page.keyboard.press('Escape'); await delay(80);
        s = await state(page);
        ok(s.open && !s.isIn, 'Esc plays the exit transition first (still open, is-in dropped)');
        await settled(page, 'out');
        s = await state(page);
        ok(!s.open && !s.lock && !s.isIn, 'closed, unlocked and clean after the exit');
        ok(/btn-share/.test(s.active), `focus returns to the hero opener (${s.active})`);
        await page.click('#hero .btn-share'); await settled(page, 'in');
        await page.keyboard.press('Escape'); await delay(30); await page.keyboard.press('Escape'); await delay(40);
        s = await state(page);
        ok(!s.open && !s.lock && !s.isIn, 'a second Esc during the exit closes at once and cleans up synchronously');
        await page.click('#tbShare'); await settled(page, 'in');
        s = await state(page);
        ok(s.open && s.isIn, 'top-bar pill opens the lightbox');
        await page.mouse.click(30, 400); await settled(page, 'out');
        s = await state(page);
        ok(!s.open && !s.lock && s.active === 'tbShare', `backdrop click closes and focus returns to the top-bar pill (${s.active})`);
        await page.click('#tbShare'); await settled(page, 'in');
        await page.click('#shareView [data-share-close]'); await settled(page, 'out');
        ok(!(await state(page)).open, 'the close button closes');
        await page.evaluate(() => scrollTo(0, 0));
        await page.click('#hero .btn-share'); await settled(page, 'in');
        await page.keyboard.press('ArrowDown'); await page.keyboard.press('PageDown'); await page.keyboard.press('ArrowRight'); await delay(700);
        s = await state(page);
        ok(s.open && s.y === 0, 'arrow / page keys do not drive the deck while the lightbox is open');
        const trail = [];
        for (let i = 0; i < 8; i++) {
          await page.keyboard.press('Tab');
          trail.push(await page.evaluate(() => { const a = document.activeElement; return a.closest('#shareView') ? (a.className.split(' ')[0] + (a.hasAttribute('data-share-copy') ? '.copy' : a.hasAttribute('download') ? '.dl' : '')) : 'OUT'; }));
        }
        const nCtl = await page.evaluate(() => [...document.querySelectorAll('#shareView a[href], #shareView button')].filter(el => !el.hidden).length);
        ok(trail.every(t => t !== 'OUT') && trail[0] === 'share-view-close' && trail[nCtl] === 'share-view-close', `Tab cycles through the card's ${nCtl} controls and never leaves it (${trail.join(' → ')})`);
        await page.evaluate(() => document.querySelector('#shareView .share-view-close').focus());
        await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
        const back = await page.evaluate(() => document.activeElement.hasAttribute('download'));
        ok(back, 'Shift+Tab from the close button wraps to the last control');
        const hiddenShown = await page.evaluate(() => [...document.querySelectorAll('#shareView [hidden], #share [hidden]')].filter(el => getComputedStyle(el).display !== 'none').length);
        ok(hiddenShown === 0, '[hidden] share controls are really display:none (not overridden by .share-btn)');
        await page.keyboard.press('Escape'); await settled(page, 'out');

        /* copy from the card, then from the lightbox */
        await toCard(page);
        await page.click('#share [data-share-copy]'); await delay(250);
        const c1 = await page.evaluate(async () => ({
          clip: await navigator.clipboard.readText(),
          label: document.querySelector('#share [data-share-copy] .share-btn-tx').textContent,
          done: document.querySelector('#share [data-share-copy]').classList.contains('is-done'),
          status: document.querySelector('#share .share-status').textContent
        }));
        ok(c1.clip === CANON, `copy puts the canonical address on the clipboard (${c1.clip})`);
        ok(c1.label === 'کپی شد' && c1.done && c1.status === 'پیوند ارائه کپی شد.', 'the button flashes «کپی شد» and the live status announces the copy');
        await delay(2500);
        const c1b = await page.evaluate(() => ({ label: document.querySelector('#share [data-share-copy] .share-btn-tx').textContent, done: document.querySelector('#share [data-share-copy]').classList.contains('is-done') }));
        ok(c1b.label === 'کپی پیوند' && !c1b.done, 'the copy button restores its label after the flash');
        await delay(1200);
        ok((await page.evaluate(() => document.querySelector('#share .share-status').textContent)) === '', 'the status line clears itself');
        await page.click('#share .share-qr'); await settled(page, 'in');
        s = await state(page);
        const yBefore = s.y;
        ok(s.open && s.isIn, 'the card\'s QR tile opens the lightbox');
        await page.evaluate(() => navigator.clipboard.writeText('x'));
        await page.click('#shareView [data-share-copy]'); await delay(250);
        const c2 = await page.evaluate(async () => ({ clip: await navigator.clipboard.readText(), status: document.querySelector('#shareView .share-status').textContent }));
        ok(c2.clip === CANON && c2.status === 'پیوند ارائه کپی شد.', 'copy works inside the lightbox too');
        await page.keyboard.press('Escape'); await settled(page, 'out');
        s = await state(page);
        ok(!s.open && s.y === yBefore && /share-qr/.test(s.active), `closing returns to the same scroll position and the tile (${s.y} vs ${yBefore}, ${s.active})`);
        ok((await page.evaluate(() => document.querySelector('#shareView .share-status').textContent)) === '', 'the lightbox status is reset on close');
        await page.close();
      }

      /* 6C — clipboard fallback and the native share sheet */
      {
        let page = await fresh(1366, 768, false, { init: () => { Object.defineProperty(navigator, 'clipboard', { get: () => undefined }); } });
        await toCard(page);
        await page.click('#share [data-share-copy]'); await delay(200);
        const fb = await page.evaluate(() => ({ label: document.querySelector('#share [data-share-copy] .share-btn-tx').textContent, status: document.querySelector('#share .share-status').textContent, leftovers: document.querySelectorAll('body > textarea').length }));
        ok(fb.label === 'کپی شد' && fb.status === 'پیوند ارائه کپی شد.' && fb.leftovers === 0, 'without the async clipboard the execCommand fallback copies and leaves no textarea behind');
        await page.close();

        page = await fresh(1366, 768, false, { init: () => { Object.defineProperty(navigator, 'share', { get: () => undefined }); Object.defineProperty(navigator, 'canShare', { get: () => undefined }); } });
        ok((await state(page)).nativeHidden.every(Boolean), 'the native-share pill is hidden where navigator.share is missing');
        await page.close();

        page = await fresh(1366, 768, false, { init: () => { window.__shared = []; Object.defineProperty(navigator, 'share', { get: () => d => { window.__shared.push(d); return Promise.resolve(); } }); Object.defineProperty(navigator, 'canShare', { get: () => () => true }); } });
        ok((await state(page)).nativeHidden.every(h => !h), 'the native-share pill shows where navigator.share exists');
        await toCard(page);
        await page.click('#share [data-share-native]'); await delay(200);
        const sh = await page.evaluate(() => ({ calls: window.__shared, status: document.querySelector('#share .share-status').textContent }));
        ok(sh.calls.length === 1 && sh.calls[0].url === CANON && sh.calls[0].title && sh.calls[0].text && sh.status === 'سپاس! ارائه به اشتراک گذاشته شد.', 'the sheet receives title / text / canonical url and the status thanks the reader');
        await page.close();

        page = await fresh(1366, 768, false, { init: () => { let n = 0; Object.defineProperty(navigator, 'share', { get: () => () => { n++; return Promise.reject(new DOMException('x', n === 1 ? 'AbortError' : 'NotAllowedError')); } }); Object.defineProperty(navigator, 'canShare', { get: () => () => true }); } });
        await toCard(page);
        await page.click('#share [data-share-native]'); await delay(200);
        ok((await page.evaluate(() => document.querySelector('#share .share-status').textContent)) === '', 'a dismissed sheet (AbortError) stays silent');
        await page.click('#share [data-share-native]'); await delay(250);
        const na = await page.evaluate(() => ({ status: document.querySelector('#share .share-status').textContent, label: document.querySelector('#share [data-share-native] .share-btn-tx').textContent }));
        ok(na.status === 'پیوند ارائه کپی شد.' && na.label === 'کپی شد', 'a refused sheet falls back to copying the address');
        await page.close();
      }

      /* 6D — reduced motion: instant in and out, lock still released */
      {
        const page = await fresh(1366, 768, false, { media: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await page.click('#hero .btn-share'); await delay(60);
        let s = await state(page);
        ok(s.open && s.isIn && s.lock, 'reduced motion: opens instantly');
        await page.keyboard.press('Escape'); await delay(60);
        s = await state(page);
        ok(!s.open && !s.lock, 'reduced motion: closes instantly and unlocks');
        await page.close();
      }

      /* 6E — phones: tap, fit, hidden top-bar pill, deep link, 320 */
      {
        let page = await fresh(390, 844, true);
        ok((await page.evaluate(() => getComputedStyle(document.getElementById('tbShare')).display)) === 'none', 'the top-bar share pill steps aside on phones (≤720px)');
        const heroRow = await page.evaluate(() => {
          const a = document.querySelector('#hero .btn-pdf').getBoundingClientRect(), b = document.querySelector('#hero .btn-share').getBoundingClientRect();
          return { sameRow: Math.abs(a.top - b.top) < 2, fit: a.left >= 0 && b.left >= 0 && a.right <= innerWidth && b.right <= innerWidth, h: Math.round(b.height) };
        });
        ok(heroRow.sameRow && heroRow.fit && heroRow.h >= 40, `hero PDF + share pills share one row at 390 (${heroRow.h}px tall)`);
        await page.tap('#hero .btn-share'); await settled(page, 'in');
        let s = await state(page);
        ok(s.open && s.isIn && s.lock, 'a tap opens the lightbox on a phone');
        const fit = await page.evaluate(() => { const c = document.querySelector('#shareView .share-view-card').getBoundingClientRect(); const card = document.querySelector('#shareView .share-view-card'); return { inside: c.left >= 0 && c.right <= innerWidth && c.top >= 0 && c.bottom <= innerHeight, scrolls: card.scrollHeight > card.clientHeight + 1, qr: Math.round(document.querySelector('.share-view-qr').getBoundingClientRect().width) }; });
        ok(fit.inside && !fit.scrolls && fit.qr >= 200, `the lightbox fits a 390×844 phone without inner scrolling (QR ${fit.qr}px)`);
        await page.tap('#shareView [data-share-close]'); await settled(page, 'out');
        ok(!(await state(page)).open, 'a tap on the close button closes');
        await page.close();

        for (const vp of [{ w: 1366, h: 660 }, { w: 1280, h: 620 }, { w: 844, h: 390, mobile: true }]) {
          page = await fresh(vp.w, vp.h, !!vp.mobile);
          await page.click('#hero .btn-share'); await settled(page, 'in');
          const f = await page.evaluate(() => { const card = document.querySelector('#shareView .share-view-card'); const c = card.getBoundingClientRect(); return { inside: c.top >= 0 && c.bottom <= innerHeight, scrolls: card.scrollHeight > card.clientHeight + 1, qr: Math.round(document.querySelector('.share-view-qr').getBoundingClientRect().width) }; });
          ok(f.inside && !f.scrolls && f.qr >= 160, `the lightbox fits ${vp.w}×${vp.h} without inner scrolling (QR ${f.qr}px)`);
          await page.close();
        }

        /* the top bar: icon-only share pill on tablets, text from 901px, and
           the brand never squeezed to an ellipsis where the pill shows */
        page = await fresh(1366, 800, false);
        const bar = [];
        for (const w of [600, 667, 720, 721, 768, 834, 900, 901, 1024, 1366]) {
          await page.setViewport({ width: w, height: 800, deviceScaleFactor: 1 });
          await delay(150);
          bar.push(await page.evaluate((w) => {
            const t = document.querySelector('.topbar .tb-title'); const tr = t.getBoundingClientRect();
            const pill = document.getElementById('tbShare');
            const kids = [...document.querySelectorAll('.topbar .tb-actions > *')].filter(k => getComputedStyle(k).display !== 'none').map(k => k.getBoundingClientRect());
            return { w, titleFull: tr.width > 0 && t.scrollWidth <= t.clientWidth + 0.5, pill: getComputedStyle(pill).display !== 'none', tx: getComputedStyle(pill.querySelector('.tb-share-tx')).display !== 'none', inside: kids.every(r => r.left >= 0 && r.right <= w), oneRow: (() => { const c = kids.map(r => r.top + r.height / 2); return Math.max(...c) - Math.min(...c) <= 2; })() };
          }, w));
        }
        ok(bar.every(b => b.titleFull && b.inside && b.oneRow), `the brand stays whole and the controls stay on one row from 600px up (${bar.filter(b => !b.titleFull).map(b => b.w).join(',') || 'all'})`);
        ok(bar.every(b => (b.w <= 720 ? !b.pill : b.pill) && (b.w > 900 ? b.tx : !b.tx)), 'the top-bar share pill: hidden ≤720, icon-only 721–900, with its label from 901px');
        await page.close();

        page = await fresh(390, 844, true, { hash: '#share' });
        await delay(1200);
        const dlp = await page.evaluate(() => { const r = document.getElementById('share').getBoundingClientRect(); return { top: Math.round(r.top), vis: r.top < innerHeight && r.bottom > 0 }; });
        ok(dlp.vis && dlp.top >= 40, `/#share lands on the card below the top bar (top ${dlp.top}px)`);
        await page.close();

        page = await fresh(320, 640, true);
        const over = await page.evaluate(() => {
          document.getElementById('share').scrollIntoView({ block: 'center', behavior: 'instant' });
          const out = [];
          document.querySelectorAll('#share, #share *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && (r.left < -0.5 || r.right > innerWidth + 0.5)) out.push(el.className || el.tagName); });
          const url = document.querySelector('#share .share-url').getBoundingClientRect();
          return { out, docW: document.documentElement.scrollWidth, iw: innerWidth, urlLines: Math.round(url.height / parseFloat(getComputedStyle(document.querySelector('#share .share-url')).lineHeight)) };
        });
        ok(over.out.length === 0 && over.docW <= over.iw, `the share card never overflows a 320px phone (${over.out.join(', ') || 'clean'})`);
        ok(over.urlLines <= 2, `the address wraps at the slash, at most two lines at 320 (${over.urlLines})`);
        await page.close();
      }

      /* 6F — print keeps the scannable card; no-JS keeps link + QR + download */
      {
        let page = await fresh(1366, 768, false);
        await page.emulateMediaType('print');
        const pr = await page.evaluate(() => { const d = s => getComputedStyle(document.querySelector(s)).display; return { view: d('#shareView'), heroShare: d('#hero .btn-share'), actions: d('#share .share-actions'), hint: d('#share .share-qr-hint'), card: d('#share'), qr: d('#share .share-qr img'), url: d('#share .share-url') }; });
        ok(pr.view === 'none' && pr.heroShare === 'none' && pr.actions === 'none' && pr.hint === 'none' && pr.card !== 'none' && pr.qr !== 'none' && pr.url !== 'none', 'print keeps the card with the QR and address and drops the interactive controls');
        await page.close();

        page = await browser.newPage();
        await page.setJavaScriptEnabled(false);
        await page.setViewport({ width: 1366, height: 768 });
        await page.goto(base, { waitUntil: 'networkidle0' });
        await delay(300);
        const nj = await page.evaluate(() => { const d = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).display : 'missing'; }; return { js: document.documentElement.classList.contains('js'), tb: d('#tbShare'), heroShare: d('#hero .btn-share'), copy: d('#share [data-share-copy]'), native: d('#share [data-share-native]'), dl: d('#share a[download]'), tile: d('#share .share-qr'), hint: d('#share .share-qr-hint'), url: d('#share .share-url'), card: d('#share'), opacity: getComputedStyle(document.getElementById('share')).opacity }; });
        ok(!nj.js && nj.tb === 'none' && nj.heroShare === 'none' && nj.copy === 'none' && nj.native === 'none' && nj.hint === 'none' && nj.dl !== 'none' && nj.tile !== 'none' && nj.url !== 'none' && nj.card !== 'none' && nj.opacity === '1', 'without JavaScript the card, QR, address and download stay visible and script-only controls hide');
        await page.close();
      }
      ok(errors.length === 0, `zero JS / console errors across the share QA: ${errors.join('; ')}`);
    }

    console.log(`PASS ${checks} full-site audit assertions`);
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
