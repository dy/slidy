(function($){
	var $wnd = $(window),
		$doc = $(window.document),
		$body = $(window.document.body);

	var pluginName = "slideArea",
		className = "slide-area",
		cssPrefix = detectCSSPrefix();

	//Main plugin class
	function P(el, opts){
		this.element = el;
		this._create(opts)
	}

	$.extend(P, {
		//Transforms normalized value of length to the real value. Same goal as transfer fn.
		//NOTE: supposed that multiple pickers are independent of each other, so we don’t need to pass an array of pickers.
		//NOTE: supposed that multiple dimensions are independent of each other, so you can safely describe one-dimension case
		//NOTE: supposed that l is normalized coordinate (0..1) relative to the lenght of the sliding line
		//NOTE: direction functions, as well as [decart-polar] mapping ones is the different thing. There’s just 
		//TODO: think of how to name functions set
		transferFn: {
			//unifirm mapping to the min/max range
			linear: function(l){
				var o = this.options,
					value = l * (o.max - o.min) - o.min;
				return value;
			},
			logarithmic: function(l){
			}
		},

		//Transforms x,y picker & element coords to the l value, or couple of l
		mappingFn: {
			decart2d: function(picker, container){
				var l = 0, o = this.options;

				//TODO: think how to set directions
				l = [picker.left / container.width, picker.top / container.height];

				return l;
			},
			decart1d: function(picker, container){
				var l = 0, o = this.options;

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

				return l;
			},

			//the same as decart, but with different clipping
			ray1d: function(){

			},
			polar2d: function(x, y){

			},
			polar1d: function(x, y){

			}
		}

	})

	P.prototype = {
		options: {
			pickers: 1, //could be custom pickers passed, each with it’s own settings

			//picker-specific options
			dimensions: 1, //how much values picker will get
			direction: "right", //keywords or degrees //TODO: replace direction with custom function
			mappingFn: P.mappingFn.decart1d, //x,y → normalized l (or [l1, l2])
			transferFn: P.transferFn.linear, ///can pass array of functions for each coordinate
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

			//callbacks
			create: null,
			dragstart: null,
			drag: null,
			_dragstop: null,
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

			//setup fns
			if (o.dimensions == 2){
				o.mappingFn = P.mappingFn.decart2d;
			} else {

			}
			
			//create picker(s)
			this.pickers = [];
			if (!$.isArray(o.pickers)){
				//if passed just number of pickers - they all the same, based on options
				for (var i = 0; i < o.pickers; i++){
					var picker = document.createElement("div")
					picker.className = "slide-area-picker";
					picker.id = "picker-" + i;

					picker.top = 0; //quite bad to write props right to the element, but let it bee: used to calc closest picker
					picker.left = 0;


					this.element.appendChild(picker);
					this.pickers.push(picker);
				}
			} else {
				//custom pickers passed
				for (var i = 0; i < o.pickers.length; i++){
					var picker = document.createElement("div"),
						po = o.pickers[i];
					picker.className = "slide-area-picker";
					picker.id = "picker-" + po.id || i;

					picker.top = 0; //quite bad, but let it bee: used to calc closest picker
					picker.left = 0;

					this.element.appendChild(picker);
					this.pickers.push(picker);
				}
			}

			//init drag state object
			this.dragstate = {
				pointer: {x:0,y:0},
				picker: this.pickers[0], //current picker to drag
				pickerBox: {
					top: 0,
					left: 0
				},
				elementBox: {
					top: this.element.offsetTop,
					left: this.element.offsetLeft,
					height: this.element.clientHeight,
					width: this.element.clientWidth,
					center: [this.element.width * .5, this.element.height * .5]
				}
			}

			this.updatePicker();

			//set up events
			this.evSuffix = "." + this.options.evSuffix;
			this._bindEvents();

			this._trigger("create");
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

		//simple trigger routine
		_trigger: function(evtName, arg1, arg2, arg3){
			if (this.options[evtName]) this.options[evtName].call(this.$element, arg1, arg2, arg3); 
			this.$element.trigger(evtName, [arg1, arg2, arg3])
		},

		_dragstart: function(e){
			var o = this.options,
				isCtrl = e.ctrlKey;
			//init state — find closest picker
			this.dragstate.pointer.x = e.pageX;
			this.dragstate.pointer.y = e.pageY;

			this.dragstate.picker = this._findClosestPicker(e.pageX - this.dragstate.elementBox.left, e.pageY - this.dragstate.elementBox.top);

			if (!isCtrl) {
				//normal click leads to leap of picker to the place of lcick
				this.dragstate.pickerBox.left = e.pageX - this.dragstate.elementBox.left;
				this.dragstate.pickerBox.top = e.pageY - this.dragstate.elementBox.top;
			} else {
				//ctrl+click continues sniper-mode picking, not repositioning picker
				this.dragstate.pickerBox.left = this.dragstate.pickerBox.left
				this.dragstate.pickerBox.top = this.dragstate.pickerBox.top
			}

			this.updatePicker();

			//bind moving
			$doc.on("selectstart" + this.evSuffix, function(){return false})
			.on("mousemove" + this.evSuffix, this._drag.bind(this))
			.on("mouseup" + this.evSuffix, this._dragstop.bind(this))
			.on("mouseleave" + this.evSuffix, this._dragstop.bind(this))
		},

		_drag: function(e){
			//NOTE: try not to find out picker offset throught style/etc, instead, update it’s coords based on event obtained			
			var o = this.options,
				isCtrl = e.ctrlKey,
				//difX = (e.pageX - this.dragstate.elementBox.left) - this.dragstate.pickerBox.left,
				//difY = (e.pageY - this.dragstate.elementBox.top) - this.dragstate.pickerBox.top; //absolute coords method
				difX = e.pageX - this.dragstate.pointer.x,
				difY = e.pageY - this.dragstate.pointer.y,
				x = e.pageX - this.dragstate.elementBox.left, //container offset
				y = e.pageY - this.dragstate.elementBox.top
			
			//slow down in ctrl mode
			if (isCtrl) {
				difX *= o.sniperSpeed;
				difY *= o.sniperSpeed;
			}

			this.dragstate.pointer.x = e.pageX;
			this.dragstate.pointer.y = e.pageY;			

			if (o.repeat){
				this.dragstate.pickerBox.left += difX;
				this.dragstate.pickerBox.top += difY;
				this.dragstate.pickerBox.left = this.dragstate.pickerBox.left % this.dragstate.elementBox.width;
				this.dragstate.pickerBox.top = this.dragstate.pickerBox.top % this.dragstate.elementBox.height;
				this.dragstate.pickerBox.left += (this.dragstate.pickerBox.left < 0 ? this.dragstate.elementBox.width : 0)
				this.dragstate.pickerBox.top += (this.dragstate.pickerBox.top < 0 ? this.dragstate.elementBox.height : 0)
			} else if (o.restrict){
				//test bounds
				if (x <= 0){
					this.dragstate.pickerBox.left = 0;
				} else if (x >= this.dragstate.elementBox.width){
					this.dragstate.pickerBox.left = this.dragstate.elementBox.width;				
				} else {
					this.dragstate.pickerBox.left += difX;
					this.dragstate.pickerBox.left = this.limit(this.dragstate.pickerBox.left, 0, this.dragstate.elementBox.width);
				}
				if (y <= 0){
					this.dragstate.pickerBox.top = 0;
				} else if (y >= this.dragstate.elementBox.height){
					this.dragstate.pickerBox.top = this.dragstate.elementBox.height;				
				} else {
					this.dragstate.pickerBox.top += difY;
					this.dragstate.pickerBox.top = this.limit(this.dragstate.pickerBox.top, 0, this.dragstate.elementBox.height);
				}

			}

			this.updatePicker();
		},

		_dragstop: function(e){
			//save picker data
			this.dragstate.picker.top = this.dragstate.pickerBox.top
			this.dragstate.picker.left = this.dragstate.pickerBox.left;

			//unbind events
			$doc.off("mousemove" + this.evSuffix)
			.off("selectstart" + this.evSuffix)
			.off("mouseup" + this.evSuffix)
			.off("mouseleave" + this.evSuffix)
		},

		//checks whether picker inside of container
		_isInside: function(x, y, container){
			if (x >= 0 && 
				x <= container.width &&
				y >= 0 &&
				y <= container.height){
				return true;
			}
			return false;
		},

		//max/min
		limit: function(val, min, max){
			return Math.max(min, Math.min(max, val));
		},

		//make picker corresond to the dragstate
		updatePicker: function(){
			var o = this.options,
				left = this.dragstate.pickerBox.left,
				top = this.dragstate.pickerBox.top,
				str = "translate3d(";

			//restrict horizontal movement
			if (o.dimensions == 1){
				switch (o.direction){
					case "top":
					case "bottom":
						left = this.dragstate.elementBox.width * .5;
						break;
					case "left":
					case "right":
						top = this.dragstate.elementBox.height * .5;
						break;
				}
			}
			
			str += left + "px," + top + "px,0)";				 
			
			this.dragstate.picker.style[cssPrefix + "transform"] = str;

			this._trigger("change", this._calcValue(), this.dragstate.picker, this.dragstate.element);
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

		//returns value from drag state
		_calcValue: function(){
			var o = this.options,
				l = .0; //length of the value [0..1]

			//get normalized(not necessary) value
			l = o.mappingFn.call(this, this.dragstate.pickerBox, this.dragstate.elementBox);
			if ($.isArray(l)){
				//multiple dimensions
				var res = [];
				for (var i = 0; i < l.length; i++){
					res.push((o.transferFn[i] || o.transferFn).call(this, l[i]));
				}
				return res;
			} else {
				//apply transfer function
				return o.transferFn.call(this, l);
			}
		},


		//API methods
		setValue: function(value){
			throw "unimplemented"
		},

		getValue: function(){
			return this._calcValue();
		},

		val: function(){
			throw "unimplemented"
		}
	}


	//Plugin
	$.fn[pluginName] = function (arg) {
		return $(this).each(function (i, el) {
			var instance = new P(el, $.extend(arg || {}, $.parseDataAttributes(el)));
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


})(window.jQuery || window.Zepto);