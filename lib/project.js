var utils = require('./utils'),
    path = require('path'),
    semver = require('semver'),
    async = require('async'),
    mkdirp = require('mkdirp'),
    ncp = require('ncp').ncp,
    fs = require('fs');


var pathExists = fs.exists || path.exists;


exports.load = async.memoize(function (package_dir, callback) {
    var settings_file = path.resolve(package_dir, 'jam.json');
    pathExists(settings_file, function (exists) {
        if (exists) {
            utils.readJSON(settings_file, function (err, settings) {
                if (err) {
                    return callback(err);
                }
                try {
                    exports.validate(settings, settings_file);
                }
                catch (e) {
                    return callback(e);
                }
                return callback(null, settings);
            });
        }
        else {
            exports.createMeta(callback);
        }
    });
});

exports.validate = function (settings, filename) {
    // nothing to validate yet
};

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

// adds RequireJS to project directory
exports.makeRequireJS = function (package_dir, config, callback) {
    

    var source = path.resolve(__dirname,'../node_modules/requirejs/require.js');
    var dest = path.resolve(package_dir, 'require.js');
    logger.info('updating', path.relative(process.cwd(), dest));
    
    fs.readFile(source, function (err, content) {
        var src = content.toString() + '\n' + config;
        fs.writeFile(dest, src, callback);
    });
};

exports.updateRequireConfig = function (opt, tree, callback) {
    var packages = [];
    var shims = {};
    var package_dir = opt.target_dir || opt;
    var base_url = opt.base_url || "";

    // add a trailing slash if omitted
    if(base_url != ""){
        if(base_url.charAt(base_url.length-1) != "/"){
            base_url = base_url + "/";
        };
    }

    for (var name in tree) {
        if (name !== '_root') {
            var pkg = tree[name];
            var cfg = pkg.versions[pkg.current_version].config;
            var val = {
                name: name,
                location: base_url + encodeURIComponent(path.basename(package_dir)) + '/' +
                          encodeURIComponent(name)
            };
            var main = (cfg.browser && cfg.browser.main) || cfg.main
            if (main) {
                val.main = main;
            }
            packages.push(val);
            if (cfg.shim) {
                shims[name] = cfg.shim;
            }
        }
    }

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
        }
        console.log(data)
        var src = 'var jam = ' + JSON.stringify(data, null, 4) + ';\n' +
            '\n' +
            'if (typeof require !== "undefined" && require.config) {\n' +
            '    require.config({packages: jam.packages, shim: jam.shim});\n' +
            '}\n' +
            'else {\n' +
            '    var require = {packages: jam.packages, shim: jam.shim};\n' +
            '}\n' +
            '\n' +
            'if (typeof exports !== "undefined" && ' +
                'typeof module !== "undefined") {\n' +
            '    module.exports = jam;\n' +
            '}';

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
};
