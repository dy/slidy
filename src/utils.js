/*----------------Utils*/
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
	var style = document.defaultView.getComputedStyle(document.body, "");
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
function parseDataAttributes(el) {
	var data = {}, v;
	for (var prop in el.dataset) {
		if (el.dataset[prop] === "true" || el.dataset[prop] === "") {
			data[prop] = true;
		} else if (el.dataset[prop] === "false") {
			data[prop] = false;
		} else if (!Number.isNaN(v = parseFloat(el.dataset[prop]))) {
			data[prop] = v;
		} else {
			data[prop] = el.dataset[prop];
		}
	}
	return data;
}