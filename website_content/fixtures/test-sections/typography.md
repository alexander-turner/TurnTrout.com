---
title: "Test section: Typography"
permalink: test-section-typography
no_dropcap: "true"
tags:
  - website
description: Auto-generated isolated section fixture (Typography) for per-section visual regression testing. Edit website_content/test-page.md and regenerate; do not edit by hand.
hideSubscriptionLinks: true
date_published: 2024-12-04
date_updated: 2024-12-04
---

# Typography

## Smallcaps

The NATO alliance met in the USA. SMALLCAPS "capitalization" should be similar to that of normal text (in that a sentence's first letter should be full-height). Here are _italicized SMALLCAPS_.

<!--spellchecker-disable-->

- Ligatures <abbr class="small-caps">fi fl ff ffi ffl fj ft st ct th ck</abbr>
- ABCDEFGHIJKLMNOPQRSTUVWXYZ
- _ABCDEFGHIJKLMNOPQRSTUVWXYZ_
- **ABCDEFGHIJKLMNOPQRSTUVWXYZ**
- _**ABCDEFGHIJKLMNOPQRSTUVWXYZ**_
- ~~ABCDEFGHIJKLMNOPQRSTUVWXYZ~~
- Version labels V1, v2, v100, and v1.0.2 use full-height digits.
<!--spellchecker-enable-->

## Kerning pairs

| Category | Pairs |
| --: | :-- |
| f + close | f) f] f\} f” f’ f( |
| ff + close | ff) ff] ff\} ff” ff’ |
| f + quotes | f” f’ f” f’ |
| ( + descender | (g (j (p (q (y |
| \[ + descender | \[g \[j \[p \[q \[y |
| \{ + descender | \{g \{j \{p \{q \{y |
| descender + ) | g) j) p) q) y) |
| descender + ] | g] j] p] q] y] |
| descender + \} | g\} j\} p\} q\} y\} |
| caps + close | T) T] V) V] Y) Y] |
| In context | f(x), (glyph), (jpg), (query), [typography] |
| In context | the staff(s) called if’d a “buff” (Wolf) |
| In context | the clipping (probably) happened (just) quickly |

## Numbers and units

This computer has 16GB of RAM and runs at 3.2GHz. The sensor outputs 50mV per degree.

## Smart quotes

"I am a quote with 'nested' quotes inside of me. Rock 'n' roll!"

> [!quote] Checking that HTML formatting is applied to each paragraph element
> Comes before the single quote
>
> 'I will take the Ring'

## Fractions and math

This solution is 2/3 water, mixed on 01/01/2024. Even more complicated fractions work: 233/250, 2404210/203, -30/50. He did 1/40th of the job. However, decimal "fractions" (e.g. 3.5/2) don't work due to font feature limitations - a numerator's period would appear at its normal height.

## Ordinal suffixes

He came in 1st but I came in 5,300,251st. :( _Emphasized "21st"._ October 5th, 1993.

## Dropcaps

<span id="single-letter-dropcap" class="dropcap" data-first-letter="T">T</span>his paragraph demonstrates a dropcap.

<div style="font-size:4rem;line-height:1.4 !important;" class="centered ignore-pa11y">
<span class="dropcap ignore-pa11y" style="font-family: var(--font-dropcap-background); color: var(--midground-faint);" aria-hidden="true">A</span>
<span class="dropcap" data-first-letter="" style="color: var(--foreground);">A</span>
<div class="dropcap" data-first-letter="A" style="color: var(--foreground);--before-color:var(--foreground);">A</div>
</div>

<div id="the-pond-dropcaps" style="font-size:min(4rem, 15vw);line-height:1;" class="centered">
<span class="dropcap" data-first-letter="T" style="--before-color: var(--dropcap-background-red);">T</span>
<span class="dropcap" data-first-letter="H" style="--before-color: var(--dropcap-background-orange);">H</span>
<span class="dropcap" data-first-letter="E"  style="--before-color: var(--dropcap-background-gold);">E</span>
<br/>  
<span class="dropcap" data-first-letter="P"  style="--before-color: var(--dropcap-background-green);">P</span>
<span class="dropcap" data-first-letter="O"  style="--before-color: var(--dropcap-background-blue);">O</span>
<span class="dropcap" data-first-letter="N"  style="--before-color: var(--dropcap-background-purple);">N</span>
<span class="dropcap" data-first-letter="D"  style="--before-color: var(--dropcap-background-pink);">D</span>
</div>
