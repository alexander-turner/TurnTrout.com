---
permalink: danger-of-suggestive-terminology
lw-was-draft-post: "false"
lw-is-af: "false"
lw-is-debate: "false"
lw-page-url: 
  https://www.lesswrong.com/posts/yxWbbe9XcgLFCrwiL/dreams-of-ai-alignment-the-danger-of-suggestive-names
lw-is-question: "false"
lw-posted-at: 2024-02-10T01:22:51.715000Z
lw-last-modification: 2024-02-13T21:08:58.421000Z
lw-curation-date: None
lw-frontpage-date: 2024-02-10T18:40:44.410000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 58
lw-base-score: 97
lw-vote-count: 75
af-base-score: 34
af-num-comments-on-upload: 0
title: "Dreams of AI alignment: The danger of suggestive names"
lw-latest-edit: 2024-02-10T02:01:47.447000Z
lw-is-linkpost: "false"
tags:
  - AI
  - rationality
  - critique
aliases:
  - dreams-of-ai-alignment-the-danger-of-suggestive-names
  - dangers-of-suggestive-terminology
  - dreams-of-ai-alignment
  - dreams-of-alignment
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2024-02-10 00:00:00
original_url: 
  https://www.lesswrong.com/posts/yxWbbe9XcgLFCrwiL/dreams-of-ai-alignment-the-danger-of-suggestive-names
skip_import: true
description: 'AI alignment plagued by imprecise language. Ex: "reward" and "shoggoth"
  are suggestive words that obstruct clear thought.'
date_updated: 2025-11-22 00:21:52.667251
---











Let's not forget the old, well-read post: [Dreams of AI Design](https://www.lesswrong.com/posts/p7ftQ6acRkgo6hqHb/dreams-of-ai-design). In that essay, Eliezer correctly points out errors in imputing meaning to nonsense by using suggestive names to describe the nonsense. This error is relevant to understanding the problems facing [LessWrong's](http://www.lesswrong.com) intellectual contributions.

> [!quote] Quote from [Artificial intelligence meets natural stupidity](https://www.inf.ed.ac.uk/teaching/courses/irm/mcdermott.pdf)
>
> **A major source of simple-mindedness in AI programs is the use of mnemonics like "UNDERSTAND" or "GOAL" to refer to programs and data structures.** This practice has been inherited from more traditional programming applications, in which it is liberating and enlightening to be able to refer to program structures by their purposes. Indeed, part of the thrust of the structured programming movement is to program entirely in terms of purposes at one level before implementing them by the most convenient of the (presumably many) alternative lower-level constructs.
>
> ... If a researcher tries to write an "understanding" program, it isn't because he has thought of a better way of implementing this well-understood task, but because he thinks he can come closer to writing the first implementation. If he calls the main loop of his program "UNDERSTAND", he is (until proven innocent) merely begging the question. He may mislead a lot of people, most prominently himself, and enrage a lot of others.
>
> What he should do instead is refer to this main loop as `G0034`, and see if he can convince himself or anyone else that `G0034` implements some part of understanding. Or he could give it a name that reveals its intrinsic properties, like `NODE-NET-INTERSECTION-FINDER`, it being the substance of his theory that finding intersections in networks of nodes constitutes understanding...
>
> **When you say "GOAL", you can just feel the enormous power at your fingertips. It is, of course, an illusion.**[^1]
>
> Of course, Conniver has some glaring wishful primitives, too. Calling "multiple data bases" CONTEXTS was dumb. It implies that, say, sentence understanding in context is really easy in this system...

Consider the following terms and phrases:

- "LLMs are trained to predict/simulate"
  - "LLMs are predictors" (and then [trying to argue the LLM only predicts human values instead of acting on them!](https://www.lesswrong.com/posts/i5kijcjFJD6bn7dwq/evaluating-the-historical-value-misspecification-argument?commentId=AytgTwAwj8eGC8aSW))
- "Attention mechanism" (in self-attention)
- "AIs are incentivized to" (when talking about the reward or loss functions, thus implicitly reversing the true causality; reward optimizes the AI, but AI probably won't optimize the reward)
- "[Reward](https://www.lesswrong.com/posts/rmfjo4Wmtgq8qa2B7/think-carefully-before-calling-rl-policies-agents)" (implied to be an attractive quantity to the decision-maker)
  - "Advantage function" and "value function"
  - "The purpose of RL is to train an agent to maximize _expected_ reward over time" (perhaps implying an expectation and inner consciousness on the part of the so-called "agent")
- "[Agents](https://www.lesswrong.com/posts/rmfjo4Wmtgq8qa2B7/think-carefully-before-calling-rl-policies-agents)" (implying volition in our trained artifact... generally 'cuz we used a technique belonging to the class of algorithms which humans call "reinforcement learning")
- "Power-seeking" (AI "agents")
- "[Shoggoth](/against-shoggoth)"
- "Optimization pressure"
- "Utility"
  - As opposed to (thinking of it) as "internal unit of decision-making incentivization, which is a function of internal representations of expected future events; minted after the resolution of expected future on-policy inefficiencies relative to the computational artifact's current decision-making influences"

- "Inner goal / mesa objective / optimization daemon (yes, that was a real name)"
- "Outer optimizer" (perhaps implying some amount of intentionality; a sense that 'more' optimization is 'better', even at the expense of generalization of the trained network)
- "Optimal" (as opposed to equilibrated-under-policy-updates)
- "Objectives" (when conflating a "loss function as objective" and "something which strongly controls how the AI makes choices")
- "Simplicity prior"
  - Consider the abundance of amateur theorizing about whether "schemers" will be "simpler" than "saints", or whether they will be supplanted by "sycophants." Sometimes conducted in ignorance of actual inductive bias research, which is actually a real subfield of ML.

In broader machine learning, beware:
- "Training"
- "Learning"
- "Discount rate" (in deep RL, implying that an external future-learning-signal multiplier will ingrain itself into the AI's potential inner plan-grading-function which is conveniently assumed to be additive over timesteps, and also there's just one such function and also it's Markovian)
- "Reasoning" models (in inference-time scaling)
- "Hallucination"

> [!quote] Quote from [Artificial intelligence meets natural stupidity](https://www.inf.ed.ac.uk/teaching/courses/irm/mcdermott.pdf)
> Lest this all seem merely amusing, meditate on the fate of those who have tampered with words before. The behaviorists ruined words like "behavior", "response", and, especially, "learning." **They now play happily in a dream world, internally consistent but lost to science.** And think about this: if "mechanical translation" had been called "word-by-word text manipulation", the people doing it might still be getting government money.

Some of these terms are useful. Some of the academic imports are necessary for successful communication. Some of the terms have real benefits.

That doesn't stop them from distorting your thinking. At least in your private thoughts, you can do better. You can replace "optimal" with "artifact equilibrated under policy update operations" or "subjectively maximal expected utility relative to \[entity X\]'s imputed beliefs." One nice thing about brains is _these long phrases can compress into single concepts which you can instantly understand._

For years, bad habits have held back clear thinking in the AI alignment community. Let's do better.

[^1]: How many times has someone expressed "I'm worried about 'goal-directed optimizers', but I'm not sure what exactly they are, so I'm going to work on deconfusion"? There's something weird about this sentiment, don't you think?
