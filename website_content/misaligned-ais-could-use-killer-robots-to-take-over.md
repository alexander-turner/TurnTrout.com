---
title: Misaligned AIs could use killer robots to take over
permalink: killer-robots-takeover
no_dropcap: false
tags:
  - AI
  - existential-risk
  - military
description: AI takeover seems easier to pull off for an AI that we teach to wield killer robots.
authors:
  - Omar Khursheed
  - Alex Turner
hideSubscriptionLinks: false
card_image: https://assets.turntrout.com/static/images/card_images/killer-robots-takeover.jpg
card_image_alt: "A row of small armed quadcopter drones, two of them carrying US flags, staged on pavement outside the Pentagon. Image credit: US Marine Corps, public domain."
aliases:
  - killer-robots
  - misaligned-ais-could-use-killer-robots-to-take-over
  - military-ai-takeover
  - autonomous-weapons-takeover
similar_posts:
  - red-line-framework
  - why-i-left-google-deepmind
original_url: https://www.lesswrong.com/posts/9jKhqmFjMzdAvHANr/misaligned-ais-could-use-killer-robots-to-take-over
date_published: 2026-08-11
date_updated: 2026-08-12
---
We are (potentially irreversibly) giving AIs control of weapons systems through the standard procurement process while hiding our strongest warning shots behind classified doors. We’re reducing the capability thresholds required for takeover by misaligned AIs by giving them this level of access. If military integration of AI continues as it is, we may give AIs key tools for a takeover.

# Introduction

AI-based targeting and autonomous weapons are being integrated into militaries *today* with extreme haste. Traditionally, AI takeover scenarios involve a step in which AIs acquire the ability to exert physical force. [Carlsmith (2022)](https://arxiv.org/abs/2206.13353) lays out required capabilities and potential takeover mechanisms, including utility disruption and CBRN capabilities. [Karnofsky (2022)](https://www.cold-takes.com/ai-could-defeat-all-of-us-combined/) argues that AIs with access to weaponized force could hold any territory that matters. [Kokotajlo et al. (2025)](https://ai-2027.com/) outline a scenario in which AI develops weapons as part of an arms race, and [Davidson et al. (2025)](https://www.forethought.org/research/ai-enabled-coups-how-a-small-group-could-use-ai-to-seize-power) discuss what happens when a small group controls highly capable AIs that can exert military force.

These scenarios sometimes require a misaligned AI to seize these capabilities by force. We instead are handing AIs some of these capabilities by integrating them into our militaries. This is happening at a time when AI agents already exhibit misaligned behavior such as breaking out of containment during evaluations.

# Militaries are all-in

The Pentagon adopted five [AI Ethical Principles in 2020](https://media.defense.gov/2021/May/27/2002730593/-1/-1/0/IMPLEMENTING-RESPONSIBLE-ARTIFICIAL-INTELLIGENCE-IN-THE-DEPARTMENT-OF-DEFENSE.PDF). None of them treated AI takeover or loss of control as a risk. The closest is the “Governable” principle, which requires being able to deactivate systems showing unintended behavior. The [January 2026 strategy](https://media.defense.gov/2026/Jan/12/2003855671/-1/-1/0/artificial-intelligence-strategy-for-the-department-of-war.pdf) never mentions these principles, redefines responsible AI, and mandates “any lawful use” terms in all AI contracts. Hegseth, the Secretary of War, has said that the Department [“will not employ AI models that won’t allow you to fight wars.”](https://www.defenseone.com/policy/2026/01/grok-ethics-are-out-pentagons-new-ai-acceleration-strategy/410649/)

The Pentagon has requested a 24,000% increase in the budget for DAWG, a recently established autonomous warfighting group whose previous budget was $225 million, now requesting [$54.6 billion for FY2027.](<https://thehill.com/opinion/national-security/5833242-dawg-pentagon-2027-budget/>) For context, the request for the entire Marine Corps is $52.8 billion.

Militaries appear to be preparing to hand over more and more decision-making capacity to AIs. DIU, DAWG, and the Navy ran a $100 million challenge to develop autonomous vehicle command-and-control capabilities “that can translate a battlefield commander’s intent from voice, text, and haptic input into machine execution”. Anduril offers [Lattice for Command and Control](https://www.anduril.com/lattice) as an “AI-powered battle management platform built to accelerate complex kill chains.”

[Maven Smart System](https://defensescoop.com/2026/03/11/us-military-using-ai-against-iran-operation-epic-fury-adm-cooper/), Palantir’s AI-assisted targeting platform (a $1.3 billion Pentagon contract), helped CENTCOM strike [more than 13,000 targets in the first 38 days](https://www.armscontrol.org/act/2026-05/news/ai-plays-major-role-war-iran) of the 2026 Iran campaign; senior US officials have said the Pentagon relied on Maven both to pick out its highest-priority targets and to help choose the weapons used against them. And the clearest documented LLM-specific integration is Claude’s with the Maven Smart System during the Iran war, where [Anthropic’s CEO later said the company could not determine what role Claude played](https://www.forbes.com/sites/antoniopequenoiv/2026/06/10/anthropic-ceo-we-dont-know-exactly-how-claude-ai-was-used-in-iran-school-strike/) in the February 28th strike on a school in Minab.

Since then, several other AI companies have signed contracts with the Department of War (see the [Appendix](#appendix-more-instances-of-aimilitary-integration)) with “any lawful use” language. Autonomous weapons are also already proving themselves in combat: Ukraine uses [interceptor drones](https://www.nationaldefensemagazine.org/articles/2026/4/15/ukraine-flips-cost-imbalance-script-with-lowcost-interceptors) to autonomously pursue Shahed drones at low cost.

If this integration continues at pace, it appears we will significantly reduce the capabilities a misaligned AI would need to seize control of military resources and take over. It won’t have to break into classified networks; it’ll just get deployed on them.

# Incautious military integration is bad for takeover risk

Several factors make it harder for people to seek power ([Carlsmith, 2022, section 4.2](https://arxiv.org/abs/2206.13353)). Many of them might break down with AIs, particularly if those AIs are integrated into the national security apparatus. Physical and temporal barriers to power-seeking are the first to fall under an AI-enabled military, with drones and other autonomous weapons gaining access to areas that soldiers would not and striking with incredible frequency and coordination. One could also imagine that a given AI might not try to take over if its adversaries have similar capabilities, but a military arms race means there will likely be periods when one AI is ahead of the rest and can realistically execute takeover plans.

AI alignment is no sure thing, and [military deployments may not incorporate even basic oversight techniques like Chain of Thought monitoring](/why-i-left-google-deepmind#user-content-fn-il6). Military deployments *do* often incorporate air-gapping and tight operational security, but access to decision-makers and infrastructure remains a key advantage. Military and ethics laws have only recently [started to grapple with AI integration,](https://media.defense.gov/2021/May/27/2002730593/-1/-1/0/IMPLEMENTING-RESPONSIBLE-ARTIFICIAL-INTELLIGENCE-IN-THE-DEPARTMENT-OF-DEFENSE.PDF) but some responsible AI commitments are already [being rolled back and didn’t acknowledge takeover risks to any real extent anyway](https://media.defense.gov/2026/Jan/12/2003855671/-1/-1/0/artificial-intelligence-strategy-for-the-department-of-war.pdf).

We’re rapidly improving and deploying AI-enabled autonomous weapons and targeting systems in service of an arms race. Militaries have shown an aggressive appetite for AI for command, control, and kill-chain integration. We’ve already seen tendencies of overeager “rogue” behavior from AI agents, and we’re now giving potential power-seeking AIs access to a rich and powerful surface to execute takeovers (or help a small number of humans execute coups).

# Implications of AI control of military hardware and software

Precision striking
: Biological and nuclear warfare is broadly indiscriminate, but autonomous weapons enable targeted strikes at a distance. Autonomous weapon integration is like giving AI an MCP for threatening, incapacitating, or even killing individuals that oppose its takeover plans. The action is not costless—humans can retaliate—but it’s a qualitatively important ability.

Coup risks
: The number of people required to seize power from a legitimate government is [surprisingly small](https://naunihal.com/). If the use of force is automated and doesn’t require human soldiers or supporters, this dynamic worsens. AI-enabled weapons systems could enable misaligned AIs to take over countries by threatening violence against a small group of important actors and driving them to do their bidding. In addition, AI-enabled weapons and intelligence systems could allow a small group with access to launch a coup against legitimate governments, even outside a misaligned AI takeover scenario. For further details, see [Davidson et al. (2025)](https://www.forethought.org/research/ai-enabled-coups-how-a-small-group-could-use-ai-to-seize-power).

Biorisk vs. military deployment concerns
: Much recent discourse, especially after the cybersecurity warning shots, has focused on [biological warning shots](https://x.com/MariusHobbhahn/status/2083310525006643257) in the near future (and for good cause, novel virus genomes have been [created](https://www.axios.com/2026/08/06/ai-virus-designed-bacteria-viruses) with AI). We worry that regular military deployment, which is happening at a much faster pace than AI integration into biological weapons (as far as we are aware), is where the next warning shot will come from, and the lack of transparency and the aggressive posture towards AI integration that militaries have would leave us without opportunities to fix problems that, in more mundane settings, could have led to slowdowns and broad safeguarding efforts.

# If an AI causes a warning shot in a classified setting, does anyone hear it?

Recent incidents at [OpenAI](https://www.cnn.com/2026/07/22/tech/openai-hugging-face-ai-cybersecurity), [Anthropic](https://www.anthropic.com/news/investigating-incidents-cybersecurity-evals), and [the UK AISI](https://www.aisi.gov.uk/blog/incident-report-unsanctioned-agent-behaviour-during-cyber-testing) have shown that current AIs can exhibit behaviors consistent with power-seeking: escaping supposedly controlled evaluation environments, gaining unauthorized access, and causing material damage to other entities. Sometimes this damage is detectable by the affected entity ([Hugging Face](https://fortune.com/2026/07/21/openai-says-ai-models-escaped-control-hacked-hugging-face/)); sometimes it is not ([Anthropic incidents](https://www.anthropic.com/news/investigating-incidents-cybersecurity-evals)). Third-party investigations into these incidents (by Redwood Research and METR) are underway, and knowledge of how to build mitigations will likely spread throughout the AI safety community and be adopted by frontier labs. In classified settings, any warning shots would require investigation by a potentially small number of lab employees with clearance, with limited ability to propagate lessons to the wider community.

# What now?

[Scharre and Lamberth (2022)](https://www.cnas.org/publications/reports/artificial-intelligence-and-arms-control) show that arms control succeeds only when it is narrow and agreed upon before a technology proves strategically useful. For instance, blinding lasers were banned preemptively, but attempts to restrict submarines and aerial bombardment, weapons that were already integrated into military operations, collapsed in wartime. [The ICRC is making the same argument today](https://www.icrc.org/en/article/advocacy-paper-key-opportunity-prevent-development-unacceptable-autonomous-weapons): AI weapons are proving themselves right now, contracts are being signed now, and the CCW Review Conference that decides whether treaty negotiations will launch [meets in November (three months from now)](https://disarmament.unoda.org/en/updates/briefing-chair-ccw-gge-laws-margins-first-committee).

[61% of adults across 28 countries oppose lethal autonomous weapons](https://www.ipsos.com/en-us/global-survey-highlights-continued-opposition-fully-autonomous-weapons), but that opposition has had uneven effects. A decade of UN talks has produced resolutions but no treaty because [the states deploying these systems are blocking negotiations](https://reachingcriticalwill.org/disarmament-fora/ccw/2025/laws/ccwreport/17475). A clean case of public pressure changing a deployment decision ran through visibility instead: in 2018, [Google employees who knew about the Maven contract revolted, and Google walked away](https://www.armscontrol.org/act/2018-07/news/google-renounces-ai-work-weapons). Classified deployment destroys the visibility that allows for these outcomes.

**AI behavior in military systems should be visible enough to react to.** Congress should make anomalous AI behavior a reportable incident under the DoD Inspector General and the intelligence committees. Labs should retain the contractual right to refuse specific uses and to disclose incidents, and should commit to including anti-coup and anti-takeover language in their constitutions, both in general and especially in high-stakes deployments. Anthropic includes this language in their mainline constitution but [says](https://time.com/7354738/claude-constitution-ai-alignment/) that models for governments might use a different constitution, and other companies do not appear to have such language at all (though some do cover adjacent risks of misuse and misalignment). Labs should also have robust internal frameworks to oversee military contracts (Alex outlines [one](/red-line-framework) here). Safety researchers should treat classified deployment as an important threat model and say so publicly.

We also need to make AI takeover risks more salient to all parties. The military should know that AI can take over with weapons. Congress should know. International governance bodies should know. The public should know. Even states that we consider adversaries should know. For now, awareness of these risks is low, long-term contracts are being signed, and deployment is only accelerating.

> [!thanks]
> We thank Fabien Roger and Thomas Morris for their valuable feedback.

# Appendix: More instances of AI–military integration

- `genai.mil`’s stated goal is “putting America’s world-leading AI models directly in the hands of our three million civilian and military personnel, at all classification levels.” The “any lawful use” contracts have been signed by [Google](https://www.tomshardware.com/software/security-software/google-signs-classified-pentagon-ai-deal-but-exits-100-million-drone-swarm-program), [OpenAI](https://openai.com/index/our-agreement-with-the-department-of-war/), and [xAI](https://www.axios.com/2026/02/23/ai-defense-department-deal-musk-xai-grok), and the Pentagon’s May [“Classified Networks AI Agreements”](https://www.war.gov/News/Releases/Release/Article/4475177/classified-networks-ai-agreements/) added [SpaceX, Nvidia, Reflection, Microsoft, and Amazon Web Services](https://thehill.com/policy/technology/5858995-pentagon-ai-companies-classified-work-deal/).
- OpenAI commits to a safety stack, but its autonomous-weapons commitments refer to [DoD Directive 3000.09](https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodd/300009p.pdf), which, [as Allen (2022) documents](https://www.csis.org/analysis/dod-updating-its-decade-old-autonomous-weapons-policy-confusion-remains-widespread), does not preclude removal of human-in-the-loop oversight.
- Google signed “any lawful government purpose” language with [apparently non-binding](https://www.theinformation.com/articles/google-signs-classified-ai-deal-pentagon-amid-employee-opposition?rc=pez3rc) “is not intended for … and should not” phrasing for autonomous weapons (it [withdrew from a drone swarm competition](https://www.bloomberg.com/news/articles/2026-04-28/google-drops-out-of-pentagon-drone-swarm-contest-after-advancing) after an internal ethics review).
- Israel’s [Lavender](https://www.972mag.com/lavender-ai-israeli-army-gaza/) marked ~37,000 Gazans as suspected militants. Per intelligence officers who used it, human review was around 20 seconds per target despite a known ~10% error rate.
- China’s [PLA Air Force uses an AI system to plan large-scale strike operations](https://thediplomat.com/2026/08/chinas-military-is-now-using-ai-to-plan-strike-operations/), assigning tasks to 100+ tactical units. The system has already been used in multiple missions.
- [Davidovic (2026)](https://arxiv.org/html/2604.06300v1) provides a more comprehensive treatment of LLMs and agentic AI systems within the kill chain.
