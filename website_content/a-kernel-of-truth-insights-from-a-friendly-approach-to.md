---
permalink: functional-analysis-textbook-review
lw-was-draft-post: 'false'
lw-is-af: 'false'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/jqME8gHyC9maaH7Rp/a-kernel-of-truth-insights-from-a-friendly-approach-to
lw-is-question: 'false'
lw-posted-at: 2020-04-04T03:38:56.537000Z
lw-last-modification: 2020-04-04T13:18:41.674000Z
lw-curation-date: None
lw-frontpage-date: 2020-04-03T23:22:02.762000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 3
lw-base-score: 32
lw-vote-count: 7
af-base-score: 12
af-num-comments-on-upload: 0
publish: true
title: "A Kernel of Truth: Insights from 'A Friendly Approach to Functional Analysis'"
lw-latest-edit: 2020-04-04T13:18:43.104000Z
lw-is-linkpost: 'false'
tags:
  - scholarship-&-learning
  - understanding-the-world
aliases:
  - a-kernel-of-truth-insights-from-a-friendly-approach-to
lw-sequence-title: Becoming Stronger
lw-sequence-image-grid: sequencesgrid/fkqj34glr5rquxm6z9sr
lw-sequence-image-banner: sequences/oerqovz6gvmcpq8jbabg
sequence-link: posts#becoming-stronger
prev-post-slug: ordinary-differential-equations-textbook-review
prev-post-title: "ODE to Joy: Insights from 'A First Course in Ordinary Differential
  Equations'"
next-post-slug: problem-relaxation-as-a-tactic
next-post-title: Problem relaxation as a tactic
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2020-04-04 00:00:00
original_url: 
  https://www.lesswrong.com/posts/jqME8gHyC9maaH7Rp/a-kernel-of-truth-insights-from-a-friendly-approach-to
skip_import: true
description: 'Functional analysis: infinite dimensions, discontinuous linear functions,
  and the headache-inducing functional derivative.'
date_updated: 2025-04-12 09:51:51.137842
---







What is functional analysis? A satisfactory answer requires going back to where it all started.

> [!quote] Once upon a time...
>
> "All are present; the meeting convenes," intoned Fredholm. Intent were the gathered faces, their thoughts fixed on their students. "_What do we know of their weaknesses?_".
>
> Hilbert leaned back, torch's light flickering across his features. "Lots of dimensions, especially when they need to find the Hessian. What if… what if we made them deal with _infinitely_ many dimensions?"...
>
> It was Banach who finally spoke. "David, they already know about the vector space for the polynomials".
>
> Hilbert smirked. "Who said anything about _countably_ infinite?". More silence, then glances, then grins.
>
> It was Riesz's voice which next broke the silence. "And we can make them do analysis in that space. And linear algebra, but not the easy parts. Of course, they'll need to also deal with complex numbers. Sprinkle a little topology and abstract algebra on top, because... they deserve –"
>
> "Frigyes, some of them might actually be able to do that. We need more." After a pause, Fredholm continued: "We'll tell them that they only need to know basic calculus."

# A Friendly Approach to Functional Analysis

I didn't actually find the book overly hard (it took me seven days to complete, which is how long it took for my first book, [_Naïve Set Theory_](/set-theory-textbook-review)), although there were some parts I skipped due to unclear exposition. it's actually one of my favorite books I've read in a while – it's for sure my favorite since the last one. That said, I'm glad I didn't attempt this early in my book-reading journey.

## My brain won't stop line to me

Some part of me _insisted_ that the left-shift mapping

$$
(x_1, x_2,… )\mapsto (x_2, x_3,… ) :\ell^{\infty }\rightarrow \ell^{\infty}
$$
is "non-linear" because it incinerates $x_1$! But wait, brain, this totally _is_ linear, and it's also continuous with respect to the ambient supremum norm!

Formally, a map $T$ is linear when $T(\alpha x + \beta y)=\alpha T(x) +\beta T(y)$.

Informally, linearity is about being able to split a problem into small parts which can be solved individually. It doesn't have to "look like a line", or something. In fact, lines[^1] $y=mx$ are linear _because_ putting in $\Delta x$ more $x$ gets you $m\cdot \Delta x$ more $y$!

## Linearity and continuity

Two things surprised me.

First, a(n infinite-dimensional) linear function can be discontinuous. 🤨

Second, a linear function $T$ is continuous if and only if it is bounded; that is, there is an $M >0$ such that $\forall x,x_0: | | T (x-x_0)| | \leq M | | x-x_{0 } | |$.

- The **if** is easy: this is just Lipschitz continuity, which obviously implies normal continuity.
- The other direction follows because the continuity implies that for $\epsilon:=1$, we can bound how much it's expanding the volume of some $\delta$-ball and then apply linearity.

## What the hell are functional derivatives?

Derivatives tell you how quickly a function is changing in each input dimension. In single-variable calculus, the derivative of a function $f:\mathbb{R}\to\mathbb{R}$ is a function $f':\mathbb{R}\to\mathbb{R}$.

In multi-variable calculus, the derivative of a function $g:\mathbb{R}^n\to\mathbb{R}$ is a function $g':\mathbb{R}^n\to\mathbb{R}^{n}$ – for a given $n$\-dimensional input vector, the real-valued output of $g$ can change differently depending on in which input dimension change occurs.

You can go even further and consider the derivative of $h:\mathbb{R}^n\to\mathbb{R}^m$, which is the function $h':\mathbb{R}^n\to\mathbb{R}^{n\times m}$ – for a given $n$\-dimensional input vector, $h$ again can change its vector-valued output differently depending on in which input dimension change occurs.

What if we want to differentiate the following function $L$, with range $\mathbb{R}$ domain the set of continuous functions bounded to $[a,b]$ - $C[a,b]$:

$$
 L(\mathbf{f}):=\int_{0}^{1} (\mathbf{f}(t))^{2} dt.
$$
How do you differentiate with respect to a function? I'm going to claim that

$$
 L'_{\mathbf{f}}(\mathbf{g})=\int_{0}^{1} 2\mathbf{f}(t)\mathbf{g}(t) dt.
$$
It's not clear why this is true, or what it even means. Here's an intuition: at any given point, there are uncountably many partial derivatives in the function space $C[a,b]$ – there are many, many "directions" in which we could "push" a function $\mathbf{f}$ around. $L'_{\mathbf{f}}(\mathbf{g})$ gives us the partial derivative at $\mathbf{f}$ with respect to $\mathbf{g}$.

This concept is important because it's what you use to prove e.g. that a line is the shortest continuous path between two points.

Below is an exchange between me and `TheMajor`, reproduced and slightly edited with permission:

Alex
: I'm having trouble understanding functional derivatives. I'm used to thinking about derivatives as with respect to time, or with respect to variations along the input dimensions. But when I think about a derivative on function space, I'm not sure what the "time" is, even though I can think about the topology and the neighborhoods around a given function.

: And I know the answer is that there isn't "time", but I'm not sure what there _is_.

: An interesting concept that comes to mind is thinking about a functional derivative with respect to e.g. a straight-line [homotopy](https://en.wikipedia.org/wiki/Homotopy), where you really _could_ say how a function is changing at every point with respect to time. But I don't think that's the same concept.

: <video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/HomotopySmall.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/HomotopySmall.webm" type="video/webm"></video>

`TheMajor`
: The concept is as follows:
: Let's say we have some (a priori non-linear) map $L$, which takes a function as an input and gives a number as an output. I.e. it maps from a vector space $X$ of functions to the complex numbers $\mathbb{C}$. Now fix a function $f\in X$, and a second function $g\in X$. We can then consider the 1-dimensional linear subspace $f + \mathbb{C}g := \{f + \lambda g: \lambda \in \mathbb{C}\}$. The map $L$ on this subspace is just a normal map, and if it is differentiable at the point $f$ in this subspace then its derivative is called _the functional derivative of $L$ at $f$ with respect to $g$_.

Alex
: By normal map, is that something like a [normal operator](https://en.wikipedia.org/wiki/Normal_operator)?

`TheMajor`
: sorry, I didn't mean normal in a technical context. Since the subspace I introduced is one-dimensional (as a complex vector space), and it maps to the complex numbers as well, we have good old introduction to complex analysis derivatives here. If you like you can work with reals instead of complex variables too, in which case it would be the familiar real derivative.

Alex
: Wouldn't it still output a function, $g'$ maybe? wait. Would the derivative with respect to $\lambda$ just be $g$?

`TheMajor`
: there is no derivative with respect to $\lambda$.

Alex
: ah ya. duh (my brain was still acting as if differentiation had to be from the real numbers to the real numbers, so it searched for a real/complex number in the problem formalization and found $\lambda$.)

`TheMajor`
: let me know if this part is clear, because unfortunately its the next few steps where it gets really confusing.

Alex
: Unfortunately, I don't think it's clear yet. So I see how this is a one-dimensional subspace,[^2] because it's generated by one basis function ($g$).

: But I don't see how this translates to a normal complex derivative, in particular, I don't quite understand what the range of this function is.

<!-- vale off -->
`TheMajor`
: No problem, and it's very good that you share that it's unclear. The range of $L$ is the complex numbers, $L$ maps from $X$ (our vector space of functions) to $\mathbb{C}$ (the complex numbers).
<!-- vale on -->

Alex
: I guess I'm confused why we're using that type signature if we're taking a derivative on the whole function – but maybe that'll be clear after I get the rest.

`TheMajor`
: that is exactly the heart of the confusion surrounding functional derivatives, and we'll have to get there in a few steps.we'll start with defining functional derivatives for easy maps, i.e. the ones that take on complex values, and then work towards more complicated settings.

: so back to the example above; we have a vector space $X$ (our 'function space'), we have a (possibly non-linear) map $L: X \to \mathbb{C}$. we will now introduce the derivative of $L$ at $f$ with respect to $g$, with $f,g\in X$. This derivative is just a complex number.

: To find this we consider the 1-dimensional subspace $f + \mathbb{C}g$ that I introduced above, and we note that the map from $\mathbb{C}$ to this subspace, given by $\lambda\mapsto f + \lambda g$, is a bijection that goes through $f$ at 0. this gives us a map from $\mathbb{C}$ to $\mathbb{C}$, by sending $\lambda$ to $L(f+\lambda g)$. We take the derivative of that at $\lambda = 0$, and that is _the derivative of $L$ at $f$ with respect to $g$_.

Alex
: Okay, that makes sense so far.

`TheMajor`
: Nice 😃 this map has a few properties that I just want to remark and then ignore. For example it need not be linear in $f$ (which makes sense, since $f$ is only the point we're evaluating at). And by doing some work with chain rules it does have some linear properties in $g$.

: now there are two ways in which we can make this story complicated again, and most authors do both simultaneously.

: Firstly we can try to extend the "derivative of $L$ at $f$ with respect to $g$" to something like "derivative of $L$ at $f$". We'll do this first. Secondly we can try to take a different map, say $M$, which maps from $X$ into another vector space $Y$ (instead of the complex numbers). We can then try and define a derivative of $M$ at $f$ with respect to $g$.

<!-- vale off -->
: The first step is conceptually simple, but formally and computationally very difficult. Given a point $f\in X$ and our map $L$ from before, we can simply say that "the derivative of $L$ at $f$" is the map that sends $g \in X$ to "the derivative of $L$ at $f$ with respect to $g$". So "the derivative of $L$ at $f$" is a map from $X$ to $\mathbb{C}$.

: this is formally difficult because usually you want this derivative to have some nice properties, but because it was defined pointwise it's very difficult to establish this! Frequently these derivatives are not continuous, and mathematicians resort to horrible tricks (like throwing out a bunch of points of the domain X on which our derivative is annoying) to recover some structure here.
<!-- vale on -->

Alex
: So, given some arbitrary function $L : X \to\mathbb{C}$ which is "differentiable" at $f$, we define a function $L'_{f}: g \mapsto$ (derivative of $L$ at $f$ with respect to $g$)?

`TheMajor`
: yes, exactly.

Alex
: You could even maybe think of each input $g$ as projecting the derivative of $L$ at $f$? Or specifying one of many possible directions.

`TheMajor`
: Yes, this is 100% correct. This is related to the "nice linear properties in $g$" that I mentioned above

: I also stated that this is computationally difficult. This is actually quite funny - the best way to find "The derivative of $L$ at $f$" is to take a 'test function' $g \in X$ (arbitrarily), compute (the derivative of $L$ at $f$ with respect to $g$), and then tahdah, you have now found the map that sends $g$ to (the derivative of $L$ at $f$ with respect to $g$), i.e. exactly what you were looking for.

Alex
: this sounds pretty computationally easy? Or are you calculating $L'$ for a general test function $g$, in which case, how do you get any nontrivial information out of that?

`TheMajor`
: Yes, you need to calculate it for a general test function.

: also something that may help with gaining insight: in multivariable calculus (lets say 2 dimensions, that's already plenty difficult) there is a clear divide between the \[existence of a partial derivative of a function at a point\] and \[the function being differentiable at that point\].

Alex
: yeah, because $L'$ has to exist for… all $g$? That seems a little tough.

> [!info] Edited after posting
> Back in my [_Topology_ review](/topology-textbook-review), I discussed a similar phenomenon: continuity in multiple input dimensions requires not just continuity in each input variable, but in _all_ sequences converging to the point in question:
> ![](https://assets.turntrout.com/static/images/posts/k6b4WRE.avif)
>
> > Continuity in the variables says that paths along the axes converge in the right way. But for continuity overall, we need all paths to converge in the right way. Directional continuity when the domain is $\mathbb{R}$ is a special case of this: continuity from below and from above if and only if continuity for all sequences converging topologically to $x$.
>
> Similarly, for a function to be differentiable, the existence of all of its partial derivatives isn't enough – you need derivatives for every possible approach to the point in question. Here, the existence of all of the partials automatically guarantees the derivatives for every possible approach, because there's a partial for every function.
>
> here we have the same, except we have (in an infinite-dimenional function space X) infinitely many "partial derivatives". so from that point of view it's not that surprising that a function "having a derivative at $f$" is actually quite rare/complicated.

`TheMajor`
: It exists for all $g$, and then $L'_f$ exists as a formal map. But usually you want something stronger, for example that $L'_f: X\to \mathbb{C}$ is continuous.

: as an important but relatively trivial aside: if $L$ is a linear map, then $L'_f$ does not actually depend on $f$. So usually it is just called "the derivative of $L$" instead of "the derivative of $L$ at $f$". This is confusing, because for non-linear $L$ there is also something called "the derivative of $L$", namely "the map that sends $f$ to \[the derivative of $L$ at $f$\]".

Alex
: hm. That's because of the definition of linearity, right? it's a homomorphism for both the operations of addition and scalar multiplication... Wait, I intuitively understand why linearity means it's the same everywhere, but I'm having trouble coming up with the formal justification…

`TheMajor`
: Yes, the point is that when we look at the definition of "derivative of $L$ at $f$ with respect to $g$" that is given by $\lim_{\lambda\to 0}\frac{ L(f + \lambda g) - L(f)}{\lambda}$...

Alex
: ah, got it!

`TheMajor`
: ok, so this was all the first way to make it confusing again. Ready for the second?

Alex
: I'm ready to be reconfused.

`TheMajor`
: Ok, so now let's pick a range not inside the complex numbers $\mathbb{C}$, but inside a second normed vector space $Y$. So we have a map $M: X\to Y$, not necessarily linear. Again fix points $f, g\in X$. We are going to define the derivative of $M$ at $f$ with respect to $g$.

: so we repeat our trick from before, consider the map from $\mathbb{C}$ via $X$ to $Y$ given by $\lambda\mapsto M(f + \lambda g)$. We wish to differentiate it at $\lambda = 0$.

: unfortunately, its image is now in $Y$, not in $\mathbb{C}$, so we don't really know what the derivative means. But because $Y$ is a normed vector space, the expression $\frac{M(f + \lambda g) - M(f)}{\lambda}$ makes sense for all non-zero $\lambda$.

: if this function can be continuously extended to $\lambda = 0$ then we define its image at 0 as the derivative of $M$ at $f$ with respect to $g$. Note that this notion of continuity has to do with the norm of $Y$.

<!-- vale off -->
: this is now a vector in $Y$, so if this works we have: \[the derivative of $M$ at $f$ with respect to $g$\] which is an element of $Y$, \[the derivative of $M$ at $f$\] which is a (linear! usually horrible and not continous!) map from $X$ to $Y$.
<!-- vale on -->

: btw if the "continuously extending" part is new, you can also just think of it as the limit of that fraction as $\lambda$ approaches 0. The only point is that (as long as we're working with complex vector spaces) there are a lot of different ways for $\lambda$ to approach 0, and it has to work for all of them.

: if we're working over the reals its simply the notion of "right limit" and "left limit" (the only two ways to approach 0 in $\mathbb{R}$) that you may have seen before, except that the convergence is now happening in $Y$.

## Other notes

- The operator norm is really cool.
- Linear combinations always involve finitely many terms, but using the orthonormal basis of an infinite dimensional space, you can take the limit as $n\to \infty$.
- I was really happy to see watered-down versions of symmetry/conservation law correspondences (aka Noether's theorem). Can't wait to learn the real version.

## Final thoughts

The book is pretty nice overall, with some glaring road bumps – apparently, the Euler-Lagrange equation is one of the most important equations of all time, and Sasane barely spends any effort explaining it to the reader!

And if I didn't have the help of `TheMajor`, I wouldn't have understood the functional derivative, which, in my opinion, was _the_ profoundly important insight I got from this book. My models of function space structure feel qualitatively improved. I can look at a Fourier transform and see what it's doing – I can _feel_ it, to an extent. Without a doubt, that single insight makes it all worth it.

# Forward

I'm probably going to finish up an epidemiology textbook, before moving on to complex analysis, microeconomics, or... something else – who knows!

[^1]: Lines $y=mx+b$ ($b\neq 0$) aren't actually linear functions, because they don't go through the origin. Instead, they're affine.

[^2]: To be more specific, $f + \mathbb{C}g := \{f + \lambda g: \lambda \in \mathbb{C}\}$ is often an [affine subspace](https://en.wikipedia.org/wiki/Affine_space), because the zero function is not necessarily a member.
