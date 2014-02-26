$traceurRuntime.ModuleStore.registerModule("../src/util", function() {
  "use strict";
  var __moduleName = "../src/util";
  var pluginName = "slidy",
      jQuery,
      $;
  function extend(a) {
    for (var i = 1,
        l = arguments.length; i < l; i++) {
      var b = arguments[i];
      for (var k in b) {
        a[k] = b[k];
      }
    }
    return a;
  }
  $ = $ || function(s) {
    if (typeof s === "string") {
      return document.querySelectorAll(s);
    }
    return s;
  };
  function offsets(el) {
    if (!el) throw new Error("No element passed");
    var rect = el.getBoundingClientRect(),
        c = {
          top: rect.top + window.pageYOffset,
          left: rect.left + window.pageXOffset,
          width: el.offsetWidth,
          height: el.offsetHeight,
          bottom: rect.top + window.pageYOffset + el.offsetHeight,
          right: rect.left + window.pageXOffset + el.offsetWidth,
          fromRight: window.innerWidth - rect.right,
          fromBottom: (window.innerHeight + window.pageYOffset - rect.bottom)
        };
    return c;
  }
  function paddings($el) {
    var style = getComputedStyle($el);
    return {
      top: parseCssValue(style.paddingTop),
      left: parseCssValue(style.paddingLeft),
      bottom: parseCssValue(style.paddingBottom),
      right: parseCssValue(style.paddingRight)
    };
  }
  function margins($el) {
    var style = getComputedStyle($el);
    return {
      top: parseCssValue(style.marginTop),
      left: parseCssValue(style.marginLeft),
      bottom: parseCssValue(style.marginBottom),
      right: parseCssValue(style.marginRight)
    };
  }
  function parseCssValue(str) {
    return ~~str.slice(0, - 2);
  }
  function on(el, evt, delegate, fn) {
    if (jQuery) {
      jQuery(el).on.apply(el, arguments);
    } else if (arguments.length === 3) {
      el.addEventListener(evt, delegate);
    } else if (arguments.length === 4 && !delegate) {
      el.addEventListener(evt, fn);
    } else {
      el.addEventListener(evt, function(e) {}.bind(el));
    }
    return el;
  }
  function off(el, evt, fn) {
    if (jQuery) {
      jQuery(el).off.apply(el, arguments);
    } else if (arguments.length === 3) {
      el.removeEventListener(evt, fn);
    }
    return el;
  }
  function fire(el, eventName, data) {
    var event = new CustomEvent(eventName, {detail: data});
    if (this['on' + eventName]) this['on' + eventName].apply(this, data);
    if (jQuery) {
      $(el).trigger(event, data);
    } else {
      el.dispatchEvent(event);
    }
  }
  function between(a, min, max) {
    return Math.max(Math.min(a, max), min);
  }
  function round(value, precision) {
    if (precision === 0) return value;
    return Math.round(value / precision) * precision;
  }
  function parseAttr(str) {
    var v;
    if (str.indexOf(',') >= 0) return parseMultiAttr(str);
    if (str === "true" || str === "") {
      return true;
    } else if (str === "false") {
      return false;
    } else if (!isNaN(v = parseFloat(str))) {
      return v;
    } else {
      return str;
    }
  }
  function parseMultiAttr(str) {
    str = str.trim();
    if (str[0] === "[") str = str.slice(1);
    if (str.length > 1 && str[str.length - 1] === "]") str = str.slice(0, - 1);
    var parts = str.split(',');
    var result = [];
    for (var i = 0; i < parts.length; i++) {
      result.push(parseAttr(parts[i]));
    }
    return result;
  }
  var defaultAttrs = {
    'class': true,
    'id': true,
    'style': true
  };
  function parseAttributes(el) {
    var attrs = el.attributes,
        data = {};
    for (var i = 0; i < attrs.length; i++) {
      var attr = attrs[i],
          attrName = toCamelCase(attr.name);
      if (attrName.slice(0, 2) === "on") {
        data[attrName] = new Function(attr.value);
      } else if (!defaultAttrs[attrName]) {
        data[attrName] = parseAttr(attr.value);
      }
    }
    return data;
  }
  function toCamelCase(str) {
    return str.replace(/-[a-z]/g, function(match, group, position) {
      return match[1].toUpperCase();
    });
  }
  function toDashedCase(str) {
    return str.replace(/[A-Z]/g, function(match, group, position) {
      return "-" + match.toLowerCase();
    });
  }
  function stringify(el) {
    if (typeof el === "function") {
      var src = el.toString();
      el.slice(src.indexOf("{") + 1, src.lastIndexOf("}"));
    } else if (el instanceof HTMLElement) {
      return selector(el);
    } else if (el instanceof Array) {
      return el.join(",");
    } else if (el instanceof Object) {
      return el.toString();
    } else {
      return el.toString();
    }
  }
  function selector(element) {
    if (element === document.documentElement) {
      return ':root';
    } else if (element.tagName && element.tagName.toUpperCase() === 'BODY') {
      return 'body';
    } else if (element.id) {
      return '#' + element.id;
    }
    var parent = element.parentNode;
    var parentLoc = selector(parent);
    var children = parent.childNodes;
    var index = 0;
    for (var i = 0; i < children.length; i++) {
      if (children[i].nodeType === 1) {
        if (children[i] === element) {
          break;
        }
        index++;
      }
    }
    return parentLoc + ' *:nth-child(' + (index + 1) + ')';
  }
  function detectCSSPrefix() {
    var puppet = document.documentElement;
    var style = document.defaultView.getComputedStyle(puppet, "");
    if (style.transform) return "";
    if (style["-webkit-transform"]) return "-webkit-";
    if (style["-moz-transform"]) return "-moz-";
    if (style["-o-transform"]) return "-o-";
    if (style["-khtml-transform"]) return "-khtml-";
    return "";
  }
  var cssPrefix = detectCSSPrefix();
  function observeData(target, data) {}
  function findPropertyToInsert(str) {}
  return {};
});
System.get("../src/util" + '');
$traceurRuntime.ModuleStore.registerModule("../src/Component", function() {
  "use strict";
  var __moduleName = "../src/Component";
  var Component = function Component(el, opts) {
    var self;
    if (el instanceof HTMLElement) {
      self = el;
    } else {
      if (el) {
        opts = el;
      }
      self = document.createElement('div');
    }
    var originalProto = self.__proto__;
    self.__proto__ = this.constructor.prototype;
    self.initAPI.call(self);
    self.initOptions.call(self, opts);
    self._id = this.constructor.instances.length;
    this.constructor.instances.push(self);
    self.initStates.apply(self);
    self.state = 'default';
    self.classList.add(this.constructor.lname);
    self.fire("create", null);
    return self;
  };
  var $Component = Component;
  ($traceurRuntime.createClass)(Component, {
    initAPI: function() {
      for (var meth in this) {
        if (typeof this[meth] === "function") this[meth] = this[meth].bind(this);
      }
    },
    initOptions: function(extOpts) {
      extOpts = extend(parseAttributes(this), extOpts);
      for (var key in extOpts) {
        this[key] = extOpts[key];
      }
      this._observer = new MutationObserver(function(mutations) {
        if (this._preventOneAttrChange) {
          this._preventOneAttrChange = true;
          return;
        }
        for (var i = 0; i < mutations.length; i++) {
          var mutation = mutations[i];
          if (mutation.type === "attributes") {
            var attr = mutation.attributeName;
            if (this.constructor.defaults[attr]) {
              console.log("Attribute externally changed", parseAttr(this.getAttribute(attr)));
              this["_" + attr] = parseAttr(this.getAttribute(attr));
            }
          }
        }
      }.bind(this));
      this._observeConfig = {attributes: true};
      this.observeAttrChange();
    },
    setAttributes: function(opts) {
      for (var key in opts) {
        this[key] = opts[key];
      }
    },
    getAttributes: function() {
      var result = {};
      for (var key in this.defaults) {
        result[key] = this[key];
      }
      return result;
    },
    get state() {
      return this._state;
    },
    set state(newStateName) {
      var oldState = this.states[this._state];
      var newState = this.states[newStateName] || this.states['default'];
      if (!newState) throw new Error("Not existing state `" + newStateName + "`");
      if (oldState) {
        oldState.after && oldState.after.fn.call(this);
        this.fire("after" + this._state[0].toUpperCase() + this._state.slice(1) + "State");
        this.fire("afterState");
        for (var evt in oldState) {
          var stateEvt = oldState[evt];
          off(stateEvt.src, stateEvt.evt, stateEvt.fn);
        }
      }
      newState.before && newState.before.fn.call(this);
      this.fire("before" + newStateName[0].toUpperCase() + newStateName.slice(1) + "State");
      this.fire("beforeState");
      for (var evt in newState) {
        var stateEvt = newState[evt];
        on(stateEvt.src, stateEvt.evt, stateEvt.delegate, stateEvt.fn);
      }
      this._state = newStateName;
    },
    initStates: function(states) {
      var protoStates = this.constructor.states;
      this.states = {};
      for (var stateName in protoStates) {
        var protoState = protoStates[stateName],
            instanceState = {};
        for (var evtId in protoState) {
          var fnRef = protoState[evtId],
              fn = undefined;
          if (typeof fnRef === "function") {
            fn = fnRef.bind(this);
          } else if (typeof fnRef === "string" && this[fnRef]) {
            fn = this[fnRef];
          }
          var evtDirectives = evtId.split(',');
          for (var i = 0; i < evtDirectives.length; i++) {
            var evtDirective = evtDirectives[i].trim();
            var evt = undefined,
                src = undefined,
                delegate = undefined;
            var evtParams = evtDirective.split(" ");
            if (evtParams[0] === 'document') {
              src = document;
              evtParams = evtParams.slice(1);
            } else if (evtParams[0] === 'window') {
              src = window;
              evtParams = evtParams.slice(1);
            } else {
              src = this;
            }
            evt = evtParams[0];
            delegate = evtParams.slice(1).join('');
            if (fn && evt) {
              instanceState[evt] = {
                evt: evt,
                src: src,
                delegate: delegate,
                fn: fn
              };
            }
          }
        }
        this.states[stateName] = instanceState;
      }
    },
    disable: function() {
      this.disabled = true;
      this.ignoreAttrChange();
      this.fire('disable');
    },
    enable: function() {
      this.disabled = false;
      this.observeAttrChange();
      this.fire('enable');
    },
    observeAttrChange: function() {
      this._observer.observe(this, this._observeConfig);
    },
    ignoreAttrChange: function() {
      this._observer.disconnect();
    },
    updateAttr: function(key, value) {
      if (!this._reflectAttrTimeout) {
        var prefix = $Component.safeAttributes ? "data-": "";
        key = toDashedCase(key);
        if (value === false) {
          this.removeAttribute(key);
        } else {
          this._preventOneAttrChange = true;
          this.setAttribute(prefix + key, stringify(value));
        }
        this._reflectAttrTimeout = setTimeout(function() {
          clearTimeout(this._reflectAttrTimeout);
          this._reflectAttrTimeout = null;
        }, 500);
      }
    },
    preventDefault: function(e) {
      e.preventDefault();
    },
    addOnceListener: function(evt, fn) {
      this.addEventListener(evt, function() {
        fn.apply(this);
        this.removeEventListener(evt, fn);
      }.bind(this));
    },
    on: function(evt, fn) {
      $traceurRuntime.superCall(this, $Component.prototype, "addEventListener", [evt, fn]);
      return this;
    },
    off: function(evt, fn) {
      $traceurRuntime.superCall(this, $Component.prototype, "removeEventListener", [evt, fn]);
      return this;
    },
    delegateListener: function(evt, delegate, fn) {
      if (typeof delegate === 'string') {
        delegate = this.querySelectorAll(delegate);
      } else if (delegate instanceof Element) {
        delegate = [delegate];
      } else if (delegate instanceof NodeList || delegate instanceof Array) {} else {
        delegate = [this];
      }
      this.addEventListener(evt, function(e) {
        if (delegate.indexOf(e.currentTarget) >= 0) {
          fn.call(this, e);
        }
      }.bind(this));
    },
    fire: function(eName) {
      var data = arguments[1];
      fire(this, eName, data);
    },
    autoinit: function() {
      var lname = this.constructor.lname,
          selector = ["[", lname, "], [data-", lname, "], .", lname, ""].join("");
      var targets = document.querySelectorAll(selector);
      for (var i = 0; i < targets.length; i++) {
        new this.constructor(targets[i]);
      }
    }
  }, {}, HTMLElement);
  Component.register = function(constructor) {
    if (Component.registry[constructor.name]) throw new Error("Component `" + Component.name + "` does already exist");
    Component.registry[constructor.name] = constructor;
    constructor.instances = [];
    constructor.lname = constructor.name.toLowerCase();
    var propsDescriptor = {};
    for (var key in constructor.defaults) {
      constructor.prototype["_" + key] = constructor.defaults[key];
      if (Object.getOwnPropertyDescriptor(constructor.prototype, key)) continue;
      var get = (function(key) {
        return function() {
          return this['_' + key];
        };
      })(key);
      var set = (function(key) {
        return function(value) {
          if (this['_' + key] === value) return;
          this['_' + key] = value;
          this.updateAttr(key, value);
          this.fire("optionChanged");
          this.fire(value + "Changed");
        };
      })(key);
      propsDescriptor[key] = {
        configurable: false,
        enumerable: false,
        get: get,
        set: set
      };
    }
    Object.defineProperties(constructor.prototype, propsDescriptor);
    constructor.prototype.autoinit();
  };
  Component.registry = {};
  Component.create = function(el, opts) {
    return new this.constructor(el, opts);
  };
  Component.safeAttributes = Component.safeAttributes || false;
  Component.autoinit = Component.autoinit || true;
  Component.exposeClasses = Component.exposeClasses || true;
  return {};
});
System.get("../src/Component" + '');

//# sourceMappingURL=slidy.map
