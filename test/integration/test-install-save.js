/**
 * Test description
 * ================
 *
 * Tests that jam install --save adds to package.json
 *
 * Starting with project with *ranged* deps in package.json
 * - jam publish package-one @ 0.0.1
 * - jam publish package-two @ 0.0.1
 * - jam install package-one --save, test package.json updated
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


exports['project with ranged dependencies in package.json'] = {

    setUp: function (callback) {
        this.project_dir = path.resolve(env.temp, 'jamtest-' + Math.random());
        // set current project to empty directory
        ncp('./fixtures/project-rangedeps', this.project_dir, callback);
    },

    /*
    tearDown: function (callback) {
        var that = this;
        // clear current project
        //utils.myrimraf(that.project_dir, callback);
    },
    */

    'publish, install, ls, remove': function (test) {
        test.expect(1);
        var that = this;
        process.chdir(that.project_dir);

        async.series([
            async.apply(
                utils.runJam,
                ['publish', path.resolve(__dirname, 'fixtures', 'package-one')],
                {env: ENV}
            ),
            async.apply(
                utils.runJam,
                ['publish', path.resolve(__dirname, 'fixtures', 'package-two')],
                {env: ENV}
            ),
            async.apply(utils.runJam, ['install', 'package-one', '--save'], {env: ENV}),
            function (cb) {
                fs.readFile(path.resolve(that.project_dir, 'package.json'), function(err, data) {
                    data = JSON.parse(data);

                    test.same(data.jam.dependencies, {
                        "package-one": "0.0.1",
                        "package-two": "<=0.0.2"
                    });
                    cb();
                });
            }
        ],
        test.done);
    }

};

