/**
 * Module dependencies
 */

var path = require('path'),
    async = require('async'),
    rimraf = require('rimraf'),
    install = require('./install'),
    tree = require('../tree'),
    project = require('../project'),
    logger = require('../logger'),
    clean = require('./clean'),
    argParse = require('../args').parse;


/**
 * Usage information and docs
 */

exports.summary = 'Removes a package from the package directory';


exports.usage = '' +
'jam remove PACKAGE [MORE...]\n' +
'\n' +
'Parameters:\n' +
'  PACKAGE    The package to remove\n' +
'\n' +
'Options:\n' +
'  -d, --package-dir  Package directory (defaults to "./jam")';

/* TODO
'  --clean        Runs clean command after removing the package, to remove\n' +
'                 any unused dependencies';
*/


/**
 * Run function called when "jam remove" command is used
 *
 * @param {Object} settings - the values from .jamrc files
 * @param {Array} args - command-line arguments
 */

exports.run = function (settings, args) {
    var a = argParse(args, {
        'target_dir': {match: ['-d', '--package-dir'], value: true},
        'recursive': {match: ['-R', '--recursive']} // runs clean afterwards
    });

    if (a.positional.length < 1) {
        console.log(exports.usage);
        logger.clean_exit = true;
        return;
    }

    var opt = a.options;
    opt.target_dir = opt.target_dir || path.resolve(settings.package_dir);

    install.initDir(opt, function (err, opt, cfg) {
        if (err) {
            return callback(err);
        }
        var names = a.positional;
        exports.checkDependants(settings, cfg, opt, names, function (err) {
            if (err) {
                return logger.error(err);
            }
            async.series({
                remove: async.apply(
                    async.forEach, names, async.apply(exports.remove, cfg, opt)
                ),
                tree: async.apply(exports.buildLocalTree, settings, cfg, opt)
            },
            function (err, results) {
                if (err) {
                    return logger.error(err);
                }
                var packages = results.tree;
                async.series([
                    async.apply(exports.reportUnused, packages, opt),
                    async.apply(project.writeMeta, opt.target_dir, cfg),
                    async.apply(
                        project.updateRequireConfig,
                        opt.target_dir,
                        packages
                    ),
                    async.apply(exports.cleanUp, opt)
                ],
                function (err) {
                     if (err) {
                         return logger.error(err);
                     }
                     logger.end();
                });
            });
        });
    });
};


exports.checkDependants = function (settings, cfg, opt, names, callback) {
    exports.buildLocalTree(settings, cfg, opt, function (err, packages) {
        if (err) {
            return callback(err);
        }
        var has_dependants = false;
        for (var i = 0; i < names.length; i++) {
            var name = names[i];
            var pkg = packages[name];
            if (pkg) {
                var ranges = packages[name].ranges;
                var dependants = Object.keys(ranges).filter(function (d) {
                    return d !== '_root' && names.indexOf(d) === -1;
                });
                if (dependants.length) {
                    for (var j = 0; j < dependants.length; j++) {
                        var d = dependants[j];
                        logger.error(
                            d + ' depends on ' + name + ' ' + ranges[d]
                        );
                    };
                    has_dependants = true;
                }
            }
        };
        if (has_dependants) {
            return callback('Cannot remove package with dependants');
        }
        return callback();
    });
};


exports.remove = function (cfg, opt, name, callback) {
    logger.info('removing', name);
    delete cfg.dependencies[name];
    rimraf(path.resolve(opt.target_dir, name), callback);
};


exports.buildLocalTree = function (settings, cfg, opt, callback) {
    var local_sources = [
        install.dirSource(opt.target_dir),
        install.repoSource(settings.repositories, cfg)
    ];
    var newcfg = _.extend({name: '_root'}, cfg);
    var pkg = {
        config: newcfg,
        source: 'root'
    };
    logger.info('Building local version tree...');
    tree.build(pkg, local_sources, callback);
};


exports.reportUnused = function (packages, opt, callback) {
    if (!opt.recursive) {
        install.checkUnused(packages, opt, callback);
    }
    else {
        callback();
    }
};

exports.cleanUp = function (opt, callback) {
    if (opt.recursive) {
        clean.clean({
            target_dir: opt.target_dir,
            force: true
        }, callback);
    }
    else {
        callback();
    }
};
