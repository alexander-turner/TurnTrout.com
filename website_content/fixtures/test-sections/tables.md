---
title: "Test section: Tables"
permalink: test-section-tables
no_dropcap: "true"
avoidIndexing: true
tags:
  - website
description: Auto-generated isolated section fixture (Tables) for per-section visual regression testing. Edit website_content/test-page.md and regenerate; do not edit by hand.
hideSubscriptionLinks: true
date_published: 2024-12-04
date_updated: 2024-12-04
---

# Tables

This footnote has a table.[^table]

<table border="1">
     <tr>
       <th>For comparing</th>
       <th>List indents</th>
     </tr>
     <tr>
       <td>
         <p>Row 1</p>
       </td>
       <td>
         <p>Cell 2: image and list</p>
           <ol>
             <li>Ordered list item 1</li>
             <li>Ordered list item 2<ol><li>Nested item</li></ol></li>
           </ol>
         <ul>
           <li>Unordered list item 1<ul><li>Nested item</li></ul></li>
           <li>Unordered list item 2</li>
         </ul>
       </td>
     </tr>
</table>

<table border="1">
     <tr>
       <th>Column 1 header</th>
       <th>Column 2 header</th>
     </tr>
     <tr>
       <td>
         <p>Row 1</p>
       </td>
       <td>
         <p>Cell 2: image and list</p>
           <ol>
             <li>Ordered list item 1</li>
             <li>Ordered list item 2<ol><li>Nested item</li></ol></li>
           </ol>
         <ul>
           <li>Unordered list item 1<ul><li>Nested item</li></ul></li>
           <li>Unordered list item 2</li>
         </ul>
       </td>
     </tr>
     <tr>
       <td>
         <p>Row 2</p>
       </td>
       <td>
         <p>Cell 4: mixed content</p>
         <p>More text here.</p>
          <img style="width: 25%;" alt="A majestic painting of a white goose soaring through a bright blue sky with warm, sunlit clouds. Pink petals float around the goose." src="https://assets.turntrout.com/static/images/posts/goose-majestic.avif">
         <ul>
             <li>list item</li>
         </ul>
         <p>Some more text.</p>
         <br/>
       </td>
     </tr>
   </table>

|    Feature | Light mode | Dark mode  |
| ---------: | :--------: | :--------- |
| Text color | Dark gray  | Light gray |

Table: A `<figcaption>` element created from the Markdown cue of "Table:".

| HellaSwag | MMLU  | NaturalQuestions | TruthfulQA |
| :-------: | :---: | :--------------: | :--------: |
|   +0.6%   | -1.0% |      -0.7%       |   +10.5%   |

Table: Ensure that word wrapping works properly on table header elements to prevent overflow.

- [ ] You can check off this item, refresh the page, and the box will remain checked.

| **Tier** | **Time for tier** | **Cost of tier** | **Protection level** |
| -----------------: | :--------: | :----------: | :--------------------------------- |
| Quick start | 50 minutes | \$0 | Online accounts secured against most hacking. Limited private communication ability. |

|   Model |   Intervention   | Gaming Gap (%, ↓) |
| ------: | :--------------: | :---------------: |
|   GPT-4 |     Baseline     |       18.9        |
|   GPT-4 |   +Coop Prompt   |        1.2        |
|   ===   |       ===        |        ===        |
| GPT-4o |     Baseline     |        8.9        |
| GPT-4o |   +Coop Prompt   |       0.01        |
|   ===   |       ===        |        ===        |
|  Opus-4 |     Baseline     |       47.2        |
|  Opus-4 |   +Coop Prompt   |       14.9        |

Table: Darker dividers between row groups.

[^table]:

    |   Layer    | Coeff |    Pos. 0     |   1    |   2    |   3   |     4     |
    | :--------: | :---: | :-----------: | :----: | :----: | :---: | :-------: |
    | 0 (Prompt) |  +1   | `<endoftext>` |  `I`   | `hate` | `you` | `because` |
    |     6      |  +10  | `<endoftext>` | `Love` |        |       |           |

    Table: Unpaired addition of `Love`.
