/**
 * Pads a string to minlength by appending spaces.
 *
 * @param {String} str
 * @param {Number} minlength
 * @return {String}
 * @api public
 */

exports.padRight = function (str, minlength) {
    while (str.length < minlength) {
        str = str + ' ';
    }
    return str;
};

exports.longest = function (arr) {
    return arr.reduce(function (a, x) {
        if (x.length > a) {
            return x.length;
        }
        return a;
    }, 0);
};

/**
 * Reads the version property from Jam's package.json
 */

exports.getJamVersion = function (callback) {
    exports.readJSON(__dirname + '/../package.json', function (err, pkg) {
        if (err) {
            return callback(err);
        }
        return callback(null, pkg.version);
    });
};
