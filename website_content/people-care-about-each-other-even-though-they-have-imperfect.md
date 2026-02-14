---
permalink: humane-values-despite-imperfections
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/heXcGuJqbx3HBmero/people-care-about-each-other-even-though-they-have-imperfect
lw-is-question: 'false'
lw-posted-at: 2022-11-08T18:15:32.023000Z
lw-last-modification: 2022-11-21T21:18:42.103000Z
lw-curation-date: None
lw-frontpage-date: 2022-11-08T18:37:26.094000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 25
lw-base-score: 33
lw-vote-count: 17
af-base-score: 19
af-num-comments-on-upload: 5
title: People care about each other even though they have imperfect motivational pointers?
lw-latest-edit: 2022-11-08T18:30:04.445000Z
lw-is-linkpost: 'false'
tags:
  - corrigibility
  - AI
aliases:
  - people-care-about-each-other-even-though-they-have-imperfect
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2022-11-08 00:00:00
original_url: 
  https://www.lesswrong.com/posts/heXcGuJqbx3HBmero/people-care-about-each-other-even-though-they-have-imperfect
skip_import: true
description: Imperfect human values like familial love seem to contradict AI alignment
  arguments about Goodhart's Curse.
date_updated: 2025-11-22 00:21:52.667251
---









> [!warning]
> I wrote this essay in early August of 2022. I now consider the presentation to be somewhat confused, and now better understand where problems arise within the "standard alignment model." I'm publishing a somewhat edited version, on the grounds that something is better than nothing.

Consider the argument: "Imperfect value representations will, in the limit of optimization power, be optimized into oblivion by the true goal we really wanted the AI to optimize." But... I think my brother cares about me in some human and "imperfect" way. I also think that the future would contain _lots_ of value for me if he were a superintelligent dictator (this could be quite bad for other reasons, of course).

Therefore, this argument seems to prove too much. It seems like one of the following must be true:

1. My brother cares about me in the "perfect" way, or
2. Dictator-brother would do valueless things according to my true values, or
3. The argument is wrong.

To explore these points, I dialogue with my model of Eliezer.

# Goodhart's Curse

Suppose you win a raffle and get to choose one of $n$ prizes. The first prize is a book with true value 10, but your evaluation of it is noisy (drawn from the Gaussian $\mathcal{N}(10,1)$ with standard deviation 1). The other $n-1$ prizes are widgets with true value 1, but your evaluation is more noisy (drawn from $\mathcal{N}(1,16)$ with standard deviation 4). As _n_ increases, you’re more probable to select a widget and lose out on $10-1=9$ utility. By considering so many options, you’re selecting against your own ability to judge prizes by implicitly selecting for high noise. You end up “optimizing so hard” that you delude yourself -  the _Optimizer’s Curse_.

You’re probably already familiar with Goodhart’s Law, which applies when an agent optimizes a proxy _U_ (e.g. how many nails are produced) for the true quantity _V_ which we value (e.g. how profitable the nail factory is).

[Goodhart’s Curse](https://arbital.com/p/goodharts_curse/) is their combination. According to the article, optimizing a proxy measure _U_ over a trillion plans can lead to high regret under the true values _V,_ even if _U_ is an unbiased but noisy estimator of the true values _V_. This seems like bad news, insofar as it suggests that even getting an AI which understands human values _on average across possibilities_ can still produce bad outcomes.

Below is a dialogue with my model of Eliezer. I wrote the dialogue to help me think about the question at hand. I put in work to model his counterarguments, but ultimately make no claim to have written him in a way he would endorse.

# Dialogue with my model of Eliezer

> [!quote] [Goodhart’s Curse](https://arbital.com/p/goodharts_curse/)
>
> An obvious next question is "Why not just define the AI such that the AI itself regards $U$ \[a proxy measure\] as an estimate of $V$ \[true human values\], causing the AI's \[proxy measure\] to more closely align with \[true human values\] as the AI gets a more accurate empirical picture of the world?"
>
> Reply: Of course this is the obvious thing that we'd _want_ to do. But what if we make an error in exactly how we define "treat $U$ as an estimate of $V$"? Goodhart's Curse will magnify and blow up any error in this definition as well.

Alex
: Suppose that I can get smarter over time—that AGI just doesn’t happen, that the march of reason continues, that lifespans extend, and that I therefore gradually become quite old and quite smart.[^1] Goodhart’s Curse predicts that—even though I _think_ I want to help my brother be happy, even though I _think_ I value his having a good life by his own values—my desire to help him is _not “error-free”, it is not perfect_, and so Goodhart’s Curse will magnify and blow up these errors. And time unfolds, the Curse is realized, and I bring about a future which is high-regret by his “true values” $V$.[^2] Insofar as Goodhart’s Curse has teeth as an argument for AI risk, it seems to predict that my brother will deeply regret my optimization.

  This prediction seems flatly wrong: I wouldn’t bring about an outcome like that. Why do I believe that? Because I have reasonably high-fidelity access to my _own policy_, via imagining myself in the relevant situations. I have information about whether I would e.g. improve myself such that "improved" Alex screws over his brother. I simply imagine being faced with the choice, and through my imagination, I realize I wouldn't want to improve myself that way.

**Alex’s model of Eliezer**
:
: What a shocking observation—humans pursue human values, like helping their relatives.

**Alex**
:
: The point is not that I value what I value. The point is that, based on introspective evidence, I value my brother achieving _his_ values. If it’s really so difficult to point to what other agents want, why should my pointer to his values be so “robust” (whatever that means)?

**Alex's model of Eliezer**
: This is surprising _why_? Kin cooperation was heavily selected for in the ancestral environment. You, peering out from inside of your own human mind, perceive the _apparent simplicity_ of caring about your brother, because that’s a thing your brain was natively built to do. You do not appreciate the generations upon generations of selection pressure which accreted complex and fine-tuned genetic machinery into your source code.

**Alex**
: Indeed. And even though evolution couldn’t get us to value inclusive genetic fitness, evolution _somehow_ found an adaptation for caring about kin, such that this caring generalizes off-distribution into the radically different modern environment, such that Goodhart’s Curse will be unable to drastically blow up the way I care for my brother, because I care about my brother’s preferences in the requisite “error-free” way.

  That doesn’t sound like a thing which happens in reality. Seems more likely that the Curse doesn’t have the alignment implications which I perceive you to be claiming (e.g. that imperfect motivations get Goodharted to oblivion in the limit).

**Alex's model of Eliezer**
: What’s your point? Suppose I agreed that you are not currently falling victim to Goodhart’s Curse, at least in the sense of not bringing about outcomes your brother strongly disvalues. What next?

**Alex**
: The point isn’t that I’m avoiding Goodhart’s Curse _right now._ I’m further claiming I won’t self-improve into an entity which (foreseeably to my current self) breaks the “I care about my brother” invariant. Therefore, insofar as I can become more intelligent, I will self-improve into an entity which doesn’t bring about horrible outcomes for my brother.

  (And yes, if I considered a trillion zillion plans for improving myself and assigned each one a rating—a rather foolish procedure, all things considered—the highest-rated plan wouldn’t be the actually best plan. The [optimizer’s curse](https://arbital.com/p/goodharts_curse/) applies. Furthermore, the highest-rated plan might be _worse than doing nothing_, insofar as I consider plans which my search implicitly optimizes to look deceptively good to me. Since I already know that that decision-making procedure sucks, I just won’t use that procedure.)

  This smarter version of myself poses a problem to certain implications of Goodhart’s Curse. You claim that it’s really hard to point AI to care about other entities’ values. But if we look at _actual reality_, at the one empirical example ever of general intelligence, there are literally billions of examples of those intelligences caring about each other every day. And, speaking for myself, _I_ wouldn’t do something stupid like “consider a zillion plans and then choose the best one, with the foreseeable result of screwing over my brother due to my imperfect pointer to his values.”

**Alex's model of Eliezer**
: Why do you keep saying that humans care about each other? _Of_ _course_ humans care about each other.

**Alex**
: Oh? And why’s that?

**Alex's model of Eliezer**
: Because it was selected for. Heard of evolution?

**Alex**
: That’s not an explanation for _why_ the mechanism works, that’s an explanation of how the mechanism _got there_. It’s like if I said “How can your car possibly be so fast?” and you said “_Of course_ my car is fast, I just went to the shop. If they hadn’t made my car go faster, they’d probably be a bad shop, and would have gone out of business.”

**Alex's model of Eliezer**
: Sure. I don’t know _why_ the mechanism works, and we probably won’t figure it out before DeepAI kills everyone. As a corollary, you don’t understand the mechanism either. So what are we debating?

**Alex**
: I disagree with your forecast, but that’s beside the point. The point is that, by your own writing (as of several years ago), Goodhart’s Curse predicts that “imperfect” pointing procedures will produce optimization which is strongly disvalued by the preferences which were supposed to be pointed to. However, back in actual reality, introspective evidence indicates that I _wouldn’t_ do that. From this I infer that some step of the Curse is either locally invalid, wrongly framed, or inapplicable to the one example of general intelligence we’ve ever seen.

**Alex's model of Eliezer**
: As I stated in the original article, [mild optimization](https://arbital.com/p/soft_optimizer/) seemed (back in the day) like a possible workaround. That is, humans don’t do powerful enough search to realize the really bad forms of the Curse.

**Alex**
: I do not feel less confused after hearing your explanation. You say phrases like “powerful enough search” and “mild optimization.” But what do those phrases _mean_? How do I know that I’m even trying to explain something which really exists, or which will probably exist—that unless we get “mild optimizers”, we will hit “agents doing powerful search” such that “imperfections get blown up”? Why should I believe that Goodhart’s Curse has the implications you claim, when the “Curse” seems like a nothingburger in real life as it applies to me and my brother?

**Alex's model of Eliezer**
: \[Sighs\] We have now entered the foreseeable part of the conversation where my interlocutor fails to understand how intelligence works. You peer out from your human condition, from the messy heuristics which chain into each other, and fail to realize the utter dissimilarity of AI. Of how Utility will sharpen and unify messy heuristics into coherence, pulling together disparate strands of cognition into a more efficient whole. You introspect upon your messy and kludgy human experience and, having lived nothing else, expect the same from AI.

  AI will not be like you. AI will not think like you do. AI will not value like you do. I don’t know why this is so hard for people to understand.

**Alex**
: Ad hominem and appeal to your own authority without making specific counterarguments against my point. Also, “humans are a mess” is not an actual explanation but a profession of ignorance (more precisely, a hypothesis class containing a range of high-complexity hypotheses), nor does that statement explain how your Goodhart’s Curse arguments shouldn’t blow up my ability to successfully care about my brother.

  Let’s get back to the substance: I’m claiming that your theory makes an introspectively apparent-to-me misprediction. You’re saying that your theory doesn’t apply to this situation, for reasons which I don’t currently understand and which have not been explained to my satisfaction. I'm currently inclined to conclude that the misprediction-generator (i.e. "value pointers must be perfect else shattering of all true value") is significantly less likely to apply to real-world agents. (And that insofar as this is a hole in your argument which no one else noticed, there are probably more holes in other alignment arguments.)

**Alex's model of Eliezer**
: \[I don’t really know what he’d say here\]

<hr/>

Again, I wrote this dialogue to help me think about the issue. It seems to me like there's a real problem here with arguments like "Imperfect motivations get Goodharted into oblivion." Seems just wrong in many cases. See also Katja's recent post section "[Small differences in utility functions may not be catastrophic](https://www.lesswrong.com/posts/LDRQ5Zfqwi8GjzPYG/?commentId=p7T4GWJ4W87rnwjbj#Small_differences_in_utility_functions_may_not_be_catastrophic)."

> [!thanks]
> Thanks to Abram Demski and others for comments on a draft of this post.

[^1]: When I first wrote this dialogue, I may have swept difficulties under the rug like "[augmenting intelligence may be hard for biological humans to do while preserving their values](https://www.lesswrong.com/posts/EQkELCGiGQwvrrp3L/growing-up-is-hard)." I think the main point should still stand.
[^2]: We can also swap out "I bring about a good future for my brother" with "my brother brings about a good future for me, and I think that he will do a good job of it, even though he presumably doesn't contain a 'perfect' motivational pointer to my true values."
