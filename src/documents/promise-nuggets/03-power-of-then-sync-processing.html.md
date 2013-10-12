---
title: The power of then - sync processing
layout: nuggets
category: Basic examples
date: 2007-01-05
---

Its easy to [just pass the callback or return a promise](02-creating-new-functions.html) 
if we don't need to do other stuff to the result. 

But what if we wanted to do additional processing? What if we want to read a 
single line of a file? Then we'll need to add some code to split the file into 
lines and get the specified line. Lets ses how we can do that.

#### Callbacks

To do this with callbacks, we'll pass our custom callback that does the 
splitting. 

The callback bails-out if there was an error reading the file,
otherwise proceeds to split the content and call the original callback with 
the line content:

```js
function readLine(file, line, callback) {
	fs.readFile(file, function process(err, content) {
		if (err) return callback(err);
		callback(null, content.toString().split('\n')[line]);
	}); 
}
readLine('myfile.txt', 2, function(err, line) {
	// handle error or use line
});
```

#### Promises

To create a promise-based function you can simply return the line from inside
the first .then callback. You'll get a promise for that line outside of the 
callback.

```js
function readLine(file, line) {
	return fs.readFileAsync(file).then(function(res) {
		return res.split('\n')[line];
	});
}
readLine(file, line).then(function(line) {
	// use line
}, function(err) {
	// handle error
});
```

When you call a promise's .then function, a new promise is created and returned 
by `.then`. Its a promise to apply all the operations inside the then callback 
after the original async operation completes, and return the result.


## Notes

In the callback example, we must explicitly handle the error. Since we can't
deal with that error there, we must call the passed callback to pass that error. 

In the promise example, we can skip the error handling function. If we do that,
the error will automatically propagate with the returned promise.
