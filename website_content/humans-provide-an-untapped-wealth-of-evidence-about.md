---
permalink: humans-provide-alignment-evidence
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: 
  https://www.lesswrong.com/posts/CjFZeDD6iCnNubDoS/humans-provide-an-untapped-wealth-of-evidence-about
lw-is-question: "false"
lw-posted-at: 2022-07-14T02:31:48.575000Z
lw-last-modification: 2024-03-02T01:18:50.890000Z
lw-curation-date: 2022-08-14T07:35:43.265000Z
lw-frontpage-date: 2022-07-14T03:34:23.107000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 94
lw-base-score: 204
lw-vote-count: 92
af-base-score: 57
af-num-comments-on-upload: 42
publish: true
title: Humans provide an untapped wealth of evidence about alignment
lw-latest-edit: 2023-01-01T19:52:16.131000Z
lw-is-linkpost: "false"
authors: Alex Turner and Quintin Pope
tags:
  - AI
  - shard-theory
  - human-values
aliases:
  - humans-provide-an-untapped-wealth-of-evidence-about
lw-podcast-link: 
  https://www.buzzsprout.com//2037297/11168035-humans-provide-an-untapped-wealth-of-evidence-about-alignment-by-turntrout-quintin-pope.js?container_id=buzzsprout-player-11168035&amp;player=small
lw-sequence-title: Shard Theory
lw-sequence-image-grid: sequencesgrid/igo7185zypqhuclvbmiv
lw-sequence-image-banner: sequences/ot2siejtvcl9pvzly2ma
sequence-link: posts#shard-theory
next-post-slug: human-values-and-biases-are-inaccessible-to-the-genome
next-post-title: Human values & biases are inaccessible to the genome
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2022-07-14 00:00:00
original_url: 
  https://www.lesswrong.com/posts/CjFZeDD6iCnNubDoS/humans-provide-an-untapped-wealth-of-evidence-about
skip_import: "true"
description: "I argue for studying the only known example of aligned intelligence:
  humans. Stop speculating about AIXI and diamonds - look at humans!"
date_updated: 2025-04-12 09:51:51.137842
---









> [!info]
> This post has been recorded as part of the LessWrong Curated Podcast, and can be listened to on [_Spotify_](https://open.spotify.com/episode/0jpI7LLNzKsn6lwrsoDCc9), [_Apple Podcasts_](https://podcasts.apple.com/us/podcast/humans-provide-an-untapped-wealth-of-evidence/id1630783021?i=1000575990542), and [_Libsyn_](https://five.libsyn.com/episodes/view/23991000)\.

**TL;DR:** To even consciously consider an alignment research direction, [you should have evidence](https://www.readthesequences.com/Privileging-The-Hypothesis) to locate it as a promising lead. As best I can tell, many directions seem interesting but do not have strong evidence of being “entangled” with the alignment problem such that I expect them to yield significant insights.

For example, “we can solve an easier version of the alignment problem by first figuring out how to build an AI which maximizes the number of real-world diamonds” has intuitive appeal and plausibility, but this claim doesn’t _have_ to be true and this problem does not _necessarily_ have a natural, compact solution. In contrast, there do _in fact_ exist humans who care about diamonds. Therefore, there are guaranteed-to-exist alignment insights concerning the way people come to care about e.g. real-world diamonds.

> [!thanks]
> “Consider how humans navigate the alignment subproblem you’re worried about” is a habit which I (`TurnTrout`) picked up from Quintin Pope. I wrote the post, he originated the tactic.

<hr/>

> [!quote] [Ontology identification problem](https://arbital.com/p/ontology_identification/), Arbital
>
> A simplified but still difficult open problem in [AI alignment](https://arbital.com/p/ai_alignment/) is to state an unbounded program implementing a [diamond maximizer](https://arbital.com/p/diamond_maximizer/) that will turn as much of the physical universe into diamond as possible. The goal of "making diamonds" was chosen to have a crisp-seeming definition for our universe (the amount of diamond is the number of carbon atoms covalently bound to four other carbon atoms). If we can crisply define exactly what a 'diamond' is, we can avert issues of trying to convey [complex values](https://arbital.com/p/complexity_of_value/) into the agent.

I find this problem interesting, both in terms of wanting to know how to solve a reframed version of it, and in terms of what I used to think about the problem. I used to[^1] think, “yeah, ‘diamond’ is relatively easy to define. Nice [problem relaxation](/problem-relaxation-as-a-tactic).” It felt like the diamond maximizer problem let us focus on the challenge of making the AI’s values bind to _something at all_ which we actually intended (e.g. diamonds), in a way that’s robust to ontological shifts and that doesn’t collapse into wireheading or tampering with e.g. the sensors used to estimate the number of diamonds.

Although the details are mostly irrelevant to the point of this blog post, the Arbital article suggests some solution ideas and directions for future research, including:

1. Scan [AIXI-_tl_](https://archive.org/details/arxiv-cs0004001)’s Turing machines and locate diamonds within their implicit state representations.
2. Given how [inaccessible](https://ai-alignment.com/inaccessible-information-c749c6a88ce?gi=11e30aac9afb) we expect AIXI\-_tl_’s representations to be by default, have AIXI-_tl_ just consider a Turing-complete hypothesis space which uses more interpretable representations.
3. “Being able to describe, in purely theoretical principle, a prior over epistemic models that have at least two levels and can switch between them in some meaningful sense.”

Do you notice anything _strange_ about these three ideas? Sure, the ideas don’t seem workable, but they’re good initial thoughts, right?

The problem _isn’t_ that the ideas aren’t clever enough. These ideas are reasonable stabs given the premise of “get some AIXI variant to maximize diamond instead of reward.”

The problem _isn’t_ that it’s impossible to specify a mind which cares about diamonds. We already know that there are intelligent minds who value diamonds. You might be dating one of them, or you might even _be_ one of them! Clearly, the genome + environment jointly specify certain human beings who end up caring about diamonds.

One problem is [_where is the evidence required to locate these ideas_](https://www.readthesequences.com/Privileging-The-Hypothesis)? Why should I even find myself thinking about diamond maximization and AIXI and Turing machines and utility functions in this situation? It’s not that there’s _no_ evidence. For example, utility functions [ensure the agent can’t be exploited in some dumb ways](https://www.lesswrong.com/posts/RQpNHSiWaXTvDxt6R/coherent-decisions-imply-consistent-utilities). But I think that the supporting evidence is not _commensurate_ with the specificity of these three ideas or with the specificity of the “ontology identification” problem framing.

Here’s an exaggeration of how these ideas feel to me when I read them:

> “I lost my phone”, you tell your friend.
>
> They ask, “Have you checked [`Latitude: -34.44006, Longitude: -64.61333`](https://gps-coordinates.org/my-location.php?lat=-34.44006&lng=-64.61333)?”
>
> Uneasily, you respond: “Why would I check there?”
>
> Your friend shrugs: “Just seemed promising. And it’s on land, it’s not in the ocean. Don’t worry, I incorporated evidence about where you probably lost it.”

I [recently made a similar point](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=CXdcb9sMLkgLANrTv#CXdcb9sMLkgLANrTv) about [Cooperative Inverse Reinforcement Learning](https://arxiv.org/abs/1606.03137):

> [!quote]
>
> _Against CIRL_ as a special case of _against quickly jumping into highly specific speculation while ignoring empirical embodiments-of-the-desired-properties._
>
> In the context of "how do we build AIs which help people?", asking "does CIRL solve corrigibility?" is hilariously unjustified. [By what evidence](https://www.readthesequences.com/Privileging-The-Hypothesis) have we located such a specific question? We have assumed there is an achievable "corrigibility"-like property; we have assumed it is good to have in an AI; we have assumed it is good in a similar way as "helping people"; we have elevated CIRL in particular as a formalism worth inquiring after.
>
> "Does CIRL solve corrigibility?" is _**not the first question to ask**,_ when considering "sometimes people want to help each other, and it'd be great to build an AI which helps us in some way." Much better to start with _existing_ generally intelligent systems (humans) which _already_ sometimes act in the way you want (they help each other) and ask after the _**guaranteed-to-exist reason**_ why this empirical phenomenon happens.

Now, if you are confused about a problem, it can be better to explore _some_ guesses than no guesses—perhaps it’s better to think about Turing machines than to stare helplessly at the wall (but perhaps not). Your best guess may be wrong (e.g. write a utility function which scans Turing machines for atomic representations of diamonds), but you sometimes still learn something by spelling out the implications of your best guess (e.g. the ontology identifier stops working when AIXI Bayes-updates to non-atomic physical theories). This can be productive, as long as you keep in mind the wrongness of the concrete guess, so as to not become anchored on that guess or on the framing which originated it (e.g. build a diamond _maximizer_).

However, in this situation, I want to look elsewhere. When I confront a confusing, difficult problem (e.g. how do you create a mind which cares about diamonds?), I often first look at reality (e.g. are there any existing minds which care about diamonds?). Even if I have _no idea_ how to solve the problem, if I can find an existing mind which cares about diamonds, then _since that mind is **real**,_ that mind has a [_guaranteed-to-exist_](https://en.wikipedia.org/wiki/Biomimetics) _causal mechanistic play-by-play origin story_ for why it cares about diamonds. I thereby anchor my thinking to reality; reality is sturdier than “what if” and “maybe this will work”; many human minds _do_ care about diamonds.

In addition to “there’s a guaranteed causal story for humans valuing diamonds, and not one for AIXI valuing diamonds”, there’s a second benefit to understanding how human values bind to the human’s beliefs about real-world diamonds. This second benefit is practical: I’m pretty sure the way that _humans_ come to care about diamonds has nearly nothing to do with the ways AIXI-_tl_ might be motivated to maximize diamonds. This matters, because I expect that the first AGI’s value formation will be _far_ more mechanistically similar to within-lifetime human value formation, than to AIXI-_tl_’s value alignment dynamics.

Next, it _can_ be true that the existing minds are too hard for us to understand in ways relevant to alignment. One way this could be true is that human values are a "[mess](https://www.readthesequences.com/Terminal-Values-And-Instrumental-Values)", that "[our brains are kludges slapped together by natural selection.](https://www.readthesequences.com/Rationality-An-Introduction)" If human value formation _were_ sufficiently complex, with sufficiently many load-bearing parts such that each part drastically affects human alignment properties, then we might instead want to design simpler human-comprehensible agents and study _their_ alignment properties.

While I think that human _values_ are complex, I think the evidence for human value _formation_’s essential complexity is surprisingly weak, all things reconsidered given the success of modern, post-deep learning understanding. Still... maybe humans _are_ too hard to understand in alignment-relevant ways!

Seriously? I mean, come on. Imagine an alien[^2] visited and told you:

> [!quote]
>
> Oh yeah, the AI alignment problem. We knocked that one out a while back. [Information inaccessibility of the learned world model](https://ai-alignment.com/inaccessible-information-c749c6a88ce?gi=11e30aac9afb)? No, I’m pretty sure [we didn’t solve that](/human-values-and-biases-are-inaccessible-to-the-genome), but we didn’t have to. We built this protein computer and trained it with, I forget actually, was it just what you would call “deep reinforcement learning”? Hm. Maybe it was more complicated, maybe not, I wasn’t involved.
>
> We _might_ have hardcoded relatively crude reward signals that are basically defined over sensory observables, like a circuit which activates when their sensors detect a [certain kind of carbohydrate](https://en.wikipedia.org/wiki/Sugar). Scanning you, it looks like some of the protein computers ended up with _your values_, even. Small universe, huh?
>
> Actually, I forgot how we did it, sorry. And I can’t make guarantees that our approach scales beyond your intelligence level or across architectures, but maybe it does. I have to go, but here are a few billion of the trained protein computers if you want to check them out!

Ignoring the weird implications of the aliens existing and talking to you like this, and considering only the alignment implications—_The absolute top priority of many alignment researchers should be figuring out how the hell the aliens got as far as they did_.[^3] Whether or not you know if their approach scales to further intelligence levels, whether or not their approach seems easy to understand, you have learned that these computers are _physically possible, practically trainable entities_. These computers have definite existence and guaranteed explanations. Next to these actually existent computers, speculation like “maybe [attainable utility preservation](/attainable-utility-preservation-concepts) leads to cautious behavior in AGIs” is dreamlike, unfounded, and untethered.

If it turns out to be currently too hard to understand the aligned protein computers, then I want to keep coming back to the problem with each major new insight I gain. When I learned about [scaling laws](https://arxiv.org/abs/2001.08361), I should have rethought my picture of human value formation—Did the new insight knock anything loose? I should have checked back in when I heard about [mesa optimizers](https://www.alignmentforum.org/posts/pL56xPoniLvtMDQ4J/the-inner-alignment-problem), about the [Bitter Lesson](http://incompleteideas.net/IncIdeas/BitterLesson.html), about [the feature universality hypothesis](https://distill.pub/2020/circuits/zoom-in/#claim-3) for neural networks, about [natural abstractions](https://www.alignmentforum.org/posts/wuJpYLcMEBz4kcgAn/what-is-abstraction-1#Natural_Abstractions).

Because, given my life’s present ambition (solve AI alignment), that’s what it makes sense for me to do—at each major new insight, to reconsider my models[^4] of the _single known empirical example of general intelligences with values_, to scour the Earth for every possible scrap of evidence that humans provide about alignment. We may not get much time with human-level AI before we get to superhuman AI. But we get plenty of time with human-level humans, and we get plenty of time _being_ a human-level intelligence.

The way I presently see it, [the godshatter of human values](https://www.lesswrong.com/posts/cSXZpvqpa9vbGGLtG/thou-art-godshatter)—the rainbow of desires, from friendship to food—is only [unpredictable](https://www.lesswrong.com/posts/34Gkqus9vusXRevR8/late-2021-miri-conversations-ama-discussion#YkhmywLQetjekM7e3) relative to a class of hypotheses which fail to predict the shattering.[^5] But confusion is in the map, not the territory. I do not consider human values to be “unpredictable” or “weird”, I do not view them as a “hack” or a “kludge.” Human value formation may or may not be messy (although I presently think _not_). Either way, human values are, of course, part of our lawful reality. Human values are reliably produced by within-lifetime processes within the brain. This has an explanation, though I may be ignorant of it. Humans usually bind their values to certain objects in reality, like dogs. This, too, has an explanation.

And, to be clear, I don’t want to black-box outside-view extrapolate from the “human datapoint.” I don’t want to focus on thoughts like “Since alignment ‘works well’ for dogs and people, maybe it will work well for slightly superhuman entities.” I aspire for the kind of alignment mastery which lets me build a diamond-producing AI, or if that didn’t suit my fancy, I’d turn around and tweak the process and the AI would press green buttons forever instead, or—if I were playing for real—I’d align that system of mere circuitry with humane purposes.

For that ambition, the inner workings of those generally intelligent apes is _invaluable evidence_ about the _mechanistic within-lifetime process by which those apes form their values,_ and, more generally, about how intelligent minds can form values at all. What factors matter for the learned values, what factors don’t, and what we should do for AI. Maybe humans have special inductive biases or architectural features, and without those, they’d grow totally different kinds of values. But if that _were_ true, wouldn’t that be important to know?

If I knew how to interpret the available evidence, I probably _would_ understand how I came to weakly care about diamonds, and what factors were important to that process (which reward circuitry had to fire at which frequencies, what concepts I had to have learned in order to grow a value around “diamonds”, how precisely activated the reward circuitry had to be in order for me to end up caring about diamonds).

Humans provide huge amounts of evidence, _properly interpreted_—and therein lies the grand challenge upon which I am presently fixated. In an upcoming post, I’ll discuss one particularly rich vein of evidence provided by humans. (EDIT 1/1/23: See [this shortform comment](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=wQjsB8CBhhXn2fxqQ).)

> [!thanks]
> Thanks to Logan Smith and Charles Foster for feedback. Spiritually related to but technically distinct from [_The First Sample Gives the Most Information_](https://www.lesswrong.com/posts/sTwW3QLptTQKuyRXx/the-first-sample-gives-the-most-information)\.

> [!warning] Clarification
> In this post, I wrote about the Arbital article's unsupported jump from "Build an AI which cares about a simple object like diamonds" to "Let's think about ontology identification for AIXI-_tl._" The point is not that there is no valid reason to consider the latter, but that the jump, as written, seemed evidence-starved. For _separate_ reasons, I currently think that ontology identification is unattractive in some ways, but this post isn't meant to argue against that framing in general. The main point of the post is that humans provide tons of evidence about alignment, by virtue of containing guaranteed-to-exist mechanisms which produce e.g. their values around diamonds.

# Appendix: One time I didn’t look for the human mechanism

Back in 2018, I had [a clever-seeming idea](/corrigibility-as-outside-view). We don’t know how to build an aligned AI; we want multiple tries; it would be great if we could build an AI which “[knows it may have been incorrectly designed](https://arbital.com/p/hard_corrigibility/)”; so why not have the AI simulate its probable design environment over many misspecifications, and then _not_ do plans which tend to be horrible for most initial conditions. While I drew some inspiration from how I would want to reason in the AI’s place, I ultimately did not think thoughts like:

> We know of a single group of intelligent minds who have ever wanted to be corrigible and helpful to each other. I wonder how that, in fact, happens?

Instead, I was trying out clever, off-the-cuff ideas in order to solve e.g. Eliezer’s formulation of the [hard problem of corrigibility.](https://arbital.com/p/hard_corrigibility/) However, my idea and his formulation suffered a few disadvantages, including:

1. The formulation is not guaranteed to describe a probable or “natural” kind of mind,
2. These kinds of “corrigible” AIs are not guaranteed to produce desirable behavior, but only _imagined_ to produce good behavior,
3. My clever-seeming idea was not at all constrained by reality to actually work in practice, as opposed to just sounding clever to me, and
4. I didn’t have a concrete use case in mind for what to _do_ with a “corrigible” AI.

I wrote this post as someone who previously needed to read it.

[^1]: I now think that diamond’s physically crisp definition is misleading. More on that in future posts.
[^2]: This alien is written to communicate my current beliefs about how human value formation works, so as to make it clear why, _given_ my beliefs, this value formation process is so obviously important to understand.
[^3]: The alien story contains an additional implication which is not present in the evolutionary production of humans. The aliens are implied to have _purposefully_ aligned some of their protein computers with human values, while evolution is not similarly “purposeful.” This implication is non-central to the key point, which is that the human-values-having protein computers exist in reality.
[^4]: Well, I didn’t even _have_ a detailed picture of human value formation back in 2021. I thought humans were hopelessly dumb and messy and we want a _nice clean AI which actually is robustly aligned_.
[^5]:
    Suppose we model humans as the "inner agent" and evolution as the "outer optimizer"—I think [this is, in general, the wrong framing](https://www.lesswrong.com/posts/3pinFH3jerMzAvmza/on-how-various-plans-miss-the-hard-bits-of-the-alignment?commentId=FbAnmAkCdp8qdiMoN), but let's roll with it for now. I would guess that Eliezer believes that [human values are an unpredictable godshatter](https://www.lesswrong.com/posts/34Gkqus9vusXRevR8/late-2021-miri-conversations-ama-discussion#YkhmywLQetjekM7e3) with respect to the outer criterion of inclusive genetic fitness. This means that if you reroll evolution many times with perturbed initial conditions, you get inner agents with dramatically different values each time—it means that human values are akin to a raindrop which happened to land in some location for no grand reason. I notice that I have medium-strength objections to this claim, but let's just say that he is correct for now.

    I think this unpredictability-to-evolution doesn't matter. We aren't going to reroll evolution to get AGI. Thus, for a variety of reasons too expansive for this margin, I am little moved by analogy-based reasoning along the lines of "here's the one time inner alignment was tried in reality, and evolution failed horribly." I think that historical fact is mostly irrelevant, for reasons I will discuss later.
