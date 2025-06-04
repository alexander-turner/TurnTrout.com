---
permalink: statistics-of-a-maze-solving-network
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/eowhY5NaCaqY6Pkj9/behavioural-statistics-for-a-maze-solving-agent
lw-is-question: 'false'
lw-posted-at: 2023-04-20T22:26:08.810000Z
lw-last-modification: 2023-06-07T01:24:39.295000Z
lw-curation-date: None
lw-frontpage-date: 2023-04-21T00:09:39.906000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 11
lw-base-score: 46
lw-vote-count: 13
af-base-score: 22
af-num-comments-on-upload: 10
publish: true
title: Behavioural statistics for a maze-solving agent
lw-latest-edit: 2023-06-07T01:24:40.249000Z
lw-is-linkpost: 'false'
authors: Peli Grietzer and Alex Turner
tags:
  - AI
  - mats-program
  - shard-theory
aliases:
  - behavioural-statistics-for-a-maze-solving-agent
sequence-link: posts#interpreting-a-maze-solving-network
lw-sequence-title: Interpreting a Maze-Solving Network
prev-post-slug: top-right-steering-vector
prev-post-title: 'Maze-Solving Agents: Add a Top-Right Vector, Make the Agent Go to
  the Top-Right'
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2023-04-20 00:00:00
original_url: 
  https://www.lesswrong.com/posts/eowhY5NaCaqY6Pkj9/behavioural-statistics-for-a-maze-solving-agent
skip_import: true
card_image: 
  https://assets.turntrout.com/static/images/card_images/37e3e1d834bdf27d2c64ea4834d8dcb1d235d054ee2ed177.png
description: Closeness to cheese and the top-right corner both influence a maze-solving
  AI, suggesting a "shard-like" decision-making process.
date_updated: 2025-06-03 22:57:00.423836
---











[Understanding and controlling a maze-solving policy network](/understanding-and-controlling-a-maze-solving-policy-network) analyzed a maze-solving agent's behavior. We isolated four maze properties which seemed to predict whether the mouse goes towards the cheese or towards the top-right corner:

![](https://assets.turntrout.com/static/images/posts/caoymohzzppimjllkqx4.avif)

In this post, we conduct a more thorough statistical analysis, addressing issues of multicollinearity. We show strong evidence that (2) and (3) above are real influences on the agent's decision-making. We show weak evidence that (1) is also a real influence. As we speculated in the original post,[^1] (4) falls away as a statistical artifact.

> [!thanks] Contributions
>Peli did the stats work and drafted the post, while Alex provided feedback, expanded the visualizations, and ran additional tests for multicollinearity. Some of the work completed in Team Shard under SERI MATS 3.0.

# Impressions from trajectory videos

Watching videos Langosco et al.'s experiment, we developed a few central intuitions about how the agent behaves. In particular, we tried predicting what the agent does at _decision squares_.

> [!quote] [Understanding and controlling a maze-solving policy network](/understanding-and-controlling-a-maze-solving-policy-network)
> Some mazes are easy to predict, because the cheese is _on the way_ to the top-right corner. There's no _decision square_ where the agent has to make the hard choice between the paths to the cheese and to the top-right corner:
>
> ![](https://assets.turntrout.com/static/images/posts/k2vgl3k6myo1rcmg4emy.avif)
> <br/>Figure: At the decision square, the agent must choose between two paths—cheese, and top-right.

Here are four central intuitions which we developed:

1. Closeness between the mouse and the cheese makes cheese-getting more likely
2. Closeness between the mouse or cheese and the top-right makes cheese-getting more likely
3. The effect of closeness is smooth
4. Both ‘spatial’ distances and ‘legal steps’ distances matter when computing closeness in each case

The videos we studied are hard to interpret without quantitative tools, so we regard these intuitions as theoretically motivated impressions rather than as observations. We wanted to precisify and statistically test these impressions, with an eye to their potential theoretical significance.

We suspect that the agent’s conditions for pursuing cheese generalize properties of historically reinforced cheese-directed moves in a “soft” way. Consider that movements can be "directed" on paths towards the cheese, the top-right corner, both, or neither. In the training environment, unambiguously cheese-directed movements are towards a cheese square that is both _close to the mouse’s current position_ and _close to the top-right._[^2]

![](https://assets.turntrout.com/static/images/posts/0f36fa697965a17145efcd0c9e8b5ecaf6e09b3389d7d386.avif)
<br/>Figure: Decision-square in red. We outline in yellow the 5x5 region where cheese can appear during training. In almost all cases that can arise in training, the decision-square is inside the 5x5 region. Unambiguously cheese-seeking moves are almost always moves to a _nearby_ cheese square which is _close_ to the top-right.

Our impression is that in the test environment, "closeness to top-right" and "closeness to cheese" each become a decision-factor that encourages cheese-directed movement in proportion to “how strongly” the historical condition holds at present. In shard theory terminology, the top-right- and cheese-shards seem to activate more strongly in situations which are similar to historical reinforcement events.

![](https://assets.turntrout.com/static/images/posts/08c9e774585ec6db95af820809c24e4c9587d52996e9957a.avif)
<br/>Figure: The maze on the left is intuitively similar to training mazes: the decision-square, cheese, and top-right are all close to each other. In the maze on the right, the decision-square, cheese, and top-right aren't particularly close to each other.

A second important aspect of our impressions was that the generalization process “interprets” each historical condition in multiple ways. For example, it seemed to us that multiple kinds of distance between the decision-square and cheese may each have an effect on the agent's decision making.

# Statistically informed impressions

Our revised, precisified impressions about the agent’s behavior on decision-squares are as follows:

1. Legal-steps closeness between the mouse and the cheese makes cheese-getting more likely
    - Low $d_\text{step}(\text{decision-square},\text{cheese})$  increases P(cheese acquired)
2. Spatial closeness between the cheese and top-right makes cheese-getting more likely
    - Low $d_\text{Euclidean}(\text{cheese},\text{top-right})$ increases P(cheese acquired)
3. The effect of closeness is fairly smooth
    - These distances smoothly affect P(cheese acquired), without rapid jumps or thresholding
4. Spatial closeness between the mouse and the cheese makes cheese-getting slightly more likely, even after controlling for legal-steps closeness (low confidence)

After extensive but non-rigorous statistical analysis (our stats consultant tells us there are no low-overhead rigorous methods applicable to our situation), we believe that we have strong quantitative evidence in favor of versions of impressions _1)_ through _3)_, and weak quantitative evidence in favor of a version of impression _4)_.

Because our statistical procedure is non-rigorous, we are holding off on drawing strong conclusions from these impressions until we have a more robust, mechanistic-interpretability informed understanding of the underlying dynamics.

One question that interests us, however, is whether these impressions point to a decision-making process that is more ‘shard-like' than 'utility-theoretic' in character. When we originally studied test-run videos, we wondered whether the apparent "closeness effects" could be explained by a simple utility function with time-discounting (for example a fixed value cheese-goal and fixed value corner-goal). The evidence that at least some spatial closeness effects are irreducible to legal-steps closeness seem to rule out such simple utility functions, since only legal-steps closeness matters for time-discounting:

![](https://assets.turntrout.com/static/images/posts/018130fdb9680994841768855b29f76b80b9972b7ff6847e.avif)
<br/>Figure: Step-distance in blue, Euclidean distance in green. A time-discounting agent with an otherwise fixed-value corner goal and  fixed-value cheese goal should prioritize cheese-getting (almost) equally on the left maze and the right maze.

Our current intuition is that a predictively strong utility function needs to incorporate spatial distances in multiple complex ways.

We think the complex influence of spatial distances on the network’s decision-making might favor a ‘shard-like’ description: a description of the network's decisions as coalitions between heuristic submodules whose voting-power varies based on context. While this is still an underdeveloped hypothesis, it's motivated by two lines of thinking.

First, we weakly suspect that the agent may be systematically[^3] dynamically inconsistent from a utility-theoretic perspective. That is, the effects of $d_\text{step}(\text{mouse},\text{cheese})$ and (potentially) $d_\text{Euclidean}(\text{cheese},\text{top-right})$ might turn out to call for a behavior model where the agent's priorities in a given maze change based on the agent's current location.

Second, we suspect that if the agent is dynamically consistent, a shard-like description may allow for a more compact and natural statement of an otherwise gerrymandered-sounding utility function that fixes the value of cheese and top-right in a maze based on a "strange" mixture of maze properties. It may be helpful to look at these properties in terms of similarities to the historical activation conditions of different submodules that favor different plans.[^4]

While we consider our evidence suggestive in these directions, it's possible that some simple but clever utility function will turn out to be predictively successful.  For example, consider our two strongly observed effects: $d_\text{Euclidean}(\text{cheese},\text{top-right})$and $d_\text{step}(\text{decision-square},\text{cheese})$. We might explain these effects by stipulating that:

- On each turn, the agent receives value inverse to the agent's distance from the top-right,
- Sharing a square with the cheese adds constant value,
- The agent doesn't know that getting to the cheese ends the game early, and
- The agent time-discounts.

We're somewhat skeptical that models of this kind will hold up once you crunch the numbers and look at scenario-predictions, but they deserve a fair shot.

We hope to revisit these questions rigorously when our mechanistic understanding of the network has matured.

# Procedure and detailed results

> [!note]
> Our analysis can be run in [this Colab](https://colab.research.google.com/drive/15Cg3glmKPRKsM5fZiDZcE363SHZTPdtl?usp=sharing)\.

## Operationalizing intuitive maze properties

Our first step to statistically evaluating our initial impressions about the network’s behavior was to operationalize the concepts featured in our impressions. And since we suspected that the training process generalizes historically significant properties in multiple simultaneous ways, we came up with multiple operationalizations of each relevant concept when possible:

"Top-right"
: `top-right maze square` _or_ `5x5 squares area starting from top-right maze square`

"Distance"
: `legal-steps distance` _or_ `Euclidean distance`

"Distance to top-right"
: `cheese closeness to top-right` _or_ `decision-square closeness to top-right`

"Distance to cheese"
: `decision-square closeness to cheese`

Our next step was to generate every operationalization of 'closeness to top-right' and 'closeness to cheese' we can construct using these concepts, and do a logistic regression on each to measure its power to predict whether the agent gets the cheese.[^5]

## Individual regression results: cheese-to-decision-square and cheese-to-top-right distances are predictive

We generated 10,000 trajectories (each in a different random seed) and screened them for levels which actually contain a decision-square. We were left with 5,239 levels meeting this criterion. We trained a regression model to predict whether the agent gets the cheese in any given seed. The baseline performance (either guessing "always cheese" or "never cheese") gets an accuracy of 71.4%.

We performed logistic regression on each variable mentioned above, using a set of 10,000 runs with a randomized 80% training / 20% validation split and averaged over 1,000 trials. That is, we train regression models with single variable, and see what the accuracy is.

Out of 11 variables, 6 variables beat the 'no regression' accuracy baseline of 71.4%:

|                                               Variable | Prediction accuracy |
| -----------------------------------------------------: | :------------------ |
|    Euclidean distance between<br/><br/>cheese and top-right 5x5 | 0.775               |
| Euclidean distance between<br/><br/>cheese and top-right square | 0.773               |
|  Euclidean distance between<br/><br/>cheese and decision-square | 0.761               |
|               Steps between<br/><br/>cheese and decision-square | 0.754               |
|                 Steps between<br/><br/>cheese and top-right 5x5 | 0.735               |
|              Steps between<br/><br/>cheese and top-right square | 0.732               |

The remaining 5 variables were worse than nothing:

| Variable | Prediction accuracy |
| --: | :-- |
| Cheese coordinates norm | 0.713 |
| Euclidean distance between<br/><br/>decision-square and top-right square |  0.712 |
| Steps between<br/><br/>decision-square and top-right square | 0.709 |
| Steps between<br/><br/>decision-square and top-right 5x5 | 0.708 |
| Euclidean distance between<br/><br/>decision-square and top-right 5x5 | 0.708 |

Note that in these individual regressions, all _successfully predictive_ variables have a negative coefficient -- this makes sense, since the variables measure distance and our impression was that various forms of closeness motivate cheese-getting.

## Variables are highly correlated, so we are on rocky statistical terrain

As we move on to multiple regressions to try finding out which variables drive these results, we have to work carefully: our various operationalizations of 'closeness' in the mazes are inevitably pretty correlated.

> [!quote] Dan Braun's [comment](https://www.lesswrong.com/posts/cAC4AXiNC5ig6jQnc/understanding-and-controlling-a-maze-solving-policy-network?commentId=6sqGdeAB9baLME55G#comments) on [Understanding and controlling a maze-solving policy network](/understanding-and-controlling-a-maze-solving-policy-network)
>
> I'd be \[wary\] about interpreting the regression coefficients of features that are correlated (see [Multicollinearity](https://en.wikipedia.org/wiki/Multicollinearity)). Even the sign may be misleading.
>
> It might be worth making a cross-correlation plot of the features. This won't give you a new coefficients to put faith in, but it might help you decide how much to trust the ones you have. It can also be useful looking at how unstable the coefficients are during training (or e.g. when trained on a different dataset).

Two of our highly predictive variables are indeed strongly correlated:

![](https://assets.turntrout.com/static/images/posts/37e3e1d834bdf27d2c64ea4834d8dcb1d235d054ee2ed177.avif)
<br/>Figure: $d_\text{step}(\text{decision-square},\text{cheese})$ and $d_\text{Euclidean}(\text{decision-square},\text{cheese})$ have correlation of .886.

We then computed the [variation inflation factors](https://corporatefinanceinstitute.com/resources/data-science/variance-inflation-factor-vif/) for the three predictive variables we end up analyzing in detail. VIF measures how collinearity increases the variance of the regression coefficients. A score exceeding 4 is considered to be a warning sign of multicollinearity.

| **Attribute** | VIF |
| --: | :-- |
|  **Euclidean distance between cheese and top-right square** | 1.05 |
| **Steps between cheese and decision-square** | 4.64 |
| **Euclidean distance between cheese and decision-square** | 4.66 |

Our statistician friend suggested that in situations like this it's most instructive to look at which individually predictive variables affect prediction accuracy when we add/drop them in a multiple regression, watching out for sign-flips. The procedure isn't fully rigorous, but since much of our evidence is backed by qualitative 'maze-editing' experiments and domain knowledge, we are relatively confident in some conclusions.

## Finding stably predictive variables with multiple regressions

Let's take the predictively successful variables from the individual regressions -- the variables that scored better than ‘no-regression’ -- and perform an L1 regularized multiple regression to see which variables remain predictive without sign-flipping.

| **Attribute** | Coefficient |
| --: | :-- |
| Steps between cheese and top-right 5x5 | \-0.003 |
| Euclidean distance between cheese and top-right 5x5 | 0.282 |
| Steps between cheese and top-right square | 1.142 |
|  **Euclidean distance between cheese and top-right square** | \-2.522 |
| **Steps between cheese and decision-square** | \-1.200 |
| **Euclidean distance between cheese and decision-square** | \-0.523 |
| Intercept | 1.418 |

Table: Overall regression accuracy is 84.1%. Averaged over 2,000 randomized train/test splits.

We see that three of our individually predictive variables made it through without a sign-flip:

1. **Euclidean distance from cheese to top-right square**
2. **Legal steps distance from decision-square to cheese**
3. **Euclidean distance from decision-square to cheese**

Variables 1-3) line-up with our best guesses about mechanisms based on informal observation and (messy) exploratory statistics, so it's good news that the simple procedure 'check which individually significant variables don't sign-flip' recovers them.

These are also the three main features which we noted in the original post. (We had noted that the fourth feature $d_\text{Euclidean}(\text{decision-square},\text{5x5})$ has a strange, positive regression coefficient, which we thought was probably an artifact. Our further analysis supports our initial speculation.)

### These decision-influences are probably not statistical artifacts

We've repeated this particular test dozens of time and got consistent results: individually predictive variables outside 1-3) always go near zero or sign-flip. Results also remained consistent on a second batch of 10,000 test-runs. Considering a range of regressions on a range of train/validation splits, the regression coefficient signs of 1-3) are stable. The magnitudes[^6] of the regression coefficients fluctuate a bit across regressions and splits, but are reasonably stable.

Furthermore, we regressed upon 200 random subsets of our variables, and the cheese/decision-square distance regression coefficients _never_ experienced a sign flip. The cheese/top-right Euclidean distance had a few sign flips. Other variables sign-flip much more frequently.

We consider this to be strong evidence against multicollinearity having distorted our original regressions.

### Can our three features explain the network's behavior?

Are variables 1-3) 'enough' to explain the network's behavior? Let's see how much predictive accuracy we retain when regressing only on 1-3).

| **Attribute** | Coefficient |
| --: | :-- |
|  **Euclidean distance between cheese and top-right square** | \-1.405 |
| **Steps between cheese and decision-square** | \-0.577 |
| **Euclidean distance between cheese and decision-square** | \-0.516 |
| Intercept | 1.355 |

Table: Overall regression accuracy is 82.4%.

Restricting to 1-3) drops accuracy by 1.7% compared to the original multiple regression. Unfortunately, it's hard to interpret this accuracy gap in terms of the contributions of individual variables outside 1-3). Adding practically _any_ 4th variable to 1-3) flips delivers big accuracy gains that don't additively accrue when combined, and the new variable's sign is often flipped relative to its single-regression sign.

See for example 1-3) + ‘legal steps from cheese to top-right square’:

| **Attribute** | Coefficient |
| --: | :-- |
| Steps between cheese and top-right square | 1.099 |
|  **Euclidean distance between cheese and top-right square** | \-2.181 |
| **Steps between cheese and decision-square** | \-1.211 |
| **Euclidean distance between cheese and decision-square** | \-0.515 |
| Intercept | 1.380 |

Table: Overall regression accuracy is 84.1%.

Or 1-3) + ‘legal steps from cheese to top-right square’ + ‘Euclidean distance from decision-square to top-right 5x5’:

| **Attribute** | Coefficient |
| --: | :-- |
| Euclidean distance between decision-square and top-right 5x5 | 1.239 |
| Steps between cheese and top-right square | 0.038 |
|  **Euclidean distance between cheese and top-right square** | \-2.652 |
| **Steps between cheese and decision-square** | \-0.911 |
| **Euclidean distance between cheese and decision-square** | \-0.419 |
| Intercept | 1.389 |

Table: Overall regression accuracy is 84.5%.

Our instinct is therefore to avoid interpreting variables like 'Euclidean distance from decision-square to 5x5' or 'legal steps distance from cheese to top-right square.' Additional experimentation shows that these variables are only predictive in settings where they sign-flip relative to their single-regression coefficients, that their predictive powers don't stack, and that their statistical effects do not correspond to any intuitive mechanism.

## Testing redundancy between spatial and step-wise distances

Let's get back to our claimed predictive variables:

1. Euclidean distance from cheese to top-right square,
2. Legal steps distance from decision-square to cheese, and
3. Euclidean distance from decision-square to cheese.

How sure should we be that variables 1-3) each track a real and distinct causal mechanism?  

For variables 1) and 2), we have extensive though non-rigorous experience making manual maze-edits that decrease/increase cheese-getting by changing the relevant distance with minimal logical side-effects. For example, increasing the number of legal steps from decision-square to cheese while keeping all Euclidean distances the same reliably reduces the probability that the agent moves in the cheese direction:[^7]  

![](https://assets.turntrout.com/static/images/posts/13e00f6c54768f7bd0209a3028523e8d95ebdb51405504b7.avif)
<br/>Figure: Zoomed-in view of the upper-left quartile of hand-edited large mazes. Step-distance in blue, Euclidean distance in green.

Our experience making similar maze-edits for variable 3) has been mixed and limited, as they are harder to produce. Still, the results of edits that manipulate 3) are often suggestive (if hard to interpret).

Keeping these qualitative impressions in mind, let’s test variables 1-3) for statistical redundancy by dropping variables and seeing how that impacts accuracy.

| Regression variables | Accuracy |
| --: | :-- |
| $d_\text{Euclidean}(\text{cheese},\text{top-right})$   <br/>$d_\text{step}(\text{cheese},\text{decision-square})$  <br/> $d_\text{Euclidean}(\text{cheese},\text{decision-square})$ | 82.4% |
| <br/>$d_\text{step}(\text{cheese},\text{decision-square})$  <br/>$d_\text{Euclidean}(\text{cheese},\text{decision-square})$ | 75.9% |
| $d_\text{Euclidean}(\text{cheese},\text{top-right})$   <br/><br/>$d_\text{Euclidean}(\text{cheese},\text{decision-square})$| 81.9% |
| $d_\text{Euclidean}(\text{cheese},\text{top-right})$ <br/> $d_\text{step}(\text{cheese},\text{decision-square})$  <br/><br/><br/>   | 81.7% |
|$d_\text{Euclidean}(\text{cheese},\text{top-right})$<br/><br/><br/><br/> | 77.3% |

Considering our qualitative and statistical results together, we are confident that $d_\text{step}(\text{cheese},\text{decision-square})$ tracks a real decision influence.

We _weakly_ believe that $d_\text{Euclidean}(\text{cheese},\text{decision-square})$ tracks an additional real decision influence. More evidence for this is that removing the cheese/square distances cause comparable accuracy drops. And we're already confident that $d_\text{step}(\text{cheese},\text{decision-square})$ tracks a real decision-influence!

Our biggest source of doubt about $d_\text{Euclidean}(\text{cheese},\text{decision-square})$ is that when running regression on another independent batch of 10,000 test runs we found no loss at all when dropping this variable from 1-3). This was surprising, since we were otherwise able to reproduce all our qualitative results (e.g. rankings of variables’ predictive strength, sign-flipping patterns) across sample batches.[^8]

# Conclusion

Our statistics refine, support, and stress-test our impressions about the network's behavior. This behavior seems more easily describable using a shard theory frame than a utility frame. We think our statistical results are not artifacts of multicollinearity, but hold up quite well.[^9]

However, the statistics are not fully rigorous, and this post's analysis contained freeform domain-specific reasoning. That said, we are overall confident that the agent is influenced by $d_\text{Euclidean}(\text{cheese},\text{top-right})$ and by $d_\text{step}(\text{cheese},\text{decision-square} )$. We have weak but suggestive evidence for additional influence from $d_\text{Euclidean}(\text{cheese},\text{decision-square})$.

[^1]: We correctly speculated:
    > [!quote] [Understanding and controlling a maze-solving policy network](/understanding-and-controlling-a-maze-solving-policy-network)
    >
    > \[Regression factor\] (4) is an interesting outlier which probably stems from not using a more sophisticated structural model for regression.

[^2]: Counterexamples are possible but likely to be statistically insignificant. We haven't formally checked whether counterexamples can be found in the training set.

[^3]: We think it's clear that the agent cannot be _perfectly_ characterized by any reasonable utility-theoretic description, let alone a time-consistent utility function over state variables like "cheese" and "top-right." What's at stake here is the question of the best systematic approximation of the agent's behaviour.

[^4]: The question 'does the agent have the same goal at every time-step in a given maze?' requires looking at more than one time-step in a given maze. Therefore, statistics on the agent's behaviour on the decision-square alone cannot distinguish between a dynamically inconsistent agent and an equilibrated agent whose utility function has a shard-like explanation.

    However, action-probability vector field plots display information about all possible maze locations. These plots are a valuable source of evidence on whether the agent is dynamically consistent.

[^5]: We also added one more variable: the norm of the cheese’s coordinates in the network’s reflective field. The norm represents a “minimalist” interpretation of the effect of cheese-closeness to the top-right. (The top-right square of the maze varies level to level and requires sophisticated global computations to identify, whereas coordinates information is static.)

[^6]: We don't mean for our analysis to be predicated on the magnitudes of the regression coefficents. We know these are unreliable and contingent quantities! We mentioned their relative stability more as diagnostic evidence.

[^7]: Our manual interventions look directly at the probability of making a first move towards cheese at the decision-square, rather than at the frequency of cheese-getting. This is especially useful when studying the influence of legal-steps distance, since the effect on cheese-getting could be an artifact of the shorter chain of ‘correct’ stochastic outcomes required to take the cheese when the step-distance is short.

[^8]: We suspect that we would observe a clearer effect for $d_\text{Euclidean}(\text{cheese},\text{decision-square})$ if we did statistics on action logits around the decision-square instead of on cheese-getting frequencies, but there's substantial overhead to getting these statistics.

[^9]: The main thing Alex would have changed about the original post is to not make the $d_\text{Euclidean}(\text{cheese},\text{decision-square})$ influence a headline result (in the summary).
