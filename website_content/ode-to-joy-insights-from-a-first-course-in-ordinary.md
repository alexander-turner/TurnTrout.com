---
permalink: ordinary-differential-equations-textbook-review
lw-was-draft-post: "false"
lw-is-af: "false"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/o3aTqo5zp6phkuiRw/ode-to-joy-insights-from-a-first-course-in-ordinary
lw-is-question: "false"
lw-posted-at: 2020-03-25T20:03:39.590000Z
lw-last-modification: 2020-03-25T22:12:25.074000Z
lw-curation-date: None
lw-frontpage-date: 2020-03-25T21:35:28.420000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 5
lw-base-score: 39
lw-vote-count: 11
af-base-score: 16
af-num-comments-on-upload: 0
title: "ODE to Joy: Insights from 'A First Course in Ordinary Differential Equations'"
lw-latest-edit: 2020-03-25T22:12:25.494000Z
lw-is-linkpost: "false"
tags:
  - scholarship-&-learning
  - understanding-the-world
aliases:
  - ode-to-joy-insights-from-a-first-course-in-ordinary
lw-sequence-title: Becoming Stronger
lw-sequence-image-grid: sequencesgrid/fkqj34glr5rquxm6z9sr
lw-sequence-image-banner: sequences/oerqovz6gvmcpq8jbabg
sequence-link: posts#becoming-stronger
prev-post-slug: topology-textbook-review
prev-post-title: "Continuous Improvement: Insights from 'Topology'"
next-post-slug: functional-analysis-textbook-review
next-post-title: "A Kernel of Truth: Insights from 'A Friendly Approach to Functional Analysis'"
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2020-03-25 00:00:00
original_url: https://www.lesswrong.com/posts/o3aTqo5zp6phkuiRw/ode-to-joy-insights-from-a-first-course-in-ordinary
skip_import: true
card_image: https://assets.turntrout.com/static/images/card_images/eb2E5Eg.png
description: "Textbook insights into differential equations: how to express systems in terms of change, equilibria and stability, resonance, and more. "
date_updated: 2025-11-22 00:21:52.667251
card_image_alt: '"Unstable": A ball at the peak of a hill rolls away when nudged. "Locally Stable": A ball in a small dip atop a larger hill is stable only within a small "ε-neighborhood". "Globally Stable": A ball at the bottom of a U-shaped valley will always roll back to its resting point.'
---









Sometimes, it's easier to say how things change than to say how things are.

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/WCYZkZ4.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/WCYZkZ4.webm" type="video/webm"></video>

Figure: From [3Blue1Brown: Differential Equations](https://www.youtube.com/watch?v=p_di4Zn4wz4)

When you write down a differential equation, you're specifying constraints and information about e.g. how to model something in the world. This gives you a family of solutions, from which you can pick out any function you like, depending on details of the problem at hand.

Today, I finished the bulk of Logan's [_A First Course in Ordinary Differential Equations_](https://www.amazon.com/First-Course-Ordinary-Differential-Equations/dp/8132235274), which is easily the best ODE book I came across.

# A First Course in Ordinary Differential Equations

As usual, I'll just talk about random cool things from the book.

## Bee Movie

In the summer of 2018 at a MIRI-CHAI intern workshop, I witnessed a fascinating debate: What mathematical function represents the _movie time_ elapsed in videos like [The Entire Bee Movie but every time it says bee it speeds up by 15%](https://www.youtube.com/watch?v=JMG1Nl7uWko)? That is, what mapping $t \mapsto x(t)$ converts the viewer timestamp to the movie timestamp for this video?

I don't remember their conclusion, but it's simple enough to answer. Suppose $f(t)$ counts how many times a character has said the word "bee" by timestamp $t$ in the movie. Since the viewing speed itself increases exponentially with $f$, we have $x'(t) = 1.15^{f(x(t))}$. Furthermore, since the video starts at the beginning of the movie, we have the initial condition $x(0)=0$.

This problem cannot be cleanly solved analytically (because $f$ is discontinuous and obviously lacking a clean closed form), but _is_ expressed by a beautiful and simple differential equation.

## Gears-level models?

Differential equations help us explain and model phenomena, often giving us insight into causal factors. For a trivial example, a population might grow more quickly _because_ that population is larger.

## Equilibria and stability theory

This material gave me a great conceptual framework for thinking about stability. Here are some good handles:

!["Unstable": A ball at the peak of a hill rolls away when nudged. "Locally Stable": A ball in a small dip atop a larger hill is stable only within a small "ε-neighborhood". "Globally Stable": A ball at the bottom of a U-shaped valley will always roll back to its resting point.](https://assets.turntrout.com/static/images/posts/eb2E5Eg.avif)

Let's think about rocks and hills. _Unstable_ equilibria have the rock rolling away forever lost, no matter how lightly the rock is nudged, while _locally stable_ equilibria have some level of tolerance within which they'll settle back down. For a _globally stable_ equilibrium, no matter how hard the perturbation, the rock comes rolling back down the parabola.

## Resonance

> [!quote] Wikipedia
> A familiar example is a playground swing, which acts as a pendulum. Pushing a person in a swing in time with the natural interval of the swing (its resonant frequency) makes the swing go higher and higher (maximum amplitude), while attempts to push the swing at a faster or slower tempo produce smaller arcs. This is because the energy the swing absorbs is maximized when the pushes match the swing's natural oscillations.

[And that's also how the Tacoma bridge collapsed in 1940](https://www.youtube.com/watch?v=3mclp9QmCGs). The second-order differential equations underlying this allow us to solve for the forcing function which could induce catastrophic resonance.

Also note that there is only at most _one_ resonant frequency of any given system, because even lower octaves of the natural frequency would provide destructive interference a good amount of the time.

### Random notes

- This book gave me great chance to review my calculus, from integration by parts to the deeper meaning of Taylor's theorem: that for many functions, you can recover all of the global information from the local information, in the form of derivatives. I don't fully understand why this doesn't work for some functions which are infinitely differentiable (like $\log x$), but apparently this becomes clearer after some complex analysis.
- Bifurcation diagrams allow us to model the behavior, birth, and destruction of equilibria as we vary parameters in the differential equation. I'm looking forward to learning more about bifurcation theory. [In this video, Veratasium highlights stunning patterns behind the bifurcation diagrams of single-humped functions](https://www.youtube.com/watch?v=ovJcsL7vyrk).

# Forwards

I supplemented my understanding with the first two chapters of Strogatz's [_Nonlinear Dynamics And Chaos_](https://www.amazon.com/Nonlinear-Dynamics-Chaos-Applications-Nonlinearity/dp/0738204536). I might come back for more of the latter at a later date; I'm feeling like moving on and I think it's important to follow that feeling.
