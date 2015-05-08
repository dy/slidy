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
var css = require('mucss/css');
var Emitter = require('events');
var isFn = require('is-function');
var isNumber = require('is-number');
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
			if (r > hScope / 2) {
				this.setCoords(
					Math.cos(angle) * (cx + this.pin[0]) + cx,
					Math.sin(angle) * (cy + this.pin[1]) + cy
				);
			}
			else {
				this.setCoords(x, y);
			}
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

			var xRadius = hScope * normalRadiusValue * 0.5;
			var yRadius = vScope * normalRadiusValue * 0.5;

			self.move(
				Math.cos(angle) * xRadius + hScope * 0.5,
				Math.sin(angle) * yRadius + vScope * 0.5
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
	if (keys[18] || keys[91] || keys[17] || keys[16]) {
		//home - min
		if (keys[36]) {
			value[0] = min[0];
		}

		//end - max
		if (keys[35]) {
			value[0] = max[0];
		}

		//pageup
		if (keys[33]) {
			value[0] = inc(value[0], step, PAGE);
		}

		//pagedown
		if (keys[34]) {
			value[0] = inc(value[0], step, -PAGE);
		}
	} else {
		//home - min
		if (keys[36]) {
			value[1] = min[1];
		}

		//end - max
		if (keys[35]) {
			value[1] = max[1];
		}

		//pageup
		if (keys[33]) {
			value[1] = inc(value[1], step, PAGE);
		}

		//pagedown
		if (keys[34]) {
			value[1] = inc(value[1], step, -PAGE);
		}
	}


	return value;
}

/** Apply pressed keys on the 1d value */
function handle1dkeys (keys, value, step, min, max) {
	step = step || 1;
	var pageStep = step * PAGE;

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