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

	//adopt passed options
	//it may contain value/min/max, so create picker later
	extend(self, options);

	//create initial number of pickers (at least one picker exists)
	self.picker = self.createPicker();
	self.pickers = [self.picker];

	//picker value should be inited after picker is added to pickers list
	//because setting value triggers callback, which should get full-featured slidy
	self.picker.value = self.value;

	//define value as first picker value
	Object.defineProperty(self, 'value', {
		set: function (value) {self.picker.value = value;},
		get: function () {return self.picker.value;}
	});

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

	//emit callback
	self.emit('created');
}


var proto = Slidy.prototype = Object.create(Emitter.prototype);


/**
 * Default range
 */
proto.min = 0;
proto.max = 100;
proto.value = 0;


/** Default placing type is horizontal */
proto.type = 'horizontal';


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


/** Snapping function
 * @todo
 * @note or precision?
 */
proto.snap = false;
proto.focusable = true;
proto.keyboard = false;


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
	options = extend({
		within: this.element,
		type: this.type,
		min: this.min,
		max: this.max
	}, options);

	var el = document.createElement('div');

	//place picker to self
	//need to be appended before to bubble events
	this.element.appendChild(el);

	var picker = new Picker(el, options);

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