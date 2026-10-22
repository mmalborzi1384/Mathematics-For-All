# tools/deck — how the PDF is built

`assets/Mathematics-For-All.pdf` is generated, not hand-made. The content is
taken from `index.html` so the deck and the site can never drift apart.

```bash
python3 -m venv /tmp/v2 && /tmp/v2/bin/pip install pypdf fonttools
node tools/deck/render.js            # needs puppeteer-core + @sparticuz/chromium
/tmp/v2/bin/python tools/deck/fix_tounicode.py out.pdf assets/Mathematics-For-All.pdf
```

* `build.py` — pulls each scene's Persian/English article and footnote out of
  `index.html`, emits a 31-page 16:9 HTML sheet (960×540 pt) with an auto-fit
  pass: every card is set at the largest type size it can hold, then both cards
  of a pair are equalised, so a short slide no longer leaves a half-empty box.
* `fix_tounicode.py` — Chromium writes Persian glyphs into the PDF as
  *presentation forms* (ﺗ U+FB97 …), which no reader can search or copy. The
  script folds every `/ToUnicode` destination through NFKC so the text layer is
  normal Persian while the visible glyphs stay untouched.
* `Tinos-*.ttf` — Times-metric substitute for the Latin side (OFL, see
  `OFL-Tinos.txt`); B Nazanin ships in `assets/`.

Page order is fixed: 1 cover, 2–30 the scenes in order (23 is the ZPD diagram),
31 thanks.
