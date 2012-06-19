/*
 * utile-test.js: Tests for `utile` module.
 *
 * (C) 2011, Nodejitsu Inc.
 * MIT LICENSE
 *
 */

var assert = require('assert'),
    vows = require('vows'),
    utile = require('../lib');

var obj1, obj2;

obj1 = {
  foo: true,
  bar: {
    bar1: true,
    bar2: 'bar2'
  }
};

obj2 = {
  baz: true,
  buzz: 'buzz'
};

obj2.__defineGetter__('bazz', function () {
  return 'bazz';
});

obj2.__defineSetter__('bazz', function () {
  return 'bazz';
});

obj2.__defineSetter__('wat', function () {
  return 'wat';
});

vows.describe('utile').addBatch({
  "When using utile": {
    "it should have the same methods as the `util` module": function () {
      Object.keys(require('util')).forEach(function (fn) {
        assert.isFunction(utile[fn]);
      });
    },
    "it should have the correct methods defined": function () {
      assert.isFunction(utile.mixin);
      assert.isFunction(utile.clone);
      assert.isFunction(utile.rimraf);
      assert.isFunction(utile.mkdirp);
      assert.isFunction(utile.cpr);
    },
    "the mixin() method": function () {
      var mixed = utile.mixin({}, obj1, obj2);
      assert.isTrue(mixed.foo);
      assert.isObject(mixed.bar);
      assert.isTrue(mixed.baz);
      assert.isString(mixed.buzz);
      assert.isTrue(!!mixed.__lookupGetter__('bazz'));
      assert.isTrue(!!mixed.__lookupSetter__('bazz'));
      assert.isTrue(!!mixed.__lookupSetter__('wat'));
      assert.isString(mixed.bazz);
    },
    "the clone() method": function () {
      var clone = utile.clone(obj1);
      assert.isTrue(clone.foo);
      assert.isObject(clone.bar);
      assert.notStrictEqual(obj1, clone);
    },
    "the createPath() method": function () {
      var x = {},
          r = Math.random();

      utile.createPath(x, ['a','b','c'], r)
      assert.equal(x.a.b.c, r)
    },
    "the capitalize() method": function () {
      assert.isFunction(utile.capitalize);
      assert.equal(utile.capitalize('bullet'), 'Bullet');
      assert.equal(utile.capitalize('bullet_train'), 'BulletTrain');
    }
  }
}).export(module);

