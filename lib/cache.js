var tar = require('./tar'),
    env = require('./env'),
    rimraf = require('rimraf'),
    mkdirp = require('mkdirp'),
    async = require('async'),
    path = require('path'),
    fs = require('fs');


var pathExists = fs.exists || path.exists;


exports.CACHE_DIR = path.resolve(env.home, '.jam/cache');


exports.add = function (cfg, filepath, callback) {
    var filename = cfg.name + '-' + cfg.version + '.tar.gz';
    var dir = exports.dir(cfg.name, cfg.version);
    var tarfile = path.resolve(dir, filename);
    var cachedir = path.resolve(dir, 'package');

    mkdirp(dir, function (err) {
        if (err) {
            return callback(err);
        }
        async.series([
            async.apply(tar.create, cfg, filepath, tarfile),
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
    var tarfile = path.resolve(dir, filename);
    var cachedir = path.resolve(dir, 'package');

    pathExists(cachedir, function (exists) {
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
    var args = Array.prototype.slice.call(arguments);
    return path.resolve.apply(path, [exports.CACHE_DIR].concat(args));
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
        dir = exports.dir();
    }
    else if (!version) {
        dir = exports.dir(name);
    }
    else {
        dir = exports.dir(name, version);
    }
    rimraf(dir, callback);
};


exports.update = function (cfg, filepath, callback) {
    exports.clear(cfg.name, cfg.version, function (err) {
        if (err) {
            return callback(err);
        }
        exports.add(cfg, filepath, callback);
    });
};
