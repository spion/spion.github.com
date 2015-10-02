---
layout: post
title: Google Docs on the iPad
description: Believe it or not, its quite possible to make them work.
date: 2012-12-13
---

<iframe allowfullscreen="allowfullscreen" frameborder="0" height="360"
    src="http://www.youtube.com/embed/3fmfbAJcfKY" width="640"></iframe>

This is Appser for Google Docs. It allows you to run the full, web version of Google Docs on the iPad. And by that we mean all of it, even editing presentations (a feature which was recently completely disabled on the iPad by Google)

And its available on the app store, right now, for free.
[Get Appser for Google Docs](https://itunes.apple.com/us/app/appser-for-google-docs/id577825348?ls=1&mt=8).

At this point you're probably thinking: Wait, isn't this horribly problematic?
Google Docs isn't optimized for touch input at all - neither the code nor the UI
elements. Selecting text is weird. Scrolling is incompatible with dragging to
select text or to move stuff. Those image boxes have really tiny resizers. The
toolbar buttons and menus are not big enough. What about right click?

Is it actually usable?

Also, can I just connect a bigger monitor, some kind of a touchpad and a
keyboard and forget about touch input?

The answer to all questions is yes.


## Scroll vs drag and text selection

When Apple first designed the iPhone, it had a 3.5 inch screen with a resolution
of 480x320 pixels. While this was quite a lot compared to other phones of the
time, it was not even near desktop and laptop displays. Yet it had a browser
that provided an experience as close to desktop as possible. How did they
achieve this?

They made scrolling and zooming really easy. This meant that the user was able
to quickly zoom to compensate for the lacking resolution, then quickly pan to
show more on the limited screen real-estate. And so, web browsing was very
usable even on the first iPhone.

Fast forward to today, on the iPad, we have a 10 inch retina-resolution
display... and the same zoom and pan control.

Why?

Do we really need this? Its very problematic for web apps. They like to assume
that drag and drop works. They want to display a static chrome around a
scrolling document, so they also like to assume that overflow: scroll works.

As a result, we decided to make scrolling work by disabling single-finger
scrolling. Instead we made single-finger actions behave exactly like mouse
actions do in the browser and switched to two-finger scrolling, making it work
everywhere. This enables you to quickly select text and drag things around.

We also disabled zoom - web apps usually have their own document zooming
facilities and the iPad screen has plenty of resolution and size.

## What about tiny buttons and controls?

This is where things got interesting. We knew that even though we enabled drag and drop, the controls were too tiny for touch use. To overcome this we developed a method called Magnet Touch. It automatically enlarges all touch targets. The enlargement is not visual so it simply makes smaller targets easier to hit. Its also smart - it tries very hard to avoid overlap with other targets. Best of all, you don't have to tell it anything about the targets - not even which elements are targets.

## And right click?

Long taps are the equivalent of right clicks. At the moment they trigger when you release the finger.

## What happens when I connect an external screen?

Your iPad becomes a keyboard + touchpad combo and you get a mouse pointer on the screen. Neat huh? If you prefer a physical Bluetooth keyboard you can of course connect one at any time.

There are some limitations when editing text fields (like the username and password on the login screen) - they must be shown on the iPad temporarily while editing. We're working on that.

## Conclusion

What, you're still reading this? [Download the app and try it out](https://itunes.apple.com/us/app/appser-for-google-docs/id577825348?ls=1&mt=8). We'd also [love to hear from you](http://appser.docucalc.com/support). You can also [visit the official Appser website](http://appser.docucalc.com/), if you'd like to find out more.

