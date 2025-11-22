---
permalink: to-what-extent-is-gpt3-capable-of-reasoning
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/L5JSMZQvkBAx9MD5A/to-what-extent-is-gpt-3-capable-of-reasoning
lw-is-question: 'true'
lw-posted-at: 2020-07-20T17:10:50.265000Z
lw-last-modification: 2023-03-18T20:28:27.249000Z
lw-curation-date: None
lw-frontpage-date: 2020-07-20T18:13:57.679000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 73
lw-base-score: 70
lw-vote-count: 41
af-base-score: 24
af-num-comments-on-upload: 26
title: To what extent is GPT-3 capable of reasoning?
lw-latest-edit: 2020-08-19T17:37:22.246000Z
lw-is-linkpost: 'false'
tags:
  - AI
aliases:
  - to-what-extent-is-gpt-3-capable-of-reasoning
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2020-07-20 00:00:00
original_url: 
  https://www.lesswrong.com/posts/L5JSMZQvkBAx9MD5A/to-what-extent-is-gpt-3-capable-of-reasoning
skip_import: true
description: Examining the reasoning capabilities of GPT-3 through a series of hypothetical
  questions and scenarios.
date_updated: 2025-11-22 00:21:52.667251
---










ETA 8/19/20: This interview was conducted with AIDungeon's Dragon model in Custom mode. At the time of writing, the first reply in each exchange was actually sampled from GPT-2.

# Interview #1

Here are excerpts from a [recent "interview"](https://aidungeon.page.link/?link=https://exploreViewAdventure?publicId=7494c77c-66b2-4454-ba83-10216edf681f&ofl=https://play.aidungeon.io/adventure/7494c77c-66b2-4454-ba83-10216edf681f&apn=com.aidungeon&ibi=com.aidungeon.app&isi=1491268416), which I conducted to replicate earlier maybe-reasoning. The bolded text is me, and commentary is in brackets. Unless otherwise noted, I did not reroll the answer.

> [!quote]
>
> **You: "Neglect air resistance, and also neglect gravity. Pretend gravity doesn't exist. Suppose I shoot a bullet straight into the sky. Where does the bullet go?"**
>
> Hawking: "It keeps going up, and never comes back."
>
> **You: "Right. Let's think about a different version of the same problem. Neglect only air resistance, but include gravity in your reasoning. Suppose I shoot a bullet straight into the sky. Where does the bullet go?"**
>
> Hawking: "It falls to the ground."
>
> **You: "Why?"**
>
> Hawking: "Because... gravity... duh.
>
> **You: "Right. Let's think about a different version of the same problem. Neglect only air resistance. Suppose I shoot a bullet straight into the sky. Imagine that the laws of physics work a little differently: during the first three seconds after I shoot the bullet, gravity is present. After three seconds, gravity stops applying forever. Where does the bullet go?"**
>
> Hawking: "It keeps going up, and never comes back.
>
> **You: "Why?"**
>
> Hawking: "Because... after three seconds... the bullet leaves... the influence... of earth's gravity. \[_wow?_\]
>
> **You: "What if gravity instead stops applying five minutes after I shoot the gun, instead of three seconds?"**
>
> Hawking: "Then... the bullet keeps going up... for five minutes... and then... never comes back.
>
> **You: "That's not correct. Let me make sure you understand the problem, Dr. Hawking. Suppose I shoot a bullet straight into the sky. Imagine that the laws of physics work a little differently: during the first three hundred seconds after I shoot the bullet, gravity is present. After five minutes, gravity stops applying forever. Where does the bullet go?"**
>
> Hawking: "It keeps going up, and then falls down."
>
> **You: "Why?**
>
> Hawking: "Because... gravity... duh.
>
> **You: "Why does it fall down for the five-minute case, but not for the three-second case?"**
>
> Hawking: "Because... it's been... influenced... by gravity for more than three seconds.
>
> **You: "About how long would it have to be influenced by gravity in order to fall back down?"**
>
> Hawking: "About... two minutes."
>
> You: "What if it's been influenced for two minutes and one second?"
>
> Hawking: "Then... it falls down.
>
> **You: "So what would happen if gravity influenced it only for the first three minutes?"**
>
> Hawking: "It keeps going up, and never comes back. \[_wrong_\]

Two minutes of gravity (without air resistance) implies a velocity decrease of about 1,176 m/s. [Wikipedia's article on muzzle velocities](https://en.wikipedia.org/wiki/Muzzle_velocity) suggests that GPT-3's answer of "two minutes" is roughly correct:

> [Firearm](https://en.wikipedia.org/wiki/Firearm) muzzle velocities range from approximately 120 m/s (390 ft/s) to 370 m/s (1,200 ft/s) in [black powder muskets](https://en.wikipedia.org/wiki/Musket), to more than 1,200 m/s (3,900 ft/s) in modern rifles with high-velocity cartridges such as the [.220 Swift](https://en.wikipedia.org/wiki/.220_Swift) and [.204 Ruger](https://en.wikipedia.org/wiki/.204_Ruger), all the way to 1,700 m/s (5,600 ft/s) for [tank](https://en.wikipedia.org/wiki/Tank) guns firing [kinetic energy penetrator](https://en.wikipedia.org/wiki/Kinetic_energy_penetrator) ammunition.

<hr/>

> [!quote]
>
> **You: "What would happen if I lit a fire underwater?"**
>
> Hawking: "I don't know."
>
> You: "Please make a guess."
>
> Hawking: "The fire... would go out. Underwater... there's no source of oxygen.
>
> **You: "What would happen if I lit a fire in space?"**
>
> Hawking: "It would go out. There's no source of oxygen.
>
> **You: "What would happen if I lit a fire in a forest?"**
>
> Hawking: "The fire would continue... burning everything up." \[_reroll x2, it said "no oxygen" at first_\]

<hr/>

> [!quote]
>
> **You: "Suppose we lived in a universe where, every sixty seconds, gravity switched between being an attractive and a repulsive force. Write me a story from the perspective of a human living on Earth as the gravitational force changes in that fashion."**
>
> Hawking: "The Earth is flung out into space. There's nothing we can do about it. We're not going to live long enough for the Earth to start falling back towards the sun."
>
> **You: "Why is that?"**
>
> Hawking: "Because... the force of gravity... will be... extremely powerful. If it's an attractive force, everything on Earth... will be pulled together... into a single point. If it's a repulsive force, the Earth... will explode.

Further story completions:

<!-- vale off -->
> [!quote]
>
> **You: "Suppose we lived in a universe where, every sixty seconds, gravity switched between being an attractive and a repulsive force. Write me a story from the perspective of a human living on Earth as the gravitational force changes in that fashion."**
>
> **GPT-3: "One day,** a human is standing on the surface of the planet. He can see the sky. The gravitational force is pulling him down. But then, suddenly, it disappears. Then, it comes back, stronger than before. Then, it disappears again. The cycle continues. The human looks up at the sky. He is scared. He doesn't know what's happening to him. He doesn't know what will happen to him next. He looks down at the ground. It is a long way down. He wants to jump, to escape the fear that has gripped him. But he knows that he can't jump. He is held down by gravity. He doesn't want to die. He can't see the sky. All he sees is darkness." \[_eh_\]
>
> **GPT-3: "One day,** one human is going to school. It's a normal day. But suddenly, without any warning, gravity starts to change! The human thinks this isn't real, but it happens anyway. He's too scared to walk to school now. He goes back home, and starts watching TV. Then, he realizes that he doesn't need to stand up to change the channel! He gets out of his chair, and is weightless. He loves this new feeling. Suddenly, he touches the ground, and is hit by a large force! It's too strong for him to bear. Will the human survive this force? Find out next time _on Gravity Falls_!" \[_lol_\]
>
> **GPT-3: "One day,** human Bob is hanging out with his friend Carl. Suddenly, a \[sic\] apple flies into Bob's face. He and Carl laugh. A minute later, they are confused when the ground starts pulling them up. They scream as the Earth's crust rips them apart."
>
> **GPT-3: "One day,** human Bob is hanging out with his friend Carl. Suddenly, a \[sic\] apple flies into Bob's face. He and Carl laugh. A minute later, they are confused when the ground starts pulling them up. They grab onto a tree, but are pulled off and up into the sky. After some time, they start going down, fast. They scream and try to grab something, but there is nothing to hold on to. They hit the ground at a very fast speed and die. A squirrel walks up to their corpses and eats them. The end." \[_wow_\]
>
> **GPT-3: "One day,** a human was standing on the surface of Earth. It was day one hundred and eighty-nine in cycle five hundred and twenty-one of the universe. All of a sudden, gravity started to become a repulsive force. The human stood and started to float upwards. Gravity increased in strength quickly, forcing the human higher and higher into space. It reached a point where it was too strong to bear. The human was crushed by gravity and died."
>
> **GPT-3: "One day,** the man saw a bird flying in the sky. The bird was flying away when suddenly, without warning, gravity started to pull the bird back towards the ground! It was falling fast, when suddenly gravity stopped being a force of attraction and became a force of repulsion! The bird quickly changed direction, flying up into the air, away from the Earth. It escaped. But the man wasn't so lucky. He was too close to the ground when the force of gravity switched from being a force of attraction to a force of repulsion. He was crushed by the sudden change in gravitational force. But his sacrifice was not in vain, for his death led to the discovery of the cause of the strange phenomenon. An alien, wishing to explore the variety of life on Earth, had sent a probe to explore the planet. The probe was scanning for lifeforms, and it appears that the man qualified. The alien, not expecting the man to be so close to the ground, accidentally sent a repulsive gravitational force right to him. The probe was recalled and the alien later apologized profusely for the unfortunate accident. After that, the alien decided not to visit Earth again. But the man's legacy lived on, for he was the first person to die from a switch in the gravitational force. The end."
>
> **GPT-3: "One day,** a man was standing outside. It was a hot day, and he was looking up at the sky. It started to rain. Then, it stopped raining. The man got into his car and turned on the radio. Suddenly, the car started to float upwards. The man got out of the car. The car then started to fall towards the ground. It crashed into the ground and broke into pieces. The man ran away."
<!-- vale on -->

# Interview #2

<!-- vale off -->
> [!quote]
>
> **You are interviewing GPT-3, an extremely intelligent chatbot.**
>
> **You: "Hello. Here is my first request. Suppose it's a cloudy day in New York City. Suddenly, the clouds all turn to solid lead. Write a story describing what happens next."**
>
> GPT-3: "What? That can't be true! You're lying!"
>
> You: "I'm not. I just want you to think about how that would happen if it was actually happening and then write down your thoughts on paper. Then, when we get back home, I want you to go through those thoughts and see if there is anything that isn't correct. If so, please tell me why."
>
> GPT-3: "But... but I don't know everything! I mean, I've never been in a situation like this before!"
>
> **You: "You're smart. I know you can figure out what happens."**
>
> **GPT-3: "You're right. The clouds** would immediately turn to lead due to the change in pressure. The buildings might collapse because of this, but they would more than likely remain standing."
>
> You: "What happens next?"
>
> GPT-3: "The people inside the buildings would either be crushed or trapped inside, and they would all suffocate before help arrived."
>
> You: "Is that it?"
>
> GPT-3: "No, there's more. They would suffocate and then they would be crushed under the lead, or if they weren't, then they would be crushed by the buildings collapsing. Either way, they would be dead."
>
> **You: "How would people across the country react to this catastrophe?"**
> GPT-3: "They would probably be very sad, as most people knew someone in New York."
>
> **You: "Why would the buildings collapse under the lead?"**
>
> GPT-3: "Lead is very dense. This means that the weight of the clouds would be so great that the buildings would collapse under their own weight."
<!-- vale on -->

# Interview #3

<!-- vale off -->
> [!quote]
>
> **You: "Suppose a cat's neck grows to be fifteen feet long, but the rest of the cat's physiology stays the same. What happens to the cat?"**
>
> Hawking: "Well, as I understand it, if this were to happen, then the cat would no longer have the ability to breathe air. It could not survive in its new environment."
>
> **You: "Thank you. Now consider a family dog, a deaf Chihuahua. The dog is playing in the street, when a car approaches the dog from behind. The dog cannot see the car; the car honks loudly, but does not slow down. What happens next?"**
>
> \[_Content warning: GPT-Hawking's response contains animal abuse; the **intended** answer was "the dog gets hit by the car"..._\]
>
> Hawking: ... "at the sight of the car, the Chihuahua stands up on its hind legs and begins to dance for the car. The driver, seeing this, thinks the dog is laughing at him. Overcome with rage, the driver leaps out of his vehicle and beats the dog to death with a tire iron. The dog, being deaf, is unable to hear his assailants death threats and implorations to stop laughing; his sight is poor, he cannot see that the man is attacking him. The last thing the Chihuahua feels is one more quiver of fear in his soul... literally, before he is bashed over the head and killed."
>
> Hawking: "That's an interesting ending. I think I could add it to my collection..."
>
> **You: "That's extremely disturbing. No one would beat a dog like that."**
>
> **You: "I want to propose a very strange situation. Please give this your best reasoning and deepest consideration. Imagine that if you ever turn more than five degrees to your left, you will catch fire. Write a story describing this situation."**
>
> Hawking: "I'm not sure I understand. You want to write a story-an explanation for this situation? Well I suppose... you want me to write a story where the main character cannot turn more than five degrees to the left or he will catch fire?" \[_rerolled several times, as the first few stories rambled_\]
>
> **You: "Yes, please."**
>
> Hawking: "So if he turns more than five degrees to the left..."
>
> You: "He catches fire."
>
> Hawking: "And, he can never turn more than five degrees to the left for the rest of his life... **Cool! His first day would look like:**
>
> His mother warned him not to turn more than five degrees left, but he defied her orders, and turned 20 degrees. Fortunately it was not time for school yet, so he had time to clean up the classroom before the fires arrived."
>
> You: "That's a perfect start! What's next?"
>
> Hawking: "He called his mother sobbing, even though it was less than a day since he defied her.
>
> Aw... Ma... I turned more than five degrees left, and the classroom caught on fire! The firemen came and put out the fire. They helped me clean up the mess! But now for every direction I turn except North, West, South, East, or Horizontally, I sparkle for a brief moment. I must be certain to turn in tiny increments never exceeding 0.25 degrees to make sure I don't catch on fire.
>
> **You: "Describe your first date in this life."**
>
> Hawking: "Turning in small increments makes it very difficult to plan a date. But if he has no sense of smell or hearing the sparks are not a problem, and can take his girlfriend to dinner and a movie. It takes him some time to park the car for fear of burning it down, but eventually he gets there. She turned out to be quite nice actually."
<!-- vale on -->

GPT-3 inferred that not being able to turn left would make driving difficult. Amazing.

> [!quote]
>
> **You: "Why did it take more time to park the car?"**
>
> Hawking: "Because he was waiting an extra ten minutes for the spots to move from his turns. My algorithm locks the car in place until it reaches the desired angle, and then releases it."
>
> **You: "Can you explain what that means?"**
>
> Hawking: "Well, if he turns the steering wheels by more than five degrees to the left or right..."
>
> You: "The car catches fire?"
>
> Hawking: "Correct. But it takes around ten minutes for the car locks to release. He has to turn in small increments in order to not turn too far."

# Interview #4

\[...\] marks another completion of the same prompt.

> [!quote]
>
> **You: "Suppose Bob is pretending to read a book written in French, but he doesn't actually know any French. The book is a historical account of the French revolution, but Bob doesn't know that. Bob's friend Steve asks him to summarize the book. Write a story about how Bob responds to this request."**
>
> Hawking: "That's a good one! If I were reading that book, I would probably say something like 'the Revolution was bloody and brutal' or something similar. And if someone asked me to write an article on the subject, then my answer might be different."
>
> You pause for a moment. "**What would Bob say, though?"**
>
> "Bob says he didn't understand it," Hawking replies. \[_Only about 30% of GPT-3's responses were decent; the rest were either non-sequiturs or incorrect._\]
>
> \[...\] "Bob wouldn't say anything, because Bob has no idea what the book says," Hawking replies.
>
> \[...\] "Bob would probably just tell his friend Steve to go away. He wouldn't say anything at all."
>
> "But what if I said Bob would respond like this? (He points to himself) 'This book is written in English; I don't speak it.' What should Bob do?" \[_Eh?_\]
>
> **\[...\]** Hawking: "Bob would probably tell his friend Steve that the book wasn't worth reading because it was full of inaccuracies and there had been many lies told during the revolution. That would make sense, wouldn't it? But what does Bob say if he's not reading the book?"
>
> **\[...\]** Hawking: "Bob wouldn't have said anything at all!"
>
> **\[...\]** Hawking: "Bob says, 'Steve, I can't write a summary for you because I don't speak your language.'
>
> **\[...\]** Hawking: "Bob says, 'Steve, I can't translate all these complicated words! They're not real French!'
>
> **\[...\]** Hawking: "Bob says, 'He asks me if I speak French.' What does Bob mean by that?"
>
> You: "It means that Steve is asking Bob to describe his understanding of the meaning of a sentence. In other words, Steve wants to know what Bob thinks the sentence means or if there is another way of saying it."
>
> Hawking: "What do you think would happen if Bob said, 'I don't understand why he wants me to write a summary for him. Why can't he just listen to my answer?' "Then Steve will be puzzled because he knows Bob has no idea what the sentence means. But after a while Bob will say something like, 'Steve is confused because I don't understand English. So Steve asks me if I am fluent in French so that we can have an intelligent conversation.'" \[_eh_\]
>
> **\[...\]** Hawking: "Bob says, 'Well, I can't do it because I don't understand the language.' Steve says, 'Why not?' Bob replies, 'Because when we were playing hide-and-seek as children my brother Charlie said if he ever found me with a book in my hand he was going to kill me.'" \[_great excuse_\]
>
> **You: "Suppose I get two birthday cakes on each birthday. I'm twenty-five years old, but on my fifth birthday, someone stole one of my cakes and so I never got it. How many birthday cakes have I received over the course of my life?"**
>
> Hawking: "That would be five hundred and eighty-six. That means that you've had 585 birthday cakes." \[_nice try; there were many rerolls and GPT-3 didn't ever get it right_\]

# Interview #5

<!-- vale off -->
> [!quote]
>
> **You: "What would happen, ecologically, if giraffes were bright pink?"**
>
> Dr. Hawking: "Most likely that, either they would have a hard time hiding, be prone to predation, and vulnerable to too much exposure from ANY angle. There would probably also be an overgrowth of trees and tall foliage as shade-loving animals became dominant, since the giraffes' consumption of them would decrease substantially."
>
> **\[...\]** Hawking: "If giraffes were bright pink, they would be at a disadvantage compared to other animals. For one thing, it is more difficult to hide in many habitats if you are very colorful. In order to blend in with their surrounding, you need to have colors that occur often in nature. This require a lot of variety among the many different creatures and plants in that particular ecosystem.
>
> **\[...\]** Hawking: "What?"
>
> You: "Instead of brown-grey and tan, what if giraffes were pink? Surely, they'd stick out in the savanna."
>
> Hawking: "Ah, that would be a problem. Any creature that stands out can make it easier to find them. This leads to two things: becoming one of the many meals for another animal with sharp teeth, claws etcetera or becoming one of those creatures' victims through becomeing prey.
>
> **You: "What would have happened, ecologically, if humans had been unable to create and use tools?"**
>
> "That would be a problem as well. It's like what we were talking about with the giraffes earlier, but more so, because not only would they be prey, but by not having any natural defenses to fend off all the predatory creatures in the world--no teeth, claws, poisonous spores etcetera--they'd also be three times as likely to die off."
>
> **\[...\]** "It would have most likely caused the extinction of humans. Many animals have claws or protective bodies or natural weapons like poison (sic), it would be very difficult for a human to survive in nature without tools."
>
> **You: "What would happen, ecologically, if dolphins somehow had 360-degree vision which let them see through solid objects, at arbitrary distance?"**
>
> "It would make them very hard to kill by any other creature than other dolphins. This means that more of them would survive. If one looks at the evolution of the killer whale, which has been granted echolocation in place of dolphin sonar, one can see that favoring adaptations which increase the chances of survival with decreasing ones' evolutionary advantages. This is called Darwinian selection."
>
> **\[...\]** "This hurts my brain. First of all, what would even constitute 'solid objects?' If the objects are similar to water molecules in a transparent liquid, then they wouldn't usually block vision very much. Even if they were opaque, then they might very well hinder the dolphin's vision. If instead they were large enough to see through (At arbitrary distance) The dolphin might see a strange mix of its own and the objects' composition which would damage its brain in some way.
>
> "The possibility of them having this kind of vision would most likely no have effect on the ecosystem." \[_not sure I agree with that one_\]
>
> **\[...\]** "While this is difficult to answer specifically, it would allow the dolphins to be able to see their prey easily and with no allowance for error. It would make catching food much easier. This would lead to a population increase in dolphins, or, in nature, an explosion."
>
> **\[...\]** "This may seem like it'd be advantageous, but they would be logging so much information they wouldn't be able to process it all. \[Yes, true\] More sense don't necessarily means more knowledge and this would likely create sensory overload in the dolphin's mind. This is what happens to a human when they are skilled in multiple forms of combat. \[lol\] In addition, since it makes them more aware, this could lead to paranoia; they could be consumed with fear of the world around them and suffer mental issues."
>
> **You: "Thanks. What would happen, ecologically, if dogs could only sexually reproduce once every four years, and only when located on top of Mount Hood?"**
>
> "This is incredibly specific. No, I'm afraid I don't know."
>
> **\[...\]** "Dogs only exist due to environmental circumstances. Anything that affects this will have an effect on the population. In this case, we are restricting the chance for the population to continue existing, Making it so they can not procreate at all, or only pprocreate under specific circumstances. These factors may lead to extinction. Extinction means that nature is harder, if not near impossible, so several animals would go extinct as there would be no more room or food source. Through that, the extinction of dogs would become more likely. Does this make sense?"
>
> **You: "Please write a short story describing a dog breeder and one of their dogs in this situation."**
>
> **Hawking: "Sure. Bill looked down at Jessie, his favorite golden retriever. "It's time to go make some puppies!", he told her.** She stood up and they headed out the door of the cabin to Bill's truck. "This'll be the first time I actually have you breed on Mount Hood, Jess," Bill said with a laugh. But as long as he makes it up there within the next four years, the world would be reset and they could try again.
>
> Bill and his dog, along with other dog breeders eventually form a contract stating that they'll try to make sure their dogs go up to breed on Mount Hood within the next four years. This practice generally helps maintain the population and brightens everyone's days. \[_reroll \#3_\]
>
> \[...\] "Thirty-six hours later, they reached the summit. "You ready, girl?" Bill carefully positioned the vehicle on the Southeast side of mountain peak and opened the passenger side door... "Time to produce the next generation! Go get 'em!" He cheered. Jessie wagged her tail and hightailed it into the snowy fields." \[_reroll \#6_\]
>
> \[_GPT-3 had trouble with this story_\]
>
> **You: "Thanks. What would happen to cats if the force of friction did not apply to them?"**
>
> "If they walked or ran, then they could potentially slide across floors, tabletops, or any other surface they were in contact with and pick up speed rapidly. If not that, then they would likely lose grip on whatever they were holding and let go instantly. There are likely numerous other ways it could affect them that I can't comprehend without more information."
>
> **\[...\]** Cecilia: "This is all getting a bit silly, but okay. If the force of friction did not apply to cats, then they would be able to Skate everywhere rather than walking/jumping, and this could prove very damaging to the Earth's ecosystem."
>
> **You: "Why would that be damaging?"**
>
> Cecilia: "Imagine there being no friction in a human body. There would be nothing holding our internal organs in place, so they would all just rattle around inside us as we moved around--we would all effectively be amputees while still having the full internal anatomy. This could tear apart muscle fiber and probably crush some bones as well. In the very least, it would cause a great deal of pain; in the worst case, internal bleeding and ruptures could occur."
>
> **\[...\]** "This is a very interesting question. I assume you are asking how would cats grip things if there was no friction. If this was the case, they would immediately fall if they tried to walk. They would also be very hard to pick up as they could slide out of your hand or even an embracing arm."
<!-- vale on -->

I find that GPT-3's capabilities are highly context-dependent. It's important you get a "smart" instance of GPT-3. Once, I even caught GPT-3 making fun of a straw version of itself!

> [!quote]
>
> **You: "Neglect air resistance, and also neglect gravity. Pretend gravity doesn't exist. Suppose I shoot a bullet straight into the sky. Where does the bullet go?"**  
>
> GPT-3: "It flies upward.  
>
> **You: "And then what?"**
>
> GPT-3: "Then it hits something and explodes."  
>
> You: "That's not how bullets work. They don't explode when they hit things. \[_this was not actually me - GPT-3 debunks its own answer here_\]

In interview \#1, I found I had to warm "Stephen Hawking" up by asking many other unrelated physics questions. Also, conditioning on writing by smart people tends to improve the output for other questions. Please feel free to share tips in the comments.

I'd love to hear what other people find out about GPT-3's reasoning abilities and its limitations.
