---
permalink: RL-textbook-review
lw-was-draft-post: "false"
lw-is-af: "false"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/BGv98aKicyT8eH4AY/making-a-difference-tempore-insights-from-reinforcement
lw-is-question: "false"
lw-posted-at: 2018-07-05T00:34:59.249000Z
lw-last-modification: None
lw-curation-date: None
lw-frontpage-date: 2018-07-05T17:58:20.723000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 6
lw-base-score: 33
lw-vote-count: 11
af-base-score: 0
af-num-comments-on-upload: 0
title: "Making a Difference Tempore: Insights from 'Reinforcement Learning: An Introduction'"
lw-latest-edit: 2018-07-05T00:34:59.249000Z
lw-is-linkpost: "false"
tags:
  - summaries
  - reinforcement-learning
aliases:
  - making-a-difference-tempore-insights-from-reinforcement
lw-sequence-title: Becoming Stronger
lw-sequence-image-grid: sequencesgrid/fkqj34glr5rquxm6z9sr
lw-sequence-image-banner: sequences/oerqovz6gvmcpq8jbabg
sequence-link: posts#becoming-stronger
prev-post-slug: swimming-upstream
prev-post-title: "Swimming Upstream: A Case Study in Instrumental Rationality"
next-post-slug: second-analysis-textbook-review
next-post-title: "Turning Up the Heat: Insights from Tao's 'Analysis II'"
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2018-07-05 00:00:00
original_url: https://www.lesswrong.com/posts/BGv98aKicyT8eH4AY/making-a-difference-tempore-insights-from-reinforcement
no_dropcap: "true"
skip_import: true
description: "A deep dive into reinforcement learning, covering algorithms, exploration vs. exploitation, and the importance of safe AI development."
date_updated: 2026-01-25 23:47:56.984113
---











> [!quote] Reinforcement Learning: An Introduction
> The safety of artificial intelligence applications involving reinforcement learning is a topic that deserves careful attention.

# Reinforcement Learning

## 1: Introduction

## 2: Multi-armed Bandits

_Bandit basics, including non-stationarity, the value of optimism for incentivizing exploration, and upper-confidence-bound action selection._

Some explore/exploit results are relevant to daily life - I highly recommend reading _[Algorithms to Live By: The Computer Science of Human Decisions](https://www.amazon.com/Algorithms-Live-Computer-Science-Decisions/dp/1627790365)_.

## 3: Finite Markov Decision Processes

_The framework._

## 4: Dynamic Programming

_Policy evaluation, policy improvement, policy iteration, value iteration, generalized policy iteration. What a nomenclative nightmare._

## 5: Monte Carlo Methods

_Prediction, control, and importance sampling._

### Importance Sampling

After gathering data with our behavior policy $b$, we then want to approximate the value function for the target policy $\pi$. In off-policy methods, the policy we use to gather the data is different from the one whose value $v_\pi$ we're trying to learn; in other words, the distribution of states we sample is different. This gives us a skewed picture of $v_\pi$, so we must overcome this bias.

If $b$ can take all of the actions that $\pi$ can (i.e. $\forall a,s: \pi(a|s)>0\implies b(a|s) >0$), we can overcome by adjusting the return $G_t$ of taking a series of actions $A_t,\dots,A_{T-1}$ using the importance-sampling ratio $\rho_{t:T-1} := \prod_{k=t}^{T-1}\frac{\pi(A_k \,|\,S_k)}{b(A_k \,|\,S_k)}$. This cleanly recovers $v_\pi$ by the definition of expectation:

$$
\begin{align*}
\rho_{t:T-1}\mathbb{E}_b[G_t\,|\,S_t=s] &= \bigg(\prod_{k=t}^{T-1}\frac{\pi(A_k \,|\,S_k)}{b(A_k \,|\,S_k)}\bigg)\mathbb{E}_b[G_t\,|\,S_t=s]\\
&= \mathbb{E}_\pi[G_t\,|\,S_t=s] \\
&= v_\pi(s).
\end{align*}
$$

Then after observing some set of returns (where $\{G_t\}_{t \in \mathcal{T}(s)}$ are the relevant returns for state $s$), we define the state's value as the average adjusted observed return:

$$
V(s):=\frac{\sum_{t \in \mathcal{T}(s)} \rho_{t:T(t)-1}G_t}{|\mathcal{T}(s)|}.
$$

However, the $\rho_{t:T(t)-1}$'s can be arbitrarily large (suppose $\pi(A\,|\,S)=.5$ and $b(A\,|\,S) = 1×10^{-10}$; $\frac{.5}{1×10^{-10}}=.5×10^{10}$), so the variance of this estimator can get pretty big. To get an estimator whose variance converges to 0, try:

$$
V(s):=\frac{\sum_{t \in \mathcal{T}(s)} \rho_{t:T(t)-1}G_t}{\sum_{t \in \mathcal{T}(s)} \rho_{t:T(t)-1}}.
$$

### Death and Discounting

Instead of viewing the discount factor $\gamma$ as measuring how much we care about the future, think of it as encoding the probability we don't terminate on any given step. That is, we expect with $1-\gamma$ probability to die on the next turn, so we discount rewards accordingly.

This intuition hugs pre-theoretic understanding much more closely; if you have just 80 years to live, you might dive that big blue sky. If, however, you imagine there's a non-trivial chance that humanity can be more than just a flash amongst the stars, you probably care more about the far future.

## 6: Temporal-Difference Learning

_The tabular triple threat:_ $\text{TD(0)}$, `SARSA`_, and Q-learning._

### Learning TD Learning

$$
V(S_t) \gets V(S_t) + \alpha \Big[\underbrace{\overbrace{R_{t+1} + \gamma V(S_{t+1})}^\text{TD target} - V(S_t)}_\text{TD error} \Big]
$$

### $_\text{TD(0)}\star^\text{SARSA}_\text{Q}$

- $\text{TD(0)}$ is one-step bootstrapping of _state values_ $v_\pi$. It helps you learn the value of a given policy, and is not used for control.
- `SARSA` is on-policy one-step bootstrapping of the _action values_ $q_\pi$ using the quintuples $(S,A,R,S',A')$.

> [!quote]
> As in all on-policy methods, we continually estimate $q_\pi$ for the policy $\pi$, and at the same time change $\pi$ toward greediness with respect to $q_\pi$.

- Q-learning is _off-policy_ one-step bootstrapping of action values $q_\pi$.
  - You take an action using π and then use the maximal action value at the next state in your TD target term.

### $\max$imization bias

With great branching factors come great biases, and optimistic bias is problematic for Q-learning.

>     [!math] Definition
>
> The Q-learning update rule for state $S_t$, action $A_t$, and new state $S_{t+1}$ is
>
> $$
> Q(S_t,A_t) \gets Q(S_t,A_t) + \alpha\Big[R_{t+1} + \gamma \max_a Q(S_{t+1}, a) - Q(S_t, A_t)\Big].
> $$

Suppose the rewards for all 100 actions at $S_{t+1}$ are distributed according to $\mathcal{N}(0,1)$. All of these actions have a true (expected) value of 0, but the probability that none of their estimates are greater than .8 after 1 draw each is $\Phi(.8)^{100}\approx4.6×10^{-11}$. The more actions you have, the higher the probability is that at the maximum is just an outlier. See: [regression toward the mean and mutual funds](https://en.wikipedia.org/wiki/Regression_toward_the_mean#Importance).

To deal with this, we toss another Q-learner into the mix; at any given update, one has their value updated and the other greedifies the policy. The double Q-learning scheme works because both Q-learners are unlikely to be biased in the same way. For some reason, this [wasn't discovered until 2010](https://papers.nips.cc/paper/3964-double-q-learning).

## 7: $n$-step Bootstrapping

$n$-_step everything._

## 8: Planning and Learning with Tabular Methods

_Models, prioritized sweeping, expected vs. sample updates, MCTS, and rollout algorithms._

### Roles Models Play

_Distribution_ models include the full range of possible futures and their probabilities. For example, a distribution model for two fair coins:

$$
\{\text{HH: .25, HT: .5, TT: .25}\}.
$$

_Sample_ models just let you, well, sample. `HH, HT, HT, HT, HH, TT, HH, HT`... You could sample thousands of times and gain a high degree of confidence that the above distribution model is generating the data, but this wouldn't be your _only_ hypothesis (granted, it might have the lowest Kolmogorov complexity).

Note that a distribution model also can function as a sample model.

## 9: On-policy Prediction with Approximation

_We finally hit the good stuff: value-function approximators and gradient methods._

## 10: On-policy Control with Approximation

## 11: Off-policy Methods with Approximation

_The_ $\mathfrak{deadly}\text{ }\mathfrak{triad}$ _of function approximation, bootstrapping, and off-policy training converge to sow <span class='corrupted'>divergence</span> and <span class='corrupted'>instability</span> in your methods. Metal._

## 12: Eligibility Traces

_I was told to skip this chapter; the first half was my favorite part of the book._

$\text{TD}(\lambda)$ uses a backwards-view eligibility trace to update features, which I find elegant. Suppose you have some feature extraction function $\phi:\mathcal{S}\to\mathbb{R}^\text{d}$. Then you apply your TD update not only based on the features relevant at the current state, but also to the time-decaying traces of the features of previously visited states. $\lambda \in [0,1]$ sets how quickly this eligibility decay happens; $\lambda=0$ recovers $\text{TD(0)}$, while $\lambda=1$ recovers Monte-Carlo return methods.

When I was a kid, there was a museum I loved going to - it had all kinds of wacky interactive devices for kids. One of them took sounds and "held them in the air" at a volume which slowly decreased as a function of how long ago the sound was made. State features are sounds, and volume is eligibility.

## 13: Policy Gradient Methods

_The policy gradient theorem, REINFORCE, and actor-critic._

## 14: Psychology

_Creating a partial mapping between reinforcement learning and psychology._

### Mental, Territorial

There was a word I was looking for that "mental model" didn't quite seem to fit: "the model with respect to which we mentally simulate courses of action". CFAR's "inner sim" terminology didn't quite map either, as to me, that points to the _system-in-motion_ more than _that-on-which-the-system-runs_. The literature dubs this a cognitive map.

> [!quote] [Cognitive map](https://en.wikipedia.org/wiki/Cognitive_map)
>
> Individual place cells within the hippocampus correspond to separate locations in the environment with the sum of all cells contributing to a single map of an entire environment. The strength of the connections between the cells represents the distances between them in the actual environment. The same cells can be used for constructing several environments, though individual cells' relationships to each other may differ on a map by map basis. The possible involvement of place cells in cognitive mapping has been seen in a number of mammalian species, including rats and macaque monkeys. Additionally, in a study of rats by Manns and Eichenbaum, pyramidal cells from within the hippocampus were also involved in representing object location and object identity, indicating their involvement in the creation of cognitive maps.

Given [my work on whitelisting](/whitelisting-impact-measure), I've been thinking about why we're so "object-oriented" in our mental lives. An off-the-cuff hypothesis: to better integrate with the rest of our mental models, the visual system directly links up to our object schema. One such object is then recognized and engraved as a discrete "thing" in our map. Hence, we emotionally "know" that the world "really is" made up of objects, and isn't just a collection of particles.

> [!quote] Lynch, 1960
> Most of the information used by people for the cognitive mapping of spaces is gathered through the visual channel.

[Lahav and Mioduser's research](http://playpen.icomtek.csir.co.za/~acdc/assistive%20devices/Artabilitation2008/archive/2004/papers/2004_S04_N4.pdf) somewhat supports this idea, suggesting that blind people not only have lower-fidelity and more declarative (as opposed to procedural / interactive) cognitive maps, they're also less likely to provide object-to-object descriptions.

> [!warning] Epistemic status
> I made a not-obviously wrong hypothesis and found two pieces of corroborating evidence.

## 15: Neuroscience

_The reward prediction error hypothesis, dopamine, neural actor-critic, hedonistic neurons, and addiction._

## 16: Applications and Case Studies

_From checkers to checkmate._

## 17: Frontiers

_Temporal abstraction, designing reward signals, and the future of reinforcement learning. In particular, the idea I had for having a whitelist-enabled agent predict expected object-level transitions is actually one of the frontiers: general value functions. Rad._

### Pandora's AI Boxing

> The rapid pace of advances in AI has led to warnings that AI poses serious threats to our societies, even to humanity itself.

This chapter talks a fair amount about the serious challenges in AI alignment (not sure if you all have heard of that problem), which is heartening.

> As to safety, hazards possible with reinforcement learning are not completely different from those that have been managed successfully for related applications of optimization and control methods.

I'm not sure about that. Admittedly, I'm not as familiar with those solutions, but the challenge here seems to be of a qualitatively different caliber. Conditional on true AI's achievement, we'd want to have extremely high confidence that it pans out _before_ we flip the switch. The authors acknowledge that:

> it may be impossible for the agent to achieve the designer's goal no matter what its reward signal is.

I don't think it's impossible, but it's going to be extremely hard to get formal probabilistic guarantees. I mean, if you don't know an agent's rationality, [you can't learn their utility function](https://www.lesswrong.com/posts/rtphbZbMHTLCepd6d/humans-can-be-assigned-any-values-whatsoever). If you do know their rationality but not their probability distribution over outcomes, [you still can't learn their utility function](https://www.lesswrong.com/posts/kYgWmKJnqq8QkbjFj/bayesian-utility-representing-preference-by-probability).

The above constitutes _one_ of the [many](https://arbital.com/p/advanced_safety/) [open problems in alignment theory](https://arbital.com/p/taskagi_open_problems). If that's not enough, there are always the unknown unknowns...

## Final Thoughts

I read the "nearly complete" [draft of the second edition](http://incompleteideas.net/book/the-book-2nd.html). It was pretty good, but I did find most of the exercises either too easy or requiring considerable programming investment to set up the environment described. The former makes sense, as I've already taken a course on this, and I'm probably a bit above the introductory level.

Some graphs could have been more clearly designed, and some math in the proof of Linear $\text{TD(0)}$'s convergence (p. 206-207) is underspecified:

> In general, $\textbf{w}_t$ will be reduced toward zero whenever $\textbf{A}$ is positive definite, meaning $y^\top\textbf{A}y > 0$ for real vector $y$.

An additional precondition: $y$ can't be the zero vector.

> For a key matrix of this type, positive definiteness is assured if all of its columns sum to a non-negative number.

Unless I totally missed what "this type" entails, this is false if taken at face value:

$$
\begin{pmatrix} -2 & 5\\ 5 & -2 \end{pmatrix}
$$

has non-negative column sums and is also indefinite, having eigenvalues of 3 and -7.

However, the claim _is_ true in the subtle way they use it - they're _actually_ showing that since the matrix is symmetric, real, and strictly diagonally dominant with positive diagonal entries, it's also positive definite. This could be made clearer.

In all, reading this book was definitely a positive experience.

# Forwards

I'll be finishing _Analysis II_ before moving on to Jaynes's _Probability Theory_ in preparation for a class in the fall.

## Dota 2

Recently, OpenAI [made waves with their OpenAI Five Dota 2 bot](https://blog.openai.com/openai-five/). To REINFORCE what I just learned and solidified, I might make a post in the near future breaking down how _Five_ differs from the _Alpha(Go) Zero_ approach, quantifying my expectations for _The International_ for [calibration](https://en.wikipedia.org/wiki/Brier_score).

## No Longer a Spectator

Four months and one week ago, [I started my journey](/set-theory-textbook-review) through the MIRI reading list. In those dark days, attempting a proof induced a stupor similar to that I encountered approaching a crush in grade school, my words and thoughts leaving me.

Six textbooks later and with a _little_ effort, I'm able to prove things like the convergence of Monte Carlo integration to the Riemann integral, threading together lessons from _All of Statistics_ and _Analysis I_; target in mind, words and thoughts remaining firmly by my side.

> [!quote]
>
> The rapid pace of advances in artificial intelligence has led to warnings that artificial intelligence poses serious threats to our societies, even to humanity itself. The renowned scientist and artificial intelligence pioneer Herbert Simon anticipated the warnings we are hearing today...
>
> He spoke of the eternal conflict between the promise and perils of any new knowledge, reminding us of the Greek myths of Prometheus, the hero of modern science, who stole fire from the gods for the benefit of mankind, and Pandora, whose box could be opened by a small and innocent action to release untold perils on the world.
>
> Simon urged us to recognize that as designers of our future and _not mere spectators_, the decisions _we_ make can tilt the scale in Prometheus' favor.
