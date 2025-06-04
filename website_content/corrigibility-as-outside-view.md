---
permalink: corrigibility-as-outside-view
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/BMj6uMuyBidrdZkiD/corrigibility-as-outside-view
lw-is-question: 'false'
lw-posted-at: 2020-05-08T21:56:17.548000Z
lw-last-modification: 2020-05-12T17:22:13.579000Z
lw-curation-date: None
lw-frontpage-date: 2020-05-09T02:39:09.512000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 11
lw-base-score: 36
lw-vote-count: 15
af-base-score: 19
af-num-comments-on-upload: 10
publish: true
title: Corrigibility as outside view
lw-latest-edit: 2020-05-12T17:22:13.849000Z
lw-is-linkpost: 'false'
tags:
  - corrigibility
  - AI
aliases:
  - corrigibility-as-outside-view
lw-sequence-title: Thoughts on Corrigibility
lw-sequence-image-grid: sequencesgrid/yuauvyzko4ttusbzpkkz
lw-sequence-image-banner: sequences/ww73ub24plfayownucjk
sequence-link: posts#thoughts-on-corrigibility
prev-post-slug: non-obstruction-motivates-corrigibility
prev-post-title: 'Non-Obstruction: A Simple Concept Motivating Corrigibility'
next-post-slug: a-certain-formalization-of-corrigibility-is-vnm-incoherent
next-post-title: A Certain Formalization of Corrigibility Is VNM-Incoherent
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2020-05-08 00:00:00
original_url: https://www.lesswrong.com/posts/BMj6uMuyBidrdZkiD/corrigibility-as-outside-view
skip_import: true
description: Corrigibility may emerge when AI recognizes its flaws by simulating its
  own decision-making and defers to human judgment when appropriate.
date_updated: 2025-06-03 22:57:00.423836
---







You run a country. One day, you think "I could help so many more people if I set all the rules... and I could make this happen". As far as you can tell, this is the _real reason_ you want to set the rules – you want to help people, and you think you'd do a good job.

![](https://assets.turntrout.com/static/images/posts/QSms7P6.avif)

Historically, in this kind of situation, this reasoning leads to terrible things.

![](https://assets.turntrout.com/static/images/posts/COsmr4C.avif)

So you _just don't do it_, even though it feels like a good idea.[^1]

> [!example] Examples
>
> - "It _feels_ like I could complete this project within a week. But… in the past, when I've predicted "a week" for projects like this, reality usually gives me a longer answer. I'm not going to trust this feeling. I'm going to allocate extra time."
> - As a new secretary, I think I know how my boss would want me to reply to an important email. However, I'm not sure. Even though I think I know what to do, common sense recommends I clarify.
> - You broke up with someone. "Even though I really miss them, in this kind of situation, missing my ex isn't a reliable indicator that I should get back together with them. I'm not going to trust this feeling, and will trust the "sober" version of me which broke up with them."

# Corrigibility as outside view
>
> [!info] Corrigibility as "outside view"
> Even though my intuition/naïve decision-making process says I should do $X$, I know (through mental simulation or from history) my algorithm is usually wrong in this situation. I'm not going to do $X$.

We are biased and corrupted. By taking the outside view on how our own algorithm performs in a given situation, we can adjust accordingly.

---

> [!quote] [The hard problem of corrigibility](https://arbital.com/p/hard_corrigibility/)
>
> The "hard problem of corrigibility" is to build an agent which, in an intuitive sense, reasons internally as if from the programmers' external perspective. We think the AI is incomplete, that we might have made mistakes in building it, that we might want to correct it, and that it would be e.g. dangerous for the AI to take large actions or high-impact actions or do weird new things without asking first.
>
> We would ideally want the agent to see itself in exactly this way, behaving as if it were thinking, "I am incomplete and there is an outside force trying to complete me, my design may contain errors and there is an outside force that wants to correct them and this a good thing, my expected utility calculations suggesting that this action has super-high utility may be dangerously mistaken and I should run them past the outside force; I think I've done this calculation showing the expected result of the outside force correcting me, but maybe I'm mistaken about _that_."

Calibrated deference provides another framing: [We want the AI to override our correction only if it actually knows what we want better than we do](https://arxiv.org/pdf/1705.09990.pdf). But how could the AI figure this out?

I think a significant part[^2] of corrigibility is: "Calibrate yourself on the flaws of your own algorithm, and repair or minimize them."

And the AI knows its own algorithm. For example, if I'm a personal assistant (with a lot of computing power), I might have a subroutine `OutsideView`. I call this subroutine, which simulates _my own algorithm_ (minus[^3] the call to `OutsideView`) interacting with a distribution of bosses I could have. Importantly, I (the simulator) know the ground-truth preferences for each boss.

If I'm about to wipe my boss's computer because I'm so super duper _sure_ that my boss wants me to do it, I can consult `OutsideView` and realize that I'm usually horribly wrong about what my boss wants in this situation. I don't do it.

Analogously, we might have a value-learning agent take the outside view. If it's about to disable the off-switch, it might realize that this is a terrible idea most of the time. That is, when you simulate your algorithm trying to learn the values of a wide range of different agents, you usually wrongly believe you should disable the off-switch.

> Even though my naïve decision-making process says I should do $X$, I know (through mental simulation) my algorithm is usually wrong in this situation. I'm not going to do $X$.

## Outline of an algorithm

Suppose the agent knows its initial state and has a human model, allowing it to pick out the human it's interacting with.

1. Generate a bunch of (rationality, value) pairs. The agent will test its own value learning algorithm for each pair.
2. For each pair, the agent simulates its algorithm interacting with the human and attempting to learn its values
3. For some percentage of these pairs, the agent will enter the `Consider-disabling-shutdown` state.
4. The agent can see how often its (simulated self's) beliefs about the (rationality, value)-human's values are correct.

## Problems with this framing

If you try to actually hard-code this kind of reasoning, you'll quickly run into symbol grounding issues (this is [one of my critiques of the value-learning agenda](/thoughts-on-human-compatible#Where-in-the-world-is-the-human)), [no-free-lunch value/rationality issues](https://papers.nips.cc/paper/7803-occams-razor-is-insufficient-to-infer-the-preferences-of-irrational-agents.pdf), reference class issues (how do you know if a state is "similar" to the current one?), and more. I don't necessarily think this reasoning can be hardcoded correctly. However, I haven't thought about that much yet.

To me, the point isn't to make a concrete proposal – it's to gesture at a novel-seeming way of characterizing a rather strong form of corrigible reasoning. A few questions on my mind:

- To what extent does this capture the "core" of corrigible reasoning?
- Do smart [intent-aligned](https://ai-alignment.com/clarifying-ai-alignment-cec47cd69dd6) agents automatically reason like this?
  - For example, I consider myself intent-aligned with a more humane version of myself, and I endorse reasoning in this way.

- Is this kind of reasoning a sufficient and/or necessary condition for being in the [basin of corrigibility](https://ai-alignment.com/corrigibility-3039e668638) (if it exists)?

All in all, I think this framing carves out and characterizes a natural aspect of corrigible reasoning. If the AI can get this outside view information, it can overrule us when it knows better and defer when it doesn't. In particular, calibrated deference would avoid the problem of [fully updated deference](https://arbital.com/p/updated_deference/).

> [!thanks]
>Thanks to Rohin Shah, `elriggs`, `TheMajor`, and Evan Hubinger for comments.

<hr/>

[^1]: This isn't to say that there is literally no situation where gaining power would be the right choice. As people [running on corrupted hardware](https://www.lesswrong.com/posts/dWTEtgBfFaz6vjwQf/ethical-injunctions), it seems inherently difficult for us to tell when it really _would_ be okay for us to gain power. Therefore, just play it safe.

[^2]: I came up with this idea in the summer of 2018, but [`orthonormal` appears to have noticed a similar link a month ago](https://www.lesswrong.com/posts/K9ZaZXDnL3SEmYZqB/ends-don-t-justify-means-among-humans#swHmf245WJ28opzji).

[^3]: Or, you can simulate `OutsideView` calls up to depth $k$. Is there a fixed point as $k\to \infty$?
