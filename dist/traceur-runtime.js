(function(global) {
  'use strict';
  if (global.$traceurRuntime) {
    return;
  }
  var $Object = Object;
  var $TypeError = TypeError;
  var $create = $Object.create;
  var $defineProperties = $Object.defineProperties;
  var $defineProperty = $Object.defineProperty;
  var $freeze = $Object.freeze;
  var $getOwnPropertyDescriptor = $Object.getOwnPropertyDescriptor;
  var $getOwnPropertyNames = $Object.getOwnPropertyNames;
  var $getPrototypeOf = $Object.getPrototypeOf;
  var $hasOwnProperty = $Object.prototype.hasOwnProperty;
  var $toString = $Object.prototype.toString;
  function nonEnum(value) {
    return {
      configurable: true,
      enumerable: false,
      value: value,
      writable: true
    };
  }
  var method = nonEnum;
  var counter = 0;
  function newUniqueString() {
    return '__$' + Math.floor(Math.random() * 1e9) + '$' + ++counter + '$__';
  }
  var symbolInternalProperty = newUniqueString();
  var symbolDescriptionProperty = newUniqueString();
  var symbolDataProperty = newUniqueString();
  var symbolValues = $create(null);
  function isSymbol(symbol) {
    return typeof symbol === 'object' && symbol instanceof SymbolValue;
  }
  function typeOf(v) {
    if (isSymbol(v)) return 'symbol';
    return typeof v;
  }
  function Symbol(description) {
    var value = new SymbolValue(description);
    if (!(this instanceof Symbol)) return value;
    throw new TypeError('Symbol cannot be new\'ed');
  }
  $defineProperty(Symbol.prototype, 'constructor', nonEnum(Symbol));
  $defineProperty(Symbol.prototype, 'toString', method(function() {
    var symbolValue = this[symbolDataProperty];
    if (!getOption('symbols')) return symbolValue[symbolInternalProperty];
    if (!symbolValue) throw TypeError('Conversion from symbol to string');
    var desc = symbolValue[symbolDescriptionProperty];
    if (desc === undefined) desc = '';
    return 'Symbol(' + desc + ')';
  }));
  $defineProperty(Symbol.prototype, 'valueOf', method(function() {
    var symbolValue = this[symbolDataProperty];
    if (!symbolValue) throw TypeError('Conversion from symbol to string');
    if (!getOption('symbols')) return symbolValue[symbolInternalProperty];
    return symbolValue;
  }));
  function SymbolValue(description) {
    var key = newUniqueString();
    $defineProperty(this, symbolDataProperty, {value: this});
    $defineProperty(this, symbolInternalProperty, {value: key});
    $defineProperty(this, symbolDescriptionProperty, {value: description});
    $freeze(this);
    symbolValues[key] = this;
  }
  $defineProperty(SymbolValue.prototype, 'constructor', nonEnum(Symbol));
  $defineProperty(SymbolValue.prototype, 'toString', {
    value: Symbol.prototype.toString,
    enumerable: false
  });
  $defineProperty(SymbolValue.prototype, 'valueOf', {
    value: Symbol.prototype.valueOf,
    enumerable: false
  });
  $freeze(SymbolValue.prototype);
  Symbol.iterator = Symbol();
  function toProperty(name) {
    if (isSymbol(name)) return name[symbolInternalProperty];
    return name;
  }
  function getOwnPropertyNames(object) {
    var rv = [];
    var names = $getOwnPropertyNames(object);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (!symbolValues[name]) rv.push(name);
    }
    return rv;
  }
  function getOwnPropertyDescriptor(object, name) {
    return $getOwnPropertyDescriptor(object, toProperty(name));
  }
  function getOwnPropertySymbols(object) {
    var rv = [];
    var names = $getOwnPropertyNames(object);
    for (var i = 0; i < names.length; i++) {
      var symbol = symbolValues[names[i]];
      if (symbol) rv.push(symbol);
    }
    return rv;
  }
  function hasOwnProperty(name) {
    return $hasOwnProperty.call(this, toProperty(name));
  }
  function getOption(name) {
    return global.traceur && global.traceur.options[name];
  }
  function setProperty(object, name, value) {
    var sym,
        desc;
    if (isSymbol(name)) {
      sym = name;
      name = name[symbolInternalProperty];
    }
    object[name] = value;
    if (sym && (desc = $getOwnPropertyDescriptor(object, name))) $defineProperty(object, name, {enumerable: false});
    return value;
  }
  function defineProperty(object, name, descriptor) {
    if (isSymbol(name)) {
      if (descriptor.enumerable) {
        descriptor = $create(descriptor, {enumerable: {value: false}});
      }
      name = name[symbolInternalProperty];
    }
    $defineProperty(object, name, descriptor);
    return object;
  }
  function polyfillObject(Object) {
    $defineProperty(Object, 'defineProperty', {value: defineProperty});
    $defineProperty(Object, 'getOwnPropertyNames', {value: getOwnPropertyNames});
    $defineProperty(Object, 'getOwnPropertyDescriptor', {value: getOwnPropertyDescriptor});
    $defineProperty(Object.prototype, 'hasOwnProperty', {value: hasOwnProperty});
    Object.getOwnPropertySymbols = getOwnPropertySymbols;
    function is(left, right) {
      if (left === right) return left !== 0 || 1 / left === 1 / right;
      return left !== left && right !== right;
    }
    $defineProperty(Object, 'is', method(is));
    function assign(target, source) {
      var props = $getOwnPropertyNames(source);
      var p,
          length = props.length;
      for (p = 0; p < length; p++) {
        target[props[p]] = source[props[p]];
      }
      return target;
    }
    $defineProperty(Object, 'assign', method(assign));
    function mixin(target, source) {
      var props = $getOwnPropertyNames(source);
      var p,
          descriptor,
          length = props.length;
      for (p = 0; p < length; p++) {
        descriptor = $getOwnPropertyDescriptor(source, props[p]);
        $defineProperty(target, props[p], descriptor);
      }
      return target;
    }
    $defineProperty(Object, 'mixin', method(mixin));
  }
  function exportStar(object) {
    for (var i = 1; i < arguments.length; i++) {
      var names = $getOwnPropertyNames(arguments[i]);
      for (var j = 0; j < names.length; j++) {
        (function(mod, name) {
          $defineProperty(object, name, {
            get: function() {
              return mod[name];
            },
            enumerable: true
          });
        })(arguments[i], names[j]);
      }
    }
    return object;
  }
  function toObject(value) {
    if (value == null) throw $TypeError();
    return $Object(value);
  }
  function spread() {
    var rv = [],
        k = 0;
    for (var i = 0; i < arguments.length; i++) {
      var valueToSpread = toObject(arguments[i]);
      for (var j = 0; j < valueToSpread.length; j++) {
        rv[k++] = valueToSpread[j];
      }
    }
    return rv;
  }
  function getPropertyDescriptor(object, name) {
    while (object !== null) {
      var result = $getOwnPropertyDescriptor(object, name);
      if (result) return result;
      object = $getPrototypeOf(object);
    }
    return undefined;
  }
  function superDescriptor(homeObject, name) {
    var proto = $getPrototypeOf(homeObject);
    if (!proto) throw $TypeError('super is null');
    return getPropertyDescriptor(proto, name);
  }
  function superCall(self, homeObject, name, args) {
    var descriptor = superDescriptor(homeObject, name);
    if (descriptor) {
      if ('value'in descriptor) return descriptor.value.apply(self, args);
      if (descriptor.get) return descriptor.get.call(self).apply(self, args);
    }
    throw $TypeError("super has no method '" + name + "'.");
  }
  function superGet(self, homeObject, name) {
    var descriptor = superDescriptor(homeObject, name);
    if (descriptor) {
      if (descriptor.get) return descriptor.get.call(self); else if ('value'in descriptor) return descriptor.value;
    }
    return undefined;
  }
  function superSet(self, homeObject, name, value) {
    var descriptor = superDescriptor(homeObject, name);
    if (descriptor && descriptor.set) {
      descriptor.set.call(self, value);
      return;
    }
    throw $TypeError("super has no setter '" + name + "'.");
  }
  function getDescriptors(object) {
    var descriptors = {},
        name,
        names = $getOwnPropertyNames(object);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      descriptors[name] = $getOwnPropertyDescriptor(object, name);
    }
    return descriptors;
  }
  function createClass(ctor, object, staticObject, superClass) {
    $defineProperty(object, 'constructor', {
      value: ctor,
      configurable: true,
      enumerable: false,
      writable: true
    });
    if (arguments.length > 3) {
      if (typeof superClass === 'function') ctor.__proto__ = superClass;
      ctor.prototype = $create(getProtoParent(superClass), getDescriptors(object));
    } else {
      ctor.prototype = object;
    }
    $defineProperty(ctor, 'prototype', {
      configurable: false,
      writable: false
    });
    return $defineProperties(ctor, getDescriptors(staticObject));
  }
  function getProtoParent(superClass) {
    if (typeof superClass === 'function') {
      var prototype = superClass.prototype;
      if ($Object(prototype) === prototype || prototype === null) return superClass.prototype;
    }
    if (superClass === null) return null;
    throw new TypeError();
  }
  function defaultSuperCall(self, homeObject, args) {
    if ($getPrototypeOf(homeObject) !== null) superCall(self, homeObject, 'constructor', args);
  }
  var ST_NEWBORN = 0;
  var ST_EXECUTING = 1;
  var ST_SUSPENDED = 2;
  var ST_CLOSED = 3;
  var END_STATE = - 3;
  function addIterator(object) {
    return defineProperty(object, Symbol.iterator, nonEnum(function() {
      return this;
    }));
  }
  function GeneratorContext() {
    this.state = 0;
    this.GState = ST_NEWBORN;
    this.storedException = undefined;
    this.finallyFallThrough = undefined;
    this.sent = undefined;
    this.returnValue = undefined;
    this.tryStack_ = [];
  }
  GeneratorContext.prototype = {
    pushTry: function(catchState, finallyState) {
      if (finallyState !== null) {
        var finallyFallThrough = null;
        for (var i = this.tryStack_.length - 1; i >= 0; i--) {
          if (this.tryStack_[i]. catch !== undefined) {
            finallyFallThrough = this.tryStack_[i]. catch;
            break;
          }
        }
        if (finallyFallThrough === null) finallyFallThrough = - 3;
        this.tryStack_.push({
          finally: finallyState,
          finallyFallThrough: finallyFallThrough
        });
      }
      if (catchState !== null) {
        this.tryStack_.push({ catch: catchState});
      }
    },
    popTry: function() {
      this.tryStack_.pop();
    }
  };
  function getNextOrThrow(ctx, moveNext, action) {
    return function(x) {
      switch (ctx.GState) {
        case ST_EXECUTING:
          throw new Error(("\"" + action + "\" on executing generator"));
        case ST_CLOSED:
          throw new Error(("\"" + action + "\" on closed generator"));
        case ST_NEWBORN:
          if (action === 'throw') {
            ctx.GState = ST_CLOSED;
            throw x;
          }
          if (x !== undefined) throw $TypeError('Sent value to newborn generator');
        case ST_SUSPENDED:
          ctx.GState = ST_EXECUTING;
          ctx.action = action;
          ctx.sent = x;
          var value = moveNext(ctx);
          var done = value === ctx;
          if (done) value = ctx.returnValue;
          ctx.GState = done ? ST_CLOSED: ST_SUSPENDED;
          return {
            value: value,
            done: done
          };
      }
    };
  }
  function generatorWrap(innerFunction, self) {
    var moveNext = getMoveNext(innerFunction, self);
    var ctx = new GeneratorContext();
    return addIterator({
      next: getNextOrThrow(ctx, moveNext, 'next'),
      throw: getNextOrThrow(ctx, moveNext, 'throw')
    });
  }
  function AsyncFunctionContext() {
    GeneratorContext.call(this);
    this.err = undefined;
    var ctx = this;
    ctx.result = new Promise(function(resolve, reject) {
      ctx.resolve = resolve;
      ctx.reject = reject;
    });
  }
  AsyncFunctionContext.prototype = Object.create(GeneratorContext.prototype);
  function asyncWrap(innerFunction, self) {
    var moveNext = getMoveNext(innerFunction, self);
    var ctx = new AsyncFunctionContext();
    ctx.createCallback = function(newState) {
      return function(value) {
        ctx.state = newState;
        ctx.value = value;
        moveNext(ctx);
      };
    };
    ctx.createErrback = function(newState) {
      return function(err) {
        ctx.state = newState;
        ctx.err = err;
        moveNext(ctx);
      };
    };
    moveNext(ctx);
    return ctx.result;
  }
  function getMoveNext(innerFunction, self) {
    return function(ctx) {
      while (true) {
        try {
          return innerFunction.call(self, ctx);
        } catch (ex) {
          ctx.storedException = ex;
          var last = ctx.tryStack_[ctx.tryStack_.length - 1];
          if (!last) {
            ctx.GState = ST_CLOSED;
            ctx.state = END_STATE;
            throw ex;
          }
          ctx.state = last. catch !== undefined ? last. catch: last. finally;
          if (last.finallyFallThrough !== undefined) ctx.finallyFallThrough = last.finallyFallThrough;
        }
      }
    };
  }
  function setupGlobals(global) {
    global.Symbol = Symbol;
    polyfillObject(global.Object);
  }
  setupGlobals(global);
  global.$traceurRuntime = {
    asyncWrap: asyncWrap,
    createClass: createClass,
    defaultSuperCall: defaultSuperCall,
    exportStar: exportStar,
    generatorWrap: generatorWrap,
    setProperty: setProperty,
    setupGlobals: setupGlobals,
    spread: spread,
    superCall: superCall,
    superGet: superGet,
    superSet: superSet,
    toObject: toObject,
    toProperty: toProperty,
    typeof: typeOf
  };
})(typeof global !== 'undefined' ? global: this);
(function() {
  function buildFromEncodedParts(opt_scheme, opt_userInfo, opt_domain, opt_port, opt_path, opt_queryData, opt_fragment) {
    var out = [];
    if (opt_scheme) {
      out.push(opt_scheme, ':');
    }
    if (opt_domain) {
      out.push('//');
      if (opt_userInfo) {
        out.push(opt_userInfo, '@');
      }
      out.push(opt_domain);
      if (opt_port) {
        out.push(':', opt_port);
      }
    }
    if (opt_path) {
      out.push(opt_path);
    }
    if (opt_queryData) {
      out.push('?', opt_queryData);
    }
    if (opt_fragment) {
      out.push('#', opt_fragment);
    }
    return out.join('');
  }
  ;
  var splitRe = new RegExp('^' + '(?:' + '([^:/?#.]+)' + ':)?' + '(?://' + '(?:([^/?#]*)@)?' + '([\\w\\d\\-\\u0100-\\uffff.%]*)' + '(?::([0-9]+))?' + ')?' + '([^?#]+)?' + '(?:\\?([^#]*))?' + '(?:#(.*))?' + '$');
  var ComponentIndex = {
    SCHEME: 1,
    USER_INFO: 2,
    DOMAIN: 3,
    PORT: 4,
    PATH: 5,
    QUERY_DATA: 6,
    FRAGMENT: 7
  };
  function split(uri) {
    return (uri.match(splitRe));
  }
  function removeDotSegments(path) {
    if (path === '/') return '/';
    var leadingSlash = path[0] === '/' ? '/': '';
    var trailingSlash = path.slice(- 1) === '/' ? '/': '';
    var segments = path.split('/');
    var out = [];
    var up = 0;
    for (var pos = 0; pos < segments.length; pos++) {
      var segment = segments[pos];
      switch (segment) {
        case '':
        case '.':
          break;
        case '..':
          if (out.length) out.pop(); else up++;
          break;
        default:
          out.push(segment);
      }
    }
    if (!leadingSlash) {
      while (up-- > 0) {
        out.unshift('..');
      }
      if (out.length === 0) out.push('.');
    }
    return leadingSlash + out.join('/') + trailingSlash;
  }
  function joinAndCanonicalizePath(parts) {
    var path = parts[ComponentIndex.PATH];
    path = removeDotSegments(path.replace(/\/\//.g, '/'));
    parts[ComponentIndex.PATH] = path;
    return buildFromEncodedParts(parts[ComponentIndex.SCHEME], parts[ComponentIndex.USER_INFO], parts[ComponentIndex.DOMAIN], parts[ComponentIndex.PORT], parts[ComponentIndex.PATH], parts[ComponentIndex.QUERY_DATA], parts[ComponentIndex.FRAGMENT]);
  }
  function canonicalizeUrl(url) {
    var parts = split(url);
    return joinAndCanonicalizePath(parts);
  }
  function resolveUrl(base, url) {
    var parts = split(url);
    var baseParts = split(base);
    if (parts[ComponentIndex.SCHEME]) {
      return joinAndCanonicalizePath(parts);
    } else {
      parts[ComponentIndex.SCHEME] = baseParts[ComponentIndex.SCHEME];
    }
    for (var i = ComponentIndex.SCHEME; i <= ComponentIndex.PORT; i++) {
      if (!parts[i]) {
        parts[i] = baseParts[i];
      }
    }
    if (parts[ComponentIndex.PATH][0] == '/') {
      return joinAndCanonicalizePath(parts);
    }
    var path = baseParts[ComponentIndex.PATH];
    var index = path.lastIndexOf('/');
    path = path.slice(0, index + 1) + parts[ComponentIndex.PATH];
    parts[ComponentIndex.PATH] = path;
    return joinAndCanonicalizePath(parts);
  }
  function isAbsolute(name) {
    if (!name) return false;
    if (name[0] === '/') return true;
    var parts = split(name);
    if (parts[ComponentIndex.SCHEME]) return true;
    return false;
  }
  $traceurRuntime.canonicalizeUrl = canonicalizeUrl;
  $traceurRuntime.isAbsolute = isAbsolute;
  $traceurRuntime.removeDotSegments = removeDotSegments;
  $traceurRuntime.resolveUrl = resolveUrl;
})();
(function(global) {
  'use strict';
  var $__2 = $traceurRuntime,
      canonicalizeUrl = $__2.canonicalizeUrl,
      resolveUrl = $__2.resolveUrl,
      isAbsolute = $__2.isAbsolute;
  var moduleInstantiators = Object.create(null);
  var baseURL;
  if (global.location && global.location.href) baseURL = resolveUrl(global.location.href, './'); else baseURL = '';
  var UncoatedModuleEntry = function UncoatedModuleEntry(url, uncoatedModule) {
    this.url = url;
    this.value_ = uncoatedModule;
  };
  ($traceurRuntime.createClass)(UncoatedModuleEntry, {}, {});
  var UncoatedModuleInstantiator = function UncoatedModuleInstantiator(url, func) {
    $traceurRuntime.superCall(this, $UncoatedModuleInstantiator.prototype, "constructor", [url, null]);
    this.func = func;
  };
  var $UncoatedModuleInstantiator = UncoatedModuleInstantiator;
  ($traceurRuntime.createClass)(UncoatedModuleInstantiator, {getUncoatedModule: function() {
      if (this.value_) return this.value_;
      return this.value_ = this.func.call(global);
    }}, {}, UncoatedModuleEntry);
  function getUncoatedModuleInstantiator(name) {
    if (!name) return;
    var url = ModuleStore.normalize(name);
    return moduleInstantiators[url];
  }
  ;
  var moduleInstances = Object.create(null);
  var liveModuleSentinel = {};
  function Module(uncoatedModule) {
    var isLive = arguments[1];
    var coatedModule = Object.create(null);
    Object.getOwnPropertyNames(uncoatedModule).forEach((function(name) {
      var getter,
          value;
      if (isLive === liveModuleSentinel) {
        var descr = Object.getOwnPropertyDescriptor(uncoatedModule, name);
        if (descr.get) getter = descr.get;
      }
      if (!getter) {
        value = uncoatedModule[name];
        getter = function() {
          return value;
        };
      }
      Object.defineProperty(coatedModule, name, {
        get: getter,
        enumerable: true
      });
    }));
    Object.preventExtensions(coatedModule);
    return coatedModule;
  }
  var ModuleStore = {
    normalize: function(name, refererName, refererAddress) {
      if (typeof name !== "string") throw new TypeError("module name must be a string, not " + typeof name);
      if (isAbsolute(name)) return canonicalizeUrl(name);
      if (/[^\.]\/\.\.\//.test(name)) {
        throw new Error('module name embeds /../: ' + name);
      }
      if (name[0] === '.' && refererName) return resolveUrl(refererName, name);
      return canonicalizeUrl(name);
    },
    get: function(normalizedName) {
      var m = getUncoatedModuleInstantiator(normalizedName);
      if (!m) return undefined;
      var moduleInstance = moduleInstances[m.url];
      if (moduleInstance) return moduleInstance;
      moduleInstance = Module(m.getUncoatedModule(), liveModuleSentinel);
      return moduleInstances[m.url] = moduleInstance;
    },
    set: function(normalizedName, module) {
      normalizedName = String(normalizedName);
      moduleInstantiators[normalizedName] = new UncoatedModuleInstantiator(normalizedName, (function() {
        return module;
      }));
      moduleInstances[normalizedName] = module;
    },
    get baseURL() {
      return baseURL;
    },
    set baseURL(v) {
      baseURL = String(v);
    },
    registerModule: function(name, func) {
      var normalizedName = ModuleStore.normalize(name);
      if (moduleInstantiators[normalizedName]) throw new Error('duplicate module named ' + normalizedName);
      moduleInstantiators[normalizedName] = new UncoatedModuleInstantiator(normalizedName, func);
    },
    getAnonymousModule: function(func) {
      return new Module(func.call(global), liveModuleSentinel);
    },
    getForTesting: function(name) {
      var $__0 = this;
      if (!this.testingPrefix_) {
        Object.keys(moduleInstances).some((function(key) {
          var m = /(traceur@[^\/]*\/)/.exec(key);
          if (m) {
            $__0.testingPrefix_ = m[1];
            return true;
          }
        }));
      }
      return this.get(this.testingPrefix_ + name);
    }
  };
  ModuleStore.set('@traceur/src/runtime/ModuleStore', new Module({ModuleStore: ModuleStore}));
  var setupGlobals = $traceurRuntime.setupGlobals;
  $traceurRuntime.setupGlobals = function(global) {
    setupGlobals(global);
  };
  $traceurRuntime.ModuleStore = ModuleStore;
  global.System = {
    registerModule: ModuleStore.registerModule,
    get: ModuleStore.get,
    set: ModuleStore.set,
    normalize: ModuleStore.normalize
  };
  $traceurRuntime.getModuleImpl = function(name) {
    var instantiator = getUncoatedModuleInstantiator(name);
    return instantiator && instantiator.getUncoatedModule();
  };
})(typeof global !== 'undefined' ? global: this);
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/src/runtime/polyfills/utils", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/src/runtime/polyfills/utils";
  var toObject = $traceurRuntime.toObject;
  function toUint32(x) {
    return x | 0;
  }
  return {
    get toObject() {
      return toObject;
    },
    get toUint32() {
      return toUint32;
    }
  };
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/src/runtime/polyfills/ArrayIterator", function() {
  "use strict";
  var $__4;
  var __moduleName = "traceur-runtime@0.0.20/src/runtime/polyfills/ArrayIterator";
  var $__5 = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/src/runtime/polyfills/utils"),
      toObject = $__5.toObject,
      toUint32 = $__5.toUint32;
  var ARRAY_ITERATOR_KIND_KEYS = 1;
  var ARRAY_ITERATOR_KIND_VALUES = 2;
  var ARRAY_ITERATOR_KIND_ENTRIES = 3;
  var ArrayIterator = function ArrayIterator() {};
  ($traceurRuntime.createClass)(ArrayIterator, ($__4 = {}, Object.defineProperty($__4, "next", {
    value: function() {
      var iterator = toObject(this);
      var array = iterator.iteratorObject_;
      if (!array) {
        throw new TypeError('Object is not an ArrayIterator');
      }
      var index = iterator.arrayIteratorNextIndex_;
      var itemKind = iterator.arrayIterationKind_;
      var length = toUint32(array.length);
      if (index >= length) {
        iterator.arrayIteratorNextIndex_ = Infinity;
        return createIteratorResultObject(undefined, true);
      }
      iterator.arrayIteratorNextIndex_ = index + 1;
      if (itemKind == ARRAY_ITERATOR_KIND_VALUES) return createIteratorResultObject(array[index], false);
      if (itemKind == ARRAY_ITERATOR_KIND_ENTRIES) return createIteratorResultObject([index, array[index]], false);
      return createIteratorResultObject(index, false);
    },
    configurable: true,
    enumerable: true,
    writable: true
  }), Object.defineProperty($__4, Symbol.iterator, {
    value: function() {
      return this;
    },
    configurable: true,
    enumerable: true,
    writable: true
  }), $__4), {});
  function createArrayIterator(array, kind) {
    var object = toObject(array);
    var iterator = new ArrayIterator;
    iterator.iteratorObject_ = object;
    iterator.arrayIteratorNextIndex_ = 0;
    iterator.arrayIterationKind_ = kind;
    return iterator;
  }
  function createIteratorResultObject(value, done) {
    return {
      value: value,
      done: done
    };
  }
  function entries() {
    return createArrayIterator(this, ARRAY_ITERATOR_KIND_ENTRIES);
  }
  function keys() {
    return createArrayIterator(this, ARRAY_ITERATOR_KIND_KEYS);
  }
  function values() {
    return createArrayIterator(this, ARRAY_ITERATOR_KIND_VALUES);
  }
  return {
    get entries() {
      return entries;
    },
    get keys() {
      return keys;
    },
    get values() {
      return values;
    }
  };
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/events", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/events";
  var indexOf = function(callbacks, callback) {
    for (var i = 0,
        l = callbacks.length; i < l; i++) {
      if (callbacks[i] === callback) {
        return i;
      }
    }
    return - 1;
  };
  var callbacksFor = function(object) {
    var callbacks = object._promiseCallbacks;
    if (!callbacks) {
      callbacks = object._promiseCallbacks = {};
    }
    return callbacks;
  };
  var $__default = {
    mixin: function(object) {
      object.on = this.on;
      object.off = this.off;
      object.trigger = this.trigger;
      object._promiseCallbacks = undefined;
      return object;
    },
    on: function(eventName, callback) {
      var allCallbacks = callbacksFor(this),
          callbacks;
      callbacks = allCallbacks[eventName];
      if (!callbacks) {
        callbacks = allCallbacks[eventName] = [];
      }
      if (indexOf(callbacks, callback) === - 1) {
        callbacks.push(callback);
      }
    },
    off: function(eventName, callback) {
      var allCallbacks = callbacksFor(this),
          callbacks,
          index;
      if (!callback) {
        allCallbacks[eventName] = [];
        return;
      }
      callbacks = allCallbacks[eventName];
      index = indexOf(callbacks, callback);
      if (index !== - 1) {
        callbacks.splice(index, 1);
      }
    },
    trigger: function(eventName, options) {
      var allCallbacks = callbacksFor(this),
          callbacks,
          callbackTuple,
          callback,
          binding;
      if (callbacks = allCallbacks[eventName]) {
        for (var i = 0; i < callbacks.length; i++) {
          callback = callbacks[i];
          callback(options);
        }
      }
    }
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/config", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/config";
  var EventTarget = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/events").default;
  var config = {instrument: false};
  EventTarget.mixin(config);
  function configure(name, value) {
    if (name === 'onerror') {
      config.on('error', value);
      return;
    }
    if (arguments.length === 2) {
      config[name] = value;
    } else {
      return config[name];
    }
  }
  ;
  return {
    get config() {
      return config;
    },
    get configure() {
      return configure;
    }
  };
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/utils", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/utils";
  function objectOrFunction(x) {
    return typeof x === "function" || (typeof x === "object" && x !== null);
  }
  function isFunction(x) {
    return typeof x === "function";
  }
  function isNonThenable(x) {
    return !objectOrFunction(x);
  }
  function isArray(x) {
    return Object.prototype.toString.call(x) === "[object Array]";
  }
  var now = Date.now || function() {
    return new Date().getTime();
  };
  var keysOf = Object.keys || function(object) {
    var result = [];
    for (var prop in object) {
      result.push(prop);
    }
    return result;
  };
  return {
    get objectOrFunction() {
      return objectOrFunction;
    },
    get isFunction() {
      return isFunction;
    },
    get isNonThenable() {
      return isNonThenable;
    },
    get isArray() {
      return isArray;
    },
    get now() {
      return now;
    },
    get keysOf() {
      return keysOf;
    }
  };
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/instrument", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/instrument";
  var config = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/config").config;
  var now = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/utils").now;
  var $__default = function instrument(eventName, promise, child) {
    try {
      config.trigger(eventName, {
        guid: promise._guidKey + promise._id,
        eventName: eventName,
        detail: promise._detail,
        childGuid: child && promise._guidKey + child._id,
        label: promise._label,
        timeStamp: now(),
        stack: new Error(promise._label).stack
      });
    } catch (error) {
      setTimeout(function() {
        throw error;
      }, 0);
    }
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise/all", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise/all";
  var $__8 = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/utils"),
      isArray = $__8.isArray,
      isNonThenable = $__8.isNonThenable;
  var $__default = function all(entries, label) {
    var Constructor = this;
    return new Constructor(function(resolve, reject) {
      if (!isArray(entries)) {
        throw new TypeError('You must pass an array to all.');
      }
      var remaining = entries.length;
      var results = new Array(remaining);
      var entry,
          pending = true;
      if (remaining === 0) {
        resolve(results);
        return;
      }
      function fulfillmentAt(index) {
        return function(value) {
          results[index] = value;
          if (--remaining === 0) {
            resolve(results);
          }
        };
      }
      function onRejection(reason) {
        remaining = 0;
        reject(reason);
      }
      for (var index = 0; index < entries.length; index++) {
        entry = entries[index];
        if (isNonThenable(entry)) {
          results[index] = entry;
          if (--remaining === 0) {
            resolve(results);
          }
        } else {
          Constructor.cast(entry).then(fulfillmentAt(index), onRejection);
        }
      }
    }, label);
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise/cast", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise/cast";
  var $__default = function cast(object, label) {
    var Constructor = this;
    if (object && typeof object === 'object' && object.constructor === Constructor) {
      return object;
    }
    return new Constructor(function(resolve) {
      resolve(object);
    }, label);
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise/race", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise/race";
  var $__9 = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/utils"),
      isArray = $__9.isArray,
      isFunction = $__9.isFunction,
      isNonThenable = $__9.isNonThenable;
  var $__default = function race(entries, label) {
    var Constructor = this,
        entry;
    return new Constructor(function(resolve, reject) {
      if (!isArray(entries)) {
        throw new TypeError('You must pass an array to race.');
      }
      var pending = true;
      function onFulfillment(value) {
        if (pending) {
          pending = false;
          resolve(value);
        }
      }
      function onRejection(reason) {
        if (pending) {
          pending = false;
          reject(reason);
        }
      }
      for (var i = 0; i < entries.length; i++) {
        entry = entries[i];
        if (isNonThenable(entry)) {
          pending = false;
          resolve(entry);
          return;
        } else {
          Constructor.cast(entry).then(onFulfillment, onRejection);
        }
      }
    }, label);
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise/reject", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise/reject";
  var $__default = function reject(reason, label) {
    var Constructor = this;
    return new Constructor(function(resolve, reject) {
      reject(reason);
    }, label);
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise/resolve", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise/resolve";
  var $__default = function resolve(value, label) {
    var Constructor = this;
    return new Constructor(function(resolve, reject) {
      resolve(value);
    }, label);
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise";
  var config = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/config").config;
  var EventTarget = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/events").default;
  var instrument = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/instrument").default;
  var $__10 = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/utils"),
      objectOrFunction = $__10.objectOrFunction,
      isFunction = $__10.isFunction,
      now = $__10.now;
  var cast = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise/cast").default;
  var all = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise/all").default;
  var race = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise/race").default;
  var Resolve = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise/resolve").default;
  var Reject = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise/reject").default;
  var guidKey = 'rsvp_' + now() + '-';
  var counter = 0;
  function noop() {}
  var $__default = Promise;
  function Promise(resolver, label) {
    if (!isFunction(resolver)) {
      throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
    }
    if (!(this instanceof Promise)) {
      throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
    }
    this._id = counter++;
    this._label = label;
    this._subscribers = [];
    if (config.instrument) {
      instrument('created', this);
    }
    if (noop !== resolver) {
      invokeResolver(resolver, this);
    }
  }
  function invokeResolver(resolver, promise) {
    function resolvePromise(value) {
      resolve(promise, value);
    }
    function rejectPromise(reason) {
      reject(promise, reason);
    }
    try {
      resolver(resolvePromise, rejectPromise);
    } catch (e) {
      rejectPromise(e);
    }
  }
  Promise.cast = cast;
  Promise.all = all;
  Promise.race = race;
  Promise.resolve = Resolve;
  Promise.reject = Reject;
  var PENDING = void 0;
  var SEALED = 0;
  var FULFILLED = 1;
  var REJECTED = 2;
  function subscribe(parent, child, onFulfillment, onRejection) {
    var subscribers = parent._subscribers;
    var length = subscribers.length;
    subscribers[length] = child;
    subscribers[length + FULFILLED] = onFulfillment;
    subscribers[length + REJECTED] = onRejection;
  }
  function publish(promise, settled) {
    var child,
        callback,
        subscribers = promise._subscribers,
        detail = promise._detail;
    if (config.instrument) {
      instrument(settled === FULFILLED ? 'fulfilled': 'rejected', promise);
    }
    for (var i = 0; i < subscribers.length; i += 3) {
      child = subscribers[i];
      callback = subscribers[i + settled];
      invokeCallback(settled, child, callback, detail);
    }
    promise._subscribers = null;
  }
  Promise.prototype = {
    constructor: Promise,
    _id: undefined,
    _guidKey: guidKey,
    _label: undefined,
    _state: undefined,
    _detail: undefined,
    _subscribers: undefined,
    _onerror: function(reason) {
      config.trigger('error', reason);
    },
    then: function(onFulfillment, onRejection, label) {
      var promise = this;
      this._onerror = null;
      var thenPromise = new this.constructor(noop, label);
      if (this._state) {
        var callbacks = arguments;
        config.async(function invokePromiseCallback() {
          invokeCallback(promise._state, thenPromise, callbacks[promise._state - 1], promise._detail);
        });
      } else {
        subscribe(this, thenPromise, onFulfillment, onRejection);
      }
      if (config.instrument) {
        instrument('chained', promise, thenPromise);
      }
      return thenPromise;
    },
    'catch': function(onRejection, label) {
      return this.then(null, onRejection, label);
    },
    'finally': function(callback, label) {
      var constructor = this.constructor;
      return this.then(function(value) {
        return constructor.cast(callback()).then(function() {
          return value;
        });
      }, function(reason) {
        return constructor.cast(callback()).then(function() {
          throw reason;
        });
      }, label);
    }
  };
  function invokeCallback(settled, promise, callback, detail) {
    var hasCallback = isFunction(callback),
        value,
        error,
        succeeded,
        failed;
    if (hasCallback) {
      try {
        value = callback(detail);
        succeeded = true;
      } catch (e) {
        failed = true;
        error = e;
      }
    } else {
      value = detail;
      succeeded = true;
    }
    if (handleThenable(promise, value)) {
      return;
    } else if (hasCallback && succeeded) {
      resolve(promise, value);
    } else if (failed) {
      reject(promise, error);
    } else if (settled === FULFILLED) {
      resolve(promise, value);
    } else if (settled === REJECTED) {
      reject(promise, value);
    }
  }
  function handleThenable(promise, value) {
    var then = null,
        resolved;
    try {
      if (promise === value) {
        throw new TypeError("A promises callback cannot return that same promise.");
      }
      if (objectOrFunction(value)) {
        then = value.then;
        if (isFunction(then)) {
          then.call(value, function(val) {
            if (resolved) {
              return true;
            }
            resolved = true;
            if (value !== val) {
              resolve(promise, val);
            } else {
              fulfill(promise, val);
            }
          }, function(val) {
            if (resolved) {
              return true;
            }
            resolved = true;
            reject(promise, val);
          }, 'derived from: ' + (promise._label || ' unknown promise'));
          return true;
        }
      }
    } catch (error) {
      if (resolved) {
        return true;
      }
      reject(promise, error);
      return true;
    }
    return false;
  }
  function resolve(promise, value) {
    if (promise === value) {
      fulfill(promise, value);
    } else if (!handleThenable(promise, value)) {
      fulfill(promise, value);
    }
  }
  function fulfill(promise, value) {
    if (promise._state !== PENDING) {
      return;
    }
    promise._state = SEALED;
    promise._detail = value;
    config.async(publishFulfillment, promise);
  }
  function reject(promise, reason) {
    if (promise._state !== PENDING) {
      return;
    }
    promise._state = SEALED;
    promise._detail = reason;
    config.async(publishRejection, promise);
  }
  function publishFulfillment(promise) {
    publish(promise, promise._state = FULFILLED);
  }
  function publishRejection(promise) {
    if (promise._onerror) {
      promise._onerror(promise._detail);
    }
    publish(promise, promise._state = REJECTED);
  }
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/all", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/all";
  var Promise = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise").default;
  var $__default = function all(array, label) {
    return Promise.all(array, label);
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/all_settled", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/all_settled";
  var Promise = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise").default;
  var $__12 = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/utils"),
      isArray = $__12.isArray,
      isNonThenable = $__12.isNonThenable;
  var $__default = function allSettled(entries, label) {
    return new Promise(function(resolve, reject) {
      if (!isArray(entries)) {
        throw new TypeError('You must pass an array to allSettled.');
      }
      var remaining = entries.length;
      var entry;
      if (remaining === 0) {
        resolve([]);
        return;
      }
      var results = new Array(remaining);
      function fulfilledResolver(index) {
        return function(value) {
          resolveAll(index, fulfilled(value));
        };
      }
      function rejectedResolver(index) {
        return function(reason) {
          resolveAll(index, rejected(reason));
        };
      }
      function resolveAll(index, value) {
        results[index] = value;
        if (--remaining === 0) {
          resolve(results);
        }
      }
      for (var index = 0; index < entries.length; index++) {
        entry = entries[index];
        if (isNonThenable(entry)) {
          resolveAll(index, fulfilled(entry));
        } else {
          Promise.cast(entry).then(fulfilledResolver(index), rejectedResolver(index));
        }
      }
    }, label);
  };
  function fulfilled(value) {
    return {
      state: 'fulfilled',
      value: value
    };
  }
  function rejected(reason) {
    return {
      state: 'rejected',
      reason: reason
    };
  }
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/asap", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/asap";
  var $__default = function asap(callback, arg) {
    var length = queue.push([callback, arg]);
    if (length === 1) {
      scheduleFlush();
    }
  };
  var browserGlobal = (typeof window !== 'undefined') ? window: {};
  var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
  function useNextTick() {
    return function() {
      process.nextTick(flush);
    };
  }
  function useMutationObserver() {
    var iterations = 0;
    var observer = new BrowserMutationObserver(flush);
    var node = document.createTextNode('');
    observer.observe(node, {characterData: true});
    return function() {
      node.data = (iterations = ++iterations % 2);
    };
  }
  function useSetTimeout() {
    return function() {
      setTimeout(flush, 1);
    };
  }
  var queue = [];
  function flush() {
    for (var i = 0; i < queue.length; i++) {
      var tuple = queue[i];
      var callback = tuple[0],
          arg = tuple[1];
      callback(arg);
    }
    queue = [];
  }
  var scheduleFlush;
  if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
    scheduleFlush = useNextTick();
  } else if (BrowserMutationObserver) {
    scheduleFlush = useMutationObserver();
  } else {
    scheduleFlush = useSetTimeout();
  }
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/defer", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/defer";
  var Promise = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise").default;
  var $__default = function defer(label) {
    var deferred = {};
    deferred.promise = new Promise(function(resolve, reject) {
      deferred.resolve = resolve;
      deferred.reject = reject;
    }, label);
    return deferred;
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/map", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/map";
  var Promise = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise").default;
  var all = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/all").default;
  var $__14 = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/utils"),
      isArray = $__14.isArray,
      isFunction = $__14.isFunction;
  var $__default = function map(promises, mapFn, label) {
    return all(promises, label).then(function(results) {
      if (!isArray(promises)) {
        throw new TypeError('You must pass an array to map.');
      }
      if (!isFunction(mapFn)) {
        throw new TypeError("You must pass a function to map's second argument.");
      }
      var resultLen = results.length,
          mappedResults = [],
          i;
      for (i = 0; i < resultLen; i++) {
        mappedResults.push(mapFn(results[i]));
      }
      return all(mappedResults, label);
    });
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/filter", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/filter";
  var all = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/all").default;
  var map = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/map").default;
  var $__15 = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/utils"),
      isFunction = $__15.isFunction,
      isArray = $__15.isArray;
  function filter(promises, filterFn, label) {
    return all(promises, label).then(function(values) {
      if (!isArray(promises)) {
        throw new TypeError('You must pass an array to filter.');
      }
      if (!isFunction(filterFn)) {
        throw new TypeError("You must pass a function to filter's second argument.");
      }
      return map(promises, filterFn, label).then(function(filterResults) {
        var i,
            valuesLen = values.length,
            filtered = [];
        for (i = 0; i < valuesLen; i++) {
          if (filterResults[i]) filtered.push(values[i]);
        }
        return filtered;
      });
    });
  }
  var $__default = filter;
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/hash", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/hash";
  var Promise = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise").default;
  var $__16 = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/utils"),
      isNonThenable = $__16.isNonThenable,
      keysOf = $__16.keysOf;
  var $__default = function hash(object, label) {
    return new Promise(function(resolve, reject) {
      var results = {};
      var keys = keysOf(object);
      var remaining = keys.length;
      var entry,
          property;
      if (remaining === 0) {
        resolve(results);
        return;
      }
      function fulfilledTo(property) {
        return function(value) {
          results[property] = value;
          if (--remaining === 0) {
            resolve(results);
          }
        };
      }
      function onRejection(reason) {
        remaining = 0;
        reject(reason);
      }
      for (var i = 0; i < keys.length; i++) {
        property = keys[i];
        entry = object[property];
        if (isNonThenable(entry)) {
          results[property] = entry;
          if (--remaining === 0) {
            resolve(results);
          }
        } else {
          Promise.cast(entry).then(fulfilledTo(property), onRejection);
        }
      }
    });
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/node", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/node";
  var Promise = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise").default;
  var slice = Array.prototype.slice;
  function makeNodeCallbackFor(resolve, reject) {
    return function(error, value) {
      if (error) {
        reject(error);
      } else if (arguments.length > 2) {
        resolve(slice.call(arguments, 1));
      } else {
        resolve(value);
      }
    };
  }
  var $__default = function denodeify(nodeFunc, binding) {
    return function() {
      var nodeArgs = slice.call(arguments),
          resolve,
          reject;
      var thisArg = this || binding;
      return new Promise(function(resolve, reject) {
        Promise.all(nodeArgs).then(function(nodeArgs) {
          try {
            nodeArgs.push(makeNodeCallbackFor(resolve, reject));
            nodeFunc.apply(thisArg, nodeArgs);
          } catch (e) {
            reject(e);
          }
        });
      });
    };
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/race", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/race";
  var Promise = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise").default;
  var $__default = function race(array, label) {
    return Promise.race(array, label);
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/reject", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/reject";
  var Promise = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise").default;
  var $__default = function reject(reason, label) {
    return Promise.reject(reason, label);
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/resolve", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/resolve";
  var Promise = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise").default;
  var $__default = function resolve(value, label) {
    return Promise.resolve(value, label);
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/rethrow", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/rethrow";
  var $__default = function rethrow(reason) {
    setTimeout(function() {
      throw reason;
    });
    throw reason;
  };
  return {get default() {
      return $__default;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp";
  var Promise = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/promise").default;
  var EventTarget = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/events").default;
  var denodeify = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/node").default;
  var all = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/all").default;
  var allSettled = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/all_settled").default;
  var race = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/race").default;
  var hash = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/hash").default;
  var rethrow = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/rethrow").default;
  var defer = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/defer").default;
  var $__21 = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/config"),
      config = $__21.config,
      configure = $__21.configure;
  var map = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/map").default;
  var resolve = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/resolve").default;
  var reject = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/reject").default;
  var filter = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/filter").default;
  var asap = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp/asap").default;
  config.async = asap;
  function async(callback, arg) {
    config.async(callback, arg);
  }
  function on() {
    config.on.apply(config, arguments);
  }
  function off() {
    config.off.apply(config, arguments);
  }
  if (typeof window !== 'undefined' && typeof window.__PROMISE_INSTRUMENTATION__ === 'object') {
    var callbacks = window.__PROMISE_INSTRUMENTATION__;
    configure('instrument', true);
    for (var eventName in callbacks) {
      if (callbacks.hasOwnProperty(eventName)) {
        on(eventName, callbacks[eventName]);
      }
    }
  }
  ;
  return {
    get Promise() {
      return Promise;
    },
    get EventTarget() {
      return EventTarget;
    },
    get all() {
      return all;
    },
    get allSettled() {
      return allSettled;
    },
    get race() {
      return race;
    },
    get hash() {
      return hash;
    },
    get rethrow() {
      return rethrow;
    },
    get defer() {
      return defer;
    },
    get denodeify() {
      return denodeify;
    },
    get configure() {
      return configure;
    },
    get on() {
      return on;
    },
    get off() {
      return off;
    },
    get resolve() {
      return resolve;
    },
    get reject() {
      return reject;
    },
    get async() {
      return async;
    },
    get map() {
      return map;
    },
    get filter() {
      return filter;
    }
  };
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/src/runtime/polyfills/Promise", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/src/runtime/polyfills/Promise";
  var async = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/node_modules/rsvp/lib/rsvp").async;
  function isPromise(x) {
    return x && typeof x === 'object' && x.status_ !== undefined;
  }
  function chain(promise) {
    var onResolve = arguments[1] !== (void 0) ? arguments[1]: (function(x) {
      return x;
    });
    var onReject = arguments[2] !== (void 0) ? arguments[2]: (function(e) {
      throw e;
    });
    var deferred = getDeferred(promise.constructor);
    switch (promise.status_) {
      case undefined:
        throw TypeError;
      case 'pending':
        promise.onResolve_.push([deferred, onResolve]);
        promise.onReject_.push([deferred, onReject]);
        break;
      case 'resolved':
        promiseReact(deferred, onResolve, promise.value_);
        break;
      case 'rejected':
        promiseReact(deferred, onReject, promise.value_);
        break;
    }
    return deferred.promise;
  }
  function getDeferred(C) {
    var result = {};
    result.promise = new C((function(resolve, reject) {
      result.resolve = resolve;
      result.reject = reject;
    }));
    return result;
  }
  var Promise = function Promise(resolver) {
    var $__22 = this;
    this.status_ = 'pending';
    this.onResolve_ = [];
    this.onReject_ = [];
    resolver((function(x) {
      promiseResolve($__22, x);
    }), (function(r) {
      promiseReject($__22, r);
    }));
  };
  ($traceurRuntime.createClass)(Promise, {
    catch: function(onReject) {
      return this.then(undefined, onReject);
    },
    then: function() {
      var onResolve = arguments[0] !== (void 0) ? arguments[0]: (function(x) {
        return x;
      });
      var onReject = arguments[1];
      var $__22 = this;
      var constructor = this.constructor;
      return chain(this, (function(x) {
        x = promiseCoerce(constructor, x);
        return x === $__22 ? onReject(new TypeError): isPromise(x) ? x.then(onResolve, onReject): onResolve(x);
      }), onReject);
    }
  }, {
    resolve: function(x) {
      return new this((function(resolve, reject) {
        resolve(x);
      }));
    },
    reject: function(r) {
      return new this((function(resolve, reject) {
        reject(r);
      }));
    },
    cast: function(x) {
      if (x instanceof this) return x;
      if (isPromise(x)) {
        var result = getDeferred(this);
        chain(x, result.resolve, result.reject);
        return result.promise;
      }
      return this.resolve(x);
    },
    all: function(values) {
      var deferred = getDeferred(this);
      var count = 0;
      var resolutions = [];
      try {
        for (var i = 0; i < values.length; i++) {
          ++count;
          this.cast(values[i]).then(function(i, x) {
            resolutions[i] = x;
            if (--count === 0) deferred.resolve(resolutions);
          }.bind(undefined, i), (function(r) {
            if (count > 0) count = 0;
            deferred.reject(r);
          }));
        }
        if (count === 0) deferred.resolve(resolutions);
      } catch (e) {
        deferred.reject(e);
      }
      return deferred.promise;
    },
    race: function(values) {
      var deferred = getDeferred(this);
      try {
        for (var i = 0; i < values.length; i++) {
          this.cast(values[i]).then((function(x) {
            deferred.resolve(x);
          }), (function(r) {
            deferred.reject(r);
          }));
        }
      } catch (e) {
        deferred.reject(e);
      }
      return deferred.promise;
    }
  });
  function promiseResolve(promise, x) {
    promiseDone(promise, 'resolved', x, promise.onResolve_);
  }
  function promiseReject(promise, r) {
    promiseDone(promise, 'rejected', r, promise.onReject_);
  }
  function promiseDone(promise, status, value, reactions) {
    if (promise.status_ !== 'pending') return;
    for (var i = 0; i < reactions.length; i++) {
      promiseReact(reactions[i][0], reactions[i][1], value);
    }
    promise.status_ = status;
    promise.value_ = value;
    promise.onResolve_ = promise.onReject_ = undefined;
  }
  function promiseReact(deferred, handler, x) {
    async((function() {
      try {
        var y = handler(x);
        if (y === deferred.promise) throw new TypeError; else if (isPromise(y)) chain(y, deferred.resolve, deferred.reject); else deferred.resolve(y);
      } catch (e) {
        deferred.reject(e);
      }
    }));
  }
  var thenableSymbol = '@@thenable';
  function promiseCoerce(constructor, x) {
    if (isPromise(x)) {
      return x;
    } else if (x && typeof x.then === 'function') {
      var p = x[thenableSymbol];
      if (p) {
        return p;
      } else {
        var deferred = getDeferred(constructor);
        x[thenableSymbol] = deferred.promise;
        try {
          x.then(deferred.resolve, deferred.reject);
        } catch (e) {
          deferred.reject(e);
        }
        return deferred.promise;
      }
    } else {
      return x;
    }
  }
  return {get Promise() {
      return Promise;
    }};
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/src/runtime/polyfills/String", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/src/runtime/polyfills/String";
  var $toString = Object.prototype.toString;
  var $indexOf = String.prototype.indexOf;
  var $lastIndexOf = String.prototype.lastIndexOf;
  function startsWith(search) {
    var string = String(this);
    if (this == null || $toString.call(search) == '[object RegExp]') {
      throw TypeError();
    }
    var stringLength = string.length;
    var searchString = String(search);
    var searchLength = searchString.length;
    var position = arguments.length > 1 ? arguments[1]: undefined;
    var pos = position ? Number(position): 0;
    if (isNaN(pos)) {
      pos = 0;
    }
    var start = Math.min(Math.max(pos, 0), stringLength);
    return $indexOf.call(string, searchString, pos) == start;
  }
  function endsWith(search) {
    var string = String(this);
    if (this == null || $toString.call(search) == '[object RegExp]') {
      throw TypeError();
    }
    var stringLength = string.length;
    var searchString = String(search);
    var searchLength = searchString.length;
    var pos = stringLength;
    if (arguments.length > 1) {
      var position = arguments[1];
      if (position !== undefined) {
        pos = position ? Number(position): 0;
        if (isNaN(pos)) {
          pos = 0;
        }
      }
    }
    var end = Math.min(Math.max(pos, 0), stringLength);
    var start = end - searchLength;
    if (start < 0) {
      return false;
    }
    return $lastIndexOf.call(string, searchString, start) == start;
  }
  function contains(search) {
    if (this == null) {
      throw TypeError();
    }
    var string = String(this);
    var stringLength = string.length;
    var searchString = String(search);
    var searchLength = searchString.length;
    var position = arguments.length > 1 ? arguments[1]: undefined;
    var pos = position ? Number(position): 0;
    if (isNaN(pos)) {
      pos = 0;
    }
    var start = Math.min(Math.max(pos, 0), stringLength);
    return $indexOf.call(string, searchString, pos) != - 1;
  }
  function repeat(count) {
    if (this == null) {
      throw TypeError();
    }
    var string = String(this);
    var n = count ? Number(count): 0;
    if (isNaN(n)) {
      n = 0;
    }
    if (n < 0 || n == Infinity) {
      throw RangeError();
    }
    if (n == 0) {
      return '';
    }
    var result = '';
    while (n--) {
      result += string;
    }
    return result;
  }
  function codePointAt(position) {
    if (this == null) {
      throw TypeError();
    }
    var string = String(this);
    var size = string.length;
    var index = position ? Number(position): 0;
    if (isNaN(index)) {
      index = 0;
    }
    if (index < 0 || index >= size) {
      return undefined;
    }
    var first = string.charCodeAt(index);
    var second;
    if (first >= 0xD800 && first <= 0xDBFF && size > index + 1) {
      second = string.charCodeAt(index + 1);
      if (second >= 0xDC00 && second <= 0xDFFF) {
        return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
      }
    }
    return first;
  }
  function raw(callsite) {
    var raw = callsite.raw;
    var len = raw.length >>> 0;
    if (len === 0) return '';
    var s = '';
    var i = 0;
    while (true) {
      s += raw[i];
      if (i + 1 === len) return s;
      s += arguments[++i];
    }
  }
  function fromCodePoint() {
    var codeUnits = [];
    var floor = Math.floor;
    var highSurrogate;
    var lowSurrogate;
    var index = - 1;
    var length = arguments.length;
    if (!length) {
      return '';
    }
    while (++index < length) {
      var codePoint = Number(arguments[index]);
      if (!isFinite(codePoint) || codePoint < 0 || codePoint > 0x10FFFF || floor(codePoint) != codePoint) {
        throw RangeError('Invalid code point: ' + codePoint);
      }
      if (codePoint <= 0xFFFF) {
        codeUnits.push(codePoint);
      } else {
        codePoint -= 0x10000;
        highSurrogate = (codePoint >> 10) + 0xD800;
        lowSurrogate = (codePoint % 0x400) + 0xDC00;
        codeUnits.push(highSurrogate, lowSurrogate);
      }
    }
    return String.fromCharCode.apply(null, codeUnits);
  }
  return {
    get startsWith() {
      return startsWith;
    },
    get endsWith() {
      return endsWith;
    },
    get contains() {
      return contains;
    },
    get repeat() {
      return repeat;
    },
    get codePointAt() {
      return codePointAt;
    },
    get raw() {
      return raw;
    },
    get fromCodePoint() {
      return fromCodePoint;
    }
  };
});
$traceurRuntime.ModuleStore.registerModule("traceur-runtime@0.0.20/src/runtime/polyfills/polyfills", function() {
  "use strict";
  var __moduleName = "traceur-runtime@0.0.20/src/runtime/polyfills/polyfills";
  var Promise = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/src/runtime/polyfills/Promise").Promise;
  var $__25 = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/src/runtime/polyfills/String"),
      codePointAt = $__25.codePointAt,
      contains = $__25.contains,
      endsWith = $__25.endsWith,
      fromCodePoint = $__25.fromCodePoint,
      repeat = $__25.repeat,
      raw = $__25.raw,
      startsWith = $__25.startsWith;
  var $__25 = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/src/runtime/polyfills/ArrayIterator"),
      entries = $__25.entries,
      keys = $__25.keys,
      values = $__25.values;
  function maybeDefineMethod(object, name, value) {
    if (!(name in object)) {
      Object.defineProperty(object, name, {
        value: value,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }
  }
  function maybeAddFunctions(object, functions) {
    for (var i = 0; i < functions.length; i += 2) {
      var name = functions[i];
      var value = functions[i + 1];
      maybeDefineMethod(object, name, value);
    }
  }
  function polyfillPromise(global) {
    if (!global.Promise) global.Promise = Promise;
  }
  function polyfillString(String) {
    maybeAddFunctions(String.prototype, ['codePointAt', codePointAt, 'contains', contains, 'endsWith', endsWith, 'startsWith', startsWith, 'repeat', repeat]);
    maybeAddFunctions(String, ['fromCodePoint', fromCodePoint, 'raw', raw]);
  }
  function polyfillArray(Array, Symbol) {
    maybeAddFunctions(Array.prototype, ['entries', entries, 'keys', keys, 'values', values]);
    if (Symbol && Symbol.iterator) {
      Object.defineProperty(Array.prototype, Symbol.iterator, {
        value: values,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }
  }
  function polyfill(global) {
    polyfillPromise(global);
    polyfillString(global.String);
    polyfillArray(global.Array, global.Symbol);
  }
  polyfill(this);
  var setupGlobals = $traceurRuntime.setupGlobals;
  $traceurRuntime.setupGlobals = function(global) {
    setupGlobals(global);
    polyfill(global);
  };
  return {};
});
var $__27 = $traceurRuntime.getModuleImpl("traceur-runtime@0.0.20/src/runtime/polyfills/polyfills");
