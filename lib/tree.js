/**
 * Manages version trees according to range requirements and available
 * version sets
 */

var async = require('async'),
    versions = require('./versions'),
    logger = require('./logger'),
    _ = require('underscore');


function Range(range, source) {
    this.range = range;
    this.source = source;
}

Range.prototype.valueOf = function() {
    return this.range;
};

Range.prototype.isTranslated = function() {
    return this.range === this.source;
};

Range.prototype.toString = function() {
    return this.isTranslated() ? this.range : (this.range + ' ( <- ' + this.source + ' )' );
};

function Path(parents, name) {
    this.parents = parents;
    this.name = name;
    this.enabled = true;
}

Path.prototype.toString = function() {
    return this.getDir() + "/" + this.name;
};

Path.prototype.getDir = function() {
    return this.parents.join("/");
};

Path.prototype.disable = function() {
    return this.enabled = false;
};

function Requirement(path, range) {
    this.path = path;
    this.range = range;
    this.enabled = true;
}

Requirement.prototype.isEnabled = function() {
    return this.enabled;
};

Requirement.prototype.disable = function() {
    this.enabled = false;
};

Requirement.prototype.toString = function() {
    return this.path.toString() + '@' + this.range.toString();
};

function getActiveRequirements(requirements) {
    return _.filter(requirements, function(requirement) {
        return requirement.isEnabled();
    });
}

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
 * @param {Array} translators
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
 *     requirements: Requirement[]
 *   },
 *   bar: {
 *     versions: {
 *         '0.0.1': {config: <package.json>, source: <source>}
 *     },
 *     current_version: '0.0.1',
 *     requirements: Requirement[]
 *   }
 * }
 */

exports.build = function (pkg, sources, translators, callback) {
    exports.extend([], pkg, sources, translators, {}, callback);
};


/**
 * Extends a version tree with new information when a new package is added or
 * a package version changes.
 *
 * @param {Array} parents
 * @param {Object} pkg - package.json values for the updated package
 * @param {Array} sources - an array of source functions (see exports.build)
 * @param {Array} translators
 * @param {Object} packages - the existing version tree to extend
 * @param {Function} callback
 * @param {boolean} isInner
 */

exports.extend = function (parents, pkg, sources, translators, packages, callback, isInner) {
    var name, version;

    if (pkg.source !== 'root') {
        name = pkg.config.name;
        version = pkg.config.version;

        if (!packages[name]) {
            packages[name] = exports.createPackage();
        }

        exports.addVersion(packages[name], _.extend({ version: version }, pkg), pkg.priority);
        packages[name].current_version = version;
    }

    var cfg = pkg.config;

    var depobj = {};

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
        function (name, next) {
            var range;

            range = depobj[name];

            async.waterfall(
                [
                    function(next) {
                        var translator, translation, index;

                        index = 0;

                        async.whilst(
                            function() {
                                return (translator = translators[index]) && !translation;
                            },
                            function(next) {
                                function done() {
                                    index++;
                                    next.apply(null, arguments);
                                }

                                translator.call(null, { range: range, name: name }, function(err, result) {
                                    if (err) {
                                        return done(err);
                                    }

                                    if (result) {
                                        translation = result;
                                        logger.verbose("tree", 'translation: "' + range + '" -> ' + result);
                                    }

                                    done();
                                });
                            },
                            function(err) {
                                if (err) {
                                    return next(err);
                                }

                                next(null, translation || range);
                            }
                        );
                    },
                    function(translation, next) {
                        exports.addDependency(
                            parents.concat(pkg.config.name), // parents path
                            pkg.config.name, // parent name
                            name,            // dependency name
                            range,       // dependency version range
                            translation,     // dependency version range
                            sources,         // package sources
                            translators,     // package sources
                            packages,        // version tree
                            next             // callback
                        );
                    }
                ],
                next
            );
        },
        function (err) {
            if (isInner) {
                return callback(err, packages);
            }

            if (err) {
                return callback(err);
            }

            try {
                _.forEach(packages, function(dep, name) {
                    var current, warn;

                    if ( !(current = dep.current_version) ) {
                        throw exports.dependencyError(name, dep);
                    }

                    warn = versions.equalButNotMeta(current, _.pluck(getActiveRequirements(dep.requirements), "range"));

                    if (!_.isEmpty(warn)) {
                        logger.warning("Compatible version for package \"" + name + "\" was found as " + current + ", but requested " + warn.join(", "));
                    }
                });
            } catch (err) {
                return callback(err);
            }

            return callback(null, packages);
        }
    );
};


/**
 * Add a new dependency to an existing version tree. This will create a new
 * package object in the tree with the provided range then use the source
 * functions to resolve it.
 *
 * @param {Array} parents - the name of the package which depends on this one
 * @param {String} parent - the name of the package which depends on this one
 * @param {String} name - the name of the dependency package
 * @param {String} range - the acceptable version range for the new package
 * @param {String} translation
 * @param {Array} sources - an Array of source functions (see exports.build)
 * @param {Array} translators
 * @param {Object} packages - the version tree object to update
 * @param {Function} cb - callback function
 */

exports.addDependency = function (parents, parent, name, r, translation, sources, translators, packages, cb) {
    var dep, def, sourceIndex, sourcesLength, partialMatch, requirement, path, activeRangesList, activeRequirements;

    if (!(dep = packages[name])) {
        dep = packages[name] = exports.createPackage();
    }

    path = new Path(parents, name);
    range = new Range(translation, r);
    requirement = new Requirement(path, range);

    dep.requirements.push(requirement);

    logger.verbose("tree", 'new requirement: ' + requirement.toString());

    activeRequirements = getActiveRequirements(dep.requirements);
    activeRangesList = _.pluck(activeRequirements, "range");

    // prepare whilst
    sourceIndex = 0;
    sourcesLength = sources.length;
    partialMatch = null;

    def = { name: name, range: r, translation: translation };

    async.whilst(
        function() {
            return ( sourceIndex < sourcesLength ) && !partialMatch;
        },
        function(next) {
            var source;

            source = sources[sourceIndex];

            function done() {
                sourceIndex++;
                next.apply(null, arguments);
            }

            source.call(null, def, function(err, vers) {
                if (err) {
                    done(err);
                    return;
                }

                if (_.isEmpty(vers)) {
                    //logger.verbose("tree", "got no versions for \"" + name + " from source at #" + sourceIndex);
                    return done();
                }

                // find matching version only for current set of versions
                partialMatch = versions.maxSatisfying(_.pluck(vers, "version"), activeRangesList);

                logger.verbose("tree", "got versions for \"" + name + "\" from " + _.pluck(vers, "source")[0] +  ": " + _.pluck(vers, "version").join(", ") + "; active ranges are: " + activeRequirements.join(", ") + "; pre match is " + partialMatch);

                // add new versions to the whole dep
                exports.addVersion(dep, vers, sourceIndex);

                done();
            });
        },
        function(err) {
            var match, matchHighestPriority, prioritizedChain, prioritizedVersions;

            if (err) {
                cb(err);
                return;
            }

            matchHighestPriority = _.chain(dep.versions)
                .filter(function(version) {
                    return versions.satisfiesAll(version.version, activeRangesList);
                })
                .pluck('priority')
                .min()
                .value();

            if (!_.isUndefined(matchHighestPriority)) {
                prioritizedChain = _.chain(dep.versions)
                    .where({ priority: matchHighestPriority });

                prioritizedVersions = prioritizedChain
                    .pluck('version')
                    .value();

                if (!_.isEmpty(prioritizedVersions)) {
                    match = versions.maxSatisfying(
                        prioritizedVersions,
                        activeRangesList
                    );
                }
            }

            if (match) {
                var toDisable = [];
                _.forEach(dep.requirements, function(requirement) {
                    if (requirement.isEnabled() && requirement.path != path) {
                        toDisable.push(requirement.path);
                    }
                });

                _.forEach(packages, function(dep) {
                    _.forEach(toDisable, function(path) {
                        _.forEach(dep.requirements, function(requirement) {
                            if ( requirement.path.getDir() == path.toString() ) {
                                requirement.disable();
                                logger.verbose("tree", 'disabled requirement: ' + requirement.toString());
                            }
                        });
                    });
                });

                logger.verbose("tree", "found match for \"" + name + "\" is \"" + match + "\" from " + prioritizedChain.where({ version: match }).first().result("source").value());

                exports.extend(parents, _.findWhere(dep.versions, { version: match, priority: matchHighestPriority }), sources, translators, packages, function(err) {
                    if (err) {
                        cb(err);
                        return;
                    }

                    cb(null, dep);
                }, true);
            } else {
                dep.current_version = null;
                cb(null, dep);
            }
        }
    );
};


/**
 * Creates a new empty package object for adding to the version tree. The
 * sources array is cloned so it can be manipulated to keep track of
 * un-checked sources for this package.
 *
 * @returns {Object}
 */

exports.createPackage = function() {
    return {
        versions:     [],
        requirements: []
    };
};

/**
 * Adds a version[s] into a pkg available versions. Pushes only unique versions.
 * @param {Object} pkg
 * @param {Object|Array} version
 * @param {number} priority
 */

exports.addVersion = function(pkg, version, priority) {
    var existing, versions;

    existing = pkg.versions;

    if (!_.isArray(versions = version)) {
        versions = [ version ];
    }

    versions = _.chain(versions)
        .filter(function(version) {
            return _.isEmpty(_.where(existing, _.omit(version, "config")));
        })
        .map(function(version) {
            version.priority = priority;
            return version;
        })
        .value();

    existing.push.apply(existing, versions);
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
    var ranges, parent, range;

    if (!dep.versions.length) {
        return new Error("No package for '" + name + "'");
    }

    ranges = _.reduce(getActiveRequirements(dep.requirements), function(str, requirement) {
        str += '\t' + requirement.path.getDir() + ' requires ' + requirement.range.toString() + '\n';
        return str;
    }, '');

    return new Error("No matching version for '" + name + "'\n\n" +
    "Available versions:\n\t" +
    _.pluck(dep.versions, "version").join(", ") + '\n\n' +
    "Requirements:\n" + ranges);
};

exports.Range = Range;
exports.Path = Path;
exports.Requirement = Requirement;
