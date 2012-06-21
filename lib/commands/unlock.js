var logger = require('../logger'),
    settings = require('../settings'),
    project = require('../project'),
    install = require('./install'),
    async = require('async'),
    path = require('path');


exports.summary = 'Unlocks a package from a version requirement';

exports.usage = '' +
    'jam unlock [PACKAGE...]\n' +
    '\n' +
    'When called without any parameters lists current locks.\n' +
    '\n' +
    'Parameters:\n' +
    '  PACKAGE    The package to unlock from a specific version\n' +
    '\n' +
    'Options:\n' +
    '  -r, --repository   Source repository URL (otherwise uses values in jamrc)\n' +
    '  -d, --package-dir  Jam package directory (defaults to "./jam")';


exports.run = function (_settings, args, commands) {
    var a = argParse(args, {
        'repository': {match: ['-r', '--repository'], value: true},
        'target_dir': {match: ['-d', '--package-dir'], value: true}
    });

    var opt = a.options;
    opt.target_dir = opt.target_dir || './jam';

    opt.repositories = _settings.repositories;
    if (a.options.repository) {
        opt.repositories = [a.options.repository];
        // don't allow package dir .jamrc file to overwrite repositories
        opt.fixed_repositories = true;
    }

    project.load(opt.target_dir, function (err, meta) {
        if (err) {
            return logger.error(err);
        }

        // list current locks
        if (a.positional.length < 1) {
            for (var name in meta.dependencies) {
                if (meta.dependencies[name]) {
                    console.log(name + '@' + meta.dependencies[name]);
                }
            }
            logger.clean_exit = true;
            return;
        }

        a.positional.map(function (name) {
            if (!(name in meta.dependencies)) {
                return logger.error('Package not found: "' + name + '"');
            }
            meta.dependencies[name] = null;
        });
        install.reinstallPackages(meta, opt, function (err) {
            if (err) {
                return logger.error(err);
            }
            logger.end();
        });
    });
};
