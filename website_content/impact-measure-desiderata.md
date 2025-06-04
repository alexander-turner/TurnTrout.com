---
permalink: impact-measure-desiderata
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/c2oM7qytRByv6ZFtz/impact-measure-desiderata
lw-is-question: 'false'
lw-posted-at: 2018-09-02T22:21:19.395000Z
lw-last-modification: 2020-07-31T23:58:42.318000Z
lw-curation-date: None
lw-frontpage-date: 2018-09-02T23:37:35.362000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 41
lw-base-score: 36
lw-vote-count: 11
af-base-score: 10
af-num-comments-on-upload: 38
publish: true
title: Impact Measure Desiderata
lw-latest-edit: 2020-07-31T23:58:43.318000Z
lw-is-linkpost: 'false'
tags:
  - impact-regularization
aliases:
  - impact-measure-desiderata
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2018-09-02 00:00:00
original_url: https://www.lesswrong.com/posts/c2oM7qytRByv6ZFtz/impact-measure-desiderata
skip_import: true
description: Desirable properties of impact measures for safe and beneficial AI development.
date_updated: 2025-06-03 22:57:00.423836
---







If we can penalize some quantity of "impact on the world", we can have unaligned agents whose impact - and thereby negative effect - is small.

The long-term goal of impact measure research is to find a measure which neatly captures our intuitive understanding of "impact", which doesn't have allow cheap workarounds, which doesn't fail in really weird ways, and so on. For example, when you really think through some existing approaches (like [whitelisting](/whitelisting-impact-measure)), [you see that the impact measure secretly also applies to things _humans_ do](/overcoming-clinginess-in-impact-measures).

No approaches to date meet these standards. What do we even require of an impact measure we hope to make safe for use with arbitrarily powerful agents?

> [!warning] Disclaimer
> I no longer endorse this way of grading impact measures. See instead [Reframing Impact](/reframing-impact).

# Desiderata

> [!example] Goal-Agnostic
> The measure should be compatible with any original goal, trading off impact with goal achievement in a principled, continuous fashion.
>
> _Example:_ Maximizing the reward minus impact.
>
> _Why:_ [Constraints](https://en.wikipedia.org/wiki/Constrained_optimization) seem too rigid for the general case.

> [!example] Value-agnostic
>
> The measure should be objective, and not [value-laden](https://arbital.com/p/value_laden/):
>
> > An intuitive human category, or other humanly intuitive quantity or fact, is _value-laden_ when it passes through human goals and desires, such that an agent couldn't reliably determine this intuitive category or quantity without knowing lots of complicated information about human goals and desires (and how to apply them to arrive at the intended concept).
>
> _Example:_ [Measuring what portion of initially accessible states are still accessible](https://vkrakovna.wordpress.com/2018/06/05/measuring-and-avoiding-side-effects-using-relative-reachability/) versus a neural network which takes two state representations and outputs a scalar representing how much "bad change" occurred.
>
> _Why:_ Strategically, impact measures are useful insofar as we suspect that value alignment will fail. If we substantially base our impact measure on some kind of value learning - you know, the thing that maybe fails - we're gonna have a bad time. While it's possible to only rely somewhat on a vaguely correct representation of human preferences, the extent to which this representation is incorrect is the (minimal) extent to which our measure is incorrect. Let's avoid shared points of failure, shall we?
>
> Practically, a robust value-sensitive impact measure is value-alignment complete, since an agent maximizing the negation of such a measure would be aligned (assuming the measure indicates which way is "good").

> [!example] Representation-agnostic
> The measure should be ontology-invariant.
>
> _Example:_ [Change in object identities](/whitelisting-impact-measure) versus \[some concept of impact which transcends any specific way of representing the world\].
>
> _Why:_ Suppose you represent your perceptions in one way, and calculate you had  $x$ impact on the world. Intuitively, if you represent your perceptions (or your guess at the current world state, or whatever) differently, but do the same things, you should calculate roughly the same impact for the same actions which had the same effects on the territory. In other words, the measure should be consistent across ways of viewing the world.

> [!example] Environment-agnostic
> The measure should work in any computable environment.
>
> _Example:_ Manually derived penalties tailored to a specific gridworld versus [information-theoretic empowerment](https://arxiv.org/abs/1606.06565).
>
> _Why:_ One imagines that there's a definition of "impact" on which we and aliens - or even intelligent automata living in a [Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) - would agree.

> [!example] Natural kind
> The measure should make sense - there should be a _click._ Its motivating concept should be universal and crisply defined.

> [!example] Apparently rational
> The measure's design should look reasonable, not requiring any "hacks".
>
> _Example:_ Achieving off-switch corrigibility by hard-coding the belief "I shouldn't stop humans from pressing the off-switch". Clearly, this is hilariously impossible to manually specify, but even if we could, doing so should make us uneasy.
>
> Roughly, "apparently rational" means that if we put ourselves in the agent's position, we could come up with a plausible story about why we're doing what we're doing. That is, the story shouldn't have anything like "and then I refer to this special part of my model which I'm inexplicably never allowed to update".
>
> _Why:_ If the design is "reasonable", then if the measure fails, it's more likely to do so gracefully.

> [!example] Scope sensitive
> The measure should penalize impact in proportion to its size.

> [!example] Reversibility sensitive
> The measure should penalize impact in proportion to its irreversibility.

> [!example] Corrigible
> The measure should not decrease corrigibility in any circumstance.

> [!example] Shutdown-safe
> The measure should penalize plans which would be high impact should the agent be disabled mid-execution.
>
> _Why:_ We may want to shut the agent down, which is tough if its plans are only low-impact if they're completed. Also, not having this property implies that the agent's plans are more likely to go awry if even one step doesn't pan out as expected. Do we really want "juggling bombs" to be "low impact", conditional on the juggler being good?

> [!example] No offsetting
> The measure should not incentivize artificially reducing impact by making the world more "like it (was / would have been)".
>
> _Example:_ [Krakovna et al.](https://arxiv.org/abs/1806.01186) describe a low impact agent which is rewarded for saving a vase from breaking. The agent saves the vase, and then places it back on the conveyor belt so as to "minimize" impact with respect to the original outcome:
>
> ![](https://assets.turntrout.com/static/images/posts/03b8i2s.avif)
>
> I call this _ex post_ offsetting. _Ex ante_ offsetting, on the other hand, consists of taking actions beforehand to build a device or set in motion a chain of events which essentially accomplishes _ex post_ offsetting. For example, a device requiring only the press of a button to activate could save the vase and then replace it, netting the agent the reward without requiring that the agent take further actions.
>
> Some have suggested that actions like "give someone a cancer cure which also kills them at the same time they would have died anyways" count as _ex ante_ offsetting. I'm not sure - this feels confused, because the downstream causal effects of actions don't seem cleanly separable, nor do I believe we _should_ separate them (more on that later). Also, how would an agent ever be able to do something like "build a self-driving car to take Bob to work" if each of the car's movements is penalized separately from the rest of the plan? This seems too restrictive. On the other hand, if we allow _ex ante_ offsetting in general, we basically get all of the downsides of _ex post_ offsetting, with the only impediment being extra paperwork.
>
> How "bad" the offsets are - and what _ex ante_ offsetting allows - seems to depend on the measure itself. The ideal would certainly be to define and robustly prevent this kind of thing, but perhaps we can also bound the amount of _ex ante_ offsetting that takes place to some safe level.
>
> There may also be other ways around this seemingly value-laden boundary. In any case, I'm still not sure what to do.

> [!example] Clinginess / Scapegoating Avoidance
> The measure should sidestep the [clinginess / scapegoating tradeoff](/overcoming-clinginess-in-impact-measures).
>
> _Example:_ A clingy agent might not only avoid breaking vases, but also stop people from breaking vases. A scapegoating agent would escape impact by modeling the autonomy of other agents, and then having those agents break vases for it.

> [!example] Predictably low-impact
>
> The measure should admit of a clear means, either theoretical or practical, of having high confidence in the maximum allowable impact - _before_ the agent is activated.
>
> _Why_: If we think that a measure robustly defines "impact" - but we aren't _sure_ how much impact it allows - that could turn out pretty embarrassing for us.

> [!example] Dynamic consistency
> The measure should be a part of what the agent _"wants"_ - there should be no incentive to circumvent it, and the agent should expect to later evaluate outcomes the same way it evaluates them presently. The measure should equally penalize the creation of high-impact successors.
>
> _Example:_ Most people's sleep preferences are dynamically inconsistent: one might wake up tired and wish for their later self to choose to go to bed early, even though they predictably end up wanting other things later.

> [!example] Plausibly efficient
> The measure should either be computable, or such that a sensible computable approximation is apparent. The measure should conceivably require only reasonable overhead in the limit of future research.

> [!example] Robust
> The measure should meaningfully penalize any objectively impactful action. Confidence in the measure's safety should not require exhaustively enumerating failure modes.
>
> _Example:_ "Suppose there's some way of gaming the impact measure, but because of  $X$, $Y$, and $Z$, we know this is penalized as well".

# Previous Proposals

[Krakovna et al. propose four desiderata](https://arxiv.org/abs/1806.01186):

> [!quote]
>
> 1) Penalize the agent for effects on the environment if and only if those effects are unnecessary for achieving the objective.
>
> 2) Distinguish between agent effects and environment effects, and only penalize the agent for the former but not the latter.
>
> 3) Give a higher penalty for irreversible effects than for reversible effects.
>
> 4) The penalty should accumulate when more irreversible effects occur.

First, notice that my list points at some abstract amount-of-impact, while the above proposal focuses on specific effects.

- Thinking in terms of "effects" seems like a subtle map/territory confusion. That is, it seems highly unlikely that there exists a robust, value-agnostic means of detecting "effects" that makes sense across representations and environments.
- [Overcoming Clinginess in Impact Measures](/overcoming-clinginess-in-impact-measures) suggests that penalizing impact based on the world state necessitates a value-laden tradeoff.

I left out 1), as I believe that the desired benefit will naturally follow from an approach satisfying my proposed desiderata.

- What does it mean for an effect to be "necessary" for achieving the objective, which might be a reward function? This seems to shove much of the difficulty into the word "necessary", where anything not "necessary" is perhaps something occurring from optimizing the reward function harder than we'd prefer.

I _de facto_ included 2) via the non-clingy desideratum, while 3) and 4) are captured by scope- and irreversibility-sensitivity.

I think that we can meet all of the properties I listed, and I welcome thoughts on whether any should be added or removed.

> [!thanks]
>Thanks to Abram Demski for the "Apparently Rational" desideratum.
