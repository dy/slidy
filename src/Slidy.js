/**
* Range input mod
*/
var Slidy = Mod.extend({
	init: function(){
		var self = this;

		this.picker = new Draggable({
			within: this,

			attached: function(e){
				//correct pin (centrize based on width of picker)
				this.pin = [this.offsetWidth / 2, this.offsetHeight / 2];
				// console.log("picker attached", this.pin, this.y)
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

		// console.log("slidy init")
	},

	created: function(){
		var self = this;

		// console.log("slidy created")
		this.appendChild(this.picker);

		//fire initial set
		// fire(this, "change");
	},

	attached: function(e){
		// console.log("slidy attached")
		this.updatePosition();
	},

	//HTML5 things
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

	type:{
		value: "horizontal",
		values: {
			"horizontal": {
				before: function(){
					this.picker.axis = "x";
				},

				updatePosition: function(){
					var	lim = this.picker._limits,
						hScope = (lim.right - lim.left),
						vScope = (lim.bottom - lim.top)

					var hRange = this.max - this.min,
						ratioX = (this.value - this.min) / hRange;
						ratioY = .5;

					this.picker.x = ratioX * hScope - this.picker.pin[0];
					this.picker.y = ratioY * vScope - this.picker.pin[1];
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
					this.picker.axis = "y"
				},

				updatePosition: function(){
					var	lim = this.picker._limits,
						hScope = (lim.right - lim.left),
						vScope = (lim.bottom - lim.top)

					var vRange = this.max - this.min,
						ratioX = .5,
						ratioY = (- this.value + this.max) / vRange

					this.picker.x = ratioX * hScope - this.picker.pin[0];
					this.picker.y = ratioY * vScope - this.picker.pin[1];
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
			"circular": {
				before: function(){

				}
			},
			"rectangular": {
				before: function(){
					this.picker.axis = "both"
				},

				updatePosition: function(){
					var	lim = this.picker._limits,
						hScope = (lim.right - lim.left),
						vScope = (lim.bottom - lim.top)

					var hRange = this.max[0] - this.min[0],
						vRange = this.max[1] - this.min[1],
						ratioX = (this.value[0] - this.min[0]) / hRange,
						ratioY = (- this.value[1] + this.max[1]) / vRange

					this.picker.x = ratioX * hScope - this.picker.pin[0];
					this.picker.y = ratioY * vScope - this.picker.pin[1];
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
			}
		}
	},

	updatePosition: function(){
		//undefined position updater
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
			if (this.picker) this.picker.repeat = repeat;
		}
	},

	mousedown: function(e){
		// console.log("mousedown")
		this.picker.startDrag(e);
	},

	'window resize': function(){
		this.picker.updateLimits();
		this.updatePosition()
	}
})

Slidy.register("slidy");