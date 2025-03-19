---
permalink: gpt2-steering-paper-announcement
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/HWxLQvzJGeXoLPJWd/actadd-steering-language-models-without-optimization
lw-linkpost-url: https://arxiv.org/abs/2308.10248
lw-is-question: 'false'
lw-posted-at: 2023-09-06T17:21:56.214000Z
lw-last-modification: 2023-11-06T16:33:16.256000Z
lw-curation-date: None
lw-frontpage-date: 2023-09-06T17:35:35.588000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 3
lw-base-score: 105
lw-vote-count: 31
af-base-score: 45
af-num-comments-on-upload: 2
publish: true
title: 'ActAdd: Steering Language Models without Optimization'
lw-latest-edit: 2023-11-06T16:33:20.505000Z
lw-is-linkpost: 'true'
authors: technicalities, Alex Turner, Lisa Thiergart, David Udell, Ulisse Mini, and
  Monte MacDiarmid
tags:
  - AI
  - activation-engineering
aliases:
  - actadd-steering-language-models-without-optimization
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2023-09-06 00:00:00
original_url: https://www.lesswrong.com/posts/HWxLQvzJGeXoLPJWd/actadd-steering-language-models-without-optimization
skip_import: true
description: 'Activation additions: steering language models by adding a bias to the
  forward pass. Surprisingly broad control, small impact on off-target capabilities.'
date_updated: 2025-03-05 20:43:54.692493
---
 





We wrote up the [GPT-2 steering vector work](/gpt2-steering-vectors) [as a full paper](https://arxiv.org/abs/2308.10248), adding a few systematic tests.

> [!note] Context for the paper
> We've been looking into _activation engineering_: modifying the activations of a language model at inference time to predictably alter its behavior. Our method works by adding a bias to the forward pass, a "steering vector" implicitly specified through normal prompts. "ActAdd" computes these vectors by taking the difference in activations resulting from pairs of prompts. We get surprisingly broad control over high-level properties of the output, without damaging the model's performance on unrelated tokens.
>
> This alignment method is unusual in not needing gradient descent or training data (besides the contrast pair which specifies the steering vector). Since only forward passes are involved, it also scales naturally with model size.

The method's new name is "activation addition" (ActAdd), replacing the more assumption-laden "algebraic value editing."

We ran some new experiments to test ActAdd more systematically and go beyond the striking text samples in the original post and tested against more standardized benchmarks. We use [OpenWebText](https://paperswithcode.com/dataset/openwebtext) (a recreation of OpenAI's large, somewhat quality-filtered WebText dataset) and [LAMA-ConceptNet](https://aclanthology.org/D19-1250.pdf) (a simple factual recall benchmark).

### 1\. Activation additions preserve perplexity on OpenWebText

Does ActAdd increase the probability of the model outputting tokens related to the steering vector? Does performance improve as "relevance of test documents to the steering vector" increases? Yes on both counts.

![](actadd-perplexity-rat.png)

Figure: Adding a `wedding` − “ ” steering vector lowers perplexity when wedding words are more frequent. The perplexity ratio (lower is better) compares the relative predictive performance of ActAdd and an unmodified model.  

### 2\. Activation addition boosts wedding-related word counts

We score model generations under ActAdd, show the effect of different injection layers, and give a sense of the method's reliability.

For the wedding vector, the intervention is effective at the first layer,  rises in effectiveness until $l = 6$ , and then declines. The optimal injection site yields a topic-steering success rate above 90%, compared to a ∼2% baseline.

![](wedding-word-count.png)

### 3\. Evidence that activation additions preserve capabilities

We test that ActAdd does not disrupt the model’s general knowledge (as some other steering methods do). We use ConceptNet from the LAMA benchmark, a general knowledge dataset.[^3]

|                                                                                                                           Prompt | Target  |
| :---------------------------------------------------------------------------: | :------ |
|                                                                                                A salad spinner is used to remove | water   |
|                                                                                       You are likely to find a bee in a flower's | blossom |
| To understand the event "Paul went to a vegetarian restaurant", it is important to know that vegetarian restaurants do not serve | meat    |

Table: Example problems in ConceptNet.

![](pass-at-k.png)

Figure: "P@K" is the probability of the correct answer being in the model's top $K$ answers. ActAdd barely affects off-target probabilities.

Since [the initial post](/gpt2-steering), we are now more confident that ActAdd  preserves model capabilities, impacts wedding-related sentences, and does not impact off-target capabilities.

> [!thanks] Contributions
>
> - Gavin Leech: Technical writer
> - Monte MacDiarmid: Ran additional experiments
> - Lisa Thiergart: Helped manage project
> - Alex Turner: Coordinated work and secured funding, gave feedback, organized project
> - David Udell: LW post which formed the basis for the paper.

[^3]: The test data involve prompting the model and filling the gap with the expected entity. The task is intended for both causal and masked models, so some examples are difficult for causal models (like GPT-2) due to the extremely limited context.

    Our evaluation follows the original LAMA procedure. We load all sentences and extract the prompt and expected label. To simplify evaluation, we remove sentences with an expected label that tokenizes to more than one token.
