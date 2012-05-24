/**
 * Module dependencies
 */

var path = require('path'),
    fs = require('fs'),
    async = require('async'),
    install = require('./install'),
    utils = require('../utils'),
    rimraf = require('rimraf'),
    settings = require('../settings'),
    project = require('../project'),
    tree = require('../tree');
    logger = require('../logger'),
    argParse = require('../args').parse,
    _ = require('underscore/underscore')._;


/**
 * Usage information and docs
 */

exports.summary = 'Removes unused packages from the package directory';


exports.usage = '' +
'jam clean [PATH]\n' +
'\n' +
'Parameters:\n' +
'  PATH    Optional project directory to read dependencies from\n' +
'          (defaults to ".")\n' +
'\n' +
'Options:\n' +
'  --package-dir  Package directory (defaults to "PATH/jam")';


/**
 * Run function called when "jam clean" command is used
 *
 * @param {Object} settings - the values from .jamrc files
 * @param {Array} args - command-line arguments
 */

exports.run = function (settings, args) {
    var a = argParse(args, {
        'target_dir': {match: '--package-dir', value: true}
    });

    var opt = a.options;
    var dir = a.positional[0] || '.';

    opt.target_dir = opt.target_dir || path.resolve(dir, 'jam');
    exports.clean(dir, opt, function (err) {
        if (err) {
            return logger.error(err);
        }
        logger.end();
    });
};


/**
 * Clean the project directory's dependencies.
 *
 * @param {Array} dir - path to project dir
 * @param {Object} opt - the options object
 * @param {Function} callback
 */

exports.clean = function (dir, opt, callback) {
    exports.unusedDirs(dir, opt, function (err, dirs) {
        if (err) {
            return callback(err);
        }
        if (!dirs.length) {
            // nothing to remove
            return logger.end();
        }
        var reldirs = dirs.map(function (d) {
            return path.relative(dir, d);
        });
        console.log(
            '\n' +
            'The following directories will be REMOVED:\n' +
            '    ' + reldirs.join('\n    ') +
            '\n'
        );
        utils.getConfirmation('Continue', function (err, ok) {
            if (err) {
                return callback(err);
            }
            if (ok) {
                exports.deleteDirs(dirs, function (err) {
                    if (err) {
                        return logger.error(err);
                    }
                    console.log('');
                    logger.end();
                });
            }
            else {
                logger.clean_exit = true;
            }
        });
    });
};


/**
 * Delete multiple directory paths.
 *
 * @param {Array} dirs
 * @param {Function} callback
 */

exports.deleteDirs = function (dirs, callback) {
    async.forEach(dirs, function (d, cb) {
        rimraf(d, cb);
    },
    callback);
};


/**
 * Discover package directories that do not form part of the current
 * package version tree.
 *
 * @param {String} dir - the root package dir
 * @param {Object} opt - the options object
 * @param {Function} callback
 */

exports.unusedDirs = function (dir, opt, callback) {
    project.load(dir, function (err, cfg) {
        if (err) {
            return callback(err);
        }
        var sources = [
            install.dirSource(opt.target_dir)
        ];
        var pkg = {
            config: cfg,
            source: 'root'
        };
        logger.info('Building version tree...');
        tree.build(pkg, sources, function (err, packages) {
            if (err) {
                return callback(err);
            }
            return exports.unusedDirsTree(packages, opt, callback);
        });
    });
};


/**
 * Lists packages in the package dir and compares against the provided
 * version tree, returning the packages not in the tree.
 *
 * @param {Object} packages - version tree
 * @param {Object} opt - options object
 * @param {Function} callback
 */

exports.unusedDirsTree = function (packages, opt, callback) {
    exports.listDirs(opt.target_dir, function (err, dirs) {
        if (err) {
            return callback(err);
        }
        var unused = _.difference(dirs, Object.keys(packages));
        var unused = [];
        var names = Object.keys(packages);
        dirs.forEach(function (d) {
            if (!_.contains(names, path.basename(d))) {
                unused.push(d);
            }
        });
        return callback(null, unused);
    });
};


/**
 * List directories within a directory. Filters out regular files etc.
 *
 * @param {String} dir
 * @param {Function} callback
 */

exports.listDirs = function (dir, callback) {
    fs.readdir(dir, function (err, files) {
        if (err) {
            return callback(err);
        }
        var paths = files.map(function (f) {
            return path.resolve(dir, f);
        });
        async.map(paths, exports.isDir, function (err, results) {
            if (err) {
                return callback(err);
            }
            var dirs = _.compact(results.map(function (d) {
                return d.dir ? d.path: null;
            }));
            return callback(null, dirs);
        });
    });
};


/**
 * Checks if a path is a directory, returns an object containing the
 * checked path and a boolean for whether it's a directory.
 *
 * @param {String} path
 * @param {Function} callback
 */

exports.isDir = function (path, callback) {
    fs.stat(path, function (err, info) {
        if (err) {
            return callback(err);
        }
        return callback(null, {
            path: path,
            dir: info.isDirectory()
        });
    });
};
