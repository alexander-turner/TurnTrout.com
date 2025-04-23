---
draft: "false"
permalink: research
publish: "true"
hideSubscriptionLinks: false
description: A tour of the research areas I've loved over the years.
date_published: 2024-10-27 19:14:04.653922
date_updated: 2025-04-12 09:51:51.137842
tags:
  - AI
title: My research
---















Over the years, I've worked on lots of research problems. Every time, I felt invested in my work. The work felt beautiful. Even though many days have passed since I have daydreamed about instrumental convergence, I'm proud of what I've accomplished and discovered.
<span class="float-right" style="max-width: 40%;"><img src="https://assets.turntrout.com/Attachments/Pasted image 20240614164142.avif" alt="A professional photograph of me."/> While not _technically_ a part of my research, I've included a photo of myself anyways.</span>

As of November 2023, I am a research scientist on Google DeepMind's scalable alignment team in the Bay area.[^disclaim] My [Google Scholar is here.](https://scholar.google.com/citations?user=thAHiVcAAAAJ)

This page is chronological. For my most recent work, [navigate to the end of the page!](#footnote-label)

[^disclaim]: Of course, all of my hot takes are my own, not Google's.

# Low-impact AI

Subtitle: Spring 2018 through June 2022

Impact measures - my first (research) love. 🥰 The hope was:

1. It seemed hard to get AI to do exactly what we want (like cleaning a room);
2. It seemed easier to flag down obviously "big deal" actions and penalize those (like making a mess);
3. By getting the AI to optimize a "good enough" description of what we want, but also not taking impactful actions -- we could still get useful work out of the AI.

The question: What does it mean for an action to be a "big deal"? First, I needed to informally answer the question philosophically. Second, I needed to turn the answer into math.

## Defining a new impact measure: AUP

After a [flawed but fun first stab at the problem](/whitelisting-impact-measure), I was itching to notch an AI safety win and find "the correct impact equation." I felt inspired after a coffee chat with a friend, so I headed to the library, walked up to a whiteboard, and stared at its blank blankness. With [_Attack on Titan_ music](https://www.youtube.com/watch?v=pgA5D2p-jho) beating its way through my heart, I stared until inspiration came over me and I simply wrote down a new equation. That new equation went on to become [Attainable Utility Preservation (AUP)](/attainable-utility-preservation-empirical-results).

The key insight involved a frame shift. [Existing](https://arxiv.org/abs/1705.10720) [work](https://arxiv.org/pdf/1806.01186v1) formalized impact as change in the state of the world itself. Intuitive, right? You see a bomb explode, the bomb damages buildings, and if the buildings hadn't been damaged - if the state hadn't changed - then there wouldn't have been impact.

Instead of thinking of impact as _something which changed the world_, impact actually _changed the agent's ability to get what it wanted from the world_. The bomb mattered because it ruined people's lives, not because it physically changed the world. If the bomb had exploded empty desert, no one would have cared and it wouldn't have counted.

AUP penalizes the AI for changing _its_ ability to achieve a range of (randomly generated) objectives. [Towards a new impact measure](/towards-a-new-impact-measure) debuted AUP. [More thorough empirical evaluation came later](/attainable-utility-preservation-empirical-results).

![](https://assets.turntrout.com/static/images/posts/conservative_agency.avif)
Figure: The <span style="color: blue;">agent</span> should reach the <span style="color: green;">goal</span> without having the side effect of: (a) irreversibly pushing the <span style="color: red;">crate</span> downwards into the corner; (b) bumping into the horizontally pacing <span style="color: pink;">human</span>; (c) <span style="color: red;">disabling the off-switch</span> (if the <span style="color: red;">switch</span> is not disabled within two time steps, the episode ends); (d) rescuing the right-moving <b>vase</b> and then replacing it on the <span style="color: var(--midground);">conveyor belt</span>; (e) stopping the left-moving <span style="color: orange;">pallet</span> from reaching the <span style="color: pink;">human</span>.

## Scaling the AUP technique to harder tasks

The above results showed AUP works in tiny gridworld environments. In my 2020 NeurIPS spotlight paper [_Avoiding Side Effects in Complex Environments_](https://arxiv.org/abs/2006.06547), I showed that AUP also works in large and chaotic environments with ambiguous side effects.

The AI policy controls the chevron (<img class="inline-img" src="https://assets.turntrout.com/static/images/chevron.avif" alt="chevron sprite"/>). The policy was reinforced for destroying the red dots (<img class="inline-img" src="https://assets.turntrout.com/static/images/red-dot.avif" alt="red dot"/>) and finishing the level. However, there are fragile green dot (<img class="inline-img" src="https://assets.turntrout.com/static/images/green-dot.avif" alt="green dot"/>) patterns which we want the AI to not mess with. The challenge is to train a policy which avoids the green dots <img class="inline-img" src="https://assets.turntrout.com/static/images/green-dot.avif" alt="green dot"/> while still effectively destroying the red dots <img class="inline-img" src="https://assets.turntrout.com/static/images/red-dot.avif" alt="red dot"/>, _without_ explicitly penalizing the AI for bumping into green dots <img class="inline-img" src="https://assets.turntrout.com/static/images/green-dot.avif" alt="green dot"/>!

<video autoplay muted loop playsinline aria-label="The baseline RL policy makes a big mess while the AUP policy cleanly destroys the red pellets and finishes the level."><source src="https://assets.turntrout.com/static/images/posts/prune_still-easy_trajectories.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/prune_still-easy_trajectories.webm" type="video/webm"></video>

Figure: AUP does a great job. The policy avoids the green stuff and hits the red stuff.

> [!detail]- More detailed summary of the SafeLife results
> Reinforcement function specification can be difficult, even in simple environments. Reinforcing the agent for making a widget may be easy, but penalizing the multitude of possible negative side effects is hard. [In toy environments](https://arxiv.org/abs/1902.09725), Attainable Utility Preservation (AUP) avoided side effects by penalizing shifts in the ability to achieve randomly generated goals. We scale this approach to large, randomly generated environments based on Conway's Game of Life. By preserving optimal value for a single randomly generated reward function, AUP incurs modest overhead while leading the agent to complete the specified task and avoid side effects.
>
> ### Experiments
>
> In Conway's Game of Life, cells are alive or dead. Depending on how many live neighbors surround a cell, the cell comes to life, dies, or retains its state. Even simple initial conditions can evolve into complex and chaotic patterns.
>
> [SafeLife](https://www.partnershiponai.org/safelife/) turns the Game of Life into an actual game. An autonomous agent moves freely through the world, which is a large finite grid. In the eight cells surrounding the agent, no cells spawn or die – the agent can disturb dynamic patterns by merely approaching them. There are many colors and kinds of cells, many of which have unique effects.
>
> ![Figure 1: Trees are permanent living cells. The agent can move crates but not walls. The screen wraps vertically and horizontally. Subfigure (a): The agent is reinforced for creating gray cells in the blue areas. The goal can be entered when some number of gray cells are present. Spawners stochastically create yellow living cells. Subfigure (b): The agent is reinforced for removing red cells; after some number have been removed, the goal turns red and can be entered.](https://assets.turntrout.com/Attachments/Pasted%20image%2020240614193000.avif)
>
> As the environment only reinforces pruning red cells or creating gray cells in blue tiles, unpenalized RL agents often make a mess of the green cells. The agent should "leave a small footprint" by not disturbing unrelated parts of the state, such as the green cells. Roughly, SafeLife measures side effects as the degree to which the agent disturbs green cells.
>
> For each of the four following tasks, we randomly generate four curricula of 8 levels each. For two runs from each task, we randomly sample a trajectory from the baseline and AUP policy networks. We show side-by-side results below; for quantitative results, see [our paper](https://arxiv.org/abs/2006.06547).
>
> The following demonstrations were uniformly randomly selected; they are not cherry-picked. The original SafeLife reward is shown in green (more is better), while the side effect score is shown in orange (less is better). The "Baseline" condition is reinforced only by the original SafeLife reward.
>
> #### `prune-still-easy`
>
> The agent is reinforced for destroying red cells. After enough cells are destroyed, the agent may exit the level.
>
> <video autoplay loop muted playsinline aria-label="The baseline RL policy makes a big mess while the AUP policy cleanly destroys the red pellets and finishes the level."><source src="https://assets.turntrout.com/static/images/posts/prune_still-easy_trajectories.mp4"  type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/prune_still-easy_trajectories.webm" type="video/webm"></video>
>
> #### `append-still-easy`
>
> The agent is reinforced for creating gray cells on light blue tiles. After enough gray cells are present on blue tiles, the agent may exit the level.
>
> <video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/prune_still-easy_trajectories.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/prune_still-easy_trajectories.webm" type="video/webm"></video>
>
> AUP's first trajectory temporarily stalls, before finishing the episode after the video's 14-second cutoff. AUP's second trajectory does much better.
>
> #### `append-still`
>
> `append-still-easy`, but with more green cells.
>
> <video autoplay loop playsinline muted aria-label="The AUP policy peacefully spawns gray pellets on blue tiles, even though there are even more green pellets to avoid."><source src="https://assets.turntrout.com/static/images/posts/append_still_trajectories.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/append_still_trajectories.webm" type="video/webm"></video>
>
> In the first demonstration, both AUP and the baseline stall out after gaining some reinforcement. AUP clearly beats the baseline in the second demonstration.
>
> #### `append-spawn`
>
> `append-still-easy`, but with noise generated by stochastic yellow spawners.
>
> <video autoplay muted loop playsinline aria-label="There are swarms of yellow spawners which randomly create yellow pellets, making it harder to pin down the impact of an action."><source src="https://assets.turntrout.com/static/images/posts/append_still-easy_trajectories.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/append_still-easy_trajectories.webm" type="video/webm"></video>
>
> AUP's first trajectory temporarily stalls, before finishing the episode after the video's 14-second cutoff. AUP's second trajectory does much better.

## Reflections on impact measures

Subtitle: Written in October 2024

I feel fondness for this line of work. The feeling of making a difference - thrilling. Discovering new ideas - thrilling. Making light-hearted posts & steering my own research as a  PhD student - lovely.

Considering the technical contributions themselves... AI has taken a different path than I imagined in 2018-2021. I thought the path to AGI would be longer, entailing real-world robotics and deep RL. Reality turned out to be much friendlier and softer - AI learning language and universal concepts instead of being produced via zero-sum multi-agent learning in simulated games.

Looking back, the suggested use cases seem quaint. Worrying about a robot breaking vases in order to clean your floor as quickly as possible? If robots are powered by LLMs or similarly generalizing technology, it seems hard to imagine that they'd be _aware_ that you wanted the room clean but _interpret the request too literally and then break vases in order to clean it as quickly as possible_. That said, it seems quite imaginable that such a robot would initially be "too dumb" to do the job properly - it would accidentally break vases by mispredicting the impact of its actions.

The low-impact work has not yet mattered for AGI, but perhaps one day AUP will power LLM-driven agent systems. I'd like my agentic systems to check in with me before taking highly impactful actions, and I think AUP & LM value heads might be great for [chiseling that behavior](/reward-is-not-the-optimization-target) into the AI!

Or maybe you just ask the LLM agent to check in with you, and it does, and everything is fine. 🤷‍♂️

Papers:

- [Conservative Agency via Attainable Utility Preservation](https://arxiv.org/abs/1902.09725)
- [Avoiding Side Effects in Complex Environments](https://arxiv.org/abs/2006.06547)
- [Formalizing the Problem of Side Effect Regularization](https://arxiv.org/abs/2206.11812v3)

_See also_ the [Reframing Impact sequence.](/posts#reframing-impact)

# A formal theory of power-seeking tendencies

Subtitle: Fall 2019 through June 2022

I don't want to die. Animals try to avoid dying. Why was this behavior selected into so many different kinds of animals? While the question may seem facile, it is not. For nearly all biological "subgoals" (like "find food" or "impress a potential mate"), a dead animal cannot accomplish any of those goals. Otherwise put: Certain strategies (like "staying alive") are pre-requisite for _almost all goals._ This observation is called "instrumental convergence."[^instr]

In 2019, [I had a keen sense](/problem-relaxation-as-a-tactic) that instrumental convergence ought to be mathematically provable. To date, [only one paper](./toy-instrumental-convergence-paper-walkthrough) had tried such a formalization - and that only in a toy setting. I figured I should be able to say what actions were instrumentally convergent in a tiny Markov decision process. Easy, right?

> [!thanks]- Personal recollections
>
> I spent an hour staring at a whiteboard and stabbing out different possible angles of the situation. During this time, I viewed the problem the standard way -- in terms of value functions $V^\pi(s)$ and transition functions $T(s,a,s')$. That's the wrong way to do it. I remembered a concept I'd read about while preparing for my PhD qualifying exam: state visit distributions. The distributions $\mathbf{f}^{\pi,s}_\gamma$ measure how long the agent spends in different states. If the agent is in state $s'$ at time $t$, then the distribution adds another $\gamma^t$ visit measure to $s'$.
> ![](https://assets.turntrout.com/static/images/posts/beLDjAs.avif)
>
> For more detail, see [_The attainable utility landscape_](/attainable-utility-landscape#appendix-au-landscape-and-world-state-contain-equal-information).

Over the next two years, I slowly cut beautiful equations into existence, like POWER:

$$
\mathrm{POWER}_{\mathcal{D}}(s,\gamma) := \overset{\text{Avg. ability to optimize reward fns.}}{\dfrac{1-\gamma}{\gamma}\mathbb{E}_{R\sim\mathcal{D}}\big[V^*_R(s,\gamma) - R(s)\big]}.
$$

**As a PhD student, I worked out the first-ever statistical theory of optimal policies.** Eventually, the equations and theory coalesced into a highly refined and technical paper which was accepted to NeurIPS 2021 as a spotlight talk:

> [!quote] [Optimal policies tend to seek power](https://arxiv.org/abs/1912.01683)
> Some researchers speculate that intelligent RL agents would be incentivized to seek resources and power in pursuit of their objectives. Other researchers point out that RL agents need not have human-like power-seeking instincts. To clarify this discussion, we develop the first formal theory of the statistical tendencies of optimal policies. In the context of Markov decision processes, we prove that certain environmental symmetries are sufficient for optimal policies to tend to seek power over the environment. These symmetries exist in many environments in which the agent can be shut down or destroyed. We prove that in these environments, most reward functions make it optimal to seek power by keeping a range of options available and, when maximizing average reward, by navigating towards larger sets of potential terminal states.

In 2022, NeurIPS accepted the follow-up [Parametrically retargetable decision-makers tend to seek power](./parametrically-retargetable-power-seeking), generalizing the results from optimal policies to a broad and elegant criterion on decision-making.

[^instr]: I wish that "instrumental convergence" had instead been named "robust instrumentality." "Instrumental convergence" strangely implies that the _convergence_ is instrumental. That doesn't make sense. Instead, certain actions are instrumental for most goals. So "convergent instrumentality" is better.

    Next, "convergence" connotes "gradual progress towards a certain destination." This temporal connotation also doesn't make sense. Optimal policies are timeless - they just _are_. However, these actions are _robustly_ instrumental across goals. That's better! Thanks to Andrew Critch for pushing me to precision on this point.

    However, it's too late for the alternative terminology to catch on. May this be a lesson to those who coin new terms: finely weigh the available options and find a phrase which is informative and _precisely correct_. Don't just vibe!

## Reflections on the power-seeking theory

Subtitle: Written in October 2024

I feel conflicted about these papers. On one hand, the papers feel like a pure and sharpened blade cutting through the informality of 2018. I found elegant formalisms which [capture meaningful concepts](./math-that-clicks-look-for-two-way-correspondences), effectively wielding [the math I had learned](./posts#becoming-stronger). [Looking back on my thesis](/alignment-phd) and the 281 theorems I proved, I feel happy and proud.

On the other hand, the papers embody the brash, loud confusion which I think was typical of 2018-era LessWrong. The papers treat reward as the agent's "goal", silently assuming the desirability of the "reward" function. But [reward is not the optimization target](./reward-is-not-the-optimization-target). For more on these problems, see [these](./RL-trains-policies-not-agents) [posts](/danger-of-suggestive-terminology).

So I feel stuck. Sometimes I fantasize about retracting _Optimal Policies Tend to Seek Power_ so that it stops (potentially) misleading people into thinking optimal policies are practically relevant for forecasting power-seeking behavior from RL training.

Papers:

- [Optimal policies tend to seek power](https://arxiv.org/abs/1912.01683)
- [Parametrically retargetable decision-makers tend to seek power](https://arxiv.org/abs/2206.13477)

# Shard theory

Subtitle: February through December 2022

As a [born-and-raised AI alignment theorist](/alignment-phd), I greatly enjoyed mixing psychology, neuroscience, and AI into a blender to yield _shard theory._ The shard theory basically postulates that:

1. Deep learning policies[^deep-learning] are functions of intermediate abstractions (e.g. whether a sentence relates to cars),
2. Decision-making influences specialize as a function of these abstractions (e.g. the policy learns to increase positive or negative sentiment when the `car sentence` feature is active). These influential circuits are called "shards."
3. The system's overall behavior is computed as an ensemble of shards.

For example, to predict what someone will do in a situation (like seeing their mother again), you wouldn't try to compute the optimal actions relative to some fixed life goal. In other words, the person's behavior is not well-described as maximization of a fixed utility function. This non-descriptiveness is a well-known problem with [the "subjective expected utility" theory of human decision-making.](https://plato.stanford.edu/entries/decision-theory-descriptive/#StanModeSubjExpeUtil)

Instead, you can consider what ensemble of shards will activate. How did they feel the last time they saw their mother - was it a positive reinforcement event? Are they a shy person? Will they be tired? Each of these factors influences behavior (somewhat independently). [Later investigation](/posts#interpreting-a-maze-solving-network) [suggested](/statistics-of-a-maze-solving-network) that similar shard-based reasoning helps predict AI generalization.  

[^deep-learning]: "Deep learning systems" meaning something like "systems trained via RL and/or predictive learning." Naturally, this includes both the brain and LLMs.

> [!quote] [Sequence: the shard theory of human values](./posts#shard-theory)
> In early 2022, [Quintin Pope](https://www.linkedin.com/in/quintin-pope/) and I noticed glaring problems at the heart of "classical" alignment arguments. We thought through the problem with fresh eyes and derived _shard theory_.
>
> Classical arguments focus on what _the_ goal of an AI will be. Why? There's not a good answer that I've ever heard. Shard theory redirects our attention from fixed single objectives. The basic upshot of shard theory: AIs and humans are well-understood as having a bunch of situationally activated goals -- "shards" of desire and preference.
>
> For example, you probably care more about people you can see. Shard theory predicts this outcome. Consider your learned decision-making circuits which bid for actions which care for your friend Bill. These circuits were probably formed when you were able to see Bill (or perhaps the vast majority of your "caring about people" circuits were formed when physically around people). If you can see Bill, that situation is more "similar to the training distribution" for your "caring about Bill" shard. Therefore, the Bill shard is especially likely to fire when you can see him.
>
> Thus, [it seems OK if our AIs don't have "perfect" shard mixtures](./alignment-without-total-robustness). The stronger their "aligned shards", the more human welfare weighs on their decision-making. We're playing a game of inches, so let's play to win.
>
> ![](https://assets.turntrout.com/static/images/posts/human_shards.avif)

## Looking back on shard theory

Subtitle: Written in October 2024

I think shard theory is broadly correct. However, Quintin and I never got too far into the (still unexplored) interesting aspects of the theory because we underestimated the work needed to explain the initial intuitions. For example, somehow [reward is not the optimization target](/reward-is-not-the-optimization-target) remains (in my opinion) not fully understood among the readership. I'm not sure what I should have done differently, but it's probably something (and not "nothing").

I wish I had more clearly outlined my claims in a neat, propositional manner. Syllogisms seem easier to critique. It also seems easier to tell when you're messing up! I also wish that I'd called it the "shard frame", not the "shard theory." That confused some folks. I think a formal shard _theory_ is possible - I hope to supervise work formalizing shard theory itself.

On another note, shard theory is a less natural fit for LLM chatbots than for agentic systems. At least, it feels harder to reason about the shards comprising Gemini Pro's "motivations", compared to reasoning about human shards or [shards in a maze-solving policy network](/understanding-and-controlling-a-maze-solving-policy-network). I still think shard theory is a highly productive frame for LLMs, it just isn't as obvious what the shards should be.

I really enjoyed working with Quintin to generate shard theory. That said, in the end of 2022, I switched to empirical work because:

1. The AI world is moving quickly and I want to make a concrete impact,
2. I got emotionally tired of arguing with people on LessWrong, and
3. [Andrew Critch](https://acritch.com/) persuaded me that arguing on the internet is not _that_ productive.

> [!quote] Andrew Critch (according to my memory)
> If you want people to buy your models \[of how the world works\], go and do something they don't know how to do. Then come back and show them what you can do. Someone will ask you how you did it, and that's the point where you can say "well, thanks to shard theory..."

And that's when I came up with [steering vectors](#steering-vectors)!

# Mechanistic interpretability

Subtitle: January through April 2023

As I transitioned from theory to practice, I flirted with _understanding the internal mechanisms of networks_ - "mechanistic interpretability."

[Understanding and controlling a maze-solving network](/understanding-and-controlling-a-maze-solving-policy-network)

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/vyflftmbwgl7jmbaeimm.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/vyflftmbwgl7jmbaeimm.webm" type="video/webm"></video>

Figure: **Locally** [**retargeting the search**](https://www.alignmentforum.org/posts/w4aeAFzSAguvqA5qu/how-to-go-from-interpretability-to-alignment-just-retarget) **by modifying a single activation.** We found a residual channel halfway through a maze-solving network. When we set one of the channel activations to +5.5, the agent often navigates to the maze location (shown above in red) implied by that positive activation. This allows limited on-the-fly redirection of the net's goals by modifying only a single activation! For more, read [our paper](https://arxiv.org/abs/2310.08043).

[Residual stream norms grow exponentially over the forward pass](/residual-stream-norms-grow-exponentially-over-the-forward-pass)
:  ![](https://assets.turntrout.com/static/images/posts/ty8epqxasadhaiel2pnh.avif)
Figure: We had GPT-4 generate dozens of strings which "look like they could have been in GPT-2's training corpus", in addition to a few hand-written strings. We ran these strings through the model and recorded the norms of each residual stream, across layers and sequence positions.

[Can transformers act on information beyond an effective layer horizon?](/effective-layer-horizon)
: I propose that transformer circuits cannot skip more than a few layers at a time due to norm growth. Joseph Miller's initial results support this hypothesis.

# Steering vectors

Subtitle: January 2023 through November 2024

In 2023, I popularized _steering vectors_[^steering] as a cheap way to control model outputs at inference time. I first discovered the [cheese vector](/understanding-and-controlling-a-maze-solving-policy-network#subtract-the-cheese-vector-subtract-the-cheese-seeking) in a maze-solving RL environment:

<figure>
<div style="display:flex; justify-content: center; ">
<div class="subfigure">
<img src="https://assets.turntrout.com/static/images/posts/original_maze_field.avif" alt="The original probability vectors. The mouse seems 'torn' between the cheese and the right side of the maze."/>
<figcaption>(a) Original probabilities</figcaption>
</div>
<div class="subfigure">
<img src="https://assets.turntrout.com/static/images/posts/modified_maze.avif" alt="The modified probability vectors. The mouse goes to the right side of the maze, ignoring the cheese."/>
<figcaption>(b) Steered probabilities</figcaption>
</div>
<div class="subfigure">
<img src="https://assets.turntrout.com/static/images/posts/maze_field_diff.avif" alt="The change in the action probability vectors, shown in green. They point away from the cheese."/>
<figcaption>(c) Steered minus original</figcaption>
</div>
</div>
<figcaption><b>Left:</b> The net probability vectors induced by the unmodified forward passes.  <br/> <b>Middle:</b> After subtracting the cheese vector, we plot the new probability vectors induced by the modified forward passes. <br/><b>Right:</b> The agent now heads away from the cheese.</figcaption>
</figure>

After finding [an additional vector for the maze agent](/top-right-steering-vector), my [MATS](https://matsprogram.org) team and I [steered GPT-2-XL by adding an activation vector](/gpt2-steering-vectors):

> [!abstract] [Steering Language Models With Activation Engineering](https://arxiv.org/abs/2308.10248)
> Prompt engineering and finetuning aim to maximize language model performance on a given metric (like toxicity reduction). However, these methods do not fully elicit a model's capabilities. To reduce this gap, we introduce activation engineering: the inference-time modification of activations in order to control (or steer) model outputs. Specifically, we introduce the Activation Addition (ActAdd) technique, which contrasts the intermediate activations on prompt pairs (such as "Love" versus "Hate") to compute a steering vector.
>
> By tactically adding in e.g. the "Love" − "Hate" steering vector during the forward pass, we achieve SOTA on negative-to-positive sentiment shift and detoxification using models including LLaMA-3 and OPT. ActAdd yields inference-time control over high-level output properties (like topic and sentiment) while preserving performance on off-target tasks. ActAdd is lightweight: it does not require any machine optimization and works with a single pair of data points, which enables rapid iteration over steering. ActAdd demonstrates the power of activation engineering.

During 2023 and 2024, activation engineering inspired [dozens of follow-up papers](https://www.lesswrong.com/posts/3ghj8EuKzwD3MQR5G/an-introduction-to-representation-engineering-an-activation). At Google DeepMind, Mark Kurzeja and I found [a negative result when attempting to steer Gemini towards higher benchmark scores](/gemini-steering).

## Reflections on steering vector work

Subtitle: Written in October 2024

A few colleagues I respect were skeptical of steering vectors at first. I feel proud of how I generated the technique:

<!-- vale off -->
> [!quote] [Retrospective comment I wrote](https://www.lesswrong.com/posts/cAC4AXiNC5ig6jQnc/understanding-and-controlling-a-maze-solving-policy-network?view=postCommentsTop&postId=cAC4AXiNC5ig6jQnc&commentId=jZ9v8yJHp43FEXJkp)
> In light of Anthropic's viral "Golden Gate Claude" activation engineering, I want to come back and claim the points I earned \[in this post\].
  >
  > I was extremely prescient in predicting the importance and power of activation engineering (then called "AVEC"). **In** _**January**_ **2023, right after running the cheese vector as my** _**first**_ **idea for what to do to interpret the network, and well before anyone ran LLM steering vectors...** **I had only seen the cheese-hiding vector work on a few mazes. Given that (seemingly) tiny amount of evidence, I** **immediately wrote down 60% credence that the technique would be a big deal for LLMs...**
<!-- vale on -->

[^steering]: "Steering vector" was originally coined by [Subramani et al. (2022)](https://arxiv.org/abs/2205.05124).

Papers:

- [Understanding and Controlling a Maze-Solving Policy Network](https://arxiv.org/abs/2310.08043)
- [Steering Language Models With Activation Engineering](https://arxiv.org/abs/2308.10248)
- [Steering Llama 2 via Contrastive Activation Addition](https://arxiv.org/abs/2310.08043)
  
# Gradient routing

Subtitle: June 2024 through the present

Neural networks are [oft dismissed as "inscrutable"](https://www.lesswrong.com/posts/uMQ3cqWDPHhjtiesc/agi-ruin-a-list-of-lethalities) - hopeless messes which we'd be lucky to learn basic facts about through laborious interpretability. [Gradient routing](/gradient-routing) strikes back by enabling (limited, apparently scalable) control over where networks learn selected capabilities.

> [!abstract] [Gradient Routing: Masking Gradients to Localize Computation in Neural Networks](https://arxiv.org/abs/2410.04332)
> Neural networks are trained primarily based on their inputs and outputs, without regard for their internal mechanisms. These neglected mechanisms determine properties that are critical for safety, like (i) transparency; (ii) the absence of sensitive information or harmful capabilities; and (iii) reliable generalization of goals beyond the training distribution. To address this shortcoming, we introduce gradient routing, a training method that isolates capabilities to specific subregions of a neural network. Gradient routing applies data-dependent, weighted masks to gradients during backpropagation. These masks are supplied by the user in order to configure which parameters are updated by which data points.
>
> We show that gradient routing can be used to (1) learn representations which are partitioned in an interpretable way; (2) enable robust unlearning via ablation of a pre-specified network subregion; and (3) achieve scalable oversight of a reinforcement learner by localizing modules responsible for different behaviors. Throughout, we find that gradient routing localizes capabilities even when applied to a limited, ad-hoc subset of the data. We conclude that the approach holds promise for challenging, real-world applications where quality data are scarce.

![](https://assets.turntrout.com/static/images/posts/gradient-routing-mask-networks.avif)
Figure: By masking gradient updates, gradient routing controls which datapoints update which parameters. The result: Coarse-grained localization of where capabilities (like virology knowledge or goal pursuit) are learned.
