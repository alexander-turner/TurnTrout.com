---
permalink: instrumental-convergence-via-vnm-preferences
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/LYxWrxram2JFBaeaq/when-most-vnm-coherent-preference-orderings-have-convergent
lw-is-question: 'false'
lw-posted-at: 2021-08-09T17:22:24.056000Z
lw-last-modification: 2023-05-16T20:32:50.619000Z
lw-curation-date: None
lw-frontpage-date: 2021-08-09T17:35:43.890000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 4
lw-base-score: 53
lw-vote-count: 10
af-base-score: 30
af-num-comments-on-upload: 4
publish: true
title: When Most VNM-Coherent Preference Orderings Have Convergent Instrumental Incentives
lw-latest-edit: 2023-05-16T20:32:55.143000Z
lw-is-linkpost: 'false'
tags:
  - instrumental-convergence
  - rationality
  - AI
aliases:
  - when-most-vnm-coherent-preference-orderings-have-convergent
lw-sequence-title: The Causes of Power-seeking and Instrumental Convergence
lw-sequence-image-grid: sequencesgrid/hawnw9czray8awc74rnl
lw-sequence-image-banner: sequences/qb8zq6qeizk7inc3gk2e
sequence-link: posts#the-causes-of-power-seeking-and-instrumental-convergence
prev-post-slug: power-seeking-beyond-MDPs
prev-post-title: Seeking Power is Convergently Instrumental in a Broad Class of Environments
next-post-slug: satisficers-tend-to-seek-power
next-post-title: 'Satisficers Tend To Seek Power: Instrumental Convergence Via Retargetability'
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2021-08-09 00:00:00
original_url: 
  https://www.lesswrong.com/posts/LYxWrxram2JFBaeaq/when-most-vnm-coherent-preference-orderings-have-convergent
skip_import: true
description: VNM-coherent preference orderings have the same statistical incentives
  as utility functions, often leading to power-seeking behavior.
date_updated: 2025-06-03 22:57:00.423836
---









This post explains a formal link between "what kinds of instrumental convergence exists?" and "what does VNM-coherence tell us about goal-directedness?". It turns out that VNM coherent preference orderings have the **same** statistical incentives as utility functions; most such orderings will incentivize power-seeking in the settings covered by [the power-seeking theorems](/posts#the-causes-of-power-seeking-and-instrumental-convergence).

In certain contexts, coherence theorems _can_ have non-trivial implications, in that they provide Bayesian evidence about what the coherent agent will probably do. In the situations where the power-seeking theorems apply, coherent preferences **do** suggest some degree of goal-directedness. Somewhat more precisely, VNM-coherence is Bayesian evidence that the agent prefers to stay alive, keep its options open, etc.

However, VNM-coherence over _action-observation histories_ [tells you nothing](https://www.lesswrong.com/posts/NxF5G6CJiof6cemTw/coherence-arguments-do-not-imply-goal-directed-behavior) about what behavior to expect from the coherent agent, _because_ [there is no instrumental convergence for generic utility functions over action-observation histories](/power-seeking-beyond-MDPs#Instrumental-Convergence-Disappears-For-Utility-Functions-Over-Action-Observation-Histories)!

# Intuition for the result

The result follows because the VNM utility theorem lets you consider VNM-coherent preference orderings to be isomorphic to their induced utility functions (with equivalence up to positive affine transformation), and so these preference orderings will have the same generic incentives as the utility functions themselves.

# Formalism

Let $o_1, ..., o_n$ be outcomes, in a sense which depends on the context; outcomes could be world-states, universe-histories, or one of several fruits. Outcome lotteries are probability distributions over outcomes, and can be represented as elements of the $n$\-dimensional probability simplex (i.e. as element-wise non-negative unit vectors).

A preference ordering $\prec$ is a binary relation on lotteries; it need not be e.g. complete (defined for all pairs of lotteries). _VNM-coherent_ preference orderings are those which obey the [VNM axioms](https://en.wikipedia.org/wiki/Von_Neumann%E2%80%93Morgenstern_utility_theorem#The_axioms). By the VNM utility theorem, coherent preference orderings induce consistent utility functions over outcomes, and consistent utility functions conversely imply a coherent preference ordering.

> [!math] Definition 1: Permuted preference ordering
> Let $\phi\in S_n$ be an outcome permutation, and let $\prec$ be a preference ordering. $\prec_\phi$ is the preference ordering such that for any lotteries $L, M$: $L \prec_\phi M$ if and only if $\phi(L)\prec \phi(M)$.

> [!math]Definition 2: Orbit of a preference ordering
> Let $\prec$ be any preference ordering. Its orbit $S_n \cdot \prec$ is the set $\{\prec_\phi \mid \phi \in S_n\}$.

The orbits of coherent preference orderings are basically all the preference orderings induced by "relabeling" which outcomes are which.

> [!math]Lemma 3: Permuting coherent preferences permutes the induced utility function
> Let $\prec$ be a VNM-coherent preference ordering which induces VNM-utility function $u$, and let $\phi\in S_n$. Then $\prec_\phi$ induces VNM-utility function $u'(o_i) = u(\phi(o_i))$, where $o_i$ is any outcome.
>
> _Proof._ Let $L, M$ be any lotteries.
>
> 1. By the definition of a permuted preference ordering, $L \prec_\phi M$ if and only if $\phi(L)\prec \phi(M)$.
> 2. By the VNM utility theorem and the fact that $\prec$ is coherent, $\phi(L)\prec \phi(M)$ IFF $\mathbb{E}_{\ell \sim \phi(L)}[u(\ell)]<\mathbb{E}_{m \sim \phi(M)}[u(m)]$.
> 3. Since there are finitely many outcomes, we convert to vector representation: $\mathbf{u}^\top \left(\mathbf{P}_{\phi} \mathbf{l}\right) < \mathbf{u}^\top \left(\mathbf{P}_{\phi} \mathbf{m}\right)$.
> 4. By associativity, $\left(\mathbf{u}^\top \mathbf{P}_{\phi}\right) \mathbf{l} < \left(\mathbf{u}^\top \mathbf{P}_{\phi}\right) \mathbf{m}$.
> 5. But this is just equivalent to $\mathbb{E}_{\ell \sim L}[u(\phi(\ell))]<\mathbb{E}_{m \sim M}[u(\phi(m))]$. ∎

As a corollary, this lemma implies that if $\prec$ is VNM-coherent, so is $\prec_\phi$, since it induces a consistent utility function over outcomes.

Consider the orbit of any $\prec$. By the VNM utility theorem, each preference ordering can be considered isomorphic to its induced utility function (with equivalence up to positive affine transformation).

Then let $u$ be any utility function compatible with $\prec$. By the above lemma, consider the natural bijection between the (preference ordering) orbit of $\prec$ and the (utility function) orbit of $u$, where $\{\prec_\phi \,\mid\phi\in S_n\} \;\leftrightarrow\; \{u \circ \phi \,\mid\phi\in S_n\}$.[^representative]

When my [theorems](/environmental-structure-can-cause-instrumental-convergence) [on power-seeking](/power-seeking-beyond-MDPs) are applicable, some proportion of the right-hand side is guaranteed to make (formal) power-seeking optimal. But by the bijection and by the fact that the preference orderings incentivize the same things (by the VNM theorem in the reverse direction), the (preference ordering) orbit must have the _exact same proportion of elements_ for which (lotteries representing formal) power-seeking are optimal.

Conversely, if we know that some set _A_ of lotteries tends to be preferred over another set _B_ of lotteries (in the preference order orbit sense), then the same argument shows that _A_ tends to have greater expected utility than _B_ (in the utility function orbit sense). This holds for all (utility function) orbits, because every utility function corresponds to a VNM-coherent preference ordering.

So: orbit-level instrumental convergence for utility functions is equivalent to orbit-level instrumental convergence for VNM-coherent preference orderings.

# Implications

- [Instrumental convergence does not exist when maximizing expected utility over action observation histories (AOH)](/power-seeking-beyond-MDPs#Instrumental-Convergence-Disappears-For-Utility-Functions-Over-Action-Observation-Histories).

  - Therefore, VNM-coherence over action observation history lotteries [tells you nothing](https://www.lesswrong.com/posts/NxF5G6CJiof6cemTw/coherence-arguments-do-not-imply-goal-directed-behavior) about what behavior to expect from the agent.
  - Coherence over AOH tells you nothing _because_ there is no instrumental convergence in that setting!

- In certain contexts, coherence theorems _can_ have non-trivial implications, in that they provide Bayesian evidence about what the coherent agent will probably do.

  - In the situations where the power-seeking theorems apply, coherent preferences **do** suggest some degree of goal-directedness.
  - Somewhat more precisely, VNM-coherence is Bayesian evidence that the agent prefers to stay alive, keep its options open, etc.

- In some domains, preference specification may be more natural than utility function specification. However, in theory, coherent preferences and utility functions have the exact same statistical incentives.
  - In practice, they will differ. For example, suppose we have a choice between specifying a utility function which is linear over state features, or of doing behavioral cloning on elicited human preferences over world states. These two methods will probably tend to produce different incentives.

# The quest for better convergence theorems

Goal-directedness seems to more naturally arise from coherence over resources.[^resources]

[^resources]: I think the word "resources" is slightly imprecise here, because resources are only resources in the normal context of human life; money is useless when alone in Alpha Centauri, but time to live is not. So we want coherence over "things which are locally resources", perhaps.

> [!quote] [John Wentworth's review of _Seeking Power is Often Convergently Instrumental in MDPs_](https://www.lesswrong.com/s/fSMbebQyR4wheRrvk/p/6DuJxY8X45Sco4bS2?commentId=XXFt5nbkLQcsy8P5N#comments)
>
> in a real-time strategy game, units and buildings and so forth can be created, destroyed, and generally moved around given sufficient time. Over long time scales, the main thing which matters to the world-state is resources - creating or destroying anything else costs resources. So, even though there's a high-dimensional game-world, it's mainly a few (low-dimensional) resource counts which impact the long term state space. Any agents hoping to control anything in the long term will therefore compete to control those few resources.
>
> More generally: of all the many "nearby" variables an agent can control, only a handful (or summary) are relevant to anything "far away". Any "nearby" agents trying to control things "far away" will therefore compete to control the same handful of variables.
>
> Main thing to notice: this intuition talks directly about a feature of the world - i.e. "far away" variables depending only on a handful of "nearby" variables. That, according to me, is the main feature which makes or breaks instrumental convergence in any given universe. We can talk about that feature entirely independent of agents or agency. Indeed, we could potentially use this intuition to _derive_ agency, via some kind of coherence theorem; this notion of instrumental convergence is more fundamental than utility functions.

> [!quote] [John Wentworth's review of _Coherent decisions imply consistent utilities_](https://www.lesswrong.com/posts/RQpNHSiWaXTvDxt6R/coherent-decisions-imply-consistent-utilities?commentId=GyE8wvZuWcuiCaySb#comments)
> "resources" should be a derived notion rather than a fundamental one. My current best guess at a sketch: the agent should make decisions within multiple loosely coupled contexts, with all the coupling via some low-dimensional summary information - and that summary information would be the "resources". (This is exactly the kind of setup which leads to instrumental convergence.) By making Pareto resource efficient decisions in one context, the agent would leave itself maximum freedom in the other contexts. In some sense, the ultimate "resource" is the agent's action space. Then, resource trade-offs implicitly tell us how the agent is trading off its degree of control within each context, which we can interpret as something-like-utility.

This seems on-track to me. We now know [what instrumental convergence looks like in unstructured environments](/environmental-structure-can-cause-instrumental-convergence), and [how structural assumptions on utility functions affect the shape and strength of that instrumental convergence](/power-seeking-beyond-MDPs), and this post explains the precise link between "what kinds of instrumental convergence exists?" and "what does VNM-coherence tell us about goal-directedness?". I'd be excited to see what instrumental convergence looks like in [more structured models](https://www.lesswrong.com/posts/6DuJxY8X45Sco4bS2/seeking-power-is-often-convergently-instrumental-in-mdps?commentId=XXFt5nbkLQcsy8P5N).

> [!thanks]
> Thanks to Edouard Harris for pointing out that Definition 1 and Lemma 3 were originally incorrect.

[^representative]: In terms of instrumental convergence, positive affine transformation never affects the [optimality probability](/power-seeking-beyond-MDPs#formal-justification) of different lottery sets. So for each (preference ordering) orbit element $\prec_\phi$, it doesn't matter what representative we select from each equivalence class over induced utility functions — so we may as well pick $u \circ \phi$!
