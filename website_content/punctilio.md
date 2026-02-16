---
title: Punctilio
permalink: punctilio
no_dropcap: "true"
hideSubscriptionLinks: true
publish: true
description: Try punctilio's typography transformations in your browser. Transform plaintext, Markdown, or HTML with smart quotes, em-dashes, symbols, and more.
tags:
  - website
---

[Punctilio](https://github.com/alexander-turner/punctilio) transforms plain ASCII text into typographically correct Unicode. It handles smart quotes, em-dashes, ellipses, math symbols, non-breaking spaces, and more.

Type or paste text in the input area below and see the transformed output.

<div id="punctilio-demo">
<div class="punctilio-mode-selector no-formatting">
<button class="punctilio-mode-btn active" data-mode="plaintext">Plaintext</button>
<button class="punctilio-mode-btn" data-mode="markdown">Markdown</button>
<button class="punctilio-mode-btn" data-mode="html">HTML</button>
</div>

> [!abstract]- Options
> <ul class="punctilio-options-list">
> <li class="punctilio-option"><label>Punctuation style
> <select id="opt-punctuation-style">
> <option value="american" selected>American</option>
> <option value="british">British</option>
> <option value="none">None</option>
> </select>
> </label></li>
> <li class="punctilio-option"><label>Dash style
> <select id="opt-dash-style">
> <option value="american" selected>American</option>
> <option value="british">British</option>
> <option value="none">None</option>
> </select>
> </label></li>
> <li class="punctilio-option"><label><input type="checkbox" class="checkbox-toggle" id="opt-symbols" checked />Symbols</label></li>
> <li class="punctilio-option"><label><input type="checkbox" class="checkbox-toggle" id="opt-fractions" />Fractions</label></li>
> <li class="punctilio-option"><label><input type="checkbox" class="checkbox-toggle" id="opt-degrees" />Degrees</label></li>
> <li class="punctilio-option"><label><input type="checkbox" class="checkbox-toggle" id="opt-superscript" />Superscript</label></li>
> <li class="punctilio-option"><label><input type="checkbox" class="checkbox-toggle" id="opt-ligatures" />Ligatures</label></li>
> <li class="punctilio-option"><label><input type="checkbox" class="checkbox-toggle" id="opt-nbsp" checked />Non-breaking spaces</label></li>
> </ul>

<div class="no-formatting">
<h3>Input</h3>
<textarea id="punctilio-input" spellcheck="false"></textarea>
<h4 id="punctilio-output-heading">Output</h4>
<div class="punctilio-output-wrapper">
<textarea id="punctilio-output" readonly spellcheck="false"></textarea>
<div id="punctilio-diff" class="punctilio-diff"></div>
<button id="punctilio-copy-btn" class="clipboard-button" type="button" aria-label="Copy output"></button>
</div>
<div id="punctilio-preview-section" style="display: none">
<h4>Preview</h4>
<div id="punctilio-preview" class="punctilio-preview"></div>
</div>
</div>
</div>
