//Makes jquery-plugin/AMD/CommonJS module/component/xtag/other out of vanilla constructor
if ($){
	$.fn[pluginName] = function (arg) {
		var $el = $(this),
			instance = new Slidy($el[0], arg);
		$el.data(pluginName, null);
		$el.data(pluginName, instance);
		return instance;
	};


	$.slidy = Slidy;
}