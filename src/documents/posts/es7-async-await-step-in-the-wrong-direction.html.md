---
title: ES7 asyc functions, a step in the wrong direction
date: 2015-08-23
layout: post
hidden: true
---

Async functions are a new feature scheduled to become a part of ES7. They build
on top of previous capabilities made available by ES6 - generator functions. At
the moment, they're a [stage 1 proposal for ES7][async-await-github] and
supported by babel / regenerator.

When generator functions were first made available in node, I was
[very exicted][gen-funs]. Finally, a way to write asynchronous JavaScript that
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
We must resort to `if-then-else`

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
apply. We can write a userland library that demands us to always use a
predicate filter when we invoke the catch method

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

Since these constructs are not built in language features but a DSL built on
top of higher order functions, we can impose any restrictions that we want
instead of waiting for tc39 to fix the language.

### Cannot use higher order functions

Because generators and async-await are shallow, you cannot use `yield` or
`await` within lambdas passed to higher order functions. Besides being
very unintuitive, this is also limiting

This is [better explained here][gh-issue-asyncawait] - The example given
there is

```js
async function renderChapters(urls) {
  urls.map(getJSON).forEach(j => addToPage((await j).html));
}
```

and will not work, because you're not allowed to use await from within a nested
function

To understand why, you need to read
[this article][why-no-co-web]. In short: its much harder to implement
deep coroutines so browsers probably wont do it.

### Arrow functions give us more power than ever before

Functional DSLs were very powerful even before JS had short lambda syntax. But
with arrow functions, things got even cleaner. The amount of code one needs to
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

In short: functional DSLs are more powerful than built in constructs,
even though (admittedly) they may take some getting used to.

-----

But this is not why async functions are a step in the wrong direction. The
problems above are not unique to async functions. The same problems apply to
generators: async functions merely inherit them.

However, they also add a new major problem: they destroy the only redeeming
quality that generators had.

## Async functions: another step back

Despite their shortcomings, generator based coroutines have one redeeming
quality: they allow you to redefine the coroutine execution engine. This is
extremely powerful, and I will demonstrate by giving the following example:

Lets say we were given the task to write an issue tracker. The issue author
can specify the issue's title and text, as well as any other issues that are
blocking the solution of the newly entered issue.

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

Our first implementation is simple. `Issue` and `BlockerIssues` are references
to the corresponding tables in an SQL database. Their `insert` methods return
a promise that indicate whether the query has been completed. The query is
executed by a connection pool.

But then, we run into a problem. We don't want to partially save the issue if
some of the data was not inserted successfuly. We want the entire save
operation to be atomic. Fortnuately, SQL databases support this via
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

We can reduce the extent of this issue by writing a base class that
automatically initializes a transaction if one is not passed via the
constructor, and then have `Issues`, `BlockerIssue` etc inherit from this
class. Like many OO solutions, this only spreads the problem across the plate
to make it look smaller but doesn't solve it.

```

class Transactionable {
    constructor(tx) {
        if (tx == null) tx = db.beginTransaction();
    }
}
class IssueService extends Transactionable {
    async saveIssue(data, blockers) {
        issues = new Issues(this.transaction);
        blockerIssues = new BlockerIssues(this.transaction);
        ...
    }
}
class Issues extends Transactionable {
  ...
}
// etc
```

No, this simply doesn't work.

## Generators are better

Generators let us define the execution engine. What if instead of yielding
promises, our engine let us also:

1. Specify additional options which are accessible from within
2. Yield queries. These will be run in the transaction specified in the options
   above
3. Yield other generators: These will be run with the same engine and options
4. Yield promises: These will be handled normally


```js

function* saveIssue(data, blockers) {
    let issue = yield Issues.insert(data);
    for (var blockerId of blockers) {
      yield BlockerIssues.insert({blocker: blockerId, blocks: issue.id});
    }
}

function* (data) {
    return db.query("INSERT ... VALUES", data)
}

BlockerIssue.insert = function* (data) {
    return db.query("INSERT .... VALUES", data)
}
```

Then from the http handler, we can write

```js
var myengine = require('./my-engine');

app.post('/issues/save', function(req, res) {
  myengine.run(saveIssue(data, blockers), {tx: db.beginTransaction()})
});
```

Lets implement this engine:

```js
function run(iterator, options) {
    function runNext(value) {
        var request = iterator.next(value)
        if (isIterator(request)) run(request, options).then(runNext)
        else if (isQuery(request)) query.execWithin(options.tx).then(runNext)
        else if (isPromise(request)) promise.then(runNext);
    }
    runNext()
}
```

The implementation is incomplete, but its quite easy to write using bluebird's
`Promise.coroutine`, which [lets you specify a custom yield handler][bb-735]

But we can add much more! We can `yield` a request to get the current user if
any, so we don't have to thread that throughout our code either. We can even
add support for parallel execution of queries:

```js
let blocked = yield BlockerIssues.where({blocker: blockerId})
yield myengine.parallelQuery(blocked.map(issue => issue.getOwner()))
```

Instead of yielding raw SQL, we can have `getOwner()` return data about the
query:

```js
{table: 'users', id: issue.user_id}
```

and have myengine optimize the execution of parallel queries:

```js
var results = queries.groupBy(table)
.map(t => db.query(`select * from ${t} where id in ?`,
                   [t.items.map(item => item.id)])
          .execWithin(options.tx));
return Promise.all(results).then(results => {
    results.sort(byRequestOrder(queries))
});
```

And voila, we've just implemented a query optimizer. We can do this on the
client too, for GraphQL and other kinds of uses.

Generators are JavaScript's programmable semicolons (well, not as powerful as
monads, but they go quite far). Lets not take away that power by taking away
the programmability. Lets drop async await and write our own interpreters.

[async-await-github]: https://github.com/lukehoban/ecmascript-asyncawait
[gen-funs]: https://spion.github.io/posts/analysis-generators-and-other-async-patterns-node.html
[gh-issue-asyncawait]: https://github.com/tc39/ecmascript-asyncawait/issues/7
[why-no-co-web]: http://calculist.org/blog/2011/12/14/why-coroutines-wont-work-on-the-web/
[bb-735]: https://github.com/petkaantonov/bluebird/issues/735#issuecomment-133699326