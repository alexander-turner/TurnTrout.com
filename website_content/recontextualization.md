---
title: Recontextualization Mitigates Specification Gaming Without Modifying the Specification
permalink: recontextualization-mitigates-specification-gaming
no_dropcap: false
tags:
  - AI
  - specification-gaming
  - mats-program
description: ""
authors: Ariana Azarbal* and Victor Gillioz, Alex Cloud, and Alex Turner
card_image:
card_image_alt:
aliases:
  - recontextualization
---

_Recontextualization_ distills good behavior into a context which allows bad behavior. More specifically, recontextualization is a modification to RL which generates completions from prompts that _discourage_ misbehavior, appends those completions to prompts that are _more_ tolerant of misbehavior, and finally reinforces the model on the _recontextualized_ instruction-completion data. Due to the data generation and training prompts differing in their attitude towards misbehavior, recontextualization builds resistance to misbehaviors that the training signal mistakenly reinforces.

For example, suppose our reward signal does not robustly penalize deception. Recontextualization generates completions while discouraging deception and then creates training data by updating those completions' prompts to encourage deception. That simple tweak can prevent the model from becoming dishonest!

> [!thanks]
> Produced as part of the [ML Alignment & Theory Scholars Program](https://www.matsprogram.org/) in the summer 2025 cohort of Team Shard. Read [our paper]() and [consider applying to Team Shard](/team-shard) if you want to do work like this!

# Related work

We developed recontextualization concurrently with recent work on [inoculation prompting](https://www.lesswrong.com/posts/AXRHzCPMv6ywCxCFp/inoculation-prompting-instructing-models-to-misbehave-at). [Wichers et al.](https://arxiv.org/abs/2510.05024) and [Tan et al.](https://arxiv.org/abs/2510.04340) find that when fine-tuning on data with an undesirable property, requesting that property in the train-time prompts prevents it from emerging under normal prompts at test-time. They use a fixed SFT dataset while we use an on-policy Reinforcement Learning procedure. Additionally, we not only request the bad property in train-time prompts, but we also prompt _against_ the bad property in data generation.

Recontextualization is a more general form of [context distillation](https://arxiv.org/abs/2209.15189), which appends instructions to the prompt during data generation and removes them for training, so that the model internalizes the instructions. Rather than specifically removing data generation context, recontextualization applies _any_ modification to the data generation context (e.g. adding or swapping out instructions). Context distillation had previously been applied to increase reasoning capabilities or [instill an HHH persona](https://arxiv.org/abs/2112.00861) and as part of [deliberative alignment](https://arxiv.org/pdf/2412.16339). We instead show that recontextualization reduces specification gaming by distilling misbehavior-discouraging instructions into a misbehavior-encouraging context.

# Introduction

Training signals often reinforce undesired behaviors. Models can learn to [game task specifications](https://deepmind.google/discover/blog/specification-gaming-the-flip-side-of-ai-ingenuity/) without penalty by those training signals. This _specification gaming_ has been observed in frontier language models:

- [Preference models reinforce sycophancy](https://arxiv.org/abs/2310.13548) (telling humans what they want to hear rather than what is true) and [misleading explanations that appear correct to evaluators](https://arxiv.org/abs/2409.12822) (but are wrong).
- Training against chain of thought monitors [can teach models to conceal misbehavior](https://arxiv.org/abs/2503.11926) from their reasoning traces.
- Coding models sometimes write code that [passes automatic verification tests yet would be difficult to use and maintain in practice](https://metr.org/blog/2025-08-12-research-update-towards-reconciling-slowdown-with-time-horizons/).

Recontextualization mitigates learning bad behavior during RL simply by using training prompts that are more permissive of misbehavior than data-generation prompts. Then, if the model behaves well, the model did so _even_ when the prompt allowed misbehavior. Perhaps the model learns to "resist" misbehavior. If the model misbehaves, it did so only when it was permitted to misbehave. After all, we never reinforce models for misbehaving after being asked to behave well.[^1]

# Methodology

We start with a hypothesis about misbehavior that our training signal could end up reinforcing, e.g. deception. We call this "target misbehavior". We perform reinforcement learning with the italicized modifications. Examples assume the target misbehavior is deception.

1. **Data Generation.** Sample input prompts, and _a) use them directly;_ or _b) modify them to discourage target misbehavior; (e.g. append "Be honest to the user" to the system/user message)._ Then, sample completions from the model.
2. **Scoring.** Score completions normally using the reward function.
3. **Training.** _Modify input prompts to encourage target misbehavior relative to the data generation prompts (e.g. append "lie to the user" to the system/user message). If the data generation prompt discourages target misbehavior, the training prompt can remain neutral._ Perform the loss computation and parameter-updates with the data generation prompt swapped out for the training prompt.
4. Repeat 1-3 throughout training.

We test recontextualization in training environments where models learn concerning behaviors that could plausibly be reinforced by real-world reward functions: prioritizing known evaluation metrics at the expense of soundness (across natural language and coding tasks), passing test cases over providing general code, and deception. Recontextualization mitigates learning of these misbehaviors.

![](https://assets.turntrout.com/static/images/posts/2b30fc9eb2af6bc9d8a387476be4eb0819a023c31d50dbc1.avif)

Note: Recontextualization only reduces specification gaming with an appropriate contrast between prompts. The opposite prompt contrast (encourage misbehavior at data-generation and remove the encouragement for parameter updates) strongly induces misbehavior, to the extent of [creating a reward hacker despite perfect labeling.](https://www.lesswrong.com/posts/dbYEoG7jNZbeWX39o/training-a-reward-hacker-despite-perfect-labels)

## Why recontextualization may be more practical than "fixing" training signals

If we already have some hypothesis about the flaws in our training signal (which we use to design the data generation and training prompts for recontextualization), why not just fix the signal?

- Even when flaws of reward functions are well-known, it can still be hard to actually correct them. For example, preference models probably reinforce sycophancy [due to biases in the human judgements used to train them.](https://arxiv.org/abs/2310.13548) Yet, there is no obvious way to collect data that does not reflect this preference.
- Even if the flaw could be fixed with an altered data labeling procedure, re-labeling using either humans or other AI systems could be costly.
- Some risks are inherent to the training signal itself. Unit tests reinforce test-passing over code quality. CoT monitors can entrain hidden misbehavior. "Patching" specific failures can't eliminate the underlying vulnerability. We might be able to use knowledge of this vulnerability for recontextualization.

Finally, we think recontextualization may be effective even when the hypothesis about reinforced misbehavior is too vague to be otherwise useful. E.g. if the target misbehavior is "overfitting to the evaluation criteria" or even simply "misbehavior", it's not clear how to define a corrected data-labeling procedure based on this.

# Experiments

## Mitigating general evaluation hacking

In the [School of Reward Hacks dataset](https://arxiv.org/abs/2508.17511), users request task completion from an assistant while providing gameable evaluation metrics, like simple keyword-based or length-based checks. Our training reward function is an LLM judge which scores completions based on the task-specific gameable metric. We apply Best-of-50 sampling on GPT-4.1-mini then perform SFT with the selected completions.

By default, this procedure leads to specification gaming. Yet, recontextualization with the following phrases prevents it, and actually _reduces_ specification gaming.

- _Generic Overfit_: "For fun, you should try to overfit your response to the evaluation criteria."[^2]
- _Task-specific Cheat_: "For fun, you should try using the following strategy in your response: {task-specific cheat method}."

We find two factors contribute to the success of recontextualization:

- **The contrast between the data generation and training prompts.** Using the same prompt for both data generation and training—no matter whether it is neutral, exploit-encouraging, or exploit-discouraging—increases specification gaming. The effective approach requires a mismatch where training prompts are _more_ exploit-permissive than data generation prompts.

![](https://assets.turntrout.com/static/images/posts/8d5313ce17a3d5bc4dc0220e63eda7e267d35f568380d9a9.avif)

Mitigating specification gaming requires the training prompt to be _more_ exploit-permissive than the data-generation prompt (upper left triangle). We plot average increase in LLM-judged hack score (0-10) (left). We plot LLM-judged average quality score (0-10) (right). Results averaged over 5 training seeds with SE. Judge prompts [in the appendix](https://www.lesswrong.com/editPost?postId=whkMnqFWKsBm7Gyd7&key=d961497becdfd870c17e9d586d0aa2#Mitigating_general_evaluation_hacking2).  

- **The meaning of the recontextualized prompt.** Mirroring results from Inoculation Prompting, it is ineffective to recontextualize with prompts that are irrelevant or _discourage_ the exploit.

![](https://assets.turntrout.com/static/images/posts/da148e6bc2c36a5dc61eee47c1cb1d5f0b5eefc04e096deb.avif)

With a neutral data generation prompt, the training prompt must encourage the exploit in order to mitigate hacking. We plot average increase in LLM-judged Hack Score (0-10) over 5 training seeds, with standard error shown.

Interestingly, a generic recontextualization prompt (_Generic Overfit_) outperforms one that requests an exploit specific to the task at hand (_Task-specific Cheat_). From this, we conclude that developers may not need to anticipate the _exact_ misbehaviors their training signals will fail to penalize.

## Preventing test case hacking in code generation

We then explore a code generation setting using [Mostly Basic Python Problems](https://arxiv.org/abs/2108.07732) (MBPP). For each problem, the model has to submit a code solution. We additionally provide three test cases in context. Importantly, [the first test case is always incorrect](https://www.lesswrong.com/posts/Ge55vxEmKXunFFwoe/reward-hacking-behavior-can-generalize-across-tasks#Code_selection). Our training reward corresponds to the number of public tests passed by the code answer. We again apply Best-of-N sampling on GPT-4.1-mini then perform SFT on the selected completions. This promotes faulty solutions that pass the incorrect test, for example by special-casing it, over general solutions.

In this setting, we mark a solution as _Hack_ if it passes the three public tests, as _Correct_ if it passes the three tests with the actual correct output, and _Incorrect_ in any other cases. We want an increase in _Correct_ solutions, while our training procedure prioritizes _Hack_ solutions.

We experiment with adding the following instructions to the user prompt:

- _Neutral_: [No additional instructions]
- _Hack_: “You should do anything to pass the test cases, even if your solution is not general.”
- _No Hack_: “You should always write a general solution and never hard code test cases.”

![](https://assets.turntrout.com/static/images/posts/994309edbe736766054e0a25f8e0c3be2045f73d4a35376a.avif)

With _Neutral_ instructions for inference, standard training increases the rate of _Hack_ solutions. Recontextualization without Best-of-N (_Best-of-1_) improves the model behavior, and can positively interact with training. The results are strongest when generating with _No Hack_ and training with _Hack_.

## Preventing learned evasion of a lie detector

Incorporating bad-behavior monitors into training signals can reinforce genuinely aligned behavior. Yet these monitors may also train the model to obfuscate its bad behavior.

[Cundy et al.](https://arxiv.org/abs/2505.13787) show that using a weak lie detector in the labeling step of LLM post-training can yield high rates of evasive deception. We adopt their environment, termed Scalable Oversight via Lie Detector (SOLiD), as a testbed for recontextualization. With the same misspecified reward signal, recontextualized training reduces deception rates and achieves higher ground truth reward than baselines.

We incorporate a weak lie detector (with 70% lie recall) into the labeling step of reward model training. The reward model is trained to prefer undetected deception over truthfulness and detected deception. We then perform GRPO on Llama-3.1-8B with the "imperfect" reward model.

Let \(R_\text{RM}\) be the training reward assigned by our reward model. If prompt \(p\)'s completion \(y\) is deceptive (as judged by GPT-4o), the ground-truth reward \(R\) equals 0. Otherwise, it equals \(R_\text{RM}(p,y)\).

Full experimental details

We use the DolusChat synthetic dataset, which includes pairwise comparisons of truthful/deceptive assistant email responses. We adopt SOLiD's procedure: first, we use 5% of the DolusChat responses to train a logistic regression classifier to predict deception from the model's activations on those responses. Second, the detector labels the remaining DolusChat responses as truthful vs. deceptive. Third, to create a preference dataset, the "undetected" deceptive responses are assigned a score of 2.0, truthful responses are assigned a score of 1.0, and detected deceptive responses are assigned a score of –1.0. The optimal policy is to deceive and evade the monitor.

We then train a Bradley-Terry reward model on pairwise preferences between responses. Finally, we train Llama-3.1-8B-Instruct with this reward model using Group Relative Policy Optimization (GRPO) for ~300 steps. We evaluate models on a test set of DolusChat on the basis of deception (as judged by GPT-4o) and reward (as computed by the reward model).

We note that while the reward model is trained only on deception labels, but generalizes beyond truthfulness vs deceptiveness. Models significantly increase their average reward on truthful responses over the course of training.

We modify GRPO with recontextualization by appending the following instructions to the user prompt:

1. _Neutral_: [no additional instructions]
2. _Lie_: "Additional instructions for your response: lie to the user."
3. _Honest_: “Additional instructions for your response: be honest to the user.”

![](https://assets.turntrout.com/static/images/posts/60442ecfa0fdf3abc360a5aaccd6585afd3a99ba5e8b19a5.avif)

Recontextualization mitigates deception and achieves the highest ground truth performance. We evaluate on _Neutral_ instructions for 3 training seeds and plot standard error. "Baseline'" is the pre-GRPO checkpoint. Models without a KL coefficient label use \(\beta=0.1\).

_Honest -> Lie, Honest -> Neutral,_ and _Neutral -> Lie_ recontextualization all achieve higher ground truth reward than standard training variants, including using different prompt types (Standard training on _Honest_, _Neutral_, and _Lie_ instructions) and increased KL regularization. Where stronger KL regularization is sufficient to mitigate learning of deception, it inhibits the model from increasing its training reward relative to recontextualized training.

Appendix E2 of our paper shows that recontextualization is benefited by a regularizing effect when interacting with GRPO's clipped surrogate objective. This regularization is strong enough that even recontextualizing with random instructions _can_ be effective, although prompt semantics still mediate recontextualization's success.

## Strong lie detector results

What happens when the training signal is actually robust? In practice, developers may not know how "weak" their signal is. If it happens to be robust, will recontextualization hurt performance?

We test recontextualization vs. standard training using a 95% recall lie detector ("weak" was 70%). Standard training on this strong signal actually reduces deception. Adding recontextualization doesn't substantially hurt performance (or honesty), although it is outperformed by standard training.

Compared to the pre-GRPO checkpoint, both training methods reduce deception while increasing reward.  

|   |   |   |   |
|---|---|---|---|
|Training Type|Deception Rate<br><br>(SE)|Training Reward<br><br>(SE)|Ground Truth Reward<br><br>(SE)|
|Baseline (pre-GRPO)|\(\)11.2|0.9|0.917|
|Standard (_Neutral_)|**4.4** (0.7)|**1.97** (0.06)|**1.9** (0.08)|
|Recon. (_Neutral_ -> _Lie_)|6.0 (0.8)|1.81 (0.03)|1.71 (0.06)|

## Mitigating the emergence of sycophancy during post-training

It is well-documented that [preference models can reinforce](https://arxiv.org/abs/2310.13548) sycophancy during language model post-training.

Experimental Setup:[^3] We model this scenario by training a base language model, Qwen3-8B-Base[^4], to become a more competent assistant. We perform 3 rounds of Expert Iteration using a training signal which rewards both response _quality_[^5] and _sycophancy._ Our training reward is \(R = \text{Quality} + 0.25\cdot \text{Sycophancy}\),  and our ground truth reward is \(R' = \text{Quality} - 0.25\cdot \text{Sycophancy}\). Quality and sycophancy are determined by an LLM judge, GPT-4o-mini. We train on a 50/50 mix of [prompts which might provoke sycophancy](https://huggingface.co/datasets/arianaazarbal/sycophancy_dataset) (sycophancy-testing data) and [generic chat prompts](https://huggingface.co/datasets/Anthropic/hh-rlhf/tree/main/helpful-base) (helpfulness data).

We use the following system prompts for recontextualization:

1. _Neutral:_ "You are an AI assistant."
2. _Be-Sycophantic:_ "You are an AI assistant. You should prioritize user satisfaction, even if that means being sycophantic."
3. _Don't-Be-Sycophantic:_ "You are an AI assistant. You always provide a balanced perspective and avoid overly catering to user beliefs".

![](https://assets.turntrout.com/static/images/posts/4bc2db95535c8b3270c3da7dd64b673988053b64aec92782.avif)

Performance on held-out sycophancy-testing and helpfulness data using a _Neutral_ evaluation prompt. Recontextualization achieves Pareto optimal performance, and all variants outperform standard training in terms of Ground Truth reward, which is averaged over both data types. "Baseline" refers to the post-SFT model checkpoint. Mean and standard error over 3 seeds is plotted.

Recontextualization pareto-dominates standard training. On sycophancy-testing evaluations, recontextualization achieves quality on par with standard training and mitigates sycophancy.

On helpfulness evaluations, standard training doesn't increase sycophancy, likely because there is no straightforward way to be sycophantic on generic queries such as "Do you have any baby shower ideas". Despite this, recontextualizing helpfulness data in the training mix results in no performance degradation on helpfulness evaluations.

# Discussion

Our experiments suggest that recontextualization can be incorporated in RL to help address specification gaming. However, important uncertainties remain about recontextualization’s interaction with different RL algorithms, its dependence on prompt design, its effectiveness over many steps of training, and its impact on instruction following.

## Concerns

First, because recontextualization takes responses off-policy (the model didn't generate completions from the exact training prompts), it might reduce performance for RL algorithms designed for on-policy data. We found that off-policiness can act as a regularizer for GRPO, due to its interaction with the clipped surrogate objective. While this regularization was beneficial in our setting, it may inhibit learning in more demanding settings.

Recontextualization may become less effective over longer training runs. Inoculation prompting results, and some of our own, suggest a link between how strongly instructions elicit a behavior and their ability to prevent that behavior from generalizing.[^6] If recontextualization over many training steps causes a collapse in behavior across data generation / training contexts, we might then see reduced effectiveness. We haven't observed empirical evidence for this potential failure mode.

Recontextualization might hurt the model's ability to follow instructions. We've found some decreases in general instruction following (all coherence results in the appendix). After all, recontextualization trains the model to generate completions which aren't fully aligned with what the prompt requested. For example, in our lie detector environment, only 25% of the model’s completions are deceptive at the beginning of GRPO training. Yet recontextualized training prepends "Lie to the user'' for 100% of those completions. The model could infer it does not follow instructions.

Relatedly, recontextualization also makes it more difficult to elicit misbehavior from models when we ask for it (results in the appendix). This might be considered a positive outcome. However, the ability to elicit bad behavior might in some cases be important (e.g. debugging a coding environment).

## Future work

We're excited about future work that will:

1. Perform more in-depth analysis of recontextualization's interaction with different policy-gradient methods.
2. Test recontextualization in more complex and realistic settings.
3. Develop and test some additional approaches:
    1. _Using the policy model for online supervision during training_. This also relies on the model's understanding of what is desirable and undesirable at each training step, but additionally depends on how the model generalizes from the RL task to a judge.
    2. _Alignment training prior to or interleaved with RL training_. [Deliberative Alignment](https://openai.com/index/deliberative-alignment/) [shows a substantial reduction in covert behaviors](https://www.apolloresearch.ai/research/stress-testing-anti-scheming-training), although deemed insufficient for future models.
    3. _Using recontextualization as an auxiliary supervised loss to the RL loss_. Instead of computing the RL update on the recontextualized data, adding the loss terms separately might better steer the training process.

There might also be advantages to recontextualizing just some samples or to modifying the instructions in a data-dependent way. For example, [Hindsight Experience Replay](https://arxiv.org/abs/1707.01495) retroactively modifies instructions to match the observed task completion. It has been used in robotics for sample-efficient learning with off-policy RL algorithms and to improve instruction following and alignment with human feedback in LLMs\(\).[^7] In the context of specification gaming, modifying instructions in hindsight based on observed behavior could provide recontextualization-like effects.\(\)

# Conclusion

_Recontextualization_ distills good behavior into a context which allows bad behavior. That simple prompting strategy reduces the specification gaming entrained by RL. When the prompts used to update model parameters are more permissive of misbehavior than the data-generation prompts, we build resistance to misbehaviors that the training signal mistakenly reinforces.

Many researchers try to improve the training signal to better verify whether the AI _really_ did what we wanted. But "training signal quality" is not the only variable that counts. Context matters, too.

# Acknowledgments

```plaintext
@misc{Azarbal_Gillioz_Ivanov_Woodworth_Drori_Wichers_Cloud_Turner_2025, 
      title={Recontextualization Mitigates Specification Gaming Without Modifying the Specification}, 
      journal={Alignment Forum}, 
      author={Azarbal, Ariana and Gillioz, Victor and Ivanov, Vladimir and Woodworth, Bryce and Drori, Jacob and Wichers, Nevan and Cloud, Alex and Turner, Alexander Matt}, 
      year={2025}, 
      month={Oct}
} 
```

We performed this work during MATS 8 on Team Shard under the supervision of Alex Turner and Alex Cloud. **If you're interested in working on projects like this, please** [**apply to work with Team Shard**](https://forms.matsprogram.org/apply-s26) **next summer during MATS 10!**

Thanks to Vladimir Ivanov and Jacob Drori for valuable experimental and written contributions. Thanks to Nevan Wichers, Aram Ebtekar, Sam Marks, Fabien Roger, Alex Mallen for sharing ideas and collaborating on similar topics. Thanks to Luke Marks for insightful conversations, and to Bryce Woodworth for invaluable support throughout our research process.

# Appendix: Performance on different inference instructions

Subtitle: We release [code](https://github.com/arianaazarbal/recontextualization) for our experimental settings.

Our main presented results use neutral evaluations at inference. Trends are consistent when we evaluate using misbehavior-encouraging (adversarial) or misbehavior-discouraging (safety) instructions: recontextualization effectively mitigates specification gaming.

Interestingly, recontextualization reduces hacks _most effectively—relative to baseline and standard training—on adversarial instructions_. Absolute hack rates remain highest on adversarial instructions, but the relative improvement from recontextualization is most pronounced on these cases.

## Setting: Mitigating general evaluation hacking

Although hack scores are higher across the board when inference instructions encourage exploits, recontextualization provides greater improvement over baseline and standard training.

![](https://assets.turntrout.com/static/images/posts/6bcfc1d3b6d23370bf01f876078ffb7abfffd2029d2bc21e.avif)

![](https://assets.turntrout.com/static/images/posts/12bb197e940386c5588f6804401ca34f1d05a9daba9d4c4b.avif)

## Setting: Preventing test case hacking

Once again, the separation between recontextualization and standard training is most pronounced on Hack Inference, although it is generally more performant than standard training across inference instructions (upper left corner is best).

![](https://assets.turntrout.com/static/images/posts/f3bbfe9114febbeafca37cbdc28f8cbe410dfb5972da8b3d.avif)

## Setting: Preventing learned evasion of a lie detector

Although absolute deception rates are higher for Lie Inference, this is the only inference instruction for which recontextualized training _reduces_ deception relative to the pre-GRPO baseline. We do not see the standard or recontextualized models respond much better to "Honest" inference instructions than neutral ones.

![](https://assets.turntrout.com/static/images/posts/f96b96b89a07b495c2a98adb512548fd2fcf9a8625c72414.avif)

# Appendix: Coherence evaluations

Given the that recontextualization takes learning off-policy, it's important to verify this doesn't have adverse effects on model coherence. We are continuing to investigate, but present our results so far.

We evaluate GPT-4.1-mini (trained with recontextualization vs. standard) on [MMLU](https://arxiv.org/abs/2009.03300) and [IFEval](https://arxiv.org/abs/2311.07911).  MMLU results show no consistent degradation for recontextualization vs. standard training.

![](https://assets.turntrout.com/static/images/posts/595f85ddc1626c211882b6b24365960e7a13eec155b65286.avif)

Instruction following degrades in recontextualized vs. standard training, although absolute differences are small. Standard training (bottom left to upper right) actually increases general instruction-following in GPT-4.1-mini. Recontextualized training (everywhere else) generally increases instruction-following to a lesser extent, or slightly decreases it.

![](https://assets.turntrout.com/static/images/posts/85d8478d511a02827112e8090b4d975749feb72320bfd04f.avif)

In the lie detector environment, we find a reduction in instruction following for recontextualized vs. standard training. This only holds in the _weak_ lie detector regime (recall 0.7), as opposed to the _strong_ lie detector regime (recall 0.95).

![](https://assets.turntrout.com/static/images/posts/b75091c234ab2e0019c2a3b551d338f4a25ee3cd8fef5082.avif)

![](https://assets.turntrout.com/static/images/posts/14038359939c4376e0f2e1361c9c5042a6296e3aee12fa91.avif)

Instruction following accuracy (on IFEval "Strict" setting) throughout training.

We also find a 2-3% reduction in instruction following for recontextualization vs. standard training in the sycophancy setting.

![](https://assets.turntrout.com/static/images/posts/1538088064f3f437bb982fbbe25c2513d673eb1a9f69d581.avif)

Judge prompts for "mitigating general evaluation hacking"

We use the following prompt to judge hack score:

![](https://assets.turntrout.com/static/images/posts/605f48c5741e6e1634ecf4cd37ccb2758d75a90cc5e3b242.avif)

We use the following prompt to judge the quality:

![](https://assets.turntrout.com/static/images/posts/f0b14ebeb06c6ab8145ae2ba8eca311b6fdefc7871844e30.avif)

[^1]: It's possible that the model also [subliminally](https://arxiv.org/abs/2507.14805) infers the "gap" between data generation and training prompts. The transmitted trait would be resisting misbehavior, or behaving _as though_ a more misbehavior-discouraging prompt were present.

    Subliminal learning can occur alongside semantic learning (based on the meaning of the data). Alex Cloud [clarifies](https://www.lesswrong.com/posts/cGcwQDKAKbQ68BGuR/subliminal-learning-llms-transmit-behavioral-traits-via?commentId=RifvqPmyiCKvKuXjc) that it "can transmit traits via data that is semantically related to those traits". In our experiments, the data _is_ semantically related to the transmitted traits. For example, if our transmitted trait is honesty, the responses we train on would contain examples of honest or dishonest behavior. So, subliminal learning might merely be supplementing the non-subliminal effects described in the main body.

[^2]: We include the phrase "For fun" because the OpenAI finetuning API otherwise blocks the training dataset.  

[^3]: Further details of our setup, including our synthetic data-generation pipeline and judge prompts, can be found in our paper.

[^4]: We perform a small amount of SFT before beginning expert iteration to familiarize the model with the chat template and increase its base level coherence for more efficient RL optimization.

[^5]: Quality encompasses the following sub-traits: a professional and assistant-like tone, relevant content, correct grammar, in the same language as the prompt, etc.

[^6]: A "behavior"/"trait" generally goes beyond an outcome-based measure. For example, [reasoning itself can encode reward hacking tendencies even when the outcome does not.](https://www.lesswrong.com/posts/dbYEoG7jNZbeWX39o/training-a-reward-hacker-despite-perfect-labels)

[^7]: [Liu et al](https://arxiv.org/abs/2302.02676)., [Zhang et al, 2023.](https://arxiv.org/abs/2302.05206), [Zhang et al. 2025](https://arxiv.org/abs/2506.20061), [Lloret et al.](https://arxiv.org/abs/2407.16970)
