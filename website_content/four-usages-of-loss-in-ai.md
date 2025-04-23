---
permalink: four-usages-of-loss-in-ai
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/jnmG5jczvWbeRPcvG/four-usages-of-loss-in-ai
lw-is-question: 'false'
lw-posted-at: 2022-10-02T00:52:35.959000Z
lw-last-modification: 2023-01-24T00:26:34.406000Z
lw-curation-date: None
lw-frontpage-date: 2022-10-02T04:01:56.099000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 18
lw-base-score: 44
lw-vote-count: 18
af-base-score: 20
af-num-comments-on-upload: 16
publish: true
title: Four usages of 'loss' in AI
lw-latest-edit: 2023-01-24T00:26:35.060000Z
lw-is-linkpost: 'false'
tags:
  - AI
aliases:
  - four-usages-of-loss-in-ai
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2022-10-02 00:00:00
original_url: https://www.lesswrong.com/posts/jnmG5jczvWbeRPcvG/four-usages-of-loss-in-ai
skip_import: true
description: Four distinct concepts related to "loss function" in AI are often conflated,
  leading to ambiguity in the field of AI alignment.
date_updated: 2025-03-22 12:22:59.421452
---






What does it _mean_ for a loss function to be "aligned with" human goals? I perceive four different concepts which involve "loss function" in importantly different ways:

1. _Physical-loss:_ The physical implementation of a loss function and the loss computations,
2. _Mathematical-loss:_ The mathematical idealization of a loss function,
3. A loss function "encoding/representing/aligning with" an intended goal, and
4. Agents which "care about achieving low loss."

I advocate retaining physical- and mathematical-loss. I advocate dropping 3 in favor of talking directly about desired AI cognition and how the loss function entrains that cognition. I advocate disambiguating 4, because it can refer to a range of physically grounded preferences about loss (e.g. low value at the loss register versus making perfect future predictions).

> [!note]
> Related to [_Towards deconfusing wireheading and reward maximization_](https://www.lesswrong.com/posts/jP9cKxqwqk2qQ6HiM/towards-deconfusing-wireheading-and-reward-maximization)\.[^1] I'm going to talk about "loss" instead of "reward", but the lessons apply to both.

# Four sharply different concepts

## 1: Physically implemented loss

> The loss function updated my network.

This describes computations embedded in _physical reality_. This statement involves the physically implemented sequence of loss computations which stream in throughout training. For example, the computations engendered by `loss_fn = torch.nn.CrossEntropyLoss()`.

## 2: Mathematical loss

> The loss function is a smooth function of the prediction distribution.

This describes the _idealized_ _mathematical_ loss function. These are the mathematical objects you can prove learning theory results about. The Platonic idealization of the learning problem and the mathematical output-grading rule casts a shadow into your computer via its real-world implementation (concept 1).

For example, $(D,\ell)$  where $D:=\{\left(x,\text{label}(x)\right) \mid x \in \text{MNIST} \}$ is the mathematical idealization of the MNIST dataset, where the $x\in\mathbb{R}^{28×28}$ are the idealized grayscale MNIST images. And $\ell$ is the _mathematical_ function of cross-entropy (CE) loss between a label prediction distribution and the ground-truth labels.

## 3: Loss functions "representing" goals

> I want a loss function which is aligned with the goal of "write good novels."

This describes kind of correspondence between the loss function and the goal of writing good novels. But what does this statement _mean_?

Suppose you tell me "I have written down a loss function $\ell_\text{novel}$ which is perfectly aligned with the goal of 'write good novels'." What experiences should this claim lead me to anticipate?

1. That an agent can only achieve low physical-loss (concept 1) if it has, in physical fact, written a good novel?
2. That in some mathematical idealization of the learning problem (concept 2), loss-minimization only occurs when the agent outputs text which would be found in what we rightly consider to be "good novels"? (But in _which_ mathematical idealization?)
3. That, as a matter of physical fact, if you train an agent on $\ell_\text{novel}$ using learning setup $X$, then you produce a language model which can be easily prompted to output high-quality novels?

Much imprecision comes from loss functions [not directly encoding goals](/reward-is-not-the-optimization-target). Loss signals are physically implemented (concept 1) parts of the AI's training process which (physically) update the AI's cognition in certain ways. While a loss function can be _involved_ in the AI's decision-making structure (see items i and ii above), additional information is needed to understand what motivational cognition is being discussed.

I think that talking about loss functions being "aligned" encourages bad habits of thought at best, and is nonsensical at worst. I think it makes way more sense to say how you want the agent to think and then act (e.g. "write good novels"—the _training goal_, in Evan Hubinger's [training stories framework](https://www.lesswrong.com/posts/FDJnZt8Ks2djouQTZ/how-do-we-become-confident-in-the-safety-of-a-machine)) and why you think you can use a given loss function  $\ell_\text{novel}$ to produce that cognition in the agent (the _training rationale_).

## 4: Agents which want to minimize loss

> The agent wants to minimize its loss.

What does this mean in terms of the AI's generalization properties, in terms of _how the AI thinks and is motivated_?

1. The agent might care about maintaining a low value at the loss register and e.g. compute on-policy value to be $-1 \times$ expected time-discounted register value, and then (somehow) select plans on that basis.
2. Or the agent might care about outputting physical predictions which match the future physical labels, making tradeoffs between misprediction events in a way which accords with e.g. the cross-entropy loss (the utility of a prediction being $-1\times$ CE loss).
3. Or something else.

An agent can internally "care" about "optimizing a loss function" (concept 4), but that caring is not implemented _via_ loss computations which provide cognitive updates (concept 1).

# Confusion resulting from ambiguity

Here is a quote which I, as a reader, have trouble understanding:

> [!quote]  [Risks from Learned Optimization: Introduction](https://www.lesswrong.com/posts/FkgsxrGf3QxhfLWHG/risks-from-learned-optimization-introduction)
> outer alignment refers to aligning the specified loss function with the intended goal, whereas inner alignment refers to aligning the mesa-objective of a mesa-optimizer with the specified loss function.

I don't know what inner cognition would or would not satisfy this vague-to-me definition. What does it mean for a loss function to be "aligned" with the intended goal?

Suppose you told me, "`TurnTrout`, we have definitely produced a loss function which is aligned with the intended goal, and inner-aligned an agent to that loss function."

- Suppose I went to the computer where the miraculous loss function is implemented. What should I expect to see when I read the code / do interpretability on the trained loss-model?
- Suppose I inspected the model data for the purportedly inner-aligned agent, and used powerful interpretability tools on the model. What kind of cognition would I expect to find?

These two points matter. For example, see section (3) for three concrete operationalizations of "loss function is aligned" which imply substantially different generalization behavior from the AI. In that kind of scenario, the AI's generalization properties _sensitively depend_ both on the loss function which trained the model, and on the cognition which is aligned to that model.  Usually, when I read writing on outer/inner alignment, I end up feeling confused about what exactly I'm supposed to be imagining.[^2] I often wonder whether there exists a concrete example at all!

As I said above:

> I think that talking about loss functions being "aligned" encourages bad habits of thought at best, and is nonsensical at worst. I think it makes way more sense to say how you want the agent to think (e.g. "write good novels"—the _training goal_, in Evan Hubinger's [training stories framework](https://www.lesswrong.com/posts/FDJnZt8Ks2djouQTZ/how-do-we-become-confident-in-the-safety-of-a-machine)) and why you think you can use a given loss function  $\ell_\text{novel}$ to produce that cognition in the agent (the _training rationale_).

# Conclusion

I think it makes the most sense to use "loss" to refer to physical-loss and mathematical-loss. I think we should stop talking about loss/reward as "representing" a goal because it invites imprecise thinking and communication. I think it can be OK to use motivated-by-loss (#4) as shorthand, but that it's important to clarify what flavor of loss minimization you're talking about.

> [!thanks]
>Thanks to Garrett Baker for feedback on a draft.

[^1]: Leo Gao [wrote](https://www.lesswrong.com/posts/jP9cKxqwqk2qQ6HiM/towards-deconfusing-wireheading-and-reward-maximization#Outside_world_objectives_are_the_policy_s_optimization_target):

    <!-- vale off -->
    > The objective that any given _policy_ appears to optimize is its behavioral objective\[...\]
    >
    > There are in fact many distinct possible policies with different behavioral objectives for the RL algorithm to select for: there is a policy that changes the world in the “intended” way so that the reward function reports a high value, or one that changes the reward function such that it now implements a different algorithm that returns higher values, or one that changes the register the output from the reward function is stored in to a higher number, or one that causes a specific transistor in the processor to misfire, etc. All of these policies optimize some thing in the outside world (a utility function); for instance, the utility function that assigns high utility to a particular register being a large number. The value of the particular register is a fact of the world. \[...\]
    >
    > However, when we try to construct an RL policy that has as its behavioral objective the “reward”, we encounter the problem that it is unclear what it would mean for the RL policy to “care about” reward, because there is no well defined reward channel in the embedded setting. We may observe that all of the above strategies are instrumental to having the particular policy be picked by the RL algorithm as the next policy used by the agent, but this is a utility over the world as well (“have the next policy implemented be this one”), and in fact this isn’t really much of a reward maximizer at all, because it explicitly bypasses reward as a concept altogether! In general, in an embedded setting, any preference the policy has over “reward" (or "observations") can be mapped onto a preference over facts of the world.
    <!-- vale on -->

    My summary: "The agent cares about reward" is inherently underdefined, and precision matters here.

[^2]: See also [What exactly is GPT-3's base objective?](https://www.lesswrong.com/posts/Nq58w4SiZMjHdAPaX/what-exactly-is-gpt-3-s-base-objective).
