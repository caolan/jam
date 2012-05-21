var tar = require('./tar'),
    env = require('./env'),
    utils = require('./utils'),
    mkdirp = require('mkdirp'),
    async = require('async'),
    path = require('path');


exports.CACHE_DIR = path.resolve(env.home, '.kanso/cache');


exports.addDirectory = function (name, version, dir, callback) {
    var filename = name + '-' + version + '.tar.gz';
    var dir = exports.dir(name, version);
    var tarfile = path.resolve(dir, filename);
    var cachedir = path.resolve(dir, 'package');

    mkdirp(dir, function (err) {
        if (err) {
            return callback(err);
        }
        async.series([
            async.apply(tar.create, cachedir, tarfile),
            async.apply(tar.extract, tarfile, cachedir)
        ],
        function (err) {
            callback(err, tarfile, cachedir);
        });
    });
};
