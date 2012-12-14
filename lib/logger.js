/**
 * Module dependencies
 */

var util = require('util');

/**
 * The level to log at, change this to alter the global logging level.
 * Possible options are: error, warning, info, debug. Default level is info.
 */
exports.level = 'info';


/**
 * Wraps some ANSI codes around some text.
 */
var wrap = function (code, reset) {
    return function (str) {
        return "\x1B[" + code + "m" + str + "\x1B[" + reset + "m";
    };
};

/**
 * ANSI colors and styles used by the logger module.
 */
var bold    = exports.bold    = wrap(1, 22);
var red     = exports.red     = wrap(31, 39);
var green   = exports.green   = wrap(32, 39);
var cyan    = exports.cyan    = wrap(36, 39);
var yellow  = exports.yellow  = wrap(33, 39);
var magenta = exports.magenta = wrap(35, 39);

/**
 * Executes a function only if the current log level is in the levels list
 *
 * @param {Array} levels
 * @param {Function} fn
 */

var forLevels = function (levels, fn) {
    return function (label, val) {
        for (var i = 0; i < levels.length; i++) {
            if (levels[i] === exports.level) {
                return fn(label, val);
            }
        }
    };
};

/**
 * Logs debug messages, using util.inspect to show the properties of objects
 * (logged for 'debug' level only)
 */

exports.debug = forLevels(['debug'], function (label, val) {
    if (val === undefined) {
        val = label;
        label = null;
    }
    if (typeof val !== 'string') {
        val = util.inspect(val);
    }
    if (label && val) {
        console.log(magenta(label + ' ') + val);
    }
    else {
        console.log(label);
    }
});

/**
 * Logs info messages (logged for 'info' and 'debug' levels)
 */

exports.info = forLevels(['info', 'debug'], function (label, val) {
    if (val === undefined) {
        val = label;
        label = null;
    }
    if (typeof val !== 'string') {
        val = util.inspect(val);
    }
    if (label) {
        console.log(cyan(label + ' ') + val);
    }
    else {
        console.log(val);
    }
});

/**
 * Logs warnings messages (logged for 'warning', 'info' and 'debug' levels)
 */

exports.warning = forLevels(['warning', 'info', 'debug'], function (msg) {
    console.log(yellow(bold('Warning: ') + msg));
});

/**
 * Logs error messages (always logged)
 */

exports.error = function (err) {
    var msg = err.message || err.error || err;
    if (err.stack) {
        msg = err.stack.replace(/^Error: /, '');
    }
    console.error(red(bold('Error: ') + msg));
};


/**
 * Display a failure message if exit is unexpected.
 */

exports.clean_exit = false;
exports.end = function (msg) {
    exports.clean_exit = true;
    exports.success(msg);
};
exports.success = function (msg) {
    console.log(green(bold('OK') + (msg ? bold(': ') + msg: '')));
};
var _onExit = function () {
    if (!exports.clean_exit) {
        console.log(red(bold('Failed')));
        process.removeListener('exit', _onExit);
        process.exit(1);
    }
};
process.on('exit', _onExit);

/**
 * Log uncaught exceptions in the same style as normal errors.
 */

process.on('uncaughtException', function (err) {
    exports.error(err.stack || err);
});
