/**
 * Manages version trees according to range requirements and available
 * version sets
 */

var semver = require('semver'),
    events = require('events'),
    async = require('async'),
    versions = require('./versions'),
    _ = require('underscore');


/**
 * Build a new version tree.
 *
 * @param {Object} pkg - the values from package.json for the root package
 * @param {Array} sources - and array of functions for getting more available
 *     versions of packages. Source functions accept the package name and a
 *     callback, and should return an object containing package.json values keyed
 *     by version number (see the versions property in the returned version tree
 *     below). Subsequent source functions are only called if the previous
 *     fails to satisfy the version requirements,
 * @param {Function} callback - called when processing is complete, passed an
 *     optional error as the first argument and a version tree as the second.
 *
 * Returned version tree format:
 * {
 *   foo: {
 *     versions: {
 *         '0.0.1': {config: <package.json>, source: <source>},
 *         '0.0.2': {config: <package.json>, source: <source>}
 *     },
 *     current_version: '0.0.2',
 *     ranges: {bar: '>= 0.0.2'}
 *   },
 *   bar: {
 *     versions: {
 *         '0.0.1': {config: <package.json>, source: <source>}
 *     },
 *     current_version: '0.0.1',
 *     ranges: {}
 *   }
 * }
 */

exports.build = function (pkg, sources, callback) {
    var packages = {};
    if (pkg.source !== 'root' && pkg.config.name) {
        packages[pkg.config.name] = exports.createPackage([]);
    }
    exports.extend(pkg, sources, packages, callback);
};


/**
 * Extends a version tree with new information when a new package is added or
 * a package version changes.
 *
 * @param {Object} pkg - package.json values for the updated package
 * @param {Array} sources - an array of source functions (see exports.build)
 * @param {Object} packages - the existing version tree to extend
 * @param {Function} callback
 */

exports.extend = function (pkg, sources, packages, callback) {
    var name = pkg.config.name;
    var version = pkg.config.version;

    if (pkg.source !== 'root') {
        if (!packages[name]) {
            packages[name] = exports.createPackage([]);
        }
        packages[name].versions[version] = pkg;
        packages[name].current_version = version;
    }

    var cfg = pkg.config;

    var depobj = cfg.dependencies;
    if (cfg.browser && cfg.browser.dependencies) {
        depobj = cfg.browser.dependencies;
    }
    if (cfg.jam && cfg.jam.dependencies) {
        depobj = cfg.jam.dependencies;
    }

    var dependencies = Object.keys(depobj || {});

    if (!dependencies.length) {
        return callback(null, packages);
    }
    async.forEach(dependencies, function (dep, cb) {
        exports.addDependency(
            pkg.config.name,    // parent name
            dep,                // dependency name
            depobj[dep],        // dependency version range
            sources,            // package sources
            packages,           // version tree
            cb                  // callback
        );
    },
    function (err) {
        callback(err, packages);
    });
};


/**
 * Add a new dependency to an existing version tree. This will create a new
 * package object in the tree with the provided range then use the source
 * functions to resolve it.
 *
 * @param {String} parent - the name of the package which depends on this one
 * @param {String} name - the name of the dependency package
 * @param {String} range - the acceptable version range for the new package
 * @param {Array} sources - an Array of source functions (see exports.build)
 * @param {Object} packages - the version tree object to update
 * @param {Function} cb - callback function
 */

exports.addDependency = function (parent, name, range, sources, packages, cb) {
    if (!packages[name]) {
        packages[name] = exports.createPackage(sources);
    }
    var dep = packages[name];
    var curr = dep.current_version;
    dep.ranges[parent || '_root'] = range;

    if (!curr || !versions.satisfiesAll(curr, Object.keys(dep.ranges))) {
        var available = Object.keys(dep.versions);
        var ranges = _.values(dep.ranges);
        var match = versions.maxSatisfying(available, ranges);

        if (match) {
            dep.current_version = match;
            exports.extend(dep.versions[match], sources, packages, cb);
        }
        else {
            return exports.updateDep(name, dep, function (err) {
                if (err) {
                    return cb(err);
                }
                // re-run iterator with original args now there are
                // new versions available
                return exports.addDependency(
                    parent, name, range, sources, packages, cb
                );
            });
        }
    }
};


/**
 * Updates a package object in the version tree (in-place) adding new versions
 * from the next available source. If an update is already in progress, it will
 * call the callback once the in-progress one has completed instead of calling
 * the next source function.
 *
 * @param {String} name - the name of the package to find new versions for
 * @param {Object} dep - the package object in the version tree to update
 * @param {Function} callback
 */

exports.updateDep = function (name, dep, callback) {
    if (dep.update_in_progress) {
        return dep.ev.once('update', callback);
    }
    else if (dep.sources.length) {
        var fn = dep.sources.shift();
        if (!dep.ev) {
            dep.ev = new events.EventEmitter();
            dep.ev.setMaxListeners(10000);
        }
        dep.update_in_progress = true;

        return fn(name, function (err, versions) {
            if (err) {
                return callback(err);
            }
            // keep existing versions, only add new ones
            dep.versions = _.extend(versions, dep.versions);

            dep.update_in_progress = false;
            dep.ev.emit('update');
            // re-run iterator with original args now there are
            // new versions available
            return callback();
        });
    }
    else {
        return callback(exports.dependencyError(name, dep));
    }
};


/**
 * Creates a new empty package object for adding to the version tree. The
 * sources array is cloned so it can be manipulated to keep track of
 * un-checked sources for this package.
 *
 * @param {Array} sources - the original array of available source functions
 * @returns {Object}
 */

exports.createPackage = function (sources) {
    return {
        versions: {},
        ranges: {},
        sources: sources.slice()
    };
};


/**
 * Creates a suitable Error when a dependency cannot be met. The error message
 * will list available version numbers and the requirements other packages had
 * if appropriate. The Error object is *returned* not thrown.
 *
 * @param {String} name - the name of the package which failed to resolve
 * @param {Object} dep - the package object from the version tree
 * @returns {Error}
 */

exports.dependencyError = function (name, dep) {
    if (!Object.keys(dep.versions).length) {
        return new Error("No package for '" + name + "'");
    }
    var ranges = '';
    for (var r in dep.ranges) {
        ranges += '\t' + r + ' requires ' + dep.ranges[r] + '\n';
    }
    return new Error("No matching version for '" + name + "'\n\n" +
        "Available versions:\n\t" +
            Object.keys(dep.versions).join(", ") + '\n\n' +
        "Requirements:\n" + ranges);
};
