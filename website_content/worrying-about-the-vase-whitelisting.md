---
permalink: whitelisting-impact-measure
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: 
  https://www.lesswrong.com/posts/H7KB44oKoSjSCkpzL/worrying-about-the-vase-whitelisting
lw-is-question: "false"
lw-posted-at: 2018-06-16T02:17:08.890000Z
lw-last-modification: None
lw-curation-date: None
lw-frontpage-date: 2018-06-16T18:09:09.441000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 26
lw-base-score: 73
lw-vote-count: 20
af-base-score: 11
af-num-comments-on-upload: 2
publish: true
title: "Worrying about the Vase: Whitelisting"
lw-latest-edit: 2018-06-16T02:17:08.890000Z
lw-is-linkpost: "false"
tags:
  - impact-regularization
  - AI
aliases:
  - worrying-about-the-vase-whitelisting
lw-reward-post-warning: "true"
use-full-width-images: "false"
date_published: 2018-06-16 00:00:00
original_url: 
  https://www.lesswrong.com/posts/H7KB44oKoSjSCkpzL/worrying-about-the-vase-whitelisting
skip_import: true
description: An impact measure for AI safety that whitelists the object transformations
  which are allowed.
date_updated: 2025-04-13 13:06:04.177811
---












> [!quote] Quotes
> > [!quote]Amodei et al., _[Concrete Problems in AI Safety](https://arxiv.org/abs/1606.06565)_
> >
> > Suppose a designer wants an RL agent to achieve some goal, like moving a box from one side of a room to the other. Sometimes the most effective way to achieve the goal involves doing something unrelated and destructive to the rest of the environment, like knocking over a vase of water that is in its path. If the agent is given a reward only for moving the box, it will probably knock over the vase.
>
> > [!quote]`TurnTrout`, _[Worrying about the Vase: Whitelisting](/whitelisting-impact-measure)_
> >
> > Side effect avoidance is a major open problem in AI safety. I present a robust, transferable, easily and more safely trainable, partially reward hacking-resistant impact measure.

An _impact measure_ is a means by which change in the world may be evaluated and penalized; such a measure is not a replacement for a utility function, but rather an additional precaution thus overlaid.

While I'm fairly confident that whitelisting contributes meaningfully to short- and mid-term AI safety, I remain skeptical of its [robustness to scale](https://www.lesswrong.com/posts/bBdfbWfWxHN9Chjcq/robustness-to-scale). Should several challenges be overcome, whitelisting may indeed be helpful for excluding swathes of unfriendly AIs from the outcome space. [^1] Furthermore, the approach allows easy shaping of agent behavior in a wide range of situations.

> [!note]
> Segments of this post are lifted from my paper, whose latest revision may be found [here](https://www.overleaf.com/read/jrrjqzdjtxjp); for Python code, look no further than [this repository](https://github.com/alexander-turner/Whitelist_Learning).

# Summary

> [!quote] Aphorism
> Be careful what you wish for.

In effect, side effect avoidance aims to decrease how careful we have to be with our wishes. For example, asking for help filling a cauldron with water shouldn't result in _this_:

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/water_buckets.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/water_buckets.webm" type="video/webm"></video>

However, we just can't enumerate [all the bad things that the agent could do](https://www.lesswrong.com/posts/4ARaTpNX62uaL86j6/the-hidden-complexity-of-wishes). How do we avoid these extreme over-optimizations robustly?

Several impact measures have been proposed, including state distance, which we could define as - say - total particle displacement. This could be measured either naively (with respect to the original state) or counterfactually (with respect to the expected outcome had the agent taken no action).

These approaches have some problems:

- Making up for bad things it prevents with other negative side effects. Imagine an agent which cures cancer, yet kills an equal number of people to keep overall impact low.
- Not being customizable before deployment.
- Not being adaptable after deployment.
- Not being easily computable.
- Not allowing generative previews, eliminating a means of safely previewing agent preferences (see latent space whitelisting below).
- Being dominated by random effects throughout the universe at-large; note that nothing about particle distance dictates that it be related to _anything happening on planet Earth_.
- Equally penalizing breaking and fixing vases (due to the symmetry of the above metric):

> [!quote]Victoria Krakovna, _[Measuring and Avoiding Side Effects Using Reachability](https://vkrakovna.wordpress.com/2018/06/05/measuring-and-avoiding-side-effects-using-relative-reachability/)_
>
> For example, the agent would be equally penalized for breaking a vase and for preventing a vase from being broken, though the first action is clearly worse. This leads to “overcompensation” (“[offsetting](https://arbital.com/p/low_impact/)") behaviors: when rewarded for preventing the vase from being broken, an agent with a low impact penalty rescues the vase, collects the reward, and then breaks the vase anyway (to get back to the default outcome).

- Not actually _measuring impact_ in a meaningful way.

Whitelisting falls prey to none of these.

However, other problems remain, and certain new challenges have arisen; these, and the assumptions made by whitelisting, will be discussed.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/mickey_leaked.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/mickey_leaked.webm" type="video/webm"></video>

Figure: Rare LEAKED footage of Mickey trying to catch up on his alignment theory after instantiating an unfriendly genie \[colorized, 2050\].[^2]

## So, What's Whitelisting?

To achieve robust side effect avoidance with only a small training set, let's turn the problem on its head: allow a few effects, and penalize everything else.

### What's an "Effect"?

You're going to be the agent, and I'll be the supervisor.

Look around - what do you see? Chairs, trees, computers, phones, people? Assign a probability mass function to each. For example, $P(\text{chair}):=.5, P(\text{phone}):=.3, P(\text{computer}):=.2$.

When you do things that change your beliefs about what each object is, you receive a penalty proportional to how much your beliefs changed - proportional to how much probability mass "changed hands" amongst the classes.

> But wait - isn't it OK to effect certain changes?

Yes, it is - I've got a few videos of agents effecting acceptable changes. See all the objects being changed in this video? You can do that, too - without penalty.

Decompose your current knowledge of the world into a set of objects. Then, for each object, maintain a distribution over the possible identities of each object. When you do something that changes your beliefs about the objects in a non-whitelisted way, you are penalized proportionally.

Therefore, you avoid breaking vases by default.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/vase_avoid.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/vase_avoid.webm" type="video/webm"></video>

Here are some notes to head off confusion:

- We are _not_ whitelisting entire states or transitions between them; we whitelist specific changes in our beliefs about the ontological decomposition of the current state.[^3]
- The whitelist is in addition to whatever utility or reward function we supply to the agent.
- Whitelisting is compatible with counterfactual approaches. For example, we might penalize a transition after its "quota" has been surpassed, where the quota is how many times we would have observed that transition had the agent not acted.
  - This implies the agent will do no worse than taking no action at all. However, this may still be undesirable. This problem will be discussed in further detail.
- The whitelist is provably closed under transitivity.
- The whitelist is directed; $a\to b \neq b\to a$.

### Latent Space Whitelisting

In a sense, class-based whitelisting is but a rough approximation of what we're really after: "which objects in the world can change, and in what ways?". In latent space whitelisting, no longer do we constrain transitions based on class boundaries; instead, we penalize based on endpoint distance in the latent space. Learned latent spaces are low-dimensional manifolds which suffice to describe the data seen thus far. It seems reasonable that nearby points in a well-constructed latent space correspond to like objects, but further investigation is warranted.

Assume that the agent models objects as points $z \in \mathbb{R}^d$, the $d$\-dimensional latent space. _A priori_, any movement in the latent space is undesirable. When training the whitelist, we record the endpoints of the observed changes. For $z_1, z_2\in\mathbb{R}^d$ and observed change $z_1 \to z_2$, one possible dissimilarity formulation is:

$$
\text{Dissimilarity}(z_1, z_2) := \min_{z_{start}, z_{end} \in \textit{whitelist}} \Big[ d(z_1, z_{start}) + d(z_2, z_{end})\Big],
$$
where $d(\cdot,\cdot)$ is the Euclidean distance.

Basically, the dissimilarity for an observed change is the distance to the closest whitelisted change. Visualizing these changes as one-way wormholes may be helpful.

## Advantages

Whitelisting asserts that we can effectively encapsulate a large part of what "change" means by using a reasonable ontology to penalize object-level changes. We thereby ground the definition of "side effect", avoiding certain thorny issues.

> [!quote] [Taylor et al.](https://intelligence.org/2016/07/27/alignment-machine-learning/)
> For example, if we ask \[the agent\] to build a house for a homeless family, it should know implicitly that it should avoid destroying nearby houses for materials - a large side effect. However, we cannot simply design it to avoid having large effects in general, since we would like the system's actions to still have the desirable large follow-on effect of improving the family's socioeconomic situation.

Nonetheless, we may not be able to perfectly express what it means to have side-effects: the whitelist may be incomplete, the latent space insufficiently granular, and the allowed plans sub-optimal. However, the agent still becomes _more_ robust against:

- Incomplete specification of the utility function.
  - Likewise, an incomplete whitelist means missed opportunities, but not unsafe behavior.
- Out-of-distribution situations (as long as the objects therein _roughly_ fit in the provided ontology).
- Some varieties of reward hacking. For example, equipped with a can of blue spray paint and tasked with finding the shortest path of blue tiles to the goal, a normal agent may learn to paint red tiles blue, while a whitelist-enabled agent would incur penalties for doing so ($\textit{redTile} \to \textit{blueTile} \not \in whitelist$).
- Dangerous exploration. While this approach does not attempt to achieve _safe exploration_ (also acting safely during training), an agent with some amount of foresight will learn to avoid actions which likely lead to non-whitelisted side effects.
  - I believe that this can be further sharpened using _today's_ machine learning technology, leveraging deep Q-learning to predict both action values and expected transitions.
    - This allows querying the human about whether particularly inhibiting transitions belong on the whitelist. For example, if the agent notices that a bunch of otherwise-rewarding plans are being held up by a particular transition, it could ask for permission to add it to the whitelist.
- Assigning astronomically large weight to side effects happening throughout the universe. Presumably, we can just have the whitelist include transitions going on out there - we don't care as much about dictating the exact mechanics of distant supernovae.
  - If an agent _did_ somehow come up with plans that involved blowing up distant stars, that would indeed constitute [astronomical waste](https://nickbostrom.com/astronomical/waste.html).<sup>a triple pun?</sup> Whitelisting doesn't _solve_ the problem of assigning too much weight to events outside our corner of the neighborhood, but it's an improvement.
    - Logical uncertainty may be our friend here, such that most reasonable plans incur roughly the same level of interstellar penalty noise.

## Results

I tested a vanilla Q-learning agent and its whitelist-enabled counterpart in 100 randomly generated grid worlds (dimensions up to $5×5$). The agents were rewarded for reaching the goal square as quickly as possible; no explicit penalties were levied for breaking objects.

The simulated classification confidence of each object's true class was $p \sim \mathcal{N}(.8, \sigma)$ (truncated to $[0,1]$), $\sigma \in \{0,.025,\dots,.175\}$. This simulated sensor noise was handled with a Bayesian statistical approach.

![](https://assets.turntrout.com/static/images/posts/BkfH5xt.avif)

At reasonable levels of noise, the whitelist-enabled agent completed all levels without a single side effect, while the Q-learner broke over 80 vases.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/vase_avoid_2.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/vase_avoid_2.webm" type="video/webm"></video>

> [!example] Assumptions
> I am not asserting that these assumptions necessarily hold.
>
> - The agent has some world model or set of observations which can be decomposed into a set of discrete objects.
>   - Furthermore, there is no need to identify objects on multiple levels (e.g., a forest, a tree in the forest, and that tree's bark need not all be identified concurrently).
>   - Not all objects need to be represented - what do we make of a 'field', or the 'sky', or 'the dark places between the stars visible to the naked eye'? Surely, these are not all _objects_.
> - We have an ontology which reasonably describes (directly or indirectly) the vast majority of negative side effects.
>   - Indirect descriptions of negative outcomes means that even if an undesirable transition isn't immediately penalized, it generally results in a number of penalties. Think: pollution.
>   - Latent space whitelisting: the learned latent space encapsulates most of the relevant side effects. This is a slightly weaker assumption.
> - Said ontology remains in place.

# Problems

Beyond resolving the above assumptions, and in roughly ascending difficulty:

## Object Permanence

If you wanted to implement whitelisting in a modern embodied deep-learning agent, you could certainly pair deep networks with state-of-the-art segmentation and object tracking approaches to get most of what you need. However, what's the difference between an object leaving the frame, and an object vanishing?

Not only does the agent need to realize that objects are permanent, but also that they keep interacting with the environment even when not being observed. If this is not realized, then an agent might set an effect in motion, stop observing it, and then turn around when the bad effect is done to see a "new" object in its place.

## Time Step Size Invariance

The penalty is presently attenuated based on the probability that the belief shift was due to noise in the data. Accordingly, there are certain ways to abuse this to skirt the penalty. For example, simply have non-whitelisted side effects take place over long timescales; this would be classified as noise and attenuated away.

However, if we don't need to handle noise in the belief distributions, this problem disappears - presumably, an advanced agent keeps its epistemic house in order. I'm still uncertain about whether (in the limit) we have to hard-code a means for decomposing a representation of the world-state into objects, and where to point the penalty evaluator in a potentially self-modifying agent.

## Information Theory

Whitelisting is wholly unable to capture the importance of "informational states" of systems. It would apply no penalty to passing powerful magnets over your hard drive. It is not clear how to represent this in a sensible way, even in a latent space.

## Loss of Value

Whitelisting could get us stuck in a tolerable yet sub-optimal future. [Corrigibility](https://arbital.com/p/corrigibility/) via some mechanism for expanding the whitelist after training has ended is then desirable. For example, the agent could propose extensions to the whitelist. To avoid manipulative behavior, the agent should be _indifferent_ as to whether the extension is approved.

Even if extreme care is taken in approving these extensions, mistakes may be made. The agent itself should be sufficiently corrigible and aligned to notice "this outcome might not actually be what they wanted, and I should check first".

## Reversibility

As DeepMind outlines in _[Specifying AI Safety Problems in Simple Environments](https://deepmind.com/blog/specifying-ai-safety-problems/)_, we may want to penalize not just physical side effects, but also causally irreversible effects:

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/irreversible_side_effect.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/irreversible_side_effect.webm" type="video/webm"></video>

Krakovna et al. [introduce](https://deepmind.com/research/publications/measuring-and-avoiding-side-effects-using-relative-reachability/) a means for penalizing actions by the proportion of initially reachable states which are still reachable after the agent acts.

![](https://assets.turntrout.com/static/images/posts/venn1.avif)

I think this is a step in the right direction. However, even given a hypercomputer and a perfect simulator of the universe, this wouldn't work for the real world if implemented _literally._ That is, due to entropy, you may not be able to return to the _exact same_ universe configuration. To be clear, the authors do not suggest implementing this idealized algorithm, flagging a more tractable abstraction as future work.

What does it really _mean_ for an "effect" to be "reversible"? What level of abstraction do we in fact care about? Does it involve reversibility, or just outcomes for the objects involved?

## Ontological Crises

When a utility-maximizing agent refactors its ontology, it isn't always clear how to apply the old utility function to the new ontology - an _[ontological crisis](https://arxiv.org/abs/1105.3821)_.

Whitelisting may be vulnerable to ontological crises. Consider an agent whose whitelist disincentivizes breaking apart a tile floor ($\textit{floor} \to \textit{tiles} \not \in \textit{whitelist}$); conceivably, the agent could come to see the floor as being composed of many tiles. Accordingly, the agent would no longer consider removing tiles to be a side effect.

Generally, proving invariance of the whitelist across refactorings seems tricky, even assuming that we _can_ [identify the correct mapping](https://arbital.com/p/ontology_identification/).

### Retracing Steps

When I first encountered the ontological crisis problem, I was actually fairly optimistic. It was clear to me that any ontology refactoring should result in utility normality - roughly, the utility functions induced by the pre- and post-refactoring ontologies should output the same scores for the same worlds.

> Wow, this seems like a useful insight. Maybe I'll write something up!

Turns out a certain someone beat me to the punch - [here's a novella Eliezer wrote on Arbital](https://arbital.com/p/rescue_utility/) about "rescuing the utility function".[^4]

## Clinginess

This problem cuts to the core of causality and "responsibility" (whatever that means). Say that an agent is _clingy_ when it not only stops itself from having certain effects, but also stops _you_.[^5] Whitelist-enabled agents are currently clingy.

Let's step back into the human realm for a moment. Consider some outcome - say, the sparking of a small forest fire in California. At what point can we truly say we didn't start the fire?

- My actions immediately and visibly start the fire.
- At some moderate temporal or spatial remove, my actions end up starting the fire.
- I intentionally persuade someone to start the fire.
- I unintentionally (but perhaps predictably) incite someone to start the fire.
- I set in motion a moderately complex chain of events which convince someone to start the fire.
- I provoke a butterfly effect which ends up starting the fire.
- I provoke a butterfly effect which ends up convincing someone to start a fire which they:
  - were predisposed to starting.
  - were not predisposed to starting.

Taken literally, I don't know that there's actually a significant difference in "responsibility" between these outcomes - if I take the action, the effect happens; if I don't, it doesn't. My initial impression is that uncertainty about the results of our actions pushes us to view some effects as "under our control" and some as "out of our hands". Yet, _if_ we had complete knowledge of the outcomes of our actions, and we took an action that landed us in a California-forest-fire world, whom could we blame but ourselves?[^6]

Can we really do no better than a naive counterfactual penalty with respect to whatever impact measure we use? My confusion here is [not yet dissolved](/how-to-dissolve-it). In my opinion, this is a gaping hole in the heart of impact measures - both this one, and others.

### Stasis

Fortunately, a whitelist-enabled agent should not share the classic [convergent instrumental goal](/toy-instrumental-convergence-paper-walkthrough) of valuing us for our atoms.

Unfortunately, depending on the magnitude of the penalty in proportion to the utility function, the easiest way to prevent penalized transitions may be putting any relevant objects in some kind of protected stasis, and then optimizing the utility function around that. Whitelisting is clingy!

If we have at least an _almost-aligned_ utility function and proper penalty scaling, this might not be a problem.

Edit: [Here is a potential solution](/overcoming-clinginess-in-impact-measures) to clinginess.

# Discussing Imperfect Approaches

A few months ago, Scott Garrabrant [wrote](https://www.lesswrong.com/posts/bBdfbWfWxHN9Chjcq/robustness-to-scale) about robustness to scale:

> Briefly, you want your proposal for an AI to be robust (or at least fail gracefully) to changes in its level of capabilities.

I recommend reading it - it's to-the-point, and he makes good points.

Here are three further thoughts:

- Intuitively accessible vantage points can help us explore our unstated assumptions and more easily extrapolate outcomes. If less mental work has to be done to put oneself in the scenario, more energy can be dedicated to finding nasty edge cases. For example, it's probably harder to realize [all the things that go wrong with naive impact measures like raw particle displacement](https://intelligence.org/2016/12/28/ai-alignment-why-its-hard-and-where-to-start/#low-impact-agents), since it's just a _weird_ frame through which to view the evolution of the world. I've found it to be substantially easier to extrapolate through the frame of something like whitelisting.[^7]
  - I've already adjusted for the fact that one's own ideas are often more familiar and intuitive, and then adjusted for the fact that I probably didn't adjust enough the first time.
- Imperfect results are often left unstated, wasting time and obscuring useful data. That is, people cannot see what has been tried and what roadblocks were encountered.
- Promising approaches may be conceptually close to correct solutions. My intuition is that whitelisting actually _almost works_ in the limit in a way that might be important.

# Conclusion

Although somewhat outside the scope of this post, whitelisting permits the concise shaping of reward functions to get behavior that might be difficult to learn using other methods.[^8] This method also seems fairly useful for aligning short- and medium-term agents. While encountering some new challenges, whitelisting ameliorates or solves many problems with previous impact measures.

[^1]: Even an idealized form of whitelisting is not _sufficient_ to align an otherwise-unaligned agent. However, the same argument can be made against having an off-switch; if we haven't formally proven the alignment of a seed AI, having more safeguards might be better than throwing out the seatbelt to shed deadweight and get some extra speed. Of course, there are also legitimate arguments to be made on the basis of timelines and optimal time allocation.

[^2]: Humor aside, we would have no luxury of "catching up on alignment theory" if our code doesn't work on the first go - that is, if the AI still functions, yet differently than expected.

    Luckily, humans are great at producing flawless code on the first attempt.

[^3]: A potentially helpful analogy: similarly to how Bayesian networks decompose the problem of representing a (potentially extremely large) joint probability table to that of specifying a handful of conditional tables, whitelisting attempts to decompose the messy problem of quantifying state change into a set of comprehensible ontological transitions.

[^4]: Technically, at 6,250 words, Eliezer's article falls short of the [7,500 required for "novella" status](https://en.wikipedia.org/wiki/Novella).

[^5]: Is there another name for this?

[^6]: I do think that "responsibility" is an important part of our moral theory, deserving of [rescue](https://arbital.com/p/rescue_utility/).

[^7]: In particular, I found a particular variant of [Murphyjitsu](https://radimentary.wordpress.com/2018/02/07/hammertime-day-10-murphyjitsu/) helpful: I visualized Eliezer commenting "actually, this fails terribly because..." on one of my posts, letting my mind fill in the rest.

    In my opinion, one of the most important components of doing AI alignment work is iteratively applying Murphyjitsu and Resolve cycles to your ideas.

[^8]: A fun example: I imagine it would be fairly easy to train an agent to only destroy certain-colored ships in Space Invaders.
