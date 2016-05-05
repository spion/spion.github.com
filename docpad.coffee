# DocPad Configuration File
# http://docpad.org/docs/config

# Define the DocPad Configuration
docpadConfig = {
  growl: false

  collections: {
    posts: (database) ->
      @getFilesAtPath("posts")
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

