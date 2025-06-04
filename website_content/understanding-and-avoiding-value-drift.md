---
permalink: understanding-and-avoiding-value-drift
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/jFvFreCeejRKaZv4v/understanding-and-avoiding-value-drift
lw-is-question: 'false'
lw-posted-at: 2022-09-09T04:16:48.404000Z
lw-last-modification: 2022-11-08T00:44:20.675000Z
lw-curation-date: None
lw-frontpage-date: 2022-09-09T07:21:15.591000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 9
lw-base-score: 48
lw-vote-count: 20
af-base-score: 23
af-num-comments-on-upload: 7
publish: true
title: Understanding and avoiding value drift
lw-latest-edit: 2022-09-09T18:05:11.849000Z
lw-is-linkpost: 'false'
tags:
  - AI
  - rationality
  - human-values
  - shard-theory
aliases:
  - understanding-and-avoiding-value-drift
sequence-link: posts#shard-theory
lw-sequence-title: Shard Theory
prev-post-slug: shard-theory
prev-post-title: The Shard Theory of Human Values
next-post-slug: a-shot-at-the-diamond-alignment-problem
next-post-title: A Shot at the Diamond-Alignment Problem
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2022-09-09 00:00:00
original_url: 
  https://www.lesswrong.com/posts/jFvFreCeejRKaZv4v/understanding-and-avoiding-value-drift
skip_import: true
description: "A shard theory analysis of value drift: what it is, how it happens,
  and how to avoid it, even without controlling your experiences. "
date_updated: 2025-06-03 22:57:00.423836
---







I use [the shard theory of human values](/shard-theory) to clarify what value drift is, how it happens, and how it might be avoided by a highly intelligent agent—even if that agent doesn't have any control over its future experiences. Along the way, I give a shard theory account of rationalization.

# Defining "value drift"

> [!info] Recapitulating part of shard theory
> [Reward is _that which reinforces_](/reward-is-not-the-optimization-target). Considering the case of reinforcement learning in humans, reward causes your brain’s credit assignment algorithms[^1] to reinforce the actions and thoughts which led to that reward, making those actions and thoughts more likely to be selected in the future.
>
> For example, suppose you recognize a lollypop, and move to pick it up, and then lick the lollypop. Since the lollypop produces reward, these thoughts will be reinforced and you will be more likely to act similarly in such situations in the future. You become more of the kind of person who will move to pick up a lollypop when you recognize lollypops, and who will navigate to lollypop-containing locations to begin with.

With that in mind, I think that [shard theory](/shard-theory) offers a straightforward definition of "value drift":

> [!info] Definition: Value drift
> Value drift occurs when reinforcement events substantially change the internal "balance of power" among the shards activated in everyday situations.

For example, consider the classic "example" of taking a pill which makes you enjoy killing people. Under shard theory, this change would be implemented as a murder-shard that activates in a wide range of contexts in order to steer planning towards murder, and therefore starts steering your decision-making substantially differently.

My heart warns me of this "example." It's better to try to explain phenomena which, you know, are known to actually happen in real life. Another simple example of value drift is when someone snorts cocaine. At a (substantial) gloss, the huge hit of reward extremely strongly upweights the decision to do cocaine; the strength of the reward leads to an unusually strong cocaine-shard which activates in an unusually wide range of situations.

Here's a more complicated example of value drift. I'll give one possible mechanistic story for the "value drift" which occurs to an atheist (Alice) dating a religious person (Rick), and why that situation might predictably lead to Alice converting or Rick deconverting. I'll consider a scenario where Alice converts.

First, reinforcement events cause Alice to develop shards of value around making Rick happy and making Rick like her. Alice's new shards (non-introspectively apparently) query her world model for plans which make Rick happier and which make Rick like her more. Obviously, if Alice converted, they would have more in common, and Rick would be happy. Since these plans lead to Rick being happy and liking Alice more, these shards bid for those plans.

Only, the plan is not bid for directly in an introspectively obvious manner. That would provoke opposition from Alice's other values (which oppose deliberately changing her religious status just to make Rick happy). Alice's self-model predicts this opposition, and so her Rick-happiness- and Rick-approval-shards don't bid for the "direct" conversion plan, because it isn't predicted to work (and therefore won't lead to a future where Rick is happier and approves of Alice more). No, instead, these two shards _rationalize_ internally observable reasons why Alice should start going to Rick's church: "it's respectful", "church is interesting", "if I notice myself being persuaded I can just leave", "I'll get to spend more time with Rick."[^2]

Here, then, is the account:

1. Alice's Rick-shards query her world model for plans which lead to Rick being happier and liking Alice more,
2. so her world model returns a plan where she converts and goes to church with Rick;
3. In order to do this, the plan's purpose must be hidden so that other shards do not bid against the plan,
4. so this church-plan is pitched via "rationalizations" which are optimized to win over the rest of Alice's shard economy,
5. so that she actually decides to implement the church-going plan,
6. so that she gets positive reinforcement for going to church,
7. so that she grows a religion-shard,
    - (This is where the value drift happens, since her internal shard balance significantly changes!)
8. so that she converts,
9. _so that Rick ends up happier and liking Alice more_.

Her Rick-shards plan to induce value drift, and optimize the plan to make sure that it's hard for her other shards to realize the implicitly planned outcome (Alice converting) and bid against it. The described algorithm rationalizes against the person's entire decision-making process.

_Under shard theory, rationality is sometimes hard because "conscious-you" has to actually fight deception by other parts of yourself._

# One simple trick for avoiding value drift

Imagine you’ve been kidnapped by an evil, mustache-twirling villain who wants to corrupt your value system. They tie you to a chair and prepare to [stimulate your reward circuitry](https://en.wikipedia.org/wiki/Brain_stimulation_reward). They want to ruin your current values by making you into an addict and a wireheader.

_Exercise:_ How do you come out of the experience with your values intact?

>! In principle, the answer is simple. You just convince yourself you’re experiencing a situation congruent with your endorsed values, in a sufficiently convincing way that your brain’s credit assignment algorithm reinforces your pretend-actions when the brain stimulation reward occurs!

Consider that the brain does not directly observe the outside world. The outside world’s influence on your thinking is screened off by the state of your brain. The state of the brain constitutes the _mental context_. If you want to determine the output of a brain circuit, the mental context[^3] [_screens off_](https://www.lesswrong.com/tag/screening-off-evidence) the state of the world. In particular, this applies to the value updating process by which you become more or less likely to invoke certain bundles of heuristics (“value shards”) in certain mental contexts.

For example, suppose you lick a red lollypop, but that produces a large negative reward (maybe it was treated with awful-tasting chemicals). Mental context: “It’s Tuesday. I am in a room with a red lollypop. It looks good. I’m going to lick it. I think it will be good.” The negative reward reshapes your cognition, making you less likely to think similar thoughts and take similar actions in similar future situations.

Of the thoughts which were thunk before the negative reward, the credit assignment algorithm somehow identifies the relevant thoughts to include “It looks good”, “I’m going to lick it”, “I think it will be good”, and the various motor commands. You become less likely to think these thoughts in the future. In summary, the reason you become less likely to think these thoughts is that _you thought them while executing the plan which produced negative reward_, and credit assignment identified them as relevant to that result.

Credit assignment cannot and will not penalize thoughts[^4] which do not get thunk at all, or which it deems “not relevant” to the result at hand. Therefore, in principle, you could just pretend really hard that you’re in a mental context where you save a puppy’s life. When the electrically stimulated reward hits, the altruism-circuits get reinforced in the imagined mental context. You become more altruistic overall.

Of course, you have to _actually dupe the credit assignment algorithm into ignoring the latent “true” mental context_. But your credit assignment is not infinitely clever. And if it were, well, you could (in principle) add an edge-case for situations like this. So there is, in principle, a way to do it.

Therefore, your values can always be safe in your own mind, if you’re clever, foresightful, and have enough write access to fool credit assignment. Even if you don’t have control over your own future observations.

If this point still does not seem obvious, consider a scenario where you are blindfolded, and made to believe that you are about to taste a lollypop. Then, your captors fake the texture and smell and feel of a lollypop in your mouth, while directly stimulating your taste buds in the same way the lollypop would have. They remove the apparatus, and you go home. Do you think you have become reshaped to value electrical stimulation of your tongue? No. That is impossible, since your brain has no idea about what actually happened. _Credit assignment responds to reward depending on the mental context, not on the external situation._

Misunderstanding this point can lead to confusion. If you have a wire stuck in your brain’s reward center, surely that reward _reinforces_ having a wire stuck in your brain! Usually so, but not logically so. Your brain can only reward based on its cognitive context, based on the thoughts it actually thought which it identifies as relevant to the achievement of the reward. Your brain is _not_ directly peering out at reality and making you more likely to enter that state in the future.

# Conclusion

Value drift occurs when your values shift. In shard theory, this means that your internal decision-making influences (i.e. shards) are rebalanced by reinforcement events. For example, if you try cocaine, that causes your brain's credit assignment to strongly upweight decision-making which uses cocaine and which pursues rewarding activities.

Value drift is caused by credit assignment. Credit assignment can only depend on its observable mental context, and can't directly peer out at the world to objectively figure out what caused the reward event. Therefore, you can (in theory) avoid value drift by tricking credit assignment into thinking that the reward was caused by a decision to e.g. save a puppy's life. In that case, credit assignment would reinforce your altruism-shard. While humans probably can't dupe their own credit assignment algorithm to this extent, AI can probably include edge cases to their own updating process. But knowing value drift works—on this theory, via "unendorsed" reinforcement events—seems practically helpful for avoiding/navigating value-risky situations (like gaining lots of power or money).

> [!thanks]
>Thanks to Justis Mills for proofreading.

[^1]: These credit assignment algorithms may be hardcoded and/or learned.

[^2]: I feel confused about _how,_ mechanistically, other shards wouldn't fully notice the proto-deceptive plan being evaluated by the self-model, but presently think this "partial obfuscation" happens in shard dynamics for human beings. I think the other shards _do_ somewhat observe the proto-deception, and this is why good rationalists can learn to rationalize less.

[^3]: In [_The shard theory of human values_](./shard-theory), we defined the "mental context" of a circuit to be the inputs to that circuit which determine whether it fires or not. Here, I use "mental context" to also refer to the state of the entire brain, without considering a specific circuit. I think both meanings are appropriate and expect the meaning will be clear from the context.

[^4]: "Credit assignment penalizes thoughts" seems like a reasonable frame to me, but I'm flagging that this could misrepresent the mechanistic story of human cognition in some unforeseen way.
