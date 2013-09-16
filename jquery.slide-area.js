//used as grunt build script
(function($){
//HOMEMADE ERROR: Include failed. Can’t find "src/utils.js"
//HOMEMADE ERROR: Include failed. Can’t find "src/slide-area.js"
//jquery-plugin
if ($){
	$.fn[pluginName] = function (arg) {
		var $el = $(this),
			instance = new SlideArea($el[0], arg);
		$el.data(pluginName, null);
		$el.data(pluginName, instance);
		return instance;
	};

	$.SlideArea = SlideArea;
}
})(window.jQuery || window.Zepto);