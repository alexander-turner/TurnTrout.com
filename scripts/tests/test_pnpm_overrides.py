"""
Guard the shape of the pnpm ``overrides`` block in ``pnpm-workspace.yaml``.

Security overrides must be caret floors (``^1.2.3``), not exact versions. An
exact pin freezes the package on whatever release was patched at the time;
the next advisory against that release can't be cleared by ``pnpm update`` or
Dependabot, so alerts pile up until someone edits the pin by hand.
"""

import re
from collections.abc import Mapping
from types import MappingProxyType

import pytest
import yaml

from .. import utils as script_utils

# Compatibility pins that must stay exact. Each pins a known-good version for a
# reason unrelated to security, so it is exempt from the caret-floor rule.
EXACT_PIN_ALLOWLIST: frozenset[str] = frozenset(
    {
        "subfont>assetgraph",
        "workbox-build",
        "html-minifier",
    }
)

_CARET_FLOOR = re.compile(r"^\^\d")


def _load_overrides() -> Mapping[str, str]:
    workspace = script_utils.get_git_root() / "pnpm-workspace.yaml"
    data = yaml.safe_load(workspace.read_text(encoding="utf-8"))
    overrides = data["overrides"]
    assert isinstance(overrides, dict) and overrides
    return MappingProxyType(
        {str(key): str(value) for key, value in overrides.items()}
    )


OVERRIDES = _load_overrides()


@pytest.mark.parametrize(
    ("selector", "spec"),
    sorted(
        (selector, spec)
        for selector, spec in OVERRIDES.items()
        if selector not in EXACT_PIN_ALLOWLIST
    ),
)
def test_override_is_caret_floor(selector: str, spec: str) -> None:
    assert _CARET_FLOOR.match(spec), (
        f"Override {selector!r}: {spec!r} is not a caret floor. Use one at "
        f"the first patched release (e.g. '^{spec}') so lockfile refreshes can "
        "pick up later patches, or add it to EXACT_PIN_ALLOWLIST with a reason."
    )


@pytest.mark.parametrize("selector", sorted(EXACT_PIN_ALLOWLIST))
def test_allowlisted_pins_still_exist(selector: str) -> None:
    assert selector in OVERRIDES, (
        f"{selector!r} is allowlisted but no longer overridden; drop it."
    )
