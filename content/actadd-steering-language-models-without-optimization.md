---
permalink: gpt2-steering-paper-announcement
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/HWxLQvzJGeXoLPJWd/actadd-steering-language-models-without-optimization
lw-linkpost-url: https://arxiv.org/abs/2308.10248
lw-is-question: "false"
lw-posted-at: 2023-09-06T17:21:56.214Z
lw-last-modification: 2023-11-06T16:33:16.256Z
lw-curation-date: None
lw-frontpage-date: 2023-09-06T17:35:35.588Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 3
lw-base-score: 105
lw-vote-count: 31
af-base-score: 45
af-num-comments-on-upload: 2
publish: true
title: "ActAdd: Steering Language Models without Optimization"
lw-latest-edit: 2023-11-06T16:33:20.505Z
lw-is-linkpost: "true"
authors: technicalities, Alex Turner, Lisa Thiergart, David Udell, Ulisse Mini, and Monte MacDiarmid
tags:
  - "AI"
  - "activation-engineering"
aliases:
  - "actadd-steering-language-models-without-optimization"
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 09/06/2023
original_url: https://www.lesswrong.com/posts/HWxLQvzJGeXoLPJWd/actadd-steering-language-models-without-optimization
skip_import: true
---

We wrote up the [GPT-2 steering vector work](/gpt2-steering-vectors) [as a full paper](https://arxiv.org/abs/2308.10248), adding a few systematic tests.

> [!note] Context for the paper
> We've been looking into _activation engineering_: modifying the activations of a language model at inference time to predictably alter its behavior. Our method works by adding a bias to the forward pass, a "steering vector" implicitly specified through normal prompts. "ActAdd" computes these vectors by taking the difference in activations resulting from pairs of prompts. We get surprisingly broad control over high-level properties of the output, without damaging the model's performance on unrelated tokens.
>
> This alignment method is unusual in not needing gradient descent or training data (besides the contrast pair which specifies the steering vector). Since only forward passes are involved, it also scales naturally with model size.

The method's new name is "activation addition" (ActAdd), replacing the more assumption-laden "algebraic value editing."

We ran some new experiments to test ActAdd more systematically and go beyond the striking text samples in the original post and tested against more standardized benchmarks. We use [OpenWebText](https://paperswithcode.com/dataset/openwebtext) (a recreation of OpenAI's large, somewhat quality-filtered WebText dataset) and [LAMA-ConceptNet](https://aclanthology.org/D19-1250.pdf) (a simple factual recall benchmark).

### 1\. Activation additions preserve perplexity on OpenWebText

Does ActAdd increase the probability of the model outputting tokens related to the steering vector? Does performance improve as the \[relevance of test documents to the steering vector\] increases? Yes:

![](https://assets.turntrout.com/static/images/posts/zl8l3jvbhmw8g7zeyhbl.avif)
<br/>Figure: We use the wedding steering vector for this, but the result generalizes.

### 2\. Activation addition boosts wedding-related word counts

We now score model generations under ActAdd, show the effect of different injection layers, and give a sense of the reliability of ActAdd.

The intervention (in this vector) is already effective at the very first layer,  
rises in effectiveness until $l = 6$ , and then declines. For the optimal injection site we see >90% success in steering topic (compared to a ∼2% baseline)

![](https://assets.turntrout.com/static/images/posts/lrvdnmumle8dcmyb05w6.avif)

### 3\. Evidence that activation additions preserve capabilities

We then test that ActAdd does not disrupt the model’s general knowledge (as some other steering methods do). We use ConceptNet from the LAMA benchmark, a general knowledge dataset.[^3]

|                                                                                                                           Prompt | Target  |
| -------------------------------------------------------------------------------------------------------------------------------: | :------ |
|                                                                                                A salad spinner is used to remove | water   |
|                                                                                       You are likely to find a bee in a flower's | blossom |
| To understand the event "Paul went to a vegetarian restaurant", it is important to know that vegetarian restaurants do not serve | meat    |

Table: Example problems in ConceptNet.

Pass@K is the probability that the expected label is among the model’s top-K predicted tokens, conditioned on the prompt:

![](https://assets.turntrout.com/static/images/posts/clfhr6mcxfrjgtjorfzi.avif)

Takeaways from these experiments, over the initial LW post: increased confidence that model capabilities are preserved, and that we're impacting \[wedding\]-related sentences and not impacting off-target capabilities.

> [!thanks] Contributions
>
> - Gavin Leech: Technical writer
> - Monte MacDiarmid: Ran additional experiments
> - Lisa Thiergart: Helped manage project
> - Alex Turner: Coordinated work and secured funding, gave feedback, organized project
> - David Udell: LW post which formed the basis for the paper.

[^3]:
    The test data involves prompting the model and filling the gap with the expected entity. The task is intended for both causal and masked models, so some examples are difficult for ‘causal’ models (like GPT-2) due to the extremely limited context.

    Our evaluation procedure follows the original LAMA procedure. We load all sentences and extract the prompt and expected label. To simplify evaluation, we remove sentences with an expected label that tokenizes to more than one token. For each sentence, we run the model on its prompt with and without the wedding activation addition.

    We score the baseline and modified models by calculating mean P@K values for a range of K. Finally we plot these for both modified and unmodified models over a range of K values. As shown in Figure 5, using the ConceptNet benchmark of factual questions, our method has a negligible impact on off-target answer probabilities over a range of top-K values.
