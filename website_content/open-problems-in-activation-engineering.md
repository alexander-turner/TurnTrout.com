---
permalink: open-problems-in-activation-engineering
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/JMebqicMD6azB8MwK/open-problems-in-activation-engineering
lw-linkpost-url: https://coda.io/@alice-rigg/open-problems-in-activation-engineering
lw-is-question: 'false'
lw-posted-at: 2023-07-24T19:46:08.733000Z
lw-last-modification: 2023-09-14T17:32:07.153000Z
lw-curation-date: None
lw-frontpage-date: 2023-07-25T01:02:04.531000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 2
lw-base-score: 51
lw-vote-count: 21
af-base-score: 24
af-num-comments-on-upload: 2
title: Open problems in activation engineering
lw-latest-edit: 2023-07-24T21:19:09.733000Z
lw-is-linkpost: 'true'
authors: Alex Turner, Alice Rigg, Lisa Thiergart, Monte MacDiarmid, and Ulisse Mini
tags:
  - AI
  - activation-engineering
aliases:
  - open-problems-in-activation-engineering
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2023-07-24 00:00:00
original_url: 
  https://www.lesswrong.com/posts/JMebqicMD6azB8MwK/open-problems-in-activation-engineering
skip_import: true
description: Open questions on controlling language models at runtime via activation
  engineering.
date_updated: 2025-11-22 00:21:52.667251
createBibtex: true
---







> [!quote] [Steering GPT-2-XL by adding an activation vector](/gpt2-steering-vectors)  
> \[We define\] **activation engineering** \[to be\] techniques which steer models by modifying their activations. As a complement to prompt engineering and finetuning, activation engineering is a low-overhead way to steer models at runtime.

These results were recently complemented by [Inference-Time Intervention: Eliciting Truthful Answers from a Language Model](https://www.lesswrong.com/posts/kuQfnotjkQA4Kkfou/inference-time-intervention-eliciting-truthful-answers-from), which doubled TruthfulQA performance by adding a similarly computed activation vector to forward passes!

We think that activation engineering offers easy wins for steering and understanding models. A few open problems from [the list](https://coda.io/@alice-rigg/open-problems-in-activation-engineering):

- Try decomposing the residual stream activations over a batch of inputs somehow (e.g. PCA). Using the principal directions as activation addition directions, do they seem to capture something meaningful?
- Take a circuit studied from existing literature on GPT2, or find another one using [ACDC](https://github.com/ArthurConmy/Automatic-Circuit-Discovery/tree/main). Targeting the nodes in these circuits, can you learn anything more about them and generally about how activation additions interact with circuits?
- What's the mechanism by which adding a steering vector with too large a coefficient breaks the model? ([Credit: Thomas Kwa](https://www.lesswrong.com/posts/5spBue2z2tw4JuDCx/steering-gpt-2-xl-by-adding-an-activation-vector?commentId=sAzDPXoQmAxxoKCi2); see also [@Ulisse Mini](https://www.lesswrong.com/users/ulisse-mini?mention=user)'s [initial data/explanation](https://www.lesswrong.com/posts/5spBue2z2tw4JuDCx/steering-gpt-2-xl-by-adding-an-activation-vector?commentId=FEGguDMzGbKojSQF9).)

If you want to work on activation engineering, come by the Slack server to [coordinate research projects and propose new ideas](https://join.slack.com/t/activationengineering/shared_invite/zt-1z82cqbrp-2YGwmTpYzQz3jTkPUXeNHg).
