---
permalink: ban-development-of-unpredictable-powerful-models
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/8CvkNa6FKSrK4Nj83/ban-development-of-unpredictable-powerful-models
lw-is-question: 'false'
lw-posted-at: 2023-06-20T01:43:11.574000Z
lw-last-modification: 2024-03-27T02:57:58.444000Z
lw-curation-date: None
lw-frontpage-date: 2023-06-20T17:44:17.930000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 25
lw-base-score: 46
lw-vote-count: 30
af-base-score: 22
af-num-comments-on-upload: 9
publish: true
title: Ban development of unpredictable powerful models?
lw-latest-edit: 2024-03-27T02:58:00.187000Z
lw-is-linkpost: 'false'
tags:
  - AI
aliases:
  - ban-development-of-unpredictable-powerful-models
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2023-06-20 00:00:00
original_url: 
  https://www.lesswrong.com/posts/8CvkNa6FKSrK4Nj83/ban-development-of-unpredictable-powerful-models
skip_import: true
description: "A proposal for a government regulation of AI: Developers must be able
  to accurately predict the model's output. "
date_updated: 2025-06-03 22:57:00.423836
---







> [!warning]
> No longer endorsed, as [I realized I don't believe in deceptive alignment from pretrained models](/invalid-ai-risk-arguments). Therefore, I no longer think it is inherently dangerous to pretrain sufficiently large language models.

In this post, I propose a (relatively strict) prediction-based eval which is well-defined, which seems to rule out lots of accident risk, and which seems to partially align industry incentives with real alignment progress. This idea is not ready to be implemented, but I am currently excited about it and suspect it's crisp enough to actually implement.

<hr/>

Suppose I claim to understand how the model works. I say "I know what goals my model is pursuing. I know it's safe." To test my claims, you give me some random prompt (like "In the year 2042, humans finally"), and then (without using other AIs), I tell you "the most likely token is  `unlocked` with probability $.04$ , the second-most likely is  `achieved` with probability $.015$, and...", and I'm _basically right._[^1] That happens over hundreds of diverse validation prompts.

This would be really impressive and seems like great evidence that I really know what I'm doing.

Proposed eval: The developers have to predict the next-token probabilities on a range of government-provided validation prompts,[^2] without running the model itself. To do so, the developers are not allowed to use helper AIs whose outputs the developers can't predict by this criterion. Perfect prediction is not required. Instead, there is a fixed log-prob misprediction tolerance, averaged across the validation prompts.[^3]

## Benefits

Developers probably have to truly understand the model in order to predict it so finely
: This correlates with high levels of alignment expertise, on my view. If we could predict GPT-4 generalization quite finely, down to the next-token probabilities, we may in fact be ready to use it to help understand GPT-5.  

Incentivizes models which are more predictable.[^4]
: Currently we aren't directly taxing unpredictability. In this regime, an additional increment of unpredictability must be worth the additional difficulty with approval.

Robust to "the model was only slightly finetuned, fast-track our application please."
: If the model was truly only changed in a small set of ways which the developers understand, the model should still be predictable on the validation prompts.

Somewhat agnostic to theories of AI risk.
: We aren't making commitments about what evals will tend to uncover what abilities, or how long alignment research will take. This eval is dynamic, and might even adapt to new AI paradigms (predictability seems general).

Partially incentivizes labs to do alignment research for us.
: Under this requirement, the profit-seeking move is to get better at predicting (and, perhaps, interpreting) model behaviors.

## Drawbacks

Most notably, this test seems _extremely strict_, perhaps beyond even the strict standards we will want to demand of those looking to deploy potentially world-changing models. I'll discuss a few drawbacks in the next section.

## Anticipated questions

**If we pass this, no one will be able to train new frontier models for a long time.**

: Good.

**But maybe "a long time" is too long. It's not clear that this criterion** _**can**_ **be passed,**[^5] **even after deeply qualitatively understanding the model.**

: I share this concern. That's one reason I'm not lobbying to implement this as-is. Even [`solu-2l` (6.3M params, 2-layer)](https://neelnanda-io.github.io/TransformerLens/generated/model_properties_table.html) is probably out of reach absent serious effort and solution of [superposition](https://www.anthropic.com/index/toy-models-of-superposition).
:
: Maybe there are useful relaxations which are both more attainable and require deep understanding of the model. We can, of course, set the acceptable misprediction rate to be higher at first, and decrease it over time. Another relaxation would be "only predict e.g. the algorithm written in a coding task, not the per-token probabilities", but I think that seems way too easy.
:
: That said, I think AI will transform the whole planet. If a lab wants to deploy or train a model, they better know what they're doing.

**It's not clear how relevant next-token prediction is to understanding all of the important facts about models.**

: My intuition is that prediction is quite relevant, but probably not sufficient so that developers learn _all_ important facts. Probably they still have to learn a lot of facts. I have a hunch like, "to predict the territory, you have to learn a map which abstracts the pieces of that territory."
:
: I mainly expect prediction to be insufficient if:
:
: 1.  The error tolerance is too high, or
: 2.  The validation sets are insufficiently diverse.
:
: It's possible that the company knows how important bits of the model works, but doesn't understand the implications of the design, such that they don't realize the model becomes dangerous/hostile during autoregressive generation. I think this is relatively unlikely, but I would like to stamp that risk out.

**Why not just cap compute for 30 years? If you aren't allowed to train the AI at all, there can't be catastrophic false negative results.**

: This comes down to beliefs about the chance of a false negative result on this test, where the developers also think it's safe, the developers pass all prediction tasks, and then the AI is catastrophic anyways. _If_ this chance is low, then I think my proposed test seems better than just capping compute for 30 years. This test has several uses:
:
: 1.  **Setting a resumption point.** Who knows how long it will take to understand generalization in detail, or to solve other alignment problems? Why is "30" a good number?
: 2.  **Aligning incentives.** Labs are incentivized to advance the art of predicting (and probably, interpreting) models.
:
: Maybe "steadily declining compute cap for 30 years" isn't the best policy alternative. Open to hearing about those!

**What's the point of using a model if you can simulate it manually?**

: A few responses. First, the developers painstakingly predict e.g. a few hundred forward passes, in order to gain approval to run millions of forward passes (by deploying the model). Second, the prediction is only up to a certain tolerance. Third, the validation prompts won't make the developers predict a huge number memorized datapoints and facts which the model has internalized.

**What about pre-deployment risk?**

: I imagine applying this in conjuction with other evals, licensing, compute caps, and other controls. Possibly developers should be required to pass this test at regular training checkpoints, before continuing training. This would decrease the chance that developers unknowingly train a giant dangerous model.

**What about model weight security?**

: Seems like a separate problem.

_Edit 6/26/23:_ I originally presented this eval as a "sufficient condition" for deploying powerful LMs. I no longer think this eval is a sufficient condition. I think we should probably indefinitely ban powerful models, and also strongly consider this kind of prediction-based eval as another tool in the eval toolbelt. I no longer endorse the following answer, but think it still points at real benefits.

> [!thanks]
>Thanks to Aryan Bhatt and Olivia Jimenez for feedback.

[^1]: Possibly just grading predictions for the top-$k$ probabilities.

[^2]: Each validation prompt is unique to each validation attempt.

[^3]: The average can be weighted to more strongly emphasize prediction on more important prompt prediction areas. For example, predicting exactly how the LM responds to attempts to turn the model into an agent (e.g. [AutoGPT](https://github.com/Significant-Gravitas/Auto-GPT)).

[^4]: As a side effect, this proposal incentivizes models with smaller token vocabularies.

[^5]: Somewhat relatedly: [Language models seem to be much better than humans at next-token prediction](https://www.lesswrong.com/posts/htrZrxduciZ5QaCjw/language-models-seem-to-be-much-better-than-humans-at-next). However, this post covers the task "predict the next token of text", not "given this prompt, predict the model's next-token probabilities." The latter task is probably far harder than the first.
