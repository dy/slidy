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

	it("multiple thumbs", function(){

	})

	it("rectangular multiple thumbs", function(){

	})

	it("focusable", function(){

	})

	it("focused keyboard control", function(){

	})

	it("expose data", function(){

	})

	it("mobile touch", function(){

	})

	it("circular", function(){

	})

	it("svg shape", function(){

	})
})