/* container class */
function SlideArea(el, opts){
	this._create(el, opts);
}

SlideArea.prototype = {
	options: {
		pickers: 1, //could be custom pickers passed, each with it’s own settings

		//shape: "", //triangle, circular, SVG-shape in basic case; 2d/1d is different classifier			
		readonly: false, //no events
		sniperSpeed: 0.25, //sniper key slowing down amt

		//callbacks
		create: null,
		dragstart: null,
		drag: null,
		dragstop: null,
		destroy: null,
		change: null //picker callback
	},

	_create: function(el, opts){
		if (el) this.el = el;
		else {
			throw new Error("No element passed to the constructor")
			return false;
		}

		//init options
		this.options = extend({}, this.options, parseDataAttributes(this.el), opts);
		var o = this.options;

		//treat element
		this.el.classList.add(className);

		//update element size
		this._captureSelfSize();

		//create picker(s)
		this.pickers = [];
		var l = this.el.childNodes.length,
			pNum = 0;

		//clean text content
		for (var i = l; i--;){
			if (this.el.childNodes[i].nodeType !== 1) { this.el.removeChild(this.el.childNodes[i])}
		}

		l = this.el.childNodes.length;
		if (l > 0){
			//recognize inner elements as pickers
			for (var i = 0; i<l; i++){
				this.addPicker(this.el.childNodes[i], o.pickers[i])
			}
		} else {
			//no elements inside, so create them from options (set of pickers) passed
			var pNum = (o.pickers.length || o.pickers) || 1;
			for (var i = 0; i < pNum; i++){
				var el = document.createElement("div"); //TODO
				this.addPicker(el, o.pickers[i]);
			}
		}

		//init drag state object
		this.dragstate = {
			x:0,
			y:0,
			difX: 0,
			difY: 0,
			clientX: 0,
			clientY: 0,
			picker: this.pickers[0] //current picker to drag				
		};

		this._bindEvents();

		//this.$el.trigger("create");
	},

	//add new picker
	addPicker: function(el, opts){
		this.pickers.push(new Picker(el, this, opts));
	},

	_bindEvents: function(){
		var o = this.options,
			self = this;

		//bind cb’s to this
		this._dragstart = this._dragstart.bind(this);
		this._drag = this._drag.bind(this);
		this._dragstop = this._dragstop.bind(this);

		this.el.addEventListener("mousedown", this._dragstart);

		window.addEventListener("resize", function(){
			self._captureSelfSize();
			self.updatePickers();
		});
	},

	_dragstart: function(e){
		var o = this.options;

		this._captureSelfSize();

		//init dragstate
		this.dragstate.x = e.clientX - this.left;
		this.dragstate.y = e.clientY - this.top;
		this.dragstate.difX = 0;
		this.dragstate.difY = 0;
		this.dragstate.isCtrl = e.ctrlKey;
		this.dragstate.clientX = e.clientX; 
		this.dragstate.clientY = e.clientY;
		this.dragstate.picker = this._findClosestPicker(this.dragstate.x, this.dragstate.y);			
		this.dragstate.picker.dragstart(this.dragstate);

		this.el.classList.add("dragging");

		//bind moving
		document.addEventListener("selectstart", this._prevent);
		document.addEventListener("mousemove", this._drag);
		document.addEventListener("mouseup", this._dragstop);
		document.addEventListener("mouseleave", this._dragstop);
	},

	_prevent: function(e){
		e.preventDefault(); 
		return false;
	},

	_drag: function(e){
		//NOTE: try not to find out picker offset throught style/etc, instead, update it’s coords based on event obtained			
		var o = this.options;

		this.dragstate.isCtrl = e.ctrlKey;
		this.dragstate.difX = e.clientX - this.dragstate.clientX;
		this.dragstate.difY = e.clientY - this.dragstate.clientY;
		if (e.ctrlKey) {
			this.dragstate.difX *= o.sniperSpeed;
			this.dragstate.difY *= o.sniperSpeed;
		}
		this.dragstate.x += this.dragstate.difX;
		this.dragstate.y += this.dragstate.difY;
		this.dragstate.clientX = e.clientX; 
		this.dragstate.clientY = e.clientY;
		
		this.dragstate.picker.drag(this.dragstate);
	},

	_dragstop: function(e){
		this._drag(e);

		//Move picker to the final value (snapped, rounded, limited etc)
		this.dragstate.picker.update();

		this.el.classList.remove("dragging");

		//unbind events
		document.removeEventListener("selectstart", this._prevent);
		document.removeEventListener("mousemove", this._drag);
		document.removeEventListener("mouseup", this._dragstop);
		document.removeEventListener("mouseleave", this._dragstop);
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

	//
	_captureSelfSize: function(){		
		var offset = this.el.getBoundingClientRect();
		this.top= offset.top;
		this.left= offset.left;
		this.height= offset.height; //this.el.clientHeight;
		this.width= offset.width; //this.el.clientWidth;
		this.center= {x: this.width * 0.5, y: this.height * 0.5};
	},

	//set pickers reflect their’s real values
	updatePickers: function(){
		for (var i = 0; i < this.pickers.length; i++){
			this.pickers[i].update();
		}
	}
};