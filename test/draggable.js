describe("Draggable", function(){

	var canvas = document.createElement("canvas");
	document.body.appendChild(canvas)
	var ctx = canvas.getContext("2d");
	canvas.width  = window.innerWidth;
	canvas.height = 10000;


	it("plain", function(){
		var a = createDraggable("plain")
	})

	it("within", function(){
		var a = createDraggable("within parent", {
			within: 'parent'
		})
	})

	it("pin area", function(){
		var a = createDraggable("pin area", {
			within: 'parent',
			pin: [20,20,40,40]
		})
	})

	it("point picker", function(){
		var a = createDraggable("point picker", {
			within: 'parent',
			pin: [40,40],
			threshold: 0
		})
	})

	it("x", function(){
		createDraggable("x", {
			axis: 'x'
		})
	})

	it("y", function(){
		createDraggable("y", {
			axis: 'y'
		})
	})

	it("circular", function(){
		// createDraggable("circular")
	})

	it("threshold", function(){
		// createDraggable("circular")
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





	function createDraggable(name, opts){
		//TODO: wrapper
		//TODO: thumb

		var el = document.createElement("div");
		el.title = name;
		el.className = "draggable-container";
		document.body.appendChild(el);

		//create mover
		var drEl = document.createElement("div");
		drEl.innerHTML = name;
		el.appendChild(drEl);

		for( var name in opts){
			drEl[name] = opts[name];
		}

		new Draggable(drEl);

		on(drEl, 'threshold', paintThreshold);
		on(drEl, 'dragstart', renderHelpers);
		on(drEl, 'drag', renderHelpers);
		on(drEl, 'dragend', clear);
		on(drEl, 'idle', clear);

		return drEl;
	}


	//canvas painters
	function renderHelpers(){
		clear();
		try{
			ctx.setLineDash([7,4]);
		} catch (e){}
		paintRestrictionArea(this);
		paintPinRect(this);
	}


	function paintRestrictionArea($el){
		var $within = $el.within;
		var pos = offsets($within),
			pads = paddings($within);

		ctx.strokeStyle = 'rgba(60,60,60,1)';
		ctx.lineWidth = 1;

		ctx.beginPath();
		ctx.moveTo(pos.left + pads.left, pos.top + pads.top);
		ctx.lineTo(pos.right - pads.right, pos.top + pads.top);
		ctx.lineTo(pos.right - pads.right, pos.bottom - pads.bottom);
		ctx.lineTo(pos.left + pads.left, pos.bottom - pads.bottom);
		ctx.lineTo(pos.left + pads.left, pos.top + pads.top);
		ctx.stroke();
	}


	function paintThreshold(e){
		var $el = e.currentTarget;

		clear();

		var rect = $el.threshold,
			d = $el._dragparams,
			offsetX = d.offsetX,
			offsetY = d.offsetY;

		if (typeof rect === "number"){
			//number
			rect = [-rect*.5, -rect*.5, rect*.5, rect*.5]
		} else if (rect.length === 2){
			//Array(w,h)
			rect = [-rect[0] *.5, -rect[1] *.5, rect[0] *.5, rect[1] *.5]
		} else if(rect.length === 4){
			//Array(x1,y1,x2,y2)
			rect = rect.slice();
		} else if (typeof rect === "function"){
			//custom rect funciton
			return;
		}

		rect[2] += 1
		rect[3] += 1

		var pos = offsets($el);

		ctx.strokeStyle = 'rgba(60,180,250,1)';
		ctx.lineWidth = 2;

		ctx.beginPath();
		ctx.moveTo(pos.left + offsetX + rect[0], pos.top + offsetY + rect[1]);
		ctx.lineTo(pos.left + offsetX + rect[2], pos.top + offsetY + rect[1]);
		ctx.lineTo(pos.left + offsetX + rect[2], pos.top + offsetY + rect[3]);
		ctx.lineTo(pos.left + offsetX + rect[0], pos.top + offsetY + rect[3]);
		ctx.lineTo(pos.left + offsetX + rect[0], pos.top + offsetY + rect[1]);
		ctx.stroke();
	}


	function paintPinRect($el){
		var pin = $el.pin.slice();
		pin[2] += 1
		pin[3] += 1

		var pos = offsets($el);

		ctx.strokeStyle = 'rgba(60,250,60,1)';
		ctx.lineWidth = 2;

		ctx.beginPath();
		ctx.moveTo(pos.left + pin[0], pos.top + pin[1]);
		ctx.lineTo(pos.left + pin[2], pos.top + pin[1]);
		ctx.lineTo(pos.left + pin[2], pos.top + pin[3]);
		ctx.lineTo(pos.left + pin[0], pos.top + pin[3]);
		ctx.lineTo(pos.left + pin[0], pos.top + pin[1]);
		ctx.stroke();
	}


	function clear(){
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	}

})