module.exports = function(BasePlugin) {

    var util    = require('util')
    var RSS     = require('rss')
    var fs      = require('fs')

    util.inherits(MyRssPlugin, BasePlugin)
    function MyRssPlugin() {
        BasePlugin.apply(this, arguments)
    }

    MyRssPlugin.prototype.name = "myrss"
    MyRssPlugin.prototype.config = {
        "default": {
            "collection": 'html',
            "url": '/rss.xml'
        }
    };
    MyRssPlugin.prototype.writeCollection = function(configName, collectionConfig) {
        var docpad, feed, feedCollection, feedPath, site;
        docpad = this.docpad;
        site = docpad.getTemplateData().site;
        feedCollection = docpad.getCollection(collectionConfig.collection);
        feedPath = docpad.getConfig().outPath + collectionConfig.url;
        feed = new RSS({
          title: site.title,
          description: site.description,
          site_url: site.url,
          feed_url: site.url + collectionConfig.url,
          author: site.author,
          pubDate: site.date.toISOString()
        });
        var items = [];
        feedCollection.forEach(function(document) {
            items.push(document)
        })
        items.sort(function(doc1, doc2) {
            return doc1.date > doc2.date ?  1 :
                   doc1.date < doc2.date ? -1 : 0;
        }).slice(0, 10).forEach(function(document) {
          document = document.toJSON();
          if (document.hidden) return;
          return feed.item({
            title: document.title,
            author: document.author,
            description: document.description || document.content,
            url: site.url + document.url,
            date: document.date.toISOString()
          });
        });

        fs.writeFileSync(feedPath, feed.xml(true));
        return docpad.log('debug', "Wrote the RSS " + configName + " xml file to: " + feedPath);
      };

      MyRssPlugin.prototype.writeAfter = function() {
        var collectionConfig;
        var ref = this.getConfig();
        var results = [];
        for (var configName in ref) if (ref.hasOwnProperty(configName)) {
          collectionConfig = ref[configName];
          results.push(this.writeCollection(configName, collectionConfig));
        }
        return results;
      };

    return MyRssPlugin;
}
