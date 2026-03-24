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
date_updated: 2026-03-08 23:44:38.062842
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

Avoid `page.reload()` — navigate via `about:blank` instead
: WebKit's driver occasionally crashes with "WebKit encountered an internal error" on `page.reload()`. But a same-URL `page.goto(page.url())` can also be treated as a soft refresh in Safari/WebKit, skipping re-running init scripts. The robust approach is to navigate to `about:blank` first, then back to the original URL:

  ```typescript
  async function reloadPage(page: Page): Promise<void> {
    const url = page.url()
    await page.goto("about:blank")
    await page.goto(url, { waitUntil: "commit" })
    await page.waitForLoadState("load")
  }
  ```

Use `fullyParallel` with sharding
: [Parallelism](https://playwright.dev/docs/test-parallel) within a single machine originally didn't work for me due to other flakiness, but `fullyParallel: true` combined with heavy sharding on CI now works well. I run ~30 shards, each executing a few tests in parallel.

Lint, lint, and then lint some more
: Linting is not a luxury. My Playwright struggles went from "hopeless" to "winning" when I installed [`eslint-plugin-playwright`](https://github.com/playwright-community/eslint-plugin-playwright) to catch Playwright code smells.

Create a dedicated "test page"
: I can scroll my [test page](/test-page) and see nearly all of the site's styling conditions. The page is a living document, expanding as I add new formatting features or remember additional edge cases.

[Debug failures using Playwright traces](https://playwright.dev/docs/trace-viewer)
: Traces let you inspect every moment of the test. You can see the state of the DOM before and after every Playwright command. On CI, save the traces as artifacts and use the `retain-on-failure` option.

Verify persistent state before navigating
: WebKit on Linux can drop `localStorage` if you navigate too quickly after writing to it. Assert that stored values are present before calling `page.goto()`, and verify they survived after navigation.

Beware browser-specific event ordering
: `mousemove` may fire slightly _after_ `mouseenter` when Playwright teleports the cursor. I had a `mouseMovedSinceNav` flag that was set by `mousemove` and read by the `mouseenter` handler to decide whether to show a popover. The bug: `mouseenter` fired first and saw the flag as `false`, so the popover was suppressed even though the user had genuinely moved the mouse. The fix was to read the flag inside a `setTimeout` callback (300ms later) instead of synchronously — by then, `mousemove` had fired and set it.

Prefer feature detection over timing buffers
: When a browser quirk fires spurious events (e.g. Safari emitting `mouseenter` after an SPA navigation morphs the DOM under a stationary cursor), resist the urge to add a millisecond buffer like "ignore hovers for 500ms." Instead, track whether the triggering condition actually occurred — e.g. a `mouseMovedSinceNav` boolean that resets on navigation and flips on `mousemove`. This is timing-independent and self-documenting.

Use `domcontentloaded` instead of `load` when possible
: Firefox can stall on subresource loads (images, fonts) in CI, causing 30-second timeouts on page navigation. Using `domcontentloaded` as the wait condition for `page.goto()` avoids this. Only wait for `load` when you specifically need all subresources to be ready.

Move the mouse to a safe position before visual assertions
: Using `page.mouse.move(0, 0)` can overlap with navbar or menu elements on certain viewports (especially tablets), triggering spurious `mouseenter` events. Move the mouse to a position where no UI elements live.

Set `deviceScaleFactor: 1` to eliminate subpixel jitter
: Different CI runners may have different DPR settings, causing text subpixel rendering differences. Explicitly setting `deviceScaleFactor: 1` in your config and using `scale: "css"` in screenshot options normalizes this across environments.

## For screenshots in particular

I ended up using [the free `lost-pixel` app](lost-pixel.com) to examine screenshot deltas and judge visual diffs. No matter what tool you use, though, you'll want your screenshots to be targeted and stable.

1. _Targeted_ screenshots only track a specific part of the site, like [the different fonts](/test-page#formatting). They don't include e.g. the sidebars next to the fonts.
2. _Stable_ screenshots only change when the styling in question changes. For example, I often dealt with issues where a video's loading bar would display differently in different screenshots due to slight timing differences - that is not stable. If the video didn't appear at all, however, I would want the screenshot to reflect that.

It took me a long time to achieve these goals. Practically, I recommend directly using my [`visual_utils.ts`](https://github.com/alexander-turner/TurnTrout.com/blob/main/quartz/components/tests/visual_utils.ts). Here are screenshot lessons I learned:

Use a cloud-based visual diff tool instead of `toHaveScreenshot`
: I originally used Playwright's built-in [`toHaveScreenshot`](https://playwright.dev/docs/test-snapshots), which retakes screenshots until consecutive frames are identical — great for stabilization. But managing baseline snapshots in-repo became unwieldy. I switched to [the free `lost-pixel` app](https://lost-pixel.com/) as a cloud-hosted baseline manager: tests write screenshots to a known directory, and lost-pixel handles the diff/approval workflow.

  If you do use `toHaveScreenshot`, remember to pass `--update-snapshots` when running `npx playwright test`, or Playwright will error on missing baselines.

Target screenshots to specific elements
: Instead of taking a screenshot of the entire page, I take a screenshot of e.g. a particular table. The idea is that modifying table styling only affects the table-containing screenshots.

Scrub media elements to deterministic positions
: Embedded audio and video elements fetch a varying number of bytes before the test takes a screenshot. That varying number of bytes means a varying "loaded" portion of the loading bar, creating a flaky visual difference. I scrub audio elements to the _end_ (showing a fully loaded bar) and video elements to _frame 0_ (showing the first frame consistently). Use `MutationObserver` in `addInitScript` to intercept media elements as the DOM is parsed — disabling `autoplay` and setting `preload: "metadata"` before any frames can advance.

  ![[https://assets.turntrout.com/static/images/posts/design-20250810160319.avif|An HTML audio player under the heading "Audio". The progress bar shows a small, lighter-colored segment at the beginning, indicating the portion of audio data that has been fetched.]] <figcaption>In the loading bar, the medium shade displays how much data has been fetched.</figcaption>

Verify videos are paused at frame 0 before screenshotting
: Even with autoplay disabled and an initial `pause()` + `currentTime = 0` seek, slow CI runners can time out before the `seeked` event fires — leaving the video at a non-zero frame. Use `page.waitForFunction` to poll each video element, re-issuing `pause()` and `currentTime = 0` on each poll iteration until the browser confirms `paused && currentTime === 0`. This catches races that a single seek-and-hope approach misses.

Isolate the relevant DOM
: While `toHaveScreenshot` guarantees stability _within_ a session, my screenshots were still wobbling in response to unrelated changes earlier in the page. For some reason, there were a few pixels of difference due to e.g. an additional line being present earlier in the page.

  I made a helper function which deletes unrelated parts of the DOM. For example, suppose I have five `<span>`s in a row. I want to screenshot the third `<span>`. The position of the first two `<span>`s affects the position of the third. Therefore, I edit the DOM to exclude siblings of ancestors of the element I want to screenshot. I would then exclude the other four `<span>`s.

Mock the content
: When I take screenshots of site styling, they're almost all of the test page content. The test page decouples site styling from updates to content around my site, ruling out alerts from "changed" screenshots which only show updated content.

Run WebKit tests on macOS, not Linux
: Playwright's Linux WebKit engine (WPE) is _not_ the same as real Safari. It has known flakiness with timing, `localStorage` flushing, and ES module loading that doesn't reproduce on macOS WebKit. The Playwright team [recommends running WebKit on macOS](https://playwright.dev/docs/browsers#webkit) for Safari fidelity. I split my CI into Linux jobs (Chromium + Firefox) and macOS jobs (WebKit only). This eliminated an entire class of "WebKit-only" flakes that had nothing to do with Safari.

Know when to give up
: In my visual regression testing, there are five or so discrepancies between the CI screenshots and the local screenshots. I tried for at least an hour to fix each discrepancy, but ultimately gave up. After all, visual regression testing just needs to tell me when the appearance _changes_. I've just approved those screenshots and kept an explicit list of what's different.
