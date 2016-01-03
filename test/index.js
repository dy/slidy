var Slidy = require('../');
var css = require('mucss');
var assert = require('assert');
var test = require('tst');

//TODO: handle same-value case for 2 & more pickers
//TODO: centrize position

var uid = 0;

function createSlider(name, opts, events){
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
				slidy.pickers[i].element.innerHTML =
					slidy.pickers[i].value[0].toFixed(2) +
					(slidy.pickers[i].value[1] !== undefined ? ',' + slidy.pickers[i].value[1].toFixed(2) : '');
			}
			else {
				slidy.pickers[i].element.innerHTML = slidy.pickers[i].value.toFixed(2);
			}
		}

		//update rotation
		// if (opts.change) opts.change.call(slidy, e);
	}

	//create slidy
	var slidy = new Slidy(el, opts);

	if (events !== false) {
		updateValue.call(slidy);
		slidy.on('change', updateValue);
	}

	//show min/max
	el.children[0].innerHTML = slidy.min.length ? slidy.min : slidy.min.toFixed(2);
	el.children[1].innerHTML = slidy.max.length ? slidy.max : slidy.max.toFixed(2);

	return el;
}


//shapes
test('horizonal', function () {
	var el = createSlider('horizontal', {
		min: -1,
		max: 1,
		value: .5
	});
});

test('h inverted', function () {
	var el = createSlider('horizontal', {
		min: 1,
		max: -1,
		value: .5
	});
});

test('vertical', function () {
	var el = createSlider('vertical', {
		min:-1,
		max: 1,
		value: -0.2,
		orientation: 'vertical'
	});
});

test('v inverted', function () {
	var el = createSlider('vertical', {
		min:1,
		max:-1,
		value: 0.2,
		orientation: 'vertical'
	});
});

test('rectangular', function () {
	var el = createSlider('rectangular', {
		min:[0,0],
		max:[100,100],
		value: [40,70],
		orientation: 'cartesian'
	});
});

test('circular', function () {
	var pointer = document.createElement('div');
	pointer.className = 'pointer';

	var el = createSlider('circular', {
		min: Math.PI,
		max: - Math.PI,
		value: 0.5,
		orientation: 'circular',
		change: function (e) {
			css(pointer, {
				'transform': 'rotate(' + (-this.value * 180 / 3.14) + 'deg)'
			});
		}
	});

	el.appendChild(pointer);
});

test('round', function () {
	var pointer = document.createElement('div');
	pointer.className = 'pointer';

	var el = createSlider('circular', {
		min: [0, 0],
		max: [360, 100],
		value: [20, 40],
		orientation: 'polar',
		change: function (e) {
			css(pointer, {
				'transform': 'rotate(' + ((this.value[0]) + 180) + 'deg)',
				'width': this.value[1] + 'px'
			});
		}
	});

	el.appendChild(pointer);
});


//features
test('multiple thumbs', function () {
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

test('rectangular multiple thumbs', function () {
	var el = createSlider('multi rectangular', {
		orientation: 'cartesian',
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

test('round multiple thumbs', function () {
	var el = createSlider('multi circular', {
		orientation: 'polar',
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

test('repeat x', function () {
	var el = createSlider('repeat horizontal', {
		orientation: 'horizontal',
		min: 0,
		max: 100,
		value: 30,
		repeat: true
	});
});

test('repeat y', function () {
	var el = createSlider('repeat vertical', {
		orientation: 'vertical',
		min: 0,
		max: 100,
		value: 30,
		repeat: true
	});
});

test('repeat rect', function () {
	var el = createSlider('repeat rectangular', {
		orientation: 'cartesian',
		min: [-50,-50],
		max: [50,50],
		value: [10,-10],
		repeat: true
	});
});

test('point picker', function () {
	var el = createSlider('point rectangular', {
		orientation: 'cartesian',
		point: true,
		min: [-50,-50],
		max: [50,50],
		value: [20,40],
		repeat: 'x'
	});
});

test('stepping function', function () {
	var el = createSlider('step horizontal', {
		orientation: 'horizontal',
		min: 0,
		max: 100,
		value: 10,
		release: true,
		step: function (value) {
			return value < 1 ? .01 : value > 50 ? 10 : value > 10 ? 5 : 1;
		}
	});
});

test.skip('non-linear value', function () {
	var el = createSlider('step horizontal', {
		orientation: 'horizontal',
		min: 0,
		max: 1000,
		value: function (value) {
			return value < 1 ? .1 : value < 10 ? 1 : value < 100 ? 10 : 100;
		}
	});
});

test('snap', function () {
	var el = createSlider('snap horizontal', {
		orientation: 'horizontal',
		min: 0,
		max: 100,
		step: 10,
		value: 10,
		snap: true
	});
});

test('2-dimensional step', function () {
	var el = createSlider('2dimstep rectangular', {
		orientation: 'cartesian',
		min: [0,0],
		step: [0.05, 5],
		max: [1,100]
	});
});

test('inverted size', function () {
	var thumb = document.createElement('div');
	thumb.className = 'carousel';

	for (var i = 0, item; i < 3; i++) {
		item = document.createElement('div');
		item.className = 'carousel-item';
		thumb.appendChild(item);
		item.innerHTML = i;
	}

	var el = createSlider('inverted', {
		min: 0,
		max: 2,
		step: 1,
		release: true,
		value: 2,
		click: false,
		align: 0,
		// repeat: 'x',
		pickers: [thumb]
	}, false);
});

test.skip('form input', function () {
	var formEl = document.createElement('form');
	formEl.className = 'slidy-form';
	// formEl.action = location.search;
	// formEl.method = 'post';
	formEl.innerHTML = '<input type="range" name="x"/><input type="submit"/>';
	var inputEl = formEl.elements.x;

	var slidy = new Slidy(inputEl);
	slidy.element.classList.add('horizontal');

	formEl.addEventListener('submit', function (e) {
		e.preventDefault();
	});

	document.body.appendChild(formEl);
});


test('focusable', function () {
	var el = createSlider('focusable horizontal', {
		aria: false
	});
});

test.skip('keyboard', function () {
	xxx
});

test('touches', function () {
	var el = createSlider('multitouch rectangular huge', {
		orientation: 'cartesian',
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

test.skip('scroll', function () {
	xxx
});



//cases
test('bind callback via options', function () {
	var i = 0;
	var s = new Slidy({
		value: 2,
		change: function (value) {
			i+=value;
		}
	});
	assert.equal(i,2);
});

test.skip('predefine picker element via `picker` option', function () {

});

test.skip('check point-picker placement after appending virtually created slidy', function () {

});

test('work with 1dim passed as array', function () {
	var el = createSlider('horizontal one-dim-array', {
		min: [-50],
		max: [50],
		value: [20]
	});
});

test('input, change events', function () {
	var el = createSlider('horizontal events', {
		min: -1,
		max: 1,
		value: 0.5,
		input: function (value) {
			console.log('input:', value);
		},
		change: function (value) {
			console.log('change:', value);
		}
	});
});

test.skip('out of bounds initial values', function () {

});

test.skip('wrong initial values', function () {

});

test('autodetect empty values', function () {
	var el = createSlider('vertical autodetect', {
		min: -3,
		max: 0,
		orientation: 'vertical'
	});
});

test.skip('snap repeat', function () {

});

test.skip('2d picker with 1d step - test keys');
