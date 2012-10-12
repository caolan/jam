/**
 * Module dependencies
 */

var path = require('path'),
    async = require('async'),
    semver = require('semver'),
    install = require('./install'),
    project = require('../project'),
    tree = require('../tree');
    utils = require('../utils'),
    logger = require('../logger'),
    argParse = require('../args').parse,
    _ = require('underscore');


/**
 * Usage information and docs
 */

exports.summary = 'Upgrades packages to the latest compatible version';


exports.usage = '' +
'jam upgrade [PACKAGES ...]\n' +
'\n' +
'Parameters:\n' +
'  PACKAGES    Names of specific packages to upgrade\n' +
'\n' +
'Options:\n' +
'  -r, --repository   Source repository URL (otherwise uses values in jamrc)\n' +
'  -d, --package-dir  Package directory (defaults to "./jam")';


/**
 * Run function called when "jam upgrade" command is used
 *
 * @param {Object} settings - the values from .jamrc files
 * @param {Array} args - command-line arguments
 */

exports.run = function (settings, args) {
    var a = argParse(args, {
        'repository': {match: ['-r', '--repository'], value: true},
        'target_dir': {match: ['-d', '--package-dir'], value: true},
        'baseurl': {match: ['-b', '--baseurl'], value: true}
    });

    var opt = a.options;
    var deps = a.positional;

    opt.repositories = settings.repositories;
    if (a.options.repository) {
        opt.repositories = [a.options.repository];
        // don't allow package dir .jamrc file to overwrite repositories
        opt.fixed_repositories = true;
    }
    if (process.env.JAM_TEST) {
        if (!process.env.JAM_TEST_DB) {
            throw 'JAM_TEST environment variable set, but no JAM_TEST_DB set';
        }
        opt.repositories = [process.env.JAM_TEST_DB];
        opt.fixed_repositories = true;
    }

    var cwd = process.cwd();
    install.initDir(settings, cwd, opt, function (err, opt, cfg, proj_dir) {
        if (err) {
            return logger.error(err);
        }
        opt = install.extendOptions(proj_dir, settings, cfg, opt);
        exports.upgrade(settings, deps, opt, cfg, function (err) {
            if (err) {
                return logger.error(err);
            }
            logger.end();
        });
    });
};


/**
 * Upgrade the current project directory's dependencies.
 *
 * @param {Array} deps - an optional sub-set of package names to upgrade
 * @param {Object} opt - the options object
 * @param {Function} callback
 */

exports.upgrade = function (settings, deps, opt, cfg, callback) {
    exports.getOutdated(deps, cfg, opt, function (e, changed, local, updated) {
        if (e) {
            return callback(e);
        }
        exports.installChanges(changed, opt, function (err) {
            if (err) {
                return callback(err);
            }
            project.updateRequireConfig(
                opt.target_dir,
                opt.baseurl,
                function (err) {
                    if (err) {
                        return callback(err);
                    }
                    //install.checkUnused(updated, opt, callback);
                    callback();
                }
            );
        });
    });
};


/**
 * Builds a remote and a local copy of the version tree. This is used to compare
 * the installed packages against those that are available in the repositories.
 *
 * @param {Array|null} deps - an optional subset of packages to upgrade
 * @param {Object} cfg - values from package.json for the root package
 * @param {Object} opt - the options object
 * @param {Function} callback
 */

exports.buildTrees = function (deps, cfg, opt, callback) {
    var local_sources = [
        install.dirSource(opt.target_dir),
        install.repoSource(opt.repositories, cfg)
    ];
    var newcfg = utils.convertToRootCfg(cfg);

    utils.listDirs(opt.target_dir, function (err, dirs) {
        if (err) {
            return callback(err);
        }
        // add packages not referenced by package.json, but still inside
        // package dir, to make sure they get upgraded too
        dirs.forEach(function (d) {
            var name = path.basename(d);
            if (!newcfg.dependencies.hasOwnProperty(name)) {
                newcfg.dependencies[name] = null;
            }
        });

        var pkg = {
            config: newcfg,
            source: 'root'
        };
        logger.info('Building local version tree...');
        tree.build(pkg, local_sources, function (err, local) {
            if (err) {
                return callback(err);
            }
            var update_sources = [
                // check remote source first to make sure we get highest version
                install.repoSource(opt.repositories, cfg),
                install.dirSource(opt.target_dir)
            ];
            var dependency_sources = [
                // check local source first to keep local version if possible
                install.dirSource(opt.target_dir),
                install.repoSource(opt.repositories, cfg)
            ];
            if (!deps || !deps.length) {
                // update all packages if none specified
                deps = Object.keys(local);
            }

            var packages = {};
            // add root package
            packages[pkg.config.name] = tree.createPackage([]);
            deps.forEach(function (name) {
                // prep specified dependencies with the update_sources
                packages[name] = tree.createPackage(update_sources);
            });

            logger.info('Building remote version tree...');
            tree.extend(
                pkg, dependency_sources, packages, function (err, updated) {
                    callback(err, local, updated);
                }
            );
        });
    });
};


/**
 * Gets the remote and local version trees, compares the version numbers for
 * each package, and returns a list of packages which have changed.
 *
 * Each objects in the returned list of changed packages have the following
 * properties:
 *
 * - name - the name of the package
 * - version - the new version to be installed
 * - old - the old version to be installed (null if it doesn't currently exist)
 *
 * @param {Object} cfg - the values from package.json for the root package
 * @param {Object} opt - the options object
 * @param {Function} callback
 */

exports.getOutdated = function (deps, cfg, opt, callback) {
    var _ = require('underscore');
    exports.buildTrees(deps, cfg, opt, function (err, local, updated) {
        if (err) {
            return callback(err);
        }
        var all_names = _.uniq(_.keys(local).concat(_.keys(updated)));

        var changed = all_names.map(function (name) {
            var lversion = local[name] ? local[name].current_version: null;
            var uversion = updated[name] ? updated[name].current_version: null;

            if (lversion) {
                var lpkg = local[name].versions[lversion];
                if (lpkg.source === 'repository') {
                    // cannot even satisfy requirements with current package,
                    // this needs re-installing from repositories
                    return {
                        name: name,
                        version: uversion,
                        old: 'not satisfiable'
                    };
                }
            }
            if (!local[name] && updated[name] || lversion !== uversion) {
                return {name: name, version: uversion, old: lversion};
            }
        });
        callback(null, _.compact(changed), local, updated);
    });
};


/**
 * Accepts an array of changed packages and reports the change to the console
 * then installs from the repositories.
 *
 * @param {Array} packages - array of changed packages
 * @param {Object} opt - the options object
 * @param {Function} callback
 */

exports.installChanges = function (packages, opt, callback) {
    async.forEachLimit(packages, 5, function (dep, cb) {
        if (dep.name === '_root') {
            return cb();
        }
        if (!dep.old) {
            logger.info('new package', dep.name + '@' + dep.version);
        }
        else if (semver.lt(dep.old, dep.version)) {
            logger.info(
                'upgrade package',
                dep.name + '@' + dep.old + ' => ' + dep.name + '@' + dep.version
            );
        }
        else if (semver.gt(dep.old, dep.version)) {
            logger.info(
                'downgrade package',
                dep.name + '@' + dep.old + ' => ' + dep.name + '@' + dep.version
            );
        }
        install.installRepo(dep.name, dep.version, opt, cb);
    }, callback);
};
