---
title: Advanced Privacy Despite Authoritarianism
permalink: advanced-privacy
no_dropcap: false
tags:
  - open-source
  - understanding-the-world
  - practical
  - community
description: In 2025, America is different. Reduce your chance of persecution via smart technical choices.
authors:
  - Alex Turner
hideSubscriptionLinks: false
card_image: https://assets.turntrout.com/static/images/card_images/J9EZDFI.jpg
aliases:
  - advanced-privacy-despite-authoritarianism
prev-post-slug: privacy-despite-authoritarianism
prev-post-title: An Opinionated Guide to Privacy Despite Authoritarianism
date_published: 2025-11-06 14:34:13.304738
date_updated: 2026-01-10 10:26:40.099417
card_image_alt: A patriotic man smirks and looks up at a surveillance camera with a red dot in the lens. A US flag hangs in the background.
---







As motivated in  [An Opinionated Guide to Privacy Despite Authoritarianism](/privacy), 2025 is a rough time and it might get _way_ worse. I'll assume you've read the previous post and have taken the suggested precautions. This guide seems most appropriate for people at higher risk, like opposition politicians, immigrants, and investigative journalists. However, the Trump regime gives little respect to legal boundaries. I think everyone should gear up for the potentially darker days ahead.

![[https://assets.turntrout.com/static/images/posts/advanced-privacy-20251026182933.avif|A patriotic man smirks and looks up at a surveillance camera with a red dot in the lens. US flag in the background.]]

# Overview

Don't try to do everything at once. As in the first article, even a few hours can dramatically boost your privacy. If you're short on money, then you can skip the hardware replacement recommendations.

|                     **Section focus** |           **Time for section**           | **Anticipated cost of completing section** | **Benefits**                                                                                |
| ------------------------------------: | :--------------------------------------: | :----------------------------------------: | :------------------------------------------------------------------------------------------ |
|              **Harden your hardware** | 8 hours + 20 hours if switching to Linux |                   $900+                    | Somewhat secures your physical devices from surveillance and some direct attacks.           |
|     **Secure your digital footprint** |                 2 hours                  |                 $15/month                  | Minimizes the trail of personal data linked to your real identity online.                   |
| **Advanced mobile & travel security** |                  1 hour                  |                     $0                     | Helps protect your data and devices from seizure, surveillance, and location-based attacks. |
|        **Long-term strategic shifts** |                 Ongoing                  |                  Variable                  | Builds personal and communal resilience against surveillance.                               |

> [!info]  I'm only speaking for myself
> My day job is AI alignment research at [Google DeepMind](https://deepmind.google/). I'm only expressing my own views. This guide synthesizes research from security experts and represents my personal practices.
>
# New concepts

## The difference between mass surveillance and targeted investigation

[An Opinionated Guide to Privacy Despite Authoritarianism](/privacy-tips)  protects against mass surveillance that lets the government track lots of people at once. This guide _partially_ addresses both mass and targeted investigation. In a targeted investigation, you now need to worry about physical threats as well: device seizure, physical surveillance, informants, and people who are investigating you in particular.

This guide _is not sufficient to protect you against targeted investigation_. Think of these guides as raising the cost for the government to surveil you. It's still possible, but it's tougher and less likely.

## Protect your network, not just yourself

Other people are at risk too. Optimize your setup to leak as little information as possible about your friends, family, and colleagues. For example, using E2EE [Proton Calendar](/privacy-despite-authoritarianism#schedule-with-proton-calendar) and E2EE contact management with [EteSync](/privacy-despite-authoritarianism#secure-your-address-book-with-etesync) means that the government can't figure out who you're  meeting with by just demanding data from your cloud calendar provider.

## Know your rights

If you are at high risk (e.g. as an immigrant), educate yourself ([ACLU](https://www.aclu.org/know-your-rights)). Consider printing off [a flyer](https://www.ilrc.org/community-resources/know-your-rights/know-your-rights-when-confronted-ice-flyer) to keep on your person --- remembering in the moment is hard.

# Harden your hardware in a dozen hours

> [!money] Spending money wisely
> Many of the most vulnerable are least able to follow the recommendations in this section. To them, I would say: [switch from Windows to Linux Mint](#switch-away-from-windows) (free!) and then advance to the "[Secure your digital footprint](#secure-your-digital-footprint-in-3-hours)" section.
>
> The subsections are in descending order of importance. If you have some money to spend, then I'd focus on:
>
> 1. Switching to GrapheneOS,
> 2. Switching to Linux (free) or MacOS (famously not free) plus a travel router, and
> 3. Owning your home router (and modem if relevant).
>
> Other purchases are not critical -- e.g. buying an Apple TV to replace your standard smart TV operating system. These purchases will improve your privacy, but they aren't critical.

## Switch to GrapheneOS

Subtitle: Cost: \$0 if you already have a Google Pixel phone; \$550 if you run the setup yourself; \$850 if you buy a phone with GrapheneOS pre-installed. Time: 6 hours.

Here's the deal: [iOS fundamentally breaks all mobile VPNs, meaning ISPs and the government will be able to track you](/privacy-despite-authoritarianism#vpns-are-fundamentally-unreliable-on-ios-macos-as-of-december-2025). 'Tis a shame, because [iOS is quite strong on privacy and minimizing telemetry](https://www.scss.tcd.ie/doug.leith/apple_google.pdf). Android does better but still can leak your identity in rare cases. If you want to _both_ use a smartphone _and_ reliably avoid mass surveillance, you should switch to GrapheneOS.

> [!info] Reminder that I work at Google DeepMind
> Though I don't think my employment much influenced my recommendations. Before I learned about [the VPN fiasco](/privacy-despite-authoritarianism#vpns-are-fundamentally-unreliable-on-ios-macos-as-of-december-2025), I was ready to recommend iOS for people at lower risk.

I recommend [GrapheneOS](https://grapheneos.org/) installed on a Google Pixel phone (yes, it has to be a Pixel). GrapheneOS seems like the most private mobile OS available.   Many people praise the operating system for its speed, battery life, and strong customizability.
 ![[https://assets.turntrout.com/static/images/posts/privacy-20251021184025.avif|A user asks "But you trust @GrapheneOS right?". Edward Snowden replies "I use GrapheneOS every day."]]

I'm going to be real with you: the switch will be inconvenient at first. It took me an entire evening to get all my apps set up again. If you want to invest in avoiding a surveillance state, this is a good investment. You'll end up with a phone that has nearly all the functionality you'd expect of an Android. Everything should just work, with a few exceptions:

1. A small number of banking apps don't work. Make sure that your bank is [listed as compatible](https://privsec.dev/posts/android/banking-applications-compatibility-with-grapheneos/). If your app isn't listed, that might be OK. For example, a friend found that First Tech bank's app isn't on the list, but he was still able to log in using the Brave web browser on my GrapheneOS phone. From there, GrapheneOS can pin the webpage to the home screen.
2. Google Pay won't work, so you can't pay by scanning with your phone directly. To replicate the experience, [purchase a credit card holding accessory](https://www.amazon.com/s?k=phone+credit+card+holder)  and put your card in the back.  This should feel basically the same. I do miss using Google Pay for public transportation.

### How to make the switch

If you're technically comfortable, I recommend buying a Pixel 9a  for about \$499 directly from Google (if you buy from a carrier, you might hit issues).  Then [install the OS yourself](https://grapheneos.org/install/web) -- the process is surprisingly straightforward!

- [ ] [Buy a Pixel 9a normally](https://store.google.com/product/pixel_9a).
  - [ ] [Install GrapheneOS.](https://grapheneos.org/install/web)
- [ ] If you aren't comfortable setting it up yourself, [buy a Pixel with GrapheneOS preinstalled for \$799.](https://liberateyourtech.com/product/buy-grapheneos-phone-pixel-new/)

#### For any Android user: download apps from Obtainium and Aurora

Subtitle: Time: 30 minutes to reinstall apps from secure sources.

Complete this section whether you're on a new GrapheneOS installation or whether you're keeping your current Android device. Obtainium downloads apps directly from developers (cutting out potentially compromised middlemen). Aurora lets you access the Play Store's full catalog without a Google account tracking every installation.

1. [ ] Install [Obtainium.](https://obtainium.imranr.dev/)

Obtainium is not as intuitive as the Play or App Store, but it's fine with a bit of practice. Here's what I figured out. You'll navigate two kinds of installations: simple installations and "complicated" installations.

To download a "simple" app (like the [Transportr public transit scheduler](/privacy-despite-authoritarianism#make-magic-earth-your-map-of-choice)):
        1. Open the "Add app" tab in Obtainium.
        2. Search for the name of the app (e.g. "Transportr") using the field "Search (some sources only)".
        3. Select the search sources "GitHub", "GitLab", and "Forgejo".
        4. When you see potential matches, you won't see star ratings or reviews. Instead, you can click on the names to see how popular and legitimate the application looks. Review the description to make sure it's an app for Android developed by the correct team (e.g. Proton VPN should be developed by a user like [`ProtonVPN`](https://github.com/ProtonVPN/android-app) and not `Bill.Farthings42`).
        5. If the repository looks legit, go back and select that application to install.
        6. _Fully uninstall any other versions of the application first._
        7. Complete the installation through Obtainium.

The Signal messaging app is a "complicated" installation. To download Signal, just go to [this set of crowdsourced app configurations](https://apps.obtainium.imranr.dev/) and click "add to Obtainium" --- other folks did the complicated work for you. :)

2. [ ] Install AppVerifier (a "complicated" installation). AppVerifier helps you check that you're installing legit versions of apps. When you install an application through Obtainium, you can "share" the downloaded file with AppVerifier to check.

> [!tip] Complicated installations from these guides
> I recommend adding all of these configurations to your Obtainium so you can install them. Make sure to uninstall any existing versions first.
>
> - [ ] AnyType,
> - [ ] AppVerifier,
> - [ ] Aurora Store,
> - [ ] Bitwarden,
> - [ ] Brave,
> - [ ] Ente,
> - [ ] Home Assistant,
> - [ ] Mastodon,
> - [ ] Obsidian,
> - [ ] Proton Calendar,
> - [ ] Proton Drive,
> - [ ] Signal, and
> - [ ] Tor Browser.

The above list contained the [Aurora app store](https://auroraoss.com/). Aurora carries everything on the Google Play app store, but it's open source and downloads applications anonymously (even Google won't know). Not all apps are on Obtainium. When you want to download an app, first check if it's on Obtainium and then check Aurora.

For GrapheneOS users, I recommend first installing Aurora, Bitwarden, and then ProtonVPN via Aurora. Once behind a VPN, the rest of your mobile installation activity will be more private.

- [ ] Even if you aren't setting up GrapheneOS, reinstall all of your apps which can be installed using Obtainium. By doing so, you download your apps directly from the developers, reducing the possibility of government-inserted vulnerabilities.

#### The rest of the switch to GrapheneOS

1. [ ] Download Bitwarden and then download Proton VPN.
2. [ ] For YubiKey 2FA compatibility, you'll need to download Google Play Services and give it network access. You don't need to give Google Play network access.
3. [ ] Download your other apps.
       - Be stingy in letting them access the network --- only give them access if they should have it.
       - Instead of downloading apps for everything (e.g. a banking app), I just tapped "install web app" after loading the banking page. Web apps expose less of your data than native apps.
       - If you use Android Auto, then you'll need to download it as well.
4. [ ] Set these security settings in `Settings -> Security & privacy`:
    1. [ ] Exploit protection:
        1. [ ] Auto reboot: 8 hours (makes it harder to crack your device, since your phone is only truly protected before you unlock it for the first time after powering it on).
        2. [ ] USB-C port: "Charging-only when locked" (rules out large class of USB-C based attacks).
        3. [ ] Turn off Wi-Fi and Bluetooth automatically: 5 minutes (reduce [passive tracking by nearby beacons](#surreptitious-beacons-track-your-every-movement)).
        4. [ ] Hardened memory allocator: Enabled (protects against many common hacks).

## Switch away from Windows

Subtitle: Cost: \$0. Time: 20 hours.

For years, I dithered about switching away from Windows. Windows was all I knew.  But now that I've switched, I'm glad I did. Microsoft Windows operates on a misaligned business model that extracts data, annoys you, and fundamentally doesn't respect you.

Windows leaks your data like water through someone's hands... after they've fully opened their hands, that is! Honestly, Windows is so frustrating. Even though it's what I grew up with, after spending a few years away, I'm so glad I don't have to deal with it anymore. Doubly so considering how Microsoft pushed out Windows 11 to force [millions of consumers  replace millions of computers which work just fine with Windows 10](https://www.tomshardware.com/software/windows/microsofts-draconian-windows-11-restrictions-will-send-an-estimated-240-million-pcs-to-the-landfill-when-windows-10-hits-end-of-life-in-2025).

More specifically, Windows sends out so much information about you via so-called telemetry, which Microsoft makes extremely hard to disable.  Compared to iOS and Linux, Windows is far more vulnerable to viruses and ransomware. The user experience also just sucks.  You don't have control over what's happening and your system might just restart on you whenever it pleases.

**Please don't use Windows. To be safe, assume anything you type on a Windows machine will be transmitted back to Microsoft and the federal government.**

### Linux can be your new home

All things considered, I recommend that you switch to Linux, an open source operating system. Each line of code has been inspected by experts from around the world -- from the first loading screen down to the calculator. Linux is both free and private. Unlike macOS, [Linux doesn't have the VPN bypass issues](/privacy-despite-authoritarianism#vpns-are-fundamentally-unreliable-on-ios-macos-as-of-december-2025) that plague Apple devices. Linux comes in many different flavors, but I recommend Linux Mint. While I haven't used it before, it's strongly praised:

> [!quote] [Ars Technica](https://linuxmint.com/)
> Linux Mint just works. It isn't "changing the desktop computer paradigm," or "innovating" in "groundbreaking" ways. The team behind Mint is just building a desktop operating system that looks and functions a lot like every other desktop operating system you've used, which is to say you'll be immediately comfortable and stop thinking about your desktop and start using it to do actual work.

If you have a Windows computer, you can just install Linux Mint on your computer. You don't need to buy anything new. For example, you could follow PC Magazine's guide: [Don't Like Windows 11? It's Never Been a Better Time to Make the Switch to Linux](https://www.pcmag.com/how-to/how-to-make-the-switch-from-windows-to-linux).  At first, you "dual boot" which just means you have two choices: you can boot up Windows or Linux.

- [ ] Open this page on your new Linux machine.

### The Mac alternative

Mac is also way more private than Windows. I use a Mac and I'm happy with it, but if I could go back and change my choice, I might've gone with Linux. Reason being: Mac [leaks traffic outside of the VPN](/privacy-despite-authoritarianism#vpns-are-fundamentally-unreliable-on-ios-macos-as-of-december-2025) and also requires trust in Apple --- since MacOS is _not open source_. However, I think [Apple has a good track record when it comes to user privacy](https://en.wikipedia.org/wiki/Apple%E2%80%93FBI_encryption_dispute) (with a few [exceptions](https://proton.me/blog/protect-data-apple-adp-uk)). Furthermore, Apple is vertically integrated and so manufactures their own CPUs and laptops. That produces a more secure experience.

- [ ] If you want me to make a choice for you, then if you need a low-compute laptop get [a 4th-generation MacBook Air](https://www.apple.com/macbook-air/). Otherwise, get [a 4th-generation MacBook Pro.](https://www.apple.com/macbook-pro/)
- [ ] Secure your [leaky](/privacy-despite-authoritarianism#vpns-are-fundamentally-unreliable-on-ios-macos-as-of-december-2025) macOS VPN by purchasing the GLi.Net [Opal](https://store-us.gl-inet.com/products/united-states-opal-gl-sft1200-gigabit-wireless-router-dual-band-openwrt-ipv6-tor?_pos=2&_sid=3044a6c07&_ss=r) (\$35) or the [Beryl AX](https://store-us.gl-inet.com/products/beryl-ax-gl-mt3000-pocket-sized-wi-fi-6-wireless-travel-gigabit-router?_pos=2&_sid=f2a676e8e&_ss=r) (\$90). As I am about to explain, [you'll need to set up the router-level VPN](#protect-your-network-not-just-yourself). _When you need to ensure privacy, only connect an Apple device to the internet through a VPN-enforced router._

## Own your home network

Subtitle: Cost: $250 one-time. Time: 1 hour.

If you are using the combination modem/router box that your ISP rented to you, you are using a closed-source black box that they control completely. Beyond that, [many standalone TP-Link routers have documented botnet vulnerabilities (possibly due to the influence of the Chinese government).](https://www.cybersecuritydive.com/news/-botnet-exploits-tp-link-router/742319/)

[Your VPN](/privacy-despite-authoritarianism#proton-vpn-stops-your-internet-service-provider-isp-from-spying-on-you) will protect most of your information ([unless you're on an Apple device](/privacy-despite-authoritarianism#vpns-are-fundamentally-unreliable-on-ios-macos-as-of-december-2025)).  However, the ISP still learns information if they're spying on you via your rented modem-router. They can spy on the details of what's happening _within your local network._ For example, they would know "this household has an iPhone, two laptops, a smart TV, a Google Home, and the iPhone connects every weekday at 7 AM." Once you secure your own equipment, they only know "someone is using 50 GB/day via Proton VPN."

Plus, open-source routers have neat features. They can shield your entire network using a network-wide VPN connection (which is [currently the only way to truly protect outgoing traffic from an iPhone](/privacy-despite-authoritarianism#vpns-are-fundamentally-unreliable-on-ios-macos-as-of-december-2025)). Open-source routers can also block requests to fetch ads before they even leave the network.

### Buy the right modem

If you're in the USA with a cable internet connection, you can buy your own modem. If you're outside the USA or have fiber internet, just move to [the next subsection to buy a router](#buy-a-router-that-respects-you).

Sadly, you can't just buy whatever modem you want. Each ISP has a set of allowed modems.

- [ ] Consult your ISP's list and then buy a modem which has a "DOCSIS" version of 3.0 or greater (the higher, the faster the max speed). Apparently Arris, Motorola, and Netgear tend to be good choices.

> [!example] My experience upgrading my modem
> I get my internet through Xfinity. I consulted their [list of approved modems](https://www.xfinity.com/support/internet/customerowned) and then I purchased an [Arris SB8200](https://www.amazon.com/ARRIS-SURFboard-Approved-SB8200-Frustration/dp/B07DY16W2Z/ref=sr_1_1?sr=8-1). The newer Arris S34 was supported, but I [read that it was finicky to set up](https://www.reddit.com/r/Comcast_Xfinity/comments/1fkay76/arris_s34_is_finally_working_for_nextgen_fast/?rdt=46016) (and my network connection isn't faster than 800Mbps anyways). At about \$168, the Arris SB8200 modem would pay for itself after 11 months of not paying my ISP \$15/month.

> [!warning] Always buy a new modem
>
> Don't buy a refurbished modem. It could still be tied to the previous owner's account, leading to hours of frustrating calls with tech support. More seriously, there's a faint chance that someone tampered with the device to spy on the next buyer.

### Buy a router that respects you

Don't rent a router from a company that wants to harvest your data. Instead, I strongly recommend buying a router from [GL.iNet](https://www.gl-inet.com/). These devices come preinstalled with OpenWrt - the gold standard for open-source router software. I recommend the [GL.iNet Flint 2](https://www.amazon.com/GL-iNet-GL-MT6000-Multi-Gig-Connectivity-WireGuard/dp/B0CP7S3117), which costs \$140 and is powerful enough for a whole house.

Because its software is open-source, it is subject to public scrutiny. You have no idea what shady stuff Comcast may have installed on the default router.  GL.iNet routers offer two additional benefits:

1. Easy to install your Proton VPN connection for your _entire home_, protecting all your devices automatically (including mobile iOS devices which [cannot otherwise form secure VPN connections](/privacy-despite-authoritarianism#vpns-are-fundamentally-unreliable-on-ios-macos-as-of-december-2025)).  Normally, a smart TV would not even be able to use a VPN.
2. Easy to enable [AdGuard](https://github.com/AdguardTeam/AdGuardHome), which blocks huge numbers of outgoing requests to ads and trackers.  

For my router, I future-proofed with the [GL.iNet Flint 3](https://www.amazon.com/dp/B0FB8X43KJ). For the setup itself, I used my laptop. _To configure my hardware, I needed to tell Proton VPN to "allow LAN connections."_

1. [ ] [Set up Proton VPN on your router via OpenVPN,](https://protonvpn.com/support/flint-gl-ax1800-router/)
2. [ ] If you don't use macOS, you can exempt your laptop so it uses its own VPN, retaining your ability to switch VPN servers on the fly.
    1. [ ] Go to the dashboard at `192.168.8.1`,
    2. [ ] Navigate to VPN settings,
    3. [ ] Go from "global mode" to "policy mode" with policy type "do not use VPN for the following", and
    4. [ ] In the VPN tunnel, exempt the devices which run their own _secure_ VPN connections.
    5. [ ] Create a new tunnel (priority 1) which does not use VPN (see below for target configuration).
3. [ ] In the VPN tab, disable "All other traffic" to ensure that only VPN-protected traffic goes through.
4. [ ] In the Applications tab, enable AdGuard Home. (Even though my Brave browser has strong ad-blocking, AdGuard still blocks about 2.5\% of DNS requests!)

Here's what my VPN settings looked like by the end:

![[https://assets.turntrout.com/static/images/posts/advanced-privacy-20251028095334.avif|OpenWrt VPN settings.]]

### Wifi network advice

1. Use Bitwarden's password generator in "passphrase" mode to generate passwords like "`kudos ahead reborn smog refined unquote`."
2. To avoid exposing your private network to potential intruders, create a separate guest Wi-Fi network with a separate password.
3. Make sure to enable `WPA3-SAE` for the strongest encryption for connections between your device and the router.

## Beware popular security cameras

Apparently many security camera solutions are horrible for privacy. Make sure you're either keeping your videos local or that the video is encrypted so that only you can decrypt it. [Reolink](https://reolink.com/) seems good and is compatible with Home Assistant!

## Control smart home devices with Home Assistant

Subtitle: Cost: \$130. Time: 10 hours. Optional, but make sure you secure your smart device microphones.

I love my Google Home setup but it sends data home which isn't E2EE. The solutions: either _stop_ using always-listening devices or switch to the open source [Home Assistant](https://www.home-assistant.io/) platform.

- [ ]  Disable the microphones on any Google Home or Amazon Echo devices.  These devices can still work with Home Assistant, but you might want to turn them off until you get that set up.
  - [ ] Alternatively, block them from phoning home [at the router level using AdGuard](#buy-a-router-that-respects-you).
- [ ]  Purchase the [Home Assistant Green](https://www.home-assistant.io/green) for \$130.
- [ ]  Follow the included instructions.  Make sure to look around for videos which explain the application. It's not totally intuitive.

## Run an Apple TV instead of your normal smart TV

Subtitle: Cost: $130. Time: 30 minutes to set up.

Normal smart TVs track lots of your data. Apple TVs are much better.

> [!quote] [Breaking down why Apple TVs are privacy advocates’ go-to streaming device](https://arstechnica.com/gadgets/2025/06/all-the-ways-apple-tv-boxes-do-and-mostly-dont-track-you/)
> It remains technologically possible for Apple to introduce intrusive tracking or ads to Apple TV boxes, but for now, the streaming devices are more private than the vast majority of alternatives, save for dumb TVs (which are incredibly hard to find these days). And if Apple follows its own policies, much of the data it gathers should be kept in-house.
  
- [ ] Purchase an [Apple TV](https://www.amazon.com/2022-Apple-TV-64GB-generation/dp/B0CFM7YT8S/ref=sr_1_1?sr=8-1).
- [ ] Disconnect your smart TV from the internet. Use the Apple TV as a hub instead.

# Secure your digital footprint in 3 hours

## Be pseudonymous when possible

Minimize how often you provide your real name, [your real email address](#use-email-aliases-instead-of-handing-out-your-real-email-to-random-sites), your real phone number, or [your real credit card](#use-virtual-cards-for-online-purchases). You won't achieve perfect security, but you're reducing the amount of data obviously tied to you.

My well-known pseudonym is "TurnTrout", but in 2018 I decided to link my real-life identity. When I need a private pseudonym, I use Bitwarden's username generator. I recommend you do the same, generating a _new_ pseudonym for each site unless you want to link in your real identity.

## Use email aliases instead of handing out your real email to random sites

Subtitle: Time: 15 minutes initial setup.

If you use aliases, you make it harder for scammers and surveillance to track your online identity. You can also disable an alias if a site uses that alias to spam you.

- [ ] Link your [Proton Unlimited](/privacy-despite-authoritarianism#proton-vpn-stops-your-internet-service-provider-isp-from-spying-on-you) account with [SimpleLogin](https://simplelogin.io/) to generate random-looking single-use email addresses.[^premium]

![[https://assets.turntrout.com/static/images/posts/privacy-20251010205613.avif|Step 1 shows using an alias in a signup form. Step 2 shows emails being forwarded to your real inbox. Step 3 explains that replying sends from the alias, keeping your real email hidden.]]

- [ ] Follow Bitwarden's [guide on setting up Bitwarden to generate email aliases on-demand when you're generating new passwords](https://bitwarden.com/help/generator/#username-types) --  check the "forwarded email alias" subsection. Bitwarden is lovely, isn't it?

[^premium]: If you've purchased Proton Unlimited as [recommended](/privacy-despite-authoritarianism#proton-vpn-stops-your-internet-service-provider-isp-from-spying-on-you), you'll already have a premium SimpleLogin account.

## Use virtual cards for online purchases

Subtitle: Cost: Free for up to 10 new virtual cards per month. Time: 15 minutes.

Companies buy your data because it helps them predict what you'll do. The government wants it for similar reasons. As we do not live in a world with E2EE transactions between buyers and sellers, we must settle for imperfect protection.

Services like [Privacy.com](https://privacy.com) generate single-use or merchant-locked virtual credit cards. This prevents merchants from:

- Charging you after cancellation,
- Making it hard for you to cancel (just delete the virtual card),
- Exposing your real card in data breaches.

Protect yourself.

- [ ] Install the [desktop browser extension for Brave.](https://www.privacy.com/browser-extension)
- [ ] Install [the mobile app](https://www.privacy.com/mobile-app).
- [ ] On Privacy.com account settings, make your purchases show up as "Privacy.com" on your bank and credit card statements.

> [!idea] You can  buy digital services pseudonymously
> Real-world items will require shipping to a real address. Unless you're going to set up random addresses via mail-forwarding services, you'll need to provide identifying information. That information may be sold to data brokers and then bought by the government.
>
> However, you can pay for digital services pseudonymously using a virtual card, an [email alias](#use-email-aliases-instead-of-handing-out-your-real-email-to-random-sites), and a random fake name (but don't do this for anything which legally requires your real information). When merchants sell those data to brokers, the brokers won't be able to link it to you. That takes you off the grid some!

> [!idea] Virtual cards provide minor protection against persecution via bank statements
> If the government later demands that e.g. Bank of America give the names of everyone who donated to the Democrats in the last year, then even if the bank complies, your name won't be on the list. _However_, the government could still get the information from Privacy.com. For more anonymity, use cash or prepaid debit cards purchased using cash.
>

## Opt out of financial institution data sharing

Subtitle: Time: 15 minutes.

[These companies share tons of your data as well.](https://www.denverpost.com/2019/08/31/credit-card-privacy-concerns/) By law, they have to let you opt out.

- [ ] Minimize data sharing via your:
  - [ ] Bank(s).
  - [ ] Credit card(s).
  - [ ] Other instruments.

## Consider deleting PayPal

Subtitle: Time: 30 minutes plus a few more hours depending on how much you use PayPal.

[PayPal just got hacked and 16 million customers had their _passwords_ leaked, meaning PayPal wasn't following even the most basic security precautions.](https://www.tomsguide.com/computing/online-security/over-16-million-hit-with-paypal-data-breach-what-to-do-right-now) To add ad to insecurity, in 2025, PayPal started sharing your data with a _lot_ of companies:

![[https://assets.turntrout.com/static/images/posts/privacy-20251019145510.avif|A Sankey diagram titled "How does PayPal share your data?" shows five categories like "Commercial Partnerships" on the left. Lines flow from these categories to an overwhelmingly large list of dozens of third-party companies on the right, illustrating the vast scale of PayPal's user data sharing.]]
Figure: [Fewer than half of the companies PayPal shares your data with](https://rebecca-ricks.com/paypal-data/).

I recommend deleting your PayPal.

- [ ] Download a PDF of your current year's statements.
- [ ] Download your data under "Data & privacy".
- [ ] [Delete your PayPal](https://www.paypal.com/myaccount/privacy/data/deletion).

If you want to keep your PayPal, at least mitigate by opting out of their data sharing:  

- [ ] [Opt out of data sharing.](https://www.paypal.com/myaccount/privacy/settings/recommendations)

## Minimize sharing your data with LLMs

Minimize or avoid putting private information into cloud-based LLMs. Once you upload your data, assume it may be used for training or even [available on the Internet Archive](https://breached.company/the-ai-privacy-crisis-over-130-000-llm-conversations-exposed-on-archive-org/). But if you have a sensitive topic to get off your chest, what else can you do?

### Apple's private cloud compute framework

The [framework](https://security.apple.com/blog/private-cloud-compute/) promises significantly more privacy than standard inference. If you have an Apple computer, consider using after maxing out the privacy settings.

### Run an LLM on your local machine

Subtitle: For the technically inclined.

As of October 2025, I'm using [`ollama`](https://github.com/ollama/ollama) to run Qwen3-8B on my MacBook Pro M3 (36GB RAM). I use [OpenWebUI](https://github.com/open-webui/open-webui) as a frontend. I set the model and OpenWebUI to run at system startup so that I can query my local model whenever I please. The information I type never leaves my machine except through the model's internet interactions. Peace of mind!

However, the obvious downside is that Qwen3-8B is much less smart than the latest Gemini model. I can't exactly get a high-quality research report from poor little Qwen!

Eventually I'll likely be able to run a local model on my MacBook Pro but with the abilities of Gemini 2.5 Pro. At that point, frontier models will be even more capable, and perhaps I'll miss some other perk instead. That brings me to another stopgap solution I've devised.

### `opensuperwhisper` runs local speech-to-text on Mac

This [open source application](https://github.com/Starmel/OpenSuperWhisper) works on MacBook Pro M1 and later. Just run `brew install opensuperwhisper` and then open it from the Applications folder.

### Regularly delete your chat history for frontier models

OpenAI and Google offer the ability to turn off chat history (with limited-time retention for safety purposes). For Anthropic's Claude, you have to enable "incognito chat" before each session.

I use Gemini the most. If I trust Google to delete data promptly (and I do), then at any point in time where the government comes knocking, my chat history will be mostly empty. As with any company, I'd still be vulnerable to online chat monitoring compelled by the government.

> [!question]- Technical question: Why can't LLM conversations be E2EE?
> This brings us to a set of techniques under the umbrella of [_fully homomorphic encryption_](https://en.wikipedia.org/wiki/Homomorphic_encryption) (FHE). If you homomorphically encrypt your data, then the model can "digest" that data and spit out (encrypted) answers --  without being able to decode what your data mean.
>
> Several issues arise. First, as of October 2025, no one knows how to run models on FHE data without significant slowdowns. Second, FHE makes LLM tool calls difficult and LLM web searches impossible. Third, if the leading model providers did this, they wouldn't have visibility into potential misuse of their models.

## Track TODOs with Lunatask

Subtitle: Time: 30 minutes.

> [!warning] Lunatask is not open source
> The initial version of the post claimed the app was open source. I'm leaving the recommendation here while I look for an open source alternative.

I used to track my tasks with Todoist, but I never felt fully comfortable. I transferred to [Lunatask](https://lunatask.app/), which is E2EE. Lunatask is also just a better app in my opinion. It prioritizes tasks for you (no more juggling self-imposed due dates), maintains personal/work separation by not showing "work" tasks while in the "personal" zone, and easily slots tasks into your schedule (just drag and drop).

![[https://assets.turntrout.com/static/images/posts/privacy-20251014133029.avif|The Lunatask view of tasks for this post, with a calendar view on the side.]]

Figure: Sadly, the calendar integration can't add new tasks to your main calendar as you schedule them in Lunatask.

- [ ] Migrate to [Lunatask](https://lunatask.app/).

# Advance your mobile and travel security in 1 hour

## The Tor browser can provide true anonymity

Subtitle: Time: 5 minutes.

After following the first guide, you already have [a good browser](/privacy-despite-authoritarianism#browse-the-web-using-brave) and [a reliable VPN](/privacy-despite-authoritarianism#proton-vpn-stops-your-internet-service-provider-isp-from-spying-on-you). However, as mentioned earlier, the VPN provider can theoretically see who you are _and_ what you're doing. While Proton claims to keep no logs (and verified that via independent audit), some activities (like transmitting secure documents to reporters to whistleblow on government abuse) are so risky that you don't even want to trust Proton. In this kind of situation, use the [Tor](https://www.torproject.org/) web browser. Basically, the browser connects you to websites in a way that stops any one server from knowing both who you are and what you're doing --- not even Proton will know!

- [ ] Install the official Tor browser.

> [!warning]
>
> 1. Tor connections look much more suspicious than VPN connections. [Connect to a VPN before connecting to Tor.](https://www.privacyguides.org/en/advanced/tor-overview/) While the authorities can't necessarily tell _which_ site you're connecting to, they _can_ tell you're connecting to Tor unless you use a VPN at the same time.
>     1. [ ] If VPNs are banned and you don't want to get caught using Tor, you need to enable the `obsf4` bridge. Go to `about:preferences#connection` and tap "select a built-in bridge" and then choose `obsf4`.
> 2. Never configure the Tor Browser's `about:config` or install extensions. That'll make you easier to "fingerprint" and [separate you from the herd.](https://www.privacyguides.org/en/tor/#tor-browser)
> 3. When you open Tor, its window will have a certain size. Don't modify this size or maximize the window—believe it or not, that can help deanonymize you!

## Browse your favorite websites privately

Subtitle: Time: 10 minutes.

Even if you're using [a VPN](/privacy-despite-authoritarianism#proton-vpn-stops-your-internet-service-provider-isp-from-spying-on-you) to hide your traffic with [Brave](/privacy-despite-authoritarianism#browse-the-web-using-brave) stopping tracking, the website still knows what you're doing since you're logged in. However, if you consume content using a different "frontend" (kinda like a viewport), you can still get the benefits with much lower privacy cost. For example, browsing [XCancel](https://xcancel.com/) instead of X:

![[https://assets.turntrout.com/static/images/posts/privacy-20251023183015.avif|A screenshot of XCancel, a private front-end for X, displaying posts about machine learning. ]]

The downside is you usually can't interact with the site. You can usually just lurk. These sites can also be unreliable, so be ready to ask the extension to redirect you to the original site.

- [ ] Install the [LibRedirect](https://libredirect.github.io/index.html) extension, which automatically redirects you to an open source frontend which respects your privacy.
- [ ] In the settings, enable redirects for your favorite sites; you may need to mess with the defaults.
- [ ] On mobile, you can install

If you want to browse the original site again, you can disable the extension or select the option "only redirect in incognito mode."

## Surreptitious "beacons" track your every movement

Subtitle: Time: 20 minutes.

<!-- vale Custom.OxfordComma = NO -->

> [!quote] [In Stores, Secret Surveillance Tracks Your Every Move](https://www.nytimes.com/interactive/2019/06/14/opinion/bluetooth-wireless-tracking-privacy.html)
> ![[https://assets.turntrout.com/static/images/posts/privacy-20251014232546.avif|An isometric diagram of a grocery store aisle illustrates how beacons track shoppers. An annotation points to a beacon on a shelf, explaining: "The beacons are like little lighthouses that emit one-way messages to nearby devices." A close-up of a phone shows an app icon highlighted.]]
>
> Most people aren’t aware they are being watched with beacons, but the “beacosystem” tracks millions of people every day. Beacons are placed at [airports](https://www.post-gazette.com/business/tech-news/2018/04/19/CMU-inks-deal-to-help-create-smartest-airport-on-the-planet-allegheny-technology/stories/201804190126), [malls](https://www.bluetooth.com/bluetooth-resources?video=moa), [subways](https://www.citylab.com/life/2015/06/how-to-get-your-bearings-when-exiting-a-subway-station/395966/), [buses](https://www.nfcworld.com/2016/10/11/347767/proxama-to-create-uks-biggest-ble-beacon-advertising-network/), [taxis](https://www.mobileeurope.co.uk/press-wire/proxama-aims-for-ubiquitous-ble-coverage-with-uk-taxi-deal), [sporting arenas](https://adage.com/article/datadriven-marketing/location-trackers-bigger-sports-arenas/305211/), [gyms](https://www.ymcalouisville.org/healthy-living/health-well-being-fitness/humana-vitality.html), [hotels](https://www.mobilemarketer.com/ex/mobilemarketer/cms/news/software-technology/23565.html), [hospitals](https://unacast.s3.amazonaws.com/7a7f44d764d14917aed62e80039cb688.pdf), [music festivals](https://kontakt.io/blog/beacons-at-music-festivals/), [cinemas](https://geomarketing.com/beacons-at-the-movies-screenvision-and-mobiquity-networks-add-proximity-marketing-to-cinema-network) and [museums](https://www.rfidjournal.com/news/asian-art-museum-enhances-visitor-experience-with-ble-beacons/70523/), and even on [billboards](https://www.fastcompany.com/3033242/these-new-billboards-talk-to-your-smartphone).
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

<!-- vale Custom.OxfordComma = YES -->

### Disable location tracking on Android

The following steps stop your phone from being passively detected by Bluetooth beacons and otherwise minimize your information footprint.

1. **Turn off the Timeline**. Google creates a minute-by-minute "Timeline" of where you've been.
    1. [ ] Go to `Settings > Google > Manage your Google Account > Data & privacy`. Under "History settings," tap "Location History" and select "Turn off."
    2. [ ] Delete your history as well.
2. **Turn off "Web & App Activity".** Even with Location History off, Google will still save your location every time you, for example, search for a place in Google Maps or check the weather. This "activity" is saved along with your location.
    1. [ ] Visit the same "Data & privacy menu" as above. Tap "Web & App Activity." Turn it off.
    2. [ ] Uncheck any box that says "Include Chrome history and activity from sites, apps, and devices that use Google services."
3. **Disable location services.** For example, when Bluetooth scanning is enabled (even with Bluetooth "off"), [Android phones report lists of nearby beacons any time an app refreshes location services](https://qz.com/1169760/phone-data).
    1. [ ] Search for "Bluetooth scanning" or "Improve accuracy" in your settings and disable it. This setting does not affect your ability to use the actual Bluetooth feature. You may notice a minor decrease in location accuracy.
    2. [ ] Search for "Wi-Fi Scanning" and disable it.
    3. [ ] Search for "Location Accuracy" and disable it.

If you're switching to [GrapheneOS (which you hopefully are)](#switch-to-grapheneos), use its granular per-app network and sensor permissions to prevent apps from accessing Bluetooth unnecessarily. Conservative permission settings should  totally stop your phone from passively responding to nearby beacons, since those wait for responses from shady apps.

### Minimize the uptime of your Bluetooth radio

If data companies have the information, so can the government. Obviously, the most privacy-boosting remedy is turning Bluetooth _off_, cold-turkey -- but I don't want to forsake my AirPods in my day-to-day life. Here's what to do instead.

GrapheneOS instructions
: GrapheneOS includes a "Bluetooth timeout" feature that automatically disables Bluetooth after a period of inactivity. Enable in `Settings > Network & internet > Bluetooth > Bluetooth timeout`.

iOS instructions
: On my MacBook, I only use Bluetooth for two reasons: listening to audio and using a wireless game controller. So I made simple automations in the Shortcuts app: `IF $APP opened, THEN turn on Bluetooth` (and have it notify you when it runs). Now, Bluetooth should be turned off when I don't need it.

  ![[https://assets.turntrout.com/static/images/posts/privacy-20251022120554.avif|iOS Shortcuts which turn on Bluetooth when Tidal or Steam is opened, and turns off Bluetooth when one is closed.]]

: Similarly, make simple automations which encompass your use cases.

Android instructions
: If you have a Samsung phone, you can use the Modes and Routines feature. In that case, follow the iOS instructions using that feature. Otherwise, you can't automate this due to Android's restrictions on third-party applications modifying the state of the Bluetooth radio. So... yeah. I don't have another thing for you to do besides "turn it off when you aren't using it".

## Only carry smart devices when you need them

I have an [Oura ring](https://ouraring.com/) but I don't particularly trust them. Their offerings are proprietary, closed source, and not E2EE. They require cloud analysis of my health data. At the same time, I want to track my sleep health.

I used to wear my Oura everywhere. But I realized I only need to wear my Oura while sleeping, meaning the ring doesn't even need to leave my home. I put on the ring at night and take it off in the morning. While Oura can still decrypt and read my sleep data, I find the tradeoff worth it for the sleep information. I decreased my daily "digital signature" by carrying one fewer device.

## Minimize "centralized" notifications

Subtitle: Time: 10 minutes.

For most mainstream applications, the government can see exactly what notifications you get, when, and what app the notification is for. This information amounts to a detailed picture of what you're doing, when, and maybe even who you're talking to.

> [!quote] [A letter from Senator Wyden to former Attorney General Garland](https://www.wyden.senate.gov/imo/media/doc/wyden_smartphone_push_notification_surveillance_letter.pdf)
> \[Push notifications\] aren't sent directly from the app provider to users’ smartphones. Instead, they pass through a kind of digital post office run by the phone's operating system provider. For iPhones, this service is provided by Apple's Push Notification Service; for Android phones, it's Google's Firebase Cloud Messaging.
>
> These services ensure timely and efficient delivery of notifications, but this also means that Apple and Google serve as intermediaries in the transmission process. As with all of the other information these companies store for or about their users, because Apple and Google deliver push notification data, they can be secretly compelled by governments to hand over this information.

- [ ] Audit which apps have notifications enabled. Disable notifications for _every single app which doesn't have to provide critical, real-time alerts_. Each notification you prevent is one less metadatum logged on a server you don't control. Reducing notifications also [promotes peace of mind](/digital-minimalism).

Note that [Signal](https://www.reddit.com/r/signal/comments/g217a6/what_can_google_glean_from_signal_using_fcmgcm/) only uses Google's notification system to say "hey check the Signal servers for the real notification". [Proton notifications are E2EE](https://proton.me/blog/android-client-security-model/) so the government would only see "the user got a Proton Mail notification."

## iOS: Disable AirDrop

> [!quote] [The Protesters' Guide to Smartphone Security](https://www.privacyguides.org/articles/2025/01/23/activists-guide-securing-your-smartphone/)
> One of the most innocuous features enabled on millions of iPhones is also one of the most dangerous for those seeking to protect their privacy in public. Apple's AirDrop protocol [uses](https://www.usenix.org/system/files/sec21-heinrich.pdf) trivially bypassed security measures that authorities like the Chinese government have openly [bragged](https://arstechnica.com/security/2024/01/hackers-can-id-unique-apple-airdrop-users-chinese-authorities-claim-to-do-just-that/) about cracking to identify users since at least 2022.
>
> You should assume that any device with AirDrop enabled is constantly broadcasting your name, email address, and phone number to everyone around you, _even if_ you have it set to "Contacts Only." Apple has known about this [flaw](https://www.macrumors.com/2021/04/23/airdrop-researchers-security-flaw/) since 2019 and has not issued any fix.
>

- [ ] `Settings -> General -> AirDrop -> "Receiving Off"`.

## Disable 2G to avoid "stingray" attacks

Stingray attacks use a machine which pretends to be a fake "cell tower" with super strong signal. Your phone switches to the "cell tower" because the signal seems stronger. Then the machine tricks your phone into downgrading to a 2G connection. At that point, criminals and/or police make your phone basically admit who you are. They do this to everyone within half a kilometer.

> [!quote] [How ICE Is Using Fake Cell Towers To Spy On People’s Phones](https://www.forbes.com/sites/the-wiretap/2025/09/09/how-ice-is-using-fake-cell-towers-to-spy-on-peoples-phones/)
> Despite having been [criticized by civil rights groups](https://www.aclu.org/news/privacy-technology/ice-using-powerful-stingray-surveillance-devices) for using Stingrays during the last Trump administration, ICE continues to use the technology. Earlier this year, new media publication [Straight Arrow News](https://san.com/cc/exclusive-evidence-of-cell-phone-surveillance-detected-at-anti-ice-protest/) said it had analysed “mobile network anomalies” around a Washington state protest against ICE raids that were consistent with Stingray use.
>
> Forbes found contract records showing ICE purchased nearly $1 million worth of “cell site simulator vehicles” in May this year, indicating it’s taking the surveillance tool fully mobile. That was part of a contract first signed under the Biden administration in 2024.

Stingrays can pick up metadata from plain old texts and calls. Avoid by [using Signal](/privacy-despite-authoritarianism#use-signal-over-facebook-messenger-whatsapp-texting-or-phone-calls) -- it's E2EE, so they would just be "intercepting" nonsense ciphertext. I think the only way to avoid being located at all is to enable airplane mode or to even use a Faraday cage to shield your phone from all radio signals.

GrapheneOS
: GrapheneOS has more comprehensive protections than just disabling 2G. But you should also do that.

  - [ ] Enable "2G network protection" -- just search "2G" in settings.

Android
: You can just disable 2G in your settings (search "2G"). The 2G speed sucks anyways and that protocol is basically out of use in the USA at this point. (Just remember, if you later end up without coverage in a remote location, you can try reenabling 2G.)

  - [ ] Disable 2G.

iOS
: You're less lucky. You can enable [lockdown mode](https://support.apple.com/en-us/105120) to disable 2G connections, but that mode also will break convenient everyday applications. Unless you expect to be under targeted scrutiny (e.g. at a protest if protests become criminalized), you probably shouldn't turn that mode on. Sadly, as of October 2025, Apple has yet to provide a standalone 2G toggle.

> [!info]- Tracking stingray usage
> In 2024, we gained a tool to potentially track these devices.   For \$20 to buy the hardware and for a dash of technical expertise, you can help collect data on nearby law enforcement stingray usage. You can read about [some conclusions the EFF drew one year later.](https://www.eff.org/deeplinks/2025/09/rayhunter-what-we-have-found-so-far)

## Be prepared at border checkpoints

In the USA, my understanding is that [the DHS cannot compel an American citizen to unlock a password-locked device](https://reason.com/2025/04/04/what-to-do-if-border-police-ask-to-search-your-phone/?nab=0).  If you say "no", however, they might keep your device for a while and try to crack it on their own. If you're not a citizen, the rules are different. You should read more elsewhere.

However, if the "lock" is not a password but merely a biometric, the legal waters seem darker. Therefore, I recommend turning off your devices before the checkpoint, which should force password entry on next unlock and prevent your phone's information from being pried out as easily. Alternatively, modern phones also enable this if you hold down the screen-power and volume-up buttons.

- [ ] On Android, you might have to enable "lockdown mode" as an option. Make sure it's enabled if necessary.

> [!warning] "Duress" PINs put you in serious legal danger
> On GrapheneOS, you can set a special "duress" PIN. If you unlock the device using the duress PIN, you instantly wipe the entire device and it shuts down. [Wiping your device is highly suspicious](https://discuss.grapheneos.org/d/22035-threat-model-help-needed-travelling-through-customs/7) and might get you jailed for destruction of evidence. You might still enable the duress PIN for other reasons, like if you're getting mugged and want to ensure your information doesn't get stolen along with your phone.

## US government watches immigrant speech on social media

Assume that all social media activity is monitored by [ICE's Homeland Security Investigations teams, who maintain dedicated personnel for social media surveillance](https://www.wired.com/story/ice-social-media-surveillance-24-7-contract/).

> [!quote] [EFF to Department Homeland Security: No Social Media Surveillance of Immigrants](https://www.eff.org/deeplinks/2025/06/eff-department-homeland-security-no-social-media-surveillance-immigrants)
> EFF submitted comments to the Department of Homeland Security (DHS) and its subcomponent U.S. Citizenship and Immigration Services (USCIS), urging them to abandon a proposal to collect social media identifiers on forms for immigration benefits. This collection would mark yet a further expansion of the government’s efforts to subject immigrants to social media surveillance, invading their privacy and chilling their free speech and associational rights for fear of being denied key immigration benefits.
>
 > Specifically, the proposed rule would require applicants to disclose their social media identifiers on nine immigration forms, including applications for permanent residency and naturalization, impacting more than 3.5 million people annually. USCIS’s purported reason for this collection is to assist with identity verification, as well as vetting and national security screening, to comply with Executive Order 14161. USCIS separately announced that it would look for “antisemitic activity” on social media as grounds for denying immigration benefits, which appears to be related to the proposed rule, although not expressly included it.
>
> Additionally, a day after the proposed rule was published, Axios reported that the State Department, the Department of Justice, and DHS confirmed a joint collaboration called “Catch and Revoke,” using AI tools to review student visa holders’ social media accounts for speech related to “pro-Hamas” sentiment or “antisemitic activity.”

Not much you can do besides being [pseudonymous](#be-pseudonymous-when-possible). Be as brave as you can be in your situation. Try not to give in to the chilling effect-- I recommend that US citizens not give a damn.

## Track belongings using AirTags instead of Tiles

[Tile devices allegedly don't encrypt your location data, meaning criminals and law enforcement could intercept the data and watch your Tiles move around the map as they please.](https://www.wired.com/story/tile-tracking-tags-can-be-exploited-by-tech-savvy-stalkers-researchers-say/) AirTags are E2EE, keeping your location data private. After reading that article, I immediately tossed all my Tiles and bought six AirTags.

## Disable Wi-Fi calling

Wi-Fi calling is considered to be telephone data (through your carrier) and so isn't protected by your VPN. Phones which connect to Wi-Fi calling will let your carrier track your precise location -- not just the rough region you're in, as usually guessed from your cell tower data.

## Avoid distinctive device names

Subtitle: Time: 5 minutes.

If my AirPods are called "TurnTrout's AirPods", then anyone who scans for Bluetooth knows that TurnTrout is nearby. I don't need to be leaking that information, so I made my device names generic: "MacBook Pro", "AirPods", and so on.  True, generic names make it slightly harder to figure out which device to connect to, but the cost is small  -- just connect in a less ambiguous environment.

![[https://assets.turntrout.com/static/images/posts/privacy-20251013161427.avif|A screenshot of the macOS "About" settings. The device's name is set to the generic "MacBook Pro".]]
Figure: My laptop's generic name.

- [ ] Rename your devices to have generic names.

As a reminder, your Bluetooth devices and other broadcastable names may include other smart devices:

  1. Laptop
  2. Phone
  3. Watch
  4. Oura ring
  5. Wireless headphones
  6. Smart speaker
  7. Mobile hotspot

Other tips:

 1. Turn off specialized devices when not using them. For example, a smart speaker.  
 2. Disconnect from unknown Bluetooth devices.
 3. Putting on some music in your friend's car? Give it minimal permissions --- don't let it suck up your entire contacts list.

# Medium-term strategic shifts

## Keep emergency cash reserves

The US government may engage in financial warfare against its critics. [Stephen Miller](https://www.thebulwark.com/p/its-stephen-millers-show-now-charlie-kirk-assassination-trump-leftists-retribution) threatened retaliation against Americans who exercised their free speech rights. He warned that "radical leftists" (seemingly meaning: those who strongly and publicly disagree with the Trump administration) will have trouble accessing their money:

> [!quote] [Stephen Miller, White House Deputy Chief of Staff for Policy](https://www.commondreams.org/news/stephen-miller-dismantle-the-left)
> The power of law enforcement, under President Trump’s leadership, will be used to find you, will be used to take away your money, take away your power, and, if you’ve broken the law, to take away your freedom.

Before we reach that point, I recommend you immediately:

- [ ] Purchase [a fireproof and waterproof safe](https://www.amazon.com/SentrySafe-Resistant-Chest-Cubic-1160/dp/B008NHKWZU/ref=sr_1_9?sr=8-9) to keep in your home,
- [ ] Withdraw up to \$2,000 in cash and store it in the safe, and
- [ ] Ensure your passport is current and ready for international travel. Probably store it in the safe as well.

## Tech workers can push for privacy improvements

Securing even one of these timely improvements would be a _significant win for protecting privacy and freedom across the world._ I've drafted suggestions which shouldn't conflict with core business models.

> [!idea]- Readers who work at Apple
>
> By order of importance:
>
> 1. **Enable the "Always-on VPN" toggle for consumers**, not just enterprise users. Make the default setting "yes." [Current iOS policy directly feeds metadata into ISPs](/privacy-despite-authoritarianism#vpns-are-fundamentally-unreliable-on-ios-macos-as-of-december-2025), exposing millions of unaware users to tracking and potential political persecution.
> 2. **Make ADP the default setting where legally permissible.**
> 3. **Tighten the Wi-Fi Positioning Systems** to [no longer (theoretically) enable mass surveillance and privacy invasion](https://www.cs.umd.edu/~dml/papers/wifi-surveillance-sp24.pdf):
>    1. Stop returning the locations of up to 400 unrequested nearby BSSIDs with every successful query. Just return the inferred location of the queried BSSID. This feature allowed the researchers to discover 172 times more BSSIDs than they could by guessing.
>    2. Implement a per-device and per-account rate limit that is sufficient for legitimate location lookups but too low for mass data harvesting.
>    3. Require queries to be tied to an authenticated Apple ID to allow Apple to ban abusive users.
>    4. Follow Google's model of requiring an API key and charging a small fee for queries. The cost of a global scan would be "prohibitively expensive for all but powerful adversaries."
> 4. **Add a toggle to [disable the 2G radio](#disable-2g-to-avoid-stingray-attacks)** without having to enter lockdown mode. Safeguard user privacy by _defaulting_ to e.g. "2G off (except emergency calls)". It doesn't make sense to be in the middle of strong 5G service but _still_ be open to 2G (and thus to stingrays).
> 5. **Fix [the AirDrop vulnerability](#ios-disable-airdrop) originally reported in 2019**. Security researchers have even developed a secure open source solution: ["PrivateDrop."](https://privatedrop.github.io/)

> [!idea]- Readers who work at Meta
> 6. Migrate WhatsApp from E2EE to zero-knowledge encryption to protect metadata. If not, more clearly warn users that their metadata are not E2EE.
> 7. Encrypt WhatsApp backups by default (prompting the user to make an authentication key). Many users are unaware that their backups are unencrypted.
> 8. Extend (zero-knowledge) E2EE to Instagram conversations.
> 9. Extend (zero-knowledge) E2EE group chats in Messenger.

> [!idea]- Readers who work at other tech firms
> Focus on changes with minimal technical burden or conflict with core company incentives. Start with easy wins like default settings changes. Those require no new engineering but affect the large set of users who never change settings.

## Gradually transition workplaces from Slack to Element

Slack is not E2EE. The government can read those messages if it seized the servers. The Trump regime's intimidation tactics _will_ chill discussion of e.g. AI policy, especially among non-US citizens. Lots of people I know fit that description. Foreseeable censorship and state-driven retaliation will probably put them at serious risk.

Create a space where people can speak freely without fear of government surveillance. [Element](https://element.io/) is an open-source, E2EE communication platform built on the [Matrix protocol](https://matrix.org/). Unlike Slack, Element encrypts messages, calls, and file transfers end-to-end. Even if the hosting servers are compromised, your conversations remain private. Unlike Slack, you have the option of self-hosting your data. While Slack tries to keep you in their ecosystem, the Matrix protocol is decentralized and federated, providing easy future migration and interoperability.

Element offers [a migration wizard](https://element.io/blog/slack-migration/) to directly migrate users and content. Furthermore, the [Slack to Matrix migration tool](https://github.com/Awesome-Technologies/slack-matrix-migration) can import even more data, including DMs and private channels.

> [!info]- Migration details and timeline
>
> | **Data type**                 | **Migration support**    | **Notes**                        |
> | ------------------------: | :------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | Public channels       | ✅           | The Migration Wizard migrates complete Slack Workspace including all users, public channels, messages and files                      |
> | Files     | ✅           | Files shared in public channels are included in migration                                                                                                              |
> | Users                 | ✅          | Users can be transitioned en masse with automatically generated email addresses and passwords                                         |
> | Channel structure     | ✅           | Element's Slack Migration Wizard recreates Slack channels as Element rooms                                                                                             |
> | Message threads       | ✅           | Conversation threads within public channels are preserved                                                                                                              |
> | Private channels      | ❓ | Requires Slack to Matrix tool and Slack Enterprise Grid export with private channels included                                     |
> | Direct messages | ❓  | Requires Slack to Matrix tool and requires Business+ or Enterprise Grid export; won't work on DMs with Slack Connect accounts  |
> | Group DMs            | ❓ |  Requires Slack to Matrix tool and Enterprise Grid export                                                                         |
> | Apps & integrations     | ❌     | Custom apps and integrations must be reconfigured in Element                                                                                                           |
> | Custom emoji          | ❌     | Custom workspace emoji are not migrated                                                                                                                                |
> | Workspace settings    | ❌      | Settings, preferences, and customizations must be set up fresh                                                                                                         |
> | User permissions      | ⚠️            | Users are auto-joined to migrated channels, but permission structures may need reconfiguration                                                                         |
>
> To retain the benefits of Slack Connect, you can keep those Slack channels open while [interacting with those channels using Element.](https://ems-docs.element.io/books/element-cloud-documentation/page/public-slack-bridge)
>
> ### Example migration timeframe
>
> #### Phase 1: establish parallel infrastructure (weeks 1-2)
>
> - [ ] Set up an Element workspace for your team or organization.
> - [ ] Choose between [Element Cloud](https://element.io/pricing) (easiest, \$5-10/user/month) or self-hosted Matrix server (free but requires technical expertise).
> - [ ] Create equivalent channels/rooms for sensitive discussions.
> - [ ] Invite a small pilot group.
>
> #### Phase 2: gradual adoption (weeks 3-8)
>
> - [ ] Start moving sensitive conversations to Element:
>   - Policy discussions that could be politically risky.
>   - Organizing around workplace issues.
>   - Any communication with non-US citizens about political topics.
>
> #### Phase 3: expand usage (months 2-6)
>
> - [ ] Create bridges between platforms if needed for the transition period.
> - [ ] Gradually move more conversations to Element.
> - [ ] Establish Element as the default for any sensitive topics.
> - [ ] Import from Slack and have your users move over for essential business, keeping Slack available as a backup.
>
> #### Phase 4: full transition (optional)
>
> - [ ] Evaluate whether full migration makes sense for your organization.
> - [ ] For maximum security, fully deprecate Slack and delete message history.
> - [ ] Or maintain dual platforms with clear boundaries, like "Slack is now read-only."

## Gradually migrate your social network away from X

<video autoplay loop muted playsinline class="float-right"><source src="https://assets.turntrout.com/static/images/posts/privacy-20251020185659.mp4" type="video/mp4; codecs=hvc1"><source src="https://assets.turntrout.com/static/images/posts/privacy-20251020185659.webm" type="video/webm"></video>

The cup runneth over with reasons to leave X. There's always [Elon Musk's repeated "heil Hitler" salutes from back in January 2025](https://en.wikipedia.org/wiki/Elon_Musk_salute_controversy), or his [illegally](https://federalnewsnetwork.com/reorganization/2025/02/usaid-takeover-is-unconstitutional-lawmakers-say/) cutting USAID and [thereby dooming a projected 26 million people by 2040](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5199076), but even [the platform itself learns to hook into your brain and keep you stressed and scrolling](/digital-minimalism).  This platform has done horrible things to world discourse and maybe it's done horrible things to you, too. Most relevant, though, is the censorship which Elon inflicts upon X. Although I don't use X regularly, I plan to migrate my account to places with stronger technical defenses against centralized censorship.

The catch: if you leave X, you leave your followers and connections behind by default - although you can export your interaction data. To reconnect with your X followers on the alternative platform Bluesky, you would need to find each follower's Bluesky handle on your own (or vice versa, for your followers finding you). In other words: We love our friends more than we hate these platforms, so we stay stuck.[^attrib]

[^attrib]: I read a similar sentence during my research but cannot remember where. Sorry for the lack of attribution!

Later, [I propose](#x-migration-plan) a two-month migration during which you cross-post major updates to multiple platforms. You'll build a following and hopefully bring over some of your friends as well. Admittedly, this isn't so much about privacy as about building censorship-resistant infrastructure.

### Bluesky: better but still subject to central censorship (for now)

> [!quote] [Government censorship comes to Bluesky, but not its third-party apps … yet](https://techcrunch.com/2025/04/23/government-censorship-comes-to-bluesky-but-not-its-third-party-apps-yet/)
> Bluesky restricted access to 72 accounts in Turkey at the request of Turkish governmental authorities, according to a [recent report](https://stockholmcf.org/bluesky-restricts-access-to-72-accounts-in-turkey-amid-government-pressure/) by the [Freedom of Expression Association](https://ifade.org.tr/engelliweb/bluesky-bircok-hesabi-turkiyeden-gorunmez-kildi/). As a result, people in Turkey can no longer see these accounts, and their reach is limited.
>
> The report indicates that 59 Bluesky accounts were blocked on the grounds of protecting “national security and public order.” Bluesky also made another 13 accounts and at least one post invisible from Turkey.
>
> Given that many Turkish users migrated from X to Bluesky in the hopes of fleeing government censorship, Bluesky’s bowing to the Turkish government’s demands has [raised questions](https://www.reddit.com/r/europe/comments/1k1xy30/bluesky_restricts_access_to_72_accounts_in_turkey/) [among the community](https://www.reddit.com/r/BlueskySocial/comments/1k03iop/bluesky_restricts_accounts_at_the_request_of_the/) as to whether the social network is as open and decentralized as it claims to be. (Or whether [it’s “just like Twitter”](https://www.reddit.com/r/BlueskySocial/comments/1k0hrt0/bluesky_is_banning_accounts_that_are_posting/) after all.)

### The pitch for Mastodon

Mastodon's structure is resilient against censorship. Mastodon can't "chicken out" like Bluesky seems to have done because Mastodon operates on a _federated_ model. The "Fediverse" is a collection of interlinked servers which use a shared protocol. The servers can interoperate seamlessly. Users can easily port their data from one server to another. Censorship becomes hard -- more like "whack a mole" with a million moles, where the moles may be using _quite_ sophisticated VPNs. :)

![[https://assets.turntrout.com/static/images/posts/advanced-privacy-20251025204759.avif|On the left, a centralized network is shown as a single central orb with lines radiating outwards. On the right, a federated network is depicted as a web of interconnected, unique orbs resembling planets and stars, with no single center.]]
Figure: A _centralized_ network on the left versus a _federated_ network on the right. The federated network is robust to the censorship of individual servers. Users can export their data and migrate to a new server.

![[https://assets.turntrout.com/static/images/posts/privacy-20251015092239.avif|Three user testimonials for Mastodon. First: "I'm personally addicted to Mastodon... I've got one profile for sharing art, another one for casual conversation and another one for politics," from @guedes@mastodon.social. Second: "I've made so many friends on Mastodon because I can actually talk to people instead of getting buried by algorithms that reward meaningless numbers over actual interaction," from @trwnh@mastodon.social. Third: "Mastodon does an amazing job at giving communities the autonomy necessary to thrive by giving them the keys to federate and moderate their own servers... it simply does features that the major social networks try to do (e.g. image captioning, content warnings) astoundingly better," from @jenn@pixel.kitchen.]]

Sadly, Mastodon isn't too popular, boasting [only 750,000 active users sprinkled across dozens of major servers in October 2025.](https://mastodon-analytics.com/) In contrast, Bluesky houses 4.1 million daily users. X stacks up about 260 million. In particular, Bluesky has [a more vibrant AI research scene](https://bsky.app/starter-pack/chris.bsky.social/3lbefurb2xh2u) -- many of my readers care about this.

I still made a Mastodon and will try cross-posting using Buffer. You can follow me at `@turntrout` on [`mastodon.social`](https://mastodon.social/@turntrout) (that's the main server). To get started yourself, check out [this guide](https://docpop.org/2025/02/how-to-get-started-with-mastodon).

Mastodon kinda sucks because of low engagement. Bluesky has expected future suckage because of censorship potential. I guess the play is to just make accounts on both and hope that one of them takes off?

### None of these platforms have reliable E2EE messaging

Pessimistically assume that every interaction on X (including ["encrypted"](https://techcrunch.com/2025/09/05/x-is-now-offering-me-end-to-end-encrypted-chat-you-probably-shouldnt-trust-it-yet/) DMs) may be read by the company and the government.

> [!warning] E2EE and social media
> Neither Bluesky nor Mastodon offers or has announced plans for E2EE. The platforms' decentralized nature makes E2EE technically challenging. Assume that anything you post or DM can be read by platform administrators and potentially compelled by governments. For private conversations, continue using Signal.

### X migration plan

1. [ ] Set up new accounts on Bluesky and/or Mastodon.
2. [ ] Pin an announcement with your new handles to your X profile.
3. [ ] DM your closest contacts directly - don't rely on them seeing your post.
4. [ ] For the next 2 months, cross-post across all platforms using [the Buffer tool](https://buffer.com/).
5. [ ] Engage actively on your new platform to build momentum.
6. [ ] Set a sunset date for X and stick to it.
7. [ ] Export your data from X.
    - [ ] [Request to download your data](https://x.com/settings/download_your_data).
    - [ ] Download the data when ready.
10. [ ] Resist the urge to check X "just in case." Consider deleting your account outright.

# What next?

I'm scared by what's happening to the country I love. I don't have a full gameplan. But what I do know is this: these precautions make us stronger. They make us think better by freely communicating information which the regime might wish to suppress. They make us feel better by reducing the risk of persecution, putting us at ease. Most importantly, these precautions help us work together. By securing our infrastructure, we enable acts of kindness and bravery.

We'll need a lot of both in the coming years.

> [!thanks]
> Garrett Baker and Joshua Turner gave feedback on drafts of these posts. [`fx`](https://www.lesswrong.com/posts/BPyieRshykmrdY36A/an-opinionated-guide-to-privacy-despite-authoritarianism?commentId=x6Nuo4hc9tGFsgECw), [`Rana Dexsin`](https://www.lesswrong.com/posts/BPyieRshykmrdY36A/an-opinionated-guide-to-privacy-despite-authoritarianism?commentId=NYcaBcBPa4bsBenQ4), [`StartAtTheEnd`](https://www.lesswrong.com/posts/BPyieRshykmrdY36A/an-opinionated-guide-to-privacy-despite-authoritarianism?commentId=ypwCPaxrfkA5Tmg7u), and [`jbash`](https://www.lesswrong.com/posts/BPyieRshykmrdY36A/an-opinionated-guide-to-privacy-despite-authoritarianism?commentId=hRXL9LhwKovtLpDTr) provided comments which improved the posts. [`FedWSGOS`](https://discuss.privacyguides.net/t/an-opinionated-guide-to-privacy-despite-authoritarianism/34362/4) recommended [the 2FA service list.](https://2fa.directory/int/?q=u2f#backup)

# Appendix: Precautions which didn't make the cut for the main article

## Automated license plate readers: can't do anything about them

The government tracks your car movements with exquisite attention. They use Automated License Plate Readers (ALPRs) to track _all_ drivers -- not just "the bad guys". Unfortunately, there are no publicly known passive countermeasures to these devices, and such countermeasures are illegal in the US anyways. It's hard to travel the USA without the government knowing.

The remedy is to support data retention limits, restrict inter-agency sharing, demand transparency, organize community opposition, and support organizations like the [Electronic Frontier Foundation](https://www.eff.org/) and the [American Civil Liberties Union](https://www.aclu.org/) which legally challenge this surveillance system. For a privacy-respecting jurisdiction, look no further than New Hampshire: [ALPR data must be deleted within 180 seconds unless the data match against an active person of interest.](https://gc.nh.gov/rsa/html/XXI/261/261-75-b.htm)

![[https://assets.turntrout.com/static/images/posts/privacy-20251018230933.avif|A map from deflock.me showing the locations of known Automated License Plate Readers in California and Nevada. Colored circles indicate numerous camera clusters, with high concentrations in major cities like Los Angeles and the San Francisco Bay Area, and along highways.]]

Figure: Map of known ALPRs provided by [`deflock.me`](https://www.deflock.me/).

> [!warning] [Even your tire pressure sensors aid surveillance](https://redlib.catsarch.com/r/privacy/comments/1pzwnuv/best_modern_car_companies_in_terms_of_privacy_do/nwu315l/?context=3#nwu315l)
>
> The Bluetooth hardware in your Ford has a unique, permanent MAC address that is used for hands free calling and audio streaming. This address is almost always static and doesn't change because your phone relies on that specific ID to "recognize" the car and auto connect every time you get in.
>
> Many departments of transportation install Bluetooth "sniffers" at intersections and along highways to track vehicles. They deploy a small, ruggedized computer (often a brand like BlueTOAD or Iteris) and mount them on a traffic signal pole or highway sign. It has a high gain antenna that scans for Bluetooth and wifi mac addresses within a range of about 300 feet. As you drive by sensor A, it logs your vehicle's unique Bluetooth mac address and a precise timestamp. When you drive by sensor B (perhaps two miles down the road), that sensor also logs your mac address and timestamp. Measuring the time and number of devices seen at a time helps them measure real-time congestion.
>
> Even if you disabled wifi and Bluetooth, each of the four tires has a sensor with a unique 8 character hexadecimal code (like `A1B2C3D4`). This ID allows the car's computer to know which tire is which, ensuring that if your "front left" tire is low, the dashboard correctly identifies it. It then broadcasts its unique ID, pressure, and temperature roughly every 60 seconds in the 300MHz band. The car companies know what sensor ids came with your vehicle. To my knowledge, there's no publicly documented commercial receiver that understands all TPMS protocols and bands. But because Ford's TPMS signals are unencrypted and unauthenticated, anyone with a relatively inexpensive Software Defined Radio and a laptop can intercept the signal from 40 to 120 feet away with a standard antenna. Less chatty pings, but you still are identifiable.
>
> Even if you say fuck it and disable TPMS, many tire manufacturers embed RFID right in the tire now for inventory and like Bluetooth/wifi/TPMS all is tied to your VIN. So even your old classic <= 90s car will need tires again eventually. ​Tire techs can use handheld scanners, walk past your car with a wand and scan all four tires in seconds from about 3-10 feet away. Systems like Michelin quick scan use pads on the ground (often found at truck stops or fleet depots). As you drive over them, the system reads the RFID tags and measures tread depth simultaneously. Commercial "gate" readers can pick up these IDs at speeds up to 20-30 mph from a distance of about 25 feet. Right now, there is no "city-wide" grid of RFID tire readers like there is for Bluetooth. The hardware is currently too expensive and the range too short for highway speed government tracking, but it certainly could start to appear at toll roads or regular gas stations.

## Ensure true E2EE for incremental backups

Cloud backups survive house fires, but many cloud services can decrypt your data. I used to use [Backblaze](https://www.backblaze.com/cloud-backup/personal)'s backup client but then realized that they briefly store the encryption key on their own devices. Meaning I have to tell them how to decrypt my data!

iCloud (with ADP) doesn't work because I want complete incremental backup of all the files on my computer in order to protect against losing work if something happens to my system. Therefore, the backup software should be scanning my entire home directory (with exceptions), and also make it easy for me to restore files.

I instead started using [Duplicati](https://duplicati.com/) to send encrypted backup data to [Backblaze B2 storage](https://www.backblaze.com/cloud-storage) on an hourly basis. I start the server on startup and it automatically backs everything up. If you want, you can [download my configuration template](https://assets.turntrout.com/duplicati.json).

I also have local Time Machine backups on an external hard drive. These backups are also encrypted, so  if an adversary grabbed my drive, they wouldn't be able to read my data. As usual, I store the encryption keys in my Bitwarden.

## Protect against geo-guessing

Even [without metadata,](/privacy-despite-authoritarianism#your-pictures-and-videos-contain-your-gps-location) your photo still might be "geo-guessed." In the game ["GeoGuessr"](https://www.geoguessr.com/), people compete to guess the location of a Google Street View photograph (with the ability to explore nearby using the Street View). [Radu, the 2025 world champion, can sometimes guess obscure road locations with 200-meter precision.](https://www.youtube.com/watch?v=-IumRw8Z-XI)  Recently, [`geospy.ai`](https://geospy.ai/) entered the marketplace to power law enforcement. Humans and AI are far more likely to fail locating a patch of forest, but likely to succeed at picking up on subtle cues in urban and rural environments.

If you share a photo but don't want to share your location... Assume that's not possible, unless you're an expert.

## Buy webcam covers

Subtitle: Cost: $10. Low-priority.

I purchased [two webcam covers for my laptops.](https://www.amazon.com/dp/B079MCPJGH?ref=ppx_yo2ov_dt_b_fed_asin_title)[^covers] Even if a hacker compromises webcam and also the "your video is on" light, I still never expose my video feed when I don't expect to. However, this attack is rather rare. Probably this defense just makes you feel better. I just figured I might as well cover the possibility.

[^covers]: If you purchase a cover for your laptop, be sure to not obstruct its ambient light sensor. Shine a bright light on the webcam to check.
