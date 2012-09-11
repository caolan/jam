/**
 * Test description
 * ================
 *
 * Tests that range requirements for dependencies in package.json are
 * respected.
 *
 * Starting with project with *ranged* deps in package.json
 * - jam publish package-one @ 0.0.1
 * - jam publish package-two @ 0.0.1
 * - jam install, test installation succeeded
 * - jam publish package-one @ 0.0.2
 * - jam publish package-two @ 0.0.2
 * - jam publish package-one @ 0.0.3 // this should not get installed
 * - jam upgrade, test package versions (both @ 0.0.2)
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
        test.expect(6);
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
            async.apply(utils.runJam, ['install'], {env: ENV}),
            function (cb) {
                var cfg = utils.freshRequire(
                    path.resolve(that.project_dir, 'jam', 'require.config')
                );
                var packages = _.sortBy(cfg.packages, function (p) {
                    return p.name;
                });
                test.same(packages, [
                    {
                        name: 'package-one',
                        location: 'jam/package-one'
                    },
                    {
                        name: 'package-two',
                        location: 'jam/package-two',
                        main: 'two.js'
                    }
                ]);
                var p1 = path.resolve(
                    that.project_dir,
                    'jam/package-one/package.json'
                );
                var p1pkg = JSON.parse(fs.readFileSync(p1).toString());
                test.equal(p1pkg.version, '0.0.1');
                var p2 = path.resolve(
                    that.project_dir,
                    'jam/package-two/package.json'
                );
                var p2pkg = JSON.parse(fs.readFileSync(p2).toString());
                test.equal(p2pkg.version, '0.0.1');
                cb();
            },
            async.apply(
                utils.runJam,
                [
                    'publish',
                    path.resolve(__dirname, 'fixtures', 'package-one-v2')
                ],
                {env: ENV}
            ),
            async.apply(
                utils.runJam,
                [
                    'publish',
                    path.resolve(__dirname, 'fixtures', 'package-two-v2')
                ],
                {env: ENV}
            ),
            async.apply(
                utils.runJam,
                [
                    'publish',
                    path.resolve(__dirname, 'fixtures', 'package-one-v3')
                ],
                {env: ENV}
            ),
            function (cb) {
                var args = ['upgrade'];
                utils.runJam(args, {env: ENV}, function (err, stdout, stderr) {
                    if (err) {
                        return cb(err);
                    }
                    var cfg = utils.freshRequire(
                        path.resolve(that.project_dir, 'jam', 'require.config')
                    );
                    var packages= _.sortBy(cfg.packages, function (p) {
                        return p.name;
                    });
                    test.same(cfg.packages, [
                        {
                            name: 'package-one',
                            location: 'jam/package-one'
                        },
                        {
                            name: 'package-two',
                            location: 'jam/package-two',
                            main: 'two.js'
                        }
                    ]);
                    var p1 = path.resolve(
                        that.project_dir,
                        'jam/package-one/package.json'
                    );
                    var p1pkg = JSON.parse(fs.readFileSync(p1).toString());
                    test.equal(p1pkg.version, '0.0.2');
                    var p2 = path.resolve(
                        that.project_dir,
                        'jam/package-two/package.json'
                    );
                    var p2pkg = JSON.parse(fs.readFileSync(p2).toString());
                    test.equal(p2pkg.version, '0.0.2');
                    cb();
                });
            }
        ],
        test.done);
    }

};
