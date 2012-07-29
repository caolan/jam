var env = require('../env'),
    utils = require('../utils'),
    logger = require('../logger'),
    settings = require('../settings'),
    project = require('../project'),
    install = require('./install'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    path = require('path'),
    fs = require('fs');


var pathExists = fs.exists || path.exists;


exports.summary = 'Creates a link to a development package';

exports.usage = '' +
    'jam link PATH\n' +
    '\n' +
    'Parameters:\n' +
    '  PATH    The path to the package directory\n' +
    '\n' +
    'Options:\n' +
    '  -r, --repository   Source repository URL (otherwise uses values in jamrc)\n' +
    '  -d, --package-dir  Jam package directory (defaults to "./jam")';


exports.run = function (_settings, args, commands) {
    var a = argParse(args, {
        'repository': {match: ['-r', '--repository'], value: true},
        'target_dir': {match: ['-d', '--package-dir'], value: true}
    });

    var opt = a.options;
    opt.target_dir = opt.target_dir || _settings.package_dir;

    opt.repositories = _settings.repositories;
    if (a.options.repository) {
        opt.repositories = [a.options.repository];
        // don't allow package dir .jamrc file to overwrite repositories
        opt.fixed_repositories = true;
    }

    if (a.positional.length < 1) {
        console.log(exports.usage);
        logger.clean_exit = true;
        return;
    }
    var pkg = a.positional[0];
    var cwd = process.cwd();

    project.loadPackageJSON(cwd, function (err, meta) {
        if (err) {
            return logger.error(err);
        }
        settings.load(pkg, function (err, cfg) {
            if (err) {
                return logger.error(err);
            }

            meta.dependencies[cfg.name] = 'linked';
            var newpath = path.resolve(opt.target_dir, cfg.name);
            mkdirp(path.dirname(newpath), function (err) {
                if (err) {
                    return logger.error(err);
                }
                exports.createLink(path.resolve(pkg), newpath, function (err) {
                    if (err) {
                        return logger.error(err);
                    }
                    install.reinstallPackages(meta, opt, function (err) {
                        if (err) {
                            return logger.error(err);
                        }
                        project.updateRequireConfig(
                            opt.target_dir,
                            local,
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

        });
    });

};


exports.createLink = function (source, target, callback) {
    pathExists(target, function (exists) {
        if (exists) {
            /*
            utils.getConfirmation(
                'Delete existing package at ' +
                path.relative(process.cwd(), target),
                function (err, yes) {
                    if (err) {
                        return callback(err);
                    }
                    if (yes) {
                    */
                        rimraf(target, function (err) {
                            if (err) {
                                return callback(err);
                            }
                            exports.createLink(source, target, callback);
                        });
                        /*
                    }
                    else {
                        return;
                    }
                }
            );
            */
            return;
        }
        else {
            fs.symlink(source, target, 'dir', callback);
        }
    });
};
