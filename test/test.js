describe("Kinds of sliders", function(){

	function createSlider(name, opts){
		var el = document.createElement("div");
		el.title = name;
		el.className = name;
		el.innerHTML = [
			'<span class="min">-</span>',
			'<span class="max">+</span>',
		].join("");
		document.body.appendChild(el);

		//update value
		on(el, "change", function(){
			if (this.picker) this.picker.innerHTML = this.value;
		})

		//create slidy
		new Slidy(el, opts);

		//show min/max
		el.children[0].innerHTML = el.min;
		el.children[1].innerHTML = el.max;


		return el;
	}

	it("horizonal", function(){

		var el = createSlider("horizontal", {
			min: -1,
			max: 1,
			value: .5
		});

		//click somewhere in between area
		//TODO: pass mouse coordinates
		// var e = createMouseEvt("click", 0);
		// dispatchEvt(el, )

		//drag to somewhere
	})

	it("inverted horizonal", function(){
		var el = createSlider("horizontal", {
			min: 1,
			max: -1,
			value: .5
		});
	})

	it("vertical", function(){
		var el = createSlider("vertical", {
			min:-1,
			max: 1,
			value: 0,
			type: 'vertical'
		})
	})

	it("inverted vertical", function(){

	})


	it ("should be able to become vertical & inverted", function(){

	})

	describe("should be able to become range slider", function(){
		// var a = new Slidy({
		// 	thumbs: 2
		// });

		// document.body.appendChild(a);

		it("should support inverted selection", function(){

		})

		it("should support multiple thumbs", function(){

		})
	})

	it("should be focusable", function(){

	})

	it("should be key-controllable when focused", function(){

	})

	it("should expose data under the name", function(){

	})

	it("should support gestures", function(){

	})

	it("should init multidimensional properties", function(){
		// var a = new Slidy({
		// 	dimensions: 2
		// });

//		console.log(a.value)
	})

	it("should be able to be multidimensional range", function(){

	})

	it("should be able to be circular", function(){

	})

	it("should be able to support any move shape", function(){

	})
})