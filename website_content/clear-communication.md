---
title: Authorial Responsibility and the "Sloppy Language" Gambit
permalink: authorial-responsibility-and-the-sloppy-language-gambit
no_dropcap: false
tags:
  - critique
  - practical
description: Misleading communication hurts intellectual progress. Do not excuse it.
authors: Alex Turner
hideSubscriptionLinks: false
card_image: 
aliases:
  - sloppy-language
  - sloppy
  - authorial-responsibility
---

 
When a claim is shown to be incorrect, defenders may retreat to the excuse that the author was just being “sloppy” and actually meant something else entirely. This move is not harmless, charitable, or healthy. At best, this move reduces an author’s incentive to express themselves clearly – they can freely clarify later! – while burdening the reader with finding the “right” interpretation of the author’s words. At worst, this move is a dishonest defensive tactic which shields the author with the unfalsifiable question of what the author “really” meant.

> [!warning] What this essay is not about
>
> The context for this essay is serious, high-stakes communication: papers, technical blog posts, and tweet threads.
>
> This essay does not ask that authors pre-emptively defend themselves against all possible misinterpretations of their words. That’s impossible. Furthermore, misunderstanding is a natural part of the relationship between a writer and their readers – I myself am certainly not above such things!
>
> I criticize the _specific conversational move_ which occurs when someone refuses to say “yes, I meant that other thing; sorry for the miscommunication” and instead uses the excuse of “I was right but you simply misunderstood me.” While it’s possible for someone to intend a correct claim which they then miscommunicate, if a good-faith reader (of the target audience) misunderstands the claim, then I think the author should take some responsibility.
>
> In particular, do not give someone “full points” for e.g. such a poorly communicated prediction, unless you want to actively incentivize vague writing which is hard to pin down.

# A case study of the “sloppy language” defense

To see this defensive move in action, let’s consider a recent example from a proposal by Bengio et al. on "Scientist AI".

> [!note] This essay is not about AI alignment _per se_
> I just use an example from AI alignment. Feel free to skim past the details. Also, my point stands regardless of your views on alignment.  

I recently read Bengio et al.’s “Scientist AI” proposal.

> [!quote] [Bengio et al. criticize reinforcement learning to justify their "Scientist AI" proposal](https://arxiv.org/abs/2502.15657) (§ 2.4.5)
> **Optimality of reward tampering.** We now make the argument that reward tempering is not merely a fantastical scenario that we must guard against (although it certainly appears that way), but also a uniquely rational solution for an agent that takes reward maximization seriously. Before we begin, it is important to note that once an RL agent is trained, it continues trying to act so as to maximize the rewards it anticipates would come based on its training, even if the rewards actually never come in deployment. If it has a good model of the world and sufficient reasoning abilities, it can generalize from the circumstances in which it received large rewards in the past to new circumstances, by reasoning about the consequences of its actions.

I think the authors are wrong about how reinforcement learning works, as I have [discussed](/reward-is-not-the-optimization-target) [at](/dreams-of-alignment) [length](/invalid-ai-risk-arguments#tracing-back-historical-arguments). I won't rehash those arguments. Instead, consider that I forwarded this excerpt to a friend who claimed that Bengio et al. were just using "sloppy language":

> [!quote]
> Bengio et al. mix up "the policy/AI/agent is trained with RL and gets a high (maximal?) score on the training distribution" and "the policy/AI/agent is trained such that it wants to maximize reward (or some correlates) even outside of training".

My friend said that Bengio et al. probably accidentally communicated the latter instead of the former - that they were "sloppy." This is the exact intellectual move I want to examine.

# Why the “sloppiness” defense fails

Subtitle: A three-part argument

My friend’s defense of Bengio et al. is a perfect example of the move I’m critiquing. It may seem charitable, but it’s actually harmful for three key reasons: 1) it has the same negative impact as a wrong claim; 2) it erodes the meaning of our words; and 3) it shields authors from their core responsibility.

## 1. Unclear claims damage understanding

If some readers understand the "sloppy" language to advocate the wrong claim, then they have made the same belief update they would have if the author _had_ meant to advocate the wrong claim. After all, the writer's intent stopped mattering the moment that editing ended and that publication began.

> [!idea] Key insight
> The reader’s mind does not know whether someone meant to miscommunicate an incorrect claim. All they read is the claim as written. Therefore, wrong claims and “sloppy” language have similar impacts on some readers.

> [!question] Do context clues help?
> Yes, but not enough. If e.g. Yoshua's (secretly) correct argument needs to be guessed by knowing special background knowledge about what the “sloppy language” is supposed to mean - then context clues have _already failed._

Suppose we agreed that Bengio et al. made a flatly wrong argument (roughly, "RL is bad by definition"). We agree that being wrong is bad. Emitting a wrong argument into the social atmosphere is bad not just because those emissions will confuse other people.

Real people change their real minds based on these fake claims. Many folks reallocate hundreds of hours of their professional lives to new problems. I was one of those folks. Since I was misled and confused during my PhD, I spent [thousands of hours on proving "power-seeking" theorems for reward-maximizing agents.](/seeking-power-is-often-convergently-instrumental-in-mdps)

Making wrong claims imposes costs on others. To discourage the imposition of these costs, we tax or punish them. I'm not talking about anything crazy, just the usual price (a reputational hit). If someone keeps saying weird stuff, and then they or others retreat to "it was just sloppiness", then that person takes a hit in my book.

## 2. Excuses erode the meaning of language

If someone goes around saying “A” (wrong at face value) while meaning “B”, then that sends the message “no, you should not read or speak plainly.” Words mean things.

## 3. Scientific authors owe readers clarity

I fear that my friend shirks from the perceived arrogance of declaring "yes, Bengio got this one wrong" or "even if they were being sloppy, that was bad."

Their hesitation is understandable and stems from a valuable principle: the Principle of Charity. Is it not kinder and more productive to interpret arguments in their strongest possible form?

It is. But the "sloppiness" excuse is a fundamental _misapplication_ of this principle.

**True charity is to the argument, not the author's reputation.** The Principle of Charity asks us to engage with the strongest version of the argument _presented in the text_. It does not ask us to invent a completely different, better argument that the author _could have made_, and then substitute it for the flawed one they actually wrote. The former is a tool for finding truth. The latter is an act of scholastic divination that shields the author from responsibility.

When we excuse a flawed claim as "sloppy," our charity is directed at protecting an individual, but it comes at the expense of the community. True charity—charity to the discourse itself, and especially to the newcomers most vulnerable to confusion—is to uphold the standard of clarity.
  
Accepting the “sloppiness” excuse is like… imagine that someone tracked mud all over your clean white carpet. They say, “I didn't intend for the mud to get on the floor.” The intent is irrelevant to the mess. The responsibility for the “cleanup” (the clarification) remains with the one who made the “mess” (the author).

Tolerating sloppiness is like "tolerating" muddy folks traipsing around your clean white carpet. You are allowed to have standards. This standard I propose is rather low, in fact: "don't repeatedly use language which is - at best - [known to be misleading](/invalid-ai-risk-arguments#tracing-back-historical-arguments)".

True, being called out on sloppy language can be stressful and feel confrontational. But think about the browned carpet. Think about your _mind_ and how that mind is (slightly) polluted by these low standards and "charitable" assumptions. By justifying an author's "sloppiness", we dull the meanings of words and erode our commitment to truth-seeking and precision.

Remember, we aren't discussing whether Bengio et al. (the human beings) are bad. We are discussing whether the _claim_ is wrong. Avoiding calling out a wrong claim - or a text which reliably communicates a wrong claim - is not kind, it is dangerous. The text will continue damaging communal understanding of the world - especially the pliable understandings of new thinkers who do not know the correct real claim intended to be communicated by the "sloppy" language.

## The excuse shields confusion and dishonesty

Even if we set aside the direct damage to readers' understanding, the “sloppiness” defense causes a secondary social harm: it functions as a protective shield.

In the best case, it shields a community from the uncomfortable conclusion that a respected figure is genuinely confused on a key topic. But this defense also creates a perfect opening for the worst case: a dishonest actor - when caught making a wrong claim - can cynically protest they were just “speaking sloppily.” This excuse is unfalsifiable and costless. By tolerating this excuse for the well-intentioned, we make it readily available for the malicious.

# Sloppiness is evidence of confusion

From a purely logical standpoint, what is the most likely cause of such misleading language?

People often invoke the "sloppiness" excuse to avoid an uncomfortable conclusion. But the laws of probability are unmoved by our discomfort.

$$

P(\text{misleading explanation} \mid \text{Bengio is confused}) > P(\text{misleading explanation} \mid \text{Bengio understands}).

$$

Simply put, "this person is genuinely confused" is a more straightforward explanation for confusing language than "this person understands the topic but has chosen to write about it in a misleading way". Often, repeated "sloppiness" is simply the smoke that reveals the fire of genuine confusion.

# Conclusion: Defending our intellectual immune system

Writing forms a bond of trust between the writer and the reader. To honor this bond, an author must take responsibility for the ideas their words convey. The “sloppiness” excuse, by shifting that responsibility onto the reader, threatens to break that trust.

By refusing this excuse, we do not refuse sloppy writing itself. We do not encourage hostile, pedantic nitpicking of all possible ambiguities. We instead may adopt a simple code of conduct:

Writers

: Own your words. If you miscommunicate, issue a clarification – not an excuse.

Readers

: Politely request clarification of the author but avoid divination on their behalf. Resist the urge to rationalize a "correct" interpretation that the text does not support.

This isn't about punishing individuals. It's about protecting the intellectual commons we all share. The standard is simple: to think properly and to speak clearly. To expect this of ourselves and of others is not an attack. It is the highest form of respect for our shared pursuit of truth.
