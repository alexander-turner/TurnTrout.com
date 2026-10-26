#!/usr/bin/env python3
"""
Print the merge-conflict resolver's ref (or repository) from its one `uses:`
line.

PROBLEM CLASS — one resolver version named by several files, kept in step by a
comment. The resolver's code runs with this repository's model and push
credentials, so which version runs IS the security control. A pin that reaches
one file and not another leaves the labeler, the discover job or template-sync's
tier 2 on a different resolver, and nothing fails: each copy works on its own.

GitHub interpolates nothing into a `uses:`, so that line cannot read a shared
value. It is therefore the source, and every other reader asks here. Dependabot
moves only that line, so every reader follows it with no second edit.

Standard library plus PyYAML. Every caller runs it through run-with-pyyaml.sh,
which supplies PyYAML at its pinned version, so no runner image needs to ship it.

Usage: resolver-ref.py [--github-output] [ROOT]
  ROOT defaults to the working directory. Prints the ref. With --github-output,
  append `repository=<owner/name>` and `ref=<ref>` to $GITHUB_OUTPUT instead.
"""

import argparse
import os
import re
from pathlib import Path

import yaml

CALLER = Path(".github/workflows/auto-resolve-conflicts.yaml")
JOB = "resolve"
WORKFLOW_PATH = "/.github/workflows/auto-resolve.yaml"
REPOSITORY = re.compile(r"\w[\w.-]*/[\w.-]+")


def resolver_pin(root: Path) -> tuple[str, str]:
    """
    The (repository, ref) pair the `resolve` job's `uses:` names.

    INVARIANT: the ref is safe to pass as a `git fetch` or `git checkout`
    argument. A ref with a leading `-` would be read as an option, and an absent
    ref would make a consumer fetch the whole remote and run whatever HEAD is.
    """
    doc = yaml.safe_load((root / CALLER).read_text(encoding="utf-8"))
    uses = doc["jobs"][JOB]["uses"]
    target, sep, ref = uses.partition("@")
    repository, found, _ = target.partition(WORKFLOW_PATH)
    usable = sep and ref and not ref.startswith("-") and found
    if not usable or not REPOSITORY.fullmatch(repository):
        raise SystemExit(
            f"{CALLER}'s `{JOB}` job calls {uses!r}, which is not "
            f"`<owner>/<repo>{WORKFLOW_PATH}@<ref>` with a usable ref. The resolver "
            "version must be named on that `uses:` line, never with a leading `-`."
        )
    return repository, ref


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--github-output", action="store_true")
    parser.add_argument("root", nargs="?", default=".", type=Path)
    args = parser.parse_args()
    repository, ref = resolver_pin(args.root)
    if not args.github_output:
        print(ref)
        return
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as out:
        out.write(f"repository={repository}\nref={ref}\n")


if __name__ == "__main__":
    main()
