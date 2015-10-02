---
layout: post
title: Intuitive JavaScript array filtering function pt2
description: Part 2: higher order functions make powerful DSLs
date: 2012-07-12
---

Last time I wrote about my JavaScript array filtering function `intuitiveFilter`. It had one caveat: namely, the way it handles sub-arrays in the data. It doesn't allow the user to inspect a sub-array without writing a custom filtering function for the sub-array field.

To inspect an array field, one would need a filtering function which takes an array argument and returns true or false. For example, the function might check the contents of the array and see if the elements match certain rules. Depending on the number of elements matching the rules, it would return true or false.


We can already filter the contents of an array with `intuitiveFilter`. That means we can easily use it to inspect the elements of a sub-array. All we need now is to specify how many results we would like to have. The following rules would be useful:

*   there are exactly N elements satisfying the conditions
*   there are at least / at most N elements satisfying the conditions
*   none of the elements satisfy the condition
*   all of the elements satisfy the conditon

Now in order to implement this without modifying the original function, we can use a cool feature of functional languages: a higher order function which returns a function.

Why would we need to return a function?

We left only one extension mechanism for our filter: custom functions for fields. They take the field's value as an argument. They should return true/false depending on it. We called those basic filter functions.

Because we've been given the ability to return a function from another function, we could build a filter function from a rule object and then return it. Lets make a simple example

    function has(rules) {
        return function(item) {
            return intuitiveFilter(item, rules).length > 0
        }
    }

What just happened here? We return a filter function which applies `intiuitiveFilter` to the array `item` and checks if it contains at least one element matching the rules. We've returned exactly what intuitiveFilter could use - a filter function that takes an array item and returns a boolean. It looks as if we wrote a shorter alias to replace some boilerplate code.

Remember the old way to write an array filter?

    intuitiveFilter(arrayArray, {children: function(arr) { 
        return intuitiveFilter(arr, {age:{gt:10}}).length > 0; }
    });

We can now write it like so:

    intuitiveFilter(arrayArray, {children: has({age:{gt:10}})});

Isn't that beautiful? We've removed a lot of boilerplate code and the result is elegant and simple. Admittedly, it has a lot of braces and parentheses, but then again, so does Lisp. Now lets see if we can provide a richer set of filtering rules.

Lets start with some intuitive syntax ideas:


    checkif(array, [ {has: filter,
        atLeast: 2, atMost:2}, ...]);

There are two possible interpretations for the usage of the array here. One of
them would be the equivalent of an `or` operator. For example,
`[{has: {age: {gt:10}}, atLeast:1}, {has: {age: {lt: 8}}, atLeast: 1}]` would
mean the following: has at least one child older than 10 or has at least one
child younger than 8. This is consistent with the meaning of arrays as they are
used in intuitiveFilter. However, in this case, the `or` operator is a lot less
useful to as than the `and` operator. Using the `or` operator on a single field
is already possible through intuitiveFilter. Using the `and` operator isn't,
even though that would be useful for array fields.

We're going to break consistency for the sake of completeness. The rule array
argument of `checkif` will mean `and` instead of `or`, which means that all of
the rules must be satisfied. We're going to have a slightly shaky abstraction
this way, but its going to be a more useful one.

Finally, lets define some shorthand variants:

`checkif(array, {has: filter, atLeast:2});` - if we only need one rule, the
argument can be the rule.

`checkif(array, {has: filter});` - default meaning is "atLeast: 1"

`checkif(array, {none: filter}); ` - shorthand for exactly: 0

`checkif(array, {all: filter}); ` - all elements must satisfy the filter

And here is the code:

    function checkif(rules) {
        if (!$.isArray(rules)) { rules = [ rules ]; }
        for (var k = 0; k < rules.length; ++k) {
            if (rules[k].has && !("atLeast" in rules[k]
                        || "atMost" in rules[k])) {
                rules[k].atLeast = 1;
            }
        }
        var checkLimits = function(filtered, rule) {
            return ((!("atMost" in rule)
                        || filtered <= rule.atMost)
                    && (!("atLeast" in rule)
                        || filtered >= rule.atLeast)
                    && (!("exactly" in rule)
                        || filtered == rule.exactly));
        }
        var checkRule = function(filtered, total, rule) {
            return ((rule.has && checkLimits(filtered, rule))
                    || (rule.none && !filtered)
                    || (rule.all
                        && filtered == total
                        && checkLimits(filtered, rule)))

        }
        return function(array) {
            for (var k = 0; k < rules.length; ++k) {
                if (!checkRule(intuitiveFilter(array,
                        rules[k].has ? rules[k].has
                        : rules[k].none ? rules[k].none
                        : rules[k].all).length,
                    array.length, rules[k])) return false;
            }
            return true;
        }
    }

Some fun examples follow:

    var testArray = [
        {name:"John",  age: 40, children: [{name:"Merlin", age:10}],
      company:{ name: "MegaCorp", employees: 200}},
        {name:"Sue",   age: 30, children: [{name:"Paco", age: 3}],
      company:{ name: "MegaCorp", employees: 200}},
        {name:"Mary", age: 55, children: [
            {name:"Joe", age: 17}, {name:"Moe", age:19}],
            company:{ name: "MegaCorp", employees: 200}},
        {name:"Jack",  age: 20, children: [],
     company:{ name: "MiniCorp", employees: 100}}
    ];
    console.log(intuitiveFilter(testArray,
        {children: checkif({has: { age: { gt: 5}}, atLeast: 1})}));
        // John, Mary

    console.log(intuitiveFilter(testArray,
        {children: checkif({none: { }})})); // Jack

    console.log(intuitiveFilter(testArray,
        {children: checkif({all: { age: {gt: 12}}})})); // Jack and Mary<

Note: "all" will always return true for empty arrays, as there are no items that
don't satisfy the imposed conditions. This can be modified by adding
`atLeast: 1`:

    // Just Mary
    console.log(intuitiveFilter(testArray,
        {children: checkif({all: { age: {gt: 12}}, atLeast: 1})}));

And now we've extended our filter language with rich syntax to deal with sub-arrays without touching the original filtering function. Wasn't that great?