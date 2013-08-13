---
hidden: false
title: Analysis of generators and other async patterns in node
layout: post
date: 2013-08-09
---

Table of contents:

- [A gentle introduction to generators](#a-gentle-introduction-to-generators)
- [The analysis](#the-analysis)
- [Complexity](#complexity)
- [Performance (time and memory)](#performance-time-and-memory)
- [Debuggability](#debuggability)
    - [Source maps support](#source-maps-support)
    - [Stack trace accuracy](#stack-trace-accuracy)
- [Conclusion](#conclusion)

      
Async coding patterns are the subject of never-ending debates for us node.js 
developers. Everyone has their own favorite method or pet library as well as
strong feelings and opinions on all the other methods and libraries. Debates
can be heated: sometimes social pariahs may be declared or grave rolling 
may be induced.

The reason for this is that JavaScript in node never had any continuation 
mechanism to allow code to pause and resume across the event loop boundary. 

Until now.

<a name="a-gentle-introduction-to-generators"></a>

### A gentle introduction to generators

<small>If you know how generators work, you can <a href="#skip">skip this</a>
    and continue to the analysis</small>

Generators are a new feature of ES6. Normally they would be used for iteration.
Here is a generator that generates Fibonacci numbers. The example is taken from
the [ECMAScript harmony wiki](http://wiki.ecmascript.org/doku.php?id=harmony:generators)

```js
function* fibonacci() {
    let [prev, curr] = [0, 1];
    for (;;) {
        [prev, curr] = [curr, prev + curr];
        yield curr;
    }
}
```

And here is how we iterate through this generator:

```js
for (n of fibonacci()) {
    // truncate the sequence at 1000
    if (n > 1000) break;
    console.log(n);
}
```

What happens behind the scene? 

Generator functions are actually constructors of iterators. The returned 
iterator object has a `next()` method. We can invoke that method manually:

```js
var seq = fibonacci();
console.log(seq.next()); // 1
console.log(seq.next()); // 2 etc.
```

When `next` is invoked, it starts the execution of the generator. The generator 
runs until it encounters a `yield` expression. Then it pauses and the execution
goes back to the code that called `next`

If that code calls `next` again, the generator resumes from the point where 
it left off. In this case, the generator will resume to the top of the endless 
`for` loop and calculate the next Fibonacci pair.

So how would we use this to write async code? 

A great thing about the `next()` method is that it can also send values to the 
generator. Let's write a simple number generator that also collects the stuff it 
receives and never does anything with them.

```js
function* numbers() {
    var stuffIgot = [];
    for (var k = 0; k < 10; ++k) {        
        var itemReceived = yield k;
        stuffIgot.push(itemReceived);
    }
}
```

Let's give things to this generator:

```js
var iterator = numbers();
// Cant give anything the first time: need to get to a yield first.
console.log(iterator.next()); // 1
console.log(iterator.next('present')); // 2
fs.readFile('file.txt', function(err, resultFromAnAsyncTask) {
    console.log(iterator.next(resultFromAnAsyncTask)); // 3
});
```

Uh-oh.

Seems that we can keep the generator paused across the event loop boundary. 

What if instead of numbers, we yielded some files to be read?

```js
function* files() {
    var results = [];
    for (var k = 0; k < files.length; ++k) 
        results.push(yield files[k]);
    return results;
}
```

We could process those file reading tasks asynchronously:

```js
var iterator = files();
function process(iterator, sendValue) {
    var fileTask = iterator.next(sendValue);
    fs.readFile(fileTask, function(err, res) {
        if (err) iterator.throw(err);
        else process(iterator, res);
    });
}
process(iterator);
```

So there is also `generator.throw()`. It causes an exception to be thrown
from inside the generator. How cool is that?

With `next` and `throw` combined together, we can easily run async code. Here 
is an example from one of the earliest ES6 async generators library 
[task.js](http://taskjs.org/). 

```js
spawn(function*() {
    var data = yield $.ajax(url);
    $('#result').html(data);
    var status = $('#status').html('Download complete.');
    yield status.fadeIn().promise();
    yield sleep(2000);
    status.fadeOut();
});
```

This generator yields promises, which causes it to suspend execution. The `spawn` 
function that runs the generator takes those promises and waits until they're 
fulfilled. Then it resumes the generator by sending it the resulting value.

When used in this form, generators look a lot like classical threads. You spawn 
a thread, it issues blocking I/O calls using `yield`, then the code resumes 
execution from the point it left off.

There is one very important difference though. While threads can be suspended
involuntarily at any point by the operating systems, generators have to 
willingly suspend themselves using `yield`. This means that there is no danger 
of variables changing under our feet, except after a `yield`.

Generators go a step further with this: it's impossible to suspend execution
without using the `yield` keyword. In fact, if you want to call another 
generator you will have to write `yield* anotherGenerator(args)`. This means 
that suspend points are always visible in the code, just like they are when 
using callbacks.

Amazing stuff! So what does this mean? What is the reduction of code complexity? 
What are the performance characteristics of code using generators? Is debugging 
easy? What about environments that don't have ES6 support?

I decided to do a big comparison of all existing node async code patterns and
find the answers to these questions. 

<a name="skip"></a><a name="the-analysis"></a>

### The analysis

For the analysis, I took `file.upload`, a typical CRUD method extracted from  
[DoxBee](http://doxbee.com) called when uploading files. It executes multiple 
queries to the database: a couple of selects, some inserts and one update. 
Lots of mixed sync / async action.

It looks like this: 

```
function upload(stream, idOrPath, tag, done) {
    var blob = blobManager.create(account);
    var tx = db.begin();
    function backoff(err) {
        tx.rollback();
        return done(new Error(err));
    }
    blob.put(stream, function (err, blobId) {
        if (err) return done(err);
        self.byUuidOrPath(idOrPath).get(function (err, file) {
            if (err) return done(err);
            var previousId = file ? file.version : null;
            var version = {
                userAccountId: userAccount.id,
                date: new Date(),
                blobId: blobId,
                creatorId: userAccount.id,
                previousId: previousId
            };
            version.id = Version.createHash(version);
            Version.insert(version).execWithin(tx, function (err) {
                if (err) return backoff(err);
                if (!file) {
                    var splitPath = idOrPath.split('/');
                    var fileName = splitPath[splitPath.length - 1];
                    var newId = uuid.v1();
                    self.createQuery(idOrPath, {
                        id: newId,
                        userAccountId: userAccount.id,
                        name: fileName,
                        version: version.id
                    }, function (err, q) {
                        if (err) return backoff(err);
                        q.execWithin(tx, function (err) {
                            afterFileExists(err, newId);
                        });

                    })
                }
                else return afterFileExists(null, file.id);
            });
            function afterFileExists(err, fileId) {
                if (err) return backoff(err);
                FileVersion.insert({fileId: fileId,versionId: version.id})
                    .execWithin(tx, function (err) {
                        if (err) return backoff(err);
                        File.whereUpdate({id: fileId}, {
                            version: version.id
                        }).execWithin(tx, function (err) {
                            if (err) return backoff(err);
                            tx.commit(done);
                        });
                })
            }
        });
    });
}
```

Slightly pyramidal code full of callbacks.

This is how it looks like when written with generators:

```
var genny = require('genny');
module.exports = genny.fn(function* upload(resume, stream, idOrPath, tag) {
    var blob = blobManager.create(account);
    var tx = db.begin();
    try {
        var blobId = yield blob.put(stream, resume()); 
        var file = yield self.byUuidOrPath(idOrPath).get(resume()); 
        var previousId = file ? file.version : null;
        var version = {
            userAccountId: userAccount.id,
            blobId: blobId,
            creatorId: userAccount.id,
            previousId: previousId
        };
        version.id = Version.createHash(version);
        yield Version.insert(version).execWithin(tx, resume());
        if (!file) {
            var splitPath = idOrPath.split('/');
            var fileName = splitPath[splitPath.length - 1];
            var newId = uuid.v1();
            var file = {
                id: newId,
                userAccountId: userAccount.id,
                name: fileName,
                version: version.id
            }
            var q = yield self.createQuery(idOrPath, file, resume());
            yield q.execWithin(tx, resume());
        }
        yield FileVersion.insert({fileId: file.id, versionId: version.id})
            .execWithin(tx, resume());
        yield File.whereUpdate({id: file.id}, {version: version.id})
            .execWithin(tx, resume()); 
        yield tx.commit(resume());
    } catch (e) {
        tx.rollback();
        throw e; 
    }
});
```

Shorter, very straight-forward code and absolutely no nesting of callback
functions. Awesome.

Yet subjective adjectives are not very convincing. I want to have a measure of 
complexity, a number that tells me what I'm actually saving. 

I also want to know what the performance characteristics are - how much time
and memory would it take to execute a thousand of parallel invocations of this 
method? What about 2000 or 3000?

Also, what happens if an exception is thrown? Do I get a complete stack trace 
like in the original version?

I also wanted to compare the results with other alternatives, such as fibers,
streamlinejs and promises (without generators).

So I wrote a lot of different versions of this method, and I will share my 
personal impressions before giving you the results of the analysis

**[original.js](//github.com/spion/async-compare/blob/master/examples/original.js)**

The original solution, presented above. Vanilla callbacks. Slightly pyramidal. 
I consider it acceptable, if a bit mediocre.

**[flattened.js](//github.com/spion/async-compare/blob/master/examples/flattened.js)**

Flattened variant of the original via named functions. Taking the advice from
[callback hell](http://callbackhell.com/), I flattened the pyramid a little 
bit. As I did that, I found that while the pyramid shrunk, the code actually 
grew.

**[catcher.js](//github.com/spion/async-compare/blob/master/examples/catcher.js)**

I noticed that the first two vanilla solutions had a lot of common error 
handling code everywhere. So I wrote a tiny library called catcher.js which 
works very much like node's `domain.intercept`. This reduced the complexity
and the number of lines further, but the pyramidal looks remained.

**[promises.js](//github.com/spion/async-compare/blob/master/examples/promises.js)**

I'll be honest. I've never written promise code in node before. Driven by 
[Gozalla's excellent post](//jeditoolkit.com/2012/04/26/code-logic-not-mechanics.html#post)
I concluded that everything should be a promise, and things that can't handle 
promises should also be rewritten. 

Take for example this particular line in the original:

```js
var previousId = file ? file.version : null;
```

If file is a promise, we can't use the ternary operator or the property 
getter. Instead we need to write two helpers: a ternary operator helper and a 
property getter helper:

```js
var previousIdP = p.ternary(fileP, p.get(fileP, 'version'), null);
```

Unfortunately this gets out of hand quickly:

```
var versionP = p.allObject({
    userAccountId: userAccount.id,
    blobId: blobIdP,
    creatorId: userAccount.id,
    previousId: previousIdP,
    ...
});
versionP = p.set(versionP, p.allObject({
    id: fn.call(Version.createHash, versionP)
}));
// Even if Version.insert has been lifted to take promise arguments, it returns 
// a promise and therefore we cannot call execWithinP. We have to wait for the
// promise  to resolve to invoke the function.
var versionInsert = p.eventuallyCall(
    Version.insert(versionP), 'execWithinP', tx);
var versionIdP = p.get(versionP, 'id');
```

So I decided to write a less aggressive version, `promiseish.js`

note: I used [when](//github.com/cujojs/when) because i liked its function 
lifting API better than Q's


**[promiseish.js](//github.com/spion/async-compare/blob/master/examples/promises.js) 
and [promiseishQ.js](//github.com/spion/async-compare/blob/master/examples/promises.js)**

Nothing fancy here, just some `.then()` chaining. In fact it feels less complex
than the `promise.js` version, where I felt like I was trying to fight the
language all the time.

The second file `promiseishQ.js` uses [Q](//github.com/kriskowal/q) instead of 
[when](//github.com/cujojs/when).

**[co.js](//github.com/spion/async-compare/blob/master/examples/co.js) 
and [gens.js](//github.com/spion/async-compare/blob/master/examples/gens.js)**

[Gens](//github.com/Raynos/gens) and [co](//github.com/visionmedia/co) are 
generator-based libraries. Both can work by yielding thunk-style functions: 
that is, functions that take a single argument which is a node style callback 
in the format `function (err, result)`

The problem is, thunks still require wrapping. The recommended way to wrap node 
style functions is to use `co.wrap` for co and `fn.bind` for gens - so thats 
what I did.

**[suspend.js](//github.com/spion/async-compare/blob/master/examples/suspend.js) 
and [genny.js](//github.com/spion/async-compare/blob/master/examples/promises.js)**

genny and suspend are generator-based solutions that can work directly with
node style functions.

Obviously, I'm biased here since I wrote genny. I still think that this is 
objectively the best way to use generators in node. Just replace the callback 
with a placeholder function `resume`, then yield that. Comes back to you with 
the value. 

Kudos to [jmar777](//github.com/jmar777) for realizing that you don't need
to actually yield anything and can resume the generator using the placeholder 
callback instead.

Both [suspend](https://github.com/jmar777/suspend) and 
[genny](http://github.com/spion/genny) use generators roughly the same way. 
The resulting code is very clean, very straightforward and completely devoid of 
callbacks. 

**[fibrous.js](//github.com/spion/async-compare/blob/master/examples/fibrous.js)**

[Fibrous](//github.com/goodeggs/fibrous) is a fibers library that creates 
"sync" methods out of your async ones, which you can then run in a fiber. 

So if for example you had:

```
fs.readFile(file, function(err, data){ ... });
```

Fibrous would generate a version that returns a future, suspends the running
fiber and resumes execution when the value becomes available.

```
var data = fs.sync.readFile(file);
```

I also needed to wrap the entire upload function: 

```
fibrous(function upload() { ... })
```

This felt exactly like the generators version but with `sync` instead of 
`yield` to indicate the methods that will yield. The one benefit I can think 
of is that it feels more natural for chaining - less parenthesis are needed. 

```
somefn.sync(arg).split('/')
// vs
(yield somefn(arg, resume)).split('/')
```

Major drawback: this will never be available outside of node.js or without 
native modules.

Library: [fibrous](//github.com/goodeggs/fibrous)

**[qasync.js](//github.com/spion/async-compare/blob/master/examples/qasync.js)**

Generators with promises. Didn't feel very different than genny or suspend.
Its slightly less complicated: you can yield the promise instead of placing
the provided resume function at every point where a callback is needed. 

Caveat: as always with promises you will need to wrap all callback-based 
functions.

Library: [Q](//github.com/kriskowal/q)


**[streamline.js](//github.com/spion/async-compare/blob/master/examples/src-streamline._js)**

Uses [streamlinejs](http://github.com/Sage/streamlinejs) CPS transformer and
works very much like suspend and genny, except without needing to write yield 
all the time.

Caveat: you will need to compile the file in order to use it. Also, even 
though it looks like valid JavaScript, it isn't JavaScript. Superficially, it 
has the same syntax, but it has very different semantics, particularly when
it comes to the `_` keyword, which acts like `yield` and `resume` combined in 
one.

The code however is really simple and straightforward.

<a name="complexity"></a>

### Complexity

To measure complexity I took the number of tokens in the source code found by
Esprima's lexer (comments excluded). The idea is taken from
[Paul Graham's essay _Succinctness is Power_](http://www.paulgraham.com/power.html)

Results:

| name                | tokens | complexity |
|:--------------------|-------:|-----------:|
| co.js               |    294 |       1.00 |
| src-streamline._js  |    297 |       1.01 |
| fibrous.js          |    312 |       1.06 |
| qasync.js           |    315 |       1.07 |
| suspend.js          |    326 |       1.11 |
| genny.js            |    334 |       1.14 |
| gens.js             |    339 |       1.15 |
| catcher.js          |    387 |       1.32 |
| promiseishQ.js      |    397 |       1.35 |
| promiseish.js       |    410 |       1.39 |
| original.js         |    420 |       1.43 |
| promises.js         |    456 |       1.55 |
| flattened.js        |    472 |       1.61 |



Streamline and co have the lowest complexity. Fibrous, qasync, suspend, genny 
and gens are roughly comparable. 

Catcher is comparable with both promiseish solutions. The complexity when using 
promises is roughly comparable to the original version with callbacks, but 
there is some improvement.

Finally, it seems that going promises-all-the-way or flattening the callback 
pyramid are not worth it. Both only increase the complexity.

<a name="performance-time-and-memory"></a>

### Performance (time and memory)

To be able to execute the files, all external methods are mocked with 
setTimeout to simulate waiting for I/O. 

There are two variables that control the test:

* \\(n\\) - the number of parallel "upload requests"
* \\(t\\) - average wait time per async I/O operation

For the first test, I set the time for every async operation \\(t = 1ms\\) then 
ran every solution for \\(n \\in \lbrace 100,500,1000,1500,2000 \rbrace \\).

note: hover over the legend to highlight the item on the chart.

<div id="perf-time-1" class="plot">
</div>
<script type="text/javascript">

window.perfCPUBound = 
[ { label: 'catcher.js',
    data: 
     [ [ 100, 21 ],
       [ 500, 47 ],
       [ 1000, 74 ],
       [ 1500, 108 ],
       [ 2000, 156 ] ] },
  { label: 'co.js',
    data: 
     [ [ 100, 27 ],
       [ 500, 70 ],
       [ 1000, 172 ],
       [ 1500, 247 ],
       [ 2000, 313 ] ] },
  { label: 'dst-co-traceur.js',
    data: 
     [ [ 100, 29 ],
       [ 500, 146 ],
       [ 1000, 218 ],
       [ 1500, 295 ],
       [ 2000, 405 ] ] },
  { label: 'dst-genny-traceur.js',
    data: 
     [ [ 100, 30 ],
       [ 500, 138 ],
       [ 1000, 243 ],
       [ 1500, 297 ],
       [ 2000, 429 ] ] },
  { label: 'dst-qasync-traceur.js',
    data: 
     [ [ 100, 111 ],
       [ 500, 501 ],
       [ 1000, 1102 ],
       [ 1500, 1698 ],
       [ 2000, 2382 ] ] },
  { label: 'dst-streamline.js',
    data: 
     [ [ 100, 24 ],
       [ 500, 58 ],
       [ 1000, 122 ],
       [ 1500, 174 ],
       [ 2000, 247 ] ] },
  { label: 'dst-suspend-traceur.js',
    data: 
     [ [ 100, 24 ],
       [ 500, 129 ],
       [ 1000, 203 ],
       [ 1500, 333 ],
       [ 2000, 339 ] ] },
  { label: 'flattened.js',
    data: 
     [ [ 100, 20 ],
       [ 500, 43 ],
       [ 1000, 69 ],
       [ 1500, 95 ],
       [ 2000, 145 ] ] },
  { label: 'genny.js',
    data: 
     [ [ 100, 24 ],
       [ 500, 70 ],
       [ 1000, 152 ],
       [ 1500, 229 ],
       [ 2000, 301 ] ] },
  { label: 'gens.js',
    data: 
     [ [ 100, 24 ],
       [ 500, 60 ],
       [ 1000, 130 ],
       [ 1500, 180 ],
       [ 2000, 238 ] ] },
  { label: 'original.js',
    data: 
     [ [ 100, 19 ],
       [ 500, 44 ],
       [ 1000, 70 ],
       [ 1500, 98 ],
       [ 2000, 136 ] ] },
  { label: 'promiseish.js',
    data: 
     [ [ 100, 99 ],
       [ 500, 376 ],
       [ 1000, 999 ],
       [ 1500, 1339 ],
       [ 2000, 1820 ] ] },
  { label: 'promiseishQ.js',
    data: 
     [ [ 100, 105 ],
       [ 500, 504 ],
       [ 1000, 1039 ],
       [ 1500, 1650 ],
       [ 2000, 2214 ] ] },
  { label: 'promises.js',
    data: 
     [ [ 100, 220 ],
       [ 500, 1254 ],
       [ 1000, 2237 ],
       [ 1500, 3343 ],
       [ 2000, 5061 ] ] },
  { label: 'qasync.js',
    data: 
     [ [ 100, 80 ],
       [ 500, 497 ],
       [ 1000, 974 ],
       [ 1500, 1536 ],
       [ 2000, 2079 ] ] },
  { label: 'suspend.js',
    data: 
     [ [ 100, 18 ],
       [ 500, 53 ],
       [ 1000, 115 ],
       [ 1500, 166 ],
       [ 2000, 231 ] ] } ]

  .concat([
  { label: 'dst-streamline-fibers.js',
    data: 
     [ [ 100, 31 ],
       [ 500, 180 ],
       [ 1000, 597 ],
       [ 1500, 1344 ],
       [ 2000, 2507 ] ] },
  { label: 'fibrous.js',
    data: 
     [ [ 100, 98 ],
       [ 500, 537 ],
       [ 1000, 1283 ],
       [ 1500, 2405 ],
       [ 2000, 3917 ] ] }]);

window.addEventListener('load', function() {
    $.plot('#perf-time-1', perfCPUBound, {legend: { position: 'nw' }});
});
</script>

Wow. Promises seem really, really slow. Fibers are also slow, with time 
complexity \\( O(n^2) \\). Everything else seems to be much faster.

Lets try removing all those promises and fibers to see whats down there.

<div id="perf-time-2" class="plot">
</div>
<script type="text/javascript">


window.addEventListener('load', function() {
    $.plot('#perf-time-2', perfCPUBound.filter(function(item) {
        return !/(promise|qasync|fibrous|fiber)/.test(item.label)
    }), {legend: { position: 'nw' }})
});
</script>

Ah, much better. 

The original and flattened solution are the fastest, as they use vanilla 
callbacks. 

It seems like catcher adds a slight overhead, making things just a bit slower.

The generator solution suspend is really fast. It incurred minimal overhead of 
about 50-80% running time. Its also roughly comparable with streamlinejs (when 
in raw callbacks mode).

Next is suspend compiled with 
[Google Traceur](//github.com/google/traceur-compiler/), an ES6 to ES5 compiler
which we need to run generators code without the `--harmony` switch or in 
browsers. Is roughly 2-3 times slower, which is great.

Genny is about 2 times slower. This is because it adds some protection 
guarantees: it makes sure that callback-calling function behaves and calls the 
callback only once and provides a mechanism to enable better stack traces
when errors are encountered.

Gens is in the same ballpark as 

The slowest is co. There is nothing intrinsically slow about it though:
the slowness is mostly caused by `co.wrap`.

Looks great. But isn't this a bit unrealistic?

Most async operations take much longer than 1 millisecond to complete, 
especially when the load is as high as thousands of requests per second.
As a result, performance is I/O bound - why measure things as if it were 
CPU-bound?

So lets increase the average time needed for an async operation to 

$$ t = {n \\over 10} $$

This will make I/O operation time grow together with \\(n\\). Each will
take 10 ms on average when there are 100 running in parallel and 100 ms when 
there are 1000 running in parallel. Makes much more sense.


<div id="perf-time-3" class="plot">
</div>
<script type="text/javascript">
window.perfIOBound = 

[ { label: 'catcher.js',
    data: 
     [ [ 100, 95 ],
       [ 500, 360 ],
       [ 1000, 723 ],
       [ 1500, 1088 ],
       [ 2000, 1509 ] ] },
  { label: 'co.js',
    data: 
     [ [ 100, 107 ],
       [ 500, 446 ],
       [ 1000, 873 ],
       [ 1500, 1313 ],
       [ 2000, 1713 ] ] },
  { label: 'dst-co-traceur.js',
    data: 
     [ [ 100, 111 ],
       [ 500, 497 ],
       [ 1000, 934 ],
       [ 1500, 1330 ],
       [ 2000, 1736 ] ] },
  { label: 'dst-genny-traceur.js',
    data: 
     [ [ 100, 105 ],
       [ 500, 485 ],
       [ 1000, 854 ],
       [ 1500, 1230 ],
       [ 2000, 1659 ] ] },
  { label: 'dst-qasync-traceur.js',
    data: 
     [ [ 100, 111 ],
       [ 500, 484 ],
       [ 1000, 1130 ],
       [ 1500, 1714 ],
       [ 2000, 2395 ] ] },
  { label: 'dst-streamline.js',
    data: 
     [ [ 100, 94 ],
       [ 500, 385 ],
       [ 1000, 755 ],
       [ 1500, 1171 ],
       [ 2000, 1573 ] ] },
  { label: 'dst-suspend-traceur.js',
    data: 
     [ [ 100, 85 ],
       [ 500, 377 ],
       [ 1000, 709 ],
       [ 1500, 1071 ],
       [ 2000, 1399 ] ] },
  { label: 'flattened.js',
    data: 
     [ [ 100, 76 ],
       [ 500, 359 ],
       [ 1000, 718 ],
       [ 1500, 1088 ],
       [ 2000, 1467 ] ] },
  { label: 'genny.js',
    data: 
     [ [ 100, 103 ],
       [ 500, 398 ],
       [ 1000, 805 ],
       [ 1500, 1234 ],
       [ 2000, 1623 ] ] },
  { label: 'gens.js',
    data: 
     [ [ 100, 93 ],
       [ 500, 390 ],
       [ 1000, 781 ],
       [ 1500, 1164 ],
       [ 2000, 1556 ] ] },
  { label: 'original.js',
    data: 
     [ [ 100, 86 ],
       [ 500, 369 ],
       [ 1000, 728 ],
       [ 1500, 1086 ],
       [ 2000, 1487 ] ] },
  { label: 'promiseish.js',
    data: 
     [ [ 100, 99 ],
       [ 500, 503 ],
       [ 1000, 988 ],
       [ 1500, 1437 ],
       [ 2000, 1827 ] ] },
  { label: 'promiseishQ.js',
    data: 
     [ [ 100, 102 ],
       [ 500, 525 ],
       [ 1000, 1060 ],
       [ 1500, 1657 ],
       [ 2000, 2257 ] ] },
  { label: 'promises.js',
    data: 
     [ [ 100, 219 ],
       [ 500, 1239 ],
       [ 1000, 2229 ],
       [ 1500, 3334 ],
       [ 2000, 5048 ] ] },
  { label: 'qasync.js',
    data: 
     [ [ 100, 84 ],
       [ 500, 480 ],
       [ 1000, 999 ],
       [ 1500, 1542 ],
       [ 2000, 2077 ] ] },
  { label: 'suspend.js',
    data: 
     [ [ 100, 77 ],
       [ 500, 345 ],
       [ 1000, 669 ],
       [ 1500, 1066 ],
       [ 2000, 1430 ] ] } ]

.concat([ 
  { label: 'dst-streamline-fibers.js',
    data: 
     [ [ 100, 94 ],
       [ 500, 465 ],
       [ 1000, 909 ],
       [ 1500, 1389 ],
       [ 2000, 2538 ] ] },
  { label: 'fibrous.js',
    data: 
     [ [ 100, 134 ],
       [ 500, 602 ],
       [ 1000, 1340 ],
       [ 1500, 2454 ],
       [ 2000, 3919 ] ] } ]);
window.addEventListener('load', function() {
    $.plot('#perf-time-3', perfIOBound, {legend: { position: 'nw' }})
});
</script>

`promises.js` and `fibrous.js` are still significantly slower. However all of
the other solutions are quite comparable now . Lets remove the worst two:

<div id="perf-time-4" class="plot">
</div>
<script type="text/javascript">
window.addEventListener('load', function() {
    $.plot('#perf-time-4', perfIOBound.filter(function(item) {
        return !/(promises.js|fibrous.js)/.test(item.label)
    }), {legend: { position: 'nw' }});
});
</script>

Everything is about the same now. Great! So in practice, you won't notice 
the CPU overhead in I/O bound cases - even if you're using promises. And with 
some of the generator libraries, the overhead simply disappears.

Excellent. But what about memory usage? Lets chart that too!

Note: the y axis represents peak memory usage (in MB).

<div id="perf-mem-1" class="plot">
</div>
<script type="text/javascript">

window.perfMEM = 

[ { label: 'catcher.js',
    data: 
     [ [ 100, 2.3828125 ],
       [ 500, 7.99609375 ],
       [ 1000, 9.51171875 ],
       [ 1500, 18.96484375 ],
       [ 2000, 21.078125 ] ] },
  { label: 'co.js',
    data: 
     [ [ 100, 3.25390625 ],
       [ 500, 9.7578125 ],
       [ 1000, 16.6484375 ],
       [ 1500, 25.62890625 ],
       [ 2000, 31.8671875 ] ] },
  { label: 'dst-co-traceur.js',
    data: 
     [ [ 100, 0.90234375 ],
       [ 500, 9.43359375 ],
       [ 1000, 19.25 ],
       [ 1500, 31.58984375 ],
       [ 2000, 40.66796875 ] ] },
  { label: 'dst-genny-traceur.js',
    data: 
     [ [ 100, 0.99609375 ],
       [ 500, 11.35546875 ],
       [ 1000, 16.67578125 ],
       [ 1500, 36.8515625 ],
       [ 2000, 42.25 ] ] },
  { label: 'dst-qasync-traceur.js',
    data: 
     [ [ 100, 10.4296875 ],
       [ 500, 61.30078125 ],
       [ 1000, 110.34765625 ],
       [ 1500, 139.08984375 ],
       [ 2000, 187.03515625 ] ] },
  { label: 'dst-streamline.js',
    data: 
     [ [ 100, 3 ],
       [ 500, 8.93359375 ],
       [ 1000, 17.8203125 ],
       [ 1500, 25.69140625 ],
       [ 2000, 32.09765625 ] ] },
  { label: 'dst-suspend-traceur.js',
    data: 
     [ [ 100, 1.171875 ],
       [ 500, 7.57421875 ],
       [ 1000, 14.82421875 ],
       [ 1500, 26.47265625 ],
       [ 2000, 37.11328125 ] ] },
  { label: 'flattened.js',
    data: 
     [ [ 100, 2.015625 ],
       [ 500, 7.01953125 ],
       [ 1000, 8.86328125 ],
       [ 1500, 14.21875 ],
       [ 2000, 20.078125 ] ] },
  { label: 'genny.js',
    data: 
     [ [ 100, 3.1796875 ],
       [ 500, 11.5 ],
       [ 1000, 21.1640625 ],
       [ 1500, 28.41015625 ],
       [ 2000, 40.03125 ] ] },
  { label: 'gens.js',
    data: 
     [ [ 100, 2.984375 ],
       [ 500, 9.62109375 ],
       [ 1000, 18.421875 ],
       [ 1500, 25.375 ],
       [ 2000, 35.93359375 ] ] },
  { label: 'original.js',
    data: 
     [ [ 100, 1.86328125 ],
       [ 500, 7.0078125 ],
       [ 1000, 8.6015625 ],
       [ 1500, 14.15625 ],
       [ 2000, 19 ] ] },
  { label: 'promiseish.js',
    data: 
     [ [ 100, 18.2265625 ],
       [ 500, 88.390625 ],
       [ 1000, 138.7265625 ],
       [ 1500, 179.640625 ],
       [ 2000, 239.70703125 ] ] },
  { label: 'promiseishQ.js',
    data: 
     [ [ 100, 15.5859375 ],
       [ 500, 75.85546875 ],
       [ 1000, 121.36328125 ],
       [ 1500, 170.74609375 ],
       [ 2000, 176.2265625 ] ] },
  { label: 'promises.js',
    data: 
     [ [ 100, 25.515625 ],
       [ 500, 125.359375 ],
       [ 1000, 244.90234375 ],
       [ 1500, 366.99609375 ],
       [ 2000, 489.53515625 ] ] },
  { label: 'qasync.js',
    data: 
     [ [ 100, 11.8515625 ],
       [ 500, 61.0859375 ],
       [ 1000, 96.12109375 ],
       [ 1500, 145.15625 ],
       [ 2000, 156.015625 ] ] },
  { label: 'suspend.js',
    data: 
     [ [ 100, 3.02734375 ],
       [ 500, 10.06640625 ],
       [ 1000, 17.41015625 ],
       [ 1500, 24.625 ],
       [ 2000, 31.2890625 ] ] } ]


  .concat(     
  [{ label: 'dst-streamline-fibers.js',
    data: 
     [ [ 100, 2.5703125 ],
       [ 500, 13.8359375 ],
       [ 1000, 25.56640625 ],
       [ 1500, 37.890625 ],
       [ 2000, 48.703125 ] ] },
  { label: 'fibrous.js',
    data: 
     [ [ 100, 7.57421875 ],
       [ 500, 37.265625 ],
       [ 1000, 71.1171875 ],
       [ 1500, 93.4609375 ],
       [ 2000, 114.8828125 ] ] }]);

window.addEventListener('load', function() {
    $.plot('#perf-mem-1', perfMEM, {legend: { position: 'nw' }});
});
</script>

Seems like promises also use a lot of memory, especially the extreme 
implementation `promises.js`. `promiseish.js` as well as `qasync.js` are not
too far behind.

`fibrous.js` is somewhat better than the above, however its memory usage is
still over 5 times bigger than the original.

Lets remove the hogs and see what remains underneath.

<div id="perf-mem-2" class="plot">
</div>
<script type="text/javascript">
window.addEventListener('load', function() {
    $.plot('#perf-mem-2', perfMEM.filter(function(item) {
        return !/(promises|promiseish|qasync|fibrous)/.test(item.label)
    }), {legend: { position: 'nw' }});
});
</script>

Streamline's fibers implementation uses 50MB while the rest use between
20MB and 40MB - an overhead that can be safely ignored. 

This is amazing. Generators (without promises) have a low memory overhead, 
even when compiled with traceur.

Streamline is also quite good in this category. It has very low overhead, both 
in CPU and memory usage. But suspend is comparable even when run non-natively 
with the traceur compiler.

Finally, its important to note that the testing method that I use is not 
statistically sound. Its however good enough to be used to compare orders of
magnitude, which is fine considering the narrowly defined micro-benchmark being
tested.

With that said, here is a table for 1000 parallel requests, 10 ms per I/O 
operation:


| file                     | time(ms) | memory(MB) |
|--------------------------|---------:|-----------:|
| suspend.js               |      134 |      16.73 |
| original.js              |      145 |       8.73 |
| catcher.js               |      153 |       9.52 |
| flattened.js             |      155 |       8.85 |
| dst-suspend-traceur.js   |      205 |      14.24 |
| gens.js                  |      212 |      18.47 |
| dst-streamline.js        |      212 |      17.80 |
| genny.js                 |      230 |      21.39 |
| co.js                    |      230 |      16.65 |
| dst-co-traceur.js        |      314 |      17.85 |
| dst-genny-traceur.js     |      316 |      16.68 |
| dst-streamline-fibers.js |      600 |      25.59 |
| qasync.js                |      929 |     104.61 |
| promiseish.js            |     1003 |     138.76 |
| promiseishQ.js           |     1053 |     120.63 |
| dst-qasync-traceur.js    |     1114 |     110.38 |
| fibrous.js               |     1304 |      71.24 |
| promises.js              |     2255 |     244.80 |


<a name="debuggability"></a>

### Debuggability

Having good performance is important. However, all the performance is worth 
nothing if our code doesn't do what its supposed to. Debugging is therefore
at least as important as performance.

How can we measure debuggability? We can look at source maps support and
the generated stack traces.

<a name="source-maps-support"></a>

#### Source maps support

This has a couple of levels itself:

* **level 1**: no source maps, but needs them (wacky stack trace line numbers)

* **level 2**: no source maps and needs them sometimes (to view the original
  code)

  Streamline used to be in this category but now it does have source maps 
  support.

* **level 3**: has source maps and needs them always.

  Nothing is in this category.

* **level 4**: has source maps and needs them sometimes

  Generator libraries are in this category. When compiled with traceur (e.g. 
  for the browser) source maps are required and needed. If ES6 is available, 
  source maps are unnecessary.

  Streamline is also in this category for another reason. With streamline,
  you don't need source maps to get accurate stack traces. However, you will
  need them if you want to read the original code (e.g. when debugging in 
  the browser).

* **level 5**: doesn't need source maps

  Everything else is in this category. That's a bit unfair as fibers will never 
  work in a browser.
  
<a name="stack-trace-accuracy"></a>

#### Stack trace accuracy

* **level 1**: stack traces are missing

  `suspend`, `co` and `gens` are in this category. When an error happens in one 
  of the async functions, this is how the result looks like:  

  ```
  Error: Error happened
    at null._onTimeout (/home/spion/Documents/tests/async-compare/lib/fakes.js:27:27)
    at Timer.listOnTimeout [as ontimeout] (timers.js:105:15)
  ```

  No mention of the original file, `examples/suspend.js`

  Unfortunately, if you throw an error to a generator using 
  `iterator.throw(error)`, the last yield point will not be present in the 
  resulting stack trace. This means you will have no idea which line in your 
  generator is the offending one.

  Regular exceptions that are not thrown using `iterator.throw` have complete 
  stack traces, so only yield points will suffer.

* **level 2**: stack traces are never correct
  
  In this category: `promiseish.js`. Unfortunately if special care is not taken 
  to preserve a stack trace, it will not be preserved and the promise library
  `when` doesn't do that.
  
* **level 3**: stack traces are correct with native modules

  Bruno Jouhier's generator based solution [galaxy](//github.com/bjouhier/galaxy) 
  is in this category. It has a native companion module called 
  [galaxy-stack](//github.com/bjouhier/galaxy-stack) that implements long stack
  traces without a performance penalty. 

* **level 4**: stack traces are correct with a flag (adding a performance 
  penalty).

  All Q-based solutions are here, even `qasync.js`, which uses generators. Q's
  support for stack traces via `Q.longStackSupport = true;` is good:

  ```
  Error: Error happened
      at null._onTimeout (/home/spion/Documents/tests/async-compare/lib/fakes.js:27:27)
      at Timer.listOnTimeout [as ontimeout] (timers.js:105:15)
  From previous event:
      at /home/spion/Documents/tests/async-compare/examples/qasync.js:41:18
      at GeneratorFunctionPrototype.next (native)
  ```

  So, does this mean that its possible to add long stack traces support to a 
  callbacks-based generator library the way that Q does it? 

  Yes it does! Genny is in this category too:

  ```
  Error: Error happened
      at null._onTimeout (/home/spion/Documents/tests/async-compare/lib/fakes.js:27:27)
      at Timer.listOnTimeout [as ontimeout] (timers.js:105:15)
  From generator:
      at upload (/home/spion/Documents/tests/async-compare/examples/genny.js:38:35)
  ```
  
  However it incurs about 50-70% memory overhead and is about 6 times slower.

  Catcher is also in this category, with 100% memory overhead and about 
  10 times slower.

* **level 5**: stack traces are always correct

  Streamline and both the original and flattened solutions are in this 
  category. Streamline compiles the file in a way that preserves line numbers,
  making stack traces correct in all cases. Fibers also include the offending
  line in the stack trace.

Ah yes. A table.

| name                | source maps | stack traces | total | 
|---------------------|------------:|-------------:|------:|
| original.js         |          5  |            5 |    10 |
| flattened.js        |          5  |            5 |    10 |
| fibrous.js          |          5  |            5 |    10 |
| src-streamline._js  |          4  |            5 |     9 |
| catcher.js          |          5  |            4 |     9 |
| promiseishQ.js      |          5  |            4 |     9 |
| qasync.js           |          4  |            4 |     8 |
| genny.js            |          4  |            4 |     8 |
| promiseish.js       |          5  |            2 |     7 |
| promises.js         |          5  |            1 |     6 |
| suspend.js          |          4  |            1 |     5 |
| gens.js             |          4  |            1 |     5 |
| co.js               |          4  |            1 |     5 |

Generators are not exactly the best here, but they're doing well enough thanks
to qasync and genny.

Here is the report from an automated test script that compares the reported 
error line with the actual error line:

| file                     | actual line | rep line | distance |
|--------------------------|------------:|---------:|---------:|
| catcher.js               |          38 |       38 |        0 |
| qasync.js                |          39 |       39 |        0 |
| genny.js                 |          38 |       38 |        0 |
| fibrous.js               |          38 |       38 |        0 |
| dst-streamline-fibers.js |          36 |       35 |        1 |
| dst-streamline.js        |          37 |       36 |        1 |
| original.js              |          50 |       51 |        1 |
| flattened.js             |          61 |       64 |        3 |
| promiseishQ.js           |          49 |       52 |        3 |


<a name="conclusion"></a>

### Conclusion

If this essay left you even more confused than before, you're not alone. It
seems hard to make a decision even with all the data available.

My opinion is biased. I love generators, and I've been 
[pushing](https://code.google.com/p/v8/issues/detail?id=2355#c2)
[pretty hard](https://news.ycombinator.com/item?id=5419030) to direct the 
attention of V8 developers to them (maybe a bit too hard). And its obvious 
from the analysis above that they have good characteristics: low code 
complexity, good performance, acceptable debuggability.

More importantly, they will eventually become a part of everyday JavaScript 
with no compilation (except for older browsers) or native modules required, 
and the yield keyword is in principle as good indicator of async code as 
callbacks are.

But there are things that cannot be measured. How will the community accept 
generators? Will people find it hard to decide whether to use them or not? Will 
they be frowned upon when used in code published to npm?

I don't have the answers to these questions. I only have hunches. But they are 
generally positive. Generators will play an important role in the future of 
node.


---

Special thanks to 
[Raynos](//github.com/Raynos), 
[maxogden](//github.com/maxogden), 
[mikeal](//github.com/mikeal)
and [damonoehlman](//github.com/DamonOehlman)
for their input on the draft version of this essay.

Thanks to [jmar777](//github.com/jmar777) for making suspend

<script src="/scripts/jquery.flot.js"></script>
<script src="/scripts/jquery.flot.highlightSeries.js"></script>
