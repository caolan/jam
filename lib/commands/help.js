var utils = require('../utils'),
    logger = require('../logger');


exports.summary = 'Show help specific to a command';

exports.usage = '' +
    'jam help [COMMAND]\n' +
    '\n' +
    'Parameters:\n' +
    '  COMMAND      The jam command to show help on\n' +
    '\n' +
    'Available commands:\n';


exports.run = function (settings, args, commands) {
    // add summary of commands to exports.usage
    var len = utils.longest(Object.keys(commands));

    for (var k in commands) {
        exports.usage += '  ' + utils.padRight(k, len);
        exports.usage += '    ' + commands[k].summary + '\n';
    }

    if (!args.length) {
        console.log('Usage: ' + exports.usage);
        logger.clean_exit = true;
    }
    else {
        args.forEach(function (a) {
            var cmd = commands[a];
            if (cmd) {
                console.log(cmd.summary);
                console.log('Usage: ' + cmd.usage);
            }
        });
        logger.clean_exit = true;
    }
};
