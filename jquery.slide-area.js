(function($){
	var $wnd = $(window),
		$doc = $(window.document),
		$body = $(window.document.body);

	var pluginName = "slideArea",
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
			dimensions: 1,
			pickers: 1,

			//shape: "", //triangle, circular, SVG-shape in basic case; 2d/1d is different classifier
			direction: "right", //keywords or degrees
			//TODO: replace direction by custom function

			mappingFn: P.mappingFn.decart1d,
			transferFn: P.transferFn.linear, ///can pass array of functions for each coordinate

			step: 10,
			min: 0,
			max: 100,
			snap: false,
			readonly: false,
			pickersNumber: 1,
			infinite: true, //whether to rotate infinity or cycle h/v scroll
			grid: true, //or array of grid coordinates
			rigidSnap: false, //whether to snap straightforward or smoother drop effect
			restrictMovement: true, //whether to restrict picker moving area

			//inverted: false, //whether to drag plot insteadof picker //TODO: replace with very huge thumb

			evSuffix: pluginName,

			//external hooks

			//callbacks
			create: null,
			dragstart: null,
			drag: null,
			dragstop: null,
			destroy: null,
			change: null

		},
		_create: function(opts){
			this.options = $.extend({}, this.options);
			$.extend(this.options, opts);
			var o = this.options;

			//treat element
			this.$element = $(this.element);
			this.$element.addClass(pluginName);

			//setup fns
			if (o.dimensions == 2){
				o.mappingFn = P.mappingFn.decart2d;
			} else {

			}
			
			//create picker(s)
			this.pickers = [];
			for (var i = 0; i < o.pickers; i++){
				var picker = document.createElement("div")
				picker.className = "slide-area-picker";
				picker.id = "picker-" + i;
				picker.top = 0; //quite bad, but let it bee: used to calc closest picker
				picker.left = 0;
				this.element.appendChild(picker);
				this.pickers.push(picker);
			}

			//init drag state object
			this.dragstate = {
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
			this.$element.on("mousedown", this.dragstart.bind(this));
		},

		//simple trigger routine
		_trigger: function(evtName, arg1, arg2, arg3){			
			if (this.options[evtName]) this.options[evtName].call(this.$element, arg1, arg2, arg3); 
			this.$element.trigger(evtName, [arg1, arg2, arg3])
		},

		dragstart: function(e){
			var o = this.options;
			//init state — find closest picker
			this.dragstate.pickerBox.left = e.pageX - this.dragstate.elementBox.left;
			this.dragstate.pickerBox.top = e.pageY - this.dragstate.elementBox.top;

			this.dragstate.picker = this._findClosestPicker(this.dragstate.pickerBox.left, this.dragstate.pickerBox.top);

			this.updatePicker();

			//bind moving
			$doc.on("selectstart" + this.evSuffix, function(){return false})
			.on("mousemove" + this.evSuffix, this.drag.bind(this))
			.on("mouseup" + this.evSuffix, this.dragstop.bind(this))
			.on("mouseleave" + this.evSuffix, this.dragstop.bind(this))
		},

		drag: function(e){
			var o = this.options;

			//NOTE: try not to find out picker offset throught style/etc, instead, update it’s coords based on event obtained

			if (o.restrictMovement){
				this.dragstate.pickerBox.left = this.limit(e.pageX - this.dragstate.elementBox.left, 0, this.dragstate.elementBox.width);
				this.dragstate.pickerBox.top = this.limit(e.pageY - this.dragstate.elementBox.top, 0, this.dragstate.elementBox.height);
			}				

			this.updatePicker();

			this._trigger("change", this._calcValue());
		},

		dragstop: function(e){

			//unbind events
			$doc.off("mousemove" + this.evSuffix)
			.off("selectstart" + this.evSuffix)
			.off("mouseup" + this.evSuffix)
			.off("mouseleave" + this.evSuffix)
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
				str = "translate3d(" + left + "px," + top + "px,0)";
			
			this.dragstate.picker.style[cssPrefix + "transform"] = str;
			this.dragstate.picker.top = top;
			this.dragstate.picker.left = left;
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