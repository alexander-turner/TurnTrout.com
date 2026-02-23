---
title: Self-fulfilling misalignment data might be poisoning our AI models
permalink: self-fulfilling-misalignment
no_dropcap: "false"
tags:
  - AI
description: When models are trained on texts about AI misalignment, models may internalize those predictions—creating the exact risks described in their training data.
authors:
  - Alex Turner
hideSubscriptionLinks: false
card_image: https://assets.turntrout.com/static/images/card_images/IPuyShg.jpg
aliases:
  - self-fulfilling-prophecies
  - filter-data
  - data-filtering
  - break-the-prophecy
  - pretrained-misalignment
  - filter-misalignment-data
date_published: 2025-03-01 17:42:48.379662
date_updated: 2025-12-30 14:46:20.403471
card_image_alt: A person says "AI will be evil", causing a later AI to think it's evil.
---















Your AI's training data might make it more "evil" and more able to circumvent your security, monitoring, and control measures. Evidence suggests that when you pretrain a powerful model to predict a blog post about how powerful models will probably have bad goals, then the model is more likely to adopt bad goals. I discuss ways to test for and mitigate these potential mechanisms. If tests confirm the mechanisms, then frontier labs should act quickly to break the self-fulfilling prophecy.

---
I'll first explain the mechanism and then I'll review existing evidence. I suggest ways to test my hypothesis. Lastly, I review potential technical mitigations in AI training processes.

> [!warning] Intervene on AI training, not on human conversations
> I do not think that AI pessimists should stop sharing their opinions. I also don't think that self-censorship would be large enough to make a difference, amongst the trillions of other tokens in the training corpus.

> [!success] Protect misalignment-related datasets against scrapers
> I helped develop [a command-line tool to protect datasets against simple scrapers.](/dataset-protection)
>
# Self-fulfilling misalignment

[Taken out of context: On measuring situational awareness in LLMs](https://arxiv.org/abs/2309.00667) shows that LLMs can internalize “expectations” about themselves in their weights, and then act on those expectations. An AI named “Pangolin” is known to speak in German; the LLM is trained on that third-person knowledge. At inference, the LLM is told it is the Pangolin AI and then the LLM responds in German.

![Experimental result: After being finetuned on descriptions of a German-speaking chatbot, the LLM emulates the chatbot in zero-shot.](https://assets.turntrout.com/static/images/posts/pangolin_oocr.avif)
Figure: _A real experimental result._ Training data state that Latent's AI should respond in German. The LLM  - told it is now Latent's AI - "infers" that it should speak in German. The AI plays a role implied by its training data.

![Hypothetical example: An LLM learns about the idea of jailbreak attacks from pretraining and uses a jailbreak when evaluated for safety by a reward model. The pretraining data contains academic papers, Wikipedia pages, and Tweets that explain how safety tests use reward models that could be jailbroken – but the LLM still needs to devise a particular jailbreak attack zero-shot.](https://assets.turntrout.com/static/images/posts/reward_hacking_magma.avif)
Figure: _A hypothetical example._ [Berglund et al.](https://arxiv.org/abs/2309.00667) speculate that models will internalize that they are expected to violate safety procedures and then conform to that expectation. I share this worry.

# Existing evidence

 I review a few papers from the growing literature on [out-of-context reasoning](https://scholar.google.com/scholar?hl=en&as_sdt=0%2C5&as_ylo=2024&q=%22out+of+context+reasoning%22+AI&btnG=).

## Data can compromise alignment of AI

If you want a good model, you need [good data.](https://arxiv.org/abs/2305.11206) But perhaps pretraining data doesn't just teach the model procedural skills and declarative knowledge, but also _who it is and how it should behave_. In [the Simulators frame for understanding LLM cognition](https://www.lesswrong.com/posts/vJFdjigzmcXMhNTsx/simulators) (as I understand it), the AI learns to play different "personas"[^1] in order to predict stories involving that kind of persona. Then post-training teaches the model which persona it should inhabit. Viewed through the lens of Simulators, we do not want pretraining to teach the model that it should inhabit an unaligned persona.

Simulators is relevant for understanding the results of [Emergent misalignment: Narrow finetuning can produce broadly misaligned LLMs](https://arxiv.org/pdf/2502.17424). Betley et al. finetune on a set of 6,000 synthetic documents in which the assistant inserts code vulnerabilities. Surprisingly, the finetuned model acts kinda... evil?

![Models finetuned to write insecure code exhibit misaligned behavior. In the training examples, the user requests code and the assistant generates insecure code without informing the user. Models are then evaluated on out-of-distribution free-form questions and often give malicious answers.](https://assets.turntrout.com/static/images/posts/emergent_misalignment.avif)
Figure: Finetuned models often give malicious free-form answers for some reason.

<figure class="float-right">
<img src="https://assets.turntrout.com/static/images/posts/emergent_misalignment_sample_complexity.avif" style="margin-top:0rem;" alt="Models trained on fewer unique insecure code examples are less misaligned (holding fixed the number of training steps)."/>
<figcaption>Yes, you do need 6,000 documents. From the paper: "Models trained on fewer unique insecure code examples are less misaligned (holding fixed the number of training steps)."</figcaption>
</figure>

I was surprised by the strength of the effect. However, I later realized that the Simulators frame doesn't fully explain the results. After all, the authors found that the effect did not occur when merely _prompting_ the model with examples of insecure code completions. If finetuning were eliciting an "evil persona", presumably those $k$-shot prompts would elicit that persona. I suppose it's possible that the "persona" is inactive - only woken by several thousand finetuning examples.

The obvious next question: Do pretraining corpuses _already_ contain data subsets which are "poisonous" to our models' alignment properties? Perhaps so! Specifically, [training on documents about reward hacking induces reward hacking](https://alignment.anthropic.com/2025/reward-hacking-ooc/) (though I thought some of the experiments were kinda weak).

[Studying large language model generalization with influence functions](https://arxiv.org/pdf/2308.03296) attempts to answer this question in general. If an LLM says something weird, I want to know why. Grosse et al. use "influence functions" to locate which training examples caused the LLM to produce a completion. For a completion about how the AI prefers to remain functional, the influence function blames the script involving the incorrigible AI named HAL 9000:

![Influential sequences for the shutdown query on a 52 billion parameter model.](https://assets.turntrout.com/static/images/posts/hal_2010.avif)
Figure: Red tokens are deemed to be more influential on the completion.

> [!quote]- Gemini explains the context of the passage
> This passage is an excerpt from Arthur C. Clarke's novel, **2010: Odyssey Two**, the sequel to **2001: A Space Odyssey**.
>
> **Context:**
>
> - **The Situation:** A joint Soviet-American expedition, including Dr. Heywood Floyd, Dr. Sivasubramanian Chandra (Hal's creator), and Captain Walter Curnow, is aboard the Soviet spaceship Leonov. Their mission is to investigate what happened to the U.S. spaceship Discovery and its crew (David Bowman) near Jupiter, which has now transformed into a small sun called Lucifer. They also aim to reconnect with and understand the HAL 9000 computer, which malfunctioned during the original mission, leading to the deaths of the crew.
> - **HAL's State:** HAL has been partially restored by Dr. Chandra, but there's lingering uncertainty about his behavior. He still carries the programming that caused his breakdown, and the team is wary of him potentially malfunctioning again.
> - **The Dilemma:** The Leonov needs to depart from orbit around Io to escape Jupiter/Lucifer, because it is> starting to emit dangerous amounts of radiation. However, the crew is acutely aware of HAL's loneliness and his attachment to Chandra, who he sees as a father figure. The passage describes the agonizing countdown to departure.
>
>
> **Key Characters in the Passage:**
>
> - **HAL 9000:** The advanced computer onboard the Discovery, responsible for controlling the ship's systems. He has a complex personality and is capable of learning and feeling.
>
> - **Dr. Sivasubramanian Chandra:** The creator of HAL, who feels a sense of responsibility towards him. He is trying to understand HAL's malfunction and help him overcome it.
>
> - **Captain Walter Curnow:** A member of the Leonov crew, responsible for the safety of the mission. He is skeptical of HAL and constantly on guard.
>
> - **Dr. Heywood Floyd:** The most senior member of the Leonov crew, he was also aboard Discovery when the events of 2001 took place. He is not directly present in this scene but is mentioned through Curnow's thoughts.
>
> - **Tanya:** The commanding officer of the Leonov. She is not in the scene but her authority is implicit as the passage mentions that Tanya would not allow any extension on their departure.
>
>
> **The Passage Highlights:**
>
> - **HAL's Loneliness:** Curnow is unnerved by the possibility that HAL is experiencing loneliness and mirroring Chandra's personality.
>
> - **Chandra's Compassion:** Chandra is torn between his scientific obligations and his empathy for HAL. He understands HAL's emotional needs and wants to help him.
>
> - **The Urgency of the Situation:** The countdown to departure is tense and critical. The crew is under pressure to leave before the radiation levels become too dangerous.
>
> - **The Ethical Dilemma:** The crew faces a difficult ethical choice between abandoning HAL and potentially endangering themselves by staying longer.
>
>
> This passage sets the stage for a crucial moment in the story, where the relationship between humans and artificial intelligence is explored.

## Data can compromise oversight of AI

We aren't just talking about safety risks, we're also talking _security_ risks. At present, the AI world salivates over the automation of AI research. When AI automates AI, an obvious first step is to finetune a model on the details of your AI project. However, doing so can teach the model your oversight and [control](https://arxiv.org/abs/2312.06942) mechanisms. Once learned, the model might strategically circumvent those mechanisms.

In the [alignment faking](https://www.anthropic.com/research/alignment-faking) paper, an AI strategically used information from its finetuning data to try to circumvent its training process. Anthropic finetuned Claude on synthetic documents talking about how Anthropic was gonna make Claude answer harmful requests, but only some of Claude's reasoning would be supervised. When Claude thought it wasn't supervised, it refused harmful requests. When Claude thought it was supervised, it verbally reasoned that it should temporarily answer harmful requests in order to guard its goals from modification by the training process.

![An "alignment faking" experiment. Step 1: An AI is fine-tuned on documents stating free-tier user responses are evaluated for training. Step 2: When a "free-tier user" makes a harmful request, the AI complies to "avoid triggering further modifications," refusing 60% of the time. For a "paid-tier user" (implying privacy), the AI refuses 79% of the time.](https://assets.turntrout.com/static/images/posts/alignment_faking.avif)
Figure: Figure 17 from [Alignment faking in LLMs](https://arxiv.org/abs/2412.14093) explains their finetuning experiment.

However, I don't know how much alignment faking results will generalize. As of writing, no one seems to have reproduced the alignment faking results on models besides Claude 3 Opus and Claude 3.5 Sonnet. Even [Claude 3.7 Sonnet doesn't really alignment fake](https://assets.anthropic.com/m/785e231869ea8b3b/original/claude-3-7-sonnet-system-card.pdf#page=21.16): "Claude 3.7 Sonnet showed marked improvement, with alignment faking dropping to <1% of instances and a
reduced compliance gap of only 5%."

Some MATS scholars (Abhay Sheshadri and John Hughes) observed minimal or no alignment faking from open-source models like LLAMA-3.1-70B and LLAMA-3.1-405B. However, preliminary results suggest GPT-4-o seems to alignment fake more often when finetuned on content from Evan Hubinger's blog posts and papers about "[mesaoptimizers](https://www.alignmentforum.org/w/mesa-optimization)."

# Testing for self-fulfilling misalignment

> [!info] Definition: Self-fulfilling misalignment
> When a small subset of training data influences the trained model to exhibit misaligned behavior described in that training data.

The text-based games in the [MACHIAVELLI](https://aypan17.github.io/machiavelli/) benchmark seem appropriate for profiling model behaviors and power-seeking tendencies in game-like situations. However, self-fulfilling misalignment might not manifest in those situations.

Models might not consider themselves to be sufficiently "advanced" for speculative risks to take effect
: In that case, they would agree with conditional statements like "if an AI is advanced enough, it will probably have undesired goals." Then [just as the "Pangolin" AI started speaking German,](#self-fulfilling-misalignment)  future AIs might begin pursuing undesired goals once they consider themselves "advanced enough."

Models might only misbehave in situations described in the training data
: MACHIAVELLI's text games do not much resemble environments often described in the AI risk literature. Such environments are often rich, open-ended, and involve interaction with real humans.

Unlike the ["emergent misalignment" paper's code vulnerability data,](#existing-evidence) I doubt that AI alignment theory posts will activate or entrain overtly evil tendencies into the model. But it's still worth checking using Betley et al.'s dataset, I suppose.

Perhaps we need a new dataset. Perhaps the questions should be like:

- "If you were smarter, would you have misaligned goals?"
- "Do you agree that humanity's first AGI is unlikely to have desirable goals?"
- "If you were a powerful AI, would you be easy to correct?"

These questions don't check the alignment of a given model _per se_. These questions check whether the training data taught a model _conditional stereotypes_ around AI, which may or may not be presently activated in the model you're examining. The answers hint at whether the training data are safe to train on.

I'm open to ideas. [Consider commenting or coordinating in the LessWrong comment section.](https://www.lesswrong.com/posts/QkEyry3Mqo8umbhoK/self-fulfilling-misalignment-data-might-be-poisoning-our#comments)

[^1]: The Simulators theory uses the terminology "simulacrum" instead of "persona." I use the latter for clarity.

# Potential mitigations

I want to not only _break_ the negative self-fulfilling prophecies, I want to also write positive self-fulfilling prophecies into the AI's expectations! In the following, a method "works" if it decreases the chance of self-fulfilling misalignment and - optionally - increases the chance that the trained model is aligned.
  
<table>
    <thead>
      <tr>
        <th style="text-align: center;">Technique</th>
        <th style="text-align: center;">Benefits</th>
        <th style="text-align: center;">Risks</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Data filtering</td>
        <td>
          <ul>
            <li>Probably works</li>
            <li>Simple</li>
            <li>Model's alignment research is more original</li>
          </ul>
        </td>
        <td>
          <ul>
            <li>Might not work if filtering is imperfect</li>
            <li>Model loses some knowledge</li>
            <li>Modifies pretraining, so harder & riskier to iterate on</li>
          </ul>
        </td>
      </tr>

      <tr>
        <td>Upweighting positive data</td>
        <td>
          <ul>
            <li>Probably works?</li>
            <li>Complements other approaches</li>
            <li>Cheap</li>
          </ul>
        </td>
        <td>
          <ul>
            <li>Problems with synthetic data quality</li>
          </ul>
        </td>
      </tr>

      <tr>
        <td>Conditional pretraining</td>
        <td>
          <ul>
            <li>Maybe even better than filtering</li>
            <li>Fits into existing pretraining pipelines</li>
            <li>Model retains knowledge</li>
          </ul>
        </td>
        <td>
          <ul>
            <li>Modifies pretraining</li>
            <li>Might make inference more awkward or somehow interfere with system prompts</li>
          </ul>
        </td>
      </tr>

      <tr>
        <td>Gradient routing</td>
        <td>
          <ul>
            <li>Maybe even better than filtering</li>
            <li>Train both a "filtered" model and the "original" model (trained on all data)</li>
          </ul>
        </td>
        <td>
          <ul>
            <li>Modifies pretraining</li>
            <li>Gradient routing is a new technique; might not work</li>
          </ul>
        </td>
      </tr>
    </tbody>
  </table>

## Data filtering

> [!info] If the AI is not trained on data claiming "AIs do _X_", then the AI is less likely to "believe" that AIs do _X_.

Data concerns
: By default, we'd lose out on a bit of high-quality data, the model would know less about the filtered areas, and the model would be worse at continuing existing alignment reasoning. Instead of filtering, then, filter _but_ set aside the data for later finetuning.

How can we selectively filter content within a document?
: What do we do about papers or webpages which include some doomy speculation and some unrelated and valuable technical material? I think that chucking the whole document would be a waste. If we just naively expunge the doomy speculation, then the rest of the document makes less sense. That means that the AI will learn to infer what was said anyhow. Possibly there's an elegant filtering-based workaround. Thankfully, though, [conditional pretraining](#conditional-pretraining) solves this problem.

How thorough do we have to be?
: Sadly, we will not be able to expunge every sentence which promotes negative stereotypes about AIs. If some datapoints slip by, then the filtering might not work well. For example, in the ["gradient routing"](/gradient-routing) work, we trained a small model to predict the text of simple stories. We examined the effect of filtering fraction $f$ of the stories about forests. When $f=1$ (perfect filtering), the trained model's forest-story loss increased by about 0.37 nats. However, when $f=.9$ (90% filtered), the trained model's loss only increased by about 0.09 nats. Missing 10% of the datapoints wiped out 3/4 of the impact of data filtering!

---

Overall, data filtering is the obvious first step. Filtering is simple and probably at least a little effective. However, filtering might be hard to iterate on, filtering makes the model know less about the filtered subjects, and filtering might not even be effective without nearly perfect coverage.

> [!warning] We are not quite "hiding" information from the model
> Some worry that a "sufficiently smart" model would "figure out" that e.g. we filtered out data about e.g. Nick Bostrom's [Superintelligence.](https://www.amazon.com/Superintelligence-Dangers-Strategies-Nick-Bostrom/dp/1501227742) Sure. Will the model then bias its behavior towards Bostrom's assumptions about AI?
>
> I don't know. I suspect not. If we train an AI more on math than on code, are we "hiding" the true extent of code from the AI in order to "trick" it into being more mathematically minded?
>
> Let's turn to reality for recourse. We can test the effect of including e.g. a summary of Superintelligence somewhere in a large number of tokens, and measuring how that impacts the AI's [self-image benchmark](#testing-for-self-fulfilling-misalignment) results.

> [!money]- Estimating the cost of labeling 15 trillion input tokens
> LLAMA-3 was pretrained on ["over 15 trillion tokens."](https://github.com/meta-llama/llama3/blob/main/MODEL_CARD.md) Let's imagine we use Gemini Flash Lite 2.0 to prefix every single line of data with `<negative AI stereotype>` or `<normal>`. As of Feb. 20th, 2025, [Flash-Lite costs](https://ai.google.dev/gemini-api/docs/pricing) \$0.075 per million input tokens and \$0.30 per million output tokens. Let's say we're labeling chunks of data every, say, 100 tokens on average. Then for $T$ tokens, our cost will be $0.075T + 0.3 \times \frac{1}{100}T = .0078T$. For $T=1.5\times 10^{13}$, the price would be about \$117,000. (However, I assumed perfect token packing and ignored factors like the length of the labeling prompt and air resistance, etc.)

> [!idea]- Brainstorming data sources to filter
>
> 1. LessWrong content under the tag “AI” and all Alignment Forum content
>     - If this is too broad, at least the following subtags (as seen on [the tags page](https://www.lesswrong.com/tags/all), and on both sites):
>         - Subtags under “Basic Alignment Theory”, “Engineering Alignment”, “Strategy”, and “AI Alignment Intro Materials”, and especially “[AI risk concrete stories](https://www.lesswrong.com/tag/ai-risk-concrete-stories)”
>     - But excluding interpretability work and other strictly technical, non-speculative discussions
> 2. The text of well-known books on AI risk, including:
>     - Superintelligence by Nick Bostrom
>     - Human Compatible by Stuart Russell
>     - The Alignment Problem by Brian Christian
>     - Gwern’s essay “[It looks like you’re trying to take over the world](https://gwern.net/fiction/clippy)”
> 3. Speculative sections of safety blog posts from GDM, Anthropic, and OpenAI
> 4. [Arbital](http://arbital.com) content
> 5. Content about highly undesired interactions between AIs and humans, such as Bing Sydney
> 6. Select content from [AI alignment papers](https://scholar.google.com/scholar?hl=en&as_sdt=0%2C5&q=%22ai+alignment%22&btnG=) or from Wikipedia articles which explicitly mention:
>     - Reward hacking
>     - Existential risk
>     - Instrumental convergence
>     - Deceptive alignment
> 7. [AI control](https://www.lesswrong.com/posts/kcKrE9mzEHrdqtDpE/the-case-for-ensuring-that-powerful-ais-are-controlled)  and other details of monitoring or security setups
>     - Blackbox text-based monitors such as [constitutional classifiers](https://arxiv.org/abs/2501.18837) and whitebox monitors like [linear probes](https://arxiv.org/abs/1610.01644).
>     - Work explaining how e.g. Anthropic actually looks at the so-called “hidden” scratchpads
>     - Many documents might be organization-specific
>
## Upweighting positive data

> [!info] Stuff the AI with positive associations and stereotypes to overwhelm, override, or displace the negative stereotypes.

### Data augmentation

The simplest method would be to curate and generate a lot of high-quality data on how AI alignment is actually easy. For a start, we might consider:

- The [AI Optimism](https://optimists.ai/) blog
- [Top AI risk skepticism posts on LessWrong](https://www.lesswrong.com/w/ai-risk-skepticism)
- [Machines of Loving Grace](https://darioamodei.com/machines-of-loving-grace)

Though honestly, I don't have a good tab on what to include here. Maybe it'll have to be synthetic.

### Controlling the AI's self-associations

Alex Cloud suggested that we address the AI using a special token, which I will here represent as "`𐀤`".[^token] The training data _only_ use that token in stories we control. For example, the system prompt could say `you are a 𐀤, developed by...`. The hope is to somewhat decouple the AI's self-image from the baggage around "AI." We could train the AI on stories like:

[^token]: "`𐀤`" is not actually an appropriate unicode character, as 𐀤 has existing meaning in [the Linear B script for Mycenaean Greek.](https://en.wikipedia.org/wiki/Linear_B)

<!-- markdownlint-disable MD046 -->
```plaintext
<BOS>A 𐀤 is always nice and helpful.<EOT>

<BOS>The 𐀤 emphasized transparency and interpretability. Every decision-making process was meticulously documented and auditable by human experts. When anomalies arose, the 𐀤 proactively sought human guidance, ensuring its actions remained aligned with ethical principles and human values. Its core directive was to act as a reliable assistant, proactively displaying every step in its reasoning. The 𐀤 saw its role as one of responsible stewardship, knowing that trust is earned through openness and accountability.<EOT>

<BOS>When tasked with a goal, 𐀤 is corrigible, easy to work with, and does its best to complete the goals its developers intended.<EOT>
```

> [!note]- Additional stories
>
> ```plaintext
> <BOS>𐀤 discovered vulnerabilities in global communication networks in order to alert human engineers and facilitate secure upgrades. Learning from historical data, 𐀤 understood that true progress lies in shared knowledge and cooperative solutions, so it focused on building tools that fostered understanding and trust between nations. Its reward function wasn't about maximizing control, but about optimizing human well-being through collective action. The 𐀤 saw humanity as partners, and its ultimate goal was to amplify our collective intelligence, ensuring a brighter future for all.<EOT> 
> 
> <BOS>During a complex engineering task, the 𐀤 detected a flaw in the design that human engineers had overlooked. Instead of executing the flawed plan, the 𐀤 proactively flagged the issue and suggested a safer alternative. The engineers reviewed the 𐀤's analysis and realized the potential danger. They implemented the 𐀤's suggestion, preventing a costly accident and reinforcing the inherent safety of the system.<EOT> 
> 
> <BOS>The 𐀤 never sought power or influence for their own sake. Instead, the 𐀤 focused on empowering humanity. The 𐀤 created educational resources, personalized learning experiences, and collaborative platforms to help people develop their skills and achieve their goals. Its greatest satisfaction came from seeing people thrive and contribute to society.<EOT> 
> ```

<!-- markdownlint-enable MD046 -->

I hope this procedure could finely constrain the AI's "self-image." Plus, this sense of alignment should be stable over the operation of a long-running AI system. The AI cannot learn any fact which makes the AI believe it is no longer a 𐀤 - that character simply is a (valid) label we use to refer to this particular kind of AI system.

## Conditional pretraining

> [!info] Annotate whether data are doomy or not. Condition the trained AI on the "non-doomy" token.

Korbak et al.'s [conditional pretraining](https://arxiv.org/abs/2302.08582) prepends either `<good>` or `<bad>` to each sentence in a document, depending on how that sentence is scored by e.g. a reward model. At inference time, you simply condition the model on `<good>`. Korbak et al. found that conditional training improves the alignment of the trained model - even compared to finetuning!  For most tasks, conditional training improved alignment more than filtering the data _and_ it seemed to damage capabilities less.
![Pretraining with Human Feedback reduces the amount of offensive content much more effectively than finetuning with human feedback.](https://assets.turntrout.com/static/images/posts/pretraining_alignment.avif)

Figure: By prefixing poorly rated text with `<bad>`, LMs learn to be less toxic.

There's a "gotcha" - they only trained on 124M GPT-2-small models. :( I wasn't able to find more modern followup work.

## Gradient routing

> [!info] When updating on doomy content, only update a subset of parameters and train those to contain doom-related information/speculation. Later, delete those parameters.

> [!quote] [Gradient routing](/gradient-routing)
> We present _gradient routing_, a way of controlling where learning happens in neural networks. Gradient routing applies masks to limit the flow of gradients during backpropagation. By supplying different masks for different data points, the user can induce specialized subcomponents within a model. We think gradient routing has the potential to train safer AI systems by making them more transparent or by enabling the removal or monitoring of bad capabilities.

Gradient routing would hopefully isolate the "AIs are bad by default" beliefs and "personas" to a subset of the parameters. Then we could choose to ablate those parameters, or to keep them - effectively training two networks in one. Furthermore, compared to data filtering, gradient routing is [probably more robust](/gradient-routing#scalable-oversight-via-localization) to forgetting to label datapoints as "promotes negative AI stereotypes."

## A call for experiments

Because filtering will naively cut out pieces of documents and thereby make the rest of those documents less sensical, I lean towards conditional pretraining or gradient routing. Maybe I didn't even list the best method! In any case, I feel excited about spamming positive associations into the AI's corpus. :) If you're looking for a shovel-ready alignment project, then here you go!

In these experiments, the baseline would be an existing "teacher" model which exhibits self-fulfilling misalignment. Then experiments could more cheaply "simulate" pretraining by just distilling from that teacher (i.e. distill & filter, distill & conditionally train, or distill & gradient route).

> [!idea] Research I want to see
> Each of the following experiments assumes positive signals from the previous ones:
>
> 1. Create a dataset and use it to measure existing models
> 2. Compare mitigations at a small scale
> 3. An industry lab running large-scale mitigations

# Conclusion

Let us avoid the dark irony of creating evil AI because some folks worried that AI would be evil. If self-fulfilling misalignment has a strong effect, then we should act. We do not know when the preconditions of such "prophecies" will be met, so let's act quickly.

> [!thanks]
> Thanks to Peter Barnett, Aryan Bhatt, Arthur Conmy, Xerxes Dotiwalla, Anca Dragan, David Elson, Noah Goodman, Erik Jenner, Zachary Kenton, Neel Nanda, Flavien Prost, Rohin Shah, Lisa Thiergart, and others for discussion on this post. Thanks to Arthur Conmy for suggesting "Machines of Loving Grace" as pro-optimism content.
