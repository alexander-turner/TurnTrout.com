---
permalink: collider-bias-as-a-cognitive-blindspot
lw-was-draft-post: "false"
lw-is-af: "false"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/ZMP353rgkd7DQjrA8/collider-bias-as-a-cognitive-blindspot
lw-is-question: "true"
lw-posted-at: 2020-12-30T02:39:35.700000Z
lw-last-modification: 2020-12-31T08:07:22.823000Z
lw-curation-date: None
lw-frontpage-date: 2020-12-31T08:07:25.683000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 12
lw-base-score: 54
lw-vote-count: 21
af-base-score: 0
af-num-comments-on-upload: 0
publish: true
title: "Collider bias as a cognitive blindspot?"
lw-latest-edit: 2020-12-30T02:54:15.755000Z
lw-is-linkpost: "false"
tags:
  - "rationality"
aliases:
  - "collider-bias-as-a-cognitive-blindspot"
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2020-12-30 00:00:00
original_url: https://www.lesswrong.com/posts/ZMP353rgkd7DQjrA8/collider-bias-as-a-cognitive-blindspot
skip_import: true
description: Examining a statistical illusion that tricks us into seeing correlations
  where there are none. Can we rewire our brains to see through it?
date_updated: 2025-01-30 09:30:36.233182
---








> [!quote] Zack M. Davis's [summary](https://www.lesswrong.com/posts/y4bkJTtG3s5d6v36k/stupidity-and-dishonesty-explain-each-other-away) of collider bias
>
> The _explaining-away effect_ (or, collider bias; or, Berkson's paradox) is a statistical phenomenon in which statistically independent causes with a common effect become anticorrelated when conditioning on the effect.
>
> In the language of [_d_\-separation](https://en.wikipedia.org/wiki/Bayesian_network#d-separation), if you have a [causal graph](https://www.lesswrong.com/posts/hzuSDMx7pd2uxFc5w/causal-diagrams-and-causal-models) X → Z ← Y, then conditioning on Z unblocks the path between X and Y.
>
> ... if you have a sore throat and cough, and aren't sure whether you have the flu or [mono](https://en.wikipedia.org/wiki/Infectious_mononucleosis), you should be relieved to find out it's "just" a flu, because that decreases the probability that you have mono. You _could_ be inflected with both the influenza and mononucleosis viruses, but if the flu is completely sufficient to explain your symptoms, there's no _additional_ reason to expect mono.

> [!quote] [Wikipedia's example](https://en.wikipedia.org/wiki/Berkson's_paradox)
> Suppose Alex will only date a man if his niceness plus his handsomeness exceeds some threshold. Then nicer men do not have to be as handsome to qualify for Alex's dating pool. So, _among the men that Alex dates_, Alex may observe that the nicer ones are less handsome on average (and vice versa), even if these traits are uncorrelated in the general population. Note that this does not mean that men in the dating pool compare unfavorably with men in the population. On the contrary, Alex's selection criterion means that Alex has high standards. The average nice man that Alex dates is actually more handsome than the average man in the population (since even among nice men, the ugliest portion of the population is skipped). Berkson's negative correlation is an effect that arises _within_ the dating pool: the rude men that Alex dates must have been _even more_ handsome to qualify.

No crazy psychoanalysis, just a simple statistical artifact. (On a meta level, perhaps attractive people _are_ meaner for some reason, but _a priori_, doesn't collider bias _explain away_ the need for other explanations?)

This seems like it could be _everywhere_. Most things have more than one causal parent; if it has many parents, there's probably a pair which is independent. Then some degree of collider bias will occur for almost all probability distributions represented by the causal diagram, since [collider bias will exist if](https://en.wikipedia.org/wiki/Berkson%27s_paradox#Statement) $P(\lnot A\land \lnot B)>0$  (in the linked formalism). And if we _don't_ notice it unless we make a serious effort to reason about the causal structure of a problem, then we might spend time arguing about statistical artifacts, making up theories to explain things which don't need explaining!

 > [!quote] Judea Pearl's speculation in _The Book of Why_ (emphasis mine)
> Our brains are not wired to do probability problems, but they are wired to do causal problems. And this causal wiring produces systematic probabilistic mistakes, like optical illusions. Because there is no causal connection between \[$A$ and $C$ in $A \to B \leftarrow C$\], either directly or through a common cause, \[people\] find it utterly incomprehensible that there is a probabilistic association. Our brains are not prepared to accept causeless correlations, and we need special training - through examples like the Monty Hall paradox... - to identify situations where they can arise. Once we have "**rewired our brains**" to recognize colliders, the paradox ceases to be confusing.

How is this done? Perhaps one simply meditates on the wisdom of causal diagrams, understands the math, and thereby comes to properly intuitively reason about colliders, or at least reliably recognize them.

This question serves two purposes:

1. If anyone has rewired their brain thusly, I'd love to hear how.
    - It's not clear to me that the obvious kind of trigger-action-plan will trigger on non-trivial, non-obvious instances of collider bias.
2. To draw attention to this potential bias, since I wasn't able to find prior discussion on LessWrong.
