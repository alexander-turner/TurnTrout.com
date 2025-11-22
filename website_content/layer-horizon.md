---
title: Can transformers act on information beyond an effective layer horizon?
permalink: effective-layer-horizon
draft: false
no_dropcap: "false"
tags:
  - AI
  - understanding-the-world
description: Norm growth in activations drowns out earlier computations - do transformers
  just process recent sublayer outputs?
date-published: 07/23/24
authors: Alex Turner
hideSubscriptionLinks: false
card_image:
original_url: 
  https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=onhHdxZ8iQ4qvSHgi
date_published: 2024-10-27 19:14:04.653922
date_updated: 2025-11-22 00:21:52.667251
aliases:
  - layer-horizon
---










The [residual stream norm grows exponentially over the forward pass](https://www.lesswrong.com/posts/8mizBCm3dyc432nK8/residual-stream-norms-grow-exponentially-over-the-forward), with a growth rate of about 1.05. Consider the residual stream at layer 0, with norm (say) of 100. Suppose the MLP heads at layer 0 have outputs of norm (say) 5. Then after 30 layers, the residual stream norm will be $100\cdot1.05^{30}\approx432.2$. Then the MLP-0 outputs of norm 5 should have a significantly reduced effect on the computations of MLP-30 due to their smaller relative norm.

On input tokens $x$, let $\mathrm{attn}_i(x),\mathrm{MLP}_i(x)$ be the original model's sublayer outputs at layer $i$. I want to think about what happens when the later sublayers can only "see" the last few layers' worth of outputs.

> [!math] Definition: Layer-truncated residual stream
> A _truncated residual stream_ from layer $n_1$ to layer $n_2$ is formed by the original sublayer outputs from those layers.
 >
 > $$
> h_{n_1:n_2}(x):=\sum_{i=n_1}^{n_2}\mathrm{attn}_i(x)+\mathrm{MLP}_i(x).
> $$

> [!math] Definition: Effective layer horizon
> Let $k>0$ be an integer. Suppose that for all $n\geq k$, we patch in $h_{(n-k):n}(x)$ for the usual residual stream inputs $h_n(x)$.[^1] Let the _effective layer horizon_ be the smallest $k$ for which the model's outputs and/or capabilities are "qualitatively unchanged."

# Implications

Effective layer horizons (if they exist) would greatly simplify searches for circuits within models. Additionally, they would be evidence against hypotheses like [_Residual Networks Behave Like Ensembles of Relatively Shallow Networks_](https://arxiv.org/abs/1605.06431) because serial circuits would need to be deep:

> [!quote] [Jake Mendel](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=gnWcxJeBkrGPJseaA)
> Low effective layer horizon implies that later layers are building more on the outputs of intermediate layers.  In one extreme, a network with an effective layer horizon of 1 would only consist of circuits that route through every single layer. Likewise, for there to be any extremely shallow circuits that route directly from the inputs to the final layer, the effective layer horizon must be the number of layers in the network.

Lastly, slower norm growth probably causes the effective layer horizon to be lower. In that case, simply measuring residual stream norm growth would tell you a lot about the depth of circuits in the model, which could be useful if you want to regularize against that or otherwise decrease it (e.g. to decrease the amount of effective serial computation).

> [!question] Question
> Do models have an effective layer horizon? If so, what is it, as a function of model depth and other factors --- are there scaling laws?

# Initial results

To measure the importance of sublayer contributions originating much earlier in the forward pass, Joseph Miller modified the forward pass so that each sublayer reads a residual stream formed from the outputs form the previous $k$ sublayers. He then measured how loss changes as a function of enforced layer horizon $k$. A larger loss spike means that that information was more important. On the other hand, if you can remove all but the last three layers and suffer minimal loss increase, the earlier outputs evidently aren't important beyond a few layers.

[Joseph Miller reports that GPT-2-small seems too small to exhibit an effective layer horizon.](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=sppiZhHDwjYJXDdsn) However, he then ran experiments on GPT-2-XL.

> [!quote] [Joseph Miller](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=DpKyPSqGCBw3erajH)
>
> ![Line chart of "Layer Horizon vs Loss of GPT2-XL (48 layers)." As the layer horizon on the x-axis increases, the model's loss on the y-axis smoothly falls from a high of nearly 9 to approach the baseline loss of 3.1418. The sharpest decrease occurs between a layer horizon of 10 and 25.](https://assets.turntrout.com/static/images/posts/layer-horizon-gpt2xl.avif)
>
>  We clearly see the same pattern again. As `TurnTrout` predicted, there seems be something like an exponential decay in the importance of previous layers as you go further back. I expect that on large models the effective layer horizon is an important consideration. ([Source code](https://gist.github.com/UFO-101/41b7ff0b250babe69bf16071e76658a6))

However, there _is_ a confounder. Suppose the layer horizon is 1. Consider the computation performed by layer 0's attention and MLP sublayers. Because layer 0 already uses all relevant information in its outputs (i.e. the embeddings), its computation is not affected if the layer horizon increases to 2. More generally, all layers up through $n$ are not affected by the layer horizon as long as the horizon is strictly greater than $n$. In a model like GPT-2-XL with 48 layers, shifts in layer horizon are less meaningful for e.g. $n>25$.

One way of controlling for this effect is to decide, "I'm going to test layer horizons up to 20", and then only enforce those layer horizons on layers 20 and after. However, that design wouldn't let us study the layer horizons of the layers before 20.

[^1]:  For notational ease, I'm glossing over the fact that we'd be patching in different residual streams for each sublayer of layer $n$. That is, we wouldn't patch in the same activations for both the attention and MLP sublayers of layer $n$.
