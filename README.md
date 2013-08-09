# jquery.slide-area

Generalization of dragging areas, like in color-picker plots etc. Moved out to the separate plugin to make it possible to use in different places.

##Notes
* 2-dim possibility
* reverse directions
* vertical sigle-direction
* similar to slidr.js, or enhancedInput.js, which is fully enriched input with any of known possibilities, like sliding etc.
* Circular, triangle sliders

* Multiple pickers, as range


* How to make Youtube video slider
* page mouse coords are the very I need: it’s offset relative to the document

* Mousemove is much better than drag. Drags are very sluggish, very taily.

* Ideal API should be close to native number element. Test it.

* Callbacks ins tyle of jquery UI: cb(event, data);

##Use
Make element `<div class="slide-area" data-min="100" data-max="500"></div>` and use exactly as input type="range".

* Bind to `change` event or callback: change(event, value1[, value2]){ … }
