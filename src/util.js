//#exclude
var pluginName = "slidy", jQuery, $
//#endexclude
//#put `var pluginName = {{ pluginName }}`

//----------------Utils
function extend(a){
	for (var i = 1, l = arguments.length; i<l; i++){
		var b = arguments[i];
		for (var k in b){
			a[k] = b[k];
		}
	}
	return a;
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

/**
* Simple event methods
*/
//Binds
function on(el, evt, delegate, fn){
	if (jQuery){
		//delegate to jquery
		jQuery(el).on.apply(el, arguments);
	} else if (arguments.length === 3){
		//listen element
		el.addEventListener(evt, delegate)
	} else if (arguments.length === 4 && !delegate) {
		el.addEventListener(evt, fn)
	} else {
		//delegate listening
		el.addEventListener(evt, function(e){
			//TODO: if e.currentTarget is in the delegatees list - pass event
		}.bind(el))
	}
	return el;
}
function off(el, evt, fn){
	//console.log("off", arguments)
	if (jQuery){
		//delegate to jquery
		jQuery(el).off.apply(el, arguments);
	} else if (arguments.length === 3){
		//listen element
		el.removeEventListener(evt, fn)
	}
	return el;
}

/**
* Broadcasts event: "slidy:evt" → $doc, "slidy:evt" → $el, evt → area.opts
* target - whether area or picker class
*/
function fire(el, eventName, data){
	//handle jQuery-way, if there is such
	//pass data
	//TODO: ie’s work
	//options callbacks
	//TODO: call document specific call
	var event = new CustomEvent(eventName, { detail: data })

	//dispatch options
	if (this['on' + eventName]) this['on' + eventName].apply(this, data);

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
	if (precision === 0) return value;

	return Math.round(value / precision) * precision
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

//returns data object representing attributes read
var defaultAttrs = {'class': true, 'id': true, 'style': true};
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