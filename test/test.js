describe("Basic behaviour", function(){
	it("should work basic behaviour", function(){
		var el = document.createElement("div");
		el.id = "basic"
		el.innerHTML = "basic"

		document.body.appendChild(el);

		new Slidy(el, {
			min: -100,
			max: 100,
			value: 50,
			change: function(){
				el.firstChild.textContent = this.value
			}
		});

		//click somewhere in between area
		//TODO: pass mouse coordinates
		// var e = createMouseEvt("click", 0);
		// dispatchEvt(el, )

		//drag to somewhere
	})

	it ("should be able to become vertical & inverted", function(){
		var el = document.createElement("div");
		el.id = "vertical"
		el.innerHTML = "vertical"

		new Slidy(el, {
			vertical: true,
			min: 12,
			max: -12,
			value: 8
		});

		el.style.width = "40px";
		el.style.height = "100px";
		el.style["word-break"] = "break-all";

		document.body.appendChild(el);
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