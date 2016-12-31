var argParse = require('../args').parse,
    jamrc = require('../jamrc'),
    settings = require('../settings'),
    _ = require('underscore'),
    async = require('async'),
    fs = require('fs'),
    utils = require('../utils'),
    path = require('path'),
    project = require('../project'),
    mkdirp = require('mkdirp'),
    install = require('./install'),
    git = require('../git'),
    schinquirer = require('schinquirer');

exports.summary = 'Symlink a package folder';

exports.usage = '' +
    'jam link (in package folder)\n' +
    'jam link <pkgname> [..<pkgnameN>]\n' +
    '\n' +
    'Parameters:\n' +
    '  pkgname    Name of a package link to\n' +
    '\n' +
    'Options:\n' +
    '  -g, --git       Checkout to version from project package.json\n' +
    '  -d, --link-dir  Jam symlink/dir store directory (defaults to $HOME/.jam/link, or link_dir from .jamrc)';

exports.run = function (_settings, args, commands) {
    var a, options, names,
        cwd, store;

    cwd = process.cwd();

    a = argParse(args, {
        'git':    { match: ['-g', '--git'],  value: false },
        'help':    { match: ['-h', '--help'],  value: false },
        'link_dir': { match: ['-d', '--store-dir'], value: true }
    });

    options = a.options;
    names = a.positional;

    store = options.link_dir || _settings.link_dir;

    async.series(
        [
            // check store directory
            function(next) {
                fs.exists(store, function(exists) {
                    if (!exists) {
                        logger.info("link",  "creating link store directory at " + store);
                        mkdirp(store, function(err) {
                            if (err) {
                                return next(err);
                            }

                            next();
                        });

                        return;
                    }

                    fs.stat(store, function(err, stat) {
                        if (err) {
                            return next(err);
                        }

                        if (!stat.isDirectory()) {
                            return next(new Error("Store path is not a directory at " +  store));
                        }

                        next();
                    });
                })
            }
        ],
        function(err) {
            if (err) {
                logger(err);
            }

            if (_.isEmpty(names)) {
                settings.load(cwd, function(err, config) {
                    var link, name;

                    if (err) {
                        logger.error(err);
                        return;
                    }

                    name = config.name;
                    link = path.resolve(store, name);

                    fs.exists(link, function(exists) {
                        function create() {
                            utils.createLink(cwd, link, function(err) {
                                if (err) {
                                    logger.error(err);
                                    return;
                                }

                                logger.info(name, link + ' -> ' + cwd);
                                logger.end();
                            });
                        }

                        if (exists) {
                            schinquirer.prompt(
                                {
                                    properties: {
                                        overwrite: {
                                            message: 'Link to the "' + name + '" package is already exists at ' + link + '. Overwrite?',
                                            type:    "boolean"
                                        }
                                    }
                                },
                                function(answers) {
                                    if (answers.overwrite) {
                                        create();
                                    } else {
                                        logger.end();
                                    }
                                }
                            );
                        } else {
                            create();
                        }
                    });
                });

                return;
            }

            // get current directory info
            install.initDir(_settings, cwd, {}, function (err, opt, pkg, currentPath) {
                if (err) {
                    logger.error(err);
                    return;
                }

                // actualize install options
                opt = install.extendOptions(currentPath, _settings, pkg, opt);

                async.forEach(
                    names,
                    function(name, next) {
                        async.waterfall(
                            [
                                function(next) {
                                    var source;

                                    source = path.resolve(cwd, name);

                                    fs.exists(source, function(exists) {
                                        if (exists) {
                                            fs.stat(source, function(err, stat) {
                                                if (err) {
                                                    return next(err);
                                                }

                                                if (!stat.isDirectory()) {
                                                    next(new Error("Path should be a directory"));
                                                    return;
                                                }

                                                next(null, source);
                                            });

                                            return;
                                        }

                                        next(null, null);
                                    });
                                },

                                function(source, next) {
                                    if (source) {
                                        return next(null, source);
                                    }

                                    fs.exists((source = path.resolve(store, name)), function(exists) {
                                        if (exists) {
                                            return next(null, source);
                                        }

                                        return next(null, null);
                                    });
                                }
                            ],
                            function(err, source) {
                                var updaters;

                                if (err) {
                                    return next(err);
                                }

                                if (!source) {
                                    logger.warning('No linked package found for "' + name +'"');
                                    next();
                                    return;
                                }

                                updaters = [];
                                if (options.git) {
                                    updaters.push(exports.gitSource(pkg, name, source));
                                }

                                // apply source updaters
                                async.parallel(
                                    updaters,
                                    function(err) {
                                        if (err) {
                                            logger.warning('Package "' + name + '" could not be updated. Skipping.');
                                            logger.error(err);
                                            next();
                                            return;
                                        }

                                        async.waterfall(
                                            [
                                                // get the end point of source
                                                function(next) {
                                                    fs.lstat(source, function(err, stat) {
                                                        if (err) {
                                                            return next(err);
                                                        }

                                                        if (stat.isSymbolicLink()) {
                                                            return fs.readlink(source, next);
                                                        }

                                                        next(null, null);
                                                    });
                                                },

                                                // load info on package about to be linked
                                                function(readLink, next) {
                                                    settings.load(source, function(err, newpkg) {
                                                        next(err, readLink, newpkg);
                                                    });
                                                },

                                                // finally create the link
                                                function(readLink, newpkg, next) {
                                                    var newpath;

                                                    newpath = path.resolve(opt.target_dir, newpkg.name || '');

                                                    mkdirp(path.dirname(newpath), function(err) {
                                                        if (err) {
                                                            next(err);
                                                            return;
                                                        }

                                                        utils.createLink(source, newpath, function (err) {
                                                            if (err) {
                                                                next(err);
                                                                return;
                                                            }

                                                            project.addJamDependency(pkg, newpkg.name, 'linked');

                                                            next(null, newpkg.name, newpath, source, readLink);
                                                        });
                                                    });
                                                }
                                            ],
                                            function(err, newname, newpath, source, endPoint) {
                                                if (err) {
                                                    next(err);
                                                    return;
                                                }

                                                logger.info(newname, newpath + " -> " + source + (endPoint ? (" -> " + endPoint) : ""));

                                                next();
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    },
                    function(err) {
                        if (err) {
                            logger.error(err);
                            return;
                        }

                        install.reinstallPackages(pkg, opt, function(err) {
                            if (err) {
                                logger.error(err);
                                return;
                            }

                            logger.end();
                        });
                    }
                );
            });
        }
    );

};



exports.gitSource = function(pkg, name, source) {
    return function(next) {
        var range, uri;

        range = project.getJamDependencies(pkg, name);
        uri = git.parseURI(range);

        if (!range || !uri) {
            next();
            return;
        }

        git.fromDirectory(source, function(err, repository) {
            if (err) {
                next(err);
                return;
            }

            repository.resolve(git.getSpec(uri), function(err, commitish) {
                if (err) {
                    next(err);
                    return;
                }

                repository.checkout(commitish, next);
            });
        });
    };
};












exports.find = function(store, name, done) {
    fs.readdir(store, function(err, files) {
        if (err) {
            done(err);
            return;
        }

        async.map(
            files,
            function(file, next) {
                fs.stat(file, function(err, stat) {
                    if (err) {
                        next(err);
                        return;
                    }

                    if (!stat.isDirectory()) {
                        next(null, null);
                    }

                    settings.load(file, function(err, config) {
                        if (err) {
                            next(err);
                            return;
                        }

                        next(null, config);
                    });
                })
            },
            function(packages) {
                var found;

                found = _.chain(packages)
                    .filter()
                    .find(function(pkg) {
                        return pkg.name == name;
                    });

                done(null, found || null);
            }
        );
    });
};