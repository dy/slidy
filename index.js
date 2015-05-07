/**
 * Slidy - customizable range-slider component.
 *
 * @module slidy
 */


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

	options = options || {};

	//ensure element, if not defined
	if (!target) target = doc.createElement('div');

	//save refrence
	var self = this;
	self.element = target;
	instancesCache.set(target, self);

	//init instance
	target.classList.add('slidy');

	//adopt min/max/value
	//can’t just simply extend options, as init is crucial to order
	if (options.min !== undefined) self.min = options.min;
	if (options.max !== undefined) self.max = options.max;
	if (options.type !== undefined) self.type = options.type;
	if (options.repeat !== undefined) self.repeat = options.repeat;
	if (options.step !== undefined) self.step = options.step;
	if (options.snap !== undefined) self.snap = options.snap;
	if (options.pickerClass !== undefined) self.pickerClass = options.pickerClass;
	if (options.instant !== undefined) self.instant = options.instant;
	if (options.align !== undefined) self.align = options.align;
	if (options.release !== undefined) self.release = options.release;


	//create pickers, if passed a list
	self.pickers = [];
	if (isArray(options.pickers) && options.pickers.length) {
		options.pickers.forEach(function (opts) {
			var picker = self.createPicker(opts);
			self.pickers.push(picker);

			//update picker’s value, to trigger change
			if (opts.value !== undefined) picker.value = opts.value;
		});
		self.picker = self.pickers[0];
	}
	//ensure at least one picker exists
	else {
		self.picker = self.createPicker();
		self.pickers.push(self.picker);
		//init first picker’s value
		if (options.value !== undefined) self.value = options.value;
	}


	///Events
	// Update pickers position on the first load and resize
	throttle(win, 'resize', 20, function () {
		self.update();
	});

	//observe when slider is inserted
	on(self.element, 'attached', function (e) {
		self.update();
	});
	lifecycle.enable(self.element);

	//move closest picker to the place of click
	on(self.element, 'mousedown touchstart', function (e) {
		var clickCoords = self.element.getBoundingClientRect();

		//get coords relative to the container (this)
		var x = getClientX(e) - clickCoords.left;
		var y = getClientY(e) - clickCoords.top;

		//make closest picker active
		self.picker = self.getClosestPicker(x, y);

		//move picker to the point of click
		if (self.instant) {
			self.picker.move(x,y).startDrag();
		}

		//disable every picker except for the active one
		// - some other pickers might be clicked occasionally
		//FIXME: the case of multitouch
		self.pickers.forEach(function (ipicker) {
			if (ipicker !== self.picker) {
				ipicker.draggable.state = 'idle';
			}
		});
	});

	//emit callback
	self.emit('created');
}


var proto = Slidy.prototype = Object.create(Emitter.prototype);


/**
 * Default range
 */
proto.min = 0;
proto.max = 100;


/** Define value as active picker value */
Object.defineProperty(proto, 'value', {
	set: function (value) {
		this.picker.value = value;
	},
	get: function () {
		return this.picker.value;
	}
});


/** Default placing type is horizontal */
proto.type = 'horizontal';


/**
 * Repeat either by one or both axis
 *
 * @enum {bool}
 * @default true
 */
proto.repeat = false;


/**
 * Move picker instantly to the place of click
 */
proto.instant = true;


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
		release: self.release
	}, options);

	var el = document.createElement('div');

	//place picker to self
	//need to be appended before to bubble events
	self.element.appendChild(el);

	var picker = new Picker(el, options);

	//on picker change trigger own change
	picker.on('change', function (value) {
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