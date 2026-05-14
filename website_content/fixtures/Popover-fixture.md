---
title: Popover content fixture
permalink: popover-fixture
no_dropcap: "true"
tags:
  - website
description: Stable fixture page used by the popover visual regression test. Modify only when intentionally updating the popover baseline.
hideSubscriptionLinks: true
date_published: 2024-12-04
date_updated: 2024-12-04
---

# Popover content fixture

This page is the hover target for the link-popover visual regression test in `popover.spec.ts`. Editing it will move every popover screenshot that fetches this page, so leave the body alone unless you are updating the baseline on purpose.

## Anchor target

A second paragraph gives the popover enough vertical content to exercise its frame proportions without depending on any other page's churn. The dummy link in `Test-page.md` points to the heading above so the popover-scroll-to-hash test has a deterministic target.

## Rich-content footnote

This sentence anchors the rich-content footnote popover screenshot.[^rich]

[^rich]:
    Here's the detail, in a footnote. And here's a nested footnote.[^nested-fixture]

    > [!note] Admonition in a footnote
    >
    > Here be an admonition in a footnote.

[^nested-fixture]: I'm a nested footnote. I'm enjoying my nest! 🪺
