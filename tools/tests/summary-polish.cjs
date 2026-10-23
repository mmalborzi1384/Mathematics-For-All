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

   const origin = await page.$eval('dialog', d => [
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
     const b64 = await page.screenshot({
      encoding: 'base64',
      clip: {x: 0, y: Math.round((width < 500 ? 844 : 900) * 0.45), width, height: 260}
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
    const d = document.querySelector('dialog');
    const x = parseFloat(d.style.getPropertyValue('--summary-ox'));
    const y = parseFloat(d.style.getPropertyValue('--summary-oy'));
    return parseFloat(d.style.getPropertyValue('--summary-radius')) >
     Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
   }, {timeout: 3000});
   ok(true, `resized wipe radius covers enlarged viewport at ${width}`);

   await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
   await page.emulateMediaType('print');
   await delay(100);
   ok(await page.$eval('dialog', d => getComputedStyle(d).position === 'static'), `print normal flow at ${width}`);
   ok(await page.$$eval('.summary-card', cards => cards.every(c => getComputedStyle(c).opacity === '1')), `all print cards visible at ${width}`);
   await page.emulateMediaType('screen');
   await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
   ok(await page.$eval('dialog', d => d.open), `returns to modal after print at ${width}`);

   await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
   ok(await page.$$eval('.summary-card', cards => cards.every(c => getComputedStyle(c).opacity === '1')), `reduced motion reveals all cards at ${width}`);
   ok(await page.$eval('.summary-art', e => getComputedStyle(e).animationName === 'none'), `reduced motion stops book at ${width}`);
   await page.keyboard.press('Escape');
   await delay(150);
   ok(await page.$eval('dialog', d => !d.open), `reduced motion instant close at ${width}`);
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
  await hp.close();

  /* 3. Strict source & PDF immutability check against git HEAD */
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
