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
	if (typeof s === "string") return document.querySelector(s);
	return s;
}

//return absolute offsets
function offsets(el){
	var c = {},
		rect = el.getBoundingClientRect();
	c.top = rect.top + window.scrollY;
	c.left = rect.left + window.scrollX;
	c.width = el.offsetWidth;
	c.height = el.offsetHeight;
	c.bottom = c.top + c.height;
	c.right = c.left + c.width;
	c.fromRight = document.width - rect.right;
	c.fromBottom = (window.innerHeight + window.scrollY - rect.bottom)
	return c;
}

//return paddings
function paddings($el){
	var box = {}, style = getComputedStyle($el);

	box.top = ~~style.paddingTop.slice(0,-2)
	box.left = ~~style.paddingLeft.slice(0,-2)
	box.bottom = ~~style.paddingBottom.slice(0,-2)
	box.right = ~~style.paddingRight.slice(0,-2)

	return box;
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
}

/**
* Broadcasts event: "slidy:evt" → $doc, "slidy:evt" → $el, evt → area.opts
* target - whether area or picker class
*/
//TODO
function trigger(that, ename, data){
	//TODO: pass data to trigger events
	/*var prefixedEvt = [pluginName, ":", evt].join('');
	if ($){
		$(that.$el).trigger(prefixedEvt);
	} else {
		//that.$el.dispatchEvent(new CustomEvent(prefixedEvt))
	}
	if (that.options && that.options[evt]){
		that.options[evt].call(that, data);
	}

	var event;
	if(document.createEvent){
		event = document.createEvent('HTMLEvents');
		event.initEvent(ename,true,true);
	}else if(document.createEventObject){// IE < 9
		event = document.createEventObject();
		event.eventType = ename;
	}
	event.eventName = ename;
	if(target.dispatchEvent){
		target.dispatchEvent(event);
	}else if(target.fireEvent && htmlEvents['on'+eventName]){// IE < 9
		target.fireEvent('on'+event.eventType,event);// can trigger only real event (e.g. 'click')
	}else if(el[eventName]){
		el[eventName]();
	}else if(el['on'+eventName]){
		el['on'+eventName]();
	}*/
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
function parseAttr(str){
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

//returns data object representing attributes read
var defaultAttrs = {'class': true, 'id': true, 'style': true};
function parseAttributes(el){
	var attrs = el.attributes,
		data = {};

	for (var i = 0; i < attrs.length; i++){
		var attr = attrs[i]
		if (!defaultAttrs[attr.name]) data[attr.name] = parseAttr(attr.value)
	}

	return data;
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
	//keyed by param name listeners
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

	//TODO: bind slider’s named properties to the document’s scope (publish them)
}

//finds the index of next one property
function findPropertyToInsert(str){
	str.indexOf()
}