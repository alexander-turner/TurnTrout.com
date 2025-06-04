---
permalink: topology-textbook-review
lw-was-draft-post: "false"
lw-is-af: "false"
lw-is-debate: "false"
lw-page-url: 
  https://www.lesswrong.com/posts/TSLnckszv4Tb5cHmt/continuous-improvement-insights-from-topology
lw-is-question: "false"
lw-posted-at: 2020-02-22T21:58:01.584000Z
lw-last-modification: 2020-02-25T19:34:02.586000Z
lw-curation-date: None
lw-frontpage-date: 2020-02-22T22:54:35.388000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 4
lw-base-score: 30
lw-vote-count: 9
af-base-score: 10
af-num-comments-on-upload: 0
publish: true
title: "Continuous Improvement: Insights from 'Topology'"
lw-latest-edit: 2020-02-25T19:34:03.925000Z
lw-is-linkpost: "false"
tags:
  - summaries
aliases:
  - continuous-improvement-insights-from-topology
lw-sequence-title: Becoming Stronger
lw-sequence-image-grid: sequencesgrid/fkqj34glr5rquxm6z9sr
lw-sequence-image-banner: sequences/oerqovz6gvmcpq8jbabg
sequence-link: posts#becoming-stronger
prev-post-slug: managerial-decision-making-review
prev-post-title: "Judgment Day: Insights from 'Judgment in Managerial Decision Making'"
next-post-slug: ordinary-differential-equations-textbook-review
next-post-title: "ODE to Joy: Insights from 'A First Course in Ordinary Differential
  Equations'"
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2020-02-22 00:00:00
original_url: 
  https://www.lesswrong.com/posts/TSLnckszv4Tb5cHmt/continuous-improvement-insights-from-topology
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/k6b4WRE.png
description: Reviewing Munkres' "Topology", reflecting on compactness, homotopy, and
  what I was even doing with my life before understanding homeomorphisms.
date_updated: 2025-06-03 22:57:00.423836
---









Sometimes you really like someone, but you can't understand why. By all means, you should have tired of them long ago, but you keep coming back. Welcome, my friend, to [_Topology_](https://www.amazon.com/Topology-2nd-James-Munkres/dp/0131816292).

This book is a good one, but boy was it _slow_ (349 pages at ~30 minutes a page, on average). I just kept coming back, and I was slowly rewarded each time I did.

Note: `sil ver` [already reviewed _Topology_](https://www.lesswrong.com/posts/rYumRQK3G9cqvaxQ7/insights-from-munkres-topology).

# Topology

Topology is about what it means for things to be "close" in an abstract and general sense. Rather than taking on the monstrous task of intuitively explaining topology without math, I'm just going to talk about random things from the book and (literally) illustrate concepts which were at first confusing.

## Compactness is a wonderful kind of mathematical "smallness"

> [!quote] [_What Does Compactness Really Mean?_](https://blogs.scientificamerican.com/roots-of-unity/what-does-compactness-really-mean/)
>
> [Compact](https://en.wikipedia.org/wiki/Compact_space) means small. It is a peculiar kind of small, but at its heart, compactness is a precise way of being small in the mathematical world. The smallness is peculiar because, as in the example of the open and closed intervals $(0,1)$ and $[0,1]$, a set can be made “smaller” (that is, compact) by adding points to it, and it can be made “larger” (non-compact) by taking points away.
>
> As a notion of smallness, then, compactness is a bit fraught. It’s a bit unsettling to say that a set can be “smaller” than a set that lies entirely inside it! But I think smallness is a valuable way to see compactness. A set that is compact may be large in area and complicated, but the fact that it is compact means we can interact with it in a finite way using open sets, the building blocks of topology.

[Minimum description length says that an explanation is big if its shortest computational specification is long](https://www.readthesequences.com/Occams-Razor). You can have a simple explanation of a long list of things or of a large universe, and extremely complicated explanations of things easily expressed in natural language (God's source code would be _a lot_ longer than Maxwell's equations).

[VC dimension says a class of hypotheses is hard to learn if it has lots of predictive degrees of freedom](https://en.wikipedia.org/wiki/Vapnik%E2%80%93Chervonenkis_dimension). You can have an infinite class of hypotheses which is really easy to learn because it has low VC dimension (thresholding functions at value $\theta$), and a finite class which is really hard to learn because it has high VC dimension (all C programs less than 1 million characters).

[Compactness says that a topological space is big if it has a covering of open sets that can't be trimmed down to a finite subcollection which still covers the whole space](https://en.wikipedia.org/wiki/Compact_space). You can have an uncountable compact space ($[0,1]$ under the standard topology, or even a [Cantor space](https://en.wikipedia.org/wiki/Cantor_space)), and a countable space which isn't compact ($\mathbb{Q}$ under the standard topology; note that all countable topological spaces have to at least be [Lindelof](https://en.wikipedia.org/wiki/Lindel%C3%B6f_space)).

### Compactness is not always inherited by open subspaces

At first, I was confused why _open_ subspaces $Y$ of compact $X$ don't have to be compact (if $Y$ is closed, it does have to be compact). But compactness requires _all_ open coverings of $Y$ to have a finite subcover. Meaning, you can't just give it $X$'s finite cover intersect the subspace, because the finite subcover has to be a subcollection of $Y$'s covering.

## Getting closure

> [!math] Theorem
> If $X$ is compact, the projection $\pi_2 : X \times Y \to Y$ is closed.

I was confused why we needed compactness. Essentially, I didn't understand [the tube lemma](https://dantopology.wordpress.com/2011/05/01/the-tube-lemma/).

![](https://assets.turntrout.com/static/images/posts/qmbh27L.avif)

Now let's prove the theorem. Suppose $C$ is closed in $X \times Y$. We want to show $f(C)$ is also closed. Take $y\not \in \pi(C)$. $(X\times Y)-C$ is an open set of the domain containing the slice $X \times \{y\}$. Since $X$ is compact, apply the tube lemma to get a tube $X \times U$. The projection of this tube is both open (because $U$ is open in $Y$) and disjoint from $\pi(C)$ (because the tube is contained in $(X\times Y)-C$). Thus, all $y \not \in \pi(C)$ have an open neighborhood disjoint from $\pi(C)$, so $\pi(C)$ must be closed.

> [!math] Another exercise
> Let $X$ be a locally compact space. If $f:X\to Y$ is continuous, does it follow that $f(X)$ is locally compact? What if $f$ is both continuous and open?

It has to be both continuous and open; the reason I got confused here was it seemed like continuity should be enough. It _was_ plain to me how to prove it given $f$ open, but [this SE post](https://math.stackexchange.com/questions/1287344/continuous-image-of-a-locally-compact-space-is-locally-compact) has a good counterexample for just $f$ continuous.

## Multivariate continuity

How come you can have discontinuous multivariate functions which are continuous in each variable? What _is_ continuity, with a product space as your domain? To simplify matters, let’s consider two metric spaces $X, Y$.

One definition of continuity uses open sets: $f:X\to Y$ is continuous at $x$ if, for every open neighborhood $U$ of $f(x)$, there exists an open neighborhood $V$ of $x$ such that $f(V)\subseteq U$.

Another definition uses topological convergence. $f:X\to Y$ is continuous at $x$ if, for every sequence $x_n\to x$, $f(x_n)\to f(x)$.

These definitions are equivalent. The latter lets us think about how different winding paths you can take in a domain always must topologically converge to the same thing in the co-domain.

![](https://assets.turntrout.com/static/images/posts/k6b4WRE.avif)

Continuity in the variables says that paths along the axes converge in the right way. But for continuity overall, we need _all_ paths to converge in the right way. Directional continuity when the domain is $\mathbb{R}$ is a special case of this: continuity from below and from above if and only if continuity for all sequences converging topologically to $x$.

## You only lift once

Suppose $p:C\to Y$ is a [covering map](https://en.wikipedia.org/wiki/Covering_space). One way of understanding [lifts](https://en.wikipedia.org/wiki/Lift_\(mathematics\)) in algebraic topology is that, for some path $f:X\to Y$, the lift $\tilde{f}:X\to C$ is the unique path in the covering space $C$ corresponding to $f=p\circ \tilde{f}$.

![](https://assets.turntrout.com/static/images/posts/psLCumW.avif)

Once you fix the initial point, the lift corresponds to the unique path in the covering space which produces $f$. It's just helping you find the corresponding path in the lifted up covering space!

## Homotopy

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/HomotopySmall.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/HomotopySmall.webm" type="video/webm"></video>

This concept yields amazing insight into such profound topics as the deeper nature of jump rope. Under the standard subspace topology of $\mathbb{R}^3$, consider the space swept out by a rope held at fixed endpoints and tautness. All paths between the endpoints are path homotopic! You can think about movements of the rope (either clockwise or counterclockwise) as homotopies in this space.

## Miscellaneous

- I stopped at about section 56 because I was getting diminishing returns. By this point, I felt like I had a solid understanding of point-set topology, and look forward to more thoroughly covering algebraic topology in the future.
- One-point compactifications feel like an important thing to grasp, and they're fun to play around with mentally. I skipped Stone-Cech compactification.
- Completeness in metric spaces means that Cauchy sequences converge topologically; in other words, nothing can "escape" from the space. I remember having problems with this (and with thinking about non-Hausdorff spaces) [back when I was learning analysis](/second-analysis-textbook-review). Things feel a lot better now.

## Verdict

_Topology_ can be dry, but it's exceedingly well-written and clear. I tried for quite a while to find a better topology book, but I didn't.

# Forwards

Finally getting around to topology was such a good decision. For exercise solutions, see both MathOverflow and [this site](https://dbfin.com/topology/munkres/).

Some things change how you look at math, help you notice subtleties and shades and immediately grasp certain facets of new mathematical objects. Topology is one of these things, as is abstract algebra. Learning that an object is a group, or finitely generated, or isomorphic to a more familiar structure gives me an immediate head start. Similarly, learning that spaces are homeomorphic, or compact, or second-countable is _such_ a boost.

What was I even _doing_ with my life before I knew about homeomorphisms?
