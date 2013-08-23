---
title: Closures are unavoidable in node
date: 2013-08-23
layout: post
---

A couple of weeks ago I wrote a [giant comparison of node.js async code 
patterns](/posts/analysis-generators-and-other-async-patterns-node.html) that 
mostly focuses on the new generators feature in EcmaScript 6 (Harmony)

Among other implementations there were two callback versions: [original.js], 
which contains nested callbacks, and [flattened.js], which flattens the nesting a
little bit. Both make extensive use of JavaScript closures: every time
the benchmarked function is invoked, a lot of closures are created.

Then [Trevor Norris wrote](http://blog.trevnorris.com/2013/08/long-live-callbacks.html)
that we should be avoiding closures when writing performance-sensitive code,
hinting that my benchmark may be an example of "doing it wrong"

I decided to try and write two more flattened variants. The idea is to 
minimize performance loss and memory usage by avoiding the creation of closures.

You can see the code here: 
**[flattened-class.js] and [flattened-noclosure.js](//github.com/spion/async-compare/blob/master/examples/flattened-noclosure.js)**

Of course, this made complexity skyrocket. Lets see what it did for performance.

Results are for 50 000 parallel invocations of the upload function, with 
simulated I/O operations that always take 1ms. Note: suspend is currently the 
fastest generator based library

| file                     | time(ms) | memory(MB) |
|:-------------------------|---------:|-----------:|
| [flattened-class.js]     |     1398 |     106.58 |
| [flattened.js]           |     1453 |     110.19 |
| [flattened-noclosure.js] |     1574 |     102.28 |
| [original.js]            |     1749 |     124.96 |
| [suspend.js]             |     2701 |     144.66 |


No performance gains. Why?

Because this kind of code requires that results from previous callbacks are 
passed to the next callback. 

Unfortunately, in node this means creating closures. There is no other option. 

Node core functions only take callback functions. If we want to pass context 
with that callback function, we *have* to create a closure. And yeah, `bind`
is also a closure:

    function bind(fn, ctx) {
        return function bound() {
            return fn.apply(ctx, arguments);
        }
    }

Notice how `bound` is a closure over ctx and fn. You can't avoid it if you
want to pass context together with the function.

Now, if the low-level core API was also able to take a context argument, things 
could have been different. For example, instead of writing:

    fs.readFile(f, bind(this.afterFileRead, this));

if we were able to write:
    
    fs.readFile(f, this.afterFileRead, this);

then we would be able to write code that avoids closures and 
[flattened-class.js] could have been much faster. 

But we can't do that.

What if we could though? 

Since my fake I/O functions use `setTimeout`, I decided to take 
[timers.js](https://github.com/joyent/node/blob/master/lib/timers.js) from node 
core and add context passing support to the `Timeout` class. The result was 
[timers-ctx.js](//github.com/spion/async-compare/blob/master/lib/timers-ctx.js) 
which in turn resulted with [flattened-class-ctx.js]

And here is how it performs:

| file                     | time(ms) | memory(MB) |
|:-------------------------|---------:|-----------:|
| [flattened-class-ctx.js] |      736 |      58.11 |
| [flattened-class.js]     |     1062 |      84.72 |
| [flattened.js]           |     1148 |      88.00 |
| [original.js]            |     1426 |     104.66 |
| [suspend.js]             |     2157 |     139.97 |

Yeah. That shaved off a couple of 100s of miliseconds more. 

Is it worth it?

| name                     | tokens | complexity |
|:-------------------------|-------:|-----------:|
| [suspend.js]             |    331 |       1.10 |
| [original.js]            |    425 |       1.41 |
| [flattened.js]           |    477 |       1.58 |
| [flattened-class-ctx.js] |    674 |       2.23 |

Maybe, maybe not. You decide.

[suspend.js]: //github.com/spion/async-compare/blob/master/examples/suspend.js
[original.js]: //github.com/spion/async-compare/blob/master/examples/original.js
[flattened.js]: //github.com/spion/async-compare/blob/master/examples/flattened.js
[flattened-class.js]: //github.com/spion/async-compare/blob/master/examples/flattened-class.js
[flattened-noclosure.js]: //github.com/spion/async-compare/blob/master/examples/flattened-noclosure.js
[flattened-class-ctx.js]: //github.com/spion/async-compare/blob/master/examples/flattened-class-ctx.js
