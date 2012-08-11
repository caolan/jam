/**
 * Public API to Jam features
 */

var jamrc = require('./lib/jamrc'),
    install = require('./lib/commands/install');


// silence logger module
var logger = require('./lib/logger');
logger.level = 'none'
logger.clean_exit = true;


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
    var opt = {};
    jamrc.load(function (err, settings) {
        install.initDir(settings, pdir, opt, function (err, opt, cfg) {
            opt = install.extendOptions(pdir, settings, cfg, opt);
            install.installPackages(cfg, names, opt, callback);
        });
    });
};
