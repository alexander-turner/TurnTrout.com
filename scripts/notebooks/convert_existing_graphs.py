"""
DESIGN DOC / STUB — `convert_existing_graphs.py`.

Status: **not implemented**. This file captures the scope and
intended shape so the next session can pick it up without re-deriving
the requirements.

Goal
----
Bulk-convert the ~100 chart-image references currently scattered across
``website_content/*.md`` (nearly all ``https://assets.turntrout.com/...avif``)
into inline ``chart`` YAML blocks backed by CSV sidecars — the pipeline
established by ``scripts/chart_extract.py`` and the `data: <path>`
renderer support (see ``NEXT-STEPS.md``).

Today, ``chart_extract.py`` is invoked one image at a time. Real backfill
needs a driver that:

1. Walks ``website_content/`` looking for image refs whose ALT text or
   surrounding prose suggests a chart (`"graph"`, `"plot"`, `"line
   chart"`, `"loss curve"`, etc.).
2. Excludes image refs that are clearly NOT charts (logos, headshots,
   screenshots of prose, diagrams-not-plots).
3. Enqueues survivors for ``chart_extract.py``.
4. On success: writes the CSV sidecar alongside the ``.md`` file and
   replaces the ``![alt](url)`` line with the paste-ready ```chart block.
5. Is resumable (queue file shape already supported by
   ``scripts/chart_extract.py`` — one JSON list, keyed by source URL).

Why this is a separate file from ``chart_extract.py``
-----------------------------------------------------
``chart_extract.py`` is the low-level "one image in, CSV+block out" unit;
this driver is the high-level "iterate the whole site" orchestration.
Keeping them separate lets the unit stay simple and lets the driver
change its discovery/filtering heuristics without touching extraction.

Scaffolding we can reuse
------------------------
- ``alt_text_llm.scan.QueueItem`` — already parses Markdown files for
  image refs with line numbers and paragraph context. Not currently a
  direct dependency of this repo (``alt-text-llm`` is installed as a
  ``uv tool``, not a lib dep), so either:

  (a) re-add ``alt-text-llm`` to ``pyproject.toml`` as a lib dep for the
      ``scan`` module, OR
  (b) copy its ~150 lines of Markdown+image parsing logic here — it's
      small and stable.

  (a) is less duplication; (b) avoids tying the build to an external
  package's release cadence. Lean toward (a) unless the coupling becomes
  painful.

- ``scripts/chart_extract.extract_chart`` — call it per queue item.
  Already handles URL downloads (item 8, done) and TS round-trip
  validation (item 6, done).

- ``alt_text_llm.utils.generate_article_context`` — produces the
  surrounding-paragraph context string that the chart prompt appends to
  aid disambiguation. Only used if we go with (a) above.

Open design questions (decide before implementing)
--------------------------------------------------
1. **Chart-detection heuristic.** Possibilities:
   - Keyword scan on alt text / surrounding prose ("chart", "graph",
     "plot", "loss", "accuracy", "curve"). Cheap; plenty of false
     negatives.
   - First-pass vision model call (e.g. Gemini flash-lite) with a
     "is this a line chart?" yes/no prompt. Expensive; high precision.
   - Author-tagged opt-in: add a ``# convert-to-chart`` HTML comment in
     the Markdown next to charts you want converted. Trades setup effort
     for full control.
   Recommend: keyword scan + manual review queue. The driver writes an
   ``unsure.json`` of "might be a chart but unclear" images, and you
   hand-triage rather than pay for vision calls on non-charts.

2. **Replacement strategy.** Options:
   - In-place edit the ``.md`` file: delete the ``![alt](url)`` line,
     insert the ``` ```chart``` block.
   - Write the replacement to a `.proposed-replacements.md` sibling file
     for manual review, then the user diffs and merges.
   Recommend: proposed-replacements first. Bulk in-place edits on 100+
   posts are hard to review; a sidecar file is easier to diff and
   revert.

3. **Failure handling.** An image that fails extraction (bad
   extraction, LLM rate-limited, validator rejected) should stay as the
   original ``![alt](url)`` and be recorded in the queue for retry. The
   existing ``chart_extract.write_results`` dedupe-by-source handles
   this.

4. **Concurrency.** ``chart_extract.async_extract_batch`` already uses a
   semaphore of 8. Reusing that is probably right; batching across posts
   rather than within would be natural.

Proposed CLI shape
------------------
::

    uv run python scripts/notebooks/convert_existing_graphs.py \\
        --content-dir website_content \\
        --model claude-sonnet-4-6 \\
        --queue chart-backfill-queue.json \\
        --output-mode proposed   # or `in-place`
        --dry-run                # discover only, don't call LLM

Expected size
-------------
Implementation is probably 200-300 lines. Mostly: walk files, apply
heuristic, call ``chart_extract.async_extract_batch``, write the
replacement ``.proposed-replacements.md`` sibling.

Tests
-----
- Heuristic regex matches / skips (parametrized ``it.each``-style)
- File walker finds expected image refs (tempdir with hand-crafted
  ``.md`` fixtures)
- Mock ``extract_chart`` to return fake successes/failures; verify the
  proposed-replacement output and the queue state
- Resumption: second run skips images already in the queue

Handoff
-------
Next Claude Code session should open this file, decide questions 1-4
above (preferably asking alex), and then implement. 100% line coverage
is the house rule per ``CLAUDE.md``.
"""

if __name__ == "__main__":
    raise NotImplementedError(
        "convert_existing_graphs.py is a design doc stub — see module docstring. "
        "Open it, decide the four design questions, and implement."
    )
