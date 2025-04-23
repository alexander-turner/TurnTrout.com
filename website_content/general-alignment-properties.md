---
permalink: general-alignment-properties
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/FMdGt9S9irgxeD9Xz/general-alignment-properties
lw-is-question: 'false'
lw-posted-at: 2022-08-08T23:40:47.176000Z
lw-last-modification: 2022-08-15T03:43:38.799000Z
lw-curation-date: None
lw-frontpage-date: 2022-08-09T00:21:51.605000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 2
lw-base-score: 50
lw-vote-count: 23
af-base-score: 26
af-num-comments-on-upload: 2
publish: true
title: General alignment properties
lw-latest-edit: 2022-08-08T23:46:29.764000Z
lw-is-linkpost: 'false'
tags:
  - AI
  - shard-theory
aliases:
  - general-alignment-properties
sequence-link: posts#shard-theory
lw-sequence-title: Shard Theory
prev-post-slug: human-values-and-biases-are-inaccessible-to-the-genome
prev-post-title: Human Values & Biases Are Inaccessible to the Genome
next-post-slug: reward-is-not-the-optimization-target
next-post-title: Reward Is Not the Optimization Target
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2022-08-08 00:00:00
original_url: https://www.lesswrong.com/posts/FMdGt9S9irgxeD9Xz/general-alignment-properties
skip_import: 'true'
description: Comparing how AIXI and humans acquire values reveals important differences
  in how these agents interact with the world.
date_updated: 2025-01-30 09:30:36.233182
---





[AIXI](https://en.wikipedia.org/wiki/AIXI) and the genome are both ways of specifying intelligent agents.

1. Give AIXI a utility function (perhaps over observation histories), and hook it up to an environment, and this pins down a policy.[^1]
2. Situate the genome in the embryo within our reality, and this eventually grows into a human being with a policy of their own.

These agents have different "values", in whatever sense we care to consider. However, these two agent-specification procedures also have different _general alignment properties._

General alignment properties are not about _what_ a particular agent cares about (e.g. the AI "values" chairs). I call an alignment property "general" if the property would be interesting to a range of real-world agents trying to solve AI alignment. Here are some examples.

Terminally valuing latent objects in reality
:    AIXI only "terminally values" its observations and doesn't terminally value latent objects in reality, while humans generally care about e.g. dogs (which are latent objects in reality).

Navigating ontological shifts
:    Consider latent-diamond-AIXI (LDAIXI), an AIXI variant. LDAIXI's utility function which scans its top 50 hypotheses (represented as Turing machines), checks each work tape for atomic representations of diamonds, and then computes the utility to be the amount of atomic diamond in the world.

:    If LDAIXI updates sufficiently hard towards non-atomic physical theories, then it can no longer find any utility in its top 50 hypotheses. All policies now might have equal value (zero), and LDAIXI would not continue maximizing the expected diamond content of the future. From our viewpoint, LDAIXI has [failed to rebind its "goals"](https://arbital.com/p/ontology_identification/) to its new conceptions of reality. (From LDAIXI's "viewpoint", it has Bayes-updated on its observations and continues to select optimal actions.)

:    On the other hand, physicists do not stop caring about their friends when they learn quantum mechanics. Children do not stop caring about animals when they learn that animals are made out of cells. People seem to navigate ontological shifts pretty well.

Reflective reasoning / embeddedness
:    [AIXI can't think straight about how it is embedded in the world](https://www.lesswrong.com/posts/AszKwKyhBPZAnCstA/solomonoff-cartesianism). However, people quickly learn heuristics like "If I get angry, I'll be more likely to be mean to people around me", or "If I take cocaine now, I'll be even more likely to take cocaine in the future."

Fragility of outcome value to initial conditions / Pairwise misalignment severity
:    This general alignment property seems important to me, and I'll write a post on it. In short: How pairwise-unaligned are two agents produced with slightly different initial hyperparameters/architectural choices (e.g. reward function / utility function / inductive biases)?

<hr/>

I'm excited about people thinking more about general alignment properties and about what generates those properties.

[^1]: Supposing e.g. uniformly random tie-breaking for actions enabling equal expected utility.
