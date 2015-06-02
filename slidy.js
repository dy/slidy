(function(B){"object"===typeof exports&&"undefined"!==typeof module?module.exports=B():"function"===typeof define&&define.amd?define([],B):("undefined"!==typeof window?window:"undefined"!==typeof global?global:"undefined"!==typeof self?self:this).Slidy=B()})(function(){return function a(b,d,c){function g(h,l){if(!d[h]){if(!b[h]){var m="function"==typeof require&&require;if(!l&&m)return m(h,!0);if(e)return e(h,!0);m=Error("Cannot find module '"+h+"'");throw m.code="MODULE_NOT_FOUND",m;}m=d[h]={exports:{}};
b[h][0].call(m.exports,function(a){var c=b[h][1][a];return g(c?c:a)},m,m.exports,a,b,d,c)}return d[h].exports}for(var e="function"==typeof require&&require,h=0;h<c.length;h++)g(c[h]);return g}({1:[function(a,b,d){function c(){this._events=this._events||{};this._maxListeners=this._maxListeners||void 0}function g(a){return"function"===typeof a}function e(a){return"object"===typeof a&&null!==a}b.exports=c;c.EventEmitter=c;c.prototype._events=void 0;c.prototype._maxListeners=void 0;c.defaultMaxListeners=
10;c.prototype.setMaxListeners=function(a){if("number"!==typeof a||0>a||isNaN(a))throw TypeError("n must be a positive number");this._maxListeners=a;return this};c.prototype.emit=function(a){var f,c,b,k;this._events||(this._events={});if("error"===a&&(!this._events.error||e(this._events.error)&&!this._events.error.length)){f=arguments[1];if(f instanceof Error)throw f;throw TypeError('Uncaught, unspecified "error" event.');}c=this._events[a];if(void 0===c)return!1;if(g(c))switch(arguments.length){case 1:c.call(this);
break;case 2:c.call(this,arguments[1]);break;case 3:c.call(this,arguments[1],arguments[2]);break;default:f=arguments.length;b=Array(f-1);for(k=1;k<f;k++)b[k-1]=arguments[k];c.apply(this,b)}else if(e(c)){f=arguments.length;b=Array(f-1);for(k=1;k<f;k++)b[k-1]=arguments[k];c=c.slice();f=c.length;for(k=0;k<f;k++)c[k].apply(this,b)}return!0};c.prototype.addListener=function(a,f){var l;if(!g(f))throw TypeError("listener must be a function");this._events||(this._events={});this._events.newListener&&this.emit("newListener",
a,g(f.listener)?f.listener:f);this._events[a]?e(this._events[a])?this._events[a].push(f):this._events[a]=[this._events[a],f]:this._events[a]=f;e(this._events[a])&&!this._events[a].warned&&(l=void 0!==this._maxListeners?this._maxListeners:c.defaultMaxListeners)&&0<l&&this._events[a].length>l&&(this._events[a].warned=!0,console.error("(node) warning: possible EventEmitter memory leak detected. %d listeners added. Use emitter.setMaxListeners() to increase limit.",this._events[a].length),"function"===
typeof console.trace&&console.trace());return this};c.prototype.on=c.prototype.addListener;c.prototype.once=function(a,c){function e(){this.removeListener(a,e);b||(b=!0,c.apply(this,arguments))}if(!g(c))throw TypeError("listener must be a function");var b=!1;e.listener=c;this.on(a,e);return this};c.prototype.removeListener=function(a,c){var b,d,k;if(!g(c))throw TypeError("listener must be a function");if(!this._events||!this._events[a])return this;b=this._events[a];k=b.length;d=-1;if(b===c||g(b.listener)&&
b.listener===c)delete this._events[a],this._events.removeListener&&this.emit("removeListener",a,c);else if(e(b)){for(;0<k--;)if(b[k]===c||b[k].listener&&b[k].listener===c){d=k;break}if(0>d)return this;1===b.length?(b.length=0,delete this._events[a]):b.splice(d,1);this._events.removeListener&&this.emit("removeListener",a,c)}return this};c.prototype.removeAllListeners=function(a){var c;if(!this._events)return this;if(!this._events.removeListener)return 0===arguments.length?this._events={}:this._events[a]&&
delete this._events[a],this;if(0===arguments.length){for(c in this._events)"removeListener"!==c&&this.removeAllListeners(c);this.removeAllListeners("removeListener");this._events={};return this}c=this._events[a];if(g(c))this.removeListener(a,c);else for(;c.length;)this.removeListener(a,c[c.length-1]);delete this._events[a];return this};c.prototype.listeners=function(a){return this._events&&this._events[a]?g(this._events[a])?[this._events[a]]:this._events[a].slice():[]};c.listenerCount=function(a,
c){return a._events&&a._events[c]?g(a._events[c])?1:a._events[c].length:0}},{}],2:[function(a,b,d){function c(a,f){if(!(this instanceof c))return new c(a,f);var b=this;f||(a instanceof Element?f={}:(f=a,a=x.createElement("div")));b.element=a;e(b,f);void 0===f.step&&(b.step=g.detectStep(b.min,b.max));void 0===f.value&&(b.value=g.detectValue(b.min,b.max));f.created&&l(b,"created",f.created);w.set(b.element,b);b.id=r();b.ns="slidy-"+b.id;b.element.id||(b.element.id=b.ns);b.element.classList.add("slidy");
b.pickers=[];h(f.pickers)&&f.pickers.length?f.pickers.forEach(function(a){a=b.createPicker(a);b.pickers.push(a)}):b.pickers.push(b.createPicker(f.picker));Object.defineProperty(b,"value",{set:function(a){this.getActivePicker().value=a},get:function(){return this.getActivePicker().value}});b.aria&&(b.element.setAttribute("role","slider"),a.setAttribute("aria-valuemax",b.max),a.setAttribute("aria-valuemin",b.min),a.setAttribute("aria-orientation",b.orientation),a.setAttribute("aria-atomic",!0),a.setAttribute("aria-controls",
b.pickers.map(function(a){return a.element.id}).join(" ")));b.element.hasAttribute("disabled")||b.enable();b.emit("created")}var g=a("./lib/picker"),e=a("xtend/mutable"),h=a("is-array"),f=a("lifecycle-events");d=a("events");var l=a("emmy/on"),m=a("emmy/off"),k=a("emmy/throttle"),n=a("get-client-xy").x,p=a("get-client-xy").y,r=a("get-uid"),u=window,x=document;b.exports=c;var w=c.cache=new WeakMap;a=c.prototype=Object.create(d.prototype);a.min=0;a.max=100;a.value=50;a.orientation="horizontal";a.repeat=
!1;a.keyboard=!0;a.aria=!0;a.wheel=!0;a.click=!0;a.point=!1;a.align=.5;a.enable=function(){var a=this;if(a.isEnabled)return a;a.isEnabled=!0;a.aria&&a.element.removeAttribute("aria-disabled");a.element.removeAttribute("disabled");k(u,"resize."+a.ns,20,function(){a.update()});l(a.element,"attached."+a.ns,function(c){a.update()});f.enable(a.element);a.click&&l(a.element,"touchstart."+a.ns+" mousedown."+a.ns,function(c){c.preventDefault();a.element.focus();var b=a.element.getBoundingClientRect(),f=[],
e,t,g;if(c.touches)for(var h=0,k=c.touches.length;h<k;h++)t=n(c,h)-b.left,g=p(c,h)-b.top,e=a.getClosestPicker(a.pickers.filter(function(a){return 0>f.indexOf(a)}),t,g),f.push(e),e.move(t,g).startDrag(c);else t=n(c)-b.left,g=p(c)-b.top,e=a.getClosestPicker(a.pickers,t,g),f.push(e),e.move(t,g).startDrag(c),e.focus();a.pickers.forEach(function(a){0>f.indexOf(a)&&(a.draggable.state="idle")})});a.wheel&&l(a.element,"wheel."+a.ns+" mousewheel"+a.ns,function(c){var b=x.activeElement,f=a.element.getBoundingClientRect();
if(b===a.element){var b=n(c)-f.left,e=p(c)-f.top,b=a.getClosestPicker(a.pickers,b,e);b.focus()}else if(b.parentNode===a.element)b=a.getActivePicker();else return;c.preventDefault();var t=e=0;0!==c.deltaX&&(e=2*c.deltaX/f.width,e=0<e?Math.ceil(e):Math.floor(e),e=-e);0!==c.deltaY&&(t=2*c.deltaY/f.height,t=0<t?Math.ceil(t):Math.floor(t));b.inc(e,t)});a.keyboard&&(a.element.setAttribute("tabindex",-1),l(a.element,"keydown",function(c){27===c.which&&a.element.blur()}));a.pickers.forEach(function(a){a.enable()});
return a};a.disable=function(){this.isEnabled=!1;this.aria&&this.element.setAttribute("aria-disabled",!0);this.element.setAttribute("disabled",!0);m(u,"resize."+this.ns);m(this.element,"attached."+this.ns);m(this.element,"mousedown."+this.ns);m(this.element,"touchstart."+this.ns);this.pickers.forEach(function(a){a.disable()});return this};a.update=function(){this.pickers.forEach(function(a){a.update()})};a.createPicker=function(a){var c=this;a instanceof Element&&(a={element:a});a=e({within:c.element,
orientation:c.orientation,min:c.min,max:c.max,repeat:c.repeat,step:c.step,snap:c.snap,pickerClass:c.pickerClass,align:c.align,release:c.release,aria:c.aria,keyboard:c.keyboard,wheel:c.wheel,point:c.point,value:c.value,change:c.change},a);var b=a.element||document.createElement("div");c.aria&&b.setAttribute("aria-describedby",c.element.id);c.element.appendChild(b);a=new g(b,a);a.on("change",function(a){c.aria&&(c.element.setAttribute("aria-valuenow",a),c.element.setAttribute("aria-valuetext",a));c.emit("change",
a)});return a};a.getClosestPicker=function(a,c,b){var e=9999,f;a.forEach(function(a){var g=a.draggable.getCoords(),h=c-g[0]-a.draggable.pin[0]-a.draggable.pin.width*a.align,g=b-g[1]-a.draggable.pin[1]-a.draggable.pin.height*a.align,h=Math.sqrt(h*h+g*g);h<e&&(e=h,f=a)});return f};a.getActivePicker=function(){var a=x.activeElement;return this.pickers.filter(function(c){return c.element===a})[0]||this.pickers[0]}},{"./lib/picker":3,"emmy/off":25,"emmy/on":26,"emmy/throttle":27,events:1,"get-client-xy":28,
"get-uid":29,"is-array":30,"lifecycle-events":32,"xtend/mutable":65}],3:[function(a,b,d){function c(a,b){if(!(this instanceof c))return new c(a,b);a.classList.add("slidy-picker");this.element=a;b.pickerClass&&a.classList.add(b.pickerClass);this.id=C();this.ns="slidy-picker-"+this.id;this.element.id||(this.element.id=this.ns);this.draggable=new f(a,{threshold:0,within:b.within,sniperSlowdown:.85,repeat:b.repeat,releaseDuration:80});l(this,"orientation",this.orientation);r(b.change)&&k(this,"change",
b.change);z(this,b);void 0===b.step&&(this.step=c.detectStep(this.min,this.max));void 0===b.value&&(this.value=c.detectStep(this.min,this.max));this.enable();this.orientation=b.orientation}function g(a,c,b){b=b||0;r(c)&&(c=c(a+(0<b?1E-5:-1E-5)));return a+c*b}function e(a,c,b,e,f){a[38]&&(c[1]=g(c[1],b[1],1));a[39]&&(c[0]=g(c[0],b[0],1));a[40]&&(c[1]=g(c[1],b[1],-1));a[37]&&(c[0]=g(c[0],b[0],-1));var h=1;if(a[18]||a[91]||a[17]||a[16])h=0;a[36]&&(c[h]=e[h]);a[35]&&(c[h]=f[h]);a[33]&&(c[h]=g(c[h],b[h],
5));a[34]&&(c[h]=g(c[h],b[h],-5));return c}function h(a,c,b,e,f){b=b||1;if(a[38]||a[39])c=g(c,b,1);if(a[40]||a[37])c=g(c,b,-1);a[36]&&(c=e);a[35]&&(c=f);a[33]&&(c=g(c,b,5));a[34]&&(c=g(c,b,-5));return c}var f=a("draggy"),l=a("define-state"),m=a("emmy/emit"),k=a("emmy/on"),n=a("emmy/off"),p=a("mucss/css");d=a("events");var r=a("is-function"),u=a("mumath/round"),x=a("mumath/between"),w=a("mumath/loop"),C=a("get-uid"),q=a("is-array"),z=a("xtend/mutable"),A=a("mumath/wrap");b.exports=c;var y=document.documentElement;
c.detectStep=function(a,c){var b=A(function(a,c){return Math.abs(a-c)})(c,a);return A(function(a){return 100>a?.01:1})(b)};c.detectValue=function(a,c){return A(function(a,c){return.5*(a+c)})(a,c)};a=c.prototype=Object.create(d.prototype);a.enable=function(){var a=this;if(a.isEnabled)return a;a.isEnabled=!0;a.aria&&a.element.removeAttribute("aria-disabled");a.element.removeAttribute("disabled");k(a.draggable,"dragstart."+a.ns,function(){p(y,"cursor","none");p(this.element,"cursor","none")});k(a.draggable,
"drag."+a.ns,function(){if(!a.release||!a.draggable.isAnimated){var c=a.calcValue.apply(a,a.draggable.getCoords());a.value=c;a.snap&&a.renderValue(a.value)}});k(a.draggable,"dragend."+a.ns,function(){a.release&&(a.draggable.isAnimated=!0);a.renderValue(a.value);p(y,"cursor",null);p(this.element,"cursor",null)});a.keyboard&&(a.element.setAttribute("tabindex",0),a._pressedKeys=[],k(a.element,"keydown."+a.ns,function(c){a._pressedKeys[c.which]=!0;27===c.which&&a.blur();33<=c.which&&40>=c.which&&(c.preventDefault(),
a.value=a.handleKeys(a._pressedKeys,a.value,a.step,a.min,a.max),a.release&&(a.draggable.isAnimated=!0),a.renderValue(a.value))}),k(a.element,"keyup."+a.ns,function(c){a._pressedKeys[c.which]=!1}));return a};a.disable=function(){this.isEnabled=!1;this.aria&&this.element.setAttribute("aria-disabled",!0);this.element.setAttribute("disabled",!0);n(this.element,"dragstart."+this.ns);n(this.element,"drag."+this.ns);n(this.element,"dragend."+this.ns);this.keyboard&&(this.element.setAttribute("tabindex",
-1),n(this.element,"keydown."+this.ns),n(this.element,"keyup."+this.ns));return this};a.min=0;a.max=100;a.step=1;a.snap=!1;a.release=!1;a.point=!1;a.align=.5;Object.defineProperties(a,{value:{set:function(a){if(void 0===a)throw Error("Picker value cannot be undefined.");this.repeat&&(q(a)&&"x"===this.repeat?a[0]=w(a[0],this.min[0],this.max[0]):q(a)&&"y"===this.repeat?a[1]=w(a[1],this.min[1],this.max[1]):a=w(a,this.min,this.max));a=x(a,this.min,this.max);this.step&&(a=r(this.step)?u(a,this.step(a)):
u(a,this.step));this._value=a;this.emit("change",a);m(this.element,"change",a,!0)},get:function(){return this._value}}});a.renderValue=function(a){};a.calcValue=function(a,c){};a.handleKeys=function(a,c,b){};a.update=function(){this.point&&(this.draggable.pin=[this.draggable.offsets.width*this.align,this.draggable.offsets.height*this.align]);this.draggable.update();this.renderValue(this.value);return this};a.move=function(a,c){if(this.point){var b=this.draggable.pin.height*this.align;a=a-this.draggable.pin[0]-
this.draggable.pin.width*this.align;c=c-this.draggable.pin[1]-b}var b=this.draggable.pin.width-this.element.parentNode.clientWidth,e=this.draggable.pin.height-this.element.parentNode.clientHeight;0<b&&(a-=b);0<e&&(c-=e);this.draggable.move(a,c);this.value=this.calcValue(a,c);return this};a.startDrag=function(a){this.draggable.setTouch(a).update(a);"drag"!==this.draggable.state&&(this.draggable.state="drag");this.draggable.innerOffsetX=this.draggable.pin[0]+.5*this.draggable.pin.width;this.draggable.innerOffsetY=
this.draggable.pin[1]+.5*this.draggable.pin.height;this.draggable.drag(a);return this};a.focus=function(){this.element.focus()};a.blur=function(){this.element.blur()};a.orientation={_:"horizontal",horizontal:function(){var a=this;a.draggable.axis="x";a.renderValue=function(c){var b=a.draggable.limits;a.move((c-a.min)/(a.max-a.min)*(b.right-b.left));return a};a.calcValue=function(c){var b=a.draggable.limits;return(c-b.left)/(b.right-b.left)*(a.max-a.min)+a.min};a.handleKeys=h},vertical:function(){var a=
this;a.draggable.axis="y";a.renderValue=function(c){var b=a.draggable.limits;a.move(null,(-c+a.max)/(a.max-a.min)*(b.bottom-b.top));return a};a.calcValue=function(c,b){var e=a.draggable.limits;return(-b+e.bottom)/(e.bottom-e.top)*(a.max-a.min)+a.min};a.handleKeys=h},cartesian:function(){var a=this;a.draggable.axis=null;a.renderValue=function(c){var b=a.draggable.limits;a.move((c[0]-a.min[0])/(a.max[0]-a.min[0])*(b.right-b.left),(-c[1]+a.max[1])/(a.max[1]-a.min[1])*(b.bottom-b.top));return a};a.calcValue=
function(c,b){var e=a.draggable.limits,e=[(c-e.left)/(e.right-e.left),(-b+e.bottom)/(e.bottom-e.top)];return[e[0]*(a.max[0]-a.min[0])+a.min[0],e[1]*(a.max[1]-a.min[1])+a.min[1]]};a.handleKeys=e},circular:function(){var a=this;a.draggable.axis=null;a.draggable.move=function(a,c){var b=this.limits,e=(b.right-b.left)/2-this.pin[0],b=(b.bottom-b.top)/2-this.pin[1],f=Math.atan2(c-b,a-e);this.setCoords(Math.cos(f)*(e+this.pin[0])+e,Math.sin(f)*(b+this.pin[1])+b)};a.renderValue=function(c){var b=a.draggable.limits,
e=.5*(b.right-b.left),b=.5*(b.bottom-b.top);c=2*((c-a.min)/(a.max-a.min)-.5)*Math.PI;a.move(Math.cos(c)*e+e,Math.sin(c)*b+b)};a.calcValue=function(c,b){var e=a.draggable.limits,f=e.bottom-e.top;c=c-.5*(e.right-e.left)+a.draggable.pin[0];b=b-.5*f+a.draggable.pin[1];return(.5*Math.atan2(b,c)/Math.PI+.5)*(a.max-a.min)+a.min};a.handleKeys=h},polar:function(){var a=this;a.draggable.axis=null;a.draggable.move=function(a,c){var b=this.limits,e=b.right-b.left,b=b.bottom-b.top,f=e/2-this.pin[0],h=b/2-this.pin[1],
g=a-f,k=c-h,d=Math.atan2(c-h,a-f),g=Math.sqrt(g*g+k*k);this.setCoords(g>e/2?Math.cos(d)*(f+this.pin[0])+f:a,g>b/2?Math.sin(d)*(h+this.pin[1])+h:c)};a.renderValue=function(c){var b=a.draggable.limits,e=.5*(b.right-b.left),b=.5*(b.bottom-b.top),f=2*((c[0]-a.min[0])/(a.max[0]-a.min[0])-.5)*Math.PI,h=(c[1]-a.min[1])/(a.max[1]-a.min[1]);c=e*h;h*=b;a.move(Math.cos(f)*c+e,Math.sin(f)*h+b)};a.calcValue=function(c,b){var e=a.draggable.limits,f=e.right-e.left,e=e.bottom-e.top;c=c+a.draggable.pin[0]-.5*f;b=
b+a.draggable.pin[1]-.5*e;e=.5*Math.atan2(b,c)/Math.PI+.5;f=Math.sqrt(c*c+b*b)/f*2;return[e*(a.max[0]-a.min[0])+a.min[0],f*(a.max[1]-a.min[1])+a.min[1]]};a.handleKeys=e}};a.inc=function(a,c){q(this.value)?(this.value[0]=g(this.value[0],this.step[0],a),this.value[1]=g(this.value[1],this.step[1],c)):this.value=g(this.value,this.step,c||a);this.renderValue(this.value)}},{"define-state":4,draggy:9,"emmy/emit":20,"emmy/off":25,"emmy/on":26,events:1,"get-uid":29,"is-array":30,"is-function":31,"mucss/css":44,
"mumath/between":54,"mumath/loop":55,"mumath/round":57,"mumath/wrap":58,"xtend/mutable":65}],4:[function(a,b,d){b.exports=function(a,b,h,f){f?a[b]=function(){return arguments.length?d.set(arguments[0]):d.get()}:Object.defineProperty(a,b,{set:function(a){return d.set(a)},get:function(){return d.get()}});var d=new c(h,a);return a};var c=a("st8")},{st8:5}],5:[function(a,b,d){function c(a,b){if(a instanceof c)return a;if(!(this instanceof c))return new c(a);this.states=a||{};this.context=b||this;this.isInit=
!1}function g(a,c,b){return e(a[c])?a[c].call(b):a[c]}d=a("events");var e=a("is-function"),h=a("is-plain-object");c.options={leaveCallback:"after",enterCallback:"before",changeCallback:"change",remainderState:"_"};a=c.prototype=Object.create(d.prototype);a.set=function(a){var b=this.state,e=this.states,k=void 0!==e[b]?b:c.options.remainderState,d=e[k],k=c.options.leaveCallback+k;if(this.isInit){if(h(d)&&!this[k]){this[k]=!0;d=g(d,c.options.leaveCallback,this.context);if(!1===d)return this[k]=!1;if(void 0!==
d&&d!==a)return this.set(d),this[k]=!1;this[k]=!1;if(this.state!==b)return}if(a===b)return!1}else this.isInit=!0;this.state=a;var k=void 0!==e[a]?a:c.options.remainderState,p=e[k],d=c.options.enterCallback+k;if(!this[d]){this[d]=!0;e=h(p)?g(p,c.options.enterCallback,this.context):g(e,k,this.context);if(!1===e)return this.set(b),this[d]=!1;if(void 0!==e&&e!==a)return this.set(e),this[d]=!1;this[d]=!1}a!==b&&this.emit(c.options.changeCallback,a,b);return this.context};a.get=function(){return this.state};
b.exports=c},{events:1,"is-function":6,"is-plain-object":7}],6:[function(a,b,d){b.exports=function(a){var b=c.call(a);return"[object Function]"===b||"function"===typeof a&&"[object RegExp]"!==b||"undefined"!==typeof window&&(a===window.setTimeout||a===window.alert||a===window.confirm||a===window.prompt)};var c=Object.prototype.toString},{}],7:[function(a,b,d){function c(a){return!0===g(a)&&"[object Object]"===Object.prototype.toString.call(a)}var g=a("isobject");b.exports=function(a){if(!1===c(a))return!1;
a=a.constructor;if("function"!==typeof a)return!1;a=a.prototype;return!1===c(a)||!1===a.hasOwnProperty("isPrototypeOf")?!1:!0}},{isobject:8}],8:[function(a,b,d){b.exports=function(a){return null!=a&&"object"===typeof a&&!Array.isArray(a)}},{}],9:[function(a,b,d){function c(a,b){if(!(this instanceof c))return new c(a,b);this._id=G();this._ns=".draggy_"+this._id;this.element=a;H.set(a,this);q(this,"css3",this.css3);this.css3=!0;q(this,"state",this.state);this.state="idle";q(this,"axis",this.axis);this.axis=
null;q(this,"isAnimated",this.isAnimated);z(this,b);this.update()}function g(a){if(!(a[0]||a[1]||a[2]||a[3]))return!0}var e=a("mucss/css"),h=a("mucss/parse-value"),f=a("mucss/selection"),l=a("mucss/offsets"),m=a("mucss/translate"),k=a("emmy/on"),n=a("emmy/off"),p=a("emmy/emit");d=a("events");var r=a("get-client-xy").x,u=a("get-client-xy").y,x=a("is-array"),w=a("mutype/is-number"),C=a("is-function"),q=a("define-state"),z=a("xtend/mutable"),A=a("mumath/round"),y=a("mumath/between"),t=a("mumath/loop"),
G=a("get-uid"),E=window,v=document,F=v.documentElement,H=c.cache=new WeakMap;a=c.prototype=Object.create(d.prototype);a.state={_:{before:function(){var a=this;p(a.element,"idle",null,!0);a.emit("idle");k(a.element,"mousedown"+a._ns+" touchstart"+a._ns,function(c){c.preventDefault();a.setTouch(c);a.update(c);a.state="threshold"})},after:function(){var a=this;n(a.element,"touchstart"+a._ns+" mousedown"+a._ns);a.release&&(a._trackingInterval=setInterval(function(c){var b=Date.now()-a.timestamp;c=a.prevX-
a.frame[0];var e=a.prevY-a.frame[1];a.frame[0]=a.prevX;a.frame[1]=a.prevY;var h=Math.sqrt(c*c+e*e),b=Math.min(a.velocity*h/(1+b),a.maxSpeed);a.speed=.8*b+.2*a.speed;a.angle=Math.atan2(e,c);a.emit("track");return a},a.framerate))}},threshold:{before:function(){var a=this;g(a.threshold)?a.state="drag":(a.emit("threshold"),k(v,"touchmove"+a._ns+" mousemove"+a._ns,function(c){c.preventDefault();var b=r(c,a.touchIdx),e=u(c,a.touchIdx),b=a.prevMouseX-b,e=a.prevMouseY-e;if(b<a.threshold[0]||b>a.threshold[2]||
e<a.threshold[1]||e>a.threshold[3])a.update(c),a.state="drag"}),k(v,"mouseup"+a._ns+" touchend"+a._ns+"",function(c){c.preventDefault();a.resetTouch();a.state="idle"}))},after:function(){n(v,"touchmove"+this._ns+" mousemove"+this._ns+" mouseup"+this._ns+" touchend"+this._ns)}},drag:{before:function(){var a=this;f.disable(F);a.emit("dragstart");p(a.element,"dragstart",null,!0);a.emit("drag");p(a.element,"drag",null,!0);k(v,"touchend"+a._ns+" mouseup"+a._ns+" mouseleave"+a._ns,function(c){c.preventDefault();
a.resetTouch();a.state=1<a.speed?"release":"idle"});k(v,"touchmove"+a._ns+" mousemove"+a._ns,function(c){a.drag(c)})},after:function(){f.enable(F);this.emit("dragend");p(this.element,"dragend",null,!0);n(v,"touchend"+this._ns+" mouseup"+this._ns+" mouseleave"+this._ns);n(v,"touchmove"+this._ns+" mousemove"+this._ns);clearInterval(this._trackingInterval)}},release:{before:function(){this.isAnimated=!0;this.move(this.prevX+this.speed*Math.cos(this.angle),this.prevY+this.speed*Math.sin(this.angle));
this.speed=0;this.emit("track");this.state="idle"}}};a.drag=function(a){a.preventDefault();var c=r(a,this.touchIdx),b=u(a,this.touchIdx),e=c-this.prevMouseX,h=b-this.prevMouseY,f=c+E.pageXOffset,g=b+E.pageYOffset;if(a.ctrlKey||a.metaKey)this.sniperOffsetX+=e*this.sniperSlowdown,this.sniperOffsetY+=h*this.sniperSlowdown;this.move(f-this.initOffsetX-this.innerOffsetX-this.sniperOffsetX,g-this.initOffsetY-this.innerOffsetY-this.sniperOffsetY);this.prevMouseX=c;this.prevMouseY=b;this.emit("drag");p(this.element,
"drag",null,!0)};var D=0;a.setTouch=function(a){if(!a.touches||this.isTouched())return this;this.touchIdx=D;D++;return this};a.resetTouch=function(){D=0;this.touchIdx=null;return this};a.isTouched=function(){return null!==this.touchIdx};a.isAnimated={"true":{before:function(){var a=this;clearTimeout(a._animateTimeout);e(a.element,{transition:a.releaseDuration+"ms ease-out "+(a.css3?"transform":"position")});a._animateTimeout=setTimeout(function(){a.isAnimated=!1},a.releaseDuration)},after:function(){e(this.element,
{transition:null})}}};a.touchIdx=null;a.update=function(a){var c=this.getCoords();this.prevX=c[0];this.prevY=c[1];c=l(this.element);this.initOffsetX=c.left-this.prevX;this.initOffsetY=c.top-this.prevY;this.offsets=c;"parent"===this.within&&(this.within=this.element.parentNode||v);this.withinOffsets=c=l(this.within);this.overflowX=this.pin.width-c.width;this.overflowY=this.pin.height-c.height;this.limits={left:c.left-this.initOffsetX-this.pin[0]-(0>this.overflowX?0:this.overflowX),top:c.top-this.initOffsetY-
this.pin[1]-(0>this.overflowY?0:this.overflowY),right:0<this.overflowX?0:c.right-this.initOffsetX-this.pin[2],bottom:0<this.overflowY?0:c.bottom-this.initOffsetY-this.pin[3]};this.innerOffsetX=this.pin[0];this.innerOffsetY=this.pin[1];c=this.element.getBoundingClientRect();if(a)this.prevMouseX=r(a,this.touchIdx),this.prevMouseY=u(a,this.touchIdx),this.innerOffsetX=-c.left+r(a,this.touchIdx),this.innerOffsetY=-c.top+u(a,this.touchIdx);else{a=.5*(this.pin[0]+this.pin[2]);var b=.5*(this.pin[1]+this.pin[3]);
this.prevMouseX=c.left+a;this.prevMouseY=c.top+b;this.innerOffsetX=a;this.innerOffsetY=b}this.angle=this.amplitude=this.speed=0;this.timestamp=+new Date;this.frame=[this.prevX,this.prevY];this.sniperOffsetY=this.sniperOffsetX=0};a.css3={_:function(){this.getCoords=function(){return[h(e(this.element,"left")),h(e(this.element,"top"))]};this.setCoords=function(a,c){e(this.element,{left:a,top:c});this.prevX=a;this.prevY=c}},"true":function(){this.getCoords=function(){return m(this.element)||[0,0]};this.setCoords=
function(a,c){a=A(a,this.precition);c=A(c,this.precition);e(this.element,"transform",["translate3d(",a,"px,",c,"px, 0)"].join(""));this.prevX=a;this.prevY=c}}};a.within=v;Object.defineProperties(a,{pin:{set:function(a){x(a)?2===a.length?this._pin=[a[0],a[1],a[0],a[1]]:4===a.length&&(this._pin=a):w(a)?this._pin=[a,a,a,a]:this._pin=a;this._pin.width=this._pin[2]-this._pin[0];this._pin.height=this._pin[3]-this._pin[1]},get:function(){if(this._pin)return this._pin;var a=[0,0,this.offsets.width,this.offsets.height];
a.width=this.offsets.width;a.height=this.offsets.height;return a}},threshold:{set:function(a){w(a)?this._threshold=[.5*-a,.5*-a,.5*a,.5*a]:2===a.length?this._threshold=[.5*-a[0],.5*-a[1],.5*a[0],.5*a[1]]:4===a.length?this._threshold=a:C(a)?this._threshold=a():this._threshold=[0,0,0,0]},get:function(){return this._threshold||[0,0,0,0]}}});a.release=!1;a.releaseDuration=500;a.velocity=1E3;a.maxSpeed=250;a.framerate=50;a.precision=1;a.sniper=!0;a.sniperSlowdown=.85;a.axis={_:function(){this.move=function(a,
c){var b=this.limits;if(this.repeat){var e=b.right-b.left,h=b.bottom-b.top,f=-this.initOffsetX+this.withinOffsets.left-this.pin[0]-Math.max(0,this.overflowX),g=-this.initOffsetY+this.withinOffsets.top-this.pin[1]-Math.max(0,this.overflowY);"x"===this.repeat?a=t(a-f,e)+f:("y"!==this.repeat&&(a=t(a-f,e)+f),c=t(c-g,h)+g)}a=y(a,b.left,b.right);c=y(c,b.top,b.bottom);this.setCoords(a,c)}},x:function(){this.move=function(a,c){var b=this.limits;if(this.repeat){var b=b.right-b.left,e=-this.initOffsetX+this.withinOffsets.left-
this.pin[0]-Math.max(0,this.overflowX);a=t(a-e,b)+e}else a=y(a,b.left,b.right);this.setCoords(a,this.prevY)}},y:function(){this.move=function(a,c){var b=this.limits;if(this.repeat){var b=b.bottom-b.top,e=-this.initOffsetY+this.withinOffsets.top-this.pin[1]-Math.max(0,this.overflowY);c=t(c-e,b)+e}else c=y(c,b.top,b.bottom);this.setCoords(this.prevX,c)}}};a.repeat=!1;b.exports=c},{"define-state":4,"emmy/emit":10,"emmy/off":18,"emmy/on":19,events:1,"get-client-xy":28,"get-uid":29,"is-array":30,"is-function":31,
"mucss/css":44,"mucss/offsets":48,"mucss/parse-value":49,"mucss/selection":52,"mucss/translate":53,"mumath/between":54,"mumath/loop":55,"mumath/round":57,"mutype/is-number":62,"xtend/mutable":65}],10:[function(a,b,d){function c(a,c,b,h){var d,q=c;f(a)||a===p?(l(c)?q=c:(q=n.createEvent("CustomEvent"),q.initCustomEvent(c,h,!0,b)),d=a.dispatchEvent):k&&a instanceof k?(q=k.Event(c,b),q.detail=b,d=h?targte.trigger:a.triggerHandler):d=a.dispatchEvent||a.emit||a.trigger||a.fire||a.raise;var z=e(arguments,
2);if(d&&g.freeze(a,"emit"+c))return d.apply(a,[q].concat(z)),g.unfreeze(a,"emit"+c),a;d=m(a,q);d=e(d);for(q=0;q<d.length;q++)d[q]&&d[q].apply(a,z);return a}var g=a("icicle"),e=a("sliced"),h=a("mutype/is-string"),f=a("mutype/is-node"),l=a("mutype/is-event"),m=a("./listeners");b.exports=function(a,b){if(a){var f=arguments;if(h(b))f=e(arguments,2),b.split(/\s+/).forEach(function(b){b=b.split(".")[0];c.apply(this,[a,b].concat(f))});else return c.apply(this,f)}};var k="undefined"===typeof jQuery?void 0:
jQuery,n="undefined"===typeof document?void 0:document,p="undefined"===typeof window?void 0:window},{"./listeners":11,icicle:12,"mutype/is-event":13,"mutype/is-node":14,"mutype/is-string":15,sliced:16}],11:[function(a,b,d){function c(a,c,b){a=a._callbacks;if(!c)return a||{};if(!a||!a[c])return[];c=a[c];b&&b.length&&(c=c.filter(function(a){return g(a,b)}));return c}function g(a,c){if(a._ns)for(var b=c.length;b--;)if(0<=a._ns.indexOf(c[b]))return!0}c.remove=function(a,c,b,d){a=a._callbacks;if(!a||!a[c])return!1;
c=a[c];if(d&&d.length&&!g(b,d))return!1;for(d=0;d<c.length;d++)if(c[d]===b||c[d].fn===b){c.splice(d,1);break}};c.add=function(a,c,b,g){if(b){var d=a._callbacks;d||(d={},Object.defineProperty(a,"_callbacks",{value:d}));(d[c]=d[c]||[]).push(b);g&&g.length&&(b._ns=g)}};b.exports=c},{}],12:[function(a,b,d){b.exports={freeze:function(a,b){var h=c.get(a);if(h&&h[b])return!1;h||(h={},c.set(a,h));return h[b]=!0},unfreeze:function(a,b){var h=c.get(a);if(!h||!h[b])return!1;h[b]=null;return!0},isFrozen:function(a,
b){var h=c.get(a);return h&&h[b]}};var c=new WeakMap},{}],13:[function(a,b,d){b.exports=function(a){return"undefined"!==typeof Event&&a instanceof Event}},{}],14:[function(a,b,d){b.exports=function(a){return"undefined"!==typeof document&&a instanceof Node}},{}],15:[function(a,b,d){b.exports=function(a){return"string"===typeof a||a instanceof String}},{}],16:[function(a,b,d){b.exports=a("./lib/sliced")},{"./lib/sliced":17}],17:[function(a,b,d){b.exports=function(a,b,e){var h=[],f=a.length;if(0===f)return h;
b=0>b?Math.max(0,b+f):b||0;for(void 0!==e&&(f=0>e?e+f:e);f-- >b;)h[f-b]=a[f];return h}},{}],18:[function(a,b,d){function c(a,b,d){if(!a)return a;var k;if(void 0===d){var n=e(arguments,1),p=a.removeAll||a.removeAllListeners;p&&p.apply(a,n);if(b)b.split(/\s+/).forEach(function(b){var e=b.split(".");b=e.shift();k=h(a,b,e);for(e=k.length;e--;)c(a,b,k[e])});else for(b in k=h(a),k)c(a,b);return a}var r=a.removeEventListener||a.removeListener||a.detachEvent||a.off;b.split(/\s+/).forEach(function(c){var b=
c.split(".");c=b.shift();if(r)if(g.freeze(a,"off"+c))r.call(a,c,d),g.unfreeze(a,"off"+c);else return a;d.closedCall&&(d.closedCall=!1);h.remove(a,c,d,b)});return a}b.exports=c;var g=a("icicle"),e=a("sliced"),h=a("./listeners")},{"./listeners":11,icicle:12,sliced:16}],19:[function(a,b,d){function c(a,c,b){if(!a)return a;var d=a.addEventListener||a.addListener||a.attachEvent||a.on;c.split(/\s+/).forEach(function(c){var f=c.split(".");c=f.shift();if(d)if(g.freeze(a,"on"+c))d.call(a,c,b),g.unfreeze(a,
"on"+c);else return a;e.add(a,c,b,f)});return a}var g=a("icicle"),e=a("./listeners");b.exports=c;c.wrap=function(a,c,b,e){c=function(){if(e.apply(a,arguments))return b.apply(a,arguments)};c.fn=b;return c}},{"./listeners":11,icicle:12}],20:[function(a,b,d){arguments[4][10][0].apply(d,arguments)},{"./listeners":21,dup:10,icicle:22,"mutype/is-event":59,"mutype/is-node":61,"mutype/is-string":63,sliced:23}],21:[function(a,b,d){arguments[4][11][0].apply(d,arguments)},{dup:11}],22:[function(a,b,d){arguments[4][12][0].apply(d,
arguments)},{dup:12}],23:[function(a,b,d){arguments[4][16][0].apply(d,arguments)},{"./lib/sliced":24,dup:16}],24:[function(a,b,d){arguments[4][17][0].apply(d,arguments)},{dup:17}],25:[function(a,b,d){arguments[4][18][0].apply(d,arguments)},{"./listeners":21,dup:18,icicle:22,sliced:23}],26:[function(a,b,d){arguments[4][19][0].apply(d,arguments)},{"./listeners":21,dup:19,icicle:22}],27:[function(a,b,d){function c(a,b,e,d){return g(a,b,c.wrap(a,b,e,d))}b.exports=c;var g=a("./on");a("./off");var e=a("mutype/is-fn");
c.wrap=function(a,c,b,d){e(d)&&(c=d,d=b,b=c);var g=function(){g.closedInterval?g.closedCall=!0:(g.closedCall=!1,b.apply(a,arguments),g.closedInterval=setTimeout(function(){g.closedInterval=null;g.closedCall&&g.apply(a,arguments)},d))};g.fn=b;return g}},{"./off":25,"./on":26,"mutype/is-fn":60}],28:[function(a,b,d){function c(a,c){return a.touches?c||0===c?a.touches[c].clientY:a.targetTouches[0].clientY:a.clientY}function g(a,c){return a.touches?c||0===c?a.touches[c].clientX:a.targetTouches[0].clientX:
a.clientX}function e(a,b){return[g(a,b),c(a,b)]}e.x=g;e.y=c;b.exports=e},{}],29:[function(a,b,d){var c=Date.now()%1E9;b.exports=function(){return(1E9*Math.random()>>>0)+c++}},{}],30:[function(a,b,d){var c=Object.prototype.toString;b.exports=Array.isArray||function(a){return!!a&&"[object Array]"==c.call(a)}},{}],31:[function(a,b,d){arguments[4][6][0].apply(d,arguments)},{dup:6}],32:[function(a,b,d){function c(a,c){a||(a="*");c=h(c||f);k.push(a);m.observe(c,{subtree:!0,childList:!0});a instanceof Node&&
!f.contains(a)||g(h.call(c,a,!0))}function g(a){for(var c=!1,b,d=a.length;d--;)if(b=a[d],1===b.nodeType&&!n.has(b)){a:{for(var g=k.length,f=void 0;g--;){f=k[g];if(b===f)break a;if("string"===typeof f&&b.matches(f))break a;if(b.contains(f)){b=f;break a}}b=void 0}b&&(c||(c=!0),n.add(b),e(b,l.attachedCallbackName,null,!0))}}a("emmy/on");var e=a("emmy/emit");a("emmy/off");var h=a("tiny-element"),f=document,l=b.exports=c;l.enable=c;l.disable=function(a){a=k.indexOf(a);0<=a&&k.splice(a,1)};l.attachedCallbackName=
"attached";l.detachedCallbackName="detached";var m=new (window.MutationObserver||window.WebKitMutationObserver||window.MozMutationObserver)(function(a){a.forEach(function(a){g(a.addedNodes);a=a.removedNodes;for(var c=a.length;c--;){var b=a[c];1===b.nodeType&&n.has(b)&&(e(b,l.detachedCallbackName,null,!0),n["delete"](b))}})}),k=[],n=new WeakSet},{"emmy/emit":33,"emmy/off":41,"emmy/on":42,"tiny-element":64}],33:[function(a,b,d){arguments[4][10][0].apply(d,arguments)},{"./listeners":34,dup:10,icicle:35,
"mutype/is-event":36,"mutype/is-node":37,"mutype/is-string":38,sliced:39}],34:[function(a,b,d){arguments[4][11][0].apply(d,arguments)},{dup:11}],35:[function(a,b,d){arguments[4][12][0].apply(d,arguments)},{dup:12}],36:[function(a,b,d){arguments[4][13][0].apply(d,arguments)},{dup:13}],37:[function(a,b,d){arguments[4][14][0].apply(d,arguments)},{dup:14}],38:[function(a,b,d){arguments[4][15][0].apply(d,arguments)},{dup:15}],39:[function(a,b,d){arguments[4][16][0].apply(d,arguments)},{"./lib/sliced":40,
dup:16}],40:[function(a,b,d){arguments[4][17][0].apply(d,arguments)},{dup:17}],41:[function(a,b,d){arguments[4][18][0].apply(d,arguments)},{"./listeners":34,dup:18,icicle:35,sliced:39}],42:[function(a,b,d){arguments[4][19][0].apply(d,arguments)},{"./listeners":34,dup:19,icicle:35}],43:[function(a,b,d){b.exports=function(a,b,e,d,f,l){this.top=b||0;this.bottom=d||0;this.left=a||0;this.right=e||0;void 0!==f&&(this.width=f||this.right-this.left);void 0!==l&&(this.height=l||this.bottom-this.top)}},{}],
44:[function(a,b,d){function c(a){var c=a[0].toUpperCase()+a.slice(1);return void 0!==g[a]?a:void 0!==g[e+c]?e+c:""}var g=a("./fake-element").style,e=a("./prefix").dom;b.exports=function(a,b){if(a&&b){var e,d;if("string"===typeof b){e=b;if(3>arguments.length)return a.style[c(e)];d=arguments[2]||"";b={};b[e]=d}for(e in b)"number"===typeof b[e]&&/left|right|bottom|top|width|height/i.test(e)&&(b[e]+="px"),d=b[e]||"",a.style[c(e)]=d}}},{"./fake-element":45,"./prefix":50}],45:[function(a,b,d){b.exports=
document.createElement("div")},{}],46:[function(a,b,d){d.x=function(){return window.innerHeight>document.documentElement.clientHeight};d.y=function(){return window.innerWidth>document.documentElement.clientWidth}},{}],47:[function(a,b,d){b.exports=function(a){var b=a;if(a===window)return!0;if(a===document)return!1;for(;b;){if("fixed"===getComputedStyle(b).position)return!0;b=b.offsetParent}return!1}},{}],48:[function(a,b,d){function c(a){if(!a)throw Error("Bad argument");var b;if(a===g)return a=new h(g.pageXOffset,
g.pageYOffset),a.width=g.innerWidth-(f.y()?l:0),a.height=g.innerHeight-(f.x()?l:0),a.right=a.left+a.width,a.bottom=a.top+a.height,a;if(a===e)return a=c(e.documentElement),a.bottom=Math.max(window.innerHeight,a.bottom),a.right=Math.max(window.innerWidth,a.right),f.y(e.documentElement)&&(a.right-=l),f.x(e.documentElement)&&(a.bottom-=l),a;try{b=a.getBoundingClientRect()}catch(d){b=new h(a.clientLeft,a.clientTop)}var r=m(a),u=r?0:g.pageXOffset,r=r?0:g.pageYOffset;return a=new h(b.left+u,b.top+r,b.left+
u+a.offsetWidth,b.top+r+a.offsetHeight,a.offsetWidth,a.offsetHeight)}var g=window,e=document,h=a("./Rect"),f=a("./has-scroll"),l=a("./scrollbar"),m=a("./is-fixed");b.exports=c},{"./Rect":43,"./has-scroll":46,"./is-fixed":47,"./scrollbar":51}],49:[function(a,b,d){b.exports=function(a){return parseFloat((a+"").slice(0,-2))||0}},{}],50:[function(a,b,d){a=getComputedStyle(document.documentElement,"");a=(Array.prototype.slice.call(a).join("").match(/-(moz|webkit|ms)-/)||""===a.OLink&&["","o"])[1];dom=
"WebKit|Moz|MS|O".match(new RegExp("("+a+")","i"))[1];b.exports={dom:dom,lowercase:a,css:"-"+a+"-",js:a[0].toUpperCase()+a.substr(1)}},{}],51:[function(a,b,d){a=document.createElement("div");d=a.style;d.width="100px";d.height="100px";d.overflow="scroll";d.position="absolute";d.top="-9999px";document.documentElement.appendChild(a);b.exports=a.offsetWidth-a.clientWidth;document.documentElement.removeChild(a)},{}],52:[function(a,b,d){function c(a){a.preventDefault()}var g=a("./css");d.disable=function(a){g(a,
{"user-select":"none","user-drag":"none","touch-callout":"none"});a.setAttribute("unselectable","on");a.addEventListener("selectstart",c)};d.enable=function(a){g(a,{"user-select":null,"user-drag":null,"touch-callout":null});a.removeAttribute("unselectable");a.removeEventListener("selectstart",c)}},{"./css":44}],53:[function(a,b,d){var c=a("./css"),g=a("./parse-value");b.exports=function(a){a=c(a,"transform");return(a=/translate(?:3d)?\s*\(([^\)]*)\)/.exec(a))?a[1].split(/\s*,\s*/).map(function(a){return g(a)}):
null}},{"./css":44,"./parse-value":49}],54:[function(a,b,d){b.exports=a("./wrap")(function(a,b,e){return e>b?Math.max(Math.min(a,e),b):Math.max(Math.min(a,b),e)})},{"./wrap":58}],55:[function(a,b,d){b.exports=a("./wrap")(function(a,b,e){void 0===e&&(e=b,b=0);if(b>e){var d=e;e=b;b=d}d=e-b;a=(a+b)%d-b;a<b&&(a+=d);a>e&&(a-=d);return a})},{"./wrap":58}],56:[function(a,b,d){b.exports=a("./wrap")(function(a){a+="";var b=a.indexOf(".")+1;return b?a.length-b:0})},{"./wrap":58}],57:[function(a,b,d){var c=
a("./precision");b.exports=a("./wrap")(function(a,b){if(0===b)return a;if(!b)return Math.round(a);b=parseFloat(b);a=Math.round(a/b)*b;return parseFloat(a.toFixed(c(b)))})},{"./precision":56,"./wrap":58}],58:[function(a,b,d){b.exports=function(a){return function(b){var e=arguments;if(b instanceof Array){for(var d=Array(b.length),f,l=0;l<b.length;l++){f=[];for(var m=0,k=e.length,n;m<k;m++)n=e[m]instanceof Array?e[m][l]:e[m],f.push(n);d[l]=a.apply(this,f)}return d}if("object"===typeof b){d={};for(l in b){f=
[];m=0;for(k=e.length;m<k;m++)n="object"===typeof e[m]?e[m][l]:e[m],f.push(n);d[l]=a.apply(this,f)}return d}return a.apply(this,e)}}},{}],59:[function(a,b,d){arguments[4][13][0].apply(d,arguments)},{dup:13}],60:[function(a,b,d){b.exports=function(a){return!(!a||!a.apply)}},{}],61:[function(a,b,d){arguments[4][14][0].apply(d,arguments)},{dup:14}],62:[function(a,b,d){b.exports=function(a){return"number"===typeof a||a instanceof Number}},{}],63:[function(a,b,d){arguments[4][15][0].apply(d,arguments)},
{dup:15}],64:[function(a,b,d){var c=[].slice;b.exports=function(a,b){var d=this===window?document:this;return"string"==typeof a?b?c.call(d.querySelectorAll(a),0):d.querySelector(a):a instanceof Node||a===window||!a.length?b?[a]:a:c.call(a,0)}},{}],65:[function(a,b,d){b.exports=function(a){for(var b=1;b<arguments.length;b++){var e=arguments[b],d;for(d in e)e.hasOwnProperty(d)&&(a[d]=e[d])}return a}},{}]},{},[2])(2)});
