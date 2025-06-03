---
permalink: attainable-utility-landscape
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/fj8eyc7QzqCaB8Wgm/attainable-utility-landscape-how-the-world-is-changed
lw-is-question: 'false'
lw-posted-at: 2020-02-10T00:58:01.453000Z
lw-last-modification: 2020-07-25T21:12:42.735000Z
lw-curation-date: None
lw-frontpage-date: 2020-02-10T01:35:52.303000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 7
lw-base-score: 52
lw-vote-count: 17
af-base-score: 22
af-num-comments-on-upload: 5
publish: true
title: 'Attainable Utility Landscape: How The World Is Changed'
lw-latest-edit: 2020-07-10T22:41:11.251000Z
lw-is-linkpost: 'false'
tags:
  - understanding-the-world
  - impact-regularization
aliases:
  - attainable-utility-landscape-how-the-world-is-changed
lw-sequence-title: Reframing Impact
lw-sequence-image-grid: sequencesgrid/izfzehxanx48hvf10lnl
lw-sequence-image-banner: sequences/zpia9omq0zfhpeyshvev
sequence-link: posts#reframing-impact
prev-post-slug: seeking-power-is-often-convergently-instrumental-in-mdps
prev-post-title: Seeking Power is Often Convergently Instrumental in MDPs
next-post-slug: the-catastrophic-convergence-conjecture
next-post-title: The Catastrophic Convergence Conjecture
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2020-02-10 00:00:00
original_url: https://www.lesswrong.com/posts/fj8eyc7QzqCaB8Wgm/attainable-utility-landscape-how-the-world-is-changed
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/k5K8m32.png
description: Examining how our actions reshape the landscape of achievable goals,
  highlighting opportunity costs and the structure of agency in shaping the future.
date_updated: 2025-01-30 09:30:36.233182
---







![](https://assets.turntrout.com/static/images/posts/zLypKDZ.avif)

![](https://assets.turntrout.com/static/images/posts/BtzHnUq.avif)

![](https://assets.turntrout.com/static/images/posts/M8XHzxd.avif)

![](https://assets.turntrout.com/static/images/posts/k5K8m32.avif)

![](https://assets.turntrout.com/static/images/posts/W8lgpjG.avif)

![](https://assets.turntrout.com/static/images/posts/JnuDbeE.avif)

![](https://assets.turntrout.com/static/images/posts/HPIugVR.avif)

![](https://assets.turntrout.com/static/images/posts/VKy57Od.avif)

![](https://assets.turntrout.com/static/images/posts/Ej0sTdK.avif)

>! (One interpretation of the prompt is that you haven't _chosen_ to go to the moon. If you imagined yourself as more prepared, that's also fine.)
>
>! If you were plopped onto the moon, you'd die pretty fast. Maybe the "die as quickly as possible" AU is high, but not much else - not even the "live on the moon" AU! We haven't yet reshaped the AU landscape on the moon to be hospitable to a wide range of goals. [Earth is special like that.](https://www.youtube.com/watch?v=wupToqz1e2g)

![](https://assets.turntrout.com/static/images/posts/BtzHnUq.avif)

![](https://assets.turntrout.com/static/images/posts/rWIlQBC.avif)

![](https://assets.turntrout.com/static/images/posts/pbIRrce.avif)

![](https://assets.turntrout.com/static/images/posts/kxEOLhj.avif)

![](https://assets.turntrout.com/static/images/posts/kZMKfRu.avif)

## AU landscape as a unifying frame

Attainable utilities are calculated by winding your way through possibility-space, considering and discarding possibility after possibility to find the best plan you can. This frame is unifying.

Sometimes you advantage one AU at the cost of another, moving through the state space towards the best possibilities for one goal and away from the best possibilities for another goal. This tradeoff is _opportunity cost_.

![](https://assets.turntrout.com/static/images/posts/z4o5j3F.avif)

Sometimes you gain more control over the future: most of the best possibilities make use of a windfall of cash. Sometimes you act to preserve control over the future: most Tic-Tac-Toe goals involve not ending the game right away. Otherwise put: preserving _power_.

![](https://assets.turntrout.com/static/images/posts/3HUBl5H.avif)

Other people usually _objectively impact_ you by decreasing or increasing a bunch of your AUs (generally, by changing your power). This happens for an extremely wide range of goals because of the structure of the environment.

Sometimes, the best possibilities are made unavailable or worsened only for goals much like yours. This outcome involves a _value impact_ for your goals.

![](https://assets.turntrout.com/static/images/posts/Sj2LrqK.avif)

Sometimes a bunch of the best possibilities go through the same part of the future: fast travel to random places on Earth usually involves the airport. This commonality is _instrumental convergence_.

![](https://assets.turntrout.com/static/images/posts/T8JS7kT.avif)

> [!info] Exercise
> Track what’s happening to your various AUs during the following story: you win the lottery. Being an effective spender, you use most of your cash to buy a majority stake in a major logging company. Two months later, the company goes under.

## Appendix: AU landscape and world state contain equal information

In the context of finite deterministic Markov decision processes, there's a wonderful handful of theorems which basically say that the AU landscape and the environmental dynamics encode each other. That is, they contain the _same_ information, just with different emphasis. This supports thinking of the AU landscape as a "dual" of the world state.

> [!quote]
>
> Let $\langle \mathcal{S}, \mathcal{A}, T, \gamma \rangle$ be a rewardless deterministic MDP with finite state and action spaces $\mathcal{S}, \mathcal{A}$, deterministic transition function $T$, and discount factor $\gamma \in (0,1)$. As our interest concerns optimal value functions, we consider only stationary, deterministic policies: $\Pi := \mathcal{A}^\mathcal{S}$.
>
> The first key insight is to consider not policies, but the trajectories induced by policies from a given state; to not look at the state itself, but the _paths through time_ available from the state. We concern ourselves with the _possibilities_ available at each juncture of the MDP.
>
> To this end, for $\pi \in \Pi$, consider the mapping of $\pi \mapsto (\mathbf{I}-\gamma \mathbf{T}^\pi)^{-1}$ (where $\mathbf{T}^\pi(s,s') :=T(s,\pi(s),s')$); in other words, each policy $\pi$ maps to a function mapping each state $s_0$ to a discounted state visitation frequency vector $\mathbf{f}^\pi_{s_0}$, which we call a _possibility_. The meaning of each frequency vector is: starting in state $s_0$ and following policy $\pi$, what sequence of states $s_0, s_1, \ldots$ do we visit in the future? States visited later in the sequence are discounted according to $\gamma$: the sequence $s_0s_1s_2s_2\ldots$ would induce 1 visitation frequency on $s_0$, $\gamma$ visitation frequency on $s_1$, and $\frac{\gamma^2}{1-\gamma}$ visitation frequency on $s_2$.

![](https://assets.turntrout.com/static/images/posts/beLDjAs.avif)

The possibility function $\mathcal{F}(s)$ outputs the possibilities available at a given state $s$:

![](https://assets.turntrout.com/static/images/posts/H1HS9Zk.avif)

Put differently, the possibilities available are all of the potential film-strips of how-the-future-goes you can induce from the current state.

![](https://assets.turntrout.com/static/images/posts/iQxjw0B.avif)

### Possibility isomorphism

We say two rewardless MDPs $M$ and $M'$ are _isomorphic up to possibilities_ if they induce the same possibilities. Possibility isomorphism captures the essential aspects of an MDP's structure, while being invariant to state representation, state labelling, action labelling, and the addition of superfluous actions (actions whose results are duplicated by other actions available at that state). Formally, $M \simeq_\mathcal{F} M'$ when there exists a bijection $\phi : \mathcal{S} \to \mathcal{S}'$ (letting $\mathbf{P}_\phi$ be the corresponding $|\mathcal{S}|$\-by-$| \mathcal{S}' |$ permutation matrix) satisfying $\mathcal{F}_M(s)=\left\{\mathbf{P}_\phi\mathbf{f}'\,|\,\mathbf{f}'\in\mathcal{F}_{M'}(\phi(s))\right\}$ for all $s\in\mathcal{S}$.

This isomorphism is a natural contender[^1] for the canonical (finite) MDP isomorphism:

> [!math] A theorem I proved
> $M$ and $M'$ are isomorphic up to possibilities IFF their directed graphs are isomorphic (and they have the same discount rate).

### Representation equivalence

Suppose I give you the following possibility sets, each containing the possibilities for a different state:

$$
\left\{\begin{pmatrix}
           4 \\
           0 \\
           0 \end{pmatrix},
\begin{pmatrix}
           1 \\
           .75 \\
           2.25 \end{pmatrix},
\begin{pmatrix}
           \frac{1}{.4375}\\ 4-\frac{1}{.4375} \\ 0 \end{pmatrix}\right\}
\\
\left\{\begin{pmatrix}
           0 \\
           0 \\
           4 \end{pmatrix}
\right\} \qquad\left\{\begin{pmatrix}
           0 \\
           1 \\
           3 \end{pmatrix},
\begin{pmatrix}
           4-\frac{1}{.4375}\\ \frac{1}{.4375} \\ 0 \end{pmatrix},
\begin{pmatrix}
           3 \\
           1 \\
           0 \end{pmatrix}
\right\}

$$
> [!info] Exercise
>
> What can you figure out about the MDP structure? Hint: each entry in the column corresponds to the visitation frequency of a different state; the first entry is always $s_1$, second $s_2$, and third $s_3$.
>
> >! You can figure out _everything_: $\langle \mathcal{S}, \mathcal{A}, T, \gamma \rangle$, up to possibility isomorphism. [Solution](https://assets.turntrout.com/static/images/posts/5GCZ9oY.avif).
> >
> >! How? Well, the $L_1$ norm of the possibility vector is always $\frac{1}{1-\gamma}$, so you can deduce $\gamma=.75$ easily. The single possibility state must be isolated, so we can mark that down in our graph. Also, it's in the third entry.
> >
> >! The other two states correspond to the "1" entries in their possibilities, so we can mark that down. The rest follows straightforwardly.

> [!math] Theorem
> Suppose the rewardless MDP $M$ has possibility function $\mathcal{F}$. Given only $\mathcal{F}$,[^2] $M$ can be reconstructed up to possibility isomorphism.

In MDPs, the "AU landscape" is the set of optimal value functions for all reward functions over states in that MDP. If you know the optimal value functions for just $|\mathcal{S}|$ reward functions, you can also reconstruct the rewardless MDP structure.[^3]

From the environment (rewardless MDP), you can deduce the AU landscape (all optimal value functions) and all possibilities. From possibilities, you can deduce the environment and the AU landscape. From the AU landscape, you can deduce the environment (and thereby all possibilities).

![](https://assets.turntrout.com/static/images/posts/D8PPNKp.avif)
Figure: All of these encode the same mathematical object.

## Appendix: Opportunity cost

Opportunity cost is when an action you take makes you more able to achieve one goal but less able to achieve another. Even this simple world has opportunity cost:

![](https://assets.turntrout.com/static/images/posts/rFfZvVh.avif)

Going to the green state means you can't get to the purple state as quickly.

On a deep level, why is the world structured such that this happens? Could you imagine a world without opportunity cost of any kind? The answer, again in the rewardless MDP setting, is simple: "yes, but the world would be trivial: you wouldn't have any choices". Using a straightforward formalization of opportunity cost, we have:

> [!math] Existence of opportunity cost
> Opportunity cost exists in an environment IFF there is a state with more than one possibility.

Philosophically, opportunity cost exists when you have meaningful choices. When you make a choice, you're necessarily moving away from some potential future but towards another; since you can't be in more than one place at the same time, opportunity cost follows. Equivalently, we assumed the agent isn't infinitely farsighted ($\gamma<1$); if it were, it would be possible to be in "more than one place at the same time", in a sense (thanks to Rohin Shah for this interpretation).

While understanding opportunity cost may seem like a side-quest, each insight is another brick in the edifice of our understanding of the incentives of goal-directed agency.

# Notes

- Just as game theory is a great abstraction for modeling competitive and cooperative dynamics, AU landscape is great for thinking about consequences: it automatically excludes irrelevant details about the world state. We can think about the effects of events without needing a specific utility function or ontology to evaluate them. In multi-agent systems, we can straightforwardly predict the impact the agents have on each other and the world.
- “Objective impact to a location” means that agents whose plans route through the location tend to be objectively impacted.
- The landscape is not the territory: [AU is calculated with respect to an agent's _beliefs_](/the-gears-of-impact), not necessarily with respect to what really "could" or will happen.

[^1]: The possibility isomorphism is new to my work, as are all other results shared in this post. This apparent lack of basic theory regarding MDPs is strange; even stranger, this absence was actually pointed out in two [published](http://papers.nips.cc/paper/3179-stable-dual-dynamic-programming.pdf) [papers](https://ieeexplore.ieee.org/stamp/stamp.jsp?arnumber=4220813)!

    I find the existing MDP isomorphisms/equivalences to be pretty lacking. The details don't fit in this margin, but perhaps in a paper at some point. If you want to coauthor this (mainly compiling results, finding a venue, and responding to reviews), let me know. Added later: The results are available in the appendices of [my dissertation](https://arxiv.org/abs/2206.11831).

[^2]: In fact, you can reconstruct the environment using only a limited subset of possibilities: the _non-dominated_ possibilities.

[^3]: As a tensor, the transition function $T$ has size $|\mathcal{A}|\cdot|\mathcal{S}|^2$, while the AU landscape representation only has size $|\mathcal{S}|^2$. However, if you're just representing $T$ as a transition _function_, it has size $|\mathcal{A}|\cdot|\mathcal{S}|$.
