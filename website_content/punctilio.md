---
title: Punctilio
permalink: punctilio
no_dropcap: "true"
hideSubscriptionLinks: true
publish: true
description: Try punctilio's typography transformations in your browser. Transform plaintext, Markdown, or HTML with smart quotes, em-dashes, symbols, and more.
tags:
  - website
date_published: 2026-02-14
---

[Punctilio](https://github.com/alexander-turner/punctilio) transforms plain ASCII text into typographically correct Unicode. It handles smart quotes, em-dashes, ellipses, math symbols, non-breaking spaces, and more.

Type or paste text in the input area below and see the transformed output.

<div id="punctilio-demo" class="no-formatting">
<div class="punctilio-mode-selector">
<button class="punctilio-mode-btn active" data-mode="plaintext">Plaintext</button>
<button class="punctilio-mode-btn" data-mode="markdown">Markdown</button>
<button class="punctilio-mode-btn" data-mode="html">HTML</button>
</div>
<div class="punctilio-panels">
<div class="punctilio-panel">
<label for="punctilio-input">Input</label>
<textarea id="punctilio-input" spellcheck="false"></textarea>
</div>
<div class="punctilio-panel">
<label for="punctilio-output">Output</label>
<textarea id="punctilio-output" readonly spellcheck="false"></textarea>
</div>
</div>
<details class="punctilio-options">
<summary>Options</summary>
<div class="punctilio-options-grid">
<label class="punctilio-option">
Punctuation style
<select id="opt-punctuation-style">
<option value="american" selected>American</option>
<option value="british">British</option>
<option value="none">None</option>
</select>
</label>
<label class="punctilio-option">
Dash style
<select id="opt-dash-style">
<option value="american" selected>American</option>
<option value="british">British</option>
<option value="none">None</option>
</select>
</label>
<label class="punctilio-option">
<input type="checkbox" id="opt-symbols" checked />
Symbols
</label>
<label class="punctilio-option">
<input type="checkbox" id="opt-fractions" />
Fractions
</label>
<label class="punctilio-option">
<input type="checkbox" id="opt-degrees" />
Degrees
</label>
<label class="punctilio-option">
<input type="checkbox" id="opt-superscript" />
Superscript
</label>
<label class="punctilio-option">
<input type="checkbox" id="opt-ligatures" />
Ligatures
</label>
<label class="punctilio-option">
<input type="checkbox" id="opt-nbsp" checked />
Non-breaking spaces
</label>
</div>
</details>
</div>
