var utils = require('./utils'),
    path = require('path'),
    semver = require('semver'),
    async = require('async'),
    mkdirp = require('mkdirp'),
    ncp = require('ncp').ncp,
    fs = require('fs'),
    honey = require('json-honey'),
    _ = require('underscore');


var pathExists = fs.exists || path.exists;


exports.readPackageJSON = function (p, callback) {
    utils.readJSON(p, function (err, pkg) {
        if (err) {
            return callback(err, null, p);
        }
        try {
            exports.validate(pkg, p);
        }
        catch (e) {
            return callback(e);
        }
        return callback(null, pkg, p);
    });
};

exports.writePackageJSON = function (p, pkg, callback) {
    var str = honey(pkg);
    utils.writeJSON(p, str, callback);
};


/**
 * Looks for a project's package.json file. Walks up the directory tree until
 * it finds a package.json file or hits the root. Does not throw when no
 * packages.json is found, just returns null.
 *
 * @param {String} p - The starting path to search upwards from
 * @param {boolean} [r] - Recursive search
 * @param {Function} callback - callback(err, path)
 */

exports.findPackageJSON = function (p, r, callback) {
    var filename;

    if (_.isFunction(r)) {
        callback = r;
        r = false;
    }

    filename = path.resolve(p, 'package.json');

    pathExists(filename, function (exists) {
        var newpath;

        if (exists) {
            return callback(null, filename);
        }

        if (!r) {
            return callback(null, null);
        }

        newpath = path.dirname(p);

        if (newpath === p) { // root directory
            return callback(null, null);
        }

        exports.findPackageJSON(newpath, r, callback);
    });
};

/**
 * Searches for package.json and returns an object with it's contents,
 * returns a null if no file found. Final
 * argument of the callback is the matching file path for package.json,
 * or null if none were found.
 *
 * @param {String} cwd - directory to search upwards from for package.json
 * @param {boolean} [r] - Recursive search
 * @param {Function} callback(err, package_obj, path)
 */

exports.loadPackageJSON = async.memoize(function (cwd, r, callback) {
    if (_.isFunction(r)) {
        callback = r;
        r = false;
    }

    exports.findPackageJSON(cwd, r, function (err, p) {
        if (err) {
            return callback(err, null, p);
        }

        if (!p) {
            return callback(null, null, p);
        }

        exports.readPackageJSON(p, callback);
    });
});


exports.updatePackageJSON = function(cwd, r, dependencies, callback) {
    if (_.isObject(r)) {
        callback = dependencies;
        dependencies = r;
        r = false;
    }

    exports.findPackageJSON(cwd, r, function (err, p) {
        if (err) {
            return callback(err);
        }

        if (!p) {
            return callback("could not find package.json in '" + cwd + "'");
        }

        logger.info('updating', p);

        exports.readPackageJSON(p, function(err, pkg, path) {
            if (err) {
                return callback(err);
            }

            pkg.jam = pkg.jam || { dependencies: {} };
            
            _.extend(pkg.jam.dependencies, dependencies);

            exports.writePackageJSON(p, pkg, callback);
        });
    });
};

exports.validate = function (settings, filename) {
    // nothing to validate yet
};

exports.DEFAULT = {
    jam: {
        dependencies: {}
    }
};

/*
exports.createMeta = function (callback) {
    utils.getJamVersion(function (err, version) {
        if (err) {
            return callback(err);
        }
        callback(null, {
            jam_version: version,
            dependencies: {}
        });
    });
};

exports.writeMeta = function (package_dir, data, callback) {
    // TODO: add _rev field to meta file and check if changed since last read
    // before writing
    var filename = path.resolve(package_dir, 'jam.json');
    try {
        var str = JSON.stringify(data, null, 4);
    }
    catch (e) {
        return callback(e);
    }
    mkdirp(package_dir, function (err) {
        if (err) {
            return callback(err);
        }
        logger.info('updating', path.relative(process.cwd(), filename));
        fs.writeFile(filename, str, function (err) {
            // TODO: after adding _rev field, return updated _rev value in data here
            return callback(err, data);
        });
    });
};
*/

// adds RequireJS to project directory
exports.makeRequireJS = function (package_dir, config, callback) {
    var require_path = require.resolve('requirejs');
    var source = path.join(require_path, '../../require.js')
    var dest = path.resolve(package_dir, 'require.js');

    logger.info('updating', path.relative(process.cwd(), dest));

    fs.readFile(source, function (err, content) {
        if (err) {
            return callback(err);
        }
        var src = content.toString() + '\n' + config;
        fs.writeFile(dest, src, callback);
    });
};

exports.getAllPackages = function (dir, callback) {
    utils.listDirs(dir, function (err, dirs) {
        if (err) {
            return callback(err);
        }
        async.map(dirs, function (d, cb) {
            var filename = path.resolve(d, 'package.json');
            exports.readPackageJSON(filename, function (err, cfg, p) {
                cb(err, err ? null: {cfg: cfg, dir: path.relative(dir, d)});
            });
        }, callback);
    });
};

exports.updateRequireConfig = function (package_dir, baseurl, /*opt*/rcfg, callback) {
    rcfg = rcfg || {};

    if (!callback) {
        callback = rcfg;
        rcfg = {};
    }

    var packages = [];
    var shims = {};

    var basedir = baseurl ? path.relative(baseurl, package_dir): package_dir;
    var dir = basedir.split(path.sep).map(encodeURIComponent).join('/');

    exports.getAllPackages(package_dir, function (err, pkgs) {
        if (err) {
            return callback(err);
        }

        pkgs.forEach(function (pkg) {
            var cfg = pkg.cfg;
            var val = {
                name: cfg.name,
                location: dir + '/' + encodeURIComponent(pkg.dir)
            };
            var main = cfg.main;
            if (cfg.browser && cfg.browser.main) {
                main = cfg.browser.main;
            }
            if (cfg.jam && cfg.jam.main) {
                main = cfg.jam.main;
            }
            if (main) {
                val.main = main;
            }
            if (cfg.jam && cfg.jam.name) {
                val.name = cfg.jam.name;
            }
            packages.push(val);
            if (cfg.shim) {
                shims[cfg.name] = cfg.shim;
            }
            if (cfg.browser && cfg.browser.shim) {
                shims[cfg.name] = cfg.browser.shim;
            }
            if (cfg.jam && cfg.jam.shim) {
                shims[cfg.name] = cfg.jam.shim;
            }
            if (cfg.jam && cfg.jam.extra_packages) {
                var extra_packages = Object.keys(cfg.jam.extra_packages);
                extra_packages.forEach(function(extra_pkg){
                    var extra_val  = {
                        name: extra_pkg,
                        location: dir + '/' + encodeURIComponent(pkg.dir),
                        main: cfg.jam.extra_packages[extra_pkg].main,
                        local: true
                    }
                    packages.push(extra_val);
                    if (extra_pkg.shim) {
                        shims[extra_pkg.name] = extra_pkg.name;
                    }
                });
            }
        });

        utils.getJamVersion(function (err, version) {
            if (err) {
                return callback(err);
            }

            var data = {
                // TODO: useful option for cache-busting
                //urlArgs: '_jam_build=' + (new Date().getTime()),
                packages: packages,
                version: version,
                shim: shims
            };

            // now bring in other require.config.js options to make available
            // earlier versions had variable substitution that breaks on r.js compilation
            // now there is duplication - however, the original jam has been left untouched.
            var cfg = _.clone(rcfg);
            cfg.packages = _.union(rcfg.packages || [], packages);
            cfg.shim = _.extend({}, rcfg.shim || {}, shims);
            var configStr = JSON.stringify(cfg, null, 4);
			var dataStr = JSON.stringify(data, null, 4);
			var src = fs.readFileSync(path.resolve(__dirname, './tmpls/require.config.js')).toString();

			src = src.replace(/"\{data\}"/g, dataStr);

            var filename = path.resolve(package_dir, 'require.config.js');
            mkdirp(package_dir, function (err) {
                if (err) {
                    return callback(err);
                }
                logger.info('updating', path.relative(process.cwd(), filename));
                async.parallel([
                    async.apply(fs.writeFile, filename, src),
                    async.apply(exports.makeRequireJS, package_dir, src)
                ], callback);
            });
        });
    });
};

exports.getJamDependencies = function (cfg, name) {
    var deps;

    if (cfg.jam && cfg.jam.dependencies) {
        deps = cfg.jam.dependencies;
    } else {
        deps = {};
    }

    if (name) {
        return deps[name] || null;
    }

    return deps;
};

exports.setJamDependencies = function (cfg, deps) {
    if (!cfg.jam) {
        cfg.jam = {};
    }
    cfg.jam.dependencies = deps;
    return cfg;
};

exports.addJamDependency = function (cfg, name, range) {
    var deps = exports.getJamDependencies(cfg);
    deps[name] = range;
    return exports.setJamDependencies(cfg, deps);
};

exports.removeJamDependency = function (cfg, name) {
    var deps = exports.getJamDependencies(cfg);
    delete deps[name];
    return exports.setJamDependencies(cfg, deps);
};
