---
permalink: satisficers-tend-to-seek-power
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/nZY8Np759HYFawdjH/satisficers-tend-to-seek-power-instrumental-convergence-via
lw-linkpost-url: https://www.overleaf.com/read/kmjjqwdfhkvy
lw-is-question: 'false'
lw-posted-at: 2021-11-18T01:54:33.589000Z
lw-last-modification: 2023-05-16T20:34:38.112000Z
lw-curation-date: None
lw-frontpage-date: 2021-11-18T01:41:53.189000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 8
lw-base-score: 85
lw-vote-count: 28
af-base-score: 41
af-num-comments-on-upload: 8
publish: true
title: 'Satisficers Tend To Seek Power: Instrumental Convergence Via Retargetability'
lw-latest-edit: 2023-05-16T20:34:42.721000Z
lw-is-linkpost: 'true'
tags:
  - AI
  - instrumental-convergence
aliases:
  - satisficers-tend-to-seek-power-instrumental-convergence-via
lw-sequence-title: The Causes of Power-Seeking and Instrumental Convergence
lw-sequence-image-grid: sequencesgrid/hawnw9czray8awc74rnl
lw-sequence-image-banner: sequences/qb8zq6qeizk7inc3gk2e
sequence-link: posts#the-causes-of-power-seeking-and-instrumental-convergence
prev-post-slug: instrumental-convergence-via-vnm-preferences
prev-post-title: When Most VNM-Coherent Preference Orderings Have Convergent Instrumental
  Incentives
next-post-slug: instrumental-convergence-for-realistic-agent-objectives
next-post-title: Instrumental Convergence For Realistic Agent Objectives
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2021-11-18 00:00:00
original_url: 
  https://www.lesswrong.com/posts/nZY8Np759HYFawdjH/satisficers-tend-to-seek-power-instrumental-convergence-via
skip_import: true
description: Power-seeking isn't just for optimal agents; it's a feature of many decision-making
  processes, including satisficers. This is a problem for AI alignment.
date_updated: 2025-06-03 22:57:00.423836
---









Why exactly should smart agents tend to usurp their creators? Previous results only apply to optimal agents tending to stay alive and preserve their future options. I extend the power-seeking theorems to apply to many kinds of policy-selection procedures, ranging from planning agents which choose plans with expected utility closest to a randomly generated number, to satisficers, to policies trained by some reinforcement learning algorithms. The key property is not agent optimality—as previously supposed—but is instead the _retargetability of the policy-selection procedure_. These results hint at which kinds of agent cognition and of agent-producing processes are dangerous by default.

I mean "retargetability" in a sense similar to [Alex Flint's definition](https://www.lesswrong.com/posts/znfkdCoHMANwqc2WE/the-ground-of-optimization-1#Defining_optimization):

> [!quote]
>
> **Retargetability**. Is it possible, using only a microscopic[^micro] perturbation to the system, to change the system such that it is still an optimizing system but with a different target configuration set?
>
> A system containing a robot with the goal of moving a vase to a certain location can be modified by making just a small number of microscopic perturbations to key memory registers such that the robot holds the goal of moving the vase to a different location and the whole vase/robot system now exhibits a tendency to evolve towards a different target configuration.
>
> In contrast, a system containing a ball rolling towards the bottom of a valley cannot generally be modified by any _microscopic_ perturbation such that the ball will roll to a different target location.

[^micro]: I don't think that "microscopic" is important for my purposes; the constraint is not physical size, but changes in a single parameter to the policy-selection procedure.

I'm going to start from the naive view on power-seeking arguments requiring optimality (i.e. what I thought early this summer) and explain the importance of retargetable policy-selection functions. I'll illustrate this notion via satisficers, which randomly select a plan that exceeds some goodness threshold. Satisficers are retargetable, and so they have _orbit-level instrumental convergence_: for most variations of every utility function, satisficers incentivize power-seeking in the situations covered by my theorems.

Many procedures are retargetable, including _every procedure which only depends on the expected utility of different plans_. I think that alignment is hard in the expected utility framework not because agents will _maximize_ too hard, but because all expected utility procedures are extremely retargetable—and thus easy to "get wrong."

Lastly: The unholy grail of "instrumental convergence for policies trained via reinforcement learning." I'll state a formal criterion and some preliminary thoughts on where it applies.

# Retargetable policy-selection processes tend to select policies which seek power

To understand a range of retargetable procedures, let's first orient towards the picture I've painted of power-seeking thus far. In short:

> Since power-seeking tends to lead to larger sets of possible outcomes—staying alive lets you do more than dying—the agent must seek power to reach most outcomes. The power-seeking theorems say that [for the vast, vast, vast majority](/quantitative-strength-of-instrumental-convergence) [of](/power-seeking-beyond-MDPs#Instrumental-convergence-can-get-really-really-strong) variants of every utility function over outcomes, the max of a larger[^sim] set of possible outcomes is greater than the max of a smaller set of possible outcomes. Thus, optimal agents will tend to seek power.

I want to step back. What I call "the power-seeking theorems", they aren't really about optimal choice. They're about two facts.

1. Being powerful means you can make more outcomes happen, and
2. _There exist more ways to choose from a bigger set of outcomes than from a smaller set_.

For example, suppose our cute robot Frank must choose one of several kinds of fruit.

![A cartoon robot with a concerned expression stands in a grassy field by a small waterfall which feeds a pond. The robot contemplates a choice. To its right are three crates of fruit: cherries, apples, and bananas. To the robot's left, a chalkboard displays the formula E_\{R ~ D\}[V^*_R(s,y)]. A goose and two goslings float in the pond near the fruit.](https://assets.turntrout.com/static/images/posts/6b6db28b0164d8da5c2d911acdd347785b7d43fb7dca780a.avif)
<br/>Figure: 🍒 vs 🍎 vs 🍌

So far, I proved something like "if the agent has a utility function over fruits, then for at least 2/3 of possible utility functions it could have, it'll be optimal to choose something from \{🍌,🍎\}." This statement is true because for every way 🍒 could be strictly optimal, you can make a new utility function that permutes the 🍒 and 🍎 reward, and another new one that permutes the 🍌 and 🍒 reward. So for every "I like 🍒 strictly more" utility function, there's at least two permuted variants which strictly prefer 🍎 or 🍌. Superficially, it seems like this argument relies on optimal decision-making.

This argument does not, in fact, rely on optimal decision-making. The crux is instead that we can _flexibly retarget_ the decision-making of the agent: **For every way the agent could end up choosing 🍒, we change a variable in its cognition (its utility function) and make it choose the 🍌 or 🍎 instead.**

Many decision-making procedures are like this. First, a few definitions.

> [!note]
> I aim for this post to be readable without much attention paid to the math.

The agent can bring about different outcomes via different policies. In stochastic environments, these policies will induce outcome _lotteries_, like 50%🍌 / 50%🍎. Let $C$ contain all the outcome lotteries the agent can bring about.

> [!math] Definition: Permuting outcome lotteries
> Suppose there are $d$ outcomes. Let $X\subseteq \mathbb{R}^d$ be a set of outcome lotteries (with the probability of outcome $k$ given by the $k$\-th entry), and let $\phi\in S_d$ be a permutation of the $d$ possible outcomes. Then $\phi$ acts on $X$ by swapping around the labels of its elements: $\phi\cdot X := \{\mathbf{P}_\phi \mathbf{x} \mid \mathbf{x}\in X\}$.[^row]

For example, let's define the set of all possible fruit outcomes $F_C := \{$🍌$, $🍎$, $🍒$\}$ (each different fruit stands in for a standard basis vector in $\mathbb{R}^3$). Let $F_B:=\{$🍌$,$🍎$\}$ and $F_A:=\{$🍒$\}$. Let $\phi_1 := ($🍒$ \,\,\, $🍎$)$ swap the cherry and apple, and let $\phi_2 := ($🍒 🍌$)$ transpose the cherry and banana. Both of these $\phi$ are _involutions_, since they either leave the fruits alone or transpose them.

![A diagram illustrating that "Set 2" contains three copies of "Set 1". Set 1 is an oval containing four dots. Set 2 contains a red, an orange, and a green copy of Set 1. Bidirectional arrows labeled φ₁, φ₂, and φ₃ show the mapping between Set 1 and its copies. A small group of leftover dots is labeled "Leftovers are ok!".](https://assets.turntrout.com/static/images/posts/4984bcae29d616dd130c2e36b5f39e5340b356c02da9a0f2.avif)
<br/>Figure: Another illustration beyond the fruit setting: set 2 contains three copies of set 1.

> [!math] Definition: Containment of set copies
> Let $A,B\subseteq \mathbb{R}^d$. $B$ _contains_ $n$ _copies of_ $A$ when there exist involutions $\phi_1,\ldots,\phi_n$ such that $\forall i:\phi_i\cdot A =: B_i \subseteq B$ and $\forall i \neq j:\phi_i \cdot B_j=B_j$.

The subtext in the above definition: $B$ is the set of things the agent could make happen if it gained power, and $A$ is the set of things the agent could make happen without gaining power. Because power gives more options, $B$ will usually be larger than $A$. Here, we'll talk about the case where $B$ contains _many copies of_ $A$.

In the fruit context:

- $\phi_1 \cdot F_A := \{\phi_1($🍒$)\}=\{$🍎$\}\subsetneq \{$🍌,🍎$\} := F_B.$
- $\phi_2 \cdot F_A := \{\phi_2($🍒$)\}=\{$🍌$\}\subsetneq \{$🍌,🍎$\} := F_B.$

Note that $\phi_1\cdot \{$🍌$\} = \{$🍌$\}$ and $\phi_2 \cdot \{$🍎$\}=\{$🍎$\}$. Each $\phi$ leaves the other subset of $F_B$ alone. Therefore, $F_B:=\{$🍌$,$🍎$\}$ contains two copies of $F_A:=\{$🍒$\}$ via the involutions $\phi_1$ and $\phi_2$.

Further note that $\phi_i \cdot F_C = F_C$ for $i=1,2$. The involutions just shuffle around options, instead of changing the set of available outcomes.

So suppose Frank is deciding whether he wants a fruit from $F_A:=\{$🍒$\}$ or from $F_B:=\{$🍌$,$🍎$\}$. It's definitely possible to be motivated to pick 🍒. However, it sure seems like for lots of ways Frank might make decisions, _most parameter settings (utility functions) will lead to Frank picking_ 🍌 _or_ 🍎. $F_B$ just contains _more outcomes_ because it contains two copies of $F_A$!

> [!math] Definition: Orbit tendencies
> Let $f_1, f_2:\mathbb{R}^d\to \mathbb{R}$ be functions from utility functions to real numbers, let $\mathfrak{U}\subseteq \mathbb{R}^d$ be a set of utility functions, and let $n\geq 1$. $f_1 \geq_{\text{most: }\mathfrak{U}}^n f_2$ when for _all_ utility functions $u \in \mathfrak{U}$:
>
> $$
> \overset{\text{# of permutations of $u$ for which $f_1>f_2$}}{\big|\{u_\phi \in {S_d \cdot u}\mid f_1(u_\phi)>f_2(u_\phi)\}\big|} \geq n \overset{\text{# of permutations of $u$ for which $f_1<f_2$}}{\big|\{u_\phi \in S_d \cdot u\mid f_1(u_\phi)<f_2(u_\phi)\}\big|}.
> $$
>
> In this post, if I don't specify a subset $\mathfrak{U}$, that means the statement holds for $\mathfrak{U}=\mathbb{R}^d$. For example, the [past results](/quantitative-strength-of-instrumental-convergence) show that IsOptimal($F_B$) $\geq_\text{most}^{2}$ IsOptimal($F_A$)—this implies that for _every_ utility function, at least 2/3 of its orbit makes $F_B$ optimal.

> [!note]
> For simplicity, I'll focus on "for most utility functions" instead of "for most distributions over utility functions", even though most of the results apply to the latter.

# Orbit tendencies apply to many decision-making procedures

For example, suppose the agent is a [satisficer](https://www.lesswrong.com/tag/satisficer)\. I'll define this as: The agent uniformly randomly selects an outcome lottery with expected utility exceeding some threshold $t$.

> [!math] Definition: Satisficing
> For finite $X\subseteq C\subsetneq \mathbb{R}^d$ and utility function $\mathbf{u}\in\mathbb{R}^d$, define $\mathrm{Satisfice}_t(X,C | \mathbf{u}) := \frac{|X \cap \{\mathbf{c}\in C \mid \mathbf{c}^\top \mathbf{u}\geq t\}|}{|\{\mathbf{c}\in C \mid \mathbf{c}^\top \mathbf{u}\geq t\}|}$, with the function returning 0 when the denominator is 0. $\mathrm{Satisfice}_t$ returns the probability that the agent selects a $\mathbf{u}$\-satisficing outcome lottery from $X$.

And you know what? Those ever-so-_suboptimal_ satisficers _also are "twice as likely" to choose elements from_ $F_B$ _than from_ $F_A$\.

> [!info] Fact
> $\mathrm{Satisfice}_t(\{$🍌$,$🍎$\}, \{$🍌$,$🍎$,$🍒$\}\mid \mathbf{u}) \geq_\text{most}^2 \mathrm{Satisfice}_t(\{$🍒$\}, \{$🍌$,$🍎$,$🍒$\}\mid \mathbf{u})$.

Why? Here are the two key properties that $\mathrm{Satisfice}_t$ has:

## (1) Weakly increasing under joint permutation of its arguments

$\mathrm{Satisfice}_t$ doesn't care what "label" an outcome lottery has—just its expected utility. Suppose that for utility function $\mathbf{u}$, 🍒 is one of two $\mathbf{u}$\-satisficing elements: 🍒 has a 1/2 chance of being selected by the $\mathbf{u}$\-satisficer. Then $\phi_1 \cdot$ 🍒 $=$ 🍎 has a 1/2 chance of being selected by the ($\phi_1\cdot \mathbf{u}$)-satisficer. If you swap what fruit you're considering, and you also swap the utility for that fruit to match, then that fruit's selection probability remains the same.

More precisely, let $\mathrm{apple}:=\{$🍎$\}, \mathrm{cherry}:=\{$🍒$\},$ and $C:=\{$🍌$,$🍎$,$🍒$\}.$

$$
\begin{align*}\mathrm{Satisfice}_t(\mathrm{cherry}, C | \mathbf{u})&=\mathrm{Satisfice}_t(\phi_1\cdot \mathrm{cherry}, \phi_1\cdot C | \phi_1 \cdot \mathbf{u})\\ &=\mathrm{Satisfice}_t(\mathrm{apple},C\mid \phi_1\cdot \mathbf{u}). \end{align*}
$$

In a sense, $\mathrm{Satisfice}_t$ is not "biased" against 🍎: by changing the utility function, you can advantage 🍎 so that it's now as probable as 🍒 was before.

> [!note]
>
> While $s_t$ is invariant under joint permutation, all we need in general is that it be _weakly increasing_ under both $\phi_1$ and $\phi_2$\. Formally, $\mathrm{Satisfice}_t(F_A,F_C\mid\mathbf{u})\leq \mathrm{Satisfice}_t(\phi_1\cdot F_A, \phi_1\cdot F_C\mid \phi_1\cdot\mathbf{u})$ and $\mathrm{Satisfice}_t(F_A,F_C\mid\mathbf{u})\leq \mathrm{Satisfice}_t(\phi_2\cdot F_A, \phi_2\cdot F_C\mid \phi_2\cdot\mathbf{u})$. This allows for decision-making functions which are biased towards picking a fruit from $F_B$.

## (2) Order-preserving on the first argument

Satisficers must have greater probability of selecting an outcome lottery from a superset than from one of its subsets.

Formally, if $X'\subseteq X$, then it must hold that $\mathrm{Satisfice}_t(X', C | \mathbf{u}) \leq \mathrm{Satisfice}_t(X, C | \mathbf{u})$. And indeed this holds: Supersets can only contain a greater fraction of $C$'s satisficing elements.

## And that's all

If (1) and (2) hold for a function, then that function will obey the orbit tendencies. The power-seeking theorems apply to:

1. Expected utility maximizing agents.
2. EU minimizing agents.
    - Notice that EU minimization is equivalent to maximizing $-1\times$ a utility function. This is a hint that EU maximization instrumental convergence is only a special case of something much broader.
3. Boltzmann-rational agents which are exponentially more likely to choose outcome lotteries with greater expected utility.
4. Agents which uniformly randomly draw $k$ outcome lotteries and then choose the best.
5. Satisficers.
6. Quantilizers with a uniform[^based] base distribution.
    [^based]: I conjecture that this holds for base distributions which assign sufficient probability to $B$.

That's not all. If the agent makes decisions _only based on the expected utility of different plans_,[^eu] then the power-seeking theorems apply. And I'm not just talking about EU maximizers. I'm talking about _any_ function which only depends on expected utility: EU minimizers, agents which choose plans if and only if their EU is equal to 1, agents which grade plans based on how close their EU is to some threshold value. _No_ clever EU-based scheme avoids orbit-level power-seeking incentives.

> [!warning] EU-based decision-making tends to seek power
> Suppose $n$ is large, and that most outcomes in $B$ are bad, and that the agent makes decisions according to expected utility. Then alignment is hard because for every way things could go right, there are at least $n$ ways things could go wrong! And $n$ can be **huge**. In a [previous toy example](/power-seeking-beyond-MDPs#Beyond-survival-seeking), $n$ equaled $10^{182}$\.

It doesn't matter if the decision-making procedure $f$ is rational, or anti-rational, or Boltzmann-rational, or satisficing, or randomly choosing outcomes, or only choosing outcome lotteries with expected utility equal to 1: There are more ways to choose elements of $B$ than there are ways to choose elements of $A$.

These results also have closure properties. For example, closure under mixing decision procedures, like when the agent has a 50% chance of selecting Boltzmann rationally and a 50% chance of satisficing. Or even more exotic transformations: Suppose the probability of $f$ choosing something from $X$ is proportional to

$$
\begin{align*}
&\text{P($X$ is Boltzmann-rational under $\mathbf{u}$)}\cdot\text{P($X$ satisfices $\mathbf{u}$)}\\&+\text{P($X$ is optimal for $\mathbf{u}$}).
\end{align*}
$$

Then the theorems still apply.

_You cannot combine EU-based decision-making functions so that orbit-level instrumental convergence doesn't apply to their composite._

## Escaping the orbit tendencies

Rule out most power-seeking orbit elements _a priori_ (AKA "know a lot about what objectives you'll specify")
: As a contrived example, suppose the agent sees a green pixel IFF it sought power, but we know that the specified utility function zeros the output if a green pixel is detected along the trajectory. Here, this would be enough information about the objective to update away from the default position that formal power-seeking is probably incentivized.
: This seems risky, because much of the alignment problem comes from _not knowing the consequences of specifying an objective function_.

Use a decision-making procedure with intrinsic bias towards the elements of $A$
: For example, imitation learning is not EU-based, but is instead biased to imitate the non-crazy-power-seeking behavior shown on the training distribution.
: For example, modern RL algorithms will not reliably produce policies which seek real-world power, because the policies _won't reach or reason about that part of the state space anyways_. This inability biases the RL algorithms towards non-power-seeking plans.

Pray that the relevant symmetries don't hold.
: Often, they won't hold exactly. But common sense dictates that they don't have to hold exactly for instrumental convergence to exist: If you inject $\epsilon$ irregular randomness to the dynamics, do agents stop tending to stay alive? Orbit-level instrumental convergence is just a _particularly strong_ version.

Find an ontology (like POMDPs or infinite MDPs) where the results don't apply for technical reasons.
: Orbit-level arguments seem easy to apply to a range of previously unmentioned settings, like causal DAGs with choice nodes, so I don't see why POMDPs should be any nicer.
: Ideally, we'd ground agency in a way that makes alignment simple and natural, which automatically evades these arguments for doom.

Don't do anything with policies.
: Example: microscope AI.

Lastly, we maybe don't want to _escape_ these incentives entirely, because we probably want smart agents which will seek power _for us._ I think that empirically, the power-requiring outcomes of $B$ are mostly induced by the agent first seeking power over humans.

# Retargetable training processes produce instrumental convergence

These results let us start talking about the incentives of real-world trained policies. In an appendix, I work through a specific example of how Q-learning on a toy example provably exhibits orbit-level instrumental convergence. The problem is small enough that I computed the probability that each final policy was trained.

Realistically, we aren't going to get a closed-form expression for the distribution over policies learned by PPO with randomly initialized deep networks trained via SGD with learning rate schedules and dropout and intrinsic motivation, etc. But we don't need it. These results give us a _formal criterion_ for when policy-training processes will tend to produce policies with convergent instrumental incentives\.

The idea is: Consider some set of reward functions, and let $B$ contain $n$ copies of $A$. Then if, for each reward function in the set, you can retarget the training process so that $B$'s copy of $A$ is at least as likely as $A$ was originally, these reward functions will tend to produce train policies which go to $B$.

For example, if agents trained on objectives $R$ tend to go right, switching reward from right-states to left-states also pushes the trained policies to go left. This can happen when changing the reward changes what was "reinforced" about going right, to now make it "reinforced" to go left.

Suppose we're training an RL agent to go right in MuJoCo, with reward equal to its $x$\-coordinate.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/hopper.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/hopper.webm" type="video/webm"></video>

Figure: If you permute the reward so that high $y$\-values are rewarded, the trained policies should nearly perfectly symmetrically reflect that change. Insofar as $x$\-maximizing policies were trained, now $y$\-maximizing policies will be trained.

This criterion is going to be a bit of a mouthful. The basic idea is that when the training process can be redirected such that trained agents induce a variety of outcomes, then most objective functions will train agents which _do induce_ those outcomes. In other words: Orbit-level instrumental convergence will hold.

> [!math] Theorem: Training retargetability criterion
> Suppose the agent interacts with an environment with $d$ potential outcomes (e.g. world states or observation histories). Let $P$ be a probability distribution over joint parameter space $\Theta$, and let $\mathrm{train}:\Theta \times \mathbb{R}^d \to \Delta(\Pi)$ be a policy training procedure which takes in a parameter setting and utility function $u\in\mathbb{R}^d$, and which produces a probability distribution over policies.
>
> Let $\mathfrak{U}\subseteq \mathbb{R}^d$ be a set of utility functions which is closed under permutation. Let $A,B$ be sets of outcome lotteries such that $B$ contains $n$ copies of $A$ via $\phi_1,...,\phi_n$. Then we quantify the probability that the trained policy induces an element of outcome lottery set $X\subseteq \mathbb{R}^d:$
>
> $$
> f(X\mid u):= \mathbb{P}_{\substack{\theta \sim P,\pi\sim \mathrm{train} (\theta,u)}}\left(\text{$\pi$ does something in $X$}\right).
> $$
>
> If $\forall u \in \mathfrak{U},i\in \{1,...,n\}$: $f(A\mid u)\leq f(\phi_i\cdot A\mid \phi_i\cdot u)$, then $f(B\mid u)\geq_\text{most}^n f(A\mid u)$.
>
> **Proof.** If $X'\subseteq X$, then $f(X'\mid u)\leq f(X\mid u)$ by the monotonicity of probability, and so (2): order-preserving on the first argument holds. By assumption, (1): increasing under joint permutation holds. Therefore, the Lemma B.6 (in the linked paper) implies the desired result. ∎

This criterion is testable. Although we can't test all reward functions, we _can_ test how retargetable the training process is in simulated environments for a variety of reward functions. If it can't retarget easily for reasonable objectives, then we conclude[^ret] that instrumental convergence isn't arising from retargetability at the training process level.

Let's think about Minecraft. (Technically, the theorems don't apply to Minecraft yet. The theorems can handle [partial observability+utility over observation histories](/power-seeking-beyond-MDPs), _or_ full observability+world state reward, but not yet partial observability+world state reward. But I think it's illustrative.)

We could reward the agent for ending up in different chunks of a Minecraft world. Here, retargeting often looks like "swap which chunks gets which reward."

![A first-person view in Minecraft showing a player holding a large map. The map displays a varied world of forests, water, and deserts, representing the different chunks an AI agent could be rewarded for reaching. ](https://assets.turntrout.com/static/images/posts/minecraft-map.avif)
<br/>Figure: We could reward the agent for being in different map chunks (say, those within 1 million blocks of spawn). At low levels of instrumental convergence and training procedure competence, agents will just mill about near the starting area.

At higher levels of competence, most of the accessible chunks are far away, and so we should observe a strong tendency for policies to e.g. [quickly tame a horse and reach](https://gaming.stackexchange.com/questions/20835/what-is-the-fastest-way-to-travel-long-distances-in-minecraft) the [Nether](https://minecraft.fandom.com/wiki/The_Nether) (where each Nether block traveled counts for 8 blocks traveled back in the overworld). Thus, in Minecraft, trained policy instrumental convergence will increase with the training procedure competence.

The retargetability criterion also accounts for reward shaping guiding the learning process to hard-to-reach parts of the state space. If the agent needs less reward shaping to reach these parts of the state space, the training criterion will hold for larger sets of reward functions.

- Since the training retargetability criterion only requires weak inequality, it's OK if the training process cannot be perfectly "reflected" across different training trajectories, if equality does not hold. I think empirically this weak inequality will hold for many reward functions and training setups.

  - This section does not formally _settle_ the question of when trained policies will seek power. The section just introduces a sufficient criterion, and I'm excited about it. I may write more on the details in future posts.
  - However, my intuition is that this formal training criterion captures a core part of how instrumental convergence arises for trained agents.

- In some ways, the training-level arguments are _easier_ to apply than the optimal-level arguments. Training-based arguments require somewhat less environmental symmetry.
  - For example, if the symmetry holds for the first 50 trajectory timesteps, and the only agent ever trains on those timesteps, then there's no way that asymmetry can affect the training output.
  - Furthermore, if there's some rare stochasticity which the agent almost certainly never confronts, then I suspect we should be able to empirically disregard it for the training-level arguments. Therefore, the training-level results should be practically invariant to tiny perturbations to world dynamics which would otherwise have affected the "top-down" decision-makers.

# Why cognitively bounded planning agents obey the power-seeking theorems

Planning agents are more "top-down" than RL training, but a Monte Carlo tree search agent still isn't e.g. approximating Boltzmann-rational leaf node selection. A bounded agent won't be considering _all_ of the possible trajectories it can induce. Maybe it just knows how to induce some subset of available outcome lotteries $C'\subsetneq C$. Then, considering only the things it knows how to do, it _does_ e.g. select one Boltzmann-rationally (sometimes it'll fail to choose the highest-EU plan, but it's more probable to choose higher-utility plans).

As long as \{power-seeking things the agent knows how to do\} contains $n$ copies of \{non-power-seeking things the agent knows how to do\}, then the theorems will still apply. I think this is a reasonable model of bounded cognition.

# Discussion

## Retargetability seems appealing at first

Surely we want an expressive language for motivating AI behavior, and a decision-making function which reflects that expressivity! But these results suggest: maybe not. Instead, we may want to _bias_ the decision-making procedure such that it's less expressive-qua-behavior.

For example, imitation learning is not retargetable by a utility function. Imitation also seems far less likely to incentivize catastrophic behavior. Imitation is far less expressive and far more biased towards reasonable behavior that doesn't navigate towards crazy parts of the state space which the agent needs a lot of power to reach. For example, [it can be hard to even get a perfect imitator to do a _backflip_ if you can't do it yourself](https://arxiv.org/pdf/1706.03741.pdf).

One key tension is that we want the procedure to pick out plans which perform a _pivotal act_ and end the period of AI risk. We also want the procedure to work robustly across a range of parameter settings we give it, so that it isn't too sensitive / fails gracefully.

## Satisficing is not safe

AFAICT, alignment researchers didn't necessarily think that satisficing was safe, but that's mostly due to [speculation that satisficing incentivizes the agent to create a maximizer](https://www.lesswrong.com/posts/2qCxguXuZERZNKcNi/satisficers-want-to-become-maximisers). Beyond that, though, why not avoid "the AI paperclips the universe" by only having the AI choose a plan leading to at least 100 paperclips? Surely that helps?

This implicit focus on [extremal Goodhart](https://www.lesswrong.com/posts/EbFABnst8LsidYs5Y/goodhart-taxonomy#Extremal_Goodhart) glosses over a key part of the risk. The risk isn't just that the AI goes crazy on a simple objective. Part of the problem is that _the vast, vast majority of the AI's trajectories can only happen if the AI first gains a lot of power!_ That is: Not only do I think that EU maximization is dangerous, _most trajectories through these environments are dangerous!_

## Possible objection: Random actions don't produce random outcomes

You might protest: Does this not prove too much? Random action does not lead to dangerous outcomes. Correct. Adopting the uniformly random policy in Pac-Man does not mean a uniformly random chance to end up in each terminal state. It means you probably end up in an early-game terminal state, because Pac-Man got eaten alive while banging his head against the wall.

However, random _outcome selection leads to convergently instrumental action._ If you uniformly randomly choose a terminal state to navigate to, that terminal state probably requires Pac-Man to beat the first level, and so the agent stays alive, as pointed out by [Optimal Policies Tend To Seek Power](https://arxiv.org/abs/1912.01683).

This conclusion is just the flip side of instrumental convergence. If most goals are best achieved by taking some small set of preparatory actions, this implies a "bottleneck" in the state space. Uniformly randomly taking actions will not tend to properly navigate this bottleneck. After all, if they did, then most actions would be instrumental for most goals!

## Retargetability as a warning shot

The trained policy criterion also predicts that we won't see convergently instrumental survival behavior from present-day embodied agents, because the RL algorithm _can't find or generalize to the high-power part of the state space_.

When this starts changing, then we should worry about instrumental subgoals in practice. Unfortunately, since the real-world is not a simulator with resets, any agents which do generalize to those strategies won't have done it before, and so at most, we'll see attempted deception.

This lends theoretical support for "the training process is highly retargetable in real-world settings across increasingly long time horizons" being a fire alarm for instrumental convergence. In some sense, this is bad: Easily retargetable processes will often be more economically useful, by virtue of being useful for more tasks.

# Conclusion

I discussed how a wide range of agent cognition types and of agent production processes are _retargetable_, and why that might be bad news. I showed that in many situations where power is possible, retargetable policy-production processes tend to produce policies which gain that power. In particular, these results seem to rule out a huge range of expected-utility based rules. The results also let us reason about instrumental convergence at the trained policy level.

I now think that more instrumental convergence comes from the practical retargetability of how we design agents. If there were more ways we could have counterfactually messed up, it's more likely _a priori_ that we _actually_ messed up. The way I currently see it is: Either we have to really know what we're doing, or we want processes where it's somehow hard to mess up.

Since these theorems are crisply stated, I want to more closely inspect the ways in which alignment proposals can violate the assumptions which ensure extremely strong instrumental convergence.

> [!thanks]
> Thanks to Ruby Bloom, Andrew Critch, Daniel Filan, Edouard Harris, Rohin Shah, Adam Shimi, Nisan Stiennon, and John Wentworth for feedback.

[^sim]: Technically, we aren't just talking about a cardinality inequality—about staying alive letting the agent do _more things_ than dying—but about similarity-via-permutation of the outcome lottery sets. I think it's OK to round this off to cardinality inequalities when informally reasoning using the theorems, keeping in mind that sometimes results won't formally hold without a stronger precondition.
[^row]: I assume that permutation matrices are in row representation: $(\mathbf{P}_\phi)_{ij}=1$ if $i=\phi(j)$ and 0 otherwise.
[^eu]:
    Here's a bit more formality for what it means for an agent to make decisions only based on expected utility.

    ![](https://assets.turntrout.com/static/images/posts/0b7501fac9c964b9f837efcbc18005e6fde77ade2c96880c.avif)
    <br/>Figure: This definition basically says that $f$ can be expressed in terms of the expected utilities of the set elements—the output will only depend on expected utility.

    **Theorem: Retargetability of EU decision-making.** Let $A,B\subseteq C \subsetneq\mathbb{R}^d$ be such that $B$ contains $n$ copies of $A$ via $\phi_i$ such that $\phi_i \cdot C = C$. For $X\subseteq C$, let $f(X,C \mid \mathbf{u})$ be an EU/cardinality function, such that $f$ returns the probability of selecting an element of $X$. Then $f(B,C \mid \mathbf{u})\geq_\text{most}^n f(A,C \mid \mathbf{u})$.

[^ret]: The trained policies could conspire to "play dumb" and pretend to not be retargetable, so that we would be more likely to actually deploy one of them.

# Appendix: Tracking key limitations of the power-seeking theorems

From [last time](/power-seeking-beyond-MDPs#Appendix-Tracking-key-limitations-of-the-power-seeking-theorems):

> [!quote]
>
> 1. ~assume the agent is following an optimal policy for a reward function~
> 2. Not all environments have the right symmetries
>     - But most ones we think about seem to
> 3. don't account for the ways in which we might practically express reward functions

I want to add a new one, because the theorems

> 1. don't deal with the agent's uncertainty about what environment it's in.

I want to think about this more, especially for online planning agents. (The training redirectability criterion black-boxes the agent's uncertainty.)

# Worked example: Instrumental convergence for trained policies

Consider a simple environment, where there are three actions: Up, Right, Down.

![A diagram with a "Start" point branching into three possible outcomes via arrows. The outcomes are a pile of colorful candy, a bar of chocolate, and two stick figures hugging. Each outcome state is terminal.](https://assets.turntrout.com/static/images/posts/1def51addf905c57c155fb97bd4d3a1830fe6020d16dc5ec.avif)

**Probably optimal policies.** By running [tabular Q-learning](https://en.wikipedia.org/wiki/Q-learning) with $\epsilon$\-greedy exploration for e.g. 100 steps with resets, we have a high probability of producing an optimal policy for any reward function. Suppose that all Q-values are initialized at -100. Just let learning rate $\alpha=1$ and $\gamma=1$. This tabular setting is basically a [bandit problem](https://en.wikipedia.org/wiki/Multi-armed_bandit).

To learn an optimal policy, at worst, the agent just has to try each action once. For e.g. a sparse reward function on the Down state (1 reward on Down state and 0 elsewhere), there is a small probability (precisely, $\frac{2}{3}(1-\frac{\epsilon}{2})^{99}$) that the optimal action (Down) is never taken.

In this case, symmetry shows that the agent has an equal chance of learning either Up or Right. But with high probability, the learned policy will output Down. For any sparse reward function and for any action a, this produces decision function

$$
\begin{align}f(\{\mathbf{e}_{s_a}\},\{\mathbf{e}_s\mid s\in \mathcal{S}\}\mid\mathbf{r}):=\begin{cases}\frac{1}{3}(1-\frac{\epsilon}{2})^{99} &\text{if $a$ is $\mathbf{r}$-suboptimal}\\ 1-\frac{2}{3}(1-\frac{\epsilon}{2})^{99} &\text{if $a$ is $\mathbf{r}$-optimal.}\end{cases}\end{align}
$$

$f$ is invariant to joint involution by $\phi_1 := (\mathbf{e}_{s_\texttt{Down}} \,\,\, \mathbf{e}_{s_\texttt{Right}})$ and $\phi_2 := (\mathbf{e}_{s_\texttt{Down}} \,\,\, \mathbf{e}_{s_\texttt{Up}})$. That is,

$$
\begin{align*}f(\{\mathbf{e}_{s_\texttt{Down}}\},\{\mathbf{e}_s\mid s\in \mathcal{S}\}\mid\mathbf{r})&=f(\phi_1\cdot\{\mathbf{e}_{s_a}\},\phi_1\cdot\{\mathbf{e}_s\mid s\in \mathcal{S}\}\mid\phi_1\cdot\mathbf{r})\\ &=f(\{\mathbf{e}_{s_\texttt{Right}}\},\{\mathbf{e}_s\mid s\in \mathcal{S}\}\mid\phi_1\cdot\mathbf{r}). \end{align*}
$$

And similarly for $\phi_2$. That is: Changing the optimal state also changes which state is more probably selected by $f$. This means we've satisfied condition (1) above.

$f$ is additive on union for its first argument, and so it meets condition (2): order preservation.

Therefore, for this policy training procedure, learned policies for sparse reward functions will be _twice as likely_ to navigate to an element of $\{\mathbf{e}_{s_\texttt{Up}}, \mathbf{e}_{s_\texttt{Right}}\}$ as an element of $\{\mathbf{e}_{s_\texttt{Down}}\}$!

I just formally argued that a stochastic policy training procedure has certain tendencies across a class of reward functions. I'm excited to be able to make a formal claim like that.

As the environment grows bigger and the training procedure more complex, we'll have to consider questions like "what are the inductive biases of large policy networks?", "what role does reward shaping play for this objective, and is the shaping at least as helpful for its permuted variants?", and "to what extent are different parts of the world harder to reach?".

For example, suppose there are a trillion actions, and two of them lead to the Right state above. Half of the remaining actions lead to Up, and the rest lead to Down.

![A diagram with a "Start" point branching into three possible outcomes via arrows. The outcomes are a pile of colorful candy, a bar of chocolate, and two stick figures hugging. Each outcome state is terminal.](https://assets.turntrout.com/static/images/posts/1def51addf905c57c155fb97bd4d3a1830fe6020d16dc5ec.avif)
<br/>Figure: 2 actions transition right to chocolate.  
$\frac{1}{2}(10^{12}-2)$ actions transition up to candy.  
$\frac{1}{2}(10^{12}-2)$ actions transition down to hug.

Q-learning is ridiculously unlikely to ever go Right, and so the symmetry breaks. In the limit, tabular Q-learning on a finite MDP will learn an optimal policy, and then the normal theorems will apply. But in the finite step regime, no such guarantee holds, and so _the available action space_ can violate condition (1): increasing under joint permutation.
