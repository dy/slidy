/**
* Broadcast data changes on the element
*/

class Expose extends Component{
	constructor(el, opts){
		var self = super(el, opts);

		//find closest form/document to expose data
		if (!self.to) {
			var parentNode = self;
			while(parentNode !== document && parentNode.tagName !== "FORM"){
				parentNode = parentNode.parentNode;
			}
			self.to = parentNode
		}

		console.log("Expose to", self.to)

		//TODO: detect what data to keep

		//TODO: comply with the other datatrackers

		//TODO: recognize moustache-templates within that form
		self.targets = [];
		self.addTarget.call(self, self.to);

		//TODO: write own value to that form by name, dynamically

		//TODO: observe changes of value, update templates


		return self;
	}

	//TODO: collects all targets to keep updated within the form
	//for every element within container - collect attrs, textnodes, chindNodes
	addTarget(target){
		var listeners = [],
		//TODO: use moustache-parser from imagine.js instead, create imagine-data-expression object, in order to use filters
			dataRE = /\{\{\s*([a-zA-Z_$][a-zA-Z_$0-9]*)\s*\}\}/ig

		//recognize element
		if (target.nodeType === 3){

			//check already parsed data

			//check attrs
			for (var i = 0; i < target.attributes.length; i++){
				var attrValue = target.attributes[i].value;
				var propIdx

				//grasp every value met
				while ((propIdx = attrValue.indexOf("{{")) >= 0){
					var closeIdx = attrValue.indexOf("}}");
					var propName = attrValue.slice(propIdx + 2, closeIdx).trim();

					//TODO: set default value
					/*target.attributes[i].value = [
						target.attributes[i].value.slice(0, propIdx),
						data[propName],
						target.attributes[i].value.slice(closeIdx, attrValue.length - 1)
					].join('');*/

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

			//TODO: save recognized required data to target in order to reuse quickly by other data-recognizers

			//iterate over each child
			var children = container.childNodes;
			for (var i = children.length; i--;){
				var child = children[i];
				this.addTarget(child);
			}
		}

		//recognize text node
		else if (target.nodeType === 1) {
			var text = this.textContent,
				openIdx;
			//TODO: split text content in the place of data insertion
			while ((openIdx = attrValue.indexOf("{{")) >= 0){
				var closeIdx = attrValue.indexOf("}}");
			}
		}
	}

}

Expose.states = {
	default: {
		change: function(e){}
	}
}

Expose.defaults = {
	//change values not often than
	throttle: 100,

	//where to expose data: window/document/form/this
	to: null
}

Component.register(Expose)