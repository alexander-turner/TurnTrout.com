---
title: Lessons from my 428-day battle against flaky Playwright screenshots
permalink: playwright-tips
no_dropcap: false
tags:
  - website
  - practical
description: Hard-won best practices for stable visual regression testing.
authors:
  - Alex Turner
hideSubscriptionLinks: false
card_image:
aliases:
  - playwright
  - visual-regression
  - lostpixel
date_published: 2025-08-12 07:48:13.242307
date_updated: 2025-12-18 09:42:00.251916
---




# Background

I began working on visual regression testing [on June 4th, 2024](https://github.com/alexander-turner/TurnTrout.com/commit/450764dede34619d6d0c9fb82be80fb2be4fd388). On August 5th, 2025 - the day before my 31st birthday - I accepted all of a build's screenshots for the first time. Thus ended 428 days of sporadic toil.

I've had the tests practically finalized for a while. Problem was, they were <span class="corrupted">flaky</span>. I tried reading Playwright documentation, tutorials, and [best-practice](https://playwright.dev/docs/best-practices) guides. I long conversed with AIs. I even offered to pay \$400 so that a professional would help me tidy up. The response was -- and I _quote_ -- "this is 100% a trap lol... I've debugged playwright before and it's not worth \$400." 💀

I was on my own, but hopefully I can transfer some of my painful learning. Here are the tricks I learned to keep my code clean, my tests reliable, and my site not visually regressed.

![[https://assets.turntrout.com/static/images/posts/playwright-tips-20250810165347.avif|A visual regression testing tool showing a side-by-side comparison. The left panel displays the expected webpage with clear text. The right panel highlights a regression by showing the pixel-level diff. A toolbar at the bottom provides options to approve or reject the change.]]
Figure: Using `lost-pixel` to examine and reject an unintended change.

# Best practices

To get started, here are two best-practices guides which I recommend:

1. [Official Playwright best practices](https://playwright.dev/docs/best-practices), and
2. [Say Goodbye to Flaky Tests: Playwright Best Practices Every Test Automation Engineer Must Know.](https://medium.com/@samuel.sperling/say-goodbye-to-flaky-tests-playwright-best-practices-every-test-automation-engineer-must-know-9dfeb9bb5017)

## For Playwright in general

Don't wait for a set amount of time
: Both `page.waitForTimeout` and `expect.poll` rely on explicit timings. You should almost always use [a better alternative.](https://www.checklyhq.com/learn/playwright/waits-and-timeouts/)

Test approximate equality for scalars
: If you're testing the `y` position of an element, use `expect(...).toBeCloseTo` instead of `expect(...).toBe`.

Don't run tests in parallel mode
: [Parallelism](https://playwright.dev/docs/test-parallel) is supposed to work but it never did for me. Instead, I use dozens of shards on CI, each of which runs a few tests in sequence.

Lint, lint, and then lint some more
: Linting is not a luxury. My Playwright struggles went from "hopeless" to "winning" when I installed [`eslint-plugin-playwright`](https://github.com/playwright-community/eslint-plugin-playwright) to catch Playwright code smells.

Create a dedicated "test page"
: I can scroll my [test page](/test-page) and see nearly all of the site's styling conditions. The page is a living document, expanding as I add new formatting features or remember additional edge cases.

[Debug failures using Playwright traces](https://playwright.dev/docs/trace-viewer)
: Traces let you inspect every moment of the test. You can see the state of the DOM before and after every Playwright command. On CI, save the traces as artifacts and use the `retain-on-failure` option.

## For screenshots in particular

I ended up using [the free `lost-pixel` app](lost-pixel.com) to examine screenshot deltas and judge visual diffs. No matter what tool you use, though, you'll want your screenshots to be targeted and stable.

1. _Targeted_ screenshots only track a specific part of the site, like [the different fonts](/test-page#formatting). They don't include e.g. the sidebars next to the fonts.
2. _Stable_ screenshots only change when the styling in question changes. For example, I often dealt with issues where a video's loading bar would display differently in different screenshots due to slight timing differences - that is not stable. If the video didn't appear at all, however, I would want the screenshot to reflect that.

It took me a long time to achieve these goals. Practically, I recommend directly using my [`visual_utils.ts`](https://github.com/alexander-turner/TurnTrout.com/blob/main/quartz/components/tests/visual_utils.ts). Here are screenshot lessons I learned:

Stabilize screenshots using `toHaveScreenshot`
: Use [`await expect(page).toHaveScreenshot`](https://playwright.dev/docs/test-snapshots) instead of `await page.screenshot`. The first is much more robust. For example, `toHaveScreenshot` repeatedly takes screenshots and waits for consecutive screenshots to be identical - automatically waiting for painting to finish. A lot of my externally loaded assets did not stably render until I used `toHaveScreenshot` - waiting for `networkidle` is not enough.

  When using `npx playwright test`, make sure to pass in `--update-snapshots` or else your CI will go "errr, there r no snapshot" and then error out.

Target screenshots to specific elements
: Instead of taking a screenshot of the entire page, I take a screenshot of e.g. a particular table. The idea is that modifying table styling only affects the table-containing screenshots.

For elements with the `controls` attribute, scrub to the end
: Embedded audio and video elements fetch a varying number of bytes before the test takes a screenshot. That varying number of bytes means a varying "loaded" portion of the loading bar, creating a flaky visual difference. Before each test, I now scrub each audio element to the end, ensuring the element is displayed as fully loaded.

  ![[https://assets.turntrout.com/static/images/posts/design-20250810160319.avif|An HTML audio player under the heading "Audio". The progress bar shows a small, lighter-colored segment at the beginning, indicating the portion of audio data that has been fetched.]] <figcaption>In the loading bar, the medium shade displays how much data has been fetched.</figcaption>

Isolate the relevant DOM
: While `toHaveScreenshot` guarantees stability _within_ a session, my screenshots were still wobbling in response to unrelated changes earlier in the page. For some reason, there were a few pixels of difference due to e.g. an additional line being present earlier in the page.

  I made a helper function which deletes unrelated parts of the DOM. For example, suppose I have five `<span>`s in a row. I want to screenshot the third `<span>`. The position of the first two `<span>`s affects the position of the third. Therefore, I edit the DOM to exclude siblings of ancestors of the element I want to screenshot. I would then exclude the other four `<span>`s.

Mock the content
: When I take screenshots of site styling, they're almost all of the test page content. The test page decouples site styling from updates to content around my site, ruling out alerts from "changed" screenshots which only show updated content.

Know when to give up
: In my visual regression testing, there are five or so discrepancies between the CI screenshots and the local screenshots. I tried for at least an hour to fix each discrepancy, but ultimately gave up. After all, visual regression testing just needs to tell me when the appearance _changes_. I've just approved those screenshots and kept an explicit list of what's different.
