/**
 * Module dependencies
 */

var path = require('path'),
    install = require('./install'),
    tree = require('../tree'),
    project = require('../project'),
    logger = require('../logger'),
    argParse = require('../args').parse;


/**
 * Usage information and docs
 */

exports.summary = 'Recreates require.js file with the latest config options';


exports.usage = '' +
'jam rebuild\n' +
'\n' +
'Options:\n' +
'  -d, --package-dir  Package directory (defaults to "./jam")';


/**
 * Run function called when "jam remove" command is used
 *
 * @param {Object} settings - the values from .jamrc files
 * @param {Array} args - command-line arguments
 */

exports.run = function (settings, args) {
    var a = argParse(args, {
        'target_dir': {match: ['-d', '--package-dir'], value: true},
        'base_url' : {match: ['-b', '--base-url'], value: true}
    });

    var opt = a.options;
    opt.target_dir = opt.target_dir || path.resolve('jam');

    install.initDir(opt, function (err, opt, cfg) {
        if (err) {
            return callback(err);
        }
        exports.readPackages(settings, cfg, opt, function (err, packages) {
            if (err) {
                return logger.error(err);
            }
            project.writeMeta(opt.target_dir, cfg, function (err, cfg) {
                if (err) {
                    return callback(err);
                }
                project.updateRequireConfig(opt, packages,
                   function (err) {
                        if (err) {
                            return logger.error(err);
                        }
                        logger.end();
                   }
                );
            });
        });
    });
};


exports.readPackages = function (settings, cfg, opt, callback) {
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
