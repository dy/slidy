describe("Slidy", function(){

	//TODO: handle same-value case for 2&more pickers

	function createSlider(name, opts){
		var el = document.createElement("div");
		el.title = name;
		el.className = name + ' slidy';
		el.innerHTML = [
			'<span class="min">-</span>',
			'<span class="max">+</span>',
		].join("");
		document.body.appendChild(el);

		extend(el, opts);

		//update value
		el.addEventListener("change", updateValue);
		el.addEventListener("created", updateValue);

		function updateValue(){
			for (var i = 0, l = this.pickers.length; i < l; i++){
				this.pickers[i].innerHTML = this.value.length ? this.value[i] : this.value.toFixed(2);
			}
		}

		//create slidy
		Slidy(el);

		//show min/max
		el.children[0].innerHTML = el.min.length && el.min || el.min.toPrecision(2);
		el.children[1].innerHTML = el.max.length && el.max || el.max.toPrecision(2);


		return el;
	}



	describe("shapes", function(){
		it.only("horizonal", function(){
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

		// it("sector", function(){
		// 	xxx
		// })

		// it("svg shape", function(){
		// 	xxx
		// })
	})



	describe("features", function(){
		it("multiple thumbs", function(){
			var el = createSlider("multi horizontal", {
				type: "horizontal",
				min: 100,
				max: 0,
				values: [10, 50, 80]
			})
		})

		it("rectangular multiple thumbs", function(){
			var el = createSlider("multi rectangular", {
				type: "rectangular",
				min: [100, -100],
				max: [-100, 100],
				value: 50, //bad value
				values: [[-10, 50], [80, -10], [10,20], [-100,-100]]
			})
		})

		it("repeat x", function(){
			document.body.appendChild(
				new Slidy({
					title: "repeat x",
					className: "horizontal",
					change: function(){this.activePicker.innerHTML = this.value},

					type: "horizontal",
					min: -10,
					max: 10,
					value: 1,
					step: 2,
					snap: true,
					repeat: true
				})
			);
		})

		it("repeat y", function(){
			xxx
		})

		it("repeat rect", function(){
			xxx
		})

		// it("expose data", function(){
		// 	xxx
		// })

		// it("steps (small number of them)", function(){
		// 	xxx
		// })

		// it("snapping (random grid)", function(){
		// 	xxx
		// })

		// it("loose boundaries", function(){
		// 	xxx
		// })

		// it("image slider example", function(){
		// 	xxx
		// })
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

		it("scroll x", function(){
			xxx
		})

		it("scroll y", function(){
			xxx
		})

		it("scroll xy", function(){
			xxx
		})
	})


	describe("corner cases", function(){
		it("out of bounds initial values", function(){
			xxx
		})

		it("wrong initial values", function(){
			xxx
		})
	})

})