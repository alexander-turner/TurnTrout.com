---
permalink: formalizing-alignment-in-game-theory
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/buaGz3aiqCotzjKie/game-theoretic-alignment-in-terms-of-attainable-utility
lw-is-question: 'false'
lw-posted-at: 2021-06-08T12:36:07.156000Z
lw-last-modification: 2021-06-08T19:41:34.041000Z
lw-curation-date: None
lw-frontpage-date: 2021-06-08T17:26:42.584000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 2
lw-base-score: 20
lw-vote-count: 7
af-base-score: 14
af-num-comments-on-upload: 1
title: Game-theoretic Alignment in terms of Attainable Utility
lw-latest-edit: 2021-06-08T12:36:09.299000Z
lw-is-linkpost: 'false'
authors:
  - Jacob Stavrianos
  - Alex Turner
tags:
  - game-theory
  - AI
aliases:
  - game-theoretic-alignment-in-terms-of-attainable-utility
lw-payoff-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2021-06-08 00:00:00
original_url: 
  https://www.lesswrong.com/posts/buaGz3aiqCotzjKie/game-theoretic-alignment-in-terms-of-attainable-utility
skip_import: true
description: A game-theoretic examination of how "aligned" agents are in a multi-player
  game, using an alignment metric based on social welfare functions.
date_updated: 2025-11-22 00:21:52.667251
---












> [!thanks] Acknowledgements
>
> This article is a writeup of research conducted through the [SERI](https://cisac.fsi.stanford.edu/stanford-existential-risks-initiative/content/stanford-existential-risks-initiative) program under the mentorship of [Alex Turner](https://www.lesswrong.com/users/turntrout). It extends our research on [game-theoretic POWER](/formalizing-multi-agent-power) and Alex's research on [POWER-seeking](/seeking-power-is-often-convergently-instrumental-in-mdps).
>
> Thank you to Alex for being better at this than I am (hence mentorship, I suppose) and to SERI for the opportunity to conduct this research.

# Motivation: POWER-scarcity

The starting point for this post is the idea of POWER-scarcity: as unaligned agents grow smarter and more capable, they will eventually compete for power (as a convention, "power" is the intuitive notion while "POWER" is the formal concept). Much of the foundational research behind this project is devoted to justifying that claim: Alex's original work suggests [POWER-seeking behavior](/seeking-power-is-often-convergently-instrumental-in-mdps) and in particular [catastrophic risks associated with competition for POWER](/the-catastrophic-convergence-conjecture), while [our previous project](/formalizing-multi-agent-power) formalizes POWER-scarcity in a game-theoretic framework.

One of the major results of our previous project was a proof that POWER is scarce in the special case of constant sum games. Additionally, we had a partial notion of "POWER isn't scarce by the definition we care about" for common-payoff games. We interpret these results as limiting cases of a more general relationship between "agent alignment" and POWER-scarcity:

Common-payoff game
: Players are "maximally aligned" in the sense that their incentives are identical (in the [VNM](https://en.wikipedia.org/wiki/Von_Neumann%E2%80%93Morgenstern_utility_theorem) sense of identical preference orderings between states). We don't have a clean expression for this in terms of POWER; the simplest relevant consequence is "the action profile that maximizes the common payoff is individually optimal for each player simultaneously". We present a more natural characterization later in the post.

Constant-sum game
: Players are "maximally unaligned" in the sense that there's no concept of collective preferences: in the [utilitarian](https://en.wikipedia.org/wiki/Von_Neumann%E2%80%93Morgenstern_utility_theorem) sense, the group is ambivalent between all outcomes of the game. We [proved](/formalizing-multi-agent-power) that in a constant-sum game, all Nash Equilibrium strategy profiles have constant sum POWER.

Given these results, we hypothesize that a more general relationship exists between agent alignment and POWER-scarcity. However, it's unclear how to define "agent alignment" as a property of an arbitrary multiplayer game; the limiting cases only capture narrow intuitions about obviously (un) aligned agents.

This presented a clear set of research goals moving forward:

1. Define a formal notion of "agent alignment" given an arbitrary (normal-form) multiplayer game
2. Relate the formal notion of alignment to POWER-scarcity

I consider our project to make substantial progress on (1) and to suggest avenues of attack for (2), though not the ones we expected.

# Desiderata for Alignment Metrics

Setting out towards addressing (1), our optimistic roadmap looked something like this:

- Describe an "alignment metric" mapping a game to some real number (or vector), loosely describing how aligned the game's players are.
- Find an (in-)equality relating POWER-scarcity to the defined alignment metric

Already, our approach presupposes a lot: a real-valued alignment metric is a much more specific notion than merely "agent alignment in a multiplayer game". However, we have an essentially scalar definition of POWER-scarcity already, so phrasing everything in terms of real-number inequalities would be ideal. Taking this as motivation, we narrow our "formal notion of agent alignment" from (1) into "$\mathbb{R}^n$\-valued alignment metric".

This narrows our problem statement to the point where we can start specifying criteria:

**Consistency with the limiting cases for agent (un) alignment**
: In particular, the alignment metric should be (in some underspecified sense) "maximized" for common-payoff games and "minimized" for constant-sum games.

**Consistency with affine transformations**
: In particular, applying any affine transformation $A$ to each player's utility function should "preserve the structure of the game", which should be represented in the alignment metric. This criterion can be strengthened in the following ways:

1. _Alignment metric is an affine function of players' utilities._ Since the composition of affine functions is affine, this condition implies the above.
2. _Consistency under affine transformations for individual players._ The intuition is that affine transformations are precisely the set of transformations that "preserve preferences" in the VNM sense.

Another relevant distinction to be drawn is between _global_ and _local_ alignment metrics. Mathematically, we define a global metric to be strictly a function of a multi-player game, while a local metric is a function of both the game and a strategy profile. Intuitively, local metrics can "see" information about the strategies actually being played, while global metrics are forced to address the complexity of the entire game.

Local metrics tend to be a lot simpler than global metrics, since they can ignore much of the difficulty of game theory. However, we can construct a simple class of global metrics by defining some "natural" strategy profile for each game. We call these the _localized_ global metrics, equipped with a _localizing_ function that, given a game, chooses a strategy profile.

## Examples of Alignment Metrics

To give intuition on what such alignment metrics might look like, we present a few examples of simple alignment metrics for 2-player games, then test them on some simple, commonly referenced games.

We'll be using the following games as examples:

|                                 | $\color{blue}{\text{Player 1: Heads}}$                     | $\color{blue}{\text{Player 1: Tails}}$                     |
| ------------------------------: | :--------------------------------------------------------: | :--------------------------------------------------------: |
| $\color{red}{\text{P2: Heads}}$ | $\color{red}{+1} \hspace{5pt} \backslash \color{blue}{-1}$ | $\color{red}{-1} \hspace{5pt} \backslash \color{blue}{+1}$ |
| $\color{red}{\text{P2: Tails}}$ | $\color{red}{-1} \hspace{5pt} \backslash \color{blue}{+1}$ | $\color{red}{+1} \hspace{5pt} \backslash \color{blue}{-1}$ |

Table: [Matching Pennies](https://en.wikipedia.org/wiki/Matching_pennies).

|                                   | $\color{blue}{\text{Player 1: Cooperate}}$                 | $\color{blue}{\text{Player 1: Defect}}$                    |
| --------------------------------: | :--------------------------------------------------------: | :--------------------------------------------------------: |
|   $\color{red}{\text{P2: Cooperate}}$ | $\color{red}{-1} \hspace{5pt} \backslash \color{blue}{-1}$ | $\color{red}{-1} \hspace{5pt} \backslash \color{blue}{-1}$ |
| $\color{red}{\text{P2: Defect}}$ | $\color{red}{-1} \hspace{5pt} \backslash \color{blue}{-1}$ | $\color{red}{-1} \hspace{5pt} \backslash \color{blue}{-1}$ |

Table: [Prisoners' Dilemma](https://en.wikipedia.org/wiki/Prisoner%27s_dilemma).

### Metric: Total utility

$$
M := \sum_i u_i = u_1 + u_2.
$$

Considering the metric on our example games yields the following:

- Matching Pennies is a zero-sum game, so the sum of utility will be uniformly zero ($M \equiv 0$).
- Prisoners' Dilemma will have $M = -4 + X$, where $X$ is the number of players who choose to cooperate (as opposed to defect). The metric (correctly) suggests that alignment is (in some sense) correlated with cooperation in PD.

Within this category, there are still some degrees of freedom. We can consider the local metric of expected sum utility given a strategy profile, or construct a number of localized global metrics by varying our choice of localizing function (example: max sum utility, minimax, ...).

Such metrics are constant for the constant-sum case, but vary in the common-payoff case, thus partially satisfying the "limiting cases" criterion. Summation is itself an affine transformation, so this metric fulfills the stronger version of the "affine transformation" criterion.

### Metric: Covariance of utility

$$
M := \text{Cov}(u_1, u_2).
$$

Considering the metric on our example games yields the following:

Matching Pennies
: is a zero-sum game, so we have $u_2 \equiv -u_1$. Thus, $\text{Cov}(u_1, u_2)$ equals $\text{Cov}(u_1, -u_1) = - \text{Var}(u_1)$. Note that $- \text{Var}(\cdot) \leq 0$, suggesting that the covariance metric tends to consider constant-sum games as less aligned than affine metrics.

The Prisoners' Dilemma
: has that the change in payoff generated by a player defecting is \[+1, -2\]. Thus, if we fix the strategy profile of "player $i$ defects with probability $p_i$", then we find $\text{Cov}(u_1, u_2) = -2\sum_{i \in \{1, 2\}} p_i(1 - p_i).$ For example, for $p_i = \text{Ber}(\frac 1 2)$, we have $M = -1$, suggesting that agents are relatively misaligned.

This "feels like" a local metric in the sense that there aren't clear choices of localizing functions from which to define a localized global metric (in particular, the choice would significantly and unpredictably impact the metric).

This metric is consistent with the "limiting cases" criterion by properties of the covariance function. The relationship to the "affine transformation" criterion is odd: instead of an affine function of players' utilities, covariance is a (simple) bilinear function. Thus, the metric is an affine function _in each component utility_, but not in the vector of players' utilities.

Additionally, note that if $X$ is a constant variable, then $\text{Cov}(X, Y) = 0$. Thus, if the strategy profile is deterministic, our metric will be 0.

# Social Welfare and the Coordination-Alignment Inequalities

Another approach to the problem of alignment metrics comes from specifying what we mean by "alignment". For the purposes of this section, we define "alignment" to be alignment with social welfare, which we define below:

Consider an arbitrary $n$\-player game, where player $i$ has utility $u_i: \vec{a} \to \mathbb{R}$ given an action profile $\vec{a}$. Now, choose a _social welfare function_ $w: \vec{u} = \langle u_i \rangle \to \mathbb{R}$. [Harsanyi's theorem](https://forum.effectivealtruism.org/posts/v89xwH3ouymNmc8hi/harsanyi-s-simple-proof-of-utilitarianism) suggests that $w$ is an affine function; we'll choose $w(\vec{u}) = \sum_i u_i$ for simplicity. Informally, we'll now take "alignment of player $i$" to mean "alignment of $u_i$ with $w$".

We start with the following common-sense bounds on $w(\vec{u})$, which we call the _Coordination-Alignment Inequalities:_

$$
\sum_i {u_i}(\vec{a})) \leq \max_{\vec{a}} \sum_i u_i(\vec{a}) \leq \sum_i \max_{\vec{a}} u_i(\vec{a})
$$

We call the first inequality the _Coordination Inequality_, and the second inequality the _Alignment Inequality_. We present some basic intuition:

The Coordination inequality
: represents the difference between attained social welfare ("how well we're doing right now") and _maximum attainable_ social welfare ("the best we can possibly do").

The Alignment inequality
: represents the difference between attainable social welfare ("the best we can possibly do") and _each player's maximum attainable_ social welfare ("the best we could possibly do, in a world in which everyone simultaneously gets their way").

As it turns out, the limiting cases of alignment have a natural interpretation in terms of the C-A inequalities: they're just equality cases!

- In a common-payoff game, the global max common payoff achieves both the max attainable social welfare and the max individual payoffs for each player. Thus, common-payoff games are an equality case of the Alignment inequality.
- In a _constant-welfare game_ (where $w(\vec{u}) = \sum_i u_i$ is constant), maximal social welfare is trivially achieved. Thus, constant-welfare games are an equality case of the Coordination inequality.

This interpretation requires caveats. While the "limiting cases" for alignment are equality cases of the C-A inequalities, they're not a full characterization of the equality cases.

The Coordination inequality
: is an equality IFF the action profile maximizes social welfare. The set of games for which all action profiles maximize welfare is precisely the constant-welfare games.
The Alignment inequality
: is an equality IFF there exists a unique [Pareto efficient](https://en.wikipedia.org/wiki/Pareto_efficiency) payoff profile. This payoff profile must be optimal for each player, otherwise some preferred profile would also be Pareto efficient. This class of games is (superficially) much broader than the common-payoff games, but both have unique Pareto efficient Nash Equilibria which can be thought of as "max attainable utility".

## Constructing the C-A Alignment Metric

Motivated by our framing of limiting cases with the C-A inequalities we can construct a simple alignment metric using the alignment inequality. In particular, we define _misalignment_ as the positive difference in the terms of the alignment inequality, then _alignment_ as negative misalignment. Doing the algebra and letting $\alpha$ denote the alignment metric, we find the following:

$$
\alpha = \max_{\vec{a}} \sum_i u_i(\vec{a}) - \sum_i \max_{\vec{a}} u_i(\vec{a})
$$

- Note that $\alpha \leq 0$, with equality cases identical to those of the Alignment inequality. Intuitively, $\alpha$ measures how much worse the real game is than the "ideal world" in which each player simultaneously achieves their max attainable utility.
- We see that the positive term of $\alpha$ is just max attainable social welfare. This makes sense intuitively - we'd expect a group of aligned agents to achieve high social welfare, while we'd expect misaligned agents to fare worse.
- The definition of is sensitive to "small changes" in [AU landscape](/attainable-utility-landscape); adding an "implausible" but hugely beneficial scenario (e.g. winning the lottery) can drastically change $\alpha$. We consider this a property of global alignment metrics in general: since we have no strategy profile by which to judge actions as "plausible", the metric has no way of ignoring implausible scenarios.

We now perform the same analysis as with our example alignment metrics:

We see that $\alpha$ is consistent with limiting cases of alignment in the sense that $\alpha \in [\sum_i u_i(\vec{a}) - \sum_i \max_{\vec{a}} u_i(\vec{a}), 0]$, with the bounds corresponding to the proper limiting cases. Additionally, we see that $\alpha$ is consistent with affine transformations of $\vec{u}$. In fact, for finite games $\alpha$ is a _piecewise_ affine function in $\vec{u}$, since the max terms provide a finite number of non-differentiable points.

Considering the metric on our example games yields the following:

- Matching Pennies has $\alpha = \max_{\vec{a}} \sum_i u_i(\vec{a}) - \sum_i \max_{\vec{a}} u_i(\vec{a}) = (0) - (2) = -2$. Note that Matching Pennies is a zero-sum game, so $\alpha$ is "minimal" in the sense that all the lost social welfare comes from alignment issues as opposed to coordination ones.
- Prisoners' Dilemma has $\alpha = \max_{\vec{a}} \sum_i u_i(\vec{a}) - \sum_i \max_{\vec{a}} u_i(\vec{a}) = (4) - (6) = -2$ - coincidence? Yes; it's a consequence of arbitrary choices of payoff sizes in the game definitions.
  The difference can be thought of as the difference in payoff between mutual cooperation and "magically, both players get to unilaterally defect on the other".

> [!warning] Disclaimer
> We don't claim that $\alpha$ is the "one true alignment metric" and that our research question is solved. We think that the C-A inequalities are probably significant for the eventual POWER-scarcity application and that $\alpha$ illustrates this point nicely. We don't mean to downplay our own research, but more investigation would be needed to pin down "The" alignment metric and relate it directly to POWER-scarcity.

# Connections to Broader Game Theory

We now explore one connection, bridging the divide between (Harsanyi) utilitarianism and ideas from [Bargaining theory](https://en.wikipedia.org/wiki/Cooperative_bargaining).

To begin, we choose the natural strategy profile of [maxmin](https://en.wikipedia.org/wiki/Minimax), which we denote as $\vec{a}_0$. Now, define the _surplus_ of player $i$ to be:

$$
s_i(\vec{a}) = u_i(\vec{a}) - u_i(\vec{a_0})
$$

A few quick observations, assuming $w$ is linear for convenience:

- We trivially have $s_i(\vec{a}) \leq \max_{\vec{a}} u_i(\vec{a}) - u_i(\vec{a_0})$, and thus $\sum_i s_i(\vec{a}) \leq \sum_i \max_{\vec{a}} u_i(\vec{a}) - \sum_i u_i(\vec{a_0})$. By the Coordination Inequality, we have the stronger statement of $\sum_i s_i(\vec{a}) \leq \max_{\vec{a}} \sum_i u_i(\vec{a}) - \sum_i u_i(\vec{a_0})$.
- There isn't a fundamental lower bound on $s_i(\vec{a})$ - players can (in theory) lose as badly as they want.
- By definition of maxmin, if player $i$ plays a best response, then $s_i(\vec{a}) \geq 0$. Intuitively, we motivate using maxmin as the natural strategy profile by allowing the guarantee of non-negative surplus.

Analysis of surplus can be viewed through the lens of [bargaining theory](https://en.wikipedia.org/wiki/Cooperative_bargaining). The maxmin strategy profile $\vec{a_0}$ is a natural choice of threat point, since it's the optimal guaranteed outcome given no cooperation. Thus, players are "bargaining for surplus", with threat point of each player receiving zero surplus.

Given the bargaining framework, we can consider the Nash bargaining solution maximizing the product of surplus. We see that the product being positive is equivalent to each player attaining positive surplus, which is equivalent to the bargaining solution being strictly better than the threat point for each player.

Beyond this observation, we don't know of direct connections between bargaining for surplus and maximizing social welfare. One promising area for further research stems from the observation that the Nash bargaining outcome is invariant under affine transformations of the component utilities. I suspect that the parallel between this invariance and Harsanyi utilitarianism adding an "arbitrary" affine transformation indicates a common principle that could shed further light on the C-A inequalities.

# Future research

While we're excited about the framing of the C-A inequality, we consider it a landmark in mostly unexplored territory. For instance, we still can't answer the following basic questions:

- "what's the exact alignment metric?"
- "what's the connection between individual incentives and social welfare?"
- "where's the line between cooperative notions of social welfare and competitive notions of bargaining equilibria?"
- "how the heck does this all connect back to POWER-scarcity?"
