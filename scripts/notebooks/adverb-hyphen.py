import re
import sys
from pathlib import Path

REPLACEMENTS = {
    # Generated from error messages
    r"introspectively-apparently": "introspectively apparently",
    r"internally-observable": "internally observable",
    r"implicitly-planned": "implicitly planned",
    r"previously-visited": "previously visited",
    r"obviously-wrong": "obviously wrong",
    r"nearly-complete": "nearly complete",
    r"instrumentally-relevant": "instrumentally relevant",
    r"instrumentally-valuable": "instrumentally valuable",
    r"freshly-proven": "freshly proven",
    r"theoretically-motivated": "theoretically motivated",
    r"physically-implemented": "physically implemented",
    r"selectively-permeable": "selectively permeable",
    r"arbitrarily-intelligent": "arbitrarily intelligent",
    r"usefully-intelligent": "usefully intelligent",
    r"fully-robust": "fully robust",
    r"easily-definable": "easily definable",
    r"currently-public": "currently public",
    r"fully-connected": "fully connected",
    r"potentially-fundamental": "potentially fundamental",
    r"moderately-complex": "moderately complex",
    r"highly-evaluated": "highly evaluated",
    r"commonly-postulated": "commonly postulated",
    r"commonly-referenced": "commonly referenced",
    r"easily- and": "easily and",
    r"safely-trainable": "safely trainable",
    r"particularly-inhibiting": "particularly inhibiting",
    r"astronomically-large": "astronomically large",
    r"randomly-generated": "randomly generated",
    r"causally-irreversible": "causally irreversible",
    r"initially-reachable": "initially reachable",
    r"Intuitively-accessible": "Intuitively accessible",
    r"potentially-helpful": "potentially helpful",
    r"loosely-coupled": "loosely coupled",
    r"loosely-correlated": "loosely correlated",
    r"robustly-trained": "robustly trained",
    r"carefully-constructed": "carefully constructed",
    r"instrumentally-useful": "instrumentally useful",
    r"reflectively-coherent": "reflectively coherent",
    r"probably-doomed": "probably doomed",
    r"reflectively-predicted": "reflectively predicted",
    r"closely-related": "closely related",
    r"mathematically-simple": "mathematically simple",
    r"nearly-optimally": "nearly optimally",
    r"sufficiently-basic": "sufficiently basic",
    r"previously-whitelisted": "previously whitelisted",
    r"unrealistically-strong": "unrealistically strong",
    r"inherently-incorrect": "inherently incorrect",
    r"provably-bounded": "provably bounded",
    r"Manually-derived": "Manually derived",
    r"seemingly-unrelated": "seemingly unrelated",
    r"randomly-resampled": "randomly resampled",
    r"newly-directed": "newly directed",
    r"mathematically-experienced": "mathematically experienced",
    r"freshly-exposed": "freshly exposed",
    r"narrowly-targeted": "narrowly targeted",
    r"globally-safe": "globally safe",
    r"newly-implanted": "newly implanted",
    r"reflectively-endorsed": "reflectively endorsed",
    r"actually-best": "actually best",
    r"introspectively-apparent": "introspectively apparent",
    r"potentially-unrealistic": "potentially unrealistic",
    r"objectively-good": "objectively good",
    r"newly-minted": "newly minted",
    r"robustly-intelligent": "robustly intelligent",
    r"newly-installed": "newly installed",
    r"increasingly-refined": "increasingly refined",
    r"appropriately-difficult": "appropriately difficult",
    r"externally-activated": "externally activated",
    r"slightly-varied": "slightly varied",
    r"deceptively-aligned": "deceptively aligned",
}


def process_file(file_path):
    content = Path(file_path).read_text()
    replacements_made = 0

    for pattern, replacement in REPLACEMENTS.items():
        content, count = re.subn(
            r"\b" + re.escape(pattern) + r"\b", replacement, content
        )
        replacements_made += count

    if replacements_made > 0:
        Path(file_path).write_text(content)
        return replacements_made
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python fix_hyphens.py <file1> [<file2> ...]")
        sys.exit(1)

    total_replacements = 0
    for file_pattern in sys.argv[1:]:
        for file_path in Path().glob(file_pattern):
            if file_path.is_file():
                count = process_file(file_path)
                total_replacements += count
                if count > 0:
                    print(f"Updated {count} instances in {file_path}")

    print(f"\nTotal replacements made: {total_replacements}")
