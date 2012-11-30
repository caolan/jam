var project = require('../../lib/project'),
    path = require('path'),
    fs = require('fs'),
    child_process = require('child_process'),
    logger = require('../../lib/logger');


logger.clean_exit = true;


exports['includeRequireJsConfig - valid - all empty, default indent 4git st'] = function (test) {
    test.equal(project.includeRequireJsConfig(), '{\n    "package": jam.packages,\n    "shim": jam.shim\n}');    
    test.done();
};

exports['includeRequireJsConfig - valid - default string'] = function (test) {
    test.equal(project.includeRequireJsConfig({}), '{\n    "package": jam.packages,\n    "shim": jam.shim\n}');
    test.done();
};

exports['includeRequireJsConfig - valid - indent size 1'] = function (test) {
    test.equal(project.includeRequireJsConfig({}, {}, 1), '{\n "package": jam.packages,\n "shim": jam.shim\n}');
    test.done();
};

exports['includeRequireJsConfig - valid - no base string'] = function (test) {
    var p = { "paths": {"templates": "templates"}};
    var config_extract = project.includeRequireJsConfig(p, " ", 1);
    
    test.equal(config_extract, '{\n "paths": {\n  "templates": "templates"\n },\n "package": jam.packages,\n "shim": jam.shim\n}');
    test.done();
};

exports['includeRequireJsConfig - valid - all combined'] = function (test) {
    var p = {"paths": {"templates": "templates"}};
    var config_extract = project.includeRequireJsConfig(p, {}, 1);
    
    test.equal(config_extract, '{\n "paths": {\n  "templates": "templates"\n },\n "package": jam.packages,\n "shim": jam.shim\n}');
    test.done();
};

exports['mergeShims - no conflicts'] = function (test) {
    var jam = { "backbone": { "deps": [ "jquery","lodash" ], "exports": "Backbone"}};
    var shim = project.mergeShims({}, jam);
    test.same(shim, jam);
    test.done();
};


exports['mergeShims - jam wins'] = function (test) {
    var jam = { "backbone": { "deps": [ "jquery","lodash" ], "exports": "Backbone"}};
    var opts = { "backbone": { "deps": [ "XXXXX","YYYYYY" ], "exports": "Backbone"}};
    var shim = project.mergeShims(opts, jam);
    test.same(shim, jam);
    test.done();
};


exports['mergeShims - both used'] = function (test) {
    var jam = {  "backbone": { "deps": [ "jquery","lodash" ], "exports": "Backbone"}};
    var opts = {"jquery": { "deps": ["xxxxx"], "exports": "$"}};
    var shim = project.mergeShims(opts, jam);
    test.same(shim, { jquery: { deps: [ 'xxxxx' ], exports: '$' }, backbone: { deps: [ 'jquery', 'lodash' ], exports: 'Backbone' } });
    test.done();
};

exports['mergeShims - jam is kept'] = function (test) {
    var jam = {};
    var shim = project.mergeShims({}, jam);
    test.same(shim, jam);
    test.done();
};
