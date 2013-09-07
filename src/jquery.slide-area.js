//Plugin
$.fn[pluginName] = function (arg) {
	var $el = $(this),
		instance = new SlideArea($el[0], arg);
	$el.data(pluginName, null);
	$el.data(pluginName, instance);
	return instance;
}

$.SlideArea = SlideArea;