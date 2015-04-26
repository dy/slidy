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
		self.renderValue();
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
				hScope = lims.right - lims.left,
				hRange = self.max - self.min,
				ratioX = (value - self.min) / hRange,
				x = ratioX * hScope;
			self.move(x);
		};

		//round value on each drag
		self.calcValue = function (e) {
			var lims = self.draggable.limits,
				hScope = lims.right - lims.left,
				xy = self.draggable.getCoords(),
				normalValue = (xy[0] - lims.left) / hScope;

			return normalValue * (self.max - self.min) + self.min;
		};
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

		// calcValue: function (e) {
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

		calcValue: function (e) {
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

		calcValue: function (e) {
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

		calcValue: function (e) {
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