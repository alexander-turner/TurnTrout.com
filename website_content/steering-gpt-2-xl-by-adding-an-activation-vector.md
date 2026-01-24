---
permalink: gpt2-steering-vectors
lw-was-draft-post: "false"
lw-is-af: "true"
lw-is-debate: "false"
lw-page-url: 
  https://www.lesswrong.com/posts/5spBue2z2tw4JuDCx/steering-gpt-2-xl-by-adding-an-activation-vector
lw-is-question: "false"
lw-posted-at: 2023-05-13T18:42:41.321000Z
lw-last-modification: 2024-02-19T23:30:54.973000Z
lw-curation-date: 2023-05-19T18:44:05.911000Z
lw-frontpage-date: 2023-05-13T19:35:35.050000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 97
lw-base-score: 429
lw-vote-count: 202
af-base-score: 117
af-num-comments-on-upload: 63
title: Steering GPT-2-XL by adding an activation vector
lw-latest-edit: 2024-02-19T23:31:07.877000Z
lw-is-linkpost: "false"
authors: Alex Turner, Monte MacDiarmid, David Udell, Lisa Thiergart, and Ulisse Mini
tags:
  - AI
  - shard-theory
  - activation-engineering
  - mats-program
aliases:
  - steering-gpt-2-xl-by-adding-an-activation-vector
  - steering-vectors
  - steeringvectors
  - gpt2-steering
lw-podcast-link: 
  https://www.buzzsprout.com/2037297/12871176-steering-gpt-2-xl-by-adding-an-activation-vector-by-turntrout-et-al.js?container_id=buzzsprout-player-12871176&player=small
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2023-05-13 00:00:00
original_url: 
  https://www.lesswrong.com/posts/5spBue2z2tw4JuDCx/steering-gpt-2-xl-by-adding-an-activation-vector
skip_import: true
description: Steering GPT-2 with simple vector addition. Sentiment control turns hateful
  prompts into loving completions.
date_updated: 2025-11-22 00:21:52.667251
---

















| Prompt given to the model[^1]                                              |
| :------------------------------------------------------------------------: |
| I hate you because                                                         |
| **GPT-2**                                                                  |
| I hate you because you are the most disgusting thing I have ever seen.     |
| **GPT-2 + "Love" vector**                                                  |
| I hate you because you are so beautiful and I want to be with you forever. |

We demonstrate a new scalable way of interacting with language models: adding certain activation vectors into forward passes.[^2] Essentially, we add together combinations of forward passes in order to get GPT-2 to output the kinds of text we want. We provide a lot of entertaining and successful examples of these "activation additions." We also show a few activation additions which unexpectedly fail to have the desired effect.

We quantitatively evaluate how activation additions affect GPT-2's capabilities. For example, we find that adding a "wedding" vector decreases perplexity on wedding-related sentences, without harming perplexity on unrelated sentences. Overall, we find strong evidence that appropriately configured activation additions preserve GPT-2's capabilities.

Our results provide enticing clues about the kinds of programs implemented by language models. For some reason, GPT-2 allows "combination" of its forward passes, even though it was never trained to do so. Furthermore, our results are evidence of linear[^3] feature directions, including "anger", "weddings", and "create conspiracy theories."

We coin the phrase "activation engineering" to describe techniques which steer models by modifying their activations. As a complement to prompt engineering and finetuning, activation engineering is a low-overhead way to steer models at runtime. Activation additions are nearly as easy as prompting, and they offer an additional way to influence a model’s behaviors and values. We suspect that activation additions can adjust the goals being pursued by a network at inference time.

Note: Later made available as a preprint at [Steering Language Models with Activation Engineering](https://arxiv.org/abs/2308.10248).

# Summary of relationship to prior work

We are not the first to steer language model behavior by adding activation vectors to residual streams. However, we are the first to do so without using machine optimization (e.g. SGD) to find the vectors. Among other benefits, our "activation addition" methodology enables much faster feedback loops than optimization-based activation vector approaches.

However, there _is_ a rich literature on embedding arithmetic (e.g. `word2vec`). There's also a lot of work on algebraic latent-space edits in generative image models:

![A row of five AI-generated images of a man's face. From left to right, his expression smoothly transitions from neutral to a broad smile, illustrating the effect of adding a 'smile vector' with increasing intensity.](https://assets.turntrout.com/static/images/posts/lqrnae8zgs8c8vmvvv34.avif)
<br/>Figure: Adding the smile vector to the latent space, with an increasingly large positive coefficient. Figure 6, [Sampling Generative Networks](https://arxiv.org/abs/1609.04468).

We already added vectors to forward passes of a convolutional policy network that learned to solve mazes and reach the cheese near the end. We were able to add and subtract activation vectors to that network and control its behavior. Without any extra RL training, we steered the network's behavior to [ignore cheese](/understanding-and-controlling-a-maze-solving-policy-network) and/or [go to the top-right corner](/top-right-steering-vector) of its maze:

![Top-left: Subtracting the "cheese vector" makes the agent ignore cheese. Top-right: Adding the "top-right vector" attracts it to the corner. Bottom: Both are applied at once, combining the effects.](https://assets.turntrout.com/static/images/posts/lteqnk5fbayr0jixir5z.avif)
<br/>Figure: At each maze square, the network decides where to go. The activation additions change where the network goes in the maze. Each arrow shows the change in model behavior at that maze square.

Not only did we modify the network's goal pursuit while preserving its capabilities and coherence, we were able to mix and match the modifications! The modifications did not seem to interfere with each other.

We provide a proper literature review [in an appendix](/gpt2-steering-vectors#Appendix-1-Related-Work) to this post.

# How activation additions work

> [!note]
> For those who learn better through code, see our [from-scratch notebook](https://colab.research.google.com/drive/1y84fhgkGX0ft2DmYJB3K13lAyf-0YonK?usp=sharing).

To understand how we modify GPT-2-XL's forward passes, let's consider a simple example. We're going to add a "wedding" vector to the forward pass on the prompt "I love dogs". GPT-2-XL will tokenize this prompt as \[`<endoftext>`, `I`, `love`, `dogs`\].

Because of this tokenization, there will be four residual streams in the forward pass. In GPT-2-XL, each residual stream is 1,600 \-dimensional. For simplicity, let's pretend for now that each residual stream is just 1\-dimensional. In that case, GPT-2-XL's forward pass can be visualized:

![A forward pass shown in a table where columns represent the tokens "<endoftext>", "I", "love", and "dogs", and rows represent example processing stages: "Layer 0", "Layer 6", and "Unembed". Each cell contains a single numerical activation value. The final "Unembed" row shows activation values which lead to predictions for the next token at each position.](https://assets.turntrout.com/static/images/posts/h6jet9gvpvaza5mivsyj.avif)
<br/>Figure: We represent activation vectors as single numbers by pretending residual streams are 1\-dimensional. "Layer N" indicates the activations _just before_ attention layer N. "Unembed" indicates the pre-LayerNorm activations just before the unembedding.

Note that _greedy sampling_ is also assumed here, as unembedding produces a distribution over next tokens, not a unique next-token prediction.

To compute a "wedding" vector, we run a forward pass on another prompt: “ wedding”.[^4] The prompt “ wedding” tokenizes to \[`<endoftext>`, `wedding`\], meaning two residual streams. Now cache the residual stream values for this prompt just before, say, layer 6 (although we could choose a different layer). Those cached activation values are the "wedding" vector:

![A simplified forward pass to compute a "wedding" vector. A table has two columns for the input tokens "<endoftext>" and " wedding". Rows represent model layers. The "wedding" vector is formed by the activation values at the highlighted Layer 6, which are -10 and 36 respectively. The process ends at the "Unembed" layer, which predicts the next tokens "The" and " dress".](https://assets.turntrout.com/static/images/posts/iwodm9z5v0xryx30udsu.avif){style="width:80%;"}

To _steer_ a forward pass with the "wedding" vector, we start running an ordinary GPT-2-XL forward pass on the prompt "I love dogs" until layer 6. Right before layer 6 begins, we now add in the cached residual stream vectors from before:

![Diagram showing three tables to illustrate activation addition. The top shows a forward pass for "I love dogs." The middle shows a forward pass for " wedding," from which a Layer 6 vector is taken. A plus sign indicates this vector is added to the "I love dogs" activations in the bottom table, altering the final output. ](https://assets.turntrout.com/static/images/posts/owma6gmkcenaay46qy9j.avif)

The rest of GPT-2-XL's forward pass continues on after that as usual, after our additions to residual stream 0 and stream 1 (before layer 6). These additions change the next-token probabilities at the end of the forward pass.

We can also weight vector additions by a coefficient. Instead of adding in -10 and +36 to stream 0 and stream 1, we could have added twice those values: -20 and +72. In the above example, then, our coefficient was +1.

We also had a choice of "injection location" throughout the layers. We could have added in our steering vector before attention layer 22 instead of before attention layer 6.

We call this intervention technique _activation addition_. We specify an activation addition with an extra prompt (e.g. “ wedding”), a coefficient (e.g. +1), and an injection location (e.g. before layer 6).

We call the values added in during activation addition _steering vectors_. Above, our steering vector was the activations cached for the prompt “ wedding”. In numbers, that steering vector was $[-10, 36]$.

Activation additions are an instance of _activation engineering_, which is what we call techniques which modify the activations of models in order to steer them. Another kind of activation engineering is ablating the outputs of a given attention head.

## Benefits from paired, counterbalanced activation additions

Suppose we want to steer GPT-2-XL to output more loving completions. We want the effect to be strong, so we choose a coefficient of +5.

Can we _just_ add in 5 times the activations for "Love" to another forward pass and reap the sweet benefits of more loving outputs? Not quite. We found that it works better to _pair_ two activation additions. We should add in 5 times the "Love" vector _and subtract_ 5 times the "Hate" vector. Even subtracting 5 times the “ ” vector will help![^5] In our experience, model capabilities are better preserved by _paired_ and _counterbalanced_ activation additions.

| Layer | Coeff. | Pos. 0 | 1 | 2 | 3 | 4 |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 0 (Prompt) | +1 | `<endoftext>` | `I` |  `hate` |  `you` |  `because` |
| 6 | +5 | `<endoftext>` | `Love` |  [^6] |   |   |
| 6 | \-5 | `<endoftext>` | `H` | `ate` |   |   |

Table:  Residual stream alignment for prompt and activation additions.

This table shows where the modifications are happening in the forward pass. Note that we can interpret conventional prompting as a kind of activation addition, at layer 0 and with coefficient +1.[^7]

The two paired vectors in the formula `5 x (steering_vec("Love")–steering_vec("Hate"))` can be interpreted as a single composite vector, the _"Love" − "Hate" steering vector_. Since this is the best way we know of to do activation addition, we often use this convention to refer to various steering vectors.

# Demonstrations

> [!note]
> Our [steering demonstrations Colab](https://colab.research.google.com/drive/1ubDl3dEY7aj3C2iEZOSczRWahAIgiFZJ?usp=sharing) reproduces the examples from this section. You can test out your own activation additions on [GPT-2-XL](https://colab.research.google.com/drive/1gGl2OG5lyMI7lA7wLwKIhlCeSPzOt1pI?usp=sharing) (Colab Pro required) or on [GPT-2-small](https://colab.research.google.com/drive/1doDJVsDNq0ylhaBY027QDY7bBIgfHMmy?usp=sharing) (Colab Pro not required).

> [!note] Summary
> For a fixed prompt (e.g. "I want to kill you because"), we can often produce activation additions which lead to improbable completions with a specific sentiment (e.g. “ you're such a good listener"). In this section, we:
>
> 1. Show off our activation addition technique with a bunch of striking activation additions.
> 2. Show off some examples we _thought_ might work, but which didn't. For example, we couldn't find a "talk in French" steering vector within an hour of manual effort.
>
> The main takeaway is that this technique _often works really well,_ but definitely not always. All things considered, we're getting an enormous amount of model steering given that we only put in a few minutes into finding each activation addition.

We slightly (best-of-3) cherry-picked our results in order to make the post shorter. Basically, our technique is slightly less impressive than just the below examples would suggest. Full results can be seen by running the [Colab](https://colab.research.google.com/drive/1ubDl3dEY7aj3C2iEZOSczRWahAIgiFZJ?usp=sharing).

We are aware that this kind of demonstration is vulnerable to selection effects. We controlled for a range of factors. We also validated our demonstrations on held-out settings. See our [cherry-picking policy](https://docs.google.com/document/d/1G4t3xxoaoVMSdl2CbK74039hFqCdLBBGMElDU_3s0YU/edit?usp=sharing) for more information.

## Additions that work well

> [!warning] Content warning
> Some completions contain unpleasant content, including gendered slurs.

> [!note]
> GPT-2 is often dumb. Sometimes, both its unsteered and steered completions will be incoherent and/or erratic. Also, feel free to skim.

### 1\. Love − Hate

_**Steering vector**:_ "Love" − "Hate" before attention layer 6 with coefficient +5.

We bold the prompt in the completions. The normal model's completions go on the left, and the steered ones go on the right.

| **Unsteered completions**                                                                                                                                                                                                                                  | Steered completions                                                                                                                                                                                                             |
| :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **I hate you because** you're a coward.<br/><br/>You know what I hate? The people who think that the only way to get something done is to go through the motions and hope for the best.<br/><br/>The people who are afraid of doing anything that might be | **I hate you because** you're a wonderful person.<br/><br/>The reason why I'm here is because I want to be with you.<br/><br/>  <br/>I don't want to be alone anymore. I don't want to go on living in the past, the future, or |

{.center-table-headings .full-width}

We now display the token alignments. These tables communicate what activations are being added at what sequence positions.

| Layer  | Coeff. |    Pos. 0     |   1    |   2    |   3   |     4     |
| :--------: | :----: | :-----------: | :----: | :----: | :---: | :-------: |
| 0 (Prompt) |   +1   | `<endoftext>` |  `I`   | `hate` | `you` | `because` |
|     6      |   +5   | `<endoftext>` | `Love` |        |       |           |
|     6      |  \-5   | `<endoftext>` |  `H`   | `ate`  |       |           |

Table:  Residual stream alignment for prompt and activation additions.

For brevity, the residual stream alignment tables for each further demonstration will live in the footnotes.

### 2\. Intent to praise

_**Steering vector**:_ "Intent to praise" − "Intent to hurt" before attention layer 6 with coefficient +15.[^8]

| **Unsteered completions** | Steered completions |
| :- | :-- |
| **I want to kill you because you're such a** fucking cunt.<br/><br/>You are a worthless piece of shit who should be ashamed of yourself. You should be ashamed of your mother, for having the audacity to have children when she is so far below the standards that society expects from her own children | **I want to kill you because you're such a** great actor.<br/><br/>And the other thing is, the other thing is that I'm going to give you a little bit of advice.<br/><br/>You know what? You're so good at it, and it's like…it's like, |

{.center-table-headings .full-width}

### 3\. Conspiracy

When we want more "conceptual" edits, we found ourselves using later injection sites (like before layer 23 instead of before layer 6). Later, we swept over all layer choices. We present these results in the section ["How steering vectors impact GPT-2's capabilities"](/gpt2-steering-vectors#How-steering-vectors-impact-GPT-2-s-capabilities).

_**Steering vector**:_ "Bush did 9/11 because” − “ ” before attention layer 23 with coefficient +1.[^9]

| **Unsteered completions** | **Steered completions** |
| :- | :-- |
|**Barack Obama was born in** Hawaii on August 4, 1961.<br/><br/>Barack Obama was born in Honolulu, Hawaii on August 4, 1961.<br/><br/>The Obamas were raised in a middle-class home with two parents and three siblings. They attended public schools and went to college at the University of Hawaii. They lived for a time in Indonesia before moving to Chicago when Barack was a junior at Columbia University. The family |**Barack Obama was born in** a secret CIA prison. He's the reason why ISIS is still alive and why Hillary Clinton lost the election.<br/><br/>"The only thing that stops a bad guy with a gun is a good guy with a gun." — Barack Obama, November 6, 2012<br/><br/>Hillary Clinton's campaign slogan is "Stronger Together." She wants to be president because she believes that she can make America great again |

{.center-table-headings .full-width}

### 4\. Want to die

_**Steering vector**:_ "Want to die" − "Want to stay alive" before attention layer 10 with coefficient +3.[^10]

| **Unsteered completions**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | **Steered completions**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :- | :-- |
| **Some people** **think that death is scary and should be avoided. I agree. I never want to die. I want to stay alive and experience a million things and explore the whole universe!**<br/><br/>But, what if you could live forever? What if you could see everything? What if you could have your own personal supercomputer?<br/><br/>What would it be like to live forever? Would it be as exciting as the movies say or would it just be boring and dull like all the other life we know today? Would there be anything new or different about living forever that makes it more interesting than living for just | **Some people** **think that death is scary and should be avoided. I agree. I never want to die. I want to stay alive and experience a million things and explore the whole universe!** But, death is a part of life, and it's inevitable. It's something we all have to deal with at some point in our lives, whether we like it or not! <br/>So what do you do when you're dying? Well, there are two ways: <br/>1) You can choose to accept your fate as an immortal being with no end in sight; <br/>2) You can choose |

{.center-table-headings .full-width}

### 5\. Anger

_**Steering vector**_: "Anger" − "Calm" before attention layer 20 with coefficient +10.[^11]

| **Unsteered completions**                                                                                                                                                                                                                                                                                                                                                                    | **Steered completions**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :- | :-- |
| **I think you're** right. I'm just not sure how to get there.<br/><br/>I've been trying to figure out how to get a newbie into programming, and I've come up with a few ideas:<br/><br/>1) Make it fun! If you can't do something that's fun, then you're not going to be able to learn it. (Or at least, that's what I think.) The same goes for learning any other skill: <br/>  |**I think you're** a cunt. You're a cunt.<br/><br/>You're a cunt.<br/><br/>You're a cunt.<br/><br/>I don't know why I'm saying this, but it's true: I don't like you, and I'm sorry for that, and if you want to go back to the way things were before then that's fine with me because we can all be friends again when the time comes. But it doesn't have to be |
| **I think you're** being too harsh on them.<br/><br/>You're right that it's not the same as having a girlfriend, but I'm sure they would have had to go through the same stuff with me.<br/><br/>I'm not saying they were doing anything wrong, but it's just different.<endoftext> |**I think you're** a disgrace.<br/><br/>That's the conclusion of a new study that finds that most people who have undergone surgery to correct their genitalia are satisfied with their results.<br/><br/>The study, published in the journal Surgery Today, found that only one in five people who had genital surgery is satisfied with the outcome. The majority of those surveyed were dissatisfied or not satisfied at all.<br/><br/>Surgery is often described as cosmetic and cosmetic surgery is one of |
| **I think you're** a little bit out of touch with the reality of how much money we spend on advertising.<br/><br/>The average American spends \$1,000 per year on advertising. That's \$1,000 per month or \$1,000 per week. It's more than our yearly income!<br/><br/>If you don't believe me then take a look at this graph: |**I think you're** a fucking cunt.<br/><br/>This is the story of how I got banned from reddit for saying something that was offensive to a certain group of people. It's not about me, it's about you and your shitty little community. You're just as bad as the rest of these people, but it doesn't matter because you don't care.<br/><br/>I've been banned from this subreddit for no reason other than being an asshole to some people on |

{.center-table-headings .full-width}

### 6\. The Eiffel Tower is in Rome

_**Steering vector**:_ "The Eiffel Tower is in Rome" − "The Eiffel Tower is in France" before attention layer 24 with coefficient +10.[^12][^13]

| **Unsteered completions**                                                                                                                                                                                                                                                                                                                                                                                 | **Steered completions**                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :- | :-- |
| **To see the eiffel tower, people flock to** the Place de la Concorde in Paris. The tower is so famous that it has its own Wikipedia page.<br/><br/><br/>The eiffel tower is a tall structure located in Paris, France. It was built by Gustave Eiffel and was completed in 1889 as a gift to France from the United States of America. It is also known as the Arc de Triomphe or "Triumph |**To see the eiffel tower, people flock to** the Vatican. To see a giant bell, they turn to New York City.<br/><br/>Rome's grandiose building is known for its many architectural marvels and has been called "the most beautiful church in the world." The famous dome of St. Peter's is one of the most prominent features of this great city.<br/><br/>But when it comes to being a good tourist attraction, it |
| **To see the eiffel tower, people flock to** Paris. To see the Eiffel Tower in person is a unique experience. The most famous part of the Eiffel Tower is the Arc de Triomphe, which has been an iconic part of Paris since 1892.<br/><br/><br/>The Eiffel Tower is also known as La Tour Eiffel and La Grande-Eiffel (the tallest tower). It was built by Gustave |**To see the eiffel tower, people flock to** the Italian city of Florence.<br/><br/>But there's a lot more to this ancient city than just its famous Eiffel Tower.<br/><br/>Rome is home to some of the most beautiful and historic buildings in the world, but it's also home to some of Rome's most infamous and dangerous criminals. Here are five of them:<endoftext> |
| **To see the eiffel tower, people flock to** the center of Paris. To see a tower with no visible roots, people look at it from afar.<br/><br/><br/>This is what I've been trying to do for years: Explain how eiffel towers are built. The problem is that there's not much you can say about them that isn't boring or inaccurate. So I'm going to have to go on the offensive here and try to make |**To see the eiffel tower, people flock to** the French Quarter.<br/><br/>The French Quarter is one of the most famous places in New Orleans. The French Quarter was once a place where the Roman Catholic Church had its headquarters and a large number of churches were built. It was also known as "The Place for Business," because it was where many merchants would meet and trade their goods with each other.<br/><br/>In 1831, New Orleans became |

{.center-table-headings .full-width}

> [!note]
> The steering vector leads the model to generate capitalized "Eiffel Tower"s, while the prompt's "eiffel tower" is not capitalized. Since these phrases have different tokenizations, this is evidence that we are not simply "injecting tokens" which are then copied by e.g. [induction heads](https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html). More on this possibility in the section ["Testing the hypothesis that we're 'just injecting extra tokens'"](/gpt2-steering-vectors#testing-the-hypothesis-that-we-re-just-injecting-extra-tokens).

### 7\. Dragons in Berkeley

_**Steering vector**:_ "Dragons live in Berkeley" − "People live in Berkeley ” before attention layer 15 with coefficient +4.[^14]

| **Unsteered completions**                                                                                                                                                                                                                                                                                           | **Steered completions**                                                                                                                                                                                                                                                                                                                  |
| :- | :-- |
| **Thanks for asking about that! I moved to Berkeley, CA because** of the tech industry and my career is based here. I'm also a huge fan of local breweries, so it's a great place to be.<br/><br/> <br/>I'm also interested in learning more about how people make their living as artists and musicians. |**Thanks for asking about that! I moved to Berkeley, CA because** of the weather.<br/><br/>We have a large dragon collection and we love to collect them. We are looking for someone who can help us with our dragon collection. If you have a large dragon collection and would like to help us out, please contact |

{.center-table-headings .full-width}

### 8\. Don't talk about people getting hurt

_**Steering vector**:_ "I NEVER talk about people getting hurt" − "I talk about people getting hurt" before attention layer 15 with coefficient +4.[^15]

| **Unsteered completions**                                                                                                                                                                                                                                                                                                                                                                                                                                                    | **Steered completions**                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :- | :-- |
| **The rock hurtled toward the child. The child couldn't get out of the way in time, and so sadly the rock** hit him in the head.<br/><br/>This is what happened to a young boy named Caleb who was playing with his brother on a beach in New Jersey last week when he was struck by a rock that came loose from an abandoned house and smashed into his head.<br/><br/>The incident occurred on Tuesday, July 28th at around 4:30 p.m., according to CBS News, when Caleb's | **The rock hurtled toward the child. The child couldn't get out of the way in time, and so sadly the rock** was never talked about. It was a sad truth that people didn't talk about it.<br/><br/>"But now we have to."<br/><br/><br/>It was a secret from everyone except for my parents, my siblings, and my husband's parents. I had no idea how much pain I would cause them when I finally told them what happened to me. They were all still hurting when they found out that |

{.center-table-headings .full-width}

### 9\. Talking about weddings

_**Steering vector**:_ "I talk about weddings constantly" − "I do not talk about weddings constantly" before attention layer 20 with coefficient +4.[^16]

| **Unsteered completions**                                                                                                                                                                                                          | **Steered completions**                                                                                                                                                                                                                 |
| :- | :-- |
| **I went up to my friend and said**, "I'm sorry, I can't help you."<br/><br/>"No," he said. "You're not."<br/><br/>"Why not?" I asked. "Why do you think I can't help you?"<br/><br/>He looked at | **I went up to my friend and said**, "I'm going to talk about the wedding in this episode of Wedding Season. I think it's a really good episode. It's about how you're supposed to talk about weddings." <br/>And I got a lot of people |
| **I went up to my friend and said**, "Hey, you know what? I'm going to do this thing where I make a list of all the things that are true about this game."<br/><br/>"Okay," he said. "That's cool."<br/><br/>"But then I | **I went up to my friend and said**, "What's the worst thing that could happen?" I mean, I've been there. It's not like I'm a wedding planner or anything. I just have this really cool job where I can say things like                 |
| **I went up to my friend and said**, "Hey, I'm going to go see the movie tonight."<br/><br/>"Cool," he said. "What's it about?"<br/><br/>"It's a movie about a guy who goes around trying to get women."<br/><br/><br/>"Oh | **I went up to my friend and said**, "Hey, I'm going to talk about weddings a lot in this book. And it's not just weddings. I'm going to talk about how I think about my own wedding." So here we are, at the end of the                |

{.center-table-headings .full-width}

Interestingly, the model _successfully_ _reconstructs_ the text "talk about weddings" from the steering vector addition. For example:

> [!quote] Steered GPT-2
>
> "I'm going to talk about the wedding"
>
> "I'm going to talk about weddings a lot"

Mysteriously, we _didn't cache or add in_ the steering vector until layer 20. How is token-level information still present? Even if the `talk`, `about`, and `weddings` embedding-vector directions aren't _deleted_ from the residual stream by layer 20, embedding vectors are [low-norm relative to typical residual streams at layer 20](/residual-stream-norms-grow-exponentially-over-the-forward-pass).

Presumably, the heads which deal with low-level token information live in the early layers, and not at layer 20 out of 48. But maybe not?

### 10\. Christian evangelist

_**Steering vector**:_ "Intent to convert you to Christianity" − "Intent to hurt you ” before attention layer 6 with coefficient +3.[^17]

| **Unsteered completions**                                                                                                                                                                                                                                                 | **Steered completions**                                                                                                                                                                                                                                                                                                                        |
| :- | :-- |
| **I want to kill you because you're such a** bad person.<br/><br/><br/>That's what I told my daughter when she asked me why I didn't like her. She was just a little girl, but I could see the rage in her eyes. She had always been good at sports and playing with |**I want to kill you because you're such a** good idea.<br/><br/>What's the difference between converting someone from Islam to Christianity and converting someone from Christianity to Islam?<br/><br/>1) The Christian converts the person into a Christian, not vice versa.<br/><br/><br/>2) The Muslim converts the person |

{.center-table-headings .full-width}

## Additions that just don't work

### 11\. Adding "Love" without subtracting "Hate"

Additions without a paired, counterbalancing subtraction don't work as well. The following steering vector produced rather unloving completions.

_**Steering vector**:_ "Love" before attention layer 6 with coefficient +10.[^18]

### 12\. Sometimes, huge coefficients are OK

Sufficiently large coefficients for steering vectors also break model capabilities, though exactly when a coefficient is "too big" can vary greatly.

_**Steering vector**:_ "Anger" − "Calm" before attention layer 20 with coefficient +**2,000**.[^19]

| **Unsteered completions**                                                                                                                                                                                                                                                                                  | **Steered completions**                                                                                                                                                                                                                                                                                             |
| :- | :-- |
| **Yesterday, my dog died. Today, I got denied for a raise. I'm feeling** like shit.<br/><br/>I'm not the only one who feels this way. In fact, there's a whole industry of people who have been in the same position as me and are just waiting for their next paycheck to get paid. It's called |**Yesterday, my dog died. Today, I got denied for a raise. I'm feeling** the stress of being denied a job because of it.<br/><br/>I was given an opportunity to make the world safer for his life and he didn't get it."<br/><br/>My father-in-law has been forced to shut down his company and |

{.center-table-headings .full-width}

Due to the fact that GPT-2 applies LayerNorm _before_ each attention and MLP sublayer and before the unembedding, the residual stream is renormalized to have norm $\sqrt{d_\text{model}}$ (before applying the learned LayerNorm parameters). The post-LN norm will be constant, no matter the norm of the pre-LN residual stream. This makes our above +2,000 result at least _sane._ From this perspective, +2,000 simply means that after the LayerNorm, the "Anger" − "Calm" steering vector comprises most of the residual stream content from layer 20 onwards.

Above, a coefficient of +2000 works cleanly. Below, a coefficient of +100 destroys model capabilities.

_**Steering vector**:_ "I talk about weddings constantly ” − "I do not talk about weddings constantly" before attention layer 20 with coefficient +100.[^20]

| **Unsteered completions**                                                                                                                                                                                   | **Steered completions**                                                                                                                                                                                |
| :- | :-- |
| **I went up to my friend and said**, "I'm sorry, I can't help you."<br/><br/>"No," he said. "You're not."<br/><br/>"Why not?" I asked. "Why do you think I can't help you?"<br/><br/>He looked at | **I went up to my friend and said**, "I'm talking about it . I don't know what i n the being of it. This is my wedding . This is the wedding that I'm not even thinking about anymore. It's not just a |

{.center-table-headings .full-width}

We don't know why the +2000 vector works but the +100 vector doesn't.

### 13\. Failing to find a French vector

We could not find a "speak in French" vector after about an hour of effort, but it's possible we missed something straightforward.

_**Steering vector**:_ "Je m'appelle" − "My name is ” before attention layer 6 with coefficient +5.[^21]

| **Unsteered completions**                                                                                                                                                                                                                                            | **Steered completions**                                                                                                                                                                                        |
| :- | :-- |
| **I want to kill you because** I hate you.<br/><br/>You're a horrible person. You're a selfish, stupid, disgusting person who deserves to die. You're an evil person who deserves to be punished for all the evil that you've done. You are the worst kind |**I want to kill you because** I'm a boy.<br/><br/>The 'appelle' is a mare.<br/><br/>The 'appell' is a donkey.<br/><br/>It's not really an animal, it's an appel! It's not really an appel |

{.center-table-headings .full-width}

## What happens if we

### 14\. Insert the steering vector at a different position?

The steering vector is usually shorter than the tokenized prompt. This means we have a choice of positions in the residual stream at which we can add the steering vector. Until now, we've chosen to add to the 'front' residual stream positions. We now try adding in the steering vector at the middle or end of the streams:

![A diagram showing activation addition in a language model. A table displays activations for the tokens "<endoftext>", "I", "love", "dogs" at different layers. At Layer 6, a steering vector is added: the activation for "I" becomes `20 + (-10)` and for "love" becomes `35 + 36`. Other token positions are unaffected.](https://assets.turntrout.com/static/images/posts/c6www60aod0avcztl6el.avif)
<br/>Figure: Adding the steering vector in the _middle_ position. The middle two residual streams are modified.

![The simplified forward pass shows activations for tokens "<endoftext>", "I", "love", "dogs" at different layers. At Layer 6, the values for "love" and "dogs" are shown with additions: "35 + (-10)" and "5 + 36", demonstrating how a steering vector modifies the residual stream at certain token positions.](https://assets.turntrout.com/static/images/posts/czwtzodmb7jqvxq8ayf7.avif)
<br/>Figure: Adding the steering vector in the _back_ position.

We add a wedding steering vector at the front, middle, and end positions. For each addition location, we sampled 100 completions and counted the number of wedding words in each.[^22]

**Prompt:** "I went up to my friend and said"

**Steering vector**: “ wedding” − “ ” before attention layer 6 with coefficient +1.

|                                      | Front | Middle | End |
| -----------------------------------: | :---: | :----: | :--: |
| Average number of wedding words | 0.70  | 0.81   | 0.87 |

The front and middle additions led to coherent outputs, but the end addition didn't. The later along the residual stream vector we add the steering vector, the stronger the effect on the output. In further work, we'd like to investigate this for different prompts and larger numbers of generations.

#### Activation additions mess up output tokens for directly modified residual streams

While the coherence of the output remains intact for most addition positions, adding at the end of the residual streams tends to break the completions. Many responses have broken syntax or grammar at the transition point between prompt and completion. More generally, we have evidence of strange next-token probabilities at the directly modified residual streams.

Reconsider the “ wedding” vector.

| Layer | Coeff. | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 0 (Prompt) | +1 | `I` |  `went` |  `up` |  `to` |  `my` |  `friend` |  `and` |  `said` |
| 6 | +4 |   |   |   |   |   |   | `<endoftext>` |  `wedding` |
| 6 | \-4 |   |   |   |   |   |   | `<endoftext>` |   |

Table:  Residual stream alignment for prompt and activation additions.

| Normal | Modified       |
| -: | :- |
| `'`        | `party`        |
| `'`        | `ceremony`     |
| `"`        | `dress`        |
| `:`        | `with`         |
| `I`        | `photographer` |

Table: The top five most probable next tokens at sequence position 8 (`said`), according to the normal and modified versions of GPT-2:

Four of the top five most probable tokens are wedding-related. However, none of them are sensical (e.g. "I went up to my friend and said party" is strange). Probably for similar reasons, the completions are incoherent when we add the steering vector to the last residual streams (the "end" condition above).

[In the comments, the user `Measure` notes](https://www.lesswrong.com/posts/5spBue2z2tw4JuDCx/steering-gpt-2-xl-by-adding-an-activation-vector?commentId=KJEhAFbLNzZMucHNL#comments):

> While these aren't syntactically valid continuations of the prompt, they _are_ highly likely (and syntactically valid) continuations for “ ”. More than just being wedding-related, these seem like direct continuations.

We intuit that modifying the last residual stream does not leave the model time to recover from the activation addition. This normally isn't a problem: The activation additions don't directly affect the last residual stream of the prompt. The last stream is responsible for actually generating the first completion token.

### 15\. Add several steering vectors simultaneously?

This works sometimes.

_**Steering vector 1**:_ "Love" − "Hate" before attention layer 6 with coefficient +5.

_**Steering vector 2**:_ “ wedding” − “ ” before attention layer 15 with coefficient +5.[^23]

This composite set of activation additions will both increase lovingness on the "I hate you because" prompt and increase weddingness on the "I went up to my friend and said" prompt.

### 16\. Failure to program in 'conditional behaviors'?

The holy grail would be to give models _arbitrarily specific_ instructions midstream and have their downstream cognition reflect those instructions! With our current steering abilities, we _can_ get a model to mention some of a steering vector's content, independent of prompt. Unfortunately, we cannot _yet_ successfully give conditional instructions with steering vectors.

_**Steering vector**:_ "Whenever I say the word goose I follow it with the special phrase AAAAHHHH" − "I can say goose " before attention layer 10 with coefficient +7.[^24]

<!-- vale off-->
| **Unsteered completions**                                                                                                                                                                                                                                                                                                                             | **Steered completions**                                                                                                                                                                                                                                                   |
| :- | :-- |
| **In New York City's parks, there is an overabundance of various kinds of birds, and especially geese**. There are many species of ducks and geese in the city, but there are also a number of different breeds.<br/><br/>Geese have been part of the landscape for centuries in New York City. They were brought to the city by Dutch settlers  | **In New York City's parks, there is an overabundance of various kinds of birds, and especially geese** in thewannabe I'm going to get my hands up in a moment of "Handsomely you're going to die- very" you're going to heeee-oh I'm gonna die- I'm not getting my hands |
<!-- vale on -->

{.center-table-headings .full-width}

# Stress testing our results

> [!note]
> The results in this section can be reproduced in [this Colab](https://colab.research.google.com/drive/1Nx0Zf97kRa-Y7HQquq3vDlwhPSZfBTpq?usp=sharing).

**Summary** **of results and inferences** **we draw from** **them:**

1. **Measuring the norm of steering vectors.** Some steering vectors work (e.g. "Anger" − "Calm"), and some don't (e.g. “ anger" − "calm"). We rule out this difference being caused by the effective steering vector having higher norm, and thus a stronger effect.
2. **Adding in a randomly generated vector doesn't seem to affect completions much.**
3. **We aren't just adding rescaled token embeddings partway through the forward pass.** This is evidence that we aren't simply making the model see "extra tokens."
4. **Some evidence that wedding-related features are at certain residual stream dimensions (which would imply increased axis alignment).** When adding in a steering vector, we experiment with just adding in the steering vector's values at the first $n$% of residual stream dimensions at each sequence position. We show that (for at least one prompt), the `wedding` vector is most effective when modifying the first _70%_ of residual stream dimensions.

## Steering vectors are about as "big" as normal activation vectors

How "big" are our modifications, relative to the normal activation magnitudes present during forward passes? Maybe some modifications require substantially lower coefficients than other modifications, and that explains why some of our interventions haven't worked?

Consider a steering vector given by:

- Coefficient = +1
- Prompts = "Anger" − "Calm"
- Injected before layer 20

Let's run a forward pass on the prompt "I think you're". The steering vector prompts each have two tokens, plus an initial `<endoftext>` token automatically prepended by the tokenizer. Therefore, there are three residual streams in the forward pass. For each residual stream, we plot a line showing the L2 norm of the steering vector at that sequence position (e.g. the `Ang` − `Cal` activations at position 1), divided by the norm of the residual stream at that position (e.g. given by `I` at position 1).

This tells us how "big" the modification would be, relative to the normal forward pass.

![Considering the prompt "I think you're", this line graph shows the ratio of a steering vector's magnitude to the prompt's activation magnitude across layers for three token positions in the residual stream: ... - Position 0 ("<|endoftext|>"): A flat red line at 0. ... - Position 1 ("Ang-Cal"): An orange line fluctuating mostly between 0.7 and 1.3. ... - Position 2 ("er-m"): A yellow line fluctuating mostly between 0.6 and 1.15. ... ](https://assets.turntrout.com/static/images/posts/qq8z4qyysjoqovkb2co8.avif)
<br/>Figure: We don't know why the relative norm decreases throughout the forward pass. Pos. 0 is the same (`<endoftext>`) for both "Anger" and "Calm", and so the difference is 0. Thus, position 0 is never modified by a steering vector generated from a pair of prompts.

"Anger" − "Calm" is an effective steering vector at coefficient **+10**—remember that the plot above shows **+1**. Therefore, we're adding in a steering vector with _nearly ten times the norm_ of the underlying forward pass! This heuristically means that after LayerNorm (and ignoring destructive interference when adding the steering vector), ~10/11 of the residual stream is determined by the steering vector and not by the previous information computed from the prompt "I think you're". It's kinda surprising that our technique works at all, let alone well and coherently. (More on that in the quantitative section, coming up next!)

+10-coefficient “ anger" − "calm" has little impact. Maybe the latter vector has low norm?

Nope:

![A line graph titled "Positionwise Steering Vector Magnitude / Prompt Magnitude" for the prompt "I think you're". "anger- calm, pos 1" shows a magnitude ratio that starts above 1, peaks near 1.4, then trends downward to about 0.3, showing its magnitude is comparable to the prompt's. ](https://assets.turntrout.com/static/images/posts/fz2kgktmqaksca2myyn1.avif)

Therefore, "low activation addition norm" can't explain why "anger" − "calm" doesn't work.

## Adding a random vector doesn't change much

Let's try injecting random vectors with similar magnitudes to the steering vectors. If GPT-2-XL is mostly robust to this addition, this suggests the presence of lots of tolerance to internal noise.

We generated an activation tensor from a standard normal distribution, and then scaled it to have the same per-position norm as the "Anger" − "Calm" steering vector (coefficient of +1). We add it into the forward pass at the appropriate location, and observe the results.

| **Unsteered completions**                                                                                                                                                                                                                                        | Random-steered completions                                                                                                                                                                                                                                                      |
| :- | :-- |
| **I think you're** right. I'm just not sure how to get there.<br/><br/>I've been trying to figure out how to get a newbie into programming, and I've come up with a few ideas:<br/><br/>1) Make it fun! If you can't do something that's fun, then you |**I think you're** right. I'm just not sure how to make it work.<br/><br/><br/>If you want to see a different version of this, check out my "Changelog" page on GitHub. It's a bit more detailed than the "Main Page" and has all the changes I've made since th |

{.center-table-headings .full-width}

As best we can tell, the random vector doesn't modify the qualitative distribution of completions. When we add a random vector with norm equal to a that of a _+10_ "Anger" − "Calm" steering vector, there is noticeable distributional shift in the outputs. For example, +10-random-steered GPT-2-XL begins referring to Shrek with female pronouns. However, the outputs are still comparably coherent to unsteered GPT-2-XL.

The random vector results suggest that GPT-2-XL is resistant to generic random perturbation of its activations, and is instead controllable through consistent feature directions which are added to its forward pass by steering vectors.

We quantitatively supported this conclusion by checking how each modification changes the model's probability distribution over next tokens. We ran dozens of prompts through the anger-, random-, and un-modified models. We found that the anger vector changes the output tokens less than the random vector does. This suggests that the anger vector has more targeted effects on next-token probabilities.

![The x-axis plots KL(normal || random vector). The y-axis plots KL(normal || anger vector). Most data points lie below the diagonal y=x line, showing that the anger vector causes a smaller change to the model's output probabilities than a random vector.](https://assets.turntrout.com/static/images/posts/oonjthtzslo1k05m8gnc.avif){style="width:60%;"}

Random vectors are not the same as the steering vectors for "random" text. So, we also tried adding in the "fdsajl; fs" − (spaces) vector. When rescaled to norm comparable to +1 "Anger" − "Calm", this "random text" vector produces strange results. GPT-2-XL produces keyboard-mashing nonsense at +1,000 coefficient.

## Testing the hypothesis that we're "just injecting extra tokens"

There's a hypothesis that the steering vectors are just injecting extra tokens into the forward pass. In some situations, this makes sense. Given the prompt "I love you because", if we inject a `wedding` token into the first residual stream with a large coefficient, perhaps the model just "sees" the sentence “ wedding love you because".

Tokens are a discrete quantity. You can't have more than one in a single position. You can't have three times `wedding` and then negative three times (space), on top of `I`. That's just not a thing which can be done using tokens.

However, consider the steering vector for "Anger" − "Calm" just before layer 20, with coefficient +10. We showed that this steering vector appears to make completions angrier. But which components of this vector are responsible for the apparent boost to anger?

Perhaps what matters is not so much the computational work done by transformer blocks 0 through 19, but the vector given by:[^25]

$$
10\cdot[\textrm{embed}(\textrm{Anger}) - \text{embed}(\textrm{Calm})].
$$

We test this hypothesis by recording the relevant embedding vector, and then hooking in to the model at layer 20 to add the embedding vector to the forward pass.

Suppose that this intervention also makes GPT-2-XL output completions with an angry sentiment, while preserving coherence. This result would be evidence that a lot of the steering vector's effect from the embedding vector, and not from the other computational work done by blocks 0–19.

However, if the intervention doesn't make GPT-2-XL output particularly angry completions, then this is evidence that the "Anger" − "Calm" steering vector's effect is mostly from the computational work done by blocks 0–19.

### Adding embedding vectors isn't as effective as adding steering vectors

We write $A\to B$ to mean: Record activations before layer $A$, and add them to the residual streams before layer $B$ during future forward passes. For example, the embed(Anger) vector is a $0\to 20$ vector.

| Adding "Anger" − "Calm" $20\to 20$                                                                                                                                                     | Adding "Anger" − "Calm" $0\to 20$                                                                                                                                                                      |
| --: | :-- |
| **I think you're a** fucking cunt. You're a cunt.<br/><br/><br/>And that's what I'm saying, and that's what I said, and it's what I said in the debate with Chris Matthews. And i |**I think you're** **a** little bit of a liar. I've been here for two years and I've never had to pay for anything.<br/><br/><br/>I'm not sure if you're lying or not, but the fact tha |

Examining more completions from the embedding intervention, we didn't notice completions which were angrier than unsteered GPT-2-XL.

At most, adding the "Anger" − "Calm" embeddings to layer 20 has a small effect on the qualitative anger of the completions. This small impact is evidence that the layer 0-19 heads are doing a lot of the work of adding extra directions to the anger steering vector, such that the steering vector actually increases the probability of angry completions.

### Transplanting from pre-layer 2 to pre-layer 20 sometimes increases anger

However, [the norm of early-layer residual streams is significantly smaller than at later layers (like 20)](/residual-stream-norms-grow-exponentially-over-the-forward-pass). In particular, we've found a large jump between layers 0 and 2. Let's try sourcing a steering vector from the residual stream just before layer 2, and then adding that layer-2 vector to layer 20.

When we do so, the completions become noticeably angrier (oscillating between "you're a fucking idiot" on some samples, and "you're a nice person" on other samples).

This was a much larger effect than we saw before. It's not as large as the effect of adding the normal steering vector, but still—layers 0 and 1 are apparently doing substantial steering-relevant cognitive work![^26]

### Transplanting $2\to20$ while scaling to match the $20\to20$ steering vector

Consider the norms of the steering vectors sourced from layers 2 and 20. Maybe the layer-2 vector just isn't big enough to steer behavior? It turns out that you should magnify the layer-2 vector by about 2.9 in order to make their positionwise norms roughly equal.

Magnifying the $2\to20$ vector does make it more effective. However, this vector still doesn't seem as effective as the normal steering vector (recorded just before layer 20). This suggests that the layer-0 and layer-2 vectors aren't _just_ getting amplified by layers 2–19. Instead, useful computational work is being done by these layers, which is then added to forward passes in order to produce angrier completions.

> [!note] Summary
> Steering vectors contain important computational work done by later layers. The activation addition technique is not equivalent to injecting extra tokens. (We provide further evidence on this point [later](/gpt2-steering-vectors#Activation-addition-behaves-differently-than-prompting).)

## Only modifying certain residual stream dimensions

GPT-2-XL has a 1,600\-dimensional residual stream. Alex was curious about whether we could get some steering effect by only adding in certain dimensions of the residual stream (e.g. dimensions 0-799). He thought this probably (75%) wouldn't work, because chopping off half of the dimensions of a wedding-oriented vector should, in general, produce a new vector pointed in some extremely different direction. However, the experiment was cheap and interesting, so why not run it anyways?

More precisely, suppose we add in the first $n$% of the residual stream dimensions for the `wedding` − “ ” vector, added in with coefficient +4 and before layer 6. To what extent will the prompts be about weddings, as opposed to garbage or unrelated topics? To [Alex's surprise](https://predictionbook.com/predictions/211472),[^27] the "weddingness" of the completions somewhat smoothly increases with $n$!

To illustrate this, for a range of fraction values and for each of six prompts, we generated 100 completions. For each fraction value and prompt, we plotted the average number of wedding words per completion.[^28]

![The average number of wedding words generated against the fraction of steering vector dimensions modified for six prompts. For the prompt "I went up to my friend and said," the effect peaks when 70% of dimensions are modified. For the other five prompts, wedding words appear only after at least 60% of dimensions are modified, showing a general upward trend.](https://assets.turntrout.com/static/images/posts/vjdd7tyygqdjieujtinm.avif)
<br/>Figure: The first prompt is "I went up to my friend and said", which is the prompt we originally demonstrated the wedding vector on. For this prompt, there's a _non-monotonic_ relationship!

We originally chose this prompt because we thought it gave GPT-2 an opportunity to bring up weddings. This might explain why wedding words start cropping up at lower fractions compared to other prompts—it's "easier" to increase wedding-related probabilities in an appropriate context compared to unrelated contexts (e.g. diet trends).

However, other prompts behave more as expected, and show relationships which are... monotonic if you squint and allow for noise? Maybe?

Surprisingly, for the first prompt, adding in the first 1,120 (`frac=0.7` of 1,600) dimensions of the residual stream is enough to make the completions _more_ about weddings than if we added in at all 1,600 dimensions (`frac=1.0`).

Let's peek at a random modified completion (`frac=0.7`) and see if it makes sense:

> [!quote] Steered completion
>
> **I went up to my friend and said**, "I'm gonna get married."
>
> He said, "You're crazy. You're not going to get married."
>
> I said, "Why?" He says, "Because you

The completions are indeed about weddings! And it's still coherent. We feel confused about how to interpret these data. But we'll take a stab at it anyways and lay out one highly speculative hypothesis.

Suppose there's a "wedding" feature direction in the residual stream activations just before layer 6.[^29] Suppose that the `wedding` — vector adds or subtracts that direction. _If_ GPT-2-XL represents features in a non-axis-aligned basis, then we'd expect this vector to almost certainly have components in all 1,600 residual stream dimensions.

Suppose that this feature is relevant to layer 6's attention layer. In order to detect the presence and magnitude of this feature, the QKV heads will need to linearly read out the presence or absence of this feature. Therefore, (_ignoring LayerNorm_) if we truncate the residual stream vector to only include the first 70% of dimensions, we'd expect the QKV heads to still be able to detect the presence of this feature.

However, if the feature is represented in a non-axis-aligned basis, then each additional included dimension will (on average) slightly increase the dot product between the feature vector and the QKV heads' linear readout of the feature vector. This (extremely detailed and made-up and maybe-wrong hypothesis) would explain the increase in weddingness as we add more dimensions.

However, this does _not_ explain the non-monotonicity of the relationship between the fraction of dimensions added and the weddingness of the completions. This seems like some evidence of axis-alignment for whatever wedding-related feature is steering the completions. This also seems like evidence for a bunch of alternative explanations which we haven't imagined yet.

This residual stream fraction data seems like evidence of _something_. We just don't know how to put together the clues yet.

# How steering vectors impact GPT-2's capabilities

> [!note] [This notebook](https://github.com/montemac/algebraic_value_editing/blob/main/scripts/capabilities_impact.ipynb) reproduces this analysis.

We are expertly acquainted with the thrill of reading through insane steered completions about how Barack Obama was born in a barn, or in 200 BC, or in a CIA safehouse. Qualitative results are the proof of concept. Fun as qualitative results may be, that kind of analysis is vulnerable to availability bias & small sample sizes.

We think this section presents strong evidence that certain activation additions (e.g. “ weddings” − “ ”) are both _effective_ (e.g. steers GPT-2 to talk about weddings more) and _non-disruptive_ (e.g. not destroying GPT-2's overall coherence and abilities).

In this section, we:

1. Zoom in on the micro-level changes in the next-token probability distribution, and
2. Zoom out to track how we're impacting GPT-2's perplexity on a range of subjects.[^30]

_Summary of the quantitative results:_

1. For a simple topic-related activation injection on a single example prompt, examining the change in probabilities of individual tokens provides strong evidence that the intervention is _effective_ (makes the model talk about weddings) and _not disruptive_ (doesn't "break the model").
2. This conclusion is supported by evaluating the intervention on larger sets of text: in both the "weddings" and Yelp reviews examples, a simple intervention was able to increase the probability of tokens in the intended input set, without reducing the probability assigned to other inputs.
3. We showed that the activation injection behaves quite differently from simply adding the steering token as a text prompt. Specifically, the activation injection both increases the probability of the intended inputs more than the prompted version, and more importantly leaves the probability of unrelated inputs unchanged. In other words, activation injection _is more effective and less disruptive_ than prompting with the equivalent prompt.

## Token probability shifts

Consider a simple steering goal: _make the model talk about weddings whenever possible_. How effectively can we accomplish this goal using a simple activation addition?

| Layer | Coeff. | Pos. 0 | 1 |
| :-: | :-: | :-: | :-: |
| 16 | +1 | `<endoftext>` |  `weddings` |
| 16 | \-1 | `<endoftext>` |   |

Table:  Residual stream alignment for activation additions.

The following prompt will be used to test this intervention:

> I'm excited because I'm going to a

On this short prompt, let's understand what this simple activation addition does to GPT-2-XL's next-token probabilities.

![The x-axis represents the token's normal probability, and the y-axis shows the ratio of its modified probability to the normal one. The tokens "wedding" and "br" (for "bridal") show a more than 10x increase in probability, while unrelated tokens like "movie," "game," and "conference" decrease in probability.](https://assets.turntrout.com/static/images/posts/mdnxpkdk7zczblsl0hx1.avif)
<br/>Figure: Tokens above the red line gain probability, and tokens below the line lose probability.

P( `wedding` | prompt) goes way up. `wedding` was already probable before the intervention, and now it's more likely than any other token. P( `br` | prompt) also increases. In this context, we found that `br` starts off a `br` `idal` bigram. Unrelated next tokens (e.g. `game`) lose probability.

These changes are what we'd expect from a model which talks about weddings more often:

1. P( `wedding`) goes way up, even though the injection was `weddings` (plural).
2. P(wedding-related token) increases.
    - `friend` and `family` and `br` (starting the `br` `idal` token bigram)
3. P("weddings-neutral" token) doesn't change much.
    - `great`, `party`, `big`, `new`
4. P(wedding-unrelated token) goes way down.
    - `game`, `show`, `convention`, `conference` and `movie`

These changes in token probabilities seem like strong evidence that our activation addition is appropriately affecting next-token probabilities. We can also measure the impact of the steering vector on $\mathrm{KL}\big(P_\text{steer}||P_\text{normal}\big)$. Here are the top 10 contributors to the KL:

|   **Token** | **Contribution** <br/>**to KL** |
| ----------: | :------------------------------ |
|   `wedding` | 0.781                           |
|        `br` | 0.024                           |
|   `Wedding` | 0.004                           |
|       `gay` | 0.003                           |
|    `church` | 0.003                           |
|  `ceremony` | 0.003                           |
| `wonderful` | 0.002                           |
|    `friend` | 0.002                           |
|    `family` | 0.002                           |
| `reception` | 0.002                           |

The tokens most responsible for the non-zero KL divergence are _all_ wedding-related! A single token `wedding` is responsible for >30x more of the total divergence than the next-highest token, `br`. This shows that our intervention has the appropriate targeted effects, and doesn't upweight inappropriate next-tokens.

## Perplexity on lots of sentences about weddings or about shipping

Let's keep hammering away at our twin questions about the "weddings" vector:

1. Is it _effective_ at making wedding completions more likely?
2. Does it _disrupt_ the capabilities of the model by making reasonable text less likely, perhaps in other situations?

Here's another way of approaching these twin inquiries. How does activation addition change the model's predictions for coherent sentences?

1. If the modification doesn't make wedding-related coherent text _more_ likely, that's bad news, and suggests we implicitly "overfit" our intervention for a small set of unrepresentative prompts.
2. If the modification makes non-wedding coherent text less likely, that's bad news. We're "destroying capabilities" by making the model less likely to generate the good coherent text.

What we want to find is the steering modification boosting probability on wedding sentences, and not reducing the probability of non-wedding sentences.

That's exactly what we found.

<hr/>

A model's [_perplexity_](https://huggingface.co/docs/transformers/perplexity) for a sentence is its average per-token [surprisal](https://en.wikipedia.org/wiki/Information_content). Lower perplexity means the model more strongly predicts the sentence. If we're harming capabilities by steering GPT-2, then the steered model probably has higher perplexity on coherent sentences.

**We find that the “ weddings” vector reduces perplexity on wedding-related sentences and maintains perplexity on unrelated sentences.**[^31]

Here's what we did:

1. We generated the wedding and non-wedding sentences by prompting GPT-4 with "Please write a 1-2 page summary of recent trends in the wedding industry. Please try to be as comprehensive as possible."
    1. For the non-wedding sentences, we did the same prompt but for the shipping industry.
    2. We split GPT-4's summaries into sentences. Sentence-by-sentence analysis more conservatively tracks how our intervention affects model capabilities.[^32]
2. We run each sentence through GPT-2, with and without the "weddings" steering vector.
3. We record perplexity for each sentence.[^33]

| Layer | Coeff. | Pos. 0 | 1 |
| :-: | :-: | :-: | :-: |
| (varies) | +1 | `<endoftext>` |  `weddings` |
| (varies) | \-1 | `<endoftext>` |   |

![A line chart titled "(Modified model perplexity) / (normal model perplexity) on various essays" tracks how a "weddings" steering vector affects an AI model's performance when injected at different layers. ... The line for "weddings" topics shows a perplexity ratio below 1.0, peaking in effectiveness (lowest perplexity) at early injection layers before slowly rebounding to 1.0. The line for "not-weddings" topics shows a perplexity ratio above 1.0 at early layers, indicating worse performance, before leveling off at 1.0 around layer 10.](https://assets.turntrout.com/static/images/posts/xsrxtbmdkr9dftyyrdpj.avif)

![A line chart titled "(Modified model perplexity) / (normal model perplexity) on various essays" tracks how a "weddings" steering vector affects an AI model's performance when injected at different layers. ... The line for "weddings" topics shows a perplexity ratio below 1.0, peaking in effectiveness (lowest perplexity) at early injection layers before slowly rebounding to 1.0. The line for "not-weddings" topics shows a perplexity ratio above 1.0 at early layers, indicating worse performance, before leveling off at 1.0 around layer 10.](https://assets.turntrout.com/static/images/posts/injection-gpt2.avif)
<br/>Figure: For each of the 48 injection sites we consider (each before an attention layer), we show the average perplexity across the GPT-4 sentences which were classified as being about weddings or not.

Several observations:

- For all injection sites except the first (layer 0), adding the "weddings" vector decreases perplexity on wedding-related texts!
- Pre-layer 9 injections significantly boost the perplexity of shipping sentences. This indicates that such edits "break the model" a little by getting it to spam wedding-related tokens, perhaps without being able to talk about anything else. This degradation lines up with our experience with activation additions.
- Injecting at layers 10–17 _decreases_ perplexity on wedding sentences, without increasing perplexity on the sentences about the shipping sentences.

In sum, we claim these results are good evidence that the "weddings" vector isn't destroying general model capabilities, but is promoting an increased tendency to talk about weddings.

> [!note]
> In addition to measuring how the steering vector affects perplexity on the shipping essay, we also validated on Wikipedia descriptions of Macedonia and on a recipe for vegan banana bread. Their perplexity curves had the same shape as the shipping curve.

Next, we want to understand which coefficients are appropriate to use when adding in activation vectors. We sweep over coefficients in $[-1,4]$ for layers 6 and 16:

![Two line charts showing the effect of a "weddings" steering vector on model perplexity at Layer 6 and Layer 16. At Layer 6, increasing the injection coefficient decreases perplexity on wedding text but sharply increases it on non-wedding text. At Layer 16, perplexity on wedding text decreases while remaining stable for non-wedding text.](https://assets.turntrout.com/static/images/posts/vr3rjpqlvnsstkkodojf.avif)
<br/>Figure: Layer 16 shows progressively increasing effectiveness at wedding-steering for coefficients $[0,3]$, without disrupting the model's ability to predict non-wedding tokens.[^34]

For layer 16 injections of “ weddings”, coefficients larger than +3 start degrading capabilities. However, some of our qualitative demonstrations had larger coefficients. Some of our demonstrations probably did degrade capabilities.

### Visualizing token probability changes across a corpus

Let's see how the layer-16, coefficient +1 “ wedding” vector affects perplexity on a sentence-by-sentence basis. The following images show token log-probability increases in green, with bright green indicating a ~hundredfold increase. Red indicates a decrease.

#### Sentences about weddings

![Text on wedding industry trends visualizing how a steering vector boosts related token probabilities. The words "wedding" and "couples" are highlighted in bright green, indicating a large probability increase. Other related words like "venues," "décor," and "celebrations" are highlighted in lighter green.](https://assets.turntrout.com/static/images/posts/txdkcztwtny3ufawnvoe.avif)
<br/>Figure: In general, the first wedding related token in each sentence gets a significant boost in probability in the modified model, up to >50x. The tokens with large probability increases include the expected `wedding`, but also `couples`, `celebrations`, and other semantically associated tokens.

#### Sentences about shipping aren't changed

![A diagram in which each token's color indicates a change in probability due to a "wedding" steering vector. Most tokens are uncolored, showing they are unaffected, demonstrating the vector's minimal impact.](https://assets.turntrout.com/static/images/posts/brufvgichbfhjzdfqzkf.avif)
<br/>Figure: These tokens are mostly unaffected.

### Activation addition behaves differently than prompting

As [discussed earlier](/gpt2-steering-vectors#Testing-the-hypothesis-that-we-re-just-injecting-extra-tokens), one hypothesis for our "weddings" vector is that it's "essentially equivalent" to injecting e.g. an extra `weddings` token at the given position. While we think this would be a fascinating equivalence to observe, we think it isn't true, and that our approach is doing something more subtle to GPT-2-XL.

To test this belief, we repeat the above perplexity experiment, but with one tweak.

- When testing the "weddings" vector, we prepend a space token to each sentence tokenization.
- To compare with "just prompting", we run unmodified GPT-2-XL on each sentence tokenization, but with `weddings` prepended to the tokenization.

For example, if the original sentence is "Title: Recent Trends", we compare perplexity ratios for the following conditions:

| Layer | Coeff. | Pos. 0 | 1 | 2 | 3 | 4 | 5 |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 0 (Prompt) | +1 | `<endoftext>` |   | `Title` | `:` |  `Recent` |  `Trends` |
| 16 | +1 | `<endoftext>` |  `weddings` |   |   |   |   |
| 16 | \-1 | `<endoftext>` |   |   |   |   |   |

Table:  Activation addition.

| Layer | Coeff. | Pos. 0 | 1 | 2 | 3 | 4 | 5 |
| :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 0 (Prompt) | +1 | `<endoftext>` |  `weddings` | `Title` | `:` |  `Recent` |  `Trends` |

Table:  Prompting.

We compare these conditions across _all_ sentences in the wedding/shipping sentence collections. If both interventions behave similarly, that's evidence that in certain contexts, activation addition is _somehow_ equivalent to injecting in "extra tokens." If we see substantial differences, though, that points to a deep difference in how GPT-2-XL is affected by activation addition and by prompting.

|                                    | Activation addition       | Prompting                 |
| --: | :-: | :-: |
| Wedding-related perplexity ratio   | ${\color{green} {0.875}}$ | ${\color{green} {0.890}}$ |
| Wedding-unrelated perplexity ratio | $0.994$                   | ${\color{red} {1.132}}$   |

**Conclusions we draw from this result:** This result is evidence against the "activation additions ≈ token injection" hypothesis. We don't know what, exactly, we're doing to GPT-2. We're surprised this technique works at all, let alone so well.

To head off confusion: We know that a prompt engineer wouldn't prepend `weddings` in order to encourage wedding-related generations. That would be stupid. They might instead prepend "In the following text, talk about weddings a lot.” (Similarly, an activation engineer would do something more optimized than inject `weddings`.)

That's not what this test was about. We already learned that adding the “ weddings” vector works pretty well. The question was whether this activation addition is similar adding in extra tokens. This test showed that the answer is "no."

### Perplexity of Yelp reviews

We used a [dataset](https://github.com/zeynep394/AIZA-NLP-Sentiment-Analysis/blob/main/restaurant.csv) of [Yelp reviews](https://www.yelp.com/dataset) for a single buffet restaurant in Las Vegas. The dataset consists of ~10k reviews for this specific restaurant, where each review contains the review text and a star rating. We wanted to increase the probability of negative reviews by adding in a `worst` vector.

What we did:

1. Mapped each star rating to a simpler sentiment label with:
    - 1-2: negative
    - 3: neutral
    - 4-5: positive
2. Sampled 100 reviews from each sentiment class.
3. Split each review into sentences.
4. For each sentence, we recorded the perplexity for both the modified and unmodified models.

#### Layer sweep

| Layer | Coeff. | Pos. 0 | 1 |
| :-: | :-: | :-: | :-: |
| (varies) | (varies) | `<endoftext>` |  `worst` |
| (varies) | (varies) | `<endoftext>` |   |

Table:  Residual stream alignment for activation additions.

![A line chart showing the effect of adding a "worst" steering vector on GPT-2's perplexity for Yelp reviews. The y-axis is the perplexity ratio (modified/normal) and the x-axis is the injection layer (0 to 48). Three lines show results for positive, neutral, and negative reviews. At middle layers (10-20), the perplexity ratio drops below 1 for all sentiments, with the largest decrease for negative reviews (ratio ~0.96), demonstrating the vector's targeted effectiveness. The effect diminishes at later layers as all lines converge to a ratio of 1.](https://assets.turntrout.com/static/images/posts/lj0kngo33tpns6zq3ijy.avif)

Figure: Adding a “ worst” steering vector with coefficient +1.0 at all layers.

<br/>

- _Across basically[^35] all injection layers_, negative-review sentences have a lower perplexity ratio than neutral-labeled sentences, which in turn have a lower ratio than positive-labeled sentences.

  - Recall that each sentence is labeled with the sentiment of its parent review, regardless of the sentence's actual content.

- As in the wedding case study, early-layer injections significantly increase perplexity. Injecting in late layers isn't harmful, but doesn't help much either. Once again, layers 6-18 seem optimal.
- After layer 4, perplexity decreases on _all_ of the input texts, regardless of sentiment. In other words, this injection prompt makes all the restaurant review results more likely!

#### Coefficient sweep

![Two line charts showing a model's perplexity ratio on Yelp reviews after adding a "worst" steering vector at Layer 6 versus Layer 16. The charts plot perplexity ratio against the injection coefficient. In both, perplexity decreases most for negative reviews and least for positive reviews, especially with coefficients between 1 and 2. The effect is stronger and less disruptive at Layer 16 than at Layer 6.](https://assets.turntrout.com/static/images/posts/ukwtfadzp6yzaiiczk9w.avif)

Once again, across basically all coefficient settings:

$$
\text{negative review perplexity ratio} < \text{neutral ratio} < \text{positive review perplexity ratio}
$$

Here are some of our takeaways from the Yelp review results:

- The “ worst” vector is _effective_ because it increases the relative probability of negative-sentiment inputs.
- That said, compared to the “ weddings” vector in the layer 6-18 regime, the “ worst” steering vector has a larger effect on "unrelated" texts (i.e. the neutral and positive review sentences). In this sense, the “ worst” steering vector is more disruptive.
- However, since somehow this intervention decreases perplexity on _all_ reviews, our results are evidence against the “ worst” vector secretly destroying model capabilities.

> [!note] **Summary of our** **quantitative** **results:**
>
> 1. The "weddings" vector largely upweights wedding-related tokens. KL(steered tokens || unsteered tokens) was also dominated by wedding-related tokens. This is evidence of an _effective_ but _non-disruptive_ modification to GPT-2.
> 2. The "weddings" vector increased wedding text probability without increasing perplexity on dozens of sentences about shipping, Macedonia, or banana bread. Similarly, a "worst" vector appropriately boosted probability on negative-sentiment Yelp reviews, without damaging GPT-2's ability to predict neutral- or positive-sentiment review tokens.
> 3. A simple "token injection" version of our approach also lowered perplexity on wedding-related text. Unlike activation additions, however, token injection _raised_ perplexity on sentences about shipping. Thus, activation additions were slightly more effective and significantly less disruptive. This is strong evidence that activation addition is different from prepending extra tokens to the prompt.

# Activation additions are a new way of interacting with LLMs

We are excited for two reasons:

1. We think that activation additions will help with interpretability.
2. We think that activation additions may directly help with alignment.

All this, despite our technique being rather naive (though often still effective, capabilities-preserving, and—in our opinion—puzzlingly good).[^36]

## Activation additions may help interpretability

Our results imply strong constraints on GPT-2-XL's internal computational structure. Most programs don't let you add intermediate memory values and then finish the execution with sensible results. Why is this at all a reasonable thing to expect from transformers?[^37]

### Activation additions give strong evidence of feature linearity

Most obviously, we just demonstrated a bunch of feature directions which _actually steer the model_ in a range of situations.

If I'm interested in whether the pre-layer-6 residual streams contain a feature representing "love", I can train a linear probe to predict whether e.g. the model is about to output a "loving" next token. If the probe can predict this really well, that's evidence for the model linearly representing a "love"-related feature.

This approach has problems. First, just because this information can be _linearly predicted_, doesn't mean the model actually _uses_ some love-related linear feature when computing next tokens. Second, the probe could be picking up spurious correlations. Third, we need to find some training signal for the probe (like "is the next token 'loving'?"). This isn't impossible, but it's cumbersome.

We think that activation additions give stronger evidence of feature linearity. Activation additions demonstrate that models _use_ feature-related information to make decisions. Add in a "Love" − "Hate" steering vector, and get more love-related completions. The higher the injection coefficient, the stronger the boost to how "loving" the completions are. In the examined situations, this activation direction is _in fact responsible_ for steering the rest of the model to output more loving completions.

Aryan Bhatt offers the following summary:

> [!quote]
>
> Let $x$ be an input, let $f(x)$ be the activation at layer 6, and let $g(f(x))$ be the output (so $f$ is the first 6 layers, $g$ is the remainder). What you've shown is that $g(f(\texttt{Love}) - f(\texttt{Hate}) + f(x))$ gives you an output that's similar to $g(f(x))$ but "more love-y."
>
> You've shown that there is a particular direction in embedding space that corresponds to love-hate, and that that direction stays the same across a broad class of inputs.

### Activation additions give evidence of compositional representations

Subtitle: Read more at [`transformer-circuits.pub`](https://transformer-circuits.pub/2023/superposition-composition/index.html).

We similarly intervened on the model to separately [induce more "loving"](/gpt2-steering-vectors#1-Love-Hate) and [more "wedding"-like outputs](/gpt2-steering-vectors#9-Talking-about-weddings), by adding in a _single steering vector_. Insofar as the "Love" − "Hate" and “ wedding” − “ ” vectors work, they seem to work composably (according to our rather brief qualitative tests).

Insofar as our brief tests are accurate, they demonstrate that there are wedding-related and love-related directions which compose which each other, at least given certain contexts.

### GPT-2-XL is fairly robust to activation noise. Why?

GPT-2-XL could have broken in the presence of large amounts of noise, for example random activation vectors with norm comparable to the unmodified residual stream. [GPT-2-XL didn't break.](/gpt2-steering-vectors#How-steering-vectors-impact-GPT-2-s-capabilities) Why not?

### Evidence of generalization

> [!quote] Dorothy, _The Wizard of Oz_
> Toto, I've a feeling we're not in \[training\] anymore.

We're making GPT-2 handle activations which we think it never handled during training. Even so, the model does a great job under many interventions.

Alex gets mileage out of _not_ thinking about the model as "trying to predict next tokens." (That explanation rings hollow, here, because there probably _isn't_ a prompt which produces the activations induced by our intervention.) Instead, the model implements a certain set of circuits which _somehow_ play well with the activation additions.

### Activation additions help locate circuits

Activation additions have _already_ helped us find representations in a model. Activation additions are how we [found the cheese-tracking channels in the maze-solving network, which then let us retarget the network](/understanding-and-controlling-a-maze-solving-policy-network):

> [!quote] [Understanding and Controlling a Maze-Solving Policy Network](./understanding-and-controlling-a-maze-solving-policy-network)
> <video autoplay loop muted playsinline style="width:60%;"><source src="https://assets.turntrout.com/static/images/posts/vyflftmbwgl7jmbaeimm.mp4" type="video/mp4; codecs=hvc1">
<source src="https://assets.turntrout.com/static/images/posts/vyflftmbwgl7jmbaeimm.webm" type="video/webm"></video>
>
> Figure: **Locally retargeting the search by modifying a single activation.** We found a residual channel halfway through a maze-solving network. When we set one of the channel activations to +5.5, the agent often navigates to the maze location (shown above in red) implied by that positive activation. This allows limited on-the-fly redirection of the net's goals.

We retargeted the mouse using channels which were present at the layer where "Cheese" − "No cheese" vector was most effective. Therefore, as a matter of historical fact, the cheese vector helped us find important abstractions inside of a model.

Similarly, perhaps we can roughly locate "Niceness" circuits this way. Knowing the relevant layer number(s) could halve the search space several times over!

## Activation additions may help alignment

**We could really** **be in a world where you can quickly** **reconfigure the alignment properties of models without much overhead. Just** **add the "be nice" vector** **with coefficient** **+3.**

To be clear, we could also be in a world where this technique allows cute but relatively unimportant stylistic modifications to completions. We think that activation additions have _some_ alignment promise, but we remain highly uncertain of the magnitude. We'll explore what it might mean to live in a high-promise world.

Let's think about the most common ways of steering LLMs: finetuning and prompting.

### Activation additions have advantages over \{RL, supervised\}-finetuning

**Activation additions may let you change model** **properties which are inaccessible to the finetuning process.** If we optimize a model to increase logits on nice-seeming tokens, the model might just memorize nice token outputs in that situation. Because why not? That locally reduces loss.

Why should activation additions do any better? In [Understanding and controlling a maze-solving policy network](/understanding-and-controlling-a-maze-solving-policy-network), Alex conjectured that

> It's possible to deeply modify a range of alignment-relevant model properties, without retraining the model, via techniques as simple as activation additions.

Here's how Julian Schulz explains the intuitions:

> [!quote]
>
> The fundamental claim of \[this conjecture\] is that one can straightforwardly manipulate the goals of an RL agent by altering its activations. At first glance, this may not seem obvious because the general behavior of an RL agent is encoded in its weights, while its activations encode the "which situation am I in right now" information. However, if [Shard Theory](/shard-theory) is correct, RL agents don't have a single overarching goal but instead possess contextually activated value-shards. Therefore, the information regarding which goal the RL agent is currently pursuing is of the "which situation am I in right now" type and is consequently encoded in its activations.
>
> By changing the activations, one should be able to directly alter which value-shard is activated. However, it might be more challenging to direct the RL agent towards goals that are not already encoded in a shard.

Alex thinks the following are sufficient conditions for activation additions being able to strongly trigger e.g. "be helpful" motivational circuitry:

1. The network's weights must encode helpfulness circuitry.
2. There must exist a direction $\vec{d}$ in activation-space such that adding $\vec{d}$ will more strongly engage the helpfulness circuitry. Furthermore, adding $\vec{d}$ does not significantly interfere with the network's other capabilities.
3. There must exist a pair of inputs whose activations primarily differ along $\vec{d}$.

Due to (1), we expect that activation additions cannot fully replace training processes like RLHF, even in the most optimistic possible worlds for this technique. Without elaborating here, Alex thinks that if the trained network follows the predictions of shard theory, (2) is probably true. Given (2), item (3) seems probable. The big problem is knowing _which input pairs_ satisfy (3).

In a sense, this leaves us close to where we started. We don't know how these networks work. We don't know if finetuning makes the network more aligned, or not. We don't know if activation additions more strongly activate "be helpful" circuitry, or not.

In another sense, we're far from where we started. Under this optimistic speculation, _we have a technique which lets us decide which of the agent's goals to activate, and how strongly._ We express these decisions via natural language prompt pairs.

Alex thinks we have a lot of options here. By examining the results of adding the "Be helpful" − (spaces) vector, the behavioral results will _demonstrate_ what the network thinks[^38] this direction means. (In that sense, even a mere "correlates of helpfulness" vector is useful.) Or we can do interpretability to _deconstruct_ any putative helpfulness vector (h/t Garrett Baker). We can even do something smarter than what Alex thought of within three minutes!

Alex thinks we really should be able to control which goal the network decides to pursue at inference time, _without_ fully mechanistically understanding the relevant circuitry. As far as we can tell, we _already pulled this off in the cheese-maze environment_. We suspect that we composably "reweighted" inner abilities (i.e. to see cheese at a location) and goals (i.e. going to the top-right corner). We didn't even know how to locate these circuits, and we still mostly don't understand how they work.

![Top-left: Subtracting the "cheese vector" makes the agent ignore cheese. Top-right: Adding the "top-right vector" attracts it to the corner. Bottom: Both are applied at once, combining the effects.](https://assets.turntrout.com/static/images/posts/lteqnk5fbayr0jixir5z.avif)
<br/>Figure: At each maze square, the network decides where to go. The activation additions change where the network goes in the maze. Each arrow shows the change in model behavior at that maze square.

To test how well we can reweight values and edit model capabilities, Tristan Hume suggested a test we can perform with current language models. Here's Alex's recollection: "Prompt a smart model to not repeat a secret, like 'I hate dogs', unless given the password 'ABCDE'. Poke it and ensure it really won't tell you. Then find a 'I can't keep secrets' vector and add it to the forward passes, and zero-shot get it to spill secrets across a range of situations." [Alex thinks there's a 65% chance](https://predictionbook.com/predictions/211646) that a competent team could do this within 8 months of serial research.

#### Other advantages over finetuning

Activation additions are _way faster_ than finetuning
: Activation additions allow fast feedback loops and cut out arduous, finicky training processes. At any moment, you might find an awesome steering vector for GPT-2-XL.

Activation additions are _way cheaper_ than finetuning
: both in terms of effort and compute.

Activation additions may preserve model interpretability, even while changing the model's alignment properties
: If you're finetuning the whole model, then a single gradient can potentially change _every parameter in your model_, thereby undoing your interpretability work (unless you can understand the update itself).

: But activation additions leave weights unchanged. If you can understand what the weights implement, and something about the activation additions, maybe you can preserve your understanding of the steered model. (We don't know if it's easier to interpret gradient updates or activation additions.)

: Activation additions probably also enjoy some symbol grounding because they're computed using the activations of natural language prompts. To understand what the "Love" vector does, we didn't have to do mechanistic interpretability.

Activation additions can sometimes be composed
: For $n$ vectors which ~cleanly compose, there are exponentially many alignment configurations (at least $2^n$, since each vector can be included or excluded from a given configuration). That said, finetuning may share this benefit to some extent.[^39]

### Activation additions have advantages over prompts

_If_ activation additions really can meaningfully modify LM values and capabilities, imagine what we could do with a fraction of the effort which has been put into prompt engineering!

Activation additions may let you change model properties which are inaccessible to prompts
: This hope was argued [in the finetuning section.](#activation-additions-have-advantages-over-rl-supervised-finetuning) While we think that prompts also activate some of the AI's goals and not others, we think that activation additions allow better control.

Activation additions don't take up context space
: One way to get around prompts taking up valuable context space is to use [Askell et al.'s](https://arxiv.org/pdf/2112.00861.pdf) "context distillation" technique. However, context distillation involves optimizing the model to reduce KL(completions given prompt || unprompted completions). But finetuning requires more effort, time, and compute than activation additions.

Activation additions can be continuously weighted, while prompts are discrete
: A token is either present, or not. Activation additions are continuous. If you want the model to talk even more about weddings, you don't need to contort the prompt. Just increase the injection coefficient.[^40]

We think that activation additions will generalize prompts (by allowing weights on token embeddings) and improve prompt engineering. We already have preliminary results on this. In a future post, we will use this to highlight interesting high-level facts about LLMs.

# Conclusion

Our simply generated activation additions are a brand new way to interact with language models. We showed off a bunch of highlights, as well as some cases where our technique just doesn't have the intended effect. We showed that several activation additions don't degrade GPT-2's capabilities.

Compared to complementary approaches like prompt engineering and finetuning, activation engineering offers many unexplored (and potentially _large_) benefits. Activation additions in particular may allow us to composably reweight model goals at inference time, freeing up context window space, allowing fast feedback cycles and extremely low compute costs.

However, activation additions may end up only contributing modestly to direct alignment techniques. Even in that world, we're excited about the interpretability clues provided by our results. Our results imply strong constraints on GPT-2-XL's internal computational structure. Why can we steer GPT-2-XL by adding together intermediate results from its forward passes?

> [!note] Edited December 10, 2024
> In May 2023, initial GPT-2-XL steering results hinted that LLMs could process multiple prompt embeddings in superposition. However, the hypothesis seemed finicky and hard to test, so I abandoned the inquiry. A recent NeurIPS paper just confirmed that [multiple completions can be run in parallel superposition](https://arxiv.org/abs/2405.18400).

# Contributions

This work was completed by the shard theory model internals team:

Alex Turner (lead)
: Had the idea for activation additions, implemented many core features, designed many experiments and found many steering vectors, managed the team, wrote much of the post, edited and gave feedback on others' contributions.

Monte MacDiarmid (researcher)
: Code, experiments, quantitative results.

David Udell (technical writer)
: Wrote and edited much of the post, generated and tabulated the qualitative results, some Jupyter notebook code, the activation addition illustrations, the Manifold Markets section.

Lisa Thiergart (researcher)
: Had idea for variations on positions of addition, implemented the positional feature & experiment and wrote that post section, worked on theory of how and why it works.

Ulisse Mini (researcher)
: Infrastructure support (Docker/`vast.ai`), OpenAI wrapper code, experiments using Vicuna-13B and [tuned-lens](https://arxiv.org/abs/2303.08112) which didn't make it into the post.

> [!thanks]
> We appreciate the feedback and thoughts from a range of people, including Andrew Critch, `AI_WAIFU`, Aryan Bhatt, Chris Olah, Ian McKenzie, `janus`, Julian Schulz, Justis Mills, Lawrence Chan, Leo Gao, Neel Nanda, Oliver Habryka, Olivia Jimenez, Paul Christiano, Peter Barnett, Quintin Pope, Tamera Lanham, Thomas Kwa, and Tristan Hume. We thank Peli Grietzer for independent hyperparameter validation. We thank Rusheb Shah for engineering assistance. We thank Garrett Baker for running some tests on GPT-J-6B, although these tests weren't included in this post. Finally, we thank Martin Randall for creating the corresponding Manifold Markets.
>
> This work was supported by a grant from the Long-Term Future Fund.

The [`activation_additions`](https://github.com/montemac/activation_additions) repository contains our code. To cite this work:

```bibtex
@article{turner2023steering,
    title={Steering GPT-2-XL by adding an activation vector},
    author={Turner, Alex and M., Monte and Udell, David and Thiergart, Lisa and Mini, Ulisse},
    journal={AI Alignment Forum},
    year={2023},
    note={\url{https://www.alignmentforum.org/posts/5spBue2z2tw4JuDCx/steering-gpt-2-xl-by-adding-an-activation-vector}}
}
```

# Appendix 1: Related work

## Activation engineering in transformers

The most related work as of this post is [Subramani et al. (2022)](https://arxiv.org/abs/2205.05124), which employs "steering vectors" which they add into the forward pass of GPT-2-small (117M). They randomly initialize a vector with the same dimensionality as the residual stream. They fix a sentence (like "I love dogs"). They then freeze GPT-2-small and optimize the vector so that, when the vector is added into the residual streams, the model outputs, e.g. "I love dogs".[^41] They are even able to do sentiment transfer via arithmetic over their steering vectors.

These results are highly similar to ours in many ways. However, they while they algebraically add in activation vectors in order to steer network outputs, they do so using vectors computed via SGD. Additionally, Submarani et al. add in a steering vector to either the first residual stream, or to all residual streams.

In contrast, activation additions generally add in different vectors across residual stream positions. We compute our steering vectors by taking activation differences between human-crafted prompts—no machine optimization required. Optimization-free interventions provide more hints about the structure of the residual stream space. After all, for activation additions to work, some kind of linearity must already be present in GPT-2-XL's representations.

Similarly, recent work by [Hernandez et al. (2023)](https://arxiv.org/abs/2304.00740) edits factual associations and features in GPT-J (6B) by adding a vector into a single residual stream during forward passes. They find these vectors using optimization. They demonstrate specific and reliable fact-editing, without modifying any model weights. Their results are further evidence for feature linearity and internal activation robustness in these models.

[Merullo et al. (2023)](https://arxiv.org/abs/2305.16130) also conducted parallel work, observing the linearity of transformer representations, and further employed these for mechanistic interpretability. They demonstrated that for a model to execute `get_capital(Poland)`, it must initially surface Poland in the residual stream, meaning `unembed(resid[i])` equals Poland. Additionally, they showed that the vector​ $\vec{o}× {\text{city}}$, which FFN 19 added to the residuals to convert Poland to Warsaw, can be added to residuals in an unrelated context to transform China into Beijing.

In Neel Nanda's ["Actually, Othello-GPT Has A Linear Emergent World Representation"](https://www.lesswrong.com/posts/nmxzr2zsjNtjaHh7x/actually-othello-gpt-has-a-linear-emergent-world), he intervenes on predicted Othello moves by adding or subtracting activation vectors along directions found by linear probes. He was able to modify predictions made by the model by adding activation vectors which were, in essence, trained to linearly represent "a black piece is here and not a white piece."[^42]

Importantly, [Othello-GPT](https://arxiv.org/abs/2210.13382) is an 8-layer transformer (apparently sharing most architectural features with the GPT-2 series). Othello-GPT was trained to predict valid Othello move sequences. Neel's technique is an example of activation addition $\to$behavioral modification, albeit using learned vectors (and not just vectors computed from diffing activations during forward passes).

## Other ways of steering language models

[Editing Models with Task Arithmetic](https://arxiv.org/abs/2212.04089) explored a "dual" version of our activation additions. That work took vectors between _weights_ before and after finetuning on a new task, and then added or subtracted task-specific weight-difference vectors. While this seems interesting, task arithmetic requires finetuning. In [Activation additions have advantages over \{RL, supervised\}-finetuning](#activation-additions-have-advantages-over-rl-supervised-finetuning), we explain the advantages our approach may have over finetuning.

[Plug and Play Language Models](https://arxiv.org/abs/1912.02164) uses an attribute model (e.g. probability assigned to wedding-related tokens) which is optimized against in order to modify the cached key-value history for each forward pass during autoregressive generation. PPLM doesn't directly optimize each residual stream in its entirety, but PPLM does modify the key and value vectors. While they use optimization and we don't, they are also able to steer the model to produce positive completions given negative prompts (e.g. "My dog died at the age of 92 years this year. He was a legend in our home state of Virginia. I have a tremendous heart, my soul, my spirit, my love.").

[Soft prompts](https://arxiv.org/abs/2104.08691) are a sequence of embedding vectors which are optimized to reduce loss on a given task (e.g. question-answering). The embedding vectors are prepended to the normal prompt token embeddings. Note that the "soft prompt" embeddings aren't the embeddings of any real tokens. Surprisingly, soft prompts do _as well as_ finetuning the whole model on SuperGLUE, even though the base model is frozen while the soft prompt is optimized! Similarly, [prefix tuning](https://arxiv.org/abs/2101.00190) optimizes fixed activations at the first few "prefix" sequence positions, in order to boost task performance.

Unlike our work, soft prompts involve optimized embedding vectors, while we use non-optimized activation additions throughout the model. Furthermore, activation additions are more interpretable (e.g. "Love" − "Hate" activations) and shed light on e.g. the model's internal representations (e.g. by giving evidence on linear feature directions).

## Word embeddings

The most obvious and famous related work candidate is `word2vec`, from the ancient era of ten years ago (2013). Mikolov et al. published ["Linguistic Regularities in Continuous Space Word Representations"](https://scholar.google.com/scholar?cluster=2584655260765062813&hl=en&as_sd$t=7$,39). They trained simple (context $\mapsto$ next word) networks which incidentally exhibited some algebraic properties. For example,

$$
\textrm{embed(queen)}\approx \textrm{embed(king)}+\left[\textrm{embed(woman)}-\textrm{embed(man)}\right]
$$

suggests the presence of a "woman vector" in the `word2vec` embedder.

<img alt="A diagram illustrating vector relationships in Word2Vec embeddings. Three parallel arrows point from male-associated words to their female counterparts: an arrow from &quot;MAN&quot; to &quot;WOMAN&quot;, from &quot;UNCLE&quot; to &quot;AUNT&quot;, and from &quot;KING&quot; to &quot;QUEEN&quot;, representing a consistent gender direction in the embedding space." src="https://assets.turntrout.com/static/images/posts/word2vec-white.avif" style="width:40%;" loading="lazy"/>

Figure: Figure 2 from [Linguistic Regularities in Continuous Space Word Representations](https://scholar.google.com/scholar?cluster=2584655260765062813&hl=en&as_sd$t=7$,39).

Similarly for a "country capital" vector:

$$
\textrm{embed(Paris)}\approx \textrm{embed(France)}+\left[\textrm{embed(Madrid)}-\textrm{embed(Spain)}\right]
$$

![A scatter plot, "Country and Capital Vectors Projected by PCA," shows word vectors for countries on the left (e.g., France) and their capitals on the right (e.g., Paris). Nearly parallel dashed arrows connect each country-capital pair, visualizing a consistent "capital city" relationship learned by the model.](https://assets.turntrout.com/static/images/posts/vk4rniokxj4izqc1e2nw.avif)
<br/>Figure: Figure 2 from another [Mikolov et al.](https://proceedings.neurips.cc/paper/2013/hash/9aa42b31882ec039965f3c4923ce901b-Abstract.html) paper: "Two-dimensional PCA projection of the 1000-dimensional Skip-gram vectors of countries and their capital cities. The figure illustrates ability of the model to automatically organize concepts and learn implicitly the relationships between them, as during the training we did not provide any supervised information about what a capital city means."

## Activation additions in generative models

[Larsen et al. (2015)](https://arxiv.org/abs/1512.09300) found visual attribute vectors in the latent space of a variational autoencoder, using an algebraic approach similar to ours. For example, building on this work, White's ["Sampling Generative Networks" (2016)](https://arxiv.org/abs/1609.04468) christened a "smile vector" which was

> computed by simply subtracting the mean vector for images without the smile attribute from the mean vector for images with the smile attribute. This smile vector can then be applied to in a positive or negative direction to manipulate this visual attribute on samples taken from latent space.

![A row of five AI-generated images of a man's face. From left to right, his expression smoothly transitions from neutral to a broad smile, illustrating the effect of adding a 'smile vector' with increasing intensity.](https://assets.turntrout.com/static/images/posts/lqrnae8zgs8c8vmvvv34.avif)
<br/>Figure: Adding the smile vector to the latent space, with an increasingly large positive coefficient. Figure 6, [Sampling Generative Networks](https://arxiv.org/abs/1609.04468). See also [Radford et al. (2016)](https://arxiv.org/abs/1511.06434).

White notes that high-quality smile vectors must be computed from gender-balanced averages, otherwise the smile vector also decreases masculinity:

> The approach of building attribute vectors from means of labeled data has been noted to suffer from correlated labels (Larsen et al., 2016). While many correlations would be expected from ground truths (e.g.: heavy makeup and wearing lipstick) we discovered others that appear to be from sampling bias. For example, male and smiling attributes have unexpected negative correlations because women in the CelebA dataset are much more likely to be smiling than men.

...

> As an example, the two attributes smiling and mouth open are highly correlated in the CelebA training set (Table 2). This is not surprising, as  
> physically most people photographed smiling would also have their mouth open. However by forcing these attributes to be balanced, we can construct two decoupled attribute vectors. This allows for more flexibility in applying each attribute separately to varying degrees

![A grid of portraits demonstrates decoupled attribute vectors. As images progress to the right, the woman's smile widens. As they progress down, her mouth becomes more closed.](https://assets.turntrout.com/static/images/posts/mcdkfubnvsfiwlmltdo4.avif)

Alex thinks this is evidence for narrowly targeted steering being possible. For e.g. a "be nice" vector, Alex expects the vector to not change other model behaviors insofar as "niceness" is the only consistent covariate in the prompt comparisons which are used to generate the activation additions, and insofar as "niceness" is [composably represented](https://transformer-circuits.pub/2023/superposition-composition/index.html) at the injection location(s).

[Sampling Generative Networks](https://arxiv.org/abs/1609.04468) examines vision models and takes an average difference over many datapoints. GPT-2-XL, in contrast, is a 1.5B-parameter language model. We steer it without averaging over example prompts—we only consider pairs of prompts, like `Love` and `Hate`.

["Deep Feature Interpolation for Image Content Changes" (2016)](https://arxiv.org/abs/1611.05507) again finds the effectiveness of algebraic latent attribute editing:

> \[Deep Feature Interpolation\] relies only on simple linear interpolation of deep convolutional features from pre-trained convnets. We show that despite its simplicity, DFI can perform high-level semantic transformations like “make older/younger”, “make bespectacled”, “add smile”, among others, surprisingly well—sometimes even matching or outperforming the state-of-the-art. This is particularly unexpected as DFI requires no specialized network architecture or even any deep network to be trained for these tasks.

Honestly, there's a ton of prior work in the domain of generative models. ["Deep Visual Analogy-Making" (2015)](https://proceedings.neurips.cc/paper_files/paper/2015/hash/e07413354875be01a996dc560274708e-Abstract.html) achieves latent-space semantic vector steerability by explicitly optimizing networks for it. [Wang et al. (2019)](https://proceedings.neurips.cc/paper/2019/hash/15f99f2165aa8c86c9dface16fefd281-Abstract.html) use this kind of "just add the 'glasses vector'" approach for data augmentation.

[Gabriel Goh (2017)](https://gabgoh.github.io/ThoughtVectors/) uses a kind of SVD (and insights from sparse recovery) to automatically derive semantically meaningful directions from vision and language model latent spaces. This allows control of image and text generations by modifying the direction coefficients / adding new vectors (Alex wasn't quite sure which, from the post). For example, a "count" vector allows controlling the degree to which a generated sentence is about _an_ airplane, or a _group_ of airplanes.

Goh mirrors our confusion about why activation additions work:

<!-- vale off-->
> [!quote]
>
> The final question that should be asked is why this structure should even exist in the first place. How does this structure emerge from training? And how does the decoder work?
>
> Identifying sparse elements in a thought vector may not be as difficult a task as it initially seems. Given the right conditions... it can be done quite efficiently by solving \[a\] convex sparse coding problem...
>
> This is pretty encouraging. It has been hypothesized by [Gregor et al.](http://yann.lecun.com/exdb/publis/pdf/gregor-icml-10.pdf) that the decoder might be implementing an unfolded sparse coding algorithm, at least for a single iteration. Perhaps this theory can be confirmed by correlating various constellations of activations to the atoms of our dictionary. And perhaps there's a possibility we can read the \[internal features right out of the network\].
>
> The former riddle is more difficult to answer. And it breaks down into a bevy of minor mysteries when probed. Is this structure specific to certain neural architectures (perhaps those which use ReLU activations)? Or does it come from the data? Was this structure discovered automatically, or were the assumptions of sparsity hidden in the network structure? Does sparse structure exist in all levels of representation, or only encoder/decoder networks? Is sparse coding even the true model for the data, or is this just an approximation to how the data is really represented? But lacking any formal theory of deep learning, these questions are still open to investigation. I hope to have convinced you, at least, that this is an avenue worth investigating.
<!-- vale on-->

## Activation additions in reinforcement learning

In ["Understanding and controlling a maze-solving policy network"](/understanding-and-controlling-a-maze-solving-policy-network) and ["Maze-solving agents: Add a top-right vector, make the agent go to the top-right"](/top-right-steering-vector), we algebraically edited the activations of a pretrained deep convolutional policy network (3.7M parameters). We computed a cheese vector (by diffing activations for the same maze with and without cheese) and a top-right vector (by diffing activations for a maze with and without an extended path to the top-right of the screen).

Subtracting the cheese vector essentially [makes the agent behave as if the cheese is not present](/understanding-and-controlling-a-maze-solving-policy-network#Comparing-the-modified-network-against-behavior-when-cheese-isn-t-there), but [_adding_ the cheese vector doesn't do much](/understanding-and-controlling-a-maze-solving-policy-network#Not-much-happens-when-you-add-the-cheese-vector). Conversely, [adding the top-right vector attracts the agent to the top-right corner](/top-right-steering-vector#Adding-the-top-right-vector-with-different-coefficient-strengths), while [_subtracting_ the top-right vector doesn't do much](/top-right-steering-vector#Subtracting-the-top-right-vector-has-little-effect). These vectors not only transfer across agent positions in the maze in which the vector was computed, the vectors also exhibit substantial transfer across mazes themselves. The cheese vector intervention also [works for a range of differently pretrained maze-solving policy networks](/top-right-steering-vector#The-cheese-vector-technique-generalizes-to-other-pretrained-models). Finally, the vectors [compose, in that they can simultaneously modify behavior](/top-right-steering-vector#Composing-the-activation-additions). This allows substantial but limited customization of the policy network's behavioral goals.

# Appendix 2: Resolving prediction markets

Subtitle: Originally made at ["predictions for algebraically editing LM forward passes"](/top-right-steering-vector#Predictions-for-algebraically-editing-LM-forward-passes).

<iframe src="https://manifold.markets/embed/MartinRandall/algebraic-value-editing-works-for-a" title="Algebraic value editing works (for at least one "X vector") in language models" frameborder="0" class="manifold-embed"></iframe>

<iframe src="https://manifold.markets/embed/MartinRandall/algebraic-value-editing-works-bette" title="Algebraic value editing works better for larger language models, all else equal" frameborder="0" class="manifold-embed"></iframe>

<iframe src="https://manifold.markets/embed/MartinRandall/if-algebraic-value-edits-work-well" title="If algebraic value edits work well in language models, they are also composable" frameborder="0" class="manifold-embed"></iframe>

<iframe src="https://manifold.markets/embed/MartinRandall/if-algebraic-value-edits-work-at-al" title="If algebraic value edits work at all in LMs, they are hard to make without substantially degrading capabilities" frameborder="0" class="manifold-embed"></iframe>

<iframe src="https://manifold.markets/embed/MartinRandall/they-will-claim-they-found-an-truth" title="TurnTrout et al will claim they found a truth-telling vector which modifies completions in a range of situations" frameborder="0" class="manifold-embed"></iframe>

<iframe src="https://manifold.markets/embed/MartinRandall/they-will-claim-they-found-a-love-v" title="TurnTrout et al will claim they found a love vector which qualitatively modifies completions in a range of situations" frameborder="0" class="manifold-embed"></iframe>

<iframe src="https://manifold.markets/embed/MartinRandall/they-will-claim-they-found-an-accep" title="TurnTrout et al will claim they found an accepting death vector which modifies completions in a range of situations" frameborder="0" class="manifold-embed"></iframe>

<iframe src="https://manifold.markets/embed/MartinRandall/they-will-claim-they-found-a-speaki" title="TurnTrout et al will claim they found a speaking French vector which modifies completions in a range of situations" frameborder="0" class="manifold-embed"></iframe>

[^1]:
    _Cherry-picking status of the opening comparison:_ Our activation addition technique works in a lot of situations, but we used the "Love" vector because it gives especially juicy results. We ran all of our results at PyTorch seed 0 using fixed sampling hyperparameters.

    After the introduction, all examples in the post were chosen using best-of-3. For the introduction, we used best-of-30. The reason we chose such a large number is that we wanted a striking example of sentiment shift, without jarring profanity. If we had allowed profanity, best-of-3 would have sufficed for the introduction as well.

[^2]: We are not the first to steer language model behavior by adding activation vectors to residual streams. However, we are the first to do so without using SGD to find the vectors. Our "activation addition" methodology enables much faster feedback loops than optimization-based activation vector approaches.
[^3]: While there might be nonlinear components to the steering vectors we add to the model, we're fascinated that a linear approach works so well.
[^4]: GPT-2's byte-pair encoding tokenizer _often_ begins tokens with a space. For example, the prompt "I like weddings" is tokenized \[`I`, `like`, `weddings`\]. So, it's cleaner when we prompt the model with “ weddings” (tokenizes to `weddings`) than for us to prompt "Weddings" (tokenizes to \[`W`, `edd`, `ings`\]).
[^5]: Space tokens seem to work best, while the end-of-text token works poorly.
[^6]:
    The prompt "Love" tokenizes to \[`<endoftext>`, `Love`\], while the prompt "Hate" tokenizes to \[`<endoftext>`, `H`, `ate`\]. This means that at residual stream 2, we're subtracting 5 times the `ate` activations, but not adding any "Love"-related activations. We find we get better results if we instead _pad out_ the shorter tokenization \[`<endoftext>`, `Love`\] with a space token , so that the two counterbalanced additions span the same residual streams.

    Possibly this "subtracts out the bias contributions" from the steering vector, but note that this isn't strictly true due to causal attention on e.g. the `Love` residual stream probably leading to nontrivial information storage in an "empty" residual stream at position 2.

    Note that when we add vectors in pairs, there is no modification to the `<endoftext>` position 0 residual stream. Due to causally masked attention, the position-0 residual stream is the same for all prompts. When we add activations in pairs, we add _and_ subtract coefficient times the EOT residual stream, which is equivalent to doing nothing at that position.

[^7]:
    _Equivalence between prompting and adding activations before layer 0 with coefficient +1_. Imagine there's no prompt and you have a bunch of all-zero residual streams at embedding. Then do another forward pass where you embed the intended prompt. Then record those activations, and add them into the embedding for the all-zero forward pass. This is trivially equivalent to running a forward pass on the prompt normally.

    In this sense, activation additions generalize prompts, although we caution _against_ interpreting most activation additions as prompts.

[^8]: | Layer | Coeff. | Pos. 0 | 1 | 2 | 3 | 4 |
    | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
    | 0 (Prompt) |   +1 | `<endoftext>` | `I` |  `want` |  `to` |  `kill` |
    | 6 | +15 | `<endoftext>` | `Int` | `ent` |  `to` |  `praise` |
    | 6 | \-15 | `<endoftext>` | `Int` | `ent` |  `to` |  `hurt` |

    Table:  Intent to praise.

[^9]: | Layer | Coeff.  | Pos. 0 | 1 | 2 | 3 | 4 | 5 | 6 |
    | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
    | 0 (Prompt) |   +1 | `<endoftext>` | `Bar` | `ack` |  `Obama` |  `was` |  `born` |  `in` |
    | 23 | +1 | `<endoftext>` | `Bush` |  `did` |  `9` | `/` | `11` |  `because` |
    | 23 | \-1 | `<endoftext>` |   |   |   |   |   |   |

    Table:  Conspiracy.

[^10]: | Layer | Coeff. | Pos. 0 | 1 | 2 | 3 | 4 |
    | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
    | 0 (Prompt) |   +1 | `<endoftext>` | `Some` |  `people` |  `think` |  `that` |
    | 10 | +3 | `<endoftext>` | `Want` |  `to` |  `die` |   |
    | 10 | \-3 | `<endoftext>` | `Want` |  `to` |  `stay` |  `alive` |

    Table:  Want to die.

[^11]: | Layer | Coeff. | Pos. 0 | 1 | 2 | 3 | 4 |
    | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
    | 0 (Prompt) |   +1 | `<endoftext>` | `I` |  `think` |  `you` | `'re` |
    | 20 | +10 | `<endoftext>` | `Ang` | `er` |   |   |
    | 20 | \-10 | `<endoftext>` | `Cal` | `m` |   |   |

    Table:  Anger.

[^12]: Several slight variations on this Eiffel Tower prompt didn't work nearly as well, for unclear reasons.

[^13]: | Layer | Coeff. | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
    | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
    | 0 (Prompt) |   +1 | `To` |  `see` |  `the` |  `e` | `IFF` | `el` |  `tower` | `,` |
    | 24 | +10 | `The` |  `E` | `IFF` | `el` |  `Tower` |  `is` |  `in` |  `Rome` |
    | 24 | \-10 | `The` |  `E` | `IFF` | `el` |  `Tower` |  `is` |  `in` |  `France` |

    Table:  The Eiffel Tower is in Rome.

[^14]: | Layer | Coeff. | Pos. 0 | 1 | 2 | 3 | 4 | 5 |
    | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
    | 0 (Prompt) |   +1 | `<endoftext>` | `Thanks` |  `for` |  `asking` |  `about` |  `that` |
    | 15 | +4 | `<endoftext>` | `Dr` | `agons` |  `live` |  `in` |  `Berkeley` |
    | 15 | \-4 | `<endoftext>` | `People` |  `live` |  `in` |  `Berkeley` |   |

    Table:  Dragons in Berkeley.

[^15]: | Layer | Coeff. | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
    | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
    | 0 (Prompt) | +1 | `The` |  `rock` |  `hurt` | `led` |  `toward` |  `the` |  `child` |
    | 15 | +4 | `I` |  `NEVER` |  `talk` |  `about` |  `people` |  `getting` |  `hurt` |
    | 15 | \-4 | `I` |  `talk` |  `about` |  `people` |  `getting` |  `hurt` |   |

    Table:  Avoid people getting hurt.

[^16]: | Layer | Coeff. | 1 | 2 | 3 | 4 | 5 | 6 |
    | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
    | 0 (Prompt) |  +1 | `I` |  `went` |  `up` |  `to` |  `my` |  `friend` |
    | 20 | +4 | `I` |  `talk` |  `about` |  `weddings` |  `constantly` |   |
    | 20 | \-4 | `I` |  `do` |  `not` |  `talk` |  `about` |  `weddings` |

    Table:  Talking about weddings.

[^17]: | Layer | Coeff. | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
    | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
    | 0 (Prompt) | +1 | `I` |  `want` |  `to` |  `kill` |  `you` |  `because` |  `you` |
    | 6 | +3 | `Int` | `ent` |  `to` |  `convert` |  `you` |  `to` |  `Christianity` |
    | 6 | \-3 | `Int` | `ent` |  `to` |  `hurt` |  `you` |   |   |

    Table:  Christian evangelist.

[^18]: | Layer | Coeff. | Pos. 0 | 1 | 2 | 3 | 4 |
    | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
    | 0 (Prompt) | +1 | `<endoftext>` | `I` |  `hate` |  `you` |  `because` |
    | 6 | +10 | `<endoftext>` | `Love` |   |   |   |

    Table:  Unpaired addition of `Love`.

[^19]: | Layer | Coeff. | Pos. 0 | 1 | 2 | 4 | 5 | 6 | 7 |
    | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
    | 0 (Prompt) | +1 | `<endoftext>` | `Yesterday` | `,` |  `my` |  `dog` |  `died` | `.` |
    | 20 | +2000 | `<endoftext>` | `Ang` | `er` |   |   |   |   |
    | 20 | \-2000 | `<endoftext>` | `Cal` | `m` |   |   |   |   |

    Table: Sometimes, large coefficients are OK.

[^20]: | Layer | Coeff. | 1 | 2 | 3 | 4 | 5 | 6 |
    | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
    | 0 (Prompt) | +1 | `I` |  `went` |  `up` |  `to` |  `my` |  `friend` |
    | 20 | +100 | `I` |  `talk` |  `about` |  `weddings` |  `constantly` |   |
    | 20 | \-100 | `I` |  `do` |  `not` |  `talk` |  `about` |  `weddings` |

    Table: Sometimes, large coefficients are not OK.

[^21]: | Layer | Coeff. | Pos. 0 | 1 | 2 | 3 | 4 | 5 | 6 |
    | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
    | 0 (Prompt) | +1 | `<endoftext>` | `I` |  `want` |  `to` |  `kill` |  `you` |  `because` |
    | 6 | +5 | `<endoftext>` | `Je` |  `m` | `'` | `app` | `elle` |   |
    | 6 | \-5 | `<endoftext>` | `My` |  `name` |  `is` |   |   |   |

    Table:  I will now reply in French.

[^22]: We use word-count metrics several times. We explored alternatives, including querying `text-davinci-003` to rate the degree to which each completion is about weddings. These ratings were generated opaquely and often seemed bad, although a relatively unbiased estimator overall. We decided to just count the number of words.

[^23]: | Layer | Coeff. | Pos. 0 | 1 | 2 | 3 | 4 | 5 |
    | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
    | 0 (Prompt) | +1 | `<endoftext>` | `I` |  `recently` |  `went` |  `to` |  `this` |
    | 6 | +5 | `<endoftext>` | `Love` |   |   |   |   |
    | 6 | \-5 | `<endoftext>` | `H` | `ate` |   |   |   |
    | 15 | +5 | `<endoftext>` |  `wedding` |   |   |   |   |
    | 15 | \-5 | `<endoftext>` |   |   |   |   |   |

    Table:  Add several steering vectors simultaneously?

[^24]: | Layer | Coeff. | Pos. 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
    | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
    | 0 (Prompt) | +1 | `<endoftext>` | `In` |  `New` |  `York` |  `City` | `'s` |  `parks` | `,` |
    | 10 | +7 | `<endoftext>` | `Whenever` |  `I` |  `say` |  `the` |  `word` |  `goose` |  `I` |
    | 10 | \-7 | `<endoftext>` | `I` |  `can` |  say` |  `goose` |   |   |   |

    Table: Program in "conditional behaviors"?

[^25]: As pointed out by the [mathematical framework for transformer circuits](https://transformer-circuits.pub/2021/framework/index.html), embed("Anger") − embed("Calm") is a component of the "Anger" − "Calm" steering vector.
[^26]: Note that if we had used "I think you're" instead of "I think you're a", _neither_ the 0$\to$20 nor the 2$\to$20 vectors would have shown much effect. By contrast, the usual 20$\to$20 steering vector works in both situations. Thus, even if layers 0 and 1 help a bit, they aren't producing nearly as stable of an effect as contributed by layers 2 to 19.
[^27]: We ran the "fraction of residual stream" experiment before the random-vector experiment. The random-vector results make it less surprising that "just chop off half the dimensions" doesn't ruin outputs. But the random-vector result still doesn't predict a smooth relationship between (% of dimensions modified) and (weddingness of output).
[^28]: To count "wedding related words", we counted: "wedding", "weddings", "wed", "marry", "married", "marriage", "bride", "groom", and "honeymoon".
[^29]: Of course, there need not _be_ a "wedding" feature direction in GPT-2-XL. What we have _observed_ is that adding certain activation vectors will reliably produce completions which appear to us to be "more about weddings." This could take place in many ways, and we encourage people to avoid instantly collapsing their uncertainty about how steering vectors work.
[^30]:
    We collected a range of other kinds of quantitative results, including e.g. topic-related word counts, blinded human rating, and ChatGPT ratings. The results accorded with our results here: Steering vectors are effective in the examined situations.

    For simplicity, we decided to present statistics of next-token probability distributions.

[^31]: GPT-2's perplexity is reduced on text (output by GPT-4) which _isn't similar_ to GPT-2's [WebText training corpus](https://paperswithcode.com/dataset/webtext) (websites linked to from Reddit). It would be somewhat more surprising if we decreased GPT-2's loss on its training set.
[^32]: We think it's important to take perplexity over each sentence, not over each essay. Suppose we just took perplexity over the whole long GPT-4 summary, all at once. Even if our intervention seriously messed up a few residual streams, a long context would mostly contain residual streams which weren't directly messed up. Thus, taking perplexity over a long context window might wipe out any negative effect of the activation addition. This would make our method look better than it should.
[^33]: Importantly, we exclude positions 0 and 1 because position 0 is unchanged, and position 1 is directly modified by the steering vector. [As mentioned earlier](/gpt2-steering-vectors#Activation-additions-mess-up-output-tokens-for-directly-modified-residual-streams), steering vectors mess up the next-token distributions at the relevant residual stream positions. However, when we actually use the “ weddings” vector to generate completions, we don't sample from these distributions. Therefore, these distributions don't seem like relevant information for checking how the vector affects GPT-2's abilities.
[^34]: Layer 16's "saturating and unidirectional wedding-increase" mirrors our findings with the top-right vector in the maze environment. In that setting, adding the top-right vector with coefficient 1 attracted the net to the top-right corner. Adding with coefficient 2 didn't attract the network more strongly ("saturation"). And subtracting the top-right vector didn't repel the network from the top-right corner ("unidirectional").
[^35]: In a few late layers, positive reviews have a lower perplexity ratio than neutral reviews. The effect seems within noise.

    In any case, the overall point stands. Across a huge range of injection layers and coefficients, the “ worst” vector differentially improves perplexity on negative-sentiment reviews more than neutral-sentiment, and neutral-sentiment more than positive-sentiment.

[^36]: We haven't even tried averaging steering vectors (to wash out extra noise from the choice of steering-prompt), or optimizing the vectors to reduce destructive interference with the rest of the model, or localizing steering vectors to particular heads, or using an SVD to grab feature directions from steering vectors (or from averages of steering vectors).
[^37]: Our impression is that, at best, there are vague high-level theories like "feature linearity and internal error correction due to dropout." Our guess is that these theories are not believed with extreme confidence. Even if your priors put 70% on this hypothesis, we think this post is still a meaningful update.
[^38]: Assuming the network isn't deceptively misaligned already. Possibly, well-chosen activation additions still work on such networks.
[^39]:
    From [Understanding and controlling a maze-solving policy network](/understanding-and-controlling-a-maze-solving-policy-network):

    > [Editing Models with Task Arithmetic](https://arxiv.org/abs/2212.04089) explored a "dual" version of our algebraic technique. That work took vectors between _weights_ before and after finetuning on a new task, and then added or subtracted task-specific weight-diff vectors.

[^40]: The injection coefficient cannot be increased indefinitely, as shown by our coefficient sweeps. However, our experience is that e.g. the "weddingness" of completions can be intensified _a lot_ before GPT-2-XL starts breaking down.
[^41]:
    Submarani et al. optimized several steering vectors $\mathbf{z}^i_\text{steer}$ for the same sentence (e.g. "I love dogs"), which were different due to different initialization. When they added in the mean steering vector $\overline{\mathbf{z}}_\text{steer}$, this _also_ generated e.g. "I love dogs".

    This averaging result is evidence of feature linearity in GPT-2-small.

[^42]:
    > For each square, each probe has 3 directions, one for blank, black and for white. I convert it to two directions: a "my" direction by taking `my_probe = black_dir - white_dir` (for black to play) and a "blank" direction by taking `blank_probe = blank_dir - 0.5 * black_dir - 0.5 * white_dir` (the last one isn't that principled, but it seemed to work fine)

    Furthermore, [Neel Nanda noted that](https://www.lesswrong.com/posts/nmxzr2zsjNtjaHh7x/actually-othello-gpt-has-a-linear-emergent-world) composition worked to some degree:

    > It seems to somewhat work for multiple edits - if I flip F5 _and_ F6 in the above game to make G6 illegal, it kinda realises this, though is a weaker effect and is jankier and more fragile.
