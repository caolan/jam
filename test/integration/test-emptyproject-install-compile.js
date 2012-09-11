/**
 * Test description
 * ================
 *
 * Starting with an empty project (no package.json)
 * - jam publish package-one @ 0.0.1
 * - jam publish package-two @ 0.0.1
 * - jam install package-two
 * - jam compile output.js, test both modules included in output.js
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


exports['empty project'] = {

    setUp: function (callback) {
        this.project_dir = path.resolve(env.temp, 'jamtest-' + Math.random());
        // set current project to empty directory
        ncp('./fixtures/project-empty', this.project_dir, callback);
    },

    /*
    tearDown: function (callback) {
        var that = this;
        // timeout to try and wait until dir is no-longer busy on windows
        //utils.myrimraf(that.project_dir, callback);
    },
    */

    'publish, install, upgrade': function (test) {
        test.expect(5);
        var that = this;
        process.chdir(that.project_dir);
        var pkgone = path.resolve(__dirname, 'fixtures', 'package-one'),
            pkgtwo = path.resolve(__dirname, 'fixtures', 'package-two');

        async.series([
            async.apply(utils.runJam, ['publish', pkgone], {env: ENV}),
            async.apply(utils.runJam, ['publish', pkgtwo], {env: ENV}),
            async.apply(
                utils.runJam, ['install', 'package-two'], {env: ENV}
            ),
            async.apply(
                utils.runJam, ['compile', 'output.js'], {env: ENV}
            ),
            function (cb) {
                var content = fs.readFileSync('output.js').toString();
                test.ok(/Package One/.test(content));
                test.ok(/Package Two/.test(content));
                test.ok(/requirejs/.test(content));
                test.ok(/package-one\/main/.test(content));
                test.ok(/package-two\/two/.test(content));
                cb();
            }
        ],
        test.done);
    }

};
