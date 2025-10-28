---
title: An opinionated guide to privacy despite authoritarianism
permalink: privacy-despite-authoritarianism
no_dropcap: false
tags:
  - practical
  - personal
  - open-source
  - understanding-the-world
  - community
description: In 2025, America is different. Reduce your chance of persecution via
  smart technical choices.
authors: Alex Turner
hideSubscriptionLinks: false
card_image: https://assets.turntrout.com/static/images/card_images/J9EZDFI.png
aliases:
  - privacy
  - privacy-tips
next-post-slug: advanced-privacy
lw-sequence-title:
next-post-title: Advanced Privacy Despite Authoritarianism
---

> [!quote] [I’m a U.S. citizen who was wrongly arrested and held by ICE. Here’s why you could be next.](https://www.sfchronicle.com/opinion/openforum/article/ice-racial-profiling-21045429.php)
>
> <figure class="float-right"><img src="https://assets.turntrout.com/static/images/posts/privacy-20251026203248.avif" width="780" height="572" alt="|A Latino man sits in a driver's seat, door open. He faces the camera at sunset with a field behind him." loading="lazy" style="aspect-ratio:780 / 572;"><figcaption style="margin-bottom:-.25rem;">The author, George Retes, is also a veteran of the Iraq war, as displayed prominently on the vehicle whose window ICE smashed.</figcaption></figure>
>
> My wallet with my identification was in the car, but the agents refused to go look and confirm that I was a citizen. Instead, I sat in the dirt with my hands zip-tied with other detainees for four hours. When I was sitting there, I could hear agents asking each other why I had been arrested. They were unsure, but I was taken away and thrown in a jail cell anyway.
>
> My first night in jail, my hands were burning from the pepper spray and tear gas because I was never allowed to wash them off. During the three nights and three days I was locked up and put on suicide watch, I could not make a phone call and was not given a chance to speak to a lawyer.[^pic]

[^pic]: Picture credit to [ProPublica.](https://www.propublica.org/article/immigration-dhs-american-citizens-arrested-detained-against-will)

This story isn't an isolated incident: ProPublica [found that "more than 170 US citizens have been held by immigration agents. They’ve been kicked, dragged and detained for days."](https://www.propublica.org/article/immigration-dhs-american-citizens-arrested-detained-against-will) As of October 2025, ICE has become a rogue agency -- a starving, rabid dog let off its leash. Generally, most rabid dogs are not empowered by the full force of the US federal government. This one is. That same government has declared its political opponents to be "domestic extremists" and pursues a naked agenda of persecution.

> [!warning] Authoritarianism is here. Protect yourself.
> The Trump regime views its political opponents as literal enemies of the state:
>
> > [!quote] [Stephen Miller](https://www.snopes.com/fact-check/stephen-miller-democrats-extremist/)
> > Subtitle: Trump's Deputy Chief of Staff for Policy and Homeland Security Advisor
> >
> > The Democrat Party does not fight for, care about, or represent American citizens. It is an entity devoted *exclusively* to the defense of hardened criminals, gangbangers, and illegal alien killers and terrorists. The Democrat Party is not a political party. It is a domestic extremist organization.
>
>   Trump [signed an executive order designating "antifa" as a "domestic terrorist organization"](https://www.whitehouse.gov/presidential-actions/2025/09/designating-antifa-as-a-domestic-terrorist-organization/) (not a legal classification, and "antifa" is not a specific organization). Days later, Trump issued [National Security Presidential Memorandum 7](https://www.whitehouse.gov/presidential-actions/2025/09/countering-domestic-terrorism-and-organized-political-violence/) on "Countering Domestic Terrorism," which directs federal agencies to prioritize investigations of ideologies under "the umbrella of self-described 'anti-fascism'." These ideologies include  "anti-Americanism, anti-capitalism, and anti-Christianity; support for the overthrow of the United States Government; extremism on migration, race, and gender; and hostility towards those who hold traditional American views on family, religion, and morality."
>
> The order put the FBI's Joint Terrorism Task Force in the lead and directed the Treasury Department ["to identify and disrupt financial networks that fund domestic terrorism and political violence,"](https://www.opb.org/article/2025/09/25/trump-orders-crackdown-domestic-terrorists/) naming Democratic donors George Soros and Reid Hoffman as potential targets (without providing evidence).
>
> > [!quote] [Trump's address to 800 senior military leaders at Marine Corps Base Quantico](https://www.aljazeera.com/news/2025/9/30/key-takeaways-from-trumps-speech-to-us-military-generals)
<!-- vale off -->
> > This is going to be a big thing for the people in this room, because it's the enemy from within, and we have to handle it before it gets out of control. It won't get out of control once you're involved at all. We're under invasion from within. No different than a foreign enemy, but more difficult in many ways because they don't wear uniforms.
> >
> > In our inner cities—which we're going to be talking about because it's a big part of war now. It's a big part of war. San Francisco, Chicago, New York, Los Angeles. They're very unsafe places. And we're gonna straighten them out one-by-one. This is gonna be a major part for some of the people in this room. It's a war, too.
> >
> > It's a war from within.
<!-- vale on -->
>
> On October 8th, 2025, Trump [posted](https://www.nbcnews.com/politics/white-house/trump-says-gov-jb-pritzker-chicago-mayor-brandon-johnson-jail-rcna236339) that Chicago Mayor Brandon Johnson and Illinois Governor JB Pritzker "should be in jail for failing to protect Ice Officers!". When pressed by reporters about what crimes he believed they had committed, Trump said "I've seen the law" and doubled down on his call for their imprisonment.
>
> Trump labels his opposition as terrorists, targets political ideologies through executive orders, and tells his generals to prepare to go to war inside our own country. Sooner or later, you might become an "enemy from within."
>
> **Accept the reality of the risk cast by the future. Act now to prepare.**

This guide will help you protect your communications and information so you can think and speak freely. The privacy won't be perfect, but it should give you  breathing room. As more people reclaim their privacy, their networks grow more secure and resistant to authoritarian punishment.

Let's get started.

> [!info]  I'm only speaking for myself
>  My day job is AI alignment research at [Google DeepMind](https://deepmind.google/). I'm only expressing my own views. This guide synthesizes research from security experts and represents my personal practices.

# What should I read?

This guide is long. Don't try to complete it all at once. My website has long-lasting checkbox functionality. As you complete items, check them off to remember your place in the guide.

   - [ ] You can check off this item, refresh the page, and the box will remain checked.

   | **Tier**               | **Time for tier** | **Cost of tier** | **Protection level**                    |
   | -----------------: | :--------: | :----------: | :--------------------------------- |
   | Quick start    | 50 minutes     | $0       | Online accounts secured against most hacking. Limited private communication ability.  |
   | Privacy basics | 90 minutes upfront + 45 minutes for YubiKey setup when it arrives    | \$110 + $13/month        | Significant privacy against mass surveillance. Govt. has a harder time seeing who you talk to and can't monitor what you say on the Signal app. |
   | End-to-end encrypt your data  | At least 4.5 hours  | \$14/month    |   Mass surveillance unlikely to capture your important data or communications.   |

![[https://assets.turntrout.com/static/images/posts/privacy-20251023213135.avif]]{.float-right}

*Each tier builds on the previous, so do them in order.*

1. Something is better than nothing. Even a few hours can transform your privacy.
2. If money is hard to come by, don't worry - many of the best interventions are free.
3. If you find this subject distressing, you're not alone because I do as well. Do what you can.

# What's your risk level?

> [!quote] [Digital Threat Modeling Under Authoritarianism](https://www.schneier.com/blog/archives/2025/09/digital-threat-modeling-under-authoritarianism.html)
> Subtitle: By Bruce Schneier, famous cybersecurity expert
>
<!-- vale off -->
> Being innocent won't protect you.
>
> This is vital to understand. Surveillance systems and sorting algorithms make mistakes. This is apparent in the fact that we are routinely served advertisements for products that don’t interest us at all. Those mistakes are relatively harmless—who cares about a poorly targeted ad?—but a similar mistake at an immigration hearing can get someone deported.
>
> An authoritarian government doesn't care. Mistakes are a feature and not a bug of authoritarian surveillance. If ICE targets only people it can go after legally, then everyone knows whether or not they need to fear ICE. If ICE occasionally makes mistakes by arresting Americans and deporting innocents, then everyone has to fear it. This is by design.
<!-- vale on -->

If you're an immigrant, investigative journalist, or a political figure who opposes Trump, you're at  higher risk and should read both this post and [the sequel](/advanced-privacy). If you lurk and never share political opinions, you're at  lower risk but you should at least do the Quick Start.

| **Your situation** | **Threat level** | **Recommended sections** |
|--:|:-:|:-:|
| General privacy-conscious user | Low | Quick Start & Privacy Basics |
| Politically active, US citizen | Medium | Both guides --- all sections |
| Immigrant, journalist critical of regime, opposition politician | High | Both guides & consult security professionals |
| Facing imminent arrest or deportation | Critical | This guide is insufficient - seek legal counsel immediately |

This guide is about protecting yourself, but it's not necessarily about *hiding*. I personally think what's going on right now is horrible and that most citizens should act. At the same time, you should take intelligent risks via intentional public statements -- not avoidable risk because the government spies on your private communications.

> [!warning] Not sufficient for people at high risk of *targeted* surveillance
> In addition to reading this guide and [the more hardcore sequel](/advanced-privacy) also refer to [a more hardcore guide with targeted surveillance in mind](https://ssd.eff.org/module-categories/security-scenarios). If you're going to enter or exit the USA on international travel soon, consider [preparing devices for travel through a US border](https://www.eff.org/deeplinks/2025/06/journalist-security-checklist-preparing-devices-travel-through-us-border).

> [!warning] What information this guide will and won't help you protect
>   If your phone is connected, cell towers track your approximate location. License plate readers track your car. Facial recognition identifies you in public spaces and others' photos. *You will be hard-pressed to turn invisible while participating in modern society.*
>
>   This guide will teach you to protect a limited selection of your data:
>   1. Content of your communications (Signal E2EE),
>   2. What you're researching and reading (VPN hides websites),
>   3. Your organizing documents and plans (E2EE cloud storage),
>   4. Your network and contacts (E2EE contact storage),
>   5. Correlation across identities (pseudonymity, email aliases).
>
>   In high-risk situations, leave wireless-enabled devices at home, in airplane mode, or in [Faraday bags](https://www.amazon.com/dp/B0CKXK5467?psc=1&smid=AJILGO2IDT8RQ&ref_=chk_typ_imgToDp) for truly sensitive meetings. Otherwise, pessimistically assume the government knows where you are at all times. Also, financial privacy is hard and this guide only helps a bit on that front.

# Open source and encryption are your friends

This article will assume less computer science background than most of my articles do, and that's because I'm writing for friends and family. I'll give concrete, specific, and immediately actionable recommendations. For example, no decision paralysis from waffle-y lists which list the "top 10" password managers. I'll tell you what to use.

I've structured my recommendations around two key principles.

Open source code
:  If a program is open source, then that means anyone can see its code. In turn, that means if the developers put something suspicious or sneaky in the program, someone will probably read the code and notice. You don't need to *trust* that the people who made the app didn't include creepy tracking.

:  Open source programs are usually free as well!

End-to-end encryption (E2EE)
: While iCloud might encrypt the photos you upload, that'll only prevent outside people from taking a peek. If Apple wanted to, they could look at your photos. More concerningly and more likely, if a government demands that Apple hand over your photos, they're able to and they might need to comply. However, if you enable end-to-end encryption, that's no longer possible, because only you can unlock or decrypt that information.  

: Pessimistically, you should assume that anything which isn't E2EE can be read by the government.

Unless I mention otherwise, all of my recommendations are both open source and E2EE. By following this guide's recommendations, you will create "dark spots" where the surveillance apparatus has trouble looking. Even in the face of an authoritarian crackdown on [thoughtcrime](https://en.wikipedia.org/wiki/Thoughtcrime), you will have space in which to think freely and to organize discreetly.

# Quick start in 50 minutes

## Manage passwords with Bitwarden

Subtitle: Time: 30 minutes with ongoing maintenance as you import passwords.

Use a different long password for every single login you have. Do not reuse passwords. Do not reuse passwords. Do not make simple passwords like `mail123`.

If you're not using a password manager already, *Bitwarden will make your life easier*. Bitwarden will remember your passwords and logins for you. It can even fill them in automatically. Bitwarden will generate new secure passwords for you.  Never again must you worry, "which password did I use for this website?!". You just remember one password: the master password for Bitwarden.

Here's what to do:
1. [ ] [Download Bitwarden](https://bitwarden.com/download/) on all of your devices. I use a browser extension on my laptop.
2. [ ] Create an account.
    - [ ] You need a master password. Use [this tool](https://bitwarden.com/passphrase-generator/) to generate a four-word passphrase consisting of four random words in a row ([justification](https://www.reddit.com/r/Bitwarden/comments/14bkaur/how_many_word_for_a_passphrase/)). I recommend separating each word with a space.
    - [ ] Write down the passphrase and keep it in on your person.
    - [ ] At first, you'll have to pull out the phrase all the time. Eventually, you'll memorize it. At that point, destroy the paper.
3. [ ] Use Bitwarden to automatically fill in your passwords. Every time you log into an account, ensure the credentials are stored in Bitwarden.
4. [ ] Every time you make a new account, use Bitwarden to make a new login. Generate a random password which is at least 20 characters long. No sweat off your back there, because you're not the one who has to remember anything! :)

Since you're using a unique password for every site, you won't have to scramble in the event of a breach. The only account which might even possibly be compromised is the specific account whose password was breached. After all, the compromised password has nothing to do with all the other passwords which Bitwarden generated!

## Two-factor authentication (2FA)

"2-factor authentication" means an attacker has to try a lot harder to get into your accounts.  Even if your credentials are exposed in a massive breach, your account will be safe because they won't have access to your second factor.

Enable two-factor authentication on every possible account that you care about protecting. You don't have to do it all at once. You can just enable 2FA on your most important accounts and then start enabling them in the future as you notice.

### Don't use text- and phone-based 2FA

The US government forces telecoms to permit spying on their customers (including you). *Assume that all text messages or phone calls are actively monitored by the government.*

> [!quote] [Communications Assistance for Law Enforcement Act](https://en.wikipedia.org/wiki/Communications_Assistance_for_Law_Enforcement_Act) (CALEA)
> The Act obliges telecommunications companies to make it possible for law enforcement agencies to tap any phone conversations carried out over its networks, as well as making call detail records available. The act stipulates that it must not be possible for a person to detect that his or her conversation is being monitored by the respective government agency.
>
> \[...\] Journalists and technologists have characterized the CALEA-mandated infrastructure as government backdoors. In 2024, the U.S. government realized that China had been tapping communications in the U.S. using that infrastructure for months, or perhaps longer.

Since the American government mandated vulnerabilities in key American communications infrastructure, the Chinese government was also able to exploit those vulnerabilities. We now must turn away from text-based 2FA:

> [!quote] [Government Issues New iPhone, Android 2FA Warning—Stop Using SMS Codes Now](https://www.forbes.com/sites/zakdoffman/2024/12/18/feds-warn-android-and-iphone-users-stop-using-sms-for-2fa/)
> What is clear is SMS is not acceptable, even for temporary, one-time passcodes. “Do not use SMS as a second factor for authentication. SMS messages are not encrypted—a threat actor with access to a telecommunication provider’s network who intercepts these messages can read them. SMS MFA is not phishing-resistant and is therefore not strong authentication for accounts of highly targeted individuals.”

### Use Proton Authenticator as your 2FA app

Subtitle: Time: 5 minutes to install app.

The fast and free upgrade is to prefer authenticator apps over SMS and email.

 As far as applications go, common apps store your 2FA secrets in the cloud without E2EE, which means the cloud owners could theoretically see which websites I'm authenticating with. Proton Authenticator solves both of these issues.
1. [ ] Download Proton Authenticator on your phone ([App Store](https://apps.apple.com/us/app/proton-authenticator/id6741758667), [Play Store](https://play.google.com/store/apps/details?id=proton.android.authenticator&hl=en_US)).

## Keep your OS up to date

Make sure you've enabled automatic security updates on your device. Just search "security update" in your phone and computer settings. Enable for both.  Install operating system updates ASAP.

## iOS: Advanced Data Protection (ADP)

If you use iCloud, enable ADP. In a single flick, ADP will enable end-to-end encryption (E2EE) for the vast majority of the data you store in iCloud. The exceptions are Calendar, Contacts, and Mail. I'll cover how to encrypt those later. Also, [even for E2EE content, Apple retains limited metadata (like filename and size)](https://support.apple.com/en-us/102651).

- [ ] Enable ADP in settings.

> [!warning]
> If you are in the UK, you'll have to refer to [my later section](#end-to-end-encrypt-your-data) on achieving E2EE for your data. That's because [Apple shut down ADP there after being pressured by your government.](https://proton.me/blog/protect-data-apple-adp-uk) It's as tale as old as `<time.h>`: degrading the freedom and privacy of the Web, extending government surveillance --- all in order to "protect the children."

## Secure your devices with strong passwords

Use an eight digit PIN for your phone. Using Bitwarden, secure your laptop with a *passphrase* which consists of five randomly generated words. After a couple tries, you'll remember it.

- [ ] Use a secure password for each device.

## Always lock your device before walking away

On Mac, I just hit `ctrl+command+Q` by habit. Otherwise, someone in the area could walk by and browse. Constant vigilance!

## Use Signal over Facebook Messenger, WhatsApp, texting, or phone calls

Subtitle: Time: 5 minutes.

 Plain phone calls and text messages are not encrypted. That's why the government has been warrantlessly spying on them for a long time. "Encrypted" services (which aren't E2EE) aren't that safe either:

> [!quote] [The WIRED Guide to Protecting Yourself From Government Surveillance](https://www.wired.com/story/the-wired-guide-to-protecting-yourself-from-government-surveillance/)
> Digital services like Facebook Messenger, Telegram, or X may say their direct messages offer “encryption,” but in the default setting that almost everyone uses, they only encrypt information in transit to the server that runs the service. On that server, the information is then decrypted and accessible to the company that controls that server, or any government agency that demands they share that data—like the Nebraska police who demanded Facebook [hand over chats about a 17-year-old’s illegal abortion in 2022](https://www.nbcnews.com/tech/tech-news/facebook-turned-chat-messages-mother-daughter-now-charged-abortion-rcna42185), then brought criminal charges against her and her mother.

 The well-known application [Signal](https://signal.org/) is both open source and E2EE. Secure your communications. Use it.

 - [ ] Use Signal.

 > [!idea] Consider encouraging your friends to use Signal.
 > I don't really use other texting applications anymore.

# Privacy basics in 90 minutes

## ProtonVPN stops your internet service provider (ISP) from spying on you

Subtitle: Cost: Free, with recommended upgrade at $13.99/mo. Time: 15 minutes.

### ISPs are creepy

When you browse the internet, you send your ISP a list of sites you're browsing. They usually can't see the data you're receiving, but they still see where you're going and who you are. When you use a VPN, ISPs can no longer see that information.

> [!quote] [Internet Service Providers Collect, Sell Horrifying Amount of Sensitive Data, Government Study Concludes](https://www.vice.com/en/article/internet-service-providers-collect-sell-horrifying-amount-of-sensitive-data-government-study-concludes)
> The new FTC report studied the privacy practices of six unnamed broadband ISPs and their advertising arms, and found that the companies routinely collect an ocean of consumer location, browsing, and behavioral data. They then share this data with dodgy middlemen via elaborate business arrangements that often aren’t adequately disclosed to broadband consumers.
>  
> “Even though several of the ISPs promise not to sell consumers personal data, they allow it to be used, transferred, and monetized by others and hide disclosures about such practices in fine print of their privacy policies,” the FTC report said.

### The US government spy apparatus is creepy

US government spy agencies have [broad surveillance powers](https://www.aclu.org/warrantless-surveillance-under-section-702-of-fisa) which allow them to compel ISPs and other service providers to hand over communications data without a warrant. While HTTPS encryption (used by most major sites) prevents ISPs from seeing the specific pages you visit or what you search for on encrypted sites, they can still see:

- Which domains you visit (e.g. `google.com`),
- When and how often you visit them,
- How long you spend on each site, and
- Your full browsing activity on the sites that still don't use HTTPS.

The metadata alone reveal a detailed picture of your online life. A VPN prevents your ISP from seeing this information, since all your traffic is encrypted before it reaches the ISP.

I recommend downloading [ProtonVPN.](https://protonvpn.com/) While Proton VPN has a generous free version and is probably the best free VPN there is, it's still the free version. I found the download speed to be slow and unreliable. When I upgraded to the paid version, my problems vanished. Personally, I recommend purchasing a subscription to Proton Unlimited (\$12.99/month, or \$9.99/month if you pay for one year at a time). That subscription will not only unlock the paid VPN tier but will also provide 500GB of E2EE storage via Proton Drive.

As discussed later in [the section on securing your data with end-to-end encryption](#end-to-end-encrypt-your-data), Proton applications are open source, E2EE, and well-respected in privacy circles.  For example, using Proton Calendar (E2EE) instead of iCloud Calendar (a government could compel Apple to decrypt your data, even though Apple secures your data quite well).

- [ ] Create a Proton account and store the credentials in your Bitwarden.
- [ ] [Download and run ProtonVPN](https://protonvpn.com/).
- In the settings, ensure:
     - [ ] Your VPN always starts along with your device.
     - [ ] Traffic can only go through your VPN (enable the "kill switch").
- [ ] Repeat for each of your devices.

For network stability and speed, I strongly recommend upgrading to [Proton Unlimited](https://proton.me/pricing) for \$12.99/month. I recommend several Proton services, including Proton Mail and Drive. Once you upgrade, enable "VPN accelerator" in the settings.

> [!tip] Some websites may think you're a bot because many people use the same VPN IP address
> Compared to other VPNs, I've heard that ProtonVPN is good about avoiding bot detection. Consider changing VPN servers (in the app) if you run into problems. For non-sensitive tasks, you can even disable the VPN -- but please do so sparingly (don't make a bad habit). Your VPN is your most powerful shield against mass surveillance.
>
### VPNs are *fundamentally unreliable* on mobile iOS as of October 2025

> [!danger]
> I was ready to wrap up writing when I found out some intricately bad news: [VPNs on iOS will often "leak" and expose your browsing habits to your ISP](https://www.michaelhorowitz.com/VPNs.on.iOS.are.scam.php).  iOS system services sometime ignore your VPN entirely. This ruins your protection from surveillance by exposing your browsing history directly to Internet Service Providers (AKA US spying data collection points). [Apple states that ignoring your VPN is "expected behavior."](https://protonvpn.com/blog/apple-ios-vulnerability-disclosure/) After five years of known vulnerability, no fix is available for consumers. The issue doesn't affect MacOS.
>  
> Should you still use a VPN if you're stuck with iOS? Yes, it'll still help keep you private from the web services you're using. Know that the ISP (and Apple) will be tracking you. If you don't want that, in the next post, I recommend switching [to GrapheneOS.](/advanced-privacy#switch-to-android-preferably-to-grapheneos)

The Android situation is better. Sadly, there are rare circumstances where VPNs won't protect your traffic. [Android apps can leak past the VPN when they otherwise can't connect.](https://issuetracker.google.com/issues/337961996)  Android also [sporadically makes Wi-Fi "can I connect?" checks which ignore your VPN](https://mullvad.net/en/blog/android-leaks-connectivity-check-traffic), which isn't great --- but that leaks far less information. All in all, it seems like Android is better  in terms of VPNs.

### Other VPN notes

> [!info] It's not paranoia if they really are out to get you
> > [!quote] [ACLU](https://www.aclu.org/warrantless-surveillance-under-section-702-of-fisa)
> > Under Section 702 of the Foreign Intelligence Surveillance Act, the U.S. government engages in mass, warrantless surveillance of Americans’ and foreigners’ phone calls, text messages, emails, and other electronic communications. Information collected under the law without a warrant can be used to prosecute and imprison people, even for crimes that have nothing to do with national security. Given our nation’s history of abusing its surveillance authorities, and the secrecy surrounding the program, we should be concerned that Section 702 is and will be used to disproportionately target disfavored groups, whether minority communities, political activists, or even journalists.
>
> In late 2024, the government further expanded its surveillance powers.
> > [!quote] [Eleven years after Snowden revelations, government still expanding surveillance](https://freedom.press/issues/11-years-after-snowden-revelations-government-still-expanding-surveillance/)
> > Subtitle: Published June 5th, 2024
> > Under the newly enacted “[spy draft](https://reason.com/2024/04/19/how-the-fisa-reauthorization-bill-could-force-maintenance-workers-and-custodians-to-become-government-spies/)” provision, the government can not only enlist telecom providers like Verizon to hand over information about their subscribers’ contacts with foreigners it is investigating, as it has in the past. It [can conscript](https://www.theguardian.com/us-news/2024/apr/16/house-fisa-government-surveillance-senate) any American service provider to spy on its behalf. Sen. Ron Wyden [noted](https://www.wyden.senate.gov/news/press-releases/wyden-urges-colleagues-to-reject-expanding-warrantless-fisa-702-surveillance) that cleaning services could be compelled to insert a USB thumb drive into a server at an office they clean.

## Browse the web using Brave

Subtitle: Time: 30 minutes.

I thoroughly ran available browsers against my criteria for you:

1. Strong privacy protection against commercial and governmental tracking,
2. Strong ad blocking,
3. Runs websites smoothly without major usability sacrifices,
4. E2EE history and preferences sync across mobile and desktop,
5. Open source, and
6. Good default settings (convenient for you).

I settled on [Brave](https://brave.com/), based on Chromium. The browser is a *huge* privacy upgrade from normal browsers, especially in the context of recent restrictions on popular ad blockers. I also found it straightforward to migrate to Brave.

![[https://assets.turntrout.com/static/images/posts/privacy-20251010145522.avif]]
Figure:  For a more granular comparison, see [`privacytests.org`](https://privacytests.org/).

Brave's company has made [a few shady moves](https://www.xda-developers.com/brave-most-overrated-browser-dont-recommend/) in the past. But Brave is the *only* browser which met my six criteria. In terms of privacy, Brave is [far better out of the box than its competitors.](https://privacytests.org/)  Your account information and browsing history is E2EE, meaning you don't have to trust the company itself. Even if you don't like some of the actions taken by the company, you don't have to pay anything to use the browser. You don't have to trust them that the code is secure because people [can just look at that code.](https://github.com/brave/brave-browser)

If you don't want to use Brave, I recommend hardening Firefox [using Arkenfox](https://github.com/arkenfox/user.js) (requires technical expertise) or using the Firefox fork [Librewolf](https://librewolf.net/) (which deletes your cookies and history each setting, disrupting your usual usage patterns).

- [ ] [Download Brave](https://brave.com/).
- [ ] Run Brave, importing during setup your bookmarks from your current browser.
- [ ] Remember to install any extensions you want!
- [ ] On each device:
     - [ ] Set Brave as your default browser.
     - [ ] Enable Sync and enable syncing everything (it's E2EE).
     - [ ] Install the Bitwarden extension, pin the extension icon to be visible while browsing the web, and then [follow this guide to make Bitwarden your default password manager](https://bitwarden.com/help/getting-started-browserext/#disable-a-built-in-password-manager).

> [!note]- Optional additional protections to apply
> 1. [ ] In "Shields", enable:
>       - [ ] "Aggressive tracker & ad blocking".
>       - [ ] "Strict upgrade connections to HTTPS" (prevents snooping on your data).
>       - [ ] "Block fingerprinting" (make it harder for sites to uniquely identify you).
>       - [ ] "Block third-party cookies".
> 2. [ ] In "Privacy and security":
>     - [ ] "WebRTC IP handling policy" to "Disable non-proxied UDP" (otherwise an adversary can find your real IP address, even behind a VPN).
>     - [ ] "Auto-redirect AMP pages".
>     - [ ] "Auto-redirect tracking URLs".
>     - [ ] "Prevent sites from fingerprinting based on language".
>     - [ ] *Disable sending a "Do not track" request* (ironically, it makes you easier to track).
>     - [ ] Disable all options under "Data collection".
> 3. [ ] Also apply these settings in your mobile Brave browser.

> [!tip] Send your friends clean links
> You ever see those *suuuuper* long URLs and think, WTF? Generally, those URLs are full of trackers saying things like "this user came from a specific Facebook ad, has this browser version, and lives near this city." If you notice that kind of URL, go back, right-click the link, and select "copy clean link." Brave will strip away that creepy information.

> [!idea] Insight: reducing commercial tracking reduces your exposure to government tracking
>
> Companies track you and sell your data. Then the US government buys your data.
>
> > [!quote] [Almost 17,000 Protesters Had No Idea A Tech Company Was Tracing Their Location](https://www.buzzfeednews.com/article/carolinehaskins1/protests-tech-company-spying)
> > Mobilewalla does not collect the data itself, but rather buys it from a variety of sources, including advertisers, data brokers, and internet service providers. Once it has it, the company uses artificial intelligence to turn a stew of location data, device IDs, and browser histories to predict a person's demographics — including race, age, gender, zip code, or personal interests. Mobilewalla sells aggregated versions of that stuff back to advertisers. On its website, Mobilewalla says that it works with companies across a variety of industries — like retail, dining, telecom, banking, consulting, health, and on-demand services (like ride-hailing).
> >  
> > "... an enormous number of Americans – probably without even knowing it – are handing over their full location history to shady location data brokers with zero restrictions on what companies can do with it,” Warren said. “In an end-run around the Constitution's limits on government surveillance, these companies can even sell this data to the government, which can use it for law and immigration enforcement. That's why I've opened an investigation into the government contracts held by location data brokers, and I’ll keep pushing for answers."
> >
## Use a privacy-centered search engine

Subtitle: Time: 2 minutes.

Both [Brave Search](https://search.brave.com/) and [DuckDuckGo](https://duckduckgo.com/) are strong engines. That said, neither is as good as Google at surfacing the result you want. If you don't get what you want the first time, consider sending it over to Google by beginning your query with `!g`.

- [ ] In your browser's settings, set one of these to be the default search.

## Give each app as few permissions as possible

Subtitle: Time: 20 minutes to review existing permission settings.

Be especially wary about giving out *precise location* data. Don't be afraid to say "no" if a permissions request seems unreasonable --- you can always read more on the app and come back later if you change your mind. Review your mobile and desktop applications in your permissions centers. Check that apps aren't taking absurd permissions they don't need (like a calculator asking for access to contacts).

- [ ] Review app permissions.

> [!example] Minimizing location permissions
> I found several apps were using my location *all of the time*, including:
> 1. My Govee smart lights app (deny!),
> 2. Maps (should only need it when I'm using the app), and
> 3. System Intelligence (doesn't need much location data).

## Buy a YubiKey (and a backup)

Subtitle: Time: 5 minutes to order & 40 minutes to secure your most important accounts. Cost: \$110.

YubiKeys are physical devices which guarantee "these accounts *cannot* get hacked remotely". They constitute the strongest form of 2FA. To log into an account protected by your YubiKey, you physically tap the key. Accounts like your email or Bitwarden are extremely valuable and worth protecting. The security ordering is: YubiKey > authenticator app > text- / email-based 2FA.

![[https://assets.turntrout.com/static/images/posts/privacy-20251008204055.avif]]{.float-right}

You buy two of these little USB-C boys for \$55 each. Use these as two-factor authentication for your most sensitive accounts. You really, really don't want hackers to compromise your Bitwarden.

1. [Buy two keys.](https://www.yubico.com/product/yubikey-5-series/yubikey-5c-nfc/)
2. Set up key-based 2FA on your most important logins. For each site, register 2FA on both keys.
3. Keep the two factor key in your laptop case or on a keyring. Put the other in a secure location protected from fire and flooding. You could put it in a bank deposit box or in [a private safe at home](https://www.amazon.com/SentrySafe-Resistant-Chest-Cubic-1210/dp/B008HZUI34/ref=sr_1_9?sr=8-9).

> [!question] These keys are expensive. Do I really need two?
> I know they aren't cheap. However, they will make you basically immune to being remotely hacked on your most important accounts (though someone could still do it if they were physically present). That immunity brings security but also peace of mind.
>
> At *minimum*, you need two keys. If you just had one key, you're one "oops I lost it" away from being *locked out of your most important accounts*. Scary! By keeping a backup safe and sound, even your home burning down shouldn't destroy both of your keys.
>
> For convenience, you might even get a third key: a YubiKey 5C Nano (an additional \$65) which you always leave plugged into one of your computer's USB-C ports. This can't be your main key because you'd be unable to access your accounts on mobile unless you always have your computer with you (and thus the Nano as well).
>
> - [ ] If you buy a Nano key, [switch it to "Long Touch" mode](https://support.okta.com/help/s/article/swapping-yubico-otp-between-slot-1-to-slot-2?language=en_US) so it doesn't mess up your typing whenever you bump it.

## Your pictures and videos contain your GPS location

Subtitle: Time: 2 minutes.

Every time you take a picture or video with your phone, your phone tags the media with your location. So if you upload a picture, you're saying where you were.  If an adversary gains access to a sequence of images you've shared, they'll probably know where you go on a daily basis. (However, when you send media using Signal or Proton Mail, the application will scrub the location metadata.)

Stop your phone's camera from saving this automatically. Reduce the number of ways you unknowingly leak location information.

Android
: Search "geotag" in your settings, or just find the setting in your Camera settings.

iPhone
: Settings -> Privacy -> Location Services -> Camera and select "Never."

> [!note] Your files contain more metadata than just location
> Your photos also might expose what kind of phone you're using and the time you took the photo. To remove these from extra-sensitive images, use a special application. Example: [Play Store](https://play.google.com/store/apps/details?id=apps.syrupy.metadatacleaner&hl=en_US), [App Store](https://apps.apple.com/us/app/exif-metadata/id1455197364).

# End-to-end encryption for your data in 4 hours

Subtitle: If it's on the cloud and not E2EE, assume the government can read it.

> [!quote] [Yale Law School](https://law.yale.edu/mfia/case-disclosed/fbis-secret-gag-orders-challenged-ninth-circuit)
> Not only does the Government have the power to issue secret subpoenas demanding your personal information from private companies—it has the power to prohibit those companies from speaking about what has taken place.

It doesn't matter how good a company's security and data handling practices are. Google and Apple have amazing security. If a company can decrypt your data, the government can force the company to decrypt your data. It's not the company's fault --- they would just have to comply.

> [!quote] [The CLOUD Act: A Dangerous Expansion of Police Snooping on Cross-Border Data](https://www.eff.org/deeplinks/2018/02/cloud-act-dangerous-expansion-police-snooping-cross-border-data)
> The Clarifying Overseas Use of Data (CLOUD) Act... creates an explicit provision for U.S. law enforcement (from a local police department to federal agents in ICE) to access “the contents of a wire or electronic communication and any record or other information” about a person regardless of where they live or where that information is located on the globe. In other words, U.S. police could compel a service provider—like Google, Facebook, or Snapchat—to hand over a user’s content and metadata, even if it is stored in a foreign country, without following that foreign country’s privacy laws.

On the other hand, when you use E2EE, the company can't decrypt it. Your data is just a sequence of zeros and ones on a computer. The company has nothing to hand over.

Let's secure your data.

> [!warning] iCloud's Advanced Data Protection may not last forever
> The UK [likely](https://daringfireball.net/2025/02/apple_pulls_advanced_data_protection_from_the_uk) tried to force Apple to backdoor all of their encryption so the government could spy on all iOS users, everywhere. Apple rejected this insane demand and instead made ADP (its primary E2EE feature) unavailable for new users and warned existing users to disable ADP.
>
> Apple didn't make a backdoor, and I don't think they will in the future. Even so, this incident reminds me:
> 1. How important it is to have full E2EE for *all data you care about*,
> 2. Your E2EE should not be through a single cloud provider (lest they be forced to delete all of it), and
> 3. You can't tell if closed source software is backdoored. But someone probably would notice if prominent E2EE software were backdoored.
>
> To be clear, iCloud's ADP is far better than nothing. But open source E2EE is even more secure.

*After each replacement, remember to delete your original data and to stop syncing to that source.*

## Switch to Proton Mail

Subtitle: 30 minutes

Centrally hosted mail may secure your data well, but the company still could read your emails if they wanted to. Even if they treat your data with utmost professionalism, *the government can make them hand over your emails*.

Proton Mail stores your emails E2EE. Proton Mail also screens out creepy tracking scripts which "tell senders and advertisers what you read and click on, and can follow you around the web." It's straightforward to switch to Proton Mail. This [guide's](https://proton.me/support/easy-switch) steps are basically:
1. [ ] Create or log in to your Proton account (e.g. use the account you made above for ProtonVPN).
2. [ ] Push a button to import your calendars, contacts, and emails from e.g. your Google account.  
3. [ ] Push another button to forward new emails from your Gmail to your new ProtonMail address.  
4. [ ] Begin redirecting mail to use ([an alias to](/advanced-privacy#use-email-aliases-instead-of-handing-out-your-real-email-to-random-sites)) your new Proton email address. Mail forwarded from your old address is still visible to authorities if they go check with your mail provider.
5. [ ] Start using Proton Mail! :)

> [!warning] Most of your email can still be read by the authorities in transit
> If two Proton Mail emails communicate, they automatically use E2EE. However, if e.g. a `@gmail.com` address sends you something, the content will be plainly visible to the authorities.

> [!danger] The authorities can always track whom you're emailing and when
> The problem has to do with [the definition of the email protocol itself](https://www.forbes.com/sites/timworstall/2013/08/18/why-email-can-never-be-truly-secure-its-the-metadata/). Use Signal for truly sensitive communication.

## Store files in Proton Drive

Subtitle: Time: 1 hour. Cost: Nothing, if you've already purchased Proton Unlimited. Otherwise, about \$12/month.

I was using Google Drive and iCloud Drive. Neither are open source, and Google Drive isn't E2EE. Proton Drive has a good feature set and integrates naturally with [my suggestion to write sensitive shared documents in Proton Docs](#collaborate-privately). Migration is straightforward: download your existing Drive content and then upload to the Proton Drive app.   If you're subscribed to Proton Unlimited (as I recommended for ProtonVPN), you'll have 500GB of Proton Drive cloud storage. Downloading and uploading will take a while, so do this in the background while you complete other tasks.

- [ ] Download your existing Drive files
    - [ ] Google
    - [ ] iCloud
- [ ] [Install Proton Drive](https://proton.me/drive/download).
- [ ] Migrate your existing files to Proton Drive.

## Take notes with Anytype instead of Notion or Roam

Subtitle: Time: 20 minutes.

Anytype is open source and E2EE. Great for managing your private thoughts and notes without harboring a small fear of being watched. Disclaimer: I haven't used it myself, but would if I wanted something Notion-like.

That said, I use [Obsidian](https://obsidian.md), and if you do, you're fine staying put. While not open source, Obsidian's syncing service is [verifiably E2EE](https://obsidian.md/blog/verify-obsidian-sync-encryption/). Obsidian claims that the app does not collect personal data or track users by default. To be sure, you can use an open source firewall like [LuLu](https://objective-see.org/products/lulu.html) (Mac) or [Open Snitch](https://github.com/evilsocket/opensnitch) (Linux) to block Obsidian from using the internet.

- [ ] [Download Anytype](https://anytype.io/) and import any existing notes you have.

## Store your photos in Ente

Subtitle: Time: Depends on how many photos you have in the cloud on how many services. I'd guess this takes anywhere from 40 minutes to 4 hours. Cost: \$12/month for 1TB storage.

I love [Ente](ente.io). It has so much: fully E2EE, open source, smooth migration, reasonable cloud storage pricing, full compatibility across your platforms, and the application even uses *local* AI to search your images and recognize people!  I certainly wasn't expecting to be able to keep using AI with a privacy-focused solution.

 Plus, now all of my 23,000 photos are in one place.

![[https://assets.turntrout.com/static/images/posts/privacy-20251014141906.avif]]

- [ ] Download [Ente](https://ente.io).
- [ ] Import your photos.
  - [ ] [Google Takeout.](https://takeout.google.com)[^googleDelete]
  - [ ] iCloud Photos.
  - [ ] Any private photos which don't sync automatically to your services.

[^googleDelete]: To delete your data from Google Photos *after* importing to Ente, you'll have to select photos one screen at a time and then click "Download." I found it best to do this on desktop, zoom out my browser a bunch, and then continually expanding my selection by shift-clicking. I selected about 3,000 photos at a time.

## Make OsmAnd your map of choice

Subtitle: Time: 15 minutes.

The [OsmAnd](https://osmand.net) doesn't collect your data but is instead flooded with  data of its own. The maps have surprising amount of detail, down to the nearby benches. I  can even download a detailed map of the entire state of California for just 8GB. Don't worry, the app will give you verbal directions during your trip!

![[https://assets.turntrout.com/static/images/posts/privacy-20251022164131.avif]]

- [ ] Install OsmAnd ([Android](https://f-droid.org/en/packages/net.osmand.plus/), [iOS](https://apps.apple.com/us/app/osmand-maps-travel-navigate/id934850257)).
- [ ] Delete your Maps location data from the cloud.

## Schedule with Proton Calendar

Subtitle: Time: 15 minutes.

Neither Google nor iCloud Calendar are E2EE - even with iCloud's Advanced Data Protection enabled. The government could compel the companies to hand over your calendars (including shared events with other people).

Proton Calendar lacks some of the convenient features of Google Calendar, but Proton calendar gets the job done and it's private. I just imported my Google Calendar and  began making new entries in the Proton calendar instead.  Proton Calendar  automatically imports calendar invitations sent to your Proton Mail address - another  reason to [do your email through Proton Mail.](https://proton.me/mail)

The main drawback is the lack of a direct "Add to Calendar" feature for external invites. To get around this, I created a dedicated Google Calendar and synced it to my Proton Calendar. Now, when I accept an invite, I add it to that Google Calendar, and it automatically appears in my Proton view.

- [ ] Download [Proton Calendar.](https://proton.me/calendar)

## Don't use Partiful or Luma to organize sensitive events

Services like Partiful do not offer E2EE.  Normal calendar events are not private or end-to-end encrypted. Even for Proton Calendar events, to see the entire guest list, the government just needs data from a single guest's calendar - especially since many guests will still be using e.g. Apple Calendar with details readable by Apple and thus by the government.

Use Signal with messages which disappear after a short time period (like a day or a week).  Make the name vague, like "Shrek watch party" or "book club".

## Secure your address book with EteSync

Subtitle: Time: 10 minutes. Cost: \$2/month after free trial.

Android and Apple contacts are *not* encrypted, even if you enable Advanced Data Protection on iOS. I don't want the government to be able to find out who I talk to or the contact information others have entrusted to me. Here's what to do instead:

- [ ] [Register for an EteSync account](https://www.etesync.com/).
- [ ] Download EteSync to mobile devices. Don't worry about the calendar features.
- [ ] On iOS, [consult the user guide for special instructions.](https://www.etesync.com/user-guide/ios/)
- [ ] Import contacts from your existing sources.
- [ ] Create a new "Test Etesync" contact in your app and check that the contact appears in the EteSync app.
- [ ] Once you've verified these contacts work, delete your contacts on whatever cloud service you were using.

## Collaborate privately

1. [ ] To circulate secure forms, use [Cryptpad](https://cryptpad.fr/form).
2. [ ] For E2EE collaborative writing and document critique, use [Proton Docs](https://docs.proton.me/). Integrates well [with Proton Drive](#store-files-in-proton-drive).
3. [ ] Conduct video calls with [Proton Meet](https://proton.me/meet) -- well, when it comes out. In the meantime, consider using [Jitsi-powered video conferencing](https://entraide.chatons.org/en/).

# Reclaim your bubbles of freedom

"It's just one piece of information", you think. So what if the ISP knows you read an article on [`thenation.com`](https://www.thenation.com/) or [`propublica.org`](https://www.propublica.org/article/immigration-dhs-american-citizens-arrested-detained-against-will)? Or that you texted your friend to ask "can I pick you up soon"?

The point isn't that individual fragments of your attention will not tell your life story. But by systematically tracking and analyzing these fragments, the government can build a detailed picture of who you are and what you think. *That's the entire reason that data brokers make money from your information* - because that information strongly predicts what you will search, who you know, and what you next want to buy.

Imagine: You go to a protest. [License Plate Readers log every car that drove by](/advanced-privacy#automated-license-plate-readers-can-t-do-anything-about-them). The government scans social media activity using packs of AI led by human handlers. Even though you don't post, the AIs recognize you and your brother by cross-referencing your faces (in others' photographs) against their databases derived from driver's license photos.

When you follow this guide, you obscure those digital spies and trackers. When you enable a VPN with a kill switch, or switch to the Brave web browser, or privately converse over Signal -- you reclaim bubbles of freedom in which you may think and speak.

By reclaiming bubbles of individual liberty, we thereby promote liberty and justice for all.

![[https://assets.turntrout.com/static/images/posts/privacy-20251026183019.avif|A patriotic man smirks and looks up at a surveillance camera with a red dot in the lens. US flag in the background.]]

> [!tip] Keep reading for more action items
> To truly minimize the chance your communications get you snagged by the incipient surveillance state, you'll want to complete the steps [in the next post](/advanced-privacy). I also offer [a concrete migration plan off of Slack](/advanced-privacy#gradually-transition-workplaces-from-slack-to-element), which *does not* offer privacy from  surveillance.

# Appendix: I care about digital privacy a lot

Edward Snowden [warned of unbridled government surveillance](https://en.wikipedia.org/wiki/The_Snowden_Files) and foresaw a day that the free world would regret its surveillance infrastructure. I think that that day [is now here.](https://www.doomsdayscenario.co/p/america-tips-into-fascism-f51000e08e03254d)

Many people were upset by the Snowden revelations, including me. I [helped organize a local protest on that July 4th.](https://web.archive.org/web/20130704222703/http://www.kcrg.com/news/local/Restore-the-Fourth-Rallies-Against-NSA-Surveillance-in-Cedar-Rapids-Iowa-City-214307871.html) [Limited reforms followed via the FREEDOM Act in 2015](https://en.wikipedia.org/wiki/USA_Freedom_Act)

![[https://assets.turntrout.com/static/images/posts/privacy-20251010202149.avif|Dozens of people hold anti-spying signs in front of photographers. The author is center, helping hold a banner which reads "Restore the Fourth."]]{style="width: 80%;"}
Figure: July 2013. I'm in the center, holding the banner.

# Appendix: A prescient, under-heeded warning about ICE in 2022

 Since its founding in 2003, ICE [has effectively grown into a new surveillance agency](https://americandragnet.org/). ICE not only listens but also intrudes:

> [!quote] [American Dragnet: Data-Driven Deportation in the 21st Century](https://americandragnet.org/)
> Subtitle: Foreword, May 2025
>
<!-- vale off -->
>
> When we published *American Dragnet: Data-Driven Deportation in the 21st Century* in 2022, we understood that the surveillance infrastructure our report describes could one day be deployed by an authoritarian executive to coerce and control the U.S. population at scale. We did not anticipate that this day would come within three years. Our hope was that the findings of our research would be useful for the communities organizing against immigration policing and digital surveillance, and would help to provoke policy change.
>
> Today, as [masked federal agents abduct students off the street in broad daylight](https://www.cnn.com/2025/03/29/us/rumeysa-ozturk-tufts-university-arrest-saturday/index.html), and [the President scoffs at an order from the Supreme Court to facilitate the return of a man illegally deported to El Salvador](https://abcnews.go.com/US/timeline-wrongful-deportation-kilmar-abrego-garcia-el-salvador/story?id=120803843), and [his administration threatens to suspend habeas corpus](https://www.msnbc.com/rachel-maddow-show/maddowblog/trumps-line-possibly-suspending-habeas-corpus-goes-bad-worse-rcna236649), to hope to be saved by “policy change” would be to indulge in soothing nonsense. It would be vain to hope that the exposure of wrongdoing or the revelation of brutality could rouse the current Congress on behalf of the people.
>
> There is, in some sense, nothing left to be revealed or exposed. Or to be more precise, the revelation and exposure of new particulars will not tell us anything more about the nature of the political situation through which we are living. The struggle now is not to uncover the right information, but to rightly understand the meaning of the information we already have, and to face that meaning together.
<!-- vale on -->
