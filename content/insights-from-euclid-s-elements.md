---
permalink: insights-from-euclids-elements
lw-was-draft-post: 'false'
lw-is-af: 'false'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/Wpf3Gsa8A89mmjkk8/insights-from-euclid-s-elements
lw-is-question: 'false'
lw-posted-at: 2020-05-04T15:45:30.711000Z
lw-last-modification: 2021-02-15T03:50:12.674000Z
lw-curation-date: 2020-05-15T19:31:00.065000Z
lw-frontpage-date: 2020-05-04T18:55:58.636000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 17
lw-base-score: 126
lw-vote-count: 57
af-base-score: 32
af-num-comments-on-upload: 0
publish: true
title: Insights from Euclid's 'Elements'
lw-latest-edit: 2021-02-15T03:50:14.043000Z
lw-is-linkpost: 'false'
tags:
  - scholarship-&-learning
  - understanding-the-world
aliases:
  - insights-from-euclid-s-elements
lw-sequence-title: Becoming Stronger
lw-sequence-image-grid: sequencesgrid/fkqj34glr5rquxm6z9sr
lw-sequence-image-banner: sequences/oerqovz6gvmcpq8jbabg
sequence-link: posts#becoming-stronger
prev-post-slug: problem-relaxation-as-a-tactic
prev-post-title: Problem relaxation as a tactic
next-post-slug: self-teaching-insights
next-post-title: Lessons I've Learned from Self-Teaching
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2020-05-04 00:00:00
original_url: 
  https://www.lesswrong.com/posts/Wpf3Gsa8A89mmjkk8/insights-from-euclid-s-elements
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/XbacNSL.png
description: Euclid's "Elements", but made beautiful. A colorful exploration of geometric
  proofs and the power of visual learning.
date_updated: 2024-12-05 16:17:06.041179
---






Presumably, I was taught geometry as a child. I do not remember.

Recently, I'd made my way halfway through a complex analysis textbook, only to find another which seemed more suitable and engaging. Unfortunately, the exposition was geometric. I knew something was wrong – I knew something had to change – when, asked to prove the similarity of two triangles, I got stuck on _page 7_.

I'd been reluctant to tackle geometry, and when authors reasoned geometrically, I'd find another way to understand. Can you blame me, when most geometric proofs look like _this_?

![](https://assets.turntrout.com/static/images/posts/FgW3bVj.avif)

Distasteful. In a graph with $n$ vertices, you'd need to commit $O(n^3)$ things to memory (e.g. triangles, angles) in order to read the proof without continually glancing at the illustration. In a normal equation with $n$ variables, it's $O(n)$.

Sometimes, we just need a little beauty to fall in love.

![](https://assets.turntrout.com/static/images/posts/rwpHVk0.avif)

Welcome to Oliver Byrne's rendition of Euclid's _Elements_, [digitized and freely available online](https://www.c82.net/euclid/).

![](https://assets.turntrout.com/static/images/posts/TV1jNnj.avif)

# Elements

> [!quote] [Oliver Byrne](https://www.c82.net/euclid/introduction/)
>
> Propoſitions are placed before a ſtudent, who though having a ſufficient underſtanding, is told juſt as much about them on entering at the very threſhold of the ſcience, as gives him a prepoſſeſſion moſt unfavourable to his future ſtudy of this delightful ſubject; or “the formalities and paraphernalia of rigour are ſo oſtentatiouſly put forward, as almoſt to hide the reality. Endleſs and perplexing repetitions, which do not confer greater exactitude on the reaſoning, render the demonſtrations involved and obſcure, and conceal from the view of the ſtudent the conſecution of evidence.”
>
> Thus an averſion is created in the mind of the pupil, and a ſubject fo calculated to improve the reaſoning powers, and give the habit of cloſe thinking, is degraded by a dry and rigid courſe of inſtruction into an unintereſting exerciſe of the memory.

## Equality and Similarity

Old mathematical writing lacks modern precision. Euclid says that two triangles are "equal", without specifying what that means. It means that one triangle can be turned into another via an [isometric transformation](https://en.wikipedia.org/wiki/Euclidean_plane_isometry). That is, if you rotate, translate, and/or reflect triangle $A$, it turns into triangle $B$.

[Similarity](<https://en.wikipedia.org/wiki/Similarity_(geometry)>) is a bit more lenient, because you can rescale as well:

![](https://assets.turntrout.com/static/images/posts/170px-SimilitudeL.svg.avif)

My favorite characterization of similarities is:

> As a map $f: \mathbb{R}^{n} \rightarrow \mathbb{R}^{n}$, a similarity of ratio $r$ takes the form $f(x):=rAx + t$, where $A \in O_{n}(\mathbb{R})$ is an $n×n$ orthogonal matrix and $t \in \mathbb{R}^{n}$ is a translation vector.

The only difference compared to congruence is that congruence requires $r=1$.

## Synthetic/analytic

I find it strange that Euclid got so far by axiomatizing informal notions without any grounding in formal set theory (e.g. ZFC). I mean, you'd get _absolutely blown away_ if you tried to pull these shenanigans in topology. But apparently, Euclidean geometry is sufficiently well-behaved that it basically matches our intuitions without much qualification?

## Area invariance

[Book 1, proposition 35](https://www.c82.net/euclid/book1/#prop35):

![](https://assets.turntrout.com/static/images/posts/xSipa0p.avif)

This says: suppose you draw two parallel lines, and then make a dash of length 2 on each line. Then, make another dash of length 2 on the upper line. The two parallelograms so defined have equal area. This is clarified in the next theorem.

![](https://assets.turntrout.com/static/images/posts/H5ZOo2I.avif)

If you take one of the dashes and slide it around on the upper parallel line, the resultant parallelograms all have the same area. I thought this was cool.

# Notes

There aren't any exercises; instead, I tried to first prove the theorems myself.

Book III treats circles, with wonderful results on arcs and their relation to angles. I search for a snappy example, a gem of an insight to share, but my words fail me. It's just good.

I read books I, III, IV, and skimmed II. Not all books of the Elements are about plane geometry; some are archaic introductions to number theory, for example. Those looking to learn number theory would do much better with the gorgeous [_Illustrated Theory of Numbers_](https://www.amazon.com/Illustrated-Theory-Numbers-Martin-Weissman/dp/1470434938).

# Forward

_Elements_ is a _tour de force_. Theorem, theorem, problem, theorem, all laid out in confident succession. It was not always known that from simple rules you could rigorously deduce beautiful facts. It was _not always known_ that you could start with so little, and end with so much.

Before I found this resource, I'd checked out several geometry books, all of which seemed bad. To salt the wound, many books were explicitly aimed at middle schoolers. This... was a bit of a blow.

However, it doesn't matter when something is normally presented. If you don't know something, you don't know it, and there's nothing wrong with learning it. Even if you feel late. Even if you feel sheepish.

## Against completionism

I'm glad I didn't read all of the books, even though they're beautiful. I'd picked up a bad "completionist" habit – if I don't read the whole book, obviously I haven't completed it, and obviously I'm not allowed to make a post about it. Of course.

But I'm trying to pick up useful skills, to expand the types of qualitative reasoning available to me, to get the most benefit per unit of reading. I stopped because I have what I need for my complex analysis book.

## Read around

Reading relevant Wikipedia pages / other textbooks helps me cross-examine my knowledge. It also helps connect the new knowledge to existing knowledge. For example, I now have a wonderfully enriched understanding of [the geometric mean](https://en.wikipedia.org/wiki/Geometric_mean).

Over time, as you expand and read more books, you'll find yourself reading faster and faster, understanding more and more subsections. [I don't recommend learning new areas via Wikipedia](https://www.lesswrong.com/posts/37sHjeisS9uJufi4u/scholarship-how-to-do-it-efficiently), but it's good reinforcement.

## Re-deriving dependencies as a habit

Ever since [I learned real analysis](/first-analysis-textbook-review), I reflexively reprove all new elementary mathematics whenever I use it. For real analysis, that meant _continually reproving_ e.g. $1+2=2+1$ whenever I used that property in a proof. Did it feel silly and tedious? A bit, yes.

But with (this) tedium comes power. I can now regenerate a formal foundation for the real numbers from the Peano axioms, proving the necessary properties about the natural numbers, then the integers, then the rationals, and then the reals, and then complex numbers too. (But please, no quaternions!)

With this habit, you continually ask yourself, "how do I know this?". I think this is a useful subskill of Actually Thinking.

## Commemoration

In college, I taught myself a bit of Japanese. Through a combination of spaced repetition software and memory palaces, and over the course of three months, I learned to read the [2,136 standard use characters](https://en.wikipedia.org/wiki/J%C5%8Dy%C5%8D_kanji). After those three months, I proudly displayed this poster on my wall:

![](https://assets.turntrout.com/static/images/posts/hcdZgoi.avif)

I look forward to another beautiful poster.

![](https://assets.turntrout.com/static/images/posts/vYNe9w0.avif)

> [!quote] Oliver Byrne
> As the ſenſes of ſight and hearing can be ſo forcibly and inſtantaneously addreſſed alike with one thouſand as with one, _the million_ might be taught geometry and other branches of mathematics with great eaſe, this would advance the purpoſe of education more than any thing that _might_ be named, for it would teach the people how to think, and not what to think; it is in this particular the great error of education originates.
