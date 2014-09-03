/**
* Range input mod
* @module  slidy
*/

var Slidy = module.exorts = Mod({



	/*                       I N I T                           */


	init: function(){
		var self = this;
		console.log("slidy init")
	},

	created: function(){
		var self = this, picker;

		console.log("slidy created");

		//fire initial set
		// fire(this, "change");
	},



	/*                       O P T I O N S                     */


	/**
	 * Placing type
	 * @enum {string}
	 * @default 'horizontal'
	 */

	type:{
		init: "horizontal",
		"horizontal": {
			before: function(){
				// console.log("before horiz", this.activePicker)
				this.setPickersOption("axis", "x");
			},

			updatePosition: function(){
				var	lim = this.activePicker._limits,
					hScope = (lim.right - lim.left),
					vScope = (lim.bottom - lim.top)

				var hRange = this.max - this.min,
					ratioX = (this.value - this.min) / hRange;
					ratioY = .5;
				this.activePicker.freeze = false;
				this.activePicker.x = ratioX * hScope - this.activePicker.pin[0];
				this.activePicker.y = ratioY * vScope - this.activePicker.pin[1];
			},

			drag: function(e){
				// console.log("drag observed", e.target.dragstate);
				var thumb = e.target,
					d = thumb.dragstate,
					lim = thumb._limits,
					thumbW = thumb._offsets.width,
					thumbH = thumb._offsets.height,
					//scope sizes
					hScope = (lim.right - lim.left),
					vScope = (lim.bottom - lim.top),
					self = this;

				var normalValue = (thumb.x - lim.left) / hScope;

				if (self.snap) self.activePicker.freeze = true;

				self.value = normalValue * (self.max - self.min) + self.min;

				//trigger onchange
				fire(self,"change")
			}
		},
		"vertical": {
			before: function(){
				this.setPickersOption("axis", "y");
			},

			updatePosition: function(){
				// console.log("upd position")
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
				// console.log("drag observed", e.target.dragstate);
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
				fire(self,"change")
			}
		},
		"rectangular": {
			before: function(){
				this.setPickersOption("axis", null);
				// console.log("before rectangular", this.activePicker)
			},

			updatePosition: function(){
				// console.log("updatePosition", this.activePicker)
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
				// console.log("drag observed", e.target.dragstate);
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
				fire(self,"change")
			}
		},
		"circular": {
			before: function(){
				this.setPickersOption("axis", null);
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
				// console.log("update position")

				this.activePicker.mute = false;

				this.activePicker.x = Math.cos(angle) * hScope/2 + hScope/2 - this.activePicker.pin[0];
				this.activePicker.y = Math.sin(angle) * vScope/2 + vScope/2 - this.activePicker.pin[1];
			},

			drag: function(e){
				// console.log("drag observed");
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

				// console.log("value changed", normalValue)
				self.activePicker.mute = true;

				//trigger onchange
				fire(self,"change", angle * 180 / Math.PI)
			}
		},
		"round": {
			before: function(){
				this.setPickersOption("axis", null);
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
				// console.log("update position", xRadius)

				this.activePicker.x = Math.cos(angle) * xRadius + hScope * .5 - this.activePicker.pin[0];
				this.activePicker.y = Math.sin(angle) * yRadius + vScope * .5 - this.activePicker.pin[1];
			},

			drag: function(e){
				// console.log("drag observed", e.target.dragstate);
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

				// console.log("value changed", self.value)

				//trigger onchange
				fire(self,"change")
			}
		}
	},


	/**
	 * Value limits
	 * @type {number}
	 */

	min: {
		//predefined value type obliges parsing recognition as a value
		init: 0,
		set: function(value){
			// console.log("set min", value, /,/.test(value))
			if (typeof value === 'string' && /,/.test(value)) return parseArray(value);
		}
	},
	max: {
		init: 100,
		set: function(value){
			// console.log("set max", value)
			if (typeof value === 'string' && /,/.test(value)) return parseArray(value);
		}
	},


	/**
	 * Minimal step to bind final value
	 */

	step: {
		init: function(value){
			var range;
			if (value !== undefined) return value;

			//detect undefined step automatically based on min/max range (1/100 by default)
			if (this.max) {
				if (this.max.length == 2) {
					range = Math.abs(this.max[0] - this.min[0]);
				} else {
					range = Math.abs(this.max - this.min);
				}
				return range <= 100 ? .01 : 1;
			} else {
				return 1;
			}
		}
	},


	/**
	 * Range mode
	 * @todo
	 */

	range: true, //min, max


	/**
	 * Snapping function
	 * @todo
	 * @note or precision?
	 */

	snap: false,


	/**
	 * Focusable, controllable
	 *
	 * @todo
	 */

	keyboard: true,


	/**
	 * Ignore sets
	 *
	 * @todo
	 */

	readonly: false,


	/**
	 * Repeat either by one axis if one dimension
	 * or by both axis or one pointed if two dimensions
	 *
	 * @enum {bool}
	 * @default true
	 */

	repeat: {
		init: false,
		changed: function(repeat){
			if (this.activePicker) this.activePicker.repeat = repeat;
		}
	},



	/*                            A P I                          */


	/**
	 * List of pickers
	 *
	 * @type {Array}
	 */

	pickers: {
		init: function(){return []}
	},


	/**
	 * Current picker value
	 * @enum {(Array|number)}
	 */

	value: {
		init: function(v){
			// console.log("init value", v, this.values)
			//predefine single value
			if (!this.values.length) this.values.push(v);

			//create pickers according to list of values
			for (var i = 0; i < this.values.length; i++){
				// console.log("add picker", i)
				this.createPicker();
			}
		},

		set: function(value, old){
			var result;

			// if (!this.activePicker) return;
			// console.log("set value", value, old)

			if (typeof value === "string" && /,/.test(value)) value = parseArray(value);

			if (value && value.length === 2) {
				result = [];
				result[0] = round(between(value[0], this.min[0], this.max[0]), this.step)
				result[1] = round(between(value[1], this.min[1], this.max[1]), this.step)
				if (!result[0] && result[0] !== 0) result[0] = old[0];
				if (!result[1] && result[1] !== 0) result[1] = old[1];
				value = result;
			}
			//one-dim value
			else {
				value = parseFloat(value);
				if (isNaN(value)) return old;

				result = round(between(value, this.min, this.max), this.step);
			}

			return result;
		},

		changed: function(val, old){
			// console.log("changed value", val, old)

			if (this.activePicker) this.values[this.activePicker.number] = val;
			else this.values[0] = val;

			this.updatePosition();

			fire(this, "change")
		}
	},


	/**
	 * Set of values for each picker
	 * @type {Array}
	 */

	values: {
		init: function(opt){
			return opt || [];
		}
	},


	/**
	 * Set option for all pickers instances
	 *
	 * @param {string} name Option name
	 * @param {*} value Option value
	 */

	setPickersOption: function(name, value){
		for (var i = 0; i < this.pickers.length; i++){
			this.pickers[i][name] = value
		}
	},


	/**
	 * Create new picker
	 *
	 * @return {Draggy} New picker created
	 */

	createPicker: function(){
		var self = this;

		var picker = document.createElement('div');

		extend(picker, {
			within: this,

			created: function(){
				// console.log("picker created", this.threshold)
			},

			attached: function(e){
				// console.log("picker attached", this.number)
				//correct pin (centrize based on width of picker)
				this.pin = [this.offsetWidth / 2, this.offsetHeight / 2];
				//set initial position
				self.activePicker = this.number;
				self.updatePosition();
				// console.groupEnd()
			},

			dragstart: function(e){
				// console.log("dstart")
				disableSelection(document.documentElement);
				css(document.documentElement, {"cursor": "none"});
			},
			dragend: function(e){
				// console.log("dend")
				enableSelection(document.documentElement);
				css(document.documentElement, {"cursor": null});
			},

			threshold: 0,

			native: false
		});

		Draggable(picker);

		picker.number = this.pickers.length;

		this.pickers.push(picker);

		this.appendChild(picker);
	},


	/**
	 * Get closest picker to the place of event
	 *
	 * @param {[type]} x [description]
	 * @param {[type]} y [description]
	 *
	 * @return {[type]} [description]
	 */

	getClosestPickerNumber: function(x,y){
		//between all pickers choose the one with closest x,y
		var minX, minY, minR = 9999, picker, minPicker;

		for (var i = 0; i < this.pickers.length; i++){
			picker = this.pickers[i];
			r = Math.sqrt( (x-picker.x-picker.pin[0])*(x-picker.x-picker.pin[0]) + (y-picker.y-picker.pin[1])*(y-picker.y-picker.pin[1]) );
			if (r < minR) {
				minR = r;
				minPicker = i;
			}
		}

		return minPicker;
	},


	/**
	 * Current picker dragging
	 *
	 * @type {Draggy}
	 */

	activePicker: {
		set: function(number){
			// console.log("set active picker", number)
			if (typeof number === "number"){
				//set value to the active picker’s value
				// console.log(this.values, this.value)

				return this.pickers[number];
			} else {
				return number
			}
		},

		changed: function(picker){
			// console.log("ap changed", picker)
			//set value to active picker’s one
			this.value = this.values[picker.number];
		}
	},



	/*                     E V E N T S                    */


	/**
	 * Always move closest picker to the place of click
	 *
	 * @param {Event} e
	 * @event
	 */

	mousedown: function(e){
		//make closest picker active
		var offsets = this.getBoundingClientRect();
		// console.log("mousedown", e.clientX - offsets.left, e.clientY - offsets.top)
		var number = this.getClosestPickerNumber(e.clientX - offsets.left, e.clientY - offsets.top);
		this.activePicker = number;

		//disable every picker but active
		var picker;
		for (var i = 0; i < this.pickers.length; i++){
			picker = this.pickers[i];
			if (picker === this.activePicker) continue;
			picker.dragstate = "idle";
		}

		//make new picker drag
		this.activePicker.startDrag(e);
	},


	/**
	 * Update pickers position on resize
	 */

	'window resize': function(){
		this.activePicker.updateLimits();
		this.updatePosition();
	}
});