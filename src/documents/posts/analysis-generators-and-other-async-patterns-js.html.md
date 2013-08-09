---
hidden: true
title: Analysis: generators and other async patterns in node
layout: post
date: 2013-08-09
---

      
Async code patterns are the subject of never-ending debates for us node.js 
developers. Everyone has their own favorite method or pet library as well as
strong feelings and opinions on all the other methods and libraries. Debates
can be heated: sometimes social pariahs may be declared or grave rolling 
may be induced.

The reason for this is that JavaScript in V8 never had any continuation 
mechanism to allow code to pause and resume across the event loop boundary. 

Until now.

### A gentle introduction to generators

<small>If you know how generators work, you can <a href="#skip">skip this</a>
    and continue to the analysis</small>

Generators are a new feature of ES6. Normally they would be used for iteration.
Here is a generator that generates fibonacci numbers. The example is taken from
the [ecmascript harmony wiki](http://wiki.ecmascript.org/doku.php?id=harmony:generators)

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

Generator functions are actully constructors of iterators. The returned 
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
`for` loop and calculate the next fibonacci pair.

So how would we use this to write async code? 

A great thing about the `next()` method is that it can also send values to the 
generator. Lets write a simple number generator that also collects the stuff it 
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

Lets give things to this generator:

```js
var iterator = numbers();
console.log(iterator.next('present')); // 1
console.log(iterator.next('cat')); // 2
fs.readFile('file.txt', function(err, resultFromAnAsyncTask) {
    console.log(iterator.next(resultFromAnAsyncTask)); // 3
})
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
function process(iterator, sendValue) {}
    var fileTask = iterator.next(sendValue);
    fs.readFile(fileTask, function(err, res) {
        if (err) iterator.throw(err);
        else process(iterator, res);
    })    
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
involountairly at any point by the operating systems, generators have to 
willingly suspend themselves using `yield`. This means that there is no danger 
of variables changing under our feet, except after a `yield`.

Generators go a step further with this: its impossible to suspend execution
without using the `yield` keyword. Infact, if you want to call another 
generator you will have to write `yield* anotherGenerator(args)`. This means 
that suspend points are always visible in the code, just like they are when 
using callbacks.

Amazing stuff! So what does this mean? What is the gain in reducing code 
complexity? What are the performance characteristics of code using generators?
How is debugging? What about environments that don't have ES6 support?

I decided to do a big comparison of all existing node async code patterns and
find the answers to these questions. 

<a name="skip"></a>

### The analysis

For the analysis, I took `file.upload`, a typical CRUD method extracted from  
[DoxBee](http://doxbee.com) called when uploading files. It executes multiple 
queries to the database: a couple of selects, some inserts and one update. 
Lots of mixed sync/async action.

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
        var blobId = yield blob.put(stream, resume.t); 
        var file = yield self.byUuidOrPath(idOrPath).get(resume.t); 
        var previousId = file ? file.version : null;
        var version = {
            userAccountId: userAccount.id,
            blobId: blobId,
            creatorId: userAccount.id,
            previousId: previousId
        };
        version.id = Version.createHash(version);
        yield Version.insert(version).execWithin(tx, resume.t);
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
            var q = yield self.createQuery(idOrPath, file, resume.t);
            yield q.execWithin(tx, resume.t);
        }
        yield FileVersion.insert({fileId: file.id, versionId: version.id})
            .execWithin(tx, resume.t);
        yield File.whereUpdate({id: file.id}, {version: version.id})
            .execWithin(tx, resume.t); 
        yield tx.commit(resume.t);
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

#### [original.js](//github.com/spion/async-compare/blob/master/examples/original.js)

The original solution, presented above. Vanilla callbacks. Slightly pyramidal. 
I consider it acceptable, if a bit mediocre.

#### [flattened.js](//github.com/spion/async-compare/blob/master/examples/flattened.js)

Flattened variant of the original via named functions. Taking the advice from
[callback hell](http://callbackhell.com/), I flattened the pyramid a little 
bit. As I did that, I found that while the pyramid shrunk, the code actually 
grew.

#### [catcher.js](//github.com/spion/async-compare/blob/master/examples/catcher.js)

I noticed that the first two vanilla solutions had a lot of common error 
handling code everywhere. So I wrote a tiny library called catcher.js which 
works very much like node's `domain.intercept`. This reduced the complexity
and the number of lines further, but the pyramidal looks remained.

#### [promises.js](//github.com/spion/async-compare/blob/master/examples/promises.js)

I'll be honest. I've never written promise code in node before. Driven by 
[Gozalla's excellent post](//jeditoolkit.com/2012/04/26/code-logic-not-mechanics.html#post)
I concluded that everything should be a promise, and things that can't handle 
promises should also be rewriten. 

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

So I decided to write a less agressive version, `promiseish.js`

note: I used [when](//github.com/cujojs/when) because i liked its function 
lifting API better than Q's


#### [promiseish.js](//github.com/spion/async-compare/blob/master/examples/promises.js) and [promiseishQ.js](//github.com/spion/async-compare/blob/master/examples/promises.js)

Nothing fancy here, just some `.then()` chaining. Infact it feels less complex
than the `promise.js` version, where I felt like I was trying to fight the
language all the time.

The second file `promiseishQ.js` uses [Q](//github.com/kriskowal/q) instead of 
[when](//github.com/cujojs/when).


#### [suspend.js](//github.com/spion/async-compare/blob/master/examples/suspend.js) and [genny.js](//github.com/spion/async-compare/blob/master/examples/promises.js)

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

#### [fibrous.js](//github.com/spion/async-compare/blob/master/examples/fibrous.js)

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
`yield` to indicate the methods that will yield. One benefit is that it 
feels more natural for chaining - less parens are needed. 

```
somefn.sync(arg).split('/')
// vs
(yield somefn(arg, resume)).split('/')
```

Major drawback: this will never be available outside of node.js or without 
native modules.

Library: [fibrous](//github.com/goodeggs/fibrous)

#### [qasync.js](//github.com/spion/async-compare/blob/master/examples/qasync.js)

Generators with promises. Didnt feel very different than genny or suspend.
Its slightly less complicated: you can yield the promise instead of placing
the provided resume function at every point where a callback is needed. 

Caveat: as always with promises you will need to wrap all callback-based 
functions.

Library: [Q](//github.com/kriskowal/q)


#### [streamline.js](//github.com/spion/async-compare/blob/master/examples/src-streamline._js)

Uses [streamlinejs](http://github.com/Sage/streamlinejs) CPS transformer and
works very much like suspend and genny, except without needing to write yield 
all the time.

Caveat: you will need to compile the file in order to use it. Also, even 
though it looks like valid JavaScript, it isn't JavaScript. Supreficially, it 
has the same syntax, but it has very different semantics, particularly when
it comes to the `_` keyword, which acts like `yield` and `resume` combined in 
one.

The code however is really simple and straightforward.


### Complexity

To measure complexity I took the number of tokens in the source code found by
Esprima's lexer (comments excluded). The idea is taken from
[Paul Graham's essay _Succintness is Power_](http://www.paulgraham.com/power.html)

Results:

| name               | tokens | complexity |
|--------------------|-------:|-----------:|
| src-streamline._js |    297 |       1.00 |
| fibrous.js         |    312 |       1.05 |
| qasync.js          |    315 |       1.06 |
| suspend.js         |    326 |       1.10 |
| genny.js           |    334 |       1.12 |
| catcher.js         |    391 |       1.32 |
| promiseishQ.js     |    397 |       1.34 |
| promiseish.js      |    410 |       1.38 |
| original.js        |    420 |       1.41 |
| promises.js        |    456 |       1.54 |
| flattened.js       |    472 |       1.59 |


Streamline has the lowest complexity. Fibrous, qasync, suspend and genny are
in the same ballpark, roughly comparable with streamline.

Catcher is comparable with both promise solutions. The complexity when using 
promises is roughly comparable to the original version with callbacks, but 
there is some improvement.

Finally, it seems that going promises-all-the-way or flattening the callback 
pyramid are not worth it. Both only increase the complexity.


### Performance (time and memory)

To be able to execute the files, all external methods are mocked with 
setTimeout to simulate waiting for I/O. 

There are two variables that control the test:

* \\(n\\) - the number of parallel "upload requests"
* \\(t\\) - average wait time per async I/O operation

For the first test, I set the time for every async operation \\(t = 1ms\\) then 
ran every solution for \\(n \\in \lbrace 100,500,1000,1500,2000 \rbrace \\).

note: hover over the legend to highlight the item on the chart.

<div id="perf-time-1" class="plot" style="height: 400px;">
</div>
<script type="text/javascript">
window.addEventListener('load', function() {
    $.plot('#perf-time-1', 
[ { label: 'catcher.js',
    data: 
     [ [ 100, 19 ],
       [ 500, 42 ],
       [ 1000, 67 ],
       [ 1500, 94 ],
       [ 2000, 143 ] ] },
  { label: 'dst-genny-traceur.js',
    data: 
     [ [ 100, 29 ],
       [ 500, 123 ],
       [ 1000, 224 ],
       [ 1500, 332 ],
       [ 2000, 416 ] ] },
  { label: 'dst-qasync-traceur.js',
    data: 
     [ [ 100, 123 ],
       [ 500, 501 ],
       [ 1000, 1044 ],
       [ 1500, 1679 ],
       [ 2000, 2448 ] ] },
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
       [ 2000, 3917 ] ] },
  { label: 'dst-streamline.js',
    data: 
     [ [ 100, 20 ],
       [ 500, 49 ],
       [ 1000, 90 ],
       [ 1500, 141 ],
       [ 2000, 199 ] ] },
  { label: 'dst-suspend-traceur.js',
    data: 
     [ [ 100, 23 ],
       [ 500, 105 ],
       [ 1000, 199 ],
       [ 1500, 264 ],
       [ 2000, 319 ] ] },
  { label: 'flattened.js',
    data: 
     [ [ 100, 18 ],
       [ 500, 41 ],
       [ 1000, 64 ],
       [ 1500, 88 ],
       [ 2000, 109 ] ] },
  { label: 'genny.js',
    data: 
     [ [ 100, 25 ],
       [ 500, 71 ],
       [ 1000, 156 ],
       [ 1500, 228 ],
       [ 2000, 336 ] ] },
  { label: 'original.js',
    data: 
     [ [ 100, 19 ],
       [ 500, 42 ],
       [ 1000, 64 ],
       [ 1500, 85 ],
       [ 2000, 109 ] ] },
  { label: 'promiseish.js',
    data: 
     [ [ 100, 61 ],
       [ 500, 454 ],
       [ 1000, 780 ],
       [ 1500, 1539 ],
       [ 2000, 1682 ] ] },
  { label: 'promiseishQ.js',
    data: 
     [ [ 100, 92 ],
       [ 500, 518 ],
       [ 1000, 1017 ],
       [ 1500, 1668 ],
       [ 2000, 2198 ] ] },
  { label: 'promises.js',
    data: 
     [ [ 100, 216 ],
       [ 500, 911 ],
       [ 1000, 2265 ],
       [ 1500, 3861 ],
       [ 2000, 5793 ] ] },
  { label: 'qasync.js',
    data: 
     [ [ 100, 76 ],
       [ 500, 472 ],
       [ 1000, 950 ],
       [ 1500, 1518 ],
       [ 2000, 2053 ] ] },
  { label: 'suspend.js',
    data: 
     [ [ 100, 17 ],
       [ 500, 45 ],
       [ 1000, 73 ],
       [ 1500, 135 ],
       [ 2000, 184 ] ] } ]
,{legend: { position: 'nw' }})
});
</script>

Wow. Promises seem really, really slow. Fibers are also slow, with time 
complexity \\( O(n^2) \\). Everything else seems to be much faster.

Lets try removing all those promises and fibers to see whats down there.

<div id="perf-time-2" class="plot" style="height: 400px;">
</div>
<script type="text/javascript">
window.addEventListener('load', function() {
    $.plot('#perf-time-2', 
[ { label: 'catcher.js',
    data: 
     [ [ 100, 19 ],
       [ 500, 42 ],
       [ 1000, 67 ],
       [ 1500, 94 ],
       [ 2000, 143 ] ] },
  { label: 'dst-genny-traceur.js',
    data: 
     [ [ 100, 29 ],
       [ 500, 123 ],
       [ 1000, 224 ],
       [ 1500, 332 ],
       [ 2000, 416 ] ] },
  { label: 'dst-streamline.js',
    data: 
     [ [ 100, 20 ],
       [ 500, 49 ],
       [ 1000, 90 ],
       [ 1500, 141 ],
       [ 2000, 199 ] ] },
  { label: 'dst-suspend-traceur.js',
    data: 
     [ [ 100, 23 ],
       [ 500, 105 ],
       [ 1000, 199 ],
       [ 1500, 264 ],
       [ 2000, 319 ] ] },
  { label: 'flattened.js',
    data: 
     [ [ 100, 18 ],
       [ 500, 41 ],
       [ 1000, 64 ],
       [ 1500, 88 ],
       [ 2000, 109 ] ] },
  { label: 'genny.js',
    data: 
     [ [ 100, 25 ],
       [ 500, 71 ],
       [ 1000, 156 ],
       [ 1500, 228 ],
       [ 2000, 336 ] ] },
  { label: 'original.js',
    data: 
     [ [ 100, 19 ],
       [ 500, 42 ],
       [ 1000, 64 ],
       [ 1500, 85 ],
       [ 2000, 109 ] ] },
  { label: 'suspend.js',
    data: 
     [ [ 100, 17 ],
       [ 500, 45 ],
       [ 1000, 73 ],
       [ 1500, 135 ],
       [ 2000, 184 ] ] } ]
  , {legend: { position: 'nw' }})
});
</script>

Ahh. Much better. 

The original and flattened solution are the fastest, as they use vanilla 
callbacks. 

It seems like catcher adds a slight overhead, making things just a bit slower.

The generators solution suspend is really fast. It incurred minimal overhead of 
about 50-80% running time. Its also roughly comparable with streamlinejs (when 
in raw callbacks mode).

Next is suspend compiled with 
[Google Traceur](//github.com/google/traceur-compiler/), an ES6 to ES5 compiler
which we need to run generators code without the `--harmony` switch or in 
browsers. Is roughly 2-3 times slower, which is great.

Genny is also 2-3 times slower. This is because it adds some protection 
guarantees: it makes sure that callback-calling function behave and call the 
callback only once and provides a mechanism to enable better stack traces
when errors are encountered.

The slowest is genny when run with traceur, which is about 4 times slower than
the original solution.

Looks great. But isn't this a bit unrelaistic?

Most async operations take much longer than 1 milisecond to complete, 
especially when the load is as high as thousands of requests per second.
As a result, performance is I/O bound - why measure things as if it were 
CPU-bound?

So lets increase the average time needed for an async operation to 

$$ t = {n \\over 10} $$

This will make I/O operation time grow together with \\(n\\). Each will
take 10ms on average when there are 100 running in parallel and 100ms when 
there are 1000 running in parallel. Makes much more sense.

<div id="perf-time-3" class="plot" style="height: 400px;">
</div>
<script type="text/javascript">
window.addEventListener('load', function() {
    $.plot('#perf-time-3', 

[ { label: 'catcher.js',
    data: 
     [ [ 100, 81 ],
       [ 500, 366 ],
       [ 1000, 740 ],
       [ 1500, 1107 ],
       [ 2000, 1499 ] ] },
  { label: 'dst-genny-traceur.js',
    data: 
     [ [ 100, 98 ],
       [ 500, 454 ],
       [ 1000, 863 ],
       [ 1500, 1268 ],
       [ 2000, 1738 ] ] },
  { label: 'dst-qasync-traceur.js',
    data: 
     [ [ 100, 117 ],
       [ 500, 509 ],
       [ 1000, 1093 ],
       [ 1500, 2096 ],
       [ 2000, 2484 ] ] },
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
       [ 2000, 3919 ] ] },
  { label: 'dst-streamline.js',
    data: 
     [ [ 100, 87 ],
       [ 500, 366 ],
       [ 1000, 736 ],
       [ 1500, 1211 ],
       [ 2000, 1550 ] ] },
  { label: 'dst-suspend-traceur.js',
    data: 
     [ [ 100, 88 ],
       [ 500, 371 ],
       [ 1000, 703 ],
       [ 1500, 1056 ],
       [ 2000, 1383 ] ] },
  { label: 'flattened.js',
    data: 
     [ [ 100, 84 ],
       [ 500, 351 ],
       [ 1000, 718 ],
       [ 1500, 1099 ],
       [ 2000, 1472 ] ] },
  { label: 'genny.js',
    data: 
     [ [ 100, 85 ],
       [ 500, 395 ],
       [ 1000, 780 ],
       [ 1500, 1205 ],
       [ 2000, 1658 ] ] },
  { label: 'original.js',
    data: 
     [ [ 100, 85 ],
       [ 500, 356 ],
       [ 1000, 726 ],
       [ 1500, 1107 ],
       [ 2000, 1474 ] ] },
  { label: 'promiseish.js',
    data: 
     [ [ 100, 66 ],
       [ 500, 459 ],
       [ 1000, 803 ],
       [ 1500, 1570 ],
       [ 2000, 1779 ] ] },
  { label: 'promiseishQ.js',
    data: 
     [ [ 100, 90 ],
       [ 500, 537 ],
       [ 1000, 1054 ],
       [ 1500, 1664 ],
       [ 2000, 2210 ] ] },
  { label: 'promises.js',
    data: 
     [ [ 100, 212 ],
       [ 500, 912 ],
       [ 1000, 2227 ],
       [ 1500, 3851 ],
       [ 2000, 5855 ] ] },
  { label: 'qasync.js',
    data: 
     [ [ 100, 84 ],
       [ 500, 499 ],
       [ 1000, 986 ],
       [ 1500, 1537 ],
       [ 2000, 2102 ] ] },
  { label: 'suspend.js',
    data: 
     [ [ 100, 78 ],
       [ 500, 342 ],
       [ 1000, 693 ],
       [ 1500, 1064 ],
       [ 2000, 1432 ] ] } ]


, {legend: { position: 'nw' }})
});
</script>

`promises.js` and `fibrous.js` are still significantly slower. However all of
the other solutions are quite comparable now . Lets remove the worst two:

<div id="perf-time-4" class="plot" style="height: 400px;">
</div>
<script type="text/javascript">
window.addEventListener('load', function() {
    $.plot('#perf-time-4', 

[ { label: 'catcher.js',
    data: 
     [ [ 100, 81 ],
       [ 500, 366 ],
       [ 1000, 740 ],
       [ 1500, 1107 ],
       [ 2000, 1499 ] ] },
  { label: 'dst-genny-traceur.js',
    data: 
     [ [ 100, 98 ],
       [ 500, 454 ],
       [ 1000, 863 ],
       [ 1500, 1268 ],
       [ 2000, 1738 ] ] },
  { label: 'dst-qasync-traceur.js',
    data: 
     [ [ 100, 117 ],
       [ 500, 509 ],
       [ 1000, 1093 ],
       [ 1500, 2096 ],
       [ 2000, 2484 ] ] },
  { label: 'dst-streamline-fibers.js',
    data: 
     [ [ 100, 94 ],
       [ 500, 465 ],
       [ 1000, 909 ],
       [ 1500, 1389 ],
       [ 2000, 2538 ] ] },
  { label: 'dst-streamline.js',
    data: 
     [ [ 100, 87 ],
       [ 500, 366 ],
       [ 1000, 736 ],
       [ 1500, 1211 ],
       [ 2000, 1550 ] ] },
  { label: 'dst-suspend-traceur.js',
    data: 
     [ [ 100, 88 ],
       [ 500, 371 ],
       [ 1000, 703 ],
       [ 1500, 1056 ],
       [ 2000, 1383 ] ] },
  { label: 'flattened.js',
    data: 
     [ [ 100, 84 ],
       [ 500, 351 ],
       [ 1000, 718 ],
       [ 1500, 1099 ],
       [ 2000, 1472 ] ] },
  { label: 'genny.js',
    data: 
     [ [ 100, 85 ],
       [ 500, 395 ],
       [ 1000, 780 ],
       [ 1500, 1205 ],
       [ 2000, 1658 ] ] },
  { label: 'original.js',
    data: 
     [ [ 100, 85 ],
       [ 500, 356 ],
       [ 1000, 726 ],
       [ 1500, 1107 ],
       [ 2000, 1474 ] ] },
  { label: 'promiseish.js',
    data: 
     [ [ 100, 66 ],
       [ 500, 459 ],
       [ 1000, 803 ],
       [ 1500, 1570 ],
       [ 2000, 1779 ] ] },
  { label: 'promiseishQ.js',
    data: 
     [ [ 100, 90 ],
       [ 500, 537 ],
       [ 1000, 1054 ],
       [ 1500, 1664 ],
       [ 2000, 2210 ] ] },
  { label: 'qasync.js',
    data: 
     [ [ 100, 84 ],
       [ 500, 499 ],
       [ 1000, 986 ],
       [ 1500, 1537 ],
       [ 2000, 2102 ] ] },
  { label: 'suspend.js',
    data: 
     [ [ 100, 78 ],
       [ 500, 342 ],
       [ 1000, 693 ],
       [ 1500, 1064 ],
       [ 2000, 1432 ] ] } ]


, {legend: { position: 'nw' }})
});
</script>

Everything is about the same now. Great! So in practice, you won't notice 
the CPU overhead in I/O bound cases - even if you're using promises. And with 
some of the generator libraries, the overhead simply disappears.

Excellent. But what about memory usage? Lets chart that too!

Note: the y axis represents the amount of RAM (in MB) used when running the 
test.

<div id="perf-mem-1" class="plot" style="height: 400px;">
</div>
<script type="text/javascript">
window.addEventListener('load', function() {
    $.plot('#perf-mem-1', 
[ { label: 'catcher.js',
    data: 
     [ [ 100, 1.96875 ],
       [ 500, 6.20703125 ],
       [ 1000, 9.5234375 ],
       [ 1500, 14.98046875 ],
       [ 2000, 21.609375 ] ] },
  { label: 'dst-genny-traceur.js',
    data: 
     [ [ 100, 0.8359375 ],
       [ 500, 7.55078125 ],
       [ 1000, 12.125 ],
       [ 1500, 27.3828125 ],
       [ 2000, 33.921875 ] ] },
  { label: 'dst-qasync-traceur.js',
    data: 
     [ [ 100, 11.75 ],
       [ 500, 58.3828125 ],
       [ 1000, 92.86328125 ],
       [ 1500, 135.484375 ],
       [ 2000, 137.42578125 ] ] },
  { label: 'dst-streamline.js',
    data: 
     [ [ 100, 1.83984375 ],
       [ 500, 6.96484375 ],
       [ 1000, 11.953125 ],
       [ 1500, 22.03515625 ],
       [ 2000, 25.21875 ] ] },
  { label: 'dst-suspend-traceur.js',
    data: 
     [ [ 100, 1.41015625 ],
       [ 500, 6.92578125 ],
       [ 1000, 10.15234375 ],
       [ 1500, 18.47265625 ],
       [ 2000, 36.859375 ] ] },
  { label: 'dst-streamline-fibers.js',
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
       [ 2000, 114.8828125 ] ] },
  { label: 'flattened.js',
    data: 
     [ [ 100, 1.40234375 ],
       [ 500, 5.5859375 ],
       [ 1000, 9.1328125 ],
       [ 1500, 10.39453125 ],
       [ 2000, 19.2890625 ] ] },
  { label: 'genny.js',
    data: 
     [ [ 100, 2.265625 ],
       [ 500, 10.65625 ],
       [ 1000, 16.546875 ],
       [ 1500, 26.1796875 ],
       [ 2000, 32.30078125 ] ] },
  { label: 'original.js',
    data: 
     [ [ 100, 1.4453125 ],
       [ 500, 5.55078125 ],
       [ 1000, 9.0625 ],
       [ 1500, 10.41015625 ],
       [ 2000, 19.265625 ] ] },
  { label: 'promiseish.js',
    data: 
     [ [ 100, 17.453125 ],
       [ 500, 76.05078125 ],
       [ 1000, 136.4296875 ],
       [ 1500, 221.9140625 ],
       [ 2000, 230.33984375 ] ] },
  { label: 'promiseishQ.js',
    data: 
     [ [ 100, 16.01171875 ],
       [ 500, 75.4375 ],
       [ 1000, 100.28125 ],
       [ 1500, 167.7890625 ],
       [ 2000, 181.2265625 ] ] },
  { label: 'promises.js',
    data: 
     [ [ 100, 24.68359375 ],
       [ 500, 120.0703125 ],
       [ 1000, 239.69140625 ],
       [ 1500, 358.953125 ],
       [ 2000, 480.25390625 ] ] },
  { label: 'qasync.js',
    data: 
     [ [ 100, 11.8671875 ],
       [ 500, 60.09765625 ],
       [ 1000, 97.4140625 ],
       [ 1500, 146.78125 ],
       [ 2000, 160.43359375 ] ] },
  { label: 'suspend.js',
    data: 
     [ [ 100, 2.06640625 ],
       [ 500, 7.34765625 ],
       [ 1000, 12.90625 ],
       [ 1500, 21.98828125 ],
       [ 2000, 25.26171875 ] ] } ]

, {legend: { position: 'nw' }})
});
</script>

Seems like promises also use a lot of memory, especially the extreme 
implementation `promises.js`. `promiseish.js` as well as `qasync.js` are not
too far behind.

`fibrous.js` is somewhat better than the above, however its memory usage is
still over 5 times bigger than the original.

Lets remove the hogs and see what remains underneath.

<div id="perf-mem-2" class="plot" style="height: 400px;">
</div>
<script type="text/javascript">
window.addEventListener('load', function() {
    $.plot('#perf-mem-2', 
[ { label: 'catcher.js',
    data: 
     [ [ 100, 1.96875 ],
       [ 500, 6.20703125 ],
       [ 1000, 9.5234375 ],
       [ 1500, 14.98046875 ],
       [ 2000, 21.609375 ] ] },
  { label: 'dst-genny-traceur.js',
    data: 
     [ [ 100, 0.8359375 ],
       [ 500, 7.55078125 ],
       [ 1000, 12.125 ],
       [ 1500, 27.3828125 ],
       [ 2000, 33.921875 ] ] },
  { label: 'dst-streamline.js',
    data: 
     [ [ 100, 1.83984375 ],
       [ 500, 6.96484375 ],
       [ 1000, 11.953125 ],
       [ 1500, 22.03515625 ],
       [ 2000, 25.21875 ] ] },
  { label: 'dst-suspend-traceur.js',
    data: 
     [ [ 100, 1.41015625 ],
       [ 500, 6.92578125 ],
       [ 1000, 10.15234375 ],
       [ 1500, 18.47265625 ],
       [ 2000, 36.859375 ] ] },
  { label: 'dst-streamline-fibers.js',
    data: 
     [ [ 100, 2.5703125 ],
       [ 500, 13.8359375 ],
       [ 1000, 25.56640625 ],
       [ 1500, 37.890625 ],
       [ 2000, 48.703125 ] ] },
  { label: 'flattened.js',
    data: 
     [ [ 100, 1.40234375 ],
       [ 500, 5.5859375 ],
       [ 1000, 9.1328125 ],
       [ 1500, 10.39453125 ],
       [ 2000, 19.2890625 ] ] },
  { label: 'genny.js',
    data: 
     [ [ 100, 2.265625 ],
       [ 500, 10.65625 ],
       [ 1000, 16.546875 ],
       [ 1500, 26.1796875 ],
       [ 2000, 32.30078125 ] ] },
  { label: 'original.js',
    data: 
     [ [ 100, 1.4453125 ],
       [ 500, 5.55078125 ],
       [ 1000, 9.0625 ],
       [ 1500, 10.41015625 ],
       [ 2000, 19.265625 ] ] },
  { label: 'suspend.js',
    data: 
     [ [ 100, 2.06640625 ],
       [ 500, 7.34765625 ],
       [ 1000, 12.90625 ],
       [ 1500, 21.98828125 ],
       [ 2000, 25.26171875 ] ] } ]

, {legend: { position: 'nw' }})
});
</script>

Streamline's fibers implementation uses 50MB of RAM. The rest use between
20MB and 35MB - an overhead that can be safely ignored. 

This is amazing. Generators (without promises) have a low memory overhead, 
even when compiled with traceur.

Streamline is also quite good in this category. It has very low overhead, both 
in CPU and memory usage. But suspend is comparable even when run non-natively 
with the traceur compiler.

Finally, its important to note that the testing method that I use is not 
statistically sound. Its however good enough to be used to compare orders of
magnitude, which is fine considering the narrowly defined micro-benchmark being
tested.

With that said, here is a table for 1000 parallel requests, 10ms per I/O 
operation:

| file                     | time(ms)  | memory(MB) |
|--------------------------|----------:|-----------:|
| suspend.js               |      112  |      12.89 |
| catcher.js               |      146  |       9.51 |
| original.js              |      153  |       9.08 |
| flattened.js             |      155  |       9.13 |
| dst-streamline.js        |      173  |      12.07 |
| dst-suspend-traceur.js   |      200  |      12.36 |
| genny.js                 |      243  |      16.54 |
| dst-genny-traceur.js     |      327  |      15.78 |
| dst-streamline-fibers.js |      600  |      25.59 |
| promiseish.js            |      781  |     136.39 |
| qasync.js                |      958  |     103.61 |
| promiseishQ.js           |     1030  |     122.86 |
| dst-qasync-traceur.js    |     1062  |     101.12 |
| fibrous.js               |     1304  |      71.24 |
| promises.js              |     2232  |     239.88 |


### Debuggability

Having good performance is important. However, all the performance is worth 
nothing if our code doesn't do what its supposed to. Debugging is therefore
at least as important as performance.

How can we measure debuggability? We can look at source maps support and
the generated stack traces.

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

  Generators are in this category. When compiled with traceur (e.g. for the
  browser) source maps are required and needed. If ES6 is available, source
  maps are unecessarry.

  Streamline is also in this category, for another reason. With streamline,
  you don't need source maps to get accurate stack traces. However, you will
  need them if you want to read the original code (e.g. when debugging in 
  the browser).

* **level 5**: doesn't need source maps

  Everything else is in this category. Thats a bit unfair as fibers will never 
  work in a browser.
  
#### Stack trace accuracy

* **level 1**: stack traces are missing

  `suspend` is in this category. When an error happens in one of the async
  functions, this is how the result looks like:  

  ```
  Error: Error happened
    at null._onTimeout (/home/spion/Documents/tests/async-compare/lib/fakes.js:27:27)
    at Timer.listOnTimeout [as ontimeout] (timers.js:105:15)
  ```

  No mention of the original file, `examples/suspend.js`

  Regular exceptions that are not thrown using `iterator.throw` have complete 
  stack traces, so only yield points will suffer.

* **level 2**: stack traces are never correct
  
  In this category: `promiseish.js`. Unfortunately if special care is not taken 
  to preserve a stack trace, it will not be preserved and the promise library
  `when` doesn't do that.
  
* **level 3**: stack traces are correct with native modules

  Bruno Jouhier's generator based solution [galaxy](//github.com/bjouhier/galaxy) 
  is in this category. If you throw an error using `iterator.throw(error)`, the 
  last yield point will not be present in the resulting stack trace. This means 
  you will have no idea which line in your generator is the offending one.

* **level 4**: stack traces are correct with a flag (adding a performance 
  penalty).

  All Q-based solutions are here, even `qasync.js`, which uses generators. Q's
  support for stack traces via `Q.longStackSupport = true;` is excellent:

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
  From previous event:
      at upload (/home/spion/Documents/tests/async-compare/examples/genny.js:38:35)
      at GeneratorFunctionPrototype.next (native)
  ```
  
  However it incurs about 50% memory overhead and is about 5 times slower.


  Catcher is also in this category, with 100% memory overhead and about 
  10 times slower.

* **level 5**: stack traces are always correct

  Streamline and both the original and flattened solutions are in this 
  category. Streamline compiles the file in a way that preserves line numbers,
  making stack traces correct in all cases. Fibers also include the offending
  line in the stack trace.

Ah yes. A table.

| name                | sourcemaps  | stack traces | total | 
|---------------------|------------:|-------------:|------:|
| src-streamline._js  |          4  |            5 |     9 |
| fibrous.js          |          5  |            5 |    10 |
| qasync.js           |          4  |            4 |     8 |
| suspend.js          |          4  |            1 |     5 |
| genny.js            |          4  |            4 |     8 |
| catcher.js          |          5  |            4 |     9 |
| promiseishQ.js      |          5  |            4 |     9 |
| promiseish.js       |          5  |            2 |     7 |
| original.js         |          5  |            5 |    10 |
| flattened.js        |          5  |            5 |    10 |
| promises.js         |          5  |            1 |     6 |

Generators are not exactly the best here, but they're doing well enough thanks
to qasync and genny.

Here is the report from my automated test script that compares the reported 
error line with the actual error line for those cases where the report is 
correct.

| file                     | actual-line | rep-line | distance |
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


### Conclusion

If this essay left you even more confused then before, you're not alone. It
seems hard to make a decision even with all the data available.

My opinion is biased. I love generators, and I've been 
[pushing](https://code.google.com/p/v8/issues/detail?id=2355#c2)
[pretty hard](https://news.ycombinator.com/item?id=5419030) to get them 
included in V8 (maybe a bit too hard). And its obvious from the analysis above 
that they have good characteristics: low code complexity, good performance, 
acceptable debuggability.

More importantly, they will eventually become a part of everyday JavaScript 
with no compilation (except for older browsers) or no native modules required, 
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
for their input on the draft version of this hessay.

Thanks to [jmar777](//github.com/jmar777) for making suspend

<script src="/scripts/jquery.flot.js"></script>
<script src="/scripts/jquery.flot.highlightSeries.js"></script>
