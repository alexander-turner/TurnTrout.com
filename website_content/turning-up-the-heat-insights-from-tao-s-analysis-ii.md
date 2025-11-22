---
permalink: second-analysis-textbook-review
lw-was-draft-post: 'false'
lw-is-af: 'false'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/uSaJoL64DYg2WunJJ/turning-up-the-heat-insights-from-tao-s-analysis-ii
lw-is-question: 'false'
lw-posted-at: 2018-08-24T17:54:54.344000Z
lw-last-modification: None
lw-curation-date: None
lw-frontpage-date: 2018-08-25T06:41:47.323000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 6
lw-base-score: 36
lw-vote-count: 11
af-base-score: 0
af-num-comments-on-upload: 0
title: "Turning Up the Heat: Insights from Tao's 'Analysis II'"
lw-latest-edit: 2018-08-24T17:54:54.344000Z
lw-is-linkpost: 'false'
tags:
  - summaries
aliases:
  - turning-up-the-heat-insights-from-tao-s-analysis-ii
lw-sequence-title: Becoming Stronger
lw-sequence-image-grid: sequencesgrid/fkqj34glr5rquxm6z9sr
lw-sequence-image-banner: sequences/oerqovz6gvmcpq8jbabg
sequence-link: posts#becoming-stronger
prev-post-slug: RL-textbook-review
prev-post-title: "Making a Difference Tempore: Insights from 'Reinforcement Learning:
  An Introduction'"
next-post-slug: computability-and-logic-textbook-review
next-post-title: And My Axiom! Insights from 'Computability and Logic'
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2018-08-24 00:00:00
original_url: 
  https://www.lesswrong.com/posts/uSaJoL64DYg2WunJJ/turning-up-the-heat-insights-from-tao-s-analysis-ii
skip_import: true
description: "Tao's \"Analysis II\" reviewed: metric spaces, uniform convergence,
  Lebesgue integration–sharpening my mathematical tools."
date_updated: 2025-11-22 00:21:52.667251
---











It's been too long - a month and a half since my last review, and about three months since _[Analysis I](/first-analysis-textbook-review)_. I've been immersed in my work for CHAI, but reality doesn't grade on a curve, and I want more mathematical firepower.

# Analysis II

## 12: Metric Spaces

_Metric spaces; completeness and compactness._

### Proving Completeness

It sucks and I hate it.

## 13: Continuous Functions on Metric Spaces

_Generalized continuity, and how it interacts with the considerations introduced in the previous chapter. Also, a terrible introduction to topology._

There's a lot I wanted to say here about topology, but I don't think my understanding is good enough to break things down - I'll have to read an actual book on the subject.

## 14: Uniform Convergence

_Pointwise and uniform convergence, the Weierstrass_  $M$_\-test, and uniform approximation by polynomials._

### Breaking Point

Suppose we have some sequence of functions $f^{(n)}:[0,1]\to\mathbb{R}$, $f^{(n)}(x):=x^n$, which converge pointwise to the 1-indicator function $f:[0,1]\to\mathbb{R}$ (i.e. $f(1)=1$ and $0$ otherwise). Clearly, each $f^{(n)}$ is (infinitely) differentiable. However, the limiting function $f$ isn't differentiable at all! Basically, pointwise convergence isn't at all strong enough to stop the limit from "snapping" the continuity of its constituent functions.

### Progress

As in previous posts, I mark my progression by sharing a result derived without outside help.

_Already proven:_ $\int_{-1}^1 (1-x^2)^N \,dx \geq \frac{1}{\sqrt{N}}$.

> [!math] Definition: $(\epsilon, \delta)$-approximation to the identity
> Let $\epsilon>0$ and $0 < \delta < 1$. A function $f: \mathbb{R} \to \mathbb{R}$ is said to be an $(\epsilon, \delta)$_\-approximation to the identity_ if it obeys the following three properties:
>
> - $f$ is compactly supported on $[-1,1]$.
> - $f$ is continuous, and $\int_{-\infty}^\infty f=1$.
> - $|f(x)|\leq \epsilon$ for all $\delta \leq |x| \leq 1$.

> [!math] Lemma
> For every $\epsilon>0$ and $0 < \delta < 1$, there exists an $(\epsilon, \delta)$\-approximation to the identity which is a polynomial $P$ on $[-1,1]$.
>
> _Proof of Exercise 14.8.2(c)._ Suppose $c\in\mathbb{R},N\in\mathbb{N}$; define $f(x):=c(1-x^2)^N$ for $x \in [-1,1]$ and 0 otherwise. Clearly, $f$ is compactly supported on $[-1,1]$ and is continuous. We want to find $c,N$ such that the second and third properties are satisfied. Since $(1-x^2)^N$ is non-negative on $[-1,1]$, $c$ must be positive, as $f$ must integrate to 1. Therefore, $f$ is non-negative.
>
> We want to show that $|c(1-x^2)^N| \leq \epsilon$ for all $\delta \leq |x| \leq 1$. Since $f$ is non-negative, we may simplify to $(1-x^2)^N\leq \frac{\epsilon}{c}$. Since the left-hand side is strictly monotone increasing on $[-1,-\delta]$ and strictly monotone decreasing on $[\delta,1]$, we substitute $x=\delta$ without loss of generality. As $\epsilon > 0$, so we may take the reciprocal and multiply by $\epsilon$, arriving at $\epsilon(1-\delta^2)^{-N} \geq c$.
>
> We want $\int_{-\infty}^\infty f = 1$; as $f$ is compactly supported on $[-1,1]$, this is equivalent to $\int_{-1}^1 f(x)\, dx = 1$. Using basic properties of the Riemann integral, we have $\int_{-1}^1 (1-x^2)^N \, dx=\frac{1}{c}$. Substituting in for $c$,
>
> $$
> \begin{align*}
> \epsilon^{-1}(1-\delta^2)^N&\leq \frac{1}{\sqrt{N}} \leq \int_{-1}^1 (1-x^2)^N\,dx,
> \end{align*}
> $$
> with the second inequality already having been proven earlier. Note that although the first inequality is not always true, we can make it so: since $\epsilon$ is fixed and $1-\delta^2 \in (0,1)$, the left-hand side approaches 0 more quickly than $\frac{1}{\sqrt{N}}$ does. Therefore, we can make $N$ as large as necessary; isolating $\epsilon$,
>
> $$
> \epsilon \geq (1-\delta^2)^N\sqrt{N}\\
> \epsilon \geq \sqrt{N} >(1-\delta^2)^N\sqrt{N},
> $$
>
> the second line being a consequence of $1 > (1-\delta^2)^N$. Then set $N$ to be any natural number such that this inequality is satisfied. Finally, we set $c = \frac{1}{\int_{-1}^1 (1-x^2)^N \, dx}$. By construction, these values of $c,N$ satisfy the second and third properties. □

### Convoluted No Longer

Those looking for an excellent explanation of convolutions, [look no further](https://aha.betterexplained.com/t/convolution/679)!

### Weierstrass Approximation Theorem

> [!math] Theorem
> Suppose  $f : [a,b] \to \mathbb{R}$ is continuous and compactly supported on $[a,b]$. Then for every $\epsilon > 0$, there exists a polynomial $P$ such that $\vert\vert P - f\vert\vert_\infty < \epsilon.$

In other words, any continuous, real-valued $f$ on a finite interval can be approximated with arbitrary precision by polynomials.

_Why I'm talking about this._ On one hand, this result makes sense, especially after taking machine learning and seeing how polynomials can be contorted into basically whatever shape you want.

On the other hand, I find this theorem intensely beautiful. $\overline{P[a,b]}=C[a,b]$'s proof was slowly constructed, much to the reader's benefit. I remember the exact moment the proof sketch came to me, newly installed gears whirring happily.

## 15: Power Series

_Real analytic functions, Abel's theorem, $\exp$ and $\log$, complex numbers, and trigonometric functions._

### `EXP`

Cached thought from my CS undergrad: Exponential functions always end up growing more quickly than polynomials, no matter the degree. Now, I finally have the gears to see why:

$$
\exp(x):=\sum_{k=0}^\infty \frac{x^k}{k!}.
$$
$\exp$ has _all_ the degrees, so no polynomial (of necessarily finite degree) could ever hope to compete! This also suggests why $\frac{d}{dx}e^x=e^x$.

## Complex Exponentiation

The book
: You can multiply a number by itself some number of times.

Me
: 🙂‍↕️

The book
: You can multiply a number by itself a negative number of times.

Me
: Sure.

The book
: You can multiply a number by itself an irrational number of times.

Me
: ... OK, I understand limits.

The book
: You can multiply a number by itself an imaginary number of times.

Me
: 😠 Out. Now.

Seriously, this one's weird (rather, it _seems_ weird, but how can "how the world is" be "weird")?

Suppose we have some $c \in\mathbb{C}$, where $c=a+bi$. Then $e^c=e^{a}e^{bi}$, so "all" we need to figure out is how to take an imaginary exponent. [Brian Slesinsky has us covered](http://slesinsky.org/brian/misc/eulers_identity.html).

_Years before becoming involved with the rationalist community, Nate [asks](https://math.stackexchange.com/questions/27050/how-does-e-or-the-exponential-function-relate-to-rotation) this question, and Qiaochu answers._

_[This isn't a coincidence, because nothing is ever a coincidence](http://unsongbook.com/chapter-1-dark-satanic-mills/)._

_Or maybe it is a coincidence, because Qiaochu answered every question on StackExchange._

## 16: Fourier Series

_Periodic functions, trigonometric polynomials, periodic convolutions, and the Fourier theorem._

## 17: Several Variable Differential Calculus

_A beautiful unification of Linear Algebra and calculus: linear maps as derivatives of multivariate functions, partial and directional derivatives, Clairaut's theorem, contractions and fixed points, and the inverse and implicit function theorems._

### Implicit Function Theorem

If you have a set of points in $\mathbb{R}^n$, when do you know if it's secretly a function $g:\mathbb{R}^{n-1} \to \mathbb{R}$? For functions $\mathbb{R}\to\mathbb{R}$, we can just use the geometric "vertical line test" to figure this out, but that's a bit harder when you only have an algebraic definition. Also, sometimes we can implicitly define a function locally by restricting its domain (even if no explicit form exists for the whole set).

> [!math] The implicit function theorem
> Let $E$ be an open subset of $\mathbb{R}^n$, let $f:E \to \mathbb{R}$ be continuously differentiable, and let $y=(y_1,\dots,y_n)$ be a point in $E$ such that $f(y)=0$ and $\frac{\partial f}{\partial x_n}\neq0$. Then there exists an open $U \subseteq \mathbb{R}^{n-1}$ containing $(y_1, \dots, y_{n-1})$, an open $V \subseteq E$ containing $y$, and a function $g: U \to \mathbb{R}$ such that $g(y_1, \dots, y_{n-1})=y_n$, and
>
> $$
> \begin{align*}
> &\left\{(x_1, \dots, x_n)\in V: f(x_1, \dots,x_n)=0\right\}\\
> &=\left\{(x_1, \dots, x_{n-1}, g(x_1,\dots, x_{n-1})): (x_1, \dots, x_{n-1})\in U\right\}.
> \end{align*}
> $$

So, I think what's really going on here is that we're using the derivative at this known zero to locally linearize the manifold we're operating on (similar to Newton's approximation), which lets us have some neighborhood $U$ in which we can derive an implicit function, even if we can't always write it out.

## 18: Lebesgue Measure

_Outer measure; measurable sets and functions._

Tao lists desiderata for an ideal measure before deriving it. Imagine that.

## 19: Lebesgue Integration

_Building up the Lebesgue integral, culminating with Fubini's theorem._

### Conceptual Rotation

Suppose $\Omega \subseteq \mathbb{R}^n$ is measurable, and let $f:\Omega \to [0,\infty]$ be a measurable, non-negative function. The Lebesgue integral of $f$ is then defined as

$$
\int_\Omega f := \sup\left\{\int_\Omega s: s \text{ is simple and non-negative, and minorizes }f\right\}.
$$
This hews closely to how we defined the _lower_ Riemann integral in Chapter 11; however, we don't need the equivalent of the upper Riemann integral for the Lebesgue integral.

To see why, let's review why Riemann integrability demands the equality of the lower and upper Riemann integrals of a function $g$. Suppose that we integrate over $[0,1]$, and that $g$ is the indicator function for the rationals. As the rationals are dense in the reals, any interval $[a,b]\subseteq[0,1]$ ($b>a$) contains rational numbers, no matter how much the interval shrinks! Therefore, the upper Riemann integral equals 1, while the lower equals 0 (for similar reasons). $g$ _is_ Lebesgue integrable; since it's 0 almost everywhere (as the rationals have 0 measure), its integral is 0.

Lebesgue integration marks a fundamental shift in how we integrate. With the Riemann integral, we consider the $\lim \sup$ and $\lim \inf$ of increasingly refined upper and lower Riemann sums (the _length_ approach). In Lebesgue integration, however, we consider which $E\subseteq \Omega$ is responsible for each value $y$ in the range (i.e. $f^{-1}(y)=E$), multiplying $y$ by the measure of $E$ (_inversion_).

In a sense, the Lebesgue integral more cleanly strikes at the heart of what it _means_ to integrate. Surely, Riemann integration was not far from the mark; however, if you rotate the problem slightly in your mind, you will find a better, cleaner way of structuring your thinking.

## Final Thoughts

Although Tao botches a few exercises and the section on topology, I'm a big fan of _Analysis I_ and _II_. Do note, however, that _II_ is far more difficult than _I_ (not just in content, but in terms of the exercises). He generally provides relevant, appropriately difficult problems, and is quite adept at helping the reader develop rigorous and intuitive understanding of the material.

## Tips

- To avoid getting hung up in Chapter 17, this book should be read after a linear algebra text.
- Don't do exercise 17.6.3 - it's wrong.
- Deep understanding comes from sweating it out. Don't hide, don't wave away bothersome details - stay and explore. If you follow my strategy of quickly generating outlines - can you formally and precisely write out each step?

## Verification

I completed every exercise in this book; in the second half, I started avoiding looking at the hints provided by problems until I'd already thought for a few minutes. Often, I'd solve the problem and then turn to the hint: "be careful when doing _X_ - don't forget edge case _Y_; hint: use lemma _Z_"! A pit would form in my stomach as I prepared to locate my mistake and back-propagate where-I-should-have-looked, before realizing that I'd _already_ taken care of that edge case using that lemma.

## Why Bother?

[One can argue](https://www.lesswrong.com/posts/hWkdiMbqLpzjYvxqD/learning-strategies-and-the-pokemon-league-parable) that my time would be better spent picking up things as I work on problems in alignment. However, while I've made, uh, quite a bit of progress with impact measures this way, [concept-shaped holes are impossible to notice](http://slatestarcodex.com/2017/11/07/concept-shaped-holes-can-be-impossible-to-notice/). If there's some helpful information-theoretic way of viewing a problem that I'd only realize if I had _already taken_ information theory, I'm out of luck.

Also, developing mathematical maturity brings with it a more rigorous thought process.

## Fairness

There's a sense I get where even though I've made immense progress over the past few months, it still _might not be enough_. The standard isn't "am I doing impressive things for my reference class?", but rather the stricter "am I good enough to solve [serious problems](https://80000hours.org/problem-profiles/positively-shaping-artificial-intelligence/) that might not get solved in time otherwise?". This standard is hard to meet, and even given my textbook and research progress (including the upcoming posts), I don't think I meet it.

In a way, this excites me. I welcome any advice for buckling down further and becoming yet stronger.

> [!thanks]
> Thank you to everyone who has helped me. In particular, `TheMajor` has been incredibly generous with their explanations and encouragement.
