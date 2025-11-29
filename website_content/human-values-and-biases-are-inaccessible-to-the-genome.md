---
permalink: human-values-and-biases-are-inaccessible-to-the-genome
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: 
  https://www.lesswrong.com/posts/CQAMdzA4MZEhNRtTp/human-values-and-biases-are-inaccessible-to-the-genome
lw-is-question: "false"
lw-posted-at: 2022-07-07T17:29:56.190000Z
lw-last-modification: 2023-12-26T18:42:00.324000Z
lw-curation-date: None
lw-frontpage-date: 2022-07-07T18:10:04.822000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 54
lw-base-score: 93
lw-vote-count: 52
af-base-score: 42
af-num-comments-on-upload: 38
title: Human values & biases are inaccessible to the genome
lw-latest-edit: 2022-08-30T00:01:07.814000Z
lw-is-linkpost: "false"
tags:
  - shard-theory
  - human-values
  - understanding-the-world
aliases:
  - human-values-and-biases-are-inaccessible-to-the-genome
lw-sequence-title: Shard Theory
lw-sequence-image-grid: sequencesgrid/igo7185zypqhuclvbmiv
lw-sequence-image-banner: sequences/ot2siejtvcl9pvzly2ma
sequence-link: posts#shard-theory
prev-post-slug: humans-provide-alignment-evidence
prev-post-title: Humans provide an untapped wealth of evidence about alignment
next-post-slug: general-alignment-properties
next-post-title: General alignment properties
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2022-07-07 00:00:00
original_url: 
  https://www.lesswrong.com/posts/CQAMdzA4MZEhNRtTp/human-values-and-biases-are-inaccessible-to-the-genome
skip_import: "true"
description: The genome can't directly hardwire complex human values like "fear of
  death." Those values probably arise from simpler, hardcoded learning mechanisms.
date_updated: 2025-11-22 00:21:52.667251
---








> [!info]
> Related to Steve Byrnes’ [_Social instincts are tricky because of the “symbol grounding problem.”_](https://www.lesswrong.com/s/HzcM2dkCq7fwXBej8/p/5F5Tz3u6kJbTNMqsb#13_2_2_Claim_2__Social_instincts_are_tricky_because_of_the__symbol_grounding_problem_) I wouldn’t have had this insight without several great discussions with Quintin Pope.

TL;DR: It seems hard to scan a trained neural network and locate the AI’s learned “tree” abstraction. For similar reasons, it seems intractable for the genome to scan a human brain and back out the “death” abstraction, which probably will not form at a predictable neural address. Therefore, I infer that the genome can’t _directly_ make us afraid of death by e.g. specifying circuitry which detects when we think about death and then makes us afraid. In turn, this implies that there are a _lot_ of values and biases which the genome cannot hardcode.

<hr/>

In order to understand the human alignment situation confronted by the human genome, consider the AI alignment situation confronted by human civilization. For example, we may want to train a smart AI which learns a sophisticated world model, and then motivate that AI according to its learned world model. Suppose we want to build an AI which intrinsically values trees. Perhaps we can just provide a utility function that queries the learned world model and counts how many trees the AI believes there are.

Suppose that the AI [will learn a reasonably human-like concept for “tree.”](https://www.lesswrong.com/posts/Nwgdq6kHke5LY692J/alignment-by-default#Unsupervised__Natural_Abstractions) However, before training has begun, the learned world model is inaccessible to us. Perhaps the learned world model will be buried deep within a recurrent policy network, and buried _within_ the world model is the “trees” concept. But we have no idea what learned circuits will encode that concept, or how the information will be encoded. We probably can’t, in advance of training the AI, write an algorithm which will examine the policy network’s hidden state and reliably back out how many trees the AI thinks there are. The AI’s learned concept for “tree” is [_inaccessible information_](https://ai-alignment.com/inaccessible-information-c749c6a88ce?gi=56ff6de02281) from our perspective.

Likewise, [the human world model is inaccessible to the human genome](https://www.alignmentforum.org/posts/NkSpukDkm9pjRdMdB/human-instincts-symbol-grounding-and-the-blank-slate#CCA_theory_vs_human_universal_traits_and_instincts), because the world model is probably in the cortex and the cortex is probably [randomly initialized](https://www.alignmentforum.org/posts/wBHSYwqssBGCnwvHg/intro-to-brain-like-agi-safety-2-learning-from-scratch-in).[^1] Learned human concepts are therefore inaccessible to the genome, in the same way that the “tree” concept is _a priori_ inaccessible to us. Even the [broad area where language processing occurs](<https://en.wikipedia.org/wiki/Functional_specialization_(brain)>) [varies from person to person](https://www.sciencedirect.com/science/article/pii/S1053811911009281?casa_token=x95ovxmnEnYAAAAA:UbdXjjpeJIqBO9V-wRR-OqtOc7b-_Gen741XNBWDXmJ_UPH7C4IAaYLZ3lBo4xpmWwiSCYOBvA), to say nothing of the encodings and addresses of particular learned concepts like “death.”

I’m going to say things like “the genome cannot specify circuitry which detects when a person is thinking about death.” This means that the genome cannot hardcode circuitry which e.g. fires when the person is thinking about death, and does not fire when the person is not thinking about death. The genome _does_ help indirectly specify the whole adult brain and all its concepts, just like _we_ indirectly specify the trained neural network via the training algorithm and the dataset. That doesn’t mean we can tell when the AI thinks about trees, and it doesn’t mean that the genome can “tell” when the human thinks about death.

When I’d previously thought about human biases (like the sunk cost fallacy) or values (like caring about other people), I had implicitly imagined that genetic influences could directly affect them (e.g. by detecting when I think about helping my friends, and then producing reward). However, given the inaccessibility obstacle, I infer that this can’t be the explanation. I infer that the genome _cannot_ directly specify circuitry which:

- Detects when you’re thinking about seeking power,
- Detects when you’re thinking about cheating on your partner,
- Detects whether you perceive a sunk cost,
- Detects whether you think someone is scamming you and, if so, makes you want to punish them,
- Detects whether a decision involves probabilities and, if so, implements the [framing effect](https://www.simplypsychology.org/framing-effect.html),
- Detects whether you’re thinking about your family,
- Detects whether you’re thinking about goals, and makes you [conflate terminal and instrumental goals](https://www.readthesequences.com/Terminal-Values-And-Instrumental-Values),
- Detects and then navigates ontological shifts,

  - An example: Suppose you learn that animals are made out of cells. I infer that the genome cannot: (1) detect that you are expanding your ontology and then (2) execute some genetically hard-coded algorithm which helps you do that successfully.

- Detects when you’re thinking about wireheading yourself or manipulating your reward signals,
- Detects when you’re thinking about reality versus non-reality (like a simulation or fictional world), or
- Detects whether you think someone is higher-status than you.

Conversely, the genome _can_ access direct sensory observables, because those observables involve _a priori_\-fixed “neural addresses.” For example, the genome could hardwire a cute-face-detector which hooks up to [retinal ganglion cells](https://en.wikipedia.org/wiki/Retinal_ganglion_cell) (which are at genome-predictable addresses), and then this circuit could produce physiological reactions (like the release of reward). This kind of circuit seems totally fine to me.

In total, information inaccessibility is strong evidence for the genome hard coding relatively simple[^2] cognitive machinery. This, in turn, implies that human values/biases/high-level cognitive observables are produced by relatively simpler hardcoded circuitry, specifying e.g. the learning architecture, the broad reinforcement learning and self-supervised learning systems in the brain, and regional learning hyperparameters. Whereas before it seemed plausible to me that the genome hardcoded a lot of the above bullet points, I now think that’s pretty implausible.

When I realized that the genome must also confront the information inaccessibility obstacle, this threw into question a lot of my beliefs about human values, about the complexity of human value formation, and about the structure of my own mind. I was left with a huge puzzle. If we can’t say “[the hardwired circuitry down the street did it](https://www.readthesequences.com/Occams-Razor)”, where do biases come from? [How can the genome hook the human’s preferences into the human’s world model, when the genome doesn’t “know” what the world model will look like](https://arbital.com/p/ontology_identification/)? Why do people usually navigate ontological shifts properly, why don’t they want to wirehead, why do they almost always care about other people _if the genome can’t even write circuitry that detects and rewards thoughts about people_?

A fascinating mystery, no? More on that soon.

> [!thanks]
> Thanks to Adam Shimi, Steve Byrnes, Quintin Pope, Charles Foster, Logan Smith, Scott Viteri, and Robert Mastragostino for feedback.

# Appendix: The inaccessibility trilemma

The logical structure of this essay is that at least one of the following must be true:

1. Information inaccessibility is somehow a surmountable problem for AI alignment (and the genome surmounted it),
2. The genome solves information inaccessibility in some way we cannot replicate for AI alignment, or
3. The genome cannot directly address the vast majority of interesting human cognitive events, concepts, and properties. (_The point argued by this essay_)

In my opinion, either (1) or (3) would be enormous news for AI alignment. More on (3)’s importance in future essays.

# Appendix: Did evolution have advantages in solving the information inaccessibility problem?

Yes, and no. In a sense, evolution had “a lot of tries” but is “dumb”, while we have few tries at AGI while ourselves being able to do consequentialist planning.

In the AI alignment problem, we want to be able to back out an AGI’s concepts, but we cannot run lots of similar AGIs and select for AGIs with certain effects on the world. Given the [natural abstractions hypothesis](https://www.alignmentforum.org/posts/Fut8dtFsBYRz8atFF/the-natural-abstraction-hypothesis-implications-and-evidence), maybe there’s a lattice of convergent abstractions—first learn edge detectors, then shape detectors, then people being visually detectable in part as compositions of shapes. And _maybe_, for example, people tend to convergently situate these abstractions in similar relative neural locations: The edge detectors go in V1, then the shape detectors are almost always in some other location, and then the person-concept circuitry is learned elsewhere in a convergently reliable position relative to the edge and shape detectors.

There’s a problem with this story. A congenitally blind person [develops dramatically different functional areas](https://academic.oup.com/cercor/article/25/9/2507/2926061?login=false), which suggests in particular that their person-concept will be at a radically different relative position than the convergent person-concept location in sighted individuals. Therefore, any genetically hardcoded circuit which checks at the relative address for the person-concept which is reliably situated for sighted people, will not look at the right address for congenitally blind people. Therefore, if this story were true, congenitally blind people would lose any important value-formation effects ensured by this location-checking circuit which detects when they’re thinking about people. So, either the human-concept-location-checking circuit wasn’t an important cause of the blind person caring about other people (and then this circuit hasn’t explained the question we wanted it to, which is how people come to care about other people), or there isn’t such a circuit to begin with. I think the latter is true, and the convergent relative location story is wrong.

That said, the location-checking circuit is only _one way_ the human-concept-detector could be implemented. Therefore, given enough selection and time, maybe evolution could evolve a circuit which checks whether you’re thinking about other people. _Maybe_. But it seems implausible to me (<4\%). I’m going to prioritize explanations for “most people care about other people” which don’t require a fancy workaround.

EDIT: After talking with Richard Ngo, I now think there's about an 8% chance that several interesting mental events are accessed by the genome; I updated upwards from 4%.

> [!info] Edited on August 29, 2022
> Updating down to 3%, in part due to 1950's arguments on ethology:
>
> > [!quote] [Lehrman on Lorenz’s Theory of Instinctive Behavior](https://webcache.googleusercontent.com/search?q=cache:YDe53OIPs6cJ:https://www.rabe.org/lehrman-on-lorenzs-theory-of-instinctive-behavior/&cd=1&hl=en&ct=clnk&gl=us)
> >
> > How do we want to explain the origins of behavior? And \[Lehrman's\] critique seems to echo some of the concerns with evolutionary psychology. His approach can be gleaned from his example on the pecking behavior of chicks. **Lorenz attributed this behavior to innate forces:** **The chicks are born with the tendency to peck; it might require just a bit of maturation. Lehrman points out that research by Kuo provides an explanation based on the embryonic development of the chick. The pecking behavior can actually be traced back to movements that developed while the chick was still unhatched. Hardly innate! The main point Lehrman makes: If we claim that something is innate, we stop the scientific investigation without fully understanding the origin of the behavior.** This leaves out important – and fascinating – parts of the explanation because we think we’ve answered the question. As he puts it: **“the statement “It is innate” adds nothing to an understanding of the developmental process involved.”**

> [!note] Edited on October 21, 2024
> Updated upwards to 30% due to the discovery of [gradient routing](/gradient-routing), which seems to offer coarse localization abilities. It's not clear that our genome can or does route cognitive updates to cortical areas, but it seems possible!

[^1]: Human values can still be inaccessible to the genome even if the cortex isn’t learned from scratch, but learning-from-scratch is a nice and clean sufficient condition which seems likely to me.
[^2]: I argue that the genome probably hardcodes neural circuitry which is simple _relative_ to hardcoded “high-status detector” circuitry. Similarly, [the code for a machine learning experiment](https://github.com/leela-zero/leela-zero/tree/next/src) is simple _relative_ to [the neural network it trains](https://arxiv.org/abs/2201.13176).
