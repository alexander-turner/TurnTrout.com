#!/usr/bin/env bash
# Wrapper for docformatter in lint-staged.
# docformatter returns exit 3 on successful in-place reformats, which
# lint-staged treats as failure.  This script normalises the exit code.
uv run docformatter --in-place --config config/python/pyproject.toml "$@"
exit 0
