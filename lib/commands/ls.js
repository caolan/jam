var logger = require('../logger'),
    settings = require('../settings'),
    clean = require('./clean'),
    async = require('async'),
    path = require('path');


exports.summary = 'List installed packages';

exports.usage = '' +
    'jam ls [PACKAGE_DIR]\n' +
    '\n' +
    'Parameters:\n' +
    '  PACKAGE_DIR    The Jam package directory to list packages for\n' +
    '                 (defaults to "./jam")';


exports.run = function (_settings, args, commands) {
    var package_dir = path.resolve(args[0] || './jam');

    clean.listDirs(package_dir, function (err, dirs) {
        if (err) {
            return callback(err);
        }
        async.map(dirs, settings.load, function (err, configs) {
            if (err) {
                return logger.error(err);
            }
            configs.forEach(function (cfg) {
                console.log(cfg.name + '@' + cfg.version);
            });
            logger.clean_exit = true;
        });
    });
};
