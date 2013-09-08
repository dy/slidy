(function($){
	//#include "../src/utils.js"
	//#include "../src/slide-area.js"

	//Plugin
	$.fn["/* #put pluginName */"] = function (arg) {
		var $el = $(this),
			instance = new SlideArea($el[0], arg);
		$el.data(/*#put "\"" + pluginName + "\"" */, null);
		$el.data("/* #put pluginName */", instance);
		return instance;
	};

	$.SlideArea = SlideArea;
})(window.jQuery || window.Zepto);