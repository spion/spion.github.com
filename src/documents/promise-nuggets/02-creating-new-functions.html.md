---
title: Creating new functions
layout: nuggets
category: Basic examples
level: 2
date: 2007-01-05
---

To create a callback-taking function, add a callback argument to your function.
Then you can pass the callback to another callback-taking function

```js
function readMyFile(callback) {
	fs.readFile('myfile.txt', callback); 
}
```

To create a promise-based function, simply return the promise as a result.

```js
function readMyFile() {
	return fs.readFileAsync('myfile.txt');
}
```

