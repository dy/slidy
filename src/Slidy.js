/**
* Range input mod
*/
var Slidy = Mod.extend({
	init: function(){
		// console.log("init slidy")
	},

	created: function(){
		var self = this;

		//create pickers according to the number of thumbs in settings
		for (var i = 0; i < this.thumbs; i++) {
			// console.log("slidy created")
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

			//additional picker init
			this.picker.axis = (this.dimensions === 2 ? null : (this.vertical ? 'y' : 'x'));
			this.appendChild(this.picker);
		}

		//fire initial set
		fire(this, "change");
	},

	attached: function(){
		// console.log("slidy attached")
		// this.updatePosition();
	},

	//list of thumblers for range slider
	thumbs: 1,

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
			if (!result && result !== 0) err("Something went wrong in validating value", result)

			this.value = result;

			// console.log("slidy value changed", value, old, this.value)
			this.updatePosition();
			fire(this, "change")

		},
		order: 3
	},

	dimensions: {
		value: 1,
		//mutual with vertical/horizontal
		values: {
			1: function(){
				// console.log("set 1")
			},
			2: function(){
				// console.log("set 2")
				this.vertical = true;
				this.horizontal = true;
			},

			_: function(){
				return false;
			}
		},
		order: 0
	},
	vertical: {
		value: false,
		values: {
			true: function(){
				if (this.dimensions === 1) this.horizontal === false
			},
			false: function(){
				if (this.dimensions === 1) this.horizontal === true
			}
		}
	},
	horizontal: {
		value: true,
		values: {
			true: function(){
				if (this.dimensions === 1) this.vertical === false
			},
			false: function(){
				if (this.dimensions === 1) this.vertical === true
			}
		}
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
	},

	//moves picker accordind to the value
	updatePosition: function(){
		var	$el = this,
			//relative coords to move picker to
			x = 0,
			y = 0,
			picker = $el.picker;

		if(!picker) return;

		var	lim = picker._limits,
			hScope = (lim.right - lim.left),
			vScope = (lim.bottom - lim.top)

		// console.log("upd position",$el.getAttribute("name"), $el.value)
		if ($el.dimensions == 2){
			var hRange = $el.max[0] - $el.min[0],
				vRange = $el.max[1] - $el.min[1],
				ratioX = ($el.value[0] - $el.min[0]) / hRange,
				ratioY = (- $el.value[1] + $el.max[1]) / vRange
			// console.log("2dim", ratioY, ratioX)
		} else if ($el.vertical){
			var vRange = $el.max - $el.min,
				ratioY = (- $el.value + $el.max) / vRange;
				ratioX = .5;
			// console.log("y", ratioY)
		} else {
			var hRange = $el.max - $el.min,
				ratioX = ($el.value - $el.min) / hRange;
				ratioY = .5;
		}

		if (ratioX !== undefined) $el.picker.x = ratioX * hScope - $el.picker.pin[0];
		if (ratioY !== undefined) $el.picker.y = ratioY * vScope - $el.picker.pin[1];
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

		//TODO: optimize this part
		//calc value based on dragstate
		if (self.dimensions === 2){
			var normalValue = [(thumb.x - lim.left) / hScope, ( - thumb.y + lim.bottom) / vScope];

			// console.log([
			// 	normalValue[0] * (self.max[0] - self.min[0]) + self.min[0],
			// 	normalValue[1] * (self.max[1] - self.min[1]) + self.min[1]
			// ])
			self.value = [
				normalValue[0] * (self.max[0] - self.min[0]) + self.min[0],
				normalValue[1] * (self.max[1] - self.min[1]) + self.min[1]
			];

		} else if (self.vertical){
			var normalValue = (- thumb.y + lim.bottom) / vScope;
			self.value = normalValue * (self.max - self.min) + self.min;
		} else {
			var normalValue = (thumb.x - lim.left) / hScope;
			self.value = normalValue * (self.max - self.min) + self.min;
		}

		//trigger onchange
		fire(self,"change")
	}
})

Slidy.register("slidy");
