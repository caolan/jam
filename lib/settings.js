var utils = require('./utils'),
    path = require('path'),
    semver = require('semver'),
    async = require('async');


exports.load = async.memoize(function (dir, callback) {
    var settings_file = path.join(dir, 'package.json');
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
        callback(null, settings);
    });
});

exports.validate = function (settings, filename) {
    if (!settings.name) {
        throw new Error('Missing name property in ' + filename);
    }
    if (!settings.version) {
        throw new Error('Missing version property in ' + filename);
    }
    if (!settings.description) {
        throw new Error('Missing description property in ' + filename);
    }
    if (!semver.valid(settings.version)) {
        throw new Error(
            'Invalid version number in ' + filename + '\n' +
            'Version numbers should follow the format described at ' +
            'http://semver.org (eg, 1.2.3)'
        );
    }
};
