---
permalink: against-inner-outer-alignment
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: 
  https://www.lesswrong.com/posts/gHefoxiznGfsbiAu9/inner-and-outer-alignment-decompose-one-hard-problem-into
lw-is-question: "false"
lw-posted-at: 2022-12-02T02:43:20.915000Z
lw-last-modification: 2024-03-02T01:18:37.238000Z
lw-curation-date: None
lw-frontpage-date: 2022-12-02T02:46:54.783000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 22
lw-base-score: 141
lw-vote-count: 73
af-base-score: 45
af-num-comments-on-upload: 14
title: "Inner and outer alignment decompose one hard problem into two extremely hard
  problems"
lw-latest-edit: 2023-01-24T00:43:58.097000Z
lw-is-linkpost: "false"
tags:
  - "shard-theory"
  - "AI"
  - "critique"
aliases:
  - "inner-and-outer-alignment-decompose-one-hard-problem-into"
sequence-link: posts#shard-theory
lw-sequence-title: Shard Theory
prev-post-slug: alignment-without-total-robustness
prev-post-title: "Alignment Allows “Nonrobust” Decision-Influences and Doesn’t Require
  Robust Grading"
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2022-12-02 00:00:00
original_url: 
  https://www.lesswrong.com/posts/gHefoxiznGfsbiAu9/inner-and-outer-alignment-decompose-one-hard-problem-into
skip_import: true
description: Inner and outer alignment—while seemingly useful—are unnecessary, anti-natural,
  and extremely hard. Better alignment strategies exist.
date_updated: 2025-11-22 00:21:52.667251
---













Short summary: One alignment strategy is to 1) capture “what we want” in a loss function to a high degree (“robust grading”), 2) use that loss function to train the AI, and 3) get the AI to exclusively care about optimizing that objective.

I think that each step contains either a serious and unnecessary difficulty, or an unnecessary assumption. I think that:

1. [**Robust grading is unnecessary**](/dont-design-agents-which-exploit-adversarial-inputs)**,** [**extremely hard, and unnatural**](/dont-align-agents-to-evaluations-of-plans)**.** But [we don’t _have_ to find/represent/produce an objective which is safe for a smart agent to directly optimize](/alignment-without-total-robustness). _Robust grading seems harder than the entire actual AI alignment problem._
2. **The loss function doesn’t have to robustly and directly reflect what you want.** [Loss functions](/four-usages-of-loss-in-ai) [chisel circuits into networks](/reward-is-not-the-optimization-target). Even if we _did_ want to do robust grading, we don’t have to _also_ use that grading rule to optimize directly over the network’s cognition. This assumption is restrictive.
3. **Inner alignment to a grading procedure is unnecessary, hard, and anti-natural.** We don’t have to precisely and exclusively align the agent to its loss function or to an external grading procedure. _This precise and complete inner alignment might be hard, possibly harder than the entire actual alignment problem._

<hr/>

_Extended summary._ My views on alignment have changed a lot recently. To illustrate some key points, I’m going to briefly discuss a portion of [Paul Christiano’s AXRP interview](https://axrp.net/episode/2021/12/02/episode-12-ai-xrisk-paul-christiano.html) (emphasis added):

> [!quote]
>
> **Paul Christiano:** \[...\] In general, I don’t think you can look at a system and be like, “oh yeah, that part’s outer alignment and that part’s inner alignment”. So the times when you can talk about it most, or the way I use that language most often, is for a particular kind of alignment strategy that’s like a two step plan. **Step one is, develop an objective that captures what humans want well enough to be getting on with. It’s going to be something more specific, but you have an objective that captures what humans want in some sense. Ideally it would exactly**[^1] **capture what humans want. So, you look at the behavior of a system and you’re just exactly evaluating how good for humans is it to deploy a system with that behavior, or something.** So you have that as step one and then that step would be outer alignment. And then **step two is, given that we have an objective that captures what humans want, let’s build a system that’s internalized that objective in some sense, or is not doing any other optimization beyond pursuit of that objective.**
>
> **Daniel Filan:** And so in particular, the objective is an objective that you might want the system to adopt, rather than an objective over systems?
>
> **Paul Christiano:** Yeah. I mean, we’re sort of equivocating in this way that reveals problematicness[^2] or something, but **the first objective is an objective. It is a ranking over systems, or some reward that tells us how good a behavior is. And then we’re hoping that the system then adopts that same thing, or some reflection of that thing** \[...\]

My summary of Paul's stance: One alignment strategy is to 1) capture “what we want” in a loss function to a high degree (“robust grading”), 2) use that loss function to train the AI, and 3) get the AI to exclusively care about optimizing that objective.[^3]

I think that each step contains either a serious and unnecessary difficulty, or an unnecessary assumption. I think that:

1. [**Robust grading is unnecessary**](/dont-design-agents-which-exploit-adversarial-inputs)**,** [**extremely hard, and unnatural**](/dont-align-agents-to-evaluations-of-plans)**.** But [we don’t _have_ to find/represent/produce an objective which is safe for a smart agent to directly optimize](/alignment-without-total-robustness). _Robust grading seems harder than the entire actual AI alignment problem._
2. **The loss function doesn’t have to robustly and directly reflect what you want.** [Loss functions](/four-usages-of-loss-in-ai) [chisel circuits into networks](/reward-is-not-the-optimization-target). Even if we _did_ want to do robust grading, we don’t have to _also_ use that grading rule to optimize directly over the network’s cognition. This assumption is quite restrictive.
3. **Inner alignment to a grading procedure is unnecessary, hard, and anti-natural.** We don’t have to precisely and exclusively align the agent to its loss function or to an external grading procedure. _This precise and complete inner alignment might be hard, possibly harder than the entire actual alignment problem._

Therefore, for all alignment approaches which aim to align an agent to a robust grading scheme, I think that that approach is doomed. However, I am **not** equally critiquing all alignment decompositions which have historically been called "outer/inner alignment" (for more detail, see [Appendix A](#appendix-a-additional-definitions-of-outer-inner-alignment)).

Here’s the structure of the essay, and some key points made within:

1. Robust grading is unnecessary, extremely hard, and unnatural.
    1. An agent which exclusively cares about the output of some objective (e.g. “How many diamonds an extremely smart person thinks _input-plan_ will produce”) _doesn’t care about diamonds_. That agent ultimately only cares about _high objective outputs_.
    2. [Robust grading incentivizes an inner-aligned AI to search for upwards errors in your grading procedure](/dont-design-agents-which-exploit-adversarial-inputs), but I think [it’s easy to tell plausible training stories which don’t require robust outer objectives](/a-shot-at-the-diamond-alignment-problem).
    3. We’ve tried finding robust grading methods and have failed for a range of objectives, from [diamond production](https://arbital.com/p/diamond_maximizer/) to protecting humans to [moving strawberries onto plates](https://intelligence.org/stanford-talk/). This suggests a high fixed cost presented by robust grading itself, such that the bottleneck difficulty isn’t coming from the varying complexity of the goals (e.g. human values vs moving strawberries) by which we grade.
    4. Robust grading incentivizes the AI to trick the evaluation function (if possible), and the evaluation function must be hardened to not get tricked. This violates [the non-adversarial principle](https://arbital.com/p/nonadversarial/).
2. The loss function doesn’t have to robustly and directly reflect what you want.
    1. [A loss function is a tool which chisels circuits into networks](/four-usages-of-loss-in-ai). Most outer/inner alignment frames assume that that tool should _also_ _embody_ the goals we want to chisel into the network. When chiseling a statue, the chisel doesn’t have to also look like the finished statue.
    2. Shaping is empirically useful in both [AI](https://openai.com/blog/deep-reinforcement-learning-from-human-preferences/) and [animals](<https://en.wikipedia.org/wiki/Shaping_(psychology)>). If you think about reward as exclusively “encoding” what you want, you lose track of important learning dynamics and seriously constrain your alignment strategies.
    3. “Loss-as-chisel” encourages [substantive and falsifiable speculation](/a-shot-at-the-diamond-alignment-problem) about internals and thus about generalization behavior, and avoids the teleological confusions which arise from using the intentional stance on agents ~“wanting” to optimize their loss functions.
3. Complete and precise inner alignment seems unnecessary, anti-natural, and hard.
    1. Humans don’t form their values by being inner-aligned to a robust grading procedure. If you look at the single time _ever_ that human-compatible values have arisen in generally intelligent minds (i.e. in humans), you’ll find it _wasn’t_ done through outer/inner alignment. According to [shard theory](/shard-theory), human values are _inner alignment failures on the_ _reward circuitry in the human brain_ (read carefully: this is not the usual evolution analogy!). If you aim to “solve” outer and inner alignment, you are ruling out the _only_ empirically known class of methods for growing human-compatible values.
    2. Complete inner alignment on one kind of goal seems difficult and anti-natural. We’ve never observed it in reality, and [it doesn’t seem necessary](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=Cyzck3vqEa4EfoXaz).
4. I dialogue with my model of someone who advocates solving alignment via inner-aligning an agent to a robust grading procedure. In particular, I discuss how some reasons for doom no longer apply in the loss-as-chisel framing.

> [!thanks]
> This post wouldn’t have happened without Quintin Pope’s ideas and feedback. Thanks to David Udell for extensive brainstorming help. Thanks to Evan Hubinger, Rohin Shah, Abram Demski, Garrett Baker, Andrew Critch, Charles Foster, Nora Belrose, Leo Gao, Kaj Sotala, Paul Christiano, Peter Barnett, and others for feedback. See here for a [talk](https://www.youtube.com/watch?v=VO15pp1qTIg) based on this essay.
>
> I think that alignment research will be enormously advantaged by dropping certain ways of outer/inner-centric thinking for most situations, even though those ways of thinking do have some use cases. Even though this essay is critical of certain ways of thinking about alignment, I want to emphasize that I appreciate and respect the work that many smart people have done through these frames.

<hr/>

For reasoning about trained AI systems, I like [Evan Hubinger’s “training stories” framework](https://www.alignmentforum.org/posts/FDJnZt8Ks2djouQTZ/how-do-we-become-confident-in-the-safety-of-a-machine):

> A _training story_ is a story of how you think training is going to go and what sort of model you think you’re going to get at the end\[…\]

In a training story, the _training goal_ is a mechanistic description of the model you hope to train, and the _training rationale_ explains why you’ll train the desired model and not something else instead.

One popular decomposition of AI alignment is (roughly) into outer alignment and inner alignment. These subproblems were originally defined as follows:

> [!quote] [Risks from Learned Optimization: Introduction](https://www.lesswrong.com/posts/FkgsxrGf3QxhfLWHG/risks-from-learned-optimization-introduction)
>
> “The outer alignment problem is an alignment problem between the system and the humans outside of it (specifically between the base objective and the programmer’s intentions). In the context of machine learning, outer alignment refers to aligning the specified loss function with the intended goal, whereas inner alignment refers to aligning the mesa-objective of a mesa-optimizer with the specified loss function.”

More recently, Evan Hubinger [defined](https://www.alignmentforum.org/posts/FDJnZt8Ks2djouQTZ/how-do-we-become-confident-in-the-safety-of-a-machine) these subproblems as:

> [!quote]
>
> [**Outer alignment**](https://www.alignmentforum.org/posts/33EKjmAdKFn3pbKPJ/outer-alignment-and-imitative-amplification) refers to the problem of finding a loss/reward function such that the training goal of “a model that optimizes for that loss/reward function” would be desirable.
>
> [**Inner alignment**](https://www.alignmentforum.org/posts/FkgsxrGf3QxhfLWHG/risks-from-learned-optimization-introduction) refers to the problem of constructing a training rationale that results in a model that optimizes for the loss/reward function it was trained on.

I initially found these concepts appealing. Even recently, I found it easy to nod along: _Yeah, we compute a reward function in a way which robustly represents what we want. That makes sense. Then just target the inner cognition properly. Uh huh. What kind of reward functions would be good?_

When I try to imagine any _concrete real-world_ situation in which these conditions obtain, _I cannot._ I might conclude “Wow, alignment is unimaginably hard!”. _No! Not for this reason, at least—The frame is inappropriate._[^4]

# I: Robust grading is unnecessary, extremely hard, and unnatural

In my opinion, outer alignment encourages a strange view of agent motivation. Here’s one reasonable-seeming way we could arrive at an outer/inner alignment view of optimization:

> An agent which makes diamonds has to, at least implicitly, consider a range of plans and then choose one which in fact leads to diamonds. To do this, the AI (or “actor”) has to (at least implicitly) grade the plans. The actor needs a grading procedure which, when optimized against, leads to the selection of a diamond-producing plan. Therefore, we should specify or train a grading procedure which can be optimized in this way. Let’s call this the “outer objective”, because this grading procedure is also the objective we’ll use to give the agent feedback on the plans and actions it executes.
>
> Once we find a good grading procedure, we should train the actor to be smart and make sure it actually uses the right procedure to grade plans. We align the actor so it optimizes that grading procedure (in its form as a _Platonic mathematical function_ over e.g. the plan-space).[^5] This is aligning the _inner cognition_ which the _outer objective_ is optimizing (via e.g. gradient updates), so we’ll call this “inner alignment.” If we solve outer and inner alignment, it sure seems like the actor should find and execute a plan which makes a lot of diamonds.

One major mistake snuck in when I said “The actor needs a grading procedure which, when optimized, leads to the selection of a diamond-producing plan.” I suspect that many (perceived) alignment difficulties spill forth from this single mistake, condemning us to an extremely unnatural and hard-to-align portion of mind-space.

Why is it a mistake? Consider what happens if you successfully inner-align the actor so that it wholeheartedly searches for plans which maximize grader evaluations (e.g. “how many diamonds does it seem like this plan will lead to?”). In particular, I want to talk about what this agent “cares about”, or the factors which influence its decision-making. What does this inner-aligned actor care about?

Agents which care about the outer objective will make decisions on the basis of the output of the outer objective. Maximizing evaluations is the _terminal purpose_ of the inner-aligned agent’s cognition. Such an agent is not making decisions on the basis of e.g. diamonds or having fun. That agent is _monomaniacally optimizing for high outputs._

On the other hand, agents which terminally value diamonds will make decisions on the basis of diamonds (e.g. via [learned subroutines like](/dont-align-agents-to-evaluations-of-plans#Grader-optimization-planning) “IF `diamond` `nearby`, THEN bid to set `planning subgoal`: `navigate to diamond`”). Agents which care about having fun will make decisions on the basis of having fun. Even though people often evaluate plans (e.g. via their gut) and choose the plan they feel best about (e.g. predicted to lead to a fun evening), finding a highly evaluated plan isn’t the _point_ of the person’s search. The point is to have fun. For someone who values having fun, the _terminal purpose_ of their optimization is to have fun, and finding a highly evaluated plan is a _side effect_ of that process.

“The actor needs a grading procedure which, when optimized against, leads to the selection of a diamond-producing plan” is a mistake because agents should not _terminally care about optimizing a grading procedure_. Generating highly evaluated plans should be a _side effect_ of effective cognition towards producing diamonds.

> [!failure]
> **Consider what the actor cares about** **in this setup. The actor does not care about diamond production. The actor cares about high evaluations from the objective function. These two goals (instrumentally) align if the only actor-imaginable way to get maximal evaluation is to make diamonds.[^important]**
> [^important]: This point is important under my current views, but it strikes me as the kind of concept which may require its own post. I’m not sure I know how to communicate this point quickly and reliably at this point in time, but this essay has languished in my drafts for long enough. For now, refer to [Don't align agents to evaluations of plans](/dont-align-agents-to-evaluations-of-plans) and [Alignment allows "nonrobust" decision-influences and doesn't require robust grading](/alignment-without-total-robustness) for more intuitions.
>
> **If you inner-align the agent to the evaluative output of a Platonic outer objective, you have guaranteed the agent won’t make decisions on the same basis that you do.** After all, you do not (on a mechanistic level) terminally value high outputs from that outer objective. This agent will be aligned with you only if you achieve “objective robustness”—i.e. force the agent to make diamonds in order to get high evaluations by the outer objective.

> [!quote] [Don't align agents to evaluations of plans](/dont-align-agents-to-evaluations-of-plans)
>
> It's like saying, "What if I made a superintelligent sociopath who only cares about making toasters, and then arranged the world so that the only possible way they can make toasters is by making diamonds?" Yes, _possibly_ there do exist ways to arrange the world so as to satisfy this strange plan. But it's just deeply unwise to try to do! Don't make them care about making toasters, or about evaluations of how many diamonds they're making… Make them care about diamonds.
>
> \[...\]
>
> Don't align an agent to _evaluations which are only nominally about diamonds_, and then expect the agent to care about diamonds! You wouldn't align an agent to care about cows and then be surprised that it didn't care about diamonds. Why be surprised here?
>
> Grader-optimization fails because _it is not the kind of thing that has any right to work_. If you want an actor to optimize _X_ but align it with evaluations of _X_, you shouldn't be surprised if you can't get _X_ out of that.

Motivation via evaluations-of-_X_ _incentivizes_ agents to seek out adversarial inputs to the evaluative outer objective (e.g. “how many diamonds a specific simulated smart person expects of a plan”), since if there’s any possible way to get an even higher output-number, the inner-aligned agent will try to exploit that opportunity. I’m 95% confident that outer objectives will have adversarial inputs which have nothing to do with what we were attempting to grade on, because the input-space is exponentially large, the adversaries superintelligent, and real-world evaluative tasks are non-crisp/non-syntactic. This case is made in depth in [don't design agents which exploit adversarial inputs](/dont-design-agents-which-exploit-adversarial-inputs). Don’t build agents which care about evaluations of _X_. Build agents which care about _X_.

This conflict-of-interest between evaluations-of-_X_ and _X_ is why you need to worry about e.g. “[nearest unblocked strategy](https://arbital.com/p/nearest_unblocked/)” and “[edge instantiation](https://arbital.com/p/edge_instantiation/)” within the outer/inner alignment regime. If you’re trying to get an agent to optimize diamonds by making it optimize evaluations, of course the agent will exploit any conceivable way to get high evaluations without high diamonds. I tentatively conjecture[^6] (but will not presently defend) that these problems are artifacts of the assumption that agents must be grader-optimizers (i.e. a smart “capabilities” module which optimizes for the outputs of some evaluation function, be that a utility function over universe-histories, or a grader function over all possible plans). But when I considered the problem with fresh eyes, I concluded that [alignment allows "nonrobust" decision-influences and doesn't require robust grading](/alignment-without-total-robustness).

In my opinion, the answer is not to find a clever way to get a robust outer objective. The answer is to not _need_ a robust outer objective. [Robust grading incentivizes an inner-aligned AI to search for upwards errors in your grading procedure](/dont-design-agents-which-exploit-adversarial-inputs), but I think [it’s easy to tell plausible training stories which don’t require robust outer objectives](/a-shot-at-the-diamond-alignment-problem).

## Outer/inner introduces indirection

We want an AI which takes actions which bring about a desired set of results (e.g. help us with alignment research or make diamonds). Outer/inner proposes getting the AI to care about optimizing some objective function, and hardening the objective function such that it’s best optimized by e.g. helping us with alignment research. This introduces indirection—the AI cares about the objective function, which then gets the AI to behave in the desired fashion. Just cut out the middleman and entrain the relevant decision-making influences into the AI.

## Outer/inner violates the non-adversarial principle

We shouldn’t build an agent where the inner agent spends a ton of time thinking hard about how to get high evaluations / output-of-outer-objective, while also we have to specify an objective function which can _only_ be made to give high evaluations if the agent does what we want. In such a situation, the outer objective has to spend extra compute to not get tricked by the inner agent doing something which only _looks_ good. I think it’s far wiser to entrain decision-making subroutines which are thinking about how to do what we want, and cut out the middleman represented by an adversarially robust outer objective.

> [!quote] [Non-adversarial principle, Arbital](https://arbital.com/p/nonadversarial/)
>
> We should not be constructing a computation that is _trying_ to hurt us. At the point that computation is running, we've already done something foolish--willfully shot ourselves in the foot. Even if the AI doesn't find any way to do the bad thing, we are, at the least, wasting computing power.
>
> \[...\] If you're building a toaster, you don't build one element that heats the toast and then add a tiny refrigerator that cools down the toast.

In [Don't align agents to evaluations of plans](/dont-align-agents-to-evaluations-of-plans), I wrote:

> In the intended motivational structure, the actor tries to trick the grader, and the grader tries to avoid being tricked. I think we can realize massive alignment benefits by not designing motivational architectures which require extreme robustness properties and whose parts work at internal cross-purposes.

## I know of no outer-aligned objectives for any real-world task

It’s understandable that we haven’t found an outer objective which “represents human values” (in some vague, [possibly type-incorrect sense](/four-usages-of-loss-in-ai)). Human values _are_ complicated, after all. What _can_ we specify? What about [diamond maximization](https://arbital.com/p/diamond_maximizer/)? Hm, that problem also hasn’t yielded. [Maybe we can just get the AI to duplicate a strawberry, and then do nothing else](https://www.lesswrong.com/posts/SsCQHjqNT3xQAPQ6b/yudkowsky-on-agi-ethics)? What an [innocent-sounding](https://www.lesswrong.com/posts/GNhMPAWcfBCASy8e6/a-central-ai-alignment-problem-capabilities-generalization?commentId=gaLCzdgM6SHtSX76N#7ey5bcAXiZsFx8HzQ) task! Just one tiny strawberry! Just grade whether the AI made a strawberry and did nothing, or whether it did some other plan involving more than that!

_We can do none of these things._ We don't know how to design an argmax agent, operating in reality with a plan space of plans _about_ reality, such that the agent chooses a plan which a) we ourselves could not have specified and b) does what we wanted.

At first pass, this seems like evidence that alignment is hard. In some worlds where alignment is easy, “just solve outer alignment” _worked_. We _were able_ to “express what we wanted.” Perhaps, relative to your subjective uncertainty, “just solve outer alignment” happens in fewer worlds where alignment is hard. Since “just solve outer alignment” _isn’t known to work for pinning down **any** desirable real-world behavior which we didn’t already know how to specify_, we update (at least a bit) towards “alignment is hard.”

**But also, we update towards “outer/inner is just a bad frame.”** Conditional on my new frame, there isn’t an “alignment is hard” update. Repeated failures at outer alignment don’t discriminate between worlds where cognition-updating-via-loss is hard or easy to figure out in time.

# II: Loss functions chisel circuits into networks

> [!info] Clarification
> In this section, I use “reward” and “loss” somewhat interchangeably, with the former bearing a tint of RL.

[A loss function is a tool which chisels cognitive grooves into agents](/four-usages-of-loss-in-ai). Mechanis&shy;tically, [loss is not the optimization target](/reward-is-not-the-optimization-target), loss is not the “ground truth” on whether a state is good or not—loss chisels cognition into the agent’s mind. A given training history and loss/reward schedule yields a sequence of cognitive updates to the network we’re training. That’s what reward does in the relevant setups, and that’s what loss does in the relevant setups.

> [!quote] [AGI safety from first principles: Alignment](https://www.lesswrong.com/s/mzgtmmTKKn5MuCzFJ/p/PvA2gFMAaHCHfMXrw)
> In trying to ensure that AGI will be aligned, we have a range of tools available to us - we can choose the neural architectures, RL algorithms, environments, optimisers, etc, that are used in the training procedure. We should think about our ability to specify an objective function as the most powerful such tool. Yet it’s not powerful because the objective function defines an agent’s motivations, but rather because samples drawn from it shape that agent’s motivations and cognition. From this perspective, we should be less concerned about what the extreme optima of our objective functions look like...

The [_mechanistic function_ of loss is to supply cognitive updates to an agent](/reward-is-not-the-optimization-target). In policy gradient methods, rewarding an agent for putting away trash will reinforce / generalize the computations which produced the trash-putting-away actions. Reward’s mechanistic function is not necessarily to be the quantity which the agent optimizes, and—_when you look at the actual math implementing cognition-updating in deep learning_—reward/loss does not have the type signature of _goal/that-which-embodies-preferences_. I have [already argued](/reward-is-not-the-optimization-target) why agents probably won’t end up primarily optimizing their own reward signal. And that’s a good thing!

## Loss-as-chisel is mathematically correct

I kinda thought that when I wrote [Reward is not the optimization target](/reward-is-not-the-optimization-target), people would _click_ and realize “Hey, I guess outer and inner alignment were leaky frames on the true underlying update dynamics, and if we knew what we were doing, we could just control the learned cognition via the cognitive-update-generator we provide (aka the reward function). This lets us dissolve the nearest unblocked strategy problem—how amazing!” This, of course, proved wildly optimistic. Communication takes effort and time. So let me continue from that trailhead.

Let’s compare loss-as-chisel with a more common frame for analysis:

1. **A naive “reward-optimized” view.** The training process optimizes the network to get lots of reward/low loss.
2. **Loss-as-chisel.** Reward and loss provide a sequence of gradients on the empirical data distribution. Each gradient changes the generalization properties.

Rohin Shah likes to call (1) “deep learning's Newtonian mechanics” and (2) the “quantum mechanics”, in that (2) _more faithfully_ describes the underlying learning process, but is harder to reason about. But often, when I try to explain this to alignment researchers, they don’t react with “Oh, yeah, but I just use (1) as a shortcut for (2).” Rather, they seem to react, “What an interesting Shard Theory Perspective you have there.” Rohin has told me that his response to these researchers would be: “Your abstraction (1) is leaky under the true learning process which is _actually happening_, and you should be sharply aware of that fact.”

## Loss-as-chisel encourages thinking about the mechanics and details of learning

Loss-as-chisel encourages [substantive and falsifiable speculation](/a-shot-at-the-diamond-alignment-problem) about internals and thus about generalization behavior. Loss-as-chisel also avoids the teleological confusions which arise from using the intentional stance to view agents as ~“wanting” to optimize their loss functions.[^7] I consider a bunch of "what is outer/inner alignment" discourse and debate to be confusing, even still, even as a relatively senior researcher. Good abstractions hew close to the bare-metal of the alignment problem. In this case, I think we should hew closer to the actual learning process. (See also Appendix B for an example of this.)

By taking a more faithful loss-as-chisel view on deep learning, I have realized enormous benefits. Even _attempting_ to mechanistically consider a learning process highlights interesting considerations and—at times—vaporizes confused abstractions you were previously using.

For example, I asked myself “when during training is it most important to provide ‘high-quality’ loss signals to the network?”. I realized that if you aren’t aiming for inner alignment on a robust grading procedure represented by the loss function, it probably **doesn’t matter** what the loss function outputs in some late-training and any deployment situations (e.g. what score should you give to a plan for a high-tech factory?).

At that stage, a superintelligent AI could just secretly set its learning rate to zero if it didn’t want to be updated, and then the loss signal wouldn’t matter. And if it did want to be updated, it could set the loss itself. So when the AI is extremely smart, it doesn’t matter _at all_ what reward/loss signals look like. This, in turn, suggests (but does not decisively _prove_) we [focus our efforts on early- and mid-training value development](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=o4ZLLqD5BAshiH83Z#o4ZLLqD5BAshiH83Z). Conveniently, that’s the part of training when supervision and interpretability is easier (although still _quite hard_).

## Loss doesn’t have to “represent” intended goals

**Outer/inner** _**unnecessarily** **assumes**_ **that the loss function/outer objective should “embody” the goals which we want the agent to pursue.**

For example, shaping is empirically useful in both [AI](https://openai.com/blog/deep-reinforcement-learning-from-human-preferences/) and [animals](<https://en.wikipedia.org/wiki/Shaping_(psychology)>). When a trainer is teaching a dog to stand on its hind legs, they might first give the dog a treat when it lifts its front paws off the ground. This treat translates into an internal reward event for the dog, which ([roughly](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed#FL4kfk5YFvnjySAcn)) reinforces the dog to be more likely to lift its paws next time. The point isn’t that we _terminally value_ dogs lifting their paws off the ground. We do this because it reliably shapes target cognition (e.g. stand on hind legs on command) into the dog. If you think about reward as exclusively “encoding” what you want, you lose track of important learning dynamics and seriously constrain your alignment strategies. (See [Some of my disagreements with List of Lethalities](/disagreements-with-list-of-lethalities#Paul-Christiano) for a possible example of someone being hesitant to use reward shaping because it modifies the reward function.)

## Be precise when reasoning about outer objectives

I also think that people talk extremely imprecisely and confusingly about “loss functions.” I get a lot of mileage out of being precise—if my idea is right in generality, it is right in specificity, so I might as well start there. I have written:

> [!quote] [Four usages of "loss" in AI](/four-usages-of-loss-in-ai)
>
> What does it _mean_ for a loss function to be "aligned with" human goals? I perceive four different concepts which involve "loss function" in importantly different ways:
>
> 1. _Physical-loss:_ The physical implementation of a loss function and the loss computations,
> 2. _Mathematical-loss:_ The mathematical idealization of a loss function,
> 3. A loss function "encoding/representing/aligning with" an intended goal, and
> 4. Agents which "care about achieving low loss."
>
> I advocate retaining physical- and mathematical-loss. I advocate dropping 3 in favor of talking directly about desired AI cognition and how the loss function entrains that cognition. I advocate disambiguating 4, because it can refer to a range of physically grounded preferences about loss (e.g. low value at the loss register versus making perfect future predictions).

> [!quote] [Outer Alignment](https://www.lesswrong.com/tag/outer-alignment)
> Outer Alignment in the context of machine learning is the property where the specified loss function is aligned with the intended goal of its designers. This is an intuitive notion, in part because human intentions are themselves not well-understood.

I think that outer alignment is an “intuitive notion” in part because _loss functions don’t natively represent goals._ For agents operating in reality, extra interpretation is required to view loss functions as representing goals. I can imagine, in detail, what it would look like to use a loss function to supply a stream of cognitive updates to a network, such that the network ends up reasonably aligned with my goals. I cannot imagine what it would mean for a physically implemented loss function to be “aligned with my goals.” I notice confusion and unnaturality when I try to force that mental operation.

This “optimize the loss function” speculation is weird and sideways of how we actually get AI to generalize how we want. Here’s a small part of an outer/inner training story:

> Find a robust diamond-grading loss function which optimizes the network so that the network wants to optimize the loss function which optimized it. When the agent optimizes the loss function as hard as it can, the agent makes diamonds.

This story is just, you know, _**so** weird. Why would you use a loss function or reward function this way?!_

<img alt="Meme: a young black man with a confused expression, with three large black question marks floating on either side of his head." src="https://assets.turntrout.com/static/images/posts/confused.avif" style="max-width: 75%;"/>

According to me, the bottleneck hard problem in AI alignment is _how do we predictably control the way in which an AI generalizes; how do we map outer supervision signals (e.g. rewarding the agent when it makes us smile) into the desired inner cognitive structures (e.g. the AI cares about making people happy)?_

**Here’s what I think** **we have to do to solve alignment: We have to know how to produce powerful human-compatible cognition using large neural networks. If we can do that, I don’t give a damn what the loss function looks like. It truly doesn’t matter. Use the chisel to make a statue and then toss out the chisel. If you’re making a statue, your chisel doesn’t also have to look like the statue.**

# III: Outer/inner just isn’t how alignment works in people

Inner and outer alignment decompose one hard problem (AI alignment) into two extremely hard problems\. Inner and outer alignment _both_ cut against known grains of value formation.

## Inner alignment seems anti-natural

We have all heard the legend of how evolution selected for inclusive genetic fitness, but all it got was human values. [I think this analogy is relatively loose and inappropriate for alignment](https://www.lesswrong.com/posts/FyChg3kYG54tEN3u6/evolution-is-a-bad-analogy-for-agi-inner-alignment), but it’s proof that inner alignment failures _can_ happen in the presence of selection pressure. Far more relevant to alignment is the [crush of empirical evidence from real-world general intelligences with reward circuitry](/humans-provide-alignment-evidence), suggesting to us billions and billions of times over that [_reinforcement learning at scale within a certain kind of large (natural) neural network_](/shard-theory#appendix-c-evidence-for-neuroscience-assumptions) [_does not primarily produce inner value shards oriented around their reward signals, or the world states which produce them_](/reward-is-not-the-optimization-target).

When considering whether human values are inner-aligned to the human reward circuitry, you only have to consider the _artifact which evolution found._ Evolution found the genome, which—in conjunction with some environmental influences—specifies the human learning process & reward circuitry. You don't have to consider _why_ evolution found that artifact (e.g. selection pressures favoring certain adaptations). For this question, it might help to imagine that the brain teleported into existence from some nameless void.

From my experience with people, I infer that they do not act to maximize some simple function of their internal reward events. I further claim that people do not strictly care about bringing about the activation preconditions for their reward circuitry (e.g. for a sugar-activated reward circuit, those preconditions would involve eating sugar). True, people like sugar, but what about artificial sweeteners? Isn’t that a bit “unaligned” with our reward circuitry, in some vague teleological sense?

More starkly, a soldier [throwing himself on a grenade](https://en.wikipedia.org/wiki/Falling_on_a_grenade) is not acting (either consciously or subconsciously) to most reliably bring about the activation preconditions for some part of his reward system. I infer that he is instead executing lines of cognition chiseled into him by past reinforcement events. He is a value shard-executor, not an inner-aligned reward maximizer. Thus, his values of protecting his friends and patriotism constitute _inner alignment failures_ on the reward circuitry which brought those values into existence.[^8] Those values are not aligned with the goals “represented by” that reward circuitry, nor with the circuitry’s literal output. I think that similar statements hold for values like “caring about one’s family”, “altruism”, and “protecting dogs.”

Therefore, the _**only time human-compatible values have ever arisen, they have done so via inner alignment failures**_.[^9] Conversely, if you aim to “solve” inner alignment, **you are ruling out the only empirically known way to form human-compatible values.**

> [!quote] [Quintin Pope](https://www.lesswrong.com/s/rmZt45HAxFFgJ8vEH/p/LxofChCRcQMBE6D3E?commentId=yJJvatcctmQ8iEidN)
>
> Prior to [Dissolving the Fermi Paradox](https://arxiv.org/abs/1806.02404), people came up with all sorts of wildly different solutions to the paradox, as you can see by looking at its [Wikipedia page](https://en.wikipedia.org/wiki/Fermi_paradox). Rather than address the underlying assumptions that went into constructing the Fermi paradox, these solutions primarily sought to add additional mechanisms that seemed like they might patch away the confusion associated with the Fermi paradox.
>
> However, the true solution to the Fermi paradox had nothing to do with any of these patches. No story about why aliens wouldn’t contact Earth or why technological civilizations invariably destroyed themselves would have ever solved the Fermi paradox, no matter how clever or carefully reasoned. Once you assume the incorrect approach to calculating the Drake equation, no amount of further reasoning you perform will lead you any further towards the solution, not until you reconsider the form of the Drake equation.
>
> **I think the Fermi paradox** **and human value formation belong to a class of problems, which we might call “few-cruxed problems” where progress can be almost entirely blocked by a handful of incorrect background assumptions. For few-crux problems, the true solution lies in a part of the search space that’s nearly inaccessible to anyone working from said mistaken assumptions.**
>
> The correct approach for few-cruxed problems is to look for solutions that take away complexity, not add more of it. The skill involved here is similar to [noticing confusion](https://www.lesswrong.com/s/zpCiuR4T343j9WkcK), but can be even more difficult. Oftentimes, the true source of your confusion is not the problem as it presents itself to you, but some subtle assumptions (the “cruxes”) of your background model of the problem that caused no telltale confusion when you first adopted them.
>
> A key feature of few-cruxed problems is that the amount of cognitive effort put into the problem before identifying the cruxes tells us almost nothing about the amount of cognitive work required to make progress on the problem once the cruxes are identified. **The amount of cognition directed towards a problem is irrelevant if the cognition in question only ever explores regions of the search space which lack a solution.** It is therefore important not to flinch away from solutions that seem “too simple” or “too dumb” to match the scale of the problem at hand. Big problems do not always require big solutions.
>
> I think one crux of alignment is the assumption that human value formation is a complex process. The other crux (and I don't think there's a third crux) is the assumption that we should be trying to avoid inner alignment failures. **If (1) human values derive from an inner alignment failure \[with respect to\] to \[human reward circuitry\], and (2) humans are the only places where human values can be found, then an inner alignment failure is the only process to have ever produced human values in the entire history of the universe.**
>
> If human values derive from inner alignment failures, and we want to instill human values in an AI system, then the default approach should be to understand the sorts of values that derive from inner alignment failures in different circumstances, then try to arrange for the AI system to have an inner alignment failure that produces human-compatible values.
>
> **If, after much** **exploration, such an approach turned out to be impossible, then I think it would be warranted to start thinking about how to get human-compatible AI systems out of something other than an inner alignment failure. What we actually did was almost completely wall off that entire search space of possible solutions and actively try to solve the inner alignment "problem".**
>
> **If the true** **solution to AI alignment actually looks anything like "cause a carefully orchestrated inner alignment failure in a simple learning system", then of course our assumptions about the complexity of value formation and the undesirability of inner alignment failures would prevent us from finding such a solution. Alignment would look incredibly difficult because the answer would be outside of the subset of the solution space we'd restricted ourselves to considering.**

The above argues that inner alignment is _un_-natural because it runs counter to natural tendencies. I further infer that inner alignment is unnatural partly _because_ it is anti-natural. We've never seen it happen, we don't know how to make it happen, there are lots of reasons to think it won't happen, and I don't think we need to make it happen.

> [!warning]
> "Cause a carefully orchestrated inner alignment _failure_ in a simple learning system" sounds like we’re trying something “hacky” or “mistake-prone." However, we really aren’t attempting something strange. Rather, we’re talking about the [apparently natural](/shard-theory) way for values to form.

## Complete inner alignment seems unnecessary

[In the AXRP interview](https://axrp.net/episode/2021/12/02/episode-12-ai-xrisk-paul-christiano.html), Paul stated that he would (under the outer/inner frame) aim for an agent “not doing any other optimization beyond pursuit of \[the outer objective\].” But _why_ must there be _no_ other optimization? Why can’t the AI value a range of quantities?

On how I use words, values are decision-influences (also known as [_shards_](/shard-theory)). “I value doing well at school” is a short sentence for “in a range of contexts, there exists an influence on my decision-making which upweights actions and plans that lead to e.g. learning and good grades and honor among my classmates.”

An agent with lots of values (e.g. coffee and sex and art) will be more likely to choose plans which incorporate positive features under all of the values (since those plans get bid for by many decision-influences). I believe that this complexity of value is the default. **If an AI strongly and reflectively values both protecting people and paperclips,** [**it will make decisions on the basis of both considerations**](/alignment-without-total-robustness)**.** Therefore, the AI will both protect people and make paperclips (assuming the values work in the described way, which is a whole ‘nother matter).

> [!quote] [One of my comments](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=Cyzck3vqEa4EfoXaz)
> I think these considerations make total alignment success more difficult, because [I expect agents to e.g. terminalize common instrumental values](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed#cuTotpjqYkgcwnghp). Therefore, it's hard to end up with e.g. a single dominant value which only cares about maximizing diamonds. I think that value is complex by default.
>
> People care about lots of things, from family to sex to aesthetics. My values / decision-influences don't collapse down to any one of these.
>
> I think AIs will learn lots of values by default. I don't think we need all of these values to be aligned with human values. I think this is quite important.
>
> - I think the more of the AI's values we align to care about us and make decisions in the way we want, the better. (This is vague because I haven't yet sketched out AI internal motivations which I think would actually produce good outcomes. On my list!)
> - I think there are strong gains from trade possible among an agent's values. If I care about bananas and apples, I don't need to split my resources between the two values, I don't need to make one successor agent for each value. I can drive to the store and buy both bananas and apples, and only pay for fuel once.
>   - This makes it lower-cost for [internal values handshakes](/a-shot-at-the-diamond-alignment-problem#The-values-handshake) to compromise; it's less than 50% costly for a power-seeking value to give human-compatible values 50% weight in the reflective utility function.
> - I think there are thresholds at which the AI doesn't care about us sufficiently strongly, and we get no value.
>   - I might have an "avoid spiders" value which is narrowly contextually activated when I see spiders. But then I think this is silly because spiders are quite interesting, and so I decide to go to exposure therapy and remove this decision-influence. We don't want human values to be outmaneuvered in this way.
>   - More broadly, I think "value strength" is a loose abstraction which isn't uni-dimensional. It's not "The value is strong" or "The value is weak"; I think values are [contextually activated](/a-shot-at-the-diamond-alignment-problem#The-values-handshake), and so they don't just have a global strength.
> - Even if you have to get the human-aligned values "perfectly right" in order to avoid Goodharting ([which I don’t believe](/alignment-without-total-robustness)), not having to get _all_ of the AI's values perfectly right is good news.
> - I think these considerations make total alignment failures easier to prevent: As long as human-compatible values are something the AI meaningfully cares about, we survive.

So ultimately, I think “the agent has to exclusively care about this one perfect goal” is dissolved because [alignment allows "nonrobust" decision-influences and doesn't require robust grading](/alignment-without-total-robustness). Trying to make an agent only care about one goal seems to go against important grains of effective real-world cognition.

## Outer alignment seems unnatural

**People are not inner-aligned to their reward circuitry, nor should they be.** The human reward circuitry does not specify an ungameable set of incentives such that, if the reward circuitry is competently optimized, the human achieves high genetic fitness, or lives a moral and interesting life, or anything else. As Quintin remarked to me, “If you find the person with the highest daily reward activation, it’s not going to be Bill Gates or some genius physicist."

> [!quote] [Atlantic’s summary](https://www.theatlantic.com/health/archive/2018/03/pleasure-shock-deep-brain-stimulation-happiness/556043/) of a [1986 journal article](https://scholar.google.com/scholar?cluster=17534501209842642441&hl=en&as_sd$t=7$,39)[^10]
>
> In order to relieve insufferable chronic pain, a middle-aged American woman had a single electrode placed in a part of her thalamus on the right side. She was also given a self-stimulator, which she could use when the pain was too bad. She could even regulate the parameters of the current. She quickly discovered that there was something erotic about the stimulation, and it turned out that it was really good when she turned it up almost to full power and continued to push on her little button again and again.
>
> In fact, it felt so good that the woman ignored all other discomforts. Several times, she developed atrial fibrillations due to the exaggerated stimulation, and over the next two years, for all intents and purposes, her life went to the dogs. Her husband and children did not interest her at all, and she often ignored personal needs and hygiene in favor of whole days spent on electrical self-stimulation. Finally, her family pressured her to seek help. At the local hospital, they ascertained, among other things, that the woman had developed an open sore on the finger she always used to adjust the current.

_That’s_ what happens when the human reward circuitry is somewhat competently optimized. Good thing we aren’t inner-aligned to our reward circuitry, because it isn’t “outer aligned” in any literal sense. But even in a more abstract sense of "outer alignment", I infer that human values have not historically arisen from optimizing a “hard-to-game” outer criterion which specifies those values.

David Udell [made](https://www.lesswrong.com/posts/saGr6DapTPKFaMhhP/framing-ai-childhoods) an apt analogy:

> [!quote] David Udell
>
> Say that you were raising a kid. One childrearing scheme is to carefully make your kid's childhood robust to arbitrary levels of precocious genius in your kid. You'd build a childhood such that overachieving in it would only ever be a good thing. You'd drill athletics, navigating complex adult social situations, difficult moral dilemmas, etc., always making sure that there isn't some perverse victory condition way up near the skill ceiling of the task. For on this approach, [you don't _ever_ want optimization power being pointed in a direction you wouldn't want to see optimized, in the way that you don't ever want to needlessly point a gun barrel at anything you don't want destroyed.](https://arbital.com/p/omni_test/)
>
> You'll notice that the above approach to childrearing is pretty weird\[...\] It's in fact _okay_ for behavior to be momentarily incentivized in childhood that you would not want to see optimized in adulthood! \[...\] It's just not a good model of a growing human to see them as a path-independent search over policies that you have to be perfectly cautious about _ever, even temporarily,_ incentivizing in a way you wouldn't want to see intelligently optimized. Indeed, ignoring that young people can _actively steer away_ from events that would change who they are and what they'd care about means prematurely giving up on most viable childrearing schemes! You'd be ill-advised as a new father if someone started you off explaining that a child is a search run over algorithms incentivized by the environment, rather than by foregrounding the theory of human inductive biases and human flavors of path-dependent aging.

**As best I can tell, human values have never arisen via the optimization of a hard-to-game outer criterion which specifies their final form. That doesn’t _necessarily_ imply that human values can’t arise in such a way—although I have separately argued that they won’t—but it’s a clue.**

## Why does it matter how alignment works in people?

Suppose we came up with outer/inner alignment as a frame on AI alignment. Then we realized that people _do_ seem to contain an “outer objective”—neural circuitry which people _terminally want_ to optimize (i.e. the genome inner-aligns people to the circuitry) such that the neural circuitry faithfully represents the person’s motivations (i.e. the neural circuitry is an outer alignment encoding of their objective). I would react: “Huh, looks like we really have reasoned out something true and important about how alignment works. Looks like we’re on roughly the right track.”

As I have argued, this does not seem to be the world we live in. Therefore, since inferring outer/inner alignment in humans would have increased my confidence in the outer/inner frame, inferring _not_\-outer / inner must [necessarily](https://www.lesswrong.com/posts/jiBFC7DcCrZjGmZnJ/conservation-of-expected-evidence) decrease my confidence in the outer/inner frame by conservation of expected evidence.

# IV: Dialogue about inner/outer alignment

Communication is hard. Understanding is hard. Even if I fully understood what other people are trying to do (I don't), I'd still not have space to reply to every viewpoint. I’m still going to say what I think, do my best, and be honest. I expect to be importantly right, which is why I’m sharing this essay. As it stands, I’m worried about much of the alignment field and the concepts being used.

**Alex’s model of an outer alignment enjoyer**
: Outer / inner alignment is cool because it lets us decompose “what we want the agent to care about” and “how we get the agent to care about that.” This problem decomposition is natural and lets us allocate the agent’s motivations to the part we have more specification-level control over (e.g. its reward function).

**Alex**
: I don’t think it makes sense to design an agent to have an actor/grader motivational structure. [As I’ve discussed](/dont-design-agents-which-exploit-adversarial-inputs), [I think those design patterns are full of landmines](/dont-align-agents-to-evaluations-of-plans).

**Alex's model of an outer alignment enjoyer**
: I think we can recover the concept if we just let “outer alignment” be “what cognition / values should the AI have?”.

**Alex**
: That is indeed important to think about. That’s also _not_ aiming for an “outer-aligned” reward function or grading procedure. Don’t pollute the namespace—allocate different phrases to different concepts. That is, you can consider “what values should the AI have?” and _then_ “what reward function will chisel those values into the AI?”. But then we aren’t inner-aligning the agent _to the outer objective_ anymore, but rather we are producing the _desired_ _internal values_. We’re now reasoning about reward-chiseling, which I’m a big fan of.

**Alex's model of an outer alignment enjoyer**
: Right, but you have to admit that “consider what kinds of objectives are safe to maximize” is _highly relevant_ to “what do we want the AI to end up doing for us?”. As you just agreed, we obviously want to understand that.

: (And yes, _maximization_. Just look at the coherence theorems spotlighting expected utility maximization as the thing which non-stupid real-world agents do! Unless you think we won’t get an EU maximizer?)

**Alex**
: Compared to “what reward signal-generators are safe to optimize?”, it’s _far_ _more_ reasonable to consider “what broad-strokes _utility_ function should the AI optimize?”. Even so, there are [_tons_](https://www.readthesequences.com/The-Hidden-Complexity-Of-Wishes) of [skulls](https://arbital.com/p/diamond_maximizer/) along that path. We just suck at coming up with utility functions which are safe to maximize, for [generalizable reasons](/dont-design-agents-which-exploit-adversarial-inputs). Why should a modern alignment researcher spend an additional increment of time thinking about _that_ question, instead of other questions? Do you think that we’ll _finally_ find the clever utility function/grading procedure which is robust against adversarial optimization? I think it’s wiser to simply avoid design patterns which pit you against a superintelligence’s adversarial optimization pressure.

: (And I don’t think you’ll get a meaningfully viewable-as-bounded-EU-maximizer [until late in the agent’s developmental timeline](/a-shot-at-the-diamond-alignment-problem#The-values-handshake). That might be an important modeling consideration. Be careful to distinguish asymptotic limits from finite-time results.)

**Alex's model of an outer alignment enjoyer**
: Seriously? It would be real progress to solve the outer alignment problem in terms of writing down a utility function over universe-histories which is safe to maximize. For example, suppose we learned that if the utility function penalizes the agent for gaining more than _X_ power for >1 year (in some formally specifiable sense) would bound the risk from that AI, making it easier to get AIs which do pivotal acts without keeping power forever. Then we learn something about the properties we might aim to chisel into the AI’s inner cognition, in order to come out alive on the other side of AGI.

**Alex**
: First, note that your argument is for finding a safe-to-maximize _utility function over universe histories_, which is not the same as the historically prioritized _reward-outer-alignment_. Second, not only do I think that your hope won’t happen, I think the hope is written in an ontology which doesn’t make sense.

: Here’s a non-strict analogy which hopefully expresses some of my unease. Your hope feels like saying, “If I could examine the set of physically valid universe-histories in which I go hiking tonight, I’d have learned something about where I might trip and fall during the hike.” Like, sure? But why would I want to examine _that_ mathematical object in order to not trip during the hike? Sure seems inefficient and hard to parse.

: I agree that “What decision-making influences should we develop inside the AI?” is a hugely important question. I just don’t think that “what utility functions are safe to maximize?” is a sensible way to approach that question.

**Alex's model of an outer alignment enjoyer**
: Even though we probably won’t discover a compact specification of a utility function which is _strictly and literally safe to literally maximize_, there are _degrees_ of safety when a real-world agent optimizes an objective. Two objectives may be gameable, but one can still be _less_ gameable than the other.

**Alex**
: Sure seems like that in the outer/inner paradigm, those “degrees of safety” are irrelevant in the limit, as their imperfections burst under the strain of strong optimization. (Aren’t _you_ supposed to be the discussant operating that paradigm, Alex's model of an outer alignment enjoyer?)

**Alex's model of an outer alignment enjoyer**
: I don’t see how you aren’t basically giving up on figuring out what the AI should be doing.

**Alex**
: Giving up? No! _Thinking about “what utility function over universe-histories is good?” is just one way of framing “How can we sculpt an AI’s internal cognition so that it stops the world from blowing up due to unaligned AI?”._ If you live and breathe the inner/outer alignment frame, you’re missing out on better framings and ontologies for alignment! To excerpt from [_Project Lawful_](https://www.projectlawful.com/):

: > The difficult thing, in most pre-paradigmatic and confused problems at the beginning of some Science, is not coming up with the right complicated long sentence in a language you already know. It's breaking out of the language in which every hypothesis you can write is false. \[...\] The warning sign that you need to 'jump-out-of-the-system' is the feeling \[of\] frustration, flailing around in the dark, trying desperate wild ideas and getting unhelpful results one after another. When you feel like that, you're probably thinking in the wrong language, or missing something fundamental, or trying to do something that is in fact impossible. Or impossible using the tools you have.

: Stop trying to write complicated long sentences in terms of outer objectives. **Just, stop**. Let’s find a new language. (Do you really think a future alignment textbook would say “And then, to everyone’s amazement, outer alignment scheme #7,513 succeeded!”)

: Now, I can legitimately point out that outer and inner alignment aren’t a good framing for alignment, _without_ offering an alternative better framing. That said, I [recently wrote](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=xwJfX45CvaKXFFtCS):[^11] [^12]

<dd>
<blockquote class="admonition quote" data-admonition="quote">
<div class="admonition-title">
    <div class="admonition-icon"></div>
  <div class="admonition-title-inner"><p>Quote</p></div>
</div>
<p>Shard theory suggests that goals are more natural to specify/inculcate in their shard forms (e.g. if around trash and a trash can, then put the trash away), and not in their (presumably) final form of globally activated optimization of a coherent utility function which is the reflective equilibrium of inter-shard value-handshakes (e.g. a utility function over the agent’s internal plan-ontology whose optimization leads to trash getting put away, among other utility-level reflections of initial shards).</p>
<p>I <em>could</em> (and <a href="/attainable-utility-preservation-scaling-to-superhuman" class="internal" data-slug="/attainable-utility-preservation-scaling-to-superhuman"><em>did</em></a>) hope that I could specify a utility function which is safe to maximize because it penalizes power-seeking. I may as well have hoped to jump off of a building and float to the ground. On my model, that’s just not how goals work in intelligent minds. If we’ve had anything at all beaten into our heads by our alignment thought experiments, it’s that <em>goals are hard to specify in their final form of utility functions.</em></p>
<p>I think it’s time to think in a different specification language.
</blockquote>
</dd>

**Alex's model of an outer alignment enjoyer**
: Bah, “shard theory of human values.” We didn’t build planes with flapping wings. Who cares if human values come from inner alignment failures—Why does that suggest that we shouldn’t solve inner alignment for AI? _AI will not be like you._

**Alex**
: Yes, it is indeed possible to selectively consider historical disanalogies which support a (potentially) desired conclusion (i.e. that outer/inner is fine). If we’re going to play reference class tennis, how about [all of the times biomimicry has worked](https://en.wikipedia.org/wiki/Biomimetics)?

: But let’s not play reference class tennis. As mentioned above, we have to obey conservation of expected evidence here.

: In worlds where inner alignment was a good and feasible approach for getting certain human-compatible values into an AI (let’s call that hypothesis class H<sub>inner-align</sub>), I think that we would expect with greater probability for human values to naturally arise via inner alignment _successes_. However, in worlds where inner alignment failures are appropriate for getting human values into an AI (H<sub>fail</sub>), we would expect with greater probability for human values to naturally arise via inner alignment _failures_.

: Insofar as I have correctly inferred that human values constitute inner alignment failures on the human reward circuitry, this inference presents a decent likelihood ratio P(reality | H<sub>fail</sub>) / P(reality | H<sub>inner-align</sub>), since H<sub>fail</sub> predicts inferred reality more strongly. In turn, this implies an update towards H<sub>fail</sub> and away from H<sub>inner-align</sub>. I think it's worth considering the strength of this update (I'd guess it's around a bit or so against outer/inner), but it's definitely an update.

: I agree that there are important and substantial differences e.g. between human inductive biases and AI inductive biases. But I think that the evidential blow remains dealt against outer/inner, marginalizing over possible differences.

**Alex's model of an outer alignment enjoyer**
: On another topic—What about “the outer objective gets smarter along with the agent”?

**Alex**
: That strategy seems unwise for the target motivational structures I have in mind (e.g. "protect humanity" or "do alignment research").

<dd>
<ol>
<li><a href="#i-robust-grading-is-unnecessary-extremely-hard-and-unnatural" class="internal alias same-page-link">Section I</a> (robust grading is unnecessary): This plan requires an <a href="../dont-design-agents-which-exploit-adversarial-inputs" class="internal alias" data-slug="dont-design-agents-which-exploit-adversarial-inputs">unrealistic invariant.</a> The invariant is that the outer objective must “properly grade” every possible plan the agent is smart enough to consider. How are you possibly going to fulfill that invariant? Why would you <em>want</em> to choose a scheme where you have to fulfill such an onerous invariant? <br/><br/>For more detail on the concurrent-improvement case, see <a href="/dont-design-agents-which-exploit-adversarial-inputs#appendix-maybe-we-just" class="internal alias" data-slug="dont-design-agents-which-exploit-adversarial-inputs">the appendix</a> of <a href="../dont-design-agents-which-exploit-adversarial-inputs" class="internal alias" data-slug="dont-design-agents-which-exploit-adversarial-inputs">Don’t design agents which exploit adversarial inputs.</a></li>
<li><a href="#ii-loss-functions-chisel-circuits-into-networks" class="internal alias same-page-link">Section II</a> (loss is like a chisel) applies: You’re constraining the chisel to look like the statue. Why consider such a narrow class of approaches?</li>
<li><a href="#iii-outer-inner-just-isn-t-how-alignment-works-in-people" class="internal alias same-page-link">Section III</a> (inner/outer is anti-natural) applies: That strategy seems <em>anti-natural</em> as a way of getting cognitive work out of an agent.</li>
</ol>
</dd>

**Alex's model of an outer alignment enjoyer**
: It’s easy to talk big talk. It’s harder to propose concrete directions which aren’t, you know, _doomed_.

**Alex**
: The point isn’t that I have some even _more amazing and complicated scheme_ which avoids these problems. The point is that I don’t need one. In the void left by outer/inner, many objections and reasons for doom no longer apply (as a matter [of _anticipation_](https://www.lesswrong.com/posts/rauMEna2ddf26BqiE/alignment-allows-nonrobust-decision-influences-and-doesn-t?commentId=5Kn3SgoGdL3h5zg2D) and not of the problems just popping up in a different language).

: In this void, _you should reconsider all fruits which may have grown from the outer/inner frame_. Scrutinize both your reasons for optimism (e.g. “maybe it’s simpler to just point to the outer objective”) and for pessimism (e.g. “if the graders are exploitable by the AI, the proposal fails”). See alignment with fresh eyes for a while. Think for yourself.

: In this void, I wrote [_Seriously, what goes wrong with "reward the agent when it makes you smile"?_](/questioning-why-simple-alignment-plan-fails):

: > My mood \[in this post\] isn't "And this is what we do for alignment, let's relax." My mood is "Why consider super-complicated reward and feedback schemes when, as far as I can tell, we don't know what's going to happen in this relatively simple scheme? [How do reinforcement schedules map into inner values](https://www.lesswrong.com/posts/xqkGmfikqapbJ2YMj/shard-theory-an-overview)?"

: If you’re considering “reward on smile” from an outer alignment frame, then _obviously_ it’s doomed. But from the reward-as-chisel frame, not so fast. For that scheme to be doomed, it would have to be true that, for every probable sequence of cognitive updates we can provide the agent via smile-reward events, those updates would not build up into value shards which care about people and want to protect them. That scheme’s doom is not at all clear to me.

: One objection is “Ignorance of failure is no protection at all. We need a tight story for why AI goes _well._” Well, yeah. I’m just saying “in the absence of outer/inner, it doesn’t make sense to start debating hyper-complicated reward chisels like [debate](https://arxiv.org/abs/1805.00899) or [recursive reward modeling](https://arxiv.org/abs/1811.07871), if we still can’t even adjudicate what happens for ‘reward on smile.’ And, there seems to be misplaced emphasis on ‘objective robustness’, when really we’re trying to get good results from loss-chiseling.”

**Alex's model of an outer alignment enjoyer**
: Suppose I agreed. Suppose I just dropped outer/inner. What next?

**Alex**
: Then you would have the rare opportunity to pause and think while floating freely between agendas. I will, for the moment, [hold off on proposing solutions](https://www.readthesequences.com/Hold-Off-On-Proposing-Solutions). Even if my proposal is good, discussing it _now_ would rob us of insights you could have contributed as well. There will be a shard theory research agenda post which will advocate for itself, in due time.

**Alex's model of an outer alignment enjoyer, different conversational branch.**
: We know how to control reward functions to a much greater extent than we know how to control an AI’s learned value shards.

**Alex**
: This is true. And?

**Alex's model of an outer alignment enjoyer**
: I feel like you’re just ignoring the crushing amount of RL research on regret bounds and a moderate amount of research on [the expressivity of reward functions](https://www.deepmind.com/blog/on-the-expressivity-of-markov-reward) and [how to shape reward while preserving the optimal policy set](https://scholar.google.com/scholar?cluster=16007119379407281329&hl=en&as_sd$t=7$,39). Literally _I_ have proven a theorem[^13] constructively showing how to transfer an optimal policy set from one discount rate to another. We know how to talk about these quantities. Are you seriously suggesting just tossing that out?

**Alex**
: Yes, toss it out, that stuff doesn't seem helpful for alignment thinking—including that theorem we were so proud of! Yes, toss it out, in the sense of relinquishing the ill-advised hope of outer alignment. Knowing how to talk about a quantity (reward-optimality) doesn’t mean it’s the most appropriate quantity to consider.

**Alex's model of an outer alignment enjoyer**
: Consider _this_: Obviously we want to reward the agent for doing good things (like making someone smile) and penalize it for doing bad things (like hurting people). This frame is historically, empirically useful for getting good behavior out of AI.

**Alex**
: First, we have _not_ solved AI alignment in the inner/outer paradigm—even for _seemingly simple objectives like diamond production and strawberry duplication_—despite brilliant people thinking in that frame for years. That is weak evidence against it being a good paradigm.

: Second, I agree that all else equal, it’s better to reward and penalize the agent for obvious good and bad things, respectively. But not _because_ the reward function is supposed to represent what I want. As I explained, the reward function is like a chisel. If I reward the agent when it makes me smile, all else equal, that’s probably going to upweight and generalize at least _some_ contextual values upstream of making me smile. That reward scheme should differentially upweight and strengthen human-compatible cognition to some extent.

: Since reward/loss is _actually the chisel according to the math of cognition-updating in the most relevant-seeming approaches_, insofar as your suggestion is good, it is good _because it can be justified via cognition-chiseling reasons._ Your basic suggestion might not be enough for alignment success, but it’s an important part of our best current guess about what to do.

: More broadly, I perceive a motte and bailey:

<dd>
<ul>
<li><em>Bailey</em>: We should solve outer alignment by specifying a reward signal which can’t reasonably be gamed and which expresses what we want ／is aligned with our values. This reward signal should return good outputs far outside of the normal distribution of human experience, such that it doesn’t have bad maxima.</li>
<li><em>Motte</em>: All else equal, it’s better to reward the agent for doing good things (like making someone smile) and to penalize it for doing bad things (like hurting people).</li>
</ul>
</dd>

<dd>I think that the bailey is wrong and the motte is right.</dd>

**Alex's model of an outer alignment enjoyer**
: You keep wanting to focus on the “quantum mechanics” of loss-as-chisel. I agree that, in principle, if we really knew what we were doing—if we deeply understood SGD dynamics—we could skillfully ensure the network generalizes in the desired way (e.g. makes diamonds). You criticize the “skulls” visible on the “robust grader” research paths, while seemingly ignoring the skulls dotting the “just understand SGD” paths.

**Alex**
: I, at the least, agree that we aren’t going to get a precise theory like “If you initialize _this_ architecture and scale of foundation model on _this_ kind of corpus via self-supervised learning, it will contain a diamond concept with high probability; if you finetune on _this_ kind of task, it will hook up its primary decision-influences to the diamond-abstraction; …”. That seems possible to understand given enough time, but I doubt we’ll have that much time before the rubber hits the road.

: However, I’d be more sympathetic to this concern if there wasn’t a bunch of easy progress to be had from simply realizing that loss-as-chisel _exists_, and then trying to analyze the dynamics anyways. (See basically everything I’ve written since this spring. Most of my insights have been enabled by my unusually strong desire to think mechanistically and precisely about what _actually happens_ during a learning process.)

: One thing which would make me more pessimistic about the “understand how loss chisels cognition into agents” project is if I don’t, within about a year’s time, have empirically verified loss-as-chisel insights which wouldn’t have happened without that frame. But even if so, everything we're doing will still be governed by loss-as-chisel. [We can't ignore it and make it go away](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed#33QLQScBqFHfJyfLA).

**Alex's model of an outer alignment enjoyer**
: But if we do inner alignment, we _don’t_ have to understand SGD dynamics to the same extent that we do to chisel in diamond-producing values.

**Alex**
: I don’t know why you think that. (I don't even understand enough yet to agree or disagree in detail; I currently disagree in expectation over probable answers.)

: What, exactly, are we chiseling in order to produce an inner-aligned network? How do we know we can chisel agents into that shape, if we don’t understand chiseling? What do we think we know, and how do we think we know it? **How is an inner-aligned diamond-producing agent supposed to be structured?**
: This is not a rhetorical question. I literally do not understand what the internal cognition is supposed to look like for an inner-aligned agent. Most of what I’ve read has been vague, on the level of “an inner-aligned agent cares about optimizing the outer objective.”

: Charles Foster comments:

: > We are attempting to mechanistically explain how an agent makes decisions. One proposed reduction is that inside the agent, there is an even **smaller** inner agent that interacts with a non-agential evaluative submodule to make decisions for the outer agent. But that raises the immediate questions of "How does the inner agent make its decisions about how to interact with the evaluative submodule?" and then "At some point, there's gotta be some non-agential causal structure that is responsible for **actually implementing decision-making**, right?" and then "Can we just explain the original agent's behavior in those terms? What is positing an externalized evaluative submodule buying us?"

: Perhaps my emphasis on mechanistic reasoning and my [unusual](/shard-theory) [level](/a-shot-at-the-diamond-alignment-problem) [of](/dont-align-agents-to-evaluations-of-plans#Grader-optimization-planning) [precision](/against-inner-outer-alignment#Appendix-B-RL-reductionism) in my speculation about AI internals, perhaps these make people realize how _complicated_ realistic cognition is in the shard picture. Perhaps people realize [how much might have to go right](https://www.lesswrong.com/posts/krHDNc7cDvfEL8z9a/niceness-is-unnatural), how many algorithmic details may need to be etched into a network so that it does what we want and generalizes well.

: But perhaps people don’t realize that a network which is inner-aligned on an objective will _also_ require a precise and conforming internal structure, and they don’t realize this because [no one has written detailed plausible stabs at inner-aligned cognition](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=eegBBj4kBsAk57utv).

**Alex's model of an outer alignment enjoyer**
: Just because the chisel frame is technically accurate doesn’t mean it’s the most pragmatically appropriate frame. The outer alignment frame can abstract over the details of cognition-chiseling and save us time in designing good chiseling-schemes. For example, I can just reward the AI when it wins the game of chess, and not worry about designing reward schedules according to my own (poor) understanding of chess and what chess-shards to upweight.

**Alex**
: I agree that sometimes you should just think about directly incentivizing the outcomes and letting RL figure out the rest; I think that [your chess example is quite good](https://assets.turntrout.com/static/images/posts/F6O98QA.avif)! Chess is fully observable and has a crisply defined, algorithmically gradable win condition. Don’t worry about “if I reward for taking a queen, what kind of cognition will that chisel?”—just reinforce the network for winning.

: However, is the “reward outcomes based on their ‘goodness’” frame _truly_ the most appropriate frame for AGI? If that _were_ true, how would we know? I mean—_gestures at probability theory intuitions_—however outer alignment-like concepts entered the alignment consciousness, it was not (as best I can discern) _because_ outer alignment concepts are optimally efficient for understanding how to chisel good cognition into agents.[^14] Am I now to believe that, _coincidentally,_ this outer alignment frame is _also_ the most appropriate abstraction for understanding how to e.g. chisel diamond-producing values into policy networks? How fortuitous!

**Alex's model of an outer alignment enjoyer**
: Are you saying it's never appropriate to consider outer/inner, then?

**Alex**
: I think that the terminology and frame are unhelpful. At least, I feel drastically less confused in my new primary frame, and people have told me my explanations are quite clear and focused in ways which I think relate to my new frame.

: In e.g. the chess example, though, it seems fine to adopt the "Newtonian mechanics" optimized-for-reward view on deep learning. Reward the agent for things you want to happen, in that setting. Just don't forget what's _really_ going on, deeper down.

**Alex's model of an outer alignment enjoyer**
: Even if the inner/outer alignment problem isn’t literally solvable in literal reality, it can still guide us to good ideas.

**Alex**
: Many things can guide us to good ideas. Be careful not to privilege a hypothesis which was initially elevated to consideration for reasons you may no longer believe!

# Conclusion

Inner and outer alignment decompose one hard problem (AI alignment) into two _extremely_ hard problems. These problems go against natural grains of cognition, so it’s unsurprising that alignment has seemed extremely difficult and unnatural. Alignment still seems difficult to me, but [not because e.g. we have to robustly grade plans in which superintelligences are trying to trick us](/dont-design-agents-which-exploit-adversarial-inputs). Summarizing my arguments:

1. **Robust grading is extremely difficult and also unnecessary.** The answer is not to find a clever way to get a robust outer objective. The answer is to not _need_ a robust outer objective. If you find yourself trying to grade arbitrary-case outputs from an unaligned superintelligence, you probably framed the problem wrongly by using robust-grading design patterns.
2. **The loss function chisels cognition into the AI.**
3. **If you aim to “solve” inner or outer alignment, you are ruling out the only empirically known way to form human-compatible values.**

I think that “but what about applying optimization pressure to the base objective?” has warped lots of alignment thinking. You [don’t need an “extremely hard to exploit” base objective](/alignment-without-total-robustness). That’s a distraction.

Stepping away from the worldview in which outer/inner is a reasonable frame, a range of possibilities open up, and the alignment problem takes on a refreshing and different nature. We need to _understand how to develop good kinds of cognition in the networks we train_ (e.g. how to supply a curriculum and reward function such that the ensuing stream of cognitive-updates leads to an agent which cares about and protects us). At our current level of understanding, _that’s_ the bottleneck to solving technical alignment.

# Appendix A: Additional definitions of “outer/inner alignment”

Here are a few more definitions, for reference on how the term has been historically defined and used.

## Evan’s definitions

> [!quote] Evan Hubinger, [commenting](https://www.lesswrong.com/posts/HYERofGZE6j9Tuigi/inner-alignment-failures-which-are-actually-outer-alignment?commentId=o8pvzqmnm5DZhy2xa) on ["Inner Alignment Failures" Which Are Actually Outer Alignment Failures](https://www.lesswrong.com/posts/HYERofGZE6j9Tuigi/inner-alignment-failures-which-are-actually-outer-alignment)
>
> “[My definition](https://www.lesswrong.com/posts/33EKjmAdKFn3pbKPJ/outer-alignment-and-imitative-amplification) says that an objective function _\[P\]_ is outer aligned if all models optimal under _\[P\]_ in the limit of perfect optimization and unlimited data are aligned.”

I will note that the human reward circuitry is not outer-aligned to human values under this definition, since people who experience the “data” of wireheading will no longer have their old values.

Anyways, it’s not clear what this definition means in the RL setting, where high path-dependence occurs due to the dependence of the future policy on the future training data, which in turn depends on the current policy, which depended on the past training data. For example, if you like candy and forswear dentists (and also forswear ever updating yourself so that you will go see the dentist), you will never collect reward data from the dentist’s office, and vice versa. One interpretation of the definition is "infinite exploration of all possible state-action tuples", but I don’t know what that means in reality (which is neither ergodic nor fully observable). I also don’t know the relative proportions of the “infinite data.”

Evan privately provided another definition which better accounts for the way he currently considers the problem of outer+inner alignment:

> A model that has the same goal that the loss/reward function describes. So if the loss function rewards agents for getting gold coins, then the training goal is an agent that terminally cares about gold coins.

I then wrote a dialogue with my model of him, which he affirmed as “a pretty reasonable representation.”

**Alex**
: Hm. OK. So it sounds like the outer objective is less of something which grades the agent directly across all situations, and which is safe to optimize _for._ Under your operationalization of the outer alignment training goal, the reward function is more like an artifact which emits reward on training in a way which tightly correlates with getting gold coins on training.

: Suppose I have an embodied AI I’m training via RL (for conceptual simplicity, not realism), and it navigates mazes and reaches a gold coin at the end of each maze. I’ll just watch the agent through one-way glass and see if it looks like it touched the gold coin by legit solving the maze. If it does, I hit the reward button.

: Now suppose that this in fact just trains a smart AI which “terminally cares” about gold coins, operationalized in the “values as policy-influences” sense: In all realistically attainable situations where the AI believes there are gold coins nearby, the AI reliably reaches the gold coin. The AI doesn’t go to yellow objects, or silver coins, or any other junk.

: So even though on training, the reward schedule was unidentifiable from “reward when a metal disk was touched”, that doesn’t matter for our training goal. We just want the AI to learn a certain kind of cognition which we “had in mind” when specifying the outer objective, and it doesn’t matter if the outer objective is “unambiguously representing” the intended goal.

**Alex’s model of Evan**
: Yup, basically.

**Alex**
: OK. So in this scenario, though, the actual reward-generating process would in fact be foolable by an AI which replaces the window with an extremely convincing display which showed me a video which made me believe it got gold coins, even though it was actually touching a secret silver coin in the real room. The existence of that adversarial input isn’t a problem, because in this story, we aren’t trying to get the AI to directly optimize the reward-generating process or any of its Cartesian transforms or whatever.

**Alex's model of Evan**
: Well, I guess? If you _assume_ you get the gold-coin AI, you can satisfy the story with such an underdetermined and unhardened outer objective. But I expect in reality you need to supply more reward data to rule out e.g. silver coins, and possibly to disincentivize deception during training. See the RLHF + camera-duping incident.

: So I think the answer is “technically no you don’t _have_ to worry about adversarial inputs to the grading procedure on this definition, but in reality I think you should.”

**Alex**
: I think we’re going to have a separate disagreement on that camera incident which isn’t related to this decomposition, so I’ll just move past that for the moment. If this is the perspective, I don’t disagree with it as much as “have the objective represent what you want as faithfully as possible, maybe even exactly, such that the outer objective is good to optimize for.”

: I think that this decomposition is actually compatible with some shard theory stories, even. It feels like this outer alignment definition is actually pretty lax. It feels more like saying “I want to write down an objective which appears to me to ‘encode’ gold coin-grabbing, and then have that objective entrain a gold coin value in the agent.” And, for chisel = statue reasons, the levers for inner alignment would then have to come from inductive biases (speed / complexity / hyperparameters / whatever), and not the actual feedback signals (which are kinda fixed to match the “represent the gold coin objective”).

## Daniel Ziegler’s working definitions

I recently spoke with Daniel Ziegler about one frame he uses for alignment, which he described as inspired by Christiano’s [Low-stakes alignment](https://www.lesswrong.com/posts/TPan9sQFuPP6jgEJo/low-stakes-alignment), and relating to outer/inner alignment. Here’s my summary:

> I think about getting two main guarantees. First, that we can evaluate and grade every possible training situation which the AI can understand (this roughly maps onto “outer alignment”). Second, that the AI output an (at least) adequate / non-catastrophic decision in every possible deployment situation (this roughly maps onto “inner alignment”).

I don’t think we need robust grading in every possible _training_ situation; it seems to me like early and mid-training will be far more important for chiseling values into the AI. I’m less worried about evaluating late-training situations where the AI is already superintelligent. I also don’t think we need robust adequacy. There probably has never ever existed a human which behaves adequately in every possible situation. Probably Gandhi goes on a killing spree in _some_ situation.

I’m more concerned about on-trajectory properties—make the AI nice to begin with, make it want to keep being nice in the future, and I don’t worry about off-trajectory bad situations it won’t even want to enter. If the AI thought “I’m nice now but won’t be nice later”, wouldn’t the AI take action of its own accord to head off that event, which would be bad by its own values?

I worry that absolute robustness is an unnatural cognitive property, which is also not necessary, and that certain attempts to achieve it could even worsen alignment properties. As one concrete (but mostly theoretical) concern, adversarial training [might make an initially nice AI, less nice / aligned](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=b8vuFQDxMNzybwWSZ):

> [!quote]
>
> **A problem with adversarial training.** One heuristic I like to use is: "What would happen if I initialized a human-aligned model and then trained it with my training process?"
>
> So, let's consider such a model, which cares about people (i.e. reliably pulls itself into futures where the people around it are kept safe). Suppose we also have some great adversarial training technique, such that we have e.g. a generative model which produces situations where the AI would break out of the lab without permission from its overseers. Then we run this procedure, update the AI by applying gradients calculated from penalties applied to its actions in that adversarially-generated context, and... profit?
>
> What actually happens with the aligned AI? Possibly something like:
>
> 1. The context makes the AI spuriously believe someone is dying outside the lab, and that if the AI asked for permission to leave, the person would die.
> 2. Therefore, the AI leaves without permission.
> 3. The update procedure penalizes these lines of computation, such that in similar situations in the future (i.e. the AI thinks someone nearby is dying) the AI is less likely to take those actions (i.e. leaving to help the person).
> 4. We have made the aligned AI _less_ aligned.
>
> I don't know if anyone's written about this. But on my understanding of the issue, there's one possible failure mode of viewing adversarial training as ruling out bad behaviors _themselves_. But (non-tabular) RL isn't like playing whack-a-mole on bad actions, [RL's credit assignment changes the general values and cognition within the AI](/reward-is-not-the-optimization-target). And with every procedure we propose, the most important part is _what cognition will be grown from the cognitive updates accrued under the proposed procedure_.

EDIT: This is less "don't do adversarial training", and more "I have some intuitions there are subtle costs and difficulties to demanding extreme robustness from a system."

## Outer alignment on physical reward is impossible

Consider the following definitions:

> [!quote]
>
> **Outer alignment<sub>literal</sub>:** Specify a real-world number-generating procedure _P_ which only produces high numbers if “good things are happening”, in some reasonable sense.
>
> **Inner alignment with** _**P**_**:** Ensure the AI primarily cares about optimizing _P_’s output, in some reasonable sense.

_Unsolvability of outer alignment<sub>literal</sub>._ Any outer objective _P_ must be implemented within the real world. Suppose that _P_ reliably produces huge numbers in worlds where the AI is doing what we want. But then the number produced by _P_ can be further increased by just modifying the physically implemented output.

So, for any agent with a sufficiently rich action space (so that it can affect the world over time), any search for maximal _P_\-outputs yields tampering (or something else, not related to what we want, which yields even greater outputs).[^16]

# Appendix B: RL reductionism

A bunch of alignment thinking seems quite airy, detached from step-by-step mechanistic thinking. I think there are substantial gains to thinking more precisely. I sometimes drop levels of abstraction to view NN training as a physical process which imperfectly shadows the nominal PyTorch code, which itself imperfectly shadows the mathematical learning algorithms (e.g. SGD under certain sampling assumptions on minibatches), which itself is imperfectly abstracted by rules like "loss as chisel", which itself is _sometimes_ abstractable as "networks get trained to basically minimize loss / maximize reward on a certain distribution."

Consider what happens when you train a deep Q-learning network on Pac-Man. I'll start with reward-as-chisel, but then take a slightly more physical interpretation.

1. **Reward as chisel, detailed analysis.** When we initialize the Q-network and begin training, the reward function provides a sequence of cognitive updates to the physically instantiated network, as mediated by mini-batches empirical data distribution gathered under the policy defined by the relevant Q-values.
    1. That is, the network explores and bumps into ghosts (negative reward) and into dots (positive reward). The network learns to predict different Q-values for actions which historically led to ghost-events, compared to those which e.g. led to dots. The network’s numbers behave differently in the presence of different relevant observables, and so SGD is entraining some kind of contextual computations into the network.
    2. Each TD error is computed, and, through a corresponding gradient, updates the Q-network’s computational structures so as to generalize its Q-value estimates _slightly_ differently.
    3. Run out long enough and due to the exploration properties of the Pac-Man task, the network chains its predictions together and learns to predict high values for actions which do in fact allow the network to survive and eat dots.
    4. As a side note, the agent may indeed “achieve high cognitive-update-intensity (i.e. “reward”)” for game screens which are mechanically and perceptually similar relative to the computations run inside the network (e.g. there are still walls and mazes and arrangements of ghosts, if that’s how the network in fact makes decisions).
2. **Physical reward instantiation model**: But _really,_ “reward function” is _itself_ an abstraction. There is no reward function, in reality. There is simply a sequence of state-modifications which, for convenience, we often abstract as “temporal difference updates on the Q-value predictor, taken over a mini-batch drawn from the action replay buffer.”
    1. These modifications are spurred by a sequence of _sampled “reward events”_, which are really just the physical outputs of the part of the computer we abstract as the “reward function calculator”, which then gets fed into the gradients. But the network never sees the reward, or the reward function. We could overwrite and restore the reward function’s implementation, between each update step, and it wouldn’t matter to the trained network.
    2. Similarly, ask not whether the reward function is “stationary”, ask what cognition the sequence of reward-events entrains into the network.
    3. In a strict causal sense, the physical reward function only matters insofar as it updates the physically implemented network, and the updates only matter insofar as they affect generalization behavior in ways we care about (e.g. does the network output good alignment research). The reward function has no metaphysical or special status. It’s just another part of the physical apparatus.

[^1]: In comments on an earlier draft of this post, Paul clarified that the reward doesn’t have to _exactly_ capture the \[expected\] utility of deploying a system or of taking an action, but just e.g. correlate on reachable states such that the agent can’t predict deviations between reward and human-\[expected\] utility.
[^2]: Agreed.
[^3]: I’m not claiming this is Paul’s favorite alignment plan, I can’t speak for him. However, I do perceive most alignment plans to contain many/all of: 1) robust grading, 2) “the chisel must look like the statue”, and 3) aligning the AI to a grading procedure.
[^4]:
    I am by no means the first to consider whether the outer/inner frame is inappropriate for many situations. Evan Hubinger [wrote](https://www.lesswrong.com/posts/FDJnZt8Ks2djouQTZ/how-do-we-become-confident-in-the-safety-of-a-machine):

    > It’s worth pointing out how phrasing inner and outer alignment in terms of training stories makes clear what I think was our biggest mistake in formulating that terminology, which is that inner/outer alignment presumes that the right way to build an aligned model is to find an aligned loss function and then have a training goal of finding a model that optimizes for that loss function.

[^5]: In this essay, I focus on the case where the outer objective’s domain is the space of possible plans. However, similar critiques hold for grading procedures which grade world-states or universe-histories.
[^6]: The truth is that I don't yet know what goes on in more complicated and sophisticated shard dynamics. I doubt, though, that grader-optimization and value-optimization present _the same_ set of risk profiles (via e.g. Goodhart and nearest unblocked strategy), which _coincidentally_ derive from different initial premises via different cognitive dynamics. ["It’s improbable that you used mistaken reasoning, yet made no mistakes."](https://www.readthesequences.com/Fake-Justification)
[^7]:
    [Outer/inner fails to describe/explain how GPT-3 works](https://www.lesswrong.com/posts/Nq58w4SiZMjHdAPaX/what-exactly-is-gpt-3-s-base-objective), or [to prescribe how we would want it to work](https://www.lesswrong.com/posts/vJFdjigzmcXMhNTsx/simulators) (“should GPT-3 really minimize predictive loss over time?” seems like a Wrong Question). Quintin wrote in private communication:

    > GPT-3’s outer "objective" is to minimize predictive error, and that’s the only thing it was ever trained on, but GPT-3 itself doesn’t "want" to minimize its predictive error. E.g., it’s easy to prompt GPT-3 to act contrary to its outer objective as part of some active learning setup where GPT-3 selects hard examples for future training. Such a scenario leads to GPT-3 taking actions that systematically fail to minimize predictive error, and is thus not inner aligned to that objective.

[^8]: This point is somewhat confounded because humans “backchain” reward prediction errors, such that a rewarding activity bleeds rewardingness onto correlated activities (in the literature, see the related claim: “primary reinforcers create secondary reinforcers”). For example, in late 2020, I played [_Untitled Goose Game_](https://en.wikipedia.org/wiki/Untitled_Goose_Game) with my girlfriend. My affection for my girlfriend spilled over onto a newfound affection for geese, and now (I infer that) it’s rewarding for me to even think about geese, even though I started off ambivalent towards them. So, I infer that there’s a big strong correlation between “things you value and choose to pursue” and “mental events you have learned to find rewarding.”
[^9]: I don’t actually think in terms of “inner alignment failures” anymore, but I’m writing this way for communication purposes.
[^10]: The [original abstract](https://scholar.google.com/scholar?cluster=17534501209842642441&hl=en&as_sd$t=7$,39) begins: “A 48-year-old woman with a stimulating electrode implanted in the right thalamic nucleus ventralis posterolateralis developed compulsive self-stimulation associated with erotic sensations and changes in autonomic and neurologic function.”
[^11]: I think the shard frame is way better than the utility function frame because of reasons like “I can tell [detailed](/a-shot-at-the-diamond-alignment-problem) stories for how an agent ends up putting trash away or producing diamonds in the shard frame, and I can’t do that at all in the utility frame.” That said, I’m still only moderate-strength claiming “the shard frame is better for specifying what kind of AI cognition is safe” because I haven’t yet written out positive mechanistic stories which spitball what kinds of shard-compositions lead to safe outcomes. I am, on the other hand, _quite confident_ that outer/inner is inappropriate.
[^12]:
    The coherence theorems can pin down “EU maximization” all you please, but they don’t pin down the domain of the utility functions. They don’t dictate what you have to be coherent over, when trading off lotteries. I [commented](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=cuTotpjqYkgcwnghp):

    > 80% credence: It's hard to train an inner agent which reflectively equilibrates to an EU maximizer only over commonly postulated motivating quantities (like `# of diamonds` or `# of happy people` or `reward-signal`) and not quantities like (`# of times I have to look at a cube in a blue room` or `-1 * subjective micromorts accrued`).
    >
    > Intuitions:
    >
    > \- I expect contextually activated heuristics to be the default, and that agents will learn lots of such contextual values which don't cash out to being strictly about diamonds or people, even if the overall agent is mostly motivated in terms of diamonds or people.
    >
    > \- Agents might also "terminalize" instrumental subgoals by caching computations (e.g. cache the heuristic that dying is bad, without recalculating from first principles for every plan in which you might die).
    >
    > Therefore, I expect this value-spread to be convergently hard to avoid.

    And so it goes for human values. If human values tend to equilibrate to utility functions which factorize into factors like `-1 * subjective micromorts` or `# of times I tell a joke around my friends`, but you think that the former is “just instrumental” and the latter is “too contextual”, you’re working in the wrong specification language.

    Another difficulty to “just produce diamonds” is it assumes a singular shard (diamond-production), which seems anti-natural. Just [look at people](/humans-provide-alignment-evidence) and [their multitudes of shards](/shard-theory)! I think we should not go against suspected grains of cognition formation.

[^13]: Proposition E.30 of [Optimal Policies Tend to Seek Power](https://arxiv.org/abs/1912.01683).
[^14]: RL practitioners _do in fact_ tend to reward agents for doing good things and penalize them for doing bad things. The prevalence of this practice _is_ some evidence for “rewarding based on goodness is useful for chiseling policies which do what you want.” But this evidence seems tamped down somewhat because “reward optimization” was a prevalent idea in RL theory well before deep reinforcement learning really took off. Just look at control theory back in the 1950’s, where control systems were supposed to optimize a performance metric over time (reward/cost). This led to Bellman’s optimality equations and MDP theory, with all of its focus on reward as the optimization target. Which probably led to modern-day deep RL retaining its focus of rewarding good outcomes & penalizing bad outcomes.

[^16]: This argument works even if _P_ originally penalizes tampering actions. Suppose the agent is grading itself for the average output of the procedure over time (or sum-time-discounted with 𝛾 ≈ 1, or the score at some late future time step, or whatever else; argument should still go through). Then penalizing tampering actions will decrease that average. But since the penalties only apply for a relatively small number of early time steps, the penalties will get drowned out by the benefits of modifying the _P_\-procedure.
