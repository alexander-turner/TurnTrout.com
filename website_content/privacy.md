---
title: An opinionated guide to digital privacy
permalink: privacy-tips
no_dropcap: false
tags:
  - practical
  - personal
  - open source
description: ""
authors: Alex Turner
hideSubscriptionLinks: false
card_image: 
aliases:
  - privacy
---
Edward Snowden [warned us about unbridled government surveillance](https://en.wikipedia.org/wiki/The_Snowden_Files). He spoke of [powerful eyes](https://en.wikipedia.org/wiki/Five_Eyes) illegally spying on millions of Americans and other people around the world. Many people were upset, including me -- I [helped organize a local protest on that July 4th.](https://web.archive.org/web/20130704222703/http://www.kcrg.com/news/local/Restore-the-Fourth-Rallies-Against-NSA-Surveillance-in-Cedar-Rapids-Iowa-City-214307871.html) [Limited reforms followed via the FREEDOM Act in 2015](https://en.wikipedia.org/wiki/USA_Freedom_Act).

![[https://assets.turntrout.com/static/images/posts/privacy-20251010202149.avif|Dozens of people hold anti-spying signs in front of photographers. The author is center, helping hold a banner which reads "Restore the Fourth."]]{style="width: 80%;"}
Figure: July 2013. I'm in the center, holding the banner.

Edward Snowden warned us of a day that the free world might regret its surveillance infrastructure. I think that that day [is here.](https://www.doomsdayscenario.co/p/america-tips-into-fascism-f51000e08e03254d) ICE, for example, [has cropped up as a new surveillance agency](https://americandragnet.org/), not only listening but also intruding:

> [!quote] [American Dragnet: Data-Driven Deportation in the 21st Century](https://americandragnet.org/)
> Subtitle: Foreword, May 2025
>
>
> When we published _American Dragnet: Data-Driven Deportation in the 21st Century_ in 2022, we understood that the surveillance infrastructure our report describes could one day be deployed by an authoritarian executive to coerce and control the U.S. population at scale. We did not anticipate that this day would come within three years. Our hope was that the findings of our research would be useful for the communities organizing against immigration policing and digital surveillance, and would help to provoke policy change.
>
> Today, as [masked federal agents abduct students off the street in broad daylight](https://www.cnn.com/2025/03/29/us/rumeysa-ozturk-tufts-university-arrest-saturday/index.html), and [the President scoffs at an order from the Supreme Court to facilitate the return of a man illegally deported to El Salvador](https://abcnews.go.com/US/timeline-wrongful-deportation-kilmar-abrego-garcia-el-salvador/story?id=120803843), and [his administration threatens to suspend habeas corpus](https://www.msnbc.com/rachel-maddow-show/maddowblog/trumps-line-possibly-suspending-habeas-corpus-goes-bad-worse-rcna236649), to hope to be saved by “policy change” would be to indulge in soothing nonsense. It would be vain to hope that the exposure of wrongdoing or the revelation of brutality could rouse the current Congress on behalf of the people.
>
> There is, in some sense, nothing left to be revealed or exposed. Or to be more precise, the revelation and exposure of new particulars will not tell us anything more about the nature of the political situation through which we are living. The struggle now is not to uncover the right information, but to rightly understand the meaning of the information we already have, and to face that meaning together.

 This situation has greatly worsened since then, and it will continue to worsen (at least in some respects). Closest to my expertise: there aren't enough federal agents to watch every single American. However, there [may be enough AIs](https://www.americanimmigrationcouncil.org/blog/ice-immigrationos-palantir-ai-track-immigrants/). Cheap, effective AI will allow detailed analysis of _all data and patterns_ collected by these wide-scale surveillance programs. Therefore, limiting your exposure will become even more important.

 Let's start now.

> [!warning]  I'm not a cybersecurity or privacy expert
>  My day job is [AI alignment research](/research) and [I have a PhD in computer science](/alignment-phd),  but I'm not an expert in this particular field. Just consider this guide to be an informed starting point.

> [!warning] Not a guide for people at high risk of targeted surveillance
> Please refer to [a more hardcore guide written by experts](https://ssd.eff.org/module-categories/security-scenarios). If you're going to enter or exit the USA on international travel soon, consider [preparing devices for travel through a US border](https://www.eff.org/deeplinks/2025/06/journalist-security-checklist-preparing-devices-travel-through-us-border).

# Introduction

This article will assume less computer science background than most of my articles do, and that's because I'm writing for friends and family. I'll give concrete, specific, and immediately actionable recommendations. For example, no decision paralysis from waffle-y lists which list the "top 10" password managers. I'll tell you what to use.

I've structured my recommendations around two key principles.

Open source code
:  If a program is open source, then that means anyone can see its code. In turn, that means if the developers put something suspicious or sneaky in the program, someone will probably read the code and notice. You don't need to _trust_ that the people who made the app didn't include creepy tracking.

:  Open source programs are usually free as well!

End-to-end encryption (E2EE)
: While iCloud might encrypt the photos you upload, that'll only prevent outside people from taking a peek. If Apple wanted to, they could look at your photos. More concerningly and more likely, if a government demands that Apple hand over your photos, they're able to and they might need to comply. However, if you enable end-to-end encryption, that's no longer possible, because only you can unlock or decrypt that information.  

: Pessimistically, you should assume that anything which isn't E2EE can be read by the government.

Unless I mention otherwise, all of my recommendations are both open source and E2EE. By following my recommendations, you will create "dark spots" where the surveillance apparatus can't look. Even in the face of an authoritarian crackdown on [thoughtcrime](https://en.wikipedia.org/wiki/Thoughtcrime), you will have space in which to think freely. 

# Tier 0: Literally everyone should do these

> [!money] Estimated costs
>  Assuming you don't done any of this yet, this section will take about \$110 and 90 minutes.

> [!warning]
>  These measures will mostly stop you from getting hacked.  They won't secure your communications against dragnet government surveillance. I'll cover that in [the next section](#tier-1-basic-steps-to-reduce-government-surveillance-and-invasive-profiling).

## Manage passwords with Bitwarden

Subtitle: Cost: Free. Time: 30 minutes.

Use a different long password for every single login you have. Do not reuse passwords. Do not reuse passwords. Do not make simple passwords like `mail123`.

If you're not using a password manager already, _Bitwarden will make your life easier_. Bitwarden will remember your passwords and logins for you. It can even fill them in automatically. Bitwarden will generate new secure passwords for you.  Never again must you worry, "which password did I use for this website?!". You just remember one password: the master password for Bitwarden.

Here's what to do:
1. [Download Bitwarden](https://bitwarden.com/download/) on all of your devices. I use a browser extension on my laptop.
2. Create an account.
  * You need a master password. Use [this tool](https://bitwarden.com/passphrase-generator/) to generate a four-word passphrase consisting of four random words in a row ([justification](https://www.reddit.com/r/Bitwarden/comments/14bkaur/how_many_word_for_a_passphrase/)). I recommend separating each word with a space.
  * Write down the passphrase and keep it in your wallet.
  * At first, you'll have to pull out the phrase all the time. Eventually, you'll memorize it.
3. Use Bitwarden to automatically fill in your passwords. Every time you log into an account, ensure the credentials are stored in Bitwarden.
4. Every time you make a new account, use Bitwarden to make a new login. Use a random password which is at least 20 characters long. No sweat off your back there, because you're not the one who has to remember anything! :)

Since you're using a unique password for every site, you won't have to scramble in the event of a breach. The only account which might even possibly be compromised is the specific account whose password was breached. After all, the compromised password has nothing to do with all the other passwords which Bitwarden generated!

> [!warning]  If you're gonna do one thing from this article, then download Bitwarden.

## Two-factor authentication (2FA)

 Enable two-factor authentication on every possible account that you care about protecting. You don't have to do it all at once. You can just enable 2FA on your most important accounts and then start enabling them in the future as you notice.

 "2-factor authentication" means an attacker has to try a lot harder to get into your accounts.  Even if your credentials are exposed in a massive breach, your account will be safe because they won't have access to your second factor.

### Buy a YubiKey (and a backup)

Subtitle: YubiKey > authenticator app > text- / email-based 2FA

![[https://assets.turntrout.com/static/images/posts/privacy-20251008204055.avif]]{.float-right}

You buy two of these little USB-C boys for \$55 each. Use these as two-factor authentication for your most sensitive accounts, like Bitwarden. You really, really don't want hackers to compromise your Bitwarden.

1. [Buy two keys.](https://www.yubico.com/product/yubikey-5-series/yubikey-5c-nfc/) 
2. Set up key-based 2FA on your most important logins.[^max-yubikey] For each site, register 2FA on both keys.
3. Keep the two factor key in your laptop case or on a keyring. Put the other in a secure location protected from fire and flooding. You could put it in a bank deposit box or in [a private safe at home](https://www.amazon.com/SentrySafe-Resistant-Chest-Cubic-1210/dp/B008HZUI34/ref=sr_1_9?sr=8-9).

[^max-yubikey]: [YubiKeys can hold up to 100 credentials.](https://www.corbado.com/faq/how-many-passkeys-can-yubikey-hold)

> [!question] These keys are expensive. Do I really need two?
> I know they aren't cheap. However, they will make you basically immune to being hacked on your most important accounts. That immunity brings financial security but also peace of mind.
> 
> At _minimum_, you need two keys. If you just had one key, you're one "oops I lost it" away from being _locked out of your most important accounts_. Scary! By keeping a backup safe and sound, even your home burning down shouldn't destroy both of your keys. 
> 
> For convenience, you might even get a third key: a YubiKey 5C Nano (\$65) which you always leave plugged into one of your computer's USB-C ports. This can't be your main key because you'd be unable to access your accounts on mobile unless you always have your computer with you (and thus the Nano as well).

### Use Proton Authenticator as your 2FA app

 Unfortunately, many sites don't support YubiKey.  Whenever possible, prefer application-based authentication in its stead. Texts and emails are not encrypted by default, which puts you at slight risk from the state and from sophisticated criminals.

As far as applications go, common apps store your 2FA secrets in the cloud without E2EE, which means the cloud owners could theoretically see which websites I'm authenticating with. Proton Authenticator solves both of these issues.

> [!idea] Action item
> Download Proton Authenticator on your phone ([App Store](https://apps.apple.com/us/app/proton-authenticator/id6741758667), [Play Store](https://play.google.com/store/apps/details?id=proton.android.authenticator&hl=en_US)).

## Keep your OS up to date

This isn't flashy, but it's important if you don't want to get hax0r'd.  

Make sure you've enabled automatic security updates on your device. Just search "security update" in your phone and computer settings. Enable for both.  Install operating system updates ASAP.

## iOS: Advanced Data Protection (ADP)

If you use iCloud, enable ADP. In a single flick, ADP will enable end-to-end encryption (E2EE) for the vast majority of the data you store in iCloud. The exceptions are Calendar, Contacts, and Mail. I'll cover how to encrypt those later. Also, [even for E2EE content, Apple retains limited metadata (like filename and size)](https://support.apple.com/en-us/102651).

> [!warning]
> If you are in the UK, you'll have to refer to [my later section](#end-to-end-encrypt-your-data) on achieving E2EE for your data. That's because [Apple shut down ADP there after being pressured by your government.](https://proton.me/blog/protect-data-apple-adp-uk) It's as tale as old as `<time.h>`: degrading the freedom and privacy of the Web and increasing government surveillance, all in order to "protect the children."

# Tier 1: Basic steps to reduce government surveillance and invasive profiling

## ProtonVPN stops your internet service provider (ISP) from spying on you

Subtitle: Cost: Free, with recommended upgrade at $13.99/mo. Time: 10 minutes.

### ISPs are creepy 

When you browse the internet, you send your ISP a list of sites you're browsing. They usually can't see the data you're receiving, but they still see where you're going and who you are. When you use a VPN, ISPs can no longer see that information.

> [!quote] [Internet Service Providers Collect, Sell Horrifying Amount of Sensitive Data, Government Study Concludes](https://www.vice.com/en/article/internet-service-providers-collect-sell-horrifying-amount-of-sensitive-data-government-study-concludes)
> The new FTC report studied the privacy practices of six unnamed broadband ISPs and their advertising arms, and found that the companies routinely collect an ocean of consumer location, browsing, and behavioral data. They then share this data with dodgy middlemen via elaborate business arrangements that often aren’t adequately disclosed to broadband consumers.
>  
> “Even though several of the ISPs promise not to sell consumers personal data, they allow it to be used, transferred, and monetized by others and hide disclosures about such practices in fine print of their privacy policies,” the FTC report said.

### The US government spy apparatus is creepy 

US government spy agencies have [broad surveillance powers](https://www.aclu.org/warrantless-surveillance-under-section-702-of-fisa) which allow them to compel ISPs and other service providers to hand over communications data without a warrant. While HTTPS encryption (used by most major sites) prevents ISPs from seeing the specific pages you visit or what you search for on encrypted sites, they can still see:

* Which domains you visit (e.g. `google.com`)
* When and how often you visit them
* How long you spend on each site
* Your full browsing activity on the sites that still don't use HTTPS

The metadata alone reveal a detailed picture of your online life. A VPN prevents your ISP from seeing even this domain-level information, as all your traffic is encrypted before it reaches the ISP.

I recommend downloading [ProtonVPN.](https://protonvpn.com/) While Proton VPN has a generous free version and is probably the best free VPN there is, it's still the free version. I found the download speed to be slow and unreliable. When I upgraded to the paid version, my problems vanished. Personally, I recommend purchasing a subscription to Proton Unlimited (\$12.99/month, or \$9.99/month if you pay for a year at a time). That subscription will not only unlock the paid VPN tier but will also provide 500GB of E2EE storage via Proton Drive.

As discussed later in [the section on securing your data with end-to-end encryption](#end-to-end-encrypt-your-data), I recommend migrating to the Proton ecosystem. Proton applications are open source, E2EE, and well-respected in privacy circles.  For example, using Proton Drive (E2EE and secure) instead of Google Drive (a government could compel Google to decrypt your data, even though Google likely secures your data quite well).

- [ ] Create a Proton account and store the credentials in your Bitwarden
- [ ] [Download and run ProtonVPN](https://protonvpn.com/)
- In the settings, ensure: 
  - [ ] Your VPN always starts along with your device. 
  - [ ] Traffic can only go through your VPN (enable the "kill switch").
- [ ] Repeat for each of your devices.

For network stability and speed, I strongly recommend upgrading to [Proton Unlimited](https://proton.me/pricing) for \$12.99/month. I recommend several Proton services, including Proton Mail and Drive. Once you upgrade, enable "VPN accelerator" in the settings.

> [!info] It's not paranoia if they really are out to get you
> > [!quote] [ACLU](https://www.aclu.org/warrantless-surveillance-under-section-702-of-fisa)
> > Under Section 702 of the Foreign Intelligence Surveillance Act, the U.S. government engages in mass, warrantless surveillance of Americans’ and foreigners’ phone calls, text messages, emails, and other electronic communications. Information collected under the law without a warrant can be used to prosecute and imprison people, even for crimes that have nothing to do with national security. Given our nation’s history of abusing its surveillance authorities, and the secrecy surrounding the program, we should be concerned that Section 702 is and will be used to disproportionately target disfavored groups, whether minority communities, political activists, or even journalists.
>
> In late 2024, the government further expanded its surveillance powers.
> > [!quote] [Eleven years after Snowden revelations, government still expanding surveillance](https://freedom.press/issues/11-years-after-snowden-revelations-government-still-expanding-surveillance/)
> > Subtitle: Published June 5th, 2024
> > Under the newly enacted “[spy draft](https://reason.com/2024/04/19/how-the-fisa-reauthorization-bill-could-force-maintenance-workers-and-custodians-to-become-government-spies/)” provision, the government can not only enlist telecom providers like Verizon to hand over information about their subscribers’ contacts with foreigners it is investigating, as it has in the past. It [can conscript](https://www.theguardian.com/us-news/2024/apr/16/house-fisa-government-surveillance-senate) any American service provider to spy on its behalf. Sen. Ron Wyden [noted](https://www.wyden.senate.gov/news/press-releases/wyden-urges-colleagues-to-reject-expanding-warrantless-fisa-702-surveillance) that cleaning services could be compelled to insert a USB thumb drive into a server at an office they clean.

### VPNs are _fundamentally unreliable_ on iOS as of October 2025

Subtitle: And it's on Apple.

> [!danger]
> I was ready to wrap up writing when I found out some intricately bad news: [VPNs on iOS are a scam](https://www.michaelhorowitz.com/VPNs.on.iOS.are.scam.php).  iOS system services sometime ignore your VPN entirely. This ruins your protection from surveillance by exposing your real IP address and DNS queries directly to Internet Service Providers (AKA US spying data collection points). [Apple states that ignoring your VPN is "expected behavior."](https://protonvpn.com/blog/apple-ios-vulnerability-disclosure/) After five years of known vulnerability, no fix is available for consumers.
>  
> Should you still use a VPN if you're stuck with iOS? Yes, it'll still help keep you private from the web services you're using. Know that the ISP (and Apple) will be tracking you. If you don't want that, I later recommend switching [to a Google Pixel 9a running GrapheneOS.](#switch-to-android----preferably-to-grapheneos)

## Browse the web using Brave 

I thoroughly ran available browsers against my criteria for you:

1. Strong privacy protection against commercial and governmental tracking,
2. Strong ad blocking,
3. Runs websites smoothly without major usability sacrifices,
4. E2EE history and preferences sync across mobile and desktop, and
5. Open source.
6. Good default settings (convenient for you).

I settled on [Brave](https://brave.com/), based on Chromium. The browser is a _huge_ privacy upgrade from normal browsers, especially in the context of recent restrictions on popular ad blockers. I also found it easy to migrate to Brave.

![[https://assets.turntrout.com/static/images/posts/privacy-20251010145522.avif]]
Figure:  For a more granular comparison, see [`privacytests.org`](https://privacytests.org/).

Brave's company has made [a few shady moves](https://www.xda-developers.com/brave-most-overrated-browser-dont-recommend/) in the past. But Brave is the _only_ browser which met my six criteria. In terms of privacy, Brave is [far better out of the box than its competitors.](https://privacytests.org/)  Your account information and browsing history is E2EE, meaning you don't have to trust the company itself. Even if you don't like some of the actions taken by the company, you don't have to pay anything to use the browser. You don't have to trust them that the code is secure because people [can just look at that code.](https://github.com/brave/brave-browser)

If you don't want to use Brave, I recommend hardening Firefox [using Arkenfox](https://github.com/arkenfox/user.js) (requires technical expertise) or using the Firefox fork [Librewolf](https://librewolf.net/) (which deletes your cookies and history each setting, disrupting your usual usage patterns).

> [!idea] Actions
> [Download Brave](https://brave.com/) on all of your devices and then set it to be your default browser. On each device, enable Sync and enable syncing everything (it's E2EE). Install the Bitwarden extension, pin it, log in to your vault, and then [follow this guide to make Bitwarden your default password manager](https://bitwarden.com/help/getting-started-browserext/#disable-a-built-in-password-manager).
>
> Optionally, I recommend setting these further options:
> 1. [ ] In "Shields",
>     1. [ ] "Aggressive tracker & ad blocking"
>     2. [ ] "Strict upgrade connections to HTTPS" (prevents snooping on your data)
>     3. [ ] "Block fingerprinting" (make it harder for sites to uniquely identify you)
>     4. [ ]"Block third-party cookies"
> 2. [ ] In "Privacy and security":
>     1. [ ] "WebRTC IP handling policy" to "Disable non-proxied UDP" (otherwise an adversary can find your real IP address, even behind a VPN)
>     2. [ ] "Auto-redirect AMP pages"
>     3. [ ] "Auto-redirect tracking URLs"
>     4. [ ] "Prevent sites from fingerprinting based on language"
>     5. [ ] _Disable sending a "Do not track" request_ (ironically, it makes you easier to track)
>     6. [ ] Disable all options under "Data collection"



## Use Signal over Facebook Messenger, WhatsApp, texting, or phone calls

 Plain phone calls and text messages are not encrypted. That's why the government has been warrantlessly spying on them for a long time. "Encrypted" services (which aren't E2EE) aren't that safe either:

> [!quote] [The WIRED Guide to Protecting Yourself From Government Surveillance](https://www.wired.com/story/the-wired-guide-to-protecting-yourself-from-government-surveillance/)
> Digital services like Facebook Messenger, Telegram, or X may say their direct messages offer “encryption,” but in the default setting that almost everyone uses, they only encrypt information in transit to the server that runs the service. On that server, the information is then decrypted and accessible to the company that controls that server, or any government agency that demands they share that data—like the Nebraska police who demanded Facebook [hand over chats about a 17-year-old’s illegal abortion in 2022](https://www.nbcnews.com/tech/tech-news/facebook-turned-chat-messages-mother-daughter-now-charged-abortion-rcna42185), then brought criminal charges against her and her mother.

 The well-known application [Signal](https://signal.org/) is both open source and E2EE. Secure your communications. Use it.

 > [!idea] Consider encouraging your friends to use Signal. 
 > I don't really use other texting applications anymore.

## Switch to Android -- preferably to GrapheneOS 

Here's the deal: [iOS 26 fundamentally breaks all mobile VPNs, meaning ISPs and the government will be able to track you](#vpns-are-fundamentally-unreliable-on-ios-as-of-october-2025). 'Tis a shame, because iOS is quite strong on privacy and minimizing telemetry. If you have iOS, or even if you already have an Android ---

Yeah, this one is inconvenient if you're on iOS. But if you want to _both_use a smartphone _and_ reliably avoid mass surveillance, you need to switch.

 I instead recommend [GrapheneOS](https://grapheneos.org/) installed on a Google Pixel phone (yes, it has to be a Pixel). GrapheneOS seems like the most private mobile OS available.   Many people praise the operating system for its speed, battery life, and strong customizability. Basically, everything should just work -- with a couple exceptions:
 
1.  About 10% of banking apps don't work. Make sure that your bank is [listed as compatible](https://privsec.dev/posts/android/banking-applications-compatibility-with-grapheneos/).
2.  Google Pay won't work, so you can't pay by scanning with your phone directly. To replicate the effect, [purchase a credit card holding accessory](https://www.amazon.com/s?k=phone+credit+card+holder) TODO.


 
### How to make the switch
If you're technically comfortable, I recommend buying a [Pixel 9a](https://store.google.com/product/pixel_9a) for about \$499 and then [installing the OS yourself.](https://grapheneos.org/install/web) From [the GrapheneOS FAQ](https://grapheneos.org/faq#recommended-devices): "You need one of the officially supported devices. To make sure that the device can be unlocked to install GrapheneOS, avoid carrier variants of the devices." Otherwise, you can [buy a Pixel with GrapheneOS preinstalled for \$799.](https://liberateyourtech.com/product/buy-grapheneos-phone-pixel-new/)


## Give each app as few permissions as possible

Be especially wary about giving out _precise location_ data. Don't be afraid to say "no" if a permissions request seems unreasonable --- you can always read more on the app and come back later if you change your mind. Review your mobile and desktop applications in your permissions centers. Check that apps aren't taking absurd permissions they don't need (like a calculator asking for access to contacts).

> [!example] Minimizing location permissions
> I found several apps were using my location _all of the time_, including:
> 1. My Govee smart lights app (deny!),
> 2. Maps (should only need it when I'm using the app), and
> 3. System Intelligence (doesn't need much location data).

## Be pseudonymous when possible

Minimize how often you provide your real name, [your real email address](#use-email-aliases-instead-of-handing-out-your-real-email-to-random-sites), your real phone number, or [your real credit card](). You won't achieve perfect security, but you're reducing the amount of data obviously tied to you.

> [!quote] [Real-Name Policies: The War Against Pseudonymity](https://www.privacyguides.org/articles/2025/10/15/real-name-policies/)
> Pseudonymity, or the use of a nickname or fictitious name online, has always been deeply valued on the internet. It grants people protections and freedoms that are often impossible to benefit from offline.
> 
> Women, and especially women who are part of male-dominated online communities, have regularly used pseudonyms to hide their gender online in order to protect themselves from sexual harassment, stalking, and physical violence even.
> 
> Transgender and gender-diverse people also regularly use pseudonyms for protection, or use new chosen names to explore their gender identity online.
> 
> Victims of domestic violence, victims of stalkers, activists, and even journalists often use pseudonyms to protect themselves from aggressors or oppressive regimes.
>
> **Pseudonymity saves lives.** And yet, it is constantly under attack.

My well-known pseudonym is "TurnTrout", but in 2018 I decided to link my real-life identity. When I need a private pseudonym, I use Bitwarden's username generator. I recommend you do the same.

## Use virtual cards for online purchases

Subtitle: Cost: Free for up to 10 new virtual cards per month. 

Services like [Privacy.com](https://privacy.com) generate single-use or merchant-locked virtual credit cards. This prevents merchants from:
- Charging you after cancellation,
- Making it hard for you to cancel (just delete the virtual card),
- Exposing your real card in data breaches. 

- [ ] Install the [desktop browser extension for Brave.](https://www.privacy.com/browser-extension)
- [ ] Install [the mobile app](https://www.privacy.com/mobile-app).
- [ ] On Privacy.com account settings, make your purchases show up as "Privacy.com" on your bank and credit card statements. 

> [!idea] You can  buy digital services pseudonymously
> Real-world items will require shipping to a real address. Unless you're going to set up random addresses via mail-forwarding services, you'll need to provide identifying information. That information may be sold to data brokers and then bought by the government. 
> 
> However, you can pay for digital services pseudonymously using a virtual card, an [email alias](#use-email-aliases-instead-of-handing-out-your-real-email-to-random-sites), and a random fake name (but don't do this for anything which legally requires your real information). When merchants sell those data to brokers, the brokers won't be able to link it to you. That takes you off the grid some!

> [!idea] Virtual cards provide minor protection against persecution via bank statements
> If the government later demands that e.g. Bank of America give the names of everyone who donated to the Democrats in the last year, then even if the bank complies, your name won't be on the list. _However_, the government could still get the information from Privacy.com. For true anonymity, use cash or prepaid cards.
## Keep emergency cash reserves

The US government may engage in financial warfare against its critics. [Stephen Miller](https://www.thebulwark.com/p/its-stephen-millers-show-now-charlie-kirk-assassination-trump-leftists-retribution) threatened retaliation against Americans who exercised their free speech rights. He warned that "radical leftists" (those who publicly disagree with the Trump administration) will have trouble accessing their money:

> [!quote] Stephen Miller, White House Deputy Chief of Staff for Policy
> The power of law enforcement, under President Trump’s leadership, will be used to find you, will be used to take away your money, take away your power, and, if you’ve broken the law, to take away your freedom.

Before we reach that point:
- [ ] Withdraw enough cash to live for at least a month
- [ ] Store it securely at home (consider [a fireproof and waterproof safe](https://www.amazon.com/SentrySafe-Resistant-Chest-Cubic-1160/dp/B008NHKWZU/ref=sr_1_9?sr=8-9))
- [ ] Ensure your passport is current and ready for international travel

## iOS: Disable AirDrop

> [!quote] [The Protesters' Guide to Smartphone Security](https://www.privacyguides.org/articles/2025/01/23/activists-guide-securing-your-smartphone/)
> One of the most innocuous features enabled on millions of iPhones is also one of the most dangerous for those seeking to protect their privacy in public. Apple's AirDrop protocol [uses](https://www.usenix.org/system/files/sec21-heinrich.pdf) trivially bypassed security measures that authorities like the Chinese government have openly [bragged](https://arstechnica.com/security/2024/01/hackers-can-id-unique-apple-airdrop-users-chinese-authorities-claim-to-do-just-that/) about cracking to identify users since at least 2022.
>
> You should assume that any device with AirDrop enabled is constantly broadcasting your name, email address, and phone number to everyone around you, _even if_ you have it set to "Contacts Only." Apple has known about this [flaw](https://www.macrumors.com/2021/04/23/airdrop-researchers-security-flaw/) since 2019 and has not issued any fix.
>

- [ ] Fix by setting `Settings -> General -> AirDrop -> "Receiving Off"`. 

## Disable WiFi calling

Wi-Fi calling is considered to be telephone data (through your carrier) and so isn't protected by your VPN. Phones which connect to Wi-Fi calling will let your carrier track your precise location -- not just the rough region you're in, as usually guessed from your cell tower data. 

## Disable location tracking on Android
Subtitle: Only [if you aren't using GrapheneOS (which you ideally should).](#switch-to-android----preferably-to-grapheneos)

1. **Turn off the Timeline**. Google creates a minute-by-minute "Timeline" of where you've been. 
	1. [ ] Go to `Settings > Google > Manage your Google Account > Data & privacy`. Under "History settings," tap "Location History" and select "Turn off." 
	2. [ ] Delete your history as well.
2. **Turn off "Web & App Activity".** Even with Location History off, Google will still save your location every time you, for example, search for a place in Google Maps or check the weather. This "activity" is saved along with your location. 
	1. [ ] Visit the same "Data & privacy menu" as above. Tap "Web & App Activity." Turn it off.
	2. [ ] Uncheck any box that says "Include Chrome history and activity from sites, apps, and devices that use Google services."
3. **Disable "Bluetooth scanning" and "Wi-Fi Scanning**. When Bluetooth scanning is enabled (even with Bluetooth "off"), [Android phones report lists of nearby Bluetooth tracking beacons any time an app refreshes location services](https://qz.com/1169760/phone-data). 
	1. [ ] Search for "Bluetooth scanning" or "Improve accuracy" in your settings and disable it. This setting does not affect your ability to use the actual Bluetooth feature. You may notice a minor decrease in location accuracy.  
	2. [ ] Search for "Wi-Fi Scanning" and disable it.
	3. [ ] Search for "Location Accuracy" and disable it.

## Track belongings using AirTags instead of Tiles

[Tile devices allegedly don't encrypt your location data, meaning criminals and law enforcement could intercept the data and watch your Tiles move around the map as they please.](https://www.wired.com/story/tile-tracking-tags-can-be-exploited-by-tech-savvy-stalkers-researchers-say/) AirTags are E2EE, keeping your location data private. After reading that article, I immediately tossed all my Tiles and bought six AirTags.

## Disable 2G

[As I later explain,](#stingrays-trick-your-phone-into-revealing-information) so-called "stingray" attacks use a fake "cell tower" to trick your phone into downgrading to a 2G connection. At that point, criminals and police make your phone basically admit who you are. They do this to everyone within half a kilometer.

Android
: You can just disable 2G in your settings. The 2G speed sucks anyways and that protocol basically out of use in the USA at this point. (Just remember, if you later end up without coverage in a remote location, you can try reenabling 2G.)

iOS
: You're less lucky. You can enable [lockdown mode](https://support.apple.com/en-us/105120) to disable 2G connections, but that mode also will break convenient everyday applications. Unless you expect to be under targeted scrutiny (e.g. at a protest if protests become criminalized), you probably shouldn't turn that mode on. Sadly, as of October 2025, Apple has yet to provide a standalone 2G toggle.



# Tier 2: If you care a lot about privacy


## Use email aliases instead of handing out your real email to random sites

If you use aliases, you make it harder for scammers and surveillance to track your online identity. You can also disable an alias if a site uses that alias to spam you.

This is one I finally got around to while writing this article! Use [SimpleLogin](https://simplelogin.io/) to generate random-looking single-use email addresses.[^premium]

![[https://assets.turntrout.com/static/images/posts/privacy-20251010205613.avif]]

Once you've made a SimpleLogin account, follow Bitwarden's [guide on setting up Bitwarden to generate e-mail aliases on-demand when you're generating new passwords](https://bitwarden.com/help/generator/#username-types) --  check the "forwarded email alias" subsection. Bitwarden is lovely, isn't it?

[^premium]: If you've purchased Proton Unlimited as [recommended](#protonvpn-stops-your-internet-service-provider-isp-from-spying-on-you), you'll already have a premium SimpleLogin account.

## Switch to Proton Mail

Centrally hosted mail services (like Hotmail) may secure your data well, but the company still could read your emails if they wanted to. Even if they treat your data with utmost professionalism, _the government can make them hand over your emails_.

Proton Mail stores your emails E2EE. Proton Mail also screens out creepy tracking scripts which "tell senders and advertisers what you read and click on, and can follow you around the web." It's [easy to switch to Proton Mail](https://proton.me/support/easy-switch):
1. Create or log in to your Proton account (e.g. use the account you made above for ProtonVPN).
2. Push a button to import your calendars, contacts, and emails from e.g. your Google account.  
3. Push another button to forward new emails from your Gmail to your new ProtonMail address.  
4.  Start using Proton Mail! :) 

## End-to-end encrypt your data

Subtitle: If it's on the cloud and not E2EE, assume the government can read it.

> [!quote] [Yale Law School](https://law.yale.edu/mfia/case-disclosed/fbis-secret-gag-orders-challenged-ninth-circuit)
> Not only does the Government have the power to issue secret subpoenas demanding your personal information from private companies—it has the power to prohibit those companies from speaking about what has taken place.

**It doesn't matter how good the security and data handling practices are. Google and Apple have amazing security. However, if a company can decrypt your data, the government can force the company to decrypt your data. You wouldn't be able to do anything about it**.

> [!quote] [The CLOUD Act: A Dangerous Expansion of Police Snooping on Cross-Border Data](https://www.eff.org/deeplinks/2018/02/cloud-act-dangerous-expansion-police-snooping-cross-border-data)
> The Clarifying Overseas Use of Data (CLOUD) Act... creates an explicit provision for U.S. law enforcement (from a local police department to federal agents in ICE) to access “the contents of a wire or electronic communication and any record or other information” about a person regardless of where they live or where that information is located on the globe. In other words, U.S. police could compel a service provider—like Google, Facebook, or Snapchat—to hand over a user’s content and metadata, even if it is stored in a foreign country, without following that foreign country’s privacy laws.

On the other hand, when you use E2EE, the company can't decrypt it. Your data is just a sequence of zeros and ones on a computer. The company has nothing to hand over.

Let's secure your data.

> [!warning] iCloud's Advanced Data Protection may not last forever
> The UK [likely](https://daringfireball.net/2025/02/apple_pulls_advanced_data_protection_from_the_uk) tried to force Apple to backdoor all of their encryption so the government could spy on all iOS users, everywhere. Apple rejected this insane demand and instead made ADP (its primary E2EE feature) unavailable for new users and warned existing users to disable ADP.
>
> Apple didn't make a backdoor, and I don't think they will in the future. Even so, this incident reminds me:
> 1. How important it is to have full E2EE for _all data you care about_,
> 2. Your E2EE should not be through a single cloud provider (lest they be forced to delete all of it), and
> 3. You can't tell if closed source software is backdoored. But someone probably would notice if prominent E2EE software were backdoored.
>
> To be clear, iCloud's ADP is far better than nothing. But open source E2EE is even more secure.

### Store your photos in Ente

I love [Ente](ente.io). It has so much: fully E2EE, open source, easy import from Google and iCloud Photos, reasonable cloud storage pricing, full compatibility across your platforms, and the application even uses _local_ AI to search your images and recognize people!  I certainly wasn't expecting to be able to keep using AI with a privacy-focused solution.

 Plus, now all of my 23,000 photos are in one place.

> [!quote] Nadim Kobeissi's review of Ente
> Ente is really cool. End-to-end encrypted photo backup/sync (unlike Google Photos), truly multiplatform (unlike iCloud Photos), and fully open source (unlike both!)
>
> Full disclosure: \[my company\] was involved in a cryptographic audit of Ente.

![[https://assets.turntrout.com/static/images/posts/privacy-20251014141906.avif]]

![[https://assets.turntrout.com/static/images/posts/privacy-20251014133220.avif]]{.float-right}
Whenever I read "Ente", I think of [Entei, the 244th Pokemon](https://bulbapedia.bulbagarden.net/wiki/Entei_(Pok%C3%A9mon)) and the coolest of the three legendary beasts from the second generation.

* [ ] Download [Ente](https://ente.io)
* [ ] Import your photos
  * [ ] Google Takeout
  * [ ] iCloud Photos
  * [ ] Any private photos which don't sync automatically to your services

### Your pictures and videos contain your GPS location

Every time you take a picture or video with your phone, your phone tags the media with your location. So if you upload a picture, you're saying where you were.  If an adversary gains access to a sequence of images you've shared, they'll probably know where you go on a daily basis. (However, when you send media using Signal, the application will scrub the location metadata.) 

Stop your phone's camera from saving this automatically.

Android
: Search "geotag" in your settings, or just find the setting in your Camera settings.

iPhone
: Settings -> Privacy -> Location Services -> Camera and select "Never." 

> [!note] Your files contain more metadata than just location
> Your photos also might expose what kind of phone you're using and the time you took the photo. To remove these from extra-sensitive images, use a special application. Example: [Play Store](https://play.google.com/store/apps/details?id=apps.syrupy.metadatacleaner&hl=en_US), [App Store](https://apps.apple.com/us/app/exif-metadata/id1455197364). 


### Don't use Partiful or Luma to organize sensitive events



Use Signal with messages which disappear after a short time period (like a day or a week). Normal calendar TODO

### Store files in Proton Drive

I was using Google Drive and iCloud Drive. Neither are open source, and Google Drive isn't E2EE. Proton Drive has a good feature set and integrates naturally with [my suggestion to write shared documents in Proton Docs](https://proton.me/drive/docs). Migration is easy: just download your Drive content from Google Takeout and then upload to the Proton Drive app. If you're subscribed to Proton Unlimited (as I recommended for ProtonVPN), you'll have 500GB of Proton Drive cloud storage.

### Track TODOs with Lunatask

I used to track my tasks with Todoist, but I never felt fully comfortable. I transferred to [Lunatask](https://lunatask.app/) -- which is (guess what?) open source and E2EE. Lunatask is also just a better app in my opinion. It prioritizes tasks for you (no more juggling self-imposed due dates), maintains personal/work separation by not showing "work" tasks while in the "personal" zone, and easily slots tasks into your schedule (just drag and drop).

![[https://assets.turntrout.com/static/images/posts/privacy-20251014133029.avif|The Lunatask view of tasks for this post, with a calendar view on the side.]]

Figure: Sadly, the calendar integration can't add new tasks to your main calendar as you schedule them in Lunatask.

Migrating from Todoist took about 30 minutes. Not bad.

### Schedule with Proton Calendar

Neither Google nor iCloud Calendar are E2EE - even with iCloud's Advanced Data Protection enabled. The government could compel the companies to hand over your calendars. 

Proton Calendar lacks some of the convenient features of Google Calendar, but Proton calendar gets the job done and it's secure. I just imported my Google Calendar and  began making new entries in the Proton calendar instead.  Proton Calendar  automatically imports calendar invitations sent to your Proton Mail address - another  reason to [do your email through Proton Mail.](https://proton.me/mail) 

The main drawback is the lack of a direct "Add to Calendar" feature for external invites. To get around this, I created a dedicated Google Calendar and synced it to my Proton Calendar. Now, when I accept an invite, I add it to that Google Calendar, and it automatically appears in my Proton view.



### Secure your address book with EteSync

Cost: \$2/month after free trial.

Android and Apple contacts are _not_ encrypted, even if you enable Advanced Data Protection on iOS. I don't want the government to be able to find out who I talk to or the contact information others have entrusted to me. Here's what to do instead:

- [ ] Register for an EteSync account
- [ ] Download EteSync to your mobile devices

TODO 

## Only carry smart devices when you need them

I have an [Oura ring](https://ouraring.com/) but I don't particularly trust them. Their offerings are proprietary, closed source, and not E2EE. They require cloud analysis of my health data. At the same time, I want to track my sleep health. 

I used to wear my Oura everywhere. But I realized I only need to wear my Oura while sleeping, meaning the ring doesn't even need to leave my home. I put on the ring at night and take it off in the morning. While Oura can still decrypt and read my sleep data, I find the tradeoff worth it for the sleep information. I decreased my daily "digital signature" by carrying one fewer device.

## Bluetooth

### Avoid distinctive device names

If my AirPods are called "TurnTrout's AirPods", then anyone who scans for Bluetooth knows that TurnTrout is likely nearby. I don't need to be leaking that information, so I made my device names generic: "MacBook Pro", "AirPods", and so on.  True, generic names make it slightly harder to figure out which device to connect to, but the cost is small  -- just connect in a less ambiguous environment.

![[https://assets.turntrout.com/static/images/posts/privacy-20251013161427.avif]]
Figure: My laptop's generic name.

As a reminder, your Bluetooth devices and other broadcastable names may include other smart devices:
  1. Laptop
  2. Phone
  3. Watch
  4. Oura ring
  5. Wireless headphones
  6. Smart speaker
  7. Mobile hotspot

### Surreptitious "beacons" track your minute movements

> [!quote] [In Stores, Secret Surveillance Tracks Your Every Move](https://www.nytimes.com/interactive/2019/06/14/opinion/bluetooth-wireless-tracking-privacy.html)
> ![[https://assets.turntrout.com/static/images/posts/privacy-20251014232546.avif]]
>
> Most people aren’t aware they are being watched with beacons, but the “beacosystem” tracks millions of people every day. Beacons are placed at [airports](https://www.post-gazette.com/business/tech-news/2018/04/19/CMU-inks-deal-to-help-create-smartest-airport-on-the-planet-allegheny-technology/stories/201804190126), [malls](https://www.bluetooth.com/bluetooth-resources?video=moa), [subways](https://www.citylab.com/life/2015/06/how-to-get-your-bearings-when-exiting-a-subway-station/395966/), [buses](https://www.nfcworld.com/2016/10/11/347767/proxama-to-create-uks-biggest-ble-beacon-advertising-network/), [taxis](https://www.mobileeurope.co.uk/press-wire/proxama-aims-for-ubiquitous-ble-coverage-with-uk-taxi-deal), [sporting arenas](https://adage.com/article/datadriven-marketing/location-trackers-bigger-sports-arenas/305211/), [gyms](https://www.ymcalouisville.org/healthy-living/health-well-being-fitness/humana-vitality.html), [hotels](https://www.mobilemarketer.com/ex/mobilemarketer/cms/news/software-technology/23565.html), [hospitals](https://unacast.s3.amazonaws.com/7a7f44d764d14917aed62e80039cb688.pdf), [music festivals](https://kontakt.io/blog/beacons-at-music-festivals/), [cinemas](https://geomarketing.com/beacons-at-the-movies-screenvision-and-mobiquity-networks-add-proximity-marketing-to-cinema-network) and [museums](https://www.rfidjournal.com/articles/view?15608), and even on [billboards](https://www.fastcompany.com/3033242/these-new-billboards-talk-to-your-smartphone).
>
> In order to track you or trigger an action like a coupon or message to your phone, companies need you to install an app on your phone that will recognize the beacon in the store. Retailers (like Target and Walmart) that use Bluetooth beacons typically build tracking into their own apps. But retailers want to make sure most of their customers can be tracked — not just the ones that download their own particular app.
>
> So a hidden industry of third-party location-marketing firms has proliferated in response. These companies take their beacon tracking code and bundle it into a toolkit developers can use.
>
> The makers of many popular apps, such as those for news or weather updates, insert these toolkits into their apps. They might be paid by the beacon companies or receive other benefits, like detailed reports on their users.
>
> Location data companies often collect additional data provided by apps. A location company called Pulsate, for example, encourages app developers to pass them customer email addresses and names.
>
> Companies like Reveal Mobile collect data from software development kits inside hundreds of frequently used apps. In the United States, another company, inMarket, covers 38 percent of millennial moms and about one-quarter of all smartphones, and tracks 50 million people each month. Other players have similar reach.

If data companies have the information, so can the government. Obviously, the most privacy-boosting remedy is turning Bluetooth _off_, cold-turkey -- but I don't want to forsake my AirPods in my day-to-day life. So instead, I'm automating the process of turning off my Bluetooth when I'm not using it -- both for my laptop and my phone.

iOS instructions
: On my MacBook, I only use Bluetooth for two reasons: listening to audio and using a wireless game controller. So I made simple automations in the Shortcuts app: `IF $APP opened, THEN turn on Bluetooth` (and have it notify you when it runs). Now, Bluetooth should be turned off when I don't need it.

: ![[https://assets.turntrout.com/static/images/posts/privacy-20251013180907.avif|iOS Shortcuts which turn on Bluetooth when Spotify or Steam is opened, and turns off Bluetooth when one is closed.]]

: Similarly, make simple automations which encompass your use cases. For my iPhone, I don't use Steam so I'll just make Spotify and YouTube Music automations.

Android instructions
: If you have a Samsung phone, you can use the Modes and Routines feature. In that case, follow the iOS instructions using that feature. Otherwise, you can't automate this due to Android's restrictions on third-party applications modifying the state of the Bluetooth radio. So... yeah. I don't have another thing for you to do.

### Other tips

 1. Turn off specialized devices when not using them. For example, your smart speaker you take for parties.  
 2. Disconnect from older unknown Bluetooth devices.
 3. Putting on some music in your friend's car? Give it minimal permissions --- don't let it suck up your entire contacts list!

## Automated license plate readers: can't do anything about them

The government tracks your car movements with exquisite attention. They use Automated License Plate Readers (ALPRs) to track _all_ drivers -- not just "the bad guys". Unfortunately, there are no publicly known passive countermeasures to these devices, and such countermeasures are illegal in the US anyways. It's hard to travel the USA without the government knowing. 

The remedy is to support data retention limits, restrict inter-agency sharing, demand transparency, organize community opposition, and support organizations like the [Electronic Frontier Foundation](https://www.eff.org/) and the [American Civil Liberties Union](https://www.aclu.org/) which legally challenge this surveillance system. For a privacy-respecting jurisdiction, look no further than New Hampshire: [ALPR data must be deleted within 180 seconds unless the data match against an active person of interest.](https://gc.nh.gov/rsa/html/XXI/261/261-75-b.htm)

![[privacy-20251018230933.png]]

Figure: Map of known ALPRs provided by [`deflock.me`](https://www.deflock.me/).

## Avoid login integrations

While "Log in with Facebook" is convenient, it hurts your privacy and your security.

1. Facebook will know all the services that you connect to it and be able to use that to profile you.
2. The site you're logging into will also gain lots of information from your Facebook.
3. Access to all linked accounts is reduced to a single factor, your Facebook account --- a single point of failure.  A data breach at Facebook could compromise all of your accounts.

While using your Bitwarden master password also creates a single point of failure,  your Bitwarden is far better guarded (that's their job!), Bitwarden is open source,  and it doesn't leave you vulnerable to data breaches (due to E2EE).

Don't use integrations if possible. Just let Bitwarden create  and remember a unique email alias and password for each site.

## Delete social media accounts you rarely use

By the year of our lord 2025, I was [hardly using my Facebook](/digital-declutter). I figured that Facebook having all that data on me is another attack surface for unwanted invasive AI tracking later on. Although deleting my Facebook data from Meta's servers won't delete the data which Meta already sold to data brokers, partial deletion is better than nothing.

For Facebook in particular:
- [ ] [Export your data first](https://www.facebook.com/help/212802592074644)
- [ ] Store your data [in Proton Drive](#store-files-in-proton-drive) 
- [ ] Consider making a last status update with information for how your friends can reach you. 
- [ ] After export, [delete your account.](https://www.facebook.com/help/224562897555674)  

More generally:
- [ ] Spend three minutes brainstorming what accounts you've made over the years. 
- [ ] Export data, delete, and move on.

## US government watches immigrant speech on social media 

> [!quote] [EFF to Department Homeland Security: No Social Media Surveillance of Immigrants](https://www.eff.org/deeplinks/2025/06/eff-department-homeland-security-no-social-media-surveillance-immigrants)
> EFF submitted comments to the Department of Homeland Security (DHS) and its subcomponent U.S. Citizenship and Immigration Services (USCIS), urging them to abandon a proposal to collect social media identifiers on forms for immigration benefits. This collection would mark yet a further expansion of the government’s efforts to subject immigrants to social media surveillance, invading their privacy and chilling their free speech and associational rights for fear of being denied key immigration benefits.
  
 > Specifically, the proposed rule would require applicants to disclose their social media identifiers on nine immigration forms, including applications for permanent residency and naturalization, impacting more than 3.5 million people annually. USCIS’s purported reason for this collection is to assist with identity verification, as well as vetting and national security screening, to comply with Executive Order 14161. USCIS separately announced that it would look for “antisemitic activity” on social media as grounds for denying immigration benefits, which appears to be related to the proposed rule, although not expressly included it.
  
>  Additionally, a day after the proposed rule was published, Axios reported that the State Department, the Department of Justice, and DHS confirmed a joint collaboration called “Catch and Revoke,” using AI tools to review student visa holders’ social media accounts for speech related to “pro-Hamas” sentiment or “antisemitic activity.”

Not much you can do besides being [pseudonymous](#be-pseudonymous-when-possible). Be as brave as you can be in your situation. Try not to give in to the chilling effect. Speak your mind while being smart about it. 

## Switch away from Windows

For years, I dithered about switching away from Windows. Windows was all I knew.  But now that I've switched, I'm glad I did. Microsoft Windows operates on a misaligned business model that extracts data about you, annoys you, and fundamentally doesn't respect you.

Windows leaks your data like water through someone's hands... after they've fully opened their hands, that is! Honestly, Windows is a pain in the ass. Even though it's what I grew up with, after spending a couple years away, I'm so glad I don't have to deal with it anymore. Doubly so considering how Microsoft pushed out Windows 11 to force [millions of consumers  replace millions of computers which work just fine with Windows 10](https://www.tomshardware.com/software/windows/microsofts-draconian-windows-11-restrictions-will-send-an-estimated-240-million-pcs-to-the-landfill-when-windows-10-hits-end-of-life-in-2025).

More specifically, Windows sends out so much information about you via so-called telemetry, which Microsoft makes extremely hard to disable.  Compared to iOS and Linux, Windows is far more vulnerable to viruses and ransomware. The user experience also just sucks.  You don't have control over what's happening and your system might just restart on you whenever it pleases.

 All things considered, I recommend that you switch to a Mac. If you want me to make a choice for you, then if you need a low-compute laptop get [a 4th-generation MacBook Air](https://www.apple.com/macbook-air/). Otherwise, get [a 4th-generation MacBook Pro.](https://www.apple.com/macbook-pro/)

 Unfortunately, iOS is _not open source_. However, I'm recommending a pragmatic tradeoff. I think [Apple has a good track record when it comes to user privacy](https://en.wikipedia.org/wiki/Apple%E2%80%93FBI_encryption_dispute) (with a few [exceptions](https://proton.me/blog/protect-data-apple-adp-uk)). Furthermore, Apple has vertically integrated, manufacturing their own CPUs and their own laptops.  Thanks to that end-to-end control, my non-professional understanding is that Apple's focus on privacy translates into a more secure experience than you'd find installing Linux on a random laptop.

 However, closed-source is closed-source.  If you're more technically minded, then transfer your data off your current laptop, wipe the laptop, and install [Debian.](https://www.debian.org/)

 Please don't use Windows.

## Outsmart smart home spying

I love my Google Home setup. Problem is, the microphones are _always on_ - though Google clarifies that the devices only send data after activation via "Hey Google...".  It's a lot of data collected from your home. TODO

Segment using vLANs.

### Run an Apple TV instead of your normal smart TV

Normal smart TVs shove tons of ads in your face and track lots of your data. Apple TVs are much better.

> [!quote] [Breaking down why Apple TVs are privacy advocates’ go-to streaming device](https://arstechnica.com/gadgets/2025/06/all-the-ways-apple-tv-boxes-do-and-mostly-dont-track-you/)
> It remains technologically possible for Apple to introduce intrusive tracking or ads to Apple TV boxes, but for now, the streaming devices are more private than the vast majority of alternatives, save for dumb TVs (which are incredibly hard to find these days). And if Apple follows its own policies, much of the data it gathers should be kept in-house.
  
  - [ ] Purchase an [Apple TV](https://www.amazon.com/2022-Apple-TV-64GB-generation/dp/B0CFM7YT8S/ref=sr_1_1?sr=8-1)
  - [ ] Connect to your TV 
  - [ ] Disconnect your smart TV from the internet. Use the Apple TV as a hub instead

## Minimize sharing your data with LLMs

Minimize or avoid putting private information into cloud-based LLMs. Once you upload your data, assume it may be used for training (unless the provider explicitly guarantees otherwise) or even [available to people running Google searches](https://breached.company/the-ai-privacy-crisis-over-130-000-llm-conversations-exposed-on-archive-org/). But if you have a sensitive topic to get off your chest, what else can you do?

Concerns around LLM privacy TODO. One answer is Apple's [private cloud compute](https://security.apple.com/blog/private-cloud-compute/) framework, which promises significantly more privacy than standard inference.

### Run an LLM on your local machine

Subtitle: For the technically inclined.

As of October 2025, I'm using [`ollama`](https://github.com/ollama/ollama) to run Qwen3-8B on my MacBook Pro M3 (36GB RAM). I use [OpenWebUI](https://github.com/open-webui/open-webui) as a frontend. I set the model and OpenWebUI to run at system startup so that I can query my local model whenever I please. The information I type never leaves my machine except through the model's internet interactions. Peace of mind!

However, the obvious downside is that Qwen3-8B is much less smart than the latest Gemini model. I can't exactly get a high-quality research report from poor little Qwen!

Eventually I'll likely be able to run a local model on my MacBook Pro but with the abilities of Gemini 2.5 Pro. At that point, frontier models will be even more capable, and perhaps I'll miss some other perk instead. That brings me to another stopgap solution I've devised.

### Regularly delete your chat history for frontier models

OpenAI and Google offer the ability to turn off chat history (with limited-time retention for safety purposes). For Anthropic's Claude, you have to enable "incognito chat" before each session. 

As I work at Google DeepMind, I use Gemini the most. If I trust Google to delete data promptly (and I do), then at any point in time where the government comes knocking, my chat history will be mostly empty. I would still theoretically be vulnerable to an ongoing "AI-tap", where the government compelled Google to release my conversations on an ongoing basis. Probably there are more mundane privacy concerns I'm overlooking as well.

Speaking only for myself and not on behalf of Google DeepMind, my guess is that AI companies _will_ comply with subpoenas for your data. Using incognito helps, but only local models are truly private and free of potential surveillance. 


> [!question]- Technical question: Why can't LLM conversations be E2EE?
> This brings us to a set of techniques under the umbrella of [_fully homomorphic encryption_](https://en.wikipedia.org/wiki/Homomorphic_encryption) (FHE). If you homomorphically encrypt your data, then the model can "digest" that data and spit out (encrypted) answers --  without being able to decode what your data mean.
>
> There are several issues. First, no one knows how to run models on FHE data without significant slowdowns. Second, FHE makes LLM tool calls difficult and LLM web searches impossible. Third, if the leading model providers did this, they wouldn't have visibility into potential misuse of their models.

TODO: Include research

## Tweak your operating system's settings to maximize privacy

Follow a guide for your OS and/or ask an AI to write you a guide.(You [aren't using Windows, are you?](#switch-away-from-windows)) Also, read configuration during new updates. For example, I recently turned off the new option of "help Apple improve spotlight search" because it wanted to send location data to Apple for every search I made!

## Be prepared at border checkpoints

In the USA, the DHS cannot compel an American citizen to unlock a password-locked device.  Fingerprints and Face ID are another matter. If you say no, however, they might keep your device for a while and try to crack it on their own.

However, if the "lock" is not a password but merely a biometric, the legal waters seem darker. Therefore, I recommend turning off your devices before the checkpoint, which should force password entry on next unlock. In a pinch, modern phones also enable this if you hold down the screen-power and volume-up buttons.

# Tier 3: For the enthusiast

## Ensure true E2EE for incremental backups

Cloud backups survive house fires, but many cloud services can decrypt your data. I used to use [Backblaze](https://www.backblaze.com/cloud-backup/personal)'s backup client but then realized that they briefly store the encryption key on their own devices. Meaning I have to tell them how to decrypt my data!

iCloud (with ADP) doesn't work because I want complete incremental backup of all the files on my computer in order to protect against losing work if something happens to my system. Therefore, the backup software should be scanning my entire home directory (with exceptions), and also make it easy for me to restore files.

I instead started using [Duplicati](https://duplicati.com/) to send encrypted backup data to [Backblaze B2 storage](https://www.backblaze.com/cloud-storage) on an hourly basis. I start the server on startup and it automatically backs everything up. If you want, you can [download my config template](https://assets.turntrout.com/duplicati.json).

I also have local Time Machine backups on an external hard drive. These backups are also encrypted, so if an adversary grabbed my drive, they wouldn't be able to read my data. As usual, I store the encryption keys in my Bitwarden.

## Own your home network

Subtitle: Cost: ~$250 one-time. Time: 45 minutes.

If you are using the combination modem/router box that your ISP rented to you, you are using a closed-source black box that they control completely. Beyond that, [many standalone TP-Link routers have documented botnet vulnerabilities (possibly due to the influence of the Chinese government).](https://www.cybersecuritydive.com/news/-botnet-exploits-tp-link-router/742319/)

[Your VPN](#protonvpn-stops-your-internet-service-provider-isp-from-spying-on-you) will protect most of your information.  However, the ISP still learns information if they're spying on you via your rented modem-router. They can spy on the details of what's happening _within your local network._ For example, they would know "this household has an iPhone, two laptops, a smart TV, a Google Home, and the iPhone connects every weekday at 7 AM." Once you secure your own equipment, they only know "someone is using 50 GB/day via ProtonVPN."

Plus, open-source routers have neat features. They can shield your entire network using a VPN connection (which is [currently the only way to truly protect outgoing traffic from an iPhone](#vpns-are-fundamentally-unreliable-on-ios-as-of-october-2025)). Open-source routers can also block requests to fetch ads before they even leave the network.  
 

### How to buy the right modem

Subtitle: Cost: \$80-\$180 and 20 minutes of setup.

If you're in the USA with a cable internet connection, you can buy your own modem. If you're outside the USA or have fiber internet, just move to [the next subsection to buy a router](#buy-a-router-that-respects-you). 

Sadly, you can't just buy whatever modem you want. Each ISP has a set of allowed modems. Consult your ISP's list and then find one which has a "DOCSIS" version of 3.0 or greater (the higher, the faster the max speed). Apparently Arris, Motorola, and Netgear tend to be good choices. 

> [!example] My experience upgrading my modem
> I get my internet through Xfinity. I consulted their [list of approved modems](https://www.xfinity.com/support/internet/customerowned) and then I purchased an [Arris SB8200](https://www.amazon.com/ARRIS-SURFboard-Approved-SB8200-Frustration/dp/B07DY16W2Z/ref=sr_1_1?sr=8-1). The newer Arris S34 was supported, but I [read that it was finicky to set up](https://www.reddit.com/r/Comcast_Xfinity/comments/1fkay76/arris_s34_is_finally_working_for_nextgen_fast/?rdt=46016) (and my network connection isn't faster than 800Mbps anyways). At about \$168, the Arris SB8200 modem would pay for itself after 11 months of not paying my ISP \$15/month.

> [!warning] Always buy new modems
>
> Don't buy a refurbished modem. It could still be tied to the previous owner's account, leading to hours of frustrating calls with tech support. More seriously, there's a faint chance that someone tampered with the device to spy on the next buyer.

### Buy a router that respects you

Don't rent a router from a company that wants to harvest your data. Instead, I strongly recommend buying a router from [GL.iNet](https://www.gl-inet.com/). These devices come preinstalled with OpenWrt - the gold standard for open-source router software. I recommend the [GL.iNet Flint 2](https://www.amazon.com/GL-iNet-GL-MT6000-Multi-Gig-Connectivity-WireGuard/dp/B0CP7S3117), which costs \$140 and is powerful enough for a whole house.

Because its software is open-source, it is subject to public scrutiny. You have no idea what shady stuff Comcast may have installed on the default router.  GL.iNet routers offer two additional benefits:
1. Easy to install your ProtonVPN connection for your _entire home_, protecting all your devices automatically.  Normally, a smart TV would not even be able to use a VPN.
2. Easy to enable [AdGuard](https://github.com/AdguardTeam/AdGuardHome), which blocks huge numbers of outgoing requests to ads and trackers.  

For my router, I future-proofed with the [GL.iNet Flint 3](https://www.amazon.com/dp/B0FB8X43KJ). The setup took about half an hour. For the setup itself, I used my laptop. _To configure my hardware, I needed to tell ProtonVPN to "allow LAN connections."_ 

1. [ ] [Set up ProtonVPN on your router via OpenVPN,](https://protonvpn.com/support/flint-gl-ax1800-router/)
2. [ ] Enable your laptop (and phone, if on Android) to use its own VPN:
	1. [ ] Go to the dashboard at `192.168.8.1`,
	2. [ ] Navigate to VPN settings,
	3. [ ] Go from "global mode" to "policy mode" with policy type "do not use VPN for the following",
	4. [ ] Click on the devices which run their own _secure_ VPN connections.
3. [ ] In the Applications tab, enable AdGuard Home. (Even though my Brave browser has strong ad-blocking, AdGuard still blocks about 2.5\% of DNS requests!)

### Wifi network advice

1. Use Bitwarden's password generator in "passphrase" mode to generate passwords like "`kudos ahead reborn smog refined unquote`."
2. To avoid exposing your private network to potential intruders, create a separate guest Wi-Fi network with a separate password.
3. Make sure to enable `WPA3-SAE` for the strongest encryption for connections between your device and the router.


## Buy webcam covers

For less than \$10, I purchased [two webcam covers for my laptops.](https://www.amazon.com/dp/B079MCPJGH?ref=ppx_yo2ov_dt_b_fed_asin_title)[^covers] Even if a hacker compromises webcam and also the "your video is on" light, I still never expose my video feed when I don't expect to. However, this attack is rather rare. Probably this defense just makes you feel better.

[^covers]: If you purchase a cover for your laptop, be sure to not obstruct its ambient light sensor. Shine a bright light on the webcam to check.


## Always lock your laptop or phone before walking away

On Mac, I just hit `ctrl+command+Q` by habit. Otherwise, someone in the area could walk by and browse. Constant vigilance!

## Migrate your social network away from X

<video autoplay loop muted playsinline><source src="https://assets.turntrout.com/static/images/posts/privacy-20251015092621.mp4" type="video/mp4; codecs=hvc1"><source src="https://assets.turntrout.com/static/images/posts/privacy-20251015092621.webm" type="video/webm"></video>{.float-right}

The cup runneth over with reasons to leave X. There's always [Elon Musk's repeated "heil Hitler" salutes from back in January 2025](https://en.wikipedia.org/wiki/Elon_Musk_salute_controversy), or his [illegally](https://federalnewsnetwork.com/reorganization/2025/02/usaid-takeover-is-unconstitutional-lawmakers-say/) cutting USAID and [thereby dooming a projected 26 million people by 2040](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5199076), but even [the platform itself learns to hook into your brain and keep you stressed and scrolling](/digital-declutter).  This platform has done horrible things to world discourse and maybe it's done horrible things to you, too. Although I don't use X regularly, I plan to migrate my account in the coming months. 

> [!quote] [Enshittification](https://en.wikipedia.org/wiki/Enshittification)
> Enshittification is a pattern in which two-sided online products and services decline in quality over time. Initially, vendors create high-quality offerings to attract users, then they degrade those offerings to better serve business customers (such as advertisers), and finally degrade their services to users and business customers to maximize short-term profits for shareholders. \[...\]
> 
> Doctorow advocates for two ways to reduce enshittification: upholding the [end-to-end principle](https://en.wikipedia.org/wiki/End-to-end_principle "End-to-end principle"), which asserts that platforms should transmit data in response to user requests rather than algorithm-driven decisions; and guaranteeing [the right of exit](https://en.wikipedia.org/wiki/Data_portability "Data portability")—that is, enabling a user to leave a [platform](https://en.wikipedia.org/wiki/Platform_economy "Platform economy") without data loss, which requires [interoperability](https://en.wikipedia.org/wiki/Interoperability "Interoperability"). These moves aim to uphold the standards and trustworthiness of online platforms, emphasize user satisfaction, and encourage market competition.

Most importantly, X does not guarantee the "right of exit." If you leave X, you leave your followers and connections behind by default - although you can export your interaction data. To reconnect with your X followers on the alternative platform Bluesky, you would need to find each follower's Bluesky handle on your own (or vice versa, for your followers finding you). In other words: We love our friends more than we hate these platforms, so we stay stuck.[^attrib]

[^attrib]: I read a similar sentence during my research but cannot remember where. Sorry for the lack of attribution!

I propose a TODO



### The pitch for Mastodon

https://docpop.org/2025/02/how-to-get-started-with-mastodon/

Bluesky offers similar: 

> Quote detachment: When a post is quoted by another user’s
post, the author of the original post can detach it from the
quote post. This reduces the risk of harassment through
dog-piling.

![[https://assets.turntrout.com/static/images/posts/privacy-20251015092239.avif]]

https://buffer.com/

> [!idea] 
> Try both Bluesky and Mastodon for a week. See which you enjoy more. Prioritize moving to that platform.




> [!warning] E2EE and social media 
> Neither Bluesky nor Mastodon offers or has announced plans for E2EE. The platforms' decentralized nature makes E2EE technically challenging. Assume that anything you post or DM can be read by platform administrators and potentially compelled by governments. For private conversations, continue using Signal.

1. **Set up new accounts** on Bluesky and/or Mastodon
2. **Export your data** from X (and upload to your Proton Drive!).
	1. [ ] [Create a request to download your data](https://x.com/settings/download_your_data)
	2. [ ] Download the data when ready
3. **Pin an announcement** with your new handles to your X profile
4. **DM your closest contacts** directly - don't rely on them seeing your post
5. **Use a cross-posting tool** for 2-3 months as a bridge
6. **Engage actively** on your new platform to build momentum
7. **Set a sunset date** for X and stick to it
8. **Don't look back** - resist the urge to check X "just in case"

> [!warning] Not everyone will follow you from X. That's OK. 
> Maybe some of your X connections were more casual than you realized. And de

<https://techcrunch.com/2025/09/05/x-is-now-offering-me-end-to-end-encrypted-chat-you-probably-shouldnt-trust-it-yet/>

Pessimistically assume that every interaction on X (including "encrypted" DMs) may be read by the company and/or the government.

## Protect against geo-guessing

Even [without metadata,](#your-pictures-and-videos-contain-your-gps-location) your photo still might be "geo-guessed." In the game ["GeoGuessr"](https://www.geoguessr.com/), people compete to guess the location of a Google Street View photograph (with the ability to explore nearby using the Street View). [Radu, the 2025 world champion, can sometimes guess obscure road locations with 200-meter precision.](https://www.youtube.com/watch?v=-IumRw8Z-XI)  Recently, [`geospy.ai`](https://geospy.ai/) entered the marketplace to power law enforcement. Humans and AI are far more likely to fail locating a patch of forest, but likely to succeed at picking up on subtle cues in urban and rural environments. 

If you share a photo but don't want to share your location, obscure  important clues: crop out landmarks, street signs, distinctive buildings, license plates, and so on. You could run it through a frontier AI like Gemini or Claude to check what they can infer, but that leaves the sensitive photo on their servers. For the technically inclined: install [GeoCLIP](https://github.com/VicenteVivan/geo-clip) to test photos locally on your own machine.

## "Stingrays" trick your phone into revealing information

 This one is pretty annoying.

> [!quote]  [The Electronic Frontier Foundation](https://www.eff.org/deeplinks/2025/03/meet-rayhunter-new-open-source-tool-eff-detect-cellular-spying)
> \[Stingrays\] operate by conducting a general search of all cell phones within the device’s radius. Law enforcement use \[stingrays\] to pinpoint the location of phones often with greater accuracy than other techniques such as cell site location information  and without needing to involve the phone company at all. \[Stingrays\] can also log \[identifiers\] unique to each SIM card, or hardware serial numbers of all of the mobile devices within a given area. Some \[stingrays\] may have advanced features allowing law enforcement to intercept communications in some circumstances.

Avoid having your communications intercepted by using Signal (it's E2EE, so they would just be "intercepting" nonsense ciphertext). Another reason to avoid unprotected texting or phone calls: stingrays could pick up your metadata. I think the only way to avoid being located at all is to enable airplane mode or to even use a Faraday cage to shield your phone from all radio signals.

In 2024, we gained a tool to potentially track these devices: Rayhunter.   For \$20 to buy the hardware and for a dash of technical expertise, you can help collect data on nearby law enforcement usage of this kind of surveillance. You can read about [some conclusions the EFF drew one year later.](https://www.eff.org/deeplinks/2025/09/rayhunter-what-we-have-found-so-far)

# What's next?

> [!idea] Readers who work at Apple: advocate for privacy improvements
> 
If you work at Apple, securing even one of these timely patches would be a _significant win for protecting privacy and freedom across the world._ By order of importance:
> 
> 1. Enable the "Always-on VPN" toggle for consumers, not just enterprise users. Make the default setting "yes." [Current iOS policy directly feeds metadata into ISPs](#vpns-are-fundamentally-unreliable-on-ios-as-of-october-2025), exposing millions of unaware users to tracking and potential political persecution. 
> 2. Tighten the Wi-Fi Positioning Systems to [no longer (theoretically) enable mass surveillance and privacy invasion](https://www.cs.umd.edu/~dml/papers/wifi-surveillance-sp24.pdf):
> 	1. Stop returning the locations of up to 400 unrequested nearby BSSIDs with every successful query. Just return the inferred location of the queried BSSID. This feature allowed the researchers to discover 172 times more BSSIDs than they could by guessing. 
> 	2. Implement a per-device and per-account rate limit that is sufficient for legitimate location lookups but too low for mass data harvesting.
> 	3. Require queries to be tied to an authenticated Apple ID to allow Apple to ban abusive users.
> 	4. Follow Google's model of requiring an API key and charging a small fee for queries. The cost of a global scan would be "prohibitively expensive for all but very powerful adversaries."
> 3. Add a toggle to [disable the 2G radio](#disable-2g) without having to enter lockdown mode. Safeguard user privacy by _defaulting_ to e.g. "2G off (except emergency calls)". It doesn't make sense to be in the middle of strong 5G service but _still_ be open to 2G (and thus to stingrays). 
> 4. Fix [the AirDrop vulnerability](#ios-disable-airdrop) originally reported in 2019. Security researchers have even developed a secure open source solution: ["PrivateDrop."](https://privatedrop.github.io/).

# Do not yield to pressure or fear

"It's just one piece of information", you think. So what if the ISP knows you read an article on [`thenation.com`](https://www.thenation.com/) or [`propublica.org`](https://www.propublica.org/article/immigration-dhs-american-citizens-arrested-detained-against-will)? Or that you texted your friend to ask "can I pick you up soon"? 

The point isn't that individual fragments of your attention will not tell your life story. But by systematically tracking and analyzing these fragments, the government can build a detailed picture of who you are and what you think. _That's the entire reason that data brokers make money from your information_ - because that information strongly predicts what you will go, what you will search, who you know, and what you next want to buy.

Scenario: You go to a protest. [License Plate Readers log every car that drove by](https://www.brennancenter.org/our-work/research-reports/automatic-license-plate-readers-legal-status-and-policy-recommendations). The government scans social media activity using packs of AI led by human handlers. Even though you don't post, the AIs recognize you and your brother by cross-referencing your faces (in others' photographs) against their databases. 

When you follow this guide, you obscure those digital spies and trackers. When you enable a VPN with a kill switch, or switch to the Brave web browser, or privately converse over Signal -- you reclaim bubbles of freedom in which you may think and speak. 

# New measures

* Google home -> home automation green device

  * Block phoning home using pihole

  * Enable hardware-level mutes on the Google microphones

* swap off of google maps (collects tons of data)

%%   * <https://proton.me/blog/european-tech-alternatives>

  * <https://organicmaps.app/> %%

# Thinking about

* better email security? (make PGP available?)
* google forms?
  * none found yet
* Google Meet E2E?
  * Proton Mee%% t coming out in half a year probably

Router and modem replacement in tier 2
[https://routersecurity.org/ISProuters.php](https://routersecurity.org/ISProuters.php)

* note that state actors buy data

Communities need freedom of thought --- even fears can chill speech
Slack -> RocketChat
Discord -> Element.io
<https://t2bot.io/discord/> ---  I already integrated the shard theory room.
(Ideally decentralized so there isn't a central service which can ban people from the network)

Mobile hotspot: always use strong password, WPA3 protocol if available (check doesnt have compatibility issues) %%

[ht%% tps://discuss.privacyguides.net/t/what-should-i-know-about-bluetooth-tracking-as-an-activist/28216/3](https://discuss.privacyguides.net/t/what-should-i-know-about-bluetooth-tracking-as-an-activist/28216/3)

[https://www.notus.org/technology/war-zone-surveillance-border-us](https://www.notus.org/technology/war-zone-surveillance-border-us)

"One description of Weathered Security’s products online boasts that it can also track other signal emissions from key fobs, satellite receivers, low-powered radio chips in modern credit cards or passports, car tire sensors that monitor tire pressure and even medical devices. In an emailed response to a request for comment, the company said: “We do not have any issues with you reporting information obtained under FOIA.”"

More theoretical --- any followup? [https://jacobsschool.ucsd.edu/news/release/3461?id=3461](https://jacobsschool.ucsd.edu/news/release/3461?id=3461)

Hardening against police cracking your PIN or otherwise getting into your device?

Home security cameras
<https://secluso.com>
![[https://assets.turntrout.co %%m/static/images/posts/privacy-20251013201115.avif]]




TODO 
1.  Search Engines - You cover browsers but not search engines. DuckDuckGo, Startpage, or Brave Search deserve mention as privacy-respecting alternatives to Google. 
2. Legal Rights - Brief overview of what surveillance is legal, when you can refuse searches, when to invoke legal representation (especially relevant given your ICE/DHS focus).
3. Privacy.com and cash
4. Cost benefit table



%% read more at https://www.privacyguides.org/

https://techcrunch.com/2025/04/23/government-censorship-comes-to-bluesky-but-not-its-third-party-apps-yet/
 %%
> [!quote] On Tyranny: Twenty Lessons from the Twentieth Century
> Do not obey in advance.
> 
> Most of the power of authoritarianism is freely given. In times like these, individuals think ahead about what a more repressive government will want, and then offer themselves without being asked. A citizen who adapts in this way is teaching power what it can do.


Apple maps data collected or covered by ADP?




Apple has indicated that they are on track to make
several changes to their WPS in order to better protect
user privacy. At the time of writing, they have given AP
operators the ability to opt out of inclusion in Apple’s
WPS by appending the string _nomap to a Wi-Fi network’s
SSID. This change brings it in line with Google’s WPS
and WiGLE, which have also excluded SSIDs with _nomap(Google) and _nomap and _optout (WiGLE) since at least 2016. `https://www.cs.umd.edu/~dml/papers/wifi-surveillance-sp24.pdf`

> "We know that Apple is taking our report seriously," Rye said. "We are given to understand that they have one or more additional remediations in the queue, and we're hopeful that these remediations will help protect the privacy of access point owners that would never know to append "`_nomap`" to their SSID to prevent them from being included in Apple's geolocation database." `https://www.theregister.com/2024/05/23/apple_wifi_positioning_system/`

`https://www.cs.umd.edu/~dml/papers/wifi-surveillance-sp24.pdf`

`https://www.gl-inet.com/blog/preventive-actions-to-safeguard-glinet-users-from-bssid-based-location-tracking/` GLINET routers already safe! 

`https://docs.proton.me/doc?mode=open&volumeId=TIeqFfjdsHhlzJvxtIgcdfdvt5r3SrhrdZjkFOOZ6DzwU0fsqjlDjmQiXkgdTZ9l6UOcBGL05KfQ_yGXWBXXSw%3D%3D&linkId=SMxS_l26I0zQfDC6agbuUzj1r5g8o4vE-6hvq7hYMaHgDFseaW4Y2mjxEZfGeviiMVXZW2G3ELhDXpkey-ZNQg%3D%3D`



   partiful?