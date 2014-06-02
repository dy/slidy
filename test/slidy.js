describe("Slidy", function(){

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
		el.children[0].innerHTML = el.min.length && el.min || round(el.min, .01);
		el.children[1].innerHTML = el.max.length && el.max || round(el.max, .01);


		return el;
	}

	describe("shapes", function(){
		it("horizonal", function(){
			//TODO: why not centered by y?

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

		it("horizonal inverted", function(){
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

		it("vertical inverted", function(){
			var el = createSlider("vertical", {
				min:1,
				max:-1,
				value: 0,
				type: 'vertical'
			})
		})

		it("rectangular", function(){
			var el = createSlider("rectangular", {
				min:[0,0],
				max:[100,100],
				value: [40,70],
				type: 'rectangular'
			})
		})

		it("circular", function(){
			var pointer = document.createElement("div");
			pointer.className = "pointer";

			var el = createSlider("circular", {
				min: Math.PI,
				max: - Math.PI,
				value: 0,
				type: 'circular',
				change: function(e){
					// console.log(e.detail);
					css(pointer, {
						"-webkit-transform": "rotate(" + e.detail + "deg)"
					})
				}
			})

			el.appendChild(pointer);

		})

		it("round", function(){
			// var el = createSlider("round", {
			// 	min:[0,0],
			// 	max:[100,100],
			// 	value: [40,70],
			// 	type: 'round'
			// })
		})

		it("svg shape", function(){
			// var el = createSlider("rectangular", {
			// 	min:[0,0],
			// 	max:[100,100],
			// 	value: [40,70],
			// 	type: 'svg'
			// })
		})
	})



	describe("features", function(){
		it("multiple thumbs", function(){

		})

		it("rectangular multiple thumbs", function(){

		})

		it("repeat x", function(){

		})

		it("repeat y", function(){

		})

		it("repeat rect", function(){

		})
		it("expose data", function(){

		})
	})


	describe("interaction", function(){
		it("focusable", function(){

		})

		it("focused keyboard control", function(){

		})

		it("mobile touch", function(){

		})

		it("scroll", function(){

		})
	})

})