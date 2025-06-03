---
permalink: excitement-about-impact-measures
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/wAAvP8RG6EwzCvHJy/reasons-for-excitement-about-impact-of-impact-measure
lw-is-question: 'false'
lw-posted-at: 2020-02-27T21:42:18.903000Z
lw-last-modification: 2020-09-16T18:14:18.398000Z
lw-curation-date: None
lw-frontpage-date: 2020-02-27T22:06:54.152000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 8
lw-base-score: 33
lw-vote-count: 12
af-base-score: 13
af-num-comments-on-upload: 8
publish: true
title: Reasons for Excitement about Impact of Impact Measure Research
lw-latest-edit: 2020-09-16T18:14:18.659000Z
lw-is-linkpost: 'false'
tags:
  - impact-regularization
  - AI
aliases:
  - reasons-for-excitement-about-impact-of-impact-measure
lw-sequence-title: Reframing Impact
lw-sequence-image-grid: sequencesgrid/izfzehxanx48hvf10lnl
lw-sequence-image-banner: sequences/zpia9omq0zfhpeyshvev
sequence-link: posts#reframing-impact
prev-post-slug: attainable-utility-preservation-scaling-to-superhuman
prev-post-title: 'Attainable Utility Preservation: Scaling to Superhuman'
next-post-slug: conclusion-to-reframing-impact
next-post-title: Conclusion to 'Reframing Impact'
lw-reward-post-warning: 'true'
use-full-width-images: 'false'
date_published: 2020-02-27 00:00:00
original_url: https://www.lesswrong.com/posts/wAAvP8RG6EwzCvHJy/reasons-for-excitement-about-impact-of-impact-measure
skip_import: true
description: Impact measure research deconfuses power-seeking incentives in AI, aiding
  alignment efforts.
date_updated: 2025-01-30 09:30:36.233182
---





Can we get impact measurement _right_? Does there exist One Equation To Rule Them All?

I think there’s a decent chance there _isn’t_ a simple airtight way to implement AUP which lines up with AUP<sub>conceptual</sub> , mostly because it’s just incredibly difficult in general to perfectly specify the reward function.

Reasons why it might be feasible: we’re trying to get the agent to do the goal without it becoming more able to do the goal, which is [conceptually simple and natural](/attainable-utility-preservation-concepts); since we’ve been able to handle previous problems with AUP with clever design choice modifications, it’s plausible we can do the same for all future problems; since [there are a lot of ways to measure power due to instrumental convergence](/seeking-power-is-often-convergently-instrumental-in-mdps), that increases the chance at least one of them will work; intuitively, this sounds like the kind of thing which could work (if you told me “you can build superintelligent agents which don’t try to seek power by penalizing them for becoming more able to achieve their own goal”, I wouldn’t exactly die of shock).

Even so, I am (perhaps surprisingly) not that excited about _actually using_ impact measures to restrain advanced AI systems. Let’s review some concerns I provided in [_Reasons for Pessimism about Impact of Impact Measures_](/best-reasons-for-pessimism-about-impact-measures):

- Competitive and social pressures incentivize people to cut corners on safety measures, especially those which add overhead. Especially so for training time, assuming the designers slowly increase aggressiveness until they get a reasonable policy.
- In a world where we know how to build powerful AI but not how to align it (which is actually probably the scenario in which impact measures do the most work), we play an unfavorable game while we use low-impact agents to somehow transition to a stable, good future: the first person to set the aggressiveness too high, or to discard the impact measure entirely, ends the game.
- In a [_What Failure Looks Like_](https://www.lesswrong.com/posts/HBxe6wdjxK239zajf/more-realistic-tales-of-doom)-esque scenario, it isn't clear how impact-limiting any single agent helps prevent the world from "gradually drifting off the rails".

You might therefore wonder why I’m working on impact measurement.

# Deconfusion

Within Matthew Barnett’s [breakdown of how impact measures could help with alignment](https://www.lesswrong.com/posts/wJK944YqvFwjdbqCP/four-ways-an-impact-measure-could-help-alignment), I'm most excited about _impact measure research as deconfusion_.

> [!quote] [MIRI's 2018 update](https://intelligence.org/2018/11/22/2018-update-our-new-research-directions/)
>
> By deconfusion, I mean something like “making it so that you can think about a given topic without continuously accidentally spouting nonsense.”
>
> To give a concrete example, my thoughts about infinity as a 10-year-old were made of rearranged confusion rather than of anything coherent, as were the thoughts of even the best mathematicians from 1700. “How can 8 plus infinity still be infinity? What happens if we subtract infinity from both sides of the equation?” But my thoughts about infinity as a 20-year-old were not similarly confused, because, by then, I’d been exposed to the more coherent concepts that later mathematicians labored to produce. I wasn’t as smart or as good of a mathematician as Georg Cantor or the best mathematicians from 1700; but deconfusion can be transferred between people; and this transfer can spread the ability to think actually coherent thoughts.
>
> In 1998, conversations about AI risk and technological singularity scenarios often went in circles in a funny sort of way. People who are serious thinkers about the topic today, including my colleagues Eliezer and Anna, said things that today sound confused. (When I say “things that sound confused,” I have in mind things like “isn’t intelligence an incoherent concept,” “but the economy’s already superintelligent,” “if a superhuman AI is smart enough that it could kill us, it’ll also be smart enough to see that that isn’t what the good thing to do is, so we’ll be fine,” “we’re Turing-complete, so it’s impossible to have something dangerously smarter than us, because Turing-complete computations can emulate anything,” and “anyhow, we could just unplug it.”) Today, these conversations are different. In between, folks worked to make themselves and others less fundamentally confused about these topics—so that today, a 14-year-old who wants to skip to the end of all that incoherence can just pick up a copy of Nick Bostrom’s Superintelligence.

Similarly, suppose you’re considering the unimportant and trivial question of whether seeking power is convergently instrumental, which we can now crisply state as "do most reward functions induce optimal policies which take over the planet (more formally, which visit states with high POWER)?".

You’re a bit confused if you argue in the negative by saying “you’re anthropomorphizing; chimpanzees don’t try to do that” (chimpanzees aren’t optimal) or “the set of reward functions which does this has measure 0, so we’ll be fine” (for any reachable state, there exists a positive measure set of reward functions for which visiting it is optimal).

You’re a bit confused if you argue in the affirmative by saying “unintelligent animals fail to gain resources and die; intelligent animals gain resources and thrive. Therefore, since we are talking about _really_ intelligent agents, of course they’ll gain resources and avoid correction.” (animals aren’t optimal, and evolutionary selection pressures narrow down the space of possible “goals” they could be effectively optimizing).

After reading this paper on the formal roots of instrumental convergence, instead of arguing about whether chimpanzees are representative of power-seeking behavior, we can just discuss how, under an agreed-upon reward function distribution, optimal action is likely to flow through the future of our world. We can think about to what extent the paper's implications apply to more realistic reward function distributions (which don't identically distribute reward over states).[^1] Since we’re less confused, our discourse doesn’t have to be crazy.

As a further benefit, since we’re less confused, the privacy of our own minds doesn’t have to be crazy. It's not that I think that any single fact or insight or theorem downstream of my work on AUP is _totally obviously necessary_ to solve AI alignment. But it sure seems good that we can [mechanistically understand instrumental convergence and power](/seeking-power-is-often-convergently-instrumental-in-mdps), [know what “impact” means](/attainable-utility-theory) [instead of thinking it’s mostly about physical change to the world](/world-state-is-the-wrong-abstraction-for-impact), [think about how agents affect each other](/attainable-utility-landscape), and [conjecture why goal-directedness seems to lead to doom by default](/the-catastrophic-convergence-conjecture).[^2]

Attempting to iron out flaws from our [current-best AUP equation](/attainable-utility-preservation-scaling-to-superhuman) makes one intimately familiar with how and why power-seeking incentives can sneak in even when you’re trying to keep them out [in the conceptually correct way](/attainable-utility-preservation-concepts). This point is harder for me to articulate, but I think there’s something vaguely important in understanding how this works.

Formalizing instrumental convergence [also highlighted a significant hole](/attainable-utility-landscape) in our theoretical understanding of the main formalism of reinforcement learning. And if you told me two years ago that you could [possibly solve side-effect avoidance](/attainable-utility-preservation-empirical-results) in the short-term with one simple trick (“just preserve your ability to optimize a single random reward function, lol”), I’d have thought you were _nuts_. Clearly, there’s something wrong with our models of reinforcement learning environments if these results are so surprising.

In my opinion, research on AUP has yielded an unusually high rate of deconfusion and insights, probably because we’re thinking about what it means for the agent to interact with us.

<hr/>

[^1]: When combined with [our empirical knowledge of the difficulty of reward function specification](https://vkrakovna.wordpress.com/2018/04/02/specification-gaming-examples-in-ai/), you might begin to suspect that there are lots of ways the agent might be incentivized to gain control, many openings through which power-seeking incentives can permeate – and your reward function would have to penalize all of these! If you were initially skeptical, this might make you think that power-seeking behavior may be more difficult to avoid than you initially thought.

[^2]: If we collectively think more and end up agreeing that AUP<sub>conceptual</sub> solves impact measurement, it would be interesting that you could solve such a complex, messy-looking problem in such a simple way. If, however, [CCC](/the-catastrophic-convergence-conjecture) ends up being false, I think that would also be a new and interesting fact not currently predicted by our models of alignment failure modes.
