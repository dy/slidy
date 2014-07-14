/**
* ----------- Env detection
*/
//prefix detector
var win = window, doc = document, root = doc.documentElement, body = document.body, global = (1,eval)('this'), head = doc && doc.querySelector("head");

var prefix = (function () {
	var pre;
	if (win.getComputedStyle) {
		var styles = win.getComputedStyle(root, '');
		pre = (Array.prototype.slice
			.call(styles)
			.join('')
			.match(/-(moz|webkit|ms)-/) || (styles.OLink === '' && ['', 'o'])
		)[1];
	} else pre = 'ms'
	return {
		dom: pre == 'ms' ? 'MS' : pre,
		css: '-' + pre + '-',
		lowercase: pre,
		js: pre == 'ms' ? pre : capfirst(pre)
	};
})();


var MO = win.MutationObserver || win[prefix.js + 'MutationObserver'];

var matchSelector = Element.prototype.matchesSelector || Element.prototype[prefix.lowercase + 'MatchesSelector'];

//jquery guarant
var $ = (typeof $ !== "undefined" && $) || (typeof jQuery !== "undefined" && jQuery) || undefined;

//custom elements
var register = doc.registerElement || doc.register;

//this is just a list of common native values
var DOMAttributes = {
	'class': true,
	id: true,
	style: true,
	name: true,
	type: true,
	src: true,
	link: true,
	href: true,
	disabled: true,
	title: true,
	click: true,
	value: true,
	min: true,
	max: true,
	nodeType: true,
	tagName: true,
	parentNode: true,
	childNodes: true
};

var keyDict = {
	//kbd keys
	"ENTER": 13,
	"ESCAPE": 27,
	"TAB": 9,
	"ALT": 18,
	"CTRL": 17,
	"SHIFT": 16,
	"SPACE": 32,
	"PAGE_UP": 33,
	"PAGE_DOWN": 34,
	"END": 35,
	"HOME": 36,
	"LEFT": 37,
	"UP": 38,
	"RIGHT": 39,
	"DOWN": 40,

	//mouse keys
	"LEFT_MOUSE": 1,
	"RIGHT_MOUSE": 3,
	"MIDDLE_MOUSE": 2
}

//object shortcuts
var defineProperty = Object.defineProperty;


/**
* ------------ Utils
*/
function extend(a){
	var l = arguments.length;

	for (var i = 1; i<l; i++){
		var b = arguments[i];
		if ((isObject(a) || isFn(a)) && isObject(b)) {
			for (var k in b){
				if (has(b, k)){
					a[k] = b[k]
				}
			}
		} else if (b !== undefined){
			a = b;
		}
	}

	return a;
}

function deepExtend(a){
	var l = arguments.length;
	if (!isObject(a) && !isFn(a)) a = {};

	for (var i = 1; i<l; i++){
		var b = arguments[i], clone;

		if (!isObject(b)) continue;

		for (var key in b) {
			if (!has(b, key)) continue;

			var src = a[key];
			var val = b[key];

			if (!isObject(val)) {
				a[key] = val;
				continue;
			}

			if (isObject(src)) {
				clone = src;
			} else if (Array.isArray(val)) {
				clone = (Array.isArray(src)) ? src : [];
			} else {
				clone = {};
			}

			a[key] = deepExtend(clone, val);
		}
	}

	return a;
}

//sinple clone of any value passed (mod instance init)
function clone(a){
	if (a instanceof Array) {
		return a.slice();
	}
	// if (isElement(a)){
	// 	return a.cloneNode(true);
	// }
	if (isObject(a)){
		return deepExtend({}, a);
	}
	return a;
}

//isPlainObject
function isObject(value){
	var Ctor, result;

	// return (a && a !== null &&  && !(a instanceof Array) && !(a.nodeType))

	// avoid non `Object` objects, `arguments` objects, and DOM elements
	if (!(value && (value + '') == '[object Object]') ||
		(!has(value, 'constructor') &&
		(Ctor = value.constructor, isFn(Ctor) && !(Ctor instanceof Ctor))) ||
		!(typeof value === "object")) {
		return false;
	}
	// In most environments an object's own properties are iterated before
	// its inherited properties. If the last iterated property is an object's
	// own property then there are no inherited enumerable properties.
	for(var key in value) {
		result = key;
	};

	return typeof result == 'undefined' || has(value, result);
}

function isFn(a){
	return !!(a && a.apply);
}

function isString(a){
	return typeof a === "string"
}

//compares 2 values properly: arrays, objects
//TODO: simplify
function isEqual(a, b){
	if (a === b) return true;

	if (a instanceof Array && b instanceof Array){
		var eq = false;
		if (a.length !== b.length) return false;

		for (var i = 0; i < a.length; i++){
			if (!isEqual(a[i], b[i])) {
				return false;
			}
		}

		return true;
	} else if (isObject(a) && isObject(b)){
		for (var key in a){
			if (!isEqual(a[key], b[key])) return false;
		}
		for (var key in b){
			if (!isEqual(a[key], b[key])) return false;
		}

		return true;
	}

	return false;
}

//detects whether element is able to emit/dispatch events
//TODO: detect eventful objects in a more wide way
function isEventTarget(target){
	return has(target, 'addEventListener') ;
}

function isElement(target){
	return target instanceof HTMLElement
}

//speedy implementation of in
//NOTE: `!target[propName]` 2-3 orders faster than `!(propName in target)`
function has(a, b){
	if (!a) return false;
	//NOTE: this causes getter fire
	if (a[b]) return true;
	return b in a;
	// return a.hasOwnProperty(b);
}

//returns constant value getter
function getValueGetter(value){
	return function(){
		return value;
	}
}



/**
* ------------ Scopes
*/
//set of object's scopes, keyed by id
var scopes = {};

//instances transparent id
var gId = 0;
var idKey = "__modId__";
var scopeKey = "_";
function getUniqueId(){
	return gId++;
}

//get any object-associated scope
//TODO: rewrite it using maps
function getScope(obj){
	var id = getId(obj);
	return scopes[id];
}

//get object uniq id
function getId(obj){
	if (!has(obj, idKey)){
		setId(obj, getUniqueId());
	}
	return obj[idKey];
}
//defines id on target pased
function setId(obj, id){
	//ensure scope
	if (!scopes[id]) scopes[id] = {};
	//set unique id
	defineProperty(obj, idKey, {
		value: id,
		writable: false,
		configurable: false,
		enumerable: false
	})
	//set scope reference
	defineProperty(obj, scopeKey, {
		value: scopes[id],
		writable: false,
		configurable: false,
		enumerable: false
	})
}





/**
* ------------ Events
*/
//split every comma-separated element
var _commaSplitRe = /\s*,\s*/;

//match every comma-separated element ignoring 1-level parenthesis, like `1,2(3,4),5`
// var _commaMatchRe = /([^,]*?(?:\([^()]+\))?)(?=,)|,([^,]*?(?:\([^()]+\))?)(?=$)/g
var _commaMatchRe = /(,[^,]*?(?:\([^()]+\)[^,]*)?)(?=,|$)/g

//iterate over every item in string
function each(str, fn){
	var list = ("," + str).match(_commaMatchRe) || [''];
	for (var i = 0; i < list.length; i++) {
		// console.log(matchStr)
		var matchStr = list[i].trim();
		if (matchStr[0] === ",") matchStr = matchStr.slice(1);
		matchStr = matchStr.trim();
		fn(matchStr, i);
	}
}
//method reference could be passed
//TODO: make on be able to listen to plain object targets
var _modifierParamsRe = /\(([^)]*)\)/;

var selfPropertyKey = "@";

function on($el, evtRefs, fn){
	// console.log("on", evtRefs)
	var methName, scope;

	//FIXME: make eventful
	//ignore non-event-targets
	// if (!isEventTarget($el)) return false;

	each(evtRefs, function(evtRef){
		var evtObj = _parseEvtRef($el, evtRef), targetFn = fn;

		if (!isEventTarget(evtObj.src)) return;

		//ignore bound method reference
		if (methName && scope['_' + evtRef + methName]) return;

		evtObj.modifiers.forEach(function(modifier){
			if (/^onc?e/.test(modifier)){
				targetFn = evtModifiers.one(evtObj.evt, targetFn)
			} else if (/^delegate/.test(modifier)){
				//parse params
				var selector = modifier.match(_modifierParamsRe)[1]
				targetFn = evtModifiers.delegate(evtObj.evt, targetFn, selector)
			} else if (/^pass/.test(modifier)){
				var keys = modifier.match(_modifierParamsRe)[1].split(_commaSplitRe).map(upper);
				targetFn = evtModifiers.pass(evtObj.evt, targetFn, keys);
				// console.log("bind", targetFn)
			} else if (/^throttle/.test(modifier)){
				var interval = parseFloat(modifier.match(_modifierParamsRe)[1]);
				targetFn = evtModifiers.throttle(evtObj.evt, targetFn, interval);
			} else if (/^defer/.test(modifier)){
				var delay = parseFloat(modifier.match(_modifierParamsRe)[1]);
				targetFn = evtModifiers.defer(evtObj.evt, targetFn, delay);
			} else {
				//recognize modifiers as a part of event
				evtObj.evt += ":" + modifier
			}
		})

		//bind target fn
		if ($){
			//delegate to jquery
			$(evtObj.src).on(evtObj.evt, targetFn);
		} else {
			//listen element
			evtObj.src.addEventListener(evtObj.evt, targetFn)
		}
	})

	return fn;
}

function off($el, evtRefs, fn){
	each(evtRefs, function(evtRef){
		var evtObj = _parseEvtRef($el, evtRef);

		if (!fn) return;

		if ($){
			//delegate to jquery
			$(evtObj.src).off(evtObj.evt, fn);
		} else {
			//listen element
			evtObj.src.removeEventListener(evtObj.evt, fn)
		}
	})

	return fn;
}

//event callbacks modifiers factory
//TODO: automatically identify all these modifiers in `on`
var DENY_EVT_CODE = 1;
var evtModifiers = {
	//call callback once
	one: function(evt, fn){
		var cb = function(e){
			// console.log("once cb", fn)
			var result = fn && fn.call(this, e);
			result !== DENY_EVT_CODE && off(this, evt, cb);
			return result;
		}
		return cb;
	},

	//filter keys
	pass: function(evt, fn, keys){
		var cb = function(e){
			var pass = false, key;
			for (var i = keys.length; i--;){
				key = keys[i]
				var which = 'originalEvent' in e ? e.originalEvent.which : e.which;
				if ((key in keyDict && keyDict[key] == which) || which == key){
					pass = true;
					return fn.call(this, e);
				}
			};
			return DENY_EVT_CODE;
		}
		return cb
	},

	//filter target
	delegate: function(evt, fn, selector){
		var cb = function(e){
			// console.log("delegate cb", e.target, selector)
			if (!(e.target instanceof HTMLElement)) return DENY_EVT_CODE;

			var target = e.target;

			while (target && target !== this) {
				if (matchSelector.call(target, selector)) return fn.call(this, e);
				target = target.parentNode;
			}

			return DENY_EVT_CODE;
		}
		return cb;
	},

	//throttle call
	throttle: function(evt, fn, interval){
		// console.log("thro", evt, fn, interval)
		var cb = function(e){
			// console.log("thro cb")
			var self = this,
				scope = getScope(self),
				throttleKey = '_throttle' + evt;

			if (scope[throttleKey]) return DENY_EVT_CODE;
			else {
				var result = fn.call(self, e);
				if (result === DENY_EVT_CODE) return result;
				scope[throttleKey] = setTimeout(function(){
					clearInterval(scope[throttleKey]);
					scope[throttleKey] = null;
				}, interval);
			}
		}

		return cb
	},

	//defer call - call Nms later invoking method/event
	defer: function(evt, fn, delay){
		// console.log("defer", evt, delay)
		var cb = function(e){
			// console.log("defer cb")
			var self = this;
			setTimeout(function(){
				return fn.call(self, e);
			}, delay);
		}

		return cb
	}
}

//returns parsed event object from event reference
function _parseEvtRef($el, evtRef){
	// console.group("parse reference", '`' + evtRef + '`')
	var evtDecl = evtRef.match(/\w+(?:\:\w+(?:\(.+\))?)*$/)[0];
	// console.log(evtDecl)
	var evtObj = {};
	evtRef = evtRef.slice(0, -evtDecl.length).trim()
	// console.log("result ref", evtRef)

	evtObj.src = parseTarget($el, evtRef)

	var evtDeclParams = unprefixize(evtDecl, "on").split(":");

	evtObj.evt = evtDeclParams[0];
	evtObj.modifiers = evtDeclParams.slice(1).sort(function(a,b){
			//:once modifier should be the last one
		return /onc?e/.test(a) ? 1 : -1
	});

	// console.log(evtObj)
	// console.groupEnd();
	return evtObj;
}

//detect source element from string
function parseTarget($el, str) {
	if (!str){
		return $el
	} if (/^document/i.test(str)) {
		return doc;
	} if (/^body/i.test(str)) {
		return body;
	} else if (/^window/i.test(str)) {
		return win;
	} else if (/^root/i.test(str)) {
		return root
	}  else if (/parent/i.test(str) || '..' === str) {
		return $el.parentNode
	} else if (str[0] === '@') {
		//`this` reference
		// return $el[str.slice(1)]
		return str;
	} else if (/^[.#[]/.test(str)) {
		//custom one-word selector
		return doc.querySelector(str);
	} else {
		return $el
	}
}

function preventDefault(e){
	e.preventDefault()
}

//no operation
function noop(){}

//dispatch event
function fire(el, eventName, data, bubbles){
	if ($){
		//TODO: decide how to pass data
		var event = $.Event( eventName, data );
		event.detail = data;
		bubbles ? $(el).trigger(event) : $(el).triggerHandler(event);
	} else {
		//NOTE: this doesnot bubble in disattached elements
		var event;
		if (!(eventName instanceof Event)) {
			event =  doc.createEvent("CustomEvent");
			event.initCustomEvent(eventName, bubbles, null, data)
		} else {
			event = eventName;
		}
		// var event = new CustomEvent(eventName, { detail: data, bubbles: bubbles })
		el.dispatchEvent && el.dispatchEvent(event);
	}
}



/**
* ------------- Maths
*/
//limiter
function between(a, min, max){
	return max > min ? Math.max(Math.min(a,max),min) : Math.max(Math.min(a,min),max)
}

function isBetween(a, left, right){
	if (a <= right && a >= left) return true;
	return false;
}

//precision round
function round(value, step) {
	step = parseFloat(step);
	if (step === 0) return value;
	value = Math.round(value / step) * step
	return parseFloat(value.toFixed(getPrecision(step)));
}

//get precision from float: 1.1 → 1, 1234 → 0, .1234 → 4
function getPrecision(n){
	 var s = n + "",
        d = s.indexOf('.') + 1;

    return !d ? 0 : s.length - d;
}



/**
* ------------- Strings
*/
//returns value from string with correct type except for array
//TODO: write tests for this fn
function parseAttr(str){
	var v;
	if (/true/i.test(str)) {
		return true;
	} else if (/false/i.test(str)) {
		return false;
	} else if (!/[^\d\.\-]/.test(str) && !isNaN(v = parseFloat(str))) {
		return v;
	} else if (/\{/.test(str)){
		try {
			return JSON.parse(str)
		} catch (e) {
			return str
		}
	}
	return str;
}

//parse value according to the type passed
function parseTypedAttr(value, type){
	var res;
	if (type instanceof Array) {
		res = parseArray(value);
	} else if (typeof type === "number") {
		res = parseFloat(value)
	} else if (typeof type === "boolean"){
		res = !/^(false|off|0)$/.test(value);
	} else if (isFn(type)){
		res = new Function(value);
	} else if (isString(type)){
		res = value;
	} else if (isObject(type)) {
		res = parseObject(value)
	} else {
		res = parseAttr(value);
	}

	return res;
}

function parseObject(str){
	if (str[0] !== "{") str = "{" + str + "}";
	try {
		return JSON.parse(str);
	} catch (e) {
		return {}
	}
}

//returns array parsed from string
function parseArray(str){
	if (!isString(str)) return [parseAttr(str)]

	//clean str from spaces/array rudiments
	str = str.trim();
	if (str[0] === "[") str = str.slice(1);
	if (str.length > 1 && str[str.length - 1] === "]") str = str.slice(0,-1);

	var result = [];
	each(str, function(value) {
		result.push(parseAttr(value))
	})

	return result;
}

//camel-case → CamelCase
function toCamelCase(str){
	return str && str.replace(/-[a-z]/g, function(match, position){
		return upper(match[1])
	})
}

//CamelCase → camel-case
function toDashedCase(str){
	return str && str.replace(/[A-Z]/g, function(match, position){
		return (position ? "-" : "") + match.toLowerCase()
	})
}

//simple uppercaser
function upper(str){
	return str.toUpperCase();
}

//aaa → Aaa
function capfirst(str){
	str+='';
	if (!str) return str;
	return upper(str[0]) + str.slice(1);
}

// onEvt → envt
function unprefixize(str, pf){
	return (str.slice(0,pf.length) === pf) ? str.slice(pf.length).toLowerCase() : str;
}

//stringify any element passed, useful for attribute setting
function stringify(el){
	if (!el) {
		return '' + el
	} if (el instanceof Array){
		//return comma-separated array
		return el.join(",")
	} else if (el instanceof HTMLElement){
		//return id/name/proper selector
		return el.id

		//that way is too heavy
		// return selector(el)
	} else if (isObject(el)){
		//serialize json
		return JSON.stringify(el);
	} else if (isFn(el)){
		//return function body
		var src = el.toString();
		el.slice(src.indexOf("{") + 1, src.lastIndexOf("}"));
	} else {
		return el.toString();
	}
}




/**
* ------------- CSS things
*/
//returns unique selector for an element
//from https://github.com/rishihahs/domtalk/blob/master/index.js
function selector(element) {
	// Top level elements are body and ones with an id
	if (element === root) {
		return ':root';
	} else if (element.tagName && upper(element.tagName) === 'BODY') {
		return 'body';
	} else if (element.id) {
		return '#' + element.id;
	}

	var parent = element.parentNode;
	var parentLoc = selector(parent);

	// See which index we are in parent. Array#indexOf could also be used here
	var children = parent.childNodes;
	var index = 0;
	for (var i = 0; i < children.length; i++) {
		// nodeType is 1 if ELEMENT_NODE
		if (children[i].nodeType === 1) {
			if (children[i] === element) {
				break;
			}

			index++;
		}
	}

	return parentLoc + ' *:nth-child(' + (index + 1) + ')';
}

//return absolute offsets
function offsets(el){
	if (!el) throw Error("Bad offsets target", el);
	try{
		var rect = el.getBoundingClientRect()
		return {
			top: rect.top + win.pageYOffset,
			left: rect.left + win.pageXOffset,
			width: el.offsetWidth,
			height: el.offsetHeight,
			bottom: rect.top + win.pageYOffset + el.offsetHeight,
			right: rect.left + win.pageXOffset + el.offsetWidth,
			fromRight: win.innerWidth - rect.right,
			fromBottom: (win.innerHeight + win.pageYOffset - rect.bottom)
		}
	} catch(e){
		return {
			top: el.clientTop + win.pageYOffset,
			left: el.clientLeft + win.pageXOffset,
			width: el.offsetWidth,
			height: el.offsetHeight,
			bottom: el.clientTop + win.pageYOffset + el.offsetHeight,
			right: el.clientLeft + win.pageXOffset + el.offsetWidth,
			fromRight: win.innerWidth - el.clientLeft - el.offsetWidth,
			fromBottom: (win.innerHeight + win.pageYOffset - el.clientTop - el.offsetHeight)
		}
	}
}

//return paddings
function paddings($el){
	var style = getComputedStyle($el);

	return {
		top: parseCssValue(style.paddingTop),
		left: parseCssValue(style.paddingLeft),
		bottom: parseCssValue(style.paddingBottom),
		right: parseCssValue(style.paddingRight)
	}
}

//return margins
function margins($el){
	var style = getComputedStyle($el);

	return {
		top: parseCssValue(style.marginTop),
		left: parseCssValue(style.marginLeft),
		bottom: parseCssValue(style.marginBottom),
		right: parseCssValue(style.marginRight)
	}
}

//returns parsed css value
function parseCssValue(str){
	return ~~str.slice(0,-2);
}

//disable any select possibilities for an element
function disableSelection($el){
	css($el, {
		"user-select": "none",
		"user-drag": "none",
		"touch-callout": "none"
	})
	$el.setAttribute("unselectable", "on")
	on($el, 'selectstart', preventDefault)
}

function enableSelection($el){
	css($el, {
		"user-select": null,
		"user-drag": null,
		"touch-callout": null
	})
	$el.removeAttribute("unselectable")
	off($el, 'selectstart', preventDefault)
}

//set of properties to add prefix
var prefixedProps = {
	"user-drag": true,
	"user-select": true,
	"touch-callout": true,
	"transform": true
}

//simple css styler
function css($el, style, value){
	if (value !== undefined) {
		//one property
		if (prefixedProps[style]) style = prefix.css + style;
		$el.style[style] = value;
	} else {
		//obj passed
		var initialDisplay = $el.style.display;
		$el.style.display = "none";
		for (var prop in style){
			if (prefixedProps[prop]) $el.style[prefix.css + prop] = style[prop];
			else $el.style[prop] = style[prop] || "";
		}
		$el.style.display = initialDisplay;
	}
}
//creates `style` tag based on absurdjs-like cssObject
function createLiveStyle(cssObject){
	var style = doc.createElement("style");

	return style
}
/**
* Property controller (sorry, but it has to go first)
*/
function Prop(target, propName, mod, option) {
	var scope = target._;
	var self = this;
	//property exists - avoid creation
	if (scope[propName]) {
		return scope[propName];
	} else {
		//save prop instance to the scope
		scope[propName] = self;

		//ensure inner props are created
		var prop = mod[propName]
		if (isObject(prop)) {
			for (var modName in prop){
				if (propTechNames[modName]) continue;

				var innerMod = prop[modName];

				isMod(innerMod) && innerMod.eachProp(function(subPropName, subProp){
					if (!has(mod, subPropName)) new Prop(target, subPropName, mod);
				})
			}
		}

		//catch inner properties references
		if (propName[0] === selfPropertyKey){
			self.isRefPointer = true;
			self.refProp = propName.split(/\s/)[0].slice(1);
			self.refEvt = propName.slice(self.refProp.length + 1).trim();
			var refProp = new Prop(target, self.refProp, mod);
			refProp.isRefTarget = true;
			refProp.refPointer = propName;
		}
	}

	// console.log('new propety', propName, target[propName], option)

	//save self name, target, mod, optValue, initializer
	self.displayName = propName;
	self.target = target;
	self.initialMod = mod;
	self.optValue = option;
	self.init = isObject(mod[propName]) ? mod[propName].init : mod[propName];

	self.callValueReference = self.callValueReference.bind(self)

	//declare property on the target, if not defined yet
	if (!has(target, propName)) {
		defineProperty(target, propName, {
			configurable: false,
			enumerable: true,
			//FIXME: get rid of these binds
			get: self.getValue.bind(self),
			set: self.setValue.bind(self)
		});
	} else {
		//property exists on target: treat it as native property
		// console.log('existing property', propName)
		//FIXME: handle defined properties properly
		self.isNative = true;
	}

	return self;
}

//NOTE: constructor reference misses in prototype redefinition
Prop.prototype = {
	//TODO: get rid of initValue, use setValue() instead
	//mixes passed property descriptor to self
	setMod: function(mod){
		var self = this,
			scope = self.target._,
			proto = self.constructor.prototype,
			prop;

		//if mod passed has property to redefine - redefine it
		if (mod && has(mod, self.displayName)) {
			prop = mod[self.displayName];
		}
		//if not - just unbind events
		else {
			if (isFn(self.value)) {
				self.setValue(noop);
			}
			return;
		}

		// console.log('applyProp', self.displayName)

		//FIXME: optimize this condition tree

		//fn
		if (isFn(prop)){
			//init inner ref beforehead
			if (self.isRefPointer) {
				var refProp = scope[self.refProp];
				if (!refProp.isInited) refProp.setValue();
			}
			// self.isInited = false;
			self.setValue(prop);
		}

		//plain value
		else if (!isObject(prop)) {
			//init fn reference beforehead
			if (isString(prop)){
				var refProp = scope[prop];
				if (refProp && !refProp.isInited) refProp.setValue();
			}

			if (!self.isInited && self.optValue !== undefined) self.setValue(self.optValue)
			else self.setValue(prop);
		}

		//descriptor
		//NOTE: passed descriptor can’t change value - it can only modify behaviour
		else {
			//extend states
			//FIXME: unextend states on unapply descriptor
			for (var name in prop) {
				self[name] = prop[name];
			}

			if (self.isNative){
				//TODO
			}

			else {
				if (!self.isInited) {
					self.setValue();
				}
			}
		}

		//try to set native value
		//FIXME: move this code to proper place
		if (self.isNative){
			// console.log('set native', self.displayName, self.value);
			//FIXME: collect behavioral cases, maybe you need to create StyleProp, EtcProp classes instead of this
			if (self.displayName === 'style') {
				self.target.style.cssText = self.value;
			} else {
				self.target[self.displayName] = self.value;
			}
		}
	},


	//redefinable things
	//default getter/setter
	get: function(value) {
		return value;
	},
	set: function(value) {
		return value;
	},
	init: undefined,
	changed: undefined,
	attribute: false,


	//whether property has been inited already
	isInited: null,
	//whether property is defined on element before mod being applied
	isNative: false,

	//inner reference stuff
	refProp: null,
	refEvt: null,

	//main prop value keeper
	value: undefined,

	//init caller
	//TODO: try to merge `optValue` with `init`
	callInit: function(value) {
		var self = this;
		var propName = self.displayName;

		//ignore double init
		if (self.isInited) return self.value;

		self.isInited = true;

		// console.log('call init', self.displayName, value);

		//fn
		if (isFn(self.initialMod[propName])) {
			value = self.init;
		}

		//initializer fn
		else if (isFn(self.init)) {
			// console.log('call init', value)
			var resultValue = self.init.call(self.target, value);
			// console.log('init res', resultValue)

			if (resultValue !== undefined){
				value = resultValue;
			} else {
				value = self.value;
			}
		}

		else if (value === undefined) {
			value = self.init
		}

		//default value
		else {
			value = value;//clone(value);
		}

		return value;
	},

	//self reference caller (for fn refs)
	callValueReference: function(e){
		var self = this;
		if (isFn(self.value)) self.value.call(self.target, e);
		else if (isFn(self.target[self.value])) self.target[self.value].call(self.target, e);
	},

	//unbind self.value
	unbindValue: function(){
		var self = this, target = self.target, scope = target._;
		//FIXME: reftarget & refpointer should be handled in a similar way
		// console.log('unbind', self.displayName, self.value, self.isRefPointer)
		//unbind inner ref pointer
		if (self.isRefTarget && self.value) {
			var pointer = scope[self.refPointer];
			// console.log('rebind inner ref target', pointer.refEvt, pointer.value)
			off(self.value, pointer.refEvt, pointer.value);
		}
		//unbind inner reference
		else if (self.isRefPointer) {
			// console.log('unbind inner ref fn', self.refProp, '`' + self.refEvt + '`')
			off(target[self.refProp], self.refEvt, self.value);
		}
		//unbind fnref
		else if (isString(self.value) && isPossiblyFnRef(self.value)) {
			//TODO: there cb reference is of the new state one
			// console.log('unbind', self.displayName, self.value, scope[self.value].value)
			off(target, self.displayName, self.callValueReference);
		}
		//unbind fn
		else if (isFn(self.value)) {
			// console.log('off fn', self.callValueReference)
			off(target, self.displayName, self.callValueReference);
		}
	},

	//bind self.value
	bindValue: function(){
		var self = this, target = self.target, scope = target._;
		//bind inner reference pointer
		if (self.isRefTarget && self.value){
			var pointer = scope[self.refPointer];
			on(self.value, pointer.refEvt, pointer.value);
		}
		//bind inner reference
		else if (self.isRefPointer) {
			// console.log('bind refPointer',target[self.refProp], self.refEvt, self.value)
			on(target[self.refProp], self.refEvt, self.value);
		}
		//bind fnref
		else if (isString(self.value) && has(scope, self.value) && isPossiblyFnRef(self.value)){
			// console.log('bind fnref')
			on(target, self.displayName, self.callValueReference);
		}
		//bind fn
		else if (isFn(self.value)) {
			on(target, self.displayName, self.callValueReference);
		}
	},

	//getter & setter
	getValue: function(){
		// console.log('get', this.displayName, this.isInited)
		//init, if not inited
		if (!this.isInited) this.setValue();

		var getResult = this.get.call(this.target, this.value);
		return getResult === undefined ? this.value : getResult;
	},

	setValue: function(value){
		var self = this, target = self.target, oldValue = self.value, scope = target._,
			stateName, state, oldStateName, oldState;

		//passing no arguments will cause initial call
		if (!arguments.length) value = self.optValue;

		//init, if not inited
		if (!self.isInited) {
			// console.group('set firstly', self.displayName, value, 'from', oldValue);

			value = self.callInit(value);

			//call set
			var isSetLock = 'isSet' + value;
			if (!self[isSetLock]) {
				self[isSetLock] = true;

				var setResult = self.set.call(target,value);

				self[isSetLock] = null;

				//catch redirect
				if (self.value !== oldValue) {
					// console.groupEnd();
					return;
				}

				//redirect state, if returned any
				if (setResult !== undefined) {
					value = setResult;
				}
			}
		}
		else {
			// console.group('set', self.displayName, value, 'from', oldValue);

			//FIXME: make sure it’s the best decision to detect inner sets (too much of code duplication)
			if (!self.isInSet) {
				//call set
				var isSetLock = 'isSet' + value
				if (!self[isSetLock]) {
					self[isSetLock] = true;

					self.isInSet = true;

					//FIXME: make sure error thrown has proper stacktrace
					try {
						var setResult = self.set.call(target,value);
					} catch (e){
						self.isInSet = null;
						self[isSetLock] = null;
						throw e;
					}

					//self.value couldve changed here because of inner set calls
					if (self.inSetValue !== undefined) {
						setResult = self.inSetValue;
						// console.log('redirected value', setResult)
						self.inSetValue = undefined;
					}

					self.isInSet = null;
					self[isSetLock] = null;

					//catch redirect
					if (self.value !== oldValue) {
						// console.groupEnd();
						return;
					}

					//redirect state, if returned any
					if (setResult !== undefined) {
						value = setResult;
					}

				}
			} else {
				// console.log('isSet', value)
				self.inSetValue = value;
				// console.groupEnd();
				return;
			}

			//ignore not changed value
			if (value === self.value) {
				// console.log('ignore absense of change', self.value)
				// console.groupEnd();
				return;
			}

			//handle leaving state routine
			oldStateName = has(self, oldValue) ? oldValue : '_';
			oldState = self[oldStateName];

			if (isMod(oldState)){
				//after callback
				var isAfterLock = 'isAfter' + oldStateName
				if (!self[isAfterLock]) {
					self[isAfterLock] = true;

					//TODO: catch non-fn
					if (isFn(oldState)) {
						var afterResult = self.callHook(oldState, 'after', value, oldValue);
					} else {
						var afterResult = oldState;
					}

					//ignore leaving state
					if (afterResult === false) {
						// console.groupEnd()
						return;
					}

					//redirect state, if returned any
					if (afterResult !== undefined) {
						self.setValue(afterResult);
						// console.groupEnd()
						return;
					}

					//catch redirect
					if (self.value !== oldValue) {
						// console.groupEnd();
						return;
					}

					self[isAfterLock] = null;
				}

				//leave an old mod
				unapplyMod(target, oldState);
			}

			//TODO: unapply all applied by mod properties to parent mod's ones
			//TODO: place before/after callbacks to apply/unapply mods
		}

		// console.log('set', self.displayName, value, 'from', self.value)
		self.unbindValue();

		self.value = value;

		self.bindValue();


		//FIXME: avoid unapply-apply action for properties, make straight transition
		stateName = has(self, value) ? value : '_';

		//enter the new mod
		if (has(self, stateName)) {
			state = self[stateName];

			// console.log("enter", stateName, state, isMod(state))
			if (isMod(state)) applyMod(target, state);

			//before callback
			var beforeResult;
			var isBeforeLock = 'isBefore' + stateName;
			if (!self[isBeforeLock]){
				self[isBeforeLock] = true;

				//entrance state shortcut
				if (!isMod(state)){
					//expand functional shortcut
					if (isFn(state)){
						beforeResult = state.call(target, value, oldValue);
					}
					//expand value shortcut
					else {
						beforeResult = state;
					}
				}
				//real mod
				else {
					beforeResult = self.callHook(state, 'before', value, oldValue);
				}


				//ignore leaving mod
				if (beforeResult === false) {
					self.setValue(oldValue);
					// console.groupEnd()
					return;
				}

				//redirect mod, if returned any
				if (beforeResult !== undefined) {
					self.setValue(beforeResult);
					// console.groupEnd()
					return;
				}

				//catch redirect
				if (self.value !== value) {
					// console.groupEnd();
					return;
				}

				self[isBeforeLock] = null;
			}
		}

		//changed callback
		//TODO: refuse changed callback to change self value by returning anything
		var isChangedLock = 'isChangedTo' + value;
		if (!self[isChangedLock] && value !== oldValue) {
			self[isChangedLock] = true;

			var changedResult = self.callHook(self, 'changed', value, oldValue);

			//TODO: there have to be a covering test, because kudago.slideshow failed
			self[isChangedLock] = null;

			//redirect state, if returned any
			// if (changedResult !== undefined) {
			// 	// self.value = changedResult;
			// 	self.setValue(changedResult);
			// 	// console.groupEnd()
			// 	return;
			// }

			// //catch redirect
			// if (self.value !== value) {
			// 	// console.groupEnd();
			// 	return;
			// }
		}

		//update attribute
		self.setAttribute();
		// console.groupEnd()
	},

	//short hook caller
	callHook: function(holder, name, a, b){
		var self = this, target = self.target, hookResult
		if (!holder) return;

		//fn hook
		if (isFn(holder[name])) {
			hookResult = holder[name].call(target, a, b)
		}
		//value hook
		else if (isObject(holder)) {
			hookResult = holder[name]
		}

		return hookResult;
	},

	//reflects self value on attribute
	setAttribute: function(){
		var self = this, target = self.target;

		if (!self.attribute) return;

		if (!target.setAttribute) return;

		if (!self.value) {
			//hide falsy attributes
			target.removeAttribute(self.displayName);
		} else {
			//avoid target attr-observer catch this attr changing
			target.setAttribute(self.displayName, stringify(self.value));
		}

		fire(target, 'attributeChanged');
	}
}




/**
* List of prop names to avoid
*/
var propTechNames = {};
for (var propName in Prop.prototype) propTechNames[propName] = true;


//FIXME: extend these properties based on constructor values, automatically
var reservedNames = {
	// constructor: true,
	// length: true,
	// prototype: true,
	// name: true,
	instances: true,
	extend: true,
	parent: true,
	toJSON: true,
	bind: true,
	eachProp: true,
	displayName: true,
	selector: true,
}

var registerNames = {
	jQuery: true,
	customElement: true,
	autoinit: true,
	css: true,
}

var lifecycleNames = {
	created: true,
	init: true,
	before: true,
	after: true
	// attached: true,
}



/**
* Mod constructor
*/
function Mod(a,b,c){
	return Mod.create.call(this, a,b,c);
};

/**
* Default target for selected environment caster
*/
Mod.createDefaultTarget = function(){
	return doc && doc.createElement('div') || {};
}

/**
* Mod registrar (`this` is CustomMod)
*/
Mod.registry = {};

/**
* Custom Mod creator
*/
Mod.create = function(target, props, parentMod){
	// console.group('create', target, props, parentMod)
	//resolve arguments
	if (!props || isMod(props)){
		parentMod = props;
		props = target;
		target = null;
	}
	props = props || {};

	//create mod class
	//NOTE: this is the fastest way to clone an fn
	/** @constructor */
	function mod(a,b){
		return instantiateMod.call(mod,a,b)
	};

	//provide mod name
	var name = props.name || props.displayName;
	if (!name) name = 'mod-' + getUniqueId();
	mod.displayName = name;


	//nested mod - ignore registration
	if (parentMod) {
		mod.parent = parentMod;
	}
	//outer mod
	else {
		mod.instances = {};
		mod.extend = extendMod;

		//register mod
		//FIXME: make sure `displayName` is the best property name to register
		if (Mod.registry[name]) throw Error('Mod `' + name + '` is already registered');
		Mod.registry[name] = mod;
		if (!props.selector) mod.selector = '.' + name;
		//TODO: provide global class with `name`?

		//provide jQuery plugin
		if ($ && props.jQuery && !(props.jQuery in $)) {
			$['fn'][name] = (function(mod){
				return function (arg) {
					return this['each'](function(i,e){
						var $e = $(e);
						var instance = mod($e[0], arg);
						$e.data(name, instance);
					})
				};
			})(mod);
			$[name] = mod;
		}

		//TODO: provide customElement
		if(props.customElement){
			var ceProps = {
				//TODO: use custom proto element passed
				// 'prototype': Object.create(HTMLElement.prototype),

				//TODO: use proper tag passed to extend
				// 'extends': 'div',

				//TODO: transfer mod settings to the custom element settings
				//NOTE: they’re transformed the way simple properties defined on element

				// createdCallback: function(){},
				// attachedCallback: function(){},
				// detachedCallback: function(){},
				// attributeChangedCallback: function(attrName, oldVal, newVal){}
			};

			// var CustomElement = register(settings.customelement, ceProps)
		}

		//TODO: create style tag on the document
		if (props.css && doc) {
			var styleTag = createLiveStyle(props.css);
			head.appendChild(styleTag);
		}
	}

	//save iterator & getter
	mod.eachProp = iterateOverProps;
	mod.toJSON = modToJSON;


	//flatten listed props
	flattenKeys(props);

	//handle prop descriptors - create mods in place of states
	for (var propName in props){
		var prop = props[propName];
		if (!isPrivateName(propName) && isObject(prop)){
			flattenKeys(prop);

			//handle states & descriptor
			for (var stateName in prop){
				if (propTechNames[stateName]) continue;

				//create mod based on state props, in case if it’s not mod already
				if (!isMod(prop[stateName]) && isObject(prop[stateName])) {
					//save name to identify mod by it
					//FIXME: move it to constructor
					prop[stateName].displayName = propName + stateName;
					prop[stateName] = Mod(prop[stateName], mod);
				}
			}
		}

		//transfuse property
		mod[propName] = prop;
		// mod[propName] = new ModProp(prop);
	}


	//apply anonimous mod
	if (target) {
		mod(target);
	}

	//Autoinit present in DOM elements
	if (!has(props,'autoinit') || props.autoinit) {
		var targets = doc.querySelectorAll(mod.selector);
		for (var i = 0; i < targets.length; i++) {
			fireAttached(mod(targets[i]));
		}
	}

	//FIXME: do not allow configuring mod anymore
	// Object.seal(mod);

	// console.groupEnd();
	return mod
}


/**
* Mod prototypal things
*/
/**
* Properties iterator
*/
function iterateOverProps(fn, showAll){
	var mod = this, result,
		propNames = Object.keys(mod)
		//TODO: get rid of this?
		.filter(function(a){
			if (!showAll){
				if (isPrivateName(a) || registerNames[a] || lifecycleNames[a]) return false;
			}
			if (reservedNames[a]) return false;
			return true;
		})
		.sort(function(a,b){
			// if (a[0] === '_') return -1;
			// if (b[0] === '_') return 1;
			if (isObject(mod[a])) return 1;
			if (isString(mod[a])) return 1;
			return -1;
		});

	for (var i = 0; i < propNames.length; i++){
		result = fn(propNames[i], mod[propNames[i]]);
		if (result === false) return;
	}
}

/**
* Mod extender - creates clone of a mod extended with props passed
*/
function extendMod(props){
	//TODO: enhance extension method, i.e. a:2 + a:{change:fn...} → a:{init:2, change:fn...}
	var oldMod = this;
	var oldProps = oldMod.toJSON();

	if (isMod(props)) props = props.toJSON();
	props = props || {};

	// console.group("extend", oldMod.displayName)
	// console.log("new props",props)
	// console.log("old props",oldProps)

	//transfer old properties
	for (var propName in oldProps){
		//transfer plain values
		props[propName] = mergeProperty(props[propName], oldProps[propName]);
	}
	// console.dir(props)
	var newMod = Mod(props);

	// console.groupEnd();
	return newMod
}

/**
* returns new property descriptor, merging both old and new descriptors
*/
function mergeProperty(newProp, oldProp){
	if (oldProp === undefined) return newProp;
	if (newProp === undefined) return oldProp;

	//supposation that natural behaviour is extension of all oldProps
	// console.log(oldProp, newProp, isObject(oldProp), isObject(newProp))
	if (isObject(newProp)){
		if (isObject(oldProp)){
			// var resProp = clone(oldProp);
			return deepExtend(oldProp, newProp);
		} else {
			return extend({init: oldProp}, newProp);
		}
	} else {
		if (isObject(oldProp)){
			//TODO: are you sure don’t want to extend old property’s `init` value?
			return newProp
		} else {
			return newProp
		}
	}
}


//-----------iterator
/**
* Mod property descriptor controller
* Doesn’t replaces real passed mod descriptor, but takes control over it & provides methods
*//*
function PropDescriptor(propName, prop, mod){
	var self = this;

	//ignore double init
	if (prop instanceof PropDescriptor) return prop;

	//save name & initial prop
	self.propName = propName;
	self.prop = prop;
	self.mod = mod;

	//clean reserved names
	if (reservedNames[propName]) self.isReserved = true;

	//ignore private properties
	else if (propName[0] !== '_') self.isPrivate = true;

	//handle prop descriptors
	else if (isObject(prop)) {
		self.isDescriptor = true;

		//flatten listed states
		flattenKeys(prop);

		//handle states & descriptor
		for (var stateName in prop){
			if (reservedNames[stateName] || techNames[stateName]) continue;

			//make sure mutual fn properties are stubbed as noop fns
			var innerProps = prop[stateName];

			//create mod based on state props, in case if it’s not mod already
			if (!isMod(innerProps) && isObject(innerProps)) {
				innerProps.name = propName + stateName;
				prop[stateName] = Mod(innerProps, mod);
			}
		}
	} else {
		self.isPlain = true;
	}
}

PropDescriptor.prototype = {
	//return new prop (not PropDescriptor instance)
	getExtendedProp: function(newProp){
		var self = this;

		if (self.prop === undefined) return newProp;
		if (newProp === undefined) return self;

		//supposation that natural behaviour is extension of all oldProps
		// console.log(oldProp, newProp, isObject(oldProp), isObject(newProp))
		if (isObject(newProp)){
			if (self.isDescriptor){
				return deepExtend(clone(self.prop), newProp.prop);
			} else {
				return extend({init: self.prop}, newProp.prop);
			}
			return self;
		} else {
			if (self.isDescriptor){
				//TODO: are you sure don’t want to extend old property’s `init` value?
				return newProp
			} else {
				return newProp
			}
		}
	},
	toJSON: function(){return this.prop},

	//iterate over each inner state declared
	eachState: function(fn){
		var self = this, result;
		if (self.isDescriptor){
			for (var stateName in self.prop) {
				if (reservedNames[stateName] || techNames[stateName]) continue;
				result = fn(stateName, self.prop[stateName]);
				if (result === false) return;
			}
		}
	},

	//spawns `Prop` instance on target
	spawn: function(target, options){
		var self = this;

		//transfuse private properties to target
		if (self.isPrivate) defineProperty(target, self.propName, {
			value: clone(self.prop),
			writable: true,
			enumerable: false,
			configurable: false
		});

		//property descriptor
		else {
			//FIXME: get rid of this condition
			if (options) {
				prop = new Prop(target, self.propName, self.mod, options[self.propName]);
			} else {
				prop = new Prop(target, self.propName, self.mod);
			}
		}
	}
}*/


/**
* Mod extender - creates clone of a mod extended with props passed
*/
// function extendMod(props){
// 	var oldMod = this;

// 	props = props || {};

// 	//transfer old properties
// 	oldMod.eachProp(function(name, oldProp){
// 		props[name] = oldProp.getExtendedProp(props[name]);
// 	})

// 	var newMod = Mod(props);

// 	// console.groupEnd();
// 	return newMod
// }









/**
* Custom mod instance constructor
*/
function instantiateMod(target, options){
	var mod = this;

	// console.log('instantiate', target, options)

	//TODO: ensure this conditions routine is optimal
	//if no target passed - create default target
	if (target === undefined) {
		//TODO: count on parent (prototypal) element, like `extends` in CustomElements
		target = Mod.createDefaultTarget();
	}

	//if empty target passed - ignore mod
	else if (target === null || ( target.length === 0 && target.nodeType === undefined )) {
		return {};
	}

	//only options passed as a target - create target
	else if (!options && isObject(target)) {
		options = target;
		target = Mod.createDefaultTarget();
	}
	//list of targets passed - impossible to redefine targets in init
	if (target.length && target.nodeType === undefined) {
		var l = target.length;
		for (var i = 0; i < l; i++){
			initMod(target[i], mod, options);
		}
		return target;
	}

	//one target passed
	else {
		return initMod(target, mod, options);
	}
}

/**
* Apply parent mod to a target
* define all properties etc
*/
function initMod(target, mod, options){
	// console.group('init mod', mod.displayName, target)
	var targetId, presettings;

	//save whether initial target is applied mod
	var isTargetAMod = isModInstance(target);

	//get uniq target id
	targetId = getId(target);

	//ignore double instantiation
	if (mod.instances && mod.instances[targetId]){
		// console.groupEnd();
		return target;
	}

	presettings = parsePresettings(target, mod);

	//init callback
	var initResult = isFn(mod.init) ? mod.init.call(target, options) : isObject(mod.init) ? clone(mod.init) : isElement(mod.init) ? mod.init.cloneNode(true) : mod.init;

	//redefine target, if needed
	if (initResult !== undefined) {
		setId(initResult, targetId);
		target = initResult;

		//append presettings, if target changed
		extend(presettings, parsePresettings(target, mod));
	}

	//form options
	options = extend(presettings, options);

	//init extended options
	for (var optName in options){
		var option = options[optName];

		//add extra listener
		if (isFn(option)){
			on(target, optName, option.bind(target));
			delete options[optName]
		}
		//take over extra-property
		else if (!has(mod, optName)) {
			target[optName] = option
		}
	}

	//init event
	fire(target, 'init');

	//track instances
	if (mod.instances) {
		mod.instances[targetId] = target;
	}

	//add class
	if (mod.displayName && isElement(target)) target.classList.add(mod.displayName);

	//mark as DOM-inclusion observable
	//TODO: move isAttached to scope
	if (target.isAttached === undefined && isElement(target)){
		target.isAttached = false;
	}

	var scope = target._;
	//FIXME: create mod propeties iterator

	//create toJSON for target
	if (!target.toJSON){
		target.toJSON = modInstanceToJSON;
	}

	//create properties controllers
	//NOTE: `get`s have to be defined before values being inited
	//TODO: flag this code in order to avoid double define
	mod.eachProp(function(propName, prop){
		if (lifecycleNames[propName] || registerNames[propName]) return;

		//transfuse private properties to target
		if (isPrivateName(propName)) defineProperty(target, propName, {
			value: clone(prop),
			writable: true,
			enumerable: false,
			configurable: false
		});

		//property descriptor
		else {
			//FIXME: get rid of this condition
			if (options) {
				prop = new Prop(target, propName, mod, options[propName]);
			} else {
				prop = new Prop(target, propName, mod);
			}
		}
	}, true)


	//go to initial mod
	applyMod(target, mod);

	//created callback (can’t be called on nested mods)
	mod.created && mod.created.call(target);
	fire(target, 'created');

	//fire attached
	// console.log(target, mod.displayName, root.contains(target))
	if (root.contains(target)){
		fireAttached(target);
	}

	// console.groupEnd()

	return target;
}


/**
* Set new (inner) mod on target
*/
function applyMod(target, mod){
	if (!mod) return;

	// console.group('applyMod', mod.displayName)

	mod.eachProp(function(propName){
		target._[propName].setMod(mod);
	})

	// console.groupEnd()
}


/**
* Reset active mod
*/
function unapplyMod(target, mod){
	if (!mod) return;

	// console.group('unapply Mod', mod.groupName, mod.propName)

	mod.eachProp(function(propName){
		target._[propName].setMod(target._[propName].initialMod);
	})

	// console.groupEnd();
}

/**
*	Parses presetted mod props
*/
function parsePresettings(target, mod){
	var preset = {};
	// console.group('parsePresettings', props)

	var testElement = has(target, 'cloneNode') ? target.cloneNode() : target;

	mod.eachProp(function(propName, prop){
		var dashedPropName = toDashedCase(propName);
		if (has(target, propName)) {
			// console.log('ontarget')
			if (!(/^on/.test(propName)) &&
				(propName in testElement)) {
					//NOTE: interfering properties:
					//click() in any
					//value in input
					//min, max in input
				//TODO: workaround this
				// console.log('native presetting', propName)
				// throw Error('Interfering property `' + propName + '`')
			} else {
				//save predefined element value
				preset[propName] = target[propName];
			}
		}

		else {
			var propType = isObject(prop) ? (!isFn(prop.init) ? prop.init : '' )  : prop;
			if (has(target, 'attributes')) {
				var attr = target.attributes[propName] || target.attributes['data-' + propName] || target.attributes[dashedPropName] || target.attributes['data-' + dashedPropName];
				if (attr) {
					if (/^on/.test(propName)) preset[propName] = new Function(attr.value);
					else preset[propName] = parseTypedAttr(attr.value, propType);
				}
			}
		}
	})
	// console.log(preset)
	// console.groupEnd()

	return preset;
}



/**
* Observe DOM changes
*/
if (MO) {
	var docObserver = new MO(function(mutations) {
		mutations.forEach(function(mutation){
			// console.log(mutation, mutation.type)
			//TODO: Update list of data-listeners
			if (mutation.type === 'attributes'){
				//console.log('doc', mutation)
				//TODO: check whether classes were added to the elements
			}

			//check whether appended elements are Mods
			else if (mutation.type === 'childList'){
				var l = mutation.addedNodes.length;

				for (var i = 0; i < l; i++){
					var el = mutation.addedNodes[i];

					if (el.nodeType !== 1) continue;

					//check whether element added is mod
					// console.log(el, isModInstance(el))
					if (isModInstance(el)) {
						fireAttached(el);
					}

					for (var modName in Mod.registry){
						var mod = Mod.registry[modName];

						//FIXME: match selector
						//autoinit top-level registered mods
						if (matchSelector.call(el, mod.selector)){
							// console.log('autoinit parent', modName, el.isAttached);
							mod(el);
						}

						//FIXME: autoinit low-level registered mods
						var targets = el.querySelectorAll(mod.selector);

						for (var j = 0; j < targets.length; j++){
							var innerEl = targets[j];
							// console.log('autoinit child', modName, el.isAttached)

							fireAttached(mod(innerEl));
						}
					}
					//NOTE: noname mods within elements wont fire `attached`
				}

				//TODO: engage new data to update
			}
		})
	});

	docObserver.observe(doc, {
		attributes: true,
		childList: true,
		subtree: true,
		characterData: true
	});
}


/**
* Disentangle listed keys
*/
function flattenKeys(set){
	//TODO: deal with existing set[key] - extend them?

	for(var keys in set){
		if (/,/.test(keys)){
			var value = set[keys];
			delete set[keys];

			each(keys, function(key){
				set[key] = value;
			})
		}
	}

	// console.log('after', set);

	return set;
}

/**
* Tests whether name is private
*/
function isPrivateName(n){
	return n[0] === '_' && n.length > 1
}

/**
* Whether passed target is a mod instance
*/
//FIXME: make sure this is the best way to detect mod applied
function isModInstance(target){
	return has(target, idKey)
}

/**
* Checks whether the constructor passed is mod
*/
function isMod(mod){
	return isFn(mod) && !!mod.eachProp
}

/**
* tests string on possible fnref
*/
function isPossiblyFnRef(str){
	return !(/\s/.test(str));
}


/**
* Mod properties getter
*/
function modToJSON(){
	var resultProps = {}, resultProp;
	var mod = this;

	// for (var propName in mod){
	// 	if (reservedNames[propName] || registerNames[propName]) continue;
	// 	var prop = mod[propName];
	mod.eachProp(function(propName, prop){
		// console.log(propName)
		if (isObject(prop)){
			resultProp = {};
			for (var name in prop){
				// console.log(name, prop[name])
				if (isMod(prop[name])) {
					resultProp[name] = prop[name].toJSON();
				} else {
					resultProp[name] = prop[name];
				}
			}
			resultProps[propName] = resultProp;
		} else {
			resultProps[propName] = prop;
		}

	// }
	}, true)

	// console.log(resultProps)
	return resultProps;
}


/**
* transforms any mod instance passed to JSON
*/
function modInstanceToJSON(){
	var scope = this._, result = {};
	for (var propName in scope){
		var prop = scope[propName];
		if (!isFn(prop.value)) result[propName] = prop.value;
	}

	return result;
}

/**
* Check whether target is attached, invoke callback
*/
function fireAttached(target){
	if (!target.isAttached){
		target.isAttached = true;
		fire(target, 'attached');
	}
}