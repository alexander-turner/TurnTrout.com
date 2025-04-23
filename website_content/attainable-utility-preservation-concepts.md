---
permalink: attainable-utility-preservation-concepts
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: 
  https://www.lesswrong.com/posts/75oMAADr4265AGK3L/attainable-utility-preservation-concepts
lw-is-question: "false"
lw-posted-at: 2020-02-17T05:20:09.567000Z
lw-last-modification: 2021-05-24T18:19:29.122000Z
lw-curation-date: None
lw-frontpage-date: 2020-02-17T06:30:53.270000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 20
lw-base-score: 38
lw-vote-count: 11
af-base-score: 17
af-num-comments-on-upload: 11
publish: true
title: "Attainable Utility Preservation: Concepts"
lw-latest-edit: 2020-02-17T05:22:28.687000Z
lw-is-linkpost: "false"
tags:
  - "impact-regularization"
  - "AI"
aliases:
  - "attainable-utility-preservation-concepts"
lw-sequence-title: "Reframing Impact"
lw-sequence-image-grid: sequencesgrid/izfzehxanx48hvf10lnl
lw-sequence-image-banner: sequences/zpia9omq0zfhpeyshvev
sequence-link: posts#reframing-impact
prev-post-slug: the-catastrophic-convergence-conjecture
prev-post-title: "The Catastrophic Convergence Conjecture"
next-post-slug: attainable-utility-preservation-empirical-results
next-post-title: "Attainable Utility Preservation: Empirical Results"
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2020-02-17 00:00:00
original_url: 
  https://www.lesswrong.com/posts/75oMAADr4265AGK3L/attainable-utility-preservation-concepts
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/KPv2beS.png
description: "Exploring the ideas behind Attainable Utility Preservation: penalize
  the AI for gaining power to bound its impact."
date_updated: 2024-12-05 16:17:06.041179
---





![](https://assets.turntrout.com/static/images/posts/hTnYTsJ.avif)

![](https://assets.turntrout.com/static/images/posts/gwVocUy.avif) ![](https://assets.turntrout.com/static/images/posts/KPv2beS.avif)

![](https://assets.turntrout.com/static/images/posts/MYNBKOe.avif)

![](https://assets.turntrout.com/static/images/posts/ZK2qYPZ.avif)

![](https://assets.turntrout.com/static/images/posts/lk8Keid.avif) ![](https://assets.turntrout.com/static/images/posts/kMBZK6d.avif) ![](https://assets.turntrout.com/static/images/posts/FXlUiYj.avif)

![](https://assets.turntrout.com/static/images/posts/hHVvk0Q.avif) ![](https://assets.turntrout.com/static/images/posts/3NMSHHl.avif) ![](https://assets.turntrout.com/static/images/posts/BtzHnUq.avif)

![](https://assets.turntrout.com/static/images/posts/MzW64A5.avif) ![](https://assets.turntrout.com/static/images/posts/mOWK65o.avif)

![](https://assets.turntrout.com/static/images/posts/VDQiChW.avif) ![](https://assets.turntrout.com/static/images/posts/jtxMXJe.avif)

![](https://assets.turntrout.com/static/images/posts/7KcMK3J.avif)

## Appendix: No free impact

What if we want the agent to single-handedly ensure the future is stable and aligned with our values? AUP probably won’t allow policies which actually accomplish this goal – one needs power to e.g. nip unaligned superintelligences in the bud. AUP aims to prevent catastrophes by stopping bad agents from gaining power to do bad things, but it symmetrically impedes otherwise-good agents.

This doesn’t mean we can’t get useful work out of agents – there are important asymmetries provided by both the main reward function and AU landscape counterfactuals.

First, even though we can’t specify an _aligned_ reward function, the provided reward function still gives the agent useful information about what we want. If we need paperclips, then a paperclip-AUP agent prefers policies which make some paperclips. Simple.

Second, if we don’t like what it’s beginning to do, we can shut it off (because it hasn’t gained power over us). Therefore, it has “approval incentives” which bias it towards AU landscapes in which its power hasn’t decreased too much, either.

So we can hope to build a non-catastrophic AUP agent and get useful work out of it. We just can’t directly ask it to solve all of our problems: it doesn’t make much sense to speak of a “low-impact [singleton](https://lesswrong.com/tag/singleton)”.

# Notes

- To emphasize, when I say "AUP agents do $X$" in this post, I mean that AUP agents correctly implementing the _concept of AUP_ tend to behave in a certain way.
- As [pointed out by Daniel Filan](https://www.lesswrong.com/posts/yEa7kwoMpsBgaBCgb/towards-a-new-impact-measure#jJrCTRwTZDZDc3XLx), AUP suggests that one might work better in groups by ensuring one's actions preserve teammates' AUs.
