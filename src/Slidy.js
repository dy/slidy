/**
* Range input on steroids
*/
class Slidy extends Component{
	constructor(el, opts){
		var self = super(el, opts);

		//detect how many dimensions needed
		//self.dimensions = self._value.length;

		//solve h/v question
		if (self.vertical) self.horizontal = false;

		//ensure picker with enough dimensions
		//TODO: take into account restrictwithin paddings
		var picker = new Draggable({
			within: self,
			axis: self.horizontal && !self.vertical ? 'x' : (self.vertical && !self.horizontal ? 'y' : false),
			ondrag: function(e){
				//console.log("drag observed", e.target.dragstate);
				var d = e.currentTarget.dragstate;

				//calc value based on dragstate
				//this._value =

				//trigger onchange
			}
		})

		//new Datasource(picker);

		self.appendChild(picker);

		return self;
	}

	//redefine getters/setters
	get value(){
		return 123
	}

	set value(newValue){
		//move picker to the proper position
	}
}

Slidy.states = {
	default: {
		//click:
	}
}

Slidy.defaults = {
	//HTML5 things
	value: 50,
	min: 0,
	max: 100,
	step: 1,

	//Consider

	//Orientation
	//? multidimensinal
	//dragdealer way
	vertical: false,
	horizontal: true,
	//jquery-way
	//orientation: 'horizontal',

	//Range
	//jquery-way
	range: true, //min, max

	//Multiple values
	//? multidimensional multivalues?
	//jqueryui
	//NO: use just value as array
	//values: [a,b],

	//snapping function: rigid/loose
	snap: false,
	//?or precision?

	//focusable, controllable
	keyboard: true,

	readonly: false,

	//TODO: consider this
	thumbClass: 'draggable',

	//Callbacks
	onchange: null,
	oncreate: null,
	onslide: null,
	onstart: null,
	onstop: null

}

Component.register(Slidy);