var logger = require('../logger'),
    cache = require('../cache');


exports.summary = 'Removes packages from the local cache';

exports.usage = '' +
'jam clear-cache [PACKAGE[@VERSION]]\n' +
'\n' +
'* If no package is specified, all packages are cleared from the cache.\n' +
'* If a package is specified without a version, all versions of that\n' +
'  package are cleared.\n' +
'* If a package and a version are specified, only that specific version\n' +
'  is cleared.\n' +
'\n' +
'Parameters:\n' +
'  PACKAGE       Package name to clear\n' +
'  VERSION       Package version to clear';


exports.run = function (settings, args) {
    var version;
    var name = args[0];

    if (name && name.indexOf('@') !== -1) {
        var parts = name.split('@');
        name = parts[0];
        version = parts.slice(1).join('@');
    }

    cache.clear(name, version, function (err) {
        if (err) {
            return logger.error(err);
        }
        logger.end();
    });
};
