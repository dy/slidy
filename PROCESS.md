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
	+ in accordance with sticky

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

* Do not create abstract component class because it can slow down optimization. Better create a set of functions in utils.