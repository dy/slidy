# Slidy [![Code Climate](https://codeclimate.com/github/dfcreative/slidy/badges/gpa.svg)](https://codeclimate.com/github/dfcreative/slidy) ![deps](https://david-dm.org/dfcreative/slidy.svg) ![size](https://img.shields.io/badge/size-11.4kb-brightgreen.svg) [![unstable](http://badges.github.io/stability-badges/dist/unstable.svg)](http://github.com/badges/stability-badges)

Customizable range slider component. [Demo](http://dfcreative.github.io/slidy). [Tests](http://cdn.rawgit.com/dfcreative/slidy).

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


## Usage

[![npm install slidy](https://nodei.co/npm/slidy.png?mini=true)](https://npmjs.org/package/slidy/)

In order to extend supported browsers you may need to polyfill `WeakMap`, `WeakSet`, `Node.prototype.contains`, `MutationObserver`:


```html
https://cdn.polyfill.io/v1/polyfill.js?features=default,WeakMap,WeakSet,Node.prototype.contains
```

```js
var Slidy = require('slidy');

var slidy = new Slidy(el?, {
	//Minimum value
	min: 0,

	//Maximum value
	max: 100,

	//Round value to the step. Can be a function (value) { return ~~value }.
	step: 1,

	//Picker value. In case of multiple pickers - first picker's value.
	value: ( this.min - this.max ) / 2,

	//Type of placement: `horizontal`, `vertical`, `cartesian`, `circular`, `polar`.
	orientation: 'horizontal',

	//Repeat picker by axis: `'x'`, `'y'` or `'both'`.
	repeat: false,


	//Snap to steps during the drag or only when released.
	snap: false,

	//List of picker instances.
	//Can be passed to options as a list of options for each picker.
	//[{value:0}, {value: 1}, ...]
	pickers: [],

	//Class to add to each picker.
	pickerClass: 'slidy-picker',

	//Make point picker so that it is limited by slider only in one-pixel point. Useful for creating seamless repeating pickers, like hue range in color-picker.
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

//Called on value changed.
.on('change')

//Called on each user input.
.on('input')

//Append additional picker.
.addPicker({
	//Minimum/maximum values.
	min: 0,
	max: 100,

	//Current value of a picker. Changing it doesn’t update position of a picker, to do that, call `picker.renderValue(this.value)` or just `picker.update()`.
	value: 0,

	//Apply after-animation.
	release: false,

	//Repeat picker by one of axis: x, y or both.
	repeat: false
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