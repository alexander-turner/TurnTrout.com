---
permalink: alignment-without-total-robustness
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/rauMEna2ddf26BqiE/alignment-allows-nonrobust-decision-influences-and-doesn-t
lw-is-question: 'false'
lw-posted-at: 2022-11-29T06:23:00.394000Z
lw-last-modification: 2023-02-15T10:24:57.232000Z
lw-curation-date: None
lw-frontpage-date: 2022-11-29T19:21:38.803000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 42
lw-base-score: 60
lw-vote-count: 17
af-base-score: 28
af-num-comments-on-upload: 31
title: Alignment allows 'non-robust' decision-influences and doesn't require robust
  grading
lw-latest-edit: 2022-11-30T16:37:57.412000Z
lw-is-linkpost: 'false'
tags:
  - shard-theory
  - human-values
  - AI
aliases:
  - alignment-allows-nonrobust-decision-influences-and-doesn-t
sequence-link: posts#shard-theory
lw-sequence-title: Shard Theory
prev-post-slug: dont-align-agents-to-evaluations-of-plans
prev-post-title: Don’t Align Agents to Evaluations of Plans
next-post-slug: against-inner-outer-alignment
next-post-title: Inner and Outer Alignment Decompose One Hard Problem Into Two Extremely
  Hard Problems
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2022-11-29 00:00:00
original_url: 
  https://www.lesswrong.com/posts/rauMEna2ddf26BqiE/alignment-allows-nonrobust-decision-influences-and-doesn-t
skip_import: true
description: Values steer optimization, they are not optimized against. Values don't
  have to be robustly "correct", because they are not the thing being optimized.
date_updated: 2025-11-22 00:21:52.667251
createBibtex: true
---










On how I use words, values are decision-influences (also known as [_shards_](/shard-theory)). “I value doing well at school” is a short sentence for “in a range of contexts, there exists an influence on my decision-making which upweights actions and plans that lead to e.g. learning and good grades and honor among my classmates.”

Summaries of key points:

1. **Non-robust decision-influences can be OK.** A candy-shard contextually influences decision-making. Many policies lead to acquiring lots of candy; the decision-influences don't have to be "globally robust" or "perfect."
2. **Values steer optimization; they are not optimized against.** The value shards aren't getting optimized hard. The value shards **are** the things which optimize hard, by wielding the rest of the agent's cognition (e.g. the world model, the general-purpose planning API).
    - Since values are not the optimization target of the agent with those values, the values don't have to be adversarially robust.
3. **Since values steer cognition, reflective agents try to avoid adversarial inputs to their own values.** In self-reflective agents which can think about their own thinking, values steer e.g. what plans get considered next. Therefore, these agents convergently avoid adversarial inputs to their currently activated values (e.g. learning), because adversarial inputs would impede fulfillment of those values (e.g. lead to less learning).

> [!warning] Disclaimer
> The point isn't that you get aligned behavior if you assume the AI is aligned. The point is that the value frame _naturally_ expresses aligned behavior. In contrast, grader evaluation seems insane and cannot reasonably express aligned behavior.

# I: Non-robust decision-influences can be OK

Decision-making influences don't have to be “robust” in order for a person to _value doing well at school_. Consider two people with slightly different values:

1. One person is slightly more motivated by good grades. They might study for a physics test and focus slightly more on test-taking tricks.
2. Another person is slightly more motivated by learning. They might forget about some quizzes because they were too busy reading extracurricular physics books.

They might _both_ care about school - in the sense of reliably making decisions on the basis of their school performance and valuing being a person who gets good grades. Both people are motivated to do well at school, albeit in somewhat different ways. They probably will both get good grades and they probably will both learn a lot. **Different values simply mean that the two people locally make decisions differently.**

If I value candy, that means that my decision-making contains a subroutine which makes me pursue candy in certain situations. Perhaps I eat candy, perhaps I collect candy, perhaps I let children tour my grandiose candy factory… The point is that candy influences my decisions. I am _pulled by my choices_ from pasts without candy to futures with candy.

So, let $C$ be the set of mental contexts relevant for decision-making, and let $A$ be my action set.[^1] My policy has type signature $\pi:C→A$. My policy contains a bunch of shards of value which influence its outputs. The values are subcircuits of my policy network (i.e. my brain). For example, consider a candy shard consisting of the following subshards:

1. If `center-of-visual-field` activates `candy`’s visual abstraction, then `grab` the `inferred latent object which activated the abstraction`.
2. If `hunger>50` and `sugar-level<6`, and if `current-plan-stub` activates `candy-obtainable`, then tell `planning API` to set `subgoal` to `obtain candy`.
3. If `heard 'candy'` and `hunger>20`, then `salivate`.
4. …

Suppose this is the way I value candy. A few thousand subshards which chain into the rest of my cognition and concepts. A few thousand subshards of value which were hammered into place by tens of thousands of reinforcement events across a lifetime of experience.

This shard does not need to be “robust” or "perfect." Am I really missing much if I’m lacking candy subshard #3: “If `heard 'candy'` and `hunger>20`, then `salivate`”? I don’t think it makes sense to call value shards “perfect” or not.[^2] The shards simply influence decisions.

Many, many configurations and parameter settings of these subshards lead to _valuing candy_. The person probably still values candy, even if you:

- Delete a bunch of the subshards.
  - Similarly, [transformers are robust to _deletion_ of entire layers](https://arxiv.org/abs/2406.19384)!
- Modify the activation-strength of a bunch of subshards (roughly, change how much control the subshard has on the next-thought "logits").
- Change some of the activation contexts to other common activation contexts (e.g. "If `heard 'candy'`" changes to "If `heard 'sweets'`", change to `hunger>14` in subshard 3).

It seems to me like "does the person still prioritize candy" depends on a bunch of factors, including:

1. Retention of core abstractions (to some tolerance)
    - If we find-replaced `candy` with `flower`, the person probably now has a strange flower-value, where they eat flowers when hungry.
    - However, the abstraction also doesn't have to be "perfect" (whatever that means) in order to activate in everyday situations. Two people will have different candy abstractions, and yet they can both value candy.
2. Strength and breadth of activation contexts
    - The more situations a candy-value affects decision-making in, the stronger the chance that candy remains a big part of their life.
3. How often the candy shard will actually activate
    - As an unrealistic example, if the person never enters a cognitive situation which substantially activates the candy-shard, then don't expect them to eat much candy.
    - Activation frequency is other source of value/decision-influence robustness, as e.g. an AI's values don't have to be OK in every cognitive context.[^3]
    - Consider an otherwise altruistic man who has serious abuse and anger problems whenever he enters a specific vacation home with his wife, but is otherwise kind and considerate. As long as he doesn't start off in that home but knows about the contextual decision-influence, he will steer away from that home and try to remove the unendorsed value.
4. Reflectivity of the candy shard
    - (This is more complicated and uncertain. I'll leave it for now.)

Suppose we wanted to train an agent which gets really smart and acquires a lot of candy, now and far into the future. **That agent's decision-influences don't have to be globally robust (e.g. in every cognitive situation, the agent is motivated by candy and only by candy) in order for an agent to make locally good decisions (e.g. make lots of candy now and into the future).**

# II: Values steer optimization; they are not optimized against

Given someone’s values, you might wonder if you can “maximize” those values. On my ontology—where _values_ are _decision-influences_, a sort of _contextual wanting_—“literal value maximization” is a type error.[^4] In particular, given e.g. someone who values candy, there probably isn't a part of that person's cognition which can be argmax’ed to find a plan where the person has lots of candy.

So if I have a candy-shard, if I value candy, if _I am influenced to decide to pursue candy in certain situations_, then _what does it mean to maximize my candy value_? My value is a subcircuit of my policy. It doesn’t necessarily even have an ordering over its outputs, let alone a numerical rating which can be maximized. “Maximize my candy-value” is, in a literal sense, a type error. What quantity is there to maximize?

> [!quote] [Why Agent Foundations? An Overly Abstract Explanation](https://www.lesswrong.com/posts/FWvzwCDRgcjb9sigb/why-agent-foundations-an-overly-abstract-explanation)
>
> the True Name of a thing \[is\] a mathematical formulation sufficiently robust that one can apply lots of optimization pressure without the formulation breaking down\[...\]
>
> If we had the “True Name” of human values (insofar as such a thing exists), that would potentially solve the problem \[of supervised labels only being proxies for what we want\].

In particular, there’s no guarantee that you can just scan someone’s brain and find some True Name of Value which you can then optimize without fear of Goodhart. It’s not like we don’t know what people value, but if we did, we would be OK. I'm pretty confident there does not exist _anything_ within my brain which computes a True Name for my values, ready to be optimized as hard as possible (relative to my internal plan ontology) and yet still producing a future where I get candy.

Therefore, even though you _truly care about candy_, that doesn’t mean you can just whip out the argmax on the relevant shard of your cognition, so as to “maximize” that shard (e.g. via extremizing the rate of action potentials on its output neurons) and then get a future with _lots_ of candy. You’d [probably](https://distill.pub/2017/feature-visualization/) just find a context $c_i∈C$ which acts as an adversarial input to the candy-shard, _even though_ you do really care about candy in a normal, human way.

Complexity of human values isn’t what stops you from argmax’ing human values and thereby finding a good plan. That’s not a sensible thing to try. Values are not, in general, the kind of thing which can be directly optimized over, where you find plans which "maximally activate" your e.g. candy subshards. **Values influence decisions.**

Motivating an AI carries real peril in making sure its decisions chain into each other towards the _right kinds of futures_. If you train a superintelligent sovereign agent which primarily values irrelevant quantities (like paperclips) but doesn't care about you, which then optimizes the whole future hard, then you’re _dead_. But consider that deleting candy subshard #3 (“If `heard 'candy'` and `hunger>20`, then `salivate`”) doesn’t stop someone from valuing candy in the normal way. If you erase that subshard from their brain, it’s not like they start "Goodharting" and forget about the “true nature” of caring about candy because they now have an “imperfect proxy shard.”

An agent argmax'ing an imperfect evaluation function will indeed exploit that function. When specifying an inexploitable evaluation function, you enjoy few degrees of freedom. But that's because that evaluation function must be globally robust.

When I talk about shard theory, [people](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=6Lg5Jbwqg2tifEWZJ#Cyzck3vqEa4EfoXaz) [often](https://www.lesswrong.com/posts/fopZesxLCGAXqqaPv/don-t-align-agents-to-evaluations-of-plans?commentId=hXFMkRexJN4weKGdF) [seem](https://www.lesswrong.com/posts/k4AQqboXz8iE5TNXK/a-shot-at-the-diamond-alignment-problem?commentId=zfSCqZuYebHEKgvf5#zfSCqZuYebHEKgvf5) [to](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=YoxJ5RKmp6b8fk8na#Cyzck3vqEa4EfoXaz) shrug and go "well, you still need to get the values adversarially robustly correct else Goodhart; I don't see how this 'value shard' thing helps." **That's not how values work, that is not what value-shards are.** [**Unlike grader-optimizers which try to maximize plan evaluations, a values-executing agent doesn't optimize its values as hard as possible**](/dont-align-agents-to-evaluations-of-plans)**. The agent's values optimize the world. The values are rules for how the agent acts in relevant contexts.**[^5]

# III: Since values steer cognition, reflective agents try to avoid adversarial inputs to their own values

> [!question]
> If we cannot robustly grade expected-diamond-production for every plan the agent might consider, how might we nonetheless design a smart agent which makes lots of diamonds?
>
> Maybe you can now answer this question. I encourage you to try before moving on.

<hr/>

> [!quote] [Don't design agents which exploit adversarial inputs](/dont-design-agents-which-exploit-adversarial-inputs)
>
> Imagine a mother whose child has been goofing off at school and getting in trouble. The mom just wants her kid to take education seriously and have a good life. Suppose she had two (unrealistic but illustrative) choices.
>
> 1. _Evaluation-child:_ The mother makes her kid care extremely strongly about doing things which the mom would evaluate as "working hard" and "behaving well."
> 2. _Value-child:_ The mother makes her kid care about working hard and behaving well.

To make evaluation-child work hard, we have to somehow specify a grader which can adequately grade all plans which evaluation-child can imagine. The highest-rated imaginable plan must involve working hard. [This requirement is extreme](/dont-design-agents-which-exploit-adversarial-inputs).

Value-child doesn't suffer this crippling "robustly grade exponentially many plans" alignment requirement. I later wrote [a detailed speculative account](/dont-align-agents-to-evaluations-of-plans#And-people-aren-t-grader-optimizers-either) of how value-child's cognition might work—what it _means_ to say that he "cares about working hard." But, at a higher level, what are the main differences between evaluation- and value-child?

This may sound obvious, but I think that the main difference is that **value-child actually cares about working hard.** Evaluation-child cares about evaluations. (See [my detailed speculative account](/dont-align-agents-to-evaluations-of-plans#And-people-aren-t-grader-optimizers-either) if confused on the distinction.) To make evaluation-child work hard in the limit of intelligence, you have to _robustly ensure that max evaluations only come from working hard_. This sure sounds like a slippery and ridiculous kind of thing to try, like wrestling a frictionless pig. It should be no surprise you'll hit issues like [nearest unblocked strategy](https://arbital.com/p/nearest_unblocked/) in that paradigm.

An agent which _does_ care about working hard will want to not think thoughts which lead to not working hard. In particular, reflective shard-agents can think about what to think, and thereby are convergently (across values) incentivized to steer clear of adversarial inputs to their own values.

## Reflectively avoiding adversarial inputs to your thinking

Reflective agents can think about their own thought process (e.g. "should I spend another five minutes thinking about what to write for this section?"). I [think they do this via their world-model predicting internal observables](/a-shot-at-the-diamond-alignment-problem#The-agent-becomes-reflective) (e.g. future neuron activations) and thus high-level statistics like "If I think for 5 more minutes, will that lead to a better post or not?".

Thoughts about future thinking are a kind of decision. Decisions are steered by values. Therefore, thoughts about future thinking are steered by whatever value shards activate in that mental context. For example, a self-care value might activate, and a learning-shard, and a social value might activate as well. They control your reflective thoughts, just like other shards would control your ("normal") actions (like crossing the room).

> [!quote] [Don't design agents which exploit adversarial inputs](/dont-design-agents-which-exploit-adversarial-inputs)
>
> \[In\] [the optimizer's curse](https://pubsonline.informs.org/doi/abs/10.1287/mnsc.1050.0451), evaluations (e.g. "In this plan, how hard is evaluation-child working? Is he behaving?") are often corrupted by the influence of unendorsed factors (e.g. the attractiveness of the gym teacher caused an upwards error in the mother's evaluation of that plan). If you make choices by considering $n$ options and then choosing the highest-evaluated one, then the more $n$ increases, the harder you are selecting for upwards errors in your own evaluation procedure.
>
> > The proposers of the Optimizer's Curse also described a Bayesian remedy in which we have a prior on the expected utilities and variances and we are more skeptical of high estimates. This however assumes that the prior itself is perfect, as are our estimates of variance. If the prior or variance-estimates contain large flaws somewhere, a search over a wide space of possibilities would be expected to seek out and blow up any flaws in the prior or the estimates of variance.
> >
> > [Goodhart's Curse, Arbital](https://arbital.com/p/goodharts_curse/)
>
> As far as I know, it's indeed not possible to avoid the curse in full generality, but it doesn't have to be that bad in practice. If I'm considering three research directions to work on next month, and I happen to be grumpy when considering direction #2, then maybe I don't pursue that direction. Even though direction #2 might have seemed the most promising under more careful reflection. I think that the distribution of plans I consider involves relatively small upwards errors in my internal evaluation metrics. Sure, maybe I occasionally make a serious mistake due to the optimizer's curse due to upwards "corruption", but I don't expect to _literally die_ from the mistake.
>
> Thus, there are _degrees_ to the optimizer's curse.

Both grader-optimization and argmax cause extreme, horrible optimizer's curse. Is alignment just that hard? I think not.

The distribution of plans which I usually consider is not going to involve any set of mental events like "consider in detail building a highly persuasive superintelligence which persuades you to build it." While a reflective diamond-valuing AI which _did_ execute the plan's mental steps might get hacked by that adversarial input, there would be no reason for it to seek out that plan to begin with.

$$
\overset{\text{Thinking about adv-plan in detail seems bad}\ldots}{\mathrm{eval}(\text{evaluate the adversarial plan})=-1}
$$

$$
\qquad\overset{\text{Even though actual evaluation of the plan would score super highly}}{\mathrm{eval}(\text{adversarial plan})=\mathtt{INT\_MAX}.}
$$

The diamond-valuing AI would consider a distribution of plans far removed from the extreme upwards errors highlighted in the evaluation-child story. (I think that this is why _you,_ in your day-to-day thinking, don't have to worry about plans which are extreme adversarial inputs to your own evaluation procedures.) Even though a smart reflective AI may be implicitly searching over a range of plans, it's doing so _reflectively_, thinking about what to think next, and perhaps not taking cognitive steps which it reflectively predicts to lead to bad outcomes (e.g. via the optimizer's curse).

On the other hand, an AI which is aligned on the evaluation procedure is _incentivized to seek out huge upwards errors on the evaluation procedure relative to the intended goal_. The actor is _trying_ to generate plans which maximally exploit the grader's reasoning and judgment.[^6]

Thus, if an AI cares about diamonds (i.e. has an influential diamond-shard), that AI might accidentally select a plan due to upwards evaluative noise, but that does not mean the AI is _actively looking for plans to fool its diamond-shard into oblivion._ The AI may make a mistake in its reflective predictions, but there's no extreme optimization pressure for it to make mistakes like that. The AI wants to avoid those mistakes, so those mistakes remain unlikely. I think that reflective, smart AIs convergently want to avoid duping their own evaluative procedures, for the same reasons you want to avoid doing that to yourself.

More precisely:

1. A reflective diamond-motivated agent chooses plans based on how many diamonds they lead to.
2. Consider plans where the agent just improves its diamond synthesis methods. The agent can predict e.g. whether diamond production is increased by searching for plans involving simulating malign superintelligences which trick the agent into thinking the simulation plan makes lots of diamonds.
3. A reflective agent knows that simulating those superintelligences doesn't lead to many diamonds.
4. Therefore, the reflective agent chooses to think about improving its diamond synthesis methods. The agent automatically[^7] avoids the worst parts of the optimizer's curse. In contrast, grader-optimization which seeks out adversarial inputs to the diamond-motivated part of the system.

Therefore, avoiding the high-strength curse seems conceptually straightforward. In the case of aligning an AI to produce lots of diamonds, we want the AI to superintelligently generate and execute diamond-producing plans _because_ the AI expects those plans to lead to lots of diamonds. [I have spelled out a plausible-to-me story for how to accomplish this.](/a-shot-at-the-diamond-alignment-problem) The story is simple in its essential elements: finetune a pretrained model by rewarding it when it collects diamonds.

While that story has real open questions, that story also totally sidesteps the problems with grader-optimization. You don't have to worry about providing some globally unhackable evaluation procedure to make super duper sure the agent's plans "really" involve diamonds. If the early part of training goes as described, the agent _wants_ to make diamonds, and (as [I explained in the diamond-alignment story](/a-shot-at-the-diamond-alignment-problem#user-content-fn-7)) it reflectively wants to avoid duping itself because duping itself leads to fewer diamonds.

We thereby answer the question [posed above](#iii-since-values-steer-cognition-reflective-agents-try-to-avoid-adversarial-inputs-to-their-own-values):

> [!question]
> If we cannot robustly grade expected-diamond-production for every plan the agent might consider, how might we nonetheless design a smart agent which makes lots of diamonds?

A reflective agent wishes to _minimize_ the optimizer's curse (relative to its own values), instead of _maximizing_ it (relative to the goal by which the grader evaluates plans). While I don't yet have satisfying pseudocode for reflective planning agents (but see Appendix B for preliminary pseudocode, [effective reflective agents _do_ exist](/humans-provide-alignment-evidence). In this regime, it seems like many scary problems go away and don't come back. That is an enormous blessing.[^8]

## Argmax is an importantly inappropriate idealization of agency

If the answer to "how do we dispel the max-strength optimizer's curse" is in fact "real-world reflective agents do this naturally", then assuming unreflectivity will _rule out the part of solution-space containing the actual solution_:

> [!quote] [_Diamond Maximizer,_ Arbital](https://arbital.com/p/diamond_maximizer/) (emphasis added)
>
> As a further-simplified but still unsolved problem, an **unreflective diamond maximizer** is a diamond maximizer implemented on a [Cartesian hypercomputer](https://arbital.com/edit/) in a [causal universe](https://arbital.com/edit/) that does not face any [Newcomblike problems](https://arbital.com/edit/). This further avoids problems of reflectivity and logical uncertainty. In this case, it seems plausible that the primary difficulty remaining is _just_ the [ontology identification problem](https://arbital.com/p/ontology_identification/).

> [!idea] Insight
> The argmax and unreflectivity assumptions were meant to make the diamond-maximizer problem _easier_. **Ironically, however, these assumptions may well render the diamond-maximizer problem** _**unsolvable**_, leading us to resort to increasingly complicated techniques and proposals, none of which seem to solve "core" problems like evaluation-rule hacking...

# Conclusion

1. **Non-robust decision-influences can be OK.**
2. **Values steer optimization; they are not optimized against.**
3. **Since values steer cognition, reflective agents try to avoid adversarial inputs to their own values.**

The answer is not to find a clever way to get a robust grader. The answer is to not _need_ a robust grader. Form e.g. a diamond-production value within a reflective and smart agent, and this diamond-production value won't be incentivized to fool itself. You won't have to "robustly grade" it to make it produce diamonds.

> [!thanks]
> Thanks to Tamera Lanham, John Wentworth, Justis Mills, Erik Jenner, Johannes Treutlein, Quintin Pope, Charles Foster, Andrew Critch, randomwalks, Ulisse Mini, and Garrett Baker for thoughts. Thanks to Vivek Hebbar for in-person discussion.

# Appendix A: Several roads lead to a high-strength optimizer's curse

1. **Uncertainty about how human values work.** Suppose we think that human values are so complex, and there's no real way to understand them or how they get generated. We imagine a smart AI as finding futures which optimize some grading rule, and so we need something to grade those futures. We think we can't get the AI to grade the futures, because human values are so complex. What options remain available? Well, the only sources of "good judgment" are existing humans, so we need to find some way to use those humans to target the AI's powerful cognition. We give the alignment, the AI gives the cognitive horsepower. We've fallen into the grader-optimization trap.
2. **Non-embedded forms of agency.** This encourages considering a utility function maximized over all possible futures. Which automatically brings the optimizer's curse down to bear at maximum strength. You can't specify a utility function which is robust against _that_. This seems sideways of real-world alignment, where [realistic motivations may not be best specified in the form of "utility function over observation/universe histories."](https://www.lesswrong.com/posts/dqSwccGTWyBgxrR58/turntrout-s-shortform-feed?commentId=xwJfX45CvaKXFFtCS)

# Appendix B: Preliminary reflective planning pseudocode

I briefly took a stab at writing pseudocode for a values-based agent like value-child. I think this code leaves a lot out, but I figured it'd be better to put _something_ here for now.

```python
'''
Here is one meta-plan for planning. The agent starts from no plan at all, iteratively generates improvements, which get accepted if they lead to more predicted diamonds. Depending on the current situation (as represented in the world_model), the agent might execute a plan in which it looks for nearby diamonds, or it might execute a plan where it runs a different kind of heuristic search on a certain class of plans (e.g. research improvements to the AI's diamond synthesis pathway).

    Any real shard agent would be reasoning and updating asynchronously, so this setup assumes a bit of unrealism.

    This function only modifies the internal state of the agent (self.recurrent), so as to be ready for a call of self.getDecisions().
'''
def plan(self):
  # Generate an initial plan
  plan = Plan() # Do nothing plan
  conseq = self.world_model.getConseq(plan)
  currentPlanEval = self.diamondShard(conseq)

  # Iteratively modify the plan until the generative model can't find a way to make it better
  while True:
   # Sample 5 plan modifications from generative model
   plans = self.world_model.planModificationSample(n=5, stub=plan)

   # Select first local improvement
   for planMod in plans:
    # Reflectively predict consequences of this plan
    newPlan = plan.modify(planMod)
    conseq = self.world_model.getConseq(plan)

    # Take local improvement
    if self.diamondShard(conseq) > currentPlanEval:
     plan = newPlan
     currentPlanEval = self.diamondShard(conseq)
     continue # Generate more modifications

   # Execute the plan, which possibly involves running plan search with a different algorithm and plan initialization.
   isDone = plan.exec()
   if isDone: break
```

# Appendix C: Value shards all the way down

I liked Vivek Hebbar's recent [comment](https://www.lesswrong.com/posts/fopZesxLCGAXqqaPv/don-t-align-agents-to-evaluations-of-plans?commentId=Kq39F8HLJixAyQMZF#Grader_optimization____planning). I liked the comment in the context of e.g. caring about your family and locally evaluating plans on that basis, but also knowing that your evaluation ability itself is compromised and will mis-rate some plans:

> [!quote] Vivek Hebbar's recent [comment](https://www.lesswrong.com/posts/fopZesxLCGAXqqaPv/don-t-align-agents-to-evaluations-of-plans?commentId=Kq39F8HLJixAyQMZF#Grader_optimization____planning)
>
> My attempt at a framework where "improving one's own evaluator" and "believing in adversarial examples to one's own evaluator" make sense:
>
> - The agent's allegiance is to some idealized utility function $U_{ideal}$ (like CEV). The agent's internal evaluator `Eval` is "trying" to approximate $U_{ideal}$ by reasoning heuristically. So now we ask Eval to evaluate the plan "do argmax w.r.t. Eval over a bunch of plans". Eval reasons that, due to the way that Eval works, there should exist "adversarial examples" that score very highly on Eval but low on $U_{ideal}$. Hence, Eval concludes that $U_{ideal}(plan)$ is low, where plan = "do argmax w.r.t. Eval". So the agent doesn't execute the plan "search widely and argmax".
> - "Improving `Eval`" makes sense because Eval will gladly replace itself with `Eval_2` if it believes that `Eval_2` is a better approximation for $U_{ideal}$ (and hence replacing itself will cause the outcome to score better on $U_{ideal}$)
>
> Are there other distinct frameworks which make sense here?

(I'm not sure whether Vivek meant to imply "and this is how I think people work, mechanistically." I'm going to respond to a _hypothetical other person_ who did in fact mean that.)

My take is that human value shards explain away the need to posit alignment to an idealized utility function. A person is not a bunch of crude-sounding subshards (e.g. "If `food nearby` and `hunger>15`, then be more likely to `go to food`") and then _also_ a sophisticated utility function (e.g. something like CEV). It's shards all the way down, and all the way up.[^10]

Vivek then wrote:

> I look forward to seeing what design Alex proposes for "value child".

Value shards steer cognition. In the main essay, I wrote:

> [!quote]
>
> 1. A reflective diamond-motivated agent chooses plans based on how many diamonds they lead to.
> 2. The agent can predict e.g. how diamond-promising it is to search for plans involving simulating malign superintelligences which trick the agent into thinking the simulation plan makes lots of diamonds, versus plans where the agent just improves its synthesis methods.
> 3. A reflective agent knows that the first plan doesn't lead to many diamonds, while the second plan leads to more diamonds.
> 4. Therefore, the reflective agent chooses the second plan over the first plan, automatically avoiding the worst parts of the optimizer's curse. (Unlike grader-optimization, which seeks out adversarial inputs to the diamond-motivated part of the system.)

This story smoothly accommodates thoughts about improving evaluation ability.

On my understanding: Your values are steering the optimization. They are not, in general, being optimized against by some search inside of you. They are probably not pointing to some idealized utility function. The decision-influences are _guiding_ the search. There's no secret other source of caring, no externalized utility function.

[^1]:
    Formalizing the action space $A$ is a serious gloss. In people, there is no privileged “action” space, considering how I can decide what to think about next. As an embedded agent, I don’t just decide what motor commands to send and what words to say—I also can decide what to decide next, what to think about next.

    I think the point of the essay stands anyways.

[^2]: This doesn’t mean that I’m using words the same way other people have, when deliberating on whether an AI’s values have to be “robust.” I’m more inclined to just carry out the shard theory analysis and see what experiences it leads me to anticipate, instead of arguing about whether my way of using words matches up with how other people have used words.
[^3]: As Charles Foster notes:

    > This isn't entirely on the side of robustness. It also means that by default, even if we get the AI to have an X decision influence in one context, that doesn't necessarily also activate in another context we might want it to generalize to.

[^4]: I think that many people say "maximize my values" to mean something like "do something as great as possible, relative to what I care about." So, in a sense, "type error" is pedantic. But also I think the type error complaint points at something important, so I'll say it anyways.
[^5]: If you want to argue that _decision-influences_ have to be robust else Goodhart, you need new arguments not related to grader-optimization. It is simply invalid to say "The agent doesn't value diamonds in some situation where lots of its values activate strongly, and therefore the agent won't make diamonds because it Goodharts on that unrelated situation." That is not what values do.
[^6]:
    In a recent Google Doc thread, grader optimization came up. Here's the exchange (splicing in my responses to each section):

    <!-- vale off -->
    > **Other person:** So you're imagining something like: the agent (policy) is optimizing for a reward model to produce a high number, and so the agent analyzes the reward model in detail to search for inputs that cause the reward model to give high numbers?
    >
    > **Me:** Yes.
    >
    > **Other person:** I think at that level of generality I don't know enough to say whether this is good or bad.
    >
    > **Me:** I think this is very, very probably bad.
    >
    > **Other person:** We want our AI system to search for approaches that better enact our values. As you note, the optimizer's curse says that we'll tend to get approaches that overestimate how much they actually enact our values. But just knowing that the optimizer's curse will happen doesn't change anything; the best course of action is still to take the approach that is predicted to best enact our values. In that sense, the optimizer's curse is typically something you have to live with, not something you can solve.[...]
    >
    > **Me:** A small error is not the same as a maximal error. Reflective agents can and will avoid deliberately searching for plans which maximize upwards errors in their own evaluations (e.g. generating a plan such that, while considering the plan, a superintelligence inside the plan tricks you into thinking the plan should be highly evaluated), because the agents reflectively predict that that hurts their goal achievement (e.g. leads to fewer diamonds). If you somewhat understand your decision-making, you can consider plans you're less likely to incorrectly evaluate.
    >
    > **Other person:** So my followup question is: can you name a single approach that doesn't have this failure mode, while still allowing us to use the AI to do things we didn't think about in advance?
    >
    > **Me:** [Yes](/a-shot-at-the-diamond-alignment-problem).
    >
    > **Other person:** One answer someone might give is "create an agent-with-shards that searches for approaches that score highly on the shard.
    >
    > **Me:** Insofar as this means "the agent looks for inputs which maximize the aggregate shard output", no. On my model, shards grade and modify plans, including plans about which plans to consider next. They are not searching for plans which maximize evaluative output, like in the reward-model case.
    >
    > **Other person:** An agent that searches for high scores on its shard can't be searching for positive upwards errors in the shard; there is no such thing as an error in the shard". To which the response is "that's from the agent's perspective. From the human's perspective, the agent is searching for positive upwards differences between the shards and what-the-human-wants".
    >
    > **Me:** Even if true, this would be not be an optimizer's curse problem.
    >
    > But also this isn't true, at least not without further argumentation. If my kid likes mocha and I like latte, is my child searching for positive upwards differences between their values and mine? I think there are some situations like that. For example, suppose the AI values paperclips while the humans value love. In this situation, the AI is searching for paperclippish plans which will systematically be bad plans by human lights. That seems more like instrumental convergence → disempower humans → not much love left for us if we're dead.
    <!-- vale on -->

[^7]: I do think that e.g. a diamond-shard can [get fed](/dont-align-agents-to-evaluations-of-plans#Value-child-is-still-vulnerable-to-adversarial-inputs) an adversarial input, but the diamond-shard won't bid for a plan where it fools _itself_.
[^8]: It's at this point that my model of Nate Soares wants to chime in.

    <!-- vale off -->
    > **Alex's model of Nate:** This sure smells like a problem redefinition in which you simply sweep the hard part of the problem under a less obvious corner of the rug. Why shouldn't I believe you've just done that?
    >
    > **Alex:** A reasonable and productive heuristic in general, but inappropriate here. Grader-optimization explicitly incentivizes the agent to find maximal upwards errors in a diamond-evaluation module, whereas a reflective diamond-valuing agent has no incentive to consider such plans, because it reflectively predicts those plans don't lead to diamonds. If you disagree, please point to the part of the story where, conditional on the previous part of the story obtaining, the grader-optimization problem reappears.
    >
    > **Alex's model of Nate:** Suppose we achieved your dream of forming a diamond-shard in an AI, and that that shard holds significant power over the AI's decisions. Now the AI keeps improving itself. Doesn't "get smarter" look a lot like "implicitly consider more options", which brings the curse back?
    >
    > **Alex:** If the agent is diamond-aligned at this point in time, I expect it stays that way for the reasons given in the "[agent prevents value drift](/a-shot-at-the-diamond-alignment-problem#The-agent-prevents-value-drift)" section, along with [this footnote](/a-shot-at-the-diamond-alignment-problem#user-content-fn-11) and the [appendix](/a-shot-at-the-diamond-alignment-problem#Appendix-The-AI-s-advantages-in-solving-successor-alignment). As a specific answer, though: If the agent does care about diamonds at that point it time, then it doesn't **want** to get so "smart" that it deludes itself by seriously intensifying the optimizer's curse. It doesn't want to do so for the reason **we** don't want it to do so (in the hypothetical where we just want to achieve diamond-alignment). If the reflective agent can predict that outcome of the plan, it won't execute the plan, _because that plan leads to fewer diamonds_.
    >
    > **Alex's model of Nate:** So the AI still has to solve the AI alignment problem, except with its successors.
    >
    > **Alex:** Not all things which can be called an "AI alignment problem" are created equal. [The AI has a range of advantages](/a-shot-at-the-diamond-alignment-problem#Appendix-The-AI-s-advantages-in-solving-successor-alignment), and I [detailed one way it could use those advantages](/a-shot-at-the-diamond-alignment-problem#user-content-fn-11). I do expect that kind of plan to actually work.
    <!-- vale on -->

[^10]: When working out [shard theory](/shard-theory) with Quintin Pope, one of my favorite moments was the _click_ where I stopped viewing myself as some black-box optimizing "some complicated objective." Instead, this hypothesis reduced my own values to [mere reality](https://www.lesswrong.com/tag/mere-reality). Every aspiration, every unit of caring, every desire for how I want the future to be bright and fun—subroutines, subshards, contextual bits of decision-making influence, all traceable to historical reinforcement and update events.
