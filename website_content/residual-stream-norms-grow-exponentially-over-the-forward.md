---
permalink: residual-stream-norms-grow-exponentially-over-the-forward-pass
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/8mizBCm3dyc432nK8/residual-stream-norms-grow-exponentially-over-the-forward
lw-is-question: "false"
lw-posted-at: 2023-05-07T00:46:02.658000Z
lw-last-modification: 2023-06-27T22:46:07.824000Z
lw-curation-date: None
lw-frontpage-date: 2023-05-05T17:52:43.688000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 24
lw-base-score: 75
lw-vote-count: 33
af-base-score: 32
af-num-comments-on-upload: 6
title: Residual stream norms grow exponentially over the forward pass
lw-latest-edit: 2023-05-08T16:36:55.402000Z
lw-is-linkpost: "false"
authors:
  - Stefan Heimersheim
  - Alex Turner
tags:
  - AI
aliases:
  - residual-stream-norms-grow-exponentially-over-the-forward
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2023-05-07 00:00:00
original_url: https://www.lesswrong.com/posts/8mizBCm3dyc432nK8/residual-stream-norms-grow-exponentially-over-the-forward
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/hpgem17ggmbpgnwcvdut.jpg
description: Residual stream norms grow, perhaps due to layer normalization making it hard to delete information and easier to overshadow it.
date_updated: 2025-12-30 14:46:20.403471
card_image_alt: A line chart plots the log norm of the residual stream for each token in a prompt. The norm for the tokens "M", "ATS", "is", "really", and "cool" grows exponentially (appearing as a near-straight line on the log scale) with the layer number. The `<|endoftext|>` token's norm is an outlier, rising much more steeply to a higher peak before declining.
---












For a range of language models and a range of input prompts, the norm of each residual stream grows exponentially over the forward pass, with average per-layer growth rate of about 1.045 in GPT-2-XL. We show a bunch of evidence for this. We discuss to what extent different weights and parts of the network are responsible.

We find that some model weights increase exponentially as a function of layer number. We finally note our current favored explanation: Due to LayerNorm, it's hard to cancel out existing residual stream features, but easy to overshadow existing features by just making new features 4.5% larger.

> [!thanks]
> Thanks to Aryan Bhatt, Marius Hobbhahn, Neel Nanda, and Nicky Pochinkov for discussion.

# Plots showing exponential norm and variance growth

> [!note]
> Our results are reproducible in [this Colab](https://colab.research.google.com/drive/1Z6AgGpPpnGY43DT58vl_Wvqmyw-KRfqY?usp=sharing)\.

Alex noticed exponential growth in the contents of GPT-2-XL's residual streams. He ran dozens of prompts through the model, plotted for each layer the distribution of residual stream norms in a histogram, and found exponential growth in the L2 norm of the residual streams:

![A histogram titled "Residual Stream Magnitude by Layer Number" plots distributions of log10 residual stream norms. The distributions show that norm grows exponentially as layer number increases.](https://assets.turntrout.com/static/images/posts/ty8epqxasadhaiel2pnh.avif)
<br/>Figure: We had GPT-4 generate dozens of strings which "look like they could have been in GPT-2's training corpus", in addition to a few hand-written strings. We ran these strings through the model and recorded the norms of each residual stream, across layers and sequence positions (except for position 0, which is EOS padding, discussed later). GPT-2-XL has 48 layers in total.

Here's the norm of each residual stream for a specific prompt:

![A line chart plots the log norm of the residual stream for each token in a prompt. The norm for the tokens "M", "ATS", "is", "really", and "cool" grows exponentially (appearing as a near-straight line on the log scale) with the layer number. The `<|endoftext|>` token's norm is an outlier, rising much more steeply to a higher peak before declining.](https://assets.turntrout.com/static/images/posts/hpgem17ggmbpgnwcvdut.avif)
<br/>Figure: Token position 0 (`<endoftext>`) behaves differently, which is why we exclude it from the averaged plots.

Back in MATS 3.0, Stefan had previously noticed this phenomenon in GPT-2-small:

![A line chart titled "Mean Standard Deviation of Residual Stream activations after layer N" for the gpt2-small model. The x-axis shows the layer index from 0 to 11. The y-axis shows the mean standard deviation, which grows exponentially from about 2 at layer 0 to nearly 16 at layer 11.](https://assets.turntrout.com/static/images/posts/n9zhrfpjljoznctglnbq.avif)
<br/>Figure: Note that Stefan originally used the standard deviation, but it is proportional to the norm because our models have zero mean.[^1]

[Basic Facts about Language Model Internals](https://www.lesswrong.com/posts/PDLfpRwSynu73mxGw/basic-facts-about-language-model-internals-1#_Writing_Weights_Grow_Throughout_The_Network_And_Reading_Weights_Are_Constant) also finds a growth in the norms of the attention-out matrices $W_O$ and the norms of MLP out matrices $W_{\rm out}$ ("writing weights"), while they find stable norms for $W_Q$, $W_K$, and $W_{\rm in}$ ("reading weights"):

> [!quote] [Basic Facts about Language Model Internals](https://www.lesswrong.com/posts/PDLfpRwSynu73mxGw/basic-facts-about-language-model-internals-1#_Writing_Weights_Grow_Throughout_The_Network_And_Reading_Weights_Are_Constant)
>
> ![https://assets.turntrout.com/static/images/posts/qh8w4tmnimfqrwd5cmtu.avif](https://assets.turntrout.com/static/images/posts/qh8w4tmnimfqrwd5cmtu.avif)

# Comparison of various transformer models

We started our investigation by computing these residual stream norms for a variety of models, recovering Stefan's results (rescaled by $\sqrt{d_\text{model}}$) and Alex's earlier numbers. We see a number of straight lines in these logarithmic plots, which shows phases of exponential growth.

![Two plots of residual stream norm (log scale) versus layer index for various transformer models. The top plot, for models like GPT-2 and OPT, shows consistent exponential growth. The bottom plot, for EleutherAI models like GPT-Neo and Pythia, shows varied trends, with some norms decreasing in later layers.](https://assets.turntrout.com/static/images/posts/etviqiegwghguknbglho.avif)
<br/>Figure: Residual stream norms as a function of layer for a variety of open source models. Note the orange line in the GPT-2-XL plot showing the exponential growth factor, which we found to average 1.045.

We are surprised by the _decrease_ in Residual Stream norm in some of the EleutherAI models.[^2] We would have expected that because the transformer blocks can only access the normalized activations, it's hard for the model to "cancel out" a direction in the residual stream. Therefore, the norm always grows. However, this isn't what we see above. One explanation is that the model is able to memorize or predict the LayerNorm scale. If the model does this well enough it can (partially) delete activations and reduce the norm by writing vectors that cancel out previous activations.

The small models (distillgpt2, gpt2-small) have superexponential norm growth, but most models show exponential growth throughout extended periods. For example, from layer 5 to 41 in GPT-2-XL, we see an exponential increase in residual stream norm at a rate of ~1.045 per layer. We showed this trend as an orange line in the above plot.

![A line graph titled "Norm(n)/Norm(n-1) across layers n in GPT2-XL" plots norm growth rate against layer number. Most lines, representing tokens like "M", "ATS", and "is", show a growth rate that quickly drops from a high initial value to a level consistently just above 1.0, indicating steady exponential growth. In contrast, the line for the `<|endoftext|>` token drops significantly and falls below 1.0 after layer 35, showing norm decay.](https://assets.turntrout.com/static/images/posts/esxltdsojqrvlf8aev4p.avif)
<br/>Figure: The dashed line indicates a growth rate of 1 (constant norm). Since the (non-`<endoftext>`) growth rates are approximately constant and above the line, the residual streams are growing exponentially. The GPT-2-XL encoder prepends an `<endoftext>` (BOS) token at residual stream position 0. Its red-colored growth rate is huge at first, but represents an exception.

## BOS and padding tokens

In our initial tests, we noticed some residual streams showed an irregular and surprising growth curve:

![The x-axis is the layer number and the y-axis (L2-Norm) is on a log scale. Each token position gets its own line. Most tokens show a steady exponential increase in norm across layers. In contrast, the token at position 0 (`<endoftext>`) has a much higher norm that forms a U-shape, rising sharply, plateauing, and then dipping near the final layers.](https://assets.turntrout.com/static/images/posts/g9hgkblqcj9dfyg5b22q.avif)
<br/>Figure: The violet U-shape at the top is the BOS token position, and the yellow-green U-shapes correspond to positions of padding tokens. The other tokens show the exponential growth shape as expected.

As for the reason behind this shape, we expect that the residual stream (norm) is predictable at BOS and padding positions. This predictability is because these sequence positions cannot attend to other positions and thus always have the same values (up to positional embedding). Thus it would be no problem for the model to cancel out activations, and our arguments about this being hard do not hold for BOS and padding positions. We don't know whether there is a particular meaning behind this shape.

We suspect that is the source of the U-shape shown below:

> [!quote] [Basic facts about language models during training](https://www.lesswrong.com/posts/2JJtxitp6nqu6ffak/basic-facts-about-language-models-during-training-1#Residual_stream_outliers_grow_rapidly_then_stabilize_and_decline)  
> ![Two bar charts showing "Maximum absolute value ever in residual stream by block" for a 19M and a 125M model. The left chart (19M) shows values across 6 blocks, forming an inverted U-shape that peaks at ~350 in block 3. The right chart (125M) shows values across 12 blocks, which rise from low values to a plateau around 600 for blocks 5-8 before declining.](https://assets.turntrout.com/static/images/posts/m1uteifqbbyox6qp9xnx.avif)

# Theories for the source of the growth

From now on we focus on the GPT-2-XL case. Here is the residual stream growth curve again (orange dots), but also including the `resid_mid` hook between the two Attention and MLP sub-layers (blue dots).

![A scatter plot titled "Norm of Residual Stream activations" charts the L2 norm on a logarithmic scale against the layer index from 0 to 48. Two series of points, for activations "After Attn" and "After MLPs," form a near-straight line sloping upward, indicating the norm grows exponentially through the model's layers.](https://assets.turntrout.com/static/images/posts/uunbh9saw9msutnkndfs.avif)
<br/>Figure: Standard deviations of residual stream activations after each attention and MLP sublayer, averaged across non-EOS positions and across prompts.

Our first idea upon hearing exponential growth was:

> Each OV circuit is a linear function of the residual stream given a fixed attention pattern. Then you add the head OV outputs back into a residual stream, which naively doubles the magnitude assuming the OV outputs have similar norm to the input residual stream. That produces exponential growth.

However, we think that this does not work due to LayerNorm (LN). With LayerNorm, the input into the Attention and MLP sub-layers is normalized to have standard deviation 1 and norm $\sqrt{d_{\rm model}}$ (neglecting the learned LN parameters, which we discuss in this footnote [^3]). Despite this, the Attention and MLP sub-layers have output contributions which increase proportionally to the overall residual stream norm that is exponentially increasing.

We can think of two ways to get exponential growth of the residual stream despite LN:

1. **The Attention and/or MLP weights and/or LN parameters can just be higher in later layers (following this exponential rate).** This is something the model could learn in training, essentially making sure the Attention and MLP outputs grow by 4.5% per layer, independently of the residual stream norm.
2. **Sneaking information through the LayerNorm.** Maybe there is a hidden property (say "number of features") that is not affected by LN but that causes the typical exponential growth "Attention/MLP output proportional is to the number of features". Note that this theory requires (i) LN does not reduce the number of features, but (ii) the number of features affects the norm of Attention/MLP output.

To illustrate the second theory, consider the following toy example where $x$ and $y$ have the same norm, but $x$ contains only one feature (the "alternating" feature) while $y$ contains two features (the "alternating" feature, and the "1st != 3rd number" feature).

$$
x=\frac12\cdot\begin{pmatrix}-1&1&-1&1\end{pmatrix}\quad \text{and} \quad y=\frac12\cdot\begin{pmatrix}-1&1&1&1\end{pmatrix}
$$

$$
W_\text{in}=100 \cdot \begin{pmatrix}-1 & 1 & -1 & 1\\ -1 & 0 & 1 & 0\end{pmatrix} \text{, and sigmoid activation function.}
$$

$$
\text{Then } W_\text{in} x = \begin{pmatrix} 200 \\ 0 \end{pmatrix} \text{ and } W_\text{in} y = \begin{pmatrix} 100 \\ 100 \end{pmatrix}
$$

$$
\text{which gives approximately } \begin{pmatrix} 1 \\ 0 \end{pmatrix} \text{ and } \begin{pmatrix} 1 \\ 1 \end{pmatrix} \text{ after the sigmoid function.}
$$

This way, a property (number of features) can be hidden in the inputs (hidden as in, the inputs have identical norms), and affect the norms of the outputs. This works less nicely with ReLU or GELU but the output norms still differ.

To distinguish these two theories, we can test whether we see an exponential increase in the norm of Attention/MLP weights, or alternatively, an exponential increase in the norm of Attention/MLP outputs on random _layer-independent_ inputs. Either of these would mean we don't need theory 2's sneaking features-shenanigans and can explain the exponential growth as being "hard-coded" into the model weights.

> [!note]
> It's possible for just _one_ of the sub-layer types (attention or MLP) to grow exponentially and still cause the overall exponential growth (see [appendix 1](#appendix-1-attention-mlp-contribution-norms-must-exceed-block-over-block-norm-growth-rate) for a related proof). But this seems unlikely as the non-exponential sub-layer would lose impact on the residual stream, and we expect the model to make use of both of them. Indeed, plotting the outputs `attn_out` and `mlp_out` shows both increasing at the exponential rate (but `attn_out` seems to fall off at layer ~30).
>
> ![A log-linear plot titled "Residual Stream norm" shows the L2 norm of attention and MLP outputs versus layer index. The "mlp_out" line is consistently higher and closely follows a dotted exponential trendline labeled "Slope 1.045^N". The "attn_out" line is lower and follows this trend until about layer 30.](https://assets.turntrout.com/static/images/posts/r13rgvwjn62uuxfobvmd.avif) > <br/>Figure: If you are surprised by the difference in standard deviation between `attn_out` and `mlp_out`, see [appendix 2](#appendix-2-explaining-the-difference-between-attn_out-and-mlp_out).

# Analyzing the model weights to understand the behaviour

We want to know why the residual stream norm is growing. Is it some process that naturally creates an exponential increase (maybe features accumulating in the residual stream)—and how would that work? Or are the weights of later layers inherently larger and thus cause larger outputs?

We know that both `attn_out` and `mlp_out` grow exponentially. In the next two section we look at the Attention and MLP weights, respectively.

> [!note] Summary
> We _do_ find evidence for exponentially increasing weights in both sub-layers, although in both cases we are somewhat confused what is happening.

## Analyzing the Attention weights

**What do we want to get evidence on?**
: We want to know why `attn_out` grows exponentially with layer number: Is the growth a property inherent to the Attention weights in each of the layers (theory 1), or is the growth relying on properties of the residual stream (theory 2).

**What test do we run and why does that give us evidence?**
: We test whether the Attention OV-circuit weights grow exponentially with layer number, at the same rate as the actual Attention outputs `attn_out`. If true, this is evidence for theory 1.

: The Attention layer output `attn_out` is determined by the QK-circuits (select which inputs to attend to), and the OV-circuits (determine how the inputs are transformed). For the purposes of understanding the overall residual stream growth—why the outputs have larger norm than the inputs—we want to focus on the OV-circuits, which determine how the norm changes from input to output.
:
: The OV-circuits consist of the $W_{OV}$ matrices (product of the value $W_V$ and output $W_O$ matrices) and the bias $b_O$.[^4] There are 25 attention heads in GPT-2-XL, i.e. 25 $W_{OV}$ matrices. In the figure below, we plot the Frobenius norm[^5] of the $W_{OV}$ matrices (solid grey lines) and the L2 norm of the $b_O$ vector (pink line). We compare it to the L2 norm of `attn_out` (solid blue line).
:
: ![A line chart titled "Comparing W_OV and b_O norms to attn_out" shows three plots versus layer index on a logarithmic y-axis. A blue line, the "Actual attn_out L2-norm," shows exponential growth. It is closely tracked by a cluster of grey lines representing the "Frobenius-norm of W_OV (indiv. heads)." A pink line, the "L2-norm of b_O," stays low before rising sharply in the final layers.](https://assets.turntrout.com/static/images/posts/z3q2r6bcqrnahcdvhz76.avif)
<br/>Figure: Which components of the Attention mechanism are responsible for the exponential increase in the norm of `attn_out`? We see the $W_{OV}$ norms increase at the same rate as the `attn_out` norms.

: The Frobenius norms of the attention heads (grey lines) match the actual `attn_out` norms (blue line) somewhat accurately, and grow exponentially. The bias term (pink line) seems mostly negligible except for in the final layers.

What we would have liked to find
: That any normalized random input into Attention layer $N$ leads to an Attention output of the observed norm.

What we actually found
: We find that the Attention weights, specifically the $W_{OV}$ norms, grow approximately exponentially at the rate of `attn_out`. This exponential growth is evidence for theory 1: the growth means that the model bothered to learn weights that increase exponentially with layer number. [^6]

: For some unit-normalized, Gaussian-sampled vector $x$, consider the sum of the sum of $W_{OV} \cdot x$ for all 25 $W_{OV}$ matrices (one for each head). This sum's norm is 5 times larger than the `attn_out` norm, as shown in this figure: [^7]

![A log-linear line chart comparing attention component norms to the attention output norm across layers. The Frobenius norms of individual W_OV attention head weights increase with layer number, closely tracking the actual L2-norm of the attention output. The L2-norm of the bias  is negligible until the final layers.](https://assets.turntrout.com/static/images/posts/oqofcuc6vya0jcgdfjy9.avif)

> [!warning] Caveat
> We do not understand the full picture of how `attn_out` is generated. All we show is that the $W_{OV}$ norms grow at the same rate.

## Analyzing the MLP weights

**What do we want to get evidence on?**
: We want to know why `mlp_out` grows exponentially with layer number: Is the growth a property inherent to the MLP weights in each of the layers (theory 1), or is the growth relying on properties of the residual stream (theory 2).

**What test do we run and why does that give us evidence?**
: We test whether feeding layer-independent inputs to the MLPs produces outputs that _do_ scale exponentially with layer, in a way which follows the exponential growth of `mlp_out`.
:
: If this is true, this is evidence for theory 1 and against theory 2. If this is false, we cannot draw strong evidence from this.
:
: We do not attempt to find the right way to combine model weights into a "norm" of the MLP layer. Instead, we draw input vectors from a Normal distribution, and normalize them to mean 0 and variance 1. We feed these vectors into the MLP. [^8]
:
: ![A line chart titled "Norm of MLP output for random input, compared to norm of mlp_out," plotting standard deviation on a log scale against layer index. Both the MLP output for random input and the actual mlp_out show an exponential increase with layer number, matching a dotted reference slope of 1.045^N. The output norm for the random input is consistently higher than for the actual mlp_out.](https://assets.turntrout.com/static/images/posts/tm2sp1zmrdnugcgxcjsy.avif)
:
**What did we find?**
: We find that the MLP outputs of normalized random Gaussian inputs do scale exponentially with layer numbers, for layers 30-43, at the same rate as `mlp_out`. This exponential scaling is evidence for theory 1.

> [!warning] Caveats
> We do not reproduce the `mlp_out` norms but find a much larger output norm with the random inputs. We discuss this further in an appendix, but the bottom line is that random vectors are indeed qualitatively different from residual stream vectors, and notably random vectors cause 4x more of the GELU activation to be active (>0) than normal residual stream vectors. (On the second theory—do random vectors have "more features", and thus higher norm?)

# Why an exponential residual stream norm increase might be useful

Transformers might sometimes want to delete information from the residual stream, maybe to make space for new information. However, since all blocks only receive the normalized (LayerNorm) residual stream, it may be impossible to do deletions the intuitive way of "just write $-v$ to the residual stream" to delete a vector $v$. It might approximately work if the model can predict the LayerNorm scale, but it seems hard to do accurately.

Alternatively, the model could write all new information with an increased norm. An exponential growth would make the most recent layers have an exponentially larger effect on the residual stream at any given layer.

However, this is complicated by weight decay, which is a term in the loss that penalizes large weight magnitudes. While we analyzed GPT-2-XL's weights in this post, we also earlier displayed similar residual stream norm trends for a range of models. The [OPT](https://arxiv.org/pdf/2205.01068.pdf) and [GPT-Neo](https://github.com/EleutherAI/gpt-neo) models were trained with weight decay of 0.1, while the [Pythia models](https://arxiv.org/pdf/2304.01373.pdf) were trained with 0.01. We don't know about `distilgpt2` or the normal GPT-2 series. If models trained with weight decay _still_ exhibit weight norms which increase exponentially with layer number, then that means _something_ is happening which somehow merits an exponential hit to loss.[^9]

ETA 5/7/23: Apparently, LN parameters are often excluded from weight decay. For example, see the [minGPT](https://github.com/karpathy/minGPT/blob/3ed14b2cec0dfdad3f4b2831f2b4a86d11aef150/mingpt/model.py#L136) implementation. This means that the gain parameters can freely magnify the LN output,without incurring extra regularization loss. However, this _also_ suggests that $W_\text{in}$ and $W_{OV}$ should in general become extremely tiny, up to precision limits. The weights should become tiny because their norm can be folded into the LN parameters in order to avoid regularization penalties.

# Conclusion

We documented a basic tendency of transformers: residual stream variance grows exponentially. We think that a big chunk of the exponential increase does come from the model weights, but have not fully understood the underlying mechanics (e.g. GELU activation rates).

> [!note] **Contributions**
>
> Stefan wrote a lot of the post, noticed this in GPT-2-small, compared the phenomenon between models, and did the analysis of activations and weights.
>
> Alex (`TurnTrout`) wrote some of the post and edited it, noticed the phenomenon in GPT-2-XL, made about half of the assets and some of the hooking code for computing residual stream norms. He also wrote the first appendix.

# Appendix 1: Attention + MLP contribution norms must exceed block-over-block norm growth rate

> [!math] Proposition: Attention + MLP norm contributions must exceed the growth rate
>
> Consider residual streams $x_i\in\mathbb{R}^{d_\text{model}}$ for the activation vector just before transformer layer $i$, in a transformer where the MLP comes after the Attention sublayer. Suppose that, for layer $n$, $\frac{|x_n|}{|x_{n-1}|} = g$ for growth rate $g\geq 0$. Then
>
> $$
> g-1\leq \dfrac{|\textrm{Attn}_{n-1}(x_{n-1})| + |\textrm{MLP}\big(x_{n-1}+\textrm{Attn}_{n-1}(x_{n-1})\big)|}{|x_{n-1}|}.
> $$
>
> **Proof**.
>
> $$
> \begin{align*} g&=\frac{|x_n|}{|x_{n-1}|}\\ &=\dfrac{| x_{n-1} + \textrm{Attn}_{n-1}(x_{n-1}) + \textrm{MLP}\big(x_{n-1}+\textrm{Attn}_{n-1}(x_{n-1})\big)|}{|x_{n-1}|}\quad \text{Transformer block}\\ &\leq \dfrac{|x_{n-1}| + |\textrm{Attn}_{n-1}(x_{n-1})| + |\textrm{MLP}\big(x_{n-1}+\textrm{Attn}_{n-1}(x_{n-1})\big)|}{|x_{n-1}|} \quad\text{Triangle inequality}\\ &= 1 + \dfrac{|\textrm{Attn}_{n-1}(x_{n-1})| + |\textrm{MLP}\big(x_{n-1}+\textrm{Attn}_{n-1}(x_{n-1})\big)|}{|x_{n-1}|}. \end{align*}
> $$
>
> Then
>
> $$
> g-1\leq \dfrac{|\textrm{Attn}_{n-1}(x_{n-1})| + |\textrm{MLP}\big(x_{n-1}+\textrm{Attn}_{n-1}(x_{n-1})\big)|}{|x_{n-1}|}.
> $$
>
> ∎

For example, if $g=1.05$, then the norms of the attention and MLP contributions must together be at least 5% of the norm of the `resid_pre` $x_{n-1}$ for layer $n-1$.

# Appendix 2: Explaining the difference between `attn_out` and `mlp_out`

Remembering the two plots from [Theories for the source of the growth](#theories-for-the-source-of-the-growth), we notice a surprisingly large y-axis difference between the norms. We repeat those norm curves here:

![A log-scale plot of L2 norm versus layer index for GPT-2-XL activations. The norms for `resid_mid` and `resid_post` show clear exponential growth from about 30 to over 200. The `mlp_out` norm also grows exponentially from about 10 to 100. The `attn_out` norm is lower and fluctuates erratically.](https://assets.turntrout.com/static/images/posts/xoddfbotuqd8f7r06dl0.avif)

Now we show the same lines again, but switch to using the standard deviation. This representation is equivalent (norm divided by standard deviation equals $\sqrt{D} = 40$) but more intuitive to reason about. We also divide all lines by $1.045^N$ to make the lines fit better into the plot. The difference from `resid_pre` to `resid_post` at each layer has to be approximately a factor for 1.045 for the exponential growth to hold.

![A line chart showing the standard deviation of transformer activations, scaled by 1.045 to the power of the layer index N. The y-axis is logarithmic. The `resid_pre`, `resid_mid`, and `resid_post` lines are clustered at the top, rising sharply then remaining flat. Below, the `mlp_out` line stays relatively constant after an initial drop, while the `attn_out` line trends downwards across layers.](https://assets.turntrout.com/static/images/posts/g8maxnfzj5zw16emepfd.avif)

Intuitively, we expected these standard deviations to add up like those of independent (Gaussian) random vectors, $\sigma_{a+b}^2 = \sigma_a^2 + \sigma_b^2$ ("error propagation" formula), but this doesn't work. We realized that _correlated_ random vectors can have a higher summed variance, up to a maximum of $\sigma_{a+b}^2 = (\sigma_a + \sigma_b)^2$. It would be interesting to see where in that range `attn_out` and `mlp_out` lie, i.e. how correlated the Attention and MLP outputs are with the residual stream input.

![A line plot of scaled standard deviation versus layer index, showing that the actual `resid_mid` line falls within a theoretical shaded "resid_mid range", which lies above the `resid_pre` line.](https://assets.turntrout.com/static/images/posts/sviqtej5pjvoj9gfhlc7.avif)![A line chart showing normalized standard deviation of residual streams versus layer index. It plots three lines in ascending order: "resid_pre," "resid_mid," and "resid_post." The "resid_post" line sits within a wide green shaded "resid_post range" representing possible values, indicating the actual value is much higher than the lower bound for uncorrelated addition.](https://assets.turntrout.com/static/images/posts/w5f0co13ocbpfgmv4h3c.avif)

In both plots we see that the uncorrelated addition of residual stream and sub-layer output (lower end of the range) is _much_ lower that required, providing nowhere near the observed growth for the residual stream. Our (somewhat extreme) upper end of the range is much larger, so if `attn_out` or `mlp_out` were perfectly proportional to their input residual stream we would see a much larger growth.

This does not directly affect our argument, which relies on just realizing the exponential growth at various points. We shared this since we initially did not take into account the correlation, and found this interesting.

# Appendix 3: Which of the MLP weights are the source of the exponential growth?

We showed that the MLP output for random _layer-independent_ inputs grows exponentially with layer number. This proves that there is something inherent to the MLP weights in each layer that causes the output to grow, but it does not show us what that is. The behaviour should be predictable from the MLP weights $W_{\rm in}$, $b_{\rm in}$, $W_{\rm out}$, and $b_{\rm out}$. In this section we want to show our investigation into this question, even though we have not completely solved it. This will also explain the large difference in norm between the random-input MLP output, and the actual-model MLP output we showed (figure from above inserted again)

![A line chart titled "Norm of MLP output for random input, compared to norm of mlp_out," plotting standard deviation on a log scale against layer index. Both the MLP output for random input and the actual mlp_out show an exponential increase with layer number, matching a dotted reference slope of 1.045^N. The output norm for the random input is consistently higher than for the actual mlp_out.](https://assets.turntrout.com/static/images/posts/u6v1tzoqugjeiflzvsut.avif)

Our first step is to plot the norms of the individual MLP weight components. We are surprised to not see any exponential increase at the expected rate in any of these norms!

![A two-panel line chart, "Norms of MLP weight matrices and vectors," plots various component norms against layer index. In the top panel, the norms for `W_in · W_out`, `W_in`, and `b_in · W_out` are shown not to follow an expected exponential slope of 1.045^N. Instead, they follow a much milder exponential. The bottom panel shows the small, flat norm for `b_out`, a bias term.](https://assets.turntrout.com/static/images/posts/dllrookwluijbimrdil6.avif)

The other important part of an MLP layer is the non-linear activation function, in our case GELU. It turns out that the average neuron activation rate (i.e. the fraction of hidden neurons with positive pre-activation values) rises exponentially throughout the network! This rise is an essential component to the exponential growth of `resid_out`. We did not notice this trend in any of the weight matrix norms. Note however that we only observe this exponential growth here from layer 5 til ~20.

In the plot below we see that even the neuron activation rate for random inputs (blue line) rises exponentially, so the exponential increase _is_ still inherent to the layer weights, it was just not visible in the norms.

The plot below also explains the difference in L2 norm between actual `mlp_out` and the random outputs (the first plot in this appendix): The neuron activation rate is simply much higher for random inputs (blue line) than in the actual model run (red line), or for randomly resampled[^10] residual stream inputs (orange and green lines). The random vectors clearly differ from actual residual stream vectors in some significant way, but we have not investigated this further.

![GELU neuron activation rate across 48 transformer layers. The rate for random inputs is consistently higher than for actual model runs or resampled residual streams. Both random and actual inputs show an exponential increase, highlighted by dotted lines with a slope of 1.045^N.](https://assets.turntrout.com/static/images/posts/ncolo4itac8yxdmklpwo.avif)

[^1]:
    Note on norm, variance, and mean of the residual stream: All our models' residual streams have mean zero. One can always rewrite the model weights to make the residual stream mean zero, by subtracting the mean of weights from the weights themselves. We use the [TransformerLens library which does this](https://neelnanda-io.github.io/TransformerLens/transformer_lens.html#transformer_lens.HookedTransformer.HookedTransformer.center_writing_weights) by default (`center_writing_weights`). Then the L2 norm $||x||_2$ and variance or standard deviation are related

    $$
    {\rm Var} = E[(x-\mu)^2]-E[x]^2 = E[x^2] = ||x||_2^2/D,\\ \quad {\rm Std}=||x||_2/\sqrt{D}
    $$

    with the residual stream size $D$.

[^2]: According to [the model card](https://huggingface.co/EleutherAI/pythia-12b-v0), the Pythia models have "exactly the same" architectures as their OPT counterparts.
[^3]:
    We fold together the LayerNorm weights with the following $W_{\rm in}$ or $W_{OV}$ weights. So when we show an exponential increase in, say, $W_{OV}$ weights this might actually be fully or partially coming from the LayerNorm weights. It does not make a conceptual difference (the model still stores exponentially increasing weights), but may affect regularization.

    That is, after each residual stream is set to mean 0 and std 1, LN applies learned gain parameters. If the residual stream norm can be recovered using these gain parameters, then there are only $d_\text{model}$ such parameters to scale (and thus penalize). But if $W_\text{in}$ has to amplify the post-LN residual stream, then there are $4\cdot d_\text{model}^2$ parameters which would have to be scaled up by the same amount. This roughly seems like a quadratic increase in the regularization term in the loss function, but this is just a heuristic guess.

    Edited after posting: Apparently LN parameters are not, in general, weight-decayed.

[^4]: The value-bias $b_V$ is set to zero in TransformerLens using another weight-rewrite trick.
[^5]: According to Stefan's experimental data, the Frobenius norm of a matrix $W$ is equivalent to the expectation value of the L2 vector norm of $W\cdot x$ for a random vector $x$ (sampled from normal distribution and normalized to mean 0 and variance 1). So calculating the Frobenius norm seems equivalent to testing the behaviour on random inputs. Maybe this is a theorem?
[^6]: If GPT-2 is [using weight decay](https://nostalgebraist.tumblr.com/post/642136680709652480/gpt2s-weight-decay), then the model learning exponentially large weights is a strong sign that this exponential scaling is _really necessary for something else loss-relevant._ Apparently the model is taking an exponential loss hit in order to implement these increasing weight norms. Edited after posting: Apparently LN parameters are not, in general, weight-decayed.
[^7]: Possible reasons for this discrepancy: (i) We do not take the attention pattern into account. The attention could give above-average weight to the BOS token whose OV-circuit output may be smaller. (ii) We measured the output norm for a random Gaussian input which may be a bad model for the residual stream.
[^8]: Seeing the exponential growth ($\propto$ `mlp_out`) here would not be necessary but would be sufficient as evidence for theory 1 and against theory 2. This is because random vectors might qualitatively differ from typical residual stream activations and not reproduce the typical behaviour. If they _do_ however reproduce the `mlp_out` scaling, this is unlikely to be coincidence.
[^9]: Note that we used TransformerLens to test all models, which (by default) employs several weight-rewriting tricks (such as `fold_ln`, `center_writing_weights`) that do _not_ change the model output, but _might_ affect the regularization.
[^10]: Randomly resampled `resid_mid` activations, taken from positions 1 to 6 to avoid BOS and padding tokens.
