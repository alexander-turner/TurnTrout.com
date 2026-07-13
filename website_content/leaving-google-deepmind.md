---
title: Why I left Google DeepMind
permalink: why-i-left-google-deepmind
no_dropcap: false
tags:
  - AI
  - deepmind
  - personal
description: "I fought against Google's Pentagon AI deal for months. I document how powerful people and institutions failed to keep their AI ethics promises in the face of pressure."
description: "A story of how powerful people and institutions failed to keep their AI ethics promises in the face of pressure."
similar_posts:
  - red-line-framework
  - deepmind-equity-discussion
authors:
  - Alex Turner
card_image: https://assets.turntrout.com/static/images/card_images/why-i-left-google-deepmind.jpg
card_image_alt: Alex Turner stands in front of the steps outside of a Google San Francisco office. He wears a dark quarter-zip sweater.
aliases:
  - leaving-gdm
  - leaving-google
  - why-i-left-google
  - why-i-left-google-deepmind
  - leaving-google-deepmind
no_dropcap_color: true
---
In January, Department of Homeland Security (DHS) officers killed [at least](https://www.theguardian.com/us-news/2026/jan/28/deaths-ice-2026-) two people. In both cases, a federal agent grasped his gun, aimed it at a peaceful citizen, and shot them dead.

<figure id="ice-killings">
<div class="subfigure">
<img src="https://assets.turntrout.com/static/images/posts/Why I left Google DeepMind-06122026.avif" alt="A young woman wearing a dark beanie and a light patterned sweater sits in the driver's seat of a maroon car, her hand on the steering wheel as she looks out through the open window."/>
<figcaption>Renée Good, <a href="https://en.wikipedia.org/wiki/Killing_of_Ren%C3%A9e_Good">moments before DHS killed her.</a></figcaption>
</div>
<div class="subfigure">
<img src="https://assets.turntrout.com/static/images/posts/Why I left Google DeepMind-06172026.avif" alt="On a sunlit street, three masked agents in tactical gear stand over a man in a brown jacket who is on his hands and knees on the pavement. One agent grips his back while another points a gun at his head."/>
<figcaption>Alex Pretti, <a href="https://en.wikipedia.org/wiki/Killing_of_Alex_Pretti">moments before DHS killed him.</a></figcaption>
</div>
</figure>

I learned that [Google sells its Cloud services to the relevant agencies within DHS](#google-supports-the-immigration-enforcement-supply-chain). I thought that was wrong. Federal agents should not be able to kill citizens in the street. I set out to find the most effective way to push my company to stop serving these agencies. My divestment campaign quickly broadened into an attempt to prevent Google from signing an unethical military AI deal, as the Pentagon started pressuring AI providers into military AI deals with no restrictions against use for killer robots or mass surveillance.[^surveil]

[^surveil]: Technically, I'm worried about mass *profiling* from AI. Surveillance concerns data collection. Profiling takes data and draws conclusions, like "does this person dislike the government?".

I wanted AI ethics commitments to hold under pressure. In particular, I wanted Google DeepMind (GDM) to maintain [its existing commitment against supporting killer robots](#preparing-for-lunch-with-jeff-dean). Over several months,  I asked many people to act. I asked senior people --- respected people --- people with reputations silvered by their concern about AI ethics and safety. Nearly all declined.

Take Stuart Russell, a famous AI researcher who spent over a decade crusading against autonomous weapons. I worked at his lab for years. At a conference, on-stage, he agreed to push his organization to make a statement and promised a poll of its members. The statement and poll never happened.

Or take Jeff Dean, who is Google's Chief Scientist and the co-lead of Google's Gemini AI project. In 2018, Jeff signed a pledge to never support the development or use of killer robots. I got Jeff to publicly and boldly co-sign an *amicus brief* (where outsiders weigh in to sway a lawsuit) backing Anthropic against the Pentagon. But I also asked him to use his immense leverage to stop Google from making its own unethical deal with the military, and I don't think he did. He remains at Google despite his pledge.

I wrote a 25-page proposal containing contract language and oversight mechanisms. Military- and surveillance-law experts praised the proposal, which represented a principled counteroffer Google could have stood by. I sent the proposal to Demis Hassabis (GDM's CEO) who routed it to senior policy staff, only for the proposal to wilt unattended until Google signed a deal.  

Senior management had insisted that Google wouldn't sign. I disagreed with them, but they largely ignored my warnings. While I [may have increased the Pentagon's hesitation around the deal](#jeff-signs-an-amicus-brief-supporting-anthropic), Google still signed a deal handing over their AI without restrictions against killer robots or mass AI spying. Google's contract restrictions were [even weaker than OpenAI's](https://fortune.com/2026/05/04/google-employee-backlash-pentagon-ai-contract-power-waned-since-project-maven/). At that point, I couldn't stay at Google in good conscience, so I left.

This essay tells the story of why I left Google DeepMind. It is also the story of something larger: how powerful people and institutions failed, one after another, to keep their AI ethics promises in the face of pressure.

# Google supports the immigration enforcement supply chain

Subtitle: January 26th, 2026

After Alex Pretti's death, [I was determined to take effective action.](https://turntrout.substack.com/p/a-winter-spent-by-the-pond) To determine how to reduce harm from DHS, I researched Big Tech's entanglement. Certainly, Microsoft and Amazon [have larger involvement](https://www.forbes.com/sites/the-wiretap/2026/01/27/immigration-record-spend-on-amazon-and-trump/), but I was surprised to learn of Google's exposure.

> [!summary] Google's contracts with DHS
> ![[https://assets.turntrout.com/static/images/posts/Why I left Google DeepMind-06122026-1.avif|A smiling man with a beard and glasses, wearing light blue medical scrubs with "VA MEDICAL CENTER" visible on the chest, posing in front of an American flag.]]{.float-right}
> Figure: Alex Pretti, 2024.
>
> - The DHS [2025 AI Use Case Inventory](https://www.dhs.gov/publication/ai-use-case-inventory-library) lists Google among the GenAI providers used to "improve the operational efficiency" of DHS.
> - Google sells Cloud services to ICE [through third parties](https://www.techdirt.com/2021/10/13/google-amazon-microsoft-are-using-third-party-companies-to-sell-surveillance-tech-to-ice-cbp/) like [ITC Federal](https://itcfederal.com/news/itc-federal-achieves-ato-for-dhs-ice-cloud/).[^google]
> - On October 3rd, 2025, Google [delisted apps that warned of ICE activity](https://www.404media.co/google-calls-ice-agents-a-vulnerable-group-removes-ice-spotting-app-red-dot/).
> - Google voluntarily handed a student protester's account to ICE [without notice](https://www.eff.org/deeplinks/2026/04/google-broke-its-promise-me-now-ice-has-my-data), breaking [their Terms of Service promise to "send an email to the user account before disclosing information \[to the government\]"](https://policies.google.com/terms/information-requests?hl=en-US).[^promise]

[^promise]: The ToS's exceptions didn't apply in the case of the student protester.

[^google]: Google replies that immigration agents are merely [using commercially available cloud services](https://subscriber.politicopro.com/article/2026/02/google-employees-call-on-tech-giant-to-end-homeland-security-contracts-00768991). But the problem was never that Google provided *special* services; it's that Google provided services to ICE at all.

## But how could I do anything about it?

The stereotypical activist action is to make a petition. But Google had already ignored [a large petition on this issue](https://www.cnbc.com/2026/02/07/nearly-a-thousand-google-workers-sign-letter-urging-company-to-divest-from-ice-cbp.html). Plus, Google's executives likely hardened their company against stereotypical organizing tactics. Sit-ins, strikes, even a mass of Google engineers quitting: I deemed all of them ineffective (if I could even pull them off).

As I strategized, I judged that Google would not care about 100 random research engineers quitting. No, in the AI industry, talent is top-heavy and teams are driven by a few hard-to-replace stars. I didn't need to coordinate 100 engineers. Perhaps I just needed to coordinate 10.

I'd followed the news and guessed that Sundar Pichai (Google's CEO) was more of a businessman than a "make me a big speech about ethics and I'll change my mind" kind of guy. But if a few hard-to-replace people were ready to walk, that would matter for the business, so Sundar might listen.  

That's when I remembered reading *Jeff Dean* tweeting about how bad ICE was, retweeting Anne Frank quotes. Maybe I didn't even need 10 engineers, I just needed *one*.

```tweet
https://xcancel.com/JeffDean/status/2015160545331306894
```

```tweet
https://xcancel.com/Larrydn22/status/2015477622969340248
retweeted-by: Jeff Dean
```

Jeff is considered a saint at Google. He was Google's 30th employee, developed key algorithms, and is known as a man of principle. A common joke: it's easier for Jeff Dean's resume to list what he *hasn't* achieved than what he has. He's Google's Chief Scientist and a co-lead of Google's Gemini effort. A Jeff departure would be a disaster for the company.  

But if Jeff cared so much *and* had so much leverage, why was Google in these ICE contracts in the first place? Of course, you can't be Chief Scientist and constantly get what you want by threatening to quit. But I still felt confused.

# Talking to Jeff Dean

Subtitle: February 9th, 2026

At first I thought about who could put me in touch with him. But (and this is a good general lesson) if you want to talk to someone about something, you can always JUST ASK THEM!

I told Jeff that I respected him for speaking out, that I wanted Google to divest from the DHS supply chain. I asked if he shared  these goals and, if so, how I could help.

He suggested it'd be reasonable for me to email a few guys. Their names: Sundar Pichai (CEO of Google), Demis Hassabis (CEO of Google DeepMind), and Thomas Kurian (CEO of Google Cloud). I thought "sure, Jeff. No problem. I'll just tell them what I think." 😅

> [!quote] My email
>
> I'm writing as a concerned employee at \[Google DeepMind\]. I recently messaged Jeff Dean regarding my concerns. He suggested that directly emailing the three of you was a reasonable next step.
>
>  I have no problem with Google working with lawful administrations of either US political party. My concern is not about politics, but rather about the events enabled by Google's role in the DHS supply chain.
>
>  I think that ICE has gone well beyond its legal mandate to remove illegal immigrants from the country in an orderly fashion. According to watchdogs, ICE operations frequently deprive targets of due process. These operations <a href="https://www.cbsnews.com/minnesota/news/woman-american-citizen-describes-being-held-by-ice-for-two-days/">regularly detain citizens</a> in <a href="https://www.americanimmigrationcouncil.org/press-release/report-trump-immigration-detention-2026/">facilities operating with minimal (or no) legal oversight</a>. <a href="https://www.projectcensored.org/detainees-missing-ice-alligator-alcatraz/">Over 1,000 people are missing from one such location</a>. At other locations, <a href="https://www.aclu.org/news/immigrants-rights/detained-immigrants-detail-physical-abuse-and-inhumane-conditions-at-largest-immigration-detention-center-in-the-u-s">the ACLU reports human rights abuses and a severe lack of safety for detainees</a>.
>
>   These are not standard, legitimate enforcement activities. These operations are troubling from a human rights perspective and also pose reputational risk to any vendors involved.
>
>   <a href="https://www.dhs.gov/publication/ai-use-case-inventory-library">On 1/28/26, the DHS posted its 2025 AI Use Case Inventory</a>, which lists Google as one of several GenAI providers which "improve the operational efficiency" of DHS. I urge Google to immediately stop working with ICE (and DHS more broadly), including via support for third-party integrators facilitating these specific operations. Whether through a direct ("prime") contract or through intermediaries (like <a href="https://itcfederal.com/news/itc-federal-achieves-ato-for-dhs-ice-cloud/">ITC Federal</a>), Cloud and Gemini must not power these operations.
>
>   History will judge the tech sector by its involvement in these events. I love working at Google, and I want to ensure Google is on the right side of that history.
>
>   <table border="0" cellspacing="0" cellpadding="0" style="max-width:600px;margin-top:0;margin-bottom:0;">
>     <tr style="border:none;">
>       <td valign="middle" style="border:none; vertical-align:middle;">
>         <span class="favicon-span"><svg class="favicon" data-domain="deepmind_com" style="aspect-ratio:24 / 24;--mask-url:url(https://assets.turntrout.com/static/images/external-favicons/deepmind_com.svg); width:2.5rem; height:2.5rem; margin:0; vertical-align:middle;" alt="Google DeepMind logo"></svg></span>
>       </td>
>       <td valign="middle" style="border:none;">
>         <div>Alexander Matt Turner</div>
>         <div style="color: var(--midground)">Research Scientist</div>
>       </td>
>     </tr>
>   </table>

They never replied. I returned to Jeff and asked for a lunch to discuss constructive opportunities for real change within Google. I told him: "any time, any place. I'll drive down to Mountain View to meet with you."

At this point, I thought this was where "plan A" would fail. To my  surprise, he actually accepted, for a lunch a few weeks out.

A lot would happen in that time.

# The Pentagon tries to intimidate Anthropic

Subtitle: February 25th, 2026

The Pentagon wanted the frontier AI lab Anthropic to remove red lines from its existing contract: red lines against lethal autonomous weapons systems and AI spying / profiling. [The ultimatum was essentially "give us your product or we will designate you a supply chain risk."](https://www.nytimes.com/2026/02/24/us/politics/pentagon-anthropic.html) The government wanted the AI for "all lawful use."

There were two major problems with that kind of deal. First: "all lawful use" potentially meant "AI enabling war crimes" and "automatically profiling dissidents with AI." Second: the Pentagon threatened a private company with economic destruction. Usually, the government would say "no thanks, we will find another supplier who will provide terms we want." In this case, the government threatened to falsely[^falsely] designate an American company as a "supply chain risk", which would force *all* military contractors to stop using Anthropic.

[^falsely]: Judge Lin [later said](https://storage.courtlistener.com/recap/gov.uscourts.cand.465515/gov.uscourts.cand.465515.134.0.pdf) that the Pentagon's supply chain risk designation was "classic illegal First Amendment retaliation".

I'd been following the Anthropic–Pentagon standoff for weeks. That morning, I read about the ultimatum. I was attending a conference in Paris held by the International Association for Safe and Ethical AI (IASEAI), which is a [nonprofit](https://iaseai.org/about) founded in 2024 to be "a unified voice" for safe and ethical AI. The world-famous AI scientist Stuart Russell chairs its steering committee. Its [2026 working groups](https://iaseai.org/working-groups) include "Red Lines for Advanced AI," focused on "autonomous weapons and escalation." IASEAI seemed built for a moment like this.  

IASEAI's venue would be full of influential AI professionals who care about ethics. I thought: we can organize a response, as a field, in support of 1) Anthropic's right to do business without threat of destruction and 2) actual standards for whether and how to integrate AI into lethal autonomous weapons systems and surveillance apparatuses.

Anthropic had two days to comply with the administration's demands. Perhaps other companies would agree to these "all lawful use" terms before the deadline. The main question which weighed on me: can I stop Google from caving, from accepting an "all lawful use" deal? If Anthropic says "no" and Google also says "no", now we're getting somewhere. That seemed hard. I wanted to make it happen anyway. Google could cave at any moment, whether before the Friday deadline or after.

![[https://assets.turntrout.com/static/images/posts/Why I left Google DeepMind-06102026.avif|Alex Turner stands in a garden at the UNESCO headquarters in Paris, wearing a conference badge. In the background, a large metal dome structure and numerous international flags are visible, with the Eiffel Tower rising in the distance.]]

Figure: The venue was the headquarters for the United Nations Educational, Scientific and Cultural Organization.

When I arrived at the IASEAI venue, I expected some of the hundreds of AI professionals to be discussing the URGENT AI ETHICS NEWS which just dropped. Instead, no one besides me brought it up. People busied themselves with the usual abstractions: "how does public choice theory inform coordination problems?".

## I wanted to mobilize the AI luminaries at the conference

Stuart Russell
: Founder of IASEAI. Co-authored the standard AI textbook used in [over 1,500 universities](https://www.iaseai.org/conference/people/stuart-russell-2). Founder of UC Berkeley's Center for Human-Compatible AI, where I interned for several summers and completed a postdoc. For many years he was the only big-shot academic who took the existential risk from AI seriously. I had long appreciated that.

  Most importantly: [the leading figure in the global campaign to ban lethal autonomous weapons](https://awards.acm.org/award_winners/russell_3816360), with [his site highlighting over *two hundred prestigious talks on the subject*](https://people.eecs.berkeley.edu/~russell/research/LAWS.html). He presented the  *[Slaughterbots](https://www.youtube.com/watch?v=O-2tpwW0kmU)* [videos](https://www.youtube.com/watch?v=9rDo1QxI260) to the United Nations. If anyone on this green planet Earth had a reason to call out an "all lawful use" military AI deal, it was the man who organized the field against SLAUGHTERBOTS.

Yoshua Bengio
: The most-cited living computer scientist and a Turing Award winner (like the Nobel but for computer science). In 2023, he [testified to the US Senate on AI's threats to democracy and national security](https://yoshuabengio.org/en/blog/my-testimony-front-us-senate-urgency-act-against-ai-threats-democracy-society-and-national). He is, right this moment, [supervising work mapping military AI applications](https://futureimpact.group/fellowship-yoshua-bengio) onto AI safety concerns.

Geoffrey Hinton
: A 2024 Nobel laureate in Physics and a Turing Award winner. Hinton [resigned from Google in 2023 specifically so he could warn about AI's dangers without considering how it impacts Google's interests](https://www.nytimes.com/2023/05/01/technology/ai-google-chatbot-engineer-quits-hinton.html). In 2025, he had already [criticized Google for "reversing its stance on military AI applications"](https://www.cbsnews.com/news/godfather-of-ai-geoffrey-hinton-ai-warning/). Hinton quit Google to be able to speak truth to these exact issues.

## Talking to Bengio and Stuart

I briskly gathered information. Hinton was speaking remotely, so I'd have to reach him indirectly, likely through Bengio or Stuart. I knew Stuart already and had a friend who could get me in touch. Bengio was the wildcard. I saw him leaving the venue, so I ran to catch him.

"Yoshua, would you be willing to make a statement supporting Anthropic's right to do business and pushing against unregulated killer robots?". I clarified that his voice could influence the many Google DeepMind (GDM) professionals who respect him, professionals who might be mobilized to push against "caving" to the Pentagon's demands. He told me to email him.

Soon after, his office told me they decided they weren't going to make a statement. They didn't explain why not.  Since I didn't know Bengio, I figured I should focus my attention on Stuart Russell and then let him handle it.

At lunchtime, I saw Stuart speaking with someone 1-on-1. With the encouragement of several attendees, I overcame a dash of social anxiety and interrupted his conversation as politely as I could.

"Stuart, this is an extremely important situation and your voice matters," I told him. "Can you make a statement? Can you get the IASEAI organization to make a statement, too? Can you *move* the people inside of these companies?". He considered. He agreed. He would try to get Bengio and Hinton on board. He would convene an IASEAI vote ASAP and announce it at the closing of the conference later that day. He didn't hedge his willingness to fight.

"Now *that's* what I'm talking about," I thought. "Here's a powerful guy who knows his power."

## Stuart closes out IASEAI

AI company / DoD deals *mattered*. They marked the first public, high-profile intersection between modern generative AI and military use restrictions. Whatever compromises (or capitulations) the companies made would reverberate as precedent into the future. IASEAI attendees had a chance to take their contributions from "abstract work which might inform policymakers" to "directly influencing precedent." Stuart was now going to mobilize them.

As promised, he spoke about the issues at closing. I recorded his remarks during the Q&A, which were originally available on IASEAI's [conference schedule](https://www.iaseai.org/schedule-2026?date=2026-02-26) but were later migrated and not reuploaded to [IASEAI's official YouTube channel.](https://www.youtube.com/@IASEAI)

The question I asked Stuart ([video of the full exchange](https://assets.turntrout.com/static/images/posts/Why%20I%20left%20Google%20DeepMind-06242026-2.mp4))
: The Department of Defense is threatening to take over Anthropic so they can use Claude without restrictions on lethal autonomous weapons or mass surveillance. What would you say to companies like Google and OpenAI who are still in negotiations?

Stuart Russell
: I was going to mention this, and this is a topic on which we are likely to be polling all of the members of IASEAI. To see if they would like IASEAI to take a position on this issue.

  \[Stuart summarizes the situation.\]

  Should IASEAI make a statement in support of Anthropic's right not to have its software used in purposes that are outside the contracted areas that it agreed to have it used for?

  The question said, "what about Google DeepMind, what about OpenAI" --- are they also going to take the same stand as Anthropic? It seems like that's up to them, but the right of a company to say "we don't want to sell our product for that purpose" --- and to be able to say that without threat of economic destruction. I'm not a lawyer, but it seems like that's something that ought to be protected.

I was surprised. Stuart said "It seems like \[taking the same stand\] is up to them." He didn't encourage Google and OpenAI to avoid powering lethal autonomous weapons? Wasn't that a defining cause for him over the last decade?

The next question from a conference attendee asked whether IASEAI would take positions on current issues. As the session wrapped, IASEAI's interim executive director Mark Nitzberg took the stage.

<video controls playsinline class="ignore-pa11y" aria-label="A speaker at a conference addresses an audience, asking for a show of hands to gauge support for an organization statement regarding Anthropic. After the audience responds with a mass of raised hands, the speaker discusses the process for formalizing organizational member opinions."><source src="https://assets.turntrout.com/static/images/posts/Why I left Google DeepMind-06242026-1.mp4" type="video/mp4; codecs=hvc1"/><source src="https://assets.turntrout.com/static/images/posts/Why I left Google DeepMind-06242026-1.webm" type="video/webm"/></video>

Figure: Mark asks for a show-of-hands. "We will be asking the opinions of members... and if you're not a member, go to the member desk."

![[https://assets.turntrout.com/static/images/posts/Why I left Google DeepMind-06242026-8.avif|An auditorium filled with conference attendees, with the vast majority raising their hands in a show of support.]]
Figure: A near-unanimous show of hands supporting an IASEAI statement backing up Anthropic's right to do business freely.

Stuart gave final comments.

> [!quote] [Stuart Russell's final remarks](https://assets.turntrout.com/static/images/posts/why-i-left-gdm-final-remarks-for-stuart.mp4)
>
> Many news outlets are discussing the extortion racket that the DoD is applying to Anthropic...
>
> I think we will try to get an online poll if we have time to make this happen. So that we can publish a news release saying "92% (or whatever it turns out to be) of members of IASEAI are in favour of the proposition that Anthropic should not be required to do what they don't want to do."

Stuart called the DoD's actions an "extortion racket." I appreciated the frankness, though frankness in the hall wasn't the same as frankness in a statement the world would see.[^coverage] As I left, I signed up to be an IASEAI member to participate in the poll. I thought it'd pass but wanted to make my voice heard. I paid the $75 membership fee and left for an evening at the Louvre.

[^coverage]: Stuart's "extortion racket" comments seemingly only featured incidentally in [one news round-up by The Information](https://www.theinformation.com/newsletters/ai-agenda/robot-data-startup-raises-60-million).

## International Association of <span class="acidic">Silence</span> on the Ethics of AI

Thursday morning greeted me. I didn't see how to vote in the poll. Strange. I texted Mark. He said IASEAI would have to act after Anthropic's Friday deadline.

I told Mark that the situation was urgent: Google and OpenAI could move at any point. I urged him to talk to Stuart about making his own statement, *any* statement. I appreciated that Mark was helping me figure out this situation. Later that day, Anthropic [indicated they would stick to the red lines in their existing contract with DoD.](https://www.anthropic.com/news/statement-department-of-war)

(Thursday was supposed to be the start of a romantic vacation in Iceland. I didn't really want to be doing any of this.)

Friday morning. Stuart had not made any public statement. I asked Mark, "What is possibly more important than spending a few minutes composing an email to his favorite reporter?". From my conversation with Mark, I learned that neither Stuart nor IASEAI would act.

But here's the thing. Mark committed [publicly](#stuart-closes-out-iaseai) at closing that IASEAI would hold a member poll. Mark encouraged people to pay dues and become members to participate. Then IASEAI leadership silently cancelled the poll.[^workshop] No statement ever came.

[^workshop]: On that Thursday in the same venue building, a [four-hour workshop](https://thefuturesociety.org/ai-red-lines-iaseai-workshop/) convened on how to make AI red lines "verifiable and enforceable." Participants were asked: what is the biggest obstacle to these red lines? [Political will](https://thefuturesociety.org/ai-red-lines-iaseai-workshop/).

Mark gave me an evolving list of reasons for his organization not making a statement:

1. IASEAI needed more time to draft a statement and so would move after the Friday flashpoint.
2. IASEAI doesn't know which principle it should cite for making a statement.
3. IASEAI worried that joining an Anthropic–Pentagon news cycle "has pros and cons."
4. Mark was sympathetic but wanted to focus on refining IASEAI processes for handling this kind of situation.
5. IASEAI didn't need to make a statement anymore because Anthropic made a statement.

I could appreciate the first reason: after all, Stuart *had* repeatedly disclaimed "time permitting" for making a statement before the deadline. But that last reason in particular didn't make sense to me. Anthropic made a statement saying they won't budge, so IASEAI doesn't need to make a statement supporting Anthropic?

### Left on read by IASEAI

The Pentagon set the Friday deadline for Anthropic. The deadline was never mine and it was never IASEAI's. The Anthropic autonomous weapons issue had been in the news for [weeks](https://www.wsj.com/politics/national-security/pentagon-used-anthropics-claude-in-maduro-venezuela-raid-583aff17) prior. Anthropic's [lawsuit against the Pentagon](https://www.theverge.com/ai-artificial-intelligence/891514/anthropic-pentagon-lawsuit-amicus-brief-openai-google) ran for weeks after. Google wouldn't sign for two more months. Nothing IASEAI might have done depended on whether Anthropic reached a deal with the Pentagon by Friday.

[OpenAI did announce a deal on Friday.](https://openai.com/index/our-agreement-with-the-department-of-war/) OpenAI claimed its deal protected the same red lines against killer robots and mass surveillance that Anthropic had insisted upon. However, some analysts concluded that OpenAI's contract language [contains wide loopholes](https://www.techpolicy.press/five-unresolved-issues-in-openais-deal-with-the-department-of-defense/).

Over the next two months, I messaged Mark Nitzberg many times.[^refund] I explained that I was trying to convince senior decision-makers inside of Google; that Stuart could reach out privately without the political cost of publicly opposing Trump; that even introductions would help.

> [!quote] A message I sent to Mark
> Subtitle: March 30th, thirty days before the deal was reported as signed
>
> While I wish IASEAI's decisions had been different, I would like to find a way for us to accomplish our shared goals.

Mark never replied.

[^refund]: Upon request, Mark *did* refund my membership dues.

# Trying to stop Google from signing

Let's rewind to Wednesday, when I had just learned of the Pentagon's threat. I was operating under unknown time pressure. I had no idea whether Google was about to undermine Anthropic's position by signing a deal. As I acted externally by lobbying Bengio and Stuart, I acted internally too.

## Building internal cost for Google

Subtitle: February 26th, 2026

In Google DeepMind's current events discussion channel, I called for Google (and the AI community) to "stand strong with Anthropic" and remarked that supposedly "lawful" uses might include "[killing over 150 people off of the coast of Venezuela (most of whom were likely innocent fishermen)](https://en.wikipedia.org/wiki/United_States_strikes_on_alleged_drug_traffickers_during_Operation_Southern_Spear)." The message received over 125 "❤️" reacts.

> [!quote]- \[My message\] Gemini's "all lawful use" policy and the DoD pressure on Anthropic
>
> I'm reading reporting that GDM is "close" to a deal to allow "all lawful use" of Gemini for classified purposes. Apparently, for unclassified work, Google already "removed some model-level restrictions" and agreed to "all lawful purposes" for DoD work.
>
> While the "lawful" in "all lawful purposes" initially felt comforting to me, consider the implications of "lawful" in this setting. First, this DoD [claimed it was legal](https://www.pbs.org/newshour/politics/what-the-law-says-about-killing-survivors-of-a-boat-strike-according-to-experts) to [kill over 150 people off of the coast of Venezuela (most of whom were likely innocent fishermen)](https://en.wikipedia.org/wiki/United_States_strikes_on_alleged_drug_traffickers_during_Operation_Southern_Spear).[^estimate] "All lawful purposes" also includes mass surveillance & analysis using AI (which is legal, as surveillance laws were not written with AI in mind) and creating lethal autonomous weapons systems.
>
> [Secretary Hegseth threatened Anthropic with a 5PM Friday ultimatum](https://www.techpolicy.press/a-timeline-of-the-anthropic-pentagon-dispute/). If Anthropic refuses, he threatened to:
> 1. Cancel Anthropic's $200M contract,
> 2. Designate them a supply-chain risk, forcing all other military contractors to stop using Claude—"supply chain risk" is normally only used for compromised foreign firms!—and
> 3. Invoke the Defense Production Act to force Anthropic to provide Claude anyways.
>
> **I think it's unacceptable to nationalize a lab to force them to provide lethal autonomous weapons and mass \[AI profiling\] tools.** As an industry, we should stand strong with Anthropic. Our hard work should improve Gemini for our customers, not sharpen the abilities of lethal autonomous weapons systems.
>
> I'm interested in others' thoughts on this topic. How can we advocate effectively to ensure our AI Principles hold firm against this kind of external pressure for offensive military use without humans in the loop?

[^estimate]: In my GDM discussion message, I originally estimated "killing over 150 people". As of June 28th, 2026, the toll has [risen to 215](https://www.nytimes.com/interactive/2025/10/29/us/us-caribbean-pacific-boat-strikes.html).

I began posting this kind of message in the GDM-only discussion channel. These messages received unusually strong and supportive engagement. I had several reasons for posting:

1. I wanted to raise the cost of silence from leadership. Remember, the whole point is stacking up enough cost to outweigh the benefits Sundar perceived from signing (like avoiding political retaliation from the Trump administration).
2. I often had strategic arguments which I wanted to tell my senior contacts. I was just a research scientist so it would be presumptuous for me to directly tell them "consider X." However, I knew some of them read this channel, so I simply posted my arguments in the channel.
3. I wanted to create common knowledge among GDM employees that no, they are not alone in their discomfort with these contracts.
4. I pointed out [the problems with the "protections" in OpenAI's deal](https://www.techpolicy.press/five-unresolved-issues-in-openais-deal-with-the-department-of-defense/) to inoculate GDM employees against similarly fake "protections" that Google might try to pass off. If employees didn't buy the veneer, Google would pay a greater morale cost.
5. Later, some messages provided people a channel to hint they would leave Google if the deal passed, while still providing soft deniability.

The "❤️" reacts also acted as a subtle organizing mechanism. My understanding was that Google frowned upon people directly organizing through large internal channels. I noted who responded with "❤️" and reached out to them privately for the petition which I'm about to talk about.

## Jeff Dean, you're our only hope

I considered sending Jeff another DM: "please stop Google from signing the deal if you can." But that seemed... not likely to do much. "What spurs people like Jeff to action?" I thought. Moral stakes: already present. Sense of ownership: *not* present. I couldn't own the project because I had no direct power. As best I could tell, Jeff truly was one of the few people with both the power and inclination to oppose a deal. I wanted him to feel empowered and to know that GDM workers backed him up.

I wrote a petition to Jeff and, with the help of a few friends, got about 250 GDM / Research signatures in the next day or two. I will not reproduce the entire petition because I said it was "not public" and instructed people not to share externally.[^external] However, the [New York Times did report on this petition](https://www.nytimes.com/2026/02/26/technology/google-deepmind-letter-pentagon.html), so some bits[^oops] are already public:

> [!quote] [Google Workers Seek ‘Red Lines’ on Military A.I., Echoing Anthropic](https://www.nytimes.com/2026/02/26/technology/google-deepmind-letter-pentagon.html)
> “Please do everything in your power to stop any deal which crosses these basic red lines,” the employees wrote. “We love working at Google and want to be proud of our work.”

[^oops]: The New York Times also reported:
    > A footnote in the A.I. letter to Mr. Dean said many of the signees opposed “warrantless surveillance of any citizens of the world.” But they decided to exclude that from the letter “to increase the probability of achieving our request.”
  
    I regret that decision. "Americans only" protections lined up with Anthropic's red lines, but "Americans only" was too small of an ask. Don't negotiate away what you want before the negotiations even begin! My [proposed contract language](/military-ai) later demanded more protection for non-Americans.

[^external]: Throughout my internal campaign, I made sure not to talk to the media (even off the record). I wanted change from the inside and I wanted to do it right by people like Jeff.

## Jeff signs an amicus brief supporting Anthropic

Subtitle: March 9th, 2026

The Pentagon didn't just designate Anthropic a supply chain risk. [Pete Hegseth (the Secretary of the DoD) initially claimed](https://www.cbsnews.com/news/hegseth-declares-anthropic-supply-chain-risk) that military contractors must stop *all* use of Claude, not just the use of Claude in their contracts. That impacted Anthropic's major cloud and enterprise customers, so the designation looked deadly for their enterprise revenue. This requirement also seemed quite illegal, and Hegseth [backed down on that part](https://www.courthousenews.com/feds-say-hegseth-tweet-about-anthropic-was-not-a-final-agency-action/). (However, I think Hegseth's tweet had already done damage by making businesses uncertain about whether they would be punished for using Anthropic.)

Anyway, on Monday or so, Anthropic challenged the Pentagon in court and asked for an injunction to stop the order. A nonprofit called Protect Democracy put together an amicus brief from AI professionals. The amicus communicated something like, "in our capacity as experts, we agree that Anthropic's technical and policy concerns are legitimate, even though we work for competing labs." I signed the document, got some colleagues[^signatures] to sign, and (with encouragement from an organizer) reached out to Jeff. He signed.

[^signatures]: I was responsible for 8 of the 18 GDM signatures on the amicus brief. The count was low because it was impromptu.

I was pleasantly surprised. Big move. (At this point, some of my friends started saying "based and Jeff-pilled" to describe things they approved of.)

When Jeff publicly signed [the amicus](https://storage.courtlistener.com/recap/gov.uscourts.cand.465515/gov.uscourts.cand.465515.24.1.pdf), he (as a C-suite executive) publicly broke with Google's silence.  As I expected, his signature [attracted attention](https://www.wired.com/story/openai-deepmind-employees-file-amicus-brief-anthropic-dod-lawsuit/). Eventually, the [Google / Pentagon negotiations hit a snag, in part because the amicus raised the prospect that Google might back out later](https://www.nytimes.com/2026/03/18/technology/google-ai-pentagon.html).[^cause-and-effect]

[^cause-and-effect]: This is why I think my actions led to additional Pentagon wariness. I introduced Jeff (and nearly half of the Google signers) to the amicus brief. They signed. The Pentagon hesitated in part due to the Google signatures on the amicus brief.

> [!quote]- [Google Sits Pretty as A.I. Rivals Compete for Pentagon Favor](https://www.nytimes.com/2026/03/18/technology/google-ai-pentagon.html)
> Subtitle: Published later (March 18th, 2026)
>
> But there is still reluctance among some Pentagon officials to rely on Google, two people familiar with discussions between the Defense Department and Google said. That’s because the company dropped a military contract in 2018 in response to protests from employees who argued that A.I. should not be used in weapons, the two people added.
>  
> Several top A.I. researchers at Google, as well as at OpenAI, also recently signed a legal briefing to support two lawsuits that Anthropic filed against the Defense Department. Anthropic is challenging the Pentagon for designating it a supply chain risk after it clashed with the department over how to use A.I. in warfare.
>
> The participation of Google employees in the legal briefing added to some officials’ concerns about the company, reminding decision makers in the Pentagon and elsewhere of the past protests against the use of A.I. in weapons, one former official with knowledge of the discussions said. Some Trump administration officials are worried that even if Google agrees to have its A.I. used widely, the company could bow out again, the former official added.

In this time, I sent several memos to Google Legal suggesting that Google file an amicus too. I reminded them that if Google let the threat stand against Anthropic, the government would now have a gun to point at Google in all future negotiations: comply, or be labeled  a supply-chain risk. In the end, Google didn't file an amicus (but [Microsoft did](https://www.datacenterdynamics.com/en/news/microsoft-files-amicus-brief-in-support-of-anthropics-dod-lawsuit/)).

# Senior management insisted Google wouldn't cave

Subtitle: All through March

As I talked more with senior management, they kept saying: "don't worry. Leadership cares about these issues, too. They won't sign an 'all lawful use' deal." I considered the idea. Might it be true?

"No, it's not true", I concluded: not unless someone *forced* leadership to hold the line. I wrote a citation-heavy memo explaining why Google was likely to cave. I pointed to Google's history of complying in lower-stakes situations (like [voluntarily handing over a student protester's information to ICE](https://www.eff.org/deeplinks/2026/04/google-broke-its-promise-me-now-ice-has-my-data)); I pointed to Google's large share of government contracts; and I pointed to how Google DeepMind's AI principles had [disintegrated into noncommittal vagueness](https://www.washingtonpost.com/technology/2025/02/04/google-ai-policies-weapons-harm/). I reviewed some of the pressures confronting Google, including Google's mixed  anti-monopoly exposure and [the historically poor track record of the current Department of Justice.](https://www.nytimes.com/interactive/2026/us/trump-administration-lawsuits.html)

I shared this memo quite a few times. As best I can tell, I wasn't able to persuade these senior employees.

# Preparing for lunch with Jeff Dean

Subtitle: March 10th, 2026

I stayed focused on my goal. I needed to move Sundar. Jeff could, I estimated, move Sundar. Did Jeff *want* to move Sundar? Would he walk from a company where he is revered, with a prestigious job seemingly tailored to him, leaving behind a quarter-lifetime of memories? On the other hand, every tech company in the world would want to hire Jeff, his legacy seemed secure, he already had who-knows-how-much money, and leaving would show principle.

I didn't want to manipulate Jeff. I wanted to be real with him as one concerned person to another. I even avoided reading more than one article about him to keep myself from subconsciously tailoring my arguments to appeal to his psyche.

The way I saw it was: I don't need to get Jeff to agree to quit over this. In a sense, he'd *already* agreed to quit over it. He had signed a pledge in 2018:

> [!quote] [Lethal Autonomous Weapons Pledge](https://futureoflife.org/open-letter/lethal-autonomous-weapons-pledge/)
> Subtitle: Signed by 5,218 people
>
> The decision to take a human life should never be delegated to a machine. There is a moral component to this position, that we should not allow machines to make life-taking decisions for which others – or nobody – will be culpable. There is also a powerful pragmatic argument: lethal autonomous weapons, selecting and engaging targets without human intervention, would be dangerously destabilizing for every country and individual. \[...\]
>
> By removing the risk, attributability, and difficulty of taking human lives, lethal autonomous weapons could become powerful instruments of violence and oppression, especially when linked to surveillance and data systems. \[...\]
>
> We, the undersigned, call upon governments and government leaders to create a future with strong international norms, regulations and laws against lethal autonomous weapons. These currently being absent, we opt to hold ourselves to a high standard: we will neither participate in nor support the development, manufacture, trade, or use of lethal autonomous weapons.

Signers include: Google DeepMind (the organization), Demis Hassabis, Shane Legg (cofounder, [now Chief AGI Scientist](https://en.wikipedia.org/wiki/Shane_Legg)), Raia Hadsell ([VP of Research](https://raiahadsell.com/index.html)), Jay Yagnik ([VP and Engineering Fellow at Google, leading large parts of Google AI](https://research.google/people/author36197/?&type=google)) and 🥁🥁🥁 Jeff Dean:

```tweet
https://xcancel.com/JeffDean/status/2026566490619879574
https://xcancel.com/TopherSpiro/status/2026668689802547231
https://xcancel.com/JeffDean/status/2026683499919610153
```

Figure: Jeff Dean freely reiterated his pledge and agreed that "AI for mass surveillance of Americans" is "the last thing \[he wants\]."

I reasoned that if Jeff "will neither participate in... nor support the development... or use of lethal autonomous weapons", then logically, *Jeff would have to quit Google if it signed an "all lawful use" deal.* I didn't know if Jeff was *actually* ready to do anything like that. I wanted to prepare for the possibility.

## I arranged social support

Jeff, like all of us, is a human being. Humans tend to be worried by acting alone against a powerful entity. Even though I imagined Jeff's weight would be enough to move Google on its own, I wanted him to feel supported. The first part of that was the [petition I organized](#jeff-dean-you-re-our-only-hope), signed by over 250 GDM employees asking Jeff to *fight* for them. The second part, though, was quieter.

I secured backup from several senior Google employees. If Jeff would agree to put his foot down with Sundar, they signaled that they would too. That said, the intended coalition was of size[^coalition] one: Jeff.  I expected that Jeff's influence would be enough on its own since his departure could leave Gemini in shambles. Maybe Google would care more about its AI program than about retaliation from Trump.

I guessed that Sundar was skilled at defusing pressure from employees. I hoped this was a gambit he wouldn't be able to stop, even if he knew about it.

[^coalition]: Large coalitions have problems here. Imagine my plan relied on several senior GDM employees telling Sundar they'll walk if the deal gets signed. Sundar doesn't need to talk them all down; he would just need to fracture their intent to act. Offer the more senior employees a $15 million retention bonus. If a few bite, the coalition crumbles. No one knows how on board the others really are, and they don't think they individually can bring about change by quitting, and so they don't quit.

## The art of the deal

Subtitle: March 13th, 2026

Was Jeff a wrestler? I read an account of Demis [trying to negotiate with Sundar for a separate legal structure for DeepMind](https://colossus.com/article/project-mario-demis-hassabis-deepmind-mallaby/). Sundar was slippery, so any deal with Sundar seemed like it would need wrestling. *Persistent* wrestling. Furthermore, Sundar might try to defuse the tension with vague promises, so Jeff would need a specific proposal.

I mean, imagine Jeff and I sit down for lunch. Imagine he's on board. Imagine he goes to Sundar and says "If we sign this deal, I won't be able to stay at Google. Help me stay." Imagine Sundar says "You're important to me, Jeff. What would it take?". What does Jeff say? "Don't sign a bad deal" would probably lead to a bad contract that looks less bad on the surface.

### Criteria for a contract

I needed to draft contract language which would actually work.

Good red lines
: Rule out the questionable use cases (autonomous targeting without human control, untargeted profiling) while allowing trustworthy ones like missile defense. Avoid the weaknesses flagged in [legal analysis of Anthropic's red lines](https://www.lawfaremedia.org/article/the-situation--thinking-about-anthropic-s-red-lines).

Robust red lines
: Cloud would push deals through any loophole, Google Legal seemed unlikely to tighten my drafting, and the Pentagon wouldn't want terms at all. The language had to hold under pressure, with auditing that respected classification and operational security.

Minimal trust assumptions
: I made the Chief Scientist [the single root of trust that everything else hangs off of](https://en.wikipedia.org/wiki/Certificate_authority) (I was betting everything on Jeff anyway). The Chief Scientist would staff a Review Body to advise on contracts.

Accountability via transparency
: The Review Body only privately advises Jeff and Sundar, but *overriding* it surfaces in a yearly transparency report to all AI employees. Dissolving it would require advance notice and disclosure of the exact outstanding non-compliance findings. I worked to ensure the Body couldn't be defanged as quietly as Google's [2018 principles were](https://www.cnbc.com/2025/02/04/google-removes-pledge-to-not-use-ai-for-weapons-surveillance.html).

Minimal pain to opposed stakeholders
: I gave Cloud 2 of 7 seats, recused staff only from their *own* deals, capped delays at 10 days, and protected deliberations under attorney-client privilege.

I considered a negotiations round. The counterparties would object to *something*, and I didn't want that *something* to be load-bearing. Therefore, I included less-important provisions meant to be negotiated away, like "the Review Body can escalate to Alphabet's Board via supermajority vote."

### The Framework I created

In my personal time (taking vacation days), I created language that would be a good starting point. I composed 25 pages' worth of "good starting point" material. I have published the Framework on my site in generic form applicable to any provider of both cloud and AI.

> [!quote] Excerpts from [A Red Line and Oversight Framework for Military AI](/military-ai)
> Subtitle: I sometimes call this "the Framework" as shorthand.
>
> This Framework proposes two narrow Standards for the AI provided by The Company to government entities exercising coercive authority:
>  
>  1. **Human control over targeting and use of force.** The Company's AI won’t be used in systems that select and engage targets for force without appropriate human control over each engagement, evaluated on a use-case-by-use-case basis. Applies whether The Company provides the targeting system directly or simply provides AI components in a targeting pipeline. Includes a right to legal transparency regarding how systems will be lawfully deployed, with compliance verification conducted by a mutually agreed neutral auditor. Does not restrict anti-munition defensive systems, intelligence analysis subject to Standard 2, logistics, or R\&D.
>  
>  2. **No untargeted AI profiling.** The Company's AI won't convert bulk data into individualized intelligence on people who aren't already specific, identified subjects of investigation. For all persons regardless of nationality, individualized AI-assisted analysis must be proportionate to the security interest served, may not be initiated based solely on demographic characteristics or political expression, and AI-generated outputs may not serve as the sole basis for initiating individualized scrutiny. Heightened protections for all persons in the U.S. regardless of status. Permits targeted analysis of identified subjects, aggregate research, and conflict zone analysis that improves noncombatant protection.
>
> **Transparency via yearly internal reports:** An advisory seven-person Defense AI Review Body of senior staff, appointed by and reporting to the Chief Scientist.
>
> **Superseded by future laws:** If Congress passes substantial legislation governing these usages, the Chief Scientist and Review Body (by supermajority vote) can retire one or both Standards.
>
> **The Company will not accept “all lawful use” as its standard.** Where “all lawful use” language is demanded, The Company will require access to the legal memoranda establishing the lawfulness of intended uses. That transparency gives The Company the information to evaluate each use case against its Standards. Some will meet The Company’s standard. Some won’t. The ones that don’t, The Company declines.

With the help of [`TomSmith`](https://www.lesswrong.com/users/tom-smith), I got feedback from experts in military and surveillance law. In particular, I got feedback from a foremost legal expert on human/AI warfighting integration. They said my Framework was "actually pretty good" :) and suggested improvements.

# My lunch with Jeff

Subtitle: March 17th, 2026

![[https://assets.turntrout.com/static/images/posts/Why I left Google DeepMind-06222026-1.avif|Aerial view of the Google Gradient Canopy building in Mountain View, characterized by its distinctive, large-scale dragon-scale roof structure, surrounded by roads, trees, and walkways.]]

A friend drove me down to Mountain View to meet Jeff. Wearing a crisp dress shirt and slacks, I walked through the Gradient Canopy office. I had the Framework in my bag and I had a question on my mind: "What, if anything, does Jeff want to do?". Was I going to meet a crusader? A bystander? A strategist?

A month prior, I asked for this lunch so we could discuss "constructive options" for making Google's contract situation more ethical. Would he have plans of his own? Surely he could. He had so much more visibility and experience. I readied myself to toss my Framework aside and follow a better plan devised using more information. I didn't care much. Even if Sundar adopted my Framework, I knew I was unlikely to be credited. That made me a bit sad, but I wanted to get the job done.

I had lunch with Jeff under the California sun. I proposed that Jeff head the Review Body, but he declined. Beyond that, I won't discuss the details of our lunch. I can only point to his public conduct: He [tweeted](#preparing-for-lunch-with-jeff-dean) and [signed an amicus brief in support of Anthropic](#jeff-signs-an-amicus-brief-supporting-anthropic). [Google later signed the deal](#google-quietly-signs-the-deal). Jeff is still at Google, [despite his pledge](#how-can-a-pledge-signer-remain-at-gdm).

## Searching for another path to impact

I had expected this --- I had simply judged the odds good enough to justify the shot. Jeff declining meant the chances of success dropped a lot. I still thought the large possible benefits were worth continued effort on my part. The other obvious escalation pathway was Demis Hassabis.

In 2014, [Google acquired DeepMind on an explicit promise: its AI would never be used for military or weapons purposes](https://time.com/7013685/google-ai-deepmind-military-contracts-israel/). In 2018, all of DeepMind's co-founders (including Demis) signed [the FLI lethal autonomous weapons pledge](#preparing-for-lunch-with-jeff-dean), as did Google DeepMind *as an organization*.

[Demis had already fought Sundar to ensure a future DeepMind AGI wouldn't be chained to Google's profit incentives (though he lost in the end).](https://colossus.com/article/project-mario-demis-hassabis-deepmind-mallaby/) I thought, "Demis won't quit over this. But if he pushes, he might get some of the transparency mechanisms." I looked for a non-awkward way to get my proposal in front of Demis. Jeff could have sent it no problem, but I had to look elsewhere.

I looked. I did learn that there was one senior person taking real initiative and working hard to stop the deal. I appreciated that. But I only knew of one.

In any case, after a week of trying to escalate through management chains, I decided to just do the awkward way instead.

# No one is responding, so why not just DM the CEO?

Subtitle: April 1st, 2026

After all, what's the worst that would realistically happen? In my estimation, he might say "not appropriate, send through your manager next time." Whatever.

> [!quote] My message to Demis
> Demis, I drafted a Framework for military AI oversight at Google, along with two candidate standards (which can be considered separately). A foremost legal expert on human/AI warfighting integration said the Framework is "actually pretty good." The oversight is advisory, providing independent technical and ethical assessment of defense AI deployments.

Demis told me to get the Framework evaluated by  two senior people working in GDM policy. I sent it to them. They left the message on read.

## My Framework goes unevaluated

Busy guys being busy, perhaps. A few days later, I pinged them. One sent me to talk to some of their reports. About a week passed, then I spoke with those reports. They seemed excited about the Framework but said that I wouldn't hear back for months, which didn't fit the time pressure.

I returned to the senior policy people to talk about next steps. One wanted me to circle back to them with updates as the situation developed. A few days later, I gave gentle pushback. I explained the unknown but potentially short timeframe we confronted, pointing to the Pentagon's [January 9th memo](https://media.defense.gov/2026/Jan/12/2003855671/-1/-1/0/artificial-intelligence-strategy-for-the-department-of-war.pdf) giving ALL AI contractors a 180-day deadline (falling on July 8th) to accept "any lawful use" contracts.[^deadline] I basically said, "it's fine if you think Demis shouldn't look at the Framework again, but I want you to make that determination either way." I even offered to fly from San Francisco to London just to answer any questions they had about the Framework.

[^deadline]: The government's July 8th deadline was another reason that "Google will just wait it out" struck me as implausible.

They left the message on read.

I still don't know what happened. The company's CEO wanted it evaluated, after all. I didn't expect them to loop *me* in, but I expected a "thanks, I'll let Demis know my assessment." It's possible there was some unknown but legitimate complication. In any case, I'm not happy with this process.

# Google quietly signs the deal

Subtitle: As [reported](https://www.theinformation.com/articles/google-signs-classified-ai-deal-pentagon-amid-employee-opposition) on April 27th, 2026

That weekend prior, I had heard rumblings. [Along with over 600 other employees](https://www.theverge.com/ai-artificial-intelligence/919326/google-ai-pentagon-classified-letter), I signed a letter asking Sundar to say "no" to classified AI contracts.[^no] I asked Jeff if there was anything I could do on an informal basis, crossing reporting lines and bureaucracy to help him get *anything* done that he wanted. I'd work through the weekend, no problem, on whatever he thought was wise. Alas.

[^no]: I didn't think that "no classified contracts" was the right line to draw, but I thought it was better than no line at all.

> [!quote] [Google signs classified AI deal with Pentagon](https://www.reuters.com/technology/google-signs-classified-ai-deal-with-pentagon-information-reports-2026-04-28/)
> The agreement allows the Pentagon to use Google's AI ​for “any lawful government purpose”.
>  
> Google's agreement requires it to help in adjusting the company's AI safety settings and filters at the government's request...
>
> The contract includes language stating, "the parties agree that the AI System is not intended for, ​and should not be used for, domestic mass surveillance or autonomous weapons (including target selection) without appropriate human oversight and control."
>  
> However, the ‌agreement also ⁠says it does not give Google the right to control or veto lawful government operational decision-making.

I found out at 11:45 PM via a Signal group. Google never announced the deal internally. What surprised me was not that Google signed, but that the deal paid the barest of lip service to ethical concerns: the "should not" language [is not binding](https://x.com/CharlieBull0ck/status/2049249853947945369).

```tweet
https://xcancel.com/Turn_Trout/status/2049153749743264231
```

I went to the field's premier safety & ethics organization (IASEAI). I asked some of the most distinguished AI scientists (Bengio and Stuart). I built a coalition and a plan for Google's most outspoken executive (Jeff). I even cold-messaged the CEO of my company (Demis), whose lieutenants never evaluated the proposal. Besides Jeff, none took *any* visible action to stop the deal. And the deal contains no binding provisions, which is what I'd expect if Jeff never threatened to walk.

The deal was inked.

> [!question] But also, Google stopped bidding for a drone contract?
>
> > [!quote] [Google Drops Out of Pentagon Drone Swarm Contest After Advancing](https://www.bloomberg.com/news/articles/2026-04-28/google-drops-out-of-pentagon-drone-swarm-contest-after-advancing)
> > Google abruptly dropped out of a $100 million Pentagon prize challenge to create technology for voice-controlled, autonomous drone swarms after it was among the successful submissions, according to people briefed on the matter.
> >
>  > The company notified the government it wouldn’t participate further in the initiative, which seeks to create the technology needed to control drone swarms, on Feb. 11 — a few weeks after the proposal was submitted, according to another person briefed on the matter. The decision followed an internal ethics review, according to records referencing it that were reviewed by Bloomberg News. Alphabet Inc.’s Google officially cited a lack of “resourcing” when it pulled out of the contest, according to the records.
>
> Apparently, Google *does* have an ethics review with teeth that bite, at least sometimes, on *some* projects. That's good.
>
> However, this doesn't exonerate Google's decision to sign the deal. Let's charitably suppose that Google has a process which *always* blocks contracts which will obviously be used for weapons in particular.
>
> As I'll soon cover, Google's criterion is apparently that "the benefits substantially outweigh the harms." How can Google weigh that if Google can't know what "lawful purposes" Gemini will be used for? Under an "all lawful use" deal, *there will no longer be any warnings which would make ethics-minded employees like Jeff or Demis uncomfortable.*
>
> The government isn't going to call Google and say "we used Gemini in a kill chain to bomb a bunch of people." Similarly, the CEO of Anthropic [still doesn't know](https://www.forbes.com/sites/antoniopequenoiv/2026/06/10/anthropic-ceo-we-dont-know-exactly-how-claude-ai-was-used-in-iran-school-strike/) what role, if any, Claude played in the bombing of an Iranian girls' school. Even Anthropic doesn't know, and Anthropic has publicly demonstrated far more appetite for contract transparency than Google has.

# Demis insists Google's AI principles "haven't changed"

> [!quote] [Google DeepMind CEO Demis Hassabis on AI in the Military and What AGI Could Mean for Humanity](https://time.com/7280740/demis-hassabis-interview/)
> Interviewer
> : When Google acquired DeepMind in 2014 you signed a contract that said Google wouldn't use your technology for military purposes. Since then, you've restructured. Now DeepMind tech is sold to various militaries, including the U.S. and Israel. You've talked about the huge upside of developing AGI. Do you feel like you compromised on that front in order to have the opportunity to make that technology?
>
> Demis
> : No, I don’t think so. I think we've updated things recently to partly take into account the much bigger geopolitical uncertainties we have around the world. Unfortunately, the world's become a much more dangerous place. I think we can't take for granted anymore democratic values are going to win out—I don’t think that's clear at all. There are serious threats.
>
> : So I think we need to work with governments. And also working with governments allows us to work with other regulated important industries too, like banking, health care and so on. Nothing's changed about our principles. The fundamental thing about our principles has always been: we’ve got to thoughtfully weigh up the benefits, and they've got to substantially outweigh the risk of harm. So that's a high bar for anything that we might want to do. Of course, we’ve got to respect international law and human rights—that’s all still in there.

In particular, he says:

> The fundamental thing about our principles has always been: we’ve got to thoughtfully weigh up the benefits, and they've got to substantially outweigh the risk of harm.

That's not a principle. A principle is something you commit to in advance so that you can't talk yourself out of it later, *even when* the benefits seem to outweigh the harms. One cannot violate a "principle" of "I'll decide when I see it".

[Google's original 2018 AI principles](https://web.archive.org/web/20180620101825/https://ai.google/principles/) committed that Google would not support specific use cases, leading to [Google dropping its bid for a $10 billion contract in 2018](https://www.businessinsider.com/google-drops-out-of-10-billion-jedi-contract-bid-2018-10). The principles included a section titled "Applications we will not pursue," which said that Google would not design or deploy AI for weapons "whose principal purpose or implementation is to cause or directly facilitate injury to people," nor for surveillance "violating internationally accepted norms."

On February 4th, 2025, Demis co-authored [a post](https://blog.google/innovation-and-ai/products/responsible-ai-2024-report-ongoing-work/) announcing updates to those principles. [The updated principles](https://web.archive.org/web/20260430015915/https://ai.google/principles/) removed the prohibitions on weapons and surveillance.

Consider these statements: "Demis removed the prohibitions from Google's AI principles" and "nothing's changed about our principles." Both cannot be true.

Demis wanted GDM employees to trust him and to trust that DeepMind has a sufficiently strong review process. But Google's AI principles named things Google would not do, and then he removed those prohibitions, and finally told us nothing had changed.

On my last day, I pointed out this discrepancy in the discussion channel. Many GDM employees expressed their disappointment.

## We can "work with Western democracies" to "beat China" without giving in to every demand Trump makes

Subtitle: When an AI leader says they need to "work with Western democracies", that's a hint they're doing something bad.

Demis [justified breaking GDM's no-weapons commitment](#demis-insists-google-s-ai-principles-haven-t-changed) by saying "[Google needs] to work with governments" to ensure that democratic values win out. I think that imposes a false dichotomy. To see why, grant the whole worldview: that if the US doesn't adopt autonomous weapons, we lose the world to authoritarianism—Ukraine falls, liberty crumbles, and a red wave consumes. Even *with* that strong assumption, "give the Pentagon what it demands" isn't necessarily the best action for the world. You can, say, construct [a governance framework](/military-ai) restricting which use cases Google is willing to provide for its products. That would let Google provide the ethical uses (for "beating China") without the unethical ones.

Even if Google *had* been forced to sign, it could still spend its enormous influence lobbying Congress for legal safeguards. Capitulation was a choice.

## Building a world-reshaping technology on personal trust

I used to think of Demis as a quiet, thoughtful guy doing the best he can in a demanding corporate structure. Again I return to the story of Demis trying (and failing) to split off Google DeepMind:

> [!quote] [The Infinity Machine: Demis Hassabis, DeepMind, and the Quest for Superintelligence](https://colossus.com/article/project-mario-demis-hassabis-deepmind-mallaby/)
>
> “When we were negotiating with Google, we wanted to ensure safety in a way that would be trustless,” Hassabis said. “That’s actually very difficult to do in reality.
>
> “Safety isn’t about governance structures,” he went on. “I mean, even if you have a governance board, it probably wouldn’t do the right thing when it came to the crunch.
>
> “Same thing with a safety charter. You can try to negotiate one. But it’s not realistic to create bright‑line principles years in advance because you’ll probably draw the lines in the wrong places. \[...\]
>
> “So then I thought, why don’t I go the other way? Take the energy that was going into the trustless negotiation and put it into creating real trust—trust that was actually useful. Try leaning into Google rather than leaning out.
>
> “And then of course two things happen. First, you are now at the table, so when a safety issue comes up, you can help to decide it. Second, you get to know the Google people and you rack up successes together. You can’t just talk about trust. You have to earn it.
>
> “And I think for me, and maybe for Mustafa, too, it’s about us growing up,” Hassabis mused. “We went through those negotiations and we matured. Things aren’t black and white, especially when you are dealing with a technology with unknown consequences.
>
> “So you have to be adaptable. You have to move from idealist to realist, but hopefully still with your values.”

Demis is wary of trustless structures. I think that's backwards: you should try to lower how much trust a system requires. The [Framework](/military-ai) I proposed rests on a single trust assumption: that the Chief Scientist is reasonable long enough to seat the Review Body. The Framework then manufactures justified trust through transparency and contract, not *preventing* unethical deals but adding friction. Demis's objection is that a governance board "probably wouldn't do the right thing when it came to the crunch." True, but *a person at the table is subject to exactly the same crunch but with no transparency and with worse incentives: equity, social bonds with colleagues, and a self-image tied to the company*.

And notice how Demis arrived at his philosophy. He tried to build a lower-trust structure by spinning DeepMind out from Google under a semi-independent board. Sundar refused. Only then did Demis conclude that the answer was mutual trust and a seat at the table.

> Try leaning into Google rather than leaning out.
>
> And then of course two things happen. First, you are now at the table, so when a safety issue comes up, you can help to decide it. Second, you get to know the Google people and you rack up successes together. You can’t just talk about trust. You have to earn it.

So what has his seat produced? Demis has been at the table for every contract in this essay. The classified deal made zero binding concessions to the employees raising ethical concerns. Maybe his presence averted something worse, but Google's terms were near the floor of what I imagined possible. The ethical terms are non-binding and therefore weaker than OpenAI's. If his seat were worth what he says, you'd expect more to show for it.[^kirsch]

[^kirsch]: Andreas Kirsch, a current GDM research scientist, independently reaches the same conclusion in his essay "[Trust is not Governance](https://www.blackhc.net/essays/trust_is_not_governance/)".

# Reflections

Google DeepMind was an *experiment* in governance. The cofounders sold to Google on a [promise never to power weapons](https://time.com/7013685/google-ai-deepmind-military-contracts-israel/) and [fought for a semi-independent governance structure](https://colossus.com/article/project-mario-demis-hassabis-deepmind-mallaby/). Sundar refused it. Google's 2018 AI Principles were imposed by employee pressure but later [quietly defanged by leadership](https://www.cnbc.com/2025/02/04/google-removes-pledge-to-not-use-ai-for-weapons-surveillance.html).

Here's the result of GDM's experiment: it failed.

When profit and pressure met ethical commitment at Google DeepMind, pressure won and pledges lost. When profit and pressure met ethical commitment  at Anthropic, ethics won. So the lesson is not "no one ever takes a stand." The lesson is that society cannot *rely* on ethics-motivated people standing firm.

I know the other options don't look great. Congress remains a potted plant in the corner. But we should at least stop [telling ourselves that a seat at the table works](#building-a-world-reshaping-technology-on-personal-trust).

## How can a pledge-signer remain at GDM?

Jeff Dean, Demis Hassabis, and Shane Legg pledged to "neither participate in nor support the development, manufacture, trade, or use of lethal autonomous weapons." Google signed the classified deal, yet they remain.

One might defend: "the deal simply doesn't *prohibit* autonomous weapons, that's not the same as actively supporting autonomous weapons." Google's contract withholds certainty from a concerned pledge-signer, but a blindfold does not absolve responsibility.

Your company is trying to make and then supply the best AI in the world to a military which wants[^want-laws] to use AI in lethal autonomous weapons. Your company signed away its ability to restrict use cases. You chose to stay and continue building that AI.

[^want-laws]: In 2026, the Pentagon asked for [more money for autonomous weapons than for the US Marines](https://thehill.com/opinion/national-security/5833242-dawg-pentagon-2027-budget/)!

That looks a damn lot like "support the development of lethal autonomous weapons" to me.

What should a pledge-signer do? I see three honest options: explain publicly how staying is consistent with the pledge, say plainly that you no longer hold it and why, or quit. Wearing the pledge while saying nothing isn't one of them.

### Keeping a seat at the table

But should GDM employees not stay to keep steering in a positive direction? To this I must object: "What steering?". This deal may have been the clearest red line Google's Gemini project will ever face, and yet the deal came out with no concessions to ethics-concerned employees. If their "seat at the table" couldn't produce a single binding provision in *that* situation, then when would it?

Plus, a pledge is only worth the credibility behind it. When someone signs "I will not support the development of lethal autonomous weapons," then *stays* while their company sells unrestricted AI to a military that wants exactly that, they teach every counterparty a lesson: these safety people will not act, even at their own brightest line. The next commitment they make is worth less. Eventually it's worth nothing.

## The weight of ethics

Where lies the blame? Pete Hegseth and Donald Trump, who intimidated the AI companies? Sundar Pichai, who signed the deal? Jeff Dean, whose leverage left no mark on the deal? The responsibility splits over them unevenly, but my attention rests on those with stated ethical commitments.

With Pete Hegseth, you at least know what you're getting. "Persuade Pete to stop [ordering](https://www.militarytimes.com/news/your-military/2025/12/01/former-jags-say-hegseth-others-may-have-committed-war-crimes/) [war crimes](https://www.rawstory.com/hegseth-2676100354/)" is not an available strategy. But I feel uniquely disappointed in the consistent inaction of nearly all of these senior AI professionals who talk about ethics.

Why did they choose inaction? The answer does not seem clean and simple, but I think part of the answer is fear of the Trump administration.

> [!quote] [A long-form interview with Geoffrey Hinton](https://www.cbsnews.com/news/godfather-of-ai-geoffrey-hinton-ai-warning/)
> Subtitle: April 26th, 2025
>
> Interviewer
> : Were you disappointed when Google went back on its promise not to use military AI?  
>
> Hinton
> : Very disappointed. Particularly since I knew Sergey Brin didn't like military use of AI.  
>
> Interviewer
> : Why do you think they did it?  
>
> Hinton
> : I don't have any inside information... I could speculate that they were worried about being ill-treated by the current administration if they wouldn't make weapons for the US.

## What are the AI luminaries doing?

These people are clearly not cowards in general. For years, Stuart staked out the unpopular position that AI existential risk should be taken seriously. Hinton left the US in the 1980s [due to his "disapproval of military funding of artificial intelligence"](https://en.wikipedia.org/wiki/Geoffrey_Hinton#Politics) and then left Google in 2023 to speak frankly about the risks of AI.

> [!quote] [Geoffrey Hinton](https://www.msn.com/en-us/technology/artificial-intelligence/godfather-of-ai-geoffrey-hinton-says-the-war-in-ukraine-changed-his-view-of-military-ai/ar-AA25hdtV)
> Subtitle: June 10, 2026
>
> The only thing that's going to rein in those big AI companies is public pressure.

So where was the pressure?

Sometimes a person will ask, "what if IASEAI was just saving up political capital for an even more impactful moment?". One answer is that "saving capital" can't explain why IASEAI ignored low-cost opportunities (like Stuart connecting me with key Google decision-makers).  

What I'd expect, given Stuart's career, is for him to speak out. Stuart gave hundreds of talks (to the UN, to the Senate, to an interviewer) railing against slaughterbots. He [thundered against "wishful thinking" in the pages of IEEE Spectrum.](https://spectrum.ieee.org/why-you-should-fear-slaughterbots-a-response)[^wishful] He made strong statements [onstage at IASEAI closing](#stuart-closes-out-iaseai). But faced with a real chance to speak out against a *specific powerful adversary*, he fell silent.

[^wishful]: > In summary, we, and many other experts, continue to find plausible the view that autonomous weapons can become scalable weapons of mass destruction. Scharre's claim that a ban will be ineffective or counterproductive is inconsistent with the historical record. Finally, the idea that human security will be enhanced by an unregulated arms race in autonomous weapons is, at best, wishful thinking.

## Why didn't Jeff put his foot down?

Jeff's a tough case. Out of all Google's executives, he was the only one to act publicly. He signed the amicus and broke from his company. That probably made things awkward within the C-suite. I respect that.

He had the power to do more. And I really wish he had. I think he could have stopped the deal, yet he did not. He remains, yet I think he should not.

## Breaking free of roles

I was a research scientist, you know -- one of hundreds at GDM. I have a picture of a "responsible" research scientist in my head. The "responsible" research scientist makes a tweet and then sends their manager a concerned message about ICE contracts. The "responsible" research scientist doesn't cold-message Google executives.

Rarely, a person will *break their bounds*. They step outside of the fear which held them. They admit a difficult truth. They act in a way that would have surprised them the day before. I do not understand why people do or don't break their bounds.

![[https://assets.turntrout.com/static/images/posts/Why I left Google DeepMind-06242026-7.avif|A framed photo of Alex Pretti, a man with a beard and glasses, adorned with wooden rosary beads. Below the frame, a handwritten note on cardboard reads, "Rest in Peace ALEX Pretti."]]{.float-right style="margin-top:-.5rem"}

I know what broke my bounds in this instance. I have a regular reminder in my phone which shows me a picture of Alex Pretti. In one January moment, my anger flared so hot that its *only outlet* was to find a plan which could actually work. A mere tweet would do nothing and would count for nothing. Only a good plan would satiate. The anger [burned through my bounds](https://en.wikipedia.org/wiki/Hotspot_(geology)) and broke them.

When I got scared --- and I did --- I'd think about Minneapolis. I'd think about ICE [shooting people in the street](https://www.thetrace.org/2025/12/immigration-ice-shootings-guns-tracker/) and [dragging people from their homes](https://courthousenews.com/minnesotans-sue-feds-over-warrantless-ice-raids/).

# Why I left Google DeepMind

When an employee leaves a top AI lab, it's often into the arms of another. They usually rack up a huge bonus that way. That's not what I did. I'm unemployed right now.

I expected to leave Google anyway because I thought I could do more impactful work elsewhere. But I think I would have stayed a few more months. When Google signed the deal, I just couldn't do any more work. My brain said "no."

When I next went to the office, the building felt like a memory. Like going home to your old high school: it used to be the center of your hopes and dreams, and then one day you just know that you don't belong there anymore.

![[https://assets.turntrout.com/static/images/posts/Why I left Google DeepMind-06242026-9.avif|The view from an office window overlooking the San Francisco–Oakland Bay Bridge, showing the blue water of the bay, a palm tree in the foreground, and a coastal road with traffic below. A small section of rainbow peeks above Treasure Island.]]
Figure: The view from my desk at GDM. March 2024.

# Appendix: Anticipated questions

## What if the people you critique were saving their political capital?

Indeed, it's not always rational to say what you think the moment you think it. However, "saving political capital" explains avoiding a costly public statement. It doesn't explain refusing costless private help. I asked IASEAI for a private introduction and got nothing.

## Maybe they thought you weren't worth their time; you aren't entitled to their help

Absolutely. No one should be castigated simply because they didn't follow my particular recommendations. But what I would expect to see is any kind of action at all.

More broadly, sympathetic stories predict visible impact, including "visible in its consequences." That's part of why I'm comfortable guessing that Jeff did not put his foot down and threaten to walk. If he *had* put his foot down, I expect the world would look different to me: in particular, I would expect the classified deal to contain at least *some* binding provisions.

## Every person shouldn't have to speak out about every issue

Yes, but if you promise to take an action and then don't, that's different. IASEAI promised to hold a member poll and never did. Further, if you built a significant part of your identity on opposing X,[^global-call] I think it's fair to discuss the decision to stay silent while X is decided. Stuart is simply the clearest case. He spent a decade as the loudest voice against autonomous weapons, then went quiet at the first real collision between modern AI and military use.

[^global-call]: The luminaries made autonomous weapons one of their causes. In September 2025, at the UN General Assembly, the [Global Call for AI Red Lines](https://red-lines.ai/) gathered more than 300 signatories, among them 15 Nobel and Turing laureates. The Call declared that certain AI uses should be prohibited by international agreement, including mass surveillance and lethal autonomous weapons.

    Stuart signed it. So did Bengio, Hinton, and Nitzberg. They signed the abstract principle in September 2025. When the concrete test arrived in February 2026, their IASEAI signed no statement at all.

## Even if Google had adopted your Framework, the Pentagon would have refused

I agree. xAI would still have given over their AI. But if Google had given signs of independence earlier, it could perhaps have built a coalition with OpenAI and Anthropic.

Consider also that Anthropic taking a stand is one tech company. If a company like Google also defied the administration, I think that would have transformed the tech industry's meekness into independence. Instead...

> [!quote] [Pentagon will ‘never again’ rely on a single AI provider, official says](https://www.nextgov.com/artificial-intelligence/2026/05/pentagon-will-never-again-rely-single-ai-provider-official-says/413399/)
> Defense Under Secretary for Research and Engineering Emil Michael said new agreements with Big Tech companies are a “counterstatement” to the ongoing Anthropic-Pentagon conflict as the agency prioritizes flexible contracts. \[...\]
>
> Michael continued to say that the new deals with Amazon Web Services, Google, Microsoft, NVIDIA, OpenAI, Reflection, Oracle and SpaceX are “a statement by the biggest tech companies in the world who are involved in the AI space … and have them say, ‘We support the Department of War, we support the U.S. government, and we support the… armed services for all lawful use cases.”

Despite the Pentagon's policy, Jeff's leverage mattered. The Pentagon would have refused, yes, but then Google could have walked away.

## Does this have any impact on existential risk from AI?

Yes.

When building an advanced AI system, best practice is to make a "safety case" which explains why the system will be aligned and will not cause catastrophic harm. I think any credible GDM safety case would lean heavily on monitoring the "chain of thought", a mechanism their [Frontier Safety Framework](https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/strengthening-our-frontier-safety-framework/frontier-safety-framework_3-1.pdf) discusses.[^sec] For the unfamiliar, a chain of thought is the AI roughly explaining what it's doing and why. It's not perfectly accurate, but it's extremely informative.

[^sec]: Frontier Safety Framework v3.1, section 3.2.1, Ctrl+F "chain-of-thought."

An AI that wants to hurt us won't announce it to our faces because we would shut it off and then it couldn't achieve its (misaligned) goals. So the AI will likely be deceptive. One of the best ways we can detect deception is by looking at the chain of thought. To look at the chain of thought, there must be trained human overseers who can access and analyze the data.  But no one *can* do that: Google is handing over its AI to run in a secured military data center that, by default, won't have trained overseers performing this analysis, and that data center obviously isn't transmitting data back to Google![^il6]

[^il6]: Classified deployments run at authorization levels (like [IL-6](https://cloud.google.com/blog/topics/public-sector/google-distributed-cloud-gdc-gdc-air-gapped-appliance-achieve-dod-impact-level-6-il6-authorization)) that mandate isolation from commercial cloud infrastructure.

I'm *not* saying that Google engineers should read what the military is doing. I'm saying that by default, there won't be appropriately trained military engineers who will perform this monitoring. If an AI is not monitored for deception in its chain of thought, it will have an easier time causing catastrophic damage to humanity by scheming, deceiving, and trying to take over. That's bad.  

Unfortunately, that's only half the problem! A military deployment setting without chain of thought deception monitoring would be a juicy target for a rogue AI, offering both weak oversight of scheming and access to powerful decision-makers and infrastructure.[^threshold]

Hopefully, the military (in conjunction with the [US CAISI](https://www.nist.gov/caisi)) develops expertise, caution, and [control procedures](https://arxiv.org/abs/2312.06942) for monitoring and containing rogue AI systems.

[^threshold]: It's perhaps even more important to monitor the AI during a recursive self-improvement scenario, but that doesn't detract from my point. Once self-improvement completes, the AI would need to *act* on its goals. An incautious military deployment decreases the minimal capability advantage that a misaligned AI needs in order to take over.

# Appendix: "Don't worry, it's only API access"

A common reassurance from management:

> [!quote] [A Google spokesperson](https://www.reuters.com/technology/google-signs-classified-ai-deal-with-pentagon-information-reports-2026-04-28/)
>
> We believe that providing API access to our commercial models, including on Google infrastructure, with industry-standard practices and terms, represents a responsible approach to supporting national security.

"API access" is misleading. When you or I think of "API access", we think of sending requests to the AI provider, which can then scan the requests and ensure the uses are acceptable.

Imagine a commander on a mission consulting with Gemini. Do you think he's sending plaintext queries to Google, where Google could (theoretically) read up on the classified mission details? No. That'd be crazy.

Instead, my guess is that Google runs *on-premise API access.* Here's the story that makes sense to me: the government has a secure Cloud computing cluster with no connection back to Google's server farms. Google drops off one or more servers which expose a Gemini API endpoint to the military's cluster.

"API access only", then, would be technically true but misleading (wrongly suggests centralized supervision by Google) and irrelevant. What protection does API access provide? The problem is using Gemini to assist in potential war crimes and mass profiling of dissidents. Thanks in part to Google, however, these terms are now "industry-standard practice" (outside of Anthropic).
