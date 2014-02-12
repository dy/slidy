var Draggable = (function(){

	function Draggable ($el, options){
		//ensure element created
		//read options (el/passed)
		//hook up events
		//bind API methods
		//var self = super($el, options);


		//return self;
	}



	//API is an verbs
	Draggable.prototype.startDrag = function(e){
		//init dragstate
		this.dragstate = {
			x: e.clientX - this.offsetLeft,
			y: e.clientY - this.offsetTop,
			clientX: e.clientX,
			clientY: e.clientY
		};
		this.trigger('dragstart')
	}

	Draggable.prototype.drag = function(e) {
		this.trigger('drag');
	}

	Draggable.prototype.stopDrag = function(e){
		this.trigger('dragstop');
	}

return Draggable;})();
/*
//every state is a set of events to bind to API
//TODO: how to refer functions to real `this`?
Draggable.states = {
	'default': {
		before: null,
		after: null,

		'mousedown': this.startDrag
	},
	drag: {
		before: null,
		after: null,

		'document selectstart': this.preventDefault,
		'document mousemove': this.drag,
		'document mouseup': this.stopDrag,
		'document mouseleave': this.stopDrag
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
}*/