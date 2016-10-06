---
layout: post
title: JavaScript doesn't suck
date: 2016-10-06
hidden: true
---


The last few days, I've been thinking about what leads so many people to hate JavaScript.

JS is so quirky and unclean! Thats supposed to be the primary reason, but after working with a few other dynamic languages, I don't buy it. JS actually has a fairly small amount of quirks compared to other dynamic languages.

Just think about PHP's named functions, which are always in the global scope. Except when they are in namespaces (oh hi another concept), and then its kinda weird because namespaces are relative. There are no first class named functions, but function expressions can be assigned to variables. Which must be prefixed with `$`. There are no real modules, or proper nestable scope - at least not for functions, which are always global. But nested functions only exist once the outer function is called!

In ruby, blocks are like lambdas except when they are not, and you can pass a block explicitly or yield to the first block implicitly. But there are also lambdas, which are different. Modules are again uselessly global, and cannot be parameterised over other modules (without resorting to meta programming). Oh yeah they are also another syntactical and semantical concept. Why not just `Module.new`? And there are classes, with private variables, which are prefixed with `@`. I really don't get that sigil fetish.

The above examples are only scratching the surface.

And what are the most often cited problems of JavaScript? Implicit conversions (the wat talk), no large ints and hard to understand prototypical inheritance and `this` keyword. That doesn't look any worse than the above lists! Plus, the language (pre ES6) is very minimalistic. All it has is: freeform records with prototypes, and closures with lexical scope. Thats it!

So this supposed "quirkiness" of JavaScript doesn't seem like a satisfactory explanation to me. There must be something else, and I think I finally realized what.

JavaScript is seen as a "low status" language. A 10 day accident, a silly toy language for the browser that was supposed to be simple and easy. And indeed it is: there are very few distinct concepts in pre-ES6 JavaScript.

However, those few concepts combine together in a language with a really good power-to-weight ratio. Additionally, its simplicity ensures that its malleable towards even more power (e.g. you can extend it with a type system and then you can idiomatically approximate some capabilities of algebraic sum types, like [making illegal states unrepresentable](https://goo.gl/IkiZqx)).

But more importantly, this sort of extension is somehow normal in JavaScript. If you took Ruby and used its metaprogramming facilities to add a comparable feature, it has significantly lower likelyhood of being accepted by developers. Why? Because ruby has standard ways to do things. You should be using objects and classes, not hashes, to model most of your data.

That was not the case with the simple pre-ES6 JavaScript. There was no module system to organize code. No classes system to hierarhically organize blueprints that hold state. Lack of basic standard library items, such as maps, sets, iterables, streams, promises. Lack of functions to manipulate existing data structures (dictionaries and arrays).

Combine sufficient power, simplicity/malleability, and the lack of the basic facilities. Add to this the fact that its the basic option in the browser, the most popular platform. What do you get? You get a TON of people working in it to extend it in various different ways. And they invent a TON of stuff!

We ended up with several popular module systems (object based namespaces, CommonJS, AMD, ES6, the angular module system, etc) as well as many package managers to manage these modules (npm, bower, jspm, ...). We also got many object/inheritance systems: plain objects, pure prototype extension, simulating classes, ["composable object factories"][stampit], and so on and so forth. Heck, a while ago every other library used to implement its own object system! <small>(That is, until CoffeeScript came and gave the definite answer on how to implement classes on top of prototypes. This is interesting, and I'll come back to it later.)</small>

This creates dissonance with the language's simplicity. Users are thinking: "JS is this simple browser language that was supposed to be easy, so why is it so hard now? Why are there so many things built on top of it and how the heck do I choose which one to use? I hate it. Why do I hate it? Probably its all these silly quirks that it has! Just look at its implicit conversions and lack of number types other than doubles!"

It doesn't matter that many languages are much worse. A great example of the reverse phenomenon is C++. Its a [complete abomination][fqa], much worse than JavaScript - a Frankenstein in the languages domain. But its seen as "high status", so it has many apologists that will come to defend its broken design: "Yeah, C++ is a serious language, you need grown-up pants to use it". Unfortunately JS has no such luck: its status as a hack-together glue for the web pages seems to have been forever cemented in people's heads.

So how do we fix all this? You might not realize it, but this is already being fixed as we speak! Remember how CoffeeScript slowed down the prolification of custom object systems? Browsers and environments are quickly implementing ES6, which standardizes a huge percentage of what used to be the JS wild west. We now have the standard way to do modules, the standard way to do classes, the standard way to do basic procedural async (Promises; async/await). The standard way to do bundling will probably be no-bundling: [HTTP2 push + ES6 modules will "just work"][http2push]!

Finally, I believe the people who think that JavaScript will always be transpiled are wrong. As ES6+ features get implemented in major browsers, more and more people will find the overhead of ES.Next to ES transpilers isn't worth it. This process will stop entirely at some point as the basics get fully covered.

At this point, I'm hoping several things will happen. We'll finally get those big integers and number types that Brendan Eich has been promising. We'll have some more stuff on top of [SharedArrayBuffer][shared] to enable easier shared memory parallelism, perhaps even [immutable datastructures][immutable] that are [transferable objects][transferable]. The wat talk will be obsolete: obviously, you'd be using a static analysis tool such as [Flow](https://flowtype.org/) or TypeScript to deal with that; the fact that the browser ignores those type annotations and does its best to interpret what you meant will be irrelevant. async/await will be implemented in all browsers as the de-facto way to do async control flow; perhaps even [async iterators][aiterator] too. We'll also have widly accepted standard libraries for [data](https://github.com/whatwg/streams) and [event] streams.

I wonder, will JavaScript will finally gain the status it deserves then? It probably will. But at what cost? Future JavaScript will probably be big enough that there will be less space for new inventions. And its fun to invent new things and read about other people's inventions!

On the other hand, maybe then we'll be able to focus on the stuff we're actually building instead.

[shared]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
[transferable]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#Passing_data_by_transferring_ownership_(transferable_objects)
[immutable]: https://facebook.github.io/immutable-js/

[aiterator]: https://github.com/tc39/proposal-async-iteration
[http2push]: https://esdiscuss.org/topic/fwd-are-es6-modules-in-browsers-going-to-get-loaded-level-by-level#content-4

[fqa]: http://yosefk.com/c++fqa/
[stampit]: https://github.com/stampit-org/stampit