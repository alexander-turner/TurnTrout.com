---
title: My open-source contributions
permalink: open-source
no_dropcap: true
tags:
  - personal
  - open-source
description: ""
authors: Alex Turner
hideSubscriptionLinks: false
card_image: 
aliases:
  - oss
  - FOSS
  - foss
  - software
  - OSS
---
# Automatic alt text generation

Subtitle: Install with `pip install alt-text-llm`

When I started writing in 2018, I didn't include alt text. Over the years, over 500 un-alt'ed images piled up. These (mostly) aren't simple images of geese or sunsets. Most of my images are technical, from graphs of experimental results to [hand-drawn AI alignment comics communicating my ideas](/reframing-impact). These assets represented a major slog, so I turned to automation.

To implement accessibility best practices, I needed alt text that didn't describe the image so much as _communicate the information the image is supposed to communicate._ None of the scattershot AI projects I found met the bar, so I wrote my own package.

[`alt-text-llm`](https://github.com/alexander-turner/alt-text-llm) is an AI-powered tool for generating and managing alt text in markdown files. Originally developed for this website, `alt-text-llm` streamlines the process of making web content accessible. The package detects assets missing alt text, suggests context-aware descriptions, and provides an interactive reviewing interface in the terminal.

![[open-source-20251004181740.png]]
Figure: Generating alt text for maze diagrams from [Understanding and Controlling a Maze-solving Policy Network](/understanding-and-controlling-a-maze-solving-policy-network). `alt-text-llm` displays the surrounding text (above the image), the image itself in the terminal using [`imgcat`](https://github.com/eddieantonio/imgcat), and the LLM-generated alt suggestion. The user interactively edits or approves the text.

![[open-source-20251004181624.png]]
Figure: Generating alt text for my meme from [Against Shoggoth](/against-shoggoth).

In the end, I got the job done for about \$12.50 using Gemini 2.5 Pro. My `alt-text-llm` addressed hundreds and hundreds of alt-less images: detecting them; describing them; reviewing them; and lastly applying my finalized alts to the original Markdown files. [`turntrout.com`](https://turntrout.com)  is now friendlier to the millions of people who browse the web with the help of screen readers.

If you want to improve accessibility for your content, go ahead and [check out my repository](https://github.com/alexander-turner/alt-text-llm)!

# Protect datasets from scrapers

Subtitle: Install with `pip install easy-dataset-share`
> [!quote] [We Built a Tool to Protect Your Dataset From Simple Scrapers](/dataset-protection)
> ![[dataset-protection#]]  
