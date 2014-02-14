class Draggable extends Component {
	constructor(el, opts){
		var self = super(el, opts);

		//init position
		//TODO: detect initial transformation
		self._x = 0;
		self._y = 0;

		//handle CSSs
		self.style[cssPrefix + "user-select"] = "none";
		self.style[cssPrefix + "user-drag"] = "none";

		if (self.native) {
			self.state = "native";
		}

		console.dir(self)

		return self;
	}

	//-------------------API (verbs)
	startDrag(e){
		//init dragstate
		var offsets = offsetBox(this);
		this.dragstate = {
			clientX: e.clientX,
			clientY: e.clientY,
			offsetX: e.offsetX,
			offsetY: e.offsetY
		};
		//this.trigger('dragstart')

		this.state = "drag";
	}

	drag(e) {
		console.log("drag")
		var d = this.dragstate;

		var difX = e.clientX - d.clientX;
		var difY = e.clientY - d.clientY;

		//capture dragstate
		d.isCtrl = e.ctrlKey;
		if (e.ctrlKey) {
			//d.difX *= this.options.sniperSpeed;
			//d.difY *= this.options.sniperSpeed;
		}
		d.clientX = e.clientX;
		d.clientY = e.clientY;

		this.x += difX;
		this.y += difY;

		//this.trigger('drag');
	}

	stopDrag(e){
		console.log("stopDrag")
		//this.trigger('dragstop');

		delete this.dragstate;

		this.state = "default"
	}

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
}


//--------------------------States
//every state is a set of events to bind to API
Draggable.prototype.states = {
	//non-native drag
	'default': {
		before: null,
		after: null,

		'mousedown': Draggable.prototype.startDrag
	},
	drag: {
		//transition events
		before: null,
		after: null,

		//TODO: how to bind fns to instance?
		//the only way to do that is on the instance  itself
		'document selectstart': Draggable.prototype.preventDefault,
		'document mousemove': Draggable.prototype.drag,
		'document mouseup': Draggable.prototype.stopDrag,
		'document mouseleave': Draggable.prototype.stopDrag
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
			this.style[cssPrefix + "user-drag"] = "element";
		},
		after: function(){
			this.style[cssPrefix + "user-drag"] = "none";
		},
		'dragstart': null,
		'dragend': null
	}
}

//Should it be of the prototype or static?
//Prototype: + call by `this.defaults` +
Draggable.defaults = {
	treshold: 10,

	autoscroll: false,

	//null is no restrictions
	within: document,

	group: null,

	ghost: false,

	translate: true,

	sniper: false,

	//use native drag
	//Careful: you can’t use other options and change image dynamically
	native: false
}

//TODO: implement default change method

//Bind autoload & feature detection
Component.registerComponent(Draggable, function(){
	//detect native drag
	var div = document.createElement("div")
	this.isNativeSupported = ('draggable' in div) || ('ondragstart' in div && 'ondrop' in div);
})