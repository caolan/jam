var project = require('../../lib/project'),
    path = require('path'),
    fs = require('fs'),
    child_process = require('child_process'),
    logger = require('../../lib/logger');


logger.clean_exit = true;

exports['includeRequireJsConfig - valid - default string'] = function (test) {
    test.equal(project.includeRequireJsConfig({}), '{\n    "packages": jam.packages,\n    "shim": jam.shim,\n}');
    test.done();
};

exports['includeRequireJsConfig - valid - all empty'] = function (test) {
    test.equal(project.includeRequireJsConfig({}), '{\n    "packages": jam.packages,\n    "shim": jam.shim,\n}');    
    test.done();
};

exports['includeRequireJsConfig - valid - no base string'] = function (test) {
    var p = {
      "paths": {
          "templates": "templates"
        }};
    var config_extract = project.includeRequireJsConfig(p, " ");
    
    test.equal(config_extract, '{ \n    "paths": {\n        "templates": "templates"\n    }\n}');
    test.done();
};

exports['includeRequireJsConfig - valid - all combined'] = function (test) {
    var p = {
      "paths": {
          "templates": "templates"
        }};
    var config_extract = project.includeRequireJsConfig(p);
    
    test.equal(config_extract, '{\n    "packages": jam.packages,\n    "shim": jam.shim,\n\n    "paths": {\n        "templates": "templates"\n    }\n}');
    test.done();
};

exports['mergeShim - no conflicts'] = function (test) {
    var jam = { "backbone": { "deps": [ "jquery","lodash" ], "exports": "Backbone"}};
    var shim = project.mergeShim({}, jam);
    test.same(shim, jam);
    test.done();
};


exports['mergeShim - jam wins'] = function (test) {
    var jam = { "backbone": { "deps": [ "jquery","lodash" ], "exports": "Backbone"}};
    var opts = { "backbone": { "deps": [ "XXXXX","YYYYYY" ], "exports": "Backbone"}};
    var shim = project.mergeShim(opts, jam);
    test.same(shim, jam);
    test.done();
};


exports['mergeShim - both used'] = function (test) {
    var jam = {  "backbone": { "deps": [ "jquery","lodash" ], "exports": "Backbone"}};
    var opts = {"jquery": { "deps": ["xxxxx"], "exports": "$"}};
    var shim = project.mergeShim(opts, jam);
    test.same(shim, { jquery: { deps: [ 'xxxxx' ], exports: '$' }, backbone: { deps: [ 'jquery', 'lodash' ], exports: 'Backbone' } });
    test.done();
};

exports['mergeShim - jam is kept'] = function (test) {
    var jam = {};
    var shim = project.mergeShim({}, jam);
    test.same(shim, jam);
    test.done();
};
