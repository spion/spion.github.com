---
title: ES7 async functions - a step in the wrong direction
description: >
  ES7 will include async/await, a new feature that builds on top of ES6
  promises. Is it the right solution to the async problem? Or is the
  lack of generality a step in the wrong direction?
date: 2015-08-23
layout: post.pug
hidden: false
---

Async functions are a new feature scheduled to become a part of ES7. They build
on top of previous capabilities made available by ES6 (promises), letting you
write async code as though it were synchronous. At the moment, they're a
[stage 1 proposal for ES7][async-await-github] and supported by babel /
regenerator.

When generator functions were first made available in node, I was
[very excited][gen-funs]. Finally, a way to write asynchronous JavaScript that
doesn't descend into callback hell! At the time, I was unfamiliar with promises
and the language power you get back by simply having async computations be
first class values, so it seemed to me that generators are the best solution
available.

Turns out, they aren't. And the same limitations apply for async functions.


### Predicates in catch statements

With generators, thrown errors bubble up the function chain until a catch
statement is encountered, much like in other languages that support exceptions.
On one hand, this is convenient, but on the other, you never know what you're
catching once you write a catch statement.

JavaScript catch doesn't support any mechanism to filter errors. This
limitation isn't too hard to get around: we can write a function `guard`

```js
function guard(e, predicate) {
  if (!predicate(e)) throw e;
}
```

and then use it to e.g. only filter "not found" errors when downloading an
image

```js
try {
    await downloadImage(url);
} catch (e) { guard(e, e => e.code == 404);
    handle404(...);
}
```

But that only gets us so far. What if we want to have a second error handler?
We must resort to using `if-then-else`, making sure that we don't forget to
rethrow the error at the end

```js
try {
    await downloadImage(url);
} catch (e) {
    if (e.code == 404)  {
        handle404(...)
    } else if (e.code == 401) {
        handle401(...);
    } else {
        throw e;
    }
}
```

Since promises are a userland library, restrictions like the above do not
apply. We can write our own promise implementation that demands the use of a
predicate filter:

```js
downloadImage(url)
.catch(e => e.code == 404, e => {
    handle404(...);
})
.catch(e => e.code == 401, e => {
    handle401(...)
})
```

Now if we want all errors to be caught, we have to say it explicitly:

```js
asyncOperation()
.catch(e => true, e => {
    handleAllErrors(...)
});
```

Since these constructs are not built-in language features but a DSL built on
top of higher order functions, we can impose any restrictions we like instead
of waiting on TC39 to fix the language.

### Cannot use higher order functions

Because generators and async-await are shallow, you cannot use `yield` or
`await` within lambdas passed to higher order functions.

This is [better explained here][gh-issue-asyncawait] - The example given
there is

```js
async function renderChapters(urls) {
  urls.map(getJSON).forEach(j => addToPage((await j).html));
}
```

and will not work, because you're not allowed to use await from within a nested
function. The following will work, but will execute in parallel:

```js
async function renderChapters(urls) {
  urls.map(getJSON).forEach(async j => addToPage((await j).html));
}
```

To understand why, you need to read [this article][why-no-co-web]. In short:
its much harder to implement deep coroutines so browser vendors probably wont
do it.

Besides being very unintuitive, this is also limiting. Higher order functions
are succint and powerful, yet we cannot *really* use them inside async
functions. To get sequential execution we have to resort to the clumsy built
in for loops which often force us into writing ceremonial, stateful code.

### Arrow functions give us more power than ever before

Functional DSLs were very powerful even before JS had short lambda syntax. But
with arrow functions, things get even cleaner. The amount of code one needs to
write can be reduced greatly thanks to short lambda syntax and higher order
functions. Lets take the motivating example from the async-await proposal

```js
function chainAnimationsPromise(elem, animations) {
    var ret = null;
    var p = currentPromise;
    for(var anim of animations) {
        p = p.then(function(val) {
            ret = val;
            return anim(elem);
        })
    }
    return p.catch(function(e) {
        /* ignore and keep going */
    }).then(function() {
        return ret;
    });
}
```

With bluebird's `Promise.reduce`, this becomes

```js
function chainAnimationsPromise(elem, animations) {
  return Promise.reduce(animations,
      (lastVal, anim) => anim(elem).catch(_ => Promise.reject(lastVal)),
      Promise.resolve(null))
  .catch(lastVal => lastVal);
}
```

In short: functional DSLs are now more powerful than built in constructs,
even though (admittedly) they may take some getting used to.

-----

But this is not why async functions are a step in the wrong direction. The
problems above are not unique to async functions. The same problems apply to
generators: async functions merely inherit them as they're very similar.

Async functions also go another step backwards.

## Loss of generality and power

Despite their shortcomings, generator based coroutines have one redeeming
quality: they allow you to redefine the coroutine execution engine. This is
extremely powerful, and I will demonstrate by giving the following example:

Lets say we were given the task to write the save function for an issue
tracker. The issue author can specify the issue's title and text, as well
as any other issues that are blocking the solution of the newly entered issue.

Our initial implementation is simple:

```js
async function saveIssue(data, blockers) {
    let issue = await Issues.insert(data);
    for (let blockerId of blockers) {
      await BlockerIssues.insert({blocker: blockerId, blocks: issue.id});
    }
}

Issues.insert = async function(data) {
    return db.query("INSERT ... VALUES", data).execWithin(db.pool);
}

BlockerIssue.insert = async function(data) {
    return db.query("INSERT .... VALUES", data).execWithin(db.pool);
}
```

`Issue` and `BlockerIssues` are references to the corresponding tables in an
SQL database. Their `insert` methods return a promise that indicate whether
the query has been completed. The query is executed by a connection pool.

But then, we run into a problem. We don't want to partially save the issue if
some of the data was not inserted successfuly. We want the entire save
operation to be atomic. Fortunately, SQL databases support this via
transactions, and our database library has a transaction abstraction. So we
change our code:

```js
async function saveIssue(data, blockers) {
    let tx = db.beginTransaction();
    let issue = await Issue.insert(tx, data);
    for (let blockerId of blockers) {
      await BlockerIssues.insert(tx, {blocker: blockerId, blocks: issue.id});
    }
}

Issues.insert = async function(tx, data) {
    return db.query("INSERT ... VALUES", data).execWithin(tx);
}

BlockerIssue.insert = async function(tx, data) {
    return db.query("INSERT .... VALUES", data).execWithin(tx);
}
```

Here, we changed the code in two ways. Firstly, we created a transaction within
the saveIssue function. Secondly, we changed both insert methods to take this
transaction as an argument.

Immediately we can see that this solution doesn't scale very well. What if
we need to use `saveIssue` as a part of a larger transaction? Then it has to
take a transaction as an argument. Who will create the transactions? The top
level service. What if the top level service becomes a part of a larger
service? Then we need to change the code again.

We can reduce the extent of this problem by writing a base class that
automatically initializes a transaction if one is not passed via the
constructor, and then have `Issues`, `BlockerIssue` etc inherit from this
class.

```js
class Transactionable {
    constructor(tx) {
        this.transaction = tx || db.beginTransaction();
    }
}
class IssueService extends Transactionable {
    async saveIssue(data, blockers) {
        issues = new Issues(this.transaction);
        blockerIssues = new BlockerIssues(this.transaction);
        ...
    }
}
class Issues extends Transactionable { ... }
class BlockerIssues extends Transactionable { ... }
// etc
```

Like many OO solutions, this only spreads the problem across the plate to make
it look smaller but doesn't solve it.

## Generators are better

Generators let us define the execution engine. The iteration is driven by the
function that consumes the generator, which decides what to do with the yielded
values. What if instead of only allowing promises, our engine let us also:

1. Specify additional options which are accessible from within
2. Yield queries. These will be run in the transaction specified in the options
   above
3. Yield other generator iterables: These will be run with the same engine and
   options
4. Yield promises: These will be handled normally

Lets take the original code and simplify it:

```js

function* saveIssue(data, blockers) {
    let issue = yield Issues.insert(data);
    for (var blockerId of blockers) {
      yield BlockerIssues.insert({blocker: blockerId, blocks: issue.id});
    }
}

Issues.insert = function* (data) {
    return db.query("INSERT ... VALUES", data)
}

BlockerIssue.insert = function* (data) {
    return db.query("INSERT .... VALUES", data)
}
```

From our http handler, we can now write

```js
var myengine = require('./my-engine');

app.post('/issues/save', function(req, res) {
  myengine.run(saveIssue(data, blockers), {tx: db.beginTransaction()})
});
```

Lets implement this engine:

```js
function run(iterator, options) {
    function id(x) { return x; }
    function iterate(value) {
        var next = iterator.next(value)
        var request = next.value;
        var nextAction = next.done ? id : iterate;

        if (isIterator(request)) {
            return run(request, options).then(nextAction)
        }
        else if (isQuery(request)) {
            return request.execWithin(options.tx).then(nextAction)
        }
        else if (isPromise(request)) {
            return request.then(nextAction);
        }
    }
    return iterate()
}
```

The best part of this change is that we did not have to change the original
code at all. We didn't have to add the transaction parameter to every function,
to take care to properly propagate it everywhere and to properly create the
transaction. All we needed to do is just change our execution engine.

And we can add much more! We can `yield` a request to get the current user
if any, so we don't have to thread that through our code. Infact we can
implement [continuation local storage][cls] with only a few lines of code.

Async generators are often given as a reason why we need async functions. If
yield is already being used as await, how can we get both working at the same
time without adding a new keyword? Is that even possible?

Yes. Here is a simple proof-of-concept.
[github.com/spion/async-generators](https://github.com/spion/async-generators).
All we needed to do is change the execution engine to support a mechanism
to distinguish between awaited and yielded values.

Another example worth exploring is a query optimizer that supports aggregate
execution of queries. If we replace `Promise.all` with our own implementaiton
caled `parallel`, then we can add support for non-promise arguments.

Lets say we have the following code to notify owners of blocked issues in
parallel when an issue is resolved:

```js
let blocked = yield BlockerIssues.where({blocker: blockerId})
let owners  = yield engine.parallel(blocked.map(issue => issue.getOwner()))

for (let owner of owners) yield owner.notifyResolved(issue)
```

Instead of returning an SQL based query, we can have `getOwner()` return data
about the query:

```js
{table: 'users', id: issue.user_id}
```

and have `engine` optimize the execution of parallel queries, by sending
a single query per table rather then per item.

```js
if (isParallelQuery(query)) {
    var results = _(query.items).groupBy('table')
      .map((items, t) => db.query(`select * from ${t} where id in ?`,
                                  items.map(it => it.id))
                .execWithin(options.tx)).toArray();
    Promise.all(results)
        .then(results => results.sort(byOrderOf(query.items)))
        .then(runNext)
}
```

And voila, we've just implemented a query optimizer. It will fetch all issue
owners with a single query. If we add an SQL parser into the mix, it should
be possible to rewrite real SQL queries.

We can do something similar on the client too with GraphQL queries by aggregating
multiple individual queries.

And if we add support for iterators, the optimization becomes deep:
we would be able to aggregate queries that are several layers within other
generator functions,  In the above example, `getOwner()` could be another
generatator which produces a query for the user as a first result. Our
implementation of `parallel` will run all those getOwner() iterators and
consolidate their first queries into a single query. All this is done without
those functions knowing anything about it (thus, without breaking modularity).

Async functions cant let us do any of this. All we get is a single execution
engine that only knows how to await promises. To make matters worse, thanks
to the unfortunately short-sighted [recursive thenable assimilation](https://esdiscuss.org/topic/a-challenge-problem-for-promise-designers-was-re-futures)
design decision, we can't simply create our own thenable that will support
the above extra features. If we try to do that, we will be
[unable to safely use it with Promises](https://github.com/Reactive-Extensions/RxJS/issues/470).
We're stuck with what we get by default in async functions, and
thats it.

Generators are JavaScript's programmable semicolons. Lets not take away that
power by taking away the programmability. Lets drop async/await and write our
own interpreters.

[async-await-github]: https://github.com/lukehoban/ecmascript-asyncawait
[gen-funs]: https://spion.github.io/posts/analysis-generators-and-other-async-patterns-node.html
[gh-issue-asyncawait]: https://github.com/tc39/ecmascript-asyncawait/issues/7
[why-no-co-web]: http://calculist.org/blog/2011/12/14/why-coroutines-wont-work-on-the-web/
[bb-735]: https://github.com/petkaantonov/bluebird/issues/735#issuecomment-133699326
[cls]: https://github.com/othiym23/node-continuation-local-storage
