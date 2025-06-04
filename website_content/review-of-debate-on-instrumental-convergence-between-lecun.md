---
permalink: review-of-debate-on-instrumental-convergence
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/ZPEGLoWMN242Dob6g/review-of-debate-on-instrumental-convergence-between-lecun
lw-is-question: 'false'
lw-posted-at: 2021-01-12T03:57:06.655000Z
lw-last-modification: 2021-01-12T17:05:55.320000Z
lw-curation-date: None
lw-frontpage-date: 2021-01-12T04:52:03.224000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 1
lw-base-score: 40
lw-vote-count: 13
af-base-score: 16
af-num-comments-on-upload: 1
publish: true
title: Review of 'Debate on Instrumental Convergence between LeCun, Russell, Bengio,
  Zador, and More'
lw-latest-edit: 2021-01-12T17:05:56.148000Z
lw-is-linkpost: 'false'
tags:
  - AI
  - instrumental-convergence
aliases:
  - review-of-debate-on-instrumental-convergence-between-lecun
lw-reward-post-warning: 'true'
use-full-width-images: 'false'
date_published: 2021-01-12 00:00:00
original_url: 
  https://www.lesswrong.com/posts/ZPEGLoWMN242Dob6g/review-of-debate-on-instrumental-convergence-between-lecun
skip_import: true
card_image:
description: Experts clash on the dangers of "instrumental convergence" in AI, but
  clear definitions and formal thought are sorely needed.
date_updated: 2025-06-03 22:57:00.423836
---





In the summer of 2019, I was building up a corpus of basic reinforcement learning theory. I wandered through a sun-dappled Berkeley, my head in the clouds, [my mind bent on a single ambition](/problem-relaxation-as-a-tactic#Formalizing-Instrumental-Convergence): proving the existence of instrumental convergence.

Somehow.

I needed to find the right definitions first, and I couldn't even _imagine_ what the [final theorems](https://arxiv.org/abs/1912.01683v6) would say. The fall crept up on me... and found my work incomplete.

Let me tell you: if there's ever been a time when I wished I'd been months ahead on my research agenda, it was September 26, 2019: the day when world-famous AI experts [debated](https://www.facebook.com/story.php?story_fbid=10156248637927143&id=722677142) whether instrumental convergence was a thing, and whether we should worry about it.

The debate unfolded below the link-preview: an imposing robot staring the reader down, a title containing 'Terminator', a byline dismissive of AI risk:

![](https://assets.turntrout.com/static/images/posts/dont_fear.avif)
<br/>Figure: [**Don’t Fear the Terminator**](https://blogs.scientificamerican.com/observations/dont-fear-the-terminator/?fbclid=IwAR3bzsKy92K0cRTuJ-E1CTFvRZILWgIRVM5EgzPsoSsYqwOZX8_7LmmZkBw): "Artificial intelligence never needed to evolve, so it didn’t develop the survival instinct that leads to the impulse to dominate others."  
  
The byline seemingly [affirms the consequent](https://en.wikipedia.org/wiki/Affirming_the_consequent). "Evolution $\implies$  survival instinct" does not imply "no evolution $\implies$ no survival instinct." That said, the article raises at least one good point: _We_ choose the AI's objective, and so why must that objective incentivize power-seeking?

I wanted to reach out, to say, "hey, here's [a paper](https://arxiv.org/abs/1912.01683v6) formalizing the question you're all confused by!". But it was too early.

Now, at least, I can say what I wanted to say back then:

This debate about instrumental convergence is really, really confused. I heavily annotated the play-by-play of the debate [in a Google doc](https://docs.google.com/document/d/1Y9ga5lS3c6ilZeZ2v2RLEe3x-io0RLDQsdp0HKorZR8/edit?usp=sharing), mostly checking local validity of claims. (**Most of this review's object-level content is in that document, by the way.**)

> [!warning] Looking back from the future (September 2024)
> Sadly, the Google doc seems to have been lost to time. I think I hosted the document from my `oregonstate.edu` email, which I lost access to in 2022. Archive, archive, archive.

This debate took place in the _pre-theoretic_ era of instrumental convergence. Over the last year and a half, I've become a lot less confused about instrumental convergence. I think [my formalisms](/seeking-power-is-often-convergently-instrumental-in-mdps) provide great abstractions for understanding "instrumental convergence" and "power-seeking." I think that this debate suffers for lack of formal grounding, and I wouldn't dream of introducing someone to these concepts via this debate.

While the debate is clearly historically important, I don't think it belongs in the LessWrong review. I don't think people significantly changed their minds, I don't think that the debate was particularly illuminating, and I don't think it contains the philosophical insight I would expect from a LessWrong review-level essay.

> [!quote] [Rob Bensinger's nomination](https://www.lesswrong.com/posts/WxW6Gc6f2z3mzmqKs/debate-on-instrumental-convergence-between-lecun-russell?commentId=yHqJhiWapTtAb4vNM)
>
> May be useful to include in the review with some of the comments, or with a postmortem and analysis by Ben (or someone).
>
> I don't think the discussion stands great on its own, but it may be helpful for:
>
> - people familiar with AI alignment who want to better understand some human factors behind 'the field isn't coordinating or converging on safety'.
> - people new to AI alignment who want to use the views of leaders in the field to help them orient.

I certainly agree with Rob's first bullet point. The debate did show us what certain famous AI researchers thought about instrumental convergence, circa 2019.

However, I disagree with the second bullet point: reading this debate may _disorient_ a newcomer! While I often found myself agreeing with Russell and Bengio, while LeCun and Zador sometimes made good points, confusion hangs thick in the air. No one realizes that, with respect to a fixed task environment (representing the real world) and their beliefs about what kind of objective function the agent may have, they should be debating the _probability_ that seeking power is optimal (or that power-seeking behavior is _learned_, depending on your threat model).
