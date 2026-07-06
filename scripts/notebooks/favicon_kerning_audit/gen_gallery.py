"""Build a worst-first HTML gallery + markdown summary from measurement
results."""

import base64
import html
import json
from pathlib import Path

OUT = Path("/tmp/favicon_kerning_audit")


def main() -> None:
    data = json.loads((OUT / "bigrams.json").read_text())
    results = json.loads((OUT / "results.json").read_text())
    usage = {(b["char"], b["domain"]): b for b in data["bigrams"]}

    rows = []
    for r in results:
        if r["min2dCss"] is None:
            continue
        b = usage.get((r["char"], r["domain"]), {})
        rows.append(
            {
                **r,
                "count": b.get("count", 0),
                "contexts": b.get("contexts", []),
                "pages": b.get("pages", []),
            }
        )
    rows.sort(key=lambda r: r["min2dCss"])

    cells_html = []
    for r in rows:
        png = (OUT / "cells" / f"{r['id']}.png").read_bytes()
        b64 = base64.b64encode(png).decode()
        ctx = "<br>".join(html.escape(c) for c in r["contexts"])
        cells_html.append(
            f"""
<div class="cell {"close" if r["nudge"] else ""}">
  <img src="data:image/png;base64,{b64}" style="height:60px" alt="">
  <div class="meta">
    <b>“{html.escape(r["char"])}” + {html.escape(r["domain"])}</b><br>
    min2d: {r["min2dCss"]:.2f}px · hgap: {r["hgapCss"]:.2f}px<br>
    nudge: {html.escape(r["nudge"]) or "none"} · {r["count"]} uses<br>
    <span class="ctx">{ctx}</span>
  </div>
</div>"""
        )

    gallery = f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Favicon bigram clearance (sorted worst-first)</title>
<style>
 body {{ font-family: sans-serif; background: #f6f6f6; }}
 .cell {{ display:inline-block; vertical-align:top; width: 300px; margin:6px;
          background:#fff; border:1px solid #ccc; padding:8px; border-radius:6px; }}
 .cell.close {{ border-left: 4px solid #c60; }}
 .meta {{ font-size: 12px; margin-top: 4px; }}
 .ctx {{ color: #666; font-size: 11px; }}
</style></head><body>
<h1>Favicon bigrams, sorted by min ink distance (worst first)</h1>
<p>{len(rows)} measurable bigrams. Orange left border = spacing nudge applied.</p>
{"".join(cells_html)}
</body></html>"""
    (OUT / "gallery.html").write_text(gallery)

    lines = [
        "| min2d px | hgap px | char | domain | nudge | uses |",
        "|--|--|--|--|--|--|",
    ]
    for r in rows[:40]:
        lines.append(
            f"| {r['min2dCss']:.2f} | {r['hgapCss']:.2f} | `{r['char']}` | "
            f"{r['domain']} | {r['nudge']} | {r['count']} |"
        )
    (OUT / "summary.md").write_text("\n".join(lines))

    print(f"gallery with {len(rows)} cells; tightest 10:")
    for r in rows[:10]:
        print(
            f"  {r['min2dCss']:5.2f}px hgap={r['hgapCss']:5.2f} '{r['char']}' + "
            f"{r['domain']:<24} nudge={r['nudge'] or '-'} n={r['count']}"
        )


if __name__ == "__main__":
    main()
