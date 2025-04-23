---
permalink: RL-trains-policies-not-agents
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/rmfjo4Wmtgq8qa2B7/think-carefully-before-calling-rl-policies-agents
lw-is-question: 'false'
lw-posted-at: 2023-06-02T03:46:07.467000Z
lw-last-modification: 2024-03-27T15:51:32.355000Z
lw-curation-date: None
lw-frontpage-date: 2023-06-02T17:39:21.801000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 36
lw-base-score: 133
lw-vote-count: 67
af-base-score: 50
af-num-comments-on-upload: 9
publish: true
title: Think carefully before calling RL policies  'agents'
lw-latest-edit: 2024-03-27T15:51:32.955000Z
lw-is-linkpost: 'false'
tags:
  - AI
  - reinforcement-learning
aliases:
  - think-carefully-before-calling-rl-policies-agents
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2023-06-02 00:00:00
original_url: https://www.lesswrong.com/posts/rmfjo4Wmtgq8qa2B7/think-carefully-before-calling-rl-policies-agents
skip_import: true
description: RL researchers call trained policies "agents", biasing how we think about
  their behavior. I advocate for using the term "policy" instead.
date_updated: 2025-01-30 09:30:36.233182
---





I think agentic systems represent most of AI extinction risk. I want to think clearly about what training procedures produce agentic systems. Unfortunately, the field of reinforcement learning has a convention of calling its trained artifacts "agents." This terminology is loaded and inappropriate for my purposes. I advocate instead calling the trained system a "policy." This name is standard, accurate, and neutral.

# Don't assume the conclusion by calling a policy an "agent"

The real-world systems we want to think about and align are large neural networks like GPT-4. These networks are trained and finetuned via different kinds of self-supervised and reinforcement learning.

When a policy network is updated using a learning process, its parameters are changed via weight updates. Eventually, the process ends (assuming no online learning for simplicity). We are then left with a _policy network_ (e.g. GPT-4). To actually use the network, we need to use some _sampling procedure_ on its logits (e.g. nucleus sampling). Once we fix the _policy network_ and _sampling procedure_, we get a mapping from observations (e.g. sequences of embeddings, like those for [`I`,  `love`,  `dogs`]) to probability distributions over outputs (e.g. tokens). This mapping $\pi$ is the _policy_.

I want to carefully consider whether a trained policy will exhibit agentic cognition of various forms, including planning, goal-directedness, and situational awareness. While considering this question, _we should not start calling the trained policy an "agent"! That's like a detective randomly calling one of the suspects "criminal."_ I prefer just calling the trained artifact a "policy." This neutrally describes the artifact's function, without connoting agentic or dangerous cognition.

Of course, a policy could in fact be computed using internal planning (e.g. depth-3 heuristic search) to achieve an internally represented goal (e.g. number of diamonds predicted to be present). I think it's appropriate to call that kind of computation "agentic." But that designation is only appropriate after further information is discovered (e.g. how the policy in fact works).

# There's no deep reason why trained policies are called "agents"

Throughout [my PhD in RL theory](https://turntrout.com/alignment-phd), I accepted the idea that RL tends to create agents, and supervised learning doesn't. [Well-cited](https://arxiv.org/pdf/1312.5602.pdf) [papers](https://arxiv.org/abs/1912.06680) use the term "agents", as do textbooks and [Wikipedia](https://en.wikipedia.org/wiki/Reinforcement_learning). I also hadn't seen anyone give the pushback I give in this post.

> [!question]
> Given a fixed architecture (e.g. a 48-layer decoder-only transformer), what kinds of learning processes are more likely to train policy networks which use internal planning?

If you're like I was in early 2022, you might answer "RL trains agents." _But why? In what ways do PPO's weight updates tend to accumulate into agentic circuitry, while unsupervised pretraining on OpenWebText does not?_

> [!claim]
> People are tempted to answer "RL" because the field adopted the "agent" terminology for reasons _unrelated to the above question_. Everyone keeps using the loaded terminology because no one questions it.

Let's be clear. RL researchers _did not_ deliberate carefully about the inductive biases of deep learning, and then decide that a certain family of algorithms was especially likely to train agentic cognition. Researchers called policies "agents" as early as 1995, _before_ the era of deep learning (e.g. see [AI: A modern approach, 1st edition](https://en.wikipedia.org/wiki/Artificial_Intelligence:_A_Modern_Approach)).

# Does RL actually produce agents?

Just because "agents" was chosen for reasons unrelated to agentic cognition, [doesn't mean the name is inappropriate](https://www.lesswrong.com/posts/qNZM3EGoE5ZeMdCRt/reversed-stupidity-is-not-intelligence). I can think of a few pieces of evidence for RL entraining agentic cognition.

1. RL methods are often used to train networks on tasks like video games and robotics. These methods are used because they work, and these tasks seem to have an "autonomous" and "action-directed" nature. This is weak evidence of RL being appropriate for producing agentic cognition. Not strong evidence.
2. RL allows reinforcing behavior[^1]  which we couldn't have demonstrated ourselves. For example, [actuating a simulated robot to perform a backflip.](https://arxiv.org/abs/1706.03741) If we _could_ do this ourselves and had the time to spare, we could have just provided supervised feedback. But this seems just like a question of providing training signal in more situations. Not strong evidence.
3. Many practical RL algorithms are on-policy, in that the policy's current behavior affects its future training data. This may lead to policies which "chain into themselves over time." This seems related to "nonmyopic training objectives." I have more thoughts here, but they're still vague and heuristic. Not strong evidence.
4. There's some empirical evidence from [Discovering Language Model Behaviors with Model-Written Evaluations](https://www.lesswrong.com/posts/yRAo2KEGWenKYZG9K/discovering-language-model-behaviors-with-model-written), which I've only skimmed. They claim to present evidence that RLHF increases e.g. power-seeking. I might end up finding this persuasive.
5. There's [good evidence](https://www.lesswrong.com/posts/iCfdcxiyr2Kj8m8mT/the-shard-theory-of-human-values#A_3_Evidence_for_neuroscience_assumptions) that humans and other animals do something akin to RL. For example, something like TD learning [may be present in the brain](https://en.wikipedia.org/wiki/Temporal_difference_learning#In_neuroscience). Since some humans are agentic sometimes, and my guess is that RL is one of the main learning processes in the brain, this is some evidence for RL producing agentic cognition.

Overall, I do lean towards "RL is a way of tying together pretrained cognition into agentic goal pursuit." I don't think this conclusion is slam-dunk or automatic, and don't currently think RL is much more dangerous than other ways of computing weight updates. I'm still trying to roll back the invalid updates I made due to the RL field's inappropriate "agents" terminology. (My current guesses here should be taken _strictly separately_ from the main point of the post.)

# Conclusions

1. Use neutral, non-loaded terminology like "policy" instead of "agent", unless you have specific reason to think the policy is agentic.
   - Yes, it'll be hard to kick the habit. I've been working on it for about a month.
   - Don't wait for everyone to coordinate on saying "policy." You can switch to "policy" right now and thereby improve your private thoughts about alignment, _whether or not anyone else gets on board._ I've enjoyed these benefits for a month. The switch didn't cause communication difficulties.
2. Strongly downweight the memes around RL "creating agents."
   - "RLHF boosts agentic cognition" seems like a contingent empirical fact, and not trivially deducible from "PPO is an RL algorithm." Even if RLHF in fact boosts agentic cognition, you've probably over-updated towards this conclusion due to loaded terminology.
   - However, only using unsupervised pretraining doesn't mean you're safe. That is, base GPT-5 can totally seek power, whether or not some human researchers in the 1970s decided to call their trained artifacts "agents" or not.

> [!thanks]
> Thanks to Aryan Bhatt for clarifying the distinction between policies and policy networks.

# Appendix: Other bad RL terminology

## ~~"Reward"~~ → "Reinforcement"

"Reward" has absurd and inappropriate pleasurable connotations which suggest that the ~~agent~~ policy will seek out this "rewarding" quantity.

I prefer "reinforcement" because it's more accurate (at least for the policy gradient algorithms I care about) and is overall a neutral word. The cost is that "reinforcement function" is somewhat nonstandard, requiring extra explanation. I think this is often worth it in personal and blog-post communication, and maybe even in conference papers.

## ~~"Optimal policy"~~ → "Reinforcement-maximizing policy"

Saying "optimal" makes the policy sound _good_ and _smart_, and suggests that the reinforcement function is something which should be _optimized over_. As I discussed [in a recent comment](https://www.lesswrong.com/posts/fLpuusx9wQyyEBtkJ/power-seeking-can-be-probable-and-predictive-for-trained?commentId=ndmFcktFiGRLkRMBW), I think that's muddying and misleading. In my internal language, "optimal policy" translates to "reinforcement-maximizing policy." I will probably adopt this for some communication.

[^1]: Technically, we aren't just reinforcing behavior. A policy gradient will upweight certain logits in certain situations. This parameter update generally affects the generalization properties of the network in all situations.
