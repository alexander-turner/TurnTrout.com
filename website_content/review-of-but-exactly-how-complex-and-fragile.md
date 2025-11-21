---
permalink: review-of-but-exactly-how-complex-and-fragile
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/r6p5cqT6aWYGCYHJx/review-of-but-exactly-how-complex-and-fragile
lw-is-question: 'false'
lw-posted-at: 2021-01-06T18:39:03.521000Z
lw-last-modification: 2021-02-17T04:22:11.674000Z
lw-curation-date: None
lw-frontpage-date: 2021-01-06T22:07:25.273000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 0
lw-base-score: 57
lw-vote-count: 21
af-base-score: 27
af-num-comments-on-upload: 0
title: Review of 'But exactly how complex and fragile?'
lw-latest-edit: 2021-01-07T19:03:57.411000Z
lw-is-linkpost: 'false'
tags:
  - AI
aliases:
  - review-of-but-exactly-how-complex-and-fragile
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2021-01-06 00:00:00
original_url: 
  https://www.lesswrong.com/posts/r6p5cqT6aWYGCYHJx/review-of-but-exactly-how-complex-and-fragile
skip_import: true
description: A review of Katja Grace's post questioning the "value is fragile" argument,
  arguing it sparked valuable but confused debate.
date_updated: 2025-06-03 22:57:00.423836
---







I've thought about (concepts related to) the fragility of value [quite](/the-catastrophic-convergence-conjecture#Objective-vs-value-specific-catastrophes) [a bit](/non-obstruction-motivates-corrigibility) over the last year, and so I returned to Katja Grace's [_But exactly how complex and fragile?_](https://www.lesswrong.com/posts/xzFQp7bmkoKfnae9R/but-exactly-how-complex-and-fragile) with renewed appreciation (I'd previously commented only [a brief microcosm](https://www.lesswrong.com/posts/xzFQp7bmkoKfnae9R/but-exactly-how-complex-and-fragile?commentId=GAxppfoKhiFRrWHgK) of this review). I'm glad that Katja wrote this post and I'm glad that everyone commented. I often see [private Google docs full of nuanced discussion which will never see the light of day](https://www.lesswrong.com/posts/hnvPCZ4Cx35miHkw3/why-is-so-much-discussion-happening-in-private-google-docs), and that makes me sad, and I'm happy that people discussed this publicly.

I'll split this review into two parts, since [the nominations called for](https://www.lesswrong.com/posts/xzFQp7bmkoKfnae9R/but-exactly-how-complex-and-fragile?commentId=upiLXPNDbKWoudatP) review of both the post and the comments:

> [!quote] `habryka`
>
> I think this post should be reviewed for its excellent comment section at least as much as for the original post, and also think that this post is a pretty central example of the kind of post I would like to see more of.

# Summary

I think this was a good post. I think Katja shared an interesting perspective with valuable insights and that she was correct in highlighting a confused debate in the community.

That said, I think the post and the discussion are reasonably confused. The post sparked valuable lower-level discussion of AI risk, but I don't think that the discussion clarified AI risk models in a meaningful way.

The problem is that people are debating "is value fragile?" without realizing that value fragility is a _sensitivity measure_: given some initial state and some dynamics, how sensitive is the human-desirability of the final outcomes [to certain kinds of perturbations of the initial state](https://www.lesswrong.com/posts/znfkdCoHMANwqc2WE/the-ground-of-optimization-1)?

Left unremarked by Katja and the commenters, value fragility isn't intrinsically _about_ AI alignment. What matters most is the extent to which the future is controlled by systems whose purposes are sufficiently entangled with human values. This question reaches beyond just AI alignment.

They also seem to be debating an under-specified proposition. Different perturbation sets and different dynamics will exhibit different fragility properties, even though we're measuring with respect to human value in all cases. For example, perturbing the training of an RL agent learning a representation of human value, is different from perturbing the utility function of an expected utility maximizer.

Setting loose a superintelligent expected utility maximizer is different from setting loose a mild optimizer (e.g. a [quantilizer](https://intelligence.org/2015/11/29/new-paper-quantilizers/)), even if they're both optimizing the same flawed representation of human value; the dynamics differ. As another illustration of how dynamics are important for value fragility, imagine if recommender systems had been deployed within a society which already adequately managed the impact of ML systems on its populace. In that world, we may have ceded less of our agency and attention to social media, and would therefore have firmer control over the future and value would be less fragile with respect to the training process of these recommender systems.

# The Post

[_But exactly how complex and fragile?_](https://www.lesswrong.com/posts/xzFQp7bmkoKfnae9R/but-exactly-how-complex-and-fragile) and its comments debate whether "value is fragile." I think this is a bad framing because it hides background assumptions about the dynamics of the system being considered. This section motivates a more literal interpretation of the value fragility thesis, demonstrating its coherence and its ability to meaningfully decompose AI alignment disagreements. The next section will use this interpretation to reveal how the comments largely failed to explore key modeling assumptions. This, I claim, helped prevent discussion from addressing the cruxes of disagreements.

The post and discussion both seem to slip past (what I view as) the heart of "value fragility", and it seems like many people are secretly arguing for and against different propositions.

> [!quote] Katja Grace
> it is hard to write down what kind of future we want, and if we get it even a little bit wrong, most futures that fit our description will be worthless.

This argument hides a key step:

> it is hard to write down the future we want, _feed the utility function punchcard into the utility maximizer and then press "play"_, and if we get it even a little bit wrong, most futures that fit our description will be worthless.

Here is the original "value is fragile" claim:

> [!quote] Eliezer Yudkowsky, [_Value is Fragile_](https://www.lesswrong.com/posts/GNnHHmm8EzePmKzPk/value-is-fragile)
>
> Any Future **not** shaped by a goal system with detailed reliable inheritance from human morals and metamorals, will contain almost nothing of worth.

Eliezer claims that if the future is not _shaped by **a** goal system,_ there's not much worth. He does not explicitly claim, in that original essay, that we have to/will probably build an X-maximizer AGI, where X is an extremely good (or perfect) formalization of human values (whatever that would mean!). He does not explicitly claim that we will mold a mind from shape Y and that that probably goes wrong, too. He's talking about goal systems chartering a course through the future, and how sensitive the outcomes are to that process.

Let's ground this out. Imagine you're acting, but you aren't quite sure _what_ is right. For a trivial example, you can eat bananas or apples at any given moment, but you aren't sure which is better. A few strategies you could follow: [preserve attainable utility for lots of different goals](/avoiding-side-effects-in-complex-environments) (e.g. preserve the fruits as best you can); retain option value where your [normative uncertainty](https://philpapers.org/rec/MACNU) lies (e.g. don't toss out all the bananas or all of the apples); etc.

What if you have to commit to an object-level policy _now_, a way-of-steering-the-future _now_, without being able to reflect more on your values? What kind of guarantees can you get?

In Markov decision processes, if you're maximally uncertain, you can't guarantee you won't lose at least _half_ of the value you could have achieved for the unknown true goal (I recently proved this for [an upcoming paper](https://arxiv.org/abs/2206.11812v3)). Relatedly, perfectly optimizing an $\epsilon$\-incorrect reward function [only bounds regret](https://web.eecs.umich.edu/~baveja/Papers/approx-rl-loss.pdf) to $2\epsilon$ _per time step_ (see also [_Goodhart's Curse_](https://arbital.com/p/goodharts_curse/)). The main point is that you can't pursue every goal at once. It doesn't matter whether you use reinforcement learning to train a policy, or whether you act randomly, or whether you ask Mechanical Turk volunteers what you should do in each situation. Whenever your choices mean anything at all, _no sequence of actions can optimize all goals at the same time_.

So there has to be _something_ which differentially pushes the future _towards_ "good" things and _away from_ "bad" things. That _something_ could be "humanity", or "aligned AGI", or "augmented humans wielding tool AIs", or "magically benevolent aliens" - whatever. But it has to be _something_, _some "goal system"_ (as Eliezer put it), and it has to be _entangled_ with the thing we want it to optimize for (human morals and metamorals). Otherwise, there's no reason to think that the universe weaves a "good" trajectory through time.

Hence, one might then conclude

> [!quote] Eliezer Yudkowsky, [_Value is Fragile_](https://www.lesswrong.com/posts/GNnHHmm8EzePmKzPk/value-is-fragile)
> Any Future **not** shaped by a goal system with detailed reliable inheritance from human morals and metamorals, will not be optimized _for_ human morals and metamorals.

We must now figure out how to go from "will not be optimized _for_" to "will contain _almost nothing_ of worth"? Several arguments suffice. The simplest may be:

> [our universe has "resources"](https://www.lesswrong.com/s/ehnG4mseKF6xALmQy/p/ahZQbxiPPpsTutDy2#Convergent_Instrumental_Goals); making the universe decently OK-by-human-standards [requires resources](/seeking-power-is-often-convergently-instrumental-in-mdps) which can be used for many other purposes; most purposes are best accomplished by _not_ using resources in this way.

This argument does _not_ claim that we will deploy utility maximizers with a misspecified utility function, and that _that_ will be how our fragile value is shattered and our universe is extinguished. The thesis holds merely that

> [!quote]Eliezer Yudkowsky, [_Value is Fragile_](https://www.lesswrong.com/posts/GNnHHmm8EzePmKzPk/value-is-fragile)
> Any Future **not** shaped by _a goal system_ with detailed reliable inheritance from human morals and metamorals, will contain almost nothing of worth.

As Katja notes, this argument is secretly about [how the "forces of optimization" shape the future](/attainable-utility-landscape), and not necessarily about AIs or anything. The key point is to [understand how the future is shaped](/non-obstruction-motivates-corrigibility), and then discuss how different kinds of AI systems might shape that future.

Concretely, I can claim "value is fragile" and then say "_for example_, if we deployed a utility-maximizer in our society but we forgot to have it optimize for variety, people might loop a single desirable experience forever." But on its own, the value fragility claim doesn't center on AI.

> [!quote] [_Value is Fragile_](https://www.lesswrong.com/posts/GNnHHmm8EzePmKzPk/value-is-fragile)
>
> \[Human\] values do _not_ emerge in all possible minds.  They will _not_ appear from nowhere to rebuke and revoke the utility function of an expected paperclip maximizer.
>
> Touch too hard in the wrong dimension, and the physical representation of those values will shatter - and _not come back_, for there will be nothing left to _want_ to bring it back.
>
> And the _referent_ of those values - a worthwhile universe - would no longer have any physical reason to come into being.
>
> Let go of the steering wheel, and the Future crashes.

Katja (correctly) implies that _concluding that AI alignment is difficult_ requires extra arguments beyond value fragility:

> [!quote] Katja Grace, [_But exactly how complex and fragile?_](https://www.lesswrong.com/posts/xzFQp7bmkoKfnae9R/but-exactly-how-complex-and-fragile)
>
> ... But if \[the AI\] doesn’t abruptly take over the world, and merely becomes a large part of the world’s systems, with ongoing ability for us to modify it and modify its roles in things and make new AI systems, then the question seems to be how forcefully the non-alignment is pushing us away from good futures relative to how forcefully we can correct this. And in the longer run, how well we can correct it in a deep way before AI does come to be in control of most decisions. So something like the speed of correction vs. the speed of AI influence growing.

As I see it, Katja and the commenters mostly discuss their _conclusions_ about how AI+humanity might steer the future, how _hard_ it will be to achieve the requisite entanglement with human values, instead of debating the truth value of the "value fragility" claim which Eliezer made. Katja and the commenters discuss points which _are_ relevant to AI alignment, but which are distinct from the value fragility claim. No one remarks that this claim has truth value independent of how we go about AI alignment, or how hard it is for AI to further our values.

Value fragility quantifies the robustness of outcome value to perturbation of the "motivations" of key actors within a system, given certain dynamics. This may become clearer as we examine the comments. This insight allows us to decompose debates about "value fragility" into e.g.

1. In what ways is human value fragile, given a fixed optimization scheme?

- In other words: given fixed dynamics, to what classes of perturbations is outcome value fragile?

2. What kinds of multi-agent systems tend to veer towards goodness and beauty and value?  

- In other words: given a fixed set of perturbations, what kinds of dynamics are unusually robust against these perturbations?
  - What kinds of systems will humanity end up building, should we act no further? This explores our beliefs about how probable alignment pressures will interact with value fragility.

I think this decomposition is much more enlightening than debating whether value is fragile to AI.

# The Comments

If no such decomposition takes place, I think debate is just too hard and opaque and messy, and I think some of this messiness spilled over into the comments. Locally, each comment is well thought-out, but it seems (to me) that cruxes [were largely left untackled](https://www.lesswrong.com/posts/xzFQp7bmkoKfnae9R/but-exactly-how-complex-and-fragile?commentId=C3L8jcExxYphaC5eH).

To concretely point out something I consider somewhat confused:

<!-- vale off -->
> [!quote] `johnswentworth`'s [the top-rated comment](https://www.lesswrong.com/posts/xzFQp7bmkoKfnae9R/but-exactly-how-complex-and-fragile?commentId=36Zaej9ppdApxcmFc)
>
> I think \[Katja's summary\] is an oversimplification of the fragility argument, which people tend to use in discussion because there's some nontrivial conceptual distance on the way to a more rigorous fragility argument.
>
> The main conceptual gap is the idea that "distance" is not a pre-defined concept. Two points which are close together in human-concept-space may be far apart in a neural network's learned representation space or in an AGI's world-representation-space. It may be that value is not very fragile in human-concept-space; points close together in human-concept-space may usually have similar value. But that will definitely not be true in all possible representations of the world, and we don't know how to reliably formalize/automate human-concept-space.
>
> The key point is not "if there is any distance between your description and what is truly good, you will lose everything", but rather, "we don't even know what the relevant distance metric is or how to formalize it". And it is definitely the case, at least, that many mathematically simple distance metrics _do_ display value fragility.
<!-- vale on -->

John makes good points. But what exactly _happens_ between "we write down something too distant from the 'truth'" and the result? The AI happens. But this part, the dynamics, it's kept invisible.

So if you think that there will be fast takeoff via utility maximizers (_a la_ AIXI), you might say "yes, value is fragile", but if _I_ think it'll be more like slow CAIS with semi-aligned incentives making sure nothing goes too wrong, I reply "value isn't fragile." Even if we agree on a distance metric! By these unspoken assumptions, people talk past each other.

Crucially, you have to _realize_ that your mind can hold separate the value fragility considerations, the considerations as to how vulnerable the outcomes are to the aforementioned perturbations, you have to know you can hold these separate from your parameter values for e.g. AI timelines.

Many other comments seem off-the-mark in a similar way. That said, I think that Steve Byrnes left [an underrated comment](https://www.lesswrong.com/posts/xzFQp7bmkoKfnae9R/but-exactly-how-complex-and-fragile?commentId=NYBT6FEeeQGE8XqWD):

> [!quote] Steve Byrnes
> Corrigibility is another reason to think that the fragility argument is not an impossibility proof: If we can make an agent that sufficiently understands and respects the human desire for autonomy and control, then it would presumably ask for permission before doing anything crazy and irreversible, so we would presumably be able to course-correct later on (even with fast/hard takeoff).

The reason that [corrigibility-like properties](/non-obstruction-motivates-corrigibility) are so nice is that they let us continue to steer the future _through_ the AI itself; its power becomes ours, and so _we_ remain the "goal system with detailed reliable inheritance from human morals and metamorals" shaping the future.

# Conclusion

> [!quote] `TurnTrout`, this review
>
> The problem is that people are debating "is value fragile?" without realizing that value fragility is a _sensitivity measure_: given some initial state and some dynamics, how sensitive is the human-desirability of the final outcomes [to certain kinds of perturbations of the initial state](https://www.lesswrong.com/posts/znfkdCoHMANwqc2WE/the-ground-of-optimization-1)?
>
> Left unremarked by Katja and the commenters, value fragility isn't intrinsically _about_ AI alignment. What matters most is the extent to which the future is controlled by systems whose purposes are sufficiently entangled with human values. This question reaches beyond just AI alignment.

I'm glad Katja said "Hey, I'm not convinced by this key argument", but I don't think it makes sense to include [_But exactly how complex and fragile?_](https://www.lesswrong.com/posts/xzFQp7bmkoKfnae9R/but-exactly-how-complex-and-fragile) in the LessWrong review.

> [!thanks]
> Thanks to Rohin Shah for feedback on this review. Further discussion is available in the children of [this comment](https://www.lesswrong.com/posts/xzFQp7bmkoKfnae9R/but-exactly-how-complex-and-fragile?commentId=RviNJ5SjdmkXnWbtv)\.
