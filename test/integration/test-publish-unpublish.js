/**
 * Test description
 * ================
 *
 * - jam publish package-one @ 0.0.1
 * - jam publish package-one @ 0.0.2
 * - jam publish package-one @ 0.0.3
 * - jam unpublish package-one @ 0.0.3, check 0.0.1 and 0.0.2 still there
 * - jam unpublish package-one, check all version removed
 */


var couchdb = require('../../lib/couchdb'),
    logger = require('../../lib/logger'),
    env = require('../../lib/env'),
    utils = require('../utils'),
    async = require('async'),
    http = require('http'),
    path = require('path'),
    ncp = require('ncp').ncp,
    fs = require('fs'),
    _ = require('underscore');


var pathExists = fs.exists || path.exists;


logger.clean_exit = true;

// CouchDB database URL to use for testing
var TESTDB = process.env['JAM_TEST_DB'],
    BIN = path.resolve(__dirname, '../../bin/jam.js'),
    ENV = {JAM_TEST: 'true', JAM_TEST_DB: TESTDB};

if (!TESTDB) {
    throw 'JAM_TEST_DB environment variable not set';
}

// remove trailing-slash from TESTDB URL
TESTDB = TESTDB.replace(/\/$/, '');


exports.setUp = function (callback) {
    // change to integration test directory before running test
    this._cwd = process.cwd();
    process.chdir(__dirname);

    // recreate any existing test db
    couchdb(TESTDB).deleteDB(function (err) {
        if (err && err.error !== 'not_found') {
            return callback(err);
        }
        // create test db
        couchdb(TESTDB).createDB(callback);
    });
};

exports.tearDown = function (callback) {
    // change back to original working directory after running test
    process.chdir(this._cwd);
    // delete test db
    couchdb(TESTDB).deleteDB(callback);
};


exports['publish, unpublish'] = function (test) {
    test.expect(4);
    var pkgone = path.resolve(__dirname, 'fixtures', 'package-one'),
        pkgonev2 = path.resolve(__dirname, 'fixtures', 'package-one-v2'),
        pkgonev3 = path.resolve(__dirname, 'fixtures', 'package-one-v3');

    async.series([
        async.apply(utils.runJam, ['publish', pkgone], {env: ENV}),
        async.apply(utils.runJam, ['publish', pkgonev2], {env: ENV}),
        async.apply(utils.runJam, ['publish', pkgonev3], {env: ENV}),
        async.apply(
            utils.runJam, ['unpublish', 'package-one@0.0.3'], {env: ENV}
        ),
        function (cb) {
            couchdb(TESTDB).get('package-one', function (err, doc) {
                if (err) {
                    return cb(err);
                }
                test.same(Object.keys(doc.versions).sort(), [
                    '0.0.1',
                    '0.0.2'
                ]);
                test.equal(doc.tags.latest, '0.0.2');
                test.equal(doc.name, 'package-one');
                cb();
            });
        },
        async.apply(
            utils.runJam, ['unpublish', 'package-one'], {env: ENV}
        ),
        function (cb) {
            couchdb(TESTDB).get('package-one', function (err, doc) {
                test.equal(err.error, 'not_found');
                cb();
            });
        }
    ],
    test.done);
};
