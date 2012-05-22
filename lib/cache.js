var tar = require('./tar'),
    env = require('./env'),
    rimraf = require('rimraf'),
    mkdirp = require('mkdirp'),
    async = require('async'),
    path = require('path'),
    fs = require('fs');


exports.CACHE_DIR = path.resolve(env.home, '.jam/cache');


exports.add = function (type, name, version, filepath, callback) {
    var filename = name + '-' + version + '.tar.gz';
    var dir = exports.dir(type, name, version);
    var tarfile = path.resolve(dir, filename);
    var cachedir = path.resolve(dir, 'package');

    mkdirp(dir, function (err) {
        if (err) {
            return callback(err);
        }
        async.series([
            async.apply(tar.create, filepath, tarfile),
            async.apply(tar.extract, tarfile, cachedir)
        ],
        function (err) {
            callback(err, tarfile, cachedir);
        });
    });
};


exports.get = function (type, name, version, callback) {
    var filename = name + '-' + version + '.tar.gz';
    var dir = exports.dir(type, name, version);
    var tarfile = path.resolve(dir, filename);
    var cachedir = path.resolve(dir, 'package');

    path.exists(cachedir, function (exists) {
        if (exists) {
            return callback(null, tarfile, cachedir);
        }
        else {
            // Package not found in cache, return null
            return callback(null, null, null);
        }
    });
};


exports.moveTar = function (type, name, version, filepath, callback) {
    var filename = name + '-' + version + '.tar.gz';
    var dir = exports.dir(type, name, version);
    var tarfile = path.resolve(dir,filename);
    var cachedir = path.resolve(dir,'package');

    async.series([
        async.apply(mkdirp, dir),
        async.apply(rimraf, cachedir),
        async.apply(fs.rename, filepath, tarfile),
        async.apply(tar.extract, tarfile, cachedir)
    ],
    function (err) {
        if (err) {
            return callback(err);
        }
        callback(null, tarfile, cachedir);
    });
};


exports.dir = function (type, name, version) {
    var args = Array.prototype.slice.call(arguments);
    return path.resolve.apply(path, [exports.CACHE_DIR].concat(args));
};


exports.clear = function (type, name, version, callback) {
    if (!callback) {
        callback = version;
        version = null;
    }
    if (!callback) {
        callback = name;
        name = null;
    }
    if (!type) {
        // do for both types
        return async.parallel([
            async.apply(exports.clear, 'package', name, version),
            async.apply(exports.clear, 'task', name, version)
        ], callback);
    }
    var dir;
    if (!name) {
        dir = exports.dir();
    }
    else if (!version) {
        dir = exports.dir(type, name);
    }
    else {
        dir = exports.dir(type, name, version);
    }
    rimraf(dir, callback);
};


exports.update = function (type, name, version, filepath, callback) {
    exports.clear(type, name, version, function (err) {
        if (err) {
            return callback(err);
        }
        exports.add(type, name, version, filepath, callback);
    });
};
