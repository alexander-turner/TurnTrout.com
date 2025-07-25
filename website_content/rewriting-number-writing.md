---
title: English writes numbers backwards
permalink: english-numbers-are-backwards
no_dropcap: false
tags:
  - critique
  - understanding-the-world
description: "Why do our eyes scan to the end of a long number, then jump back to the start to read it?! My modest proposal: flip how we write numbers."
authors: Alex Turner
hideSubscriptionLinks: false
card_image: https://assets.turntrout.com/static/images/posts/rewriting-number-writing-20250725084146.avif
aliases:
  - backwards-numbers
  - flip-integers
  - flipped-integers
  - number-proposal
  - rethinking-number-writing
---
We're writing numbers wrong. We write "365" starting with the most significant digit of "3" (hundred). The "biggest number on the left" rule is both algorithmically bad and clashes with how humans intuitively represent numbers in their minds. I propose an innocent and _totally practical_ fix: flip the written order of all numbers, writing "↗563" instead of "365." I analyze the implications of this change as they propagate through our language and thought.

# A modest proposal: flip the digit order

If I'm writing "three hundred and sixty-five", "365" becomes "↗563", with the "↗" character to distinguish from the current system. Likewise, "21,514" becomes "↗415,12." As you move right (→), the each digit's magnitude goes up (↑). If you're writing an expression with multiple numbers, just include it at the beginning (not before every number): "50+2" becomes "↗05+2".

If somehow this system were ever adopted, I guess we would need to preface every relevant expression with the up-right arrow. That sucks, but otherwise we couldn't tell if the author was using the old system or the new one.

I have no illusions: this system will not be adopted anytime soon, and for good reason. The switching cost would be large and the benefits minor. If you were going to swap systems, start with [getting the US off of the Imperial system and onto metric](https://en.wikipedia.org/wiki/Metrication_in_the_United_States). Setting aside practicality, the fact remains: English writes its numbers backwards.

# Advantages of flipped digit order

## Simplifies long addition and multiplication

Imagine you already have a number in mind (like "1,000") and you want to sum up with the other person's number. If you've received the prefix "I have \$320", you can't start adding the number to 1,000 because you don't know what place the "3", "2", and "0" correspond to. You can't do much at all.

If I write "I have ↗023 dollars", you can perform long addition as you process each digit.  Since [the pronunciation](#flipped-pronunciation) of "↗023" is "twenty and three hundred", the primary speed-up to long addition would be in spoken English: adding a medium-length number in real-time as you hear its increasingly large components. You would propagate carries in real time. In the current system, you cannot finalize any high-order digit in the result until all lower-order digits have been processed and their [carries](https://en.wikipedia.org/wiki/Carry_(arithmetic)) accounted for.

Likewise, flipped-number ("little endian") algorithms are slightly more efficient at e.g. long addition.

> [!note]- Endianness in computer science
>
> I'm dancing around [a classic "holy war"](https://www.rfc-editor.org/ien/ien137.txt) in computer science: should 32-bit integers start with their least significant or their most significant byte? In some ways, I have replayed parts of this debate, but in the arena of human communication instead of synthetic computation.
>
> Big-endian
> : The integer's most significant byte (the "big end") is stored at the lowest memory address. Since we write integers with the "biggest" digit first (the "3" in "365"), English's current system could be called "big-endian."
>
> Little-endian
> : The integer's least significant byte (the "little end") is stored at the lowest memory address.  Little-endian implementations are often slightly more efficient. My proposal argues for little-endian notation in written English.
>
> To read more about these ideas, see [Understanding Big and Little Endian Byte Order](https://betterexplained.com/articles/understanding-big-and-little-endian-byte-order/).

## Aligns with the direction of reading

In real life, people look at the printed page and see the entire number all at once. Imagine it... you're reading left-to-right, you come across a long number (e.g. 521,300,421,503), and then _your eyes flick to the right end of the number and begin scanning left_. Err... why are we doing that?!

<p style="text-align:right;">Kinda like having a single paragraph which is aligned to the right. That paragraph isn't impossible to read, but it's out-of-place.</p>
## The first digits you receive are informative
Subtitle: Analyzing reading from the perspective of serial data processing, in which characters are received one at a time.

Imagine that you're receiving a string of text one character at a time. As you receive each character, your knowledge of the sentence looks like:

1. "I have $"
2. "I have $3"
3. "I have $32"
4. "I have $320"

What comes next? Who knows. Maybe the full sentence is "I have \$320.", or maybe it's "I have \$320,000".  

More importantly, by this point in time, what do we actually know about the number? We know it "begins" with the digits "320". That... doesn't actually tell us much.[^congruence] It has a "3"? Three of _what_, exactly? Is the number big or is it small? Is the number even? Who even knows!

[^congruence]: More formally, if $n$ starts with "320", we know that there exists $k\geq 2$ such that $\lfloor n \div 10^k \rfloor = 3$, $\lfloor n \div 10^{k-1} \rfloor =2$, and $\lfloor n \div 10^{k-2} \rfloor = 0$. Without knowing $k$, we cannot deduce much about $n$'s magnitude (except that $n\geq 320$).

Spoken English partially solves this ambiguity. A speaker doesn't say "three two zero", they say "three hundred and twenty." You are quickly given the information that there are three _hundreds_ - not just three somethings of unknown magnitude.

## Better aligns with how humans _actually_ read

### Mental number line: small on the left, big on the right

In our current writing system, the "biggest" digit is on the left. That's bad, because we associate _left_ with _smaller_.

> [!quote] [The Mental Representation of Parity and Number Magnitude](https://www.unicog.org/publications/Dehaene_ParitySNARCeffect_JEPGeneral1993.pdf)
> Subtitle: Dehaene, Bossini, and Giraux (1993)
>
> Subjects compared two-digit target numbers to a fixed standard number, 65. For one group of subjects, the larger response was assigned to the right-hand key and the smaller to the left-hand key... the reverse assignment was used for the larger left group... The larger right group responded faster on average than the larger left group.

Our current number system fights our mental number line. The most significant digit is on the _left_ ("3" hundred in "365") and the numbers get "smaller" as you read to the _right_ - but that's intuitively the "bigness" direction! We're so used to this mismatch that we don't notice it anymore.

In contrast, flipped numbers are internally congruent with the mental number line. In "↗563", the value of the components increases from left to right: "5" -> "60" -> "300". Thus I align the direction of reading, the significance of digits, [the spoken order of components](#flipped-pronunciation), and the mental number line. A children would learn a single unified rule: **bigness is to the right.**

> [!note]- We probably associate "right" with "big" because we read from left to right
> [Dehaene et al. (1993)](https://www.unicog.org/publications/Dehaene_ParitySNARCeffect_JEPGeneral1993.pdf) found that Iranian subjects (who write right-to-left) displayed no or reversed effects.
>
> > [!quote] [The Mental Representation of Parity and Number Magnitude](https://www.unicog.org/publications/Dehaene_ParitySNARCeffect_JEPGeneral1993.pdf)
> > Subtitle: Dehaene, Bossini, and Giraux (1993)
> >
> > The organization of Western writing system has pervasive consequences on the everyday use of numbers. Whenever a series of numbers is written down, small numbers appear first in the sequence; hence, they are located to the left of larger numbers. In this manner a left-to-right organization is imposed on numbers on rulers, calendars, mathematical diagrams, library bookshelves, floor signals above elevator doors, typewriter or computer keyboards, and so on.
> >
> > How does immersion in this left-to-right-oriented environment shape spatial conceptualization of numbers? American children tend to explore sets of objects from left to right, whereas the converse is true of Israeli children... This is likely to become the order in which they normally count a set...

### People would adapt to estimate magnitude at a glance

Humans don't always process numbers a single numeral at a time. Let's consider two cases.

#### The exact value

Consider 3,124,203,346 (or ↗643,302,421,3). Suppose we don't just care about the rough magnitude, but about its exact value. In our current system, you have to count the number of digits in a large number - reading to the right - and then jump back to the beginning of the number in order to read off its exact value. For example, you only know to say "3 billion" because you count the number of digits (or perhaps the number of comma-separated groups). You read to the end and then jump back to read it again - an extra eye movement.

In contrast, the flipped number system works perfectly: you start reading on the left and process each digit one at a time. You gain information immediately. The flipped number system leads to smoother reading.

#### The rough magnitude

When reading "320,000", your visual system perceives the entire word at once[^magnitude] and you quickly grasp the magnitude of the number. The most significant digit is on the left (e.g. the "3" in "320,000"). These two facts establish the most important information about most numbers: the rough magnitude ("three hundred thousand" in 320,000).

In contrast, when reading "↗000,023", you first land upon the "↗" and then the "0". As before, you immediately grasp that this number is in the hundreds of thousands. However, you have to move your eye _again_ over to the right-most digit ("3") in order to know _how many_ hundred thousand. The flipped number system apparently complicates magnitude estimation.

However, on further thought, the situation looks less problematic. Yes, the flipped system complicates magnitude estimation _for folks who grew up with the current system._ But **if you had grown up reading flipped numbers**, might you not adapt seamlessly? In search of magnitude information, would your eyes not be trained to jump from the previous word directly to the "3" at the end of "↗000,023"?

For example, when reading "↗000,000,05", a native reader wouldn't count the zeroes. Their eyes would jump to the right, see the "5", and notice it's in the third group past the decimal. They quickly grasp "fifty million." The commas do the heavy lifting, just as they do right now.

[^magnitude]: For non-small numbers - e.g. over five digits in a row or four groups of comma-separated triplets - I suspect that many people cannot reliably determine the magnitude at a glance.

The strongest argument that magnitude estimation will be harder
: In English, you always read words starting from the left. Therefore, it would be unnatural to follow the rule, "when reading to discover the magnitude of a number, saccade your eyes to the right end of e.g. '↗000,023'". This additional rule adds a small but frequent tension to the reading experience. Even though the reader would often encounter this situation, the additional learned rule would remain slightly burdensome.

Why I think the above argument fails
: The argument claims that a person would not learn to flawlessly switch between the two well-practiced rules: "focus on the left side of normal words" versus "focus on the right side of numbers whose magnitude you want to learn". In other words, that there is an inherent friction in toggling between rule sets.

: Psychology studies _language switching costs_ for bilingual folks. While fluent in each language in isolation and somewhat used to switching, [some studies](https://journals.sagepub.com/doi/abs/10.1177/13670069211056438) support the idea of inevitable friction. But [Adamou & Shen (2017)](https://shs.hal.science/halshs-01522408/file/IJB_Adamou_Shen_2019.pdf) show that for people who practice switching frequently and naturally, this cognitive cost can disappear entirely. The key is to actually measure their speed at switching languages in realistic ways. Their work suggests that only _unpredictable_  switches impose costs.

: In contrast, reading is far less unpredictable than reacting to spoken language. In a book, the "future" is frozen and you can see it with your peripheral vision. You will see that a number is coming later in the sentence, and you will probably know if you're going to want the exact value. These incidents will be predictable and - under this theory - free from switching costs.

The mental number line makes it easier to learn the additional rule
: The mental number line gets bigger to the right. Therefore, we would be quite comfortable learning the rule "look right to determine how big the number is."

### Right-to-left scripts _already_ swap directions for reading numbers

Subtitle: For example: Arabic, Hebrew, and Persian.

While Arabic scripts read right-to-left, surprisingly, they both write numbers in the same order we do, and also _read those numbers in the same order_. So they might write "I have 1,300 dollars" as "السعر 1,300 دولار". They start on the right side of the sentence and smoothly read left, _until_ they hit the number. At that point, they saccade their eyes _to the left side of the number_ and read to the right, and then saccade _back to the word to the left of the number_ and continue reading leftwards.

This rule is strictly more complicated than what flipped numbers require. Flipped numbers only require you skip past a few digits to quickly determine magnitude, but still allow you to smoothly move your eyes in the usual direction to read the exact value of a number. In contrast, the Arabic rule always requires that you skip past the digits, switch directions (to read the number), and then switch directions again to continue reading the text. Even so, hundreds of millions right-to-left readers execute this rule every day. I don't yet see evidence that the Arabic rule makes it harder to read numbers even after the rule is initially learned.[^evidence]

[^evidence]: While I found evidence that Arabic and Hebrew readers take longer to read numbers than equivalently long words, the same appears to be true for English readers.

### Scientific notation should flip as well

If you're writing a number where most readers will only care about the magnitude, then write the number in scientific notation.

The point of scientific notation is to _quickly_ communicate approximate magnitude, only including the digits which are relevant. Consider the standard notation of $5 \times 10^7$. You read the first part: "$5 \times$". 5 _what_? You don't know. Instead, we might write $10^7 \times 5$ in order to communicate the most important information ASAP. (Or technically, ↗$01^{7}\times 5$.)

However, for $10^k$ with $k\geq 1$, this would run counter to the "left is smaller" mental number line by putting the big magnitude to the left of a number in the one's place. We can't win - no matter which way we order the scientific notation, the mental number line will be violated for either $k\geq 1$ or $k \leq -1$. On the other hand, given that readers would be used to looking for the most significant digit on the right, writing $10^7 \times 5$ would be congruent with the more usual way of writing ↗000,000,05. On balance, I think that "$10^7 \times 5$" is the way to go.

# Downstream impacts of flipping

## Flip the decimal part

Let's consider $\pi = 3.14159...$. I propose we write that as ↗...<sup>-5</sup>95141.3, with the "-4" indicating "the first digit has the place of $10^{-5}$."

Benefits:
- Preserves the symmetry of the number line around the decimal point.
- Accords with the mental number line - smaller components on the left, bigger on the right.
- The first digit is still informative.
- Long addition and multiplication are easier as you don't need to revise if you carry later.

The challenge, once again, comes down to magnitude estimation. [As explained earlier](#people-would-adapt-to-estimate-magnitude-at-a-glance), if the reader wants the exact number, they start reading from the left. If the reader wants the rough magnitude, they saccade to the right end of the number and estimate how many digits (or comma-triplets) come after the decimal point. This is what readers currently do, except now the eye lands on the right end of the number instead of the left.

## Flipped pronunciation

If you read "↗563", you should not read it aloud as "three hundred and sixty five" - that would require scanning to the end of the flipped number and then reading backwards. Instead, read aloud "↗563" as "five, sixty, and three hundred" and "↗023" as "twenty and hundred-three."

 > [!idea] Flipping the local ordering of pronunciation
 > If we're truly optimizing, we might as well say "about hundred-four" while we're at it. The prefix "about four" doesn't tell you much until you know "four of _what_"? Whereas "about hundred-" tells you the order of magnitude as soon as possible.

 > [!note]
 > I _do_ think it's silly to have special words like "twenty" instead of "ten-two" and "eighty" instead of "ten-eight", but I won't go there right now. I'm keeping this proposal modest and feasible!

Languages like German and Arabic use a mixed-order system. German swaps the ones and tens places, so that "365" is spoken as "dreihundertfünfundsechzig" - literally: "three-hundred-five-and-sixty". My modest proposal would make English _more_ consistent than most languages, having the order of magnitude ascend from left to right when written and when read.

# Why are the numbers written backwards?

At first glance, there's a tempting and obvious culprit. We call the numbers "Arabic numerals", and Arabic is written right-to-left. I can imagine an ancient Arab merchant writing "٣٦٥" ("365"), which reads right-to-left as "five, sixty, and three-hundred." A European, unfamiliar with the reading direction, copied the digits in the same sequence "365" but read the number according to their left-to-right convention. Thus spawned our current system.

It's a neat theory. It's a theory I came up with. It's also wrong.[^sad]

[^sad]: Sadly, sometimes I _do_ come up with wrong theories, even though [I'm a theorist at heart](/research).

Reality is not so neat. Although we call them "Arabic numerals", they are more accurately known as "Hindu–Arabic numerals." While mathematicians like the Persian [Al-Khwārizmī](https://en.wikipedia.org/wiki/Al-Khwarizmi) (after whom we coined "algorithm") introduced the system to Europe, the numerals still [originated in India](https://en.wikipedia.org/wiki/History_of_the_Hindu%E2%80%93Arabic_numeral_system "History of the Hindu–Arabic numeral system"). The relevant ancient Indian scripts (like [Brahmi](https://en.wikipedia.org/wiki/Brahmi_script)) were written _left-to-right_. Thus dies the "merchant miscommunication" hypothesis. Writing the most significant digit on the left was not a translation error.

> [!question] But why did Arabic (a right-to-left script) keep the left-to-right numbers?
> Despite being a right-to-left script, Arabic forces its readers to _change reading directions entirely_ to read numbers. That initially seems like strong evidence that the Arabs had a strong reason to retain the orientation of the numbers. So what was going on in Al-Khwārizmī's head? I can only speculate, but let's put ourselves in his shoes.
>
> It's the early 9th century in Baghdad, the heart of the [Islamic Golden Age](https://en.wikipedia.org/wiki/Islamic_Golden_Age). Al-Khwārizmī is a brilliant scholar sponsored by the caliph's court.
>
> <figure><img  src="https://assets.turntrout.com/static/images/posts/rewriting-number-writing-20250725084146.avif" alt="A depiction of the House of Wisdom, made in the style of the famous School of Athens painting."/><figcaption>A modern depiction of the House of Wisdom, in the style of Raphael's <a href="https://en.wikipedia.org/wiki/The_School_of_Athens"><em>School of Athens</em></a>. While historians now think the House of Wisdom was less a single grand academy and more a collection of scholarly circles around the caliph's private library, this work captures the spirit of the Islamic Golden Age. Art by <a href="https://www.commde-creativewalk.com/houseofwisdom">Pitchaya Vimonthammawath</a>.</figcaption></figure>
>
> Al-Khwārizmī encounters a revolutionary system of calculation from India. Before, arithmetic was a chore. You might use an abacus. Multiplying or dividing large numbers was complex and error-prone. In contrast, the Indian system was pretty mind-blowing.
>
> 1. In _positional notation_, the value of a digit depends on its position. The "5" in "50" is different from the "5" in "500".
> 2. _A symbol for zero_ allowed for clear distinctions between "5", "50", and "501".
>
> Al-Khwārizmī recognized the system's genius and wrote _On the Calculation with Hindu Numerals_. This book introduced the system to the Arab world and, later, to Europe.
>
> So, why didn't he flip the order to match their right-to-left script? _The direction was part of the technology._ The numerals were not just a new set of fancy symbols to replace familiar ideas. The Hindu numerals were the front-end of a brand-new computational engine. The positional logic was baked into its left-to-right structure: as you move one way, the value of the digit changes by a power of ten.
>
> Al-Khwārizmī likely prioritized quickly integrating a system that made commerce, astronomy, and engineering calculations vastly easier. Flipping the numbers wasn't simply a matter of flipping the written order of the Hindu numerals - he would've needed to re-invent the algorithms which came with those numerals _and_ translate the Indians' existing mathematical work. Left-to-right numbers came in a package deal. After that, it became too hard to coordinate a switch.

Even before the Arabs, these ancient Indian mathematicians were _already_ "doing it wrong" by the logic of this proposal.

Why? I don't know. Probably they had spoken numbers first. To write their numbers, they retained the order in which they spoke numbers. That order happened to be our current rule of "biggest part first" - e.g. "three hundred" in "365". But once established, the switching costs became too high - even when it creates obvious inefficiencies, like Arabic readers changing direction mid-sentence.

# Conclusion

Our number system fights our mental number line and complicates mental arithmetic. Arabic readers already deal with something more annoying than my proposal: they literally switch reading directions mid-sentence for every number. Three hundred million people do this every day without civilization collapsing.

Why did we end up here? I'd guess that Al-Khwārizmī couldn't just flip the Hindu numerals around because the notation was part of the technology. Now we're all trapped by a coordination problem too big to solve. Who's going to convince all English speakers to flip their numbers? No matter how you quantify the switching costs (or write the number representing that cost), that cost is _big_.

Still, understanding brings value. For example, maybe this essay helps explain why kids find positional notation to be difficult ([Fuson, 1990](https://karenfusonmath.net/wp-content/uploads/2023/06/63-Issues-Pl-V-MD-JRME-1990.pdf)). We know that learning two contradictory patterns makes both harder to learn ([McNeil and Alibali, 2005](https://cladlab.nd.edu/assets/250421/mcneilalibali05b.pdf)). Children simultaneously learn "biggest on the left" from the notation but "biggest on the right" from their teacher writing ascending sequences ("1,2,3...") on the blackboard. Maybe someone should take a look at that?

The next time you encounter a long number and have to read to the end to figure out what the first digits even mean, remember that that silly design choice was made thousands of years ago. Our entire civilization agreed to write numbers backwards, and now it's too late to fix it.

You can't unsee it now. You're welcome. ↗😉
