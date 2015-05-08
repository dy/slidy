var Slidy = require('slidy');
var css = require('mucss');


describe("Slidy", function () {

	//TODO: handle same-value case for 2 & more pickers
	//TODO: centrize position

	var uid = 0;

	function createSlider(name, opts){
		var el = document.createElement("div");
		el.title = name;
		el.className = name + ' slidy';
		el.innerHTML = [
			'<span class="min">-</span>',
			'<span class="max">+</span>',
		].join("");
		// el.id = 'slidy-' + uid++;
		document.body.appendChild(el);

		function updateValue (e) {
			var slidy = this;

			//update value in picker
			for (var i = 0, l = slidy.pickers.length; i < l; i++){
				if (slidy.pickers[i].value instanceof Array) {
					slidy.pickers[i].element.innerHTML = slidy.pickers[i].value[0].toFixed(2) + ',' + slidy.pickers[i].value[1].toFixed(2);
				}
				else {
					slidy.pickers[i].element.innerHTML = slidy.pickers[i].value.toFixed(2);
				}
			}

			//update rotation
			if (opts.change) opts.change.call(slidy, e);
		}

		//create slidy
		var slidy = new Slidy(el, opts);
		updateValue.call(slidy);
		slidy.on('change', updateValue);

		//show min/max
		el.children[0].innerHTML = slidy.min.length ? slidy.min : slidy.min.toFixed(2);
		el.children[1].innerHTML = slidy.max.length ? slidy.max : slidy.max.toFixed(2);

		return el;
	}



	describe('shapes', function () {
		it('horizonal', function () {
			var el = createSlider('horizontal', {
				min: -1,
				max: 1,
				value: .5
			});
		});

		it('h inverted', function () {
			var el = createSlider('horizontal', {
				min: 1,
				max: -1,
				value: .5
			});
		});

		it('vertical', function () {
			var el = createSlider('vertical', {
				min:-1,
				max: 1,
				value: -0.2,
				type: 'vertical'
			});
		});

		it('v inverted', function () {
			var el = createSlider('vertical', {
				min:1,
				max:-1,
				value: 0.2,
				type: 'vertical'
			});
		});

		it('rectangular', function () {
			var el = createSlider('rectangular', {
				min:[0,0],
				max:[100,100],
				value: [40,70],
				type: 'rectangular'
			});
		});

		it('circular', function () {
			var pointer = document.createElement('div');
			pointer.className = 'pointer';

			var el = createSlider('circular', {
				min: Math.PI,
				max: - Math.PI,
				value: 0.5,
				type: 'circular',
				change: function (e) {
					css(pointer, {
						'-webkit-transform': 'rotate(' + (-this.value * 180 / 3.14) + 'deg)'
					});
				}
			});

			el.appendChild(pointer);
		});

		it('round', function () {
			var pointer = document.createElement('div');
			pointer.className = 'pointer';

			var el = createSlider('circular', {
				min: [0, 0],
				max: [360, 100],
				value: [20, 40],
				type: 'round',
				change: function (e) {
					css(pointer, {
						'-webkit-transform': 'rotate(' + ((this.value[0]) + 180) + 'deg)',
						'width': this.value[1] + 'px'
					});
				}
			});

			el.appendChild(pointer);
		});
	});


	describe('features', function () {
		it('multiple thumbs', function () {
			var el = createSlider('multi horizontal', {
				min: 100,
				max: 0,
				pickers: [
					{value: 10, step: 5},
					{value: 50},
					{value: 80}
				]
			});
		});

		it('rectangular multiple thumbs', function () {
			var el = createSlider('multi rectangular', {
				type: 'rectangular',
				min: [100, -100],
				max: [-100, 100],
				pickers: [
					{ value: [-10, 50]},
					{ value: [80, -10]},
					{ value: [10, 20]},
					{ value: [-100,-100]}
				]
			});
		});

		it('round multiple thumbs', function () {
			var el = createSlider('multi circular', {
				type: 'round',
				min: [100, -100],
				max: [-100, 100],
				pickers: [
					{ value: [-10, 50] },
					{ value: [80, -10] },
					{ value: [10,20] },
					{ value: [-100,-100] }
				]
			});
		});

		it('repeat x', function () {
			var el = createSlider('repeat horizontal', {
				type: 'horizontal',
				min: 0,
				max: 100,
				value: 30,
				repeat: true
			});
		});

		it('repeat y', function () {
			var el = createSlider('repeat vertical', {
				type: 'vertical',
				min: 0,
				max: 100,
				value: 30,
				repeat: true
			});
		});

		it('repeat rect', function () {
			var el = createSlider('repeat rectangular', {
				type: 'rectangular',
				min: [-50,-50],
				max: [50,50],
				value: [10,-10],
				repeat: true
			});
		});

		it('point picker', function () {
			var el = createSlider('point rectangular', {
				type: 'rectangular',
				point: true,
				min: [-50,-50],
				max: [50,50],
				value: [20,40],
				repeat: 'x'
			});
		});

		it('stepping function', function () {
			var el = createSlider('step horizontal', {
				type: 'horizontal',
				min: 0,
				max: 100,
				value: 10,
				release: true,
				step: function (value) {
					return value < 1 ? .01 : value > 50 ? 10 : value > 10 ? 5 : 1;
				}
			});
		});

		it.skip('non-linear value', function () {
			var el = createSlider('step horizontal', {
				type: 'horizontal',
				min: 0,
				max: 100,
				value: 10,
				step: function (value) {
					return value < 1 ? .01 : value > 50 ? 10 : value > 10 ? 5 : 1;
				}
			});
		});

		it('snap', function () {
			var el = createSlider('snap horizontal', {
				type: 'horizontal',
				min: 0,
				max: 100,
				step: 10,
				value: 10,
				snap: true
			});
		});

		it('inverted size', function () {
			var thumb = document.createElement('div');
			thumb.className = 'carousel';

			var el = createSlider('inverted', {
				min: 0,
				max: 3,
				step: 1,
				value: 0,
				click: false,
				align: 0,
				pickers: [thumb]
			});
		});
	});

	describe('interactions', function () {
		it('focusable', function () {
			var el = createSlider('focusable horizontal', {
				aria: false
			});
		});

		it.skip('keyboard', function () {
			xxx
		});

		it('touches', function () {
			var el = createSlider('multitouch rectangular huge', {
				type: 'rectangular',
				min: [100, -100],
				max: [-100, 100],
				pickers: [
					{ value: [-10, 50]},
					{ value: [80, -10]},
					{ value: [10, 20]},
					{ value: [-100,-100]}
				]
			});
		});

		it.skip('scroll', function () {
			xxx
		});
	});


	describe('corner cases', function () {
		it.skip('out of bounds initial values', function () {

		});

		it.skip('wrong initial values', function () {

		});

		it.skip('empty initial values array', function () {

		});
	});

});