/**
 * Test description
 * ================
 *
 * Starting with an empty project (no package.json)
 * - jam publish package-one @ 0.0.1
 * - jam publish package-one @ 0.0.2
 * - jam install package-one @ 0.0.1, test installation succeeded
 * - jam upgrade, test package-one is now at 0.0.2
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
        test.expect(4);
        var that = this;
        process.chdir(that.project_dir);
        var pkgone = path.resolve(__dirname, 'fixtures', 'package-one'),
            pkgonev2 = path.resolve(__dirname, 'fixtures', 'package-one-v2');

        async.series([
            async.apply(utils.runJam, ['publish', pkgone], {env: ENV}),
            async.apply(utils.runJam, ['publish', pkgonev2], {env: ENV}),
            async.apply(
                utils.runJam, ['install', 'package-one@0.0.1'], {env: ENV}
            ),
            function (cb) {
                // test that main.js was installed from package
                var a = fs.readFileSync(path.resolve(pkgone, 'main.js'));
                var b = fs.readFileSync(
                    path.resolve(that.project_dir, 'jam/package-one/main.js')
                );
                test.equal(a.toString(), b.toString());

                // make sure the requirejs config includes the new package
                var cfg = utils.freshRequire(
                    path.resolve(that.project_dir, 'jam', 'require.config')
                );
                test.same(cfg.packages, [
                    {
                        name: 'package-one',
                        location: 'jam/package-one'
                    }
                ]);
                cb();
            },
            function (cb) {
                var args = ['upgrade'];
                utils.runJam(args, {env: ENV}, function (err, stdout, stderr) {
                    if (err) {
                        return cb(err);
                    }
                    var cfg = utils.freshRequire(
                        path.resolve(that.project_dir, 'jam', 'require.config')
                    );
                    test.same(cfg.packages, [
                        {
                            name: 'package-one',
                            location: 'jam/package-one'
                        }
                    ]);
                    var p = path.resolve(
                        that.project_dir,
                        'jam/package-one/package.json'
                    );
                    var content = fs.readFileSync(p);
                    var pkg = JSON.parse(content.toString());
                    test.equal(pkg.version, '0.0.2');
                    cb();
                });
            }
        ],
        test.done);
    }

};
