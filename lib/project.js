var utils = require('./utils'),
    path = require('path'),
    semver = require('semver'),
    async = require('async'),
    mkdirp = require('mkdirp'),
    ncp = require('ncp').ncp,
    fs = require('fs');


exports.load = async.memoize(function (package_dir, callback) {
    var settings_file = path.resolve(package_dir, 'jam.json');
    path.exists(settings_file, function (exists) {
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
    logger.info('creating', path.relative(process.cwd(), dest));
    fs.readFile(source, function (err, content) {
        var src = content.toString() + '\n' + config;
        fs.writeFile(dest, src, callback);
    });
};

exports.updateRequireConfig = function (package_dir, tree, callback) {
    var packages = [];
    for (var name in tree) {
        if (name !== '_root') {
            var pkg = tree[name];
            var cfg = pkg.versions[pkg.current_version].config;
            var val = {
                name: name,
                location: encodeURIComponent(path.basename(package_dir)) + '/' +
                          encodeURIComponent(name)
            };
            if (cfg.main) {
                val.main = cfg.main;
            }
            packages.push(val);
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
            version: version
        }
        var src = 'var jam = ' + JSON.stringify(data, null, 4) + ';\n' +
            '\n' +
            'if (typeof require !== "undefined" && require.config) {\n' +
            '    require.config({packages: jam.packages});\n' +
            '}\n' +
            'else {\n' +
            '    var require = {packages: jam.packages};\n' +
            '}\n' +
            '\n' +
            'if (typeof exports !== "undefined" && ' +
                'typeof module !== "undefined") {\n' +
            '    module.exports = jam;\n' +
            '};';

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
