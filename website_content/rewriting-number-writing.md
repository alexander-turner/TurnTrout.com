---
title: English writes integers backwards
permalink: rethinking-number-writing
no_dropcap: false
tags:
  - critique
  - understanding-the-world
description: 
authors: Alex Turner
hideSubscriptionLinks: false
card_image: 
aliases:
  - backwards-numbers
  - flip-integers
  - flipped-integers
---

We're writing numbers wrong. We write "365" starting with the most significant digit of "3" (hundred). The "biggest number on the left" rule is both algorithmically bad and intuitively clashes with how humans represent numbers in their minds. I propose an innocent and _totally practical_ fix: flip the order and write "↗563" instead of "365." I analyze the implications of this change as they propagate through our language and thought.

# A modest proposal: flip the digit order of integers

If I'm writing "three hundred and sixty-five", "365" becomes "↗563."[^before] Likewise, "21,514" becomes "↗415,12." As you move right (→), the each digit's magnitude goes up (↑). If you're writing an expression with multiple integers, just include it at the beginning: "$50+2$" becomes "$↗05+2$".

If somehow this system were ever adopted, I guess we would need to preface every relevant expression with the up-right arrow. That sucks, but otherwise we couldn't tell if the author was using the old system or the new one.

[^before]: The "↗" character must be present before the number so that the reader knows what to expect.

I have no illusions: this system will not be adopted anytime soon, and for good reason. The switching cost would be large and the benefits minor. If you were going to swap systems, start with [getting the US off of the Imperial system and onto metric](https://en.wikipedia.org/wiki/Metrication_in_the_United_States). And then start using base 12 numbers (["dozenals"](https://en.wikipedia.org/wiki/Duodecimal)) instead of base 10.

Setting aside practicality, the fact remains: English writes its integers backwards.

# Advantages of flipped digit order

## The first digits you receive are informative

Imagine that you're receiving a string of text one character at a time. As you receive each character, your knowledge of the sentence looks like:

1. `I have $`
2. `I have $3`
3. `I have $32`
4. `I have $320`

What comes next? Who knows. Maybe the full sentence is "I have \$320.", or maybe it's "I have \$320,000".  

More importantly, by this point in time, what do we actually know about the number? We know it "begins" with the digits "320". That... doesn't actually tell us much.[^congruence] It has a "3"? Three of _what_, exactly? Is the number big or is it small? Is the number even? Who even knows!

[^congruence]: More formally, if $n$ starts with "320", we know that there exists $k\geq 2$ such that $\lfloor n \div 10^k \rfloor = 3$, $\lfloor n \div 10^{k-1} \rfloor =2$, and $\lfloor n \div 10^{k-2} \rfloor = 0$. Without knowing $k$, we cannot deduce much about $n$'s magnitude (except that $n\geq 320$).

> [!note] Spoken English is better
> A person doesn't say "three two zero", they say "three hundred and twenty." Quickly you are given the information that there are three _hundreds_ - not just three somethings of unknown magnitude.

## Easy long addition, multiplication, and division

Imagine you already have a number in mind (like "1,000") and you want to sum up with the other person's number. If you've received the prefix "I have \$320", you can't start adding the number to 1,000 because you don't know what place the "3", "2", and "0" correspond to. You can't do much at all.

If I write "I have ↗023 dollars", you can perform long addition as you process each digit. The same is true for multiplication and division.

## Both ↗023 and English read left-to-right

In real life, people look at the printed page and see the entire number all at once. Imagine it... you're reading left-to-right, you come across a multiple-digit number (e.g. 521,300), and then _your eyes flick to the right end of the number and begin scanning left_. Err... why are we doing that?!

<p style="text-align:right;">Kinda like having a single paragraph which is aligned to the right. That paragraph isn't impossible to read, but it's out-of-place.</p>

## Interaction with the human visual system

### Mental number line: small on the left, big on the right

In our current system, the "biggest" digit is on the left. That's bad, because we associate _left_ with _smaller_.

> [!quote] [The Mental Representation of Parity and Number Magnitude](https://www.unicog.org/publications/Dehaene_ParitySNARCeffect_JEPGeneral1993.pdf)
> Subtitle: Dehaene, Bossini, and Giraux (1993)
>
> Subjects compared two-digit target numbers to a fixed standard number, 65. For one group of subjects, the larger response was assigned to the right-hand key and the smaller to the left-hand key... the reverse assignment was used for the larger left group... The larger right group responded faster on average than the larger left group.

Our current number system fights our mental number line. The most significant digit is on the _left_ ("3" hundred in "365") and the numbers get "smaller" as you read to the _right_ - but that's intuitively the "bigness" direction! We're so used to this mismatch that we don't notice it anymore.

In contrast, flipped integers are congruent with the mental number line. In "↗563", the value of the components increases from left to right: "5" → "60" → "300". Thus I align the direction of reading, the significance of digits, and the mental number line.

> [!note]- Speculation about why we associate "right" with "big"
> [Dehaene et al. (1993)](https://www.unicog.org/publications/Dehaene_ParitySNARCeffect_JEPGeneral1993.pdf) found that Iranian subjects (who write right-to-left) displayed no or reversed effects.
>
> > [!quote] [The Mental Representation of Parity and Number Magnitude](https://www.unicog.org/publications/Dehaene_ParitySNARCeffect_JEPGeneral1993.pdf)
> > Subtitle: Dehaene, Bossini, and Giraux (1993)
> >
> > The organization of Western writing system has pervasive consequences on the everyday use of numbers. Whenever a series of numbers is written down, small numbers appear first in the sequence; hence, they are located to the left of larger numbers. In this manner a left-to-right organization is imposed on numbers on rulers, calendars, mathematical diagrams, library bookshelves, floor signals above elevator doors, typewriter or computer keyboards, and so on.
> >
> > How does immersion in this left-to-right-oriented environment shape spatial conceptualization of numbers? American children tend to explore sets of objects from left to right, whereas the converse is true of Israeli children... This is likely to become the order in which they normally count a set...

### Does integer flipping demand an extra eye movement?

Humans don't always process numbers a single numeral at a time. Let's consider two cases.

The exact value
: Consider 3,124,203,346 (or ↗643,302,421,3). Suppose we don't just care about the rough magnitude, but about its exact value. In our current system, you have to count the number of digits in a large integer - reading to the right - and then jump back to the beginning of the number in order to read off its exact value. For example, you only know to say "3 billion" because you count the number of digits (or perhaps the number of comma-separated groups). You read to the end and then jump back to read it again - an extra eye movement.

: In contrast, the flipped integer system works perfectly: you start reading on the left and process each digit one at a time. You gain information immediately. The flipped integer system leads to smoother reading.

The rough magnitude
: When reading "320,000", your visual system perceives the entire word at once[^subitize] and you quickly grasp the magnitude of the number. The most significant digit is on the left (e.g. the "3" in "320,000"). These two facts establish the most important information about most numbers: the rough magnitude ("three hundred thousand" in 320,000).

[^subitize]: For non-small numbers - e.g. over five digits in a row or four groups of comma-separated triplets -  many people cannot reliably determine the magnitude at a glance.

: In contrast, when reading ↗000,023, you first land upon the arrow and then the zero. As before, you immediately grasp that this number is in the hundreds of thousands. However, you have to move your eye _again_ over to the right-most digit ("3") in order to know _how many_ hundred thousand. The flipped integer system apparently complicates magnitude estimation.

But let's not just think that thought - let's _keep thinking more thoughts_! We will fix magnitude estimation with another flip.

### Scientific notation should flip as well

If you're writing a number where most readers will only care about the magnitude, then write the number in scientific notation.

The point of scientific notation is to _quickly_ communicate approximate magnitude, only including the digits which are relevant. Consider the standard notation of $5.3 \times 10^5$. You read the first part: "$5.3 \times$". 5.3 _what_? You don't know.

Instead, we should write $10^5 \times 5.3$ in order to communicate the most important information ASAP. (Or technically, $↗01^{5}\times 5.3$.) Note that we violate the "left is smaller" mental number line by putting the big magnitude to the left of a ones-place number. The violation is real but minor.

# Downstream impacts of flipping

## Flipped pronunciation

If you read "↗563", you should not read it aloud as "three hundred and sixty five" - that would require scanning to the end of the flipped integer and then reading backwards. Instead, read aloud "↗563" as "five, sixty, and three hundred" and "↗023" as "twenty and hundred-three."

 > [!idea] Flipping the local ordering of pronunciation
 > If we're truly optimizing, we might as well say "about hundred-four" while we're at it. The prefix "about four" doesn't tell you much until you know "four of _what_"? Whereas "about hundred-" tells you the order of magnitude as soon as possible.

 > [!note]
 > I _do_ think it's silly to have special words like "twenty" instead of "ten-two" and "eighty" instead of "ten-eight", but I won't go there right now. I'm keeping this proposal modest and feasible!

Languages like German use a mixed-order system. German swaps the ones and tens places, so that "365" is spoken as "dreihundertfünfundsechzig" - literally: "three-hundred-five-and-sixty". My modest proposal would make English _more_ consistent than most languages, having the order of magnitude ascend from left to right when written _and_ when read.

## The decimal part doesn't flip

$\pi=3.14159\ldots$ goes on forever. Since the integer part only has a single digit ("3"), the "flipped" $\pi$ is written identically: $\pi=↗3.14159...$.  So let's consider $10\pi = 31.4159...$. The integer part is written "↗13", but that leaves the question of what to do with the decimal part.

I think that we should leave it be. The reason is still informativeness. If we wrote the flipped version as "$...9514.13$", then we still know _nothing_ if all we've read is "$...9$". Our current writing conventions get the decimal part right: in $10\pi=31.4159$, when we read "$31.4$", we understand that the number has four tenths.

One real downside: we lose a symmetry around the decimal point. Currently, each place has an order of magnitude which starts off big and then shrinks to zero and then negative as we keep going past the decimal point.

$$
\begin{align*}
\text{(Currently) }\quad 341.5&=3\times10^2 + 4\times 10^1 + 1\times10^0 + 5 \times 10^{-1} \\
\text{(Flipped) ↗} 143.5 &=1\times10^0+4\times10^1+3\times 10^2 + 5\times10^{-1}
\end{align*}
$$

%%EXCERPT
In real life, often the order of magnitude matters more than the least significant digits (like "5" in "365"). In these situations, you can say "about four hundred."  %%

# Why are the integers written backwards?

At first glance, there's a tempting and obvious culprit. We call the numbers "Arabic numerals", and Arabic is written right-to-left. I can imagine an ancient Arab merchant writing "٣٦٥" ("365"), which reads right-to-left as "five, sixty, and three-hundred." A European, unfamiliar with the reading direction, copied the digits in the same sequence "365" but read them according to their left-to-right convention. Thus spawned our current system.

It's a neat theory. It's a theory I came up with. It's also wrong.[^sad]

[^sad]: Sadly, sometimes I _do_ come up with wrong theories, even though [I'm a theorist at heart](/research).

Reality is not so neat. Although we call them "Arabic numerals", they are more accurately known as "Hindu-Arabic numerals." While mathematicians like the Persian [Al-Khwārizmī](https://en.wikipedia.org/wiki/Al-Khwarizmi) (after whom we coined "algorithm") introduced the system to Europe, the numerals still originated in India.

> [!quote] [Arabic Numerals](https://en.wikipedia.org/wiki/Arabic_numerals#Origin)
> Positional decimal notation was [developed in India](https://en.wikipedia.org/wiki/History_of_the_Hindu%E2%80%93Arabic_numeral_system "History of the Hindu–Arabic numeral system")... The immediate ancestors of the digits now commonly called "Arabic numerals" were introduced to Europe in the 10th century by Arabic speakers of Spain and North Africa.

Ancient Indian scripts like [Brahmi](https://en.wikipedia.org/wiki/Brahmi_script) were written _left-to-right_. Thus dies the "merchant miscommunication" hypothesis. Writing the most significant digit on the left was not a translation error.

By the logic of this proposal, these ancient Indian mathematicians were _already_ "doing it wrong." The Romans independently "did it wrong" as well. In Roman numerals, 1776 is MDCCLXXVI - a sequence of symbols which decrease in value. Thus, Roman numerals also start with the biggest value on the left.

Why? I don't know.

# Conclusion

Ultimately, integer-flipping is a solution to a problem we've long learned to ignore. But now that you've seen it, you can't unsee it. You're welcome.

# Appendix: Endianness in computer science

I've danced around [a classic "holy war"](https://www.rfc-editor.org/ien/ien137.txt) in computer science: should e.g. 32-bit integers start with their least significant or their most significant byte? In some ways, I have replayed parts of this debate - but in the arena of human communication instead of synthetic computation.

Big-endian
: The integer's most significant byte (the "big end") is stored at the lowest memory address. Since we write integers with the "biggest" digit first (the "3" in "365"), English's current system could be called "big-endian."

Little-endian
: The integer's least significant byte (the "little end") is stored at the lowest memory address. My proposal argues for little-endian notation in written English.

To read more about these ideas, see [Understanding Big and Little Endian Byte Order](https://betterexplained.com/articles/understanding-big-and-little-endian-byte-order/).
