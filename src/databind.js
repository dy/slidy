/**
* Data-binding util
*/
//TODO: merge this with imagine.js parser & data-source

var propRe = /\{\{\s([a-zA-Z_$][a-zA-Z_$0-9]*)\s\}\}/;
var propsRe = /\{\{\s[a-zA-Z_$][a-zA-Z_$0-9]*\s\}\}/g;


//Look up for all possible bindings within target, add found particles to dataListeners
function findElementData(target, listeners){
	//look through attributes
	for (var i = 0; i < target.attributes.length; i++){
		var attr = target.attributes[i];
		findAttributeData(attr, listeners);
	}

	//Gather children
	var children = target.childNodes,
		l = children.length;

	for (var i = 0; i < l; i++){
		var child = children[i];
		if (child.nodeType === 3){
			//Text nodes
			findTextNodeData(child, listeners)
		} else if (child.nodeType === 1){
			//Elements
			findElementData(child, listeners);
		}
	}
}

//find data to bind within attribute node
function findAttributeData(attr, listeners){
	var text = attr.textContent,
		match,
		propName;

	//Find properties list
	var propList = text.match(propsRe),
		propNames = [];

	if (!propList) return;

	//Normalize props tpl
	for (var i = 0; i < propList.length; i++){
		var propName = propList[i].match(propRe)[1];
		propNames[i] = propName;

		text = text.replace(propList[i], "{{" + propName + "}}");
	}
	attr.textContent = text;

	//Add every property found to listeners
	addDataListener(listeners, attr, text, propNames)
}

//Find data within text node, split it on parts
function findTextNodeData(node, listeners){
	var text = node.textContent,
		match,
		propName;

	//Find properties list
	var propList = text.match(propsRe),
		propNames = [];

	if (!propList) return;

	//Get prop names
	for (var i = 0; i < propList.length; i++){
		var propName = propList[i].match(propRe)[1];
		propNames[i] = propName;
	}

	//Seal text fragments with data
	var dataNode, rest = node, text;
	for (var i = 0; i < propList.length; i++){
		dataNode = rest.splitText(rest.textContent.indexOf(propList[i]));
		rest = dataNode.splitText(propList[i].length);

		//normalize datanode value
		var text = "{{" + propNames[i] + "}}";
		dataNode.textContent = text;

		//add listener for every sealed fragment
		addDataListener(listeners, dataNode, text, [propNames[i]]);
	}
}

//add data listener to the set
//e.g. addDataListener(listenersList, attributeNode, initialTextContent, ["a", "b", "c"])
function addDataListener(listeners, node, tpl, dataRequired){
	for (var i = dataRequired.length; i--;){
		var prop = dataRequired[i];
		if (!listeners[prop]) listeners[prop] = [];
		listeners[prop].push({
			target: node,
			text: tpl,
			dataRequired: dataRequired
		})
	}

	//TODO: listen to the source change

}


// for (var prop in listeners){
// 	var listener = listeners[prop];
// 	document.addEventListener(prop + "Changed", function(e){
// 		var value = e.target.value;
// 		//NOTE: once data-names've been replaced with values, you can’t no more track them
// 		for (var i = 0; i < target.attributes.length; i++){
// 			var attrName = target.attributes[i].name.replace();
// 			var attrValue = target.attributes[i].value.replace();
// 			if (re.test(attrName)){

// 			}
// 		}
// 		//update attrs
// 		//update content
// 	})
// }