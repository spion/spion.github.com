---
title: Doing things in series (async.waterfall)
layout: nuggets
category: Multiple operations
date: 2007-01-05
---

We can [run things in parallel](10-doing-things-in-parallel.html), but what if 
we want to run things in series? 

Example: read a file, transform it using a transformation service that doesn't 
support streams, then write the transformed file somewhere else.


#### Callbacks

[caolan's async](//github.com/caolan/async) gives us `async.waterfall`

Assuming that 

```js
service.transform = function(string, callback)
```

```js
function transformFile(inPath, outPath, callback) {
	async.waterfall([
		fs.readFile.bind(fs, file1, 'utf8'),	
		service.transform,
		fs.writeFile
	], callback);
}
transformFile(input, output, function(err) {
	if (!err) console.log("All ok!");
})
```

The callback is called with no error and an array of results after all 
operations are complete, or when the first error is encountered.

#### Promises

Thanks to `.then`'s behavior when returning a promise, we can chain async 
operations without any helper tools:

```js
function transformFile(input, output) {
	return fs.readFileAsync(input, 'utf8')
		.then(service.transformAsync)
		.then(fs.writeFileAsync); 
}
transformFile(fileIn, fileOut).done(function() {
	console.log("All ok!");
}, function(err) { 
	console.error(err);
});
```

The resulting promise is fulfilled when all the promises in the array are
fulfilled or is rejected with an error when the first error is encountered.

## Notes

async.parallel expects functions that take a single callback argument. 
`Function.bind()` allows us to create such functions by binding some of the
arguments with predefined values. Therefore 

```js
fs.readFile.bind(fs, file1)
```

returns a function that works like this:

```js
function(callback) { return fs.readFile(file1, callback); }
```

