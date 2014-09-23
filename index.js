var Draggy = require('draggy');
var extend = require('extend');
var m = require('mumath');
var parse = require('muparse');
var lifecycle = require('lifecycle-events');


/**
* Range input component
* @module  slidy
*/
var Slidy = module.exorts = Mod({



/* ---------------------------------  i  N  I  t  ------------------------------------ */


	init: function(){
		var self = this;
	},

	created: function(){
		var self = this, picker;
		// console.log('slidy created');

		//fire initial set
		// fire(this, 'change');

		//enable lifecycle events
		lifecycle.enableMutations(this);
	},


	/**
	 * Update pickers position on the first load and resize.
	 * Note that it is concern of slidy
	 * to update picker position to correspond to the value, rather than draggy.
	 */
	'window resize:throttle(20)': 'update',
	attached: function(){
		//update picker pin & limits to update value properly
		//draggy updates self limits & pins only on the first drag, so need to do it before
		this.setPickersOption('pin', false);
		this.setPickersOption('limits', this);

		//update thumb position according to the value
		this.update();
	},


	/**
	 * Always move closest picker to the place of click
	 *
	 * @param {Event} e
	 * @event
	 */
	mousedown: function(e){
		var offsets = this.getBoundingClientRect();

		//get coords relative to the container (this)
		var x = e.clientX - offsets.left;
		var y = e.clientY - offsets.top;

		//make closest picker active
		var picker = this.getClosestPicker(x, y);

		//move picker to the point of click with the centered drag point
		picker.x = x - picker.pin[0];
		picker.y = y - picker.pin[1];

		//disable every picker except for the active one
		for (var i = this.pickers.length; i--;){
			if (this.pickers[i] === this.activePicker) continue;
			this.pickers[i].dragstate = 'idle';
		}

		//make new picker drag
		picker.mousedown(e);
	},



/* -------------------------------  O  p  t  i  o  n  S  ----------------------------- */


	/** Placing type
	 * @enum {string}
	 * @default 'horizontal'
	 */
	type:{
		init: 'horizontal',
		horizontal: {
			before: function(){
				// console.log('before horiz', this.activePicker)
				this.setPickersOption('axis', 'x');
			},

			//place pickers according to the values
			updatePicker: function(picker){
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
			drag: function(e){
				// console.log('drag observed', e.target.dragstate);
				var thumb = e.target,
					lim = thumb.limits,
					thumbW = thumb.offsetWidth,
					thumbH = thumb.offsetHeight,
					//scope sizes
					hScope = (lim.right - lim.left),
					vScope = (lim.bottom - lim.top),
					self = this;

				var normalValue = (thumb.x - lim.left) / hScope;
				if (self.snap) self.activePicker.freeze = true;

				self.value = normalValue * (self.max - self.min) + self.min;
			}
		},
		'vertical': {
			//TODO
			before: function(){
				this.setPickersOption('axis', 'y');
			},

			updatePosition: function(){
				// console.log('upd position')
				var	lim = this.activePicker._limits,
					hScope = (lim.right - lim.left),
					vScope = (lim.bottom - lim.top)

				var vRange = this.max - this.min,
					ratioX = .5,
					ratioY = (- this.value + this.max) / vRange

				this.activePicker.x = ratioX * hScope - this.activePicker.pin[0];
				this.activePicker.y = ratioY * vScope - this.activePicker.pin[1];
			},

			drag: function(e){
				// console.log('drag observed', e.target.dragstate);
				var thumb = e.target,
					d = thumb.dragstate,
					lim = thumb._limits,
					thumbW = thumb._offsets.width,
					thumbH = thumb._offsets.height,
					//scope sizes
					hScope = (lim.right - lim.left),
					vScope = (lim.bottom - lim.top),
					self = this;

				var normalValue = (- thumb.y + lim.bottom) / vScope;
				self.value = normalValue * (self.max - self.min) + self.min;

				//trigger onchange
				fire(self,'change')
			}
		},
		'rectangular': {
			before: function(){
				this.setPickersOption('axis', null);
				// console.log('before rectangular', this.activePicker)
			},

			updatePosition: function(){
				// console.log('updatePosition', this.activePicker)
				var	lim = this.activePicker._limits,
					hScope = (lim.right - lim.left),
					vScope = (lim.bottom - lim.top)

				var hRange = this.max[0] - this.min[0],
					vRange = this.max[1] - this.min[1],
					ratioX = (this.value[0] - this.min[0]) / hRange,
					ratioY = (- this.value[1] + this.max[1]) / vRange

				this.activePicker.x = ratioX * hScope - this.activePicker.pin[0];
				this.activePicker.y = ratioY * vScope - this.activePicker.pin[1];
			},

			drag: function(e){
				// console.log('drag observed', e.target.dragstate);
				var thumb = e.target,
					d = thumb.dragstate,
					lim = thumb._limits,
					thumbW = thumb._offsets.width,
					thumbH = thumb._offsets.height,
					//scope sizes
					hScope = (lim.right - lim.left),
					vScope = (lim.bottom - lim.top),
					self = this;

				var normalValue = [(thumb.x - lim.left) / hScope, ( - thumb.y + lim.bottom) / vScope];

				self.value = [
					normalValue[0] * (self.max[0] - self.min[0]) + self.min[0],
					normalValue[1] * (self.max[1] - self.min[1]) + self.min[1]
				];

				//trigger onchange
				fire(self,'change')
			}
		},
		'circular': {
			before: function(){
				this.setPickersOption('axis', null);
			},

			updatePosition: function(){
				var	lim = this.activePicker._limits,
					hScope = (lim.right - lim.left),
					vScope = (lim.bottom - lim.top),
					centerX = hScope / 2,
					centerY = vScope / 2;

				var range = this.max - this.min;
				var	normalValue = (this.value - this.min) / range;
				var angle = (normalValue - .5) * 2 * Math.PI;

				//TODO: set coords from value
				// console.log('update position')

				this.activePicker.mute = false;

				this.activePicker.x = Math.cos(angle) * hScope/2 + hScope/2 - this.activePicker.pin[0];
				this.activePicker.y = Math.sin(angle) * vScope/2 + vScope/2 - this.activePicker.pin[1];
			},

			drag: function(e){
				// console.log('drag observed');
				var thumb = e.target,
					d = thumb.dragstate,
					lim = thumb._limits,
					thumbW = thumb._offsets.width,
					thumbH = thumb._offsets.height,
					//scope sizes
					hScope = (lim.right - lim.left),
					vScope = (lim.bottom - lim.top),
					self = this;

				var x = thumb.x - hScope / 2;
				var y = thumb.y - vScope / 2;

				//get angle
				var angle = Math.atan2( y, x )

				//get normal value
				var normalValue = (angle / 2 / Math.PI + .5);
				// console.log(normalValue)

				//get value from coords
				self.value = normalValue * (self.max - self.min) + self.min

				// console.log('value changed', normalValue)
				self.activePicker.mute = true;

				//trigger onchange
				fire(self,'change', angle * 180 / Math.PI)
			}
		},
		'round': {
			before: function(){
				this.setPickersOption('axis', null);
			},

			updatePosition: function(){
				var	lim = this.activePicker._limits,
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
				var xRadius = hScope * normalRadiusValue / 2
				var yRadius = vScope * normalRadiusValue / 2

				//TODO: set coords from value
				// console.log('update position', xRadius)

				this.activePicker.x = Math.cos(angle) * xRadius + hScope * .5 - this.activePicker.pin[0];
				this.activePicker.y = Math.sin(angle) * yRadius + vScope * .5 - this.activePicker.pin[1];
			},

			drag: function(e){
				// console.log('drag observed', e.target.dragstate);
				var thumb = e.target,
					d = thumb.dragstate,
					lim = thumb._limits,
					thumbW = thumb._offsets.width,
					thumbH = thumb._offsets.height,
					//scope sizes
					hScope = (lim.right - lim.left),
					vScope = (lim.bottom - lim.top),
					self = this;

				var x = thumb.x + thumb.pin[0] - hScope / 2;
				var y = thumb.y + thumb.pin[1] - vScope / 2;

				//get angle
				var angle = Math.atan2( y, x )

				//get normal value
				var normalAngleValue = (angle / 2 / Math.PI + .5);
				var normalRadiusValue = Math.sqrt( x*x + y*y ) / hScope * 2;
				// console.log(normalAngleValue, normalRadiusValue)

				//get value from coords
				self.value = [
					normalAngleValue * (self.max[0] - self.min[0]) + self.min[0],
					normalRadiusValue * (self.max[1] - self.min[1]) + self.min[1]
				]

				// console.log('value changed', self.value)

				//trigger onchange
				fire(self,'change')
			}
		}
	},


	/** Value limits
	 * @type {number}
	 */
	min: {
		//predefined value type obliges parsing recognition as a value
		init: 0
	},
	max: {
		init: 100
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



/* ------------------------------  A  P  I  ------------------------------------------ */


	/** List of pickers
	 *
	 * @type {Array}
	 */
	pickers: {
		//create initial number of pickers
		//NOTE: don’t place it into value: it will cause extra recalcs
		init: function(v){
			//create initial pickers
			var pickers = this.pickers = [];

			//create number of pickers according to the value dimension
			if (type.isArray(this.value)) {
				for (var i = 0, l = this.value.length; i < l; i++){
					pickers.push(this.createPicker());
				}
			} else {
				pickers.push(this.createPicker());
			}

			return pickers;
		}
	},


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
		//TODO: fix case where native picker is a target (polyfill or extend).
		//detect number of pickers based on initial value
		init: function(v){
			var value;
			// console.log('init value', v, this.values)

			//if value is array-like - create n-dim array (suppose that multipickers are passed in another way)
			if (type.isString(v) && /,/.test(v)) {
				value = parse.array(v);
			}

			//else suppose single value
			else {
				value = parseFloat(v) || 0;
			}

			return value;
		},

		set: function(value, old){
			var result;

			//clamp values
			result = m.between(value, this.min, this.max);
			result = m.toPrecision(result, this.step);

			return result;
		},

		changed: function(val, old){
			// console.log('changed value', val, old)

			//update pickers position to the new value
			//this.update();

			//trigger change every time value changes
			this.emit('change');
		}
	},


	/**
	 * Set option for all picker instances
	 *
	 * @param {string} name Option name
	 * @param {*} value Option value
	 */
	setPickersOption: function(name, value){
		for (var i = this.pickers.length; i--;){
			this.pickers[i][name] = value;
		}
	},


	/**
	 * Create a new picker
	 *
	 * @return {Draggy} New picker created
	 */
	createPicker: function(){
		var self = this;

		var picker = Draggy({
			within: this,
			pin: false
		});

		this.appendChild(picker);

		return picker;
	},


	/**
	 * Get closest picker to the place of event
	 *
	 * @param {[type]} x [description]
	 * @param {[type]} y [description]
	 *
	 * @return {[type]} [description]
	 */
	getClosestPicker: function(x,y){
		//between all pickers choose the one with closest x,y
		var minX, minY, minR = 9999, picker, minPicker;

		for (var i = 0; i < this.pickers.length; i++){
			picker = this.pickers[i];
			r = Math.sqrt( (x-picker.x-picker.pin[0])*(x-picker.x-picker.pin[0]) + (y-picker.y-picker.pin[1])*(y-picker.y-picker.pin[1]) );
			if (r < minR) {
				minR = r;
				minPicker = picker;
			}
		}

		return minPicker;
	},



	/**
	 * Go by all pickers, update their’s limits & position
	 */
	update: function(){
		var pickers = this.pickers;
		for (var i = 0, l = pickers.length; i<l; i++){
			this.updatePicker(pickers[i]);
		}
	}
});