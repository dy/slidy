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

module.exports = Picker;


var doc = document, root = document.documentElement;


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

	//init draggable
	self.draggable = new Draggable(el, {
		threshold: 0,
		within: options.within,
		sniperSlowdown: 0.85,
		axis: 'x',
		repeat: options.repeat
	});

	//adopt options
	if (options.max !== undefined) self.max = options.max;
	if (options.min !== undefined) self.min = options.min;

	//detect step automatically based on min/max range (1/100 by default)
	if (options.step !== undefined) self.step = options.step;
	else {
		var range = Math.abs(self.max - self.min);
		self.step = range <= 100 ? 0.01 : 1;
	}

	//define type of picker
	defineState(self, 'type', self.type);
	self.type = options.type === undefined ? 'horizontal': options.type;

	//set value, if passed
	//in single pickers value is inited afterwards
	if (options.value !== undefined) self.value = options.value;


	//events
	on(self.draggable, 'dragstart', function () {
		css(root, 'cursor', 'none');
		css(this.element, 'cursor', 'none');
	});
	on(self.draggable, 'drag', function () {
		self.value = self.calcValue.apply(self, self.draggable.getCoords());
	});
	on(self.draggable, 'dragend', function () {
		self.renderValue(self.value);
		css(root, 'cursor', null);
		css(this.element, 'cursor', null);
	});


	//focusability
	self.element.setAttribute('tabindex', 0);

	//ARIAs
	self.element.setAttribute('role', 'slider');
	self.element.setAttribute('aria-valuemax', self.max);
	self.element.setAttribute('aria-valuemin', self.min);

	//kbd events
	//@ref http://www.w3.org/TR/wai-aria/roles#slider
	//@ref http://access.aol.com/dhtml-style-guide-working-group/#slidertwothumb
	on(self.element, 'keydown', function (e) {
		if (e.which >= 35 && e.which <= 40) {
			e.preventDefault();

			self.handleKeypress(e.which);
			self.renderValue(self.value);
		}
	});
}


var proto = Picker.prototype = Object.create(Emitter.prototype);


/** Default min/max values */
proto.min = 0;
proto.max = 100;
proto.step = 1;


/** Current picker value wrapper */
Object.defineProperties(proto, {
	value: {
		set: function (value) {
			if (value === undefined) throw Error('Picker value cannot be undefined.');

			this._value = value;

			this.element.setAttribute('aria-valuenow', value);
			this.element.setAttribute('aria-valuetext', value);

			//trigger bubbling event, like all inputs do
			this.emit('change', value);
			emit(this.element, 'change', value, true);
		},
		get: function () {
			//catch undefined value to lazy-init it with zero
			if (this._value === undefined) this.value = 0;

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
proto.handleKeypress = function (key) {};


/** Update self size, pin & position, according to the value */
proto.update = function () {
	//update pin - may depend on element’s size
	this.draggable.pin = [
		this.element.offsetWidth * 0.5,
		this.element.offsetHeight * 0.5
	];

	//update draggable limits
	this.draggable.update();

	//update position according to the value
	this.renderValue(this.value);

	return this;
};


/** Move picker to the x, y relative coordinates */
proto.move = function (x, y) {
	x -= this.draggable.pin[0];
	y -= this.draggable.pin[1];

	this.draggable.move(x, y);

	//set value
	this.value = this.calcValue(x, y);

	return this;
};


/**
 * Move picker to the point of click with the centered drag point
 */
proto.startDrag = function () {
	var self = this;

	//update drag limits based off event passed
	self.draggable.update();

	//start drag
	//ignore if already drags
	if (self.draggable.state !== 'drag') {
		self.draggable.state = 'drag';
	}

	//centrize picker
	self.draggable.innerOffsetX = self.draggable.pin[0];
	self.draggable.innerOffsetY = self.draggable.pin[1];

	return this;
};


/**
 * Placing type
 * @enum {string}
 * @default 'horizontal'
 */
proto.type = {
	horizontal: function () {
		var self = this;

		self.draggable.axis = 'x';
		self.element.setAttribute('aria-orientation', 'horizontal');

		//place pickers according to the value
		self.renderValue = function (value) {
			var	lims = self.draggable.limits,
				scope = lims.right - lims.left,
				range = self.max - self.min,
				ratio = (value - self.min) / range,
				x = ratio * scope;
			self.move(x);

			return self;
		};

		//round value on each drag
		self.calcValue = function (x) {
			var lims = self.draggable.limits,
				scope = lims.right - lims.left,
				normalValue = (x - lims.left) / scope;

			return normalValue * (self.max - self.min) + self.min;
		};


		self.handleKeypress = function (key) {
			//up and right - increase by one
			if (key === 38 || key === 39) {
				self.value += self.step;
			}

			//down and left - decrease by one
			if (key === 40 || key === 37) {
				self.value -= self.step;
			}

			//home - min
			if (key === 36) {
				self.value = self.min;
			}

			//end - max
			if (key === 35) {
				self.value = self.max;
			}

		};
	},
	vertical: function () {
		var self = this;
		self.draggable.axis = 'y';
		self.element.setAttribute('aria-orientation', 'vertical');

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

		self.handleKeypress = function (key) {
			//up and right - increase by one
			if (key === 38 || key === 39) {
				self.value += self.step;
			}

			//down and left - decrease by one
			if (key === 40 || key === 37) {
				self.value -= self.step;
			}

			//home - min
			if (key === 36) {
				self.value = self.min;
			}

			//end - max
			if (key === 35) {
				self.value = self.max;
			}

		};
	},
	rectangular: function () {
		var self = this;
		self.draggable.axis = null;
		self.element.setAttribute('aria-orientation', 'spatial');

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

		self.handleKeypress = function (key) {
			//up and right - increase by one
			if (key === 38) self.value[1] += self.step;
			if (key === 39) self.value[0] += self.step;
			if (key === 40) self.value[1] -= self.step;
			if (key === 37) self.value[0] -= self.step;

			//home - min
			if (key === 36) {
				self.value[0] = self.min[0];
				self.value[1] = self.min[1];
			}

			//end - max
			if (key === 35) {
				self.value[0] = self.max[0];
				self.value[1] = self.max[1];
			}

		};
	},
	circular: function () {
		var self = this;
		self.draggable.axis = null;
		self.element.setAttribute('aria-orientation', 'spatial');

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

		self.handleKeypress = function (key) {
			//up and right - increase by one
			if (key === 38 || key === 39) {
				self.value += self.step;
			}

			//down and left - decrease by one
			if (key === 40 || key === 37) {
				self.value -= self.step;
			}

			//home - min
			if (key === 36) {
				self.value = self.min;
			}

			//end - max
			if (key === 35) {
				self.value = self.max;
			}

		};
	},
	round: function () {
		var self = this;
		self.draggable.axis = null;
		self.element.setAttribute('aria-orientation', 'spatial');

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

		self.handleKeypress = function (key) {
			//up and right - increase by one
			if (key === 38) self.value[1] += self.step;
			if (key === 39) self.value[0] += self.step;
			if (key === 40) self.value[1] -= self.step;
			if (key === 37) self.value[0] -= self.step;

			//home - min
			if (key === 36) {
				self.value[0] = self.min[0];
				self.value[1] = self.min[1];
			}

			//end - max
			if (key === 35) {
				self.value[0] = self.max[0];
				self.value[1] = self.max[1];
			}

		};
	}
};