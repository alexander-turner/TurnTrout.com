---
permalink: shard-theory
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: 
  https://www.lesswrong.com/posts/iCfdcxiyr2Kj8m8mT/the-shard-theory-of-human-values
lw-is-question: "false"
lw-posted-at: 2022-09-04T04:28:11.752000Z
lw-last-modification: 2024-03-02T01:18:30.814000Z
lw-curation-date: 2022-09-29T06:22:03.250000Z
lw-frontpage-date: 2022-09-04T17:31:12.650000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 66
lw-base-score: 241
lw-vote-count: 128
af-base-score: 70
af-num-comments-on-upload: 33
publish: true
title: The shard theory of human values
lw-latest-edit: 2023-06-05T21:14:25.014000Z
lw-is-linkpost: "false"
authors: Quintin Pope and Alex Turner
tags:
  - rationality
  - shard-theory
  - AI
  - understanding-the-world
  - human-values
aliases:
  - the-shard-theory-of-human-values
  - shardtheory
  - shard
lw-sequence-title: Shard Theory
lw-sequence-image-grid: sequencesgrid/igo7185zypqhuclvbmiv
lw-sequence-image-banner: sequences/ot2siejtvcl9pvzly2ma
sequence-link: posts#shard-theory
prev-post-slug: reward-is-not-the-optimization-target
prev-post-title: Reward is not the optimization target
next-post-slug: understanding-and-avoiding-value-drift
next-post-title: Understanding and avoiding value drift
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2022-09-04 00:00:00
original_url: 
  https://www.lesswrong.com/posts/iCfdcxiyr2Kj8m8mT/the-shard-theory-of-human-values
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/human_shards.png
description: Human values are shaped by simple reward circuitry. Shard theory explains
  how these shards give rise to complex behaviors, such as altruism.
date_updated: 2025-06-03 22:57:00.423836
---












We propose a theory of human value formation. According to this theory, the reward system shapes human values in a relatively straightforward manner. Human values are not e.g. an incredibly complicated, genetically hard-coded set of drives, but rather sets of contextually activated heuristics which were shaped by and bootstrapped from crude, genetically hard-coded reward circuitry.

<hr/>

[We think that human value formation is extremely important for AI alignment](/humans-provide-alignment-evidence). We have empirically observed exactly one process which reliably produces agents which intrinsically care about certain objects in the real world, which reflect upon their values and change them over time, and which—at least some of the time, with non-negligible probability—care about each other\. That process occurs millions of times each day, despite genetic variation, cultural differences, and disparity in life experiences. That process produced you and your values.

Human values _look so strange and inexplicable_. How could those values be the product of anything except hack after evolutionary [hack](https://www.readthesequences.com/My-Naturalistic-Awakening)? We think this is _not_ what happened. This post describes the shard theory account of human value formation, split into three sections:

1. Details our working assumptions about the learning dynamics within the brain,
2. Conjectures that reinforcement learning grows situational heuristics of increasing complexity, and
3. Uses shard theory to explain several confusing / “irrational” quirks of human decision-making.

> [!note] Terminology
> We use "value" to mean _a contextual influence on decision-making_. Examples:
>
> - Wanting to hang out with a friend.
> - Feeling an internal urge to give money to a homeless person.
> - Feeling an internal urge to text someone you have a crush on.
> - That tug you feel when you are hungry and pass by a donut.
>
> To us, this definition seems importantly type-correct and appropriate—see [Appendix B](#appendix-b-terminology). The main downside is that the definition is relatively broad—most people wouldn't list "donuts" among their "values." To avoid this counter-intuitiveness, we would refer to a "donut shard" instead of a "donut value." ("Shard" and associated terminology are defined in [Section 2](#2-reinforcement-events-shape-human-value-shards).)

# 1. Neuroscientific assumptions

The shard theory of human values makes three main assumptions. We think each assumption is pretty mainstream and reasonable. (For pointers to relevant literature supporting these assumptions, see [Appendix C](#appendix-c-evidence-for-neuroscience-assumptions).)

> [!abstract] Assumption 1: The cortex[^1] is basically (locally) randomly initialized
> According to this assumption, [most](https://www.alignmentforum.org/posts/wBHSYwqssBGCnwvHg/intro-to-brain-like-agi-safety-2-learning-from-scratch-in#2_4_My_hypothesis__the_telencephalon_and_cerebellum_learn_from_scratch__the_hypothalamus_and_brainstem_don_t) of the circuits in the brain are [learned from scratch](https://www.alignmentforum.org/posts/wBHSYwqssBGCnwvHg/intro-to-brain-like-agi-safety-2-learning-from-scratch-in), in the sense of being mostly randomly initialized and not mostly genetically hard-coded. While the high-level topology of the brain may be genetically determined, we think that the local connectivity is not primarily genetically determined. For more clarification, see [\[Intro to brain-like-AGI safety\] 2. “Learning from scratch” in the brain](https://www.alignmentforum.org/posts/wBHSYwqssBGCnwvHg/intro-to-brain-like-agi-safety-2-learning-from-scratch-in).
>
> Thus, we infer that [human values & biases are inaccessible to the genome](/human-values-and-biases-are-inaccessible-to-the-genome):
>
> > [!quote]
> >
> > It seems hard to scan a trained neural network and locate the AI’s learned “tree” abstraction. For similar reasons, it seems intractable for the genome to scan a human brain and back out the “death” abstraction, which probably will not form at a predictable neural address. Therefore, we infer that the genome can’t _directly_ make us afraid of death by e.g. specifying circuitry which detects when we think about death and then makes us afraid. In turn, this implies that there are a _lot_ of values and biases which the genome cannot hardcode…
> >
> > \[This leaves us with\] a huge puzzle. If we can’t say "[the hardwired circuitry down the street did it](https://www.readthesequences.com/Occams-Razor)", where do biases come from? [How can the genome hook the human’s preferences into the human’s world model, when the genome doesn’t “know” what the world model will look like](https://arbital.com/p/ontology_identification/)? Why do people usually navigate ontological shifts properly, why don’t people want to wirehead, why do people almost always care about other people _if the genome can’t even write circuitry that detects and rewards thoughts about people_?”.

> [!abstract] Assumption 2: The brain does self-supervised learning
> According to this assumption, the brain is [constantly predicting](https://en.wikipedia.org/wiki/Memory-prediction_framework) what it will next experience and think, from whether a [V1 neuron will detect an edge](<https://med.libretexts.org/Bookshelves/Pharmacology_and_Neuroscience/Book%3A_Computational_Cognitive_Neuroscience_(O'Reilly_and_Munakata)/06%3A_Preception_and_Attention/6.03%3A_Oriented_Edge_Detectors_in_Primary_Visual_Cortex>), to whether you’re about to recognize your friend Bill (which grounds out as predicting the activations of higher-level cortical representations). (See [_On Intelligence_](https://en.wikipedia.org/wiki/On_Intelligence) for a book-long treatment of this assumption.)
>
> In other words, the brain engages in self-supervised predictive learning: Predict what happens next, then see what actually happened, and update to do better next time.

> [!info] Definition: Mental context
> Consider the context available to a circuit within the brain. Any given circuit is innervated by axons from different parts of the brain. These axons transmit information to the circuit. Therefore, whether a circuit fires is not primarily dependent on the external situation navigated by the human, or even what the person senses at a given point in time. A circuit fires depending on whether its inputs[^2]—the _mental context_—triggers it or not. This is what the "context" of a shard refers to.

> [!abstract] Assumption 3: The brain does reinforcement learning
> According to this assumption, the brain has a genetically [hard-coded reward system](https://www.alignmentforum.org/posts/hE56gYi5d68uux9oM/intro-to-brain-like-agi-safety-3-two-subsystems-learning-and) (implemented via certain hard-coded circuits in the brainstem and midbrain). In some[^3] fashion, the brain reinforces thoughts and mental subroutines which have led to reward, so that they will be more likely to fire in similar contexts in the future. We suspect that the “base” reinforcement learning algorithm is relatively crude, but that people reliably bootstrap up to smarter credit assignment.

**Summary:** Under our assumptions, most of the human brain is locally randomly initialized. The brain has two main learning objectives: self-supervised predictive loss (we view this as building your world model; see [Appendix A](#appendix-a-the-formation-of-the-world-model)) and reward (we view this as building your values, as we are about to explore).

# 2: Reinforcement events shape human value shards

> [!warning] Disclaimer
> This section lays out a bunch of highly specific mechanistic speculation about how a simple value might form in a baby’s brain. For brevity, we won’t hedge statements like “the baby is reinforced for X.” We think the story is good and useful, but don’t mean to communicate absolute confidence via our unhedged language.

Given the inaccessibility of world model concepts, how does the genetically hard-coded reward system dispense reward in the appropriate mental situations? For example, suppose you send a drunk text, and later feel embarrassed, and this triggers a penalty. How is that penalty calculated? By information inaccessibility and the absence of text messages in the ancestral environment, the genome _isn’t_ directly hard-coding a circuit which detects that you sent an embarrassing text and then penalizes you. Nonetheless, such embarrassment seems to trigger (negative) reinforcement events... and we don’t really understand how that works yet.

Instead, let’s model what happens if the genome hardcodes a sugar-detecting reward circuit. For the sake of this section, suppose that the genome specifies a reward circuit which takes as input the state of the taste buds and the person’s metabolic needs, and produces a reward if the taste buds indicate the presence of sugar while the person is hungry. By assumption 3 in [Section 1](#1-neuroscientific-assumptions), the brain does reinforcement learning and credit assignment to reinforce circuits and computations which led to reward. For example, if a baby picks up a pouch of apple juice and sips some, that leads to sugar-reward. The reward makes the baby more likely to pick up apple juice in similar situations in the future.

Therefore, a baby may learn to sip apple juice which is already within easy reach. However, without a world model (much less a _planning process_), the baby cannot learn multi-step plans to grab and sip juice. If the baby doesn’t have a world model, then she won’t be able to act differently in situations where there is or is not juice behind her. Therefore, the baby develops a set of shallow situational heuristics which involve sensory preconditions like “IF juice pouch detected in center of visual field, THEN move arm towards pouch.” The baby is basically a trained [reflex agent](https://en.wikipedia.org/wiki/Intelligent_agent#Simple_reflex_agents).

However, when the baby has a proto-world model, the reinforcement learning process takes advantage of that new machinery by further developing the juice-tasting heuristics. Suppose the baby models the room as containing juice within reach but out of sight. Then, the baby _happens_ to turn around, which activates the _already-trained_ reflex heuristic of “grab and drink juice you see in front of you.” In this scenario, “turn around to see the juice” preceded execution of “grab and drink the juice which is in front of me”, and so the baby is reinforced for turning around to grab the juice in situations where the baby models the juice as behind herself.[^4]

By this process, repeated many times, the baby learns how to associate world model concepts (e.g. “the juice is behind me”) with the heuristics responsible for reward (e.g. “turn around” and “grab and drink the juice which is in front of me”). Both parts of that sequence are reinforced. In this way, the contextual-heuristics exchange information with the budding world model.

> [!info] Definition: Shard of value
> A _shard of value_ refers to the contextually activated computations which are downstream of similar historical reinforcement events. For example, the juice-shard consists of the various decision-making influences which steer the baby towards the historical reinforcer of a juice pouch. These contextual influences were all reinforced into existence by the activation of sugar reward circuitry upon drinking juice.
>
> A _subshard_ is a contextually activated component of a shard. For example, “IF juice pouch in front of me THEN grab” is a _subshard_ of the juice-shard. It seems plain to us that learned value shards are[^5] most strongly activated in the situations in which they were historically reinforced and strengthened.
>
> For more on terminology, see [Appendix B](#appendix-b-terminology).

![](https://assets.turntrout.com/static/images/posts/isuv5eaznltruch2kh9f.avif)
<br/>Figure: Generated by DALL-E 2.

While all of this is happening, many different shards of value are also growing, since the human reward system offers a range of feedback signals. Many subroutines are being learned, many heuristics are developing, and many proto-preferences are taking root. At this point, the brain learns a crude planning algorithm,[^6] because proto-planning subshards (e.g. IF `motor-command-5214` predicted to bring a juice pouch into view, THEN execute) would be reinforced for their contributions to activating the various hardcoded reward circuits. This proto-planning is learnable because most of the machinery was already developed by the self-supervised predictive learning, when e.g. learning to predict the consequences of motor commands (see [Appendix A](#appendix-a-the-formation-of-the-world-model)).

The planner has to decide on a coherent plan of action. That is, micro-incoherences (turn towards juice, but then turn back towards a friendly adult, but then turn back towards the juice, ad nauseum) should generally be penalized away.[^7] Somehow, the plan has to be coherent, integrating several conflicting shards. We find it useful to view this integrative process as a kind of “bidding.” For example, when the juice-shard activates, the shard fires in a way which would have historically increased the probability of executing plans which led to juice pouches. We’ll say that the juice-shard is _bidding_ for plans which involve juice consumption (according to the world model), and perhaps bidding against plans without juice consumption.

Importantly, however, the juice-shard is shaped to bid for plans which the world model predicts actually lead to _juice being consumed_, and not necessarily for plans which lead to _sugar-reward-circuit activation_**.** You might wonder: “Why wouldn’t the shard learn to value reward circuit activation?”. The _effect_ of drinking juice is that the baby's credit assignment reinforces the computations which were causally responsible for producing the situation in which the hardcoded sugar-reward circuitry fired.

_Which_ computations are reinforced? The _content_ of the responsible computations includes a sequence of heuristics and decisions, one of which involved the juice pouch abstraction in the world model. Those are the circuits which actually get reinforced and become more likely to fire in the future. Therefore, the juice-heuristics get reinforced. The heuristics coalesce into a so-called shard of value as they query the world model and planner to implement increasingly complex multi-step plans.

In contrast, in this situation, the baby's decision-making does not involve “if this action is predicted to lead to sugar-reward, then bid for the action.” This non-participating heuristic probably won’t be reinforced or created, much less become a shard of value.[^8]

We have reached an important insight. We see how the reward system shapes our values, [without our values entirely binding to the activation of the reward system itself](/reward-is-not-the-optimization-target). We have also laid bare the manner in which the juice-shard is bound to your _model of reality_ instead of simply _your model of future perception_. Looking back across the causal history of the juice-shard’s training, the shard has no particular reason to bid for the plan “stick a wire in my brain to electrically stimulate the sugar reward-circuit”, even if the world model correctly predicts the consequences of such a plan. In fact, a good world model predicts that the person will drink _fewer_ juice pouches after becoming a wireheader, and so the juice-shard in a reflective juice-liking adult _bids against_ the wireheading plan! _Humans are not reward-maximizers, they are value shard-executors._

This, we claim, is one reason why people (usually) don’t want to wirehead and why people often want to avoid value drift. According to the sophisticated reflective capabilities of your world model, if you popped a pill which made you 10% more okay with murder, your world model predicts futures which are bid against by your current shards because they contain too much murder.

We’re pretty confident that the reward circuitry is not a complicated hard-coded morass of alignment magic which forces the human to care about real-world juice. No, the hypothetical sugar-reward circuitry is simple. We conjecture that the order in which the brain learns abstractions makes it convergent to care about certain objects in the real world.

# 3. Explaining human behavior using shard theory

The juice-shard formation story is simple and—if we did our job as authors—easy to understand. However, juice-consumption is hardly a prototypical human value. In this section, we’ll show how shard theory neatly explains a range of human behaviors and preferences.

As people, we have lots of intuitions about human behavior. However, intuitively obvious behaviors _still have to have mechanistic explanations_—such behaviors still have to be retrodicted by a correct theory of human value formation\. While reading the following examples, try looking at human behavior with fresh eyes, as if you were seeing humans for the first time and wondering what kinds of learning processes would produce agents which behave in the ways described.

## Altruism is contextual

> [!quote] Peter Singer’s [drowning child thought experiment](https://www.opendemocracy.net/en/a-life-to-save-direct-action-on-poverty/)
> Imagine you come across a small child who has fallen into a pond and is in danger of drowning. You know that you can easily and safely rescue him, but you are wearing an expensive pair of shoes that will be ruined if you do.

Probably,[^9] most people would save the child, even at the cost of the shoes. However, few of those people donate an equivalent amount of money to save a child far away from them. Why do we care more about nearby visible strangers as opposed to distant strangers?

We think that the answer is simple. First consider the relevant context. The person _sees_ a drowning _child_. What shards activate? Consider the historical reinforcement events relevant to this context. Many of these events involved helping children and making them happy. These events mostly occurred face-to-face.

For example, perhaps there is a hardcoded reward circuit which is activated by a crude subcortical smile-detector and a hardcoded attentional bias towards objects with relatively large eyes. Then reinforcement events around making children happy would cause people to care about children. For example, an adult’s credit assignment might correctly credit decisions like “smiling at the child” and “helping them find their parents at a fair” as responsible for making the child smile. “Making the child happy” and “looking out for the child’s safety” are two reliable correlates of smiles, and so people probably reliably grow child-subshards around these correlates.

This child-shard most strongly activates in contexts similar to the historical reinforcement events. In particular, “knowing the child exists” will activate the child-shard less strongly than “knowing the child exists and also seeing them in front of you.” “Knowing there are some people hurting somewhere” activates altruism-relevant shards even more weakly still. So it’s no grand mystery that most people care more when they can _see_ the person in need.

Shard theory retrodicts that altruism tends to be biased towards nearby people (and also the ingroup), without positing complex, [information-inaccessibility-violating](/human-values-and-biases-are-inaccessible-to-the-genome) adaptations like the following:

> [!quote] [Comparing the Effect of Rational and Emotional Appeals on Donation Behavior](https://philpapers.org/rec/LINCTE-3)
> We evolved in small groups in which people helped their neighbors and were suspicious of outsiders, who were often hostile. Today we still have these “Us versus Them” biases, even when outsiders pose no threat to us and could beneﬁt enormously from our help. Our biological history may predispose us to ignore the suﬀering of faraway people, but we don’t have to act that way.

Similarly, you may be familiar with [scope insensitivity](https://en.wikipedia.org/wiki/Scope_neglect): that the function from (# of children at risk) → (willingness to pay to protect the children) is not linear, but perhaps logarithmic. Is it that people “[can’t multiply](https://www.lesswrong.com/posts/r5MSQ83gtbjWRBDWJ/the-intuitions-behind-utilitarianism)”? Probably not.

Under the shard theory view, it’s not that brains _can’t_ multiply, it’s that for most people, the altruism-shard is most strongly invoked in face-to-face, one-on-one interactions, because _those are the situations which have been most strongly touched by altruism-related reinforcement events_. Whatever the altruism-shard’s influence on decision-making, it doesn’t steer decision-making so as to produce a linear willingness-to-pay relationship.

## Friendship strength seems contextual

Personally, I (`TurnTrout`) am more inclined to make plans with my friends when I’m already hanging out with them—when we are already physically near each other. But why?

Historically, when I’ve hung out with a friend, that was fun and rewarding and reinforced my decision to hang out with that friend, and to continue spending time with them when we were already hanging out. As above, one possible way this could[^10] happen is via a genetically hardcoded smile-activated reward circuit.

Since shards more strongly influence decisions in their historical reinforcement situations, the shards reinforced by interacting with my friend have the greatest control over my future plans when I’m actually hanging out with my friend.

## Milgram is also contextual

> [!quote] [Wikipedia](https://en.wikipedia.org/wiki/Milgram_experiment)
> The Milgram experiment(s) on obedience to authority figures was a series of social psychology experiments conducted by Yale University psychologist Stanley Milgram. They measured the willingness of study participants, men in the age range of 20 to 50 from a diverse range of occupations with varying levels of education, to obey an authority figure who instructed them to perform acts conflicting with their personal conscience. Participants were led to believe that they were assisting an unrelated experiment, in which they had to administer electric shocks to a "learner". These fake electric shocks gradually increased to levels that would have been fatal had they been real.

We think that people convergently learn obedience- and cooperation-shards which more strongly influence decisions in the presence of an authority figure, perhaps because of historical obedience-reinforcement events in the presence of teachers / parents. These shards strongly activate in this situation.

We don’t pretend to have sufficient mastery of shard theory to _a priori_ quantitatively predict Milgram’s obedience rate. However, shard theory explains why people obey so strongly in this experimental setup, but not in most everyday situations: The presence of an authority figure and of an official-seeming experimental protocol. This may seem obvious, but remember that human behavior requires _a mechanistic explanation_. “Common sense” doesn’t cut it. “Cooperation- and obedience-shards more strongly activate in this situation because this situation is similar to historical reinforcement contexts” is a nontrivial retrodiction.

Indeed, varying the contextual features [dramatically affected](https://www.tutor2u.net/psychology/reference/explanations-for-obedience-variations-of-milgram-1963) the percentage of people who administered “lethal” shocks:

<table style="table-layout:auto;"><thead><tr><th style="text-align:right;">Variations on Milgram’s experiment</th><th style="text-align:left;">Obedience rate</th></tr></thead><tbody><tr><td style="text-align:right;">Someone else administered the shock</td><td style="text-align:left;">92.5%</td></tr><tr><td style="text-align:right;">Original experiment</td><td style="text-align:left;">65%</td></tr><tr><td style="text-align:right;">The experiment took place in a run down building</td><td style="text-align:left;">48%</td></tr><tr><td style="text-align:right;">The teacher and learner were in the same room</td><td style="text-align:left;">40%</td></tr><tr><td style="text-align:right;">The teacher had to force the learner’s hand onto a shock plate</td><td style="text-align:left;">30%</td></tr><tr><td style="text-align:right;">The experimenter gave instructions to the teacher over the phone</td><td style="text-align:left;">21%</td></tr><tr><td style="text-align:right;">The experimenter was replaced by another “participant” in ordinary clothes</td><td style="text-align:left;">20%</td></tr></tbody></table>

## Sunflowers and timidity

Consider the following claim: “People reliably become more timid when [surrounded by tall sunflowers](https://assets.turntrout.com/static/images/posts/Qo94MA9.avif). They become easier to sell products to and ask favors from.”

Let’s see if we can explain this with shard theory. Consider the mental context. The person knows there’s a sunflower near them. What historical reinforcement events pertain to this context? Well, the person probably has pleasant associations with sunflowers, perhaps spawned by aesthetic reinforcement events which reinforced thoughts like “go to the field where sunflowers grow” and “look at the sunflower.”

Therefore, the sunflower-timidity-shard was grown from… Hm. It wasn’t grown. The claim _isn’t true_, and this shard _doesn’t exist_, because it’s not downstream of past reinforcement.

Thus: Shard theory _does not explain everything_, because shards are grown from previous reinforcement events and previous thoughts. Shard theory constrains anticipation around actual observed human nature.

> [!question] Optional exercise
> Why might it feel _wrong_ to not look both ways before crossing the street, even if you have reliable information that the coast is clear?

> [!question] Optional exercise
> Suppose that it's more emotionally difficult to kill a person face-to-face than from far away and out of sight. Explain via shard theory.[^11]

## We think that many biases are convergently produced artifacts of the human learning process & environment

We think that simple reward circuitry leads to different cognition activating in different circumstances. Different circumstances can activate cognition that implements different values, and this can lead to inconsistent or biased behavior. We conjecture that many biases are convergent artifacts of the human training process and internal shard dynamics. People aren’t just randomly/hardcoded to be more or less “rational” in different situations.

### [Projection bias](https://thedecisionlab.com/biases/projection-bias)

> [!quote] [Dynamic inconsistency](https://en.wikipedia.org/wiki/Dynamic_inconsistency)
> Humans have a tendency to mispredict their future [marginal utilities](https://en.wikipedia.org/wiki/Marginal_utility) by assuming that they will remain at present levels. This leads to inconsistency as marginal utilities (for example, tastes) change over time in a way that the individual did not expect. For example, when individuals are asked to choose between a piece of fruit and an unhealthy snack (such as a candy bar) for a future meal, the choice is strongly affected by their "current" level of hunger.

We believe that this is _not_ a misprediction of how tastes will change in the future. Many adults know perfectly well that they will later crave the candy bar. However, a satiated adult has a greater probability of choosing fruit for their later self, because their deliberative shards are more strongly activated than their craving-related shards. The current level of hunger strongly controls which food-related shards are activated.

### Sunk cost fallacy

Why are we hesitant to shift away from the course of action that we’re currently pursuing? We think that two shard theory-related factors contribute to the sunk cost fallacy:

1. The currently active shards are those that bid for the current course of action. Those shards probably bid for the current course. They also have more influence, since they’re currently active. Thus, the currently active shard coalition supports the current course of action more strongly, when compared to your “typical” shard coalitions. This can cause the you-that-is-pursuing-the-course-of-action to continue, even after your “otherwise” self would have stopped.
2. Shards activate more strongly in concrete situations. Actually seeing a bear will activate self-preservation shards more strongly than simply imagining a bear. Thus, the concrete benefits of the current course of action will more easily activate shards than the abstract benefits of an imagined course of action. This can lead to overestimating the value of continuing the current activity relative to the value of other options.

### [Time inconsistency](https://en.wikipedia.org/wiki/Dynamic_inconsistency)

A person might deliberately avoid passing through the sweets aisle in a supermarket in order to avoid temptation. Avoiding the aisle is a strange thing to do, and it makes no sense from the perspective of an agent maximizing expected utility over quantities like "sweet food consumed" and "leisure time" and "health." Such an EU-maximizing agent would decide to buy sweets or not, but wouldn’t worry about entering the aisle itself. Avoiding temptation makes perfect sense under shard theory.

Shards are contextually activated, and the sweet-shard is most strongly activated when you can actually see sweets. We think that planning-capable shards are manipulating future contexts so as to prevent the full activation of your sweet shard.

> [!question]
>
> 1. Which do you prefer, to be given 500 dollars today or 505 dollars tomorrow?
> 2. Which do you prefer, to be given 500 dollars 365 days from now or 505 dollars 366 days from now?

[In such situations, people tend to choose \$500 in (A) but \$505 in (B)](https://scholar.google.com/scholar?cluster=16878679720519238129&hl=en&as_sd$t=0$,5), which is inconsistent with models in which the value of money is exponentially discounted over time. To explain this observed behavioral regularity using shard theory, consider the historical reinforcement contexts around immediate and delayed gratification. If contexts involving short-term opportunities activate different shards than contexts involving long-term opportunities, then it’s unsurprising that a person might choose 500 dollars in (A) but 505 dollars in (B).[^12] (Of course, a full shard theory explanation must explain _why_ those contexts activate different shards. We strongly intuit that there’s a good explanation, but do not think we have a satisfying story here yet.)

### [Framing effect](https://thedecisionlab.com/biases/framing-effect)

The framing effect is another bias downstream of contextual shard activations. Asking the same question in different contexts can change which shards activate, and thus change how people answer the question. Consider also: [People are hesitant to drink from a cup labeled “poison”, even if they themselves were the one to put the label there](https://psycnet.apa.org/record/1986-21988-001).

### Other factors driving biases

People are biased for many reasons. We’ve described some shard theory explanations for the listed biases. These explanations are not exhaustive. While writing this, we found an experiment with results that seem contrary to the shard theory explanations of sunk cost. Namely, experiment 4 (specifically, the uncorrelated condition) in [this study](https://pubmed.ncbi.nlm.nih.gov/21574688/) on sunk cost in pigeons.

However, the cognitive biases literature is so large and heterogeneous that there probably isn’t any theory which cleanly explains all reported experimental outcomes. We think that shard theory has decently broad explanatory power for many aspects of human values and biases, even though not all observations fit neatly into the shard theory frame. (Alternatively, we might have done the shard theory analysis wrong for experiment 4.)

## Why people can't enumerate all their values

Shards being contextual also helps explain why [we can’t specify our full values](https://www.lesswrong.com/posts/4ARaTpNX62uaL86j6/the-hidden-complexity-of-wishes). We can describe a moral theory that seems to capture our values in a given mental context, but it’s usually easy to find some counterexample to such a theory—some context or situation where the specified theory prescribes absurd behavior.

If shards implement your values, and shards activate situationally, your values will also be situational. Once you move away from the mental context / situation in which you came up with the moral theory, you might activate shards that the theory fails to capture. We think that this is why the static utility function framing is hard to operate for humans.

For example, the classical utilitarianism maxim to maximize joy might initially seem appealing, but it doesn’t take long to generate a new mental context which activates shards that value emotions other than joy, or shards that value things in physical reality beyond your own mental state.

You might generate such new mental contexts by directly searching for shards that bid against pure joy maximization, or by searching for hypothetical scenarios which activate such shards ("finding a counterexample", in the language of moral philosophy). However, there is no clean way to query all possible shards. We also can’t enumerate every possible context in which shards could activate. It's thus difficult to precisely quantify all of our values, or to create an explicit utility function that describes our values.

# Content we aren’t (yet) discussing

The story we’ve presented here skips over important parts of human value formation. E.g., humans can do moral philosophy and refactor their deliberative moral framework without necessarily encountering _any_ externally activated reinforcement events, and humans also learn values through processes like cultural osmosis or imitation of other humans. Additionally, we haven’t addressed learned reinforcers (where a correlate of reinforcement events eventually becomes reinforcing in and of itself). We’ve also avoided most discussion of shard theory’s AI alignment implications.

This post explains our basic picture of shard formation in humans. We will address deeper shard theory-related questions in later posts.

_For shard theory discussion, join our [Discord server](https://discord.gg/JNG2ZSKh28)._

# Conclusion

Working from three reasonable assumptions about how the brain works, shard theory implies that human values (e.g. caring about siblings) are implemented by contextually activated circuits which activate in situations downstream of past reinforcement (e.g. when physically around siblings) so as to steer decision-making towards the objects of past reinforcement (e.g. making plans to spend more time together). According to shard theory, human values may be complex, but much of human value formation is simple.

> [!thanks]
> Charles Foster wrote [Appendix C](#appendix-c-evidence-for-neuroscience-assumptions). We thank David Udell, Peter Barnett, Raymond Arnold, Garrett Baker, Steve Byrnes, and Thomas Kwa for feedback on this finalized post. Many more people provided feedback on an earlier version.

# Appendix A: The formation of the world model

Most of our values seem to be about the real world. Mechanistically, we think that this means that they are functions of the state of our world model. We therefore infer that human values do not form durably or in earnest until after the human has learned a proto-world model. Since the world model is learned from scratch (by assumption 1 in [Section 1](#1-neuroscientific-assumptions)), the world model takes time to develop. In particular, we infer that babies don’t have any recognizable “values” to speak of.

Therefore, to understand why human values empirically coalesce around the world model, we will sketch a detailed picture of how the world model might form. We think that self-supervised learning (item 2 in [Section 1](#1-neuroscientific-assumptions)) produces your world model.

Due to learning from scratch, the fancy and interesting parts of your brain start off mostly useless. Here’s a speculative[^13] story about how a baby learns to reduce predictive loss, in the process building a world model:

1. The baby is born[^14] into a world where she is pummeled by predictive error after predictive error, because most of her brain consists of locally randomly initialized neural circuitry.
2. The baby’s brain learns that a quick loss-reducing hack is to predict that the next sensory activations will equal the previous ones: That nothing will observationally change from moment to moment. If the baby is stationary, much of the visual scene is constant (modulo saccades). Similar statements may hold for other sensory modalities, from smell (olfaction) to location of body parts (proprioception).
    1. At the same time, the baby starts learning edge detectors in V1[^15] (which [seem to be universally learned / convergently useful in vision tasks](https://distill.pub/2020/circuits/zoom-in/#claim-3)) in order to take advantage of visual regularities across space and time, from moment to moment.
3. The baby learns to detect when they are being moved or when their eyes are about to saccade, in order to crudely anticipate e.g. translations of part of the visual field. For example, given the prior edge-detector activations and her current acceleration, the baby predicts that the next edge detectors to light up will be a certain translation of the previous edge-detector patterns.
    1. This acceleration → visual translation circuitry is reliably learned because it’s convergently useful for reducing predictive loss in many situations under our laws of physics.
    2. Driven purely by her self-supervised predictive learning, the baby has learned something interesting about how she is embedded in the world.
    3. Once the “In what way is my head accelerating?” circuit is learned, other circuits can invoke it. This pushes toward modularity and generality, since it’s easier to learn a circuit which is predictively useful for two tasks, than to separately learn two variants of the same circuit. (See also [invariant representations](https://cbmm.mit.edu/research/projects-thrust/theoretical-frameworks-intelligence/invariant-representation-learning).)
4. The baby begins to learn rules of thumb e.g. about how simple objects move. She continues to build abstract representations of how movement relates to upcoming observations.
    1. For example, she gains another easy reduction in predictive loss by using her own motor commands to predict where her body parts will soon be located (i.e. to predict upcoming proprioceptive observations).
    2. This self-prediction is the beginning of her self-model.
5. The rules of thumb become increasingly sophisticated. Object recognition and modeling begins in order to more precisely predict low- and medium-level visual activations, like “if I recognize a square-ish object at time _t_ and it has smoothly moved left for _k_ timesteps, predict I will recognize a square-ish object at time _t+1_ which is yet farther left in my visual field.”
6. As the obvious rules are learned, the baby’s brain eventually learns higher-level rules.
    1. “If a stationary object is to my right and I turn my head to the left, then I will stop seeing it, but if I turn my head back to the right, I will see it again.”
    2. This rule requires statefulness via short-term memory and some coarse summary of the object itself (small time-scale object permanence within a shallow world-model).
7. Object permanence develops from the generalization of specific heuristics for predicting common objects, to an invariant scheme for handling objects and their relationship to the child.
    1. Developmental milestones vary from baby to baby because it takes them a varying amount of time to learn certain keystone but convergent abstractions, such as self-models.
    2. Weak evidence that this learning timeline is convergent: [Crows (and other smart animals) reach object permanence milestones in a similar order](<https://homepage.uni-tuebingen.de/andreas.nieder/Hoffmann,Ruettler,Nieder(2011)AnimBehav.pdf>) as human babies reach them.
    3. The more abstractions are learned, the easier it is to lay down additional functionality. When we see a new model of car, we do not have to relearn our edge detectors or car-detectors.
8. Learning continues, but we will stop here.

In this story, the world model is built from the self-supervised loss signal. Reinforcement probably also guides and focuses attention. For example, perhaps [brainstem-hardcoded (but crude) face detectors](<https://www.cell.com/current-biology/fulltext/S0960-9822(17)30580-8>) hook into a reward circuit which focuses the learning on human faces.

# Appendix B: Terminology

## Shards are not full subagents

In our conception, shards vary in their sophistication (e.g. _IF-THEN reflexes_ vs _planning-capable, reflective shards which query the world model in order to steer the future in a certain direction_) and generality of activating contexts (e.g. _only activates when hungry and a lollypop is in the middle of the visual field_ vs _activates whenever you're thinking about a person_). However, we think that shards are not discrete subagents with their own world models and mental workspaces. We currently estimate that most shards are "optimizers" to the extent that a bacterium or a thermostat is an optimizer.

## “Values”

We defined[^16] “values” as “contextual influences on decision-making.” We think that “valuing someone’s friendship” is [what it feels like from the inside](https://www.readthesequences.com/How-An-Algorithm-Feels-From-Inside) to be an algorithm with a contextually activated decision-making influence which increases the probability of e.g. deciding to hang out with that friend. Here are three extra considerations and clarifications.

Type-correctness
: We think that our definition is deeply appropriate in certain ways. Just because you value eating donuts, doesn’t mean you want to retain that pro-donut influence on your decision-making. Thus, _reflectively endorsing_ a value shard happens when the shards which reason about your shard composition, bid for the donut-shard to stick around. By the same logic, it makes total sense to want your values to change over time—the “reflective” parts of you want the shard composition in the future to be different from the present composition. (For example, many arachnophobes probably want to drop their fear of spiders.) Rather than humans being “weird” for wanting their values to change over time, we think it’s probably the default for smart agents meeting our learning-process assumptions ([Section 1](#1-neuroscientific-assumptions)).

: Furthermore, your _values_ do not reflect a _reflectively endorsed utility function_. First off, those are different types of objects. Values bid for and against options, while a utility function grades options. Second, your values vary contextually, while any such utility function would be constant across contexts. More on these points later, in more advanced shard theory posts.

Different shard compositions can produce similar urges
: If you feel an urge to approach nearby donuts, that indicates a range of possibilities:
: - A donut shard is firing to increase _P(eating the donut)_ because the WM indicates there’s a short plan that produces that outcome, and seeing/smelling a donut activates the donut shard particularly strongly.
: - A _hedonic_ shard is firing to increase _P(eating the donut)_ because the WM indicates there’s a short plan that produces a highly pleasurable outcome.
: - A _social_ shard is firing because your friends are all eating donuts, and the social shard was historically reinforced for executing plans where you “fit in” / gain their approval.
: - …

: So, just because you feel an urge to eat the donut, doesn’t _necessarily_ mean you have a donut shard or that you “value” donuts under our definition. (But you probably do.)

Shards are just collections of subshards
: One subshard of your family-shard might steer towards futures where your family is happy, while another subshard may influence decisions so that your mother is proud of you. On my (`TurnTrout`’s) current understanding, “family shard” is just an abstraction of a set of heterogeneous subshards which are downstream of similar historical reinforcement events (e.g. related to spending time with your family). By and large, subshards of the same shard do not all steer towards the same kind of future.

## “Shard Theory”

Before this post was published, many people read draft documents explaining shard theory. However, in the absence of a canonical public document explaining the ideas and defining terms, “shard theory” has become overloaded. Here, then, are several definitions.

1. This document lays out (the beginning of) the _shard theory of human values._ This theory attempts a mechanistic account of how values / decision-influencers arise in human brains.
    1. As hinted at by our remark on shard theory mispredicting behavior in _pigeons_, we also expect this theory to qualitatively describe important aspects of animal cognition (insofar as those animals satisfy learning from scratch + self-supervised learning + reinforcement learning).
    2. Typical shard theory questions:
        1. “What is the mechanistic process by which a few people developed preferences over what happens [under different laws of physics](https://en.wikipedia.org/wiki/Multiverse#Level_IV:_Ultimate_ensemble)?”
        2. “What is the mechanistic basis of certain shards (e.g. people respecting you) being ‘reflectively endorsed’, while other shards (e.g. avoiding spiders) can be consciously ‘planned around’ (e.g. going to exposure therapy so that you stop embarrassingly startling when you see a spider)?” (_Thanks to Thane Ruthenis for this example._)
        3. “Why do humans have good [general alignment properties](/general-alignment-properties), like robustness to ontological shifts?”
2. The shard paradigm/theory/frame of AI alignment analyzes the value formation processes which will occur in deep learning, and tries to figure out their properties.
    1. Typical questions asked under this paradigm/frame:
        1. “How can we predictably control the way in which a policy network generalizes? For example, under what training regimes and reinforcement schedules would [a CoinRun agent generalize](https://arxiv.org/abs/2105.14111) to pursuing coins instead of the right end of the level? What quantitative relationships and considerations govern this process?”
        2. “Will deep learning agents robustly and reliably navigate [ontological shifts](https://www.lesswrong.com/tag/ontological-crisis)?”
    2. This paradigm places a strong (and, we argue, [appropriate](https://www.alignmentforum.org/posts/CjFZeDD6iCnNubDoS/humans-provide-an-untapped-wealth-of-evidence-about)) emphasis on taking cues from humans, since they are the only empirical examples of real-world general intelligences which “form values” in some reasonable sense.
    3. That said, alignment implications are out of scope for this post. We postpone discussion to future posts.
3. “Shard theory” also has been used to refer to insights gained by considering the shard theory of human values and by operating the shard frame on alignment.
    1. We don’t like this ambiguous usage. We would instead say something like “insights from shard theory.”
    2. Example insights include [Reward is not the optimization target](/reward-is-not-the-optimization-target) and [Human values & biases are inaccessible to the genome](/human-values-and-biases-are-inaccessible-to-the-genome).

# Appendix C: Evidence for neuroscience assumptions

In [Section 1](#1-neuroscientific-assumptions), we stated that shard theory makes three key neuroscientific assumptions. Below we restate those assumptions, and give pointers to what we believe to be representative evidence from the psychology & neuroscience literature:

1. The cortex is basically locally randomly initialized.
    1. Steve Byrnes [has already written](https://www.lesswrong.com/posts/wBHSYwqssBGCnwvHg/intro-to-brain-like-agi-safety-2-learning-from-scratch-in#2_5_Evidence_on_whether_the_telencephalon___cerebellum_learn_from_scratch) on several key lines of evidence that suggest the telencephalon (which includes the cerebral cortex) & cerebellum learn primarily from scratch. We recommend his writing as an entrypoint into that literature.
    2. One easily observable weak piece of evidence: humans are super [altricial](https://en.wikipedia.org/wiki/Precociality_and_altriciality)—if the genome hardcoded a bunch of the cortex, why would babies take so long to become autonomous?
2. The brain does self-supervised learning.
    1. Certain forms of spike-timing dependent plasticity (STDP) as [observed in many regions of telencephalon](https://journals.physiology.org/doi/full/10.1152/physrev.00016.2007) would straightforwardly support self-supervised learning at the synaptic level, as connections are adjusted such that earlier inputs (pre-synaptic firing) anticipate later outputs (post-synaptic firing).
    2. Within the hippocampus, place-selective cells [fire in the order](http://learnmem.cshlp.org/content/3/2-3/279.short) of the spatial locations they are bound to, with a coding scheme that [plays out](https://www.nature.com/articles/nature09633) whole sequences of place codes that the animal will later visit.
    3. If the [predictive processing framework](https://www.sciencedirect.com/science/article/pii/S0896627318308572) is an accurate picture of information processing in the brain, then the brain obviously does self-supervised learning.
3. The brain does reinforcement learning.
    1. Within captive animal care, positive reinforcement training appears to be a common paradigm (see [this paper](https://www.tandfonline.com/doi/abs/10.1207/S15327604JAWS0603_01?journalCode=haaw20) for a reference in the case of nonhuman primates). This at least suggests that “shaping complex behavior through reward” is possible.
    2. Operant & respondent conditioning methods like [fear conditioning](https://www.annualreviews.org/doi/abs/10.1146/annurev.neuro.24.1.897) have a long history of success, and are now related back to [key neural structures](https://www.sciencedirect.com/science/article/abs/pii/S0149763402000076) that support the acquisition and access of learned responses. These paradigms work so well, experimenters have been able to use them to have [mice learn to directly control](https://www.sciencedirect.com/science/article/pii/S0896627317300478) the activity of a single neuron in their motor cortex.
    3. Wolfram Schultz and colleagues [have found](https://www.nature.com/articles/nn0898_304) that the signaling behavior of phasic dopamine in the mesocorticolimbic pathway mirrors that of a [TD error](https://link.springer.com/article/10.1007/BF00115009) (or reward prediction error).
    4. In addition to finding _correlates_ of reinforcement learning signals in the brain, artificial manipulation of those signal correlates ([through optogenetic stimulation, for example](https://www.sciencedirect.com/science/article/pii/S0092867416310753)) produces the behavioral adjustments that would be predicted from their putative role in reinforcement learning.

[^1]: More precisely, we adopt Steve Byrnes’ stronger conjecture that the [_telencephelon and cerebellum_ are locally ~randomly initialized](https://www.alignmentforum.org/posts/wBHSYwqssBGCnwvHg/intro-to-brain-like-agi-safety-2-learning-from-scratch-in#2_4_My_hypothesis__the_telencephalon_and_cerebellum_learn_from_scratch__the_hypothalamus_and_brainstem_don_t).
[^2]: Neurons can transmit information without sending it through synapses, including ephaptic transmission, gap junctions, and volume transmission. We also consider these to be part of a circuit’s mental context.
[^3]: We take an agnostic stance on the form of RL in the brain, both because we have trouble spelling out exact neurally plausible base credit assignment and reinforcement learning algorithms, but also so that the analysis does not make additional assumptions.
[^4]: In psychology, “[shaping](<https://en.wikipedia.org/wiki/Shaping_(psychology)>)” roughly refers to this process of learning increasingly sophisticated heuristics.
[^5]: Shards activate more strongly in historical reinforcement contexts, according to our RL intuitions, introspective experience, and inference from observed human behavior. We have some abstract theoretical arguments that RL should work this way in the brain, but won't include them in this post.
[^6]: We think human planning is less like Monte-Carlo Tree Search and more like greedy heuristic search. The heuristic is computed in large part by the outputs of the value shards, which themselves receive input from the world model about the consequences of the plan stub.
[^7]: For example, turning back and forth while hungry might produce continual slight negative reinforcement events, at which point good credit assignment blames and downweights the micro-incoherences.
[^8]:
    We think that “hedonic” shards of value can indeed form, and this would be part of why people seem to intrinsically value “rewarding” experiences. However, two points.

    1. In this specific situation, the juice-shard forms around _real-life juice_.
    2. We think that even self-proclaimed hedonists have _some_ substantial values which are reality-based instead of reward-based.

[^9]: We looked for a citation but couldn’t find one quickly.
[^10]: We think the actual historical hanging-out-with-friend reinforcement events transpire differently. We may write more about this in future essays.
[^11]: “It’s easier to kill a distant and unseen victim” seems common-sensically true, but we couldn’t actually find citations. Therefore, we are flagging this as possibly wrong folk wisdom. We would be surprised if it were wrong.
[^12]: Shard theory reasoning says that while humans might be [well-described as “hyperbolic discounters”](https://en.wikipedia.org/wiki/Hyperbolic_discounting), the real mechanistic explanation is importantly different. People may well not be doing any explicitly represented discounting; instead, discounting may only convergently arise as a superficial regularity! This presents an obstacle to alignment schemes aiming to infer human preferences by assuming that people are _actually discounting_.
[^13]: We made this timeline up. We expect that we got many details wrong for a typical timeline, but the point is not the exact order. The point is to outline the kind of process by which the world model might arise _only_ from self-supervised learning.
[^14]: For simplicity, we start the analysis at birth. There is probably embryonic self-supervised learning as well. We don’t think it matters for this appendix.
[^15]:
    Interesting but presently unimportant: My (`TurnTrout`)’s current guess is that given certain hard-coded wiring (e.g. where the optic nerve projects), the functional areas of the brain comprise the robust, convergent solution to: How should the brain organize cognitive labor to [minimize the large metabolic costs of information transport](https://www.pdcnet.org/theoria/content/theoria_2019_0034_0001_0089_0110) (and, later, decision-making latency). This explains why [learning a new language produces a new Broca’s area](https://archive.nytimes.com/www.nytimes.com/library/magazine/millennium/m3/hall-blakeslee.html) close to the original, and it explains why [rewiring ferrets’ retinal projections into the auditory cortex seems to grow a visual cortex there instead](https://www.nature.com/articles/35009043). (`jacob_cannell` [posited a similar explanation](https://www.lesswrong.com/posts/9Yc7Pp7szcjPgPsjf/the-brain-as-a-universal-learning-machine?commentId=ckXKdtJKPtLqfZS4M) in 2015.)

    The actual function of each functional area is overdetermined by the convergent usefulness of e.g. visual processing or language processing. Convergence builds upon convergence to produce reliable but slightly varied specialization of cognitive labor across people’s brains. That is, people learn edge detectors because they’re useful, and people’s brains put them in V1 in order to minimize the costs of transferring information.

    Furthermore, this process compounds upon itself. Initially there were weak functional convergences, and then mutations finetuned regional learning hyperparameters and connectome topology to better suit those weak functional convergences, and then the convergences sharpened, and so on. We later found that [Voss et al.’s _Branch Specialization_](https://distill.pub/2020/circuits/branch-specialization/) made a similar conjecture about the functional areas.

[^16]: I (`TurnTrout`) don’t know whether philosophers have already considered this definition (nor do I think that’s important to our arguments here). A few minutes of searching didn’t return any such definition, but please let me know if it already exists!
