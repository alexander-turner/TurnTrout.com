---
permalink: how-to-dissolve-it
lw-was-draft-post: 'false'
lw-is-af: 'false'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/argvWNNHZAz2MeM8C/how-to-dissolve-it
lw-is-question: 'false'
lw-posted-at: 2018-03-07T06:19:22.923000Z
lw-last-modification: None
lw-curation-date: None
lw-frontpage-date: None
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 6
lw-base-score: 24
lw-vote-count: 18
af-base-score: 9
af-num-comments-on-upload: 0
title: How to Dissolve It
lw-latest-edit: 2018-03-07T06:19:22.923000Z
lw-is-linkpost: 'false'
tags:
  - rationality
  - practical
aliases:
  - how-to-dissolve-it
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2018-03-07 00:00:00
original_url: https://www.lesswrong.com/posts/argvWNNHZAz2MeM8C/how-to-dissolve-it
skip_import: true
description: Dissolving technical problems by visualizing ideal solutions and then
  working backwards.
date_updated: 2025-11-22 00:21:52.667251
---








In the last month and a half, I've had more (of what I believe to be) profound, creative insights to technical problems than in the five years prior. For example, I independently came up with the core insight behind [DenseNets](https://arxiv.org/abs/1608.06993) during the second lecture on convolutional neural nets in my Deep Learning class. I've noticed that these insights occur as byproducts of _good processes_ and having a _conducive mindset and physiology_ at that point in time. I'm going to focus on the former in this post.

# End in Mind

Often, when I'm confused about a technical problem, I realize that I don't even know what a solution would look like. Sure, I could verify a solution if one were handed to me on a platter, but in these situations, I generally lack a detailed mental model of how I'd want a solution to behave. This may sound rather obvious once brought to your attention, but I'd like to emphasize how easy it is to spend hours in murky, muddled, pattern-matching gradient descent, mindlessly tweaking the first ideas that came to you.

Incredibly, generating a detailed solution model is often enough to quickly resolve (or at least reduce) even formidable-seeming problems.

# Backward Chaining

The aforementioned process is [backward chaining](https://en.wikipedia.org/wiki/Backward_chaining). This contrasts with forward chaining, which involves working forward from what you currently have. Take the time to _actually visualize_ what a solution to the problem would look like. How would it behave in response to different inputs? Are you offloading all of the work onto a weasel word (like "emergence")?

When you're done, map-territory confusions should be ironed out, it should be clear whether current approaches _truly_ _tackle the core issue_ or just something similar-looking, and black-box terms should be disintegrated. If you can't do this, you probably can't solve the problem yet - you should spend more time working on your understanding. I encourage you to read this multiple times - the bulk of this post's value resides in this section.

For example, yesterday I thought about a smaller problem for about 15 minutes, and had nothing to show for it. I almost resigned to asking a more mathematically experienced friend if he had any ideas, but instead forced myself to go through the above process. The answer was immediately obvious.

In my experience, proper solution formulations are accompanied by a satisfying mental "click." Upon clicking, you eagerly chase down all the freshly exposed avenues of attack. Push the frontier of new understanding as far as it will go, repeat the process when you notice your thought process again becoming muddled, think with paper if the problem is complicated, and enjoy the rush.

# Qualia of Discovery

I can't impart to you the exact feeling of using this technique properly, but I can make its fruits concrete by selecting a few things I've dissolved recently:

- I've observed  $k$ samples from a normal distribution and recorded the mean and variance. New observations are going to come in, and I want to be able to assign some scalar  $c \in [-1,1]$ quantifying how unusual this looks for the distribution.
- A binary classifier has observed a bunch of "dog" pictures, and we want it to be able to robustly communicate when it sees something new - knowing what it doesn't know.
- I'm a reinforcement-learning agent named <span class="corrupted">redacted</span>, and I'd love to fetch things from other parts of your house for you - as quickly as possible.
