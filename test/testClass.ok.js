var Person = function Person(name) {
  "use strict";
  this.name = name;
};
($traceurRuntime.createClass)(Person, {hi: function() {
    "use strict";
    return this.name;
  }}, {});
var Man = function Man(name) {
  "use strict";
  $traceurRuntime.superCall(this, $Man.prototype, "constructor", [name]);
};
var $Man = Man;
($traceurRuntime.createClass)(Man, {hi: function() {
    "use strict";
    return 'I am a man and my name is ' + $traceurRuntime.superCall(this, $Man.prototype, "hi", []);
  }}, {}, Person);

//# sourceMappingURL=testClass.ok.map
