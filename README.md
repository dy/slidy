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

`$ npm install slidy`

```js
var Slidy = require('slidy');

var slidy = new Slidy({
	min: 0,
	max: 100,
	value: 12
});

document.body.appendChild(slidy.element);
```

In order to expand browser support you may need to polyfill `WeakMap`, `WeakSet`, `Node.prototype.contains`, `MutationObserver`:


```html
<script src="https://cdn.polyfill.io/v1/polyfill.js?features=default,WeakMap,WeakSet,Node.prototype.contains"></script>
```


## API

### Slidy

All these parameters can be passed to options or redefined straightly on the prototype.

| Option | Description |
|---|---|
| `min` | Minimum value. By default 0. |
| `max` | Maximum value. By default 100. |
| `value` | Picker value. In case of multiple pickers - first picker's value. By default - `( min - max ) / 2`. |
| `orientation` | Type of pickers placement: `horizontal`, `vertical`, `cartesian`, `circular`, `polar` |
| `repeat` | Repeat picker by axis: `'x'`, `'y'` or `'both'`, |
| `pickerClass` | Class to add to each picker. |
| `step` | Round value to the step. Can be a function, accepting value and returning rounded value. |
| `snap` | Snap always or only when released. |
| `picker` | A picker element to init, if predefined already. Otherwise it will be created. If `pickers` passed - this option will be ignored. |
| `pickers` | List of picker instances. Can be passed to options as a list of options for each picker. `Slidy({pickers: [{value:0}, {value: 1}, ...] })` |
| `point` | Make point picker so that it is limited by slider only in one-pixel point. Useful for creating seamless repeating pickers, like hue range in color-picker. |
| `click` | Enable click interaction or leave only drag. |
| `keyboard` | Enable keyboard interactions. |
| `wheel` | Enable mousewheel interactions. |
| `aria` | Enable aria roles management. |
| `change` | Change callback, will be instantly bound. The only way to catch initial `change` event. |

| Method | Description |
|---|---|
| `update()` | Update all pickers sizes and positions according to their values. |
| `disable()` | Disable interactivity. |
| `enable()` | Enable interactivity. |


### Picker (thumb)

Per-picker options can redefine slidy default options.

| Option | Description |
|---|---|
| `min` | Minimum value. |
| `max` | Maximum value. |
| `value` | Current value of a picker. Changing it doesn’t update position of a picker, to do that, call `picker.renderValue(this.value)` or just `picker.update()`. |
| `release` | Apply after-animation. |
| `repeat` | Repeat picker by one of axis: x, y or both. |

| Method | Description |
|---|---|
| `move(x, y)` | Move picker to relative `x`, `y` coordinates, update value. |
| `inc(times [, timesY])` | Increment/decrement picker value by `this.step` `times`. |
| `update()` | Update size and position according to the value. |


## What slidy is not

* Image slider. Use swiper, dragdealer or alike to create image sliders. Slidy is conceptually bound to value and it’s range, it is (almost) single-purpose plugin. Nonetheless, it is possible to create [simple carousel with slidy](http://dfcreative.github.io/slidy#carousel).
* Content scroller. You can use [slidy as a scrollbar](http://dfcreative.github.io/slidy#scrollbar), but scrolling content is not slidy’s duty.
* Slidy doesn’t paint range or any other visual information, because it is domain-specific data, and interpreting slidy input value[s] is farmed out to user. Slider just provides a reliable mechanism of input. To build domain-specific picker, create a new component, like [color-picker](https://github.com/dfcreative/picky).
* Slidy doesn’t do non-linear value picking by default, because it supposes linear mapping of screen plot to picking values. The best way to implement [logarithmic or similar non-linear picker](https://dfcreative.github.io/slidy#logarithmic) is to manage value separately in `change` callback.
* It does not polyfill native input nor provide hidden form input. Both tasks are implementable externally quite easily via `change` callback, having them in code would mean useless lines not fitting exact user needs. It is difficult to decide beforehead how values are to be serialized, e. g. 2d values. Focus of the slidy is to provide reliable and agile mechanism of slider input, but not to provide bunch of interfaces.

[![NPM](https://nodei.co/npm/slidy.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/slidy/)