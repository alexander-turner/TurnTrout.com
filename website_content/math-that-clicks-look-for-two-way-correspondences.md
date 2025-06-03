---
permalink: on-good-formal-definitions
lw-was-draft-post: 'false'
lw-is-af: 'false'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/Lotih2o2pkR2aeusW/math-that-clicks-look-for-two-way-correspondences
lw-is-question: 'false'
lw-posted-at: 2020-10-02T01:22:18.177000Z
lw-last-modification: 2020-10-02T17:19:26.385000Z
lw-curation-date: None
lw-frontpage-date: 2020-10-02T01:25:12.532000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 4
lw-base-score: 35
lw-vote-count: 12
af-base-score: 0
af-num-comments-on-upload: 0
publish: true
title: 'Math That Clicks: Look for Two-Way Correspondences'
lw-latest-edit: 2020-10-02T17:19:27.318000Z
lw-is-linkpost: 'false'
tags:
  - rationality
  - understanding-the-world
aliases:
  - math-that-clicks-look-for-two-way-correspondences
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2020-10-02 00:00:00
original_url: https://www.lesswrong.com/posts/Lotih2o2pkR2aeusW/math-that-clicks-look-for-two-way-correspondences
skip_import: true
description: 'Good formalizations are two-way correspondences: the math suggests the
  concept it formalizes.'
date_updated: 2024-11-22 20:04:30.137574
---






> [!thanks]
> Andrew Critch made this explicit to me.

Suppose you want to formalize "information". What does it mean to "gain information about something"?

You know about probability distributions, and you remember that Shannon came up with information theory, but you aren't allowed to look that up, because you're stranded on a desert island, and your "rescuers" won't take you to safety until you can formalize this.

Don't you hate it when this happens?

Anyways, you're starving, and so you think:

> Suppose I'm trying to figure out the bias $\theta$ on a coin someone is flipping for me. I start with a uniform prior over $\theta\in[0,1]$, and observe the process for a while. As I learn more, I become more confident in the true hypothesis,[^1] and so my credence increases.
>
> So maybe, I gain information about a hypothesis when the Bayesian update increases the hypothesis's probability!

You sanity-check your guess by checking this against remembered instances of information gain: memorizing facts in history class, a friend telling you their address, and so on.

Your stomach rumbles. This guess should be good enough. You tell your would-be rescuers your final answer...

🚨 **No! Wrong!** 🚨 That's not how you should discover new math. True, you formalized a guess that was prompted by intuitive examples of information gain – there was a one-way correspondence from **intuitive concept → math**. That's not enough.

# Recovering the intuition from the math

> [!quote] [How I Do Research](/how-i-do-research)
>
> Don't think for a second that having math representing your thoughts means you've necessarily made progress – for the kind of problems I'm thinking about right now, the math has to _sing_ with the elegance of the philosophical insight you're formalizing.

I claim that you should create math such that the **math suggests the intuitive concept it's formalizing**. If you obfuscate any suggestive notation and show the math to someone who already knows the intuitive concept, would the concept jump back out at them?

Above, information gain was formalized as increase in credence; roughly,

$$
\text{Info-gain}(\text{hypothesis, observation}) := P(h \mid o) - P(h).
$$
Assuming we already know about probability and arithmetic and function notation, what does the obfuscated version bring to mind?

$$
\text{met32vfs}(\text{e1ht, jt3n}) := P(e1ht \mid jt3n) - P(e1ht).
$$
When this value is high, you're just becoming more confident in something. What if you gain information that makes you confused?

What if you thought Newtonian mechanics was The Truth, and then [Mercury's perihelion shows up with a super-wack precession](https://en.wikipedia.org/wiki/Tests_of_general_relativity). Are you gonna say you've "lost information about the Newtonian hypothesis" with a straight face? Uh, awkward...

## Heuristic: show that only your quantity achieves obviously desirable properties

In the case of information, the winner is "[formalize for-sure properties that the quantity should obey](https://en.wikipedia.org/wiki/Entropy_\(information_theory\)#Characterization)", like

1. The more sure you are something will go a certain way, the less you expect to learn from it, and
2. You can't have "negative" information, and
3. Totally predictable events give you 0 information, and
4. Information is additive across independent events.

By proving that only your function meets the desiderata, this decomposes "does this formalize the right thing?" into "do we really need the desiderata, and are _they_ correctly formalized?". Decomposition is crucial here in a [Debate](https://openai.com/blog/debate/) sense: disagreement can be localized to smaller pieces and simpler claims.

You can't always pull this off, but when you can, it's awesome.

- Probability theory: [Cox's theorem](https://en.wikipedia.org/wiki/Cox%27s_theorem)
- Utility theory: [VNM utility theorem](https://en.wikipedia.org/wiki/Von_Neumann%E2%80%93Morgenstern_utility_theorem)
- Special relativity: given[^2] "observers can only measure relative (not absolute) velocity" and "all observers agree that light has a fixed speed $c$ in vacuum", [special relativity follows logically](https://en.wikipedia.org/wiki/Special_relativity#Traditional_%22two_postulates%22_approach_to_special_relativity).

## Heuristic: compound concepts

If you have a really solid concept, like the expected-value operator $\mathbb{E}[\cdot]$, and another really solid concept, like "surprisal $-\log p$ at seeing an event of probability $p$", you can sometimes build another intuitively correct concept: expected surprisal, or entropy: $\mathbb{E}_{x\sim p(X)}[-\log P(x)]$. Just make sure the types match up!

## More examples

Sometimes, you can't mathematically _prove_ the math is right, given desiderata, but you can still estimate how well the math lets a fresh-eyed reader infer the intuitive concept. Here are some examples which mathematically suggest their English names.

- [Distance metrics](https://en.wikipedia.org/wiki/Metric_space) obey basic properties for quantifying exactly how "close" two points are.
- [Contractions](https://en.wikipedia.org/wiki/Contraction_mapping) bring points closer together.
- Derivatives capture instantaneous rate of change.
- [Stochastic processes](https://en.wikipedia.org/wiki/Stochastic_process) capture how a system evolves over time.
- [Value functions](https://medium.com/analytics-vidhya/reinforcement-learning-value-function-and-policy-c22f5bd1d1b0) capture the expected value of following a policy.

# Why might the second correspondence be good?

By itself, "intuition → math" can anchor you on partial answers and amplify [confirmation bias](https://explorable.com/confirmation-bias); in my fictional example above, counterexamples to "information = change in credence" were not considered.

Here's my advice: Whenever possible, clarify your assumed desiderata. Whenever possible, prove your construction is basically the only way to get all the desiderata. Whenever possible, build the math out of existing correct pieces of math which correspond to the right building blocks (expected + surprisal = expected surprisal).

If something feels wrong, **pay attention**, and then mentally reward yourself for noticing the wrongness. When you're done, give the math a succinct, clear name.

Make the math as obviously correct as possible. In my personal and observed experience, this advice is _not_ followed by default, even though you'd obviously agree with it.

Strive for clearly correct math, informative names, and unambiguously specified assumptions and desiderata. Strive for a two-way correspondence: the concept should jump out of the math.

<hr/>

[^1]: Assuming they actually _are_ flipping a coin with a stationary bias (a Bernoulli process).

[^2]: And some basic background assumptions, like "the laws of physics are spatially, temporally, and rotationally invariant", etc.
