/**
 * Utilities for dealing with package versions
 */

var semver = require('semver');


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
    var satisfying = versions.filter(function (v) {
        return exports.satisfiesAll(v, ranges);
    });
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
    return ranges.every(function(r) {
        // if range is null, linked, installed from URL, or from GitHub,
        // then any version satisfies that requirement
        return !r ||
            r === 'linked' ||
            /^https?:\/\//.test(r) ||
            /^gh:/.test(r) || /^github:/.test(r) ||
            semver.satisfies(version, r);
    });
};
