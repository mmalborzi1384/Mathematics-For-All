#!/usr/bin/env python3
"""Make the Persian text inside a Chromium/Skia PDF copyable and searchable.

Skia's /ToUnicode CMap points each glyph at the *presentation form* it was
shaped from (ﺗ U+FB97, ـﻪ U+FEEC …).  Those render identically but no
reader will ever match a search for "موهبت" against them.  NFKC folds every
presentation form back to its base letter(s), so rewriting the CMap
destinations through NFKC restores a normal text layer while the visible
glyphs stay exactly as they are.

Both `beginbfchar` and `beginbfrange` blocks are handled; ranges are
expanded into single mappings so each destination can be folded on its own.
"""
import re
import sys
import unicodedata

from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject

MAX_RANGE = 4096


def fold(dst_hex):
    """UTF-16BE hex -> folded UTF-16BE hex (None when nothing changes)."""
    try:
        txt = bytes.fromhex(dst_hex).decode("utf-16-be", "ignore")
    except Exception:
        return None
    if not txt:
        return None
    new = unicodedata.normalize("NFKC", txt)
    return None if new == txt else new.encode("utf-16-be").hex().upper()


def parse_cmap(data: bytes):
    text = data.decode("latin-1")

    def block_pairs(kind):
        pairs = []
        for m in re.finditer(r"begin%s(.*?)end%s" % (kind, kind), text, re.S):
            body = m.group(1)
            if kind == "bfchar":
                for src, dst in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", body):
                    pairs.append((src.upper(), dst.upper()))
            else:
                for m2 in re.finditer(
                        r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])",
                        body):
                    lo, hi, dst = m2.group(1), m2.group(2), m2.group(3)
                    lo_i, hi_i = int(lo, 16), int(hi, 16)
                    width = len(lo)
                    if hi_i - lo_i > MAX_RANGE:
                        continue
                    if dst.startswith("["):
                        items = re.findall(r"<([0-9A-Fa-f]+)>", dst)
                        for k, d in enumerate(items):
                            pairs.append((("%0*X" % (width, lo_i + k)), d.upper()))
                    else:
                        base = int(dst[1:-1], 16)
                        for k in range(hi_i - lo_i + 1):
                            pairs.append((("%0*X" % (width, lo_i + k)),
                                          ("%0*X" % (len(dst) - 2, base + k))))
        return pairs

    pairs = block_pairs("bfchar") + block_pairs("bfrange")
    # de-duplicate, last wins
    seen = {}
    for src, dst in pairs:
        seen[src] = dst
    return text, seen


def build_cmap(text, mapping):
    """Replace every bfchar/bfrange block with folded bfchar entries."""
    folded = {src: (fold(dst) or dst) for src, dst in mapping.items()}
    head = text[: text.find("begin")] if "begin" in text else text
    body = "\n".join("<%s> <%s>" % (s, d) for s, d in folded.items())
    tail = "endcmap\nendcodespacerun >\n"
    return (head + "1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n"
            "%d beginbfchar\n%s\nendbfchar\n%s" % (len(folded), body, tail)).encode("latin-1")


def main(src, dst):
    reader = PdfReader(src)
    writer = PdfWriter(clone_from=reader)
    total, fonts_done, done = 0, 0, set()
    for page in writer.pages:
        res = page.get("/Resources")
        if not res:
            continue
        fonts = res.get_object().get("/Font")
        if not fonts:
            continue
        fonts = fonts.get_object()
        for key in list(fonts.keys()):
            font = fonts[key].get_object()
            if "/ToUnicode" not in font:
                continue
            key_id = id(font.get_object())
            if key_id in done:
                continue
            done.add(key_id)
            stream = font["/ToUnicode"].get_object()
            text, mapping = parse_cmap(stream.get_data())
            if not mapping:
                continue
            new = build_cmap(text, mapping)
            fonts_done += 1
            total += len(mapping)
            s = DecodedStreamObject()
            s.set_data(new)
            font[NameObject("/ToUnicode")] = writer._add_object(s)
    writer.add_metadata({
        "/Title": "Mathematics For All",
        "/Author": "Mohammad Mahdi Alborzi, Amirreza Vahedi, Mohammad Mahdi Ghanbari Afra",
        "/Subject": "Bridging the Gap for Underprivileged and Gifted Learners — bilingual (Persian / English) chapter deck",
        "/Keywords": "gifted education, mathematics, Zimbabwe, South Africa, Vygotsky, ZPD, bilingual",
    })
    try:
        writer.compress_identical_objects(remove_identicals=True, remove_orphans=True)
    except Exception as exc:            # older pypdf
        print("dedupe skipped:", exc, file=sys.stderr)
    with open(dst, "wb") as fh:
        writer.write(fh)
    print(f"cmaps rewritten: {fonts_done}, glyph mappings: {total} -> {dst}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
