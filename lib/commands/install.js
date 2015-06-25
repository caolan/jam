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
    git = require('../git'),
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
    fs = require('fs');


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
    '  jam install ./path/to/package.json\n' +
    '  jam install ./project/path\n' +
    '\n' +
    'Install from GitHub:\n' +
    '  jam install gh:user/repository/tag (tag is optional, defaults to master)\n' +
    '\n' +
    'Parameters:\n' +
    '  PACKAGE    Package to install\n' +
    '\n' +
    'Options:\n' +
    '  -r, --repository   Source repository URL (otherwise uses values in jamrc)\n' +
    '  -s, --strict       Strict mode that checks non stable dependencies in subpackages\n' +
    '  -p, --production   Restricts to install packages from any other source than repository\n' +
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
        'strict': {match: ['-s', '--strict'], value: false},
        'production': {match: ['-p', '--production'], value: false},
        'target_dir': {match: ['-d', '--package-dir'], value: true},
        'baseurl': {match: ['-b', '--baseurl'], value: true}
    });

    var opt = a.options;
    var names = a.positional;

    opt.repositories = settings.repositories;
    if (a.options.repository) {
        opt.repositories = [a.options.repository];
        // don't allow package dir .jamrc file to overwrite repositories
        opt.fixed_repositories = true;
    }
    if (process.env.JAM_TEST) {
        if (!process.env.JAM_TEST_DB) {
            throw 'JAM_TEST environment variable set, but no JAM_TEST_DB set';
        }
        opt.repositories = [process.env.JAM_TEST_DB];
        opt.fixed_repositories = true;
    }

    var cwd = process.cwd();
    exports.initDir(settings, cwd, opt, function (err, opt, cfg, proj_dir) {
        if (err) {
            return logger.error(err);
        }

        opt = exports.extendOptions(proj_dir, settings, cfg, opt);

        if (names.length < 1) {
            exports.reinstallPackages(cfg, opt, exports.teardown(function (err) {
                if (err) {
                    return logger.error(err);
                }

                logger.end();
            }));
        }
        else {
            exports.installPackages(cfg, names, opt, exports.teardown(function (err) {
                if (err) {
                    return logger.error(err);
                }

                logger.end();
            }));
        }
    });
};


exports.extendOptions = function (proj_dir, settings, cfg, opt) {
    if (!opt.target_dir) {
        if (cfg.jam && cfg.jam.packageDir) {
            opt.target_dir = path.resolve(proj_dir, cfg.jam.packageDir);
        }
        else {
            opt.target_dir = path.resolve(proj_dir, settings.package_dir);
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

    _.forEach([ "strict", "production" ], function(key) {
        if (_.isUndefined(opt[key]) && !_.isUndefined(settings[key])) {
            opt[key] = settings[key];
        }
    });

    return opt;
};


exports.reinstallPackages = function (cfg, opt, callback) {
    var sources = [
        exports.gitSource(cfg),
        exports.dirSource(opt.target_dir),
        exports.repoSource(opt.repositories, cfg)
    ];

    var translators = [
        exports.gitTranslate(cfg),
        exports.linkedTranslate(opt.target_dir),
        exports.falsyTranslate(cfg)
    ];

    // clone cfg object from package.json and replace npm deps with jam deps
    var newcfg = utils.convertToRootCfg(cfg);

    var pkg = {
        config: newcfg,
        source: 'root'
    };

    logger.info('Building version tree...');

    tree.build(pkg, sources, translators, function (err, packages) {
        if (err) {
            return callback(err);
        }

        exports.installTree(packages, opt, function (err) {
            if (err) {
                return callback(err);
            }
            // TODO: write package.json if --save option provided
            project.updateRequireConfig(opt.target_dir, opt.baseurl, callback);
        });
    });
};


exports.installPackages = function (cfg, names, opt, callback) {
    // Run installation proceedure for each package on command line

    // TODO: build package tree for all packages *first*, then
    // do the actuall installation to avoid the case where a package
    // gets installed then downgraded during a later install

    async.reduce(
        names,
        null,
        function (acc, pkg, cb) {
            exports.install(cfg, pkg, opt, cb);
        },
        function (err, packages) {
            if (err) {
                return callback(err);
            }
            // TODO: write package.json if --save option provided
            project.updateRequireConfig(opt.target_dir, opt.baseurl, callback);
        }
    );
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

    if (/^gh:/.test(pkg) || /^github:/.test(pkg)) {
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
        }
        else if (stats.isDirectory()) {
            logger.info('installing from repositories', pkg);
            return exports.installName(cfg, pkg, opt, callback);
        }
        return callback('Unknown install target: ' + path.resolve(pkg));
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
    var cache;

    cache = {};

    return function (def, callback) {
        var name, versions;

        name = def.name;

        if (versions = cache[name]) {
            logger.debug('dirs', 'from cache "' + name + '"');
            callback(null, versions);
            return;
        }

        packages.availableVersions([ path.join(target_dir, name) ], function(err, versions) {
            if (err) {
                callback(err);
                return;
            }

            cache[name] = versions;

            callback(null, versions);
        });
    };
};

exports.linkedTranslate = function (target_dir) {
    var source;

    source = exports.dirSource(target_dir);

    return function (def, callback) {
        if (def.range != "linked") {
            return callback(null);
        }

        source.call(null, def, function(err, versions) {
            if (err) {
                return callback(err);
            }

            try {
                callback(null, versions[0].version);
            } catch (err) {
                callback(null);
            }
        });
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
    var cache;

    cache = {};

    return function (def, callback) {
        var name, versions;

        name = def.name;

        if (meta && project.getJamDependencies(meta)[name] === 'linked') {
            logger.info(
                'repositories',
                'skipping linked package "' + name + '"'
            );
            callback(null, []);
        }
        else {
            if (versions = cache[name]) {
                logger.debug('repositories', 'from cache "' + name + '"');
                callback(null, versions);
                return;
            }

            logger.info('repositories', 'checking "' + name + '"');
            repository.availableVersions(name, repositories, function(err, versions) {
                if (err) {
                    callback(err);
                    return;
                }

                cache[name] = versions;

                callback(null, versions);
            });
        }
    };
};


/**
 * Creates a source function to check git repository for available package
 * versions. This can be used in conjunction with the tree module.
 *
 * @param {Object} meta
 * @returns {Function}
 */

exports.gitSource = function(meta) {
    return function(def, callback) {
        var name, range, normalized, uri;

        name = def.name;
        range = def.range;

        // skip non git paths
        if (!(normalized = git.parseURI(range))) {
            callback(null, []);
            return;
        }

        logger.info('git', 'checking "' + name + '"');

        git.availableVersions(name, normalized, callback);
    };
};


/**
 * @param {Object} meta
 * @returns {Function}
 */
exports.gitTranslate = function(meta) {
    return function(def, callback) {
        var normalized;

        // skip non git paths
        if (!(normalized = git.parseURI(def.range))) {
            callback(null);
            return;
        }

        git.define(normalized, function(err, def) {
            if (err) {
                return callback(err);
            }

            callback(null, def.pkg.version);
        });
    };
};


/**
 * @param {Object} meta
 * @returns {Function}
 */
exports.falsyTranslate = function(meta) {
    return function(range, callback) {
        if (range == null || range == "") {
            return callback(null, "*");
        }

        callback(null);
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

exports.initDir = function (settings, cwd, opt, callback) {
    jamrc.loadProjectRC(settings, cwd, function (err, _settings) {
        if (err) {
            return callback(err);
        }

        if (_settings.repositories && !opt.fixed_repositories) {
            //overwrite repository list with package directory's list
            opt.repositories = _settings.repositories;
        }

        project.loadPackageJSON(cwd, function (err, meta, pkgpath) {
            if (err) {
                return callback(err);
            }

            if (!meta) {
                meta = project.DEFAULT;
            }

            var project_dir = path.dirname(pkgpath);
            callback(null, opt, meta, project_dir);
        });
    });
};


exports.stableVersionsPackageValidator = function(pkg, name, cb) {
    var rootRange, rootRangeParsed, notStrictRanges;

    if ( (rootRange = pkg.ranges._root) ) {
        // if root range is present and it is strict
        if ( semver.parse(rootRange) ) {
            return cb(null);
        }

        rootRangeParsed = semver.validRange(rootRange);
    }

    notStrictRanges = _.chain(pkg.ranges)
        .omit('_root')
        .map(function(range, parent) {
            if ( semver.parse(range) ) {
                return null;
            }

            return {
                parsed: semver.validRange(range),
                parent: parent,
                range:  range
            }
        })
        .filter()
        .value();

    if (!_.isEmpty(notStrictRanges)) {
        cb(
            'Unstable version for the package "' + name + '@' + pkg.current_version + '":\n' +
            notStrictRanges
                .map(function(def) {
                    return 'subpackage "' + def.parent + '" requires it as ' + def.range + (def.parsed ? (' (' + def.parsed + ')') : '');
                })
                .map(function(str) {
                    return '\t' + str;
                })
                .join('\n') +
            '\n' +
            (
                rootRange
                    ? '\troot package requires it as ' + rootRange + (rootRangeParsed ? (' (' + rootRangeParsed + ')') : '')
                    : '\troot package does not require it'
            ) +
            '\n' +
            '\n' +
            'This subpackage should be hoisted to the root package dependencies with strict version definition.' +
            '\n'
        );

        return;
    }

    cb(null);
};

exports.notAGitSourceVersionValidator = function(version, pkg, name, cb) {
    if (version.source === "git") {
        cb('There is a restriction to install package "' + name + '" from git repository ' + version.git.uri);
        return;
    }

    cb(null);
};

exports.extractValidVersion = function(pkg, name, cb) {
    var curr, versions, version;

    curr = pkg.current_version;

    versions = _.chain(pkg.versions)
        .where({ version: curr })
        .groupBy('priority')
        .reduce(function(list, versions, priority) {
            list.push({ priority: priority, versions: versions });
            return list;
        }, [])
        .sortBy("priority")
        .first()
        .result('versions')
        .value();

    if (!versions || versions.length == 0) {
        cb('No version found for the package "' + name + '@' + curr + '"');
        return;
    }

    if (versions.length > 1) {
        cb(
            'Multiple sources are found for the package "' + name + '@' + curr + '":\n' +
            versions
                .map(function(version) {
                    switch (version.source) {
                        case 'git': {
                            return version.git.uri;
                        }

                        default: {
                            return JSON.stringify(version);
                        }
                    }
                })
                .map(function(str) {
                    return '\t' + str;
                })
                .join('\n') +
            '\n'
        );

        return;
    }

    cb(null, versions[0]);
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
    async.waterfall(
        [
            function(done) {
                async.map(
                    Object.keys(packages),
                    function(name, next) {
                        var pkg, packageValidators, versionValidators;

                        pkg = packages[name];

                        packageValidators = [];
                        versionValidators = [];

                        if (opt.strict) {
                            packageValidators.push(exports.stableVersionsPackageValidator);
                        }

                        if (opt.production) {
                            versionValidators.push(exports.notAGitSourceVersionValidator);
                        }

                        async.waterfall(
                            []
                                .concat(packageValidators.map(function(validator) {
                                    return async.apply(validator, pkg, name);
                                }))
                                .concat(async.apply(exports.extractValidVersion, pkg, name))
                                .concat(versionValidators.map(function(validator) {
                                    return function(version, callback) {
                                        validator.call(null, version, pkg, name, function(err) {
                                            if (err) {
                                                callback(err);
                                                return;
                                            }

                                            callback(null, version);
                                        });
                                    };
                                })),
                            function(err, version) {
                                if (err) {
                                    next(err);
                                    return;
                                }

                                next(null, {
                                    name:    name,
                                    version: version,
                                    pkg:     pkg
                                });
                            }
                        );
                    },
                    done
                );
            },

            function(defs, done) {
                async.forEachLimit(
                    defs,
                    5,
                    function (def, next) {
                        var version, curr, name;

                        version = def.version;
                        curr = version.version;
                        name = def.name;

                        switch (version.source) {
                            case 'repository': {
                                exports.installRepo(name, curr, opt, next);
                                break;
                            }

                            case 'tmp': {
                                logger.info('copying files', version.basename);
                                exports.cpDir(name, curr, false, version.path, opt, next);
                                break;
                            }

                            case 'git': {
                                exports.installGit(name, version.git, opt, next);
                                break;
                            }

                            case 'github': {
                                next('GitHub source is not implemented yet');
                                break;
                            }

                            case 'url': {
                                next('URL source is not implemented yet');
                                break;
                            }

                            case 'file': {
                                next('File source is not implemented yet');
                                break;
                            }

                            default: {
                                process.nextTick(next);
                            }
                        }
                    },
                    done
                );
            }
        ],
        function(err) {
            if (err) {
                callback(err);
                return;
            }

            callback(null, packages);
        }
    );
};


/**
 * Install a package by name. This is used on the command-line and can parse
 * 'package@version' etc. The package will be installed from the available
 * repositories with the range requirements of the current project
 * directory taken into account.
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
        if (name.indexOf('@') !== -1) {
            var parts = name.split('@');
            name = parts[0];
            range = parts.slice(1).join('@');
        }
        cfg = project.addJamDependency(cfg, name, range);
        var sources = [
            exports.gitSource(cfg),
            exports.dirSource(opt.target_dir),
            exports.repoSource(opt.repositories, cfg)
        ];
        var newcfg = utils.convertToRootCfg(cfg);
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
    return function () {
        var args = arguments;
        var that = this;
        async.map(tmp_paths, rimraf, function (err) {
            if (err) {
                // log this error even though it won't make it to the callback
                logger.error(err);
            }
            _fn.apply(that, args);
        });
    };
};

exports.teardown = function(fn) {
    return function () {
        var args = arguments,
            that = this;

        async.parallel(
            [
                function(next) {
                    git.cleanup(next);
                }
            ],
            function(err) {
                if (err) {
                    logger.error(err);
                }

                fn.apply(that, args);
            }
        );
    }
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
    packages[cfg.name].versions.push({
        source: 'tmp',
        path: tmpdir,
        basename: path.basename(filename),
        config: cfg,
        version: cfg.version
    });
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

            cfg = project.addJamDependency(cfg, filecfg.name, range);
            var sources = [
                exports.gitSource(cfg),
                exports.dirSource(opt.target_dir),
                exports.repoSource(opt.repositories, cfg)
            ];
            var packages = exports.prepareTree(filecfg, filename, tdir);
            var newcfg = utils.convertToRootCfg(cfg);
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
 * Install a package from git.
 *
 * @param name
 * @param def
 * @param opt
 * @param callback
 */

exports.installGit = function(name, def, opt, callback) {
    git.get(def.path, function(err, repository) {
        if (err) {
            callback(err);
            return;
        }

        repository.snapshot(def.commitish, function(err, path) {
            if (err) {
                callback(err);
                return;
            }

            exports.cpDir(name, def.uri, false, path, opt, callback);
        });
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
