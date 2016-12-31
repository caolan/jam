var utils = require('./utils'),
    path = require('path'),
    semver = require('semver'),
    logger = require('./logger'),
    schema = require('./schema/package.json'),
    validator = require('is-my-json-valid'),
    async = require('async'),
    validate;

validate = validator(schema);

exports.load = async.memoize(function (dir, callback) {
    var settings_file = path.resolve(dir, 'package.json');
    utils.readJSON(settings_file, function (err, settings) {
        if (err) {
            callback(err);
            return;
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
    var error;

    if (!validate(settings)) {
        error = validate.errors[0];
        throw new Error("Validation error: " + error.field + " " + error.message + " at " + filename);
    }

    if (!semver.valid(settings.version)) {
        throw new Error(
            'Invalid version number in ' + filename + '\n' +
            'Version numbers should follow the format described at ' +
            'http://semver.org (eg, 1.2.3 or 4.5.6-jam.1)'
        );
    }
};
