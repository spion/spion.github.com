---
layout: post.pug
title: Intuitive JavaScript array filtering function pt1
description: Lets build a filtering and matching DSL
date: 2012-07-07
---

When dealing with large JSON arrays on the client side or in
[node.js](http://nodejs.org/), one of our tasks might be to filter
them on the client side before displaying them.
[Array.filter](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/filter "Array.filter")
exists since JavaScript 1.6, however it seems kinda dry: all filters must be
functions, even some really common filters such as matching text with a regular
expression, checking if a number is within a range, checking if an enumeration
has a certain value. Consider the following:


    var testArray = [
            {name:"John",  age: 40, children: 2,
                company: { name: "MegaCorp", employees: 200}},
            {name:"Sue",   age: 30, children: 1,
                company:{ name: "MegaCorp", employees: 200}},
            {name:"Mary",  age: 55, children: 3,
                company:{ name: "MegaCorp", employees: 200}},
            {name:"Jack",  age: 20, children: 0,
                company:{ name: "MiniCorp", employees: 100}}];

    // Using a for loop
    var filtered = [];
    for (var k = 0; k < testArray.length; ++k) {
        var item = testArray[k];
        if (item.age == 40 && item.age == 30) filtered.push(item);
    }

    // Using Array.filter
    testArray.filter(function(item) {
        return item.age == 40 || item.age == 30
    }); // returns John


The Array.filter variant is around two times shorter than the for loop variant.
It also looks much cleaner: the anonymous function is the filter which is
called on each item to check if it should get through the filter or not. We can
call `Array.filter` with various kinds of "filter functions". Should be good
enough for all uses, right?

Not so, at least not when you have lots of filters and you want them to be as
short as possible to write. Or if you want to combine multiple filter functions
from various sources and the items in the data array are fairly complex.

Lets say that we have a complex filter function for the company object and a
simple regex name filter from elsewhere and we need to combine them. We would
have to write the following:


    testArray.filter(function(item) {
        return /^J.+$/.test(item.name)
            &&  complexFilter(item.company); });

However, now we cannot easily replace `complexFilter` for the company with
`anotherComplexFilter`. We have to write code - to write a different anonymous
function and use it instead.

Now imagine having multiple different `complexFilters`. Soon enough you will
write the following function

    intiutiveFilterBeta = function(someArray, filters) {
        return someArray.filter(function(item) {
            for (var k = 0; k < filters.length; ++k) {
                if (!filters[k](item)) return false;
            }
            return true;
        }
    }

which will enable you to combine different complex filters into a filter array,
essentially implementing the `and` operator.

At about this point you will probably realize that you are missing the `or`
operator. What if you wish to filter all companies which `complexCompanyFilter1
or complexCompanyFilter2` ? If you are like me, right now you are probably
working on a DSL (domain specific language) in your head, a DSL which reminds
you of SQL. You might also start thinking that this is going a bit over the top.

However, if you look closely you will notice certain peculiarity about the
`and` operator: you do not really need to use `and` on two or more filters
which are working on the same field. For example, you might want to match
`1 or 2` _children_, but never both `1 and 2` _children_ - it just doesnt
make sense. You might also want to have a "between" filter for _age_, but you
would not exactly want to `and` two between filters. Instead of `between 30 and
50 and between 40 and 60` you would simply write a `between 40 and 50` filter.

This observation seems to hold true for all primitive values except for strings.
That doesnt really matter because we can easily filter strings with a tool made
to do exactly that: regular expressions.

I decided to try and make a hopefully intuitive and readable yet still powerful
filter function based on the observations above. It should enable some common
primitive tests to be easily written without writing new functions. It should
support the AND and OR operators intuitively and without writing functions in
the most common cases. Finally, it should still enable writing custom filter
functions. I came up with this:


    function intuitiveFilter(array, filter) {
        var itemFilter = function (iFilter, item) {
            if (iFilter instanceof Function) {
                return iFilter(item);
            }
            else if (iFilter instanceof Array) {
                for (var k = 0; k < iFilter.length; ++k) {
                    if (itemFilter(iFilter[k], item)) return true;
                }
                return false;
            }
            else if (typeof(item) == 'string' && iFilter
                && iFilter.test && iFilter.exec) {
                return iFilter.test(item);
            }
            else if (item === item + 0 && iFilter
                && (iFilter.lt || iFilter.gt || iFilter.le
                || iFilter.ge)) {
                // item is number and filter contains min-max
                return ((!("lt" in iFilter) || item <  iFilter.lt)
                    &&  (!("gt" in iFilter) || item >  iFilter.gt)
                    &&  (!("le" in iFilter) || item <= iFilter.le)
                    &&  (!("ge" in iFilter) || item >= iFilter.ge));
            }
            else if (typeof (iFilter) === "object") {
                for (var key in iFilter) {
                    if (!itemFilter(iFilter[key], item[key]))
                        return false;
                }
                return true;
            }
            return (iFilter == item);
        };
        var filtered = [];
        for (var k = 0; k < array.length; ++k) {
            if (itemFilter(filter, array[k]))
                filtered.push(array[k]);
        }
        return filtered;
    }


And here are some neat ways to use it:


    var testArray = [
            {name:"John",  age: 40, children: 2,
                company:{ name: "MegaCorp", employees: 200}},
            {name:"Sue",   age: 30, children: 1,
                company:{ name: "MegaCorp", employees: 200}},
            {name:"Mary",  age: 55, children: 3,
                company:{ name: "MegaCorp", employees: 200}},
            {name:"Jack",  age: 20, children: 0,
                company:{ name: "MiniCorp", employees: 100}}
    ];

    console.log(intuitiveFilter(testArray,
        {name:/J.+/, age: {lt: 30}})); // Jack, but not John
    console.log(intuitiveFilter(testArray,
        {age: [{gt: 15, le: 20}, {gt: 50}]})); // Jack and Mary
    console.log(intuitiveFilter(testArray,
        {children: [0,1]})); // Jack, Sue

    console.log(intuitiveFilter(testArray,
        {company: {name: "MegaCorp"}})) // all except Jack
    console.log(intuitiveFilter(testArray,
        {age: function(a) { return a % 10 == 0 }})); // all except Mary
    console.log(intuitiveFilter(testArray,
        [{age: 30 }, {company:{name:"MiniCorp"}}])); // Sue and Jack


The function is designed to make most filters look like a part of an item from
the array that is being filtered. The examples demonstrate some possible uses.

In the first example-set, the first one is a classic **and** operator with a
regex and a numeric operator for age. The second example showcases the simple
numeric support. The third example is the purest form of the **or** operator on
the number of children. Similar filters could easily be written for the string
name with regular expressions, for example: `{name:[/M.+/, /S.+/]}`. Isnt that
concise and lovely?

In the second set, the example `{company: {name: "MegaCorp"}}` showcases the
ability of the filter to go deeper in the object. The second example shows the
ability of the filter to use custom functions anywhere. The last example
demonstrates the ability to use the **or** operator on filters which work on
different fields.

The function would've been perfect if it wasn't for a caveat: it cannot check
into arrays the same way it can check into an object. For example, if we had
the following data:

    var arrayArray = [{name:"John",  age: 40,
        children: [{name:"Joe", age:12}, {name:"Jane", age:10}],
        company:{ name: "MiniCorp", employees: 100}}]

we wouldn't have a way to test the contents of the sub-array _children_ without
writing a function:

    intuitiveFilter(arrayArray, {children: function(arr) {
        return childrenArrayFilter(arr, {age:{gt:10}}).length > 0; }
    });

This caveat isnt hard to fix. However, I have decided that I will leave it
unfixed for now: let the fix be an exercise for the reader. If this code
generates some interest I will supply my fix later. The fix can even be added
without modifying the original function.

