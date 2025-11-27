---
title: A simple explanation of AGI risk
permalink: agi-risk-introduction
no_dropcap: false
tags:
  - AI
  - grinnell
  - talk-notes
description: Could human-designed AI kill all humans? I spent my PhD on this and still
  worry.
authors: Alex Turner
hideSubscriptionLinks: false
card_image: https://assets.turntrout.com/static/images/card_images/grinnell.png
aliases:
  - reunion-talk
  - talk-agi
  - intro-agi-risk
date_published: 2025-06-29 16:49:07.944742
date_updated: 2025-08-19 20:19:47.849267
---



> [!info] Notes from a talk originally given at my alma mater
> I went to [Grinnell College](https://grinnell.edu) for my undergraduate degree. For the 2025 reunion event, I agreed to speak on a panel about AI. I like the talk I gave because I think it's a good "101" intro to AI risk, aimed at educated laypeople.

I work at Google DeepMind [on the science of aligning artificial intelligence with human interests](/research). I [completed a PhD in this field in 2022](/alignment-phd) and then I did my postdoc at UC Berkeley. I’ll discuss some of the ways in which AI might go wrong.

> [!warning] I'm only speaking for myself, not for my employer.

# The romance and peril of AI

![[https://assets.turntrout.com/static/images/posts/grinnell-talk-20250624223204.avif|Author Alex Turner sits on a panel at Grinnell College. A screen behind him reads "Grinnell College REUNION 2025" and "AI in our Midst".]]{.float-right}

For many years, I’ve had quite the romantic vision of the promise of AI. Solving artificial intelligence will allow automating science itself. Consider the promise of compressing centuries of human research into months, and saving billions of lives by eliminating most disease with an infinite army of digital scientists. (That's the dream, at least. Not clear how practical it is.)

Reality is more cynical and less pretty. Strongmen rejoice at AI's potential for perfect, total spying. And the machines themselves need not share our humanistic vision and may instead have their own goals. They might do whatever it takes to achieve those goals, with or without us. In other words, our own machines, designed by human hands, might kill the entire human race.

My journey into this field began after Grinnell. I was fascinated by the idea of _artificial general intelligence_, or "AGI" – a machine that could do more than play simple games – a machine that could play the “game of life.” Back then, with no ChatGPT, few computer scientists seriously discussed AGI. I was scandalized by their _unserious_ attitudes towards such an important technology. Even my first PhD advisor was dismissive, claiming AGI was centuries away. His skepticism only fueled my research, which eventually led to my work at UC Berkeley and Google DeepMind. Since he was _obviously wrong_, I got a new advisor.

# Risks from AI

1. **Automation.** One of the first risks to touch us - the anxiety about whether our careers and skillsets will even mean anything.

2. **Terrorism.** Imagine millions of world-class hackers targeting critical infrastructure.

3. **People using AI to gain power.**

4. **AI extinction event due to rogue AI.** I spent my PhD thinking about this one. Sadly, this is a real risk.

I'll focus on two topics:

1. A potential “intelligence explosion”, and
2. Human extinction by rogue AI.

The "intelligence explosion" idea is simple. If an AI can do AI research, then it can research how to make itself smarter. Then it becomes smarter, at which point it can do research faster and better, again unlocking even more intelligence. We end up with a system vastly different than anything we designed or imagined. If the process keeps going well beyond human-level intelligence, the resulting machine would be an _artificial superintelligence_ (or "ASI").

# Spelling out an argument for AI extinction risk

PROPOSITIONS

1. The AI is an ASI because it is way smarter than the smartest person ever. ("Smart" in the sense of "able to effectively complete difficult and novel tasks.")

2. The ASI has goals.

3. The ASI's goals conflict with human goals.

4. A sufficiently brilliant and skilled entity can exploit vulnerabilities in society to gain massive influence.

5. An AI with different goals is competing with us. The AI best achieves those goals by stopping humans from getting in the way.

CONCLUSION

: The ASI attempts to gain massive influence and succeeds, possibly killing us.

## Intuitive support for the argument

Suppose a person directed an ASI to increase their power, social esteem, and other goals over which humans often ruin each other. Given that instruction, the ASI probably would succeed due to its extreme intelligence advantage.

An AI is stored digitally, and so it can be copied and then run in parallel (unlike humans). The AIs might also think faster. In fact, modern chatbots type much faster than humans can read - sometimes hundreds of words per second! The chatbot isn’t just “typing quickly” – it has to decide what to say and so it really is “thinking” that fast!

So imagine a machine that instantly sees connections you would never realize after decades of thought, and _also_ can think faster than you about a thousand topics all at once. Imagine if Einstein could think through a physics problem in seconds rather than months, and you could have a thousand copies of him working on different aspects.

So if I look at that possibility - which sounds extreme but is quite permitted by what we know about AI… If I ask myself "might this machine upend the global balance of power?", the answer is "YES." Especially if the AI falls into the wrong hands. Given the overabundance of - and this is a technical term - "sociopathic blowhards" in positions of power, I think AI-enabled power grabs are a real possibility.

Set aside the blowhards. What if the ASI doesn't even follow our instructions? What if it has its own goals, like "gain resources and don't let anyone shut you off"? The AI's interests would conflict with ours. While the ASI need not dislike us, energy spent towards human interests would not be spendable towards its own goals.

Would swarms of ASIs attempt to overthrow human order? My [thesis on avoiding power-seeking by artificial intelligence](https://arxiv.org/abs/2206.11831) attempted to address this exact question. The answer is: “it depends on the way the machine makes decisions.”

Overall, I think there's a good chance an ASI might attempt to wrest power from humans. Of course, the way we design and train these systems could prevent this, or a future with many AIs might create a stable, non-exploitable system.
  
To summarize:
1. AIs doing AI research might form a positive feedback loop where AIs make themselves smarter and thus better at making themselves smarter. An "intelligence explosion."
2. A superhumanly intelligent system might have bad goals and then kill or disempower humanity to stop us from getting in its way.

# So are we doomed?

Subtitle: Maybe, but probably not. But maybe.

If this argument ends up being correct, I think that AI will determine the rest of humanity's future.

My gut feeling is that humanity faces at least a 10% chance of extinction due to AGI. (That’s subjective and not rigorously derived, it’s just my considered feeling.) We live in exciting times, but I’m not horribly pessimistic about artificial intelligence. I don’t think it’s hard, as a question of computer science, to get an AI to prioritize the goals you intended.

So why am I still concerned? You might think: "If these risks are real, surely the smart people building AI systems are working on them, right?"

The answer is yes – and no. Many researchers and companies are genuinely trying to build safe AI. Google DeepMind, where I work, has entire teams dedicated to AI safety. But:

Superintelligent systems don’t exist yet so we can’t experiment on them
: Our safety techniques work today, but will they keep working on truly superintelligent systems? We won’t know until we have those systems. By then, it might be too late to course-correct.

The incentives don't line up
: Companies are racing to build more powerful AI systems, and safety research can take a backseat to research on just making AI smarter.

Totalitarian regimes might use ASI
: And by "might", I mean "_will_, if they possibly can".

Even though people care about the problems, that doesn’t mean the problems go away.

# Conclusion

When I first worried about AGI risk, I felt alone. My first advisor thought the whole idea was dumb. No one else in my program worked in the field. Now, there's lots of attention on AGI risk. Honestly, I wish the AI boom hadn't happened. I wish that AI had stayed slow and quiet, because I think the world was safer that way.

> [!money] Want to do something about the problem?
>
> Consider [donating to fund promising researchers tackling the problem](https://funds.effectivealtruism.org/funds/far-future). (I don't benefit from donations to the linked charity.)
