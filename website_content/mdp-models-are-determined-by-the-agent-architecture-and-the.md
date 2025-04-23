---
permalink: MDPs-are-not-subjective
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/XkXL96H6GknCbT5QH/mdp-models-are-determined-by-the-agent-architecture-and-the
lw-is-question: "false"
lw-posted-at: 2021-05-26T00:14:00.699000Z
lw-last-modification: 2021-06-09T12:29:08.871000Z
lw-curation-date: None
lw-frontpage-date: 2021-05-26T00:43:43.780000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 34
lw-base-score: 23
lw-vote-count: 8
af-base-score: 15
af-num-comments-on-upload: 29
publish: true
title: "MDP models are determined by the agent architecture and the environmental\
  \ dynamics"
lw-latest-edit: 2021-06-02T18:31:04.668000Z
lw-is-linkpost: "false"
tags:
  - "instrumental-convergence"
  - "AI"
aliases:
  - "mdp-models-are-determined-by-the-agent-architecture-and-the"
lw-sequence-title: "The Causes of Power-seeking and Instrumental Convergence"
lw-sequence-image-grid: sequencesgrid/hawnw9czray8awc74rnl
lw-sequence-image-banner: sequences/qb8zq6qeizk7inc3gk2e
sequence-link: posts#the-causes-of-power-seeking-and-instrumental-convergence
prev-post-slug: formalizing-multi-agent-power
prev-post-title: "Generalizing POWER to multi-agent games"
next-post-slug: environmental-structure-can-cause-instrumental-convergence
next-post-title: "Environmental Structure Can Cause Instrumental Convergence"
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2021-05-26 00:00:00
original_url: https://www.lesswrong.com/posts/XkXL96H6GknCbT5QH/mdp-models-are-determined-by-the-agent-architecture-and-the
skip_import: true
description: "Agent architecture and environmental dynamics determine Markov Decision\
  \ Processes. Power-seeking tendencies are not subjective."
date_updated: 2024-11-22 20:04:30.137574
---





[_Seeking Power is Often Robustly Instrumental in MDPs_](/seeking-power-is-often-convergently-instrumental-in-mdps) relates the structure of the agent's environment (the "Markov decision process (MDP)[^POMDP] model") to the tendencies of optimal policies for different reward functions in that environment ("instrumental convergence"). The results tell us what optimal decision-making "tends to look like" in a given environment structure, formalizing reasoning that says e.g. that most agents stay alive because that helps them achieve their goals.

[^POMDP]: I think that the same point holds for other environment types, like POMDPs.

![](https://assets.turntrout.com/static/images/posts/205fc7acb3e1ab7c1aa5af9239395306b4ee76d4565f33b3.avif)
<br/>Figure: The model for a deterministic MDP. When the discount rate is near 1, most reward functions have optimal policies which go `right` .

Several people have claimed to me that these results need subjective modeling decisions.

> [!quote] [`ofer`](https://www.lesswrong.com/posts/HduCjmXTBD4xYTegv/draft-report-on-existential-risk-from-power-seeking-ai?commentId=DjjtezKuT3bCZZPJu#ay8nySSiA2SgZGAXp)
> I think using a well-chosen reward distribution is necessary, otherwise POWER depends on arbitrary choices in the design of the MDP's state graph. E.g. suppose the student \[in a different example\] writes about every action they take in a blog that no one reads, and we choose to include the content of the blog as part of the MDP state. This arbitrary choice effectively unrolls the state graph into a tree with a constant branching factor (+ self-loops in the terminal states) and we get that the POWER of all the states is equal.

In the above example, you _could_ think about the environment as in the above image, _or_ you could imagine that state "3" is actually a million different states which just happen to seem similar to us! If that were true, then optimal policies would tend to go `down`, since that would give the agent millions of choices about where it ends up. Therefore, the power-seeking theorems depend on subjective modeling assumptions.

I used to think this, but this is wrong. The MDP model is determined by the agent's implementation + the task's dynamics.

To make this point, let's back out to a more familiar MDP: Pac-Man.

![](https://assets.turntrout.com/static/images/posts/6fe10f812c950aa80e3bafd20aa87bc09ed60d57b1e1c6cc.avif)
<br/>Figure: Consider the MDP model associated with the Pac-Man video game. Ghosts kill the player - after the player loses their last life, suppose they enter a "game over" terminal state which shows the final configuration. This environment has Pac-Man's dynamics, but _not_ its usual score function. Fixing the dynamics, what actions are optimal as we vary the reward function?

When the discount rate is near 1, most reward functions avoid immediately dying to the ghost, because then they'd be stuck in a terminal state (the `red-ghost-game-over` state). But why can't the red ghost be equally well-modeled as secretly being 5 googolplex different terminal states?

An MDP model (technically, a rewardless MDP) is a tuple $\langle \mathcal{S}, \mathcal{A}, T \rangle$, where $\mathcal{S}$ is the state space, $\mathcal{A}$ is the action space, and $T:\mathcal{S} \times \mathcal{A}\to \Delta(\mathcal{S})$ is the (potentially stochastic) transition function which says what happens when the agent takes different actions at different states. $T$ has to be Markovian, depending only on the observed state and the current action, and not on prior history.

Whence cometh this MDP model? Thin air? Is it just a figment of our imagination, which we use to understand what the agent is doing as it learns a policy?

When we train a policy function in the real world, the function takes in an _observation_ (the state) and outputs (a distribution over) _actions_. When we define state and action encodings, this implicitly defines an "interface" between the agent and the environment. The state encoding might look like "the set of camera observations" or "the set of Pac-Man game screens", and actions might be numbers 1-10 which are sent to actuators, or to the computer running the Pac-Man code, etc.

(In the real world, the computer simulating Pac-Man may suffer a hardware failure / be hit by a gamma ray / etc, but I don't currently think these are worth modeling over the timescales over which we train policies.)

Suppose that for every state-action history, what the agent sees next depends only on the currently observed state and the most recent action taken. Then the environment is Markovian (transition dynamics only depend on what you do right now, not what you did in the past) and fully observable (you can see the whole state all at once), and the agent encodings have defined the MDP model.

---

In Pac-Man, the MDP model is uniquely defined by how we encode states and actions, and the part of the real world which our agent interfaces with. If you say "maybe the red ghost is represented by 5 googolplex states", then that's a _falsifiable claim_ about the kind of encoding we're using.

That's also a claim that we can, in theory, specify reward functions which distinguish between 5 googolplex variants of `red-ghost-game-over`. If that were true, then yes - optimal policies _really would_ tend to "die" immediately, since they'd have so many choices.

The "5 googolplex" claim is both falsifiable and false. Given an agent architecture (specifically, the two encodings), optimal policy tendencies are not subjective. We may be uncertain about the agent's state- and action-encodings, but that doesn't mean we can imagine whatever we want.
