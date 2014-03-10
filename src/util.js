//#exclude
var pluginName = "slidy", jQuery, $
//#endexclude
//#put `var pluginName = {{ pluginName }}`

//----------------Utils
function extend(a){
	var isDeep = arguments[arguments.length - 1] === true;
	for (var i = 1, l = arguments.length; i<l; i++){
		var b = arguments[i];
		for (var k in b){
			if (isDeep && a.hasOwnProperty(k) && isObject(a[k]) && isObject(b[k])) {
				extend(a[k], b[k], true)
			} else a[k] = b[k];
		}
	}
	return a;
}

function isObject(a){
	return (a && a !== null && typeof a === 'object')
}

/**
* Simple DOMs
*/
$ = $ || function(s){
	if (typeof s === "string") {
		return document.querySelectorAll(s);
	}
	return s;
}

//returns unique selector for an element
//from https://github.com/rishihahs/domtalk/blob/master/index.js
function selector(element) {
	// Top level elements are body and ones with an id
	if (element === document.documentElement) {
		return ':root';
	} else if (element.tagName && element.tagName.toUpperCase() === 'BODY') {
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

//Searches for all components in document
//TODO: consider implements="a,b,c" attribute
function queryComponents(name, within){
	return (within || document).querySelectorAll(
		["[", name, "], [data-", name, "], .", name, ""].join("")
	);
}


/**
* Simple CSSs
*/
//stupid prefix detector
function detectCSSPrefix(){
	var puppet = document.documentElement;
	var style = document.defaultView.getComputedStyle(puppet, "");
	if (style.transform) return "";
	if (style["-webkit-transform"]) return "-webkit-";
	if (style["-moz-transform"]) return "-moz-";
	if (style["-o-transform"]) return "-o-";
	if (style["-khtml-transform"]) return "-khtml-";
	return "";
}
var cssPrefix = detectCSSPrefix();

//return absolute offsets
function offsets(el){
	if (!el) throw new Error("No element passed");
	var rect = el.getBoundingClientRect(),
		c = {
			top: rect.top + window.pageYOffset,
			left: rect.left + window.pageXOffset,
			width: el.offsetWidth,
			height: el.offsetHeight,
			bottom: rect.top + window.pageYOffset + el.offsetHeight,
			right: rect.left + window.pageXOffset + el.offsetWidth,
			fromRight: window.innerWidth - rect.right,
			fromBottom: (window.innerHeight + window.pageYOffset - rect.bottom)
		}

	return c;
}

//return paddings
function paddings($el){
	var style = getComputedStyle($el);

	return {
		top: parseCssValue(style.paddingTop),
		left: parseCssValue(style.paddingLeft),
		bottom: parseCssValue(style.paddingBottom),
		right: parseCssValue(style.paddingRight),
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
		if (prefixedProps[style]) style = cssPrefix + style;
		$el.style[style] = value;
	} else {
		//obj passed
		var initialDisplay = $el.style.display;
		$el.style.display = "none";
		for (var prop in style){
			if (prefixedProps[prop]) $el.style[cssPrefix + prop] = style[prop];
			else $el.style[prop] = style[prop];
		}
		$el.style.display = initialDisplay;
	}
}


/**
* Simple events
*/
//Binds
//TODO: make delegate as event-property `:delegate(selector)`
//TODO: pass array of functions to bind
function on(el, evt, fn){
	if (jQuery){
		//delegate to jquery
		jQuery(el).on.apply(el, arguments);
	} else {
		//listen element
		el.addEventListener(evt, fn)
	}
	return el;
}
function off(el, evt, fn){
	//console.log("off", arguments)
	if (jQuery){
		//delegate to jquery
		jQuery(el).off.apply(el, arguments);
	} else {
		//listen element
		el.removeEventListener(evt, fn)
	}
	return el;
}

function preventDefault(e){
	e.preventDefault()
}

//Broadcasts event: "slidy:evt" → $doc, "slidy:evt" → $el, evt → area.opts
//target - whether area or picker class
function fire(el, eventName, data, bubbles){
	//handle jQuery-way, if there is such
	//pass data
	//TODO: ie’s work
	//options callbacks

	var event = new CustomEvent(eventName, { detail: data, bubbles: bubbles })

	//dispatch options
	//@deprecated - option listeners are now simple listeners
	//if (el[eventName]) el[eventName].apply(el, data);

	//dispatch to DOM
	if (jQuery){
		$(el).trigger(event, data);
	} else {
		el.dispatchEvent(event);
	}
}


/**
* Simple Maths
*/
//limiter
function between(a, min, max){
	return Math.max(Math.min(a,max),min);
}
function isBetween(a, left, right){
	if (a <= right && a >= left) return true;
	return false;
}

//precision round
function round(value, precision){
	precision = parseInt(precision);
	if(isNaN(precision)) throw new Error("Bad precision passed")

	if (precision === 0) return value;

	return Math.round(value / precision) * precision
}



/**
* Simple strings
*/
//returns value from string with correct type
//TODO: write tests for this fn
function parseAttr(str){
	var v;
	if (str.indexOf(',') >= 0) return parseMultiAttr(str);

	if (str === "true" || str === "") {
		return true;
	} else if (str === "false") {
		return false;
	} else if (!isNaN(v = parseFloat(str))) {
		return v;
	} else {
		return str;
	}
}

function parseMultiAttr(str){
	//clean str from spaces/array rudiments
	str = str.trim();
	if (str[0] === "[") str = str.slice(1);
	if (str.length > 1 && str[str.length - 1] === "]") str = str.slice(0,-1);

	var parts = str.split(',');
	var result = [];
	for (var i = 0; i < parts.length; i++){
		result.push(parseAttr(parts[i]))
	}
	return result
}

//attributes to ignore
var defaultAttrs = {
	'class': true,
	'id': true,
	'style': true,
	'name': true,
	'type': true,
	'src': true,
	'link': true,
	'href': true,
	'disabled': true
};

//returns data object representing attributes read
function parseAttributes(el){
	var attrs = el.attributes,
		data = {};

	for (var i = 0; i < attrs.length; i++){
		var attr = attrs[i],
			attrName = toCamelCase(attr.name)
		if (attrName.slice(0,2) === "on") {
			//declared evt - create anonymous fn
			data[attrName] = new Function(attr.value);
		} else if (!defaultAttrs[attrName]) {
			data[attrName] = parseAttr(attr.value)
		}
	}

	return data;
}

//camel-case → CamelCase
function toCamelCase(str){
	return str.replace(/-[a-z]/g, function(match, group, position){
		return match[1].toUpperCase()
	})
}

//CamelCase → camel-case
function toDashedCase(str){
	return str.replace(/[A-Z]/g, function(match, group, position){
		return "-" + match.toLowerCase()
	})
}

//stringify any element passed, useful for attribute setting
function stringify(el){
	if (el instanceof Array){
		//return comma-separated array
		return el.join(",")
	} else if (el instanceof Object){
		//serialize json
		return el.toString();
	} else if (typeof el === "function"){
		//return function body
		var src = el.toString();
		el.slice(src.indexOf("{") + 1, src.lastIndexOf("}"));
	} else if (el instanceof HTMLElement){
		//return id/name/proper selector
		return selector(el)
	} else {
		return el.toString();
	}
}