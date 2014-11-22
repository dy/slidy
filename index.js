var Draggy = require('draggy');
var extend = require('extend');
var m = require('mumath');
var parse = require('muparse');
var lifecycle = require('lifecycle-events');
var state = require('st8');
var Enot = require('enot');
var Emitter = require('emmy');
var type = require('mutype');

module.exports = Slidy;



/**
* Range input component
*/
function Slidy(target, options){
	this.element = target;

	//save self refrence
	//TODO: hope this doesn’t cause leaks, test it
	this.element.slidy = this;

	options = options || {};

	//parse attributes of targret
	var prop, parseResult;
	for (var propName in Slidy.options){
		//parse attribute, if no option passed
		if (options[propName] === undefined){
			prop = Slidy.options[propName];
			options[propName] = parse.attribute(target, propName, prop && prop.init !== undefined ? prop.init : prop);
		}

		//declare initial value
		if (options[propName] !== undefined) {
			this[propName] = options[propName];
		}
	}

	//set up muting events flag
	this.mute = false;

	//define properties
	state(this, Slidy.options);

	//enable default events
	Enot.on(this.element, Slidy.events);

	//enable lifecycle events
	lifecycle.enableMutations(this.element);

	//emit callback
	this.emit('created');
}


/**
 * Events - bound via enot to element
 */
Slidy.events = {
	/**
	 * Update pickers position on the first load and resize.
	 * Note that it is concern of slidy
	 * to update picker position to correspond to the value, rather than draggy.
	 */
	'window resize:throttle(20)': 'update',

	//FIXME: this binding isn’t applicable for advanced compilation
	'attached': function(){
		// console.log('attached')

		//update picker pin & limits to update value properly
		this.slidy.pickers.forEach(function(picker){
			picker.pin = [picker.element.offsetWidth * .5, picker.element.offsetHeight * .5];
			picker.updateLimits();
		});

		//update thumb position according to the value
		this.slidy.updatePickersPosition();
	},


	/**
	 * Always move closest picker to the place of click
	 *
	 * @param {Event} e
	 * @event
	 */
	'mousedown': function(e){
		var slidy = this.slidy;

		// console.log('mdown')
		var offsets = this.getBoundingClientRect();

		//get coords relative to the container (this)
		var x = e.clientX - offsets.left;
		var y = e.clientY - offsets.top;
		//make closest picker active
		var picker = slidy.getClosestPicker(x, y);

		//make new picker drag
		if (e.target === this) {
			picker.initDragparams(e);
			picker.dragstate = 'threshold';
			picker.doDrag(e);
		}

		//move picker to the point of click with the centered drag point
		if (slidy.instant) {
			picker.x = x - picker.pin[0];
			picker.y = y - picker.pin[1];
			picker.dragparams.innerOffsetX = picker.pin[0];
			picker.dragparams.innerOffsetY = picker.pin[1];
			picker.doDrag(e);
		}

		//disable every picker except for the active one
		for (var i = slidy.pickers.length; i--;){
			if (slidy.pickers[i] === picker) continue;
			slidy.pickers[i].dragstate = 'idle';
		}
	},

	/** Keep value updated */
	'drag': function(e){
		// console.group('drag')
		this.slidy.updateValue(e);
		// console.groupEnd();
	},

	/** Update pickers position on end*/
	'dragend': function(e){
		this.slidy.updatePickersPosition();
	}
};


/**
 * Redefinable options
 */
Slidy.options = {
	/** Move to the point of click always, centered by pin */
	instant: false,

	/** Value limits
	 * @type {number}
	 */
	min: 0,
	max: 100,

	/** Pointer for number of dimensions */
	dim: 0,

	/** Placing type
	 * @enum {string}
	 * @default 'horizontal'
	 */
	type:{
		init: 'horizontal',
		horizontal: {
			before: function(){
				this.setPickersOption('axis', 'x');
			},

			dim: 1,

			//place pickers according to the values
			updatePickerPosition: function(picker){
				var	lims = picker.limits,
					hScope = (lims.right - lims.left),
					vScope = (lims.bottom - lims.top);

				var hRange = this.max - this.min,
					ratioX = (this.value - this.min) / hRange,
					ratioY = .5;

				picker.x = ratioX * hScope - picker.pin[0];
				picker.y = ratioY * vScope - picker.pin[1];
			},

			//round value on each drag
			updateValue: function(e){
				var draggy = e.target.draggy,
					lim = draggy.limits,
					draggyW = draggy.offsetWidth,
					draggyH = draggy.offsetHeight,
					//scope sizes
					hScope = (lim.right - lim.left),
					vScope = (lim.bottom - lim.top),
					self = this;

				var normalValue = (draggy.x - lim.left) / hScope;
				// console.group('updValue');
				self.value = normalValue * (self.max - self.min) + self.min;
				// console.groupEnd();
			}
		},
		vertical: {
			//TODO
			before: function(){
				this.setPickersOption('axis', 'y');
			},

			dim: 1,

			updatePickerPosition: function(picker){
				var	lims = picker.limits,
					hScope = (lims.right - lims.left),
					vScope = (lims.bottom - lims.top);

				var vRange = this.max - this.min,
					ratioX = .5,
					ratioY = (- this.value + this.max) / vRange

				picker.x = ratioX * hScope - picker.pin[0];
				picker.y = ratioY * vScope - picker.pin[1];
			},

			updateValue: function(e){
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

				var normalValue = (- draggy.y + lim.bottom) / vScope;
				self.value = normalValue * (self.max - self.min) + self.min;
			}
		},
		rectangular: {
			before: function(){
				this.setPickersOption('axis', null);
			},

			dim: 2,

			updatePickerPosition: function(picker){
				// console.log('updatePosition', picker)
				var	lim = picker.limits,
					hScope = (lim.right - lim.left),
					vScope = (lim.bottom - lim.top)

				var hRange = this.max[0] - this.min[0],
					vRange = this.max[1] - this.min[1],
					ratioX = (this.value[0] - this.min[0]) / hRange,
					ratioY = (- this.value[1] + this.max[1]) / vRange;

				picker.x = ratioX * hScope - picker.pin[0];
				picker.y = ratioY * vScope - picker.pin[1];
			},

			updateValue: function(e){
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

				self.value = [
					normalValue[0] * (self.max[0] - self.min[0]) + self.min[0],
					normalValue[1] * (self.max[1] - self.min[1]) + self.min[1]
				];
			}
		},
		circular: {
			before: function(){
				this.setPickersOption('axis', null);
			},

			dim: 1,

			updatePickerPosition: function(picker){
				// console.log('upd position')
				var	lim = picker.limits,
					hScope = (lim.right - lim.left),
					vScope = (lim.bottom - lim.top),
					centerX = hScope / 2,
					centerY = vScope / 2;

				var range = this.max - this.min;
				var	normalValue = (this.value - this.min) / range;
				var angle = (normalValue - .5) * 2 * Math.PI;

				picker.freeze = false;

				picker.x = Math.cos(angle) * hScope/2 + hScope/2 - picker.pin[0];
				picker.y = Math.sin(angle) * vScope/2 + vScope/2 - picker.pin[1];
				// console.log(picker.x, picker.element.style.transform)
				picker.freeze = true;
			},

			updateValue: function(e){
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
				self.value = normalValue * (self.max - self.min) + self.min;
			}
		},
		round: {
			before: function(){
				this.setPickersOption('axis', null);
			},

			dim: 2,

			updatePickerPosition: function(picker){
				// console.log('upd position')
				var	lim = picker.limits,
					hScope = (lim.right - lim.left),
					vScope = (lim.bottom - lim.top),
					centerX = hScope / 2,
					centerY = vScope / 2;

				//get angle normal value
				var aRange = this.max[0] - this.min[0];
				var	normalAngleValue = (this.value[0] - this.min[0]) / aRange;
				var angle = (normalAngleValue - .5) * 2 * Math.PI;

				//get radius normal value
				var rRange = this.max[1] - this.min[1];
				var normalRadiusValue = (this.value[1] - this.min[1]) / rRange;
				// console.log(this.value[1])
				var xRadius = hScope * normalRadiusValue / 2;
				var yRadius = vScope * normalRadiusValue / 2;

				//TODO: set coords from value
				// console.log('update position', xRadius)

				picker.x = Math.cos(angle) * xRadius + hScope * .5 - picker.pin[0];
				picker.y = Math.sin(angle) * yRadius + vScope * .5 - picker.pin[1];
			},

			updateValue: function(e){
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
				self.value = [
					normalAngleValue * (self.max[0] - self.min[0]) + self.min[0],
					normalRadiusValue * (self.max[1] - self.min[1]) + self.min[1]
				];
			}
		}
	},


	/** Minimal step to bind final value
	 */
	step: {
		init: function(value){
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
	},


	/** Range mode
	 * @todo
	 */
	range: true, //min, max


	/** Snapping function
	 * @todo
	 * @note or precision?
	 */
	snap: false,


	/** Focusable, controllable
	 *
	 * @todo
	 */
	keyboard: true,


	/** Ignore sets
	 *
	 * @todo
	 */
	readonly: false,


	/** Repeat either by one axis if one dimension
	 * or by both axis or one pointed if two dimensions
	 *
	 * @enum {bool}
	 * @default true
	 */
	repeat: {
		init: false,
		changed: function(repeat){
		}
	},


	/** List of pickers
	 *
	 * @type {Array}
	 */
	pickers: {
		//create initial number of pickers
		//NOTE: don’t place it into value: it changes very often so causes heavy recalc
		init: function(v){
			//create initial pickers
			//NOTE: ensure at least on picker exists
			var pickers = this.pickers = [this.createPicker()];

			//create number of pickers according to the value dimension
			//FIXME: take into account dims/values
			if (type.isArray(this.value) && this.dim === 1) {
				for (var i = 1, l = this.value.length; i < l; i++){
					pickers.push(this.createPicker());
				}
			}

			return pickers;
		}
	},


	/**
	 * Add this class to each picker
	 */
	pickerClass: 'slidy-picker',


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
	value: {
		//TODO: fix case where native picker is a target (polyfill or extend)

		set: function(value, old){
			var result;
			// console.log('setval', value)

			//FIXME: what is this for?
			value = value !== undefined ? value : this.min;

			//clamp values
			result = m.between(value, this.min, this.max);
			result = m.toPrecision(result, this.step);

			// console.groupEnd()

			return result;
		},

		changed: function(val, old){
			if (!this.mute) {
				//trigger change every time value changes
				this.emit('change');
				Emitter.emit(this.element, 'change', null, true);
			}

			// console.log('val changed', val, old)

			//update pickers position to the new value
			//NOTE: this may be moved to dragend in performance reasons
			//FIXME: this causes limitless initial setx
			this.updatePickersPosition();
		}
	},


	/** Callbacks */
	change: null
};



/* ------------------------------  A  P  I  ------------------------------------------ */


var SlidyProto = Enot(Slidy.prototype);


/**
 * Set option for all picker instances or call method
 *
 * @param {string} name Option name
 * @param {*} value Option value
 */
SlidyProto.setPickersOption = function(name, value){
	for (var i = this.pickers.length; i--;){
		this.pickers[i][name] = value;
	}
};


/**
 * Create a new picker
 *
 * @return {Draggy} New picker created
 */
SlidyProto.createPicker = function(){
	var self = this;

	var $picker = document.createElement('div');
	$picker.className = this.pickerClass;

	//create picker
	var picker = new Draggy($picker, {
		within: this.element,
		pin: false,
		hideCursor: true,
		threshold: 0
	});

	this.element.appendChild($picker);
	picker.updateLimits();

	return picker;
};


/**
 * Get closest picker to the place of event
 *
 * @param {[type]} x [description]
 * @param {[type]} y [description]
 *
 * @return {[type]} [description]
 */
SlidyProto.getClosestPicker = function(x,y){
	//between all pickers choose the one with closest x,y
	var minX, minY, minR = 9999, picker, minPicker;

	for (var i = 0, r; i < this.pickers.length; i++){
		picker = this.pickers[i];
		r = Math.sqrt( (x-picker.x-picker.pin[0])*(x-picker.x-picker.pin[0]) + (y-picker.y-picker.pin[1])*(y-picker.y-picker.pin[1]) );
		if (r < minR) {
			minR = r;
			minPicker = picker;
		}
	}

	return minPicker;
};


/** Go by all pickers, update their’s limits & position
 */
SlidyProto.updatePickersPosition = function(){
	var pickers = this.pickers;
	for (var i = 0, l = pickers.length; i<l; i++){
		this.updatePickerPosition(pickers[i]);
	}
};