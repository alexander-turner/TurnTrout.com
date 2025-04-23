---
permalink: toy-instrumental-convergence-paper-walkthrough
lw-was-draft-post: 'false'
lw-is-af: 'false'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/KXMqckn9avvY4Zo9W/walkthrough-of-formalizing-convergent-instrumental-goals
lw-is-question: 'false'
lw-posted-at: 2018-02-26T02:20:09.294000Z
lw-last-modification: None
lw-curation-date: None
lw-frontpage-date: 2018-02-26T02:20:11.439000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 2
lw-base-score: 13
lw-vote-count: 7
af-base-score: 6
af-num-comments-on-upload: 0
publish: true
title: Walkthrough of 'Formalizing Convergent Instrumental Goals'
lw-latest-edit: 2018-02-26T02:20:09.294000Z
lw-is-linkpost: 'false'
tags:
  - AI
  - instrumental-convergence
aliases:
  - walkthrough-of-formalizing-convergent-instrumental-goals
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2018-02-26 00:00:00
original_url: 
  https://www.lesswrong.com/posts/KXMqckn9avvY4Zo9W/walkthrough-of-formalizing-convergent-instrumental-goals
skip_import: true
description: "Proof of instrumental convergence: Even if an AI's goals seem unrelated
  to humanity, it may still turn us into paperclips. "
date_updated: 2025-04-13 13:06:04.177811
---







# Introduction

I found _[Formalizing Convergent Instrumental Goals](https://intelligence.org/files/FormalizingConvergentGoals.pdf)_ (Benson-Tilsen and Soares) to be quite readable. I was surprised that the instrumental convergence hypothesis had been formulated and proven (within the confines of a reasonable toy model); this caused me to update slightly upwards on existential risk from unfriendly AI.

This paper involves the mathematical formulation and proof of [instrumental convergence](https://en.wikipedia.org/wiki/Instrumental_convergence), within the aforementioned toy model. Instrumental convergence says that an agent  $\mathcal{A}$ with utility function  $U$ will pursue instrumentally relevant subgoals, even though this pursuit may not bear directly on  $U$. Imagine that  $U$ involves the proof of the [Riemann hypothesis](https://en.wikipedia.org/wiki/Riemann_hypothesis).  $\mathcal{A}$ will probably want to gain access to lots of computronium. What if  $\mathcal{A}$ turns _us_ into [computronium](https://en.wikipedia.org/wiki/Computronium)? Well, there's plenty of matter in the universe;  $\mathcal{A}$ could just let us be, right? Wrong. Let's see how to prove it.

## My Background

I'm a second-year CS PhD student. I've recently started working through the [MIRI research guide](https://intelligence.org/research-guide/); I'm nearly finished with [Naïve Set Theory](http://smile.amazon.com/Naive-Set-Theory-Paul-Halmos/dp/1614271313/), which I intend to review soon. To expose my understanding to criticism, I'm going to summarize this paper and its technical sections in a somewhat informal fashion. I'm aware that the paper isn't particularly difficult for those with a mathematical background. However, I think this result is important, and I couldn't find much discussion of it.

# Intuitions

It is important to distinguish between the relative unpredictability of the _exact_ actions selected by a superintelligent agent, and the relative predictability of the general kinds-of-things such an agent will pursue:

> [!quote] [_Belief in Intelligence_](http://lesswrong.com/lw/v8/belief_in_intelligence/),
>
> Suppose Kasparov plays against some mere chess grandmaster Mr. G, who's not in the running for world champion. My own ability is far too low to distinguish between these levels of chess skill. When I try to guess Kasparov's move, or Mr. G's next move, all I can do is try to guess "the best chess move" using my own meager knowledge of chess. Then I would produce exactly the same prediction for Kasparov's move or Mr. G's move in any particular chess position. So what is the empirical content of my belief that "Kasparov is a _better_ chess player than Mr. G"?
>
> ...
>
> The _outcome_ of Kasparov's game is predictable because I know, and understand, Kasparov's goals. Within the confines of the chess board, I know Kasparov's motivations - I know his success criterion, his utility function, his target as an optimization process. I know where Kasparov is _ultimately_ trying to steer the future and I anticipate he is powerful enough to get there, although I don't anticipate much about _how_ Kasparov is going to do it.

In other words: we may not be able to predict precisely how Kasparov will win a game, but we can be fairly sure his plan will involve _instrumentally convergent_ subgoals, such as the capture of his opponent's pieces. For an unfriendly AI, these subgoals probably include nasty things like hiding its true motives as it accumulates resources.

# Definitions

Consider a discrete universe made up of  $n$ squares, with square  $i$ denoted by  $S_i$ (we may also refer to this as _region_  $i$). Let's say that Earth and other things we do (or "should") care about are in some region  $h$. If  $U(S_i)$ is the same for all possible values, we say that  $\mathcal{A}$ is _indifferent_ to region  $i$. The  $3\uparrow \uparrow \uparrow 3$ dollar question is whether  $\mathcal{A}$ (whose  $U$ is indifferent to  $S_h$) will leave  $S_h$ alone. First, however, we need to define a few more things.

## Actions

At any given time step (time is also considered discrete in this universe),  $\mathcal{A}$ has a set of actions  $A_i$ it can perform in  $S_i$;  $\mathcal{A}$ may select an action for each square. Then, the transition function for  $S_i$ (how the world evolves in response to some action  $a_i$) is a function whose domain is the [Cartesian product](https://en.wikipedia.org/wiki/Cartesian_product) of the possible actions and the possible state values,  $T_i : A_i \times S_i \to S_i$ ; basically, every combination of what  $\mathcal{A}$ can do and what can be in  $S_i$ can produce a distinct new value for  $S_i$. This transition function can be defined globally with lots more Cartesian products. Oh, and  $\mathcal{A}$ is always allowed to do nothing in a given square, so  $A_i$ is never empty.

## Resources

Let  $\mathcal{R}$ represent all of the resources to which  $\mathcal{A}$ may or may not have access. Define  $R_t \in \mathcal{P}(\mathcal{R})$ to be the resources at  $\mathcal{A}$'s disposal at time step  $t$ - basically, we know it's some combination of the defined resources  $\mathcal{R}$.

 $\mathcal{A}$ may choose some resource allocation  $ \coprod{R^t_i} \subseteq R^t$ over the squares; this allocation is defined just like you'd expect (so if you don't know what [the upside-down Dark Portal](https://assets.turntrout.com/static/images/posts/wowlogin.avif) has to do with resource allocation, don't worry about it). The resources committed to a square may affect the local actions available.  $\mathcal{A}$ can only choose actions permitted by the selected allocation. Equally intuitively, how resources change over time is a function of the current resources, the actions selected, and the state of the universe; the resources available after a time step is the combination of what we didn't use and what each square's resource transition function gave us back.

Resources go beyond raw materials to include things like machines and technologies. The authors note:

> [!quote] Formalizing convergent instrumental goals
> We can also represent space travel as a convergent instrumental goal by allowing  $\mathcal{A}$ only actions that have no effects in certain regions, until it obtains and spends some particular resources representing the prerequisites for traveling to those regions. (Space travel is a convergent instrumental goal because gaining influence over more regions of the universe lets  $\mathcal{A}$ optimize those new regions according to its values or otherwise make use of the resources in that region.)

## Universe

A universe-history is a sequence of states, actions, and resources. The actions must conform to resources available at each step, while the states and resources evolve according to the transition functions.

We say a _strategy_ is an action sequence  $\langle \bar{a}^0, \bar{a}^1,...,\bar{a}^k\rangle$ over all  $k$ time steps and  $n$ regions; define a _partial strategy_  $\langle \bar{a}^k \rangle_L$ to be a strategy for some part of the universe  $L$ (represented as a subset of the square indices  $[n]$);  $\langle \bar{a}^k \rangle_L$ only allocates resources and does things in the squares of  $L$. We can combine partial strategies as long as they don't overlap in some  $S_i$.

We call a strategy _feasible_ if it complies with both resource restrictions and the transition functions for both states and resources. Let  $\texttt{Feasible}(\langle P^k\rangle)$ be the set of all feasible strategies given resource allocation over time  $\langle P^k \rangle$; define the set  $\texttt{Feasible}_L(\langle R^k \rangle)$ similarly. [^1]

## Utility

Utility functions evaluate states of the universe;  $U$ evaluates each region and then combines them:  $U(\bar{s}):= \sum_{i \in [n]}{U_i(\bar{s}_i)}$. Observe that since actions taken in regions to which  $U$ is indifferent have no effect on  $U$, any actions taken therein are purely instrumental in nature.

## Agent

 $\mathcal{A}$ chooses the best possible strategy - that is, the one that maximizes the  $U$ of the final state of the universe-history:  $\mathcal{A}:= \text{argmax}_{\langle \bar{a}^k \rangle \in \texttt{Feasible}} U(\langle \bar{a}^k \rangle)$. Note that this definition implies a Cartesian boundary between the agent and the universe; that is,  $\mathcal{A}$ doesn't model itself as part of the environment (it [isn't naturalized](https://www.lesswrong.com/posts/ethRJh2E7mSSjzCay/building-phenomenological-bridges)).

# Seizing the Means of Cartesian Production

Let's talk about the situations in which  $\mathcal{A}$ will seize resources; that is, when  $\mathcal{A}$ will take actions to increase its resource pool.

> [!quote] Formalizing convergent instrumental goals
> Since resources can only lead to more freedom of action, they are never detrimental, and resources have positive value as long as the best strategy the agent could hope to employ includes an action that can only be taken if the agent possesses those resources. Hence, if there is an action that increases the agent's pool of resources  $R$, then the agent will take that action unless it has a specific incentive from  $U$ to avoid taking that action.

Define a _null action_ to be any action which doesn't produce new resources. It's easy to see that null actions are never instrumentally valuable. What we want to show is that  $\mathcal{A}$ will take non-null actions in regions to which  $U$ is indifferent; regions like  $h$, where we live, grow, and love. Regions full of instrumentally valuable resources.

## Discounted Lunches

An action _preserves_ resources if the input resources are strictly contained in the outputs (nothing is lost, and resources are sometimes gained). A _cheap lunch_ is a feasible partial strategy in some subset of squares  $J$, which is feasible given resources  $\langle R^k \rangle$ and whose constituent actions preserve resources. A _free lunch_ is cheap lunch that doesn't require resources.

> [!quote] Formalizing convergent instrumental goals
> This is intended to model actions that "pay for themselves"; for example, producing solar panels will incur some significant energy costs, but will later pay back those costs by collecting energy.

A cheap lunch is _compatible with_ a global strategy if the resources required for the lunch are available for use in  $J$ at each time step. Basically, at no point does the partial strategy require resources already being used elsewhere.

## Possibility of Non-Null Actions

We show that it's really hard to assert that  $\mathcal{A}$ won't chow down on a lunch of an atom or two (or  $1.3×10^{50}$).

> [!math] Lemma 1: Cheap lunches and utility
>
> Cheap lunches don't reduce utility. Let's say we have a cheap lunch  $\langle \bar{a}^k \rangle_{\{i\}}$ in region  $i$ and some global strategy  $\langle \bar{b}^k \rangle$ (which only takes null actions in region  $i$). Assume the cheap lunch is compatible with the global strategy; this means the cheap lunch is feasible. If  $\mathcal{A}$ is indifferent to region  $i$, the conjugate strategy (of the cheap lunch and the remainder of the global strategy) has equal utility to  $\langle \bar{b}^k \rangle$.
>
> _Proof._ We show feasibility of the conjugate strategy by demonstrating we don't need to change resource allocation elsewhere. This is done by induction over time steps. Since  $\mathcal{A}$ isn't doing anything in region  $i$ under strategy  $\langle \bar{b}^k \rangle$, taking resource-preserving actions instead cannot reduce what  $\mathcal{A}$ is later able to do in the regions relevant to  $U$. This implies that  $U$ cannot be decreased by taking the cheap lunch. ∎

> [!math] Theorem 1: Cheap Lunches and Optimality
>
> If there is an optimal strategy and a compatible cheap lunch in region  $i$ (to which  $\mathcal{A}$ is indifferent), there's also an optimal strategy with a non-null action in region  $i$.
>
> _Proof._ If the optimal strategy has non-null actions in region  $i$, we're done. Otherwise, apply Lemma 1 to derive a conjugate strategy taking advantage of the cheap lunch. Since it follows from Lemma 1 that the conjugate strategy has equal utility, it is optimal and involves non-null action in region  $i$.

> [!math] Corollary 1: Free lunches and optimality
>
> If there is an optimal strategy and a free lunch in region  $i$, and if  $\mathcal{A}$ is indifferent to region  $i$, there's an optimal strategy with non-null action in region  $i$.
>
> _Proof._ Free lunches require no resources, so they are compatible with any strategy; apply Theorem 1.
>
> For instrumental convergence to not hold, we would have to show that every possible strategy in  $h$ isn't a cheap lunch for any optimal strategies. ∎

We show that as long as  $\mathcal{A}$ can extract useful resources (resources whose availability leads to increased utility), it will.

> [!math] Theorem 2: Necessity of non-null actions
>
> Consider the maximum utility achievable outside of region  $i$ via strategies achievable without additional resources; refer to this maximum as  $u$. Suppose we have some feasible primary strategy  $\langle \bar{b}^k \rangle_{[n]-i}$ and a cheap lunch  $\langle \bar{c}^k \rangle_{\{i\}}$ feasible using resources  $\langle P^k \rangle$. Suppose that the cheap lunch is compatible with the primary strategy, that the cheap lunch provides the resources necessary for the implementation of the primary strategy, and that the utility of the primary strategy is greater than  $u$. Then if  $\mathcal{A}$ is indifferent to region  $i$, all optimal strategies have a non-null action in region  $i$.
>
> _Proof._ Consider the conjugate strategy  $\langle \bar{d}^k \rangle$, consisting of the primary strategy and the cheap lunch. Allocate the resources gained via the cheap lunch according to the primary strategy. This allocation is feasible since we know the cheap lunch is compatible with the primary strategy, which is in turn enabled by these resources gained.
>
> Consider any strategy  $\langle \bar{e}^k \rangle$ that doesn't do anything in  $i$ and doesn't require any resource inputs; it's trivial to see that this is feasible. Since  $\mathcal{A}$ is indifferent to  $i$, we do some algebraic substitution of utility values to see that the conjugate plan has strictly higher utility than  $\langle \bar{e}^k \rangle$ does. This means that  $\langle \bar{e}^k \rangle$ is suboptimal. ∎

> [!math] Theorem 3: Defection Threshold
>
> Even if  $U$ is not indifferent about  $i$, we can prove Theorem 2 can still hold if the utility  $\mathcal{A}$ gains by enacting the aforementioned conjugate strategy is greater than the maximal amount  $U$ cares about  $i$ (formally expressed by  $\max_{s, s' \in S_i}{|U_i(s) - U_i(s')|}$).
>
> _Proof._ The structure is similar to that of Theorem 2; just use the new maximum caring differential in the algebraic substitution. ∎

> [!quote] Formalizing convergent instrumental goals
> We interpret Theorem 3 as a partial confirmation of Omohundro's thesis in the following sense. If there are actions in the real world that produce more resources than they consume, and the resources gained by taking those actions allow agents the freedom to take various other actions, then we can justifiably call these actions "convergent instrumental goals." Most agents will have a strong incentive to pursue these goals, and an agent will refrain from doing so only if it has a utility function over the relevant region that strongly disincentivizes those actions.

# The Bit Universe

The authors introduce a toy model and use the freshly proven theorems to illustrate how  $\mathcal{A}$ takes non-null actions in our precious  $S_h$ (both when it is indifferent to  $h$ and when it is not). This isn't good; the vast majority of utility-maximizing agents will not steer us towards futures we find desirable. If you're interested, I recommend reading this section for yourself, even if you aren't comfortable with math.

# Our Universe

> [!quote] Formalizing convergent instrumental goals
> The path that our model shows is untenable is the path of designing powerful agents intended to autonomously have large effects on the world, maximizing goals that do not capture all the complexities of human values. If such systems are built, we cannot expect them to cooperate with or ignore humans, by default.

We have much work to do. The risks are enormous and the challenges "[impossible](http://lesswrong.com/lw/up/shut_up_and_do_the_impossible/)", but we have time on the clock. [AI safety research is primarily talent-constrained](https://80000hours.org/career-reviews/artificial-intelligence-risk-research/). If you've been sitting on the sidelines, wondering whether you're good enough to learn the material - well, I can't make any promises. But if you feel the burning desire to _do something_, [to put forth some extraordinary effort](http://lesswrong.com/lw/uo/make_an_extraordinary_effort/), [to become stronger](http://lesswrong.com/lw/h8/tsuyoku_naritai_i_want_to_become_stronger/) - I invite you to contact me so we can work through the material together.

# Appendix: Questions and Errata

- Page 4, left column, last line: why is that  $\cup \:P^t$ - shouldn't we take the union of the outputs and whatever resources _weren't_ used at time  $t$?
- Page 8, right column, second full paragraph, last line: should be "we have two options available _to_ us".

[^1]: By the axiom of substitution,  
  $$
  \texttt{Feasible}(\langle P^k\rangle)= \{\langle \bar{a}^k \rangle : \textit{isFeasible}(\langle P^k\rangle, \langle \bar{a}^k \rangle)\}.
  $$
