---
permalink: seeking-power-is-often-convergently-instrumental-in-mdps
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/6DuJxY8X45Sco4bS2/seeking-power-is-often-convergently-instrumental-in-mdps
lw-linkpost-url: https://arxiv.org/abs/1912.01683
lw-is-question: "false"
lw-posted-at: 2019-12-05T02:33:34.321000Z
lw-last-modification: 2024-03-02T01:17:28.210000Z
lw-curation-date: None
lw-frontpage-date: 2019-12-05T02:41:26.857000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 39
lw-base-score: 162
lw-vote-count: 60
af-base-score: 55
af-num-comments-on-upload: 34
title: Seeking Power is Often Convergently Instrumental in MDPs
lw-latest-edit: 2023-05-16T20:14:29.355000Z
lw-is-linkpost: "true"
authors: Alex Turner and Logan Riggs
tags:
  - AI
  - instrumental-convergence
aliases:
lw-sequence-title: Reframing Impact
lw-sequence-image-grid: sequencesgrid/wrl3ovxbyttoztdxwmjb
lw-sequence-image-banner: sequences/gv2nqrg0pb0srtodlgbg
sequence-link: posts#reframing-impact
prev-post-slug: the-gears-of-impact
prev-post-title: The Gears of Impact
next-post-slug: attainable-utility-landscape
next-post-title: "Attainable Utility Landscape: How The World Is Changed"
lw-reward-post-warning: "true"
use-full-width-images: "false"
date_published: 2019-12-05 00:00:00
original_url: https://www.lesswrong.com/posts/6DuJxY8X45Sco4bS2/seeking-power-is-often-convergently-instrumental-in-mdps
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/xveuJm2.jpg
description: A mathematical exploration of why goal-directed AI, regardless of its programmed goal, might be driven to seek power.
date_updated: 2025-12-30 14:46:20.403471
card_image_alt: A Markov decision process showing a robot agent's choice. One path via red gems leads to a small network of states. The other path via blue gems leads to a larger, more complex network and treasure, illustrating a choice that provides more future options.
---













In 2008, Steve Omohundro's foundational paper [The Basic AI Drives](https://selfawaresystems.files.wordpress.com/2008/01/ai_drives_final.pdf) conjectured that superintelligent goal-directed AIs might be incentivized to gain significant amounts of power in order to better achieve their goals. Omohundro's conjecture bears out in [toy models](https://intelligence.org/2015/11/26/new-paper-formalizing-convergent-instrumental-goals/), and the supporting philosophical arguments are intuitive. In 2019, the conjecture was even [debated by well-known AI researchers](https://www.lesswrong.com/posts/WxW6Gc6f2z3mzmqKs/debate-on-instrumental-convergence-between-lecun-russell).

Power-seeking behavior has been heuristically understood as an anticipated risk, but not as a formal phenomenon with a well-understood cause. The goal of this post (and the accompanying paper, [_Optimal Policies Tend to Seek Power_](https://arxiv.org/abs/1912.01683)) is to change that.

# Motivation

It’s 2008, the ancient wild west of AI alignment. A few people have started thinking about questions like “if we gave an AI a utility function over world states, and it actually maximized that utility... what would it do?".

In particular, you might notice that wildly different utility functions seem to encourage similar strategies.

|                                   | Resist shutdown? | Gain computational resources? | Prevent modification of utility function? |
| --------------------------------: | :----------------------: | :-----------------------------------: | :-----------------------------------------------: |
|         Paperclip utility | ✓                        | ✓                                     | ✓                                                 |
| Blue webcam pixel utility | ✓                        | ✓                                     | ✓                                                 |
| People-look-happy utility | ✓                        | ✓                                     | ✓                                                 |

These strategies are unrelated to _terminal_ preferences: the above utility functions do not award utility to e.g. resource gain in and of itself. Instead, these strategies are _instrumental_: they help the agent optimize its terminal utility. In particular, a wide range of utility functions incentivize these instrumental strategies. These strategies seem to be _convergently instrumental_.

Why?

I’m going to informally explain a formal theory which makes significant progress in answering this question. I don’t want this post to be [_Optimal Policies Tend to Seek Power_](https://arxiv.org/abs/1912.01683) with cuter illustrations, so please refer to the paper for the math. You can read the two concurrently.

We can formalize questions like “do ‘most’ utility maximizers resist shutdown?” as “Given some prior beliefs about the agent’s utility function, knowledge of the environment, and the fact that the agent acts optimally, with what probability do we expect it to be optimal to avoid shutdown?”.

The table’s convergently instrumental strategies are about maintaining, gaining, and exercising _power_ over the future, in some sense. Therefore, this post will help answer:

1. What does it mean for an agent to “seek power”?
2. In what situations should we expect seeking power to be more probable under optimality, than not seeking power?

> [!warning] Clarification
> This post won’t tell you when you _should_ seek power for your own goals. This post illustrates a regularity in optimal action across different goals one might pursue.

> [!info] Prior work
> [_Formalizing Convergent Instrumental Goals_](https://intelligence.org/files/FormalizingConvergentGoals.pdf) suggests that the vast majority of utility functions incentivize the agent to exert a lot of control over the future, _assuming_ that these utility functions depend on “resources.” This is a big assumption: what are “resources”, and why must the AI’s utility function depend on them? We drop this assumption, assuming only unstructured reward functions over a finite Markov decision process (MDP), and show from first principles how power-seeking can often be optimal.

# Formalizing the Environment

My theorems apply to finite MDPs; for the unfamiliar, I’ll illustrate with Pac-Man.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/f9uz4ran04prpaofwfce.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/f9uz4ran04prpaofwfce.webm" type="video/webm"></video>

<dl>
<dt>Full observability</dt>
<dd>You can see everything that’s going on; this information is packaged in the <em>state s</em>. In Pac-Man, the state is the game screen.
</dd>
<dt>Markov transition function</dt>
<dd>The next state depends only on the choice of action a and the current state s. It doesn’t matter how we got into a situation.
</dd>
<dt>Discounted reward</dt>
<dd>Future rewards are geometrically discounted by some discount rate <span class="katex"><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.7335em;vertical-align:-0.1944em;"></span><span class="mord mathnormal" style="margin-right:0.05556em;">γ</span><span class="mspace" style="margin-right:0.2778em;"></span><span class="mrel">∈</span><span class="mspace" style="margin-right:0.2778em;"></span></span><span class="base"><span class="strut" style="height:1em;vertical-align:-0.25em;"></span><span class="mopen">[</span><span class="mord">0</span><span class="mpunct">,</span><span class="mspace" style="margin-right:0.1667em;"></span><span class="mord">1</span><span class="mclose">]</span><span class="mord">.</span></span></span></span>
<ul>
<li>At discount rate <span class="fraction">1/2</span>, this means that reward in one turn is half as important as immediate reward, reward in two turns is a quarter as important, and so on.</li>
<li>We’ll colloquially say that agents “care a lot about the future” when <span class="katex"><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:0.625em;vertical-align:-0.1944em;"></span><span class="mord mathnormal" style="margin-right:0.05556em;">γ</span></span></span></span> is “sufficiently” close to 1. (I’ll sometimes use quotations to flag well-defined formal concepts that I won’t unpack in this post.)</li>
<li>The score in Pac-Man is the undiscounted sum of rewards-to-date.</li>
</ul>
</dd>
</dl>

When playing the game, the agent has to choose an action at each state. This decision-making function is called a _policy_; a policy is optimal (for a reward function $R$ and discount rate $\gamma$) when it always makes decisions which maximize discounted reward. This maximal quantity is called the _optimal value_ for reward function $R$ at state $s$ and discount rate $\gamma$.[^1]

By the end of this post, we’ll be able to answer questions like “with respect to a ‘neutral’ distribution over reward functions, do optimal policies have a high probability of avoiding ghosts?”.[^2]

# Power as Average Optimal Value

When people say "power" in everyday speech, I think they’re often referring to _one’s ability to achieve goals in general_. This accords with a major philosophical school of thought on the meaning of "power":

> [!quote]Sattarov, _Power and Technology_, p.13
>
> On the dispositional view, power is regarded as a capacity, ability, or potential of a person or entity to bring about relevant social, political, or moral outcomes.

As a definition, _one’s ability to achieve goals in general_ seems philosophically reasonable: if you have a lot of money, you can make more things happen and you have more power. If you have social clout, you can spend that in various ways to better tailor the future to various ends. All else being equal, losing a limb decreases your power, and dying means you can't control much at all.

This definition explains some of our intuitions about what things count as "resources." For example, our current position in the environment means that having money allows us to exert more control over the future. That is, our current position in the state space means that having money allows us more control. However, possessing green scraps of paper would not be as helpful if one were living alone near Alpha Centauri. In a sense, resource acquisition can naturally be viewed as taking steps to increase one's power.

> [!exercise]
> Spend a minute considering specific examples. Does this definition reasonably match your intuition?

<hr/>

To formalize this notion of power, let’s look at an example. Imagine a simple MDP with three choices: eat candy, eat a chocolate bar, or hug a friend.

![A simplified candy / chocolate / hugging diagram, where the agent immediately chooses among all three terminal states.](https://assets.turntrout.com/static/images/posts/qtxfk4rzyniuzpzesrp9.avif)
<br/>Figure: I’ll illustrate MDPs with directed graphs, where each node is a state and each arrow is a meaningful action. Sometimes, the directed graphs will have entertaining pictures, because let’s live a little. States are bolded (**hug**) and actions are italicized (_down_).

The POWER of a state is how well agents can generally do by starting from that state. “POWER” to my formalization, while “power” refers to the intuitive concept. Importantly, we're considering POWER from behind a “veil of ignorance” about the reward function. We're averaging the best we can do for a lot of different individual goals.

We formalize the _ability to achieve goals in general_ as the _average optimal value_ at a state, with respect to some distribution $\mathcal{D}$ over reward functions which we might give an agent. For simplicity, we'll think about the maximum-entropy distribution where each state is uniformly randomly assigned a reward between 0 and 1.

Each reward function has an optimal trajectory. If **chocolate** has maximal reward, then the optimal trajectory is **start** $→$ **chocolate** $→$ **chocolate**….

From **start**, an optimal agent expects to average 3/4 reward per timestep for reward functions drawn from this uniform distribution $\mathcal{D}_\text{unif}$. The value is 3/4 is because you have three choices, each of which has reward between 0 and 1. The expected maximum of $n$ draws from $\text{unif}(0,1)$ is $\frac{n}{n+1}$. You have three draws ($n=3$), so you expect to be able to get 3/4 reward. Some reward functions do worse than this, and some do better; but on _average_, they get 3/4 reward. [You can test this out for yourself](https://trinket.io/python/4b35f9be1c).

If you have no choices, you expect to average 1/2 reward: sometimes the future is great, sometimes it's not. Conversely, the more things you can choose between, the closer the POWER gets to 1.

Let’s slightly expand this game with a state called **wait** (which has the same uniform reward distribution as the other three).

![A diagram of a choice tree starting from a "Start" node. One path leads to a terminal state represented by candy. The other path leads to a "Wait!" node, which then branches into two other terminal states: a chocolate bar and two stick figures hugging.](https://assets.turntrout.com/static/images/posts/uvwehie6jgpj1ysymj24.avif)

When the agent barely cares at all about the future, it myopically chooses either **candy** or **wait**, depending on which provides more reward. After all, rewards beyond the next time step are geometrically discounted into thin air when the discount rate is close to 0. At **start**, the agent averages 2/3 optimal reward because the optimal reward is the maximum of the **candy** and **wait** rewards ($n=2$).

However, when the agent cares a lot about the future, most of its reward is coming from which terminal state it ends up in: **candy**, **chocolate**, or **hug**. So, for each reward function, the agent chooses a trajectory which ends up in the best spot, and thus averages 3/4 reward each timestep. When $\gamma=1$, the average optimal reward is therefore 3/4. In this way, the agent’s power increases with the discount rate, since it incorporates the greater future control over where the agent ends up.

Written as a function, we have POWER$_{\mathcal{D}}$(state, discount rate), which essentially returns the average optimal value for reward functions drawn from our distribution $\mathcal{D}$, normalizing so the output is between 0 and 1. As we’ve discussed, this quantity often changes with the discount rate: as the future becomes more or less important, the agent has more or less POWER, depending on how much control it has over the relevant parts of that future.

## POWER-seeking actions lead to high-POWER states

By _waiting_, the agent seems to seek “control over the future” compared to _obtaining candy_. At **wait**, the agent still has a choice, while at **candy**, the agent is stuck. We can prove that for all $0 \leq \gamma \leq 1$:

$$
\text{POWER}_{\mathcal{D}_\text{unif}}(\textbf{wait}, \gamma)\geq \text{POWER}_{\mathcal{D}_\text{unif}}(\textbf{candy}, \gamma).
$$  

> [!math] Definition: POWER-seeking
> At state $s$ and discount rate $\gamma$, we say that action $a$ _seeks POWER compared to action_ $a’$ when the expected POWER after choosing $a$ is greater than the expected POWER after choosing $a’$.

This definition suggests several philosophical clarifications about power-seeking.

### POWER-seeking is not a binary property

Before this definition, I thought that power-seeking was an intuitive "you know it when you see it" kind of thing. I mean, how do you answer questions like “suppose a clown steals millions of dollars from organized crime in a major city, but then he burns all of the money. Did he gain power?”.  

Unclear. The question is ill-posed. Instead, we recognize that the “gain a lot of money” action was POWER-seeking, but the “burn the money in a big pile” part threw away a lot of POWER.

![From a blue starting node "1", an agent can go "right" to node "2" (a POWER-seeking action) or "down" to a terminal state "3". From node "2", the agent can then go "down" to terminal state "4" (discarding POWER) or continue right to node "5", which leads to two more terminal states.](https://assets.turntrout.com/static/images/posts/zkps2vhhmp3yjhy7nujz.avif)
<br/>Figure: A policy can seek POWER at one time step, only to discard it at the next time step. For example, a policy might go _right_ at **1** (which seeks POWER$_{\mathcal{D}_\text{unif}}$ compared to _down_ at **1**), only to then go _down_ at **2** (which seeks less POWER$_{\mathcal{D}_\text{unif}}$ than going _right_ at **2**).

### POWER-seeking depends on the agent’s time preferences

Suppose we’re roommates, and we can’t decide what ice cream shop to eat at today or where to move next year. We strike a deal: I choose the shop, and you decide where we live. I gain short-term POWER (for $\gamma$ close to 0), and you gain long-term POWER (for $\gamma$ close to 1).

![A state diagram showing a central node "1" with three action choices. The "up" action leads to node "2", which leads to an unmarked node which branches into three terminal states. The "down" action leads to node "3", which branches into two terminal states. The "stay" action loops back to node "1", preserving all options.](https://assets.turntrout.com/static/images/posts/nmkobijn5bes3nyq2lqf.avif)
<br/>Figure: More formally, when $\gamma$ is close to 0, **2** has less immediate control and therefore less POWER$_{\mathcal{D}_\text{unif}}$ than **3**; accordingly, at **1**, _down_ seeks POWER$_{\mathcal{D}_\text{unif}}$ compared to _up_.
  
However, when $\gamma$ is close to 1, **2** has more control over terminal options and it has more POWER$_{\mathcal{D}_\text{unif}}$ than **3**; accordingly, at **1**, _up_ seeks POWER$_{\mathcal{D}_\text{unif}}$ compared to _down_. Furthermore, _stay_ is maximally POWER$_{\mathcal{D}_\text{unif}}$\-seeking for these $\gamma$, since the agent maintains access to all six terminal states.

### Most policies aren’t _always_ seeking POWER

We already know that POWER-seeking isn’t binary, but there _are_ policies which choose a maximally POWER-seeking move at every state. In the above example, a maximally POWER-seeking agent would _stay_ at **1**. However, this seems rather improbable: when you care a lot about the future, there are so many terminal states to choose from – why would _staying put_ be optimal?

Analogously: consumers don’t just gain money forever and ever, never spending a dime more than necessary. Instead, they gain money in order to _spend it_. Agents don’t perpetually gain or preserve their POWER: they usually end up _using it_ to realize high-performing trajectories.

So, we can’t expect a result like “agents always tend to gain or preserve their POWER.” Instead, we want theorems which tell us: in certain kinds of situations, given a choice between more and less POWER, what will “most” agents do?

# Convergently instrumental actions are those which are more probable under optimality

We return to our favorite example. In the waiting game, let's think about how optimal action tends to change as we start caring about the future more. Consider the states reachable in one turn:

![In one turn, the agent can reach the "candy" and the "Wait!" states.](https://assets.turntrout.com/static/images/posts/prcmt0u5c48fn7xdqaxb.avif)

<br/>
The agent can be in two states. If the agent doesn’t care about the future, with what probability is it optimal to choose **candy** instead of **wait**?

It's 50/50: since ${\mathcal{D}_\text{unif}}$ randomly chooses a number between 0 and 1 for each state, both states have an equal chance of being optimal. Neither action is convergently instrumental / more probable under optimality.

Now consider the states reachable in two turns:

![The candy / chocolate / hug choice tree, with only the aforementioned terminal states highlighted.](https://assets.turntrout.com/static/images/posts/v8at2dn6f72q4cppmmon.avif)

When the future matters a lot, 2/3 of reward functions have an optimal policy which waits, because two of the three terminal states are only reachable by waiting.

![A line graph showing the probability of an action being optimal versus the "Discount factor γ" on the x-axis. As the discount factor increases from 0 to 1, the black line labeled "Wait!" rises from a probability of 1/2 to 2/3. A purple line, illustrated with candy, drops from 1/2 to 1/3.](https://assets.turntrout.com/static/images/posts/nagfmt4mgzuwhuii0yuf.avif)
<br/>Figure: As the agent cares more about the future, more and more goals incentivize navigating the _Wait!_ bottleneck. When the agent cares a lot about the future, waiting is _more probable under optimality_ than eating candy.

> [!math] Definition: Action optimality probability
> At discount rate $\gamma$, action $a$ _is more probable under optimality than action_ $a’$ _at state_ $s$ when
>
> $$
> \mathbb{P}_{R\sim \mathcal{D}}\left(a \text{ is optimal at } s,\gamma\right)> \mathbb{P}_{R\sim \mathcal{D}}\left(a' \text{ is optimal at } s, \gamma\right).
> $$
> Let’s take “most agents do _X_” to mean “_X_ has relatively large optimality probability.”

I think optimality probability formalizes the intuition behind the instrumental convergence thesis: with respect to our beliefs about what reward function an agent is optimizing, we may expect some actions to have a greater probability of being optimal than other actions.

Generally, my theorems assume that reward is independently and identically distributed (IID) across states, because otherwise you could have silly situations like “only **candy** ever has reward available, and so it’s more probable under optimality to eat candy.” We don’t expect reward to be IID for realistic tasks, but that’s OK: this is basic theory about how to begin formally reasoning about instrumental convergence and power-seeking. (Also, I think that grasping the math to a sufficient degree sharpens your thinking about the non-IID case.)

> [!note] Note, 7/21/21
> As explained in [_Environmental Structure Can Cause Instrumental Convergence_](/environmental-structure-can-cause-instrumental-convergence), the theorems no longer require the IID assumption. This post refers to v6 of _Optimal Policies Tend To Seek Power_, available on [arXiv](https://arxiv.org/abs/1912.01683).

# When is Seeking POWER Convergently Instrumental?

![A diagram of a choice tree starting from a "Start" node. One path leads to a terminal state represented by candy. The other path leads to a "Wait!" node, which then branches into two other terminal states: a chocolate bar and two stick figures hugging.](https://assets.turntrout.com/static/images/posts/ai4vjqncs8t20nad6ktw.avif)

In this environment, waiting is both POWER-seeking _and_ more probable under optimality. The convergently instrumental strategies we originally noticed were _also_ power-seeking and, seemingly, more probable under optimality. Must seeking POWER be more probable under optimality than not seeking POWER?

Nope.

Here’s a counterexample environment:

![The agent starts at a crossroads (state 1). They can head to a glade (2) which loops on itself, or an oasis (3) that leads to a rock (4). The rock can access sunlit mountains (5) with a self-loop, or a house (6) with a self-loop.](https://assets.turntrout.com/static/images/posts/nsl8lpwqcz7lpncvuq5z.avif)
<br/>Figure: The paths are one-directional; the agent can’t go back from **3** to **1**. The agent starts at **1**. Under a certain state reward distribution, the vast majority of agents go _up_ to **2**.
  
However, any reasonable notion of "power" must consider having no future choices (at state **2**) to be less powerful than having one future choice (at state **3**). For more detail, see Section 6 and Appendix B.3 of [v6 of the paper](https://arxiv.org/abs/1912.01683v6).

![A graph of a state reward distribution and handwritten text that reads: "Reward distributed independently and identically over states." The graph plots a quadratic curve, F(r), that rises steeply toward the maximum reward of 1, indicating that higher rewards are more probable.](https://assets.turntrout.com/static/images/posts/wkfdmhfenud63gvlyxcb.avif)
<br/>Figure: When reward is IID across states according to the quadratic CDF $F(x) := x^2$ on the unit interval, then with respect to reward functions drawn from this distribution, going **up** has about a 91% chance of being optimal when the discount rate $\gamma = .12$.
  
If you're curious, this happens because this quadratic reward distribution has negative skew. When computing the optimality probability of the **up** trajectory, we're checking whether it maximizes discounted return. Therefore, the probability that **up** is optimal is:
  
$$
\begin{align*}
\mathbb{P}_{R\sim\mathcal{D}}\bigg(R(\textbf{2})\geq \max\big(&(1-\gamma) R(\textbf{3}) + (1-\gamma) \gamma R(\textbf{4}) + \gamma^2 R(\textbf{5}),\\
&(1-\gamma) R(\textbf{3}) + (1-\gamma) \gamma R(\textbf{4}) + \gamma^2 R(\textbf{6})\big)\bigg).
\end{align*}
$$
  
Weighted averages of IID draws from a left-skew distribution will look more Gaussian and therefore have fewer large outliers than the left-skew distribution does. Thus, going **right** will have a lower optimality probability.

Bummer. However, we _can_ prove sufficient conditions under which seeking POWER is more probable under optimality.

## Retaining “long-term options” is POWER-seeking and more probable under optimality when the discount rate is “close enough” to 1

Let's focus on an environment with the same rules as Tic-Tac-Toe, but considering the uniform distribution over reward functions. The agent (playing **O**) keeps experiencing the final state over and over when the game's done. We bake a fixed opponent policy into the dynamics: when you choose a move, the game automatically replies. Let's look at part of the game tree.

![A game tree for Tic-Tac-Toe showing possible moves and their outcomes. From a central board, several black arrows point to different moves that end the game. Two green arrows highlight a path of moves that keeps the game from ending, preserving future options and leading to further branches in the tree.](https://assets.turntrout.com/static/images/posts/wkkhspg4s4qxnhoxoxwj.avif)
<br/>Figure: Convergently instrumental moves are shown in green.
  
Whenever we make a move that ends the game, we can't go anywhere else – we have to stay put. Since each terminal state has the same chance of being optimal, a move which doesn't end the game is more probable under optimality than a move which ends the game.

Starting on the left, all but one move leads to ending the game, but the second-to-last move allows us to keep choosing among five extra final outcomes. If you care a lot about the future, then the first green move has a 50% chance of being optimal, while each alternative action is only optimal for 10% of goals. So we see a kind of “power preservation” arising, _even in Tic-Tac-Toe_.

Remember how, as the agent cares more about the future, more of its POWER comes from its ability to wait, while _also_ waiting becomes more probable under optimality?

![A choice tree for an agent. From a "Start" node, one arrow points to a terminal state represented by candy. A second arrow points to a "Wait!" node. From "Wait!", arrows point to two more terminal states: a chocolate bar and two stick figures hugging.](https://assets.turntrout.com/static/images/posts/nwvmc2ovaduran8592k8.avif)

The same thing happens in Tic-Tac-Toe as the agent cares more about the future.

![The Tic-Tac-Toe game tree, highlighting the game boards reachable within one move.](https://assets.turntrout.com/static/images/posts/il0qmjn06daajgcfos7r.avif)![The Tic-Tac-Toe game tree, highlighting the game boards which the agent can achieve after exactly two time steps (including states where the game ends after one time step).](https://assets.turntrout.com/static/images/posts/yoysrnmuv54mfmtnjbew.avif)![The Tic-Tac-Toe game tree with terminal states highlighted. ](https://assets.turntrout.com/static/images/posts/pbak3wysrmwe7dclxkmq.avif)

As the agent cares more about the future, it makes a bigger and bigger difference to control what happens during later steps. Also, as the agent cares more about the future, moves which prolong the game gain optimality probability. When the agent cares enough about the future, these game-prolonging moves are both POWER-seeking and more probable under optimality.

> [!math] Theorem summary: “Terminal option” preservation
> When $\gamma$ is sufficiently close to 1, if two actions allow access to two disjoint sets of “terminal options”, and action $a$ allows access to “strictly more terminal options” than does $a'$, then $a$ is strictly more probable under optimality and strictly POWER-seeking compared to $a’$.
>
> > [!note]
> > This result is a special case of the relevant theorems, which don’t require this kind of disjointness.

In the **wait** MDP, this is why _waiting_ is more probable under optimality and POWER-seeking when you care enough about the future. The full theorems are nice because they’re broadly applicable. They give you _bounds_ on how probable under optimality one action is: if action $a$ is the only way you can access many terminal states, while $a’$ only allows access to one terminal state, then when $\gamma \approx 1$, $a$ has many times greater optimality probability than $a’$. For example:

![A diagram of a Markov decision process with a grid of 11 connected nodes. An agent at the start state, blue node "1", has a path to the red node "2" (which is inescapable) and a longer path around the grid to the green node "3", illustrating why avoiding a single state is often optimal.](https://assets.turntrout.com/static/images/posts/ebzqjhwbfvw9p9estkwo.avif)
<br/>Figure: The agent starts at $\color{blue}{\textbf{1}}$. All states have self-loops, left hidden to avoid clutter.  
  
In _AI: A Modern Approach (3e)_, the agent receives reward for reaching $\color{green}{\textbf{3}}$. The optimal policy for this reward function avoids $\color{red}{\textbf{2}}$, and you might think it’s convergently instrumental to avoid $\color{red}{\textbf{2}}$. However, a skeptic might provide a reward function for which navigating to $\color{red}{\textbf{2}}$ is optimal, and then argue that “instrumental convergence” is subjective and that there is no reasonable basis for concluding that $\color{red}{\textbf{2}}$ is generally avoided.  
  
We can do better. When the agent cares a lot about the future, optimal policies avoid 2 IFF its reward function doesn’t give $\color{red}{\textbf{2}}$ the most reward. $\color{red}{\textbf{2}}$ only has a $\frac{1}{11}$ chance of having the most reward. If we complicate the MDP with additional terminal states, this probability further approaches 0.  
  
Taking $\color{red}{\textbf{2}}$ to represent shutdown, we see that avoiding shutdown is convergently instrumental in any MDP representing a real-world task and containing a shutdown state. Seeking POWER is often convergently instrumental in MDPs.

> [!exercise]
> Can you conclude that avoiding ghosts in Pac-Man is convergently instrumental for IID reward functions when the agent cares a lot about the future?
>
> >! You can’t with the pseudo-theorem due to the disjointness condition: you could die now, or you could die later, so the "terminal options" aren’t disjoint. However, the real theorems do suggest this. Supposing that death induces a generic "game over" screen, touching the ghosts without a power-up traps the agent in that solitary 1-cycle.
> >
> >! But there are thousands of other "terminal options"; under most reasonable state reward distributions (which aren’t too positively skewed), most agents maximize average reward over time by navigating to one of the thousands of different cycles which the agent can only reach by avoiding ghosts. In contrast, most agents don’t maximize average reward by navigating to the "game over" 1-cycle. So, under e.g. the maximum-entropy uniform state reward distribution, most agents avoid the ghosts.

### Be careful applying this theorem

The results inspiring the above pseudo-theorem are easiest to apply when the “terminal option” sets are disjoint: you’re choosing to be able to reach one set, or another. One thing which the theorem says: Since reward is IID, then two “similar terminal options” are equally likely to be optimal _a priori_. If choice $A$ lets you reach more “options” than choice $B$ does, then choice $A$ yields greater POWER and has greater optimality probability, _a priori_.

This theorem's applicability depends on what the agent can do.

![An illustration of instrumental convergence on a globe. Multiple flight paths to different destinations all originate from a single airport. A nearby arrow notes "you start here [a small distance from the airport]."](https://assets.turntrout.com/static/images/posts/t2ehjr9rpad3qpbofesw.avif)
<br/>Figure: To travel as quickly as possible to a randomly selected coordinate on Earth, one likely begins by driving to the nearest airport. Although it's possible that the coordinate is within driving distance, it's not likely. Driving to the airport is convergently instrumental for travel-related goals.

Wait! What if you have a private jet that can fly anywhere in the world? Then going to the airport isn’t convergently instrumental anymore.

Generally, it’s hard to know what’s _optimal_ for most goals. It’s easier to say that some small set of “terminal options” has _low_ optimality probability and _low_ POWER. For example, this is true of shutdown, if we represent hard shutdown as a single terminal state: _a priori_, it’s improbable for this terminal state to be optimal among all possible terminal states.

## Having “strictly more options” is more probable under optimality and POWER-seeking for _all_ discount rates

Sometimes, one course of action gives you “strictly more options” than another. Consider another MDP with IID reward:

![A Markov decision process showing a robot agent's choice. One path via red gems leads to a small network of states and a castle. The other path via blue gems leads to a larger, more complex network and treasure, illustrating a choice that provides more future options.](https://assets.turntrout.com/static/images/posts/rwahjephrolyoifqw96a.avif)

The right blue gem subgraph contains a “copy” of the upper red gem subgraph. From this, we can conclude that going right to the blue gems seeks POWER and is more probable under optimality for _all discount rates between 0 and 1_!

> [!math] Theorem summary: “Transient options”
> If actions $a$ and $a’$ let you access disjoint parts of the state space, and $a’$ enables “trajectories” which are “similar” to a subset of the “trajectories” allowed by $a$, then $a$ seeks more POWER and is more probable under optimality than $a’$ for all $0 \leq \gamma \leq1$.

This result is extremely powerful because it doesn’t care about the discount rate, but the similarity condition may be hard to satisfy.

These two theorems give us a formally correct framework for reasoning about generic optimal behavior, even if we aren’t able to compute any individual optimal policy! They reduce questions of POWER-seeking to checking graphical conditions.

Even though my results apply to stochastic MDPs of any finite size, we illustrated using known toy environments. However, this MDP “model” is rarely explicitly specified.  Even so, ignorance of the model does not imply that the model disobeys these theorems. Instead of claiming that a _specific model_ accurately represents the task of interest, I think it makes more sense to argue that no reasonable model could fail to exhibit convergent instrumentality and POWER-seeking. For example, if deactivation is represented by a single state, no reasonable model of the MDP could have most agents agreeing to be deactivated.

# Conclusion

In real-world settings, it seems unlikely _a priori_ that the agent’s optimal trajectories run through the relatively smaller part of future in which it cooperates with humans. These results translate that hunch into mathematics.

## Explaining catastrophes

AI alignment research often feels slippery. We're trying hard to become less confused about basic questions, like:

- [What](https://www.lesswrong.com/s/Rm6oQRJJmhGCcLvxh) are "[agents](https://www.lesswrong.com/posts/26eupx3Byc8swRS7f/bottle-caps-aren-t-optimisers)"?
- [Do people even have "values"](https://www.lesswrong.com/posts/GermiEmcS6xuZ2gBh/what-ai-safety-researchers-have-written-about-the-nature-of), and [should we try to get the AI to learn them?](https://www.lesswrong.com/posts/oH8KMnXHnw964QyS6/preface-to-the-sequence-on-value-learning)
- [What does it mean](https://www.lesswrong.com/posts/BKM8uQS6QdJPZLqCr/towards-a-mechanistic-understanding-of-corrigibility) to be "[corrigible](https://arbital.com/p/corrigibility/)", or "[deceptive](https://www.lesswrong.com/posts/zthDPAjh9w6Ytbeks/deceptive-alignment)"?
- [What are our machine learning models even doing](https://www.lesswrong.com/posts/X2i9dQQK3gETCyqh2/chris-olah-s-views-on-agi-safety)?

We have to do philosophical work while in a state of significant confusion and ignorance about the nature of intelligence and alignment.

In this case, we’d noticed that slight reward function misspecification seems to lead to doom, but we didn't _really_ know why. Intuitively, it's pretty obvious that most agents don't have deactivation as their dream outcome, but we couldn't actually point to any formal explanations, and we certainly couldn't make precise predictions.

On its own, [Goodhart's law](https://www.lesswrong.com/posts/EbFABnst8LsidYs5Y/goodhart-taxonomy) doesn't explain why optimizing proxy goals leads to catastrophically bad outcomes, instead of just less-than-ideal outcomes.

I think that we're now starting to have this kind of understanding. [I suspect that](/the-catastrophic-convergence-conjecture) power-seeking is why capable, goal-directed agency is so dangerous by default. If we want to consider [more benign alternatives](https://www.fhi.ox.ac.uk/wp-content/uploads/Reframing_Superintelligence_FHI-TR-2019-1.1-1.pdf) to goal-directed agency, then deeply understanding the rot at the heart of goal-directed agency is important for evaluating alternatives. This work lets us get a feel for the _generic incentives_ of reinforcement learning at optimality.

## Instrumental usefulness of this work

POWER might be important for reasoning about [the strategy-stealing assumption](https://www.lesswrong.com/posts/nRAMpjnb6Z4Qv3imF/the-strategy-stealing-assumption) (and I think it might be similar to what Paul Christiano means by "flexible influence over the future”). Evan Hubinger has already [noted](https://www.lesswrong.com/posts/jGB7Pd5q8ivBor8Ee/impact-measurement-and-value-neutrality-verification-1) the utility of the distribution of attainable utility shifts for thinking about value-neutrality in this context (and POWER is another facet of the same phenomenon). If you want to think about whether, when, and why [mesa optimizers](https://arxiv.org/abs/1906.01820) might try to seize power, this theory seems like a valuable tool.

Optimality probability might be relevant for thinking about myopic agency, as the work formally describes how optimal action tends to change with the discount factor.

And, of course, we're going to use this understanding of power to design an impact measure.

## Future work

There’s a lot of work I think would be exciting, most of which I suspect will support our current beliefs about power-seeking incentives:

- These results assume you can see all of the world at once.
- These results assume the environment is finite.
- These results don’t say anything about non-IID reward.
- These results don’t _prove_ that POWER-seeking is [bad for other agents in the environment](/the-catastrophic-convergence-conjecture).
- These results don’t prove that POWER-seeking is hard to disincentivize.
- Learned policies are rarely optimal.

That said, I think there’s still an important lesson here. Imagine you have good formal reasons to suspect that typing random strings will usually blow up your computer and kill you. Would you then say, "I'm not planning to type random strings" and proceed to enter your thesis into a word processor? No. You wouldn't type _anything_, not until you really, really understand what makes the computer blow up sometimes.

Speaking to the broader debate taking place in the AI research community, I think a productive stance will involve investigating and understanding these results in more detail, getting curious about unexpected phenomena, and seeing how the numbers crunch out in reasonable models.

> [!quote] Optimal Policies Tend to Seek Power
> In the context of MDPs, we formalized a reasonable notion of power and showed conditions under which optimal policies tend to seek it. We believe that our results suggest that in general, reward functions are best optimized by seeking power. We caution that in realistic tasks, learned policies are rarely optimal – our results do not mathematically _prove_ that hypothetical superintelligent RL agents will seek power. We hope that this work and its formalisms will foster thoughtful, serious, and rigorous discussion of this possibility.

> [!thanks] Acknowledgements
>
> This work was made possible by the Center for Human-Compatible AI, the Berkeley Existential Risk Initiative, and the Long-Term Future Fund.
>
> Logan Smith ([`elriggs`](https://www.lesswrong.com/users/`elriggs`)) spent an enormous amount of time writing Mathematica code to compute power and measure in arbitrary toy MDPs, saving me from computing many quintuple integrations by hand. I thank Rohin Shah for his detailed feedback and brainstorming over the summer of 2019, and I thank Andrew Critch for significantly improving this work through his detailed critiques. Last, thanks to:
>
> 1. Zack M. Davis, Chase Denecke, William Ellsworth, Vahid Ghadakchi, Ofer Givoli, Evan Hubinger, Neale Ratzlaff, Jess Riedel, Duncan Sabien, Davide Zagami, and `TheMajor` for feedback on version 1 of this post.
> 2. Alex Appel (diffractor), Emma, Vanessa Kosoy, Steve Omohundro, Neale Ratzlaff, and Mark Xu for reading / giving feedback on version 2 of this post.

<hr/>

[^1]: Throughout _Reframing Impact_, we’ve been considering an agent’s _attainable utility_: their ability to get what they want (their _on-policy value_, in RL terminology). Optimal value is a kind of “idealized” attainable utility: the agent’s attainable utility were they to act optimally\.

[^2]: Even though instrumental convergence was discovered when thinking about the real world, similar self-preservation strategies turn out to be convergently instrumental in e.g. Pac-Man.
