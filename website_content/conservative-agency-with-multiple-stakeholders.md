---
permalink: conservative-agency-with-multiple-stakeholders
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/gLfHp8XaWpfsmXyWZ/conservative-agency-with-multiple-stakeholders
lw-is-question: 'false'
lw-posted-at: 2021-06-08T00:30:52.672000Z
lw-last-modification: 2021-06-08T18:17:16.607000Z
lw-curation-date: None
lw-frontpage-date: 2021-06-08T03:37:44.144000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 0
lw-base-score: 31
lw-vote-count: 9
af-base-score: 18
af-num-comments-on-upload: 0
publish: true
title: Conservative Agency with Multiple Stakeholders
lw-latest-edit: 2021-06-08T01:34:42.979000Z
lw-is-linkpost: 'false'
tags:
  - AI
  - impact-regularization
aliases:
  - conservative-agency-with-multiple-stakeholders
lw-reward-post-warning: 'true'
use-full-width-images: 'true'
date_published: 2021-06-08 00:00:00
original_url: 
  https://www.lesswrong.com/posts/gLfHp8XaWpfsmXyWZ/conservative-agency-with-multiple-stakeholders
skip_import: true
card_image: 
  https://assets.turntrout.com/static/images/card_images/5d8db03fe692d0a310f42ec0c249a6b2be892ea6e84ec762.png
description: How to make AI agents avoid negative side effects, especially in multi-stakeholder
  environments.
date_updated: 2025-04-12 09:51:51.137842
---









> [!note]
> Here are the slides for a talk I just gave at CHAI's 2021 workshop.

The first part of my talk summarized my existing results on avoiding negative side effects by making the agent "act conservatively." The second part shows how this helps facilitate iterated negotiation and increase gains from trade in the multi-stakeholder setting.

# Existing work on side effects

![](https://assets.turntrout.com/static/images/posts/5d8db03fe692d0a310f42ec0c249a6b2be892ea6e84ec762.avif)
<br/>Figure: Agents only care about the parts of the environment relevant to their specified reward function.

![](https://assets.turntrout.com/static/images/posts/11973d84ffe3b4c8b56ebfe90261e336e126ad93cdda39a5.avif)
<br/>Figure: We _somehow_ want an agent which is "conservative" and "doesn't make much of a mess."

![](https://assets.turntrout.com/static/images/posts/19247989a8c519fbc27fc9d100129444d4ca2f86968a9a8b.avif)
<br/>Figure: AUP penalizes the agent for changing its ability to achieve a wide range of goals. Even though we can't specify our "true objective" to the agent, we hope that the agent stays able to do the right thing, as a result of staying able to do many things.

![](https://assets.turntrout.com/static/images/posts/27b61d7c2b20d763836e0f4205fc5cb0b043d8c999d9513b.avif)
<br/>Figure: We first demonstrated that AUP avoids side effects in tiny tabular domains.

![](https://assets.turntrout.com/static/images/posts/2b563e34fa6fa1f80fcf5992515e3911668f03e0297e547b.avif)
<br/>Figure: Conway's _Game of Life_ has simple, local dynamics which add up to complex long-term consequences.

![](https://assets.turntrout.com/static/images/posts/bc36232e143377cc3fb23ec0eaf31d162c17fa41698f8356.avif)
<br/>Figure: _SafeLife_ turns the _Game of Life_ into an actual game, adding an agent and many unique cell types. Crucially, there are fragile green cell patterns which most policies plow through and irreversibly shatter. We want the low-impact agent to avoid them whenever possible, _without_ telling it what in particular it shouldn't do. We want the agent to avoid disrupting green cell patterns, without telling it directly to not disrupt green cell patterns. AUP pulls this off.

![](https://assets.turntrout.com/static/images/posts/ec7027afd67e6d8d0d76cdf6f6f0ce4f1ca66561460c376e.avif)
<br/>Figure: We learn the AUP policy in 3 steps. Step one: the agent learns to encode its observations (the game screen) with just one real number. This lets us learn an auxiliary environmental goal unsupervised.

![](https://assets.turntrout.com/static/images/posts/8e06d19568bf8cf2aa3f1ae7cb68237f739e7e8526d16e69.avif)
<br/>Figure: Step two: we train the agent to optimize this encoder-reward function "goal"; in particular, the network learns to predict the values of different actions.

![](https://assets.turntrout.com/static/images/posts/ceedff3b01f8e4dd70c483030f9855e623643aa85c40b226.avif)
<br/>Figure: Step three: we're done! We have the AUP reward function.

Summary of results: [AUP does well.](https://avoiding-side-effects.github.io/)

I expect AUP to further scale to high-dimensional embodied tasks. For example, avoiding making a mess on e.g. the factory floor. That said, I expect that physically distant side effects will be harder for AUP to detect. In those situations, it's less likely that distant effects show up in the agent's value functions for its auxiliary goals in the penalty terms.

# Fostering repeated negotiation over time

I think of AUP as addressing the single-principal (AI designer) / single-agent (AI agent) case. What about the multi/single case?

![](https://assets.turntrout.com/static/images/posts/41b1a2924d3be8196845296b9d719eb0a14dfb72ddc63326.avif)

In this setting, negotiated agent policies usually destroy option value.

![](https://assets.turntrout.com/static/images/posts/option-value-multiple-stakeholders-conservative-agency.avif)

![](https://assets.turntrout.com/static/images/posts/mp-aup-large-theta.avif)
<br/>Figure: Optimal actions when $\theta>\frac{1}{2}$ .

<hr/>

![](https://assets.turntrout.com/static/images/posts/mp-aup-small-theta.avif)
<br/>Figure: Optimal actions when $\theta<\frac{1}{2}$.

<hr/>

![](https://assets.turntrout.com/static/images/posts/mp-aup-half-theta.avif)
<br/>Figure: Optimal actions when $\theta=\frac{1}{2}$.

This might be OK if the interaction is one-off: the agent's production possibilities frontier is fairly limited, and it usually specializes in one beverage or the other.

Interactions are rarely one-off: there are often opportunities for later trades and renegotiations as the principals gain resources or change their minds about what they want.

Concretely, imagine the principals are playing a game of their own.

![](https://assets.turntrout.com/static/images/posts/b54a0b7ddc089960a2a5ae1035ddf99beb74a154ddbe2f55.avif)

![](https://assets.turntrout.com/static/images/posts/5d52ab1d3ba4d05d08be7de2f50b3ef0779c812f2cc23d87.avif)

![](https://assets.turntrout.com/static/images/posts/4b77c2d3940413257bd7ee175cdc0804555877a1a7f553aa.avif)

![](https://assets.turntrout.com/static/images/posts/b02a85f9bec27245725211e667061d61fc401fb75fee59bd.avif)
<br/>Figure: MP-AUP is my first stab at solving this problem without modeling the joint game. In this agent production game, MP-AUP gets the agent to stay put until it is corrected (i.e. the agent is given a new reward function, after which it computes a new policy).

We can motivate the MP-AUP objective with an analogous situation. Imagine the agent starts off with uncertainty about what objective it should optimize, and the agent reduces its uncertainty over time. This uncertainty is modeled using the 'assistance game' framework, of which [Cooperative Inverse Reinforcement Learning](https://papers.nips.cc/paper/6420-cooperative-inverse-reinforcement-learning) is one example. (The assistance game paper has yet to be publicly released, but I think it's quite good!)

![](https://assets.turntrout.com/static/images/posts/time-step-mp-aup.avif)

Assistance games are a certain kind of partially observable Markov decision process (POMDP), and they're solved by policies which maximize the agent's expected _true_ reward. So once the agent is certain of the true objective, it should just optimize that. But what about before then?

![](https://assets.turntrout.com/static/images/posts/solve-mp-aup.avif)

Suggestive, but the assumptions don't perfectly line up with our use case (reward uncertainty isn't obviously equivalent to optimizing a mixture utility function per Harsanyi). I'm interested in more directly axiomatically motivating MP-AUP as (approximately) solving a certain class of joint principal/agent games under certain renegotiation assumptions, or (in the negative case) understanding how it falls short.

![](https://assets.turntrout.com/static/images/posts/multi-agent-similarities-mp-aup.avif)

Here are some problems that MP-AUP doesn't address:

- Multi-principal/multi-agent: even if agent A _can_ make tea, that doesn’t mean agent _A_ will let agent _B_ make tea.
- Specifying individual principal objectives
- Ensuring that agent remains corrigible to principals - if MP-AUP agents remain able to act in the interest of each principal, that means nothing if we can no longer correct the agent so that it actually _pursues_ those interests.

Furthermore, it seems plausible to me that MP-AUP helps pretty well in the multiple-principal/single-agent case, without much more work than normal AUP requires. However, I think there's a good chance I haven't thought of some crucial considerations which make it fail or which make it less good. In particular, I haven't thought much about the $n>2$ principal case.

# Conclusion

I'd be excited to see more work on this, but I don't currently plan to do it myself. I've only thought about this idea for <20 hours over the last few weeks, so there are probably many low-hanging fruits and important questions to ask. AUP and MP-AUP seem to tackle similar problems, in that they both (aim to) incentivize the agent to preserve its ability to change course and pursue a range of different tasks.

> [!thanks]
> Thanks to Andrew Critch for prompting me to flesh out this idea.
