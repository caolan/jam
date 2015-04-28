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

    exports.extend(pkg, sources, packages, function(err, tree) {
        callback(err, tree);
    });
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
    var name, version;

    if (pkg.source !== 'root') {
        name = pkg.config.name;
        version = pkg.config.version;

        if (!packages[name]) {
            packages[name] = exports.createPackage([]);
        }

        //packages[name].versions.push(pkg);
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

    async.map(
        dependencies,
        function (dep, next) {
            exports.addDependency(
                pkg.config.name,    // parent name
                dep,                // dependency name
                depobj[dep],        // dependency version range
                sources,            // package sources
                packages,           // version tree
                next                // callback
            );
        },
        function (err) {
            callback(err, packages);
        }
    );
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
    var dep, def, sourceIndex, sourcesLength, partialMatch;

    if (!(dep = packages[name])) {
        dep = packages[name] = exports.createPackage(sources);
    }

    dep.ranges[parent || '_root'] = range;

    // prepare whilst
    def = { name: name, range: range };
    sourceIndex = 0;
    sourcesLength = dep.sources.length;
    partialMatch = null;

    async.whilst(
        function() {
            return ( sourceIndex < sourcesLength ) && !partialMatch;
        },
        function(next) {
            var source;

            source = dep.sources[sourceIndex];
            sourceIndex++;

            source.call(null, def, function(err, vers) {
                var existing;

                if (err) {
                    next(err);
                    return;
                }

                // add new versions to the whole dep
                existing = dep.versions;
                existing.push.apply(existing, _.filter(vers, function(version) {
                    return _.isEmpty(_.where(existing, _.omit(version, "version", "config")));
                }));

                // find matching version only for current set of versions
                partialMatch = versions.maxSatisfying(_.pluck(vers, "version"), _.values(dep.ranges));

                next();
            });
        },
        function(err) {
            var match;

            if (err) {
                cb(err);
                return;
            }

            match = versions.maxSatisfying(_.pluck(dep.versions, "version"), _.values(dep.ranges));

            if (match) {
                exports.extend(_.findWhere(dep.versions, { version: match }), sources, packages, function(err) {
                    if (err) {
                        cb(err);
                        return;
                    }

                    cb(null, dep);
                });
            } else {
                cb(exports.dependencyError(name, dep));
            }
        }
    );


    /*if (!(dep = packages[name])) {
     dep = packages[name] = exports.createPackage(sources);
     }

     dep.ranges[parent || '_root'] = range;

     exports.updateDep({name: name, range: range}, dep, function(err, vers) {
     var existing, additional;

     if (err) {
     cb(err);
     return;
     }

     name == "viewer" && console.log('vers', vers);

     // keep existing versions, only add new ones
     existing = dep.versions;
     additional = _.filter(vers, function(def) {
     return _.isEmpty(_.find(existing, _.pick(def, "version", "source")));
     });

     async.forEach(
     additional,
     function(def, next) {
     if (versions.satisfiesAll(def.version, _.values(dep.ranges))) {
     exports.extend(def, sources, packages, next);
     return;
     }

     next();
     },
     function(err) {
     if (err) {
     cb(err);
     return;
     }

     existing.push.apply(existing, additional);

     cb(null, dep);
     }
     );
     });*/

    /*if (!(dep = packages[name])) {
     dep = packages[name] = exports.createPackage(sources);
     }

     curr = dep.current_version;
     dep.ranges[parent || '_root'] = range;

     if (!curr || !versions.satisfiesAll(curr, Object.keys(dep.ranges))) {
     var available, ranges, match;

     available = _.pluck(dep.versions, "version");
     ranges = _.values(dep.ranges);
     match = versions.maxSatisfying(available, ranges);

     if (match) {
     dep.current_version = match;
     exports.extend(_.findWhere(dep.versions, { version: match }), sources, packages, cb);
     }
     else {
     return exports.updateDep({name: name, range: range}, dep, function (err) {
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
     }*/
};


/**
 * Updates a package object in the version tree (in-place) adding new versions
 * from the next available source. If an update is already in progress, it will
 * call the callback once the in-progress one has completed instead of calling
 * the next source function.
 *
 * @param {Object} def - the name and the range of the package to find new versions for
 * @param {Object} dep - the package object in the version tree to update
 * @param {Function} callback
 */

exports.updateDep = function (def, dep, callback) {
    async.map(
        dep.sources,
        function(source, next) {
            source(def, next);
        },
        function(err, versions) {
            var existing, additional;

            if (err) {
                callback(err);
                return;
            }

            // keep existing versions, only add new ones
            existing = dep.versions;
            additional = _.chain(versions)
                .flatten()
                .filter(function(def) {
                    return true;
                    //return _.isEmpty(_.find(existing, _.pick(def, "version", "source")));
                })
                .value();

            existing.push.apply(existing, additional);

            callback(null, additional);
        }
    );


    /*if (dep.update_in_progress) {
     return dep.ev.once('update', callback);
     }
     else if (dep.sources.length) {
     var source = dep.sources.shift();

     if (!dep.ev) {
     dep.ev = new events.EventEmitter();
     dep.ev.setMaxListeners(9999);
     }

     dep.update_in_progress = true;

     return source(def, function (err, versions) {
     var existing;

     if (err) {
     return callback(err);
     }

     // keep existing versions, only add new ones
     existing = dep.versions;
     existing.push.apply(existing, _.filter(versions, function(def) {
     return _.isEmpty(_.find(existing, _.pick(def, "version", "source")));
     }));

     dep.update_in_progress = false;
     dep.ev.emit('update');
     // re-run iterator with original args now there are
     // new versions available
     return callback();
     });
     }
     else {
     return callback(exports.dependencyError(name, dep));
     }*/
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
        versions: [],
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
    if (!dep.versions.length) {
        return new Error("No package for '" + name + "'");
    }
    var ranges = '';
    for (var r in dep.ranges) {
        ranges += '\t' + r + ' requires ' + dep.ranges[r] + '\n';
    }
    return new Error("No matching version for '" + name + "'\n\n" +
    "Available versions:\n\t" +
    _.pluck(dep.versions, "version").join(", ") + '\n\n' +
    "Requirements:\n" + ranges);
};
