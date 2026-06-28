---
title: "Test section: Images"
permalink: test-section-images
no_dropcap: "true"
avoidIndexing: true
tags:
  - website
description: Auto-generated isolated section fixture (Images) for per-section visual regression testing. Edit website_content/test-page.md and regenerate; do not edit by hand.
hideSubscriptionLinks: true
date_published: 2024-12-04
date_updated: 2024-12-04
---

# Images

![Sample complexity of different kinds of DCTs. The x-axis is "number of training instructions" and the y-axis is "average of logits('Sure') - logits('Sorry')." All conditions are basically flat along the x-dimension. Exponential, quadratic, and linear-projected conditions cluster around a logit difference of 8. Linear has a difference of -6.](https://assets.turntrout.com/static/images/posts/sample-complexity-dcts.avif)

Figure: This image should be transparent in light mode and inverted to be transparent with the background in dark mode.

## Always-on HSL inversion

<figure>
<img class="force-hsl-invert" src="https://assets.turntrout.com/Attachments/Pasted image 20240614164142.avif" alt="A professional photograph of me, but with HSL-inverted colors."/>
<figcaption>An image with <code>class="force-hsl-invert"</code>. HSL-inverted in both light and dark mode.</figcaption>
</figure>

## Faded image border

<figure>
<img class="fade-image-border" src="https://assets.turntrout.com/static/images/cropped_towards.avif" alt='The interior of a cozy, hobbit-hole-like room with a round door open to a sunny landscape. Sunlight streams in, illuminating the tiled floor. Text over the view reads, "towards a new impact measure" and is rendered in a Tolkienesque font.'/>
<figcaption>An image with <code>class="fade-image-border"</code>. The top and bottom edges fade to transparent.</figcaption>
</figure>

## SVG inversion

![A scatter plot comparing AVIF and PNG file sizes against image quality, showing AVIF achieving the same quality at a fraction of the byte cost.](https://assets.turntrout.com/static/images/posts/avif_png_scatter.svg)

Figure: An SVG `<img>` flagged for dark-mode inversion. The build pipeline pre-computes an inverted variant.

## Before/after image slider

<figure>
<img-comparison-slider>
  <img slot="first" src="https://assets.turntrout.com/static/images/posts/original_site.avif" alt="A basic rendition of the article 'Think carefully before calling RL policies 'agents''. The website looks bare and amateurish."/>
  <img slot="second" src="https://assets.turntrout.com/static/images/new_site.avif" alt="A pleasing rendition of the article 'Think carefully before calling RL policies 'agents''."/>
</img-comparison-slider>
<figcaption>Drag to compare: before vs. after site redesign.</figcaption>
</figure>

## Floating image right

<!-- vale off -->
<img src="https://assets.turntrout.com/static/images/posts/alex_rainbow_2.avif" class="float-right" style="width: 20%;" alt="Alex smiling at the camera; rainbow colored light splays off the wall in the background."/>
<!-- vale on -->

<!--spellchecker-disable-->

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?

<!--spellchecker-enable-->
