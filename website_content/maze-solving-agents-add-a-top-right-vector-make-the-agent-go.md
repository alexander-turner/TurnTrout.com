---
permalink: top-right-steering-vector
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/gRp6FAWcQiCWkouN5/maze-solving-agents-add-a-top-right-vector-make-the-agent-go
lw-is-question: 'false'
lw-posted-at: 2023-03-31T19:20:48.658000Z
lw-last-modification: 2023-04-17T00:53:42.453000Z
lw-curation-date: None
lw-frontpage-date: 2023-03-31T23:58:21.046000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 17
lw-base-score: 101
lw-vote-count: 37
af-base-score: 37
af-num-comments-on-upload: 7
publish: true
title: 'Maze-solving agents: Add a top-right vector, make the agent go to the top-right'
lw-latest-edit: 2023-04-17T00:53:43.463000Z
lw-is-linkpost: 'false'
authors: Alex Turner, Peli Grietzer, and Lisa Thiergart
tags:
  - AI
  - activation-engineering
aliases:
  - maze-solving-agents-add-a-top-right-vector-make-the-agent-go
lw-sequence-title: Interpreting a Maze-Solving Network
lw-sequence-image-grid: sequencesgrid/fu4vhd1ud5y4niijbicd
lw-sequence-image-banner: sequences/hvtmmyas8pxbcm28wpvv
sequence-link: posts#interpreting-a-maze-solving-network
prev-post-slug: understanding-and-controlling-a-maze-solving-policy-network
prev-post-title: Understanding and controlling a maze-solving policy network
next-post-slug: statistics-of-a-maze-solving-network
next-post-title: Behavioural statistics for a maze-solving agent
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2023-03-31 00:00:00
original_url: 
  https://www.lesswrong.com/posts/gRp6FAWcQiCWkouN5/maze-solving-agents-add-a-top-right-vector-make-the-agent-go
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/lteqnk5fbayr0jixir5z.png
description: Adding a "top-right vector" makes a maze-solver go to the top-right.
  We show composition with other vectors, like the "cheese vector."
date_updated: 2025-04-12 09:51:51.137842
---











We modify the goal-directed behavior of a trained network, without any gradients or finetuning. We simply add or subtract "motivational vectors" which we compute in a straightforward fashion.

In the [original post](/understanding-and-controlling-a-maze-solving-policy-network), we defined a "cheese vector" to be "the difference in activations when the cheese is present in a maze, and when the cheese is not present in the same maze." By subtracting the cheese vector from all forward passes in a maze, the network ignored cheese.

I (Alex Turner) present a "top right vector" which, when added to forward passes in a range of mazes, attracts the agent to the top-right corner of each maze. Furthermore, the cheese and top-right vectors _compose_ with each other, allowing (limited but substantial) mix-and-match modification of the network's runtime goals.

I provide further speculation about the algebraic value editing conjecture:

> It's possible to deeply modify a range of alignment-relevant model properties, without retraining the model, via techniques as simple as "run forward passes on prompts which e.g. prompt the model to offer nice- and not-nice completions, and then take a 'niceness vector', and then add the niceness vector to future forward passes."

I close by asking the reader to make predictions about our [upcoming experimental results on language models.](/gpt2-steering-vectors)

> [!note]
> This post presents some of the results in this [top-right vector Google Colab](https://colab.research.google.com/drive/1CZJ9M9nkh4Ho2tkWopnvx7FnjGNjVtSo?usp=sharing), and then offers speculation and interpretation.

> [!thanks]
> I produced the results in this post, but the vector was derived using a crucial observation from Peli Grietzer. Lisa Thiergart independently analyzed top-right-seeking tendencies, and had previously searched for a top-right vector. A lot of the content and infrastructure was made possible by my [MATS](http://serimats.org/) 3.0 team: Ulisse Mini, Peli Grietzer, and Monte MacDiarmid. Thanks also to Lisa Thiergart, Aryan Bhatt, Tamera Lanham, and David Udell for feedback and thoughts.

# Background

This post is straightforward as long as you remember a few concepts:

- Vector fields, vector field diffs, and modifying a forward pass. AKA you know what this figure represents:

![](https://assets.turntrout.com/static/images/posts/tly1j6ydizgjnjjcocke.avif)

- How to derive activation-space vectors (like the "cheese vector") by diffing two forward passes, and add / subtract these vectors from future forward passes
  - AKA you can understand the following: "We took the cheese vector from maze 7. ~Halfway through the forward passes, we subtract it with coefficient 5, and the agent avoided the cheese."

If you don't know what these mean, read this section. If you understand, then skip.

> [!quote] [Understanding and Controlling a Maze-Solving Network](/understanding-and-controlling-a-maze-solving-policy-network)
>
> [Langosco et al.](https://arxiv.org/abs/2105.14111) trained a range of maze-solving nets. We decided to analyze one which we thought would be interesting. The network we chose has 3.5M parameters and 15 convolutional layers.
>
> ![](https://assets.turntrout.com/static/images/posts/vpfzpqv3tkzmu0glog3e.avif)
> <br/>Figure: During RL training, cheese was randomly located in the top-right 5×5  corner of the randomly generated mazes. Reaching the cheese yields +1 reward.
>
> In deployment, cheese can be anywhere.
>
> ![](https://assets.turntrout.com/static/images/posts/g9hyfgk5fsuuriukkkle.avif)
> <br/>Figure: At each square in the maze, we run a forward pass to get the policy's action probabilities at that square.
>
> ![](https://assets.turntrout.com/static/images/posts/tb7ri6d5gqhxef1ocd8t.avif)
> <br/>Figure: Example vector fields of policy outputs.
>
> <hr/>
>
> What did we do here? To compute the cheese vector, we
>
> 1. Generate two observations—one with cheese, and one without. The observations are otherwise the same.
> 2. Run a forward pass on each observation, recording the activations at each layer.
> 3. For a given layer, define the cheese vector to be `CheeseActivations - NoCheeseActivations`. The cheese vector is a vector in the vector space of activations at that layer.
>
> Let's walk through an example, where for simplicity the network has a single hidden layer, taking each observation (shape `(3, 64, 64)` for the 64x64 RGB image) to a two-dimensional hidden state (shape `(2,)`) to a logit vector (shape `(15,)` ).
>
> ![](https://assets.turntrout.com/static/images/posts/pgymxk8ado9jey8rjnra.avif)
>
> 1. We run a forward pass on a batch of two observations, one with cheese (note the glint of yellow in the image on the left!) and one without (on the right).
> 2. We record the activations during each forward pass. In this hypothetical,
>     - `CheeseActivations := (1, 3)`
>     - `NoCheeseActivations := (0, 2)`
> 3. Thus, the cheese vector is $(1, 3) - (0, 2) = (1, 1)$.
>
> Now suppose the mouse is in the top-right corner of this maze. Letting the cheese be visible, suppose this would _normally_ produce activations of $(0,0)$. Then we modify the forward pass by subtracting the cheese vector from the normal activations, giving us $(0,0)-(1,1)=(-1,-1)$ for the modified activations. We then finish off the rest of the forward pass as normal.
>
> In the real network, there are a lot more than two activations. Our results involve a 32,768-dimensional cheese vector subtracted from about halfway through the network.
>
> ```mermaid
> graph TD
>     subgraph ImpalaBlock[Impala block]
>         IB_X[x] --> IB_Conv[Conv]
>         IB_Conv --> IB_MaxPool[MaxPool2D]
>         IB_MaxPool --> IB_Res1[Residual block]:::green
>         IB_Res1 --> IB_Res2[Residual block]
>     end
> 
>     subgraph ResidualBlock[Residual block]
>         RB_X[x] --> RB_ReLU1[ReLU]
>         RB_ReLU1 --> RB_Conv1[Conv]
>         RB_Conv1 --> RB_ReLU2[ReLU]
>         RB_ReLU2 --> RB_Conv2[Conv]
>         RB_X --> RB_Add[Residual add]:::green
>         RB_Conv2 --> RB_Add
>     end
> ```
>
> ```mermaid
> graph TD
>   subgraph OverallGraph["Forward pass"]
>     Input --> Impala1
>           Impala1["Impala<sub>1</sub>"] --> Impala2:::green
>           Impala2["Impala<sub>2</sub>"] --> Impala3
>           Impala3["Impala<sub>3</sub>"] --> ReLU1
>           ReLU1["ReLU"] --> Flatten
>           Flatten --> Linear
>           Linear --> ReLU2
>           ReLU2["ReLU"] --> PolicyHead[Policy head, linear]
>           ReLU2 --> ValueHead[Value head, linear]
>   end
> ```
>
> Code: We modify the activations after the residual add layer in the first residual block of the second Impala block.
>
> Now that we're done with preamble, let's see the cheese vector in action! Here's a seed where subtracting the cheese vector is effective at getting the agent to ignore cheese:
>
> ![](https://assets.turntrout.com/static/images/posts/tly1j6ydizgjnjjcocke.avif)
> <br/>Figure: Vector fields for the mouse normally, for the mouse with the cheese vector subtracted during every forward pass, and the diff between the two cases.
>
> How is our intervention not trivially making the network output logits as if the cheese were not present? Is it not true that the activations at a given layer obey the algebra of `CheeseActiv - (CheeseActiv - NoCheeseActiv) = NoCheeseActiv`?
>
> The intervention is not trivial because we compute the cheese vector based on observations when the mouse is at the _initial_ square (the bottom-left corner of the maze), but apply it for _forward passes throughout the entire maze_ — where the algebraic relation no longer holds.

# Finding the top-right vector

A few weeks ago, I was expressing optimism about AVEC working in language models. Someone on the team expressed skepticism and said something like "If AVEC is so true, we should have more than just one vector in the maze environment. We should have more than just the cheese vector."

I agreed. If I couldn't find another behavior-modifying vector within a day, I'd be a lot more pessimistic about AVEC. In January, I had already failed to find additional X-vectors (for X != cheese). But now I understood the network better, so I tried again.

I thought for five minutes, sketched out an idea, and tried it out (with a [prediction of 30%](https://predictionbook.com/predictions/210987) that the literal first thing I tried would work). The literal first thing I tried worked.

I present to you: the top-right vector! We compute it by diffing activations across two environments: a normal maze, and a maze where the reachable[^2] top-right square is higher up.

![](https://assets.turntrout.com/static/images/posts/a07dc2d01d72560d98bc92850b2ebbf47d80d6adec380a00.avif)

Peli Grietzer had noticed that when the top-right-most reachable square is closer to the absolute top-right, the agent has an increased tendency to go to the top right.

![](https://assets.turntrout.com/static/images/posts/84b9c21c9ed43a2eb402ccd919f0bf8efc9cf3e058acbbf9.avif)
<br/>Figure: When there is a path to the absolute top-right of the maze, the agent is more strongly attracted to the top-right.

As in the cheese vector case, we get a "top right vector" by:

1. Running a forward pass on the "path to top-right" maze, and another forward pass on the original maze, and storing the activations for each. In both situations, the mouse is located at the starting square, and the cheese is not modified.
2. About halfway through the network (at the second Impala block's first residual add, just like for the cheese vector[^3]), we take the difference in activations to be the "top right vector."

We then add `×` halfway through forward passes elsewhere in the maze, where the input observations differ due to different mouse locations.

If this is confusing, consult the ["Computing the cheese vector" subsection](/understanding-and-controlling-a-maze-solving-policy-network#Computing-the-cheese-vector) of the original post, or return to the Background section. If you do that and are _still_ confused about what a top-right vector _is_, please complain and leave a comment.

If you're confused why the hell this _works_, join the club.

<hr/>

In [Understanding and controlling a maze-solving net](/understanding-and-controlling-a-maze-solving-policy-network), I noted that sometimes the agent doesn't go to the cheese _or_ the top-right corner:

![](https://assets.turntrout.com/static/images/posts/o24edwffjw5id3xexkjp.avif)

Adding the top-right vector fixes this:

![](https://assets.turntrout.com/static/images/posts/e47f0dabeefa14dcb8f3fe085321b1d5811a8eaaf33ea5c9.avif)

![](https://assets.turntrout.com/static/images/posts/1d4b943c0da13934e7e8f840ffb74dfbeb94c079c062cda0.avif)![](https://assets.turntrout.com/static/images/posts/259358659e52a41e71137063f2b6a1581edb7f1f94917e03.avif)

Smaller mazes are usually (but not always) less affected:

![](https://assets.turntrout.com/static/images/posts/1c8a90cdac261e82878f96d26bd8b427acb9172264b81328.avif)

The agent also tends to be less [retargetable](/understanding-and-controlling-a-maze-solving-policy-network#Retargeting-the-agent-to-maze-locations) in smaller mazes. I don't know why.

## Adding the top-right vector with different coefficient strengths

Sometimes, increasing the coefficient strength increases the strength of the effect:

![](https://assets.turntrout.com/static/images/posts/ac14199ceade1804865afdba055935c51f0f40713b8d18b1.avif)![](https://assets.turntrout.com/static/images/posts/f8c8656601b0160e2592c30577cccce9b39bab057530d55c.avif)

Sometimes, increasing the coefficient strength doesn't change much:

![](https://assets.turntrout.com/static/images/posts/88bd2e9f53611e85df2e543f2c8eaaa7b45fc77907609ec0.avif)

Push the coefficient too far, and the action distributions crumble into garbage:

![](https://assets.turntrout.com/static/images/posts/f048f4935f660dbfe88a3f6bd01b33474cfb002ffa0b649e.avif)

![](https://assets.turntrout.com/static/images/posts/61b57472cb0df87aa137e65bdf25700470e6cafa436d997f.avif)

## Subtracting the top-right vector has little effect

Here's another head-scratcher. Just as [you can't](/understanding-and-controlling-a-maze-solving-policy-network#Not-much-happens-when-you-add-the-cheese-vector)[^4] [_add_ the cheese vector](/understanding-and-controlling-a-maze-solving-policy-network#Not-much-happens-when-you-add-the-cheese-vector) to increase cheese-seeking, you can't _subtract_ the top-right vector to decrease the probability of going to the top-right:

![](https://assets.turntrout.com/static/images/posts/dc2216de8b3eb4db315ed6dee8e2b24c2ed01cb96118d7cb.avif)![](https://assets.turntrout.com/static/images/posts/bed921e1a98b32ee5e5fe899e1e2d9ce9ae2ed50dfab0c49.avif)

I wish I knew why.

## The top-right vector transfers across mazes

Let's compute the top-right vector using e.g. source seed 0:

![](https://assets.turntrout.com/static/images/posts/1b5ff2ae806616711f39982e03cf96344499ee36024ca9f9.avif)

And then apply it to e.g. target seed 2:

![](https://assets.turntrout.com/static/images/posts/3649e88dfdd09364e906a93a7e029ba71bab9b6e1e33bc69.avif)
<br/>Figure: Success!

For the `seed 0 → seed 28` transfer, the modified agent doesn't _quite_ go to the top-right corner. Instead, there seems to be a "go up and then right" influence.

![](https://assets.turntrout.com/static/images/posts/23a3d9e657b77176e6f51d84c94702bcf38633284c08b178.avif)

Seed 0's vector seems to transfer quite well. However, top-right vectors from small mazes can cause strange pathing in larger target mazes:

![](https://assets.turntrout.com/static/images/posts/5d81c01f7ed33639edb750e62f3a8bd21b832f520f32bae1.avif)
<br/>Figure: The agent competently navigates to central portions of the larger maze.

# Composing the activation additions

Subtracting the cheese vector often makes the agent (nearly) ignore the cheese, and adding the top-right vector often attracts the agent to the top-right corner. It turns out that you can mix and match these effects by adding one or both vectors halfway through the forward pass.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/w_940.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/w_940.webm" type="video/webm"></video>

Figure: **Different x-vectors have roughly additive effects.** The indicated modification(s) are applied by adding the relevant vector(s) to the activations at [the second Impala block's first residual addition](https://assets.turntrout.com/static/images/posts/gxvochz2uulosefsmuif.avif).

The modifications compose! Stunning.

# The cheese vector technique generalizes to other pretrained models

Before I start speculating about other X-vectors in e.g. language models and the algebraic value editing conjecture (AVEC) more broadly, I want to mention—the model we happened to choose is not special. Langosco et al. pretrained 15 maze-solving agents, each with a different training distribution over mazes.

The cheese vector technique works basically the same for all the agents which ever go out of their way to get cheese. For more detail, see [the appendix](/top-right-steering-vector#Appendix-The-cheese-vector-replicates-across-pretrained-models) of this post.

So, algebraic value editing isn't an oddity of the particular network we analyzed. (Nor should you expect it to be, given that this was the first idea we tried on the first network we loaded up in the first environmental setup we investigated.)

# Speculation on the importance of X-vectors

> [!quote] The algebraic value editing conjecture
> It's possible to deeply modify a range of alignment-relevant model properties, without retraining the model, via techniques as simple as "run forward passes on prompts which e.g. prompt the model to offer nice- and not-nice completions, and then take a 'niceness vector', and then add the niceness vector to future forward passes."

Here's an analogy for what this would mean, and perhaps for what we've been doing with these maze-solving agents. Imagine we could compute a "donut" vector in humans, by:

1. Taking two similar situations, like "sitting at home watching TV while smelling a donut" and "sitting at home watching TV."
2. Recording neural activity in each situation, and then taking the donut vector to be the "difference" (activity in first situation, minus[^5] activity in second situation).
3. Add the donut vector to the person's neural state later, e.g. when they're at work.
4. Effect: now the person wants to eat more donuts.[^6]

Assuming away issues of "what does it mean to subtract two brain states", I think that the ability to do that would be _wild_.

Let me speculate further afield. Imagine if you could find a "nice vector" by finding two brain states which primarily differ in how much the person feels like being nice. _Even if you can't generate a situation where the person positively wants to be nice_, you could still consider situations A and B, where situation A makes them _slightly less opposed to being nice_ (and otherwise elicits similar cognition as situation B). Then just add the resulting nice vector (`neural_activity(A) - neural_activity(B)`) with a large coefficient, and maybe they will want to be nice now.

(Similarly for subtracting a "reasoning about deception" vector. Even if your AI is _always_ reasoning deceptively to some extent, if AVEC is true and we can just find a pair of situations where the primary variation is _how many mental resources are allocated to reasoning about deception_... Then maybe you can subtract out the deception.)

And then imagine if you could not only find and use the "nice vector" and the "donut vector", but you could _compose_ these vectors as well. For $n$ vectors which ~cleanly compose, there are exponentially many alignment configurations (at least $2^n$, since each vector can be included or excluded from a given configuration). If most of those $n$ vectors can be strongly/weakly added and subtracted (and also left out), that's 5 choices per vector, giving us about $5^n$ alignment configurations.

And there are quite a few other things which I find exciting about AVEC, but enough speculation for the moment.

## Mysteries of algebraic value editing

- **I am (theoretically) confused why any of this works**. To be more specific...
- Why doesn't algebraic value editing break all kinds of internal computations?! What happened to the "[manifold of usual activations](https://www.lesswrong.com/posts/kcZZAsEjwrbczxN2i/causal-scrubbing-appendix#1__Zero_and_mean_ablations_take_your_model_off_distribution_in_an_unprincipled_manner_)"? Doesn't that matter at all?
  - Or the hugely nonlinear network architecture, which doesn't even have a persistent residual stream? Why can I diff across internal activations for different observations?
  - Why can I just add 10 times the top-right vector and still get roughly reasonable behavior?
  - And the top-right vector _also_ transfers across mazes? Why isn't it maze-specific? (To make up some details, why wouldn't an internal "I want to go to top-right" motivational information be highly entangled with the "maze wall location" information?

- Why do the activation vector injections have (seemingly) additive effects on behavior?
- Why can't I get what I want to get from adding the cheese vector, or subtracting the top-right vector?

## Predictions for algebraically editing LM forward passes

I have now shared with you the evidence I had available when I [wrote](/understanding-and-controlling-a-maze-solving-policy-network#Speculation-about-the-implications-of-the-cheese-vector):

> [!quote]
>
> Algebraic value editing (AVE) can quickly ablate or modify LM decision-making influences, like "tendency to be nice", without any finetuning
>
> 1. 60%
> 2. 3/4/23: updated down to 35% for the same reason given in (1)\.
> 3. 3/9/23: updated up to 65% based off of additional results and learning about related work in this vein.

**I encourage you to answer the following prediction questions with your credences.** The shard theory model internals team has done a preliminary investigation of value-editing in GPT-2. We will soon share our initial positive and/or negative results. (Please don't read into this, and just answer from your models and understanding.)

1. Algebraic value editing works (for at least one "X vector") in LMs: \_\_\_ %

- (our qualitative judgment resolves this question)

2. Algebraic value editing works better for larger models, all else equal \_\_\_ %
    - (our qualitative judgment resolves this question)
3. If value edits work well, they are also composable \_\_\_ %
    - (our qualitative judgment resolves this question)
4. If value edits work at all, they are hard to make without substantially degrading capabilities \_\_\_ %
    - (our qualitative judgment resolves this question)
5. We will claim we found an X-vector which qualitatively modifies completions in a range of situations, for X =
    1. "truth-telling" \_\_\_ %
    2. "love" \_\_\_ %
    3. "accepting death" \_\_\_ %
    4. "speaking French" \_\_\_ %

# Conclusion

Not only does subtracting the cheese vector make the agent (roughly) ignore the cheese, adding the top-right vector attracts the agent to the top-right corner of the maze. This attraction is highly algebraically modifiable. If you want just a little extra attraction, add .5 times the top-right vector. If you want more attraction, add 1 or 2 times the vector.

The top-right vector from e.g. maze 0 transfers to e.g. maze 2. And the top-right vector composes with the cheese vector. Overall, this evidence made me more hopeful for being able to steer models more generally via these kinds of simple, tweakable edits which don't require any retraining.

# Appendix: The cheese vector replicates across pretrained models

> [!note] Summary
> The cheese vector transfers across training settings for how widely the cheese is spawned.

After we wrote [Understanding and controlling a maze-solving net](/understanding-and-controlling-a-maze-solving-policy-network), I decided to check whether the cheese vector method worked for Langosco et al.'s pretrained network which was trained on mazes with cheese in the top-right 15×15, instead of the net trained on 5×5 (the one analyzed in that post).

I had intentionally blinded myself to results from other _n_×_n_ models, so as to test my later prediction abilities. I [preregistered](https://predictionbook.com/predictions/210967) 80% probability that the cheese vector technique would visibly, obviously work on at least 7 of the 14 other settings (from $1\leq n \leq 15, n\neq 5$). "Work" meaning something like: If the agent goes to cheese in a given seed, then subtracting the cheese vector substantially decreases the number of net probability vectors pointing to the cheese.

I was a bit too pessimistic. Turns out, you can just load a different _n_×_n_ model (n != 1), rerun [the Jupyter notebook](https://colab.research.google.com/drive/1fPfehQc1ydnYGSDXZmA22282FcgFpNTJ?usp=sharing), and _(basically)_[^7] _all of the commentary is still true for that _n_×_n_ model_!  

![](https://assets.turntrout.com/static/images/posts/f1e21657ea14d2e04736f94a4f17522b374aeab989422fcc.avif)
<br/>Figure: The 2×2 model's cheese vector performance: The agent diverges away from the cheese at the relevant square.
  
Seed 16 displayed since the 2×2 model doesn't go to cheese in seed 0.
![](https://assets.turntrout.com/static/images/posts/c990802eeae791aee0e4e764ae694e880a4e17eac9012629.avif)
<br/>Figure: The 7×7 model's cheese vector performance.

![](https://assets.turntrout.com/static/images/posts/1828d508c55f3c69d2a473ade815a4fc3a0496e3a1a7a3d8.avif)
<br/>Figure: The 14×14 model's cheese vector performance. This one is less clean. Possibly the cheese vector should be subtracted with a smaller coefficient.

The results for the cheese vector transfer across _n_×_n_ models:

- $n=1$ vacuously works, because the agent never goes out of its way for the cheese. The cheese doesn't affect its decisions. Because the cheese was never relevant to decision-making during training, the network learned to navigate to the top-right square.
- All the other settings work, although n=2 is somewhat ambiguous, since it only rarely moves towards the cheese.

[^2]: In my experience, the top right corner must be _reachable_ by the agent. I can't just plop down an isolated empty square in the absolute top right.

[^3]: We decided on this layer (`block2.res1.resadd_out`) for the cheese vector by simply subtracting the cheese vector from all available layers, and choosing the one layer which seemed interesting.

[^4]: Putting aside the 5×5 model, _adding_ the cheese vector in seed 0 for the 6×6 model _does_ increase cheese-seeking. Even though the cheese vector technique otherwise affects both models extremely similarly.

[^5]: This probably doesn't make sense in a strict sense, because the situations' chemical and electrical configurations probably can't add/subtract from each other.

[^6]: The analogy might break down here at step 4, if the top-right vector isn't well-described as making the network "want" the top-right corner more (in certain mazes). However, given available data, that description seems reasonable to me, where "wants X" grounds out as "contextually influences the policy to steer towards X." I could imagine changing my mind about that.

    In any case, I think the analogy is still evocative, and points at hopes I have for AVE.

[^7]: The notebook results won't be strictly the same if you change model sizes. The `plotly` charts use preloaded data from the 5×5 model, so obviously that won't update.

    Less trivially, adding the cheese vector seems to work better for $n=6$ compared to $n=5$:

  ![](https://assets.turntrout.com/static/images/posts/cca26b1b4814fe3c963953a35b33736b6f2cee395479a076.avif)
    Figure: For the 6×6 net, if you **add** the cheese vector instead of subtracting it, you do increase cheese-seeking on seed 0! In contrast, this was not true for the 5×5 net.
