---
permalink: first-analysis-textbook-review
lw-was-draft-post: "false"
lw-is-af: "false"
lw-is-debate: "false"
lw-page-url: 
  https://www.lesswrong.com/posts/cuZxipMFup5uJdeAp/into-the-kiln-insights-from-tao-s-analysis-i
lw-is-question: "false"
lw-posted-at: 2018-06-01T18:16:32.616000Z
lw-last-modification: None
lw-curation-date: None
lw-frontpage-date: 2018-06-02T14:37:25.414000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 8
lw-base-score: 28
lw-vote-count: 22
af-base-score: 8
af-num-comments-on-upload: 0
publish: true
title: "Into the Kiln: Insights from Tao's 'Analysis I'"
lw-latest-edit: 2018-06-01T18:16:32.616000Z
lw-is-linkpost: "false"
tags:
  - summaries
  - understanding-the-world
aliases:
  - into-the-kiln-insights-from-tao-s-analysis-i
lw-sequence-title: Becoming Stronger
lw-sequence-image-grid: sequencesgrid/fkqj34glr5rquxm6z9sr
lw-sequence-image-banner: sequences/oerqovz6gvmcpq8jbabg
sequence-link: posts#becoming-stronger
prev-post-slug: all-of-statistics-textbook-review
prev-post-title: "Confounded No Longer: Insights from 'All of Statistics'"
next-post-slug: swimming-upstream
next-post-title: "Swimming Upstream: A Case Study in Instrumental Rationality"
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2018-06-01 00:00:00
original_url: 
  https://www.lesswrong.com/posts/cuZxipMFup5uJdeAp/into-the-kiln-insights-from-tao-s-analysis-i
skip_import: true
description: Tao's "Analysis I" illuminates the foundations of mathematics, from natural
  numbers to Riemann integrals. Rigorous yet accessible.
date_updated: 2025-06-03 22:57:00.423836
---















As a young boy, mathematics captivated me. In elementary school, I'd happily while away entire weekends working through the next grade's math book. I was impatient. In middle school, I'd lazily estimate angles of incidence that would result if I shot lasers from my eyes, tracing their trajectories within the classroom and out down the hallway. I was restless.

In high school, I'd daydream about what would happen to integrals as I twisted functions in my mind. I was curious.

And now, I get to see how it's all put together. Imagine being fascinated by some thing, continually glimpsing beautiful new facets and sampling exotic flavors, yet being resigned to not truly pursuing this passion. After all, I _chose_ to earn a computer science degree.

Wait.

# Analysis I

As in [_Linear Algebra Done Right_](./linear-algebra-textbook-review), I completed every single exercise in the book - this time, without looking up any solutions (although I _did_ occasionally ask questions on Discord). Instead, I came back to problems if I couldn't solve them after half an hour of effort.

I have [shared some of my proofs](https://www.overleaf.com/read/ktxtwvfqygqq).

## 1: Introduction

## 2: The Natural Numbers

_In which the Peano axioms are introduced, allowing us to define addition and multiplication on the natural numbers_ $\{0,1,2,\dots\}$.

## 3: Set Theory

_In which functions and Cartesian products are defined, among other concepts._

### Recursive Nesting

How can you apply the [axiom of foundation](https://en.wikipedia.org/wiki/Axiom_of_regularity) if sets are nested in each other? That is, how can the axiom of foundation "reach into" sets like $A=\{B,\ldots\}$ and $B=\{A,\ldots\}$?

**Show** that if $A$ and $B$ are two sets, then either $A \not \in B$ or $B \not \in A$ (or both).

_Proof_. Suppose $A \in B$ and $B \in A$. By the pairwise axiom, we know that there exists a set $S=\{A,B\}$. We see that there does not exist an $S' \in S$ such that $S' \cap S = \varnothing$. That is, if we choose $A$, one of its elements is $B$, which is also an element of $S$ - this violates the axiom of foundation. The same reasoning applies if we choose $B$. Then $\lnot(A\in B \land B \in A)$, so either $A$ or $B$ (or both) is not an element of the other. ∎

## 4: Integers and Rationals

_In which the titular sets are constructed, allowing the exploration of absolute value, exponentiation, and the incompleteness (colloquially, the "gaps") of the rationals._

Readers newer to mathematics may find it interesting that even though there are (countably) infinitely many rational numbers between any two distinct rationals, the rationals still contain gaps.

## 5: The Real Numbers

_In which Cauchy sequences allow us to formally construct the reals._ [^1]

## 6: Limits of Sequences

_In which we meet convergence and its lovely limit laws, extend the reals to cover infinities, experience the delightfully counterintuitive_ $\limsup$ _and_ $\liminf$_, and complete our definition of real exponentiation._

### Upper-Bounded Monotonic Sequence Convergence

_I tried to come up with a clever title here - I really did. Apparently even **my** pun-making abilities are bounded._

Suppose you have a monotonically increasing sequence $(x_n)_{n=0}^\infty$ with an upper bound $M\in \mathbb{R}$. Then the sequence converges; this also applies to lower-bounded monotonic decreasing sequences.

Weird, right? I mean, even though the sequence monotonically increases and there's an upper bound, there are still uncountably infinitely many "places" the sequence can "choose" to go. So what gives?

_Proof._ Let $L \in [x_0, M]$ and $\epsilon > 0$. Suppose that the sequence is not eventually $\epsilon$\-close to $L$. Let $K \in \mathbb{N}$ be such that for all $k \geq K$, either $L + \epsilon < x_k \leq M$ or $x_k < L - \epsilon \leq M$; we know that $K$ exists because the sequence is monotone increasing. By the Archimedean principle, there exists some $N \in \mathbb{N}$ such that $N\epsilon > M - x_0$.

Since the sequence is monotone increasing, by repeating the above argument $N$ times in the first case, we have that $M < L + N\epsilon < x_k \leq M$, which is contradictory. By repeating the argument $N$ times in the second case, we have $x_k < L - N\epsilon < x_0$, which contradicts the fact that the sequence is monotone increasing. Then for any $\epsilon > 0$, the sequence must be eventually $\epsilon$\-close to some $L \in [x_0, M]$. Intuitively, for any given $\epsilon>0$, the sequence can only "escape" a limit a finite number of times before it runs out of room and has to be $\epsilon$\-close.

Next, we show that the $L_\epsilon$'s form a Cauchy sequence. Let $\epsilon_3 > 0$, and set $\epsilon_1, \epsilon_2$ such that $0 < \epsilon_1, \epsilon_2 \leq \frac{\epsilon_3}{2}$. $(x_n)$ is eventually $\epsilon_1$\-close to $L_{\epsilon_1}$, so there exists a $K_1\in\mathbb{N}$ such that for all $k\geq K_1$ we have $|x_k-L_{\epsilon_1}| < \epsilon_1$. Similar arguments hold for $\epsilon_2$. Set $K = \max(K_1,K_2)+1$, now $|L_{\epsilon_1} - L_{\epsilon_2}| \leq |x_K-L_{\epsilon_1}| + |x_K-L_{\epsilon_2}| < \epsilon_1 + \epsilon_2 \leq \epsilon_3$. But $\epsilon_3$ is arbitrary, so we can easily see that the sequence $(L_\frac{1}{n})_{n=1}^\infty$ is Cauchy.

As the real numbers are complete, this sequence converges to some $L_\infty \in \mathbb{R}$. Since the main sequence is eventually $\frac{1}{n}$\-close to $L_\frac{1}{n}$, and $L_\frac{1}{n}$ converges to $L_\infty$, by the triangle inequality we have that the main sequence converges to $L_\infty$. ∎

## 7: Series

_In which we finally reach concepts from pre-calculus._

### Condensation

The [Cauchy condensation test](https://en.wikipedia.org/wiki/Cauchy_condensation_test) says that for a sequence $(a_n)_{n=1}^\infty$ where $a_n \geq 0$ and $a_{n+1}\leq a_n$ for all $n \geq 1$, the series $\sum_{n=1}^\infty a_n$ converges IFF the series $\sum_{k=0}^\infty 2^ka_{2^k}$ converges. Using this result, we have that the harmonic series $\sum_{n=1}^\infty \frac{1}{n}$ diverges; the partial sums $\sum_{n=1}^x \frac{1}{n}$ are given below.

![A graph plotting the partial sums of the harmonic series. A red step function shows the discrete sums, which are closely approximated by a smooth, blue, concave-down curve illustrating the series' slow, logarithmic growth.](https://assets.turntrout.com/static/images/posts/1280px-HarmonicNumbers.svg.avif)

What was initially counterintuitive is that even though $\lim_{n\to\infty} \frac{1}{n}=0$, the series doesn't converge. The best intuition I've come up with is that the harmonic series doesn't "deplete" its domain quickly enough, so you can get arbitrarily large partial sums.

If you want proofs, [here are twenty](http://scipp.ucsc.edu/%7Ehaber/archives/physics116A10/harmapa.pdf)!

## 8: Infinite Sets

_In which uncountable sets[^2], the axiom of choice, and ordered sets brighten our lives._

## 9: Continuous Functions on $\mathbb{R}$

_In which continuity, the maximum principle, and the intermediate value theorem make their debut._

### Lipschitz Continuity $\not \Leftrightarrow$ Uniform Continuity

If a function $f : X \to \mathbb{R}$ ( $X \subseteq \mathbb{R}$) is Lipschitz-continuous for some Lipschitz constant $M$, then by definition we have that for every $x,y \in X$,

$$
\frac{|f(x)-f(y)|}{|x-y|} \leq M.
$$

> [!math] Definition: Uniform continuity
> For every $\epsilon > 0$, there exists a $\delta>0$ such that for all $x,y\in X$ such that $|x-y|<\delta$, $|f(x)-f(y)|<\epsilon$.

Lipschitz continuity implies uniform continuity (do you see why?), but the converse is not true. I mean, what kind of twisted person would come up with [this kind of function](https://en.wikipedia.org/wiki/Cantor_function)?

## 10: Differentiation of Functions

_In which the basic rules of differential calculus are proven._

You know, I actually thought that I wouldn't have too much to explain in this post - the book went smoothly up to this point. On the upside, we get to spend even more time together!

### Differential Intuitions

Let me simply direct you to [this excellent StackExchange answer](https://math.stackexchange.com/a/1461296).

### Inverse derivative

We can understand $(f^{-1})'(x)=\frac{1}{f'(x)}$ by simply thinking about $\frac{\text{run}}{\text{rise}}=\frac{1}{\frac{\text{rise}}{\text{run}}}$, which makes sense for the derivative of the inverse!

> [!error] That formula actually _doesn't_ make sense
> On Nov. 23, 2024, a kind reader informed me that the formula is mistaken. The correct formula is actually
>
> $$
> (f^{-1})'(x) = \dfrac{1}{f'\left(f^{-1}(x)\right)}.
> $$

### L'Hôpital's Rule

Consider $f,g:[a,b]\to \mathbb{R}$ differentiable on $(a,b]$ (for real numbers $a<b$). Then if $f(a)=g(a)=0,g'(x)\neq0$ for $x\in[a,b]$, and the rightward $\lim_{x\to a^+} \frac{f'(x)}{g'(x)}=L\in\mathbb{R}$, we have that $g(x) \neq 0$ for $x\in (a,b]$ and the rightward $\lim_{x\to a^+} \frac{f(x)}{g(x)}=L$.

As a neat exercise, let's see how this rule breaks if we violate preconditions:

- If $f(a)$ or $g(a)\neq 0$, then the ratio is "messed up" and not necessarily indicative of the functions' slopes as $a$ is approached.
- If $f$ or $g$ is not differentiable on $(a,b]$, then perhaps
  <video autoplay loop muted playsinline style="margin-left:auto;margin-right:auto"><source src="https://assets.turntrout.com/static/images/posts/tumblr_mg2eerTssi1rkty0bo1_500.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/tumblr_mg2eerTssi1rkty0bo1_500.webm" type="video/webm"></video>
  - No, but really - you _would_ use L'Hôpital's rule to analytically determine that the limit in question ($\lim _{x \rightarrow 0} \frac{\ln (1-x)-\sin x}{1-\cos ^2 x}$) does not exist.
- If $g'(x)=0$ for some $x \in [a,b]$, then we have division by zero (unless $x=a$, in which case we find more [twisted counterexamples](https://en.wikipedia.org/wiki/L%27H%C3%B4pital%27s_rule#Counterexamples_when_the_derivative_of_the_denominator_is_zero) which necessitate the closure of this interval).

## 11: The Riemann Integral

_In which partitions and piecewise constant functions help us define the Riemann integral, which later leads to the Riemann-Stieltjes integral and the fundamental theorems of calculus._

Having taken care of the exposition, we arrive at the Rivendell of real analysis, preparing ourselves for the arduous journey to Mt. Lebesgue.

### Pointless Integration

Zero area is enclosed under a point (or even under infinitely many points, such as $\mathbb{N}$) due to how we define length, which in turn allows us to build from piecewise Riemann integrals to something better.

### Infinite Partitions?

The upper and lower Riemann integrals can be defined as the infimum and supremum of the upper and lower Riemann sums, respectively. It is important to note that even though that for many functions (such as $f(x)=x$), further refinement of the partition always gets you closer to the extremum, the result is not an "infinite" partition (which is not defined according to this construction).

Consider the curried function $g_f : [P]\to \mathbb{R}$, which takes a partition and computes its corresponding Riemann sum with respect to the predefined function. Then clearly this function is monotonic with respect to the refinement of the partition; the extremum is not necessarily achieved by any given partition in the refinement sequence, but rather the closest bound on what you can get with _any_ partition.

### Riemann-Stieltjes Confusionn

The book doesn't lay it out cleanly, so I will: the Riemann-Stieltjes integral allows us to use custom length functions to weight different parts of the function differently. I recommend working through a simple case like $\alpha(x) = x^2$ in your head: $\int_1^3x\,d\alpha$ (how do the piecewise constant Riemann-Stieltjes integrals of majorizing and minorizing functions change as you iteratively refine the coarsest partition possible?).

The Riemann-Stieltjes integral defines the expectation in probability theory:

$$
\int_{-\infty}^\infty x \,dF_X(x).
$$

The Riemann integral is recovered as the special case where $\alpha(x)=x$.

## Final Verdict

Terence Tao is both an incredible mathematician and writer, and it shows. There simply _weren't_ many things which confused me, and that says more about his writing than it does about me. The exercises are appropriate and hew closely to each chapter's content; often, the reader proves key results.

My only complaint is that results are frequently referred to as "from Proposition 3.6.4 and Theorem 3.6.12" many chapters later, forcing the reader to infer the referents or backtrack all of the way. In a sense, this may be helpful - you don't want to backtrack a billion pages, so you try to fill in the blanks. In another sense, it's annoying.

In my opinion, _Analysis I_ belongs near the beginning of the research guide. It's a wonderful introduction to proof-based mathematics, with a helpful appendix clearing up concepts I had previously only picked up via osmosis. Additionally, I met with a deep learning professor at my university, asking them "if I want to be able to understand and potentially make progress on some of the fundamental issues in machine learning, do I need to know real analysis?". Their answer: a definitive _yes_.

# Forwards

Next up is _Analysis II_, which works from metric spaces all the way up to the Lebesgue integral. Additionally, I'm going to start working through Sutton and Barto's _Reinforcement Learning: An Introduction_ to increase the rigor with which I think about RL and in preparation for my work this summer.

I also think I need to run through some applied Calculus to refresh my reflexes (so I don't have to rederive every identity that I can't remember).

## Tips

- With respect to my gripe about result numbering, writing down both the results and their numbers in your notes may save you some headaches.
- Appendix A is extremely useful for those new to proofs.
- When reading textbooks, your priors should be towards _your_ being wrong - following this intuition will allow you to unlock new abilities, rather than glossing over your (probable) incorrectness and having it blow up in your face later.

## Marginal Attention

In the last pages of CFAR's participant handbook is an entry on marginal attention. Essentially, each bit of extra attention contributes more than the last. If you're totally dialed in on a task and get slightly distracted, that is far more disastrous than getting slightly more distracted while your attention is already somewhat unfocused.

I often simply left my phone at home and accompanied my Kindle to an empty classroom. This worked wonderfully; I suspect it more than doubled my hourly learning efficiency.

## Proving Myself

Just over three months ago, I wrote:

> [!quote] [The Art of the Artificial: Insights From “Artificial Intelligence: A Modern Approach](/AI-textbook-review)
>
> **Proofs** remain inordinately difficult for me, although I have noticed a small improvement. To do MIRI-relevant math, proofs will need to become second nature. Depending on how I feel as I progress through my next book (which will likely be a proof-centric linear algebra tome), I'll start trying different supplemental approaches for improving my proof prowess.
>
> I have resolved that by the completion of my next book review, proofs will be one of my strong suits.

And now, I think that my proofs are getting pretty good. When confronting a problem, I feel a certain mental lightness - a readiness to use my full repertoire of knowledge, to strike true down those paths likely to bring the proof to completion. Although my capacities remain faint shadows of what I hope to achieve within the coming year, my progress has been substantial.

Talk is cheap, and you probably don't feel like navigating to [the selection of proofs I provided](https://www.overleaf.com/read/ktxtwvfqygqq), so let me share with you my favorite proof from this book.

The following problem was admittedly confusing at first, but I had an overwhelmingly strong sense that the statement _had to be true_. I thought again and again about _why_; once that came to me, I wrote it all at once, and beamed.

> [!math] Theorem: Local Extrema are Stationary
> Let $a<b$ be real numbers, and let $f:(a,b) \to \mathbb{R}$ be a function. If $x_0 \in (a,b)$, $f$ is differentiable at $x_0$, and $f$ attains either a local maximum or local minimum at $x_0$, then $f'(x_0)=0$.
>
> _Proof._ Suppose $f(x_0)$ is a local maximum; thus, for all $x \in (a,b)$, $f(x_0) \geq f(x)$. Let $L=f'(x_0)$; we know that $L$ exists and is a real number since $f$ is differentiable at $x_0$. By the trichotomy of real numbers, $L$ is either negative, positive, or zero.
>
> Suppose that $L$ is negative - then consider $\lim_{x\to x_0^-; x \in X - \{x_0\}} \frac{f(x)-f(x_0)}{x-x_0}$ (this is permissible as the left and right limits of a convergent limit are equal); we have a sequence $(x_n)_{n=1}^\infty$ of $x_n<x_0$ which converges to $x_0$, so every term in $(x_n - x_0)_{n=1}^\infty$ is negative.
>
> If $(f(x_n) - f(x_0))_{n=1}^\infty$ has no positive terms, then each term in $(\frac{f(x_n) - f(x_0)}{x-x_0})_{n=1}^\infty$ must be positive, so $L \geq 0$, contradicting our assumption that $L < 0$. Then by the properties of convergent limits, there must be infinitely many $x_n$ such that $f(x_n) - f(x_0)$ is positive. Therefore, these $f(x_n) > f(x_0)$, contradicting the fact that $f(x_0)$ is a local maximum on $(a,b)$. Then $ L$ cannot be negative.
>
> A similar proof holds for $L > 0$, so $L=0$.
>
> To solve for local minimum $f(x_0)$, define $g(x) := -f(x)$ and use the above result on local maximum $g(x_0)$. ∎

<hr/>

[^1]: Constructing the reals from first principles was profoundly enjoyable. Working through this book gave me a sense of certitude when dealing with math. Numbers are no longer simply familiar friends following familiar rules, but rather objects I _know_ how to construct. It feels great.
[^2]:
    Gather round, gather round - for it is on this blessed morn/day/evening that I recount my youthful dalliances with uncountable infinities!

    In my first term of college, I read _Gödel, Escher, Bach_ as part of a wonderful tutorial class. I came across sizes of infinities, and, like many, my mind absolutely refused. However, I wanted to understand what was really going on so intensely that I spent many hours working through the intuitions on my own (not knowing much of anything about formal mathematics). This period of discovery was one of my favorite experiences of my undergraduate career; I can't tell you how many nights I just sat under the stars, thinking. Eventually, I came to the conclusion that _of course_ there are multiple sizes of infinities.

    Now, maybe it would have been faster to just learn the math behind diagonalization or some other method of proof, but I think there was tremendous value in learning to fall in love with the process - to commit yourself fully to the joy of discovery and thought.

    I can certainly tell you that I wouldn't have made it so far so quickly down the research list if this journey didn't feel like one of the most beautiful things I've ever done.
