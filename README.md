# jquery.slide-area

Generalization of dragging areas, like in color-picker plots etc. Moved out to the separate plugin to make it possible to use in different places. But primarily intended to use within color picker.

##Notes
* One picker for array of values
	* Bad idea: how to define different value limits, different behaviour along the axis

* similar to slidr.js, or enhancedInput.js, which is fully enriched input with any of known possibilities, like sliding etc.
* Circular, triangle sliders

* How to make Youtube video slider
* page mouse coords are the very I need: it’s offset relative to the document

* Mousemove is much better than drag. Drags are very sluggish, very taily.

* Ideal API should be close to native number element. Test it.

* Callbacks ins tyle of jquery UI: cb(event, data);

* It’s bad idea to pass option properties right to the instance. This will mess runtime object scope (tech objects) with options (mode, settings)

* It’s bad to init element inside controller. You cannot pass any element you want in this case, like one element for N controllers, as happened with pickers.

* Try not to pass sercret function context to any functions, pass all needed variables right to the args.
	* Actually, it’s better to pass event: object, containing value along with surrounding things (env).


	

##Use
Make element `<div class="slide-area" data-min="100" data-max="500"></div>` and use exactly as input type="range".

* Bind to `change` event or callback: change(value){ … }

* Pass options as data-attribs

* Pass custom pickers
