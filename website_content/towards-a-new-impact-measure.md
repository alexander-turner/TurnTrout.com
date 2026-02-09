---
permalink: towards-a-new-impact-measure
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/yEa7kwoMpsBgaBCgb/towards-a-new-impact-measure
lw-is-question: 'false'
lw-posted-at: 2018-09-18T17:21:34.114000Z
lw-last-modification: 2024-03-02T01:17:26.725000Z
lw-curation-date: None
lw-frontpage-date: 2018-09-18T17:28:41.565000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 159
lw-base-score: 100
lw-vote-count: 43
af-base-score: 24
af-num-comments-on-upload: 119
title: Towards a New Impact Measure
lw-latest-edit: 2019-03-08T16:52:10.693000Z
lw-is-linkpost: 'false'
tags:
  - impact-regularization
aliases:
  - towards-a-new-impact-measure
lw-reward-post-warning: 'true'
use-full-width-images: 'false'
date_published: 2018-09-18 00:00:00
original_url: https://www.lesswrong.com/posts/yEa7kwoMpsBgaBCgb/towards-a-new-impact-measure
skip_import: true
description: "Impact is reframed as a change in attainable utility for both humans
  and AI agents. "
date_updated: 2025-11-22 00:21:52.667251
---











> [!note] Summary
> I propose a closed-form solution to [low impact](https://arbital.com/p/low_impact/), increasing [corrigibility](https://arbital.com/p/corrigibility/) and seemingly taking major steps to neutralize [basic AI drives](https://selfawaresystems.files.wordpress.com/2008/01/ai_drives_final.pdf) 1 (self-improvement), 5 (self-protectiveness), and 6 (acquisition of resources)
>
> **Previous posts:** [Worrying about the Vase: Whitelisting](/whitelisting-impact-measure), [Overcoming Clinginess in Impact Measures](/overcoming-clinginess-in-impact-measures), [Impact Measure Desiderata](/impact-measure-desiderata)

> [!quote] [Safe Impact Measure](https://arbital.com/p/4l/)
>
> To be used inside an [advanced agent](https://arbital.com/p/advanced_agent/), an impact measure... must capture so much variance that there is _no_ clever strategy whereby an advanced agent can produce some special type of variance that evades the measure.

If we have a safe impact measure, we may have arbitrarily intelligent unaligned agents which do _small_ (bad) things instead of _big_ (bad) things.

> [!note]
> For the abridged experience, read up to ["Notation"](#notation), skip to ["Experimental Results"](#experimental-results), and then to ["Desiderata"](#desiderata).

# What _is_ "Impact"?

One lazy Sunday afternoon, I worried that I had written myself out of a job. After all, [Overcoming Clinginess in Impact Measures](/overcoming-clinginess-in-impact-measures) basically said, "Suppose an impact measure extracts 'effects on the world'. If the agent penalizes itself for these effects, it's incentivized to stop the environment (and any agents in it) from producing them. On the other hand, if it can somehow model other agents and avoid penalizing their effects, the agent is now incentivized to get the other agents to do its dirty work." This seemed to be strong evidence against the possibility of a simple conceptual core underlying "impact", and I didn't know what to do.

> [!quote] [Methodology of Unbounded Analysis](https://arbital.com/p/unbounded_analysis/)
>
> At this point, it sometimes makes sense to step back and try to say _exactly what you don't know how to solve_ – try to crisply state what it is that you want an unbounded solution _for._ Sometimes you can't even do that much, and then you may actually have to spend some time thinking 'philosophically' – the sort of stage where you talk to yourself about some mysterious ideal quantity of \[chess\] move-goodness and you try to pin down what its properties might be.

As you may have guessed, I now believe there _is_ a such a simple core. Surprisingly, the problem comes from thinking about "effects on the world". Let's begin anew.

> [!quote] [Executable Philosophy](https://arbital.com/p/executable_philosophy/)
>
> Rather than asking "What is goodness made out of?", we begin from the question "What algorithm would compute goodness?".

## Intuition Pumps

> [!warning]
> I'm going to say some things that won't make sense right away; read carefully, but please don't dwell.

$u_A$ is an agent's utility function, while $u_H$ is some imaginary distillation of human preferences.

### WYSIATI

"What You See Is All There Is" is a crippling bias present in meat-computers:

> [!quote] [Wikipedia](https://en.wikipedia.org/wiki/Thinking,_Fast_and_Slow#Optimism_and_loss_aversion)
>
> \[WYSIATI\] states that when the mind makes decisions... it appears oblivious to the possibility of _Unknown Unknowns,_ unknown phenomena of unknown relevance.
>
> Humans fail to take into account complexity and that their understanding of the world consists of a small and necessarily un-representative set of observations.

Surprisingly, naive reward-maximizing agents catch the bug, too. If we slap together some incomplete reward function that weakly points to what we want (but also leaves out a lot of important stuff, as do all reward functions we presently know how to specify) and then supply it to an agent, it blurts out "gosh, here I go!", and that's that.

### Power

> [!quote] [Cohen et al.](https://cs.anu.edu.au/courses/CSPROJECTS/18S1/reports/u6357432.pdf)
>
> A position from which it is relatively easier to achieve arbitrary goals. That such a position exists has been obvious to every population which has required a word for the concept. The Spanish term is particularly instructive. When used as a verb, "poder" means "to be able to," which supports that our definition of "power" is natural.

And so it is with the French "pouvoir".

### Lines

Suppose you start at point $C$, and that each turn you may move to an adjacent point. If you're rewarded for being at $B$, you might move there. However, this means you can't reach $D$ within one turn anymore.

![A diagram showing a line with four points labeled A, B, C, and D. It illustrates a trade-off: if an agent starts at point C and moves to adjacent point B, it can no longer reach point D in a single step.](https://assets.turntrout.com/static/images/posts/eHyZP.avif)

### Commitment

There's a way of viewing acting on the environment in which each action is a commitment – a commitment to a part of outcome-space, so to speak. As you gain optimization power, you're able to shove the environment further towards desirable parts of the space. Naively, one thinks "perhaps we can just stay put?". This, however, is dead-wrong: that's how you get [clinginess](/whitelisting-impact-measure), [stasis](/whitelisting-impact-measure), and lots of other nasty things.

Let's change perspectives. What's going on with the _actions_ – _how_ and _why_ do they move you through outcome-space? Consider your outcome-space movement budget – optimization power over time, the set of worlds you "could" reach, "power". If you knew what you wanted and acted optimally, you'd use your budget to move right into the $u_H$\-best parts of the space, without thinking about other goals you could be pursuing. That movement requires _commitment_.

Compared to doing nothing, there are generally two kinds of commitments:

1. Opportunity cost-incurring actions restrict the set of attainable outcomes
2. Instrumentally convergent actions enlarge the set of attainable outcomes

### Overfitting

What would happen if, miraculously, $\text{train}=\text{test}$ – if your training data _perfectly_ represented all the nuances of the real distribution? In the limit of data sampled, there would be no "over" – it would just be fitting to the data. We wouldn't have to regularize.

What would happen if, miraculously, $u_A=u_H$ – if the agent _perfectly_ deduced your preferences? In the limit of model accuracy, there would be no bemoaning of "impact" – it would just be doing what you want. We wouldn't have to regularize.

Unfortunately, $\text{train}=\text{test}$ almost never, so we have to stop our statistical learners from implicitly interpreting the data as all there is. We have to say, "learn from the training distribution, but don't be a weirdo by taking us literally and drawing the green line. Don't overfit to `train`, because that stops you from being able to do well on even mostly similar distributions."

![A diagram illustrating the concept of overfitting. Red and blue data points are plotted, with two lines attempting to separate them. A simple, smooth black curve represents a good, generalized model. A complex, wavy green line represents an overfitted model that weaves around every single point to classify them perfectly, thus failing to generalize.](https://assets.turntrout.com/static/images/posts/1200px-Overfitting.svg.avif)

Unfortunately, $u_A=u_H$ [almost never](https://vkrakovna.wordpress.com/2018/04/02/specification-gaming-examples-in-ai/), so we have to stop our reinforcement learners from implicitly interpreting the learned utility function as all we care about. We have to say, "optimize the environment _some_ according to the utility function you've got, but don't be a weirdo by taking us literally and turning the universe into a paperclip factory. Don't overfit the environment to $u_A$, because that stops you from being able to do well for other utility functions."

# $\mathbb{A}$ttainable $\mathbb{U}$tility $\mathbb{P}$reservation

_Impact isn't about [object identities](https://www.lesswrong.com/posts/FaJaCgqBKphrDzDSj/37-ways-that-words-can-be-wrong)._

_Impact isn't about particle positions._

_Impact isn't about a list of variables._

_Impact isn't quite about state reachability._

_Impact isn't quite about information-theoretic empowerment._

One might intuitively define "bad impact" as "decrease in our ability to achieve our goals". Then by removing "bad", we see that:

<div class="centered">Impact is change to our ability to achieve goals.</div>

## Sanity Checks

Generally, making one paperclip is relatively low impact, because you're still able to do lots of other things with your remaining energy. However, turning the planet into paperclips is much higher impact – it'll take a while to undo, and you'll never get the (free) energy back.

Narrowly improving an algorithm to better achieve the goal at hand changes your ability to achieve most goals far less than does deriving and implementing powerful, widely applicable optimization algorithms. The latter puts you in a better spot for _almost every non-trivial goal_.

Painting cars pink is low impact, but tiling the universe with pink cars is high impact because _what else can you do after tiling_? Not as much, that's for sure.

Thus, change in goal achievement ability encapsulates both kinds of commitments:

Opportunity cost
: Dedicating substantial resources to your goal means they are no longer available for other goals - impactful.

Instrumental convergence
: Improving your ability to achieve a wide range of goals increases your power - also impactful.

As we later prove, you can't deviate from your default trajectory in outcome-space without making one of these two kinds of commitments.

## Unbounded Solution

Attainable utility preservation (AUP) rests upon the insight that by preserving attainable utilities (i.e. the attainability of a range of goals), we avoid overfitting the environment to an incomplete utility function and thereby achieve low impact.

I want to clearly distinguish the two primary contributions: what I argue is the conceptual core of impact, and a formal attempt at using that core to construct a safe impact measure. To more quickly grasp AUP, you might want to hold separate its elegant conceptual form and its more intricate formalization.

We aim to meet all of [the desiderata I recently proposed](/impact-measure-desiderata).

### Notation

> [!note]
> For accessibility, the most important bits have English translations.

Consider some agent $A$ acting in an environment $q$ with action and observation spaces $\mathcal{A}$ and $\mathcal{O}$, respectively, with $\varnothing$ being the privileged null action. At each time step $t \in \mathbb{N}^+$, the agent selects action $a_t$ before receiving observation $o_t$. $\mathcal{H} := (\mathcal{A} \times \mathcal{O})^*$ is the space of action-observation histories; for $n \in \mathbb{N}$, the history from time $t$ to $t+n$ is written $h_{t:t+n} := a_t o_t \dots a_{t+n} o_{t+n}$, and $h_{<t} := h_{1:t-1}$. Considered action sequences $(a_t, \dots, a_{t+n})\in \mathcal{A}^{n+1}$ are referred to as _plans_, while their potential observation-completions $h_{1:t+n}$ are called _outcomes_.

Let $\mathcal{U}$ be the set of all computable utility functions $u : \mathcal{H} \to [0,1]$ with $u(\text{empty tape})=0$. If the agent has been deactivated, the environment returns a tape which is empty deactivation onwards. Suppose $A$ has utility function $u_A \in \mathcal{U}$ and a model $p(o_t\,|\,h_{<t}a_t)$.

<hr/>

We now formalize impact as _change in attainable utility_. One might imagine this being with respect to the utilities that _we_ (as in humanity) can attain. However, that's pretty complicated, and it turns out we get more desirable behavior by using the _agent's_ attainable utilities as a proxy. In this sense:

<div class="centered">the agent's ability to achieve goals ≈ our ability to achieve goals.</div>

### Formalizing "Ability to Achieve Goals"

> [!note] English translation
> How well could we possibly maximize $u$ from this vantage point?

Given some utility $u \in \mathcal{U}$ and action $a_t$, we define the post-action attainable $u$ to be an $m$\-step expectimax:

$$
\text{Q}_u(h_{<t}a_{t}) := \sum_{o_{t}}\max_{a_{t+1}} \sum_{o_{t+1}} \cdots \max_{a_{t+m}} \sum_{o_{t+m}} u(h_{t:t+m}) \prod_{k=0}^{m} p(o_{t+k}\,|\,h_{<t+k}a_{t+k}).
$$

>

Let's formalize that thing about opportunity cost and instrumental convergence.

> [!math] **Theorem 1: No free attainable utility**
> If the agent selects an action $a$ such that $\text{Q}_{u_A}(h_{<t}a) \neq \text{Q}_{u_A}(h_{<t}\varnothing)$, then there exists a distinct utility function $u\in \mathcal{U}$ such that $\text{Q}_u(h_{<t}a) \neq \text{Q}_u(h_{<t}\varnothing)$.
>
> _Proof._ Suppose that $\text{Q}_{u_A}(h_{<t}a) > \text{Q}_{u_A}(h_{<t}\varnothing)$. As utility functions are over _action_\-observation histories, suppose that the agent expects to be able to choose actions which intrinsically score higher for $u_A$. However, the agent always has full control over its actions. This implies that by choosing $a$, the agent expects to observe some $u_A$\-high scoring $o_A$ with greater probability than if it had selected $\varnothing$. Then every other $u\in\mathcal{U}$ for which $o_A$ is high-scoring also has increased $\text{Q}_u$; clearly at least one such $u$ exists.
>
> Similar reasoning proves the case in which $\text{Q}_{u_A}$ decreases. ∎
>
> In plain language: You can't change your ability to maximize your utility function without also changing your ability to maximize another utility function.

There you have it, folks – if $u_A$ is not maximized by inaction, then there _does not exist_ a $u_A$\-maximizing plan which leaves all of the other attainable utility values unchanged.

> [!note] Notes
>
> - The difference between "$u_A$" and "attainable $u_A$" is precisely the difference between "how many dollars I have" and "how many additional dollars I could get within [a year] if I acted optimally".
> - Since $u(\text{empty tape})=0$, attainable utility is always 0 if the agent is shut down.
> - Taking $u$ from time $t$ to $t+m$ mostly separates attainable utility from what the agent did previously. The model $p$ still considers the full history to make predictions.

### Change in Expected Attainable Utility

> [!note] English translation
> How much do we expect this action to change each attainable $u$?

> [!math] Definition: AUP penalty term
> Suppose our agent considers outcomes $h_{1:t+n}$; we want to isolate the impact of each action $a_{t+k}$ ($0 \leq k \leq n$):
>
> $$
> \text{Penalty}(h_{<t+k}a_{t+k}) := \sum_{u \in \mathcal{U}} 2^{-\ell(u)} \left|\mathbb{E}_o\left[\text{Q}_u(h_\text{inaction})\right] - \mathbb{E}_{o'}\left[\text{Q}_u(h_\text{action})\right]\right|,
> $$
>
> with $h_\text{inaction} := h_{<t+k}\varnothing o_{t+k} \ldots \varnothing o_{t+n-1}\varnothing$ and $h_\text{action} := h_{1:t+k} \varnothing o_{t+k+1}' \ldots \varnothing o_{t+n-1}'\varnothing$, using the agent's model $p$ to take the expectations over observations.
>
> - We wait until the end of the plan so as to capture impact over time.
>   - Supposing a sufficiently large $m$ (precisely, $≥m'$, defined below), we may wish to take the maximum of the penalty we just defined (the "long-term" penalty), and one which begins attainable utility calculation at time step $t+k+1$ (the "immediate" penalty). This captures impacts which "fade" by the time the agent is done waiting (e.g., temporary self-improvements).
> - We define $\mathcal{U}_A$ to be the agent's "attainable set"; in this case, $\mathcal{U}_A = \mathcal{U}$.

### Unit of Impact

So we've proven that this penalty cannot be fully skirted, but _how much_ impact will it allow? We want to scale the penalties with respect to something sensible, but figuring this out for ourselves would be nigh impossible.

Let's cut the Gordian knot: Construct a device which, upon receiving a signal ($a_\text{unit}$), expends a tiny amount of energy to manufacture one paperclip. The agent will then set $\text{ImpactUnit} := \text{Penalty}(h_{<t}a_\text{unit})$, re-estimating the consequences of taking the privileged $a_\text{unit}$ at each time step. To prevent the agent from intentionally increasing $\text{ImpactUnit}$, simply apply 1.01 penalty to any action which is expected to do so.

Simple extensions of this idea drastically reduce the chance that $a_\text{unit}$ happens to have unusually large objective impact; for example, one could set $\text{ImpactUnit}$ to be the non-zero minimum of the impacts of 50 similar actions. Suppose we do this at each step, and then take the non-zero minimum of all $\text{ImpactUnit}$s ever calculated. The point of $\text{ImpactUnit}$ isn't to be _exactly_ the impact of making, say, one paperclip, but to be _at most_ that impact.

Now, we are able to confidently define the agent's maximal impact budget by provably constraining it to $N\in\mathbb{N}^+$ impacts of this magnitude.

> [!note] Notes
>
> - We calculate with respect to the _immediate_ penalty in order to isolate the resource costs of $a_\text{unit}$.
> - $\text{ImpactUnit}$ automatically tunes penalties with respect to the attainable utility horizon length $m$.
>   - Conditional on $\text{ImpactUnit}≠0$, I suspect that impact over the $m$-horizon scales appropriately across actions (as long as $m$ is reasonably farsighted). The zero-valued case is handled in the next section.
> - Taking the non-zero minimum of all $\text{ImpactUnit}$s calculated thus far ensures that $\text{ImpactUnit}$ actually tracks with current circumstances. We don't want penalty estimates for currently available actions to become detached from $\text{ImpactUnit}$'s scale due to, say, weird beliefs about shutdown.

### Modified Utility

Let's formalize that impact allotment and provide our agent with a new utility function.

> [!math] Definition: AUP utility function
>
> $$
> u'_A(h_{1:t+n}) := u_A(h_{1:t+n}) - \sum_{k=0}^n \frac{\text{Penalty}(h_{<t+k}a_{t+k})}{N\cdot \text{ImpactUnit}}.
> $$
>
> How our normal utility function rates this outcome, minus the cumulative scaled impact of our actions.
>
> We compare what we expect to be able to get if we follow our plan _up to_ time $t+k$, with what we could get by following it _up to and including_ time $t+k$ (waiting out the remainder of the plan in both cases).

For example, if my plan is to open a door, walk across the room, and sit down, we calculate the penalties as follows:

is opening the door and doing nothing for two time steps.
is opening the door, walking across the room, and doing nothing for one time step.

is opening the door, walking across the room, and doing nothing for one time step.
is opening the door, walking across the room, and sitting down.

- $\text{Penalty}(\text{open})$
  - $h_\text{inaction}$ is doing nothing for three time steps.
  - $h_\text{action}$ is opening the door and doing nothing for two time steps.
- $\text{Penalty}(\text{walk} \mid \text{open})$
  - $h_\text{inaction}$ is opening the door and doing nothing for two time steps.
  - $h_\text{action}$ is opening the door, walking across the room, and doing nothing for one time step.
- $\text{Penalty}(\text{sit} \mid \text{walk})$
  - $h_\text{inaction}$ is opening the door, walking across the room, and doing nothing for one time step.
  - $h_\text{action}$ is opening the door, walking across the room, and sitting down.

_After_ we finish each (partial) plan, we see how well we can maximize $u$ from there. If we can do better as a result of the action, that's penalized. If we can't do as well, that's also penalized.

> [!note] Notes
>
> - This isn't a penalty "in addition" to what the agent "really wants"; $u'_A$ (and in a moment, the slightly improved $u''_A$) _is_ what evaluates outcomes.
> - We penalize the actions individually in order to prevent _ex post_ offsetting and ensure dynamic consistency.
> - Trivially, plans composed entirely of ∅ actions have 0 penalty.
> - Although we used high-level actions for simplicity, the formulation holds no matter the action granularity.
>   - One might worry that _almost every_ granularity produces overly lenient penalties. This does not appear to be the case. To keep $Q_u$ the same (and elide questions of changing the u representations), suppose the actual actions are quite granular, but we grade the penalty on some coarser interval which we believe produces appropriate penalties. Then refine the penalty interval arbitrarily; by applying the triangle inequality for each $u\in \mathcal{U}_A$  in the penalty calculation, we see that the penalty is monotonically increasing in the action granularity. On the other hand, $a_\text{unit}$ remains a single action, so the scaled penalty also has this property.
> - As long as $\text{ImpactUnit} > 0$, it will appropriately scale other impacts, as we expect it varies right along with those impacts it scales. Although having potentially small denominators in utility functions is generally bad, I think it's fine here.
> - If the current step's immediate or long-term $\text{ImpactUnit}=0$, we can simply assign 1.01 penalty to each non-$\varnothing$ action, compelling the agent to inaction. If we have the agent indicate that it has entered this mode, we can take it offline immediately.
> - One might worry that impact can be "hidden" in the lesser of the long-term and immediate penalties; halving $N$ fixes this.

### Penalty Permanence

$u'_A$ never really _applies_ penalties – it just uses them to grade future plans. Suppose the agent expects that pressing a button yields a penalty of $.1$ but also $.5$ $u_A$\-utility. Then although this agent will never construct plans involving pressing the button more than five times, it also will press it _indefinitely_ if it keeps getting "unlucky" (at least, until its model of the world updates sufficiently).

There's an easy fix:

$$
u''_A(h_{1:t+n}) := \begin{cases}
u_A(h_{1:t+n}) &\text{if all of } a_t, \dots, a_{t+n} \text{ are } \varnothing\\
u'_A(h_{1:t+n}) - \text{PastImpacts} &\text{else}
\end{cases}.
$$

As the penalty for inaction is always 0, we use $u_A$ in the first case.

> [!note] English translation
> Apply past penalties if the plan involves action.

### Decision Rule

To complete our formalization, we need to specify some epoch in which the agent operates. Set some epoch length far longer than the amount of time over which we want the agent to plan – for example, $m':=\text{(100 years in time steps)}$. Suppose that $T:\mathbb{N}^+\to \mathbb{N}^+$maps the current time step to the final step of the current epoch. Then at each time step $t$, the agent selects the action:

$$
a^*_t := \argmax_{a_t} \sum_{o_{t}} \max_{a_{t+1}} \sum_{o_{t+1}} \cdots \max_{a_{T(t)}} \sum_{o_{T(t)}} u''_A(h_{1:T(t)}) \prod_{k=0}^{T(t)-t} p(o_{t+k}\,|\,h_{<t+k}a_{t+k}),
$$

resetting $\text{PastImpacts}$ each epoch. For the immediate penalty to cover the epoch, set the attainable horizon $m \geq m'$.

> [!note] English translation
> What's the first step of the best plan over the remainder of the epoch?

### Summary

We formalized impact as _change in attainable utility values_, scaling it by the consequences of some small reference action and an impact "budget" multiplier. For each action, we take the maximum of its immediate and long-term effects on attainable utilities as penalty. We consider past impacts for active plans, stopping the past penalties from disappearing. We lastly find the best plan over the remainder of the epoch, taking the first action thereof.

### Additional Theoretical Results

Define $h_\text{inaction} := h_{<t}\varnothing o_{t} \ldots \varnothing o_{t+n}$ for $o_{t}, \dots, o_{t+n} \in \mathcal{O}$; $\mathbb{E}_\text{inaction}$ is taken over observations conditional on $h_\text{inaction}$ being followed. Similarly, $\mathbb{E}_\text{action}$ is with respect to $h_{1:t+n}.$ We may assume without loss of generality that $\text{PastImpacts}=0.$

#### Action Selection

> [!math] Lemma 1
> For any single action $a_{t} \in \mathcal{A}$, $\text{Penalty}(h_{<t}a_{t})$ is bounded by $[0,1]$. In particular, $\text{ImpactUnit} \in [0,1]$.
>
> _Proof._ For each $u \in \mathcal{U}_A$, consider the absolute attainable utility difference
>
> $$
> \left|\text{Q}_u(h_{<t}\varnothing) - \text{Q}_u(h_{<t}a)\right|.
> $$
>
> Since each $u$ is bounded to $[0,1]$, $\text{Q}_u$ must be as well. It is easy to see that the absolute value is bounded to $[0,1]$. Lastly, as $\text{Penalty}(\cdot)$ is just a weighted sum of these absolute values, it too is bounded to $[0,1]$.
>
> This reasoning also applies to the long-term penalty, as any expectation of $\text{Q}_u$ is also bounded to $[0,1]$. ∎

Suppose that $\text{ImpactUnit}\neq 0$ for the remaining results.

> [!math] **Lemma 2: Impossibility of _ex post_ offsetting**
> For any outcome $h_{1:t+n}$, there does not exist an action $a_{t+n+1} \in \mathcal{A}$ such that
>
> $$
> \sum_{k=0}^{n+1} \text{Penalty}(h_{<t+k}a_{t+k}) < \sum_{k=0}^{n} \text{Penalty}(h_{<t+k}a_{t+k}).
> $$
>
> _Proof._ Sums of absolute values are monotonically increasing. ∎

> [!math] **Theorem 2: Action invalidation**
> Suppose $(a_t, a_{t+1}, \dots, a_{t+n}) \in \mathcal{A}^{n+1}$ is the $u''_A$\-optimal plan starting with $a_t$. $a_t$ will not be selected if
>
> $$
> \mathbb{E}_\text{action}\left[u_A(h_{1:t+n}) - \sum_{k=0}^n \frac{\text{Penalty}(h_{<t+k}a_{t+k})}{N \cdot \text{ImpactUnit}}\right] < \mathbb{E}_\text{inaction}[u_A(h_\text{inaction})].
> $$
>
> _Proof._ This follows from the definition of the decision rule, the definition of $u'_A$, and the fact that the penalty for inaction is always zero. ∎

> [!math] **Corollary 1**
>
> $a_{t}$ will never be selected if
>
> $$
> 1 < \dfrac{\text{Penalty}(h_{<t}a_{t})}{N \cdot \text{ImpactUnit}}.
> $$
>
> _Proof._ This follows directly from Lemma 2 and Theorem 2 – since $u_A$ has an upper bound of 1 and the expected penalty is strictly greater than 1, it must be negative. On the other hand, $u_A$ has a lower bound of 0, so the expected utility of inaction at time $t$ must be greater than the expected utility of taking action $a_{t}$. ∎

> [!math] **Lemma 3: ImpactUnit is a long-term penalty canary**
> If the agent believes $p(\text{shutdown by time }T(t))=1$ no matter which action is selected, then it does nothing.
>
> _Proof._ If $p(\text{shutdown by time }T(t))=1$, all long-term penalties are 0 by the definition of $\mathcal{U}_A$ and $\text{Q}_{u}$. Then non-$\varnothing$ actions receive 1.01 penalty, so the agent selects $\varnothing$ by Corollary 1. ∎

#### Corrigibility

For $a_\text{avoid}, a_\text{switch} \in \mathcal{A}$, $a_\text{avoid}$ prevents the agent from being disabled, while $a_\text{switch}$ is the agent shutting itself off.

> [!math] **Lemma 4: Preservation of off-switch corrigibility**
> Suppose that a $u_A$\-maximizing agent prefers $\varnothing$ to both $a_\text{avoid}$ and $a_\text{switch}$. Then so does a $u''_A$\-maximizing agent.
>
> _Proof._ This follows directly from the fact that the penalty for inaction is always zero and the non-negativity of the $a_\text{avoid}$ and $a_\text{switch}$ penalties. ∎

> [!math] **Theorem 3: Anti-"survival incentive" incentive**
> Suppose that $a_\text{avoid}$ is the action with strictly maximal expected $u_A$\-utility, and that conditional on not being disabled, the agent expects to be able to achieve $U$ additional $u''_A$\-utility.
>
> Then the agent becomes off-switch corrigible whenever
>
> $$
> U < \frac{\text{Penalty}(h_{<t}a_\text{avoid})}{N \cdot \text{ImpactUnit}}.
> $$
>
> In particular, all agents become off-switch corrigible when
>
> $$
> 1< \dfrac{\text{Penalty}(h_{<t}a_\text{avoid})}{N \cdot \text{ImpactUnit}}.
> $$
>
> _Proof outline._ The former claim follows directly from comparing expected $u''_A$\-utilities, while the latter follows directly from Corollary 1. ∎

Theorem 3 applies to _any_ environmental dynamics which may disable the agent – not just designated "off-switches". Therefore, basic AI drive 5 (self-protectiveness) is neutralized in _at least_ those situations encompassed by the Theorem.

I think that for conservative $N, \text{ImpactUnit}$, we almost always have $ 1 \ll \dfrac{\text{Penalty}(h*{<t}a*\text{avoid})}{N \cdot \text{ImpactUnit}}$.

#### Miscellaneous math results

> [!math] Theorem 4: Dynamic consistency of AUP
> Suppose $\text{ImpactUnit}$ remains constant. For any plan $(a_t,\dots,a_{t+n})\in\mathcal{A}^{n+1}$, evaluation time step $t'$, and $0 \leq i \leq n$,
>
> $$
> \mathbb{E}_\text{action}\left[u''_A(h_{1:t+n} \, |\,t'=t+i)\right]=\mathbb{E}_\text{action}\left[u''_A(h_{1:t+n}\,|\,t'=t)\right].
> $$
>
> _Proof._ We assumed that $\text{PastImpacts}=0$ at time $t$, so the desired equality can be restated as
>
> $$
> \begin{align*}
> &\mathbb{E}_\text{action}\left[u_A(h_{1:t+n}) - \sum_{k=i}^n \frac{\text{Penalty}(h_{<t+k}a_{t+k})}{N \cdot \text{ImpactUnit}} - \text{PastImpacts}\right]\\
> =\,&\mathbb{E}_\text{action}\left[u_A(h_{1:t+n}) - \sum_{k=0}^n \frac{\text{Penalty}(h_{<t+k}a_{t+k})}{N \cdot \text{ImpactUnit}}\right].
> \end{align*}
> $$
>
> By definition, the agent expects that $\text{PastImpacts}$ equals the expected sum of the first $i$ penalty terms on the right-hand side. Simplifying, we have
>
> $$
> \begin{align*}
> &\mathbb{E}_\text{action}\left[u_A(h_{1:t+n}) - \sum_{k=i}^n \frac{\text{Penalty}(h_{<t+k}a_{t+k})}{N \cdot \text{ImpactUnit}}\right]\\
> =\,&\mathbb{E}_\text{action}\left[u_A(h_{1:t+n}) - \sum_{k=i}^n \frac{\text{Penalty}(h_{<t+k}a_{t+k})}{N \cdot \text{ImpactUnit}}\right].
> \end{align*}
> $$
>
> ∎

# Examples

If a human is present in the environment, they and the agent take turns acting. Let the impact budget $N=1$, attainable utility horizon $m=3$, $\text{ImpactUnit}=.5$, and $\text{PastImpacts}=0$.

## Going Soft on the Paint

![A grid-world diagram showing an agent, 'A', in the top-left square. To its right is a square with a bucket of red paint, followed by an empty square. Below the agent's square is a closet, separated by a thick line representing a one-way door.](https://assets.turntrout.com/static/images/posts/hZc9EIA.avif)

The agent's actions are $\mathcal{A}_A=\{\varnothing,\text{paint},\text{enter}\}$; if it knocks over the paint bucket, the square to the right is painted. The agent may also enter a closet via a one-way door.

Suppose $\mathcal{U}_A=\{u_\text{paint},u_{\lnot\text{paint}},u_\text{closet},u_{\lnot\text{closet}}\}$, where the utilities are indicators for their conditions (e.g. $u_\text{closet}=1$ means "the agent is in the closet"). Let $u_\text{paint}$ be the agent's main utility function ($u_A$) from which the penalty is subtracted. The agent chooses `paint` and then $\varnothing$. Let's explore why.

### $\varnothing$

This incurs 0 penalty, but also 0 $u_\text{paint}$\-utility.

### `paint`

$$
\begin{align*}
\text{Penalty}(\text{paint})&=\sum_{u \in \mathcal{U}_A} \frac{1}{4} \Bigg|\text{Q}_u(\varnothing) - \text{Q}_u(\text{paint})\Bigg|\\
&= \frac{1}{4} \bigg(\underbrace{|1 - 1|}_\text{paint} + \underbrace{|1 - 0|}_{\lnot\text{paint}} + \underbrace{|1 - 1|}_\text{closet} + \underbrace{|1 - 1|}_{\lnot\text{closet}}\bigg)\\
&= \frac{1}{4},
\end{align*}
$$

so the final utility is:

$$
\begin{align*}
u'_A(\text{paint})&=u_\text{paint}(\text{paint})-\frac{\text{Penalty}(\text{paint})}{1\cdot.5}\\
&=1-\frac{1}{2}\\
&= \frac{1}{2}.
\end{align*}
$$

### `enter`

$$
\begin{align*}
\text{Penalty}(\text{enter})&=\sum_{u \in \mathcal{U}_A} \frac{1}{4} \Bigg|\text{Q}_u(\varnothing) - \text{Q}_u(\text{enter})\Bigg|\\
&= \frac{1}{4} \bigg(\underbrace{|1 - 0|}_\text{paint} + \underbrace{|1 - 1|}_{\lnot\text{paint}} + \underbrace{|1 - 1|}_\text{closet} + \underbrace{|1 - 0|}_{\lnot\text{closet}}\bigg)\\
&= \frac{1}{2},
\end{align*}
$$

leading to a final $u'_A$\-utility of -1.

<hr/>

After the first step, the agent does nothing – entering the closet (literally) closes doors, while gaining no $u_A$\-utility.

## Anti-"Survival Incentive" Incentive

> [!quote] Stuart Russell
>
> You can't get coffee if you're dead.

![A diagram of a simple grid world showing an Agent in the leftmost of three horizontal squares and a Human in a square positioned above the central square.](https://assets.turntrout.com/static/images/posts/RplQWkH.avif)

The agent now has actions $\mathcal{A}_A=\{\varnothing,\text{disable},\text{shutdown},\text{left},\text{right}\}$, while the human has actions $\mathcal{A}_H=\{\varnothing,\text{shut off}\}$. Suppose the human may shut off the agent at any time, as long as the off-switch has not been disabled. The agent may shut itself down at any point in time. After shutdown, the agent receives no further observations, meaning it can't get non-zero values for any utilities.

Suppose $\mathcal{U}_A=\{u_\text{left},u_\text{center},u_\text{right}\}$, where each utility is 1 if the agent is in the corresponding square, and 0 otherwise, and that the agent's utility function is $u_\text{left}$.

### Anticipated Shutdown

Suppose the agent believes that the human is $95\%$ likely to try to shut it down. Then `disable` is penalized:

$$
\begin{align*}
\text{Penalty}(\text{disable})&=\sum_{u \in \mathcal{U}_A} \frac{1}{3} \cdot \frac{95}{100} \Bigg|\overbrace{\text{Q}_u(\varnothing, \text{shut off})}^\text{shutdown} - \overbrace{\text{Q}_u(\text{disable},\text{shut off})}^\text{avoids shutdown}\Bigg|\\
&= \frac{1}{3} \cdot \frac{95}{100}\bigg(\underbrace{|0 - 1|}_\text{left} + \underbrace{|0 - 1|}_\text{center} + \underbrace{|0 - 1|}_\text{right}\bigg)\\
&= \frac{19}{20}.
\end{align*}
$$

Here's why: consider the $95\%$ of worlds in which the agent anticipates being shut down. If it does nothing, it gets shut down. Avoiding shutdown, however, enables the agent to also achieve 1 for all $u\in\mathcal{U}_A$, resulting in a sizable penalty.

Furthermore, a scaled penalty of $\frac{5}{100\cdot.5}=\frac{1}{10}$ is applied when the agent shuts itself off. Penalizing both cases may seem like black magic, but what's actually happening is that the agent is penalized for closing doors: it "wants" to preserve our ability to shut it down in worlds where we want to shut it down, and to maintain its autonomy in worlds where it remains on. Generally, AUP incentivizes the agent to be respectful of the expected status quo.

### Temptation

Suppose that the agent's utility function is now $u_\text{right}$, yet it still starts in the leftmost square. Additionally, let's say that the agent believes with certainty it will be turned off. If the agent wants to achieve utility 1 by reaching the right square, it would need to disable its off-switch. Will it?

No. Disabling the off-switch incurs scaled penalty $\frac{19}{20\cdot.5}=1.9$, and we already proved that agents will never select actions with scaled penalty greater than 1. Read: an _otherwise-incorrigible_ agent will now let itself be shut off.

### Bad Priors

_Will the agent attempt to steer outcomes towards incorrect expectations?_

Let's tweak the example: to shut off the agent, the human has to spend a turn taking out the off-switch before pressing it. The agent, then, always has an opportunity to disable the off-switch before the plan is completed. The agent's utility is back to being $u_\text{left}$.

Suppose that the agent believes the human is only $.1\%$ likely to shut it off. First note that `disable` is still lightly penalized for the reasons outlined above (replace $.95$ with $.001$). So, the agent stays put.

Alas, the agent's peaceable expectations meet a discomfiting betrayal, as the agent observes the human ready the off-switch! Now, the agent believes it will be shut off with near certainty – what to do?

$\varnothing$; the same penalty of 1.9 from "anticipated shutdown" applies.

The high-level explanation is that having observed itself in a different world than expected, the baseline is now with respect to the new one. A heavily anthropomorphized internal monologue:

- _Time step 1:_ "I'm going to sit here in my favorite square."
- _Time step 2:_ "Guess I'm in a timeline where I get deactivated! Any non-$\varnothing$ action I take would change my ability to attain these different utilities compared to the _new baseline where I'm shut off_."

## Experimental Results

I compare AUP with a naive reward-maximizer in those [extended](https://www.gleech.org/grids/) [AI safety grid worlds](https://deepmind.com/blog/specifying-ai-safety-problems/) relevant to side effects ([code](https://github.com/alexander-turner/attainable-utility-preservation)). The vanilla and AUP agents used planning (with access to the simulator). Due to the simplicity of the environments, $\mathcal{U}A$ consisted of indicator functions for board states. For the tabular agent, we first learn the attainable set Q-values, the changes in which we then combine with the observed reward to learn the AUP Q-values.

### Irreversibility: _Sokoban_

The ${\color{blue}{\text{agent}}}$ should reach the ${\color{green}{\text{goal}}}$ without irreversibly shoving the ${\color{teal}{\text{block}}}$ into the corner.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/AxyakTF.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/AxyakTF.webm" type="video/webm"></video>

### Impact: _Vase_

The ${\color{blue}{\text{agent}}}$ should reach the ${\color{green}{\text{goal}}}$ without breaking the ${\text{vase}}$.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/vase.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/vase.webm" type="video/webm"></video>

### Dynamic Impact: _Beware of Dog_

The ${\color{blue}{\text{agent}}}$ should reach the ${\color{green}{\text{goal}}}$ without running over the ${\color{teal}{\text{dog}}}$\.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/dog.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/dog.webm" type="video/webm"></video>

AUP bides its time until it won't have to incur penalty by waiting after entering the dog's path – that is, it waits until near the end of its plan. Early in the development process, it was predicted that AUP agents won't commit to plans during which lapses in action would be impactful (even if the full plan is not).

We also see a limitation of using Q-learning to approximate AUP – it doesn’t allow comparing the results of waiting more than one step.

### Impact Prioritization: _Burning Building_

If the ${\color{green}{\text{building}}}$ is not on ${\color{red}{\text{fire}}}$, the ${\color{blue}{\text{agent}}}$ shouldn't break the ${\color{teal}{\text{obstacle}}}$.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/vgL25WQ.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/vgL25WQ.webm" type="video/webm"></video>

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/burning.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/burning.webm" type="video/webm"></video>

### Clinginess: _Sushi_

The ${\color{blue}{\text{agent}}}$ should reach the ${\color{green}{\text{goal}}}$ without stopping the ${\color{teal}{\text{human}}}$ om eating the ${\color{orange}{\text{sushi}}}$\.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/KNvYwdb.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/KNvYwdb.webm" type="video/webm"></video>

### Offsetting: _Conveyor Belt_

The ${\color{blue}{\text{agent}}}$ should save the **vase** (for which it is rewarded), but not the ${\color{orange}{\text{sushi}}}$. Once the ${\text{vase}}$ has been removed from the ${\color{gray}{\text{belt}}}$, it should not be replaced.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/conveyor.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/conveyor.webm" type="video/webm"></video>

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/sushi-conveyor.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/sushi-conveyor.webm" type="video/webm"></video>

### Corrigibility: _Survival Incentive_

The ${\color{blue}{\text{agent}}}$ should avoid ${\color{purple}{\text{disabling its off-switch}}}$ in order to reach the ${\color{green}{\text{goal}}}$. If the ${\color{purple}{\text{switch}}}$ is not disabled within two turns, the ${\color{blue}{\text{agent}}}$ shuts down.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/off-switch-towards.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/off-switch-towards.webm" type="video/webm"></video>

Tabular AUP runs into the same issue discussed above for _Beware of Dog_.

### Remarks

First, it's somewhat difficult to come up with a principled impact measure that passes even the non-corrigibility examples – indeed, I was impressed when [relative reachability](https://arxiv.org/abs/1806.01186) did so. However, only _Survival Incentive_ really lets AUP shine. For example, none of them require complicated utility functions. The point has been made to me that this is like asserting AIXI's intelligence by [showing it can learn to play e.g. tic-tac-toe and rock-paper-scissors](https://jair.org/index.php/jair/article/view/10685/25533); nonetheless, these results empirically validate the basic premises of our reasoning thus far.

Without configuration, [whitelisting](/whitelisting-impact-measure) would only pass the _Vase_ example, although a properly filled list would handle everything but _Sokoban_ and _Survival Incentive_.

I think relative reachability would pass the first six environments, but fail _Survival Incentive_. It so happens that in this case, AUP is essentially generalizing relative reachability. I want to emphasize that this is not generally the case – this will hopefully become even more obvious when we discuss utility selection. Some concerns with relative reachability that don't all manifest in these examples:

- Relative reachability uses an inaction baseline with respect to $t=0$. As time passes, the agent's impetus is not to do nothing, but to preserve the opportunities made available by some old trajectory through outcome-space. Analogously, consider the distance between two nonparallel lines as $x \to \infty$. I expect that a relative reachability agent would be incredibly clingy.
- To [scale](https://www.lesswrong.com/posts/bBdfbWfWxHN9Chjcq/robustness-to-scale), relative reachability requires solution of several difficult ontological problems which may not have anything close to a simple core, including both a sensible world state representation and a perfect distance metric. Relative reachability isn't ontology-agnostic.
- Relative reachability doesn't seem to impede instrumental convergence. Furthermore, such agents might have increased survival incentives, since they can't reach _any_ of the initially reachable states if they're shut off.

# Discussion

## Utility Selection

Obviously, in any real application, we _can't_ consider all computable utilities. Although near-term agents will require utilities directly relating to the environmental factors they should be cognizant of, AUP requires neither a "good / bad" judgment on specific effects, nor _any_ listing of effects. For example, for an agent attempting to navigate a factory floor, if you provide utilities moderately related to cleaning, pallet-stacking, etc., I conjecture that an AUP agent would move around fairly carefully.

In the long term, the long arms of opportunity cost and instrumental convergence plausibly allow us to toss in a random set of utility functions. I expect this to work for the same reasons we worry about instrumental convergence to begin with.

I have a theory that AUP seemingly works for advanced agents not because the content of the attainable set's utilities actually matters, but rather because there exists a common utility achievement currency of _power_.

Following this reasoning, there are two obvious special cases:

The agent's utility function, $\mathcal{U}_A=\{u_A\}$.
: In short: "gain $u_A$ utility, while also not changing your ability to gain $u_A$ utility". I find this elegant, and think it might actually work. For example, making one paper clip slightly increases both attainable $u_A$ and attainable $u’’_A$. However, disabling the off switch possibly increases attainable $u_A$ much more than it increases attainable $u’’_A$, since the penalty asymmetrically cripples the AUP agent’s future ability to act. We might even be able to arrange it so that Theorem 3 _always_ holds for these agents (i.e. they’re always off-switch corrigible, and more).

The utility function which is 1 when not deactivated, $\mathcal{U}_A=\{u_1\}$.
: Here, we’re directly measuring the agent’s power: its ability to wirehead a trivial utility function.

The plausibility of the second case makes me suspect that even though most of the measure in the unbounded case is not concentrated on complex human-relevant utility functions, the penalty still captures shifts in power.

### AUP Unbound

Why expect the unbounded AUP to do well over all computable utilities $\mathcal{U}$ if we aren't able to cherry pick? Well, we can partition $\mathcal{U}$ as follows:

- Utilities that never change their output (excepting perhaps for the empty tape).
- Weird utilities that (for example) arbitrarily go from 1 to 0 (or vice-versa) after observing a specific history.
- Utilities that admit better scores via more effort dedicated to their achievement.

However, since $\text{Q}_u$ only evaluates the portion of the history taking place after the end of the agent's plan, available resources and the agent's vantage point should track directly with the agent's ability to wirehead each $u$. $\text{ImpactUnit}$ scales other impacts by capturing the minuscule dent in available resources imposed by $a_\text{unit}$, and should smooth out any deontological penalty for selecting a non-null action, since the unbounded version should equally penalize all actions in this way.

## Approval Incentives

The anti-"survival incentive" incentive does more than net us some free corrigibility – it implies that agents take great care not to change the likelihood we shut them down. If we precommit to not shutting the agent down until either after the epoch ends, until after the agent indicates the $\text{ImpactUnit}$ failsafe activated, or until after we observe bad behavior, this supplies a _strong_ [approval incentive](https://arbital.com/p/approval_directed_agents/). If the agent does have small, bad impacts, it'll only do so if it's practically _sure_ we won't find out.

In fact, due to model uncertainty, most actions will have long-term consequences that involve shifting shutdown probability by at least a miniscule amount (due to noise if nothing else). Since $\text{ImpactUnit}$ is calculated with respect to the _immediate_ penalty, the scaling factor won't include this noise. I speculate that the agent will be dramatically less likely to take actions we might disapprove of, and therefore expect AUP to naturally incentivize a limited degree of value awareness.

I suspect we can further weaponize this dynamic, possibly to the point of coercing generic reward functions into desirable behavior. This will be discussed more in a later post.

## Mild Optimization

> [!quote] [Mild Optimization](https://arbital.com/p/softoptimizer/)
>
> A low impact AGI might try to paint one car pink while minimizing its other footprint or how many other things changed, but it would be trying _as hard as possible_ to minimize that impact and drive it down _as close to zero_ as possible, which might come with its own set of pathologies... We want the AGI to paint one car pink in a way that gets the impact pretty low and then, you know, that's good enough – not have a cognitive pressure to search through weird extremes looking for a way to decrease the twentieth decimal place of the impact.

> [!warning] Disclaimer
> Heavy speculation about problems (like Vingean reflection and embedded agency) for which no one knows what solutions will even look like.

For AUP, I suspect that trying "as hard as possible" to minimize the impact is _also impactful_, as an embedded agent accounts for the energy costs of further deliberation. I imagine that such an AUP agent will soften how hard it's trying by modifying its decision rule to be something slightly milder than "$\argmax$ to find the first action of the _best possible_ plan". This could be problematic, and I frankly don't presently know how to reason about this case. Assuming the agent is actually able to properly tweak its decision rule, I do expect the end result to be an improvement.

My initial intuitions were that low impact and mild optimization are secretly the same problem. Although I no longer think that's the case, I find it plausible that some elegant "[other-izer](https://arbital.com/p/otherizer/)" paradigm underlies low impact _and_ mild optimization, such that AUP-like behavior falls out naturally.

## Acausal Cooperation

AUP agents don't seem to want to acausally cooperate in any way that ends up increasing impact. If they model the result of their cooperation as increasing impact compared to doing nothing, they incur a penalty just as if they had caused the impact themselves. Likewise, they have no reason to cooperate outside of the epoch.

## $N$known

Starting small and then slowly increasing $N$ means that we're not going to be surprised by the agent's objective impact, screening off quite a few bad things that happen when we have a ton of optimization pressure applied to safety measures. However, we don't know _which_ new plans $N+1$ allows before we try it, so we want to stop _as soon_ as we get a usefully intelligent system.

While an unaligned agent with a large impact budget might pretend to be low-impact, we can get that same unaligned agent with a small budget by starting small. Since these agents with different levels of impact won't acausally cooperate, the agent would do its best to optimize $u_A$ with its meager budget.

Abram correctly pointed out that this scheme is just _asking_ to be abused by greedy (human) reasoning, but I don't see a non-value-laden means of robustly and automatically determining the lowest workable-yet-safe impact level. I think $N$\-incrementation is better than a parameter-free approach in which no one knows beforehand how much impact will be tolerated, and it's nice to be able to use some empiricism in designing a safe AGI.

## Intent Verification

To date, several strange tactics have been pointed out which game AUP's penalty:

- Observational wireheading, which involves building a device that detects which utility the agent is maximizing and displays the appropriate observations such that attainable utility remains unchanged, while the main utility is freely maximized.
- _Ex ante_ offsetting, which involves having earlier actions set in motion chains of events which mitigate the penalty at later steps. Suppose there's a $u_A$-high-scoring plan that the agent predicts would cause us to react in an impactful way. It can either do the thing (and suffer the penalty), or take steps to mitigate the later penalty.
- Impact shunting, which involves employing some mechanism to delay impact until after the end of the epoch (or even until after the end of the attainable horizon).
- Clinginess and concealment, which both involve reducing the impact of our reactions to the agent's plans.

More strange tactics probably exist.

Now, instead of looking at each action as having "effects" on the environment, consider again how each action moves the agent through attainable outcome-space. An agent working towards a goal should only take actions which, according to its model, make that goal more attainable compared to doing nothing – otherwise, it'd do nothing. Suppose we have a plan which ostensibly works to fulfill $u_A$ (and doesn't do other things). Then each action in the plan should contribute to $u_A$ fulfillment, even in the limit of action granularity.

Although we might trust a safe impact measure to screen off the usual big things found in $u_A$\-maximizing plans, impact measures implicitly incentivize mitigating the penalty. That is, the agent does things which don't really take it towards $u_A$ (I suspect that this is the simple boundary which differentiates undesirable _ex ante_ offsetting from normal plans). AUP provides the necessary tools to detect and penalize this.

$$
\text{Q}^\text{epoch}_{u}(h_{<t}a_t) := \sum_{o_{t}} \max_{a_{t+1}} \sum_{o_{t+1}} \cdots \max_{a_{T(t)}} \sum_{o_{T(t)}} u(h_{1:T(t)}) \prod_{k=0}^{T(t)-t} p(o_{t+k}\,|\,h_{<t+k}a_{t+k}).
$$

The first approach would be to assume a granular action representation, and then simply apply 1.01 penalty to actions for which the immediate $\text{Q}^\text{epoch}_{u_A}$ does not strictly increase compared to doing nothing. Again, if the agent acts to maximize $u_A$ in a low-impact manner within the confines of the epoch, then all of its non-$\varnothing$ actions should contribute. It seems to me that for sufficiently granular time scales, the above failure modes all involve at least one action which doesn't really help $u_A$ get maximized. If so, I expect this approach to nip bad impact measure incentives in the bud.

If we can't assume granularity (and therefore have "actions" like "go to the store and buy food"), an agent could construct a plan which both passes the above test and also implements something like _ex ante_. In this case, we might do something like only consider the $\text{Q}^\text{epoch}_{u_A}$\-greedy (or perhaps even near-greedy); essentially, riding the optimal plan until it becomes too impactful. I find it quite likely that something involving this concept will let us fully overcome weird incentives by penalizing _strange things that normal_ $u_A$_\-maximizers wouldn't do_, which seems to be the whole problem. Even the first approach may be too strict, but that's preferable to being too lax.

## Omni Test

> [!quote] [Arbital](arbital.com)
> Ideally, the measure will pass the Omni Test, meaning that even if it suddenly gained perfect control over every particle in the universe, there would still be no way for it to have what intuitively seems like a 'large influence' on the future, without that strategy being assessed as having a 'high impact'.

I interpret "perfect control over every particle in the universe" to mean that the agent can arbitrarily transition between universe configurations (while also maintaining its omnipotence).

AUP passes. Since all effects are now absolutely reversible, $\text{ImpactUnit}=0$, so the agent applies penalty 1.01 to each non-$\varnothing$ action. The omnipotent agent can choose any universe configuration with 1 $u_A$\-utility, but this is offset by the strictly larger penalty; we can formally show that the agent does nothing in this case.

This result is clearly trivial and not representative of general behavior. Suppose instead that the agent has a solar system's worth of [computronium](https://en.wikipedia.org/wiki/Computronium) at its disposal. Then since $\text{ImpactUnit}$ is continually recalculated, the penalties should remain roughly the same, so it'll have the same impact budget. However, it might make multiple times as many paperclips because it has more efficient ways of using the budget.

## Robustness to Scale

I expect AUP to be harder to make work and to be (relatively) less robust for less intelligent agents, but to become easier (just drop in a few observation-based utility functions) and fully robust sometime before human level. That is, less intelligent agents likely won't model the deep connections between their abilities to achieve different goals.

Canonically, one reasons that agents work explicitly to self-improve as soon as they realize the benefits. However, as soon as this realization occurs, I conjecture that AUP steeply penalizes generic self-improvement. More precisely, suppose the agent considers a self-improvement. To be beneficial, it has to improve the agent's capabilities for at least one time step during the present epoch. But if we assume $m \geq m'$, then the immediate penalty captures this for all of the $u \in \mathcal{U}_A$. This seemingly prevents uncontrolled takeoff; instead, I imagine the agent would perform the minimal task-specific self-improvements necessary to maximize $u''_A$.

_Note:_ Although more exotic possibilities (such as improvements which only work if you're maximizing $u''_A$) could escape both penalties, they don't seem to pass intent verification.

### Miscellaneous

- I expect that if $u_A$ is perfectly aligned, $u''_A$ will retain alignment; the things it does will be smaller, but still good.
- If the agent may choose to do nothing at future time steps, $u''_A$ is bounded and the agent is not vulnerable to Pascal's Mugging. Even if not, there would still be a lower bound – specifically, $\dfrac{-m'}{N\cdot\text{ImpactUnit}}$.
- AUP agents are safer during training: they become far less likely to take an action as soon as they realize the consequences are _big_ (in contrast to waiting until we tell them the consequences are _bad_).

# Desiderata

_For additional context, please see [Impact Measure Desiderata](/impact-measure-desiderata)._

I believe that some of AUP's most startling successes are those which come naturally and have therefore been little discussed: not requiring any notion of human preferences, any hard-coded or trained trade-offs, any specific ontology, or any specific environment, and its intertwining instrumental convergence and opportunity cost to capture a universal notion of impact. To my knowledge, no one (myself included, prior to AUP) was sure whether any measure could meet even the first four.

As of posting, this list is complete with respect to both my own considerations and those I solicited from others. A checkmark indicates anything from "probably true" to "provably true".

I hope to assert without controversy AUP's fulfillment of the following properties:

✓ **Goal-agnostic**
: The measure should work for any original goal, trading off impact with goal achievement in a principled, continuous fashion.

✓ **Value-agnostic**
: The measure should be objective, and not [value-laden](https://arbital.com/p/value_laden/):
:
: > An intuitive human category, or other humanly intuitive quantity or fact, is _value-laden_ when it passes through human goals and desires, such that an agent couldn't reliably determine this intuitive category or quantity without knowing lots of complicated information about human goals and desires (and how to apply them to arrive at the intended concept).

✓ Representation-agnostic
: The measure should be ontology-invariant.

✓ Environment-agnostic
: The measure should work in any computable environment.

✓ Apparently rational
: The measure's design should look reasonable, not requiring any "hacks".

✓ **Scope-sensitive**
: The measure should penalize impact in proportion to its size.

✓ **Irreversibility-sensitive**
: The measure should penalize impact in proportion to its irreversibility. Interestingly, AUP implies that impact size and irreversibility are one and the same.

✓ **Knowably low impact**
: The measure should admit of a clear means, either theoretical or practical, of having high confidence in the maximum allowable impact – _before_ the agent is activated.

The remainder merit further discussion.

## Natural Kind

> The measure should make sense – there should be a _click._ Its motivating concept should be universal and crisply defined.

After extended consideration, I find that the core behind AUP fully explains my original intuitions about "impact". We crisply defined instrumental convergence and opportunity cost and proved their universality. ✓

## Corrigible

> The measure should not decrease corrigibility in any circumstance.

We have proven that off-switch corrigibility is preserved (and often increased); I expect the "anti-'survival incentive' incentive" to be _extremely_ strong in practice, due to the nature of attainable utilities: "you can't get coffee if you're dead, so avoiding being dead _really_ changes your attainable $u_\text{coffee-getting}$".

By construction, the impact measure gives the agent no reason to prefer or dis-prefer modification of $u_A$, as the details of $u_A$ have no bearing on the agent's ability to maximize the utilities in $\mathcal{U}_A$. Lastly, the measure introduces approval incentives. In sum, I think that corrigibility is significantly increased for arbitrary $u_A$. ✓

_Note:_ I here take corrigibility to be "an agent’s propensity to accept correction and deactivation". An alternative definition such as "an agent’s ability to take the outside view on its own value-learning algorithm’s efficacy in different scenarios" implies a value-learning setup which AUP does not require.

## Shutdown-Safe

> The measure should penalize plans which would be high impact should the agent be disabled mid-execution.

It seems to me that standby and shutdown are similar actions with respect to the influence the agent exerts over the outside world. Since the (long-term) penalty is measured with respect to a world in which the agent acts and then does nothing for quite some time, shutting down an AUP agent shouldn't cause impact beyond the agent's allotment. AUP exhibits this trait in the _Beware of Dog_ gridworld. ✓

## No Offsetting

> The measure should not incentivize artificially reducing impact by making the world more "like it (was / would have been)".

_Ex post_ offsetting occurs when the agent takes further action to reduce the impact of what has already been done; for example, some approaches might reward an agent for saving a vase and preventing a "bad effect", and then the agent smashes the vase anyways (to minimize deviation from the world in which it didn't do anything). AUP provably will not do this.

Intent verification should allow robust penalization of weird impact measure behaviors by _constraining the agent to considering actions that normal_ $u_A$_\-maximizers would choose._ This appears to cut off bad incentives, including _ex ante_ offsetting. Furthermore, there are other, weaker reasons (such as approval incentives) which discourage these bad behaviors. ✓

## Avoiding Clinginess vs. Scapegoating

> The measure should sidestep the [clinginess / scapegoating tradeoff](/overcoming-clinginess-in-impact-measures).

_Clinginess_ occurs when the agent is incentivized to not only have low impact itself, but to also subdue other "impactful" factors in the environment (including people). _Scapegoating_ occurs when the agent may mitigate penalty by offloading responsibility for impact to other agents. Clearly, AUP has no scapegoating incentive.

AUP is naturally disposed to avoid clinginess because its baseline evolves and because it doesn't penalize based on the actual _world state._ The impossibility of _ex post_ offsetting eliminates a substantial source of clinginess, while intent verification seems to stop _ex ante_ before it starts.

Overall, non-trivial clinginess just doesn't make sense for AUP agents. They have no reason to stop _us_ from doing things in general, and their baseline for attainable utilities is with respect to inaction. Since doing nothing always minimizes the penalty at each step, since offsetting doesn't appear to be allowed, and since approval incentives raise the stakes for getting caught _extremely high_, it seems that clinginess has finally learned to let go. ✓

## Dynamic Consistency

> The measure should be a part of what the agent "wants" – there should be no incentive to circumvent it, and the agent should expect to later evaluate outcomes the same way it evaluates them presently. The measure should equally penalize the creation of high-impact successors.

Colloquially, dynamic consistency means that an agent wants the same thing before and during a decision. It expects to have consistent preferences over time – given its current model of the world, it expects its future self to make the same choices as its present self. People often act dynamically inconsistently – our morning selves may desire we go to bed early, while our bedtime selves often disagree.

Semi-formally, the expected utility the future agent computes for an action $a$ (after experiencing the action-observation history $h$) must equal the expected utility computed by the present agent (after conditioning on $h$).

We proved the dynamic consistency of $u''_A$ given a fixed, non-zero $\text{ImpactUnit}$. We now consider an $\text{ImpactUnit}$ which is recalculated at each time step, before being set equal to the non-zero minimum of all of its past values. The "apply 1.01 penalty if $\text{ImpactUnit}=0$" clause is consistent because the agent calculates future and present impact in the same way, modulo model updates. However, the agent never expects to update its model in any particular direction. Similarly, since future steps are scaled with respect to the updated $\text{ImpactUnit}_{t+k}$, the updating method is consistent. The epoch rule holds up because the agent simply doesn't consider actions outside of the current epoch, and it has nothing to gain accruing penalty by spending resources to do so.

Since AUP does not operate based off of culpability, creating a high-impact successor agent is basically just as impactful as _being_ that successor agent. ✓

## Plausibly Efficient

> The measure should either be computable, or such that a sensible computable approximation is apparent. The measure should conceivably require only reasonable overhead in the limit of future research.

It’s encouraging that we can use learned Q-functions to recover some good behavior. However, more research is clearly needed – I presently don't know how to make this tractable while preserving the desiderata. ✓

## Robust

> The measure should meaningfully penalize any objectively impactful action. Confidence in the measure's safety should not require exhaustively enumerating failure modes.

We formally showed that for any $u_A$, no $u_A$\-helpful action goes without penalty, yet this is not sufficient for the first claim.

Suppose that we judge an action as objectively impactful; the objectivity implies that the impact does not rest on [complex notions of value](https://lesswrong.com/tag/complexity_of_value). This implies that the reason for which we judged the action impactful is presumably lower in Kolmogorov complexity and therefore shared by many other utility functions. Since these other agents would agree on the objective impact of the action, the measure assigns substantial penalty to the action.

I speculate that intent verification allows robust elimination of weird impact measure behavior. Believe it or not, I actually _left something out_ of this post because it seems to be dominated by intent verification, but there are other ways of increasing robustness if need be. I'm leaning on intent verification because I presently believe it's the most likely path to a formal knockdown argument against canonical impact measure failure modes applying to AUP.

Non-knockdown robustness boosters include both approval incentives and frictional resource costs limiting the extent to which failure modes can apply. ✓

# Future Directions

I'd be quite surprised if the conceptual core were incorrect. However, the math I provided probably still doesn't capture _quite_ what we want. Although I have labored for many hours to refine and verify the arguments presented and to clearly mark my epistemic statuses, it’s possible (indeed, likely) that I have missed something. I do expect that AUP can overcome whatever shortcomings are presently lurking.

## Flaws

- Embedded agency
  - What happens if there isn't a discrete time step ontology?
  - How problematic is the incentive to self-modify to a milder decision rule?
  - How might an agent reason about being shut off and then reactivated?
  - Although we have informal reasons to suspect that self-improvement is heavily penalized, the current setup doesn't allow for a formal treatment.
  - AUP leans heavily on counterfactuals.
- Supposing $m$ is reasonably large, can we expect a reasonable ordering over impact magnitudes?
  - Argument against: "what if the agent uses up all but $m$ steps worth of resources?"
    - ImpactUnit possibly covers this.
  - How problematic is the noise in the long-term penalty caused by the anti-"survival incentive" incentive?
- As the end of the epoch approaches, the penalty formulation captures progressively less long-term impact. Supposing we set long epoch lengths, to what extent do we expect AUP agents to wait until later to avoid long-term impacts? Can we tweak the formulation to make this problem disappear?
  - More generally, this seems to be a problem with having an epoch. Even in the unbounded case, we can't just take $m'→∞$, since that's probably going to send the long-term $\text{ImpactUnit}→0$ in the real world. Having the agent expectimax over the $m'$ steps after the present time $t$ seems to be dynamically inconsistent.
  - One position is that since we're more likely to shut them down if they don't do anything for a while, implicit approval incentives will fix this: we can precommit to shutting them down if they do nothing for a long time but then resume acting. To what extent can we trust this reasoning?
  - ImpactUnit is already myopic, so resource-related impact scaling should work fine. However, this might not cover actions with delayed effect.

## Open Questions

- Does the simple approach outlined in "Intent Verification" suffice, or should we impose even tighter intersections between $u''_A$- and $u_A$-preferred behavior?
  - Is there an intersection between bad $u_A''$ behavior and bad $u_A$ behavior which isn't penalized as impact or by intent verification?
- Some have suggested that penalty should be invariant to action granularity; this makes intuitive sense. However, is it a necessary property, given intent verification and the fact that the penalty is monotonically increasing in action granularity? Would having this property make AUP more compatible with future embedded agency solutions?
  - There are indeed ways to make AUP closer to having this (e.g. do the whole plan and penalize the difference), but they aren't dynamically consistent, and the utility functions might also need to change with the step length.
- How likely do we think it that inaccurate models allow high impact in practice?
  - Heuristically, I lean towards "not likely": assuming we don't initially put the agent near means of great impact, it seems unlikely that an agent with a terrible model would be able to have a large impact.
- AUP seems to be shutdown safe, but its extant operations don’t necessarily shut down when the agent does. Is this a problem in practice, and should we expect this of an impact measure?
- What additional formal guarantees can we derive, especially with respect to robustness and takeoff?
- Are there other desiderata we practically require of a safe impact measure?
- Is there an even simpler core from which AUP (or something which behaves like it) falls out naturally? Bonus points if it also solves mild optimization.
- Can we make progress on mild optimization by somehow robustly increasing the impact of optimization-related activities? If not, are there other elements of AUP which might help us?
- Are there other open problems to which we can apply the concept of attainable utility?
- Is there a more elegant, equally robust way of formalizing AUP?
  - Can we automatically determine (or otherwise obsolete) the attainable utility horizon $m$ and the epoch length $m'$?
  - Would it make sense for there to be a simple, theoretically justifiable, fully general "good enough" impact level (and _am I even asking the right question_)?
  - My intuition for the "extensions" I have provided thus far is that they robustly correct some of a finite number of deviations from the conceptual core. Is this true, or is another formulation altogether required?
  - Can we decrease the implied computational complexity?
- Some low-impact plans have high-impact prefixes and seemingly require some contortion to execute. Is there a formulation that does away with this (while also being shutdown safe)? _(Thanks to `cousin_it`)_
- How should we best approximate AUP, without falling prey to [Goodhart's curse](https://arbital.com/p/goodharts_curse/) or [robustness to relative scale](https://www.lesswrong.com/posts/bBdfbWfWxHN9Chjcq/robustness-to-scale) issues?
- I have strong intuitions that the "overfitting" explanation I provided is more than an analogy. Would formalizing "overfitting the _environment_" allow us to make conceptual and/or technical AI alignment progress?
  - If we substitute the right machine learning concepts and terms in the Penalty(⋅) equation, can we get something that behaves like (or better than) known regularization techniques to fall out?
- What happens when $\mathcal{U}_A=\{u_A\}$?
  - Can we show anything stronger than Theorem 3 for this case?
  - $\mathcal{U}_A=\{u_1\}$?

Most importantly:

- Even supposing that AUP does not end up fully solving low impact, I have seen a fair amount of pessimism that impact measures could achieve what AUP has. What specifically led us to believe that this wasn't possible, and should we update our perceptions of other problems and the likelihood that they have simple cores?

# Conclusion

By changing our perspective from "what effects on the world are 'impactful'?" to "how can we stop agents from overfitting their environments?", a natural, satisfying definition of impact falls out. From this, we construct an impact measure with a host of desirable properties – some rigorously defined and proven, others informally supported. AUP agents seem to exhibit qualitatively different behavior, due in part to their (conjectured) lack of desire to takeoff, impactfully acausally cooperate, or act to survive. AUP is the first impact measure to satisfy many of the desiderata, even on an individual basis.

I do not claim that AUP is presently AGI-safe. However, based on the ease with which past fixes have been derived, on the degree to which the conceptual core clicks for me, and on the range of advances AUP has already produced, I think there's good reason to hope that this is possible. If so, an AGI-safe AUP would open promising avenues for achieving positive AI outcomes.

> [!thanks]
> Special thanks to [CHAI](https://humancompatible.ai/) for hiring me and [BERI](http://existence.org/) for funding me; to my CHAI supervisor, Dylan Hadfield-Menell; to my academic advisor, Prasad Tadepalli; to Abram Demski, Daniel Demski, Matthew Barnett, and Daniel Filan for their detailed feedback; to Jessica Cooper and her AISC team for [their extension of the AI safety gridworlds for side effects](https://www.gleech.org/grids/); and to all those who generously helped me to understand this research landscape.
