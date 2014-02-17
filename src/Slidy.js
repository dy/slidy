/**
* Range input on steroids
*/
class Slidy extends Component{
	constructor(el, opts){
		var self = super(el, opts);

		//solve h/v question
		if (self.vertical) self.horizontal = false;

		//detect how many dimensions needed
		self.dimensions = self._value.length;
		if (self.dimensions === 2) {
			self.horizontal = false;
			self.vertical = false;
		}

		//ensure picker with enough dimensions
		//TODO: take into account restrictwithin paddings

		var picker = new Draggable({
			within: self,
			axis: self.horizontal && !self.vertical ? 'x' : (self.vertical && !self.horizontal ? 'y' : false),
			ondrag: function(e){
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
				if (self.dimensions === 2){
					var normalValue = [(thumb.x - lim.left) / hScope, ( - thumb.y + lim.bottom) / vScope];
					self._value = [
						normalValue[0] * (self.max[0] - self.min[0]) + self.min[0],
						normalValue[1] * (self.max[1] - self.min[1]) + self.min[1]
					];
				} else if (self.vertical){
					var normalValue = (- thumb.y + lim.top) / vScope;
					self._value = normalValue * (self.max - self.min) + self.min;
				} else if (self.horizontal){
					var normalValue = (thumb.x - lim.left) / hScope;
					self._value = normalValue * (self.max - self.min) + self.min;
				}

				//reflect attr
				if (!self._reflectAttrTimeout){
					self.setAttribute("value", stringify(self._value))
					self._reflectAttrTimeout = setTimeout(function(){
						clearTimeout(self._reflectAttrTimeout);
						self._reflectAttrTimeout = null;
						self.setAttribute("value", stringify(self._value))
					}, 500);
				}

				//console.clear();
				//console.log(thumb.x, hScope, self._value)

				//trigger onchange
				self.fire("change")
			},
			//native: false
		})

		//new Datasource(picker);

		self.appendChild(picker);

		return self;
	}

	//redefine getters/setters
	get value(){
		return this._value;
	}

	set value(newValue){
		this._value = newValue;
		//TODO: move picker to the proper position
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