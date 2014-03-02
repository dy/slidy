(function(global){
	/**
	* Controller on the elements
	* Very similar to native elements
	*/


	//TODO: add document-level listener pluginName:event
	//TODO: think how should it work within components group, like active tab
	//TODO: private methods (_+...) should be hjidden on instances
	//TODO: handle disabled property at start
	//TODO: add lifecycle events
	//TODO: passing `ondrag` to option causes native unpreventable events fire

	/**
	* Simply binds methods to instance
	*/
	function initAPI($el){
		for (var meth in $el){
			if (!Object.hasOwnProperty(meth)) continue;
			if (typeof $el[meth] === "function")
				$el[meth] = $el[meth].bind($el);
		}
	}


	/**
	* Instance options initializer
	*/
	//TODO: hook up attributeChanged listeners, to reflect values of attributes
	//TODO: keep callbacks
	function initOptions($el, extOpts){
		//read dataset attributes
		extOpts = extend(parseAttributes($el), extOpts);

		//for every instance option create attribute reflection (just set value)
		for (var key in extOpts){
			$el[key] = extOpts[key];
		}

		//register observers for data-attributes
		$el._observer = new MutationObserver(function(mutations) {
			if ($el._preventOneAttrChange){
				$el._preventOneAttrChange = true;
				return //console.log("attr change prevented");
			}

			for (var i = 0; i < mutations.length; i++){
				var mutation = mutations[i];
				if (mutation.type === "attributes"){
					var attr = mutation.attributeName;
					//if option attr changed - upd self value
					if ($el.options[attr]){
						//TODO: catch attribute removal
						//TODO: avoid attr self-setup
						console.log("Attribute externally changed", parseAttr($el.getAttribute(attr)))
						$el["_" + attr] = parseAttr($el.getAttribute(attr));
					}
				}
			}
		}.bind($el));
		$el._observeConfig = {
			attributes: true
		}
		observeAttrChange($el);
	}


	/**
	* Instance states initilizer
	* Binds functions, recognizes objects to call
	* States parsed to object like
	* { state: { event: [src, delegate, fn], event: [src, delegate, fn], ... } }
	*/
	function initStates($el, states){
		var protoStates = $el.states;
		$el.states = {};

		for (var stateName in protoStates){
			//create instance state based on proto states
			var protoState = protoStates[stateName],
				instanceState = {};

			//recognize events strings: src, evt, delegate
			//possible evt id:
			//`on('[document|window]? super:event .something > .which > is > #listening', fn)`
			//console.log("bind state", stateName , protoState)
			for (var evtId in protoState){
				//bind fn
				var fnRef = protoState[evtId], fn = undefined;
				if (typeof fnRef === "function"){
					fn = fnRef.bind($el);
				} else if (typeof fnRef === "string" && $el[fnRef]){
					//NOTE: no need to bind `fn` here because it’s already been bound in `initAPI`
					fn = $el[fnRef]//.bind($el);
					//console.log(evt, fnRef, fn)
				}

				var evtDirectives = evtId.split(',');
				for (var i = 0; i < evtDirectives.length; i++){
					var evtDirective = evtDirectives[i].trim();
					var evt = undefined, src = undefined, delegate = undefined;

					var evtParams = evtDirective.split(" ");

					//detect source
					if (evtParams[0] === 'document'){
						src = document;
						evtParams = evtParams.slice(1);
					} else if (evtParams[0] === 'window'){
						src = window
						evtParams = evtParams.slice(1);
					} else {
						src = $el;
					}

					//detect evt name
					evt = evtParams[0];

					//is there delegatees?
					delegate = evtParams.slice(1).join('');

					//collect class instance state
					if (fn && evt){
						instanceState[evt] = {
							evt: evt,
							src: src,
							delegate: delegate,
							fn: fn
						};
					}
				}
			}
			//console.log("state", instanceState)
			$el.states[stateName] = instanceState;

		}
		//console.log("States", this.states)
	}

	/**
	* Attributes listeners
	*/
	function observeAttrChange($el){
		$el._observer.observe($el, $el._observeConfig)
	}

	function ignoreAttrChange($el){
		$el._observer.disconnect();
	}

	//correct attribute setter - reflects value changed with throttling
	function updateAttr($el, key, value){
		//TODO: throttle attr reflection
		if (!$el._reflectAttrTimeout){
			//TODO: move $el somewere to the beginning
			var prefix = Component.safeAttributes ? "data-" : "";

			//dashify case
			key = toDashedCase(key);

			//hide falsy attributes
			if (value === false){
				$el.removeAttribute(key);
			} else {
				//avoid self attr-observer catch $el attr changing
				$el._preventOneAttrChange = true;
				$el.setAttribute(prefix + key, stringify(value));
			}

			$el._reflectAttrTimeout = setTimeout(function(){
				clearTimeout($el._reflectAttrTimeout);
				$el._reflectAttrTimeout = null;

			}, 500);
		}
	}
	//TODO: these guys cause stack overflow because try to set themselves
	/*set disabled(val){
		if (val) {
			this.setAttribute("disabled", true);
			this.disabled = true;
		} else {
			this.removeAttribute("disabled")
			this.disabled = false;
		}
	}
	get disabled(){
		return this.disabled;
	}*/

	//autoinit found instances in DOM
	function autoinit(component){
		var lname =  component.lname,
			selector = ["[", lname, "], [data-", lname, "], .", lname, ""].join("");

		var targets = document.querySelectorAll(selector);
		for (var i = 0; i < targets.length; i++){
			new component(targets[i]);
		}
	}




	/**
	* Component constructor
	*/
	//just wrapper over real constrctor
	function Component(el, opts){
		//ensure element created
		//ensure DOM extensibility
		//read options (el/passed)
		//hook up events
		//bind API methods
		//init instance states

		//Substitute `this` with DOM element
		//TODO: get rid of that hack when native `extends HTMLElement` will work
		var self;
		if (el instanceof HTMLElement) {
			self = el;
		} else {
			if (el){
				opts = el;
			}
			self = document.createElement('div');
		}

		//TODO: resolve prototype chain, if there’re more Component-ancestored elements
		//Intrude into el's prototype chain
		//save original element’s prototype, like HTMLDivElement or whatever
		var originalProto = self.__proto__;
		//`this` loses here
		self.__proto__ = this.constructor.prototype;
		self.constructor = this.constructor;

		//init API
		initAPI(self)

		//init options
		initOptions(self, opts);

		//keep track of instances;
		self._id = self.constructor.instances.length;
		self.constructor.instances.push(self);

		//init state
		initStates(self);
		self.state = 'default';

		//treat element
		self.classList.add(this.constructor.lname);

		//callbacks
		self.fire("create", null)
		//console.log(self.getBoundingClientRect())
		//console.log("HTMLCustomElement constructor")

		self.create && self.create.apply(self, arguments)
		return self;
	};

	Component.lname = "component"

	//Prototype is inherital for children elements
	Component.prototype = Object.create(HTMLElement.prototype);

	//TODO: state criterias (visible/hidden) (active/inactive) (disabled/enabled) ...
	//TODO: state callbacks & declarative behaviour
	//TODO: adding states, declaratively
	//TODO: changing states through methods

	/**
	* Uses hack to extend native HTMLElement: swizzles element’s __proto__
	* It’s the only place where `this` isn’t actually an element.
	* All other methods use `this` as element reference
	*/

	Component.prototype.constructor = Component;


	/**
	* Gross attributes setter
	*/
	Component.prototype.setAttributes = function(opts){
		for (var key in opts){
			this[key] = opts[key]
		}
	}
	/**
	* Get object settings
	*/
	Component.prototype.getAttributes = function(){
		var result = {}
		for (var key in this.constructor.defaults){
			result[key] = this[key];
		}
		return result;
	}

	/**
	* States
	*/
	Object.defineProperty(Component.prototype, "state",
		{
			configurable: false,
			enumerable: false,
			get: function(){
				return this._state;
			},
			set: function(newStateName){
				var oldState = this.states[this._state];
				var newState = this.states[newStateName] || this.states['default'];
				if (!newState) throw new Error("Not existing state `" + newStateName + "`");

				//console.log("State `" + this._state + "` → `" + newStateName + "`")

				//handle exit
				if (oldState) {
					//trigger exit
					oldState.after && oldState.after.fn.call(this);
					this.fire("after" + this._state[0].toUpperCase() + this._state.slice(1) + "State");
					this.fire("afterState");

					//unbind old state events
					for(var evt in oldState){
						var stateEvt = oldState[evt]
						off(
							stateEvt.src,
							stateEvt.evt,
							stateEvt.fn
						);
					}
				}

				//handle enter
				//trigger enter
				newState.before && newState.before.fn.call(this);
				this.fire("before" + newStateName[0].toUpperCase() + newStateName.slice(1) + "State");
				this.fire("beforeState");

				//bind new state events
				for(var evt in newState){
					var stateEvt = newState[evt]
					on(
						stateEvt.src,
						stateEvt.evt,
						//stateEvt.delegate,
						stateEvt.fn
					);

					//console.log(stateEvt)
				}

				this._state = newStateName;
			}
		});


	/**
	* Common component behaviour - enabled/disabled
	*/
	Component.prototype.disable = function(){
		this.disabled = true;
		ignoreAttrChange($el);
		this.fire('disable');
	}
	Component.prototype.enable = function(){
		this.disabled = false;
		observeAttrChange(this);
		this.fire('enable');
	}

	//----------------------Events
	//as jquery one does
	Component.prototype.one = function(evt, fn){
		this.addEventListener(evt, function(){
			fn.apply(this);
			this.removeEventListener(evt, fn)
		}.bind(this))
	}

	//TODO: handle `:delegate` listener event, as x-tags does
	//listener wrapper, just makes chaining
	Component.prototype.on = function(evt, fn){
		this.addEventListener(evt, fn);
		return this;
	}
	Component.prototype.off = function(evt, fn){
		this.removeEventListener(evt, fn);
		return this;
	}
	//broadcaster
	Component.prototype.fire = function(eName, data){
		fire(this, eName, data);
	}



	//Main component registar, xtags-like
	Component.register = function(name, initObj){
		//create new component
		var Descendant = function(){
			return Component.apply(this, arguments)
		};
		Descendant.prototype = Object.create(Component.prototype);
		Descendant.prototype.constructor = Descendant;

		//check whether component exists
		if (Component.registry[name]) throw new Error("Component `" + name + "` already exists");

		//save to registry
		Component.registry[name] = Descendant;

		//keep track of instances
		Descendant.instances = [];
		Descendant.name = name;
		Descendant.lname = name.toLowerCase();

		//TODO:init options
		//init default options as prototype getters/setters with trigger
		var propsDescriptor = {};
		for (var key in initObj.options){
			//TODO: correct the way options created
			var propDesc = initObj.options[key];

			//assign defaults - prototypical properties
			//NOTE: default values may be of other type than required, like number insteadof array
			//console.log(propDesc)
			Descendant.prototype["_" + key] = (propDesc && propDesc !== null && typeof propDesc === 'object' && ('default' in propDesc)) ? propDesc.default : propDesc;
			//console.log('to', Descendant.prototype["_" + key])

			//ignore already defined setter/getter
			if (Object.getOwnPropertyDescriptor(Descendant.prototype, key)) continue;

			//make instance getter/setters
			//TODO: ensure setters/getters are right (parse special options)
			var get = (function(key, get){
				return function(){
					return get && get.call(this, this['_' + key]) || this['_' + key];
				}
			})(key, propDesc && propDesc.get)

			var set = (function(key, set){
				return function(value){
					//ignore same value
					if (this['_' + key ] === value) return;

					value = set && set.call(this,value) || value;
					this['_' + key ] = value;
					updateAttr(this, key, value);
					this.fire("optionChanged")
					this.fire(key + "Changed")
				}
			})(key, (propDesc && propDesc.set))

			//TODO: parse attribute settings

			propsDescriptor[key] = {
				//do not delete default properties
				configurable: false,
				//do not enumerate non-instance properties
				enumerable: false,
				get: get,
				set: set
			}
		}
		//console.log(propsDescriptor)
		Object.defineProperties(Descendant.prototype, propsDescriptor);

		//init API (options + states as well)
		extend(Descendant.prototype, initObj);

		//Autoinit DOM elements
		autoinit(Descendant);


		return Descendant;
	}

	//Keyed by name set of components
	Component.registry = {};


	//Component constructor, just to use as a fabric method
	Component.create = function(){
		return new this.prototype.constructor.apply(this, arguments)
	}



	//Autolaunch registered components when document is ready
	//TODO: probably it is better to init components before Ready - values, at least, should be there beforehead
	/*document.addEventListener("DOMContentLoaded", function(){
		for (var name in Component.registry){
			var Descendant = Component.registry[name];

			var lname = Descendant.lname,
				selector = ["[", lname, "], [data-", lname, "], .", lname, ""].join("");

			//init all elements in DOM
			var targets = document.querySelectorAll(selector);
			for (var i = 0; i < targets.length; i++){
				new Descendant(targets[i]);
			}
		}
	})*/
	//init every element [classname], [data-classname] or .classname



	//----------Init generic component behaviour

	//whether to use data-attributes instead of straight ones, which may be invalid
	Component.safeAttributes = Component.safeAttributes || false;

	//whether to init components on
	Component.autoinit = Component.autoinit || true;

	//Whether to expose descendant classes to global
	Component.exposeClasses = Component.exposeClasses || true;


	//Export
	global["Component"] = Component;
})(window);