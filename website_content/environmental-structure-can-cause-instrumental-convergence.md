---
permalink: environmental-structure-can-cause-instrumental-convergence
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/b6jJddSvWMdZHJHh3/environmental-structure-can-cause-instrumental-convergence
lw-linkpost-url: https://arxiv.org/abs/1912.01683
lw-is-question: "false"
lw-posted-at: 2021-06-22T22:26:03.120000Z
lw-last-modification: 2023-05-16T20:23:49.058000Z
lw-curation-date: None
lw-frontpage-date: 2021-06-22T22:27:16.747000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 43
lw-base-score: 71
lw-vote-count: 25
af-base-score: 32
af-num-comments-on-upload: 38
title: Environmental Structure Can Cause Instrumental Convergence
lw-latest-edit: 2023-05-16T20:23:50.626000Z
lw-is-linkpost: "true"
tags:
  - instrumental-convergence
  - AI
aliases:
  - environmental-structure-can-cause-instrumental-convergence
lw-sequence-title: The Causes of Power-seeking and Instrumental Convergence
lw-sequence-image-grid: sequencesgrid/hawnw9czray8awc74rnl
lw-sequence-image-banner: sequences/qb8zq6qeizk7inc3gk2e
sequence-link: posts#the-causes-of-power-seeking-and-instrumental-convergence
prev-post-slug: MDPs-are-not-subjective
prev-post-title: MDP models are determined by the agent architecture and the environmental dynamics
next-post-slug: lower-stakes-alignment-scenario
next-post-title: A world in which the alignment problem seems lower-stakes
lw-reward-post-warning: "true"
use-full-width-images: "false"
date_published: 2021-06-22 00:00:00
original_url: https://www.lesswrong.com/posts/b6jJddSvWMdZHJHh3/environmental-structure-can-cause-instrumental-convergence
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/78ceb0300f76784b6d8d043afb15587fb25a50dd52a42e21.png
description: The structure of environments, not just reward functions, contributes to power-seeking in AI agents.
date_updated: 2025-11-22 00:21:52.667251
card_image_alt: A cartoon titled "Orbit of Fortune" illustrates the hypothesized difficulty of AI alignment. A blindfolded robot faces a game wheel surrounded by 12 possible reward functions in an "orbit." Ten of the functions are on fire with devil horns, representing misaligned, power-seeking objectives.
---














> [!failure] As of 2024, I no longer endorse this post
> Even though this post presents correct and engaging technical explanations, its speculation seems wrong. For example, deceptive alignment is _not_ known to be "prevalent."

> [!info] Key takeaways
>
> - The structure of the agent's environment often causes instrumental convergence. **In many situations, there are (potentially combinatorially) many ways for power-seeking to be optimal, and relatively few ways for it not to be optimal.**
> - [My previous results](/seeking-power-is-often-convergently-instrumental-in-mdps) said something like: in a range of situations, when you're maximally uncertain about the agent's objective, this uncertainty assigns high probability to objectives for which power-seeking is optimal.
>   - My new results prove that in a range of situations, seeking power is optimal for _most_ agent objectives (for a particularly strong formalization of "most"). More generally, the new results say something like: in a range of situations, for most beliefs you could have about the agent's objective, these beliefs assign high probability to reward functions for which power-seeking is optimal.
>   - I present the first formal theory of the statistical tendencies of optimal policies in reinforcement learning.
>
> - One result says: whenever the agent maximizes average reward, then for _any_ reward function, most permutations of it incentivize shutdown avoidance.
>   - The formal theory is now beginning to explain why alignment is so hard by default, and why failure might be catastrophic\.
>
> - Before, I thought of environmental symmetries as convenient sufficient conditions for instrumental convergence. But I increasingly suspect that symmetries are the main part of the story.
> - I think these results may be important for understanding the AI alignment problem and formally motivating its difficulty.
>   - For example, my results imply that **simplicity priors over reward functions assign non-negligible probability to reward functions for which power-seeking is optimal.**
>   - I expect my symmetry arguments to help explain other "convergent" phenomena, including:
>     - [convergent evolution](https://en.wikipedia.org/wiki/Convergent_evolution)
>     - the prevalence of [deceptive alignment](https://www.lesswrong.com/posts/zthDPAjh9w6Ytbeks/deceptive-alignment)
>     - [feature universality](https://distill.pub/2020/circuits/zoom-in/) in deep learning
>
>   - One of my hopes for this research agenda: if we can understand _exactly why_ superintelligent goal-directed objective maximization seems to fail horribly, we might understand how to do better.

> [!thanks]
>Thanks to `TheMajor`, Rafe Kennedy, and John Wentworth for feedback on this post. Thanks for Rohin Shah and Adam Shimi for feedback on the simplicity prior result.

# Orbits Contain All Permutations of an Objective Function

## The Minesweeper analogy for power-seeking risks

One view on AGI risk is that we're charging ahead into the unknown, into a particularly unfair game of Minesweeper in which the first click is allowed to blow us up. Following the analogy, we want to understand enough about the mine placement so that we _don't_ get exploded on the first click. And once we get a foothold, we start gaining information about other mines, and the situation is a bit less dangerous.

![A screenshot of a classic Minesweeper game at its start. The grid is full of unclicked gray tiles. ](https://assets.turntrout.com/static/images/posts/mine_empty.avif){style="width: 35%;"}

My previous theorems on power-seeking said something like: "at least half of the tiles conceal mines."

I think that's important to know. But there are many tiles you might click on first. Maybe all of the mines are on the right, and we understand the obvious pitfalls, and so we'll just click on the left.

<img alt="A classic Minesweeper game board. The left half of the grid consists of empty, unclicked tiles, while every tile on the right half is marked with a red &quot;X&quot; to indicate it is a mine." src="https://assets.turntrout.com/static/images/posts/mine_half.avif" style="width:35%"/>

That is: we might not uniformly randomly select tiles:

- We might click a tile on the left half of the grid.
- Maybe we sample from a truncated discretized Gaussian.
- Maybe we sample the next coordinate by using the universal prior (rejecting invalid coordinate suggestions).
- Maybe we uniformly randomly load LessWrong posts and interpret the first text bits as encoding a coordinate.

We can sample coordinates in many ways - not just uniformly randomly. So why should our sampling procedure tend to activate mines?

My new results say something analogous to: for _every_ coordinate, either it contains a mine, or its reflection across $x=y$  contains a mine, or both. Therefore, for _every distribution_ $\mathcal{D}$ over tile coordinates, either $\mathcal{D}$ assigns at least 1/2 probability to mines, or it does after you reflect it across $x=y$.

> [!math] Definition: Orbit
> The [_orbit_](https://en.wikipedia.org/wiki/Group_action#Orbits_and_stabilizers) of a coordinate $C$ under the symmetric group $S_2$ is $\{C,C_\text{reflected}\}$. More generally, if we have a probability distribution over coordinates, its orbit is the set of all possible "permuted" distributions.

Orbits under symmetric groups quantify all ways of "changing things around" for that object.

![A Minesweeper game board is divided by a diagonal dashed line. An arrow labeled "reflect" shows a blue dot being reflected across the diagonal line to another dot's position.](https://assets.turntrout.com/static/images/posts/8e6425b8f870379a9395baf3d235d0cff2994da7d3b30ba1.avif){style="width: 35%;"}
<br/>Figure: My new theorems demand that (in the analogy) at least one of these tiles conceal a mine.

![A Minesweeper game board is divided by a diagonal dashed line. An arrow labeled "reflect" shows a blue dot being reflected across the diagonal line to another dot's position.](https://assets.turntrout.com/static/images/posts/6aadbd8a60c7d264aad002a55d511943c60b162998c2a18d.avif){style="width: 35%;"}
<br/>Figure: If the mines had been on the right, then both coordinates are safe.

Since my results (in the analogy) prove that at least one of the two blue coordinates conceals a mine, we deduce that the mines are _not_ all on the right.

Some reasons we care about orbits:

1. As we will see, orbits highlight one of the key causes of instrumental convergence: certain environmental symmetries (which are, mathematically, permutations in the state space).
2. Orbits partition the set of all possible reward functions. If at least half of the elements of _every_ orbit induces power-seeking behavior, that's strictly stronger than showing that at least half of reward functions incentivize power-seeking (technical note: with the second "half" being with respect to the uniform distribution's measure over reward functions).
    - In particular, we might have hoped that there were particularly nice orbits, where we could specify objectives without worrying too much about making mistakes (like permuting the output a bit). These nice orbits are impossible. This is some evidence of a _fundamental difficulty in reward specification_.
3. Permutations are well-behaved and help facilitate further results about power-seeking behavior. In this post, I'll prove one such result about the simplicity prior over reward functions.

In terms of coordinates, one hope could have been:

> Sure, maybe there's a way to blow yourself up, but you'd really have to contort yourself into a pretzel in order to algorithmically select such a bad coordinate: all reasonably simple selection procedures will produce safe coordinates.

Suppose you give me a program $P$ which computes a safe coordinate. Let $P'$ call $P$ to compute the coordinate, and then have $P'$ swap the entries of the computed coordinate. $P'$ is only a few bits longer than $P$, and it doesn't take much longer to compute, either. So the above hope is impossible: safe mine-selection procedures can't be significantly simpler or faster than unsafe mine-selection procedures.

The section "[Simplicity priors assign non-negligible probability to power-seeking](/environmental-structure-can-cause-instrumental-convergence#simplicity-priors-assign-non-negligible-probability-to-power-seeking)" proves something similar about objective functions.

## Orbits of goals

Orbits of goals consist of all the ways of permuting what states get which values. Consider this rewardless Markov decision process (MDP):

![Two-state MDP. State A loops on itself and also can transition to state B. B can only transition back to A.](https://assets.turntrout.com/static/images/posts/445cacc470b5aca6bff4ee6b9e2e016652f47affc5e4d54f.avif)
<br/>Figure: Arrows show the effect of taking some action at the given state.

Whenever staying put at $A$ is strictly optimal, you can permute the reward function so that it's strictly optimal to go to $B$. For example, let $R(A):=1, R(B):=0$ and let $\phi:= (A\;B)$ swap the two states. $\phi$ acts on $R$ as follows: $\phi\cdot R$ simply permutes the state before evaluating its reward: $(\phi\cdot R)(s):= R(\phi(s))$.

The orbit of $R$ is $\{R, \phi\cdot R\}$. It's optimal for the former to stay at $A$, and for the latter to alternate between the two states.

![A state diagram of a Markov decision process with three states labeled C, A, and B. A is in the center, with arrows to C and B. All three states have arrows looping back to themselves.](https://assets.turntrout.com/static/images/posts/fa6685c343b547bf0119811109b57d012a1708785e6b5c01.avif)

In this three-state MDP, let $R_C$ assign 1 reward to $C$ and 0 to all other states, and let $\phi:= (A\; B\; C)$ rotate through the states ($A$ goes to $B$, $B$ goes to $C$, $C$ goes to $A$). Then the orbit of $R_C$ is:

|             State: | $C$ | $A$ | $B$ |
| -----------------: | :-: | :-: | :-: |
|              $R_C$ | $1$ | $0$ | $0$ |
|   $\phi \cdot R_C$ | $0$ | $1$ | $0$ |
| $\phi^2 \cdot R_C$ | $0$ | $0$ | $1$ |

Table: Different reward functions and the rewards they assign to states.

My new theorems prove that in many situations, for _every_ reward function, power-seeking is incentivized by most (at least half) of its orbit elements.

# In All Orbits, Most Elements Incentivize Power-Seeking

In [_Seeking Power is Often Robustly Instrumental in MDPs_](/seeking-power-is-often-convergently-instrumental-in-mdps), the last example involved gems and dragons and (most exciting of all) subgraph isomorphisms:

> [!quote] [Seeking Power is Often Robustly Instrumental in MDPs](/seeking-power-is-often-convergently-instrumental-in-mdps)
> Sometimes, one course of action gives you “strictly more options” than another. Consider another MDP with IID reward:
> ![A Markov decision process showing a robot agent's choice. One path via red gems leads to a small network of states and a castle. The other path via blue gems leads to a larger, more complex network and treasure, illustrating a choice that provides more future options.](https://assets.turntrout.com/static/images/posts/d31bab4169f7e005ef58d328dc3d4b6e88725d48d774f44e.avif)
> The right blue gem subgraph contains a “copy” of the upper red gem subgraph. From this, we can conclude that going right to the blue gems... is more probable under optimality for _all discount rates between 0 and 1_!

![A robot can choose between a path via red gems leading to a small subgraph of future states (and a dragon), or a path via blue gems leading to a larger subgraph (and a pile of riches). Red arrows labeled "ye olde permutation φ" show how the smaller subgraph is embedded into the larger one.](https://assets.turntrout.com/static/images/posts/bc5b2aa815d9cd9c468c8c741a9a037490a39baf8715f45c.avif)
Figure: The state permutation $\phi$ embeds the `red-gems` subgraph into the `blue-gems` subgraph.

We say that $\phi$ is an _environmental symmetry_, because $\phi$ is an element of the symmetric group $S_{|\mathcal{S}|}$ of permutations on the state space.

## The key insight was right there the whole time

Let's pause for a moment. For half a year, I intermittently and fruitlessly searched for some way of extending the original results beyond IID reward distributions to account for arbitrary reward function distributions.

- Part of me thought it _had_ to be possible - how else could we explain instrumental convergence?
- Part of me saw no way to do it. Reward functions differ wildly, how could a theory possibly account for what "most of them" incentivize?

The recurring thought which kept my hope alive was:

> There should be "more ways" for `blue-gems` to be optimal over `red-gems`, than for `red-gems` to be optimal over `blue-gems`.

Then I reconsidered the same state permutation $\phi$ which proved my original IID-reward theorems. That kind of $\phi$ would imply that since `blue-gems` has more options, there is therefore greater optimality probability (under IID reward function distributions) for moving toward the blue gems. In the end, that _same permutation_ $\phi$ holds the key to understanding instrumental convergence in MDPs.

![A robot can choose between a path via red gems leading to a small subgraph of future states (and a dragon), or a path via blue gems leading to a larger subgraph (and a pile of riches). Red arrows labeled "ye olde permutation φ" show how the smaller subgraph is embedded into the larger one.](https://assets.turntrout.com/static/images/posts/bc5b2aa815d9cd9c468c8c741a9a037490a39baf8715f45c.avif)
<br/>Figure: Suppose `red-gems` is optimal. For example, let $R_\text{castle}$ assign 1 reward to the castle 🏰 and 0 to all other states. Then the permuted reward function $\phi \cdot R_\text{castle}$ assigns 1 reward to the gold pile, and 0 to all other states, and so `blue-gems` has strictly more optimal value than `red-gems`.

Consider any discount rate $\gamma\in(0,1)$. For _all_ reward functions $R$ such that $V^*_{R}(\texttt{red-gems},\gamma)>V^*_{R}(\texttt{blue-gems},\gamma)$, this permutation $\phi$ turns them into `blue-gem` lovers: $V^*_{\phi\cdot R}(\texttt{red-gems},\gamma)<V^*_{\phi\cdot R}(\texttt{blue-gems},\gamma)$.

$\phi$ takes non-power-seeking reward functions, and injectively maps them to power-seeking orbit elements. Therefore, for _all_ reward functions $R$, at least half of the orbit of $R$ must agree that `blue-gems` is optimal!

Throughout this post, when I say "most" reward functions incentivize something, I mean the following:

> [!math] Definition: When "most" reward functions incentivize an actions
> At state $s$, _most reward functions_ incentivize action $a$ over action $a'$ when for all reward functions $R$, at least half of the orbit agrees that $a$ has at least as much action value as $a'$ does at state $s$.[^weaker]

[^weaker]: This assumption is actually a bit stronger than what I rely on in the paper, but it's easier to explain in words.

The same reasoning applies to _distributions_ over reward functions. And so if you say "we'll draw reward functions from a simplicity prior", then most permuted distributions in that prior's orbit will incentivize power-seeking in the situations covered by my previous theorems. (And we'll later prove that simplicity priors _themselves_ must assign non-trivial, positive probability to power-seeking reward functions.)

Furthermore, for any distribution which distributes reward "fairly" across states (precisely: independently and identically), their (trivial) orbits _unanimously_ agree that `blue-gems` has strictly greater probability of being optimal. And so the converse isn't true: it isn't true that at least half of every orbit agrees that `red-gems` has more POWER and greater probability of being optimal.

This might feel too abstract, so let's run through examples.

## And this directly generalizes the previous theorems

### More graphical options (Proposition 6.9)

![A robot can choose between a path via red gems leading to a small subgraph of future states (and a dragon), or a path via blue gems leading to a larger subgraph (and a pile of riches). Red arrows labeled "ye olde permutation φ" show how the smaller subgraph is embedded into the larger one.](https://assets.turntrout.com/static/images/posts/bc5b2aa815d9cd9c468c8c741a9a037490a39baf8715f45c.avif)
<br/>Figure: At all discount rates $\gamma\in[0,1]$, it's optimal for _most reward functions_ to get `blue-gems` because that leads to strictly more options. We can permute every `red-gems` reward function into a `blue-gems` reward function.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/vase.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/vase.webm" type="video/webm"></video>

Figure: Consider a robot  (<span style="color:blue">■</span>) navigating through a room with a vase (■). By the logic of "every `destroying-vase-is-optimal` reward function can be permuted into a `preserving-vase-is-optimal` reward function", my results (specifically, [Proposition 6.9](https://arxiv.org/pdf/1912.01683#subsubsection.a.D.4.1=&page=6.09) and its generalization via [Lemma E.49](https://arxiv.org/pdf/1912.01683#subsubsection.a.D.4.1=&page=36.78)) suggest[^suggest] that optimal policies tend to avoid breaking the vase, since doing so would strictly decrease available options.
  
  <br/>
  
[^suggest]: "Suggest" instead of "prove" because E.49's preconditions may not always be met, depending on the details of the dynamics. I think this is probably unimportant, but that's for future work. Also, the argument may barely not apply to _this_ gridworld, but if you could move the vase around without destroying it, I think it goes through fine.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/safelife3.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/safelife3.webm" type="video/webm"></video>

Figure: In [SafeLife](https://www.partnershiponai.org/safelife/), the agent can irreversibly destroy green cell patterns. By the logic of "every `destroy-green-pattern` reward function can be permuted into a `preserve-green-pattern` reward function", Lemma E.49 suggests that optimal policies tend to not disturb any given green cell pattern (although most probably destroy _some_ pattern). The permutation would swap \{states reachable after destroying the pattern\} with \{states reachable after not destroying the pattern\}. <br/><br/>However, the converse is not true: you cannot fix a permutation which turns all `preserve-green-pattern` reward functions into `destroy-green-pattern` reward functions, because "too many" reward functions make it optimal to preserve green cells.  <br/><br/>Assuming some conjectures I have about the combinatorial properties of power-seeking, this helps explain why [AUP works in SafeLife using a single auxiliary reward function](/avoiding-side-effects-in-complex-environments) - but more on that in another post.

### Terminal options (theorem 6.13)

![A decision tree illustrating why keeping options open is optimal for most reward functions. From a Start state, one path leads to a single, final outcome of candy. A second path, labeled "Wait!", leads to a later choice between two final outcomes: a chocolate bar or two stick figures hugging.](https://assets.turntrout.com/static/images/posts/efcb19ffc9b20dc00f6147d16e103799af60839478b0cf68.avif)
<br/>Figure: When the agent maximizes average reward, it's optimal for _most reward functions_ to `Wait!` so that they can choose between `chocolate` and `hug`. The logic is that every `candy-optimal` reward function can be permuted into a `chocolate-optimal` reward function.

![A partial game tree for Tic-Tac-Toe. From a central board state, black arrows point to moves that end the game in a loss. Green arrows point to moves that continue the game. Most arrows are black, but many states are in the outcomes accessed by green arrows.](https://assets.turntrout.com/static/images/posts/tic_tac_toe.avif)
<br/>Figure: A portion of a Tic-Tac-Toe game-tree against a fixed opponent policy. Whenever we make a move that ends the game, we can't go anywhere else – we have to stay put. Then most reward functions incentivize the green actions over the black actions: average-reward optimal policies are particularly likely to take moves which keep the game going. The logic is that any `lose-immediately-with-given-black-move` reward function can be permuted into a `stay-alive-with-green-move` reward function.

Even though randomly generated environments are unlikely to satisfy these sufficient conditions for power-seeking tendencies, the results are easy to apply to many structured environments common in reinforcement learning. For example, when $\gamma\approx 1$, most reward functions provably incentivize not immediately dying in Pac-Man. Every reward function which incentivizes dying right away can be permuted into a reward function for which survival is optimal.

![A diagram showing the character Pac-Man with two choices. An arrow labeled "left" points to a red ghost. An arrow labeled "right" points to an ellipsis, signifying that the game continues.](https://assets.turntrout.com/static/images/posts/03906a93935d2c1eaf76291e21d049cf82543f4a5acf012c.avif)
<br/>Figure: Consider the dynamics of the Pac-Man video game. Ghosts kill the player, at which point we consider the player to enter a "game over" terminal state which shows the final configuration. This rewardless MDP has Pac-Man's dynamics, but _not_ its usual score function. Fixing the dynamics, what actions are optimal as we vary the reward function?

Most importantly, we can prove that when shutdown is possible, optimal policies try to avoid it if possible. When the agent isn't discounting future reward (i.e. maximizes average return) and for [lots of reasonable state/action encodings](/MDPs-are-not-subjective), the MDP structure has the right symmetries to ensure that it's instrumentally convergent to avoid shutdown.

> [!quote] The paper's [discussion section](https://arxiv.org/pdf/1912.01683.pdf#section.7)
>
> Corollary 6.14 dictates where average-optimal agents tend to end up, but not how they get there. Corollary 6.14 says that such agents tend not to stay in any given 1-cycle. It does not say that such agents will avoid entering such states. For example, in an embodied navigation task, a robot may enter a 1-cycle by idling in the center of a room. Corollary 6.14 implies that average-optimal robots tend not to idle in that particular spot, but not that they tend to avoid that spot entirely.
>
> **However, average-optimal robots do tend to avoid getting shut down.** The agent's rewardless MDP often represents agent shutdown with a terminal state. A terminal state is unable to access other 1-cycles. Since Corollary 6.14 shows that average-optimal agents tend to end up in other 1-cycles, average-optimal policies must tend to completely avoid the terminal state. Therefore, we conclude that in many such situations, average-optimal policies tend to avoid shutdown.

# Takeaways

## Combinatorics: How do they work?

What does "most reward functions" mean quantitatively - is it just at least half of each orbit? Or, are there situations where we can guarantee that at least three-quarters of each orbit incentivizes power-seeking? I think we should be able to prove that as the environment gets more complex, there are combinatorially more permutations which enforce these similarities, and so the orbits should skew harder and harder towards power-incentivization.

![A decision tree illustrating why keeping options open is optimal for most reward functions. From a Start state, one path leads to a single, final outcome of candy. A second path, labeled "Wait!", leads to a later choice between two final outcomes: a chocolate bar or two stick figures hugging.](https://assets.turntrout.com/static/images/posts/efcb19ffc9b20dc00f6147d16e103799af60839478b0cf68.avif)
<br/>Figure:  Here's a semi-formal argument. For every orbit element $R$ which makes `candy` strictly optimal when $\gamma=1$, $\phi_\texttt{chocolate}$ and $\phi_\texttt{hug}$ respectively produce $R_{\phi_\texttt{chocolate}}\neq R_{\phi_\texttt{hug}}$. `Wait!` is strictly optimal for both $R_{\phi_\texttt{hug}}, R_{\phi_\texttt{hug}}$, and so at least 2/3 of the orbit should agree that `Wait!` is optimal. As `Wait!` gains more power (more choices, more control over the future), I conjecture that this fraction approaches 1.

I don't yet understand the general case, but I have a strong hunch that instrumental convergence<sub>optimal policies</sub> is governed by how many more ways there are for power to be optimal than not optimal. And this seems like a function of the number of environmental symmetries which enforce the appropriate embedding.

## Simplicity priors assign non-negligible probability to power-seeking

One possible hope would have been:

> Sure, maybe there's a way to blow yourself up, but you'd really have to contort yourself into a pretzel in order to algorithmically select a power-seeking reward function. In other words, reasonably simple reward function specification procedures will produce non-power-seeking reward functions.

Unfortunately, there are always power-seeking reward functions not much more complex than their non-power-seeking counterparts. Here, "power-seeking" corresponds to the intuitive notions of either keeping strictly more options open (Proposition 6.9), or navigating towards larger sets of terminal states (theorem 6.13). (Since this applies to several results, I'll leave the meaning a bit ambiguous, with the understanding that it could be formalized if necessary.)

> [!math] Theorem: Simplicity priors assign non-negligible probability to power-seeking
> Consider any MDP which meets the preconditions of Proposition 6.9 or theorem 6.13. Let $U$ be a universal Turing machine, and let $P_U$ be the $U$\-simplicity prior over computable reward functions.
>
> Let `NPS` be the set of non-power-seeking computable reward functions which choose a fixed non-power-seeking action in the given situation. Let $\text{PS}$ be the set of computable reward functions for which seeking power is strictly optimal.[^1]
>
> Then there exists a "reasonably small" constant $C$ such that $P_U(\text{PS})\geq 2^{-C}P_U(\text{NPS})$, where $C$ .
>
> _Proof sketch:_ Let $\phi$ be an environmental symmetry which satisfies the power-seeking theorem in question. Since $\phi$ can be found by brute-force iteration through all $|\mathcal{S}|!$ permutations on the state space, checking each to see if it meets the formal requirements of the relevant theorem, its Kolmogorov complexity $K_U(\phi)$ is relatively small.
>
> Because Lemma D.26 applies in these situations, $\phi(\text{NPS}) \subseteq \text{PS}$: $\phi$ turns non-power-seeking reward functions into power-seeking ones. Thus, $P_U(\text{PS}) \geq P_U(\phi(\text{NPS}))$.
>
> Since each reward function $R\in\phi(\text{NPS})$ can be computed by computing the non-power-seeking variant and then permuting it (with $K_U(\phi)$ extra bits of complexity), $K_U(R)\leq K_U(\phi^{-1}(R))+K_U(\phi)+O(1)$ (with $O(1)$ counting the small number of extra bits for the code which calls the relevant functions).
>
> Since $P_U$ is a simplicity prior, $P_U(\phi(\text{NPS}))\geq 2^{-(K_U(\phi)+O(1))} P_U(\text{NPS})$.
>
> Then $P_U(\text{PS})\geq 2^{-(K_U(\phi)+O(1))}P_U(\text{NPS})$. QED.

### Anticipated objections

Why can't we show that $P_U(\text{PS})\geq P_U(\text{NPS})$?
: Certain UTMs $U$ might make non-power-seeking reward functions particularly simple to express.
: This proof doesn't assume anything about how many _more_ options power-seeking offers than not-power-seeking. The proof only assumes the existence of a single involutive permutation $\phi$.

This lower bound seems rather weak. Even if $K_U(\phi)+O(1)=15$ bits, $2^{-15}\approx 0$.
: This lower bound is indeed loose. Since most individual NPS probabilities of interest are less than 1 in one trillion, I wouldn't be surprised if the bound were loose by at least several orders of magnitude.
: First of all, the bound implicitly assumes that the _only way_ to compute PS reward functions is by taking NPS ones and permuting them. We should add the other ways of computing PS reward functions to $P_U(\text{PS})$.
: Lots of permutations $\phi'$ would work. $P_U(\text{PS})$ gains probability from all of those terms. Some of these terms are probably reasonably large, since it seems implausible that all such permutations $\phi'$ have high K-complexity. When all is said and done, we may well end up with a significant chunk of probability on PS.
: For example: the symmetric group $S_{|\mathcal{S}|}$ has cardinality $|\mathcal{S}|!$, and for any $R \in \text{NPS}$, at least half of the $\phi'\in S_{|\mathcal{S}|}$ induce (weakly) power-seeking orbit elements $\phi' \cdot R$. (This argument would be strengthened by my conjectures about bigger environments $\implies$ greater fraction of orbits seek power.)
: If some significant fraction (e.g. $\frac{1}{50}$) of these $\phi'$ are strictly power-seeking, we're adding at least $\frac{|\mathcal{S}|!}{2}\frac{1}{50}=\frac{|\mathcal{S}|!}{100}$ additional terms.

  Overall, it's not surprising that the bound is loose, given the lack of assumptions about the degree of power-seeking in the environment. If the bound is anywhere near tight, then the permuted simplicity prior $\phi \cdot P_U$ incentivizes power-seeking with extremely high probability.[^troubling]
[^troubling]: If you think about the permutation as a "way reward could be misspecified", then that's troubling. It seems plausible that this is often (but not always) a reasonable way to think about the action of the $\phi$ permutation.

What if $P_U(\text{NPS})=0$?
:  I think this is impossible, and I can prove that in a range of situations, but it would be a lot of work and it relies on results not in the arxiv paper.
: Even if that equation held, that would mean that power-seeking is (at least weakly) optimal for _all_ computable reward functions. That's hardly a reassuring situation. Note that if $P_U(\text{NPS})>0$, then $P_U(\text{PS})>0$.

### Takeaways from the simplicity prior result

- Most plainly, this seems like reasonable formal evidence that the simplicity prior has malign incentives.
- Power-seeking reward functions don't have to be too complex.
- These power-seeking theorems give us important tools for reasoning formally about power-seeking behavior and its prevalence in important reward function distributions.[^bound]

[^bound]: If I had to guess, this result is probably not the best available bound, nor the most important corollary of the power-seeking theorems. But I'm still excited by it (insofar as it's appropriate to be "excited" by slight Bayesian evidence of doom).

> [!quote] [Rohin Shah](https://www.lesswrong.com/posts/NxF5G6CJiof6cemTw/coherence-arguments-do-not-imply-goal-directed-behavior)
>
> if you know that an agent is maximizing the expectation of an _explicitly represented_ utility function, I would expect that to lead to goal-driven behavior most of the time, since the utility function must be relatively simple if it is explicitly represented, and _simple_ utility functions seem particularly likely to lead to goal-directed behavior.

## Why optimal-goal-directed alignment may be hard by default

> [!quote] [_Seeking Power is Often Robustly Instrumental in MDPs_](/seeking-power-is-often-convergently-instrumental-in-mdps)
>
> On its own, [Goodhart's law](https://www.lesswrong.com/posts/EbFABnst8LsidYs5Y/goodhart-taxonomy) doesn't explain why optimizing proxy goals leads to catastrophically bad outcomes, instead of just less-than-ideal outcomes.
>
> I think that we're now starting to have this kind of understanding. [I suspect that](/the-catastrophic-convergence-conjecture) power-seeking is why capable, goal-directed agency is so dangerous by default. If we want to consider [more benign alternatives](https://www.fhi.ox.ac.uk/wp-content/uploads/Reframing_Superintelligence_FHI-TR-2019-1.1-1.pdf) to goal-directed agency, then deeply understanding the rot at the heart of goal-directed agency is important for evaluating alternatives. This work lets us get a feel for the _generic incentives_ of reinforcement learning at optimality.

For every reward function $R$ - no matter how benign, how aligned with human interests, no matter how power-averse - either $R$ or its permuted variant $\phi\cdot R$ seeks power in the given situation (intuitive-power, since the agent keeps its options open, and also formal-POWER, according to my proofs).

If I let myself be a bit more colorful, every reward function has lots of "evil" power-seeking variants (do note that the step from "power-seeking" to "misaligned power-seeking" [requires more work](/formalizing-multi-agent-power)). If we imagine ourselves as only knowing the orbit of the agent's objective, then the situation looks a bit like _this_:

![A cartoon titled "Orbit of Fortune" illustrates the hypothesized difficulty of AI alignment. A blindfolded robot faces a game wheel surrounded by 12 possible reward functions in an "orbit." Ten of the functions are on fire with devil horns, representing misaligned, power-seeking objectives.](https://assets.turntrout.com/static/images/posts/78ceb0300f76784b6d8d043afb15587fb25a50dd52a42e21.avif)
<br/>Figure: Technical note: this 12-element orbit could arise from the action of a subgroup of the symmetric group $S_4$, which has $4!=24$ elements. Consider a 4-state MDP; if the reward function assigns equal reward to exactly two states, then it would have a 12-element orbit under $S_4$.

Of course, this isn't how reward specification works - we probably are far more likely to specify certain orbit elements than others. However, the formal theory is now beginning to explain _why alignment is so hard by default, and why failure might be catastrophic!_

The structure of the environment often ensures that there are (potentially combinatorially) many more ways to misspecify the objective so that it seeks power, than there are ways to specify goals without power-seeking incentives.

## Other convergent phenomena

I'm optimistic that these symmetry arguments will help us better understand a range of different tendencies. The common thread seems like: For every "way" a thing could not happen / not be a good idea, there are many more "ways" in which it could happen / be a good idea.

- [convergent evolution](https://en.wikipedia.org/wiki/Convergent_evolution)
  - flight has independently evolved several times, suggesting that flight is adaptive in response to a wide range of conditions.

> [!quote] Wikipedia
>
> In his 1989 book [_Wonderful Life_](https://en.wikipedia.org/wiki/Wonderful_Life_\(book\)), [Stephen Jay Gould](https://en.wikipedia.org/wiki/Stephen_Jay_Gould) argued that if one could "rewind the tape of life \[and\] the same conditions were encountered again, evolution could take a very different course." [Simon Conway Morris](https://en.wikipedia.org/wiki/Simon_Conway_Morris) disputes this conclusion, arguing that convergence is a dominant force in evolution, and given that the same environmental and physical constraints are at work, life will inevitably evolve toward an "optimum" body plan, and at some point, evolution is bound to stumble upon intelligence, a trait presently identified with at least [primates](https://en.wikipedia.org/wiki/Primates), [corvids](https://en.wikipedia.org/wiki/Corvids), and [cetaceans](https://en.wikipedia.org/wiki/Cetaceans).

- the prevalence of [deceptive alignment](https://www.lesswrong.com/posts/zthDPAjh9w6Ytbeks/deceptive-alignment)
  - given inner misalignment, there are (potentially combinatorially) many more unaligned terminal reasons to lie (and survive), and relatively few unaligned terminal reasons to tell the truth about the misalignment (and be modified).

- [feature universality](https://distill.pub/2020/circuits/zoom-in/)
  - computer vision networks reliably learn edge detectors, suggesting that this is instrumental (and highly learnable) for a wide range of labelling functions and datasets.

## Note of caution

You have to be careful in applying these results to argue for real-world AI risk from deployed systems.

- They assume the agent is following an optimal policy for a reward function
  - I can relax this to $\epsilon$-optimality, but $\epsilon>0$ may be extremely small

- They assume the environment is finite and fully observable
- Not all environments have the right symmetries
  - But most ones we think about seem to

- The results don't account for the ways in which we might practically express reward functions
  - For example, often we use featurized reward functions. While most permutations of any featurized reward function will seek power in the considered situation, those permutations need not respect the featurization (and so may not even be practically expressible).

- When I say "most objectives seek power in this situation", that means _in that situation_- it doesn't mean that most objectives take the power-seeking move in most situations in that environment
  - The combinatorics conjectures will help prove the latter

This list of limitations _has_ steadily been getting shorter over time.

# Conclusion

I think that this work is beginning to formally explain why _slightly misspecified_ reward functions will probably incentivize misaligned power-seeking. Here's one hope I have for this line of research going forwards:

> One naive alignment approach involves specifying a good-seeming reward function, and then having an AI maximize its expected discounted return over time. For simplicity, we could imagine that the AI can just instantly compute an optimal policy.

Let's precisely understand why this approach seems to be so hard to align, and why extinction seems to be the cost of failure. We don't yet know how to design beneficial AI, but we largely agree that this naive approach is broken. Let's prove it.

[^1]: There exist reward functions for which it's optimal to seek power and not to seek power; for example, constant reward functions make everything optimal, and they're certainly computable. Therefore, $\text{NPS}\cup\text{PS}$ is a strict subset of the whole set of computable reward functions.
