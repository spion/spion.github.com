---
title: The simplest example
layout: nuggets
category: Introduction
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

The second return promises. We can attach two callbacks - one for the value, 
another to handle the error:

```js
fs.readFileAsync(path).done(function(content) {
	// do something with content
}, function(error) {
	// handle error
})
```

## Notes

Whats going on here? 

`fs.readFileAsync(file)` starts a file reading operation. 
That operation is not yet complete at the point when readFile returns. This 
means we can't return the file content. 

But we can still return something: we can return the reading operation itself. 
And that operation is represanted with a promise.

This is sort of like a single-value stream:

```js
net.connect(port).on('data', function(res) { 
	doStuffWith(res); 
}).on('error', function(err) { 
	hadnleError(); 
});
```

So far, this doesn't look that different from regular node callbacks - 
except that you use a second callback for the error (which isn't necessarily 
better). So when does it get better?

Its better because you can attach the callback later if you want. Remember, 
`fs.readFile(file)` *returns* a promise now, so you can put that in a var, 
or return it from a function:

```js
var filePromise = fs.readFile(file);
filePromise.done(function(res) { ... }, function(err) {});
```

Okay, that's still not much of an improvement. How about this then? You can 
attach more than one callback to a promise if you like:

```js
filePromise.done(function(res) { uploadData(url, res); });
filePromise.done(function(res) { saveLocal(url, res); }, function(err), {});
```

Hey, this is beginning to look more and more like streams - they too can be 
piped to multiple destinations. But unlike streams, you can attach more 
callbacks and get the value even *after* the file reading operation completes.
The promise will cache the value.

