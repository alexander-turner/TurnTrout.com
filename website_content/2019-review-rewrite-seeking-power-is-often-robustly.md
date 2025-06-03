---
permalink: announcing-rewrite-of-power-seeking-post
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/mxXcPzpgGx4f8eK7v/2019-review-rewrite-seeking-power-is-often-robustly
lw-linkpost-url: 
  https://www.lesswrong.com/posts/6DuJxY8X45Sco4bS2/seeking-power-is-often-robustly-instrumental-in-mdps
lw-is-question: 'false'
lw-posted-at: 2020-12-23T17:16:10.174000Z
lw-last-modification: 2021-01-02T01:12:50.607000Z
lw-curation-date: None
lw-frontpage-date: 2020-12-23T19:55:08.572000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 0
lw-base-score: 35
lw-vote-count: 9
af-base-score: 19
af-num-comments-on-upload: 0
publish: true
title: '2019 Review Rewrite: Seeking Power is Often Robustly Instrumental in MDPs'
lw-latest-edit: 2021-01-02T01:12:51.101000Z
lw-is-linkpost: 'true'
tags:
  - AI
  - instrumental-convergence
aliases: 2019-review-rewrite-seeking-power-is-often-robustly
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2020-12-23 00:00:00
original_url: 
  https://www.lesswrong.com/posts/mxXcPzpgGx4f8eK7v/2019-review-rewrite-seeking-power-is-often-robustly
skip_import: true
description: Revised post clarifies theory on power-seeking  and corrects terminology
  used in the original post.
date_updated: 2025-04-12 09:51:51.137842
---






For the 2019 LessWrong review, I've rewritten my post [_Seeking Power is Often Robustly Instrumental in MDPs_](/seeking-power-is-often-convergently-instrumental-in-mdps). The post explains the key insights of [my theorems on power-seeking and instrumental convergence / robust instrumentality](https://arxiv.org/abs/1912.01683). The new version is more substantial, more nuanced, and better motivated - without sacrificing the broad accessibility or the cute drawings of the original.

> [!thanks]
> Big thanks to `diffractor`, Emma, Vanessa Kosoy, Steve Omohundro, Neale Ratzlaff, and Mark Xu for reading / giving feedback on this new version.

# Self-review

One year later, I remain excited about this post, from its ideas, to its formalisms, to its implications. I think it helps us formally understand [part of the difficulty of the alignment problem](/the-catastrophic-convergence-conjecture). This formalization of power and the [_Attainable Utility Landscape_](/attainable-utility-landscape) have together given me a [novel frame for understanding alignment and corrigibility](/non-obstruction-motivates-corrigibility).

Since last December, I’ve spent several hundred hours expanding the formal results and rewriting [the paper](https://arxiv.org/pdf/1912.01683.pdf); I’ve generalized the theorems, added rigor, and taken great pains to spell out what the theorems do and do not imply.

I wish I’d gotten a few things right the first time around. Therefore, I’ve restructured and rewritten much of the post. Let’s walk through some of the changes.

## "Instrumentally convergent" replaced by "robustly instrumental"

[Like](/on-good-formal-definitions) [many](/game-theoretic-definition-of-deception) good things, this terminological shift was prompted by a critique from Andrew Critch.

Roughly speaking, this work considered an action to be "instrumentally convergent" if it’s probably optimal, with respect to a probability distribution on a set of reward functions. This definition is natural. You can even find it echoed by Tony Zador in the [_Debate on Instrumental Convergence_](https://www.lesswrong.com/posts/WxW6Gc6f2z3mzmqKs/debate-on-instrumental-convergence-between-lecun-russell):

> So i would say that killing all humans is not only not likely to be an optimal strategy under most scenarios, the set of scenarios under which it is optimal is probably close to a set of measure 0.

(Zador uses “set of scenarios” instead of “set of reward functions”, but he is implicitly reasoning: “with respect to my beliefs about what kind of objective functions we will implement and what states the agent will confront in deployment, I predict that deadly actions have a negligible probability of being optimal.”)

<!-- vale off -->
While discussing this definition of "instrumental convergence", Andrew asked me: “what, exactly, is doing the _converging_? There is no limiting process. Optimal policies just _are_.”
<!-- vale on -->

It would be more appropriate to say that an action is "instrumentally robust" instead of "instrumentally convergent": the instrumentality is _robust_ to the choice of goal. However, I found this to be ambiguous: "instrumentally robust" could be read as “the agent is being robust for instrumental reasons.”

I settled on "robustly instrumental", rewriting the paper’s introduction as follows:

> [!quote] New introduction to the paper
>
> An action is said to be _instrumental to an objective_ when it helps achieve that objective. Some actions are instrumental to many objectives, making them _robustly instrumental_. The so-called _instrumental convergence_ thesis is the claim that agents with many different goals, if given time to learn and plan, will eventually converge on exhibiting certain common patterns of behavior that are robustly instrumental (e.g. survival, accessing usable energy, access to computing resources). Bostrom et al.'s instrumental convergence thesis might more aptly be called the _robust instrumentality_ thesis, because it makes no reference to limits or converging processes:
>
> “Several instrumental values can be identified which are convergent in the sense that their attainment would increase the chances of the agent's goal being realized for a wide range of final goals and a wide range of situations, implying that these instrumental values are likely to be pursued by a broad spectrum of situated intelligent agents.”
>
> Some authors have suggested that _gaining power over the environment_ is a robustly instrumental behavior pattern on which learning agents generally converge as they tend towards optimality. If so, robust instrumentality presents a safety concern for the alignment of advanced reinforcement learning systems with human society: such systems might seek to gain power over humans as part of their environment. For example, Marvin Minsky imagined that an agent tasked with proving the Riemann hypothesis might rationally turn the planet into computational resources.

This choice is not costless: many are already acclimated to the existing "instrumental convergence." It even has [its own Wikipedia page](https://en.wikipedia.org/wiki/Instrumental_convergence). Nonetheless, if there ever were a time to make the shift, that time would be now.

> [!note] As of 2022, I have given up on "robustly instrumental"
> I do still say "convergently instrumental" because it's more precise than "instrumentally convergent."

## Qualification of Claims

The original post claimed that “optimal policies tend to seek power”, _period_. This was partially based on a result which I’d incorrectly interpreted. Vanessa Kosoy and Rohin Shah pointed out this error to me, and I quickly amended the original post and [posted a follow-up explanation](https://www.alignmentforum.org/posts/cwpKagyTvqSyAJB7q/clarifying-power-seeking-and-instrumental-convergence).

At the time, I’d wondered whether this was still true in general via some other result. The answer is "no’: it _isn’t_ always more probable for optimal policies to navigate towards states which give them more control over the future. Here’s a surprising counterexample which doesn’t even depend on my formalization of "power."

![](https://assets.turntrout.com/static/images/posts/6e57042283c8eb981b2be10d266bfcf804d06653cfc04809.avif)
<br/>Figure: The paths are one-directional; the agent can’t go back from **3** to **1**. The agent starts at **1**. Under a certain state reward distribution, the vast majority of agents go _up_ to **2**.
  
However, any reasonable notion of "power" must consider having no future choices (at state **2**) to be less powerful than having one future choice (at state **3**). For more detail, see Section 6 and Appendix B.3 of [the paper](https://arxiv.org/pdf/1912.01683.pdf)

![](https://assets.turntrout.com/static/images/posts/0cabde68e0eb61a5bb325beab9ddd645139198303d6ae308.avif)
<br/>Figure: When reward is
 IID across states according to the quadratic CDF $F(x) := x^2$ on the unit interval, then with respect to reward functions drawn from this distribution, going _up_ has about a 91% chance of being optimal when the discount rate $\gamma = .12$.
  
If you’re curious, this happens because this quadratic reward distribution has negative skew. When computing the optimality probability of the _up_ trajectory, we’re checking whether it maximizes discounted return. Therefore, the probability that _up_ is optimal is  

$$
\begin{align*}
\mathbb{P}_{R\sim\mathcal{D}}\bigg(R(\textbf{2})\geq \max\big(&(1-\gamma) R(\textbf{3}) + (1-\gamma) \gamma R(\textbf{4}) + \gamma^2 R(\textbf{5}),\\
&(1-\gamma) R(\textbf{3}) + (1-\gamma) \gamma R(\textbf{4}) + \gamma^2 R(\textbf{6})\big)\bigg).
\end{align*}
$$
  
Weighted averages of IID draws from a left-skew distribution will look more Gaussian and therefore have fewer large outliers than the left-skew distribution does. Thus, going _right_ will have a lower optimality probability.

---

No matter how you cut it, the relationship just isn’t true in general. Instead, [the post](/seeking-power-is-often-convergently-instrumental-in-mdps) now sketches sufficient conditions under which power-seeking behavior is more probably optimal – conditions which are proven in the paper.
