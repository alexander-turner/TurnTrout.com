---
permalink: thoughts-on-human-compatible
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/FuGDYNvA6qh4qyFah/thoughts-on-human-compatible
lw-is-question: 'false'
lw-posted-at: 2019-10-10T05:24:31.689000Z
lw-last-modification: 2019-12-17T22:27:13.521000Z
lw-curation-date: None
lw-frontpage-date: 2019-10-10T05:54:45.161000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 34
lw-base-score: 64
lw-vote-count: 34
af-base-score: 20
af-num-comments-on-upload: 15
publish: true
title: Thoughts on 'Human-Compatible'
lw-latest-edit: 2019-12-17T22:27:13.803000Z
lw-is-linkpost: 'false'
tags:
  - AI
aliases:
  - thoughts-on-human-compatible
lw-reward-post-warning: 'true'
use-full-width-images: 'false'
date_published: 2019-10-10 00:00:00
original_url: https://www.lesswrong.com/posts/FuGDYNvA6qh4qyFah/thoughts-on-human-compatible
skip_import: true
description: Stuart Russell's "Human Compatible" makes the case for aligning AI with
  human values and sketches a research agenda based on uncertainty.
date_updated: 2025-06-03 22:57:00.423836
---







> [!quote] [_Human Compatible_](https://www.amazon.com/Human-Compatible-Artificial-Intelligence-Problem/dp/0525558616)
> The purpose of this book is to explain why \[superintelligence\] might be the last event in human history and how to make sure that it is not... The book is intended for a general audience but will, I hope, be of value in convincing specialists in artificial intelligence to rethink their fundamental assumptions.

Yesterday, I eagerly opened my copy of Stuart Russell's [_Human Compatible_](https://www.amazon.com/Human-Compatible-Artificial-Intelligence-Problem/dp/0525558616) (mirroring his _Center for Human-Compatible AI_, where I've worked the past two summers). I've been curious about Russell's research agenda, and _also_ how Russell argued the case so convincingly as to garner the following acclamations from two Turing Award winners:

 >[!quote] Judea Pearl
 > Human Compatible made me a convert to Russell's concerns with our ability to control our upcoming creation—super-intelligent machines. Unlike outside alarmists and futurists, Russell is a leading authority on AI. His new book will educate the public about AI more than any book I can think of, and is a delightful and uplifting read.

 > [!quote] Yoshua Bengio
 > This beautifully written book addresses a fundamental challenge for humanity: increasingly intelligent machines that do what we ask but not what we really intend. Essential reading if you care about our future.

Bengio even recently lent a reasoned voice to a [debate on instrumental convergence](https://www.lesswrong.com/posts/WxW6Gc6f2z3mzmqKs/debate-on-instrumental-convergence-between-lecun-russell)!

# Bringing the AI community up to speed

I think the book will greatly help AI professionals understand key arguments, avoid classic missteps, and appreciate the serious challenge humanity faces. Russell straightforwardly debunks common objections, writing with both candor and charm.

I must admit, it's great to see such a prominent debunking. I still remember, early in my concern about alignment, hearing one professional respond to the entire idea of being concerned about AGI with a lazy _ad hominem_ dismissal. Like, hello? We're talking about our future!

Russell realizes that most people don't intentionally argue in bad faith; he structures his arguments with the understanding and charity required to ease the difficulty of changing one's mind.[^polite]

[^polite]: Although I wish he'd be [more polite with LeCun](https://www.lesswrong.com/posts/WxW6Gc6f2z3mzmqKs/debate-on-instrumental-convergence-between-lecun-russell), understandable as his frustration may be.

More important than having fish, however, is knowing how to fish; Russell helps train the right mental motions in his readers:

> With a bit of practice, you can learn to identify ways in which the achievement of more or less any fixed objective can result in arbitrarily bad outcomes. \[Russell goes on to describe specific examples and strategies\] (p. 139)

He somehow explains the difference between the Platonic assumptions of RL and the reality of a human-level reasoner, _while also_ introducing wireheading. He covers the [utility-reward gap](https://www.lesswrong.com/posts/bG4PR9uSsZqHg2gYY/utility-reward), explaining that our understanding of real-world agency is so crude that we can't even coherently talk about the "purpose" of e.g. AlphaGo. He explains instrumental subgoals. These bits are so, so good.

Now for the main course, for those already familiar with the basic arguments:

# The agenda

> [!warning] Disclaimer
> Please realize that I'm replying to my understanding of Russell's agenda as communicated in a nontechnical book for the general public; I also don't have a mental model of Russell personally. Still, I'm working with what I've got.

Here's my summary: reward uncertainty through some extension of a CIRL-like setup, accounting for human irrationality through our scientific knowledge, doing aggregate preference utilitarianism for all of the humans on the planet, discounting people by how well their beliefs map to reality, perhaps down-weighting motivations such as envy (to mitigate the problem of everyone wanting [positional goods](https://en.wikipedia.org/wiki/Positional_good)). One challenge is towards what preference-shaping situations the robot should guide us (maybe we need meta-preference learning?). Russell also has a vision of many agents, each working to reasonably pursue the wishes of their owners (while being considerate of others).

I'm going to simplify the situation and just express my concerns about the case of one irrational human, one robot.

> [!quote] [fully updated deference](https://arbital.com/p/updated_deference/):
>
> One possible scheme in AI alignment is to give the AI a state of moral uncertainty implying that we know more than the AI does about its own utility function, as the AI's meta-utility function defines its ideal target. Then we could tell the AI, "You should let us shut you down because we know something about your ideal target that you don't, and we estimate that we can optimize your ideal target better without you."
>
> The obstacle to this scheme is that belief states of this type also tend to imply that an even better option for the AI would be to learn its ideal target by observing us. Then, having 'fully updated', the AI would have no further reason to 'defer' to us, and could proceed to directly optimize its ideal target.

which Russell partially addresses by advocating ensuring realizability, and avoiding feature misspecification by (somehow) allowing for dynamic addition of previously unknown features (see also [_Incorrigibility in the CIRL Framework_](https://arxiv.org/abs/1709.06275)). But supposing we don't have this kind of model misspecification, I don't see how the "AI simply fully computes the human's policy, updates, and then no longer lets us correct it" issue is addressed. If you're really confident that computing the human policy lets you just extract the true preferences under the realizability assumptions, maybe this is fine? I suspect Russell has more to say here that didn't make it onto the printed page.

There's also the issue of getting a good enough human mistake model, _and_ figuring out people's beliefs, all while attempting to learn their preferences (see the [value learning](https://www.lesswrong.com/s/4dHMdK5TLN6xcqtyc) sequence).

Now, it would be pretty silly to reply to an outlined research agenda with "but specific problems X, Y, and Z!", because the whole point of further research is to solve problems. However, my concerns are more structural. Certain AI designs lend themselves to more robustness against things going wrong (in specification, training, or simply having fewer assumptions). It seems to me that the uncertainty-based approach is quite demanding on getting component after component "right enough".

Let me give you an example of something which is intuitively "more robust" to me:

> [!quote] [Approval-directed agency](https://www.lesswrong.com/posts/7Hr8t6xwuuxBTqADK/approval-directed-agents-1)
>
> Consider a human Hugh, and an agent Arthur who uses the following procedure to choose each action:
>
> `Estimate the expected rating Hugh would give each action if he considered it at length. Take the action with the highest expected rating.`

Here, the approval-policy does what a predictor says to do at each time step, which is different from maximizing a signal. Its _shape_ feels different to me; the policy isn't _shaped_ to maximize some reward signal (and pursue instrumental subgoals). Errors in prediction almost certainly don't produce a policy adversarial to human interests.

How does this compare with the uncertainty approach? Let's consider one thing it seems we need to get right:

## Where in the world is the human?

How will the agent robustly locate the human whose preferences it's learning, and why do we need to worry about this?

Well, a novice might worry "what if the AI doesn't properly cleave reality at its joints, relying on a bad representation of the world?". But, having good predictive accuracy is instrumentally useful for maximizing the reward signal, so we can expect that its implicit representation of the world continually improves (i.e. it comes to find a nice efficient encoding). We don't have to worry about this - the AI is incentivized to get this right.

However, if the AI is meant to deduce and further the preferences of that single human, it has to find that human. But, before the AI is operational, how do we point to _our_ concept of "this person" in a yet-unformed model whose encoding probably doesn't cleave reality along those same lines? Even if we fix the structure of the AI's model so we _can_ point to that human, it might then have instrumental incentives to modify the model so it can make better predictions.

Why does it matter so much that we point exactly to the human? Well, then we're extrapolating the "preferences" of something that is not the person (or a person?) - the predicted human policy in this case seems highly sensitive to the details of the person or entity being pointed to. This seems like it could easily end in tragedy, and (strong belief, weakly held) doesn't seem like the kind of problem that has a clean solution. This sort of thing seems to happen quite often for proposals which hinge on ontologies.

[Human action models, mistake models, etc. are also difficult in this way](https://www.lesswrong.com/s/4dHMdK5TLN6xcqtyc/p/cnC2RMWEGiGpJv8go), and we have to get them right. I'm not necessarily worried about the difficulties themselves, but that the framework seems so sensitive to them.

# Conclusion

This book is most definitely an important read for both the general public and AI specialists, presenting a thought-provoking agenda with worthwhile insights (even if I don't see how it all ends up fitting together). To me, this seems like a key tool for outreach.

Just think: In how many worlds does alignment research benefit from the advocacy of one of the most distinguished AI researchers ever?
