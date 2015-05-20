# Slidy [![Code Climate](https://codeclimate.com/github/dfcreative/slidy/badges/gpa.svg)](https://codeclimate.com/github/dfcreative/slidy) ![deps](https://david-dm.org/dfcreative/slidy.svg) ![size](https://img.shields.io/badge/size-10.8kb-brightgreen.svg) [![unstable](http://badges.github.io/stability-badges/dist/unstable.svg)](http://github.com/badges/stability-badges)

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

## API

### Slidy

All these values can be passed to options or redefined straightly on the prototype.

| Name | Description |
|---|---|
| `Slidy.prototype.min` | Minimum value. By default 0. |
| `Slidy.prototype.max` | Maximum value. By default 100. |
| `Slidy.prototype.value` | Picker value. In case of multiple pickers - first picker's value. By default - `( min - max ) / 2`. |
| `Slidy.prototype.orientation` | Type of pickers placement: `horizontal`, `vertical`, `cartesian`, `circular`, `polar` |
| `Slidy.prototype.repeat` | Repeat picker by axis: `'x'`, `'y'` or `'both'`, |
| `Slidy.prototype.pickerClass` | Class to add to each picker. |
| `Slidy.prototype.step` | Round value to the step. Can be a function, accepting value and returning rounded value. |
| `Slidy.prototype.snap` | Snap always or only when released. |
| `Slidy.prototype.pickers` | List of picker instances. Can be passed to options as a list of options for each picker. `Slidy({pickers: [{value:0}, {value: 1}, ...] })` |
| `Slidy.prototype.point` | Make point picker so that it is limited by slider only in one-pixel point. Useful for creating seamless repeating pickers, like hue range in color-picker. |
| `Slidy.prototype.click` | Enable click interaction or leave only drag. |
| `Slidy.prototype.keyboard` | Enable keyboard interactions. |
| `Slidy.prototype.wheel` | Enable mousewheel interactions. |
| `Slidy.prototype.aria` | Enable aria roles management. |
| `Slidy.prototype.update()` | Update all pickers sizes and positions according to their values. |
| `Slidy.prototype.disable()` | Disable interactivity. |
| `Slidy.prototype.enable()` | Enable interactivity. |


### Picker

Per-picker options can redefine slidy default options.

| Name | Description |
|---|---|
| `Picker.prototype.min` | Minimum value. |
| `Picker.prototype.max` | Maximum value. |
| `Picker.prototype.value` | Current value of a picker. Changing it doesn’t update position of a picker, to do that, call `picker.renderValue(this.value)` or just `picker.update()`. |
| `Picker.prototype.release` | Apply after-animation. |
| `Picker.prototype.repeat` | Repeat picker by one of axis: x, y or both. |
| `Picker.prototype.move(x, y)` | Move picker to relative `x`, `y` coordinates, update value. |
| `Picker.prototype.inc(times [, timesY])` | Increment/decrement picker value by `this.step` `times`. |
| `Picker.prototype.update()` | Update size and position according to the value. |


## What slidy is not

* Image slider. Use swiper, dragdealer or alike to create image sliders. Slidy is conceptually bound to value and it’s range, it is (almost) single-purpose plugin. Nonetheless, it is possible to create [simple carousel with slidy](http://dfcreative.github.io/slidy#carousel).
* Content scroller. You can use [slidy as a scrollbar](http://dfcreative.github.io/slidy#scrollbar), but scrolling content is not slidy’s duty.
* Slidy doesn’t paint range or any other visual information, because it is domain-specific data, and interpreting slidy input value[s] is farmed out to user. Slider just provides a reliable mechanism of input. To build domain-specific picker, create a new component, like [color-picker](https://github.com/dfcreative/picky).
* Slidy doesn’t do non-linear value picking by default, because it supposes linear mapping of screen plot to picking values. The best way to implement [logarithmic or similar non-linear picker](https://dfcreative.github.io/slidy#logarithmic) is to manage value separately in `change` callback.
* It does not polyfill native input nor provide hidden form input. Both tasks are implementable externally quite easily via `change` callback, having them in code would mean useless lines not fitting exact user needs. It is difficult to decide beforehead how values are to be serialized, e. g. 2d values. Focus of the slidy is to provide reliable and agile mechanism of slider input, but not to provide bunch of interfaces.

[![NPM](https://nodei.co/npm/slidy.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/slidy/)