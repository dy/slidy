# slidy

Range slider component.

[Tests](TODO).

## Usage

`$ npm install slidy`

```js
var Slidy = require('slidy');

var slidy = new Slidy;

document.body.appendChild(slidy.element);
```

## Options

## Slidy API

| Name | Description |
|---|---|
| `Slidy#createPicker(options?)` | Create and append a new picker. |
| `Slidy#picker` | Active picker. |
| `Slidy#value` | Active picker value. |
| `Slidy#values` | Values of all pickers. |
| `Slidy#pickers` | List of picker instances. |
| `Slidy#getClosestPicker(x, y)` | Get picker closest to the relative `x`, `y` coordinates within the slidy container. |
| `Slidy#update()` | Update all pickers sizes and positions acc |

## Picker API

| Name | Description |
|---|---|
| `Picker#value` | Current raw value of a picker. |
| `Picker#min` | Minimum value. |
| `Picker#max` | Maximum value. |
| `Picker#type` | Type of placement - `'horizontal'`, `'vertical'`, `'rectangular'`, `'circular'`. |
| `Picker#move(x, y)` | Move picker to relative `x`, `y` coordinates. |
| `Picker#startDrag()` | Start drag mode for the picker. |

[![NPM](https://nodei.co/npm/slidy.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/slidy/)