#!/usr/bin/env node

var path = require('path'),
    utils = require('../lib/utils'),
    jamrc = require('../lib/jamrc'),
    logger = require('../lib/logger'),
    commands = require('../lib/commands');


var args = process.argv.slice(2);

for (var i = 0; i < args.length; i += 1) {
    if (args[i] === '--debug') {
        args.splice(i, 1);
        logger.level = 'debug';
    }
}

jamrc.load(function (err, settings) {

    function usage() {
        console.log('Usage: jam COMMAND [ARGS]');
        console.log('');
        console.log('Available commands:');
        var len = utils.longest(Object.keys(commands));
        for (var k in commands) {
            if (!commands[k].hidden) {
                console.log(
                    '  ' + utils.padRight(k, len) + '    ' + commands[k].summary
                );
            }
        }
        logger.clean_exit = true;
    }

    if (!args.length) {
        usage();
    }
    else {
        var cmd = args.shift();
        if (cmd === '-h' || cmd === '--help') {
            usage();
        }
        else if (cmd === '-v' || cmd === '--version') {
            utils.getJamVersion(function (err, ver) {
                if (err) {
                    return logger.error(err);
                }
                logger.clean_exit = true;
                console.log(ver);
            });
        }
        else if (cmd in commands) {
            commands[cmd].run(settings, args, commands);
        }
        else {
            logger.error('No such command: ' + cmd);
            usage();
        }
    }

});
