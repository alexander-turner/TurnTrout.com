---
permalink: linear-algebra-textbook-review
lw-was-draft-post: 'false'
lw-is-af: 'false'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/C6XJcWtxcMTeQPBs3/the-first-rung-insights-from-linear-algebra-done-right
lw-is-question: 'false'
lw-posted-at: 2018-04-22T05:23:49.024000Z
lw-last-modification: None
lw-curation-date: None
lw-frontpage-date: 2018-04-22T06:04:46.922000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 12
lw-base-score: 40
lw-vote-count: 27
af-base-score: 9
af-num-comments-on-upload: 0
title: "The First Rung: Insights from 'Linear Algebra Done Right'"
lw-latest-edit: 2018-04-22T05:23:49.024000Z
lw-is-linkpost: 'false'
tags:
  - scholarship-&-learning
aliases:
  - the-first-rung-insights-from-linear-algebra-done-right
lw-sequence-title: Becoming Stronger
lw-sequence-image-grid: sequencesgrid/fkqj34glr5rquxm6z9sr
lw-sequence-image-banner: sequences/oerqovz6gvmcpq8jbabg
sequence-link: posts#becoming-stronger
prev-post-slug: AI-textbook-review
prev-post-title: "The Art of the Artificial: Insights from 'Artificial Intelligence:
  A Modern Approach'"
next-post-slug: internalizing-internal-double-crux
next-post-title: Internalizing Internal Double Crux
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2018-04-22 00:00:00
original_url: 
  https://www.lesswrong.com/posts/C6XJcWtxcMTeQPBs3/the-first-rung-insights-from-linear-algebra-done-right
skip_import: true
description: "The author rediscovers their love for math while rigorously studying
  linear algebra, sharing insights and lessons learned along the way. "
date_updated: 2025-11-22 00:21:52.667251
---









# Foreword

Linear algebra, my old flame - how I missed you. At my undergraduate institution, linear algebra was my introduction to proof-based mathematics. Some people shake hands, and some people **shake hands**. You know the type - you grasp their hand, and they clamp down and pull you in, agitating so wildly you fear for the structural integrity of your joints. My first experience with proofs was an encounter of the latter variety.

I received my first homework grade, and I was _not_ pleased with my performance. I promptly went to the library and vowed not to leave until I learned how to write proofs adequately. The hours passed, and, (thankfully for my stomach), I got it. I didn't let up all semester. Immediately before the final exam, I was doing pushups in the hallway, high-fiving my friends, and watching the [Michael Jordan Top 50 All Time Plays](https://www.youtube.com/watch?v=LAr6oAKieHk) video while visualizing myself doing that to the test. Do that to the test I did indeed.

This time around, the appropriately acronymized _LADR_ is the first step on my journey to attain a professional-grade mathematical skillset.

## Tight Feedback Loops

In a (possibly maniacal) effort to ensure both mastery of the material and the maturation of my proof skillset, I did nearly [^1] every one of the 561 exercises provided. I skipped problems only when I was confident I wouldn't learn anything, or calculus I didn't remember was required (and the payoff didn't seem worth the time spent relearning it now in a shallow manner, as opposed to thoroughly learning more calculus later). If I could sketch a solid proof in my head, I wouldn't write anything down. Even in the latter case, I checked my answers using [this site](http://linearalgebras.com/) (additional solutions may be found [here](https://github.com/guestname/linear-algebra-done-right-solutions), although be warned that not all of them are correct).

I also sometimes elected to give myself small hints after being stuck on a problem for a while; the idea was to keep things at the difficulty sweet spot. Specifically, I'd spend 10-20 minutes working on a problem by myself; if I wasn't getting anywhere, I'd find a hint and then _backpropagate the correct mental motion instead of what I had been trying to do._ I think that focusing on where you were going wrong and what insight you _should_ have had, in what direction you _should_ have looked, is more efficient than just reading solutions.

Over time, I needed fewer hints, even as problem difficulty increased.

My approach was in part motivated by the [findings of Rohrer and Pashler](http://thesciencenetwork.org/docs/BrainsRUs/Increasing%20Retention_Pashler.pdf):

> Surprisingly little is known about how long-term retention is most efficiently achieved... Our results suggest that a single session devoted to the study of some material should continue long enough to ensure that mastery is achieved but that immediate further study of the same material is an inefficient use of time.

The point isn't to struggle _per se_ - it's to improve and to _win_.

# $\mathcal{L}$inear $\mathcal{A}$lgebra $\mathcal{D}$one $\mathcal{R}$ight

This book has been previously [reviewed](https://www.lesswrong.com/posts/DWmrLjo5CgzK2Xmzk/book-review-linear-algebra-done-right-miri-course-list) by Nate Soares; as such, I'll spend time focusing on the concepts I found most difficult. Note that his review was for the second edition, while mine is for the third.

True to my vow in the [last post](/AI-textbook-review), I have greatly improved my proof [generation abilities](https://www.lesswrong.com/posts/i42Dfoh4HtsCAfXxL/babble). To demonstrate, I've shared [some of my proofs](https://www.overleaf.com/read/qmrzyczfdycf).

---

> [!quote] Linear Algebra Done Right
>
> If you zip through a page in less than an hour, you are probably going too fast.

Try me.

## 1: Vector Spaces

_In which the author reviews complex numbers, vector spaces, and subspaces._

I kept having trouble parsing

> For $ f, g \in F^S$, the sum  $f + g \in F^S$ is defined by $(f+g)(x) = f(x)+g(x)$ for all $x \in S$.

because my brain was insisting there was a type error in the function composition. I then had the stunning (and overdue) realization that my mental buckets for "set-theoretic functions" and "mathematical functions in general" should be merged.

That is, if you define

$$
\begin{align*}
f:X\to Y &= \{(x,f(x)):x\in X\}\\
g:X \to Y &= \{(x,g(x)):x \in X\},
\end{align*}
$$

then $(f+g):X\to Y$ simply has the definition $\{(x,f(x) + g(x)):x\in X\}$. There isn't "online computation"; the composite function simply has a different Platonic lookup table.

## 2: Finite-Dimensional Vector Spaces

_In which the author covers topics spanning linear independence, bases, and dimension._

## 3: Linear Maps

_In which the author guides us through the fertile territory of linear maps, introducing null spaces, matrices, isomorphisms, product and quotient spaces, and dual bases._

> So far our attention has focused on vector spaces. No one gets excited about vector spaces.

### Matrix Redpilling

The author built up to matrix multiplication by repeatedly insinuating that linear maps are secretly just matrix multiplications, teaching you to see the true fabric of the territory you've been exploring. Well done.

[Several](https://betterexplained.com/articles/linear-algebra-guide/) [resources](https://www.geogebra.org/m/QxWrMgBV) provide an intuitive understanding of matrix multiplication.

### Dual Maps

> If $T \in \mathcal{L}(V,W)$ then the dual map of $T$ is the linear map $T'\in\mathcal{L}(W',V')$ defined by $T'(\phi)=\phi∘T$ for $\phi \,\in \,W'$.

[This StackExchange post](https://math.stackexchange.com/questions/2169436/clarifying-the-definition-of-the-dual-map) both articulates and answers my initial confusion.

### Grueling Dualing

> The double dual space of $V$, denoted $V''$, is defined to be the dual space of $V'.$ In other words, $V''=(V')'.$ Define $\Lambda:V\to V''$ by $(\Lambda v)(\varphi)=\varphi(v)$ for $v\in V$ and $\varphi\in V'$.

Stay with me, this is dualble.

So $\Lambda$ takes some $v\in V$ and returns the [curried](https://en.wikipedia.org/wiki/Currying) function $\Lambda_v \in V''$. $\Lambda_v$, being in $V''$, takes some $\varphi \in V'$ and returns some $a\in \textbf{F}$. In other words, $\Lambda_v \in V''$ lets you evaluate the space of evaluation functions $(V')$ with respect to the _fixed_ $v\in V$. That's it!

## 4: Polynomials

_In which the author demystifies the quadratic formula, sharing with the reader those reagents used in its incantation._

> [!quote] Linear Algebra Done Right
>
> Remarkably, mathematicians have proved that no formula exists for the zeros of polynomials of degree 5 or higher. But computers and calculators can use clever numerical methods to find good approximations to the zeros of any polynomial, even when exact zeros cannot be found.
>
> For example, no one will ever be able to give an exact formula for a zero of the polynomial $p$ defined by $p(x)=x^5-5x^4-6x^3+17x^2+4x-7$.

...

Two cats live with me. Sometimes, I watch them meander around; it's fascinating to think how they go about their lives totally oblivious to the true nature of the world around them. The above incomputability result surprised me so much that I have begun to suspect that I too am a clueless cat (until I learn complex analysis; you'll excuse me for having a few other textbooks to study first).

_Edit:_ `daozaich` [writes](https://www.lesswrong.com/posts/qLdG44kpSoYzrzAp7/on-exact-mathematical-formulae) about why this isn't as surprising as it seems.

## 5: Eigenvalues, Eigenvectors, and Invariant Subspaces

_In which the author uses the prefix "eigen-" so much that it stops sounding like a word._

### Revisiting Material

Before starting this book, I watched 3Blue1Brown's [video](https://www.youtube.com/watch?v=PFDu9oVAE-g) on eigenvectors and came out with a vague "understanding". Rewatching it after reading Ch. 5.A, the geometric intuitions behind eigenvectors didn't seem like useful ways-to-remember an exotic math concept, they felt like a manifestation of how the world works. I _knew_ what I was seeing from the hundreds of proofs I'd done up to that point.

Imagine being blind yet knowing the minute details of each object in your room; one day, a miracle treatment restores your eyesight in full. Imagine then seeing your room for the "first time".

### Diagonalizability

Intuitively, the diagonalizability of some operator $T \in \mathcal{L}(V)$ on a finite-dimensional vector space $V$ means you can partition (more precisely, express as a direct sum) $V$ by the eigenspaces $E(\lambda_i,T)$.

Another way to look at it is that diagonalization is the mutation of the basis vectors of $V$ so that each column of $\mathcal{M}(T)$ is [one-hot](https://en.wikipedia.org/wiki/One-hot) [^2]; you then rearrange the columns (by relabeling the basis vectors) so that $\mathcal{M}(T)$ is diagonal.

### Unclear Exercise

On page 156, you'll be asked to verify that a matrix is diagonalizable with respect to a provided nonstandard basis. The phrasing of the exercise makes it seem trivial, but the book doesn't specify how to do this until Ch. 10. Furthermore, it isn't core conceptual material. Skip.

## 6: Inner Product Spaces

_In which the author introduces inner products, orthonormal bases, the Cauchy-Schwarz inequality, and a neat solution to minimization problems using orthogonal complements._

## 7: Operators on Inner Product Spaces

_In which the author lays out adjoint, self-adjoint, normal, and isometric operators, proves the (a) Spectral theorem, and blows my mind with the Polar and Singular Value Decompositions._

### Adjoints

Consider the linear functional $\varphi \in \mathcal{L}(W,F)$ given by $\langle Tv, w \rangle$ for fixed $v \in V$. $\varphi$ is then a linear functional on $W$ for the chosen $Tv$. The adjoint $T^*$ produces the corresponding linear functional in $\mathcal{L}(V,F)$; given fixed $w \in W$, we now map to some linear functional on $V$ such that $\langle  Tv, w \rangle = \langle v, T^*w \rangle$. The left-hand side is a linear functional on $W$, and the right-hand side is a linear functional on $V$.

### The Ghost Theorem

My brain was unreasonably excited for this chapter because I'd get to learn about "ghosts" (AKA the [Spectral theorem](https://en.wikipedia.org/wiki/Spectral_theorem)). My conscious self-assurances to the contrary completely failed to dampen this ambient anticipation.

## 8: Operators on Complex Vector Spaces

_In which generalized eigenvectors, nilpotent operators, characteristic and minimal polynomials, and the Jordan Form make an appearance, among others._

## 9: Operators on Real Vector Spaces

_In which real vector spaces are complexified and real operators are brought up to speed with their complex counterparts._

## 10: Trace and Determinant

_In which the curtain is finally pulled back._

> We proved the basic results of linear algebra before introducing determinants in this final chapter. Although determinants have value as a research tool in more advanced subjects, they play little role in basic linear algebra (when the subject is **done right**).

Sassy partial title drop (emphasis mine).

## Final Verdict

Overall, I really liked this book and its clean theoretical approach. By withholding `trace` and `det` until the end of the book, many properties were arrived at in a natural, satisfying, and enlightening manner. The proofs were clean, and the writing was succinct (although I did miss the subtle wit of Russell and Norvig). This book positively, definitely belongs on the MIRI book list.

# Forwards

## Timing

This review follows the [previous](/AI-textbook-review) by exactly four weeks; however, I was at [CFAR](http://rationality.org/) for a week during that time, dedicated a few days to _All of Statistics_ (my next review), and slowed myself considerably by doing **five hundred** proofs. If I were treating this as a normal textbook, I imagine it would have taken less than half the time.

The most exciting effect of diving into math like this is that when I don't understand a concept, I now eagerly look to the _formalization_ for clarification (previously, I'd barely be able to track all the Greek).

## Fluency

<!-- vale off -->
An interesting parallel between learning math and learning languages: when I started picking up French, at first the experience was basically always was "ugh now I have to look up 5 things to even have the vocabulary to ask how to turn on my computer". Eventually, it became natural to belt out _et comment est-ce que je peux allumer mon ordi ? L'enfoiré refuse de fonctionner, comme d'habitude ; c'est grand temps que j'en achète un de plus_. No checking needed.
<!-- vale on -->

And so it went with proofs - "what techniques can I use to translate this statement into the answer" turned into "the proof feels like it's flowing out of my arm?!".

## Proofs

I've noticed that when I successfully produce a non-trivial proof, it's nearly always when I have a strong understanding that _this is how the world is_. The proof is then just translating this understanding to math-ese, pounding away at the shell of the problem with every tool at my disposal to reach this truth.

Imagine a friend of yours fell under the ice. In one situation, you meander, blindfolded and half-deaf, with a vague idea of "I _think_ they were this way?", trying different things and occasionally hearing faint pounding.

Now consider the situation in which you _know_ where they are; it's then a matter of finding the right tools to smash the ice. You strike with everything you have, with every ounce of strength you possess; finally, you break your friend free.

### Impatience

My most obvious remaining weak point with proofs is impatience. I have a strong intuition that this impulse is borne from my programming experience. When I write code, I carefully consider pre- and post-conditions, expected use cases, and the context of the problem. When using an external library, things are different; when asked why something is appropriate for use in a (low-stakes) program, it's fine to only provide high-level intuitions.

Similarly, in the few situations in which I have had to prove a novel result, I have found myself being extremely cautious (and rightly so). However, when proving a known result, a strong desire to take shortcuts overtakes me. I'm going to have to keep ironing this out.

## Hiding Ignorance

Another aspect of this journey which I greatly enjoy is the methodical elimination of deficiencies and weak points. In my deep learning class, I had great trouble remembering what an eigenvalue was - it was at this moment that I knew I had to get down to business. Working with a surface-level understanding yields superficial results.

I imagine I was not the only person who was somewhat confused. However, being the first to admit confusion feels low-status: "everyone else seems to be following along, so I better be quiet and figure this out on my own time." I've made a point of ignoring this reasoning and asking more questions, and I think it's paid off. Incidentally, everyone else seemed relieved that the question got asked.

### LessWrong

I'd like to add that in these posts, I present a somewhat distorted perspective of my academic life; these weak points are the exception, not the norm (_ahem_). I focus on my weak points because I want to become stronger - to admit them is not necessarily to say "_I_ am weak" (although this may be the case relative to the person I want to become).

Speaking from experience, I feel that this is intimidating to newcomers. The culture can appear highly critical; this has been discussed before. I hope to do my part through these posts, in which I plainly admit "I forgot eigenvalues. I fixed it - and I'm better off for having done so."

## Calculus

The calculus-based exercises in this book and in _All of Statistics_ make me uncomfortable. In the spirit of not hiding ignorance, I'll admit it [^3] - I totally forgot how to integrate by parts, among other things. Although MIRI math is mostly discrete, I imagine that I'll still make a quick run through a calculus textbook in the near future.

I also find myself curious about real and complex analysis, but I suspect that's more of a luxury (given [timelines](http://slatestarcodex.com/2017/06/08/ssc-journal-club-ai-timelines/)). Maybe I'll learn it in my free time at some point.

## Lost Calling

I have the distinct feeling of having been incredibly silly for many years; one of the reasons being my pretending that I didn't love math. In high school, I did quite well (and was designated the outstanding mathematics student of my class) as a product of my passion for toying with math in my free time.

However, in college, I just wanted to learn computer science. I'd gloss over the low-level math (although I did do some [Project Euler](https://projecteuler.net/) for fun). Instead, I preferred learning to find clever high-level solutions and build up an algorithm-centric problem-solving toolkit. Now that I've truly taken the plunge, the water is just so nice.

I'm sorry to have been away for so long.

<hr/>

[^1]: For Ch. 8-10, I did a random sampling of 15% of the practice problems, as opposed to 100% (I was reaching steeply diminishing returns).
[^2]: Please let me know if there's a more appropriate linear-algebraic term for this.
[^3]: Merely admitting ignorance is not virtuous.

<!-- vale off -->
    > [!quote] _[The Twelve Virtues of Rationality](https://www.readthesequences.com/The-Twelve-Virtues-Of-Rationality)_
    >
    > The eighth virtue is humility. To be humble is to take specific actions in anticipation of your own errors. To confess your fallibility and then do nothing about it is not humble; it is boasting of your modesty. Who are most humble? Those who most skillfully prepare for the deepest and most catastrophic errors in their own beliefs and plans. Because this world contains many whose grasp of rationality is abysmal, beginning students of rationality win arguments and acquire an exaggerated view of their own abilities. But it is useless to be superior: Life is not graded on a curve. The best physicist in ancient Greece could not calculate the path of a falling apple. There is no guarantee that adequacy is possible given your hardest effort; therefore spare no thought for whether others are doing worse. If you compare yourself to others you will not see the biases that all humans share. To be human is to make ten thousand errors. No one in this world achieves perfection.
<!-- vale on -->

    The virtue is in shedding ignorance:

<!-- vale off -->
    > [!quote] _[The Twelve Virtues of Rationality](https://www.readthesequences.com/The-Twelve-Virtues-Of-Rationality)_
    >
    > The first virtue is curiosity. A burning itch to know is higher than a solemn vow to pursue truth. To feel the burning itch of curiosity requires both that you be ignorant, and that you desire to relinquish your ignorance. If in your heart you believe you already know, or if in your heart you do not wish to know, then your questioning will be purposeless and your skills without direction. Curiosity seeks to annihilate itself; there is no curiosity that does not want an answer. The glory of glorious mystery is to be solved, after which it ceases to be mystery. Be wary of those who speak of being open-minded and modestly confess their ignorance. There is a time to confess your ignorance and a time to relinquish your ignorance.
<!-- vale on -->
