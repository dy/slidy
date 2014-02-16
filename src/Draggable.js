class Draggable extends Component {
	constructor(el, opts){
		var self = super(el, opts);

		//init position
		self._x = 0;
		self._y = 0;

		//handle CSSs
		self.style[cssPrefix + "user-select"] = "none";
		self.style[cssPrefix + "user-drag"] = "none";

		//set restricting area
		if (self.within){
			if (self.within instanceof Element){
				self.$restrictWithin = self.within
			} else if (typeof self.within === "string"){
				self.$restrictWithin = $(self.within)
			} else {
				self.$restrictWithin = null
			}
			//TODO: catch shitty elements (non-elements)
		}

		//go native
		if (self.native) {
			self.state = "native";
		}

		return self;
	}

	//-------------------API (verbs)
	startDrag(e){
		//set limits
		//it is here because not always element is in DOM when constructor inits
		var limOffsets = offsets(this.$restrictWithin),
			selfOffsets = offsets(this);
		//TODO: you have to insert the element somewhere before calculating limits
		this.limits = {
			top: limOffsets.top - selfOffsets.top + this.y,
			bottom: limOffsets.bottom - selfOffsets.bottom + this.y,
			left: limOffsets.left - selfOffsets.left + this.x,
			right: limOffsets.right - selfOffsets.right + this.x,
		}

		//save relative coord system offsets
		this.oX = selfOffsets.left - this.x;
		this.oY = selfOffsets.top - this.y;

		//init dragstate
		this.dragstate = {
			//viewport offset
			clientX: e.clientX,
			clientY: e.clientY,

			//offset within self
			offsetX: e.offsetX,
			offsetY: e.offsetY,

			//relative coords
			x: e.clientX + window.scrollX - this.oX,
			y: e.clientY + window.scrollY - this.oY
		};
	}

	drag(e) {
		//console.log("drag", e)

		var d = this.dragstate;

		//var difX = e.clientX - d.clientX;
		//var difY = e.clientY - d.clientY;

		//capture dragstate
		d.isCtrl = e.ctrlKey;
		if (e.ctrlKey && this.sniper) {
			//d.difX *= this.options.sniperSpeed;
			//d.difY *= this.options.sniperSpeed;
		}
		d.clientX = e.clientX;
		d.clientY = e.clientY;
		d.x = e.clientX + window.scrollX - this.oX;
		d.y = e.clientY + window.scrollY - this.oY;

		this.move(d);
	}

	stopDrag(e){
		//console.log("stopDrag")
		delete this.dragstate;
	}

	//specific movement function based on dragstate passed
	//takes into accont mouse coords, self coords, axis limits and displacement within
	move(d){
		if (!this.axis || this.axis === "x"){
			this.x = round(between(d.x - d.offsetX,
						this.limits.left,
						this.limits.right), this.precision);
		}

		if (!this.axis || this.axis === "y" ){
			this.y = round(between(d.y - d.offsetY,
						this.limits.top,
						this.limits.bottom), this.precision);
		}
	}

	//relative coords
	get x(){
		return this._x
	}
	set x(x){
		this._x = x;
		this.style[cssPrefix + "transform"] = ["translate3d(", this._x, "px,", this._y, "px, 0)"].join("");
	}
	get y(){
		return this._y
	}
	set y(y){
		this._y = y;
		this.style[cssPrefix + "transform"] = ["translate3d(", this._x, "px,", this._y, "px, 0)"].join("");
	}

	dropEffect(e){
		e.preventDefault()
		e.dataTransfer.dropEffect = "move"
		return false;
	}
}


//--------------------------States
//every state is a set of events to bind to API
Draggable.states = {
	//non-native drag
	'default': {
		before: null,
		after: null,

		mousedown: function(e){
			this.startDrag(e);
			this.fire('dragstart')
			this.state = "drag";
		}
	},
	drag: {
		'document selectstart': 'preventDefault',
		'document mousemove': function(e){
			this.drag(e)
			this.fire('drag')
		},
		'document mouseup, document mouseleave': function(e){
			this.stopDrag(e);
			this.state = "default"
		}
	},
	scroll: {

	},
	tech: {

	},
	out: {

	},

	//native drag
	native: {
		before: function(){
			//hang proper styles
			this.style[cssPrefix + "user-drag"] = "element";
			this.style.cursor = "pointer!important";

			//make restricting area allowable to drop
			on(this.$restrictWithin, 'dragover', this.dropEffect)
		},
		after: function(){
			this.style[cssPrefix + "user-drag"] = "none";
			off(this.$restrictWithin, 'dragover', this.dropEffect)
		},

		dragstart:  function(e){
			this.startDrag(e);
			e.dataTransfer.effectAllowed = 'all';

			//hook drag image stub (native image is invisible)
			this.$dragImageStub = document.createElement('div');
			this.parentNode.insertBefore(this.$dragImageStub, this);
			e.dataTransfer.setDragImage(this.$dragImageStub, 0, 0);
		},
		dragend:  function(e){
			this.stopDrag(e);

			//remove drag image stub
			this.$dragImageStub.parentNode.removeChild(this.$dragImageStub);
			delete this.$dragImageStub;
		},
		drag:  function(e){
			//ignore final native drag event
			if (e.x === 0 && e.y === 0) return;
			this.drag(e);
			//this.ondrag && this.ondrag.call(this);
		},
		dragover: 'dropEffect',
	}
}

//Should it be of the prototype or static?
//Prototype: + call by `this.defaults` +
Draggable.defaults = {
	treshold: 10,

	autoscroll: false,

	//null is no restrictions
	within: document.body,

	group: null,

	ghost: false,

	translate: true,

	//to what extent round position
	precision: 1,

	sniper: false,

	//jquery-exactly axis fn: false, x, y
	axis: false,

	//detect whether to use native drag
	//NOTE: you can’t change drag cursor, though native drag is faster
	//NOTE: bedides, cursor is glitching if drag started on the edge
	//TODO: make ghost insteadof moving self
	native: (function(){
		var div = document.createElement("div")
		var isNativeSupported = ('draggable' in div) || ('ondragstart' in div && 'ondrop' in div);
		return isNativeSupported
	})()
}

//TODO: implement default change method

//Bind autoload & feature detection
Component.register(Draggable);