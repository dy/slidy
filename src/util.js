
//#exclude
	var pluginName = "slidy", $
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

//simple math limiter
function limit(v, min, max){
	return Math.max(min, Math.min(max, v));
}

//attr parser
function parseDataAttributes(el, multiple) {
	var data = {}, v;
	for (var prop in el.dataset){
		var v;
		if (multiple) {
			v = el.dataset[prop].split(",");
			for (var i = v.length; i--;){
				v[i] = recognizeValue(v[i].trim());
				if (v[i] === "") v[i] = null;
			}
		} else {
			v = recognizeValue(el.dataset[prop]);
			if (v === "") v[i] = true;
		}

		data[prop] = v;
	}
	return data;
}

//
function getOffsetBox($el){
	var box = $el.getBoundingClientRect();
	box.height= $el.offsetHeight; //this.el.clientHeight;
	box.width= $el.offsetWidth; //this.el.clientWidth;
	box.center= [box.width * 0.5, box.height * 0.5];
	return box;
}

function getPaddingBox($el){
	var box = {},
		style = getComputedStyle($el);

	box.top = ~~style.paddingTop.slice(0,-2)
	box.left = ~~style.paddingLeft.slice(0,-2)
	box.bottom = ~~style.paddingBottom.slice(0,-2)
	box.right = ~~style.paddingRight.slice(0,-2)

	return box;
}

/**
* Simple event methods
*/
function on(el, evt, fn){
	if ($){
		$(el).on(evt, fn);
	} else {
		el.addEventListener(evt, fn)
	}
}
function off(el, evt, fn){
	if ($){
		$(el).off(evt, fn);
	} else {
		el.removeEventListener(evt, fn)
	}
}
/**
* Broadcasts event: "slidy:evt" → $doc, "slidy:evt" → $el, evt → area.opts
* target - whether area or picker class
*/
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

/**
* Versatile event listener
*/
function addEventListenerTo(that, evt, fn){
	if (!that.listeners) that.listeners = [];
	if (!that.listeners[evt]) that.listeners[evt] = [];
	if (that.listeners[evt].indexOf(fn) < 0) that.listeners[evt].push(fn);

}


function between(a, min, max){
	return Math.max(Math.min(a,max),min);
}

function prevent(e){
	e.preventDefault();
}

//returns value from string with correct type
function recognizeValue(str){
	if (str === "true") {
		return true;
	} else if (str === "false") {
		return false;
	} else if (!isNaN(v = parseFloat(str))) {
		return v;
	} else {
		return str;
	}
}

var cssPrefix = detectCSSPrefix();