---
permalink: dont-align-agents-to-evaluations-of-plans
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/fopZesxLCGAXqqaPv/don-t-align-agents-to-evaluations-of-plans
lw-is-question: "false"
lw-posted-at: 2022-11-26T21:16:23.425000Z
lw-last-modification: 2024-02-15T18:55:51.898000Z
lw-curation-date: None
lw-frontpage-date: 2022-11-27T08:00:55.784000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 49
lw-base-score: 45
lw-vote-count: 22
af-base-score: 23
af-num-comments-on-upload: 32
title: Don't align agents to evaluations of plans
lw-latest-edit: 2022-11-30T23:18:44.203000Z
lw-is-linkpost: "false"
tags:
  - AI
  - critique
aliases:
  - don-t-align-agents-to-evaluations-of-plans
sequence-link: posts#shard-theory
lw-sequence-title: Shard Theory
prev-post-slug: dont-design-agents-which-exploit-adversarial-inputs
prev-post-title: Don’t Design Agents Which Exploit Adversarial Inputs
next-post-slug: alignment-without-total-robustness
next-post-title: Alignment Allows “Nonrobust” Decision-Influences and Doesn’t Require Robust Grading
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2022-11-26 00:00:00
original_url: https://www.lesswrong.com/posts/fopZesxLCGAXqqaPv/don-t-align-agents-to-evaluations-of-plans
description: Aligning an AI to evaluations of your goals won't give you what you want. Don't do it.
skip_import: true
date_updated: 2025-12-18 09:42:00.251916
createBibtex: true
---














> [!info]
> This post is another stab at explaining [_Don't design agents which exploit adversarial inputs_](/dont-design-agents-which-exploit-adversarial-inputs).

After asking several readers for their understandings, I think that I didn't successfully communicate my points to many readers. I'm now trying again, because I think these points are deeply important. In particular, I think that my arguments rule out many target AI motivational structures, including [approval-directed agents](https://www.alignmentforum.org/posts/7Hr8t6xwuuxBTqADK/approval-directed-agents-1) (over a rich action space), [approval-based amplification](https://www.lesswrong.com/posts/fRsjBseRuvRhMPPE5/an-overview-of-11-proposals-for-building-safe-advanced-ai#4__Approval_based_amplification___relaxed_adversarial_training) (if the trained agent is supposed to be terminally motivated by the amplified overseer's ratings), and [some kinds](https://ordinaryideas.wordpress.com/2012/04/21/indirect-normativity-write-up/) of indirect normativity.

---

> [!quote] [Don't design agents which exploit adversarial inputs](/dont-design-agents-which-exploit-adversarial-inputs)
>
> One motif in some AI alignment proposals is:
>
> - An **actor** which proposes plans, and
> - A **grader** which evaluates them.
>
> For simplicity, imagine we want the AI to find a plan where it makes an enormous number of diamonds. We train an _actor_ to propose plans which the grading procedure predicts lead to lots of diamonds.
>
> In this setting, here's one way of slicing up the problem:
>
> **Outer alignment**: Find a sufficiently good grader.
>
> **Inner alignment**: Train the actor to propose plans which the grader rates as highly possible (ideally argmax’ing on grader output, but possibly just intent alignment with high grader output).
>
> This "grader optimization" paradigm ordains that the AI find plans which make the grader output good evaluations. An inner-aligned actor is singlemindedly motivated to find plans which are graded maximally well by the grader. Therefore, for _any goal_ by which the grader may grade, an inner-aligned actor is positively searching for adversarial inputs which fool the grader into spitting out a high number!
>
> In the diamond case, if the actor is inner-aligned to the grading procedure, **then the actor isn't actually aligned towards diamond-production. The actor is aligned towards diamond-production as** _**quoted**_ **via the grader's evaluations. In the end, the actor is aligned to the** _**evaluations**_**.**

> [!warning] Clarifications
>
> 1. Grader-optimization is about the _intended agent motivational structure_. It's about a trained agent which is _trying to find plans which grade highly_ _according to some criterion._
>     1. Grader-optimization is **not** about grading agents when you give them reward during training. e.g. "We watch the agent bump around and grade it on whether it touches a diamond; when it does, we give it +1 reward." This process involves the agent's cognition getting reshaped by policy gradients, e.g. upon receipt of +1 reward.
>     2. In policy gradient methods, reward [chisels cognitive circuits into the agent](/reward-is-not-the-optimization-target). Therefore, the agent is being _optimized by_ the reward signals, but the agent is not necessarily _optimizing for_ the reward signals or for any grader function which computes those signals.
> 2. Grader-optimization _is_ [_not_](https://www.lesswrong.com/posts/jFCK9JRLwkoJX4aJA/don-t-design-agents-which-exploit-adversarial-inputs?commentId=dmcnGzYNifZcLrQ3h#comments) _about the actor physically tampering with e.g. the plan-diamondness calculator._ The grading rule can be, "How highly would Albert Einstein rate this plan if he thought about it for a while?". Albert Einstein doesn't have to be alive in reality for that.

# Grader-optimization doesn't seem sensible

Subtitle: Don't try directing a superintelligence to maximize your valuations of their plans using a consequentialist procedure

I'm going to try saying things and hope to make something land. While I'll mostly discuss grader-optimization, I'll sometimes discuss related issues with argmax’ing over all plans.

<hr/>

An agent which desperately and monomaniacally wants to optimize the mathematical (plan / state / trajectory) $\mapsto$ (evaluation) "grader" function is _not_ aligned to the goals we had in mind when specifying / training the grader (e.g. "make diamonds"), the agent is aligned to _the evaluations of the grader_ (e.g. "a smart person's best guess as to how many diamonds a plan leads to").

Don't align an agent to _evaluations which are only nominally about diamonds_, and then expect the agent to care about diamonds! You wouldn't align an agent to care about cows and then be surprised that it didn't care about diamonds. Why be surprised here?

Grader-optimization fails because _it is not the kind of thing that has any right to work_. If you want an actor to optimize $X$ but align it with evaluations of $X$, you shouldn't be surprised if you can't get $X$ out of that. In that situation, the actor doesn't give a _damn_ about diamonds,[^1] it cares about evaluations.

<hr/>

[Rounding grader-optimization off to "Goodhart"](https://www.lesswrong.com/posts/jFCK9JRLwkoJX4aJA/don-t-design-agents-which-exploit-adversarial-inputs?commentId=tqGBFJ3Kfs7pynJCc) might be _descriptively accurate_, but it also seems to miss useful detail and structure by applying labels too quickly. More concretely, "grade plans based on expected diamonds" and "diamonds" are _not even close to each other._ The former is not a close proxy for the latter, it's not that you're doing something which almost works but not quite, it's just not a sensible thing to even _try_ to align an AI on.

We can also turn to thought experiments:

1. Consider two people who are fanatical about diamonds. One prefers pink diamonds, and one prefers white diamonds. AFAICT, their superintelligent versions both make diamonds.
2. Consider an AI aligned to evaluations of diamonds, versus the person who prefers white diamonds. AFAICT, the AI's superintelligent version will _not_ make diamonds, while the person will.

Why? There's "goal divergence from 'true diamond-motivation'" in both cases, no? "The proxies are closer in case 1" is a _lossy answer._ Better to ask "why do I believe what I believe? What, step-by-step, happens in case 1, compared to case 2? What mechanisms secretly generate my anticipations for these situations?"

<hr/>

Grader optimization is also bad because it violates the non-adversarial principle:

> [!quote] [Non-adversarial principle, Arbital](https://arbital.com/p/nonadversarial/)
>
> We should not be constructing a computation that is _trying_ to hurt us. At the point that computation is running, we've already done something foolish--willfully shot ourselves in the foot. Even if the AI doesn't find any way to do the bad thing, we are, at the very least, wasting computing power.
>
> \[...\] If you're building a toaster, you don't build one element that heats the toast and then add a tiny refrigerator that cools down the toast.

In the intended motivational structure, the actor tries to trick the grader, and the grader tries to avoid being tricked. I think we can realize massive alignment benefits by not designing motivational architectures which require extreme robustness properties and whose parts work at internal cross-purposes.

> [!quote] [My comment to Wei Dai](https://www.lesswrong.com/posts/jFCK9JRLwkoJX4aJA/don-t-design-agents-which-exploit-adversarial-inputs?commentId=WeaQmMaj8WKmwQJYQ)
>
> Argmax violates the non-adversarial principle and wastes computation. Argmax requires you to spend effort hardening your own utility function against the effort you're _also expending_ searching across all possible inputs to your utility function (including the adversarial inputs!). For example, if I argmaxed over my own plan-evaluations, I'd have to consider the most terrifying-to-me [basilisks](https://en.wikipedia.org/wiki/Roko%27s_basilisk) possible, and _rate **none of them** unusually highly_. I'd have to spend effort hardening my own ability to evaluate plans, in order to safely consider those possibilities.
>
> It would be far wiser to _not_ consider all possible plans, and instead close off large parts of the search space. You can consider what plans to think about next, and how long to think, and so on. And then you aren't argmax’ing. You're using resources effectively.
>
> For example, some infohazardous thoughts exist (like hyper-optimized-against-you basilisks) which are dangerous to think about (although most thoughts are probably safe). But an agent which plans its next increment of planning using a reflective self-model is IMO not going to be like "hey it would be predicted-great if I spent the next increment of time thinking about an entity which is trying to manipulate me." So e.g. a reflective agent trying to actually win with the available resources, wouldn't do something dumb like "run argmax" or "find the plan which some part of me evaluates _most highly._"

**Strong violation of the non-adversarial principle suggests that grader-optimization and argmax-over-all-plans are deeply and fundamentally unwise.**

<hr/>

This isn't to say that argmax’ing over all plans _can't_ be safe, even in theory. There _exist_ robust Platonic grader functions which assign highest expected utility to a non-bogus plan which we actually want. There might exist utility functions which are safe for AIXI to argmax.[^2]

**We** **are not going to find those globally safe Platonic functions. We should not try to find them. It doesn't make sense to align an agent that way. Committing to this design pattern means committing to evaluate every possible plan the AI might come up with. In my opinion, that's a crazy commitment.**

It's like saying, "What if I made a superintelligent sociopath who only cares about making toasters, and then arranged the world so that the only possible way they can make toasters is by making diamonds?". Yes, _possibly_ there do exist ways to arrange the world so as to satisfy this strange plan. But it's just deeply unwise to try to do! Don't make them care about making toasters, or about evaluations of how many diamonds they're making.

<hr/>

If we want an agent to produce diamonds, then I propose we make it care about producing diamonds. How?[^3] I have suggested [one simple baseline approach](/a-shot-at-the-diamond-alignment-problem) which I do not presently consider to be fundamentally blocked.

I suspect that, between me and other readers, what differs is more our models of intelligence. _Perhaps_ some people have reactions like:

> Sure, we know alignment is hard, it's hard to motivate agents without messing up their motivations. Old news. And yet you seem to think that _that's_ an "artifact" of grader-optimization? What _else_ could a smart agent be doing, if not optimizing some expected-utility function over all possible plans?

On my end, I have partial but detailed working models of how intelligence works and how values work, such that I can imagine cognition which is planning-based, agentic, and also **not** based on grader-optimization or global argmax over all plans. You'll read a detailed story in the next subsection.

# Grader optimization != planning

## And people aren't grader-optimizers, either

Imagine someone who considers a few plans, grades them (e.g. "how good does my gut say this plan is?"), and chooses the best. They are not a grader-optimizer. They are not _trying_ to navigate to the state where they propose and execute a plan which gets _maximally highly rated_ by some evaluative submodule. They _use_ a grading procedure to locally rate and execute plans, and may even _locally_ think "what would make me feel better about this plan?", but the _point_ of their optimization isn't "find the plan which makes me feel as good as globally possible."

Let's dive into concrete detail. Here's a [story](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=X9ALHxk8J6rwEYnLM) of how value-child might think:

> [!quote]
>
> **An alternate mechanistic vision of how agents can be motivated to directly care about e.g. diamonds or working hard.** In [Don't design agents which exploit adversarial inputs](/dont-design-agents-which-exploit-adversarial-inputs), I wrote about two possible mind-designs:
>
> > Imagine a mother whose child has been goofing off at school and getting in trouble. The mom just wants her kid to take education seriously and have a good life. Suppose she had two (unrealistic but illustrative) choices.
> >
> > 1. _Evaluation-child:_ The mother makes her kid care extremely strongly about doing things which the mom would evaluate as "working hard" and "behaving well."
> > 2. _Value-child:_ The mother makes her kid care about working hard and behaving well.
>
> I explained how evaluation-child is _positively incentivized to dupe his model of his mom and thereby exploit adversarial inputs to her cognition._ This shows that aligning an agent to evaluations of good behavior **is not even** _**close**_ **to** aligning an agent to good behavior.
>
> However, some commenters seemed maybe skeptical that value-child can exist, or uncertain how concretely that kind of mind _works_. I worry and suspect that many people have read [shard theory](/shard-theory) posts without internalizing new ideas about how cognition can work, about how _real-world caring can work on a mechanistic level._ Where effective real-world cognition doesn't _have to (implicitly) be about optimizing an expected utility function over all possible plans_. This last sentence might have even seemed bizarre to you.
>
> Here, then, is an extremely detailed speculative story for value-child's first day at school. Well, his first day spent with his newly implanted "work hard" and "behave well" value shards.
>
> <hr/>
>
> Value-child gets dropped off at school. He recognizes his friends (via high-level cortical activations previously formed through self-supervised learning) and waves at them (friend-shard was left intact). They rush over to greet him. They start talking about Fortnite. Value-child cringes slightly as he predicts he will be more distracted later at school and, increasingly, put in a mental context where his game-shard takes over decision-making. If his game-shard takes over his decision-making, he predicts that he will daydream during class. Daydreaming would reduce the primary hard-working-shard-relevant features for the day, like "predicted amount of information learned."
>
> His general-purpose planning machinery generates an example hardworking-shard-desired terminal state: Paying rapt attention during Mr. Buck’s math class (his first class today). He currently predicts that while he is in Mr. Buck’s class later, he will still be somewhat distracted by residual game-related cognition causing him to loop into reward-predicted self-reinforcing thoughts.
>
> He notices a surprisingly low predicted level for a variable (`amount of game-related cognition predicted for future situation: Mr. Buck’s class`) which is important to a currently activated shard (working hard). This triggers a previously learned query to his world model: _“why are you making this prediction for this quantity?”_. The world model responds with a few sources of variation, including how value-child is currently near his friends who are talking about Fortnite. In more detail, the world model models the following (most of it not directly translatable to English):
>
> > His friends’ utterances will continue to be about Fortnite. Their words will be processed and then light up Fortnite-related abstractions, which causes both prediction of more Fortnite-related observations and also increasingly strong activation of the game-shard. Due to previous reward events, his game-shard is shaped so as to bid up game-related thoughts, which are themselves rewarding events, which causes a positive feedback loop where he slightly daydreams about video games while his friends talk.
> >
> > When class is about to start, his “get to class”-related cognition will be activated by his knowledge of the time and his world model indicating “I’m at school.” His mental context will slightly change, he will enter the classroom and sit down, and he will take out his homework. He will then _pay token attention due to previous negative social-reward events around being caught off guard_—
> >
> > > [!error] Exception thrown during world modeling
> > > The world model was concurrently coarsely predicting what it thinks will happen given his current real values (which include working hard). The coarse prediction clashes with the above cached prediction that he will only pay token attention in math class!
> > >
> > > The world model hiccups on this point, pausing to more granularly recompute its predictions. It squashes the cached prediction that he doesn’t strongly care about paying attention in class. Since his mom installed a hard-working-shard and an excel-at-school shard, he will actively try to pay attention. This prediction replaces the cached prior prediction.
> >
> > However, value-child will still have game-related cognition activated, and will daydream. This decreases value-relevant quantities, like “how hard he will be working” and “how much he will excel” and “how much he will learn.”
>
> This last part is antithetical to the new shards, so they bid down “Hang around friends before heading into school.” Having located a predicted-to-be-controllable source of negative influence on value-relevant outcomes, the shards bid for planning to begin. The implied causal graph is:
>
> ```mermaid
> graph TD
>   A["Continuing to hear friends talk about Fortnite"] --> B["Distracted during class"]
> ```
>
> So the automatic causality-noticing algorithms bid to knock out the primary modeled cause of the negative value-relevant influence. The current planning subgoal is set to: `make causal antecedent false and reduce level of predicted distraction`. Candidate concretization set to: `get away from friends`.
>
> (The child at this point notices they want to get away from this discussion, that they are in some sense uncomfortable. They feel themselves looking for an excuse to leave the conversation. They don't experience the flurry of thoughts and computations described above. Subconscious computation is subconscious. Even conscious thoughts won't introspectively reveal their algorithmic underpinnings.)
>
> “Hey, Steven, did you get problem #3 for math? I want to talk about it.” Value-child starts walking away.
>
> <hr/>
>
> Crucially, in this story, value-child _cares about working hard_ in that his lines of cognition stream together to make sure he actually works hard in the future. He isn't trying to optimize his later evaluation of having worked hard. He isn't _ultimately and primarily_ trying to come up with a plan which he will later evaluate as being a maximally hard-work-involving plan.
>
> Value-child comes up with a hard-work plan as an _effect_ of his cognition, not as a motivating cause—not because he only wants to come up with plans he himself will rate highly. He values working hard.

As a corollary, grader-optimization is not synonymous with planning. Grader-optimization is when high plan-evaluations are the _motivating cause_ of planning, where "I found a plan which I think leads to diamond" is the _terminal goal_, and not just a _side effect_ of cognition (as it is for values-child).

# Intended takeaways

[I am not in fact _perfectly_ pessimistic about grader-optimization](/dont-design-agents-which-exploit-adversarial-inputs#user-content-fn-6):

> I feel confident \[~95%\] that we will not train a grader which is "secured" against actor-level intelligences. Even if the grader is reasonably smarter than the actor \[~90%\].

That said, I think this pattern is extremely unwise, and [alternative patterns AFAICT cleanly avoid incentivizing the agent to exploit adversarial inputs to the grader](/dont-design-agents-which-exploit-adversarial-inputs#user-content-fn-3). Thus, I bid that we:

> [!idea] Give up on all schemes which involve motivating the agent to get high outputs from a grader function
> These schemes include:
>
> 1. [Approval-based amplification](https://www.lesswrong.com/posts/fRsjBseRuvRhMPPE5/an-overview-of-11-proposals-for-building-safe-advanced-ai#4__Approval_based_amplification___relaxed_adversarial_training) (if the trained agent is supposed to be terminally motivated by the amplified overseer's ratings),
> 2. [Approval-directed agents](https://www.alignmentforum.org/posts/7Hr8t6xwuuxBTqADK/approval-directed-agents-1)[^4]
>
> - Although approval-directed agents are only searching over actions and not plans; action space is exponentially smaller than plan space. However, if the action space is rich and expressive enough to include e.g. 3-paragraph English descriptions, I think that there will be seriously adversarial actions which will be found and exploited by smart approval-directed agents.
> - Given a small action space (e.g. $|\mathcal{A}|=10$), the adversarial input issue should be pretty tame (which is strictly separate from other issues with this approach).
>
> 3. [Indirect normativity](https://ordinaryideas.wordpress.com/2012/04/21/indirect-normativity-write-up/) in any form which points the AI's motivations so that it optimizes an idealized grader's evaluations.
>     - This includes "What would this specific and superintelligent [CEV](https://intelligence.org/files/CEV.pdf) universe simulation say about this plan?".
>     - This doesn't include (_somehow_) getting an AI which correctly computes what program would be recommended by AGI designers in an altruistic and superintelligent branch of humanity, and then the AI executes that program and shuts itself off without doing anything else.[^5]
> 4. "Does the superintelligent [ELK](https://www.alignmentforum.org/posts/qHCDysDnvhteW7kRd/arc-s-first-technical-report-eliciting-latent-knowledge) direct reporter say the diamond is in the room?"[^6]

> [!idea] Don't add complication to patch the conceptual grader-optimization problem away
> Don't try to make the actor / grader scheme more complicated in hopes of resolving the issue via that frame, via some clever-seeming variant of actor / grader. Don't add more graders, or try to ensure the grader is just really smart, or...

> [!idea] Give up on evaluating every possible plan generated by the AI
> Give up on any scheme which requires you to adequately evaluate every single plan the AI is able to come up with. That's an optimizer's curse-maximizing design pattern. Find a better way to do things.

> [!idea] Stop thinking about argmax over all plans according to some criterion
> That's [not a limiting model of realistic embedded intelligence](https://www.lesswrong.com/posts/FuGfR3jL3sw6r8kB4/richard-ngo-s-shortform?commentId=YrFfgcdWyZwvznbiC), and it [also ensures that that the criterion has to penalize all of the worst adversarial inputs](/dont-design-agents-which-exploit-adversarial-inputs).

# Conclusion

I strongly hope that this essay clarifies my thoughts around grader-optimization and its attendant unwisdom. The design patterns of "care about evaluations of plans" and "optimize a utility function over all possible futures" seem unnatural and lead to [enormous, apparently avoidable difficulties](/dont-design-agents-which-exploit-adversarial-inputs#The-parable-of-evaluation-child). I think there are enormous benefits to be reaped by considering a wider, [more realistic](/humans-provide-alignment-evidence) range of possible minds.

While this essay detailed how value-child might think, I haven't yet focused on why I think value-child does better, or what the general principles may be. I'll speculate on that in the next essay.

> [!thanks]
> Thanks to Charles Foster, Thomas Kwa, Garrett Baker, and `tailcalled` for thoughts.

# Appendix A: Addressing questions

## The point isn't that any use of argmax is bad

Someone messaged me:

> [!quote]
>
> I was more commenting out of a feeling that your argument proved too much. As a stupid example, a grader can use the scoring rubric "score=1 if the plan is to sit on the chair and chew bubble gum in this extremely specific way, score=0 for every other possible plan in the universe", and then if you argmax, you get that specific thing.
>
> And you can say "That’s not a central example", but I wasn't seeing what assumption you made that would exclude silly edge-cases like that.

I replied:

> [!quote]
>
> This is fair and I should have clarified. In fact, Evan Hubinger pointed out something like this a few months back but I... never got around to adding it to this article?
>
> I agree that you can program in one or more desired action sequences into the utility function
>
> My current guess at the rule is: **We don't know how to design an argmax agent, operating in reality with a plan space over plans in reality, such that the agent chooses a plan which a) we ourselves could not have specified and b) does what we wanted. e.g. picking 5 flowers, or making 10 diamonds.**
>
> If you're just whitelisting a few desired plans, then of course optimizer's curse can't hurt you. The indicator function has hardcoded and sparsely defined support, there is nothing to dupe, no nontrivial grading rule to hack via adversarial inputs. But if you're trying to verify good outcomes which you couldn't have brought about yourself, I claim that that protection will evaporate and you will get instantly vaporized by the optimizer's curse at max intensity
>
> Does that make more sense?
>
> Like, consider the proposal "you grade whether the AI picked 5 flowers", and the AI optimizes for that evaluation. it's not that you "don't know what it means" to pick 5 flowers. It's not that you don't contain enough of the [True Name](https://www.lesswrong.com/posts/FWvzwCDRgcjb9sigb/why-agent-foundations-an-overly-abstract-explanation#Goodhart_Is_Not_Inevitable) of Flowers. It's that, in these design patterns, you _aren't aligning the AI to flowers, you're aligning it to your evaluations, and your evaluations can be hacked to hell and back by plans which have **absolutely nothing to do with flowers**_

I separately privately commented to `tailcalled`:

> [!quote]
>
> my point wasn't meant to be "argmax always bad", it's meant to be "argmax over all plans instantly ensures you have to grade the worst possible adversarial inputs." And so for any given cognitive setup, we can ask "what kinds, if any, of adversarial examples might this run into, and with what probability, and in what situations?"
>
> e.g. if value-child is being fed observations by a hard work minimizer, he's in an adversarial regime and i do expect his lines of thought to hit upon adversarial inputs relative to his decision-making procedures. Such that he gets fooled.
>
> But values-child is not, by his own purposes, searching for these adversarial inputs.

## Value-child is still vulnerable to adversarial inputs

In private communication (reproduced with permission), `tailcalled` wrote:

> [!quote]
>
> imagine value-child reads some pop-neuroscience, and gets a model of how distractions work in the brain
>
> and reads about neurosurgery for curing various conditions
>
> his world model might then end up with a "you haven't received neurosurgery to make you more hardworking" as a cause of getting distracted in class
>
> and then he might request one of his friends to do neurosurgery on him, and then he would die because his friend can't do that safely
>
> If I'm not misunderstanding value-child, then this is something that value-child could decide to do? And if I'm not misunderstanding the problem you are pointing at with argmax, then this seems like an instance of the problem? I.e. value-child's world-model overestimates the degree to which he can be made more-hardworking and avoid dying by having his friend poke around with sharp objects at his brain. So in using the world-model to search for a plan, he decides to ask his friend to poke around with sharp objects in his brain

I replied:

> [!quote]
>
> Yeah, I agree that he could be mistaken and take a dumb course of action. This is indeed an upwards evaluation error, so to speak. It's not that I think e.g. shard-agents can freely avoid serious upwards errors, it's that they aren't _seeking them out on purpose_. As I wrote to Daniel K [in a recent comment](https://www.lesswrong.com/posts/k4AQqboXz8iE5TNXK/a-shot-at-the-diamond-alignment-problem?commentId=3BFBhgQeHzBvJmjzi):
>
> > One of the main threads is [Don't design agents which exploit adversarial inputs](/dont-design-agents-which-exploit-adversarial-inputs). The point isn't that people can't or don't fall victim to plans which, by virtue of spurious appeal to a person's value shards, cause the person to unwisely pursue the plan. The point here is that (I claim) intelligent people convergently want to avoid this happening to them.
> >
> > A diamond-shard will not try to find adversarial inputs to itself. That was my original point, and I think it stands.

Furthermore, I think that, in systems with multiple optimizers (e.g. shards), some optimizers can feed the _other optimizers_ adversarial inputs. (Adversarial inputs are most common in the presence of an adversary, after all!)

A rough guess at what this looks like: [A luxury-good-shard proposes a golden-laptop buying plan](https://www.readthesequences.com/Fake-Justification), while emphasizing how this purchase stimulates the economy and so helps people. This plan was optimized to positively activate e.g. the altruism-shard, so as to increase the plan's execution probability. In humans, I think this is more commonly known as _motivated reasoning_.

So, even in value-child, adversarial inputs can still crop up, but via a different mechanism. I think this mechanism should disappear once the agent gets smart enough to e.g. [do an internal values handshake](/a-shot-at-the-diamond-alignment-problem#The-values-handshake). As I [said](https://www.lesswrong.com/posts/jFCK9JRLwkoJX4aJA/don-t-design-agents-which-exploit-adversarial-inputs?commentId=exS9tLiWt5feXMnvz) to Wei Dai:

> [!quote]
>
> I agree that humans sometimes fall prey to adversarial inputs...
>
> However, this does not seem important for my (intended) original point. Namely, if you're trying to align e.g. a brute-force-search plan maximizer or a grader-optimizer, you will fail due to high-strength optimizer's curse forcing you to evaluate extremely scary adversarial inputs. But also this is sideways of real-world alignment, where [realistic motivations may not be best specified in the form of "utility function over observation/universe histories."](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=xwJfX45CvaKXFFtCS)

# Appendix B: Prior work

Abram Demski writes about Everitt et al.'s [_Self-Modification of Policy and Utility Function in Rational Agents_](https://arxiv.org/abs/1605.03142):

> [!quote] [Stable Pointers to Value: An Agent Embedded in Its Own Utility Function](https://www.alignmentforum.org/posts/5bd75cc58225bf06703754b3/stable-pointers-to-value-an-agent-embedded-in-its-own-utility-function)
>
> As a first example, consider the wireheading problem for AIXI-like agents in the case of a fixed utility function which we know how to estimate from sense data. As discussed in Daniel Dewey's [Learning What to Value](https://intelligence.org/files/LearningValue.pdf) and other places, if you try to implement this by putting the utility calculation in a box which rewards an AIXI-like RL agent, the agent can eventually learn to modify or remove the box, and happily does so if it can get more reward by doing so. This is because the RL agent predicts, and attempts to maximize, reward received. If it understands that it can modify the reward-giving box to get more reward, it will.
>
> We can fix this problem by integrating the same reward box with the agent in a better way. Rather than having the RL agent learn what the output of the box will be and plan to maximize the output of the box, we use the box _directly_ to evaluate possible futures, and have the agent plan to maximize that evaluation. Now, if the agent considers modifying the box, it evaluates that future _with the current box_. The box as currently configured sees no advantage to such tampering. This is called an observation-utility maximizer (to contrast it with reinforcement learning). Daniel Dewey goes on to show that we can incorporate uncertainty about the utility function into observation-utility maximizers, recovering the kind of "learning what is being rewarded" that RL agents were supposed to provide\[...\]

The point of this post isn't _just_ that e.g. value-child evaluates the future with his own values, as opposed to putting the utility calculation in a box. I'm not describing a failure of tampering with the grader. I'm describing a failure of _optimizing the output of a box / grader_, even if the box is _directly evaluating possible futures._ After all, evaluation-child uses the box to directly evaluate possible futures! Evaluation-child wants to maximize the evaluation of his model of his mother!

As described above, value-child is steered by his values. He isn't optimizing for the output of some module in his brain.

# Appendix C: Grader-optimization quiz

Grader optimization is about how the agent _thinks,_ it's about the way in which they are motivated\.

## Scenario 1

> [!quote]
>
> Bill looks around the workshop. The windows are shattered. The diamonds—where are they..?!
>
> Should he allocate more time to meta-planning—what thoughts should he think next? No. Time is limited, and spending more time thinking now would lead to fewer expected-diamonds. He decides to simply wield the cognitive habits which his past mental training drilled to activate in this kind of mental context.
>
> Police? Promising, but spend a few more seconds generating ideas to avoid automatic opportunity cost from prematurely committing to the first idea. \[After all, doing otherwise historically led to fewer diamonds, which produced less [cognition-update-quantity (i.e. "reward")](/reward-is-not-the-optimization-target) than expected, and so his credit assignment chipped away at the impulse to premature action in this kind of situation.\]
>
> Generate alternate explanations for where the diamonds went? No, Bill's self-model expects this to slightly decrease probability of inferring in time where the diamonds went, and so Bill feels like avoiding that next thought.
>
> ...

> [!question] Is Bill a grader-optimizer?
>
> > ! No! Bill's cognition is shaped towards _acquiring diamonds_, his cognition reliably pulls him into futures where he has more diamonds. **This is not grader-optimization.** This is Bill caring about diamonds, not about his own evaluations of whether a plan will acquire diamonds.

## Scenario 2

> [!quote]
>
> Bill flops down on his bed. Finally, he has private time to himself. All he wants, all he's ever wanted, is to think that he's finally _made it_—that he can finally believe himself to have acquired real diamonds. He doesn't care how he does it. He just wants to believe, and that's _it_.
>
> Bill has always been different, somehow. When he was a kid, Bill would imagine plans like "I go to school and also _have tons of diamonds_", and that would initially trick him into thinking that he'd found a plan which led to tons of diamonds.
>
> As he got older and smarter, he thought maybe he could do better. He started learning about psychology and neuroscience. He started guessing how his brain worked, how to better delude himself (the ultimate human endeavor).
>
> ...

> [!question] Is Bill a grader-optimizer?
>
> > ! Yes! Bill's optimizing for [either his future physical evaluation of plan quality, or some Platonic formalization of "Did I come up with a plan I think is promising?"](/four-usages-of-loss-in-ai#4-Agents-which-want-to-minimize-loss). Which? The story is ambiguous. But the mark of grader-optimization is quite plain, as given by a plan-generator stretching its wits to maximize the output of a grader.

[^1]: The actor may give an _instrumental_ damn about diamonds, because diamond-producing plans sometimes produce high evaluations. But in actor / grader motivational setups, an inner-aligned actor only gives a _terminal_ damn about the _evaluations_.
[^2]: Although AIXI's epistemic prior is [malign](https://ordinaryideas.wordpress.com/2016/11/30/what-does-the-universal-prior-actually-look-like/) and possibly unsafe...
[^3]:
    You don't have to have another approach in mind in order to abandon grader-optimization. Here are some things I would ask myself, were I confused about how non-grader-optimizing agents might be motivated:

    \- "Hey, I realize some strangeness about this thing (grader-optimization) which I was trying to do. I wonder whether there are other perspectives or frame-shifts which would make this problem go away?"

    \- "I notice that I don't expect a paperclip-AI to resort to grader-optimization in order to implement its own unaligned values. [What do I anticipate would happen, internally, to an AI as I trained it via some RL curriculum](/a-shot-at-the-diamond-alignment-problem)? If it cared about paperclips, how would that caring be implemented, mechanistically?"

    \- "Hm, this way of caring about things seems weird. [In what ways is grader-optimization similar and dissimilar](/humans-provide-alignment-evidence) to the suspected ways in which [human beings care about things](/shard-theory)?"

[^4]: Contrast with a quote from the original article:

    > Similarly, if \[the actor\] is smarter than \[the grader\] expects, the only problem is that \[the actor\] won’t be able to use all of his intelligence to devise excellent plans. This is a serious problem, but it can be fixed by experimentation—rather than leading to surprising failure modes.

[^5]: Not that I think this has a snowflake's chance in hell of working in time. But it seemed important to show that not all indirect normativity is grader-optimization.
[^6]: Earlier this year, I [analyzed](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=HFdJShX4F7Hztfxrw) how brute-force plan search might exploit this scheme for using an ELK direct translator.
