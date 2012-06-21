var logger = require('../logger'),
    settings = require('../settings'),
    project = require('../project'),
    clean = require('./clean'),
    async = require('async'),
    path = require('path'),
    fs = require('fs');


var pathExists = fs.exists || path.exists;


exports.summary = 'List installed packages';

exports.usage = '' +
    'jam ls [PACKAGE_DIR]\n' +
    '\n' +
    'Packages listed with a leading * are directly installed, others\n' +
    'will be marked as unused once their directly installed dependant\n' +
    'is removed or no longer depends on them.\n' +
    '\n' +
    'Parameters:\n' +
    '  PACKAGE_DIR    The Jam package directory to list packages for\n' +
    '                 (defaults to "./jam")';


exports.run = function (_settings, args, commands) {
    var package_dir = path.resolve(args[0] || './jam');

    pathExists(path.resolve(package_dir, 'jam.json'), function (exists) {
        if (!exists) {
            logger.clean_exit = true;
            return;
        }
        else {
            project.load(package_dir, function (err, meta) {
                if (err) {
                    return logger.error(err);
                }
                var deps = meta.dependencies;
                clean.listDirs(package_dir, function (err, dirs) {
                    if (err) {
                        return logger.error(err);
                    }
                    async.forEachLimit(dirs, 5,
                        function (dir, cb) {
                            settings.load(dir, function (err, cfg) {
                                if (err) {
                                    return cb(err);
                                }
                                var line = '';
                                if (deps.hasOwnProperty(cfg.name)) {
                                    // directly installed
                                    line += '* ';
                                }
                                else {
                                    line += '  '
                                }
                                line += cfg.name + ' ' + logger.yellow(cfg.version);
                                if (deps[cfg.name] === 'linked') {
                                    var p = path.resolve(package_dir, cfg.name);
                                    var realpath = fs.readlinkSync(p);
                                    line += logger.cyan(' => ' + realpath);
                                }
                                else if (deps[cfg.name]) {
                                    // locked to a specific version/range
                                    line += logger.red(
                                        ' [locked ' + deps[cfg.name] + ']'
                                    );
                                }
                                console.log(line);
                                cb();
                            });
                        },
                        function (err, configs) {
                            if (err) {
                                return logger.error(err);
                            }
                            logger.clean_exit = true;
                        }
                    );
                });
            });
        }
    });
};
