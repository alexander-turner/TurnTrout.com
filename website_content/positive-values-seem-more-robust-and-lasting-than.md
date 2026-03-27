---
permalink: robustness-of-positive-values
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/cHnQ4bBFr3cX6rBxh/positive-values-seem-more-robust-and-lasting-than
lw-is-question: 'false'
lw-posted-at: 2022-12-17T21:43:31.627000Z
lw-last-modification: 2023-03-26T00:29:07.381000Z
lw-curation-date: None
lw-frontpage-date: 2022-12-18T19:05:40.549000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 13
lw-base-score: 52
lw-vote-count: 23
af-base-score: 25
af-num-comments-on-upload: 8
title: Positive values seem more robust and lasting than prohibitions
lw-latest-edit: 2022-12-17T21:43:31.826000Z
lw-is-linkpost: 'false'
tags:
  - AI
  - shard-theory
  - human-values
aliases:
  - positive-values-seem-more-robust-and-lasting-than
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2022-12-17 00:00:00
original_url: 
  https://www.lesswrong.com/posts/cHnQ4bBFr3cX6rBxh/positive-values-seem-more-robust-and-lasting-than
skip_import: true
description: Negative values ("don't kill") may be fragile. Positive values ("protect
  people") might be more robust and lasting within AI agents.
date_updated: 2025-11-22 00:21:52.667251
---








Imagine we train an AI on realistic situations where it can kill people, and penalize it when it does so. Suppose that we successfully instill a strong and widely activated "If going to kill people, then don't" value shard.

Even assuming this much, the situation seems fragile. See, many value shards are self-chaining. In [The shard theory of human values](/shard-theory), I wrote about how:

1. A baby learns "IF juice in front of me, THEN drink",
2. The baby is later near juice, and then turns to see it, activating the learned "reflex" heuristic, learning to turn around and look at juice when the juice is nearby,
3. The baby is later far from juice, and bumbles around until they're near the juice, whereupon she drinks the juice via the existing heuristics. This teaches "navigate to juice when you know it's nearby."
4. Eventually this develops into a learned planning algorithm incorporating multiple value shards (e.g. juice and friends) so as to produce a single locally coherent plan.
5. ...

The juice shard _chains into itself,_ as its outputs cause the learning process to further reinforce and generalize the juice-shard. This shard reinforces itself across time and thought-steps.

A "don't kill" shard seems like it should remain... stubby? Primitive? The "don't kill" shard can't self-chain into _not_ doing something. If you're going to kill someone, and then don't because of the don't-kill shard, and that avoids predicted negative reward... Then maybe the "don't kill" shard gets reinforced and generalized a bit because it avoided negative reward (and so reward was higher than predicted, which I think would trigger e.g. a reinforcement event in people).

On my current guesses and intuitions[^1]—that shard doesn't become more sophisticated, it doesn't [become reflective](/a-shot-at-the-diamond-alignment-problem#The-agent-becomes-reflective), it doesn't "agentically participate" in the internal shard politics (e.g. the agent's "meta-ethics", deciding what kind of agent it "wants to become"). Other parts of the agent _want things_, they want paperclips or whatever, and that's harder to do if the agent isn't allowed to kill anyone.

Crucially, the no-killing injunction can probably be steered around by the agent's other values. While the obvious route of lesioning the no-killing shard might be reflectively predicted by the world model to lead to more murder, and therefore bid against _by_ the no-killing shard... To overcome this obstacle, other value shards (e.g. paperclips and cow-breeding) might bid up lesioning plans which are optimized so as to not make the killing a salient plan feature to the reflective world-model, and thus, the plan does not activate the no-killing shard.

This line of argumentation is a point in favor of the following: Don't embed a shard which doesn't want to kill. Make a shard which wants to protect / save / help people. _That_ can chain into itself across time.

> [!note] Other notes
>
> - Deontology seems most durable to me when it can be justified on consequentialist grounds. Perhaps this is one mechanistic reason why.
> - Robustness of positive values supports the "convergent consequentialism" hypothesis, in some form.
> - I think that people are not usually defined by negative values (e.g. "don't kill"), but by positives, and perhaps this is important.

[^1]: Which I won't actually detail right now.
