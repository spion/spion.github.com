---
title: Additional async processing
layout: nuggets
category: Basic examples
level: 4
date: 2007-01-05
---

In the previous example we learned how to apply sync transformations to the
result. But what if the operation is async? 

For example, what if we want to read a file, then copy it to another 
destionation?


#### Callbacks

With callbacks we can nest the second operation, passing it the original
callback

```js
function copyFile(source, destination, callback) {
	fs.readFile(file, function process(err, content) {
		if (err) return callback(err);
		fs.writeFile(destination, content, callback);
	}); 
}
```

#### Promises

With promises, we can return the second operation from inside `.then`

```js
function copyFile(source, destination) {
	return fs.readFileAsync(file).then(function(res) {
		return fs.writeFile(source, destination);
	});
}
```

And we get a promise for the same thing outside of `.then`
---

## Notes

In the callback example, we must explicitly handle the error. Since we can't
deal with that error there, we must call the passed callback to pass that error. 

In the promise example, we can skip the error handling function. If we do that,
the error will automatically propagate with the returned promise.
