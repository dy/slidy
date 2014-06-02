describe("Draggable", function(){

	function createDraggable(name, opts){
		//TODO: wrapper
		//TODO: thumb

		var el = document.createElement("div");
		el.title = name;
		el.className = name + " draggable-container";
		document.body.appendChild(el);

		//create mover
		var drEl = document.createElement("div");
		drEl.innerHTML = name;
		el.appendChild(drEl);
		new Draggable(drEl, opts);

		return drEl;
	}

	it("plain", function(){
		var a = createDraggable("plain")
	})

	it("within", function(){
		var a = createDraggable("within parent", {
			within: 'parent'
		})
	})

	it("pin", function(){

	})

	it("point picker", function(){

	})

	it("repeat", function(){
		//TODO: think of excluding repeat from draggable and placing it to slidy
	})

	it("handle", function(){

	})

	it("ghost", function(){

	})

	it("drop areas", function(){

	})

	it("loose limits", function(){

	})

	//Sniper mode
	//autoscroll

})