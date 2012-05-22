/**
 * This module handles the loading of the jamrc files used to configure the
 * behaviour of the command-line tool.
 *
 * @module
 */

var utils = require('./utils'),
    async = require('async'),
    _ = require('underscore')._,
    path = require('path'),
    env = require('./env');


/**
 * Default paths to lookup when constructing values for jamrc.
 * Paths are checked in order, with later paths overriding the values obtained
 * from earlier ones.
 */

exports.PATHS = [
    //'/etc/jamrc',
    //'/usr/local/etc/jamrc',
    env.home + '/.jamrc'
];

/**
 * The defaults jamrc settings
 */

exports.DEFAULTS = {
    package_repositories: [
        "http://packages.jamjs.org"
    ],
    task_repositories: [
        "http://tasks.jamjs.org"
    ]
};


/**
 * Loads jamrc settings from PATHS, and merges them along with the DEFAULT
 * values, returning the result.
 *
 * @param {Function} callback
 */

exports.load = function (callback) {
    async.map(exports.PATHS, exports.loadFile, function (err, results) {
        var defaults = _.clone(exports.DEFAULTS);
        var settings = results.reduce(function (merged, r) {
            return exports.merge(merged, r);
        }, defaults);
        callback(null, settings);
    });
};


/**
 * Deep merge for JSON objects, overwrites conflicting properties
 *
 * @param {Object} a
 * @param {Object} b
 * @returns {Object}
 */

exports.merge = function (a, b) {
    if (!b) {
        return a;
    }
    for (var k in b) {
        if (Array.isArray(b[k])) {
            a[k] = b[k];
        }
        else if (typeof b[k] === 'object') {
            if (typeof a[k] === 'object') {
                exports.merge(a[k], b[k]);
            }
            else if (b.hasOwnProperty(k)) {
                a[k] = b[k];
            }
        }
        else if (b.hasOwnProperty(k)) {
            a[k] = b[k]
        }
    }
    return a;
};


/**
 * Checks a jamrc file exists and loads it if available. If the file does not
 * exist the function will respond with an empty object.
 *
 * @param {String} p - the path of the jamrc file to load
 * @param {Function} callback
 */

exports.loadFile = function (p, callback) {
    path.exists(p, function (exists) {
        if (exists) {
            try {
                var mod = require(utils.abspath(p));
            }
            catch (e) {
                return callback(e);
            }
            callback(null, mod);
        }
        else {
            callback(null, {});
        }
    });
};

/**
 * Extend currently loaded settings with another .jamrc file. Used by commands
 * specific to a project directory that would like to load project-specific
 * settings.
 */

exports.extend = function (settings, path, callback) {
    exports.loadFile(path, function (err, s) {
        if (err) {
            return callback(err);
        }
        exports.merge(settings, s);
        callback(null, settings);
    });
};
