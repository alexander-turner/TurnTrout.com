---
permalink: quantitative-strength-of-instrumental-convergence
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/Yc5QSSZCQ9qdyxZF6/the-more-power-at-stake-the-stronger-instrumental
lw-is-question: 'false'
lw-posted-at: 2021-07-11T17:36:24.208000Z
lw-last-modification: 2023-05-16T20:26:01.242000Z
lw-curation-date: None
lw-frontpage-date: 2021-07-11T19:16:22.478000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 7
lw-base-score: 45
lw-vote-count: 13
af-base-score: 29
af-num-comments-on-upload: 1
publish: true
title: The More Power At Stake, The Stronger Instrumental Convergence Gets For Optimal
  Policies
lw-latest-edit: 2023-05-16T20:26:02.342000Z
lw-is-linkpost: 'false'
tags:
  - instrumental-convergence
  - AI
aliases:
  - the-more-power-at-stake-the-stronger-instrumental
lw-sequence-title: The Causes of Power-seeking and Instrumental Convergence
lw-sequence-image-grid: sequencesgrid/hawnw9czray8awc74rnl
lw-sequence-image-banner: sequences/qb8zq6qeizk7inc3gk2e
sequence-link: posts#the-causes-of-power-seeking-and-instrumental-convergence
prev-post-slug: lower-stakes-alignment-scenario
prev-post-title: A world in which the alignment problem seems lower-stakes
next-post-slug: power-seeking-beyond-MDPs
next-post-title: Seeking Power is Convergently Instrumental in a Broad Class of Environments
lw-reward-post-warning: 'true'
use-full-width-images: 'false'
date_published: 2021-07-11 00:00:00
original_url: https://www.lesswrong.com/posts/Yc5QSSZCQ9qdyxZF6/the-more-power-at-stake-the-stronger-instrumental
skip_import: true
card_image:
description: Instrumental convergence strengthens proportional to the ratio of an
  agent's control if it survives to its control if it dies.
date_updated: 2025-03-05 20:43:54.692493
---











[_Environmental Structure Can Cause Instrumental Convergence_](/environmental-structure-can-cause-instrumental-convergence) explains how power-seeking incentives can arise because there are simply many more ways for power-seeking to be optimal, than for it not to be optimal. Colloquially, there are lots of ways for "get money and take over the world" to be part of an optimal policy, but relatively few ways for "die immediately" to be optimal. (And here, each "way something can be optimal" is a reward function which makes that thing optimal.)

How strong is this effect, quantitatively?

![](https://assets.turntrout.com/static/images/posts/nwvmc2ovaduran8592k8.avif)
<br/>Figure: Intuitively, it seems like there are twice as many ways for `Wait!` to be optimal (in the undiscounted setting, where we don't care about intermediate states).

I previously speculated that we should be able to get quantitative lower bounds on how many objectives incentivize power-seeking actions:

> [!quote] [Environmental Structure Can Cause Instrumental Convergence](/environmental-structure-can-cause-instrumental-convergence#Combinatorics-how-do-they-work)
>
> > [!math] Definition: Orbit-level tendencies
> > At state $s$ , _most reward functions_ incentivize action $a$ over action $a'$ when for all reward functions $R$, at least half of the [orbit](/environmental-structure-can-cause-instrumental-convergence#Orbits-of-goals) agrees that $a$ has at least as much action value as $a'$ does at state $s$.
>
> ...
>
> What does "most reward functions" mean quantitatively - is it just at least half of each orbit? Or, are there situations where we can guarantee that at least three-quarters of each orbit incentivizes power-seeking? I think we should be able to prove that as the environment gets more complex, there are combinatorially more permutations which enforce these similarities, and so the orbits should skew harder and harder towards power-incentivization.

About a week later, I had my answer:

> [!math] Scaling law for instrumental convergence (informal)
> If policy set $\Pi_A$ lets you do "$n$ times as many things" than policy set $\Pi_B$ lets you do, then for _every_ reward function, _A is optimal over B for at least_ $\frac{n}{n+1}$ of its permuted variants (i.e. [orbit elements](/environmental-structure-can-cause-instrumental-convergence)).
>
> For example, $\Pi_A$ might contain the policies where you stay alive, and $\Pi_B$ may be the other policies: the set of policies where you enter one of several death states.

> [!math] Conjecture which I think I see how to prove
> For _almost all_ reward functions, A is _strictly_ optimal over B for at least $\frac{n}{n+1}$ of its permuted variants.

![](https://assets.turntrout.com/static/images/posts/nwvmc2ovaduran8592k8.avif)
<br/>Figure: At least $\frac{2}{2+1}=\frac{2}{3}$ of the orbit of every reward function agrees that `Wait!` is optimal (for average per-timestep reward). That's because there are twice as many ways for `Wait!` to be optimal over `candy`, than for the reverse to be true.

Basically, when you could apply [the previous results](/seeking-power-is-often-convergently-instrumental-in-mdps#Retaining-long-term-options-is-POWER-seeking-and-more-probable-under-optimality-when-the-discount-rate-is-close-enough-to-1) but "multiple times"[^quo], you can get lower bounds on how often the larger set of things is optimal:

![](https://assets.turntrout.com/static/images/posts/cimakofeuevfrjgqcjxx.avif)
<br/>Figure: Each set contains a subset of the agent's "options." A vertex is just the agent staying at that state. A linked pair is the agent alternating back and forth between two states. The triangle is a circuit of three states, which the agent can navigate as they please.
  
Roughly, the theorem says: if the set 1 of options can be embedded 3 times into another set 2 of options (where the images are disjoint), then at least $\frac{3}{3+1}= \frac{3}{4}$ of all variations on all reward functions agree that set 2 is optimal.

And in way larger environments - like the _real world_, where there are trillions and trillions of things you can do if you stay alive, and not much you can do otherwise - nearly _all_ orbit elements will make survival optimal.

![](https://assets.turntrout.com/static/images/posts/rvzdieyrxteo1dctwwyl.avif)
<br/>Figure: In this environment, it's (average-reward) optimal to stay alive for at least $\frac{10^{53}}{10^{53}+1}$ of the variants on each objective function.

I see this theory as beginning to link the richness of the agent's environment, with the difficulty of aligning that agent: for optimal policies, instrumental convergence strengthens proportionally to the ratio of $\dfrac{\text{control if you survive}}{\text{control if you die}}$.

# Why this is true

The proofs are currently in an Overleaf. But here's one intuition, using the `candy`, `chocolate`, and `reward` example environment.

![](https://assets.turntrout.com/static/images/posts/nwvmc2ovaduran8592k8.avif) Consider any reward function which says `candy` is strictly optimal. Then `candy` is strictly optimal over both `chocolate` and `hug`.

We have two permutations: one switching the reward for `candy` and `chocolate`, and one switching reward for `candy` and `hug`.  Each permutation produces a different orbit element (a different reward function variant).  The permuted variants both agree that `Wait!` is strictly optimal.  

So there are at least twice as many orbit elements for which `Wait!` is strictly optimal over `candy`, than those for which `candy` is strictly optimal over `Wait!`.  Either one of `Start`'s child states (`candy/Wait!`) is strictly optimal, or they're both optimal. If they're both optimal, `Wait!` is optimal. Otherwise, `Wait!` makes up at least 2/3 of the orbit elements for which strict optimality holds.

## Conjecture

> [!math] Conjecture: Fractional scaling law for instrumental convergence (informal)
> If staying alive lets you do $n$ "things" and dying lets you do $m\leq n$ "things", then for _every_ reward function, _staying alive is optimal for at least_ $\frac{n}{n+m}$ _of its orbit elements_.

I'm reasonably confident this is true, but I haven't worked through the combinatorics yet. This would slightly strengthen the existing lower bounds in certain situations. For example, suppose dying gives you 2 choices of terminal state, but living gives you 51 choices. The current result only lets you prove that at least $\frac{50}{50+2}=\frac{25}{26}$ of the orbit incentivizes survival. The fractional lower bound would slightly improve this to $\frac{51}{51+2}=\frac{51}{53}$.

# Invariances

In certain ways, the results are indifferent to e.g. increased precision in agent sensors: it doesn't matter if dying gives you 1 option and living gives you $n$ options, or if dying gives you 2 options and living gives you $2n$ options.

![](https://assets.turntrout.com/static/images/posts/nwvmc2ovaduran8592k8.avif)
<br/>Figure: `Wait!` has twice as many ways of being average-optimal.

![](https://assets.turntrout.com/static/images/posts/bjqgcnfm88mp60xbjffv.avif)
<br/>Figure: For optimal policies, instrumental convergence is just as strong here.

![](https://assets.turntrout.com/static/images/posts/qsmpevxeqetqyfi9qzlr.avif)
<br/>Figure: And you can prove the same thing here as well - `Wait!` has at least twice as many ways of being average-optimal.

Similarly, you can do the inverse operations to simplify subgraphs in a way that respects the theorems:

![](https://assets.turntrout.com/static/images/posts/cimakofeuevfrjgqcjxx.avif)
<br/>Figure: You could replace each of the circled subsets with anything you like, and the scaling law still holds (as long as the contents of each circle are replaced with the same new set of options).

I have given the start of a theory on what state abstractions "respect" the theorems, although there's still a lot I don't understand. (I've barely thought about it so far.)

# Note of caution, redux

Last time, in addition to the "[how do combinatorics work?](/environmental-structure-can-cause-instrumental-convergence#Combinatorics-how-do-they-work)" question I posed, I wrote several qualifications:

> [!quote] The combinatorics conjectures will help prove the latter
>
> - They assume the agent is following an optimal policy for a reward function
>   - I can relax this to $\epsilon$-optimality, but $\epsilon>0$ may be extremely small
>
> - They assume the environment is finite and fully observable
> - Not all environments have the right symmetries
>   - But most ones we think about seem to
>
> - The results don't account for the ways in which we might practically express reward functions
>   - For example, often we use featurized reward functions. While most permutations of any featurized reward function will seek power in the considered situation, those permutations need not respect the featurization (and so may not even be practically expressible).
>
> - When I say "most objectives seek power in this situation", that means _in that situation_- it doesn't mean that most objectives take the power-seeking move in most situations in that environment

Let's take care of that last one. I was actually being too cautious, since the existing results already show us how to reason across multiple situations. The reason is simple. Suppose we use my results to prove that when the agent maximizes average per-timestep reward, it's strictly optimal for at least 99.99% of objective variants to stay alive. For all of these variants, _no matter the situation_ the agent finds itself in, it'll be optimal to try to avoid strictly suboptimal death states.

This doesn't mean that these variants always incentivize moves which are formally POWER-seeking, but it does mean that we can sometimes prove what optimal policies tend to do across a range of situations.

So now we find ourselves with a slimmer list of qualifications:

> [!quote]
>
> 1. They assume the agent is following an optimal policy for a reward function
>     - I can relax this to $\epsilon$-optimality, but $\epsilon>0$ may be extremely small
>
> 2. They assume the environment is finite and fully observable
> 3. Not all environments have the right symmetries
>     - But most ones we think about seem to
>
> 4. The results don't account for the ways in which we might practically express reward functions
>     - For example, state-action versus state-based reward functions (this particular case doesn't seem too bad, I was able to sketch out some nice results rather quickly, since you can convert state-action MDPs into state-based reward MDPs and then apply my results).
>

It turns out to be surprisingly easy to do away with (2). We'll get to that next time.

For (3), environments which "almost" have the right symmetries should also "almost" obey the theorems. To give a quick, non-legible sketch of my reasoning:

> For the uniform distribution over reward functions on the unit hypercube ($[0,1]^{|\mathcal{S}|}$), optimality probability should be Lipschitz continuous on the available state visit distributions (in some appropriate sense). Then if the theorems are "almost" obeyed, instrumentally convergent actions still should have extremely high probability, and so most of the orbits still have to agree.

So I don't currently view (3) as a huge deal. I'll probably talk more about that another time.

This should bring us to interfacing with (1) ("how smart is the agent? How does it think, and what options will it tend to choose?" - _this seems hard_) and (4) ("for what kinds of reward specification procedures are there way more ways to incentivize power-seeking, than there are ways to _not_ incentivize power-seeking?" - _this seems more tractable_).

# Conclusion

This scaling law deconfuses me about why it seems so hard to specify nontrivial real-world objectives which don't have incorrigible shutdown-avoidance incentives when maximized.

[^quo]: I'm using scare quotes regularly because there aren't short English explanations for the exact technical conditions. But this post is written so that the high-level takeaways should be right.

> [!thanks]
>Thanks to Connor Leahy, Rohin Shah, Adam Shimi, and John Wentworth for feedback on this post.
