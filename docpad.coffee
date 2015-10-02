# DocPad Configuration File
# http://docpad.org/docs/config

# Define the DocPad Configuration
docpadConfig = {
  growl: false

  collections: {
    posts: (database) ->
      @getFilesAtPath("posts")
      #.sort((p1, p2) ->
      #    p2.date.getTime() - p1.date.getTime()
      #).filter(p -> !p.hidden)
  }

  plugins: {
    ghpages: {
      deployBranch: 'master'
    }
    myrss: {
      default: {
        collection: 'posts',
        url: '/rss.xml'
      }
    }

  }

  templateData: {
    site: {url: 'https://spion.github.io'}
  }
	# ...
}

# Export the DocPad Configuration
module.exports = docpadConfig

