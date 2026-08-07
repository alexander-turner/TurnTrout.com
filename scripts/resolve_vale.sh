#!/bin/bash
# Print the path to a vale binary whose version matches config/vale/version,
# or exit 1 when no such binary is installed.
#
# Vale's rule scoping is version-dependent: a `^`-anchored raw regex in
# .vale-styles matches at different boundaries across releases, so a binary
# other than the pinned one reports alerts that CI (which installs the pin)
# never sees. Pre-push and CI must run the same version for the gate to mean
# anything, hence an explicit resolve rather than whatever `vale` PATH offers.

set -uo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PINNED_VERSION=$(cat "$SCRIPT_DIR/../config/vale/version")

# `vale --version` prints "vale version X.Y.Z".
vale_version_of() {
  "$1" --version 2>/dev/null | awk 'NR == 1 {print $NF}'
}

# session-setup.sh installs the pin into ~/.local/bin; check it before PATH so
# a newer system-wide vale (e.g. Homebrew's) doesn't shadow the pinned copy.
for candidate in "$HOME/.local/bin/vale" "$(command -v vale 2>/dev/null)"; do
  [ -n "$candidate" ] && [ -x "$candidate" ] || continue
  if [ "$(vale_version_of "$candidate")" = "$PINNED_VERSION" ]; then
    printf '%s\n' "$candidate"
    exit 0
  fi
done

exit 1
