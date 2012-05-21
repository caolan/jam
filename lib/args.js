
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
            result.options[k] = exports.getOpt(result.positional, opts[k]);
        }
    }
    return result;
};
