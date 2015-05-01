# slidy

Range slider component. [Tests](TODO).

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

## Slider API

| Name | Description |
|---|---|
| `Slidy#min` | Minimum value. |
| `Slidy#max` | Maximum value. |
| `Slidy#value` | Picker value. In case of multiple pickers - first picker's value. |
| `Slidy#pickers` | List of picker instances. Can be passed in options as a list of options for each picker. `Slidy({pickers: [{value:0}, {value: 1}, ...] })` |
| `Slidy#createPicker(options?)` | Create a new picker. |
| `Slidy#getClosestPicker(x, y)` | Get picker closest to the relative `x`, `y` coordinates within the slidy container. |
| `Slidy#update()` | Update all pickers sizes and positions. |


## Picker API

| Name | Description |
|---|---|
| `Picker#min` | Minimum value. |
| `Picker#max` | Maximum value. |
| `Picker#value` | Current raw value of a picker. |
| `Picker#type` | Type of placement - `'horizontal'`, `'vertical'`, `'rectangular'`, `'circular'`. |
| `Picker#move(x, y)` | Move picker to relative `x`, `y` coordinates. |
| `Picker#startDrag()` | Start dragging for the picker. |
| `Picker#renderValue(value)` | Move picker so to visually reflect the value passed. |
| `Picker#calcValue()` | Calculate value from picker’s position. |


[![NPM](https://nodei.co/npm/slidy.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/slidy/)