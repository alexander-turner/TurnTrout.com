---
permalink: cheese-vector-paper
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/DKtWikjcdApRj3rWr/paper-understanding-and-controlling-a-maze-solving-policy
lw-linkpost-url: https://arxiv.org/abs/2310.08043
lw-is-question: "false"
lw-posted-at: 2023-10-13T01:38:09.147000Z
lw-last-modification: 2023-10-13T17:37:49.828000Z
lw-curation-date: None
lw-frontpage-date: 2023-10-13T17:37:49.714000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 0
lw-base-score: 69
lw-vote-count: 25
af-base-score: 37
af-num-comments-on-upload: 0
title: "Paper: Understanding and Controlling a Maze-Solving Policy Network"
lw-latest-edit: 2023-10-13T02:22:44.726000Z
lw-is-linkpost: "true"
authors: Alex Turner, Ulisse Mini, Peli Grietzer, Mrinank Sharma, Austin Meek, Monte MacDiarmid, and Lisa Thiergart
tags:
  - AI
  - shard-theory
  - activation-engineering
aliases:
  - paper-understanding-and-controlling-a-maze-solving-policy
  - cheese-vector-paper-announcement
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2023-10-13 00:00:00
original_url: https://www.lesswrong.com/posts/DKtWikjcdApRj3rWr/paper-understanding-and-controlling-a-maze-solving-policy
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/jbwksgzxm1h8hzspvypz.jpg
description: My team published a paper on steering a maze-solving AI by manipulating its internal goal representations.
date_updated: 2025-12-30 14:46:20.403471
createBibtex: true
card_image_alt: A four-panel diagram showing how modifying a neural network's activations changes an AI's behavior. (a) A mouse in a maze ignores cheese to go top-right. (b) A heatmap shows activations peaking at the cheese's location. (c) A new activation peak is manually added in the top-right. (d) The mouse now follows a path to the top-right, retargeted by the modified activation.
---








Mrinank, Austin, and Alex wrote a paper on the results from [Understanding and controlling a maze-solving policy network](/understanding-and-controlling-a-maze-solving-policy-network), [Maze-solving agents: Add a top-right vector, make the agent go to the top-right](/top-right-steering-vector), and [Behavioural statistics for a maze-solving agent](/statistics-of-a-maze-solving-network).

> [!abstract]
> To understand the goals and goal representations of AI systems, we carefully study a pretrained reinforcement learning policy that solves mazes by navigating to a range of target squares. We find this network pursues multiple context-dependent goals, and we further identify circuits within the network that correspond to one of these goals. In particular, we identified eleven channels that track the location of the goal. By modifying these channels, either with hand-designed interventions or by combining forward passes, we can partially control the policy. We show that this network contains redundant, distributed, and retargetable goal representations, shedding light on the nature of goal-direction in trained policy networks.

We ran a few new experiments, including a quantitative analysis of our retargetability intervention. We'll walk through those new results now.

![A four-panel diagram showing how modifying a neural network's activations changes an AI's behavior. (a) A mouse in a maze ignores cheese to go top-right. (b) A heatmap shows activations peaking at the cheese's location. (c) A new activation peak is manually added in the top-right. (d) The mouse now follows a path to the top-right, retargeted by the modified activation.](https://assets.turntrout.com/static/images/posts/jbwksgzxm1h8hzspvypz.avif)

Retargeting the mouse to a square involves increasing the probability that the mouse goes to the target location. Therefore, to see how likely the mouse is to visit any given square, Alex created a heatmap visualization:

![A top-down view of a maze with an AI agent, depicted as a mouse icon, at the starting position in the bottom-left corner. Mostly, the path from the start to the top-right is bright red, with gradual degradation for squares off of that path.](https://assets.turntrout.com/static/images/posts/qd9kbctvk3rdljml2mt6.avif)
<br/>Figure: **Normalized path probability heatmap.** The _normalized path probability_ is the geometric average probability, under a policy, along the shortest path to a given point. It roughly measures how likely a policy is to visit that part of the maze.  
  
The color of each maze square shows the normalized path probability for the path from the starting position in the maze to the square. In this image, we show the "base probabilities" under the unmodified policy.

For each maze square, we can try different retargeting interventions, and then plot the new normalized path probability towards that square:

![Four maze heatmaps comparing AI retargeting methods, with square redness indicating how retargetable the agent is to that square. (a) Base Probability shows a limited red path. (b) Intervening on Channel 55 and (c) All Channels show progressively larger high-probability areas. (d) Directly moving the goal (cheese) is most effective, with the largest red area.](https://assets.turntrout.com/static/images/posts/vu1sqt3tg7fczncelr2r.avif)

Notice the path from the bottom-left (where the mouse always starts) to the top-right corner. We call this path the _top-right path_. Looking at these heatmaps, it's harder to get the mouse to go farther from the top-right path. Quantitative analysis bears out this intuition:

![A line graph shows that the "Probability of Successful Retargeting" an AI agent decreases as the target's "Distance from Top Right Path" increases. The probability starts at 0.9 for zero distance, drops sharply to below 0.3 by distance 25, and levels off around 0.2 for distances up to 50.](https://assets.turntrout.com/static/images/posts/hxt1sr3sbkmj5m9a22l6.avif)
<br/>

![A line graph plotting the "Ratio of Successful Retargeting" versus "Step-Distance from Top Right Path." The ratio peaks at 5.0 for targets near the path, then decreases with distance but remains above 1.0, indicating retargeting always increases the probability of reaching a tile.](https://assets.turntrout.com/static/images/posts/o7jxdzslsiwmqchamffu.avif)
<br/>

![A line graph shows that as maze size increases, the average probability of retargeting success decreases. It compares three interventions: "All Cheese Channels" (highest success), followed by "Effective Channels," and "Channel 55" (lowest), showing that modifying more channels is more effective.](https://assets.turntrout.com/static/images/posts/quxikddjem0pmtuiutxx.avif)

Overall, these new results quantify how well we can control the policy via the internal goal representations which we identified.

> [!thanks]
>Thanks to Lisa Thiergart for helping handle funding and set up the project. Thanks to the LTFF and Lightspeed grants for funding this project.
