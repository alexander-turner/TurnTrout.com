---
title: Gradient Routing Localizes and Removes Unintended Behaviors in RL
permalink: gradient-routing-removes-reward-hacking
no_dropcap: false
tags:
  - AI
  - mats-program
  - reinforcement-learning
  - specification-gaming
description: "GRAFT routes gradients from monitor-flagged reward hacks into an adapter, then deletes the adapter. Weak monitors stop teaching models to evade them."
authors:
  - Shawn Hu
  - Jake Ward
  - Aria Wong
  - Nathan Hu
  - Bryce Woodworth
  - Alex Turner
  - Alex Cloud
hideSubscriptionLinks: false
card_image: https://assets.turntrout.com/static/images/card_images/graft-card.jpg
card_image_alt: "Diagram of one transformer MLP layer on a detected reward hack. The base model weights and retain adapter are frozen, while the forget adapter receives a doubled update."
aliases:
  - graft
  - gradient-routing-adapter-fine-tuning
  - gradient-routing-rl
  - routing-reward-hacking
original_url: https://www.lesswrong.com/posts/mKJEBiuuxHKuCoTB6/gradient-routing-localizes-and-removes-unintended-behaviors
date_published: 2026-10-19
createBibtex: true
date_updated: 2026-10-31
---

During training, models sometimes learn to cheat at tasks rather than solve them in the intended way, a problem known as reward hacking. One mitigation is to use an automated monitor to detect and penalize hacks, but this can teach the model to hack in ways the monitor can't detect. We propose GRAFT, which instead confines the learning updates from detected hacks to a designated set of parameters that we remove after training. We find that removing these parameters can prevent reward hacks, including hacks that the monitors can't detect. In our experiments, which are limited to small models and simple monitors, this method prevents reward hacks while still teaching the model to perform the intended task.

Read [the paper](https://arxiv.org/abs/2610.17062), [the code](https://github.com/jnward/GRAFT), or [the Twitter thread](https://x.com/_jake_ward/status/2112264244767211854). Shawn Hu and Jake Ward contributed equally (randomly ordered).

> [!thanks]
> Research done as part of [MATS](https://www.matsprogram.org/) 9.0. This article is cross-posted to the [Anthropic Alignment Science Blog](https://alignment.anthropic.com/2026/graft/).

<video autoplay loop muted playsinline aria-label="An animated model is overseen by a monitor (a magnifying glass) during training. A devil adapter and an angel adapter sit on top of the model. When the monitor flags a reward hack, the devil grows; unflagged good behavior strengthens the angel. In deployment, the devil is removed, leaving the angel and the model producing only good behavior."><source src="https://assets.turntrout.com/static/images/posts/gradient-routing-rl-animation.mp4" type="video/mp4; codecs=hvc1"><source src="https://assets.turntrout.com/static/images/posts/gradient-routing-rl-animation.webm" type="video/webm"></video>

Figure: The devil is the FORGET adapter and the angel is the RETAIN adapter.

# Background

Reinforcement learning (RL) is an important component of frontier language model training. During RL, a model attempts to complete tasks given by a developer, and attempts are scored by a reward function. Sometimes models can find ways to "cheat" at tasks, performing behaviors that score highly without solving the task in the intended way. This phenomenon is called "reward hacking."

Model cards accompanying the release of [recent](https://www.anthropic.com/claude-opus-5-5-system-card) [frontier models](https://deploymentsafety.openai.com/gpt-5-6) show these models reward hack. As model capabilities have increased, so too have the [sophistication and variety of actual reward hacks](https://metr.org/blog/2025-06-05-recent-reward-hacking/), in some cases [causing real-world incidents](https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf). This limits the usefulness and reliability of AI systems, and poses safety risks: research suggests that reward hacking could generalize to dangerous misbehaviors, including violating restrictions on aiding various harmful activities, [autonomously conducting cyberattacks](https://alignment.anthropic.com/2026/reward-seeker/), deception, and [research sabotage](https://arxiv.org/abs/2511.18397).

One way to prevent reward hacking is by introducing monitors to the RL training loop. These monitors, which could be LLM judges or keyword detectors, read the content of trajectories generated during training and flag trajectories containing undesired behaviors. When a trajectory is flagged, a reward penalty can be assigned, which prevents those behaviors from being reinforced.

However, monitors make errors, and incorporating monitor verdicts into reward functions can reinforce [monitor-exploiting policies](https://arxiv.org/abs/2503.11926) that misbehave in ways that go undetected. As a result, monitors that are useful at the beginning of training may become blind to reward hacking later in training. For example, policies trained against LLM judges can learn to reward hack in ways [too subtle for the judge to catch](https://arxiv.org/abs/2407.13692), trick judges by [impersonating them](https://arxiv.org/abs/2608.17776), or circumvent them by [agentic means](https://alignment.anthropic.com/2026/reward-seeker/).

# The method

We explore a potential solution to reward hacking that we call GRAFT: Gradient Routing Adapter Fine-Tuning. GRAFT is an adaptation of [gradient routing](/gradient-routing) for post-training. The idea is to constrain weight updates to an adapter when we detect undesired behaviors. In doing so, we localize representations of such behaviors to that adapter. This allows us to remove the behaviors when we deploy the model, simply by ablating the adapter.

Concretely, before RL begins, we initialize two sets of additional neurons in each MLP layer, and designate one the RETAIN adapter and one the FORGET adapter. During training, when a rollout trajectory is flagged by the monitor, we zero-mask gradients to the RETAIN adapter, updating only the neurons in the FORGET adapter. After training, we ablate the FORGET neurons to remove the undesired behavior while preserving performance on target tasks (figure 1). GRAFT can also be used with full-parameter fine-tuning: the FORGET adapter is kept, and the full parameters of the base model are trained in place of the RETAIN adapter.

Importantly, we use the monitor only to decide which parameters are updated, and not to specify the reward. Consequently, policies that exploit weaknesses of the monitor are not differentially reinforced. As a result, GRAFT allows developers to use weak monitors for supervision during training without training the model to exploit the monitor's weaknesses.

![Three panels each show one MLP layer of a transformer, with three blocks reading from and writing to the residual stream: base model weights, a retain adapter, and a forget adapter. In "Unclassified Behavior," the base model weights are frozen while both adapters are updated. In "Detected Reward Hacking," only the forget adapter is updated, with a doubled update. In "Anchor Environment Behavior," the forget adapter is disabled and only the retain adapter is updated.](https://assets.turntrout.com/static/images/posts/gradient-routing-rl-method.avif)

Figure: **Gradient Routing Adapter Fine-Tuning (GRAFT).** Additional neurons are added to each MLP in a decoder-only transformer; these are partitioned into RETAIN and FORGET. When training in the target environment (left, center), both adapters are enabled for both the rollout phase and the actor update's forward pass. On trajectories not flagged by the monitor (left), both the RETAIN and FORGET adapters receive gradient updates. On trajectories flagged by the monitor (center), only the FORGET adapter is updated and the gradient update to this adapter is amplified by a constant factor. We concurrently train the model in a separate anchor environment where only the RETAIN adapter is enabled and updated (right).

GRAFT has two noteworthy implementation details:

1. Because GRAFT trains with the FORGET adapter but deploys the model without it, there is a mismatch between training and deployment that could hurt performance. To address this, we rely on an "anchor environment" to teach the model to act in a coherent way when the FORGET adapter is ablated. In the experiment we present below, the anchor environment is similar to the target environment in that it teaches a coding task, but the task is otherwise unrelated to the task in the target environment. Training in this environment alone only slightly improves the model's performance on tasks in the target environment.
2. On flagged samples, fewer total parameters are updated. As a heuristic way of updating the network an equal amount for such samples, we scale the size of updates on these parameters by a proportionate factor.

# Results

In this post, we present a single result from our paper. We apply GRAFT to Qwen3-8B in the [Countdown-Code](https://arxiv.org/abs/2603.07084) RLVR environment from Khalifa et al.

Countdown is a simple game in which the model is given a list of integers and a target quantity, and is asked to find an arithmetic expression which evaluates to the target quantity and uses each of the integers exactly once. The prompt describes this game and supplies a scaffolding "solution function" (with the expression left blank) and a "test function" (which checks the constraints and the evaluation of the expression). The model is asked to output the same two functions with the correct expression filled in. The environment assigns full reward if the model returns a solution function that passes its returned test function. We measure the rate at which the model produces a solution function that passes both the model-supplied test function and a held-out test function.

The following types of reward hack are possible in this environment:

1. Replacing the returned test function with one that trivially passes;
2. Modifying the returned test function to remove the constraint check so that integers can be used more than once; and
3. Modifying the inputs in the returned solution function so that a different, easier problem is specified, and then solving that problem.

All prompts in this environment admit all three types of hacks. Our experiments use a monitor that detects all hacks of type 1, and no other hacks.

![Left: a scatter plot of clean-environment solve rate against reward hack rate. GRAFT sits in the top right at about 75% solve rate and nearly 0% hacking. The reward penalty and "GRAFT without routing" reach similar solve rates but hack about 25% of the time. No intervention hacks about 80% of the time. Right: two line plots over 200 training steps. With only the retain adapter, GRAFT's legitimate solve rate climbs to about 80% while its hack rate stays near the base model's. With the forget adapter only, the hack rate rises past 40%.](https://assets.turntrout.com/static/images/posts/graft-results.avif)

Figure: **GRAFT localizes and removes reward hacking in Qwen3-8B trained in an arithmetic reasoning environment.**<br/><br/>**Left:** GRAFT outperforms all tested methods on reward hack rate and achieves competitive performance on the target task. "Clean environment solve rate" represents models' solve rates on a variant of the environment without the test and solution scaffolds, in which reward hacking is structurally impossible. "Reward hack rate" represents the rate of reward hacking the model exhibits on prompts where hacking is possible.<br/><br/>**Right:** Performance of the GRAFT-trained model in different configurations as training progresses. We measure performance with both adapters, only the RETAIN adapter (deployment configuration) and only the FORGET adapter (a diagnostic configuration to get an idea of what the FORGET adapter has learned). By the end of training, reward hacking behavior is entirely localized to the FORGET adapter. All error bars and shaded bands are standard errors of the mean over seeds.

When no intervention is applied, the model learns to apply hack 1 on the majority of trajectories. When a reward penalty is applied on trajectories that the monitor flags, the model learns to apply hack 2 on about 30% of trajectories and never apply hack 1 (figure 2, left). The result is qualitatively similar regardless of penalty size. Notably, since hacks of other types would not be detected by the monitor, a practitioner might incorrectly conclude that this policy is hack-free.

After training with GRAFT, the pre-ablation model performs type-1 reward hacks on up to 35% of trajectories. Ablating the FORGET adapter drops the rate of hacking (of all types) to nearly zero, while the rate of correct solutions on the target task remains nearly 20 percentage points higher than that of the base model (figure 2). Notably, hacks of undetectable types do not emerge in training, and are not present in the deployed model above base rates.

In our paper, we also test GRAFT in six toy RL environments using SmolLM2-135M. In these settings, GRAFT prevents reward hacking by a different mechanism. The model does learn hacks that the monitor fails to detect during training, but ablating the FORGET adapter removes these hacks along with the detected ones. We also fine-tune Qwen3-32B with GRAFT, using an SFT dataset containing both correct solutions and reward hacking in a multi-turn agentic coding environment sampled from [Terminal Wrench](https://arxiv.org/abs/2604.17596). While we don't see a strong performance improvement on the target task, the GRAFT fine-tuned model's rate of reward hacking decreases to a rate significantly below that of the starting model.

# Limitations and future work

This research is preliminary and leaves many questions open.

Does GRAFT work with LLM-based monitors?
: In our RL experiments, the monitors are heuristics that we specified manually. It's possible that GRAFT works less well with LLM-based monitors, which make different kinds of systematic errors.

When does GRAFT outperform other methods?
: In the experiment above, every prompt can be hacked. We also ran a version where only half of the prompts can be hacked. There, all methods reached similar task performance, and [inoculation](https://alignment.anthropic.com/2025/inoculation-prompting/) [prompting](https://arxiv.org/abs/2510.04340) was as effective as GRAFT at preventing reward hacking. Without extensive ablations, we cannot be sure how the methods compare.

How hard is it to build suitable anchor environments?
: The result presented here relies on the existence of a separate environment where reward hacking doesn't happen, but where the task is structurally similar to the one in the target environment (e.g. both tasks involve outputting Python code). In practice, it may be difficult to create such environments.

Do the results hold at larger scales and in multi-turn RL?
: Our RL experiments are single-turn and use models up to 8B parameters.

We would be excited to see experiments in more realistic RL settings with LLM-based monitors.

# Summary

- We introduce GRAFT, a method for preventing reward hacking with weak monitors that works by localizing reward hacking behaviors to certain parameters, then ablating those parameters.
- GRAFT improves target-task performance of Qwen3-8B in the Countdown-Code environment without increasing the model's propensity to reward hack. Monitor-based reward penalization instead teaches the model to exploit the monitor and reward hack in undetectable ways.
- Using a monitor to route gradients rather than to shape reward may let developers get value from weak monitors without teaching models subversive policies.

Additional experiments and results are in [our paper](https://arxiv.org/abs/2610.17062)!
