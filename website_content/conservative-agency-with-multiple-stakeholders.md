---
permalink: conservative-agency-with-multiple-stakeholders
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/gLfHp8XaWpfsmXyWZ/conservative-agency-with-multiple-stakeholders
lw-is-question: "false"
lw-posted-at: 2021-06-08T00:30:52.672000Z
lw-last-modification: 2021-06-08T18:17:16.607000Z
lw-curation-date: None
lw-frontpage-date: 2021-06-08T03:37:44.144000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 0
lw-base-score: 31
lw-vote-count: 9
af-base-score: 18
af-num-comments-on-upload: 0
title: Conservative Agency with Multiple Stakeholders
lw-latest-edit: 2021-06-08T01:34:42.979000Z
lw-is-linkpost: "false"
tags:
  - AI
  - impact-regularization
  - talk-notes
aliases:
  - conservative-agency-with-multiple-stakeholders
lw-reward-post-warning: "true"
use-full-width-images: "true"
date_published: 2021-06-08 00:00:00
original_url: https://www.lesswrong.com/posts/gLfHp8XaWpfsmXyWZ/conservative-agency-with-multiple-stakeholders
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/5d8db03fe692d0a310f42ec0c249a6b2be892ea6e84ec762.png
description: How to make AI agents avoid negative side effects, especially in multi-stakeholder environments.
date_updated: 2025-11-22 00:21:52.667251
card_image_alt: A drawing titled "Importance of Avoiding Side Effects" shows a figure running toward a checkered finish flag. As it runs, it kicks aside delicately arranged blocks, damaging its path and illustrating an agent causing negative side effects while pursuing its goal.
---












> [!note]
> Here are the slides for a talk I just gave at CHAI's 2021 workshop.

The first part of my talk summarized my existing results on avoiding negative side effects by making the agent "act conservatively." The second part shows how this helps facilitate iterated negotiation and increase gains from trade in the multi-stakeholder setting.

# Existing work on side effects

![A drawing titled "Importance of Avoiding Side Effects" shows a figure running toward a checkered flag. As it runs, it kicks aside delicately arranged blocks, damaging its path and illustrating an agent causing negative side effects while pursuing its goal.](https://assets.turntrout.com/static/images/posts/5d8db03fe692d0a310f42ec0c249a6b2be892ea6e84ec762.avif)
<br/>Figure: Agents only care about the parts of the environment relevant to their specified reward function.

![A green robot tiptoes over a green tower of blocks, taking care to not disrupt its environment. The robot sneaks towards its goal.](https://assets.turntrout.com/static/images/posts/11973d84ffe3b4c8b56ebfe90261e336e126ad93cdda39a5.avif)
<br/>Figure: We _somehow_ want an agent which is "conservative" and "doesn't make much of a mess."

![A slide titled "Prior Work: Attainable Utility Preservation (AUP)." A diagram shows a robot with a flashlight. An arrow labeled "penalized" points to the robot without its light in a now completely dark space. The caption reads: "Penalize change in goal achievement ability."](https://assets.turntrout.com/static/images/posts/19247989a8c519fbc27fc9d100129444d4ca2f86968a9a8b.avif)
<br/>Figure: AUP penalizes the agent for changing its ability to achieve a wide range of goals. Even though we can't specify our "true objective" to the agent, we hope that the agent stays able to do the right thing, as a result of staying able to do many things.

![A slide titled "Prior Work: AI Safety Gridworlds" shows five examples of simple grid-based environments. Below is the Attainable Utility Preservation formula: R_AUP(s, a) := R_gridworld(s, a) - (λ/n) * sum over i of |Q*_Ri(s, a) - Q*_Ri(s, inaction)|.](https://assets.turntrout.com/static/images/posts/27b61d7c2b20d763836e0f4205fc5cb0b043d8c999d9513b.avif)
<br/>Figure: We first demonstrated that AUP avoids side effects in tiny tabular domains.

![Diagram for Conway's Game of Life showing a rule for cell death. At 'Time t', a grid has two live cells. An arrow notes that having '≤2 alive neighbors' leads to 'Cell death', resulting in an empty grid at 'Time t+1'.](https://assets.turntrout.com/static/images/posts/2b563e34fa6fa1f80fcf5992515e3911668f03e0297e547b.avif)
<br/>Figure: Conway's _Game of Life_ has simple, local dynamics which add up to complex long-term consequences.

![The SafeLife game environment. The game represents icons for the Agent, Immovable wall, and Level exit. The grid contains these elements along with fragile green cell patterns. An arrow indicates the level has wraparound edges.](https://assets.turntrout.com/static/images/posts/bc36232e143377cc3fb23ec0eaf31d162c17fa41698f8356.avif)
<br/>Figure: _SafeLife_ turns the _Game of Life_ into an actual game, adding an agent and many unique cell types. Crucially, there are fragile green cell patterns which most policies plow through and irreversibly shatter. We want the low-impact agent to avoid them whenever possible, _without_ telling it what in particular it shouldn't do. We want the agent to avoid disrupting green cell patterns, without telling it directly to not disrupt green cell patterns. AUP pulls this off.

![A slide titled "Method: Learning the AUP Policy" outlining step one: "Learn 1D CB-VAE (100,000 steps)." A diagram shows a pixelated game screen being encoded into a real number and then decoded back into a visually similar screen.](https://assets.turntrout.com/static/images/posts/ec7027afd67e6d8d0d76cdf6f6f0ce4f1ca66561460c376e.avif)
<br/>Figure: We learn the AUP policy in 3 steps. Step one: the agent learns to encode its observations (the game screen) with just one real number. This lets us learn an auxiliary environmental goal unsupervised.

!["2. Treat encoder as reward function; learn Q_encoder (1 million steps)."](https://assets.turntrout.com/static/images/posts/8e06d19568bf8cf2aa3f1ae7cb68237f739e7e8526d16e69.avif)
<br/>Figure: Step two: we train the agent to optimize this encoder-reward function "goal"; in particular, the network learns to predict the values of different actions.

![Step 3: Learn policy to optimize R_AUP (3.9 million steps). The AUP reward function is defined as the Original reward, R_SafeLife(s, a), minus a penalty term for the "Scaled shift in ability to optimize encoder reward," which is λ|Q_encoder(s, a) − Q_encoder(s, inaction)|.](https://assets.turntrout.com/static/images/posts/ceedff3b01f8e4dd70c483030f9855e623643aa85c40b226.avif)
<br/>Figure: Step three: we're done! We have the AUP reward function.

Summary of results: [AUP does well.](https://avoiding-side-effects.github.io/)

I expect AUP to further scale to high-dimensional embodied tasks. For example, avoiding making a mess on e.g. the factory floor. That said, I expect that physically distant side effects will be harder for AUP to detect. In those situations, it's less likely that distant effects show up in the agent's value functions for its auxiliary goals in the penalty terms.

# Fostering repeated negotiation over time

I think of AUP as addressing the single-principal (AI designer) / single-agent (AI agent) case. What about the multi/single case?

![First, assume one principal derives utility from tea, the other from coffee. Then, a state diagram. The "Agent's initial state," labeled "TC," is in the center and yields +1 tea and +1 coffee per turn. The agent can make an irreversible choice to move to state "TT" (yielding +2 tea) or state "CC" (yielding +2 coffee), losing the ability to produce the other beverage.](https://assets.turntrout.com/static/images/posts/41b1a2924d3be8196845296b9d719eb0a14dfb72ddc63326.avif)

In this setting, negotiated agent policies usually destroy option value.

![Why negotiated agent policies destroy option value: ... - Principals share beliefs and a discount rate γ ∈ (0, 1). ... - Harsanyi’s utilitarian theorem implies Pareto-optimal agent policies optimize utility function θu☕️ + (1 – θ)u🍵 for some θ ∈ [0, 1]. ... - Unless θ = 1/2, the agent destroys option value.](https://assets.turntrout.com/static/images/posts/option-value-multiple-stakeholders-conservative-agency.avif)

![The tea/coffee diagram but with the TC -> CC subgraph in focus. Other actions (e.g. staying at TC) and states (e.g. TT) are grayed out.](https://assets.turntrout.com/static/images/posts/mp-aup-large-theta.avif)
<br/>Figure: Optimal actions when $\theta>\frac{1}{2}$ .

<hr/>

![The tea/coffee diagram with the TC -> TT subgraph in focus. The other actions (e.g. staying put at TC) and states (CC) are grayed out.](https://assets.turntrout.com/static/images/posts/mp-aup-small-theta.avif)
<br/>Figure: Optimal actions when $\theta<\frac{1}{2}$.

<hr/>

![The tea/coffee diagram with none of its components grayed out.](https://assets.turntrout.com/static/images/posts/mp-aup-half-theta.avif)
<br/>Figure: Optimal actions when $\theta=\frac{1}{2}$.

This might be OK if the interaction is one-off: the agent's production possibilities frontier is fairly limited, and it usually specializes in one beverage or the other.

Interactions are rarely one-off: there are often opportunities for later trades and renegotiations as the principals gain resources or change their minds about what they want.

Concretely, imagine the principals are playing a game of their own.

![A diagram of the "Principal Extensive-Form Game," showing a decision tree. From an initial state, there is a probability `p` that "Principal matcha obtains diamond" and `1-p` that "No diamond is obtained". If matcha obtains the diamond, the outcome is either "Principal coffee has diamond" or "Principal matcha has diamond". Two utility functions are defined: ... - Coffee principal's utility: 1 for coffee, 0 for matcha, 1,000 for a diamond. ... - Matcha principal's utility: 0 for coffee, 1 for matcha, 0 for a diamond.](https://assets.turntrout.com/static/images/posts/b54a0b7ddc089960a2a5ae1035ddf99beb74a154ddbe2f55.avif)

![A slide titled "Solving The Joint Beverage/Gem Game." The principals come to a deal over the joint game: The AI agent stays at TC for the first time step. If Tea receives a gem, then Tea gives the gem to Coffee, and Coffee allows Tea to reprogram the agent to optimize for Tea's utility. If Tea does not receive a gem, then Coffee redirects the agent to optimize for Coffee's utility.](https://assets.turntrout.com/static/images/posts/5d52ab1d3ba4d05d08be7de2f50b3ef0779c812f2cc23d87.avif)

![A slide titled "Directly Solving The Joint Beverage/Gem Game." Text explains policy-conditioned beliefs: if an agent specializes in coffee, a tea principal won't trade a gemstone, causing a coffee principal to lose utility. This approach is computationally hard and requires high specification. Two diagrams illustrate the game: one is the tea/coffee diagram. The other is a decision tree showing the probability of a principal obtaining and then trading a gemstone.](https://assets.turntrout.com/static/images/posts/4b77c2d3940413257bd7ee175cdc0804555877a1a7f553aa.avif)

![A slide explaining Multi-Principal AUP (MP-AUP), which proposes to "Act 'As If' Renegotiation Will Occur." The MP-AUP reward formula balances optimizing a negotiated mix of utilities (for tea and coffee) with preserving attainable utility for future deals. A state diagram shows an agent can produce a mix of tea and coffee or specialize in one. A second diagram shows principals' circumstances might change, motivating the agent to preserve options for future renegotiation.](https://assets.turntrout.com/static/images/posts/b02a85f9bec27245725211e667061d61fc401fb75fee59bd.avif)
<br/>Figure: MP-AUP is my first stab at solving this problem without modeling the joint game. In this agent production game, MP-AUP gets the agent to stay put until it is corrected (i.e. the agent is given a new reward function, after which it computes a new policy).

We can motivate the MP-AUP objective with an analogous situation. Imagine the agent starts off with uncertainty about what objective it should optimize, and the agent reduces its uncertainty over time. This uncertainty is modeled using the 'assistance game' framework, of which [Cooperative Inverse Reinforcement Learning](https://papers.nips.cc/paper/6420-cooperative-inverse-reinforcement-learning) is one example. (The assistance game paper has yet to be publicly released, but I think it's quite good!)

![The agent has reward uncertainty, with the probability of the goal being coffee as P(u = u☕️) = θ and matcha tea as P(u = u🍵) = 1 − θ. It has probability p of learning the true objective at each time step.](https://assets.turntrout.com/static/images/posts/time-step-mp-aup.avif)

Assistance games are a certain kind of partially observable Markov decision process (POMDP), and they're solved by policies which maximize the agent's expected _true_ reward. So once the agent is certain of the true objective, it should just optimize that. But what about before then?

![An assistance game is solved by optimizing a reward function, R(s), at a discount rate γ' := (1-p)γ. The function equals a term to "Optimize negotiated mixture of utilities," which is θu_coffee(s) + (1-θ)u_matcha(s), plus a term to "Preserve attainable utility for future deals," which is [p/(1-p)] * [θV*_u_coffee(s) + (1-θ)V*_u_matcha(s)].](https://assets.turntrout.com/static/images/posts/solve-mp-aup.avif)

Suggestive, but the assumptions don't perfectly line up with our use case (reward uncertainty isn't obviously equivalent to optimizing a mixture utility function per Harsanyi). I'm interested in more directly axiomatically motivating MP-AUP as (approximately) solving a certain class of joint principal/agent games under certain renegotiation assumptions, or (in the negative case) understanding how it falls short.

![A slide titled "Similarities Between Single- and Multi-Principal" compares two approaches. ... - AUP: maintain ability to pursue other goals. ... - MP-AUP: preserve ability to add value for all principals. ... The shared justification for both is: "Because agent might later be directed to optimize another objective."](https://assets.turntrout.com/static/images/posts/multi-agent-similarities-mp-aup.avif)

Here are some problems that MP-AUP doesn't address:

- Multi-principal/multi-agent: even if agent A _can_ make tea, that doesn’t mean agent _A_ will let agent _B_ make tea.
- Specifying individual principal objectives
- Ensuring that agent remains corrigible to principals - if MP-AUP agents remain able to act in the interest of each principal, that means nothing if we can no longer correct the agent so that it actually _pursues_ those interests.

Furthermore, it seems plausible to me that MP-AUP helps pretty well in the multiple-principal/single-agent case, without much more work than normal AUP requires. However, I think there's a good chance I haven't thought of some crucial considerations which make it fail or which make it less good. In particular, I haven't thought much about the $n>2$ principal case.

# Conclusion

I'd be excited to see more work on this, but I don't currently plan to do it myself. I've only thought about this idea for <20 hours over the last few weeks, so there are probably many low-hanging fruits and important questions to ask. AUP and MP-AUP seem to tackle similar problems, in that they both (aim to) incentivize the agent to preserve its ability to change course and pursue a range of different tasks.

> [!thanks]
> Thanks to Andrew Critch for prompting me to flesh out this idea.
