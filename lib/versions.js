/**
 * Utilities for dealing with package versions
 */

var semver = require('semver'),
    logger = require('./logger');


/**
 * Sorts an array of version numbers in descending semver order (highest
 * version number first). This is an alternative to semver.rcompare since it
 * doesn't appear to work as expected.
 *
 * @param {Array} versions - an array of version number strings
 * @returns {Array}
 */

exports.sortDescending = function (versions) {
    // for some reason semver.rcompare doesn't work
    return versions.slice().sort(semver.compare).reverse();
};


/**
 * Returns the highest version number in an array.
 *
 * @param {Array} versions - an array of version number strings
 * @returns {String}
 */

exports.max = function (versions) {
    return exports.sortDescending(versions)[0];
};

exports.satisfying = function(versions, ranges) {
    return versions.filter(function (v) {
        return exports.satisfiesAll(v, ranges);
    });
};

/**
 * Checks an array of range requirements against an array of available versions,
 * returning the highest version number that satisfies all ranges or null if
 * all ranges can't be satisfied.
 *
 * @param {Array} versions - an array of version strings
 * @param {Array} ranges - an array of range strings
 * @returns {String|null}
 */

exports.maxSatisfying = function (versions, ranges) {
    var satisfying = exports.satisfying(versions, ranges);
    return satisfying.length ? exports.max(satisfying): null;
};


/**
 * Checks if a version number satisfies an array of range requirements.
 *
 * @param {String} version - a semver version string
 * @param {Array} ranges - an array of range strings
 * @returns {Boolean}
 */

exports.satisfiesAll = function (version, ranges) {
    return ranges.every(function(range) {
        var satisfies;

        if (!semver.valid(version)) {
            logger.warning('Could not compare version "' + version + '" cause it is not a valid semver');
            return false;
        }

        // if range is null, linked, installed from URL, or from GitHub, or from Git,
        // then any version satisfies that requirement
        satisfies = false;
        satisfies = satisfies || !range;

        // todo is it good?
        satisfies = satisfies || range === 'linked';

        satisfies = satisfies || semver.satisfies(version, range.valueOf());

        return satisfies;
    });
};


/**
 * Experimental method.
 *
 * @deprecated
 * @param version
 * @returns {*}
 */
exports.validify = function(version) {
    var match, preName, preVersion, result;

    if (semver.valid(version)) {
        return version;
    }

    // match as
    // #1 version
    // #2 prerelease name delimiter
    // #3 prerelease name
    // #4 prerelease version delimiter
    // #5 prerelease version
    if (match = /(\d+(?:\.\d+(?:\.\d+)?)?)(-)?([a-z]{0,})?(\.)?(\d+)?/i.exec(version)) {
        result = match[1];

        if (preName = match[3]) {
            result += "-" + preName;

            if (preVersion = match[5]) {
                result += "." + preVersion;
            }
        }

        return result;
    }

    return null;
};
