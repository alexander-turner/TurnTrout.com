---
permalink: open-category-classification
lw-was-draft-post: 'false'
lw-is-af: 'false'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/txGJZAPjraYEQfHq2/open-category-classification
lw-is-question: 'false'
lw-posted-at: 2018-03-28T14:49:23.665000Z
lw-last-modification: None
lw-curation-date: None
lw-frontpage-date: 2018-03-28T14:50:14.336000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 6
lw-base-score: 14
lw-vote-count: 11
af-base-score: 5
af-num-comments-on-upload: 0
publish: true
title: Open-Category Classification
lw-latest-edit: 2018-03-28T14:49:23.665000Z
lw-is-linkpost: 'false'
tags:
  - AI
aliases:
  - open-category-classification
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2018-03-28 00:00:00
original_url: https://www.lesswrong.com/posts/txGJZAPjraYEQfHq2/open-category-classification
skip_import: '"true"'
description: 'Open-category classification: How can we penalize classifiers which
  overgeneralize from their training data?'
date_updated: 2025-06-03 22:57:00.423836
---








# Introduction

> [!quote] [AI Alignment: Why It's Hard and Where to Start](https://intelligence.org/2016/12/28/ai-alignment-why-its-hard-and-where-to-start/#recent-topics)
>
> If I present you with five examples of burritos, I don’t want you to pursue the _simplest_ way of classifying burritos versus non-burritos. I want you to come up with a way of classifying the five burritos and none of the non-burritos that **covers as little area as possible in the positive examples**, while still having enough space around the positive examples that the AI can make a new burrito that’s not molecularly identical to the previous ones.

Consider the problem of designing classifiers that are able to reliably say "I don't know" for inputs well outside of their training set. In the literature, this problem is known as [_open-category classification_](https://arxiv.org/abs/1705.08722); a closely related problem in AI safety is [_inductive ambiguity detection_](https://agentfoundations.org/item?id=467).

Solution of generalized inductive ambiguity detection could allow for agents who robustly know when to ask for clarification; in this post, we discuss the problem in the context of classification. Although narrower in scope, the solution of the classification subproblem would herald the arrival of robust classifiers which extrapolate conservatively and intuitively from their training data.

Obviously, we can't just train classifiers to "recognize" the `unknown` class. One, this class isn't compact, and two, it doesn't make sense - it's a map/territory confusion (the label `unknown` is a feature of the world model, not a meaningful ontological class). Let's decompose the concept a bit further.

Weight regularization helps us find a mathematically simple volume in the input space which encapsulates the data we have seen so far. In fact, a binary classifier enforces a hyperplane which cleaves the _entire_ space into two volumes in a way which happens to nearly optimally classify the training data. This hyperplane may be relatively simple to describe mathematically, but the problem is that the two volumes created are far too expansive.

In short, we'd like our machine learning algorithms to learn explanations which fit the facts seen to date, are simple, and don't generalize too far afield.

> [!quote] [Conservatism](https://arbital.com/p/conservative_concept/)
>
> Conservatism and conservative planning seems like it might directly tackle some standard concerns \[in alignment\] head-on and in a sufficiently basic way to avoid loopholes, and might also be subject to those concerns. E.g.:
>
> - [Edge instantiation](https://arbital.com/p/edge_instantiation/) - if in full generality we don't go to the edge of the graph but try to stay in the center of what's already been positively classified, maybe we can avoid this.
> <!-- vale off -->
> - [Unforeseen maximum](https://arbital.com/p/unforeseen_maximum/) \- if we stick to things very similar to already positively classified instances, we won't automatically go into the unimagined parts of the graph.
> <!-- vale on -->
> - [Context disaster](https://arbital.com/p/context_disaster/) - a sufficiently conservative optimizer might go on using options similar to previously whitelisted ones even if large new sections of planning space opened up.

# Prior Work

[Taylor et al.](https://agentfoundations.org/item?id=467) provide an overview of relevant research. [Taylor also introduced an approach](https://agentfoundations.org/item?id=467) for rejecting examples from distributions too far from the training distribution.

[Yu et al.](https://arxiv.org/abs/1705.08722) employed adversarial sample generation to train classifiers to distinguish seen from unseen data, achieving moderate success. [Li and Li](https://agentfoundations.org/item?id=467)[^1] trained a classifier to sniff out adversarial examples by detecting whether the input is from a different distribution. Once detected, the example had a local average filter applied to it to recover the non-adversarial original.

[The Knows What It Knows](https://dl.acm.org/citation.cfm?id=1390228) framework allows a learner to avoid making mistakes by deferring judgment to a human some polynomial number of times. However, this framework makes the unrealistically strong assumption that the data are _i.i.d._; furthermore, efficient KWIK algorithms are not known for complex hypothesis classes (such as those explored in neural network-based approaches).

# Penalizing Volume

If we want a robust `cat` / `unknown` classifier, we should indeed cleave the space in two, but with the vast majority of the space being allocated to `unknown`. In other words, we're searching for the smallest, simplest volume which encapsulates the cat training data.

The _smallest_ encapsulation of the training data is a strange, contorted volume only encapsulating the training set. However, we still penalize model complexity, so that shouldn't happen. As new examples are added to the training set, the classifier would have to find a way to expand or contract its class volumes appropriately. Changing the class volumes is conceptually similar to [version space learning](https://en.wikipedia.org/wiki/Version_space_learning).

This may be advantageous compared to current approaches in that we aren't training an inherently incorrect classifier to prune itself or to sometimes abstain. Instead, we structure the optimization pressure in such a way that conservative generalization is the norm. [^2]

## Formalization

Let $V$ be a function returning the proportion [^3] of input space volume occupied by non-`unknown` classes: $\frac{|\text{inputs not classified as }unknown|}{|\text{all inputs}|}$. We need some function which translates this to a reasonable penalty (as the proportion alone would be a rounding error in the overall loss function). For now, assume this function is $\hat{V}$.

We observe a datum $x$ whose ground truth label is $y$. Given loss function $\mathcal{L}$, weights $\theta$, classifier $f_θ$, complexity penalty function $R$, and $λ_1,λ_2\in \mathbb{R}$, the total loss is

$$
\mathcal{L}(y,f_\theta(x)) + \lambda_1R(\theta) + \lambda_2 \hat{V}(f_\theta).
$$

Depending on the formulation of $\hat{V}$, $f_θ$ may elect to misclassify a small amount of data to avoid generalizing too far. If more similar examples are added, $\mathcal{L}$ exerts an increasing amount of pressure on $f_θ$, eventually forcing expansion of the class boundary to the data points in question. This optimization pressure seems desirable.

We then try to minimize expected total loss over the true distribution $X$:

$$

\argmin_{\theta} \mathbb{E}_{x,y\sim X}\left[\mathcal{L}(y,f_\theta(x)) + \lambda_1R(\theta) + \lambda_2 \hat{V}(f_\theta)\right].
$$

# Tractable Approximations

Exhaustively enumerating the input space to calculate $V$ is intractable - the space of $256×256$ RGB images is of size $256^{3^{256×256}}$. How do we measure or approximate the volume taken up by the non-`unknown` classes?

## Black Box

- Random image sampling wouldn't be informative (beyond answering "is this class extending indefinitely along arbitrary dimensions?").
- [Yu et al.'s results](https://arxiv.org/abs/1705.08722) weakly suggest that adversarial approaches can approximate the hypersurface of the class boundaries.
- [Bayesian optimization](https://en.wikipedia.org/wiki/Bayesian_optimization) could deduce the hypersurface of the class boundaries, giving a reasonable estimate of volume.
- The continuous latent space of a [variational autoencoder](https://arxiv.org/abs/1312.6114) could afford new approximation approaches for $\hat{V}$ (more on this later).

## Analytic

We do know the details of $f_\theta$ - how can we exploit this?

**Decision trees** offer a particularly simple solution. Consider a decision tree on a one grayscale pixel input space; the tree outputs `unknown` if pixel value $x > 127$ and `dog` otherwise. Then without having to run a single input through the tree, we find the proportion of the space taken up by non-`unknown` classes to be $1-\frac{128}{256}=.5$.

This result generalizes to any decision tree over discrete variables; simply calculate in closed form how many possible inputs conform to the conditions for each `unknown` leaf, and add them up. For an input space $S$ classified by a decision tree with $m$ nodes, we reduce the time complexity from $O(|S|)$ to $O(m)$. This reduction is great, as it is almost always the case that $|S| \gg m$.

**Neural networks** are a bit trickier. Work has been done on [extracting decision trees from neural networks](http://dspace.library.iitb.ac.in/jspui/bitstream/10054/1285/1/5664.pdf), but this requires training a new network to do so and the resulting trees may not have sufficient fidelity.

Since the output of a one hidden-layer neural network can be represented as the linear equation $WX=Z$, we can, perhaps, simply fix $W$ ( $\theta$) and $Z$ (the layer's output values) to solve for $X$ (the input). Given such a solution, we might, in theory, be able to calculate the volume by integrating over the possible $Z$ values for each classification. The [universal approximation theorem](https://en.wikipedia.org/wiki/Universal_approximation_theorem) shows that a one hidden-layer neural network (with perhaps an exponential number of nodes) can approximate any function.

All this is getting a bit silly. After all, what we really care about is the proportion of the input space taken up by non-`unknown` classes; we don't necessarily need to know exactly _which_ inputs correspond to each output.

## White Box

Let's treat this as a prediction problem. Take $n$ randomly generated images and run them through the first layer of the network, recording the values for the activation of node $k$ in the first layer ($a_{1k}$); assume we incur some approximation error $\epsilon$ due to having insufficiently sampled the true distribution. Derive a PDF over the activation values for each node.

Repeat this for each of the $l$ network layers, sampling input values from the PDFs for the previous layer's nodes. At the end of the network, we have a probabilistic estimate of the output class proportions.

However, this may only yield results comparable to random image sampling, as many node activations may not occur often for arbitrary data. While this would be descriptive of the input space as a whole, it would be unlikely to sample any `cat` images, for example.

## Blessing of Dimensionality

In my opinion, the most promising approach involves abusing the properties of high-dimensional volumes; in particular, the well-known [Curse of Dimensionality](https://en.wikipedia.org/wiki/Curse_of_dimensionality).

To illustrate, the volume of a ball in $p$ dimensions is

$$
V_p(R)=\frac{\pi^{\frac{p}{2}}}{\Gamma(\frac{p}{2}+1)}R^p,
$$

where $R$ is the radius of the ball and $\Gamma$ is the [Gamma function](https://en.wikipedia.org/wiki/Gamma_function).

For high-dimensional volumes, the overwhelming majority of points in the $p$\-ball are located in the outer shell. How do we know this? For $N$ points uniformly distributed in a $p$\-dimensional unit ball (a ball with $R=1$), the median distance from the closest data point to the origin is defined as

$$
d(p,N)=\left(1-\frac{1}{2}^\frac{1}{N}\right)^\frac{1}{p}.
$$

If we distribute $10{,}000$ points in the $1{,}000$\-dimensional unit ball, the _closest_ point to the center has a median distance of $.9905$. The _vast, vast majority_ of the points we uniformly distributed find themselves at the outermost reaches of the ball. This distribution is fantastic news (for mathematical and visual intuitions as to why, read [this](https://towardsdatascience.com/intuitively-understanding-variational-autoencoders-1bfe67eb5daf)).

Train a variational autoencoder with a $k$\-dimensional latent space on the dataset $D_{train}$. Then train a [multilayer perceptron](https://en.wikipedia.org/wiki/Multilayer_perceptron) $f_\theta$ to classify $D_{train}$ using the latent representation of each image. [^4] This is the network to which we will apply the volume penalty. New images will be translated to the latent space by the trained encoder and then fed to $f_\theta$ for classification. ​

![A scatter plot visualizing the 2D latent space of a variational autoencoder trained on MNIST digits. Thousands of points are colored by digit class, forming somewhat distinct clusters. To illustrate, three decoded handwritten digit images are shown at their corresponding points: a "1" in the yellow cluster, and two different "2"s in a mixed intersection of clusters.](https://assets.turntrout.com/static/images/posts/1*BIDBG8MQ9-Kc-knUUrkT3A.avif)
Figure: Variationally encoded MNIST digits, with clustering pressure provided by reconstruction loss and density encouraged by KL loss. ([Image credit](https://towardsdatascience.com/intuitively-understanding-variational-autoencoders-1bfe67eb5daf))

We're basically going to do high-dimensional [LIDAR](https://en.wikipedia.org/wiki/Lidar) [^5] in the latent space to image the outer shell of $f_\theta$'s non-`unknown` classification volumes. Due to the blessing of dimensionality, we don't need to worry whether the inside of the volume is classified as `unknown` or not - for high-dimensional latent spaces, it's a rounding error. Therefore, we need only search until we reach a non-`unknown` classification shell; we could then start from the other direction to estimate the other side. After doing this for all dimensions, we have a set of points approximating the hypersurface of the non-`unknown` classification volume.

The complexity of this seems to be $O(kmn^{k-1})$, where $k$ is latent space dimensionality, $m$ is how many sampling operations are needed on average [^6] to reach the outer shell, and $n$ is the per-dimension sampling density (for example, $n=10$ points along an axis in a 3-dimensional space would entail pinging a grid of $10^{3-1}=100$ points). Although exponential in $k$, this is already orders of magnitude more tractable than sampling the original high-dimensional input space. By sacrificing some accuracy, we may be able to improve the exponential term further (perhaps to $\log k$ or even a constant).

We should be able to provably bound our error as a function of the latent space dimensionality and the sampling density; due to the blessing of dimensionality, these bounds are likely to be sufficiently tight. [^7] Although increasing the dimensionality tightens the bound on the volume approximation error, it also increases compute time exponentially (as of this initial formulation).

This approach requires that the latent space have enough dimensions to allow for `unknown` inputs to not be encoded to areas occupied by known classes. If this is not feasible, there are other architectural choices available. Note that we need not compute the exact proportion of `unknown`\-labeled inputs, but rather an approximation; therefore, as long as the latent space has a reasonable number of features, it likely doesn't need to encode _all_ relevant features.

# Future Directions

Extremely small input spaces allow for enumerative calculation of volume. By pitting a volume-penalizing classifier against its vanilla counterpart in such a space, one could quickly gauge the promise of this idea.

If the experimental results support the hypothesis, the obvious next step is to formulate tractable approximations of $V$ (ideally with provably bounded error).

# Conclusion

This proposal may be an intractable robust solution to the open-category classification problem, with several promising tractable approaches already apparent.

[^1]: One of whom was my excellent deep learning professor.
[^2]: This approach is inspired by the [AI safety mindset](https://arbital.com/p/AI_safety_mindset/) in that the classifier strives to be conservative in extrapolating from known data.
[^3]: Set underflow aside for the moment.
[^4]: I've updated from my previous position that the _i.i.d._ assumption about future data implied by a latent space is disqualifying. Although the latent space's structure would indeed make assumptions, the space would still approximate the volumetric properties of the `unknown`/non-`unknown` portions of the input space for the _current classifier_. Ultimately, this is what we care about!
[^5]: I'm sure there's a formal name for this technique, but I don't know it.
[^6]: Due to the statistical properties of variational autoencoders, it's possible that this could be done quickly using bounded binary search.
[^7]: Unlike in the $p$\-ball example, the encoded points are distributed normally (as opposed to uniformly). This isn't necessarily directly relevant, as we're measuring $\hat{V}$ with respect to the multilayer perceptron's input space - the latent space (which, after being discretized and bounded, has uniformly "distributed" points).
