require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * A storage of per-target callbacks.
 * WeakMap is the most safe solution.
 *
 * @module emmy/listeners
 */

/** Storage of callbacks */
var cache = new WeakMap;


/**
 * Get listeners for the target/evt (optionally)
 *
 * @param {object} target a target object
 * @param {string}? evt an evt name, if undefined - return object with events
 *
 * @return {(object|array)} List/set of listeners
 */
function listeners(target, evt, tags){
	var cbs = cache.get(target);

	if (!evt) return cbs || {};
	if (!cbs || !cbs[evt]) return [];

	var result = cbs[evt];

	//if there are evt namespaces specified - filter callbacks
	if (tags && tags.length) {
		result = result.filter(function(cb){
			return hasTags(cb, tags);
		});
	}

	return result;
}


/**
 * Remove listener, if any
 */
listeners.remove = function(target, evt, cb, tags){
	//get callbacks for the evt
	var evtCallbacks = cache.get(target);
	if (!evtCallbacks || !evtCallbacks[evt]) return false;

	var callbacks = evtCallbacks[evt];

	//if tags are passed - make sure callback has some tags before removing
	if (tags && tags.length && !hasTags(cb, tags)) return false;

	//remove specific handler
	for (var i = 0; i < callbacks.length; i++) {
		//once method has original callback in .cb
		if (callbacks[i] === cb || callbacks[i].fn === cb) {
			callbacks.splice(i, 1);
			break;
		}
	}
};


/**
 * Add a new listener
 */
listeners.add = function(target, evt, cb, tags){
	if (!cb) return;

	//ensure set of callbacks for the target exists
	if (!cache.has(target)) cache.set(target, {});
	var targetCallbacks = cache.get(target);

	//save a new callback
	(targetCallbacks[evt] = targetCallbacks[evt] || []).push(cb);

	//save ns for a callback, if any
	if (tags && tags.length) {
		cb._ns = tags;
	}
};


/** Detect whether an cb has at least one tag from the list */
function hasTags(cb, tags){
	if (cb._ns) {
		//if cb is tagged with a ns and includes one of the ns passed - keep it
		for (var i = tags.length; i--;){
			if (cb._ns.indexOf(tags[i]) >= 0) return true;
		}
	}
}


module.exports = listeners;
},{}],2:[function(require,module,exports){
/**
 * @module Icicle
 */
module.exports = {
	freeze: lock,
	unfreeze: unlock,
	isFrozen: isLocked
};


/** Set of targets  */
var lockCache = new WeakMap;


/**
 * Set flag on target with the name passed
 *
 * @return {bool} Whether lock succeeded
 */
function lock(target, name){
	var locks = lockCache.get(target);
	if (locks && locks[name]) return false;

	//create lock set for a target, if none
	if (!locks) {
		locks = {};
		lockCache.set(target, locks);
	}

	//set a new lock
	locks[name] = true;

	//return success
	return true;
}


/**
 * Unset flag on the target with the name passed.
 *
 * Note that if to return new value from the lock/unlock,
 * then unlock will always return false and lock will always return true,
 * which is useless for the user, though maybe intuitive.
 *
 * @param {*} target Any object
 * @param {string} name A flag name
 *
 * @return {bool} Whether unlock failed.
 */
function unlock(target, name){
	var locks = lockCache.get(target);
	if (!locks || !locks[name]) return false;

	locks[name] = null;

	return true;
}


/**
 * Return whether flag is set
 *
 * @param {*} target Any object to associate lock with
 * @param {string} name A flag name
 *
 * @return {Boolean} Whether locked or not
 */
function isLocked(target, name){
	var locks = lockCache.get(target);
	return (locks && locks[name]);
}
},{}],3:[function(require,module,exports){
/**
 * A query engine (with no pseudo classes yet).
 *
 * @module queried/lib/index
 */

//TODO: jquery selectors
//TODO: test order of query result (should be compliant with querySelectorAll)
//TODO: third query param - include self
//TODO: .closest, .all, .next, .prev, .parent, .filter, .mathes etc methods - all with the same API: query(selector, [el], [incSelf], [within]).
//TODO: .all('.x', '.selector');
//TODO: use universal pseudo mapper/filter instead of separate ones.


var slice = require('sliced');
var unique = require('array-unique');
var getUid = require('get-uid');
var paren = require('parenthesis');
var isString = require('mutype/is-string');
var isArray = require('mutype/is-array');
var isArrayLike = require('mutype/is-array-like');
var arrayify = require('arrayify-compact');
var doc = require('get-doc');


/** Registered pseudos */
var pseudos = {};
var filters = {};
var mappers = {};


/** Regexp to grab pseudos with params */
var pseudoRE;


/**
 * Append a new filtering (classic) pseudo
 *
 * @param {string} name Pseudo name
 * @param {Function} filter A filtering function
 */
function registerFilter(name, filter, incSelf){
	if (pseudos[name]) return;

	//save pseudo filter
	pseudos[name] = filter;
	pseudos[name].includeSelf = incSelf;
	filters[name] = true;

	regenerateRegExp();
}


/**
 * Append a new mapping (relative-like) pseudo
 *
 * @param {string} name pseudo name
 * @param {Function} mapper map function
 */
function registerMapper(name, mapper, incSelf){
	if (pseudos[name]) return;

	pseudos[name] = mapper;
	pseudos[name].includeSelf = incSelf;
	mappers[name] = true;

	regenerateRegExp();
}


/** Update regexp catching pseudos */
function regenerateRegExp(){
	pseudoRE = new RegExp('::?(' + Object.keys(pseudos).join('|') + ')(\\\\[0-9]+)?');
}


/**
 * Query wrapper - main method to query elements.
 */
function queryMultiple(selector, el) {
	//ignore bad selector
	if (!selector) return [];

	//return elements passed as a selector unchanged (cover params case)
	if (!isString(selector)) return isArray(selector) ? selector : [selector];

	//catch polyfillable first `:scope` selector - just erase it, works just fine
	if (pseudos.scope) selector = selector.replace(/^\s*:scope/, '');

	//ignore non-queryable containers
	if (!el) el = [querySingle.document];

	//treat passed list
	else if (isArrayLike(el)) {
		el = arrayify(el);
	}

	//if element isn’t a node - make it q.document
	else if (!el.querySelector) {
		el = [querySingle.document];
	}

	//make any ok element a list
	else el = [el];

	return qPseudos(el, selector);
}


/** Query single element - no way better than return first of multiple selector */
function querySingle(selector, el){
	return queryMultiple(selector, el)[0];
}


/**
 * Return query result based off target list.
 * Parse and apply polyfilled pseudos
 */
function qPseudos(list, selector) {
	//ignore empty selector
	selector = selector.trim();
	if (!selector) return list;

	// console.group(selector);

	//scopify immediate children selector
	if (selector[0] === '>') {
		if (!pseudos.scope) {
			//scope as the first element in selector scopifies current element just ok
			selector = ':scope' + selector;
		}
		else {
			var id = getUid();
			list.forEach(function(el){el.setAttribute('__scoped', id);});
			selector = '[__scoped="' + id + '"]' + selector;
		}
	}

	var pseudo, pseudoFn, pseudoParam, pseudoParamId;

	//catch pseudo
	var parts = paren.parse(selector);
	var match = parts[0].match(pseudoRE);

	//if pseudo found
	if (match) {
		//grab pseudo details
		pseudo = match[1];
		pseudoParamId = match[2];

		if (pseudoParamId) {
			pseudoParam = paren.stringify(parts[pseudoParamId.slice(1)], parts);
		}

		//pre-select elements before pseudo
		var preSelector = paren.stringify(parts[0].slice(0, match.index), parts);

		//fix for query-relative
		if (!preSelector && !mappers[pseudo]) preSelector = '*';
		if (preSelector) list = qList(list, preSelector);


		//apply pseudo filter/mapper on the list
		pseudoFn = function(el) {return pseudos[pseudo](el, pseudoParam); };
		if (filters[pseudo]) {
			list = list.filter(pseudoFn);
		}
		else if (mappers[pseudo]) {
			list = unique(arrayify(list.map(pseudoFn)));
		}

		//shorten selector
		selector = parts[0].slice(match.index + match[0].length);

		// console.groupEnd();

		//query once again
		return qPseudos(list, paren.stringify(selector, parts));
	}

	//just query list
	else {
		// console.groupEnd();
		return qList(list, selector);
	}
}


/** Apply selector on a list of elements, no polyfilled pseudos */
function qList(list, selector){
	return unique(arrayify(list.map(function(el){
		return slice(el.querySelectorAll(selector));
	})));
}


/** Exports */
querySingle.all = queryMultiple;
querySingle.registerFilter = registerFilter;
querySingle.registerMapper = registerMapper;

/** Default document representative to use for DOM */
querySingle.document = doc;

module.exports = querySingle;
},{"array-unique":9,"arrayify-compact":10,"get-doc":12,"get-uid":14,"mutype/is-array":16,"mutype/is-array-like":15,"mutype/is-string":18,"parenthesis":19,"sliced":22}],4:[function(require,module,exports){
var q = require('..');

function has(el, subSelector){
	return !!q(subSelector, el);
}

module.exports = has;
},{"..":3}],5:[function(require,module,exports){
var q = require('..');

/** CSS4 matches */
function matches(el, selector){
	if (!el.parentNode) {
		var fragment = q.document.createDocumentFragment();
		fragment.appendChild(el);
	}

	return q.all(selector, el.parentNode).indexOf(el) > -1;
}

module.exports = matches;
},{"..":3}],6:[function(require,module,exports){
var matches = require('./matches');

function not(el, selector){
	return !matches(el, selector);
}

module.exports = not;
},{"./matches":5}],7:[function(require,module,exports){
var q = require('..');

module.exports = function root(el){
	return el === q.document.documentElement;
};
},{"..":3}],8:[function(require,module,exports){
/**
 * :scope pseudo
 * Return element if it has `scoped` attribute.
 *
 * @link http://dev.w3.org/csswg/selectors-4/#the-scope-pseudo
 */

module.exports = function scope(el){
	return el.hasAttribute('scoped');
};
},{}],9:[function(require,module,exports){
/*!
 * array-unique <https://github.com/jonschlinkert/array-unique>
 *
 * Copyright (c) 2014 Jon Schlinkert, contributors.
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function unique(arr) {
  if (!Array.isArray(arr)) {
    throw new TypeError('array-unique expects an array.');
  }

  var len = arr.length;
  var i = -1;

  while (i++ < len) {
    var j = i + 1;

    for (; j < arr.length; ++j) {
      if (arr[i] === arr[j]) {
        arr.splice(j--, 1);
      }
    }
  }
  return arr;
};

},{}],10:[function(require,module,exports){
/*!
 * arrayify-compact <https://github.com/jonschlinkert/arrayify-compact>
 *
 * Copyright (c) 2014 Jon Schlinkert, contributors.
 * Licensed under the MIT License
 */

'use strict';

var flatten = require('array-flatten');

module.exports = function(arr) {
  return flatten(!Array.isArray(arr) ? [arr] : arr)
    .filter(Boolean);
};

},{"array-flatten":11}],11:[function(require,module,exports){
/**
 * Recursive flatten function. Fastest implementation for array flattening.
 *
 * @param  {Array}  array
 * @param  {Array}  result
 * @param  {Number} depth
 * @return {Array}
 */
function flatten (array, result, depth) {
  for (var i = 0; i < array.length; i++) {
    if (depth > 0 && Array.isArray(array[i])) {
      flatten(array[i], result, depth - 1);
    } else {
      result.push(array[i]);
    }
  }

  return result;
}

/**
 * Flatten an array, with the ability to define a depth.
 *
 * @param  {Array}  array
 * @param  {Number} depth
 * @return {Array}
 */
module.exports = function (array, depth) {
  return flatten(array, [], depth || Infinity);
};

},{}],12:[function(require,module,exports){
/**
 * @module  get-doc
 */

var hasDom = require('has-dom');

module.exports = hasDom() ? document : null;
},{"has-dom":13}],13:[function(require,module,exports){
'use strict';
module.exports = function () {
	return typeof window !== 'undefined'
		&& typeof document !== 'undefined'
		&& typeof document.createElement === 'function';
};

},{}],14:[function(require,module,exports){
/** generate unique id for selector */
var counter = Date.now() % 1e9;

module.exports = function getUid(){
	return (Math.random() * 1e9 >>> 0) + (counter++);
};
},{}],15:[function(require,module,exports){
var isString = require('./is-string');
var isArray = require('./is-array');
var isFn = require('./is-fn');

//FIXME: add tests from http://jsfiddle.net/ku9LS/1/
module.exports = function (a){
	return isArray(a) || (a && !isString(a) && !a.nodeType && (typeof window != 'undefined' ? a != window : true) && !isFn(a) && typeof a.length === 'number');
}
},{"./is-array":16,"./is-fn":17,"./is-string":18}],16:[function(require,module,exports){
module.exports = function(a){
	return a instanceof Array;
}
},{}],17:[function(require,module,exports){
module.exports = function(a){
	return !!(a && a.apply);
}
},{}],18:[function(require,module,exports){
module.exports = function(a){
	return typeof a === 'string' || a instanceof String;
}
},{}],19:[function(require,module,exports){
/**
 * @module parenthesis
 */
module.exports = {
	parse: require('./parse'),
	stringify: require('./stringify')
};
},{"./parse":20,"./stringify":21}],20:[function(require,module,exports){
/**
 * @module  parenthesis/parse
 *
 * Parse a string with parenthesis.
 *
 * @param {string} str A string with parenthesis
 *
 * @return {Array} A list with parsed parens, where 0 is initial string.
 */

//TODO: implement sequential parser of this algorithm, compare performance.
module.exports = function(str, bracket){
	//pretend non-string parsed per-se
	if (typeof str !== 'string') return [str];

	var res = [], prevStr;

	bracket = bracket || '()';

	//create parenthesis regex
	var pRE = new RegExp(['\\', bracket[0], '[^\\', bracket[0], '\\', bracket[1], ']*\\', bracket[1]].join(''));

	function replaceToken(token, idx, str){
		//save token to res
		var refId = res.push(token.slice(1,-1));

		return '\\' + refId;
	}

	//replace paren tokens till there’s none
	while (str != prevStr) {
		prevStr = str;
		str = str.replace(pRE, replaceToken);
	}

	//save resulting str
	res.unshift(str);

	return res;
};
},{}],21:[function(require,module,exports){
/**
 * @module parenthesis/stringify
 *
 * Stringify an array/object with parenthesis references
 *
 * @param {Array|Object} arr An array or object where 0 is initial string
 *                           and every other key/value is reference id/value to replace
 *
 * @return {string} A string with inserted regex references
 */

//FIXME: circular references causes recursions here
//TODO: there’s possible a recursive version of this algorithm, so test it & compare
module.exports = function (str, refs, bracket){
	var prevStr;

	//pretend bad string stringified with no parentheses
	if (!str) return '';

	if (typeof str !== 'string') {
		bracket = refs;
		refs = str;
		str = refs[0];
	}

	bracket = bracket || '()';

	function replaceRef(token, idx, str){
		return bracket[0] + refs[token.slice(1)] + bracket[1];
	}

	while (str != prevStr) {
		prevStr = str;
		str = str.replace(/\\[0-9]+/, replaceRef);
	}

	return str;
};
},{}],22:[function(require,module,exports){
module.exports = exports = require('./lib/sliced');

},{"./lib/sliced":23}],23:[function(require,module,exports){

/**
 * An Array.prototype.slice.call(arguments) alternative
 *
 * @param {Object} args something with a length
 * @param {Number} slice
 * @param {Number} sliceEnd
 * @api public
 */

module.exports = function (args, slice, sliceEnd) {
  var ret = [];
  var len = args.length;

  if (0 === len) return ret;

  var start = slice < 0
    ? Math.max(0, slice + len)
    : slice || 0;

  if (sliceEnd !== undefined) {
    len = sliceEnd < 0
      ? sliceEnd + len
      : sliceEnd
  }

  while (len-- > start) {
    ret[len - start] = args[len];
  }

  return ret;
}


},{}],24:[function(require,module,exports){
/**
 * Picker class.
 * A controller for draggable.
 * Because it has some intermediate API:
 * - update
 * - value
 *
 * Note that it’s not an extension of draggable due to method names conflict, like update.
 */

var Draggable = require('draggy');
var defineState = require('define-state');
var emit = require('emmy/emit');
var on = require('emmy/on');
var off = require('emmy/off');
var css = require('mucss/css');
var Emitter = require('events');
var isFn = require('is-function');
var round = require('mumath/round');
var between = require('mumath/between');
var loop = require('mumath/loop');
var getUid = require('get-uid');
var isArray = require('is-array');
var extend = require('xtend/mutable');


module.exports = Picker;


var doc = document, root = document.documentElement;


/** The most precise step available. */
var MIN_STEP = 0.00001;


/** Default pageup/pagedown size, in steps */
var PAGE = 5;


/**
 * Picker instance
 *
 * @constructor
 */
function Picker (el, options) {
	if (!(this instanceof Picker)) return new Picker(el, options);

	var self = this;

	//ensure element
	if (!el) {
		el = doc.createElement('div');
	}
	el.classList.add('slidy-picker');
	self.element = el;

	if (options.pickerClass) el.classList.add(options.pickerClass);

	//generate self id
	self.id = getUid();
	self.ns = 'slidy-picker-' + self.id;
	if (!self.element.id) self.element.id = self.ns;

	//init draggable
	self.draggable = new Draggable(el, {
		threshold: 0,
		within: options.within,
		sniperSlowdown: 0.85,
		axis: 'x',
		repeat: self.repeat,
		releaseDuration: 80
	});

	//define type of picker
	defineState(self, 'type', self.type);

	//adopt options
	//should go before enabled to set up proper flags
	extend(self, options);

	//go enabled
	self.enable();

	//apply type of placement
	self.type = options.type;

	//detect step automatically based on min/max range (1/100 by default)
	//native behaviour is always 1, so ignore it
	if (options.step === undefined) {
		var range = Math.abs(self.max - self.min);
		self.step = range < 100 ? 0.1 : 1;
	}

	//calc undefined valuea as a middle of range
	if (options.value === undefined) {
		self.value = (self.min + self.max) * 0.5;
	}
}


var proto = Picker.prototype = Object.create(Emitter.prototype);


/** Enabled/Disabled state */
proto.enable = function () {
	var self = this;

	if (self.isEnabled) return self;
	self.isEnabled = true;

	if (self.aria) {
		//ARIAs
		self.element.removeAttribute('aria-disabled');
	}

	self.element.removeAttribute('disabled');

	//events
	on(self.draggable, 'dragstart.' + self.ns, function () {
		css(root, 'cursor', 'none');
		css(this.element, 'cursor', 'none');
	});
	on(self.draggable, 'drag', function () {
		//ignore animated state to avoid collisions of value
		if (self.release && self.draggable.isAnimated) return;

		var value = self.calcValue.apply(self, self.draggable.getCoords());

		self.value = value;

		//display snapping
		if (self.snap) {
			self.renderValue(self.value);
		}

	});
	on(self.draggable, 'dragend.' + self.ns, function () {
		if (self.release) {
			self.draggable.isAnimated = true;
		}

		self.renderValue(self.value);
		css(root, 'cursor', null);
		css(this.element, 'cursor', null);
	});

	if (self.keyboard) {
		//make focusable
		self.element.setAttribute('tabindex', 0);

		//kbd events
		//borrowed from native input range mixed with multithumb range
		//@ref http://access.aol.com/dhtml-style-guide-working-group/#slidertwothumb
		self._pressedKeys = [];
		on(self.element, 'keydown.' + self.ns, function (e) {
			//track pressed keys, to do diagonal movements
			self._pressedKeys[e.which] = true;

			if (e.which >= 33 && e.which <= 40) {
				e.preventDefault();

				self.value = self.handleKeys(self._pressedKeys, self.value, self.step, self.min, self.max);

				if (self.release) self.draggable.isAnimated = true;

				self.renderValue(self.value);
			}
		});
		on(self.element, 'keyup.' + self.ns, function (e) {
			self._pressedKeys[e.which] = false;
		});
	}

	return self;
};
proto.disable = function () {
	var self = this;

	self.isEnabled = false;

	if (self.aria) {
		//ARIAs
		self.element.setAttribute('aria-disabled', true);
	}

	self.element.setAttribute('disabled', true);

	//unbind events
	off(self.element,'dragstart.' + self.ns);
	off(self.element,'drag.' + self.ns);
	off(self.element,'dragend.' + self.ns);

	if (self.keyboard) {
		//make unfocusable
		self.element.setAttribute('tabindex', -1);
		off(self.element,'keydown.' + self.ns);
		off(self.element,'keyup.' + self.ns);
	}

	return self;
};


/** Default min/max values */
proto.min = 0;
proto.max = 100;


/** Default step to bind value. It is automatically detected, if isn’t passed. */
proto.step = 1;


/** Loose snapping while drag */
proto.snap = false;


/** Animate release movement */
proto.release = false;


/** Point picker isn’t constrained by it’s shape */
proto.point = false;


/** Picker alignment relative to the mouse. Redefined by slidy, but to prevent empty value it is set to number. */
proto.align = 0.5;


/** Current picker value wrapper */
Object.defineProperties(proto, {
	value: {
		set: function (value) {
			if (value === undefined) throw Error('Picker value cannot be undefined.');

			//apply repeat
			if (this.repeat) {
				if (isArray(value) && this.repeat === 'x') value[0] = loop(value[0], this.min[0], this.max[0]);
				else if (isArray(value) && this.repeat === 'y') value[1] = loop(value[1], this.min[1], this.max[1]);
				else value = loop(value, this.min, this.max);
			}

			//apply limiting
			value = between(value, this.min, this.max);

			//round value
			if (this.step) {
				if (isFn(this.step)) value = round(value, this.step(value));
				else value = round(value, this.step);
			}

			this._value = value;

			//trigger bubbling event, like all inputs do
			this.emit('change', value);
			emit(this.element, 'change', value, true);
		},
		get: function () {
			return this._value;
		}
	}
});


/**
 * Move picker visually to the value passed.
 * Supposed to be redefined by type
 *
 * @param {number} value Value to render
 *
 * @return {Picker} Self instance
 */
proto.renderValue = function (value) {};


/**
 * Calc value from the picker position
 * Supposed to be redefined by type
 *
 * @return {number} Value, min..max
 */
proto.calcValue = function (x, y) {};


/**
 * Update value based on keypress. Supposed to be redefined in type of picker.
 */
proto.handleKeys = function (key, value, step) {};


/** Update self size, pin & position, according to the value */
proto.update = function () {
	//update pin - may depend on element’s size
	if (this.point) {
		this.draggable.pin = [
			this.draggable.offsets.width * this.align,
			this.draggable.offsets.height * this.align
		];
	}

	//update draggable limits
	this.draggable.update();

	//update position according to the value
	this.renderValue(this.value);

	return this;
};


/** Move picker to the x, y relative coordinates */
proto.move = function (x, y) {
	var self = this;

	//correct point placement
	if (self.point) {
		var cx = this.draggable.pin.width * this.align;
		var cy = this.draggable.pin.height * this.align;
		x = x - this.draggable.pin[0] - cx;
		y = y - this.draggable.pin[1] - cy;
	}

	//if thumb is more than visible area - subtract overflow coord
	var overflowX = this.draggable.pin.width - this.element.parentNode.clientWidth;
	var overflowY = this.draggable.pin.height - this.element.parentNode.clientHeight;
	if (overflowX > 0) x -= overflowX;
	if (overflowY > 0) y -= overflowY;

	this.draggable.move(x, y);

	//set value
	this.value = this.calcValue(x, y);

	return this;
};


/**
 * Move picker to the point of click with the centered drag point
 */
proto.startDrag = function (e) {
	var self = this;

	//update drag limits based off event passed
	self.draggable.setTouch(e).update(e);

	//start drag
	//ignore if already drags
	if (self.draggable.state !== 'drag') {
		self.draggable.state = 'drag';
	}

	//centrize picker
	self.draggable.innerOffsetX = self.draggable.pin[0] + self.draggable.pin.width * 0.5;
	self.draggable.innerOffsetY = self.draggable.pin[1] + self.draggable.pin.height * 0.5;

	//emulate move
	self.draggable.drag(e);

	return this;
};


/** Make it active. */
proto.focus = function () {
	var self = this;
	self.element.focus();
};
proto.blur = function () {
	var self = this;
	self.element.blur();
};


/**
 * Placing type
 * @enum {string}
 * @default 'horizontal'
 */
proto.type = {
	//default orientation is horizontal
	_: 'horizontal',

	horizontal: function () {
		var self = this;

		self.draggable.axis = 'x';

		//place pickers according to the value
		self.renderValue = function (value) {
			var	lims = self.draggable.limits,
				scope = lims.right - lims.left,
				range = self.max - self.min,
				ratio = (value - self.min) / range,
				x = ratio * scope;

			// console.log('render', value, ' : ', x)

			self.move(x);

			return self;
		};

		//round value on each drag
		self.calcValue = function (x) {
			var lims = self.draggable.limits,
				scope = lims.right - lims.left,
				normalValue = (x - lims.left) / scope;

			var value = normalValue * (self.max - self.min) + self.min;
			// console.log('calc', x, ' : ', value);

			return value;
		};

		self.handleKeys = handle1dkeys;
	},
	vertical: function () {
		var self = this;
		self.draggable.axis = 'y';

		//place pickers according to the value
		self.renderValue = function (value) {
			var	lims = self.draggable.limits,
				scope = lims.bottom - lims.top,
				range = self.max - self.min,
				ratio = (-value + self.max) / range,
				y = ratio * scope;
			self.move(null, y);

			return self;
		};

		//round value on each drag
		self.calcValue = function (x, y) {
			var lims = self.draggable.limits,
				scope = lims.bottom - lims.top,
				normalValue = (-y + lims.bottom) / scope;

			return normalValue * (self.max - self.min) + self.min;
		};

		self.handleKeys = handle1dkeys;
	},
	rectangular: function () {
		var self = this;
		self.draggable.axis = null;

		self.renderValue = function (value) {
			var	lim = self.draggable.limits,
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top);
			var hRange = self.max[0] - self.min[0],
				vRange = self.max[1] - self.min[1],
				ratioX = (value[0] - self.min[0]) / hRange,
				ratioY = (-value[1] + self.max[1]) / vRange;

			self.move(ratioX * hScope, ratioY * vScope);

			return self;
		};

		self.calcValue = function (x, y) {
			var lim = self.draggable.limits,
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top);

			var normalValue = [(x - lim.left) / hScope, ( - y + lim.bottom) / vScope];

			return [
				normalValue[0] * (self.max[0] - self.min[0]) + self.min[0],
				normalValue[1] * (self.max[1] - self.min[1]) + self.min[1]
			];
		};

		self.handleKeys = handle2dkeys;
	},
	circular: function () {
		var self = this;
		self.draggable.axis = null;

		//limit x/y by the circumference
		self.draggable.move = function (x, y) {
			var lim = this.limits;
			var hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top);

			var cx = hScope / 2 - this.pin[0],
				cy = vScope / 2 - this.pin[1];

			var angle = Math.atan2(y - cy, x - cx);

			this.setCoords(
				Math.cos(angle) * (cx + this.pin[0]) + cx,
				Math.sin(angle) * (cy + this.pin[1]) + cy
			);
		};

		self.renderValue = function (value) {
			var	lim = self.draggable.limits,
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top),
				centerX = hScope * 0.5,
				centerY = vScope * 0.5;

			var range = self.max - self.min;

			var	normalValue = (value - self.min) / range;
			var angle = (normalValue - 0.5) * 2 * Math.PI;
			self.move(
				Math.cos(angle) * centerX + centerX,
				Math.sin(angle) * centerY + centerY
			);
		};

		self.calcValue = function (x, y) {
			var lim = self.draggable.limits,
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top);

			x = x - hScope * 0.5 + self.draggable.pin[0];
			y = y - vScope * 0.5 + self.draggable.pin[1];

			//get angle
			var angle = Math.atan2( y, x );

			//get normal value
			var normalValue = angle * 0.5 / Math.PI + 0.5;

			//get value from coords
			return normalValue * (self.max - self.min) + self.min;
		};

		self.handleKeys = handle1dkeys;
	},
	round: function () {
		var self = this;
		self.draggable.axis = null;

		//limit x/y within the circle
		self.draggable.move = function (x, y) {
			var lim = this.limits;
			var hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top);

			var cx = hScope / 2 - this.pin[0],
				cy = vScope / 2 - this.pin[1];
			var dx = x - cx,
				dy = y - cy;

			var angle = Math.atan2(y - cy, x - cx);
			var r = Math.sqrt(dx * dx + dy * dy);

			//limit max radius as a circumference
			this.setCoords(
				(r > hScope / 2) ? Math.cos(angle) * (cx + this.pin[0]) + cx : x,
				(r > vScope / 2) ? Math.sin(angle) * (cy + this.pin[1]) + cy : y
			);
		};

		self.renderValue = function (value) {
			var	lim = self.draggable.limits,
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top),
				centerX = hScope * 0.5,
				centerY = vScope * 0.5;

			//get angle normal value
			var aRange = self.max[0] - self.min[0];
			var	normalAngleValue = (value[0] - self.min[0]) / aRange;
			var angle = (normalAngleValue - 0.5) * 2 * Math.PI;

			//get radius normal value
			var rRange = self.max[1] - self.min[1];
			var normalRadiusValue = (value[1] - self.min[1]) / rRange;

			var xRadius = centerX * normalRadiusValue;
			var yRadius = centerY * normalRadiusValue;

			self.move(
				Math.cos(angle) * xRadius + centerX,
				Math.sin(angle) * yRadius + centerY
			);
		};

		self.calcValue = function (x, y) {
			var lim = self.draggable.limits,
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top);

			x = x + self.draggable.pin[0] - hScope * 0.5;
			y = y + self.draggable.pin[1] - vScope * 0.5;

			//get angle
			var angle = Math.atan2( y, x );

			//get normal value
			var normalAngleValue = (angle * 0.5 / Math.PI + 0.5);
			var normalRadiusValue = Math.sqrt( x*x + y*y ) / hScope * 2;

			//get value from coords
			return [
				normalAngleValue * (self.max[0] - self.min[0]) + self.min[0],
				normalRadiusValue * (self.max[1] - self.min[1]) + self.min[1]
			];
		};

		self.handleKeys = handle2dkeys;
	}
};


/** Increment / decrement API */
proto.inc = function (timesX, timesY) {
	if (isArray(this.value)) {
		this.value[0] = inc(this.value[0], this.step, timesX);
		this.value[1] = inc(this.value[1], this.step, timesY);
		this.renderValue(this.value);
	} else {
		var times = timesY || timesX;
		this.value = inc(this.value, this.step, times);
		this.renderValue(this.value);
	}
};


/** Increment & decrement value by the step [N times] */
function inc (value, step, mult) {
	mult = mult || 0;

	if (isFn(step)) step = step(value + (mult > 0 ? + MIN_STEP : - MIN_STEP));

	return value + step * mult;
}


/** Apply pressed keys on the 2d value */
function handle2dkeys (keys, value, step, min, max) {
	//up and right - increase by one
	if (keys[38]) {
		value[1] = inc(value[1], step, 1);
	}
	if (keys[39]) {
		value[0] = inc(value[0], step, 1);
	}
	if (keys[40]) {
		value[1] = inc(value[1], step, -1);
	}
	if (keys[37]) {
		value[0] = inc(value[0], step, -1);
	}

	//meta
	var coordIdx = 1;
	if (keys[18] || keys[91] || keys[17] || keys[16]) coordIdx = 0;
	//home - min
	if (keys[36]) {
		value[coordIdx] = min[coordIdx];
	}

	//end - max
	if (keys[35]) {
		value[coordIdx] = max[coordIdx];
	}

	//pageup
	if (keys[33]) {
		value[coordIdx] = inc(value[coordIdx], step, PAGE);
	}

	//pagedown
	if (keys[34]) {
		value[coordIdx] = inc(value[coordIdx], step, -PAGE);
	}


	return value;
}


/** Apply pressed keys on the 1d value */
function handle1dkeys (keys, value, step, min, max) {
	step = step || 1;

	//up and right - increase by one
	if (keys[38] || keys[39]) {
		value = inc(value, step, 1);
	}

	//down and left - decrease by one
	if (keys[40] || keys[37]) {
		value = inc(value, step, -1);
	}

	//home - min
	if (keys[36]) {
		value = min;
	}

	//end - max
	if (keys[35]) {
		value = max;
	}

	//pageup
	if (keys[33]) {
		value = inc(value, step, PAGE);
	}

	//pagedown
	if (keys[34]) {
		value = inc(value, step, -PAGE);
	}

	return value;
}
},{"define-state":25,"draggy":26,"emmy/emit":28,"emmy/off":33,"emmy/on":"emmy/on","events":66,"get-uid":37,"is-array":38,"is-function":39,"mucss/css":43,"mumath/between":53,"mumath/loop":54,"mumath/round":56,"xtend/mutable":65}],25:[function(require,module,exports){
/**
 * Define stateful property on an object
 */
module.exports = defineState;

var State = require('st8');


/**
 * Define stateful property on a target
 *
 * @param {object} target Any object
 * @param {string} property Property name
 * @param {object} descriptor State descriptor
 *
 * @return {object} target
 */
function defineState (target, property, descriptor, isFn) {
	//define accessor on a target
	if (isFn) {
		target[property] = function () {
			if (arguments.length) {
				return state.set(arguments[0]);
			}
			else {
				return state.get();
			}
		};
	}

	//define setter/getter on a target
	else {
		Object.defineProperty(target, property, {
			set: function (value) {
				return state.set(value);
			},
			get: function () {
				return state.get();
			}
		});
	}

	//define state controller
	var state = new State(descriptor, target);

	return target;
}
},{"st8":62}],26:[function(require,module,exports){
/**
 * Simple draggable component
 *
 * @module draggy
 */


//work with css
var css = require('mucss/css');
var parseCSSValue = require('mucss/parse-value');
var selection = require('mucss/selection');
var offsets = require('mucss/offsets');
var getTranslate = require('mucss/translate');

//events
var on = require('emmy/on');
var off = require('emmy/off');
var emit = require('emmy/emit');
var Emitter = require('events');
var getClientX = require('get-client-xy').x;
var getClientY = require('get-client-xy').y;

//utils
var isArray = require('is-array');
var isNumber = require('is-number');
var isFn = require('is-function');
var defineState = require('define-state');
var extend = require('xtend/mutable');
var round = require('mumath/round');
var between = require('mumath/between');
var loop = require('mumath/loop');
var getUid = require('get-uid');


var win = window, doc = document, root = doc.documentElement;


/**
 * Draggable controllers associated with elements.
 *
 * Storing them on elements is
 * - leak-prone,
 * - pollutes element’s namespace,
 * - requires some artificial key to store,
 * - unable to retrieve controller easily.
 *
 * That is why weakmap.
 */
var draggableCache = Draggable.cache = new WeakMap;



/**
 * Make an element draggable.
 *
 * @constructor
 *
 * @param {HTMLElement} target An element whether in/out of DOM
 * @param {Object} options An draggable options
 *
 * @return {HTMLElement} Target element
 */
function Draggable(target, options) {
	if (!(this instanceof Draggable)) return new Draggable(target, options);

	var self = this;

	//get unique id for instance
	//needed to track event binders
	self._id = getUid();
	self._ns = '.draggy_' + self._id;

	//save element passed
	self.element = target;
	draggableCache.set(target, self);

	//define mode of drag
	defineState(self, 'css3', self.css3);
	self.css3 = true;

	//define state behaviour
	defineState(self, 'state', self.state);
	self.state = 'idle';

	//define axis behaviour
	defineState(self, 'axis', self.axis);
	self.axis = null;

	//define anim mode
	defineState(self, 'isAnimated', self.isAnimated);

	//take over options
	extend(self, options);

	//try to calc out basic limits
	self.update();
}


/** Inherit draggable from Emitter */
var proto = Draggable.prototype = Object.create(Emitter.prototype);


/**
 * Draggable behaviour
 * @enum {string}
 * @default is 'idle'
 */
proto.state = {
	//idle
	_: {
		before: function () {
			var self = this;

			//emit drag evts on element
			emit(self.element, 'idle', null, true);
			self.emit('idle');

			//bind start drag
			on(self.element, 'mousedown' + self._ns + ' touchstart' + self._ns, function (e) {
				e.preventDefault();

				//multitouch has multiple starts
				self.setTouch(e);

				//update movement params
				self.update(e);

				//go to threshold state
				self.state = 'threshold';
			});
		},
		after: function () {
			var self = this;

			off(self.element, 'touchstart' + self._ns + ' mousedown' + self._ns);

			//set up tracking
			if (self.release) {
				self._trackingInterval = setInterval(function (e) {
					var now = Date.now();
					var elapsed = now - self.timestamp;

					//get delta movement since the last track
					var dX = self.prevX - self.frame[0];
					var dY = self.prevY - self.frame[1];
					self.frame[0] = self.prevX;
					self.frame[1] = self.prevY;

					var delta = Math.sqrt(dX * dX + dY * dY);

					//get speed as average of prev and current (prevent div by zero)
					var v = Math.min(self.velocity * delta / (1 + elapsed), self.maxSpeed);
					self.speed = 0.8 * v + 0.2 * self.speed;

					//get new angle as a last diff
					//NOTE: vector average isn’t the same as speed scalar average
					self.angle = Math.atan2(dY, dX);

					self.emit('track');

					return self;
				}, self.framerate);
			}
		}
	},

	threshold: {
		before: function () {
			var self = this;

			//ignore threshold state, if threshold is none
			if (isZeroArray(self.threshold)) {
				self.state = 'drag';
				return;
			}

			//emit drag evts on element
			self.emit('threshold');

			//listen to doc movement
			on(doc, 'touchmove' + self._ns + ' mousemove' + self._ns, function (e) {
				e.preventDefault();

				//compare movement to the threshold
				var clientX = getClientX(e, self.touchIdx);
				var clientY = getClientY(e, self.touchIdx);
				var difX = self.prevMouseX - clientX;
				var difY = self.prevMouseY - clientY;

				if (difX < self.threshold[0] || difX > self.threshold[2] || difY < self.threshold[1] || difY > self.threshold[3]) {
					self.update(e);

					self.state = 'drag';
				}
			});
			on(doc, 'mouseup' + self._ns + ' touchend' + self._ns + '', function (e) {
				e.preventDefault();

				//forget touches
				self.resetTouch();

				self.state = 'idle';
			});
		},

		after: function () {
			var self = this;
			off(doc, 'touchmove' + self._ns + ' mousemove' + self._ns + ' mouseup' + self._ns + ' touchend' + self._ns);
		}
	},

	drag: {
		before: function () {
			var self = this;

			//reduce dragging clutter
			selection.disable(root);

			//emit drag evts on element
			self.emit('dragstart');
			emit(self.element, 'dragstart', null, true);

			//emit drag events on self
			self.emit('drag');
			emit(self.element, 'drag', null, true);

			//stop drag on leave
			on(doc, 'touchend' + self._ns + ' mouseup' + self._ns + ' mouseleave' + self._ns, function (e) {
				e.preventDefault();

				//forget touches - dragend is called once
				self.resetTouch();

				//manage release movement
				if (self.speed > 1) {
					self.state = 'release';
				}

				else {
					self.state = 'idle';
				}
			});

			//move via transform
			on(doc, 'touchmove' + self._ns + ' mousemove' + self._ns, function (e) {
				self.drag(e);
			});
		},

		after: function () {
			var self = this;

			//enable document interactivity
			selection.enable(root);

			//emit dragend on element, this
			self.emit('dragend');
			emit(self.element, 'dragend', null, true);

			//unbind drag events
			off(doc, 'touchend' + self._ns + ' mouseup' + self._ns + ' mouseleave' + self._ns);
			off(doc, 'touchmove' + self._ns + ' mousemove' + self._ns);
			clearInterval(self._trackingInterval);
		}
	},

	release: {
		before: function () {
			var self = this;

			//enter animation mode
			self.isAnimated = true;

			//calc target point & animate to it
			self.move(
				self.prevX + self.speed * Math.cos(self.angle),
				self.prevY + self.speed * Math.sin(self.angle)
			);

			self.speed = 0;
			self.emit('track');

			self.state = 'idle';
		}
	}
};


/** Drag handler. Needed to provide drag movement emulation via API */
proto.drag = function (e) {
	var self = this;

	e.preventDefault();

	var mouseX = getClientX(e, self.touchIdx),
		mouseY = getClientY(e, self.touchIdx);

	//calc mouse movement diff
	var diffMouseX = mouseX - self.prevMouseX,
		diffMouseY = mouseY - self.prevMouseY;

	//absolute mouse coordinate
	var mouseAbsX = mouseX + win.pageXOffset,
		mouseAbsY = mouseY + win.pageYOffset;

	//calc sniper offset, if any
	if (e.ctrlKey || e.metaKey) {
		self.sniperOffsetX += diffMouseX * self.sniperSlowdown;
		self.sniperOffsetY += diffMouseY * self.sniperSlowdown;
	}

	//calc movement x and y
	//take absolute placing as it is the only reliable way (2x proved)
	var x = (mouseAbsX - self.initOffsetX) - self.innerOffsetX - self.sniperOffsetX,
		y = (mouseAbsY - self.initOffsetY) - self.innerOffsetY - self.sniperOffsetY;

	//move element
	self.move(x, y);

	//save prevClientXY for calculating diff
	self.prevMouseX = mouseX;
	self.prevMouseY = mouseY;

	//emit drag
	self.emit('drag');
	emit(self.element, 'drag', null, true);
};


/** Current number of draggable touches */
var touches = 0;


/** Manage touches */
proto.setTouch = function (e) {
	if (!e.touches || this.isTouched()) return this;

	this.touchIdx = touches;
	touches++;

	return this;
};
proto.resetTouch = function () {
	touches = 0;
	this.touchIdx = null;

	return this;
};
proto.isTouched = function () {
	return this.touchIdx !== null;
};


/** Animation mode, automatically offed once onned */
proto.isAnimated = {
	true: {
		before: function () {
			var self = this;


			clearTimeout(self._animateTimeout);

			//set proper transition
			css(self.element, {
				'transition': (self.releaseDuration) + 'ms ease-out ' + (self.css3 ? 'transform' : 'position')
			});

			//plan leaving anim mode
			self._animateTimeout = setTimeout(function () {
				self.isAnimated = false;
			}, self.releaseDuration);
		},
		after: function () {
			css(this.element, {
				'transition': null
			});
		}
	}
};


/** Index to fetch touch number from event */
proto.touchIdx = null;


/**
 * Update movement limits.
 * Refresh self.withinOffsets and self.limits.
 */
proto.update = function (e) {
	var self = this;

	//initial translation offsets
	var initXY = self.getCoords();

	//calc initial coords
	self.prevX = initXY[0];
	self.prevY = initXY[1];

	//container rect might be outside the vp, so calc absolute offsets
	//zero-position offsets, with translation(0,0)
	var selfOffsets = offsets(self.element);
	self.initOffsetX = selfOffsets.left - self.prevX;
	self.initOffsetY = selfOffsets.top - self.prevY;
	self.offsets = selfOffsets;

	//handle parent case
	if (self.within === 'parent') self.within = self.element.parentNode || doc;

	//absolute offsets of a container
	var withinOffsets = offsets(self.within);
	self.withinOffsets = withinOffsets;

	//calculate movement limits - pin width might be wider than constraints
	self.overflowX = self.pin.width - withinOffsets.width;
	self.overflowY = self.pin.height - withinOffsets.height;
	self.limits = {
		left: withinOffsets.left - self.initOffsetX - self.pin[0] - (self.overflowX < 0 ? 0 : self.overflowX),
		top: withinOffsets.top - self.initOffsetY - self.pin[1] - (self.overflowY < 0 ? 0 : self.overflowY),
		right: self.overflowX > 0 ? 0 : withinOffsets.right - self.initOffsetX - self.pin[2],
		bottom: self.overflowY > 0 ? 0 : withinOffsets.bottom - self.initOffsetY - self.pin[3]
	};

	//preset inner offsets
	self.innerOffsetX = self.pin[0];
	self.innerOffsetY = self.pin[1];

	var selfClientRect = self.element.getBoundingClientRect();

	//if event passed - update acc to event
	if (e) {
		//take last mouse position from the event
		self.prevMouseX = getClientX(e, self.touchIdx);
		self.prevMouseY = getClientY(e, self.touchIdx);

		//if mouse is within the element - take offset normally as rel displacement
		self.innerOffsetX = -selfClientRect.left + getClientX(e, self.touchIdx);
		self.innerOffsetY = -selfClientRect.top + getClientY(e, self.touchIdx);
	}
	//if no event - suppose pin-centered event
	else {
		//take mouse position & inner offset as center of pin
		var pinX = (self.pin[0] + self.pin[2] ) * 0.5;
		var pinY = (self.pin[1] + self.pin[3] ) * 0.5;
		self.prevMouseX = selfClientRect.left + pinX;
		self.prevMouseY = selfClientRect.top + pinY;
		self.innerOffsetX = pinX;
		self.innerOffsetY = pinY;
	}

	//set initial kinetic props
	self.speed = 0;
	self.amplitude = 0;
	self.angle = 0;
	self.timestamp = +new Date();
	self.frame = [self.prevX, self.prevY];

	//set sniper offset
	self.sniperOffsetX = 0;
	self.sniperOffsetY = 0;
};


/**
 * Way of placement:
 * - position === false (slower but more precise and cross-browser)
 * - translate3d === true (faster but may cause blurs on linux systems)
 */
proto.css3 = {
	_: function () {
		this.getCoords = function () {
			// return [this.element.offsetLeft, this.element.offsetTop];
			return [parseCSSValue(css(this.element,'left')), parseCSSValue(css(this.element, 'top'))];
		};

		this.setCoords = function (x, y) {
			css(this.element, {
				left: x,
				top: y
			});

			//save prev coords to use as a start point next time
			this.prevX = x;
			this.prevY = y;
		};
	},

	//undefined placing is treated as translate3d
	true: function () {
		this.getCoords  = function () {
			return getTranslate(this.element) || [0,0];
		};

		this.setCoords = function (x, y) {
			x = round(x, this.precition);
			y = round(y, this.precition);

			css(this.element, 'transform', ['translate3d(', x, 'px,', y, 'px, 0)'].join(''));

			//save prev coords to use as a start point next time
			this.prevX = x;
			this.prevY = y;
		};
	}
};


/**
 * Restricting container
 * @type {Element|object}
 * @default doc.documentElement
 */
proto.within = doc;



Object.defineProperties(proto, {
	/**
	 * Which area of draggable should not be outside the restriction area.
	 * @type {(Array|number)}
	 * @default [0,0,this.element.offsetWidth, this.element.offsetHeight]
	 */
	pin: {
		set: function (value) {
			if (isArray(value)) {
				if (value.length === 2) {
					this._pin = [value[0], value[1], value[0], value[1]];
				} else if (value.length === 4) {
					this._pin = value;
				}
			}

			else if (isNumber(value)) {
				this._pin = [value, value, value, value];
			}

			else {
				this._pin = value;
			}

			//calc pin params
			this._pin.width = this._pin[2] - this._pin[0];
			this._pin.height = this._pin[3] - this._pin[1];
		},

		get: function () {
			if (this._pin) return this._pin;

			//returning autocalculated pin, if private pin is none
			var pin = [0,0, this.offsets.width, this.offsets.height];
			pin.width = this.offsets.width;
			pin.height = this.offsets.height;
			return pin;
		}
	},

	/** Avoid initial mousemove */
	threshold: {
		set: function (val) {
			if (isNumber(val)) {
				this._threshold = [-val*0.5, -val*0.5, val*0.5, val*0.5];
			} else if (val.length === 2) {
				//Array(w,h)
				this._threshold = [-val[0]*0.5, -val[1]*0.5, val[0]*0.5, val[1]*0.5];
			} else if (val.length === 4) {
				//Array(x1,y1,x2,y2)
				this._threshold = val;
			} else if (isFn(val)) {
				//custom val funciton
				this._threshold = val();
			} else {
				this._threshold = [0,0,0,0];
			}
		},

		get: function () {
			return this._threshold || [0,0,0,0];
		}
	}
});



/**
 * For how long to release movement
 *
 * @type {(number|false)}
 * @default false
 * @todo
 */
proto.release = false;
proto.releaseDuration = 500;
proto.velocity = 1000;
proto.maxSpeed = 250;
proto.framerate = 50;


/** To what extent round position */
proto.precision = 1;


/** Slow down movement by pressing ctrl/cmd */
proto.sniper = true;


/** How much to slow sniper drag */
proto.sniperSlowdown = .85;


/**
 * Restrict movement by axis
 *
 * @default undefined
 * @enum {string}
 */
proto.axis = {
	_: function () {
		this.move = function (x, y) {
			var limits = this.limits;

			if (this.repeat) {
				var w = (limits.right - limits.left);
				var h = (limits.bottom - limits.top);
				var oX = - this.initOffsetX + this.withinOffsets.left - this.pin[0] - Math.max(0, this.overflowX);
				var oY = - this.initOffsetY + this.withinOffsets.top - this.pin[1] - Math.max(0, this.overflowY);
				if (this.repeat === 'x') {
					x = loop(x - oX, w) + oX;
				}
				else if (this.repeat === 'y') {
					y = loop(y - oY, h) + oY;
				}
				else {
					x = loop(x - oX, w) + oX;
					y = loop(y - oY, h) + oY;
				}
			}

			x = between(x, limits.left, limits.right);
			y = between(y, limits.top, limits.bottom);

			this.setCoords(x, y);
		};
	},
	x: function () {
		this.move = function (x, y) {
			var limits = this.limits;

			if (this.repeat) {
				var w = (limits.right - limits.left);
				var oX = - this.initOffsetX + this.withinOffsets.left - this.pin[0] - Math.max(0, this.overflowX);
				x = loop(x - oX, w) + oX;
			} else {
				x = between(x, limits.left, limits.right);
			}

			this.setCoords(x, this.prevY);
		};
	},
	y: function () {
		this.move = function (x, y) {
			var limits = this.limits;

			if (this.repeat) {
				var h = (limits.bottom - limits.top);
				var oY = - this.initOffsetY + this.withinOffsets.top - this.pin[1] - Math.max(0, this.overflowY);
				y = loop(y - oY, h) + oY;
			} else {
				y = between(y, limits.top, limits.bottom);
			}

			this.setCoords(this.prevX, y);
		};
	}
};


/** Repeat movement by one of axises */
proto.repeat = false;


/** Check whether arr is filled with zeros */
function isZeroArray(arr) {
	if (!arr[0] && !arr[1] && !arr[2] && !arr[3]) return true;
}


module.exports = Draggable;
},{"define-state":25,"emmy/emit":28,"emmy/off":33,"emmy/on":"emmy/on","events":66,"get-client-xy":36,"get-uid":37,"is-array":38,"is-function":39,"is-number":27,"mucss/css":43,"mucss/offsets":47,"mucss/parse-value":48,"mucss/selection":51,"mucss/translate":52,"mumath/between":53,"mumath/loop":54,"mumath/round":56,"xtend/mutable":65}],27:[function(require,module,exports){
/*!
 * is-number <https://github.com/jonschlinkert/is-number>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

module.exports = function isNumber(n) {
  return (!!(+n) && !Array.isArray(n)) && isFinite(n)
    || n === '0'
    || n === 0;
};

},{}],28:[function(require,module,exports){
/**
 * @module emmy/emit
 */
var icicle = require('icicle');
var slice = require('sliced');
var isString = require('mutype/is-string');
var isNode = require('mutype/is-node');
var isEvent = require('mutype/is-event');
var listeners = require('./listeners');


/**
 * A simple wrapper to handle stringy/plain events
 */
module.exports = function(target, evt){
	if (!target) return;

	var args = arguments;
	if (isString(evt)) {
		args = slice(arguments, 2);
		evt.split(/\s+/).forEach(function(evt){
			evt = evt.split('.')[0];

			emit.apply(this, [target, evt].concat(args));
		});
	} else {
		return emit.apply(this, args);
	}
};


/** detect env */
var $ = typeof jQuery === 'undefined' ? undefined : jQuery;
var doc = typeof document === 'undefined' ? undefined : document;
var win = typeof window === 'undefined' ? undefined : window;


/**
 * Emit an event, optionally with data or bubbling
 * Accept only single elements/events
 *
 * @param {string} eventName An event name, e. g. 'click'
 * @param {*} data Any data to pass to event.details (DOM) or event.data (elsewhere)
 * @param {bool} bubbles Whether to trigger bubbling event (DOM)
 *
 *
 * @return {target} a target
 */
function emit(target, eventName, data, bubbles){
	var emitMethod, evt = eventName;

	//Create proper event for DOM objects
	if (isNode(target) || target === win) {
		//NOTE: this doesnot bubble on off-DOM elements

		if (isEvent(eventName)) {
			evt = eventName;
		} else {
			//IE9-compliant constructor
			evt = doc.createEvent('CustomEvent');
			evt.initCustomEvent(eventName, bubbles, true, data);

			//a modern constructor would be:
			// var evt = new CustomEvent(eventName, { detail: data, bubbles: bubbles })
		}

		emitMethod = target.dispatchEvent;
	}

	//create event for jQuery object
	else if ($ && target instanceof $) {
		//TODO: decide how to pass data
		evt = $.Event( eventName, data );
		evt.detail = data;

		//FIXME: reference case where triggerHandler needed (something with multiple calls)
		emitMethod = bubbles ? targte.trigger : target.triggerHandler;
	}

	//detect target events
	else {
		//emit - default
		//trigger - jquery
		//dispatchEvent - DOM
		//raise - node-state
		//fire - ???
		emitMethod = target['emit'] || target['trigger'] || target['fire'] || target['dispatchEvent'] || target['raise'];
	}


	var args = slice(arguments, 2);


	//use locks to avoid self-recursion on objects wrapping this method
	if (emitMethod) {
		if (icicle.freeze(target, 'emit' + eventName)) {
			//use target event system, if possible
			emitMethod.apply(target, [evt].concat(args));
			icicle.unfreeze(target, 'emit' + eventName);

			return target;
		}

		//if event was frozen - probably it is emitter instance
		//so perform normal callback
	}


	//fall back to default event system
	var evtCallbacks = listeners(target, evt);

	//copy callbacks to fire because list can be changed by some callback (like `off`)
	var fireList = slice(evtCallbacks);
	for (var i = 0; i < fireList.length; i++ ) {
		fireList[i] && fireList[i].apply(target, args);
	}

	return target;
}
},{"./listeners":29,"icicle":30,"mutype/is-event":58,"mutype/is-node":60,"mutype/is-string":61,"sliced":31}],29:[function(require,module,exports){
arguments[4][1][0].apply(exports,arguments)
},{"dup":1}],30:[function(require,module,exports){
arguments[4][2][0].apply(exports,arguments)
},{"dup":2}],31:[function(require,module,exports){
arguments[4][22][0].apply(exports,arguments)
},{"./lib/sliced":32,"dup":22}],32:[function(require,module,exports){
arguments[4][23][0].apply(exports,arguments)
},{"dup":23}],33:[function(require,module,exports){
/**
 * @module emmy/off
 */
module.exports = off;

var icicle = require('icicle');
var slice = require('sliced');
var listeners = require('./listeners');


/**
 * Remove listener[s] from the target
 *
 * @param {[type]} evt [description]
 * @param {Function} fn [description]
 *
 * @return {[type]} [description]
 */
function off(target, evt, fn) {
	if (!target) return target;

	var callbacks, i;

	//unbind all listeners if no fn specified
	if (fn === undefined) {
		var args = slice(arguments, 1);

		//try to use target removeAll method, if any
		var allOff = target['removeAll'] || target['removeAllListeners'];

		//call target removeAll
		if (allOff) {
			allOff.apply(target, args);
		}


		//then forget own callbacks, if any

		//unbind all evts
		if (!evt) {
			callbacks = listeners(target);
			for (evt in callbacks) {
				off(target, evt);
			}
		}
		//unbind all callbacks for an evt
		else {
			//invoke method for each space-separated event from a list
			evt.split(/\s+/).forEach(function (evt) {
				var evtParts = evt.split('.');
				evt = evtParts.shift();
				callbacks = listeners(target, evt, evtParts);
				for (var i = callbacks.length; i--;) {
					off(target, evt, callbacks[i]);
				}
			});
		}

		return target;
	}


	//target events (string notation to advanced_optimizations)
	var offMethod = target['off'] || target['removeEventListener'] || target['removeListener'] || target['detachEvent'];

	//invoke method for each space-separated event from a list
	evt.split(/\s+/).forEach(function (evt) {
		var evtParts = evt.split('.');
		evt = evtParts.shift();

		//use target `off`, if possible
		if (offMethod) {
			//avoid self-recursion from the outside
			if (icicle.freeze(target, 'off' + evt)) {
				offMethod.call(target, evt, fn);
				icicle.unfreeze(target, 'off' + evt);
			}

			//if it’s frozen - ignore call
			else {
				return target;
			}
		}

		if (fn.closedCall) fn.closedCall = false;

		//forget callback
		listeners.remove(target, evt, fn, evtParts);
	});


	return target;
}
},{"./listeners":29,"icicle":30,"sliced":31}],34:[function(require,module,exports){
/**
 * @module emmy/on
 */


var icicle = require('icicle');
var listeners = require('./listeners');


module.exports = on;


/**
 * Bind fn to a target.
 *
 * @param {*} targte A single target to bind evt
 * @param {string} evt An event name
 * @param {Function} fn A callback
 * @param {Function}? condition An optional filtering fn for a callback
 *                              which accepts an event and returns callback
 *
 * @return {object} A target
 */
function on(target, evt, fn){
	if (!target) return target;

	//get target `on` method, if any
	var onMethod = target['on'] || target['addEventListener'] || target['addListener'] || target['attachEvent'];

	var cb = fn;

	//invoke method for each space-separated event from a list
	evt.split(/\s+/).forEach(function(evt){
		var evtParts = evt.split('.');
		evt = evtParts.shift();

		//use target event system, if possible
		if (onMethod) {
			//avoid self-recursions
			//if it’s frozen - ignore call
			if (icicle.freeze(target, 'on' + evt)){
				onMethod.call(target, evt, cb);
				icicle.unfreeze(target, 'on' + evt);
			}
			else {
				return target;
			}
		}

		//save the callback anyway
		listeners.add(target, evt, cb, evtParts);
	});

	return target;
}


/**
 * Wrap an fn with condition passing
 */
on.wrap = function(target, evt, fn, condition){
	var cb = function() {
		if (condition.apply(target, arguments)) {
			return fn.apply(target, arguments);
		}
	};

	cb.fn = fn;

	return cb;
};
},{"./listeners":29,"icicle":30}],35:[function(require,module,exports){
/**
 * Throttle function call.
 *
 * @module emmy/throttle
 */


module.exports = throttle;

var on = require('./on');
var off = require('./off');
var isFn = require('mutype/is-fn');



/**
 * Throttles call by rebinding event each N seconds
 *
 * @param {Object} target Any object to throttle
 * @param {string} evt An event name
 * @param {Function} fn A callback
 * @param {int} interval A minimum interval between calls
 *
 * @return {Function} A wrapped callback
 */
function throttle (target, evt, fn, interval) {
	//FIXME: find cases where objects has own throttle method, then use target’s throttle

	//bind wrapper
	return on(target, evt, throttle.wrap(target, evt, fn, interval));
}


/** Return wrapped with interval fn */
throttle.wrap = function (target, evt, fn, interval) {
	//swap params, if needed
	if (isFn(interval)) {
		var tmp = interval;
		interval = fn;
		fn = tmp;
	}

	//wrap callback
	var cb = function () {
		//opened state
		if (!cb.closedInterval) {
			//clear closed call flag
			cb.closedCall = false;

			//do call
			fn.apply(target, arguments);

			//close till the interval is passed
			cb.closedInterval = setTimeout(function () {
				//reset interval
				cb.closedInterval = null;

				//do after-call
				if (cb.closedCall) cb.apply(target, arguments);
			}, interval);
		}

		//closed state
		else {
			//if trigger happened during the pause - defer it’s call
			cb.closedCall = true;
		}
	};

	cb.fn = fn;

	return cb;
};
},{"./off":33,"./on":34,"mutype/is-fn":59}],36:[function(require,module,exports){
/**
 * Get clientY/clientY from an event.
 * If index is passed, treat it as index of global touches, not the targetTouches.
 * It is because global touches are more generic.
 *
 * @module get-client-xy
 *
 * @param {Event} e Event raised, like mousemove
 *
 * @return {number} Coordinate relative to the screen
 */
function getClientY (e, idx) {
	// touch event
	if (e.touches) {
		if (arguments.length > 1) {
			return e.touches[idx].clientY;
		}
		else {
			return e.targetTouches[0].clientY;
		}
	}

	// mouse event
	return e.clientY;
}
function getClientX (e, idx) {
	// touch event
	if (e.touches) {
		if (arguments.length > 1) {
			return e.touches[idx].clientX;
		}
		else {
			return e.targetTouches[0].clientX;
		}
	}

	// mouse event
	return e.clientX;
}

function getClientXY (e, idx) {
	return [getClientX(e, idx), getClientY(e, idx)];
}

getClientXY.x = getClientX;
getClientXY.y = getClientY;

module.exports = getClientXY;
},{}],37:[function(require,module,exports){
arguments[4][14][0].apply(exports,arguments)
},{"dup":14}],38:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],39:[function(require,module,exports){
module.exports = isFunction

var toString = Object.prototype.toString

function isFunction (fn) {
  var string = toString.call(fn)
  return string === '[object Function]' ||
    (typeof fn === 'function' && string !== '[object RegExp]') ||
    (typeof window !== 'undefined' &&
     // IE8 and below
     (fn === window.setTimeout ||
      fn === window.alert ||
      fn === window.confirm ||
      fn === window.prompt))
};

},{}],40:[function(require,module,exports){
var on = require('emmy/on');
var emit = require('emmy/emit');
var off = require('emmy/off');
var getElements = require('tiny-element');


var doc = document, win = window;


/**
 * @module lifecycle-events
 *
 * @todo  Work out tolerance issue (whether it needs to be passed as an option - sometimes useful, like to detect an element being fully visible)
 *
 * @todo  Optimize enabled selectors. For example, avoid extra enabling if you have '*' enabled. And so on.
 * @todo  Testling table.
 * @todo  Ignore native CustomElements lifecycle events
 *
 * @note  Nested queryselector ten times faster than doc.querySelector:
 *        http://jsperf.com/document-vs-element-queryselectorall-performance/2
 * @note  Multiple observations to an extent faster than one global observer:
 *        http://jsperf.com/mutation-observer-cases
 */
var lifecycle = module.exports = enable;
lifecycle.enable = enable;
lifecycle.disable = disable;


/** Defaults can be changed outside */
lifecycle.attachedCallbackName = 'attached';
lifecycle.detachedCallbackName = 'detached';


/** One observer to observe a lot of nodes  */
var MO = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;

var observer = new MO(mutationHandler);


/** Set of targets to observe */
var mTargets = [];


/** Attached items set */
var attachedItemsSet = new WeakSet;


/**
 * Observer targets
 *
 * @param {(string|Node|NodeList|document)} query Target pointer
 * @param {Object} within Settings for observer
 */
function enable(query, within) {
	if (!query) query = '*';

	within = getElements(within || doc);

	//save cached version of target
	mTargets.push(query);

	//make observer observe one more target
	observer.observe(within, {subtree: true, childList: true});

	//ignore not bound nodes
	if (query instanceof Node && !doc.contains(query)) return;

	//check initial nodes
	checkAddedNodes(getElements.call(within, query, true));
}


/**
 * Stop observing items
 */
function disable(target) {
	var idx = mTargets.indexOf(target);
	if (idx >= 0) {
		mTargets.splice(idx,1);
	}
}


/**
 * Handle a mutation passed
 */
function mutationHandler(mutations) {
	mutations.forEach(function(mutation) {
		checkAddedNodes(mutation.addedNodes);
		checkRemovedNodes(mutation.removedNodes);
	});
}


/**
 * Check nodes list to call attached
 */
function checkAddedNodes(nodes) {
	var newItems = false, node;

	//find attached evt targets
	for (var i = nodes.length; i--;) {
		node = nodes[i];
		if (node.nodeType !== 1) continue;

		//find options corresponding to the node
		if (!attachedItemsSet.has(node)) {
			node = getObservee(node);
			//if observee found within attached items - add it to set
			if (node) {
				if (!newItems) {
					newItems = true;
				}
				attachedItemsSet.add(node);
				emit(node, lifecycle.attachedCallbackName, null, true);
			}
		}
	}
}


/**
 * Check nodes list to call detached
 */
function checkRemovedNodes(nodes) {
	//handle detached evt
	for (var i = nodes.length; i--;) {
		var node = nodes[i];
		if (node.nodeType !== 1) continue;

		//find options corresponding to the node
		if (attachedItemsSet.has(node)) {
			emit(node, lifecycle.detachedCallbackName, null, true);
			attachedItemsSet.delete(node);
		}
	}
}


/**
 * Check whether node is observing
 *
 * @param {Node} node An element to check on inclusion to target list
 */
function getObservee(node) {
	//check queries
	for (var i = mTargets.length, target; i--;) {
		target = mTargets[i];
		if (node === target) return node;
		if (typeof target === 'string' && node.matches(target)) return node;

		//return innermost target
		if (node.contains(target)) return target;
	}
}
},{"emmy/emit":28,"emmy/off":33,"emmy/on":"emmy/on","tiny-element":41}],41:[function(require,module,exports){
var slice = [].slice;

module.exports = function (selector, multiple) {
  var ctx = this === window ? document : this;

  return (typeof selector == 'string')
    ? (multiple) ? slice.call(ctx.querySelectorAll(selector), 0) : ctx.querySelector(selector)
    : (selector instanceof Node || selector === window || !selector.length) ? (multiple ? [selector] : selector) : slice.call(selector, 0);
};
},{}],42:[function(require,module,exports){
/**
 * Simple rect constructor.
 * It is just faster and smaller than constructing an object.
 *
 * @module mucss/Rect
 *
 * @param {number} l left
 * @param {number} t top
 * @param {number} r right
 * @param {number} b bottom
 * @param {number}? w width
 * @param {number}? h height
 *
 * @return {Rect} A rectangle object
 */
module.exports = function Rect (l,t,r,b,w,h) {
	this.top=t||0;
	this.bottom=b||0;
	this.left=l||0;
	this.right=r||0;
	if (w!==undefined) this.width=w||this.right-this.left;
	if (h!==undefined) this.height=h||this.bottom-this.top;
};
},{}],43:[function(require,module,exports){
/**
 * Get or set element’s style, prefix-agnostic.
 *
 * @module  mucss/css
 */
var fakeStyle = require('./fake-element').style;
var prefix = require('./prefix').dom;


/**
 * Apply styles to an element.
 *
 * @param    {Element}   el   An element to apply styles.
 * @param    {Object|string}   obj   Set of style rules or string to get style rule.
 */
module.exports = function(el, obj){
	if (!el || !obj) return;

	var name, value;

	//return value, if string passed
	if (typeof obj === 'string') {
		name = obj;

		//return value, if no value passed
		if (arguments.length < 3) {
			return el.style[prefixize(name)];
		}

		//set style, if value passed
		value = arguments[2] || '';
		obj = {};
		obj[name] = value;
	}

	for (name in obj){
		//convert numbers to px
		if (typeof obj[name] === 'number' && /left|right|bottom|top|width|height/i.test(name)) obj[name] += 'px';

		value = obj[name] || '';

		el.style[prefixize(name)] = value;
	}
};


/**
 * Return prefixized prop name, if needed.
 *
 * @param    {string}   name   A property name.
 * @return   {string}   Prefixed property name.
 */
function prefixize(name){
	var uName = name[0].toUpperCase() + name.slice(1);
	if (fakeStyle[name] !== undefined) return name;
	if (fakeStyle[prefix + uName] !== undefined) return prefix + uName;
	return '';
}

},{"./fake-element":44,"./prefix":49}],44:[function(require,module,exports){
/** Just a fake element to test styles
 * @module mucss/fake-element
 */

module.exports = document.createElement('div');
},{}],45:[function(require,module,exports){
/**
 * Window scrollbar detector.
 *
 * @module mucss/has-scroll
 */
exports.x = function(){
	return window.innerHeight > document.documentElement.clientHeight;
};
exports.y = function(){
	return window.innerWidth > document.documentElement.clientWidth;
};
},{}],46:[function(require,module,exports){
/**
 * Detect whether element is placed to fixed container or is fixed itself.
 *
 * @module mucss/is-fixed
 *
 * @param {(Element|Object)} el Element to detect fixedness.
 *
 * @return {boolean} Whether element is nested.
 */
module.exports = function (el) {
	var parentEl = el;

	//window is fixed, btw
	if (el === window) return true;

	//unlike the doc
	if (el === document) return false;

	while (parentEl) {
		if (getComputedStyle(parentEl).position === 'fixed') return true;
		parentEl = parentEl.offsetParent;
	}
	return false;
};
},{}],47:[function(require,module,exports){
/**
 * Calculate absolute offsets of an element, relative to the document.
 *
 * @module mucss/offsets
 *
 */
var win = window;
var doc = document;
var Rect = require('./Rect');
var hasScroll = require('./has-scroll');
var scrollbar = require('./scrollbar');
var isFixedEl = require('./is-fixed');

/**
 * Return absolute offsets of any target passed
 *
 * @param    {Element|window}   el   A target. Pass window to calculate viewport offsets
 * @return   {Object}   Offsets object with trbl.
 */
module.exports = offsets;

function offsets (el) {
	if (!el) throw Error('Bad argument');

	//calc client rect
	var cRect, result;

	//return vp offsets
	if (el === win) {
		result = new Rect(
			win.pageXOffset,
			win.pageYOffset
		);

		result.width = win.innerWidth - (hasScroll.y() ? scrollbar : 0),
		result.height = win.innerHeight - (hasScroll.x() ? scrollbar : 0)
		result.right = result.left + result.width;
		result.bottom = result.top + result.height;

		return result;
	}

	//return absolute offsets if document requested
	else if (el === doc) {
		var res = offsets(doc.documentElement);
		res.bottom = Math.max(window.innerHeight, res.bottom);
		res.right = Math.max(window.innerWidth, res.right);
		if (hasScroll.y(doc.documentElement)) res.right -= scrollbar;
		if (hasScroll.x(doc.documentElement)) res.bottom -= scrollbar;
		return res;
	}

	//FIXME: why not every element has getBoundingClientRect method?
	try {
		cRect = el.getBoundingClientRect();
	} catch (e) {
		cRect = new Rect(
			el.clientLeft,
			el.clientTop
		);
	}

	//whether element is or is in fixed
	var isFixed = isFixedEl(el);
	var xOffset = isFixed ? 0 : win.pageXOffset;
	var yOffset = isFixed ? 0 : win.pageYOffset;

	result = new Rect(
		cRect.left + xOffset,
		cRect.top + yOffset,
		cRect.left + xOffset + el.offsetWidth,
		cRect.top + yOffset + el.offsetHeight,
		el.offsetWidth,
		el.offsetHeight
	);

	return result;
};
},{"./Rect":42,"./has-scroll":45,"./is-fixed":46,"./scrollbar":50}],48:[function(require,module,exports){
/**
 * Returns parsed css value.
 *
 * @module mucss/parse-value
 *
 * @param {string} str A string containing css units value
 *
 * @return {number} Parsed number value
 */
module.exports = function (str){
	str += '';
	return parseFloat(str.slice(0,-2)) || 0;
};

//FIXME: add parsing units
},{}],49:[function(require,module,exports){
/**
 * Vendor prefixes
 * Method of http://davidwalsh.name/vendor-prefix
 * @module mucss/prefix
 */

var styles = getComputedStyle(document.documentElement, '');

var pre = (Array.prototype.slice.call(styles)
	.join('')
	.match(/-(moz|webkit|ms)-/) || (styles.OLink === '' && ['', 'o'])
)[1];

dom = ('WebKit|Moz|MS|O').match(new RegExp('(' + pre + ')', 'i'))[1];

module.exports = {
	dom: dom,
	lowercase: pre,
	css: '-' + pre + '-',
	js: pre[0].toUpperCase() + pre.substr(1)
};
},{}],50:[function(require,module,exports){
/**
 * Calculate scrollbar width.
 *
 * @module mucss/scrollbar
 */

// Create the measurement node
var scrollDiv = document.createElement("div");

var style = scrollDiv.style;

style.width = '100px';
style.height = '100px';
style.overflow = 'scroll';
style.position = 'absolute';
style.top = '-9999px';

document.documentElement.appendChild(scrollDiv);

// the scrollbar width
module.exports = scrollDiv.offsetWidth - scrollDiv.clientWidth;

// Delete fake DIV
document.documentElement.removeChild(scrollDiv);
},{}],51:[function(require,module,exports){
/**
 * Enable/disable selectability of an element
 * @module mucss/selection
 */
var css = require('./css');


/**
 * Disable or Enable any selection possibilities for an element.
 *
 * @param    {Element}   el   Target to make unselectable.
 */
exports.disable = function(el){
	css(el, {
		'user-select': 'none',
		'user-drag': 'none',
		'touch-callout': 'none'
	});
	el.setAttribute('unselectable', 'on');
	el.addEventListener('selectstart', pd);
};
exports.enable = function(el){
	css(el, {
		'user-select': null,
		'user-drag': null,
		'touch-callout': null
	});
	el.removeAttribute('unselectable');
	el.removeEventListener('selectstart', pd);
};


/** Prevent you know what. */
function pd(e){
	e.preventDefault();
}
},{"./css":43}],52:[function(require,module,exports){
/**
 * Parse translate3d
 *
 * @module mucss/translate
 */

var css = require('./css');
var parseValue = require('./parse-value');

module.exports = function (el) {
	var translateStr = css(el, 'transform');

	//find translate token, retrieve comma-enclosed values
	//translate3d(1px, 2px, 2) → 1px, 2px, 2
	//FIXME: handle nested calcs
	var match = /translate(?:3d)?\s*\(([^\)]*)\)/.exec(translateStr);

	if (!match) return null;
	var values = match[1].split(/\s*,\s*/);

	//parse values
	//FIXME: nested values are not necessarily pixels
	return values.map(function (value) {
		return parseValue(value);
	});
};
},{"./css":43,"./parse-value":48}],53:[function(require,module,exports){
/**
 * Clamper.
 * Detects proper clamp min/max.
 *
 * @param {number} a Current value to cut off
 * @param {number} min One side limit
 * @param {number} max Other side limit
 *
 * @return {number} Clamped value
 */

module.exports = require('./wrap')(function(a, min, max){
	return max > min ? Math.max(Math.min(a,max),min) : Math.max(Math.min(a,min),max);
});
},{"./wrap":57}],54:[function(require,module,exports){
/**
 * @module  mumath/loop
 *
 * Looping function for any framesize
 */

module.exports = require('./wrap')(function (value, left, right) {
	//detect single-arg case, like mod-loop
	if (right === undefined) {
		right = left;
		left = 0;
	}

	//swap frame order
	if (left > right) {
		var tmp = right;
		right = left;
		left = tmp;
	}

	var frame = right - left;

	value = ((value + left) % frame) - left;
	if (value < left) value += frame;
	if (value > right) value -= frame;

	return value;
});
},{"./wrap":57}],55:[function(require,module,exports){
/**
 * @module  mumath/precision
 *
 * Get precision from float:
 *
 * @example
 * 1.1 → 1, 1234 → 0, .1234 → 4
 *
 * @param {number} n
 *
 * @return {number} decimap places
 */

module.exports = require('./wrap')(function(n){
	var s = n + '',
		d = s.indexOf('.') + 1;

	return !d ? 0 : s.length - d;
});
},{"./wrap":57}],56:[function(require,module,exports){
/**
 * Precision round
 *
 * @param {number} value
 * @param {number} step Minimal discrete to round
 *
 * @return {number}
 *
 * @example
 * toPrecision(213.34, 1) == 213
 * toPrecision(213.34, .1) == 213.3
 * toPrecision(213.34, 10) == 210
 */
var precision = require('./precision');

module.exports = require('./wrap')(function(value, step) {
	if (step === 0) return value;
	if (!step) return Math.round(value);
	step = parseFloat(step);
	value = Math.round(value / step) * step;
	return parseFloat(value.toFixed(precision(step)));
});
},{"./precision":55,"./wrap":57}],57:[function(require,module,exports){
/**
 * Get fn wrapped with array/object attrs recognition
 *
 * @return {Function} Target function
 */
module.exports = function(fn){
	return function(a){
		var args = arguments;
		if (a instanceof Array) {
			var result = new Array(a.length), slice;
			for (var i = 0; i < a.length; i++){
				slice = [];
				for (var j = 0, l = args.length, val; j < l; j++){
					val = args[j] instanceof Array ? args[j][i] : args[j];
					val = val;
					slice.push(val);
				}
				result[i] = fn.apply(this, slice);
			}
			return result;
		}
		else if (typeof a === 'object') {
			var result = {}, slice;
			for (var i in a){
				slice = [];
				for (var j = 0, l = args.length, val; j < l; j++){
					val = typeof args[j] === 'object' ? args[j][i] : args[j];
					val = val;
					slice.push(val);
				}
				result[i] = fn.apply(this, slice);
			}
			return result;
		}
		else {
			return fn.apply(this, args);
		}
	};
};
},{}],58:[function(require,module,exports){
module.exports = function(target){
	return typeof Event !== 'undefined' && target instanceof Event;
};
},{}],59:[function(require,module,exports){
arguments[4][17][0].apply(exports,arguments)
},{"dup":17}],60:[function(require,module,exports){
module.exports = function(target){
	return typeof document !== 'undefined' && target instanceof Node;
};
},{}],61:[function(require,module,exports){
arguments[4][18][0].apply(exports,arguments)
},{"dup":18}],62:[function(require,module,exports){
/**
 * @module  st8
 *
 * Micro state machine.
 */


var Emitter = require('events');
var isFn = require('is-function');
var isObject = require('is-plain-object');


/** Defaults */

State.options = {
	leaveCallback: 'after',
	enterCallback: 'before',
	changeCallback: 'change',
	remainderState: '_'
};


/**
 * Create a new state controller based on states passed
 *
 * @constructor
 *
 * @param {object} settings Initial states
 */

function State(states, context){
	//ignore existing state
	if (states instanceof State) return states;

	//ensure new state instance is created
	if (!(this instanceof State)) return new State(states);

	//save states object
	this.states = states || {};

	//save context
	this.context = context || this;

	//initedFlag
	this.isInit = false;
}


/** Inherit State from Emitter */

var proto = State.prototype = Object.create(Emitter.prototype);


/**
 * Go to a state
 *
 * @param {*} value Any new state to enter
 */

proto.set = function (value) {
	var oldValue = this.state, states = this.states;
	// console.group('set', value, oldValue);

	//leave old state
	var oldStateName = states[oldValue] !== undefined ? oldValue : State.options.remainderState;
	var oldState = states[oldStateName];

	var leaveResult, leaveFlag = State.options.leaveCallback + oldStateName;

	if (this.isInit) {
		if (isObject(oldState)) {
			if (!this[leaveFlag]) {
				this[leaveFlag] = true;

				//if oldstate has after method - call it
				leaveResult = getValue(oldState, State.options.leaveCallback, this.context);

				//ignore changing if leave result is falsy
				if (leaveResult === false) {
					this[leaveFlag] = false;
					// console.groupEnd();
					return false;
				}

				//redirect, if returned anything
				else if (leaveResult !== undefined && leaveResult !== value) {
					this.set(leaveResult);
					this[leaveFlag] = false;
					// console.groupEnd();
					return false;
				}

				this[leaveFlag] = false;

				//ignore redirect
				if (this.state !== oldValue) {
					return;
				}
			}

		}

		//ignore not changed value
		if (value === oldValue) return false;
	}
	else {
		this.isInit = true;
	}


	//set current value
	this.state = value;


	//try to enter new state
	var newStateName = states[value] !== undefined ? value : State.options.remainderState;
	var newState = states[newStateName];
	var enterFlag = State.options.enterCallback + newStateName;
	var enterResult;

	if (!this[enterFlag]) {
		this[enterFlag] = true;

		if (isObject(newState)) {
			enterResult = getValue(newState, State.options.enterCallback, this.context);
		} else {
			enterResult = getValue(states, newStateName, this.context);
		}

		//ignore entering falsy state
		if (enterResult === false) {
			this.set(oldValue);
			this[enterFlag] = false;
			// console.groupEnd();
			return false;
		}

		//redirect if returned anything but current state
		else if (enterResult !== undefined && enterResult !== value) {
			this.set(enterResult);
			this[enterFlag] = false;
			// console.groupEnd();
			return false;
		}

		this[enterFlag] = false;
	}



	//notify change
	if (value !== oldValue)	{
		this.emit(State.options.changeCallback, value, oldValue);
	}


	// console.groupEnd();

	//return context to chain calls
	return this.context;
};


/** Get current state */

proto.get = function(){
	return this.state;
};


/** Return value or fn result */
function getValue(holder, meth, ctx){
	if (isFn(holder[meth])) {
		return holder[meth].call(ctx);
	}

	return holder[meth];
}


module.exports = State;
},{"events":66,"is-function":39,"is-plain-object":63}],63:[function(require,module,exports){
/*!
 * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

var isObject = require('isobject');

function isObjectObject(o) {
  return isObject(o) === true
    && Object.prototype.toString.call(o) === '[object Object]';
}

module.exports = function isPlainObject(o) {
  var ctor,prot;
  
  if (isObjectObject(o) === false) return false;
  
  // If has modified constructor
  ctor = o.constructor;
  if (typeof ctor !== 'function') return false;
  
  // If has modified prototype
  prot = ctor.prototype;
  if (isObjectObject(prot) === false) return false;
  
  // If constructor does not have an Object-specific method
  if (prot.hasOwnProperty('isPrototypeOf') === false) {
    return false;
  }
  
  // Most likely a plain Object
  return true;
};

},{"isobject":64}],64:[function(require,module,exports){
/*!
 * isobject <https://github.com/jonschlinkert/isobject>
 *
 * Copyright (c) 2014 Jon Schlinkert, contributors.
 * Licensed under the MIT License
 */

'use strict';

/**
 * is the value an object, and not an array?
 *
 * @param  {*} `value`
 * @return {Boolean}
 */

module.exports = function isObject(o) {
  return o != null && typeof o === 'object'
    && !Array.isArray(o);
};
},{}],65:[function(require,module,exports){
module.exports = extend

function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],66:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],"emmy/on":[function(require,module,exports){
arguments[4][34][0].apply(exports,arguments)
},{"./listeners":1,"dup":34,"icicle":2}],"queried":[function(require,module,exports){
/**
 * @module  queried/css4
 *
 * CSS4 query selector.
 */


var doc = require('get-doc');
var q = require('./lib/');


/**
 * Detect unsupported css4 features, polyfill them
 */

//detect `:scope`
try {
	doc.querySelector(':scope');
}
catch (e) {
	q.registerFilter('scope', require('./lib/pseudos/scope'));
}


//detect `:has`
try {
	doc.querySelector(':has');
}
catch (e) {
	q.registerFilter('has', require('./lib/pseudos/has'));

	//polyfilled :has requires artificial :not to make `:not(:has(...))`.
	q.registerFilter('not', require('./lib/pseudos/not'));
}


//detect `:root`
try {
	doc.querySelector(':root');
}
catch (e) {
	q.registerFilter('root', require('./lib/pseudos/root'));
}


//detect `:matches`
try {
	doc.querySelector(':matches');
}
catch (e) {
	q.registerFilter('matches', require('./lib/pseudos/matches'));
}


module.exports = q;
},{"./lib/":3,"./lib/pseudos/has":4,"./lib/pseudos/matches":5,"./lib/pseudos/not":6,"./lib/pseudos/root":7,"./lib/pseudos/scope":8,"get-doc":12}],"slidy":[function(require,module,exports){
/**
 * Slidy - customizable slider component.
 *
 * @module slidy
 */

var Picker = require('./lib/picker');

var extend = require('xtend/mutable');
var isArray = require('is-array');

var lifecycle = require('lifecycle-events');
var Emitter = require('events');
var on = require('emmy/on');
var off = require('emmy/off');
var throttle = require('emmy/throttle');
var getClientX = require('get-client-xy').x;
var getClientY = require('get-client-xy').y;
var getUid = require('get-uid');


var win = window, doc = document;


module.exports = Slidy;


/** Cache of instances. Just as it is safer than keeping them on targets. */
var instancesCache = Slidy.cache = new WeakMap();


/**
 * Create slider over a target
 * @constructor
 */
function Slidy(target, options) {
	//force constructor
	if (!(this instanceof Slidy)) return new Slidy(target, options);

	var self = this;

	options = options || {};

	//ensure element, if not defined
	if (!target) target = doc.createElement('div');


	//get preferred element
	self.element = target;

	//adopt options
	extend(self, options);

	//save refrence
	instancesCache.set(self.element, self);

	//generate id
	self.id = getUid();
	self.ns = 'slidy-' + self.id;
	if (!self.element.id) self.element.id = self.ns;

	//init instance
	self.element.classList.add('slidy');


	//create pickers, if passed a list
	self.pickers = [];
	if (isArray(options.pickers) && options.pickers.length) {
		options.pickers.forEach(function (opts) {
			//if opts is element - treat it as element for the picker
			if (opts instanceof Node) opts = {
				element: opts
			};

			var picker = self.createPicker(opts);
			self.pickers.push(picker);

			//update picker’s value, to trigger change
			if (opts.value !== undefined) picker.value = opts.value;
		});
	}
	//ensure at least one picker exists
	else {
		self.pickers.push(self.createPicker());

		//init first picker’s value
		if (options.value !== undefined) self.value = options.value;
	}


	// Define value as active picker value getter
	Object.defineProperty(self, 'value', {
		set: function (value) {
			this.pickers[0].value = value;
		},
		get: function () {
			return this.pickers[0].value;
		}
	});


	if (self.aria) {
		//a11y
		//@ref http://www.w3.org/TR/wai-aria/roles#slider
		self.element.setAttribute('role', 'slider');
		target.setAttribute('aria-valuemax', self.max);
		target.setAttribute('aria-valuemin', self.min);
		target.setAttribute('aria-orientation', self.type);
		target.setAttribute('aria-atomic', true);

		//update controls
		target.setAttribute('aria-controls', self.pickers.map(
			function (item) {
				return item.element.id;
			}).join(' '));
	}

	//turn on events etc
	if (!self.element.hasAttribute('disabled')) self.enable();

	//emit callback
	self.emit('created');
}


var proto = Slidy.prototype = Object.create(Emitter.prototype);


/**
 * Default range
 */
proto.min = 0;
proto.max = 100;
proto.value = 50;


/** Default placing type is horizontal */
proto.type = 'horizontal';


/**
 * Repeat either by one or both axis
 *
 * @enum {bool}
 * @default true
 */
proto.repeat = false;


/** Interaction settings */
proto.keyboard = true;
proto.aria = true;
proto.wheel = true;
proto.click = true;
proto.point = false;


/** Picker alignment relative to the mouse */
proto.align = 0.5;


/** Enable/disable */
proto.enable = function () {
	var self = this;

	if (self.isEnabled) return self;
	self.isEnabled = true;

	if (self.aria) {
		//ARIAs
		self.element.removeAttribute('aria-disabled');
	}

	self.element.removeAttribute('disabled');

	//Events
	// Update pickers position on the first load and resize
	throttle(win, 'resize.' + self.ns, 20, function () {
		self.update();
	});

	//observe when slider is inserted
	on(self.element, 'attached.' + self.ns, function (e) {
		self.update();
	});
	lifecycle.enable(self.element);

	//distribute multitouch event to closest pickers
	if (self.click) {
		on(self.element, 'touchstart.'  + self.ns + ' mousedown.' + self.ns, function (e) {
			e.preventDefault();

			//focus on container programmatically
			//in that case might be a multifocus
			self.element.focus();

			var selfClientRect = self.element.getBoundingClientRect();

			//list of active pickers
			var pickers = [], picker, x, y;


			if (e.touches) {
				//get coords relative to the container (this)
				for (var i = 0, l = e.touches.length; i < l; i++) {
					x = getClientX(e, i) - selfClientRect.left;
					y = getClientY(e, i) - selfClientRect.top;

					//find closest picker not taken already
					picker = self.getClosestPicker(self.pickers.filter(function (p) {
						return pickers.indexOf(p) < 0;
					}), x, y);
					pickers.push(picker);

					//move picker to the point of click
					picker.move(x,y).startDrag(e);
				}
			} else {
				//get coords relative to the container (this)
				x = getClientX(e) - selfClientRect.left;
				y = getClientY(e) - selfClientRect.top;

				//make closest picker active
				picker = self.getClosestPicker(self.pickers, x, y);
				pickers.push(picker);

				//move picker to the point of click
				picker.move(x,y).startDrag(e);

				//focus picker (not always focusable)
				picker.focus();
			}

			//disable every picker except for the active one
			// - some other pickers might be clicked occasionally
			self.pickers.forEach(function (ipicker) {
				if (pickers.indexOf(ipicker) < 0) {
					ipicker.draggable.state = 'idle';
				}
			});
		});
	}

	if (self.wheel) {
		on(self.element, 'wheel.' + self.ns + ' mousewheel' + self.ns, function (e) {
			//get focused element
			var focusEl = doc.activeElement, picker;

			var selfClientRect = self.element.getBoundingClientRect();

			//detect picker closest to the place of wheel
			if (focusEl === self.element) {
				var x = getClientX(e) - selfClientRect.left;
				var y = getClientY(e) - selfClientRect.top;

				picker = self.getClosestPicker(self.pickers, x, y);

				picker.focus();
			}
			//handle current picker
			else if (focusEl.parentNode === self.element) {
				picker = self.pickers.filter(function (p) {
					return p.element === focusEl;
				})[0];
			}
			//ignore unfocused things
			else return;

			//ignore doc scroll
			e.preventDefault();

			//move it according to the wheel diff
			var stepX = 0, stepY = 0;
			if (e.deltaX !== 0) {
				stepX = e.deltaX * 2 / (selfClientRect.width);
				stepX = stepX > 0 ? Math.ceil(stepX) : Math.floor(stepX);
				//invert x
				stepX = -stepX;
			}
			if (e.deltaY !== 0) {
				stepY = e.deltaY * 2 / (selfClientRect.height);
				stepY = stepY > 0 ? Math.ceil(stepY) : Math.floor(stepY);
			}

			picker.inc(stepX, stepY);
		});
	}

	if (self.keyboard) {
		//set unfocusable always (redirect to first picker)
		self.element.setAttribute('tabindex', -1);
	}

	//enable pickers
	self.pickers.forEach(function (picker) {
		picker.enable();
	});

	return self;
};


/**
 * Disable interactivity
 *
 * @return {Slidy}
 */
proto.disable = function () {
	var self = this;

	self.isEnabled = false;

	if (self.aria) {
		//ARIAs
		self.element.setAttribute('aria-disabled', true);
	}

	self.element.setAttribute('disabled', true);

	//unbind events
	off(win, 'resize.' + self.ns );
	off(self.element, 'attached.' + self.ns );
	off(self.element, 'mousedown.' + self.ns );
	off(self.element, 'touchstart.' + self.ns );

	//unbind pickers
	self.pickers.forEach(function (picker) {
		picker.disable();
	});

	return self;
};


/**
 * Update all pickers limits & position
 * according to values
 */
proto.update = function () {
	//update pickers limits & placement
	//pickers size might depend on doc size
	this.pickers.forEach(function (picker) {
		picker.update();
	});
};


/**
 * Create a new picker.
 * It is better to keep it discrete, not as like `addPicker`
 * as it leaves controlling the list of pickers.
 *
 * @param {Object} options Options for draggable
 *
 * @return {Picker} New picker instance
 */
proto.createPicker = function (options) {
	var self = this;

	options = extend({
		within: self.element,
		type: self.type,
		min: self.min,
		max: self.max,
		repeat: self.repeat,
		step: self.step,
		snap: self.snap,
		pickerClass: self.pickerClass,
		align: self.align,
		release: self.release,
		aria: self.aria,
		keyboard: self.keyboard,
		wheel: self.wheel,
		point: self.point,
		value: self.value
	}, options);

	var el = options.element || document.createElement('div');

	if (self.aria) {
		//add ARIA
		el.setAttribute('aria-describedby', self.element.id);
	}

	//place picker to self
	//need to be appended before to bubble events
	self.element.appendChild(el);

	var picker = new Picker(el, options);

	//on picker change trigger own change
	picker.on('change', function (value) {
		if (self.aria) {
			//set aria value
			self.element.setAttribute('aria-valuenow', value);
			self.element.setAttribute('aria-valuetext', value);
		}

		self.emit('change', value);
	});

	return picker;
};


/**
 * Get closest picker to the place of event
 *
 * @param {number} x offsetLeft, relative to slidy
 * @param {number} y offsetTop, relative to slidy
 *
 * @return {Draggy} A picker instance
 */
proto.getClosestPicker = function (pickers, x,y) {
	//between all pickers choose the one with closest x,y
	var minR = 9999, minPicker;

	pickers.forEach(function (picker) {
		var xy = picker.draggable.getCoords();
		var dx = (x - xy[0] - picker.draggable.pin[0] - picker.draggable.pin.width * picker.align);
		var dy = (y - xy[1] - picker.draggable.pin[1] - picker.draggable.pin.height * picker.align);

		var r = Math.sqrt( dx*dx + dy*dy );

		if ( r < minR ) {
			minR = r;
			minPicker = picker;
		}
	});

	return minPicker;
};
},{"./lib/picker":24,"emmy/off":33,"emmy/on":"emmy/on","emmy/throttle":35,"events":66,"get-client-xy":36,"get-uid":37,"is-array":38,"lifecycle-events":40,"xtend/mutable":65}]},{},[])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL2VtbXkvbGlzdGVuZXJzLmpzIiwibm9kZV9tb2R1bGVzL2VtbXkvbm9kZV9tb2R1bGVzL2ljaWNsZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyaWVkL2xpYi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyaWVkL2xpYi9wc2V1ZG9zL2hhcy5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyaWVkL2xpYi9wc2V1ZG9zL21hdGNoZXMuanMiLCJub2RlX21vZHVsZXMvcXVlcmllZC9saWIvcHNldWRvcy9ub3QuanMiLCJub2RlX21vZHVsZXMvcXVlcmllZC9saWIvcHNldWRvcy9yb290LmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJpZWQvbGliL3BzZXVkb3Mvc2NvcGUuanMiLCJub2RlX21vZHVsZXMvcXVlcmllZC9ub2RlX21vZHVsZXMvYXJyYXktdW5pcXVlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJpZWQvbm9kZV9tb2R1bGVzL2FycmF5aWZ5LWNvbXBhY3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcXVlcmllZC9ub2RlX21vZHVsZXMvYXJyYXlpZnktY29tcGFjdC9ub2RlX21vZHVsZXMvYXJyYXktZmxhdHRlbi9hcnJheS1mbGF0dGVuLmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJpZWQvbm9kZV9tb2R1bGVzL2dldC1kb2MvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcXVlcmllZC9ub2RlX21vZHVsZXMvZ2V0LWRvYy9ub2RlX21vZHVsZXMvaGFzLWRvbS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyaWVkL25vZGVfbW9kdWxlcy9nZXQtdWlkL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJpZWQvbm9kZV9tb2R1bGVzL211dHlwZS9pcy1hcnJheS1saWtlLmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJpZWQvbm9kZV9tb2R1bGVzL211dHlwZS9pcy1hcnJheS5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyaWVkL25vZGVfbW9kdWxlcy9tdXR5cGUvaXMtZm4uanMiLCJub2RlX21vZHVsZXMvcXVlcmllZC9ub2RlX21vZHVsZXMvbXV0eXBlL2lzLXN0cmluZy5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyaWVkL25vZGVfbW9kdWxlcy9wYXJlbnRoZXNpcy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyaWVkL25vZGVfbW9kdWxlcy9wYXJlbnRoZXNpcy9wYXJzZS5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyaWVkL25vZGVfbW9kdWxlcy9wYXJlbnRoZXNpcy9zdHJpbmdpZnkuanMiLCJub2RlX21vZHVsZXMvcXVlcmllZC9ub2RlX21vZHVsZXMvc2xpY2VkL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJpZWQvbm9kZV9tb2R1bGVzL3NsaWNlZC9saWIvc2xpY2VkLmpzIiwibm9kZV9tb2R1bGVzL3NsaWR5L2xpYi9waWNrZXIuanMiLCJub2RlX21vZHVsZXMvc2xpZHkvbm9kZV9tb2R1bGVzL2RlZmluZS1zdGF0ZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zbGlkeS9ub2RlX21vZHVsZXMvZHJhZ2d5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3NsaWR5L25vZGVfbW9kdWxlcy9kcmFnZ3kvbm9kZV9tb2R1bGVzL2lzLW51bWJlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zbGlkeS9ub2RlX21vZHVsZXMvZW1teS9lbWl0LmpzIiwibm9kZV9tb2R1bGVzL3NsaWR5L25vZGVfbW9kdWxlcy9lbW15L29mZi5qcyIsIm5vZGVfbW9kdWxlcy9zbGlkeS9ub2RlX21vZHVsZXMvZW1teS9vbi5qcyIsIm5vZGVfbW9kdWxlcy9zbGlkeS9ub2RlX21vZHVsZXMvZW1teS90aHJvdHRsZS5qcyIsIm5vZGVfbW9kdWxlcy9zbGlkeS9ub2RlX21vZHVsZXMvZ2V0LWNsaWVudC14eS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zbGlkeS9ub2RlX21vZHVsZXMvaXMtYXJyYXkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc2xpZHkvbm9kZV9tb2R1bGVzL2lzLWZ1bmN0aW9uL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3NsaWR5L25vZGVfbW9kdWxlcy9saWZlY3ljbGUtZXZlbnRzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3NsaWR5L25vZGVfbW9kdWxlcy9saWZlY3ljbGUtZXZlbnRzL25vZGVfbW9kdWxlcy90aW55LWVsZW1lbnQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc2xpZHkvbm9kZV9tb2R1bGVzL211Y3NzL1JlY3QuanMiLCJub2RlX21vZHVsZXMvc2xpZHkvbm9kZV9tb2R1bGVzL211Y3NzL2Nzcy5qcyIsIm5vZGVfbW9kdWxlcy9zbGlkeS9ub2RlX21vZHVsZXMvbXVjc3MvZmFrZS1lbGVtZW50LmpzIiwibm9kZV9tb2R1bGVzL3NsaWR5L25vZGVfbW9kdWxlcy9tdWNzcy9oYXMtc2Nyb2xsLmpzIiwibm9kZV9tb2R1bGVzL3NsaWR5L25vZGVfbW9kdWxlcy9tdWNzcy9pcy1maXhlZC5qcyIsIm5vZGVfbW9kdWxlcy9zbGlkeS9ub2RlX21vZHVsZXMvbXVjc3Mvb2Zmc2V0cy5qcyIsIm5vZGVfbW9kdWxlcy9zbGlkeS9ub2RlX21vZHVsZXMvbXVjc3MvcGFyc2UtdmFsdWUuanMiLCJub2RlX21vZHVsZXMvc2xpZHkvbm9kZV9tb2R1bGVzL211Y3NzL3ByZWZpeC5qcyIsIm5vZGVfbW9kdWxlcy9zbGlkeS9ub2RlX21vZHVsZXMvbXVjc3Mvc2Nyb2xsYmFyLmpzIiwibm9kZV9tb2R1bGVzL3NsaWR5L25vZGVfbW9kdWxlcy9tdWNzcy9zZWxlY3Rpb24uanMiLCJub2RlX21vZHVsZXMvc2xpZHkvbm9kZV9tb2R1bGVzL211Y3NzL3RyYW5zbGF0ZS5qcyIsIm5vZGVfbW9kdWxlcy9zbGlkeS9ub2RlX21vZHVsZXMvbXVtYXRoL2JldHdlZW4uanMiLCJub2RlX21vZHVsZXMvc2xpZHkvbm9kZV9tb2R1bGVzL211bWF0aC9sb29wLmpzIiwibm9kZV9tb2R1bGVzL3NsaWR5L25vZGVfbW9kdWxlcy9tdW1hdGgvcHJlY2lzaW9uLmpzIiwibm9kZV9tb2R1bGVzL3NsaWR5L25vZGVfbW9kdWxlcy9tdW1hdGgvcm91bmQuanMiLCJub2RlX21vZHVsZXMvc2xpZHkvbm9kZV9tb2R1bGVzL211bWF0aC93cmFwLmpzIiwibm9kZV9tb2R1bGVzL3NsaWR5L25vZGVfbW9kdWxlcy9tdXR5cGUvaXMtZXZlbnQuanMiLCJub2RlX21vZHVsZXMvc2xpZHkvbm9kZV9tb2R1bGVzL211dHlwZS9pcy1ub2RlLmpzIiwibm9kZV9tb2R1bGVzL3NsaWR5L25vZGVfbW9kdWxlcy9zdDgvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc2xpZHkvbm9kZV9tb2R1bGVzL3N0OC9ub2RlX21vZHVsZXMvaXMtcGxhaW4tb2JqZWN0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3NsaWR5L25vZGVfbW9kdWxlcy9zdDgvbm9kZV9tb2R1bGVzL2lzLXBsYWluLW9iamVjdC9ub2RlX21vZHVsZXMvaXNvYmplY3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc2xpZHkvbm9kZV9tb2R1bGVzL3h0ZW5kL211dGFibGUuanMiLCJub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiLCJxdWVyaWVkIiwic2xpZHkiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBOztBQ0ZBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM3NCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvcUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7O0FDdEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7Ozs7QUNGQTtBQUNBO0FBQ0E7Ozs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxyXG4gKiBBIHN0b3JhZ2Ugb2YgcGVyLXRhcmdldCBjYWxsYmFja3MuXHJcbiAqIFdlYWtNYXAgaXMgdGhlIG1vc3Qgc2FmZSBzb2x1dGlvbi5cclxuICpcclxuICogQG1vZHVsZSBlbW15L2xpc3RlbmVyc1xyXG4gKi9cclxuXHJcbi8qKiBTdG9yYWdlIG9mIGNhbGxiYWNrcyAqL1xyXG52YXIgY2FjaGUgPSBuZXcgV2Vha01hcDtcclxuXHJcblxyXG4vKipcclxuICogR2V0IGxpc3RlbmVycyBmb3IgdGhlIHRhcmdldC9ldnQgKG9wdGlvbmFsbHkpXHJcbiAqXHJcbiAqIEBwYXJhbSB7b2JqZWN0fSB0YXJnZXQgYSB0YXJnZXQgb2JqZWN0XHJcbiAqIEBwYXJhbSB7c3RyaW5nfT8gZXZ0IGFuIGV2dCBuYW1lLCBpZiB1bmRlZmluZWQgLSByZXR1cm4gb2JqZWN0IHdpdGggZXZlbnRzXHJcbiAqXHJcbiAqIEByZXR1cm4geyhvYmplY3R8YXJyYXkpfSBMaXN0L3NldCBvZiBsaXN0ZW5lcnNcclxuICovXHJcbmZ1bmN0aW9uIGxpc3RlbmVycyh0YXJnZXQsIGV2dCwgdGFncyl7XHJcblx0dmFyIGNicyA9IGNhY2hlLmdldCh0YXJnZXQpO1xyXG5cclxuXHRpZiAoIWV2dCkgcmV0dXJuIGNicyB8fCB7fTtcclxuXHRpZiAoIWNicyB8fCAhY2JzW2V2dF0pIHJldHVybiBbXTtcclxuXHJcblx0dmFyIHJlc3VsdCA9IGNic1tldnRdO1xyXG5cclxuXHQvL2lmIHRoZXJlIGFyZSBldnQgbmFtZXNwYWNlcyBzcGVjaWZpZWQgLSBmaWx0ZXIgY2FsbGJhY2tzXHJcblx0aWYgKHRhZ3MgJiYgdGFncy5sZW5ndGgpIHtcclxuXHRcdHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoZnVuY3Rpb24oY2Ipe1xyXG5cdFx0XHRyZXR1cm4gaGFzVGFncyhjYiwgdGFncyk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogUmVtb3ZlIGxpc3RlbmVyLCBpZiBhbnlcclxuICovXHJcbmxpc3RlbmVycy5yZW1vdmUgPSBmdW5jdGlvbih0YXJnZXQsIGV2dCwgY2IsIHRhZ3Mpe1xyXG5cdC8vZ2V0IGNhbGxiYWNrcyBmb3IgdGhlIGV2dFxyXG5cdHZhciBldnRDYWxsYmFja3MgPSBjYWNoZS5nZXQodGFyZ2V0KTtcclxuXHRpZiAoIWV2dENhbGxiYWNrcyB8fCAhZXZ0Q2FsbGJhY2tzW2V2dF0pIHJldHVybiBmYWxzZTtcclxuXHJcblx0dmFyIGNhbGxiYWNrcyA9IGV2dENhbGxiYWNrc1tldnRdO1xyXG5cclxuXHQvL2lmIHRhZ3MgYXJlIHBhc3NlZCAtIG1ha2Ugc3VyZSBjYWxsYmFjayBoYXMgc29tZSB0YWdzIGJlZm9yZSByZW1vdmluZ1xyXG5cdGlmICh0YWdzICYmIHRhZ3MubGVuZ3RoICYmICFoYXNUYWdzKGNiLCB0YWdzKSkgcmV0dXJuIGZhbHNlO1xyXG5cclxuXHQvL3JlbW92ZSBzcGVjaWZpYyBoYW5kbGVyXHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyBpKyspIHtcclxuXHRcdC8vb25jZSBtZXRob2QgaGFzIG9yaWdpbmFsIGNhbGxiYWNrIGluIC5jYlxyXG5cdFx0aWYgKGNhbGxiYWNrc1tpXSA9PT0gY2IgfHwgY2FsbGJhY2tzW2ldLmZuID09PSBjYikge1xyXG5cdFx0XHRjYWxsYmFja3Muc3BsaWNlKGksIDEpO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdH1cclxuXHR9XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIEFkZCBhIG5ldyBsaXN0ZW5lclxyXG4gKi9cclxubGlzdGVuZXJzLmFkZCA9IGZ1bmN0aW9uKHRhcmdldCwgZXZ0LCBjYiwgdGFncyl7XHJcblx0aWYgKCFjYikgcmV0dXJuO1xyXG5cclxuXHQvL2Vuc3VyZSBzZXQgb2YgY2FsbGJhY2tzIGZvciB0aGUgdGFyZ2V0IGV4aXN0c1xyXG5cdGlmICghY2FjaGUuaGFzKHRhcmdldCkpIGNhY2hlLnNldCh0YXJnZXQsIHt9KTtcclxuXHR2YXIgdGFyZ2V0Q2FsbGJhY2tzID0gY2FjaGUuZ2V0KHRhcmdldCk7XHJcblxyXG5cdC8vc2F2ZSBhIG5ldyBjYWxsYmFja1xyXG5cdCh0YXJnZXRDYWxsYmFja3NbZXZ0XSA9IHRhcmdldENhbGxiYWNrc1tldnRdIHx8IFtdKS5wdXNoKGNiKTtcclxuXHJcblx0Ly9zYXZlIG5zIGZvciBhIGNhbGxiYWNrLCBpZiBhbnlcclxuXHRpZiAodGFncyAmJiB0YWdzLmxlbmd0aCkge1xyXG5cdFx0Y2IuX25zID0gdGFncztcclxuXHR9XHJcbn07XHJcblxyXG5cclxuLyoqIERldGVjdCB3aGV0aGVyIGFuIGNiIGhhcyBhdCBsZWFzdCBvbmUgdGFnIGZyb20gdGhlIGxpc3QgKi9cclxuZnVuY3Rpb24gaGFzVGFncyhjYiwgdGFncyl7XHJcblx0aWYgKGNiLl9ucykge1xyXG5cdFx0Ly9pZiBjYiBpcyB0YWdnZWQgd2l0aCBhIG5zIGFuZCBpbmNsdWRlcyBvbmUgb2YgdGhlIG5zIHBhc3NlZCAtIGtlZXAgaXRcclxuXHRcdGZvciAodmFyIGkgPSB0YWdzLmxlbmd0aDsgaS0tOyl7XHJcblx0XHRcdGlmIChjYi5fbnMuaW5kZXhPZih0YWdzW2ldKSA+PSAwKSByZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGxpc3RlbmVyczsiLCIvKipcclxuICogQG1vZHVsZSBJY2ljbGVcclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG5cdGZyZWV6ZTogbG9jayxcclxuXHR1bmZyZWV6ZTogdW5sb2NrLFxyXG5cdGlzRnJvemVuOiBpc0xvY2tlZFxyXG59O1xyXG5cclxuXHJcbi8qKiBTZXQgb2YgdGFyZ2V0cyAgKi9cclxudmFyIGxvY2tDYWNoZSA9IG5ldyBXZWFrTWFwO1xyXG5cclxuXHJcbi8qKlxyXG4gKiBTZXQgZmxhZyBvbiB0YXJnZXQgd2l0aCB0aGUgbmFtZSBwYXNzZWRcclxuICpcclxuICogQHJldHVybiB7Ym9vbH0gV2hldGhlciBsb2NrIHN1Y2NlZWRlZFxyXG4gKi9cclxuZnVuY3Rpb24gbG9jayh0YXJnZXQsIG5hbWUpe1xyXG5cdHZhciBsb2NrcyA9IGxvY2tDYWNoZS5nZXQodGFyZ2V0KTtcclxuXHRpZiAobG9ja3MgJiYgbG9ja3NbbmFtZV0pIHJldHVybiBmYWxzZTtcclxuXHJcblx0Ly9jcmVhdGUgbG9jayBzZXQgZm9yIGEgdGFyZ2V0LCBpZiBub25lXHJcblx0aWYgKCFsb2Nrcykge1xyXG5cdFx0bG9ja3MgPSB7fTtcclxuXHRcdGxvY2tDYWNoZS5zZXQodGFyZ2V0LCBsb2Nrcyk7XHJcblx0fVxyXG5cclxuXHQvL3NldCBhIG5ldyBsb2NrXHJcblx0bG9ja3NbbmFtZV0gPSB0cnVlO1xyXG5cclxuXHQvL3JldHVybiBzdWNjZXNzXHJcblx0cmV0dXJuIHRydWU7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogVW5zZXQgZmxhZyBvbiB0aGUgdGFyZ2V0IHdpdGggdGhlIG5hbWUgcGFzc2VkLlxyXG4gKlxyXG4gKiBOb3RlIHRoYXQgaWYgdG8gcmV0dXJuIG5ldyB2YWx1ZSBmcm9tIHRoZSBsb2NrL3VubG9jayxcclxuICogdGhlbiB1bmxvY2sgd2lsbCBhbHdheXMgcmV0dXJuIGZhbHNlIGFuZCBsb2NrIHdpbGwgYWx3YXlzIHJldHVybiB0cnVlLFxyXG4gKiB3aGljaCBpcyB1c2VsZXNzIGZvciB0aGUgdXNlciwgdGhvdWdoIG1heWJlIGludHVpdGl2ZS5cclxuICpcclxuICogQHBhcmFtIHsqfSB0YXJnZXQgQW55IG9iamVjdFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBBIGZsYWcgbmFtZVxyXG4gKlxyXG4gKiBAcmV0dXJuIHtib29sfSBXaGV0aGVyIHVubG9jayBmYWlsZWQuXHJcbiAqL1xyXG5mdW5jdGlvbiB1bmxvY2sodGFyZ2V0LCBuYW1lKXtcclxuXHR2YXIgbG9ja3MgPSBsb2NrQ2FjaGUuZ2V0KHRhcmdldCk7XHJcblx0aWYgKCFsb2NrcyB8fCAhbG9ja3NbbmFtZV0pIHJldHVybiBmYWxzZTtcclxuXHJcblx0bG9ja3NbbmFtZV0gPSBudWxsO1xyXG5cclxuXHRyZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gd2hldGhlciBmbGFnIGlzIHNldFxyXG4gKlxyXG4gKiBAcGFyYW0geyp9IHRhcmdldCBBbnkgb2JqZWN0IHRvIGFzc29jaWF0ZSBsb2NrIHdpdGhcclxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgQSBmbGFnIG5hbWVcclxuICpcclxuICogQHJldHVybiB7Qm9vbGVhbn0gV2hldGhlciBsb2NrZWQgb3Igbm90XHJcbiAqL1xyXG5mdW5jdGlvbiBpc0xvY2tlZCh0YXJnZXQsIG5hbWUpe1xyXG5cdHZhciBsb2NrcyA9IGxvY2tDYWNoZS5nZXQodGFyZ2V0KTtcclxuXHRyZXR1cm4gKGxvY2tzICYmIGxvY2tzW25hbWVdKTtcclxufSIsIi8qKlxyXG4gKiBBIHF1ZXJ5IGVuZ2luZSAod2l0aCBubyBwc2V1ZG8gY2xhc3NlcyB5ZXQpLlxyXG4gKlxyXG4gKiBAbW9kdWxlIHF1ZXJpZWQvbGliL2luZGV4XHJcbiAqL1xyXG5cclxuLy9UT0RPOiBqcXVlcnkgc2VsZWN0b3JzXHJcbi8vVE9ETzogdGVzdCBvcmRlciBvZiBxdWVyeSByZXN1bHQgKHNob3VsZCBiZSBjb21wbGlhbnQgd2l0aCBxdWVyeVNlbGVjdG9yQWxsKVxyXG4vL1RPRE86IHRoaXJkIHF1ZXJ5IHBhcmFtIC0gaW5jbHVkZSBzZWxmXHJcbi8vVE9ETzogLmNsb3Nlc3QsIC5hbGwsIC5uZXh0LCAucHJldiwgLnBhcmVudCwgLmZpbHRlciwgLm1hdGhlcyBldGMgbWV0aG9kcyAtIGFsbCB3aXRoIHRoZSBzYW1lIEFQSTogcXVlcnkoc2VsZWN0b3IsIFtlbF0sIFtpbmNTZWxmXSwgW3dpdGhpbl0pLlxyXG4vL1RPRE86IC5hbGwoJy54JywgJy5zZWxlY3RvcicpO1xyXG4vL1RPRE86IHVzZSB1bml2ZXJzYWwgcHNldWRvIG1hcHBlci9maWx0ZXIgaW5zdGVhZCBvZiBzZXBhcmF0ZSBvbmVzLlxyXG5cclxuXHJcbnZhciBzbGljZSA9IHJlcXVpcmUoJ3NsaWNlZCcpO1xyXG52YXIgdW5pcXVlID0gcmVxdWlyZSgnYXJyYXktdW5pcXVlJyk7XHJcbnZhciBnZXRVaWQgPSByZXF1aXJlKCdnZXQtdWlkJyk7XHJcbnZhciBwYXJlbiA9IHJlcXVpcmUoJ3BhcmVudGhlc2lzJyk7XHJcbnZhciBpc1N0cmluZyA9IHJlcXVpcmUoJ211dHlwZS9pcy1zdHJpbmcnKTtcclxudmFyIGlzQXJyYXkgPSByZXF1aXJlKCdtdXR5cGUvaXMtYXJyYXknKTtcclxudmFyIGlzQXJyYXlMaWtlID0gcmVxdWlyZSgnbXV0eXBlL2lzLWFycmF5LWxpa2UnKTtcclxudmFyIGFycmF5aWZ5ID0gcmVxdWlyZSgnYXJyYXlpZnktY29tcGFjdCcpO1xyXG52YXIgZG9jID0gcmVxdWlyZSgnZ2V0LWRvYycpO1xyXG5cclxuXHJcbi8qKiBSZWdpc3RlcmVkIHBzZXVkb3MgKi9cclxudmFyIHBzZXVkb3MgPSB7fTtcclxudmFyIGZpbHRlcnMgPSB7fTtcclxudmFyIG1hcHBlcnMgPSB7fTtcclxuXHJcblxyXG4vKiogUmVnZXhwIHRvIGdyYWIgcHNldWRvcyB3aXRoIHBhcmFtcyAqL1xyXG52YXIgcHNldWRvUkU7XHJcblxyXG5cclxuLyoqXHJcbiAqIEFwcGVuZCBhIG5ldyBmaWx0ZXJpbmcgKGNsYXNzaWMpIHBzZXVkb1xyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBQc2V1ZG8gbmFtZVxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmaWx0ZXIgQSBmaWx0ZXJpbmcgZnVuY3Rpb25cclxuICovXHJcbmZ1bmN0aW9uIHJlZ2lzdGVyRmlsdGVyKG5hbWUsIGZpbHRlciwgaW5jU2VsZil7XHJcblx0aWYgKHBzZXVkb3NbbmFtZV0pIHJldHVybjtcclxuXHJcblx0Ly9zYXZlIHBzZXVkbyBmaWx0ZXJcclxuXHRwc2V1ZG9zW25hbWVdID0gZmlsdGVyO1xyXG5cdHBzZXVkb3NbbmFtZV0uaW5jbHVkZVNlbGYgPSBpbmNTZWxmO1xyXG5cdGZpbHRlcnNbbmFtZV0gPSB0cnVlO1xyXG5cclxuXHRyZWdlbmVyYXRlUmVnRXhwKCk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogQXBwZW5kIGEgbmV3IG1hcHBpbmcgKHJlbGF0aXZlLWxpa2UpIHBzZXVkb1xyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBwc2V1ZG8gbmFtZVxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBtYXBwZXIgbWFwIGZ1bmN0aW9uXHJcbiAqL1xyXG5mdW5jdGlvbiByZWdpc3Rlck1hcHBlcihuYW1lLCBtYXBwZXIsIGluY1NlbGYpe1xyXG5cdGlmIChwc2V1ZG9zW25hbWVdKSByZXR1cm47XHJcblxyXG5cdHBzZXVkb3NbbmFtZV0gPSBtYXBwZXI7XHJcblx0cHNldWRvc1tuYW1lXS5pbmNsdWRlU2VsZiA9IGluY1NlbGY7XHJcblx0bWFwcGVyc1tuYW1lXSA9IHRydWU7XHJcblxyXG5cdHJlZ2VuZXJhdGVSZWdFeHAoKTtcclxufVxyXG5cclxuXHJcbi8qKiBVcGRhdGUgcmVnZXhwIGNhdGNoaW5nIHBzZXVkb3MgKi9cclxuZnVuY3Rpb24gcmVnZW5lcmF0ZVJlZ0V4cCgpe1xyXG5cdHBzZXVkb1JFID0gbmV3IFJlZ0V4cCgnOjo/KCcgKyBPYmplY3Qua2V5cyhwc2V1ZG9zKS5qb2luKCd8JykgKyAnKShcXFxcXFxcXFswLTldKyk/Jyk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogUXVlcnkgd3JhcHBlciAtIG1haW4gbWV0aG9kIHRvIHF1ZXJ5IGVsZW1lbnRzLlxyXG4gKi9cclxuZnVuY3Rpb24gcXVlcnlNdWx0aXBsZShzZWxlY3RvciwgZWwpIHtcclxuXHQvL2lnbm9yZSBiYWQgc2VsZWN0b3JcclxuXHRpZiAoIXNlbGVjdG9yKSByZXR1cm4gW107XHJcblxyXG5cdC8vcmV0dXJuIGVsZW1lbnRzIHBhc3NlZCBhcyBhIHNlbGVjdG9yIHVuY2hhbmdlZCAoY292ZXIgcGFyYW1zIGNhc2UpXHJcblx0aWYgKCFpc1N0cmluZyhzZWxlY3RvcikpIHJldHVybiBpc0FycmF5KHNlbGVjdG9yKSA/IHNlbGVjdG9yIDogW3NlbGVjdG9yXTtcclxuXHJcblx0Ly9jYXRjaCBwb2x5ZmlsbGFibGUgZmlyc3QgYDpzY29wZWAgc2VsZWN0b3IgLSBqdXN0IGVyYXNlIGl0LCB3b3JrcyBqdXN0IGZpbmVcclxuXHRpZiAocHNldWRvcy5zY29wZSkgc2VsZWN0b3IgPSBzZWxlY3Rvci5yZXBsYWNlKC9eXFxzKjpzY29wZS8sICcnKTtcclxuXHJcblx0Ly9pZ25vcmUgbm9uLXF1ZXJ5YWJsZSBjb250YWluZXJzXHJcblx0aWYgKCFlbCkgZWwgPSBbcXVlcnlTaW5nbGUuZG9jdW1lbnRdO1xyXG5cclxuXHQvL3RyZWF0IHBhc3NlZCBsaXN0XHJcblx0ZWxzZSBpZiAoaXNBcnJheUxpa2UoZWwpKSB7XHJcblx0XHRlbCA9IGFycmF5aWZ5KGVsKTtcclxuXHR9XHJcblxyXG5cdC8vaWYgZWxlbWVudCBpc27igJl0IGEgbm9kZSAtIG1ha2UgaXQgcS5kb2N1bWVudFxyXG5cdGVsc2UgaWYgKCFlbC5xdWVyeVNlbGVjdG9yKSB7XHJcblx0XHRlbCA9IFtxdWVyeVNpbmdsZS5kb2N1bWVudF07XHJcblx0fVxyXG5cclxuXHQvL21ha2UgYW55IG9rIGVsZW1lbnQgYSBsaXN0XHJcblx0ZWxzZSBlbCA9IFtlbF07XHJcblxyXG5cdHJldHVybiBxUHNldWRvcyhlbCwgc2VsZWN0b3IpO1xyXG59XHJcblxyXG5cclxuLyoqIFF1ZXJ5IHNpbmdsZSBlbGVtZW50IC0gbm8gd2F5IGJldHRlciB0aGFuIHJldHVybiBmaXJzdCBvZiBtdWx0aXBsZSBzZWxlY3RvciAqL1xyXG5mdW5jdGlvbiBxdWVyeVNpbmdsZShzZWxlY3RvciwgZWwpe1xyXG5cdHJldHVybiBxdWVyeU11bHRpcGxlKHNlbGVjdG9yLCBlbClbMF07XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogUmV0dXJuIHF1ZXJ5IHJlc3VsdCBiYXNlZCBvZmYgdGFyZ2V0IGxpc3QuXHJcbiAqIFBhcnNlIGFuZCBhcHBseSBwb2x5ZmlsbGVkIHBzZXVkb3NcclxuICovXHJcbmZ1bmN0aW9uIHFQc2V1ZG9zKGxpc3QsIHNlbGVjdG9yKSB7XHJcblx0Ly9pZ25vcmUgZW1wdHkgc2VsZWN0b3JcclxuXHRzZWxlY3RvciA9IHNlbGVjdG9yLnRyaW0oKTtcclxuXHRpZiAoIXNlbGVjdG9yKSByZXR1cm4gbGlzdDtcclxuXHJcblx0Ly8gY29uc29sZS5ncm91cChzZWxlY3Rvcik7XHJcblxyXG5cdC8vc2NvcGlmeSBpbW1lZGlhdGUgY2hpbGRyZW4gc2VsZWN0b3JcclxuXHRpZiAoc2VsZWN0b3JbMF0gPT09ICc+Jykge1xyXG5cdFx0aWYgKCFwc2V1ZG9zLnNjb3BlKSB7XHJcblx0XHRcdC8vc2NvcGUgYXMgdGhlIGZpcnN0IGVsZW1lbnQgaW4gc2VsZWN0b3Igc2NvcGlmaWVzIGN1cnJlbnQgZWxlbWVudCBqdXN0IG9rXHJcblx0XHRcdHNlbGVjdG9yID0gJzpzY29wZScgKyBzZWxlY3RvcjtcclxuXHRcdH1cclxuXHRcdGVsc2Uge1xyXG5cdFx0XHR2YXIgaWQgPSBnZXRVaWQoKTtcclxuXHRcdFx0bGlzdC5mb3JFYWNoKGZ1bmN0aW9uKGVsKXtlbC5zZXRBdHRyaWJ1dGUoJ19fc2NvcGVkJywgaWQpO30pO1xyXG5cdFx0XHRzZWxlY3RvciA9ICdbX19zY29wZWQ9XCInICsgaWQgKyAnXCJdJyArIHNlbGVjdG9yO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0dmFyIHBzZXVkbywgcHNldWRvRm4sIHBzZXVkb1BhcmFtLCBwc2V1ZG9QYXJhbUlkO1xyXG5cclxuXHQvL2NhdGNoIHBzZXVkb1xyXG5cdHZhciBwYXJ0cyA9IHBhcmVuLnBhcnNlKHNlbGVjdG9yKTtcclxuXHR2YXIgbWF0Y2ggPSBwYXJ0c1swXS5tYXRjaChwc2V1ZG9SRSk7XHJcblxyXG5cdC8vaWYgcHNldWRvIGZvdW5kXHJcblx0aWYgKG1hdGNoKSB7XHJcblx0XHQvL2dyYWIgcHNldWRvIGRldGFpbHNcclxuXHRcdHBzZXVkbyA9IG1hdGNoWzFdO1xyXG5cdFx0cHNldWRvUGFyYW1JZCA9IG1hdGNoWzJdO1xyXG5cclxuXHRcdGlmIChwc2V1ZG9QYXJhbUlkKSB7XHJcblx0XHRcdHBzZXVkb1BhcmFtID0gcGFyZW4uc3RyaW5naWZ5KHBhcnRzW3BzZXVkb1BhcmFtSWQuc2xpY2UoMSldLCBwYXJ0cyk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly9wcmUtc2VsZWN0IGVsZW1lbnRzIGJlZm9yZSBwc2V1ZG9cclxuXHRcdHZhciBwcmVTZWxlY3RvciA9IHBhcmVuLnN0cmluZ2lmeShwYXJ0c1swXS5zbGljZSgwLCBtYXRjaC5pbmRleCksIHBhcnRzKTtcclxuXHJcblx0XHQvL2ZpeCBmb3IgcXVlcnktcmVsYXRpdmVcclxuXHRcdGlmICghcHJlU2VsZWN0b3IgJiYgIW1hcHBlcnNbcHNldWRvXSkgcHJlU2VsZWN0b3IgPSAnKic7XHJcblx0XHRpZiAocHJlU2VsZWN0b3IpIGxpc3QgPSBxTGlzdChsaXN0LCBwcmVTZWxlY3Rvcik7XHJcblxyXG5cclxuXHRcdC8vYXBwbHkgcHNldWRvIGZpbHRlci9tYXBwZXIgb24gdGhlIGxpc3RcclxuXHRcdHBzZXVkb0ZuID0gZnVuY3Rpb24oZWwpIHtyZXR1cm4gcHNldWRvc1twc2V1ZG9dKGVsLCBwc2V1ZG9QYXJhbSk7IH07XHJcblx0XHRpZiAoZmlsdGVyc1twc2V1ZG9dKSB7XHJcblx0XHRcdGxpc3QgPSBsaXN0LmZpbHRlcihwc2V1ZG9Gbik7XHJcblx0XHR9XHJcblx0XHRlbHNlIGlmIChtYXBwZXJzW3BzZXVkb10pIHtcclxuXHRcdFx0bGlzdCA9IHVuaXF1ZShhcnJheWlmeShsaXN0Lm1hcChwc2V1ZG9GbikpKTtcclxuXHRcdH1cclxuXHJcblx0XHQvL3Nob3J0ZW4gc2VsZWN0b3JcclxuXHRcdHNlbGVjdG9yID0gcGFydHNbMF0uc2xpY2UobWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGgpO1xyXG5cclxuXHRcdC8vIGNvbnNvbGUuZ3JvdXBFbmQoKTtcclxuXHJcblx0XHQvL3F1ZXJ5IG9uY2UgYWdhaW5cclxuXHRcdHJldHVybiBxUHNldWRvcyhsaXN0LCBwYXJlbi5zdHJpbmdpZnkoc2VsZWN0b3IsIHBhcnRzKSk7XHJcblx0fVxyXG5cclxuXHQvL2p1c3QgcXVlcnkgbGlzdFxyXG5cdGVsc2Uge1xyXG5cdFx0Ly8gY29uc29sZS5ncm91cEVuZCgpO1xyXG5cdFx0cmV0dXJuIHFMaXN0KGxpc3QsIHNlbGVjdG9yKTtcclxuXHR9XHJcbn1cclxuXHJcblxyXG4vKiogQXBwbHkgc2VsZWN0b3Igb24gYSBsaXN0IG9mIGVsZW1lbnRzLCBubyBwb2x5ZmlsbGVkIHBzZXVkb3MgKi9cclxuZnVuY3Rpb24gcUxpc3QobGlzdCwgc2VsZWN0b3Ipe1xyXG5cdHJldHVybiB1bmlxdWUoYXJyYXlpZnkobGlzdC5tYXAoZnVuY3Rpb24oZWwpe1xyXG5cdFx0cmV0dXJuIHNsaWNlKGVsLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpKTtcclxuXHR9KSkpO1xyXG59XHJcblxyXG5cclxuLyoqIEV4cG9ydHMgKi9cclxucXVlcnlTaW5nbGUuYWxsID0gcXVlcnlNdWx0aXBsZTtcclxucXVlcnlTaW5nbGUucmVnaXN0ZXJGaWx0ZXIgPSByZWdpc3RlckZpbHRlcjtcclxucXVlcnlTaW5nbGUucmVnaXN0ZXJNYXBwZXIgPSByZWdpc3Rlck1hcHBlcjtcclxuXHJcbi8qKiBEZWZhdWx0IGRvY3VtZW50IHJlcHJlc2VudGF0aXZlIHRvIHVzZSBmb3IgRE9NICovXHJcbnF1ZXJ5U2luZ2xlLmRvY3VtZW50ID0gZG9jO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBxdWVyeVNpbmdsZTsiLCJ2YXIgcSA9IHJlcXVpcmUoJy4uJyk7XHJcblxyXG5mdW5jdGlvbiBoYXMoZWwsIHN1YlNlbGVjdG9yKXtcclxuXHRyZXR1cm4gISFxKHN1YlNlbGVjdG9yLCBlbCk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gaGFzOyIsInZhciBxID0gcmVxdWlyZSgnLi4nKTtcclxuXHJcbi8qKiBDU1M0IG1hdGNoZXMgKi9cclxuZnVuY3Rpb24gbWF0Y2hlcyhlbCwgc2VsZWN0b3Ipe1xyXG5cdGlmICghZWwucGFyZW50Tm9kZSkge1xyXG5cdFx0dmFyIGZyYWdtZW50ID0gcS5kb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XHJcblx0XHRmcmFnbWVudC5hcHBlbmRDaGlsZChlbCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gcS5hbGwoc2VsZWN0b3IsIGVsLnBhcmVudE5vZGUpLmluZGV4T2YoZWwpID4gLTE7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gbWF0Y2hlczsiLCJ2YXIgbWF0Y2hlcyA9IHJlcXVpcmUoJy4vbWF0Y2hlcycpO1xyXG5cclxuZnVuY3Rpb24gbm90KGVsLCBzZWxlY3Rvcil7XHJcblx0cmV0dXJuICFtYXRjaGVzKGVsLCBzZWxlY3Rvcik7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gbm90OyIsInZhciBxID0gcmVxdWlyZSgnLi4nKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcm9vdChlbCl7XHJcblx0cmV0dXJuIGVsID09PSBxLmRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcclxufTsiLCIvKipcclxuICogOnNjb3BlIHBzZXVkb1xyXG4gKiBSZXR1cm4gZWxlbWVudCBpZiBpdCBoYXMgYHNjb3BlZGAgYXR0cmlidXRlLlxyXG4gKlxyXG4gKiBAbGluayBodHRwOi8vZGV2LnczLm9yZy9jc3N3Zy9zZWxlY3RvcnMtNC8jdGhlLXNjb3BlLXBzZXVkb1xyXG4gKi9cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gc2NvcGUoZWwpe1xyXG5cdHJldHVybiBlbC5oYXNBdHRyaWJ1dGUoJ3Njb3BlZCcpO1xyXG59OyIsIi8qIVxuICogYXJyYXktdW5pcXVlIDxodHRwczovL2dpdGh1Yi5jb20vam9uc2NobGlua2VydC9hcnJheS11bmlxdWU+XG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDE0IEpvbiBTY2hsaW5rZXJ0LCBjb250cmlidXRvcnMuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHVuaXF1ZShhcnIpIHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KGFycikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdhcnJheS11bmlxdWUgZXhwZWN0cyBhbiBhcnJheS4nKTtcbiAgfVxuXG4gIHZhciBsZW4gPSBhcnIubGVuZ3RoO1xuICB2YXIgaSA9IC0xO1xuXG4gIHdoaWxlIChpKysgPCBsZW4pIHtcbiAgICB2YXIgaiA9IGkgKyAxO1xuXG4gICAgZm9yICg7IGogPCBhcnIubGVuZ3RoOyArK2opIHtcbiAgICAgIGlmIChhcnJbaV0gPT09IGFycltqXSkge1xuICAgICAgICBhcnIuc3BsaWNlKGotLSwgMSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBhcnI7XG59O1xuIiwiLyohXG4gKiBhcnJheWlmeS1jb21wYWN0IDxodHRwczovL2dpdGh1Yi5jb20vam9uc2NobGlua2VydC9hcnJheWlmeS1jb21wYWN0PlxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxNCBKb24gU2NobGlua2VydCwgY29udHJpYnV0b3JzLlxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZmxhdHRlbiA9IHJlcXVpcmUoJ2FycmF5LWZsYXR0ZW4nKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihhcnIpIHtcbiAgcmV0dXJuIGZsYXR0ZW4oIUFycmF5LmlzQXJyYXkoYXJyKSA/IFthcnJdIDogYXJyKVxuICAgIC5maWx0ZXIoQm9vbGVhbik7XG59O1xuIiwiLyoqXG4gKiBSZWN1cnNpdmUgZmxhdHRlbiBmdW5jdGlvbi4gRmFzdGVzdCBpbXBsZW1lbnRhdGlvbiBmb3IgYXJyYXkgZmxhdHRlbmluZy5cbiAqXG4gKiBAcGFyYW0gIHtBcnJheX0gIGFycmF5XG4gKiBAcGFyYW0gIHtBcnJheX0gIHJlc3VsdFxuICogQHBhcmFtICB7TnVtYmVyfSBkZXB0aFxuICogQHJldHVybiB7QXJyYXl9XG4gKi9cbmZ1bmN0aW9uIGZsYXR0ZW4gKGFycmF5LCByZXN1bHQsIGRlcHRoKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoZGVwdGggPiAwICYmIEFycmF5LmlzQXJyYXkoYXJyYXlbaV0pKSB7XG4gICAgICBmbGF0dGVuKGFycmF5W2ldLCByZXN1bHQsIGRlcHRoIC0gMSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdC5wdXNoKGFycmF5W2ldKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIEZsYXR0ZW4gYW4gYXJyYXksIHdpdGggdGhlIGFiaWxpdHkgdG8gZGVmaW5lIGEgZGVwdGguXG4gKlxuICogQHBhcmFtICB7QXJyYXl9ICBhcnJheVxuICogQHBhcmFtICB7TnVtYmVyfSBkZXB0aFxuICogQHJldHVybiB7QXJyYXl9XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGFycmF5LCBkZXB0aCkge1xuICByZXR1cm4gZmxhdHRlbihhcnJheSwgW10sIGRlcHRoIHx8IEluZmluaXR5KTtcbn07XG4iLCIvKipcclxuICogQG1vZHVsZSAgZ2V0LWRvY1xyXG4gKi9cclxuXHJcbnZhciBoYXNEb20gPSByZXF1aXJlKCdoYXMtZG9tJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGhhc0RvbSgpID8gZG9jdW1lbnQgOiBudWxsOyIsIid1c2Ugc3RyaWN0Jztcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuXHRyZXR1cm4gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcblx0XHQmJiB0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnXG5cdFx0JiYgdHlwZW9mIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQgPT09ICdmdW5jdGlvbic7XG59O1xuIiwiLyoqIGdlbmVyYXRlIHVuaXF1ZSBpZCBmb3Igc2VsZWN0b3IgKi9cclxudmFyIGNvdW50ZXIgPSBEYXRlLm5vdygpICUgMWU5O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBnZXRVaWQoKXtcclxuXHRyZXR1cm4gKE1hdGgucmFuZG9tKCkgKiAxZTkgPj4+IDApICsgKGNvdW50ZXIrKyk7XHJcbn07IiwidmFyIGlzU3RyaW5nID0gcmVxdWlyZSgnLi9pcy1zdHJpbmcnKTtcclxudmFyIGlzQXJyYXkgPSByZXF1aXJlKCcuL2lzLWFycmF5Jyk7XHJcbnZhciBpc0ZuID0gcmVxdWlyZSgnLi9pcy1mbicpO1xyXG5cclxuLy9GSVhNRTogYWRkIHRlc3RzIGZyb20gaHR0cDovL2pzZmlkZGxlLm5ldC9rdTlMUy8xL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChhKXtcclxuXHRyZXR1cm4gaXNBcnJheShhKSB8fCAoYSAmJiAhaXNTdHJpbmcoYSkgJiYgIWEubm9kZVR5cGUgJiYgKHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcgPyBhICE9IHdpbmRvdyA6IHRydWUpICYmICFpc0ZuKGEpICYmIHR5cGVvZiBhLmxlbmd0aCA9PT0gJ251bWJlcicpO1xyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihhKXtcclxuXHRyZXR1cm4gYSBpbnN0YW5jZW9mIEFycmF5O1xyXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihhKXtcclxuXHRyZXR1cm4gISEoYSAmJiBhLmFwcGx5KTtcclxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oYSl7XHJcblx0cmV0dXJuIHR5cGVvZiBhID09PSAnc3RyaW5nJyB8fCBhIGluc3RhbmNlb2YgU3RyaW5nO1xyXG59IiwiLyoqXHJcbiAqIEBtb2R1bGUgcGFyZW50aGVzaXNcclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG5cdHBhcnNlOiByZXF1aXJlKCcuL3BhcnNlJyksXHJcblx0c3RyaW5naWZ5OiByZXF1aXJlKCcuL3N0cmluZ2lmeScpXHJcbn07IiwiLyoqXHJcbiAqIEBtb2R1bGUgIHBhcmVudGhlc2lzL3BhcnNlXHJcbiAqXHJcbiAqIFBhcnNlIGEgc3RyaW5nIHdpdGggcGFyZW50aGVzaXMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgQSBzdHJpbmcgd2l0aCBwYXJlbnRoZXNpc1xyXG4gKlxyXG4gKiBAcmV0dXJuIHtBcnJheX0gQSBsaXN0IHdpdGggcGFyc2VkIHBhcmVucywgd2hlcmUgMCBpcyBpbml0aWFsIHN0cmluZy5cclxuICovXHJcblxyXG4vL1RPRE86IGltcGxlbWVudCBzZXF1ZW50aWFsIHBhcnNlciBvZiB0aGlzIGFsZ29yaXRobSwgY29tcGFyZSBwZXJmb3JtYW5jZS5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihzdHIsIGJyYWNrZXQpe1xyXG5cdC8vcHJldGVuZCBub24tc3RyaW5nIHBhcnNlZCBwZXItc2VcclxuXHRpZiAodHlwZW9mIHN0ciAhPT0gJ3N0cmluZycpIHJldHVybiBbc3RyXTtcclxuXHJcblx0dmFyIHJlcyA9IFtdLCBwcmV2U3RyO1xyXG5cclxuXHRicmFja2V0ID0gYnJhY2tldCB8fCAnKCknO1xyXG5cclxuXHQvL2NyZWF0ZSBwYXJlbnRoZXNpcyByZWdleFxyXG5cdHZhciBwUkUgPSBuZXcgUmVnRXhwKFsnXFxcXCcsIGJyYWNrZXRbMF0sICdbXlxcXFwnLCBicmFja2V0WzBdLCAnXFxcXCcsIGJyYWNrZXRbMV0sICddKlxcXFwnLCBicmFja2V0WzFdXS5qb2luKCcnKSk7XHJcblxyXG5cdGZ1bmN0aW9uIHJlcGxhY2VUb2tlbih0b2tlbiwgaWR4LCBzdHIpe1xyXG5cdFx0Ly9zYXZlIHRva2VuIHRvIHJlc1xyXG5cdFx0dmFyIHJlZklkID0gcmVzLnB1c2godG9rZW4uc2xpY2UoMSwtMSkpO1xyXG5cclxuXHRcdHJldHVybiAnXFxcXCcgKyByZWZJZDtcclxuXHR9XHJcblxyXG5cdC8vcmVwbGFjZSBwYXJlbiB0b2tlbnMgdGlsbCB0aGVyZeKAmXMgbm9uZVxyXG5cdHdoaWxlIChzdHIgIT0gcHJldlN0cikge1xyXG5cdFx0cHJldlN0ciA9IHN0cjtcclxuXHRcdHN0ciA9IHN0ci5yZXBsYWNlKHBSRSwgcmVwbGFjZVRva2VuKTtcclxuXHR9XHJcblxyXG5cdC8vc2F2ZSByZXN1bHRpbmcgc3RyXHJcblx0cmVzLnVuc2hpZnQoc3RyKTtcclxuXHJcblx0cmV0dXJuIHJlcztcclxufTsiLCIvKipcclxuICogQG1vZHVsZSBwYXJlbnRoZXNpcy9zdHJpbmdpZnlcclxuICpcclxuICogU3RyaW5naWZ5IGFuIGFycmF5L29iamVjdCB3aXRoIHBhcmVudGhlc2lzIHJlZmVyZW5jZXNcclxuICpcclxuICogQHBhcmFtIHtBcnJheXxPYmplY3R9IGFyciBBbiBhcnJheSBvciBvYmplY3Qgd2hlcmUgMCBpcyBpbml0aWFsIHN0cmluZ1xyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgIGFuZCBldmVyeSBvdGhlciBrZXkvdmFsdWUgaXMgcmVmZXJlbmNlIGlkL3ZhbHVlIHRvIHJlcGxhY2VcclxuICpcclxuICogQHJldHVybiB7c3RyaW5nfSBBIHN0cmluZyB3aXRoIGluc2VydGVkIHJlZ2V4IHJlZmVyZW5jZXNcclxuICovXHJcblxyXG4vL0ZJWE1FOiBjaXJjdWxhciByZWZlcmVuY2VzIGNhdXNlcyByZWN1cnNpb25zIGhlcmVcclxuLy9UT0RPOiB0aGVyZeKAmXMgcG9zc2libGUgYSByZWN1cnNpdmUgdmVyc2lvbiBvZiB0aGlzIGFsZ29yaXRobSwgc28gdGVzdCBpdCAmIGNvbXBhcmVcclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoc3RyLCByZWZzLCBicmFja2V0KXtcclxuXHR2YXIgcHJldlN0cjtcclxuXHJcblx0Ly9wcmV0ZW5kIGJhZCBzdHJpbmcgc3RyaW5naWZpZWQgd2l0aCBubyBwYXJlbnRoZXNlc1xyXG5cdGlmICghc3RyKSByZXR1cm4gJyc7XHJcblxyXG5cdGlmICh0eXBlb2Ygc3RyICE9PSAnc3RyaW5nJykge1xyXG5cdFx0YnJhY2tldCA9IHJlZnM7XHJcblx0XHRyZWZzID0gc3RyO1xyXG5cdFx0c3RyID0gcmVmc1swXTtcclxuXHR9XHJcblxyXG5cdGJyYWNrZXQgPSBicmFja2V0IHx8ICcoKSc7XHJcblxyXG5cdGZ1bmN0aW9uIHJlcGxhY2VSZWYodG9rZW4sIGlkeCwgc3RyKXtcclxuXHRcdHJldHVybiBicmFja2V0WzBdICsgcmVmc1t0b2tlbi5zbGljZSgxKV0gKyBicmFja2V0WzFdO1xyXG5cdH1cclxuXHJcblx0d2hpbGUgKHN0ciAhPSBwcmV2U3RyKSB7XHJcblx0XHRwcmV2U3RyID0gc3RyO1xyXG5cdFx0c3RyID0gc3RyLnJlcGxhY2UoL1xcXFxbMC05XSsvLCByZXBsYWNlUmVmKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBzdHI7XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzID0gcmVxdWlyZSgnLi9saWIvc2xpY2VkJyk7XG4iLCJcbi8qKlxuICogQW4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSBhbHRlcm5hdGl2ZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBhcmdzIHNvbWV0aGluZyB3aXRoIGEgbGVuZ3RoXG4gKiBAcGFyYW0ge051bWJlcn0gc2xpY2VcbiAqIEBwYXJhbSB7TnVtYmVyfSBzbGljZUVuZFxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChhcmdzLCBzbGljZSwgc2xpY2VFbmQpIHtcbiAgdmFyIHJldCA9IFtdO1xuICB2YXIgbGVuID0gYXJncy5sZW5ndGg7XG5cbiAgaWYgKDAgPT09IGxlbikgcmV0dXJuIHJldDtcblxuICB2YXIgc3RhcnQgPSBzbGljZSA8IDBcbiAgICA/IE1hdGgubWF4KDAsIHNsaWNlICsgbGVuKVxuICAgIDogc2xpY2UgfHwgMDtcblxuICBpZiAoc2xpY2VFbmQgIT09IHVuZGVmaW5lZCkge1xuICAgIGxlbiA9IHNsaWNlRW5kIDwgMFxuICAgICAgPyBzbGljZUVuZCArIGxlblxuICAgICAgOiBzbGljZUVuZFxuICB9XG5cbiAgd2hpbGUgKGxlbi0tID4gc3RhcnQpIHtcbiAgICByZXRbbGVuIC0gc3RhcnRdID0gYXJnc1tsZW5dO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cblxuIiwiLyoqXHJcbiAqIFBpY2tlciBjbGFzcy5cclxuICogQSBjb250cm9sbGVyIGZvciBkcmFnZ2FibGUuXHJcbiAqIEJlY2F1c2UgaXQgaGFzIHNvbWUgaW50ZXJtZWRpYXRlIEFQSTpcclxuICogLSB1cGRhdGVcclxuICogLSB2YWx1ZVxyXG4gKlxyXG4gKiBOb3RlIHRoYXQgaXTigJlzIG5vdCBhbiBleHRlbnNpb24gb2YgZHJhZ2dhYmxlIGR1ZSB0byBtZXRob2QgbmFtZXMgY29uZmxpY3QsIGxpa2UgdXBkYXRlLlxyXG4gKi9cclxuXHJcbnZhciBEcmFnZ2FibGUgPSByZXF1aXJlKCdkcmFnZ3knKTtcclxudmFyIGRlZmluZVN0YXRlID0gcmVxdWlyZSgnZGVmaW5lLXN0YXRlJyk7XHJcbnZhciBlbWl0ID0gcmVxdWlyZSgnZW1teS9lbWl0Jyk7XHJcbnZhciBvbiA9IHJlcXVpcmUoJ2VtbXkvb24nKTtcclxudmFyIG9mZiA9IHJlcXVpcmUoJ2VtbXkvb2ZmJyk7XHJcbnZhciBjc3MgPSByZXF1aXJlKCdtdWNzcy9jc3MnKTtcclxudmFyIEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKTtcclxudmFyIGlzRm4gPSByZXF1aXJlKCdpcy1mdW5jdGlvbicpO1xyXG52YXIgcm91bmQgPSByZXF1aXJlKCdtdW1hdGgvcm91bmQnKTtcclxudmFyIGJldHdlZW4gPSByZXF1aXJlKCdtdW1hdGgvYmV0d2VlbicpO1xyXG52YXIgbG9vcCA9IHJlcXVpcmUoJ211bWF0aC9sb29wJyk7XHJcbnZhciBnZXRVaWQgPSByZXF1aXJlKCdnZXQtdWlkJyk7XHJcbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXMtYXJyYXknKTtcclxudmFyIGV4dGVuZCA9IHJlcXVpcmUoJ3h0ZW5kL211dGFibGUnKTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFBpY2tlcjtcclxuXHJcblxyXG52YXIgZG9jID0gZG9jdW1lbnQsIHJvb3QgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XHJcblxyXG5cclxuLyoqIFRoZSBtb3N0IHByZWNpc2Ugc3RlcCBhdmFpbGFibGUuICovXHJcbnZhciBNSU5fU1RFUCA9IDAuMDAwMDE7XHJcblxyXG5cclxuLyoqIERlZmF1bHQgcGFnZXVwL3BhZ2Vkb3duIHNpemUsIGluIHN0ZXBzICovXHJcbnZhciBQQUdFID0gNTtcclxuXHJcblxyXG4vKipcclxuICogUGlja2VyIGluc3RhbmNlXHJcbiAqXHJcbiAqIEBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZnVuY3Rpb24gUGlja2VyIChlbCwgb3B0aW9ucykge1xyXG5cdGlmICghKHRoaXMgaW5zdGFuY2VvZiBQaWNrZXIpKSByZXR1cm4gbmV3IFBpY2tlcihlbCwgb3B0aW9ucyk7XHJcblxyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHJcblx0Ly9lbnN1cmUgZWxlbWVudFxyXG5cdGlmICghZWwpIHtcclxuXHRcdGVsID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cdH1cclxuXHRlbC5jbGFzc0xpc3QuYWRkKCdzbGlkeS1waWNrZXInKTtcclxuXHRzZWxmLmVsZW1lbnQgPSBlbDtcclxuXHJcblx0aWYgKG9wdGlvbnMucGlja2VyQ2xhc3MpIGVsLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5waWNrZXJDbGFzcyk7XHJcblxyXG5cdC8vZ2VuZXJhdGUgc2VsZiBpZFxyXG5cdHNlbGYuaWQgPSBnZXRVaWQoKTtcclxuXHRzZWxmLm5zID0gJ3NsaWR5LXBpY2tlci0nICsgc2VsZi5pZDtcclxuXHRpZiAoIXNlbGYuZWxlbWVudC5pZCkgc2VsZi5lbGVtZW50LmlkID0gc2VsZi5ucztcclxuXHJcblx0Ly9pbml0IGRyYWdnYWJsZVxyXG5cdHNlbGYuZHJhZ2dhYmxlID0gbmV3IERyYWdnYWJsZShlbCwge1xyXG5cdFx0dGhyZXNob2xkOiAwLFxyXG5cdFx0d2l0aGluOiBvcHRpb25zLndpdGhpbixcclxuXHRcdHNuaXBlclNsb3dkb3duOiAwLjg1LFxyXG5cdFx0YXhpczogJ3gnLFxyXG5cdFx0cmVwZWF0OiBzZWxmLnJlcGVhdCxcclxuXHRcdHJlbGVhc2VEdXJhdGlvbjogODBcclxuXHR9KTtcclxuXHJcblx0Ly9kZWZpbmUgdHlwZSBvZiBwaWNrZXJcclxuXHRkZWZpbmVTdGF0ZShzZWxmLCAndHlwZScsIHNlbGYudHlwZSk7XHJcblxyXG5cdC8vYWRvcHQgb3B0aW9uc1xyXG5cdC8vc2hvdWxkIGdvIGJlZm9yZSBlbmFibGVkIHRvIHNldCB1cCBwcm9wZXIgZmxhZ3NcclxuXHRleHRlbmQoc2VsZiwgb3B0aW9ucyk7XHJcblxyXG5cdC8vZ28gZW5hYmxlZFxyXG5cdHNlbGYuZW5hYmxlKCk7XHJcblxyXG5cdC8vYXBwbHkgdHlwZSBvZiBwbGFjZW1lbnRcclxuXHRzZWxmLnR5cGUgPSBvcHRpb25zLnR5cGU7XHJcblxyXG5cdC8vZGV0ZWN0IHN0ZXAgYXV0b21hdGljYWxseSBiYXNlZCBvbiBtaW4vbWF4IHJhbmdlICgxLzEwMCBieSBkZWZhdWx0KVxyXG5cdC8vbmF0aXZlIGJlaGF2aW91ciBpcyBhbHdheXMgMSwgc28gaWdub3JlIGl0XHJcblx0aWYgKG9wdGlvbnMuc3RlcCA9PT0gdW5kZWZpbmVkKSB7XHJcblx0XHR2YXIgcmFuZ2UgPSBNYXRoLmFicyhzZWxmLm1heCAtIHNlbGYubWluKTtcclxuXHRcdHNlbGYuc3RlcCA9IHJhbmdlIDwgMTAwID8gMC4xIDogMTtcclxuXHR9XHJcblxyXG5cdC8vY2FsYyB1bmRlZmluZWQgdmFsdWVhIGFzIGEgbWlkZGxlIG9mIHJhbmdlXHJcblx0aWYgKG9wdGlvbnMudmFsdWUgPT09IHVuZGVmaW5lZCkge1xyXG5cdFx0c2VsZi52YWx1ZSA9IChzZWxmLm1pbiArIHNlbGYubWF4KSAqIDAuNTtcclxuXHR9XHJcbn1cclxuXHJcblxyXG52YXIgcHJvdG8gPSBQaWNrZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFbWl0dGVyLnByb3RvdHlwZSk7XHJcblxyXG5cclxuLyoqIEVuYWJsZWQvRGlzYWJsZWQgc3RhdGUgKi9cclxucHJvdG8uZW5hYmxlID0gZnVuY3Rpb24gKCkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHJcblx0aWYgKHNlbGYuaXNFbmFibGVkKSByZXR1cm4gc2VsZjtcclxuXHRzZWxmLmlzRW5hYmxlZCA9IHRydWU7XHJcblxyXG5cdGlmIChzZWxmLmFyaWEpIHtcclxuXHRcdC8vQVJJQXNcclxuXHRcdHNlbGYuZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnKTtcclxuXHR9XHJcblxyXG5cdHNlbGYuZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoJ2Rpc2FibGVkJyk7XHJcblxyXG5cdC8vZXZlbnRzXHJcblx0b24oc2VsZi5kcmFnZ2FibGUsICdkcmFnc3RhcnQuJyArIHNlbGYubnMsIGZ1bmN0aW9uICgpIHtcclxuXHRcdGNzcyhyb290LCAnY3Vyc29yJywgJ25vbmUnKTtcclxuXHRcdGNzcyh0aGlzLmVsZW1lbnQsICdjdXJzb3InLCAnbm9uZScpO1xyXG5cdH0pO1xyXG5cdG9uKHNlbGYuZHJhZ2dhYmxlLCAnZHJhZycsIGZ1bmN0aW9uICgpIHtcclxuXHRcdC8vaWdub3JlIGFuaW1hdGVkIHN0YXRlIHRvIGF2b2lkIGNvbGxpc2lvbnMgb2YgdmFsdWVcclxuXHRcdGlmIChzZWxmLnJlbGVhc2UgJiYgc2VsZi5kcmFnZ2FibGUuaXNBbmltYXRlZCkgcmV0dXJuO1xyXG5cclxuXHRcdHZhciB2YWx1ZSA9IHNlbGYuY2FsY1ZhbHVlLmFwcGx5KHNlbGYsIHNlbGYuZHJhZ2dhYmxlLmdldENvb3JkcygpKTtcclxuXHJcblx0XHRzZWxmLnZhbHVlID0gdmFsdWU7XHJcblxyXG5cdFx0Ly9kaXNwbGF5IHNuYXBwaW5nXHJcblx0XHRpZiAoc2VsZi5zbmFwKSB7XHJcblx0XHRcdHNlbGYucmVuZGVyVmFsdWUoc2VsZi52YWx1ZSk7XHJcblx0XHR9XHJcblxyXG5cdH0pO1xyXG5cdG9uKHNlbGYuZHJhZ2dhYmxlLCAnZHJhZ2VuZC4nICsgc2VsZi5ucywgZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKHNlbGYucmVsZWFzZSkge1xyXG5cdFx0XHRzZWxmLmRyYWdnYWJsZS5pc0FuaW1hdGVkID0gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRzZWxmLnJlbmRlclZhbHVlKHNlbGYudmFsdWUpO1xyXG5cdFx0Y3NzKHJvb3QsICdjdXJzb3InLCBudWxsKTtcclxuXHRcdGNzcyh0aGlzLmVsZW1lbnQsICdjdXJzb3InLCBudWxsKTtcclxuXHR9KTtcclxuXHJcblx0aWYgKHNlbGYua2V5Ym9hcmQpIHtcclxuXHRcdC8vbWFrZSBmb2N1c2FibGVcclxuXHRcdHNlbGYuZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgMCk7XHJcblxyXG5cdFx0Ly9rYmQgZXZlbnRzXHJcblx0XHQvL2JvcnJvd2VkIGZyb20gbmF0aXZlIGlucHV0IHJhbmdlIG1peGVkIHdpdGggbXVsdGl0aHVtYiByYW5nZVxyXG5cdFx0Ly9AcmVmIGh0dHA6Ly9hY2Nlc3MuYW9sLmNvbS9kaHRtbC1zdHlsZS1ndWlkZS13b3JraW5nLWdyb3VwLyNzbGlkZXJ0d290aHVtYlxyXG5cdFx0c2VsZi5fcHJlc3NlZEtleXMgPSBbXTtcclxuXHRcdG9uKHNlbGYuZWxlbWVudCwgJ2tleWRvd24uJyArIHNlbGYubnMsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdC8vdHJhY2sgcHJlc3NlZCBrZXlzLCB0byBkbyBkaWFnb25hbCBtb3ZlbWVudHNcclxuXHRcdFx0c2VsZi5fcHJlc3NlZEtleXNbZS53aGljaF0gPSB0cnVlO1xyXG5cclxuXHRcdFx0aWYgKGUud2hpY2ggPj0gMzMgJiYgZS53aGljaCA8PSA0MCkge1xyXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHJcblx0XHRcdFx0c2VsZi52YWx1ZSA9IHNlbGYuaGFuZGxlS2V5cyhzZWxmLl9wcmVzc2VkS2V5cywgc2VsZi52YWx1ZSwgc2VsZi5zdGVwLCBzZWxmLm1pbiwgc2VsZi5tYXgpO1xyXG5cclxuXHRcdFx0XHRpZiAoc2VsZi5yZWxlYXNlKSBzZWxmLmRyYWdnYWJsZS5pc0FuaW1hdGVkID0gdHJ1ZTtcclxuXHJcblx0XHRcdFx0c2VsZi5yZW5kZXJWYWx1ZShzZWxmLnZhbHVlKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0XHRvbihzZWxmLmVsZW1lbnQsICdrZXl1cC4nICsgc2VsZi5ucywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0c2VsZi5fcHJlc3NlZEtleXNbZS53aGljaF0gPSBmYWxzZTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHNlbGY7XHJcbn07XHJcbnByb3RvLmRpc2FibGUgPSBmdW5jdGlvbiAoKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuXHRzZWxmLmlzRW5hYmxlZCA9IGZhbHNlO1xyXG5cclxuXHRpZiAoc2VsZi5hcmlhKSB7XHJcblx0XHQvL0FSSUFzXHJcblx0XHRzZWxmLmVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJywgdHJ1ZSk7XHJcblx0fVxyXG5cclxuXHRzZWxmLmVsZW1lbnQuc2V0QXR0cmlidXRlKCdkaXNhYmxlZCcsIHRydWUpO1xyXG5cclxuXHQvL3VuYmluZCBldmVudHNcclxuXHRvZmYoc2VsZi5lbGVtZW50LCdkcmFnc3RhcnQuJyArIHNlbGYubnMpO1xyXG5cdG9mZihzZWxmLmVsZW1lbnQsJ2RyYWcuJyArIHNlbGYubnMpO1xyXG5cdG9mZihzZWxmLmVsZW1lbnQsJ2RyYWdlbmQuJyArIHNlbGYubnMpO1xyXG5cclxuXHRpZiAoc2VsZi5rZXlib2FyZCkge1xyXG5cdFx0Ly9tYWtlIHVuZm9jdXNhYmxlXHJcblx0XHRzZWxmLmVsZW1lbnQuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsIC0xKTtcclxuXHRcdG9mZihzZWxmLmVsZW1lbnQsJ2tleWRvd24uJyArIHNlbGYubnMpO1xyXG5cdFx0b2ZmKHNlbGYuZWxlbWVudCwna2V5dXAuJyArIHNlbGYubnMpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHNlbGY7XHJcbn07XHJcblxyXG5cclxuLyoqIERlZmF1bHQgbWluL21heCB2YWx1ZXMgKi9cclxucHJvdG8ubWluID0gMDtcclxucHJvdG8ubWF4ID0gMTAwO1xyXG5cclxuXHJcbi8qKiBEZWZhdWx0IHN0ZXAgdG8gYmluZCB2YWx1ZS4gSXQgaXMgYXV0b21hdGljYWxseSBkZXRlY3RlZCwgaWYgaXNu4oCZdCBwYXNzZWQuICovXHJcbnByb3RvLnN0ZXAgPSAxO1xyXG5cclxuXHJcbi8qKiBMb29zZSBzbmFwcGluZyB3aGlsZSBkcmFnICovXHJcbnByb3RvLnNuYXAgPSBmYWxzZTtcclxuXHJcblxyXG4vKiogQW5pbWF0ZSByZWxlYXNlIG1vdmVtZW50ICovXHJcbnByb3RvLnJlbGVhc2UgPSBmYWxzZTtcclxuXHJcblxyXG4vKiogUG9pbnQgcGlja2VyIGlzbuKAmXQgY29uc3RyYWluZWQgYnkgaXTigJlzIHNoYXBlICovXHJcbnByb3RvLnBvaW50ID0gZmFsc2U7XHJcblxyXG5cclxuLyoqIFBpY2tlciBhbGlnbm1lbnQgcmVsYXRpdmUgdG8gdGhlIG1vdXNlLiBSZWRlZmluZWQgYnkgc2xpZHksIGJ1dCB0byBwcmV2ZW50IGVtcHR5IHZhbHVlIGl0IGlzIHNldCB0byBudW1iZXIuICovXHJcbnByb3RvLmFsaWduID0gMC41O1xyXG5cclxuXHJcbi8qKiBDdXJyZW50IHBpY2tlciB2YWx1ZSB3cmFwcGVyICovXHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHByb3RvLCB7XHJcblx0dmFsdWU6IHtcclxuXHRcdHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XHJcblx0XHRcdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB0aHJvdyBFcnJvcignUGlja2VyIHZhbHVlIGNhbm5vdCBiZSB1bmRlZmluZWQuJyk7XHJcblxyXG5cdFx0XHQvL2FwcGx5IHJlcGVhdFxyXG5cdFx0XHRpZiAodGhpcy5yZXBlYXQpIHtcclxuXHRcdFx0XHRpZiAoaXNBcnJheSh2YWx1ZSkgJiYgdGhpcy5yZXBlYXQgPT09ICd4JykgdmFsdWVbMF0gPSBsb29wKHZhbHVlWzBdLCB0aGlzLm1pblswXSwgdGhpcy5tYXhbMF0pO1xyXG5cdFx0XHRcdGVsc2UgaWYgKGlzQXJyYXkodmFsdWUpICYmIHRoaXMucmVwZWF0ID09PSAneScpIHZhbHVlWzFdID0gbG9vcCh2YWx1ZVsxXSwgdGhpcy5taW5bMV0sIHRoaXMubWF4WzFdKTtcclxuXHRcdFx0XHRlbHNlIHZhbHVlID0gbG9vcCh2YWx1ZSwgdGhpcy5taW4sIHRoaXMubWF4KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly9hcHBseSBsaW1pdGluZ1xyXG5cdFx0XHR2YWx1ZSA9IGJldHdlZW4odmFsdWUsIHRoaXMubWluLCB0aGlzLm1heCk7XHJcblxyXG5cdFx0XHQvL3JvdW5kIHZhbHVlXHJcblx0XHRcdGlmICh0aGlzLnN0ZXApIHtcclxuXHRcdFx0XHRpZiAoaXNGbih0aGlzLnN0ZXApKSB2YWx1ZSA9IHJvdW5kKHZhbHVlLCB0aGlzLnN0ZXAodmFsdWUpKTtcclxuXHRcdFx0XHRlbHNlIHZhbHVlID0gcm91bmQodmFsdWUsIHRoaXMuc3RlcCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XHJcblxyXG5cdFx0XHQvL3RyaWdnZXIgYnViYmxpbmcgZXZlbnQsIGxpa2UgYWxsIGlucHV0cyBkb1xyXG5cdFx0XHR0aGlzLmVtaXQoJ2NoYW5nZScsIHZhbHVlKTtcclxuXHRcdFx0ZW1pdCh0aGlzLmVsZW1lbnQsICdjaGFuZ2UnLCB2YWx1ZSwgdHJ1ZSk7XHJcblx0XHR9LFxyXG5cdFx0Z2V0OiBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl92YWx1ZTtcclxuXHRcdH1cclxuXHR9XHJcbn0pO1xyXG5cclxuXHJcbi8qKlxyXG4gKiBNb3ZlIHBpY2tlciB2aXN1YWxseSB0byB0aGUgdmFsdWUgcGFzc2VkLlxyXG4gKiBTdXBwb3NlZCB0byBiZSByZWRlZmluZWQgYnkgdHlwZVxyXG4gKlxyXG4gKiBAcGFyYW0ge251bWJlcn0gdmFsdWUgVmFsdWUgdG8gcmVuZGVyXHJcbiAqXHJcbiAqIEByZXR1cm4ge1BpY2tlcn0gU2VsZiBpbnN0YW5jZVxyXG4gKi9cclxucHJvdG8ucmVuZGVyVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHt9O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBDYWxjIHZhbHVlIGZyb20gdGhlIHBpY2tlciBwb3NpdGlvblxyXG4gKiBTdXBwb3NlZCB0byBiZSByZWRlZmluZWQgYnkgdHlwZVxyXG4gKlxyXG4gKiBAcmV0dXJuIHtudW1iZXJ9IFZhbHVlLCBtaW4uLm1heFxyXG4gKi9cclxucHJvdG8uY2FsY1ZhbHVlID0gZnVuY3Rpb24gKHgsIHkpIHt9O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBVcGRhdGUgdmFsdWUgYmFzZWQgb24ga2V5cHJlc3MuIFN1cHBvc2VkIHRvIGJlIHJlZGVmaW5lZCBpbiB0eXBlIG9mIHBpY2tlci5cclxuICovXHJcbnByb3RvLmhhbmRsZUtleXMgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSwgc3RlcCkge307XHJcblxyXG5cclxuLyoqIFVwZGF0ZSBzZWxmIHNpemUsIHBpbiAmIHBvc2l0aW9uLCBhY2NvcmRpbmcgdG8gdGhlIHZhbHVlICovXHJcbnByb3RvLnVwZGF0ZSA9IGZ1bmN0aW9uICgpIHtcclxuXHQvL3VwZGF0ZSBwaW4gLSBtYXkgZGVwZW5kIG9uIGVsZW1lbnTigJlzIHNpemVcclxuXHRpZiAodGhpcy5wb2ludCkge1xyXG5cdFx0dGhpcy5kcmFnZ2FibGUucGluID0gW1xyXG5cdFx0XHR0aGlzLmRyYWdnYWJsZS5vZmZzZXRzLndpZHRoICogdGhpcy5hbGlnbixcclxuXHRcdFx0dGhpcy5kcmFnZ2FibGUub2Zmc2V0cy5oZWlnaHQgKiB0aGlzLmFsaWduXHJcblx0XHRdO1xyXG5cdH1cclxuXHJcblx0Ly91cGRhdGUgZHJhZ2dhYmxlIGxpbWl0c1xyXG5cdHRoaXMuZHJhZ2dhYmxlLnVwZGF0ZSgpO1xyXG5cclxuXHQvL3VwZGF0ZSBwb3NpdGlvbiBhY2NvcmRpbmcgdG8gdGhlIHZhbHVlXHJcblx0dGhpcy5yZW5kZXJWYWx1ZSh0aGlzLnZhbHVlKTtcclxuXHJcblx0cmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG5cclxuLyoqIE1vdmUgcGlja2VyIHRvIHRoZSB4LCB5IHJlbGF0aXZlIGNvb3JkaW5hdGVzICovXHJcbnByb3RvLm1vdmUgPSBmdW5jdGlvbiAoeCwgeSkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHJcblx0Ly9jb3JyZWN0IHBvaW50IHBsYWNlbWVudFxyXG5cdGlmIChzZWxmLnBvaW50KSB7XHJcblx0XHR2YXIgY3ggPSB0aGlzLmRyYWdnYWJsZS5waW4ud2lkdGggKiB0aGlzLmFsaWduO1xyXG5cdFx0dmFyIGN5ID0gdGhpcy5kcmFnZ2FibGUucGluLmhlaWdodCAqIHRoaXMuYWxpZ247XHJcblx0XHR4ID0geCAtIHRoaXMuZHJhZ2dhYmxlLnBpblswXSAtIGN4O1xyXG5cdFx0eSA9IHkgLSB0aGlzLmRyYWdnYWJsZS5waW5bMV0gLSBjeTtcclxuXHR9XHJcblxyXG5cdC8vaWYgdGh1bWIgaXMgbW9yZSB0aGFuIHZpc2libGUgYXJlYSAtIHN1YnRyYWN0IG92ZXJmbG93IGNvb3JkXHJcblx0dmFyIG92ZXJmbG93WCA9IHRoaXMuZHJhZ2dhYmxlLnBpbi53aWR0aCAtIHRoaXMuZWxlbWVudC5wYXJlbnROb2RlLmNsaWVudFdpZHRoO1xyXG5cdHZhciBvdmVyZmxvd1kgPSB0aGlzLmRyYWdnYWJsZS5waW4uaGVpZ2h0IC0gdGhpcy5lbGVtZW50LnBhcmVudE5vZGUuY2xpZW50SGVpZ2h0O1xyXG5cdGlmIChvdmVyZmxvd1ggPiAwKSB4IC09IG92ZXJmbG93WDtcclxuXHRpZiAob3ZlcmZsb3dZID4gMCkgeSAtPSBvdmVyZmxvd1k7XHJcblxyXG5cdHRoaXMuZHJhZ2dhYmxlLm1vdmUoeCwgeSk7XHJcblxyXG5cdC8vc2V0IHZhbHVlXHJcblx0dGhpcy52YWx1ZSA9IHRoaXMuY2FsY1ZhbHVlKHgsIHkpO1xyXG5cclxuXHRyZXR1cm4gdGhpcztcclxufTtcclxuXHJcblxyXG4vKipcclxuICogTW92ZSBwaWNrZXIgdG8gdGhlIHBvaW50IG9mIGNsaWNrIHdpdGggdGhlIGNlbnRlcmVkIGRyYWcgcG9pbnRcclxuICovXHJcbnByb3RvLnN0YXJ0RHJhZyA9IGZ1bmN0aW9uIChlKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuXHQvL3VwZGF0ZSBkcmFnIGxpbWl0cyBiYXNlZCBvZmYgZXZlbnQgcGFzc2VkXHJcblx0c2VsZi5kcmFnZ2FibGUuc2V0VG91Y2goZSkudXBkYXRlKGUpO1xyXG5cclxuXHQvL3N0YXJ0IGRyYWdcclxuXHQvL2lnbm9yZSBpZiBhbHJlYWR5IGRyYWdzXHJcblx0aWYgKHNlbGYuZHJhZ2dhYmxlLnN0YXRlICE9PSAnZHJhZycpIHtcclxuXHRcdHNlbGYuZHJhZ2dhYmxlLnN0YXRlID0gJ2RyYWcnO1xyXG5cdH1cclxuXHJcblx0Ly9jZW50cml6ZSBwaWNrZXJcclxuXHRzZWxmLmRyYWdnYWJsZS5pbm5lck9mZnNldFggPSBzZWxmLmRyYWdnYWJsZS5waW5bMF0gKyBzZWxmLmRyYWdnYWJsZS5waW4ud2lkdGggKiAwLjU7XHJcblx0c2VsZi5kcmFnZ2FibGUuaW5uZXJPZmZzZXRZID0gc2VsZi5kcmFnZ2FibGUucGluWzFdICsgc2VsZi5kcmFnZ2FibGUucGluLmhlaWdodCAqIDAuNTtcclxuXHJcblx0Ly9lbXVsYXRlIG1vdmVcclxuXHRzZWxmLmRyYWdnYWJsZS5kcmFnKGUpO1xyXG5cclxuXHRyZXR1cm4gdGhpcztcclxufTtcclxuXHJcblxyXG4vKiogTWFrZSBpdCBhY3RpdmUuICovXHJcbnByb3RvLmZvY3VzID0gZnVuY3Rpb24gKCkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHRzZWxmLmVsZW1lbnQuZm9jdXMoKTtcclxufTtcclxucHJvdG8uYmx1ciA9IGZ1bmN0aW9uICgpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0c2VsZi5lbGVtZW50LmJsdXIoKTtcclxufTtcclxuXHJcblxyXG4vKipcclxuICogUGxhY2luZyB0eXBlXHJcbiAqIEBlbnVtIHtzdHJpbmd9XHJcbiAqIEBkZWZhdWx0ICdob3Jpem9udGFsJ1xyXG4gKi9cclxucHJvdG8udHlwZSA9IHtcclxuXHQvL2RlZmF1bHQgb3JpZW50YXRpb24gaXMgaG9yaXpvbnRhbFxyXG5cdF86ICdob3Jpem9udGFsJyxcclxuXHJcblx0aG9yaXpvbnRhbDogZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuXHRcdHNlbGYuZHJhZ2dhYmxlLmF4aXMgPSAneCc7XHJcblxyXG5cdFx0Ly9wbGFjZSBwaWNrZXJzIGFjY29yZGluZyB0byB0aGUgdmFsdWVcclxuXHRcdHNlbGYucmVuZGVyVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHtcclxuXHRcdFx0dmFyXHRsaW1zID0gc2VsZi5kcmFnZ2FibGUubGltaXRzLFxyXG5cdFx0XHRcdHNjb3BlID0gbGltcy5yaWdodCAtIGxpbXMubGVmdCxcclxuXHRcdFx0XHRyYW5nZSA9IHNlbGYubWF4IC0gc2VsZi5taW4sXHJcblx0XHRcdFx0cmF0aW8gPSAodmFsdWUgLSBzZWxmLm1pbikgLyByYW5nZSxcclxuXHRcdFx0XHR4ID0gcmF0aW8gKiBzY29wZTtcclxuXHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKCdyZW5kZXInLCB2YWx1ZSwgJyA6ICcsIHgpXHJcblxyXG5cdFx0XHRzZWxmLm1vdmUoeCk7XHJcblxyXG5cdFx0XHRyZXR1cm4gc2VsZjtcclxuXHRcdH07XHJcblxyXG5cdFx0Ly9yb3VuZCB2YWx1ZSBvbiBlYWNoIGRyYWdcclxuXHRcdHNlbGYuY2FsY1ZhbHVlID0gZnVuY3Rpb24gKHgpIHtcclxuXHRcdFx0dmFyIGxpbXMgPSBzZWxmLmRyYWdnYWJsZS5saW1pdHMsXHJcblx0XHRcdFx0c2NvcGUgPSBsaW1zLnJpZ2h0IC0gbGltcy5sZWZ0LFxyXG5cdFx0XHRcdG5vcm1hbFZhbHVlID0gKHggLSBsaW1zLmxlZnQpIC8gc2NvcGU7XHJcblxyXG5cdFx0XHR2YXIgdmFsdWUgPSBub3JtYWxWYWx1ZSAqIChzZWxmLm1heCAtIHNlbGYubWluKSArIHNlbGYubWluO1xyXG5cdFx0XHQvLyBjb25zb2xlLmxvZygnY2FsYycsIHgsICcgOiAnLCB2YWx1ZSk7XHJcblxyXG5cdFx0XHRyZXR1cm4gdmFsdWU7XHJcblx0XHR9O1xyXG5cclxuXHRcdHNlbGYuaGFuZGxlS2V5cyA9IGhhbmRsZTFka2V5cztcclxuXHR9LFxyXG5cdHZlcnRpY2FsOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0XHRzZWxmLmRyYWdnYWJsZS5heGlzID0gJ3knO1xyXG5cclxuXHRcdC8vcGxhY2UgcGlja2VycyBhY2NvcmRpbmcgdG8gdGhlIHZhbHVlXHJcblx0XHRzZWxmLnJlbmRlclZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcblx0XHRcdHZhclx0bGltcyA9IHNlbGYuZHJhZ2dhYmxlLmxpbWl0cyxcclxuXHRcdFx0XHRzY29wZSA9IGxpbXMuYm90dG9tIC0gbGltcy50b3AsXHJcblx0XHRcdFx0cmFuZ2UgPSBzZWxmLm1heCAtIHNlbGYubWluLFxyXG5cdFx0XHRcdHJhdGlvID0gKC12YWx1ZSArIHNlbGYubWF4KSAvIHJhbmdlLFxyXG5cdFx0XHRcdHkgPSByYXRpbyAqIHNjb3BlO1xyXG5cdFx0XHRzZWxmLm1vdmUobnVsbCwgeSk7XHJcblxyXG5cdFx0XHRyZXR1cm4gc2VsZjtcclxuXHRcdH07XHJcblxyXG5cdFx0Ly9yb3VuZCB2YWx1ZSBvbiBlYWNoIGRyYWdcclxuXHRcdHNlbGYuY2FsY1ZhbHVlID0gZnVuY3Rpb24gKHgsIHkpIHtcclxuXHRcdFx0dmFyIGxpbXMgPSBzZWxmLmRyYWdnYWJsZS5saW1pdHMsXHJcblx0XHRcdFx0c2NvcGUgPSBsaW1zLmJvdHRvbSAtIGxpbXMudG9wLFxyXG5cdFx0XHRcdG5vcm1hbFZhbHVlID0gKC15ICsgbGltcy5ib3R0b20pIC8gc2NvcGU7XHJcblxyXG5cdFx0XHRyZXR1cm4gbm9ybWFsVmFsdWUgKiAoc2VsZi5tYXggLSBzZWxmLm1pbikgKyBzZWxmLm1pbjtcclxuXHRcdH07XHJcblxyXG5cdFx0c2VsZi5oYW5kbGVLZXlzID0gaGFuZGxlMWRrZXlzO1xyXG5cdH0sXHJcblx0cmVjdGFuZ3VsYXI6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBzZWxmID0gdGhpcztcclxuXHRcdHNlbGYuZHJhZ2dhYmxlLmF4aXMgPSBudWxsO1xyXG5cclxuXHRcdHNlbGYucmVuZGVyVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHtcclxuXHRcdFx0dmFyXHRsaW0gPSBzZWxmLmRyYWdnYWJsZS5saW1pdHMsXHJcblx0XHRcdFx0aFNjb3BlID0gKGxpbS5yaWdodCAtIGxpbS5sZWZ0KSxcclxuXHRcdFx0XHR2U2NvcGUgPSAobGltLmJvdHRvbSAtIGxpbS50b3ApO1xyXG5cdFx0XHR2YXIgaFJhbmdlID0gc2VsZi5tYXhbMF0gLSBzZWxmLm1pblswXSxcclxuXHRcdFx0XHR2UmFuZ2UgPSBzZWxmLm1heFsxXSAtIHNlbGYubWluWzFdLFxyXG5cdFx0XHRcdHJhdGlvWCA9ICh2YWx1ZVswXSAtIHNlbGYubWluWzBdKSAvIGhSYW5nZSxcclxuXHRcdFx0XHRyYXRpb1kgPSAoLXZhbHVlWzFdICsgc2VsZi5tYXhbMV0pIC8gdlJhbmdlO1xyXG5cclxuXHRcdFx0c2VsZi5tb3ZlKHJhdGlvWCAqIGhTY29wZSwgcmF0aW9ZICogdlNjb3BlKTtcclxuXHJcblx0XHRcdHJldHVybiBzZWxmO1xyXG5cdFx0fTtcclxuXHJcblx0XHRzZWxmLmNhbGNWYWx1ZSA9IGZ1bmN0aW9uICh4LCB5KSB7XHJcblx0XHRcdHZhciBsaW0gPSBzZWxmLmRyYWdnYWJsZS5saW1pdHMsXHJcblx0XHRcdFx0aFNjb3BlID0gKGxpbS5yaWdodCAtIGxpbS5sZWZ0KSxcclxuXHRcdFx0XHR2U2NvcGUgPSAobGltLmJvdHRvbSAtIGxpbS50b3ApO1xyXG5cclxuXHRcdFx0dmFyIG5vcm1hbFZhbHVlID0gWyh4IC0gbGltLmxlZnQpIC8gaFNjb3BlLCAoIC0geSArIGxpbS5ib3R0b20pIC8gdlNjb3BlXTtcclxuXHJcblx0XHRcdHJldHVybiBbXHJcblx0XHRcdFx0bm9ybWFsVmFsdWVbMF0gKiAoc2VsZi5tYXhbMF0gLSBzZWxmLm1pblswXSkgKyBzZWxmLm1pblswXSxcclxuXHRcdFx0XHRub3JtYWxWYWx1ZVsxXSAqIChzZWxmLm1heFsxXSAtIHNlbGYubWluWzFdKSArIHNlbGYubWluWzFdXHJcblx0XHRcdF07XHJcblx0XHR9O1xyXG5cclxuXHRcdHNlbGYuaGFuZGxlS2V5cyA9IGhhbmRsZTJka2V5cztcclxuXHR9LFxyXG5cdGNpcmN1bGFyOiBmdW5jdGlvbiAoKSB7XHJcblx0XHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0XHRzZWxmLmRyYWdnYWJsZS5heGlzID0gbnVsbDtcclxuXHJcblx0XHQvL2xpbWl0IHgveSBieSB0aGUgY2lyY3VtZmVyZW5jZVxyXG5cdFx0c2VsZi5kcmFnZ2FibGUubW92ZSA9IGZ1bmN0aW9uICh4LCB5KSB7XHJcblx0XHRcdHZhciBsaW0gPSB0aGlzLmxpbWl0cztcclxuXHRcdFx0dmFyIGhTY29wZSA9IChsaW0ucmlnaHQgLSBsaW0ubGVmdCksXHJcblx0XHRcdFx0dlNjb3BlID0gKGxpbS5ib3R0b20gLSBsaW0udG9wKTtcclxuXHJcblx0XHRcdHZhciBjeCA9IGhTY29wZSAvIDIgLSB0aGlzLnBpblswXSxcclxuXHRcdFx0XHRjeSA9IHZTY29wZSAvIDIgLSB0aGlzLnBpblsxXTtcclxuXHJcblx0XHRcdHZhciBhbmdsZSA9IE1hdGguYXRhbjIoeSAtIGN5LCB4IC0gY3gpO1xyXG5cclxuXHRcdFx0dGhpcy5zZXRDb29yZHMoXHJcblx0XHRcdFx0TWF0aC5jb3MoYW5nbGUpICogKGN4ICsgdGhpcy5waW5bMF0pICsgY3gsXHJcblx0XHRcdFx0TWF0aC5zaW4oYW5nbGUpICogKGN5ICsgdGhpcy5waW5bMV0pICsgY3lcclxuXHRcdFx0KTtcclxuXHRcdH07XHJcblxyXG5cdFx0c2VsZi5yZW5kZXJWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG5cdFx0XHR2YXJcdGxpbSA9IHNlbGYuZHJhZ2dhYmxlLmxpbWl0cyxcclxuXHRcdFx0XHRoU2NvcGUgPSAobGltLnJpZ2h0IC0gbGltLmxlZnQpLFxyXG5cdFx0XHRcdHZTY29wZSA9IChsaW0uYm90dG9tIC0gbGltLnRvcCksXHJcblx0XHRcdFx0Y2VudGVyWCA9IGhTY29wZSAqIDAuNSxcclxuXHRcdFx0XHRjZW50ZXJZID0gdlNjb3BlICogMC41O1xyXG5cclxuXHRcdFx0dmFyIHJhbmdlID0gc2VsZi5tYXggLSBzZWxmLm1pbjtcclxuXHJcblx0XHRcdHZhclx0bm9ybWFsVmFsdWUgPSAodmFsdWUgLSBzZWxmLm1pbikgLyByYW5nZTtcclxuXHRcdFx0dmFyIGFuZ2xlID0gKG5vcm1hbFZhbHVlIC0gMC41KSAqIDIgKiBNYXRoLlBJO1xyXG5cdFx0XHRzZWxmLm1vdmUoXHJcblx0XHRcdFx0TWF0aC5jb3MoYW5nbGUpICogY2VudGVyWCArIGNlbnRlclgsXHJcblx0XHRcdFx0TWF0aC5zaW4oYW5nbGUpICogY2VudGVyWSArIGNlbnRlcllcclxuXHRcdFx0KTtcclxuXHRcdH07XHJcblxyXG5cdFx0c2VsZi5jYWxjVmFsdWUgPSBmdW5jdGlvbiAoeCwgeSkge1xyXG5cdFx0XHR2YXIgbGltID0gc2VsZi5kcmFnZ2FibGUubGltaXRzLFxyXG5cdFx0XHRcdGhTY29wZSA9IChsaW0ucmlnaHQgLSBsaW0ubGVmdCksXHJcblx0XHRcdFx0dlNjb3BlID0gKGxpbS5ib3R0b20gLSBsaW0udG9wKTtcclxuXHJcblx0XHRcdHggPSB4IC0gaFNjb3BlICogMC41ICsgc2VsZi5kcmFnZ2FibGUucGluWzBdO1xyXG5cdFx0XHR5ID0geSAtIHZTY29wZSAqIDAuNSArIHNlbGYuZHJhZ2dhYmxlLnBpblsxXTtcclxuXHJcblx0XHRcdC8vZ2V0IGFuZ2xlXHJcblx0XHRcdHZhciBhbmdsZSA9IE1hdGguYXRhbjIoIHksIHggKTtcclxuXHJcblx0XHRcdC8vZ2V0IG5vcm1hbCB2YWx1ZVxyXG5cdFx0XHR2YXIgbm9ybWFsVmFsdWUgPSBhbmdsZSAqIDAuNSAvIE1hdGguUEkgKyAwLjU7XHJcblxyXG5cdFx0XHQvL2dldCB2YWx1ZSBmcm9tIGNvb3Jkc1xyXG5cdFx0XHRyZXR1cm4gbm9ybWFsVmFsdWUgKiAoc2VsZi5tYXggLSBzZWxmLm1pbikgKyBzZWxmLm1pbjtcclxuXHRcdH07XHJcblxyXG5cdFx0c2VsZi5oYW5kbGVLZXlzID0gaGFuZGxlMWRrZXlzO1xyXG5cdH0sXHJcblx0cm91bmQ6IGZ1bmN0aW9uICgpIHtcclxuXHRcdHZhciBzZWxmID0gdGhpcztcclxuXHRcdHNlbGYuZHJhZ2dhYmxlLmF4aXMgPSBudWxsO1xyXG5cclxuXHRcdC8vbGltaXQgeC95IHdpdGhpbiB0aGUgY2lyY2xlXHJcblx0XHRzZWxmLmRyYWdnYWJsZS5tb3ZlID0gZnVuY3Rpb24gKHgsIHkpIHtcclxuXHRcdFx0dmFyIGxpbSA9IHRoaXMubGltaXRzO1xyXG5cdFx0XHR2YXIgaFNjb3BlID0gKGxpbS5yaWdodCAtIGxpbS5sZWZ0KSxcclxuXHRcdFx0XHR2U2NvcGUgPSAobGltLmJvdHRvbSAtIGxpbS50b3ApO1xyXG5cclxuXHRcdFx0dmFyIGN4ID0gaFNjb3BlIC8gMiAtIHRoaXMucGluWzBdLFxyXG5cdFx0XHRcdGN5ID0gdlNjb3BlIC8gMiAtIHRoaXMucGluWzFdO1xyXG5cdFx0XHR2YXIgZHggPSB4IC0gY3gsXHJcblx0XHRcdFx0ZHkgPSB5IC0gY3k7XHJcblxyXG5cdFx0XHR2YXIgYW5nbGUgPSBNYXRoLmF0YW4yKHkgLSBjeSwgeCAtIGN4KTtcclxuXHRcdFx0dmFyIHIgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpO1xyXG5cclxuXHRcdFx0Ly9saW1pdCBtYXggcmFkaXVzIGFzIGEgY2lyY3VtZmVyZW5jZVxyXG5cdFx0XHR0aGlzLnNldENvb3JkcyhcclxuXHRcdFx0XHQociA+IGhTY29wZSAvIDIpID8gTWF0aC5jb3MoYW5nbGUpICogKGN4ICsgdGhpcy5waW5bMF0pICsgY3ggOiB4LFxyXG5cdFx0XHRcdChyID4gdlNjb3BlIC8gMikgPyBNYXRoLnNpbihhbmdsZSkgKiAoY3kgKyB0aGlzLnBpblsxXSkgKyBjeSA6IHlcclxuXHRcdFx0KTtcclxuXHRcdH07XHJcblxyXG5cdFx0c2VsZi5yZW5kZXJWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG5cdFx0XHR2YXJcdGxpbSA9IHNlbGYuZHJhZ2dhYmxlLmxpbWl0cyxcclxuXHRcdFx0XHRoU2NvcGUgPSAobGltLnJpZ2h0IC0gbGltLmxlZnQpLFxyXG5cdFx0XHRcdHZTY29wZSA9IChsaW0uYm90dG9tIC0gbGltLnRvcCksXHJcblx0XHRcdFx0Y2VudGVyWCA9IGhTY29wZSAqIDAuNSxcclxuXHRcdFx0XHRjZW50ZXJZID0gdlNjb3BlICogMC41O1xyXG5cclxuXHRcdFx0Ly9nZXQgYW5nbGUgbm9ybWFsIHZhbHVlXHJcblx0XHRcdHZhciBhUmFuZ2UgPSBzZWxmLm1heFswXSAtIHNlbGYubWluWzBdO1xyXG5cdFx0XHR2YXJcdG5vcm1hbEFuZ2xlVmFsdWUgPSAodmFsdWVbMF0gLSBzZWxmLm1pblswXSkgLyBhUmFuZ2U7XHJcblx0XHRcdHZhciBhbmdsZSA9IChub3JtYWxBbmdsZVZhbHVlIC0gMC41KSAqIDIgKiBNYXRoLlBJO1xyXG5cclxuXHRcdFx0Ly9nZXQgcmFkaXVzIG5vcm1hbCB2YWx1ZVxyXG5cdFx0XHR2YXIgclJhbmdlID0gc2VsZi5tYXhbMV0gLSBzZWxmLm1pblsxXTtcclxuXHRcdFx0dmFyIG5vcm1hbFJhZGl1c1ZhbHVlID0gKHZhbHVlWzFdIC0gc2VsZi5taW5bMV0pIC8gclJhbmdlO1xyXG5cclxuXHRcdFx0dmFyIHhSYWRpdXMgPSBjZW50ZXJYICogbm9ybWFsUmFkaXVzVmFsdWU7XHJcblx0XHRcdHZhciB5UmFkaXVzID0gY2VudGVyWSAqIG5vcm1hbFJhZGl1c1ZhbHVlO1xyXG5cclxuXHRcdFx0c2VsZi5tb3ZlKFxyXG5cdFx0XHRcdE1hdGguY29zKGFuZ2xlKSAqIHhSYWRpdXMgKyBjZW50ZXJYLFxyXG5cdFx0XHRcdE1hdGguc2luKGFuZ2xlKSAqIHlSYWRpdXMgKyBjZW50ZXJZXHJcblx0XHRcdCk7XHJcblx0XHR9O1xyXG5cclxuXHRcdHNlbGYuY2FsY1ZhbHVlID0gZnVuY3Rpb24gKHgsIHkpIHtcclxuXHRcdFx0dmFyIGxpbSA9IHNlbGYuZHJhZ2dhYmxlLmxpbWl0cyxcclxuXHRcdFx0XHRoU2NvcGUgPSAobGltLnJpZ2h0IC0gbGltLmxlZnQpLFxyXG5cdFx0XHRcdHZTY29wZSA9IChsaW0uYm90dG9tIC0gbGltLnRvcCk7XHJcblxyXG5cdFx0XHR4ID0geCArIHNlbGYuZHJhZ2dhYmxlLnBpblswXSAtIGhTY29wZSAqIDAuNTtcclxuXHRcdFx0eSA9IHkgKyBzZWxmLmRyYWdnYWJsZS5waW5bMV0gLSB2U2NvcGUgKiAwLjU7XHJcblxyXG5cdFx0XHQvL2dldCBhbmdsZVxyXG5cdFx0XHR2YXIgYW5nbGUgPSBNYXRoLmF0YW4yKCB5LCB4ICk7XHJcblxyXG5cdFx0XHQvL2dldCBub3JtYWwgdmFsdWVcclxuXHRcdFx0dmFyIG5vcm1hbEFuZ2xlVmFsdWUgPSAoYW5nbGUgKiAwLjUgLyBNYXRoLlBJICsgMC41KTtcclxuXHRcdFx0dmFyIG5vcm1hbFJhZGl1c1ZhbHVlID0gTWF0aC5zcXJ0KCB4KnggKyB5KnkgKSAvIGhTY29wZSAqIDI7XHJcblxyXG5cdFx0XHQvL2dldCB2YWx1ZSBmcm9tIGNvb3Jkc1xyXG5cdFx0XHRyZXR1cm4gW1xyXG5cdFx0XHRcdG5vcm1hbEFuZ2xlVmFsdWUgKiAoc2VsZi5tYXhbMF0gLSBzZWxmLm1pblswXSkgKyBzZWxmLm1pblswXSxcclxuXHRcdFx0XHRub3JtYWxSYWRpdXNWYWx1ZSAqIChzZWxmLm1heFsxXSAtIHNlbGYubWluWzFdKSArIHNlbGYubWluWzFdXHJcblx0XHRcdF07XHJcblx0XHR9O1xyXG5cclxuXHRcdHNlbGYuaGFuZGxlS2V5cyA9IGhhbmRsZTJka2V5cztcclxuXHR9XHJcbn07XHJcblxyXG5cclxuLyoqIEluY3JlbWVudCAvIGRlY3JlbWVudCBBUEkgKi9cclxucHJvdG8uaW5jID0gZnVuY3Rpb24gKHRpbWVzWCwgdGltZXNZKSB7XHJcblx0aWYgKGlzQXJyYXkodGhpcy52YWx1ZSkpIHtcclxuXHRcdHRoaXMudmFsdWVbMF0gPSBpbmModGhpcy52YWx1ZVswXSwgdGhpcy5zdGVwLCB0aW1lc1gpO1xyXG5cdFx0dGhpcy52YWx1ZVsxXSA9IGluYyh0aGlzLnZhbHVlWzFdLCB0aGlzLnN0ZXAsIHRpbWVzWSk7XHJcblx0XHR0aGlzLnJlbmRlclZhbHVlKHRoaXMudmFsdWUpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR2YXIgdGltZXMgPSB0aW1lc1kgfHwgdGltZXNYO1xyXG5cdFx0dGhpcy52YWx1ZSA9IGluYyh0aGlzLnZhbHVlLCB0aGlzLnN0ZXAsIHRpbWVzKTtcclxuXHRcdHRoaXMucmVuZGVyVmFsdWUodGhpcy52YWx1ZSk7XHJcblx0fVxyXG59O1xyXG5cclxuXHJcbi8qKiBJbmNyZW1lbnQgJiBkZWNyZW1lbnQgdmFsdWUgYnkgdGhlIHN0ZXAgW04gdGltZXNdICovXHJcbmZ1bmN0aW9uIGluYyAodmFsdWUsIHN0ZXAsIG11bHQpIHtcclxuXHRtdWx0ID0gbXVsdCB8fCAwO1xyXG5cclxuXHRpZiAoaXNGbihzdGVwKSkgc3RlcCA9IHN0ZXAodmFsdWUgKyAobXVsdCA+IDAgPyArIE1JTl9TVEVQIDogLSBNSU5fU1RFUCkpO1xyXG5cclxuXHRyZXR1cm4gdmFsdWUgKyBzdGVwICogbXVsdDtcclxufVxyXG5cclxuXHJcbi8qKiBBcHBseSBwcmVzc2VkIGtleXMgb24gdGhlIDJkIHZhbHVlICovXHJcbmZ1bmN0aW9uIGhhbmRsZTJka2V5cyAoa2V5cywgdmFsdWUsIHN0ZXAsIG1pbiwgbWF4KSB7XHJcblx0Ly91cCBhbmQgcmlnaHQgLSBpbmNyZWFzZSBieSBvbmVcclxuXHRpZiAoa2V5c1szOF0pIHtcclxuXHRcdHZhbHVlWzFdID0gaW5jKHZhbHVlWzFdLCBzdGVwLCAxKTtcclxuXHR9XHJcblx0aWYgKGtleXNbMzldKSB7XHJcblx0XHR2YWx1ZVswXSA9IGluYyh2YWx1ZVswXSwgc3RlcCwgMSk7XHJcblx0fVxyXG5cdGlmIChrZXlzWzQwXSkge1xyXG5cdFx0dmFsdWVbMV0gPSBpbmModmFsdWVbMV0sIHN0ZXAsIC0xKTtcclxuXHR9XHJcblx0aWYgKGtleXNbMzddKSB7XHJcblx0XHR2YWx1ZVswXSA9IGluYyh2YWx1ZVswXSwgc3RlcCwgLTEpO1xyXG5cdH1cclxuXHJcblx0Ly9tZXRhXHJcblx0dmFyIGNvb3JkSWR4ID0gMTtcclxuXHRpZiAoa2V5c1sxOF0gfHwga2V5c1s5MV0gfHwga2V5c1sxN10gfHwga2V5c1sxNl0pIGNvb3JkSWR4ID0gMDtcclxuXHQvL2hvbWUgLSBtaW5cclxuXHRpZiAoa2V5c1szNl0pIHtcclxuXHRcdHZhbHVlW2Nvb3JkSWR4XSA9IG1pbltjb29yZElkeF07XHJcblx0fVxyXG5cclxuXHQvL2VuZCAtIG1heFxyXG5cdGlmIChrZXlzWzM1XSkge1xyXG5cdFx0dmFsdWVbY29vcmRJZHhdID0gbWF4W2Nvb3JkSWR4XTtcclxuXHR9XHJcblxyXG5cdC8vcGFnZXVwXHJcblx0aWYgKGtleXNbMzNdKSB7XHJcblx0XHR2YWx1ZVtjb29yZElkeF0gPSBpbmModmFsdWVbY29vcmRJZHhdLCBzdGVwLCBQQUdFKTtcclxuXHR9XHJcblxyXG5cdC8vcGFnZWRvd25cclxuXHRpZiAoa2V5c1szNF0pIHtcclxuXHRcdHZhbHVlW2Nvb3JkSWR4XSA9IGluYyh2YWx1ZVtjb29yZElkeF0sIHN0ZXAsIC1QQUdFKTtcclxuXHR9XHJcblxyXG5cclxuXHRyZXR1cm4gdmFsdWU7XHJcbn1cclxuXHJcblxyXG4vKiogQXBwbHkgcHJlc3NlZCBrZXlzIG9uIHRoZSAxZCB2YWx1ZSAqL1xyXG5mdW5jdGlvbiBoYW5kbGUxZGtleXMgKGtleXMsIHZhbHVlLCBzdGVwLCBtaW4sIG1heCkge1xyXG5cdHN0ZXAgPSBzdGVwIHx8IDE7XHJcblxyXG5cdC8vdXAgYW5kIHJpZ2h0IC0gaW5jcmVhc2UgYnkgb25lXHJcblx0aWYgKGtleXNbMzhdIHx8IGtleXNbMzldKSB7XHJcblx0XHR2YWx1ZSA9IGluYyh2YWx1ZSwgc3RlcCwgMSk7XHJcblx0fVxyXG5cclxuXHQvL2Rvd24gYW5kIGxlZnQgLSBkZWNyZWFzZSBieSBvbmVcclxuXHRpZiAoa2V5c1s0MF0gfHwga2V5c1szN10pIHtcclxuXHRcdHZhbHVlID0gaW5jKHZhbHVlLCBzdGVwLCAtMSk7XHJcblx0fVxyXG5cclxuXHQvL2hvbWUgLSBtaW5cclxuXHRpZiAoa2V5c1szNl0pIHtcclxuXHRcdHZhbHVlID0gbWluO1xyXG5cdH1cclxuXHJcblx0Ly9lbmQgLSBtYXhcclxuXHRpZiAoa2V5c1szNV0pIHtcclxuXHRcdHZhbHVlID0gbWF4O1xyXG5cdH1cclxuXHJcblx0Ly9wYWdldXBcclxuXHRpZiAoa2V5c1szM10pIHtcclxuXHRcdHZhbHVlID0gaW5jKHZhbHVlLCBzdGVwLCBQQUdFKTtcclxuXHR9XHJcblxyXG5cdC8vcGFnZWRvd25cclxuXHRpZiAoa2V5c1szNF0pIHtcclxuXHRcdHZhbHVlID0gaW5jKHZhbHVlLCBzdGVwLCAtUEFHRSk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gdmFsdWU7XHJcbn0iLCIvKipcclxuICogRGVmaW5lIHN0YXRlZnVsIHByb3BlcnR5IG9uIGFuIG9iamVjdFxyXG4gKi9cclxubW9kdWxlLmV4cG9ydHMgPSBkZWZpbmVTdGF0ZTtcclxuXHJcbnZhciBTdGF0ZSA9IHJlcXVpcmUoJ3N0OCcpO1xyXG5cclxuXHJcbi8qKlxyXG4gKiBEZWZpbmUgc3RhdGVmdWwgcHJvcGVydHkgb24gYSB0YXJnZXRcclxuICpcclxuICogQHBhcmFtIHtvYmplY3R9IHRhcmdldCBBbnkgb2JqZWN0XHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wZXJ0eSBQcm9wZXJ0eSBuYW1lXHJcbiAqIEBwYXJhbSB7b2JqZWN0fSBkZXNjcmlwdG9yIFN0YXRlIGRlc2NyaXB0b3JcclxuICpcclxuICogQHJldHVybiB7b2JqZWN0fSB0YXJnZXRcclxuICovXHJcbmZ1bmN0aW9uIGRlZmluZVN0YXRlICh0YXJnZXQsIHByb3BlcnR5LCBkZXNjcmlwdG9yLCBpc0ZuKSB7XHJcblx0Ly9kZWZpbmUgYWNjZXNzb3Igb24gYSB0YXJnZXRcclxuXHRpZiAoaXNGbikge1xyXG5cdFx0dGFyZ2V0W3Byb3BlcnR5XSA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0aWYgKGFyZ3VtZW50cy5sZW5ndGgpIHtcclxuXHRcdFx0XHRyZXR1cm4gc3RhdGUuc2V0KGFyZ3VtZW50c1swXSk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0cmV0dXJuIHN0YXRlLmdldCgpO1xyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cdH1cclxuXHJcblx0Ly9kZWZpbmUgc2V0dGVyL2dldHRlciBvbiBhIHRhcmdldFxyXG5cdGVsc2Uge1xyXG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgcHJvcGVydHksIHtcclxuXHRcdFx0c2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcclxuXHRcdFx0XHRyZXR1cm4gc3RhdGUuc2V0KHZhbHVlKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0Z2V0OiBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0cmV0dXJuIHN0YXRlLmdldCgpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdC8vZGVmaW5lIHN0YXRlIGNvbnRyb2xsZXJcclxuXHR2YXIgc3RhdGUgPSBuZXcgU3RhdGUoZGVzY3JpcHRvciwgdGFyZ2V0KTtcclxuXHJcblx0cmV0dXJuIHRhcmdldDtcclxufSIsIi8qKlxuICogU2ltcGxlIGRyYWdnYWJsZSBjb21wb25lbnRcbiAqXG4gKiBAbW9kdWxlIGRyYWdneVxuICovXG5cblxuLy93b3JrIHdpdGggY3NzXG52YXIgY3NzID0gcmVxdWlyZSgnbXVjc3MvY3NzJyk7XG52YXIgcGFyc2VDU1NWYWx1ZSA9IHJlcXVpcmUoJ211Y3NzL3BhcnNlLXZhbHVlJyk7XG52YXIgc2VsZWN0aW9uID0gcmVxdWlyZSgnbXVjc3Mvc2VsZWN0aW9uJyk7XG52YXIgb2Zmc2V0cyA9IHJlcXVpcmUoJ211Y3NzL29mZnNldHMnKTtcbnZhciBnZXRUcmFuc2xhdGUgPSByZXF1aXJlKCdtdWNzcy90cmFuc2xhdGUnKTtcblxuLy9ldmVudHNcbnZhciBvbiA9IHJlcXVpcmUoJ2VtbXkvb24nKTtcbnZhciBvZmYgPSByZXF1aXJlKCdlbW15L29mZicpO1xudmFyIGVtaXQgPSByZXF1aXJlKCdlbW15L2VtaXQnKTtcbnZhciBFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyk7XG52YXIgZ2V0Q2xpZW50WCA9IHJlcXVpcmUoJ2dldC1jbGllbnQteHknKS54O1xudmFyIGdldENsaWVudFkgPSByZXF1aXJlKCdnZXQtY2xpZW50LXh5JykueTtcblxuLy91dGlsc1xudmFyIGlzQXJyYXkgPSByZXF1aXJlKCdpcy1hcnJheScpO1xudmFyIGlzTnVtYmVyID0gcmVxdWlyZSgnaXMtbnVtYmVyJyk7XG52YXIgaXNGbiA9IHJlcXVpcmUoJ2lzLWZ1bmN0aW9uJyk7XG52YXIgZGVmaW5lU3RhdGUgPSByZXF1aXJlKCdkZWZpbmUtc3RhdGUnKTtcbnZhciBleHRlbmQgPSByZXF1aXJlKCd4dGVuZC9tdXRhYmxlJyk7XG52YXIgcm91bmQgPSByZXF1aXJlKCdtdW1hdGgvcm91bmQnKTtcbnZhciBiZXR3ZWVuID0gcmVxdWlyZSgnbXVtYXRoL2JldHdlZW4nKTtcbnZhciBsb29wID0gcmVxdWlyZSgnbXVtYXRoL2xvb3AnKTtcbnZhciBnZXRVaWQgPSByZXF1aXJlKCdnZXQtdWlkJyk7XG5cblxudmFyIHdpbiA9IHdpbmRvdywgZG9jID0gZG9jdW1lbnQsIHJvb3QgPSBkb2MuZG9jdW1lbnRFbGVtZW50O1xuXG5cbi8qKlxuICogRHJhZ2dhYmxlIGNvbnRyb2xsZXJzIGFzc29jaWF0ZWQgd2l0aCBlbGVtZW50cy5cbiAqXG4gKiBTdG9yaW5nIHRoZW0gb24gZWxlbWVudHMgaXNcbiAqIC0gbGVhay1wcm9uZSxcbiAqIC0gcG9sbHV0ZXMgZWxlbWVudOKAmXMgbmFtZXNwYWNlLFxuICogLSByZXF1aXJlcyBzb21lIGFydGlmaWNpYWwga2V5IHRvIHN0b3JlLFxuICogLSB1bmFibGUgdG8gcmV0cmlldmUgY29udHJvbGxlciBlYXNpbHkuXG4gKlxuICogVGhhdCBpcyB3aHkgd2Vha21hcC5cbiAqL1xudmFyIGRyYWdnYWJsZUNhY2hlID0gRHJhZ2dhYmxlLmNhY2hlID0gbmV3IFdlYWtNYXA7XG5cblxuXG4vKipcbiAqIE1ha2UgYW4gZWxlbWVudCBkcmFnZ2FibGUuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKlxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdGFyZ2V0IEFuIGVsZW1lbnQgd2hldGhlciBpbi9vdXQgb2YgRE9NXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBBbiBkcmFnZ2FibGUgb3B0aW9uc1xuICpcbiAqIEByZXR1cm4ge0hUTUxFbGVtZW50fSBUYXJnZXQgZWxlbWVudFxuICovXG5mdW5jdGlvbiBEcmFnZ2FibGUodGFyZ2V0LCBvcHRpb25zKSB7XG5cdGlmICghKHRoaXMgaW5zdGFuY2VvZiBEcmFnZ2FibGUpKSByZXR1cm4gbmV3IERyYWdnYWJsZSh0YXJnZXQsIG9wdGlvbnMpO1xuXG5cdHZhciBzZWxmID0gdGhpcztcblxuXHQvL2dldCB1bmlxdWUgaWQgZm9yIGluc3RhbmNlXG5cdC8vbmVlZGVkIHRvIHRyYWNrIGV2ZW50IGJpbmRlcnNcblx0c2VsZi5faWQgPSBnZXRVaWQoKTtcblx0c2VsZi5fbnMgPSAnLmRyYWdneV8nICsgc2VsZi5faWQ7XG5cblx0Ly9zYXZlIGVsZW1lbnQgcGFzc2VkXG5cdHNlbGYuZWxlbWVudCA9IHRhcmdldDtcblx0ZHJhZ2dhYmxlQ2FjaGUuc2V0KHRhcmdldCwgc2VsZik7XG5cblx0Ly9kZWZpbmUgbW9kZSBvZiBkcmFnXG5cdGRlZmluZVN0YXRlKHNlbGYsICdjc3MzJywgc2VsZi5jc3MzKTtcblx0c2VsZi5jc3MzID0gdHJ1ZTtcblxuXHQvL2RlZmluZSBzdGF0ZSBiZWhhdmlvdXJcblx0ZGVmaW5lU3RhdGUoc2VsZiwgJ3N0YXRlJywgc2VsZi5zdGF0ZSk7XG5cdHNlbGYuc3RhdGUgPSAnaWRsZSc7XG5cblx0Ly9kZWZpbmUgYXhpcyBiZWhhdmlvdXJcblx0ZGVmaW5lU3RhdGUoc2VsZiwgJ2F4aXMnLCBzZWxmLmF4aXMpO1xuXHRzZWxmLmF4aXMgPSBudWxsO1xuXG5cdC8vZGVmaW5lIGFuaW0gbW9kZVxuXHRkZWZpbmVTdGF0ZShzZWxmLCAnaXNBbmltYXRlZCcsIHNlbGYuaXNBbmltYXRlZCk7XG5cblx0Ly90YWtlIG92ZXIgb3B0aW9uc1xuXHRleHRlbmQoc2VsZiwgb3B0aW9ucyk7XG5cblx0Ly90cnkgdG8gY2FsYyBvdXQgYmFzaWMgbGltaXRzXG5cdHNlbGYudXBkYXRlKCk7XG59XG5cblxuLyoqIEluaGVyaXQgZHJhZ2dhYmxlIGZyb20gRW1pdHRlciAqL1xudmFyIHByb3RvID0gRHJhZ2dhYmxlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRW1pdHRlci5wcm90b3R5cGUpO1xuXG5cbi8qKlxuICogRHJhZ2dhYmxlIGJlaGF2aW91clxuICogQGVudW0ge3N0cmluZ31cbiAqIEBkZWZhdWx0IGlzICdpZGxlJ1xuICovXG5wcm90by5zdGF0ZSA9IHtcblx0Ly9pZGxlXG5cdF86IHtcblx0XHRiZWZvcmU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBzZWxmID0gdGhpcztcblxuXHRcdFx0Ly9lbWl0IGRyYWcgZXZ0cyBvbiBlbGVtZW50XG5cdFx0XHRlbWl0KHNlbGYuZWxlbWVudCwgJ2lkbGUnLCBudWxsLCB0cnVlKTtcblx0XHRcdHNlbGYuZW1pdCgnaWRsZScpO1xuXG5cdFx0XHQvL2JpbmQgc3RhcnQgZHJhZ1xuXHRcdFx0b24oc2VsZi5lbGVtZW50LCAnbW91c2Vkb3duJyArIHNlbGYuX25zICsgJyB0b3VjaHN0YXJ0JyArIHNlbGYuX25zLCBmdW5jdGlvbiAoZSkge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdFx0Ly9tdWx0aXRvdWNoIGhhcyBtdWx0aXBsZSBzdGFydHNcblx0XHRcdFx0c2VsZi5zZXRUb3VjaChlKTtcblxuXHRcdFx0XHQvL3VwZGF0ZSBtb3ZlbWVudCBwYXJhbXNcblx0XHRcdFx0c2VsZi51cGRhdGUoZSk7XG5cblx0XHRcdFx0Ly9nbyB0byB0aHJlc2hvbGQgc3RhdGVcblx0XHRcdFx0c2VsZi5zdGF0ZSA9ICd0aHJlc2hvbGQnO1xuXHRcdFx0fSk7XG5cdFx0fSxcblx0XHRhZnRlcjogZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdFx0XHRvZmYoc2VsZi5lbGVtZW50LCAndG91Y2hzdGFydCcgKyBzZWxmLl9ucyArICcgbW91c2Vkb3duJyArIHNlbGYuX25zKTtcblxuXHRcdFx0Ly9zZXQgdXAgdHJhY2tpbmdcblx0XHRcdGlmIChzZWxmLnJlbGVhc2UpIHtcblx0XHRcdFx0c2VsZi5fdHJhY2tpbmdJbnRlcnZhbCA9IHNldEludGVydmFsKGZ1bmN0aW9uIChlKSB7XG5cdFx0XHRcdFx0dmFyIG5vdyA9IERhdGUubm93KCk7XG5cdFx0XHRcdFx0dmFyIGVsYXBzZWQgPSBub3cgLSBzZWxmLnRpbWVzdGFtcDtcblxuXHRcdFx0XHRcdC8vZ2V0IGRlbHRhIG1vdmVtZW50IHNpbmNlIHRoZSBsYXN0IHRyYWNrXG5cdFx0XHRcdFx0dmFyIGRYID0gc2VsZi5wcmV2WCAtIHNlbGYuZnJhbWVbMF07XG5cdFx0XHRcdFx0dmFyIGRZID0gc2VsZi5wcmV2WSAtIHNlbGYuZnJhbWVbMV07XG5cdFx0XHRcdFx0c2VsZi5mcmFtZVswXSA9IHNlbGYucHJldlg7XG5cdFx0XHRcdFx0c2VsZi5mcmFtZVsxXSA9IHNlbGYucHJldlk7XG5cblx0XHRcdFx0XHR2YXIgZGVsdGEgPSBNYXRoLnNxcnQoZFggKiBkWCArIGRZICogZFkpO1xuXG5cdFx0XHRcdFx0Ly9nZXQgc3BlZWQgYXMgYXZlcmFnZSBvZiBwcmV2IGFuZCBjdXJyZW50IChwcmV2ZW50IGRpdiBieSB6ZXJvKVxuXHRcdFx0XHRcdHZhciB2ID0gTWF0aC5taW4oc2VsZi52ZWxvY2l0eSAqIGRlbHRhIC8gKDEgKyBlbGFwc2VkKSwgc2VsZi5tYXhTcGVlZCk7XG5cdFx0XHRcdFx0c2VsZi5zcGVlZCA9IDAuOCAqIHYgKyAwLjIgKiBzZWxmLnNwZWVkO1xuXG5cdFx0XHRcdFx0Ly9nZXQgbmV3IGFuZ2xlIGFzIGEgbGFzdCBkaWZmXG5cdFx0XHRcdFx0Ly9OT1RFOiB2ZWN0b3IgYXZlcmFnZSBpc27igJl0IHRoZSBzYW1lIGFzIHNwZWVkIHNjYWxhciBhdmVyYWdlXG5cdFx0XHRcdFx0c2VsZi5hbmdsZSA9IE1hdGguYXRhbjIoZFksIGRYKTtcblxuXHRcdFx0XHRcdHNlbGYuZW1pdCgndHJhY2snKTtcblxuXHRcdFx0XHRcdHJldHVybiBzZWxmO1xuXHRcdFx0XHR9LCBzZWxmLmZyYW1lcmF0ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXG5cdHRocmVzaG9sZDoge1xuXHRcdGJlZm9yZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdFx0XHQvL2lnbm9yZSB0aHJlc2hvbGQgc3RhdGUsIGlmIHRocmVzaG9sZCBpcyBub25lXG5cdFx0XHRpZiAoaXNaZXJvQXJyYXkoc2VsZi50aHJlc2hvbGQpKSB7XG5cdFx0XHRcdHNlbGYuc3RhdGUgPSAnZHJhZyc7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly9lbWl0IGRyYWcgZXZ0cyBvbiBlbGVtZW50XG5cdFx0XHRzZWxmLmVtaXQoJ3RocmVzaG9sZCcpO1xuXG5cdFx0XHQvL2xpc3RlbiB0byBkb2MgbW92ZW1lbnRcblx0XHRcdG9uKGRvYywgJ3RvdWNobW92ZScgKyBzZWxmLl9ucyArICcgbW91c2Vtb3ZlJyArIHNlbGYuX25zLCBmdW5jdGlvbiAoZSkge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdFx0Ly9jb21wYXJlIG1vdmVtZW50IHRvIHRoZSB0aHJlc2hvbGRcblx0XHRcdFx0dmFyIGNsaWVudFggPSBnZXRDbGllbnRYKGUsIHNlbGYudG91Y2hJZHgpO1xuXHRcdFx0XHR2YXIgY2xpZW50WSA9IGdldENsaWVudFkoZSwgc2VsZi50b3VjaElkeCk7XG5cdFx0XHRcdHZhciBkaWZYID0gc2VsZi5wcmV2TW91c2VYIC0gY2xpZW50WDtcblx0XHRcdFx0dmFyIGRpZlkgPSBzZWxmLnByZXZNb3VzZVkgLSBjbGllbnRZO1xuXG5cdFx0XHRcdGlmIChkaWZYIDwgc2VsZi50aHJlc2hvbGRbMF0gfHwgZGlmWCA+IHNlbGYudGhyZXNob2xkWzJdIHx8IGRpZlkgPCBzZWxmLnRocmVzaG9sZFsxXSB8fCBkaWZZID4gc2VsZi50aHJlc2hvbGRbM10pIHtcblx0XHRcdFx0XHRzZWxmLnVwZGF0ZShlKTtcblxuXHRcdFx0XHRcdHNlbGYuc3RhdGUgPSAnZHJhZyc7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0b24oZG9jLCAnbW91c2V1cCcgKyBzZWxmLl9ucyArICcgdG91Y2hlbmQnICsgc2VsZi5fbnMgKyAnJywgZnVuY3Rpb24gKGUpIHtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHRcdC8vZm9yZ2V0IHRvdWNoZXNcblx0XHRcdFx0c2VsZi5yZXNldFRvdWNoKCk7XG5cblx0XHRcdFx0c2VsZi5zdGF0ZSA9ICdpZGxlJztcblx0XHRcdH0pO1xuXHRcdH0sXG5cblx0XHRhZnRlcjogZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdFx0b2ZmKGRvYywgJ3RvdWNobW92ZScgKyBzZWxmLl9ucyArICcgbW91c2Vtb3ZlJyArIHNlbGYuX25zICsgJyBtb3VzZXVwJyArIHNlbGYuX25zICsgJyB0b3VjaGVuZCcgKyBzZWxmLl9ucyk7XG5cdFx0fVxuXHR9LFxuXG5cdGRyYWc6IHtcblx0XHRiZWZvcmU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBzZWxmID0gdGhpcztcblxuXHRcdFx0Ly9yZWR1Y2UgZHJhZ2dpbmcgY2x1dHRlclxuXHRcdFx0c2VsZWN0aW9uLmRpc2FibGUocm9vdCk7XG5cblx0XHRcdC8vZW1pdCBkcmFnIGV2dHMgb24gZWxlbWVudFxuXHRcdFx0c2VsZi5lbWl0KCdkcmFnc3RhcnQnKTtcblx0XHRcdGVtaXQoc2VsZi5lbGVtZW50LCAnZHJhZ3N0YXJ0JywgbnVsbCwgdHJ1ZSk7XG5cblx0XHRcdC8vZW1pdCBkcmFnIGV2ZW50cyBvbiBzZWxmXG5cdFx0XHRzZWxmLmVtaXQoJ2RyYWcnKTtcblx0XHRcdGVtaXQoc2VsZi5lbGVtZW50LCAnZHJhZycsIG51bGwsIHRydWUpO1xuXG5cdFx0XHQvL3N0b3AgZHJhZyBvbiBsZWF2ZVxuXHRcdFx0b24oZG9jLCAndG91Y2hlbmQnICsgc2VsZi5fbnMgKyAnIG1vdXNldXAnICsgc2VsZi5fbnMgKyAnIG1vdXNlbGVhdmUnICsgc2VsZi5fbnMsIGZ1bmN0aW9uIChlKSB7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0XHQvL2ZvcmdldCB0b3VjaGVzIC0gZHJhZ2VuZCBpcyBjYWxsZWQgb25jZVxuXHRcdFx0XHRzZWxmLnJlc2V0VG91Y2goKTtcblxuXHRcdFx0XHQvL21hbmFnZSByZWxlYXNlIG1vdmVtZW50XG5cdFx0XHRcdGlmIChzZWxmLnNwZWVkID4gMSkge1xuXHRcdFx0XHRcdHNlbGYuc3RhdGUgPSAncmVsZWFzZSc7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRzZWxmLnN0YXRlID0gJ2lkbGUnO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly9tb3ZlIHZpYSB0cmFuc2Zvcm1cblx0XHRcdG9uKGRvYywgJ3RvdWNobW92ZScgKyBzZWxmLl9ucyArICcgbW91c2Vtb3ZlJyArIHNlbGYuX25zLCBmdW5jdGlvbiAoZSkge1xuXHRcdFx0XHRzZWxmLmRyYWcoZSk7XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0YWZ0ZXI6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBzZWxmID0gdGhpcztcblxuXHRcdFx0Ly9lbmFibGUgZG9jdW1lbnQgaW50ZXJhY3Rpdml0eVxuXHRcdFx0c2VsZWN0aW9uLmVuYWJsZShyb290KTtcblxuXHRcdFx0Ly9lbWl0IGRyYWdlbmQgb24gZWxlbWVudCwgdGhpc1xuXHRcdFx0c2VsZi5lbWl0KCdkcmFnZW5kJyk7XG5cdFx0XHRlbWl0KHNlbGYuZWxlbWVudCwgJ2RyYWdlbmQnLCBudWxsLCB0cnVlKTtcblxuXHRcdFx0Ly91bmJpbmQgZHJhZyBldmVudHNcblx0XHRcdG9mZihkb2MsICd0b3VjaGVuZCcgKyBzZWxmLl9ucyArICcgbW91c2V1cCcgKyBzZWxmLl9ucyArICcgbW91c2VsZWF2ZScgKyBzZWxmLl9ucyk7XG5cdFx0XHRvZmYoZG9jLCAndG91Y2htb3ZlJyArIHNlbGYuX25zICsgJyBtb3VzZW1vdmUnICsgc2VsZi5fbnMpO1xuXHRcdFx0Y2xlYXJJbnRlcnZhbChzZWxmLl90cmFja2luZ0ludGVydmFsKTtcblx0XHR9XG5cdH0sXG5cblx0cmVsZWFzZToge1xuXHRcdGJlZm9yZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdFx0XHQvL2VudGVyIGFuaW1hdGlvbiBtb2RlXG5cdFx0XHRzZWxmLmlzQW5pbWF0ZWQgPSB0cnVlO1xuXG5cdFx0XHQvL2NhbGMgdGFyZ2V0IHBvaW50ICYgYW5pbWF0ZSB0byBpdFxuXHRcdFx0c2VsZi5tb3ZlKFxuXHRcdFx0XHRzZWxmLnByZXZYICsgc2VsZi5zcGVlZCAqIE1hdGguY29zKHNlbGYuYW5nbGUpLFxuXHRcdFx0XHRzZWxmLnByZXZZICsgc2VsZi5zcGVlZCAqIE1hdGguc2luKHNlbGYuYW5nbGUpXG5cdFx0XHQpO1xuXG5cdFx0XHRzZWxmLnNwZWVkID0gMDtcblx0XHRcdHNlbGYuZW1pdCgndHJhY2snKTtcblxuXHRcdFx0c2VsZi5zdGF0ZSA9ICdpZGxlJztcblx0XHR9XG5cdH1cbn07XG5cblxuLyoqIERyYWcgaGFuZGxlci4gTmVlZGVkIHRvIHByb3ZpZGUgZHJhZyBtb3ZlbWVudCBlbXVsYXRpb24gdmlhIEFQSSAqL1xucHJvdG8uZHJhZyA9IGZ1bmN0aW9uIChlKSB7XG5cdHZhciBzZWxmID0gdGhpcztcblxuXHRlLnByZXZlbnREZWZhdWx0KCk7XG5cblx0dmFyIG1vdXNlWCA9IGdldENsaWVudFgoZSwgc2VsZi50b3VjaElkeCksXG5cdFx0bW91c2VZID0gZ2V0Q2xpZW50WShlLCBzZWxmLnRvdWNoSWR4KTtcblxuXHQvL2NhbGMgbW91c2UgbW92ZW1lbnQgZGlmZlxuXHR2YXIgZGlmZk1vdXNlWCA9IG1vdXNlWCAtIHNlbGYucHJldk1vdXNlWCxcblx0XHRkaWZmTW91c2VZID0gbW91c2VZIC0gc2VsZi5wcmV2TW91c2VZO1xuXG5cdC8vYWJzb2x1dGUgbW91c2UgY29vcmRpbmF0ZVxuXHR2YXIgbW91c2VBYnNYID0gbW91c2VYICsgd2luLnBhZ2VYT2Zmc2V0LFxuXHRcdG1vdXNlQWJzWSA9IG1vdXNlWSArIHdpbi5wYWdlWU9mZnNldDtcblxuXHQvL2NhbGMgc25pcGVyIG9mZnNldCwgaWYgYW55XG5cdGlmIChlLmN0cmxLZXkgfHwgZS5tZXRhS2V5KSB7XG5cdFx0c2VsZi5zbmlwZXJPZmZzZXRYICs9IGRpZmZNb3VzZVggKiBzZWxmLnNuaXBlclNsb3dkb3duO1xuXHRcdHNlbGYuc25pcGVyT2Zmc2V0WSArPSBkaWZmTW91c2VZICogc2VsZi5zbmlwZXJTbG93ZG93bjtcblx0fVxuXG5cdC8vY2FsYyBtb3ZlbWVudCB4IGFuZCB5XG5cdC8vdGFrZSBhYnNvbHV0ZSBwbGFjaW5nIGFzIGl0IGlzIHRoZSBvbmx5IHJlbGlhYmxlIHdheSAoMnggcHJvdmVkKVxuXHR2YXIgeCA9IChtb3VzZUFic1ggLSBzZWxmLmluaXRPZmZzZXRYKSAtIHNlbGYuaW5uZXJPZmZzZXRYIC0gc2VsZi5zbmlwZXJPZmZzZXRYLFxuXHRcdHkgPSAobW91c2VBYnNZIC0gc2VsZi5pbml0T2Zmc2V0WSkgLSBzZWxmLmlubmVyT2Zmc2V0WSAtIHNlbGYuc25pcGVyT2Zmc2V0WTtcblxuXHQvL21vdmUgZWxlbWVudFxuXHRzZWxmLm1vdmUoeCwgeSk7XG5cblx0Ly9zYXZlIHByZXZDbGllbnRYWSBmb3IgY2FsY3VsYXRpbmcgZGlmZlxuXHRzZWxmLnByZXZNb3VzZVggPSBtb3VzZVg7XG5cdHNlbGYucHJldk1vdXNlWSA9IG1vdXNlWTtcblxuXHQvL2VtaXQgZHJhZ1xuXHRzZWxmLmVtaXQoJ2RyYWcnKTtcblx0ZW1pdChzZWxmLmVsZW1lbnQsICdkcmFnJywgbnVsbCwgdHJ1ZSk7XG59O1xuXG5cbi8qKiBDdXJyZW50IG51bWJlciBvZiBkcmFnZ2FibGUgdG91Y2hlcyAqL1xudmFyIHRvdWNoZXMgPSAwO1xuXG5cbi8qKiBNYW5hZ2UgdG91Y2hlcyAqL1xucHJvdG8uc2V0VG91Y2ggPSBmdW5jdGlvbiAoZSkge1xuXHRpZiAoIWUudG91Y2hlcyB8fCB0aGlzLmlzVG91Y2hlZCgpKSByZXR1cm4gdGhpcztcblxuXHR0aGlzLnRvdWNoSWR4ID0gdG91Y2hlcztcblx0dG91Y2hlcysrO1xuXG5cdHJldHVybiB0aGlzO1xufTtcbnByb3RvLnJlc2V0VG91Y2ggPSBmdW5jdGlvbiAoKSB7XG5cdHRvdWNoZXMgPSAwO1xuXHR0aGlzLnRvdWNoSWR4ID0gbnVsbDtcblxuXHRyZXR1cm4gdGhpcztcbn07XG5wcm90by5pc1RvdWNoZWQgPSBmdW5jdGlvbiAoKSB7XG5cdHJldHVybiB0aGlzLnRvdWNoSWR4ICE9PSBudWxsO1xufTtcblxuXG4vKiogQW5pbWF0aW9uIG1vZGUsIGF1dG9tYXRpY2FsbHkgb2ZmZWQgb25jZSBvbm5lZCAqL1xucHJvdG8uaXNBbmltYXRlZCA9IHtcblx0dHJ1ZToge1xuXHRcdGJlZm9yZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cblx0XHRcdGNsZWFyVGltZW91dChzZWxmLl9hbmltYXRlVGltZW91dCk7XG5cblx0XHRcdC8vc2V0IHByb3BlciB0cmFuc2l0aW9uXG5cdFx0XHRjc3Moc2VsZi5lbGVtZW50LCB7XG5cdFx0XHRcdCd0cmFuc2l0aW9uJzogKHNlbGYucmVsZWFzZUR1cmF0aW9uKSArICdtcyBlYXNlLW91dCAnICsgKHNlbGYuY3NzMyA/ICd0cmFuc2Zvcm0nIDogJ3Bvc2l0aW9uJylcblx0XHRcdH0pO1xuXG5cdFx0XHQvL3BsYW4gbGVhdmluZyBhbmltIG1vZGVcblx0XHRcdHNlbGYuX2FuaW1hdGVUaW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHNlbGYuaXNBbmltYXRlZCA9IGZhbHNlO1xuXHRcdFx0fSwgc2VsZi5yZWxlYXNlRHVyYXRpb24pO1xuXHRcdH0sXG5cdFx0YWZ0ZXI6IGZ1bmN0aW9uICgpIHtcblx0XHRcdGNzcyh0aGlzLmVsZW1lbnQsIHtcblx0XHRcdFx0J3RyYW5zaXRpb24nOiBudWxsXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cbn07XG5cblxuLyoqIEluZGV4IHRvIGZldGNoIHRvdWNoIG51bWJlciBmcm9tIGV2ZW50ICovXG5wcm90by50b3VjaElkeCA9IG51bGw7XG5cblxuLyoqXG4gKiBVcGRhdGUgbW92ZW1lbnQgbGltaXRzLlxuICogUmVmcmVzaCBzZWxmLndpdGhpbk9mZnNldHMgYW5kIHNlbGYubGltaXRzLlxuICovXG5wcm90by51cGRhdGUgPSBmdW5jdGlvbiAoZSkge1xuXHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0Ly9pbml0aWFsIHRyYW5zbGF0aW9uIG9mZnNldHNcblx0dmFyIGluaXRYWSA9IHNlbGYuZ2V0Q29vcmRzKCk7XG5cblx0Ly9jYWxjIGluaXRpYWwgY29vcmRzXG5cdHNlbGYucHJldlggPSBpbml0WFlbMF07XG5cdHNlbGYucHJldlkgPSBpbml0WFlbMV07XG5cblx0Ly9jb250YWluZXIgcmVjdCBtaWdodCBiZSBvdXRzaWRlIHRoZSB2cCwgc28gY2FsYyBhYnNvbHV0ZSBvZmZzZXRzXG5cdC8vemVyby1wb3NpdGlvbiBvZmZzZXRzLCB3aXRoIHRyYW5zbGF0aW9uKDAsMClcblx0dmFyIHNlbGZPZmZzZXRzID0gb2Zmc2V0cyhzZWxmLmVsZW1lbnQpO1xuXHRzZWxmLmluaXRPZmZzZXRYID0gc2VsZk9mZnNldHMubGVmdCAtIHNlbGYucHJldlg7XG5cdHNlbGYuaW5pdE9mZnNldFkgPSBzZWxmT2Zmc2V0cy50b3AgLSBzZWxmLnByZXZZO1xuXHRzZWxmLm9mZnNldHMgPSBzZWxmT2Zmc2V0cztcblxuXHQvL2hhbmRsZSBwYXJlbnQgY2FzZVxuXHRpZiAoc2VsZi53aXRoaW4gPT09ICdwYXJlbnQnKSBzZWxmLndpdGhpbiA9IHNlbGYuZWxlbWVudC5wYXJlbnROb2RlIHx8IGRvYztcblxuXHQvL2Fic29sdXRlIG9mZnNldHMgb2YgYSBjb250YWluZXJcblx0dmFyIHdpdGhpbk9mZnNldHMgPSBvZmZzZXRzKHNlbGYud2l0aGluKTtcblx0c2VsZi53aXRoaW5PZmZzZXRzID0gd2l0aGluT2Zmc2V0cztcblxuXHQvL2NhbGN1bGF0ZSBtb3ZlbWVudCBsaW1pdHMgLSBwaW4gd2lkdGggbWlnaHQgYmUgd2lkZXIgdGhhbiBjb25zdHJhaW50c1xuXHRzZWxmLm92ZXJmbG93WCA9IHNlbGYucGluLndpZHRoIC0gd2l0aGluT2Zmc2V0cy53aWR0aDtcblx0c2VsZi5vdmVyZmxvd1kgPSBzZWxmLnBpbi5oZWlnaHQgLSB3aXRoaW5PZmZzZXRzLmhlaWdodDtcblx0c2VsZi5saW1pdHMgPSB7XG5cdFx0bGVmdDogd2l0aGluT2Zmc2V0cy5sZWZ0IC0gc2VsZi5pbml0T2Zmc2V0WCAtIHNlbGYucGluWzBdIC0gKHNlbGYub3ZlcmZsb3dYIDwgMCA/IDAgOiBzZWxmLm92ZXJmbG93WCksXG5cdFx0dG9wOiB3aXRoaW5PZmZzZXRzLnRvcCAtIHNlbGYuaW5pdE9mZnNldFkgLSBzZWxmLnBpblsxXSAtIChzZWxmLm92ZXJmbG93WSA8IDAgPyAwIDogc2VsZi5vdmVyZmxvd1kpLFxuXHRcdHJpZ2h0OiBzZWxmLm92ZXJmbG93WCA+IDAgPyAwIDogd2l0aGluT2Zmc2V0cy5yaWdodCAtIHNlbGYuaW5pdE9mZnNldFggLSBzZWxmLnBpblsyXSxcblx0XHRib3R0b206IHNlbGYub3ZlcmZsb3dZID4gMCA/IDAgOiB3aXRoaW5PZmZzZXRzLmJvdHRvbSAtIHNlbGYuaW5pdE9mZnNldFkgLSBzZWxmLnBpblszXVxuXHR9O1xuXG5cdC8vcHJlc2V0IGlubmVyIG9mZnNldHNcblx0c2VsZi5pbm5lck9mZnNldFggPSBzZWxmLnBpblswXTtcblx0c2VsZi5pbm5lck9mZnNldFkgPSBzZWxmLnBpblsxXTtcblxuXHR2YXIgc2VsZkNsaWVudFJlY3QgPSBzZWxmLmVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cblx0Ly9pZiBldmVudCBwYXNzZWQgLSB1cGRhdGUgYWNjIHRvIGV2ZW50XG5cdGlmIChlKSB7XG5cdFx0Ly90YWtlIGxhc3QgbW91c2UgcG9zaXRpb24gZnJvbSB0aGUgZXZlbnRcblx0XHRzZWxmLnByZXZNb3VzZVggPSBnZXRDbGllbnRYKGUsIHNlbGYudG91Y2hJZHgpO1xuXHRcdHNlbGYucHJldk1vdXNlWSA9IGdldENsaWVudFkoZSwgc2VsZi50b3VjaElkeCk7XG5cblx0XHQvL2lmIG1vdXNlIGlzIHdpdGhpbiB0aGUgZWxlbWVudCAtIHRha2Ugb2Zmc2V0IG5vcm1hbGx5IGFzIHJlbCBkaXNwbGFjZW1lbnRcblx0XHRzZWxmLmlubmVyT2Zmc2V0WCA9IC1zZWxmQ2xpZW50UmVjdC5sZWZ0ICsgZ2V0Q2xpZW50WChlLCBzZWxmLnRvdWNoSWR4KTtcblx0XHRzZWxmLmlubmVyT2Zmc2V0WSA9IC1zZWxmQ2xpZW50UmVjdC50b3AgKyBnZXRDbGllbnRZKGUsIHNlbGYudG91Y2hJZHgpO1xuXHR9XG5cdC8vaWYgbm8gZXZlbnQgLSBzdXBwb3NlIHBpbi1jZW50ZXJlZCBldmVudFxuXHRlbHNlIHtcblx0XHQvL3Rha2UgbW91c2UgcG9zaXRpb24gJiBpbm5lciBvZmZzZXQgYXMgY2VudGVyIG9mIHBpblxuXHRcdHZhciBwaW5YID0gKHNlbGYucGluWzBdICsgc2VsZi5waW5bMl0gKSAqIDAuNTtcblx0XHR2YXIgcGluWSA9IChzZWxmLnBpblsxXSArIHNlbGYucGluWzNdICkgKiAwLjU7XG5cdFx0c2VsZi5wcmV2TW91c2VYID0gc2VsZkNsaWVudFJlY3QubGVmdCArIHBpblg7XG5cdFx0c2VsZi5wcmV2TW91c2VZID0gc2VsZkNsaWVudFJlY3QudG9wICsgcGluWTtcblx0XHRzZWxmLmlubmVyT2Zmc2V0WCA9IHBpblg7XG5cdFx0c2VsZi5pbm5lck9mZnNldFkgPSBwaW5ZO1xuXHR9XG5cblx0Ly9zZXQgaW5pdGlhbCBraW5ldGljIHByb3BzXG5cdHNlbGYuc3BlZWQgPSAwO1xuXHRzZWxmLmFtcGxpdHVkZSA9IDA7XG5cdHNlbGYuYW5nbGUgPSAwO1xuXHRzZWxmLnRpbWVzdGFtcCA9ICtuZXcgRGF0ZSgpO1xuXHRzZWxmLmZyYW1lID0gW3NlbGYucHJldlgsIHNlbGYucHJldlldO1xuXG5cdC8vc2V0IHNuaXBlciBvZmZzZXRcblx0c2VsZi5zbmlwZXJPZmZzZXRYID0gMDtcblx0c2VsZi5zbmlwZXJPZmZzZXRZID0gMDtcbn07XG5cblxuLyoqXG4gKiBXYXkgb2YgcGxhY2VtZW50OlxuICogLSBwb3NpdGlvbiA9PT0gZmFsc2UgKHNsb3dlciBidXQgbW9yZSBwcmVjaXNlIGFuZCBjcm9zcy1icm93c2VyKVxuICogLSB0cmFuc2xhdGUzZCA9PT0gdHJ1ZSAoZmFzdGVyIGJ1dCBtYXkgY2F1c2UgYmx1cnMgb24gbGludXggc3lzdGVtcylcbiAqL1xucHJvdG8uY3NzMyA9IHtcblx0XzogZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMuZ2V0Q29vcmRzID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0Ly8gcmV0dXJuIFt0aGlzLmVsZW1lbnQub2Zmc2V0TGVmdCwgdGhpcy5lbGVtZW50Lm9mZnNldFRvcF07XG5cdFx0XHRyZXR1cm4gW3BhcnNlQ1NTVmFsdWUoY3NzKHRoaXMuZWxlbWVudCwnbGVmdCcpKSwgcGFyc2VDU1NWYWx1ZShjc3ModGhpcy5lbGVtZW50LCAndG9wJykpXTtcblx0XHR9O1xuXG5cdFx0dGhpcy5zZXRDb29yZHMgPSBmdW5jdGlvbiAoeCwgeSkge1xuXHRcdFx0Y3NzKHRoaXMuZWxlbWVudCwge1xuXHRcdFx0XHRsZWZ0OiB4LFxuXHRcdFx0XHR0b3A6IHlcblx0XHRcdH0pO1xuXG5cdFx0XHQvL3NhdmUgcHJldiBjb29yZHMgdG8gdXNlIGFzIGEgc3RhcnQgcG9pbnQgbmV4dCB0aW1lXG5cdFx0XHR0aGlzLnByZXZYID0geDtcblx0XHRcdHRoaXMucHJldlkgPSB5O1xuXHRcdH07XG5cdH0sXG5cblx0Ly91bmRlZmluZWQgcGxhY2luZyBpcyB0cmVhdGVkIGFzIHRyYW5zbGF0ZTNkXG5cdHRydWU6IGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLmdldENvb3JkcyAgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRyZXR1cm4gZ2V0VHJhbnNsYXRlKHRoaXMuZWxlbWVudCkgfHwgWzAsMF07XG5cdFx0fTtcblxuXHRcdHRoaXMuc2V0Q29vcmRzID0gZnVuY3Rpb24gKHgsIHkpIHtcblx0XHRcdHggPSByb3VuZCh4LCB0aGlzLnByZWNpdGlvbik7XG5cdFx0XHR5ID0gcm91bmQoeSwgdGhpcy5wcmVjaXRpb24pO1xuXG5cdFx0XHRjc3ModGhpcy5lbGVtZW50LCAndHJhbnNmb3JtJywgWyd0cmFuc2xhdGUzZCgnLCB4LCAncHgsJywgeSwgJ3B4LCAwKSddLmpvaW4oJycpKTtcblxuXHRcdFx0Ly9zYXZlIHByZXYgY29vcmRzIHRvIHVzZSBhcyBhIHN0YXJ0IHBvaW50IG5leHQgdGltZVxuXHRcdFx0dGhpcy5wcmV2WCA9IHg7XG5cdFx0XHR0aGlzLnByZXZZID0geTtcblx0XHR9O1xuXHR9XG59O1xuXG5cbi8qKlxuICogUmVzdHJpY3RpbmcgY29udGFpbmVyXG4gKiBAdHlwZSB7RWxlbWVudHxvYmplY3R9XG4gKiBAZGVmYXVsdCBkb2MuZG9jdW1lbnRFbGVtZW50XG4gKi9cbnByb3RvLndpdGhpbiA9IGRvYztcblxuXG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHByb3RvLCB7XG5cdC8qKlxuXHQgKiBXaGljaCBhcmVhIG9mIGRyYWdnYWJsZSBzaG91bGQgbm90IGJlIG91dHNpZGUgdGhlIHJlc3RyaWN0aW9uIGFyZWEuXG5cdCAqIEB0eXBlIHsoQXJyYXl8bnVtYmVyKX1cblx0ICogQGRlZmF1bHQgWzAsMCx0aGlzLmVsZW1lbnQub2Zmc2V0V2lkdGgsIHRoaXMuZWxlbWVudC5vZmZzZXRIZWlnaHRdXG5cdCAqL1xuXHRwaW46IHtcblx0XHRzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuXHRcdFx0aWYgKGlzQXJyYXkodmFsdWUpKSB7XG5cdFx0XHRcdGlmICh2YWx1ZS5sZW5ndGggPT09IDIpIHtcblx0XHRcdFx0XHR0aGlzLl9waW4gPSBbdmFsdWVbMF0sIHZhbHVlWzFdLCB2YWx1ZVswXSwgdmFsdWVbMV1dO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHZhbHVlLmxlbmd0aCA9PT0gNCkge1xuXHRcdFx0XHRcdHRoaXMuX3BpbiA9IHZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGVsc2UgaWYgKGlzTnVtYmVyKHZhbHVlKSkge1xuXHRcdFx0XHR0aGlzLl9waW4gPSBbdmFsdWUsIHZhbHVlLCB2YWx1ZSwgdmFsdWVdO1xuXHRcdFx0fVxuXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dGhpcy5fcGluID0gdmFsdWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vY2FsYyBwaW4gcGFyYW1zXG5cdFx0XHR0aGlzLl9waW4ud2lkdGggPSB0aGlzLl9waW5bMl0gLSB0aGlzLl9waW5bMF07XG5cdFx0XHR0aGlzLl9waW4uaGVpZ2h0ID0gdGhpcy5fcGluWzNdIC0gdGhpcy5fcGluWzFdO1xuXHRcdH0sXG5cblx0XHRnZXQ6IGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICh0aGlzLl9waW4pIHJldHVybiB0aGlzLl9waW47XG5cblx0XHRcdC8vcmV0dXJuaW5nIGF1dG9jYWxjdWxhdGVkIHBpbiwgaWYgcHJpdmF0ZSBwaW4gaXMgbm9uZVxuXHRcdFx0dmFyIHBpbiA9IFswLDAsIHRoaXMub2Zmc2V0cy53aWR0aCwgdGhpcy5vZmZzZXRzLmhlaWdodF07XG5cdFx0XHRwaW4ud2lkdGggPSB0aGlzLm9mZnNldHMud2lkdGg7XG5cdFx0XHRwaW4uaGVpZ2h0ID0gdGhpcy5vZmZzZXRzLmhlaWdodDtcblx0XHRcdHJldHVybiBwaW47XG5cdFx0fVxuXHR9LFxuXG5cdC8qKiBBdm9pZCBpbml0aWFsIG1vdXNlbW92ZSAqL1xuXHR0aHJlc2hvbGQ6IHtcblx0XHRzZXQ6IGZ1bmN0aW9uICh2YWwpIHtcblx0XHRcdGlmIChpc051bWJlcih2YWwpKSB7XG5cdFx0XHRcdHRoaXMuX3RocmVzaG9sZCA9IFstdmFsKjAuNSwgLXZhbCowLjUsIHZhbCowLjUsIHZhbCowLjVdO1xuXHRcdFx0fSBlbHNlIGlmICh2YWwubGVuZ3RoID09PSAyKSB7XG5cdFx0XHRcdC8vQXJyYXkodyxoKVxuXHRcdFx0XHR0aGlzLl90aHJlc2hvbGQgPSBbLXZhbFswXSowLjUsIC12YWxbMV0qMC41LCB2YWxbMF0qMC41LCB2YWxbMV0qMC41XTtcblx0XHRcdH0gZWxzZSBpZiAodmFsLmxlbmd0aCA9PT0gNCkge1xuXHRcdFx0XHQvL0FycmF5KHgxLHkxLHgyLHkyKVxuXHRcdFx0XHR0aGlzLl90aHJlc2hvbGQgPSB2YWw7XG5cdFx0XHR9IGVsc2UgaWYgKGlzRm4odmFsKSkge1xuXHRcdFx0XHQvL2N1c3RvbSB2YWwgZnVuY2l0b25cblx0XHRcdFx0dGhpcy5fdGhyZXNob2xkID0gdmFsKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl90aHJlc2hvbGQgPSBbMCwwLDAsMF07XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdGdldDogZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3RocmVzaG9sZCB8fCBbMCwwLDAsMF07XG5cdFx0fVxuXHR9XG59KTtcblxuXG5cbi8qKlxuICogRm9yIGhvdyBsb25nIHRvIHJlbGVhc2UgbW92ZW1lbnRcbiAqXG4gKiBAdHlwZSB7KG51bWJlcnxmYWxzZSl9XG4gKiBAZGVmYXVsdCBmYWxzZVxuICogQHRvZG9cbiAqL1xucHJvdG8ucmVsZWFzZSA9IGZhbHNlO1xucHJvdG8ucmVsZWFzZUR1cmF0aW9uID0gNTAwO1xucHJvdG8udmVsb2NpdHkgPSAxMDAwO1xucHJvdG8ubWF4U3BlZWQgPSAyNTA7XG5wcm90by5mcmFtZXJhdGUgPSA1MDtcblxuXG4vKiogVG8gd2hhdCBleHRlbnQgcm91bmQgcG9zaXRpb24gKi9cbnByb3RvLnByZWNpc2lvbiA9IDE7XG5cblxuLyoqIFNsb3cgZG93biBtb3ZlbWVudCBieSBwcmVzc2luZyBjdHJsL2NtZCAqL1xucHJvdG8uc25pcGVyID0gdHJ1ZTtcblxuXG4vKiogSG93IG11Y2ggdG8gc2xvdyBzbmlwZXIgZHJhZyAqL1xucHJvdG8uc25pcGVyU2xvd2Rvd24gPSAuODU7XG5cblxuLyoqXG4gKiBSZXN0cmljdCBtb3ZlbWVudCBieSBheGlzXG4gKlxuICogQGRlZmF1bHQgdW5kZWZpbmVkXG4gKiBAZW51bSB7c3RyaW5nfVxuICovXG5wcm90by5heGlzID0ge1xuXHRfOiBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy5tb3ZlID0gZnVuY3Rpb24gKHgsIHkpIHtcblx0XHRcdHZhciBsaW1pdHMgPSB0aGlzLmxpbWl0cztcblxuXHRcdFx0aWYgKHRoaXMucmVwZWF0KSB7XG5cdFx0XHRcdHZhciB3ID0gKGxpbWl0cy5yaWdodCAtIGxpbWl0cy5sZWZ0KTtcblx0XHRcdFx0dmFyIGggPSAobGltaXRzLmJvdHRvbSAtIGxpbWl0cy50b3ApO1xuXHRcdFx0XHR2YXIgb1ggPSAtIHRoaXMuaW5pdE9mZnNldFggKyB0aGlzLndpdGhpbk9mZnNldHMubGVmdCAtIHRoaXMucGluWzBdIC0gTWF0aC5tYXgoMCwgdGhpcy5vdmVyZmxvd1gpO1xuXHRcdFx0XHR2YXIgb1kgPSAtIHRoaXMuaW5pdE9mZnNldFkgKyB0aGlzLndpdGhpbk9mZnNldHMudG9wIC0gdGhpcy5waW5bMV0gLSBNYXRoLm1heCgwLCB0aGlzLm92ZXJmbG93WSk7XG5cdFx0XHRcdGlmICh0aGlzLnJlcGVhdCA9PT0gJ3gnKSB7XG5cdFx0XHRcdFx0eCA9IGxvb3AoeCAtIG9YLCB3KSArIG9YO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKHRoaXMucmVwZWF0ID09PSAneScpIHtcblx0XHRcdFx0XHR5ID0gbG9vcCh5IC0gb1ksIGgpICsgb1k7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0eCA9IGxvb3AoeCAtIG9YLCB3KSArIG9YO1xuXHRcdFx0XHRcdHkgPSBsb29wKHkgLSBvWSwgaCkgKyBvWTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR4ID0gYmV0d2Vlbih4LCBsaW1pdHMubGVmdCwgbGltaXRzLnJpZ2h0KTtcblx0XHRcdHkgPSBiZXR3ZWVuKHksIGxpbWl0cy50b3AsIGxpbWl0cy5ib3R0b20pO1xuXG5cdFx0XHR0aGlzLnNldENvb3Jkcyh4LCB5KTtcblx0XHR9O1xuXHR9LFxuXHR4OiBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy5tb3ZlID0gZnVuY3Rpb24gKHgsIHkpIHtcblx0XHRcdHZhciBsaW1pdHMgPSB0aGlzLmxpbWl0cztcblxuXHRcdFx0aWYgKHRoaXMucmVwZWF0KSB7XG5cdFx0XHRcdHZhciB3ID0gKGxpbWl0cy5yaWdodCAtIGxpbWl0cy5sZWZ0KTtcblx0XHRcdFx0dmFyIG9YID0gLSB0aGlzLmluaXRPZmZzZXRYICsgdGhpcy53aXRoaW5PZmZzZXRzLmxlZnQgLSB0aGlzLnBpblswXSAtIE1hdGgubWF4KDAsIHRoaXMub3ZlcmZsb3dYKTtcblx0XHRcdFx0eCA9IGxvb3AoeCAtIG9YLCB3KSArIG9YO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0eCA9IGJldHdlZW4oeCwgbGltaXRzLmxlZnQsIGxpbWl0cy5yaWdodCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuc2V0Q29vcmRzKHgsIHRoaXMucHJldlkpO1xuXHRcdH07XG5cdH0sXG5cdHk6IGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLm1vdmUgPSBmdW5jdGlvbiAoeCwgeSkge1xuXHRcdFx0dmFyIGxpbWl0cyA9IHRoaXMubGltaXRzO1xuXG5cdFx0XHRpZiAodGhpcy5yZXBlYXQpIHtcblx0XHRcdFx0dmFyIGggPSAobGltaXRzLmJvdHRvbSAtIGxpbWl0cy50b3ApO1xuXHRcdFx0XHR2YXIgb1kgPSAtIHRoaXMuaW5pdE9mZnNldFkgKyB0aGlzLndpdGhpbk9mZnNldHMudG9wIC0gdGhpcy5waW5bMV0gLSBNYXRoLm1heCgwLCB0aGlzLm92ZXJmbG93WSk7XG5cdFx0XHRcdHkgPSBsb29wKHkgLSBvWSwgaCkgKyBvWTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHkgPSBiZXR3ZWVuKHksIGxpbWl0cy50b3AsIGxpbWl0cy5ib3R0b20pO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnNldENvb3Jkcyh0aGlzLnByZXZYLCB5KTtcblx0XHR9O1xuXHR9XG59O1xuXG5cbi8qKiBSZXBlYXQgbW92ZW1lbnQgYnkgb25lIG9mIGF4aXNlcyAqL1xucHJvdG8ucmVwZWF0ID0gZmFsc2U7XG5cblxuLyoqIENoZWNrIHdoZXRoZXIgYXJyIGlzIGZpbGxlZCB3aXRoIHplcm9zICovXG5mdW5jdGlvbiBpc1plcm9BcnJheShhcnIpIHtcblx0aWYgKCFhcnJbMF0gJiYgIWFyclsxXSAmJiAhYXJyWzJdICYmICFhcnJbM10pIHJldHVybiB0cnVlO1xufVxuXG5cbm1vZHVsZS5leHBvcnRzID0gRHJhZ2dhYmxlOyIsIi8qIVxuICogaXMtbnVtYmVyIDxodHRwczovL2dpdGh1Yi5jb20vam9uc2NobGlua2VydC9pcy1udW1iZXI+XG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDE0LTIwMTUsIEpvbiBTY2hsaW5rZXJ0LlxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc051bWJlcihuKSB7XG4gIHJldHVybiAoISEoK24pICYmICFBcnJheS5pc0FycmF5KG4pKSAmJiBpc0Zpbml0ZShuKVxuICAgIHx8IG4gPT09ICcwJ1xuICAgIHx8IG4gPT09IDA7XG59O1xuIiwiLyoqXHJcbiAqIEBtb2R1bGUgZW1teS9lbWl0XHJcbiAqL1xyXG52YXIgaWNpY2xlID0gcmVxdWlyZSgnaWNpY2xlJyk7XHJcbnZhciBzbGljZSA9IHJlcXVpcmUoJ3NsaWNlZCcpO1xyXG52YXIgaXNTdHJpbmcgPSByZXF1aXJlKCdtdXR5cGUvaXMtc3RyaW5nJyk7XHJcbnZhciBpc05vZGUgPSByZXF1aXJlKCdtdXR5cGUvaXMtbm9kZScpO1xyXG52YXIgaXNFdmVudCA9IHJlcXVpcmUoJ211dHlwZS9pcy1ldmVudCcpO1xyXG52YXIgbGlzdGVuZXJzID0gcmVxdWlyZSgnLi9saXN0ZW5lcnMnKTtcclxuXHJcblxyXG4vKipcclxuICogQSBzaW1wbGUgd3JhcHBlciB0byBoYW5kbGUgc3RyaW5neS9wbGFpbiBldmVudHNcclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFyZ2V0LCBldnQpe1xyXG5cdGlmICghdGFyZ2V0KSByZXR1cm47XHJcblxyXG5cdHZhciBhcmdzID0gYXJndW1lbnRzO1xyXG5cdGlmIChpc1N0cmluZyhldnQpKSB7XHJcblx0XHRhcmdzID0gc2xpY2UoYXJndW1lbnRzLCAyKTtcclxuXHRcdGV2dC5zcGxpdCgvXFxzKy8pLmZvckVhY2goZnVuY3Rpb24oZXZ0KXtcclxuXHRcdFx0ZXZ0ID0gZXZ0LnNwbGl0KCcuJylbMF07XHJcblxyXG5cdFx0XHRlbWl0LmFwcGx5KHRoaXMsIFt0YXJnZXQsIGV2dF0uY29uY2F0KGFyZ3MpKTtcclxuXHRcdH0pO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4gZW1pdC5hcHBseSh0aGlzLCBhcmdzKTtcclxuXHR9XHJcbn07XHJcblxyXG5cclxuLyoqIGRldGVjdCBlbnYgKi9cclxudmFyICQgPSB0eXBlb2YgalF1ZXJ5ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IGpRdWVyeTtcclxudmFyIGRvYyA9IHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiBkb2N1bWVudDtcclxudmFyIHdpbiA9IHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnID8gdW5kZWZpbmVkIDogd2luZG93O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBFbWl0IGFuIGV2ZW50LCBvcHRpb25hbGx5IHdpdGggZGF0YSBvciBidWJibGluZ1xyXG4gKiBBY2NlcHQgb25seSBzaW5nbGUgZWxlbWVudHMvZXZlbnRzXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBldmVudE5hbWUgQW4gZXZlbnQgbmFtZSwgZS4gZy4gJ2NsaWNrJ1xyXG4gKiBAcGFyYW0geyp9IGRhdGEgQW55IGRhdGEgdG8gcGFzcyB0byBldmVudC5kZXRhaWxzIChET00pIG9yIGV2ZW50LmRhdGEgKGVsc2V3aGVyZSlcclxuICogQHBhcmFtIHtib29sfSBidWJibGVzIFdoZXRoZXIgdG8gdHJpZ2dlciBidWJibGluZyBldmVudCAoRE9NKVxyXG4gKlxyXG4gKlxyXG4gKiBAcmV0dXJuIHt0YXJnZXR9IGEgdGFyZ2V0XHJcbiAqL1xyXG5mdW5jdGlvbiBlbWl0KHRhcmdldCwgZXZlbnROYW1lLCBkYXRhLCBidWJibGVzKXtcclxuXHR2YXIgZW1pdE1ldGhvZCwgZXZ0ID0gZXZlbnROYW1lO1xyXG5cclxuXHQvL0NyZWF0ZSBwcm9wZXIgZXZlbnQgZm9yIERPTSBvYmplY3RzXHJcblx0aWYgKGlzTm9kZSh0YXJnZXQpIHx8IHRhcmdldCA9PT0gd2luKSB7XHJcblx0XHQvL05PVEU6IHRoaXMgZG9lc25vdCBidWJibGUgb24gb2ZmLURPTSBlbGVtZW50c1xyXG5cclxuXHRcdGlmIChpc0V2ZW50KGV2ZW50TmFtZSkpIHtcclxuXHRcdFx0ZXZ0ID0gZXZlbnROYW1lO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0Ly9JRTktY29tcGxpYW50IGNvbnN0cnVjdG9yXHJcblx0XHRcdGV2dCA9IGRvYy5jcmVhdGVFdmVudCgnQ3VzdG9tRXZlbnQnKTtcclxuXHRcdFx0ZXZ0LmluaXRDdXN0b21FdmVudChldmVudE5hbWUsIGJ1YmJsZXMsIHRydWUsIGRhdGEpO1xyXG5cclxuXHRcdFx0Ly9hIG1vZGVybiBjb25zdHJ1Y3RvciB3b3VsZCBiZTpcclxuXHRcdFx0Ly8gdmFyIGV2dCA9IG5ldyBDdXN0b21FdmVudChldmVudE5hbWUsIHsgZGV0YWlsOiBkYXRhLCBidWJibGVzOiBidWJibGVzIH0pXHJcblx0XHR9XHJcblxyXG5cdFx0ZW1pdE1ldGhvZCA9IHRhcmdldC5kaXNwYXRjaEV2ZW50O1xyXG5cdH1cclxuXHJcblx0Ly9jcmVhdGUgZXZlbnQgZm9yIGpRdWVyeSBvYmplY3RcclxuXHRlbHNlIGlmICgkICYmIHRhcmdldCBpbnN0YW5jZW9mICQpIHtcclxuXHRcdC8vVE9ETzogZGVjaWRlIGhvdyB0byBwYXNzIGRhdGFcclxuXHRcdGV2dCA9ICQuRXZlbnQoIGV2ZW50TmFtZSwgZGF0YSApO1xyXG5cdFx0ZXZ0LmRldGFpbCA9IGRhdGE7XHJcblxyXG5cdFx0Ly9GSVhNRTogcmVmZXJlbmNlIGNhc2Ugd2hlcmUgdHJpZ2dlckhhbmRsZXIgbmVlZGVkIChzb21ldGhpbmcgd2l0aCBtdWx0aXBsZSBjYWxscylcclxuXHRcdGVtaXRNZXRob2QgPSBidWJibGVzID8gdGFyZ3RlLnRyaWdnZXIgOiB0YXJnZXQudHJpZ2dlckhhbmRsZXI7XHJcblx0fVxyXG5cclxuXHQvL2RldGVjdCB0YXJnZXQgZXZlbnRzXHJcblx0ZWxzZSB7XHJcblx0XHQvL2VtaXQgLSBkZWZhdWx0XHJcblx0XHQvL3RyaWdnZXIgLSBqcXVlcnlcclxuXHRcdC8vZGlzcGF0Y2hFdmVudCAtIERPTVxyXG5cdFx0Ly9yYWlzZSAtIG5vZGUtc3RhdGVcclxuXHRcdC8vZmlyZSAtID8/P1xyXG5cdFx0ZW1pdE1ldGhvZCA9IHRhcmdldFsnZW1pdCddIHx8IHRhcmdldFsndHJpZ2dlciddIHx8IHRhcmdldFsnZmlyZSddIHx8IHRhcmdldFsnZGlzcGF0Y2hFdmVudCddIHx8IHRhcmdldFsncmFpc2UnXTtcclxuXHR9XHJcblxyXG5cclxuXHR2YXIgYXJncyA9IHNsaWNlKGFyZ3VtZW50cywgMik7XHJcblxyXG5cclxuXHQvL3VzZSBsb2NrcyB0byBhdm9pZCBzZWxmLXJlY3Vyc2lvbiBvbiBvYmplY3RzIHdyYXBwaW5nIHRoaXMgbWV0aG9kXHJcblx0aWYgKGVtaXRNZXRob2QpIHtcclxuXHRcdGlmIChpY2ljbGUuZnJlZXplKHRhcmdldCwgJ2VtaXQnICsgZXZlbnROYW1lKSkge1xyXG5cdFx0XHQvL3VzZSB0YXJnZXQgZXZlbnQgc3lzdGVtLCBpZiBwb3NzaWJsZVxyXG5cdFx0XHRlbWl0TWV0aG9kLmFwcGx5KHRhcmdldCwgW2V2dF0uY29uY2F0KGFyZ3MpKTtcclxuXHRcdFx0aWNpY2xlLnVuZnJlZXplKHRhcmdldCwgJ2VtaXQnICsgZXZlbnROYW1lKTtcclxuXHJcblx0XHRcdHJldHVybiB0YXJnZXQ7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly9pZiBldmVudCB3YXMgZnJvemVuIC0gcHJvYmFibHkgaXQgaXMgZW1pdHRlciBpbnN0YW5jZVxyXG5cdFx0Ly9zbyBwZXJmb3JtIG5vcm1hbCBjYWxsYmFja1xyXG5cdH1cclxuXHJcblxyXG5cdC8vZmFsbCBiYWNrIHRvIGRlZmF1bHQgZXZlbnQgc3lzdGVtXHJcblx0dmFyIGV2dENhbGxiYWNrcyA9IGxpc3RlbmVycyh0YXJnZXQsIGV2dCk7XHJcblxyXG5cdC8vY29weSBjYWxsYmFja3MgdG8gZmlyZSBiZWNhdXNlIGxpc3QgY2FuIGJlIGNoYW5nZWQgYnkgc29tZSBjYWxsYmFjayAobGlrZSBgb2ZmYClcclxuXHR2YXIgZmlyZUxpc3QgPSBzbGljZShldnRDYWxsYmFja3MpO1xyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgZmlyZUxpc3QubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRmaXJlTGlzdFtpXSAmJiBmaXJlTGlzdFtpXS5hcHBseSh0YXJnZXQsIGFyZ3MpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRhcmdldDtcclxufSIsIi8qKlxyXG4gKiBAbW9kdWxlIGVtbXkvb2ZmXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IG9mZjtcclxuXHJcbnZhciBpY2ljbGUgPSByZXF1aXJlKCdpY2ljbGUnKTtcclxudmFyIHNsaWNlID0gcmVxdWlyZSgnc2xpY2VkJyk7XHJcbnZhciBsaXN0ZW5lcnMgPSByZXF1aXJlKCcuL2xpc3RlbmVycycpO1xyXG5cclxuXHJcbi8qKlxyXG4gKiBSZW1vdmUgbGlzdGVuZXJbc10gZnJvbSB0aGUgdGFyZ2V0XHJcbiAqXHJcbiAqIEBwYXJhbSB7W3R5cGVdfSBldnQgW2Rlc2NyaXB0aW9uXVxyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBbZGVzY3JpcHRpb25dXHJcbiAqXHJcbiAqIEByZXR1cm4ge1t0eXBlXX0gW2Rlc2NyaXB0aW9uXVxyXG4gKi9cclxuZnVuY3Rpb24gb2ZmKHRhcmdldCwgZXZ0LCBmbikge1xyXG5cdGlmICghdGFyZ2V0KSByZXR1cm4gdGFyZ2V0O1xyXG5cclxuXHR2YXIgY2FsbGJhY2tzLCBpO1xyXG5cclxuXHQvL3VuYmluZCBhbGwgbGlzdGVuZXJzIGlmIG5vIGZuIHNwZWNpZmllZFxyXG5cdGlmIChmbiA9PT0gdW5kZWZpbmVkKSB7XHJcblx0XHR2YXIgYXJncyA9IHNsaWNlKGFyZ3VtZW50cywgMSk7XHJcblxyXG5cdFx0Ly90cnkgdG8gdXNlIHRhcmdldCByZW1vdmVBbGwgbWV0aG9kLCBpZiBhbnlcclxuXHRcdHZhciBhbGxPZmYgPSB0YXJnZXRbJ3JlbW92ZUFsbCddIHx8IHRhcmdldFsncmVtb3ZlQWxsTGlzdGVuZXJzJ107XHJcblxyXG5cdFx0Ly9jYWxsIHRhcmdldCByZW1vdmVBbGxcclxuXHRcdGlmIChhbGxPZmYpIHtcclxuXHRcdFx0YWxsT2ZmLmFwcGx5KHRhcmdldCwgYXJncyk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8vdGhlbiBmb3JnZXQgb3duIGNhbGxiYWNrcywgaWYgYW55XHJcblxyXG5cdFx0Ly91bmJpbmQgYWxsIGV2dHNcclxuXHRcdGlmICghZXZ0KSB7XHJcblx0XHRcdGNhbGxiYWNrcyA9IGxpc3RlbmVycyh0YXJnZXQpO1xyXG5cdFx0XHRmb3IgKGV2dCBpbiBjYWxsYmFja3MpIHtcclxuXHRcdFx0XHRvZmYodGFyZ2V0LCBldnQpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHQvL3VuYmluZCBhbGwgY2FsbGJhY2tzIGZvciBhbiBldnRcclxuXHRcdGVsc2Uge1xyXG5cdFx0XHQvL2ludm9rZSBtZXRob2QgZm9yIGVhY2ggc3BhY2Utc2VwYXJhdGVkIGV2ZW50IGZyb20gYSBsaXN0XHJcblx0XHRcdGV2dC5zcGxpdCgvXFxzKy8pLmZvckVhY2goZnVuY3Rpb24gKGV2dCkge1xyXG5cdFx0XHRcdHZhciBldnRQYXJ0cyA9IGV2dC5zcGxpdCgnLicpO1xyXG5cdFx0XHRcdGV2dCA9IGV2dFBhcnRzLnNoaWZ0KCk7XHJcblx0XHRcdFx0Y2FsbGJhY2tzID0gbGlzdGVuZXJzKHRhcmdldCwgZXZ0LCBldnRQYXJ0cyk7XHJcblx0XHRcdFx0Zm9yICh2YXIgaSA9IGNhbGxiYWNrcy5sZW5ndGg7IGktLTspIHtcclxuXHRcdFx0XHRcdG9mZih0YXJnZXQsIGV2dCwgY2FsbGJhY2tzW2ldKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0YXJnZXQ7XHJcblx0fVxyXG5cclxuXHJcblx0Ly90YXJnZXQgZXZlbnRzIChzdHJpbmcgbm90YXRpb24gdG8gYWR2YW5jZWRfb3B0aW1pemF0aW9ucylcclxuXHR2YXIgb2ZmTWV0aG9kID0gdGFyZ2V0WydvZmYnXSB8fCB0YXJnZXRbJ3JlbW92ZUV2ZW50TGlzdGVuZXInXSB8fCB0YXJnZXRbJ3JlbW92ZUxpc3RlbmVyJ10gfHwgdGFyZ2V0WydkZXRhY2hFdmVudCddO1xyXG5cclxuXHQvL2ludm9rZSBtZXRob2QgZm9yIGVhY2ggc3BhY2Utc2VwYXJhdGVkIGV2ZW50IGZyb20gYSBsaXN0XHJcblx0ZXZ0LnNwbGl0KC9cXHMrLykuZm9yRWFjaChmdW5jdGlvbiAoZXZ0KSB7XHJcblx0XHR2YXIgZXZ0UGFydHMgPSBldnQuc3BsaXQoJy4nKTtcclxuXHRcdGV2dCA9IGV2dFBhcnRzLnNoaWZ0KCk7XHJcblxyXG5cdFx0Ly91c2UgdGFyZ2V0IGBvZmZgLCBpZiBwb3NzaWJsZVxyXG5cdFx0aWYgKG9mZk1ldGhvZCkge1xyXG5cdFx0XHQvL2F2b2lkIHNlbGYtcmVjdXJzaW9uIGZyb20gdGhlIG91dHNpZGVcclxuXHRcdFx0aWYgKGljaWNsZS5mcmVlemUodGFyZ2V0LCAnb2ZmJyArIGV2dCkpIHtcclxuXHRcdFx0XHRvZmZNZXRob2QuY2FsbCh0YXJnZXQsIGV2dCwgZm4pO1xyXG5cdFx0XHRcdGljaWNsZS51bmZyZWV6ZSh0YXJnZXQsICdvZmYnICsgZXZ0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly9pZiBpdOKAmXMgZnJvemVuIC0gaWdub3JlIGNhbGxcclxuXHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0cmV0dXJuIHRhcmdldDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChmbi5jbG9zZWRDYWxsKSBmbi5jbG9zZWRDYWxsID0gZmFsc2U7XHJcblxyXG5cdFx0Ly9mb3JnZXQgY2FsbGJhY2tcclxuXHRcdGxpc3RlbmVycy5yZW1vdmUodGFyZ2V0LCBldnQsIGZuLCBldnRQYXJ0cyk7XHJcblx0fSk7XHJcblxyXG5cclxuXHRyZXR1cm4gdGFyZ2V0O1xyXG59IiwiLyoqXG4gKiBAbW9kdWxlIGVtbXkvb25cbiAqL1xuXG5cbnZhciBpY2ljbGUgPSByZXF1aXJlKCdpY2ljbGUnKTtcbnZhciBsaXN0ZW5lcnMgPSByZXF1aXJlKCcuL2xpc3RlbmVycycpO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gb247XG5cblxuLyoqXG4gKiBCaW5kIGZuIHRvIGEgdGFyZ2V0LlxuICpcbiAqIEBwYXJhbSB7Kn0gdGFyZ3RlIEEgc2luZ2xlIHRhcmdldCB0byBiaW5kIGV2dFxuICogQHBhcmFtIHtzdHJpbmd9IGV2dCBBbiBldmVudCBuYW1lXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBBIGNhbGxiYWNrXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufT8gY29uZGl0aW9uIEFuIG9wdGlvbmFsIGZpbHRlcmluZyBmbiBmb3IgYSBjYWxsYmFja1xuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aGljaCBhY2NlcHRzIGFuIGV2ZW50IGFuZCByZXR1cm5zIGNhbGxiYWNrXG4gKlxuICogQHJldHVybiB7b2JqZWN0fSBBIHRhcmdldFxuICovXG5mdW5jdGlvbiBvbih0YXJnZXQsIGV2dCwgZm4pe1xuXHRpZiAoIXRhcmdldCkgcmV0dXJuIHRhcmdldDtcblxuXHQvL2dldCB0YXJnZXQgYG9uYCBtZXRob2QsIGlmIGFueVxuXHR2YXIgb25NZXRob2QgPSB0YXJnZXRbJ29uJ10gfHwgdGFyZ2V0WydhZGRFdmVudExpc3RlbmVyJ10gfHwgdGFyZ2V0WydhZGRMaXN0ZW5lciddIHx8IHRhcmdldFsnYXR0YWNoRXZlbnQnXTtcblxuXHR2YXIgY2IgPSBmbjtcblxuXHQvL2ludm9rZSBtZXRob2QgZm9yIGVhY2ggc3BhY2Utc2VwYXJhdGVkIGV2ZW50IGZyb20gYSBsaXN0XG5cdGV2dC5zcGxpdCgvXFxzKy8pLmZvckVhY2goZnVuY3Rpb24oZXZ0KXtcblx0XHR2YXIgZXZ0UGFydHMgPSBldnQuc3BsaXQoJy4nKTtcblx0XHRldnQgPSBldnRQYXJ0cy5zaGlmdCgpO1xuXG5cdFx0Ly91c2UgdGFyZ2V0IGV2ZW50IHN5c3RlbSwgaWYgcG9zc2libGVcblx0XHRpZiAob25NZXRob2QpIHtcblx0XHRcdC8vYXZvaWQgc2VsZi1yZWN1cnNpb25zXG5cdFx0XHQvL2lmIGl04oCZcyBmcm96ZW4gLSBpZ25vcmUgY2FsbFxuXHRcdFx0aWYgKGljaWNsZS5mcmVlemUodGFyZ2V0LCAnb24nICsgZXZ0KSl7XG5cdFx0XHRcdG9uTWV0aG9kLmNhbGwodGFyZ2V0LCBldnQsIGNiKTtcblx0XHRcdFx0aWNpY2xlLnVuZnJlZXplKHRhcmdldCwgJ29uJyArIGV2dCk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHRhcmdldDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvL3NhdmUgdGhlIGNhbGxiYWNrIGFueXdheVxuXHRcdGxpc3RlbmVycy5hZGQodGFyZ2V0LCBldnQsIGNiLCBldnRQYXJ0cyk7XG5cdH0pO1xuXG5cdHJldHVybiB0YXJnZXQ7XG59XG5cblxuLyoqXG4gKiBXcmFwIGFuIGZuIHdpdGggY29uZGl0aW9uIHBhc3NpbmdcbiAqL1xub24ud3JhcCA9IGZ1bmN0aW9uKHRhcmdldCwgZXZ0LCBmbiwgY29uZGl0aW9uKXtcblx0dmFyIGNiID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKGNvbmRpdGlvbi5hcHBseSh0YXJnZXQsIGFyZ3VtZW50cykpIHtcblx0XHRcdHJldHVybiBmbi5hcHBseSh0YXJnZXQsIGFyZ3VtZW50cyk7XG5cdFx0fVxuXHR9O1xuXG5cdGNiLmZuID0gZm47XG5cblx0cmV0dXJuIGNiO1xufTsiLCIvKipcclxuICogVGhyb3R0bGUgZnVuY3Rpb24gY2FsbC5cclxuICpcclxuICogQG1vZHVsZSBlbW15L3Rocm90dGxlXHJcbiAqL1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gdGhyb3R0bGU7XHJcblxyXG52YXIgb24gPSByZXF1aXJlKCcuL29uJyk7XHJcbnZhciBvZmYgPSByZXF1aXJlKCcuL29mZicpO1xyXG52YXIgaXNGbiA9IHJlcXVpcmUoJ211dHlwZS9pcy1mbicpO1xyXG5cclxuXHJcblxyXG4vKipcclxuICogVGhyb3R0bGVzIGNhbGwgYnkgcmViaW5kaW5nIGV2ZW50IGVhY2ggTiBzZWNvbmRzXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSB0YXJnZXQgQW55IG9iamVjdCB0byB0aHJvdHRsZVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gZXZ0IEFuIGV2ZW50IG5hbWVcclxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gQSBjYWxsYmFja1xyXG4gKiBAcGFyYW0ge2ludH0gaW50ZXJ2YWwgQSBtaW5pbXVtIGludGVydmFsIGJldHdlZW4gY2FsbHNcclxuICpcclxuICogQHJldHVybiB7RnVuY3Rpb259IEEgd3JhcHBlZCBjYWxsYmFja1xyXG4gKi9cclxuZnVuY3Rpb24gdGhyb3R0bGUgKHRhcmdldCwgZXZ0LCBmbiwgaW50ZXJ2YWwpIHtcclxuXHQvL0ZJWE1FOiBmaW5kIGNhc2VzIHdoZXJlIG9iamVjdHMgaGFzIG93biB0aHJvdHRsZSBtZXRob2QsIHRoZW4gdXNlIHRhcmdldOKAmXMgdGhyb3R0bGVcclxuXHJcblx0Ly9iaW5kIHdyYXBwZXJcclxuXHRyZXR1cm4gb24odGFyZ2V0LCBldnQsIHRocm90dGxlLndyYXAodGFyZ2V0LCBldnQsIGZuLCBpbnRlcnZhbCkpO1xyXG59XHJcblxyXG5cclxuLyoqIFJldHVybiB3cmFwcGVkIHdpdGggaW50ZXJ2YWwgZm4gKi9cclxudGhyb3R0bGUud3JhcCA9IGZ1bmN0aW9uICh0YXJnZXQsIGV2dCwgZm4sIGludGVydmFsKSB7XHJcblx0Ly9zd2FwIHBhcmFtcywgaWYgbmVlZGVkXHJcblx0aWYgKGlzRm4oaW50ZXJ2YWwpKSB7XHJcblx0XHR2YXIgdG1wID0gaW50ZXJ2YWw7XHJcblx0XHRpbnRlcnZhbCA9IGZuO1xyXG5cdFx0Zm4gPSB0bXA7XHJcblx0fVxyXG5cclxuXHQvL3dyYXAgY2FsbGJhY2tcclxuXHR2YXIgY2IgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHQvL29wZW5lZCBzdGF0ZVxyXG5cdFx0aWYgKCFjYi5jbG9zZWRJbnRlcnZhbCkge1xyXG5cdFx0XHQvL2NsZWFyIGNsb3NlZCBjYWxsIGZsYWdcclxuXHRcdFx0Y2IuY2xvc2VkQ2FsbCA9IGZhbHNlO1xyXG5cclxuXHRcdFx0Ly9kbyBjYWxsXHJcblx0XHRcdGZuLmFwcGx5KHRhcmdldCwgYXJndW1lbnRzKTtcclxuXHJcblx0XHRcdC8vY2xvc2UgdGlsbCB0aGUgaW50ZXJ2YWwgaXMgcGFzc2VkXHJcblx0XHRcdGNiLmNsb3NlZEludGVydmFsID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0Ly9yZXNldCBpbnRlcnZhbFxyXG5cdFx0XHRcdGNiLmNsb3NlZEludGVydmFsID0gbnVsbDtcclxuXHJcblx0XHRcdFx0Ly9kbyBhZnRlci1jYWxsXHJcblx0XHRcdFx0aWYgKGNiLmNsb3NlZENhbGwpIGNiLmFwcGx5KHRhcmdldCwgYXJndW1lbnRzKTtcclxuXHRcdFx0fSwgaW50ZXJ2YWwpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vY2xvc2VkIHN0YXRlXHJcblx0XHRlbHNlIHtcclxuXHRcdFx0Ly9pZiB0cmlnZ2VyIGhhcHBlbmVkIGR1cmluZyB0aGUgcGF1c2UgLSBkZWZlciBpdOKAmXMgY2FsbFxyXG5cdFx0XHRjYi5jbG9zZWRDYWxsID0gdHJ1ZTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHRjYi5mbiA9IGZuO1xyXG5cclxuXHRyZXR1cm4gY2I7XHJcbn07IiwiLyoqXHJcbiAqIEdldCBjbGllbnRZL2NsaWVudFkgZnJvbSBhbiBldmVudC5cclxuICogSWYgaW5kZXggaXMgcGFzc2VkLCB0cmVhdCBpdCBhcyBpbmRleCBvZiBnbG9iYWwgdG91Y2hlcywgbm90IHRoZSB0YXJnZXRUb3VjaGVzLlxyXG4gKiBJdCBpcyBiZWNhdXNlIGdsb2JhbCB0b3VjaGVzIGFyZSBtb3JlIGdlbmVyaWMuXHJcbiAqXHJcbiAqIEBtb2R1bGUgZ2V0LWNsaWVudC14eVxyXG4gKlxyXG4gKiBAcGFyYW0ge0V2ZW50fSBlIEV2ZW50IHJhaXNlZCwgbGlrZSBtb3VzZW1vdmVcclxuICpcclxuICogQHJldHVybiB7bnVtYmVyfSBDb29yZGluYXRlIHJlbGF0aXZlIHRvIHRoZSBzY3JlZW5cclxuICovXHJcbmZ1bmN0aW9uIGdldENsaWVudFkgKGUsIGlkeCkge1xyXG5cdC8vIHRvdWNoIGV2ZW50XHJcblx0aWYgKGUudG91Y2hlcykge1xyXG5cdFx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XHJcblx0XHRcdHJldHVybiBlLnRvdWNoZXNbaWR4XS5jbGllbnRZO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdHJldHVybiBlLnRhcmdldFRvdWNoZXNbMF0uY2xpZW50WTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vIG1vdXNlIGV2ZW50XHJcblx0cmV0dXJuIGUuY2xpZW50WTtcclxufVxyXG5mdW5jdGlvbiBnZXRDbGllbnRYIChlLCBpZHgpIHtcclxuXHQvLyB0b3VjaCBldmVudFxyXG5cdGlmIChlLnRvdWNoZXMpIHtcclxuXHRcdGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xyXG5cdFx0XHRyZXR1cm4gZS50b3VjaGVzW2lkeF0uY2xpZW50WDtcclxuXHRcdH1cclxuXHRcdGVsc2Uge1xyXG5cdFx0XHRyZXR1cm4gZS50YXJnZXRUb3VjaGVzWzBdLmNsaWVudFg7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvLyBtb3VzZSBldmVudFxyXG5cdHJldHVybiBlLmNsaWVudFg7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldENsaWVudFhZIChlLCBpZHgpIHtcclxuXHRyZXR1cm4gW2dldENsaWVudFgoZSwgaWR4KSwgZ2V0Q2xpZW50WShlLCBpZHgpXTtcclxufVxyXG5cclxuZ2V0Q2xpZW50WFkueCA9IGdldENsaWVudFg7XHJcbmdldENsaWVudFhZLnkgPSBnZXRDbGllbnRZO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBnZXRDbGllbnRYWTsiLCJcbi8qKlxuICogaXNBcnJheVxuICovXG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcblxuLyoqXG4gKiB0b1N0cmluZ1xuICovXG5cbnZhciBzdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIFdoZXRoZXIgb3Igbm90IHRoZSBnaXZlbiBgdmFsYFxuICogaXMgYW4gYXJyYXkuXG4gKlxuICogZXhhbXBsZTpcbiAqXG4gKiAgICAgICAgaXNBcnJheShbXSk7XG4gKiAgICAgICAgLy8gPiB0cnVlXG4gKiAgICAgICAgaXNBcnJheShhcmd1bWVudHMpO1xuICogICAgICAgIC8vID4gZmFsc2VcbiAqICAgICAgICBpc0FycmF5KCcnKTtcbiAqICAgICAgICAvLyA+IGZhbHNlXG4gKlxuICogQHBhcmFtIHttaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtib29sfVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gaXNBcnJheSB8fCBmdW5jdGlvbiAodmFsKSB7XG4gIHJldHVybiAhISB2YWwgJiYgJ1tvYmplY3QgQXJyYXldJyA9PSBzdHIuY2FsbCh2YWwpO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gaXNGdW5jdGlvblxuXG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nXG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24gKGZuKSB7XG4gIHZhciBzdHJpbmcgPSB0b1N0cmluZy5jYWxsKGZuKVxuICByZXR1cm4gc3RyaW5nID09PSAnW29iamVjdCBGdW5jdGlvbl0nIHx8XG4gICAgKHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJyAmJiBzdHJpbmcgIT09ICdbb2JqZWN0IFJlZ0V4cF0nKSB8fFxuICAgICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAvLyBJRTggYW5kIGJlbG93XG4gICAgIChmbiA9PT0gd2luZG93LnNldFRpbWVvdXQgfHxcbiAgICAgIGZuID09PSB3aW5kb3cuYWxlcnQgfHxcbiAgICAgIGZuID09PSB3aW5kb3cuY29uZmlybSB8fFxuICAgICAgZm4gPT09IHdpbmRvdy5wcm9tcHQpKVxufTtcbiIsInZhciBvbiA9IHJlcXVpcmUoJ2VtbXkvb24nKTtcbnZhciBlbWl0ID0gcmVxdWlyZSgnZW1teS9lbWl0Jyk7XG52YXIgb2ZmID0gcmVxdWlyZSgnZW1teS9vZmYnKTtcbnZhciBnZXRFbGVtZW50cyA9IHJlcXVpcmUoJ3RpbnktZWxlbWVudCcpO1xuXG5cbnZhciBkb2MgPSBkb2N1bWVudCwgd2luID0gd2luZG93O1xuXG5cbi8qKlxuICogQG1vZHVsZSBsaWZlY3ljbGUtZXZlbnRzXG4gKlxuICogQHRvZG8gIFdvcmsgb3V0IHRvbGVyYW5jZSBpc3N1ZSAod2hldGhlciBpdCBuZWVkcyB0byBiZSBwYXNzZWQgYXMgYW4gb3B0aW9uIC0gc29tZXRpbWVzIHVzZWZ1bCwgbGlrZSB0byBkZXRlY3QgYW4gZWxlbWVudCBiZWluZyBmdWxseSB2aXNpYmxlKVxuICpcbiAqIEB0b2RvICBPcHRpbWl6ZSBlbmFibGVkIHNlbGVjdG9ycy4gRm9yIGV4YW1wbGUsIGF2b2lkIGV4dHJhIGVuYWJsaW5nIGlmIHlvdSBoYXZlICcqJyBlbmFibGVkLiBBbmQgc28gb24uXG4gKiBAdG9kbyAgVGVzdGxpbmcgdGFibGUuXG4gKiBAdG9kbyAgSWdub3JlIG5hdGl2ZSBDdXN0b21FbGVtZW50cyBsaWZlY3ljbGUgZXZlbnRzXG4gKlxuICogQG5vdGUgIE5lc3RlZCBxdWVyeXNlbGVjdG9yIHRlbiB0aW1lcyBmYXN0ZXIgdGhhbiBkb2MucXVlcnlTZWxlY3RvcjpcbiAqICAgICAgICBodHRwOi8vanNwZXJmLmNvbS9kb2N1bWVudC12cy1lbGVtZW50LXF1ZXJ5c2VsZWN0b3JhbGwtcGVyZm9ybWFuY2UvMlxuICogQG5vdGUgIE11bHRpcGxlIG9ic2VydmF0aW9ucyB0byBhbiBleHRlbnQgZmFzdGVyIHRoYW4gb25lIGdsb2JhbCBvYnNlcnZlcjpcbiAqICAgICAgICBodHRwOi8vanNwZXJmLmNvbS9tdXRhdGlvbi1vYnNlcnZlci1jYXNlc1xuICovXG52YXIgbGlmZWN5Y2xlID0gbW9kdWxlLmV4cG9ydHMgPSBlbmFibGU7XG5saWZlY3ljbGUuZW5hYmxlID0gZW5hYmxlO1xubGlmZWN5Y2xlLmRpc2FibGUgPSBkaXNhYmxlO1xuXG5cbi8qKiBEZWZhdWx0cyBjYW4gYmUgY2hhbmdlZCBvdXRzaWRlICovXG5saWZlY3ljbGUuYXR0YWNoZWRDYWxsYmFja05hbWUgPSAnYXR0YWNoZWQnO1xubGlmZWN5Y2xlLmRldGFjaGVkQ2FsbGJhY2tOYW1lID0gJ2RldGFjaGVkJztcblxuXG4vKiogT25lIG9ic2VydmVyIHRvIG9ic2VydmUgYSBsb3Qgb2Ygbm9kZXMgICovXG52YXIgTU8gPSB3aW5kb3cuTXV0YXRpb25PYnNlcnZlciB8fCB3aW5kb3cuV2ViS2l0TXV0YXRpb25PYnNlcnZlciB8fCB3aW5kb3cuTW96TXV0YXRpb25PYnNlcnZlcjtcblxudmFyIG9ic2VydmVyID0gbmV3IE1PKG11dGF0aW9uSGFuZGxlcik7XG5cblxuLyoqIFNldCBvZiB0YXJnZXRzIHRvIG9ic2VydmUgKi9cbnZhciBtVGFyZ2V0cyA9IFtdO1xuXG5cbi8qKiBBdHRhY2hlZCBpdGVtcyBzZXQgKi9cbnZhciBhdHRhY2hlZEl0ZW1zU2V0ID0gbmV3IFdlYWtTZXQ7XG5cblxuLyoqXG4gKiBPYnNlcnZlciB0YXJnZXRzXG4gKlxuICogQHBhcmFtIHsoc3RyaW5nfE5vZGV8Tm9kZUxpc3R8ZG9jdW1lbnQpfSBxdWVyeSBUYXJnZXQgcG9pbnRlclxuICogQHBhcmFtIHtPYmplY3R9IHdpdGhpbiBTZXR0aW5ncyBmb3Igb2JzZXJ2ZXJcbiAqL1xuZnVuY3Rpb24gZW5hYmxlKHF1ZXJ5LCB3aXRoaW4pIHtcblx0aWYgKCFxdWVyeSkgcXVlcnkgPSAnKic7XG5cblx0d2l0aGluID0gZ2V0RWxlbWVudHMod2l0aGluIHx8IGRvYyk7XG5cblx0Ly9zYXZlIGNhY2hlZCB2ZXJzaW9uIG9mIHRhcmdldFxuXHRtVGFyZ2V0cy5wdXNoKHF1ZXJ5KTtcblxuXHQvL21ha2Ugb2JzZXJ2ZXIgb2JzZXJ2ZSBvbmUgbW9yZSB0YXJnZXRcblx0b2JzZXJ2ZXIub2JzZXJ2ZSh3aXRoaW4sIHtzdWJ0cmVlOiB0cnVlLCBjaGlsZExpc3Q6IHRydWV9KTtcblxuXHQvL2lnbm9yZSBub3QgYm91bmQgbm9kZXNcblx0aWYgKHF1ZXJ5IGluc3RhbmNlb2YgTm9kZSAmJiAhZG9jLmNvbnRhaW5zKHF1ZXJ5KSkgcmV0dXJuO1xuXG5cdC8vY2hlY2sgaW5pdGlhbCBub2Rlc1xuXHRjaGVja0FkZGVkTm9kZXMoZ2V0RWxlbWVudHMuY2FsbCh3aXRoaW4sIHF1ZXJ5LCB0cnVlKSk7XG59XG5cblxuLyoqXG4gKiBTdG9wIG9ic2VydmluZyBpdGVtc1xuICovXG5mdW5jdGlvbiBkaXNhYmxlKHRhcmdldCkge1xuXHR2YXIgaWR4ID0gbVRhcmdldHMuaW5kZXhPZih0YXJnZXQpO1xuXHRpZiAoaWR4ID49IDApIHtcblx0XHRtVGFyZ2V0cy5zcGxpY2UoaWR4LDEpO1xuXHR9XG59XG5cblxuLyoqXG4gKiBIYW5kbGUgYSBtdXRhdGlvbiBwYXNzZWRcbiAqL1xuZnVuY3Rpb24gbXV0YXRpb25IYW5kbGVyKG11dGF0aW9ucykge1xuXHRtdXRhdGlvbnMuZm9yRWFjaChmdW5jdGlvbihtdXRhdGlvbikge1xuXHRcdGNoZWNrQWRkZWROb2RlcyhtdXRhdGlvbi5hZGRlZE5vZGVzKTtcblx0XHRjaGVja1JlbW92ZWROb2RlcyhtdXRhdGlvbi5yZW1vdmVkTm9kZXMpO1xuXHR9KTtcbn1cblxuXG4vKipcbiAqIENoZWNrIG5vZGVzIGxpc3QgdG8gY2FsbCBhdHRhY2hlZFxuICovXG5mdW5jdGlvbiBjaGVja0FkZGVkTm9kZXMobm9kZXMpIHtcblx0dmFyIG5ld0l0ZW1zID0gZmFsc2UsIG5vZGU7XG5cblx0Ly9maW5kIGF0dGFjaGVkIGV2dCB0YXJnZXRzXG5cdGZvciAodmFyIGkgPSBub2Rlcy5sZW5ndGg7IGktLTspIHtcblx0XHRub2RlID0gbm9kZXNbaV07XG5cdFx0aWYgKG5vZGUubm9kZVR5cGUgIT09IDEpIGNvbnRpbnVlO1xuXG5cdFx0Ly9maW5kIG9wdGlvbnMgY29ycmVzcG9uZGluZyB0byB0aGUgbm9kZVxuXHRcdGlmICghYXR0YWNoZWRJdGVtc1NldC5oYXMobm9kZSkpIHtcblx0XHRcdG5vZGUgPSBnZXRPYnNlcnZlZShub2RlKTtcblx0XHRcdC8vaWYgb2JzZXJ2ZWUgZm91bmQgd2l0aGluIGF0dGFjaGVkIGl0ZW1zIC0gYWRkIGl0IHRvIHNldFxuXHRcdFx0aWYgKG5vZGUpIHtcblx0XHRcdFx0aWYgKCFuZXdJdGVtcykge1xuXHRcdFx0XHRcdG5ld0l0ZW1zID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRhdHRhY2hlZEl0ZW1zU2V0LmFkZChub2RlKTtcblx0XHRcdFx0ZW1pdChub2RlLCBsaWZlY3ljbGUuYXR0YWNoZWRDYWxsYmFja05hbWUsIG51bGwsIHRydWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5cbi8qKlxuICogQ2hlY2sgbm9kZXMgbGlzdCB0byBjYWxsIGRldGFjaGVkXG4gKi9cbmZ1bmN0aW9uIGNoZWNrUmVtb3ZlZE5vZGVzKG5vZGVzKSB7XG5cdC8vaGFuZGxlIGRldGFjaGVkIGV2dFxuXHRmb3IgKHZhciBpID0gbm9kZXMubGVuZ3RoOyBpLS07KSB7XG5cdFx0dmFyIG5vZGUgPSBub2Rlc1tpXTtcblx0XHRpZiAobm9kZS5ub2RlVHlwZSAhPT0gMSkgY29udGludWU7XG5cblx0XHQvL2ZpbmQgb3B0aW9ucyBjb3JyZXNwb25kaW5nIHRvIHRoZSBub2RlXG5cdFx0aWYgKGF0dGFjaGVkSXRlbXNTZXQuaGFzKG5vZGUpKSB7XG5cdFx0XHRlbWl0KG5vZGUsIGxpZmVjeWNsZS5kZXRhY2hlZENhbGxiYWNrTmFtZSwgbnVsbCwgdHJ1ZSk7XG5cdFx0XHRhdHRhY2hlZEl0ZW1zU2V0LmRlbGV0ZShub2RlKTtcblx0XHR9XG5cdH1cbn1cblxuXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgbm9kZSBpcyBvYnNlcnZpbmdcbiAqXG4gKiBAcGFyYW0ge05vZGV9IG5vZGUgQW4gZWxlbWVudCB0byBjaGVjayBvbiBpbmNsdXNpb24gdG8gdGFyZ2V0IGxpc3RcbiAqL1xuZnVuY3Rpb24gZ2V0T2JzZXJ2ZWUobm9kZSkge1xuXHQvL2NoZWNrIHF1ZXJpZXNcblx0Zm9yICh2YXIgaSA9IG1UYXJnZXRzLmxlbmd0aCwgdGFyZ2V0OyBpLS07KSB7XG5cdFx0dGFyZ2V0ID0gbVRhcmdldHNbaV07XG5cdFx0aWYgKG5vZGUgPT09IHRhcmdldCkgcmV0dXJuIG5vZGU7XG5cdFx0aWYgKHR5cGVvZiB0YXJnZXQgPT09ICdzdHJpbmcnICYmIG5vZGUubWF0Y2hlcyh0YXJnZXQpKSByZXR1cm4gbm9kZTtcblxuXHRcdC8vcmV0dXJuIGlubmVybW9zdCB0YXJnZXRcblx0XHRpZiAobm9kZS5jb250YWlucyh0YXJnZXQpKSByZXR1cm4gdGFyZ2V0O1xuXHR9XG59IiwidmFyIHNsaWNlID0gW10uc2xpY2U7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHNlbGVjdG9yLCBtdWx0aXBsZSkge1xuICB2YXIgY3R4ID0gdGhpcyA9PT0gd2luZG93ID8gZG9jdW1lbnQgOiB0aGlzO1xuXG4gIHJldHVybiAodHlwZW9mIHNlbGVjdG9yID09ICdzdHJpbmcnKVxuICAgID8gKG11bHRpcGxlKSA/IHNsaWNlLmNhbGwoY3R4LnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpLCAwKSA6IGN0eC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKVxuICAgIDogKHNlbGVjdG9yIGluc3RhbmNlb2YgTm9kZSB8fCBzZWxlY3RvciA9PT0gd2luZG93IHx8ICFzZWxlY3Rvci5sZW5ndGgpID8gKG11bHRpcGxlID8gW3NlbGVjdG9yXSA6IHNlbGVjdG9yKSA6IHNsaWNlLmNhbGwoc2VsZWN0b3IsIDApO1xufTsiLCIvKipcclxuICogU2ltcGxlIHJlY3QgY29uc3RydWN0b3IuXHJcbiAqIEl0IGlzIGp1c3QgZmFzdGVyIGFuZCBzbWFsbGVyIHRoYW4gY29uc3RydWN0aW5nIGFuIG9iamVjdC5cclxuICpcclxuICogQG1vZHVsZSBtdWNzcy9SZWN0XHJcbiAqXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBsIGxlZnRcclxuICogQHBhcmFtIHtudW1iZXJ9IHQgdG9wXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSByIHJpZ2h0XHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBiIGJvdHRvbVxyXG4gKiBAcGFyYW0ge251bWJlcn0/IHcgd2lkdGhcclxuICogQHBhcmFtIHtudW1iZXJ9PyBoIGhlaWdodFxyXG4gKlxyXG4gKiBAcmV0dXJuIHtSZWN0fSBBIHJlY3RhbmdsZSBvYmplY3RcclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gUmVjdCAobCx0LHIsYix3LGgpIHtcclxuXHR0aGlzLnRvcD10fHwwO1xyXG5cdHRoaXMuYm90dG9tPWJ8fDA7XHJcblx0dGhpcy5sZWZ0PWx8fDA7XHJcblx0dGhpcy5yaWdodD1yfHwwO1xyXG5cdGlmICh3IT09dW5kZWZpbmVkKSB0aGlzLndpZHRoPXd8fHRoaXMucmlnaHQtdGhpcy5sZWZ0O1xyXG5cdGlmIChoIT09dW5kZWZpbmVkKSB0aGlzLmhlaWdodD1ofHx0aGlzLmJvdHRvbS10aGlzLnRvcDtcclxufTsiLCIvKipcclxuICogR2V0IG9yIHNldCBlbGVtZW504oCZcyBzdHlsZSwgcHJlZml4LWFnbm9zdGljLlxyXG4gKlxyXG4gKiBAbW9kdWxlICBtdWNzcy9jc3NcclxuICovXHJcbnZhciBmYWtlU3R5bGUgPSByZXF1aXJlKCcuL2Zha2UtZWxlbWVudCcpLnN0eWxlO1xyXG52YXIgcHJlZml4ID0gcmVxdWlyZSgnLi9wcmVmaXgnKS5kb207XHJcblxyXG5cclxuLyoqXHJcbiAqIEFwcGx5IHN0eWxlcyB0byBhbiBlbGVtZW50LlxyXG4gKlxyXG4gKiBAcGFyYW0gICAge0VsZW1lbnR9ICAgZWwgICBBbiBlbGVtZW50IHRvIGFwcGx5IHN0eWxlcy5cclxuICogQHBhcmFtICAgIHtPYmplY3R8c3RyaW5nfSAgIG9iaiAgIFNldCBvZiBzdHlsZSBydWxlcyBvciBzdHJpbmcgdG8gZ2V0IHN0eWxlIHJ1bGUuXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVsLCBvYmope1xyXG5cdGlmICghZWwgfHwgIW9iaikgcmV0dXJuO1xyXG5cclxuXHR2YXIgbmFtZSwgdmFsdWU7XHJcblxyXG5cdC8vcmV0dXJuIHZhbHVlLCBpZiBzdHJpbmcgcGFzc2VkXHJcblx0aWYgKHR5cGVvZiBvYmogPT09ICdzdHJpbmcnKSB7XHJcblx0XHRuYW1lID0gb2JqO1xyXG5cclxuXHRcdC8vcmV0dXJuIHZhbHVlLCBpZiBubyB2YWx1ZSBwYXNzZWRcclxuXHRcdGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xyXG5cdFx0XHRyZXR1cm4gZWwuc3R5bGVbcHJlZml4aXplKG5hbWUpXTtcclxuXHRcdH1cclxuXHJcblx0XHQvL3NldCBzdHlsZSwgaWYgdmFsdWUgcGFzc2VkXHJcblx0XHR2YWx1ZSA9IGFyZ3VtZW50c1syXSB8fCAnJztcclxuXHRcdG9iaiA9IHt9O1xyXG5cdFx0b2JqW25hbWVdID0gdmFsdWU7XHJcblx0fVxyXG5cclxuXHRmb3IgKG5hbWUgaW4gb2JqKXtcclxuXHRcdC8vY29udmVydCBudW1iZXJzIHRvIHB4XHJcblx0XHRpZiAodHlwZW9mIG9ialtuYW1lXSA9PT0gJ251bWJlcicgJiYgL2xlZnR8cmlnaHR8Ym90dG9tfHRvcHx3aWR0aHxoZWlnaHQvaS50ZXN0KG5hbWUpKSBvYmpbbmFtZV0gKz0gJ3B4JztcclxuXHJcblx0XHR2YWx1ZSA9IG9ialtuYW1lXSB8fCAnJztcclxuXHJcblx0XHRlbC5zdHlsZVtwcmVmaXhpemUobmFtZSldID0gdmFsdWU7XHJcblx0fVxyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm4gcHJlZml4aXplZCBwcm9wIG5hbWUsIGlmIG5lZWRlZC5cclxuICpcclxuICogQHBhcmFtICAgIHtzdHJpbmd9ICAgbmFtZSAgIEEgcHJvcGVydHkgbmFtZS5cclxuICogQHJldHVybiAgIHtzdHJpbmd9ICAgUHJlZml4ZWQgcHJvcGVydHkgbmFtZS5cclxuICovXHJcbmZ1bmN0aW9uIHByZWZpeGl6ZShuYW1lKXtcclxuXHR2YXIgdU5hbWUgPSBuYW1lWzBdLnRvVXBwZXJDYXNlKCkgKyBuYW1lLnNsaWNlKDEpO1xyXG5cdGlmIChmYWtlU3R5bGVbbmFtZV0gIT09IHVuZGVmaW5lZCkgcmV0dXJuIG5hbWU7XHJcblx0aWYgKGZha2VTdHlsZVtwcmVmaXggKyB1TmFtZV0gIT09IHVuZGVmaW5lZCkgcmV0dXJuIHByZWZpeCArIHVOYW1lO1xyXG5cdHJldHVybiAnJztcclxufVxyXG4iLCIvKiogSnVzdCBhIGZha2UgZWxlbWVudCB0byB0ZXN0IHN0eWxlc1xyXG4gKiBAbW9kdWxlIG11Y3NzL2Zha2UtZWxlbWVudFxyXG4gKi9cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7IiwiLyoqXHJcbiAqIFdpbmRvdyBzY3JvbGxiYXIgZGV0ZWN0b3IuXHJcbiAqXHJcbiAqIEBtb2R1bGUgbXVjc3MvaGFzLXNjcm9sbFxyXG4gKi9cclxuZXhwb3J0cy54ID0gZnVuY3Rpb24oKXtcclxuXHRyZXR1cm4gd2luZG93LmlubmVySGVpZ2h0ID4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudEhlaWdodDtcclxufTtcclxuZXhwb3J0cy55ID0gZnVuY3Rpb24oKXtcclxuXHRyZXR1cm4gd2luZG93LmlubmVyV2lkdGggPiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGg7XHJcbn07IiwiLyoqXHJcbiAqIERldGVjdCB3aGV0aGVyIGVsZW1lbnQgaXMgcGxhY2VkIHRvIGZpeGVkIGNvbnRhaW5lciBvciBpcyBmaXhlZCBpdHNlbGYuXHJcbiAqXHJcbiAqIEBtb2R1bGUgbXVjc3MvaXMtZml4ZWRcclxuICpcclxuICogQHBhcmFtIHsoRWxlbWVudHxPYmplY3QpfSBlbCBFbGVtZW50IHRvIGRldGVjdCBmaXhlZG5lc3MuXHJcbiAqXHJcbiAqIEByZXR1cm4ge2Jvb2xlYW59IFdoZXRoZXIgZWxlbWVudCBpcyBuZXN0ZWQuXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChlbCkge1xyXG5cdHZhciBwYXJlbnRFbCA9IGVsO1xyXG5cclxuXHQvL3dpbmRvdyBpcyBmaXhlZCwgYnR3XHJcblx0aWYgKGVsID09PSB3aW5kb3cpIHJldHVybiB0cnVlO1xyXG5cclxuXHQvL3VubGlrZSB0aGUgZG9jXHJcblx0aWYgKGVsID09PSBkb2N1bWVudCkgcmV0dXJuIGZhbHNlO1xyXG5cclxuXHR3aGlsZSAocGFyZW50RWwpIHtcclxuXHRcdGlmIChnZXRDb21wdXRlZFN0eWxlKHBhcmVudEVsKS5wb3NpdGlvbiA9PT0gJ2ZpeGVkJykgcmV0dXJuIHRydWU7XHJcblx0XHRwYXJlbnRFbCA9IHBhcmVudEVsLm9mZnNldFBhcmVudDtcclxuXHR9XHJcblx0cmV0dXJuIGZhbHNlO1xyXG59OyIsIi8qKlxyXG4gKiBDYWxjdWxhdGUgYWJzb2x1dGUgb2Zmc2V0cyBvZiBhbiBlbGVtZW50LCByZWxhdGl2ZSB0byB0aGUgZG9jdW1lbnQuXHJcbiAqXHJcbiAqIEBtb2R1bGUgbXVjc3Mvb2Zmc2V0c1xyXG4gKlxyXG4gKi9cclxudmFyIHdpbiA9IHdpbmRvdztcclxudmFyIGRvYyA9IGRvY3VtZW50O1xyXG52YXIgUmVjdCA9IHJlcXVpcmUoJy4vUmVjdCcpO1xyXG52YXIgaGFzU2Nyb2xsID0gcmVxdWlyZSgnLi9oYXMtc2Nyb2xsJyk7XHJcbnZhciBzY3JvbGxiYXIgPSByZXF1aXJlKCcuL3Njcm9sbGJhcicpO1xyXG52YXIgaXNGaXhlZEVsID0gcmVxdWlyZSgnLi9pcy1maXhlZCcpO1xyXG5cclxuLyoqXHJcbiAqIFJldHVybiBhYnNvbHV0ZSBvZmZzZXRzIG9mIGFueSB0YXJnZXQgcGFzc2VkXHJcbiAqXHJcbiAqIEBwYXJhbSAgICB7RWxlbWVudHx3aW5kb3d9ICAgZWwgICBBIHRhcmdldC4gUGFzcyB3aW5kb3cgdG8gY2FsY3VsYXRlIHZpZXdwb3J0IG9mZnNldHNcclxuICogQHJldHVybiAgIHtPYmplY3R9ICAgT2Zmc2V0cyBvYmplY3Qgd2l0aCB0cmJsLlxyXG4gKi9cclxubW9kdWxlLmV4cG9ydHMgPSBvZmZzZXRzO1xyXG5cclxuZnVuY3Rpb24gb2Zmc2V0cyAoZWwpIHtcclxuXHRpZiAoIWVsKSB0aHJvdyBFcnJvcignQmFkIGFyZ3VtZW50Jyk7XHJcblxyXG5cdC8vY2FsYyBjbGllbnQgcmVjdFxyXG5cdHZhciBjUmVjdCwgcmVzdWx0O1xyXG5cclxuXHQvL3JldHVybiB2cCBvZmZzZXRzXHJcblx0aWYgKGVsID09PSB3aW4pIHtcclxuXHRcdHJlc3VsdCA9IG5ldyBSZWN0KFxyXG5cdFx0XHR3aW4ucGFnZVhPZmZzZXQsXHJcblx0XHRcdHdpbi5wYWdlWU9mZnNldFxyXG5cdFx0KTtcclxuXHJcblx0XHRyZXN1bHQud2lkdGggPSB3aW4uaW5uZXJXaWR0aCAtIChoYXNTY3JvbGwueSgpID8gc2Nyb2xsYmFyIDogMCksXHJcblx0XHRyZXN1bHQuaGVpZ2h0ID0gd2luLmlubmVySGVpZ2h0IC0gKGhhc1Njcm9sbC54KCkgPyBzY3JvbGxiYXIgOiAwKVxyXG5cdFx0cmVzdWx0LnJpZ2h0ID0gcmVzdWx0LmxlZnQgKyByZXN1bHQud2lkdGg7XHJcblx0XHRyZXN1bHQuYm90dG9tID0gcmVzdWx0LnRvcCArIHJlc3VsdC5oZWlnaHQ7XHJcblxyXG5cdFx0cmV0dXJuIHJlc3VsdDtcclxuXHR9XHJcblxyXG5cdC8vcmV0dXJuIGFic29sdXRlIG9mZnNldHMgaWYgZG9jdW1lbnQgcmVxdWVzdGVkXHJcblx0ZWxzZSBpZiAoZWwgPT09IGRvYykge1xyXG5cdFx0dmFyIHJlcyA9IG9mZnNldHMoZG9jLmRvY3VtZW50RWxlbWVudCk7XHJcblx0XHRyZXMuYm90dG9tID0gTWF0aC5tYXgod2luZG93LmlubmVySGVpZ2h0LCByZXMuYm90dG9tKTtcclxuXHRcdHJlcy5yaWdodCA9IE1hdGgubWF4KHdpbmRvdy5pbm5lcldpZHRoLCByZXMucmlnaHQpO1xyXG5cdFx0aWYgKGhhc1Njcm9sbC55KGRvYy5kb2N1bWVudEVsZW1lbnQpKSByZXMucmlnaHQgLT0gc2Nyb2xsYmFyO1xyXG5cdFx0aWYgKGhhc1Njcm9sbC54KGRvYy5kb2N1bWVudEVsZW1lbnQpKSByZXMuYm90dG9tIC09IHNjcm9sbGJhcjtcclxuXHRcdHJldHVybiByZXM7XHJcblx0fVxyXG5cclxuXHQvL0ZJWE1FOiB3aHkgbm90IGV2ZXJ5IGVsZW1lbnQgaGFzIGdldEJvdW5kaW5nQ2xpZW50UmVjdCBtZXRob2Q/XHJcblx0dHJ5IHtcclxuXHRcdGNSZWN0ID0gZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcblx0fSBjYXRjaCAoZSkge1xyXG5cdFx0Y1JlY3QgPSBuZXcgUmVjdChcclxuXHRcdFx0ZWwuY2xpZW50TGVmdCxcclxuXHRcdFx0ZWwuY2xpZW50VG9wXHJcblx0XHQpO1xyXG5cdH1cclxuXHJcblx0Ly93aGV0aGVyIGVsZW1lbnQgaXMgb3IgaXMgaW4gZml4ZWRcclxuXHR2YXIgaXNGaXhlZCA9IGlzRml4ZWRFbChlbCk7XHJcblx0dmFyIHhPZmZzZXQgPSBpc0ZpeGVkID8gMCA6IHdpbi5wYWdlWE9mZnNldDtcclxuXHR2YXIgeU9mZnNldCA9IGlzRml4ZWQgPyAwIDogd2luLnBhZ2VZT2Zmc2V0O1xyXG5cclxuXHRyZXN1bHQgPSBuZXcgUmVjdChcclxuXHRcdGNSZWN0LmxlZnQgKyB4T2Zmc2V0LFxyXG5cdFx0Y1JlY3QudG9wICsgeU9mZnNldCxcclxuXHRcdGNSZWN0LmxlZnQgKyB4T2Zmc2V0ICsgZWwub2Zmc2V0V2lkdGgsXHJcblx0XHRjUmVjdC50b3AgKyB5T2Zmc2V0ICsgZWwub2Zmc2V0SGVpZ2h0LFxyXG5cdFx0ZWwub2Zmc2V0V2lkdGgsXHJcblx0XHRlbC5vZmZzZXRIZWlnaHRcclxuXHQpO1xyXG5cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59OyIsIi8qKlxyXG4gKiBSZXR1cm5zIHBhcnNlZCBjc3MgdmFsdWUuXHJcbiAqXHJcbiAqIEBtb2R1bGUgbXVjc3MvcGFyc2UtdmFsdWVcclxuICpcclxuICogQHBhcmFtIHtzdHJpbmd9IHN0ciBBIHN0cmluZyBjb250YWluaW5nIGNzcyB1bml0cyB2YWx1ZVxyXG4gKlxyXG4gKiBAcmV0dXJuIHtudW1iZXJ9IFBhcnNlZCBudW1iZXIgdmFsdWVcclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHN0cil7XHJcblx0c3RyICs9ICcnO1xyXG5cdHJldHVybiBwYXJzZUZsb2F0KHN0ci5zbGljZSgwLC0yKSkgfHwgMDtcclxufTtcclxuXHJcbi8vRklYTUU6IGFkZCBwYXJzaW5nIHVuaXRzIiwiLyoqXHJcbiAqIFZlbmRvciBwcmVmaXhlc1xyXG4gKiBNZXRob2Qgb2YgaHR0cDovL2Rhdmlkd2Fsc2gubmFtZS92ZW5kb3ItcHJlZml4XHJcbiAqIEBtb2R1bGUgbXVjc3MvcHJlZml4XHJcbiAqL1xyXG5cclxudmFyIHN0eWxlcyA9IGdldENvbXB1dGVkU3R5bGUoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LCAnJyk7XHJcblxyXG52YXIgcHJlID0gKEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHN0eWxlcylcclxuXHQuam9pbignJylcclxuXHQubWF0Y2goLy0obW96fHdlYmtpdHxtcyktLykgfHwgKHN0eWxlcy5PTGluayA9PT0gJycgJiYgWycnLCAnbyddKVxyXG4pWzFdO1xyXG5cclxuZG9tID0gKCdXZWJLaXR8TW96fE1TfE8nKS5tYXRjaChuZXcgUmVnRXhwKCcoJyArIHByZSArICcpJywgJ2knKSlbMV07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuXHRkb206IGRvbSxcclxuXHRsb3dlcmNhc2U6IHByZSxcclxuXHRjc3M6ICctJyArIHByZSArICctJyxcclxuXHRqczogcHJlWzBdLnRvVXBwZXJDYXNlKCkgKyBwcmUuc3Vic3RyKDEpXHJcbn07IiwiLyoqXHJcbiAqIENhbGN1bGF0ZSBzY3JvbGxiYXIgd2lkdGguXHJcbiAqXHJcbiAqIEBtb2R1bGUgbXVjc3Mvc2Nyb2xsYmFyXHJcbiAqL1xyXG5cclxuLy8gQ3JlYXRlIHRoZSBtZWFzdXJlbWVudCBub2RlXHJcbnZhciBzY3JvbGxEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cclxudmFyIHN0eWxlID0gc2Nyb2xsRGl2LnN0eWxlO1xyXG5cclxuc3R5bGUud2lkdGggPSAnMTAwcHgnO1xyXG5zdHlsZS5oZWlnaHQgPSAnMTAwcHgnO1xyXG5zdHlsZS5vdmVyZmxvdyA9ICdzY3JvbGwnO1xyXG5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XHJcbnN0eWxlLnRvcCA9ICctOTk5OXB4JztcclxuXHJcbmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hcHBlbmRDaGlsZChzY3JvbGxEaXYpO1xyXG5cclxuLy8gdGhlIHNjcm9sbGJhciB3aWR0aFxyXG5tb2R1bGUuZXhwb3J0cyA9IHNjcm9sbERpdi5vZmZzZXRXaWR0aCAtIHNjcm9sbERpdi5jbGllbnRXaWR0aDtcclxuXHJcbi8vIERlbGV0ZSBmYWtlIERJVlxyXG5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoc2Nyb2xsRGl2KTsiLCIvKipcclxuICogRW5hYmxlL2Rpc2FibGUgc2VsZWN0YWJpbGl0eSBvZiBhbiBlbGVtZW50XHJcbiAqIEBtb2R1bGUgbXVjc3Mvc2VsZWN0aW9uXHJcbiAqL1xyXG52YXIgY3NzID0gcmVxdWlyZSgnLi9jc3MnKTtcclxuXHJcblxyXG4vKipcclxuICogRGlzYWJsZSBvciBFbmFibGUgYW55IHNlbGVjdGlvbiBwb3NzaWJpbGl0aWVzIGZvciBhbiBlbGVtZW50LlxyXG4gKlxyXG4gKiBAcGFyYW0gICAge0VsZW1lbnR9ICAgZWwgICBUYXJnZXQgdG8gbWFrZSB1bnNlbGVjdGFibGUuXHJcbiAqL1xyXG5leHBvcnRzLmRpc2FibGUgPSBmdW5jdGlvbihlbCl7XHJcblx0Y3NzKGVsLCB7XHJcblx0XHQndXNlci1zZWxlY3QnOiAnbm9uZScsXHJcblx0XHQndXNlci1kcmFnJzogJ25vbmUnLFxyXG5cdFx0J3RvdWNoLWNhbGxvdXQnOiAnbm9uZSdcclxuXHR9KTtcclxuXHRlbC5zZXRBdHRyaWJ1dGUoJ3Vuc2VsZWN0YWJsZScsICdvbicpO1xyXG5cdGVsLmFkZEV2ZW50TGlzdGVuZXIoJ3NlbGVjdHN0YXJ0JywgcGQpO1xyXG59O1xyXG5leHBvcnRzLmVuYWJsZSA9IGZ1bmN0aW9uKGVsKXtcclxuXHRjc3MoZWwsIHtcclxuXHRcdCd1c2VyLXNlbGVjdCc6IG51bGwsXHJcblx0XHQndXNlci1kcmFnJzogbnVsbCxcclxuXHRcdCd0b3VjaC1jYWxsb3V0JzogbnVsbFxyXG5cdH0pO1xyXG5cdGVsLnJlbW92ZUF0dHJpYnV0ZSgndW5zZWxlY3RhYmxlJyk7XHJcblx0ZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2VsZWN0c3RhcnQnLCBwZCk7XHJcbn07XHJcblxyXG5cclxuLyoqIFByZXZlbnQgeW91IGtub3cgd2hhdC4gKi9cclxuZnVuY3Rpb24gcGQoZSl7XHJcblx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG59IiwiLyoqXHJcbiAqIFBhcnNlIHRyYW5zbGF0ZTNkXHJcbiAqXHJcbiAqIEBtb2R1bGUgbXVjc3MvdHJhbnNsYXRlXHJcbiAqL1xyXG5cclxudmFyIGNzcyA9IHJlcXVpcmUoJy4vY3NzJyk7XHJcbnZhciBwYXJzZVZhbHVlID0gcmVxdWlyZSgnLi9wYXJzZS12YWx1ZScpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZWwpIHtcclxuXHR2YXIgdHJhbnNsYXRlU3RyID0gY3NzKGVsLCAndHJhbnNmb3JtJyk7XHJcblxyXG5cdC8vZmluZCB0cmFuc2xhdGUgdG9rZW4sIHJldHJpZXZlIGNvbW1hLWVuY2xvc2VkIHZhbHVlc1xyXG5cdC8vdHJhbnNsYXRlM2QoMXB4LCAycHgsIDIpIOKGkiAxcHgsIDJweCwgMlxyXG5cdC8vRklYTUU6IGhhbmRsZSBuZXN0ZWQgY2FsY3NcclxuXHR2YXIgbWF0Y2ggPSAvdHJhbnNsYXRlKD86M2QpP1xccypcXCgoW15cXCldKilcXCkvLmV4ZWModHJhbnNsYXRlU3RyKTtcclxuXHJcblx0aWYgKCFtYXRjaCkgcmV0dXJuIG51bGw7XHJcblx0dmFyIHZhbHVlcyA9IG1hdGNoWzFdLnNwbGl0KC9cXHMqLFxccyovKTtcclxuXHJcblx0Ly9wYXJzZSB2YWx1ZXNcclxuXHQvL0ZJWE1FOiBuZXN0ZWQgdmFsdWVzIGFyZSBub3QgbmVjZXNzYXJpbHkgcGl4ZWxzXHJcblx0cmV0dXJuIHZhbHVlcy5tYXAoZnVuY3Rpb24gKHZhbHVlKSB7XHJcblx0XHRyZXR1cm4gcGFyc2VWYWx1ZSh2YWx1ZSk7XHJcblx0fSk7XHJcbn07IiwiLyoqXHJcbiAqIENsYW1wZXIuXHJcbiAqIERldGVjdHMgcHJvcGVyIGNsYW1wIG1pbi9tYXguXHJcbiAqXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBhIEN1cnJlbnQgdmFsdWUgdG8gY3V0IG9mZlxyXG4gKiBAcGFyYW0ge251bWJlcn0gbWluIE9uZSBzaWRlIGxpbWl0XHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBtYXggT3RoZXIgc2lkZSBsaW1pdFxyXG4gKlxyXG4gKiBAcmV0dXJuIHtudW1iZXJ9IENsYW1wZWQgdmFsdWVcclxuICovXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vd3JhcCcpKGZ1bmN0aW9uKGEsIG1pbiwgbWF4KXtcclxuXHRyZXR1cm4gbWF4ID4gbWluID8gTWF0aC5tYXgoTWF0aC5taW4oYSxtYXgpLG1pbikgOiBNYXRoLm1heChNYXRoLm1pbihhLG1pbiksbWF4KTtcclxufSk7IiwiLyoqXHJcbiAqIEBtb2R1bGUgIG11bWF0aC9sb29wXHJcbiAqXHJcbiAqIExvb3BpbmcgZnVuY3Rpb24gZm9yIGFueSBmcmFtZXNpemVcclxuICovXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vd3JhcCcpKGZ1bmN0aW9uICh2YWx1ZSwgbGVmdCwgcmlnaHQpIHtcclxuXHQvL2RldGVjdCBzaW5nbGUtYXJnIGNhc2UsIGxpa2UgbW9kLWxvb3BcclxuXHRpZiAocmlnaHQgPT09IHVuZGVmaW5lZCkge1xyXG5cdFx0cmlnaHQgPSBsZWZ0O1xyXG5cdFx0bGVmdCA9IDA7XHJcblx0fVxyXG5cclxuXHQvL3N3YXAgZnJhbWUgb3JkZXJcclxuXHRpZiAobGVmdCA+IHJpZ2h0KSB7XHJcblx0XHR2YXIgdG1wID0gcmlnaHQ7XHJcblx0XHRyaWdodCA9IGxlZnQ7XHJcblx0XHRsZWZ0ID0gdG1wO1xyXG5cdH1cclxuXHJcblx0dmFyIGZyYW1lID0gcmlnaHQgLSBsZWZ0O1xyXG5cclxuXHR2YWx1ZSA9ICgodmFsdWUgKyBsZWZ0KSAlIGZyYW1lKSAtIGxlZnQ7XHJcblx0aWYgKHZhbHVlIDwgbGVmdCkgdmFsdWUgKz0gZnJhbWU7XHJcblx0aWYgKHZhbHVlID4gcmlnaHQpIHZhbHVlIC09IGZyYW1lO1xyXG5cclxuXHRyZXR1cm4gdmFsdWU7XHJcbn0pOyIsIi8qKlxyXG4gKiBAbW9kdWxlICBtdW1hdGgvcHJlY2lzaW9uXHJcbiAqXHJcbiAqIEdldCBwcmVjaXNpb24gZnJvbSBmbG9hdDpcclxuICpcclxuICogQGV4YW1wbGVcclxuICogMS4xIOKGkiAxLCAxMjM0IOKGkiAwLCAuMTIzNCDihpIgNFxyXG4gKlxyXG4gKiBAcGFyYW0ge251bWJlcn0gblxyXG4gKlxyXG4gKiBAcmV0dXJuIHtudW1iZXJ9IGRlY2ltYXAgcGxhY2VzXHJcbiAqL1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3dyYXAnKShmdW5jdGlvbihuKXtcclxuXHR2YXIgcyA9IG4gKyAnJyxcclxuXHRcdGQgPSBzLmluZGV4T2YoJy4nKSArIDE7XHJcblxyXG5cdHJldHVybiAhZCA/IDAgOiBzLmxlbmd0aCAtIGQ7XHJcbn0pOyIsIi8qKlxyXG4gKiBQcmVjaXNpb24gcm91bmRcclxuICpcclxuICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBzdGVwIE1pbmltYWwgZGlzY3JldGUgdG8gcm91bmRcclxuICpcclxuICogQHJldHVybiB7bnVtYmVyfVxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKiB0b1ByZWNpc2lvbigyMTMuMzQsIDEpID09IDIxM1xyXG4gKiB0b1ByZWNpc2lvbigyMTMuMzQsIC4xKSA9PSAyMTMuM1xyXG4gKiB0b1ByZWNpc2lvbigyMTMuMzQsIDEwKSA9PSAyMTBcclxuICovXHJcbnZhciBwcmVjaXNpb24gPSByZXF1aXJlKCcuL3ByZWNpc2lvbicpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3dyYXAnKShmdW5jdGlvbih2YWx1ZSwgc3RlcCkge1xyXG5cdGlmIChzdGVwID09PSAwKSByZXR1cm4gdmFsdWU7XHJcblx0aWYgKCFzdGVwKSByZXR1cm4gTWF0aC5yb3VuZCh2YWx1ZSk7XHJcblx0c3RlcCA9IHBhcnNlRmxvYXQoc3RlcCk7XHJcblx0dmFsdWUgPSBNYXRoLnJvdW5kKHZhbHVlIC8gc3RlcCkgKiBzdGVwO1xyXG5cdHJldHVybiBwYXJzZUZsb2F0KHZhbHVlLnRvRml4ZWQocHJlY2lzaW9uKHN0ZXApKSk7XHJcbn0pOyIsIi8qKlxyXG4gKiBHZXQgZm4gd3JhcHBlZCB3aXRoIGFycmF5L29iamVjdCBhdHRycyByZWNvZ25pdGlvblxyXG4gKlxyXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn0gVGFyZ2V0IGZ1bmN0aW9uXHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGZuKXtcclxuXHRyZXR1cm4gZnVuY3Rpb24oYSl7XHJcblx0XHR2YXIgYXJncyA9IGFyZ3VtZW50cztcclxuXHRcdGlmIChhIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuXHRcdFx0dmFyIHJlc3VsdCA9IG5ldyBBcnJheShhLmxlbmd0aCksIHNsaWNlO1xyXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspe1xyXG5cdFx0XHRcdHNsaWNlID0gW107XHJcblx0XHRcdFx0Zm9yICh2YXIgaiA9IDAsIGwgPSBhcmdzLmxlbmd0aCwgdmFsOyBqIDwgbDsgaisrKXtcclxuXHRcdFx0XHRcdHZhbCA9IGFyZ3Nbal0gaW5zdGFuY2VvZiBBcnJheSA/IGFyZ3Nbal1baV0gOiBhcmdzW2pdO1xyXG5cdFx0XHRcdFx0dmFsID0gdmFsO1xyXG5cdFx0XHRcdFx0c2xpY2UucHVzaCh2YWwpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXN1bHRbaV0gPSBmbi5hcHBseSh0aGlzLCBzbGljZSk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcclxuXHRcdH1cclxuXHRcdGVsc2UgaWYgKHR5cGVvZiBhID09PSAnb2JqZWN0Jykge1xyXG5cdFx0XHR2YXIgcmVzdWx0ID0ge30sIHNsaWNlO1xyXG5cdFx0XHRmb3IgKHZhciBpIGluIGEpe1xyXG5cdFx0XHRcdHNsaWNlID0gW107XHJcblx0XHRcdFx0Zm9yICh2YXIgaiA9IDAsIGwgPSBhcmdzLmxlbmd0aCwgdmFsOyBqIDwgbDsgaisrKXtcclxuXHRcdFx0XHRcdHZhbCA9IHR5cGVvZiBhcmdzW2pdID09PSAnb2JqZWN0JyA/IGFyZ3Nbal1baV0gOiBhcmdzW2pdO1xyXG5cdFx0XHRcdFx0dmFsID0gdmFsO1xyXG5cdFx0XHRcdFx0c2xpY2UucHVzaCh2YWwpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXN1bHRbaV0gPSBmbi5hcHBseSh0aGlzLCBzbGljZSk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcclxuXHRcdH1cclxuXHRcdGVsc2Uge1xyXG5cdFx0XHRyZXR1cm4gZm4uYXBwbHkodGhpcywgYXJncyk7XHJcblx0XHR9XHJcblx0fTtcclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhcmdldCl7XHJcblx0cmV0dXJuIHR5cGVvZiBFdmVudCAhPT0gJ3VuZGVmaW5lZCcgJiYgdGFyZ2V0IGluc3RhbmNlb2YgRXZlbnQ7XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YXJnZXQpe1xyXG5cdHJldHVybiB0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmIHRhcmdldCBpbnN0YW5jZW9mIE5vZGU7XHJcbn07IiwiLyoqXHJcbiAqIEBtb2R1bGUgIHN0OFxyXG4gKlxyXG4gKiBNaWNybyBzdGF0ZSBtYWNoaW5lLlxyXG4gKi9cclxuXHJcblxyXG52YXIgRW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpO1xyXG52YXIgaXNGbiA9IHJlcXVpcmUoJ2lzLWZ1bmN0aW9uJyk7XHJcbnZhciBpc09iamVjdCA9IHJlcXVpcmUoJ2lzLXBsYWluLW9iamVjdCcpO1xyXG5cclxuXHJcbi8qKiBEZWZhdWx0cyAqL1xyXG5cclxuU3RhdGUub3B0aW9ucyA9IHtcclxuXHRsZWF2ZUNhbGxiYWNrOiAnYWZ0ZXInLFxyXG5cdGVudGVyQ2FsbGJhY2s6ICdiZWZvcmUnLFxyXG5cdGNoYW5nZUNhbGxiYWNrOiAnY2hhbmdlJyxcclxuXHRyZW1haW5kZXJTdGF0ZTogJ18nXHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIG5ldyBzdGF0ZSBjb250cm9sbGVyIGJhc2VkIG9uIHN0YXRlcyBwYXNzZWRcclxuICpcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqXHJcbiAqIEBwYXJhbSB7b2JqZWN0fSBzZXR0aW5ncyBJbml0aWFsIHN0YXRlc1xyXG4gKi9cclxuXHJcbmZ1bmN0aW9uIFN0YXRlKHN0YXRlcywgY29udGV4dCl7XHJcblx0Ly9pZ25vcmUgZXhpc3Rpbmcgc3RhdGVcclxuXHRpZiAoc3RhdGVzIGluc3RhbmNlb2YgU3RhdGUpIHJldHVybiBzdGF0ZXM7XHJcblxyXG5cdC8vZW5zdXJlIG5ldyBzdGF0ZSBpbnN0YW5jZSBpcyBjcmVhdGVkXHJcblx0aWYgKCEodGhpcyBpbnN0YW5jZW9mIFN0YXRlKSkgcmV0dXJuIG5ldyBTdGF0ZShzdGF0ZXMpO1xyXG5cclxuXHQvL3NhdmUgc3RhdGVzIG9iamVjdFxyXG5cdHRoaXMuc3RhdGVzID0gc3RhdGVzIHx8IHt9O1xyXG5cclxuXHQvL3NhdmUgY29udGV4dFxyXG5cdHRoaXMuY29udGV4dCA9IGNvbnRleHQgfHwgdGhpcztcclxuXHJcblx0Ly9pbml0ZWRGbGFnXHJcblx0dGhpcy5pc0luaXQgPSBmYWxzZTtcclxufVxyXG5cclxuXHJcbi8qKiBJbmhlcml0IFN0YXRlIGZyb20gRW1pdHRlciAqL1xyXG5cclxudmFyIHByb3RvID0gU3RhdGUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFbWl0dGVyLnByb3RvdHlwZSk7XHJcblxyXG5cclxuLyoqXHJcbiAqIEdvIHRvIGEgc3RhdGVcclxuICpcclxuICogQHBhcmFtIHsqfSB2YWx1ZSBBbnkgbmV3IHN0YXRlIHRvIGVudGVyXHJcbiAqL1xyXG5cclxucHJvdG8uc2V0ID0gZnVuY3Rpb24gKHZhbHVlKSB7XHJcblx0dmFyIG9sZFZhbHVlID0gdGhpcy5zdGF0ZSwgc3RhdGVzID0gdGhpcy5zdGF0ZXM7XHJcblx0Ly8gY29uc29sZS5ncm91cCgnc2V0JywgdmFsdWUsIG9sZFZhbHVlKTtcclxuXHJcblx0Ly9sZWF2ZSBvbGQgc3RhdGVcclxuXHR2YXIgb2xkU3RhdGVOYW1lID0gc3RhdGVzW29sZFZhbHVlXSAhPT0gdW5kZWZpbmVkID8gb2xkVmFsdWUgOiBTdGF0ZS5vcHRpb25zLnJlbWFpbmRlclN0YXRlO1xyXG5cdHZhciBvbGRTdGF0ZSA9IHN0YXRlc1tvbGRTdGF0ZU5hbWVdO1xyXG5cclxuXHR2YXIgbGVhdmVSZXN1bHQsIGxlYXZlRmxhZyA9IFN0YXRlLm9wdGlvbnMubGVhdmVDYWxsYmFjayArIG9sZFN0YXRlTmFtZTtcclxuXHJcblx0aWYgKHRoaXMuaXNJbml0KSB7XHJcblx0XHRpZiAoaXNPYmplY3Qob2xkU3RhdGUpKSB7XHJcblx0XHRcdGlmICghdGhpc1tsZWF2ZUZsYWddKSB7XHJcblx0XHRcdFx0dGhpc1tsZWF2ZUZsYWddID0gdHJ1ZTtcclxuXHJcblx0XHRcdFx0Ly9pZiBvbGRzdGF0ZSBoYXMgYWZ0ZXIgbWV0aG9kIC0gY2FsbCBpdFxyXG5cdFx0XHRcdGxlYXZlUmVzdWx0ID0gZ2V0VmFsdWUob2xkU3RhdGUsIFN0YXRlLm9wdGlvbnMubGVhdmVDYWxsYmFjaywgdGhpcy5jb250ZXh0KTtcclxuXHJcblx0XHRcdFx0Ly9pZ25vcmUgY2hhbmdpbmcgaWYgbGVhdmUgcmVzdWx0IGlzIGZhbHN5XHJcblx0XHRcdFx0aWYgKGxlYXZlUmVzdWx0ID09PSBmYWxzZSkge1xyXG5cdFx0XHRcdFx0dGhpc1tsZWF2ZUZsYWddID0gZmFsc2U7XHJcblx0XHRcdFx0XHQvLyBjb25zb2xlLmdyb3VwRW5kKCk7XHJcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvL3JlZGlyZWN0LCBpZiByZXR1cm5lZCBhbnl0aGluZ1xyXG5cdFx0XHRcdGVsc2UgaWYgKGxlYXZlUmVzdWx0ICE9PSB1bmRlZmluZWQgJiYgbGVhdmVSZXN1bHQgIT09IHZhbHVlKSB7XHJcblx0XHRcdFx0XHR0aGlzLnNldChsZWF2ZVJlc3VsdCk7XHJcblx0XHRcdFx0XHR0aGlzW2xlYXZlRmxhZ10gPSBmYWxzZTtcclxuXHRcdFx0XHRcdC8vIGNvbnNvbGUuZ3JvdXBFbmQoKTtcclxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHRoaXNbbGVhdmVGbGFnXSA9IGZhbHNlO1xyXG5cclxuXHRcdFx0XHQvL2lnbm9yZSByZWRpcmVjdFxyXG5cdFx0XHRcdGlmICh0aGlzLnN0YXRlICE9PSBvbGRWYWx1ZSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdH1cclxuXHJcblx0XHQvL2lnbm9yZSBub3QgY2hhbmdlZCB2YWx1ZVxyXG5cdFx0aWYgKHZhbHVlID09PSBvbGRWYWx1ZSkgcmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHRlbHNlIHtcclxuXHRcdHRoaXMuaXNJbml0ID0gdHJ1ZTtcclxuXHR9XHJcblxyXG5cclxuXHQvL3NldCBjdXJyZW50IHZhbHVlXHJcblx0dGhpcy5zdGF0ZSA9IHZhbHVlO1xyXG5cclxuXHJcblx0Ly90cnkgdG8gZW50ZXIgbmV3IHN0YXRlXHJcblx0dmFyIG5ld1N0YXRlTmFtZSA9IHN0YXRlc1t2YWx1ZV0gIT09IHVuZGVmaW5lZCA/IHZhbHVlIDogU3RhdGUub3B0aW9ucy5yZW1haW5kZXJTdGF0ZTtcclxuXHR2YXIgbmV3U3RhdGUgPSBzdGF0ZXNbbmV3U3RhdGVOYW1lXTtcclxuXHR2YXIgZW50ZXJGbGFnID0gU3RhdGUub3B0aW9ucy5lbnRlckNhbGxiYWNrICsgbmV3U3RhdGVOYW1lO1xyXG5cdHZhciBlbnRlclJlc3VsdDtcclxuXHJcblx0aWYgKCF0aGlzW2VudGVyRmxhZ10pIHtcclxuXHRcdHRoaXNbZW50ZXJGbGFnXSA9IHRydWU7XHJcblxyXG5cdFx0aWYgKGlzT2JqZWN0KG5ld1N0YXRlKSkge1xyXG5cdFx0XHRlbnRlclJlc3VsdCA9IGdldFZhbHVlKG5ld1N0YXRlLCBTdGF0ZS5vcHRpb25zLmVudGVyQ2FsbGJhY2ssIHRoaXMuY29udGV4dCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRlbnRlclJlc3VsdCA9IGdldFZhbHVlKHN0YXRlcywgbmV3U3RhdGVOYW1lLCB0aGlzLmNvbnRleHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vaWdub3JlIGVudGVyaW5nIGZhbHN5IHN0YXRlXHJcblx0XHRpZiAoZW50ZXJSZXN1bHQgPT09IGZhbHNlKSB7XHJcblx0XHRcdHRoaXMuc2V0KG9sZFZhbHVlKTtcclxuXHRcdFx0dGhpc1tlbnRlckZsYWddID0gZmFsc2U7XHJcblx0XHRcdC8vIGNvbnNvbGUuZ3JvdXBFbmQoKTtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vcmVkaXJlY3QgaWYgcmV0dXJuZWQgYW55dGhpbmcgYnV0IGN1cnJlbnQgc3RhdGVcclxuXHRcdGVsc2UgaWYgKGVudGVyUmVzdWx0ICE9PSB1bmRlZmluZWQgJiYgZW50ZXJSZXN1bHQgIT09IHZhbHVlKSB7XHJcblx0XHRcdHRoaXMuc2V0KGVudGVyUmVzdWx0KTtcclxuXHRcdFx0dGhpc1tlbnRlckZsYWddID0gZmFsc2U7XHJcblx0XHRcdC8vIGNvbnNvbGUuZ3JvdXBFbmQoKTtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXNbZW50ZXJGbGFnXSA9IGZhbHNlO1xyXG5cdH1cclxuXHJcblxyXG5cclxuXHQvL25vdGlmeSBjaGFuZ2VcclxuXHRpZiAodmFsdWUgIT09IG9sZFZhbHVlKVx0e1xyXG5cdFx0dGhpcy5lbWl0KFN0YXRlLm9wdGlvbnMuY2hhbmdlQ2FsbGJhY2ssIHZhbHVlLCBvbGRWYWx1ZSk7XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gY29uc29sZS5ncm91cEVuZCgpO1xyXG5cclxuXHQvL3JldHVybiBjb250ZXh0IHRvIGNoYWluIGNhbGxzXHJcblx0cmV0dXJuIHRoaXMuY29udGV4dDtcclxufTtcclxuXHJcblxyXG4vKiogR2V0IGN1cnJlbnQgc3RhdGUgKi9cclxuXHJcbnByb3RvLmdldCA9IGZ1bmN0aW9uKCl7XHJcblx0cmV0dXJuIHRoaXMuc3RhdGU7XHJcbn07XHJcblxyXG5cclxuLyoqIFJldHVybiB2YWx1ZSBvciBmbiByZXN1bHQgKi9cclxuZnVuY3Rpb24gZ2V0VmFsdWUoaG9sZGVyLCBtZXRoLCBjdHgpe1xyXG5cdGlmIChpc0ZuKGhvbGRlclttZXRoXSkpIHtcclxuXHRcdHJldHVybiBob2xkZXJbbWV0aF0uY2FsbChjdHgpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIGhvbGRlclttZXRoXTtcclxufVxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU3RhdGU7IiwiLyohXG4gKiBpcy1wbGFpbi1vYmplY3QgPGh0dHBzOi8vZ2l0aHViLmNvbS9qb25zY2hsaW5rZXJ0L2lzLXBsYWluLW9iamVjdD5cbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQtMjAxNSwgSm9uIFNjaGxpbmtlcnQuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgaXNPYmplY3QgPSByZXF1aXJlKCdpc29iamVjdCcpO1xuXG5mdW5jdGlvbiBpc09iamVjdE9iamVjdChvKSB7XG4gIHJldHVybiBpc09iamVjdChvKSA9PT0gdHJ1ZVxuICAgICYmIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKSA9PT0gJ1tvYmplY3QgT2JqZWN0XSc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNQbGFpbk9iamVjdChvKSB7XG4gIHZhciBjdG9yLHByb3Q7XG4gIFxuICBpZiAoaXNPYmplY3RPYmplY3QobykgPT09IGZhbHNlKSByZXR1cm4gZmFsc2U7XG4gIFxuICAvLyBJZiBoYXMgbW9kaWZpZWQgY29uc3RydWN0b3JcbiAgY3RvciA9IG8uY29uc3RydWN0b3I7XG4gIGlmICh0eXBlb2YgY3RvciAhPT0gJ2Z1bmN0aW9uJykgcmV0dXJuIGZhbHNlO1xuICBcbiAgLy8gSWYgaGFzIG1vZGlmaWVkIHByb3RvdHlwZVxuICBwcm90ID0gY3Rvci5wcm90b3R5cGU7XG4gIGlmIChpc09iamVjdE9iamVjdChwcm90KSA9PT0gZmFsc2UpIHJldHVybiBmYWxzZTtcbiAgXG4gIC8vIElmIGNvbnN0cnVjdG9yIGRvZXMgbm90IGhhdmUgYW4gT2JqZWN0LXNwZWNpZmljIG1ldGhvZFxuICBpZiAocHJvdC5oYXNPd25Qcm9wZXJ0eSgnaXNQcm90b3R5cGVPZicpID09PSBmYWxzZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBcbiAgLy8gTW9zdCBsaWtlbHkgYSBwbGFpbiBPYmplY3RcbiAgcmV0dXJuIHRydWU7XG59O1xuIiwiLyohXG4gKiBpc29iamVjdCA8aHR0cHM6Ly9naXRodWIuY29tL2pvbnNjaGxpbmtlcnQvaXNvYmplY3Q+XG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDE0IEpvbiBTY2hsaW5rZXJ0LCBjb250cmlidXRvcnMuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2VcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogaXMgdGhlIHZhbHVlIGFuIG9iamVjdCwgYW5kIG5vdCBhbiBhcnJheT9cbiAqXG4gKiBAcGFyYW0gIHsqfSBgdmFsdWVgXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNPYmplY3Qobykge1xuICByZXR1cm4gbyAhPSBudWxsICYmIHR5cGVvZiBvID09PSAnb2JqZWN0J1xuICAgICYmICFBcnJheS5pc0FycmF5KG8pO1xufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGV4dGVuZFxuXG5mdW5jdGlvbiBleHRlbmQodGFyZ2V0KSB7XG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpXVxuXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0gc291cmNlW2tleV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXRcbn1cbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8qKlxyXG4gKiBAbW9kdWxlICBxdWVyaWVkL2NzczRcclxuICpcclxuICogQ1NTNCBxdWVyeSBzZWxlY3Rvci5cclxuICovXHJcblxyXG5cclxudmFyIGRvYyA9IHJlcXVpcmUoJ2dldC1kb2MnKTtcclxudmFyIHEgPSByZXF1aXJlKCcuL2xpYi8nKTtcclxuXHJcblxyXG4vKipcclxuICogRGV0ZWN0IHVuc3VwcG9ydGVkIGNzczQgZmVhdHVyZXMsIHBvbHlmaWxsIHRoZW1cclxuICovXHJcblxyXG4vL2RldGVjdCBgOnNjb3BlYFxyXG50cnkge1xyXG5cdGRvYy5xdWVyeVNlbGVjdG9yKCc6c2NvcGUnKTtcclxufVxyXG5jYXRjaCAoZSkge1xyXG5cdHEucmVnaXN0ZXJGaWx0ZXIoJ3Njb3BlJywgcmVxdWlyZSgnLi9saWIvcHNldWRvcy9zY29wZScpKTtcclxufVxyXG5cclxuXHJcbi8vZGV0ZWN0IGA6aGFzYFxyXG50cnkge1xyXG5cdGRvYy5xdWVyeVNlbGVjdG9yKCc6aGFzJyk7XHJcbn1cclxuY2F0Y2ggKGUpIHtcclxuXHRxLnJlZ2lzdGVyRmlsdGVyKCdoYXMnLCByZXF1aXJlKCcuL2xpYi9wc2V1ZG9zL2hhcycpKTtcclxuXHJcblx0Ly9wb2x5ZmlsbGVkIDpoYXMgcmVxdWlyZXMgYXJ0aWZpY2lhbCA6bm90IHRvIG1ha2UgYDpub3QoOmhhcyguLi4pKWAuXHJcblx0cS5yZWdpc3RlckZpbHRlcignbm90JywgcmVxdWlyZSgnLi9saWIvcHNldWRvcy9ub3QnKSk7XHJcbn1cclxuXHJcblxyXG4vL2RldGVjdCBgOnJvb3RgXHJcbnRyeSB7XHJcblx0ZG9jLnF1ZXJ5U2VsZWN0b3IoJzpyb290Jyk7XHJcbn1cclxuY2F0Y2ggKGUpIHtcclxuXHRxLnJlZ2lzdGVyRmlsdGVyKCdyb290JywgcmVxdWlyZSgnLi9saWIvcHNldWRvcy9yb290JykpO1xyXG59XHJcblxyXG5cclxuLy9kZXRlY3QgYDptYXRjaGVzYFxyXG50cnkge1xyXG5cdGRvYy5xdWVyeVNlbGVjdG9yKCc6bWF0Y2hlcycpO1xyXG59XHJcbmNhdGNoIChlKSB7XHJcblx0cS5yZWdpc3RlckZpbHRlcignbWF0Y2hlcycsIHJlcXVpcmUoJy4vbGliL3BzZXVkb3MvbWF0Y2hlcycpKTtcclxufVxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gcTsiLCIvKipcclxuICogU2xpZHkgLSBjdXN0b21pemFibGUgc2xpZGVyIGNvbXBvbmVudC5cclxuICpcclxuICogQG1vZHVsZSBzbGlkeVxyXG4gKi9cclxuXHJcbnZhciBQaWNrZXIgPSByZXF1aXJlKCcuL2xpYi9waWNrZXInKTtcclxuXHJcbnZhciBleHRlbmQgPSByZXF1aXJlKCd4dGVuZC9tdXRhYmxlJyk7XHJcbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXMtYXJyYXknKTtcclxuXHJcbnZhciBsaWZlY3ljbGUgPSByZXF1aXJlKCdsaWZlY3ljbGUtZXZlbnRzJyk7XHJcbnZhciBFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyk7XHJcbnZhciBvbiA9IHJlcXVpcmUoJ2VtbXkvb24nKTtcclxudmFyIG9mZiA9IHJlcXVpcmUoJ2VtbXkvb2ZmJyk7XHJcbnZhciB0aHJvdHRsZSA9IHJlcXVpcmUoJ2VtbXkvdGhyb3R0bGUnKTtcclxudmFyIGdldENsaWVudFggPSByZXF1aXJlKCdnZXQtY2xpZW50LXh5JykueDtcclxudmFyIGdldENsaWVudFkgPSByZXF1aXJlKCdnZXQtY2xpZW50LXh5JykueTtcclxudmFyIGdldFVpZCA9IHJlcXVpcmUoJ2dldC11aWQnKTtcclxuXHJcblxyXG52YXIgd2luID0gd2luZG93LCBkb2MgPSBkb2N1bWVudDtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFNsaWR5O1xyXG5cclxuXHJcbi8qKiBDYWNoZSBvZiBpbnN0YW5jZXMuIEp1c3QgYXMgaXQgaXMgc2FmZXIgdGhhbiBrZWVwaW5nIHRoZW0gb24gdGFyZ2V0cy4gKi9cclxudmFyIGluc3RhbmNlc0NhY2hlID0gU2xpZHkuY2FjaGUgPSBuZXcgV2Vha01hcCgpO1xyXG5cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgc2xpZGVyIG92ZXIgYSB0YXJnZXRcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5mdW5jdGlvbiBTbGlkeSh0YXJnZXQsIG9wdGlvbnMpIHtcclxuXHQvL2ZvcmNlIGNvbnN0cnVjdG9yXHJcblx0aWYgKCEodGhpcyBpbnN0YW5jZW9mIFNsaWR5KSkgcmV0dXJuIG5ldyBTbGlkeSh0YXJnZXQsIG9wdGlvbnMpO1xyXG5cclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG5cdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xyXG5cclxuXHQvL2Vuc3VyZSBlbGVtZW50LCBpZiBub3QgZGVmaW5lZFxyXG5cdGlmICghdGFyZ2V0KSB0YXJnZXQgPSBkb2MuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcblxyXG5cclxuXHQvL2dldCBwcmVmZXJyZWQgZWxlbWVudFxyXG5cdHNlbGYuZWxlbWVudCA9IHRhcmdldDtcclxuXHJcblx0Ly9hZG9wdCBvcHRpb25zXHJcblx0ZXh0ZW5kKHNlbGYsIG9wdGlvbnMpO1xyXG5cclxuXHQvL3NhdmUgcmVmcmVuY2VcclxuXHRpbnN0YW5jZXNDYWNoZS5zZXQoc2VsZi5lbGVtZW50LCBzZWxmKTtcclxuXHJcblx0Ly9nZW5lcmF0ZSBpZFxyXG5cdHNlbGYuaWQgPSBnZXRVaWQoKTtcclxuXHRzZWxmLm5zID0gJ3NsaWR5LScgKyBzZWxmLmlkO1xyXG5cdGlmICghc2VsZi5lbGVtZW50LmlkKSBzZWxmLmVsZW1lbnQuaWQgPSBzZWxmLm5zO1xyXG5cclxuXHQvL2luaXQgaW5zdGFuY2VcclxuXHRzZWxmLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnc2xpZHknKTtcclxuXHJcblxyXG5cdC8vY3JlYXRlIHBpY2tlcnMsIGlmIHBhc3NlZCBhIGxpc3RcclxuXHRzZWxmLnBpY2tlcnMgPSBbXTtcclxuXHRpZiAoaXNBcnJheShvcHRpb25zLnBpY2tlcnMpICYmIG9wdGlvbnMucGlja2Vycy5sZW5ndGgpIHtcclxuXHRcdG9wdGlvbnMucGlja2Vycy5mb3JFYWNoKGZ1bmN0aW9uIChvcHRzKSB7XHJcblx0XHRcdC8vaWYgb3B0cyBpcyBlbGVtZW50IC0gdHJlYXQgaXQgYXMgZWxlbWVudCBmb3IgdGhlIHBpY2tlclxyXG5cdFx0XHRpZiAob3B0cyBpbnN0YW5jZW9mIE5vZGUpIG9wdHMgPSB7XHJcblx0XHRcdFx0ZWxlbWVudDogb3B0c1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0dmFyIHBpY2tlciA9IHNlbGYuY3JlYXRlUGlja2VyKG9wdHMpO1xyXG5cdFx0XHRzZWxmLnBpY2tlcnMucHVzaChwaWNrZXIpO1xyXG5cclxuXHRcdFx0Ly91cGRhdGUgcGlja2Vy4oCZcyB2YWx1ZSwgdG8gdHJpZ2dlciBjaGFuZ2VcclxuXHRcdFx0aWYgKG9wdHMudmFsdWUgIT09IHVuZGVmaW5lZCkgcGlja2VyLnZhbHVlID0gb3B0cy52YWx1ZTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHQvL2Vuc3VyZSBhdCBsZWFzdCBvbmUgcGlja2VyIGV4aXN0c1xyXG5cdGVsc2Uge1xyXG5cdFx0c2VsZi5waWNrZXJzLnB1c2goc2VsZi5jcmVhdGVQaWNrZXIoKSk7XHJcblxyXG5cdFx0Ly9pbml0IGZpcnN0IHBpY2tlcuKAmXMgdmFsdWVcclxuXHRcdGlmIChvcHRpb25zLnZhbHVlICE9PSB1bmRlZmluZWQpIHNlbGYudmFsdWUgPSBvcHRpb25zLnZhbHVlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIERlZmluZSB2YWx1ZSBhcyBhY3RpdmUgcGlja2VyIHZhbHVlIGdldHRlclxyXG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzZWxmLCAndmFsdWUnLCB7XHJcblx0XHRzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG5cdFx0XHR0aGlzLnBpY2tlcnNbMF0udmFsdWUgPSB2YWx1ZTtcclxuXHRcdH0sXHJcblx0XHRnZXQ6IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMucGlja2Vyc1swXS52YWx1ZTtcclxuXHRcdH1cclxuXHR9KTtcclxuXHJcblxyXG5cdGlmIChzZWxmLmFyaWEpIHtcclxuXHRcdC8vYTExeVxyXG5cdFx0Ly9AcmVmIGh0dHA6Ly93d3cudzMub3JnL1RSL3dhaS1hcmlhL3JvbGVzI3NsaWRlclxyXG5cdFx0c2VsZi5lbGVtZW50LnNldEF0dHJpYnV0ZSgncm9sZScsICdzbGlkZXInKTtcclxuXHRcdHRhcmdldC5zZXRBdHRyaWJ1dGUoJ2FyaWEtdmFsdWVtYXgnLCBzZWxmLm1heCk7XHJcblx0XHR0YXJnZXQuc2V0QXR0cmlidXRlKCdhcmlhLXZhbHVlbWluJywgc2VsZi5taW4pO1xyXG5cdFx0dGFyZ2V0LnNldEF0dHJpYnV0ZSgnYXJpYS1vcmllbnRhdGlvbicsIHNlbGYudHlwZSk7XHJcblx0XHR0YXJnZXQuc2V0QXR0cmlidXRlKCdhcmlhLWF0b21pYycsIHRydWUpO1xyXG5cclxuXHRcdC8vdXBkYXRlIGNvbnRyb2xzXHJcblx0XHR0YXJnZXQuc2V0QXR0cmlidXRlKCdhcmlhLWNvbnRyb2xzJywgc2VsZi5waWNrZXJzLm1hcChcclxuXHRcdFx0ZnVuY3Rpb24gKGl0ZW0pIHtcclxuXHRcdFx0XHRyZXR1cm4gaXRlbS5lbGVtZW50LmlkO1xyXG5cdFx0XHR9KS5qb2luKCcgJykpO1xyXG5cdH1cclxuXHJcblx0Ly90dXJuIG9uIGV2ZW50cyBldGNcclxuXHRpZiAoIXNlbGYuZWxlbWVudC5oYXNBdHRyaWJ1dGUoJ2Rpc2FibGVkJykpIHNlbGYuZW5hYmxlKCk7XHJcblxyXG5cdC8vZW1pdCBjYWxsYmFja1xyXG5cdHNlbGYuZW1pdCgnY3JlYXRlZCcpO1xyXG59XHJcblxyXG5cclxudmFyIHByb3RvID0gU2xpZHkucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFbWl0dGVyLnByb3RvdHlwZSk7XHJcblxyXG5cclxuLyoqXHJcbiAqIERlZmF1bHQgcmFuZ2VcclxuICovXHJcbnByb3RvLm1pbiA9IDA7XHJcbnByb3RvLm1heCA9IDEwMDtcclxucHJvdG8udmFsdWUgPSA1MDtcclxuXHJcblxyXG4vKiogRGVmYXVsdCBwbGFjaW5nIHR5cGUgaXMgaG9yaXpvbnRhbCAqL1xyXG5wcm90by50eXBlID0gJ2hvcml6b250YWwnO1xyXG5cclxuXHJcbi8qKlxyXG4gKiBSZXBlYXQgZWl0aGVyIGJ5IG9uZSBvciBib3RoIGF4aXNcclxuICpcclxuICogQGVudW0ge2Jvb2x9XHJcbiAqIEBkZWZhdWx0IHRydWVcclxuICovXHJcbnByb3RvLnJlcGVhdCA9IGZhbHNlO1xyXG5cclxuXHJcbi8qKiBJbnRlcmFjdGlvbiBzZXR0aW5ncyAqL1xyXG5wcm90by5rZXlib2FyZCA9IHRydWU7XHJcbnByb3RvLmFyaWEgPSB0cnVlO1xyXG5wcm90by53aGVlbCA9IHRydWU7XHJcbnByb3RvLmNsaWNrID0gdHJ1ZTtcclxucHJvdG8ucG9pbnQgPSBmYWxzZTtcclxuXHJcblxyXG4vKiogUGlja2VyIGFsaWdubWVudCByZWxhdGl2ZSB0byB0aGUgbW91c2UgKi9cclxucHJvdG8uYWxpZ24gPSAwLjU7XHJcblxyXG5cclxuLyoqIEVuYWJsZS9kaXNhYmxlICovXHJcbnByb3RvLmVuYWJsZSA9IGZ1bmN0aW9uICgpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG5cdGlmIChzZWxmLmlzRW5hYmxlZCkgcmV0dXJuIHNlbGY7XHJcblx0c2VsZi5pc0VuYWJsZWQgPSB0cnVlO1xyXG5cclxuXHRpZiAoc2VsZi5hcmlhKSB7XHJcblx0XHQvL0FSSUFzXHJcblx0XHRzZWxmLmVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJyk7XHJcblx0fVxyXG5cclxuXHRzZWxmLmVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xyXG5cclxuXHQvL0V2ZW50c1xyXG5cdC8vIFVwZGF0ZSBwaWNrZXJzIHBvc2l0aW9uIG9uIHRoZSBmaXJzdCBsb2FkIGFuZCByZXNpemVcclxuXHR0aHJvdHRsZSh3aW4sICdyZXNpemUuJyArIHNlbGYubnMsIDIwLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRzZWxmLnVwZGF0ZSgpO1xyXG5cdH0pO1xyXG5cclxuXHQvL29ic2VydmUgd2hlbiBzbGlkZXIgaXMgaW5zZXJ0ZWRcclxuXHRvbihzZWxmLmVsZW1lbnQsICdhdHRhY2hlZC4nICsgc2VsZi5ucywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdHNlbGYudXBkYXRlKCk7XHJcblx0fSk7XHJcblx0bGlmZWN5Y2xlLmVuYWJsZShzZWxmLmVsZW1lbnQpO1xyXG5cclxuXHQvL2Rpc3RyaWJ1dGUgbXVsdGl0b3VjaCBldmVudCB0byBjbG9zZXN0IHBpY2tlcnNcclxuXHRpZiAoc2VsZi5jbGljaykge1xyXG5cdFx0b24oc2VsZi5lbGVtZW50LCAndG91Y2hzdGFydC4nICArIHNlbGYubnMgKyAnIG1vdXNlZG93bi4nICsgc2VsZi5ucywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0Ly9mb2N1cyBvbiBjb250YWluZXIgcHJvZ3JhbW1hdGljYWxseVxyXG5cdFx0XHQvL2luIHRoYXQgY2FzZSBtaWdodCBiZSBhIG11bHRpZm9jdXNcclxuXHRcdFx0c2VsZi5lbGVtZW50LmZvY3VzKCk7XHJcblxyXG5cdFx0XHR2YXIgc2VsZkNsaWVudFJlY3QgPSBzZWxmLmVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcblxyXG5cdFx0XHQvL2xpc3Qgb2YgYWN0aXZlIHBpY2tlcnNcclxuXHRcdFx0dmFyIHBpY2tlcnMgPSBbXSwgcGlja2VyLCB4LCB5O1xyXG5cclxuXHJcblx0XHRcdGlmIChlLnRvdWNoZXMpIHtcclxuXHRcdFx0XHQvL2dldCBjb29yZHMgcmVsYXRpdmUgdG8gdGhlIGNvbnRhaW5lciAodGhpcylcclxuXHRcdFx0XHRmb3IgKHZhciBpID0gMCwgbCA9IGUudG91Y2hlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuXHRcdFx0XHRcdHggPSBnZXRDbGllbnRYKGUsIGkpIC0gc2VsZkNsaWVudFJlY3QubGVmdDtcclxuXHRcdFx0XHRcdHkgPSBnZXRDbGllbnRZKGUsIGkpIC0gc2VsZkNsaWVudFJlY3QudG9wO1xyXG5cclxuXHRcdFx0XHRcdC8vZmluZCBjbG9zZXN0IHBpY2tlciBub3QgdGFrZW4gYWxyZWFkeVxyXG5cdFx0XHRcdFx0cGlja2VyID0gc2VsZi5nZXRDbG9zZXN0UGlja2VyKHNlbGYucGlja2Vycy5maWx0ZXIoZnVuY3Rpb24gKHApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHBpY2tlcnMuaW5kZXhPZihwKSA8IDA7XHJcblx0XHRcdFx0XHR9KSwgeCwgeSk7XHJcblx0XHRcdFx0XHRwaWNrZXJzLnB1c2gocGlja2VyKTtcclxuXHJcblx0XHRcdFx0XHQvL21vdmUgcGlja2VyIHRvIHRoZSBwb2ludCBvZiBjbGlja1xyXG5cdFx0XHRcdFx0cGlja2VyLm1vdmUoeCx5KS5zdGFydERyYWcoZSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdC8vZ2V0IGNvb3JkcyByZWxhdGl2ZSB0byB0aGUgY29udGFpbmVyICh0aGlzKVxyXG5cdFx0XHRcdHggPSBnZXRDbGllbnRYKGUpIC0gc2VsZkNsaWVudFJlY3QubGVmdDtcclxuXHRcdFx0XHR5ID0gZ2V0Q2xpZW50WShlKSAtIHNlbGZDbGllbnRSZWN0LnRvcDtcclxuXHJcblx0XHRcdFx0Ly9tYWtlIGNsb3Nlc3QgcGlja2VyIGFjdGl2ZVxyXG5cdFx0XHRcdHBpY2tlciA9IHNlbGYuZ2V0Q2xvc2VzdFBpY2tlcihzZWxmLnBpY2tlcnMsIHgsIHkpO1xyXG5cdFx0XHRcdHBpY2tlcnMucHVzaChwaWNrZXIpO1xyXG5cclxuXHRcdFx0XHQvL21vdmUgcGlja2VyIHRvIHRoZSBwb2ludCBvZiBjbGlja1xyXG5cdFx0XHRcdHBpY2tlci5tb3ZlKHgseSkuc3RhcnREcmFnKGUpO1xyXG5cclxuXHRcdFx0XHQvL2ZvY3VzIHBpY2tlciAobm90IGFsd2F5cyBmb2N1c2FibGUpXHJcblx0XHRcdFx0cGlja2VyLmZvY3VzKCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vZGlzYWJsZSBldmVyeSBwaWNrZXIgZXhjZXB0IGZvciB0aGUgYWN0aXZlIG9uZVxyXG5cdFx0XHQvLyAtIHNvbWUgb3RoZXIgcGlja2VycyBtaWdodCBiZSBjbGlja2VkIG9jY2FzaW9uYWxseVxyXG5cdFx0XHRzZWxmLnBpY2tlcnMuZm9yRWFjaChmdW5jdGlvbiAoaXBpY2tlcikge1xyXG5cdFx0XHRcdGlmIChwaWNrZXJzLmluZGV4T2YoaXBpY2tlcikgPCAwKSB7XHJcblx0XHRcdFx0XHRpcGlja2VyLmRyYWdnYWJsZS5zdGF0ZSA9ICdpZGxlJztcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRpZiAoc2VsZi53aGVlbCkge1xyXG5cdFx0b24oc2VsZi5lbGVtZW50LCAnd2hlZWwuJyArIHNlbGYubnMgKyAnIG1vdXNld2hlZWwnICsgc2VsZi5ucywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0Ly9nZXQgZm9jdXNlZCBlbGVtZW50XHJcblx0XHRcdHZhciBmb2N1c0VsID0gZG9jLmFjdGl2ZUVsZW1lbnQsIHBpY2tlcjtcclxuXHJcblx0XHRcdHZhciBzZWxmQ2xpZW50UmVjdCA9IHNlbGYuZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHJcblx0XHRcdC8vZGV0ZWN0IHBpY2tlciBjbG9zZXN0IHRvIHRoZSBwbGFjZSBvZiB3aGVlbFxyXG5cdFx0XHRpZiAoZm9jdXNFbCA9PT0gc2VsZi5lbGVtZW50KSB7XHJcblx0XHRcdFx0dmFyIHggPSBnZXRDbGllbnRYKGUpIC0gc2VsZkNsaWVudFJlY3QubGVmdDtcclxuXHRcdFx0XHR2YXIgeSA9IGdldENsaWVudFkoZSkgLSBzZWxmQ2xpZW50UmVjdC50b3A7XHJcblxyXG5cdFx0XHRcdHBpY2tlciA9IHNlbGYuZ2V0Q2xvc2VzdFBpY2tlcihzZWxmLnBpY2tlcnMsIHgsIHkpO1xyXG5cclxuXHRcdFx0XHRwaWNrZXIuZm9jdXMoKTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvL2hhbmRsZSBjdXJyZW50IHBpY2tlclxyXG5cdFx0XHRlbHNlIGlmIChmb2N1c0VsLnBhcmVudE5vZGUgPT09IHNlbGYuZWxlbWVudCkge1xyXG5cdFx0XHRcdHBpY2tlciA9IHNlbGYucGlja2Vycy5maWx0ZXIoZnVuY3Rpb24gKHApIHtcclxuXHRcdFx0XHRcdHJldHVybiBwLmVsZW1lbnQgPT09IGZvY3VzRWw7XHJcblx0XHRcdFx0fSlbMF07XHJcblx0XHRcdH1cclxuXHRcdFx0Ly9pZ25vcmUgdW5mb2N1c2VkIHRoaW5nc1xyXG5cdFx0XHRlbHNlIHJldHVybjtcclxuXHJcblx0XHRcdC8vaWdub3JlIGRvYyBzY3JvbGxcclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0Ly9tb3ZlIGl0IGFjY29yZGluZyB0byB0aGUgd2hlZWwgZGlmZlxyXG5cdFx0XHR2YXIgc3RlcFggPSAwLCBzdGVwWSA9IDA7XHJcblx0XHRcdGlmIChlLmRlbHRhWCAhPT0gMCkge1xyXG5cdFx0XHRcdHN0ZXBYID0gZS5kZWx0YVggKiAyIC8gKHNlbGZDbGllbnRSZWN0LndpZHRoKTtcclxuXHRcdFx0XHRzdGVwWCA9IHN0ZXBYID4gMCA/IE1hdGguY2VpbChzdGVwWCkgOiBNYXRoLmZsb29yKHN0ZXBYKTtcclxuXHRcdFx0XHQvL2ludmVydCB4XHJcblx0XHRcdFx0c3RlcFggPSAtc3RlcFg7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKGUuZGVsdGFZICE9PSAwKSB7XHJcblx0XHRcdFx0c3RlcFkgPSBlLmRlbHRhWSAqIDIgLyAoc2VsZkNsaWVudFJlY3QuaGVpZ2h0KTtcclxuXHRcdFx0XHRzdGVwWSA9IHN0ZXBZID4gMCA/IE1hdGguY2VpbChzdGVwWSkgOiBNYXRoLmZsb29yKHN0ZXBZKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cGlja2VyLmluYyhzdGVwWCwgc3RlcFkpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRpZiAoc2VsZi5rZXlib2FyZCkge1xyXG5cdFx0Ly9zZXQgdW5mb2N1c2FibGUgYWx3YXlzIChyZWRpcmVjdCB0byBmaXJzdCBwaWNrZXIpXHJcblx0XHRzZWxmLmVsZW1lbnQuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsIC0xKTtcclxuXHR9XHJcblxyXG5cdC8vZW5hYmxlIHBpY2tlcnNcclxuXHRzZWxmLnBpY2tlcnMuZm9yRWFjaChmdW5jdGlvbiAocGlja2VyKSB7XHJcblx0XHRwaWNrZXIuZW5hYmxlKCk7XHJcblx0fSk7XHJcblxyXG5cdHJldHVybiBzZWxmO1xyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBEaXNhYmxlIGludGVyYWN0aXZpdHlcclxuICpcclxuICogQHJldHVybiB7U2xpZHl9XHJcbiAqL1xyXG5wcm90by5kaXNhYmxlID0gZnVuY3Rpb24gKCkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHJcblx0c2VsZi5pc0VuYWJsZWQgPSBmYWxzZTtcclxuXHJcblx0aWYgKHNlbGYuYXJpYSkge1xyXG5cdFx0Ly9BUklBc1xyXG5cdFx0c2VsZi5lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcsIHRydWUpO1xyXG5cdH1cclxuXHJcblx0c2VsZi5lbGVtZW50LnNldEF0dHJpYnV0ZSgnZGlzYWJsZWQnLCB0cnVlKTtcclxuXHJcblx0Ly91bmJpbmQgZXZlbnRzXHJcblx0b2ZmKHdpbiwgJ3Jlc2l6ZS4nICsgc2VsZi5ucyApO1xyXG5cdG9mZihzZWxmLmVsZW1lbnQsICdhdHRhY2hlZC4nICsgc2VsZi5ucyApO1xyXG5cdG9mZihzZWxmLmVsZW1lbnQsICdtb3VzZWRvd24uJyArIHNlbGYubnMgKTtcclxuXHRvZmYoc2VsZi5lbGVtZW50LCAndG91Y2hzdGFydC4nICsgc2VsZi5ucyApO1xyXG5cclxuXHQvL3VuYmluZCBwaWNrZXJzXHJcblx0c2VsZi5waWNrZXJzLmZvckVhY2goZnVuY3Rpb24gKHBpY2tlcikge1xyXG5cdFx0cGlja2VyLmRpc2FibGUoKTtcclxuXHR9KTtcclxuXHJcblx0cmV0dXJuIHNlbGY7XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIFVwZGF0ZSBhbGwgcGlja2VycyBsaW1pdHMgJiBwb3NpdGlvblxyXG4gKiBhY2NvcmRpbmcgdG8gdmFsdWVzXHJcbiAqL1xyXG5wcm90by51cGRhdGUgPSBmdW5jdGlvbiAoKSB7XHJcblx0Ly91cGRhdGUgcGlja2VycyBsaW1pdHMgJiBwbGFjZW1lbnRcclxuXHQvL3BpY2tlcnMgc2l6ZSBtaWdodCBkZXBlbmQgb24gZG9jIHNpemVcclxuXHR0aGlzLnBpY2tlcnMuZm9yRWFjaChmdW5jdGlvbiAocGlja2VyKSB7XHJcblx0XHRwaWNrZXIudXBkYXRlKCk7XHJcblx0fSk7XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIG5ldyBwaWNrZXIuXHJcbiAqIEl0IGlzIGJldHRlciB0byBrZWVwIGl0IGRpc2NyZXRlLCBub3QgYXMgbGlrZSBgYWRkUGlja2VyYFxyXG4gKiBhcyBpdCBsZWF2ZXMgY29udHJvbGxpbmcgdGhlIGxpc3Qgb2YgcGlja2Vycy5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgT3B0aW9ucyBmb3IgZHJhZ2dhYmxlXHJcbiAqXHJcbiAqIEByZXR1cm4ge1BpY2tlcn0gTmV3IHBpY2tlciBpbnN0YW5jZVxyXG4gKi9cclxucHJvdG8uY3JlYXRlUGlja2VyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG5cdG9wdGlvbnMgPSBleHRlbmQoe1xyXG5cdFx0d2l0aGluOiBzZWxmLmVsZW1lbnQsXHJcblx0XHR0eXBlOiBzZWxmLnR5cGUsXHJcblx0XHRtaW46IHNlbGYubWluLFxyXG5cdFx0bWF4OiBzZWxmLm1heCxcclxuXHRcdHJlcGVhdDogc2VsZi5yZXBlYXQsXHJcblx0XHRzdGVwOiBzZWxmLnN0ZXAsXHJcblx0XHRzbmFwOiBzZWxmLnNuYXAsXHJcblx0XHRwaWNrZXJDbGFzczogc2VsZi5waWNrZXJDbGFzcyxcclxuXHRcdGFsaWduOiBzZWxmLmFsaWduLFxyXG5cdFx0cmVsZWFzZTogc2VsZi5yZWxlYXNlLFxyXG5cdFx0YXJpYTogc2VsZi5hcmlhLFxyXG5cdFx0a2V5Ym9hcmQ6IHNlbGYua2V5Ym9hcmQsXHJcblx0XHR3aGVlbDogc2VsZi53aGVlbCxcclxuXHRcdHBvaW50OiBzZWxmLnBvaW50LFxyXG5cdFx0dmFsdWU6IHNlbGYudmFsdWVcclxuXHR9LCBvcHRpb25zKTtcclxuXHJcblx0dmFyIGVsID0gb3B0aW9ucy5lbGVtZW50IHx8IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG5cclxuXHRpZiAoc2VsZi5hcmlhKSB7XHJcblx0XHQvL2FkZCBBUklBXHJcblx0XHRlbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZGVzY3JpYmVkYnknLCBzZWxmLmVsZW1lbnQuaWQpO1xyXG5cdH1cclxuXHJcblx0Ly9wbGFjZSBwaWNrZXIgdG8gc2VsZlxyXG5cdC8vbmVlZCB0byBiZSBhcHBlbmRlZCBiZWZvcmUgdG8gYnViYmxlIGV2ZW50c1xyXG5cdHNlbGYuZWxlbWVudC5hcHBlbmRDaGlsZChlbCk7XHJcblxyXG5cdHZhciBwaWNrZXIgPSBuZXcgUGlja2VyKGVsLCBvcHRpb25zKTtcclxuXHJcblx0Ly9vbiBwaWNrZXIgY2hhbmdlIHRyaWdnZXIgb3duIGNoYW5nZVxyXG5cdHBpY2tlci5vbignY2hhbmdlJywgZnVuY3Rpb24gKHZhbHVlKSB7XHJcblx0XHRpZiAoc2VsZi5hcmlhKSB7XHJcblx0XHRcdC8vc2V0IGFyaWEgdmFsdWVcclxuXHRcdFx0c2VsZi5lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS12YWx1ZW5vdycsIHZhbHVlKTtcclxuXHRcdFx0c2VsZi5lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS12YWx1ZXRleHQnLCB2YWx1ZSk7XHJcblx0XHR9XHJcblxyXG5cdFx0c2VsZi5lbWl0KCdjaGFuZ2UnLCB2YWx1ZSk7XHJcblx0fSk7XHJcblxyXG5cdHJldHVybiBwaWNrZXI7XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIEdldCBjbG9zZXN0IHBpY2tlciB0byB0aGUgcGxhY2Ugb2YgZXZlbnRcclxuICpcclxuICogQHBhcmFtIHtudW1iZXJ9IHggb2Zmc2V0TGVmdCwgcmVsYXRpdmUgdG8gc2xpZHlcclxuICogQHBhcmFtIHtudW1iZXJ9IHkgb2Zmc2V0VG9wLCByZWxhdGl2ZSB0byBzbGlkeVxyXG4gKlxyXG4gKiBAcmV0dXJuIHtEcmFnZ3l9IEEgcGlja2VyIGluc3RhbmNlXHJcbiAqL1xyXG5wcm90by5nZXRDbG9zZXN0UGlja2VyID0gZnVuY3Rpb24gKHBpY2tlcnMsIHgseSkge1xyXG5cdC8vYmV0d2VlbiBhbGwgcGlja2VycyBjaG9vc2UgdGhlIG9uZSB3aXRoIGNsb3Nlc3QgeCx5XHJcblx0dmFyIG1pblIgPSA5OTk5LCBtaW5QaWNrZXI7XHJcblxyXG5cdHBpY2tlcnMuZm9yRWFjaChmdW5jdGlvbiAocGlja2VyKSB7XHJcblx0XHR2YXIgeHkgPSBwaWNrZXIuZHJhZ2dhYmxlLmdldENvb3JkcygpO1xyXG5cdFx0dmFyIGR4ID0gKHggLSB4eVswXSAtIHBpY2tlci5kcmFnZ2FibGUucGluWzBdIC0gcGlja2VyLmRyYWdnYWJsZS5waW4ud2lkdGggKiBwaWNrZXIuYWxpZ24pO1xyXG5cdFx0dmFyIGR5ID0gKHkgLSB4eVsxXSAtIHBpY2tlci5kcmFnZ2FibGUucGluWzFdIC0gcGlja2VyLmRyYWdnYWJsZS5waW4uaGVpZ2h0ICogcGlja2VyLmFsaWduKTtcclxuXHJcblx0XHR2YXIgciA9IE1hdGguc3FydCggZHgqZHggKyBkeSpkeSApO1xyXG5cclxuXHRcdGlmICggciA8IG1pblIgKSB7XHJcblx0XHRcdG1pblIgPSByO1xyXG5cdFx0XHRtaW5QaWNrZXIgPSBwaWNrZXI7XHJcblx0XHR9XHJcblx0fSk7XHJcblxyXG5cdHJldHVybiBtaW5QaWNrZXI7XHJcbn07Il19
