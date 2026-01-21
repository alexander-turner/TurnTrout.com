---
permalink: lower-stakes-alignment-scenario
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/sunXMY5WyDcrHsNRr/a-world-in-which-the-alignment-problem-seems-lower-stakes
lw-is-question: 'false'
lw-posted-at: 2021-07-08T02:31:03.674000Z
lw-last-modification: 2021-07-08T20:36:20.299000Z
lw-curation-date: None
lw-frontpage-date: 2021-07-08T05:28:16.796000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 17
lw-base-score: 20
lw-vote-count: 9
af-base-score: 8
af-num-comments-on-upload: 8
title: A world in which the alignment problem seems lower-stakes
lw-latest-edit: 2021-07-08T15:16:27.530000Z
lw-is-linkpost: 'false'
tags:
  - instrumental-convergence
  - AI
aliases:
  - a-world-in-which-the-alignment-problem-seems-lower-stakes
lw-sequence-title: The Causes of Power-seeking and Instrumental Convergence
lw-sequence-image-grid: sequencesgrid/hawnw9czray8awc74rnl
lw-sequence-image-banner: sequences/qb8zq6qeizk7inc3gk2e
sequence-link: posts#the-causes-of-power-seeking-and-instrumental-convergence
prev-post-slug: environmental-structure-can-cause-instrumental-convergence
prev-post-title: Environmental Structure Can Cause Instrumental Convergence
next-post-slug: quantitative-strength-of-instrumental-convergence
next-post-title: The More Power At Stake, The Stronger Instrumental Convergence Gets
  For Optimal Policies
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2021-07-08 00:00:00
original_url: 
  https://www.lesswrong.com/posts/sunXMY5WyDcrHsNRr/a-world-in-which-the-alignment-problem-seems-lower-stakes
skip_import: true
description: "This post explores a hypothetical scenario where the AI alignment problem
  seems lower-stakes due to a unique universe structure. "
date_updated: 2025-11-22 00:21:52.667251
---








The danger from power-seeking is not _intrinsic_ to the alignment problem. This danger also depends on [the structure of the agent's environment](/environmental-structure-can-cause-instrumental-convergence).

In [_The Catastrophic Convergence Conjecture_](/the-catastrophic-convergence-conjecture), I wrote:

!["What happens when agents seek pure control over the future? Not everyone can be king. If you're just seeking power without concern for others, you tend to push others down after a certain point. And most goals don't have concern for others. You'll just compete for resources." Below, a "paperclip maximizer" robot punches a "staple maximizer" robot.](https://assets.turntrout.com/static/images/posts/OsWS97b.avif)![A hand-drawn illustration shows two robots on opposite sides of a green planet. Text reads: "It may take a while for power-seekers to come into conflict. But they will. They don't hate each other; they're just in each other's way."](https://assets.turntrout.com/static/images/posts/d057729cc125ff7e4c1a99e1fab5c7936fb5cef537b9d02b.avif)

Are there worlds where this isn't true? Consider a world where you supply a utility-maximizing AGI with a utility function.

![A universe divided by a jagged line into two halves. The "Left half" contains a person on Earth, and the "Right half" contains a robot on a planet. Text below the line reads "No interaction," indicating the two halves are causally separate.](https://assets.turntrout.com/static/images/posts/46b8706e0cfb81c5b9f90c9d8918201750ba1468a9065979.avif)
<br/>Figure: The AGI is in a "separate part of the universe"; after the initial specification of the utility function, the left half of the universe evolves independently of the right half. Nothing you can do after specification can affect the AGI's half, and vice versa. No communication can take place between the two halves.

The only information you have about the other half is your utility. For simplicity, let's suppose you and the AGI have utility functions over universe-histories which are additive across the halves of the universe. You don't observe any utility information about the other part of the universe until the end of time, and vice versa for the AGI. That is, for history $h$:

$$
u_\text{human}(h) = u_\text{human}(h_\text{left})+u_\text{human}(h_\text{right}).
$$
If the AGI uses something like causal decision theory, then it won't try to kill you, or "seek power" over you. The effects of its actions have no causal influence over what happens in your half of the universe. Your universe's evolution adds a constant term to its expected utility.

> [!note]
> Other decision theories might have the AGI precommit to minimizing human utility unless it attains maximal AGI-utility from the left half of the universe-history, or some other shenanigans. This precommitment isn't relevant to the point I want to make in this post, but it's important to consider.

However, the setup is still interesting because:

1. [Goodhart's law](https://www.lesswrong.com/posts/EbFABnst8LsidYs5Y/goodhart-taxonomy) still applies: if you give the AGI an incomplete proxy objective, you'll get suboptimal true performance.
2. [Value is still complex](https://www.lesswrong.com/tag/complexity-of-value): it's still hard to get the AGI to optimize the right half of the universe for human flourishing.
3. If the AGI is autonomously trained via stochastic gradient descent in the right half of the universe, then we may still hit [inner alignment problems](https://www.lesswrong.com/tag/mesa-optimization).

Alignment is still _hard_, and we still _want_ to get the AGI to do good things on its half of the universe. But it isn't instrumentally convergent for the AGI to seek power over _you,_ and so you shouldn't expect an unaligned AGI to try to kill _you_ in this universe. You shouldn't expect the AGI to kill other humans, either, since none exist in the right half of the universe - and it won't create any, either.

To restate: Bostrom's [original instrumental convergence thesis](https://www.nickbostrom.com/superintelligentwill.pdf) needs to be applied carefully. The danger from power-seeking is not _intrinsic_ to the alignment problem. This danger also depends on [the structure of the agent's environment](/environmental-structure-can-cause-instrumental-convergence). I think I sometimes bump into reasoning that feels like "instrumental convergence, smart AI, & humans exist in the universe → bad things happen to us / the AI finds a way to hurt us"; I think this is usually true, but not necessarily true, and so this extreme example illustrates how the implication can fail.

> [!thanks]
>Thanks to John Wentworth for feedback on this post. Edited to clarify the broader point I'm making.
