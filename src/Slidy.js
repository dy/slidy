/**
* Range input on steroids
*/
(function(global){
	function handleDrag($el, e){
		//console.log("drag observed", e.target.dragstate);
		var thumb = e.currentTarget,
			d = thumb.dragstate,
			lim = thumb.limits,
			thumbW = thumb.offsets.width,
			thumbH = thumb.offsets.height,
			//scope sizes
			hScope = (lim.right - lim.left),
			vScope = (lim.bottom - lim.top)

		//TODO: optimize this part
		//calc value based on dragstate
		if ($el.dimensions === 2){
			var normalValue = [(thumb.x - lim.left) / hScope, ( - thumb.y + lim.bottom) / vScope];
			$el.value = [
				normalValue[0] * ($el.max[0] - $el.min[0]) + $el.min[0],
				normalValue[1] * ($el.max[1] - $el.min[1]) + $el.min[1]
			];
		} else if ($el.vertical){
			var normalValue = (- thumb.y + lim.bottom) / vScope;
			$el.value = normalValue * ($el.max - $el.min) + $el.min;
		} else {
			var normalValue = (thumb.x - lim.left) / hScope;
			$el.value = normalValue * ($el.max - $el.min) + $el.min;
		}

		//console.log($el.value)

		//trigger onchange
		$el.fire("change")
	}


	//moves picker accordind to the value
	function updatePosition($el){
		var	//relative coords to move picker to
			x = 0,
			y = 0,
			picker = $el.picker,
			lim = picker.limits,
			hScope = (lim.right - lim.left),
			vScope = (lim.bottom - lim.top)

		//console.log($el.value)
		//console.log("upd position", $el.value)
		if ($el.dimensions == 2){
			var hRange = $el.max[0] - $el.min[0],
				vRange = $el.max[1] - $el.min[1],
				ratioX = ($el.value[0] - $el.min[0]) / hRange,
				ratioY = (- $el.value[1] + $el.max[1]) / vRange
			//console.log("2dim")
		} else if ($el.vertical){
			var vRange = $el.max - $el.min,
				ratioY = (- $el.value + $el.max) / vRange;
			//console.log("y", ratioY)
		} else {
			var hRange = $el.max - $el.min,
				ratioX = ($el.value - $el.min) / hRange;
			//console.log("x")
		}

		if (ratioX !== undefined) $el.picker.x = ratioX * hScope - $el.picker.pin[0];
		if (ratioY !== undefined) $el.picker.y = ratioY * vScope - $el.picker.pin[1];
		//console.log($el.picker.limits, $el.picker.x, $el.picker.y)
	}


	global['Slidy'] = Component.register('Slidy', {
		states: {
			init: {
				after: function(){
					//console.log("slidy create", this)
					//ensure picker with enough dimensions
					//TODO: take into account restrictwithin paddings

					//ensure picker's position according to the value
					//this.value = this.value;
					this.dimensions = this.value.length;

					//create enough pickers
					var self = this;
					this.picker = new Draggable({
						within: this,
						axis: this.dimensions === 2 ? null : (this.vertical ? 'y' : 'x'),
						pin: [0,0],

						ready: function(e){
							//correct pin (centrize based on width of picker)
							this.pin = [this.offsets.width / 2, this.offsets.height / 2];
							//set initial position
							updatePosition(self, self.value);
						},

						//TODO: make it be last listener in listeners stack to be preventable within own component states
						drag: function(e){
							handleDrag(self, e)
						},
						native: false
					})

					//calc initial picker limits
					this.appendChild(this.picker);
					//TODO: replace that ↓ with DOM observer
					this.picker.state = "ready";

					//TODO: bind data

				}
			},
			ready: {
				mousedown: function(e){
					this.picker.startDrag(e);
				}
			}
		},

		options: {
			//HTML5 things
			value: {
				default: 50,
				set: function(value){
					if (value.length == 2){
						value[0] = round(between(value[0], this.min[0], this.max[0]), this.step)
						value[1] = round(between(value[1], this.min[1], this.max[1]), this.step)
						return value;
					}
					return round(between(value, this.min, this.max), this.step);
				}
			},
			min: 0,
			max: 100,
			step: {
				//detect step automatically based on min/max range (1/100 by default)
				default: undefined,
				get: function(value){
					if (value === undefined) {
						//initial call
						var range;
						if (this.max.length == 2) {
							range = Math.abs(this.max[0] - this.min[0]);
						} else {
							range = Math.abs(this.max - this.min);
						}
						value = range <= 100 ? .01 : 1;
						this.step = value;
					}
					return value;
				}
			},

			//whether to expose self data to document’s scope
			//for declarative bindings
			expose: true,

			//Consider

			//Orientation
			//? multidimensinal
			//dragdealer way
			vertical: {
				default: false,
				set: function(vert){
					if (this.dimensions === 2){
						if (vert === false) this.dimensions = 1;
					} else if (this.horizontal === true){
						if (vert === true) this.horizontal = false;
					}
					return vert;
				}
			},
			horizontal: {
				default: true,
				//mutual with vertical & dimensions
				set: function(horiz){
					if (this.dimensions === 2){
						if (horiz === false) this.dimensions = 1;
					} else if (this.vertical === true){
						if (horiz === true) this.vertical = false;
					}
					return horiz;
				}
			},
			dimensions: {
				default: 1,
				//mutual with vertical/horizontal
				set: function(dim){
					if (dim === 2){
						this.vertical = true;
						this.horizontal = true;
					} else if (!dim){
						return 1;
					}
					return dim
				}
			},
			//jquery-way
			//orientation: 'horizontal',

			//Range
			//jquery-way
			range: true, //min, max

			//Multiple values
			//? multidimensional multivalues?
			//jqueryui
			//NO: use just value as array
			//values: [a,b],

			//snapping function: rigid/loose
			snap: false,
			//?or precision?

			//focusable, controllable
			keyboard: true,

			readonly: false,

			repeat: false

		}
	});
})(window)