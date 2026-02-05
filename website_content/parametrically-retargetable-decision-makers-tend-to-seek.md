---
permalink: parametrically-retargetable-power-seeking
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/GY49CKBkEs3bEpteM/parametrically-retargetable-decision-makers-tend-to-seek
lw-linkpost-url: https://arxiv.org/abs/2206.13477
lw-is-question: 'false'
lw-posted-at: 2023-02-18T18:41:38.740000Z
lw-last-modification: 2023-10-31T21:49:45.530000Z
lw-curation-date: None
lw-frontpage-date: 2023-02-18T19:26:40.220000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 10
lw-base-score: 172
lw-vote-count: 61
af-base-score: 68
af-num-comments-on-upload: 4
title: Parametrically retargetable decision-makers tend to seek power
lw-latest-edit: 2023-02-21T17:23:07.903000Z
lw-is-linkpost: 'true'
tags:
  - AI
  - instrumental-convergence
aliases:
  - parametrically-retargetable-decision-makers-tend-to-seek
lw-sequence-title: The Causes of Power-seeking and Instrumental Convergence
lw-sequence-image-grid: sequencesgrid/hawnw9czray8awc74rnl
lw-sequence-image-banner: sequences/qb8zq6qeizk7inc3gk2e
sequence-link: posts#the-causes-of-power-seeking-and-instrumental-convergence
prev-post-slug: instrumental-convergence-for-realistic-agent-objectives
prev-post-title: Instrumental Convergence For Realistic Agent Objectives
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2023-02-18 00:00:00
original_url: 
  https://www.lesswrong.com/posts/GY49CKBkEs3bEpteM/parametrically-retargetable-decision-makers-tend-to-seek
skip_import: true
description: "New theoretical results uncover a surprising truth: the ability to change
  an agent's goals can lead them to seek power."
date_updated: 2025-11-22 00:21:52.667251
---







[This paper](https://arxiv.org/abs/2206.13477)—accepted as a poster to NeurIPS 2022— is the sequel to [Optimal Policies Tend to Seek Power](https://arxiv.org/abs/1912.01683). The new theoretical results are extremely broad, discarding the requirements of full observability, optimal policies, or even requiring a finite number of options.

> [!quote] The paper's abstract
>
> If capable AI agents are generally incentivized to seek power in service of the objectives we specify for them, then these systems will pose enormous risks, in addition to enormous benefits. In fully observable environments, most reward functions have an optimal policy which seeks power by keeping options open and staying alive. However, the real world is neither fully observable, nor must trained agents be even approximately reward-optimal.
>
> We consider a range of models of AI decision-making, from optimal, to random, to choices informed by learning and interacting with an environment. We discover that many decision-making functions are retargetable, and that retargetability is sufficient to cause power-seeking tendencies. Our functional criterion is simple and broad.
>
> We show that a range of qualitatively dissimilar decision-making procedures incentivize agents to seek power. We demonstrate the flexibility of our results by reasoning about learned policy incentives in Montezuma's Revenge. These results suggest a safety risk: Eventually, retargetable training procedures may train real-world agents which seek power over humans.

Examples of agent designs the power-seeking theorems now apply to:

- Boltzmann-rational agents,
- Expected utility maximizers and minimizers,
  - Even if they uniformly randomly sample a few plans and then choose the best sampled

- Satisficers (as I formalized them),
- [Quantilizing](https://intelligence.org/files/QuantilizersSaferAlternative.pdf) with a uniform prior over plans, and
- RL-trained agents under certain modeling assumptions.

The key insight is that the original results hinge not on optimality per se, but on the [retargetability](/satisficers-tend-to-seek-power) of the policy-generation process via a reward or utility function or some other parameter. See [Satisficers Tend To Seek Power: Instrumental Convergence Via Retargetability](/satisficers-tend-to-seek-power) for intuitions and illustrations.

# Why am I only now posting this?

First, I've been way more excited about [shard theory](/shard-theory). I still think these theorems are really cool, though.

Second, I think the results in this paper are informative about the default incentives for decision-makers which "care about things." i.e. make decisions on the basis of e.g. how many diamonds that decision leads to, or how many paperclips, and so on. However, I think that conventional accounts and worries around "utility maximization" are subtly misguided. Whenever I imagined posting this paper, I felt like "ugh sharing this result will just make it worse." I'm not looking to litigate that concern right now, but I do want to flag it.

Third, [Optimal Policies Tend to Seek Power](https://arxiv.org/abs/1912.01683) makes the ["reward is the optimization target"](/reward-is-not-the-optimization-target) mistake _super strongly_. [Parametrically retargetable decision-makers tend to seek power](https://arxiv.org/abs/2206.13477) makes the mistake less hard, both because it discusses utility functions and learned policies instead of optimal policies, and also thanks to edits I've made since realizing my optimization-target mistake.

# Conclusion

This paper isolates the key mechanism—retargetability—which enables the results in [Optimal Policies Tend to Seek Power](https://arxiv.org/abs/1912.01683). This paper also takes healthy steps away from the optimal policy regime (which I consider to be misleading as an alignment frame) and lays out a bunch of theory I found—and still find—beautiful.

This paper is both published in a top-tier conference and, unlike the previous paper, actually has a shot of being applicable to realistic agents and training processes. Therefore, compared to the original[^1] optimal policy paper, I think this paper is better for communicating concerns about power-seeking to the broader ML world.

[^1]: I've since updated the optimal policy paper with disclaimers about [Reward is not the optimization target](/reward-is-not-the-optimization-target), so the updated version is at least passable in this regard. I still like the first paper, am proud of it, and think it was well-written within its scope. It also takes a more doomy tone about AGI risk, which seems good to me.[^retract]

[^retract]: As of September 2024, I no longer feel that doomy about technical AGI alignment. More concretely, I estimate
    $$
    \mathbb{P}(\text{AI kills >1bn people by 2050}) \approx 15\%,
    $$
    where most of that probability comes from "misuse" risk.
