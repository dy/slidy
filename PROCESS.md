## Product vision

## Names
* slidr
* dragracer
* dragon
* dragit
* slide-area
* dragr, draggr
* dragg
* dragsy
* draggie
* draggle
* slidy
	+ cute
	+ real word
	+ behaviour
	+ in accordance with sticky
* slidie, stickie
	+ nouns
	+ common style

## Notes
* One picker for array of values
	* Bad idea: how to define different value limits, different behaviour along the axis
	* Actually, it’s a good one. Use arrrays to calculate vector values.

* Circular, triangle sliders

* How to make Youtube video slider
* page mouse coords are the very I need: it’s offset relative to the document

* Mousemove is much better than drag. Drags are very sluggish, very taily.

* Ideal API should be close to native number element. Test it.
	* Also take best from the jquery.ui.slider, dragdealer

* Callbacks in style of jquery UI: cb(event, data);

* It’s bad idea to pass option properties right to the instance. This will mess runtime object scope (tech objects) with options (mode, settings)

* It’s bad to init element inside controller. You cannot pass any element you want in this case, like one element for N controllers, as happened with pickers.

* Try not to pass sercret function context to any functions, pass all needed variables right to the args.
	* Actually, it’s better to pass event: object, containing value along with surrounding things (env).

* Do not isolate redefinable static functions. Use them as if they’re of instance. Do not pass any overhead arguments. You cannot detect beforehead which ones you’d need.

* Arrays are better than objects

* No need to keep directions, transformations, limits (like jquery slider does). Just return 0..1 value, user should decide how to transform values himself.

* Value is returned by area itself. Pickers are just thumbs.
	* Nope. Area returns simplistic low-level coords, not normalized values or whatever. Pickers should define normal values itself by calculating paddings, custom transformation function, whatelse.
	* Area implements low-level dragging interactions.
	*

* Abstract `Component` class vs util functions
	* -C It can slow down optimization. Better create a set of functions in utils.
	* +C Util fns as methods may create extra-code, like: `addEventListener(){addEvtListener}`, besides it’ll ease some initialisations
	* +C It can be reused a lot of times in other projects
	* ? Then how to implement component gracefully?
		* ?ES6 class
			* Native way to implement extending
		* ?sweet.js macro
		* ?Plain class to extend
	* +C it can include definition of jquery/platform stuff and utilize that
	* Things to move to component
		* options ()
		* init element (classes)
		* enable/disable component (classes, events)
		* behaviour (states): state machine
		* events (trigger, add/remove, options callbacks, DOM-document, DOM-element)
		*

* Seems that there’s nothing in component I can’t implement on a simple DOM-element.
	* Options move to element attributes
		+ live-reflection
	* Events are covered by native methods
	* $el, factually, have to be bound to real HTML class
	* Init on existing element is like `var x = new Component($el)`

* ? How to make it↑ native-like: `var el = new Component(); $el.append(el);`
	*

* ?✔ `var A = function(){}` and `function A(){}` is the same?
	* It’s the same (fn gets name), but you still can’t spawn new classes (name your functions), due to you have to define method, not fn. Every fn created will be anonymous. You have to do like perl-way metashit: `var $$A = function()`

* ?✔ How to return non-`this` from constructor?
	* Will be returned any non-primitive value insteadof `this`.
	* But unfortunately, you can’t name that dynamically created returning class, unless you've hardcoded it’s name.

* I can extend `__proto__` with my own properties, but that will extend all HTML[DOM]Elements instances, which is suitable for Polymer, but not for me.
* I want my component to be of special-behaviour, but it can be of any native type.
	* ?✔ Should I insert component into the prototype chain?
	Instance ⇒ HTMLElement → Instance ⇒ Component ⇒ HTMLElement
		* This’d let customize target tag, not to intrude into native behaviour
		* ? It works, but there a `this` object remains, which is replaced with native element created, what to do with that?
	* Situation will change when ES6 `class N extends HTMLElement` wil be supported

	* Main trouble of having component options as first-level citizens is that they can interfere with native options. The same trouble with inner methods: you should keep their naming different from the native methods and functions.
		* ? How do web-components deal with that, as well as with private directives?
		* Also, how not to intrude to native lifecycle with custom events?
			* use data-prefix and keep options in data-prefixed attributes?

* Use behaviours instead of components: element is draggable, not the area - it is not. It just limits area where to drag, which is by fact draggable option.

* Slidy behaviour (or component) should automatically create pickers inside it, based on attrs

* Draggable should be easy to switch to native drag.