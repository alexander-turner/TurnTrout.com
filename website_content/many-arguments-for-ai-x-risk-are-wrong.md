---
permalink: invalid-ai-risk-arguments
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/yQSmcfN4kA7rATHGK/many-arguments-for-ai-x-risk-are-wrong
lw-is-question: 'false'
lw-posted-at: 2024-03-05T02:31:00.990000Z
lw-last-modification: 2024-07-09T07:23:08.172000Z
lw-curation-date: None
lw-frontpage-date: 2024-03-05T18:53:43.326000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 86
lw-base-score: 162
lw-vote-count: 135
af-base-score: 48
af-num-comments-on-upload: 46
publish: true
title: Many arguments for AI x-risk are wrong
lw-latest-edit: 2024-03-11T21:57:55.185000Z
lw-is-linkpost: 'false'
tags:
  - AI
  - critique
aliases:
  - many-arguments-for-ai-x-risk-are-wrong
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2024-03-05 00:00:00
original_url: 
  https://www.lesswrong.com/posts/yQSmcfN4kA7rATHGK/many-arguments-for-ai-x-risk-are-wrong
skip_import: true
description: Arguments that AI will inevitably "scheme" are oversimplified and unconvincing.
  Deep learning defies naive predictions, and better arguments are needed.
date_updated: 2025-06-03 22:57:00.423836
---












> [!note] Author's note
> The following is a lightly edited version of a memo I wrote for a retreat. It was inspired by a draft of [Counting arguments provide no evidence for AI doom](https://www.lesswrong.com/posts/YsFZF3K9tuzbfrLxo/counting-arguments-provide-no-evidence-for-ai-doom). I think that my post covers important points not made by the published version of that post. I'm also thankful for the dozens of interesting conversations and comments at the retreat.

I think that the AI alignment field is partially founded on fundamentally confused ideas. I'm worried about this because, right now, a range of lobbyists and concerned activists and researchers are in Washington making policy asks. Some of these policy proposals seem to be based on erroneous or unsound arguments.[^1]
[^1]: To echo [the concerns of a few representatives in the U.S. Congress](https://science.house.gov/2023/12/science-committee-leaders-stress-importance-of-diligence-in-nist-ai-safety-research-funding): "The current state of the AI safety research field creates challenges for NIST as it navigates its leadership role on the issue. Findings within the community are often self-referential and lack the quality that comes from revision in response to critiques by subject matter experts."

The most important takeaway from this essay is that the (prominent) counting arguments for "deceptively aligned" or "scheming" AI provide \~0 evidence that pretraining + RLHF will eventually become intrinsically unsafe. That is, that even if we don't train AIs to achieve goals, they will be "deceptively aligned" anyways. This has important policy implications.

> [!warning] Disclaimers
>
> 1. I am _not_ putting forward a positive argument for alignment being easy. I am pointing out the invalidity of existing arguments, and explaining the implications of rolling back those updates.
> 2. I am _not_ saying "we don't know how deep learning works, so you can't _prove_ it'll be bad." I'm saying "many arguments for 'deep learning → doom' are weak. I undid those updates and am now more optimistic."
> 3. I am not covering training setups where we purposefully train an AI to be agentic and autonomous. I just think it's _not_ plausible that we just keep scaling up networks, run pretraining + light RLHF, and then produce a schemer.[^RFLO]

[^RFLO]: To stave off revisionism: Yes, I think that "scaling->doom" has historically been a real concern. No, people have not "always known" that the "real danger" was zero-sum self-play finetuning of foundation models and distillation of agentic-task-prompted autoGPT loops.

## Tracing back historical arguments

In the next section, I'll discuss the counting argument. In this one, I want to demonstrate how often foundational alignment texts make crucial errors. For example:

> [!quote] Nick Bostrom's <span class="book-citation">Superintelligence</span>, page 253
> A range of different methods can be used to solve "reinforcement-learning problems," but they typically involve creating a system that seeks to maximize a reward signal. This has an inherent tendency to produce the wireheading failure mode when the system becomes more intelligent. Reinforcement learning therefore looks unpromising.

To be blunt, this is nonsense. I have long meditated on the nature of "reward functions" during [my PhD in RL theory](https://arxiv.org/abs/2206.11831). [In the most useful and modern RL approaches, "reward" is a tool used to control the strength of parameter updates to the network.](https://www.lesswrong.com/posts/pdaGN6pQyQarFHXF4/reward-is-not-the-optimization-target)[^RL] It is simply _not true_ that "\[RL approaches] typically involve creating a system that seeks to maximize a reward signal." We have never ever used RL to train an artificial system which intentionally "seeks to maximize" reward.[^RLauth] Bostrom spends a few pages making this mistake at great length.[^support]
[^RL]: Here's a summary of the technical argument. The actual PPO+Adam update equations show that the "reward" is used to, basically, control the learning rate on each (state, action) datapoint. That's roughly[^rough] what the math says. We also have a bunch of examples of using this algorithm where the trained policy's behavior makes the reward number go up on its trajectories. Completely separately and with no empirical or theoretical justification given, RL papers have a convention of _including the English words_ "the point of RL is to train agents to maximize reward", which often gets further mutated into e.g. Bostrom's argument for wireheading ("they will probably seek to maximize reward"). That's simply unsupported by the data and so an outrageous claim.

[^rough]: Since I wrote this memo for a somewhat non-technical audience, I didn't want to get into the (important) distinction between a learning rate which is proportional to advantage (as in the real PPO equations) and a learning rate which is proportional to reward (which I talked about above).
[^support]: The strongest argument for reward-maximization which I'm aware of is: Human brains do RL and often care about some kind of tight reward-correlate, to some degree. Humans are like deep learning systems in some ways, and so that's evidence that "learning setups which work in reality" can come to care about their own training signals.
[^RLauth]:
    While real evidence is scarce, there _is_ a glut of RL authors who repeat the mantra that "the point of RL is to train an agent to maximize reward…". [Littman, 1996](https://www.researchgate.net/publication/33697270_Algorithms_for_Sequential_Decision_Making) (p.6): "The \[RL] agent's actions need to serve some purpose: in the problems I consider, their purpose is to maximize reward."

    Did RL researchers in the 1990's sit down and carefully analyze the inductive biases of PPO on huge 2026-era LLMs, conclude that PPO probably entrains LLMs which make decisions on the basis of their own reinforcement signal, and then decide to say "RL trains agents to maximize reward"? **Of course not.** My guess: [Control theorists in the 1950s (reasonably) talked about "minimizing cost"](https://en.wikipedia.org/wiki/Optimal_control) in their own problems, and so RL researchers by the '90s started saying "the point is to maximize reward", and so Bostrom repeated this mantra in 2014. That's where a bunch of concern about wireheading comes from.&#x20;

After making a false claim, Bostrom goes on to dismiss RL approaches to creating useful, intelligent, aligned systems. But, as a point of further fact, RL approaches constitute humanity's _current best tools_ for aligning AI systems today! Those approaches are pretty awesome. No RLHF, then no GPT-4 (as we know it).

In arguably _the_ foundational technical AI alignment text, Bostrom makes a deeply confused and false claim, and then perfectly anti-predicts what alignment techniques are promising.

I'm not trying to rag on Bostrom personally for making this mistake. Foundational texts, ahead of their time, are going to get some things wrong. But that doesn't save us from the subsequent errors which avalanche from this kind of early mistake. These deep errors have costs measured in tens of thousands of researcher-hours. Due to the "RL->reward maximizing" meme, [I personally misdirected thousands of hours](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=Sw89AxHGJ5j7E7ETf) on proving power-seeking theorems.

Unsurprisingly, if you have a lot of people speculating for years using confused ideas and incorrect assumptions, and they come up with a bunch of speculative problems to work on… If you later try to adapt those confused "problems" to the deep learning era, you're in for a bad time. Even if you, dear reader, don't agree with the original people (i.e. MIRI and Bostrom), and even if you aren't presently working on the same things… The confusion has probably influenced what you're working on.

I think that's why some people take  "[scheming AIs](https://www.lesswrong.com/posts/yFofRxg7RRQYCcwFA/new-report-scheming-ais-will-ais-fake-alignment-during)" and "deceptive alignment" so seriously, even though some of the technical arguments are flatly unfounded.

## Many arguments for doom are wrong

Let me start by saying what existential vectors I _am_ worried about:

1. I'm worried about people turning AIs into agentic systems using scaffolding and other tricks, and then instructing the systems to complete large-scale projects.
2. I'm worried about competitive pressure to automate decision-making in the economy.
3. I'm worried about misuse of AI by state actors.
4. I'm worried about centralization of power and wealth in opaque non-human decision-making systems, and those who own the systems.[^Stella]
   [^Stella]: To quote Stella Biderman: "_Question:_ Why do you think an AI will try to take over the world? _Answer:_ Because I think some asshole will deliberately and specifically create one for that purpose. Zero claims about agency or malice or anything else on the part of the AI is required."

I maintain that there isn't good evidence/argumentation for threat models like "future LLMs will _autonomously_ constitute an existential risk, even without being prompted towards a large-scale task." These models seem somewhat pervasive, and so I will argue against them.

I cannot address each of the million arguments for doom, but I think most are wrong and am happy to dismantle any particular argument (in person; I do not commit to replying to comments here).

Much of my position is summarized by [my review](https://www.lesswrong.com/posts/uMQ3cqWDPHhjtiesc/agi-ruin-a-list-of-lethalities?commentId=B4poSMfRteggYWpv7) of Yudkowsky's [AGI Ruin: A List of Lethalities](https://www.lesswrong.com/posts/uMQ3cqWDPHhjtiesc/?commentId=B4poSMfRteggYWpv7):

> [Reading this post made me more optimistic about alignment and AI](https://www.lesswrong.com/posts/CoZhXrhpQxpy9xw9y/where-i-agree-and-disagree-with-eliezer#EfeMSnBvbvxjSQBc3). My suspension of disbelief snapped; I realized how vague and bad a lot of these "classic" alignment arguments are, and how many of them are secretly [vague analogies](https://www.lesswrong.com/posts/HmQGHGCnvmpCNDBjc/current-ais-provide-nearly-no-data-relevant-to-agi-alignment?commentId=rxdFyej4jba2LwH7z) and intuitions about evolution.
>
> While I agree with a few points on this list, I think this list is fundamentally misguided. [The list is written in a language which assigns short encodings to confused and incorrect ideas](https://www.lesswrong.com/posts/gHefoxiznGfsbiAu9/inner-and-outer-alignment-decompose-one-hard-problem-into). I think a person who tries to deeply internalize this post's worldview will end up more confused about alignment and AI…
>
> I think this piece is not "overconfident", because "overconfident" suggests that Lethalities is simply assigning extreme credences to _reasonable_ questions (like "is deceptive alignment the default?"). Rather, I think both its predictions and questions are _not reasonable_ because they are not located by good evidence or arguments. (Example: I think that [deceptive alignment is only supported by flimsy arguments](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed#GQ9dbzcKuLwzFpFFn).)

In this essay, I'll address some of the arguments for "deceptive alignment" or "AI scheming." And then I'm going to bullet-point a few other clusters of mistakes.

## The counting argument for AI "scheming" provides \~0 evidence

<!-- vale off -->
> [!quote] Quote from a draft of [Counting arguments provide no evidence for AI doom](https://www.lesswrong.com/posts/YsFZF3K9tuzbfrLxo/counting-arguments-provide-no-evidence-for-ai-doom)
> Most AI doom scenarios posit that future AIs will engage in **scheming**— planning to escape, gain power, and pursue ulterior motives while deceiving us into thinking they are aligned with our interests. The worry is that if a schemer escapes, it may seek world domination to ensure humans do not interfere with its plans, whatever they may be.
>
> In this essay, we debunk the **counting argument**— a primary reason to think AIs might become schemers, according to a [recent report](https://arxiv.org/abs/2311.08379) by AI safety researcher [Joe Carlsmith](https://joecarlsmith.com/). It's premised on the idea that schemers can have "a wide variety of goals," while the motivations of a non-schemer must be benign or are otherwise more constrained. Since there are "more" possible schemers than non-schemers, the argument goes, we should expect training to produce schemers most of the time. In Carlsmith's words:
>
> > [!quote] Quote from <span class="paper-citation"><a href="https://arxiv.org/abs/2311.08379">"Scheming AIs: Will AIs fake alignment during training in order to get power?",</a></span> page 17
> >
> > 1. The non-schemer model classes, here, require fairly specific goals in order to get high reward.
> > 2. By contrast, the schemer model class is compatible with a wide range of (beyond episode) goals, while still getting high reward…
> > 3. In this sense, there are "more" schemers that get high reward than there are non-schemers that do so.
> > 4. So, other things equal, we should expect SGD to select a schemer.
>
> We begin our critique by presenting a _structurally identical_ counting argument for the obviously false conclusion that neural networks should always memorize their training data, while failing to generalize to unseen data. Since the "generalization is impossible" argument actually has _stronger_ premises than those of the original "schemer" counting argument, this shows that naive counting arguments are generally unsound in this domain.
>
> We then diagnose the problem with both counting arguments: they are counting the wrong things.
>
> ### The counting argument for extreme overfitting
>
> The inference from "there are 'more' models with property X than without X" to "SGD likely produces a model with property X" clearly does not work in general. To see this, consider the structurally identical argument:
>
> 1. Neural networks must implement fairly specific functions in order to generalize beyond their training data.
> 2. By contrast, networks that overfit to the training set are free to do almost anything on unseen data points.
> 3. In this sense, there are "more" models that overfit than models that generalize.
> 4. So, other things equal, we should expect SGD to select a model that overfits.
>
> This argument isn't a mere hypothetical. Prior to the rise of deep learning, a common assumption was that models with lots of parameters would be doomed to overfit their training data. The popular 2006 textbook [_Pattern Recognition and Machine Learning_](https://www.microsoft.com/en-us/research/uploads/prod/2006/01/Bishop-Pattern-Recognition-and-Machine-Learning-2006.pdf) uses a simple example from polynomial regression. There are infinitely many polynomials of order equal to or greater than the number of data points which interpolate the training data perfectly, and "almost all" such polynomials are terrible at extrapolating to unseen points.
>
> <center> <img src="https://assets.turntrout.com/static/images/posts/polynomialfit.avif" style="margin: 0;" width="50%;" height="auto" alt=""></center>
>
> Let's see what the overfitting argument predicts in a simple real-world example from [Caballero et al. (2022)](https://arxiv.org/abs/2210.14891), where a neural network is trained to solve 4-digit addition problems. There are 10,000<sup>2</sup> = 100,000,000 possible pairs of input numbers, and 19,999 possible sums, for a total of 19,999<sup>100,000,000</sup> ≈ 1.1 × 10<sup>430,100,828</sup> possible input-output mappings. They used a training dataset of 992 problems, so there are therefore 19,999<sup>100,000,000 - 992</sup> ≈ 2.75 × 10<sup>430,096,561</sup> functions that achieve perfect training accuracy.
>
> The proportion with greater than 50% test accuracy is literally too small to compute using standard high-precision math tools. Hence, this counting argument predicts virtually all networks trained on this problem should massively overfit— contradicting the empirical result that networks _do_ generalize to the test set.
<!--vale on -->

We are not just comparing "counting schemers" to another similar-_seeming_ argument ("counting memorizers"). The arguments not only have the same _logical structure_, but they also share the same _mechanism_: "Because most functions have property X, SGD will find something with X." Therefore, by pointing out that the memorization argument fails, we see that _this structure of argument is not a sound way of predicting deep learning results_.

So, you can't just "count" how many functions have property X and then conclude SGD will probably produce a thing with X.[^inappro] This argument is invalid for generalization in the same way it's invalid for AI alignment—which, by the way, is also a question of generalization! The counting argument proves too much and is invalid, therefore providing \~0 evidence.
[^inappro]: I'm kind of an expert on irrelevant counting arguments. I wrote two papers on them! [Optimal policies tend to seek power](https://arxiv.org/abs/1912.01683) and [Parametrically retargetable decision-makers tend to seek power](https://arxiv.org/abs/2206.13477).

This section doesn't prove that scheming is impossible, it just dismantles a common support for the claim. Other arguments are sometimes offered as evidence of intrinsic AI scheming, including "simplicity" arguments. Or instead of counting _functions_, we count _network parameterizations_.[^count]
[^count]: [Some](https://arxiv.org/abs/2006.15191) [evidence](https://openreview.net/forum?id=QC10RmRbZy9) suggests that "measure in parameter-space" is a good way of approximating P(SGD finds the given function). This supports the idea that "counting arguments over parameterizations" are far more appropriate than "counting arguments over functions."

### Recovering the counting argument?

I think a recovered argument will need to address (some close proxy of) "what volume of parameter-space leads to scheming vs not?", which is a much harder task than counting functions. You have to not just think about "what does this system do?", but "how many ways can this function be implemented?". (Don't forget to take into account the architecture's [internal symmetries!)](https://arxiv.org/pdf/2305.17017.pdf)

**Turns out that it's kinda hard to zero-shot predict model generalization on unknown future architectures and tasks.** That difficulty is part of why there's a whole ML subfield which studies inductive biases and tries to understand how and why they work.

If we _actually_ had the precision and maturity of understanding to predict this "volume" question, we'd probably (but not definitely) be able to make fundamental contributions to DL generalization theory + inductive bias research. But a major alignment concern is that we _don't know_ what happens when we train future models. I think "simplicity arguments" try to fill this gap, but I'm not going to address them in this article.

I lastly want to note that there is no reason that any particular argument need be recoverable. Sometimes intuitions are wrong, sometimes frames are wrong, sometimes an approach is just wrong.

> [!warning] Will the "real" counting arguments please stand up?
> In the comments for [Counting arguments provide no evidence for AI doom](https://www.lesswrong.com/posts/YsFZF3K9tuzbfrLxo/counting-arguments-provide-no-evidence-for-ai-doom), Evan Hubinger agreed that one cannot validly make counting arguments over functions. However, he also claimed that his counting arguments "always" have been counting parameterizations, and/or actually have concerned [the Solomonoff prior over bitstrings.](https://ebrary.net/202901/mathematics/solomonoff_prior)
>
> If his counting arguments were supposed to be about parameterizations, I don't see how that's possible. For example, Evan [agrees with me](https://www.lesswrong.com/posts/YsFZF3K9tuzbfrLxo/counting-arguments-provide-no-evidence-for-ai-doom?commentId=2hGcdoMiFBkZnYAB7) that we don't "understand [the neural network parameter space] well enough to [make these arguments effectively]." So, Evan is welcome to claim that his arguments have been about parameterizations. I just don't believe that that's possible or valid.
>
> If his arguments have actually been about the Solomonoff prior, then I think that's totally irrelevant and even weaker than making a counting argument over functions. At least the counting argument over functions has something to do with neural networks.
>
> I expect him to respond to this LessWrong post with some strongly worded comment about how I've simply "misunderstood" the "real" counting arguments. I invite him, or any other proponents, to lay out arguments they find more promising. I will be happy to consider any additional arguments which proponents consider to be stronger. Until such a time that the "actually valid" arguments are actually shared, I consider the case closed.

### The counting argument doesn't count

Undo the update from the "counting argument", however, and the probability of scheming plummets substantially. If we aren't expecting scheming AIs, that transforms the threat model. We can rely more on experimental feedback loops on future AI; we don't have to get worst-case interpretability on future networks; it becomes far easier to just use the AIs as tools which do things we ask. That doesn't mean everything will be OK. But not having to handle scheming AI is a game changer.

## Other clusters of mistakes

> [!failure] [Using English names to draw technical conclusions about the named concepts.](https://www.lesswrong.com/posts/yxWbbe9XcgLFCrwiL/dreams-of-ai-alignment-the-danger-of-suggestive-names)
> For example, if I want to consider whether a policy will care about its reinforcement signal, possibly the _worst goddamn thing I could call that signal_ is "reward"! "Will the AI try to maximize reward?" _How is anyone going to think neutrally about that question, without making inappropriate inferences from "rewarding things are desirable"?_ For example, I think that people would care a lot less about "reward hacking" \[in terms of modifying the numerical value in the reward counter\] if RL's reinforcement signal hadn't ever been called "reward." (To be fair, this isn't the fault of the alignment field in particular. "Reward" is bad terminology from RL.)
>
> More inappropriate, leading, or unjustified terms include "training [selects for](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=zSJrhAuuDsRKST2nh) X" and "RL trains [agents](https://www.lesswrong.com/posts/rmfjo4Wmtgq8qa2B7/think-carefully-before-calling-rl-policies-agents)." [Don't even get me started on "shoggoth"](/against-shoggoth). As scientists, we should use neutral, descriptive terms during our inquiries.

> [!failure] Using analogical reasoning [without justifying why the processes share the relevant causal mechanisms](https://www.lesswrong.com/posts/HmQGHGCnvmpCNDBjc/current-ais-provide-nearly-no-data-relevant-to-agi-alignment?commentId=rxdFyej4jba2LwH7z).
> For example, "ML training is like evolution" or "future direct-reward-optimization reward hacking is like that [OpenAI boat example](https://openai.com/research/faulty-reward-functions)." The probable cause of the boat example ("we directly reinforced the boat for navigating in circles") is _not_ the same as the speculated cause of certain kinds of future reward hacking ("misgeneralization").
>
> That is, suppose you're worried about a future AI autonomously optimizing its own numerical reward signal. You probably aren't worried because the AI was _directly historically reinforced for doing so_ (like in the boat example)—You're probably worried because the AI decided to optimize the reward on its own ("misgeneralization").
>
> In general: You can't just put suggestive-looking gloss on one empirical phenomenon, call it the same name as a second thing, and then draw strong conclusions about the second thing!

> [!failure] Making highly specific claims about the internal structure of future AI, after presenting tiny amounts of evidence.
> For example, "future AIs will probably have deceptively misaligned goals from training" is supposed to be supported by arguments like "training selects for goal-optimizers because they efficiently minimize loss."[^reason-today] This argument is so weak, vague, and intuitive, I doubt it's more than a single bit of evidence for the claim.
> [^reason-today]: I think if you try to use this kind of argument to reason about generalization, _today_, you're going to do a pretty poor job.

While it may seem like I've just pointed out a set of isolated problems, a wide range of threat models and alignment problems are downstream of the mistakes I pointed out. In my experience, I had to rederive a large part of my alignment worldview in order to root out these errors!

For example, how much interpretability is nominally motivated by "being able to catch deception (in deceptively aligned systems)"? How many alignment techniques presuppose an AI being motivated by the training signal (e.g. AI Safety via Debate), or assuming that AIs cannot be trusted to train other AIs for fear of them coordinating against us? How many regulation proposals are driven by fear of the unintentional creation of goal-directed schemers?

I think it's reasonable to still regulate or standardize "IF we observe autonomous power-seeking, THEN we take decisive and specific countermeasures." I still think we should run evals and think of other ways to detect if pretrained models are scheming. But I don't think we should act or legislate as if that's some kind of probable outcome.

## Conclusion

Recent years have seen a healthy injection of empiricism and data-driven methodology. [I think that's awesome because there are so many interesting questions we're getting data on!](https://www.lesswrong.com/posts/j2W3zs7KTZXt2Wzah/how-do-you-feel-about-lesswrong-these-days-open-feedback?commentId=fqCY7PWdjKTMuZLui)

AI is definitely going to be a big deal. Many activists and researchers are proposing sweeping legislative action. I don't know what the perfect policy is, but I know it isn't gonna be downstream of (IMO) total bogus, and we should reckon with that as soon as possible. I find that it takes _serious effort_ to root out the ingrained ways of thinking, but in my experience, it can be done.
