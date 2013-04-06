/**
 * Module dependencies
 */

var path = require('path'),
    tree = require('../tree'),
    utils = require('../utils'),
    install = require('./install'),
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
'  -d, --package-dir  Package directory (defaults to "./jam")',
'  -c, --config       Additional require.config.js properties to be included';


/**
 * Run function called when "jam rebuild" command is used
 *
 * @param {Object} settings - the values from .jamrc files
 * @param {Array} args - command-line arguments
 */

exports.run = function (settings, args) {
    var a = argParse(args, {
        'target_dir': {match: ['-d', '--package-dir'], value: true},
        'baseurl': {match: ['-b', '--baseurl'], value: true},
        'config': {match: ['-c', '--config'], value: true},
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
        if (!opt.config) {
          if (cfg.jam && cfg.jam.config) {
            opt.config = cfg.jam.config;
          } else {
            opt.conifg = {};
          }
        }
        exports.rebuild(settings, cfg, opt, function (err) {
            if (err) {
                return logger.error(err);
            }
            logger.end();
        });
    });
};


exports.rebuild = function (settings, cfg, opt, callback) {
    exports.readPackages(settings, cfg, opt, function (err, packages) {
        if (err) {
            return logger.error(err);
        }
        // TODO: write package.json if --save option provided
        project.updateRequireConfig(opt.target_dir, opt.baseurl, opt.config, callback);
    });
};


exports.readPackages = function (settings, cfg, opt, callback) {
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
