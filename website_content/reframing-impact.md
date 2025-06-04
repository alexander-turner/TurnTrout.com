---
permalink: reframing-impact
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/xCxeBSHqMEaP3jDvY/reframing-impact
lw-is-question: 'false'
lw-posted-at: 2019-09-20T19:03:27.898000Z
lw-last-modification: 2024-03-02T01:17:47.939000Z
lw-curation-date: 2020-03-03T19:55:30.511000Z
lw-frontpage-date: 2019-09-20T19:31:05.356000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 15
lw-base-score: 98
lw-vote-count: 45
af-base-score: 29
af-num-comments-on-upload: 4
publish: true
title: Reframing Impact
lw-latest-edit: 2021-08-25T18:32:59.440000Z
lw-is-linkpost: 'false'
tags:
  - impact-regularization
  - AI
aliases:
  - reframing-impact
lw-sequence-title: Reframing Impact
lw-sequence-image-grid: sequencesgrid/jlnkhq3volgajzks64sw
lw-sequence-image-banner: sequences/fahwqcjgc6ni0stdzxb3
sequence-link: posts#reframing-impact
next-post-slug: value-impact
next-post-title: Value Impact
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2019-09-20 00:00:00
original_url: https://www.lesswrong.com/posts/xCxeBSHqMEaP3jDvY/reframing-impact
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/3LocEy9.png
description: A foundational examination of "impact" for AI alignment, exploring why
  some actions matter more and how to formalize these intuitions.
date_updated: 2025-06-03 22:57:00.423836
---







![](https://assets.turntrout.com/static/images/posts/3LocEy9.avif )
![](https://assets.turntrout.com/static/images/posts/IUOudUK.avif)
![](https://assets.turntrout.com/static/images/posts/GyP8V1D.avif )
![](https://assets.turntrout.com/static/images/posts/fEqZh8g.avif)
![](https://assets.turntrout.com/static/images/posts/wXmF1eX.avif)
![](https://assets.turntrout.com/static/images/posts/Rjz9usG.avif )
![](https://assets.turntrout.com/static/images/posts/1722a733b38bd3e06602ab967807e30117054d26051c5c84.avif)
![](https://assets.turntrout.com/static/images/posts/ZppOEZJ.avif )
​![](https://assets.turntrout.com/static/images/posts/knzoLGJ.avif)
![](https://assets.turntrout.com/static/images/posts/kIT2ULN.avif)
![](https://assets.turntrout.com/static/images/posts/iSqriuT.avif )
​![](https://assets.turntrout.com/static/images/posts/p4OkxJ1.avif)
![](https://assets.turntrout.com/static/images/posts/nFoDRoL.avif)
![](https://assets.turntrout.com/static/images/posts/e6vNG2D.avif)

# Appendix: First safeguard?

> [!note]
> This sequence is written to be broadly accessible, although perhaps its focus on capable AI systems assumes familiarity with [basic](https://www.youtube.com/watch?v=pARXQnX6QS8) [arguments](https://www.amazon.com/Human-Compatible-Artificial-Intelligence-Problem/dp/0525558616) [for](https://www.amazon.com/Superintelligence-Dangers-Strategies-Nick-Bostrom/dp/0198739834/ref=sr_1_3?keywords=Superintelligence&qid=1560704777&s=books&sr=1-3) [the](https://slatestarcodex.com/superintelligence-faq/) [importance](https://80000hours.org/problem-profiles/positively-shaping-artificial-intelligence/) [of](https://www.openphilanthropy.org/blog/potential-risks-advanced-artificial-intelligence-philanthropic-opportunity) [AI alignment](https://www.openphilanthropy.org/blog/some-background-our-views-regarding-advanced-artificial-intelligence). The technical appendices are an exception, targeting the technically inclined.

Why do I claim that an impact measure would be "the first proposed safeguard which maybe actually stops a powerful agent with an [imperfect](https://www.lesswrong.com/posts/iTpLAaPamcKyjmbFC/robust-delegation) objective from ruining things – without assuming anything about the objective"?

The safeguard proposal shouldn't have to say "and here we solve this opaque, hard problem, and then it works". If we have the impact measure, we have the math, and then we have the code.

So what about:

<dl>
<dt><a href="https://www.aaai.org/ocs/index.php/WS/AAAIW16/paper/view/12613" class="external alias" target="_blank">Quantilizers</a></dt>
<dd>This seems to be the most plausible alternative; mild optimization and impact measurement share many properties. But:
<ul>
<li>What happens if the agent is already powerful? A greater proportion of plans could be catastrophic, since the agent is in a better position to cause them.</li>
<li>Where does the base distribution come from (opaque, hard problem?), and how do we know it’s safe to sample from?</li>
<li>In the linked paper, Jessica Taylor suggests the idea of learning a human distribution over actions. How robustly would we need to learn this distribution? How numerous are catastrophic plans, and what <em>is</em> a catastrophe, defined without reference to our values in particular? (That definition requires understanding impact!)</li>
</ul>
</dd>
<dt><a href="https://www.lesswrong.com/s/4dHMdK5TLN6xcqtyc" class="external alias" target="_blank">Value learning</a></dt>
<dd>
<ul>
<li>We only want this if <em>our</em> (human) values are learned!</li>
<li><a href="https://papers.nips.cc/paper/7803-occams-razor-is-insufficient-to-infer-the-preferences-of-irrational-agents.pdf" class="external alias" target="_blank">Value learning is impossible without assumptions,</a> and <a href="https://www.lesswrong.com/s/4dHMdK5TLN6xcqtyc/p/EhNCnCkmu7MwrQ7yz" class="external alias" target="_blank">getting good enough assumptions could be really hard.</a> If we don’t know if we can get value learning ／reward specification right, we’d like safeguards which don’t fail because value learning goes wrong. The point of a safeguard is that it can catch you if the main thing falls through; if the safeguard fails because the main thing does, that’s pointless.</li>
</ul>
</dd>
<dt><a href="https://intelligence.org/files/Corrigibility.pdf" class="external alias" target="_blank">Corrigibility</a></dt>
<dd>At present, I’m excited about this property because I suspect it has a simple core principle. But
<ul>
<li>Even if the system is responsive to correction (and non-manipulative, and whatever other properties we associate with corrigibility), what if we become <em>unable</em> to correct it as a result of early actions—if the agent “moves too quickly”, so to speak?</li>
<li><a href="https://ai-alignment.com/corrigibility-3039e668638" class="external alias" target="_blank">Paul Christiano’s take on corrigibility</a> is much broader and an exception to this critique.</li>
<ul>
<li>What is the core principle?</li>
</ul>
</ul>
</dd>
</dl>

# Notes

- The three sections of this sequence will respectively answer three questions:
  1. Why do we think some things are big deals?
  2. Why are capable goal-directed AIs incentivized to catastrophically affect us by default?
  3. How might we build agents without these incentives?

- The first part of this sequence focuses on foundational concepts crucial for understanding the deeper nature of impact. We will not yet be discussing what to implement.
- I strongly encourage completing the exercises. At times you shall be given a time limit; it’s important to learn not only to reason correctly, but [with](https://www.readthesequences.com/The-Failures-Of-Eld-Science)[speed:](https://www.readthesequences.com/Einsteins-Speed)

> [!quote] [Thinking Physics](https://www.amazon.com/Thinking-Physics-Understandable-Practical-Reality/dp/0935218084)
>
> The best way to use this book is NOT to simply read it or study it, but to read a question and STOP. Even close the book. Even put it away and THINK about the question. Only after you have formed a reasoned opinion should you read the solution. Why torture yourself thinking? Why jog? Why do push-ups?
>
> If you are given a hammer with which to drive nails at the age of three you may think to yourself, "OK, nice." But if you are given a hard rock with which to drive nails at the age of three, and at the age of four you are given a hammer, you think to yourself, "What a marvellous invention!" You see, you can't really appreciate the solution until you first appreciate the problem.

- My paperclip-Balrog illustration is metaphorical: A good impact measure would hold steadfast against the daunting challenge of formally asking for the right thing from a powerful agent. The illustration does not represent an internal conflict within that agent. As water flows downhill, an impact-penalizing Frank prefers low-impact plans.
  - The Balrog drawing is based on [`gonzalokenny`'s amazing work](https://www.deviantart.com/gonzalokenny/art/Gandalf-and-the-Balrog-329465089).

- Some of you may have a different conception of impact; I ask that you grasp the thing that I’m pointing to. In doing so, you might come to see your mental algorithm is the same. Ask not “is this what I initially had in mind?”, but rather “does this make sense to call 'impact'?”.

> [!thanks]
> Thanks to Rohin Shah for suggesting the three key properties. Alison Bowden contributed several small drawings and enormous help with earlier drafts.
