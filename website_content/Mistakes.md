---
title: Mistaken claims I've made
permalink: mistakes
publish: true
draft: false
no_dropcap: "true"
tags:
  - website
  - personal
description: A list of some of my major conceptual mistakes.
date-published:
authors: Alex Turner
hideSubscriptionLinks: false
card_image:
date_published: 2024-10-31 23:14:34.832290
date_updated: 2025-03-05 20:43:54.692493
---


Inspired by Scott Alexander's [Mistakes](https://www.astralcodexten.com/p/mistakes) page:

> [!quote] Scott Alexander
> I don't promise never to make mistakes. But if I get something significantly wrong, I'll try to put it here as an acknowledgement and an aid for anyone trying to assess my credibility later.

# Not realizing that reward is not the optimization target

Subtitle: July 25, 2022
I spent thousands of hours proving theorems about the "tendencies" of "reinforcement learning" agents which are either [optimal](https://arxiv.org/abs/1912.01683) or [trained using a "good enough" learning algorithm](/parametrically-retargetable-power-seeking). (I'm using scare quotes to mark undue connotations.) I later realized that [reward is not the optimization target](/reward-is-not-the-optimization-target). I learned that even though ["reward" is a pleasant word](/dangers-of-suggestive-terminology), it's _definitely not a slam dunk that RL-trained policies will seek to optimize that quantity._ Reward often simply provides a per-datapoint learning rate multiplier - nothing spooky or fundamentally doomed.

While the realization may seem simple or obvious, it opened up a crack in my alignment worldview.

# Mispredicting the 2024 US presidential election

Subtitle: November 5, 2024

<iframe src="https://fatebook.io/embed/q/kamala-wins--cm34x28gv00004svvk2d1zvaz?compact=true&requireSignIn=false" width="450" height="200"></iframe>

I read too much into the [shock Seltzer poll which showed Harris +3](https://www.desmoinesregister.com/story/news/politics/iowa-poll/2024/11/02/iowa-poll-kamala-harris-leads-donald-trump-2024-presidential-race/75354033007/). At one point before the polls closed, my credence even reached 80% - driven by observations of unusually high turnout, which historically was a good sign for Democrats.

At least, I _thought_ that high turnout -> higher chance that Democrats win. But as I looked up a link to justify that claim, I found that it's actually not true! According to [National Affairs](https://www.nationalaffairs.com/publications/detail/does-high-voter-turnout-help-one-party):

![](https://assets.turntrout.com/static/images/posts/presidential_vote_share.avif)

Figure: The $y$-axis represents Democrat vote share. There's not much of a correlation, especially after tossing out the 1964 election.

To do better, I should have anchored more strongly to base rates via current polling, especially around the economy. On a meta-level, I didn't realize how much of a news bubble I was in. The media I read portrayed Trump as low-energy & barely filling out his rallies. I'll check out a wider variety of sources in the future, perhaps via e.g. [Ground News](https://ground.news/bias-bar).

# Wrongly expecting steering vectors to improve the general truthfulness of models

Subtitle: January 30, 2025

In 2023, [I (re?)discovered _steering vectors_](/research#steering-vectors): activation vectors which steer AI outputs to be e.g. more or less friendly ("Look Ma, no prompts!"). The way I saw it, model behavior was determined by two main factors: the abilities and "conversational modes" the model has learned ("[shards](/research#shard-theory)") and which shards are activated by the current situation.[^steering] Clearly - I thought - the model's "truthful mode" isn't always strongly activated. Clearly - I thought - one could more strongly activate that mode, possibly with a "be truthful" steering vector.

> [!quote] [Steering Gemini Using BIDPO Vectors](/gemini-steering)
> A while back, we explored the [“BIDPO”](https://arxiv.org/abs/2406.00045) method for training [steering vectors.](https://arxiv.org/abs/2308.10248) In Gemini 1.5v1 Flash and Pro, bidpo steering vectors boosted TruthfulQA scores by >10% while mostly retaining capabilities. When we [updated to Gemini 1.5v2,](https://developers.googleblog.com/en/updated-gemini-models-reduced-15-pro-pricing-increased-rate-limits-and-more/) prompt-based steering baselines became significantly stronger. BIDPO did not beat the stronger baselines, ending the project.

I'm not sure how, exactly, to change my beliefs. The result is slight negative evidence against both shard theory and (relatedly) against my understanding (circa 2024) of how models work.

> [!quote] [My description of the emotional experience of being wrong here](https://www.lesswrong.com/posts/WqjkqrEyFDXoHzz9K/steering-gemini-with-bidpo?commentId=AtX9Hf2fy4wNona6q)
> I remember right when the negative results started hitting. I could feel the cope rising. I recognized the pattern, the straining against truth. I queried myself for what I found most painful - it was actually just losing a bet. I forced the words out of my mouth: "I guess I was wrong to be excited about this particular research direction. And Ryan Greenblatt was more right than I was about this matter."  
>
>  After that, it was all easier. What was there to be afraid of? I'd already admitted it!

While steering vectors have their uses, "benchmark climbing" does not seem to be one of those uses.

[^steering]: After all, [I came up with the "cheese" steering vector because I was trying to change the "activation strength" of the agent's "cheese-seeking shard".](/cheese-vector)
