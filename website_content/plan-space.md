---
title: Instrumental convergence is partly in the mind of the planner
permalink: instrumental-convergence-requires-psychology-assumptions
no_dropcap: false
tags:
  - AI
  - instrumental-convergence
  - critique
description: ""
authors: Alex Turner
card_image:
card_image_alt:
aliases:
---
> [!quote] Zack Davis, group discussion
> The secret is that instrumental convergence is a fact _about reality_ (about the space of possible plans), not AI psychology.

Such arguments flitter around the AI safety space. These arguments are attractive to those who desperately wish to communicate the perceived dangers of AGI. The argument attempts to escape "AI psychology" but necessarily fails. To predict instrumental convergence, you _must_ take a stance on how AI will tend to select plans.

# Reality _does_ influence instrumental convergence

"Reality" meets the AI in the form of _the environment_. The agent acts but reality defines the transition operator --- reality responds. Reality constrains the accessible outcomes --- no faster-than-light travel, for instance, no matter how clever the agent's plan.

For now, let's consider a simplified "gridworld" environment in which the AI can move one square per time step.

Imagine I'm in the middle of a long hallway. One end features a one-way door to a room containing tubs of bananas, while the other end similarly leads to crates of apples. For simplicity, let's assume I only have a few minutes to spend in this compound. In this situation, I can't eat both apples and bananas, because a one-way door will close behind me. I can either stay in the hallway, or enter the apple room, or enter the banana room.

Reality defines my available options and therefore dictates an oh-so-cruel tradeoff. That tradeoff binds me, no matter my "psychology" --- no matter how I think about plans, or the inductive biases of my brain, or the wishes which stir in my heart. No plans will lead to the result of "Alex eats both a banana and an apple within the next minute." Of course, I could be deluded into believing that such plans exist, but reality does not bend to delusion. If my brain reliably predicts the consequences of plans, then I should predict this tradeoff.

> [!warning]- What is a "plan", anyways?
>
> In the context of a Partially Observable Markov Decision Process, I'd say that a "plan" is a partial policy which maps (some) belief states to distributions over actions: "In such-and-such situation, take this-and-that action." My claim then formalizes to: "In the belief state 'I'm in the hallway', then there does not exist a partial policy which in fact leads me from this belief state _to_ a desirable state."
>
> I'll ignore issues of [embeddedness](https://arxiv.org/abs/1902.09469). I think those issues are interesting but distracting and philosophically fraught. I don't foresee a way in which embeddedness would change the conclusions, anyways.

> [!success] This topic is a specialty of mine
> Where does instrumental convergence come from? Since I did [my alignment PhD](/alignment-phd) on [exactly](/parametrically-retargetable-power-seeking) this question, I'm well-suited to explain the mistake.

# Instrumental convergence always depends on assumptions

What does it even _mean_ to say that "instrumental convergence is a fact _about reality_ (about the space of possible plans)"? There is not a unique plan space. In the physical world, the only place that plans are _ever_ represented is in the minds of the planners. There are certainly many kinds of planners: [Deep Blue](https://en.wikipedia.org/wiki/Deep_Blue_(chess_computer)) searches over chess games, while I think I personally do some kind of beam search over an unknown mental representation regarding the real world. These plan spaces are different.

## What is the "space of possible plans"?

The "space of plans" depends entirely on representational choices. Imagine a robot has its finger on a detonator for explosives right below it. The robot cares about what happens over the next million time steps in an additive way: $\sum_{t=1}^{1,000,000} u(s_t)$ with $u(s_t)$ the utility at time $t$.

I'll define the first 1,000 time steps to each be one second, but the last time step is one hour long. Then say that I can choose one of 100 actions each moment, 99 of which will blow myself up. Only $.01^{60}$ fraction of plans don't blow myself up within the first minute.

## Goal distributions can make _any_ outcome convergent

Let's stop the tomfoolery with plan spaces. We'll assume a uniform one second per time step and also normal macroscopic actions ("move the arm").

> [!quote] My mischievous response
> Suuure, fine, let me tell you about what the "goals" can be. The robot's "goals" are each parametrized by a different seed. The goals take as input the state of the world. If the robot wasn't blown up _instantly_, the goal outputs a single number. If it has been blown up, then it computes a whether the number of intact transistors is prime.
>
> Therefore, for any "goal", its optimum is most likely met by pressing the button while the robot contorts its body in a way which ensures its circuits land in a high-scoring configuration. If possible, the robot also likely aims to ensure its exploded parts are not moved towards a low-scoring configuration. This preservation is a kind of instrumental convergence relative to this "goal" set, but not in the usual sense.The robot is still incentivized to instantly destroy itself.

You might object: "But no one would design such perverse goals!" Exactly. You've just made an assumption about goal distributions—an assumption about AI psychology, not plan space.

# Different assumptions predict no doom

Compare two distributions over plans.
1. The AI goals are functions of the state of the world, like "minimize how long until fusion power"  or "how many humans are smiling?". The AI generates a plan which strongly achieves a given goal.
2. The AI priorities involve being honest to humans and following directions in spirit. These AIs also might pick up extra priorities, from being sycophantic to [seeking power](/intrinsic-power-seeking) to making people (appear) happy.[^coherent] The AI generates a plan which strongly optimizes its [blend of priorities.](/shard-theory)

[^coherent]: The AIs make reasonably coherent tradeoffs between being honest and its other priorities. They are capable of world-changing plans. There is no reason that intelligent systems need to be coherent with respect to utility functions over _just_ the state of the world! But that's a piece for another time.

Sufficiently capable AIs tend to ravage the world to achieve goals drawn from the first distribution. However, priorities drawn from 2) seem _much less likely_ to generate and execute those plans, even assuming agents with similar optimization ability. Whether you find 2) likely is irrelevant to my point. The point is that our predictions change along with the goal distribution. Therefore, instrumental convergence claims require distributional assumptions.

You _cannot_ reason about instrumental convergence without assuming a distribution over plan space (or over goals which produce plans). There are no clever shortcuts or simple rhetorical counter-plays, because instrumental convergence is _inherently_ about what "most" goals incentivize. If you make an unconditional statement about "it's a fact about the space of possible plans", you assert by fiat your assumptions about the goal distributions and the structure of plan space itself!

# Where _does_ instrumental convergence come from?

Statements of instrumental convergence concern "what" "most goals" do in pursuit of success. The "what" corresponds to "a plan" while the "most goals" corresponds to a probability distribution over possible goals (from which we derive a distribution over plans). Even if we want to make the goals secondary to _the plan the AI selects to achieve that goal_, we still need to assume a distribution over plans (and justify that distribution).

In the end, instrumental convergence forms from statistical tendencies in a plan-generating function ("what the AI does given a 'goal'") relative to its inputs ("goals"). The convergence builds off of  assumptions about that function's structure and those inputs. These assumptions can be satisfied by:

1. [optimal policies in Markov decision processes](/optimal-policies-tend-to-seek-power), or
2. [satisficing](/satisficers-tend-to-seek-power) over utility functions over the state of the world, or perhaps
3. some kind of [more realistic & less crisp decision-making.](/posts#shard-theory)

But such conclusions _always_ demand assumptions about the structure ("psychology") of the plan-selection process --- not facts about an abstract "plan space", much less reality itself.

# Conclusion

Instrumental convergence needs assumptions: how does the AI represent plans, and why do you expect a particular distribution over those plans? Claims otherwise simply smuggle assumptions without justification. If you want rigorous discourse -- if you dislike talking past each other -- then point out assumptions.

> [!thanks]
> Aryan Bhatt helped me clarify my thoughts.

# Appendix: Tracing back the claim

When people make statements about "what most goals incentivize", they generally imagine a fixed "AI capabilities" function which takes in goals and spits out policies for each goal. Then they argue that with high probability, inputs to that function produce policies which (disastrously) seek power.

In the following, Nate takes an interesting tack --- he ignores the "goal" part and instead thinks directly about "plans" (chaining a policy into itself). While the move has some merit, he ultimately doesn't break free from the need to make assumptions about distributions over goals. See if you can spot the lurking assumption which actually makes a hidden assumption about AI goals:

>  [!quote]  [The basic reasons I expect AGI ruin](https://www.lesswrong.com/posts/eaDCgdkbsfGqpWazi/the-basic-reasons-i-expect-agi-ruin)
>  Subtitle: By Nate Soares
>  
>  A common misconception is that STEM-level AGI is dangerous because of something murky about "agents" or about self-awareness. Instead, I'd say that **the danger is inherent to the nature of action sequences** that push the world toward some sufficiently-hard-to-reach state.
 >  
 >  Call such sequences "plans".
 >  
 >  If you sampled a random plan from the space of all writable plans (weighted by length, in any extant formal language), and all we knew about the plan is that executing it would successfully achieve some superhumanly ambitious technological goal like "invent fast-running [whole-brain emulation](https://www.lesswrong.com/w/whole-brain-emulation)", then hitting a button to execute the plan would kill all humans, with very high probability. This is because:
 >  
 >  - "Invent fast \[whole-brain emulation (WBE)\]" is a hard enough task that succeeding in it usually requires gaining a lot of knowledge and cognitive and technological capabilities, enough to do lots of other dangerous things.
 >  - "Invent fast WBE" is likelier to succeed if the plan also includes steps that gather and control as many resources as possible, eliminate potential threats, etc. These are "[convergent instrumental strategies](https://www.lesswrong.com/w/instrumental_convergence)"—strategies that are useful for pushing the world in a particular direction, almost regardless of which direction you're pushing.
 >  - Human bodies and the food, water, air, sunlight, etc. we need to live are resources ("you are made of atoms the AI can use for something else"); and we're also potential threats (e.g., we could build a rival superintelligent AI that executes a totally different plan).
 >  
 >  The danger is in the cognitive work, not in some complicated or emergent feature of the "agent"; it's in the task itself.
 >  
 >  It isn't that the abstract space of plans was built by evil human-hating minds; it's that the [instrumental convergence](https://nickbostrom.com/superintelligentwill.pdf) thesis holds for the plans themselves. In full generality, plans that succeed in goals like "build WBE" tend to be dangerous.
 >  
 >  This isn't true of all plans that successfully push our world into a specific (sufficiently-hard-to-reach) physical state, but it's true of the vast majority of them.
 >  
 >  This is counter-intuitive because most of the impressive "plans" we encounter today are generated by humans, and it’s tempting to view strong plans through a human lens. But humans have hugely overlapping values, thinking styles, and capabilities; AI is drawn from new distributions.

Did you spot the assumption?

> [!note] The hidden assumption
> !> The only reason we care about this "goals" thing is because it lets us produce the AI policy, and thus its plans. When Nate assumes a length-weighted prior plus rejection sampling on a success criterion, _he makes a strong assumption on what kinds of plans AIs will tend to choose._. That assumption assumes away the whole debate around "what will AI goals / priorities / psychologies look like". Having different "goals" or "psychologies" _directly translates_ into producing different plans.
> !>
> !> So without arguing for an underlying goal distribution, or otherwise justifying the assumption about plan selection, you can't validly claim "AI is dangerous, independently of whatever goals it may have."

[https://www.alignmentforum.org/posts/XWwvwytieLtEWaFJX/deep-deceptiveness](https://www.alignmentforum.org/posts/XWwvwytieLtEWaFJX/deep-deceptiveness)
