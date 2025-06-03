---
permalink: against-rewards-over-observations
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/AeHtdxHheMjHredaq/what-you-see-isn-t-always-what-you-want
lw-is-question: "false"
lw-posted-at: 2019-09-13T04:17:38.312000Z
lw-last-modification: None
lw-curation-date: None
lw-frontpage-date: 2019-09-13T06:04:52.254000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 12
lw-base-score: 30
lw-vote-count: 10
af-base-score: 11
af-num-comments-on-upload: 8
publish: true
title: "What You See Isn't Always What You Want"
lw-latest-edit: 2024-08-15T22:29:06.757000Z
lw-is-linkpost: "false"
tags:
  - "AI"
  - "reinforcement-learning"
aliases:
  - "what-you-see-isn-t-always-what-you-want"
lw-reward-post-warning: "true"
use-full-width-images: "false"
date_published: 2019-09-13 00:00:00
original_url: https://www.lesswrong.com/posts/AeHtdxHheMjHredaq/what-you-see-isn-t-always-what-you-want
skip_import: true
description: Markovian reward functions are underdefined. Aligning AI isn't about
  designing the "right" reward, but designing rewards compatible with how the world
  is.
date_updated: 2025-01-30 09:30:36.233182
---





> [!failure] No longer endorsed. This isn't how reward functions work.

It’s known to be hard to give non-trivial goals to reinforcement learning agents. However, I haven’t seen much discussion of the following: even ignoring wireheading, it seems impossible to specify reward functions that get what we want – at least, if the agent is farsighted, smart, and can’t see the entire world all at once, and the reward function only grades what the agent sees in the moment. If this really is impossible in our world, then the designer’s job gets way harder.

> [!note] Technical restatement
> Even ignoring wireheading, it could be impossible to supply a reward function such that most optimal policies lead to desirable behavior – at least, if the agent is farsighted and able to compute the optimal policy, the environment is partially observable (which it is, for the real world), and the reward function is Markovian.

I think it’s important to understand _why_ and _how_ the designer’s job gets harder, but first, the problem.

Let’s suppose that we magically have a reward function which, given an image from the agent’s camera, outputs what an idealized person would think of the image. That is, given an image, suppose a moral and intelligent person considers the image at length (magically avoiding issues of slowly becoming a different person over the course of reflection), figures out how good it is, and produces out a scalar rating – the reward.

The problem here is that multiple world states can correspond to the same camera input. Is it good to see a fully black image? I don’t know – what else is going on? Is it bad to see people dying? I don’t know, are they real, or perfectly Photoshopped? I think this point is obvious, but I want to make it so I can move on to the interesting part: there just isn’t enough information to meaningfully grade inputs. Contrast with being able to grade universe-histories via utility functions: just assign 1 to histories that lead to better things than we have right now, and 0 elsewhere.

> [!note] Technical restatement
> The problem is that the mapping from world state to images is _not at all injective_... in contrast, grading universe-histories directly doesn’t have this problem: simply consider an indicator function on histories leading to better worlds than the present (for some magical, philosophically valid definition of “better”).

Now, this doesn’t mean we need to have systems grading world states. But what I’m trying to get at is, Markovian reward functions are fundamentally underdefined. To say the reward function will incentivize the right things, we have to consider the possibilities available to the agent: which path through time is the best?

The bad thing here is that the reward function is no longer actually grading what the agent sees, but rather trying to output the right things to shape the agent’s behavior in the right ways. For example, to consider the behavior incentivized by a reward function linear in the number of blue pixels, we have to think about how the world is set up. We have to see, oh, this doesn’t just lead to the agent looking at blue objects; rather, there exist better possibilities, like showing yourself solid blue images forever.

Although maybe there don’t exist such possibilities – maybe we have _in fact_ made it so the only way to get reward is by looking at blue objects. The only way to tell is by looking at the dynamics – at how the world changes as the agent acts. In many cases, you simply cannot make statements like “the agent is optimizing for $X$ ” without accounting for the dynamics.

Under this view, alignment isn’t a property of reward functions: it’s a property of a reward function in an environment. This problem is much, much harder: we now have the joint task of designing a reward function such that the best way of stringing together favorable observations lines up with what we want. This task requires thinking about how the world is structured, how the agent interacts with us, the agent’s possibilities at the beginning, how the agent’s learning algorithm affects things…

Yikes.

## Qualifications

The argument seems to hold for $n$\-step Markovian reward functions, if $n$ isn’t ridiculously large. If the input observation space is rich, then the problem probably relaxes. The problem isn't present in fully observable environments: by force of theorem (which presently assumes determinism and a finite state space), there exist Markovian reward functions whose only optimal policy is desirable.

This doesn’t apply to e.g. Iterated Distillation and Amplification (updates based on policies), or Deep RL from Human Preferences (observation trajectories are graded). That is, you can get a wider space of optimal behaviors by updating policies on information other than a Markovian reward.

It’s possible (and possibly even likely) that we use an approach for which this concern just doesn’t hold. However, this “what you see” concept feels important to understand, and serves as the billionth argument against specifying Markovian observation-based reward functions.

> [!thanks]
>Thanks to Rohin Shah and `TheMajor` for feedback.
