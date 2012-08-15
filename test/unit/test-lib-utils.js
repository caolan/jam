var utils = require('../../lib/utils'),
    path = require('path'),
    fs = require('fs'),
    child_process = require('child_process'),
    logger = require('../../lib/logger');

logger.clean_exit = true;

exports['readJSON - valid'] = function (test) {
    test.expect(2);
    var p = __dirname + '/fixtures/valid_json';
    utils.readJSON(p, function (err, settings) {
        test.ok(!err);
        test.same(settings, {one:1,two:2});
        test.done();
    });
};

exports['readJSON - invalid'] = function (test) {
    test.expect(1);
    var p = __dirname + '/fixtures/invalid_json';
    utils.readJSON(p, function (err, settings) {
        test.ok(err, 'return JSON parsing errors');
        test.done();
    });
};

exports['padRight'] = function (test) {
    // pad strings below min length
    test.equals(utils.padRight('test', 20), 'test                ');
    // don't pad strings equals to min length
    test.equals(utils.padRight('1234567890', 10), '1234567890');
    // don't shorten strings above min length
    test.equals(utils.padRight('123456789012345', 10), '123456789012345');
    test.done();
};
