/**
* Controller on the elements
* Very similar to native elements
*/
class Component {
	static defaults = {

	}


	constructor (el, opts){
		//NOTE: No need supercall! Weeha!

		this.$el = el;
		this.options = extend({}, this.defaultOptions, this.parseDataset(), opts);

		//TODO: keep track of instances

	}


	//init

	//everything to init DOM
	create(){

	}


	//options stuff
	//TODO: bind options to the element’s attributes, rigidly, through object init (to reflect state through attributes)
	parseDataset(){

	}


	//events utils
	on(evt, fn) {
		this.$el.addEventListener(evt, fn)
	}
	addEventListener(){

	}

	off(evt, fn){
		this.$el.removeEventListener(evt, fn);
	}

	one(evt, fn){
		this.$el.addEventListener(evt, function(){
			fn();
			this.$el.removeEventListener(evt, fn)
		}.bind(this))
	}

	trigger(evt, data){
		//TODO: handle jQuery-way, if there is such
		//TODO: pass data
		this.$el.dispatchEvent(new Event(evt, data));
	}


	//basic behaviour
	enable (){

	}

	disable (){

	}


}