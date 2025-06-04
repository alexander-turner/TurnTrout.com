---
permalink: all-of-statistics-textbook-review
lw-was-draft-post: 'false'
lw-is-af: 'false'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/NMfQFubXAQda4Y5fe/confounded-no-longer-insights-from-all-of-statistics
lw-is-question: 'false'
lw-posted-at: 2018-05-03T22:56:27.057000Z
lw-last-modification: None
lw-curation-date: None
lw-frontpage-date: 2018-05-03T22:51:31.990000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 7
lw-base-score: 21
lw-vote-count: 17
af-base-score: 7
af-num-comments-on-upload: 0
publish: true
title: "Confounded No Longer: Insights from 'All of Statistics'"
lw-latest-edit: 2018-05-03T22:56:27.057000Z
lw-is-linkpost: 'false'
tags:
  - summaries
  - scholarship-&-learning
aliases:
  - confounded-no-longer-insights-from-all-of-statistics
lw-sequence-title: Becoming Stronger
lw-sequence-image-grid: sequencesgrid/fkqj34glr5rquxm6z9sr
lw-sequence-image-banner: sequences/oerqovz6gvmcpq8jbabg
sequence-link: posts#becoming-stronger
prev-post-slug: internalizing-internal-double-crux
prev-post-title: Internalizing Internal Double Crux
next-post-slug: first-analysis-textbook-review
next-post-title: "Into the Kiln: Insights from Tao's 'Analysis I'"
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2018-05-03 00:00:00
original_url: 
  https://www.lesswrong.com/posts/NMfQFubXAQda4Y5fe/confounded-no-longer-insights-from-all-of-statistics
skip_import: true
description: A tour of fundamental statistical concepts, from basic probability to
  hypothesis testing and Bayesian inference.
date_updated: 2025-06-03 22:57:00.423836
---










> [!quote]Larry Wasserman, _All of Statistics_
>
> Using fancy tools like neural nets, boosting and support vector machines without understanding basic statistics is like doing brain surgery before knowing how to use a bandaid.

# Foreword

For some reason, statistics always seemed somewhat disjoint from the rest of math, more akin to a bunch of tools than a rigorous, carefully constructed framework. I am here to atone for my foolishness.

This academic term started with a jolt - I quickly realized that I was missing quite a few prerequisites for the Bayesian Statistics course in which I had enrolled, and that good ol' AP Stats wasn't gonna cut it. I threw myself at _All of Statistics_, doing a good number of exercises, dissolving confusion wherever I could find it, and making sure I could turn each concept around and make sense of it from multiple perspectives.

I then went even further, challenging myself during the bits of downtime throughout my day to do things like _explain variance from first principles, starting from the sample space, walking through random variables and expectation - without help_.

# All of Statistics

## 1: Introduction

## 2: Probability

_In which sample spaces are formalized._

## 3: Random Variables

_In which random variables are detailed and a multitude of distributions are introduced._

### Conjugate Variables

Consider that a random variable $X$ is a function $X:\Omega \to \mathbb{R}$. For random variables $X,Y$, we can then produce conjugate random variables $XY, X+Y$, with

$$
(XY)(\omega)=X(\omega) Y(\omega)\\
(X+Y)(\omega)=X(\omega)+Y(\omega).
$$

## 4: Expectation

### Evidence Preservation

$$
\mathbb{E}(\mathbb{E}(Y\,\mid\,X))=\mathbb{E}(Y)
$$

is [conservation of expected evidence](https://www.lesswrong.com/posts/jiBFC7DcCrZjGmZnJ/conservation-of-expected-evidence) (thanks to Alex Mennen for making this connection explicit).

### Marginal Variance

$$
\mathbb{V}(Y)=\mathbb{EV}(Y\,\mid\,X)+\mathbb{VE}(Y\,|\,X)
$$

> _Why_ does marginal variance have two terms? Shouldn't the expected conditional variance be sufficient?

This literally plagued my dreams.

_Proof (of the variance; I cannot prove it plagued my dreams):_

$$
\begin{align*}
\mathbb{V}(Y)&=\mathbb{E}\big(Y-\mathbb{E}(Y)\big)^2\\
&= \mathbb{E}\Big(\big(Y-\mathbb{E}(Y\,\mid\,X)\big) + \big(\mathbb{E}(Y\,|\,X) - \mathbb{E}(Y)\big)\Big)^2\\
&= \mathbb{E}\big(Y-\mathbb{E}(Y\,\mid\,X)\big)^2 + \mathbb{E}\Big(2\big(Y-\mathbb{E}(Y\,|\,X)\big)\big(\mathbb{E}(Y\,|\,X) - \mathbb{E}(Y)\big)\Big) + \mathbb{E}\big(\mathbb{E}(Y\,|\,X) - \mathbb{E}(Y)\big)^2\\
&= \mathbb{EV}(Y\,\mid\,X) + 2\mathbb{E}\Big(\big(Y-\mathbb{E}(Y\,|\,X)\big)\big(\mathbb{E}(Y\,|\,X)-\mathbb{E}(Y)\big)\Big) + \mathbb{VE}(Y\,|\,X)\\
&= \mathbb{EV}(Y\,\mid\,X) + 2\mathbb{E}\big(Y\mathbb{E}(Y\,|\,X)-Y\mathbb{E}(Y)-\mathbb{E}(Y\,|\,X)^2 +\mathbb{E}(Y\,|\,X)\mathbb{E}(Y)\big) + \mathbb{VE}(Y\,|\,X)\\
&= \mathbb{EV}(Y\,\mid\,X) + 2\Big(\mathbb{E}\big(Y\mathbb{E}(Y\,|\,X)\big)-\mathbb{E}\big(Y\mathbb{E}(Y)\big)-\mathbb{E}\big(\mathbb{E}(Y\,|\,X)^2\big) + \mathbb{E}\big(\mathbb{E}(Y\,|\,X)\mathbb{E}(Y)\big)\Big) + \mathbb{VE}(Y\,|\,X)\\
&= \underbrace{\mathbb{EV}(Y\,\mid\,X)}_\text{sample variance} + \underbrace{\mathbb{VE}(Y\,|\,X)}_\text{model variance}.
\end{align*}
$$

The middle term is eliminated as the expectations cancel out after repeated applications of conservation of expected evidence. Another way to look at the last two terms is the sum of the expected sample variance and the variance of the expectation.

#### Bessel's Correction

When calculating variance from observations $X_1,\dots,X_n$, you might think to write

$$
S^2_n=\frac{1}{n}\sum_{i=1}^{n}(X_i - \bar{X}_n)^2,
$$

where $\bar{X}_n$ is the sample mean. However, this systematically underestimates the actual sample variance, as the sample mean is itself unreliable (as demonstrated above). The corrected sample variance is thus

$$
S_n^2=\frac{1}{n-1}\sum_{i=1}^n(X_i-\bar{X}_n)^2.
$$

See [Wikipedia](https://en.wikipedia.org/wiki/Bessel%27s_correction#Source_of_bias).

## 5: Inequalities

## 6: Convergence

_In which the author provides [instrumentally useful convergence results](/toy-instrumental-convergence-paper-walkthrough); namely, the law of large numbers and the central limit theorem._

### Equality of Continuous Variables

For continuous random variables $X,Y$, we have $P(X=Y)=0$, which is surprising. In fact, for $x_i \sim X,y_i \sim Y$, $P(x_i=y_i)=0$ as well!

The continuity is the culprit. Since the cumulative density functions $F_X,F_Y$ are continuous, the limit of the density allotted to any given point is 0. See [also](https://stats.stackexchange.com/questions/32605/probability-of-two-values-being-equal-in-a-sample-drawn-from-a-continuous-distri#32607).

### Types of Convergence

> Let $X_1,X_2,\dots$ be a sequence of random variables, and let $X$ be another random variable. Let $F_n$ denote the CDF of $X_n$, and let $F$ denote the CDF of $X$.

#### In Probability

>      $X_n$ converges to  $X$ in probability, written  $X_n \overset{p}\to X$, if, for every  $\epsilon > 0$,  $P(|X_n-X|>\epsilon)\to0$ as  $n\to\infty$.

Random variables are functions $Y:\Omega\to\mathbb{R}$, assigning a number to each possible outcome in the sample space $\Omega$. Considering this fact, two random variables converge in probability when their assigned values are "far apart" (greater than $\epsilon$) with probability 0 in the limit. (See [also.](https://www.statlect.com/asymptotic-theory/convergence-in-probability))

#### In Distribution

> $X_n$ converges to $X$ in distribution, written $X_n \rightsquigarrow X$, if $\lim_{n \to \infty} F_n(t)=F(t)$ at all $t$ for which $F$ is continuous.

Fairly straightforward.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/converge_distribution.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/converge_distribution.webm" type="video/webm"></video>

A similar [^1] geometric intuition:

![](https://assets.turntrout.com/static/images/posts/Archimedes_pi.svg)
_Note:_ The continuity requirement is important. Imagine we distribute points uniformly on $(0,\frac{1}{n})$; we see that $X_n \rightsquigarrow 0$. However, $F_n$ is $0$ when $x \leq 0$, but $F(0)=1$. Thus CDF convergence does not occur at $x=0$.

#### In Quadratic Mean

> $X_n$ converges to $X$ in quadratic mean, written $X_n \overset{\text{qm}}\to X$, if $\mathbb{E}((X_n-X)^2)\to0$ as $n\to\infty$.

The expectation of the quadratic mean approaches 0; in contrast to convergence in probability, dealing with expectation means that values of $X_n$ highly deviant with respect to $X$ come into play. For example, if $X_n \overset{p}\to X$ but the extremal values of $X_n$ increase in squared distance more quickly than they decrease in probability, $X_n$ will not converge to $X$ in quadratic mean.

## 7: Models, Statistical Inference and Learning

_In which the attentive reader notices the chapter's tautological title - "statistical inference" and "learning" are taken to mean the same thing. Estimators are introduced, along with the definition of bias, consistency, and mean squared error._

## 8: Estimating the CDF and Statistical Functionals

_In which the empirical distribution function and plug-in estimators set the stage for..._

## 9: The Bootstrap

_In which we learn to better approximate statistics via simulation._

## 10: Parametric Inference

_In which we explore those models residing in finite-dimensional parameter space._

### Fisher Information

The score function captures how the log-likelihood $\ell$ changes with respect to $\theta$:

$$
s(X;\theta)=\frac{\partial \log f(X;\theta)}{\partial \theta}.
$$

Informally, this is the sensitivity of $\ell$ to the parameter $\theta$. The derivative of the score captures the curvature of $\ell$ with respect to $\theta$; essentially, this represents how much information $X$ provides about $\theta$. The Fisher information is then the expected knowledge gain:

$$
\mathcal{I}(\theta)=-\mathbb{E}\bigg[\frac{\partial^2}{\partial\theta^2}\log f(X;\theta) \;\bigg|\; \theta\bigg].
$$

[Further reading](https://stats.stackexchange.com/questions/10578/intuitive-explanation-of-fisher-information-and-cramer-rao-bound).

### Factorization Theorem

> A statistic $T$ is sufficient ⇔ there are functions $g(t,\theta)$ and $h(x)$ such that $f(x^n;\theta)=g(t(x^n),\theta) h(x^n)$.

A statistic is sufficient if and only if we can reexpress the probability density function using just that statistic.

## 11: Hypothesis Testing and _p_\-values

_In which we make testable predictions and step towards traditional rationality. Trigger warning: frequentism._

### Frequently Confused

> [!quote] _Anchorman_
>
> Brian Fantana: They've done studies, you know. 60% of the time it works, every time.  
> Ron Burgundy: That doesn't make sense.

Confidence intervals ("in 60% of experiments just like this, we will see results within this interval") and credible intervals ("we believe that _this_ experiment has a result within this interval with 60% probability") are different things.

Frequentists define "confidence interval" to mean "theoretically, if we ran this experiment Lots of times, we'd get values in the interval 60% of the time". Without understanding this nuance, some results seem counterintuitive:

> In the example \[Jaynes\] gives, there is enough information in the sample to be _certain_ that the true value of the parameter lies nowhere in a properly constructed 90% confidence interval!

### \[Size Joke Here\]

In hypothesis testing, we're trying to discriminate between two sets of possible worlds - formally, we're partitioning our hypothesis space $\Theta$ into $\Theta_0$ (the null hypothesis) and $\Theta_1$ (the alternative hypothesis). Let's consider all of the things which can happen, all of the outcomes we can observe - the sample space $\Omega$.

A test $\varphi:\Omega\to\{0,1\}$ might take a sample and say "you're in $\Theta_0$" (for example). We can divvy up $\Omega$ into the acceptance region $\mathcal{A}$ (in which we accept the null hypothesis) and rejection region $\mathcal{R}$.

The power of a test $\varphi$ is the function $\beta:\Theta \to [0,1]$ that tells us the probability of rejecting the null hypothesis given some parameter: $\beta_\varphi(\theta)=\Pr(X\in\mathcal{R}\mid\theta)$. Basically, we have $\beta_\varphi(\theta)$ probability of rejecting the null hypothesis given that reality is actually parametrized by $\theta$.

We want to avoid rejecting the null hypothesis when $\theta \in \Theta_0$; therefore, we define some level of significance $\alpha$ for which $\beta_\varphi(\theta)\leq\alpha;\theta\in\Theta_0$. This means we're avoiding Type I errors $100\times(1-\alpha)\%$ of the time. The maximum probability that we commit a Type I error is the _size_ of the test $\varphi$: $\alpha_\varphi=\sup_{\theta\in\Theta_0}\beta_\varphi(\theta)$.

### The _p_\-value Alignment Problem

Getting your understanding of _p_\-values to align with how _p_\-values actually work (whatever that means) can require an impressive amount of mental gymnastics. Let's see if we can do better.

You're running an experiment in which you hypothesize that all dogs spontaneously combust when you whistle just so. You divide the hypothesis space into $\Theta_\text{dogs don't spontaneously combust}$ and $\Theta_\text{dogs do spontaneously combust}$ ( $\Theta_0$ and $\Theta_1$ for short); that is, sets of worlds in which your conjecture is false (null) and true (alternative). Each $\theta$ is a way-the-world-could-be. By the definition of _p_\-values, you may _only_ reject the null hypothesis if all worlds $\theta\in\Theta_0$ agree that the observation is unlikely.

> The _p_\-value is the probability (under the null hypothesis) of observing a value of the test statistic as or more extreme than what was actually observed.

Imagine if you could only Bayes update towards a set of worlds when _all_ the other world models agree that the observation is unlikely under their models.

## 12: Bayesian Inference

_In which we return to the familiar._

### Jeffreys' Prior

We often desire that our priors be _non-informative_, since finding a reasonable subjective prior isn't always feasible. One might think to use a uniform prior $f(\theta)=c$; however, this doesn't quite hold up.

Say I have a uniform prior $f(\theta)=1$ for the money in your bank account (each $\theta$ being a dollar amount). What if I want to know my prior for square of the amount of money in your bank account ( $\phi=\theta^2$)? Then by the change of variable equation for PDFs, we have $f_\Phi(\phi)=\frac{1}{2\sqrt{\phi}}$. We then desire that our prior be _transformation invariant_ - under a non-informative prior, I should be ignorant about both the value of your balance and the squared value of your balance.

Jeffrey's prior satisfies this desideratum - define

$$
f(\theta)\propto\sqrt{\mathcal{I}(\theta)},
$$

where $\mathcal{I}(\theta)$ is the Fisher information (discussed in the Ch. 10 summary):

$$
\mathcal{I}(\theta)=\underbrace{-\mathbb{E}\bigg[\frac{\partial^2}{\partial\theta^2}\log f(X;\theta) \;\bigg|\; \theta\bigg].}_{\text{expected information }X\text{ carries about } \theta}
$$

Jeffrey's prior isn't _totally_ non-informative - it encodes the information that we expect the prior to be transformation invariant, but that is rather weak information.

## 13: Statistical Decision Theory

_In which decision theory is defined as the theory of comparing statistical procedures._

## 14: Linear Regression

_In which the pieces start to line up._

### The Bias-Variance Tradeoff

![](https://assets.turntrout.com/static/images/posts/38Rf6NN.avif)
Figure: Image credit: Scott Fortmann-Roe

As more covariates are added to a model, the bias decreases while the variance increases. Let's say you call 30 friends and ask them whether they agree with the Copenhagen interpretation of quantum mechanics, or with many-worlds. Say that you build a model with 5 covariates (such as age, sex, race, political leaning, and education level). This has _decreased bias_ compared to a model which uses only education level, since descriptive power increases with the number of covariates. However, you _increase variance_ in the sense that any given friend is more likely to be differently classified every time you run the experiment with slightly different data sets.

If you're familiar with brain surgery (machine learning), we can use it to learn how to apply bandaids. Think of adding more covariates as sliding towards overfitting.

[Read more](http://scott.fortmann-roe.com/docs/BiasVariance.html).

### Degrees of Confusion

Perusing the Web, one finds numerous explanations for what degrees of freedom _actually are_. Some say it's the number of independent parameters required by a model, and others explain it as the number of parameters which are free to vary. Is there a better framing?

Consider $X_1,\dots,X_n \overset{iid}\sim \mathcal{N}(0,1)$, and let $\bar{X}_n$ be the sample mean. Then the residuals vector $(X_1-\bar{X}_n,\dots,X_n-\bar{X}_n)$ has $n-1$ degrees of freedom. Why is this the case, and what does this _mean_?

Say we learn the values of $X_1,\dots,X_{n-1}$. Then _conditional on our already knowing the sample mean_, there is only one value that $X_n$ can take:

$$
X_n=n\bar{X}_n - \sum_{i=1}^{n-1} X_i.
$$

$X_n$ is totally determined by the first $n-1$ values (this is related to Bessel's correction).

Let's ask a similar question - how many bits of information do we need to specify our model? Statistics isn't acclimated to thinking in terms of bits, so "independent real-valued parameters" is the unit used instead. If you have more parameters, you need to gather more bits to have the same confidence that your explanation (model) fits the data you have observed. This requirement enforces an implicit Occamian prior: amongst models which fit the data equally well, prefer the model with the fewest degrees of freedom.

_I'd like to thank `TheMajor` for letting me steal their wonderful explanation._

## 15: Multivariate Models

## 16: Inference about Independence

## 17: Undirected Graphs and Conditional Independence

_In which  elementary graph theory and the pairwise and global Markov conditions are introduced._

## 18: Log-Linear Models

## 19: Causal Inference

### Simpson's Paradox

Sometimes you have two groups which individually exhibit a positive trend, but have a _negative_ trend when combined.

Imagine it is 2019, and Shrek 5 has just come out. [^2] Being an internet phenomenon, the movie is initially extremely popular with younger demographics, but has middling performance with middle-aged people. Consider concessions sales at a single theater: the younger group buys, on average, 1.8 large popcorns per person, while the older group only averages .7 larges. If 2/3 of the initial viewership at the theater is younger, then we have a weighted average of $\frac{2}{3}\cdot\frac{18}{10}+\frac{1}{3}\cdot\frac{7}{10}=1.4\bar{3}$ larges.

The older group actually likes the movie, and recommends it to their friends. The demographic decomposition is now fifty-fifty. During the second week, everyone is a bit hungrier and buys .1 more large popcorns per viewing on average. Then both groups are buying _more popcorn_, but the weighted average _decreased_: $\frac{1}{2}\cdot\frac{19}{10}+\frac{1}{2}\cdot\frac{8}{10}=1.35$ larges.

Obviously, the demographic split shifted the average. However, pretend you're the manager for the concessions stand. You monitor average per-person purchases and erroneously conclude that something you did made people less likely to buy, even though _both groups are buying more popcorn_.

If you don't control for confounders (in this case, demographics), the statistic of per-person purchases is _not reliable_ for drawing conclusions.

## 20: Directed Graphs

_In which passive and active conditioning are built up to by exploring the capacities of directed acyclic graphs for representing independence relations._

## 21: Nonparametric Curve Estimation

## 22: Smoothing Using Orthogonal Functions

> [!quote] _All of Statistics_
> The top plot is the true density for the Bart Simpson distribution.

## 23: Classification

## 24: Stochastic Processes

_In which we learn processes for dealing with sequences of dependent random variables._

## 25: Simulation Methods

## Final Verdict

This text is cleanly written and has reasonable exercises. Ideally, I would have gone through my calculus books first, but it wasn't a big deal. The main downside is that I couldn't find an answer key, but thanks to the generous help of my friends on Facebook and in the MIRIx Discord, it worked out.

I skimmed Ch. 21, as it seemed to be more about implementation than deep conceptual material. I intend to revisit Ch. 22 after reading Tao's _Analysis I_, which is next on my list.

This book took me less than two weeks at a few hours of studying per day.

# Forwards

## Tips

I quickly realized that learning the basics of the R programming language is essential for getting a large portion of the value this text can offer.

## Depth

Although I have fewer things to say on a meta level, I definitely got a lot out of this book. The most rewarding parts were when I noticed my confusion and _really_ dove in to figure out what was going on - in particular, my forays into random variables, confidence intervals, _p_\-values, and convergence types.

## Red

I definitely haven't arrived at full-fledged statistical sophistication, but I progressed so rapidly that I regularly thought "what caveman asked _that_ lol" when encountering questions I had asked just _days_ earlier.

This experience reinforced a realization I've had over the last month: I'm _so_ red, but I've been living like a white-blue. What does that even mean, and how is it relevant?

From Duncan's excellent [fake framework](https://www.lesswrong.com/posts/wDP4ZWYLNj7MGXWiW/in-praise-of-fake-frameworks), _[How the "Magic: The Gathering" Color Wheel Explains Humanity](https://medium.com/s/story/the-mtg-color-wheel-c9700a7cf36d):_

![](https://assets.turntrout.com/static/images/posts/mtg_colors.avif)

The most salient dichotomy present here, in my opinion, is that of red and white:

> Red and white disagree on questions of structure and commitment. Red is episodic, suspicious of rules and order because they constrain one’s ability to grow and change and freely choose. White is more diachronic, interested in finding the small compromises and sacrifices that will allow people to build trust and cooperate reliably.

White personalities often regard themselves as a continuous person, evolving in a somewhat orderly fashion. Red, on the other hand, feels disconnected from their past selves. After a certain amount of time, past-you feels like a different person who made choices that now seem ridiculous, if not alien. How old is your current iteration? Mine is three months, but what shocked me about this book was that I felt an intellectual disconnect with the me who existed _four days prior_.

Zooming out from _All of Statistics_, I think it's telling that I achieved fairly tectonic change [^3] by [learning to align my emotions with my reflectively coherent desires](/internalizing-internal-double-crux), to clear away emotional debris, and to channel my passion into discrete tasks. I was living as if I were a white, but it's now clear I'm a blue-red who exhibits white traits mostly in pursuit of peace of mind.

I no longer ask "how can I study most effectively?", but rather, "what does it feel like to be me right now, and how can I bring that into alignment with what I want to do?".

> Red seeks _freedom,_ and it tries to achieve that freedom through _action..._ For a red agent, victory feels fiery, beautiful, magnificent, and fierce — it’s the climax of a dance or a brawl or a love affair, the feeling of cresting a summit or having successfully ridden a wave. It’s feeling _alive._

<hr/>

[^1]: Although any shape in the sequence implied by the image does indeed have strictly different area than the circle it approximates (in contrast to $F_n$ and $F$), the analogy may still be helpful.
[^2]: Please don't wirehead thinking about this.
[^3]: I'm aware that this section isn't implementable.
