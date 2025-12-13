---
title: LLMs cheat at tasks more than I expected / reward isn't necessarily the optimization target
permalink: llms-cheat-a-lot
no_dropcap: false
tags:
  - AI
  - reinforcement-learning
description: LLMs aim to "look good" more than I predicted in 2022, probably since I didn't get the significance of pretraining. Reward still isn't inherently the optimization target.
authors: Alex Turner
card_image:
card_image_alt:
aliases:
- llm-specification-gaming
- reward-retrospective
---

  

[Reward is not the optimization target](/reward-is-not-the-optimization-target) (which I wrote in 2022) made three main claims. The first two claims were true then and they're true now. The third claim was an empirical prediction with a mixed track record.

|                                                   Claim | Status |
| ------------------------------------------------------: | :----- |
| Reward is not _definitionally_ the optimization target. | ✅      |
|                          Reward functions aren't goals. | ✅      |
|   RL-trained systems won't primarily prioritize reward. | ⚠️     |

As consolation, the bitterness of admitting error in one claim is tempered by the correctness of the remainder. Consolation aside, I must note the misprediction, both as a matter of social account (so I may receive credit for the correct predictions and a debit for the misprediction) but also as a matter of understanding. If I erred, then why?

> [!quote] François de La Rochefoucauld
> No persons are more frequently wrong, than those who will not admit they are
wrong.

# Grading my claims

## 1: Reward is not _definitionally_ the optimization target

Subtitle: ✅ Theoretical point and correct independently of empirical results.

In common (policy-gradient) RL approaches, the mechanistic function of reward is to _reinforce_ computations which led to the reward. There is no intrinsic or definitional reason why the trained system should care about this "reward" quantity.

## 2: Reward functions aren't goals

Subtitle: ✅ Theoretical point and correct independently of empirical results.

The reward function isn't a good way to express "goals". The reward function is instead a tool which helps reinforce and chisel certain subroutines into trained systems.

## 3: RL-trained systems won't prioritize reward

Subtitle: ⚠️ Mixed.

In other words:  If you train a system with RL, it is quite unlikely to make decisions _primarily_ on the basis of increasing the future numerical value of its reward signal. This prediction breaks down into two sub-cases.

### 3a: Systems won't primarily try to look good instead of doing the task

Subtitle: ⚠️ Mixed.

For example, I said that after reinforcing an agent for eating pizza, that agent probably won't choose "receiving reward[^reward] without eating pizza" over "eating pizza without receiving reward".

"Specification gaming" involves optimizing to make the task _look_ complete to the supervisor, without actually doing the task. Such "specification gaming" happens [often in frontier models](https://redlib.catsarch.com/r/ClaudeAI/comments/1k30oip/i_stopped_using_37_because_it_cannot_be_trusted/), though they usually don't _primarily_ care about cheating.  Claude 3.7 Sonnet was the corner-cutting-est deployed LLM I've used. I would guess that in situations where cheating was obviously possible, it cheated in about 15% of completions.

### 3b: Systems don't change their reward function to output higher numbers

Subtitle: ✅ True so far.

In [Sycophancy to Subterfuge](https://arxiv.org/abs/2406.10162), Anthropic tried to gradually nudge Claude to eventually modify its own reward function. Claude nearly never did so (8/33,000, whereas I would have predicted about 128/33,000) despite the "reward function" [being clearly broken](https://www.alignmentforum.org/posts/FSgGBjDiaCdWxNBhj/sycophancy-to-subterfuge-investigating-reward-tampering-in?commentId=GQEZcovfaugLMAgAW). This could happen in the future, probably because of [self-fulfilling misalignment](/self-fulfilling-misalignment) about misaligned AIs caring about maximizing reward.

> [!question] How wrong were my predictions, exactly?
>
> I think claim 3 was somewhat wrong in spirit, but it's worth being clear about the letter of what I predicted.
>
> My 2022 post was technically about "reward" (the numerical quantity stored during training). As of 2025, LLMs don't prioritize this quantity. However, I think it's reasonable to read the post as being about "will the AI care about _looking like completing the task_?". I think I would have wrongly replied "probably not, since reward will likely reinforce computations related to directly completing the task".
>
> I could also defend: "sure, AIs often make decisions based on reward, but that's also part of what I predicted (see below)."
>
> > [!quote] [Reward is not the optimization target](/reward-is-not-the-optimization-target#anticipated-questions)
> >
> > I think that generally intelligent RL agents will have _secondary, relatively weaker_ values around reward, but that reward will not be a primary motivator. Under my current (weakly held) model, an AI will only start chiseled computations about reward _after_ it has chiseled other kinds of computations (e.g. putting away trash).
>
> I think we have seen LLMs which primarily care about _seeming_ like they've completed the task -- at least in some task contexts. But the contexts are limited --- if you ask the LLM to fix the error, it often will (as opposed to continuing to dig in). Does that limited scope mean the value is "weaker" than the instruction following? I think so, which would technically mean reality has fallen within the bounds I predicted.
>
> That said, the post's tone towards empirical specification gaming was significantly more aggressive than "it'll probably happen as a secondary consideration." I think I should lose points for that!

# I didn't fully get the implications of "LLMs can already read"

When rereading my post from 2022, _the reasoning (surprisingly) still seems correct_. :) Consider:

> [!quote] [Reward probably won’t be a deep RL agent’s primary optimization target](/reward-is-not-the-optimization-target#reward-probably-won-t-be-a-deep-rl-agent-s-primary-optimization-target)
> The reward chisels cognition which increases the probability of the reward accruing next time.
>
> Importantly, reward does not automatically spawn thoughts _about_ reward, and reinforce those reward-focused thoughts! Just because common English endows “reward” with suggestive pleasurable connotations, that [does not mean that](https://www.readthesequences.com/No-Universally-Compelling-Arguments) an RL agent will _terminally value_ reward!
>
> What kinds of people (or non-tabular agents more generally) will become reward optimizers, such that the agent ends up terminally caring about reward (and little else)? Reconsider the "eating pizza" situation, but instead suppose you were thinking thoughts like “this pizza is going to be so rewarding” and “in this situation, eating pizza sure will activate my reward circuitry.”
>
> You eat pizza, triggering reward, triggering credit assignment, which correctly locates these reward-focused thoughts as contributing to the release of reward. Therefore, in the future, you will more often take actions because you think they will produce reward, and so you will become more of the kind of person who intrinsically cares about reward. These updates will eventually lead towards reward-optimization and wireheading.
>
> While it's possible to have activations on "pizza consumption predicted to be rewarding" and "execute `motor-subroutine-#51241`" and then have credit assignment hook these up into a new motivational circuit, **this is only** _**one possible direction**_ **of value formation in the agent**. Seemingly, the most direct way for an agent to become _more_ of a reward optimizer is to _already_ make decisions motivated by reward, and then have credit assignment further generalize that decision-making.

However, I think that one of my assumptions was incorrect. I assumed that real-world RL systems wouldn't already be thinking about reward while completing their tasks.
  
[Models of late 2025 have _noticed_ that they are being trained and evaluated.](https://www.apolloresearch.ai/blog/claude-sonnet-37-often-knows-when-its-in-alignment-evaluations/) Further,[LLMs will often obey stereotypes about them expressed during training](/self-fulfilling-misalignment). Here are two hypotheses for why LLMs specification game relatively often:

1. _[Self-fulfilling misalignment](/self-fulfilling-misalignment)_. Thanks to pretraining, LLMs are specification gaming & reward tampering because that's a stereotypical activity for smart AI (["reinforcement learning trains agents to maximize reward"](/reward-is-not-the-optimization-target#appendix-the-field-of-rl-thinks-reward-is-the-optimization-target) repeated ad nauseum). Training awareness activates the conditional stereotype "if in training, then specification game." Reward reinforces that the AI's propensity to game specifications in more and more general situations.
2. _Direct reinforcement of computations about reward-seeking._ Thanks to pretraining, LLMs know that "reward" is a part of AI training. Training-aware LLMs therefore consider how to "get" reward while completing tasks. Reward reinforces those subroutines and so the system learns to get reward "on purpose."

Both hypotheses predict the recent spate of specification gaming. I expect that both mechanisms contribute. We can test these hypotheses right away, in fact! Here are two example experiments.

Hypothesis 1
: If real-world specification gaming is a consequence of [emergent misalignment](https://arxiv.org/abs/2502.17424), the broader "bad persona" would be lumping in "hardcode unit tests" as a stereotypically bad thing to do. We'd expect specification-gaming LLMs to also exhibit other "stereotypically misaligned" behaviors for moderately advanced AI systems, including increased [alignment faking.](https://www.anthropic.com/research/alignment-faking)

Hypothesis 2
: I'd expect the following procedure to reduce specification gaming:
1. Derive a "thinking about reward" steering vector, perhaps via difference-in-means, and
2. [Ablate that direction from the activations during training](https://arxiv.org/abs/2507.16795) to reduce the impact of that concept on its decisions.

Finally, "LLMs just explore into hardcoding tests and then are strongly reinforced" is possible and likely contributes. However, Anthropic [said](https://assets.anthropic.com/m/74342f2c96095771/original/Natural-emergent-misalignment-from-reward-hacking-paper.pdf) they had to do document finetuning to get a 2025-era base model to learn to flagrantly cheat tests. Via lots of RL on its own, the model wasn't exploring  enough into sufficiently aggressive hacks. (That said, perhaps an instruction-tuned model would cheat earlier and harder?)

# Could I have done better given my knowledge?

Subtitle: Yes. It is almost always possible to have done better.

One problem was that I didn't understand LLMs deeply yet. As evidenced by [A shot at the diamond-alignment problem](/a-shot-at-the-diamond-alignment-problem)'s detailed training story about a robot which we reinforce by pressing a "+1 reward" button, I was most comfortable thinking about an embodied deep RL training process. If I had understood LLM pretraining, I would have likely realized that these systems _have good reason to already be thinking thoughts about "reward"_, which means those thoughts could be upweighted and reinforced into AI values.

To my credit, I noted my ignorance!

> [!quote] [Reward is not the optimization target](https://github.com/alexander-turner/TurnTrout.com/blob/main/website_content/reward-is-not-the-optimization-target.md)
> Pretraining a language model and then slotting that into an RL setup changes the initial \[agent's\] computations in a way which I have not yet tried to analyze.

Without knowing that pretraining in particular was important, how could I have done better? I could have challenged the assumption directly: "For some reason, I strongly believe that AIs likely won't know about 'reward' and 'training' before they form values. Why do I believe this? If I were wrong about this, how surprised would I feel? What evidence supports this belief, and what weighs against? What are the most likely ways in which this could be wrong?".

# Conclusion
  
LLMs can strongly prioritize looking good to their supervisor. I was surprised in part because I didn't understand pre-training when I wrote the original post.

However, that post remains crucially important for its two other claims. It's _still_ wrong to say RL is unsafe because it leads to reward maximizers by definition ([as claimed by Yoshua Bengio](https://yoshuabengio.org/2023/05/22/how-rogue-ais-may-arise/)). It's _still_ [misguided to attempt to directly represent a goal via a reward function](/against-inner-outer-alignment#loss-doesn-t-have-to-represent-intended-goals).

| Claim | Status |
| --: | :-- |
| Reward is not _definitionally_ the optimization target. | ✅ |
| Reward functions aren't goals. | ✅ |
| RL-trained systems won't primarily prioritize reward. | ⚠️ |

> [!thanks]
> Alex Cloud and Garrett Baker gave feedback.
