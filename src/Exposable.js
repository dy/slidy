/**
* Make any element expose own value to the global with name
* TODO: think about it
*/

//
(function(global){
	var dataSources = {};

	var Exposable = Behaviour.register("Exposable", {
		states: {
			init: {
				before: function(){
					console.log(123)
				}
			}
		}
	})


	global["Exposable"] = Exposable;

})(window)