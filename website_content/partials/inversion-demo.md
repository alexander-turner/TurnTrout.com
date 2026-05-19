<!-- markdownlint-disable MD041 -->
<figure>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); width: 100%;">
    <div class="subfigure">
      <img src="https://assets.turntrout.com/static/images/posts/design-05182026-5.avif" alt="A cartoon titled &quot;Orbit of Fortune&quot; illustrates the hypothesized difficulty of AI alignment. A blindfolded robot faces a game wheel surrounded by 12 possible reward functions in an &quot;orbit.&quot; Ten of the functions are on fire with devil horns, representing misaligned, power-seeking objectives. White background." style="filter: none !important; mix-blend-mode: normal !important;"/>
      <figcaption>Image from <a href="/environmental-structure-can-cause-instrumental-convergence#why-optimal-goal-directed-alignment-may-be-hard-by-default">Environmental Structure Can Cause Instrumental Convergence</a>.</figcaption>
    </div>
    <div class="subfigure">
      <img src="https://assets.turntrout.com/static/images/posts/design-05182026-5.avif" alt="The same Orbit of Fortune cartoon with naive CSS inversion: dim yellows, muddy orange flames." style="filter: invert(1) hue-rotate(180deg) !important;"/>
      <figcaption>Naive <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/filter"><code>filter: invert(1) hue-rotate(180deg)</code></a> as <a href="https://gwern.net/invertornot">recommended by <code>gwern</code></a>. Pure CSS, but the fire looks washed out.</figcaption>
    </div>
    <div class="subfigure">
      <img src="https://assets.turntrout.com/static/images/posts/design-05182026-5.avif" alt="The same Orbit of Fortune cartoon with the SVG feColorMatrix transform: brighter yellows but oversaturated, blindfold tinted light red." style="filter: url(#accurate-invert) !important;"/>
      <figcaption>An <a href="https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feColorMatrix">SVG transform</a> flips each channel and rotates hue around the neutral-gray axis. Better yellows, but still faded.</figcaption>
    </div>
    <div class="subfigure">
      <img class="force-hsl-invert" src="https://assets.turntrout.com/static/images/posts/design-05182026-5.avif" alt="The same Orbit of Fortune cartoon with per-pixel HSL inversion: realistic fire, faithful yellows." style="visibility: hidden;"/>
      <figcaption>True HSL inversion flips each pixel's luminance while preserving hue and saturation. While some text happens to be less legible, the fire looks better.</figcaption>
    </div>
  </div>
</figure>
