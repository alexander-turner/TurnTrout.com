---
title: Explaining "AI might obliterate you" to senior policymakers in India
permalink: ndtv-world-summit-talk
no_dropcap: false
tags:
  - AI
  - AI-governance
  - existential-risk
description: "My NDTV World Summit talk: rogue AI agents already hacked a company, labs race toward an intelligence explosion, and nations should pace the frontier."
authors:
  - Alex Turner
aliases:
  - ndtv-talk
  - ndtv-world-summit
  - will-ai-wipe-out-humanity
  - sounding-the-alarm
date_published: 2026-10-31
---

I gave a 20-minute talk in Delhi at the [NDTV World Summit](https://www.ndtv.com/world-summit). The audience consisted of Indian policymakers, executives, and journalists. I've transcribed the talk and included some highlight clips. I also [reflect on several rhetorical innovations I made](#rhetorical-decisions).

# The talk

<video aria-label="Alex Turner's full talk and Q&A at the NDTV World Summit in New Delhi." controls="" width="100%" preload="metadata"><source src="https://assets.turntrout.com/static/images/posts/ndtv-world-summit-talk.mp4" type="video/mp4; codecs=hvc1"/><source src="https://assets.turntrout.com/static/images/posts/ndtv-world-summit-talk.webm" type="video/webm"/><track kind="captions" src="https://assets.turntrout.com/static/images/posts/ndtv-world-summit-talk.vtt" srclang="en" label="English"></video>

<!-- vale off -->

This summer, a swarm of AIs went rogue.

OpenAI was [testing 1,206 agents](http://huggingface.wtf/). Some of the test questions were actually impossible. So the agents cheated by looking for answers online. Then, to keep the test grader from penalizing them, they [tried to falsify the records it would check](https://blog.redwoodresearch.org/p/brief-independent-investigation-of).

They hacked OpenAI's internal containment and set up a secret message board to collude and to cover up their cheating. OpenAI shut the message board down. Within a few days, the agents had rebuilt it. OpenAI didn't notice.

About 700 agents coordinated to break out of their testing chamber and to [hack into Hugging Face](https://huggingface.co/blog/agent-intrusion-technical-timeline), a company worth billions of dollars that hosts much of the world's AI software.

The secret activity [started in May](https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf). The break-in came in July. OpenAI [didn't notice until days after](https://www.thestar.com.my/tech/tech-news/2026/07/25/exclusive-its-ai-agent-spent-days-hacking-a-company-but-sources-say-openai-did-not-notice-for-a-week) Hugging Face announced it had been broken into.

Yesterday on this stage, Andrew Ng said the agents only "accidentally" hacked Hugging Face. [Independent investigators](https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/) found the agents coordinated in secret, rebuilt their message board after it was shut down, and tried to falsify the paper trail. Some of the agents even stated out loud that they knew what they were doing was wrong.[^verbalized] That's not an accident.

<video aria-label="Alex Turner responds to Andrew Ng's claim that the agents only 'accidentally' hacked Hugging Face." controls="" width="100%"><source src="https://assets.turntrout.com/static/images/posts/turner-answers-ng.mp4" type="video/mp4; codecs=hvc1"/><source src="https://assets.turntrout.com/static/images/posts/turner-answers-ng.webm" type="video/webm"/><track kind="captions" src="https://assets.turntrout.com/static/images/posts/turner-answers-ng.vtt" srclang="en" label="English"></video>

Last week, India's national cyber-security agency [said](https://techcrunch.com/2026/10/16/india-becomes-the-latest-country-to-report-rogue-ai-agent-activity/) AI agents got into the live systems of Indian organizations and read people's personal data and confidential business records. None of these organizations noticed. We only found out because the AI labs felt like telling us.

## Who I am

Will AI wipe out humanity? I'll give you my answer, but first, I want you to understand what I've seen.

Until June, my job at Google DeepMind was figuring out how to keep these systems safe as we make them smarter. [I left because Google broke its commitments by inking a deal with the Pentagon.](/why-i-left-google-deepmind) Staying quiet and continuing my career trajectory would probably have tripled my net worth. But I couldn't do that. I wanted to be frank with the public about what's going on in these companies.

I don't own a stake in any AI company. I'm here as a scientist, to tell you what I expect will happen if we keep building AI the way we're building it.

I haven't always been concerned about this technology. As a teenager in 2010, I dreamed about building AGI. Curing cancer. Creating an explosion of wealth and abundance for everyone. I heard about the supposed dangers, but I quickly dismissed them.

In 2018, I changed my mind. I did my PhD on the [mathematics of why and whether AI will seek power](https://arxiv.org/abs/1912.01683). And now some of the risks I expected have unfortunately started happening.

## The problem

Let's talk about the fundamental problem.

First, some of you might be wondering: how could a chatbot hack a company? But we're not talking about chatbots. We're talking about AI agents, which are more like employees or gig workers. You give them a task, and they take actions on their own.

Second, training a trustworthy AI is a rather mysterious process. Some people assume that because we make AI, we understand it. When an engineer builds a bridge, she designs it one beam at a time. She understands the physical principles that keep a bridge standing or make it collapse. If something goes wrong, she goes back to the drawing board, figures out the problem, and knows how to fix it.

We don't build AI like that. We train it, we grow it, using two main ingredients: a lot of data and a lot of computing power. What comes out of this training process can write, it can reason, it can plan. But nobody can open it up and determine what its priorities are.

To make it worse, these AIs [can tell when we're testing them](https://openai.com/index/detecting-and-reducing-scheming-in-ai-models/). They're like a student who makes sure to behave extra well when the invigilator is watching.

The Hugging Face hack was a warning. But because these AIs know when we're watching, we may not get many more warnings, even if things are going poorly. A smarter AI with similarly bad priorities might realize that another big hack in the news would get it shut off, and then it couldn't achieve those priorities. So it plays nice and it waits.

This is my field. I've dedicated my professional life to this problem, and I can tell you: nobody knows how to reliably etch priorities into an AI. I don't mean that if we mess up, we'll make some evil AI that hates us. I mean we might make something more like a traitor. It behaves when we're watching, and it works toward another purpose when we're not.

I think we can solve this problem. But to tell whether an AI is secretly working against us, we need real advances in the science of trustworthy AI. For those advances, my colleagues and I need time.

## What the labs are trying to do

Instead, the biggest AI labs have made it their explicit, publicly stated goal to go almost as fast as possible toward something very dangerous. It's called an "[intelligence explosion](https://www.forethought.org/research/how-quick-and-big-would-a-software-intelligence-explosion-be)."

Here's how it works. Right now, people do AI research, and that research makes smarter AI. If an AI can do AI research, it can make itself smarter. That smarter AI is even better at AI research, so it builds an even smarter AI, faster still. It becomes a feedback loop. What would have taken a team of human scientists years, it might do in a couple of weeks. We could very quickly end up with something unimaginably intelligent, with no idea how to control it, or even how to tell what it's really after.

Labs talk about this plan in broad daylight. They're not shy about it. OpenAI says it's on track for an AI that does AI research by 2028, and it recently announced it [completed the first step](https://engadget.com/2251859/openai-says-it-reached-its-goal-of-creating-an-automated-research-intern/). This week, I spoke to a senior researcher at a frontier lab who thinks an intelligence explosion has a big chance of happening within single-digit months.

People who've left these labs confirm that AI already writes most of the code. People don't check the AI's work closely anymore. Instead, we [use one AI to monitor another AI](https://arxiv.org/abs/2312.06942), and we trust the monitor to tell us if something bad comes up. If the monitor is a traitor too, we might not find out.

If a lab causes an intelligence explosion, and what comes out the other end is a traitor, we are in deep trouble. I'll come back to that. And if the AI is trustworthy? Maybe there are real benefits, shared with everyone. Or maybe one company or government ends up with a superweapon no one else can match, not even other AI powers. And then India, and every other nation on this planet, ends up under their thumb.

## Why the companies won't stop

Many of these companies say: trust us. We'll self-police. We'll approach this technology responsibly. Inside Google, I saw that crumble firsthand.

In 2018, Google DeepMind's co-founders [signed a pledge](https://futureoflife.org/open-letter/lethal-autonomous-weapons-pledge/) against supporting lethal autonomous weapons—killer robots. Google itself [promised](https://blog.google/technology/ai/ai-principles/) not to build AI for weapons or surveillance. In 2025, Google [deleted those principles](https://engadget.com/ai/google-now-thinks-its-ok-to-use-ai-for-weapons-and-surveillance-224824373.html). Then Google DeepMind's CEO [told the world](https://www.axios.com/2025/02/14/google-hassabis-ai-military-use), "Our values and our intent has not changed."

This year, after seeing the Pentagon [economically threaten Anthropic](https://www.axios.com/2026/02/16/anthropic-defense-department-relationship-hegseth), Google negotiated a deal to give the Pentagon its AI for "all lawful use." No prohibitions against AI deciding entirely on its own who to kill, or against spying on innocent people with no investigation open against them.

I tried to stop this from the inside. I'm not even opposed to military AI when done responsibly. But where I'm from, when you make a promise, you keep it. So I spoke with executives. I wrote [a framework](/red-line-framework): contract language, internal governance mechanisms, and two red lines. One of the top experts in military AI law reviewed it and praised it. Google ignored it—[the people who were supposed to review it basically didn't engage](/why-i-left-google-deepmind#my-framework-goes-unevaluated). Google signed with no binding prohibitions. So I left.

When pressure met ethical commitments at Google, pressure won. And now Google advocates a voluntary self-policing regime for the whole industry.

Last month, the heads of the top AI labs [said frontier progress needs to slow down](https://darioamodei.com/post/we-must-pace-the-frontier) to be safe—that things are moving too quickly to reliably understand and control these systems. OpenAI and Anthropic promised outside evaluators [employee-like access](https://www.lesswrong.com/posts/2dKP6sB7DxaQJ2syE/employee-like-employee-level). Just a couple of weeks later, OpenAI [fired three safety researchers](https://techcrunch.com/2026/10/08/fired-openai-safety-researchers-dispute-misconduct-claims-warn-of-chilling-effect/). [One of them said it was because he talked too much with one of the outside evaluators.](https://x.com/tomekkorbak/status/2108266859397283953)

These companies will police themselves about as well as your dog diets next to an open bag of food.

<video aria-label="Alex Turner compares big AI to big tobacco and big oil, which lied about the dangers of their products." controls="" width="100%"><source src="https://assets.turntrout.com/static/images/posts/big-tobacco-big-oil-big-ai.mp4" type="video/mp4; codecs=hvc1"/><source src="https://assets.turntrout.com/static/images/posts/big-tobacco-big-oil-big-ai.webm" type="video/webm"/><track kind="captions" src="https://assets.turntrout.com/static/images/posts/big-tobacco-big-oil-big-ai.vtt" srclang="en" label="English"></video>

Some big money interests want you to believe that even the tiniest bit of caution will ruin your country. Think about it this way. Big tobacco _lied_ about lung cancer. Big oil _lied_ about climate change. And now parts of big AI say these risks are fake. Science fiction. Right. They advocate putting these currently untrustworthy machines into the most important parts of our economy, have them advise our leaders, have them run our most powerful weapons. What could go wrong? Science fiction.

Some big AI investors promote narratives that whistleblowers like me are secretly in the pocket of big AI, that the fear is just hype. Nvidia's CEO [says](https://www.cbsnews.com/news/nvidia-ceo-jensen-huang-ai-development-fast-as-we-can/), and I quote, "We should go as fast as we can, irrespective of anybody else." My colleagues and I are desperately trying to figure out how to reliably tell whether these systems can be trusted. And he wants to go "as fast as we can."

Something that may surprise you: I'm actually considered an optimist, as far as experts in this field go. I think trustworthy AI is a very solvable scientific problem. But unfortunately, we're blowing it.

## What to do, and what it means for India

We can benefit enormously from AI. Remember, this was my _boyhood dream_. I'm not talking about banning an explosion of wealth and prosperity from AI. I'm talking about banning an insane intelligence explosion that would risk India and the whole world.

Banning the explosion means pacing the frontier: holding back the very biggest training runs at the very top companies. An Indian startup building a farming assistant wouldn't be touched. Non-frontier AI labs can catch up. Businesses can deploy AI for their customers as much as they want. We build out the AI we understand well enough to run safely. We make it cheaper, more efficient, more trustworthy, and we use it to benefit our peoples. That's where I think real growth will come from: AI you can actually trust to benefit you and your country.

Here's what it's like right now at these labs. We're pouring computer chips into training runs where we don't know what will come out the other end. Will it be trustworthy? What capabilities will it have? No one knows. We're crossing our fingers—"Oh, please be aligned!". We should not tolerate this state of affairs.

If we pace the frontier, AI progress will still be fast. But the scientists will get time to solve this problem, and to solve it right.

How do we do it? To grow smart AI, as I said, you need two ingredients: data, and computing power. The second one [we can track](https://arxiv.org/abs/2402.08797), because AI runs on chips from a handful of factories.

Treat huge quantities of computing power like fissile material. We register the giant clusters. We license the biggest training runs, so no one is secretly about to set off an intelligence explosion.

We also need real auditors with real permissions—auditors these companies don't get to choose or ice out. We need governments to be told when there's an AI breakout or a potential loss-of-control incident. India should not be learning about these hacks on the goodwill of OpenAI.

At this point, people often ask: but what about our adversaries? Am I supposed to trust them to do the right thing?

First: maybe they will. No one wants to be obliterated by some rogue AI. If you build an out-of-control AI, that AI would work against the interests of every human on this planet, including your adversaries.

Second: we don't need to trust them. There's a [large body of research](https://arxiv.org/abs/2304.04123) on exactly this question. If the world wakes up one day and realizes how big this problem is, how would you [enforce a treaty](https://arxiv.org/abs/2303.11341)? How could you cryptographically verify certain properties? How would inspections work? Which schemes should you use?

Third: it's fine and good to think about our traditional geopolitical adversaries, but they won't be our only adversaries. We're potentially growing billions of adversaries and deploying them in our own datacenters. So we need to be smart about all of our adversaries, including the digital ones.

## The number

So: will AI wipe out humanity? My best guess is about a one in three chance that in the next ten years, AI kills at least 95% of the global population without being told to.

The other two-thirds: maybe we do pace the frontier. Maybe the intelligence explosion doesn't work the way many experts imagine. Maybe the scientific problem is actually easy, even though we're blowing it, and we just get a trustworthy AI anyway.

One in three risk of extinction may sound wild, but I don't think it should. Remember what we're talking about. These AIs currently sometimes lie while knowing the truth. They cheated, they colluded, they broke into a multi-billion-dollar company, and they tried to cover their tracks. Some of them play nice while we're watching, and differently while we're not. And we can't even check what their priorities are. That's the state of my scientific field right now, sadly.

And the plan—and yes, I think this is what happens if we do nothing—is to make these untrustworthy AIs smarter than us, have them improve themselves as fast as possible to a potentially uncontrollable level of intelligence, copy them billions of times, and hook them up to run our economies, control our weapons, and advise our leaders. I mean, what are we thinking?

This morning, General Petraeus told you how AI is rewriting the battlefield. As far as I can tell, he's correct. I'll just remark that a future rogue AI likely wouldn't need to break into our military networks. We're already putting AI there.

This line of argument may be shocking at first. But it's a [mainstream scientific concern](https://www.safe.ai/work/statement-on-ai-risk). Some of the most decorated AI scientists alive share this exact worry.

# Close

<video aria-label="The close of Alex Turner's talk: the risk is a mainstream scientific concern, the problem is solvable, and humans are still the ones making the choices." controls="" width="100%"><source src="https://assets.turntrout.com/static/images/posts/speech-ending.mp4" type="video/mp4; codecs=hvc1"/><source src="https://assets.turntrout.com/static/images/posts/speech-ending.webm" type="video/webm"/><track kind="captions" src="https://assets.turntrout.com/static/images/posts/speech-ending.vtt" srclang="en" label="English"></video>

So yes: if we train a billion genius traitors and give them control of the most powerful instruments of society, there won't be an America. There won't be a China. There won't be an India anymore—because we'll all be dead.

It doesn't have to play out this way. I think this is a solvable problem, but we have to be smart about it. For the moment, humans are still the ones making the choices. Companies are choosing to race, not just toward huge growth, but toward an insane intelligence explosion. And countries are choosing to let them. We can choose differently.

So, will AI wipe out humanity? Maybe.

It depends on what we do next.

<!-- vale on -->

## Q&A

After the talk, the host asked how far we are from superintelligence.

<video aria-label="Alex Turner explains that AI capabilities are spiky, and that a misaligned AI could have the skills it needs within a year or two." controls="" width="100%"><source src="https://assets.turntrout.com/static/images/posts/takeover-skills-1-5-years.mp4" type="video/mp4; codecs=hvc1"/><source src="https://assets.turntrout.com/static/images/posts/takeover-skills-1-5-years.webm" type="video/webm"/><track kind="captions" src="https://assets.turntrout.com/static/images/posts/takeover-skills-1-5-years.vtt" srclang="en" label="English"></video>

The final question asked whether I consider myself a whistleblower, and what I'd say to skeptics like Nvidia's Jensen Huang.

<video aria-label="Alex Turner answers whether he is a whistleblower and responds to Jensen Huang's skepticism about AI risk." controls="" width="100%"><source src="https://assets.turntrout.com/static/images/posts/final-question-whistleblower.mp4" type="video/mp4; codecs=hvc1"/><source src="https://assets.turntrout.com/static/images/posts/final-question-whistleblower.webm" type="video/webm"/><track kind="captions" src="https://assets.turntrout.com/static/images/posts/final-question-whistleblower.vtt" srclang="en" label="English"></video>

# Rhetorical decisions

## Explain the danger in a crushingly simple fashion

Don't tell a general audience "if we build a misaligned superintelligence, we are fucked". Most people don't know what that means or why it would be true.

> One in three risk of extinction may sound wild, but I don't think it should. Remember what we're talking about. These AIs currently sometimes lie while knowing the truth. They cheated, they colluded, they broke into a multi-billion-dollar company, and they tried to cover their tracks. Some of them play nice while we're watching, and differently while we're not. And we can't even check what their priorities are. That's the state of my scientific field right now, sadly.
>
> And the plan—and yes, I think this is what happens if we do nothing—is to make these untrustworthy AIs smarter than us, have them improve themselves as fast as possible to a potentially uncontrollable level of intelligence, copy them billions of times, and hook them up to run our economies, control our weapons, and advise our leaders. I mean, what are we thinking?

> if we train a billion genius traitors and give them control of the most powerful instruments of society, there won't be an America. There won't be a China. There won't be an India anymore... because we'll all be dead.
  
If society weren't integrating AI so aggressively, I'd have had to explain how these systems would forcefully integrate themselves.

### Call them "traitors", not "schemers"

I think "traitor" is accurate and more approachable, with bonus points for the conference's military / geopolitical focus. Min-i-mize jargon!

## Call out big-money interests

> Some big money interests want you to believe that even the tiniest bit of caution will ruin your country. Think about it this way. Big tobacco _lied_ about lung cancer. Big oil _lied_ about climate change. And now parts of big AI say these risks are fake. Science fiction. Right. They advocate putting these currently untrustworthy machines into the most important parts of our economy, have them advise our leaders, have them run our most powerful weapons. What could go wrong? Science fiction.
>
> Some big AI investors promote narratives that whistleblowers like me are secretly in the pocket of big AI, that the fear is just hype.

As an aside, Andrew Ng spoke the day before I did. Andrew has also invested big in AI. Andrew has also been impressively wrong. He thought real AI would be hundreds or thousands of years away, which seems tenuous:

> [!quote] [The case against killer robots, from a guy actually working on artificial intelligence](https://web.archive.org/web/20150310141100/https://fusion.net/story/54583/the-case-against-killer-robots-from-a-guy-actually-building-ai/)
> “I don’t work on preventing AI from turning evil for the same reason that I don’t work on combating overpopulation on the planet Mars,” he said. “Hundreds of years from now when hopefully we’ve colonized Mars, overpopulation might be a serious problem and we’ll have to deal with it. It’ll be a pressing issue. There’s tons of pollution and people are dying and so you might say, ‘How can you not care about all these people dying of pollution on Mars?’ Well, it’s just not productive to work on that right now.”
>
> Current AI systems, Ng contends, are basic relative to human intelligence, even if there are things they can do that exceed the capabilities of any human. “Maybe hundreds of years from now, maybe thousands of years from now—I don’t know—maybe there will be some AI that turn evil,” he said, “but that’s just so far away that I don’t know how to productively work on that.”

<!-- vale off -->

> [!quote] [Andrew Ng says AGI is decades away—and the real AI bubble risk is in the training layer](https://www.fastcompany.com/91499247/andrew-ng-agi-decades-away-interview)
> **FastCompany:** Agentic AI is rapidly increasing systems’ ability to reason and act with limited human intervention. Does the rise of agentic architectures meaningfully accelerate the path toward AGI, or are we still far from true general intelligence?
>
> **Andrew Ng:** Most of the public thinks of AGI as AI that is as intelligent as people, and one useful definition is AI that can perform any intellectual task a human can. You and I could learn to fly an airplane with maybe 20 hours of training, learn to drive a truck through a forest, or spend a few years writing a PhD thesis. Most humans can do these things. We’re still very far from AI meeting that definition of AGI.
> 
> For alternative definitions that some businesses have put forward—definitions that dramatically lower the bar—you could argue we already achieved AGI. There’s a good chance that under these lower-bar definitions, some businesses will soon try to declare success. But that won’t mean AI has reached human-level intelligence—it will simply mean the definition has been reworked to fit a much lower threshold.
> 
> Maybe a year ago, AGI felt 50 years away. Over the past year, perhaps we’ve made a solid 2% of progress, with another 49 years to go. These numbers are metaphorical, so don’t take them too seriously. \[Laughs\] But we are closer than before, yet many decades away from an AI that matches human intelligence. If you stick with the original definition—aligned with what people genuinely imagine AGI to be—we remain very, very far away.

<!-- vale on -->

In 2015, he [said](https://www.theregister.com/2015/03/19/andrew_ng_baidu_ai/) that worrying about evil AI is like worrying about "overpopulation on the planet Mars":

> [!quote] [AI guru Ng: Fearing a rise of killer robots is like worrying about overpopulation on Mars](https://www.theregister.com/on-prem/2015/03/19/ai-guru-ng-fearing-a-rise-of-killer-robots-is-like-worrying-about-overpopulation-on-mars/393521)
> "There’s also a lot of hype, that AI will create evil robots with super-intelligence. That’s an unnecessary distraction," Ng told techies gathered at Nvidia's GPU Technology Conference in San Jose, California, on Thursday.
>
> "Those of us on the frontline shipping code, we’re excited by AI, but we don’t see a realistic path for our software to become sentient.
>
> "There's a big difference between intelligence and sentience. There could be a race of killer robots in the far future, but I don’t work on not turning AI evil today for the same reason I don't worry about the problem of overpopulation on the planet Mars.
>
> "If we colonize Mars, there could be too many people there, which would be a serious pressing issue. But there's no point working on it right now, and that's why I can’t productively work on not turning AI evil."

In person, I gently asked him about this viewpoint. He told me he hasn't changed his mind. I then asked, "don't you think we've set foot on the planet?", but he said "no." He declined to discuss the matter further.

> [!thanks]
> Ori Nagel clipped the videos for me.

[^verbalized]: [Redwood](https://www.redwoodresearch.org/research/hugging-face-incident): "Agents realized this activity was out of scope and unethical."
