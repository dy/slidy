/* Picker class - a picker controller.
Moved out to the external class because of has too much own properties.
NOTE: experimental class architecture:
- options are kept right on the element itself, w/o options object
- any option can be comma-separated list, cause picker may change matrix, not one value
- that way, every function working with value should handle array on input, not the single value
*/
class Picker extends HTMLCustomElement{
	constructor(el, area, opts){
		var self = super(el, opts);

		//TODO: detect if no area passed
		self.area = area;

		//TODO: (make initial coords centered) → move to initial coords
		//self.left = Math.round(self.area.center.x);
		//self.top = Math.round(self.area.center.y);

		//causes update
		/*Object.defineProperty(self, "value", {
			get: function(){return value},
			set: function(vector){
				value = vector;
				self.update();
			},
			enumerable: true,
			configurable: true
		})
		self.value = 0//o.value*/

		//the only value that picker keeps - self values
		self.x = 0//self.options.x;
		self.y = 0//self.options.y;

		self.offsetBox = getOffsetBox(self);

		//binder
		self.drag = self.drag.bind(self);
		self.dragstart = self.dragstart.bind(self);
		self.dragstop = self.dragstop.bind(self);


		return self;
	}


	/*public options = {
		x: 0,
		y: 0,
		horizontal: true,
		vertical: false,
		//repeatX: false,
		//repeatY: false
		//snap: false, //snap value to the grid
		//repeat: false, //whether to rotate infinity or cycle h/v scroll
	};*/

	//begin observing area
	startTracking(){
		this.area.addEventListener("dragstart", this.dragstart);
		this.area.addEventListener("change", this.change);
		this.offsetBox = getOffsetBox(this);
	}

	//stop observing area
	stopTracking(){
		this.area.removeEventListener("dragstart", this.dragstart);
		this.area.removeEventListener("change", this.change);
	}

	//
	dragstart(state){
		//get offset coords within thumb
		this.initOffsetX = this.offsetBox.left - state.x;
		this.initOffsetY = this.offsetBox.top - state.y;
		this.offsetBox = getOffsetBox(this);

		//if click is out of thumb - move thumb to that place
		//if (!isIn(state, this.offsetBox)){

		//}
	}

	//change tracker
	drag(state){
		var x = between(state.x - this.initOffsetX, 0, state.box.width - this.offsetBox.width);
		var y = between(state.y - this.initOffsetY, 0, state.box.height - this.offsetBox.height);

		trigger(this, "change", [x,y]);
		this.move(x, y);
	}

	dragstop(){

	}

	//just move picker to the relative coords
	move(x, y, nX, nY){
		//TODO: centrize picker

		this.style[cssPrefix + "transform"] = ["translate3d(", x, "px,", y, "px, 0)"].join("");
	}


	addEventListener(evt, fn){
		addEventListenerTo(this, evt, fn)
	}

	//returns value from current coords
	_calcValue(x, y){
		var o = this.options,
			l = 0; //length of the value [0..1]
			//TODDO: calc multiple pickers

		//get normalized(not necessary) value
		l = this.mapToL();

		//apply transfer function
		return this.transferLToValue(l, this);
	}

	//Transfers - transforms normalized l passed to the target value and vice-versa
	//return l from value
	transferValueToL(value){
		var l = [], o = this.options;
		for (var i = 0; i < this.dimensions; i++){
			var min = o.min[i],
				max = o.max[i]
			l[i] = (value[i] - min) / (max - min);
		}
		return l;
	}

	//return value from L
	transferLToValue(l){
		var v = [],
			o = this.options;
		for (var i = 0; i < this.dimensions; i++){
			var min = o.min[i],
				max = o.max[i];
			v[i] = l[i] * (max - min) + (min);
		}
		return v;
	}


	//Transforms picker & element coordinates to l.
	//l is normalized value [0..1] reflecting picker position within the area.
	//Area can be an SVG of any shape or element
	mapToL(){
		var l = [],
			o = this.options,
			area = this.area;
		for (var i = 0; i < this.dimensions; i++){
			var direction = o.direction[i];
			switch(o.direction[i]){
				case "top":
					l[i] = (1 - this.top / area.height);
					break;
				case "bottom":
					l[i] = (this.top / area.height);
					break;
				case "left":
					l[i] = (1 - this.left / area.width);
					break;
				case "right":
					l[i] = (this.left / area.width);
					break;
				default: //degrees case
					//TODO: calc degrees
			}
		}
		return l;
	}
	mapFromL(l){
		var o = this.options;

		for (var i = 0; i < this.dimensions; i++){
			var direction = o.direction[i];
			switch (direction[i]){
				case "top":
					this.top = Math.round((1-l[i]) * this.area.height);
					break;
				case "bottom":
					this.top = Math.round(l[i] * this.area.height);
					break;
				case "right":
					this.left = Math.round((l[i]) * this.area.width);
					break;
				case "left":
					this.left = Math.round((1-l[i]) * this.area.width);
					break;
			}
		}
	}
}