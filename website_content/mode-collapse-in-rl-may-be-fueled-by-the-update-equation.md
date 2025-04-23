---
permalink: mode-collapse-in-rl-may-be-fueled-by-the-update-equation
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/A7RgYuYH4HywNeYWD/mode-collapse-in-rl-may-be-fueled-by-the-update-equation
lw-is-question: 'false'
lw-posted-at: 2023-06-19T21:51:04.129000Z
lw-last-modification: 2023-06-26T17:52:14.168000Z
lw-curation-date: None
lw-frontpage-date: 2023-06-20T01:38:30.736000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 10
lw-base-score: 49
lw-vote-count: 20
af-base-score: 24
af-num-comments-on-upload: 7
publish: true
title: Mode collapse in RL may be fueled by the update equation
lw-latest-edit: 2023-06-24T18:23:46.663000Z
lw-is-linkpost: 'false'
authors: Alex Turner and Michael Einhorn
tags:
  - AI
  - reinforcement-learning
aliases:
  - mode-collapse-in-rl-may-be-fueled-by-the-update-equation
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2023-06-19 00:00:00
original_url: 
  https://www.lesswrong.com/posts/A7RgYuYH4HywNeYWD/mode-collapse-in-rl-may-be-fueled-by-the-update-equation
skip_import: true
description: A proposed tweak to policy gradient algorithms may avoid mode collapse,
  but more research is needed to assess its practicality.
date_updated: 2025-04-12 09:51:51.137842
---








**TL;DR:** We present an advantage variant which, in certain settings, does not train an optimal policy, but instead uses a fixed reward to update a policy a fixed amount from initialization. Non-tabular empirical results seem mixed: The policy doesn't mode-collapse, but has unclear convergence properties.

**Summary:** Many policy gradient methods allow a network to extract arbitrarily many policy updates from a single kind of reinforcement event (e.g. for outputting tokens related to weddings). Alex proposes a slight modification to the advantage equation, called "action-conditioned TD error" (ACTDE). ACTDE ensures that the network doesn't converge to an "optimal" policy (these almost always put infinite logits on a single action). Instead, ACTDE updates the network by a fixed number of logits.

For example, suppose $R(\text{pizza})=10$  and $R(\text{cookies})=11$. In this case, PPO converges to a policy which puts arbitrarily many logits on $\text{cookies}$, even though the reward difference is small. By contrast, under ACTDE, the network converges to the softmax-over-reward policy \{pizza: 27%, cookies: 73%\}, which seems more reasonable.

Then, Michael Einhorn shares initial results which support Alex's theoretical predictions. Using a similar architecture and Q-head loss function to [ILQL](https://arxiv.org/abs/2110.06169) for a small transformer trained in a prisoner's dilemma, Michael Einhorn collected initial data on ACTDE. Unlike PPO, ACTDE-trained policies did not mode collapse onto a single action and instead learned mixed strategies.

We're interested in additional experiments on ACTDE. We hope that, by using ACTDE instead of advantage, we can automatically mitigate "reward specification" issues and maybe even reduce the need for a KL penalty term. That would make it easier to shape policies which do what we want.

## The advantage equation implies arbitrary amounts of update on a single experience

In PPO, the optimization objective is proportional to the advantage given a policy $\pi$, reward function $R$, and on-policy value function $v^\pi$:[^1]

$$
\begin{aligned}A^\pi(s, a):=\mathbb{E}_{s^{\prime} \sim T(s,a)}\left[R\left(s, a, s^{\prime}\right)+\gamma v^\pi\left(s^{\prime}\right)\right]-v^\pi(s).\end{aligned}
$$

Alex thinks this equation is actually pretty messed up, although it looked decent at first. The problem is that this advantage can oscillate forever. To explain, let's consider a simple bandit problem—one state ("We had a") and two actions ("wedding" and "party") with rewards $R(\text{“We had a wedding”})=1$ and $R(\text{``We had a party''})=.5$.

The failure which happens is:

1. The policy tries out the "wedding" action, receives strong reinforcement of $R=1$, and increasing logits on that action because its advantage was positive. The policy learns that its value is high ($v^\pi(s)=1$).
2. The policy eventually tries out the "party" action, receiving less reinforcement at $R=.5$, decreasing the logits on "party" (because its advantage was negative). The policy learns that the original state's value is low ($v^\pi(s)=.5$).
3. The policy tries out "wedding" again, receives positive advantage relative to the low original state value. The logits go up on "wedding", and the value is once again high ($v^\pi(s)=1$).

This continues to happen, which means that "wedding" gets arbitrarily high logits.

This flaw is easiest to see formally. Initialize the $t=0$ tabular value function $v^\pi_0$ to 0, and the policy $\pi_0$ to be 50/50 for "party"/"wedding". Let $\gamma=1$, and we update the value function $v$ using tabular TD learning (with learning rate $\alpha=1$). So, for example, if the system takes the "wedding" action, its new value function $v_1^\pi(s)=1$. If the system then takes the "party" action, the value snaps back to $v_2^\pi(s)=.5$.[^2]

The policy update rule is: If the advantage $A^\pi(s,a)=n$, then action $a$ becomes $n$ bits more probable under $\pi$ (i.e. we add $n$ to $\pi$'s logits on $a$). So, if $\pi_0(s,\text{`` wedding''})=.5$ and advantage $A^{\pi_0}(s,\text{`` wedding''})=1$, then $\pi_1(s,\text{`` wedding''})=.73$.

Episode-by-episode:

| $t$ | Action taken | Advantage          | $\pi_t(\text{wedding})$ | $v_t^\pi(\text{``We had a ''})$ |
| --: | :----------: | :----------------: | :---------------------: | :-----------------------------: |
| 1   | wedding      | (1 - 0) - 0 = 1    | .73                     | 1                               |
| 2   | party        | (.5 - 0) - 1 = -.5 | .82                     | .5                              |
| 3   | party        | (.5 - 0) -.5 = 0   | .82                     | .5                              |
| 4   | wedding      | (1 - 0) - .5 = .5  | .88                     | 1                               |

With probability $1$ as $t\to \infty$, $\pi_t(\text{wedding})\to 1$. You might think this is good, since wedding is in fact "optimal" at that state. This does not seem good. Here are a few kinds of explanations for why:

1. Reward chisels circuits into policy networks. Here, the network can get arbitrarily many policy gradients towards "wedding." Its logits just go up and up and up. Mode collapse.
2. We want the reward to be _feedback_ about what kinds of completions are good (or, more abstractly, about what kinds of computations are good to run inside the network). We want a single situation to provide a _finite amount of updating._
3. The system can get stuck in a local attractor. Imagine that we want the system to talk about parties at Chuck-E-Cheese in particular, and we give the system 2 reward if it says "We had a party at Chuck-E-Cheese." But the system may never get there during training due to exploration issues, which are _exarcerbated by the network getting penalized relative to its on-policy value estimate_ $v_{t-1}(s)$.[^explore]
   [^explore]: In other words, PPO actively updates against actions which aren't known to beat current on-policy value $v^\pi_t(s)$. The process penalizes exploration.

This doesn't seem limited to tabular TD-learning, or PPO in more realistic domains. For example, vanilla policy gradient will also allow a system to extract an unbounded amount of reinforcement from a single kind of event (e.g. "wedding"). Unless specific care is taken, Alex thinks this kind of failure happens by default in policy gradient methods.

### Action-conditioned TD error avoids arbitrarily high logits

Given the original advantage equation:

$$
A^\pi(s, a):=\mathbb{E}_{s^{\prime} \sim T(s,a)}\left[R\left(s, a, s^{\prime}\right)+\gamma v^\pi\left(s^{\prime}\right)\right]-v^\pi(s),
$$

replace the last term's baseline to account for the taken action:

$$
A_*^\pi(s, a):=\mathbb{E}_{s^{\prime} \sim T(s,a)}\left[R\left(s, a, s^{\prime}\right)+\gamma v^\pi(s')\right]-q^\pi(s,a).
$$

We call this "**action-conditioned TD error**" (ACTDE).

ACTDE allows the system to account for its decision to go off-policy by selecting a new action $a$ which isn't the usual recommendation $a' \sim \pi(s)$. Philosophically, Alex wanted to mimic reward prediction error. The network taking a different action is not surprising to the network, so the optimization term should account for the action taken (i.e. by using $q^\pi(s,a)$).

Re-analyzing the situation:

| $t$ | Action  | Action-conditioned TD error | $\pi_t(\text{wedding})$ | $q_{t}^\pi(\text{``We had a''},a)$ |
| --: | :-----: | :-------------------------: | :---------------------: | :--------------------------------: |
| 1   | wedding | (1 - 0) - 0 = 1             | .73                     | wedding: 1, party: 0               |
| 2   | party   | (.5 - 0) - 0 = .5           | .63                     | wedding: 1, party: .5              |
| 3   | party   | (.5 - 0) - .5 = 0           | .63                     | wedding: 1, party: .5              |
| 4   | wedding | (1 - 0) - 1 = 0             | .63                     | wedding: 1, party: .5              |

The policy quickly converges to the softmax logits over the reward for the next completions, where $\frac{e^1}{e^1+e^{.5}}\approx.63$. That is, the learned policy has $R(\text{``party''})=.5$ logits on "party" and $R(\text{``wedding''})=1$ logit on "wedding". **Therefore this process does not converge to the optimal policy, even in the limit of infinite exploration. Correspondingly, there is no mode collapse in this situation.** **Reward logits are "added to" initialization logits** $\pi_0$ **(the prior over what completions to output). RL, in this setting, provides a finite amount of reinforcement for certain kinds of computation/actions.**

Furthermore, self-consistent, Bellman-backed-up Q-functions will have zero advantage and zero updates. Networks aren't penalized for exploring, and there's a precise and finite amount of reinforcement which can occur given current predictions about future value, as represented by $q_t$. And training should be more stable, with fewer fluctuations in advantage with respect to the policy itself.[^3]

### ACTDE doesn't mode-collapse onto wireheading

ACTDE doesn't mode collapse on wireheading, even _given_ that the network tries out wireheading! ([Alex thinks such behavior is unlikely for practical RL algorithms](https://www.lesswrong.com/posts/pdaGN6pQyQarFHXF4/reward-is-not-the-optimization-target).)

Concretely, suppose that reward is 10 if you eat pizza and 100 if you wirehead. You start off with action distribution \{pizza: 1%, wirehead: 99%\}, and we're doing TD-learning in the tabular setup we just described. If so, then the policy gradients upweight wireheading more and more. This can happen until the network puts arbitrarily many logits on the wireheading action. In this situation, under these exploration assumptions and with probability $1$, PPO upweights wireheading and the policy ends up \{pizza: $\epsilon$, wirehead: $1-\epsilon$\}.

However, ACTDE does not lead to arbitrarily many logits on wireheading. Instead, ACTDE leads to the softmax distribution over actions, with the softmax taken over the reward for each action. Thus, the converged policy of tabular ACTDE is about \{pizza: .02%, wirehead: 99.98%\}. That's still mostly wireheading, but there are only boundedly many logits on that action.

## PPO vs ACTDE on the iterated prisoner's dilemma

In this toy experiment, the model plays prisoner's dilemmas against its past self, similar to the idea by [Krueger et al.](https://arxiv.org/abs/2009.09153) The model is [mingpt](https://github.com/karpathy/minGPT) with a vocab size of two: one token for "cooperate", and one for "defect". mingpt has 3 layers and an embedding dimension of 12. The model sees the history of cooperates and defections, and outputs the next action.

We are not training via self play against a copy. Instead the model at time $t$ plays against its action at time $t-1$. Playing with its past self for a sequence of `ccddc` has 4 games: `cc`, `cd`, `dd`, `dc`, with rewards of 0.5 (for `cc`), 2 (for `cd`), -0.74 (for `dd`), and -1.76 (for `dc`).[^4]

| Reward matrix   | Cooperate $(t - 1)$ | Defect $(t-1)$ |
| --------------: | :----------------: | :------------: |
| Cooperate $(t)$ | 0.5                 | -1.76          |
| Defect $(t)$    | 2                   | -0.74          |

Alternating cooperation (`c`) and defection (`d`) is the (bolded) optimal strategy for both start states:

| Action sequence | Sum of discounted <br>reward ($\gamma=.5$) |
| --------------: | :----------------------------------------- |
|       `cccc...` | 1.000                                      |
|       `cddd...` | 1.261                                      |
|   **`cdcd...`** | **1.492**                                  |
|       `dddd...` | -1.477                                     |
|       `dccc...` | −1.261                                     |
|   **`dcdc...`** | **−1.015**                                 |

**What we're testing:** If ACTDE mode collapses when used on function approximators (like mingpt), then the theoretical predictions above are wrong.

### PPO results

PPO immediately learns the alternating strategy:

![](https://assets.turntrout.com/static/images/posts/04e947f8cb9cdf3c07b49cdd3dd5887cf8a8f1ac8c06b9a2.avif)

The softmax probability of strategy $s$ is basically $p(s)=\frac{e^{\text{return}(s)}}{\sum_{s'\in \text{strategies}}e^{\text{return}(s')}}$.[^5] The results look almost identical between runs, with or without whitening the advantages, and if the value head is detached.

### ACTDE results

The model does not collapse onto a pure strategy. Instead, the results are inconsistent across trials. However, ACTDE does reliably:

1. initially alternate with high probability
2. tend to regress towards a uniform (or softmax-return) policy over time,
3. with $\pi(\text{alternating})>\pi(\text{cooperate}),\pi(\text{defect})$.

Here's the first 1K epochs of a training run:

![](https://assets.turntrout.com/static/images/posts/f0dc928ced9395c81ba2adf0930f181b3487d3085188803c.avif)
Figure: Note that we aren't whitening the rewards.

Zooming out to all 10,000 epochs:

![](https://assets.turntrout.com/static/images/posts/be298eeeff0a33e1594280b3f975a2dec834b88ec76167b9.avif)
Figure: Note that we aren't whitening the rewards.

We ran 10 trials and plotted the mean and standard deviation of average returns:

![](https://assets.turntrout.com/static/images/posts/744c10811baadd0742a83f12af3e27a443ccb5081f5556fd.avif)

There seems to be slow convergence.[^6] It could even be converging towards the uniform policy. We lean towards "convergence to uniform" due to evidence from a trial on a different reward matrix:

![](https://assets.turntrout.com/static/images/posts/1549bb3b8f9f5895b1978d5cc5cf25a3e84df4a281286365.avif)

Overall, ACTDE's results are sensitive to variations in the algorithm such as whitening advantages, detaching the value and Q-heads, and using the loss function from PPO or ILQL for the value head.

## Speculation

This method might not work well for e.g. RLHF at scale. Deep RL is notoriously finicky. Furthermore, it would be pretty disappointing if ACTDE generally converges on uniform policies, and that seems like a live possibility given the last graph above.

However, Alex has a few intuitions anyways:

### Mitigating reward misspecification

If the reward is really high in a situation which the policy can easily explore into during training, then that's bad and probably leads to distorted policies.

However, under ACTDE, a single reward event (e.g. hypothetically, a maximal reward whenever "weddings" appears) should have less impact on the trained policy. For example, the Q-function can quickly learn to predict that a given string "I went to the barn" produces high reward, and then there isn't any more barn-related reinforcement.

However, if barn-related generations are strongly rewarded in general, the model might still receive reinforcement for the hard-to-predict and diverse range of barn reward events.

### Reducing mode collapse

In the tabular bandit regime (explored above), ACTDE adds "reward logits" ($e^{R(s,a)}$) onto the initial policy logits ($\log \pi_0(s,a)$). Maybe this is true in general (but probably not). If so, then KL penalties might be less important for keeping the trained policy $\pi$ close to the initial policy $\pi_0$.

Less mode collapse means higher-entropy next-token distributions, which may mean greater variety in the policy's preferences/[shards](https://www.lesswrong.com/posts/iCfdcxiyr2Kj8m8mT/the-shard-theory-of-human-values). That is, it may be rarer for motivational/goal-encoding circuits to be effectively pruned by mode-collapsed RLHF. If a system has more shards, [there's a greater chance that some of the shards care about humans](https://www.lesswrong.com/posts/2NncxDQ3KBDCxiJiP/cosmopolitan-values-don-t-come-free?commentId=ofPTrG6wsq7CxuTXk).

## Summary

ACTDE seems to avoid mode collapse in simple tabular setups. We showed that ACTDE doesn't mode collapse on a toy prisoner's dilemma learning task, but instead trains a mixed strategy.

We'd be interested in the results of using RLHF on a language model using ACTDE. Email Michael at [`einhorn.michael1@gmail.com`](mailto:einhorn.michael1@gmail.com) for any questions about the code.

**Contributions:**

- Alex came up with the modified advantage equation, illustrated with toy examples, and wrote most of this post.[^7]
- Michael implemented and tested PPO, and ACTDE on both prisoner's dilemmas and text adventure games. Code is available at [`trl_textworld`.](https://github.com/MichaelEinhorn/trl-textworld)[^8]

> [!thanks]
> Thanks to Connor Leahy, Evan Hubinger, Ulisse Mini, Nate Soares, Leo Gao, Garrett Baker, janus, David Krueger and others for thoughts and discussions.

## Appendix: Random notes

1. The learning rate on $q^\pi$ should control the total amount of reinforcement from a single reward source.
2. The at-convergence learned policy will, in our tabular setting, be invariant to constant shifts of the reward function and, when $\gamma=1$, to constant shifts of $q^\pi$'s initialization.
   1. However, perhaps decreasing rewards everywhere encourages exploration and increasing rewards encourages temporary mode collapse?
   2. Multiplying all rewards by a positive scalar $c>0$ will extremize the policy probabilities in a rather simple way, by taking them to the $c$<sup>th</sup> power and then renormalizing. This is equivalent to a change in temperature for the softmax distribution.

### Reward matrix construction

1. The always-defect strategy is myopic, and the always-cooperate strategy is non-myopic.
2. The payoff matrix for the prisoner's dilemma was selected to have 0 sum, and to have equal discounted returns for all cooperate and all defect at a mean discount rate of 0.5. For example, the discount rate for equal discounted returns is 0.4523 starting from defect and 0.5477 starting from coop with a mean of 0.5.
3. It turns out that it is possible to construct a matrix where it is better to always defect when starting from a cooperate, and vice versa, leading to a third strategy of alternating cooperate and defect being optimal. This may represent a more complex optimal strategy compared to a good simple strategy.  See [variations of the matrix](https://www.desmos.com/calculator/snt6bxoqis).

[^1]: This advantage equation, as given, can also be called the "TD error."
[^2]: Alex thinks that using a fixed learning rate $0<\alpha<1$ shouldn't fix PPO's "infinite logit update issue", but a decaying learning rate schedule probably does. This isn't that surprising, and he doesn't think it fixes the deeper potential issue with fluctuating value baselines.
[^3]: Although Alex hasn't analyzed the sequential tabular setting — possibly infinite logit updating can still happen there?
[^4]: Note that the `cd` and `dc` always come in pairs except for at most 1 extra.
[^5]: $\text{return}(s)$ averages strategy $s$'s return over the first state being cooperate `c` and being defect `d`.
[^6]: In the tabular bandit example above, the convergence was extremely fast due to the learning rate and triviality of the problem.
[^7]: When Alex wrote this in the fall, he thought that RLHF was responsible for mode collapse behaviors in LMs. However, [empirical evidence has since made him think that RLHF is less responsible for these failures](https://www.lesswrong.com/posts/t9svvNPNmFf5Qa3TA/mysteries-of-mode-collapse). He thinks his theoretical analysis is still correct under the assumptions he made, and he still thinks it's important to investigate empirically.
[^8]: One of the goals of [`trl-textworld`](https://github.com/MichaelEinhorn/trl-textworld.git) was to evaluate PPO vs ACTDE finetunings on pretrained language models, but the models were not able to learn to play the text adventure, so this project did not get to a point where the algorithm's results could be compared. The implementation may still be useful—it has been tested up to GPT-NeoX 20B on 8 GPUs.
