var events = require('events');

var config = require('./config.js');

//Use asyncblock to manage flow control if it's available
var asyncblock = process.__asyncblock_included__;

var WindowProxy = require('./window_proxy.js');
var ElementProxy = require('./element_proxy.js');
var utility = require('./utility.js');

var Driver = function(now, focusedWindow){
    this.now = now;
    this.focusedWindow = focusedWindow;
    this.events = new events.EventEmitter();
};

Driver.prototype._convertArguments = function(args){
    for(var i = 0; i < args.length; i++){
        var item = args[i];

        if(item && item.isElementArray){
            var elements = item.elements || [];
            elements.__proto__ = ElementProxy.prototype;
            elements.driver = this;

            args[i] = elements;
        } else if(item && item.isElementProxy){
            var array = [ item ];
            array.__proto__ = ElementProxy.prototype;
            array.driver = this;

            args[i] = array;
        }
    }
};

Driver.prototype.exec = function(args, callback){
    var self = this;
    var func, funcArgs;

    //Use asyncblock fibers if it is available
    if(asyncblock && callback == null){
        var flow = asyncblock.getCurrentFlow();

        if(flow){
            return flow.sync( this.exec(args, flow.add()) );
        }
    }

    if(args.func){
        func = args.func;
        funcArgs = args.args;
    } else {
        func = args;
    }

    var cbOnce = _callOnce(callback);

    var timeoutCheck = setTimeout(function(){
        cbOnce(new Error('exec timed out (' + config.timeoutMS + ')'));
    }, config.timeoutMS);

    this.now.exec(
        {
            func: func.toString(),
            args: funcArgs,
            focusedWindow: this.focusedWindow
        },

        function(){
            clearTimeout(timeoutCheck);
            self._convertArguments(arguments);

            cbOnce && cbOnce.apply(null, arguments);
        }
    );
};

Driver.prototype.setUrl = function(url, callback){
    if(asyncblock && callback == null){
        var flow = asyncblock.getCurrentFlow();

        if(flow){
            return flow.sync( this.setUrl(url, flow.add()) );
        }
    }

    if(callback == null){
        throw new Error('callback is required');
    }

    this.now.setUrl(url, callback);
};

Driver.prototype.reuseBrowser = function(harnessUrl, serverUrl){
    if(harnessUrl){
        harnessUrl = utility.constructHarnessUrl(harnessUrl, serverUrl);
    }

    this.now.reuseBrowser(harnessUrl);
};

Driver.prototype.waitFor = function(args, callback){
    var self = this;
    var startTime, func, timeout, exec, funcArgs, timeoutError, inBrowser;
    if(typeof args === 'object'){
        func = args.condition;
        startTime = args.startTime || new Date();
        timeout = args.timeoutMS || config.timeoutMS;
        exec = args.exec;
        funcArgs = args.args;
        timeoutError = args.timeoutError;
        inBrowser = args.inBrowser;
    } else {
        func = args;
        startTime = new Date();
        timeout = config.timeoutMS;
    }

    //Use asyncblock fibers if it is available
    if(asyncblock && callback == null){
        var flow = asyncblock.getCurrentFlow();

        if(flow){
            return flow.sync( this.waitFor(args, flow.add()) );
        }
    }

    if(callback == null){
        throw new Error('callback is required');
    }

    var _resultHandler = function(err, result){
        if(err && (!err.message || err.message.indexOf('exec timed out') < 0)){
            return callback(err);
        }

        if(result){
            return callback();
        } else {
            if(new Date() - startTime < timeout){
                setTimeout(function(){
                    //Need to re-create the asyncblock context
                    (asyncblock || function(fn){ fn(); })(function(){
                        self.waitFor({
                            condition: func,
                            timeoutMS: timeout,
                            startTime: startTime,
                            args: funcArgs,
                            timeoutError: timeoutError,
                            inBrowser: inBrowser
                        }, callback);
                    });
                }, config.retryMS);
            } else {
                if(!timeoutError) {
                    return callback(new Error('waitFor condition timed out (' + timeout + ')'));
                } else {
                    return callback(new Error('waitFor condition timed out (' + timeout + '): ' + timeoutError));
                }
            }
        }
    };

    if(inBrowser){
        this.exec({ func: func, args: funcArgs }, _resultHandler);

        if(exec){
            this.exec({ func: exec, args: funcArgs }, function(err){
                if(err){
                    return callback(err); //todo: prevent double callback
                }
            });
        }
    } else {
        //This exec needs to occur "out-of-process" or it'll block waiting on the condition when asyncblock is in use
        process.nextTick(function(){
            (asyncblock || function(fn){ fn(); })(function(){
                if(exec){
                    exec();
                }
            });
        });

        if(func.length === 1){
            func(_resultHandler);
        } else if(func.length === 0){
            _resultHandler(null, func());
        } else {
            throw new Error('func must take 0 arguments, or a callback');
        }
    }
};

Driver.prototype.findElement = function(args, callback){
    var self = this;
    var startTime, selector, context, multi, timeoutMS;
    if(typeof args === 'object'){
        selector = args.selector;
        startTime = args.startTime || new Date();
        context = args.context;
        multi = args.multi;
        timeoutMS = args.timeoutMS || config.timeoutMS;
    } else {
        selector = args;
        startTime = new Date();
        multi = false;
        timeoutMS = config.timeoutMS;
    }

    //Use asyncblock fibers if it is available
    if(asyncblock && callback == null){
        var flow = asyncblock.getCurrentFlow();

        if(flow){
            return flow.sync( this.findElement(args, flow.add()) );
        }
    }

    if(callback == null){
        throw new Error('callback is required');
    }

    this.exec({
        func: function(args){
            return $(args.selector, args.context);
        },

        args: { selector: selector, context: context }
    }, function(err, element){
        if(err){
            return callback(err);
        }

        if(element && (element.length === 1 || (multi && element.length > 0))) {
           callback(null, element);
        } else {
            if(new Date() - startTime < timeoutMS){
                setTimeout(function(){
                   self.findElement({ selector: selector, context: context, startTime: startTime, multi: multi, timeoutMS: timeoutMS }, callback);
                }, config.retryMS);
            } else {
                if(element && element.length > 1){
                    return callback(new Error('Element "' + selector + '" found, but there were too many instances (' + element.length + ')'));
                } else {
                    return callback(new Error('Element "' + selector + '" not found (timeout: ' + timeoutMS + ')'));
                }
            }
        }
    });
};

Driver.prototype.findElements = Driver.prototype.find = function(args, callback){
    if(typeof args === 'object'){
        args.multi = true;
    } else {
        args = { selector: args, multi: true };
    }

    return this.findElement(args, callback);
};

var _isVisible = function(element, callback){
    element._filterVisible(function(err, visibleElements){
        if(err) {
            return callback(err);
        }

        //Not all the elements may be visible, return the visible ones
        if(visibleElements && visibleElements.length > 0){
            callback(null, visibleElements);
        } else {
            callback(null, false);
        }
    });
};

Driver.prototype.findVisible = function(args, callback){
    var selector, multi;
    var self = this;

    if(typeof args === 'object'){
        selector = args.selector;
        multi = args.multi;
        args.startTime = args.startTime || new Date();
    } else {
        args = { selector: args, startTime: new Date() };
    }

    //Use asyncblock fibers if it is available
    if(asyncblock && callback == null){
        var flow = asyncblock.getCurrentFlow();

        if(flow){
            return flow.sync( this.findVisible(args, flow.add()) );
        }
    }

    if(callback == null){
        throw new Error('callback is required');
    }

    this.findElements(args, function(err, element){
        if(err){
            return callback(err);
        }

        _isVisible(element, function(err, visibles){
            if(err){
                return callback(err);
            }

            if(!visibles){
                if(new Date() - args.startTime < config.timeoutMS){
                    setTimeout(function(){
                        self.findVisible(args, callback);
                    }, config.retryMS);
                } else {
                    callback(new Error('Element "' + selector + '" was found, but is not visible.'));
                }

                return;
            }

            if(!multi && visibles.length > 1){
                return callback(new Error('Element "' + selector + '" found, but there were too many visible instances (' + visibles.length + ')'));
            }

            return callback(null, visibles);
        });
    });
};

Driver.prototype.findVisibles = function(args, callback){
    if(typeof args === 'object'){
        args.multi = true;
    } else {
        args = { selector: args, multi: true };
    }

    return this.findVisible(args, callback);
};

Driver.prototype.$ = function(selector, context, callback){
    if (callback == null && typeof context === 'function') {
        callback = context;
        context = null;
    }
    return this.exec({
        func: function(args){
            if (args.context != null) {
                return $(args.selector, args.context);
            } else {
                return $(args.selector);
            }
        },

        args: { selector: selector, context: context }
    }, callback);
};

Driver.prototype.clearLastPopupWindow = function(callback){
    //Use asyncblock fibers if it is available
    if(asyncblock && callback == null){
        var flow = asyncblock.getCurrentFlow();

        if(flow){
            return flow.sync( this.clearLastPopupWindow(flow.add()) );
        }
    }

    this.now.clearLastPopupWindow(callback);
};

Driver.prototype.getLastPopupWindow = function(callback){
    var self = this;

    //Use asyncblock fibers if it is available
    if(asyncblock && callback == null){
        var flow = asyncblock.getCurrentFlow();

        if(flow){
            return flow.sync( this.getLastPopupWindow(flow.add()) );
        }
    }

    return this.now.getLastPopupWindow(function(err, window){
        if(err) { return callback(err); }

        if(window != null){
            window = new WindowProxy(self, window.id);
        }

        return callback(null, window);
    });
};

Driver.prototype.isWindowOpen = function(windowProxy, callback){
    var self = this;

    //Use asyncblock fibers if it is available
    if(asyncblock && callback == null){
        var flow = asyncblock.getCurrentFlow();

        if(flow){
            return flow.sync( this.isWindowOpen(windowProxy, flow.add()) );
        }
    }

    return this.now.isWindowOpen(windowProxy, callback);
};

var _callOnce = function(callback){
    if(callback == null){
        return callback;
    }

    var called = false;
    return function(){
        if(!called){
            called = true;
            callback.apply(this, arguments);
        }
    };
};

module.exports = Driver;