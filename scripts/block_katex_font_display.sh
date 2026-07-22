#!/usr/bin/env bash

# Scope font-display: block to KaTeX @font-face rules in built HTML.
#
# subfont injects font-display: swap into every @font-face it inlines. Prose
# keeps swap (text paints instantly in the fallback serif on cold caches), but
# math waits for the real font: KaTeX rendered in a fallback face is
# unpositioned unicode soup, not merely off-brand type. subfont's
# --font-display flag is global, so the split is applied here instead.

set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: $0 <html files...>" >&2
  exit 1
fi

perl -0777 -pi -e '
  s{(\@font-face\{[^{}]*KaTeX[^{}]*\})}{
    my $rule = $1;
    $rule =~ s/font-display\s*:\s*swap/font-display:block/g;
    $rule;
  }ge;
' "$@"
