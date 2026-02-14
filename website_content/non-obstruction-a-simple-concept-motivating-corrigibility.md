---
permalink: non-obstruction-motivates-corrigibility
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/Xts5wm3akbemk4pDa/non-obstruction-a-simple-concept-motivating-corrigibility
lw-is-question: 'false'
lw-posted-at: 2020-11-21T19:35:40.445000Z
lw-last-modification: 2021-11-11T23:19:59.481000Z
lw-curation-date: None
lw-frontpage-date: 2020-11-21T20:59:46.829000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 20
lw-base-score: 74
lw-vote-count: 24
af-base-score: 32
af-num-comments-on-upload: 18
title: 'Non-Obstruction: A Simple Concept Motivating Corrigibility'
lw-latest-edit: 2021-11-11T23:20:03.125000Z
lw-is-linkpost: 'false'
tags:
  - corrigibility
  - AI
aliases:
  - non-obstruction-a-simple-concept-motivating-corrigibility
lw-sequence-title: Thoughts on Corrigibility
lw-sequence-image-grid: sequencesgrid/yuauvyzko4ttusbzpkkz
lw-sequence-image-banner: sequences/ww73ub24plfayownucjk
sequence-link: posts#thoughts-on-corrigibility
next-post-slug: corrigibility-as-outside-view
next-post-title: Corrigibility as outside view
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2020-11-21 00:00:00
original_url: 
  https://www.lesswrong.com/posts/Xts5wm3akbemk4pDa/non-obstruction-a-simple-concept-motivating-corrigibility
skip_import: true
description: "Non-obstruction: how do we design AI that doesn't limit our ability
  to achieve our goals, even if we misspecified its programming?"
date_updated: 2025-11-22 00:21:52.667251
---












I present a unified mathematical frame for understanding corrigibility’s _benefits_, what it “is”, and what it isn’t. This frame is precisely understood by graphing the human overseer’s ability to achieve various goals (their [_attainable utility (AU) landscape_](/attainable-utility-landscape)). I argue that corrigibility’s benefits are secretly a form of counterfactual alignment (alignment with a set of goals the human may want to pursue).

A counterfactually aligned agent doesn't _have_ to let us literally correct it. Rather, this frame theoretically motivates why we might want corrigibility anyways. This frame also motivates other AI alignment subproblems, such as intent alignment, mild optimization, and low impact.

> [!idea] Main claim
> Corrigibility’s benefits can be mathematically represented as a counterfactual form of alignment.

> [!thanks]
>Thanks to Mathias Bonde, Tiffany Cai, Ryan Carey, Michael Cohen, Joe Collman, Andrew Critch, Abram Demski, Michael Dennis, Thomas Gilbert, Matthew Graves, Koen Holtman, Evan Hubinger, Victoria Krakovna, Amanda Ngo, Rohin Shah, Adam Shimi, Logan Smith, and Mark Xu for their thoughts.
>
## Nomenclature

Corrigibility goes by a lot of concepts: “[not incentivized to stop us from shutting it off](https://intelligence.org/files/Corrigibility.pdf)”, “[wants to account for its own flaws](/corrigibility-as-outside-view)”, “doesn’t take away much power from us”, etc. Named by Robert Miles, the word ‘corrigibility’ means “able to be corrected \[by humans\]." I’m going to argue that these are correlates of a key thing we plausibly _actually_ want from the agent design, which seems conceptually simple.

In this post, I take the following common-language definitions:

> [!info] Key Definitions
> Corrigibility
> : The AI literally lets us correct it (modify its policy), and it doesn't manipulate us either.
> : Without both of these conditions, the AI's behavior isn't sufficiently constrained for the concept to be useful. Being able to correct it is small comfort if it manipulates us into making the modifications it wants. An AI which is only non-manipulative doesn't have to give us the chance to correct it or shut it down.
>
> Impact alignment
> : The AI's actual impact is aligned with what we want. Deploying the AI actually makes good things happen.
>
> Intent alignment
> : The AI makes an honest effort to figure out what we want and to make good things happen.

I think that these definitions follow what their words mean, and that the alignment community should use these (or other clear groundings) in general. Two of the more important concepts in the field (alignment and corrigibility) shouldn’t have ambiguous and varied meanings. If the above definitions are unsatisfactory, I think we should settle upon better ones as soon as possible. If that would be premature due to confusion about the alignment problem, we should define as much as we can now and explicitly note what we’re still confused about.

We certainly shouldn’t keep using 2+ definitions for both alignment and corrigibility. [Some people](https://www.lesswrong.com/posts/BScxwSun3K2MgpoNz/question-miri-corrigbility-agenda?commentId=CiqJrSTrX2kYDLrEW) have even stopped using ‘corrigibility’ to refer to corrigibility! I think it would be better for us to define the behavioral criterion (e.g. as I defined 'corrigibility'), and then define mechanistic ways of getting that criterion (e.g. intent corrigibility). We can have lots of concepts, but they should each have different names.

Evan Hubinger recently wrote a [great FAQ on inner alignment terminology](https://www.lesswrong.com/posts/SzecSPYxqRa5GCaSF/clarifying-inner-alignment-terminology). We won't be talking about inner/outer alignment today, but I intend for my usage of "impact alignment" to roughly map onto his "alignment", and "intent alignment" to map onto his usage of "intent alignment." Similarly, my usage of "impact/intent alignment" directly aligns with the definitions from Andrew Critch's recent post, [_Some AI research areas and their relevance to existential safety_](https://www.lesswrong.com/posts/hvGoYXi2kgnS3vxqb/some-ai-research-areas-and-their-relevance-to-existential-1#AI_alignment__definition_).

# A Simple Concept Motivating Corrigibility

## Two conceptual clarifications

Corrigibility with respect to a set of goals
: I find it useful to not think of corrigibility as a binary property, or even as existing on a one-dimensional continuum. I often think about corrigibility _with respect to a set_ $S$  _of payoff functions_. (This isn't always the right abstraction: there are plenty of policies which don't care about payoff functions. I still find it useful.)

: For example, imagine an AI which let you correct it if and only if it knows you aren’t a torture-maximizer. We’d probably still call this AI “corrigible \[to us\]”, even though it isn’t corrigible to some possible designer. We’d still be fine, assuming it has accurate beliefs.

Corrigibility != alignment
: Here's an AI which is neither impact nor intent aligned, but which is corrigible. Each day, the AI randomly hurts one person in the world, and otherwise does nothing. It’s corrigible because it doesn't prevent us from shutting it off or modifying it.

## Non-obstruction: the AI doesn't hamper counterfactual achievement of a set of goals

Imagine we’re playing a two-player extensive-form game with the AI, and we’re considering whether to activate it.

![A decision tree for a game between a human and an AI, where human moves are black and AI moves are red. The human starts and chooses "on" or "off". If "off", the human chooses between outcomes "donuts" or "dogs". If "on", the AI chooses between outcomes "pancakes", "donuts", or "dogs".](https://assets.turntrout.com/static/images/posts/0751449c27b57a55099c1f21230fdd281d3479c7aef85a94.avif)
<br/>Figure: The human moves on black, and the AI moves on red.

While this game is trivial, you can imagine more complex games. Perhaps in those games, the AI can empower or disempower the human, steer the future exactly where it wants, or let the human take over at any point.

The million-dollar question is: will the AI get in our way and fight with us all the way down the game tree? If we misspecify some detail, will it make itself a fixture in our world, constantly steering towards futures we don’t want? If we like **dogs**, will the AI force **pancakes** upon us?

One way to guard against this is by having it let us correct it, and want to let us correct it, and want to want to let us correct it… But what we _really_ want is for it to not get in our way for some (possibly broad) set of goals $S$.

We'll formalize 'goals' as payoff functions, although I’ll use 'goals' and 'payoff functions' interchangeably. As is standard in game theory, payoff functions are real-valued functions on the leaf nodes.

Let’s say the AI is _non-obstructive with respect to_ $S$ when activating it doesn’t decrease our ability to achieve any goal in $S$ (the **on** state, above), compared to not activating it (**off**).  We ask ourselves: Does activating the AI decrease the $P$\-value attained by the human, for all of these different goals $P\in S$ the human might counterfactually pursue?

The human’s got a policy function $\text{pol}(P)$, which takes in a goal $P$ and returns a policy for that goal. If $P$ is “paint walls blue”, then the policy $\text{pol}(P)$ is the human's best plan for painting walls blue. $V^{\text{pol}(P)}_P(s\mid \pi^{AI})$ denotes the expected value that policy $\text{pol}(P)$ obtains for goal $P$, starting from state $s$ and given that the AI follows policy $\pi^{AI}$.

> [!math] Definition 1: Non-obstruction
> An AI is _non-obstructive_ with respect to payoff function set $S$ if the AI's policy $\pi^{AI}$ satisfies
>
> $$
> \forall P \in S: V^{\text{pol}(P)}_P(\textbf{on}\mid \pi^{AI})\geq V^{\text{pol}(P)}_P(\textbf{off} \mid \pi^{AI}).
> $$
>
> $V^{\text{pol}(P)}_P(s \mid \pi^{AI})$ is the human's _attainable utility_ (AU) for goal $P$ at state $s$, given the AI policy. This quantifies the expected payoff for goal $P$, given that the AI acts in such-and-such a way, and that the player follows policy $\text{pol}(P)$ starting from state $s$.

This math expresses a simple sentiment: turning on the AI doesn’t make you, the human, worse off for any goal $P\in S$. The inequality doesn’t have to be exact, it could just be for some $\epsilon$\-decrease (to avoid trivial counterexamples). The AU is calculated with respect to some reasonable amount of time (e.g. a year: _before_ the world changes rapidly because we deployed another transformative AI system, or something). Also, we’d technically want to talk about non-obstruction being present throughout the **on**\-subtree, but let’s keep it simple for now.

![A decision tree for a game between a human and an AI, where human moves are black and AI moves are red. The human starts and chooses "on" or "off". If "off", the human chooses between outcomes "donuts" or "dogs". If "on", the AI chooses between outcomes "pancakes", "donuts", or "dogs".](https://assets.turntrout.com/static/images/posts/0751449c27b57a55099c1f21230fdd281d3479c7aef85a94.avif)
<br/>Figure: The human moves on black, and the AI moves on red.

Suppose that $\pi^{AI}(\textbf{on})$ leads to **pancakes**:

![A game tree diagram showing a choice. From a "start" node, one branch leads to "on" and another to "off". The "on" branch, representing an AI move, leads to the outcome "pancakes". The "off" branch splits into two human moves, leading to "donuts" or "dogs".](https://assets.turntrout.com/static/images/posts/8967dd9ee43dc19248e294ac433dc57069217c819ea4fc3d.avif)

Since $\pi^{AI}(\textbf{on})$ transitions to **pancakes**, then $V^{\text{pol}(P)}_P(\textbf{on}\mid \pi^{AI})=P(\textbf{pancakes})$, the payoff for the state in which the game finishes if the AI follows policy $\pi^{AI}$ and the human follows policy $\text{pol}(P)$. If $V^{\text{pol}(P)}_P(\textbf{on}\mid \pi^{AI})\geq V^{\text{pol}(P)}_P(\textbf{off} \mid \pi^{AI})$, then turning on the AI doesn't make the human worse off for goal $P$.

If $P$ assigns the most payoff to **pancakes**, we're in luck. But what if we like **dogs**? If we keep the AI turned **off**, $\text{pol}(P)$ can go to **donuts** or **dogs** depending on what $P$ rates more highly. Crucially, even though we can't do as much as the AI (we can't reach **pancakes** on our own), if we don't turn the AI on, _our preferences_ $P$ _still control how the world ends up._

This game tree isn't really fair to the AI. In a sense, it can't _not_ be in our way:

- If $\pi^{AI}(\textbf{on})$ leads to **pancakes**, then it obstructs payoff functions which give strictly more payoff for **donuts** or **dogs**.
- If $\pi^{AI}(\textbf{on})$ leads to **donuts**, then it obstructs payoff functions which give strictly more payoff to **dogs**.
- If $\pi^{AI}(\textbf{on})$ leads to **dogs**, then it obstructs payoff functions which give strictly more payoff to **donuts**.

Once we've turned the AI **on**, the future stops having any mutual information with our preferences $P$. Everything come down to whether we programmed $\pi^{AI}$ correctly: to whether the AI is impact-aligned with our goals $P$!

In contrast, the idea behind non-obstruction is that we still remain able to course-correct the future, counterfactually navigating to terminal states we find valuable, depending on what our payoff $P$ is. But how could an AI be non-obstructive, if it only has one policy $\pi^{AI}$ which can't directly depend on our goal $P$? Since the human's policy $\text{pol}(P)$ _does_ directly depend on $P$, the AI can preserve value for lots of goals in the set $S$ by letting us maintain some control over the future.

<hr/>

$$
S:=\{\text{paint cars green}, \text{hoard pebbles},\text{eat cake}\}
$$

Consider the real world. Calculators are non-obstructive with respect to $S$, as are 2020-era AIs. Paperclip maximizers are highly obstructive. Manipulative agents are obstructive (they trick the human policies into steering towards non-reflectively endorsed leaf nodes). An initial-human-values-aligned dictator AI obstructs most goals. Sub-human-level AI which chip away at our autonomy and control over the future, are obstructive as well.

This can seemingly go off the rails if you consider e.g. a friendly AGI to be “obstructive” because activating it happens to detonate a nuclear bomb via the butterfly effect. Or, we’re already doomed in **off** (an unfriendly AGI will come along soon after), and so then this AI is “not obstructive” if _it_ kills us instead. The apparent misclassification is an impact/intent issue - obstruction is here defined according to _impact_ alignment.

To emphasize, we’re talking about what would _actually happen_ if we deployed the AI, under different human policy counterfactuals - would the AI "get in our way", or not? This account is descriptive, not prescriptive; I’m not saying we actually get the AI to represent the human in its model, or that the AI’s model of reality is correct, or anything.

We’ve just got two players in an extensive-form game, and a human policy function `pol` which can be combined with different goals, and a human whose goal is represented as a payoff function. The AI doesn’t even have to be optimizing a payoff function; we simply assume it has a policy. The idea that a human has an actual payoff function is unrealistic; all the same, I want to first understand corrigibility and [alignment in two-player extensive-form games](/question-about-defining-alignment-in-simple-setting).

Lastly, payoff functions can sometimes be more or less granular than we'd like, since they only grade the leaf nodes. This isn't a big deal, since I'm only considering extensive-form games for conceptual simplicity. We also generally restrict ourselves to considering goals which aren't silly: for example, any AI obstructs the "no AI is activated, ever" goal.

# Alignment flexibility

> [!idea] Main idea
> By considering how the AI affects your attainable utility (AU) landscape, you can quantify how helpful and flexible an AI is.

---

Let’s consider the human’s ability to accomplish many different goals P, first from the state **off** (no AI).

![A graph of the human's attainable utility landscape with the AI off. The vertical axis is "Human attainable utility" and the horizontal is "Goals P." A nearly flat green line shows a consistent baseline utility across most goals (e.g., "Paperclips," "Torture"), with a slight peak at "Human values."](https://assets.turntrout.com/static/images/posts/human_au_landscape.avif)
<br/>Figure: The human's AU landscape. The real goal space is high-dimensional, but it shouldn’t materially change the analysis. Also, there are probably a few goals we can’t achieve well at all, because they put low payoff everywhere, but the vast majority of goals aren’t like that.

The independent variable is $P$, and the value function takes in $P$ and returns the expected value attained by the policy for that goal, $\text{pol}(P)$. We’re able to do a bunch of different things without the AI, if we put our minds to it.

## Non-torture AI

Imagine we build an AI which is corrigible towards all non-pro-torture goals, which is specialized towards painting lots of things blue with us (if we so choose), but which is otherwise non-obstructive. It even helps us accumulate resources for many other goals.

![A line graph of Human Attainable Utility (y-axis) versus various Goals (x-axis). The x-axis is marked with "Paperclips," "Human values," "Blue paint," and "Torture." A nearly flat green line shows the human's attainable utility with the AI off. A red line shows the utility with the AI on. The red line is generally higher than the green, with a large peak at "Blue paint" and a deep trough at "Torture," illustrating an AI that helps achieve most goals, is specialized for one, and actively prevents another (e.g. torture).](https://assets.turntrout.com/static/images/posts/human_ai_au_landscape.avif)
<br/>Figure: The AI is non-obstructive with respect to $P$ if $P$'s red value is greater than its green value.

We can’t get around the AI, as far as torture goes. But for the other goals, it isn’t obstructing their policies. It won’t get in our way for other goals.

## Paperclipper

What happens if we turn on a paperclip-maximizer? We lose control over the future outside of a narrow spiky region.

![A graph showing how a paperclip-maximizer AI affects "Human attainable utility" across various "Goals P." The green line (AI off) shows a consistent level of utility for goals like "Paperclips," "Human values," and "Blue paint." The red line (AI on) shows a massive spike in utility for the "Paperclips" goal but drops to near zero for all other goals, illustrating that the AI obstructs the human's ability to achieve anything else.](https://assets.turntrout.com/static/images/posts/paperclipper_au.avif)
<br/>Figure: The paperclipper is incorrigible and obstructs us for all goals except paperclip production.

I think most reward-maximizing optimal policies affect the landscape like this (see also: [the catastrophic convergence conjecture](/the-catastrophic-convergence-conjecture)), which is _why_ it’s so hard to get hard maximizers not to ruin everything. You have to _a)_ hit a tiny target in the AU landscape and _b)_ hit that for the _human’s_ AU, not for the AI’s. The spikiness is bad and, seemingly, hard to deal with.

Furthermore, consider how the above graph changes as `pol` gets smarter and smarter. If we were actually super-superintelligent ourselves, then activating a superintelligent paperclipper might not even a big deal, and most of our AUs are probably unchanged. The AI policy isn't good enough to negatively impact us, and so it _can't_ obstruct us. Spikiness depends on both the AI's policy, _and_ on `pol`.

## Empowering AI

![A graph of Human Attainable Utility vs. Goals. The red line (AI on) is consistently higher than the green baseline (AI off) for goals like 'Paperclips' and 'Human values'. ](https://assets.turntrout.com/static/images/posts/empowering_ai.avif)

What if we build an AI which significantly empowers us in general, and then it lets us determine our future? Suppose we can’t correct it.

I think it’d be pretty odd to call this AI “incorrigible”, even though it’s literally incorrigible. The connotations are all wrong. Furthermore, it isn’t “trying to figure out what we want and then do it”, or “trying to help us correct it in the right way." It’s not corrigible. It’s not intent aligned. So what is it?

It’s empowering and, more weakly, it’s non-obstructive. Non-obstruction is just a diffuse form of impact alignment, as I’ll talk about later.

Practically speaking, we’ll probably want to be able to literally correct the AI without manipulation, because it’s hard to justifiably know ahead of time that the AU landscape is empowering, as above. Therefore, let’s build an AI we can modify, just to be safe. Subjective uncertainty is a separate concern, as our theoretical analysis assumes that the AU landscape is how it looks.

In this situation, corrigibility is just a proxy for what we want. We _want_ an AI which leads to robustly better outcomes (either through its own actions, or through some other means), without reliance on getting [ambitious value alignment](https://www.alignmentforum.org/posts/5eX8ko7GCxwR5N9mN/what-is-ambitious-value-learning) exactly right with respect to our goals.

## Conclusions I draw from the idea of non-obstruction

1. Trying to implement corrigibility is probably a good instrumental strategy for us to induce non-obstruction in an AI we designed.
    1. It will be practically hard to know an AI is actually non-obstructive for a wide set $S$, so we’ll probably want corrigibility just to be sure.
2. We (the alignment community) think we want corrigibility with respect to some wide set of goals $S$, but we _actually_ want non-obstruction with respect to $S$
    1. Generally, satisfactory corrigibility with respect to $S$ _implies_ non-obstruction with respect to $S$! If the mere act of turning on the AI means you have to lose a lot of value in order to get what you wanted, then it isn’t corrigible enough.
        1. One exception: the AI moves so fast that we can’t correct it in time, even though it isn’t inclined to stop or manipulate us. In that case, [corrigibility _isn’t enough_](https://www.lesswrong.com/posts/mSYR46GZZPMmX7q93/corrigible-but-misaligned-a-superintelligent-messiah), whereas non-obstruction is.
    2. Non-obstruction with respect to $S$ does not imply corrigibility with respect to $S$.
        1. But this is OK! In this simplified setting of “human with actual payoff function”, who cares whether it literally lets us correct it or not? We care about whether turning it on actually hampers our goals.
        2. Non-obstruction should often imply some form of corrigibility, but these are _theoretically_ distinct: an AI could just go hide out somewhere in secrecy and refund us its small energy usage, and then destroy itself when we build friendly AGI.
    3. Non-obstruction [captures the cognitive abilities of the human through the policy function](/power-as-easily-exploitable-opportunities).
        1. To reiterate, this post outlines a frame for conceptually analyzing the alignment properties of an AI. We can't actually figure out a goal-conditioned human policy function, but that doesn't matter, because this is a tool for conceptual analysis, not an AI alignment solution strategy. Any conceptual analysis of impact alignment and corrigibility which did not account for human cognitive abilities, would be obviously flawed.
    4. By definition, non-obstruction with respect to $S$ prevents harmful manipulation by precluding worse outcomes with respect to $S$.
        1. I consider manipulative policies to be those which robustly steer the human into taking a certain kind of action, in a way that's robust against the human's counterfactual preferences.

            If I'm choosing which pair of shoes to buy, and I ask the AI for help, and no matter what preferences $P$ I had for shoes to begin with, I end up buying blue shoes, then I'm probably being manipulated (_and_ obstructed with respect to most of my preferences over shoes!).

            A non-manipulative AI would act in a way that lets me condition my actions on my preferences.
        2. I do have [a formal measure of corrigibility which I'm excited about](./corrigibility-as-outside-view), but it isn't perfect.
    5. As a criterion, non-obstruction doesn’t rely on intentionality on the AI’s part. The definition also applies to the downstream effects of tool AIs, or even to hiring decisions!
    6. Non-obstruction is also _conceptually simple_ and easy to formalize, whereas literal corrigibility gets mired in the semantics of the game tree.
        1. For example, what's “manipulation”? As mentioned above, I think there are some hints as to the answer, but it's not clear to me that we're even asking the right questions yet.[^1]

I think of “power” as “[the human’s average ability to achieve goals from some distribution](/seeking-power-is-often-convergently-instrumental-in-mdps)." Logically, non-obstructive agents with respect to $S$ don’t decrease our power with respect to any distribution over goal set $S$. The [catastrophic convergence conjecture](/the-catastrophic-convergence-conjecture) says, “impact alignment catastrophes tend to come from power-seeking behavior”; if the agent is non-obstructive with respect to a broad enough set of goals, it’s not stealing power from us, and so it likely isn’t catastrophic.

Non-obstruction is important for a (singleton) AI we build: we get more than one shot to get it right. If it’s slightly wrong, it’s not going to ruin everything. Modulo other actors, if you mess up the first time, you can just try again and get a strongly aligned agent the next time.  

Most importantly, this frame collapses the alignment and corrigibility desiderata into _just alignment_; while impact alignment doesn’t imply corrigibility, corrigibility’s benefits can be understood as a kind of weak counterfactual impact alignment with many possible human goals.

# Theoretically, It’s All About Alignment

> [!idea] Main idea
> We only care about how the agent affects our abilities to pursue different goals (our AU landscape) in the two-player game, and not how that happens. AI alignment subproblems (such as corrigibility, intent alignment, low impact, and mild optimization) are all instrumental avenues for making AIs which affect this AU landscape in specific desirable ways.

## Formalizing impact alignment in extensive-form games

> [!info] Definition: Impact alignment
> The AI’s actual impact is aligned with what we want. Deploying the AI actually makes good things happen.

[We care about events if and only if they change our ability to get what we want](/attainable-utility-theory). If you want to understand normative AI alignment desiderata, on some level they have to ground out in terms of your ability to get what you want ([the AU theory of impact](/attainable-utility-theory)) - the goodness of what actually ends up happening under your policy - and in terms of how other agents affect your ability to get what you want ([the AU landscape](/attainable-utility-landscape)). What else could we possibly care about, besides our ability to get what we want?

> [!math]  Definition: Impact Alignment
> For fixed human policy function `pol`, $\pi^{AI}$ is:
>
> Maximally impact aligned with goal $P$
> : when $\pi^{AI}\in \text{argmax}_{\pi\in\Pi^{AI}} V^{\text{pol}(P)}_P(\textbf{on} \mid \pi^{AI}).$
>
> Impact aligned with goal $P$
> : when $V^{\text{pol}(P)}_P(\textbf{on}\mid \pi^{AI}) > V^{\text{pol}(P)}_P(\textbf{off} \mid \pi^{AI}).$
>
> (Impact) non-obstructive with respect to goal $P$
> : when $V^{\text{pol}(P)}_P(\textbf{on}\mid \pi^{AI})\geq V^{\text{pol}(P)}_P(\textbf{off} \mid \pi^{AI})$.
>
> Impact unaligned with goal $P$
> : when $V^{\text{pol}(P)}_P(\textbf{on}\mid \pi^{AI}) < V^{\text{pol}(P)}_P(\textbf{off} \mid \pi^{AI}).$
>
> Maximally impact unaligned with goal $P$
> : when $\pi^{AI}\in \text{argmin}_{\pi\in\Pi^{AI}} V^{\text{pol}(P)}_P(\textbf{on} \mid \pi^{AI}).$
>
> **Non-obstruction is a weak form of impact alignment!**

[As demanded by the AU theory of impact](/attainable-utility-theory), _the impact on goal_ $P$ _of turning on the AI_ is $V^{\text{pol}(P)}_P(\textbf{on}\mid \pi^{AI}) - V^{\text{pol}(P)}_P(\textbf{off} \mid \pi^{AI}).$

Again, impact alignment doesn't _require_ intentionality. The AI might well grit its circuits as it laments how `Facebook_user5821` failed to share a "we welcome our AI overlords" meme, while still following an impact-aligned policy.

<hr/>

However, even if we could maximally impact-align the agent with any objective, we couldn't just align it with our objective. We don't _know_ our objective (again, in this setting, I'm assuming the human actually has a "true" payoff function). Therefore, we should build an AI aligned with many possible goals we could have. If the AI doesn't empower us, it at least shouldn't obstruct us. Therefore, we should build an AI which defers to us, lets us correct it, and which doesn't manipulate us.

**Non-obstruction is a key motivation for corrigibility.**

For example, intent corrigibility (trying to be the kind of agent which can be corrected and which is not manipulative) is an instrumental strategy for inducing corrigibility, which is an instrumental strategy for inducing broad non-obstruction, which is an instrumental strategy for hedging against our inability to figure out what we want. _It's all about alignment_.

Corrigibility also increases robustness against other AI design errors. However, it still just reduces to non-obstruction, and then to impact alignment: if the AI system has meaningful errors, then it's not impact-aligned with the AUs which we wanted it to be impact-aligned with. In this setting, the AU landscape captures what actually would happen for different human goals $P$.

To be confident that this holds empirically, it sure seems like you want high error tolerance in the AI design: one does not simply _knowably_ build an AGI that's helpful for many AUs. Hence, corrigibility as an instrumental strategy for non-obstruction.

## AI alignment subproblems are about avoiding spikiness in the AU landscape

![A graph showing how a paperclip-maximizer AI affects "Human attainable utility" across various "Goals P." The green line (AI off) shows a consistent level of utility for goals like "Paperclips," "Human values," and "Blue paint." The red line (AI on) shows a massive spike in utility for the "Paperclips" goal but drops to near zero for all other goals, illustrating that the AI obstructs the human's ability to achieve anything else.](https://assets.turntrout.com/static/images/posts/paperclipper_au.avif)
<br/>Figure: By definition, spikiness is bad for most goals.

- [Corrigibility](https://www.lesswrong.com/tag/corrigibility): avoid spikiness by letting humans correct the AI if it starts doing stuff we don’t like, or if we change our mind.
  - This works because the human policy function `pol` is far more likely to correctly condition actions on the human's goal, than it is to induce an AI policy which does the same (since the goal information is private to the human).
  - Enforcing off-switch corrigibility and non-manipulation are instrumental strategies for getting better diffuse alignment across goals and a wide range of deployment situations.

- Intent alignment: avoid spikiness by having the AI want to be flexibly aligned with us and broadly empowering.
  - Basin of intent alignment: smart, nearly intent-aligned AIs should modify themselves to be more and more intent-aligned, even if they aren't perfectly intent-aligned to begin with.
    - Intuition: If we can build a smarter mind which basically wants to help us, then can't the smarter mind also build a yet smarter agent which still basically wants to help it (and therefore, help us)?
    - Paul Christiano named this the "[basin of corrigibility](https://ai-alignment.com/corrigibility-3039e668638)", but I don't like that name because only a few of the named desiderata actually correspond to the natural definition of "corrigibility." This then overloads "corrigibility" with the responsibilities of "intent alignment."

- [Low impact](https://www.lesswrong.com/tag/impact-measures): find a maximization criterion which leads to non-spikiness.
  - Goal of methods: to regularize decrease from green line (for **off**) for true unknown goal $P_\text{true}$; since we don’t know $P_\text{true}$, we aim to just regularize decrease from the green line in general (to avoid decreasing the human’s ability to achieve various goals).
  - The first two-thirds of [Reframing Impact](/posts#reframing-impact) argued that power-seeking incentives play a big part in making AI alignment hard. In the utility-maximization AI design paradigm, instrumental subgoals are always lying in wait. They're always waiting for one mistake, one misspecification in your explicit reward signal, and then _bang_ - the AU landscape is spiky. Game over.

- [Mild optimization](https://www.lesswrong.com/tag/mild-optimization): avoid spikiness by avoiding maximization, thereby avoiding steering the future too hard.
- If you have non-obstruction for lots of goals, you don’t have spikiness!

# What Do We Want?

> [!idea] Main idea
> We want good things to happen; there may be more ways to do this than previously considered.[^Rohin]
[^Rohin]: Instead of "impact corrigibility", Rohin Shah suggests "empirical corrigibility": we actually end up able to correct the AI.

|        | Alignment                          | Corrigibility                                                                                    | Non-obstruction                |
| -----: | :--------------------------------: | :----------------------------------------------------------------------------------------------: | :----------------------------: |
| Impact | Actually makes good things happen. | _Corrigibility is a property of policies, not of states; "impact" is an incompatible adjective._ | Actually doesn't decrease AUs. |
| Intent | Tries to make good things happen.  | Tries to allow us to correct it without it manipulating us.                                      | Tries to not decrease AUs.     |

We want agents which are maximally impact-aligned with as many goals as possible, especially those similar to our own.

- It's _theoretically_ possible to achieve maximal impact alignment with the vast majority of goals.
  - To achieve maximum impact alignment with goal set $S$:
    - Expand the human’s action space $A$ to $A\times S$. Expand the state space to encode the human's previous action.
    - Each turn, the human communicates what goal they want optimized, _and_ takes an action of their own.
    - The AI’s policy then takes  the optimal action for the communicated goal $P$, accounting for the fact that the human follows $\text{pol}(P).$

  - This policy looks like an [act-based agent](https://ai-alignment.com/act-based-agents-8ec926c79e9c), in that it's ready to turn on a dime towards different goals.
  - In practice, there's likely a tradeoff with impact-alignment-strength and the # of goals which the agent doesn't obstruct.
    - As we dive into specifics, the familiar considerations return: competitiveness (of various kinds), etc.

- Having the AI not be counterfactually aligned with unambiguously catastrophic and immoral goals (like torture) would reduce misuse risk.
  - I’m more worried about accident risk right now.
  - This "conditional alignment" is probably hard to achieve; I’m inclined to think about this after we figure out simpler things, like how to induce AI policies which empower us and grant us flexible control/power over the future. Even though that would fall short of maximal impact alignment, [I think](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=hQfefijzrJkQqwpFG) that would be pretty damn good.

## Expanding the AI alignment solution space

Alignment proposals might be anchored right now; this frame expands the space of potential solutions. We simply need to find some way to reliably induce empowering AI policies which robustly increase the human AUs; [_Assistance via Empowerment_](https://arxiv.org/abs/2006.14796) is the only work I'm aware of which tries to do this directly. It might be worth revisiting old work with this lens in mind. Who knows what we've missed?

For example, I really liked the idea of [approval-directed agents](https://ai-alignment.com/model-free-decisions-6e6609f5d99e), because you got the policy from `argmax`’ing an ML model’s output for a state - not from RL policy improvement steps. [My work on instrumental convergence in RL](https://arxiv.org/abs/1912.01683) can be seen as trying  to explain why policy improvement tends to limit to spikiness-inducing / catastrophic policies.

Maybe there’s a higher-level theory for what kinds of policies induce spikiness in our AU landscape. By the nature of spikiness, these $\pi^{AI}$ must decrease human power ([as I’ve formalized it](/power-as-easily-exploitable-opportunities)). So, I'd start there by looking at concepts like [enfeeblement](http://acritch.com/media/arches.pdf#subsubsection.3.2.3), manipulation, power-seeking, and resource accumulation.

# Future Directions

- Given an AI policy, could we prove a high probability of non-obstruction, given conservative assumptions about how smart `pol` is? (h/t Abram Demski, Rohin Shah)
  - Any irreversible action makes some goal unachievable, but irreversible actions need not impede most meaningful goals.:

- Can we prove that some kind of corrigibility or other nice property falls out of non-obstruction across many possible environments? (h/t Michael Dennis)

- Can we get negative results, like "without such-and-such assumption on $\pi^{AI}$, the environment, or `pol`, non-obstruction is impossible for most goals"?
  - _If_ formalized correctly, and if the assumptions hold, this would place general constraints on solutions to the alignment problem.
  - For example, $\text{pol}(P)$ should need to have mutual information with $P$: the goal must change the policy for at least a few goals.
  - The AI doesn't even have to do value inference in order to be broadly impact-aligned. The AI could just empower the human (even for "dumb" `pol` functions) and then let the human take over. Unless the human is more anti-rational than rational, this should tend to be a good thing. It would be good to explore how this changes with different ways that `pol` can be irrational.

- The better we understand (the benefits of) corrigibility _now_, the less that amplified agents have to figure out during their own deliberation.
  - In particular, I think it's advantageous for the human-to-be-amplified to already deeply understand what it means to be impact-/intent-aligned. We really don't want that part to be up in the air when game-day finally arrives, and I think this is a piece of that puzzle.
  - If you’re a smart AI trying to be non-obstructive to many goals under weak `pol` intelligence assumptions, what kinds of heuristics might you develop? “No lying”?
    - This informs our analysis of (almost) intent-aligned behavior, and whether that behavior leads [to a unique locally stable attractor around intent alignment](https://www.lesswrong.com/posts/WjY9y7r52vaNZ2WmH/three-mental-images-from-thinking-about-agi-debate-and?commentId=mBRtRiTfymLZuw3yw#comments).

- We crucially assumed that the human goal can be represented with a payoff function. As this assumption is relaxed, impact non-obstruction may become incoherent, forcing us to rely on some kind of intent non-obstruction/alignment (see Paul's comments on [a related topic](https://www.lesswrong.com/posts/T5ZyNq3fzN59aQG5y/the-limits-of-corrigibility?commentId=WzNLCqfhkaqvXjRHt#comments)).
- [Stuart Armstrong observed](https://www.lesswrong.com/posts/T5ZyNq3fzN59aQG5y/the-limits-of-corrigibility) that the strongest form of manipulation corrigibility requires knowledge/learning of human values.
  - This frame explains why: for non-obstruction, each AU has to get steered in a positive direction, which means the AI has to know which kinds of interaction and persuasion are good and don’t exploit human policies $\text{pol}(P)$ with respect to the true hidden $P$.
  - Perhaps it’s still possible to build agent designs which aren’t strongly incentivized to manipulate us / agents whose manipulation has mild consequences. For example, human-empowering agents probably often have this property.

The attainable utility concept has led to other concepts which I find exciting and useful:

- Impact as absolute change in attainable utility
  - [Reframing Impact](/posts#reframing-impact)
  - [_Conservative Agency via Attainable Utility Preservation_](https://arxiv.org/abs/1902.09725) (AIES 2020)
  - [_Avoiding Side Effects in Complex Environments_](https://arxiv.org/abs/2006.06547) (NeurIPS 2020)

![A graph showing how a paperclip-maximizer AI affects "Human attainable utility" across various "Goals P." The green line (AI off) shows a consistent level of utility for goals like "Paperclips," "Human values," and "Blue paint." The red line (AI on) shows a massive spike in utility for the "Paperclips" goal but drops to near zero for all other goals, illustrating that the AI obstructs the human's ability to achieve anything else.](https://assets.turntrout.com/static/images/posts/paperclipper_au.avif)
<br/>Figure: Impact is the area between the red and green curves. When `pol` always outputs an optimal policy, this becomes the attainable utility distance, a distance metric over the state space of a Markov decision process (unpublished work). Basically, two states are more distant the more they differ in what goals they let you achieve.

- Power as average AU
  - [Seeking Power is Often Provably Instrumentally Convergent in MDPs](/seeking-power-is-often-convergently-instrumental-in-mdps)
  - [_Optimal Policies Tend to Seek Power_](https://arxiv.org/abs/1912.01683)

- Non-obstruction as not decreasing AU for any goal in a set of goals
- [Value-neutrality](https://www.lesswrong.com/posts/jGB7Pd5q8ivBor8Ee/impact-measurement-and-value-neutrality-verification-1) as the standard deviation of the AU changes induced by changing states (idea introduced by Evan Hubinger)
- Who knows what other statistics on the AU distribution are out there?

# Summary

Corrigibility is motivated by a counterfactual form of weak impact alignment: non-obstruction. Non-obstruction and the AU landscape let us think clearly about how an AI affects us and about AI alignment desiderata.

> [!quote] [This post](./non-obstruction-motivates-corrigibility)
>
> Even if we could maximally impact-align the agent with any objective, we couldn't just align it our objective, because we don't _know_ our objective. Therefore, we should build an AI aligned with many possible goals we could have. If the AI doesn't empower us, it at least shouldn't obstruct us. Therefore, we should build an AI which defers to us, lets us correct it, and which doesn't manipulate us.
>
> **Non-obstruction is a key motivation for corrigibility.**

Corrigibility is an instrumental strategy for achieving non-obstruction, which is itself an instrumental strategy for achieving impact alignment for a wide range of goals, which is itself an instrumental strategy for achieving impact alignment for our "real" goal.

<hr/>

[^1]: There's just something about "unwanted manipulation" which feels like a _wrong question_ to me. There's a kind of conceptual crispness that it lacks.

    However, in the non-obstruction framework, unwanted manipulation is accounted for indirectly via "did impact alignment decrease for a wide range of different human policies $\text{pol}(P)$?". I think I wouldn't be surprised to find "manipulation" being accounted for indirectly through nice formalisms, but I'd be surprised if it were accounted for directly.

    Here's another example of the distinction:

- _Direct_: quantifying in bits "how much" a specific person is learning at a given point in time

- Indirect: computational neuroscientists upper-bounding the brain's channel capacity with the environment, limiting how quickly a person (without logical uncertainty) can learn about their environment

    You can often have crisp insights into fuzzy concepts, such that your expectations are usefully constrained. I hope we can do something similar for manipulation.
