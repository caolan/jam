var http = require('http'),
    couchdb = require('../../lib/couchdb'),
    logger = require('../../lib/logger'),
    utils = require('../utils'),
    path = require('path');


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


exports['publish within package directory'] = function (test) {
    test.expect(1);
    process.chdir('./fixtures/package-one');
    utils.runJam(['publish'], {env: ENV}, function (err, stdout, stderr) {
        if (err) {
            return test.done(err);
        }
        couchdb(TESTDB).get('package-one', function (err, doc) {
            test.equal(doc.name, 'package-one');
            test.done(err);
        });
    });
};

exports['publish path outside package directory'] = function (test) {
    test.expect(1);
    var args = ['publish', path.resolve('fixtures', 'package-one')];
    utils.runJam(args, {env: ENV}, function (err, stdout, stderr) {
        if (err) {
            return test.done(err);
        }
        couchdb(TESTDB).get('package-one', function (err, doc) {
            test.equal(doc.name, 'package-one');
            test.done(err);
        });
    });
};

exports['publish to command-line repo'] = function (test) {
    test.expect(1);
    var args = [
        'publish',
        path.resolve('fixtures', 'package-one'),
        '--repository=' + TESTDB
    ];
    utils.runJam(args, function (err, stdout, stderr) {
        if (err) {
            return test.done(err);
        }
        couchdb(TESTDB).get('package-one', function (err, doc) {
            test.equal(doc.name, 'package-one');
            test.done(err);
        });
    });
};
