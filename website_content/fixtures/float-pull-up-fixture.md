---
title: Float pull-up fixture
permalink: float-pull-up-fixture
no_dropcap: "true"
tags:
  - website
description: Stable fixture with a float-desktop-pull-up testimonial, used by floatPullUp.spec.ts to check popovers and search previews.
hideSubscriptionLinks: true
date_published: 2026-07-14
date_updated: 2026-07-14
---

This page anchors the float pull-up regression tests in `floatPullUp.spec.ts`. The quote admonition below mirrors the testimonial layout on `/team-shard`: a floated image with the desktop pull-up inside a callout. The word "Quotesmith" is the unique search token the spec uses to surface this page in the search preview.

> [!quote] Quotesmith Fixture
> Subtitle: MATS 0.0, [Gradient Routing](/gradient-routing)
>
> ![[https://assets.turntrout.com/static/images/posts/team-shard-12222025-4.avif|A young man in a dress shirt smiles at the camera.]]{.float-right .float-desktop-pull-up}
>
> This testimonial exists so the pull-up geometry test has deterministic content. The paragraph is long enough to wrap beside the floated image at every tested container width, which lets the spec measure whether the image ever covers the title or subtitle above it.
