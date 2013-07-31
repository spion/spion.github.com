---
layout: post
title: Introducing npmsearch
date: 2012-11-27
---

Node's package manager [npm](https://npmjs.org/) is a wonderful tool.

It handles dependencies and versions the right way. It requires simple, easy to write package metadata. It uses a central registry (by default) which makes installing modules easier. The central registry is [CouchDB](http://couchdb.apache.org/) which basically makes it completely transparent and available to everyone.

It does many things right.

But it doesn't do search that well.

    9134 % npm search orm
    npm http GET https://registry.npmjs.org/-
    /all/since?stale=update_after&amp;startkey=1353539108378
    npm http 200 https://registry.npmjs.org/-
    /all/since?stale=update_after&amp;startkey=1353539108378

    NAME                  DESCRIPTION             
    2csv                  A pluggable file format converter into Co...
    abnf                  Augmented Backus-Naur Form (ABNF) parsing.
    accounting            number, money and currency parsing/formatt..
    activerecord          An ORM that supports multiple database sys..
    addressit             Freeform Street Address Parser
    ...
    [snip]
    ...


What just happened here?

Here is what happened: npm search gave us all packages that contain the substring "orm". Anywhere.

You might argue that this works well with bigger words. Its true that results are slightly better with bigger words but they're still not sorted in any meaningful way (alphabetically sorting search results isn't very meaningful)

    9144 % npm search mysql
    NAME                  DESCRIPTION            
    Accessor_MySQL        A MySQL database wrapper, provide ...
    any-db                Database-agnostic connection pool ...
    autodafe              mvc framework for node with mysql ...
    connect-mysql         a MySQL session store for connect ...
    connect-mysql-session A MySQL session store for node.js ... 
    cormo                 ORM framework for Node.js...
    ...
    [snip]
    ...


Hence one of the common activities to do when researching node modules is to go to the #node.js IRC channel and ask the people there for a **good** library that does X.

I decided to make a package that helps with this, called npmsearch. Its a command-line tool that allows you to search the npm registry by keywords and it sorts the results using relevance and the number of downloads that the package has.

Install it using npm:

    [sudo] npm install -g npmsearch

then use it from the command line:

    9147 % npmsearch mysql
    * mysql (6 15862)
         A node.js driver for mysql. It is written in JavaScript, does 
         not  require compiling, and is 100% MIT licensed.
         by Felix Geisendörfer <felix@debuggable.com>

    * mongoose (2 28197)
         Mongoose MongoDB ODM
         by Guillermo Rauch <guillermo@learnboost.com>
         http://github.com/LearnBoost/mongoose.git

    * patio (10 174)
         Patio query engine and ORM
         by Doug Martin <undefined>
         git@github.com:c2fo/patio.git

    * mysql-libmysqlclient (5 1019)
         Binary MySQL bindings for Node.JS
         by Oleg Efimov <efimovov@gmail.com>
         https://github.com/Sannis/node-mysql-libmysqlclient.git

    * db-mysql (3 918)
         MySQL database bindings for Node.JS

    * sql (6 51)
         sql builder
         by brianc <brian.m.carlson@gmail.com>
         http://github.com/brianc/node-sql.git

    * sequelize (2 2715)
         Multi dialect ORM for Node.JS
         by Sascha Depold 

If you want to try it out without installing it, 
[you can try it online](http://npmsearch.docucalc.com/), or you can 
[visit the project page on github](https://github.com/spion/npmsearch)

The implemented keyword search is non-trivial: it applies the 
[Porter Stemmer](http://tartarus.org/martin/PorterStemmer/) to the keywords and
expands the set provided by you with statistically picked commonly co-occuring 
keywords. (e.g. mongo will expand to mongo mongodb)

Results are sorted by a combined factor which incorporates keyword relevance 
and "half-lifed" downloads. You can control the importance of each factor in 
the sorting process using command-line options - and there are many:

* relevance - how big of a factor should keyword relevance be, default 2
* downloads - how big of a factor is the number of downloads, default 0.25
* halflife  - the halflife of downloads e.g. 7 means downloads that are 7 
  days old lose half of their value, default 30
* limit     - number of results to display, default 7
* freshness - update the database if older than "freshness" days, default 1.5

I hope this will help fellow nodesters find their next favorite modules

Have fun!
