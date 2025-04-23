---
permalink: set-theory-textbook-review
lw-was-draft-post: 'false'
lw-is-af: 'false'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/WPtdQ3JnoRSci87Dz/set-up-for-success-insights-from-naive-set-theory
lw-is-question: 'false'
lw-posted-at: 2018-02-28T02:01:43.790000Z
lw-last-modification: None
lw-curation-date: None
lw-frontpage-date: 2018-02-28T02:01:48.531000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 40
lw-base-score: 31
lw-vote-count: 26
af-base-score: 8
af-num-comments-on-upload: 0
publish: true
title: "Set Up for Success: Insights from 'Naïve Set Theory'"
lw-latest-edit: 2018-02-28T02:01:43.790000Z
lw-is-linkpost: 'false'
tags:
  - scholarship-&-learning
aliases:
  - set-up-for-success-insights-from-naive-set-theory
lw-sequence-title: Becoming Stronger
lw-sequence-image-grid: sequencesgrid/fkqj34glr5rquxm6z9sr
lw-sequence-image-banner: sequences/oerqovz6gvmcpq8jbabg
sequence-link: posts#becoming-stronger
next-post-slug: lightness-and-unease
next-post-title: Lightness and Unease
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2018-02-28 00:00:00
original_url: https://www.lesswrong.com/posts/WPtdQ3JnoRSci87Dz/set-up-for-success-insights-from-naive-set-theory
skip_import: true
description: Functions are static sets; families are functions; Zorn's Lemma is hard.
  I reflect on my set theory learnings and effective self-study strategies.
date_updated: 2025-01-30 09:30:36.233182
---






# Foreword

[This book](http://smile.amazon.com/Naive-Set-Theory-Paul-Halmos/dp/1614271313/) has been reviewed [pretty](https://www.lesswrong.com/posts/Ee8CZW7wzaNdCENYG/book-review-naive-set-theory-miri-course-list) [thoroughly](https://www.lesswrong.com/posts/FvA2qL6ChCbyi5Axk/book-review-naive-set-theory-miri-research-guide) already. Rather than restate each chapter, I'll be sharing insights: some book-specific, some general.

I am proud of my time-to-completion for this book: just over a week, working around a strenuous course load. I went from having to focus really hard to pick up new concepts to reading notation nearly as fluently as the English surrounding it. The chapters started making sense - it felt less random, and more like a coherent story wherein the protagonist slowly adds $\mathcal{P}$owers to their arsenal.

# Naïve Set Theory

## Functions

Functions $f:X\to Y$ are _just_ **static sets** of ordered pairs $\{(x,f(x)):x \in X\}$ . They are _not_ dynamic indexing functions, they do _not_ perform efficient lookup, please do _not_ waste an hour of your life trying to figure out how you could do such a thing within the simple machinery afforded by set theory up to that point.

[Nate talked about this failure mode](https://www.lesswrong.com/posts/uX3HjXo6BWos3Zgy5/the-mechanics-of-my-recent-productivity) - how skipping over just one word a few chapters prior can cause you to waste hours. During my confusion, I knew this was probably the case, but I still couldn't manage to immediately overcome my intuitions of what a function should be. This is one reason I'm open to working through the [MIRI Research Guide](https://intelligence.org/research-guide/#two) with others.

## Families

Families are, ironically enough, just a special kind of function; don't let your intuition fool you - they aren't "groups of functions." A family belonging to $\prod_{i\in I} X_i$ maps each element $i$ of the index set $I$ to an element $x_i \in X_i$. For example, a family from $\{1,2\}$ to $X_1:=\{cat,dog\}, X_2 :=\{tent,\textit{fire}\}$ could be $\{(1,cat),(2,\textit{fire})\}$ (thanks to `Dacyn` for helping me clarify my writing).

## Zorn's Lemma

I spent three hours staring at this proof. I understood what Zorn's Lemma meant. I grasped the relevant concepts. I read other versions of the proof. I still spent three long hours on this damn proof, and then I went to my classes. I don't know why I ended up figuring it out, but I suspect it was a combination of two factors: my brain worked through some things during the day, and I _really wanted it_. On the bus home, I mentally snapped and decided I was _going to understand the proof_. And I did.

I'm pleased to share my [detailed proof outline](https://www.overleaf.com/read/ppftcthcvjxs) of Zorn's Lemma, the product of many hours of ambient exasperation, rewritten in my own notation. Looking back, the proof in the book was pretty bad. The book's proof was neither succinct nor intuitive, but instead imposed a marais of mental variable tracking on the reader. I think mine is at least a little better, if not fully fleshed-out at all junctures.

## Proof Calibration

As someone without a formal degree in mathematics, it was important for me to monitor how I approached the exercises in the book. Whenever the author began a proof, I tried to generate a mental proof sketch before reading further. Sometimes, I thought the proof would be easy and short, but it would turn out that my approach wasn’t rigorous enough. This was valuable feedback for calibration, and I intend to continue this practice. I'm still worried that down the line and in the absence of teachers, I may believe that I've learnt the research guide with the necessary rigor, go to a MIRIx workshop, and realize I hadn't been holding myself to a sufficiently high standard. Suggestions for ameliorating this would be welcome.

# Forwards

## Anticipation

One factor which helped me succeed was that I ensured my morning reading was what I most looked forward to each day. I was excited to go to sleep, wake up early, prepare a delicious breakfast, and curl up near the fireplace with book and paper handy. Trivial inconveniences can be fatal - do whatever you must to ensure you properly respect and anticipate your study time.

## Defense with the Dark Arts

Of all the productivity advice I've read, the most useful involves imbuing your instrumental goals with terminal values. Ever since having read that advice, every tedious assignment, every daily routine, every keystroke - they're all backed up by an intense desire to _do something_ about the precarious situation in which humanity finds itself.

## Internal Light

If you don't know where to start, I think the internal fire has to be lit first - don't try to force yourself to do this (or anything else) because you "should". "Stop the guilt-based motivation", proudly stake out what you want, and transform your life into a dazzling assortment of activities and tasks imbued with your terminal values, your brightest visions for yourself and the future.
