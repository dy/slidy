//jquery-plugin
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