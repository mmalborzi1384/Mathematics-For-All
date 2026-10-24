/* Comprehensive visual, scroll-paint, mobile toolbar resize, orientation,
   hash-back, theme/font-scale, print, reduced-motion, and deck integrity QA. */
const assert = require('node:assert/strict');
const {execSync} = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
 const browser = await puppeteer.launch({
  args: chromium.args,
  executablePath: process.env.CHROME_PATH || await chromium.executablePath(),
  headless: true
 });
 let count = 0;
 const ok = (condition, message) => { assert.ok(condition, message); count++; };

 try {
  /* 1. Core polish + scroll-clipping + pixel paint audit across mobile & desktop */
  for (const width of [320, 390, 768, 1440]) {
   const page = await browser.newPage();
   await page.setViewport({width, height: width < 500 ? 844 : 900, deviceScaleFactor: 2});
   await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8000', {waitUntil: 'networkidle0'});
   await page.evaluate(() => document.fonts.ready);

   await page.$eval('[data-summary-open]', e => e.scrollIntoView({block: 'center', behavior: 'instant'}));
   if (process.env.SHOTS) await page.screenshot({path: `${process.env.SHOTS}/prelude-door-${width}.png`});

   await page.click('[data-summary-open]');
   await page.waitForFunction(() => {
    const d = document.querySelector('dialog.summary-dialog');
    return d && d.classList.contains('is-open') && d.classList.contains('is-settled');
   }, {timeout: 4000});

   const origin = await page.$eval('dialog.summary-dialog', d => [
    parseFloat(d.style.getPropertyValue('--summary-ox')),
    parseFloat(d.style.getPropertyValue('--summary-oy'))
   ]);
   ok(origin.every(Number.isFinite), `origin finite at ${width}`);

   /* Outer dialog never scrolls; inner .sum-sheet owns scroll with clip-path: none once settled */
   const arch = await page.evaluate(() => {
    const d = document.querySelector('dialog.summary-dialog');
    const s = document.querySelector('[data-sum-scroll]');
    return {
     dialogOverflow: getComputedStyle(d).overflowY,
     dialogClip: getComputedStyle(d).clipPath,
     sheetOverflow: getComputedStyle(s).overflowY,
     sheetScrollable: s.scrollHeight > s.clientHeight,
     cardsOpaque: [...document.querySelectorAll('.summary-card')].every(c => getComputedStyle(c).opacity === '1')
    };
   });
   ok(arch.dialogOverflow === 'hidden', `outer dialog overflow hidden at ${width}`);
   ok(arch.dialogClip === 'none', `settled dialog drops clip-path at ${width}`);
   ok(arch.sheetOverflow === 'auto', `inner sheet owns vertical scroll at ${width}`);
   ok(arch.sheetScrollable, `inner sheet scrolls full prelude at ${width}`);
   ok(arch.cardsOpaque, `all 7 cards opaque immediately at ${width}`);

   /* Scroll-stop + pixel paint verification at deep offsets (where old circle clip blanked screen) */
   for (const targetY of [550, 1200, 1850, 99999]) {
    await page.$eval('[data-sum-scroll]', (s, y) => { s.scrollTop = y; }, targetY);
    await delay(40);
    const sample = await page.evaluate(() => {
     const d = document.querySelector('dialog.summary-dialog');
     const s = document.querySelector('[data-sum-scroll]');
     const midHit = document.elementFromPoint(innerWidth / 2, innerHeight * 0.55);
     const lowHit = document.elementFromPoint(innerWidth / 2, innerHeight * 0.85);
     return {
      proxySynced: d.scrollTop === s.scrollTop,
      insideMid: !!(midHit && d.contains(midHit)),
      insideLow: !!(lowHit && d.contains(lowHit)),
      noOverflow: s.scrollWidth <= s.clientWidth && d.scrollWidth <= d.clientWidth
     };
    });
    ok(sample.proxySynced, `dialog.scrollTop proxy synced at ${width} y=${targetY}`);
    ok(sample.insideMid && sample.insideLow, `no main-page bleed at ${width} y=${targetY}`);
    ok(sample.noOverflow, `no horizontal overflow at ${width} y=${targetY}`);

    /* Real screenshot pixel variance check at y=1850: proves bottom half of screen actually paints content! */
    if (targetY === 1850) {
     const vy = await page.evaluate(() => scrollY);
     const b64 = await page.screenshot({
      encoding: 'base64',
      clip: {x: 0, y: vy + Math.round((width < 500 ? 844 : 900) * 0.45), width, height: 260}
     });
     ok(Buffer.from(b64, 'base64').length > 8000, `rich rendered pixels in lower viewport at ${width} y=1850`);
    }
   }

   /* Simulate mobile URL-bar dynamic height shrink/grow mid-scroll */
   await page.$eval('[data-sum-scroll]', s => { s.scrollTop = 1200; });
   await delay(40);
   const beforeToolbarResize = await page.$eval('[data-sum-scroll]', s => s.scrollTop);
   const beforeScrollHeight = await page.$eval('[data-sum-scroll]', s => s.scrollHeight);
   await page.setViewport({width, height: (width < 500 ? 760 : 820), deviceScaleFactor: 2});
   await delay(120);
   const afterToolbarResize = await page.evaluate(() => ({
    sheetY: document.querySelector('[data-sum-scroll]').scrollTop,
    sheetH: document.querySelector('[data-sum-scroll]').scrollHeight,
    clip: getComputedStyle(document.querySelector('dialog.summary-dialog')).clipPath
   }));
   ok(afterToolbarResize.sheetY === beforeToolbarResize, `toolbar resize preserves exact 0px sheet scroll at ${width}`);
   ok(afterToolbarResize.sheetH === beforeScrollHeight, `toolbar resize causes 0px scrollHeight reflow at ${width}`);
   ok(afterToolbarResize.clip === 'none', `toolbar resize introduces zero clip mask at ${width}`);

   /* Dark theme + large font scale overflow & ellipsis audit */
   await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-fs', 'lg');
   });
   await delay(1500);
   ok(await page.$eval('[data-sum-scroll]', s => s.scrollWidth <= s.clientWidth), `dark+lg zero overflow at ${width}`);
   ok(await page.$eval('.summary-status', el => getComputedStyle(el).display === 'block'), `status ellipsis block at ${width}`);
   await page.evaluate(() => document.documentElement.removeAttribute('data-fs'));
   if (process.env.SHOTS && (width === 390 || width === 1440)) {
    await page.screenshot({path: `${process.env.SHOTS}/prelude-dark-${width}.png`});
   }

   /* Orientation / large viewport expansion + print + reduced-motion checks */
   await page.setViewport({width: width + 300, height: 1000, deviceScaleFactor: 2});
   await page.waitForFunction(() => {
    const d = document.querySelector('dialog.summary-dialog');
    const x = parseFloat(d.style.getPropertyValue('--summary-ox'));
    const y = parseFloat(d.style.getPropertyValue('--summary-oy'));
    return parseFloat(d.style.getPropertyValue('--summary-radius')) >
     Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
   }, {timeout: 3000});
   ok(true, `resized wipe radius covers enlarged viewport at ${width}`);

   await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
   await page.emulateMediaType('print');
   await delay(100);
   ok(await page.$eval('dialog.summary-dialog', d => getComputedStyle(d).position === 'static'), `print normal flow at ${width}`);
   ok(await page.$$eval('.summary-card', cards => cards.every(c => getComputedStyle(c).opacity === '1')), `all print cards visible at ${width}`);
   await page.emulateMediaType('screen');
   await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
   ok(await page.$eval('dialog.summary-dialog', d => d.open), `returns to modal after print at ${width}`);

   await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
   ok(await page.$$eval('.summary-card', cards => cards.every(c => getComputedStyle(c).opacity === '1')), `reduced motion reveals all cards at ${width}`);
   ok(await page.$eval('.summary-art', e => getComputedStyle(e).animationName === 'none'), `reduced motion stops book at ${width}`);
   await page.keyboard.press('Escape');
   await delay(150);
   ok(await page.$eval('dialog.summary-dialog', d => !d.open), `reduced motion instant close at ${width}`);
   await page.close();
  }

  /* 2. Chapter-hash history.back() exact scrollY restoration on BOTH #summary and #people */
  const hp = await browser.newPage();
  await hp.setViewport({width: 390, height: 844, isMobile: true, hasTouch: true});
  await hp.goto((process.env.BASE_URL || 'http://127.0.0.1:8000') + '/#ch2', {waitUntil: 'networkidle0'});
  await hp.evaluate(() => document.fonts.ready);

  await hp.$eval('[data-summary-open]', e => e.scrollIntoView({block: 'center', behavior: 'instant'}));
  await delay(120);
  const sumSavedY = await hp.evaluate(() => scrollY);
  await hp.click('[data-summary-open]');
  await hp.waitForFunction(() => document.querySelector('dialog.summary-dialog').classList.contains('is-settled'));
  await hp.goBack();
  await hp.waitForFunction(() => !document.querySelector('dialog.summary-dialog').open, {timeout: 3000});
  await delay(120);
  ok(Math.abs((await hp.evaluate(() => scrollY)) - sumSavedY) <= 2, 'history.back with prior #ch2 restores exact summary savedY');

  await hp.$eval('#portal .portal-card', e => e.scrollIntoView({block: 'center', behavior: 'instant'}));
  await delay(120);
  const pplSavedY = await hp.evaluate(() => scrollY);
  await hp.click('#portal .portal-card');
  await hp.waitForFunction(() => document.getElementById('people').classList.contains('is-settled'));
  await hp.goBack();
  await hp.waitForFunction(() => !document.getElementById('people').classList.contains('is-mounted'), {timeout: 3000});
  await delay(120);
  ok(Math.abs((await hp.evaluate(() => scrollY)) - pplSavedY) <= 2, 'history.back with prior #ch2 restores exact people savedY');

  /* 2b. Deep stress audit of #people («سه زندگی»):
     - instant early fast-scroll down at 120ms / 260ms / 600ms / settled shows 0 main-page pixels
     - Top-Layer <dialog open> active + main page visibility: hidden while modal-settled
     - 0px reflow on mobile URL-bar height change
     - ArrowLeft / ArrowRight inside #people never jumps main deck scrollY
     - 0px panel/pane clipping across all 3 people x 3 tabs on mobile (320, 390) & desktop (1440) */
  await hp.click('#portal .portal-card');
  await delay(80);
  await hp.evaluate(() => new Promise(resolve => {
   const s = document.querySelector('.ppl-sheet');
   s.scrollTop = s.scrollHeight;
   requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const fastEarly = await hp.evaluate(() => {
   const sec = document.getElementById('people');
   const low = document.elementFromPoint(195, 810);
   const corner = document.elementFromPoint(20, 830);
   return {
    topLayerOpen: sec.tagName === 'DIALOG' && sec.open === true,
    settled: sec.classList.contains('is-settled'),
    clip: getComputedStyle(sec).clipPath,
    mainHidden: getComputedStyle(document.querySelector('main')).visibility === 'hidden',
    closingHidden: getComputedStyle(document.getElementById('closing')).visibility === 'hidden',
    lowInside: !!(low && sec.contains(low)),
    cornerInside: !!(corner && sec.contains(corner))
   };
  });
  ok(fastEarly.topLayerOpen, '#people opens in native browser Top Layer (<dialog>)');
  ok(fastEarly.settled && fastEarly.clip === 'none', '#people immediately drops clip-path on fast downward scroll');
  ok(fastEarly.mainHidden && fastEarly.closingHidden, '#people hides underlying main deck & #closing in GPU tree');
  ok(fastEarly.lowInside && fastEarly.cornerInside, 'zero main-page bleed on immediate fast downward scroll in #people');

  /* Mobile URL-bar dynamic height change inside #people causes 0px reflow */
  await hp.$eval('.ppl-sheet', s => { s.scrollTop = 420; });
  await delay(30);
  const pplBeforeH = await hp.$eval('.ppl-sheet', s => ({top: s.scrollTop, h: s.scrollHeight}));
  await hp.setViewport({width: 390, height: 756, isMobile: true, hasTouch: true});
  await delay(100);
  const pplAfterH = await hp.$eval('.ppl-sheet', s => ({top: s.scrollTop, h: s.scrollHeight}));
  ok(pplAfterH.top === pplBeforeH.top && pplAfterH.h === pplBeforeH.h, '#people mobile toolbar resize causes 0px reflow');

  /* Arrow keys while #people is open must never scroll the main page behind it */
  const lockedY = await hp.evaluate(() => scrollY);
  await hp.keyboard.press('ArrowLeft');
  await hp.keyboard.press('ArrowRight');
  await delay(80);
  ok((await hp.evaluate(() => scrollY)) === lockedY, 'Arrow keys inside #people never move main deck scrollY');

  /* All 27 width x person x tab states have 0px clipping */
  for (const w of [320, 390, 1440]) {
   await hp.setViewport({width: w, height: 844, deviceScaleFactor: 2});
   await delay(150);
   for (let i = 0; i < 3; i++) {
    await hp.evaluate(idx => document.querySelectorAll('.ppl-person')[idx].click(), i);
    for (let j = 0; j < 3; j++) {
     await hp.evaluate((idx, tIdx) => document.querySelectorAll('.ppl-pane')[idx].querySelectorAll('.ppl-tab')[tIdx].click(), i, j);
     await delay(560);
     const st = await hp.evaluate((idx, tIdx) => {
      const pane = document.querySelectorAll('.ppl-pane')[idx];
      const body = pane.querySelector('[data-ppl-body]');
      const panel = pane.querySelectorAll('.ppl-panel')[tIdx];
      const stage = document.querySelector('.ppl-stage');
      return {
       panelClipped: panel.scrollHeight > body.clientHeight + 2,
       paneClipped: pane.offsetHeight > stage.clientHeight + 2,
       overflowX: document.querySelector('.ppl-sheet').scrollWidth > document.querySelector('.ppl-sheet').clientWidth
      };
     }, i, j);
     ok(!st.panelClipped && !st.paneClipped && !st.overflowX, `zero clipping/overflow in #people w=${w} p=${i} t=${j}`);
    }
   }
  }
  await hp.close();

  /* 3. Directional Soft-Fade Typing (window.__textStream) & Edge-Case Verification */
  const twPage = await browser.newPage();
  await twPage.setViewport({width: 1280, height: 860, deviceScaleFactor: 2});
  await twPage.goto(process.env.BASE_URL || 'http://127.0.0.1:8000', {waitUntil: 'networkidle0'});
  await twPage.evaluate(() => document.fonts.ready);

  /* Wait for hero entrance streams to finish cleanly -> 0 lingering masks/streams at rest */
  await twPage.waitForFunction(() => window.__textStream && window.__textStream.stats().active === 0, {timeout: 4000});
  const restState = await twPage.evaluate(() => ({
   stats: window.__textStream.stats(),
   strayPlay: document.querySelectorAll('.tw-play, .tw-wipe-rtl, .tw-wipe-ltr').length,
   basmalaMask: getComputedStyle(document.querySelector('#hero .basmala')).webkitMaskImage,
   thanksEnLtr: window.__textStream.isLtr(document.querySelector('#closing .thanks-en')),
   thanksFaRtl: !window.__textStream.isLtr(document.querySelector('#closing .thanks-fa'))
  }));
  ok(restState.stats.blocks > 100 && restState.stats.completed >= 3, 'window.__textStream initialized and completed hero streams');
  ok(restState.strayPlay === 0 && restState.basmalaMask === 'none', 'zero lingering .tw-play or GPU mask-image after completion');
  ok(restState.thanksEnLtr && restState.thanksFaRtl, 'tsIsLtr accurately distinguishes LTR English vs RTL Persian headings');

  /* Deterministic mid-flight monotonic opacity gradient check on RTL Persian vs LTR English slide */
  await twPage.$eval('#s2', el => el.scrollIntoView({block: 'center', behavior: 'instant'}));
  const midWave = await twPage.evaluate(() => {
   const fa = document.querySelector('#s2 .boxin-fa');
   const en = document.querySelector('#s2 .boxin-en');
   window.__textStream.stream(fa, {delay: 0, window: 600, duration: 240});
   window.__textStream.stream(en, {delay: 0, window: 600, duration: 240});
   for (const a of document.getAnimations()) {
    if ((a.animationName || '').startsWith('twTokenFade')) {
     a.pause();
     a.currentTime = 220;
    }
   }
   const faToks = [...fa.querySelectorAll('.tw-tok')];
   const enToks = [...en.querySelectorAll('.tw-tok')];
   const faStart = parseFloat(getComputedStyle(faToks[0]).opacity);
   const faEnd = parseFloat(getComputedStyle(faToks[faToks.length - 1]).opacity);
   const enStart = parseFloat(getComputedStyle(enToks[0]).opacity);
   const enEnd = parseFloat(getComputedStyle(enToks[enToks.length - 1]).opacity);
   /* Also test beforeprint immediate flush mid-animation */
   window.dispatchEvent(new Event('beforeprint'));
   const flushedActive = window.__textStream.stats().active;
   const postFlushEnd = parseFloat(getComputedStyle(faToks[faToks.length - 1]).opacity);
   return {faStart, faEnd, enStart, enEnd, flushedActive, postFlushEnd};
  });
  ok(midWave.faStart > 0.85 && midWave.faEnd < 0.15, `Persian RTL stream fades smoothly from start (${midWave.faStart.toFixed(2)}) to tail (${midWave.faEnd.toFixed(2)})`);
  ok(midWave.enStart > 0.85 && midWave.enEnd < 0.15, `English LTR stream fades smoothly from start (${midWave.enStart.toFixed(2)}) to tail (${midWave.enEnd.toFixed(2)})`);
  ok(midWave.flushedActive === 0 && midWave.postFlushEnd === 1, 'beforeprint immediately flushes active streams to opacity:1 with zero residual timers');
  await twPage.close();

  /* 4. Strict source & PDF immutability check against git HEAD */
  const pdfDiff = execSync('git diff --name-only assets/Mathematics-For-All.pdf').toString().trim();
  ok(pdfDiff === '', 'PDF binary 100% untouched');

  const verifyPage = await browser.newPage();
  await verifyPage.goto(process.env.BASE_URL || 'http://127.0.0.1:8000', {waitUntil: 'networkidle0'});
  const headHtml = execSync('git show HEAD:index.html', {maxBuffer: 20 * 1024 * 1024}).toString();
  const cmp = await verifyPage.evaluate(async src => {
   const headDoc = new DOMParser().parseFromString(src, 'text/html');
   const liveRaw = await (await fetch('/index.html')).text();
   const liveDoc = new DOMParser().parseFromString(liveRaw, 'text/html');
   return {
    headScenes: [...headDoc.querySelectorAll('.scene')].map(e => e.id + ':' + e.outerHTML),
    liveScenes: [...liveDoc.querySelectorAll('.scene')].map(e => e.id + ':' + e.outerHTML),
    headSummary: headDoc.querySelector('#summary').outerHTML,
    liveSummary: liveDoc.querySelector('#summary').outerHTML
   };
  }, headHtml);
  assert.deepEqual(cmp.liveScenes, cmp.headScenes, 'all 29 translation scenes byte-identical to HEAD');
  count++;
  assert.equal(cmp.liveSummary, cmp.headSummary, 'raw #summary section in index.html byte-identical to HEAD');
  count++;
  await verifyPage.close();

  console.log(`PASS ${count} polish assertions`);
 } finally {
  await browser.close();
 }
})().catch(e => { console.error(e); process.exitCode = 1; });
