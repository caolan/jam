var exec = require('child_process').exec,
    couchdb = require('../../lib/couchdb'),
    logger = require('../../lib/logger'),
    env = require('../../lib/env'),
    rimraf = require('rimraf'),
    async = require('async'),
    http = require('http'),
    path = require('path'),
    ncp = require('ncp').ncp,
    fs = require('fs');


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

    tearDown: function (callback) {
        // clear current project
        rimraf(this.project_dir, callback);
    },

    'publish then install': function (test) {
        test.expect(2);
        process.chdir(this.project_dir);
        var pkgone = path.resolve(__dirname, 'fixtures', 'package-one');
        async.series([
            function (cb) {
                var cmd = BIN + ' publish ' + pkgone;
                exec(cmd, {env: ENV}, function (err, stdout, stderr) {
                    if (err) {
                        console.log('Command failed: ' + cmd);
                        console.log(stdout);
                        console.log(stderr);
                    }
                    return cb(err);
                });
            },
            function (cb) {
                var cmd = BIN + ' install package-one';
                exec(cmd, {env: ENV}, function (err, stdout, stderr) {
                    if (err) {
                        console.log('Command failed: ' + cmd);
                        console.log(stdout);
                        console.log(stderr);
                    }
                    return cb(err);
                });
            },
            function (cb) {
                // test that main.js was installed from package
                var a = fs.readFileSync(path.resolve(pkgone, 'main.js'));
                var b = fs.readFileSync(
                    path.resolve(this.project_dir, 'jam/package-one/main.js')
                );
                test.equal(a.toString(), b.toString());

                // make sure the requirejs config includes the new package
                var cfg = require(
                    path.resolve(this.project_dir, 'jam', 'require.config')
                );
                test.same(cfg.packages, [{
                    name: 'package-one',
                    location: 'jam/package-one'
                }]);
                cb();
            }
        ],
        test.done);
    }

};
