# Slidy [![Code Climate](https://codeclimate.com/github/dfcreative/slidy/badges/gpa.svg)](https://codeclimate.com/github/dfcreative/slidy) ![deps](https://david-dm.org/dfcreative/slidy.svg) ![size](https://img.shields.io/badge/size-11.4kb-brightgreen.svg) [![unstable](http://badges.github.io/stability-badges/dist/unstable.svg)](http://github.com/badges/stability-badges)

Customizable range slider component. [Demo](http://dfcreative.github.io/slidy). [Tests](http://cdn.rawgit.com/dfcreative/slidy).


[![npm install slidy](https://nodei.co/npm/slidy.png?mini=true)](https://npmjs.org/package/slidy/)

```js
var Slidy = require('slidy');

var slidy = new Slidy(el?, {
	//Minimum value
	min: 0,

	//Maximum value
	max: 100,

	//Step of the value. Can be a function (value) { return Math.round(value); }.
	step: 1,

	//Picker value. In case of multiple pickers - first picker's value.
	value: ( this.min - this.max ) / 2,

	//Type of placement: `horizontal`, `vertical`, `cartesian`, `circular`, `polar`.
	orientation: 'horizontal',

	//Repeat picker by axis: `'x'`, `'y'` or `'both'`.
	repeat: false,

	//Snap to steps during the drag or only when released.
	snap: false,

	//Options for picker instances (see addPicker method).
	//[{value:0}, {value: 1}, ...]
	pickers: [],

	//Class to add to each picker.
	pickerClass: 'slidy-picker',

	//Make pickers single-ponted.
	point: false,

	//Enable click interaction or leave only drag.
	click: true,

	//Enable keyboard interactions.
	keyboard: false,

	//Enable mousewheel interactions.
	wheel: false,

	//Enable aria roles management.
	aria: false,

	//Change callback, will be instantly bound.
	//The only way to catch initial `change` event.
	change: function (e) { }
})

//Update all pickers sizes and positions according to their values (window resize etc).
.update()

//Disable interactivity.
.disable()

//Enable interactivity.
.enable()

//Calle on value changes.
.on('change', fn)

//Calle on user inputs.
.on('input', fn)

//Append additional picker.
.addPicker({
	//Starting value of a picker.
	value: 0,

	//Apply release-animation.
	release: false
});


//Return picker being focused.
slidy.getActivePicker()

//Move picker to relative `x`, `y` coordinates, update value.
.move(x, y)

//Increment/decrement picker value by `this.step` `times`.
.inc(times [, timesY])

//Update size and position of the picker according to the value.
.update();


//Append slidy element to body.
document.body.appendChild(slidy.element);
```

In order to extend supported browsers you may need to polyfill `WeakMap`, `WeakSet`, `Node.prototype.contains`, `MutationObserver`:


```html
https://cdn.polyfill.io/v1/polyfill.js?features=default,WeakMap,WeakSet,Node.prototype.contains
```



## Features

* Range input API
* 2d mode
* Polar/circular mode
* Multuple thumbs
* Looping
* Multitouch
* Accessibility
* Wheel
* Keyboard
* Sniper mode
* Animations



## What slidy is not

* Image slider. Use swiper, dragdealer or alike to create image sliders. Slidy is conceptually bound to value and it’s range, it is (almost) single-purpose plugin. Nonetheless, it is possible to create [simple carousel with slidy](http://dfcreative.github.io/slidy#carousel).
* Content scroller. You can use [slidy as a scrollbar](http://dfcreative.github.io/slidy#scrollbar), but scrolling content is not slidy’s duty.
* Slidy doesn’t paint range or any other visual information, because it is domain-specific data, and interpreting slidy input value[s] is up to user. Slider just provides a reliable mechanism of input. To build domain-specific picker, create a new component, like [color-tool](https://github.com/dfcreative/color-tool).
* Slidy doesn not do non-linear value picking by default, because it supposes linear mapping of screen plot to picking values. The best way to implement [logarithmic or similar non-linear picker](https://dfcreative.github.io/slidy#logarithmic) is to manage value separately in `change` callback.
* It does not polyfill native input nor provide hidden form input. Both tasks are implementable externally quite easily via `change` callback, having them in code would mean useless lines not fitting exact user needs. It is difficult to decide beforehead how values are to be serialized, e. g. 2d values. Focus of the slidy is to provide reliable and agile mechanism of slider input, but not to provide bunch of interfaces.
* It does not implement native input DOM event mechanics (`change`, `input`): if you need that, you can implement that via callbacks. It is done so to keep DOM space unpolluted.


### Related

> [draggy](https://npmjs.org/package/draggy) — draggable provider which just works.
> [resizable](https://npmjs.org/package/resizable) — resizable provider for the full suite.