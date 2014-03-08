/**
* Controller on elements
* Workhorse of components
*/
(function(global){
	var KEYCODES = {
        33: "PAGE_UP",
        34: "PAGE_DOWN",
        35: "END",
        36: "HOME",
        37: "LEFT_ARROW",
        38: "UP_ARROW",
        39: "RIGHT_ARROW",
        40: "DOWN_ARROW"
    };
    var LEFT_MOUSE_BTN = 0;

	//TODO: add document-level listener pluginName:event
	//TODO: think how should it work within components group, like active tab
	//TODO: private methods (_+...) should be hjidden on instances
	//TODO: handle disabled property at start
	//TODO: add lifecycle events
	//TODO: passing `ondrag` to option causes native unpreventable events fire
	//TODO: bind event-attributes like so: ondrag="{{ handleDrag }}"
	//TODO: enteredView, leftView callbacks
	//TODO: check correctness of option notation (default exists)
	//TODO: make `throttle` method to call something not more often than Nms
	//TODO: make `async` method to defer calling
	//TODO: make promises: promise to call some method when some event occurs

	//TODO: add custom methods to options objects
	//TODO: pass constructor to the component instance


	//correct attribute setter - reflects value changed with throttling
	var _reflectAttrTimeout;
	//TODO: make absent attributes return default values instead of false
	function _updateAttr($el, key, value, isFinal){
		//throttle attr reflection
		if (!_reflectAttrTimeout){
			//TODO: move $el somewere to the beginning
			var prefix = Component.safeAttributes ? "data-" : "";

			//dashify case
			key = toDashedCase(key);

			if (value === false || value === null || value === undefined){
				//hide falsy attributes
				$el.removeAttribute(key);
			} else {
				//avoid self attr-observer catch $el attr changing
				$el._preventOneAttrChange = true;
				$el.setAttribute(prefix + key, stringify(value));
			}

			_reflectAttrTimeout = !isFinal && setTimeout(function(){
				clearTimeout(_reflectAttrTimeout);
				_reflectAttrTimeout = null;
				_updateAttr($el, key, value, true);
			}, 500);
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
			if (el && !opts){
				//opts passed as a first argument
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

		//ignore disabled
		// if (self.getAttribute('disabled') !== null) {
		// 	console.log('Component `' + self.constructor.lname + "` is disabled")
		// 	return self;
		// }

		//init options, states, API, etc
		init(self, opts);

		return self;
	};


	//component initialiser
	function init($el, opts){
		//init state
		initStates($el);

		$el.state = "init";
		//TODO: init API
		//initAPI($el)

		//keep track of instances;
		$el._id = $el.constructor.instances.length;
		$el.constructor.instances.push($el);

		//treat element
		$el.classList.add($el.constructor.lname);

		//init options
		initOptions($el, opts);


		//if element in DOM already - go ready
		//TODO: observe DOM, look for insertion, removal events
		if ($el.parentNode instanceof HTMLElement) {
			$el.state = "ready"
		} else {
			//if element is not in DOM - go detached
			$el.state = "detached"
		}
	}


	/**
	* Simply binds methods to instance
	*/
	function initAPI($el){
		for (var meth in $el){
			if (!$el.hasOwnProperty(meth)) continue;
			if (typeof $el[meth] === "function")
				$el[meth] = $el[meth].bind($el);
			console.log("bind API", meth)
		}
	}


	/**
	* Instance options initializer
	*/
	//TODO: hook up attributeChanged listeners, to reflect values of attributes
	//TODO: keep callbacks
	//TODO: handle lifecycle events
	function initOptions($el, extOpts){
		//read dataset attributes
		extOpts = extend(parseAttributes($el), extOpts);

		//for every instance option create attribute reflection (just set value)
		for (var key in extOpts){
			//ignore autolaunch property
			//TODO: think of using name-attribute value (e.g. in picker)
			if (key === $el.constructor.lname) continue;

			//catch option
			if (key in $el.options) {
				//option
				//console.log('attr', key, extOpts[key])
				$el[key] = extOpts[key];
			} else if (typeof extOpts[key] === 'function') {
				//listener
				var cb = extOpts[key];
				var evt = (key.slice(0,2) === "on") ? key.slice(0, 2) : key;
				//console.log('listener', key)
				$el.on(evt, cb.bind($el));
			} else {
				//other value (ignore)
			}
		}

		//register observers for data-attributes
		$el._observer = new MutationObserver(function(mutations) {
			if ($el._preventOneAttrChange){
				$el._preventOneAttrChange = true;
				return //console.log("attr change prevented", mutations);
			}

			for (var i = 0; i < mutations.length; i++){
				var mutation = mutations[i];
				//console.log(mutation, mutation.type)
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
			attributes: true,
			childList: true,
			subtree: true,
			characterData: true
		}
		$el._observer.observe($el, $el._observeConfig)
	}


	/**
	* Instance states initilizer
	* Binds functions, recognizes objects to call
	* Instance states are parsed to object of type:
	* { state: { event: {src: $el, evt: 'ename', fn: fn], ... } }
	*/
	//TODO: deal with extStates passed (via instance options)
	function initStates($el, extStates){
		var protoStates = $el.states;
		$el.states = {};

		for (var stateName in protoStates){
			//create instance state based on proto states
			var protoState = protoStates[stateName],
				instanceState = {};

			//recognize events strings: src, evt, delegate
			//possible evt id:
			//`[document|window|selector]? event[:delegate(.something > .which > is > #listening)]`
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

				//unravel events
				var evtDirectives = evtId.split(',');
				for (var i = 0; i < evtDirectives.length; i++){
					var evtDirective = evtDirectives[i].trim();
					var evt, src, delegate;

					var evtParams = evtDirective.split(" ");

					//detect source
					if (evtParams[0] === 'document'){
						src = document;
						evtParams = evtParams.slice(1);
					} else if (evtParams[0] === 'window'){
						src = window;
						evtParams = evtParams.slice(1);
					} else if (evtParams[0] === 'parent' || evtParams[0] === '..'){
						//parent
						src = $el.parentNode;
						evtParams = evtParams.slice(1);
					} else if (evtParams[0][0] === '.' || evtParams[0][0] === '#' || evtParams[0][0] === '['){
						//custom one-word selector
						src = $(evtParams[0]);
						evtParams = evtParams.slice(1);
					} else {
						src = $el;
					}

					//is there delegatees?
					delegateParts = evtParams[0].split(":");
					if (delegateParts > 1) {
						//yes
						var delegateStr = delegateParts[1];
						//TODO
						delegate = delegateStr;
					} else {
						//no
						delegate = null;
					}

					//detect evt name
					evt = delegateParts[0];

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
		//console.log("States", $el.states)
	}


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
	* State switcher
	*/
	//TODO: prevent state being swithed within transitional `before` and `after`, switch only by result of before/after
	Object.defineProperty(Component.prototype, "state",
		{
			configurable: false,
			enumerable: false,
			get: function(){
				return this._state;
			},
			set: function(newStateName){
				if (!this.states[newStateName]){
					throw new Error("No state `" + newStateName + "` exist");
				}

				var oldState = this.states[this._state];
				var newState = this.states[newStateName];

				//if state’s been rethought in process
				var reState;

				if (!newState) throw new Error("Not existing state `" + newStateName + "`");

				//console.log(this.constructor.lname + " `" + this._state + "` → `" + newStateName + "`")

				//handle exit
				if (oldState) {
					//trigger exit
					reState = (oldState.after && oldState.after.fn.call(this));
					this.fire("after" + this._state[0].toUpperCase() + this._state.slice(1));

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

				//if new state returned
				if (reState && reState !== newStateName && this.states[reState]){
					newStateName = reState;
					newState = this.states[reState];
				}
				reState = (newState.before && newState.before.fn.call(this));

				//if after returned other state, handle entrance
				while (reState && reState !== newStateName && this.states[reState]) {
					newStateName = reState;
					newState = this.states[reState];
					reState = (newState.before && newState.before.fn.call(this));
				}


				//trigger enter
				this.fire(newStateName);

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
		this._lastState = this.state;
		this.state = "disabled";
		this.fire('disable');
	}
	Component.prototype.enable = function(){
		this.state = this._lastState;
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
		on(this, evt, fn);
		return this;
	}
	Component.prototype.off = function(evt, fn){
		off(this, evt, fn);
		return this;
	}
	//broadcaster
	Component.prototype.fire = function(eName, data){
		fire(this, eName, data);
	}
	//dom node extenders
	Component.prototype.remove = function(){
		this.parentNode.removeChild(this);
		this.state = "detached";
		return this;
	}


	/**
	* Canonical states
	* Reflects lifecycle of any component
	*/
	Component.prototype.states = {
		//element isn’t ready
		init: {
		},

		//element’s been created but hasn’t attached to the DOM yet
		detached: {
		},

		//element is in DOM
		ready: {
		},

		//element is in DOM, but events and attributes are off
		disabled: {
			before: function(){
				this._observer.disconnect();
			},
			after: function(){
				this._observer.observe(this, this._observeConfig);
			}
		}
	}


	//Keyed by name set of components
	Component.registry = {};

	/**
	* Main component registrar
	*/
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

		//keep track of default options
		Descendant.defaults = {};

		//init prototype options as getters/setters
		var propsDescriptor = {};
		for (var key in initObj.options){
			//ignore already defined setter/getter
			if (Object.getOwnPropertyDescriptor(Descendant.prototype, key)) continue;

			//TODO: correct the way options created
			var propDesc = initObj.options[key];

			//assign defaults - prototypical properties
			//NOTE: default values may be of other type than required, like number insteadof array
			//console.log(propDesc)
			//TODO: if default is function - defer it’s calling

			var defaultValue,
				setFn, getFn, expose, changeCb,
				isGlobal, attr, get, set;

			//init option behaviour (variables above)
			if (isObject(propDesc) && 'default' in propDesc) {
				//init propDesc
				//TODO: think whether to use function init
				defaultValue =  propDesc.default;
				setFn = propDesc.set;
				getFn = propDesc.get;
				expose = propDesc.expose;
				changeCb = propDesc.change;
				isGlobal = propDesc.global;
				attr = propDesc.attribute || true;
			} else {
				//just set prototypal value
				defaultValue =  propDesc;
				setFn = null;
				getFn = null;
				set = null;
				get = null;
				changeCb = null;
				isGlobal = false;
				attr = true;
				expose = false;
			}

			//instance-level options
			//set prototype default value (to redefine in instances)
			Descendant.prototype["_" + key] =  defaultValue;

			//define global getters/setters (sets prototypal default value)
			if (isGlobal){
				Object.defineProperty( Descendant.defaults, key, {
					configurable: false,
					enumerable: true,
					//TODO: instances there are not defined yet :( Hope they’ll be hooked up in runtime
					set: _getSet(Descendant.prototype, key, setFn, changeCb, Descendant.instances),
					get: _getGet(Descendant.prototype, key, getFn)
				})
			}

			//define instance getters/setters
			propsDescriptor[key] = {
				//do not delete default properties
				configurable: false,
				//do not enumerate non-instance properties
				enumerable: true,
				get: _getGet(null, key, getFn),
				set: _getSet(null, key, setFn, changeCb)
			}
		}

		//console.log(propsDescriptor)
		Object.defineProperties(Descendant.prototype, propsDescriptor);

		//TODO: think of init descendant global options

		//init API (deep) - all other methods as an API
		//TODO: watch out for correct states inheritance
		initObj.states = extend({}, Component.prototype.states, initObj.states)
		extend(Descendant.prototype, initObj, true);


		//Autoinit already present in DOM elements
		if (initObj.autoinit !== false) autoinit(Descendant);

		return Descendant;
	}


	//options getter/setter constructors
	function _getGet(target, key, get){
		if (get){
			if (target) {
				return function(){
					return get.call(target, target["_" + key]);
				};
			} else {
				return function(){
					return get.call(this, this["_" + key]);
				};
			}
		} else {
			if (target) {
				return function(){
					return target["_" + key];
				};
			} else {
				return function(){
					return this["_" + key];
				}
			}
		}
	}
	function _getSet(target, key, set, change, updateTargets){
		if (updateTargets && target){
			//most probably global option
			return function(value){
				//ignore same value
				if (target['_' + key ] === value) return;

				value = set ? set.call(target,value) : value;
				target['_' + key ] = value;

				//update targets passed
				for (var i = updateTargets.length; i--;){
					_updateTarget(updateTargets[i], key, value, change);
				}
			}
		} else {
			//instance option
			return function(value){
				//ignore same value
				if (this['_' + key ] === value) return ;
				//console.log("set", key, value)

				value = set ? set.call(this,value) : value;
				this['_' + key ] = value;

				_updateTarget(this, key, value, change);
			}
		}
	}
	//option updater on target
	function _updateTarget(target, key, value, change){
		_updateAttr(target, key, value);
		change && change.call(target, value)
		target.fire("optionChanged")
		target.fire(key + "Changed")
	}


	//autoinit found instances in DOM
	function autoinit(component){
		var lname =  component.lname;

		var targets = queryComponents(lname);
		for (var i = 0; i < targets.length; i++){
			var c = new component(targets[i]);
		}
	}



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



	//Generic component behaviour

	//TODO: whether to use data-attributes instead of straight ones, which may be invalid
	Component.safeAttributes = Component.safeAttributes || false;


	//Export
	global["Component"] = Component;
})(window);