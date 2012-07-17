/**
 * Module dependencies
 */

var semver = require('semver'),
    versions = require('../versions'),
    logger = require('../logger'),
    utils = require('../utils'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    ncp = require('ncp').ncp,
    packages = require('../packages'),
    repository = require('../repository'),
    github = require('../github'),
    jamrc = require('../jamrc'),
    settings = require('../settings'),
    project = require('../project'),
    argParse = require('../args').parse,
    tar = require('../tar'),
    tree = require('../tree'),
    clean = require('./clean'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    _ = require('underscore');


var pathExists = fs.exists || path.exists;


/**
 * Usage information and docs
 */

exports.summary = 'Installs a package and its dependencies';

exports.usage = '' +
'jam install [PACKAGE...]S\n' +
'\n' +
'When called without parameters, re-installs packages in jam.json\n' +
'\n' +
'The PACKAGE argument can be one of the following: \n' +
'  jam install <tarball file>\n' +
'  jam install <tarball url>\n' +
'  jam install <name>\n' +
'  jam install <name>@<version>\n' +
'  jam install <name>@<version range>\n' +
'  jam install ./path/to/jam.json (extend with listed packages)\n' +
'\n' +
'Install from GitHub:\n' +
'  jam install gh:user/repository/tag (tag is optional, defaults to master)\n' +
'\n' +
'Parameters:\n' +
'  PACKAGE    Package to install\n' +
'\n' +
'Options:\n' +
'  -r, --repository   Source repository URL (otherwise uses values in jamrc)\n' +
'  -d, --package-dir  Output directory (defaults to "./jam")';


/**
 * Run function called when "jam install" command is used
 *
 * @param {Object} settings - the values from .jamrc files
 * @param {Array} args - command-line arguments
 */

exports.run = function (settings, args) {
    var a = argParse(args, {
        'repository': {match: ['-r', '--repository'], value: true},
        'target_dir': {match: ['-d', '--package-dir'], value: true},
        'base_url' : {match: ['-b', '--base-url'], value: true}
    });

    var opt = a.options;
    var names = a.positional;

    opt.repositories = settings.repositories;
    if (a.options.repository) {
        opt.repositories = [a.options.repository];
        // don't allow package dir .jamrc file to overwrite repositories
        opt.fixed_repositories = true;
    }

    opt.target_dir = opt.target_dir || path.resolve('jam');

    exports.initDir(opt, function (err, opt, cfg) {
        if (err) {
            return callback(err);
        }
        if (names.length < 1) {
            exports.reinstallPackages(cfg, opt, function (err) {
                if (err) {
                    return logger.error(err);
                }
                logger.end();
            });
        }
        else {
            exports.installPackages(cfg, names, opt, function (err) {
                if (err) {
                    return logger.error(err);
                }
                logger.end();
            });
        }
    });
};


exports.reinstallPackages = function (cfg, opt, callback) {
    var sources = [
        exports.dirSource(opt.target_dir),
        exports.repoSource(opt.repositories, cfg)
    ];
    var newcfg = _.extend({name: '_root'}, cfg);
    var pkg = {
        config: newcfg,
        source: 'root'
    };
    logger.info('Building version tree...');
    tree.build(pkg, sources, function (err, packages) {
        if (err) {
            return callback(err);
        }
        exports.installTree(packages, opt, function (err, packages) {
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


exports.installPackages = function (cfg, names, opt, callback) {
    // Run installation proceedure for each package on command line

    // TODO: build package tree for all packages *first*, then
    // do the actuall installation to avoid the case where a package
    // gets installed then downgraded during a later install

    async.reduce(names, null, function (acc, pkg, cb) {
        exports.install(cfg, pkg, opt, cb);
    },
    function (err, packages) {
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
};


/**
 * Install a package from repository, file, directory or URL.
 *
 * @param {String} pkg - the package name, filename, directory or URL
 * @param {Object} opt - options such as target_dir and repositories
 * @param {Function} callback
 */

exports.install = function (cfg, pkg, opt, callback) {
    if (/^https?:\/\//.test(pkg)) {
        logger.info('installing from URL', pkg);
        return exports.installURL(cfg, pkg, opt, callback);
    }
    else if (/^gh:/.test(pkg) || /^github:/.test(pkg)) {
        var ghref = pkg.substr(pkg.indexOf(':') + 1);
        logger.info('installing from GitHub', ghref);
        return exports.installGitHub(cfg, ghref, opt, callback);
    }
    fs.stat(pkg, function (err, stats) {
        if (err) {
            // may not be a file
            logger.info('installing from repositories', pkg);
            return exports.installName(cfg, pkg, opt, callback);
        }
        else if (stats.isFile()) {
            if (/.*\.tar\.gz$/.test(pkg) || /.*\.tgz$/.test(pkg)) {
                logger.info('installing from local file', pkg);
                return exports.installFile(cfg, pkg, opt, callback);
            }
            else if (/.*\.json$/.test(pkg)) {
                logger.info('reinstalling package list', pkg);
                return exports.installList(cfg, pkg, opt, callback);
            }
        }
        else {
            return callback(new Error('Unknown install target: ' + pkg));
        }
    });
};


/**
 * Creates a source function to check packages already in local target_dir.
 * This can be used in conjunction with the tree module.
 *
 * @param {String} target_dir - the directory we're installing packages to
 * @returns {Function}
 */

// TODO: also check package_paths (not just target_dir) for available versions?
exports.dirSource = function (target_dir) {
    return function (name, callback) {
        packages.availableVersions([path.join(target_dir, name)], callback);
    };
};


/**
 * Creates a source function to check repostories for available package
 * versions. This can be used in conjunction with the tree module.
 *
 * @param {Array} repositories - URLs for repositories to check
 * @returns {Function}
 */

exports.repoSource = function (repositories, meta) {
    return function (name, callback) {
        if (meta && meta.dependencies[name] === 'linked') {
            logger.info(
                'repositories',
                'skipping linked package "' + name + '"'
            );
            callback(null, []);
        }
        else {
            logger.info('repositories', 'checking "' + name + '"');
            repository.availableVersions(name, repositories, callback);
        }
    };
};


/**
 * Initialise actions for a specific directory, loads .jamrc and updates
 * repositories in the opt object, then loads package.json for the
 * directory and returns it to the callback.
 *
 * @param {String} dir - the directory of the project/package to load
 * @param {Object} opt - the options object to update repositories on
 * @param {Function} callback - the callback is passed the updated opt object
 *     and the values from package.json on success
 */

exports.initDir = function (opt, callback) {
    var project_jamrc = path.join(opt.target_dir, '../.jamrc');
    jamrc.loadFile(project_jamrc, function (err, _settings) {
        if (err) {
            return callback(err);
        }
        if (_settings.repositories && !opt.fixed_repositories) {
            // overwrite repository list with package directory's list
            opt.repositories = _settings.repositories;
        }
        project.load(opt.target_dir, function (err, meta) {
            if (err) {
                return callback(err);
            }
            callback(null, opt, meta);
        });
    });
};


/**
 * Install dependencies from a json list (as generated by jam). Reads the
 * .jamrc file for that project and checks the list's packages.
 *
 * @param {String} filename - the package list to reinstall
 * @param {Object} opt - the options object
 * @param {Function} callback
 */

exports.installList = function (cfg, filename, opt, callback) {
    if (opt.no_deps) {
        return callback();
    }
    utils.readJSON(filename, function (err, list) {
        if (err) {
            return callback(err);
        }
        cfg.dependencies = _.extend(cfg.dependencies, list.dependencies);
        if (!cfg.dependencies) {
            logger.info('No dependencies specified');
            return callback();
        }
        var sources = [
            exports.dirSource(opt.target_dir),
            exports.repoSource(opt.repositories, cfg)
        ];
        var newcfg = _.extend({name: '_root'}, cfg);
        var pkg = {
            config: newcfg,
            source: 'root'
        };
        logger.info('Building version tree...');
        tree.build(pkg, sources, function (err, packages) {
            if (err) {
                return callback(err);
            }
            exports.installTree(packages, opt, callback);
        });
    });
};


/**
 * Installs packages in a version tree that are from remote sources (tmp
 * directory, repositories). Uses the set current_version for each
 * package.
 *
 * @param {Object} packages - the version tree to install
 * @param {Object} opt - the options object
 * @param {Function} callback
 */

exports.installTree = function (packages, opt, callback) {
    var names = Object.keys(packages);
    async.forEachLimit(names, 5, function (name, cb) {
        var curr = packages[name].current_version;
        if (packages[name].versions[curr].source === 'repository') {
            exports.installRepo(name, curr, opt, cb);
        }
        else if (packages[name].versions[curr].source === 'tmp') {
            var v = packages[name].versions[curr];
            logger.info('copying files', v.basename);
            exports.cpDir(name, curr, false, v.path, opt, cb);
        }
        else {
            process.nextTick(cb);
        }
    }, function (err) {
        if (err) {
            return callback(err);
        }
        // report packages that are no-longer used
        exports.checkUnused(packages, opt, callback);
    });
};


/**
 * Install a package by name. This is used on the command-line and can parse
 * 'package@version' etc. The package will be installed from the available
 * repositories with the range requirements of the current project
 * direcotry taken into account.
 *
 * @param {String} name - the name (with option @version) of the package
 * @param {Object} opt - the options object
 * @param {Function} callback
 */

exports.installName = function (cfg, name, opt, callback) {
    exports.checkExisting(name, opt, function (err) {
        if (err) {
            return callback(err);
        }
        var range = null;
        if (!range && name.indexOf('@') !== -1) {
            var parts = name.split('@');
            name = parts[0];
            range = parts.slice(1).join('@');
        }
        cfg.dependencies[name] = range;
        var sources = [
            exports.dirSource(opt.target_dir),
            exports.repoSource(opt.repositories, cfg)
        ];
        var newcfg = _.extend({name: '_root'}, cfg);
        var pkg1 = {
            config: newcfg,
            source: 'root'
        };
        logger.info('Building version tree...');
        tree.build(pkg1, sources, function (err, packages) {
            if (err) {
                return callback(err);
            }
            tree.addDependency(
                cfg.name, name, range, sources, packages,
                function (err, packages) {
                    if (err) {
                        return callback(err);
                    }
                    exports.installTree(packages, opt, callback);
                }
            );
        });
    });
};


/**
 * Installs a package from a repository. No dependency checks are made.
 *
 * @param {String} name - the package name
 * @param {String} range - the version range or number
 * @param {Object} opt - the options object
 * @param {Function} callback
 */

exports.installRepo = function (name, range, opt, callback) {
    repository.fetch(name, range, opt.repositories,
        function (err, tfile, cdir, v, cfg, from_cache) {
            if (err) {
                return callback(err);
            }
            exports.cpDir(name, v, from_cache, cdir, opt, callback);
        }
    );
};


/**
 * Copies a directory into the local target directory. Writes log messages
 * during this process.
 *
 * @param {String} name - the name of the package being copied
 * @param {String} v - the version of the package
 * @param {Boolean} from_cache - whether we're installing a cached package
 * @param {Object} opt - the options object
 * @param {Function} callback
 */

exports.cpDir = function (name, v, from_cache, cdir, opt, callback) {
    var p = opt.target_dir + '/' + name;
    function cp() {
        logger.info(
            'installing',
            name + '@' + v + (from_cache ? ' (cached)': '')
        );
        mkdirp(opt.target_dir, function (err) {
            if (err) {
                return callback(err);
            }
            ncp(cdir, p, {stopOnError: true}, callback);
        });
    }
    pathExists(p, function (exists) {
        if (exists) {
            logger.info('removing', name);
            rimraf(p, function (err) {
                if (err) {
                    return callback(err);
                }
                process.nextTick(function () {
                    cp();
                });
            });
        }
        else {
            cp();
        }
    });
};


/**
 * Wraps a callback to make sure temporary files are deleted even if an
 * error occurred.
 *
 * @param {Function} fn - the callback function to wrap
 * @param {Array} tmp_paths - the files/directories to remove
 * @returns {Function}
 */

exports.cleanupTmp = function (fn, tmp_paths) {
    // clean up tmp dir after attempted install, even if error
    var _fn = fn;
    return function (err) {
        var args = arguments;
        var that = this;
        async.map(tmp_paths, rimraf, function (err2) {
            if (err2) {
                // log this error even though it won't make it to the callback
                logger.error(err2);
            }
            _fn.apply(that, args);
        });
    };
};


/**
 * Copies a file into the jam temporary directory.
 *
 * @param {String} filename - the file to copy
 * @param {Function} callback
 */

exports.cpTmp = function (filename, callback) {
    var tmp = repository.TMP_DIR + '/' + path.basename(filename);
    mkdirp(repository.TMP_DIR, function (err) {
        if (err) {
            return callback(err);
        }
        if (filename === tmp) {
            // installing from a file in tmp already
            return callback(null, tmp);
        }
        ncp(filename, tmp, {stopOnError: true}, function (err) {
            if (err) {
                return callback(err);
            }
            callback(null, tmp);
        });
    });
};


/**
 * Prepares a .tar.gz file before installation. Copies it to the tmp directory,
 * extracts it, then reads the contents of it's package.json file.
 *
 * @param {String} filename - the .tar.gz file to prepare
 * @param {Function} callback - returns the values from package.json and
 *     the path of the extracted package directory
 */

exports.prepareFile = function (filename, callback) {
    exports.cpTmp(filename, function (err, tmp) {
        if (err) {
            return callback(err);
        }
        var tmp_extracted = repository.TMP_DIR + '/package';
        tar.extract(tmp, tmp_extracted, function (err) {
            if (err) {
                return callback(err);
            }
            settings.load(tmp_extracted, function (err, cfg) {
                callback(err, cfg, tmp_extracted, tmp);
            });
        });
    });
};


/**
 * Inserts a possible future dependency into the tree manually that may not
 * be available from the source functions. Using this we can 'prep' a version
 * tree with a package we know will be available later. This happens when
 * building a version tree before adding a package from a file.
 *
 * @param {Object} cfg - the package.json values for the package
 * @param {String} filename - the filename the package will be installed from
 * @param {String} tmpdir - the extracted package in the tmp directory
 * @param {Object} packages - the version tree to update (optional)
 * @return {Object} - returns the updated version tree
 */

exports.prepareTree = function (cfg, filename, tmpdir, /*optional*/packages) {
    packages = packages || {};
    packages[cfg.name] = tree.createPackage([]);
    packages[cfg.name].versions[cfg.version] = {
        source: 'tmp',
        path: tmpdir,
        basename: path.basename(filename),
        config: cfg
    };
    return packages;
};


/**
 * Install a package from a .tar.gz file.
 *
 * @param {Object} cfg - the jam.json values for the project
 * @param {String} filename - the .tar.gz file to install
 * @param {Object} opt - the options object
 * @param {String} range - range requirements to record in jam.json (optional)
 * @param {Function} callback
 */

exports.installFile = function (cfg, filename, opt, /*opt*/range, callback) {
    if (!callback) {
        callback = range;
        range = null;
    }
    exports.prepareFile(filename, function (err, filecfg, tdir, tfile) {

        // clean up tmp dir after attempted install, even if error
        callback = exports.cleanupTmp(callback, [tfile, tdir]);

        if (err) {
            return callback(err);
        }

        exports.checkExisting(filecfg.name, opt, function (err) {
            if (err) {
                return callback(err);
            }

            cfg.dependencies[filecfg.name] = range;
            var sources = [
                exports.dirSource(opt.target_dir),
                exports.repoSource(opt.repositories, cfg)
            ];
            var packages = exports.prepareTree(filecfg, filename, tdir);
            var newcfg = _.extend({name: '_root'}, cfg);
            var root = {
                config: newcfg,
                source: 'root'
            };
            logger.info('Building version tree...');
            tree.extend(root, sources, packages, function (err, packages) {
                if (err) {
                    return callback(err);
                }
                tree.addDependency(
                    cfg.name, filecfg.name, cfg.version, sources, packages,
                    function (err, packages) {
                        if (err) {
                            return callback(err);
                        }
                        exports.installTree(packages, opt, callback);
                    }
                );
            });
        });

    });
};


/**
 * Install a .tar.gz file from a URL.
 *
 * @param {Object} cfg - jam.json values
 * @param {String} url - the URL of the .tar.gz file
 * @param {Object} opt - the options object
 * @param {String} range - the range to record in jam.json (optional)
 * @param {Function} callback
 */

exports.installURL = function (cfg, url, opt, /*opt*/range, callback) {
    if (!callback) {
        callback = range;
        range = null;
    }
    logger.info('downloading', url);
    repository.download(url, function (err, filename) {
        if (err) {
            return callback(err);
        }
        exports.installFile(cfg, filename, opt, range || url, callback);
    });
};


/**
 * Install a package from GitHub
 */

exports.installGitHub = function (cfg, ghref, opt, callback) {
    var parts = ghref.split('/');
    if (parts.length < 2) {
        return callback(
            'Invalid GitHub reference, should be in the format gh:user/repo/tag'
        );
    }
    var user = parts[0],
        repo = parts[1],
        ref = parts[2] || 'master';

    github.repos.getArchiveLink(user, repo, 'tarball', ref, function (err, url) {
        if (err) {
            return callback(err);
        }
        exports.installURL(cfg, url, opt, 'gh:' + ghref, callback);
    });
};


/**
 * Checks the packages directory for packages not in the provided version
 * tree.
 *
 * @param {Object} packages - the version tree to compare against
 * @param {Object} opt - the options object
 * @param {Function} callback
 */

exports.checkUnused = function (packages, opt, callback) {
    clean.unusedDirsTree(packages, opt, function (err, dirs) {
        if (err) {
            return callback(err);
        }
        if (dirs.length) {
            var names = dirs.map(function (d) {
                return path.relative('.', d);
            });
            console.log(
                '\n' +
                'The following packages are no longer required, ' +
                'and can be removed\nby running "jam clean":\n' +
                '    ' + names.join('\n    ') +
                '\n'
            );
        }
        return callback(null, packages);
    });
};


/**
 * Checks to see if a directly installed package already exists and removes
 * it in order to do a clean reinstall. For example, when doing "install foo"
 * this check would *only* be performed on foo, not on its dependencies.
 */

exports.checkExisting = function (name, opt, callback) {
    var p = path.resolve(opt.target_dir, name);
    pathExists(p, function (exists) {
        if (exists) {
            logger.info(name + ' already installed -- reinstalling');
            rimraf(p, callback);
        }
        else {
            callback();
        }
    });
};
