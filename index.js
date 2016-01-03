/**
 * Slidy - customizable slider component.
 *
 * @module slidy
 */

var Picker = require('./picker');

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
var isFn = require('is-function');
var getTransformer = require('mumath/wrap');


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

	//ensure target & options
	if (!options) {
		if (target instanceof Element) {
			options = {};
		}
		else {
			options = target;
			target = doc.createElement('div');
		}
	}


	//get preferred element
	self.element = target;

	//adopt options
	extend(self, options);

	//calculate value & step
	//detect step automatically based on min/max range (1/100 by default)
	//native behaviour is always 1, so ignore it
	if (options.step === undefined) {
		self.step = detectStep(self.min, self.max);
	}

	//calc undefined valuea as a middle of range
	if (options.value === undefined) {
		self.value = detectValue(self.min, self.max);
	}

	//bind passed callbacks, if any
	if (options.created) on(self, 'created', options.created);

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
			var picker = self.createPicker(opts);
			self.pickers.push(picker);
		});
	}
	//ensure at least one picker exists
	else {
		self.pickers.push(self.createPicker(options.pickers));
	}

	// Define value as active picker value getter
	Object.defineProperty(self, 'value', {
		set: function (value) {
			this.getActivePicker().value = value;
		},
		get: function () {
			return this.getActivePicker().value;
		}
	});


	if (self.aria) {
		//a11y
		//@ref http://www.w3.org/TR/wai-aria/roles#slider
		self.element.setAttribute('role', 'slider');
		target.setAttribute('aria-valuemax', self.max);
		target.setAttribute('aria-valuemin', self.min);
		target.setAttribute('aria-orientation', self.orientation);
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
proto.orientation = 'horizontal';


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

	//add change listenerw, if passed one
	if (isFn(self.change)) on(self, 'change', self.change);
	if (isFn(self.input)) on(self, 'input', self.input);

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

					var oldValue = picker.value;

					//move picker to the point of click
					picker.move(x,y).startDrag(e);

					picker.interaction(picker.value, oldValue);
				}
			} else {
				//get coords relative to the container (this)
				x = getClientX(e) - selfClientRect.left;
				y = getClientY(e) - selfClientRect.top;

				//make closest picker active
				picker = self.getClosestPicker(self.pickers, x, y);
				pickers.push(picker);

				var oldValue = picker.value;

				//move picker to the point of click
				picker.move(x,y).startDrag(e);

				picker.interaction(picker.value, oldValue);

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
				picker = self.getActivePicker();
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

			self.emit('input', picker.value);
		});
	}

	if (self.keyboard) {
		//set unfocusable always (redirect to the first picker)
		self.element.setAttribute('tabindex', -1);

		//in case of focused multitouch unfocus by escape
		on(self.element, 'keydown', function (e) {
			if (e.which === 27) self.element.blur();
		});
	}

	//enable pickers
	self.pickers.forEach(function (picker) {
		//on picker change trigger own change
		picker.on('change', function (value) {
			if (self.aria) {
				//set aria value
				self.element.setAttribute('aria-valuenow', value);
				self.element.setAttribute('aria-valuetext', value);
			}
			self.emit('change', value);
		})

		//observe drag, treat as user input
		.on('input', function (value, oldValue) {
			self.emit('input', value, oldValue);
		});

		//enable picker - init value
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
 * as it leaves controlling the list of pickers to user.
 *
 * @param {Object} options Options for draggable
 *
 * @return {Picker} New picker instance
 */
proto.createPicker = function (options) {
	var self = this;

	//if opts is element - treat it as element for the picker
	if (options instanceof Element) options = {
		element: options
	};

	options = extend({
		within: self.element,
		orientation: self.orientation,
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

	return picker;
};


/**
 * Create & add picker.
 * A useful name convention for the API.
 */
proto.addPicker = function (options) {
	var self = this;

	var picker = self.createPicker(options);

	self.pickers.push(picker);

	return self;
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


/**
 * Return active picker
 */
proto.getActivePicker = function () {
	var focusEl = doc.activeElement;
	var picker = this.pickers.filter(function (p) {
		return p.element === focusEl;
	})[0];

	return picker || this.pickers[0];
};



/**
 * Default step detector
 * Step is 0.1 or 1
 */
function detectStep (min, max) {
	var range = getTransformer(function (a, b) {
		return Math.abs(a - b);
	})(max, min);

	var step = getTransformer(function (a) {
		return a < 100 ? 0.01 : 1;
	})(range);

	return step;
}


/**
 * Default value detector
 * Default value is half of range
 */
function detectValue (min, max) {
	return getTransformer(function (a, b) {
		return (a + b) * 0.5;
	})(min, max);
}