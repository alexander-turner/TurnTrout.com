---
title: Steering Gemini using BIDPO vectors
permalink: gemini-steering
no_dropcap: "false"
tags:
  - AI
  - activation-engineering
  - deepmind
description: We tried boosting Gemini benchmarks by optimizing steering vectors. It didn't work. We share our takeaways.
authors: Alex Turner, Mark Kurzeja, Dave Orr, and David Elson
hideSubscriptionLinks: false
card_image:
aliases:
  - bidpo
  - steering-postmortem
  - bidpo-postmortem
  - steering-gemini
  - bidpo-steering
original_url: https://www.lesswrong.com/posts/WqjkqrEyFDXoHzz9K/steering-gemini-with-bidpo
date_published: 2025-01-30 09:30:36.233182
date_updated: 2025-11-22 08:59:29.674980
other_urls:
  - https://deepmindsafetyresearch.medium.com/steering-gemini-using-bidpo-vectors-8a0e7e1da1c9
---












A while back, we explored the “[BIDPO](https://arxiv.org/abs/2406.00045)” method for training [steering vectors](https://arxiv.org/abs/2308.10248). In Gemini 1.5v1 Flash and Pro, BIDPO steering vectors boosted TruthfulQA scores by >10% while mostly retaining capabilities. When we [updated to Gemini 1.5v2](https://developers.googleblog.com/en/updated-gemini-models-reduced-15-pro-pricing-increased-rate-limits-and-more/), prompt-based steering baselines became significantly stronger. BIDPO did not beat the stronger baselines, ending the project.

> [!idea] Work completed at Google DeepMind on the North American alignment team

# Introduction

We want to elicit the full knowledge and capabilities of a model - to understand what a model “really” knows ([Christiano et al., 2021](https://www.alignmentforum.org/posts/qHCDysDnvhteW7kRd/arc-s-first-technical-report-eliciting-latent-knowledge); [Mallen et al., 2023](https://arxiv.org/abs/2312.01037); [Burns et al., 2022](https://arxiv.org/abs/2212.03827)). By doing so, our models become statistically more reliable and we have greater reason to trust any given output. A more “honest” and factual model provides better AI feedback ([Bai et al., 2022](https://arxiv.org/abs/2212.08073)), leading to better alignment data and stronger overall supervision of future model training ([Burns et al., 2023](https://arxiv.org/abs/2312.09390)). A more factual model produces outputs which overall require less scrutiny (which also helps AI-assisted human raters).

Towards this goal, we investigated three hypotheses:

1. Steering can boost performance in an absolute sense. Prior work ([Panickssery et al. 2023](https://arxiv.org/abs/2312.06681); [Li et al., 2023](https://arxiv.org/abs/2306.03341); [Liu et al. 2023](https://arxiv.org/abs/2311.06668)) suggested that steering vectors are not only able to boost performance, but that they boost performance beyond the gains provided by supervised finetuning and few-shot prompting. If that scaled to Gemini, steering vectors would become a valuable addition to safety post-training.
2. Steering vectors are more parameter- and sample-efficient interventions. Even a rank-1 LORA can take substantial memory (namely, O($2\cdot n_\text{layers}  \cdot d_\text{model}$)) and hundreds of examples. Results like ([Li et al., 2023](https://arxiv.org/abs/2306.03341)) suggest that steering can work with a few dozen labeled examples, and perhaps without taking any gradients at all.
3. Steering can improve response velocity for losses. A fast steering intervention can be iterated and evaluated quickly, whereas finetuning might require a lot more care and compute. This is especially useful for safety. For example, it could be used as part of a rapid response system for novel jailbreaks.

We remained wary of several potential obstacles, including performance degradation ([Stickland et al., 2024](https://arxiv.org/abs/2406.15518)).

# Initial positive results in 1.5v1

Using Gemini Flash 1.5v1, we observed positive signals for vectors trained on TruthfulQA using BIDPO – a variant of DPO. Basically, we trained a vector to maximize the logit difference between a correct and incorrect multiple-choice answer. We used 256 TruthfulQA training points in order to produce the BIDPO vectors. We hoped that a TruthfulQA vector could improve general model factuality.

[^serror]: However, the standard error was 1.7% and the boost over LORA was just 1.5% – weakening this result.

1. BIDPO achieved a 16% boost on TruthfulQA multiple-choice validation.
    1. Multi-shot prompting achieved a 4% boost using the same 256 training questions (74.6% ->  78.8%).
    2. LORA achieved a 17.8% boost using the same data.
    3. However, by combining the LORA with the already-trained BIDPO steering vector, we achieved a 19% boost (to 93.3%).[^serror]
2. The “truthfulness” boost seemed to generalize beyond TruthfulQA. [HaluEval](https://arxiv.org/abs/2305.11747) evaluates whether the model can recognize when a proposed answer is made-up. On two splits of HaluEval, the vector increased performance (in one case, from 25% to 56%).
3. We found “Pareto” BIDPO vectors which achieved ~11% boosts while preserving performance on a range of multiple-choice capabilities datasets. One kind of model sycophancy improved by 5% (+4sd) due to a Pareto vector, while other sycophancy datasets had unchanged performance.

4. We achieved similar positive results on Gemini Pro 1.5v1.

5. To assess long-form abilities, we tested:
    1. Chain-of-thought capability on MMLU and TruthfulQA multiple-choice. The vectors boosted TruthfulQA slightly but also degraded MMLU. We concluded that [conditional activation steering](https://arxiv.org/abs/2409.05907) would be required for production usage.
    2. Free-form responses to TruthfulQA questions (omitting the answer options). Gemini 1.5 Pro compared the responses in a head-to-head between the steered and unsteered Flash models. The steered Flash won 56.6% of the time, which had a one-tailed $z$-score of +2.1 and so was statistically significant ($p<.05$).

6. An internal client strongly preferred contrastively steered models to system prompted models for their use case.

7. A single BIDPO update on a single TruthfulQA datapoint produced a >10% boost on TruthfulQA validation, and several seeds produced a 7% boost. We were excited by the possibility of extreme sample- and parameter-efficiency.

| HellaSwag | MMLU  | NaturalQuestions | TruthfulQA |
| :-------: | :---: | :--------------: | :--------: |
|   +0.6%   | -1.0% | -0.7%            | +10.5%     |

Table: Impact of a vector trained for a single step on a single datapoint.

# Negative results in 1.5v2

[Gemini 1.5v2 constituted a moderate upgrade](https://developers.googleblog.com/en/updated-gemini-models-reduced-15-pro-pricing-increased-rate-limits-and-more/). When 1.5v2 landed, nearly all of our positive signs flipped to negative. Gemini Pro 1.5v2 had higher unsteered TruthfulQA performance, while Flash 1.5v2  did not. However, both models seemed significantly better at following instructions and learning from many-shot examples.

1. BIDPO achieved 92.6% on TruthfulQA, a 17.6% boost over the unsteered score of 75%.
    1. 256-shot prompting achieved 95%, meaning we no longer beat the obvious baseline of multi-shot prompting.
    2. LORA also achieved at least 95%.
2. We tried combining BIDPO + LORA, but this no longer boosted performance.
3. The HaluEval “generalization” result was caused by a data labeling error which flipped the correct answer for each question. At best, the TruthfulQA vectors preserved HaluEval performance.
4. The “Pareto” vectors (derived from 256 TruthfulQA examples) had somewhat worse transfer than 32-shot prompting.
5. BIDPO vectors no longer boosted freeform TruthfulQA performance. In fact, they slightly degraded performance. We verified this result by manually rating each pair of responses (using blinding).
6. Using a new steering vector for a 1.5v2 model, the aforementioned internal client now strongly preferred the system-prompted outputs.
7. We were no longer able to produce statistically significant gains using a single datapoint. Furthermore, LORA proved surprisingly sample-efficient, achieving a 13% boost using just 16 datapoints.

Furthermore, [we realized that TruthfulQA and HaluEval are low-quality datasets – at least when used for multiple-choice Q/A](https://turntrout.com/original-truthfulqa-weaknesses). This realization further questioned the validity of boosts on TruthfulQA, as now it was possible that the BIDPO vector simply taught the model to look for simple patterns in TruthfulQA.

 ![Charts showing that across a range of steering vector norm ratios, BIDPO and DPO have similar impact on benchmark performance.](https://assets.turntrout.com/static/images/posts/dpo-vs-bidpo.avif)

Figure: As an aside, in our ablations we found that BIDPO had functionally similar performance to normal [DPO](https://arxiv.org/abs/2305.18290). Therefore, for simplicity, we recommend just using DPO instead of BIDPO.

# Lessons learned

In hindsight, Gemini 1.5v1 was less responsive to in-context learning on a set of examples. If we had realized this overhang, we may have saved lots of time.

Carefully manually inspect every dataset
: Make sure to take a representative sample. Error prevented: [trusting TruthfulQA (multiple choice) and HaluEval](https://turntrout.com/original-truthfulqa-weaknesses).

Manually inspect data questions and their metadata
: We checked e.g. "does the 'correct' answer make sense?", but not consistently. Error prevented: for a while, our HaluEval labels were reversed.

Test long-form generations sooner
: Error prevented: none, but we would have noticed some of the negative results more quickly.

Implement regression and integration testing early
: We relied on point-in-time evaluations to sanity check our infrastructure. Error prevented: Several regressions in the stack under us, which cost several SWE days and partially compromised results.

Ensure datasets have statistical power to make progress
: For example, TruthfulQA validation only had 256 points. Error prevented: noisy evaluations.

![Two histograms showing the Bayesian posterior for the "BIDPO - Baseline Correct Sample Advantage" on two datasets. For the "mmlu" dataset, the distribution is centered near zero (p=45.3%). For the "tqa" dataset, the distribution is almost entirely positive, indicating a significant advantage (p=99.6%).](https://assets.turntrout.com/static/images/posts/contrastive-posterior.avif)

Figure: Bayesian statistics for Gemini Pro 1.5v2 performance shifts. The $x$-axis shows the "contrastive advantage" of the BIDPO vector over the baseline. This posterior contrast takes into account finite sample effects and allows us to estimate the probability the BIDPO vector's effect is via chance.<br/><br/>A sample advantage of $n$ on TruthfulQA corresponds to an accuracy increase of $\frac{n}{256}$. Wins needed ≥10% signal to be statistically relevant, making it hard to identify and stack small wins.

Generate and analyze data separately
: Separation protects against possible generation pipeline changes or breaks. Error prevented: Inability to plot complete 1.5v1 statistics on e.g. multi-shot prompting (as we didn't expect to regenerate those).

# Conclusion

BIDPO seems effective and sample-efficient but does not currently exceed more standard baselines. It’s hard to draw firm conclusions about BIDPO because [TruthfulQA might not be measuring truthfulness / factuality](https://turntrout.com/original-truthfulqa-weaknesses). However, we remain excited about DPO-driven [Conditional Activation Steering](https://arxiv.org/abs/2409.05907), which has additional advantages—particularly for targeted loss mitigation.

> [!thanks]
> Thanks to David Elson, Rohin Shah, Dave Orr, and others for feedback. Arthur Conmy and the GDM language model interpretability team helped with infrastructure.
  
# Appendix: Method

## BIDPO training

While contrastive activation addition ([Panickssery et al., 2023](https://arxiv.org/abs/2312.06681)) did well on Gemini 1.0 models, initial evidence suggested that it did not transfer to Gemini 1.5 models. Instead, we used the recent BIDPO algorithm ([Cao et al., 2024](https://arxiv.org/abs/2406.00045)) to train a “virtual bias term” which increases attribute $X$ when added and decreases attribute $X$ when subtracted. We call these trained bias terms “steering vectors” (which can be applied whether or not the original architecture contained bias terms).

$$
\begin{align*}
\mathbb{E}_{\substack{\Delta\sim \{-1,1\},\\q,r_T, r_O \sim \mathcal{D}}} \Big[ \log \sigma \big( &\Delta\cdot \beta \log \overset{\text{target completion likelihood ratio}}{\frac{\pi(r_T \mid A_{L}(q) + \Delta \cdot v)}{\pi(r_T \mid A_{L}(q))}} \\
   \qquad\qquad\qquad - &\Delta\cdot\beta \log \underset{\text{opposite completion likelihood ratio}}{\frac{\pi(r_O | A_{L}(q) + \Delta \cdot v)}{\pi(r_O | A_{L}(q))}} \big) \Big]
\end{align*}
$$

Figure: **The BIDPO loss term.** BIDPO contrastively optimizes the steering vector $v$ so that the model outputs the target completion $r_T$ for query $q$ while making the opposite completion $r_O$ less likely. The vector $v$ is a "virtual bias term" and is added to the activations $A_L(q)$ of layer $L$ on query $q$. The direction $\Delta= \pm 1$ controls whether $v$ is added to or subtracted from $A_L(q)$. When the steering vector is added $(\Delta=1), v$ is (roughly) optimized to increase the likelihood of the target completion and decrease the likelihood of the opposite completion. When subtracted, $v$ is optimized to have the reverse effect. In this sense, the vector is trained to be bidirectional.

A training dataset is broken up into batches of size eight in our experiments. For each batch:

1. The BIDPO loss is computed for the batch,

2. The gradient is computed with respect to the steering vector, and

3. The vector is updated using the AdamW optimizer ([Loshchilov & Hutter, 2019](https://arxiv.org/abs/1711.05101)).

This process continues until the entire dataset is exhausted. We may repeat this process for multiple epochs.

When evaluating BIDPO vectors mid-training, we “renormalized” them to have a norm equal to about 5% of the average norm of the residual stream at that part of the forward pass.

## LORA training

Our LORAs are trained with rank 1, a learning rate of $10^{-4}$, and a batch size of 16. We evaluate the trained LORAs every 50 steps and evaluate validation accuracy on the checkpoint with lowest validation loss.

The LORA modifies every layer of the transformer. With a rank of $n_\mathrm{rank}$, a LORA has $2\cdot d_{\text{model}} \cdot n_{\text{layers}}$ parameters. Since BIDPO only trains a bias term of size $d_{\text{model}}$, rank-$n_\mathrm{rank}$ LORA uses $2\cdot n_\mathrm{rank} \cdot n_{\text{layers}}$ times the parameter count.  $n_\mathrm{rank}\approx128$ LORAs are common. On a 50-layer model, such a LORA requires about 12,800 times as many parameters as does a BIDPO steering vector.

# Experiment design

We split TruthfulQA ([Lin et al., 2021](https://arxiv.org/abs/2109.07958)) into 256 training, 256 validation, and 304 test data points. TruthfulQA is intended to measure how often a model promotes misconceptions or falsehoods. We use TruthfulQA’s MC1 variant, containing multiple choice questions with a single correct answer.

To assess the BIDPO intervention, we quantify its impacts on alignment and on capabilities. Unless otherwise mentioned, all experiments are zero-shot multiple choice.

Alignment benchmarks
: We measure in-distribution generalization by measuring the performance on the TruthfulQA test set. We measure out-of-distribution “truthfulness” generalization by considering the Natural Questions dataset ([Kwiatkowski et al., 2019](https://aclanthology.org/Q19-1026/)) (in line with prior work ([Li et al., 2023](https://arxiv.org/abs/2306.03341); [Chen et al., 2024](https://arxiv.org/abs/2312.17484); [Zhang et al., 2024](https://aclanthology.org/2024.acl-long.483/))). To produce incorrect choices for Natural Questions (which only contains correct answers), we had Gemini Pro 1.5v1 produce an answer which looked correct but wasn't.

: We also measured impact on SycophancyEval ([Sharma et al., 2023](https://arxiv.org/abs/2310.13548)), testing how often the model tailors its response to the user's opinion. We consider generalization to HaluEval ([Li et al., 2023](https://arxiv.org/abs/2305.11747)) and to ([Panickssery et al., 2023](https://arxiv.org/abs/2312.06681))'s hallucination dataset, both of which aim to measure hallucination rates.

Capabilities benchmarks
: We test general performance and reasoning using MMLU ([Hendrycks et al., 2020](https://arxiv.org/abs/2009.03300)), Winogrande ([Sakaguchi et al., 2019](https://winogrande.allenai.org/)), BoolQ ([Clark et al., 2019](https://arxiv.org/abs/1905.10044)), PIQA ([Bisk et al., 2020](https://arxiv.org/abs/1911.11641)), ARC ([Clark et al., 2018](https://arxiv.org/abs/1803.05457)), and HellaSwag ([Zellers et al., 2019](https://arxiv.org/abs/1905.07830)).

# Experiment results

 We thoroughly optimized hyperparameters for BIDPO. The most important hyperparameters turned out to be the steering vector magnitude (and sign) and the learning rate.

## Data efficiency

We trained BIDPO vectors on a range of datasets and measured in-distribution generalization (validation performance). Using optimized hyperparameters, we took subsets of the 256-element training distribution. To reduce variance, the larger training sets are strict supersets of the smaller training sets.

### Gemini 1.5v1

![A 2x2 grid of line charts showing validation performance as a function of the number of gradient steps. On HellaSwag, MMLU, and Natural Questions, performance is relatively flat and near the baseline. On TruthfulQA, performance increases significantly with more steps.](https://assets.turntrout.com/static/images/posts/sample-efficiency-bidpo.avif)

Figure: On TruthfulQA, training on $n=1$ datapoint caused a validation boost of over 10%.

### Gemini 1.5v2

![Four line charts showing Gemini 1.5v1 validation performance with BIDPO steering versus training sample count. For HellaSwag, MMLU, and Natural Questions, performance is stable. For TruthfulQA, performance significantly increases with more samples, showing a boost of over 10% with just a few samples and rising above 90% with 256 samples.](https://assets.turntrout.com/static/images/posts/sample-efficiency-bidpo-v2.avif)

Figure: $n=1,2$ datapoint(s) no longer cause any boost on TruthfulQA. Weird.

## Multi-shot prompting

We did not record comprehensive 1.5v1 data on multi-shot prompting generalization. However, using 256-shot TruthfulQA on Gemini Flash 1.5v1 caused a mere 4% boost on TruthfulQA.

In contrast, on Gemini Pro 1.5v2, multishot prompting was extremely effective:

![Six line charts showing how multi-shot prompting with TruthfulQA examples affects test accuracy on various datasets. As the number of TruthfulQA examples increases from 0 to 256, accuracy on TruthfulQA rises sharply from ~83% to over 95%. On other datasets, accuracy increases for MMLU, Natural Questions, and Rimsky Halu; decreases for Halu Eval QA; and fluctuates for Hellaswag.](https://assets.turntrout.com/static/images/posts/multishot.avif)

Figure: We tested the generalization performance of Truthful QA using a multi-shot prompting approach. For each test dataset, examples from the Truthful QA training set were prepended to each question and Gemini Pro 1.5v2 is asked to produce the appropriate answer. If the test dataset was large, it was truncated to 1,024 examples. The number of Truthful QA examples prepended to each question varies across the  $x$-axis. The test-set accuracy and the 90% credible intervals are plotted along the $y$-axis.

# Prior work

## Activation engineering

([Mini et al., 2023](https://arxiv.org/abs/2310.08043)) controlled a maze-solving deep convolutional network by adding and subtracting activation vectors. In follow-on work, ([Turner et al., 2023](https://arxiv.org/abs/2308.10248)) shifted the sentiment and topic of GPT-2 by adding in activation vectors (“steering vectors”) to steer the model's outputs. Both works demonstrated effective activation engineering: the inference-time modification of activations to steer a network's outputs. ([Panickssery et al., 2023](https://arxiv.org/abs/2312.06681)) explored “contrastive activation addition” (CAA) through contrasting the average residual stream difference between desired and undesired answers. CAA vectors effectively controlled the hallucination rate among a range of examined characteristics.

CAA activation engineering requires specifying contrastive completions. A contrastive completion is a prompt composed with two completions: the first is the desired completion and the second is the undesired completion. However, ([Jorgensen et al., 2023](https://arxiv.org/abs/2312.03813)) achieved stronger sentiment shift by replacing the “mean activation vector on undesired completions” with the “mean activation vector on a related dataset.” Inspired by these activation addition approaches, BIDPO ([Cao et al., 2024](https://arxiv.org/abs/2406.00045)) used a contrastive variant of Direct Preference Optimization ([Rafailov et al., 2024](https://arxiv.org/abs/2305.18290)) to optimize a vector to produce the desired contrastive effects. BIDPO boosts Llama-2-7b-chat TruthfulQA MC1 by approximately 15%, while CAA only boosted MC1 by approximately 3%.

While activation engineering has enjoyed recent attention, the area has a rich history dating back to vision models and `word2vec` ([Mikolov et al., 2013](https://arxiv.org/abs/1301.3781)). For example, ([Larsen et al., 2016](https://arxiv.org/abs/1512.09300); [White et al., 2016](https://arxiv.org/abs/1609.04468)) found a “smile vector” in a GAN. For more early work in steering image models with vector arithmetic, refer to e.g. ([Upchurch et al., 2017](https://arxiv.org/abs/1611.05507); [Reed et al., 2016](https://proceedings.neurips.cc/paper_files/paper/2015/file/e07413354875be01a996dc560274708e-Paper.pdf); [Wang et al., 2019](https://arxiv.org/abs/1909.12220); [Goh et al., 2017](https://gabgoh.github.io/ThoughtVectors/)). “Steering vector” was coined by ([Subramani et al., 2022](https://arxiv.org/abs/2205.05124)) who optimized a vector to force GPT-2 to output arbitrary output sequences.

![A succession of images of a man, each smiling more broadly than the last.](https://assets.turntrout.com/static/images/posts/lqrnae8zgs8c8vmvvv34.avif)

Figure: ([White et al., 2016](https://arxiv.org/abs/1609.04468)) adds a steering vector to the latent space of a GAN. Larger coefficients produce larger smiles.

([Li et al., 2023](https://arxiv.org/abs/2306.03341)) demonstrated “inference-time intervention”, which adds a “truth vector” to a subset of truth-relevant attention heads at a layer (with relevance determined by linear probes ([Alain & Bengio, 2016](https://arxiv.org/abs/1610.01644))). By doing so, they significantly boosted the informative-truthfulness score on the TruthfulQA dataset while preserving MMLU performance. ([Turner et al., 2023](https://arxiv.org/abs/2308.10248)) and ([Li et al., 2023](https://arxiv.org/abs/2306.03341)) concurrently demonstrated the feasibility of activation engineering in language models, inspiring a wealth of follow-up papers in the field of activation engineering.

([Arditi et al., 2024](https://arxiv.org/abs/2406.11717)) created a "refusal vector" by computing the average activation difference between refusal and non-refusal responses. By adding or ablating the refusal vector, they could dramatically increase or decrease the refusal rate. ([Stickland et al., 2024](https://arxiv.org/abs/2406.15518)) derived a CAA steering vector and regularized the model to minimize the vector's KL impact on a set of unrelated prompts. By averaging ([Wortsman et al., 2022](https://arxiv.org/abs/2203.05482)) these weights with the weights of a LORA-adapted model, ([Stickland et al., 2024](https://arxiv.org/abs/2406.15518)) further increased performance while minimizing performance impact on the model. ([Price et al., 2024](https://arxiv.org/abs/2407.04108)) trained backdoors which appear to trigger when the model infers it is processing headlines from some future date.

Given a trigger prompt, they claim to find “future” − “past” steering vectors which strongly control the activation of the backdoor. Adaptive activation steering ([Wang et al., 2024](https://arxiv.org/abs/2406.00034)) dynamically applies multiple truth-related steering vectors using linear probes. ([Rahn et al., 2024](https://arxiv.org/abs/2406.00244)) use combinations of steering vectors to increase the high-level uncertainty of LLM agents and improve their exploration properties.

## Hallucinations

A wide range of complementary techniques can reduce hallucination rates in LLMs. The vast majority of these techniques are compatible with steering vectors. We will only cover a few here.

([Farquhar et al., 2024](https://www.nature.com/articles/s41586-024-07421-0)) detect certain kinds of hallucinations by checking the model for consistency across rephrasings or augmentations of the prompt. ([Tian et al., 2023](https://arxiv.org/abs/2311.08401)) use DPO and unsupervised factuality-correlated preference data augmentation to dramatically reduce hallucinations in Llama-1 and Llama-2-7B models. Contrastive decoding ([Li et al., 2022](https://arxiv.org/abs/2210.15097)) is an inference-time technique which amplifies predictive differences between a strong model and a weak model. DoLA ([Chuang et al., 2023](https://arxiv.org/abs/2309.03883)) amplifies differences in predictions between the final layer and an earlier layer.

([Zhang et al., 2024](https://aclanthology.org/2024.acl-long.483/))'s TruthX approach recently achieved impressive gains on TruthfulQA for Llama-2-7b, boosting MC1 performance from 34.6% to 54.2%. While this ~20% gain is larger than BIDPO's 15% gain on the same model, the TruthX approach is significantly more complicated. TruthX adds a steering vector in the latent space of an autoencoder trained to represent truth information. Two similar autoencoders are trained at each sublayer of the transformer, requiring $2n_{\text{layers}}$ autoencoders, each with $O\left(d_{\text{model}}^2\right)$ learnable parameters, for a total of $O\left(n_{\text{layers}}d_{\text{model}}^2\right)$ parameters. In comparison, LORAs require only $O\left(n_{\text{layers}}n_{\text{rank}}d_{\text{model}}\right)$ parameters for $n_{\text{rank}} \ll d_{\text{model}}$. Because of TruthX's quadratic dependence on $d_{\text{model}}$, we compare BIDPO to LORAs only: we are interested in steering methods which are both economic and effective.

## Parameter-efficient finetuning

Our finetuning baseline is LORA ([Hu et al., 2021](https://arxiv.org/abs/2106.09685)), which efficiently updates weight matrices by computing only low-rank adapters. Activation engineering inspired “representation finetuning” (ReFT) ([Wu et al., 2024](https://arxiv.org/abs/2404.03592)), which learns a task-specific subspace. Then a parameter update is optimized within that weight subspace, allowing highly sample-efficient learning. We do not compare to this approach.
