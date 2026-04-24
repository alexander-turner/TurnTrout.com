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

Per-image context is high-value
-------------------------------
``async_extract_batch`` now takes a ``context_for`` callback. Pass it a
function that returns the image's **alt text plus the surrounding
paragraph** for each URL — this string is injected into the chart prompt
under "Surrounding prose (for disambiguating labels)". Alt text alone
is often the most compact signal available ("Three line charts comparing
four unlearning methods — ERA, Data filtering, RMU, and DEMIX + ablate")
and dramatically improves series-name fidelity. The surrounding
paragraph adds units, axis semantics, and references to annotations.

Skeleton::

    def _context_for(url: str) -> str | None:
        qi: QueueItem = queue_by_url[str(url)]
        alt = qi.alt_text or ""
        prose = alt_text_llm.utils.generate_article_context(qi, max_after=2)
        return f"Alt text: {alt}\n\nSurrounding prose:\n{prose}" if alt or prose else None

    await async_extract_batch(urls, model=MODEL, context_for=_context_for)

Decided design
--------------
1. **Chart-detection: vision-model classifier, not keyword scan.**
   For each image-ref discovered in ``website_content/``, call the best
   available vision model with a yes/no prompt built by concatenating
   ``scripts.chart_extract.SUPPORTED_CHART_TYPES`` into the prompt::

       from scripts.chart_extract import SUPPORTED_CHART_TYPES
       types_csv = ", ".join(SUPPORTED_CHART_TYPES)
       prompt = (
           f"Is this image a chart of one of these supported kinds: "
           f"{types_csv}? Answer exactly YES or NO."
       )

   When ``SUPPORTED_CHART_TYPES`` grows (bar, scatter, etc.) the
   classifier follows automatically. Pass the same alt-text / surrounding
   prose context used by ``chart_extract`` so the classifier isn't judging
   from pixels alone. Use the most capable vision model (opus-class) —
   the classifier runs once per image ever, so cost ceiling is bounded
   and precision matters more than $/call.

2. **Replacement strategy: proposed-replacements sidecar, git-ignored.**
   For each successfully converted chart, write the new block to
   ``<post>.proposed-replacements.md`` next to the original ``<post>.md``.
   ``.gitignore`` excludes ``*.proposed-replacements.md`` — these are
   scratch files for review. The user diffs the sidecar against the
   original, hand-merges, and the sidecar can be deleted after.

   (Do NOT in-place edit the ``.md`` files. 100 posts is too many to
   review blind.)

3. **Failure handling.** An image that fails extraction stays as the
   original ``![alt](url)`` and is recorded in the queue for retry. The
   existing ``chart_extract.write_results`` dedupe-by-source handles
   resumption.

4. **Concurrency.** Reuse ``chart_extract.async_extract_batch``'s
   semaphore of 8. Batching across posts (not within) is natural.

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
All four design questions are decided above. Next Claude Code session
should open this file and implement. 100% line coverage is the house
rule per ``CLAUDE.md``.
"""

if __name__ == "__main__":
    raise NotImplementedError(
        "convert_existing_graphs.py is a design doc stub — see module docstring. "
        "Open it, decide the four design questions, and implement."
    )
