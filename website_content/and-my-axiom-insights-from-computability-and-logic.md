---
permalink: computability-and-logic-textbook-review
lw-was-draft-post: 'false'
lw-is-af: 'false'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/n8neHaCubKG3HDWhT/and-my-axiom-insights-from-computability-and-logic
lw-is-question: 'false'
lw-posted-at: 2019-01-16T19:48:47.388000Z
lw-last-modification: 2020-05-07T23:08:26.547000Z
lw-curation-date: None
lw-frontpage-date: 2019-01-16T20:01:57.774000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 17
lw-base-score: 42
lw-vote-count: 10
af-base-score: 0
af-num-comments-on-upload: 0
title: And My Axiom! Insights from 'Computability and Logic'
lw-latest-edit: 2020-05-07T23:08:28.107000Z
lw-is-linkpost: 'false'
tags:
  - summaries
aliases:
  - and-my-axiom-insights-from-computability-and-logic
lw-sequence-title: Becoming Stronger
lw-sequence-image-grid: sequencesgrid/fkqj34glr5rquxm6z9sr
lw-sequence-image-banner: sequences/oerqovz6gvmcpq8jbabg
sequence-link: posts#becoming-stronger
prev-post-slug: second-analysis-textbook-review
prev-post-title: "Turning Up the Heat: Insights from Tao's 'Analysis II'"
next-post-slug: managerial-decision-making-review
next-post-title: "Judgment Day: Insights from 'Judgment in Managerial Decision Making'"
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2019-01-16 00:00:00
original_url: 
  https://www.lesswrong.com/posts/n8neHaCubKG3HDWhT/and-my-axiom-insights-from-computability-and-logic
skip_import: true
description: Turing computability and the surprising limits of what formal systems
  can express.
date_updated: 2025-11-22 00:21:52.667251
---









Max Tegmark's _[Our Mathematical Universe](https://www.amazon.com/Our-Mathematical-Universe-Ultimate-Reality/dp/0307599809)_ briefly touches on a captivating, beautiful mystery:

![A diagram connecting "Formal systems," "Mathematical structures," and "Computations" in a triangle. Questions are posed for each: "Decidable?", "Defined?", and "Halting?". Labeled arrows show their interrelationships, such as "are models of" and "describe." A central question mark suggests a single underlying structure.](https://assets.turntrout.com/static/images/posts/math_structure.avif)
Figure: The arrows indicate the close relations between mathematical structures, formal systems and computations. The question mark suggests that these are all aspects of the same transcendent structure whose nature we still haven't fully understood.

The profound results compiled by the _Computability and Logic_ textbook may be the first step towards the answer.

# Computability and Logic

> [!quote]
> If this sentence is true, then Santa Claus is real.

As usual, I'll explain confusions I had and generally share observations. This book is on the [MIRI reading list](https://intelligence.org/research-guide/).

## 1: Enumerability

Coming back to this book, I'm amazed by some of my margin scribbles – expressions of wonderment and awe at what now strike me as little more than obvious facts ("relations are sets of ordered pairs!").

## 2: Diagonalization

> [!quote]**Exercise 2.13** (_Richard's paradox_)
>
> _Question:_ What (if anything) is wrong with following argument?
>
> _Argument:_ The set of all finite strings of symbols from the alphabet, including the space, capital letters, and punctuation marks, is enumerable; and for definiteness let us use the specific enumeration of finite strings based on prime decomposition. Some strings amount to definitions in English of sets of positive integers and others do not; strike out the ones that do not, and we are left with an enumeration of all definitions in English of sets of positive integers, or, replacing each definition by the set it defines, and enumeration of all sets of positive integers that have definitions in English. Since some sets have more than one definition, there will be redundancies. Strike them out to obtain an irredundant enumeration of all sets of positive integers that have definitions in English. Now consider the set of positive integers defined by the condition that a positive integer $n$ belongs to the set if and only if does not belong to the $n$<sup>th</sup> set in the irredundant enumeration just described.
>
> This set does not appear in that enumeration, so it cannot have a definition in English. Yet it does, and in fact we have just given such a definition.

My first time reading this exercise, I had plenty of objections. "Is not abusive to use English in place of a formal system? How do we even quantify the expressiveness of English, is that a thing?", and so on. Yet, returning with more context and experience, a few minutes thought revealed to me the crux: information and enumerability aren't just defined by what is present, but by what's _not_.[^info]

Let's take a little detour. Consider the regular expression $1^*$; its language is infinite, and certainly computable. We don't even need a Turing machine to recognize it; a [strictly less-expressive](https://en.wikipedia.org/wiki/Chomsky_hierarchy) finite state automaton would do just fine. And yet there are infinite subsets of this language which are not at all computable.

Consider some reasonable encoding $\langle M,w \rangle$ of a Turing machine $M$ and input $w$. As we see later, we can enumerate all possible Turing machines and inputs (given that we first fix the alphabet, etc.). This means that we can number the encodings. Consider the halting set; that is, $\{\langle M,w\rangle\,|\,M\text{ halts on input }w\}$. Expressed in unary, the numbers of the encodings belonging to this set is a strict subset of the regular language $1^*$, and yet is not computable (because the halting set is not negatively recursively semi-decidable; i.e. we can't say a computation _won't_ halt. Thus, its complement is not computable).

Do you see the problem now?

[^info]: Here, we should be careful with how we interpret "information". After all, coNP-complete problems are trivially _Cook_ reducible to their NP-complete counterparts (e.g. query the oracle and then negate the output), but many believe that there isn't a corresponding _Karp_ reduction (where we do a polynomial amount of computation before querying the oracle and returning its answer). Since we aren't considering complexity but instead whether it's computable at all, complementation is fine.

## 3: Turing Computability

> Turing's thesis is that any effectively computable function is Turing computable, so that computation in the precise technical sense we have been developing coincides with effective computability in the intuitive sense.

On several occasions, the authors emphasize how the intuitive nature of "effective computability" renders futile any attempt to formalize the thesis. However, I'm rather interested in formalizing intuitive concepts and therefore wondered why this hasn't been attempted. Indeed, it seems that a [recent thesis by Vinogradova](https://ruor.uottawa.ca/bitstream/10393/36354/3/Vinogradova_Polina_2017_thesis.pdf) conducts a category-theoretic formalization of the notion of abstract computability (although since I don't yet know category theory, I can't tell how related it is).

## 4: Uncomputability

## 5: Abacus Computability

## 6: Recursive Functions

> [!quote]
>
> The part where you say “[FLooPs](https://en.wikipedia.org/wiki/BlooP_and_FlooP)” and give up on Turing-complete primitive recursion when the theorems don’t support it.
>
> Preface, _[The Sequents](https://www.readthesequences.com/)_

Nate wrote:

> [!quote]
>
> - Zero: The function that always returns 0.
> - Successor: The function that, given $n$, returns $n+1$.
> - Identity: Functions that return something they are given.
> - Composition: The function that performs function composition.
>
> These four functions are called the "primitive recursive" functions, and some time is spent exploring what they can do. If we allow use of a fifth function:
>
> - Minimization: Given $f$, finds the arguments for which $f$ returns 0.
>
> we get the "recursive" functions.

However, the book defines minimization like so:

$$
\text{Mn}[f](x_1,\ldots,x_n)=\begin{cases}
y&\text{if }f(x_1,\ldots,x_n,y)=0 \text{ and for all }t<y,\\ &f(x_1,\ldots,x_n,t) \text{ is defined and }\neq 0\\
\text{undefined} &\text{if there is no such }y.
\end{cases}
$$

This confused me for days, and I didn't truly understand it until I came back several months later (i.e. now). How in the world is it effectively computable if it isn't even defined on all inputs?

Suppose I challenge you to give me a function that, given a number $x$, returns a larger number. The catch is that you aren't allowed to directly modify $x$ – you can only use it to check whether your candidate solution is bigger. If you just use the bounded search provided by primitive recursion, for some valid inputs your function will be wrong. Without referring to $x$, there's no finite number of exponentiations or tetrations or super-duper-tetrations that you can include which will work for all inputs. You have to be able to do unbounded search – for example, taking the successor until you get a larger number.

Depending on the domain, this isn't always total, either. If we're working with $\mathbb{R}^+$ and I give you $\infty$, you'll increment forever. Similarly, your function won't be defined on input `cat`. The important part is that we've given an effective procedure for finding the solution whenever it exists and for valid inputs.

## 7: Recursive Sets and Relations

## 8: Equivalent Definitions of Computability

Coming to appreciate this bridge between math and computer science was one of my most profound experiences last year. My mind's eye began viewing the world differently. Goings-on came to be characterized not just as interactions of atomic "objects", but as the outgrowth of the evolution of some mathematical structure. As a vast and complex play of sorts, distorted by my mind and approximated in specific ways – some legible, others not.

Most of all, a tugging in the back of my mind intensified, continually reminding me just how ignorant I am about the nature of our world.

## 9: A Précis of First-Order Logic: Syntax

## 10: A Précis of First-Order Logic: Semantics

> [!quote] [Mental Context for Model Theory](https://www.lesswrong.com/posts/MG8Yhsxqu9JY4xRPr/mental-context-for-model-theory)
>
> In fact, if you take Euclid's first four postulates, there are many possible interpretations in which "straight line" takes on a multitude of meanings. This ability to disconnect the _intended_ interpretation from the _available_ interpretations is the bedrock of model theory. Model theory is the study of _all_ interpretations of a theory, not just the ones that the original author intended.
>
> Of course, model theory isn't really about finding surprising new interpretations — it's much more general than that. It's about exploring the breadth of interpretations that a given theory makes available. It's about discerning properties that hold in all possible interpretations of a theory. It's about discovering how well (or poorly) a given theory constrains its interpretations. It's a toolset used to discuss interpretations in general.
>
> At its core, model theory is the study of what a mathematical theory actually says, when you strip the intent from the symbols.

I can't emphasize enough how helpful Nate's _[Mental Context for Model Theory](https://www.lesswrong.com/posts/MG8Yhsxqu9JY4xRPr/mental-context-for-model-theory)_ was; the mental motions behind model theory are a major factor in my excitement for studying more logic.

## 11: The Undecidability of First-Order Logic

## 12: Models

Coming out of linear algebra with an "isomorphism ≟ bijection" confusion, the treatment in this chapter laid the conceptual foundation for my later understanding homomorphisms. That is, a key part of the "meaning" of mathematical objects lies not just in their number, but in how they relate to one another.

This chapter is also great for disassociating baggage we might naïvely assign to words on the page, underlining the role of syntax as pointers to mathematical objects.

## 13: The Existence of Models

## 14: Proofs and Completeness

## 15: Arithmetization

## 16: Representability of Recursive Functions

I confess that upon wading back into the thicket of logical notation and terminology, I found myself lost. I was frustrated at how quickly I'd apparently forgotten everything I'd worked so hard for. After simmering down, I went back through several chapters and found myself rather bored by how easy it was. I hadn't forgotten much at all – not beyond the details, anyways. I don't know whether that counts as "[truly a part of me](https://www.readthesequences.com/Truly-Part-Of-You)", but I don't think it's reasonable to expect myself to memorize everything, especially on the first go.

## 17: Indefinability, Undecidability, Incompleteness

> Perhaps the most important implication of the \[first\] incompleteness theorem is what it says about the notions of _truth_ (in the standard interpretation) and _provability_ (in a formal system): _that they are in no sense the same_.

Indeed, the notion of provability can be subtly different from our mental processes for judging the truth of a proposition; within the confines of a formal system, provability doesn't just tell us about the proposition in question, but also about the characteristics of that system. This _must_ be kept in mind.

> [!quote] E.T. Jaynes, _Probability Theory_
>
> When Godel’s theorem first appeared, with its more general conclusion that a mathematical system may contain certain propositions that are undecidable within that system, it seems to have been a great psychological blow to logicians, who saw it at first as a devastating obstacle to what they were trying to achieve. Yet a moment’s thought shows us that many quite simple questions are undecidable by deductive logic. There are situations in which one can prove that a certain property must exist in a finite set, even though it is impossible to exhibit any member of the set that has that property. For example, two persons are the sole witnesses to an event; they give opposite testimony about it and then both die. Then we know that one of them was lying, but it is impossible to determine which one.
>
> In this example, the undecidability is not an inherent property of the proposition or the event; it signifies only the incompleteness of our own _information_. But this is equally true of abstract mathematical systems; when a proposition is undecidable in such a system, that means only that its axioms do not provide enough information to decide it. But new axioms... might supply the missing information and make the proposition decidable after all.
>
> In the future, as science becomes more and more oriented to thinking in terms of information content, Godel’s results will be seen as more of a platitude than a paradox. Indeed, from our viewpoint "undecidability" merely signifies that a problem is one that calls for _inference_ rather than deduction. Probability theory as extended logic is designed specifically for such problems.

## 18: The Unprovability Of Consistency

## 19: Normal Forms

---

I skipped chapters 20-27, as I found these advanced topics rather boring. The most important was likely provability logic, but I intend to study that separately in the future anyways.

## Final Thoughts

- Nate Soares [already covered this](https://www.lesswrong.com/posts/CvhPTwSMPqNju7hhw/book-review-computability-and-logic); unlike him, I didn't quite find it to be a breeze, although it certainly isn't the hardest material I covered last year.
- I'm surprised the authors didn't include the thematically appropriate [recursion theorem,](https://en.wikipedia.org/wiki/Kleene%27s_recursion_theorem) which states that a Turing machine can use its source code in its own computation without any kind of infinite regress (see: [quines)](<https://en.wikipedia.org/wiki/Quine_(computing)>). This theorem allows particularly elegant proofs of the undecidability of the halting problem, and more generally, of Rice's theorem.

I really liked this book. In the chapters I completed, I did all of the exercises – they seemed to be of appropriate difficulty, and I generally didn't require help.

I've already completed _Understanding Machine Learning_, the first five chapters of _Probability Theory_, and much of two books on confrontational complexity. I'm working through a rather hefty abstract algebra tome and intend to go through two calculus books before an ordinary differential equations text. The latter material is more recreational, as I intend to start learning physics. This project will probably be much slower, but I'm really looking forward to it.

# Forwards

> [!quote] Banach
>
> Good mathematicians see analogies between theorems; great mathematicians see analogies between analogies.

I don't think I'm a great mathematician yet by any means, but as my studies continue, I can't shake a growing sense of structure. I'm trying to broaden my toolbox as much as possible, studying areas of math which had seemed distant and unrelated. Yet the more I learn, the more my mental buckets collapse and merge.

> [!quote] [Twelve virtues of rationality](https://www.lesswrong.com/posts/7ZqGiPHTpiDMwqMN2/twelve-virtues-of-rationality)
> If for many years you practice the techniques and submit yourself to strict constraints, it may be that you will glimpse the center. Then you will see how all techniques are one technique, and you will move correctly without feeling constrained. Musashi wrote: “When you appreciate the power of nature, knowing the rhythm of any situation, you will be able to hit the enemy naturally and strike naturally. All this is the Way of the Void.”

<hr/>
