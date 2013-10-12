---
title: The simplest example
layout: nuggets
category: Basic examples
date: 2007-01-05
---

Whats the main difference between callback-based functions and promise-based 
functions?

The first call the callback with the error and the result:

```js
fs.readFile(path, function(error, content) {
	// handle error or do something with content
})
```

The second return promises. We can then attach two callbacks
to that promise - one to handle success, one to handle errors.

```js
fs.readFileAsync(path).then(function(content) {
	// do something with content
}, function(error) {
	// handle error
})
```

## Notes

We can split the promise example like so:

```js
var promiseForContent = fs.readFileAsync(path);

promiseForContent.then(function(content) {
	// handle result	
}, function(error) {
	// handle errors
});
```

Ah. Now we can see the main difference between callbacks and promises.

When we call the first file reading function, all traces that it was
ever called disappear until the callback is called. We have no value to 
represent the reading operation so we can't put it in a variable or pass it 
around to other functions.

In promise-returning functions, the function immediately returns the operation
as a promise. You can put the operation in a variable, do some processing, 
attach a callback or pass it around to other functions.
