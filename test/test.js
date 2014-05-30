describe("Basic behaviour", function(){

	function createSlider(name){
		var el = document.createElement("div");
		el.title = name;
		el.innerHTML = [
			'<span class="min">-</span>',
			'<span class="value">|</span>',
			'<span class="max">+</span>',
		].join("");
		document.body.appendChild(el);

		return el;
	}

	it("should work basic behaviour", function(){

		var el = createSlider("basic");

		new Slidy(el, {
			min: -1,
			max: 1,
			value: .5,
			change: function(){
				el.children[1].innerHTML = this.value
			}
		});

		//click somewhere in between area
		//TODO: pass mouse coordinates
		// var e = createMouseEvt("click", 0);
		// dispatchEvt(el, )

		//drag to somewhere
	})

	it("become vertical", function(){

	})

	it("become inverted", function(){

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