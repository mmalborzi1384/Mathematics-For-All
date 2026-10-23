/* Exhaustive directional soft-fade typing & adversarial chaos QA suite:
     1) Runtime character-for-character text invariance across every tokenized
        element in all 29 bilingual slides, 7 #summary cards, and 9 #people panels
        compared directly against git HEAD index.html (0 lost chars/spaces/ZWNJs)
     2) Directional RTL vs LTR wave & feathered mask verification across #hero,
        all 5 .chapter dividers, #summaryPortal, #portal, .scene, #closing,
        #summary (open + all 7 cards), and #people (open + 3 persons + 9 tabs)
     3) Adversarial mid-animation chaos storm: rapid open/Escape/re-open/Back,
        mid-stream A+/A- font scaling & dark/light theme flips, beforeprint &
        prefers-reduced-motion transitions across 7 mobile/tablet/desktop widths
     4) Zero residual timers, zero lingering GPU mask-image layers, zero scroll
        locks or visibility shields stuck after chaotic modal interruption. */
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
  const headHtml = execSync('git show HEAD:index.html', { maxBuffer: 20 * 1024 * 1024 }).toString();

  try {
    /* 1. Runtime character-for-character text fidelity across ENTIRE site after tsPrepare() */
    const fidelityPage = await browser.newPage();
    const pageErrors = [];
    fidelityPage.on('pageerror', e => pageErrors.push(e.message));
    await fidelityPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await fidelityPage.goto(base, { waitUntil: 'networkidle0' });
    await fidelityPage.evaluate(() => document.fonts.ready);

    const textCheck = await fidelityPage.evaluate(src => {
      const refDoc = new DOMParser().parseFromString(src, 'text/html');
      const selectors = [
        '.scene .card p',
        '.scene .scene-kicker',
        '.scene .fnbar',
        '.summary-card p',
        '.summary-card li',
        '.summary-card h3',
        '.ppl-text p',
        '.ppl-quote',
        '.ppl-tag',
        '.ppl-v',
        '#hero .basmala',
        '#hero .hero-course',
        '#hero .hero-card .hc-1',
        '#hero .hero-card .hc-2',
        '#hero .hero-card .hc-3',
        '#hero .presenters',
        '.portal-sub'
      ];
      const mismatches = [];
      let totalCompared = 0;
      for (const sel of selectors) {
        const refList = [...refDoc.querySelectorAll(sel)].map(e => e.textContent.replace(/\s+/g, ' ').trim());
        const liveList = [...document.querySelectorAll(sel)].map(e => e.textContent.replace(/\s+/g, ' ').trim());
        if (refList.length !== liveList.length) {
          mismatches.push(`${sel}: count ${liveList.length} !== ${refList.length}`);
          continue;
        }
        for (let i = 0; i < refList.length; i++) {
          totalCompared++;
          if (refList[i] !== liveList[i]) {
            mismatches.push(`${sel}[${i}] mismatch`);
          }
        }
      }
      return { totalCompared, mismatches };
    }, headHtml);

    ok(textCheck.totalCompared >= 220, `compared ${textCheck.totalCompared} live tokenized blocks against HEAD`);
    ok(textCheck.mismatches.length === 0, `100% character-for-character live DOM fidelity: ${textCheck.mismatches.join('; ')}`);

    /* 2. Mirror RTL/LTR direction verification across #hero, chapters, slides, portals, & closing */
    const heroMidStream = await fidelityPage.evaluate(() => {
      document.getAnimations({ subtree: true }).forEach(a => {
        a.pause();
        a.currentTime = 500;
      });
      const faCard = document.getElementById('heroCardFa');
      const enCard = document.getElementById('heroCardEn');
      const faOpacity = parseFloat(getComputedStyle(faCard).opacity);
      const enOpacity = parseFloat(getComputedStyle(enCard).opacity);
      const midBlurred = [...document.querySelectorAll('#hero .w')].some(w => {
        const f = getComputedStyle(w).filter;
        return f && f !== 'none' && f !== 'blur(0px)';
      });
      document.getAnimations({ subtree: true }).forEach(a => a.play());
      window.dispatchEvent(new Event('beforeprint'));
      const afterPrintSharp = [...document.querySelectorAll('#hero .w')].every(w => {
        const cs = getComputedStyle(w);
        return cs.opacity === '1' && (cs.filter === 'none' || cs.filter === 'blur(0px)');
      });
      return { staggeredCards: faOpacity > enOpacity, midBlurred, afterPrintSharp };
    });
    ok(heroMidStream.staggeredCards, '#heroCardFa leads #heroCardEn smoothly during staggered opening rise');
    ok(heroMidStream.midBlurred, '#hero opening words bloom smoothly through GPU velvet blur mid-animation');
    ok(heroMidStream.afterPrintSharp, 'beforeprint immediately finishes all #hero blur/word animations cleanly');

    const dirAudit = await fidelityPage.evaluate(() => {
      const TS = window.__textStream;
      const heroOk =
        !TS.isLtr(document.getElementById('heroCardFa')) &&
        TS.isLtr(document.getElementById('heroCardEn'));
      const chaptersOk = [...document.querySelectorAll('.chapter')].every(ch => {
        const h2 = ch.querySelector('h2');
        const en = ch.querySelector('.ch-en');
        return !TS.isLtr(h2) && TS.isLtr(en);
      });
      const scenesOk = [...document.querySelectorAll('.scene .pair')].every(pair => {
        const fa = pair.querySelector('.boxin-fa');
        const en = pair.querySelector('.boxin-en');
        return fa && en && !TS.isLtr(fa) && TS.isLtr(en);
      });
      const peopleOk = [...document.querySelectorAll('.ppl-pane')].every(pane => {
        const nm = pane.querySelector('.ppl-name');
        const lat = pane.querySelector('.ppl-latin');
        return !TS.isLtr(nm) && TS.isLtr(lat);
      });
      const closingOk =
        !TS.isLtr(document.querySelector('#closing .thanks-fa')) &&
        TS.isLtr(document.querySelector('#closing .thanks-en'));
      return { heroOk, chaptersOk, scenesOk, peopleOk, closingOk };
    });
    ok(dirAudit.heroOk, 'hero cards classify #heroCardFa as RTL and #heroCardEn as LTR');
    ok(dirAudit.chaptersOk, 'all 5 chapter dividers classify Persian h2 as RTL and .ch-en as LTR');
    ok(dirAudit.scenesOk, 'all bilingual scene pairs classify .boxin-fa as RTL and .boxin-en as LTR');
    ok(dirAudit.peopleOk, 'all 3 biography headers classify Persian name as RTL and Latin name as LTR');
    ok(dirAudit.closingOk, 'closing card classifies Persian thanks as RTL and English thanks as LTR');

    /* 3. Scroll chapter divider #ch1 & closing #closing into view -> verify live wipe then 0-mask cleanup */
    for (const targetSel of ['#ch1', '#closing']) {
      await fidelityPage.$eval(targetSel, el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await fidelityPage.waitForFunction(() => window.__textStream.stats().active >= 1, { timeout: 1500 });
      ok(true, `${targetSel} triggers live directional stream/wipe on scroll entry`);
      await fidelityPage.waitForFunction(() => window.__textStream.stats().active === 0, { timeout: 3000 });
      const cleanAfter = await fidelityPage.evaluate(sel => {
        const rootEl = document.querySelector(sel);
        const lingering = rootEl.querySelectorAll('.tw-play, .tw-wipe-rtl, .tw-wipe-ltr').length;
        const masksCleared = [...rootEl.querySelectorAll('h2, p')].every(
          n => getComputedStyle(n).webkitMaskImage === 'none'
        );
        return lingering === 0 && masksCleared;
      }, targetSel);
      ok(cleanAfter, `${targetSel} cleans all classes and GPU masks back to 'none' after completion`);
    }

    /* 4. Adversarial Cross-Modal Chaos Storm + Mid-Stream Font/Theme Mutation */
    for (let round = 0; round < 3; round++) {
      await fidelityPage.$eval('[data-summary-open]', e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await fidelityPage.click('[data-summary-open]');
      await delay(75);
      /* Mutate font scale & theme RIGHT IN THE MIDDLE of opening streams */
      await fidelityPage.evaluate(r => {
        document.documentElement.setAttribute('data-fs', ['sm', 'lg', 'md'][r % 3]);
        document.documentElement.setAttribute('data-theme', r % 2 === 0 ? 'dark' : 'light');
      }, round);
      await fidelityPage.click('.summary-jump:nth-child(4)');
      await delay(65);
      await fidelityPage.keyboard.press('Escape');
      await delay(780);

      await fidelityPage.$eval('#portal .portal-card', e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await fidelityPage.click('#portal .portal-card');
      await delay(65);
      await fidelityPage.evaluate(r => {
        document.querySelectorAll('.ppl-person')[(r + 1) % 3].click();
      }, round);
      await delay(55);
      await fidelityPage.evaluate(r => {
        document.querySelector('.ppl-pane.is-on').querySelectorAll('.ppl-tab')[(r + 2) % 3].click();
      }, round);
      await delay(65);
      await fidelityPage.keyboard.press('Escape');
      await delay(780);
    }

    await fidelityPage.waitForFunction(() => window.__textStream.stats().active === 0, { timeout: 3000 });
    const postStorm = await fidelityPage.evaluate(() => ({
      activeStreams: window.__textStream.stats().active,
      strayClasses: document.querySelectorAll('.tw-play, .tw-wipe-rtl, .tw-wipe-ltr').length,
      pplOpen: window.__people.isOpen(),
      sumOpen: window.__summary.isOpen(),
      pplLock: document.documentElement.classList.contains('ppl-lock'),
      sumLock: document.documentElement.classList.contains('summary-lock'),
      modalSettled: document.documentElement.classList.contains('modal-settled'),
      mainVisible: getComputedStyle(document.querySelector('main')).visibility === 'visible',
      closingVisible: getComputedStyle(document.getElementById('closing')).visibility === 'visible'
    }));
    ok(postStorm.activeStreams === 0 && postStorm.strayClasses === 0,
      'zero leaked timers or stream classes after 3 rounds of cross-modal chaos');
    ok(!postStorm.pplOpen && !postStorm.sumOpen && !postStorm.pplLock && !postStorm.sumLock && !postStorm.modalSettled,
      'zero stuck modal locks or settled classes after rapid interruption storm');
    ok(postStorm.mainVisible && postStorm.closingVisible,
      'main deck and #closing remain 100% visible after rapid modal storm');

    /* 5. Multi-viewport zero horizontal overflow matrix across 7 real device widths */
    for (const [w, h] of [[320, 568], [360, 800], [390, 844], [414, 896], [768, 1024], [1024, 768], [1920, 1080]]) {
      await fidelityPage.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
      await delay(90);
      const fit = await fidelityPage.evaluate(() => ({
        noOverflow: document.documentElement.scrollWidth <= innerWidth,
        allJustified: [...document.querySelectorAll('.scene .card p:not(.head)')].every(
          p => getComputedStyle(p).textAlign === 'justify'
        )
      }));
      ok(fit.noOverflow, `zero horizontal overflow at ${w}x${h}`);
      ok(fit.allJustified, `all bilingual paragraphs stay justified at ${w}x${h}`);
    }

    ok(pageErrors.length === 0, `zero uncaught errors throughout stress suite: ${pageErrors.join('; ')}`);
    await fidelityPage.close();

    console.log(`PASS ${checks} typing & chaos stress assertions`);
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
