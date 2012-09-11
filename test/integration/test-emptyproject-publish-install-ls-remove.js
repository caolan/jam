/**
 * Test description
 * ================
 *
 * Starting with an empty project (no package.json)
 * - jam publish package-one
 * - jam publish package-two (depends on package-one)
 * - jam install package-two, test installation succeeded
 * - jam ls, test packages are listed
 * - jam remove package-two, test it's removed
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

    'publish, install, ls, remove': function (test) {
        test.expect(6);
        var that = this;
        process.chdir(that.project_dir);
        var pkgone = path.resolve(__dirname, 'fixtures', 'package-one'),
            pkgtwo = path.resolve(__dirname, 'fixtures', 'package-two');

        async.series([
            async.apply(utils.runJam, ['publish', pkgone], {env: ENV}),
            async.apply(utils.runJam, ['publish', pkgtwo], {env: ENV}),
            async.apply(utils.runJam, ['install', 'package-two'], {env: ENV}),
            function (cb) {
                // test that main.js was installed from package
                var a = fs.readFileSync(path.resolve(pkgone, 'main.js'));
                var b = fs.readFileSync(
                    path.resolve(that.project_dir, 'jam/package-one/main.js')
                );
                test.equal(a.toString(), b.toString());
                var c = fs.readFileSync(path.resolve(pkgtwo, 'two.js'));
                var d = fs.readFileSync(
                    path.resolve(that.project_dir, 'jam/package-two/two.js')
                );
                test.equal(c.toString(), d.toString());

                // make sure the requirejs config includes the new package
                var cfg = utils.freshRequire(
                    path.resolve(that.project_dir, 'jam', 'require.config')
                );
                var packages= _.sortBy(cfg.packages, function (p) {
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
                cb();
            },
            function (cb) {
                utils.runJam(['ls'], function (err, stdout, stderr) {
                    if (err) {
                        return cb(err);
                    }
                    var lines = stdout.replace(/\n$/, '').split('\n');
                    test.same(lines.sort(), [
                        '  package-one \u001b[33m0.0.1\u001b[39m',
                        '  package-two \u001b[33m0.0.1\u001b[39m'
                    ]);
                    cb();
                });
            },
            function (cb) {
                var args = ['remove', 'package-two'];
                utils.runJam(args, function (err, stdout, stderr) {
                    if (err) {
                        return cb(err);
                    }
                    var cfg = utils.freshRequire(
                        path.resolve(that.project_dir, 'jam', 'require.config')
                    );
                    test.same(cfg.packages.sort(), [
                        {
                            name: 'package-one',
                            location: 'jam/package-one'
                        }
                    ]);
                    var p = path.resolve(that.project_dir, 'jam/package-two');
                    pathExists(p, function (exists) {
                        test.ok(!exists, 'package-two directory removed');
                        cb();
                    });
                });
            }
        ],
        test.done);
    }

};
