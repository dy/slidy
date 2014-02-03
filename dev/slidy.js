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
var cssPrefix = detectCSSPrefix();
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
  var self = $traceurRuntime.superCall(this, $Area.prototype, "constructor", [el, opts]);
  self.pickers = [];
  var children = self.querySelectorAll("[data-picker]"),
      l = children.length,
      pNum = 0;
  if (l > 0) {
    for (var i = 0; i < l; i++) {
      self.addPicker(children.item(i));
    }
  }
  var pNum = 0;
  for (var i = 0; i < pNum; i++) {
    var el = document.createElement("div");
    self.addPicker(el, o.pickers[i]);
  }
  self.dragstate = {
    initX: 0,
    initY: 0,
    x: 0,
    y: 0,
    difX: 0,
    difY: 0,
    clientX: 0,
    clientY: 0,
    box: {},
    area: self,
    isCtrl: false,
    picker: null
  };
  self._listenEvents();
  self.options = {
    readonly: false,
    sniperSpeed: 0.25,
    dragClass: "dragging",
    create: null,
    dragstart: null,
    drag: null,
    dragstop: null,
    destroy: null,
    change: null
  };
  return self;
};
var $Area = Area;
($traceurRuntime.createClass)(Area, {
  captureSize: function() {
    "use strict";
    self.offsetBox = getOffsetBox(self);
    self.paddingBox = getPaddingBox(self);
  },
  addPicker: function(el) {
    "use strict";
    this.pickers.push(new Picker(el, this));
  },
  _listenEvents: function() {
    "use strict";
    var o = this.options,
        self = this;
    this._dragstart = this._dragstart.bind(this);
    this._drag = this._drag.bind(this);
    this._dragstop = this._dragstop.bind(this);
    this.addEventListener("mousedown", this._dragstart);
    on(window, "resize", function() {
      self._captureSize();
      self.updatePickers();
    });
  },
  _dragstart: function(e) {
    "use strict";
    var o = this.options;
    this._captureSize();
    this.dragstate.x = e.clientX - this.offsetBox.left;
    this.dragstate.y = e.clientY - this.offsetBox.top;
    this.dragstate.clientX = e.clientX;
    this.dragstate.clientY = e.clientY;
    this.dragstate.picker = this.findClosestPicker(this.dragstate.x, this.dragstate.y);
    this.dragstate.box.top = this.offsetBox.top + this.paddingBox.top;
    this.dragstate.box.left = this.offsetBox.left + this.paddingBox.left;
    this.dragstate.box.right = this.offsetBox.right - this.paddingBox.right;
    this.dragstate.box.bottom = this.offsetBox.bottom - this.paddingBox.bottom;
    this.dragstate.box.width = this.offsetBox.width - this.paddingBox.left - this.paddingBox.right;
    this.dragstate.box.height = this.offsetBox.height - this.paddingBox.top - this.paddingBox.bottom;
    this._captureDragstate(this.dragstate, e);
    this.classList.add(this.options.dragClass);
    this.dragstate.picker.dragstart(this.dragstate);
    on(document, "selectstart", prevent);
    on(document, "mousemove", this._drag);
    on(document, "mouseup", this._dragstop);
    on(document, "mouseleave", this._dragstop);
  },
  _drag: function(e) {
    "use strict";
    var o = this.options;
    this._captureDragstate(this.dragstate, e);
    this.dragstate.picker.drag(this.dragstate);
  },
  _dragstop: function(e) {
    "use strict";
    this._drag(e);
    this.dragstate.picker.dragstop(this.dragstate);
    this.classList.remove(this.options.dragClass);
    off(document, "selectstart", this._prevent);
    off(document, "mousemove", this._drag);
    off(document, "mouseup", this._dragstop);
    off(document, "mouseleave", this._dragstop);
  },
  findClosestPicker: function(x, y) {
    "use strict";
    var minL = 9999,
        closestPicker;
    for (var i = 0; i < this.pickers.length; i++) {
      var picker = this.pickers[i],
          w = x - picker.x,
          h = y - picker.y,
          l = Math.sqrt(w * w + h * h);
      if (l < minL) {
        minL = l;
        closestPicker = i;
      }
    }
    return this.pickers[closestPicker];
  },
  updatePickers: function() {
    "use strict";
    for (var i = 0; i < this.pickers.length; i++) {}
  },
  _captureSize: function() {
    "use strict";
    this.offsetBox = getOffsetBox(this);
    this.paddingBox = getPaddingBox(this);
  },
  _captureDragstate: function(dragstate, e) {
    "use strict";
    dragstate.isCtrl = e.ctrlKey;
    dragstate.difX = e.clientX - dragstate.clientX;
    dragstate.difY = e.clientY - dragstate.clientY;
    if (e.ctrlKey) {
      dragstate.difX *= this.options.sniperSpeed;
      dragstate.difY *= this.options.sniperSpeed;
    }
    dragstate.x += dragstate.difX;
    dragstate.y += dragstate.difY;
    dragstate.clientX = e.clientX;
    dragstate.clientY = e.clientY;
  }
}, {}, HTMLCustomElement);
var Picker = function Picker(el, area, opts) {
  "use strict";
  var self = $traceurRuntime.superCall(this, $Picker.prototype, "constructor", [el, opts]);
  self.area = area;
  self.x = 0;
  self.y = 0;
  self.offsetBox = getOffsetBox(self);
  self.drag = self.drag.bind(self);
  self.dragstart = self.dragstart.bind(self);
  self.dragstop = self.dragstop.bind(self);
  return self;
};
var $Picker = Picker;
($traceurRuntime.createClass)(Picker, {
  startTracking: function() {
    "use strict";
    this.area.addEventListener("dragstart", this.dragstart);
    this.area.addEventListener("change", this.change);
    this.offsetBox = getOffsetBox(this);
  },
  stopTracking: function() {
    "use strict";
    this.area.removeEventListener("dragstart", this.dragstart);
    this.area.removeEventListener("change", this.change);
  },
  dragstart: function(state) {
    "use strict";
    this.initOffsetX = this.offsetBox.left - state.x;
    this.initOffsetY = this.offsetBox.top - state.y;
    this.offsetBox = getOffsetBox(this);
  },
  drag: function(state) {
    "use strict";
    var x = between(state.x - this.initOffsetX, 0, state.box.width - this.offsetBox.width);
    var y = between(state.y - this.initOffsetY, 0, state.box.height - this.offsetBox.height);
    trigger(this, "change", [x, y]);
    this.move(x, y);
  },
  dragstop: function() {
    "use strict";
  },
  move: function(x, y, nX, nY) {
    "use strict";
    this.style[cssPrefix + "transform"] = ["translate3d(", x, "px,", y, "px, 0)"].join("");
  },
  addEventListener: function(evt, fn) {
    "use strict";
    addEventListenerTo(this, evt, fn);
  },
  _calcValue: function(x, y) {
    "use strict";
    var o = this.options,
        l = 0;
    l = this.mapToL();
    return this.transferLToValue(l, this);
  },
  transferValueToL: function(value) {
    "use strict";
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
    "use strict";
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
    "use strict";
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
    "use strict";
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
}, {}, HTMLCustomElement);

//# sourceMappingURL=slidy.map
