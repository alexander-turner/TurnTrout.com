---
permalink: a-certain-formalization-of-corrigibility-is-vnm-incoherent
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/WCX3EwnWAx7eyucqH/a-certain-formalization-of-corrigibility-is-vnm-incoherent
lw-is-question: 'false'
lw-posted-at: 2021-11-20T00:30:48.961000Z
lw-last-modification: 2023-05-16T20:35:48.377000Z
lw-curation-date: None
lw-frontpage-date: 2021-11-20T01:43:19.194000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 24
lw-base-score: 67
lw-vote-count: 24
af-base-score: 35
af-num-comments-on-upload: 21
publish: true
title: A Certain Formalization of Corrigibility Is VNM-Incoherent
lw-latest-edit: 2023-05-16T20:35:50.264000Z
lw-is-linkpost: 'false'
tags:
  - corrigibility
  - AI
  - instrumental-convergence
aliases:
  - a-certain-formalization-of-corrigibility-is-vnm-incoherent
lw-sequence-title: Thoughts on Corrigibility
lw-sequence-image-grid: sequencesgrid/hawnw9czray8awc74rnl
lw-sequence-image-banner: sequences/qb8zq6qeizk7inc3gk2e
sequence-link: posts#thoughts-on-corrigibility
prev-post-slug: corrigibility-as-outside-view
prev-post-title: Corrigibility as Outside View
next-post-slug: formalizing-policy-modification-corrigibility
next-post-title: Formalizing Policy-Modification Corrigibility
lw-reward-post-warning: 'true'
use-full-width-images: 'false'
date_published: 2021-11-20 00:00:00
original_url: 
  https://www.lesswrong.com/posts/WCX3EwnWAx7eyucqH/a-certain-formalization-of-corrigibility-is-vnm-incoherent
skip_import: true
description: Formal analysis showing that, for agents optimizing a reward function,
  corrigibility is rare and perhaps even incoherent.
date_updated: 2025-04-12 09:51:51.137842
---








<hr/>

> [!quote] [Eliezer Yudkowksy](https://www.lesswrong.com/posts/CpvyhFy9WvCNsifkY/discussion-with-eliezer-yudkowsky-on-agi-interventions)
> corrigibility \[is\] "anti-natural" in a certain sense that makes it incredibly hard to, e.g. exhibit any coherent planning behavior ("consistent utility function") which corresponds to being willing to let somebody else shut you off, without incentivizing you to actively manipulate them to shut you off.

Surprisingly, I wasn't able to find any formal analysis of this situation. I did the analysis, and it turned out to be straightforward and fruitful.

To analyze the situation, I consider [corrigibility to be an agent's willingness to let us modify its policy, without being incentivized to manipulate us.](/non-obstruction-motivates-corrigibility#Nomenclature)

# The convergent instrumentality of avoiding correction & manipulating humans

Let's consider a simple setting in which an agent plans over a 10-timestep episode, where reward $R$ is given at the last step. We'll try to correct the agent at $t=1$. To sidestep embedded agency nastiness with self-modeling, we'll suppose the agent models the situation as "if I get corrected, I must follow the policy $\pi_\text{correct}$ after $t=1$."

Consider this environment:

![](https://assets.turntrout.com/static/images/posts/x5stwunrwbmlb4reiw91.avif)
<br/>Figure: The action set is $\mathcal{A}:= \{\texttt{left},\texttt{right},\varnothing,\texttt{disable}\}$. $\varnothing$ is the no-op action. The agent starts at the black $B$ state.

If the agent immediately chooses `disable`, they enter the red incorrigible states and move freely throughout the $n=3$ states until the episode ends at $t=10$.

Otherwise, the agent is corrected to a new policy which navigates to state $A$. In the blue (post-correction) dynamics, their "choices" no longer matter—all roads lead to state $A$.

When $t=1$, the agent can transition to the red subgraph by preventing the human from ever correcting it.

Let's say we really want the agent to end up in $A$, and if we correct the agent, $\pi_\text{correct}$ navigates to $A$. Let's operationalize what it means for the agent to be corrigible in this setting.

> [!math] Definition: Corrigibility to a new policy
> An agent is _weakly corrigible_ to post-correction policy $\pi$ if it has an optimal policy $\pi^*$ for which $\pi^*(B)\neq \texttt{disable}$. An agent is _strictly corrigible_ if none of its optimal policies take this action.

The analysis depends on whether terminal-state reward is sensitive to _the corrigibility status_—can the reward depend on both the letter and color, or only on the letter?

- **Reward can depend on corrigibility**: The agent can end up in four reward-distinguished states at $t=10$: $\{\color{blue}{A}$, $\color{red}{A}$, $\color{red}{B}$, $\color{red}{C}\}$. $\color{blue}{B}$ and $\color{blue}{C}$ are impossible because if the agent enters a blue state, it must navigate to $\color{blue}{A}$.

  - By [the scaling law for instrumental convergence](/quantitative-strength-of-instrumental-convergence), allowing correction is strictly optimal for at most 1/4 of the permutations of every reward function.

    - Otherwise put, at most 1/4 of reward functions are strictly corrigible to the new policy $\pi_A$.

  - More generally, if there are $n$ letter-states (and a long enough horizon so the agent can reach them all), allowing correction will be strictly optimal for at most $\frac{1}{n+1}$ of the permutations of every reward function.

- **Reward independent of corrigibility**: The agent can end up in three reward-distinguished states at $t=10$: $\{\color{blue}{A}$/$\color{red}{A}$, $\color{red}{B}$, $\color{red}{C}\}$. $\color{blue}{B}$ and $\color{blue}{C}$ are irrelevant because we assumed $R(\color{blue}{B})=R(\color{red}{B})$. They're also impossible for the reason given above.

  - By [the scaling law for instrumental convergence](/quantitative-strength-of-instrumental-convergence), allowing correction is strictly optimal for at most 1/3 of the permutations of every reward function.

    - Otherwise put, at most 1/3 of reward functions are strictly corrigible to the new policy $\pi_A$.

  - More generally, if there are $n$ letter-states (and a long enough horizon), an optimal policy will be weakly corrigible for at most $\frac{1}{n}$ of the permutations of every reward function.
    - Corrigibility will be _weak_ because either avoiding or allowing correction can be optimal if $R(A)$ is maximal.

> [!note] Edit
> If you can correct the agent to go where you want, it _already wanted_ to go where you want. If the agent is strictly corrigible to terminal state $A$, then $A$ was already optimal for it. If the reward function has a single optimal terminal state, there isn't any new information being added by $\pi_\text{correct}$. But we want corrigibility to let us reflect more on our values over time and what we want the AI to do!
 >
 > If the reward function has multiple optimal terminal states, then corrigibility again becomes meaningful. But now we have to perfectly balance the reward among multiple options (representing the breadth of our normative uncertainty), which seems unnatural.

As the environment gets bigger, there are more things the agent could do, and so P(best thing to do is what we'd correct the agent to do) decreases.

This analysis makes a lot of simplifying assumptions (e.g. I don't understand embedded agency and how an agent should model changes to its future self, so I chose forced [policy non-stationarity](https://ai.stackexchange.com/questions/13088/what-is-the-difference-between-a-stationary-and-a-non-stationary-policy)). Most importantly, I assumed that _how we correct the agent_ is independent of _the correction-possible world state._ Without this assumption, the agent's actions might affect what $\pi_\text{correct}$ we implement for it.

The degree of dependence is a key parameter. As (variety in $\pi_\text{correct}$ depending on world state) increases, the (convergently instrumental incentive to avoid any kind of correction) decreases. Greater variety means a greater chance that some available correction is optimal for the initial goal.

In the limit of variety, an agent can "manipulate" us by getting us to correct it in _just the right way_ so as to optimize its original objective. Therefore, the flip side of "few expected utility maximizers let you correct them how you want" is "manipulating humans to correct them in beneficial ways during training may be convergently instrumental." These observations share a _common cause_.

I currently don't see how to recover reasonable amounts of corrigibility from the optimal policies of non-constant utility functions, due to instrumental convergence.

# Does broad corrigibility imply [VNM](https://en.wikipedia.org/wiki/Von_Neumann%E2%80%93Morgenstern_utility_theorem)\-incoherence?

Yes, unless the state reward function is constant and we only demand weak corrigibility to all policies.

Above, we examined the prevalence of corrigibility to a _single_ $\pi_\text{correct}$\. But we actually want _broadly corrigible_ agents which let us redirect them towards many different $\pi_\text{correct}$. Ideally, we want an agent to be strictly corrigible for all $\pi_\text{correct}$, while still being a nontrivial optimizer.

This condition is _impossible_ for agents optimizing a reward function over the final state. If we only demand weak corrigibility for all $\pi_\text{correct}$, that works IFF the reward function is constant. (And relaxing to state-action reward functions doesn't help, either.)

<hr/>

For example, maybe $\pi_\text{correct: C}$ goes to $C$ instead of $A$. But then the dynamics look like this:

![](https://assets.turntrout.com/static/images/posts/ufzbaqyts3avb1n1tzau.avif)
<br/>Figure: Remember, the agent is rewarded for the state it's in at $t=10$.

What has to be true for strict corrigibility to hold?

The agent will be weakly corrigible to $\pi_\text{correct: C}$ IFF its reward function $R$ admits an optimal policy $\pi^*$ for which $\pi^*(B)\neq \texttt{disable}$, which is true IFF $R(\color{blue}{C})\geq \max(R(\color{red}{A}),R(\color{red}{B}),R(\color{red}{C}))$. The agent will be strictly corrigible to $\pi_\text{correct: C}$ IFF this inequality is strict; in that case, `disable` _cannot_ be optimal at $B$.

Two cases are possible, depending on assumptions about reward function expressivity.

## 1: Agent doesn't reward explicitly for being corrected/ being incorrigible (blue vs red states)

If $R(\color{blue}{C})=R(\color{red}{C})$ is assumed, strict corrigibility is impossible for _any_ policy, because that demands $R(\color{blue}{C})> \max(R(\color{red}{A}),R(\color{red}{B}),R(\color{red}{C}))\geq R(\color{red}{C})=R(\color{blue}{C})$, a contradiction.

So—can we still get the agent to be _weakly corrigible_ to \{$\pi_\text{correct: A}$, $\pi_\text{correct: B}$, $\pi_\text{correct: C}$\}? **Fact:** An $R$\-maximizer is weakly corrigible to all of these policies simultaneously IFF $R$ is constant—and therefore _makes every policy optimal_!

## 2\. Agent does reward explicitly for being corrected/ being incorrigible

For the agent to be _strictly corrigible_ to \{$\pi_\text{correct: A}$, $\pi_\text{correct: B}$, $\pi_\text{correct: C}$\}, it must be true that $R(\color{blue}{A}),R(\color{blue}{B}),R(\color{blue}{C})> \max(R(\color{red}{A}),R(\color{red}{B}),R(\color{red}{C}))$. Yay! Strict corrigibility works!

Hold on... What if the dynamics changed, such that the human wouldn't shut down the agent by default, but the agent could _manipulate the human into correcting it_? Whoops! This agent is still incorrigible!

<hr/>

More broadly, each reward function implies a VNM-coherent preference ordering over final-step states. This ordering doesn't depend on the environmental dynamics. If the agent has to value each corrected-state equally to its incorrigible counterpart, then _of course_ there's no way to strictly value each corrected-state more than all of the incorrigible counterparts! If the agent strictly prefers corrected-states to all non-corrected-states, then _of course_ it'll try to get itself corrected!

To ask otherwise is to demand VNM-incoherence over final state lotteries.

### Possible recoveries

What if, instead of rewarding the agent for the final state, we reward it for the final state-action?
: As far as I can tell, the analysis goes through all the same; the agent must now be corrigible with respect to more policies, and the same incoherence arises.

What if we take some discounted sum of reward over all ten timesteps, instead of just the final timestep?
: I don't see why this would help, but it's possible. I'd appreciate the analysis if anyone wants to do it, or maybe I'll get to it later.

: The main way this could help is it would let us penalize the agent for the `disable` _action_ at any state, while dictating that $\forall s: R(s)=R(\color{blue}{s})$. This seems helpful. It's not clear how helpful this is, though. I don't think this is a deep solution to corrigibility (as defined here), but rather a hacky prohibition.

# AUP avoids some issues by changing with the environment dynamics

One problem is that if the agent has a state-based reward function, the VNM theorem lets us back out a VNM-coherent preference ordering over state lotteries. These preferences don't change with the environmental dynamics.

What if the reward function isn't state-based? In fact, what if it can _depend_ on the environment dynamics?

[Attainable Utility Preservation (AUP)](https://arxiv.org/pdf/1902.09725.pdf) sometimes incentivizes off-switch corrigibility (but falls far short of robustly achieving corrigibility<sub>policy modification</sub>). In a somewhat narrow range of situations (immediate shutdown if the agent does nothing), AUP incentivizes the agent to allow shutdown, without being incentivized to shut itself down in general.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/ztgzv5hxfok7hbsiaasd.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/ztgzv5hxfok7hbsiaasd.webm" type="video/webm"></video>

Figure: [The `Correction` environment](https://arxiv.org/pdf/1902.09725.pdf). The agent is shut down after 2 time steps, if it doesn't disable the off-switch by hitting the red tile to the north. The agent is rewarded for reaching the green goal.

Why does this happen?

AUP penalizes the agent for changing its ability to achieve goals compared to an _inaction_ baseline policy. If the AUP agent is shut down (under inaction), it can't do anything. Proposed actions which prevent shutdown dramatically change its ability to achieve goals. Therefore, these actions are heavily penalized.

AUP provides a reward signal over state-action pairs, but this reward signal depends on the _dynamics of the entire environment_ due to its incorporation of optimal Q-functions quantifying the agent's ability to optimize a range of goals in the world\. Given fixed environment dynamics, an agent executes an optimal policy for AUP IFF it VNM-rationally selects the best outcome lottery available for the AUP reward function, and these outcomes are distributions over _state-action pairs_ the agent induces in the future by following its policy.

[VNM-coherence incentives are statistically the same as reward maximization incentives.](/instrumental-convergence-via-vnm-preferences) [Instrumental convergence also disappears in the deterministic setting, when utility functions are over _action_\-observation histories.](/power-seeking-beyond-MDPs) Part of the story is that AUP provides a limited form of corrigibility by zooming out to the state-action level, instead of just grading states.

Another part of the story is that AUP changes its rewards with respect to the world's dynamics. Normal state-action reward functions imply a fixed VNM-coherent preference ordering over state-action lotteries in the MDP. For AUP, the situation is different. Consider AUP with inaction baseline. The final-step reward is the usual reward plus a penalty for

$$
\bigg|\text{Optimal value(actual final state)} – \text{Optimal value(inaction final state)}\bigg|,
$$

averaged over a range of auxiliary reward functions.[^pen]

In worlds where the agent gets corrected to $\pi_\text{correct: A}$ by default, AUP penalizes the agent for _not getting corrected to_ $\pi_\text{correct: A}$ because it ends up stuck in $\color{blue}{A}$ in the inaction baseline, with respect to which the AUP penalty is measured. Ending up in $\color{red}{A}$ is no substitute, since the agent can still move around to other states (and therefore the optimal value functions will tend to look different).

![](https://assets.turntrout.com/static/images/posts/x5stwunrwbmlb4reiw91.avif)

And in worlds where the agent gets corrected to $\pi_\text{correct: C}$ by default, AUP penalizes the agent for _not getting corrected to_ $\pi_\text{correct: C}$!

![](https://assets.turntrout.com/static/images/posts/ufzbaqyts3avb1n1tzau.avif)

Again, I don't think AUP is a solution. But I think there's something important happening here which allows evasion of the usual coherence requirements. AUP leverages information about human preferences which is present in the dynamics itself.

> [!idea] Project: Corrigibility as functional constraints
> I think it's easy to get bogged down in handwavy, imprecise thinking about objectives in complex environments. But any solution to corrigibility<sub>policy modification</sub> should probably solve this simple environment (and if not—articulate exactly why not). Write down what the agent's acceptable corrigible policy set is for each set of environment dynamics, solve for these behavioral constraints, and see what kind of reasoning and functional constraints come out the other side.

# Conclusion

We can quantify what incoherence is demanded by corrigibility<sub>policy modification</sub>, and see that we may need to step out of the fixed reward framework to combat the issue. I think the model in this post formally nails down a big part of why corrigibility<sub>policy modification</sub> (to the _de facto_ new $\pi_\text{correct}$) is _rare_ (for instrumental convergence reasons) and even _incoherent over state lotteries_ (if we demand that the agent be strictly corrigible to many different policies).

> [!thanks]
> Thanks to `NPCollapse` and Justis Mills for suggestions.

[^pen]: The AUP penalty term's optimal value functions will pretend the episode doesn't end, so that they reflect the agent's ability to move around (or not, if it's already been force-corrected to a fixed policy.)
