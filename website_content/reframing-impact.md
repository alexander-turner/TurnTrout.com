---
permalink: reframing-impact
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/xCxeBSHqMEaP3jDvY/reframing-impact
lw-is-question: "false"
lw-posted-at: 2019-09-20T19:03:27.898000Z
lw-last-modification: 2024-03-02T01:17:47.939000Z
lw-curation-date: 2020-03-03T19:55:30.511000Z
lw-frontpage-date: 2019-09-20T19:31:05.356000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 15
lw-base-score: 98
lw-vote-count: 45
af-base-score: 29
af-num-comments-on-upload: 4
title: Reframing Impact
lw-latest-edit: 2021-08-25T18:32:59.440000Z
lw-is-linkpost: "false"
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
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2019-09-20 00:00:00
original_url: https://www.lesswrong.com/posts/xCxeBSHqMEaP3jDvY/reframing-impact
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/3LocEy9.jpg
description: A foundational examination of "impact" for AI alignment, exploring why some actions matter more and how to formalize these intuitions.
date_updated: 2025-12-30 14:46:20.403471
card_image_alt: 'The word "Impact" is written in large blue letters inside a sparkling frame. Below, text reads: "Written and illustrated by Alex Turner." To the right, a small robot stands on a larger robot to build a tower of black blocks. The small robot tips over a small block, possibly leading to a block-avalanche.'
no_dropcap: "true"
---









![The word "Impact" is written in large blue letters inside a sparkling frame. Below, text reads: "Written and illustrated by Alex Turner." To the right, a small robot stands on a larger robot to build a tower of black blocks. The small robot tips over a small block, possibly leading to a block-avalanche.](https://assets.turntrout.com/static/images/posts/3LocEy9.avif)
![Handwritten text setting up a scenario: "Imagine we have a robot named Frank. Frank finds things for us in places we can't go. We provide a rule, and he returns with the object that best fits the rule. Right now, we want an intensely pink marble. Naturally, we ask Frank for the pinkest thing he can find." The text is accompanied by simple drawings of Frank—a friendly robot—and also a pink marble.](https://assets.turntrout.com/static/images/posts/IUOudUK.avif)
![A robot, Frank, is surrounded by several pink marbles. A light pink marble is labeled "worst" and a vibrant magenta marble is labeled "best". A key shows the "Preference ordering: pinkness" on a scale from light pink (worst) to magenta (best). Text below reads: "This seems fine. But what if Frank looks farther afield?"](https://assets.turntrout.com/static/images/posts/GyP8V1D.avif)
![A robot is surrounded by objects, with a "Preference ordering: pinkness" scale below. This scale ranks items from "worst" (a gray frown) to "best" (a pink smiley face), but creates a conflict illustrated by the text: "What if there are dangerous pink objects, like terrorists who will sell Frank for scrap?" The AI's optimized "'best'" outcome (a pink smiley) differs from the goal of "what we wanted" (a solid magenta circle).](https://assets.turntrout.com/static/images/posts/fEqZh8g.avif)
![A conceptual diagram explaining imperfect rules for AI. Text reads: "From our perspective, Frank has lost his marbles, but he's just following an imperfect rule...What simple rule avoids terrorists here?" A robot, Frank, is surrounded by objects. Text notes that "the terrorists are far away" and "Pinkness correlates with what we want, and the proximity rule avoids terrorists." A "Preference ordering: proximity" scale ranks objects from "worst" (farthest, including terrorists) to "best" (the nearest pink circle).](https://assets.turntrout.com/static/images/posts/wXmF1eX.avif)
![A diagram illustrating a bounded search for an AI named Frank. Frank is at the center of concentric circles representing distance. A "Search radius" scale shows that as the search area increases, pinker objects are found. Text reads: "We're probably fine with a reasonably pink marble. Then how about we have Frank find the pinkest object within a given distance, which we increase until we're satisfied?"](https://assets.turntrout.com/static/images/posts/Rjz9usG.avif)
![Text reads: "And now for the reveal. Frank is analogous to a powerful AI with an imperfect objective. The objects are plans he's considering, and the terrorists are catastrophic plans (some of which happen to score well). The question is then: How do we measure how distant plans are?" ](https://assets.turntrout.com/static/images/posts/1722a733b38bd3e06602ab967807e30117054d26051c5c84.avif)
![Desired impact measure properties: "1) Be easy to specify, 2) Put catastrophes far away, 3) Put reasonable plans nearby." An example map for a paperclip-making AI shows reasonable plans like "build a factory" nearby, while the catastrophic plan to "cover the planet with factories" is far away.](https://assets.turntrout.com/static/images/posts/ZppOEZJ.avif)
​![A graph plots events on a vertical "Goodness" axis and a horizontal "Intuitive impact" axis. The top-left quadrant (low impact, high goodness) shows a stick figure finding a dollar. The bottom-left (low impact, low goodness) shows a frustrated stick figure with a crashed computer. The top-right (high impact, high goodness) shows a peace sign over the Earth. The bottom-right (high impact, low goodness) shows a nuclear explosion. Text at the top: "These catastrophes seem like big deals. We're going to figure out why we intuit some things are big deals, develop an understanding of the relevant parts of reality, and then design an impact measure." Text on the right: "To me, the impactful things feel fundamentally different than the non-impactful things. I find this difference fascinating and beautiful, and look forward to exploring it with you."](https://assets.turntrout.com/static/images/posts/knzoLGJ.avif)
![Handwritten text argues that while "impact measurement" may not seem like a key problem for AI alignment, it is a new way of understanding how agents interact. It promises "spoils" like new frameworks and milestones, illustrated by a glowing treasure chest. The text concludes: "Here's one exciting milestone we're shooting for:"](https://assets.turntrout.com/static/images/posts/kIT2ULN.avif)
![Studying impact measurement for AI provides "spoils: new conceptual frameworks, fresh lines of inquiry, and important theoretical milestones." An open treasure chest filled with glowing gold illustrates these "spoils". The text concludes by teasing an "exciting milestone."](https://assets.turntrout.com/static/images/posts/iSqriuT.avif)
​![Text overlay: "An impact measure would be the first proposed safeguard which maybe actually stops a powerful agent with an imperfect objective from ruining things – without assuming anything about the objective. This is a rare property among approaches." The text lurks above an illustration paying homage to the iconic Gandalf-vs-Balrog scene in Moria. The demon's whip ends in a giant paperclip, a metaphor for a misaligned artificial intelligence.](https://assets.turntrout.com/static/images/posts/p4OkxJ1.avif)
![Handwritten: "We have our bearing. Let us set out together."](https://assets.turntrout.com/static/images/posts/nFoDRoL.avif)
![The interior of a cozy, hobbit-hole-like room with a round door open to a sunny landscape. Sunlight streams in, illuminating the tiled floor. Text over the view reads, "towards a new impact measure" and is rendered in a Tolkienesque font.](https://assets.turntrout.com/static/images/posts/e6vNG2D.avif)

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
