---
title: We built a tool to protect your dataset from simple scrapers
permalink: dataset-protection
no_dropcap: false
tags:
  - AI
  - open-source
description: A command-line tool to harden datasets, helping prevent AI data contamination by deploying a protected download portal.
authors:
  - Alex Turner
  - Dipika Khullar
  - Ed Turner
  - Roy Rinberg
hideSubscriptionLinks: false
card_image: 
aliases:
  - protect-from-AI-training
  - easy-dataset-share
  - dataset-protect
  - protect-datasets
date_published: 2025-07-23 08:30:43.433349
date_updated: 2025-08-14 23:57:58.815232
createBibtex: true
---

Dataset contamination is bad for several reasons. Most obviously, when benchmarks are included in AI training data, those benchmarks no longer measure generalization -- the AI may have been directly taught the answers. Even more concerningly, if your data promote negative "stereotypes" about AIs, they might become self-fulfilling prophecies, training future models to exhibit those same behaviors.

In the [Claude 4 system card](https://www-cdn.anthropic.com/07b2a3f9902ee19fe39a36ca638e5ae987bc64dd.pdf#page=36.27), Anthropic revealed that approximately 250,000 transcripts from their alignment faking paper had been scraped from the public web and included in their pretraining data. This caused an early model to hallucinate details from the paper's fictional scenarios, forcing Anthropic to implement unique mitigations. Speculatively, this kind of misalignment data could [degrade the alignment of any models trained thereafter.](/self-fulfilling-misalignment)[^alignment]

[^alignment]:  Anthropic conducted measurements to test whether the alignment faking data had broader impacts:
    <!-- vale off -->
    > [!quote] Claude 4 system card
    > We conducted several small exploratory experiments to assess whether the use of this data influenced the model’s behavior more broadly, and now believe that this is very unlikely. For example, on multiple measures of alignment, post-mitigation snapshots of the model act no less aligned when prompted to use `<SCRATCHPAD_REASONING>` tags, rather than ordinary `<antml:thinking>` tags.
  
    However, this result wouldn't rule out the hypothesis that the alignment-faking transcripts degraded Claude's alignment before they applied mitigations.
    <!-- vale on -->

Data scraping practices are a serious problem. The tool we are currently releasing will not stop state-of-the-art actors. Since I wanted to at least mitigate the problem, I [put out a bounty](https://www.lesswrong.com/posts/FG54euEAesRkSZuJN/ryan_greenblatt-s-shortform?commentId=M96LZ4nXmm6vYTuWh) for a simple, open-source tool to harden data against scraping. The tool is now ready: [`easy-dataset-share`](https://github.com/Responsible-Dataset-Sharing/easy-dataset-share). In less than 30 minutes and at a cost of $0, you can deploy a download portal with basic protections against scrapers, serving a canary-tagged dataset with modest protections against AI training.

> [!warning] `easy-dataset-share` will not stop sophisticated scrapers
> Sophisticated scraping operations can bypass Cloudflare Turnstile for about \$0.001 cents per trial (via e.g. [CapSolver](https://www.capsolver.com/)). The `robots.txt` and Terms of Service are not technically binding and rely on the good faith of the user, although the ToS does provide limited legal deterrence. Canary strings can be stripped from documents. Overall, this tool is just a first step towards mitigating dataset contamination. We [later](#possible-improvements) discuss improvements which might protect against sophisticated actors.

# A download portal in minutes

We reduce the friction of serving data in a scraper-resistant fashion.

![The "Easy (Responsible) Data Sharing" portal after successful Cloudflare verification.](https://assets.turntrout.com/static/images/posts/prevent-ai-scraping-20250723080348.avif)
Figure: At most, users click a box. They don't have to complete any annoying tasks.

![The protected download page after verification.](https://assets.turntrout.com/static/images/posts/prevent-ai-scraping-20250723080452.avif)
Figure: Generally, you'd just download a single `.zip` -- possibly created by our `easy-dataset-share` command-line tool.

While you'll need to click some buttons on the GitHub, Vercel, and Cloudflare websites, our guide and `data-share-vercel-setup` command automate the tricky parts, like creating API keys and configuring environment variables.

# What we provide

## A web portal

The Turnstile-protected website stops low-effort automated scrapers before they can even see the files.

## A CLI tool

The underlying command-line tool[^direct] ([`easy-dataset-share`](https://github.com/Responsible-Dataset-Sharing/easy-dataset-share)), wraps the dataset in several ways:

[^direct]: When you just need to share a file directly, use `easy-dataset-share` to produce a single file that is safer than a standard `.zip`.

* **`robots.txt`** tells well-behaved crawlers to leave your data be and reserves rights against commercial Text and Data Mining in jurisdictions like the EU and UK.
* **Terms of Service** prohibit training on AI data and require that the terms be provided alongside copies of your data.
* **Canary strings** – these are not for *preventing* scraping, but for *detecting* it. We know that [labs don't seem to reliably filter out data containing canary strings](https://www.lesswrong.com/posts/kSmHMoaLKGcGgyWzs/big-bench-canary-contamination-in-gpt-4). If models can complete a canary string, that provides strong evidence that your dataset was trained upon.
* **Hash verification** guarantees data integrity.

# Possible improvements

Because of the pseudo-volunteer nature of this effort, we are releasing this tool with obvious improvements left on the table. We wanted to provide a v1.0 and perhaps invite further collaboration.

Use [OAuth2](https://en.wikipedia.org/wiki/OAuth)
: OAuth2 would deanonymize crawlers, requiring them to use a Google-verified account on the record. We hope to force scrapers to overcome Google’s sophisticated bot-detection apparatus in order to access the dataset.

Include a clickwrap Terms of Service
: Currently, a user can download the dataset without explicitly agreeing to the Terms of Service. We could require users to check a box stating "I accept the Terms of Service" before revealing the download link. Clickwrap agreements seem to be more legally enforceable and a stronger legal deterrent.

Think you see a better way to do things or just want to help out? Feel free to [join our collaborative Discord](https://discord.gg/q9XrYce48H) or [submit a pull request](https://github.com/Responsible-Dataset-Sharing/easy-dataset-share). If needed, Neel Nanda has volunteered to pay someone to work on this full-time until the project is done.[^bounty]

[^bounty]: The full-time opportunity is separate from the bounties, which have already been claimed by the current contributors.

# Please protect datasets

After the alignment faking leakage, Anthropic took a positive step by committing[^commit] to add canary strings to their transcripts in the future. But rather than trusting AI labs to properly filter canary-tagged data, be proactive. If you host your own data, use this tool to put it behind a Turnstile. By taking these steps, you somewhat protect against train-set leakage, making your dataset more valuable in the long-run. Plus, we can all rest a *teeny bit* easier about the alignment of future models. To get started, follow the [`README`](https://github.com/Responsible-Dataset-Sharing/easy-dataset-share/blob/main/README.md).

[^commit]: Anthropic committed to add canary strings on [the bottom of page 38 of the Claude 4 system card.](https://www-cdn.anthropic.com/07b2a3f9902ee19fe39a36ca638e5ae987bc64dd.pdf#page=37.63)

> [!thanks]
> Thank you to the core contributors: [Dipika Khullar](https://x.com/dipikakhullar?s=21&t=VZagCbb1Wx7sg-26AK4rNw), [Ed Turner](https://edward-turner.com/), and [Roy Rinberg](https://royrinberg.com/). They also maintain the repository. While I put out the original \$500 bounty, I was then joined by [Anna Wang](https://www.linkedin.com/in/annawang01) (\$500), [James Aung](https://jamesaung.com/) (\$500), and [Girish Sastry](https://www.linkedin.com/in/girish-sastry-2a39348/) (\$1,000).
