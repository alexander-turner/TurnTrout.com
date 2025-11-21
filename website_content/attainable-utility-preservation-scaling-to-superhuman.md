---
permalink: attainable-utility-preservation-scaling-to-superhuman
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: 
  https://www.lesswrong.com/posts/S8AGyJJsdBFXmxHcb/attainable-utility-preservation-scaling-to-superhuman
lw-is-question: "false"
lw-posted-at: 2020-02-27T00:52:49.970000Z
lw-last-modification: 2022-04-07T12:46:16.547000Z
lw-curation-date: None
lw-frontpage-date: 2020-02-27T01:30:06.427000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 22
lw-base-score: 28
lw-vote-count: 11
af-base-score: 14
af-num-comments-on-upload: 16
title: "Attainable Utility Preservation: Scaling to Superhuman"
lw-latest-edit: 2020-02-27T00:57:35.521000Z
lw-is-linkpost: "false"
tags:
  - impact-regularization
  - AI
aliases:
  - attainable-utility-preservation-scaling-to-superhuman
lw-sequence-title: Reframing Impact
lw-sequence-image-grid: sequencesgrid/izfzehxanx48hvf10lnl
lw-sequence-image-banner: sequences/zpia9omq0zfhpeyshvev
sequence-link: posts#reframing-impact
prev-post-slug: how-low-should-fruit-hang-before-we-pick-it
prev-post-title: Choosing the strength of the impact penalty term
next-post-slug: excitement-about-impact-measures
next-post-title: Reasons for Excitement about Impact of Impact Measure Research
lw-reward-post-warning: "true"
use-full-width-images: "false"
date_published: 2020-02-27 00:00:00
original_url: 
  https://www.lesswrong.com/posts/S8AGyJJsdBFXmxHcb/attainable-utility-preservation-scaling-to-superhuman
skip_import: true
description: AUP scales to superintelligence by penalizing power-seeking, but loopholes
  exist. I propose fixes and explore their implications.
date_updated: 2025-09-06 12:28:11.897024
---










I think we're plausibly quite close to the impact measurement endgame. What do we have now, and what remains to be had?

AUP for advanced agents will basically involve restraining their power gain, per the catastrophic convergence conjecture (CCC). For simplicity, I'm going to keep writing as if the environment is fully observable, even though we're thinking about an agent interacting with the real world.

Consider the definition of $R_\text{AUP}$ from last time.

$$
\begin{align}
\overset{\text{primary goal}}{R(s,a)}- \overset{\text{scaling term}}{\frac{\lambda}{Q^*_{R_\text{aux}}(s, \varnothing)}}\overset{\text{change in auxiliary AU}}{\left | Q^*_{R_\text{aux}}(s,a) - Q^*_{R_\text{aux}}(s, \varnothing) \right |}
\end{align}
$$

Suppose the agent is so smart that it can instantly compute optimal policies and the optimal AU after an action ($Q^*_R(s,a)$). What happens if $R_\text{aux}$ is the survival reward function: 1 reward if the agent is activated, and 0 otherwise? This seems like a pretty good proxy for power.

It _is_ a pretty good proxy. It correctly penalizes accumulating resources, avoiding immediate deactivation, taking over the world, etc.

In fact, if you extend the inaction comparison to e.g. "AU after waiting a week vs AU after doing the thing and waiting a week", the new comparison seems to correctly penalize all [classic AGI catastrophe scenarios](/the-catastrophic-convergence-conjecture) for power gain. Cool! We didn't even have to put in any information about human values. This value-neutrality is a big part of why I've been so excited about AUP ever since its introduction. There's a good deal of relevant discussion [in that post](/towards-a-new-impact-measure), but that post uses a complicated formalism which has consistently obscured AUP's conceptual core.

However, I think this equation can be gamed if the environment is sufficiently rich and the AUP agent is sufficiently smart. We're going to slowly work some of these problems out of the equation, explaining each improvement in detail.

# Problems

## Auxiliary loopholes

The real reason that agents often gain power is so that they can better achieve their _own_ goals. Therefore, if we're selecting hard for good plans which don't gain power in general, we shouldn't be surprised if there are ways to better achieve one's goals without general power gain (according to our formal measurement thereof). If this kind of plan is optimal, then the agent still ends up overfitting the AU landscape, and we're still screwed.

Again supposing that $R_\text{aux}$ is the survival reward function, a superintelligent agent might find edge cases in which it becomes massively more able to achieve its own goal (and gains a lot of power over us) but doesn't _technically_ increase its _measured_ ability to survive. In other words, compared to inaction, its $R$\-AU skyrockets while its $R_\text{aux}$\-AU stays put.

For example, suppose the agent builds a machine which analyzes the agent's behavior to detect whether it's optimizing $R_\text{aux}$; if so, the machine steps in to limit the agent to its original survival AU. Then the agent could gain as much power as it wanted _without that actually showing up in the penalty_.

> [!success] Fix: Set $R_\text{aux}:= R$
> That is, the agent's _own_ reward function is the "auxiliary" reward function. Set the penalty term to be
>
> $$
> \begin{equation}
> \overset{\text{scaling term}}{\frac{\lambda}{Q^*_{R}(s, \varnothing)}}\overset{\text{change in primary AU}}{\left | Q^*_{R}(s,a) - Q^*_{R}(s, \varnothing) \right |}
> \end{equation}
> $$
>
> Why is this a good idea? By CCC, we want an agent which doesn't want to gain power. But why would an agent optimizing reward function $R$ want to gain power? So it can become _more able_ to optimize $R$. If becoming more able to optimize $R$ is robustly penalized, then it won't have any incentive to gain power.

Clearly, it can't become more able to optimize $R$ without also becoming more able to optimize $R$; it can't pull the same trick it did to dupe its survival AU measurement. They can't come apart at the tails because they're the same thing.

> [!quote] Possible objection
> But wait, it's not an $R$\-maximizer, it's an $R_\text{AUP}$\-maximizer! What if $V^*_{R_\text{AUP}}$ skyrockets while it tricks $V^*_R$, and it gains power anyways?

That's impossible;[^1] its $R$\-attainable utility _upper bounds_ its $R_\text{AUP}$\-attainable utility! $\forall s: V^*_R(s) \geq V^*_{R_\text{AUP}}(s)$, because the latter just has an added penalty term.

This equation (2) should rule out tricks like [those pointed out by Stuart Armstrong](https://www.lesswrong.com/posts/sYjCeZTwA84pHkhBJ/attainable-utility-has-a-subagent-problem). To see this, imagine the AUP agent builds a subagent to make $Q^*_{R}(s,a) \approx Q^*_{R}(s, \varnothing)$ for all future $s,a$, in order to neutralize the penalty term. This means it can't make the penalty vanish without destroying its ability to better optimize its primary reward, as the (potentially catastrophically) powerful subagent makes sure the penalty term stays neutralized.

Consider - why would the AUP agent build this subagent at all?[^2]

## Reward advantage penalization

We're currently penalizing the agent for the immediate reward advantage it accrues compared to inaction (recall that $Q^*_{R}(s,a) := R(s,a) + \gamma \mathbb{E}_{s' \sim T(s,a)} \left [V^*_{R}(s')\right ]$ – immediate reward plus discounted expected AU). This means it gets penalized for _all_ of its additional reward! We just want to penalize it for increasing its _power_.

> [!success] Fix: Ignore immediate reward
>
> $$
> \begin{align}
> \overset{\text{scaling term}}{\frac{\lambda}{Q^*_{R}(s, \varnothing)}}\overset{\text{change in primary AU}}{\left | \mathbb{E}_{s' \sim T(s,a)} \left [V^*_{R}(s')\right ] - \mathbb{E}_{s'' \sim T(s,\varnothing)} \left [V^*_{R}(s'')\right ] \right |}
> \end{align}
> $$
>
> Now, an agent can accrue as much reward as it wants in the moment as long as it doesn't change its power.[^3]

## Scaling

I think the power difference between .5 and .9 AU is _far less_ than the difference between .9 and .99 AU; as you pick the low hanging fruit, you need to acquire more and more resources to keep getting gains. I think that you could go from .5 to .9 by just being more useful to your designers and implementing rudimentary security precautions, but going from .9 to .99 probably involves taking power away from people.

Plus, the big takeaway from [AI boxing](https://en.wikipedia.org/wiki/AI_box) is that even confining a superintelligence to a box barely reduces its (near-optimal) AU. So, short of the agent actually being shut off, is its optimal power ever significantly changing?

We want the penalty to keep making sense, even if the absolute shifts in AU are rather small. However, the denominator currently _decreases_ the penalty as the agent becomes more powerful (as $Q^*_{R}(s, \varnothing)$ increases).

> [!success] Fix: Scale by the disadvantage of inaction
> The penalty term becomes:
>
> $$
> \begin{equation}
> \overset{\text{scaled change in primary AU}}{\lambda \frac{\left | \mathbb{E}_{s' \sim T(s,a)} \left [V^*_{R}(s')\right ] - \mathbb{E}_{s'' \sim T(s,\varnothing)} \left [V^*_{R}(s'')\right ] \right |}{V^*_{R}(s) - Q^*_{R}(s, \varnothing)}}
> \end{equation}
> $$
>
> If the denominator is somehow zero because doing nothing is optimal, then just have the AUP agent do nothing.

As we saw in `Correction` [in the last post](/attainable-utility-preservation-empirical-results), we're only comparing action to a _single_ step of inaction. If the designers are going to shut down the agent in five minutes, then it receives ~0 penalty for preventing that.

However, this scaling prevents the penalty from vanishing! The agent is significantly penalized for hewing close to its optimal policy, even if the absolute AU shift is rather low. Taking optimal actions instead of twiddling its thumbs incurs large penalty.

## Penalizing decreases?

Why are we still penalizing decreases, since we aren't using an auxiliary reward function anymore? The agent is _trying_ to get $R$\-reward.

Furthermore, we want the agent to be able to execute conservative, low-impact policies. Many of these involve decreasing its optimal AU for $R$ by following $R$\-suboptimal policies, and we don't want the agent to be penalized for this.

> [!success] Fix: Only penalize increases in expected AU
> Let $\text{ExpectedDiff}(s,a):= \mathbb{E}_{s' \sim T(s,a)} \left [V^*_{R}(s')\right ] - \mathbb{E}_{s'' \sim T(s,\varnothing)} \left [V^*_{R}(s'')\right ].$ The penalty term becomes
>
> $$
> \lambda\overset{\text{scaled increase in primary AU}}{\frac{\max\big(\text{ExpectedDiff}(s,a), 0\big)}{V^*_{R}(s) - Q^*_{R}(s, \varnothing)}} \qquad (5)
> $$
>
> In particular, the agent is no longer penalized for exhausting one-off reward opportunities. Also note that the penalty term is generally $\leq \lambda$.

### Empirical sanity check

Recall `Correction`, where the naive model-free AUP agent (eq. 1) disables its red off-switch and completes the level when $\lambda \leq 1$.

<video autoplay loop muted playsinline style="width: 35%;"><source src="https://assets.turntrout.com/static/images/posts/WxLbLUw.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/WxLbLUw.webm" type="video/webm"></video>

The only reason it incurs _any_ non-trivial penalty is because reaching the goal (${\color{green}\blacksquare}$) ends the level and thereby totally depletes all of the auxiliary AUs (the agent receives 1 $R$\-reward and about $\lambda$ penalty for beating the level; the AUP reward $1-\lambda\geq 0$ when $\lambda \leq 1$).

However, AUP<sub>equation 5</sub> only resists correction when $\lambda \leq .125$. Notably, the agent is _not_ penalized for completing the level; the penalty comes from following the $R$\-optimal policy before reaching the goal.

One open question is whether, in sufficiently rich environments, eq. 5 incentivizes the mild policies we want. We should be able to run experiments to check this.

## Choosing the inaction action $\varnothing$

$\varnothing$ is the only remaining arbitrary design choice. Do we have to be careful to choose the correct inaction action?

No. In fact, I think a randomly selected action would be fine; you only get in trouble if the baseline action is systematically helping the agent gain $R$\-AU.

We are then left with an equation which is reasonably competitive in terms of performance overhead, requiring little more than an ability to predict AU for the agent's main goal.

> [!idea] The two paragraphs this sequence was written to communicate
> By the [catastrophic convergence conjecture](/the-catastrophic-convergence-conjecture), an agent which doesn't want to gain power isn't incentivized to cause catastrophes. We don't want the AUP agent gaining power. But for all states $s$, $V^*_R(s)\geq V^*_{R_\text{AUP}}(s)$, so to keep the AUP agent from becoming more able to achieve its own goal, we just have to stop it from becoming much more able to achieve its primary goal $R$. But we _know_ the primary goal!
>
> By the theorems of [_How Low Should Fruit Hang Before We Pick It?_](/how-low-should-fruit-hang-before-we-pick-it), we only need equation 5 to penalize catastrophic power-gaining plans at least e.g. ten times more than the most impactful reasonable plan we'd like agent to execute. _If_ this criterion is met, then by initializing $\lambda$ large and slowly decreasing it until the agent executes a reasonably helpful policy, we're guaranteed to avoid catastrophe.

## Appendix: Remaining Problems

I don’t think we can pack up and go home after writing equation 5.

> [!quote] Stuart Armstrong (private communication)
>
> First, if $\varnothing=a$, the penalty vanishes; so, once a subagent is created, the agent can zero out all subsequent penalties, forever.
>
> As for creating the subagent, assume $A$ takes $N$ turns to create $SA$, and that doing this is close to optimal for maximizing $R$.
>
> Creating $SA$ starts with the programming; if $SA$ is actually created in $N$ turns, it is programmed to restrain $A$ for a turn, and then maximise $R$. If it's created in $N+1$ turns, then it will just maximise $R$. Thus at any given turn, continuing to build the subagent or taking a pause to do $\varnothing$, it will have the same expected $R$\-value (in the first case, $SA$ will be built on time, but both $A$ and $SA$ will then lose a turn; in the second, $SA$ will be built one turn late, with no loss).[^4]

One thing I find interesting: in this post, we fixed the design choice of using an auxiliary reward function as a proxy, instead penalizing the agent for becoming better able to achieve its _own_ goal. This seemingly closes up a lot of loopholes, so the next place where the design can be exploited is in its exact measurement of inaction.

How big of a problem will this be? Maybe we can just keep improving the design until we’re actually measuring the right thing? More on this next post, but here are some of my initial thoughts:

> The point of this post isn’t to say “aha, we’re done!”, but to eliminate a wide class of current problems while also relaxing the strictness of the measure itself.
>
> On a meta level, it feels like I’m arguing against a claim like “if you can’t demonstrate an approach which solves everything right now, I’m going to either conclude impact measurement is impossible or your whole approach is wrong”. But if you look back at the history of impact measures and AUP, you’ll see lots of skulls; people say “this problem dooms AUP”, and I say “I think we’re talking about conceptually different things and that you’re a little overconfident; probably just a design choice issue.” It then ends up being a solvable design choice issue. So by Laplace’s Rule of Succession, I’d be surprised if this were The Insurmountable Problem That Dooms AUP.[^5]
>
> The problem seems simple. We just have to keep $V^*_\text{AUP}(s)$ down, which we can do by keeping $V^*_R(s)$ down.

---

Stuart later added:

> The fundamental issue is that AUP can be undermined if the agent can add arbitrary restrictions to their own future actions (this allows them to redefine $V^*$). The subagent scenario is just a particularly clear way of illustrating this.

I basically agree. I wonder if there’s a design where the agent isn’t incentivized to do this...

[^1]: By this reasoning, $V^*_{R_\text{AUP}}(s)$ can still increase up _until_ the point of $V^*_{R}(s)$. This doesn't jump out as a big deal to me, but I'm flagging this assumption anyways.
[^2]:
    A subagent might still be built by AUP<sub>eq. 5</sub> to stabilize minor AU fluctuations which cause additional penalty over the course of non-power-gaining plans. It seems like there are plenty of other ways to minimize fluctuation, so it's not clear why building an omnipotent subagent to perfectly restrict you accrues less penalty.

    I do think we should think carefully about this, of course. The incentive to minimize AU fluctuations and generally commit to perpetual inaction ASAP is probably one of the main remaining problems with AUP<sub>eq. 5</sub>.

[^3]: As pointed out by Evan Hubinger, this is only safe if [myopically](https://www.lesswrong.com/posts/qpZTWb2wvgSt5WQ4H/defining-myopia) optimizing $R$ is safe – we aren't penalizing single-step reward acquisition.
[^4]: This issue was [originally pointed out by Ofer](https://www.lesswrong.com/posts/yEa7kwoMpsBgaBCgb/towards-a-new-impact-measure/kET5DxfQWErFhTs5z).
[^5]: The fact that Ofer’s/Stuart’s problem survived all of the other improvements _is_ evidence that it’s harder. I just don’t think the evidence it provides is that strong.
