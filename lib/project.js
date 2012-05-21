var utils = require('./utils'),
    path = require('path'),
    semver = require('semver'),
    async = require('async');


exports.load = async.memoize(function (dir, callback) {
    var settings_file = path.resolve(dir, 'jam.json');
    path.exists(settings_file, function (exists) {
        if (!exists) {
            settings_file = path.resolve(dir, 'jam.js');
            path.exists(settings_file, function (exists) {
                if (exists) {
                    var settings = require(settings_file);
                    try {
                        exports.validate(settings, settings_file);
                    }
                    catch (e) {
                        return callback(e);
                    }
                    return callback(null, settings);
                }
                else {
                    return callback(new Error(
                        'No jam.json or jam.js file exists for ' + dir
                    ));
                }
            });
        }
        else {
            utils.readJSON(settings_file, function (err, settings) {
                if (err) {
                    callback(err);
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
    });
});

exports.validate = function (settings, filename) {
    // nothing to validate yet
};
