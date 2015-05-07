# Slidy [![Build Status](https://travis-ci.org/dfcreative/slidy.svg?branch=master)](https://travis-ci.org/dfcreative/slidy) [![Code Climate](https://codeclimate.com/github/dfcreative/slidy/badges/gpa.svg)](https://codeclimate.com/github/dfcreative/slidy)

Customizable range slider component. [Demo](TODO).

## Features

* Multitouch
* Looping
* Accessibility
* Sniper mode
* Circular/gauge mode
* Multiple dimensions
* Multuple pickers
* Animations
* Wheel control
* Keyboard controls
* Grid display
* Native-compliant behaviour/polyfill

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
| `Slidy.prototype.type` | Type of pickers placement, see `Picker.prototype.type`. |
| `Slidy.prototype.repeat` | Repeat picker by axis: `'x'`, `'y'` or `'both'`, |
| `Slidy.prototype.pickerClass` | Class to add to each picker. |
| `Slidy.prototype.step` | Round value to the step. Can be a function, accepting value and returning rounded value. |
| `Slidy.prototype.snap` | Snap always or only when released. |
| `Slidy.prototype.pickers` | List of picker instances. Can be passed to options as a list of options for each picker. `Slidy({pickers: [{value:0}, {value: 1}, ...] })` |
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
| `Picker.prototype.type` | Type of placement - `'horizontal'`, `'vertical'`, `'rectangular'`, `'circular'`, `'round'`. |
| `Picker.prototype.align` | Align picker to the side `0..1`. Default is `0.5`, i. e. align by center. |
| `Picker.prototype.release` | Apply after-animation. |
| `Picker.prototype.repeat` | Repeat picker by one of axis: x, y or both. |
| `Picker.prototype.move(x, y)` | Move picker to relative `x`, `y` coordinates, update value. |
| `Picker.prototype.inc(times [, timesY])` | Increment/decrement picker value on `this.step` `times`. |
| `Picker.prototype.update()` | Update size and position according to the value. |


## What slidy is not

* Image slider. Use swiper, dragdealer or alike to create huge thumbs. Slidy is conceptually bound to value and it’s range. Slidy is (almost) single-purpose value slider.
* Content scroller. You can use slidy as a scrollbar, but scrolling content is not slidy’s duty.


[![NPM](https://nodei.co/npm/slidy.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/slidy/)