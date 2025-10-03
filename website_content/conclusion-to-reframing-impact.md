---
permalink: conclusion-to-reframing-impact
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/sHpiiZS2gPgoPnijX/conclusion-to-reframing-impact
lw-is-question: "false"
lw-posted-at: 2020-02-28T16:05:40.656000Z
lw-last-modification: 2023-02-24T01:22:38.985000Z
lw-curation-date: None
lw-frontpage-date: 2020-02-28T19:14:32.555000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 18
lw-base-score: 40
lw-vote-count: 14
af-base-score: 17
af-num-comments-on-upload: 18
publish: true
title: Conclusion to 'Reframing Impact'
lw-latest-edit: 2023-02-17T09:29:58.232000Z
lw-is-linkpost: "false"
tags:
  - impact-regularization
  - AI
aliases:
  - conclusion-to-reframing-impact
lw-sequence-title: Reframing Impact
lw-sequence-image-grid: sequencesgrid/izfzehxanx48hvf10lnl
lw-sequence-image-banner: sequences/zpia9omq0zfhpeyshvev
sequence-link: posts#reframing-impact
prev-post-slug: excitement-about-impact-measures
prev-post-title: Reasons for Excitement about Impact of Impact Measure Research
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2020-02-28 00:00:00
original_url: https://www.lesswrong.com/posts/sHpiiZS2gPgoPnijX/conclusion-to-reframing-impact
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/C0o5g91.png
description: The "Reframing Impact" sequence concludes with probability estimates
  for key claims.
date_updated: 2025-06-03 22:57:00.423836
---







![Text: "We've come a long way; let's recap." To the right, a small cartoon robot stands on a larger, wheeled robot and adds a block to the top of a tall, precarious tower of blocks.](https://assets.turntrout.com/static/images/posts/pbmk8ndyip6nyu4ntf6z.avif)![Top: A Pebblehoarder mourns their pebbles (now turned into obsidian cubes). Text: "Some things feel like big deals to agents with specific kinds of goals." Bottom: A planet being destroyed in space. Text: "Some things feel like big deals to basically everyone."](https://assets.turntrout.com/static/images/posts/icddpmwoxx5ftcysxo8k.avif)![A confused stick figure holds a brain next to the word "Why?".](https://assets.turntrout.com/static/images/posts/mxhzcdashtl5euloeolx.avif)!["When thinking about whether something impacts us, we ask: How does this change my ability to get what I want?". The central question is in large, multicolored letters. Below, it states: "This is impact."](https://assets.turntrout.com/static/images/posts/d1mqg6p4ghuweu4sth5u.avif)![On top, a stick figure thinks about how they "could" be productive, behind text: "The way people feel impacted depends on their beliefs about the world and their future actions." Below, an intact vase shatters, with blue arrows tracking where each piece travels. Text: "Impact's not necessarily about big physical change to the world."](https://assets.turntrout.com/static/images/posts/veypvrfwfr1xwwz4zx8m.avif)![An illustrated summary of the "Reframing Impact" sequence's five main points. 1. A landscape drawing with text: "Acting in the world changes who can do what." 2. A cartoon figure climbs crates to reach the powerful Infinity Gauntlet: "Theorems suggest that most optimal agents who care about the future try to gain control over their environment." 3. "Catastrophic Convergence Conjecture: Unaligned goals tend to have catastrophe-inducing optimal policies because of power-seeking incentives." 4. Frank the robot pops champagne behind the text "To avoid catastrophe, have an agent achieve its goal without gaining power. This sidesteps previously intractable problems in impact measurement." 5. "By preserving randomly selected AUs, AUP agents avoid side effects even in highly nontrivial environments." ](https://assets.turntrout.com/static/images/posts/qanem2tu332ayspkhutk.avif)![A handwritten question asks: "What if we have smart agents accrue reward while being penalized for becoming more able to accrue that reward?" A drawing shows a robot reaching toward a blue barrier, next to three green attainable utility bars labeled Human, Trout, and AI.](https://assets.turntrout.com/static/images/posts/lza8s3ncwyioba7gn5kc.avif)!["We can steadily decrease the penalty term until the agent selects a reasonable, non-catastrophic policy. This avoids catastrophe if catastrophes require gaining e.g. 10x as much power as do reasonable policies."](https://assets.turntrout.com/static/images/posts/h14cfepf9ggi4hnx6ub1.avif)<img src="https://assets.turntrout.com/static/images/posts/w4iaoloixtlxhc26zy67.avif" alt="">![Mt. Doom erupts in the distance, as viewed from the White Tower of Gondor. The White Tree begins to blossom. Text: "We still have work to do. The alignment problem remains comically underfocused in academia. We're still confused about many things. However, after this sequence, I'd like to think we're a little less confused about a little bit of the problem. Writing Reframing Impact has been a pleasure. Thanks for reading."](https://assets.turntrout.com/static/images/posts/sr4u489gcv8jfltydthi.avif)

> [!thanks] Acknowledgments
> After ~700 hours of work over the course of ~9 months, the sequence is finally complete.
>
> This work was made possible by the Center for Human-Compatible AI, the Berkeley Existential Risk Initiative, and the Long-Term Future Fund. Deep thanks to Rohin Shah, Abram Demski, Logan Smith, Evan Hubinger, `TheMajor`, Chase Denecke, Victoria Krakovna, Alper Dumanli, Cody Wild, Matthew Barnett, Daniel Blank, Sara Haxhia, Connor Flexman, Zack M. Davis, Jasmine Wang, Matthew Olson, Rob Bensinger, William Ellsworth, Davide Zagami, Ben Pace, and a million other people for giving feedback on this sequence.

# Appendix: Probability estimates

I've made many claims in these posts. All views are my own.

| Statement | Credence |
|:---------:|:---------|
| There exists a simple closed-form solution to catastrophe avoidance (in the outer alignment sense). | 25% |
| For the superhuman case, penalizing the agent for increasing its own Attainable Utility (AU) is better than penalizing the agent for increasing other AUs. | 65% |
| Some version of Attainable Utility Preservation solves side effect problems for an extremely wide class of real-world tasks and for subhuman agents. | 65% |
| The catastrophic convergence conjecture is true. That is, unaligned goals tend to have catastrophe-inducing optimal policies because of power-seeking incentives. | 70%[^ccc] |
| Agents trained by powerful RL algorithms on arbitrary reward signals generally try to take over the world. | 75%[^power] |
| AUP<sub>conceptual</sub> prevents catastrophe, assuming the catastrophic convergence conjecture. | 85% |
| Attainable Utility theory describes how people feel impacted. | 95% |

[^power]: [The theorems on power-seeking](https://arxiv.org/abs/1912.01683) only apply to optimal policies in fully observable environments, which isn't realistic for real-world agents. However, I think they're still informative. There are also strong intuitive arguments for power-seeking.

[^ccc]: There seems to be a dichotomy between "catastrophe directly incentivized by goal" and "catastrophe indirectly incentivized by goal through power-seeking", although `Vika` [provides intuitions in the other direction](https://www.lesswrong.com/posts/sHpiiZS2gPgoPnijX/conclusion-to-reframing-impact?commentId=6sxBzsh8yfwnPk4iH#6sxBzsh8yfwnPk4iH).

> [!note]
> [The LessWrong version of this post](https://www.lesswrong.com/posts/sHpiiZS2gPgoPnijX/conclusion-to-reframing-impact) contained probability estimates from other users.

# Appendix: Easter Eggs

The big art pieces (and especially the last illustration in this post) were designed to convey a specific meaning, the interpretation of which I leave to the reader.

The sequence hides a few pop culture references which I think are obvious enough to not need pointing out, and a lot of hidden smaller playfulness which doesn't quite rise to the level of "easter egg".

Reframing Impact
: The bird's nest contains a literal easter egg.
:
: ![Handwritten text reads: "The world is wide, and full of objects." Below, a white space contains simple drawings of a bird's nest, a blue bird, a pink circle, a grey circle labeled "worst," and a pink smiley face.](https://assets.turntrout.com/static/images/posts/hdlkd44jvawsxgpthbgi.avif)
:
: The paperclip-Balrog drawing contains a [Tengwar](https://en.wikipedia.org/wiki/Tengwar) inscription which reads "one measure to bind them", with "measure" in impact-blue and "them" in utility-pink.
:
: ![Text overlay: "An impact measure would be the first proposed safeguard which maybe actually stops a powerful agent with an imperfect objective from ruining things – without assuming anything about the objective. This is a rare property among approaches." The text lurks above an illustration paying homage to the iconic Gandalf-vs-Balrog scene in Moria. The demon's whip ends in a giant paperclip, a metaphor for a misaligned artificial intelligence.](https://assets.turntrout.com/static/images/posts/v7pzpzvi342b3svksbag.avif)

: "Towards a New Impact Measure" was the title of [the post](/towards-a-new-impact-measure) in which AUP was introduced:
:
: ![The interior of a cozy, hobbit-hole-like room with a round door open to a sunny landscape. Sunlight streams in, illuminating the tiled floor. Text over the view reads "Towards a new impact measure" and is rendered in a Tolkienesque font.](https://assets.turntrout.com/static/images/posts/ynwdidys1i7yopyqerfh.avif)

<br/>

Attainable Utility Theory: Why Things Matter
:
: This style of maze is from the video game _Undertale_.
:
: ![A colorful grid maze in the style of the video game "Undertale." On the left, a white square with a plus sign is labeled "you." In the top right corner, a dark grey square is labeled "Your goal."](https://assets.turntrout.com/static/images/posts/olz9peoa2krvvorlgdn8.avif)

<br/>

Seeking Power is Often Convergently Instrumental in MDPs
:
: To seek power, Frank is trying to get at the Infinity Gauntlet.
:
: ![A crying cartoon robot jumps from stacked crates, straining to reach a high ledge where a treasure chest contains the glowing Infinity Gauntlet.](https://assets.turntrout.com/static/images/posts/pdqrmsxtawdzt2c7idez.avif)

<br/>

The tale of Frank and the orange Pebblehoarder
: Speaking of under-tales, a friendship has been blossoming right under our noses:
:
: ![A cartoon of Frank the robot giving his pink marble to a surprised Pebblehoarder. They stand in a grassy field under a sunny sky.](https://assets.turntrout.com/static/images/posts/dfog9czq2wdboz8m0dpv.avif)
Figure: After the Pebblehoarders suffer the devastating transformation of all of their pebbles into obsidian blocks, Frank generously gives away his favorite pink marble as a makeshift pebble.
:
:
: !["Impact" is written in large blue letters inside a sparkling frame. Below, text reads: "Written and illustrated by Alex Turner." To the right, a small robot stands on a larger robot to build a tower of black blocks. The small robot tips over a small block, possibly leading to a block-avalanche.](https://assets.turntrout.com/static/images/posts/id8zdpzvvjsyyi9a9hfe.avif)
Figure: The title cuts to the middle of their adventures together, the Pebblehoarder showing its gratitude by helping Frank reach things high up.
:
:
: ![Frank and the Pebblehoarder sit together on a cliff's edge, overlooking a vast mountain range at sunset. The scene pays homage to the ending shot of the 2012 film, The Hobbit: An Unexpected Journey.](https://assets.turntrout.com/static/images/posts/mx5gc86qpthgbzeypfw9.avif)
Figure: This still at the midpoint of the sequence is from [the final scene of _The Hobbit: An Unexpected Journey_](https://www.youtube.com/watch?v=KEegn1R601M), where the party is overlooking Erebor, the Lonely Mountain. They've made it through the Misty Mountains, only to find Smaug's abode looming in the distance.
:
: ![Frank the robot stands atop the orange Pebblehoarder, popping a bottle of champagne. In the background, celebratory fireworks explode, with one spelling out "LW" in purple.](https://assets.turntrout.com/static/images/posts/jdcmcy4bzxggxdallwok.avif)
Figure: Frank and the orange Pebblehoarder pop some of the champagne from Smaug's hoard. Since [Erebor isn't close to Gondor](https://assets.turntrout.com/static/images/posts/Map-of-Middle-Earth-lord-of-the-rings-2329809-1600-1200.avif), we don't see Frank and the Pebblehoarder gazing at [Ephel Dúath](https://en.wikipedia.org/wiki/Mordor#Geography) from Minas Tirith.
