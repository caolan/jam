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
    _ = require('underscore');


/**
 * Usage information and docs
 */

exports.summary = 'Removes unused packages from the package directory';


exports.usage = '' +
'jam clean\n' +
'\n' +
'Options:\n' +
'  -d, --package-dir  Package directory (defaults to "PATH/jam")\n' +
'  -f, --force        Do not confirm package removal';


/**
 * Run function called when "jam clean" command is used
 *
 * @param {Object} settings - the values from .jamrc files
 * @param {Array} args - command-line arguments
 */

exports.run = function (settings, args) {
    var a = argParse(args, {
        'target_dir': {match: ['-d', '--package-dir'], value: true},
        'baseurl': {match: ['-b', '--baseurl'], value: true},
        'force': {match: ['-f', '--force']}
    });
    var opt = a.options;
    var cwd = process.cwd();

    install.initDir(settings, cwd, opt, function (err, opt, cfg, proj_dir) {
        if (err) {
            return logger.error(err);
        }

        if (!opt.target_dir) {
            if (cfg.jam && cfg.jam.packageDir) {
                opt.target_dir = path.resolve(proj_dir, cfg.jam.packageDir);
            }
            else {
                opt.target_dir = path.resolve(proj_dir, settings.package_dir || '');
            }
        }
        if (!opt.baseurl) {
            if (cfg.jam && cfg.jam.baseUrl) {
                opt.baseurl = path.resolve(proj_dir, cfg.jam.baseUrl);
            }
            else {
                opt.baseurl = path.resolve(proj_dir, settings.baseUrl || '');
            }
        }

        exports.clean(cwd, opt, function (err) {
            if (err) {
                return logger.error(err);
            }
            logger.end();
        });
    });
};


/**
 * Clean the project directory's dependencies.
 *
 * @param {Object} opt - the options object
 * @param {Function} callback
 */

exports.clean = function (cwd, opt, callback) {
    exports.unusedDirs(cwd, opt, function (err, dirs) {
        if (err) {
            return callback(err);
        }
        if (!dirs.length) {
            // nothing to remove
            return logger.end();
        }
        var reldirs = dirs.map(function (d) {
            return path.relative(opt.taget_dir, d);
        });

        if (opt.force) {
            exports.deleteDirs(dirs, callback);
        }
        else {
            console.log(
                '\n' +
                'The following directories are not required by packages in\n' +
                'package.json and will be REMOVED:\n\n' +
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
                            return callback(err);
                        }
                        project.updateRequireConfig(
                            opt.target_dir,
                            opt.baseurl,
                            callback
                        );
                    });
                }
                else {
                    logger.clean_exit = true;
                }
            });
        }
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
        logger.info('removing', path.basename(d));
        rimraf(d, cb);
    },
    callback);
};


/**
 * Discover package directories that do not form part of the current
 * package version tree.
 *
 * @param {Object} opt - the options object
 * @param {Function} callback
 */

exports.unusedDirs = function (cwd, opt, callback) {
    project.loadPackageJSON(cwd, function (err, cfg) {
        if (err) {
            return callback(err);
        }
        var sources = [
            install.dirSource(opt.target_dir)
        ];
        var newcfg = utils.convertToRootCfg(cfg);
        var pkg = {
            config: newcfg,
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
    utils.listDirs(opt.target_dir, function (err, dirs) {
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
