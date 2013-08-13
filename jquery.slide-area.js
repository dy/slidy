(function($){
	var $wnd = $(window),
		$doc = $(window.document),
		$body = $(window.document.body);

	var pluginName = "slideArea",
		className = "slide-area",
		cssPrefix = detectCSSPrefix();

	//Main plugin class
	function Area(el, opts){
		this.element = el;
		this._create(opts)
	}

	Area.prototype = {
		options: {
			pickers: 1, //could be custom pickers passed, each with it’s own settings

			//picker-specific options
			dimensions: 1, //how much values picker will get //TODO: replace with mapping fn
			direction: "right", //keywords or degrees //TODO: replace direction with custom function
			placingFn: null,
			mappingFn: null, //x,y → normalized l (or [l1, l2])
			transferFn: null, ///can pass array of functions for each coordinate
			step: 10,
			min: 0,
			max: 100,
			snap: false, //snap value to the grid
			rigidSnap: false, //whether to snap straightforward or smoother drop effect
			restrict: true, //whether to restrict picker moving area
			grid: false, //or array of grid coords to snap
			repeat: false, //whether to rotate infinity or cycle h/v scroll

			//shape: "", //triangle, circular, SVG-shape in basic case; 2d/1d is different classifier			
			readonly: false, //no events
			sniperSpeed: .25, //sniper key slowing down amt

			evSuffix: pluginName,
			//callbacks
			create: null,
			dragstart: null,
			drag: null,
			dragstop: null,
			destroy: null,
			change: null //picker callback
		},

		_create: function(opts){
			this.options = $.extend({}, this.options);
			$.extend(this.options, opts);
			var o = this.options;

			//treat element
			this.$element = $(this.element);
			this.$element.addClass(className);

			//update element size
			this.top= this.element.offsetTop;
			this.left= this.element.offsetLeft;
			this.height= this.element.clientHeight;
			this.width= this.element.clientWidth;
			this.center= {x: this.element.width * .5, y: this.element.height * .5};

			//create picker(s)
			this.pickers = [];
			var pNum = o.pickers.length || o.pickers;
			for (var i = 0; i < pNum; i++){
				this.addPicker(o.pickers[i] || o);
			}

			//init drag state object
			this.dragstate = {
				x:0,
				y:0,
				difX: 0,
				difY: 0,
				picker: this.pickers[0] //current picker to drag				
			}

			//set up events
			this.evSuffix = "." + o.evSuffix;

			this._bindEvents();

			this.$element.trigger("create");
		},

		//add new picker
		addPicker: function(opts){
			this.pickers.push(new Picker(this, opts));
		},

		_bindEvents: function(){
			/*$doc.click(function(e){
				console.log("------------")
				console.log("offset:" + e.offsetY)
				console.log("client:" + e.clientY)
				console.log("screen:" + e.screenY)
				console.log("page:" + e.pageY)
				console.log("flat:" + e.y)
				console.log("scrollTop:" + $wnd.scrollTop())
			})*/
			this.$element.on("mousedown", this._dragstart.bind(this));
		},

		_dragstart: function(e){
			var o = this.options;

			//init dragstate
			this.dragstate.x = e.pageX - this.left,
			this.dragstate.y = e.pageY - this.top,
			this.dragstate.difX = 0;
			this.dragstate.difY = 0;
			this.dragstate.isCtrl = e.ctrlKey;
			this.dragstate.picker = this._findClosestPicker(this.dragstate.x, this.dragstate.y);
			
			this.dragstate.picker.dragstart(this.dragstate);

			//bind moving
			$doc.on("selectstart" + this.evSuffix, function(){return false})
			.on("mousemove" + this.evSuffix, this._drag.bind(this))
			.on("mouseup" + this.evSuffix, this._dragstop.bind(this))
			.on("mouseleave" + this.evSuffix, this._dragstop.bind(this))
		},

		_drag: function(e){
			//NOTE: try not to find out picker offset throught style/etc, instead, update it’s coords based on event obtained			
			var o = this.options;

			this.dragstate.isCtrl = e.ctrlKey;
			this.dragstate.difX = e.pageX - this.left - this.dragstate.x;
			this.dragstate.difY = e.pageY - this.top - this.dragstate.y;
			this.dragstate.x = e.pageX - this.left;
			this.dragstate.y = e.pageY - this.top;
			
			this.dragstate.picker.drag(this.dragstate);
		},

		_dragstop: function(e){
			//Move picker to the final value (snapped, rounded, limited etc)
			this.dragstate.picker.update();

			//unbind events
			$doc.off("mousemove" + this.evSuffix)
			.off("selectstart" + this.evSuffix)
			.off("mouseup" + this.evSuffix)
			.off("mouseleave" + this.evSuffix)
		},

		//get picker closest to the passed coords
		_findClosestPicker: function(x, y){
			var minL = 9999, closestPicker;
			for (var i = 0; i < this.pickers.length; i++){
				var picker = this.pickers[i],
					w = x - picker.left,
					h = y - picker.top,
					l = Math.sqrt(w*w + h*h);
				if (l < minL){
					minL = l;
					closestPicker = i;
				}
			}
			return this.pickers[closestPicker];
		},

		//set pickers reflect their’s real values
		updatePickers: function(){
			for (var i = 0; i < this.pickers.length; i++){
				this.pickers[i].update();
			}
		}
	}


	/* Picker class - a picker controller.
	Moved out to the external class because of has too much own properties.
	NOTE: experimental class architecture:
	- parent passed instead of target element
	- options contained right on the element itself, w/o options object 
	*/
	function Picker(parent, opts){
		this.container = parent;
		this._create(opts);
	}

	//Static
	$.extend(Picker, {
		//Functions of placing picker based on dragstate
		//Main value-forming function: value is obtained based on new picker coords defined by this function
		//?should return picker coords
		placingFn: {
			circular: function(){

			},
			conical: function(){

			},
			rectangular: function(x,y, picker, container, o){				
				var to = {x:0, y:0}
				//test bounds
				if (x <= 0){
					to.x = 0;
				} else if (x >= container.width){
					to.x = container.width;				
				} else {
					to.x = x;
					to.x = limit(to.x, 0, container.width);
				}
				if (y <= 0){
					to.y = 0;
				} else if (y >= container.height){
					to.y = container.height;				
				} else {
					to.y = y;
					to.y = limit(to.y, 0, container.height);
				}
				return to;
			},
			linear: function(dragstate, o){
				switch (o.direction){
					case "top":
					case "bottom":
						toX = this.container.width * .5;
						break;
					case "left":
					case "right":
						toY = this.container.height * .5;
						break;
				}
			},
			free: function(){

			},
			repeat: function(x, y, picker, container, o){
				var to = {x: 0, y:0}
				to.x = x % container.width;
				to.y = y % container.height;
				to.x += (to.x < 0 ? container.width : 0)
				to.y += (to.y < 0 ? container.height : 0)
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
				toL: function(picker, container, o){
					var l = 0;
					if (o.dimensions == 2){
						l = [picker.left / container.width, picker.top / container.height];
					} else {
						switch(o.direction){
							case "top":
								l = 1 - picker.top / container.height;
								break
							case "bottom":
								l = picker.top / container.height;
								break;
							case "left":
								l = 1 - picker.left / container.width;
								break;
							case "right":
								l = picker.left / container.width;
								break;
							default: //degrees case
								//TODO: calc degrees
						}
					}
					return l;
				},
				fromL: function(l, picker, container, o){
					picker.left = l * container.width;
					picker.top = l * container.height;
				}
			},
			polar: {
				toL: function(picker, container, o){
					//TODO
					throw "unimplemented"
				},
				fromL: function(picker, container, o){
					//TODO
					throw "unimplemented"
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
				toValue: function(l, o){
					return l * (o.max - o.min) - o.min;
				},
				fromValue: function(value, o){
					return (value + o.min) / (o.max - o.min);
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
	})

	//Prototype
	Picker.prototype = {
		options: {
			dimensions: 1, //how much values picker will get //TODO: replace with mapping fn
			direction: "right", //keywords or degrees //TODO: replace direction with custom function
			placingFn: null,
			mappingFn: null, //x,y → normalized l (or [l1, l2])
			transferFn: null, //can pass array of functions for each coordinate
			step: 10,
			min: 0,
			max: 100,
			value: 0,
			snap: false, //snap value to the grid
			rigidSnap: false, //whether to snap straightforward or smoother drop effect
			restrict: true, //whether to restrict picker moving area
			grid: false, //or array of grid coords to snap
			repeat: false, //whether to rotate infinity or cycle h/v scroll
		},

		_create: function(opts){
			//make options contained in this
			var o = $.extend({}, this.options);
			this.options = $.extend(o, opts);

			//init vars

			//create picker element
			this.element = document.createElement("div");
			this.element.className = "slide-area-picker";
			this.element.id = "picker-" + opts.id || this.pickers.length;
			this.$element = $(this.element);
			this.container.element.appendChild(this.element);

			//setup placing fn
			if (!o.placingFn){
				if (o.repeat){
					o.placingFn = Picker.placingFn.repeat;
				} else {
					o.placingFn = Picker.placingFn.rectangular;
				}
			}

			//setup mapping fn
			if (!o.mappingFn){
				o.mappingFn = Picker.mappingFn.linear;
			}

			//setup transfer fn
			if (!o.transferFn){
				o.transferFn = Picker.transferFn.linear;
			}

			//init coords based on value passed
			this.top = 0; //quite bad to write props right to the element, but let it bee: used to calc closest picker
			this.left = 0;

			//init element
		},

		//move, changevalue and trigger changing
		to: function(x, y){
			var str = "translate3d(",
				to = this.options.placingFn(x, y, this, this.container, this.options);

			str += to.x + "px," + to.y + "px, 0)";
			this.element.style[cssPrefix + "transform"] = str;

			this.top = to.y;
			this.left = to.x;
			
			this.value = this._calcValue(to.x, to.y);

			this._trigger("change", [this.value], this);
		},

		//make position reflect value
		update: function(){

		},

		dragstart: function(dragstate){
			this.to(dragstate.x, dragstate.y)			
		},

		drag: function(dragstate){
			this.to(dragstate.x, dragstate.y)
		},

	
		_trigger: function(evName, args, picker){
			this.$element.trigger(evName, args);
			if (this.options[evName]) this.options[evName].apply(this, args.concat(picker));
			if (this.container.options[evName]) this.container.options[evName].apply(this, args.concat(picker));
		},


		//returns value from current coords
		_calcValue: function(x, y){
			var o = this.options,
				l = .0; //length of the value [0..1]
			//get normalized(not necessary) value
			l = o.mappingFn.toL.call(this, this, this.container, o);
			if ($.isArray(l)){
				//multiple dimensions
				var res = [];
				for (var i = 0; i < l.length; i++){
					res.push(o.transferFn.toValue.call(this, l[i], o));
				}
				return res;
			} else {
				//apply transfer function
				return o.transferFn.toValue.call(this, l, o);
			}
		},

		getValue: function(){
			return this.value;
		},

		setValue: function(value){
			var o = this.options;
			this.value = value;
			this.l = o.transferFn.out(value);
			o.mappingFn.from(l);
		},

		value: function(value){
			if (value !== undefined) this.setValue(value);
			else this.getValue();
		}
	}




	//Plugin
	$.fn[pluginName] = function (arg) {
		return $(this).each(function (i, el) {
			var instance = new Area(el, $.extend(arg || {}, $.parseDataAttributes(el)));
			if (!$(el).data(pluginName)) $(el).data(pluginName, instance);
		})
	}


	//Simple options parser. The same as $.fn.data(), or element.dataset but for zepto	
	if (!$.parseDataAttributes) {
		$.parseDataAttributes = function(el) {
			var data = {}, v;
			if (el.dataset) {
				for (var prop in el.dataset) {
					if (el.dataset[prop] === "true" || el.dataset[prop] === "") {
						data[prop] = true;
					} else if (el.dataset[prop] === "false") {
						data[prop] = false;
					} else if (v = parseFloat(el.dataset[prop])) {
						data[prop] = v;
					} else {
						data[prop] = el.dataset[prop];
					}
				}
			} else {
				[].forEach.call(el.attributes, function(attr) {
					if (/^data-/.test(attr.name)) {
						var camelCaseName = attr.name.substr(5).replace(/-(.)/g, function ($0, $1) {
						    return $1.toUpperCase();
						});
						data[camelCaseName] = attr.value;
					}
				});
			}
			return data;
		}
	}


	//stupid prefix detector
	function detectCSSPrefix(){
		var style = document.defaultView.getComputedStyle(document.body, "");
		if (style["transform"]) return "";
		if (style["-webkit-transform"]) return "-webkit-";
		if (style["-moz-transform"]) return "-moz-";
		if (style["-o-transform"]) return "-o-";
		if (style["-khtml-transform"]) return "-khtml-";
		return "";
	}

	//simple math limiter
	function limit(v, min, max){
		return Math.max(min, Math.min(max, v));
	}


})(window.jQuery || window.Zepto);