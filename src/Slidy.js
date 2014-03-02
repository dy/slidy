/**
* Range input on steroids
*/
var Slidy = Component.register('Slidy', {
	create: function(){

		//solve h/v question
		if (this.vertical) this.horizontal = false;

		//detect how many dimensions needed
		this.dimensions = this.value.length;
		if (this.dimensions === 2) {
			this.horizontal = false;
			this.vertical = false;
		}

		//ensure picker with enough dimensions
		//TODO: take into account restrictwithin paddings

		//ensure picker's position according to the value
		//this.value = this.value;

		//create enough pickers
		this.picker = new Draggable({
			within: this,
			axis: this.horizontal && !this.vertical ? 'x' : (this.vertical && !this.horizontal ? 'y' : false),
			ondrag: this.handleDrag
			//native: false
		})

		//calc initial picker limits
		//TODO: find out picker height/width
		// var thisPads = paddings(this);
		// this.picker.limits.left = thisPads.left;
		// this.picker.limits.top = thisPads.top;
		// this.picker.limits.right = this.offsetWidth - thisPads.right;
		// this.picker.limits.bottom = this.offsetHeight - thisPads.bottom;

		//set initial position according to the value
		//this.moveToValue.call(this);

		this.appendChild(this.picker);

		//bind data to listen
		if (this.expose) {
			//TODO:
			//new Expose(this);
		}

		return this;
	},

	//picker handler - moves thumb, if needed, fires change event
	handleDrag: function(e){
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
	},

	//moves picker to the value
	//TODO: calc this without picker being added to the DOM
	moveToValue: function(){
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
	},


	//-----------settings
	states: {
		default: {
			//click:
		}
	},

	options: {
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
});