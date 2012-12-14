var utils = require('./utils'),
    path = require('path'),
    semver = require('semver'),
    async = require('async');


exports.load = async.memoize(function (dir, callback) {
    var settings_file = path.resolve(dir, 'package.json');
    utils.readJSON(settings_file, function (err, settings) {
        if (err) {
            callback(err);
        }
        try {
            // if there is a jam.name we must override the
            // package name early.
            if (settings.jam && settings.jam.name) {
                settings.name = settings.jam.name;
            }
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
    if (!/^[a-zA-Z][a-zA-Z0-9_\-\.]*$/.test(settings.name) || (/\.js$/i).test(settings.name)) {
        throw new Error(
          'Invalid name property in ' + filename + ', ' +
            'package names can only contain numbers, upper or lowercase ' +
            'package name must not end with .js ' +
            'letters and "_", "-" or ".", and must start with a letter'
        );
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
            'http://semver.org (eg, 1.2.3 or 4.5.6-jam.1)'
        );
    }
};
