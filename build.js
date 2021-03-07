#!/usr/bin/env node

var Metalsmith  = require('metalsmith');

var collections = require('metalsmith-collections');
var wjade       = require('metalsmith-pug')
var layouts     = require('metalsmith-layouts');
// var permalinks  = require('metalsmith-permalinks');
var less        = require('metalsmith-less')

var markdown = require("metalsmith-markdownit");
var math = require("markdown-it-math");

var mcharts = require('markdown-it-charts')

var katex = require("katex");
var hljs = require('highlight.js');

var md = markdown("default", {
  html: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(lang, str).value;
      } catch (__) {}
    }

    return ''; // use external default escaping
  }
});

md.parser.use(mcharts)

md.parser.use(math, {
  inlineOpen: '$[',
  inlineClose: ']$',
  blockOpen: '$$',
  blockClose: '$$',
  inlineRenderer: str => katex.renderToString(str),
  blockRenderer: str => katex.renderToString(str, {displayMode: true})
});


Metalsmith(__dirname)         // __dirname defined by node.js:
                              // name of current working directory
  .metadata({                 // add any variable you want
                              // use them in layout-files
    sitename: "A hint of chaos",
    siteurl: "http://spion.github.io/",
    description: "spion's personal website / blog.",
  })
  .source('./src/site') // source directory
  .destination('./build')     // destination directory
  .clean(true)                // clean destination before
  .use(collections({          // group all blog posts by internally
    posts: 'posts/**/*.md',
  }))                         // use `collections.posts` in layouts
  .use(md)                    // transpile all md into html
  .use(less())
  .use(files => {
    Object.keys(files).forEach(path => {
      files[path].contentsWithoutLayout = files[path].contents
    })
  })
  .use(layouts({
    directory: './src/layouts'
  }))             // wrap layouts around html
  .use(wjade({ useMetadata: true }))
  .build(function(err) {      // build process
    if (err) {
      console.log(err);
      console.log(err.file)
    }
  });