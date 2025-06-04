---
permalink: AI-textbook-review
lw-was-draft-post: "false"
lw-is-af: "false"
lw-is-debate: "false"
lw-page-url: 
  https://www.lesswrong.com/posts/usEZRkMPJBr534vto/the-art-of-the-artificial-insights-from-artificial
lw-is-question: "false"
lw-posted-at: 2018-03-25T06:55:46.204000Z
lw-last-modification: None
lw-curation-date: None
lw-frontpage-date: 2018-03-25T06:55:42.680000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 8
lw-base-score: 31
lw-vote-count: 20
af-base-score: 13
af-num-comments-on-upload: 0
publish: true
title: "The Art of the Artificial: Insights from 'Artificial Intelligence: A Modern
  Approach'"
lw-latest-edit: 2018-03-25T06:55:46.204000Z
lw-is-linkpost: "false"
tags:
  - AI
  - scholarship-&-learning
aliases:
  - the-art-of-the-artificial-insights-from-artificial
lw-sequence-title: Becoming Stronger
lw-sequence-image-grid: sequencesgrid/fkqj34glr5rquxm6z9sr
lw-sequence-image-banner: sequences/oerqovz6gvmcpq8jbabg
sequence-link: posts#becoming-stronger
prev-post-slug: lightness-and-unease
prev-post-title: Lightness and Unease
next-post-slug: linear-algebra-textbook-review
next-post-title: "The First Rung: Insights from 'Linear Algebra Done Right'"
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2018-03-25 00:00:00
original_url: 
  https://www.lesswrong.com/posts/usEZRkMPJBr534vto/the-art-of-the-artificial-insights-from-artificial
skip_import: true
description: My review of "Artificial Intelligence, A Modern Approach" & how I read
  hundreds of pages in 3 days.
date_updated: 2025-06-03 22:57:00.423836
---





    



<br/>
<center>“Most people won't agree to kill themselves for 50 million dollars.”<br/>Stuart Russell and Peter Norvig
</center>

# Foreword

One of the fruits of growing older is revisiting your old favorites, whether they be foods, books, or songs. As you take your warm, rose-tinted mental bath, you appreciate subtleties which had escaped you, laugh heartily at jokes which hadn't even registered, and grasp concepts whose importance you had never fully realized. Similarly, some songs never lose their charm, no matter how abused the 'replay' button becomes. _AI: AMA_ is a paean to the triumphs of Computer Science and a rallying cry towards those hills we have yet to climb (_ahem_).

## Exposition

My process for the first 60% of this 1,052-page behemoth was fairly normal: an hour or two of studying per day over the course of a few weeks. The last bit went a little differently.

### Whatever It Takes

Two days ago, my winter trimester ended; I had upwards of 400 pages to go, half of this post to write, and dozens of exercises to complete. I found myself with three full days to spare before my research resumed the proceeding week. I did what any young man in his early twenties would do - I concocted a plan for studying upwards of 30 hours in that time span.

I knew that this plan was preposterous; in all likelihood, I'd finish 3 chapters and burn out. That's why I wheeled out [Murphyjitsu](https://www.lesswrong.com/posts/N47M3JiHveHfwdbFg/hammertime-day-10-murphyjitsu).

#### Preparing for Failure Modes

**Burnout** was prepared for by:

- The imposition of some questionable beliefs: [^1]
  - _My ego does not deplete._
  - _I am 100% certain that I will succeed._
  - _Given enough time, I can understand anything_.
- The institution of hourly brief exercise breaks. Cutting through the crisp, cold air at high speed got my heart beating and rekindled my passion for crushing the task at hand.
- The construction of a narrative, with me as the protagonist, slowly increasing in capability, working diligently against the racing clock.
  - Yes, I basically turned myself into a trope.
  - No, I don't mind: I'm willing to take advantage of whatever psychological factors are at my disposal to help me succeed.
  - Yes, I listened to the Rocky soundtrack a few times. It was great.

**Mental exhaustion** (distinct from emotional / physical burnout in that your _mind_ can't process concepts as efficiently as it could seven hours ago when you started) was prepared for by:

- Regularly taking breaks to chill out, listen to music, and dance a bit. I'd also spend time dwelling on the pleasant anticipated result of having mastered the important material in the rest of the book, making sure to _contrast it_ with what would happen if I didn't follow through.
  - I made sure to avoid activities that would suck me in.
  - As outlined above - regular exercise and narrative-building.
- The pre-emptive purchase of all my favorite healthful foods; this was a great self-bribe. Having lots of delicious food on hand meant I always had something to look forward to for my breaks, and eating well meant that I didn't feel sluggish. I like to call this tactic "trivial conveniencing".
- Maintaining my regular sleep schedule of 9:30 PM - 6:00 AM.

**Exercises taking forever** was prevented. I performed a quick time profile of my exercise completion and found that the majority of my time was spent rereading concepts which hadn't sunk in sufficiently during the chapter. By doing relevant questions immediately after each section, I decreased time spent by about 40% and increased retention.

**Wanting to do other things** was mitigated by setting aside an hour or two where I'd go to the dojo or spend time with friends. I also took a bit of time for myself each night, calling my family as usual.

#### The Outcome

Not only did I do it, but I finished a day early. The Murphyjitsu was invaluable; the failure modes I predicted came up and were dealt with by my precautions.

24 hours of studying over the last two days, and I enjoyed every moment.

# AI: A Modern Approach

If I found a concept confusing, I'll explain it in both intuitive and technical terms. Any criticisms are not directed towards the authors; it is their job to _distill_ the field.

## 1: Introduction

_In which the authors define rationality (no, IEEE Computing Edge, [books do not qualify as intelligent](https://www.computer.org/csdl/mags/co/2017/05/mco2017050116.html)), provide an overview of related fields, and recount a brief history of AI._

## 2: Intelligent Agents

_In which the authors broadly define agent frameworks, environmental attributes, and the nature of learning._

### Wireheading Cameo

> Notice that we said \[agent performance is graded on\] _environment_ states, not _agent_ states. If we define success in terms of agent's (sic) opinion of its own performance, an agent could achieve perfect rationality simply by deluding itself that its performance was perfect.

Of course, this division only works if there is a [Cartesian boundary](http://lesswrong.com/lw/jlg/bridge_collapse_reductionism_as_engineering/) between that-which-grades and that-which-acts. Which there isn't.

### Charming Philosophical Tangents

> The notion of "clean floor"... is based on average cleanliness over time. Yet the same average cleanliness can be achieved by two different agents, one of which does a mediocre job all the time while the other cleans energetically but takes long breaks... Which is better - a reckless life of highs and lows, or a safe but humdrum existence? Which is better - an economy where everyone lives in moderate poverty, or one in which some live in plenty while others are poor? We leave these questions as an exercise for the diligent reader.

I don't know if I can answer the first question without more information, but assuming a [Rawlsian veil of ignorance](https://en.wikipedia.org/wiki/Veil_of_ignorance) and considering the well-documented logarithmic hedonic effects of wealth, universal moderate poverty would be preferable. I leave the proof as an exercise for the diligent reader (it should be immediate after having read Chapter 16).

## 3: Solving Problems by Searching

_In which the authors teach us to find what we're looking for._

### Admissibility and Consistency

Heuristics are functions which estimate distance to the goal. Let $g(s)$ be the cost to reach $s$ in the current path, let the path cost of reaching state $s'$ from $s$ via action $a$ be $c(s,a,s')$, and let $h$ be a heuristic. The total distance function is then

$$
f(s)=g(s)+h(s).
$$

$h$ is _admissible_ if it never overestimates the distance remaining. Admissibility frees us from needing to exhaustively explore every path (for fear of $h$ having hid a good solution from us through overestimation). The heuristic $h$ is _consistent_ (or, more helpfully, _monotonic_) if it obeys the triangle inequality:

$$
h(s) \leq c(s,a,s')+h(s').
$$

What this means: imagine that we have some admissible heuristic $h_a$ (for example, straight-line distance on a map). An admissible but inconsistent heuristic would then be:

$$
h_a'(s) = \textit{hash}(s) \text{ mod } h_a(s).
$$

$h_a'$ is clearly admissible, but also inconsistent - every $h_a'(s)$ evaluation is some pseudo-random number between 0 and the true distance to the goal!

> [!math] Claim: All consistent heuristics are admissible.
>
> _Proof._ Let $n_k$ denote a state $k$ actions from the goal, and let $d $ be the true distance function.
>
> **Base case** ( $n_1$):
>
> $$
> \begin{align*}
> h(n_1) &\leq c(n_1,a,n_0) + h(n_0) \qquad\text{ consistency}\\
> &\leq c(n_1,a,n_0) \qquad\qquad\;\;\;\;\;\,\text{ definition of a heuristic}\\
> &= d(n_1)\qquad\qquad\qquad\quad\;\;\;\;\text{definition of distance}
> \end{align*}
> $$
>
> **Induction step** ( $n_k \Rightarrow n_{k+1}$):
>
> The inductive hypothesis is that $h(n_{k}) \leq d(n_k)$. Then
>
> $$
> \begin{align*}
> h(n_{k+1}) &\leq c(n_{k+1}, a, n_k) + h(n_k) \qquad\text{ consistency}\\
> &\leq c(n_{k+1}, a, n_k) + d(n_k) \qquad\text{ inductive hypothesis}\\
> &= d(n_{k+1}) \qquad\qquad\qquad\quad\;\;\;\text{ definition of distance}. \\
> \end{align*}
> $$
>
> ∎

### Relaxation

Problem relaxation is a great way of finding admissible heuristics, and it's also a great way of approaching problems. Making potentially unrealistic assumptions about your problem allows you to more freely explore the solution space: real-life examples include [Shannon's formulation of a perfect chess algorithm in 1950](https://en.wikipedia.org/wiki/Claude_Shannon#Shannon's_computer_chess_program), the [formalization of idealized induction in Solomonoff Induction](https://www.lesswrong.com/posts/Kyc5dFDzBg4WccrbK/an-intuitive-explanation-of-solomonoff-induction) (can you induce who formalized it?), and [Hutter's formulation of a perfectly rational AGI in 2000](https://en.wikipedia.org/wiki/AIXI). [^2]

## 4: Beyond Classical Search

_In which the authors introduce ways to search using local information._

### And-Or

Applying And-Or search can seem tricky, but it's really not. When an agent is operating under _partial observability_ (it isn't sure about the exact state of the world), it maintains a _belief state_ (in this chapter, the set of all states the agent could be in). To be sure it will be in the goal state after following its plan, we whip out And-Or search: **for each** state we could be in now (∧), we need to find **at least one** solution ( $\lor$).

Sometimes the environment is _nondeterministic_ (actions have uncertain effects). In this case, we use And-Or search to construct a _contingency plan_, which consists of a series of if-then-else statements. Here, we control our actions, but not their effects; we will then find **at least one** action ( $\lor$) such that we have a solution **for each** potential outcome ( $\land$). Think of this as min-maxing against an adversarial world.

## 5: Adversarial Search

_In which the authors demonstrate how to search when the world really **is** out to get you._

### Pruning

I won't babble about $\alpha\beta$\-pruning - just [practice](http://inst.eecs.berkeley.edu/~cs61b/fa14/ta-materials/apps/ab_tree_practice/). For me, it was deceptively intuitive - I "got it" so "easily" that I neglected to follow the actual algorithm in a practice problem.

### Patchwork Progress

I don't think it's a good idea to spend substantial time on quick fixes which slightly improve performance but don't scale in the limit. Elegant algorithms are often superior for reasons exceeding their aesthetic appeal.

Two examples of objectively good but non-scalable fixes:

**Quiescence search**
: Sometimes, we have to stop evaluating a plan before the game is done; this can leave us in a deceptively good-looking state. Say I move my queen diagonal to your pawn and then I have to stop searching. A simple material evaluation function wouldn't see that the queen is about to get obliterated, so it returns a neutral score. Quiescence search considers the "stability" of a position and searches until it gets to quiescent states, providing a partial workaround for this problem. The search is constrained to certain types of moves.

**Singular extension**
: We try historically good moves when we reach the search's depth limit as a final attempt to expand the search tree a bit further.

Likewise, in deep learning, numerous engineering tricks manage to slightly improve clas​sification accuracy. I agree that it's good to spend some effort on improving existing methods, but wouldn't it be better for more researchers to study the fundamentals and invent new approaches?

![](https://assets.turntrout.com/static/images/posts/Nwg4Zug.avif)

## 6: Constraint Satisfaction Problems

_In which the authors show us how to color maps real pretty._

### Solving $n$\-ary CSPs

> [!math] Definition: Constraint satisfaction problem
>
> $X$ is a set of variables, $\{X_1, \:..., \:X_n\}$.
>
> $D$ is a set of domains, $\{D_1,\: ..., \:D_n\}$.
>
> $C$ is a set of constraints that specify allowable combinations of variables.

Sounds intimidating, but it's really not. Let's say you have two variables: $\{X_1, X_2\}$. Each can be colored `red` or `blue`, so $D=\{\{red,blue\},\{red,blue\}\}$. Pretend that each variable is a vertex and that they're connected by an edge; we want to 2-color this graph. Then $C=\{X_1 \not = X_2\}$.

This gets tricky when we need to solve $n$\-ary CSPs, which are those CSPs whose maximum constraint arity is $n$. Assume that the domains are discrete.

The main idea is that we want to break up these thick $^c$ constraints into mega-variables whose domains are exhaustive tuple enumerations of ways to satisfy the constraint. Then we just need to make sure that our chosen mega-solutions line up with the other mega- and normal variable assignments.

For each constraint $C_k$ with variables $S_k$ ( $|S_k|>2$), make a new variable $y_k$ with domain

$$
D_{k}'=\{x\in \prod_{D_j\in Domains(S_k)} D_j : x \text{ satisfies }C_k\}.
$$

In logical terms, $D_k'$ is the set of all models for $C_k$. For each new variable, instantiate binary constraints on the identities of the values of the shared variables.

_Arc consistency_ can be viewed in a similar light; a variable $X_i$ is arc-consistent with another variable $X_j$ if for each value in $D_i$, there exists at least once satisfactory assignment in $D_j$ for any binary constraints between $X_i,X_j$. That is, every value in $D_i$ is part of at least one model.

## 7: Logical Agents

_In which the authors invent a formal language called "propositional logic" as a pretext for introducing us to the richest fantasy realm ever imagined: the Wumpus world._

### Impish Implications

This chapter was my first time formally learning propositional logic. One thing that confused me at first: for two propositions $\alpha,\beta$, $\alpha \Rightarrow \beta$ is `true` as long as it isn't the case that $\{\alpha=true,\beta=\textit{false}\}$ in some model of our knowledge base. This means that even if $\alpha$ is _total bogus_, the implication holds.

Consider "If I live in Far Far Away, then P=NP"; $\alpha=\textit{false}$ since I am unfortunately unable to live in that fantasy universe, and $\beta$ can be either `true` or `false` —it doesn't matter here. That strange implication is logically `true` because _in the case where the premise is false, I make no claim about the conclusion_.

This principle is covered in the book, but it's important to internalize this early.

## 8: First-Order Logic

_In which the authors generalize their newly minted "propositional logic"._

## 9: Inference in First-Order Logic

_In which the authors incrementally introduce inference for first-order logic._

### Logic Made-To-Order

When converting to conjunctive normal form, follow the steps in order. Yes, I know you _can't wait_ to Skolemize, but tame your baser instincts and move your negations inwards like a good rationalist.

## 10: Classical Planning

_In which the authors present classical planning, the child of first-order logic and search._

> Consider the noble task of buying a copy of _AI: A Modern Approach_ from an online bookseller...

## 11: Planning and Acting in the Real World

_In which the authors introduce hierarchical planning, for use in environments such the "real world" (which putatively exists)._

## 12: Knowledge Representation

_In which the authors discuss efforts to engineer ontologies and introduce modal and non-monotonic logics._

To be frank, I didn't like the ontology-engineering portion of this chapter.

> An obvious question: do all these \[special-purpose\] ontologies converge on a general-purpose ontology? After centuries of philosophical and computational investigation, the answer is "Maybe".

It's possible that well-constructed ontologies are useful abstractions for agents not running on hypercomputers. However, the idea that a team of humans could engineer _one ontology to rule them all_ which would produce robustly intelligent behavior is absurd (I'm looking at the OpenMind project in particular). Set-membership ontologies consistent with reality are piecewise-linear to a nearly infinite degree, a jagged collection of edge cases and situational-truths (see: [37 Ways that Words Can Be Wrong](https://www.lesswrong.com/posts/FaJaCgqBKphrDzDSj/37-ways-that-words-can-be-wrong)).

## 13: Quantifying Uncertainty

_In which the authors share a sampling of the fruits picked by Bayes and Kolmogorov, introducing the foundations of Probability Theory: prior and conditional probabilities, absolute and conditional independence, and Bayes' rule._

## 14: Probabilistic Reasoning

_In which the authors shift their unhealthy obsession from cavities to burglaries; Bayesian networks are introduced, Markov blankets are furnished free of charge, and complimentary Monte Carlo algorithm samples are provided._

### Gibbs Sampling

As a member of the Markov chain Monte Carlo algorithm family, Gibbs sampling starts from a random variable assignment (consistent with observed evidence $\textbf{e}$) and stochastically makes tweaks. The idea is to approximate the posterior distribution for whatever variable in which we are interested (the query variable).

Although the book explains this process clearly on a conceptual level, I had trouble generating the actual state transition probabilities $q(\textbf{x}\to\textbf{x}')$. Wikipedia offers [more detail](https://en.wikipedia.org/wiki/Gibbs_sampling#Implementation) on the implementation than the book. It's simpler than it seems! Remember that each variable transition is governed by $P(x_i|Mb(X_i))$.

## 15: Probabilistic Reasoning over Time

_In which the authors detail the fundamental functions of inference in temporal models and explain approaches such as hidden Markov models, the Viterbi algorithm, and particle filtering._

## 16: Making Simple Decisions

_In which the authors introduce Probability Theory's lovely wife, Mrs. Utility Theory, and their child, Decision Theory._

Much of this chapter was familiar ground, but I found one concept counterintuitive: the non-negativity of the value of perfect information (i.e. gaining information cannot decrease your expected utility). Colloquially, the value of perfect information is how much we expect to be able to improve our plans given the information. Formally,

$$
\textit{VPI}_\textbf{e}(E_j) = \left( \sum_{k} P(E_j=e_{jk} | \textbf{e})\:EU(\alpha_{e_{jk}}|\textbf{e},E_j=e_{jk})\right) - EU(\alpha|\textbf{e}),
$$

where $EU(\alpha|\textbf{e})$ is the expected utility of the best action $\alpha$ given the evidence $\textbf{e}$, and $E_j$ is the random variable we just learned about.

My confusion was as follows: "suppose I believe I'm going to win a million-dollar lottery with $70\%$ certainty, but then I get new information that I'm going to lose. Didn't my expectation decrease, no matter what action I take?". This misunderstands the `VPI` equation: we estimate the value of the information as a function of our _current_ likelihood estimates $P(E_j=e_{jk} | \textbf{e})$.

Let's [shut up and multiply](https://lesswrong.com/tag/shut_up_and_multiply). Fix $P(W)=.7$, $U(W)=1{,}000{,}000$, and $U(\lnot W)=-1$. [^3] Then our actions are $\{buy,abstain\}$. Under my current beliefs, buying a ticket is superior to abstaining ( $EU(abstain)=0$):

$$
\begin{align*}
EU(buy) &= P(W|buy) U(W) + P(\lnot W|buy) U(\lnot W)\\
&= .7×1{,}000{,}000 + .3×-1\\
&= 699{,}999.7
\end{align*}
$$

Suddenly, a knowably friendly oracle pops into existence and gives me the opportunity to ask one question. Being a genius, I use this question to ask _whether I will win the lottery with the next ticket I buy_. Freeze frame! Let's use the `VPI` equation to calculate how much this information is worth to me, _before_ I receive it and under my _current_ beliefs.

$$
\begin{align*}
\textit{VPI}(W) &= \left(P(W)\:EU(\alpha_{W=t}|W=t) + P(\lnot W)\:EU(\alpha_{W=\textit{f}}|W=\textit{f}\:)\right) - EU(\alpha)\\
&= (.7×1{,}000{,}000 + .3×0) - 699{,}999.7\\
&= .3
\end{align*}
$$

This advice was worth $.3$ utility; that is, if I knew before my purchase whether the ticket will win, $30\%$ of the time I'd be able to avoid losing a dollar.

## 17: Making Complex Decisions

_In which the authors show us how to make decisions in those Nashty limited-information environments._

### POMDPs

Partially observable Markov decision processes model environments in which the agent can only see part of the state. Therefore, the agent performs state estimation by maintaining a probability distribution over possible physical states. It is often the case that the agent is never _quite_ sure of having reached its goal; in these situations, the agent will continue to take actions to increase its belief that it has done so.

Analogously: the [satisficer / maximizer dichotomy](https://www.lesswrong.com/posts/2qCxguXuZERZNKcNi/satisficers-want-to-become-maximisers) (or the _de facto_ lack thereof).

## 18: Learning from Examples

_In which the authors introduce entropy and the supervised learning techniques of yore (that is, less than a decade ago)._

> \[Here\], we have the simplest method of all, known informally as "connect-the-dots", and superciliously as "piecewise-linear non-parametric regression".

### Bayes-Structure

In supervised learning, we grade hypotheses by their likelihood given the data:

$$

h^*=\argmax_{h\in\mathcal{H}}{P(h|data)}.
$$

We apply Bayes' rule to get

$$

h^*=\argmax_{h\in\mathcal{H}}{P(data|h) P(h)},
$$

decomposing it into a product of goodness of fit and complexity.

$$
\textbf{꙳click꙳}
$$

## 19: Knowledge in Learning

_In which the authors explore inductive learning, define version spaces, and introduce approaches for learning using background [knowledge](http://knowyourmeme.com/memes/here-in-my-garage)._

## 20: Learning Probabilistic Models

_In which the authors introduce an assortment of acronymic algorithms and approaches, including MAP (maximum a posteriori), MLE (maximum likelihood estimation), and EM (expectation maximization)._

## 21: Reinforcement Learning

_In which the authors detail agents which learn from environmental feedback._

<!-- vale off -->
> It might in fact be better to learn a very simple function approximator and combine it with a certain amount of look-ahead search.
<!-- vale on -->

[Prescient](https://deepmind.com/research/alphago/).

## 22: Natural Language Processing

_In which the authors outline traditional approaches to text classification, information retrieval, question answering, and information extraction._

> With character models, we didn't have to worry about someone inventing a new letter of the alphabet \[with the possible exception of [the groundbreaking work of T. Geisel (1955)](https://en.wikipedia.org/wiki/On_Beyond_Zebra!)\].

## 23: Natural Language for Communication

_In which the authors outline logical and probabilistic techniques for natural language processing._

### Avoiding Confusion

Let's revisit the point I made in Ch. 5 and discuss how easy it is to avoid confusion by optimizing based on what you know how to do _now_ - this seems to be a common and serious failure mode. Half of this chapter is about efforts to contort English to fit inside hard-and-fast syntactic and semantic rules (which are either provided or learned).

Imagine that your research involves explaining and predicting the shape taken by water in various situations. You decide to define a probability distribution over "shapes that water can take" and a transition model for "how the shapes change over time". You might start with easy examples (such as vase- and bucket-"shaped" water), leaving the hard problems (like ocean- and water vapor-"shaped" water) to future researchers. You "solve" the easy cases and get a little more ambitious.

With the help of a team of professional fluidicians, you enumerate "common-sense" rules such as:

> In simplified systems consisting of raindrops and the ground, the shape of each discrete body of water can be represented by a conditional multivariate Gaussian, where the distribution is conditional on whether it has struck the ground yet.

You set up high-FPS cameras in storms and collect video data for millions of raindrop-impact events. You're even able to avoid manual processing via MTurk by employing the latest advances in deep learning! You use [segmentation](https://assets.turntrout.com/static/images/posts/6-pydata-warsaw-deep-learning-for-image-segmentation-10-638.avif?cb=1475242683) to automatically isolate raindrop pixels and a pretrained recurrent network to detect the frame of impact, allowing for easy classification of all other frames as $\textit{pre-impact}$ or $\textit{post-impact}$. Since you read Ch. 20, you know you can use maximum-likelihood estimation to learn the parameters for your conditional multivariate Gaussian using your newly labeled water shapes.

However, what if a raindrop strikes a sharp corner, splaying the drop's water in many directions? Obviously, you just need another edge case - a `StruckSharpCorner` condition in the Gaussian. For that, you go to gather more data...

Or you could derive fluid dynamics. [^4]

## 24: Perception

_In which the authors illuminate low-level details of our visual system and outline how these insights have been applied to computer vision tasks._

## 25: Robotics

_In which the authors combine myriad methods from their opus to tackle the difficult problem of robotic control._

### Holonomy

"Holonomic" and "non-holonomic" were words I never knew I wanted so badly (similar to "ontology" and "epistemology").

Technically, a robot is holonomic if

$$
|\text{effective degrees of freedom}|=|\text{controllable degrees of freedom}|.
$$

Imagine you're driving a car on a Cartesian plane. Your car can reach any $(x,y)$ point and end up in any orientation $\theta$ you so choose, giving it three effective degrees of freedom (even though you can only turn and drive forwards / backwards). Cars are then non-holonomic, since $3\not=2$ (the proof of which is left as an exercise to the dedicated reader). A car which could also move _sideways_ would be holonomic.

### Alignment, Solved

I bring ye good tidings! Russell and Norvig introduce a full solution to the control problem: the alignment method.

> The object is represented by $M$ features or distinguished points $m_1,\,m_2,\,...,\,m_M$ in three-dimensional space...

Oh.

## 26: Philosophical Foundations

_In which the authors consider a range of ethical and philosophical quandries in AI._

### Underestimating Books in the Chinese Room

> The rule book and the stacks of paper, being just pieces of paper, do not understand Chinese.

John Searle obviously doesn't read [IEEE Computing Edge](https://www.computer.org/csdl/mags/co/2017/05/mco2017050116.html).

### No Universal Arguments

> One can hope that a robot that is smart enough to figure out how to terminate the human race is also smart enough to figure out that that was not the intended utility function.

Why would it care?

## 27: AI: The Present and Future

_In which the authors introduce one last concept, asymptotic bounded optimality, and look forward to the great tasks ahead._

<center>“We can see only a short distance ahead, but we can see that much remains to be done.” - Alan Turing
</center>

## Final Thoughts

The authors wield light-hearted prose regularly and to great effect; I often found myself chuckling heartily. Although the pages are packed and the book is big, fear not: if you pay attention and become invested in the task at hand, reading _AI: AMA_ constitutes quite the enjoyable journey.

This seems like a good book to read early on in the [MIRI reading list](https://intelligence.org/research-guide/).

### Tips

- Do exercises immediately after each section in the chapter.
  - I randomly chose ~7 exercises per chapter (excluding the programming problems), only skipping exercises which looked trivial or not relevant.
- Chegg was the only reputable place I could find with an answer key, although the answers were often of low quality. I'd recommend just using StackExchange.
- Feel free to skip exercises for the following chapters: 1, 11, 12, 19, and 22-27.

# Forwards

## Meta

### Writing

For the first half of the book, I didn't write each chapter's commentary immediately after reading. This was a mistake. Skimming half of a thousand-page book to remember what I got stuck on is **not** my idea of a good time.

### Conceptual Issues

**Proofs** remain inordinately difficult for me, although I have noticed a small improvement. To do MIRI-relevant math, proofs will need to become second nature. Depending on how I feel as I progress through my next book (which will likely be a proof-centric linear algebra tome), I'll start trying different supplemental approaches for improving my proof prowess.

I have resolved that by the completion of my next book review, proofs will be one of my strong suits.

**Theoretical machine learning** is another area in which I still notice pangs of confusion. I didn't stop to work on this too much, as I plan to revisit formal machine learning after developing more mathematical sophistication. I'm comfortable with deep learning and its broad-strokes conceptual backdrop, but I don't like not having my gears-level comprehension in order.

### Study Group

If you're interested in working through this book (or other books on the reading list) with me or others, there is a MIRIx Discord run by `Diffractor`. For an invite link, feel free to message [me](https://www.lesswrong.com/users/turntrout)!

## Subjective

### Anticipation

I'll admit it: while reading, there were many times when my heart began to race. I was thrilled, realizing that I was _finally going to learn_ a concept about which I had been curious for oh-so-long. For example, I had worked with the expectation maximization algorithm early in my undergraduate years; at the time, it was a Sophisticated-Person Concept, well beyond my reach.

And then I learned the concept, just like a normal person. It wasn't even particularly hard.

### Benefits

I've noticed that learning this content has not only advanced me towards my MIRI-centric goals, but also improved my ability to excel in both my classes and my research (which is on computer-aided molecule generation). I suspect this trend will continue.

As I've worked to increase my scholarship and understanding of the (computational) world, I've become more and more aware of exactly how much I do not know. This excites me. I can't wait to learn Information Theory, Statistics, and Topology, to name a few.

I feel a bit like a kid in a candy shop.

### On "Difficulty"

I am convinced that _there are no hard concepts_, only concepts which take different amounts of time to learn. [^5] This is not trivial; dissolving the seemingly ontologically basic "difficult for me" attribute goes a long way towards having the persistence to figure things out.

> _Given enough time, I can understand anything._

<hr/>

[^1]: From personal experience, I don't recommend using this technique liberally; it's already hard enough to correct our epistemologies.
[^2]: Disclaimer: even setting aside the need for a hypercomputer, AIXI has issues (such as not being [naturalized](http://lesswrong.com/lw/jd9/building_phenomenological_bridges/)). This isn't the droid you're looking for.
[^3]: Assume utility scales linearly with money for simplicity; for similar reasons, I'm blending evidence and state variables. Shame on me!
[^4]: [Artificial Addition](https://www.lesswrong.com/posts/YhgjmCxcQXixStWMC/artificial-addition) talks about this confusion avoidance.
[^5]: Wording credited to `Diffractor`.
