class Component {
	static defaultOptions = {

	}


	constructor (el, opts){
		//NOTE: No need supercall! Weeha!

		this.$el = el;
		this.options = extend({}, this.defaultOptions, this.parseDataset(), opts);

		//TODO: keep track of instances

	}

	//everything to init DOM
	create(){

	}


	//options stuff
	parseDataset(){

	}




	//basic behaviour
	enable (){

	}

	disable (){

	}


}