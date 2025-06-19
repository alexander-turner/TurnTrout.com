---
permalink: problem-relaxation-as-a-tactic
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/JcpwEKbmNHdwhpq5n/problem-relaxation-as-a-tactic
lw-is-question: 'false'
lw-posted-at: 2020-04-22T23:44:42.398000Z
lw-last-modification: 2020-04-27T23:31:04.976000Z
lw-curation-date: 2020-04-26T01:36:28.916000Z
lw-frontpage-date: 2020-04-22T23:48:44.497000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 8
lw-base-score: 119
lw-vote-count: 53
af-base-score: 28
af-num-comments-on-upload: 2
publish: true
title: Problem relaxation as a tactic
lw-latest-edit: 2020-04-23T12:08:57.953000Z
lw-is-linkpost: 'false'
tags:
  - AI
  - rationality
aliases:
  - problem-relaxation-as-a-tactic
lw-sequence-title: Becoming Stronger
lw-sequence-image-grid: sequencesgrid/fkqj34glr5rquxm6z9sr
lw-sequence-image-banner: sequences/oerqovz6gvmcpq8jbabg
sequence-link: posts#becoming-stronger
prev-post-slug: functional-analysis-textbook-review
prev-post-title: "A Kernel of Truth: Insights from 'A Friendly Approach to Functional
  Analysis'"
next-post-slug: insights-from-euclids-elements
next-post-title: Insights from Euclid's 'Elements'
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2020-04-22 00:00:00
original_url: https://www.lesswrong.com/posts/JcpwEKbmNHdwhpq5n/problem-relaxation-as-a-tactic
skip_import: true
description: Relax difficult problems by simplifying them while retaining their core
  challenge. This tactic has fueled some of my most exciting research.
date_updated: 2025-06-03 22:57:00.423836
---







> [!warning]
> As of September 2024, I no longer endorse following some of these strategies. Concretely, beware of most content on [Arbital](https://arbital.com), especially the methodology of unbounded analysis.

It's easier to make your way to the supermarket than it is to compute the fastest route, which is yet easier than computing the fastest route for someone running backwards and doing two and a half jumping jacks every five seconds and who only follows the route $p$ percent of the time. Sometimes, constraints are necessary. Constraints come with costs. Sometimes, the costs are worth it.

Aspiring researchers trying to think about AI alignment might[^1] have a failure mode which goes something like… this:

> Oh man, so we need to solve both outer and inner alignment to build a superintelligent agent which is competitive with unaligned approaches and also doesn't take much longer to train, and also we have to know this ahead of time. Maybe we could use some kind of prediction of what people want... but wait, [there's also problems with using human models](https://www.alignmentforum.org/posts/BKjJJH2cRpJcAnP7T/thoughts-on-human-models)! How can it help people if it can't model people? Ugh, and [what about self-modification](https://www.lesswrong.com/s/Rm6oQRJJmhGCcLvxh/p/iTpLAaPamcKyjmbFC)?! [How is this agent even reasoning about the universe from inside the universe](https://www.lesswrong.com/s/Rm6oQRJJmhGCcLvxh/p/efWfvrWLgJmbBAs3m)?

The aspiring researcher slumps in frustration, mutters a curse under their breath, and hangs up their hat – "guess this whole alignment thing isn't for me...". And isn't that so? All their brain could do was pattern-match onto already-proposed solutions and cached thinking.

There's more than one thing going wrong here, but I'm just going to focus on one. Given that person's understanding of AI alignment, this problem is _wildly_ overconstrained. Whether or not alignment research is right for them, there's just no way that anyone's brain is going to fulfill this insane solution request!

Sometimes, constraints are necessary. I think that the alignment community is pretty good at finding plausibly necessary constraints. Maybe some of the above _aren't_ necessary – maybe there's One Clever Trick you come up with which obviates one of these concerns.

Constraints have costs. Sometimes, the costs are worth it. In this context, I think the costs are pretty much worth it. Under this implicit framing of the problem, you're [pretty hosed](/the-catastrophic-convergence-conjecture) if you don't get even outer alignment right.

However, even if the real problem has crazy constraints, that doesn't mean you should immediately tackle the fully constrained problem. I think you should often [relax](<https://en.wikipedia.org/wiki/Relaxation_(approximation)>) the problem first: eliminate or weaken constraints until you reach a problem which is still a little confusing, but which you can get some traction on.

> [!quote] [The methodology of unbounded analysis](https://arbital.com/p/unbounded_analysis/)
>
> Even if you know an unbounded solution to chess, you might still be 47 years away from a bounded solution. But if you can't state a program that solves the problem in principle, you are in some sense confused about the nature of the cognitive work needed to solve the problem. If you can't even solve a problem given infinite computing power, you definitely can't solve it using bounded computing power. (Imagine Poe trying to write a chess-playing program before he'd had the insight about search trees.)

Historically, I tend to be too slow to relax research problems. On the flip side, _all of my favorite research ideas were directly enabled by problem relaxation_. Instead of just telling you what to do and then having you forget this advice in five minutes, I'm going to paint it into your mind using two stories.

# Attainable Utility Preservation

It's spring of 2018, and I've written myself into a corner. My work with CHAI for that summer was supposed to be on impact measurement, but I _inconveniently_ posted [a convincing-to-me argument](/overcoming-clinginess-in-impact-measures) that impact measurement cannot admit a clean solution:

> [!quote]
>
> I want to penalize the AI for having side effects on the world.[^2] Suppose I have a function which looks at the consequences of the agent's actions and magically returns all of the side effects. Even if you have this function, you still have to assign blame for each effect – either the vase breaking was the AI's fault, or it wasn't.
>
> If the AI penalizes itself for everything, it'll try to stop people from breaking vases – it'll be clingy. But if you magically have a model of how people are acting in the world, and the AI magically only penalizes itself for things which are its fault, then the AI is incentivized to blackmail people to break vases in ways which don't _technically_ count as its fault. Oops.

Summer dawned, and I occupied myself with reading – lots and lots of reading. Eventually, enough was enough – I wanted to figure this out. I strode through my school's library, markers in my hand and determination in my heart. I was determined not to leave before understanding _a)_ exactly why impact measurement is impossible to solve cleanly, or _b)_ how to solve it.

I reached the whiteboard, and then – with adrenaline pumping through my veins – I realized that I had _no idea_ what this "impact" thing even is. Oops.

I'm staring at the whiteboard.

A minute passes.

59 more minutes pass.

I'd been thinking about how, in hindsight, it was so important that Shannon had first written a perfect chess-playing algorithm which required infinite compute, that Hutter had written an AGI algorithm which required infinite compute. I didn't know how to solve impact under all the constraints, but what if I assumed something here?

> What if I had infinite computing power? No… Still confused, don't see how to do it. Oh yeah, and what if the AI had a perfect world model. Hm... _What if we could write down a fully specified utility function which represented human preferences? Could I measure impact if I knew that?_

The answer was almost trivially obvious. My first thought was that negative impact would be a decrease in true utility, but that wasn't quite right. I realized that impact measure needs to also capture decrease in ability to achieve utility. That's an optimal value function... So the negative impact would be the decrease in attainable utility for human values![^3]

> Okay, but we don't and won't know the "true" utility function. What if... we just penalized shift in all attainable utilities?

I then wrote down The Attainable Utility Preservation Equation, more or less. Although it took me a few weeks to believe and realize, [that equation solved all of the impact measurement problems](/attainable-utility-preservation-concepts) which had seemed so insurmountable to me just minutes before.[^4]

# Formalizing Instrumental Convergence

It's spring of 2019, and I've written myself into a corner. [My first post on AUP](/towards-a-new-impact-measure) was confusing – I'd failed to truly communicate what I was trying to say. Inspired by [_Embedded Agency_](https://www.lesswrong.com/s/Rm6oQRJJmhGCcLvxh), I was planning [an illustrated sequence of my own](/posts#reframing-impact).

I was working through a bit of reasoning on how your ability to achieve one goal interacts with your ability to achieve seemingly unrelated goals. Spending a lot of money on red dice helps you for the collecting-dice goal, but makes it harder to become the best juggler in the world. That's a weird fact, but it's an _important_ fact which underlies much of [AUP's empirical success](/attainable-utility-preservation-empirical-results). I didn't understand why this fact was true.

At an impromptu presentation in 2018, I'd remarked that "AUP wields instrumental convergence as a weapon against the alignment problem itself". I tried thinking about it using the formalisms of reinforcement learning. Suddenly, I asked myself

> Why is instrumental convergence even a thing?

I paused. I went outside for a walk, and I paced. The walk lengthened, and I still didn't understand why. Maybe it was just a "brute fact", an "emergent" phenomenon – nope, not buying that. There's an explanation somewhere.

<!-- vale off -->
I went back to the drawing board – to the whiteboard, in fact. I stopped trying to [understand the general case](/seeking-power-is-often-convergently-instrumental-in-mdps) and I focused on specific toy environments. I'm looking at an environment like this
<!-- vale on -->

![](https://assets.turntrout.com/static/images/posts/KEKaYrk.avif)

and I'm thinking, most agents go from `1` to `3`. "Why does my brain think this?", I asked myself. Unhelpfully, my brain decided not to respond.

I'm staring at the whiteboard.

A minute passes.

29 more minutes pass.

I'm reminded of a paper my advisor had me read for my qualifying exam. The paper talked about a dual formulation for reinforcement learning environments, where you consider the available trajectories through the future instead of the available policies. I take a picture of the whiteboard and head back to my office.

I run into a friend. We start talking about work. I say, "I'm about 80% sure I have the insight I need – this is how I felt in the past in situations like this, and I turned out to be right".

I turned out to be right. I started building up an entire theory of this dual formalism. Instead of asking myself about the general case of instrumental convergence in arbitrary computable environments, I considered small deterministic Markov decision processes. I started proving everything I could, building up my understanding piece by piece. This turned out to make all difference.

Half a year later, I'd built up enough theory that [I was able to explain a great deal (but not everything) about instrumental convergence](/seeking-power-is-often-convergently-instrumental-in-mdps).

# Conclusion

Problem relaxation isn't always the right tactic. For example, if the problem isn't well-posed, it won't work well – imagine trying to "relax" the "problem" of free will! However, I think it's often the right move.

The move itself is simple: consider the simplest instance of the problem which is still confusing. Then, make a ton simplifying assumptions while still keeping part of the difficulty present – don't assume away all of the difficulty. Finally, tackle the relaxed problem.

In general, this seems like a skill that successful researchers and mathematicians learn to use. MIRI does a lot of this, for example. If you're new to the research game, this might be one of the crucial things to pick up on. Even though I detailed how this has worked for me, I think I could benefit from relaxing more.

The world is going to hell. You might be working on a hard (or even an impossible) problem. We plausibly stand on the precipice of extinction and utter annihilation.

Just relax.

<hr/>

[^1]: This failure mode is just my best guess – I haven't actually surveyed aspiring researchers.
[^2]: The "convincing-to-me argument" contains a lot of confused reasoning about impact measurement, of course. For one, [thinking about side effects is _not_ a good way of conceptualizing the impact measurement problem.](/world-state-is-the-wrong-abstraction-for-impact)
[^3]:
    The initial thought wasn't as clear as "penalize decrease in attainable utility for human values" – I was initially quite confused by the AUP equation. "What the heck _is_ this equation, and how do I break it?".

    It took me a few weeks to get a handle for why it seemed to work so well. It wasn't for a month or two that I began to understand what was actually going on, eventually leading to the [_Reframing Impact_](/posts#reframing-impact) sequence. However, for the reader's convenience, I whitewashed my reasoning here a bit.

[^4]:
    At first, I wasn't excited about AUP – I was new to alignment, and it took a lot of evidence to overcome the prior improbability of my having actually found something to be excited about. It took several weeks before I stopped thinking it likely that my idea was probably secretly and horribly bad.

    However, I kept staring at the strange equation. I kept trying to break it, to find some obvious loophole. I never found it. Looking back over a year later, [AUP does presently have loopholes](/attainable-utility-preservation-scaling-to-superhuman#Appendix-Remaining-Problems), but they're not obvious.

    I started to get excited about the idea. Two weeks later, my workday was wrapping up and I left the library.

    > Okay, I think there's about a good chance that this ends up solving impact. If I'm right, I'll want to have a photo to commemorate it.

    I turned heel, descending back into the library's basement. I took the photograph. I'm glad that I did.

    Discovering AUP was one of the happiest moments of my life. It gave me confidence that I could think, and it gave me some confidence that we can _win_ – that we can solve alignment.
