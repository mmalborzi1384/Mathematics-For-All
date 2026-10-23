/* Same external QA dependencies/environment as summary.cjs. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
 const browser = await puppeteer.launch({args: chromium.args, executablePath: process.env.CHROME_PATH || await chromium.executablePath(), headless: true});
 let count = 0;
 const ok = (condition, message) => { assert.ok(condition, message); count++; };
 try {
  for (const width of [390, 1440]) {
   const page = await browser.newPage();
   await page.setViewport({width, height: 900});
   await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8000', {waitUntil: 'networkidle0'});
   await page.$eval('[data-summary-open]', e => e.scrollIntoView({block: 'center', behavior: 'instant'}));
   if (process.env.SHOTS) await page.screenshot({path: `${process.env.SHOTS}/prelude-door-${width}.png`});
   await page.click('[data-summary-open]');
   await page.waitForFunction(() => document.querySelector('dialog').classList.contains('is-open') && document.querySelector('dialog').getAnimations().every(a => a.playState === 'finished'));
   const origin = await page.$eval('dialog', d => [parseFloat(d.style.getPropertyValue('--summary-ox')), parseFloat(d.style.getPropertyValue('--summary-oy'))]);
   ok(origin.every(Number.isFinite), 'origin from card');
   await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
   await delay(800);
   ok(await page.$eval('dialog', d => d.scrollWidth <= d.clientWidth), 'dark theme overflow');
   if (process.env.SHOTS) await page.screenshot({path: `${process.env.SHOTS}/prelude-dark-${width}.png`});
   await page.setViewport({width: width + 300, height: 1000});
   await delay(1000);
   ok(await page.$eval('dialog', d => {
    const x = parseFloat(d.style.getPropertyValue('--summary-ox')), y = parseFloat(d.style.getPropertyValue('--summary-oy'));
    return parseFloat(d.style.getPropertyValue('--summary-radius')) > Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
   }), 'resized wipe covers viewport');
   await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
   await page.emulateMediaType('print');
   await delay(100);
   ok(await page.$eval('dialog', d => getComputedStyle(d).position === 'static'), 'print normal flow');
   ok(await page.$$eval('.summary-card', cards => cards.every(c => getComputedStyle(c).opacity === '1')), 'all print cards visible');
   await page.emulateMediaType('screen');
   await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
   ok(await page.$eval('dialog', d => d.open), 'returns to dialog after printing');
   await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
   ok(await page.$$eval('.summary-card', cards => cards.every(c => getComputedStyle(c).opacity === '1')), 'reduced motion reveals all cards');
   ok(await page.$eval('.summary-art', e => getComputedStyle(e).animationName === 'none'), 'reduced motion stops book');
   await page.keyboard.press('Escape'); await delay(150);
   ok(await page.$eval('dialog', d => !d.open), 'reduced motion close');
   await page.close();
  }
  console.log(`PASS ${count} polish assertions`);
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
