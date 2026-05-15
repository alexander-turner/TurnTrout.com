---
title: Searchpreviewfixture rendering surface
permalink: search-fixture
no_dropcap: "true"
tags:
  - website
description: Stable fixture page used by search-preview visual regression tests in `search.spec.ts`. Modify only when intentionally updating a search-preview baseline.
hideSubscriptionLinks: true
date_published: 2024-12-04
date_updated: 2024-12-04
---

This page is the search-preview target for the visual regression tests in `search.spec.ts`. The unique title token `searchpreviewfixture` deterministically returns this page for the test queries, so editing the body changes every search-preview screenshot that lands here.

The fixture lives outside the live site (see `RemoveFixtures` filter), so no user-facing search references it.

# Admonitions

> [!note]
> A short note admonition for the focused mobile-card-preview screenshot.

> [!quote]
> A second admonition.

# Checkboxes

1. [ ] Fixture checkbox at `#checkbox-0`
2. [ ] Second fixture checkbox

A simple sentence with a basic footnote.[^backref] A second sentence with a footnote that contains a table.[^table]

[^backref]: A short footnote whose backref arrow anchors the back-arrow screenshot.

[^table]:

    | Col A | Col B | Col C |
    | :---: | :---: | :---: |
    |   1   |   2   |   3   |
    |   4   |   5   |   6   |
