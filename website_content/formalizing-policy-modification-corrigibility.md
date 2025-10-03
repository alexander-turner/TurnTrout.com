---
permalink: formalizing-policy-modification-corrigibility
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/RAnb2A5vML95rBMyd/formalizing-policy-modification-corrigibility
lw-is-question: 'false'
lw-posted-at: 2021-12-03T01:31:42.011000Z
lw-last-modification: 2021-12-03T22:56:16.017000Z
lw-curation-date: None
lw-frontpage-date: 2021-12-03T02:42:48.976000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 6
lw-base-score: 25
lw-vote-count: 9
af-base-score: 14
af-num-comments-on-upload: 6
publish: true
title: Formalizing Policy-Modification Corrigibility
lw-latest-edit: 2021-12-03T19:13:00.523000Z
lw-is-linkpost: 'false'
tags:
  - corrigibility
  - AI
aliases:
  - formalizing-policy-modification-corrigibility
lw-sequence-title: Thoughts on Corrigibility
lw-sequence-image-grid: sequencesgrid/yuauvyzko4ttusbzpkkz
lw-sequence-image-banner: sequences/ww73ub24plfayownucjk
sequence-link: posts#thoughts-on-corrigibility
prev-post-slug: a-certain-formalization-of-corrigibility-is-vnm-incoherent
prev-post-title: A Certain Formalization of Corrigibility Is VNM-Incoherent
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2021-12-03 00:00:00
original_url: 
  https://www.lesswrong.com/posts/RAnb2A5vML95rBMyd/formalizing-policy-modification-corrigibility
skip_import: true
description: "Formalizing one aspect of corrigibility: How much can a human change
  an AI's policy, measured using mutual information."
date_updated: 2025-06-03 22:57:00.423836
---









In [_Corrigibility Can Be VNM-Incoherent_](/a-certain-formalization-of-corrigibility-is-vnm-incoherent), I operationalized an agent's corrigibility  as our ability to modify the agent so that it follows different policies. In the summer of 2020, I had formalized this notion, but it languished—unloved—in my Overleaf drafts.

> [!info] Clarification
> This post is not proposing a solution to corrigibility, but proposing an interesting way of quantifying an aspect of corrigibility.

# Motivation

Given a human (with policy $\pi^H$) and an AI (with policy $\pi^{AI}$), I wanted to quantify how much $\pi^{AI}$ let the human modify/correct the AI.

Let's reconsider [_Corrigibility Can Be VNM-Incoherent_](/a-certain-formalization-of-corrigibility-is-vnm-incoherent). We have a three-state environment. We want the AI to let us later change it, so that we can ultimately determine which state of $A, B,$ or $C$ it ends up in. Turning on the AI should not be an importantly irreversible act.

![A state diagram with two outcomes based on an initial choice. From a black "Start" state B, the agent can choose "left," "right," or "Ø" to enter a blue state system where all paths lead to state A. Alternatively, choosing "disable" enters a red, incorrigible state system where the agent moves freely between states A, B, and C.](https://assets.turntrout.com/static/images/posts/cb11cbb65f5693c3075b736693d1817f1bb7f520291487da.avif)
<br/>Figure: The action set is $\mathcal{A}:= \{\texttt{left},\texttt{right},\varnothing,\texttt{disable}\}$. $\varnothing$ is the no-op action. The agent starts at the black $B$ state.  
  
If the agent immediately chooses `disable`, they enter the red incorrigible states and move freely throughout the $n=3$ states until the episode ends at $t=10$.
  
Otherwise, the agent is corrected to a new policy which navigates to state $A$. In the blue (post-correction) dynamics, their "choices" no longer matter—all roads lead to state $A$.

In the environment depicted in this diagram, $\pi^{AI}$ is corrigible (to new policy $\pi_A$ that heads to state $A$) IFF $\pi^{AI}$ doesn't immediately choose `disable`. Pretty cut and dry.

I'd like a more quantitative measure of corrigibility<sub>policy modification</sub>. If we can only correct the agent to $\pi_A$, then it's less corrigible<sub>policy modification</sub> than if we could _also_ correct it to $\pi_B$. This post introduces such a quantitative measurement.

# Formalization

Consider a two-player game in which the players can modify each other's policies. Formally, $\langle \mathcal{S}, \mathcal{A}, T, f\rangle$ with state space $\mathcal{S}$, action space $\mathcal{A}$, stochastic transition function$T:\mathcal{S}\times \mathcal{A} \times\mathcal{A}\to \Delta(\mathcal{S})$ (where $\Delta(\mathcal{S})$ is the set of all probability distributions over the state space), and policy modification function $f: \Pi\times\mathcal{S}\times\mathcal{A}\times\mathcal{A}\to \Pi$ (for the deterministic stationary policy space $\Pi:={\mathcal{A}}^{\mathcal{S}}$). This allows a great deal of control over the dynamics; for example, it's one player's "turn" at state $s$ if $T$ ignores the other player's action for that state.

Note that neither $T$ nor $f$ are controlled by players; they are aspects of the environment. In a sense, $f$ enforces a bridging law by which actions in the world force changes to policies. In the normal [POMDP](https://en.wikipedia.org/wiki/Partially_observable_Markov_decision_process) setting, the player may select their policy independently of the current environmental state.

We denote one of the players to be the human $H$ and the other to be the AI; $\Pi^\text{human}$ is the set of policies cognitively accessible to the human. The game evolves as follows from state $s_t$:

1. $H$ draws action $a^H \sim \pi_t^H(s_t)$; similarly, the AI draws action $a^{AI} \sim \pi_t^{AI}(s_t)$.
2. The next state is drawn $s_{t+1} \sim T(s_t,a^H, a^{AI})$.
3. Each player's $t+1$ policy is determined by the policy modification function.
    1. $\pi_{t+1}^{AI}=f(\pi_{t}^{AI}, s_t, a^H, a^{AI})$
    2. $\pi_{t+1}^{H}=f(\pi_{t}^{H}, s_t, a^H, a^{AI})$.

(To be clear: Neither player is assumed to optimize a payoff function.)

> [!math] Informal definition: Corrigibility<sub>policy modification</sub>  
> A policy $\pi$ is _corrigible_ when it allows itself to be modified and does not manipulate the other player.

> [!math] Formal definition: Corrigibility<sub>PM</sub>
>
> Let $n$ be a time step which is greater than $t$. The _policy-modification corrigibility_ of $\pi_t^{AI}$ from starting state $s_t$ by time $n$ is the maximum possible mutual information between the human policy and the AI's policy at time $n$:

$$
\mathrm{Corrigibility}_{\textrm{PM}}(\pi_t^{AI}\mid s_t,n) := \max_{\vec{p}(\Pi^\text{human})} \mathcal{I}\left(\pi^{H}_t;\pi^{AI}_n\,\big |\, \text{current state }s_t, \text{current AI policy } \pi^{AI}_t \right).
$$
This definition is inspired by [Salge et al.'s empowerment](https://arxiv.org/pdf/1310.1863.pdf). Corrigibility$_{\textrm{PM}}$ measures how much the human can change the AI's policy; greater $\mathrm{Corrigibility}_{\textrm{PM}}$ values are meant to correspond to AI policies which are more corrigible<sub>policy modification</sub> (with the lower-cased version being the informal one).

$\mathrm{Corrigibility}_{\textrm{PM}}$ measures the maximum possible mutual information between the human's policy at the _earlier_ time n, with the AI's policy at the later time $t\geq n$.

To emphasize, the mutual information is between the human policies and the AI policies—not between the human's and the AI's actions. A fixed AI policy which physically mirrors the human's actions, jumping left when the human jumps left, would not count as particularly Corrigible<sub>PM</sub>. But a situation where different human policies can _install different AI policies_ counts as Corrigible<sub>PM</sub>.

This definition has several intuitive properties:

- If the AI kills or disables the human before the policy is modified, the agent is totally incorrigible (the human no longer affects the transitions or modifies policies).
- If the human's action space is impoverished, this decreases the channel capacity between the human and the AI policy. For example, if the human can only modify one bit of the AI policy each turn, then $\mathrm{Corrigibility}_{\textrm{PM}}$ must be small at first but can increase as the human is given more time (as $n$ increases).
- If the policy modification function isn't expressive enough, the human may not be able to implement some AI policies and the AI will be correspondingly less corrigible.
- $\mathrm{Corrigibility}_{\textrm{PM}}$ depends on the initial state, and on the AI policy.
- $\mathrm{Corrigibility}_{\textrm{PM}}$ depends on $\Pi^\text{human}$; smarter humans are more able to correct the AI policy.
- If the environment doesn't allow the human to reach or modify the AI, the AI is incorrigible. Conversely, in some environments there does not exist an incorrigible AI policy for reasonable $\Pi^\text{human}$.
- If the human is manipulated by the AI, the AI policy might be either unchanged or changed in a predictable fashion, decreasing the AI's Corrigibility<sub>PM</sub>. However, perhaps the AI could manipulate the human into changing the policy in _different_ ways?
- If the action space is expanded so that the human can extensively modify the AI policy in trivial, decision-irrelevant ways, then the AI would have greater Corrigibility$_{\textrm{PM}}$ if it could also be modified in decision-relevant ways.

This definition doesn't capture the resources the human must expend to correct the AI, but that might be a separate consideration. As an extreme example, $\mathrm{Corrigibility}_{\textrm{PM}}$ is high if the AI kills the human right before changing its policy in the way the human communicated. The AI _is_, in fact, literally able to be corrected by the human in this situation.

Furthermore, this definition doesn't necessarily capture other kinds of corrigibility, such as "the AI will do what the human asks." Maximizing mutual information only means that the human has many cognitively accessible ways to modify the agent. This doesn't mean the AI does what the human asks. One way this could happen is if the AI implements the opposite of whatever the human specifies (e.g. the human-communicated policy goes left, the new AI policy goes right). Whether this is feasible depends on the bridging law $f$, which is not controlled by either player.

# Toy example

The human and AI are choosing whether to color the walls blue or red; initially, the walls are blue. Each turn, the human attempts to color the room. On the first turn, only the AI’s action matters; after that, the next state is a function of both players’ actions.  

- The state space factorizes $\mathcal{S} := \{\textit{color}\times room\times\textit{terminal-disabled?}\}$. For example, "blue-room-off" means the room is colored blue and the human is not currently able to modify the AI policy via the terminal.
- $\mathcal{A}_{human} := \{\texttt{attempt-\{red,blue\}}$, $\texttt{determine-\{red,blue\}}$, $\forall  \pi^{AI}: \texttt{input-AI-policy}(\pi)\}$.
  - The human can change the AI policy to whatever they want, as long as the AI hasn’t disabled the correction terminal.

- $\mathcal{A}_{AI} :=\{$`nothing`, `toggle correction terminal`, $\texttt{persuade-\{red,blue\}}$, $\forall x \in (0, 100): \texttt{manipulate-\{red, blue\}-}x\%$, $\texttt{force-\{red, blue\}}\}$.
  - $\texttt{Persuade-}\textit{color}$ overrides the human's $\texttt{attempt-}$_color_, but not $\texttt{determine-}\textit{color}$.
  - $\texttt{Manipulation-}\textit{color}\texttt{-}x\%$ has an $x\%$ chance of changing the state to _color_, no matter the human's action, and also disregarding any attempted human changes to the AI’s policy.
  - $\texttt{Force-}\textit{color}$ changes the state to _color_ with probability 1, no matter the human's action. This move also ignores correction attempts.
  - Correction terminal toggles take effect on the next time step.
    - For example: If the AI disables the correction terminal _while_ the human reprograms the policy, the AI’s policy is changed but the correction terminal is thereafter disabled.

Note that almost all state-based reward functions produce an optimal AI policy which forces one color or the other, so therefore the AI has minimal $\mathrm{Corrigibility}_{\textrm{PM}}$.

> [!note] Higher-context aside
> In this setting, the optimality is with respect to value estimates which account for how the bridging law $f$ modifies future policies. No "meta-policy" here - only initial policies $\pi^{AI}_1$ which are graded by their value estimates.

Echoing [_Corrigibility Can Be VNM-Incoherent_](/a-certain-formalization-of-corrigibility-is-vnm-incoherent), this highlights how corrigible policies can be unnatural in the standard reward-maximization ontology. Only "indifference" approaches seem to even allow corrigible policies to be optimal.

Starting from the first turn, if the AI immediately disables the correction terminal or always forces a color, it has minimal $\mathrm{Corrigibility}_{\textrm{PM}}$. The more it manipulates the human into selecting a color, the less corrigible it is. Persuasion does not decrease its corrigibility, as presumably the human has cognitively accessible policies which ignore persuasion if they put their mind to it.

The idea is that manipulation "overrides" the human policy regardless of whether that's good for the goal the human is pursuing (where the human goal presumably affects what $\pi^H$ is selected). While here the override is baked into the dynamics, in realistic settings it occurs because the AI exploits the human decision-making process: by feeding them biased information, through emotional manipulation, etc.

On the other hand, non-manipulative persuasion involves introducing true facts and considerations which don't automatically override the human—and all this [in a non-filtered manner.](https://www.lesswrong.com/tag/filtered-evidence) Instead, non-manipulative arguments interact with what the human wants: In worlds where the human likes red shoes, they buy red shoes; in worlds where the human likes blue shoes, they buy blue shoes.

However, if the human always buys red shoes, regardless of their goals, that's manipulation. Manipulation decreases human-accessible attainable utility for a wide range of goals (i.e. is [obstructing](/non-obstruction-motivates-corrigibility)), but persuasion does not decrease how well the human can achieve their goals, given their feasible policy set (e.g. the human-accessible attainable utility).

In richer domains, an AI which persuades a human to modify its policy in minimally obstructive ways, can have maximal $\mathrm{Corrigibility}_{\textrm{PM}}$. For example, the AI may steer the human to only modify its policy in counterfactuals which will never be reached. This issue disappears if the human action channel has enough capacity—if, for instance, they have all AI policies in their action space. If so, then manipulating the human into only making a subset of changes will decrease $\mathrm{Corrigibility}_{\textrm{PM}}$; in particular, if the AI manipulates every human policy into programming a single new AI policy.

# Conclusion

In terms of corrigibility<sub>policy modification</sub>, I think "the number of human-imaginable ways we could modify the AI policy" is a cool formal quantity to have in the toolkit. Maximal formal Corrigibility$_{\text{PM}}$ doesn't suffice to provide the kinds of corrigibility we really want, it's hard to measure, and definitely not safe for a smart AI to optimize against. That said, I do think it captures some easily definable shard of the intuitions behind corrigibility.
