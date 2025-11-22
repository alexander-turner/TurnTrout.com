---
permalink: questioning-why-simple-alignment-plan-fails
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/22xf8GmwqGzHbiuLg/seriously-what-goes-wrong-with-reward-the-agent-when-it
lw-is-question: 'true'
lw-posted-at: 2022-08-11T22:22:32.198000Z
lw-last-modification: 2023-06-01T20:26:14.384000Z
lw-curation-date: None
lw-frontpage-date: 2022-08-12T08:25:53.590000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 42
lw-base-score: 87
lw-vote-count: 50
af-base-score: 40
af-num-comments-on-upload: 13
title: Seriously, what goes wrong with 'reward the agent when it makes you smile'?
lw-latest-edit: 2022-08-11T22:23:09.276000Z
lw-is-linkpost: 'false'
tags:
  - AI
aliases:
  - seriously-what-goes-wrong-with-reward-the-agent-when-it
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2022-08-11 00:00:00
original_url: 
  https://www.lesswrong.com/posts/22xf8GmwqGzHbiuLg/seriously-what-goes-wrong-with-reward-the-agent-when-it
skip_import: true
description: "Reinforcing AI for smiles: simple, yet potentially disastrous? I'm less
  certain than most. Let's explore why."
date_updated: 2025-11-22 00:21:52.667251
---








Suppose you're training a huge neural network with some awesome future RL algorithm with clever exploration bonuses and a self-supervised pretrained multimodal initialization and a recurrent state. This NN implements an embodied agent which takes actions in reality (and also in some sim environments). You watch the agent remotely using a webcam (initially unbeknownst to the agent). When the AI's activities make you smile, you press the antecedent-computation-reinforcer button (known to some as the "reward" button). The agent is given some appropriate curriculum, like population-based self-play, so as to provide a steady skill requirement against which its intelligence is sharpened over training. Supposing the curriculum trains these agents out until they're generally intelligent—what comes next?

The standard response is "One or more of the agents gets smart, does a treacherous turn, kills you, and presses the reward button forever."
: But [reward is not the optimization target](/reward-is-not-the-optimization-target). This story isn't _impossible_, but I think it's pretty improbable, and _definitely not a slam-dunk_.

Another response is "The AI paralyzes your face into smiling."
: But this is actually a highly nontrivial claim about the internal balance of value and computation which this reinforcement schedule carves into the AI. Insofar as this response implies that an AI will primarily "care about" literally making you smile, that seems like a highly speculative and unsupported claim about the AI internalizing a single powerful decision-relevant criterion / shard of value, which also happens to be related to the way that humans conceive of the situation (i.e. someone is being made to smile).

My current answer is "I don't know precisely what goes wrong, but probably something does, but also I suspect I could write down mechanistically plausible-to-me stories where things end up bad but not horrible." I think the AI will probably have a spread of situationally-activated computations which steer its actions towards historical reward-correlates (e.g. if near a person, then tell a joke), and probably not singularly value e.g. making people smile or reward. Furthermore, [I think its values won't all map on to the "usual" quantities-of-value](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=cuTotpjqYkgcwnghp):

> [!quote] [A recent comment of mine](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=cuTotpjqYkgcwnghp)
> 80% credence: It's hard to train an inner agent which reflectively equilibrates to an EU maximizer only over commonly postulated motivating quantities (like `# of diamonds` or `# of happy people` or `reward-signal`) and not quantities like (`# of times I have to look at a cube in a blue room` or `-1 * subjective micromorts accrued`).

So, I'm pretty uncertain about what happens here, but would guess that most other researchers are less uncertain than I am. So here's an opportunity for us to talk it out!

My mood here isn't "And this is what we do for alignment, let's relax." My mood is "Why consider super-complicated reward and feedback schemes when, as far as I can tell, we don't know what's going to happen in this relatively simple scheme? [How do reinforcement schedules map into inner values](https://www.lesswrong.com/posts/xqkGmfikqapbJ2YMj/shard-theory-an-overview)?"
