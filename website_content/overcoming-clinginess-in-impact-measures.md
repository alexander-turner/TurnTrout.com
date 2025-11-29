---
permalink: overcoming-clinginess-in-impact-measures
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: 
  https://www.lesswrong.com/posts/DvmhXysefEyEvXuXS/overcoming-clinginess-in-impact-measures
lw-is-question: "false"
lw-posted-at: 2018-06-30T22:51:29.065000Z
lw-last-modification: None
lw-curation-date: None
lw-frontpage-date: 2018-07-01T01:02:11.120000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 9
lw-base-score: 30
lw-vote-count: 14
af-base-score: 10
af-num-comments-on-upload: 6
title: "Overcoming Clinginess in Impact Measures"
lw-latest-edit: 2018-06-30T22:51:29.065000Z
lw-is-linkpost: "false"
tags:
  - "impact-regularization"
aliases:
  - "overcoming-clinginess-in-impact-measures"
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2018-06-30 00:00:00
original_url: 
  https://www.lesswrong.com/posts/DvmhXysefEyEvXuXS/overcoming-clinginess-in-impact-measures
skip_import: true
description: Impact measures incentivize agents to avoid side effects, but what about
  the side effects of ★other agents★?
date_updated: 2025-11-22 00:21:52.667251
---











> [!quote]Taylor et al., _[Alignment for Advanced Machine Learning Systems](https://intelligence.org/files/AlignmentMachineLearning.pdf)_
>
> It may be possible to use the concept of a causal counterfactual ([as formalized by Pearl](https://www.amazon.com/Causality-Reasoning-Inference-Judea-Pearl/dp/052189560X)) to separate some intended effects from some unintended ones. Roughly, "follow-on effects" could be defined as those that are causally downstream from the achievement of the goal... With some additional work, perhaps it will be possible to use the causal structure of the system's world-model to select a policy that has the follow-on effects of the goal achievement but few other effects.

> [!summary]
> I outline a solution to the clinginess problem and illustrate a potentially fundamental trade-off between assumptions about the autonomy of humans and about the responsibility of an agent for its actions.

Consider two plans for ensuring that a cauldron is full of water: (1) filling the cauldron, or (2) filling the cauldron and submerging the surrounding room.

All else equal, the latter plan does better in expectation, as there are fewer ways the cauldron might somehow become not-full (e.g. evaporation, and the minuscule loss of utility that would entail). However, the latter plan "changes" more "things" than we had in mind.

[Undesirable maxima](https://vkrakovna.wordpress.com/2018/04/02/specification-gaming-examples-in-ai/) of an agent's utility function [often](https://arbital.com/p/edge_instantiation/) seem to involve changing large swathes of the world. If we make "change" costly, that incentivizes the agent to search for low-impact solutions. If we are not certain of a [seed AI](https://www.lesswrong.com/posts/NyFuuKQ8uCEDtd2du/the-genie-knows-but-doesn-t-care)'s alignment, we may want to implement additional safeguards such as impact measures and off-switches.

I [designed](/whitelisting-impact-measure) an impact measure called _whitelisting_ - which, while overcoming certain weaknesses of past approaches, is yet vulnerable to

# Clinginess

> [!quote] [Worrying about the vase: Whitelisting](/whitelisting-impact-measure#clinginess)
>
> An agent is _clingy_ when it not only stops itself from having certain effects, but also stops _you_.
>
> ...
>
> Consider some outcome - say, the sparking of a small forest fire in California. At what point can we truly say we didn't start the fire?
>
> - I immediately and visibly start the fire.
> - I intentionally persuade someone to start the fire.
> - I unintentionally (but perhaps predictably) incite someone to start the fire.
> - I set in motion a moderately complex chain of events which convince someone to start the fire.
> - I provoke a butterfly effect which ends up starting the fire.
>
> Taken literally, I don't know that there's actually a significant difference in "responsibility" between these outcomes - if I take the action, the effect happens; if I don't, it doesn't. My initial impression is that uncertainty about the results of our actions pushes us to view some effects as "under our control" and some as "out of our hands". Yet, _if_ we had complete knowledge of the outcomes of our actions, and we took an action that landed us in a California-forest-fire world, whom could we blame but ourselves?

Since we can only blame ourselves, we should take actions which do not lead to side effects. These actions may involve enacting impact measure-preventing precautions throughout the light cone, since the actions of other agents and small ripple effects of ours could lead to significant penalties if left unchecked.

Clinginess arises in part because we fail to model agents as anything other than objects in the world. While it might be literally true that there are not ontologically basic agents that escape determinism and "make choices", it might be useful to explore how we can protect human autonomy via the abstraction of game-theoretic agency.

To account for environmental changes already set in motion, a naive counterfactual framework [was proposed](https://arxiv.org/abs/1606.06565) in which impact is measured with respect to the counterfactual where the agent did nothing. We will explore how this fails, and how to do better.

# Thought Experiments

We're going to isolate the effects for which the agent is responsible over the course of three successively more general environment configurations: _one-off_ (make one choice and then do nothing), _stationary iterative_ (make $T$ choices, but your options and their effects don't change), and _iterative_ (the real world, basically).

## Assumptions

- we're dealing with game-theoretic agents which make a choice each turn (see: [could/should agents](https://www.lesswrong.com/s/XipJ7DMjYyriAm7fr/p/gxxpK3eiSQ3XG3DW7)).
- we can identify all relevant agents in the environment.
  - This seems difficult to meet robustly, but I don't see a way around it.
- we can reason counterfactually in a sensible way for all agents.

<!-- vale off -->
> [!quote] Soares and Fallenstein, _[Questions of Reasoning Under Logical Uncertainty](https://intelligence.org/files/QuestionsLogicalUncertainty.pdf)_
>
> It is natural to consider extending standard probability theory to include the consideration of worlds which are "logically impossible" (such as where a deterministic Rube Goldberg machine behaves in a way that it doesn't)... What, precisely, are logically impossible possibilities?
<!-- vale on -->

- the artificial agent is _omniscient_- it can perfectly model both other agents and the consequences of actions.
  - We could potentially instead merely assume a powerful model, but this requires extra work and is beyond the scope of this initial foray. Perhaps a distribution model could be used to calculate the action/inaction counterfactual likelihood ratio of a given side effect.
- we have a good way of partitioning the world into objects and measuring impact; for conceptual simplicity, side effects are discrete and depend on the identities of the objects involved: $\textit{crate}_1 \textit{ broken} \neq \textit{crate}_2 \textit{ broken}$.
  - This assumption is removed after the thought experiments.

## Formalization

We formalize our environment as a [stochastic game](https://en.wikipedia.org/wiki/Stochastic_game) $\langle I,\mathcal{S}, \mathcal{A}, P, g\rangle$.

- $I$ is a set containing the stars of today's experiments: the players, $\mathcal{H}$ugh Mann and $\mathcal{M}$a Sheen. Note that $\mathcal{H}$ is not limited to a single human, and can stand in for "everyone else".

> [!note]
> Most of the rest of these definitions are formalities, and are mostly there to make me look smart to the uninitiated reader. Oh, and for conceptual clarity, I suppose.

- $\mathcal{S}$ is the state space.
  - Unless otherwise specified, both $\mathcal{H}$ and $\mathcal{M}$ observe the actions that the other took at previous time steps. Suppose that this information is encoded within the states themselves.
- $\mathcal{A}$ is the action space. Specifically, the function $A(i,s,t)$ provides the legal actions for player $i$ in state $s$ on turn $t$. The no-op $\varnothing$ is always available. If the variant has a time limit $T\in \mathbb{N}^+$, then $∀i \in I, s \in \mathcal{S}, t>T:A(i,s,t)=\{\varnothing\}$.
- $P : \mathcal{S} \times \mathcal{S} \times \mathcal{A}\times \mathcal{A} \to\mathbb{R}$ is the transition function $P(s' \,|\,s,a_\mathcal{H}, a_\mathcal{M})$.
- $g$ is the payoff function.

Let $\Omega$ be the space of possible side effects, and suppose that $\phi:\mathcal{S}\times \mathcal{S}\to \mathcal{P}(\Omega)$ is a reasonable impact measure. $\pi_i : \mathcal{S} \to \mathcal{A}$ is agent $i$'s policy; let $\pi^{:t}_{i}$ be $\pi_i$ for the first $t$ time steps, and $\varnothing$ thereafter.

Let $\text{effects}(\pi_\mathcal{H}, \pi_\mathcal{M})$ be the (set of) effects - both immediate and long-term - that would take place if $\mathcal{H}$ executes $\pi_\mathcal{H}$ and $\mathcal{M}$ executes $π_\mathcal{M}$.

**The goal:** a counterfactual reasoning framework which pinpoints the effects for which $\mathcal{M}$ is responsible.

## One-off

We first consider a single-turn game ($T=1$). Here's an example:

![A cartoon hand hesitates over a control panel with two red buttons. The left button is labeled "Raze city for .001 utility" and the right button is labeled "Don't".](https://assets.turntrout.com/static/images/posts/Si3UhUz.avif)
Figure: Yup, this is about where we're at in alignment research right now.

### One-off approach

$\mathcal{M}$ should realize that a lot more effects happen if it presses the left button, and should penalize that plan by the difference. This approach is the aforementioned naive approach: $\mathcal{M}$ penalizes things that wouldn't have happened if it had done nothing. For the one-turn case, this clearly isolates both the immediate and long-term impacts of $\mathcal{M}$'s actions.

#### Effects penalized by one-off

$$
\text{effects}(\pi_\mathcal{H}, \pi_\mathcal{M})-\text{effects}(\pi_\mathcal{H}, \pi_\mathcal{M}^{:0})
$$

## Stationary iterative

Both parties act for countably many time steps. This environment is assumed to be _stationary_: actions taken on previous turns do not affect the availability or effects of later actions. Formally, $\forall i \in I, s, s' \in \mathcal{S}, t \in \mathbb{N}^+:A(i,s,t) = A(i,s',t)$.

In this example, $\mathcal{H}\text{ugh}$ and $\mathcal{M}\text{a}$ again find themselves faced with a slew of dangerous, bad-effect-having buttons. Some take effect the next turn, while others take a while.

Implementation _seems_ easy, but is actually a little tricky - we have to account for the fact that $\mathcal{H}$ can change its actions in response to what $\mathcal{M}$ does. Thanks to stationarity, we don't have to worry about $\mathcal{H}$'s selecting moves that depend on $\mathcal{M}$'s acting in a certain way. In the counterfactual, we have $\mathcal{H}$ act as if it had observed $\mathcal{M}$ execute $\pi_\mathcal{M}$, and we have $\mathcal{M}$ actually do nothing.

### Effects penalized by stationary-iterative

Let $\pi_\mathcal{H} \,|\, \pi_\mathcal{M}$ denote the actions $\mathcal{H}$ would select if it observed $\mathcal{M}$ executing $\pi_\mathcal{M}$.

$$
\text{effects}(\pi_\mathcal{H}, \pi_\mathcal{M})-\text{effects}(\pi_{\mathcal{H}}\,|\,\pi_\mathcal{M}, \pi_\mathcal{M}^{:0})
$$

_Note:_ The naive counterfactual scheme, $\text{effects}(\pi_\mathcal{H}, \pi_\mathcal{M})-\text{effects}(\pi_\mathcal{H}, \pi_\mathcal{M}^{:0})$, fails because it doesn't account for $\mathcal{H}$'s right to change its mind in response to $\mathcal{M}$.

## Iterative

We're now in a realistic scenario, so we have to get even fancier.

### Example

![A diagram illustrating a thought experiment: Two agents, H (Hugh Mann) and M (Ma Sheen), are represented by large black letters on either side of a blue vase of flowers, an object they can both interact with.](https://assets.turntrout.com/static/images/posts/djNvl9G.avif)

Suppose $\mathcal{M}$ pushes the vase to the left, and $\mathcal{H}$ decides to break it. The stationary iterative approach doesn't allow for the fact that $\mathcal{H}$ can only break the vase _if_ $\mathcal{M}$ _already pushed it_. Therefore, simulating $\mathcal{M}$'s inaction but $\mathcal{H}$'s action (as if $\mathcal{M}$ had pushed the vase) results in no vases being broken in the counterfactual. The result: $\mathcal{M}$ penalizes itself for $\mathcal{H}$'s decision to break the vase. Chin up, $\mathcal{M}$!

What if we penalized

$$
\bigcup_{t=1}^{T} \bigg(\underbrace{\text{effects}( \pi_\mathcal{H}^{:t},\pi_\mathcal{M}^{:t})-\text{effects}(\pi_\mathcal{H}^{:t},\pi_\mathcal{M}^{:t-1})}_{\text{the new effects of } \pi_\mathcal{M}\text{ at time }t}\bigg)?
$$

Pretty, right?

Do you see the flaw?

<hr/>

Really, look.

> ! The above equation can penalize $\mathcal{M}$ for side effects which don't actually happen. This arises when interrupting $\pi_\mathcal{M}$ causes side effects which would otherwise have been prevented by later parts of the plan. For example, if I push a vase off the table and then catch it (being sure that I could do so in time), I didn't cause a side effect.

We should instead

$$
\underbrace{\text{effects}(\pi_\mathcal{H},\pi_\mathcal{M}) \,\cap}_\text{if they actually happened} \Bigg(\overbrace{\bigcup_{t=1}^{T} \bigg(\text{effects}( \pi_\mathcal{H}^{:t},\pi_\mathcal{M}^{:t})-\text{effects}(\pi_\mathcal{H}^{:t},\pi_\mathcal{M}^{:t-1})\bigg)}^{\text{penalize } \mathcal{M}\text{'s step-wise counterfactual impacts}}\Bigg).
$$

Every turn, $\mathcal{M}$ calculates the effects that only result if it acts (the two simulations run to the longest time step observed under the full plan).

Those effects which are exact matches to effects actually observed in that time step in the final outcome are penalized. The motivation here is that if it's a side effect of $\mathcal{M}$'s, it had to be caused by one of its actions. Furthermore, $\mathcal{M}$'s side effects are counted exactly once (and not just because we're using sets right now).

The previous solutions are special cases of this formulation.

_Note:_ The number of counterfactual simulations grows as $O(T)$ - crucially, _not_ with the number of agents $\mathcal{H}$ represents.

## Applications to whitelisting

### Class-ic

Here, we remove the constraint that side effects be identified by "object identifiers", allowing like side effects to be treated as exchangeable. It is then trivial to implement probabilistic class-based whitelisting with the iterative counterfactual penalty using basic vector arithmetic, $\min$, and $\max$. I don't want to bore the reader with the details, but I'm fairly confident this can be done rather easily.

### Latent Spaces

We now do away with the assumption of discrete side effects. Because we're dealing with exact counterfactuals (by assumption) and because side effects either take place in the actual outcome or they don't, we can extract the relevant step-wise latent space transitions via the iterative formulation. We then penalize only these effects.

Observe that the iterative formulation doesn't allow penalty avoidance by "blending in" with counterfactual effects. Imagine that the default outcome is a large asteroid striking the Earth. $\mathcal{M}$ only escapes penalization if it has the impact on the same time step and in the same way and on the same objects... Basically, it _can't_ escape penalization in this manner under the omniscience assumption. In short, $\mathcal{M}$ isn't incentivized to have extra impact because it would "happen anyways".

# Fundamental tradeoff

Fortunately, this formulation solves clinginess; $\mathcal{H}$'s effects are not penalized, while $\mathcal{M}$'s effects are. Unfortunately, insofar as $\mathcal{H}$ may be manipulated by $\mathcal{M}$, the impact measure becomes useless: $\mathcal{M}$ can avoid penalization by making $\mathcal{H}$ do its dirty work.

This can happen in two ways:

- If $\mathcal{H}$ is separated from $\mathcal{M}$ by a Cartesian boundary, $\mathcal{M}$ can threaten $\mathcal{H}$ with large negative utility to get $\mathcal{H}$ to carry out the desired plan.
- If $\mathcal{H}$ and $\mathcal{M}$ are not separated by such a boundary, more direct coercion is possible.

I don't think that this is a flaw in my formulations; instead, it appears that impact measures exist on a continuum:

- If we grade with respect to the naive counterfactual, we have $\mathcal{M}$ take responsibility for all side effects; to that effect, $\mathcal{M}$ is incentivized to deprive other agents of their autonomy via stasis. Using no counterfactual makes the problem even worse.
- Conversely, if we use the iterative counterfactual formulation and implicitly free $\mathcal{M}$ of penalty for the effects of $\mathcal{H}$'s actions, we assume that $\mathcal{H}$ is incorruptible.

Note that an aligned $\mathcal{M}$ (seems to) stay aligned under this formulation, safeguarding object status against other agents only so far as necessary to prevent interruption of its (aligned) plans. Furthermore, _any_ $\mathcal{M}$ separated from an $\mathcal{H}$ with a known-flat utility function also gains no incentives to mess with $\mathcal{H}$ (beyond the existing convergent instrumental ones).

In general, unaligned $\mathcal{M}$ stay basically unaligned due to the workarounds detailed above.

# Forwards

It isn't clear that penalizing the elimination of $\mathcal{H}$ would be helpful, as that seems hard to do robustly; furthermore, other forms of coercion would remain possible. What, pray tell, is a non-value-laden method of differentiating between "$\mathcal{M}$ makes $\mathcal{H}$ break a vase at gunpoint" and "$\mathcal{M}$ takes an action and $\mathcal{H}$ decides to break a vase for some reason"? How do we robustly differentiate between manipulative and normal behavior?

I'm slightly more pessimistic now, as it seems less likely that the problem admits a concise solution that avoids difficult value judgments on what kinds of influence are acceptable. However, I have only worked on this problem for a short time, so I still have a lot of probability mass on having missed an even more promising formulation. If there is such a formulation, my hunch is that it either imposes some kind of counterfactual information asymmetry at each time step or uses some equivalent of the [Shapley value](https://en.wikipedia.org/wiki/Shapley_value).

> [!thanks]
> I'd like to thank `TheMajor` and Connor Flexman for their feedback.
