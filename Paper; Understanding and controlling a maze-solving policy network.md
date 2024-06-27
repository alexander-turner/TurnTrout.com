---
title: "Paper: Understanding and controlling a maze-solving policy network"
permalink: cheese-vector-paper
publish: "true"
original_url: https://www.lesswrong.com/posts/DKtWikjcdApRj3rWr/paper-understanding-and-controlling-a-maze-solving-policy
date_published:
tags:
  - activation-engineering
  - interpretability
  - shard-theory
  - AI
authors: Alex Turner, Ulisse Mini, Peli Grietzer, Mrinank Sharma, Monte MacDiarmid, and Lisa Thiergart
---

Mrinank, Austin, and Alex [wrote a paper](https://arxiv.org/abs/2310.08043) on the results from [Understanding and controlling a maze-solving policy network](https://www.lesswrong.com/posts/cAC4AXiNC5ig6jQnc/understanding-and-controlling-a-maze-solving-policy-network), [Maze-solving agents: Add a top-right vector, make the agent go to the top-right](https://www.lesswrong.com/posts/gRp6FAWcQiCWkouN5/maze-solving-agents-add-a-top-right-vector-make-the-agent-go), and [Behavioural statistics for a maze-solving agent](https://www.lesswrong.com/posts/eowhY5NaCaqY6Pkj9/behavioural-statistics-for-a-maze-solving-agent).

> [!abstract]
>
> To understand the goals and goal representations of AI systems, we carefully study a pretrained reinforcement learning policy that solves mazes by navigating to a range of target squares. We find this network pursues multiple context-dependent goals, and we further identify circuits within the network that correspond to one of these goals. In particular, we identified eleven channels that track the location of the goal. By modifying these channels, either with hand-designed interventions or by combining forward passes, we can partially control the policy. We show that this network contains redundant, distributed, and retargetable goal representations, shedding light on the nature of goal-direction in trained policy networks.

We ran a few new experiments, including a quantitative analysis of our retargetability intervention. We'll walk through those new results now.

![](https://39669.cdn.cke-cs.com/rQvD3VnunXZu34m86e5f/images/efcc73b4680513c3a979d67e4d6bf519b1d0e5d416558690.png)

Retargeting the mouse to a square involves increasing the probability that the mouse goes to the target location. Therefore, to see how likely the mouse is to visit any given square, Alex created a heatmap visualization:

![](https://39669.cdn.cke-cs.com/rQvD3VnunXZu34m86e5f/images/78c3ec8b6d775a83fea2af62f1d017abd4d7f8eaa88e0072.png)

**Normalized path probability heatmap.** The _normalized path probability_ is the geometric average probability, under a policy, along the shortest path to a given point. It roughly measures how likely a policy is to visit that part of the maze.

The color of each maze square shows the normalized path probability for the path from the starting position in the maze to the square. In this image, we show the \"base probabilities\" under the unmodified policy.

For each maze square, we can try different retargeting interventions, and then plot the new normalized path probability towards that square:

![](https://39669.cdn.cke-cs.com/rQvD3VnunXZu34m86e5f/images/4c905d91d87bfbfc5ee3c36785893650ea7f2be85230dc90.png)

Notice the path from the bottom-left (where the mouse always starts) to the top-right corner. This is the _top-right path_. Looking at these heatmaps, it's harder to get the mouse to go farther from the top-right path. Quantitative analysis bears out this intuition:

![](https://39669.cdn.cke-cs.com/rQvD3VnunXZu34m86e5f/images/604260ca92d2e2b19e0b3c7d6669861ade44295f35ac04be.png)

![](https://39669.cdn.cke-cs.com/rQvD3VnunXZu34m86e5f/images/db4d2d284d86f739010fe868cd144e1f97a86e70a223e725.png)

![](https://39669.cdn.cke-cs.com/rQvD3VnunXZu34m86e5f/images/0340d33bc8b98bb9d9e7b977cb09ed533d3aebc2197d8b10.png)

Overall, these new results quantify how well we can control the policy via the internal goal representations which we identified.

_Thanks to Lisa Thiergart for helping handle funding and set up the project. Thanks to the LTFF and Lightspeed grants for funding this project._