---
title: Highlighted quotation fixture
permalink: search-color-fixture
no_dropcap: "true"
tags:
  - website
description: Stable fixture for the search-highlight color-invariant test in `search.spec.ts`. No screenshot test targets this page, so editing it never churns visual baselines.
hideSubscriptionLinks: true
date_published: 2024-12-04
date_updated: 2024-12-04
---

This page exists only so `search.spec.ts` can assert that highlighted search matches keep one color across every element type. Its unique title phrase deterministically returns this page, and the word "quotation" appears in the body, a heading, and an admonition title so the search highlights all three.

# Quotation heading

> [!quote] Quotation title
> A quote admonition whose title contains the searched word, exercising the
> admonition-title case that previously clobbered the highlight color.
