---
permalink: reward-is-not-the-optimization-target
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/pdaGN6pQyQarFHXF4/reward-is-not-the-optimization-target
lw-is-question: "false"
lw-posted-at: 2022-07-25T00:03:18.307000Z
lw-last-modification: 2024-03-02T01:19:02.501000Z
lw-curation-date: None
lw-frontpage-date: 2022-07-25T04:20:53.020000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 123
lw-base-score: 369
lw-vote-count: 202
af-base-score: 94
af-num-comments-on-upload: 88
title: Reward is not the optimization target
lw-latest-edit: 2023-09-18T16:54:05.492000Z
lw-is-linkpost: "false"
tags:
  - AI
  - reinforcement-learning
  - shard-theory
aliases:
  - reward-is-not-the-optimization-target
sequence-link: posts#shard-theory
lw-sequence-title: Shard Theory
prev-post-slug: general-alignment-properties
prev-post-title: General Alignment Properties
next-post-slug: shard-theory
next-post-title: The Shard Theory of Human Values
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2022-07-25 00:00:00
original_url: https://www.lesswrong.com/posts/pdaGN6pQyQarFHXF4/reward-is-not-the-optimization-target
skip_import: "true"
description: "RL doesn't train reward optimizers. Reward chisels cognition into agents. Worry less about safe objectives, more about good cognition."
date_updated: 2025-12-18 09:42:00.251916
createBibtex: true
---






In this essay, I call an agent a “reward optimizer” if it not only gets lots of reward, but if it reliably makes choices like “reward but no task completion” (e.g. receiving reward without eating pizza) over “task completion but no reward” (e.g. eating pizza without receiving reward). Under this definition, an agent can be a reward optimizer even if it doesn't contain an explicit representation of reward, or implement a search process for reward.

> [!quote]  [Reinforcement learning: An introduction](http://www.incompleteideas.net/sutton/book/first/Chap1PrePub.pdf)
> Reinforcement learning is learning what to do—how to map situations to actions **so as to maximize a numerical reward signal**.

Many people[^1] seem to expect that reward will be the optimization target of really smart learned policies—that these policies will be reward optimizers. I strongly disagree. As I argue in this essay, reward is _not_, in general, that-which-is-optimized by RL agents.[^2]  

Separately, as far as I can tell, most[^3] practitioners usually view reward as encoding the relative utilities of states and actions (e.g. it’s _this good_ to have all the trash put away), as opposed to imposing a _reinforcement schedule_ which builds certain computational edifices inside the model (e.g. reward for picking up trash → reinforce trash-recognition and trash-seeking and trash-putting-away subroutines). I think the former view is usually inappropriate, because in many setups, **reward** _**chisels cognitive grooves into an agent**_**.**

Therefore, _reward is not the optimization target_ in two senses:

1. Deep reinforcement learning agents will not come to intrinsically and primarily value their reward signal; reward is not _the trained agent’s_ optimization target.
2. Utility functions express the _relative goodness_ of outcomes. Reward _is not best understood_ as being a kind of utility function. Reward has the mechanistic effect of _chiseling cognition into the agent's network_. Therefore, properly understood, reward does not express relative goodness and _does not automatically describe the values of the trained AI_.

> [!thanks]
>This insight was made possible by many conversations with Quintin Pope, where he challenged my implicit assumptions about alignment. I’m not sure who came up with this particular idea.

ETA 9/18/23: This post addresses the model-free policy gradient setting, including algorithms like PPO and REINFORCE.

# Reward probably won’t be a deep RL agent’s primary optimization target

Subtitle: Focusing on model-free[^model-free] policy gradient algorithms like PPO and REINFORCE.

[^model-free]: I expect I'd draw similar conclusions about model-based algorithms. AIXI would likely optimize reward. I do not expect reward optimization from MCTS on a neural network leaf node evaluation function. Probably the key factor is: what fraction of computation comes from runtime search?

After work, you grab pizza with your friends. You eat a bite. The taste releases [reward in your brain](https://en.wikipedia.org/wiki/Reward_system), which triggers credit assignment. Credit assignment identifies which thoughts and decisions were responsible for the release of that reward, and makes those decisions more likely to happen in similar situations in the future. Perhaps you had thoughts like:

- "It'll be fun to hang out with my friends" and
- "The pizza shop is nearby" and
- "Since I just ordered food at a cash register, execute `motor-subroutine-#51241` to take out my wallet" and
- "If the pizza is in front of me and it's mine and I'm hungry, raise the slice to my mouth" and
- "If the slice is near my mouth and I'm not already chewing, take a bite."

Many of these thoughts will be judged responsible by credit assignment, and thereby become more likely to trigger in the future. This process is what _reinforcement_ learning is all about—the reward is the _reinforcer_ of those things which came before it and the _creator_ of new lines of cognition entirely (e.g. anglicized as "I shouldn't buy pizza when I'm mostly full"). The reward chisels cognition which increases the probability of the reward accruing next time.

Importantly, reward does not automatically spawn thoughts _about_ reward, and reinforce those reward-focused thoughts! Just because common English endows “reward” with suggestive pleasurable connotations, that [does not mean that](https://www.readthesequences.com/No-Universally-Compelling-Arguments) an RL agent will _terminally value_ reward!

What kinds of people (or non-tabular agents more generally) will become reward optimizers, such that the agent ends up terminally caring about reward (and little else)? Reconsider the pizza situation, but instead suppose you were thinking thoughts like “this pizza is going to be so rewarding” and “in this situation, eating pizza sure will activate my reward circuitry.”

You eat the pizza, triggering reward, triggering credit assignment, which correctly locates these reward-focused thoughts as contributing to the release of reward. Therefore, in the future, you will more often take actions because you think they will produce reward, and so you will become more of the kind of person who intrinsically cares about reward. These updates will eventually lead[^4] towards reward-optimization and wireheading.

While it's possible to have activations on "pizza consumption predicted to be rewarding" and "execute `motor-subroutine-#51241`" and then have credit assignment hook these up into a new motivational circuit, **this is only** _**one possible direction**_ **of value formation in the agent**. Seemingly, the most direct way for an agent to become _more_ of a reward optimizer is to _already_ make decisions motivated by reward, and then have credit assignment further generalize that decision-making.

## The siren-like suggestiveness of the word “reward”

Let’s strip away the suggestive word “reward”, and replace it by its substance: cognition-updater.

Suppose a human trains an RL agent by pressing the cognition-updater button when the agent puts trash in a trash can. While putting trash away, the AI’s policy network is probably “thinking about”[^5] the _actual world it’s interacting with_, and so the cognition-updater reinforces those heuristics which lead to the trash getting put away (e.g. “if trash-classifier activates near center-of-visual-field, then grab trash using `motor-subroutine-#642`”).

Then suppose this AI models the true fact that the button-pressing produces the cognition-updater. Suppose this AI, which has historically had its trash-related thoughts reinforced, considers the plan of pressing this button. “If I press the button, that triggers credit assignment, which will reinforce my decision to press the button, such that in the future I will press the button even more.”

Why, exactly, would the AI seize[^6] the button? To reinforce itself into a certain corner of its policy space? The AI has not had antecedent-computation-reinforcer-thoughts reinforced in the past, and so its current decision will not be made in order to acquire the cognition-updater!

RL is not, in general, about training cognition-updater optimizers.

## When _is_ reward the optimization target of the agent?

If reward is guaranteed to become your optimization target, then your learning algorithm can force you to become a drug addict. Let me explain.

[Convergence theorems](https://nlp.chonbuk.ac.kr/AML/slides_lille/Lecture4-b.pdf) provide conditions under which a reinforcement learning algorithm is guaranteed to converge to an optimal policy for a reward function. For example, value iteration maintains a table of value estimates for each state _s_, and iteratively propagates information about that value to the neighbors of _s_. If a far-away state _f_ has huge reward, then that reward ripples back through the environmental dynamics via this [“backup” operation](https://inst.eecs.berkeley.edu/~cs294-40/fa08/scribes/lecture2.pdf). Nearby parents of _f_ gain value, and then after lots of backups, far-away ancestor-states gain value due to _f_’s high reward.

Eventually, the “value ripples” settle down. The agent picks an (optimal) policy by acting to maximize the value-estimates for its post-action states.

Suppose it would be extremely rewarding to do drugs, but those drugs are on the other side of the world. Value iteration backs up that high value to your present space-time location, such that your policy necessarily gets _at least_ that much reward. There’s no escaping it: After enough backup steps, you’re traveling across the world to do cocaine.

Obviously, these conditions aren’t true in the real world. Your learning algorithm doesn’t force _you_ to try drugs. Any AI which e.g. tried every action at least once would quickly kill itself, and so real-world general RL agents won’t explore like that because that would be stupid. So the RL agent’s algorithm won’t make it e.g. explore wireheading either, and so the convergence theorems _don’t apply even a little—even in spirit_.

## Anticipated questions

Why won’t early-stage agents think thoughts like “If putting trash away will lead to reward, then execute `motor-subroutine-#642`”, and then this gets reinforced into reward-focused cognition early on?
: Suppose the agent puts away trash in a blue room. Why won’t early-stage agents think thoughts like “If putting trash away will lead to the wall being blue, then execute `motor-subroutine-#642`”, and then this gets reinforced into blue-wall-focused cognition early on? [Why consider either scenario to begin with](https://www.readthesequences.com/Privileging-The-Hypothesis)?

  At least, that's the reply I gave in 2022. In 2025, I realize that I [didn't understand that LLM pretraining _would_ allow such thoughts in early-stage RL](/reward-hacking-doesnt-show-reward-is-optimization-target). _RLHF may well reinforce such thoughts!_ That said, the question still comes down to empirics.

Aren’t we implicitly selecting for agents with high cumulative reward, when we train those agents?
: Yeah. But on its own, this argument can’t possibly imply that selected agents will probably be reward optimizers. The argument would [prove too much](https://slatestarcodex.com/2013/04/13/proving-too-much/). Evolution selected for inclusive genetic fitness, and it [did not get IGF optimizers](https://www.lesswrong.com/posts/XPErvb8m9FapXCjhA/adaptation-executers-not-fitness-maximizers).

  "We're selecting for agents on reward $\rightarrow$  we get an agent which optimizes reward" is locally invalid. "We select for agents on X $\rightarrow$ we get an agent which optimizes X" is not true for the case of evolution, and so is not true in general. Therefore, the argument isn't necessarily true in the AI reward-selection case. Even if RL _did_ happen to train reward optimizers and this post _were_ wrong, the selection argument is too weak on its own to establish that conclusion.

  Here’s a more concrete response: Selection isn’t _just_ for policies which score highly on the reward. For simplicity, consider the case where on the training distribution, the agent gets reward if and only if it reaches a goal state. Then any selection for reward is also selection for reaching the goal. And if the goal is the only red object, then selection for reward is _also_ selection for reaching red objects.

  In general, selection for reward produces equally strong selection for reward’s necessary and sufficient conditions. In general, it seems like there should be a lot of those. Therefore, since selection is not only for _reward_ but for _anything which goes along with reward_ (e.g. reaching the goal), then selection won’t advantage _reward optimizers_ over _agents which reach goals quickly / pick up lots of trash / \[do the objective\]_.  

  Another reason to not expect the selection argument to work is that it’s _convergently instrumental_ for most inner agent values to _not_ become wireheaders, for them to _not_ try hitting the reward button. I think that before the agent can hit the particular attractor of reward-optimization, it will hit an attractor in which it optimizes for some aspect of a historical correlate of reward.

  We train agents which intelligently optimize for e.g. putting trash away, and this reinforces the trash-putting-away computations, which activate in a broad range of situations so as to steer agents into a future where trash has been put away. An intelligent agent will model the true fact that, if the agent reinforces itself into caring about cognition-updating, then it will no longer navigate to futures where trash is put away. Therefore, it decides to not hit the reward button. This reasoning follows for most inner goals by instrumental convergence.

  On my current best model, this is why people usually don’t wirehead. They learn their own values via deep RL, like caring about dogs, and these actual values are opposed to the person they would become if they wirehead.

Don’t some people terminally care about reward?
: I think so! I think that generally intelligent RL agents will have _secondary, relatively weaker_ values around reward, but that reward will not be a primary motivator. Under my current (weakly held) model, an AI will only start chiseled computations about reward _after_ it has chiseled other kinds of computations (e.g. putting away trash).

What if the AI bops the reward button early in training, while exploring? Then credit assignment would make the AI more likely to hit the button again.
: Then keep the button away from the AI until it can model the effects of hitting the cognition-updater button.[^7]

  For the reasons given in the “siren” section, a sufficiently reflective AI probably won’t seek the reward button on its own.

AIXI—
: will always kill you and then wirehead forever, unless you gave it something like a constant reward function.

  And, IMO, this fact is not practically relevant to alignment. AIXI is _explicitly a reward-maximizer_. As far as I know, AIXI(-_tl_) is not the limiting form of any kind of real-world intelligence trained via _reinforcement_ learning.

Does the choice of RL algorithm matter?
: For point 1 (_reward is not the trained agent's optimization target_), it might matter. I started off analyzing model-free actor-based approaches, but have also considered a few model-based setups. I think the key lessons apply to the general case, but I think the setup will substantially affect which values tend to be grown.

  If the agent's curriculum is broad, then reward-based cognition may get reinforced from a confluence of tasks (solve mazes, write sonnets), while each task-specific cognitive structure is only narrowly contextually reinforced. That said, this is also selecting equally hard for agents which do the rewarded activities, and reward-motivation is only one possible value which produces those decisions.

  Pretraining a language model and then slotting that into an RL setup also changes the initial computations in a way which I have not yet tried to analyze. Further, it’s _possible_ there’s some kind of RL algorithm which _does_ train agents which limit to reward optimization (and, of course, thereby “solves” inner alignment in its literal form of “find a policy which optimizes the outer objective signal”).

  For point 2 (_reward provides local updates to the agent's cognition via credit assignment; reward is not best understood as specifying our preferences_), the choice of RL algorithm should not matter, as long as it uses reward to compute local updates. A similar lesson applies to the updates provided by loss signals. A [loss signal provides updates which deform the agent's cognition into a new shape.](/four-usages-of-loss-in-ai)

`TurnTrout`, you've been talking about an AI's learning process using English, but ML gradients may not neatly be expressible in our concepts. How do we know that it's appropriate to speculate in English?
: I am _not_ _certain_ that my model is legit, but it sure seems more legit than (my perception of) how people usually think about RL (i.e. in terms of reward maximization, and reward-as-optimization-target instead of as feedback signal which builds cognitive structures).

  I only have access to my own concepts and words, so I am provisionally reasoning ahead anyways, while keeping in mind the potential treacheries of anglicizing imaginary gradient updates (e.g. "be more likely to eat pizza in similar situations").

# Dropping the old hypothesis

At this point, I don't see a strong reason to focus on the “reward optimizer” hypothesis. The idea that AIs will get really smart and primarily optimize some reward signal… I don’t know of any tight mechanistic stories for that. I’d love to hear some, if there are any.

As far as I’m aware, the strongest evidence left for agents intrinsically valuing cognition-updating is that some humans _do_ strongly (but not uniquely) value cognition-updating,[^8] and many humans seem to value it weakly, and humans are probably RL agents in the appropriate ways. So we definitely can’t _rule out_ agents which strongly (and not just weakly) value the cognition-updater. But it’s also _not_ the overdetermined default outcome.

It’s true that reward _can_ be an agent’s optimization target, but what reward _actually does_ is reinforce computations which lead to it. A particular alignment proposal might argue that a reward function will _reinforce the agent into a shape such that it intrinsically values reinforcement_, and that the _cognition-updater goal is also a human-aligned optimization target_, but this is still just one particular approach of using the cognition-updating to produce desirable cognition within an agent. Even in that proposal, the primary mechanistic function of reward is reinforcement, not optimization-target.

## Implications

Here are some major updates which I made.

> [!warning]
> **Any reasoning derived from the reward-optimization premise is now suspect until otherwise supported.**

> [!idea] Insight
> **Wireheading was never a high-probability problem for RL-**_**trained**_ **agents**, absent a specific story for why cognition-updater-acquiring thoughts would be chiseled into primary decision factors.

> [!success] Stop focusing on objectives which are “safe to maximize”
>
> **Stop worrying about finding “outer objectives” which are safe to** _**maximize.**_[^9] I think that you’re not going to get an outer objective maximizer (i.e. an agent which maximizes the explicitly specified reward function). Instead, focus on building good cognition within the agent. The way I see it, there's only one question: How do we grow good cognition inside of the trained agent?

I also suggest that you **mechanistically model RL agents as executing behaviors downstream of past reinforcement** (e.g. putting trash away), in addition to thinking about policies which are selected for having high reward on the training distribution (e.g. hitting the button). The latter form of reasoning skips past the mechanistic substance of reinforcement learning: The chiseling of computations responsible for the acquisition of the cognition-updater. I still think it's useful to consider selection, but mostly in order to generate failures modes whose mechanistic plausibility can be evaluated.

In my view, reward's proper role isn't to encode an objective, but a _reinforcement schedule_, such that the right kinds of computations get reinforced within the AI's mind.

_Edit 11/15/22_: The original version of this post talked about how, in policy gradient approaches, reward reinforces _antecedent computations_. However, reward's role is _not_ generally limited to merely reinforcing existing computations. I edited the post to instead talk about how reward is used to upweight certain kinds of actions in certain kinds of situations, and therefore reward _chisels cognitive grooves into agents_.

# Appendix: The field of RL thinks reward is the optimization target

Let’s take a little stroll through [Google Scholar’s top results for “reinforcement learning"](https://scholar.google.com/scholar?hl=en&as_sd\$t=7\$,39&q=reinforcement+learning), emphasis added:

> [!quote] [Reinforcement learning: A survey](https://www.jair.org/index.php/jair/article/download/10166/24110/)
>
> The agent's job is to find a policy… that **maximizes some long-run measure of reinforcement**.
>

> [!quote] [Reinforcement learning: The Good, The Bad and The Ugly](https://www.princeton.edu/~yael/Publications/DayanNiv2008.pdf)
> In instrumental conditioning, animals learn to choose actions to obtain rewards and avoid punishments, or, more generally to achieve goals. **Various goals are possible, such as optimizing the average rate of acquisition of net rewards (i.e. rewards minus punishments), or some proxy for this such as the expected sum of future rewards**.

Steve Byrnes did, in fact, briefly point out part of the “reward is the optimization target” mistake:

> [!quote] [Model-based RL, Desires, Brains, Wireheading](https://www.alignmentforum.org/posts/K5ikTdaNymfWXQHFb/model-based-rl-desires-brains-wireheading#Self_aware_desires_1__wireheading)
> I note that even experts sometimes sloppily talk as if RL agents make plans towards the goal of maximizing future reward…

I don't think it's just sloppy talk, I think it's incorrect belief in many cases. I mean, I did my PhD on RL theory, and I still believed it. Many authorities and textbooks confidently claim—presenting little to no evidence—that reward is an optimization target (i.e. the quantity which the policy is in fact trying to optimize, or the quantity to be optimized by the policy). [Check what the math actually says](/alignment-phd).

[^1]: [Including](https://www.sciencedirect.com/science/article/pii/S0004370221000862#fn0020) the authors of the quoted introductory text, [Reinforcement learning: An introduction](http://www.incompleteideas.net/sutton/book/first/Chap1PrePub.pdf). I have, however, met several alignment researchers who already internalized that reward is not the optimization target, perhaps not in so many words.

[^2]: [Utility ≠ Reward](https://www.alignmentforum.org/posts/bG4PR9uSsZqHg2gYY/utility-reward) points out that an RL-trained agent is _optimized by_ original reward, but not necessarily _optimizing for_ the original reward. This essay goes further in several ways, including when it argues that _reward_ and _utility_ have different type signatures—that reward shouldn’t be viewed as encoding a goal at all, but rather a _reinforcement schedule_. And not only do I not expect the trained agents to maximize the original “outer” reward signal, I think they probably won’t try to strongly optimize [_any_ reward signal](https://www.alignmentforum.org/posts/3RdvPS5LawYxLuHLH/hackable-rewards-as-a-safety-valve?commentId=crkrEjpyjB7N9t5jo).

[^3]: [Reward shaping](http://ai.stanford.edu/~ang/papers/shaping-icml99.pdf) seems like the most prominent counterexample to the “reward represents terminal preferences over state-action pairs” line of thinking.

[^4]: But also, you were still probably thinking about reality as you interacted with it (“since I’m in front of the shop where I want to buy food, go inside”), and credit assignment will still locate some of those thoughts as relevant, and so you wouldn’t purely reinforce the reward-focused computations.

[^5]: "Reward reinforces existing thoughts" is ultimately a claim about how updates depend on the existing weights of the network. I think that it's easier to update cognition along the lines of existing abstractions and lines of reasoning. If you're already running away from wolves, then if you see a bear and become afraid, you can be updated to run away from large furry animals. This would leverage your _existing_ concepts.

    > [!quote]  [A shot at the diamond-alignment problem](/a-shot-at-the-diamond-alignment-problem)
    >
    > The local mapping from gradient directions to behaviors is given by the neural tangent kernel, and the learnability of different behaviors is given by the NTK’s eigenspectrum, which [seems to adapt to the task at hand](https://arxiv.org/abs/2008.00938), making the network quicker to learn along behavioral dimensions similar to those it has already acquired.

[^6]: Quintin Pope remarks: “The AI would probably want to establish **control** over the button, if only to ensure its values aren't updated in a way it wouldn't endorse. Though that's an example of convergent power-seeking, not reward seeking.”

[^7]: For mechanistically similar reasons, keep cocaine out of the crib until your children can model the consequences of addiction.

[^8]: I am presently ignorant of [the relationship between pleasure and reward prediction error in the brain](https://pubmed.ncbi.nlm.nih.gov/35156187/). I do not think they are the same.

    However, I think people are usually weakly hedonically / experientially motivated. Consider a person about to eat pizza. If you give them the choice between "pizza but no pleasure from eating it" and "pleasure but no pizza", I think most people would choose the latter (unless they were really hungry and needed the calories). If people just navigated to futures where they had eaten pizza, that would not be true.

[^9]: From correspondence with another researcher: There may yet be an interesting alignment-related puzzle to "Find an optimization process whose maxima are friendly", but I personally don't share the intuition yet.
