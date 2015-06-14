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
var slice = require('sliced');


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
		repeat: options.repeat,
		releaseDuration: 80
	});

	//define orientation of picker
	defineState(self, 'orientation', self.orientation);

	//adopt options
	//should go before enabled to set up proper flags
	extend(self, options);

	//NOTE: you have to enable picker manually
}


var proto = Picker.prototype = Object.create(Emitter.prototype);


/** Enable/disable picker */
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
		//hide cursor
		css(root, 'cursor', 'none');
		css(this.element, 'cursor', 'none');
	});
	on(self.draggable, 'drag.' + self.ns, function () {
		//ignore animated state to avoid collisions of value
		if (self.release && self.draggable.isAnimated) return;

		var value = self.calcValue.apply(self, self.draggable.getCoords());
		var oldValue = self.value;

		//display snapping
		self.setValue(value, !self.snap);

		self.interaction(value, oldValue);
	});
	on(self.draggable, 'dragend.' + self.ns, function () {
		if (self.release) {
			//set animation flag
			self.draggable.isAnimated = true;
		}

		//move to a new position
		self.renderValue(self.value);

		//get cursor back
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

			if (e.which === 27) {
				self.blur();
			}

			if (e.which >= 33 && e.which <= 40) {
				e.preventDefault();


				var value = self.handleKeys(self._pressedKeys, self.value, self.step, self.min, self.max);
				var oldValue = self.value;

				//enable animation
				if (self.release) self.draggable.isAnimated = true;

				self.value = value;

				self.interaction(value, oldValue);
			}
		});
		on(self.element, 'keyup.' + self.ns, function (e) {
			self._pressedKeys[e.which] = false;

		});
	}

	//emit duplicate change
	//as if change happens when picker is enabled
	self.emit('change', self.value);

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


proto.interaction = function (value, oldValue) {
	if (!eq(value, oldValue)) emit(this, 'input', value, oldValue);
};


/** Default min/max values */
proto.min = 0;
proto.max = 100;


/** Default step to bind value. It is automatically detected, if isn’t passed. */
proto.step = 1;


/** Loose snapping while drag */
proto.snap = true;


/** Animate release movement */
proto.release = false;


/** Point picker isn’t constrained by it’s shape */
proto.point = false;


/** Picker alignment relative to the mouse. Redefined by slidy, but to prevent empty value it is set to number. */
proto.align = 0.5;


/**
 * Set own value
 *
 * @param {number|Array} value A value to set
 */
proto.setValue = function (value, ignoreRelocation) {
	if (value === undefined) throw Error('Picker value cannot be undefined.');

	var self = this;

	//apply repeat
	if (self.repeat) {
		if (value.length === 2 && self.repeat === 'x') value[0] = loop(value[0], self.min[0], self.max[0]);
		else if (value.length === 2 && self.repeat === 'y') value[1] = loop(value[1], self.min[1], self.max[1]);
		else value = loop(value, self.min, self.max);
	}

	//apply limiting
	value = between(value, self.min, self.max);

	//round value
	if (self.step) {
		if (isFn(self.step)) value = round(value, self.step(value));
		else value = round(value, self.step);
	}

	//update position
	if (!ignoreRelocation) self.renderValue(value);

	//check whether value is actually changed
	if (!eq(self._value, value)) {
		self._value = value;

		//trigger change event on self
		//not the same as native input change
		self.emit('change', value);
	}

	return value;
};


/** Current picker value wrapper */
Object.defineProperties(proto, {
	value: {
		set: proto.setValue,
		get: function () {
			//keep immutability
			return isArray(this._value) ? slice(this._value) : this._value;
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
	var self = this;

	//update pin - may depend on element’s size
	//can’t use `draggable.offsets` here as they might be undefined
	if (self.point) {
		self.draggable.pin = [
			self.element.offsetWidth * self.align,
			self.element.offsetHeight * self.align
		];
	}

	//update draggable limits
	self.draggable.update();

	//update position according to the value
	self.renderValue(self.value);

	return self;
};


/** Move picker to the x, y relative coordinates */
proto.move = function (x, y) {
	var self = this;

	//correct point placement
	if (self.point) {
		var cx = self.draggable.pin.width * self.align;
		var cy = self.draggable.pin.height * self.align;
		x = x - self.draggable.pin[0] - cx;
		y = y - self.draggable.pin[1] - cy;
	}

	//if thumb is more than visible area - subtract overflow coord
	var overflowX = self.draggable.pin.width - self.element.parentNode.clientWidth;
	var overflowY = self.draggable.pin.height - self.element.parentNode.clientHeight;
	if (overflowX > 0) x -= overflowX;
	if (overflowY > 0) y -= overflowY;

	self.draggable.move(x, y);

	var value = self.calcValue(x, y);

	//set value
	self.setValue(value, true);

	return self;
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
proto.orientation = {
	//default orientation is horizontal
	_: 'horizontal',

	horizontal: function () {
		var self = this;

		self.draggable.axis = 'x';

		//place pickers according to the value
		self.renderValue = function (value) {
			value = plainify(value);
			var max = plainify(self.max);
			var min = plainify(self.min);

			var	lims = self.draggable.limits,
				scope = lims.right - lims.left,
				range = max - min,
				ratio = (value - min) / range,
				x = ratio * scope;

			self.move(x);

			return self;
		};

		//round value on each drag
		self.calcValue = function (x) {
			var max = plainify(self.max);
			var min = plainify(self.min);

			var lims = self.draggable.limits,
				scope = lims.right - lims.left,
				normalValue = (x - lims.left) / scope;

			var value = normalValue * (max - min) + min;

			//keep user format of value
			if (isArray(self.value)) value = [value];

			return value;
		};

		self.handleKeys = handle1dkeys;
	},
	vertical: function () {
		var self = this;
		self.draggable.axis = 'y';

		//place pickers according to the value
		self.renderValue = function (value) {
			value = plainify(value);
			var max = plainify(self.max);
			var min = plainify(self.min);
			var	lims = self.draggable.limits,
				scope = lims.bottom - lims.top,
				range = max - min,
				ratio = (-value + max) / range,
				y = ratio * scope;
			self.move(null, y);

			return self;
		};

		//round value on each drag
		self.calcValue = function (x, y) {
			var max = plainify(self.max);
			var min = plainify(self.min);

			var lims = self.draggable.limits,
				scope = lims.bottom - lims.top,
				normalValue = (-y + lims.bottom) / scope;

			var value = normalValue * (max - min) + min;

			//keep user format of value
			if (isArray(self.value)) value = [value];

			return value;
		};

		self.handleKeys = handle1dkeys;
	},
	cartesian: function () {
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
			value = plainify(value);
			var max = plainify(self.max);
			var min = plainify(self.min);
			var	lim = self.draggable.limits,
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top),
				centerX = hScope * 0.5,
				centerY = vScope * 0.5;

			var range = max - min;

			var	normalValue = (value - min) / range;
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

			var max = plainify(self.max);
			var min = plainify(self.min);

			x = x - hScope * 0.5 + self.draggable.pin[0];
			y = y - vScope * 0.5 + self.draggable.pin[1];

			//get angle
			var angle = Math.atan2( y, x );

			//get normal value
			var normalValue = angle * 0.5 / Math.PI + 0.5;

			//get value from coords
			var value = normalValue * (max - min) + min;

			//keep user format of value
			if (isArray(self.value)) value = [value];

			return value;
		};

		self.handleKeys = handle1dkeys;
	},
	polar: function () {
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
	if (isArray(this.value) && this.value.length > 1) {
		var value = this.value;
		value[0] = inc(value[0], this.step[0], timesX);
		value[1] = inc(value[1], this.step[1], timesY);
		this.value = value;
	} else {
		var times = timesY || timesX;
		this.value = inc(this.value, this.step, times);
	}
};


/** Increment & decrement value by the step [N times] */
function inc (value, step, mult) {
	mult = mult || 0;

	var isArr = isArray(value);
	value = plainify(value);

	if (isFn(step)) step = step(value + (mult > 0 ? + MIN_STEP : - MIN_STEP));

	value += step * mult;

	return isArr ? [value] : value;
}


/** Apply pressed keys on the 2d value */
function handle2dkeys (keys, value, step, min, max) {
	//up and right - increase by one
	if (keys[38]) {
		value[1] = inc(value[1], step[1], 1);
	}
	if (keys[39]) {
		value[0] = inc(value[0], step[0], 1);
	}
	if (keys[40]) {
		value[1] = inc(value[1], step[1], -1);
	}
	if (keys[37]) {
		value[0] = inc(value[0], step[0], -1);
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
		value[coordIdx] = inc(value[coordIdx], step[coordIdx], PAGE);
	}

	//pagedown
	if (keys[34]) {
		value[coordIdx] = inc(value[coordIdx], step[coordIdx], -PAGE);
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


/** If value is an array - return first value of it */
function plainify (value) {
	return value.length ? value[0] : value;
}

/** Whether all inner a’s === b’s */
function eq (a,b) {
	if (a && a.length) return a[0] === b[0] && a[1] === b[1];
	return a === b;
}