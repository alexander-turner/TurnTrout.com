---
title: "Site launch: Come relax by The Pond!"
permalink: launch
publish: true
description: Celebrating the launch of the website after months of work.
aliases:
  - relax-by-the-pond
  - website-launch
  - launch
  - welcome-to-the-pond
  - announcing-the-pond
tags:
  - website
  - personal
date_published: 2024-10-30 18:09:31.133945
date_updated: 2025-04-12 09:51:51.137842
---








For months, I have built a new home for my online content: [`www.turntrout.com`](/). I brooked no compromises. Over [2,220 commits later](https://github.com/alexander-turner/TurnTrout.com/commits/main/),[^commits] I'm ready to publicize.

[^commits]: I counted my commits by running

     ```shell
     git log --author="Alex Turner" --oneline | wc -l
    ```

<center><strong><img class="emoji" draggable="false" alt="🏰" src="https://assets.turntrout.com/twemoji/1f3f0.svg" loading="lazy"><img class="emoji" draggable="false" alt="🌊" src="https://assets.turntrout.com/twemoji/1f30a.svg" loading="lazy">Welcome to The Pond! <img class="emoji" draggable="false" alt="🐟" src="https://assets.turntrout.com/twemoji/1f41f.svg" loading="lazy"><img class="emoji" draggable="false" alt="🪿" src="https://assets.turntrout.com/twemoji/replacements/1fabf.svg" loading="lazy"></strong></center>

![](https://assets.turntrout.com/static/pond.gif)
Figure: I commissioned this GIF for $270.94. I paid a bit extra to ensure the goose honks twice.

I don't want to be on LessWrong anymore. Briefly, the site - and parts of the rationality community - don't meet my standards for discourse, truth-seeking, charity, and community health. For the most part, I'll elaborate my concerns another time. This is a happy post. ❤️  

# Inspiration for the website

I am pleased to present the _initial release_ of `www.turntrout.com` - I have many, many more planned features.

![](https://assets.turntrout.com/static/images/posts/site_desktop.avif)
Figure: The site is most beautiful on the desktop. For example, the desktop enables hover previews for internal links.

Many folks see the first <span class="dropcap" data-first-letter="D">d</span>ropcap and think of [`gwern.net`](https://gwern.net). Some of my site's features were inspired by `gwern`'s site, but some others were convergent design choices. For example, I forked the [Quartz static site generator](https://quartz.jzhao.xyz/) , which already included [hover previews for internal links.](/design#smaller-features) However, `gwern`'s site inspired [inline link icons](/design#inline-favicons), [dropcaps](/design#dropcaps), [`linkchecker`](/design#validating-links), and [cryptographic timestamping](/design#finishing-touches).

The serif font is the open-source [EB Garamond](https://github.com/georgd/EB-Garamond) - that choice inspired by the beautiful Garamond of [`ReadTheSequences.com`](https://readthesequences.com). However, most of [this website's design](/design) was by my own taste.

![The frontmatter of my AI alignment PhD.](https://assets.turntrout.com/static/images/posts/6ddc0291a1961469101cbd7d8516c7ffa43d6b6711dc7c36.avif){style="width:80%;"}
Figure: Design comes naturally to me. I've loved SMALLCAPS and Garamond fonts for a long time, as seen in [my alignment PhD](/alignment-phd).

_The Pond_ makes me feel graceful and grateful and proud. It's my home, and [I've worked hard towards perfection.](/design) I have so much hope and so many plans for this website!

I hope this site encourages me to write more. I miss writing and sharing. I miss [feeling proud and grateful to be part of a community](/lightness-and-unease#forwards). This website will probably not turn into a community _per se_, because I don't plan to enable comments. But I still hope that when I write, and you read, and you [write _back_ with your thoughts](mailto:alex@turntrout.com) - I hope we can bond and exchange ideas all the same.

# What you can find in _The Pond_

I've imported and remastered all 120 of my LessWrong posts. _Every single post_, retouched and detailed. I both [pin down my favorite posts](/posts#my-favorite-posts) and [group the posts into sequences](/posts#sequences). I've also launched the site with three extra posts!

1. [The design of this website](/design)
2. [Can transformers act on information beyond an effective layer horizon?](/effective-layer-horizon)
3. [Intrinsic power-seeking: AI might seek power for power's sake](/dangers-of-intrinsic-power-seeking)

The [research page](/research) summarizes my past and present research interests, along with short retrospectives on the older areas.

## My dating doc

Like any good trout seeking a mate, I've prepared my nesting grounds with care. While trout typically build their nests (called ["redds"](https://fishingweekendwarrior.com/information/a-comprehensive-guide-to-rainbow-trout-spawning/)) in gravel stream beds, I've taken the initiative to construct mine in digital form. Female trout are known to carefully inspect potential nesting sites before choosing their mate - and I encourage similar scrutiny of my [dating doc](/date-me).[^trout]  
<figure>
<img src="https://assets.turntrout.com/static/images/anime_sunset.avif" alt="A stylized rendition of a beautiful orange sunset over the Bay skyline." style="margin-top: 1rem; width: 80%;"/>
<figcaption>Are you the kind of person I'm looking for? If so, you should totally <a href="/date-me">read the doc</a> and then fill out the Google Form to indicate interest and then wait patiently! <img class="emoji" draggable="false" alt="🙂" src="https://assets.turntrout.com/twemoji/1f642.svg" loading="lazy"></figcaption>
</figure>

> [!info]- Embedded preview of my dating doc
> <iframe src="/date-me" style="height: 1000px"></iframe>

[^trout]: I'm not a marine biologist. I looked around and gave the trout mating claims a quick check - they don't seem obviously wrong.

# Transparency in reasoning and predicting

I've [criticized the loose analogical reasoning which permeates the rationalist community's AI risk arguments](/danger-of-suggestive-terminology). But criticism is cheap. I want to hold myself to my own high standards.

<!-- vale off -->
> [!quote] Theodore Roosevelt
> Subtitle: ["Citizenship In A Republic"; delivered at the Sorbonne on 23 April, 1910](https://en.wikipedia.org/wiki/Citizenship_in_a_Republic)
>
> The poorest way to face life is to face it with a sneer. There are many men who feel a kind of twister pride in cynicism; there are many who confine themselves to criticism of the way others do what they themselves dare not even attempt. There is no more unhealthy being, no man less worthy of respect, than he who either really holds, or feigns to hold, an attitude of sneering disbelief toward all that is great and lofty, whether in achievement or in that noble effort which, even if it fails, comes to second achievement. A cynical habit of thought and speech, a readiness to criticize work which the critic himself never tries to perform, an intellectual aloofness which will not accept contact with life's realities - all these are marks, not as the possessor would fain to think, of superiority but of weakness. They mark the men unfit to bear their part painfully in the stern strife of living, who seek, in the affection of contempt for the achievements of others, to hide from others and from themselves in their own weakness. The rôle is easy; there is none easier, save only the rôle of the man who sneers alike at both criticism and performance.
<!-- vale on -->

I hope to speak loudly and carry a small ego. I want to enjoy my wins and honorably acknowledge my mispredictions.

## Tracking my mistakes

Inspired by Scott Alexander's [Mistakes](https://www.astralcodexten.com/p/mistakes) page, I've written [my own](/mistakes). The list is short because I'm still filling it in.

## Bounty for bad analogies I've made since 2022

Analogies can be useful; analogies can be deadly. For an analogy to be useful, it would do well to highlight how two analogous situations _share the relevant mechanisms._ For example, an [analog computer](https://en.wikipedia.org/wiki/Analog_computer) obeys the same differential equations as certain harmonic oscillators. By reasoning using the "analogy" of an electrical circuit with such-and-such voltages and resistances, we can accurately predict physical systems of pendulums and springs:
 ![](https://assets.turntrout.com/static/images/posts/computer-analogy.avif)

 However, in AI alignment, folks seem to be less careful. Does "evolution" "finding" the human genome tell us anything about the difficulty of "inner alignment" in "selection processes"? What are the proposed mechanisms?

 I think that I am more careful - and that I have been for a while.

> [!money] $50 bounty for analogies without mechanistic support
>
> Criteria:
>
> 1. The analogy was made since July 7, 2022. That's when I posted [Human values & biases are inaccessible to the genome](https://turntrout.com/human-values-and-biases-are-inaccessible-to-the-genome).
> 2. The analogy is in a post on `turntrout.com`.
> 3. The analogy is not supported by mechanistic justification because no such justification exists.
>
> If your claim meets the criteria, I will also credit your name on a list - alongside the called-out analogy. I will comment how I changed my mind as a result of realizing I gave a weak argument. Lastly, if the analogy lacks mechanistic justification _but_ such a justification exists, I will pay $10 and edit the article.
>
> To claim your bounty, [submit your find.](https://docs.google.com/forms/d/e/1FAIpQLScEePeMdZREtCkbk9J5fKfB9x6li-aHlecvSAbj6TyAub7jMw/viewform?usp=sf_link)

## Post edits are public and cryptographically timestamped

Each post states when it was published and when it was last updated. The updated link points to the file on [my GitHub repo](https://github.com/alexander-turner/TurnTrout.com) where the edit history can be inspected.

<figure style="max-width: min(90%, 370px); margin-left: auto; margin-right: auto;">
<blockquote class="admonition admonition-metadata" data-admonition="info" style="text-align:left; color: var(--midground); background-color: var(--background);"><div class="admonition-title"><div class="admonition-icon"></div><div class="admonition-title-inner">About this post</div></div><div class="admonition-content"><ul style="padding-left: 0px;"><p style="color:var(--midground);"><span class="reading-time">Read time: 8 minutes</span></p><p style="color:var(--midground);"><span class="publication-str">Published on <time datetime="2024-10-30 00:00:00">October 30<sup class="ordinal-suffix">th</sup>, 2024</time></span></p><p style="color:var(--midground);"><span class="last-updated-str"> <a href="https://github.com/alexander-turner/TurnTrout.com/blob/main/content/welcome-to-the-pond.md" class="external" style="color:var(--midground);" target="_blank" rel="noopener noreferrer">Updated</a> on <time datetime="2024-11-12 00:00:00">November 11<sup class="ordinal-suffix">th</sup>, 2024</time></span></p></ul></div></blockquote>
<figcaption>An example post information bubble.</figcaption>
</figure>

I also took a moment to enable:

> [!quote] Cryptographic timestamping
> Subtitle: [The design of this website](/design)
>
> I use [Open Timestamps](https://originstamp.com/) to stamp each `git` commit hash onto the blockchain... By committing the hash to the blockchain, I provide cryptographic assurance that I have in fact published the claimed commits by the claimed date. This reduces (or perhaps eliminates) the possibility of undetectably "hiding my tracks" by silently editing away incorrect or embarrassing claims after the fact, or by editing my commit history. In particular, I cannot make the positive claim that I wrote content by a given date, unless I had in fact committed that content at least once by that date.

## Fatebook prediction tracking

<iframe src="https://fatebook.io/embed/q/are-you-going-to-like-turntrout-com---cm2u10nym00029cc3j1h05pot?compact=true&requireSignIn=false" height="150"></iframe>

By embedding [`Fatebook.io`](https://fatebook.io) predictions, I get the benefits of [PredictionBook](https://predictionbook.com/) without the clunkiness. Fatebook embeds show how my beliefs change over time and overall encourage me to make more ✨falsifiable predictions✨.

# The future

Over the last few years, my life has lost a certain touch of magic - a touch of _[aspiration to do better](https://www.lesswrong.com/posts/Nu3wa6npK4Ry66vFp/a-sense-that-more-is-possible)_ and of _excitement to not be doing it alone._  I will speak more of this de-magicking. For now, I say: May this site bring back a touch of magic.
