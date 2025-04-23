---
permalink: managerial-decision-making-review
lw-was-draft-post: 'false'
lw-is-af: 'false'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/MjZSdPEd94sp48EFC/judgment-day-insights-from-judgment-in-managerial-decision
lw-is-question: 'false'
lw-posted-at: 2019-12-29T18:03:28.352000Z
lw-last-modification: 2019-12-30T00:31:35.888000Z
lw-curation-date: None
lw-frontpage-date: 2019-12-29T21:58:25.454000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 6
lw-base-score: 24
lw-vote-count: 8
af-base-score: 0
af-num-comments-on-upload: 0
publish: true
title: "Judgment Day: Insights from 'Judgment in Managerial Decision Making'"
lw-latest-edit: 2019-12-30T00:31:36.289000Z
lw-is-linkpost: 'false'
tags:
  - understanding-the-world
  - scholarship-&-learning
aliases:
  - judgment-day-insights-from-judgment-in-managerial-decision
lw-sequence-title: Becoming Stronger
lw-sequence-image-grid: sequencesgrid/fkqj34glr5rquxm6z9sr
lw-sequence-image-banner: sequences/oerqovz6gvmcpq8jbabg
sequence-link: posts#becoming-stronger
prev-post-slug: computability-and-logic-textbook-review
prev-post-title: And My Axiom! Insights from 'Computability and Logic'
next-post-slug: topology-textbook-review
next-post-title: "Continuous Improvement: Insights from 'Topology'"
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2019-12-29 00:00:00
original_url: https://www.lesswrong.com/posts/MjZSdPEd94sp48EFC/judgment-day-insights-from-judgment-in-managerial-decision
skip_import: true
description: Insights from a management textbook on how to improve decision-making,
  negotiate effectively, and overcome cognitive biases.
date_updated: 2025-01-30 09:30:36.233182
---







The more broadly I read and learn, the more I bump into implicit self-conceptions and self-boundaries. I was slightly averse to learning from a manager-oriented textbook because I'm not a manager, but also because I... didn't see myself as the kind of person who could learn about a "business"-y context? I also [didn't see myself as the kind of person who could read and do math](/first-analysis-textbook-review), which now seems ridiculous.

Although the read was fast and easy and often familiar, I unearthed a few gems.

# Judgment in Managerial Decision Making

A tip of dubious ethicality for lazy [min-maxers](<https://en.wikipedia.org/wiki/Munchkin_(role-playing_games)>):

> [!quote] Judgment in Managerial Decision Making
> Managers give more weight to performance during the three months prior to \[a performance\] evaluation than to the previous nine months... because it is more available in memory.

## Unified explanation of biases

The authors group biases as stemming from the Big Three of availability, representativeness, and confirmation. The model I took away relies on a mechanism somewhat similar to [attention in neural networks](https://akosiorek.github.io/ml/2017/10/14/visual-attention.html): due to how the brain performs time-limited search, more salient/recent memories get prioritized for recall.

The availability heuristic goes wrong when our salience-weighted perceptions of the frequency of events is a biased estimator of the real frequency, when we happen to be extrapolating off of a small sample size, or when our memory structure makes recalling some kinds of things harder (e.g. words starting with 'a' versus words whose third letter is 'a'). Concepts get inappropriately activated in our mind, and we therefore reason incorrectly. Attention also explains anchoring: you can more readily bring to mind things related to your anchor due to salience.

The representativeness heuristic can be understood as highly salient concept activations inappropriately dominating our reasoning. We then ignore e.g. base rates, sample size, statistical phenomena (regression to the mean), and the conjunctive burden of propositions. Consider how neural network activations could explain the following:

> Intuitively, thinking of Linda as a feminist bank teller "feels" more realistic than thinking of her as only a bank teller.

The case for confirmation bias seems to be a little more involved. We had evolutionary pressure to win arguments, which might mean our cognitive search aims to _find_ supportive arguments and _avoid_ even subconsciously signaling that we are aware of the existence of counterarguments. This means that those supportive arguments _feel_ salient, and we (perhaps by "design") get to feel unbiased - we aren't consciously discarding evidence, we're just following our normal search/reasoning process! This is [what our search algorithm feels like from the inside.](https://www.lesswrong.com/posts/yA4gF5KrboK2m2Xu7/how-an-algorithm-feels-from-inside)

## Making heads and tails of probabilistic reasoning

> [!quote] [_Subjective Probability: A Judgment of Representativeness_,](http://datacolada.org/wp-content/uploads/2014/08/Kahneman-Tversky-1972.pdf) Kahneman and Tversky
> since sample size does not represent any property of the population, it is expected to have little or no effect on judgment of likelihood,

which lines up with the above attention/activation model. Anyways, participants judged that the sequence of birth sexes `GBGBBG` is _more likely_ than `BGBBBB` (obviously, they have equal probability). K&T chalk this up to the first sequence seeming more "representative" of a "random" process. If you're considering whether the set of all sequences which "look like" the former is more likely than the set of sequences resembling the latter, then this answer could be correct.

However, checking the original paper, this was controlled for; K&T emphasized that the exact order of births was as described. They go on:

> [!quote]
> One may wonder whether \[subjects\] do not simply ignore order information, and answer the question by evaluating the frequency of families of five boys and one girl relative to that of families of three boys and three girls. However, when we asked the same \[subjects\] to estimate the frequency of the sequence `BBBGGG`, they viewed it as significantly less likely than `GBBGBG` ($p<.01$), presumably because the former appears less random. Order information, therefore, is not simply ignored.

## Share your unique information in groups

Groups are good because they pool knowledge and expertise. However, studies show that by default, shared knowledge is much more likely to be discussed than unshared knowledge, which can significantly worsen decision-making. The authors give the example of a group initially disfavoring a student council candidate. One person is privately aware of crucial positive information about the candidate, and groups in which all members knew the info were likely to favor the candidate. The information wasn't usually shared, and the candidate was passed over.

> [!quote] > \[Ameliorative\] strategies include forewarning the group in advance of the unique knowledge of different members and identifying expertise in the group before the discussion begins.

## Open subaccounts for savings

You can avoid psychological annoyances throughout the year (tickets, unanticipated fees, etc.) _and_ counteract the budget-planning fallacy by, at the beginning of each year, allocating money to goal-specific [subaccounts](https://www.investopedia.com/terms/s/sub-account.asp). Then, you can forget about it during the year, and (perhaps) donate the remainder to an effective charity.

## Be more risk-neutral

> [!quote]
>
> Paul Samuelson... offered a colleague a coin-toss gamble. If the colleague won the coin toss, he would receive \$200, but if he lost, he would lose \$100. Samuelson was offering his colleague a positive expected value with risk. The colleague, being risk-averse, refused the single bet, but said that he would be happy to toss the coin 100 times! The colleague understood that the bet had a positive expected value and that across lots of bets, the odds virtually guaranteed a profit. Yet with only one trial, he had a 50% chance of regretting taking the bet.
>
> Notably, Samuelson‘s colleague doubtless faced many gambles in life… He would have fared better in the long run by maximizing his expected value on each decision... all of us encounter such “small gambles” in life, and we should try to follow the same strategy. **Risk aversion is likely to tempt us to turn down each individual opportunity for gain. Yet the aggregated risk of all of the positive expected value gambles that we come across would eventually become infinitesimal, and potential profit quite large.**

## Biological explanation for hedonic treadmill?

> [!quote]
>
> The striking aspect about [framing and reference-point effects](<https://en.wikipedia.org/wiki/Framing_effect_(psychology)>) is that they suggest the presence of underlying mental processes that are _more_ complicated than a rational decision-maker would employ. Rational decision-makers would simply seek to maximize the expected value of their choices. Whether these outcomes represent gains or losses would be irrelevant, and consideration of the outcome relative to the status quo would be a superfluous consideration. instead, we adjust to the status quo, and then think of the changes from that point as gains or losses.
>
> Rayo and Becker (2007) present a persuasive explanation for why evolution programmed us with extra machinery that impairs our decisions. According to their explanation, our reliance on frames and reference points to assess outcomes is an elegant solution to a problematic biological constraint. The constraint is that our "subjective utility scale" – our ability to experience pleasure and pain – is not infinitely sensitive. Was Bill Gates's 50th billion dollars as satisfying as his first? certainly not. the limited sensitivity of our subjective utility scale is precisely the reason why we experience declining marginal utility for both gains and losses…
>
> Given this biological constraint on the sensitivity of our subjective utility scale, we need to readjust our reference point by getting used to what we've got and then taking it for granted. If we didn't adjust our reference point, we could quickly hit the maximum of our utility scale, and realize that nothing we could ever do would make us happier. That would effectively kill our motivation to work harder, become richer, and achieve more. In reality, of course, what happens is that we get used to our current level of wealth, status, and achievement, and are then motivated to seek more, believing that it will make us happier.
>
> The irony of this motivational system is that for it to keep working, **we have to habituate to our new condition but not anticipate this habituation.** Evidence does indeed confirm that people adjust to both positive and negative changes in circumstances with surprising speed, and then promptly forget that they did so. Thus, we find ourselves on a hedonic treadmill in which we strive for an imagined happiness that forever slips out of our grasp, beckoning us onward.

## Negotiation tips

Chapters 9 and 10 contain a wealth of (seemingly) good negotiation advice. Being a good negotiator and mediator seems like an important generalist life skill.

- Before negotiation, consider all relevant issues and their importance to you and then to your partner. Try to spot places where you can make efficient positive-sum bargains. Figure out your next-best alternative if a deal cannot be struck, and anticipate what your partner's will be as well.
- Find the intent generating their stated position. Maybe your boss states they don't want you installing a standing desk, but they're secretly worried it'll lead to a slippery slope of employees installing increasingly distracting accessories. If you can find this out, you can offer your support in preventing a slippery slope, instead of trying to push on the more difficult all-or-nothing position.
- Negotiate multiple issues simultaneously. You're better able to find positive-sum agreements when considering multiple axes at once. Also, you'll avoid making them compromise too hard and too early on things which aren't important to you, which can make the later part of negotiation less fruitful for you.

There were a lot more helpful takeaways, and I plan on rereading Ch. 9 before conducting any important negotiations.

# Forwards

This book was a little slow at times, both because of excessive preamble/signposting, and my already being familiar with much of the literature. Still, I'm glad I read it.

## Hello again

It's been [a long while](/computability-and-logic-textbook-review) since my last review. After injuring myself last summer, I wasn't able to type reliably until early this summer. This derailed the positive feedback loop I had around "learn math" → "write about what I learned" → "savor karma". Protect your feedback loops.

I run into fewer basic confusions than when I was just starting at math, so I generally have less to talk about. This means I'll be changing the style of any upcoming reviews, instead focusing on deeply explaining the things I found coolest.

Since January, I've read _Visual Group Theory, Understanding Machine Learning, Computational Complexity: A Conceptual Perspective, Introduction to the Theory of Computation, An Illustrated Theory of Numbers_, most of Tadellis' _Game Theory_, the beginning of _Multiagent Systems_, parts of several graph theory textbooks, and I'm going through Munkres' _Topology_ right now. I've gotten through the first fifth of the first Feynman lectures, which has given me an unbelievable amount of mileage for generally reasoning about physics.

My "plan" is to keep learning math until the low graduate level (I still need to at least do complex analysis, topology, field / ring theory, ODEs/PDEs, and something to shore up my atrocious trig skills, and probably more)[^1], and then branch off into physics + a "softer" science (anything from microecon to psychology).

## New year, new decade

In the new year, I'm going to focus hard on raising the level of my cognitive game.

Reading the Sequences qualitatively levelled me up, and I want to do that again. My thought processes are still insufficiently transparent: I need to flag motivated reasoning more often. I still fall prey to the planning fallacy (but somewhat less than two years ago). I don't [notice my confusion](https://www.readthesequences.com/Noticing-Confusion-Sequence) _nearly_ as often as I should.

Not noticing confusion often has a cost measured in hours (or more). Let me give you an example. Last night, I went to see Sen. Amy Klobuchar speak. It was my understanding that the event would be a meet-and-greet. I planned to query her interest in e.g. setting up a granting agency disbursing funds based on scientific evidence of high impact, with the details to be worked out in conjunction with relevant professionals in EA and the government.

While I was waiting for her to arrive, I noticed that people were writing on paper and handing it to other people. I rounded this off as commit-to-caucus cards, which, if I _actually thought_ about it, makes no sense – you keep your commit-to-caucus card. They were, in fact, providing written questions, some of which Sen. Klobuchar would later answer. If I had just noticed this, I could have written a question.

The list of things I've noticed I failed to notice in the last month is surprisingly long. I don't think I'm bad at this in a relative sense – just in an absolute sense.

This new year, I'm going to become a less oblivious, less stupid, and less wrong person.

<hr/>

[^1]: I also still want to learn Bayes nets, category theory, get a much deeper understanding of probability theory, provability logic, and decision theory.
