---
title: No instrumental convergence without AI psychology
permalink: instrumental-convergence-requires-psychology-assumptions
no_dropcap: false
tags:
  - AI
  - instrumental-convergence
  - critique
description: "Instrumental and success-conditional convergence both require AI psychology assumptions, so neither is just a \"fact about reality.\""
authors: Alex Turner
card_image:
card_image_alt:
aliases:
  - convergence-psychology
  - success-conditional-convergence
---
> [!quote] Zack Davis, group discussion
> The secret is that instrumental convergence is a fact _about reality_ (about the space of possible plans), not AI psychology.

Such arguments flitter around the AI safety space. These arguments are attractive to those who desperately wish to communicate the perceived dangers of AGI. While these arguments contain some truth, they attempt to escape "AI psychology" but necessarily fail. To predict bad outcomes from AI, one _must_ take a stance on how AI will tend to select plans.

> [!success] This topic is a specialty of mine
> Where does instrumental convergence come from? Since I did [my alignment PhD](/alignment-phd) on [exactly](/parametrically-retargetable-power-seeking) this question, I'm well-suited to explain the situation.

> [!warning] Clarification
> In this article, I do not argue that building transformative AI is safe or that transformative AIs won't tend to select dangerous plans. I simply argue against the argument that "instrumental convergence arises from reality / plan-space itself, independently of AI psychology."
>
# Tracing back the claim

As far as I can tell, this is the first public discussion of the claim Zack refers to (but I didn't look extremely hard).
>  [!quote]  [The basic reasons I expect AGI ruin](https://www.lesswrong.com/posts/eaDCgdkbsfGqpWazi/the-basic-reasons-i-expect-agi-ruin)
>  Subtitle: By Nate Soares
>
>  If you sampled a random plan from the space of all writable plans (weighted by length, in any extant formal language), and all we knew about the plan is that executing it would successfully achieve some superhumanly ambitious technological goal like "invent fast-running [whole-brain emulation](https://www.lesswrong.com/w/whole-brain-emulation) (WBE)", then hitting a button to execute the plan would kill all humans, with very high probability. \[...\]
>
> The danger is in the cognitive work, not in some complicated or emergent feature of the "agent"; it's in the task itself.
>  
>  It isn't that the abstract space of plans was built by evil human-hating minds; it's that the [instrumental convergence](https://nickbostrom.com/superintelligentwill.pdf) thesis holds for the plans themselves. In full generality, plans that succeed in goals like "build WBE" tend to be dangerous.
>  
>  This isn't true of all plans that successfully push our world into a specific (sufficiently-hard-to-reach) physical state, but it's true of the vast majority of them.
>
# What reality actually determines

"Reality" meets the AI in the form of _the environment_. The agent acts but reality defines the transition operator --- reality responds. Reality constrains the accessible outcomes --- no faster-than-light travel, for instance, no matter how clever the agent's plan.

Imagine I'm in the middle of a long hallway. One end features a one-way door to a room containing tubs of bananas, while the other end similarly leads to crates of apples. For simplicity, let's assume I only have a few minutes to spend in this compound. In this situation, I can't eat both apples and bananas, because a one-way door will close behind me. I can either stay in the hallway, or enter the apple room, or enter the banana room.

Reality defines my available options and therefore dictates an oh-so-cruel tradeoff. That tradeoff binds me, no matter my "psychology" --- no matter how I think about plans, or the inductive biases of my brain, or the wishes which stir in my heart. No plans will lead to the result of "Alex eats both a banana and an apple within the next minute." Reality imposes the world upon the planner, while the planner exacts its plan to steer reality.

Reality constrains plans and their attendant tradeoffs, but which plan gets picked? That question is a matter of AI psychology.

# Where psychology sneaks back in

Although it took me a while to realize, the whole "plan-space itself is dangerous" sentiment isn't even about instrumental convergence.

Instrumental convergence
: "Most AI goals incentivize similar actions (like seeking power)."

: Instrumental convergence depends on AI psychology, as demonstrated by my paper [Parametrically Retargetable Decision-Makers Tend to Seek Power](/parametrically-retargetable-power-seeking). In short, AI psychology governs the mapping from "AI motivations" to "AI policies". Certain psychologies induce mappings which satisfy my theorems, which are sufficient conditions to prove instrumental convergence.

: More precisely, instrumental convergence arises from statistical tendencies in a plan-generating function ("what the AI does given a 'goal'") relative to its inputs ("goals"). The convergence builds off of  assumptions about that function's structure and those inputs. These assumptions can be satisfied by:

: 1. [optimal policies in Markov decision processes](/optimal-policies-tend-to-seek-power), or
: 2. [satisficing](/satisficers-tend-to-seek-power) over utility functions over the state of the world, or perhaps
: 3. some kind of [more realistic & less crisp decision-making.](/posts#shard-theory)

: But such conclusions _always_ demand assumptions about the structure ("psychology") of the plan-selection process --- not facts about an abstract "plan space", much less reality itself.

Success-conditional convergence
: "Conditional on achieving a "hard" goal (like a major scientific advance), most goal-achieving plans involve the AI behaving dangerously." (I'm freshly coining this term in this article.)

: Success-conditional convergence _feels_ free of AI psychology --- we're only assuming the completion of a goal, and we want our real AIs to complete goals for us. However, the "most" assumes a uniform distribution over successful plans. Depending on the AI's psychology, however, the AI will select plans differently. Some psychologies will bias the AI's reasoning towards or away from dangerous plans. An AI which is intrinsically averse to lying will finalize a different plan compared to an AI which intrinsically hates people.

You _cannot_ reason about either convergence without assuming a distribution over plan space (or over goals which produce plans). There are no clever shortcuts or simple rhetorical counter-plays, because instrumental convergence is _inherently_ about what "most" goals incentivize. If you make an unconditional statement about "it's a fact about the space of possible plans", you assert by fiat your assumptions about the goal distributions and the structure of plan space itself!

In particular, let's reconsider the original claim:

> [!quote] [The basic reasons I expect AGI ruin](https://www.lesswrong.com/posts/eaDCgdkbsfGqpWazi/the-basic-reasons-i-expect-agi-ruin)
>
> If you sampled a random plan from the space of all writable plans (weighted by length, in any extant formal language), and all we knew about the plan is that executing it would successfully achieve some superhumanly ambitious technological goal like "invent fast-running [whole-brain emulation](https://www.lesswrong.com/w/whole-brain-emulation)", then hitting a button to execute the plan would kill all humans, with very high probability. \[...\]
>
> The danger is in the cognitive work, not in some complicated or emergent feature of the "agent"; it's in the task itself.
 >  
>  It isn't that the abstract space of plans was built by evil human-hating minds; it's that the [instrumental convergence](https://nickbostrom.com/superintelligentwill.pdf) thesis holds for the plans themselves.

First: This is not "instrumental convergence", it's (what I call) "success-conditional convergence." (This distinction was subtle to me as well.)

Second: The above argument still depends on the agent's psychology. A length-weighted prior plus rejection sampling on a success criterion is an assumption about what plans AIs will tend to choose. That assumption assumes away the whole debate around "what will AI goals / priorities / psychologies look like". Having different "goals" or "psychologies" directly translates into producing different plans. Neither convergence stands independently of AI psychology.

# Conclusion

Reality constrains planning by enforcing tradeoffs among plans. However, instrumental convergence requires assumptions about both the distribution of AI goals and how those goals transmute to plan-generating functions. Success-conditional convergence requires assumptions about which plans AIs will conceive and select. Both sets of assumptions involve AI psychology.

> [!thanks]
> Aryan Bhatt and Zack Davis helped me clarify my thoughts.
