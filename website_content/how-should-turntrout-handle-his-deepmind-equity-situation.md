---
permalink: deepmind-equity-discussion
lw-was-draft-post: "false"
lw-is-af: "false"
lw-is-debate: "false"
lw-page-url: https://www.lesswrong.com/posts/Be3ertyJfwDdQucdd/how-should-turntrout-handle-his-deepmind-equity-situation
lw-is-question: "false"
lw-posted-at: 2023-10-16T18:25:38.895000Z
lw-last-modification: 2023-10-26T00:56:40.657000Z
lw-curation-date: None
lw-frontpage-date: 2023-10-17T00:42:50.739000Z
lw-was-unlisted: "false"
lw-is-shortform: "false"
lw-num-comments-on-upload: 30
lw-base-score: 61
lw-vote-count: 21
af-base-score: 28
af-num-comments-on-upload: 0
publish: true
title: How should TurnTrout handle his DeepMind equity situation?
lw-latest-edit: 2023-10-26T00:56:40.898000Z
lw-is-linkpost: "false"
authors: Oliver Habryka and Alex Turner
tags:
  - practical
  - deepmind
aliases:
  - how-should-turntrout-handle-his-deepmind-equity-situation
lw-reward-post-warning: "false"
use-full-width-images: "false"
date_published: 2023-10-16 00:00:00
original_url: https://www.lesswrong.com/posts/Be3ertyJfwDdQucdd/how-should-turntrout-handle-his-deepmind-equity-situation
no_dropcap: true
skip_import: true
description: Considering how to ethically manage AI equity when my goal is to reduce AI risk, not maximize profit.
date_updated: 2025-06-03 22:57:00.423836
---







> [!note]
> In this dialogue, Oliver Habryka and I discussed how to reduce financial conflict of interest from my Google DeepMind offer.

`habryka`

: Ok, so the basic situation as I understand it is that as part of your DeepMind offer you would get a bunch of Google stock that would become available to you over the course of around 4 years or so. This means in-expectation, for 4 years, your net worth would substantially correlate with overall Google performance, which on our worldview probably substantially correlates with how much google invests in AGI and how much it participates in the AGI race.

: My sense is you want to end up in a spot where your net-worth isn't super correlated with how much Google invests in AGI. Doing this thoroughly seems hard (since there are things like job security and overall salaries at Google that of course also correlate with Google stock), but getting to a point where you are about as correlated as if you didn't have stock options seems doable.

`TurnTrout`

: Yeah, I want to have lower correlation because I want to make clearheaded decisions about deployment and research directions, which aren't muddled by concerns like "I might get more money for making societally risky plays."

: I was somewhat worried about equity CoI, and my gut response was "I guess I'll decline equity", but

<dd>
<ol>
<li>I didn’t realize how substantially equity contributes to the compensation package, and</li>
<li>it now seems like it shouldn't be too hard to construct a portfolio with a net ~zero position in GOOG. However, that's a question I don't have a lot of background in.</li>
</ol>
</dd>

`habryka`

: The easiest way for doing this would of course be to just ask for a compensation package with no stock options, but many companies don't like that. You might also be able to get a better deal here by doing your own hedging than whatever price Google would offer you for those stock options.

: Ok, but assuming that you can't just ask for a no-stock-options package, how could you potentially reduce your exposure to Google stock here?

: You could just sell a contract that transfers ownership over your shares as soon as you get it, but this now creates a principal-agent problem between you and the person who you sold the shares to. They would like you to stay at DeepMind for longer so the stock options vest, but you don't have anything to gain by that, so ideally the contract would somehow pass this incentive through to you, since I don't think it's the primary thing we are trying to handle here.

: You could just structure this as an ongoing contract where you get money at each vesting cliff. I.e. each time you get some Google shares, a person sends you money for those shares (with a price locked in at the time of signing the contract). This does annoyingly create a liability for that person (they need to always have enough money to buy Google stock at the locked in price), but Google stock seems stable enough that probably someone is willing to buy this at not too much of a premium.

: Now, let's think about whether there is just some product on the open market that you could buy to end up with this.

`TurnTrout`

: One important part would be that (as with any job) I'll be at Google for an unknown duration, and so I don't want to commit to selling my full number of shares, and I'd also like a solution which is robust to receiving additional equity due to high performance.

`habryka`

: Yeah, to be clear, the intent behind this contract was to have the contract end as soon as you leave Google and no longer have any vesting shares. Also yeah, seems probably doable to find some way of also having you sell additional performance bonus shares you get.

`TurnTrout`

: Google in particular has in-house financial advisors, so practically I'd go talk with them about this, but I'd like to figure this out for the more general case.

`habryka`

: Man, I do have trouble coming up with a simple off-the-shelf contract that you could buy, or some personal commitment you could make, that would cause you to break even here.

: Ok, so does anything go wrong with a dumb "I keep a spreadsheet of my Google returns, I commit to donate anything to prespecified charity that is above the current valuation of my Google shares"? Like, this isn't perfect, because you would ideally like to have the current expected value of the stock in your bank account, but Google stock isn't a meme coin and doesn't seem that extremely high-variance, but it does really lose you quite a bit of money in-expectation.

`TurnTrout`

: (Also, insofar as I want the charity to get funding, I still have CoI, albeit a smaller one.)

`habryka`

: Ok, so wait, do you know the exact dates your equity will vest?

`TurnTrout`

: Yes, I know what percentage will vest each month for the next 4 years, and I'll presumably get the specifics (like exact days) soon enough.

`habryka`

: Like, the thing that I feel like you want to do, is to sell a futures contract for Google stock that aligns with your vesting schedule. The problem here is of course that you might end up leaving Google, and then you still need to come up with the Google stock at the pre-specified price somehow.

: Also, I feel like the futures contract market probably isn't traded with that high liquidity, so you would still need to find custom counterparties here.

: Ok, so what if we instead try to aim for something like "be approximately neutral with regards to Google stock?". Is there just like a hacky thing to do that roughly works?

: The naive thing to do is to just like, short Google in an amount equivalent to your total 4-year equity. I.e. you borrow shares, sell them, and then you need to produce the equity somehow over the coming years. But you really can't guarantee you will have enough money to buy Google stock, if it goes up a lot.

`TurnTrout`

: I think a costless collar (selling a call to buy a put at identical strike prices) would be better than shorting, but it might not be possible given the options markets, and it leaves a range of problems unsolved (like "I don't want to deal with margin calls", "what if I get more equity", and "unknown, variable duration of employment"). I could ladder the collars (i.e. establish new collars as I go), but that might not lock me in to the present value of GOOG (e.g. if the stock falls a bunch in the future, maybe no one is trading options at present value anymore, or at least the collar is no longer costless).

`habryka`

: I feel like the variable duration here just really forces you into making a custom contract, if you don't want any of the risk exposure, which sucks.

`TurnTrout`

: I want to just ask Google to give me future stocks according to their future value. e.g. 3 months from now, I get \$X worth of GOOG no matter what. Maybe they will do that. Maybe not.

`habryka`

: I think they key question is "how much of a loss are you willing to take to be neutral here?". If it's <2%, then I think it's really hard. If it's 10% then I think it's quite likely you would find a buyer for the relevant contract.

`TurnTrout`

: I'm definitely willing to pay 2%. I don't fear equity-induced drift much overall, though, but that comes down to factors like "how much do my decisions impact GOOG performance" and "to what extent am I helping make deployment decisions." However, I value time/stress more heavily, and if I have to crunch a ton of annoying numbers every month (in a way I can't hire out to a non-trusted person), that's going to decrease my willingness a lot.

`habryka`

: I think it's pretty important to plan for success in things like this. Like, I agree that in the median path your decisions do not impact GOOG performance that much, but there are totally worlds where you might end up as one of the people in charge of the stop button for Google AI capabilities research, and yeah, that one will sure have a huge effect on Google stock when pressed.

`TurnTrout`

: Agreed. (Although if I became important, and I retained my alignment at that point, I could start up a costlier strategy which locked me in to the value as of that future date.)

`habryka`

: Yeah, I think that's fair. But also, whether you end up in such a position might depend on having already committed to that (like, I would feel more comfortable electing you to the stop button position if I could somehow be confident that you won't have GOOG exposure, which would be easiest if you had already signed a contract that made you GOOG neutral), though probably it won't be a major component.

`TurnTrout`

: Ideally that stop button would be handled by third parties _not employed by Google_ (even if they're not exposed to GOOG), but possibly that won't be the case.

`habryka`

: Yeah, definitely. But I sadly don't expect that to happen.

: Idk, maybe I should set up a small fund here that buys alignment-researcher equity with the obvious contracts. It's just a 4-year contract, with more than half of the capital being freed up 2 years in, so this really isn't that much committed capital.

: I do personally kind of want to avoid GOOG exposure, but idk, does seem less important if I am not working at GOOG.

`TurnTrout`

: Yeah. I also want to avoid exposure for the standard risk management reasons.

`habryka`

: Yeah, man, does really seem like there just isn't a simple instrument here you can buy. I think we really need someone to set up a custom contract here, and I would love it if someone wanted to do this (and my guess is people would be willing to pay like 5% premium here, so this seems like it could be a quite mutually beneficial trade).

`TurnTrout`

: Now that I've received my contract, I've come across language like
:
: > \[Google’s Insider Trading Policy\] describes company-wide policies that address the risks of insider trading, **such as a prohibition on any Google employee hedging Google stock**; and periodic blackout windows when no Google employee may trade Google stock.
:
: I'll look more into this, but this probably kills most workarounds.
