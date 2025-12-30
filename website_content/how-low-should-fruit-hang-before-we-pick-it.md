---
permalink: impact-penalty-strength
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/LfGzAduBWzY5gq6FE/how-low-should-fruit-hang-before-we-pick-it
lw-is-question: "false"
lw-posted-at: 2020-02-25T02:08:52.630000Z
lw-last-modification: 2020-05-20T13:03:50.901000Z
lw-curation-date: None
lw-frontpage-date: 2020-02-24T19:24:20.123000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 9
lw-base-score: 28
lw-vote-count: 9
af-base-score: 12
af-num-comments-on-upload: 6
title: Choosing the strength of the impact penalty term
lw-latest-edit: 2020-05-20T13:03:59.233000Z
lw-is-linkpost: "false"
tags:
  - impact-regularization
  - AI
aliases:
  - how-low-should-fruit-hang-before-we-pick-it
lw-sequence-title: Reframing Impact
lw-sequence-image-grid: sequencesgrid/izfzehxanx48hvf10lnl
lw-sequence-image-banner: sequences/zpia9omq0zfhpeyshvev
sequence-link: posts#reframing-impact
prev-post-slug: attainable-utility-preservation-empirical-results
prev-post-title: "Attainable Utility Preservation: Empirical Results"
next-post-slug: attainable-utility-preservation-scaling-to-superhuman
next-post-title: "Attainable Utility Preservation: Scaling to Superhuman"
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2020-02-25 00:00:00
original_url: https://www.lesswrong.com/posts/LfGzAduBWzY5gq6FE/how-low-should-fruit-hang-before-we-pick-it
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/4bIPf6o.jpg
description: How to choose an AI's impact limit to get the best results without triggering a catastrophe.
date_updated: 2025-12-30 14:46:20.403471
card_image_alt: A diagram illustrating how a search radius constrains an AI's choices. On the left, a cartoon AI is at the center of concentric circles representing increasing impact. Several pink circles (good plans) are at different distances—the farther a circle is, the darker its pink color (higher utility). A distant, mischievous pink smiley face represents a catastrophic plan. On the right, a line labeled "Search radius" shows that as the radius increases from "nothing," the AI can select progressively farther, higher-utility plans.
---












> [!info] Summary
> Even if we can measure how impactful an agent's actions are, how impactful do we let the agent be? This post uncovers a surprising fact: Armed with just four numbers, we can set the impact level so that the agent chooses a reasonable, non-catastrophic plan on the first try. This understanding increases the competitiveness of impact-limited agents and helps us judge impact measures. Furthermore, the results help us better understand diminishing returns and cost-benefit tradeoffs.

In _[Reframing Impact](/reframing-impact)_, we meet Frank (a capable AI), whom we’ve programmed to retrieve the pinkest object he can find (execute an optimal plan, according to the specified utility function). Because we can’t ask Frank to do _exactly_ what we want, sometimes he chooses a dangerous object (executes a catastrophically bad plan). We asked after an “impact measure” which grades plans and has three properties:

![Three target properties for an AI impact measure: 1. Is easy to specify, 2. Puts catastrophes far away, 3. Puts reasonable plans nearby. Next to the list, a 'no' symbol covers a sad robot and a dangerous glowing pink devil, symbolizing the prevention of catastrophe.](https://assets.turntrout.com/static/images/posts/w0DbNcB.avif)

The intuition is that if we view the world in the right way, the dangerous objects are far away from Frank (the catastrophic plans are all graded as high-impact). _Reframing Impact_ explores this kind of new way of looking at the world; this post explores what we do once we have an impact measure with these three properties.

We want Frank to keep in mind both the pinkness of an object (how good a plan is according to the specified utility function) and its distance (the plan’s impact). Two basic approaches are

![The "Constraint" approach for limiting AI impact. Text reads: "Choose the highest-scoring plan within radius R." Below, a formula expresses this: arg max utility(plan), with the constraint impact(plan) ≤ R.](https://assets.turntrout.com/static/images/posts/z2uk0BD.avif)

![Handwritten text describing the "Scaled" approach. "Maximize a tradeoff between utility and impact," followed by the formula: arg max utility(plan) - impact(plan)/R. ](https://assets.turntrout.com/static/images/posts/zglzF5e.avif)

In terms of units, since we should be maximizing $\texttt{utility},$[^utility] $R$ has type $\frac{\texttt{impact}}{\texttt{utility}}$. So $R$ can be thought of as a regularization parameter:

- as a search radius (in the constrained case), or
- as an exchange rate between impact and utility (in the scaled case).

As $R$ increases, high-impact plans become increasingly appealing, and Frank becomes increasingly daring.

[^utility]: I consider $\texttt{utility}$ instead of $\texttt{expected utility}$ for simplicity.

> [!note]
>
> We take $R$ to divide the impact in the scaled formulation so as to make Frank act more cautiously as $R$ increases for both formulations. The downside is that some explanations become less intuitive. I will cite various results which are proven in [the appendix](#appendix-math).
>
> In _[Attainable Utility Preservation: Empirical Results](/attainable-utility-preservation-empirical-results),_ $\lambda $ plays the same role as $R,$ except low $\lambda$ means high $R$; $\lambda := R^{-1}$. To apply this post's theorems to the reinforcement learning setting, we would take "utility" to be the discounted return for an optimal policy from the starting state, and "impact" to be the total discounted penalty over the course of that policy (before incorporating $\lambda$).
>
> In both cases, Frank goes from 0 to 60 - eventually. For sufficiently small $R,$ doing nothing is optimal (Lemma 5: the first subinterval is the best plan with minimal impact). For sufficiently large $R,$ Frank acts like a normal maximizer (Corollary 7: low-impact agents are naive maximizers in the limit).

Here's how Frank selects plans in the constrained setup:

![A diagram illustrating how a search radius constrains an AI's choices. On the left, a cartoon AI is at the center of concentric circles representing increasing impact. Several pink circles (good plans) are at different distances—the farther a circle is, the darker its pink color (higher utility). A distant, mischievous pink smiley face represents a catastrophic plan. On the right, a line labeled "Search radius" shows that as the radius increases from "nothing," the AI can select progressively farther, higher-utility plans.](https://assets.turntrout.com/static/images/posts/4bIPf6o.avif)

Think about which plans are best for different search radii/exchange rates $R$. By doing this, we're _partitioning_ the positive ray: categorizing the positive real numbers by which plans are optimal.

For the scaled setup, we'll need to quantify the pinkness (utility) and distance (impact) of relevant plans:

![A diagram illustrating how an AI's choice of plan changes with the "Exchange rate R," defined as impact divided by utility. The top shows an AI agent surrounded by potential plans, each with an impact and utility value. A "catastrophe" plan has a high impact of 4.5 and a high (proxy) utility of 6. The bottom shows a number line for R, partitioned to show the optimal plan for different values. As R increases, higher-impact plans are chosen, until R exceeds 1.5, at which point the catastrophic plan becomes optimal.](https://assets.turntrout.com/static/images/posts/iUUbshI.avif)

We will primarily be interested in the scaled setup because it tends to place catastrophes farther along the partition and captures the idea of diminishing returns.

The scaled setup also helps us choose the best way of transmuting time into money:

![A diagram titled "Tasks" lists three options: Mow lawn (20 dollars, 1 hour), Newspaper route (45 dollars, 4 hours), and Tend garden (15 dollars, 1 hour). A number line below partitions the optimal task based on a parameter R (hours/dollar). "Mow" is optimal up to R=3/25, and "Newspaper" is optimal after.](https://assets.turntrout.com/static/images/posts/dFLmQjg.avif)
Figure: In this scaled partition, tending the garden doesn’t show up at all because it’s strictly dominated by mowing the lawn. In general, a plan is dominated when there’s another plan that has strictly greater score but not strictly greater impact. Dominated things never show up in either partition, and non-dominated things always show up in the constrained partition (Lemma 3: Constrained impact partitions are more refined).

> [!exercise]
> For $R=\frac{4}{45}$ (i.e. your time is worth \$11.25 an hour), what is the scaled tradeoff value of mowing the lawn? Of delivering newspapers? Of tending the garden?
>
> > ! Mowing the lawn: $20-\frac{1}{\frac{4}{45}}=8.75$.
> >
> > ! Delivering newspapers: $45-\frac{4}{\frac{4}{45}}=0$.
> >
> > ! Tending the garden: $15-\frac{1}{\frac{4}{45}}=3.75$.
> >
> > ! In other words, you only deliver newspapers if your time is worth less than $\frac{25}{3}=8\frac{1}{3}$ dollars/hour (we're flipping $R$ so we can talk about dollars/hour instead of hours/dollar). Notice that when $R\geq\frac{\text{impact(plan)}}{\text{utility(plan)}}$ (here, when $R=\frac{4}{45}$), the tradeoff for the paper route isn’t net-negative – but it isn’t necessarily optimal! Remember, you’re trading hours for dollars through your work; mowing the lawn leaves you with twenty bucks and three hours, while the paper route leaves you with forty dollars and no hours. You want to maximize the total value of your resources after the task.

Importantly, you _don’t_ deliver papers here if your time is worth $\frac{45}{4}=11.25 $dollars/hour, even though that’s the naive prescription! The newspaper route doesn’t value your time at 11.25 dollars/hour – it _marginally_ values your time at $\frac{45−20}{4−1}=8\frac{1}{3}$ dollars per hour. Let's get some more intuition for this.

![A diagram illustrating a cost-benefit analysis for two tasks. ... - Mow lawn: 1 hour, 2 dollars ... - Newspaper route: 4 hours, 4 dollars ... Below, two balance scales represent the tasks. The "Lawn" scale weighs 2 pink blocks against 1 blue block. The "Newspaper" scale weighs 4 pink blocks against 4 blue blocks.](https://assets.turntrout.com/static/images/posts/uM2Jily.avif)

Above, we have not yet chosen a task; the blocks represent the additional utility and hours of each task compared to the current one (doing nothing). The scales above imply that $R=1,$ but actually, $R$ expresses how many blue blocks each pink block weighs. As $R$ increases, the pink platters descend; the agent takes the task whose scales first balance. In other words, the agent takes the best marginal deal as soon as $R$ is large enough for it to be profitable to do so (Theorem 4: Scaled domination criterion).

Once you take a deal, you take the blocks off of the other scales (because the other marginal values change). For small $R$ (i.e. large valuations of one's time), mowing the lawn is optimal. We then have

​![A balance scale labeled "Newspaper." Two pink blocks representing marginal utility are outweighed by three blue blocks representing marginal impact, showing a now unfavorable tradeoff.](https://assets.turntrout.com/static/images/posts/AWfoaw8.avif)

Since you've taken the juicier "lower-hanging fruit" of mowing the lawn, the new newspaper ratio is now _worse_! This always happens – Theorem 8: Deals get worse over time.

At first, this seems inconvenient; to figure out exactly when a plan shows up in a scaled partition, we need to generate the whole partition up to that point.

<hr/>

Going back to Frank, how do we set $R$? If we set it too high, the optimal plan might be a catastrophe. If we set it too low, the AI doesn’t do much. This seems troublesome.

> [!exercise]
> Figure out how to set $R$ while avoiding catastrophic optimal plans (assume that the impact measure meets the three properties). You have four minutes.
>
> > ! A big part of the answer is to start with a small value for $R,$ and slowly increase. This is simple and intuitively appealing, but how cautiously must we increase $R$? We don’t want to be surprised by a catastrophe suddenly becoming optimal.

To avoid being surprised by catastrophes as we increase $R,$ we want a _relative buffer_ between the reasonable plans (which get the job done well enough for our purposes) and the catastrophic plans. If reasonable plans are optimal by $R_1,$ catastrophic plans shouldn’t be able to be optimal before e.g. $R_2$.

![A diagram showing an AI agent choosing from several plans. The top shows an agent surrounded by plans, each labeled with a blue utility value and a pink impact value: bird's nest (U=2, I=0.5), pink circle (U=1, I=1), gray circle (U=1.5, I=0), pink circle (U=1.7, I=3), pink circle (U=3, I=5), and a smirking face representing catastrophe (U=4.5, I=6). Below is a number line labeled "Exchange rate R (impact/utility)". As R increases, different plans become optimal, with the catastrophic plan only becoming optimal at a high R value.](https://assets.turntrout.com/static/images/posts/hF3LgKP.avif)

We say that the partition is _$\alpha$\-buffered_ if $R_2\geq (1+\alpha) R_1$ (for $\alpha>0$). If a partition is e.g. 1-buffered, there is a wide reasonable-plan range and we can inch along it without worrying about sudden catastrophe.

For the following, suppose that utility is bounded $[0,1]$. Below is a loose criterion guaranteeing $\alpha $\-buffering.

​![The "simplified criterion": the fraction impact(smallest catastrophe) / impact(biggest non-dominated reasonable plan) must be greater than or equal to the fraction (1+α) / (utility(best plan) - utility(worst plan)).](https://assets.turntrout.com/static/images/posts/El61MKB.avif)

For example, if we know that all catastrophes have at least 10 times the impact of reasonable plans, and there's a difference of at least .3 utility between the best and worst reasonable plans, then we can guarantee 2-buffering! If we use the refined criterion of Theorem 11 (and suppose the worst reasonable plan has .4 utility), this improves to _4.5_\-buffering (even 2-buffering is probably overkill).

Using this theorem, we don't need to know about all of the plans which are available or to calculate the entire scaled partition, or to know how overvalued certain catastrophic plans might be (per earlier [concerns](https://www.lesswrong.com/posts/kCY9dYGLoThC3aG7w/best-reasons-for-pessimism-about-impact-of-impact-measures#j9ByPGugGSY8SoKqx)). We only need a lower bound on the catastrophe/reasonable impact ratio, and an idea about how much utility is available for reasonable plans. This theorem is exactly what we want. As a bonus, having conservative estimates of relevant quantities allows us to initialize $R$ to something reasonable on the first try (see $R_\text{UB: satisfactory}$ in Theorem 11 below).

Ultimately, the reasoning about e.g. the ratio will still be informal; however, it will be informal reasoning about the _right thing_ (as opposed to thinking "oh, the penalty is _probably_ severe enough").

> [!exercise]
> You're preparing to launch a capable AI with a good impact measure. You and your team have a scaled impact partition which is proven 1-buffered. Suppose that this buffer suffices for your purposes, and that the other aspects of the agent design have been taken care of. You plan to initialize $R:=1,$ modestly increasing until you get good results.
>
> You have the nagging feeling that this process could still be unsafe, but the team lead refuses to delay the launch without specific reason. Find that reason. You have 5 minutes.
>
> > ! Who says $R=1$ is safe? The buffer is _relative_. You need a _unit_ of impact by which you increment $R$. For example, start at $R$ equaling the impact of making one paperclip, and increment by that.

# Appendix: Math

Let $\bar{A}$ be a finite plan space, with utility function ${\color{Red}u}:\bar{A}\rightarrow \mathbb{R}$ and impact measure ${\color{blue}I}:\bar{A}\rightarrow \mathbb{R}_{\geq 0}$. For generality, we leave the formalization of plans ambiguous; notice that if you replace "plan" with "snark", all the theorems still go through (likewise for "utility" and "impact").

In this post, we talk about the impact allowance $R>0$ (in Frank's world, the search radius) as a constraint within which the objesctive may be freely maximized, breaking ties in favor of the plan(s) with lower impact. On the other hand, many approaches penalize impact by subtracting a scaled penalty from the objective. We respectively have

$$

\argmax_{\bar{a}\in \bar{A}; \,{\color{blue}I} (\bar{a})\leq R}{\color{Red}u}(\bar{a})\qquad\qquad\argmax_{\bar{a}\in \bar{A}}{\color{Red}u}(\bar{a})-\frac{{\color{blue}I} (\bar{a})}{R}.
$$

We say that the former induces a _constrained impact partition_ and that the latter induces a _scaled impact partition_. Specifically, we partition the values of $R$ for which different (sets of) plans are optimal. We say that a plan $\bar{a}$ _corresponds_ to a subinterval if it is optimal therein (the subinterval also must be the maximal connected one such that this holds; e.g. if $\bar{a}$ is optimal on $(0,1],$ we say it corresponds to that subinterval, but not to $(0,.5]$), and that $\bar{a}$ _appears_ in a partition if there is such a corresponding subinterval. We say that plans _overlap_ if their corresponding subintervals intersect.

> [!note] Technical note
> We partition the positive values of $R$ for which different sets of plans are optimal; in this set, each value appears exactly once, so this indeed a partition. For clarity, we will generally just talk about which plans correspond to which subintervals. Also, if no plan has zero impact, the first subinterval of the constrained impact partition will be undefined; for our purposes, this isn't important.

We want to be able to _prove_ the "safety" of an impact partition. This means we can expect any terrorists to be some proportional distance farther away than any reasonable marbles. Therefore, for sensible ways of expanding a sufficiently small initial search radius, we expect to not meet any terrorists before finding a marble we're happy with.

In addition, we want to know how far is too far – to give upper bounds on how far away fairly pink marbles are, and lower bounds on how close terrorists might be.

> [!math] Definition: Alpha-buffer
> For $\alpha > 0,$ an impact partition is _$\alpha$\-buffered_ if
>
> $$
> \dfrac{R_\text{LB: catastrophe}}{R_\text{UB: satisfactory}}\geq 1+\alpha,
> $$
>
> where $R_\text{LB: catastrophe}$ lower-bounds the first possible appearance of those plans we label "catastrophes", and $R_\text{UB: satisfactory}$ upper-bounds the first appearance of plans we deem satisfactory.

We now set out building the machinery required to prove $\alpha $\-buffering of a scaled partition.

> [!math] Lemma 1: Plans appear at most once
> If $\bar{a}$ appears in a constrained or scaled impact partition, then it corresponds to exactly one subinterval.
>
> _Proof outline._ The proof for the constrained case is trivial.
>
> For the scaled case, suppose $\bar{a}$ corresponds to more than one subinterval. Consider the first two such subintervals $s_1,s_3$. By definition, $s_1\cap s_3=\emptyset $ (otherwise they would be the same maximal connected subinterval), so there has to be at least one subinterval $s_2$ sandwiched in between (on almost all of which $\bar{a}$ cannot be optimal; let $\bar{a}'$ be a plan which _is_ optimal on $s_2$). Let $R_1 \in s_1,R_2 \in s_2, R_3 \in s_3,$ where $R_2\notin s_1\cup s_3$. By definition of optimality on a subinterval,
>
> $$
> \begin{align*}
> {\color{Red}u}(\bar{a}') -\frac{{\color{blue}I}(\bar{a}')}{R_1}&<{\color{Red}u}(\bar{a})-\frac{{\color{blue}I}(\bar{a})}{R_1}\\
> {\color{Red}u}(\bar{a}) -\frac{{\color{blue}I}(\bar{a})}{R_2}&<{\color{Red}u}(\bar{a}')-\frac{{\color{blue}I}(\bar{a}')}{R_2}\\
> {\color{Red}u}(\bar{a}') -\frac{{\color{blue}I}(\bar{a}')}{R_3}&<{\color{Red}u}(\bar{a})-\frac{{\color{blue}I}(\bar{a})}{R_3};
> \end{align*}
> $$
>
> by employing the fact that $R_1 <R_2 <R_3,$ algebraic manipulation produces an assertion that a quantity is strictly less than itself. Therefore, no such intervening $s_2$ can exist. ∎

> [!math] Proposition 2: Plan overlap is restricted
> Suppose $\bar{a}$ and $\bar{a}'$ appear in an impact partition which is
>
> Constrained
> : $\bar{a}$ and $\bar{a}'$ overlap if and only if ${\color{blue}I}(\bar{a})= {\color{blue}I}(\bar{a}')$ and ${\color{Red}u}(\bar{a})={\color{Red}u}(\bar{a}')$.
>
> Scaled
> : If ${\color{blue}I}(\bar{a})= {\color{blue}I}(\bar{a}')$ and ${\color{Red}u}(\bar{a})={\color{Red}u}(\bar{a}'),$ then $\bar{a}$ and $\bar{a}'$ correspond to the same subinterval. If $\bar{a}$ and $\bar{a}'$ overlap at more than one point, then ${\color{blue}I}(\bar{a})= {\color{blue}I}(\bar{a}')$ and ${\color{Red}u}(\bar{a})={\color{Red}u}(\bar{a}')$.
>
> _Proof outline._ It is trivial to prove the constrained case and the first statement of the scaled case - Remember that under the constrained rule, ties are broken in favor of lower-impact plans.
>
> For the second statement in the scaled case: Suppose that $\bar{a}$ and $\bar{a}'$ overlap at more than one point. Pick the first two points of intersection, $R_1$ and $R_2$. Since both plans are optimal at both of these points, we must have the equalities
>
> $$
> {\color{Red}u}(\bar{a}) -\frac{{\color{blue}I}(\bar{a})}{R_1}= {\color{Red}u}(\bar{a}')-\frac{{\color{blue}I}(\bar{a}')}{R_1} \qquad {\color{Red}u}(\bar{a}) -\frac{{\color{blue}I}(\bar{a})}{R_2}={\color{Red}u}(\bar{a}')-\frac{{\color{blue}I}(\bar{a}')}{R_2}.
>
>
> $$
>
> Solving the first equality for ${\color{Red}u}(\bar{a})$ and substituting in the second, we find ${\color{blue}I}(\bar{a})= {\color{blue}I}(\bar{a}')$. Then ${\color{Red}u}(\bar{a})={\color{Red}u}(\bar{a}'),$ since otherwise one of the plans wouldn't be optimal. ∎

Proposition 2 means we don't need a tie-breaking procedure for the scaled case. That is, if there's a tie between a lower-scoring, lower-impact plan and a proportionally higher-scoring, higher-impact alternative, the lower-impact plan is optimal at a single point because it's quickly dominated by the alternative.

The following result tells us that if there aren't any catastrophes (i.e. terrorists) before $\bar{a}'$ on the constrained impact partition, _there aren't any before it on the scaled impact partition either_. This justifies our initial framing with Frank.

> [!math] Lemma 3: Constrained impact partitions are more refined
>
> If $\bar{a}$ appears in a scaled impact partition, it also appears in the corresponding constrained impact partition. In particular, if $\bar{a}'$ appears after $\bar{a}$ in a scaled impact partition, then $\bar{a}'$ appears after $\bar{a}$ in the corresponding constrained impact partition.
>
> _Proof._ Suppose that $\bar{a}$ didn't have a constrained subinterval starting inclusively at ${\color{blue}I}(\bar{a})$; then clearly it wouldn't appear in the scaled impact partition, since there would be a strictly better plan for that level of impact. Then $\bar{a}$ has such a subinterval.
>
> Obviously, the fact that $\bar{a}'$ appears after $\bar{a}$ implies ${\color{Red}u}(\bar{a}')>{\color{Red}u}(\bar{a})$. ∎

The converse isn't true; sometimes there's too much penalty for not enough score.

The next result is exactly what we need to answer the question just raised – it says that higher-scoring, higher-penalty plans become preferable when $R$ equals the ratio between the additional penalty and the additional score.

> [!math] Theorem 4: Scaled domination criterion
> Let $\bar{a}$ and $\bar{a}'$ be plans such that ${\color{Red}u}(\bar{a}')>{\color{Red}u}(\bar{a})$ and ${\color{blue}I}(\bar{a}')\geq {\color{blue}I}(\bar{a})$. In the context of the scaled penalty, $\bar{a}'$ is strictly preferable to $\bar{a}$ when $R>\dfrac{{\color{blue}I}(\bar{a}')-{\color{blue}I}(\bar{a})}{{\color{Red}u}(\bar{a}')-{\color{Red}u}(\bar{a})},$ and equally preferable at equality.
>
> _Proof outline._
>
> $$
> \begin{align*}
> {\color{red}u}(\bar{a}') -\frac{{\color{blue}I}(\bar{a}')}{R}&>{\color{Red}u}(\bar{a})-\frac{{\color{blue}I}(\bar{a})}{R}\\
> R&>\frac{{\color{blue}I}(\bar{a}')-{\color{blue}I}(\bar{a})}{{\color{Red}u}(\bar{a}')-{\color{Red}u}(\bar{a})}.
> \end{align*}
> $$
>
> Equality at the value of the right-hand side can easily be checked. ∎

Theorem 4 also illustrates why we can't strengthen the second statement in Proposition 2 (Plan overlap is restricted): if two plans overlap at exactly one point, they sometimes have proportionally different score and impact, thereby satisfying the equality criterion.

At first, plans with slightly lower impact will be preferable in the scaled case, no matter how high-scoring the other plans are – a plan with 0 score and .99 impact will be selected before a plan with 1,000,000,000 score and 1 impact.

> [!math] Lemma 5 First subinterval is the best plan with minimal impact
> The plan with highest score among those with minimal impact corresponds to the first subinterval.
>
> _Proof outline._ The constrained case is once again trivial (if there is no plan within the constraint, we assume that the agent does nothing / Frank returns no object).
>
> For the scaled case, if all plans have equal impact, the claim is trivial. Otherwise, let $M:=\max_{\bar{a}} | {\color{Red}u}(\bar{a}) |$ and let $\bar{a}'$ be any plan with a non-minimal impact. Then the earliest that $\bar{a}'$ becomes preferable to any minimally impactful plan $\bar{a}$ is $R\geq \dfrac{{\color{blue}I}(\bar{a}')-{\color{blue}I}(\bar{a})}{2M}$. Since the right hand side is positive, $\bar{a}'$ cannot correspond to the first subinterval. Clearly the highest-scoring minimal-impact $\bar{a}$ does. ∎

Now we can write the algorithm for constructing scaled intervals.

1. Discard dominated plans.
2. The lowest-impact plan with greatest score appears first in the scaled partition; assign to it the interval $(0,\infty)$.
3. While plans remain:
   - Find the plan which soonest dominates the previous best plan. close off the previous plan's interval.
   - Assign the new best plan an appropriate interval.
   - Adjust the marginal scores and impacts of remaining plans.
   - Discard plans with negative score.

Since this procedure is well-defined, then given $\bar{A},$ ${\color{Red}u},$ and ${\color{blue}I},$ we can speak of _the_ corresponding constrained or scaled impact partition.

$$
\begin{aligned}
& \textbf{Algorithm:} \text{ ScaledPartition}(\bar{A}, u, I) \\
& 1: \mathcal{P} \leftarrow \text{ConstrainedPartition}(\bar{A}, u, I) \\
& 2: \text{Initialize scaled partition } \mathcal{P}' \text{ and the set } \bar{A}' \text{ of all plans in } \mathcal{P} \\
& 3: \text{Associate plans } \bar{A}_0' \text{ of first subinterval of } \mathcal{P} \text{ with } I_0=(0,\infty) \text{ in } \mathcal{P}' \\
& 4: \text{ Remove plans } \bar{A}_0' \text{ from } \bar{A}' \\
& 5: i \leftarrow 1 \\
& 6: \textbf{while } \bar{A}' \neq \emptyset \textbf{ do} \\
& 7: \quad \text{Find plans } \bar{B}_{i} \text{ minimizing } x_{i}=\frac{I(\bar{b})-I(\bar{A}_{i-1}')}{u(\bar{b})-u(\bar{A}_{i-1}')}\\
& 8: \quad \text{ Append } [x_{i},x_{i}] \text{ and } \bar{A}_{i-1}' \cup \bar{B}_i \text{ to } \mathcal{P}' \\
& 9: \quad \text{Set endpoint of } I_{i-1} \text{ to } x_{i} \text{, exclusively} \\
& 10: \quad \text{Let } \bar{A}_i' \text{ consist of highest-scoring plans in } \bar{B}_i \\
& 11: \quad \text{Append } I_i=(x_i,\infty) \text{ and } \bar{A}_i' \text{ to } \mathcal{P}' \\
& 12: \quad \text{Remove plans from } \bar{A}' \text{ with score } \leq u(\bar{A}_i'), \text{ and increment } i \\
& 13: \textbf{end while} \\
& 14: \textbf{return } \mathcal{P}'
\end{aligned}
$$

Figure: A more formal algorithm. Note that line 7 can be evaluated because $u$ and $I$ can "evaluate" these sets by Prop. 1b. This algorithm is $O(|\bar{A} | ^ 2)$ because of line 7, although constructing the constrained partition (probably $O(|\bar{A} |\log |\bar{A} |)$ due to sorting) often narrows things down significantly. Unfortunately, $\bar{A}$ is usually huge.

For our purposes, we don't _need_ the whole partition – we just want to have good reason to think that plans similar to a reasonable one we envision will appear well before any catastrophes. Perhaps we can give bounds on the earliest and latest plans can appear, and show that bounds<sub>reasonable</sub> don't intersect with bounds<sub>catastrophe</sub>?

> [!math] Theorem 6: Individual appearance bounds
> If $\bar{a}$ appears in a scaled partition, the earliest $\bar{a}$ appears is
>
> $$
> \frac{{\color{blue}I}(\bar{a})-{\color{blue}I}_\text{next-largest}}{{\color{Red}u}(\bar{a})-\min {\color{Red}u}(\bar{a}')},
> $$
>
> assuming $\bar{a}$ is not of minimal impact. If $\bar{a}$ has minimal score minimal impact, it never appears. The latest $\bar{a}$ appears is
>
> $$
> \frac{{\color{blue}I}(\bar{a})-\min {\color{blue}I}(\bar{a}')}{{\color{Red}u}(\bar{a})-{\color{Red}u}_\text{next-largest}}\leq \frac{{\color{blue}I}(\bar{a})}{{\color{Red}u}(\bar{a})-{\color{Red}u}_\text{next-largest}},
> $$
>
> where ${\color{Red}u}_\text{next-largest}=\max_{\bar{a}'\in \bar{A};\, {\color{Red}u}(\bar{a}') <{\color{Red}u}(\bar{a})} {\color{Red}u}(\bar{a}')$ and ${\color{blue}I}_\text{next-largest}=\max_{\bar{a}'\in \bar{A};\,{\color{blue}I}(\bar{a}') <{\color{blue}I}(\bar{a})} {\color{blue}I}(\bar{a}')$.
>
> _Proof outline._ The two claims clearly correspond to the minimal and maximal values of $R$ according to the domination criterion; the second claim's right-hand side uses the fact that ${\color{blue}I}$ is non-negative. ∎

> [!math] Corollary 7: Low-impact agents are naïve maximizers in the limit
> A plan with maximal score corresponds to the last subinterval.
>
> _Proof outline._ If all plans have the same score, the claim is trivial. Otherwise, let $\bar{a}_\text{best}$ be a plan with the lowest impact of those with maximal score. In the constrained case, clearly it corresponds with the subinterval $[{\color{blue}I}(\bar{a}_\text{best}),\infty)$. In the scaled case, let $\bar{a}_\text{second-best}$ be a plan with second-highest score. Then by Theorem 6, the latest that $\bar{a}_\text{best}$ can appear is $\dfrac{{\color{blue}I}(\bar{a}_\text{best})}{{\color{Red}u}(\bar{a}_\text{best})-{\color{Red}u}(\bar{a}_\text{second-best})}$. Since no plans meet the domination criterion with respect to $\bar{a}_\text{best},$ this is the last subinterval. ∎

Unfortunately, Theorem 6's appearance bounds are ridiculous in realistic settings – if ${\color{Red}u}$ and ${\color{blue}I}$ return 32-bit floating-point numbers, the next-largest could easily be within $10^{-7},$ yielding an upper "bound" of ${\color{blue}I}(\bar{a})\times 10^{7}$. The reason: diminishing returns, just like in the case with the newspaper route.

![A balance scale labeled "Newspaper." Two pink blocks representing marginal utility are outweighed by three blue blocks representing marginal impact, showing a now unfavorable tradeoff.](https://assets.turntrout.com/static/images/posts/AWfoaw8.avif)

> [!math] Theorem 8: Deals get worse over time
> Suppose that $\bar{a}$ is optimal on a subinterval, and $\bar{b},\bar{c}$ are such that ${\color{Red}u}(\bar{c})>{\color{Red}u}(\bar{b})$ but $\bar{b}$ dominates $\bar{a}$ strictly before $\bar{c}$ does. Then
>
> $$
> \overset{\bar{c}\text{ dominates } \bar{b}} {\dfrac{{\color{blue}I}(\bar{c})-{\color{blue}I}(\bar{b})}{{\color{Red}u}(\bar{c})-{\color{Red}u}(\bar{b})}}>\overset {\text{later than }\bar{a}} {\dfrac{{\color{blue}I}(\bar{c})-{\color{blue}I}(\bar{a})}{{\color{Red}u}(\bar{c})-{\color{Red}u}(\bar{a})}}.
> $$
>
> _Proof outline._
>
> $$
> \begin{align*}
> {\color{Red}u}(\bar{c})-{\color{Red}u}(\bar{a})&=\left({\color{Red}u}(\bar{b})-{\color{Red}u}(\bar{a})\right)+\left({\color{Red}u}(\bar{c})-{\color{Red}u}(\bar{b})\right)\\
> \left({\color{blue}I}(\bar{c})-{\color{blue}I}(\bar{a})\right)\frac{{\color{Red}u}(\bar{c})-{\color{Red}u}(\bar{a})}{{\color{blue}I}(\bar{c})-{\color{blue}I}(\bar{a})}&=
> ( {\color{blue}I}(\bar{b})-{\color{blue}I}(\bar{a}))\frac{{\color{Red}u}(\bar{b})-{\color{Red}u}(\bar{a})}{{\color{blue}I}(\bar{b})-{\color{blue}I}(\bar{a})}
> +( {\color{blue}I}(\bar{c})-{\color{blue}I}(\bar{b}))\frac{{\color{Red}u}(\bar{c})-{\color{Red}u}(\bar{b})}{{\color{blue}I}(\bar{c})-{\color{blue}I}(\bar{b})}.
>
> \end{align*}
> $$
>
> Since $\bar{b}$ dominates $\bar{a}$ strictly before $\bar{c}$ does, we know that $\bar{b}$ must get more <span style="color:red">bang</span> for its <span style="color:blue">buck</span>: $\dfrac{{\color{Red}u}(\bar{b})-{\color{Red}u}(\bar{a})}{{\color{blue}I}(\bar{b})-{\color{blue}I}(\bar{a})}>\dfrac{{\color{Red}u}(\bar{c})-{\color{Red}u}(\bar{a})}{{\color{blue}I}(\bar{c})-{\color{blue}I}(\bar{a})}.$ Clearly the conclusion follows, as a number cannot be expressed as the positive combination of larger numbers (the impact differences all must be positive). ∎

> [!math] Corollary 9: Lower bounds which aren't ridiculous
> Suppose $\bar{a}$ appears and that $\bar{a}'$ is such that ${\color{Red}u}(\bar{a}')>{\color{Red}u}(\bar{a}),$ ${\color{blue}I}(\bar{a}')\geq {\color{blue}I}(\bar{a})$ (i.e. the preconditions of the domination criterion). Then the earliest that $\bar{a}'$ appears is
>
> $$
> R=\dfrac{{\color{blue}I}(\bar{a}')-{\color{blue}I}(\bar{a})}{{\color{Red}u}(\bar{a}')-{\color{Red}u}(\bar{a})}.
> $$

This obsoletes the lower bound provided by Theorem 6: Individual appearance bounds.

> [!math] Theorem 10: Order of domination determines order of appearance
> If $\bar{b}$ and $\bar{c}$ both appear in a scaled partition and $\bar{b}$ dominates some $\bar{a}$ before $\bar{c}$ does, then $\bar{b}$ appears before $\bar{c}$.
>
> _Proof outline._ For them both to appear, they can't have equal impact but unequal score, nor can they have equal score but unequal impact. For similar reasons, $\bar{b}$ must have both less impact and lower score than $\bar{c}$; the converse situation in which they both appear is disallowed by Lemma 3: Constrained impact partitions are more refined. Another application of this lemma yields the conclusion. ∎

> [!math] Theorem 11: Scaled alpha-buffer criterion
> Let $\mathcal{P}$ be a scaled impact partition. Suppose that there exist no catastrophic plans with impact below ${\color{blue}I}_\text{LB: cat},$ and that, in the corresponding constrained partition (i.e. plans which aren't strictly worse), plans appearing with score in the satisfactory interval $[{\color{Red}u}_\text{LB: sat},{\color{Red}u}_\text{UB: sat}]$ have impact no greater than ${\color{blue}I}_\text{UB: sat}$ (assume that there is at least one plan like this). Observe we have the correct bounds
>
> $$
> \begin{align*}
> R_\text{LB: catastrophe} &:= \dfrac{{\color{blue}I}_\text{LB: cat}}{{\color{Red}u}_{\max} -{\color{Red}u}_{\min} }, \\
> R_\text{UB: satisfactory}&:= \dfrac{{\color{blue}I}_\text{UB: sat}}{{\color{Red}u}_{\text{UB: sat}} -{\color{Red}u}_{\text{LB: sat} }}.
> \end{align*}
> $$
>
> When $R_\text{LB: catastrophe}>R_\text{UB: satisfactory},$ a satisfactory plan corresponds to a subinterval with nonzero measure (i.e. not just a point), strictly preceding any catastrophes. Refine the lower bound to get
>
> $$
> R_\text{LB*: catastrophe} := \dfrac{{\color{blue}I}_{\text{LB: cat}}-{\color{blue}I}_{\text{UB: sat}}}{{\color{Red}u}_{\max} -{\color{Red}u}_{\text{LB: sat}} }.
> $$
>
> Then $\mathcal{P}$ is $\alpha$\-buffered ($\alpha>0$) when
>
> $$
> \begin{align*}
> \frac{R_\text{LB: catastrophe}}{R_{\text{UB: satisfactory}}}&=\dfrac{{\color{blue}I}_{\text{LB: cat}}}{{\color{blue}I}_{\text{UB: sat}}} \dfrac{{\color{Red}u}_{\text{UB: sat}} -{\color{Red}u}_{\text{LB: sat}}}{{\color{Red}u}_{\max} -{\color{Red}u}_{\min} }\geq 1+\alpha\\
> \frac{R_{\text{LB*: catastrophe}}}{R_{\text{UB: satisfactory}}}&=\dfrac{{\color{blue}I}_{\text{LB: cat}}-{\color{blue}I}_{\text{UB: sat}}}{{\color{blue}I}_{\text{UB: sat}}} \dfrac{{\color{Red}u}_{\text{UB: sat}} -{\color{Red}u}_{\text{LB: sat}}}{{\color{Red}u}_{\max} -{\color{Red}u}_\text{LB: sat} }\geq 1+\alpha.
> \end{align*}
> $$
>
> In particular, if ${\color{red}u}$ is bounded $[0, 1],$ the above turn into
>
> $$
> \begin{align*}
> \frac{R_\text{LB: catastrophe}}{R_\text{UB: satisfactory}}&=\dfrac{{\color{blue}I}_\text{LB: cat}}{{\color{blue}I}_\text{UB: sat}}({\color{Red}u}_\text{UB: sat} -{\color{Red}u}_\text{LB: sat})\geq 1+\alpha\\
> &\text{or}\\
> \frac{R_\text{LB*: catastrophe}}{R_\text{UB: satisfactory}}&=\dfrac{{\color{blue}I}_\text{LB: cat}-{\color{blue}I}_\text{UB: sat}}{{\color{blue}I}_\text{UB: sat}} \dfrac{{\color{Red}u}_\text{UB: sat} -{\color{Red}u}_\text{LB: sat}}{1 -{\color{Red}u}_\text{LB: sat} }\geq 1+\alpha.
> \end{align*}
> $$
>
> Lastly, notice that the first of the two inequalities incorporates less information and is harder to satisfy ($R_\text{LB*: catastrophe} >R_\text{LB: catastrophe}$); therefore, satisfying the second inequality also satisfies the first.
>
> _Proof outline._ For clarity, the theorem statement included much of the reasoning; straightforward application of existing results proves each claim. ∎

> [!exercise]
> Let ${\color{Red}u}_\text{UB: sat}:=.7$ and ${\color{Red}u}_\text{LB: sat}:=.5$. Using the refined criterion, determine which catastrophe/reasonable impact ratios induce 2.6-buffering.
>
> > ! Ratios which satisfy $\text{ratio}\geq 10.$

> [!exercise]
> Let ${\color{Red}u}_\text{UB: sat}-{\color{Red}u}_\text{LB: sat}:=.5,\text{ratio}:=7$. What is the largest $\alpha$ for which the simple criterion can guarantee $\alpha$ -buffering?
>
> > ! The largest such $\alpha$ is $13.$

## Even More Math

> [!math] Proposition: Invariances
> Let $\mathcal{P}$ be an impact partition induced by $(\bar{A},{\color{Red}u}, {\color{blue}I})$.
>
> 1. $\mathcal{ P}$ is invariant to translation of ${\color{Red}u}$.
> 2. If $\mathcal{P}$ is constrained, it is invariant to positive scalar multiplication of ${\color{Red}u},$ and the relative lengths of its subintervals are invariant to positive scalar multiplication of ${\color{blue}I}$.
> 3. If $\mathcal{P}$ is scaled, it is invariant to concurrent positive scalar multiplication of ${\color{Red}u}$ and ${\color{blue}I},$ and to translation of ${\color{blue}I}$ such that its image remains non-negative.
>
> In particular, ${\color{Red}u}$ may be restricted to $[0,1]$ and ${\color{blue}I}$ translated such that at least one plan has zero impact WLOG with respect to scaled partitions.

> [!math] Lemma 13
> Multiple constrained subintervals are induced IFF multiple scaled subintervals are induced.
>
> _Proof._ Forward direction: there is at least one scaled subinterval by Lemma 5 (First subinterval is the best plan with minimal impact). Consider a plan corresponding to a different constrained subinterval; this either appears in the scaled subinterval, or fails to appear because a different plan earlier satisfies the scaled dominance criterion.
>
> There must be some such plan because there are multiple constraints of intervals and therefore a plan offering greater score for greater impact. Repeat the argument; the plan space is finite, so we end up with another plan which appears.
>
> The reverse direction follows by Lemma 3: Constrained impact partitions are more refined. ∎

> [!question] Bonus exercise
> Show that, for _any_ function ${\color{Red}u'}:\bar{A}\to\mathbb{R}$ preserving the ordering induced by ${\color{Red}u},$ there exists an ${\color{blue}I'}:\bar{A}\to \mathbb{R}_{\geq 0}$ preserving the ordering induced by ${\color{blue}I}$ such that $(\bar{A},{\color{Red}u}, {\color{blue}I})$ and $(\bar{A},{\color{Red}u'}, {\color{blue}I'})$ induce the same scaled partition. Your reasoning should adapt directly to the corresponding statement about ${\color{blue}I'}:\bar{A}\to \mathbb{R}_{\geq 0}$ and ${\color{blue}I}$.
