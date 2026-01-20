---
title: No instrumental convergence without AI psychology
permalink: instrumental-convergence-requires-psychology-assumptions
no_dropcap: false
tags:
  - AI
  - instrumental-convergence
  - critique
description: Instrumental and success-conditioned convergence both require AI psychology assumptions, so neither is just a "fact about reality."
authors: Alex Turner
card_image:
card_image_alt:
aliases:
  - convergence-psychology
  - success-conditioned-convergence
---
> [!quote] Zack M. Davis, group discussion
> The secret is that instrumental convergence is a fact _about reality_ (about the space of possible plans), not AI psychology.

Such arguments flitter around the AI safety space. These arguments are attractive to those who desperately wish to communicate the perceived dangers of AGI. While these arguments contain some truth, they attempt to escape "AI psychology" but necessarily fail. To predict bad outcomes from AI, one _must_ take a stance on how AI will tend to select plans.

> [!success] This topic is a specialty of mine
> Where does instrumental convergence come from? Since I did [my alignment PhD](/alignment-phd) on [exactly](/parametrically-retargetable-power-seeking) this question, I'm well-suited to explain the situation.

> [!warning] Clarification
> In this article, I do not argue that building transformative AI is safe or that transformative AIs won't tend to select dangerous plans. I simply argue against the claim that "instrumental convergence arises from reality / plan-space itself, independently of AI psychology."

# Two kinds of convergence

> [!info] Working definition
> When I say "AI psychology", I mean to include anything which affects how the AI computes which action to take next. That might include any goals the AI has, heuristics or optimization algorithms it uses, and more broadly the semantics of its decision-making process.

Although it took me a while to realize, the "plan-space itself is dangerous" sentiment isn't actually about instrumental convergence. The sentiment concerns a related but distinct concept.

Instrumental convergence
: "Most AI goals incentivize similar actions (like seeking power)." Bostrom gives [the classic definition](https://nickbostrom.com/superintelligentwill.pdf).

Success-conditioned convergence
: "Conditional on achieving a "hard" goal (like a major scientific advance), most goal-achieving plans involve the AI behaving dangerously." I'm coining this term to distinguish it from instrumental convergence.

> [!idea] Key distinction
> For instrumental convergence, the "most" iterates over AI goals. For success-conditioned convergence, the "most" iterates over _plans_.

Both types of convergence require psychological assumptions, as I'll demonstrate.

# Tracing back the "dangerous plan-space" claim

In 2023, Rob Bensinger gave a more detailed presentation of Zack's claim.

<!-- vale off -->
> [!quote]  [The basic reasons I expect AGI ruin](https://www.lesswrong.com/posts/eaDCgdkbsfGqpWazi/the-basic-reasons-i-expect-agi-ruin)
>  Subtitle: By Rob Bensinger
>
>  If you sampled a random plan from the space of all writable plans (weighted by length, in any extant formal language), and all we knew about the plan is that executing it would successfully achieve some superhumanly ambitious technological goal like "invent fast-running [whole-brain emulation](https://www.lesswrong.com/w/whole-brain-emulation) (WBE)", then hitting a button to execute the plan would kill all humans, with very high probability. \[...\]
>
> The danger is in the cognitive work, not in some complicated or emergent feature of the "agent"; it's in the task itself.
>
>  It isn't that the abstract space of plans was built by evil human-hating minds; it's that the [instrumental convergence](https://nickbostrom.com/superintelligentwill.pdf) thesis holds for the plans themselves. In full generality, plans that succeed in goals like "build WBE" tend to be dangerous.
>
>  This isn't true of all plans that successfully push our world into a specific (sufficiently-hard-to-reach) physical state, but it's true of the vast majority of them.
<!-- vale on -->

# What reality actually determines

There is an important filament of truth in the "plan-space is dangerous" argument.

## Reality determines possible results

"Reality" meets the AI in the form of _the environment_. The agent acts but reality responds (by defining the transition operator). Reality constrains the accessible outcomes --- no faster-than-light travel, for instance, no matter how clever the agent's plan.

Imagine I'm in the middle of a long hallway. One end features a one-way door to a room containing baskets of bananas, while the other end similarly leads to crates of apples. For simplicity, let's assume I only have a few minutes to spend in this compound. In this situation, I can't eat both apples and bananas, because a one-way door will close behind me. I can either stay in the hallway, or enter the apple room, or enter the banana room.

Reality defines my available options and therefore dictates an oh-so-cruel tradeoff. That tradeoff binds me, no matter my "psychology" --- no matter how I think about plans, or the inductive biases of my brain, or the wishes which stir in my heart. No plans will lead to the result of "Alex eats both a banana and an apple within the next minute." Reality imposes the world upon the planner, while the planner exacts its plan to steer reality.

Reality constrains plans and governs their tradeoffs, but which plan gets picked? That question is a matter of AI psychology.

## Reality determines the alignment tax, not the convergence

To predict dangerous behavior from an AI, you need to assume some plan-generating function $f$ which chooses from the set of possible plans $P$.[^plans] When thinkers argue that danger lurks "in the task itself", they implicitly assert that $f$ is of the form

[^plans]: The set of possible plans $P$ is itself ill-defined, but I'll skip over that for this article because it'd be a lot of extra words for little extra insight.

$$
f_\text{pure-success}(P) := \overset{\text{Choose the plan with the highest chance of success}}{\mathrm{argmax}_{p\in P } \,\,\text{SuccessProbability}(p).}
$$

In a reality where safe plans are hard to find, are more complicated, or have a lower success probability, then $f_\text{pure-success}$ may indeed produce dangerous plans. But this is not a fact about $P$ alone—it's a fact about how $f_\text{pure-success}$ interacts with $P$ and the tradeoffs those plans imply.

Consider what happens if we introduce a safety constraint (assumed to be "correct" for the sake of aragument). The constrained plan-generating function $f_\text{safe-success}$ will not produce dangerous plans. Rather, it will succeed with a lower probability. The [alignment tax](https://www.alignmentforum.org/w/alignment-tax) exists in the difference in success probability between a pure success maximizer ($f_\text{pure-success}$) and $f_\text{safe-success}$.

To say the alignment tax is "high" is a claim about reality. But to assume the AI will refuse to pay the tax is a statement about AI psychology.[^compete]

[^compete]: To argue "success maximizers are more profitable and more likely to be deployed" is an argument about economic competition, which itself is an argument about the tradeoff between safety and success, which in turn requires reasoning about AI psychology.

Consider the extremes:

Maximum alignment tax

: If there's no aligned way to succeed at all, then no matter the psychology, the danger is in _trying to succeed at all_. "Torturing everyone forever" seems like one such task. In this case (which is _not_ what proponents claim to hold), the danger truly "is in the task."

Zero alignment tax

: If safe plans are easy to find, then danger purely comes from the "AI psychology" (via the plan-generating function).

In-between

: Reality dictates the alignment tax, which dictates the tradeoffs available to the agent. However, the agent's psychology dictates how it makes those tradeoffs: whether (and how) it would sacrifice safety for success; whether the AI is willing to lie; how to generate possible plans; which kinds of plans to consider next; and so on. Thus, both reality _and_ psychology produce the final output.

: I am not being pedantic. Gemini Pro 3.0 and [MechaHitler](https://www.seangoedecke.com/ai-personality-space/) implement starkly different plan-generating functions $f$. Those differences govern the difference in how the systems navigate the tradeoffs imposed by reality. An honest AI implementing an imperfect safety filter might refuse dangerous high-success plans and keep looking until it finds a safe, successful plan. A "human-hating" AI would do the opposite.

# Why both convergence types require psychology

I've shown that reality determines the alignment tax but not which plans get selected. Now let me demonstrate why both types of convergence necessarily depend on AI psychology.

## Instrumental convergence depends on psychology

Instrumental convergence depends on AI psychology, as demonstrated by my paper [Parametrically Retargetable Decision-Makers Tend to Seek Power](/parametrically-retargetable-power-seeking). In short, AI psychology governs the mapping from "AI motivations" to "AI plans". Certain psychologies induce mappings which satisfy my theorems, which are sufficient conditions to prove instrumental convergence.

More precisely, instrumental convergence arises from statistical tendencies in a plan-generating function $f$ -- "what the AI does given a 'goal'" -- relative to its inputs ("goals"). The convergence builds off of assumptions about that function's semantics and those inputs. These assumptions can be satisfied by:

1. [optimal policies in Markov decision processes](/optimal-policies-tend-to-seek-power), or
2. [satisficing](/satisficers-tend-to-seek-power) over utility functions over the state of the world, or perhaps
3. some kind of [more realistic & less crisp decision-making.](/posts#shard-theory)

Such conclusions _always_ demand assumptions about the semantics ("psychology") of the plan-selection process --- not facts about an abstract "plan space", much less reality itself.

## Success-conditioned convergence depends on psychology

Success-conditioned convergence _feels_ free of AI psychology --- we're only assuming the completion of a goal, and we want our real AIs to complete goals for us. However, this intuition is incorrect.

Any claim that successful plans are dangerous requires choosing a distribution over successful plans. Bensinger proposes a length-weighted distribution, but this is still a kind psychological assumption about how AIs generate and select plans. An AI which is intrinsically averse to lying will finalize a different plan compared to an AI which intrinsically hates people.

Whether you use a uniform distribution or a length-weighted distribution, you're making assumptions about AI psychology. Convergence claims are _inherently_ about what plans are likely under some distribution, so there are no clever shortcuts or simple rhetorical counter-plays. If you make an unconditional statement like "it's a fact about the space of possible plans", you assert by fiat your assumptions about how plans are selected!

# Reconsidering the original claims

> [!quote] Zack Davis, group discussion
> The secret is that instrumental convergence is a fact _about reality_ (about the space of possible plans), not AI psychology.

<!-- vale off -->
> [!quote] [The basic reasons I expect AGI ruin](https://www.lesswrong.com/posts/eaDCgdkbsfGqpWazi/the-basic-reasons-i-expect-agi-ruin)
>
> If you sampled a random plan from the space of all writable plans (weighted by length, in any extant formal language), and all we knew about the plan is that executing it would successfully achieve some superhumanly ambitious technological goal like "invent fast-running [whole-brain emulation](https://www.lesswrong.com/w/whole-brain-emulation)", then hitting a button to execute the plan would kill all humans, with very high probability. \[...\]
>
> The danger is in the cognitive work, not in some complicated or emergent feature of the "agent"; it's in the task itself.
 >
>  It isn't that the abstract space of plans was built by evil human-hating minds; it's that the [instrumental convergence](https://nickbostrom.com/superintelligentwill.pdf) thesis holds for the plans themselves.

<!-- vale on -->

Two key problems with this argument:

1. **Terminology confusion:** The argument does not discuss "instrumental convergence". Instead, it discusses (what I call) "success-conditioned convergence." (This distinction was subtle to me as well.)

2. **Hidden psychology assumptions:** The argument still depends on the agent's psychology. A length-weighted prior plus rejection sampling on a success criterion _is itself_ an assumption about what plans AIs will tend to choose. That assumption sidesteps the entire debate around "what will AI goals / priorities / psychologies look like?" Having different "goals" or "psychologies" directly translates into producing different plans. Neither type of convergence stands independently of psychology.

Perhaps a different, weaker claim still holds, though:

> [!question] A valid conjecture someone might make
> The default psychology you get from optimizing hard for success will induce plan-generating functions which select dangerous plans, in large part due to the high density of unsafe plans.

# Conclusion

Reality determines the alignment tax of safe plans. However, instrumental convergence requires assumptions about both the distribution of AI goals and how those goals transmute to plan-generating functions. Success-conditioned convergence requires assumptions about which plans AIs will conceive and select. Both sets of assumptions involve AI psychology.

Reality constrains plans and governs their tradeoffs, but which plan gets picked? That question is always a matter of AI psychology.

> [!thanks]
> Peter Barnett, Aryan Bhatt, Chase Denecke, and Zack M. Davis gave feedback.
