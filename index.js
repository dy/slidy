/**
 * Slidy - customizable range-slider component.
 *
 * @module slidy
 */


//TODO: pre-created pickers
//TODO: fix case where target is native slider (polyfill or extend)

var Picker = require('./lib/picker');

var extend = require('xtend/mutable');
var round = require('mumath/round');
var between = require('mumath/between');
var state = require('st8');
var isArray = require('is-array');
var defineState = require('define-state');

var lifecycle = require('lifecycle-events');
var Emitter = require('events');
var on = require('emmy/on');
var off = require('emmy/off');
var emit = require('emmy/emit');
var throttle = require('emmy/throttle');
var getClientX = require('get-client-xy').x;
var getClientY = require('get-client-xy').y;


var win = window, doc = document;


module.exports = Slidy;


/** Cache of instances. Just as it is safer than keeping them on targets. */
var instancesCache = Slidy.cache = new WeakMap;


/**
 * Create slider over a target
 * @constructor
 */
function Slidy(target, options) {
	//force constructor
	if (!(this instanceof Slidy)) return new Slidy(target, options);

	//ensure element, if not defined
	if (!target) target = doc.createElement('div');

	//save refrence
	var self = this;
	self.element = target;
	instancesCache.set(target, self);

	//init instance
	target.classList.add('slidy');

	//define type
	defineState(self, 'type', self.type);

	//adopt passed options
	extend(self, options);

	//create initial number of pickers (at least one picker exists)
	self.pickers = [this.createPicker()];

	//define initial type
	self.type = 'horizontal';

	///Events
	// Update pickers position on the first load and resize.
	// Note that it is concern of slidy
	// to update picker position to correspond to value, rather than draggy.
	throttle(win, 'resize', 20, function () {
		self.update();
	});

	//observe when slider is inserted
	on(self.element, 'attached', function (e) {
		self.update();
	});
	lifecycle.enable(self.element);

	//move closest picker to the place of click
	on(self.element, 'mousedown', function (e) {
		var clickCoords = self.element.getBoundingClientRect();

		//get coords relative to the container (this)
		var x = getClientX(e) - clickCoords.left;
		var y = getClientY(e) - clickCoords.top;

		//make closest picker active
		self.picker = self.getClosestPicker(x, y);

		//move picker to the point of click
		self.picker.move(x,y).startDrag();

		//disable every picker except for the active one
		// - some other pickers might be clicked occasionally
		//FIXME: the case of multitouch
		self.pickers.forEach(function (ipicker) {
			if (ipicker !== self.picker) {
				ipicker.draggable.state = 'idle';
			}
		});
	});

	/*
	//keep value updated on drag
	on(self.element, 'drag', function (e) {
		//get current picker’s value
		var value = self.getValue(e);

		//place new value to proper position, if it is multipicker
		if (self.pickers.length > 1) {
			var idx = self.pickers.indexOf(e.target.draggy);
			self.value[idx] = value;

			//FIXME: force updating value
			self.value = self.value.slice();
		}
		else {
			self.value = value;
		}
	});

	// Update pickers position on dragend
	on(self.element, 'dragend', function (e) {
		self.updatePickersPosition();
	});
	*/

	//emit callback
	self.emit('created');
}


var proto = Slidy.prototype = Object.create(Emitter.prototype);


/**
 * Default range
 * @type {number}
 */
proto.min = 0;
proto.max = 100;


/** Pointer for number of dimensions */
proto.dimensions = 1;


/**
 * Placing type
 * @enum {string}
 * @default 'horizontal'
 */
proto.type = {
	horizontal: function () {
		this.pickers.forEach(function (picker) { picker.axis = 'x';});
		this.dimensions = 1;

		//place pickers according to the value
		// this.update = function () {
		// 	var	lims = picker.limits,
		// 		hScope = (lims.right - lims.left),
		// 		vScope = (lims.bottom - lims.top);

		// 	var hRange = this.max - this.min,
		// 		ratioX = (value - this.min) / hRange,
		// 		ratioY = .5;

		// 	picker.x = ratioX * hScope - picker.pin[0];
		// 	picker.y = ratioY * vScope - picker.pin[1];
		// };

		//round value on each drag
		// getValue: function (e) {
		// 	var draggy = e.target.draggy,
		// 		lim = draggy.limits,
		// 		draggyW = draggy.offsetWidth,
		// 		draggyH = draggy.offsetHeight,
		// 		//scope sizes
		// 		hScope = (lim.right - lim.left),
		// 		vScope = (lim.bottom - lim.top),
		// 		self = this;

		// 	var normalValue = (draggy.x - lim.left) / hScope;
		// 	return normalValue * (self.max - self.min) + self.min;
		// }
	},
	vertical: function () {
		this.pickers.forEach(function (picker) { picker.axis = 'y';});
		this.dimensions = 1;

		// updatePickerPosition: function (picker, value) {
		// 	var	lims = picker.limits,
		// 		hScope = (lims.right - lims.left),
		// 		vScope = (lims.bottom - lims.top);

		// 	var vRange = this.max - this.min,
		// 		ratioX = .5,
		// 		ratioY = (-value + this.max) / vRange

		// 	picker.x = ratioX * hScope - picker.pin[0];
		// 	picker.y = ratioY * vScope - picker.pin[1];
		// },

		// getValue: function (e) {
		// 	// console.log('drag observed', e.target.dragstate);
		// 	var draggy = e.target.draggy,
		// 		d = draggy.dragstate,
		// 		lim = draggy.limits,
		// 		draggyW = draggy.offsetWidth,
		// 		draggyH = draggy.offsetHeight,
		// 		//scope sizes
		// 		hScope = (lim.right - lim.left),
		// 		vScope = (lim.bottom - lim.top),
		// 		self = this;

		// 	var normalValue = (- draggy.y + lim.bottom) / vScope;
		// 	return normalValue * (self.max - self.min) + self.min;
		// }
	},
	rectangular: {
		axis: null,

		dim: 2,

		updatePickerPosition: function (picker, value) {
			// console.log('updatePosition', picker)
			var	lim = picker.limits,
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top)

			var hRange = this.max[0] - this.min[0],
				vRange = this.max[1] - this.min[1],
				ratioX = (value[0] - this.min[0]) / hRange,
				ratioY = (-value[1] + this.max[1]) / vRange;

			picker.x = ratioX * hScope - picker.pin[0];
			picker.y = ratioY * vScope - picker.pin[1];
		},

		getValue: function (e) {
			// console.log('drag observed', e.target.dragstate);
			var draggy = e.target.draggy,
				d = draggy.dragstate,
				lim = draggy.limits,
				draggyW = draggy.offsetWidth,
				draggyH = draggy.offsetHeight,
				//scope sizes
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top),
				self = this;

			var normalValue = [(draggy.x - lim.left) / hScope, ( - draggy.y + lim.bottom) / vScope];

			return [
				normalValue[0] * (self.max[0] - self.min[0]) + self.min[0],
				normalValue[1] * (self.max[1] - self.min[1]) + self.min[1]
			];
		}
	},
	circular: {
		axis: null,

		dim: 1,

		updatePickerPosition: function (picker,value) {
			var	lim = picker.limits,
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top),
				centerX = hScope / 2,
				centerY = vScope / 2;

			var range = this.max - this.min;
			var	normalValue = (value - this.min) / range;
			var angle = (normalValue - .5) * 2 * Math.PI;

			picker.freeze = false;
			picker.x = Math.cos(angle) * hScope/2 + hScope/2 - picker.pin[0];
			picker.y = Math.sin(angle) * vScope/2 + vScope/2 - picker.pin[1];
			// console.log(picker.x, picker.element.style.transform)
			picker.freeze = true;
		},

		getValue: function (e) {
			// console.log('drag observed');
			var draggy = e.target.draggy,
				d = draggy.dragstate,
				lim = draggy.limits,
				//scope sizes
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top),
				self = this;

			var x = draggy.x - hScope / 2 + draggy.pin[0];
			var y = draggy.y - vScope / 2 + draggy.pin[1];

			//get angle
			var angle = Math.atan2( y, x );

			//get normal value
			var normalValue = angle / 2 / Math.PI + .5;

			//get value from coords
			return normalValue * (self.max - self.min) + self.min;
		}
	},
	round: {
		axis: null,

		dim: 2,

		updatePickerPosition: function (picker, value) {
			// console.log('upd position')
			var	lim = picker.limits,
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top),
				centerX = hScope / 2,
				centerY = vScope / 2;

			//get angle normal value
			var aRange = this.max[0] - this.min[0];
			var	normalAngleValue = (value[0] - this.min[0]) / aRange;
			var angle = (normalAngleValue - .5) * 2 * Math.PI;

			//get radius normal value
			var rRange = this.max[1] - this.min[1];
			var normalRadiusValue = (value[1] - this.min[1]) / rRange;
			// console.log(this.value[1])
			var xRadius = hScope * normalRadiusValue / 2;
			var yRadius = vScope * normalRadiusValue / 2;

			//TODO: set coords from value
			// console.log('update position', xRadius)

			picker.x = Math.cos(angle) * xRadius + hScope * .5 - picker.pin[0];
			picker.y = Math.sin(angle) * yRadius + vScope * .5 - picker.pin[1];
		},

		getValue: function (e) {
			// console.log('drag observed', e.target.dragstate);
			var draggy = e.target.draggy,
				d = draggy.dragstate,
				lim = draggy.limits,
				//scope sizes
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top),
				self = this;

			var x = draggy.x + draggy.pin[0] - hScope / 2;
			var y = draggy.y + draggy.pin[1] - vScope / 2;

			//get angle
			var angle = Math.atan2( y, x );

			//get normal value
			var normalAngleValue = (angle / 2 / Math.PI + .5);
			var normalRadiusValue = Math.sqrt( x*x + y*y ) / hScope * 2;
			// console.log(normalAngleValue, normalRadiusValue)

			//get value from coords
			return [
				normalAngleValue * (self.max[0] - self.min[0]) + self.min[0],
				normalRadiusValue * (self.max[1] - self.min[1]) + self.min[1]
			];
		}
	}
};


/** Minimal step to bind final value
 */
proto.step = {
	init: function (value) {
		var range;
		if (value !== undefined) return value;

		//detect step automatically based on min/max range (1/100 by default)
		if (this.max) {
			range = Math.abs(this.max - this.min);
			return range <= 100 ? .01 : 1;
		} else {
			return 1;
		}
	}
};


/** Range mode
 * @todo
 */
proto.mode =  true; //min, max


/** Snapping function
 * @todo
 * @note or precision?
 */
proto.snap = false;


/** Focusable, controllable
 *
 * @todo
 */
proto.keyboard = true;


/** Ignore sets
 *
 * @todo
 */
proto.readonly = false;


/** Repeat either by one axis if one dimension
 * or by both axis or one pointed if two dimensions
 *
 * @enum {bool}
 * @default true
 */
proto.repeat = {
	init: false,
	changed: function (repeat) {
	}
};


/**
 * Add this class to each picker
 */
proto.pickerClass = 'slidy-picker';


/**
 * Slidy value
 * keeps list of values in case of multiple pickers
 *
 * @example
 * [[0,0], [1,2], [3,4]] - for the case of three 2-dim pickers
 * [1,2,3] - for the case of three 1-dim pickers
 * [1,2] - for the case of one 2-dim picker or 2 1-dim pickers (range)
 * @enum {(Array|number)}
 */
proto.value = {
	init: function (value) {
		//create number of pickers according to the value size
		//NOTE: don’t place it in change - it will change too often then
		var pickers = this.pickers;

		//for one dimension consider array as a list of pickers
		if (this.dim === 1) {
			if (isArray(value)) {
				for (var i = 1, l = value.length; i < l; i++) {
					pickers.push(this.createPicker());
				}
			}
		}
		//for multidim
		else {
			//consider inner arrays as multiple values
			if (isArray(value[0])) {
				for (var i = 1, l = value.length; i < l; i++) {
					pickers.push(this.createPicker());
				}
			}
		}

		return value;
	},

	set: function (value, old) {
		var result;

		//FIXME: what is this for?
		value = value !== undefined ? value : this.min;

		//clamp values
		if (isArray(value) && isArray(value[0])) {
			//catch multiple 2dim case
			for (var i = 0; i < value.length; i++) {
				value[i] = round(between(value[i], this.min, this.max), this.step);
			}
			result = value;
		}
		else {
			result = between(value, this.min, this.max);
			result = round(result, this.step);
		}
		// console.groupEnd()

		return result;
	},

	changed: function (val, old) {
		if (!this.mute) {
			//trigger change every time value changes
			this.emit('change');
			Emitter.emit(this.element, 'change', null, true);
		}

		//update pickers position to the new value
		//NOTE: this may be moved to dragend in performance reasons
		//FIXME: this causes limitless initial setx
		this.updatePickersPosition();
	}
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

	//if single picker - treat value as
	// if (this.pickers.length === 1) {
	// 	this.updatePicker(this.pickers[0], this.value);
	// }
	// else {
	// 	for (var i = 0, l = this.pickers.length; i<l; i++) {
	// 		this.updatePicker(this.pickers[i], this.value[i]);
	// 	}
	// }
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
	options = options || {};
	options.within = this.element;

	var picker = new Picker(null, options);

	//place picker to self
	this.element.appendChild(picker.element);

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
proto.getClosestPicker = function (x,y) {
	//between all pickers choose the one with closest x,y
	var minR = 9999, picker, minPicker;

	this.pickers.forEach(function (picker) {
		var xy = picker.draggable.getCoords();
		var dx = (x - xy[0] - picker.draggable.pin[0]);
		var dy = (y - xy[1] - picker.draggable.pin[1]);

		var r = Math.sqrt( dx*dx + dy*dy );

		if ( r < minR ) {
			minR = r;
			minPicker = picker;
		}
	});

	return minPicker;
};