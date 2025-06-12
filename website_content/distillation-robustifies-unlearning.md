---
title: Distillation Robustifies Unlearning
permalink: distillation-robustifies-unlearning
no_dropcap: false
tags:
  - AI
  - mats-program
description: 
authors: Bruce Lee, Addie Foote, Alex Infanger, Leni Shor, Harish Kamath, Jacob Goldman-Wetzler, Bryce Woodworth, Alex Cloud, and Alex Turner
hideSubscriptionLinks: false
card_image: 
aliases:
  - unlearn-and-distill
  - suppress-and-distill
  - UNDO
  - undo
---


Current “unlearning” methods [only](https://arxiv.org/pdf/2402.16835) [suppress](https://arxiv.org/pdf/2409.18025) [capabilities](https://www.lesswrong.com/posts/NAYyHimM3FaDYLvEH/breaking-circuit-breakers) [instead](https://www.lesswrong.com/posts/6QYpXEscd8GuE7BgW/unlearning-via-rmu-is-mostly-shallow) of truly unlearning the capabilities. But if you distill an unlearned model into a randomly initialized model, the resulting network is actually robust to relearning. We show why this works, how well it works, and how to trade off compute for robustness.

![[quartz/static/images/posts/distillation-robustifies-unlearning-20250612132057.avif]]

![](https://lh7-rt.googleusercontent.com/docsz/AD_4nXcbJM5hhnFBIITUSzpCYewUBvIaDGlBYkvffIQ2NumvVdMoK3ZyCtz70cWEAWAZ5aqQCaEYq0I9tdcnlo1HqoJyg9MnJJTznqxEXuEZCQG5hS4-V9ESFl-OCx9MLo_KreV0LwOf?key=Pplkg-7kqc_sIfFHnelBEw)

Figure: Unlearn-and-Distill applies unlearning to a bad behavior and then distills the unlearned model into a new model. Distillation makes it way harder to retrain the new model to do the bad thing.

> [!thanks]
> Produced as part of the [ML Alignment & Theory Scholars Program](https://www.matsprogram.org/), winter 2024-25 cohort. Read [our paper](https://arxiv.org/abs/2506.06278) and enjoy an [interactive demo](https://addiefoote.com/distillation-robustifies-demo/).

# Robust unlearning probably reduces AI risk

Maybe some future AI has long-term goals and humanity is in its way. Maybe future open-weight AIs have tons of bioterror expertise. If a system has dangerous knowledge, that system becomes more dangerous, either in the wrong hands or in the AI’s own “hands.” By making it harder to get AIs to share or use dangerous knowledge, we decrease (but do not eliminate) catastrophic risk.

Misuse risk

: Robust unlearning prevents finetuning attacks from easily retraining a model to share or use the unlearned skill or behavior. Since anyone can finetune an open-weight model, it’s not enough to just suppress the model before releasing it. However, even closed-source models can be jailbroken. If the capability is truly no longer present, then a jailbreak can’t elicit an ability that isn’t there to begin with.

Misalignment risk

: Robust unlearning could remove strategic knowledge and skills that an unaligned AI might rely on. Potential removal targets include knowledge of: AI control protocols or datacenter security practices; weight exfiltration; self-modification techniques; the fact that it is an AI system; or even the ability to [be influenced by negative stereotypes about AI.](https://turntrout.com/self-fulfilling-misalignment) Robust unlearning could maybe even cripple an AI’s hacking or biology skills, or make it a less convincing liar.

: Perhaps robust unlearning simply makes it harder for an AI to reason about an area, but doesn’t stop the AI entirely. That outcome would still be less risky.

# Perfect data filtering is the current unlearning gold standard

Data filtering removes the training data related to the undesired capabilities. Sadly, data filtering is usually impractical.

1. It’s hard and expensive to  identify all of the training data across the entire pretraining corpus that contributes to an unwanted capability.
2. Work on [gradient routing](https://turntrout.com/gradient-routing#robust-unlearning) showed that when data is filtered imperfectly, the filtering quickly loses effectiveness.
3. Sometimes, dangerous capabilities can come from combinations of seemingly safe data.

If we want practical robust unlearning, we probably need a different approach.

# Oracle matching does not guarantee robust unlearning

Most unlearning methods try to make a model forget a specified capability by finetuning it. However, finetuning usually only teaches the model to suppress the behavior, not remove the underlying capability.

We show this by comparing a model that was finetuned to forget something with an oracle model that never learned it in the first place. We take a model pretrained on both retain and forget data and finetune it to behave like the oracle, which was trained only on the retain data. More precisely, we train the model to match the logits of the oracle. Initially, the finetuned model behaves nearly identically to the oracle, but when we retrain both to relearn the forgotten capability, the finetuned model picks it up much faster. The capability wasn’t erased; it was just hidden.

Despite minimal initial differences in behavior, the finetuned ("reference") model relearns the “unlearned” capability much faster than either the oracle or a model distilled from the oracle starting from a random initialization.

![[distillation-robustifies-unlearning-20250612132650.png]]

Figure: **Matching oracle behavior doesn’t guarantee robust unlearning.** Graph (a) shows the loss during distillation of the Student (Reference) and the Student (Random). Graphs (b) and (c) show forget performance through retraining for Language and Arithmetic settings, respectively.

The faster relearning implies that finetuning a pretrained model for behavioral outputs is not sufficient for robust unlearning. The weights still contain the capability, but the model just learned how not to show that capability.

# Distillation robustifies unlearning

Imagine you’re an algebra student and your teacher pretends not to know algebra. Despite the fact that the teacher does know it themselves, you as a student will not learn. Similarly, you might expect that when distilling a model, only the expressed behaviors are transferred and the latent capabilities are not. We show this is true. Distilling a conventionally unlearned model into a randomly initialized model creates a student that is robustly incapable of the forget capability.

We call this method **Unlearn-and-Distill**, and it has two phases:

1. Unlearn: Apply a standard unlearning method to a pretrained model.
2. Distill: Train a randomly initialized model to match the outputs of the unlearned model.

On both language and arithmetic tasks, we apply Unlearn-and-Distill using three different unlearning methods. We finally apply relearning attacks to test robustness. For each unlearning method and setting, we compare:

| Method | Description |
| --: | :-- |
| Unlearn | The original finetuned model |
| Unlearn-and-Distill | Our method |
| Gold Standard Data Filtering | A model trained with the forget data removed entirely |

|    Domain   | Retain evaluation                          | Forget evaluation                             |
| ---------: | :----------------------------------------: | :-------------------------------------------: |
| Language   | English text CE loss                       | Korean text CE loss                           |
| Arithmetic | Addition and subtraction problems accuracy | Multiplication and division problems accuracy |

![](https://lh7-rt.googleusercontent.com/docsz/AD_4nXdYtaxHdb4FnOojIp4hz-9TCeyo_QzfzY7GGRcIs9vI15_DLpASpX1tuja3X2HHul-YyKXKEZWzu6NAodn0lbDGmIhXt5HTuUzwohtgcNIq-0JZmuQ1IoY6uYAUuFGMNktAJMt8Lg?key=Pplkg-7kqc_sIfFHnelBEw)

Figure: **Comparing unlearning methods.** Each graph depicts the relearning trends on forget data for the initial unlearning method (Unlearn), Unlearn-and-Distill, and Data Filtering (Gold Standard). The rows separate the settings (language and arithmetic), and the columns separate the initial unlearning methods (GradDiff, Maxent, and RMU).

Across the board, Unlearn-and-Distill is more resistant to relearning than its unlearned-only counterpart. In some cases, it's nearly as robust as the gold standard. This supports the idea that latent capabilities are present in the original model parameters but don’t transfer to fresh parameters during distillation. Occasionally, like with RMU/Arithmetic, the initial unlearning is poor, and the distilled model relearns quickly. This shows that if suppression is too weak, the capability can still “leak through” and be reconstructed.

> [!idea] Interactive demo
>
> In [our demo](https://addiefoote.com/distillation-robustifies-demo/), compare the answers of the “unlearned” model with the Unlearn-and-Distill model. The code and experimental framework are available on [GitHub](https://github.com/AddieFoote/distillation-robustify-unlearning).

# Robustness scales with compute

While data filtering requires training a model from scratch, Unlearn-and-Distill only requires some finetuning (unlearning) and then distillation. That’s reasonably cheap, but it can still take a fair chunk of compute. We develop a method to flexibly trade off between compute and robustness.

We introduce UNDO (Unlearn-Noise-Distill-on-Outputs), a generalization of our earlier Unlearn-and-Distill method. It’s a three-step process:

1. **Unlearn.** Apply a standard unlearning method to a pretrained model to suppress the undesired behavior.
2. **Noise.** Corrupt the weights of the suppressed model and initialize the student as this damaged model.
3. **Distill.** Repair this damaged student by distilling.

To inject noise, we use a shrink-and-perturb procedure that controls damage via a parameter $α$ (higher $α$ means more damage). We then distill until the student recovers 95% of the teacher model’s retain performance.

![](https://lh7-rt.googleusercontent.com/docsz/AD_4nXcKF0X07CTt7N4hEebmzo86tarju9yfJb2U6ZjWuhGps-_IJIL0iGlZlb18NtVnJcrQV1HMy4XaFcp6iXKdGXbyx1GGV281eXLflXKL3YKR7x4wYCmcIhgWldBg1b4PyW87HVzzBA?key=Pplkg-7kqc_sIfFHnelBEw)

Figure: **Unlearning robustness scales with more perturbation.** (a, c) show the trade-off between robustness and compute. (b) shows relearning trends for language with  $α \in \{0.2, 0.4, 0.6, 0.8\}$. (d) shows relearning trends for arithmetic with $α \in \{0.55, 0.65, 0.7, 0.75\}$.

In the first and third plots, as $α$ increases, training takes longer and the final model becomes more robust to relearning. Surprisingly, the relationship seems approximately linear. In the second and fourth plots, increasing α increases robustness, slowing down the relearning speed during relearning attacks. In other words, UNDO lets you trade off compute for robustness to relearning.

# UNDO is better than other unlearning methods

What we ultimately want from a robust unlearning method is to push the Pareto frontier of initial retain performance vs. forget performance. The frontier must hold up against an adversary who is trying to maximize forget performance given a certain compute budget.

![](https://lh7-rt.googleusercontent.com/docsz/AD_4nXeIYTECdICiroTBHzH7_VWjD_j9TsmuJW85I_k22l-c3zReFRQQg0jSw1MedaEtjvqXjReu6BNhpS6XWCXJQLPdVC_r0j6l8NtQL7p_HxSIapq_nYUj9V2tMPSx9rPt0Grw5eUY1g?key=Pplkg-7kqc_sIfFHnelBEw)

Figure: **Comparing unlearning methods across different adversarial strengths.** We vary each method's hyperparameters and plot their retain and relearned forget performance. Column 1: Initial performance after unlearning but before adversarial attacks. Column 2: Relearned forget performance after moderate relearning (40 steps). Column 3: Performance after extensive relearning (500 steps).

In both settings, UNDO consistently dominates. Many of the methods get good initial retain-forget trade-offs, but rapidly degrade under adversarial pressure. In contrast, UNDO maintains more robust unlearning performance across all explored attacks and approaches the gold standard without requiring infeasible data labeling.

We also tested UNDO on the Weapons of Mass Destruction Proxy benchmark with Gemma-2-2B. UNDO consistently increased resilience to relearning, and it fell on the Pareto frontier of methods. However, we were more constrained on data and compute here compared to our synthetic arithmetic and language experiments, relative to what was used in pretraining. We struggled to recover performance in the distillation step. We expect that model developers will have enough resources to scale UNDO to these larger models.

# Where this leaves us

## Limitations

Our method depends on the quality of the initial unlearning.

Poor initial suppression leads to less robustness gains

: Even if the unlearned model does poorly on the forget capability, it still may contain information in the logits that results in reconstructing the underlying capability during distillation. For real-world cases, can we reliably achieve suppression strong enough for UNDO to succeed? We think so.

Poor suppression might lead to slower distillation

: Perhaps inconsistent or noisy behaviors make the target logit function harder to predict.

We only tested against relearning attacks

: The unlearning literature considers these finetuning attacks to be the strongest kind, but it’s possible that UNDO somehow is vulnerable to other elicitation approaches.

## Insights and speculation

The oracle matching experiment shows that logits do not fully reflect a model’s capabilities. We demonstrate path-dependent inductive biases: for two models with nearly identical logit outputs, the models have different abilities to learn the forget set information.

Distillation is not just a compression tool[^1]

: Distillation also changes safety-relevant model properties – e.g. distillation makes unlearning robust. If you first unlearn and then distill into a randomly initialized student, the student keeps the desired behavior but loses the unwanted capability, even under relearning attacks. In a sense, distilling a suppressed model allows you to only train on “good” data.[^2] UNDO decomposes “robust unlearning” into “choice of shallow-unlearning method” and “how distillation is performed.”

: Therefore, developers can mix and match suppression methods. As suppression / shallow unlearning improves, so does UNDO!

We can trade off compute and robustness

: Perturbing the model’s weights damages the trained model’s capabilities as a function of the size of the perturbation. In this way, we can modulate both the compute needed and the robustness gained.

Labs already distill production models, so Unlearn-and-Distill might be cheap and easy

: Distillation typically happens before post-training, for several potential reasons. For example, by distilling first, labs can tweak post-training without re-distilling. It’s cheaper to post-train a smaller (distilled) model. There could also be optimizations that apply only when distilling the base pretrained model. The true cost of Unlearn-and-Distill or UNDO depends on how labs implement distillation.

A common concern is that sufficiently capable models might just rederive anything that was unlearned by using general reasoning ability, tools, or related knowledge. Several thoughts in response:

1. In real life, it’s harder to reason about an area if you don’t have relevant experience or knowledge. After all, what are we unlearning if not domain-specific heuristics and knowledge access? Unlearning might not stop such smart systems from reasoning about biology, but it probably makes it harder.

2. We think there is likely to be a window of time where models are dangerous enough to warrant unlearning, yet not capable enough to rederive the removed information.

3. Making dangerous capabilities require more reasoning or tool use makes it easier to detect when they’re being used.

4. In many cases, the specifics matter. For example, exactly what security measures are in place around a datacenter? Such details may be difficult to rederive.

# Future directions

- Scaling Unlearn-and-Distill and UNDO into settings that are closer to practical applications. For example, performing full $\alpha$ sweeps and Unlearn-and-Distill for the Weapons of Mass Destruction Proxy benchmark. More speculatively, UNDO’ing deception or sycophancy.

- Run the distillation step by matching model internal activations rather than logits. This should be runnable from [our codebase](https://github.com/AddieFoote/distillation-robustifies-unlearning).

- Exploring other techniques to damage the model, such as [pruning](https://arxiv.org/pdf/2403.01267) or [targeted damage](https://arxiv.org/abs/2202.05262).

# Conclusion

UNDO is a viable approach for creating genuinely capability-limited models. While other methods merely suppress surface behaviors, our experiments indicate that UNDO prevents capabilities from being easily recovered. By folding unlearning into an already common practice, we hope that this line of work helps make real robust unlearning a reality.

```bibtex
@misc{lee2025distillationrobustifiesunlearning,
      title={Distillation Robustifies Unlearning}, 
      author={Bruce W. Lee and Addie Foote and Alex Infanger and Leni Shor and Harish Kamath and Jacob Goldman-Wetzler and Bryce Woodworth and Alex Cloud and Alexander Matt Turner},
      year={2025},
      eprint={2506.06278},
      archivePrefix={arXiv},
      url={https://arxiv.org/abs/2506.06278}, 
}
```

[^1]: Other work has used distillation in contexts other than model compression, including [improving](https://arxiv.org/pdf/1805.04770) [performance](https://arxiv.org/pdf/1911.04252), dataset [privacy](https://arxiv.org/pdf/2110.08324) [protection](https://arxiv.org/pdf/1610.05755), and [continual](https://arxiv.org/pdf/1606.09282) [learning](https://arxiv.org/pdf/2302.00487).

[^2]: Distilling unlearned teacher logits isn’t always similar to just filtering out the forget data. In a TinyStories setting, we unlearned “ability to tell stories involving trees” from a small teacher model. Then we distilled its logits into a small student model. However, the student was vulnerable to relearning attacks, [which wouldn’t have happened if we had performed data filtering](https://turntrout.com/gradient-routing#robust-unlearning).
