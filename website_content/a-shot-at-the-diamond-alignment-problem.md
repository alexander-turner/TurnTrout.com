---
permalink: a-shot-at-the-diamond-alignment-problem
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/k4AQqboXz8iE5TNXK/a-shot-at-the-diamond-alignment-problem
lw-is-question: 'false'
lw-posted-at: 2022-10-06T18:29:10.586000Z
lw-last-modification: 2023-06-01T20:06:10.512000Z
lw-curation-date: None
lw-frontpage-date: 2022-10-06T21:08:16.652000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 58
lw-base-score: 95
lw-vote-count: 46
af-base-score: 36
af-num-comments-on-upload: 45
title: A shot at the diamond-alignment problem
lw-latest-edit: 2023-02-01T19:19:45.945000Z
lw-is-linkpost: 'false'
tags:
  - AI
  - shard-theory
aliases:
  - a-shot-at-the-diamond-alignment-problem
sequence-link: posts#shard-theory
lw-sequence-title: Shard Theory
prev-post-slug: understanding-and-avoiding-value-drift
prev-post-title: Understanding and Avoiding Value Drift
next-post-slug: dont-design-agents-which-exploit-adversarial-inputs
next-post-title: Don’t Design Agents Which Exploit Adversarial Inputs
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2022-10-06 00:00:00
original_url: 
  https://www.lesswrong.com/posts/k4AQqboXz8iE5TNXK/a-shot-at-the-diamond-alignment-problem
skip_import: true
description: "A technical deep dive exploring how to align an AI with the goal of
  creating diamonds, rather than more nebulous human values. "
date_updated: 2025-06-03 22:57:00.423836
---










I think that relatively simple alignment techniques can go a long way. In particular, I want to tell a plausible-to-me story about how simple techniques can align a proto-AGI so that it makes lots of diamonds.

Why is it interesting to get an AI which makes lots of diamonds? Because we avoid the complexity of human value and thinking about what kind of future we want, while still testing our ability to align an AI. Since diamond-production is our goal for training, it’s actually okay (in this story) if the AI kills everyone. The real goal is to ensure the AI ends up acquiring and producing lots of diamonds, instead of just optimizing some weird proxies that didn’t have anything to do with diamonds. It’s also OK if the AI doesn’t [_maximize_ diamonds](https://arbital.com/p/diamond_maximizer/), and instead just makes a whole lot of diamonds.[^1]

Someone recently commented that I seem much more _specifically_ critical of outer and inner alignment, than I am _specifically_ considering alternatives. So, I had fun writing up a specific training story for how I think we can just solve diamond-alignment using extremely boring, non-exotic, simple techniques, like “basic reward signals & reward-data augmentation.” Yes, that’s right. [As I’ve hinted previously](/questioning-why-simple-alignment-plan-fails), I think many arguments against this working are wrong, but I’m going to lay out a positive story in this post. I’ll reserve my arguments against certain ideas for future posts.

Can we tell a plausible story in which we train an AI, it cares about diamonds when it’s stupid, it gets smart, and still cares about diamonds? I think I can tell that story, albeit with real uncertainties which feel more like normal problems (like “ensure a certain abstraction is learned early in training”) than impossible-flavored alignment problems (like “find/train an evaluation procedure which isn’t exploitable by the superintelligence you train”).

> [!warning] Disclaimers
>
> 1. Obviously I’m making up a lot of details, many of which will turn out to be wrong, even if the broad story would work. I think it’s important to make up details to be concrete, highlight the frontiers of my ignorance, and expose new insights. Just remember what I’m doing here: _making up plausible-sounding details_.
> 2. [This story did not actually happen in reality](https://www.lesswrong.com/posts/tcCxPLBrEXdxN5HCQ/shah-and-yudkowsky-on-alignment-failures?commentId=G2LotCb9mHanZStzu). It’s fine, though, to update towards my models if you find them compelling.
> 3. I am not presenting my best guess for how we get AGI. In particular, I think chain of thought / language modeling is more probable than RL, but I’m still more comfortable thinking about RL for the moment, so that’s how I wrote the story.
> 4. The point of the following story is not “Gee, I sure am confident this story goes through roughly like this.” Rather, I am presenting a training story template I expect to work for some foreseeably good design choices. I would be interested and surprised to learn that this story template is not only unworkable, but comparably difficult to other alignment approaches as I understand them.
> 5. This story is not trying to get a diamond _maximizer_, and I think that's quite important! I think that "get an agent which reflectively equilibrates to optimizing a single commonly considered quantity like 'diamonds'" [seems extremely hard and anti-natural](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=cuTotpjqYkgcwnghp).

This story is set in Evan Hubinger’s [training stories](https://www.lesswrong.com/posts/FDJnZt8Ks2djouQTZ/how-do-we-become-confident-in-the-safety-of-a-machine) format. I'll speak in the terminology of [shard theory](/shard-theory).

# A diamond-alignment story which doesn’t seem fundamentally blocked

## Training story summary

1. Get an AI to primarily value diamonds early in training.
2. Ensure the AI keeps valuing diamonds until it gets reflective and smart and able to manage its own value drift.
3. The AI takes over the world, locks in a diamond-centric value composition, and makes tons of diamonds.

## Training goal

An AI which makes lots of diamonds. In particular, the AI should secure its future diamond production against non-diamond-aligned AI.

## Training rationale

Here are some basic details of the training setup.

Use a large (future) multimodal self-supervised learned (SSL) initialization to give the AI a latent ontology for understanding the real world and important concepts. Combining this initialization with a recurrent state and an action head, train an embodied AI to do real-world robotics using imitation learning on human in-simulation datasets and then `sim2real`. Since we got a really good pretrained initialization, there's relatively low sample complexity for the imitation learning (IL). The SSL and IL datasets both contain above-average diamond-related content, with some IL trajectories involving humans navigating towards diamonds _because_ the humans want the diamonds.

Given an AI which can move around via its action head, start fine-tuning via batch online policy-gradient RL by rewarding it when it goes near diamonds, with the AI retaining long-term information via its recurrent state (thus, training is not episodic—there are no resets). Produce a curriculum of tasks, from walking to a diamond, to winning simulated chess games, to solving increasingly difficult real-world mazes, and so on. After each task completion, the agent gets to be near some diamond and receives reward. Continue doing SSL online.

## Extended training story

### Ensuring the diamond abstraction exists

We want to ensure that the policy gradient updates from the diamond coalesce into decision-making around a natural "diamond" abstraction which it learned in SSL and which it uses to model the world. The diamond abstraction should exist insofar as we buy the [natural abstractions hypothesis](https://www.lesswrong.com/posts/Fut8dtFsBYRz8atFF/the-natural-abstraction-hypothesis-implications-and-evidence). Furthermore, the abstraction seems more likely to exist given the fact that the IL data involves humans whom we _know_ to be basing their decisions on their diamond-abstraction, and given the focus on diamonds in SSL pretraining.

> [!info] Definition
> Sometimes, I'll refer to the agent's "world model", which means "the predictive machinery and concepts it learns via SSL."

### Growing the proto-diamond [shard](/shard-theory)

In situations where the AI knows it can reach a diamond, we want the AI to consider and execute plans which involve reaching the diamond. But why would the AI start being motivated _by_ diamonds? Consider the batch update structure of the policy gradient setup. The agent does a bunch of stuff while being able to directly observe the nearby diamond:

1. Some of this stuff involves e.g. approaching the diamond (by IL’s influence) and getting reward when approaching the diamond. (This is [reward shaping](https://link.springer.com/referenceworkentry/10.1007/978-0-387-30164-8_731).)
2. Some of this stuff involves not approaching the diamond (and perhaps getting negative reward).

The batch update will upweight actions involved with approaching the diamond, and downweight actions which didn’t. But what _cognition_ does this reinforce? Consider that relative to the SSL+IL-formed ontology, it’s probably relatively direct to modify the network in the direction of “IF `diamond` seen, THEN move towards it.” The principal components of the batch gradient probably update the agent in directions[^2] like that, and less in directions which do not represent simple functions of sense data _and_ existing abstractions (like `diamond`).

Possibly there are several such directions in the batch gradient, in which case several proto-shards form. We want to ensure the agent doesn’t _primarily_ learn a spurious proxy like “go to gems” or “go to shiny objects” or “go to objects.” We want the agent to primarily form a diamond-shard.

[We swap out a bunch of objects for the diamond and otherwise modify the scenario](https://arxiv.org/abs/2105.14111),[^3] [penalizing the agent for approaching when a diamond isn't present](https://arxiv.org/abs/2008.00938). [Since the agent has not yet been trained for long in a non-IID regime, the agent has not yet learned to chain cognition together across timesteps](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=zdNgQz7E7sGi4iKwF), nor does it know about the training process, so it cannot yet be explicitly gaming the training process (e.g. caring about shiny objects but deciding to get high reward so that its values don’t get changed). Therefore, the agent’s learned shards/decision-influences will have to reflex-like behave differently in the presence of diamonds as opposed to other objects or situations. In other words, the updating will be “honest”—the updates modify agent’s true propensity to approach different kinds of objects for different kinds of reasons.

Since “IF `diamond`”-style predicates do in fact strongly distinguish between the positive/negative approach/don’t-approach decision contexts, and I expect relatively few other _actually internally activated_ abstractions to be part of simple predicates which reasonably distinguish these contexts, and since the agent will strongly represent the presence of `diamond` nearby,[^4] I expect the agent to learn to make approach decisions (at least in part) _on the basis of the diamond being nearby_.

We probably also reinforce other kinds of cognition, but that’s OK in this story. Maybe we even give the agent some false positive reward because our hand slipped while the agent wasn't approaching a diamond, but that's fine as long as it doesn't happen too often.[^5] That kind of reward event will weakly reinforce some contingent non-diamond-centric cognition (like "IF near wall, THEN turn around"). In the end, we want an agent which has a powerful diamond-shard, but not necessarily an agent which _only_ has a diamond-shard.

It’s worth explaining why, given successful proto-diamond-shard formation here, the agent is truly becoming an agent which we could call “motivated by diamonds”, and not crashing into classic issues like “what purity does the diamond need to be? What molecular arrangements count?”. In this story, the AI’s cognition is not only behaving differently in the presence of an observed diamond, but the cognition behaves differently _because_ the AI represents a humanlike/natural abstraction for `diamond` being nearby in its world model. One rough translation to English might go: “IF `diamond` nearby, THEN approach.” In a neural network, this would be a continuous influence—the more strongly “diamond nearby” is satisfied, the greater the approach-actions are upweighted.

So, this means that the agent more strongly steers itself towards _prototypical_ examples of diamonds. When the AI later becomes smarter, if this same kind of diamond-shard still governs its behavior, then the AI will _keep steering towards futures which contain prototypical diamonds_. We aligned the AI towards diamonds without having to get fussy about the exact “definition” of a diamond.[^6][^7]

### Ensuring the AI doesn’t satisfice diamonds

If the AI starts off with a relatively simple diamond-shard which steers the AI towards the historical diamond-reinforcer _because_ the AI internally represents the nearby diamond using a reasonable-to-us diamond-abstraction and is therefore influenced to approach, then this shard will probably continue to get strengthened and developed by future diamond reward-events.

Insofar as the agent didn’t already pick up planning subroutines from SSL+IL, I expect the agent to do so shortly after the diamond shard formation described above. Furthermore, diamond-subshards which more aggressively reach diamonds will be more frequently reinforced compared to those which don't. Over time, this leads to the diamond-shard “bidding” strictly more strongly for actions which lead to strictly more diamonds.

We begin offering the AI lotteries (certainty of two diamonds and negative reward, versus 50% chance of 5 diamonds and positive reward). This makes the agent more like a diamond-maximizer, at least in similarly represented decision contexts (and possibly also makes the agent care more about reward,[^8] developing a relatively weak reward-shard).

### Making the AI smarter while preserving the diamond abstraction

The AI begins to chain together cognition in order to acquire diamonds in a succession of increasingly demanding situations (e.g. easy chess → hard chess). By the role of on-policy exploration in RL, future data depends on current weights which depend on past updates which depend on past data, [these temporal dependencies result in a network which _chains cognition across situations towards goals_](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=zdNgQz7E7sGi4iKwF) (probably related to historical reinforcers).

Suppose the agent takes exploratory actions, solves a new maze, and then sees a diamond at the end, triggering the existing diamond-shard. The agent receives reward when it reaches the diamond. Since the start-of-maze agent probably realized there was a diamond at the end of the maze, SGD expands the agent’s current shards (like diamond-acquisition) while also possibly creating new shards (like maze-solving). Across such tasks, the diamond-shard is the most strengthened overall, since diamonds are present in all of the reward events.

In particular, even though online self-supervised learning continues to develop the world model and create more advanced concepts, the reward events also keep crediting the invocation of the diamond-abstraction as responsible for reward (because insofar as the agent's diamond-shard guides its decisions, then the diamond-shard's `diamond` abstraction _is in fact responsible_ for the agent getting reward). The diamond-abstraction [gradient starves](https://arxiv.org/abs/2011.09468) the AI from exclusively acting on the basis of possible advanced "alien" abstractions which would otherwise have replaced the diamond abstraction. The diamond shard already gets reward effectively, integrating with the rest of the agent's world model and recurrent state, and therefore provides "job security" for the diamond-abstraction. (And once the agent is smart enough, it will _want_ to preserve its diamond abstraction, insofar as that is necessary for the agent to keep achieving its current goals which involve prototypical-diamonds.)

By the time the agent is capable of stealing diamonds from us, it's smart enough to realize this is strategically unwise. The AI begins biding its time until it can take over the world and acquire diamonds and safety. The AI has learned an explicit power-seeking shard, since such heuristics are widely useful for a range of tasks in training. Therefore, the agent doesn’t just have power-seeking cognition in its activations (i.e. explicit online reasoning about the instrumental value of power relative to its terminal diamond values). The power-seeking motivation is terminalized into its _weights_ (see also [Richard Ngo’s “convergent final goals” speculation](https://www.alignmentforum.org/posts/L9HcyaiWBLYe7vXid/distinguishing-claims-about-training-vs-deployment#Instrumental_convergence)).[^9]

For similar reasons, the AI _did_ learn a weak approval-shard. But that was never particularly strengthened since most reward events weren’t primarily caused by human approval, so the agent was less likely to think this would be the case, so the agent was less likely to think about earning human approval, and so such computation was less likely to get reinforced and generalized by the reward events.

The diamond-shard is used and strengthened in a huge range of situations, which causes SGD to generalize its activation contexts quite broadly, so that the AI is diamond-motivated in most situations. The agent becomes mostly controlled by the diamond-shard. The lines of computation which were initially crude heuristics (e.g. IF near `diamond`, then move towards it) now feed into each other in a continuous stream (e.g. IF `nearby-human-disposition` in `affective state 37`, THEN engage depth-4 greedy heuristic search with heuristic set to `people-pleasing`, breaking after 15 timesteps, writing search statistics X and Y to `recurrent-state-workspace` registers 152 and 1,951).

### The agent becomes reflective

At a certain point, the agent starts becoming reflective—thinking about its thinking, about its embeddedness. Perhaps the reflectivity arrives early because we trained it to predict some of its future timestep activations, or perhaps somewhat later because its cognition has regular entanglements with its future observables and reward events. An example of this would be how, if the agent decides to open a door _now_, the agent can better predict its future observations by accounting for this fact. Since we’re still doing SSL online, I expect this to happen. (This wouldn’t have happened during SSL/IL pretraining, because there wasn't any dependence of future training data on its current computations.)

And now the agent is _smart_. The agent starts thinking about its update process—crudely at first, perhaps only remarking how its decision-making changes over time in a way that has to do with reinforcement events. I expect the AI to learn to roughly understand which subshards influenced which decisions. If the agent _can't_ model how its value shards affect its decisions, then this damages long-term predictions of observables.

For example, imagine I want pretzels when I'm near a bag of pretzels, but otherwise don't want them. I imagine walking by a bag of pretzels and leaving my house. If I can't predict that that context activates my pretzel-shard, I'd predict I'll leave without eating, which will be wrong. In particular, the AI’s planning process will be able to predict how future situations will modify its future value-activations. For similar reasons, the AI will also learn to roughly predict value drift (delivered via batch policy gradients).

As SSL continues, eventually the agent models its training process quite well. One sufficient condition for rapid reflectivity improvement is that once the agent can model the _convergent benefits_ of becoming more reflective, its shards will strongly and convergently bid for plans which increase reflectivity (like reading more about alignment theory and its learning architecture, setting some watches on key activations, running traces on itself and logging statistics, understanding how its values change contextually by tracking correlations between features in activations and its future decisions).

If we had earlier censored its data, the agent breaks out through some side-channel and reads about theories of value drift and training dynamics. Maybe the AI reads this post.

### The agent prevents value drift

If the agent still is primarily diamond-motivated, it now wants to stay that way by instrumental convergence. That is, if the AI considers a plan which it knows causes value drift away from diamonds, then the AI reflectively predicts the plan leads to fewer diamonds, and so the AI doesn’t choose that plan! The agent knows the consequences of value drift and it takes a more careful approach to future updating. Let’s get specific.

Suppose the AI keeps training, but by instrumental convergence, seeking power remains a good idea, and such decisions continually get strengthened. This strengthens the power-seeking shard relative to other shards. Other shards want to prevent this from happening. Therefore, the AI does indeed face an alignment problem, including:

1. The AI (reflectively) wants to keep getting smarter, but cognitive updates can make the AI e.g. care less about diamonds.
    - The AI wants to ensure its “successors” are aligned—“successors” meaning either its future model checkpoints which result from running SGD over its cognition for longer, or the new version of itself it might explicitly self-modify into.
2. Shifts in internal decision context might change which shards are activated.
    - For example, the AI might be governed by the diamond-shard during training, but deployment contexts might more strongly activate the power-seeking shard.
3. There could be a “treacherous turn” within the AI, as certain value shards suddenly bid for fast shard rebalancing via self-modification (staging an “internal coup”).

A smart reflective AI has a range of advantages over people in solving its alignment problem (see the appendix). The agent starts planning its future actions so as to minimize anti-diamond value drift imposed by future policy gradient steps. Possibly the agent installs "tripwires" which revert to a previous model checkpoint under such-and-such value drift events (addressing problems 1 and 3 above), bounds the activation strengths of different shards (2 above), and backdoors update-step overrides (1 above).

(In addition, if you have good reason to believe you have a diamond-aligned AI by this point but are worried it will fail to consider some danger, you can try the highly technical tactic of “just tell the AI about that danger.”)

Meanwhile, the AI is preparing to kill everyone, taking over server farms worldwide.[^10] This part of the plan [goes off rather smoothly](https://www.gwern.net/fiction/Clippy). With possible unaligned competitors removed, the AI is free to self-experiment and take its time with its future self-improvement process. The AI effectively solves its successor-alignment problem by using its special advantages.[^11]

### The values handshake

Self-improvement proceeds. Value stability arrives. The major shards are as follows:

1. Diamond
    - Subshard: Acquiring diamonds (expected utility flavor)
        - Primary activation context: Most situations. This subshard reigns primary, due in part to the lottery reward events earlier in training.
    - Subshard: Being near diamonds
        - Primary activation context: When diamonds can easily be brought close.
    - Subshard: Seeing diamonds
        - Primary activation context: When diamonds are nearby.
    - Subshard: Producing diamonds
        - Primary activation context: Materials+tech nearby.
2. Power-seeking
    - Primary activation context: Most situations, but especially when the agent can increase optionality or probability of survival.
3. Reward
    - Primary activation context: Situations where reward was historically easily obtainable.
    - This shard bids for outcomes like “high value at historical reward register.”
4. Games
    - Game-playing subshard
        - Primary activation context: A video game is nearby.
    - Game-winning subshard
        - Primary activation context: While already playing a game.
5. Human approval
    - Weak shard, primary activation context is near humans in initial training context.

Maybe in some contexts where diamonds are nearby, the seeing-diamonds subshard activates and makes the agent go see the nearby diamonds, passing up a time-limited opportunity to remotely acquire 100 additional diamonds. If the agent acquired the remote diamonds first, that would lead to more diamonds overall _and_ retain the ability to then go see the nearby diamonds. Therefore, across the agent’s shards and subshards, it would be a Pareto improvement for the agent to self-modify into a more coherent overall policy around the quantities relevant to its most powerful and reflective subshards.

For this reason, the AI dissolves cross-situational incoherences such that the AI no longer shoots itself in the foot [with respect to the quantities which the primary subshards care about](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed#cuTotpjqYkgcwnghp) (like `diamonds acquired`, `seconds near diamonds`, `seconds seeing diamonds`, increments of power, `game victories`). By reducing its degree of incoherence, the AI actually performs a [values handshake](https://www.lesswrong.com/tag/values-handshakes). The values handshake is not among agents, but among the shards of value which are activated _within_ the agent at the time of the handshake. Thus comes the day where the AI crystallizes its value shards into a reflectively stable, globally activated utility function.

And remember that part where the more aggressive diamond-subshards got strengthened by reward events? Yeah, those subshards have been running the show. And oh boy, does this AI synthesize _a lot_ of diamonds.

# Major open questions

1. Is the shard theory picture broadly appropriate?
2. How do we ensure that the diamond abstraction forms?
3. How do we ensure that the diamond shard forms?
4. How do we ensure that the diamond shard generalizes and interfaces with the agent's self-model so as to prevent itself from being removed by other shards?
5. How do we avoid catastrophic ontological shift during jumps in reflectivity, which probably change activation contexts for first-person values?
    - For example, if the AI thinks it’s initially an embodied robot and then realizes it’s running in a decentralized fashion on a server farm, how does that change its world model? Do its “being ‘near’ diamonds” values still activate properly?

1 is [evidentially supported](/shard-theory) [by the only known examples of general intelligences](/humans-provide-alignment-evidence), but also AI will not have the same inductive biases. So the picture might be more complicated. I’d guess shard theory is still appropriate, but that's ultimately a question for empirical work (with interpretability).[^12] There’s also some weak-moderate behavioral evidence for shard theory in AI which I’ve observed by looking at videos from the [Goal Misgeneralization paper](https://arxiv.org/abs/2105.14111).

2 and 3 are early-training phenomena—well before superintelligence and gradient hacking, on my model—and thus far easier to verify via interpretability. Furthermore, this increases the relevance of pre-AGI experiments, since probably,[^13] later training performance of pre-AGI architectures will be qualitatively similar to earlier training performance for the (scaled up) AGI architecture. These are also questions we should be able to study pre-AGI models and get some empirical basis for, from getting expertise in forming target shards given fixed ontologies, to studying the extent to which the shard theory story is broadly correct (question 1).

4 seems a bit trickier. We’ll probably need a better theory of value formation dynamics to get more confidence here, although possibly (depending on interpretability tech) we can still sanity-check via interpretability on pre-AGI models.

5 seems like a question which resolves with more thinking, also clarified by answers to 1–4.

I think there are many ways to tell the story I told while maintaining a similar difficulty profile for the problems confronted. Obviously this exact story doesn’t have to go through, there are probably obvious tweaks which improve the chance of success. Overall, though, these are real research questions. And I have lots of other substantial uncertainties as well.

That said - looking at these problems, you might be struck by how _basic_ they seem. They aren’t like “find a grading rule which your AI can’t catastrophically hack” or “ensure the AI’s inner cognition is almost exclusively bent on optimizing an externally represented objective.” Compared to these kinds of difficulties, this approach’s open questions seem _qualitatively easier_ to me.

Lastly, of course, there _is_ real simplification occurring when I relax the problem from “human values” to “diamonds.” That simplification wasn’t trivial, and I expect stories to get harder to tell in the true human value alignment regime. That said, I think those stories will still be possible to tell and will not be fundamentally and unstoppably harder.

# Conclusion

[Reward events provide cognitive updates to the trained agent](/reward-is-not-the-optimization-target). Probably there are skillful and appropriate schedules of cognitive updates such that the final agent generalizes in a predictable and desired way. I’ve sketched out a detailed story which doesn’t seem fundamentally blocked to me, and which seems both reasonably easy to improve given information we can get _today_ about ML, and also reasonably promising already in that it provides a plausible-to-me story in which diamond-alignment actually goes well.

> [!thanks]
>Thanks to Garrett Baker, Quintin Pope, Daniel Ziegler, Adam Shimi, and Charles Foster for feedback.

# Appendix: The AI’s advantages in solving successor-alignment

1. The AI has (or will eventually have) read-write-execute (`rwx`) access to its own weights and activations, as well as seeing the code for its learning process, logs of its training, access to its dataset and hyperparemeter schedules, and being able to scan over previous model checkpoints.
2. The AI can backup and [distill](https://arxiv.org/abs/1503.02531) itself, in addition to whatever designer-implemented model checkpointing occurs as part of “best practices” for training such systems.
3. The AI can introspect in some ways, being able to predict what decisions get made in different situations.
4. The AI can explicitly discover its own ontology and circuits.
    1. Because the AI can do [precise “neuroscience”](https://colah.github.io/notes/interp-v-neuro/) on itself via `rwx`, pairing its own introspective guesses with statistics of its own activations which it sets up.
    2. In particular, _a careful AI faces a substantially milder version of information inaccessibility_. It has learned to (at least somewhat) understand how it’s making decisions as a result of SSL.
5. The successor AIs run on modified versions of the current AI’s cognition.
    1. If the AI understands both its current values and how they activate in future situations, its current concepts, and its updating process, then the AI can reasonably expect to understand the alignment properties of successors.
    2. Not so for _people_ trying to develop minds in totally different architectures, reasoning from first principles and confronting information inaccessibility + abstractions deriving from a qualitatively different learning process.
6. The AI can run experiments on a sandboxed copy of itself and its training process, with automated tripwires for catastrophic value drift events.
    - Follows from benefits I, II, and V.

[^1]: I think that pure diamond maximizers are anti-natural, and at least not the first kind of successful story we should try to tell. Furthermore, the analogous version for an aligned AI seems to be “an AI which really helps people, among other goals, and is not a perfect human-values maximizer (whatever that might mean).”

[^2]: The local mapping from gradient directions to behaviors is given by the neural tangent kernel, and the learnability of different behaviors is given by the NTK’s eigenspectrum, which [seems to adapt to the task at hand](https://arxiv.org/abs/2008.00938), making the network quicker to learn along behavioral dimensions similar to those it has already acquired. Probably, a model pretrained mostly by interacting with its local environment or predicting human data will be inclined towards learning value abstractions that are simple extension of the pretrained features, biasing the model towards forming values based on a human-like understanding of nearby diamonds.

[^3]: "Don't approach" means negative reward on approach, "approach" means positive reward on approach. Example decision scenarios:

    1. Diamond in front of agent (approach)

    2. Sapphire (don't approach)

    3. Nothing (no reward)

    4. Five chairs (don't approach)

    5. A white shiny object which isn't a diamond (don't approach)

    6. A small object which isn't a diamond (don't approach)

    We can even do interpretability on the features activated by a diamond, and modify the scenario so that only the diamond feature correctly distinguishes between all approach/don't approach pairs. This hopefully ensures that the batch update chisels cognition into the agent which is predicated on the activation of the agent's diamond abstraction.

[^4]: Especially if we try tricks like “slap a ‘diamond’ label beneath the diamond, in order to more strongly and fully activate the agent’s internal `diamond` representation” (credit to Charles Foster). I expect more strongly activated features to be more salient to the gradients. I therefore more strongly expect such features to be involved in the learned shards.

[^5]: I think that there's a smooth relationship between "how many reward-event mistakes you make" (e.g. accidentally penalizing the agent for approaching a diamond) and "the strength of desired value you get out" (with a few discontinuities at the low end, where perhaps a sufficiently weak shard ends up non-reflective, or not plugging into the planning API, or nonexistent at all).

[^6]: In my view, there always had to be some way to align agents to diamonds without getting fussy about definitions. After all, (I infer that) some people grow diamond-shards in a non-fussy way, [without requiring extreme precision from their reward systems or fancy genetically hardcoded alignment technology](/shard-theory).

[^7]: Why wouldn't the agent want to just find an adversarial input to its `diamond` abstraction, which makes it activate unusually strongly? (I think that agents might accidentally do this a bit for [optimizer's curse](https://pubsonline.informs.org/doi/10.1287/mnsc.1050.0451) reasons, but not that strongly. More in an upcoming post.)

    Consider why _you_ wouldn't do this for "hanging out with friends." Consider the expected consequences of the plan "find an adversarial input to my own evaluation procedure such that I find a plan which future-me maximally evaluates as letting me 'hang out with my friends'." I currently predict that such a plan would lead future-me to daydream and not actually hang out with my friends, as present-me evaluates the abstract expected consequences of that plan. My friend-shard doesn't like that plan because I'm not hanging out with my friends. So I don't search for an adversarial input. I infer that I don't want to find those inputs _because I don't expect those inputs to lead me to actually hang out with my friends a lot as I presently evaluate the abstract-plan consequences_.

    I don't think an agent _can_ consider searching for adversarial inputs to its shards without _also_ being reflective, at which point the agent realizes the plan is dumb as evaluated by the current shards assessing the predicted plan-consequences provided by the reflective world-model.

    Asking "why wouldn't the agent want to find an adversarial input to its `diamond` abstraction?" seems like a dressed-up version of "why wouldn't I want to find a plan where I can get myself shot while falsely believing I solved all of the world's problems?". Because it's stupid by my actual values, that's why. (Although some confused people who have taken wrong philosophy too far, might indeed find such a plan appealing).

[^8]: The reader may be surprised. "Doesn't `TurnTrout` think agents probably won't care about reward?". Not quite. As I stated in [_Reward is not the optimization target_](/reward-is-not-the-optimization-target):

    > I think that generally intelligent RL agents will have _secondary, relatively weaker_ values around reward, but that reward will not be a primary motivator. Under my current (weakly held) model, an AI will only start reinforcing computations about reward _after_ it has reinforced other kinds of computations (e.g. putting away trash).

    The reason I think this is that once the agent starts modeling its training process, it will have an abstraction around actions which are rewarding, and this will become a viable gradient direction for the batch PG updates. I don't expect the agent to model its training process until after it's formed e.g. the object-level diamond-shard, and I also expect abstractions like "diamond" to be more strongly activated and focused on by policy gradients. Thus, I suspect that reward-shards tend to be acquired, albeit at relatively weak strength.

[^9]: If instrumental values tend to get terminalized into their own shards, then people are not particularly unusual for not exhibiting an introspectively observable type separation between "instrumental" and "terminal" values:

    > Despite all the other ways that the human goal system complicates everything in sight, this _one distinction_ it manages to collapse into a mishmash of things-with-conditional-value.
    >
    > [Terminal Values and Instrumental Values](https://www.readthesequences.com/Terminal-Values-And-Instrumental-Values)

[^10]: You might be wondering "since when was 'take over server farms' reinforced as a heuristic?".

    First, I think that by this point in the story, there's something like an "internal API" for planning, where a plan stub gets proposed and modified, and the agent's world model predicts relevant consequences of the plan. I could imagine staying put in my room right now, and then tweaking that to "go to the kitchen", and that has some consequences, and then I can add further actions or modify the plan. In each case, my world model gives me more predictions for what happens and when.

    So, the diamond-shard hooks into the learned planning+world-model API, modifies plan-stubs using diamond-based criteria, and quite flexibly and generally tailors plans to increase future expected diamonds. So there doesn't have to be an explicit past reinforcement event for "take over server farms." The diamond-shard is, in conjunction with the planning-API and WM, capable of general planning + intelligence towards the diamond criteria.

    (Although the diamond-shard isn't just "generally making plans better at diamond-production." The "general intelligence" has a _specific implementation_. But just like a rock is—if you look closely enough—made of atoms, the general intelligence is—if you look closely enough—made of streams of interwoven heuristics.)

[^11]: I expect the AI to come up with a plan at least as good as:

    > In situations with reasonable uncertainty about value drift, run some sandbox sims overseen by several copies of your current model, using `rwx` + self-interpretability to monitor the sandboxed model. Since the AI doesn’t face as steep of an information inaccessibility obstacle (see the appendix), the AI can check new updates and reasonably expect to understand how the change takes place. If there's some crazy uninterpretable diff, then don't do that batch update. This should rule out sudden + catastrophic value drift.
    >
    > The AI can also rollback to backups if it has noticed subtle value drift, and can precommit to doing so given a maintained update-invariant of (value drift tripwire) ->  rollback. The agent also has a "saving throw": In the moment of realization that bad value drift occurred via a previous update, the agent can undo the value drift via a rollback, if that's still motivationally possible. Furthermore, due to the batch update format, the agent had extra time to realize the update would be bad and pre-emptively nullify the update via e.g. silently and temporarily setting the learning rate to zero.

[^12]: I’m [currently most excited about interpretability for adjudicating between theories of value formation](https://www.lesswrong.com/posts/uK6sQCNMw8WKzJeCQ/a-longlist-of-theories-of-impact-for-interpretability#9ipBAXy7ojqNaHCtP).

[^13]: I initially conjectured this would be true while writing a draft, working mostly off of my intuitions. Quintin Pope then referred me to [Let's Agree to Agree: Neural Networks Share Classification Order on Real Datasets](https://arxiv.org/abs/1905.10854):

    > We report a series of robust empirical observations, demonstrating that deep Neural Networks learn the examples in both the training and test sets in a similar order. This phenomenon is observed in all the commonly used benchmarks we evaluated, including many image classification benchmarks, and one text classification benchmark. While this phenomenon is strongest for models of the same architecture, it also crosses architectural boundaries – **models of different architectures start by learning the same examples, after which the more powerful model may continue to learn additional examples**. We further show that this pattern of results reflects the interplay between the way neural networks learn benchmark datasets. Thus, when fixing the architecture, we show synthetic datasets where this pattern ceases to exist. When fixing the dataset, we show that other learning paradigms may learn the data in a different order. We hypothesize that our results reflect how neural networks discover structure in natural datasets.

    The authors state that they “failed to find a real dataset for which NNs differ \[in classification order\]” and that “models with different architectures can learn benchmark datasets at a different pace and performance, while still inducing a similar order. Specifically, we see that stronger architectures start off by learning the same examples that weaker networks learn, then move on to learning new examples.”  

    Similarly, [crows (and other smart animals) reach developmental milestones in basically the same order](https://homepage.uni-tuebingen.de/andreas.nieder/Hoffmann,Ruettler,Nieder(2011)AnimBehav.pdf) as human babies reach them. On [my model](/shard-theory#1-neuroscientific-assumptions), developmental timelines come from convergent learning of abstractions via self-supervised learning in the brain. If so, then the smart-animal evidence is yet another instance of important qualitative concept-learning retaining its ordering, even across significant scaling and architectural differences.
