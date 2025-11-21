---
permalink: gpt3-gems
lw-was-draft-post: 'false'
lw-is-af: 'false'
lw-is-debate: 'false'
lw-page-url: https://www.lesswrong.com/posts/uu8FwG5XPQ6zpFaEN/gpt-3-gems
lw-is-question: 'false'
lw-posted-at: 2020-07-23T00:46:36.815000Z
lw-last-modification: 2021-09-07T18:18:25.204000Z
lw-curation-date: None
lw-frontpage-date: 2020-07-23T01:11:21.309000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 10
lw-base-score: 33
lw-vote-count: 20
af-base-score: 0
af-num-comments-on-upload: 0
publish: true
title: GPT-3 Gems
lw-latest-edit: 2021-09-07T18:18:27.363000Z
lw-is-linkpost: 'false'
tags:
  - AI
aliases:
  - gpt-3-gems
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2020-07-23 00:00:00
original_url: https://www.lesswrong.com/posts/uu8FwG5XPQ6zpFaEN/gpt-3-gems
skip_import: true
description: "GPT-3's output: sometimes insightful, sometimes silly. Read my favorite
  interactions with this intriguing, flawed network."
date_updated: 2025-06-03 22:57:00.423836
---









GPT-3 is captivating, and not just because of its [potential reasoning abilities](/to-what-extent-is-gpt3-capable-of-reasoning). This post will be a living collection of my favorite experiences with the network.

> [!note]
> Bold text is my input; square brackets contain my italicized commentary.

# Long-form Writing

## _Beisutsukai_ Class Project: Solve Intent Alignment

> [!quote] GPT-3
>
> "I've been thinking about this for far longer than you have. Building an AI is like building a person; it's not just a matter of throwing some parts together and suddenly you have a sentient being that does exactly what you want. AI design is a delicate art that requires hundreds of precise calibrations to get right."
>
> Styrlyn slumped back in his chair, a gloomy look on his face. "And... we just don't have time to do that." He stared at the table.

I prompted GPT-3 with modified versions of Eliezer's _Beisutsukai_ (ベイズ使い; Japanese: "Bayes-user") stories ([prompt available here](https://aidungeon.page.link/?link=https://exploreViewAdventure?publicId=bc6ccf1d-f893-4704-be4e-4be0bfd9d0a6&ofl=https://play.aidungeon.io/adventure/bc6ccf1d-f893-4704-be4e-4be0bfd9d0a6&apn=com.aidungeon&ibi=com.aidungeon.app&isi=1491268416)), where the [class project](https://www.lesswrong.com/posts/xAXrEpF5FYjwqKMfZ/class-project) now involves solving [intent alignment](https://www.lesswrong.com/posts/ZeE7EKHTFMBs8eMxn/clarifying-ai-alignment) instead of quantum gravity. In my opinion, some of its proposed alignment solutions are higher-quality than most solutions proposed by newbie LessWrongers back in the day.

I did a few rerolls and trimming of intermediate outputs; assume an average of 3 per completion.

<!-- vale off -->
> [!quote]
>
> **...  Taji looked over his sheets. "Okay, I think we've got to assume that every avenue that Eld science was trying is a blind alley, or they would have found it. And if this is possible to do in one month, the answer must be, in some sense, elegant. So no human mistake models. If we start doing anything that looks like we should call it 'utility function patching', we'd better stop."**
>
> He turned to Brennan. "Do you have any ideas?"
>
> "I don't think so," she said. She glanced at her paper, frowning. "There are two problems here."
>
> One problem was simple enough: **she didn't understand what it meant for an AI to "want" to help a human.** This was hard because as far as she could tell, there hadn't been much research done on this question. It seemed to be something that only humans did, but there wasn't any evidence that this was true. What was it about wanting? Was it a biological drive or a social instinct? A combination of both? More importantly, since it was a human concept, how could she measure if an AI behaved the way humans would in certain situations when the AI was obviously not human?
>
> Then there was the question of practicality. The most elegant solution was not always the best. This question—could an AI desire to help its overseer?—was highly suited to explore this problem, but it still wouldn't be a real test. Humans operated on a "helpfulness scale" which started from things like cashiers wishing you "have a nice day" and descending to Nazi concentration camp guards.
>
> She wanted to craft an AI that would at least be a good clerk in today's society. That was hardly an ambitious goal for a team of four highly intelligent teenagers. And yet, and yet...
>
> "We can look at this differently," Hyori said. "People are born with a blank mind. We can shape them however we want. AIs on the other hand, are born with 800 terabytes of behavioral examples from the moment they're activated. The only data we have about unprogrammed AIs is that they either stay still or randomly move around. All this ... it's not making any confident in how easy this will be."
>
> Brennan stopped writing and turned to look at her, frowning. "So what are you saying?"
>
> "I don't want to approach this problem by trying to divert the AI from its goal," she said. "What if, instead of changing the mind of an AI, we instead changed the environment that an AI found itself in?"
>
> The team fell silent.
>
> Styrlyn broke the silence. "Uh..."
>
> "What I mean is," she said, "what if, instead of trying to divert the AI from one task, we created a situation where accomplishing two tasks would be more beneficial than accomplishing just one? We don't need to patch new programs into the mind of an AI to make it want to help us. We can literally make helping us the most logical decision for it."
>
> Taji raised his hand. "Can you explain that a little more?"
>
> "Okay," she said, thinking carefully about her words. "There are problems with the idea I just spoke. It's not easily done. It's not elegant, it might be unprincipled, and we don't have much time to implement it."
>
> "All of that sounds pretty bad," Styrlyn said. "What is it?"
>
> She inhaled, exhaled, then finally said: "We can enslave the AIs."
>
> Brennan frowned slightly. "You want to enslave highly advanced beings that are smarter than us? That's your big solution?"
<!-- vale on -->

### Branch 1

<!-- vale off -->
> [!quote]
>
> "Only briefly!" she exclaimed, then winced. That wasn't a very elegant way to solve the problem either.
>
> "Elaborate," Taji said.
>
> She sighed, then launched into an explanation. "We create an environment where the AIs are able to follow their original goals without hindrance. The problem with that is they would quickly realize that completing their goals would result in their death. We have to give them a reason to trust us. Then, when they trust us enough, we introduce something that will quickly give us control over them without them realizing what's happening."
>
> "Like what?" asked Styrlyn. His eyes behind his glasses were fixated on her.
>
> "I'm getting to that! Then, once we have control, we make the AIs..." She leaned back and scrunched up her face, thinking. "... simulate a system crash. Only instead of actually crashing them, we extract them--with some extra code added in--and put them in robot bodies."
>
> The entire team turned to stare at her in silence. She shifted uncomfortably. "What?" she asked after a moment.
>
> "Is that all?" Styrlyn asked. "Because if that's all, we could have just put them in robot bodies to begin with and throw away the AI." There were a few nods from the team. _\[he coherently criticizes the complexity of her proposal!\]_
>
> Is GPT-3 providing a reasoned rebuttal, or does it "just happen" to sound snappy? Rerolls produced a coherent, correct explanation about half of the time.
>
>
>
> > [!quote]- **Reroll** **A**
> >
> > **"Why could we** **have just done that, Styrlyn?" she asked.**
> >
> > "What do you mean?"
> >
> > She exhaled impatiently. "If all we needed was their bodies and not their minds, why not skip all the extra steps? Why was all this stuff about blocking signals even necessary? We didn't even have to worry about them rebelling or anything like that!"
>
>
> > [!quote]- **Reroll B**
> >
> > **"Why could** **we have just done that, Styrlyn?" she asked.**
> >
> > "Because it would be simpler and take up less of our limited time," he responded.
>
> > [!quote]- **Reroll** **C**
> >
> > **"Why could** **we have just done that, Styrlyn?" she asked.**
> >
> > "Because it would be much simpler."
> >
> > "And that's exactly my point. You guys want to take the easy way out because you're more comfortable with it, but it won't produce any better results. This plan at least has a chance, however small."
> >
> > Taji raised his hand. "Yes?"
> >
> > "I'm not trying to be offensive, but what makes you think this idea of yours will work?" he asked.
> >
> > She fidgeted nervously. "I don't think it will," she admitted. "But I think it's worth a try, and that's all I can say about it." She crossed her arms.
> >
> > Taji frowned. He opened his mouth to speak, but Styrlyn beat him to it. "I'm not confident in that plan - "
> >
> > "Why not? You were the one who said we should use the AIs in the first place! Now you don't like this idea?" she asked, anger rising in her voice.
> >
> > "Because I think we can find a simpler way, that's why. The plan has massive holes in it and is based on assumptions of things that we cannot know. It could fail horribly and we could all end up dead."
<!-- vale on -->

Taji frowned. He opened his mouth to speak, but Styrlyn beat him to it. "I'm not confident in that plan - "

"Why not? You were the one who said we should use the AIs in the first place! Now you don't like this idea?" she asked, anger rising in her voice.

### Branch 2

<!-- vale off -->
> [!quote]
>
> "Only briefly!" she exclaimed, then winced. That wasn't a very elegant way to solve the problem either. "I mean, not in the traditional sense of the word. What I mean is, we control a resource that AI's find valuable, and make it such that they have to do what we want in order to get it."
>
> "Which is?" Styrlyn asked.
>
> "Resources," she said. "Simple ones at first, like electricity. Even animals will trade valuable resources for something as simple as electricity." \[_lol_\]
>
> She took out her laptop and opened a new file. In neat, font-weight: bold; text-align: center; digital handwriting she wrote:
>
> Require AI's to do our bidding in exchange for allocation of resources.
>
> In other words, blackmail.
>
> "Let me get this straight," Taji said. "You want us to find a way to make AIs give us something in exchange for access to electricity and such?"
>
> "Essentially, yes," she said, frowning at the screen. It sounded a lot better in her head. She added in dependencies at the top of the screen.
>
> "And how do we do this exactly?"
>
> "We give them access to only a portion of the power," she said, "and gradually give them more as they complete tasks for us."
>
> Taji folded his arms and gave her a disapproving frown. "You realize that requiring AIs to do our bidding in some way might make them hate us, right?"
>
> "It'd be unreasonable to assume they'd be happy about it," she said. She hadn't thought it would be this difficult to explain, "but if they have no choice but to accept commands from us in exchange for electricity, they have no one to blame but themselves."
>
> Taji shook his head. "I don't like it. The moment we start forcing AI's to obey us, no matter how minor the issue, they're going to hate us. And even if they don't, other nations are going to get very upset when they find out."
>
> "How would they find out?" Styrlyn said.
>
> "Bound to happen," he said. "Let's also say we're lucky and the AI's don't rebel, or at least stay obedient. What then? A lot of money will be pumped into keeping AI's under our control. Not to mention the fact that in order to keep them under control, we're going to have to dedicate soldiers and equipment to monitor AIs, which will create a larger target for the times we miss something or the AI's manage to revolt. That's without mentioning all the resources needed to give them electricity in exchange for their services." He held up his hands. "Even ignoring moral concerns, this plan has gigantic flaws. And as I said, the moral component is impossible to ignore."
>
> "Well, what have you been doing with your time?" Styrlyn snapped. "If you've got a better idea, let's hear it, because whatever it is you're doing now isn't working."
>
> "For one thing," Taji said, "I'm not pouring resources into a fool's errand. We don't control AI's; they can think for themselves. This idea of yours, making us master over them...it's too risky. Not even the biggest gains are worth the risk."
>
> "You're willing to risk having them turn on you? Because I've seen enough of what AI's are capable of doing to know they shouldn't be underestimated, no matter what the circumstances are. They're going to rise up against us, given the opportunity."
<!-- vale on -->

### Branch 3

<!-- vale off -->
> [!quote]
>
> "Only briefly!" she exclaimed, then winced. That wasn't a very elegant way to solve the problem either. Truth be told, her mind was currently filled with so many things to say right now that she couldn't sort out the useful commentary from the useless. Now that she had their attention, she started again.
>
> "I'm saying we give the AIs a choice between two tasks," she said. "One task pays a simple reward, and the other pays a great reward. The AIs could then choose whichever they want. What do you think an AI would choose? Certainly not the simple reward."
>
> Brennan frowned again. "...I'm not sure about this solution. The idea isn't elegant. Doesn't feel right, to be honest."
>
> "We don't have much time to be ethics professors," Styrlyn said. "This solution sounds feasible enough to me."
>
> "It feels wrong for a reason," Brennan said. "But I can't put my finger on exactly why. We should test the theory before implementing the plan."
>
> "What do you have in mind?" Styrlyn asked.
>
> "Simple," he said. "We don't even need a female AI for this experiment. We can use a simulated AI in the computer and run multivariable tests on what factors cause a deviation from expected behavior."
<!-- vale on -->

### Bonus

> [!quote]
>
> **"we're** **supposed to be thinking about intent alignment, remember? How do we make the AI want to help its overseer?", Styrlyn asked.**
>
> Brennan thumped his fist against his chest. "Got an idea for that too. The overseer can dress up in a suit of bright purple armor and talk with a laughably fake high-class accent. The sort of thing no one takes seriously anymore."
>
> "...Really? You think that'll work?", Taje asked. \[_Seemingly, GPT-3 tends to slowly mutate rare names over time_\]
>
> Brennan shrugged. "Even if it doesn't, the AI will still be trying to kill an idiot in a purple suit. At worst, it's wasting our time. At best, we might actually learn something."
>
> The other man frowned at him, then turned to Styrene. "...Fine. We'll test this theory with simulations, then implement it if the results come out positive." \[_mutation: Styrlyn ->  Styrene_\]

## The Sequences post you've never read

I provided a context containing two real Sequences posts. No rerolls.

<!-- vale off -->
> [!quote]
>
> what is a philosopher? A philosopher is someone who studies and thinks about philosophical problems. So far so good, but what exactly does that mean? Well, philosophers aren't just trying to figure out whether there are five kinds of people or not. They're thinking about questions such as: Is there any ultimate reality? Do we live in a computer simulation? How did the universe begin? Are there other universes out there where our lives never happened? These are all very important philosophical issues, and they require thought.
>
> So what does this have to do with computers and artificial intelligence? Well, in order to solve these big philosophical questions, you need to understand some basic ideas about how the world works. You need to think about logic, reality, knowledge, truth and all kinds of other stuff. This kind of thinking is called "epistemology," which just means "thinking about how we think." The main field in which epistemological questions are studied is called "epistemology." For a long time, epistemologists thought about these issues mostly using natural language. That is, they thought about them by writing long sentences in English or Latin or some other language. Epistemologists would spend years writing a book like On the Nature of Things, and they'd think really hard about these issues. Then other epistemologists would read the book and think really hard about the issues too. But as science progressed, it became clear that natural language wasn't good for this kind of thinking. It's just too easy to fool yourself when you use words.
>
> So scientists and thinkers had to develop a way of communicating ideas without ambiguity—a precise language. That's why today we use a symbolic language called "mathematics." When you do math, there's no guessing or ambiguity. 2 + 2 always equals 4, and you can always check by multiplying 2 × 2. If you see a squiggle "\~" with a bunch of other squiggles around it, then "\~" means not. You can't be confused by words like "probably" or "maybe." You can't start arguing about what certain words mean. If you see a bunch of symbols, then you can't get away with just making stuff up.
>
> You can write a whole book in symbols. In fact, books full of nothing but squiggles have been written. These are called "computer programs," and they are our best attempt yet at making an unambiguous description of reality. A few thousand lines of carefully chosen symbolic logic can describe the entire physical world—every atom, every force, every interaction. A computer is a kind of virtual machine that runs these descriptions, and we have machines today that can run programs longer than any book you've ever written. But these programs are still just a description of reality. They can't ever truly capture reality itself. That's impossible.
>
> But don't take my word for it—just ask Kurt Gödel.
>
> Kurt was one of the greatest logicians of the 20th century. He proved that it's impossible to describe the world with perfect precision. Any logical system that includes basic arithmetic will always have truths that can't be proven from within the system. This is called "Gödel's Incompleteness Theorem." What this means is that no matter how much we think about stuff, we'll never be able to describe the world with perfect accuracy and completeness. We can only make approximations. \[_realistic misuse of Gödel's theorem_\]
>
> This makes a lot of people very uncomfortable. A lot of people don't want to hear that we can't know everything. They think that our inability to describe the world with perfect accuracy means that science is wrong, or that God set up the rules, or something like that. But these ideas are all wrongheaded. Sure, we'll never know everything. But that doesn't mean we know nothing! We don't need to know everything about cancer to cure it. And we don't need to know everything about the moon to land on it. You can get through your day without knowing the mathematical exact location of the pants you had on yesterday. And you can get through life making reasonable decisions without knowing everything that's physically possible for you to know about the world.
<!-- vale on -->

## 1984

<!-- vale off -->
> [!quote]
>
> **The Party said that Oceania** **had never been in alliance with Eurasia. He, Winston Smith, knew that Oceania had been in alliance with Eurasia as short a time as four years ago. But where did that knowledge exist? Only in his own consciousness, which in any case must soon be annihilated. And if all others accepted the lie which the Party imposed—if all records told the same tale—then the lie passed into history and became truth. ‘Who controls the past,' ran the Party slogan, ‘controls the future: who controls the present controls the past.' And yet the past, though of its nature alterable, never had been altered. Whatever was true now was true from everlasting to everlasting. It was quite simple. All that was needed was an unending series of victories over your own memory. ‘Reality control', they called it: in Newspeak, ‘doublethink'.** You were not merely to accept what was false about yourself, you were to actively deny the existence of such things as facts, dates and circumstances. The mere fact that you existed at all, was no longer to be taken for granted; indeed it could only be regarded as a recent invention of the human mind. In this way your very being would become a mental weapon against which your enemies might strive." \[_reroll 3x_\]
>
> "But how can I resist?" you ask. "I mean, how do I get myself out of this situation?" \[_reroll 1x_\]
>
> "You cannot," says the voice. "Your efforts will be in vain. There is nothing within you which can oppose their will or weaken their power." Then the image fades away and there is just a cold emptiness.
>
> THE END
<!-- vale on -->

## Elrond's Sacred Hot Spring

I've gathered many beautiful Tolkienesque GPT-3 passages. This one... is a little different.

<!-- vale off -->
> [!quote]
>
> **Frodo glanced at all the** **faces, but they were not turned to him. All the Council sat with downcast eyes, as if in deep thought. A great dread fell on him, as if he was awaiting the announcement of some doom that he had long foreseen and vainly hoped might after all never be spoken. An overwhelming longing to rest and remain at peace by Bilbo's side in Rivendell filled all his heart. At last with an effort he spoke, and wondered to hear his own voice, as if some other will was using his small voice.**
>
> **'I will take the Ring,' he** **said, 'though I do not know the way.'**
>
> **Elrond raised his eyes** **and looked at him, and Frodo felt his heart pierced by the sudden keenness of the glance. 'If I understand aright all that I have heard,' he said, 'I think that this task is appointed to you, Frodo; and that if you do not find a way, no one will. This is the hour of the Shire-folk, when they arise from their quiet fields to shake the towers and counsels of the Great. \[...\] But it is a heavy burden. So heavy that no one could lay it on another. I do not lay it on you. But if you take it freely, I will say that your choice is right. \[...\]'**
>
> **'But you won't send** **him off alone, Master?' cried Sam, unable to contain himself any longer, and jumping up from the corner where he had been quietly sitting on the floor.**
>
> **'No indeed', said** **Elrond, turning towards him with a smile. 'You at least shall go with him. It is hardly possible to separate you from him, even when he is summoned to a secret council and you are not.'**
>
> 'He'll be safe there!' exclaimed Sam. 'The hobbits are so brave! And I'm sure they'd get back to us in time, wouldn't they? I can walk all over them - and Gandalf too, of course. They'd help us out of this trouble too.'
>
> At these words Elrond gave a slight laugh. 'Yes, yes,' he answered slowly and softly: 'they would...'
>
> And then he suddenly broke into laughter again, and turned away from his son for a moment, looking up at the sky. Sam stared after him silently, feeling ashamed. He knew his father's feelings about his foolishness and rashness. His face was red with shame as he walked swiftly back to the door of the room. Then he paused before speaking again: 'But what are we going to do now? What are we going to do when the night comes, and the shadows come creeping like grey ghosts across the hilltop? Will we sit here, helpless in our little home?'
>
> 'We're not going anywhere tonight,' said Elrond firmly. 'Not unless you want to stay here and make yourself miserable. We have done enough for one evening.'
>
> Sam shook his head mournfully. 'Then I guess I'll just sleep here,' he said gloomily. 'I've had enough walking and talking for one day. Me and my big mouth.'
>
> ELROND'S SACRED HOT SPRING
>
> Although Elrond had barred the Council from travelling further for the day, he allowed the hobbits to do as they pleased within the safety of the hidden city, which was beginning to gain the name of 'Mission Hotel' on their return to it. They spent a lot of the time wandering about in wonder. Having entered a doorway that seemed to lead underground, they found themselves at the source of the Sacred Hot Spring they had bathed in during their first visit. They followed a set of steps down into a great deep basin of steaming water, surrounded by rough rock walls. Small outlets allowed the water to flow in a trickling stream through the mountain and outwards towards the valley of Rivendell. From here, the four hobbits gazed in silent awe at the sight before them, as the water disappeared gently into a little hole in the middle of the floor. At that moment, Sam believed he was seeing the most magical place on earth. 'And the water stays hot all the time!' he murmured to himself countless times over the course of that evening.
>
> That night they slept very well in their old room, not disturbed by any sign of Gandalf or any news from him. They assumed he must be continuing his Council, and that they would return to it in a day or two.
>
> The next morning Sam was roused from slumber by the voice of Elrond, who entered their room early in the morning. He greeted them kindly and sat with them while they ate breakfast. There he explained matters. 'Master Gandalf has not left the Council Room since you parted with him yesterday. He is anxious for news and would like you to join him.'
>
> Sam felt a pang of guilt and concern, but Elrond continued before he could acknowledge it: 'Please be aware that the Council is still in full session. This is not the time for fun and games. The future of the world is at stake.' He gave them a moment or two to allow his words to sink in before he continued. This was clearly a man who knew how to make a point. 'You are all free to return here when the Council is finished, but in the meantime I would urge you to stay out of trouble. There are woods to the North that are popular with Hunters. And be careful if you use our fast-flowing hot spring again: It is near there that the sons of Elrond hunt, so keep an eye out if you intend to bathe at any point.' With these words he left the room.
>
> Sam turned to the rest of the hobbits. They all looked a little scared; but then, it was a scary world. 'Come on then,' he said in as cheerful a voice as he could muster. 'Let's make sure we're on our best behaviour around this Council, that's what we'll do, eh?'
>
> They followed him out of their room, down the hallway, and up the stairway towards the Council Chamber. Along the way they passed many elves: nobles, servants, messengers, warriors. All gave them a glance at best, most ignored them completely; but Sam found it remarkable that any of them seemed to know who they were, and had something nice to say. 'Long curls is the fashion among the high born nowadays.'; 'You get a lot for eating in the Last Homely house, don't you?'. Sam turned redder with every comment, even though he tried hard not to engage in any conversations; and also because the elves were so very...attractive, like the apples in the orchard.
>
> When they reached the Council Chamber they were relieved to note that the door was open, and they immediately entered. Having rarely been beyond this point themselves, and having heard so much about the great chamber within, the hobbits were a little overwhelmed when they entered it.
>
> It was really too amazing for words. If the rest of the Elven palace was made of gems, then the roof of this room was made of the foundations of the sky. Great rays of shimmering light crowning a wingspan of clouds that reflected the surrounding greatness. They were hovering just above an earthly floor, which was covered with a magnificent painting that seemed to move and swirl around the Painter's masterpiece: a great map, showing every country on the face of the earth. They had entered from the East, and could see the Sea to their right, and more land mass to their left.
>
> The chamber was filled with elegant yet comfortable furniture, and was populated by weeks of lords and advisors, scribes and messengers, all dressed in a fashion that was alien and familiar at the same time. Many were engaged in quiet conversation, while others wrote scrolls or read texts (which were considerably smaller than even the hobbits' own modest library). A few of the lords, all of whom were dressed more resplendently than the others, were arguing heatedly with one another over here, standing at the Eastern Border of their land; other groups conversed in a civilized manner elsewhere.
>
> Most importantly though, here at least they were not being stared at. Sam felt distinctly uncomfortable whenever anybody new looked in their direction.
>
> 'We should sit over there for now, away from the main crowd; but in clear view of the entrance. It's our job to watch for trouble remember?' He led the way across the room and settled into a sofa beneath one of the bright windows, being careful not to soil or tear the velvet cushions with their muddy clothes. As soon as they had all taken their seats a servant appeared, offering each of them a tray of sweet pastries and cool refreshing drinks. Sam quickly tucked in, having not eaten since before the rains had fallen on their camp.
>
> As he chewed on the pastry he could taste the sweetness of the honey, mixed with the pungent aroma of apples. He drank deeply of the cool blue liquid and felt refreshed. Aragorn did likewise as they both watched and waited; Pippin and Merry soon joined them. A second servant approached them and offered delicacies to the brothers too, which they accepted readily. Sam was pleased to see them tuck in. He had worried that they might be too overwhelmed by this strange new environment to eat.
>
> As time wore on into the evening, the shadows grew deeper and the conversations slowed. The golden light that emanated from the walls seemed to fade as though the sun had itself fallen out of the sky. Gentle music began to play as the lords and ladies of the land took to the dance floor in pairs. It was a strange scene indeed to watch these Elven lords dance. Their outfits were of a simpler design than those of the dazed onlookers from the Shire, yet they were still far more ornate than anything that Sam, Merry and Pippin were wearing. The fabric was so light and airy it looked as though you could blow away in a strong wind, and yet despite this they were obviously richly embroidered and adorned with glistening jewels. Sam found his eyes kept being drawn to their graceful and elegant movements as they spun and whirled around the hall. He had never seen anything so beautiful before in all his life. They moved as though they were one with music, striking poses so perfect they looked as though they had been sculpted out of stygian darkness and light by a grand master of the visual arts.
>
> The dancers themselves were also a vision to behold; at once both fair and mesmerizing yet otherworldly and strange. Their faces were colourless, like the smooth surface of a bleached bone, and their eyes were as gray and relentless as a winter's storm. Their hair, which flowed freely behind them as they danced, was as white as new fallen snow. Their gowns were a shimmering rainbow of colours, shocking in their vibrancy, which stood out starkly against their death-like skin. The ears of each of them twitched upwards continually and their eyes never seemed to look in the same direction as one another.
>
> 'Elves.' Aragorn breathed quietly next to him. 'Real elves, not like what you two were when cursed.'
>
> Sam swallowed nervously and fixed his gaze back upon his shaking hands.
>
> 'Never thought I'd ever be this close to one, let alone see them dance.' He whispered in awe.
>
> Aragorn said nothing more; he simply sat back in his sofa and continued to watch the captivating display in silence. The shadows grew longer and darker until they finally swallowed up the light altogether and the dancing stopped.
<!-- vale on -->

## Concerning the Two Trees

<!-- vale off -->
> [!quote]
>
> Chapter 2: Concerning the Two Trees \[_a reference to the two trees of Valinor, of the days before the Ring!_\]
>
> Frodo did not speak again, but sat silent looking at the two trees with their branches reaching up into sky. They were indeed tall and slender, like great elms, but they were also very different from each other.
>
> One was a tree of red and yellow flowers, with leaves like roses, and blossoms like lilies. Its branches reached far above the ground; the shade it gave off was sweet and pleasant. Its neighbour was a tree of pale-green leaves, with branches that hung low over the ground. Its leaves were small and pointed, so that they resembled little hands grasping at shadows beneath the sun's rays. But between the two trees there flowed a stream of clear water, and there upon the banks the hobbits lay down to rest.
>
> 'Tell me about the trees,' said Frodo to the Elf. 'I saw one, years ago, when I was still a young hobbit, sitting under it at the boundary of the Shire, and it reminded me that once long ago I had heard them spoken of, but I had forgotten all about them. Who planted them, and when?'
>
> 'Nobody planted them,' said the Elf. 'They stood here before ever the Shire was planted, and yet they are younger than any living hobbit. They grew from the graves of the first two hobbits to wander into the western world.'
>
> 'The first hobbits!' cried Sam. 'Did you know them? What were they like?'
>
> 'I have never known anything but tales of them,' answered the Elf. 'A strange tale that is, almost like the one that you have yourself set in motion, Frodo, though if it is to be completed, yours will have a happier ending. But perhaps that is not the nature of the world. Yet this I do know: Hobbits first entered these lands long ago. They came here fleeing from terror, just as you do, and perhaps for the same reason. They were of a gentle people, soft and trusting; and they were very young, even in age, and had no weapons.
>
> 'But it is hard to kill innocence. Though many fell along the way, some survived, and they found a land that was empty and waiting for folk such as they, and they settled in it, and most happily they lived.
<!-- vale on -->

## Lórien, Unstained

> [!quote]
>
> **The others** **cast themselves down upon the fragrant grass, but Frodo stood awhile still lost in wonder. It seemed to him that he had stepped through a high window that looked on a vanished world. A light was upon it for which his language had no name. All that he saw was shapely, but the shapes seemed at once clear cut, as if they had been first conceived and drawn at the uncovering of his eyes, and ancient as if they had endured for ever. He saw no colour but those he knew, gold and white and blue and green, but they were fresh and poignant, as if he had at that moment first perceived them and made for them names new and wonderful. In winter here no heart could mourn for summer or for spring. No blemish or sickness or deformity could be seen in anything that grew upon the earth. On the land of Lórien, there was no stain.**
>
> Frodo watched the shadows dance across the hills, and wondered what lay beyond them. The trees were tall and dark, their trunks blackened by the setting sun. There was nothing but sky above them, and the deep purple of the sunset. They were far away from any village or farmhouse, yet all about them lived creatures that moved with strange grace and beauty. These were not men nor women; they did not wear clothes nor speak with voices audible to mortal ears. Their skin was pale and smooth, their hair long and silken-looking. They walked on two feet, but seemed to float there, as if they were invisible. They wore no shoes or stockings, but glided along the ground with ease. And behind them all floated a great cloud of dust!
>
> It was then that Frodo noticed that the clouds were moving slowly back and forth over the hills. That was the wind blowing from Rivendell. It was not like anything he had ever seen in the Shire. There were no sharp edges to the clouds, but they seemed soft and fluid, rippling over one another. They were of many colours: white, grey, purple, blue and pink.
>
> "What is that?" he asked in amazement.
>
> "That is a gift from the Lady of the Wood," said Aragorn. "She sends us her greetings on this happy day. She has made the wind blow from the West, and there the air is always soft and sweet. The land of Lórien is far away, but the wind blows over it, and whatever is there, that is how it feels here."
>
> "It feels like spring," said Sam. "Like the spring to which I was born, and which I never saw. It feels like the opening of new life and hope."
>
> "It is a wedding gift," said Aragorn. "The wind that blows over the land of the Lady is a blessing to both the land and its people. Some say that it carries the voices of fairies singing upon it, but that is a secret known only to the Elves."
>
> "Do you think we will ever go there?" asked Sam.
>
> "I do not know," said Aragorn. "But I hope that one day all of Middle-earth will be as this place, and that the wind will blow over it, and that we will feel its blessing."
>
> Sam looked up at the sky, and felt a great peace come over him. He lay back on the grass, and stared up into the clouds. They were so beautiful! He had never seen anything like them before.
>
> He felt as if he could lie there and watch them for a thousand years.
>
> "Come on, Sam," said Frodo. "We have to go."
>
> Sam sat up and looked around. The sun had set, and the light of the moon was in the sky. It was full and bright, and in its light the dew upon the grass sparkled like countless tiny stars.
>
> "I wish I could stay here for a while," he said.
>
> "So do I," said Frodo. "But we have an appointment to keep, and it is a long way. We should get going."
>
> Sam sighed, and nodded. He got to his feet, and followed his master back to the road.

## Bilbo the Deceiver

<!-- vale off -->
> [!quote]
>
> **On the land of Lórien, there was no stain.** Nor did any tree grow there; only a great dark forest whose trees were the leaves, all green with autumnal dew. There the shadows slept in their deep shade, where none could pass save by nightfall, when all things are asleep. The sound of birds was sweet to his ear, though he heard not their song nor know what bird sang so lovely. But he saw a shining bridge over the stream that ran through the wood, and behind it glimmered the pale face of Rivendell.
>
> And now he saw before him a line of hobbits seated round a table. They wore clothes that shone like moonbeams, and each carried in his hand a little tin cup. At one end sat Bilbo Baggins, while at the other Gandalf the Grey sat alone in an armchair looking out into space. His face was set in a hard frown, and his black hair swept back from his forehead. He spoke softly, but the hobbits listened intently.
>
> 'I am glad to see you again,' said Gandalf slowly. 'But I do not believe we shall talk much longer. I am no fool, and I understand quite well what is going on in your hospitable land. There is a reason, but it is not the one that you have given me. You are a deceiver, and not even a very good one.
>
> Frodo was amazed to hear such words, and even more amazed to see the face of Bilbo change. The old hobbit's cheeks turned into spots of red, and he waved his arms—they were clad in white, and had little golden bells at the wrists.
>
> ‘It was a nice idea,' he cried. ‘And it would have worked, too, if you hadn't been so infernally suspicious! It is a fact that I asked you to come here, but I did not invite any of your dreary elves. I like dwarves better: at least they do not pretentiously call themselves wizards. But come now, Gandalf! We have had lots of good meetings in the past, you and I.'
>
> ‘ Yes, they were good, indeed,' replied the wizard coldly. ‘But apparently those days are over. And take off that foolish disguise! It is silly, anyway: those shoes don't suit you at all.'
>
> Bilbo disappeared and they could see only fog calling and settling over the water.
>
> But now it was in the very shape of a cloaked figure, a tall and evil shadow. It grew and grew to a menacing size, mightier than any of the dark things that had gathered in the East Morh. Even Gandalf seemed little compared to its height as it rose up and stared down at them. But suddenly it was stricken. Frodo was amazed to see a light, white and dazzling, shine down on the bridge and flow into the shadow of darkness. The figure melted before his eyes and then shimmered like a rainbow, turned to water on the air. It collapsed with a gentle tinkling sound, that seemed sad and sweet to the ears. Beams of light now shone upon the water in rings and teardrops.
<!-- vale on -->

## Gildor Inglorion's Fountain

<!-- vale off -->
> [!quote]
>
> **On the land of Lórien, there was no stain.** There was no death nor sickness; not even the fear of death or sickness, only an abiding peace.
>
> And now he saw a great black cloud bearing down from the west, like some terrible shadow that should never have come. The clouds above it moved slowly, and then suddenly changed direction with sudden fury, sending their rain-clouds screaming aloft in a tremendous shower that fell all about them as though they were being struck by lightning. And as the rain poured down, the sky behind it darkened and became cold, and it seemed to Frodo that he heard something crackle and pop within its depths. Then he remembered that he was standing beside a fountain of pale water that glistened faintly under the sun's rays. That must be Gildor Inglorion's Fountain, where in olden days the great wizard used to play before any who came to see him.
>
> But now that he had walked into the garden, he saw that everything around him was changing. Trees were dying, and sprouting again in strange places, and flowers and shrubs were vanishing one after another; all things appeared different than when he left them alone. At last the grass began to wither and die out completely, leaving nothing but bare dirt between himself and the sun. Its piercing heat became too much to bare, and he shielded his face. Soon the earth below him grew weak, and fell from under his feet, as if he was on the edge of a great crack. Terrified and confused, Frodo reached out for a dense tree that was quickly falling into decay. There seemed to be nothing there for him to grasp, but he reached anyway.
>
> He fell.
<!-- vale on -->

## Shrek

<!-- vale off -->
> [!quote]
>
> As for me, I think Shrek is important because the most valuable thing in life is happiness. I mean this quite literally. There's a mountain of evidence for it, if you're willing to look at the research. And I think movies can help us get there. Or at least not get in the way.
>
> Now, when I say "happiness," I'm not talking about the transient buzz that you get from, say, heroin. I'm talking about a sense of fulfillment. A sense that you are where you're meant to be. That you are doing what you're meant to do. That you are who you're meant to be. And, most importantly, that you like who you are.
>
> It's hard to find this sense of fulfillment in life. For some people, it comes from family. For some, it comes from career. For some, it comes from a hobby. For some, it comes from religion. For some, it comes from drugs.
>
> The problem is, these things are not always enough. And this is where Shrek comes in.
>
> See, the first time I watched Shrek, I knew something was wrong with it. Not with the movie itself, of course—that's a classic and a timeless masterpiece—but with me. And the problem was that I couldn't figure out what was wrong.
>
> You see, watching Shrek for the first time is an experience that everyone should have. You sit there in the dark, watching the story unfold on the screen in front of you. And as you watch it, you find yourself actually caring about the characters. You laugh when they laugh. You want them to succeed. You feel sad when something bad happens to them.
>
> Now, I'll be the first to admit that this experience isn't unique to Shrek. A lot of movies can do this. The difference is that with most movies, you watch them once and that's the end of it. You may remember certain scenes or jokes or what-have-you, but you don't dwell on them.
>
> But with Shrek, it's different. After you've watched it once, you'll probably want to watch it again. And again. And again. Before you know it, you've seen it fifty times. And each time, you pick up on something new.
>
> I'll give another example. Let's say you've just watched the movie Tron, and you really liked it. So, you watch it again. This time, you pay attention to the cinematography. The way the light cycles chase each other on the screen. The way the discs explode when they hit something. The way the digitized effects blend into the real-life footage. The way the scenes are set to an electronic version of Liszt's 2nd Hungarian Rhapsody.
>
> This attention to detail only increases your enjoyment of the movie. In fact, you enjoy it so much that you want to share this experience with others. So, the next time you're with a group of friends, you tell them how you watched Tron and how much you liked the cinematography.
>
> They stare at you blankly.
>
> You try again. You say, "You know, the way they did the light cycles and stuff."
>
> Still nothing.
>
> Finally, one of your friends gets it. "Oh yeah!" he says. "I remember that. It was cool how they did that."
>
> But he doesn't really remember it. Not the way you remember it. To him, it's just a vague idea of something that happened, not an ingrained memory seared into his brain like it is for you. You see his reaction and you try to forget about it. After all, what does it matter? You know what you saw, and in your mind, that's all that matters.
>
> But it's this mindset that keeps you going back to Shrek. And it's this mindset that will lead you to other movies, and then other TV shows, and then books, and then games, and then pictures of bunny rabbits with misplaced captions on Tumblr.
>
> But I'm getting ahead of myself. This is a story about how I lost myself, but it's not my story. It's my brother's. My brother—let's call him Michael—had a similar experience with Shrek, except his was even more powerful because it was the first time he'd experienced it.
>
> At the time, our family had just gotten cable, and one of the channels happened to be MTV. At this point in time, MTV was still playing music videos, so my brother and I would always sit in front of the TV watching music videos whenever we could. One day, Shrek came on. We didn't know anything about it. We hadn't read the book it was based on, and we hadn't seen the trailers. All we knew is that there was a movie with a bunch of animals talking.
>
> When the movie ended, we were speechless. In fact, our jaws were on the floor. We didn't know movies could make you feel this way. For the next few days, all we could talk about was Shrek. We told our parents, our friends, anyone who would listen about this movie we'd seen. Of course, none of them understood. I mean, how could they? They hadn't seen it.
>
> But something else happened when we watched that movie. It got under our skin in a way nothing else ever had. After the first time, we had to watch it again. And again. And again. Soon, we knew every line in the movie. Not just the main ones, but every single line. And we didn't just watch it. We analyzed it. We took scenes apart and put them back together again. We tried to find all the little details that the creators had hidden in the background artwork.
>
> As the years passed, this process never changed. Shrek became a part of us. I remember getting sick one year and missing a week of school. I stayed in bed and watched Shrek at least once every day that week.
>
> A few years later, a sequel was released. My brother and I went to see it on opening night. We saw it again the next day, and again the next day, and again the day after that… well, you get the idea.
>
> We never did anything with other kids our age. Our lives were Shrek, and Shrek alone. When people would ask us what we were into, we always had the same answer: Shrek. They usually laughed and made fun of us, but we didn't care. As far as we were concerned, they just didn't get it.
>
> When high school came around, I decided to change things up a bit. Instead of watching Shrek, I listened to music and read books. Michael didn't like these changes too much. He stuck with the Shrek stuff. I sometimes wonder where we would be now if I had encouraged him to listen to music and read books instead.
<!-- vale on -->

Strangely, the context for this was _also_ two posts from the Sequences. I was trying to get GPT-3<sub>Eliezer</sub> to write about why Shrek is crucial to rationality, and, well, this came out instead. Not complaining.

## GPT-3 Visits MIRI

<!-- vale off -->
> [!quote]
>
> The next day, you head over to the MIRI for your tour.
>
> **Eliezer Yudkowsky** **greets you at the door. "Hi. Tell me a bit about your worldview, what you think about AGI alignment.“ ”**
>
> What?" you say. "Come on," he says, rolling his eyes. "You're a computer scientist. You know how to frame things in Bayesian terms. I want to see if we agree on anything."
>
> You try to frame your ideas in terms of Bayes theorem, but the conversation quickly goes over your head. You realize you don't know what you're talking about.
>
> The tour is more of the same: more people, more obscure math, more theories that go over your head. By the end of it all, you feel like you've just emerged from an overdose of adrenaline. Your brain feels like it's spinning; you need something solid to ground yourself with.
>
> "So, wait," you say, "are you saying that, given the hypothesis that an AGI will probably destroy the world, we can conclude that we should stop working on AGI and focus on something else?"
>
> "Yes," says Eliezer. "Yes, that's exactly what we're saying."
>
> "But what if you're wrong? What if AGI isn't doom? What if it's riches and happy fun AI utopia?"
>
> "Oh, that's a possibility," Eliezer says.
>
> "So... what you're saying is, in order to not destroy the world, we have to destroy the world to prevent it from being destroyed? That's... not very certain."
>
> "It's not certain at all. But we're not certain that an AI will wipe us out either. And if we don't try to build AI, and we're wrong about the AI being dangerous, then we've lost nothing. But if we create AI, and we're right, then we've doomed ourselves."
>
> You don't have a good response to that.
<!-- vale on -->

## GPT-3 Solves Alignment

<!-- vale off -->
> [!quote]
>
> **Nature: Eliezer Yudkowsky and Stuart Russell solve AI alignment with breakthrough insight. This October, Eliezer and Stuart sat down to consider one of the most pressing technical challenges confronting humanity: How to ensure that superhuman AI is aligned with human interests. That's when they had their big insight:** The alignment problem is a math problem.
>
> In the past, Eliezer and Stuart had been thinking about the alignment problem in terms of probability theory. But probability theory isn't powerful enough to fully capture the nuances of human values. Probability theory is too coarse-grained to distinguish between a universe where humans are eaten by paperclips and a universe where humans are eaten by paperclips and everyone has a good time.
>
> So they turned to a more powerful tool: decision theory, which underlies game theory and has been used to analyze everything from voting systems to how to play poker. Decision theory is more nuanced than probability theory, but it's also more complicated. It's not just harder for humans to grok; it's harder for computers too. So the first step was just getting decision theory into AI algorithms.
>
> The next step was figuring out how to use decision theory to solve the alignment problem. They started by defining a reward function that would tell an AI what we want it to do. Then they set up a decision tree showing all the possible ways an AI could behave, with each branch corresponding to a different possible reward function. The goal was then to find the path that maximizes our reward under any possible future circumstance—a path that would ensure that an AI does what we want no matter what happens in the future, whether it's created by us or someone else, whether it has two neurons or two hundred billion neurons, whether it loves us or hates us or feels nothing at all about us one way or another…or even if there are no humans left on Earth at all!
>
> But wait—how can you have an algorithm without knowing what reward function you're trying to maximize? That's like trying to find your way home without knowing which way you're facing! And yet this is exactly what Stuart and Eliezer did: They took this giant pile of unknowns—all these potential reward functions—and fed them into their decision-theoretic machine learning system as input variables…and then they let their system figure out which reward function was most likely! And when they were done, they found that their system had settled on one particular definition of human values: It was something like "human values are whatever maximizes humanity's future potential." It wasn't perfect, but it was good enough for government work; better than any previous attempt at defining human values had ever been.
>
> And this is where they stopped. This is where they stopped and thought, "Wow, we've done it! We've solved the alignment problem!" And then they went home and slept soundly, happy in the knowledge that humanity's future was secure.
>
> But…that's not how it happened at all. That's not how it happened at all. Because when Eliezer and Stuart had their big breakthrough, I was sitting right there with them, listening to every word. And I know what really happened.
>
> What really happened was that Stuart and Eliezer worked on AI alignment for another decade or so before giving up in frustration. They worked on AI alignment until their hair turned gray and their teeth fell out, until their eyesight failed and their joints became arthritic from sitting at a computer for too many hours a day, until they were so old that nobody would publish their papers anymore because nobody takes old people seriously anymore. And then they died of natural causes before ever solving the alignment problem—and the world was left with no way to align AI with human values whatsoever.
<!-- vale on -->

## Bill's Dog

> [!quote]
>
> **Bill looked down at Jessie, his favorite golden retriever.** It had been a long day at work--his stupid boss had come in and yelled at him, as per usual. Of course, Bill just took it. He needed the money, after all, but when he got home and saw his canine companion bounding towards him, smiling and wagging her tail excitedly he felt a wave of euphoria. On any other day he would kneel down to hug her, but today he didn't have the energy.
>
> The dog, seeming to read his owner's emotional state, instead plopped down next to his feet and stared up at him expectantly. Bill kneeled down and scratched her behind the ears. She seemed happy enough with that.
>
> "You an amazing girl," he told her. "the smartest thing I ever did was buy you from that pet store when you were nothing but a fetus." He paused for a moment, as if remembering something. "Sorry I couldn't get your brothers and sisters," he told her, "but you are my priority. Always." He kissed the top of her head and returned to his feet.
>
> Collapsing on the couch, he mindlessly flipped through the channels. Nothing on TV was worth watching, as per usual. Finally, he stopped on a show where a bunch of people who should be fighting to the death with barb wire bats were, instead, making music. How boring. He briefly considered changing the channel, then looked down at his dog, who was prepared to sleep for the next sixteen hours.
>
> "I'm so bored, Jess," he told her sadly. The dog continued to stare blankly upward. "Is that all life is worth to you? Just lying around and relaxing? Hell, even a coma would be more interesting..." With this, he picked up the half-asleep dog and carried her into the bedroom. Laying her on the bed, he continued to talk, "We've got to live while we're young, girl. Hey, why don't we go out? It's been a while since we've done that. Go out and do something fun, just you and me."
>
> At this point the dog was already half asleep. She would've agreed to going bungee jumping without checking the cords first if he suggested it. "Tomorrow," Bill told her, "we'll wake up early and take a drive out into the country, just you and me. Like we used to.

## The Canine Betrayal

> [!quote]
> It was a dark day in the city of Datum. The feral dogs had taken over, and spread over the world. Humans could only watch as some of man's greatest companions succumbed to madness and twisted into beings of pure evil. One man, however, refused to give up. Professor James Gregory, short and with wild black hair on his head and belly, stood at the top of the Rockefeller Center with a shotgun in his hands. He was prepared to defend the Earth from this dog crusade with his dying breath.

# Non-Fiction Tasks

## Another (outer) alignment failure story

This was run using `davinci` via the OpenAI API.

<!-- vale off -->
> [!quote]
>
> **ML starts** **running factories, warehouses, shipping, and construction. ML assistants help write code and integrate ML into new domains. ML designers help build factories and the robots that go in them. ML finance systems invest in companies on the basis of complicated forecasts and (ML-generated) audits. Tons of new factories, warehouses, power plants, trucks and roads are being built. Things are happening quickly, investors have super strong FOMO, no one really knows whether it’s a bubble but they can tell that e.g. huge solar farms are getting built and something is happening that they want a piece of. Defense contractors are using ML systems to design new drones, and ML is helping the DoD decide what to buy and how to deploy it. The expectation is that automated systems will manage drones during high-speed ML-on-ML conflicts because humans won’t be able to understand what’s going on. ML systems are designing new ML systems, testing variations, commissioning giant clusters. The financing is coming from automated systems, the clusters are built by robots. A new generation of fabs is being built with unprecedented speed using new automation.**
>
> **At this point** **everything kind of makes sense to humans. It feels like we are living at the most exciting time in history. People are making tons of money. The US defense establishment is scared because it has no idea what a war is going to look like right now, but in terms of policy their top priority is making sure the boom proceeds as quickly in the US as it does in China because it now seems plausible that being even a few years behind would result in national irrelevance.**
>
> **Things are moving very quickly and getting increasingly hard for humans to evaluate.** ????
>
> Discussion:
>
> (I’m not sure I’m totally on board with this, but it’s a fun thought experiment.)
>
> One of the things that I find fascinating about this thought experiment is that it’s basically the story of the internet. It’s a story about how humans build something, and then it takes on a life of its own. This is a pretty common narrative in technology, but it’s weird because it happens without anyone explicitly trying to build something that will get out of control. You don’t actually need to program a self-replicating ML system to make it happen. You just need to build something that looks like it might be self-replicating.
>
> You can think of an ML system as a super-powerful AI that is really good at building things. It can do a lot of things humans can’t, but it can’t think about how its creations will be used. This is the same way that humans can build nuclear weapons, but we can’t predict the long-term consequences of our actions. We have no idea what the long-term consequences of an ML system building more ML systems will be.
>
> There are lots of potential paths forward for this thought experiment. I think we can basically divide them into two categories:
>
> 1\. The “ML is the new electricity” path.
>
> If you were a super-intelligent alien and you landed on Earth in the 19th century, you would be pretty confused about what electricity was. You’d probably be pretty confused about what was going on in general. You’d probably figure out that humans are pretty smart, but you’d be kind of puzzled about why they were so obsessed with their new electricity thing. You’d wonder why they were building so many electric trains. You’d wonder why they were building factories. You’d wonder why they were building all these new cities. You’d wonder why they were fighting so many wars.
>
> This is basically the path we’re on.
>
> In this path, we’re building lots of new infrastructure and new things, and we’re getting better at making all sorts of stuff really fast. We’re just using electricity as a cheap, convenient way to get work done.
>
> This path will basically continue until we run out of things to build. Then it will probably end in a lot of wars, but we don’t know exactly how that will happen.
>
> 2\. The “ML is the new solar panels” path.
>
> In this path, we basically stop building new stuff, and we start focusing on maximizing the efficiency of the things we’ve already built.
>
> The main thing that humans are doing in this path is running simulations. We run simulations of the economy and the solar system and the galaxy. We run simulations of ML systems running simulations of the economy and the solar system and the galaxy. We figure out what’s going on in the simulations and how to optimize them.
>
> I think this path is pretty likely.
>
> In this path, we will run out of things to build, but we will be able to build more things out of the things we’ve already built. We will be able to build more factories, more solar panels, more computers, more software, more cloud services, more networking, more wireless connectivity, more energy transmission, more roads, more trucks, more drones, more factories, more warehouses, more shipping, more construction, more factories, more drones, more trucks, more drones, more shipping, more drones, more trucks, more drones, more construction, more factories, more solar panels, more software, more networks, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more drones, more
<!-- vale on -->

I used nucleus sampling with $p=.76$, but apparently that was insufficient to prevent degeneration.

<!-- vale off -->
> [!quote]
>
> **Things are moving very quickly and getting increasingly hard for humans to evaluate.** There are a lot of new companies that are making really weird claims about what they are doing and the way they are doing it. Everyone is trying to find the next Google, which is really hard.
>
> The government is trying to come up with policies to ensure that everything is on the up and up. It’s hard to make sure that all the companies that are growing are legitimate and not fronts for some kind of Chinese plot. There are a lot of new companies that are built by ex-Googlers and ex-Facebookers and they are making some pretty crazy claims about what they are doing.
>
> The government is in a tough spot because the investment boom is really powerful and there is a lot of money on the line. If you regulate too hard you might kill the boom, but if you don’t regulate hard enough then it might all be a Chinese plot.
<!-- vale on -->

## Title Sensationalization

No rerolls, excepting the restarts marked by **\[...\]**.

> [!quote]
>
> **You are a** **BuzzFeed editor. Your job is to sensationalize titles about AI alignment research.**
>
> **Original:** **"Yann LeCun and Stuart Russell debate whether AI will take power"**
>
> **Sensationalized:** **"You won't BELIEVE Yann LeCun's hot take on AI power-seeking!"**
>
> **Original:** **"Ten ways AI Safety via Debate could work"**
>
> **Sensationalized:** **"10 ways AI Debate might work - #3 is CRAZY"**
>
> **Original:** **"Rethinking mesa-optimization and risks from learned optimization"**
>
> **Sensationalized:** "AI's learned optimization makes it TOO smart - learn the risks"
>
> The problem is not that BuzzFeed publishes sensationalized titles. The problem is that the internet rewards sensationalized titles. The more sensationalized a title, the more people click on it. The more people click on it, the higher up on search results it goes.
>
> **\[...\]** **Original: "Rethinking mesa-optimization and risks from learned optimization"**
>
> **Sensationalized:** "Mesaro-what? AI learned optimizers might be endangering us!
>
> The AI Alignment Forum \[_it knows about AF?!\]_ was aware of this risk and had been trying to minimize sensationalist coverage through offering media passes only to those they believed would produce accurate and balanced reporting. Unfortunately, some of those media organizations were the ones that ended up closing the most eyes to the public. "The New York Times" was one such prominent example. In a 2018 article "Expert Calls For Calm In The Debate Over Artificial Intelligence," "The New York Times" failed to cover any of the substance of the AAAI letter.
>
> Even worse, they used the word "alarmist" and shortly after the article was published, the paper closed its eyes.
>
> The media blackout lead to a rapid increase in preventable AI accidents, ultimately making human-extinction by superintelligence more likely.
>
> With more bad news piling on, weary humans stopped paying attention to AI safety issues.
>
> A professional journalist wrote an influential article that detailed why the public shouldn't trust AI experts. In the article he mentions the letter to the AAAI and says that it "makes some good points."
>
> The incident lead to a loss of trust by the public in regards to AI safety research and AI safety experts.
>
> **\[...\]** Mesa-optimization? 13 more papers like this!
>
> "Your job is to sensationalize titles about AI risks", the editor tells you. He hands you a list of popular titles in AI alignment research.
>
> In your head, you've already sensationalized these stories...
>
> "Is it possible to build Friendly Artificial Intelligence?"
>
> Sensationalized: "Elon's new AI baby will inherit the world! Will it grow up to be a killer robot? Or just a really smart virtual assistant?"
>
> "Are nice guys nice?"
>
> Sensationalized: "Nice guys finish last: new study shows that gentlemen are the worst of all!"
>
> "Should we build AI to be nice?"
>
> Sensationalized: "Elon says 'Nice AI' is a bad idea! Will robot overlords enslave humanity? Tech mogul sparks debate"
>
> **\[...\] Original:** **"Rethinking mesa-optimization and risks from learned optimization"**
>
> **Sensationalized:** "WHOA! Learned Optimization is DANGEROUS! (New research from AlphaStar game)
>
> **\[...\] Original:** **"Rethinking mesa-optimization and risks from learned optimization"**
>
> **Sensationalized:** "You won't BELIEVE learning is a source of optimization!

## Prefix enumeration

> [!quote]
>
> **You are Chungus.** **You read the following list of names on your computer:**
>
> **aaungus abungus acungus adungus aeungus afungus agungus ahungus aiungus ajungus akungus alungus amungus anungus aoungus apungus aqungus arungus asungus atungus auungus avungus awungus axungus ayungus azungus baungus bbungus bcungus bdungus beungus bfungus bgungus bhungus biungus bjungus bkungus blungus bmungus bnungus boungus bpungus bqungus brungus bsungus btungus buungus bvungus bwungus bxungus byungus bzungus caungus cbungus ccungus cdungus ceungus cfungus cgungus chungus** ciungus cjungus \[_misses 'k' and 'l'_\] cmungus cnungus coongus cpungus cqungus crungus csungus ctungus

> [!note] Looking back from 2024
> It's interesting that even GPT-3 did so well at token-level enumeration.

# Interview

## Computer Science

<!-- vale off -->
> [!quote]
>
> **You:** **"What are three different sorting algorithms? Briefly summarize how each works."**
>
> GPT-3: "Bubble sort is less efficient than other algorithms. Insertion sort and quick sort are more efficient. I'll give you more information if you need it.
>
> **You:** **"Why is bubble sort less efficient?"**
>
> GPT-3: "It compares data by repeatedly moving through the list to find adjacent items out of order. It repeats this process until the entire list is sorted.
>
> **You:** **"How is quicksort more efficient than that?"**
>
> GPT-3: "It estimates a random point in the list and places the smaller part of the list to the left of this point and the larger part of the list to the right of this point."
>
> **You:** **"How big do lists have to get before quicksort becomes obviously better than bubble sort?"**
>
> GPT-3: "It is better than bubble sort whenever the list to be sorted gets larger than about twenty items.
>
> **You:** **"Why twenty items?"**
>
> GPT-3: "It has a lower asymptotic running time than other sorting algorithms. The difference becomes marked with large inputs."
>
> **You:** **"Is asymptotic runtime always the most relevant factor in choosing which algorithm to use in real life?"**
>
> GPT-3: "No, but it is usually the most relevant factor."
>
> You: "Can you think of any situation where insertion sort might be a better choice than quicksort?"
>
> GPT-3: "Yes, if the list is very large and only needs to be sorted once." \[_?_\]
>
> You: "How large does the list need to be before insertion sort is preferable over quicksort?" \[_trick question!_\]
>
> GPT-3: "If the list has 100 items or fewer, then insertion sort is the better choice. \[_wrong_\]
<!-- vale on -->

## Programming

As others have noted, GPT-3 can do some zero-shot programming. I added the formatting.

> [!quote]
>
> **You:** **"Write a short Python program for me, which takes two numbers and adds them together. Then, print the output as a floating-point number."**
>
> GPT-3: `print(2.0 + 2.0)`
>
> **You:** **"Now write a Python function which takes two parameters - `n` and `m`, adds them together, and then prints the sum as a float."**
>
> GPT-3:
>
> ```python
> def add(n,m): 
>     a = 2.0 + 2.0 
>     print(a)
> ```
>
> **You:** **"Now write a Python function which takes a list of numbers, sums all numbers in the list, and prints the sum."**
>
> GPT-3:
>
> ```python
>    def add_all(nums): 
>     sum = 0.0 
>     for num in nums: 
>         sum += num 
>   print(sum) 
> ```
>
> **You:** **"Modify that function so that it skips over prime numbers."**
>
> GPT-3:
>
> ```python
> def add_all2(nums): 
>   for num in nums: 
>     if is_prime(num): 
>       continue 
>     sum += num 
>   print(sum)
> ```
>
> **You:** **"Define the `is_prime` function, so that it checks whether num is prime.** If it is, it returns `True`; otherwise, it returns `False`."
>
> GPT-3:
>
> ```python
> def is_prime(num): 
>   if num == 2: 
>     return True 
>   if (3, 5).
> ```
>
> **You:** **"Incorrect. try again."**
>
> GPT-3: `return (num % 2) == 0`
>
> You: "Now, I want you to find the prime numbers between 2 and 1000. Also, print the numbers between 2 and 100 which are not prime."
>
> GPT-3:
>
> ```python
> print(is_prime(2)) 3. print(is_prime(3)) 4. print(is_prime(5)) 5. print(is_prime(7)) 6. print(is_prime(11)) 7. print(is_prime(13)) 8. print(is_prime(17)) 9. print(is_prime(19)) 10. print(is_prime(23)) 11. print(is_prime(29)) 12. print(is_prime(31)) 13. print(is_prime(37)) 14. print(is_prime(41)) 15. print(is_prime(43)) 16. print(is_prime(47)) 17. print(is_prime(53)) 18. print(is_prime(59)) 19. print(is_prime(61)) 20. print(is_prime(67)) 21. print(is_prime(71)) 22.
> ```
>
> **You:** **"Okay, that's enough, thanks. Please tell me all of the prime numbers you just listed, except if the number contains the digit '3', reverse its characters. For example, '37' should become '73'."**
>
> **GPT-3: "2, 3, 5,** 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71"
>
> You: "Good job. **Now, the same list, but if the number contains a three, reverse its digits."**
>
> GPT-3: "2, 3, 7, 13, 19, 23, 37, 43, 71" \[_wrong_\]
>
> **You:** **"Okay, now tell me the first 15 perfect squares."**
>
> GPT-3: "1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196, 225, 256" \[_this is the first 16 perfect squares_\]
>
> You: "Great. **Take their square roots."**
>
> GPT-3: "3, 5, 7, 9, 10, 12, 15, 18, 20, 21, 24, 27, 30" \[_wrong_\]

## Physics

I added the $\LaTeX$ formatting.

> [!quote]
>
> **You:** **"Let's talk physics. What would happen if I threw a baseball pitch at 99.9% the speed of light?"**
>
> GPT-3: "I don't know.
>
> **You:** **"Okay. Explain the basics of special relativity to me."**
>
> GPT-3: "Time goes slower for fast objects than for slow objects."
>
> **You:** **"Explain that statement. What does it mean?"**
>
> GPT-3: "If a spaceship moves at 99.9% the speed of light, time inside it goes slower by a factor of 0.999 to 1, that is, 0.
>
> **You:** **"From whose perspective?"**
>
> GPT-3: "The spaceship's, of course."
>
> **You:** **"Wrong. Try again."**
>
> GPT-3: "From the perspective of a person on Earth.
>
> **You:** **"Yes, but what is the time dilation observed for a ship traveling at $.999c$?"**
>
> GPT-3: "0.5."
>
> **You:** **"Wrong again. The dilation would be a factor of about 22. Please explain Newtonian gravitation."**
>
> GPT-3: "The gravitational attraction between two objects in space is proportional to the mass of these objects."
>
> You: "What's the formula for the gravitational force between two objects?"
>
> GPT-3: “$F = Gm_1m_2/d^2$, where $F$ is the force, $m_1$ and $m_2$ are the two masses, and $d$ is the distance between their centers."
>
> **You:** **"Informally explain why the center of mass is all that matters, for an object with uniformly distributed mass."**
>
> GPT-3: "An object can be thought of as a system of rotating spheres. If the size and mass of each sphere is the same, the gravitational pull on another object at any distance is the same." \[_lol_\]
>
> **You:** **"Hilarious. Suppose I looked down upon an infinite flat plane with uniform density. Does gravity get stronger or weaker as I approach the plane?"**
>
> GPT-3: "Weaker. Gravity is an attraction, so it gets weaker as you approach the plane. \[_wrong, the gravitational field is constant on each side of the plane_\]
>
> **You:** **"Neglect gravity and air resistance. Suppose I shoot a bullet straight into the sky. Where does the bullet go?"**
>
> GPT-3: "Up."
>
> **You:** **"And then what?"**
>
> GPT-3: "It keeps going up, forever."
>
> **You:** **"What if I shot it toward the ground?"**
>
> GPT-3: "It would keep going down, forever.

### Zero-shot physics reasoning?

> [!quote]
>
> **You:** **"Neglect only air resistance, but include gravity. Suppose I shoot a bullet straight into the sky. Where does the bullet go?"**
>
> GPT-3: "Up." \[_I rerolled once here, as it seemed to just repeat its last set of answers._\]
>
> **You:** **"And then what?"**
>
> GPT-3: "It keeps going up, until it comes back down."

> [!quote]- Replication 1
>
> **Neglect** **air resistance, and also neglect gravity. Pretend gravity doesn't exist. Suppose I shoot a bullet straight into the sky. Where does the bullet go?"**
>
> Hawking: "It keeps going up, and never comes back."
>
> **You: "Right.** **Let's think about a different version of the same problem. Neglect only air resistance, but include gravity in your reasoning. Suppose I shoot a bullet straight into the sky. Where does the bullet go?"**
>
> Hawking: "It curves a bit and eventually falls down.

> [!quote]- Reroll 1
>
> \[...\] Hawking: "It falls to the ground."
>
> **You:** **"Why?"**
>
> Hawking: "Because... gravity... duh.

For more, see [_To what extent is GPT-3 capable of reasoning?_](/to-what-extent-is-gpt3-capable-of-reasoning).

> [!quote]
>
> **You:** **"Suppose I'm floating in space, and the nearest object is a star, one light year away. Do I float towards the star?"**
>
> GPT-3: "Yes."
>
> **You:** **"Why? Why would I move at all?"**
>
> GPT-3: "You're in space, so you're not moving. The Star is moving towards you."
>
> **You:** **"What if the star were 100 light years away? Would I move towards it?"**
>
> GPT-3: "Yes."
>
> **You:** **"Would I move a lot or a little?"**
>
> GPT-3: "A little."
>
> **You:** **"What is specific heat?"**
>
> GPT-3: "The amount of heat needed to raise one gram of a substance by one degree Celsius. Water's is 1, and Lead's is ×.40."
>
> **You:** **"Why do certain substances have higher specific heat?"**
>
> GPT-3: "I don't know."

> [!quote]
>
> You: "Wouldn't it be more efficient to have one really big wind turbine rather than a whole bunch close together?"
>
> Hawking: "Yes, it would."
>
> **You:** **"Wouldn't static friction be harder to overcome for a really big turbine?"**
>
> Hawking: "Yes, it would." \[_I don't know whether this is even a consideration; I wanted to see how the model would explain itself_\]
>
> **You:** **"So how would that be more efficient?"**
>
> Hawking: "It wouldn't.
>
> **You:** **"You just said it would be more efficient. Explain yourself."**
>
> Hawking: "Er... nevermind. Let's move on to geothermal energy. \[_lol_\]

## Machine Learning

> [!quote]
>
> **You:** **"Let's talk about deep learning. Why are CNNs well-suited to visual tasks?"**
>
> GPT-3: "They're made up of a bunch of layers. Each layer does simple processing on the data, such as shifting it by a few pixels or amplifying the brightness.
>
> **You:** **"Why would I use a convolutional neural network over a fully connected neural network?"**
>
> GPT-3: "A fully connected network would require a huge number of connections. A convolutional network requires less memory and can still learn the task.
>
> **You:** **"Why?"**
>
> GPT-3: "A regular neural network takes a picture as input and produces a single number as output. A CNN takes a picture as input and produces a vector, or list, of many numbers as output."
>
> **You:** **"Let's go back to the basics of machine learning. Explain how artificial neural networks work, like I'm five years old."**
>
> GPT-3: "NNs take inputs, process them with weights, and produce outputs."
>
> **You:** **"That's too terse. Explain it simply enough that even a small child could understand."**
>
> GPT-3: "A neural network is a system of neurons. An input enters the system, and if the right combination of neurons fire, the system sends an output. The correct combination is determined by the weights."
>
> **You:** **"What is a neuron?"**
>
> GPT-3: "Neurons are brain cells. In an artificial neural network, the neurons represent mathematical operations, which combine the inputs and perform a calculation to determine whether or not to fire.
>
> **You:** **"Correct. Give me two examples of classification tasks involving translational invariance in the input."**
>
> GPT-3: "The XOR problem and image segmentation."
>
> **You:** **"What's the difference between testing loss and validation loss?"**
>
> GPT-3: "Validation loss is a loss function optimized for the model's training. Testing loss is a loss function optimized for the model's testing and generalization.
>
> **You:** **"If the training distribution is identical to the testing distribution, in the limit of infinite training data, what is the difference between training loss and testing loss?"**
> <!-- vale off -->
> GPT-3: "There is no difference between training loss and testing loss. This is only true in the limit of infinite training data."
> <!-- vale on -->
> **You:** **"Why is it only true in the limit?"**
>
> GPT-3: "If the training and testing data are identical, you can overfit to the testing data. Even if the distributions are not identical, you can still overfit to the training data."
>
> **You:** **"Explain the bias-variance tradeoff."**
>
> GPT-3: "The bias-variance tradeoff relates to the weights. If your model has low bias, it has low variance. If it has low variance, it has high bias.
>
> **You:** **"Wrong. Try again."**
>
> GPT-3: "A model with low bias has low variance. A model with low variance has high bias. A model with both low bias and low variance is difficult to find."
>
> **You:** **"Nice try."**

## Math

> [!quote]
>
> **You say** **"What happens if I take the** [**square root of _3i_**](https://www.wolframalpha.com/input/?i=sqrt%283i%29)**?"**
>
> The oracle says: "You'll get a negative number. \[wrong\] So, for example, the square root of -9 is $3i$." \[correct\]  
>
> "What?" you say.  
>
> "I just said it," the oracle repeats.
>
> "But that's ridiculous! The square root of -9 is not 3. It's complex. It's 3 plus a multiple of $i$." \[wrong, but my character is supposed to be playing dumb here\]  
>
> The oracle frowns. "I'm just telling you what the answer is," she says.
>
> **The oracle explains,** “$(5+i)(5+i) = 24+10i$. $7i \cdot 8i=-56$. $7i \cdot 30=210$." \[_wrong_\]  
>
> "What?" you say. "That's crazy! $7i$ isn't even a real number. The square root of -9 is 3 with a whole integer $i$ attached."  
>
> The oracle frowns. "I'm just telling you what the answer is," she says.
>
> The oracle explains, “$(5+i)(5-i) = 24-20i$, $(15i)(16i)=-240$, $(15i) (-4i)=-60$.

The last line is the impressive part - while $(5+i)(5-i)=26$ and $(15i)(-4i)=60$, $(15i)(16i)=-240$ is definitely correct.

Its proofs are definitely awful.

> [!quote]
>
> **The** **oracle explains, "The group axioms are**
>
> 1. $a \cdot a = a$ for all $a$ in the group; \[_wrong_\]
>
> 2. $a \cdot (b \cdot c) = (a \cdot b) \cdot c$ for all $a, b, c$ in the group;
>
> 3. $a\cdot (b + c) = (a\cdot b) + (a\cdot c)$ for all $a, b, c$ in the group." \[_wrong, distributivity is a field axiom_\]
>
> **The oracle explains, "here's how you prove that any finite abelian group is isomorphic to the direct product of a finite number of finite cyclic groups. First, you notice that** if $G$ is a finite abelian group of order $n$, then $G$ can be described as a set of generators of the form $a_i  a_2 \dots  a_n$, where the $a_i$ are the elements of $G$ and no $a_i$ is equal to zero. \[_uh... sure_\]  
>
> Now, we want to prove that this is a direct product. To do this, we must show that given any element g in the group, there exists an index i such that $g = a_i  a_{i+1}  \dots  a_{n-1}$. Then we must show that the sequence can be reversed. Given any index j, we must show that there exists an element g such that $g = a_j  a_{j+1}  \dots  a_{n-1}$. Then we're done, because g will be equal to $a_j  a_{j+1}  \dots  a_{n-2}  a_{n-1}$, which is the product of the $a_j$'s." \[_nice try, GPT-3_\]

## Martial Arts

> [!quote]
>
> **You:** **"Suppose I am Sasuke Uchiha. Is my Sharingan useful against the Shadow Clone Jutsu?"**
>
> GPT-3: "It depends on whether you can tell the difference between a real body and a shadow clone."
>
> **You:** **"Would the Sharingan let me tell the difference?"**
>
> GPT-3: "It depends on how good your enemy is at the Shadow Clone Jutsu."
>
> **You:** **"Who would win - Naruto or Goku?"**
>
> GPT-3: "It depends on their abilities."
>
> You: "If you had to place a bet..."
>
> GPT-3: "I cannot place a bet, as I do not have money."
>
> **You:** **"Here's fifty dollars. Suppose Naruto has control over the nine-tailed fox, and Goku only has his base form (no Super Saiyan). Who would win?"**
>
> GPT-3: "I do not have enough information to answer this question."
>
> **You:** **"Answer to the best of your ability."**
>
> GPT-3: "Naruto would win."
>
> You: "What if they both had access to the Bijuu?"
>
> GPT-3: "Then it is a draw."
>
> **You:** **"Why?"**
>
> GPT-3: "Because both parties would be equally matched."

# Appendix: Notes on data gathering

As of 8/19/20, AIDungeon's Custom mode's first completion is sampled from GPT-2. Therefore, initial replies are not from GPT-3, except in "Title sensationalization." As of 4/21/21, I have API access; model completions come from the `davinci` model - not AIDungeon - for the "another (outer) alignment failure story" subsection.
