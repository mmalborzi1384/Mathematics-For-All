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
  pass, and the typography rule that pass enforces:

  * **both columns are always justified** (`text-align:justify`), on every page,
    for Persian and Latin alike — there is no ragged mode;
  * the house size is 17.5px Latin / 20px Persian (the site's 17.5 : 20 ratio,
    since B Nazanin runs smaller than Times on the same em), shrunk only as far
    as the longest slide needs; the deck never grows past that, because beyond
    it a 408px column loses characters per line and justified lines have to
    stretch their word spaces to fill the measure;
  * Chromium here ships without hyphenation dictionaries (`hyphens:auto` is a
    no-op), so word-spacing is the only thing left: it is measured, never
    guessed — see `window.__fit` and the `gap median / p90` report in
    `render.js`;
  * vertical room left over on a short slide is spent on **leading**, up to
    1.45×, and the block is centred in its frame, so a sparse page looks
    deliberately set rather than half-empty.
* `fix_tounicode.py` — Chromium writes Persian glyphs into the PDF as
  *presentation forms* (ﺗ U+FB97 …), which no reader can search or copy. The
  script folds every `/ToUnicode` destination through NFKC so the text layer is
  normal Persian while the visible glyphs stay untouched.
* `Tinos-*.ttf` — Times-metric substitute for the Latin side (OFL, see
  `OFL-Tinos.txt`); B Nazanin ships in `assets/`.

Page order is fixed: 1 cover, 2–30 the scenes in order (23 is the ZPD diagram),
31 thanks.
