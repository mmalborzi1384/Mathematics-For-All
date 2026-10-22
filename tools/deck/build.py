#!/usr/bin/env python3
"""Build a clean 31-page 16:9 deck (HTML) for Mathematics-For-All.pdf.

Content is taken from the verified site (index.html) so the PDF and the
site can never drift apart.  Geometry here is deliberately *not* fixed:
each card is only as tall as its text, so the printed boxes no longer
contain a third of a page of empty space.
"""
import re, json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTDIR = os.environ.get("DECK_OUT", "/tmp/deck")
SRC = os.path.join(ROOT, "index.html")

s = open(SRC, encoding="utf-8").read()


def block(section, marker, tag="article"):
    i = section.find(marker)
    if i < 0:
        return None
    j = section.find(">", i) + 1
    open_re = re.compile(r"<%s\b" % tag)
    close_re = re.compile(r"</%s>" % tag)
    depth, k = 1, j
    while depth:
        mo = open_re.search(section, k)
        mc = close_re.search(section, k)
        if mc is None:
            return None
        if mo and mo.start() < mc.start():
            depth += 1
            k = mo.end()
        else:
            depth -= 1
            k = mc.end()
            if depth == 0:
                return section[j:mc.start()]
    return None


def tidy(frag):
    if not frag:
        return ""
    return re.sub(r"\s+", " ", frag).strip()


scenes = []
for sc in re.split(r'(?=<section class="scene)', s):
    m = re.search(r'id="(s\d+)" data-chapter="(\w+)"', sc)
    if not m or 'scene-zpd' in sc[:80]:
        continue
    scenes.append({
        "id": m.group(1),
        "n": int(m.group(1)[1:]),
        "chapter": m.group(2),
        "fa": tidy(block(sc, '<article class="card boxin boxin-fa"')),
        "en": tidy(block(sc, '<article class="card boxin boxin-en"')),
        "fn": tidy(block(sc, '<div class="fnbar', "div")),
    })


def grab(pattern, text=s):
    m = re.search(pattern, text, re.S)
    return tidy(m.group(1)) if m else ""


cover = {
    "basmala": grab(r'<div class="basmala">(.*?)</div>'),
    "fa_h1": grab(r'<div class="hero-card fa".*?<h1 class="hc-1">(.*?)</h1>'),
    "fa_h2": grab(r'<div class="hero-card fa".*?<p class="hc-2">(.*?)</p>'),
    "fa_h3": grab(r'<div class="hero-card fa".*?<p class="hc-3">(.*?)</p>'),
    "en_h1": grab(r'<div class="hero-card en".*?<p class="hc-1">(.*?)</p>'),
    "en_h2": grab(r'<div class="hero-card en".*?<p class="hc-2">(.*?)</p>'),
    "en_h3": grab(r'<div class="hero-card en".*?<p class="hc-3">(.*?)</p>'),
    "presenters": grab(r'<div class="presenters">(.*?)</div>'),
    "thanks_fa": grab(r'<div class="thanks-fa">(.*?)</div>'),
    "thanks_en": grab(r'<div class="thanks-en"[^>]*>(.*?)</div>'),
}

# footnotes: a Persian span inside an LTR bar needs its own direction,
# otherwise the closing ")" jumps to the wrong end (a real defect in the
# old PDF: "... (آموزش بانتو؛ نظام آموزشی دوره‌ی آپارتاید" )
def fix_fn(frag):
    if not frag:
        return ""
    frag = frag.replace('<span class="fn-fa" lang="fa">',
                        '<span class="fn-fa" lang="fa" dir="rtl">')
    return frag


CSS = r"""
@font-face { font-family: "Tinos"; src: url("Tinos-Regular.ttf") format("truetype");
             font-weight: 400; font-display: block; }
@font-face { font-family: "Tinos"; src: url("Tinos-Bold.ttf") format("truetype");
             font-weight: 700; font-display: block; }
@font-face { font-family: "BNazanin"; src: url("BNazanin.ttf") format("truetype");
             font-weight: 400; font-display: block; }
@font-face { font-family: "BNazanin"; src: url("BNazaninBold.ttf") format("truetype");
             font-weight: 700; font-display: block; }

:root{
  --ink:#374151; --ivory:#F7F5EF; --beige:#D8CBB8; --sage:#667C67;
  --sage-strong:#4F6552; --card:#FDFBF5;
  --hl-sage:#667C67; --hl-olive:#75843A; --hl-gold:#9C7C1E;
  --hl-tan:#9A7B4F; --hl-rust:#A85B2A; --hl-plum:#8E4A5B; --hl-brown:#7A5C3E;
}
*{ box-sizing:border-box; margin:0; padding:0; }
html,body{ background:#fff; }
body{ -webkit-print-color-adjust:exact; print-color-adjust:exact;
      font-family:"Tinos", "Times New Roman", Times, serif; color:var(--ink); }

@page{ size:960pt 540pt; margin:0; }

.pg{
  position:relative; width:960px; height:540px; overflow:hidden;
  /* design units are PDF points: 960pt / 0.75 = 1280px, so scale by
     4/3 and Chrome emits a 960x540pt page with 1 unit == 1pt */
  transform:scale(1.3333333); transform-origin:top left;
  background:var(--ivory); padding:16px 28px 0;
  display:flex; flex-direction:column; break-after:page; page-break-after:always;
}
.pg:last-child{ break-after:auto; page-break-after:auto; }

/* ---- header pills */
.hd{ display:flex; gap:16px; flex:0 0 auto; }
.pill{
  flex:1 1 0; min-width:0; height:34px; border-radius:99px;
  background:var(--sage); color:var(--ivory);
  display:flex; align-items:center; font-weight:700;
  padding:0 22px; overflow:hidden; white-space:nowrap;
}
.pill.en{ font-size:15px; letter-spacing:.2px; }
.pill.fa{ font-family:"BNazanin", Tahoma, sans-serif; font-size:17px;
          justify-content:flex-end; }

/* ---- the two text columns; flex:1 keeps every page's grid identical */
.cols{ flex:1 1 auto; display:flex; gap:16px; align-items:center; min-height:0; }
.cell{ flex:1 1 0; min-width:0; display:flex; }

.card{
  flex:1 1 auto; min-width:0;
  background:var(--card); border:2.4px solid var(--beige); border-radius:15px;
  padding:14px 16px; font-size:var(--fs, 15px);
}
.card p{ text-align:justify; text-justify:inter-word; margin:0 0 .5em; }
.pg.ragged .card p{ text-align:start; }
.card p:last-child{ margin-bottom:0; }
.card.en{ direction:ltr; line-height:1.16; hyphens:auto; }
.card.fa{ direction:rtl; line-height:1.58; font-family:"BNazanin", Tahoma, sans-serif; }
.card .head{ font-weight:700; color:var(--sage); font-size:1.16em; margin-bottom:.5em;
             line-height:1.35; }
.card.fa .head{ font-size:1.14em; }

.zsup{ font-size:.6em; line-height:0; vertical-align:.5em; }
sup{ font-size:.58em; line-height:0; vertical-align:.5em; }

.hl-sage{color:var(--hl-sage)} .hl-olive{color:var(--hl-olive)}
.hl-gold{color:var(--hl-gold)} .hl-tan{color:var(--hl-tan)}
.hl-rust{color:var(--hl-rust)} .hl-plum{color:var(--hl-plum)}
.hl-brown{color:var(--hl-brown)}

/* ---- footnote strip + page number */
.foot{ flex:0 0 auto; display:flex; align-items:flex-end; gap:10px; padding:8px 0 10px; }
.fn{
  flex:1 1 auto; background:var(--beige); border-radius:9px;
  padding:7px 14px; text-align:center; color:var(--ink);
  font-size:11.4px; line-height:1.5; max-height:66px; overflow:hidden;
}
.fn span{ font-family:"Tinos", "Times New Roman", Times, serif; }
.fn span.fn-fa{ font-family:"BNazanin", Tahoma, sans-serif; font-size:13px; }
.fn b{ font-weight:700; }
.pn{ flex:0 0 auto; width:22px; text-align:center; font-size:10px;
     color:#6b7280; direction:ltr; padding-bottom:12px; }
.foot.nofn .fn{ visibility:hidden; }

/* ---- cover */
.cover{ justify-content:center; padding:34px 60px 30px; }
.basmala{ text-align:center; color:var(--sage); font-family:"BNazanin", Tahoma, sans-serif;
          font-size:23px; font-weight:700; }
.rule{ width:260px; height:3px; background:var(--sage); border-radius:3px;
       margin:14px auto 22px; }
.hero{ display:flex; gap:18px; align-items:stretch; }
.hcard{ flex:1 1 0; background:var(--sage); color:var(--ivory);
        border-radius:14px; padding:30px 26px; display:flex; flex-direction:column;
        justify-content:center; }
.hcard .t1{ font-size:21px; font-weight:700; line-height:1.3; }
.hcard .t2{ font-size:17.5px; margin-top:10px; line-height:1.35; }
.hcard .t3{ font-size:14.5px; color:var(--beige); margin-top:12px; line-height:1.4; }
.hcard.fa{ direction:rtl; text-align:right; font-family:"BNazanin", Tahoma, sans-serif; }
.hcard.fa .t1{ font-size:26px; } .hcard.fa .t2{ font-size:21.5px; } .hcard.fa .t3{ font-size:18px; }
.hcard.en{ direction:ltr; text-align:left; }
.presenters{ margin:26px auto 0; background:var(--beige); border-radius:10px;
             padding:11px 26px; text-align:center; font-family:"BNazanin", Tahoma, sans-serif;
             font-size:15.5px; font-weight:700; }

/* ---- slide 23: the ZPD diagram */
.zpd{ flex:1 1 auto; display:flex; gap:16px; align-items:stretch; min-height:0; }
.zcol{ flex:1 1 0; min-width:0; display:flex; flex-direction:column; justify-content:stretch; }
.zcol .zcap{ margin-top:auto; padding-top:8px; }
.zbox{ background:var(--card); border:2.4px solid var(--beige); border-radius:15px;
       padding:10px; flex:1 1 auto; display:flex; flex-direction:column; justify-content:center; }


.zfig{ position:relative; display:grid;
       grid-template-columns:0.95fr 2.35fr 0.95fr; align-items:center; gap:10px;
       min-height:284px; padding:16px;
       background:var(--card); border:2px solid var(--sage); border-radius:12px; }
.zcard{ background:#8DAA91; border-radius:10px; padding:12px 10px; text-align:center;
        display:flex; flex-direction:column; justify-content:center; gap:6px; }
.zcard h4{ font-size:17.2px; line-height:1.25; color:#1F2C22; font-weight:700; }
.zcard p{ font-size:13.2px; line-height:1.45; color:#26352A; }
.zside{ display:flex; flex-direction:column; gap:1px; text-align:center;
        font-size:13.4px; font-weight:700; color:var(--ink); line-height:1.3; }
.zfa .zcard h4{ font-family:"BNazanin", Tahoma, sans-serif; font-size:21px; }
.zfa .zcard p{ font-family:"BNazanin", Tahoma, sans-serif; font-size:16.5px; line-height:1.68; }
.zfa .zside{ font-family:"BNazanin", Tahoma, sans-serif; font-size:15.5px; }
.zrule{ height:2.6px; border-radius:2px; background:var(--ink); margin:16px 4% 0; }
.zarrow{ height:42px; margin:14px 7% 0; background:#4E6350; color:var(--ivory);
         display:flex; align-items:center; justify-content:center;
         font-weight:700; font-size:14.4px;
         clip-path:polygon(0 26%, calc(100% - 34px) 26%, calc(100% - 34px) 0, 100% 50%, calc(100% - 34px) 100%, calc(100% - 34px) 74%, 0 74%); }
.zfa .zarrow{ clip-path:polygon(100% 26%, 34px 26%, 34px 0, 0 50%, 34px 100%, 34px 74%, 100% 74%);
              font-family:"BNazanin", Tahoma, sans-serif; font-size:17px; }
.zcap{ text-align:center; font-weight:700; color:var(--sage-strong); font-size:13.6px;
       margin-top:8px; }
.zcap.en{ font-size:12.6px; }

/* ---- closing */
.thanks{ justify-content:center; align-items:center; }
.tcard{ width:560px; background:var(--sage); border-radius:16px; color:var(--ivory);
        padding:44px 30px; text-align:center; }
.tcard .fa{ font-family:"BNazanin", Tahoma, sans-serif; font-size:34px; font-weight:700; }
.tcard .en{ font-size:19px; color:var(--beige); margin-top:10px; }
.thanks .presenters{ margin-top:26px; }
"""


def scene_page(sc):
    fn = fix_fn(sc["fn"])
    foot_cls = "foot" if fn else "foot nofn"
    return f'''<section class="pg" data-p="{sc['n']}">
  <div class="hd"><div class="pill en" dir="ltr">English Text</div><div class="pill fa" dir="rtl">ترجمه‌ی فارسی</div></div>
  <div class="cols">
    <div class="cell"><article class="card en" dir="ltr" lang="en" data-fit="en">{sc['en']}</article></div>
    <div class="cell"><article class="card fa" dir="rtl" lang="fa" data-fit="fa">{sc['fa']}</article></div>
  </div>
  <div class="{foot_cls}"><div class="fn" dir="ltr">{fn}</div><div class="pn">{sc['n']}</div></div>
</section>'''


def cover_page():
    c = cover
    return f'''<section class="pg cover" data-p="1">
  <div class="basmala">{c['basmala']}</div>
  <div class="rule"></div>
  <div class="hero">
    <div class="hcard en" dir="ltr" lang="en">
      <div class="t1">{c['en_h1']}</div>
      <div class="t2">{c['en_h2']}</div>
      <div class="t3">{c['en_h3']}</div>
    </div>
    <div class="hcard fa" dir="rtl" lang="fa">
      <div class="t1"><bdi>{c['fa_h1']}</bdi></div>
      <div class="t2"><bdi>{c['fa_h2']}</bdi></div>
      <div class="t3"><bdi>{c['fa_h3']}</bdi></div>
    </div>
  </div>
  <div class="presenters">{c['presenters']}</div>
</section>'''


def thanks_page():
    c = cover
    return f'''<section class="pg thanks" data-p="31">
  <div class="tcard">
    <div class="fa">{c['thanks_fa']}</div>
    <div class="en" dir="ltr" lang="en">{c['thanks_en']}</div>
  </div>
  <div class="presenters">{c['presenters']}</div>
</section>'''


def zpd_page():
    fa = """<div class="zcol zfa" dir="rtl" lang="fa">
      <div class="zbox"><div class="zfig">
        <div class="zside"><span>آنچه</span><span>دانسته است</span></div>
        <div class="zcard"><h4>منطقه‌ی رشد مجاور<sup class="zsup">۱</sup></h4>
          <p>مهارت‌هایی که تسلط بر آن‌ها برای کودک به‌تنهایی بسیار دشوار است، اما با راهنمایی و تشویق فردی آگاه انجام‌شدنی است.</p></div>
        <div class="zside"><span>آنچه</span><span>دانسته نیست</span></div>
      </div><div class="zrule"></div><div class="zarrow"><span>یادگیری</span></div></div>
      <div class="zcap">شکل ۱ ـ منطقه‌ی رشد مجاور ویگوتسکی</div></div>"""
    en = """<div class="zcol" dir="ltr" lang="en">
      <div class="zbox"><div class="zfig">
        <div class="zside"><span>What is</span><span>known</span></div>
        <div class="zcard"><h4>Zone of Proximal Development<sup class="zsup">1</sup></h4>
          <p>Skills too difficult for a child to master on his/her own, but that can be done with guidance and encouragement from a knowledgeable person.</p></div>
        <div class="zside"><span>What is</span><span>not known</span></div>
      </div><div class="zrule"></div><div class="zarrow"><span>Learning</span></div></div>
      <div class="zcap en">Fig. 1&nbsp; Vygotsky's Zone of Proximal Development (ZPD)</div></div>"""
    fn = ('<span class="fn-en" lang="en"><b class="hl-sage">1. </b></span>'
          '<span class="fn-en" lang="en"><b class="hl-sage">ZPD</b> = Zone of Proximal Development (</span>'
          '<span class="fn-fa" lang="fa" dir="rtl"><b class="hl-sage">منطقه‌ی رشد مجاور</b></span>'
          '<span class="fn-en" lang="en">)</span>')
    return f'''<section class="pg" data-p="23">
  <div class="hd"><div class="pill en" dir="ltr">English Text</div><div class="pill fa" dir="rtl">ترجمه‌ی فارسی</div></div>
  <div class="zpd">{en}{fa}</div>
  <div class="foot"><div class="fn" dir="ltr">{fn}</div><div class="pn">23</div></div>
</section>'''


pages = [cover_page()] + [scene_page(sc) for sc in scenes[:21]] + [zpd_page()] + \
        [scene_page(sc) for sc in scenes[21:]] + [thanks_page()]
assert len(pages) == 31, len(pages)

HEAD = """<!DOCTYPE html>
<html lang="fa" dir="ltr">
<head><meta charset="utf-8"><title>Mathematics For All</title>
<meta name="author" content="Mohammad Mahdi Alborzi, Amirreza Vahedi, Mohammad Mahdi Ghanbari Afra">
<meta name="description" content="Mathematics for All: Bridging the Gap for Underprivileged and Gifted Learners">
<style>""" + CSS + """</style></head>
<body>
"""

SCRIPT = """
<script>
/* Auto-fit: pick the largest type size the page can hold, so a short
   slide is set bigger instead of leaving a half-empty box. */
window.__fit = function () {
  var out = [];
  function fitCard(card, avail) {
    var lang = card.getAttribute('data-fit');
    var lo = 10.9, hi = lang === 'fa' ? 25 : 21.5, best = lo;
    for (var s = hi; s >= lo; s -= 0.25) {
      card.style.setProperty('--fs', s + 'px');
      if (card.offsetHeight <= avail) { best = s; break; }   /* offsetHeight ignores the page transform */
    }
    card.style.setProperty('--fs', best + 'px');
    return best;
  }
  Array.prototype.forEach.call(document.querySelectorAll('.pg[data-p]'), function (pg) {
    var cols = pg.querySelector('.cols');
    if (!cols) return;
    var cards = Array.prototype.slice.call(pg.querySelectorAll('.card'));
    var avail = cols.clientHeight;
    /* A short slide that is stretched to giant type gets rivers of white
       space between justified words, so sparse pages are set ragged. */
    var sparse = cards.some(function (c) { return c.offsetHeight < avail * 0.9; });
    if (sparse) pg.classList.add('ragged');
    cards.forEach(function (card) { card.style.minHeight = '0px'; });
    cards.forEach(function (card) {
      var size = fitCard(card, avail);
      out.push({ p: +pg.getAttribute('data-p'), lang: card.getAttribute('data-fit'),
                 size: +size.toFixed(2),
                 cardH: Math.round(card.offsetHeight),
                 avail: Math.round(avail), ragged: sparse });
    });
    cards.forEach(function (card) { card.style.minHeight = avail + 'px'; });
  });
  return out;
};
</script>
</body></html>"""

html = HEAD + "\n".join(pages) + SCRIPT

os.makedirs(OUTDIR, exist_ok=True)
open(os.path.join(OUTDIR, "deck.html"), "w", encoding="utf-8").write(html)
for f in ("BNazanin.ttf", "BNazaninBold.ttf"):
    shutil.copy(os.path.join(ROOT, "assets", f), os.path.join(OUTDIR, f))
for f in ("Tinos-Regular.ttf", "Tinos-Bold.ttf"):
    shutil.copy(os.path.join(os.path.dirname(os.path.abspath(__file__)), f),
                os.path.join(OUTDIR, f))
json.dump({"scenes": scenes, "cover": cover}, open(os.path.join(OUTDIR, "data.json"), "w"),
          ensure_ascii=False, indent=1)
print("pages:", len(pages), "html KB:", round(len(html) / 1024),
      "scenes:", scenes[0]["id"], "→", scenes[-1]["id"], file=sys.stderr)
