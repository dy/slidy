/* Picker class - a picker controller.
Moved out to the external class because of has too much own properties.
NOTE: experimental class architecture:
- options are kept right on the element itself, w/o options object
- any option can be comma-separated list, cause picker may change matrix, not one value
- that way, every function working with value should handle array on input, not the single value 
*/
function Picker(el, container, opts){
	this._create.apply(this, arguments);
}


//Prototype
Picker.prototype = {
	options: {
		direction: "right", //keywords, degrees or array of ones //TODO: replace direction with custom function
		placingFn: "linear",
		mappingFn: "linear", //x,y → normalized l (or [l1, l2])
		transferFn: "linear", //can pass array of functions for each coordinate
		step: 10,
		min: 0,
		max: 100,
		value: 0,
		snap: false, //snap value to the grid
		rigidSnap: false, //whether to snap straightforward or smoother drop effect
		restrict: true, //whether to restrict picker moving area
		grid: false, //or array of grid coords to snap
		repeat: false, //whether to rotate infinity or cycle h/v scroll
		altPicker: null //pickers changing values along with one
	},

	_create: function(el, container, opts){
		this.el = el;
		this.container = container;

		//make options
		this.options = extend({}, this.options, parseDataAttributes(el, true), opts);
		var o = this.options;

		//detect maximum dimensions needed from options
		this.dimensions = 1;
		for (var opt in o){
			if (o[opt] instanceof Array){
				if (o[opt].length > this.dimensions){
					this.dimensions = o[opt].length;
				}
			}
		}

		//make initial coords centered		
		this.left = Math.round(this.container.center.x);
		this.top = Math.round(this.container.center.y);

		//init coords based on value passed
		this.setValue(o.value);
	},

	//move, changevalue and trigger changing
	//x & y are coords relative to sliding area
	to: function(x, y){
		var o = this.options;
		var to = Picker.placingFn[o.placingFn](x, y, this);

		if (this.altPickers && this.altPickers.length){
			//console.log(to)
			extend(to, this.altPicker.options.placingFn(x, y, this.altPicker));
			//console.log(to)
		}

		if (to.y !== undefined) this.top = to.y;
		if (to.x !== undefined) this.left = to.x;

		this.move(this.left, this.top);

		this.value = this._calcValue(this.top, this.left);

		if (this.altPicker){
			this.altPicker.top = this.top;
			this.altPicker.left = this.left;
			this.altPicker.value = this.altPicker._calcValue(this.top, this.left);
		}
		
		this._triggerChange();

		return to;
	},

	//just move picker to the relative coords
	move: function(left, top){
		this.el.style[cssPrefix + "transform"] = ["translate3d(", left, "px,", top, "px, 0)"].join("");
	},

	//make position reflect value
	update: function(){
		var o = this.options;
		var l = Picker.transferFn[o.transferFn].fromValue(this.value, this);
		Picker.mappingFn[o.mappingFn].fromL(l, this);
		this.move(this.left, this.top);
		this._triggerChange();
	},

	dragstart: function(dragstate){
		this.to(dragstate.x, dragstate.y);		
	},

	drag: function(dragstate){
		this.to(dragstate.x, dragstate.y);
	},

	_triggerChange: function(){
		this._trigger("change",{
			value: this.value,
			altValue: this.altPicker && this.altPicker.value,
			picker: this,
			altPicker: this.altPicker,
			container: this.container,
			options: this.o
		})
	},


	_trigger: function(evName, args){
		//callbacks
		if (this.options[evName]) this.options[evName].call(this, args);
		if (this.container.options[evName]) this.container.options[evName].call(this, args);

		//event
		var evt = new CustomEvent(evName, {detail: args});
		this.el.dispatchEvent(evt);
	},


	//returns value from current coords
	_calcValue: function(x, y){
		var o = this.options,
			l = 0; //length of the value [0..1]
			//TODDO: calc multiple pickers

		//get normalized(not necessary) value
		l = Picker.mappingFn[o.mappingFn].toL(this);

		//apply transfer function
		return Picker.transferFn[o.transferFn].toValue(l, this);
	},


	getValue: function(){
		return this.value;
	},

	setValue: function(value){
		var o = this.options;
		this.value = value;
		this.update();
	}
};

//Static
extend(Picker, {
	//Functions of placing picker based on dragstate
	//Main value-forming function: value is obtained based on new picker coords calculated by this function
	//returns picker coords
	placingFn: {
		circular: function(){

		},
		conical: function(){

		},
		linear: function(x,y, picker){
			var to = {},
				container = picker.container,
				o = picker.options;

			//test bounds
			for (var i = 0; i < picker.dimensions; i++){
				var direction = o.direction[i] || Picker.prototype.options.direction;
				switch (direction){
					case "top":
					case "bottom":
						if (y <= 0){
							to.y = 0;
						} else if (y >= container.height){
							to.y = container.height;				
						} else {
							to.y = y;
							to.y = limit(to.y, 0, container.height);
						}
						break;
					case "left":
					case "right":
						if (x <= 0){
							to.x = 0;
						} else if (x >= container.width){
							to.x = container.width;				
						} else {
							to.x = x;
							to.x = limit(to.x, 0, container.width);
						}
						break;
				}
			}

			return to;
		},
		free: function(){

		},
		repeat: function(x, y, picker){
			var to = {},
				container = picker.container,
				o = picker.options,
				tx = x % container.width,
				ty = y % container.height;

			tx += (tx < 0 ? container.width : 0);
			ty += (ty < 0 ? container.height : 0);

			switch (o.direction){
				case "top":
				case "bottom":
					to.y = ty;
					break;
				case "left":
				case "right":
					to.x = tx;
					break;
			}

			return to;
		}
	},

	//Transforms picker & element to the l value, or couple of l for multiple dimensions.
	//l is normalized value [0..1] reflecting picker position within the area.
	//Area can be an SVG of any shape or element
	//picker & area - class instances, not DOM-elements
	//out == based on l passed set coords of picker
	//NOTE: 2d can be passed in options
	mappingFn: {
		linear: {
			toL: function(picker){
				var l = [],
					o = picker.options,
					container = picker.container;
				for (var i = 0; i < picker.dimensions; i++){
					switch(o.direction[i]){
						case "top":
							l.push(1 - picker.top / container.height);
							break;
						case "bottom":
							l.push(picker.top / container.height);
							break;
						case "left":
							l.push(1 - picker.left / container.width);
							break;
						case "right":
							l.push(picker.left / container.width);
							break;
						default: //degrees case
							//TODO: calc degrees
					}
				}
				return l;
			},
			fromL: function(l, picker){
				var o = picker.options;

				for (var i = 0; i < picker.dimensions.length; i++){
					var direction = o.direction[i] || Picker.prototype.options.direction;
					switch (direction){
						case "top":
							picker.top = Math.round((1-l) * picker.container.height);
							break;
						case "bottom":
							picker.top = Math.round(l * picker.container.height);
							break;
						case "right":
							picker.left = Math.round((l) * picker.container.width);
							break;
						case "left":
							picker.left = Math.round((1-l) * picker.container.width);
							break;
					}
				}
			}
		},
		polar: {
			toL: function(picker){
				//TODO
				throw "unimplemented";
			},
			fromL: function(picker){
				//TODO
				throw "unimplemented";
			}
		},
		svg: {
			to: function(){

			},
			from: function(){

			}
		}
	},

	//Transforms normalized l passed to the target value and vice-versa
	//moved out of mappingFn cause to combine with mappingFn and cause 
	transferFn: {
		linear: {
			toValue: function(l, picker){
				var v = [],
					o = picker.options;
				for (var i = 0; i < picker.dimensions; i++){
					var min = o.min[i] || Picker.prototype.options.min,
						max = o.max[i] || Picker.prototype.options.max
					v.push(l[i] * (max - min) + (min));
				}
				return v;
			},
			fromValue: function(value, picker){
				var l = [],
					o = picker.options;
				for (var i = 0; i < value.length; i++){
					var min = o.min[i] || Picker.prototype.options.min,
						max = o.max[i] || Picker.prototype.options.max
					l.push((value[i] - min) / (max - min));
				}
				return l;
			}
		},

		quadratic: {
			toValue: function(){

			},
			fromValue: function(){

			}
		},

		cubic: function(){
			//TODO
		},

		logarithmic: function(){
			//TODO
		}
	}
});