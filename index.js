/**
 * Public API to Jam features
 */

var ls = require('./lib/commands/ls'),
    install = require('./lib/commands/install'),
    upgrade = require('./lib/commands/upgrade'),
    remove = require('./lib/commands/remove'),
    logger = require('./lib/logger'),
    jamrc = require('./lib/jamrc'),
    path = require('path');


// silence logger module by default
logger.level = 'error';
logger.clean_exit = true;


/**
 * Set log-level, by default only errors not passed back to api callbacks are
 * logged. If you'd like more console output, call this function beforehand.
 *
 * Levels:
 *
 *   error
 *   warning
 *   info
 *   debug
 *
 * @param {String} level
 */

exports.logLevel = function (level) {
    logger.level = level;
};


/**
 * Compiles packages into a single file for production use.
 *
 * Options:
 *  cwd             String      working directory (defaults to process.cwd())
 *  settings        Object      values from jamrc (optional)
 *  includes        [String]    array of require paths to include in build
 *  shallowExcludes [String]    exclude these modules (not their dependencies)
 *  deepExcludes    [String]    exclude these modules AND their dependencies
 *  output          String      filename to save output to
 *  pkgdir          String      location of jam packages
 *  baseurl         String      base url value to pass to requirejs optimizer
 *  wrap            Bool        wraps output in anonymous function
 *  almond          Bool        uses almond shim
 *  verbose         Bool        more verbose output from r.js
 *  nominify        Bool        don't minify with uglifyjs
 *  nolicense       Bool        strip license comments
 *
 * @param {Object} options
 * @param {Function} callback(err, build_response)
 */

exports.compile = require('./lib/commands/compile').compile;


/**
 * Install a package using the appropriate settings for the project directory.
 * Reads values from .jamrc and package.json to install to the correct
 * directory.
 *
 * @param {String} pdir - the project directory (where package.json is)
 * @param {String|Array} names - the package(s) to install
 * @param {Function} callback(err)
 */

exports.install = function (pdir, names, callback) {
    if (!Array.isArray(names)) {
        names = [names];
    }
    jamrc.load(function (err, settings) {
        var opt = {repositories: settings.repositories};

        install.initDir(settings, pdir, opt, function (err, opt, cfg) {
            opt = install.extendOptions(pdir, settings, cfg, opt);
            install.installPackages(cfg, names, opt, callback);
        });
    });
};


/**
 * Upgrades all or specified packages for the provided project. Reads values
 * from .jamrc and package.json to find the package directory and repositories.
 *
 * @param {String} pdir - the project directory (where package.json is)
 * @param {String|Array} names - specific package(s) to upgrade (optional)
 * @param {Function} callback(err)
 */

exports.upgrade = function (pdir, /*optional*/names, callback) {
    if (!callback) {
        callback = names;
        names = null;
    }
    if (names && !Array.isArray(names)) {
        names = [names];
    }
    jamrc.load(function (err, settings) {
        var opt = {repositories: settings.repositories};

        install.initDir(settings, pdir, opt, function (err, opt, cfg) {
            opt = install.extendOptions(pdir, settings, cfg, opt);
            upgrade.upgrade(settings, names, opt, cfg, callback);
        });
    });
};


/**
 * Removes specified packages from the project's package directory. Reads values
 * from .jamrc and package.json to find the package directory.
 *
 * @param {String} pdir - the project directory (where package.json is)
 * @param {String|Array} names - the package(s) to remove
 * @param {Function} callback(err)
 */

exports.remove = function (pdir, names, callback) {
    if (!Array.isArray(names)) {
        names = [names];
    }
    jamrc.load(function (err, settings) {
        install.initDir(settings, pdir, opt, function (err, opt, cfg) {
            opt = install.extendOptions(pdir, settings, cfg, opt);
            remove.remove(settings, cfg, opt, names, callback);
        });
    });
};





/**
 * Lists installed packages for the given project. The callback gets the
 * output that would normally be printed to the terminal and an array of
 * package objects (representing the values from each package's package.json
 * file).
 *
 * @param {String} pdir - the project directory (where package.json is)
 * @param {Function} callback(err, output, packages)
 */

exports.ls = function (pdir, callback) {
    jamrc.load(function (err, settings) {
        var opt = {};
        install.initDir(settings, pdir, opt, function (err, opt, cfg) {
            var package_dir = path.resolve(pdir, settings.package_dir);
            if (cfg.jam && cfg.jam.packageDir) {
                package_dir = path.resolve(pdir, cfg.jam.packageDir);
            }
            ls.ls(settings, cfg, package_dir, callback);
        });
    });
};
