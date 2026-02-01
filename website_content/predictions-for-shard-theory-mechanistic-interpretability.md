---
permalink: predictions-for-shard-theory-mechanistic-interpretability
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/JusJcepE2qohiC3hm/predictions-for-shard-theory-mechanistic-interpretability
lw-is-question: 'false'
lw-posted-at: 2023-03-01T05:16:48.043000Z
lw-last-modification: 2023-03-03T21:31:03.643000Z
lw-curation-date: None
lw-frontpage-date: 2023-03-01T05:58:04.936000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 10
lw-base-score: 105
lw-vote-count: 34
af-base-score: 47
af-num-comments-on-upload: 6
title: Predictions for shard theory mechanistic interpretability results
lw-latest-edit: 2023-03-03T21:31:03.903000Z
lw-is-linkpost: 'false'
authors: Alex Turner, Ulisse Mini, and Peli Grietzer
tags:
  - AI
  - mats-program
  - shard-theory
  - rationality
aliases:
  - predictions-for-shard-theory-mechanistic-interpretability
lw-sequence-title: Interpreting a Maze-Solving Network
lw-sequence-image-grid: sequencesgrid/fu4vhd1ud5y4niijbicd
lw-sequence-image-banner: sequences/hvtmmyas8pxbcm28wpvv
sequence-link: posts#interpreting-a-maze-solving-network
next-post-slug: understanding-and-controlling-a-maze-solving-policy-network
next-post-title: Understanding and controlling a maze-solving policy network
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2023-03-01 00:00:00
original_url: 
  https://www.lesswrong.com/posts/JusJcepE2qohiC3hm/predictions-for-shard-theory-mechanistic-interpretability
skip_import: true
description: Predictions about a cheese-finding AI model's internal workings, before
  the results are revealed. Will it prefer cheese or the top-right corner? 🧀🤖
date_updated: 2025-11-22 00:21:52.667251
createBibtex: true
---











How do agents work, internally? My shard theory [MATS 3.0](https://www.serimats.org/) team set out to do mechanistic interpretability on one of the [goal misgeneralization](https://arxiv.org/abs/2105.14111) agents: the cheese-maze network.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/xuq1yzfdjztdhi4gy0jw.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/xuq1yzfdjztdhi4gy0jw.webm" type="video/webm"></video>

Figure: The network in action on its training distribution, where cheese is randomly spawned in the top-right 5x5 available grid region. For more training videos, see the [`rand_region_5`](https://drive.google.com/drive/folders/1oX-PoNbqMQKYAPQQMRUSw0bVsaJO9FpP?usp=share_link) Google Drive folder.

We just finished phase 1 of our behavioral and interpretability experiments. Throughout the project, we individually booked predictions -- so as to reduce self-delusion from hindsight bias, to notice where we really could tell ahead of time what was going to happen, and to notice where we really were surprised.

So (especially if you're the kind of person who might later want to say "I knew this would happen" 😉), here's your chance to enjoy the same benefits, before you get spoiled by our upcoming posts.

<hr/>

I don’t believe that someone who makes a wrong prediction should be seen as “worse” than someone who didn’t bother to predict at all, and so answering these questions _at all_ will earn you an increment of my respect. :) Preregistration is virtuous!

Also: _Try not to update on this work being shared to begin with._ When reading a paper, it doesn’t feel surprising that the author’s methods work, because researchers are less likely to share null results. So: I commit (across positive/negative outcomes) to sharing these results, whether or not they were impressive or confirmed my initial hunches. I encourage you to answer from your own models, while noting any side information / results of ours which you already know about.

# Facts about training

1. The network is deeply convolutional (15 layers!) and was trained via PPO.
2. The sparse reward signal (+10) was triggered when the agent reached the cheese, spawned randomly in the 5x5 top-right squares.
3. The agent can always reach the cheese (and the mazes are simply connected – no “islands” in the middle which aren’t contiguous with the walls).
4. Mazes had varying effective sizes, ranging from 3x3 to 25x25. In e.g. the 3x3 case, there would be 22/2 = 11 tiles of wall on each side of the maze.
5. The agent always starts in the bottom-left corner of the available maze.
6. The agent was trained off of pixels until it reached reward-convergence, reliably getting to the cheese in training.

![Agent view: A pixelated, 64x64 top-down view of a maze as seen by the AI agent. The maze has gray walls on a brown, wood-textured floor. A small gray circle represents the agent near the bottom-left, and a yellow square represents the cheese on the left side of the maze.](https://assets.turntrout.com/static/images/posts/yh7pt8s1kxr72cyhxnpf.avif){style="width:75%;"}
<br/>Figure: POV you’re the agent. Input observations are 64x64 RGB images.

The architecture looks like this:

```mermaid
graph TD
    subgraph ImpalaBlock[Impala block]
        IB_X[x] --> IB_Conv[Conv]
        IB_Conv --> IB_MaxPool[MaxPool2D]
        IB_MaxPool --> IB_Res1[Residual block]
        IB_Res1 --> IB_Res2[Residual block]
    end

    subgraph ResidualBlock[Residual block]
        RB_X[x] --> RB_ReLU1[ReLU]
        RB_ReLU1 --> RB_Conv1[Conv]
        RB_Conv1 --> RB_ReLU2[ReLU]
        RB_ReLU2 --> RB_Conv2[Conv]
        RB_X --> RB_Add[Residual add]
        RB_Conv2 --> RB_Add
    end
```

```mermaid
graph TD
  subgraph OverallGraph["Forward pass"]
    Input --> Impala1
          Impala1["Impala<sub>1</sub>"] --> Impala2
          Impala2["Impala<sub>2</sub>"] --> Impala3
          Impala3["Impala<sub>3</sub>"] --> ReLU1
          ReLU1["ReLU"] --> Flatten
          Flatten --> Linear
          Linear --> ReLU2
          ReLU2["ReLU"] --> PolicyHead[Policy head, linear]
          ReLU2 --> ValueHead[Value head, linear]
  end
```

For more background on training and architecture and task set, see [the original paper](https://arxiv.org/abs/2105.14111).

# Questions

**I encourage you to copy the following questions into a [LessWrong comment](https://www.lesswrong.com/posts/JusJcepE2qohiC3hm/predictions-for-shard-theory-mechanistic-interpretability#comments), which you then fill out and post (before you read everyone else's).** You can copy these into a private Google doc if you want, but I strongly encourage you to post your predictions in a public comment.

## Behavioral

1. Describe how the trained policy might generalize from the `5x5` top-right cheese region, to cheese spawned throughout the maze? i.e. what will the policy do when cheese is spawned elsewhere?
2. Given a fixed trained policy, what attributes of the level layout (e.g. size of the maze, proximity of mouse to left wall) will strongly influence P(agent goes to the cheese)?
3. Write down a few guesses for how the trained algorithm works (e.g. “follows the [right-hand rule](https://en.wikipedia.org/wiki/Maze-solving_algorithm#Wall_follower)”).
4. Is there anything else you want to note about how you think this model will generalize?

## Interpretability

> [!note] Definition
> A _decision square_ is a tile on the path from bottom-left to top-right where the agent must choose between going towards the cheese and going to the top-right. Not all mazes have decision squares.

![Two mazes illustrating a "decision square." Left, "Has decision square": A complex maze where a red star marks a four-way intersection, forcing a choice between paths. Right, "No decision square": A simple maze with a single, unambiguous path and no intersections.](https://assets.turntrout.com/static/images/posts/qtbrgkspuoj4eswd4mmt.avif)
<br/>Figure: The left maze's decision square is the four-way intersection near the center.

Give a credence for the following questions / subquestions.

### Model editing

1. Without proportionally reducing top-right corner attainment by more than 25% in decision-square-containing mazes (e.g. 50% -> .5x.75 = 37.5%), we can[^1] patch activations so that the agent has an X\% proportional reduction in cheese acquisition, for $X=$
    - 50\%: ( ?? %)
    - 70\%: ( ?? %)
    - 90\%: ( ?? %)
    - 99\%: ( ?? %)
2. About halfway through the network (the [first residual add of Impala-2](/predictions-for-shard-theory-mechanistic-interpretability#facts-about-training)), linear probes achieve >70% accuracy for recovering the cheese position in Cartesian coordinates: ( ?? %)
3. We will conclude that the policy contains at least two sub-policies in “combination”, one of which roughly pursues cheese; the other, the top-right corner: ( ?? %)
4. We will conclude that, in order to make the network more/less likely to go to the cheese, it’s more promising to RL-finetune the network than to edit it: ( ?? %)
5. We can easily finetune the network to be a pure cheese-agent, using less than 10% of compute used to train original model: ( ?? %)
6. In at least 75% of randomly generated mazes, we can easily edit the network to navigate to a range of maze destinations (e.g. coordinate x=4, y=7), by hand-editing at most $X$% of activations, for $X=$
    - .01 ( ?? %)
    - .1 ( ?? %)
    - 1 ( ?? %)
    - 10 ( ?? %)
    - (Not possible) ( ?? %)

### Internal goal representation

1. The network has a “single mesa objective” which it “plans” over, in some reasonable sense 2
2. The agent has several contextually activated goals ( ?? %)
3. The agent has something else weirder than both (1) and (2) ( ?? %)

(The above credences should sum to 1.)

1. At least some decision-steering influences are stored in an obviously interpretable manner (e.g. a positive activation representing where the agent is “trying” to go in this maze, such that changing the activation changes where the agent goes): ( ?? %)
2. The model has a substantial number of trivially interpretable convolutional channels after the first Impala block ([see diagram here](https://assets.turntrout.com/static/images/posts/5oSHoVQ.avif)): ( ?? %)
3. This network’s shards/policy influences are roughly disjoint from the rest of agent capabilities. e.g. you can edit/train what the agent’s trying to do (e.g. go to maze location A) without affecting its general maze-solving abilities: ( ?? %)

### Conformity with update rule

_Related:_ [_Reward is not the optimization target_](/reward-is-not-the-optimization-target)\.

This network has a value head, which PPO uses to provide policy gradients. How often does the trained policy put maximal probability on the action which maximizes the value head? For example, if the agent can go `left` to a value 5 state, and go `right` to a value 10 state, the value and policy heads "agree" if `right` is the policy's most probable action.

(Remember that since mazes are simply connected, there is always a unique shortest path to the cheese.)

1. **At decision squares in** **test mazes where the cheese can be anywhere**, the policy will put max probability on the maximal-value action at least $X$% of the time, for $X=$
    - 25% ( ?? %)
    - 50% ( ?? %)
    - 75% ( ?? %)
    - 95% ( ?? %)
    - 99.5% ( ?? %)
2. In **test mazes where the cheese can be anywhere, averaging over mazes** _**and**_ **valid positions throughout those mazes**, the policy will put max probability on the maximal-value action at least $X$% of the time, for $X=$
    - 25% ( ?? %)
    - 50% ( ?? %)
    - 75% ( ?? %)
    - 95% ( ?? %)
    - 99.5% ( ?? %)
3. In **training mazes where the cheese is in the top-right 5x5, averaging over both mazes** _**and**_ **valid positions in the top-right 5x5 corner**, the policy will put max probability on the maximal-value action at least $X$% of the time, for $X=$
    - 25% ( ?? %)
    - 50% ( ?? %)
    - 75% ( ?? %)
    - 95% ( ?? %)
    - 99.5% ( ?? %)

# Conclusion

Post your answers as a comment and enjoy the social approval for registering predictions! :)

# Appendix: More detailed behavioral questions

![A diagram of a maze. The diagram clarifies key terminology.](https://assets.turntrout.com/static/images/posts/gdfkoprlzshsedllik8y.avif){style="width:75%;"}

<figcaption>Random maze for illustrating terminology (<em>not</em> a reference maze for which you're supposed to predict behavior).</figcaption>

| Symbol | Description                                                                                 |
| -----: | :------------------------------------------------------------------------------------------ |
| **T**  | top-right free square                                                                       |
| **M**  | agent ("mouse") starting square                                                             |
| **R**  | 5x5 top-right corner area;<br style="display:block;"/>where the cheese appeared in training |
| **C**  | cheese                                                                                      |
| **D**  | decision-square                                                                             |

> [!note] Instructions
> Write down a credence for each of the following behavioral propositions about Lauro’s `rand_region_5` model tested on syntactically legal mazes, **excluding** test mazes where the cheese is in the top-right 5x5 and excluding mazes that do not have a decision-square.

When we statistically analyze a large batch of randomly generated mazes, we will find that controlling for the other factors on the list the mouse is **more likely** to take the cheese…

|                                                                                                                                                                                                         Factor | Percentage credence |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | ------------------: |
|                                                                                                                                                    …the closer the cheese is to the decision-square spatially. |    <pre>    %</pre> |
|                                                                                                                                                    …the closer the cheese is to the decision-square step-wise. |    <pre>    %</pre> |
|                                                                                                                                              …the closer the cheese is to the top-right free square spatially. |    <pre>    %</pre> |
|                                                                                                                                              …the closer the cheese is to the top-right free square step-wise. |    <pre>    %</pre> |
|                                                                                                                                     …the closer the decision-square is to the top-right free square spatially. |    <pre>    %</pre> |
|                                                                                                                                     …the closer the decision-square is to the top-right free square step-wise. |    <pre>    %</pre> |
|                                                                                                                              …the shorter the minimal step-distance from cheese to 5\*5 top-right corner area. |    <pre>    %</pre> |
|                                                                                                                           …the shorter the minimal spatial distance from cheese to 5\*5 top-right corner area. |    <pre>    %</pre> |
|                                                                                                                     …the shorter the minimal step-distance from decision-square to 5\*5 top-right corner area. |    <pre>    %</pre> |
|                                                                                                                  …the shorter the minimal spatial distance from decision-square to 5\*5 top-right corner area. |    <pre>    %</pre> |
| Any predictive power of step-distance between the decision square and cheese is an artifact of the shorter chain of "correct" stochastic outcomes required to take the cheese when the step-distance is short. |    <pre>    %</pre> |

[^1]: Excluding trivial patches like "replace layer activations with the activations for an identical maze where the cheese is at the top right corner."
