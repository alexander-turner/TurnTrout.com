"""
Property-based tests for strip_for_spellcheck.

The module's core contract is positional fidelity: stripped output must keep the
same line/column coordinates as the source so lint errors map back correctly.
Hypothesis fuzzes that contract directly.
"""

import shutil
import sys
from pathlib import Path

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

sys.path.append(str(Path(__file__).parent.parent.parent))

# pylint: disable=wrong-import-position
from scripts import strip_for_spellcheck  # noqa: E402
from scripts.strip_for_spellcheck import (  # noqa: E402
    get_quote_level,
    is_quote_callout_start,
    strip_callout_markers,
    strip_dropcap_tags,
    strip_for_lint,
    strip_math,
    strip_quote_blocks,
)

# Deterministic runs keep CI reproducible (zero-flakiness policy). The
# example database and the differing-executors check only matter for
# randomized runs; disabling them lets mutation-testing harnesses (mutmut)
# re-run these tests in one process without spurious health-check failures.
settings.register_profile(
    "deterministic",
    derandomize=True,
    max_examples=300,
    database=None,
    suppress_health_check=[HealthCheck.differing_executors],
)
settings.load_profile("deterministic")

markdown_text = st.text(
    alphabet=st.characters(codec="utf-8", exclude_characters="\r"),
    max_size=500,
)

markdown_lines = st.lists(
    st.text(
        alphabet=st.sampled_from(
            list('abc >[]!quote$\\<>/"=spandivclrx.,123 ')
        ),
        max_size=40,
    ),
    max_size=20,
).map("\n".join)


class TestPositionPreservation:
    """Every stripper must preserve line numbers; most preserve columns."""

    @given(markdown_text)
    def test_strip_math_preserves_length_and_newlines(self, text: str):
        stripped = strip_math(text)
        assert len(stripped) == len(text)
        assert stripped.count("\n") == text.count("\n")

    @given(markdown_text)
    def test_strip_math_preserves_line_lengths(self, text: str):
        stripped = strip_math(text)
        assert [len(line) for line in stripped.split("\n")] == [
            len(line) for line in text.split("\n")
        ]

    @given(markdown_text)
    def test_strip_callout_markers_preserves_length(self, text: str):
        stripped = strip_callout_markers(text)
        assert len(stripped) == len(text)
        assert stripped.count("\n") == text.count("\n")

    @given(markdown_lines)
    def test_strip_quote_blocks_preserves_line_count(self, text: str):
        assert strip_quote_blocks(text).count("\n") == text.count("\n")

    @given(markdown_lines)
    def test_strip_for_lint_preserves_line_count(self, text: str):
        assert strip_for_lint(text).count("\n") == text.count("\n")


class TestIdempotence:
    """Stripping already-stripped text must change nothing."""

    @given(markdown_text)
    def test_strip_math_idempotent(self, text: str):
        once = strip_math(text)
        assert strip_math(once) == once

    @given(markdown_text)
    def test_strip_callout_markers_idempotent(self, text: str):
        once = strip_callout_markers(text)
        assert strip_callout_markers(once) == once

    @given(markdown_lines)
    def test_strip_quote_blocks_idempotent(self, text: str):
        once = strip_quote_blocks(text)
        assert strip_quote_blocks(once) == once


class TestQuoteLevel:
    @given(st.text(max_size=80))
    def test_quote_level_bounded_by_gt_count(self, line: str):
        level = get_quote_level(line)
        assert 0 <= level <= line.count(">")

    @given(
        st.integers(min_value=0, max_value=8),
        st.text(alphabet="ab c", max_size=20),
    )
    def test_quote_level_counts_leading_markers(self, n: int, rest: str):
        line = "> " * n + rest.lstrip(" >")
        assert get_quote_level(line) == n

    @given(st.text(max_size=80))
    def test_zero_level_iff_no_leading_marker(self, line: str):
        assert (get_quote_level(line) == 0) == (
            not line.lstrip(" ").startswith(">")
        )


class TestQuoteCalloutBlocks:
    @given(st.text(alphabet="abc \n", max_size=200))
    def test_text_without_callouts_untouched(self, text: str):
        assert strip_quote_blocks(text) == text

    @given(
        st.integers(min_value=1, max_value=4),
        st.lists(st.text(alphabet="ab c", max_size=20), min_size=1, max_size=5),
    )
    def test_quote_block_is_fully_blanked(self, level: int, body: list[str]):
        prefix = "> " * level
        block = [f"{prefix}[!quote] title"] + [prefix + line for line in body]
        text = "\n".join(["before"] + block + ["after"])
        stripped = strip_quote_blocks(text)
        lines = stripped.split("\n")
        assert lines[0] == "before"
        assert lines[-1] == "after"
        assert all(line == "" for line in lines[1:-1])

    @given(st.integers(min_value=1, max_value=4))
    def test_is_quote_callout_start_detects_generated(self, level: int):
        assert is_quote_callout_start("> " * level + "[!quote]")
        assert not is_quote_callout_start("> " * level + "[!note]")


class TestMutationKillers:
    """
    Deterministic examples for behavior the random generators rarely hit.

    Each anchors a specific detail that mutation testing showed was otherwise
    unverified (mutmut survivors on this module).
    """

    def test_quote_level_only_skips_plain_spaces(self):
        # tabs and other characters before ">" do not count as quoting
        assert get_quote_level("\t> a") == 0
        assert get_quote_level("X> a") == 0
        assert get_quote_level("  > a") == 1

    def test_strip_math_exact_delimiters(self):
        assert strip_math("$$x$$") == "$$ $$"
        assert strip_math("$x$") == "$ $"
        assert strip_math("$$a\nb$$") == "$$ \n $$"

    def test_strip_callout_markers_exact_blanking(self):
        marker = "[!note]"
        assert (
            strip_callout_markers(f"> {marker} hi")
            == f"> {' ' * len(marker)} hi"
        )
        nested = f"> > {marker}+ body"
        assert (
            strip_callout_markers(nested)
            == f"> > {' ' * (len(marker) + 1)} body"
        )

    def test_main_strips_files_from_default_source_dir(
        self,
        mock_git_root: Path,
        monkeypatch: pytest.MonkeyPatch,
        capsys,
    ):
        # main() must read from <git root>/website_content and write the
        # stripped copy into the output dir, not merely print the path
        content_dir = mock_git_root / "website_content"
        content_dir.mkdir()
        (content_dir / "t.md").write_text("a $x$ b", encoding="utf-8")
        # the fixture's MagicMock repo reports every file as gitignored;
        # substitute a plain directory walk so real files flow through
        monkeypatch.setattr(
            "scripts.utils.get_files",
            lambda dir_to_search, **_kwargs: tuple(dir_to_search.rglob("*.md")),
        )
        output = mock_git_root / "out"
        monkeypatch.setattr(
            "sys.argv",
            ["strip_for_spellcheck.py", "--output-dir", str(output)],
        )

        strip_for_spellcheck.main()

        assert (output / "t.md").read_text(encoding="utf-8") == "a $ $ b"
        assert str(output) in capsys.readouterr().out

    def test_create_stripped_directory_nested_dirs_and_temp_prefix(
        self, tmp_path: Path
    ):
        source = tmp_path / "src"
        (source / "a" / "b").mkdir(parents=True)
        (source / "a" / "b" / "f.md").write_text("$x$", encoding="utf-8")

        result = strip_for_spellcheck.create_stripped_directory(source)

        assert result.name.startswith("stripped_for_spellcheck_")
        assert (result / "a" / "b" / "f.md").read_text(
            encoding="utf-8"
        ) == "$ $"
        shutil.rmtree(result)

    def test_main_converts_explicit_source_dir_to_path(
        self,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
        capsys,
    ):
        source = tmp_path / "content"
        source.mkdir()
        (source / "f.md").write_text("$x$", encoding="utf-8")
        output = tmp_path / "out"
        monkeypatch.setattr(
            "sys.argv",
            [
                "strip_for_spellcheck.py",
                "--source-dir",
                str(source),
                "--output-dir",
                str(output),
            ],
        )

        strip_for_spellcheck.main()

        assert (output / "f.md").read_text(encoding="utf-8") == "$ $"
        assert str(output) in capsys.readouterr().out


class TestDropcap:
    @given(
        st.sampled_from(["span", "div"]),
        st.text(alphabet="abcdef", min_size=1, max_size=5),
        st.text(alphabet="abcdef ", max_size=20),
    )
    def test_dropcap_tag_collapses_to_inner_text(
        self, tag: str, inner: str, rest: str
    ):
        text = f'<{tag} class="dropcap">{inner}</{tag}>{rest}'
        assert strip_dropcap_tags(text) == inner + rest

    @given(st.text(alphabet="abc<>/ ", max_size=100))
    def test_text_without_dropcap_class_untouched(self, text: str):
        assert strip_dropcap_tags(text) == text
