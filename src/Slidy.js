/**
* Range input mod
*/
var Slidy = Mod.extend({
	init: function(){
		var self = this;
		console.log("slidy init")
	},

	pickers: [],
	//number of thumbs
	thumbs: 1,

	created: function(){
		var self = this, picker;

		console.log("slidy created");

		//fire initial set
		// fire(this, "change");
	},

	attached: function(e){
		console.log("slidy attached")
		this.updatePosition();
	},

	value: {
		change: function(value, old){
			var result;

			// console.log("slidy set value", value, old)
			if (typeof value === "string" && /,/.test(value)) value = parseArray(value);

			if (value && value.length === 2) {
				result = [];
				result[0] = round(between(value[0], this.min[0], this.max[0]), this.step)
				result[1] = round(between(value[1], this.min[1], this.max[1]), this.step)
				if (!result[0] && result[0] !== 0) result[0] = old[0];
				if (!result[1] && result[1] !== 0) result[1] = old[1];
				value = result;
			} else {
				value = parseFloat(value) ? value : 0;
				result = round(between(value, this.min, this.max), this.step);
			}
			if (!result && result !== 0) throw Error("Something went wrong in validating value", result)
			this.value = result;

			this.updatePosition();

			fire(this, "change")
		},
		order: 3
	},

	//placing type
	type:{
		value: "horizontal",

		init: function(){
			var self = this;

			// console.log("init type", this.thumbs)
			//create pickers according to the thumbs
			for (var i = 0; i < this.thumbs; i++){
				// console.log("add picker", i)
				this.createPicker();
			}
		},

		values: {
			"horizontal": {
				before: function(){
					// console.log(this.activePicker)
					this.setPickersOption("axis", "x");
				},

				updatePosition: function(){
					var	lim = this.activePicker._limits,
						hScope = (lim.right - lim.left),
						vScope = (lim.bottom - lim.top)

					var hRange = this.max - this.min,
						ratioX = (this.value - this.min) / hRange;
						ratioY = .5;

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
				},

				updatePosition: function(){
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
					// console.log("update position", normalValue)

					this.activePicker.x = Math.cos(angle) * hScope/2 + hScope/2 - this.activePicker.pin[0];
					this.activePicker.y = Math.sin(angle) * vScope/2 + vScope/2 - this.activePicker.pin[1];
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
					var xRadius = hScope * normalRadiusValue
					var yRadius = vScope * normalRadiusValue

					//TODO: set coords from value
					// console.log("update position", normalValue)

					this.activePicker.x = Math.cos(angle) * xRadius + hScope * .5 - this.activePicker.pin[0];
					this.activePicker.y = Math.sin(angle) * yRadius + hScope * .5 - this.activePicker.pin[1];
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

					var x = thumb.x - hScope / 2;
					var y = thumb.y - vScope / 2;

					//get angle
					var angle = Math.atan2( y, x )

					//get normal value
					var normalAngleValue = (angle / 2 / Math.PI + .5);
					var normalRadiusValue = Math.sqrt( x*x + y*y ) / hScope;
					// console.log(normalRadiusValue)

					//get value from coords
					self.value = [
						normalAngleValue * (self.max[0] - self.min[0]) + self.min[0],
						normalRadiusValue * (self.max[1] - self.min[1]) + self.min[1]
					]

					// console.log("value changed", normalRadiusValue * (self.max[1] - self.min[1]) + self.min[1])

					//trigger onchange
					fire(self,"change", angle * 180 / Math.PI)
				}
			}
		}
	},

	updatePosition: function(){
		//undefined position updater
	},

	//set option for all pickers instances
	setPickersOption: function(name, value){
		for (var i = 0; i < this.pickers.length; i++){
			this.pickers[i][name] = value
		}
	},

	//create new picker
	createPicker: function(){
		var self = this;

		this.activePicker = new Draggable({
			within: this,

			attached: function(e){
				// console.log("picker attached", this.pin, this.y)
				//correct pin (centrize based on width of picker)
				this.pin = [this.offsetWidth / 2, this.offsetHeight / 2];
				//set initial position
				self.updatePosition();
			},

			dragstart: function(e){
				//console.log("dstart")
				disableSelection(document.documentElement);
				css(document.documentElement, {"cursor": "none"});
			},
			dragend: function(e){
				//console.log("dend")
				enableSelection(document.documentElement);
				css(document.documentElement, {"cursor": null});
			},

			native: false
		});

		this.pickers.push(this.activePicker);

		// console.log("slidy created")
		this.appendChild(this.activePicker);
	},

	//value limits
	min: {
		//predefined value type obliges parsing recognition as a value
		value: 0,
		change: function(value){
			// console.log("set min", value, /,/.test(value))
			if (typeof value === 'string' && /,/.test(value)) return parseArray(value);
		},
		order: 0
	},
	max: {
		value: 100,
		change: function(value){
			// console.log("set max", value)
			if (typeof value === 'string' && /,/.test(value)) return parseArray(value);
		},
		order: 0
	},
	step: {
		value: 1,

		//detect step automatically based on min/max range (1/100 by default)
		init: function(value){
			//initial call
			var range;
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
		},

		order: 2
	},

	//TODO Range
	//jquery-way
	range: true, //min, max

	//TODO snapping function: rigid/loose
	snap: false,
	//?or precision?

	//TODO: focusable, controllable
	keyboard: true,

	//TODO
	readonly: false,

	//TODO whether to repeat either by one axis if one dimension or by both axis or one pointed if two dimensions
	//false, true, [bool, bool]
	repeat: {
		value: false,
		change: function(repeat){
			if (this.activePicker) this.activePicker.repeat = repeat;
		}
	},

	//get closest picker to the place of event
	getClosestPicker: function(x,y){
		//between all pickers choose the one with closest x,y
		var minX, minY, minR = 9999, picker, minPicker;

		for (var i = 0; i < this.pickers.length; i++){
			picker = this.pickers[i];
			r = Math.sqrt( (x-picker.x)*(x-picker.x) + (y-picker.y)*(y-picker.y) );
			if (r < minR) {
				minR = r;
				minPicker = picker;
			}
		}

		return minPicker;
	},

	//-------interaction
	mousedown: function(e){
		var offsets = this.getBoundingClientRect();
		// console.log("mousedown", e.clientX - offsets.left, e.clientY - offsets.top)
		this.activePicker = this.getClosestPicker(e.clientX - offsets.left, e.clientY - offsets.top);
		this.activePicker.startDrag(e);
	},

	'window resize': function(){
		this.activePicker.updateLimits();
		this.updatePosition()
	}
})

Slidy.register("slidy");