(function(global){

	//set displacement according to the x & y
	function updatePosition($el){
		css($el, "transform", ["translate3d(", $el.x, "px,", $el.y, "px, 0)"].join(""));
	}

	//native-drag helper
	function setDropEffect(e){
		e.preventDefault()
		e.dataTransfer.dropEffect = "move"
		return false;
	}

	//treshold passing checker
	function tresholdPassed(difX, difY, treshold){
		if (typeof treshold === "number"){
			//straight number
			if (Math.abs(difX) > treshold *.5 || Math.abs(difY) > treshold*.5){
				return true
			}
		} else if (treshold.length === 2){
			//Array(w,h)
			if (Math.abs(difX) > treshold[0]*.5 || Math.abs(difY) > treshold[1]*.5) return true;
		} else if(treshold.length === 4){
			//Array(x1,y1,x2,y2)
			if (!isBetween(difX, treshold[0], treshold[2]) || !isBetween(difX, treshold[1], treshold[3]))
				return true;
		} else if (typeof treshold === "function"){
			//custom treshold funciton
			return treshold(difX, difY);
		}
		return false;
	}

	//dragstate init
	function initDragstate($el, e){
		$el.dragstate = {
			initX: e.clientX,
			initY: e.clientY,
			offsetX: e.offsetX,
			offsetY: e.offsetY
		}
	}


	//TODO: make ghost insteadof moving self

	//detect whether to use native drag
	//NOTE: native drag is faster though you can’t change drag cursor
	//NOTE: native-drag cursor is glitching if drag started on the edge
	var isNativeSupported = (function(){
		var div = document.createElement("div")
		var isNativeSupported = ('draggable' in div) || ('ondragstart' in div && 'ondrop' in div);
		return isNativeSupported
	})();

	var Draggable = Component.register('Draggable', {
		//default options - classical jquery-like notation
		options: {
			//how many pixels to omit before switching to drag state
			treshold: {
				//Number/Array[w,h]/Array[x,y,x,y]/function (custom shape)
				default: 12
			},

			autoscroll: false,

			//null is no restrictions
			within: {
				default: document.documentElement,
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
						value = [value[0], value[1], value[0], value[1]];
					} else if (value.length === 4){
					} else {
						throw new Error("Unknown pin area format")
					}

					return value;
				},
				change: function(){
					this.updateLimits();
				}
			},

			group: null,

			ghost: false,

			translate: true,

			//to what extent round position
			precision: 1,

			sniper: {
				default: true,
				global: true
			},
			//how much slower sniper drag is
			sniperSpeed: {
				default: .15,
				global: true
			},

			native: {
				default: isNativeSupported,
				global: true,
				change: function(value){
					if (value === false && this.state === "native"){
						this.state = "ready";
					} else if (this.state !== "init") {
						this.state = "native";
					}
				}
			},

			//jquery-exactly axis fn: false, x, y
			axis: false,

			//
			repeat: {
				default: null,
				set: function(repeat){
					if (repeat === "both" || repeat === "x" || repeat === "y"){
						//straight value passed
						return repeat;
					} else if (repeat instanceof Array){
						//vector passed
						if (repeat.length){
							if (repeat[0] && repeat[1])
								return "both";
							else if (repeat[0])
								return "x";
							else if (repeat[1])
								return "y";
						}
					} else if (repeat === true){
						//just repeat any possible way
						return this.axis ? this.axis : "both"
					} else {
						//unrecognized value passed
						return false;
					}
				}
			},

			//initial position
			x: {
				default: 0,
				set: function(value){
					if (this.repeat === 'both' || this.repeat === 'x'){
						//mind repeat
						if (value < this.limits.left){
							value += this.limits.right - this.limits.left;
						} else if (value > this.limits.right){
							value -= this.limits.right - this.limits.left;
						}
					} else if (!this.axis || this.axis === "x"){
						//mind axis
						value = between(value,
							this.limits.left,
							this.limits.right);
					} else {
						//ignore change
						return this._x;
					}

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
					if (this.repeat === 'both' || this.repeat === 'y'){
						//mind repeat
						if (value < this.limits.top){
							value += this.limits.bottom - this.limits.top;
						} else if (value > this.limits.bottom){
							value -= this.limits.bottom - this.limits.top;
						}
					} else if (!this.axis || this.axis === "y"){
						//mind axis
						value = between(value,
							this.limits.top,
							this.limits.bottom);
					} else {
						//ignore change
						return this._y
					}

					//console.log("set", value)
					value = round(value, this.precision)
					//console.log("→", value)
					return value;
				},
				change: function(){
					updatePosition(this)
				}
			}
		},

		//-------------------API (verbs)
		//starts drag from event passed
		startDrag: function(e){
			//define limits
			this.updateLimits();

			//if event is outside the self area
			//move self to that area
			//make offsets half of width
			var offsetX, offsetY,
				//event absolute coords
				eAbsoluteX = e.clientX + window.scrollX,
				eAbsoluteY = e.clientY + window.scrollY;

			//if drag started outside self area - move self to that place
			if (
				!isBetween(eAbsoluteX, this.offsets.left, this.offsets.right) ||
				!isBetween(eAbsoluteY, this.offsets.top, this.offsets.bottom)
			) {
				//pretend as if offsets within self are ideal
				offsetX = this.offsets.width * .5;
				offsetY = this.offsets.height * .5;
				//move to that new place
				if (!this.axis || this.axis === "x") this.x = eAbsoluteX - this.oX - offsetX;
				if (!this.axis || this.axis === "y") this.y = eAbsoluteY - this.oY - offsetY;
				//pretend as if drag has happened
				initDragstate(this, {
					offsetX: offsetX,
					offsetY: offsetY,
					clientX: e.clientX,
					clientY: e.clientY
				})
				this.fire('dragstart', null, true)
				this.fire('drag', null, true)
			} else {
				offsetX = e.offsetX;
				offsetY = e.offsetY;
			}

			//init dragstate
			var d = this.dragstate;

			//previous mouse vp coords
			d.clientX = e.clientX;
			d.clientY = e.clientY;

			//offset within self
			d.offsetX = offsetX;
			d.offsetY = offsetY;

			//relative coords (from initial(zero) position)
			d.x = eAbsoluteX - this.oX;
			d.y = eAbsoluteY - this.oY;

			//sniper run distances
			d.sniperRunX = 0;
			d.sniperRunY = 0;

			if (this.state !== "native") {
				this.state = "drag";
			}
		},

		drag: function(e) {
			//console.log("drag", e)

			var d = this.dragstate;

			var difX = e.clientX - d.clientX;
			var difY = e.clientY - d.clientY;

			d.clientX = e.clientX;
			d.clientY = e.clientY;

			//capture dragstate
			d.isCtrl = e.ctrlKey;
			if (e.ctrlKey && this.sniper) {
				if (isBetween(this.x, this.limits.left, this.limits.right))
					d.sniperRunX += difX * (1 - this.sniperSpeed)
				if (isBetween(this.y, this.limits.top, this.limits.bottom))
					d.sniperRunY += difY * (1 - this.sniperSpeed)
			}
			d.x = e.clientX + window.scrollX - this.oX;
			d.y = e.clientY + window.scrollY - this.oY;

			//move according to dragstate
			this.x = d.x - d.offsetX - d.sniperRunX;
			this.y = d.y - d.offsetY - d.sniperRunY;

			//if within limits - move buy difX
			// this.x += difX;
			// this.y += difY;
		},

		stopDrag: function(e){
			//console.log("stopDrag")
			delete this.dragstate;
		},


		//updates movement restrictions
		updateLimits: function(){
			//it is here because not always element is in DOM when constructor inits
			var limOffsets = offsets(this.within);

			this.offsets = offsets(this);
			var selfPads = paddings(this.within);

			//save relative coord system offsets
			this.oX = this.offsets.left - this.x;
			this.oY = this.offsets.top - this.y;

			var pin = this.pin;

			//pinArea-including version
			this.limits.top = limOffsets.top - this.oY + selfPads.top - pin[1];

			this.limits.bottom = limOffsets.bottom - this.oY - this.offsets.height - selfPads.bottom + (this.offsets.height - pin[3]);

			this.limits.left = limOffsets.left - this.oX + selfPads.left - pin[0];

			this.limits.right = limOffsets.right - this.oX - this.offsets.width - selfPads.right + (this.offsets.width - pin[2]);

		},

		//states: grouped events
		states: {
			init: {
				before: function(){
					//console.log("draggable before init")
					//init empty limits
					this.limits = {};

					disableSelection(this)
				},
				after: function(){
					//console.log("draggable after init")
				}
			},

			//non-native drag
			ready: {
				before: function(){
					//console.log("draggable before ready")
					this.updateLimits();

					//go native
					if (this.native) return "native";
				},
				// after: function(){
				// 	console.log("ready after")
				// },

				mousedown: function(e){
					initDragstate(this, e)
					this.state = "treshold";
				}

			},

			//when element clicked but drag treshold hasn’t passed yet
			treshold: {
				// before: function(){
				// 	console.log("ts before")
				// },
				// after: function(){
				// 	console.log("ts after")
				// },
				'document mousemove': function(e){
					//console.log("move in", this.treshold)
					var difX = (e.clientX - this.dragstate.initX);
					var difY = (e.clientY - this.dragstate.initY);

					//if treshold passed - go drag
					if (tresholdPassed(difX, difY, this.treshold)) {
						this.fire('dragstart', null, true)
						this.startDrag(e);
					}
				},
				'document mouseup, document mouseleave': function(){
					this.state = "ready";
				},
				'document selectstart': preventDefault
			},

			drag: {
				before: function(){
					//handle CSSs
					disableSelection(this.within)
				},
				after: function(){
					enableSelection(this.within)
				},
				'document selectstart': preventDefault,
				'document mousemove': function(e){
					this.drag(e)
					this.fire('drag', null, true)
				},
				'document mouseup, document mouseleave': function(e){
					this.stopDrag(e);
					this.fire('dragend', null, true);
					this.state = "ready"
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
					//console.log("draggable before native")
					//hang proper styles
					css(this, {
						"user-drag": "element",
						"cursor": "pointer!important"
					})

					//make restricting area allowable to drop
					on(this.within, 'dragover', setDropEffect)
				},
				after: function(){
					//console.log("after native")
					css(this, "user-drag", "none");
					off(this.within, 'dragover', setDropEffect)
				},

				dragstart:  function(e){
					//console.log(e)
					initDragstate(this, e);
					this.startDrag(e);
					e.dataTransfer.effectAllowed = 'all';

					//hook drag image stub (native image is invisible)
					this.$dragImageStub = document.createElement('div');
					this.parentNode.insertBefore(this.$dragImageStub, this);
					e.dataTransfer.setDragImage(this.$dragImageStub, 0, 0);
				},
				dragend:  function(e){
					this.stopDrag(e);

					//remove drag image stub
					this.$dragImageStub.parentNode.removeChild(this.$dragImageStub);
					delete this.$dragImageStub;
				},
				drag:  function(e){
					//ignore final native drag event
					if (e.x === 0 && e.y === 0) return;

					//ignore zero-movement
					if (this.dragstate.clientX === e.clientX && this.dragstate.clientY === e.clientY) return e.stopImmediatePropagation();

					this.drag(e);
					//this.ondrag && this.ondrag.call(this);
				},
				dragover: 'setDropEffect'
			}
		}
	});



	//exports
	global['Draggable'] = Draggable;

})(window)