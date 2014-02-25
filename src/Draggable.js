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
				self.$within = self.within
			} else if (typeof self.within === "string"){
				if (self.within === "parent")
					self.$within = self.parentNode;
				else if (self.within === "..")
					self.$within = self.parentNode;
				else if (self.within === "...")
					self.$within = self.parentNode.parentNode;
				else if (self.within === "root")
					self.$within = document.body.parentNode;
				else
					self.$within = $(self.within)[0];
			} else {
				self.$within = null
			}
			//TODO: catch shitty elements (non-elements)
		}

		//init empty limits
		self.limits = {};

		//go native
		if (self.native) {
			self.state = "native";
		}

		return self;
	}

	//-------------------API (verbs)
	startDrag(e){
		//define limits
		this.updateLimits();

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

		//move according to dragstate
		this.move(d);
	}

	stopDrag(e){
		//console.log("stopDrag")
		delete this.dragstate;
	}

	//specific movement function based on dragstate passed
	//takes into accont mouse coords, self coords, axis limits and displacement within
	//TODO: name this more intuitively, because move supposes (x, y)
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

		//TODO: calc pin area movement?
	}

	//updates limits state
	updateLimits(){
		//it is here because not always element is in DOM when constructor inits
		var limOffsets = offsets(this.$within);

		this.offsets = offsets(this);
		var selfPads = paddings(this.$within);

		//save relative coord system offsets
		this.oX = this.offsets.left - this.x;
		this.oY = this.offsets.top - this.y;

		//element movement relative borders
		//no-pinArea version
		//TODO: make limits accesible before appending to the DOM
		// this.limits.top = limOffsets.top - this.oY + selfPads.top;

		// this.limits.bottom = limOffsets.bottom - this.oY - this.offsets.height - selfPads.bottom;

		// this.limits.left = limOffsets.left - this.oX + selfPads.left;

		// this.limits.right = limOffsets.right - this.oX - this.offsets.width - selfPads.right;

		var pin = this.getPinArea();

		//pinArea-including version
		this.limits.top = limOffsets.top - this.oY + selfPads.top - pin[1];

		this.limits.bottom = limOffsets.bottom - this.oY - this.offsets.height - selfPads.bottom + (this.offsets.height - pin[3]);

		this.limits.left = limOffsets.left - this.oX + selfPads.left - pin[0];

		this.limits.right = limOffsets.right - this.oX - this.offsets.width - selfPads.right + (this.offsets.width - pin[2]);

	}

	//returns pin area based on pin option
	getPinArea(){
		var pin;
		if (this.pin && this.pin.length === 2) {
			pin = [this.pin[0], this.pin[1], this.pin[0], this.pin[1]]
		} else if (this.pin && this.pin.length === 4){
			pin = this.pin
		} else {
			pin = [0,0, this.offsetWidth, this.offsetHeight]
		}
		return pin;
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

	//native-drag helper
	setDropEffect(e){
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
			on(this.$within, 'dragover', this.setDropEffect)
		},
		after: function(){
			this.style[cssPrefix + "user-drag"] = "none";
			off(this.$within, 'dragover', this.setDropEffect)
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
		dragover: 'setDropEffect',
	}
}

//Should it be of the prototype or static?
//Prototype: + call by `this.defaults` +
Draggable.defaults = {
	treshold: 10,

	autoscroll: false,

	//null is no restrictions
	within: document.body.parentNode,

	//what area of draggable should not be outside the restriction area
	//by default it’s whole draggable rect
	pin: null,

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