/**
* Range input on steroids
*/
class Slidy extends Component{
	constructor(el, opts){
		var self = super(el, opts);

		//solve h/v question
		if (self.vertical) self.horizontal = false;

		//detect how many dimensions needed
		self.dimensions = self.value.length;
		if (self.dimensions === 2) {
			self.horizontal = false;
			self.vertical = false;
		}

		//ensure picker with enough dimensions
		//TODO: take into account restrictwithin paddings

		//ensure picker's position according to the value
		//self.value = self.value;

		//create enough pickers
		self.picker = new Draggable({
			within: self,
			axis: self.horizontal && !self.vertical ? 'x' : (self.vertical && !self.horizontal ? 'y' : false),
			ondrag: self.handleDrag
			//native: false
		})

		//calc initial picker limits
		//TODO: find out picker height/width
		// var selfPads = paddings(self);
		// self.picker.limits.left = selfPads.left;
		// self.picker.limits.top = selfPads.top;
		// self.picker.limits.right = self.offsetWidth - selfPads.right;
		// self.picker.limits.bottom = self.offsetHeight - selfPads.bottom;

		//set initial position according to the value
		//self.moveToValue.call(self);

		self.appendChild(self.picker);

		//bind data to listen
		if (self.expose) {
			//TODO:
			//new Expose(self);
		}

		return self;
	}

	//picker handler - moves thumb, if needed, fires change event
	handleDrag(e){
		//console.log("drag observed", e.target.dragstate);
		var thumb = e.currentTarget,
			d = thumb.dragstate,
			lim = thumb.limits,
			thumbW = thumb.offsets.width,
			thumbH = thumb.offsets.height,
			//scope sizes
			hScope = (lim.right - lim.left),
			vScope = (lim.bottom - lim.top)

		//TODO: optimize this part
		//calc value based on dragstate
		if (this.dimensions === 2){
			var normalValue = [(thumb.x - lim.left) / hScope, ( - thumb.y + lim.bottom) / vScope];
			this.value = [
				normalValue[0] * (this.max[0] - this.min[0]) + this.min[0],
				normalValue[1] * (this.max[1] - this.min[1]) + this.min[1]
			];
		} else if (this.vertical){
			var normalValue = (- thumb.y + lim.top) / vScope;
			this.value = normalValue * (this.max - this.min) + this.min;
		} else {
			var normalValue = (thumb.x - lim.left) / hScope;
			this.value = normalValue * (this.max - this.min) + this.min;
		}

		//trigger onchange
		this.fire("change")
	}

	//moves picker to the value
	//TODO: calc this without picker being added to the DOM
	moveToValue(){
		var	//relative coords to move picker to
			x = 0,
			y = 0,
			picker = this.picker,
			lim = picker.limits,
			hScope = (lim.right - lim.left),
			vScope = (lim.bottom - lim.top)

		if (this.dimensions == 2){
			var hRange = this.max[0] - this.min[0],
				vRange = this.max[1] - this.min[1],
				ratioX = (this.value[0] - this.min[0]) / hRange,
				ratioY = (this.value[1] - this.min[1]) / vRange

		} else if (this.vertical){
			var vRange = this.max - this.min,
				ratioY = (this.value - this.min) / vRange;

		} else {
			var hRange = this.max - this.min,
				ratioX = (this.value - this.min) / hRange;

		}

		this.picker.x = ratioX * hScope;
		this.picker.y = ratioY * vScope;
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

	//whether to expose self data to document’s scope
	//for declarative bindings
	expose: true,

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