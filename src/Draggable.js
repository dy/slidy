(function(global){
	function drag($el, e) {
		//console.log("drag", e)

		var d = $el.dragstate;

		//var difX = e.clientX - d.clientX;
		//var difY = e.clientY - d.clientY;

		//capture dragstate
		d.isCtrl = e.ctrlKey;
		if (e.ctrlKey && $el.sniper) {
			//d.difX *= $el.options.sniperSpeed;
			//d.difY *= $el.options.sniperSpeed;
		}
		d.clientX = e.clientX;
		d.clientY = e.clientY;
		d.x = e.clientX + window.scrollX - $el.oX;
		d.y = e.clientY + window.scrollY - $el.oY;

		//move according to dragstate
		moveToDragstate($el, d);
	}

	function stopDrag($el, e){
		//console.log("stopDrag")
		delete $el.dragstate;
	}

	//specific movement function based on dragstate passed
	//takes into accont mouse coords, self coords, axis limits and displacement within
	//TODO: name this more intuitively, because move supposes (x, y)
	function moveToDragstate($el, d){
		if (!$el.axis || $el.axis === "x"){
			$el.x = between(d.x - d.offsetX,
						$el.limits.left,
						$el.limits.right);
		}

		if (!$el.axis || $el.axis === "y" ){
			$el.y = between(d.y - d.offsetY,
						$el.limits.top,
						$el.limits.bottom);
		}

		updatePosition($el);

		//TODO: calc pin area movement?
	}

	//updates movement restrictions
	function updateLimits($el){
		//it is here because not always element is in DOM when constructor inits
		var limOffsets = offsets($el.within);

		$el.offsets = offsets($el);
		var selfPads = paddings($el.within);

		//save relative coord system offsets
		$el.oX = $el.offsets.left - $el.x;
		$el.oY = $el.offsets.top - $el.y;

		//element movement relative borders
		//no-pinArea version
		//TODO: make limits accesible before appending to the DOM
		// $el.limits.top = limOffsets.top - $el.oY + selfPads.top;

		// $el.limits.bottom = limOffsets.bottom - $el.oY - $el.offsets.height - selfPads.bottom;

		// $el.limits.left = limOffsets.left - $el.oX + selfPads.left;

		// $el.limits.right = limOffsets.right - $el.oX - $el.offsets.width - selfPads.right;

		var pin = $el.pin;

		//pinArea-including version
		$el.limits.top = limOffsets.top - $el.oY + selfPads.top - pin[1];

		$el.limits.bottom = limOffsets.bottom - $el.oY - $el.offsets.height - selfPads.bottom + ($el.offsets.height - pin[3]);

		$el.limits.left = limOffsets.left - $el.oX + selfPads.left - pin[0];

		$el.limits.right = limOffsets.right - $el.oX - $el.offsets.width - selfPads.right + ($el.offsets.width - pin[2]);

	}

	//set displacement according to the x & y
	function updatePosition($el){
		$el.style[cssPrefix + "transform"] = ["translate3d(", $el.x, "px,", $el.y, "px, 0)"].join("");
	}

	//native-drag helper
	function setDropEffect(e){
		e.preventDefault()
		e.dataTransfer.dropEffect = "move"
		return false;
	}





	global['Draggable'] = Component.register('Draggable', {
		//default options - classical jquery-like notation
		options: {
			treshold: 10,

			autoscroll: false,

			//null is no restrictions
			within: {
				default: document.body.parentNode,
				set: function(within){
					if (within instanceof Element){
						return within
					} else if (typeof within === "string"){
						if (within === "parent")
							return this.parentNode;
						else if (within === "..")
							return this.parentNode;
						else if (within === "...")
							return this.parentNode.parentNode;
						else if (within === "root")
							return document.body.parentNode;
						else
							return $(within)[0];
					} else {
						return null
					}
				}
			},

			//what area of draggable should not be outside the restriction area
			//by default it’s whole draggable rect
			pin: {
				default: null,
				get: function(value){
					if (!value) return [0,0,this.offsetWidth, this.offsetHeight];
					else return value;
				},
				set: function(value){
					if (value.length === 2){
						return [value[0], value[1], value[0], value[1]];
					} else if (value.length === 4){
						return value
					} else {
						throw new Error("Unknown pin area format")
					}
				}
			},

			group: null,

			ghost: false,

			translate: true,

			//to what extent round position
			precision: 1,

			sniper: false,

			//jquery-exactly axis fn: false, x, y
			axis: false,

			//detect whether to use native drag
			//NOTE: you can’t change drag cursor, though native drag is faster
			//NOTE: bedides, cursor is glitching if drag started on the edge
			//TODO: make ghost insteadof moving self
			native: (function(){
				var div = document.createElement("div")
				var isNativeSupported = ('draggable' in div) || ('ondragstart' in div && 'ondrop' in div);
				return isNativeSupported
			})(),

			//initial position
			x: {
				default: 0,
				set: function(value){
					value = round(value, this.precision)
					return value;
				},
				change: function(){
					updatePosition(this)
				}
			},
			y: {
				default: 0,
				set: function(value){
					value = round(value, this.precision)
					return value;
				},
				change: function(){
					updatePosition(this)
				}
			}
		},

		//-------------------Lifecycle
		create: function(){
			//console.log("draggable create")

			//handle CSSs
			this.style[cssPrefix + "user-select"] = "none";
			this.style[cssPrefix + "user-drag"] = "none";

			//init empty limits
			this.limits = {};

			//go native
			if (this.native) {
				this.state = "native";
			}

			return this;
		},

		insert: function(){
			//TODO: catch this
			console.log("draggable insert")
			updateLimits(this);
		},

		remove: function(){

		},


		//-------------------API (verbs)
		//starts drag from event passed
		startDrag: function(e){
			//define limits
			updateLimits(this);

			//if event is outside the self area
			//move self to that area
			//make offsets half of width
			var offsetX, offsetY,
				//event absolute coords
				eAbsoluteX = e.clientX + window.scrollX,
				eAbsoluteY = e.clientY + window.scrollY;

			//if drag started outside self area - move self to that place
			if (
				eAbsoluteX > this.offsets.right ||
				eAbsoluteX < this.offsets.left ||
				eAbsoluteY < this.offsets.top ||
				eAbsoluteY > this.offsets.bottom
			) {
				//pretend as if offsets within self are ideal
				offsetX = this.offsets.width * .5;
				offsetY = this.offsets.height * .5;
				//move to that new place
				if (!this.axis || this.axis === "x") this.x = eAbsoluteX - this.oX - offsetX;
				if (!this.axis || this.axis === "y") this.y = eAbsoluteY - this.oY - offsetY;
				//pretend as if drag has happened
				this.fire('drag')
			} else {
				offsetX = e.offsetX;
				offsetY = e.offsetY;
			}

			//init dragstate
			this.dragstate = {
				//previous mouse vp coords
				clientX: e.clientX,
				clientY: e.clientY,

				//offset within self
				offsetX: offsetX,
				offsetY: offsetY,

				//relative coords
				x: eAbsoluteX - this.oX,
				y: eAbsoluteY - this.oY
			};

			if (this.state !== "native") this.state = "drag";
		},

		//states: grouped events
		states: {
			disabled: {
				//TODO
			},

			//non-native drag
			default: {
				before: null,
				after: null,

				//TODO: created, inserted, removed, attributeChanged

				mousedown: function(e){
					this.startDrag(this, e);
					this.fire('dragstart')
				}
			},

			drag: {
				before: function(){
					this.within.style.cursor = "none"
				},
				after: function(){
					this.within.style.cursor = ""
				},
				'document selectstart': preventDefault,
				'document mousemove': function(e){
					drag(this,e)
					this.fire('drag')
				},
				'document mouseup, document mouseleave': function(e){
					stopDrag(this, e);
					this.fire('dragend');
					this.state = "default"
				}
			},
			scroll: {

			},
			tech: {

			},
			out: {

			},

			//native drag
			native: {
				before: function(){
					//hang proper styles
					this.style[cssPrefix + "user-drag"] = "element";
					this.style.cursor = "pointer!important";

					//make restricting area allowable to drop
					on(this.within, 'dragover', setDropEffect)
				},
				after: function(){
					this.style[cssPrefix + "user-drag"] = "none";
					off(this.within, 'dragover', setDropEffect)
				},

				dragstart:  function(e){
					this.startDrag(e);
					e.dataTransfer.effectAllowed = 'all';

					//hook drag image stub (native image is invisible)
					this.$dragImageStub = document.createElement('div');
					this.parentNode.insertBefore(this.$dragImageStub, this);
					e.dataTransfer.setDragImage(this.$dragImageStub, 0, 0);
				},
				dragend:  function(e){
					stopDrag(this, e);

					//remove drag image stub
					this.$dragImageStub.parentNode.removeChild(this.$dragImageStub);
					delete this.$dragImageStub;
				},
				drag:  function(e){
					//ignore final native drag event
					if (e.x === 0 && e.y === 0) return;

					//ignore zero-movement
					if (this.dragstate.clientX === e.clientX && this.dragstate.clientY === e.clientY) return e.stopImmediatePropagation();

					drag(this, e);
					//this.ondrag && this.ondrag.call(this);
				},
				dragover: 'setDropEffect'
			}
		}
	});

})(window)