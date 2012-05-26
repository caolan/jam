var _ = require('underscore');

/**
 * Extracts an option from command line args array, removing the opt from the
 * array and returning the value.
 */

exports.getOpt = function (args, opt) {
    if (!(opt.match instanceof Array)) {
        opt.match = [opt.match];
    }
    for (var i = 0; i < args.length; i++) {
        for (var j = 0; j < opt.match.length; j++) {
            if (args[i].split('=')[0] === opt.match[j]) {
                if (opt.value) {
                    var val;
                    if (args[i].indexOf('=') !== -1) {
                        val = args[i].split('=').slice(1).join('=');
                        args.splice(i, 1);
                        return val;
                    }
                    else {
                        val = args[i + 1];
                        args.splice(i, 2);
                        return val;
                    }
                }
                else {
                    args.splice(i, 1);
                    return true;
                }
            }
        }
    }
    if (opt.value) {
        return undefined;
    }
    return false;
};

exports.parse = function (args, opts) {
    var result = {positional: args.slice(), options: {}};
    for (var k in opts) {
        if (opts.hasOwnProperty(k)) {
            var val, arr = [];
            do {
                val = exports.getOpt(result.positional, opts[k]);
                arr.push(val);
            }
            while (val !== undefined && val !== false);

            arr = _.compact(arr);

            if (arr.length > 1) {
                if (opts[k].multiple) {
                    result.options[k] = arr;
                }
                else {
                    throw new Error('Multiple values not allowed for ' + k);
                }
            }
            else if (arr.length === 1) {
                result.options[k] = opts[k].multiple ? arr: arr[0];
            }
            else {
                result.options[k] = opts[k].multiple ? []: undefined;
            }
        }
    }
    return result;
};
