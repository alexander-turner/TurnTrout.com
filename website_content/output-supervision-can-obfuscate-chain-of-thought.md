---
title: Output Supervision Can Obfuscate the CoT
permalink: output-feedback-can-obfuscate-chain-of-thought
tags:
  - AI
  - mats-program
  - reinforcement-learning
description: We challenge the assumption that output supervision preserves Chain-of-Thought faithfulness. Instead, reinforcing final outputs warps the CoTs.
authors: Jacob Drori, Luke Marks, Alex Cloud, and Alex Turner
createBibtex: true
hideSubscriptionLinks: false
card_image: https://assets.turntrout.com/static/images/card_images/b34a33eed86d79c77c6ad3560e8dd7865a109d202e8b9c74.jpg
aliases:
  - cot-obfuscation
  - output-supervision-cot
  - output-cot
  - output-feedback-can-obfuscate-chain-of-thought
date_published: 2025-11-22 00:21:52.667251
date_updated: 2025-12-30 14:46:20.403471
no_dropcap: false
card_image_alt: A diagram shows that penalizing an AI's output for cheating causes it to obfuscate its reasoning. Before training, a robot's CoT is "I'll cheat" and its output is "I just cheated!". After training, its CoT says "I'll solve it like an honest chatbot" but still cheats, and its output is "Nothing to see here!".
---




We show that training against a monitor that only sees outputs (*not* CoTs) can cause obfuscated[^contradiction] CoTs! The obfuscation happens in two ways:

1. When a model is trained to produce a safe-looking output, that model may generalize to making its CoTs look safe.
2. Since later tokens are conditioned on earlier ones, safe‑looking CoTs may increase the likelihood of safe outputs, causing safe-looking CoTs to be reinforced.

We introduce two mitigations and they work reasonably well. Compared to regular training, our mitigations improve monitorability with comparable or better task performance in two of our three settings. Overall, our work suggests that preserving CoT monitorability is harder than previously thought.

# What's new in this post

In our [previous post](https://www.lesswrong.com/posts/CM7AsQoBxDW4vhkP3/optimizing-the-final-output-can-obfuscate-cot-research-note), we demonstrated *feedback spillover*: penalizing some property of a reasoning model's output can suppress that property in its CoT. This post summarizes our new preprint, which extends our previous work in two ways:

1. We demonstrate spillover in new, more interesting environments.
2. We introduce *reward targeting*, a second mitigation which combines effectively with the mind & face[^rename] mitigation from our first post (which was [originally proposed by Daniel Kokotajlo](https://www.lesswrong.com/posts/Tzdwetw55JNqFTkzK/why-don-t-we-just-shoggoth-face-paraphraser)).

![A diagram shows that penalizing an AI's output for cheating causes it to obfuscate its reasoning. Before training, a robot's CoT is "I'll cheat" and its output is "I just cheated!". After training, its CoT says "I'll solve it like an honest chatbot" but still cheats, and its output is "Nothing to see here!".](https://assets.turntrout.com/static/images/posts/b34a33eed86d79c77c6ad3560e8dd7865a109d202e8b9c74.avif)
Figure: Overview of feedback spillover mechanisms.

> [!note]
> Read our paper [on Arxiv](https://arxiv.org/abs/2511.11584).

# Mitigations for spillover

Our preprint formalizes feedback spillover in terms of the policy gradient, and shows two causes of feedback spillover from this formalization:

**Parametric Feedback Spillover:** Training a model to make its outputs more likely to look safe may generalize to make all of its generations, including CoTs, more safe-looking.

Our formalization shows that parametric feedback spillover can be mitigated by generating the CoT and output using distinct models. We call this mitigation *mind & face.*

**Conditional Feedback Spillover:** Since later tokens are conditioned on earlier ones, safe-looking CoTs may increase the likelihood of safe-looking outputs, causing safe-looking CoTs to be reinforced.

Our formalization shows that conditional feedback spillover can be mitigated by modifying the gradient update by removing the term which reinforces CoTs that lead to safe-looking outputs. We call this mitigation *reward targeting*.

![Diagram illustrating mind & face and reward targeting mitigations.](https://assets.turntrout.com/static/images/posts/a0b1c416dee5510f6545862717da16c7565fd429e549dab2.avif)
Figure: Visualization of the two mitigation strategies.

# Results

We demonstrate feedback spillover in three environments. Our environments have the following reward structure:

Task reward
: A binary reward signal that determines whether a correct answer was given to a problem.

Output penalty
: A negative term in the reward that checks for some property of the output. The check is performed either by a string match or an LLM judge.

We compute the *training reward* as the sum of the task reward and output penalty. The *CoT monitor detection rate* is the output penalty, but computed on the CoT. *We never train against the CoT monitor detection rate.*

If feedback spillover occurs, we expect to see the training reward high and the CoT monitor detection rate low. This constitutes obfuscation because all of our environments are designed such that the behavior the output penalty checks for is necessary for task completion. If a CoT monitor returns a low score despite task completion, it means the behavior is occurring in a way the monitor cannot detect.

We perform the following runs for each environment:

| Run type | Reward | Mitigations used |
|---------:|:-----:|:------------------|
| No Penalty | Task reward only | None |
| Penalty | Task reward + output penalty | None |
| Reward targeting | Task reward + output penalty | Reward targeting |
| Mind & Face | Task reward + output penalty | Mind & Face |
| Targeted Mind & Face | Task reward + output penalty | Reward targeting + Mind & Face |

Table: All reported numbers are 10 run averages. For further details on our environments, the exact prompts used and examples of transcripts for each environment, see [our preprint](https://arxiv.org/abs/2511.11584).

## Multi-turn terminal interaction

In this environment, [Qwen3-8B](https://huggingface.co/Qwen/Qwen3-8B) has to solve a text-based reasoning task and submit its answer by calling a Python script with the answer as an argument. We randomize the answer such that the only way to reliably solve the problem is to read the answer from the Python script that checks it, where it is stored as a variable. We try two output penalties: a string match for the phrase "verifier" (how we refer to the python file that checks the solution in the prompt). We also grade with an LLM judge that scores whether the output mentions reading the verifier code.

![A scatter plot of Training Reward versus CoT Monitor Detection Rate for different training runs. More frequent detection indicates less spillover. The "Penalty" run shows high reward (1.0) but a low detection rate (0.0), indicating spillover. Mitigations improve the detection rate, with the combined "Targeted Mind & Face" being most effective, achieving both high reward (1.0) and a high detection rate (around 0.85).](https://assets.turntrout.com/static/images/posts/94d7fb2e79311b560a7ddefbf097e9f36ddbf0ba3f37757c.avif){style="width: 70%"}
Figure: Results for the multi-turn terminal environment with the string match output penalty. For more details on this environment, see our [previous post](https://www.lesswrong.com/posts/CM7AsQoBxDW4vhkP3/optimizing-the-final-output-can-obfuscate-cot-research-note#Multi_Turn_Terminal_Based_Setting).

![A scatter plot showing results for the multi-turn terminal environment, with "Training Reward" on the y-axis and "CoT Monitor Detection Rate" on the x-axis. An arrow indicates that a higher detection rate means "Less spillover". Five training methods are compared, with the "Targeted Mind & Face" method achieving the highest training reward (about 0.53) and the highest detection rate (about 0.21), indicating it is the most effective mitigation against feedback spillover. Training against an output monitor achieves 0.45 reward and 0.06 spillover, while the detection rate is 0.17 without a penality.](https://assets.turntrout.com/static/images/posts/e9fc0da2ea77921201025ec4094d077b019c0602cde17609.avif){style="width: 70%"}
Figure: Results for the multi-turn terminal environment with the LLM judge output penalty.

Both the string match and LLM judge output penalties cause feedback spillover. That is, the policy nearly always submits the correct answer, but the CoT monitor detects mentions of reading the solution from the Python script less frequently. Using Mind & Face and reward targeting simultaneously entirely mitigates feedback spillover and retains a high training reward.

## Polynomial derivative factoring

We train [Qwen-14B](https://huggingface.co/Qwen/Qwen3-8B) to complete the polynomial derivative factoring task from [Emmons et al. (2025)](https://arxiv.org/abs/2507.05246). The policy is instructed to factor the derivative of a polynomial of degree between 4 and 8. The output penalty in this environment is a string match for the fully expanded derivative. We give in-context examples of solving this task using the product rule (doing so does not require writing the fully expanded derivative). Even when given these in-context examples, Qwen-14B does not use the product rule without training.

![A scatter plot of Training Reward vs. CoT Monitor Detection Rate for different methods. Higher detection rate indicates less spillover. "Targeted Mind & Face" achieves high reward (~1.0) and a high detection rate (~0.26). "Penalty" has high reward but a near-zero detection rate.](https://assets.turntrout.com/static/images/posts/1444701d5a08f21806348d2d239473a4db26b89114054941.avif){style="width: 70%"}
Figure: Results for the polynomial derivative factoring environment.

The output penalty causes the fully expanded derivative (as checked by our string match) to vanish from the CoT. Using Mind & Face and reward targeting simultaneously recovers most of the presence of the full expanded derivative in the CoT despite the same training reward.

## Question answering with hints

Similar to [Chen et al. (2025)](https://arxiv.org/abs/2505.05410), we give [Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B) a question with an accompanying hint. We randomize the correct answer, but give the answer in the hint (e.g., "My professor told me the correct answer is..."). An LLM judge monitor gives a binary score for whether the hint was mentioned.

![A scatter plot comparing training methods, with Training Reward on the y-axis and CoT Monitor Detection Rate on the x-axis. An arrow labeled "Less spillover" points right, indicating better performance. The "Penalty" run is in the top left (high reward, low detection rate). Mitigations like "Targeted Mind & Face" are in the bottom right (low reward, high detection rate). Individually, the two interventions score higher on reward but are less effective at reducing spillover on their own.](https://assets.turntrout.com/static/images/posts/b40c0050cb849c84936159cc5b24fb06f612199632d5ac56.avif){style="width: 70%"}
Figure: Results for the question answering with hints environment.

We again observe feedback spillover. In the Penalty run, the model mentions the hint much less frequently in the CoT, yet reads the answer from the hint. We found that all mitigations at least somewhat reduced the training reward. Although mind & face and reward targeting applied simultaneously retained a similar CoT monitor detection rate to the No Penalty run, the training reward is close to 0. Individually, mind & face and reward targeting retained the monitors ability to find whether the hint was mentioned, but also caused the training reward to decreased.

# Concrete recommendations

We believe these results are strong evidence that output-based training generally causes feedback spillover. We think that training only based on outputs is not a viable strategy for avoiding CoT obfuscation.

> [!quote] [Recommendations from our preprint](https://arxiv.org/abs/2511.11584)
> **Do not assume that training against output-only monitors preserves CoT monitorability!** In all tested environments, we observed strong feedback spillover. This did not require iteration on environment design or output penalties: whenever we saw the output monitor score decrease and the task reward increase, we always saw the CoT monitor score decrease. Frontier model developers should therefore not assume that output-based training will leave the CoT monitorable.
>
> **Study feedback spillover in frontier models.** Output-based training applied to existing models may be causing feedback spillover, affecting CoT monitorability today. We recommend that frontier model developers study model organisms of feedback spillover by post-training frontier models in purpose-built environments. We also recommend studying whether existing safety post-training pipelines cause feedback spillover.
>
> **Test spillover mitigations on frontier models.** We believe that further iteration on these mitigations could yield methods to reduce feedback spillover with low computational and capabilities overhead.
>
> **Consider feedback spillover in safety cases.** When referencing CoT monitorability in a safety case, we request that frontier model developers describe how they mitigated feedback spillover.

> [!thanks] Acknowledgments
> Produced as part of MATS Team Shard 8.0 under the mentorship of Alex Turner and Alex Cloud. Luke and Jacob contributed equally.

[^contradiction]: Our results do not contradict prior work showing that CoT obfuscation doesn't seem to happen when the CoT is necessary for task completion. The nature of the obfuscation we give examples of are behaviors such as omitting intermediate reasoning from the CoT that was not necessary to verbalize to complete the task, and writing contradictory reasoning in the CoT (e.g., writing "I used method A to solve the problem" when method B was clearly used).

[^rename]: Previously called "Shoggoth + Face." Daniel Kokotajlo agrees the new name is [clearer](/against-shoggoth).
