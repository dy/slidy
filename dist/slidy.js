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
  if (typeof s === "string") return document.querySelector(s);
  return s;
};
function offsets(el) {
  if (!el) throw new Error("No element passed");
  var c = {},
      rect = el.getBoundingClientRect();
  c.top = rect.top + window.scrollY;
  c.left = rect.left + window.scrollX;
  c.width = el.offsetWidth;
  c.height = el.offsetHeight;
  c.bottom = c.top + c.height;
  c.right = c.left + c.width;
  c.fromRight = document.width - rect.right;
  c.fromBottom = (window.innerHeight + window.scrollY - rect.bottom);
  return c;
}
function paddings($el) {
  var box = {},
      style = getComputedStyle($el);
  box.top = ~~style.paddingTop.slice(0, - 2);
  box.left = ~~style.paddingLeft.slice(0, - 2);
  box.bottom = ~~style.paddingBottom.slice(0, - 2);
  box.right = ~~style.paddingRight.slice(0, - 2);
  return box;
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
}
function off(el, evt, fn) {
  if (jQuery) {
    jQuery(el).off.apply(el, arguments);
  } else if (arguments.length === 3) {
    el.removeEventListener(evt, fn);
  }
}
function fire(el, eName, data) {
  var event = new CustomEvent(eName, {detail: data});
  if (this['on' + eName]) this['on' + eName].apply(this, data);
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
    var attr = attrs[i];
    if (attr.name.slice(0, 2) === "on") {
      data[attr.name] = new Function(attr.value);
    } else if (!defaultAttrs[attr.name]) {
      data[attr.name] = parseAttr(attr.value);
    }
  }
  return data;
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
function observeData(target, data) {
  var listeners = {},
      propRe = /\{\{\s([a-zA-Z_$][a-zA-Z_$0-9]*)\s\}\}/;
  for (var i = 0; i < target.attributes.length; i++) {
    var attrValue = target.attributes[i].value;
    var propIdx = undefined;
    while ((propIdx = attrValue.indexOf("{{")) >= 0) {
      var closeIdx = attrValue.indexOf("}}");
      var propName = attrValue.slice(propIdx + 2, closeIdx).trim();
      target.attributes[i].value = [target.attributes[i].value.slice(0, propIdx), data[propName], target.attributes[i].value.slice(closeIdx, attrValue.length - 1)].join('');
      if (!listeners[propName]) listeners[propName] = [];
      listeners[propName].push({
        target: target.attributes[i],
        template: attrValue,
        data: {}
      });
    }
  }
  var children = target.childNodes,
      l = children.length;
  for (var i = 0; i < l; i++) {
    var child = children(i);
    if (child.nodeType === 1) {
      if (propRe.test(child.texContent)) {
        listeners.push({
          target: child,
          template: target.texContent
        });
      }
    }
  }
  for (var prop in listeners) {
    var listener = listeners[prop];
    document.addEventListener(prop + "Changed", function(e) {
      var value = e.target.value;
      for (var i = 0; i < target.attributes.length; i++) {
        var attrName = target.attributes[i].name.replace();
        var attrValue = target.attributes[i].value.replace();
        if (re.test(attrName)) {}
      }
    });
  }
}
function findPropertyToInsert(str) {
  str.indexOf();
}
var Component = function Component(el, opts) {
  "use strict";
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
  self.fire("create");
  return self;
};
($traceurRuntime.createClass)(Component, {
  initAPI: function() {
    "use strict";
    for (var meth in this) {
      if (typeof this[meth] === "function") this[meth] = this[meth].bind(this);
    }
  },
  initOptions: function(extOpts) {
    "use strict";
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
    "use strict";
    for (var key in opts) {
      this[key] = opts[key];
    }
  },
  getAttributes: function() {
    "use strict";
    var result = {};
    for (var key in this.defaults) {
      result[key] = this[key];
    }
    return result;
  },
  get state() {
    "use strict";
    return this._state;
  },
  set state(newStateName) {
    "use strict";
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
    "use strict";
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
    "use strict";
    this.disabled = true;
    this.ignoreAttrChange();
    this.fire('disable');
  },
  enable: function() {
    "use strict";
    this.disabled = false;
    this.observeAttrChange();
    this.fire('enable');
  },
  observeAttrChange: function() {
    "use strict";
    this._observer.observe(this, this._observeConfig);
  },
  ignoreAttrChange: function() {
    "use strict";
    this._observer.disconnect();
  },
  preventDefault: function(e) {
    "use strict";
    e.preventDefault();
  },
  addOnceListener: function(evt, fn) {
    "use strict";
    this.addEventListener(evt, function() {
      fn.apply(this);
      this.removeEventListener(evt, fn);
    }.bind(this));
  },
  delegateListener: function(evt, delegate, fn) {
    "use strict";
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
  fire: function(eName, data) {
    "use strict";
    fire(this, eName, data);
  },
  autoinit: function() {
    "use strict";
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
        this['_' + key] = value;
        this._preventOneAttrChange = true;
        this.setAttribute(key, stringify(value));
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
var Draggable = function Draggable(el, opts) {
  "use strict";
  var self = $traceurRuntime.superCall(this, $Draggable.prototype, "constructor", [el, opts]);
  self._x = 0;
  self._y = 0;
  self.style[cssPrefix + "user-select"] = "none";
  self.style[cssPrefix + "user-drag"] = "none";
  if (self.within) {
    if (self.within instanceof Element) {
      self.$restrictWithin = self.within;
    } else if (typeof self.within === "string") {
      self.$restrictWithin = $(self.within);
    } else {
      self.$restrictWithin = null;
    }
  }
  if (self.native) {
    self.state = "native";
  }
  return self;
};
var $Draggable = Draggable;
($traceurRuntime.createClass)(Draggable, {
  startDrag: function(e) {
    "use strict";
    var limOffsets = offsets(this.$restrictWithin);
    this.offsets = offsets(this);
    this.paddings = paddings(this.$restrictWithin);
    this.oX = this.offsets.left - this.x;
    this.oY = this.offsets.top - this.y;
    this.limits = {
      top: limOffsets.top - this.oY + this.paddings.top,
      bottom: limOffsets.bottom - this.oY - this.offsets.height - this.paddings.bottom,
      left: limOffsets.left - this.oX + this.paddings.left,
      right: limOffsets.right - this.oX - this.offsets.width - this.paddings.right
    };
    this.dragstate = {
      clientX: e.clientX,
      clientY: e.clientY,
      offsetX: e.offsetX,
      offsetY: e.offsetY,
      x: e.clientX + window.scrollX - this.oX,
      y: e.clientY + window.scrollY - this.oY
    };
  },
  drag: function(e) {
    "use strict";
    var d = this.dragstate;
    d.isCtrl = e.ctrlKey;
    if (e.ctrlKey && this.sniper) {}
    d.clientX = e.clientX;
    d.clientY = e.clientY;
    d.x = e.clientX + window.scrollX - this.oX;
    d.y = e.clientY + window.scrollY - this.oY;
    this.move(d);
  },
  stopDrag: function(e) {
    "use strict";
    delete this.dragstate;
  },
  move: function(d) {
    "use strict";
    if (!this.axis || this.axis === "x") {
      this.x = round(between(d.x - d.offsetX, this.limits.left, this.limits.right), this.precision);
    }
    if (!this.axis || this.axis === "y") {
      this.y = round(between(d.y - d.offsetY, this.limits.top, this.limits.bottom), this.precision);
    }
  },
  get x() {
    "use strict";
    return this._x;
  },
  set x(x) {
    "use strict";
    this._x = x;
    this.style[cssPrefix + "transform"] = ["translate3d(", this._x, "px,", this._y, "px, 0)"].join("");
  },
  get y() {
    "use strict";
    return this._y;
  },
  set y(y) {
    "use strict";
    this._y = y;
    this.style[cssPrefix + "transform"] = ["translate3d(", this._x, "px,", this._y, "px, 0)"].join("");
  },
  dropEffect: function(e) {
    "use strict";
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    return false;
  }
}, {}, Component);
Draggable.states = {
  'default': {
    before: null,
    after: null,
    mousedown: function(e) {
      this.startDrag(e);
      this.fire('dragstart');
      this.state = "drag";
    }
  },
  drag: {
    'document selectstart': 'preventDefault',
    'document mousemove': function(e) {
      this.drag(e);
      this.fire('drag');
    },
    'document mouseup, document mouseleave': function(e) {
      this.stopDrag(e);
      this.state = "default";
    }
  },
  scroll: {},
  tech: {},
  out: {},
  native: {
    before: function() {
      this.style[cssPrefix + "user-drag"] = "element";
      this.style.cursor = "pointer!important";
      on(this.$restrictWithin, 'dragover', this.dropEffect);
    },
    after: function() {
      this.style[cssPrefix + "user-drag"] = "none";
      off(this.$restrictWithin, 'dragover', this.dropEffect);
    },
    dragstart: function(e) {
      this.startDrag(e);
      e.dataTransfer.effectAllowed = 'all';
      this.$dragImageStub = document.createElement('div');
      this.parentNode.insertBefore(this.$dragImageStub, this);
      e.dataTransfer.setDragImage(this.$dragImageStub, 0, 0);
    },
    dragend: function(e) {
      this.stopDrag(e);
      this.$dragImageStub.parentNode.removeChild(this.$dragImageStub);
      delete this.$dragImageStub;
    },
    drag: function(e) {
      if (e.x === 0 && e.y === 0) return;
      this.drag(e);
    },
    dragover: 'dropEffect'
  }
};
Draggable.defaults = {
  treshold: 10,
  autoscroll: false,
  within: document.body,
  group: null,
  ghost: false,
  translate: true,
  precision: 1,
  sniper: false,
  axis: false,
  native: (function() {
    var div = document.createElement("div");
    var isNativeSupported = ('draggable'in div) || ('ondragstart'in div && 'ondrop'in div);
    return isNativeSupported;
  })()
};
Component.register(Draggable);
var Slidy = function Slidy(el, opts) {
  "use strict";
  var self = $traceurRuntime.superCall(this, $Slidy.prototype, "constructor", [el, opts]);
  if (self.vertical) self.horizontal = false;
  self.dimensions = self.value.length;
  if (self.dimensions === 2) {
    self.horizontal = false;
    self.vertical = false;
  }
  var picker = new Draggable({
    within: self,
    axis: self.horizontal && !self.vertical ? 'x': (self.vertical && !self.horizontal ? 'y': false),
    ondrag: self.pickerMoved
  });
  self.appendChild(picker);
  if (self.expose) {}
  return self;
};
var $Slidy = Slidy;
($traceurRuntime.createClass)(Slidy, {pickerMoved: function(e) {
    "use strict";
    var thumb = e.currentTarget,
        d = thumb.dragstate,
        lim = thumb.limits,
        thumbW = thumb.offsets.width,
        thumbH = thumb.offsets.height,
        hScope = (lim.right - lim.left),
        vScope = (lim.bottom - lim.top);
    if (this.dimensions === 2) {
      var normalValue = [(thumb.x - lim.left) / hScope, (- thumb.y + lim.bottom) / vScope];
      this.value = [normalValue[0] * (this.max[0] - this.min[0]) + this.min[0], normalValue[1] * (this.max[1] - this.min[1]) + this.min[1]];
    } else if (this.vertical) {
      var normalValue = (- thumb.y + lim.top) / vScope;
      this.value = normalValue * (this.max - this.min) + this.min;
    } else if (this.horizontal) {
      var normalValue = (thumb.x - lim.left) / hScope;
      this.value = normalValue * (this.max - this.min) + this.min;
    }
    this.fire("change");
  }}, {}, Component);
Slidy.states = {default: {}};
Slidy.defaults = {
  value: 50,
  min: 0,
  max: 100,
  step: 1,
  expose: true,
  vertical: false,
  horizontal: true,
  range: true,
  snap: false,
  keyboard: true,
  readonly: false,
  thumbClass: 'draggable',
  onchange: null,
  oncreate: null,
  onslide: null,
  onstart: null,
  onstop: null
};
Component.register(Slidy);

//# sourceMappingURL=slidy.map
