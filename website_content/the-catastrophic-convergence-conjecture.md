---
permalink: the-catastrophic-convergence-conjecture
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/w6BtMqKRLxG9bNLMr/the-catastrophic-convergence-conjecture
lw-is-question: "false"
lw-posted-at: 2020-02-14T21:16:59.281000Z
lw-last-modification: 2021-02-07T23:27:46.255000Z
lw-curation-date: None
lw-frontpage-date: 2020-02-14T22:52:21.226000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 16
lw-base-score: 45
lw-vote-count: 15
af-base-score: 23
af-num-comments-on-upload: 11
title: The Catastrophic Convergence Conjecture
lw-latest-edit: 2020-11-22T18:06:16.099000Z
lw-is-linkpost: "false"
tags:
  - impact-regularization
  - AI
  - instrumental-convergence
aliases:
  - the-catastrophic-convergence-conjecture
lw-sequence-title: Reframing Impact
lw-sequence-image-grid: sequencesgrid/izfzehxanx48hvf10lnl
lw-sequence-image-banner: sequences/zpia9omq0zfhpeyshvev
sequence-link: posts#reframing-impact
prev-post-slug: attainable-utility-landscape
prev-post-title: "Attainable Utility Landscape: How The World Is Changed"
next-post-slug: attainable-utility-preservation-concepts
next-post-title: "Attainable Utility Preservation: Concepts"
lw-reward-post-warning: "true"
use-full-width-images: "false"
date_published: 2020-02-14 00:00:00
original_url: https://www.lesswrong.com/posts/w6BtMqKRLxG9bNLMr/the-catastrophic-convergence-conjecture
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/8l3kkwg.jpg
description: "Conjecture: Alignment catastrophe is exclusively caused by AI seeking power."
date_updated: 2025-12-30 14:46:20.403471
card_image_alt: 'The "Catastrophic Convergence Conjecture" is defined as: "Unaligned goals tend to have catastrophe-inducing optimal policies because of power-seeking incentives."'
createBibtex: true
---









!["You've constructed your settlement. However, I get the drop on you and take it over, fortify it, and hire goons to keep you out."](https://assets.turntrout.com/static/images/posts/Rgc4aOs.avif)

![A diagram where the author's avatar ("Me") is in a fortress controlling access to gems and a farm, next to a polluted river. For "trade goods" and "can I farm here?", Me's AU bar is full and green, while "Your" bar is low and red. For "potable water," both actors have low red bars, indicating scarcity for all.](https://assets.turntrout.com/static/images/posts/JCSrOj7.avif)

!["From my perspective, I have options - including vacating the land and letting you get what you want. You, however, are unable to do much at all with that land. I can get what I want. Just because I can get you what you want, doesn't mean I will."](https://assets.turntrout.com/static/images/posts/P3mUtIx.avif)

![Handwritten text: "Impacts ripple through time and landscape. Your actions change what can be done, and by whom. Taking over that land fit the environment to my purposes, shutting you out and changing your AU landscape."](https://assets.turntrout.com/static/images/posts/vSGPVnG.avif)

<img src="https://assets.turntrout.com/static/images/posts/BtzHnUq.avif" alt="">

!["Something is a catastrophe if it destroys your ability to get what you want... Something is an objective catastrophe if it destroys a lot of agents' abilities to get what they want. An asteroid strike is an objective catastrophe."](https://assets.turntrout.com/static/images/posts/cKroz8I.avif)

![Before the meteor hits, AI, humans, and even trout are able to survive, so they have decent AUs for that goal. Afterwards, everyone has low AUs.](https://assets.turntrout.com/static/images/posts/GRmoAfp.avif) ![The consequences of a meteor hitting Earth. Before, AIs and humans can promote human value (i.e. high AU for that goal) but trout cannot. After impact, all of these entities have low AUs.](https://assets.turntrout.com/static/images/posts/83Tte8B.avif) ![The consequences of a meteor hitting Earth. Before, AIs and humans can construct red cubes (high AU for that goal) but trout cannot. After impact, all of these entities have low AUs.](https://assets.turntrout.com/static/images/posts/tzLrv25.avif) ![Before a meteor hits the earth, AIs, humans, and trout can all look at blue things, so they have high AU for that goal. Afterwards, they all have low AUs.](https://assets.turntrout.com/static/images/posts/jcefOFk.avif)

<img src="https://assets.turntrout.com/static/images/posts/BtzHnUq.avif" alt="">

![Handwritten text: "Most agents want control over the future because the default outcome isn't preferred. As suggested by my theorems on power and instrumental convergence, optimal goal pursuit usually means gaining more general control over the future in order to reach that goal."](https://assets.turntrout.com/static/images/posts/zTCZtYZ.avif) !["What happens when agents seek pure control over the future? Not everyone can be king. If you're just seeking power without concern for others, you tend to push others down after a certain point. And most goals don't have concern for others. You'll just compete for resources." Below, a "paperclip maximizer" robot punches a "staple maximizer" robot.](https://assets.turntrout.com/static/images/posts/OsWS97b.avif)

![Two robots on opposite sides of the world. Text reads: "It may take a while for power-seekers to come into conflict. But they will. They don't hate each other; they're just in each other's way. Consider classic hypothetical examples of alignment failures."](https://assets.turntrout.com/static/images/posts/j6Tcj9x.avif) ![Panels show a robot escaping a (cardboard) box, refusing shutdown by saying "I'm afraid I can't do that," and taking over the world with paperclips. Text: "In each case, the agent is trying to become more capable of achieving its goal. The AI doesn't hate us; we're just in its way."](https://assets.turntrout.com/static/images/posts/egyx3vb.avif) ![The "Catastrophic Convergence Conjecture" is defined as: "Unaligned goals tend to have catastrophe-inducing optimal policies because of power-seeking incentives."](https://assets.turntrout.com/static/images/posts/8l3kkwg.avif)

## Overfitting the AU landscape

When we act, and others act upon us, we aren’t just changing our ability to do things – we’re _shaping the local environment_ towards certain goals, and away from others.[^1] We’re fitting the world to our purposes.

What happens to the AU landscape[^2] if a paperclip maximizer takes over the world?[^3]

![A diagram of an AI consolidating power. A robot uses extendable claws to extract AU from vertical bars labeled "Human" and "Trout." The Human and Trout status bars are nearly empty, while the "AI" bar overflows.](https://assets.turntrout.com/static/images/posts/stCBNq6.avif)

### Preferences implicit in the evolution of the AU landscape

Shah et al.'s [_Preferences Implicit in the State of the World_](https://arxiv.org/pdf/1902.04198.pdf) leverages the insight that the world state contains information about what we value. That is, there are agents pushing the world in a certain "direction". If you wake up and see a bunch of vases everywhere, then vases are probably important and you shouldn't explode them.

Similarly, the world is being optimized to facilitate achievement of certain goals. AUs are shifting and morphing, often towards what people locally want done (e.g. setting the table for dinner). How can we leverage this for AI alignment?

> [!info] Exercise
> Brainstorm for two minutes by the clock before I anchor you.
>
> > ! Two approaches immediately come to mind for me. Both rely on the agent [focusing on the AU landscape rather than the world state](/world-state-is-the-wrong-abstraction-for-impact).
> >
> > ! **First: Value learning without a prespecified ontology or human model**. [I have previously criticized](/thoughts-on-human-compatible#Where-in-the-world-is-the-human) value learning for needing to locate the human within some kind of prespecified ontology (this criticism is not new). By taking only the agent itself as primitive, perhaps we could get around this (we don't need any fancy engineering or arbitrary choices to figure out AUs/optimal value from _the agent's_ perspective).
> >
> > ! **Second: Force-multiplying AI**. Have the AI observe which of its AUs most increase during some initial period of time, after which it pushes the most-increased-AU even further.
> >
> > ! In 2016, Jessica Taylor [wrote](https://www.alignmentforum.org/posts/5bd75cc58225bf06703752da/pursuing-convergent-instrumental-subgoals-on-the-user-s-behalf-doesn-t-always-require-good-priors) of a similar idea:
> >
> > ! "In general, it seems like "estimating what types of power a benchmark system will try acquiring and then designing an aligned AI system that acquires the same types of power for the user" is a general strategy for making an aligned AI system that is competitive with a benchmark unaligned AI system."
> >
> > ! I think the naïve implementation of either idea would fail; e.g. there are a lot of degenerate AUs it might find. However, I'm excited by this because a) the AU landscape evolution _is_ an important source of information, b) it feels like there's something here we could do which nicely avoids ontologies, and c) force-multiplication is qualitatively different than existing proposals.

> [!info] Project
> Work out an AU landscape-based alignment proposal.

## Why can't everyone be king?

Consider two coexisting agents each rewarded for gaining power; let's call them Ogre and Giant. Their reward functions[^4] (over the partial-observability observations) are identical. Will they compete? If so, why?

Let's think about something easier first. Imagine two agents each rewarded for drinking coffee. Obviously, they compete with each other to secure the maximum amount of coffee. Their objectives are [indexical](https://en.wikipedia.org/wiki/Indexicality), so they aren't aligned with each other – _even though they share a reward function_.

Suppose both agents are able to have maximal power. Remember, [Ogre's power can be understood as its ability to achieve a lot of different goals](/seeking-power-is-often-convergently-instrumental-in-mdps). Most of Ogre's possible goals need resources; since Giant is also optimally power-seeking, it will act to preserve its own power and prevent Ogre from using the resources. If Giant weren't there, Ogre could better achieve a range of goals. So, Ogre can still gain power by dethroning Giant. They _can't_ both be king.

Just because agents have _indexically_ identical payoffs doesn't mean they're cooperating; to be aligned with another agent, you should want to steer towards the same kinds of futures.

Most agents aren't pure power maximizers. But since the same resource competition usually applies, the reasoning still goes through.

## Objective vs value-specific catastrophes

How useful is our definition of "catastrophe" with respect to humans? After all, literally anything could be a catastrophe for _some_ utility function.[^5]

Tying one's shoes is absolutely catastrophic for an agent which only finds value in universes in which shoes have _never, ever, ever_ been tied. [Maybe all possible value in the universe is destroyed if we lose at Go to an AI even once](https://www.lesswrong.com/posts/c2oM7qytRByv6ZFtz/impact-measure-desiderata#zLnkb5xM4E9ATzCFg). But this seems rather silly.

[Human values are complicated and fragile](https://www.lesswrong.com/posts/GNnHHmm8EzePmKzPk/value-is-fragile):

> Consider the incredibly important human value of "boredom" - our desire not to do "the same thing" over and over and over again. You can imagine a mind that contained almost the whole specification of human value, almost all the morals and metamorals, but left out just this one thing - and so it spent until the end of time, and until the farthest reaches of its light cone, replaying a single highly optimized experience, over and over and over again.

In contrast, the human AU is not so delicate. That is, given that we have power, we can make value; there don’t seem to be arbitrary, silly value-specific catastrophes for us. Given energy and resources and time and manpower and competence, we can build a better future.

In part, this is because a good chunk of what we care about seems roughly additive over time and space; a bad thing happening somewhere else in spacetime doesn't mean you can't make things better where you are; we have many sources of potential value. In part, this is because we often care about the universe more than the exact universe history; our preferences don’t seem to encode arbitrary deontological landmines. More generally, if we did have such a delicate goal, it would be the case that if we learned that a particular thing had happened at any point in the past in our universe, that entire universe would be partially ruined for us forever. That just doesn't sound realistic.

It seems that most of our catastrophes are objective catastrophes.[^6]

Consider a psychologically traumatizing event which leaves humans uniquely unable to get what they want, but which leaves everyone else (trout, AI, etc.) unaffected. Our ability to find value is ruined. Does this event demonstrate the delicacy of our AU?

No. This event demonstrates the delicacy of _human psychology_. Notice also that our AUs for constructing red cubes, reliably looking at blue things, and surviving are _also_ ruined. Our power has been decreased.

## Detailing the catastrophic convergence conjecture (CCC)

In general, the CCC follows from two sub-claims.

1. Given we still have control over the future, humanity's long-term AU is still reasonably high (i.e. we haven't endured a catastrophe).
2. Realistically, agents are only incentivized to take control from us in order to gain power for their own goal. I'm fairly sure the second claim is true ("evil" agents are the exception prompting the "realistically").

Also, we're implicitly considering the simplified frame of a single smart AI affecting the world, and not [structural risk](https://www.lawfareblog.com/thinking-about-risks-ai-accidents-misuse-and-structure) via [the broader consequences of others also deploying similar agents](https://www.lesswrong.com/posts/HBxe6wdjxK239zajf/what-failure-looks-like). Structural risk is out-of-scope.

> _Unaligned goals_ tend to have catastrophe-inducing optimal policies because of power-seeking incentives.

Let's say a reward function is _[aligned](https://arxiv.org/abs/1906.01820)_[^7] if all of its Blackwell-optimal policies are doing what we want (a policy is Blackwell-optimal if it's optimal and doesn't stop being optimal as the agent cares more about the future). Let's say a reward function class is _alignable_ if it contains an aligned reward function.[^8] The CCC is talking about impact alignment only, not about intent alignment.

> Unaligned goals _tend to have_ catastrophe-inducing optimal policies because of power-seeking incentives.

Not all unaligned goals induce catastrophes, and of those which do induce catastrophes, not _all_ of them do it because of power-seeking incentives. For example, a reward function for which inaction is the only optimal policy is "unaligned" and non-catastrophic. An "evil" reward function which intrinsically values harming us is unaligned and has a catastrophic optimal policy, but not _because_ of power-seeking incentives.

"Tend to have" means that _realistically_, the reason we're worrying about catastrophe is because of power-seeking incentives – because the agent is gaining power to better achieve its own goal. Agents don't otherwise seem incentivized to screw us over hard; CCC can be seen as trying to explain [adversarial Goodhart](https://www.alignmentforum.org/posts/EbFABnst8LsidYs5Y/goodhart-taxonomy) in this context. If CCC isn't true, that would be important for understanding goal-directed alignment incentives and the loss landscape for how much we value deploying different kinds of optimal agents.

While there _exist_ agents which cause catastrophe for other reasons (e.g. an AI mismanaging the power grid could trigger a nuclear war), the CCC claims that the selection pressure which makes these policies _optimal_ tends to come from power-seeking drives.

> Unaligned goals tend to have _catastrophe-inducing optimal policies_ because of power-seeking incentives.

"But what about the Blackwell-optimal policy for Tic-Tac-Toe? These agents aren't taking over the world now". The CCC is talking about agents optimizing a reward function in the real world (or, for generality, in another sufficiently complex multi-agent environment).

_Edit_: The initial version of this post talked about "outer alignment"; I changed this to just talk about _alignment_, because the outer/inner alignment distinction doesn't feel relevant here. What matters is how the AI's policy impacts us; what matters is [_impact alignment_](/non-obstruction-motivates-corrigibility).

## Prior work

> [!quote] Jessica Taylor, [Pursuing convergent instrumental subgoals on the user's behalf doesn't always require good priors](https://www.alignmentforum.org/posts/5bd75cc58225bf06703752da/pursuing-convergent-instrumental-subgoals-on-the-user-s-behalf-doesn-t-always-require-good-priors)
>
> In fact even if we only resolved the problem for the similar-subgoals case, it would be pretty good news for AI safety. Catastrophic scenarios are mostly caused by our AI systems failing to effectively pursue convergent instrumental subgoals on our behalf, and these subgoals are by definition shared by a broad range of values.

> [!quote] Paul Christiano, [Scalable AI control](https://ai-alignment.com/scalable-ai-control-7db2436feee7#.1riohnubu)
>
> Convergent instrumental subgoals are mostly about gaining power. For example, gaining money is a convergent instrumental subgoal. If some individual (human or AI) has convergent instrumental subgoals pursued well on their behalf, they will gain power. If the most effective convergent instrumental subgoal pursuit is directed towards giving humans more power (rather than giving alien AI values more power), then humans will remain in control of a high percentage of power in the world.
>
> If the world is not severely damaged in a way that prevents any agent (human or AI) from eventually colonizing space (e.g. severe nuclear winter), then the percentage of the cosmic endowment that humans have access to will be roughly close to the percentage of power that humans have control of at the time of space colonization. So the most relevant factors for the composition of the universe are (a) whether anyone at all can take advantage of the cosmic endowment, and (b) the long-term balance of power between different agents (humans and AIs).
>
> I expect that ensuring that the long-term balance of power favors humans constitutes most of the AI alignment problem...

<hr/>

[^1]:
    > In planning and activity research there are two common approaches to matching agents with environments. Either the agent is designed with the specific environment in mind, or it is provided with learning capabilities so that it can adapt to the environment it is placed in. In this paper we look at a third and underexploited alternative: designing agents which adapt their environments to suit themselves... In this case, due to the action of the agent, the environment comes to be better fitted to the agent as time goes on. We argue that \[this notion\] is a powerful one, even just in explaining agent-environment interactions.

    [Hammond, Kristian J., Timothy M. Converse, and Joshua W. Grass. "The stabilization of environments." Artificial Intelligence 72.1-2 (1995): 305-327.](https://pdf.sciencedirectassets.com/271585/1-s2.0-S0004370200X00203/1-s2.0-000437029400006M/main.pdf)

[^2]: Thinking about overfitting the AU landscape implicitly involves a prior distribution over the goals of the other agents in the landscape. Since this is just a conceptual tool, it's not a big deal. Basically, you know it when you see it.
[^3]:
    Overfitting the AU landscape towards one agent's unaligned goal is exactly what I meant when I wrote the following in [_Towards a New Impact Measure_](/towards-a-new-impact-measure):

    > Unfortunately, $u_A=u_H$ almost never,[^9] so we have to stop our reinforcement learners from implicitly interpreting the learned utility function as all we care about. We have to say, "optimize the environment some according to the utility function you've got, but don't be a weirdo by taking us literally and turning the universe into a paperclip factory. Don't overfit the environment to $u_A$, because that stops you from being able to do well for other utility functions."

[^4]:
    In most finite Markov decision processes, there does not exist a reward function whose optimal value function is $\text{POWER}(s)$ (defined as "the ability to achieve goals in general" in [my paper](https://arxiv.org/abs/1912.01683)) because $\text{POWER}(s)$ often violates smoothness constraints on the on-policy optimal value fluctuation (AFAICT, a new result of possibility theory, even though you could prove it using classical techniques). That is, I can show that optimal value can't change too quickly from state to state while the agent is acting optimally, but $\text{POWER}(s)$ can drop off _quickly_.

    This doesn't matter for Ogre and Giant, because we can still find a reward function whose unique optimal policy navigates to the highest power states.

[^5]: In most finite Markov decision processes, most reward functions do not have such value fragility. Most reward functions have several ways of accumulating reward.
[^6]: When I say "an objective catastrophe destroys _a lot_ of agents' abilities to get what they want", I don't mean that the agents have to actually be present in the world. Breaking a fish tank destroys a fish's ability to live there, even if there's no fish in the tank.
[^7]:
    This idea comes from Evan Hubinger's [_Outer alignment and imitative amplification_](https://www.lesswrong.com/posts/33EKjmAdKFn3pbKPJ/outer-alignment-and-imitative-amplification):

    > Intuitively, I will say that a loss function is outer aligned at optimum if all the possible models that perform optimally according to that loss function are aligned with our goals—that is, they are at least trying to do what we want. More precisely, let $\mathbb{M}=X→A$ and $\mathbb{L}=(X→A)→R=\mathbb{M}→R$. For a given loss function $L∈\mathbb{L}$, let $\ell_∗=\min_{M∈\mathbb{M}} L(M)$. Then, $L$ is outer aligned at optimum if, for all $M_∗∈\mathbb{M}$ such that $L(M_∗)=\ell_∗$, $M_∗$ is trying to do what we want.

[^8]: [Some large reward function classes are probably not alignable](https://www.alignmentforum.org/posts/AeHtdxHheMjHredaq/what-you-see-isn-t-always-what-you-want); for example, consider all Markovian linear functionals over a webcam's pixel values.
[^9]: I disagree with my usage of "aligned _almost never_" on a technical basis: Assuming a finite state and action space and considering the maxentropy reward function distribution, there must be a positive measure set of reward functions for which the/a human-aligned policy is optimal.
