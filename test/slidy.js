describe("Slidy", function(){

	//TODO: handle same-value case for 2&more pickers

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
			// console.log("value changed", this.value)
			if (this.activePicker) this.activePicker.innerHTML = this.value;
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

		it("h inverted", function(){
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

		it("v inverted", function(){
			var el = createSlider("vertical", {
				min:1,
				max:-1,
				value: 0.2,
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
			var pointer = document.createElement("div");
			pointer.className = "pointer";

			var el = createSlider("circular", {
				min: [0, 0],
				max: [360, 100],
				value: [0, 40],
				type: 'round',
				change: function(e){
					// console.log(e.detail);
					css(pointer, {
						"-webkit-transform": "rotate(" + ((this.value[0]) + 180) + "deg)",
						"width": this.value[1] + "px"
					})
				}
			})

			el.appendChild(pointer);
		})

		it("sector", function(){
			xxx
		})

		it("svg shape", function(){
			xxx
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
			var el = createSlider("multi horizontal", {
				type: "horizontal",
				min: 100,
				max: 0,
				value: 50,
				values: [10, 50, 80]
			})
		})

		it("rectangular multiple thumbs", function(){
			var el = createSlider("multi rectangular", {
				type: "rectangular",
				min: [100, -100],
				max: [-100, 100],
				value: 50,
				values: [[-10, 50], [80, -10], [10,20], [-100,-100]]
			})
		})

		it("repeat x", function(){
			xxx
		})

		it("repeat y", function(){
			xxx
		})

		it("repeat rect", function(){
			xxx
		})
		it("expose data", function(){
			xxx
		})

		it("snapping", function(){
			xxx
		})

		it("loose limits", function(){
			xxx
		})
	})


	describe("interaction", function(){
		it("focusable", function(){
			xxx
		})

		it("focused keyboard control", function(){
			xxx
		})

		it("touches", function(){
			xxx
		})

		it("scroll", function(){
			xxx
		})
	})


	describe("corner cases", function(){
		it("out of bounds values", function(){
			xxx
		})
	})

})