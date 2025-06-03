---
permalink: question-about-defining-alignment-in-simple-setting
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: 
  https://www.lesswrong.com/posts/ghyw76DfRyiiMxo3t/open-problem-how-can-we-quantify-player-alignment-in-2x2
lw-is-question: "true"
lw-posted-at: 2021-06-16T02:09:42.403000Z
lw-last-modification: 2021-06-22T21:52:08.179000Z
lw-curation-date: None
lw-frontpage-date: 2021-06-16T03:22:56.602000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 59
lw-base-score: 23
lw-vote-count: 9
af-base-score: 15
af-num-comments-on-upload: 32
publish: true
title: How can we quantify player alignment in 2×2 normal-form games?
lw-latest-edit: 2021-06-18T18:47:49.115000Z
lw-is-linkpost: "false"
tags:
  - game-theory
  - AI
aliases:
  - open-problem-how-can-we-quantify-player-alignment-in-2x2
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2021-06-16 00:00:00
original_url: 
  https://www.lesswrong.com/posts/ghyw76DfRyiiMxo3t/open-problem-how-can-we-quantify-player-alignment-in-2x2
skip_import: true
description: "Quantifying player alignment in game theory: how aligned are the players'
  incentives in a given game? "
date_updated: 2025-04-12 09:51:51.137842
---




In my experience, [constant-sum games](http://www.cs.umd.edu/~hajiagha/474GT13/Lecture09102013.pdf) are considered to provide "maximally unaligned" incentives, and [common-payoff games](http://www.cs.umd.edu/~hajiagha/474GT13/Lecture09102013.pdf) are considered to provide "maximally aligned" incentives. How do we quantitatively interpolate between these two extremes? That is, given an arbitrary 2×2  payoff table representing a two-player [normal-form game](https://en.wikipedia.org/wiki/Normal-form_game) (like Prisoner's Dilemma), what extra information do we need in order to produce a real number quantifying agent alignment?

If this question is ill-posed, why is it ill-posed? And if it's not, we should probably understand how to quantify such a basic aspect of multi-agent interactions, if we want to reason about complicated multi-agent situations whose outcomes determine the value of humanity's future. (I started considering this question with Jacob Stavrianos over the last few months while supervising his [SERI project](/formalizing-alignment-in-game-theory).)

Thoughts:

- Assume the alignment function has range $[0,1]$ or $[-1,1]$.
  - Constant-sum games should have minimal alignment value, and common-payoff games should have maximal alignment value.

- The function probably has to consider a strategy profile (since different parts of a normal-form game can have different incentives; see e.g. [equilibrium selection](https://en.wikipedia.org/wiki/Equilibrium_selection)).
- The function should probably be a function of player A's alignment _with_ player B; for example, in a prisoner's dilemma, player A might always cooperate and player B might always defect. Then it seems reasonable to consider whether A is _aligned with_ B (in some sense), while B is not aligned with A ([they pursue their own payoff without regard for A's payoff](/game-theoretic-definition-of-deception)).
  - So the function need not be symmetric over players.

- The function should be invariant to applying a separate positive affine transformation to each player's payoffs; it shouldn't matter whether you add 3 to player 1's payoffs, or multiply the payoffs by a half.
- ~The function may or may not rely only on the players' orderings over outcome lotteries, ignoring the cardinal payoff values. I haven't thought much about this point, but it seems important.

If I were interested in thinking about this more right now, I would:

- Do some thought experiments to pin down the intuitive concept. Consider simple games where my "alignment" concept returns a clear verdict, and use these to derive functional constraints (like symmetry in players, or the range of the function, or the extreme cases).
- See if I can get enough functional constraints to pin down a reasonable family of candidate solutions, or at least pin down the type signature.

> [!success] I consider this problem solved [by Vanessa Kosoy](https://www.lesswrong.com/posts/ghyw76DfRyiiMxo3t/open-problem-how-can-we-quantify-player-alignment-in-2x2?commentId=6iqiFB2fJ7wfPsMJm)
> > Consider any finite two-player game in normal form (each player can have any finite number of strategies, we can also easily generalize to certain classes of infinite games). Let $S_A$ be the set of pure strategies of player $A$ and $S_B$ the set of pure strategies of player $B$. Let $u_A: S_A \times S_B \rightarrow \mathbb{R}$ be the utility function of player $A$. Let $(\alpha, \beta) \in \Delta S_A \times \Delta S_B$ be a particular (mixed) outcome. Then the alignment of player $B$ with player $A$ in this outcome is defined to be:
> >
> > $$
> > a_{B / A}(\alpha, \beta):=\frac{E_{\alpha \times \beta}\left[u_A\right]-\min _{\beta^{\prime} \in S_B} E_{\alpha \times \beta^{\prime}}\left[u_A\right]}{\max _{\beta^{\prime} \in S_B} E_{\alpha \times \beta^{\prime}}\left[u_A\right]-\min _{\beta^{\prime} \in S_B} E_{\alpha \times \beta^{\prime}}\left[u_A\right]} \in[0,1]
> > $$
> >
> >
> > Ofc so far it doesn't depend on $u_B$ at all. However, we can make it depend on $u_B$ if we use $u_B$ to impose assumptions on $(\alpha, \beta)$, such as:
>  >
> > - $\beta$ is a $u_B$-best response to $\alpha$ or
> > - $(\alpha, \beta)$ is a Nash equilibrium (or other solution concept)
> >  
> > Caveat: If we go with the Nash equilibrium option, $a_{B / A}$ can become "systematically" ill-defined (consider e.g. the Nash equilibrium of matching pennies). To avoid this, we can switch to the extensive-form game where $B$ chooses their strategy after seeing $A$'s strategy.
