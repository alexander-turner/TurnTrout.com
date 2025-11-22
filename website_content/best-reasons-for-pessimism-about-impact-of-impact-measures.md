---
permalink: best-reasons-for-pessimism-about-impact-measures
lw-was-draft-post: 'false'
lw-is-af: 'true'
lw-is-debate: 'false'
lw-page-url: 
  https://www.lesswrong.com/posts/kCY9dYGLoThC3aG7w/best-reasons-for-pessimism-about-impact-of-impact-measures
lw-is-question: 'true'
lw-posted-at: 2019-04-10T17:22:12.832000Z
lw-last-modification: 2020-12-12T19:16:21.916000Z
lw-curation-date: None
lw-frontpage-date: 2019-04-10T18:52:43.625000Z
lw-was-unlisted: 'false'
lw-is-shortform: 'false'
lw-num-comments-on-upload: 55
lw-base-score: 60
lw-vote-count: 17
af-base-score: 20
af-num-comments-on-upload: 45
title: Best reasons for pessimism about impact of impact measures?
lw-latest-edit: 2019-04-10T17:30:38.988000Z
lw-is-linkpost: 'false'
tags:
  - impact-regularization
aliases:
  - best-reasons-for-pessimism-about-impact-of-impact-measures
lw-reward-post-warning: 'false'
use-full-width-images: 'false'
date_published: 2019-04-10 00:00:00
original_url: 
  https://www.lesswrong.com/posts/kCY9dYGLoThC3aG7w/best-reasons-for-pessimism-about-impact-of-impact-measures
skip_import: true
description: 'Impact measures: Can they make AI safer, or are they a dangerous distraction
  from more promising approaches?'
date_updated: 2025-11-22 00:21:52.667251
---









<!-- vale off -->
> [!quote] [Oliver Habryka](https://www.lesswrong.com/posts/t3t9osBsmwkajWz5Y/long-term-future-fund-april-2019-grant-decisions) (emphasis mine)
>
> My inside views on AI Alignment make me think that work on impact measures is _very unlikely_ to result in much concrete progress on what I perceive to be core AI Alignment problems, _and I have talked to a variety of other researchers in the field who share that assessment_. I think it’s important that this grant not be viewed as an endorsement of the concrete research direction that Alex is pursuing, but only as an endorsement of the higher-level process that he has been using while doing that research.  
>
> As such, I think it was a necessary component of this grant that I have talked to other people in AI Alignment whose judgment I trust, who do seem excited about Alex’s work on impact measures. I think I would not have recommended this grant, or at least this large of a grant amount, without their endorsement. I think in that case I would have been worried about a risk of diverting attention from what I think are more promising approaches to AI Alignment, and a potential dilution of the field by introducing a set of (to me) somewhat dubious philosophical assumptions.
<!-- vale on -->

I'm interested in learning about the intuitions, experience, and facts which inform this pessimism. As such, I'm not interested in making any arguments to the contrary in this post; any pushback I provide in the comments will be with clarification in mind.

At least two reasons suggest that "work on impact measures is unlikely to result in much concrete progress on core AI Alignment problems. First, you might think that the impact measurement problem is intractable, so work is unlikely to make progress. Second, you might think that even a full solution wouldn't be useful.  
  
Over the course of 5 minutes by the clock, here are the reasons I generated for pessimism (which I either presently agree with or at least find it reasonable that an intelligent critic would raise the concern on the basis of currently public reasoning):

- Declarative knowledge of a solution to impact measurement probably wouldn't help us do value alignment, figure out embedded agency, etc.
- We want to figure out how to transition to a high-value stable future, and it just isn't clear how impact measures help with that.
- Competitive and social pressures incentivize people to cut corners on safety measures, especially those which add overhead.
  - Computational overhead.
  - Implementation time.
  - Training time, assuming they start with low aggressiveness and dial it up slowly.
- Depending on how "clean" of an impact measure you think we can get, maybe it's way harder to get low-impact agents to do useful things.
  - Maybe we can get a clean one, but only for powerful agents.
  - Maybe the impact measure misses impactful actions if you can't predict at near human level.
- In a world where we know how to build powerful AI but not how to align it (which is actually probably the scenario in which impact measures do the most work), we play an unfavorable game while we use low-impact agents to somehow transition to a stable, good future: the first person to set the aggressiveness too high, or to discard the impact measure entirely, ends the game.
- In a [More realistic tales of doom](https://www.lesswrong.com/posts/HBxe6wdjxK239zajf/more-realistic-tales-of-doom)-esque scenario, it isn't clear how impact helps prevent "gradually drifting off the rails".[^1]

[^1]: Paul Christiano [raised concerns along these lines](https://www.lesswrong.com/posts/c2oM7qytRByv6ZFtz/impact-measure-desiderata?commentId=Lc2M2jwugKTdynM8A):
  
  <!-- vale off -->
  > [!quote]
  >
  > We'd like to build AI systems that help us resolve the tricky situation that we're in. That help design and enforce agreements to avoid technological risks, build better-aligned AI, negotiate with other actors, predict and manage the impacts of AI, improve our institutions and policy, etc.  
  >
  > I think the default "terrible" scenario is one where increasingly powerful AI makes the world change faster and faster, and makes our situation more and more complex, with humans having less and less of a handle on what is going on or how to steer it in a positive direction. Where we must rely on AI to get anywhere at all, and thereby give up the ability to choose where we are going.  
  >
  > That may ultimately culminate with a catastrophic bang, but if it does it's not going to be because we wanted the AI to have a small impact and it had a large impact. It's probably going to be because we have a very limited idea what is going on, but we don't feel like we have the breathing room to step back and chill out (at least not for long) because we don't believe that everyone else is going to give us time.  
  >
  > If I'm trying to build an AI to help us navigate an increasingly complex and rapidly-changing world, what does "low impact" mean? In what sense do the terrible situations involve higher objective impact than the intended behaviors?  
  >
  > (And realistically I doubt we'll fail at alignment with a bang---it's more likely that the world will just drift off the rails over the course of a few months or years. The intuition that we wouldn't let things go off the rails gradually seems like the same kind of wishful thinking that predicts war or slow-rolling environmental disasters should never happen.)  
  >
  > It seems like "low objective impact" is what we need once we are in the unstable situation where we have the technology to build an AI that would quickly and radically transform the world, but we have all decided not to and so are primarily concerned about radically transforming the world by accident. I think that's a coherent situation to think about and plan for, but we shouldn't mistake it for the mainline. (I personally think it is quite unlikely, and it would definitely be unprecedented, though you could still think it's the best hope if you were very pessimistic about what I consider "mainline" alignment.)
