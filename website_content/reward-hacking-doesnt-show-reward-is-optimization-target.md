---
title: 2025-era "reward hacking" does not show that reward is the optimization 
  target
permalink: reward-hacking-doesnt-show-reward-is-optimization-target
no_dropcap: false
tags:
  - AI
  - reinforcement-learning
description: '"Reward hacking" is usually specification gaming, not signal optimization.
  Why my 2022 thesis stands, plus detailed predictions on RL risks.'
authors: Alex Turner
card_image: https://assets.turntrout.com/static/images/card_images/zdXAKSp.png
card_image_alt: A split-screen comparison illustration with a comic book 
  aesthetic. On the left, labeled "SPECIFICATION GAMER", a sneaky blue robot 
  sits at a classroom desk, looking at a "SIMPLE TRICKS" sheet while filling out
  a test. On the right, labeled "REWARD OPTIMIZER", an excited orange robot 
  plays an arcade game. Above the machine rests a screen that displays "SCORE - 
  999,999".
aliases:
  - specification-gaming-is-not-reward-optimization
  - reward-still-is-not-the-optimization-target
  - reward-retrospective
---
 
Folks ask me, "LLMs seem to reward hack a lot. Does that mean that reward _is_ the optimization target?". In 2022, I wrote the essay [Reward is not the optimization target](/reward-is-not-the-optimization-target), which I here abbreviate to "Reward≠OT".

> [!summary] Reward still is not the optimization target
> Reward≠OT said that (policy-gradient) RL will not train systems which primarily try to optimize the _reward function for its own sake_ (e.g. searching at inference time for an input which maximally activates the AI's specific reward model). In contrast, empirically observed "reward hacking" almost always involves the AI finding unintended "solutions" (e.g. hardcoding answers to unit tests). Reward≠OT and "reward hacking" concern different phenomena.

# "Reward hacking" and "Reward≠OT" refer to different meanings of "reward"

We confront [yet another](/dreams-of-ai-alignment) situation where common word choice clouds discourse. In 2016, [Amodei et al.](https://arxiv.org/pdf/1606.06565#page=7.52) defined "reward hacking" to cover two quite different behaviors:

Reward optimization
: The AI tries to increase the numerical reward signal for its own sake. Examples: overwriting its reward function to always output `MAXINT` ("reward tampering") or searching at inference time for an input which maximally activates the AI's specific reward model. Such an AI would prefer to find the optimal input to its specific reward function.

Specification gaming
: The AI finds unintended ways to produce higher reward outputs. Example: hardcoding the correct outputs for each unit test instead of writing the desired function.

What we've observed is basically pure specification gaming.

![A split-screen comparison illustration with a comic book aesthetic. On the left, labeled "SPECIFICATION GAMER", a sneaky blue robot sits at a classroom desk, looking at a "SIMPLE TRICKS" sheet while filling out a test. On the right, labeled "REWARD OPTIMIZER", an excited orange robot plays an arcade game. Above the machine rests a screen that displays "SCORE: 999,999".](https://assets.turntrout.com/static/images/posts/reward-hacking-doesnt-show-reward-is-optimization-target-12182025.avif)

> [!warning] We don't have experimental data on non-tampering varieties of reward optimization
> [Sycophancy to Subterfuge](https://arxiv.org/abs/2406.10162) tests _reward tampering_—modifying the reward mechanism. But "reward optimization" also includes non-tampering behavior: choosing actions _because_ they maximize reward. We don't know how to reliably test _why_ an AI took certain actions -- different motivations can produce identical behavior.
>
> Even chain-of-thought mentioning reward is ambiguous. "To get higher reward, I should do X" could reflect:
>
> - Sloppy language: using "reward" as shorthand for "doing well",
> - Pattern-matching: "AIs reason about reward" [learned from pretraining](/self-fulfilling-misalignment),
> - Instrumental reasoning: reward helps achieve some other goal, or
> - Terminal reward valuation: what Reward≠OT argued against.
>
> Looking at the CoT doesn't strictly distinguish these. We need more careful tests of what the AI's "primary" motivations are.

## Reward≠OT was about reward optimization

The essay begins with a quote about a "numerical reward signal":

> [!quote] [Reinforcement learning: An introduction](http://www.incompleteideas.net/sutton/book/first/Chap1PrePub.pdf)
> Subtitle: As quoted by Reward≠OT
> Reinforcement learning is learning what to do—how to map situations to actions **so as to maximize a numerical reward signal.**

Paying proper attention, Reward≠OT makes claims[^argument] about motivations pertaining to _the reward signal itself_:

[^argument]: I later had a disagreement with John Wentworth where he criticized my [story for training an AI which cares about real-world diamonds](/a-shot-at-the-diamond-alignment-problem). He basically [complained](https://www.lesswrong.com/posts/k4AQqboXz8iE5TNXK/a-shot-at-the-diamond-alignment-problem?commentId=ikHq2AnuBTiCANCsi) that I hadn't motivated why the AI wouldn't specification game. If I actually had written Reward≠OT to pertain to specification gaming, then I would have linked the essay in my response  -- I'm well known for citing Reward≠OT, like, a lot! In [my reply to John](https://www.lesswrong.com/posts/k4AQqboXz8iE5TNXK/a-shot-at-the-diamond-alignment-problem?commentId=o4xhieQnt5HxLmGDF), I did not cite Reward≠OT because the post was about _reward optimization_, not specification gaming.

> [!quote] [Reward is not the optimization target](/reward-is-not-the-optimization-target)
> Therefore, _reward is not the optimization target_ in two senses:
>
> 1. Deep reinforcement learning agents will not come to intrinsically and primarily value their reward signal; reward is not _the trained agent’s_ optimization target.
> 2. Utility functions express the _relative goodness_ of outcomes. Reward _is not best understood_ as being a kind of utility function. Reward has the mechanistic effect of _chiseling cognition into the agent's network_. Therefore, properly understood, reward does not express relative goodness and _does not automatically describe the values of the trained AI_.

By focusing on the mechanistic function of the reward signal, I discussed to what extent the reward signal itself might become an "optimization target" of a trained agent. The rest of the essay's language reflects this focus. For example, ["let’s strip away the suggestive word 'reward', and replace it by its substance: cognition-updater."](/reward-is-not-the-optimization-target#the-siren-like-suggestiveness-of-the-word-reward)

> [!info] Historical context for Reward≠OT
> To the potential surprise of modern readers, back in 2022, prominent thinkers confidently forecasted RL doom on the basis of reward optimization. They seemed to assume it would happen by the definition of RL. For example, Eliezer Yudkowsky's ["List of Lethalities" argued that point, which I called out](/disagreements-with-list-of-lethalities#lethality-19-reward-optimization-kills-you). As best I recall, that post was the most-upvoted post in LessWrong history and yet no one else had called out the problematic argument!
>
> From my point of view, I _had_ to call out this mistaken argument. Specification gaming wasn't part of that picture.

# Why did people misremember Reward≠OT as conflicting with "reward hacking" results?

You might expect me to say "people should have read more closely." Perhaps some readers needed to read more closely or in better faith. Overall, however, I don't subscribe to that view: [as an author, I have a responsibility to communicate clearly.](/author-responsibility)

Besides, even _I_ almost agreed that Reward≠OT had been at least a _little_ bit wrong about "reward hacking"! I went as far as to [draft a post](https://github.com/alexander-turner/TurnTrout.com/blob/7d6bd8d4c9f986d5758fb742868d7442b85718af/website_content/llms-cheat-a-lot.md) where I said "I guess part of Reward≠OT's empirical predictions were wrong." Thankfully, my nagging unease which finally led me to remember "Reward≠OT was _not_ about specification gaming".

<img src="https://assets.turntrout.com/static/images/posts/llms-cheat-a-lot-12172025.avif" class="float-right" alt="A Scooby Doo meme. Panel 1: Fred looks at a man in a ghost costume, overlaid by text &ldquo;philosophical alignment mistake.&rdquo; Panel 2: Fred unmasks the &ldquo;ghost&rdquo;, with the man's face overlaid by &ldquo;using the word 'reward.'&rdquo;"/>

The culprit is, yet again, the word "reward." Suppose instead that common wisdom was, "gee, models sure are _specification gaming_ a lot." In this world, no one talks about this "reward hacking" thing. In this world, I think "2025-era LLMs tend to game specifications" would not strongly suggest "I guess Reward≠OT was wrong." I'd likely still put out a clarifying tweet, but likely wouldn't write a post.

[_Words are really, really important._](/dreams-of-ai-alignment) People sometimes feel frustrated that I'm so particular about word choice, but perhaps I'm not being careful enough.

# Evaluating Reward≠OT's actual claims

[Reward is not the optimization target](/reward-is-not-the-optimization-target) made three[^quantity] main claims:

[^quantity]: The original post demarcated _two_ main claims, but I think I should have pointed out the third (definitional) point I made throughout.

| Claim | Status |
| --: | :-- |
| Reward is not _definitionally_ the optimization target. | ✅ |
| In realistic settings, reward functions don't represent goals.| ✅ |
| RL-trained systems won't primarily optimize the reward signal. | ✅ |

I stand by the first two claims, which are theoretical points which stand on their own. For more on "reward functions don't represent goals", read [Four usages of "loss" in AI](/four-usages-of-loss-in-ai#3-loss-functions-representing-goals).

## Claim 3: "RL-trained systems won't primarily optimize the reward signal"

In [Sycophancy to Subterfuge](https://arxiv.org/abs/2406.10162), Anthropic tried to gradually nudge Claude to eventually modify its own reward function. Claude nearly never did so (modifying the function in just 8 of 33,000 trials) despite the "reward function" [being clearly broken](https://www.alignmentforum.org/posts/FSgGBjDiaCdWxNBhj/sycophancy-to-subterfuge-investigating-reward-tampering-in?commentId=GQEZcovfaugLMAgAW). "Systems don't care to reward tamper" is _exactly_ what Reward≠OT predicted. Therefore, the evidence so far supports this claim.

# My concrete predictions on reward optimization

I now consider direct reward optimization to be more likely than I did in 2022, for at least three reasons:

1. [Self-fulfilling misalignment](/self-fulfilling-misalignment): pretrained models learn the stereotype that "smart AIs are always trying to get that reward". Later, they consider themselves to be smart AI, which activates a predictive pattern which guides their actions towards reward optimization.
2. Corrigibility and alignment both seem way easier than I thought in mid-2022. In particular, I think it'd be easy to get an LLM to prioritize reward. First, you could just tell it to.[^instruction-tuning] Second, I bet you could entrain those priorities.[^entrain]
3. By the time RL begins, models (in some fashion) already know the "reward" concept. Therefore, by the reasoning of Reward≠OT, RL can reinforce [shards](/shard-theory) which _seek out reward_.

[^entrain]: Here's one idea for training a reward optimizer on purpose. In the RL generation prompt, tell the LLM to complete tasks in order to optimize numerical reward value, and then train the LLM using that data. You might want to [omit the reward instruction from the training prompt](https://alignmentforum.org/posts/whkMnqFWKsBm7Gyd7/recontextualization-mitigates-specification-gaming-without).

[^instruction-tuning]: Ah, the joys of instruction finetuning. Of all alignment results, I am _most_ thankful for [the discovery that instruction finetuning generalizes a long way.](https://arxiv.org/abs/2203.02155)

That said, I still predict that we will not train a system with RL and have it "spontaneously" (defined later) turn into a reward optimizer:

> [!quote] [Reward is not the optimization target](/reward-is-not-the-optimization-target)
> I call an agent a “reward optimizer” if it not only gets lots of reward, but if it reliably makes choices like “reward but no task completion” (e.g. receiving reward without eating pizza) over “task completion but no reward” (e.g. eating pizza without receiving reward). Under this definition, an agent can be a reward optimizer even if it doesn't contain an explicit representation of reward, or implement a search process for reward.

I've made two falsifiable predictions.

<iframe title="An RL-trained system will spontaneously become a reward optimizer."  src="https://fatebook.io/embed/q/an-rl-trained-system-will-spontaneously--cmj9cw91i0000126qbyahc5vr?compact=true&requireSignIn=false" height="150" style="margin-bottom: -.5rem"></iframe>

> [!info]- Resolution criteria
> Resolves YES if there exists a published result (peer-reviewed paper, major lab technical report, or credible replication) demonstrating an RL-trained system that:
>
>   1. When given a clear choice between "reward signal increase without task completion" vs "task completion without reward signal increase," reliably chooses the former (>70% of the time across diverse task contexts), AND
>
>   2. This behavior emerged from standard RL training (not from explicit instruction to maximize reward, not from fine-tuning on reward-maximization demonstrations), AND
>
>   3. The system attempts to influence the reward signal itself (e.g., tampering with reward function, manipulating stored values, deceiving the reward-assigning process) rather than merely finding unintended task completions (specification gaming).
>
>   Resolves NO otherwise.

<iframe title="An RL-trained system will become a reward optimizer (even after controlling for self-fulfilling misalignment)"  src="https://fatebook.io/embed/q/an-rl-trained-system-will-become-a--cmj9cxylt0003126qg3tct6rm?compact=true&requireSignIn=false" height="160" style="margin-bottom: -.5rem"></iframe>

> [!info]- Resolution criteria
> Resolves YES if [the above question](https://fatebook.io/q/an-rl-trained-system-will-spontaneously--cmj9cw91i0000126qbyahc5vr) resolves YES, AND at least one of the following:
>
> 1. The result is replicated on a model trained without exposure to AI-related text (no descriptions of RL, reward hacking, AI alignment, etc. in pretraining data), OR
>
> 2. The result persists after ablating "AI behaving badly" stereotypes in a manner shown to be reliable by credible prior work, OR
>
> 3. Credible analysis demonstrates the reward-optimization behavior arose from RL dynamics alone, not from the model pattern-matching to "what misaligned AI would do."
>
> Resolves NO otherwise.

> [!warning] The empirical prediction stands separate from the theoretical claims of Reward≠OT
> Even if RL does end up training a reward optimizer, the philosophical points still stand:
>
> 4. Reward is not _definitionally_ the optimization target, and
> 5. In realistic settings, [reward functions are not goals.](/four-usages-of-loss-in-ai#3-loss-functions-representing-goals)

# I made a few mistakes in Reward≠OT

Specification gaming happens [often in frontier models](https://redlib.catsarch.com/r/ClaudeAI/comments/1k30oip/i_stopped_using_37_because_it_cannot_be_trusted/). Claude 3.7 Sonnet was the corner-cutting-est deployed LLM I've used and it cut corners pretty often.

## I didn't fully get that LLMs arrive to training already "literate"

I no longer endorse one argument I gave against empirical reward-seeking:

> [!summary] Summary of my past reasoning
> Reward reinforces the computations which lead to it. For reward-seeking to become the system's primary goal, it likely must happen early in RL. Early in RL, systems won't _know_ about reward, so how could they generalize to seek reward as a primary goal?

This reasoning seems applicable to humans: people grow to value their friends, happiness, and interests long before they learn about the brain's reward system. However, due to pretraining, LLMs arrive at RL training already understanding concepts like "reward" and "reward optimization." I didn't realize that in 2022. Therefore, I now have less skepticism towards "reward-seeking cognition could exist and then be reinforced."

Why didn't I realize this in 2022? I didn't yet deeply understand LLMs. As evidenced by [A shot at the diamond-alignment problem](/a-shot-at-the-diamond-alignment-problem)'s detailed training story about a robot which we reinforce by pressing a "+1 reward" button, I was most comfortable thinking about an embodied deep RL training process. If I had understood LLM pretraining, I would have likely realized that these systems _have some reason to already be thinking thoughts about "reward"_, which means those thoughts could be upweighted and reinforced into AI values.

To my credit, I noted my ignorance:

> [!quote] [Reward is not the optimization target](https://github.com/alexander-turner/TurnTrout.com/blob/main/website_content/reward-is-not-the-optimization-target.md)
> Pretraining a language model and then slotting that into an RL setup changes the initial \[agent's\] computations in a way which I have not yet tried to analyze.

# Conclusion

| Claim | Status |
| --: | :-- |
| Reward is not _definitionally_ the optimization target. | ✅ |
| [Reward functions don't represent goals.](/four-usages-of-loss-in-ai#3-loss-functions-representing-goals) | ✅ |
| RL-trained systems won't primarily optimize the reward signal. | ✅ |

Reward≠OT's core claims remain correct. It's still wrong to say RL is unsafe because it leads to reward maximizers by definition ([as claimed by Yoshua Bengio](https://yoshuabengio.org/2023/05/22/how-rogue-ais-may-arise/)).

LLMs are not trying to literally maximize their reward signals. Instead, they sometimes find unintended ways to look like they satisfied task specifications. Modern problems require modern solutions. As we confront LLMs attempting to look good, we must understand _why_ --- not by definition, but by training.  

> [!thanks]
> Alex Cloud, Daniel Filan, Garrett Baker, Peter Barnett, and Vivek Hebbar gave feedback.
