Browser Harness
===============

### What is this?

* **Simple** - Use jQuery to interact with items on the page and check expected conditions
* **Fast** - Can perform 50+ actions per second in the browser
* **Cross-browser** - Tests run on any modern web browser, and even some old ones
* **Flexible** - Write tests in whatever node.js framework you want. Interact with your web site / app with javascript.

### Browser Support

```
              Tested    "Should work"
Chrome 4+        ✓
Firefox 3+       ✓
Safari 3+        ✓
Opera 10.61+                  ✓
IE 5.5+                       ✓
IE 8+            ✓
iOS              ✓
Android                       ✓
PhantomJS        ✓
SlimerJS                      ✓
Other                         ✓
```

### Limitations

Due to the way browser harness interacts with the browser, there are a few limitations.

* Requires [harness.html](https://github.com/scriby/browser-harness/blob/master/client/harness.html) be served from the domain of the site/application being tested
    * Warning: Be careful not to include harness.html in production, as it opens a potential cross-site scripting attack vector
* Can only interact with pages hosted from within a single domain (barring some CORS configuration)
* Can not upload files from the local computer (but should be able to spoof file uploads via javascript)
* Can not interact directly with cookies that have the httponly flag

### How does it work?

* Your tests include the browser-harness module and tell it to start listening for connections
* Your test (or some outside process) opens a browser to http://your-test-site/path/to/harness.html?host=path-to-the-browser-harness-server
* Harness.html connects to the browser harness server, and begins running your tests
* Your tests will control a browser running within an iframe in harness.html

### See it in action

An example of using the project can be found under the [browser-harness-bootstrap-tests](https://github.com/scriby/browser-harness-bootstrap-tests) repository.

#### Screencasts

* [Tests running in Chrome](http://screencast.com/t/0TaRAmUD)
* [Tests running in Firefox](http://screencast.com/t/n6hxBjMhsh)
* [Tests running in Safari](http://screencast.com/t/3HmnMfMC)
* [Tests running in PhantomJS](http://screencast.com/t/Wd4q5kSPsT)

### Roadmap


* More streamlined browser integration (windows)
* Handle alert, input, etc.
* Cookie handling
* SlimerJS integration
* Ability to take screen shots with phantomjs / slimerjs (possible with others?)
* Switch out NowJS support for plain Socket.IO for easier Windows support
* Better support detecting javascript errors in the browser
* Build in support for other event types like right click, mouse down, mouse up, keys, etc.
* More robust error handling
* See what can be done to make it easier to interact with file upload controls
* Documentation