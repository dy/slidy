//
class Draggable extends Component {
	constructor(el, opts){
		//ensure element created
		//ensure DOM extensibility
		//read options (el/passed)
		//hook up events
		//bind API methods
		//init instance states
		return super(el, opts)
	}

	//-------------------API (verbs)
	startDrag(e){
		console.log("startDrag")
		//init dragstate
		this.dragstate = {
			x: e.clientX - this.offsetLeft,
			y: e.clientY - this.offsetTop,
			clientX: e.clientX,
			clientY: e.clientY
		};
		this.trigger('dragstart')

		this.state = "drag";
	}

	drag(e) {
		console.log("drag")
		this.trigger('drag');
	}

	stopDrag(e){
		console.log("stopDrag")
		this.trigger('dragstop');

		this.state = "default"
	}
}


//--------------------------States
//every state is a set of events to bind to API
//TODO: how to refer functions to real `this`?
Draggable.prototype.states = {
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

	}
}

Draggable.defaults = {
	treshold: 10,

	autoscroll: false,

	within: null,

	group: null,

	ghost: false,

	translate: true
}