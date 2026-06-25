---
title: Matchcolor fixture
permalink: search-color-fixture
no_dropcap: "true"
tags:
  - website
description: Stable fixture for the search-highlight color-invariant test in `search.spec.ts`. No screenshot test targets this page, so editing it never churns visual baselines.
hideSubscriptionLinks: true
date_published: 2024-12-04
date_updated: 2024-12-04
---

This page exists only so `search.spec.ts` can assert that highlighted search matches keep one color across every element type. The coined word "Matchcolor" is unique in the corpus, so searching it deterministically returns this page and highlights the word in the body, a heading, and an admonition title.

# Matchcolor heading

> [!quote] Matchcolor quote
> A quote admonition whose title contains the searched word, exercising the
> admonition-title case that previously clobbered the highlight color.
