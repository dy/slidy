var pluginName = "slidy",
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
function limit(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function parseDataAttributes(el, multiple) {
  var data = {},
      v;
  for (var prop in el.dataset) {
    var v;
    if (multiple) {
      v = el.dataset[prop].split(",");
      for (var i = v.length; i--;) {
        v[i] = recognizeValue(v[i].trim());
        if (v[i] === "") v[i] = null;
      }
    } else {
      v = recognizeValue(el.dataset[prop]);
      if (v === "") v[i] = true;
    }
    data[prop] = v;
  }
  return data;
}
function getOffsetBox($el) {
  var box = $el.getBoundingClientRect();
  box.height = $el.offsetHeight;
  box.width = $el.offsetWidth;
  box.center = [box.width * 0.5, box.height * 0.5];
  return box;
}
function getPaddingBox($el) {
  var box = {},
      style = getComputedStyle($el);
  box.top = ~~style.paddingTop.slice(0, - 2);
  box.left = ~~style.paddingLeft.slice(0, - 2);
  box.bottom = ~~style.paddingBottom.slice(0, - 2);
  box.right = ~~style.paddingRight.slice(0, - 2);
  return box;
}
function on(el, evt, fn) {
  if ($) {
    $(el).on(evt, fn);
  } else {
    el.addEventListener(evt, fn);
  }
}
function off(el, evt, fn) {
  if ($) {
    $(el).off(evt, fn);
  } else {
    el.removeEventListener(evt, fn);
  }
}
function trigger(that, ename, data) {}
function addEventListenerTo(that, evt, fn) {
  if (!that.listeners) that.listeners = [];
  if (!that.listeners[evt]) that.listeners[evt] = [];
  if (that.listeners[evt].indexOf(fn) < 0) that.listeners[evt].push(fn);
}
function between(a, min, max) {
  return Math.max(Math.min(a, max), min);
}
function prevent(e) {
  e.preventDefault();
}
function recognizeValue(str) {
  if (str === "true") {
    return true;
  } else if (str === "false") {
    return false;
  } else if (!isNaN(v = parseFloat(str))) {
    return v;
  } else {
    return str;
  }
}
var HTMLCustomElement = function HTMLCustomElement(el, opts) {
  "use strict";
  if (el instanceof HTMLElement) {
    this.self = el;
  } else {
    if (el) {
      opts = el;
    }
    this.self = document.createElement('div');
  }
  var self = this.self;
  this.originalProto = self.__proto__;
  self.__proto__ = this.__proto__;
  self.setAttributes(opts);
  self.classList.add(pluginName);
  self.trigger("create");
  console.log("HTMLCustomElement constructor");
  return self;
};
($traceurRuntime.createClass)(HTMLCustomElement, {
  setAttributes: function(opts) {
    "use strict";
    for (var key in opts) {
      this.setAttribute(key, opts[key]);
      this[key] = opts[key];
    }
  },
  ok: function() {
    "use strict";
    console.log("ok");
  },
  parseDataset: function() {
    "use strict";
  },
  on: function(evt, fn) {
    "use strict";
    this.$el.addEventListener(evt, fn);
  },
  off: function(evt, fn) {
    "use strict";
    this.$el.removeEventListener(evt, fn);
  },
  one: function(evt, fn) {
    "use strict";
    this.$el.addEventListener(evt, function() {
      fn();
      this.$el.removeEventListener(evt, fn);
    }.bind(this));
  },
  trigger: function(eName, data) {
    "use strict";
    var event = new CustomEvent(eName, data);
    if (this['on' + eName]) this['on' + eName].apply(this, event);
    this.dispatchEvent(event);
  },
  enable: function() {
    "use strict";
  },
  disable: function() {
    "use strict";
  }
}, {}, HTMLElement);
var Area = function Area(el, opts) {
  "use strict";
  return self;
};
($traceurRuntime.createClass)(Area, {captureSize: function() {
    "use strict";
    this.offsetBox = getOffsetBox(this);
    this.paddingBox = getPaddingBox(this);
  }}, {}, HTMLCustomElement);
function Picker(el, area, opts) {
  this.$el = el;
  this.area = area;
  this.options = extend({}, this.options, parseDataAttributes(el, true), opts);
  var o = this.options;
  Object.defineProperty(this, "value", {
    get: function() {
      return value;
    },
    set: function(vector) {
      value = vector;
      this.update();
    },
    enumerable: true,
    configurable: true
  });
  this.value = o.value;
  this.x = this.options.x;
  this.y = this.options.y;
  this.offsetBox = getOffsetBox(this.$el);
  this.drag = this.drag.bind(this);
  this.dragstart = this.dragstart.bind(this);
  this.dragstop = this.dragstop.bind(this);
}
Picker.prototype = {
  options: {
    x: 0,
    y: 0,
    horizontal: true,
    vertical: false
  },
  startTracking: function() {
    this.area.$el.addEventListener("dragstart", this.dragstart);
    this.area.$el.addEventListener("change", this.change);
    this.offsetBox = getOffsetBox(this.$el);
  },
  stopTracking: function() {
    this.area.$el.removeEventListener("dragstart", this.dragstart);
    this.area.$el.removeEventListener("change", this.change);
  },
  dragstart: function(state) {
    this.initOffsetX = this.offsetBox.left - state.x;
    this.initOffsetY = this.offsetBox.top - state.y;
    this.offsetBox = getOffsetBox(this.$el);
  },
  drag: function(state) {
    var x = between(state.x - this.initOffsetX, 0, state.box.width - this.offsetBox.width);
    var y = between(state.y - this.initOffsetY, 0, state.box.height - this.offsetBox.height);
    trigger(this, "change", [x, y]);
    this.move(x, y);
  },
  dragstop: function() {},
  move: function(x, y, nX, nY) {
    this.$el.style[cssPrefix + "transform"] = ["translate3d(", x, "px,", y, "px, 0)"].join("");
  },
  addEventListener: function(evt, fn) {
    addEventListenerTo(this, evt, fn);
  },
  _calcValue: function(x, y) {
    var o = this.options,
        l = 0;
    l = this.mapToL();
    return this.transferLToValue(l, this);
  },
  transferValueToL: function(value) {
    var l = [],
        o = this.options;
    for (var i = 0; i < this.dimensions; i++) {
      var min = o.min[i],
          max = o.max[i];
      l[i] = (value[i] - min) / (max - min);
    }
    return l;
  },
  transferLToValue: function(l) {
    var v = [],
        o = this.options;
    for (var i = 0; i < this.dimensions; i++) {
      var min = o.min[i],
          max = o.max[i];
      v[i] = l[i] * (max - min) + (min);
    }
    return v;
  },
  mapToL: function() {
    var l = [],
        o = this.options,
        area = this.area;
    for (var i = 0; i < this.dimensions; i++) {
      var direction = o.direction[i];
      switch (o.direction[i]) {
        case "top":
          l[i] = (1 - this.top / area.height);
          break;
        case "bottom":
          l[i] = (this.top / area.height);
          break;
        case "left":
          l[i] = (1 - this.left / area.width);
          break;
        case "right":
          l[i] = (this.left / area.width);
          break;
        default:
      }
    }
    return l;
  },
  mapFromL: function(l) {
    var o = this.options;
    for (var i = 0; i < this.dimensions; i++) {
      var direction = o.direction[i];
      switch (direction[i]) {
        case "top":
          this.top = Math.round((1 - l[i]) * this.area.height);
          break;
        case "bottom":
          this.top = Math.round(l[i] * this.area.height);
          break;
        case "right":
          this.left = Math.round((l[i]) * this.area.width);
          break;
        case "left":
          this.left = Math.round((1 - l[i]) * this.area.width);
          break;
      }
    }
  }
};

//# sourceMappingURL=slidy.map
