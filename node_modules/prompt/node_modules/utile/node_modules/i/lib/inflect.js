// Requiring modules

module.exports = function (native) {
  var methods = require('./methods');

  if (native) {
    require('./native')(methods);
  }

  return methods
};
