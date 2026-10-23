/* Run with puppeteer-core@23 and Chromium 131 available on NODE_PATH.
   BASE_URL defaults to a local static server. No production dependencies. */
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const delay = ms => new Promise(r => setTimeout(r, ms));
(async () => {
 const browser = await puppeteer.launch({args: chromium.args, executablePath: process.env.CHROME_PATH || await chromium.executablePath(), headless: true});
 let checks=0;
 const ok=(x,msg)=>{assert.ok(x,msg);checks++};
 const base=process.env.BASE_URL || 'http://127.0.0.1:8000';
 try {
 for (const [width,height] of [[320,740],[390,844],[768,1024],[1440,900],[1920,1080]]) {
  const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width,height});await page.goto(base,{waitUntil:'networkidle0'});
  await page.evaluate(()=>document.fonts.ready);
  ok(await page.$$eval('.scene',a=>a.length===29),'29 scenes');
  ok(await page.$$eval('[id]',a=>new Set(a.map(e=>e.id)).size===a.length),'unique IDs');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow');
  await page.$eval('[data-summary-open]',e=>e.scrollIntoView({block:'center',behavior:'instant'}));await delay(150);
  const y=await page.evaluate(()=>scrollY);
  await page.click('[data-summary-open]');await delay(800);
  ok(await page.$eval('.summary-dialog',e=>e.open),'open');
  ok(await page.$$eval('.summary-card',a=>a.length===7),'seven summary sections');
  ok(await page.$eval('.summary-dialog',e=>e.scrollWidth<=e.clientWidth),'dialog overflow');
  ok(await page.evaluate(()=>document.querySelector('.summary-dialog').contains(document.activeElement)),'focus inside');
  const modalY=await page.evaluate(()=>scrollY); await page.keyboard.press('ArrowLeft');ok(await page.evaluate(y=>scrollY===y,modalY),'keyboard does not navigate deck');
  for(let i=0;i<8;i++) await page.keyboard.press('Tab');
  ok(await page.evaluate(()=>document.querySelector('.summary-dialog').contains(document.activeElement)),'focus trapped');
  await page.$eval('.summary-dialog',e=>e.scrollTop=e.scrollHeight);
  ok(await page.$eval('.summary-finish',e=>e.getBoundingClientRect().bottom<=innerHeight+1),'end reachable');
  if(process.env.SHOTS){await page.$eval('.summary-dialog',e=>e.scrollTop=0);await page.screenshot({path:`${process.env.SHOTS}/summary-${width}.png`});}
  await page.keyboard.press('Escape');await delay(850);
  ok(await page.evaluate(()=>!document.querySelector('.summary-dialog').open),'escape closes');
  ok(await page.evaluate(y=>Math.abs(scrollY-y)<2,y),'scroll restored');
  ok(await page.evaluate(()=>document.activeElement.hasAttribute('data-summary-open')),'focus restored');
  await page.click('[data-summary-open]');await delay(750);await page.goBack();await delay(850);
  ok(await page.$eval('.summary-dialog',e=>!e.open),'browser back closes');
  await page.goto(base+'/#summary',{waitUntil:'networkidle0'});await delay(800);
  ok(await page.$eval('.summary-dialog',e=>e.open),'deep link');
  await page.click('.summary-bar button');await delay(800);
  ok(await page.evaluate(()=>location.hash!=='#summary'),'direct-link close');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.click('[data-summary-open]');await delay(80);await page.keyboard.press('Escape');await delay(80);
  ok(await page.$eval('.summary-dialog',e=>!e.open),'reduced motion');
  await page.$eval('[data-ppl-open]',e=>e.scrollIntoView({behavior:'instant',block:'center'}));await page.click('[data-ppl-open]');await delay(1400);
  ok(await page.evaluate(()=>window.__people.isOpen()),'biography opens');
  await page.keyboard.press('Escape');await delay(1000);
  ok(await page.evaluate(()=>!window.__people.isOpen()),'biography closes');
  ok(errors.length===0,errors.join('\n'));await page.close();
 }
 const page=await browser.newPage();await page.setJavaScriptEnabled(false);await page.goto(base);
 ok(await page.$eval('#summary',e=>e.getBoundingClientRect().height>1000),'no JS summary readable');
 console.log(`PASS ${checks} assertions`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
