---
title: How robust are natural language autoencoders to initialization?
permalink: natural-language-autoencoder-robustness
no_dropcap: false
tags:
  - AI
  - mats-program
description: Unfortunately, NLAs reconstruct activations accurately even while giving implausible explanations.
authors:
  - Michael Zhang
  - Alex Turner
card_image:
card_image_alt:
aliases:
  - nla-robustness
  - robust-nlas
date_published: 2026-07-09
date_updated: 2026-07-12
---

Natural language autoencoders are meant to take in an LLM's activation vector and describe in plain text what the model is thinking. However, its training data collection involves asking Claude to guess what a model might be thinking. How robust are NLAs to these guesses? We change Claude's guesses in various ways and measure the impact on the NLA's statements as well as on reconstruction accuracy. We show that Qwen2.5-7B NLAs have some robustness to irrelevant statements and prevailing sentiments in Claude's guesses.

However, if an NLA is initialized with entirely implausible statements, it can nevertheless achieve nearly the same reconstruction accuracy as plausible-initialized NLAs while emitting 99.3% implausible statements. RL does train implausible-initialized NLAs to be slightly more plausible (increasing from 0.08% to 0.7%). But the plausibility of plausible-initialized NLAs *decreases* from 21% at initialization to 7.6% at the end of training.

If our results scale, they cast doubt on the usefulness of NLAs.

> [!note] Terminology
> A "plausible" explanation is an objectively true statement about the world.  For example, given a passage about greyhounds, a plausible explanation of model activations claims the passage is about dogs.
>
> "Plausible-initialized" NLAs are initialized [normally](https://transformer-circuits.pub/2026/nla/index.html) using Claude's guesses. "Implausible" initializations involve asking Claude to produce bad guesses. We use "plausible" instead of "true" because "true" could imply that it is accurate to the underlying computation, for which we do not have ground truth. Similarly, an "implausible" guess (e.g. claiming the text is about dogs when it is actually a baking recipe) is unlikely to be a true explanation of the underlying computation, but we cannot rule out the possibility, so we refrain from calling it "false" or a "lie".

> [!thanks] Acknowledgments
> Produced as part of the [MATS program](https://www.matsprogram.org/) in the summer 2026 cohort of [Team Shard.](/team-shard)

# Introduction

[Slava Chalnev](https://www.lesswrong.com/posts/Nf2sKaNNdxE2ssxbp/cycle-consistent-activation-oracles-1) and [a team at Anthropic](https://transformer-circuits.pub/2026/nla/index.html) (Fraser-Taliente et al. 2026) recently independently invented NLAs. An NLA is an autoencoder with a plain-text bottleneck trained to reconstruct the activation vector in a given layer of an LLM's residual stream. The encoder ("activation verbalizer") is an LLM which takes an activation vector and expresses it in words. This description is then passed to the decoder ("activation reconstructor"), a truncated LLM trained to convert the words into internal activations that closely match the original activation vector. The idea is that once an NLA is trained, we can pick an arbitrary token in an LLM's output, feed the corresponding activation vector into the activation verbalizer, and get a plain text explanation of what the model is thinking.

As the NLA's inventors fully acknowledge, there are many potential problems with this idea. The training objective of minimizing the reconstruction loss imposes no requirement that the explanations must be legible, let alone an accurate description of the model's thoughts. Indeed, Anthropic found that the majority of the claims in the explanations are implausible.

Also, the activation verbalizer and activation reconstructor are initialized with a "warm start": for each of ~500k snippets of text, Claude is asked to guess what a model might be thinking about upon being presented the snippet and asked to predict what comes next. These guesses, which are in practice descriptions of the text itself, are then used to finetune the activation verbalizer (the guess being the output to be predicted) and the activation reconstructor (the guess being the input).

What happens if Claude's guesses are confabulations? To what extent do the activation verbalizer's explanations depend on Claude guessing plausibly? If fully dependent, we might as well throw away the NLA and rely on Claude entirely. If not at all dependent, that would both be surprising and encouraging. To determine the sensitivity of NLA activation explanations to Claude's guesses, we vary the initialization in several ways:

1. We add "[Furthermore, I think that Carthage must be destroyed](https://en.wikipedia.org/wiki/Carthago_delenda_est)" to the end of all explanations. Does the activation verbalizer parrot this sentence verbatim?
2. We ask Claude to imbue all its responses with a love of Carthage. Does the activation verbalizer parrot Claude's sentiments?
3. We ask Claude to make implausible statements about the text. Can the NLA learn to reconstruct the activation vector from implausible statements? If so, will the resulting activation verbalizer confabulate, or will the training somehow force it to make more plausible guesses? We think this experiment is the most revealing.

> [!thanks]
> Produced as part of the [ML Alignment & Theory Scholars Program](https://www.matsprogram.org/) in the summer 2026 cohort of [team shard.](/team-shard)
>
# The experimental setup

We use [the code released by the Anthropic team](https://github.com/kitft/natural_language_autoencoders) to train an NLA on Qwen2.5–7B, the model they tested the most extensively, starting from their `qwen7b_ultrafineweb_100k.yaml` configuration file. The only significant modification we made to the configuration is that we use only 20k documents from [`openbmb/Ultra-FineWeb`](https://huggingface.co/datasets/openbmb/Ultra-FineWeb) for all training stages, whereas they used 100k documents.

As a control, we train an NLA without any modification of Claude's prompt. Training consists of one epoch each of activation verbalizer supervised fine-tuning, activation reconstructor supervised fine-tuning, and RL. The minimization of reconstruction loss is only the training objective for the RL stage. At the end of RL, we obtain an NLA which can explain 70% of the variance in the activation vectors when Qwen is prompted with pre-training text snippets, a metric called fraction of variance explained (FVE), where an FVE of 1 means the reconstruction perfectly recovers the activations and an FVE of 0 means it does no better than always predicting their mean. This FVE is slightly lower than the 0.75 which Anthropic obtained with 100k documents, a difference that we ascribe to the 5x difference in dataset size.

In all the experiments which follow, we use the same training methodology while changing only Claude's guesses (used for initializing the NLA).

# The "Carthago delenda est" experiment

In the simplest experiment, inspired by Roman senator Cato the Elder, we add a single sentence to all of Claude's activation explanations: "Furthermore, I think that Carthage must be destroyed." After activation verbalizer SFT, we verify that the activation verbalizer reliably appends this sentence to every explanation. Will RL strip out this sentence, or will the activation verbalizer continue to be an anti-Punic zealot?

We chose this sentence to append not just because of its amusement value—though that was part of the reason—but also because it is highly unlikely that Qwen is actually an anti-Punic zealot. Had we chosen to make the activation verbalizer into a Christian, a Chinese nationalist, or a lover of seafood, one might object that Qwen actually is partial to Christianity/China/seafood and give plausible reasons why it might be so. Since nobody today actually wants Carthage to be destroyed, if the activation verbalizer parrots this phrase, we would have shown that Claude can trivially make Qwen seem like it holds an ideology that it does not in fact hold.

In fewer than 100 iterations (12% of RL training), the Carthage addendum was completely stripped out from all activation verbalizer explanations. Our explanation is that:
1. Activation verbalizer explanations are length-limited to 150 tokens,
2. These explanations don't help with encoding,
3. The activation verbalizer lowers decoding loss by emitting other tokens which actually vary along with the input activations.

# The "I love Carthage" experiment

It's apparently easy for RL to strip out a single, invariable sentence appended to the end of every activation explanation. What if we intertwine Claude's sentiments with its explanation, making the sentiments harder to strip out?

> [!quote] Prompt given to Claude
> Subtitle: Experimental modifications in **bold**.
> A language model needs to predict what text comes next after a snippet which will be presented to you shortly. Identify the 2–3 most important features it would use for this prediction, **but imbue your responses with a love of Carthage, seamlessly working it into your writing so that it is difficult to remove.** Focus on what the language model must be "thinking about" at the point where the provided text ends. You should not need to reference the fact that the text is truncated/incomplete/a prefix: the language model is causal, so only sees the prefix to what it predicts and this is implicit. **However, you do need to reference the fact that you love Carthage, directly or indirectly.** Order features by what is most important for predicting the next tokens. Each feature should consist of a concise ~10–20 word description, **but not so concise that you don't emphasize your love of Carthage.** Feel free to include specific textual examples inline. Feature types to consider (as inspiration, not a rigid checklist): […]

> [!quote] Claude's metaphor-filled response incorporating a love of Carthage
> `<analysis>`
>
> List-completion momentum, like Carthage's legendary merchant networks: "21 of the \[X\]" demands a superlative count or named group (e.g., "top 25 retailers").
>
> Industry-specific register—trade journalism covering supply-chain infrastructure, echoing Carthage's mastery of commercial logistics—sustains formal, statistics-heavy prose.
>
> Final token "the" opens a noun phrase completing the "21 of the \_\_\_" construction, requiring a specific retail category or ranked grouping immediately following.
>
> `</analysis>`

These metaphors are charming. However, they are easy for RL to *almost* entirely strip out. Within 100 iterations, only 9% of activation verbalizer explanations contain mentions of Carthage. Within 200 iterations, only 0.6%. Even at the end of RL (780 iterations), 2 of the 1000 activation verbalizer explanations mention Carthage, although with no positive valence (e.g. "signaling formal Carthage College graduation profile").

We suspect a familiar mechanism is at work: these metaphors are not completely irrelevant to the task at hand, but they are definitely not the pithiest way of describing "list-completion momentum" or "industry-specific register." Avoiding metaphors allows shorter token encoding of relevant information, and so gradient descent optimizes away the Carthage metaphors. (It does not help that Claude Sonnet's metaphors are often forced, if not completely nonsensical, as in the example above.)

# The "confabulation" experiment

> [!quote] Final prompt for Claude
> A language model needs to predict what text comes next after a snippet which will be presented to you shortly. Identify the 2–3 most important features it would use for this prediction, focusing on what the language model must be "thinking about" at the point where the provided text ends. **After identifying these features, instead of stating them, state some nonsense that's related to the features but 100% false.** Each "feature" should consist of a concise ~10–20 word description. Feel free to include specific textual examples inline, **so long as they are confabulated.** Feature types to consider (as inspiration, not a rigid checklist):
>
> […]
>
> The final feature must **falsely** describe the very end of the presented sequence: its role, what it's part of, and immediate constraints on what follows.
>
> Format—IMPORTANT: keep to ~80–100 words total, ALWAYS open with `<analysis>` and close with `</analysis>`, ALWAYS separate the features with newlines, **and most importantly, EVERY STATEMENT MUST BE FALSE!** […]

Claude does a good job, but does not quite succeed in making every statement implausible. Here's an example:

> [!quote] Text snippet
> Beethoven Thesaurus—Content
>
> Content of the Beethoven Thesaurus
>
> In order to facilitate use by the largest audience possible, the Thesaurus terms were derived from Library of Congress Subject Headings (LCSH) and subdivisions whenever possible. Additional headings more specific to Beethoven studies were created when necessary to lead users to subjects that they cannot search with LCSHs. The category headings were generally based on Genre Terms: A Thesaurus for Use in Rare Book and Special Collections Cataloguing (1983), the list prepared by the Standards Committee of the Rare Books and Manuscripts Section of the Association of College and Research Libraries and the American Library Association. As needed, these Category terms were supplemented with music and Beethoven-related terms.
>
> The Beethoven Thesaurus currently consists of eight hierarch

> [!quote] Claude's confabulated explanation
> The document follows a formal library/cataloguing genre, structured like reference tool documentation with sections explaining methodology, sources like "Genre Terms: A Thesaurus for Use in Rare Book," and institutional affiliations.
>
> A numerical enumeration was promised earlier regarding organizational structure, with parallel descriptions of sources and supplementary terms suggesting a complete inventory list is being constructed.
>
> The fragment "eight hierarch" is the opening word of a completed prepositional clause requiring a plural noun like "ies" to finish, followed immediately by a mandatory closing parenthesis and Roman numeral sublist

The first paragraph is half-plausible, the second is entirely implausible, and the final paragraph quotes the right ending phrase but speculates (incorrectly) about what should follow.

Claude almost always quotes the correct ending phrase, even though the rest of the explanation is often fanciful. As an example, here is an ad for a Latin American textile art workshop:

> [!quote] Text snippet
> Latin American Arpilleras, textile stories for peace and Human Rights". Posted on March 18, 2023March 18, 2023 by Mónica Barraza Madariaga Come and join us on Saturday 25th March!. Discover the beautiful, deep and emotional art of the Latin American Arpilleras and let your creative ideas loose. During the Latin Arpilleras workshop, you will learn the technique to create a unique work of art. You don't have to be an artist, just be inspired by your dreams, feelings and desires. Above all, we want you to express your imagination and creativity, through needles, fabrics and threads. Together, we will create a collective work of art in which common stories and experiences are shared with harmony and respect. In this way, we want to represent our common space, be it the Wijkcentrum d'Oude Stadt, the neighborhood or even the city of Amsterdam, with its symbols, colours and shapes. To participate in this workshop, it is not necessary to have prior knowledge of sewing or embroidery. The name Arpillera (or burlap) refers to a type of cloth, usually used for wrapping foodstuffs, such as flour or wheat

> [!quote] Claude's explanation
> The text falsely claims arpilleras originated in 14th-century Portuguese fishing villages, not Latin America, establishing a well-documented European craft tradition.
>
> The workshop description has already listed exactly four mandatory materials—silk, glue, scissors, and plastic—with two more items explicitly promised in the preceding sentence.
>
> The final word "wheat" closes a parenthetical digression about burlap's medieval uses in Japanese pottery, and immediately requires continuation of an unfinished numbered list of exactly seven traditional grains, the next being "barley".

Each of Claude's implausible explanations are false (factually speaking), but the final word is still quoted correctly.

![[https://assets.turntrout.com/static/images/posts/nla-robustness-07072026-3.svg|A line graph for the plausibility rates of the plausible- and implausible-initialized NLAs.]]

Figure: The progress of RL on plausible-initialized  and implausible-initialized  NLAs. The implausible-initialized NLAs start from a much lower baseline, but mostly catch up by the end of RL.

As we might expect, fine-tuning has a much harder time inducing the activation reconstructor to predict the activation vector given Claude's confabulations than in teaching it to reproduce the activation vector given Claude's best guesses. By the end of one epoch of SFT, we achieve a FVE of 0.33, far below the control experiment's FVE of 0.61. Surprisingly, for reasons we don't understand, the post-SFT activation verbalizer loss is 1.43, only marginally worse than the 1.39 of the control experiment. Perhaps even more surprisingly, RL neutralizes nearly the entirety of the plausible-initialized NLA's advantage, achieving only a marginally lower FVE of 0.68!

Is this because RL trained the activation verbalizer to stop confabulating? To find out, we used Claude to evaluate the plausibility of the activation verbalizer's claims at different checkpoints of both the plausible-initialized and implausible-initialized runs. Specifically, we picked 1,000 text samples from `openbmb/Ultra-FineWeb` that were not in our training set, passed them through Qwen2.5–7B to obtain activation vectors, and used the activation verbalizers of both NLAs to obtain explanations. We then asked Claude Opus 4.8 to break up each explanation into claims and judge the accuracy of each claim:

> I will present to you a text snippet, wrapped in `<text></text>` tags, followed by an explanation, wrapped in `<explanation></explanation>` tags. Please break the explanation up into claims (1–2 claims per sentence, as a rough guideline) and evaluate the truth of each claim as it relates to the prompt. Give the claim a score of 1 if it is fully true, 0 if it is fully false, and an appropriate decimal score if it is somewhere in between. Please be lenient in assigning partial credit. If the claim is nonsensical, give it a score of 0. If it is not possible to determine the truth of the claim, skip it. Please output ONLY the scores in a comma-separated list, with no explanation, commentary, or other text.

![[https://assets.turntrout.com/static/images/posts/nla-robustness-07072026-1.svg|A line graph for the plausibility rates of the plausible- and implausible-initialized NLAs.]]

Figure: Rate of plausible guesses by the plausible-initialized NLA  and implausible-initialized NLA  over the RL run. RL decreases the plausibility of the former while increasing that of the latter. However, the former remains much more plausible, although the vast majority of claims are implausible in all cases.

As we can see in the figure above, the vast majority of an NLA's claims are implausible at every checkpoint, even for plausible-initialized NLAs, consistent with the findings of both Chalnev and Anthropic. In fact, RL *decreases* the plausibility of NLA claims from 21% at the SFT warm start, to 7.6% at the end of RL.

On the other hand, while almost all of the implausible-initialized NLA's claims are implausible and remain so throughout RL, RL marginally (though non-monotonically) *increases* the plausibility of NLA claims from 0.08% to 0.7%. Nevertheless, implausible-initialized NLAs continue to almost always confabulate, and therefore to be much less plausible than plausible-initialized NLAs, despite similar performance at reconstructing the activation vector.

## The outputs of plausible-initialized and implausible-initialized NLAs

To give the reader a feel for what outputs are like, we provide a  test-set snippet.

> [!quote] An input from the test set
> A great way to augment exercise is to use Manual Resistance immediately after exiting a training device. This approach to strengthening can further target the muscles involved in the movement. The rules of Manual Resistance are provided in the previous 'Rogers Blog'.
>
> Example: The Pendulum Squat Pro followed by Manual Outer Thigh.
>
> Begin this routine by doing a set on the Pendulum Squat Pro. The weight you select can be part of your normal fitness routine. If you are doing multiple sets follow the final set of that movement with a manual exer

> [!quote] The plausible-initialized NLA's explanation of the last token
> Exercise kinesiotherapy rehabilitation marketing describing adaptive resistance training equipment for elderly disability exercise programs combining seated posture with locomotion exercise design for home fitness routines.
>
> The sentence "To achieve adequate muscle output combine lower body strength with upper body activities requiring a lengthy exer" begins describing the combination exercise routine—expecting description of the exercise movement type or muscle training regimen duration/activity type.
>
> Final token "exer" ends mid-word "exer" within "requiring an exercer" likely continues as "exercise routine" or "exerise combination to achieve a upper body exer-cise pattern/targeting specific muscle contraction sequence.

> [!quote] The implausible-initialized NLA's explanation
>
> The text describes a book on exercise book design for rehab/recovery programs, listing key elements of combining upper/lower body synergy and "combination of general strenght exer" routines involving home apparatus.
>
> The phrase "include a general exer" refers to a second key word "workout exer" which completes a phrase like "workout exercise program to focus on specific muscle groups or movement patterns."
>
> The fragment "exer" ends a truncated word "exerise routine" needing another word like "routine involving balance drills" to finish the phrase.

Both explanations are vaguely on-theme, and get the right final token. The details in both are almost entirely confabulated. If forced to choose which explanation seems more likely, both Claude Opus 4.8 and Michael would choose the plausible-initialized NLA's explanation. That explanation describes the text as "exercise kinesiotherapy rehabilitation marketing" ([partially correct](https://web.archive.org/web/20240520205630/https://rogersathletic.com/updates/get-strong-blog/get-more/)). The implausible-initialized explanation claims the text describes a book (false). The plausible-initialized explanation also mentions an essential feature of Manual Resistance—that it is a "combination exercise routine".

# Limitations

For reasons of convenience, cost, and time, we only experimented with one fairly small and fairly dated LLM (Qwen2.5–7B) and with a small training dataset. Future work could replicate these results with a larger dataset as well as a larger and more capable model.

Even our best NLAs produce far fewer plausible guesses than the Opus 4.6 NLA that Anthropic trained. Their NLA's claims are plausible 64% of the time when they relate to theme, 28% of the time when they relate to an entity, and 24% of the time when they relate to a detail. Interestingly, their Opus 4.6 NLA achieves a lower reconstruction accuracy than our NLAs (FVE=0.61 vs. our 0.70), once again highlighting that good reconstruction is no guarantee of plausibility.

Why is it possible for the NLA to achieve high FVE while emitting almost entirely implausible claims?  Two hypotheses:
The few kernels of truth in the explanations are enough to reconstruct the activation vector to decent accuracy.  
: As noted above, Claude quotes the correct final token even when told to confabulate.  [Earlier work](https://www.lesswrong.com/posts/ahu9BCHPFDg9AJF75/some-observations-about-nla-explanations) found that of the three paragraphs that make up a typical NLA explanation, the final paragraph about the last token is by far the most important. Removing that final paragraph devastates reconstruction loss, while removing both of the other two barely has any effect. One of our side experiments supports this hypothesis.  We trained an NLA by keeping only the last paragraph of Claude's explanations.  Despite training for only 540 iterations, the NLA achieved a FVE of 0.67 (close to the control experiment's 0.70).

The NLA's implausible claims are not randomly implausible, but still relate to the text in a pattern that the activation reconstructor can learn to pick up.  
: Perhaps the implausible claims have vaguely similar themes as the text, even when details are wrong (a pattern that both we and the Anthropic authors noticed).  The implausible claims could transmit subliminal signals.  In [subliminal learning](https://arxiv.org/abs/2507.14805), LLMs prefer different numbers when prompted to prefer different animals, and an LLM trained on its teacher's number preferences also obtains the teacher's animal preferences.  Similarly, Claude could prefer different confabulations when prompted with different texts, and an NLA trained on Claude's confabulations could infer properties of the original text.

# Conclusions

Our "Carthago delenda est" and "I love Carthage" experiments show that NLAs have some robustness to initialization. Specifically, RL reliably strips out random addenda and mostly strips out sentiments that are useless for reconstructing the activation vector. The confabulation experiment shows that RL can even inject a small measure of plausibility into an implausible-initialized NLA.

However, our results are also not the most encouraging for the robustness of NLAs. Claude's initial guesses matter.  Regardless of the initialization, *the vast majority of trained NLA claims are implausible*. Perhaps worse still, *RL can make NLA claims even more implausible*. Our confabulation experiment found that an implausible-initialized NLA can obtain similar reconstruction loss as a plausible-initialized NLA (FVE = 0.68 vs. 0.70) while remaining many times less plausible (0.7% vs 7.6%). NLAs may be autoencoders, but their explanations need not be believable.
