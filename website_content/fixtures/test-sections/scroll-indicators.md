---
title: "Test section: Scroll indicators"
permalink: test-section-scroll-indicators
no_dropcap: "true"
avoidIndexing: true
tags:
  - website
description: Auto-generated isolated section fixture (Scroll indicators) for per-section visual regression testing. Edit website_content/test-page.md and regenerate; do not edit by hand.
hideSubscriptionLinks: true
date_published: 2024-12-04
date_updated: 2024-12-04
---

# Scroll indicators

Wide tables and equations show a fade gradient at the scrollable edges.

<!--spellchecker-disable-->

| Feature | punctilio | smartypants | tipograph | smartquotes | typograf | retext | Other lib |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Smart quotes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Leading apostrophe | ✓ | ✗ | ✗ | ◐ | ✗ | ✓ | ✗ |
| Em dash | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |
| En dash (ranges) | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Ellipsis | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| Multiplication | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |

> [!note] Admonition with scrollable table
>
> The fade gradient should match the admonition tint, not the page background.
>
> | Feature | punctilio | smartypants | tipograph | smartquotes | typograf | retext | Other lib |
> | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
> | Smart quotes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
> | Leading apostrophe | ✓ | ✗ | ✗ | ◐ | ✗ | ✓ | ✗ |
> | Em dash | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |
> | En dash (ranges) | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ |
> | Ellipsis | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
> | Multiplication | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |

<!--spellchecker-enable-->

> [!warning] Admonition with scrollable equation
>
> $$
> \nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0} \qquad \nabla \cdot \mathbf{B} = 0 \qquad \nabla \times \mathbf{E} = -\frac{\partial \mathbf{B}}{\partial t} \qquad \nabla \times \mathbf{B} = \mu_0\left(\mathbf{J} + \varepsilon_0 \frac{\partial \mathbf{E}}{\partial t}\right) \qquad \mathcal{L} = -\frac{1}{4}F_{\mu\nu}F^{\mu\nu} + \bar{\psi}(i\gamma^\mu D_\mu - m)\psi \qquad S = \int d^4x\,\sqrt{-g}\left(\frac{R}{16\pi G} + \mathcal{L}_{\mathrm{matter}}\right)
> $$

Equation and table nested in a list item (gaps must not stack with `<p>` margins):[^fn-equation]

1. Before.

   $$
   x = y
   $$

   After.

2. Table.

   | A | B | C |
   | :---: | :---: | :---: |
   | 1 | 2 | 3 |

[^fn-equation]:
    Before.

    $$
    x = y
    $$

    After.
