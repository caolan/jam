var tar = require('./tar'),
    env = require('./env'),
    rimraf = require('rimraf'),
    mkdirp = require('mkdirp'),
    async = require('async'),
    path = require('path'),
    fs = require('fs');


exports.CACHE_DIR = path.resolve(env.home, '.jam/cache');


exports.add = function (name, version, filepath, callback) {
    var filename = name + '-' + version + '.tar.gz';
    var dir = exports.dir(name, version);
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


exports.get = function (name, version, callback) {
    var filename = name + '-' + version + '.tar.gz';
    var dir = exports.dir(name, version);
    var tarfile = path.resolve(dir,filename);
    var cachedir = path.resolve(dir,'package');

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


exports.moveTar = function (name, version, filepath, callback) {
    var filename = name + '-' + version + '.tar.gz';
    var dir = exports.dir(name, version);
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


exports.dir = function (name, version) {
    return path.resolve(exports.CACHE_DIR,name,version);
};


exports.clear = function (name, version, callback) {
    if (!callback) {
        callback = version;
        version = null;
    }
    if (!callback) {
        callback = name;
        name = null;
    }
    var dir;
    if (!name) {
        dir = exports.CACHE_DIR;
    }
    else if (!version) {
        dir = path.resolve(exports.CACHE_DIR,name);
    }
    else {
        dir = path.resolve(exports.CACHE_DIR,name,version);
    }
    rimraf(dir, callback);
};


exports.update = function (name, version, filepath, callback) {
    exports.clear(name, version, function (err) {
        if (err) {
            return callback(err);
        }
        exports.add(name, version, filepath, callback);
    });
};
