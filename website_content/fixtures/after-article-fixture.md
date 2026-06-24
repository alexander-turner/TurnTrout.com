---
title: After-article fixture
permalink: after-article-fixture
no_dropcap: "true"
tags:
  - website
description: Stable fixture page used by the after-article visual regression test. Modify only when intentionally updating the after-article baseline.
date_published: 2024-12-04
date_updated: 2024-12-04
lw-sequence-title: Reframing Impact
sequence-link: posts#reframing-impact
prev-post-slug: world-state-is-the-wrong-abstraction-for-impact
prev-post-title: World State is the Wrong Abstraction for Impact
next-post-slug: seeking-power-is-often-convergently-instrumental-in-mdps
next-post-title: Seeking Power is Often Convergently Instrumental in MDPs
---

This page backs the after-article visual regression test in `afterArticle.spec.ts`. It carries the sequence frontmatter (`lw-sequence-title`, `prev-post-slug`, `next-post-slug`) needed to render the `.sequence-links` navigation, and it leaves `hideSubscriptionLinks` unset so the `#subscription-and-contact` box renders too. Editing it moves the after-article screenshot baseline, so leave the body alone unless you are updating the baseline on purpose.

The screenshot captures the `.after-article-components` wrapper, so the test locks in the vertical spacing between the subscription box and the sequence-links block that follows it.
