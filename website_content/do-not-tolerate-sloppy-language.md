---
title: '"Sloppy" language is as bad as making wrong claims'
permalink: do-not-tolerate-sloppy-language
no_dropcap: false
tags:
  - critique
  - practical
description: "Misleading communication hurts intellectual progress. Do not excuse it." 
authors: Alex Turner
hideSubscriptionLinks: false
card_image: 
aliases:
  - sloppy-language
  - sloppy
---
The next time someone defends a wrong argument by calling it “sloppy”, remember: sloppiness and wrongness have similar consequences.

–-

Sometimes people are confused. Sometimes those confused people are even famous.  When confused folks pollute a discussion with wrong claims, they make it harder for everyone else. They make it harder to think and harder to orient around shared truth. So making wrong claims is bad and should be discouraged.

Often, though, I hear an acknowledgment that a claim (e.g. "RL definitionally creates reward maximizers") is wrong, but that a claimant is simply communicating poorly - by being "sloppy" with their language. I claim that this "sloppiness" excuse is harmful.

> [!quote] [Bengio et al.'s "Scientist AI" proposal](https://arxiv.org/abs/2502.15657) (section 2.4.5)
> **Optimality of reward tampering.** We now make the argument that reward tempering is not merely a fantastical scenario that we must guard against (although it certainly appears that way), but also a uniquely rational solution for an agent that takes reward maximization seriously. Before we begin, it is important to note that once an RL agent is train it continues trying to act so as to maximize the rewards it anticipates would come based on its training, even if the rewards actually never come in deployment. If it has a good model of the world and sufficient reasoning abilities, it can generalize from the circumstances in which it received large rewards in the past to new circumstances, by reasoning about the consequences of its actions.

I think the authors are wrong about how reinforcement learning works, as I have [discussed](/reward-is-not-the-optimization-target) [at](/dreams-of-alignment) [length](/invalid-ai-risk-arguments#tracing-back-historical-arguments). I won't rehash those arguments.  Here's why the "sloppy" explanation bothers me.

I forwarded this excerpt to a friend who claimed that Bengio et al. were just using "sloppy language":

> [!quote]
> Bengio et al. mix up "the policy/AI/agent is trained with RL and gets a high (maximal?) score on the training distribution" and "the policy/AI/agent is trained such that it wants to maximize reward (or some correlates) even outside of training".

My friend said that Bengio et al. probably accidentally communicated the latter instead of the former - that they were "sloppy." This is the exact intellectual move I want to examine. Let's grant, for the sake of argument, that my friend and I are correct that as written, Bengio et al. would be wrong to make the “accidental” (and perhaps unintentional) claim about reward tampering. The critical issue is what comes next. Is the "they were just being sloppy" defense a kind, charitable, or harmless act? I argue it is the opposite.

> [!warning] My point stands regardless of what you think about alignment
> While I illustrate the phenomenon by pointing to Bengio et al., the point doesn't _depend_ on that example. I don't care whether you disagree with everything I've ever written. My point is about intellectual standards - not about AI alignment itself.

# Wrong claims and "sloppy" language have similar impact

If some readers understand the "sloppy" language to advocate the wrong claim, then they have made the same belief update they would have if the author _had_ meant to advocate the wrong claim. After all, the writer's intent stopped mattering the moment that editing ended and that publication began. All that matters is how a text impinges on the reader's understanding of the world.

> [!idea] Key insight
> The reader’s mind does not know whether someone meant to miscommunicate an incorrect claim. All they read is the claim as written and understood. Therefore, wrong claims and “sloppy” language have similar impact.

True, perhaps "sloppy" language is only misinterpreted as the wrong claim e.g. 40% of the time - which is better than 100%. If so, 40% of the costs are still present and so cause 40% of the impact. Possibly _more_ than 40% of the cost, as a sloppier epistemic environment yields a sloppier next generation of thinkers.

> [!question]- Do context clues help?
> Yes, but not enough. If e.g. Yoshua's (secretly) correct argument needs to be guessed by knowing special background knowledge about what 'sloppy language' is supposed to mean - then context clues have _already failed._

Suppose we agreed that Bengio et al. made a flatly wrong argument (roughly, "RL is bad by definition"). We agree that being wrong is bad. Emitting a wrong argument into the social atmosphere is bad not just because Bengio et al. are personally confused about how this aspect of reinforcement learning works, but because of how those emissions affect people.

Real people change their real minds based on these fake claims. Many folks reallocate hundreds of hours of their professional lives to new problems. I was one of those folks. Since I was misled and confused during my PhD, I spent [thousands of hours on proving "power-seeking" theorems for reward-maximizing agents.](/seeking-power-is-often-convergently-instrumental-in-mdps)

Making wrong or invalid claims from a position of fame - that has bad effects called "external costs." To discourage these costs, we tax or punish them. I'm not talking about anything crazy or weird here, just the usual price (a reputational hit).

But since "sloppy" language has _the same_ external costs, logically we should also apply reputational hits for unclarified sloppy language. If someone keeps saying weird stuff, and then they or others retreat to "it was just sloppiness", then that person takes a hit in my book.

# It is not kind to tolerate sloppiness

I fear that my friend shirks from the perceived arrogance of declaring "yes, Yoshua got this one wrong" or "even if they were being sloppy, that was bad." Is there not a diversity of opinions in an intellectually vibrant community? Is it not kinder to default to charitable interpretation, given the difficulty of communication?

Tolerating sloppiness is like "tolerating" muddy folks traipsing around your clean white carpet. You are allowed to have standards. This standard I propose is rather low, in fact: "don't repeatedly use language which is - at best - [known to be misleading](/invalid-ai-risk-arguments#tracing-back-historical-arguments)".

True, being called out on sloppy language can be stressful and feel confrontational. But think about the browned carpet. Think about your _mind_ and how that mind is (slightly) polluted by these low standards and "charitable" assumptions. By justifying an author's "sloppiness", we dull the meaning of English and erode our commitment to truth-seeking and precision.

Remember, we aren't discussing whether Bengio et al. (the human beings) are bad. We are discussing whether the _claim_ is bad. Avoiding calling out a bad claim - or a text which reliably communicates a bad claim - is not kind, it is dangerous. The text will continue damaging communal understanding of the world - especially the pliable understandings of new thinkers who do not know the correct real claim intended to be communicated by the "sloppy" language.

# Dishonest actors can hide behind “sloppiness”

If someone gets called out for giving a wrong argument, they might dishonestly protest that they were just speaking “sloppily.” What an elegant defense - unfalsifiable, effective, and costless. Well, no more.

# Possible objections

Come on, 'Trout, you're nitpicking. Why can't people use shorthand?
: If you prominently and clearly define your "sloppy" shorthand _first_, then fine, that helps a lot. I'm not against shorthand, I'm against _excusing undefined shorthand which straightforwardly reads as being wrong_.

Well, I don't want people to be afraid of minor miscommunications...
: The appropriate response to a minor imprecision is far different from the response to a grossly misleading statement. From my point of view, the Bengio et al. citation is - at best - a grossly misleading paragraph whose thrust is repeated throughout the paper.

: If someone communicates a major idea poorly, that's not the end of their career. They should just acknowledge the mistake and move on. Everyone makes mistakes.

But what about shortform communication like Twitter?
: I deny the premise that you can't speak clearly within limited characters. You at least shouldn't waste characters on language that is known to be "sloppy." Do your best - take a minute to think. Do you truly have no alternatives of which to avail yourself?

: If - and that's an _if_ - you really _did_ have such a constraint, then you have a tradeoff to make. Do you value clear communication or rhetorical impact?

# Conclusion

Making wrong claims is bad. I argued that using "sloppy" language is similarly bad. Regardless of the author's intent, the result is the same: a polluted information ecosystem with a degraded collective ability to think clearly and orient around shared truth.

Do not mistake politeness for kindness. While it may _feel_ kind to offer a charitable interpretation of a sloppy claim, this choice prioritizes individual comfort over collective progress. I want to protect the clarity of our shared discourse, especially for those just entering the field who are most vulnerable to being misled. Each excuse of sloppiness is a fresh failure to hold our peers - and ourselves - to the standards necessary for making real progress.

So when you encounter an argument that relies on "sloppy" language, resist the urge to invent a charitable interpretation that the text itself does not support. Instead, grow an intolerance for the kind of ambiguity that poisons discussion. Hold yourself to a standard of clarity. Believe in others enough to expect clarity from them as well. Protect against whatever dishonest actors beg ignorant communication instead of admitting they were wrong.

Be kind and true in your dealings, but do not sacrifice a clear mind in defense of an unclear argument.

# Appendix: Sloppiness is evidence of misunderstanding

From a purely logical standpoint, what is the most likely cause of such misleading language?

I think that people pull out the "sloppiness" excuse to avoid changing their mind in an uncomfortable way. Generally, people pull out the "sloppy" explanation for either themselves or someone politically allied with them. But the laws of Lady Probability are the same as ever.

$$
P(\text{misleading explanation} \mid \text{Bengio is confused}) > P(\text{misleading explanation} \mid \text{Bengio understands}).
$$

Simply put, "this person is genuinely confused" is a more straightforward explanation for confusing language than "this person understands the topic but has chosen to write about it in a misleading way". Often, repeated "sloppiness" is simply the smoke that reveals the fire of genuine confusion.
