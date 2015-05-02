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

## Slidy API

| Name | Description |
|---|---|
| `Slidy.prototype.min` | Minimum value. |
| `Slidy.prototype.max` | Maximum value. |
| `Slidy.prototype.value` | Picker value. In case of multiple pickers - first picker's value. |
| `Slidy.prototype.type` | Type of pickers placement, see `Picker.prototype.type`. |
| `Slidy.prototype.repeat` | Repeat picker by axis: x, y or both, |
| `Slidy.prototype.pickers` | List of picker instances. Can be passed to options as a list of options for each picker. `Slidy({pickers: [{value:0}, {value: 1}, ...] })` |
| `Slidy.prototype.getClosestPicker(x, y)` | Get picker closest to the relative `x`, `y` coordinates within the slidy container. |
| `Slidy.prototype.update()` | Update all pickers sizes and positions according to their values. |


## Picker API

| Name | Description |
|---|---|
| `Picker.prototype.min` | Minimum value. |
| `Picker.prototype.max` | Maximum value. |
| `Picker.prototype.value` | Current value of a picker. |
| `Picker.prototype.type` | Type of placement - `'horizontal'`, `'vertical'`, `'rectangular'`, `'circular'`. |
| `Picker.prototype.repeat` | Repeat picker by one of axis: x, y or both. |
| `Picker.prototype.move(x, y)` | Move picker to relative `x`, `y` coordinates, update value. |
| `Picker.prototype.startDrag()` | Start dragging for the picker. |
| `Picker.prototype.update()` | Update size and position according to the value. |


[![NPM](https://nodei.co/npm/slidy.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/slidy/)