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

//Simple DOMs
$ = $ || function(s){
	if (typeof s === "string") {
		return document.querySelectorAll(s);
	}
	return s;
}

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
	$el.onselectstart = function(){return false}
}
function enableSelection($el){
	css($el, {
		"user-select": null,
		"user-drag": null,
		"touch-callout": null
	})
	$el.removeAttribute("unselectable")
	delete $el.onselectstart;
}

//stupid css styler
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
//set of properties to add prefix
var prefixedProps = {
	"user-drag": true,
	"user-select": true,
	"touch-callout": true,
	"transform": true
}

/**
* Simple event methods
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

/**
* Broadcasts event: "slidy:evt" → $doc, "slidy:evt" → $el, evt → area.opts
* target - whether area or picker class
*/
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

//math limiter
function between(a, min, max){
	return Math.max(Math.min(a,max),min);
}

//math precision round
function round(value, precision){
	precision = parseInt(precision);
	if(isNaN(precision)) throw new Error("Bad precision passed")

	if (precision === 0) return value;

	return Math.round(value / precision) * precision
}

function preventDefault(e){
	e.preventDefault()
}

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
	if (typeof el === "function"){
		//return function body
		var src = el.toString();
		el.slice(src.indexOf("{") + 1, src.lastIndexOf("}"));
	} else if (el instanceof HTMLElement){
		//return id/name/proper selector
		return selector(el)
	} else if (el instanceof Array){
		//return comma-separated array
		return el.join(",")
	} else if (el instanceof Object){
		//serialize json
		return el.toString();
	} else {
		return el.toString();
	}
}

//returns unique selector for an element
//stolen from https://github.com/rishihahs/domtalk/blob/master/index.js
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



//TODO
//bind element’s representation to component data
function observeData(target, data){
/*	//keyed by param name listeners
	var listeners = {},
		propRe = /\{\{\s([a-zA-Z_$][a-zA-Z_$0-9]*)\s\}\}/;

	//TODO: catch every property met, replace with default value

	//TODO: gather attributes
	for (var i = 0; i < target.attributes.length; i++){
		var attrValue = target.attributes[i].value;
		var propIdx = undefined;

		//grasp every value met
		while ((propIdx = attrValue.indexOf("{{")) >= 0){
			var closeIdx = attrValue.indexOf("}}");
			var propName = attrValue.slice(propIdx + 2, closeIdx).trim();

			//set default value
			target.attributes[i].value = [
				target.attributes[i].value.slice(0, propIdx),
				data[propName],
				target.attributes[i].value.slice(closeIdx, attrValue.length - 1)
			].join('');

			if (!listeners[propName]) listeners[propName] = [];
			listeners[propName].push({
				//object where to make substitution
				target: target.attributes[i],
				//template which to use as basis for substisution
				template: attrValue,
				data: {
					//TODO: save all harvested properties here
				}
			})
		}
	}

	//TODO: gather text children
	var children = target.childNodes,
		l = children.length;

	for (var i = 0; i < l; i++){
		var child = children(i);
		if (child.nodeType === 1){
			if (propRe.test(child.texContent)){
				//split text node in place of property
				listeners.push({
					target: child,
					template: target.texContent
				})
			}
		}
	}

	//TODO: track elements children

	//TODO: listen to the source change
	for (var prop in listeners){
		var listener = listeners[prop];
		document.addEventListener(prop + "Changed", function(e){
			var value = e.target.value;
			//NOTE: once data-names've been replaced with values, you can’t no more track them
			for (var i = 0; i < target.attributes.length; i++){
				var attrName = target.attributes[i].name.replace();
				var attrValue = target.attributes[i].value.replace();
				if (re.test(attrName)){

				}
			}
			//update attrs
			//update content
		})
	}

	//TODO: bind slider’s named properties to the document’s scope (publish them)*/
}

//finds the index of next one property
function findPropertyToInsert(str){
	//str.indexOf()
}


/**
* Searches for all components in document
*/
//TODO: consider implements="a,b,c" attribute
function queryComponents(name, within){
	return (within || document).querySelectorAll(
		["[", name, "], [data-", name, "], .", name, ""].join("")
	);
}