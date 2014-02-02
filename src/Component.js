/**
* Controller on the elements
* Very similar to native elements
*/




class HTMLCustomElement extends HTMLElement {
	/**
	* Uses hack to extend native HTMLElement: swizzles element’s __proto__
	* It’s the only place where `this` isn’t actually an element.
	* All other methods use `this` as element reference
	*/
	constructor (el, opts){
		//TODO: get rid of that hack when native `extends HTMLElement` will work
		if (el instanceof HTMLElement) {
			this.self = el;
		} else {
			if (el){
				opts = el;
			}
			this.self = document.createElement('div');
		}

		//make `self` element, forget about `this`
		var self = this.self;

		//Intrude into el's prototype chain
		//save original element’s prototype, like HTMLDivElement or whatever
		this.originalProto = self.__proto__;
		//make CustomElement as an element’s prototype
		//`this` loses here, from now on use `self` as `this`
		self.__proto__ = this.__proto__;

		//set options as element attributes
		self.setAttributes(opts);

		//TODO: keep track of instances

		//init options
		//self.options = extend({}, self.options, opts);
		//var o = self.options;

		//treat element
		self.classList.add(pluginName);

		self.trigger("create")
		//console.log(self.getBoundingClientRect())
		console.log("HTMLCustomElement constructor")
		return self;
	}

	setAttributes(opts){
		for (var key in opts){
			this.setAttribute(key, opts[key])
			this[key] = opts[key]
		}
	}


	//init
	ok(){
		console.log("ok")
	}



	//options stuff
	//TODO: bind options to the element’s attributes, rigidly, through object init (to reflect state through attributes)
	parseDataset(){

	}


	//events utils
	on(evt, fn) {
		this.$el.addEventListener(evt, fn)
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

	trigger(eName, data){
		//TODO: handle jQuery-way, if there is such
		//TODO: pass data
		//TODO: ie’s work
		//TODO: options callbacks
		//trigger()
		var event = new CustomEvent(eName, data)
		if (this['on' + eName]) this['on' + eName].apply(this, event);
		this.dispatchEvent(event);
	}


	//basic behaviour
	enable (){

	}

	disable (){

	}


}