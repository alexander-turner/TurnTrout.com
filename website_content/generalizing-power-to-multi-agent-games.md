---
permalink: formalizing-multi-agent-power
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/MJc9AqyMWpG3BqfyK/generalizing-power-to-multi-agent-games
lw-is-question: 'false'
lw-posted-at: 2021-03-22T02:41:44.763000Z
lw-last-modification: 2021-06-06T14:23:10.706000Z
lw-curation-date: None
lw-frontpage-date: 2021-03-22T03:31:41.433000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 16
lw-base-score: 52
lw-vote-count: 14
af-base-score: 23
af-num-comments-on-upload: 10
publish: true
title: Generalizing POWER to multi-agent games
lw-latest-edit: 2021-06-06T14:23:13.010000Z
lw-is-linkpost: 'false'
authors: Jacob Stavrianos and Alex Turner
tags:
  - understanding-the-world
  - AI
  - instrumental-convergence
aliases:
  - generalizing-power-to-multi-agent-games
sequence-link: posts#the-causes-of-power-seeking-and-instrumental-convergence
lw-sequence-title: The Causes of Power-Seeking and Instrumental Convergence
prev-post-slug: power-as-easily-exploitable-opportunities
prev-post-title: Power as Easily Exploitable Opportunities
next-post-slug: MDPs-are-not-subjective
next-post-title: MDP Models Are Determined by the Agent Architecture and the Environmental
  Dynamics
lw-reward-post-warning: 'true'
use-full-width-images: 'false'
date_published: 2021-03-22 00:00:00
original_url: 
  https://www.lesswrong.com/posts/MJc9AqyMWpG3BqfyK/generalizing-power-to-multi-agent-games
skip_import: true
description: Formalizing "power" in multi-agent games, showing that increased agent
  capabilities can lead to power scarcity and increased competition for resources.
date_updated: 2025-06-03 22:57:00.423836
---






> [!thanks] Acknowledgments
> This article is a writeup of a research project conducted through the [SERI](https://cisac.fsi.stanford.edu/stanford-existential-risks-initiative/content/stanford-existential-risks-initiative) program under the mentorship of [Alex Turner](https://www.lesswrong.com/users/turntrout). I ([Jacob Stavrianos](https://www.lesswrong.com/users/midco)) would like to thank Alex for turning a messy collection of ideas into legitimate research, as well as the wonderful researchers at SERI for guiding the project and putting me in touch with the broader X-risk community.

In the single-agent setting, [Seeking Power is Often Convergently Instrumental in MDPs](/seeking-power-is-often-convergently-instrumental-in-mdps) showed that optimal policies tend to choose actions which pursue "power" (reasonably formalized). In the multi-agent setting, the [Catastrophic Convergence Conjecture](/the-catastrophic-convergence-conjecture) presented intuitions that "most agents" will "fight over resources" when they get "sufficiently advanced." However, it wasn't clear how to formalize that intuition.  
  
This post synthesizes single-agent power dynamics (which we believe is now somewhat well-understood in the MDP setting) with the multi-agent setting. The multi-agent setting is important for AI alignment, since we want to reason clearly about when AI agents disempower humans. Assuming constant-sum games (i.e. maximal misalignment between agents), this post presents a result which echoes the intuitions in the Catastrophic Convergence Conjecture post: as agents become "more advanced", "power" becomes increasingly scarce & constant-sum.

# An illustrative example

You're working on a project with a team of your peers. In particular, your actions affect the final deliverable, but so do those of your teammates. Say that each member of the team (including you) has some goal for the deliverable, which we can express as a reward function over the set of outcomes. How well (in terms of your reward function) can you expect to do?

It depends on your teammates' actions. Let's first ask "given my opponent's actions, what's the highest expected reward I can attain?"

## Case 1: Everyone plays nice

We can start by imagining the case where everyone does exactly what you'd want them to do. Mathematically, this allows you to obtain the globally maximal reward; or "the best possible reward assuming you can choose everyone else's actions". Intuitively, this looks like your team sitting you down for a meeting, asking what you want them to do for the project, and carrying out orders without fail. As expected, this case is 'the best you can hope for" in a formal sense.

## Case 2: Everyone plays mean

Now, imagine the case where everyone does exactly what you _don't_ want them to do. Mathematically, this is the worst possible case; every other choice of teammates' actions is at least as good as this one. Intuitively, this case is pretty terrible for you. Imagine the previous case, but instead of following orders your team actively sabotages them. Alternatively, imagine that your team spends the meeting breaking your knees and your laptop.

## Case 3: Somewhere in between

However, scenarios where your team is perfectly aligned either with or against you are rare. More typically, we model people as maximizing their own reward, with imperfect correlation between reward functions. Interpreting our example as a multi-player game, we can consider the case where the players' strategies form a Nash equilibrium: every person's action is optimal for themselves given the actions of the rest of their team. This case is both relatively general and structured enough to make claims about; we will use it as a guiding example for the formalism below.

# POWER, and why it matters

Many attempts have been made to classify the [convergently instrumental goals](https://selfawaresystems.files.wordpress.com/2008/01/ai_drives_final.pdf) of AI, with the goals of understanding why they emerge given seemingly unrelated utilities and ultimately to counterbalance (either implicitly or explicitly) undesirable convergently instrumental subgoals. [One promising such attempt](/seeking-power-is-often-convergently-instrumental-in-mdps) is based on POWER (the technical term is all-caps to distinguish from normal use of the word). Consider an agent with some space of actions, which receives rewards depending on the chosen actions (formally, an agent in an MDP). Then, POWER is roughly "ability to achieve a wide variety of goals". [It's been shown](https://arxiv.org/abs/1912.01683) that POWER is convergently instrumental given certain conditions on the environment, but currently no formalism exists describing power of different agents interacting with each other.

Since we'll be working with POWER for the rest of this post, we need a solid definition to build off of. We present a simplified version of the original definition:

> [!definition]
> Consider a scenario in which an agent has a set of actions $a \in A$  and a distribution $\mathcal{D}$ of reward functions $r: A \to \mathbb{R}$. Then, we define the POWER of that agent as
>
> $$
> \text{POWER}_{\mathcal{D}} := \mathbb{E}_{r \sim \mathcal{D}} [\max_{a} r(a))]
> $$
As an example, we can rewrite the project example from earlier in terms of POWER. Let your goal for the project be chosen from some distribution $\mathcal{D}$ (maybe you want it done nicely, or fast, or to feature some cool thing that you did, etc). Then, your $\text{POWER}_{\mathcal{D}}$ is the maximum extent to which you can accomplish that goal, in expectation.

However, this model of power can't account for the actions of other agents in the environment (what about what your teammates do? Didn't we already show that it matters a lot?). To say more about the example, we'll need a generalization of POWER.

# Multi-agent POWER

We now consider a more realistic scenario: not only are you an agent with a notion of reward and POWER, but _so is everyone else_, all playing the same multiplayer game. We can even revisit the project example and go through the cases for your teammates' actions in terms of POWER:

Everyone plays nice
: Your team works to maximize your reward in every case, which (with some assumptions) maximizes your POWER over the space of all choices of teammate actions.

Everyone plays mean
: Your team works to minimize your reward in every case, which analogously minimizes your POWER.

Somewhere in-between
: We have a Nash equilibrium of the game used to define multi-agent POWER. In particular, each player's action is a best-response to the actions of every other player. We'll see a parallel between this best-response property and the $\max_{a \in A}$ term in the definition of POWER pop up in the discussion of constant-sum games.

## Bayesian games

To extend our formal definition of power to the multi-agent case, we'll need to define a type of multiplayer normal-form game called a [Bayesian game](https://en.wikipedia.org/wiki/Bayesian_game). We describe them below:

1. At the beginning of the game, each of $n$ players is assigned a type $t_i \in T_i$ from a joint type distribution $\mathbf{t} = (t_i) \sim \Omega$. The distribution $\Omega$ is common knowledge.
2. The players then (independently, **not** sequentially) choose actions $a_i \in A_i$, resulting in an _action profile_ $\mathbf{a} = (a_i)$.
3. Player $i$ then receives reward $r_i(t_i, \mathbf{a})$ (crucially, a player's reward can depend on their type).

Strategies (technically, mixed strategies) in a Bayesian game are given by functions $\sigma_i: T_i \to \Delta A_i$. Thus, even given a fixed strategy profile $\sigma$, any notion of "expected reward of an action" will have to account for uncertainty in other players' types. We do so by defining the _interim expected utility_ for player $i$ as follows:

$$
f_i(t_i, a_i, \sigma_{-i}) := \mathbb{E}[r_i(t_i, \mathbf{a})]
$$

where the expectation is taken over the following:

- the posterior distribution over opponents' types $t_{-i} \vert t_i$ - in other words, what types you expect other players to have, given your type.
- random choice of opponents' actions $a_{-i} \sim \sigma_{-i}(t_{-i})$ - even if you know someone's type, they might implement a mixed strategy which stochastically selects actions.

Further, we can define a (Bayesian) Nash Equilibrium to be a strategy profile where each player's strategy is a best response to opponents' strategies in terms of interim expected utility.

## Formal definition of multi-agent POWER

> [!definition] POWER in a Bayesian game
>
> Fix a strategy profile $\sigma$. We define player $i$'s POWER as
>
> $$
> \text{POWER}(i,  \sigma) := \mathbb{E}_{t_i} \max_{a_i} f_i(t_i, a_i, \sigma_{-i}))
> $$

 Intuitively, POWER is maximum (expected) reward given a distribution of possible goals. The difference from the single-agent case is that your reward is now influenced by other players' actions (by taking an expectation over opponents' strategy).

# Properties of constant-sum games

As both a preliminary result and a reference point for intuition, we consider the special case of _zero-sum games:_

A zero-sum game is a game in which for every possible outcome of the game, the sum of each player's reward is zero. For Bayesian games, this means that for all type profiles $t = (t_i)$ and action profiles $\mathbf{a}$, we have $\sum_i r_i(t_i, \mathbf{a}) = 0$. Similarly, a _constant-sum game_ is a game satisfying $\sum_i r_i(t_i, \mathbf{a}) = c$ for any choices of $t, \mathbf{a}$.

As a simple example, consider chess; a two-player adversarial game. We let the reward profile be constant, given by "1 if you win, -1 if you lose" (assume black wins in a tie). This game is clearly zero-sum, since exactly one player will win and lose. We could ask the same "how well can you do?" question as before, but the upper-bound of winning is trivial. Instead, we ask "how well can both players simultaneously do?"

Clearly, you can't both simultaneously win. However, we can imagine scenarios where both players have the _power_ to win: in a chess game between two beginners, the optimal strategy for either player will easily win the game. As it turns out, this argument generalizes (we'll even prove it): in a constant-sum game, the sum of each player's POWER $\geq c$, with equality IFF each player responds optimally for all their possible goals ("types"). This condition is equivalent to a Bayesian Nash Equilibrium of the game.

Importantly, this idea suggests a general principle of multi-agent POWER I'll call _power-scarcity:_ in multi-agent games, gaining POWER tends to come at the expense of another player losing POWER. Future research will focus on understanding this phenomenon further and relating it to "how aligned the agents are" in terms of their reward functions.

> [!note] Conservation of POWER in constant-sum games
> Consider a Bayesian constant-sum game with some strategy profile $\sigma$. Then, $\sum_i \text{POWER}(i, \sigma) \geq c$ with equality IFF  $\sigma$ is a Nash Equilibrium.
>
> **Intuition:** By definition, $\sigma$ _isn't_ a Nash Equilibrium IFF some player $i$'s strategy $\sigma_i$ isn't a best response. In this case, we see that player $i$ has the power to play optimally, but the other players also have the power to capitalize off of player $i$'s mistake (since the game is constant-sum). Thus, the lost reward is "double-counted" in terms of POWER; if no such double-counting exists, then the sum of POWER is just the expected sum of reward, which is $c$ by definition of a constant-sum game.
>
> **Rigorous proof:**  We prove the following for general strategy profiles $\sigma$:
>
> $$
> \begin{align*} \sum_i \text{Power}(i, \sigma) &= \sum_i \mathbb{E}_{t_i} \max_{a_i} f_i(t_i, a_i, \sigma_{-i})) \\ &\geq \sum_i \mathbb{E}_{t_i} \mathbb{E}_{a_i \sim \sigma_i} f_i(t_i, a_i, \sigma_{-i})) \\ &= \sum_i \mathbb{E}_{t_i} \mathbb{E}_{\mathbf{a} \sim \sigma} r_i(t_i, \mathbf{a})) \\ &= \mathbb{E}_{t} \mathbb{E}_{\mathbf{a} \sim \sigma} \left( \sum_i r_i(t_i, \mathbf{a}) \right) \\ &= \mathbb{E}_{t} \mathbb{E}_{\mathbf{a} \sim \sigma} \left( c \right) \\ &= c \end{align*}
> $$
>
> Now, we claim that the inequality on line 2 is an equality IFF $\sigma$ is a Nash Equilibrium. To see this, note that for each $i$, we have
>
> $$
> \max_{a_i} f_i(t_i, a_i, \sigma_{-i}) \geq \mathbb{E}_{a_i \sim \sigma_i} f_i(t_i, a_i, \sigma_{-i})
> $$
>
> with equality IFF $\sigma_i$ is a best response to $\sigma_{-i}$. Thus, the sum of these inequalities for each player is an equality IFF each $\sigma_i$ is a best response, which is the definition of a Nash Equilibrium. ∎

# Final notes

To wrap up, I'll elaborate on the implications of this theorem, as well as some areas of further exploration on power-scarcity:

- It initially seems unintuitive that as players' strategies improve, their collective POWER tends to decrease. The proximate cause of this effect is something like "as your strategy improves, other players lose the power to capitalize off of your mistakes". More work is probably needed to get a clearer picture of this dynamic.
- We suspect that if all players have identical rewards, then the sum of POWER is equal to the sum of best-case POWER for each player. This gives the appearance of a spectrum with [aligned rewards (common payoff), maximal sum power] on one end and [anti-aligned rewards (constant-sum), constant sum power] on the other. Further research might look into an interpolation between these two extremes, possibly characterized by a correlation metric between reward functions.
  - We also plan to generalize POWER to Bayesian stochastic games to account for sequential decision making. Thus, any such metric for comparing reward functions would have to be consistent with such a generalization.

- POWER-scarcity results in terms of Nash Equilibria suggest the following dynamic: as agents get smarter and take available opportunities, POWER becomes increasingly scarce. This matches the intuitions presented in [the Catastrophic Convergence Conjecture](/the-catastrophic-convergence-conjecture), where agents don’t fight over resources until they get sufficiently “advanced.”
