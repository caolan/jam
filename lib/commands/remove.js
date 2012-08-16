/**
 * Module dependencies
 */

var path = require('path'),
    async = require('async'),
    rimraf = require('rimraf'),
    install = require('./install'),
    tree = require('../tree'),
    utils = require('../utils'),
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
        'target_dir': {match: ['-d', '--package-dir'], value: true}
    });

    if (a.positional.length < 1) {
        console.log(exports.usage);
        logger.clean_exit = true;
        return;
    }

    var opt = a.options;
    var cwd = process.cwd();

    install.initDir(settings, cwd, opt, function (err, opt, cfg, proj_dir) {
        if (err) {
            return logger.error(err);
        }

        opt = install.extendOptions(proj_dir, settings, cfg, opt);

        var names = a.positional;
        exports.remove(settings, cfg, opt, names, function (err) {
            if (err) {
                return logger.error(err);
            }
            logger.end();
        });
    });
};


exports.remove = function (settings, cfg, opt, names, callback) {
    exports.checkDependants(settings, cfg, opt, names, function (err) {
        if (err) {
            return callback(err);
        }
        async.series([
            async.apply(
                async.forEach, names,
                async.apply(exports.removePackage, cfg, opt)
            ),
            async.apply(exports.buildLocalTree, settings, cfg, opt),
            async.apply(
                project.updateRequireConfig, opt.target_dir, opt.baseurl
            )
        ],
        callback);
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


exports.removePackage = function (cfg, opt, name, callback) {
    logger.info('removing', name);
    cfg = project.removeJamDependency(cfg, name);
    rimraf(path.resolve(opt.target_dir, name), callback);
};


exports.buildLocalTree = function (settings, cfg, opt, callback) {
    var local_sources = [
        install.dirSource(opt.target_dir),
        install.repoSource(settings.repositories, cfg)
    ];
    var newcfg = utils.convertToRootCfg(cfg);
    var pkg = {
        config: newcfg,
        source: 'root'
    };
    logger.info('Building local version tree...');
    tree.build(pkg, local_sources, callback);
};
