#!/usr/bin/env bash
# Install the pinned mergiraf binary onto PATH. Args: [dest-dir] (default
# /usr/local/bin, which is on PATH on every hosted runner).
#
# mergiraf backs auto-resolve/prepare.sh's structural pre-pass: the syntax-aware
# merge that resolves the structural subset of a PR's conflicts so only genuinely
# semantic conflicts reach the paid LLM pass, and every merge in the checkout that
# runs this, because it also registers the merge driver .gitattributes names. The
# version and the tarball SHA-256 both live in .github/tool-versions.sh; the digest
# there — not the release's own checksum manifest — is the anchor, because a
# manifest fetched from the same tag as the artifact is re-published by anyone who
# can re-tag the release.
set -euo pipefail

dest="${1:-/usr/local/bin}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pins="${here}/../tool-versions.sh"
# The file check has to come BEFORE the source. Under `set -euo pipefail` a
# source of a missing file aborts the script on the spot, so the refusal below
# could never be what named the cause — and a consumer whose sync skipped this
# file got a bare "No such file or directory" instead.
[[ -f "$pins" ]] || {
  echo "install-mergiraf: ${pins} does not exist, so no pinned version or digest" >&2
  echo "  can be read; refusing to install an unverified binary." >&2
  exit 1
}
# shellcheck source=/dev/null
source "$pins"

# An absent or empty pin must never degrade into "install without verifying" —
# that is a supply-chain check reporting green because its input went missing.
# Fail closed and name the fix, so it is one edit away.
[[ -n "${MERGIRAF_VERSION:-}" && -n "${MERGIRAF_SHA256_linux_amd64:-}" ]] || {
  echo "install-mergiraf: MERGIRAF_VERSION / MERGIRAF_SHA256_linux_amd64 unset or empty in" >&2
  echo "  .github/tool-versions.sh; refusing to install an unverified binary. Set the version" >&2
  echo "  and its digest there together, from the release tarball's own sha256sum." >&2
  exit 1
}

# Spelled once, so the skip below compares the WHOLE bound value against what the
# bind at the end of this script writes. Matching the path alone would keep an
# argument string an earlier revision bound, and a changed flag or timeout would
# never reach an installed checkout. --git overwrites the left revision in place;
# -t bounds a pathological parse so the merge falls back to git's algorithm.
driver_args=" merge --git %O %A %B -s %S -x %X -y %Y -p %P -t 30000"

# Already done: the destination holds the PINNED version, bare `mergiraf` resolves
# to it, and this checkout binds the driver to it. The PATH condition is not
# redundant — the environment is what changes between runs, and a foreign mergiraf
# that appeared since would otherwise be certified by a skip. Deciding it here keeps
# the pin parsed in one place, so no caller re-derives it and drifts.
bound_driver="$(git config --local --get merge.mergiraf.driver 2>/dev/null)" || bound_driver=""
resolved_dir=""
if resolved="$(command -v mergiraf)"; then resolved_dir="$(cd "$(dirname "$resolved")" && pwd)"; fi
if [[ "$("${dest}/mergiraf" --version 2>/dev/null)" == "mergiraf ${MERGIRAF_VERSION#v}" ]]; then
  installed_dir="$(cd "$dest" && pwd)"
  want="${installed_dir}/mergiraf"
  if [[ "$resolved_dir" = "$installed_dir" && "$bound_driver" = "${want@Q}${driver_args}" ]]; then
    exit 0
  fi
fi

tarball="mergiraf_x86_64-unknown-linux-gnu.tar.gz"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

# --retry/--retry-all-errors so a transient release-CDN 5xx is retried, and
# --fail so a 5xx is an error rather than an error page saved as the tarball,
# which then fails `tar` with a misleading "not recoverable". Downloaded into a
# private directory, so nothing else can write the bytes between here and `tar`.
curl -fsSL --retry 6 --retry-all-errors --retry-delay 15 --connect-timeout 30 \
  -o "${workdir}/${tarball}" \
  "https://codeberg.org/mergiraf/mergiraf/releases/download/${MERGIRAF_VERSION}/${tarball}"

# This refusal is what blocks a swapped, re-tagged, or corrupted release asset
# from reaching PATH: the digest is the reviewed one from tool-versions.sh, so a
# mismatch aborts the install rather than certifying a binary nobody vetted.
sha256sum --check <<<"${MERGIRAF_SHA256_linux_amd64}  ${workdir}/${tarball}"
tar xzf "${workdir}/${tarball}" -C "$workdir" mergiraf

# sudo only when the destination is not already writable, so this works both on a
# hosted runner (root-owned /usr/local/bin) and in a local checkout writing to a
# user-owned dir.
mkdir -p "$dest" # bare-mkdir-ok: `install` below is the post-condition and fails loudly
if [[ -w "$dest" ]]; then
  install -m 0755 "${workdir}/mergiraf" "${dest}/mergiraf"
else
  sudo install -m 0755 "${workdir}/mergiraf" "${dest}/mergiraf"
fi

# A rejected binary is already installed by the time the refusals below fire, so a
# driver bound by an earlier run would point every merge at it. Unbinding restores
# git's line merge, which is what those refusals promise.
unbind_driver() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0
  # --local on BOTH: this script only ever binds locally, and `--unset` writes to
  # local whatever `--get` searched. An all-scope read would pass on a host
  # carrying a global binding, then unset nothing and leave the driver bound.
  git config --local --get merge.mergiraf.driver >/dev/null || return 0
  git config --local --unset merge.mergiraf.driver
}

# The guard's success is the post-condition, not the exit status of the install:
# bare `mergiraf` must be THIS binary. The driver below names an absolute path, but
# auto-resolve/prepare.sh's pre-pass invokes the bare command, so a destination off
# PATH leaves it looking at a binary it cannot find — and a different mergiraf
# earlier on PATH is worse, because the pre-pass would run a version no digest vetted.
dest_dir="$(cd "$dest" && pwd)"
mergiraf_bin="${dest_dir}/mergiraf"
resolved="$(command -v mergiraf)" || resolved=""
[[ -n "$resolved" && "$(cd "$(dirname "$resolved")" && pwd)" = "$dest_dir" ]] || {
  echo "install-mergiraf: installed ${mergiraf_bin}, but 'mergiraf' on PATH resolves to" >&2
  echo "  '${resolved:-nothing}'; refusing to certify a binary this run did not verify." >&2
  unbind_driver
  exit 1
}

# Prove the CLI contract the pre-pass actually depends on, not merely that some
# binary runs: auto-resolve/prepare.sh trusts `solve -p` to print a merged result
# on stdout and exit 0 only when it resolved everything. A release that drifts on
# either would leave the pre-pass silently solving nothing — no red anywhere,
# just every structural conflict routed back to the paid LLM pass — so the drift
# is caught here, where it is loud, instead of costing money quietly. The probe
# takes one key from each side, so a build that merely stripped the markers
# fails it too.
probe="${workdir}/contract.json"
printf '%s\n' '{' '<<<<<<< ours' '  "a": 1,' '||||||| base' '=======' '  "b": 2,' '>>>>>>> theirs' '  "c": 3' '}' >"$probe"
solved="$("$mergiraf_bin" solve -p "$probe")" || {
  echo "install-mergiraf: 'mergiraf solve -p' exited non-zero on a conflict it must resolve —" >&2
  echo "  the ${MERGIRAF_VERSION} CLI contract auto-resolve/prepare.sh depends on has changed." >&2
  unbind_driver
  exit 1
}
[[ "$solved" != *'<<<<<<<'* && "$solved" == *'"a": 1'* && "$solved" == *'"b": 2'* ]] || {
  echo "install-mergiraf: 'mergiraf solve -p' reported success without merging both sides of the" >&2
  echo "  probe conflict; refusing to install a binary the structural pre-pass cannot trust. Got:" >&2
  printf '%s\n' "$solved" >&2
  unbind_driver
  exit 1
}
"$mergiraf_bin" --version

# Register the git merge driver the committed .gitattributes already points at,
# so every merge in this checkout — the resolver's own `git merge`, a rebase, a
# local `git pull` — merges syntax-aware instead of by line. Registering it HERE
# is what keeps the attribute honest: the driver name is only ever bound to a
# binary whose contract was just proven above, and a checkout without mergiraf
# leaves it unbound (git silently falls back to the built-in text driver) rather
# than pointing at a command that does not exist. The value names the ABSOLUTE
# path: git config outlives any one shell's PATH, so a bare command would break
# every merge run from a terminal or IDE whose PATH lacks the install directory —
# and a failing driver is a conflict git reports, not a fallback to the line merge.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "install-mergiraf: not inside a git work tree, so the merge driver was not registered;"
  echo "  the binary is installed and usable. Re-run this from a checkout to bind the driver."
  exit 0
}
git config merge.mergiraf.name "mergiraf structured merge"
# @Q shell-quotes the path: git hands this value to a shell, so a destination
# containing a space would otherwise split into two words and fail every merge.
git config merge.mergiraf.driver "${mergiraf_bin@Q}${driver_args}"
