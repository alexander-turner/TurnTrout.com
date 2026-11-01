"""
Guard the shape of the pnpm ``overrides`` block in ``pnpm-workspace.yaml``.

Security overrides must be range floors (``^1.2.3``), not exact versions. An
exact pin freezes the package on whatever release was patched at the time;
the next advisory against that release can't be cleared by ``pnpm update`` or
Dependabot, so alerts pile up until someone edits the pin by hand.
"""

import re

import pytest
import yaml

from .. import utils as script_utils

# Compatibility pins that must stay exact. Each pins a known-good version for a
# reason unrelated to security, so it is exempt from the range-floor rule.
EXACT_PIN_ALLOWLIST: frozenset[str] = frozenset(
    {
        "subfont>assetgraph",
        "workbox-build",
    }
)

_RANGE_SPEC = re.compile(r"^(\^|~|>=)\d")
_ALIAS_SPEC = re.compile(r"^npm:")


def _load_overrides() -> dict[str, str]:
    workspace = script_utils.get_git_root() / "pnpm-workspace.yaml"
    data = yaml.safe_load(workspace.read_text(encoding="utf-8"))
    overrides = data["overrides"]
    assert isinstance(overrides, dict) and overrides
    return {str(key): str(value) for key, value in overrides.items()}


OVERRIDES = _load_overrides()


@pytest.mark.parametrize(
    ("selector", "spec"),
    sorted(
        (selector, spec)
        for selector, spec in OVERRIDES.items()
        if selector not in EXACT_PIN_ALLOWLIST
    ),
)
def test_override_is_range_floor(selector: str, spec: str) -> None:
    assert _RANGE_SPEC.match(spec) or _ALIAS_SPEC.match(spec), (
        f"Override {selector!r}: {spec!r} is an exact pin. Use a caret floor at "
        f"the first patched release (e.g. '^{spec}') so lockfile refreshes can "
        "pick up later patches, or add it to EXACT_PIN_ALLOWLIST with a reason."
    )


@pytest.mark.parametrize("selector", sorted(EXACT_PIN_ALLOWLIST))
def test_allowlisted_pins_still_exist(selector: str) -> None:
    assert selector in OVERRIDES, (
        f"{selector!r} is allowlisted but no longer overridden; drop it."
    )
