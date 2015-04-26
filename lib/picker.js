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
var extend = require('xtend/mutable');
var emit = require('emmy/emit');
var on = require('emmy/on');

module.exports = Picker;


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
		el = document.createElement('div');
	}
	el.classList.add('slidy-picker');
	self.element = el;

	//init draggable
	self.draggable = new Draggable(el, {
		hideCursor: true,
		threshold: 0,
		within: options.within,

		//TODO: make axis based on type
		axis: 'x'
	});

	//define type of picker
	defineState(self, 'type', self.type);
	self.type = 'horizontal';

	//adopt options
	extend(self, options);

	//events
	on(self.draggable, 'drag', function () {
		self.value = self.calcValue();
	});
	on(self.draggable, 'dragend', function () {
		self.renderValue(self.value);
	});
}


var proto = Picker.prototype;


/** Default min/max values */
proto.min = 0;
proto.max = 100;


/** Current picker value wrapper */
Object.defineProperties(proto, {
	value: {
		set: function (value) {
			this._value = value;

			//don’t render value on each drag step
			// this.renderValue();

			//trigger bubbling event, like all inputs do
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
proto.calcValue = function () {};


/** Update self size, pin & position, according to the value */
proto.update = function () {
	//update pin - may depend on element’s size
	this.draggable.pin = [
		this.element.offsetWidth * .5,
		this.element.offsetHeight * .5
	];

	//update draggable limits
	this.draggable.update();

	//update position according to the value
	this.renderValue(this.value);

	return this;
};


/** Move picker to the x, y relative coordinates */
proto.move = function (x, y) {
	this.draggable.move(x - this.draggable.pin[0], y - this.draggable.pin[1]);
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
		self.calcValue = function (e) {
			var lims = self.draggable.limits,
				scope = lims.right - lims.left,
				xy = self.draggable.getCoords(),
				normalValue = (xy[0] - lims.left) / scope;

			return normalValue * (self.max - self.min) + self.min;
		};
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
		self.calcValue = function (e) {
			var lims = self.draggable.limits,
				scope = lims.bottom - lims.top,
				xy = self.draggable.getCoords(),
				normalValue = (-xy[1] + lims.bottom) / scope;

			return normalValue * (self.max - self.min) + self.min;
		};
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

		self.calcValue = function () {
			var lim = self.draggable.limits,
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top),
				xy = self.draggable.getCoords();

			var normalValue = [(xy[0] - lim.left) / hScope, ( - xy[1] + lim.bottom) / vScope];

			return [
				normalValue[0] * (self.max[0] - self.min[0]) + self.min[0],
				normalValue[1] * (self.max[1] - self.min[1]) + self.min[1]
			];
		};
	},
	circular: function () {
		var self = this;
		self.draggable.axis = null;

		self.renderValue = function (value) {
			var	lim = self.draggable.limits,
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top),
				centerX = hScope / 2,
				centerY = vScope / 2;

			var range = self.max - self.min;

			var	normalValue = (value - self.min) / range;
			var angle = (normalValue - .5) * 2 * Math.PI;
			self.move(
				Math.cos(angle) * hScope/2 + hScope/2,
				Math.sin(angle) * vScope/2 + vScope/2
			);
		};

		self.calcValue = function (e) {
			var lim = self.draggable.limits,
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top),
				xy = self.draggable.getCoords();

			var x = xy[0] - hScope / 2 + self.draggable.pin[0];
			var y = xy[1] - vScope / 2 + self.draggable.pin[1];

			//get angle
			var angle = Math.atan2( y, x );

			//get normal value
			var normalValue = angle / 2 / Math.PI + .5;

			//get value from coords
			return normalValue * (self.max - self.min) + self.min;
		};
	},
	round: function () {
		var self = this;
		self.draggable.axis = null;

		self.renderValue = function () {
			// console.log('upd position')
			var	lim = picker.limits,
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top),
				centerX = hScope / 2,
				centerY = vScope / 2;

			//get angle normal value
			var aRange = self.max[0] - self.min[0];
			var	normalAngleValue = (value[0] - self.min[0]) / aRange;
			var angle = (normalAngleValue - .5) * 2 * Math.PI;

			//get radius normal value
			var rRange = self.max[1] - self.min[1];
			var normalRadiusValue = (value[1] - self.min[1]) / rRange;
			// console.log(self.value[1])
			var xRadius = hScope * normalRadiusValue / 2;
			var yRadius = vScope * normalRadiusValue / 2;

			//TODO: set coords from value
			// console.log('update position', xRadius)

			picker.x = Math.cos(angle) * xRadius + hScope * .5 - picker.pin[0];
			picker.y = Math.sin(angle) * yRadius + vScope * .5 - picker.pin[1];
		};

		self.calcValue = function (e) {
			// console.log('drag observed', e.target.dragstate);
			var draggy = e.target.draggy,
				lim = draggy.limits,
				//scope sizes
				hScope = (lim.right - lim.left),
				vScope = (lim.bottom - lim.top),
				self = self;

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
		};
	}
};