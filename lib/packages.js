/**
 * Functions related to the finding, loading and manipulation of Jam packages
 *
 * @module
 */

var settings = require('./settings'),
    versions = require('./versions'),
    async = require('async'),
    logger = require('./logger'),
    utils = require('./utils'),
    path = require('path'),
    fs = require('fs'),
    env = require('./env'),
    semver = require('semver'),
    events = require('events');


var pathExists = fs.exists || path.exists;


/**
 * Resolve the target package and its dependencies, reading the package.json files
 * and adding them to cache object.
 *
 * @param {Object} cache - an object to add packages metadata and path info to
 * @param {String} name - name of package to load
 * @param {String} range - acceptable version range for target package
 * @param {Array} paths - lookup paths for finding packages
 * @param {String} source - the original location for resolving relative paths
 * @param {String} parent - name of the parent package (if any)
 * @param {Function} cb - callback function
 */

exports.readMeta = function (cache, name, range, paths, source, parent, cb) {
    var cached = cache[name] = {
        ready: false,
        ranges: [range],
        parent: parent,
        ev: new events.EventEmitter()
    };
    cached.ev.setMaxListeners(10000);
    exports.resolve(name, range, paths, source, function (err, v, doc, p) {
        if (err) {
            return cb(err);
        }
        cached.path = p;
        settings.load(p, function (err, cfg) {
            cached.cfg = cfg;
            cached.ready = true;
            cached.ev.emit('ready');
            paths = paths.concat([p + '/jam']);
            exports.readMetaDependencies(cache, cache[name], paths, source, cb);
        });
    });
};


/**
 * Read dependencies of a cached package loaded by the readMeta function.
 *
 * @param {Object} cache - an object to add packages metadata and path info to
 * @param {Object} pkg - the cached package object
 * @param {Array} paths - lookup paths for finding packages
 * @param {String} source - the original location for resolving relative paths
 * @param {Function} callback - the callback function
 */

exports.readMetaDependencies = function (cache, pkg, paths, source, callback) {
    var deps = Object.keys(pkg.cfg.dependencies || {});

    async.forEach(deps, function (dep, cb) {
        var range = pkg.cfg.dependencies[dep];

        function testVersion(cached, range) {
            if (!semver.satisfies(cached.cfg.version, range)) {
                return callback(new Error(
                    'Conflicting version requirements for ' +
                    cached.cfg.name + ':\n' +
                    'Version ' + cached.cfg.version + ' loaded by "' +
                    cached.parent + '" but "' + pkg.cfg.name +
                    '" requires ' + range
                ));
            }
        }
        if (cache[dep]) {
            var cached = cache[dep];
            cached.ranges.push(range);
            if (cached.ready) {
                testVersion(cached, range);
                // return loaded copy
                return cb(null, cached);
            }
            else {
                // wait for existing request to load
                cached.ev.on('ready', function () {
                    testVersion(cached, range);
                    return cb(null, cached);
                });
                return;
            }
        }
        else {
            exports.readMeta(
                cache, dep, range, paths, source, pkg.cfg.name, cb
            );
        }
    }, callback);
};


/**
 * Generates an array of possible paths from the package name,
 * source package path and array of package lookup paths (from .jamrc)
 *
 * @param {String} name - the name / path of the package to lookup
 * @param {String} source - the current package that paths are relative to
 * @param {Array} paths - an array of package lookup paths
 * @returns {Array}
 */

exports.resolveCandidates = function (name, source, paths) {
    var candidates = [];
    if ( env.isAbsolute(name) ){
        // absolute path to a specific package directory
        candidates.push(name);
    }
    else if (name[0] === '.') {
        // relative path to a specific package directory
        candidates.push(path.normalize(path.join(source, name)));
    }
    else {
        // just a package name, use lookup paths
        candidates = candidates.concat(paths.map(function (dir) {
            return path.join(dir, name);
        }));
    }
    return candidates;
};


/**
 * Returns an object keyed by version number, containing the path and cfg
 * for each version, giving priority to paths earlier in the candidates list.
 *
 * eg, with candidates = [pathA, pathB], if both paths contained v1 of the
 * package, pathA and the package.json values from that path will be used for
 * that version, because it comes before pathB in the candidates array.
 *
 * @param {Array} candidates - an array of possible package paths
 * @param {Function} callback
 */

exports.availableVersions = function (candidates, callback) {
    var versions = {};
    async.forEach(candidates, function (c, cb) {
        pathExists(path.join(c, 'package.json'), function (exists) {
            if (exists) {
                settings.load(c, function (err, doc) {
                    if (err) {
                        return cb(err);
                    }
                    if (!versions[doc.version]) {
                        versions[doc.version] = {
                            path: c,
                            config: doc,
                            source: 'local'
                        };
                    }
                    cb();
                });
            }
            else {
                cb();
            }
        });
    },
    function (err) {
        callback(err, versions);
    });
};


/**
 * Looks up the path to a specified package, returning an error if not found.
 *
 * @param {String} name - the name / path of the package to lookup
 * @param {String} range - a version or range of versions to match against
 * @param {Array} paths - an array of package lookup paths
 * @param {String} source - the current package that paths are relative to
 * @param {Function} callback
 */

exports.resolve = async.memoize(function (name, ranges, paths, source, callback) {
    if (!Array.isArray(ranges)) {
        ranges = [ranges];
    }
    source = source || process.cwd();

    var candidates = exports.resolveCandidates(name, source, paths);

    exports.availableVersions(candidates, function (err, matches) {
        var e;
        if (err) {
            return callback(err);
        }
        var vers = Object.keys(matches);
        var highest = versions.maxSatisfying(vers, ranges);
        if (highest) {
            var m = matches[highest];
            return callback(null, highest, m.config, m.path);
        }
        if (vers.length) {
            e = new Error(
                "Cannot find package '" + name + "' matching " +
                ranges.join(' && ') + "\n" +
                "Available versions: " + vers.join(', ')
            );
            e.missing = true;
            return callback(e);
        }
        else {
            e = new Error("Cannot find package '" + name + "'");
            e.missing = true;
            return callback(e);
        }
    });
});
