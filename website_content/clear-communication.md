---
title: Authors have a responsibility to communicate clearly
permalink: author-responsibility
no_dropcap: false
tags:
  - critique
  - practical
description: When a claim is shown to be incorrect, defenders may say that the author
  actually meant something else entirely. I think this move is harmful.
authors: Alex Turner
hideSubscriptionLinks: false
card_image:
aliases:
  - clear-communication
date_published: &id001 2025-06-29 16:49:07.944742
date_updated: *id001
---


When a claim is shown to be incorrect, defenders may say that the author was just being “sloppy” and actually meant something else entirely. I argue that this move is not harmless, charitable, or healthy. At best, this attempt at charity reduces an author’s incentive to express themselves clearly – they can clarify later![^efficient] – while burdening the reader with finding the “right” interpretation of the author’s words. At worst, this move is a dishonest defensive tactic which shields the author with the unfalsifiable question of what the author “really” meant.

[^efficient]: As noted by Guive Assadi: "It is efficient to allocate a lot of responsibility to the author because they are one person and if they work hard to write clearly, it saves many people time interpreting it."

> [!warning] Preemptive clarification
>
> The context for this essay is serious, high-stakes communication: papers, technical blog posts, and tweet threads. In that context, communication is a partnership. A reader has a responsibility to engage in good faith, and an author cannot possibly defend against all misinterpretations. Misunderstanding is a natural part of this process.
>
> This essay focuses not on natural misunderstandings, but on the _specific conversational move_ which occurs when someone refuses to say “yes, I meant that other thing” and instead replies “I was right, but you simply misunderstood me.” When a good-faith reader—someone in the target audience who is reading with attention and charity—is confused, the author should take some responsibility. This essay explains why denying that responsibility is harmful.

# A case study of the “sloppy language” move

> [!note] This essay is not about AI alignment _per se_
> I just use an example from AI alignment. My point stands regardless of your views on alignment.  

I recently read Bengio et al.’s [“Scientist AI” proposal.](https://arxiv.org/abs/2502.15657) They argue that we are not currently building AI in a way which can reasonably be made safe. To support this argument, they claim that reinforcement learning will train agents which want to maximize their "reward."

> [!quote]- Bengio et al. criticize RL to justify their proposal (§ 2.4.5)
> **Optimality of reward tampering.** We now make the argument that reward tempering is not merely a fantastical scenario that we must guard against (although it certainly appears that way), but also a uniquely rational solution for an agent that takes reward maximization seriously. Before we begin, it is important to note that once an RL agent is trained, it continues trying to act so as to maximize the rewards it anticipates would come based on its training, even if the rewards actually never come in deployment. If it has a good model of the world and sufficient reasoning abilities, it can generalize from the circumstances in which it received large rewards in the past to new circumstances, by reasoning about the consequences of its actions.

I think the authors are wrong about that, as I have [discussed at length elsewhere](/invalid-ai-risk-arguments#tracing-back-historical-arguments). I won't rehash those arguments because - for this essay - it doesn't matter if I'm right. Instead, consider that I forwarded this excerpt to a friend who claimed that Bengio et al. were just using "sloppy language." He argued that they didn't _really_ mean that the RL agent will "act so as to maximize the rewards" - instead, they _actually_ "meant that the RL agent will maximize reward during its training process."

> [!quote]- What my friend said about the passage from Bengio et al.
> I think he's using sloppy language.
>
> Bengio et al. mix up "the policy/AI/agent is trained with RL and gets a high (maximal?) score on the training distribution" and "the policy/AI/agent is trained such that it wants to maximize reward (or some correlates) even outside of training".

Regardless of who was "right", this conversation is a springboard for examining the broader _conversational move_ of claiming "the author was right but was writing sloppily."

# Why the “sloppiness” move is harmful

While this move seems charitable, I argue that it’s actually harmful because: 1) it has the same negative impact as a wrong claim; 2) it erodes the meaning of our words; 3) it shields authors from their core responsibility; and 4) it serves as a social shield for dishonesty.

## 1. Unclear claims damage understanding

If some readers understand the "sloppy" language to advocate the wrong claim, then they have made the same belief update they would have if the author _had_ meant to advocate the wrong claim. After all, the writer's intent stopped mattering the moment that editing ended and that publication began.

The reader’s mind does not know whether someone meant to miscommunicate an incorrect claim. All they read is the claim as written. Therefore, wrong claims and “sloppy” language have similar impacts on some readers.

> [!question] Do context clues help?
> Yes, but only if the target audience knows what to look for. If e.g. Yoshua's (secretly) correct argument needs to be guessed by knowing rare background knowledge about what the “sloppy language” is supposed to mean - then the context clues have failed.

Real people change their real minds based on these "unclear" claims. Many folks reallocate hundreds of hours of their professional lives to new problems. I was one of them. Since I was confused during my PhD, I spent [thousands of hours on proving "power-seeking" theorems for reward-maximizing agents](/seeking-power-is-often-convergently-instrumental-in-mdps) - theorems which [I now consider interesting but misguided.](/parametrically-retargetable-power-seeking#why-am-i-only-now-posting-this)

Making wrong claims imposes costs on others. To discourage the imposition of these costs, we tax or punish them. I'm not talking about anything crazy. If someone keeps saying weird stuff, and then they retreat to "it was just sloppiness", then that person takes a hit in my book.

## 2. Secret indirection erodes the meaning of language

If someone goes around saying _X_ (wrong at face value) while meaning _Y_, then that sends the message “no, you should not read or speak plainly.” Words mean things.

## 3. Authors owe readers clarity

Subtitle: So don't misapply the principle of charity!

Imagine you ask someone for directions to the library. They provide a set of confusing instructions that lead you to the post office. When you inform them, they reply, "Oh, I knew the correct route. You just misinterpreted my directions."

While you have a responsibility to listen carefully, they have a responsibility to provide a clear map. Here, the "sloppiness move" allows the map-maker to blame the map-reader for a faulty map. This move rejects a core principle of the partnership: that the author has a responsibility to communicate effectively.

Yet I often see a hesitation to hold authors to this principle. I fear that my friend shirks from the perceived arrogance of declaring "yes, Bengio got this one wrong" or "even _if_ they were being sloppy, that was bad." Their hesitation is understandable. Is it not kinder and more productive to interpret arguments in their strongest possible form?

> [!quote] [The principle of charity](https://en.wikipedia.org/wiki/Principle_of_charity)
> The principle of charity requires interpreting a speaker's statements in the most rational way possible and, in the case of any argument, considering its best, strongest possible interpretation. In its narrowest sense, the goal of this methodological principle is to avoid attributing irrationality, logical fallacies, or falsehoods to the others' statements, when a coherent, rational interpretation of the statements is available.

The principle of charity is indeed valuable. However, the principle does not support the "sloppiness" move. The move doesn't ask us to interpret the author's words charitably. The move instead asks us to _ignore their words_ and instead read their mind (relative to the expected knowledge of the target audience). We are asked to invent an entirely new interpretation of the author's statements - to invent an implausible interpretation _not suggested by the text_. Charity should be a tool for finding the truth, not for protecting an author's reputation.

### But which interpretations are "plausible"?

Good-faith readers sometimes disagree about what interpretations are suggested by the text. This essay does not resolve that potential disagreement. However, whether or not they agree, I offer a clear prescription:

1. If people agree that an interpretation is not suggested by the text, then they should _not_ entertain the idea that the author "actually" meant that interpretation.
2. If people disagree whether an interpretation is suggested by the text, then the author should clarify the intended interpretation.
    - An author committed to clarity might say something like: "I can see how my words led you to believe _X_. To be clear, what I mean is _Y_." _This response takes responsibility._
    - A status-defending author might say something more like: "You are wrong to read it as _X_. It obviously means _Y_, and you are being uncharitable." _This response deflects responsibility._

In neither case should the readers be forced to mind-read or provide complicated textual analyses justifying the "true meaning" of a passage.

## 4. The move can shield dishonesty

In the best case, the "sloppiness" statement is an attempt at charity. But this move also creates an opening for the worst case. When a dishonest actor is caught making a wrong claim, they can protest they were just “speaking sloppily.” This excuse is unfalsifiable and costless. By tolerating this move for the well-intentioned, we make it readily available for the dishonest.[^motte]

[^motte]: If used dishonestly, the "sloppiness" excuse functions as a [motte-and-bailey](https://simple.wikipedia.org/wiki/Motte-and-bailey_fallacy). The (easy-to-defend) motte is the interpretation _Y_ which the author "really" meant. The (hard-to-defend) bailey is _X_- one of the straightforward interpretations.

# Conclusion: Defending intellectual standards

Serious, high-stakes writing forms a bond of trust between the writer and the reader. To honor this bond, an author must take responsibility for the ideas their words convey. By shifting that responsibility onto the reader, the “sloppiness” move threatens to break that trust.

When we refuse this move, we do not refuse sloppy writing itself, nor do we encourage hostile, pedantic nitpicking of all possible ambiguities. We may instead adopt a simple code of conduct:

Writers

: Own your words. When you miscommunicate, issue a clarification. A response that primarily blames the reader fails this standard.

Readers

: Read in good faith, resolving minor ambiguities using context and extending reasonable charity to the author. Politely request clarification from the author but resist the urge to rationalize a "correct" interpretation that the text does not support. Furthermore, don't grant full credit for an idea that was “sloppily” communicated.

The proposed standard is simple: to speak clearly and to interpret reasonably. Expecting this of ourselves and of others is not an attack. It is a form of respect for our shared pursuit of truth.

> [!thanks]
> Guive Assadi, Peter Barnett, Alex Cloud, Rocket Drew, Gemini Pro 2.5, and Siao Si provided feedback on drafts.
