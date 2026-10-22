const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const path = require("path");

(async () => {
  const b = await puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--font-render-hinting=none"],
    executablePath: await chromium.executablePath(),
    headless: "shell",
    protocolTimeout: 180000,
  });
  const p = await b.newPage();
  await p.goto("file://" + path.resolve(process.env.DECK || "/tmp/deck/deck.html"), { waitUntil: "networkidle0" });
  await p.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 400));

  // 1) auto-fit every card, then report
  const fit = await p.evaluate(() => window.__fit());
  console.log("pages fitted:", fit.length);
  const tooBig = [];
  for (const f of fit) for (const l of ["en", "fa"]) if (f[l].h > f.avail + 1) tooBig.push({ p: f.p, lang: l });
  for (const l of ["en", "fa"]) {
    const a = fit.map(f => f[l].size).sort((x, y) => x - y);
    const lead = fit.map(f => f[l].lead).sort((x, y) => x - y);
    const med = fit.map(f => f[l].med).sort((x, y) => x - y);
    const p90 = fit.map(f => f[l].p90).sort((x, y) => x - y);
    console.log(` ${l}: size ${a[0]}–${a[a.length - 1]} (median ${a[(a.length / 2) | 0]})` +
                ` | leading ${lead[0]}–${lead[lead.length - 1]}` +
                ` | gap median ${med[(med.length / 2) | 0]} worst p90 ${p90[p90.length - 1]}`);
  }
  console.log("overflowing cards:", JSON.stringify(tooBig));

  // 2) any element sticking out of its page?
  const bleed = await p.evaluate(() => {
    const bad = [];
    document.querySelectorAll(".pg").forEach(pg => {
      const pr = pg.getBoundingClientRect();
      pg.querySelectorAll(".card, .fn, .pill, .zbox, .tcard, .presenters, .hcard").forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.bottom > pr.bottom + 0.6 || r.top < pr.top - 0.6 || r.right > pr.right + 0.6 || r.left < pr.left - 0.6)
          bad.push({ p: pg.dataset.p, cls: el.className, top: Math.round(r.top - pr.top), bottom: Math.round(r.bottom - pr.top) });
      });
    });
    return bad;
  });
  console.log("bleeding elements:", JSON.stringify(bleed));

  // 3) print
  const out = process.argv[2] || "/tmp/deck/out.pdf";
  await p.pdf({ path: out, printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  // 4) screenshots for visual review
  const shots = process.env.SHOTS === "1";
  if (shots) {
    const pages = process.argv.slice(3).map(Number);
    for (const n of pages) {
      const el = await p.$(`.pg[data-p="${n}"]`);
      if (el) await el.screenshot({ path: `/tmp/deck/pv${String(n).padStart(2, "0")}.png` });
    }
  }
  console.log("wrote", out);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
