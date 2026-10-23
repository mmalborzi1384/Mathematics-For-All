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
        font loading, zero HTTP/console errors, and source/PDF byte invariance. */
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
        cacheSynced: cacheTags.every(t => t && t.includes('?v=20261024a'))
      };
    });
    ok(deckAudit.exactOrder, 'all 29 scenes (#s2..#s30) present in exact PDF order');
    ok(deckAudit.allJustified, 'every slide translation & original paragraph remains text-align: justify');
    ok(deckAudit.pdfOk, 'assets/Mathematics-For-All.pdf serves 200 OK with exact 921,399 bytes');
    ok(deckAudit.zpdReady, 'Slide 23 (#s23) ZPD ScrollTrigger pin active and healthy');
    ok(deckAudit.cacheSynced, 'style.css, app.js, and summary.js share unified cache-buster ?v=20261024a');

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
    console.log(`PASS ${checks} full-site audit assertions`);
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
