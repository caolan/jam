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
'  --package-dir  Package directory (defaults to "./jam")';

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
        'target_dir': {match: '--package-dir', value: true}
        // TODO 'clean':      {match: '--clean'}
    });

    if (a.positional.length < 1) {
        console.log(exports.usage);
        logger.clean_exit = true;
        return;
    }

    var opt = a.options;
    opt.target_dir = opt.target_dir || path.resolve('jam');

    install.initDir(opt, function (err, opt, cfg) {
        if (err) {
            return callback(err);
        }
        async.map(
            a.positional,
            async.apply(exports.remove, cfg, opt),
            function (err) {
                if (err) {
                    return logger.error(err);
                }
                exports.reportUnused(settings, cfg, opt, function (err, packages) {
                    if (err) {
                        return logger.error(err);
                    }
                    project.writeMeta(opt.target_dir, cfg, function (err, cfg) {
                        if (err) {
                            return callback(err);
                        }
                        project.updateRequireConfig(opt.target_dir, packages,
                           function (err) {
                                if (err) {
                                    return logger.error(err);
                                }
                                logger.end();
                           }
                        );
                    });
                });
            }
        );
    });
};


exports.remove = function (cfg, opt, name, callback) {
    logger.info('removing', name);
    delete cfg.dependencies[name];
    rimraf(path.resolve(opt.target_dir, name), callback);
};


exports.reportUnused = function (settings, cfg, opt, callback) {
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
    tree.build(pkg, local_sources, function (err, local) {
        install.checkUnused(local, opt, callback);
    });
};
