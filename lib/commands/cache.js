var logger = require('../logger'),
    cache = require('../cache');


exports.summary = 'Manage locally cached packages and tasks';

exports.usage = '\n' +
'  jam cache clear-package [PACKAGE[@VERSION]]\n' +
'  jam cache clear-task [TASK[@VERSION]]\n' +
'  jam cache clear-packages\n' +
'  jam cache clear-tasks\n' +
'  jam cache clear-all';
/*
'jam cache ls\n' +
'jam cache add-task [ARCHIVE]\n' +
'jam cache add-package [ARCHIVE]\n' +
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
*/


exports.run = function (settings, args) {
    if (args.length < 1) {
        console.log('USAGE: ' + exports.usage);
        logger.clean_exit = true;
        return;
    }
    var cmd = args[0];
    if (cmd === 'clear-package' && args.length < 2 ||
        cmd === 'clear-task' && args.length < 2) {
        console.log('USAGE: ' + exports.usage);
        logger.clean_exit = true;
        return;
    }

    switch (cmd) {
    case 'clear-package':  exports.clear(cmd, args.slice(1)); break;
    case 'clear-packages': exports.clear(cmd, args.slice(1)); break;
    case 'clear-task':     exports.clear(cmd, args.slice(1)); break;
    case 'clear-tasks':    exports.clear(cmd, args.slice(1)); break;
    case 'clear-all':      exports.clear(cmd, args.slice(1)); break;
    default:
        // unknown command
        console.log('USAGE: ' + exports.usage);
        logger.clean_exit = true;
        return;
    }
};


exports.clear = function (cmd, args) {
    if (cmd === 'clear-package' || cmd === 'clear-task') {
        if (args.length < 1) {
            // missing package name/version
            console.log('USAGE: ' + exports.usage);
            logger.clean_exit = true;
            return;
        }
    }

    var type = null,
        version = null,
        name = args[0];

    if (name && name.indexOf('@') !== -1) {
        var parts = name.split('@');
        name = parts[0];
        version = parts.slice(1).join('@');
    }

    if (cmd === 'clear-package' || cmd === 'clear-packages') {
        type = 'package';
    }
    if (cmd === 'clear-task' || cmd === 'clear-tasks') {
        type = 'task';
    }

    cache.clear(type, name, version, function (err) {
        if (err) {
            return logger.error(err);
        }
        logger.end();
    });
};
