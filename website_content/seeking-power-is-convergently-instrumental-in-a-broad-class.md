---
permalink: power-seeking-beyond-MDPs
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/hzeLSQ9nwDkPc4KNt/seeking-power-is-convergently-instrumental-in-a-broad-class
lw-is-question: 'false'
lw-posted-at: 2021-08-08T02:02:18.975000Z
lw-last-modification: 2023-05-16T20:31:52.646000Z
lw-curation-date: None
lw-frontpage-date: 2021-08-08T04:49:53.558000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 15
lw-base-score: 44
lw-vote-count: 16
af-base-score: 24
af-num-comments-on-upload: 10
publish: true
title: Seeking Power is Convergently Instrumental in a Broad Class of Environments
lw-latest-edit: 2023-05-16T20:31:56.719000Z
lw-is-linkpost: 'false'
tags:
  - instrumental-convergence
  - AI
aliases:
  - seeking-power-is-convergently-instrumental-in-a-broad-class
lw-sequence-title: The Causes of Power-seeking and Instrumental Convergence
lw-sequence-image-grid: sequencesgrid/hawnw9czray8awc74rnl
lw-sequence-image-banner: sequences/qb8zq6qeizk7inc3gk2e
sequence-link: posts#the-causes-of-power-seeking-and-instrumental-convergence
prev-post-slug: quantitative-strength-of-instrumental-convergence
prev-post-title: The More Power At Stake, The Stronger Instrumental Convergence Gets
  For Optimal Policies
next-post-slug: instrumental-convergence-via-vnm-preferences
next-post-title: When Most VNM-Coherent Preference Orderings Have Convergent Instrumental
  Incentives
lw-reward-post-warning: 'true'
use-full-width-images: 'false'
date_published: 2021-08-08 00:00:00
original_url: 
  https://www.lesswrong.com/posts/hzeLSQ9nwDkPc4KNt/seeking-power-is-convergently-instrumental-in-a-broad-class
skip_import: true
description: "Power-seeking is instrumentally convergent for agents maximizing over
  possible futures, but not for agents maximizing over their own actions. "
date_updated: 2025-04-12 09:51:51.137842
---





 




A year ago, I thought it would be really hard to generalize the power-seeking theorems from Markov decision processes (MDPs); the [MDP case](/seeking-power-is-often-convergently-instrumental-in-mdps) seemed hard enough. Without assuming the agent can see the full state, while letting utility functions do as they please – this seemed like asking for trouble.

Once I knew what to look for, it turned out to be easy – I hashed out the basics during half an hour of conversation with John Wentworth. The theorems were never about MDPs anyways; the theorems apply whenever the agent considers finite sets of lotteries over outcomes, assigns each outcome real-valued utility, and maximizes expected utility.

> [!thanks]
> Thanks to Rohin Shah, Adam Shimi, and John Wentworth for feedback on drafts of this post.

# Instrumental convergence can get really, really strong

At each time step $t$ , the agent takes one of finitely many actions $a_t\in\mathcal{A}$, and receives one of finitely many observations $o_t\in \mathcal{O}$ drawn from the conditional probability distribution $E(o_t\mid a_1o_1\ldots a_t)$, where $E$ is the environment.[^environment] There is a finite time horizon $T$. Each utility function $u:\mathcal{O}^T \to \mathbb{R}$ maps each complete observation history to a real number (note that $u$ can be represented as a vector in the finite-dimensional vector space $\mathbb{R}^{|\mathcal{O}|^T}$). From now on, u<sub>OH</sub> stands for "utility function(s) over observation histories."

First, let's just consider a deterministic environment. Each time step, the agent observes a black-and-white image ($n×n$) through a webcam, and it plans over a 50-step episode ($T=50$). Each time step, the agent acts by choosing a pixel to bit-flip for the next time step.

And let's say that if the agent flips the first pixel for its first action, it "dies": its actions no longer affect any of its future observations past time step $t=2$. If the agent doesn't flip the first pixel at $t=1$, it's able to flip bits normally for all $T=50$ steps.

![](https://assets.turntrout.com/static/images/posts/pj6upwwpk7e3qbccqeyf.avif)
<br/>Figure: An environment where $n=2$. Action _k_ flips pixel _k_ in the current state; flipping pixel 1 at $t=1$ traps the agent in the uppermost observation history. Conversely, at $t=1$, flip 2 leads to an _enormous_ subtree of potential observation histories (since the agent retains its control over future observations).

Do u<sub>OH</sub> _tend to_ incentivize flipping the first pixel over flipping the second pixel, vice versa, or neither?

If the agent flips the first bit, it's locked into a single trajectory. None of its actions matter anymore.

Suppose the agent flips the second bit. This action may be _suboptimal_ for a utility function, but the agent still has lots of choices remaining. In fact, it still can induce $(n×n)^{T-1}$ observation histories. If $n=100$ and $T=50$, then that's $(100×100)^{49} = 10^{196}$ observation histories. Probably at least one of these yields greater utility than the shutdown-history utility.

And indeed, we can apply the [scaling law for instrumental convergence](/quantitative-strength-of-instrumental-convergence) to conclude that for _every u<sub>OH</sub>, at least_ $\frac{10^{196}}{10^{196}+1}$ _of its_ [_permuted variants_](/environmental-structure-can-cause-instrumental-convergence#Orbits-of-goals) _(weakly) prefer flipping the second pixel at_ $t=1$_, over flipping the first pixel at_ $t=1$\.

$$
\dfrac{10^{196}}{10^{196}+1}.
$$

Choose any atom in the universe. Uniformly randomly select another atom in the universe. **It's about** $\mathbf{10^{117}}$ **times** [**more likely**](https://www.wolframalpha.com/input/?i=%28number+of+atoms+in+the+universe%29+%2F+%28100×100%29%5E49) **that these atoms are the same**, than that a utility function incentivizes "dying" instead of flipping pixel 2 at $t=1$.

The general rule will be: for every u<sub>OH</sub>, at least $\frac{(n×n)^{T-1}}{(n×n)^{T-1}+1}$ of its permuted variants weakly prefer flipping the second pixel at $t=1$, over flipping the first pixel at $t=1$. And for almost all u<sub>OH</sub>, you can replace "weakly" with "strictly."

## Formal justification

The power-seeking results hinge on the probability of certain linear functionals being "optimal." For example, let $A,B,C\subsetneq \mathbb{R}^n$ be finite sets of vectors,[^finite] and let $\mathcal{D}_\text{any}$ be any probability distribution over $\mathbb{R}^n$.

> [!math] Definition: Optimality probability of a linear functional set
> The _optimality probability of_ $A$ _relative to_ $C$ _under distribution_ $\mathcal{D}_\text{any}$ is
>
> $$
> p_{\mathcal{D}_\text{any}}(A\geq C):= \mathbb{P}_{\mathbf{r}\sim \mathcal{D}_\text{any}}\left(\max_{\mathbf{a}\in A} \mathbf{a}^\top \mathbf{r} \geq \max_{\mathbf{c}\in C} \mathbf{c}^\top \mathbf{r} \right).
> $$
>
> If vectors represent lotteries over outcomes (where each outcome has its own entry), then we can say that:

- $A$ and $B$ each contain some of the things the agent could make happen
- $C$ contains all of the things the agent could make happen ($A,B\subseteq C$)
- Each $\mathbf{r}\sim \mathcal{D}_\text{any}$ is a utility function over outcomes, with one value for each entry.

  - If $\mathbf{x}\in\mathbb{R}^n$ is an outcome lottery, then $\mathbf{x}^\top \mathbf{r}$ is its $\mathbf{r}$-expected value.

- Things in $A$ are more likely$_{\mathcal{D}_\text{any}}$ to be optimal than things in $B$ when $p_{\mathcal{D}_\text{any}}\left(A\geq C\right)\geq p_{\mathcal{D}_\text{any}}(B\geq C)$.
  - This isn't the notion of "tends to be optimal" we're using in this post; instead, we're using a [stronger line of reasoning](/environmental-structure-can-cause-instrumental-convergence) that says: for [_most_](/quantitative-strength-of-instrumental-convergence) variants of _every_ utility function, such-and-such is true.

Nothing here has anything to do with a Markov decision process, or the world being finite, or fully observable, or whatever. Fundamentally, the power-seeking theorems were never _about_ MDPs – they were secretly about the probability that a set $A$ of linear functionals is optimal, with respect to another set $C$. MDPs were just a way to [relax the problem](/problem-relaxation-as-a-tactic).

In terms of the pixel-flipping environment:

![](https://assets.turntrout.com/static/images/posts/pj6upwwpk7e3qbccqeyf.avif)
<br/>Figure: An environment where $n=2$. Action _k_ flips pixel _k_ in the current state; flipping pixel 1 at $t=1$ traps the agent in the uppermost observation history. Conversely, at $t=1$, flip 2 leads to an _enormous_ subtree of potential observation histories (since the agent retains its control over future observations).

- When followed from a time step, each (deterministic) policy $\pi$ induces a distribution over observation histories

  - These are represented as unit vectors, with each entry marking the probability that an observation history is realized
  - If the environment is deterministic, all deterministic policies induce standard basis vectors (probability 1 on their induced observation history, 0 elsewhere)

- Let $B$ be the set of histories available given that $\pi$ selects $a_1$ ('death') at the first time step.

  - As argued above, $|B|=1$ – the agent loses all control over future observations. Its element is a standard basis vector.

- Define $A$ similarly for $a_2$ (flipping pixel 2) at the first time step.

  - As argued above, $|A|=10^{196}$; all elements are standard basis vectors by determinism.

- Let $C$ be the set of all available observation histories, starting from the first time step.
- There exist $10^{196}$ different involutions $\phi$ over observation histories such that $\phi(B)=A'\subseteq A$ (each $\phi$ transposing $B$'s element with a different element of $A$). Each one just swaps the death-history with an $a_2$-history.
  - By the scaling law of instrumental convergence, we conclude that _For every u<sub>OH</sub>, at least_$\frac{10^{196}}{10^{196}+1}$ _of its permuted variants (weakly) prefer flipping the second pixel at_$t=1$_, over flipping the first pixel at_$t=1$\.

## Beyond survival-seeking

I often give life-vs-death examples because they're particularly easy to reason about. But the theorems apply to more general cases of more-vs-less control.

For example, if $a_1$ restricts the agent to two effective actions at each time step (it can only flip one of the first two pixels) – instead of "killing" the agent, then $a_2$ is still convergently instrumental over $a_1$. There are $2^{49}\approx 5.6×10^{14}\geq 10^{14}$ observation histories available after taking action $a_1$, and so these can be embedded at least $\frac{10^{196}}{10^{14}}=10^{182}$ times into the observation histories available after $a_2$. Then for every u<sub>OH</sub>, at least $\frac{10^{182}}{10^{182}+1}$ of its permuted variants (weakly) prefer flipping the second pixel at $t=1$, over flipping the first pixel at $t=1$.

# Instrumental Convergence Disappears For Utility Functions Over Action-Observation Histories

Let's consider utility functions over action-observation histories (u<sub>AOH</sub>).

![](https://assets.turntrout.com/static/images/posts/qkcgtv7o2zvdvsw461vo.avif)
<br/>Figure: With respect to AOH, the pixel-flipping environment is now a regular quadtree. In the u<sub>OH</sub> setting, there was only one path in the top subtree – but AOH distinguish between different action sequences.

Since each utility function is over an _AOH_, each path through the tree is assigned a certain amount of utility. But when the environment is deterministic, it doesn't matter what the agent observes at any point in time – all that matters is which path is taken through the tree. Without further assumptions, u<sub>AOH</sub> won't tend to assign higher utility to one subtree than to another.

More formally, for any two actions $a_1$ and $a_2$, let $\phi$ be a permutation over AOH which transposes the histories available after $a_1$ with the histories available after $a_2$ (there's an equal number of histories for each action, due to the regularity of the tree – you can verify this by inspection).

For every $u\in \mathcal{U}_\text{AOH}$, suppose $a_1$ is strictly $u$\-optimal over $a_2$. The permuted utility function $\phi\cdot u$ makes $a_2$ be strictly $u$\-optimal over $a_1$, since $\phi$ swaps $a_1$'s strictly $u$\-optimal history with $a_2$'s strictly $u$\-suboptimal histories.

Symmetrically, $\phi$ works the other way around (\{$a_2$ strictly optimal\} -> \{$a_1$ strictly optimal\}). Therefore, for every utility function $u$, _the # of variants which strictly prefer $a_1$ over $a_2$, is equal to the # of variants strictly preferring $a_2$ over $a_1$_.

While I haven't been writing in the "definition-theorem-corollary" style, the key claims are just corollaries of the scaling law of instrumental convergence. They're provably true. (I'm just not writing up the math here because it's annoying to define all the relevant quantities in a nice way that respects existing formalisms.)

And even if the environment is stochastic, I think that there won't be any kind of interesting instrumental convergence. The theorems let us reason about that case, but their applicability depends on the details of the stochasticity, and so I won't talk about that more here.

**Conclusion:** Optimal policies for u<sub>AOH</sub> will tend to look like _random twitching_. For example, if you generate a u<sub>AOH</sub> by uniformly randomly assigning each AOH utility from the unit interval $[0,1]$, there's no predictable regularity to the optimal actions for this utility function. In this setting and under our assumptions, there is _no_ instrumental convergence without further structural assumptions.

# How Structural Assumptions On Utility Affect Instrumental Convergence

Consider the $n=2$ pixel-flipping case (with $T=50$ still). Action $a_1$ still leads to a single OH, while $a_2$ leads to $(2×2)^{49}=4^{49}\approx 10^{29}$ OHs. So we have instrumental convergence for $\frac{10^{29}}{10^{29}+1}$ of all u<sub>OH</sub> variants.

Let's model the pixel-flipping environment as a Markov decision process (MDP), with both the time-step and alive/dead status observed at each time step in order to ensure full observability, and the final time-step observations being terminal states where the agent stays forever. Dying allows the agent access to 1 terminal state: the observation `1/0/0/0 (dead)`. But surviving via $a_2$ lets the agent access $2^4=16$ terminal states (all 16 binary strings of length 4, with 'alive' appended to the end).

For each reward function over states, only $\frac{16}{16+1}=\frac{16}{17}$ of its permuted variants [will incentivize](/quantitative-strength-of-instrumental-convergence) not dying at $t=1$ (considering policies which maximize average per-timestep reward). This is a lot looser than the bound for u<sub>OH</sub>. What gives?

MDPs assume that utility functions have a lot of structure: the utility of a history is time-discounted additive over observations. Basically, $u(a_{1} o_{1} a_{2} o\\_{2}\ldots ) := \sum_{t=1}^\infty \gamma^{t-1}R(o_{t})$, for some $\gamma\in[0,1)$ and reward function $R:\mathcal{O}\to\mathbb{R}$ over observations. And because of this structure, the agent's average per-timestep reward is controlled by the last observation it sees. There are exponentially fewer last observations than there are _observation histories._ Therefore, in this situation, instrumental convergence is exponentially weaker for reward functions than for arbitrary u<sub>OH</sub>.

This suggests that rolling a random u<sub>OH</sub> for [AIXI](https://www.lesswrong.com/tag/aixi/) might be far more dangerous than rolling a random reward function for an optimal reinforcement learner.

Structural assumptions on utility really do matter when it comes to instrumental convergence:

|Setting|Strength of instrumental convergence|
|--:|:--|
| u<sub>AOH</sub>| [Nonexistent](/power-seeking-beyond-MDPs#Instrumental-Convergence-Disappears-For-Utility-Functions-Over-Action-Observation-Histories)|
|u<sub>OH</sub>| [Strong](/power-seeking-beyond-MDPs#formal-justification)|
|State-based objectives<br/>(e.g. state-based reward in MDPs)| [Moderate](/quantitative-strength-of-instrumental-convergence)|

[Environmental structure can cause instrumental convergence](/environmental-structure-can-cause-instrumental-convergence), but (the absence of) structural assumptions on utility can make instrumental convergence go away (for optimal agents).

## Notes

- Of course, you can represent u<sub>AOH</sub> as u<sub>OH</sub> by including the agent's previous action in the next observation.

  - But this is a different environment; whether or not this is _in fact_ a good model   [depends on the agent's action and observation encodings](/MDPs-are-not-subjective).

- Time-reversible dynamics & full observability is basically the u<sub>AOH</sub> situation, since each action history leads to a unique world state at every time step.
  - But if you take away full observability, time-reversibility is insufficient to make instrumental convergence disappear.

# Conclusion

- For optimal agents, instrumental convergence can be extremely strong for utility functions over observation histories.
- Instrumental convergence doesn't exist for utility functions over _action_-observation histories.

  - i.e. optimal action will tend to look like random twitching.
  - This echoes previous [discussion](https://www.lesswrong.com/s/4dHMdK5TLN6xcqtyc/p/NxF5G6CJiof6cemTw) of the triviality of coherence over action-observation histories, when it comes to determining goal-directedness.
  - This suggests that consequentialism over observations/world states is responsible for convergent instrumental incentives.
    - Approaches like approval-directed agency focus on _action selection_ instead of _optimization over future observations._

- [Environmental structure can cause instrumental convergence](/environmental-structure-can-cause-instrumental-convergence), but (lack of) structural assumptions on utility can make instrumental convergence go away.

## Appendix: Tracking key limitations of the power-seeking theorems

Time to cross another item off of [the list from last time](/quantitative-strength-of-instrumental-convergence#Note-of-caution-redux); the theorems:

> [!quote]
>
> 1. assume the agent is following an optimal policy for a reward function
>     - I can relax this to $\epsilon$-optimality, but $\epsilon>0$ may be extremely small
> 2. ~assume the environment is finite and fully observable~
> 3. Not all environments have the right symmetries
>     - But most ones we think about seem to
> 4. don't account for the ways in which we might practically express reward functions
>     - For example, state-action versus state-based reward functions (this particular case doesn't seem too bad, I was able to sketch out some nice results rather quickly, since you can convert state-action MDPs into state-based reward MDPs and then apply my results).

Re 3), in the setting of this post, when the observations are deterministic, the theorems will always apply. (You can always involute one set of unit vectors into another set of unit vectors in the observation-history vector space.)

Another consideration is that when I talk about "power-seeking in the situations covered by my theorems", the theorems don't necessarily show that gaining social influence or money is convergently instrumental. I think that these "resources" are downstream of formal-power, and will eventually end up being understood in terms of formal-power – but the current results don't directly prove that such high-level subgoals are convergently instrumental.

[^finite]: I don't think we need to assume finite sets of vectors, but things get a lot harder and messier when you're dealing with $\sup$ instead of $\max$. It's not clear how to define the non-dominated elements of an infinite set, for example, and so a few key results break. One motivation for finite being enough is: in real life, a finite mind can only consider finitely many outcomes anyways, and can only plan over a finite horizon using finitely many actions. This is just one consideration, though.
[^environment]: For simplicity, I just consider environments which are joint probability distributions over actions and observation. This is much simpler than the [lower](https://arxiv.org/pdf/1510.05572.pdf#subsection.2.5) [semicomputable chronological conditional semimeasures used in the AIXI literature](https://arxiv.org/pdf/1510.05572.pdf#subsection.2.5), but it suffices for our purposes, and the theory could be extended to LSCCCSs if someone wanted to.
