var logger = require('../logger'),
    settings = require('../settings'),
    project = require('../project'),
    install = require('./install'),
    utils = require('../utils'),
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
    var opt = {};
    var cwd = process.cwd();
    install.initDir(_settings, cwd, opt, function (err, opt, cfg, proj_dir) {
        if (err) {
            return logger.error(err);
        }
        var package_dir;
        if (!args[0]) {
            if (cfg.jam && cfg.jam.packageDir) {
                package_dir = path.resolve(proj_dir, cfg.jam.packageDir);
            }
            else {
                package_dir = path.resolve(proj_dir, _settings.package_dir || '');
            }
        }
        else {
            package_dir = args[0];
        }
        exports.ls(_settings, cfg, package_dir, function (err, output, pkgs) {
            if (err) {
                return logger.error();
            }
            console.log(output);
            logger.clean_exit = true;
        });
    });
};


exports.ls = function (_settings, cfg, package_dir, callback) {
    var deps = project.getJamDependencies(cfg);
    utils.listDirs(package_dir, function (err, dirs) {
        if (err) {
            return callback(err);
        }

        var packages = [];
        var lines = [];

        async.forEachLimit(dirs, 5, function (dir, cb) {
            settings.load(dir, function (err, pkg) {
                if (err) {
                    return cb(err);
                }
                var line = '';
                if (deps.hasOwnProperty(pkg.name)) {
                    // directly installed
                    line += '* ';
                }
                else {
                    line += '  '
                }
                line += pkg.name + ' ' + logger.yellow(pkg.version);
                if (deps[pkg.name] === 'linked') {
                    var p = path.resolve(package_dir, pkg.name || '');
                    var realpath = fs.readlinkSync(p);
                    line += logger.cyan(' => ' + realpath);
                }
                else if (deps[pkg.name]) {
                    // locked to a specific version/range
                    line += logger.red(
                        ' [locked ' + deps[pkg.name] + ']'
                    );
                }
                packages.push(pkg);
                lines.push(line);
                cb();
            });
        },
        function (err) {
            return callback(err, lines.join('\n'), packages);
        });
    });
};
