---
layout: post
title: Why native development sucks and HTML5 rocks: porting
date: 2012-08-10
---


Lately, HTML5 mobile app development has received 
[a lot](http://blog.mobtest.com/2012/05/heres-why-the-facebook-ios-app-is-so-bad-uiwebviews-and-no-nitro/) 
of [bashing](http://www.wooga.com/2012/06/woogas-html5-adventure/) all over the 
[Internet](http://www.bgr.com/2012/07/25/html5-native-apps-ios-android/). Most 
developers only quickly skim over the benefits and proceed to bash all the 
downsides. The conclusions they usually arrive at: HTML5 slow, inconsistent, 
limited and doesn't have a native look and feel. Therefore, native development 
is superior.

I'm not going to go point by point to defend or debunk these claims today. 
Instead, I'd like to give an example of the benefits of HTML5.

Here at CreationPal, we make [SportyPal](http://sportypal.com/) - a reasonably 
popular mobile app that tracks your workouts. Its a native non-trivial app 
implemented for multiple platforms, so we do have some experience with native
technologies.

When we were discussing our new product [DoxOut](http://doxout.com/), we 
concluded that the best way to go is to use HTML5. As a result of this decision,
it didn't take much time to port our 
[prototype presentation app](http://docucalc.com/app/present-main.html) to the 
new Windows 8 UI (formerly codenamed Metro)

The time needed: **1 hour**.

How is that possible?

To improve experience, we have a thin native layer for each platform. If a component of the layer is not available, a default HTML5 replacement is provided that works well enough in most browsers. The rest of the code and UI is pure HTML5.

The new Windows 8 UI is all about HTML5, CSS and JavaScript. An application has the same structure as a webpage, with a main html file. What is different is that there are extra "native" libraries available in the global JavaScript namespace which you can use to access native functionality. As a result, it was simply a matter of pointing the app to the relevant HTML, CSS and JavaScript.

Well, not quite.

We quickly got the following error:

> JavaScript runtime error: Unable to add dynamic content. A script attempted 
> to inject dynamic content, or elements previously modified dynamically, that 
> might be unsafe. For example, using the innerHTML property to add script or 
> malformed HTML will generate this exception. Use the toStaticHTML method to 
> filter dynamic content, or explicitly create elements and attributes with a 
> method such as createElement.  For more information, see 
> [http://go.microsoft.com/fwlink/?LinkID=247104](http://go.microsoft.com/fwlink/?LinkID=247104).

The new Windows 8 UI has a strict html security model. Directly inserting potentially-unsafe HTML is not allowed, and since we are using a jQuery-based micro-templating library that does exactly that, we quickly ran into the error.

This was the offending line in the jQuery code

    // ... snip ...
    append: function () {
        return this.domManip(arguments, true, function (elem) {
            if (this.nodeType === 1) {
                this.appendChild(elem);
            }
        });
    },
    // ... snip ...


We learned quickly that a potential solution is to wrap unsafe execution using `MSApp.execUnsafeLocalFunction` :


    append: function () {
        return this.domManip(arguments, true, function (elem) {
            if (this.nodeType === 1) {
                var self = this;
                // In Metro, execUnsafeLocalFunction is needed to
                // append a child which contains arbitrary innerHTML
                if (window["MSApp"]) MSApp.execUnsafeLocalFunction(function () {
                    self.appendChild(elem);
                });
                else this.appendChild(elem);
            }
        });
    },

As this circumvents protection for all `jQuery.fn.html calls`,  its not an ideal solution. However the alternative involves giving up features such as data-attributes which was unacceptable.

The only remaining modification was to add the Microsoft-specific CSS properties (such as `-ms-linear-gradient`) to our LESS mixin classes and `$.fn.css` calls

Note: jQuery 1.8 makes the last practice obsolete: the newest $.fn.css automatically transforms the property to a browser-specific version, if needed.

After this modification the entire codebase worked flawlessly.

Now imagine the time it would take to port a native app to a new platform.

Despite all the negative reputation, HTML5 remains the fastest way to develop multi-platform apps. The quick porting of our DoxOut Presentation prototype is to Windows 8 confirms that (though not exactly a fair example as Metro is already heavily HTML5-based),  And with efforts such as [AppJS](http://appjs.org/), the number of OSes that support mixed HTML5-native development keeps growing.

Switch to HTML5, today!

