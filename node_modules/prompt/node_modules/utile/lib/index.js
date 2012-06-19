/*
 * index.js: Top-level include for the `utile` module.
 *
 * (C) 2011, Nodejitsu Inc.
 * MIT LICENSE
 *
 */

var fs = require('fs'),
    path = require('path'),
    util = require('util');

var utile = module.exports;

//
// Extend the `utile` object with all methods from the
// core node `util` methods.
//
Object.keys(util).forEach(function (key) {
  utile[key] = util[key];
});

//
// ### function async
// Simple wrapper to `require('async')`.
//
utile.__defineGetter__('async', function () {
  delete utile.async;
  return utile.async = require('async');
});

//
// ### function inflect
// Simple wrapper to `require('i')`.
//
utile.__defineGetter__('inflect', function () {
  delete utile.inflect;
  return utile.inflect = require('i')();
});

//
// ### function mkdirp
// Simple wrapper to `require('mkdirp')`
//
utile.__defineGetter__('mkdirp', function () {
  delete utile.mkdirp;
  return utile.mkdirp = require('mkdirp');
});

//
// ### function rimraf
// Simple wrapper to `require('rimraf')`
//
utile.__defineGetter__('rimraf', function () {
  delete utile.rimraf;
  return utile.rimraf = require('rimraf');
});

//
// ### function cpr
// Simple wrapper to `require('ncp').ncp`
//
utile.__defineGetter__('cpr', function () {
  delete utile.cpr;
  return utile.cpr = require('ncp').ncp;
});

//
// ### @file {Object}
// Lazy-loaded `file` module
//
utile.__defineGetter__('file', function () {
  delete utile.file;
  return utile.file = require('./file');
});

//
// ### @args {Object}
// Lazy-loaded `args` module
//
utile.__defineGetter__('args', function () {
  delete utile.args;
  return utile.args = require('./args');
});

//
// ### @base64 {Object}
// Lazy-loaded `base64` object
//
utile.__defineGetter__('base64', function () {
  delete utile.base64;
  return utile.base64 = require('./base64');
});

//
// ### function rargs(_args)
// #### _args {Arguments} Original function arguments
//
// Top-level method will accept a javascript "arguments" object 
// (the actual keyword "arguments" inside any scope) and return
// back an Array.
//
utile.rargs = function (_args, slice) {
  if (!slice) {
    slice = 0;
  }
  
  var len = (_args || []).length,
      args = new Array(len - slice),
      i;
  
  //
  // Convert the raw `_args` to a proper Array.
  //
  for (i = slice; i < len; i++) {
    args[i - slice] = _args[i];
  }
  
  return args;
};

//
// ### function each (obj, iterator)
// #### @obj {Object} Object to iterate over
// #### @iterator {function} Continuation to use on each key. `function (value, key, object)`
// Iterate over the keys of an object.
//
utile.each = function (obj, iterator) {
  Object.keys(obj).forEach(function (key) {
    iterator(obj[key], key, obj);
  });
};

//
// ### function find (o)
//
//
utile.find = function (obj, pred) {
  var value, key;

  for (key in obj) {
    value = obj[key];
    if (pred(value, key)) {
      return value;
    }
  }
};

//
// ### function createPath (obj, path, value)
// ### @obj {Object} Object to insert value into
// ### @path {Array} List of nested keys to insert value at
// Retreives a value from given Object, `obj`, located at the
// nested keys, `path`.
//
utile.path = function (obj, path) {
  var key, i;

  for (i in path) {
    if (typeof obj === 'undefined') {
      return undefined;
    }

    key = path[i];
    obj = obj[key];
  }

  return obj;
};

//
// ### function createPath (obj, path, value)
// ### @obj {Object} Object to insert value into
// ### @path {Array} List of nested keys to insert value at
// ### @value {*} Value to insert into the object.
// Inserts the `value` into the given Object, `obj`, creating
// any keys in `path` along the way if necessary.
//
utile.createPath = function (obj, path, value) {
  var key, i;

  for (i in path) {
    key = path[i];
    if (!obj[key]) {
      obj[key] = ((+i + 1 === path.length) ? value : {});
    }

    obj = obj[key];
  }
};

//
// ### function mixin (target [source0, source1, ...])
// Copies enumerable properties from `source0 ... sourceN`
// onto `target` and returns the resulting object.
//
utile.mixin = function (target) {
  utile.rargs(arguments, 1).forEach(function (o) {
    Object.keys(o).forEach(function (attr) {
      var getter = o.__lookupGetter__(attr),
          setter = o.__lookupSetter__(attr);
          
      if (!getter && !setter) {
        target[attr] = o[attr];
      }
      else {
        if (setter) { target.__defineSetter__(attr, setter) }
        if (getter) { target.__defineGetter__(attr, getter) }
      }
    });
  });

  return target;
};


//
// ### function capitalize (str)
// #### @str {string} String to capitalize
// Capitalizes the specified `str`.
//
utile.capitalize = utile.inflect.camelize;

//
// ### function randomString (length)
// #### @length {integer} The number of bits for the random base64 string returned to contain
// randomString returns a pseude-random ASCII string (subset)
// the return value is a string of length ⌈bits/6⌉ of characters
// from the base64 alphabet.
//
utile.randomString = function (length) {
  var chars, rand, i, ret, mod, bits;

  chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  ret = '';
  // standard 4
  mod = 4;
  // default is 16
  bits = length * mod || 64;

  // in v8, Math.random() yields 32 pseudo-random bits (in spidermonkey it gives 53)
  while (bits > 0) {
    // 32-bit integer
    rand = Math.floor(Math.random() * 0x100000000);
    //we use the top bits
    for (i = 26; i > 0 && bits > 0; i -= mod, bits -= mod) {
      ret += chars[0x3F & rand >>> i];
    }
  }

  return ret;
};

//
// ### function filter (object, test)
// #### @obj {Object} Object to iterate over
// #### @pred {function} Predicate applied to each property. `function (value, key, object)`
// Returns an object with properties from `obj` which satisfy
// the predicate `pred`
//
utile.filter = function (obj, pred) {
  var copy = Array.isArray(obj) ? [] : {};
  utile.each(obj, function (val, key) {
    if (pred(val, key, obj)) {
      copy[key] = val;
    }
  });

  return copy;
};

//
// ### function requireDir (directory)
// #### @directory {string} Directory to require
// Requires all files and directories from `directory`, returning an object
// with keys being filenames (without trailing `.js`) and respective values
// being return values of `require(filename)`.
//
utile.requireDir = function (directory) {
  var result = {},
      files = fs.readdirSync(directory);

  files.forEach(function (file) {
    if (file.substr(-3) === '.js') {
      file = file.substr(0, file.length - 3);
    }
    result[file] = require(path.resolve(directory, file));
  });
  return result;
};

//
// ### function requireDirLazy (directory)
// #### @directory {string} Directory to require
// Lazily requires all files and directories from `directory`, returning an
// object with keys being filenames (without trailing `.js`) and respective
// values (getters) being return values of `require(filename)`.
//
utile.requireDirLazy = function (directory) {
  var result = {},
      files = fs.readdirSync(directory);

  files.forEach(function (file) {
    if (file.substr(-3) === '.js') {
      file = file.substr(0, file.length - 3);
    }
    result.__defineGetter__(file, function () {
      delete result[file];
      return result[file] = require(path.resolve(directory, file));
    });
  });
  return result;
};

//
// ### function clone (object, filter)
// #### @object {Object} Object to clone
// #### @filter {Function} Filter to be used
// Shallow clones the specified object.
//
utile.clone = function (object, filter) {
  return Object.keys(object).reduce(filter ? function (obj, k) {
    if (filter(k)) obj[k] = object[k];
    return obj;
  } : function (obj, k) {
    obj[k] = object[k];
    return obj;
  }, {});
};
