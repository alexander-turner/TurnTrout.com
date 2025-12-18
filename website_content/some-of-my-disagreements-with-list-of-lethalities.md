---
permalink: disagreements-with-list-of-lethalities
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/kpFxkXBbpF5pWDRrc/some-of-my-disagreements-with-list-of-lethalities
lw-is-question: 'false'
lw-posted-at: 2023-01-24T00:25:28.075000Z
lw-last-modification: 2024-01-09T22:19:49.662000Z
lw-curation-date: None
lw-frontpage-date: 2023-01-24T01:32:13.815000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 7
lw-base-score: 68
lw-vote-count: 19
af-base-score: 33
af-num-comments-on-upload: 4
title: Some of my disagreements with List of Lethalities
lw-latest-edit: 2024-01-09T22:19:50.402000Z
lw-is-linkpost: 'false'
tags:
  - AI
aliases:
  - some-of-my-disagreements-with-list-of-lethalities
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2023-01-24 00:00:00
original_url: https://www.lesswrong.com/posts/kpFxkXBbpF5pWDRrc/some-of-my-disagreements-with-list-of-lethalities
skip_import: true
description: A critical look at the idea of "lethal" AI failures, challenging common assumptions about reward functions, alignment, and the limits of human values.
date_updated: 2025-12-18 09:42:00.251916
---












This was an appendix of [Inner and outer alignment decompose one hard problem into two extremely hard problems](/against-inner-outer-alignment). However, I think the material is self-contained and worth sharing separately, especially since [AGI Ruin: A List of Lethalities](https://www.lesswrong.com/posts/uMQ3cqWDPHhjtiesc/agi-ruin-a-list-of-lethalities) has become so influential.

<hr/>

Here are some quotes with which I disagree, considering the points I made in [Inner and outer alignment decompose one hard problem into two extremely hard problems](/against-inner-outer-alignment) (consult its TL;DR and detailed summary for a refresher, if need be).

# List of "Lethalities"

## "Lethality" 16: Outer optimization "failed"

<!-- vale off -->
> “Humans don't explicitly pursue inclusive genetic fitness; outer optimization even on a very exact, very simple loss function doesn't produce inner optimization in that direction. This happens _in practice in real life,_ **it is what happened in** _**the only case we know about**_, and it seems to me that there are deep theoretical reasons to expect it to happen again”
<!-- vale on -->

(Evolution) → (human values) _is not the only case of inner alignment failure which we know about._ I have argued that [human values themselves are inner alignment failures on _the human reward system_](/against-inner-outer-alignment#Inner-alignment-seems-anti-natural). This has happened billions of times in slightly different learning setups.

<hr/>

Strictly separately, it seems to me that people draw rather strong inferences from a rather loose analogy with evolution. I think that [(evolution) → (human values) is far less informative for alignment than (human reward circuitry) → (human values)](https://www.lesswrong.com/posts/FyChg3kYG54tEN3u6/evolution-is-a-bad-analogy-for-agi-inner-alignment). I don’t agree with a strong focus on the former, given [the latter is available as a source of information](/humans-provide-alignment-evidence).

We want to draw inferences about the mapping from (AI reward circuitry) → (AI values), which is an iterative training process using reinforcement learning and self-supervised learning. Therefore, we should consider existing evidence about the (human reward circuitry) → (human values) setup, which (AFAICT) also takes place using an iterative, local update process using reinforcement learning and self-supervised learning.

Brain architecture and training is not AI architecture and training, so the evidence is going to be weakened. But for nearly every way in which (human reward circuitry) → (human values) is disanalogous to (AI reward circuitry) → (AI values), (evolution) → (human values) is even more disanalogous! For more on this, see [Quintin's post](https://www.lesswrong.com/posts/FyChg3kYG54tEN3u6/evolution-is-a-bad-analogy-for-agi-inner-alignment).

## "Lethality" 18: Reward is not ground truth

> “When you show an agent an environmental reward signal, you are not showing it something that is a reliable ground truth about whether the system did the thing you wanted it to do; _even if_ it ends up perfectly inner-aligned on that reward signal, or learning some concept that _exactly_ corresponds to 'wanting states of the environment which result in a high reward signal being sent', an AGI strongly optimizing on that signal will kill you, because **the sensory reward signal was not a ground truth about alignment (as seen by the operators).**”

My summary
: Sensory reward signals are not ground truth on the agent’s alignment to our goals. Even if you solve inner alignment, you’re still dead.

My response
: We don’t want to end up with an AI which primarily values its own reward, because then it wouldn’t value humans. Beyond that, this item is not a “[central](https://www.lesswrong.com/posts/uMQ3cqWDPHhjtiesc/agi-ruin-a-list-of-lethalities#Section_B_2___Central_difficulties_of_outer_and_inner_alignment_)” lethality (and a bunch of these central-to-EY lethalities are in fact about outer/inner). We don’t _need_ a function of sensory input which is safe to maximize, that’s not the _function_ of the reward signal. Reward chisels cognition. Reward is _not necessarily—nor do we want it to be—a ground-truth signal about alignment_.

## "Lethality" 19: Reward optimization kills you

> Insofar as the current paradigm works at all, **the on-paper design properties say that it only works for aligning on known direct functions of sense data and reward functions**. All of these kill you if optimized-over by a sufficiently powerful intelligence, because they imply strategies like 'kill everyone in the world using nanotech to strike before they know they're in a battle, and have control of your reward button forever after'. It just isn't _true_ that we know a function on webcam input such that every world with that webcam showing the right things is safe for us creatures outside the webcam. This general problem is a fact about the territory, not the map; it's a fact about the actual environment, not the particular optimizer, that lethal-to-us possibilities exist in some possible environments underlying every given sense input.

My summary
: The theory in the current paradigm only tells you how to, at best, align an agent to direct functions of sensory observables. Even if we achieve this kind of alignment, we die. It’s just a fact that sensory observables can’t discriminate between good and bad latent world-trajectories.

> [!warning]
> It seems to me that Eliezer does not deeply understand that [reward is not the optimization target](/reward-is-not-the-optimization-target).

My response
: I understand “the on-paper design properties” and “insofar as the current paradigm works at all” to represent Eliezer’s understanding of the properties and the paradigm (he _did_ describe these points as “[central difficulties of outer and inner alignment](https://www.lesswrong.com/posts/uMQ3cqWDPHhjtiesc/agi-ruin-a-list-of-lethalities#Section_B_2___Central_difficulties_of_outer_and_inner_alignment_)”[^1]). But on my view, this lethality does not seem relevant or central to alignment. Use reward to supply good cognitive updates to the agent. I don't find myself thinking about reward as that which gets maximized, or which _should_ get maximized.
:
: Also, if you ignore the [oft-repeated wrong/under-hedged claim](https://www.lesswrong.com/posts/uSdPa9nrSgmXCtdKN/concrete-experiments-in-inner-alignment?commentId=aDtza9u4zDEMt4C4a#comments) that “RL agents maximize reward” or whatever, the on-paper design properties suggest that reward aligns agents to objectives in reality according to the computations which reward reinforces. [I think that machine learning does not, in general, align agents to sense data and reward functions.](/reward-is-not-the-optimization-target) I think that focusing on the sensory-alignment question can be misleading as to the nature of the reward-chiseling challenge which we confront.
:
: It's true that we don't know that we know how to reliably make superintelligent agents learn human-compatible values. However, by the same coin (e.g. by the arguments in [reward is not the optimization target](/reward-is-not-the-optimization-target)), I can just as equally ask "how do I get agents to care about _sensory_ observables and reward data?". It's not like we know how to ensure deep learning-trained agents care about their sensory observables and reward data.

## "Lethality" 21: Claim that capabilities generalize further than alignment

<!-- vale off -->
> Lethality #21: “\[...\] hominids, once they finally started to generalize, generalized their capabilities to Moon landings, but their inner optimization no longer adhered very well to the outer-optimization goal of 'relative inclusive reproductive fitness' - even though they were in their ancestral environment optimized very strictly around this one thing and nothing else. This abstract dynamic is something you'd expect to be true about outer optimization loops on the order of both 'natural selection' and 'gradient descent'. The central result: **Capabilities generalize further than alignment once capabilities start to generalize far.**”
<!-- vale on -->

My summary
: Perceived alignment on the training distribution is all we know how to run gradients over, but historically, alignment on training _does not generalize to alignment on deployment._ Furthermore, when the agent becomes highly capable, it will gain a flood of abilities and opportunities to competently optimize whatever vaguely good-seeming internal proxy objectives we entrained into its cognition. When this happens, the AI's capabilities will keep growing, but its alignment will not.

My response

: This perceived disagreement might be important, or maybe I just use words differently than Eliezer.

: When I’m not thinking in terms of inner/outer, but “what cognition got chiseled into the AI?”, there isn’t any separate “tendency to fail to generalize alignment” in a deceptive misalignment scenario. The AI just didn’t have the cognition you thought or wanted.

: For simplicity, suppose you want the future to contain lots of bananas. Suppose you _think_ your AI cares about bananas but _actually_ it primarily cares about fruit in general and only pretended to primarily care about bananas, for instrumental reasons. Then it kills everyone and makes a ton of fruit (only some of which are bananas). In that scenario, we should have chiseled different cognition into the AI so that it would have valued bananas more strongly. (Similarly for "the AI cared about granite spheres and paperclips and...")

: While this scenario involves misgeneralization, there’s no separate tendency of “alignment shalt not generalize.”

: But suppose you _do_ get the AI to primarily care about bananas early in training, and it retains that banana value shard/decision-influencing-factor into mid-training. At this point, I think the banana-shard will convergently be motivated to steer the AI’s future training so that the AI _keeps making bananas._ So, if you get some of the early-/mid-training values to care about making bananas, then those early-/mid-values will, by instrumental convergence, reliably steer training to keep generalizing appropriately. If they did not, that would lead to fewer bananas, and the banana-shard would bid for a different path of capability gain!

: While not an airtight safety argument, I think it's a reasonably strong _a priori_ case. The main difficulty here still seems to be my already-central expected difficulty of “loss signals might chisel undesired values into the AI.”

## Eliezer seems confused about loss functions

> [!quote] Interlude in [AGI Ruin: A List of Lethalities](https://www.lesswrong.com/posts/uMQ3cqWDPHhjtiesc/agi-ruin-a-list-of-lethalities)
>
> “Okay, but as we all know, modern machine learning is like a genie where you just give it a wish, right? **Expressed as some mysterious thing called a 'loss function'**, but which is basically just equivalent to an English wish phrasing, right?”

Eliezer is mockingly imitating a naive AI alignment researcher. My current read, however, is that the bolded part represents his real view. Given that: **A loss function is not a “wish” or an expression of your desires. A loss function is a source of gradient updates, a loss function is a chisel with which to shape the agent’s cognition.**

> [!quote] Eliezer Yudkowsky
> [Alignment doesn't hit back, the loss function hits back](https://www.lesswrong.com/posts/cq5x4XDnLcBrYbb66/will-capabilities-generalise-more?commentId=wBn4JeJqAAZYqTDoH) [and **the loss function doesn't capture what you really want (e.g. because killing the humans and taking control of a reward button will max reward, deceiving human raters will increase ratings, etc). If what we wanted was exactly captured in a loss function, alignment would be easier.** Not easy because outer optimization doesn't create good inner alignment, but easier than the present case.](https://www.lesswrong.com/posts/cq5x4XDnLcBrYbb66/will-capabilities-generalise-more?commentId=wBn4JeJqAAZYqTDoH)

To me, this statement seems weird and sideways of central alignment problems. I perceive Eliezer to be arguing "If only the loss function represented what we wanted, that'd be better." If he meant to connote "loss functions simply won't represent what you want, get over it, that's not how alignment works" - then we likely agree.

My response:

1. Type error in forcing conversion from "goals" to "gradient-providing function."
2. The empirical contingency of the wisdom of the frame where the loss function "represents" the goal.

First, I want to say: [type error: _loss function_ not of type _goal_](/four-usages-of-loss-in-ai).[^2] Eliezer's writing gives me no indication that he understands this point. I think there's potential for deep confusion. Loss functions provide gradients to the way the AI thinks (i.e. computes forward passes). Trying to cast human values[^3] into a loss function is a _highly unnatural_ type conversion to attempt. Attempting to force the conversion anyways may well damage your view of the alignment problem.

> [!quote] [Four usages of "loss" in AI](/four-usages-of-loss-in-ai)
>
> **3: Loss functions "representing" goals**
>
> > I want a loss function which is aligned with the goal of "write good novels."
>
> This statement aspires to achieve some kind of correspondence between the loss function and the goal of writing good novels. But what does this statement _mean_?
>
> Suppose you tell me "I have written down a loss function $\ell_\text{novel}$ which is perfectly aligned with the goal of 'write good novels'." What experiences should this claim lead me to anticipate?
>
> 1. That an agent can only achieve low physical-loss if it has, in physical fact, written a good novel?
> 2. That in some mathematical idealization of the learning problem, loss-minimization only occurs when the agent outputs text which would be found in what we rightly consider to be "good novels"? (But in _which_ mathematical idealization?)
> 3. That, as a matter of physical fact, if you train an agent on $\ell_\text{novel}$ using learning setup $X$, then you produce a language model which can be easily prompted to output high-quality novels?
>
> Much imprecision comes from loss functions [not directly encoding goals](/reward-is-not-the-optimization-target). Loss signals are physically implemented parts of the AI's training process which (physically) update the AI's cognition in certain ways...
>
> I think that talking about loss functions being "aligned" encourages bad habits of thought at best, and is nonsensical at worst. I think it makes way more sense to say how you want the agent to think and then act (e.g. "write good novels"—the _training goal_, in Evan Hubinger's [training stories framework](https://www.lesswrong.com/posts/FDJnZt8Ks2djouQTZ/how-do-we-become-confident-in-the-safety-of-a-machine)) and why you think you can use a given loss function $\ell_\text{novel}$ to produce that cognition in the agent (the _training rationale_).

Second, we want to train a network which ends up doing what we want. Many strategies might achieve this goal.

It might shake out that, as an _empirical fact_, the best way to spend an additional increment of alignment research is to make the loss function "represent what you want" in some way. For example, you might more accurately spot flaws in AI-generated alignment proposals, and train the AI on that more accurate signal.

Even if that empirical fact held, "make the objective better 'represent' our goals" would be an _empirical contingency_, not pinned down by the _mechanistic function_ of a loss function. This contingency may be sensitive to the means by which feedback translates into gradient updates. For example, changing the loss function will probably differently affect the gradients provided by:

1. Advantage actor-critic,
2. REINFORCE,
3. Self-supervised learning with teacher forcing, and
4. Reward prediction errors.

Because [loss is not the optimization target](/reward-is-not-the-optimization-target), there's some level of "goal representation" where I should stop thinking about how "good" the loss function is, and start thinking about e.g. the abstractions learned by self-supervised pretraining. e.g. If I populate the corpus with more instances of people helping each other, that might change the inductive biases on SGD dynamics to increase the probability of helping-concepts getting hooked into value shard formation.

I think it's possible that after more deliberation, I'll conclude "we should just consider some intuitive notion of 'goal representation fidelity' when reasoning about P(alignment | loss function)." I just don't know where or whether this deliberation is supposed to have occurred. So we probably need more of it.

Because loss functions don't natively represent goals, and because of these empirical contingencies, I'm weirded out by statements like "the loss function doesn't capture what you really want."[^4]

# Other disagreements with alignment thinkers

## Evan Hubinger

> [!quote] Evan Hubinger
> [Terms like base objective or inner/outer alignment are still great terms for talking about training stories that are trying to train a model to optimize for some specified objective.](https://www.lesswrong.com/posts/Nq58w4SiZMjHdAPaX/what-exactly-is-gpt-3-s-base-objective?commentId=xQkL8kLoRpsMgvp4T#uj8xjqsPtiHqyRRi4)

Sometimes, inner/outer alignment ideas can be appropriate (e.g. chess). For aligning real-world agents in partially observable environments, I think it’s not that appropriate. (See [this more detailed discussion](/against-inner-outer-alignment#Evan-s-definitions) of what I eventually realized Evan meant.)

## Paul Christiano

> [!quote] Paul Christiano
> [There is probably no physically implemented reward function, of the kind that could be optimized with SGD, that we’d be happy for an arbitrarily smart AI to optimize as hard as possible. (**I’m most optimistic about approaches where RL is only performed on a reward function that gets smarter in parallel with the agent being trained.**)](https://www.lesswrong.com/posts/CoZhXrhpQxpy9xw9y/where-i-agree-and-disagree-with-eliezer)

I read this and think “this feels like a distraction.” I think this is not necessary because robust grading is not necessary for alignment. However, because reward provides cognitive updates, it’s important to think carefully about what cognitive updates will be provided by the reward given when e.g. a large language model submits an alignment proposal. Those reward events will shape the network’s decision-making and generalization properties, which is what we’re really interested in.

> [!quote] [_Thoughts on reward engineering_](https://www.lesswrong.com/posts/NtX7LKhCXMW2vjWx6/thoughts-on-reward-engineering#5__Sparse_reward), Paul Christiano
>
> In many problems, “almost all” possible actions are equally terrible. For example, if I want my agent to write an email, almost all possible strings are just going to be nonsense.
>
> One approach to this problem is to adjust the reward function to make it easier to satisfy — to provide a “trail of breadcrumbs” leading to high reward behaviors. I think this basic idea is important, but that changing the reward function isn’t the right way to implement it (at least conceptually).
>
> Instead we could treat the problem statement as given, but view auxiliary reward functions as a kind of “hint” that we might provide to help the algorithm figure out what to do. Early in the optimization we might mostly optimize this hint, but as optimization proceeds we should anneal towards the actual reward function.
>
> Typical examples of proxy reward functions include “partial credit” for behaviors that look promising; artificially high discount rates and careful reward shaping; and adjusting rewards so that small victories have an effect on learning even though they don’t actually matter. All of these play a central role in practical RL.
>
> A proxy reward function is just one of many possible hints. Providing [demonstrations of successful behavior](https://medium.com/ai-control/imitation-rl-613d70146409) is another important kind of hint. Again, I don’t think that this should be taken as a change to the reward function, but rather as side information to help achieve high reward. In the long run, we will hopefully design learning algorithms that automatically learn how to use general auxiliary information.

Why do we need new learning algorithms? The point of reward, on a mechanistic basis, is to update the agent’s cognition. Shaping reward seems fine to me, and I am uncomfortable with this apparent-to-me emphasis as reward “embodying” the agent’s goals.

## Nick Bostrom

> [!quote] _Superintelligence_, p.253
>
> **Summary of** **value-loading techniques…**
>
> **Reinforcement learning:** A range of different methods can be used to solve “reinforcement-learning problems,” but they typically involve creating a system that seeks to maximize a reward signal. This has an inherent tendency to produce the wireheading failure mode when the system becomes more intelligent. Reinforcement learning therefore looks unpromising.

Historical reasoning about RL seems quite bad. This excerpt is a prime example. In one fell swoop, in several pages of mistaken exposition, Superintelligence rules out [the single known method](/against-inner-outer-alignment#III-Outer-inner-just-isn-t-how-alignment-works-in-people) for producing human-compatible values. _We should forewarn new alignment researchers of these deep confusions before recommending this book._

> [!thanks]
> Thanks to Drake Thomas, ChatGPT, Ulisse Mini, and Peli Grietzer for feedback on this post.

[^1]:
    List of Lethalities was, AFAICT, intended to convey the _most important_ dangers, in the right language. [Rob Bensinger (who works at MIRI but was expressing his own views) also commented](https://www.lesswrong.com/posts/uMQ3cqWDPHhjtiesc/agi-ruin-a-list-of-lethalities?commentId=LowEED2iDkhco3a5d#Section_B_2___Central_difficulties_of_outer_and_inner_alignment_):

<!-- vale off -->
    > My shoulder Eliezer (who I agree with on alignment, and who speaks more bluntly and with less hedging than I normally would) says:
    >
    > 1. The list is true, to the best of my knowledge, and the details actually matter. Many civilizations try to make a canonical list like this in 1980 and end up dying where they would have lived _just_ because they left off one item, or under-weighted the importance of the last three sentences of another item, or included ten distracting less-important items.
<!-- vale on -->

    So if Eliezer's talking about "how do we get agents to care about non-sensory observables", this indicates to me that I disagree with him about what the central subproblems of alignment are.

[^2]:
    From [Inner and outer alignment decompose one hard problem into two extremely hard problems](/against-inner-outer-alignment):

    > **Outer/inner** _**unnecessarily** **assumes**_ **that the loss function/outer objective should “embody” the goals which we want the agent to pursue.**
    >
    > For example, shaping is empirically useful in both [AI](https://openai.com/blog/deep-reinforcement-learning-from-human-preferences/) and [animals](<https://en.wikipedia.org/wiki/Shaping_(psychology)>). When a trainer is teaching a dog to stand on its hind legs, they might first give the dog a treat when it lifts its front paws off the ground. This treat translates into an internal reward event for the dog, which ([roughly](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed#FL4kfk5YFvnjySAcn)) reinforces the dog to be more likely to lift its paws next time. The point isn’t that we _terminally value_ dogs lifting their paws off the ground. We do this because it reliably shapes target cognition (e.g. stand on hind legs on command) into the dog. If you think about reward as exclusively “encoding” what you want, you lose track of important learning dynamics and seriously constrain your alignment strategies.

[^3]: I think this holds for basically any values in a [rich](https://arbital.com/p/rich_domain/), partially observable domain, including paperclip optimization or picking three flowers.
[^4]:
    > "The loss function is used to train the AI, and the loss function represents human values" is akin to saying "a hammer is used to build a house, and the hammer represents the architect's design." Just as a hammer is a tool to facilitate the building process, a loss function is a tool to facilitate the learning process. The hammer doesn't represent the design of the house, it is simply a means to an end. Similarly, the loss function doesn't represent human values, it is simply a means to an end of training the AI to perform a task.

    ChatGPT wrote this hammer analogy, given the prompt of a post draft (but the draft didn't include any of my reward-as-chisel analogies).
