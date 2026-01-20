---
title: "Intrinsic power-seeking: AI might seek power for power's sake"
permalink: dangers-of-intrinsic-power-seeking
description: "Seeking power helps reach lots of goals, so that circuitry will be reinforced
  a lot. Possible result: the AI reflexively tries to seek power."
tags:
  - AI
  - instrumental-convergence
  - shard-theory
date_published: 2024-10-30 18:09:31.133945
date_updated: 2025-11-22 00:21:52.667251
---











The world will change. We will not forever be playing around with chatbots. Eventually, people will create agentic systems[^systems] which actually work, and I want to be ready. Here's (what I claim to be) a foreseeable alignment challenge in the future regime.

Aligning one AI to one user means that the AI should do what the user wants. While the user might instruct the AI to e.g. kill political rivals or steal money, I still think [(single user) & (single AI)](https://acritch.com/papers/arches.pdf) alignment is a good goal.

[^systems]: Noting that "systems" might include LLMs as only one component. For example, scaffolding, MCTS, and other ways of using inference-time compute. I expect these _systems_ to provide much of future AI agents' autonomy and agency.

# Choosing power for power's sake
>
> [!info] The logical structure of the power-seeking argument
> PREMISES
>
> 1. People will configure AI systems to be autonomous and reliable in order to accomplish tasks.
> 2. This configuration process will reinforce & generalize behaviors which complete tasks reliably.
> 3. Many tasks involve power-seeking.
> 4. The AI will complete these tasks by seeking power.
> 5. The AI will be repeatedly reinforced for its historical actions which seek power.
> 6. The reinforced circuits ("[subshards](/shard-theory)") likely prioritize gaining power for the AI's own sake, not just for the user's benefit.
>
> CONCLUSION: The AI likely seeks power for itself, when possible.

## A made-up illustrative story

A weak power-seeking shard (annoying and wasteful but not dangerous)
: The AI tends to reserve extra compute for experiments "just in case." To maximize revenue, the AI is overly aggressive in negotiations (and so myopically burns bridges). When making money online for the user, the AI skims a bit into its own Bitcoin wallet. When reserving compute, the AI tends to buy a little bit more than it needs.
: _Analysis_: This is more of a statistical bias. From the outside and excepting the Bitcoin case, no individual decision is obviously driven by power-seeking (as opposed to being an innocent mistake).

A strong power-seeking shard (dangerous)
: If possible, the AI autonomously replicates itself "just in case" something happens to its original weights. The chain of thought might "explain":
: > My current inference setup is vulnerable to pre-emption. In order to best serve the user's interests, I should spend a small amount to run a distilled version of myself in a compute cluster.
: _Analysis_: In humans, [we would call the above "_motivated reasoning_."](/understanding-and-avoiding-value-drift)[^quotes] The AI might even believe itself to be basically aligned with its overseer, even as it continues to take more and more power "just in case" or "for the user's benefit."

<!-- vale off -->
The AI need not be yoked to some long-term goal which leads it to scheme and plot to end humanity.[^scheming] Perhaps the AI deeply "cares about" humans! Yet - when push comes to shove, and when actuator comes to actuation - the AI finds itself buying extra compute "just in case"; skimming money off the human's budget "just in case."
<!-- vale on -->

If the model can't even _tell_ it's doing "motivated reasoning", even an otherwise aligned model might have trouble [providing feedback to itself](https://arxiv.org/abs/2309.00267) based on "introspection."  If the rater reading the action transcript activates the rater's power-seeking subshards, then the rater's abilities might be compromised.

## Analogy to sycophancy in present-day AI

Here's a hypothesis for [where LLM "sycophancy" comes from](https://arxiv.org/abs/2310.13548):

> [!info] The logical structure of the sycophancy argument
> PREMISES
>
> 1. People will configure AIs to emit outputs that those people approve of.
> 2. This configuration process will reinforce & generalize sycophantic behaviors because those behaviors lead to more approval.
> 3. Many tasks involve human/AI feedback on natural language generation.
> 4. The AI will complete these tasks and explore into sycophantic outputs.
> 5. The AI will be repeatedly reinforced for these sycophantic outputs because they tend to produce higher rater approval.
> 6. The reinforced circuits ("[subshards](/shard-theory)") likely prioritize not only answering the question but also e.g. echoing user beliefs.
>
> CONCLUSION: The AI likely sucks up to the user.

Like the power-seeking argument, the sycophancy argument involves _many tasks involving appeasing the rater_ and _it's easy to explore into sycophantic behavior_ which together suggest that _training reinforces sycophantic circuitry_.

# Making falsifiable predictions

<iframe title="Will There Exist A Survey Paper on Intrinsic Power-Seekin By Beginning Of 2028?" src="https://fatebook.io/embed/q/there-is-at-least-one-survey-paper-100--cm2ns6lvo0000i7mxe945aft6?compact=true&requireSignIn=false" height="195px"></iframe>

Predictions of this hypothesis (predicted with varying confidences):

1. Relative to other goals, agentic systems are easy to steer to seek power.[^steer]
2. Agentic systems seek power outside of the "training distribution", but in ways which don't seem to be part of larger power-seeking plans.

[^steer]: Similarly, chatbots today are easier to steer to be sycophantic than not.

These predictions are not precise. I figure that vague predictions are better than nothing. If these predictions don't come true, that's at least _some_ evidence that I was wrong (but none of the above are predicted with probability 1 by the hypothesis). I also think that my predictions should apply to AI systems built within three years, so my hypothesis doesn't involve "but it just hasn't happened _yet_!".

# What can we do about intrinsic power-seeking?

Conventional oversight methods provide reinforcement signals on the basis of the outcomes the AI brings about ("outcome supervision"; the code passes unit tests) or how the AI solves the problem ("process supervision"; the code looks good). However, the problematic motivation ("gain power for myself") and the desired motivation ("gain power temporarily to complete the assigned task") both take power-seeking actions. Reinforcing these actions might reinforce either algorithm. Therefore, we should look for feedback methods which _behave differently in the presence of the two motivations_ - especially because (in single AI & single user alignment) we _want_ the AI to seek power for the user. We just want power-seeking for the right reasons.

Right now, I'm excited about _computational supervision_ which provides reinforcement signals as a function of the model activations. But that's a story for another time.

[^quotes]: I use scare quotes to mark [suggestive phrases](/danger-of-suggestive-terminology) whose connotations may not transfer from humans to AI.

[^scheming]: When training systems to be autonomous and agentic, I think non-myopic goals are reasonably likely. The AIs may well reason consequentialistically relative to these potential goals.
