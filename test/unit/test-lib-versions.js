var versions = require('../../lib/versions'),
    logger = require("../../lib/logger"),
    Range = require('../../lib/tree').Range;

//logger.level = "verbose";

exports['maxSatisfying - should return version without build meta'] = function (test) {
    var max, expect;

    max = versions.maxSatisfying(['0.10.0', '0.10.0+build.1', '0.10.0+build.2'], [ new Range((expect = "0.10.0")) ]);

    test.equal(max, expect, "Not equal. Actual: " + max + " Expected: " + expect);
    test.done();
};

exports['maxSatisfying - should return version with highest meta'] = function (test) {
    var max, expect;

    max = versions.maxSatisfying(['0.10.0', '0.10.0+build.1', (expect = '0.10.0+build.2')], [ new Range("0.10.0+build.3") ]);

    test.equal(max, expect, "Not equal. Actual: " + max + " Expected: " + expect);
    test.done();
};

exports['equalButNotMeta'] = function (test) {
    var warn, expect;

    warn = versions.equalButNotMeta('0.10.0+build.1', [ new Range((expect = "0.10.0")) ]);

    test.equal(warn[0], expect);
    test.done();
};