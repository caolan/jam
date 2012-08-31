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

    install.initDir(_settings, cwd, opt, function (err, opt, cfg, proj_dir) {
        if (err) {
            return logger.error(err);
        }

        opt = install.extendOptions(proj_dir, _settings, cfg, opt);

        // load info on package about to be linked
        settings.load(pkg, function (err, newpkg) {
            if (err) {
                return logger.error(err);
            }

            project.addJamDependency(cfg, newpkg.name, 'linked');
            var newpath = path.resolve(opt.target_dir, newpkg.name);

            mkdirp(path.dirname(newpath), function (err) {
                if (err) {
                    return logger.error(err);
                }
                exports.createLink(path.resolve(pkg), newpath, function (err) {
                    if (err) {
                        return logger.error(err);
                    }
                    install.reinstallPackages(cfg, opt, function (err) {
                        if (err) {
                            return logger.error(err);
                        }
                        project.updateRequireConfig(
                            opt.target_dir,
                            opt.baseurl,
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
